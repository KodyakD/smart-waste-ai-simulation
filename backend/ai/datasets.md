# Datasets

Every source was opened and its terms read before anything was downloaded.
`backend/ai/sources.json` is the machine-readable version of this table and is
what `build_dataset.py` actually reads.

## What gets merged

| Source | Format | License | Redistributable | Used |
|---|---|---|---|---|
| Synthetic outdoor waste (Mendeley `2x69gjbcz6` v2) | YOLO, 10 classes, 6,000 images | CC BY 4.0 | yes | **core** |
| RecyBat24 (`10.5281/zenodo.15490523`) | Ultralytics detection/segmentation | CC BY-NC-ND 4.0 | **no** | private eval only |
| TACO (`10.5281/zenodo.3242434`) | COCO annotations + Flickr images | CC BY 4.0 on annotations; **per-image license is `null` for all 715** | no | excluded |
| Medical-Waste-4.0 (`10.5281/zenodo.7709001`) | unknown until downloaded | "other-open", no terms published | unresolved | blocked |
| ETID (Mendeley `bndsgcspbx`) | image-level classification | CC BY 4.0 | yes | excluded (no boxes) |

The Nature article `s41597-025-05211-5` is the RecyBat24 paper, and the
Hugging Face `pictograph/taco` copy is TACO. They are not extra datasets.

## Why the merged set is smaller than the link list

- **RecyBat24 is CC BY-NC-ND.** No derivatives, no commercial use. Relabelling
  it into a 5-class set is a derivative, so the result cannot be published.
  It stays a private held-out evaluation set.
- **TACO's images are not licensed in the annotations.** All 715 entries have
  `"license": null`; they are Flickr URLs fetched at runtime. Rights per image
  cannot be verified, so it cannot be redistributed. It is also only 715
  images against 6,000 in the synthetic set.
- **ETID has no bounding boxes.** It is an e-waste classifier dataset; merging
  it would mean drawing boxes by hand.
- **Medical-Waste-4.0 publishes no license text.** Zenodo marks it
  `other-open` with empty rights metadata. It is the only candidate for
  `medical_sharp`, so that class stays empty until the authors state terms.

## Result (built 2026-11-01)

| Split | Images | Boxes | ordinary | battery | e-waste | aerosol | medical |
|---|---:|---:|---:|---:|---:|---:|---:|
| train | 4,988 | 17,480 | 13,901 | 1,769 | 1,810 | 0 | 0 |
| val | 463 | 1,622 | 1,300 | 174 | 148 | 0 | 0 |
| test | 542 | 1,931 | 1,547 | 213 | 171 | 0 | 0 |
| **total** | **5,993** | **21,033** | 16,748 | 2,156 | 2,129 | 0 | 0 |

`--check` reports 0 errors: every image has a label, every line has 5 fields,
all class ids are in range, all coordinates in `[0,1]`.

Two things the build fixed that the source ships broken:

- **The source's val split leaks into train.** All 1,200 val images and 5,530
  train images overlap by 730 byte-identical files — 61% of val. Reporting
  metrics on that val set would be inflated. SHA-256 dedupe keeps the train
  copy and drops the val copy, so the 463 val images left are genuinely unseen.
- **10 images have empty label files** (no boxes after remapping) and are
  dropped rather than kept as background images, since nothing else in the
  pipeline declares them as negatives.

## Consequence for the model

After the merge the dataset covers three of the five target classes:

| Class | Source | Status |
|---|---|---|
| `ordinary_waste` | synthetic: plastic, paper, cardboard, metal, glass, organic, cloth, other | covered |
| `battery` | synthetic `battery_waste` | covered |
| `electronic_waste` | synthetic `e_waste` | covered |
| `aerosol` | none redistributable | **empty** |
| `medical_sharp` | none licensed | **empty** |

An empty class is not a class the model can learn. Until a licensed source for
aerosol and sharps is added, the app must keep reporting those two as
unsupported rather than pretending a detection is possible. That is what
`/api/v1/ai/status` is for.

## Building

```powershell
cd backend\ai
..\.venv\Scripts\python.exe build_dataset.py --all
```

- `--fetch` downloads only sources marked `redistributable` and having a
  `mendeley` block. It is resumable: existing files are skipped.
- `--prepare` remaps class ids through `class_map`, drops malformed or
  out-of-range boxes, drops images left with no boxes, removes duplicate
  images by SHA-256, and moves 10% of the provided train split into `test`
  using a stable hash of the filename.
- `--check` validates the output: label/image pairing, 5 fields per line,
  class ids in range, coordinates in `[0,1]`, per-class box counts.

Raw downloads live in `backend/ai/raw/` and prepared images in
`backend/ai/datasets/waste/`. Both are gitignored; only this file, the
manifest and the build script are committed.

## Attribution

The merged dataset is a derivative of the synthetic outdoor waste dataset by
Tanvinur Rahman Siam and Kaushik Deb, Mendeley Data, DOI
`10.17632/2x69gjbcz6.2`, licensed CC BY 4.0. Any redistribution must keep this
attribution and state that classes were remapped from 10 to 5.
