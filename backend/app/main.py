from __future__ import annotations

import os
import sqlite3
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import database
from .config import BASE_DIR, SETTINGS  # loads backend/.env before other modules read settings
from .routes.ai import ai_service, router as ai_router
from .schemas import BinCreateRequest, BinUpdateRequest, FillLevelRequest
from .services.simulator import SimulationRunner

INTERVAL = SETTINGS.simulation_interval_seconds
simulator = SimulationRunner(interval_seconds=INTERVAL)


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.init_db()
    await simulator.start()
    yield
    await simulator.stop()


app = FastAPI(
    title=SETTINGS.app_name,
    description="Software-only virtual garbage-bin simulator and AI waste detection API.",
    version="0.1.0",
    lifespan=lifespan,
)

origins = [item.strip() for item in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}):5173",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {"name": SETTINGS.app_name, "docs": "/docs", "health": "/api/v1/health"}


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "smart-waste-api"}


@app.get("/api/v1/config")
def app_config() -> dict[str, Any]:
    return {
        "simulation": {
            "interval_seconds": SETTINGS.simulation_interval_seconds,
            "full_distance_cm": SETTINGS.sensor_full_distance_cm,
            "speed_of_sound_cm_per_us": SETTINGS.speed_of_sound_cm_per_us,
            "max_readings": SETTINGS.max_readings,
        },
        "thresholds": {
            "almost_full": SETTINGS.fill_almost_full_threshold,
            "full": SETTINGS.fill_full_threshold,
        },
        "ai": {
            "configured": ai_service.status()["configured"],
            "model_path": SETTINGS.ai_model_path,
            "architecture": "YOLO object detection",
            "device": SETTINGS.ai_device,
            "confidence_threshold": SETTINGS.ai_confidence_threshold,
            "classes": list(AI_CLASSES),
            "supported_classes": list(AI_SUPPORTED_CLASSES),
            "unsupported_classes": list(AI_UNSUPPORTED_CLASSES),
        },
        "app": {"name": SETTINGS.app_name, "environment": SETTINGS.app_environment},
    }


@app.get("/api/v1/dashboard")
def dashboard() -> dict[str, Any]:
    return {
        **database.dashboard_summary(),
        "recent_alerts": database.list_alerts(5),
        "bins": database.list_bins(),
    }


@app.get("/api/v1/bins")
def bins() -> list[dict[str, Any]]:
    return database.list_bins()


@app.post("/api/v1/bins", status_code=201)
def create_bin(payload: BinCreateRequest) -> dict[str, Any]:
    try:
        return database.create_bin(
            bin_id=payload.id,
            name=payload.name,
            location=payload.location,
            capacity_cm=payload.capacity_cm,
            fill=payload.fill_percentage,
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="A bin with this id already exists")


@app.patch("/api/v1/bins/{bin_id}")
def update_bin(bin_id: str, payload: BinUpdateRequest) -> dict[str, Any]:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    updated = database.update_bin(bin_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Virtual bin not found")
    return updated


@app.delete("/api/v1/bins/{bin_id}", status_code=204)
def delete_bin(bin_id: str) -> None:
    if not database.delete_bin(bin_id):
        raise HTTPException(status_code=404, detail="Virtual bin not found")


@app.get("/api/v1/bins/{bin_id}/readings")
def bin_readings(bin_id: str, limit: int = SETTINGS.max_readings) -> list[dict[str, Any]]:
    if database.get_bin(bin_id) is None:
        raise HTTPException(status_code=404, detail="Virtual bin not found")
    return database.get_readings(bin_id, limit)


@app.get("/api/v1/simulation/status")
def simulation_status() -> dict[str, Any]:
    all_bins = database.list_bins()
    return {
        "running": any(item["is_running"] for item in all_bins),
        "active_bins": sum(1 for item in all_bins if item["is_running"]),
        "interval_seconds": INTERVAL,
        "bins": all_bins,
    }


@app.post("/api/v1/simulation/start/{bin_id}")
def start_simulation(bin_id: str) -> dict[str, Any]:
    bin_item = database.get_bin(bin_id)
    if bin_item is None:
        raise HTTPException(status_code=404, detail="Virtual bin not found")
    updated = database.set_bin_running(bin_id, True)
    return {"message": "Simulation started", "bin": updated}


@app.post("/api/v1/simulation/pause/{bin_id}")
def pause_simulation(bin_id: str) -> dict[str, Any]:
    bin_item = database.get_bin(bin_id)
    if bin_item is None:
        raise HTTPException(status_code=404, detail="Virtual bin not found")
    updated = database.set_bin_running(bin_id, False)
    return {"message": "Simulation paused", "bin": updated}


@app.post("/api/v1/simulation/reset/{bin_id}")
def reset_simulation(bin_id: str) -> dict[str, Any]:
    bin_item = database.get_bin(bin_id)
    if bin_item is None:
        raise HTTPException(status_code=404, detail="Virtual bin not found")
    database.set_bin_running(bin_id, False)
    updated = database.record_reading(bin_id, 0)
    return {"message": "Virtual bin emptied and simulation paused", "bin": updated}


@app.post("/api/v1/simulation/level/{bin_id}")
def set_simulation_level(bin_id: str, payload: FillLevelRequest) -> dict[str, Any]:
    if database.get_bin(bin_id) is None:
        raise HTTPException(status_code=404, detail="Virtual bin not found")
    updated = database.record_reading(bin_id, payload.fill_percentage)
    return {"message": "Virtual sensor reading updated", "bin": updated}


@app.get("/api/v1/alerts")
def alerts(limit: int = 30) -> list[dict[str, Any]]:
    return database.list_alerts(limit)


@app.post("/api/v1/alerts/{alert_id}/read")
def read_alert(alert_id: int) -> dict[str, bool]:
    if not database.mark_alert_read(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@app.get("/api/v1/detections")
def detections(limit: int = 30) -> list[dict[str, Any]]:
    return database.list_detections(limit)



app.include_router(ai_router)
