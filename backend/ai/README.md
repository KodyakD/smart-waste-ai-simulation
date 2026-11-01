# AI dataset and training notes

This folder contains the custom YOLO training scaffold. It does **not** include images or trained weights.

Sources, licenses and the class mapping live in [`datasets.md`](datasets.md) and
[`sources.json`](sources.json). Build the dataset with
`python build_dataset.py --all` (fetch, prepare, check).

## Dataset layout

```text
datasets/waste/
├── images/
│   ├── train/
│   ├── val/
│   └── test/
└── labels/
    ├── train/
    ├── val/
    └── test/
```

Every image needs a matching `.txt` label file in the corresponding labels folder. YOLO detection labels use one row per object:

```text
<class_id> <x_center> <y_center> <width> <height>
```

Coordinates are normalized from 0 to 1. Class IDs must match `dataset.yaml` exactly:

| ID | Class |
|---:|---|
| 0 | ordinary_waste |
| 1 | battery |
| 2 | electronic_waste |
| 3 | aerosol |
| 4 | medical_sharp |

Use a balanced dataset with varied lighting, angles, backgrounds, object conditions and realistic bin scenes. Keep near-duplicate photos out of validation/test sets. Include examples where no target waste is present only if your training pipeline and evaluation protocol intentionally support background images.

The labels are visual categories. Model predictions cannot establish chemical toxicity, contents under packaging, sterility, or safe handling instructions.

## Training and validation

Requires the CUDA build of PyTorch for GPU training:

```bash
cd backend
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements-ai.txt
```

Then, from `backend/`:

| Command | What it does |
|---|---|
| `python ai/train.py check` | Per-split, per-class box counts. Warns about classes with no instances. No model needed. |
| `python ai/train.py train --epochs 80` | Trains `yolo11n` on GPU 0, writes `ai/runs/waste-yolo11n/`, copies `best.pt` to `ai/weights/`. |
| `python ai/train.py eval` | Runs the test split and writes `ai/report.md` with per-class precision, recall, mAP50, mAP50-95. |

`train.py` writes an absolute-path copy of `dataset.yaml` to `ai/runs/dataset.yaml`
before calling Ultralytics. This is required: a relative `path:` in a data yaml is
resolved against Ultralytics' global `datasets_dir`, not against the yaml file, so
`yolo detect train data=backend/ai/dataset.yaml` fails from a fresh checkout.

Hardware used here: RTX 3050 Ti Laptop, 4 GB VRAM — `--batch 8 --imgsz 640` fits;
drop to `--batch 4 --imgsz 512` if it runs out of memory.

Classes without boxes (`aerosol`, `medical_sharp` today) cannot be learned. The
check command lists them and `report.md` states they are missing data. Do not
publish metrics that imply five working classes.
