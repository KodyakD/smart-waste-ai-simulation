from app.config import AI_CLASSES, AI_SUPPORTED_CLASSES, AI_UNSUPPORTED_CLASSES
from app.main import ai_status, app_config


def test_supported_and_unsupported_classes_partition_target_order():
    assert AI_SUPPORTED_CLASSES == (
        "ordinary_waste",
        "battery",
        "electronic_waste",
    )
    assert AI_UNSUPPORTED_CLASSES == ("aerosol", "medical_sharp")
    assert AI_SUPPORTED_CLASSES + AI_UNSUPPORTED_CLASSES == AI_CLASSES


def test_config_endpoint_reports_class_coverage():
    response = app_config()
    ai = response["ai"]

    assert ai["classes"] == list(AI_CLASSES)
    assert ai["supported_classes"] == list(AI_SUPPORTED_CLASSES)
    assert ai["unsupported_classes"] == list(AI_UNSUPPORTED_CLASSES)


def test_ai_status_endpoint_reports_class_coverage():
    response = ai_status()

    assert response["classes"] == list(AI_CLASSES)
    assert response["supported_classes"] == list(AI_SUPPORTED_CLASSES)
    assert response["unsupported_classes"] == list(AI_UNSUPPORTED_CLASSES)
