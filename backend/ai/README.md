# AI dataset and training notes

This folder contains the custom YOLO training scaffold. It does **not** include images or trained weights.

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
