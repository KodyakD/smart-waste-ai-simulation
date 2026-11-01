from __future__ import annotations

from threading import Thread

from app.config import AI_CLASSES, BASE_DIR
from app.services.ai_service import AIService


def test_model_path_comes_from_settings_not_a_second_default():
    service = AIService()
    assert service.model_path == (BASE_DIR / "ai" / "weights" / "best.pt").resolve()


def test_status_classes_are_the_shared_class_list():
    assert AIService().status()["classes"] == list(AI_CLASSES)


def test_concurrent_first_status_never_reports_an_empty_state():
    # Regression: load() marked the attempt done before it finished, so a second
    # request during the torch import returned configured=False, message=None.
    service = AIService()
    seen: list[tuple[object, str | None]] = []

    def worker() -> None:
        status = service.status()
        seen.append((status["configured"], status["message"]))

    threads = [Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert all(message for _, message in seen), seen
    assert len({configured for configured, _ in seen}) == 1, seen
