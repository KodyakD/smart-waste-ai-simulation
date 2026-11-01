from __future__ import annotations

import os
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError

from .. import database
from ..config import (
    AI_CLASSES,
    AI_CLASS_ALIASES,
    AI_SUPPORTED_CLASSES,
    AI_UNSUPPORTED_CLASSES,
    BASE_DIR,
    SETTINGS,
)
from ..services.ai_service import AIService, serialize_bbox

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "storage" / "uploads")))
if not UPLOAD_DIR.is_absolute():
    UPLOAD_DIR = (BASE_DIR / UPLOAD_DIR).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ai_service = AIService()
router = APIRouter()


def apply_dataset_class_support(prediction: dict[str, Any]) -> dict[str, Any]:
    canonical = AI_CLASS_ALIASES.get(
        prediction["class_name"], prediction["class_name"]
    )
    prediction["class_name"] = canonical
    if canonical in AI_UNSUPPORTED_CLASSES:
        prediction["risk_level"] = "needs_review"
    return prediction


@router.get("/api/v1/ai/status")
def ai_status() -> dict[str, Any]:
    return {
        **ai_service.status(),
        "classes": list(AI_CLASSES),
        "supported_classes": list(AI_SUPPORTED_CLASSES),
        "unsupported_classes": list(AI_UNSUPPORTED_CLASSES),
    }


@router.post("/api/v1/ai/detect")
async def detect_waste(file: UploadFile = File(...)) -> dict[str, Any]:
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WEBP image")

    content = await file.read()
    if not content or len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 10 MB")

    try:
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
        predictions = ai_service.predict(destination, confidence_threshold=SETTINGS.ai_confidence_threshold)
    except Exception as exc:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"AI inference failed: {exc}")

    saved = []
    for prediction in predictions:
        prediction = apply_dataset_class_support(prediction)
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


@router.get("/api/v1/uploads/{filename}")
def uploaded_image(filename: str) -> FileResponse:
    # Only serve files that exist directly in the configured upload directory.
    safe_filename = Path(filename).name
    path = UPLOAD_DIR / safe_filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)

