from __future__ import annotations

from app.config import AI_CLASSES, BASE_DIR
from app.services.ai_service import AIService


def test_model_path_comes_from_settings_not_a_second_default():
    service = AIService()
    assert service.model_path == (BASE_DIR / "ai" / "weights" / "best.pt").resolve()


def test_status_classes_are_the_shared_class_list():
    assert AIService().status()["classes"] == list(AI_CLASSES)
