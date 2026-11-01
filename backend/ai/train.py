"""Train, validate and report the waste detector.

    python backend/ai/train.py check              # dataset sanity, no model needed
    python backend/ai/train.py train              # train yolo11n on the built dataset
    python backend/ai/train.py eval               # test-split metrics -> report.md

Requires backend/requirements-ai.txt and a dataset built by build_dataset.py.
"""

from __future__ import annotations

import argparse
import shutil
from collections import Counter
from pathlib import Path

import yaml

AI_DIR = Path(__file__).resolve().parent
DATA = AI_DIR / "dataset.yaml"
WEIGHTS = AI_DIR / "weights" / "best.pt"
RUNS = AI_DIR / "runs"
REPORT = AI_DIR / "report.md"


def load_spec() -> dict:
    return yaml.safe_load(DATA.read_text(encoding="utf-8"))


def runtime_data() -> Path:
    """Ultralytics resolves a relative `path` against its global datasets_dir,
    not against the yaml file, so hand it an absolute copy under runs/."""
    spec = load_spec()
    spec["path"] = str((AI_DIR / spec["path"]).resolve())
    target = RUNS / "dataset.yaml"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(yaml.safe_dump(spec, sort_keys=False), encoding="utf-8")
    return target


def class_counts(split: str) -> Counter:
    labels = AI_DIR / "datasets" / "waste" / "labels" / split
    counts: Counter = Counter()
    for label in labels.glob("*.txt"):
        for line in label.read_text(encoding="utf-8").splitlines():
            parts = line.split()
            if len(parts) == 5:
                counts[int(parts[0])] += 1
    return counts


def check() -> int:
    spec = load_spec()
    names: dict[int, str] = spec["names"]
    problems = 0
    print(f"dataset: {AI_DIR / spec['path']}")
    for split in ("train", "val", "test"):
        counts = class_counts(split)
        total = sum(counts.values())
        print(f"\n{split}: {total} boxes")
        for index, name in names.items():
            boxes = counts.get(index, 0)
            flag = "" if boxes else "  <- no instances"
            print(f"  {index} {name:<18} {boxes:>6}{flag}")
            if not boxes:
                problems += 1
    empty = [name for index, name in names.items() if not any(class_counts(s).get(index) for s in ("train", "val", "test"))]
    if empty:
        print(f"\nwarning: {', '.join(empty)} have no boxes in any split.")
        print("The model cannot detect these classes. Do not report metrics for them.")
    print(f"\n{problems} split/class combinations without instances")
    return 0


def train(epochs: int, imgsz: int, batch: int, device: str, name: str) -> int:
    from ultralytics import YOLO

    model = YOLO("yolo11n.pt")
    model.train(
        data=str(runtime_data()),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        project=str(RUNS),
        name=name,
        patience=max(5, epochs // 5),
        seed=0,
        plots=True,
    )
    best = RUNS / name / "weights" / "best.pt"
    if best.exists():
        WEIGHTS.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best, WEIGHTS)
        print(f"copied {best} -> {WEIGHTS}")
    return 0


def evaluate(weights: Path) -> int:
    from ultralytics import YOLO

    if not weights.exists():
        print(f"no weights at {weights} — train first")
        return 1

    model = YOLO(str(weights))
    metrics = model.val(data=str(runtime_data()), split="test", imgsz=640, plots=True)
    names: dict[int, str] = model.names
    rows = []
    for index, name in names.items():
        rows.append({
            "class": name,
            "precision": float(metrics.box.p[index]),
            "recall": float(metrics.box.r[index]),
            "mAP50": float(metrics.box.ap50[index]),
            "mAP50-95": float(metrics.box.ap[index]),
        })

    lines = [
        "# Detection report",
        "",
        f"Weights: `{weights}`",
        f"Test split: `{AI_DIR / 'datasets' / 'waste' / 'images' / 'test'}`",
        "",
        "| Class | Precision | Recall | mAP50 | mAP50-95 |",
        "|---|---:|---:|---:|---:|",
    ]
    for row in rows:
        lines.append(
            f"| {row['class']} | {row['precision']:.3f} | {row['recall']:.3f} | "
            f"{row['mAP50']:.3f} | {row['mAP50-95']:.3f} |"
        )
    lines += [
        "",
        f"All classes: mAP50 **{float(metrics.box.map50):.3f}**, mAP50-95 **{float(metrics.box.map):.3f}**",
        "",
        "Classes with zero instances report 0.0 — that is missing data, not a model failure.",
        "RecyBat24 (CC BY-NC-ND) is not part of this test split; it may only be used for",
        "private evaluation and its numbers must be reported separately.",
        "",
    ]
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"written: {REPORT}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["check", "train", "eval"], nargs="?", default="check")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default="0", help="'0' for the first GPU, 'cpu' to force CPU")
    parser.add_argument("--name", default="waste-yolo11n")
    parser.add_argument("--weights", type=Path, default=WEIGHTS)
    args = parser.parse_args()

    if args.command == "train":
        return train(args.epochs, args.imgsz, args.batch, args.device, args.name)
    if args.command == "eval":
        return evaluate(args.weights)
    return check()


if __name__ == "__main__":
    raise SystemExit(main())

