"""Train a custom five-class YOLO detector.

Run from the repository root after installing backend/requirements-ai.txt and
populating backend/ai/datasets/waste with YOLO-format images and labels.
"""
from pathlib import Path
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "backend" / "ai" / "dataset.yaml"


def main() -> None:
    if not DATA.exists():
        raise FileNotFoundError(DATA)
    model = YOLO("yolo11n.pt")  # pretrained starting point; custom classes are learned during training
    model.train(
        data=str(DATA),
        epochs=80,
        imgsz=640,
        batch=8,
        project=str(ROOT / "backend" / "ai" / "runs"),
        name="hazardous-waste",
        patience=15,
    )
    print("Training finished. Copy the run's weights/best.pt to backend/ai/weights/best.pt")


if __name__ == "__main__":
    main()
