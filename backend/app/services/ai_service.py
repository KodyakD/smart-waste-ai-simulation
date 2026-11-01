from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from ..config import BASE_DIR


CLASS_RISKS = {
    "ordinary_waste": "normal",
    "battery": "potential_hazard",
    "batteries": "potential_hazard",
    "electronic_waste": "potential_hazard",
    "e_waste": "potential_hazard",
    "aerosol": "potential_hazard",
    "aerosol_container": "potential_hazard",
    "medical_sharp": "high_concern",
    "medical_waste": "high_concern",
    "sharp": "high_concern",
}


class AIService:
    def __init__(self) -> None:
        base_dir = BASE_DIR
        configured_path = os.getenv("YOLO_MODEL_PATH", "ai/weights/best.pt")
        model_path = Path(configured_path)
        if not model_path.is_absolute():
            model_path = (base_dir / model_path).resolve()
        self.model_path = model_path
        self.model: Any = None
        self.error: str | None = None
        self._attempted = False

    def load(self) -> None:
        if self._attempted:
            return
        self._attempted = True
        if not self.model_path.exists():
            self.error = "Custom YOLO weights were not found. Train a model and place best.pt in backend/ai/weights/."
            return
        try:
            from ultralytics import YOLO
            self.model = YOLO(str(self.model_path))
        except Exception as exc:  # optional dependency or invalid weights
            self.error = f"Could not load YOLO model: {exc}"

    def status(self) -> dict[str, Any]:
        self.load()
        return {
            "configured": self.model is not None,
            "model_path": str(self.model_path),
            "message": "Custom YOLO model is ready." if self.model is not None else self.error,
            "classes": [
                "ordinary_waste",
                "battery",
                "electronic_waste",
                "aerosol",
                "medical_sharp",
            ],
        }

    def predict(self, image_path: Path, confidence_threshold: float = 0.35) -> list[dict[str, Any]]:
        self.load()
        if self.model is None:
            raise RuntimeError(self.error or "AI model is not configured.")

        results = self.model.predict(source=str(image_path), conf=confidence_threshold, verbose=False)
        predictions: list[dict[str, Any]] = []
        for result in results:
            names = result.names
            boxes = result.boxes
            if boxes is None:
                continue
            for box in boxes:
                class_index = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                class_name = str(names[class_index]).strip().lower().replace(" ", "_").replace("-", "_")
                risk_level = CLASS_RISKS.get(class_name, "needs_review")
                xyxy = [round(float(value), 1) for value in box.xyxy[0].tolist()]
                predictions.append({
                    "class_name": class_name,
                    "confidence": round(confidence, 4),
                    "risk_level": risk_level,
                    "bbox": xyxy,
                })
        return predictions


def serialize_bbox(prediction: dict[str, Any]) -> str:
    return json.dumps(prediction.get("bbox", []))
