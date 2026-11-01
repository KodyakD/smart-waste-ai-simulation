from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env", override=False)


def _float_setting(name: str, default: float) -> float:
    value = float(os.getenv(name, str(default)))
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return value


def _int_setting(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < 1:
        raise ValueError(f"{name} must be at least one")
    return value


@dataclass(frozen=True)
class RuntimeSettings:
    simulation_interval_seconds: float
    fill_almost_full_threshold: float
    fill_full_threshold: float
    sensor_full_distance_cm: float
    speed_of_sound_cm_per_us: float
    max_readings: int
    ai_confidence_threshold: float
    ai_model_path: str
    ai_device: str
    app_name: str
    app_environment: str


SETTINGS = RuntimeSettings(
    simulation_interval_seconds=_float_setting("SIMULATION_INTERVAL_SECONDS", 3),
    fill_almost_full_threshold=_float_setting("FILL_ALMOST_FULL_THRESHOLD", 70),
    fill_full_threshold=_float_setting("FILL_FULL_THRESHOLD", 90),
    sensor_full_distance_cm=_float_setting("SENSOR_FULL_DISTANCE_CM", 10),
    speed_of_sound_cm_per_us=_float_setting("SPEED_OF_SOUND_CM_PER_US", 0.0343),
    max_readings=_int_setting("MAX_READINGS", 48),
    ai_confidence_threshold=_float_setting("AI_CONFIDENCE_THRESHOLD", 0.35),
    ai_model_path=os.getenv("YOLO_MODEL_PATH", "backend/ai/weights/best.pt"),
    ai_device=os.getenv("AI_DEVICE", "cpu"),
    app_name=os.getenv("APP_NAME", "EcoMind"),
    app_environment=os.getenv("APP_ENVIRONMENT", "Local instance"),
)

if SETTINGS.simulation_interval_seconds < 1:
    raise ValueError("SIMULATION_INTERVAL_SECONDS must be at least one")
if SETTINGS.sensor_full_distance_cm >= 20:
    raise ValueError("SENSOR_FULL_DISTANCE_CM must be below the minimum bin capacity of 20 cm")
if not 0 < SETTINGS.ai_confidence_threshold <= 1:
    raise ValueError("AI_CONFIDENCE_THRESHOLD must be between zero and one")
if not 0 < SETTINGS.fill_almost_full_threshold < SETTINGS.fill_full_threshold <= 100:
    raise ValueError("Fill thresholds must satisfy 0 < almost_full < full <= 100")

AI_CLASSES = (
    "ordinary_waste",
    "battery",
    "electronic_waste",
    "aerosol",
    "medical_sharp",
)

AI_SUPPORTED_CLASSES = (
    "ordinary_waste",
    "battery",
    "electronic_waste",
)
AI_UNSUPPORTED_CLASSES = tuple(
    class_name for class_name in AI_CLASSES
    if class_name not in AI_SUPPORTED_CLASSES
)

AI_CLASS_ALIASES = {
    "batteries": "battery",
    "e_waste": "electronic_waste",
    "aerosol_container": "aerosol",
    "medical_waste": "medical_sharp",
    "sharp": "medical_sharp",
}
