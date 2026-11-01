from app.config import AI_CLASSES, AI_SUPPORTED_CLASSES, AI_UNSUPPORTED_CLASSES
from app.main import app_config
from app.routes.ai import ai_status


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



def test_unsupported_class_aliases_are_manual_review():
    from app.main import apply_dataset_class_support

    for alias in ("aerosol_container", "medical_waste", "sharp"):
        prediction = apply_dataset_class_support({
            "class_name": alias,
            "risk_level": "high_concern",
        })
        assert prediction["class_name"] in AI_UNSUPPORTED_CLASSES
        assert prediction["risk_level"] == "needs_review"


def test_supported_class_aliases_are_canonicalized():
    from app.main import apply_dataset_class_support

    battery = apply_dataset_class_support({
        "class_name": "batteries",
        "risk_level": "potential_hazard",
    })
    electronic = apply_dataset_class_support({
        "class_name": "e_waste",
        "risk_level": "potential_hazard",
    })

    assert battery["class_name"] == "battery"
    assert battery["risk_level"] == "potential_hazard"
    assert electronic["class_name"] == "electronic_waste"
    assert electronic["risk_level"] == "potential_hazard"
