from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError

from .config import AI_CLASSES, BASE_DIR, SETTINGS  # loads backend/.env before other modules read settings
from . import database
from .schemas import FillLevelRequest
from .services.ai_service import AIService, serialize_bbox
from .services.simulator import SimulationRunner

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "storage" / "uploads")))
if not UPLOAD_DIR.is_absolute():
    UPLOAD_DIR = (BASE_DIR / UPLOAD_DIR).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

INTERVAL = SETTINGS.simulation_interval_seconds
simulator = SimulationRunner(interval_seconds=INTERVAL)
ai_service = AIService()


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


@app.get("/api/v1/bins/{bin_id}/readings")
def bin_readings(bin_id: str, limit: int = 60) -> list[dict[str, Any]]:
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


@app.get("/api/v1/ai/status")
def ai_status() -> dict[str, Any]:
    return ai_service.status()


@app.post("/api/v1/ai/detect")
async def detect_waste(file: UploadFile = File(...)) -> dict[str, Any]:
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WEBP image")

    content = await file.read()
    if not content or len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 10 MB")

    try:
        from io import BytesIO
        with Image.open(BytesIO(content)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image")

    status = ai_service.status()
    if not status["configured"]:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AI_MODEL_NOT_CONFIGURED",
                "message": status["message"],
                "next_step": "Train a YOLO model and place best.pt in backend/ai/weights/.",
            },
        )

    safe_name = Path(file.filename or "waste-image").name
    extension = allowed_types[file.content_type]
    stored_name = f"{uuid.uuid4().hex}{extension}"
    destination = UPLOAD_DIR / stored_name
    destination.write_bytes(content)

    try:
        predictions = ai_service.predict(destination)
    except Exception as exc:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"AI inference failed: {exc}")

    saved = []
    for prediction in predictions:
        saved.append(database.create_detection(
            filename=stored_name,
            original_filename=safe_name,
            class_name=prediction["class_name"],
            confidence=prediction["confidence"],
            risk_level=prediction["risk_level"],
            status="detected" if prediction["risk_level"] != "needs_review" else "manual_review",
            bbox_json=serialize_bbox(prediction),
        ))

    return {
        "image_url": f"/api/v1/uploads/{stored_name}",
        "detections": saved,
        "count": len(saved),
        "message": "No target objects were detected." if not saved else "Image analyzed successfully.",
    }


@app.get("/api/v1/uploads/{filename}")
def uploaded_image(filename: str) -> FileResponse:
    # Only serve files that exist directly in the configured upload directory.
    safe_filename = Path(filename).name
    path = UPLOAD_DIR / safe_filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)
