"""Build the 5-class YOLO dataset from the sources declared in sources.json.

Usage (from backend/ai):
    python build_dataset.py --fetch     # download the redistributable sources
    python build_dataset.py --prepare   # remap classes, dedupe, split, copy
    python build_dataset.py --check     # validate the output
    python build_dataset.py --all

Only sources marked redistributable and with a known download path are fetched.
Everything else is documented in sources.json and datasets.md, never guessed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

AI_DIR = Path(__file__).resolve().parent
RAW_DIR = AI_DIR / "raw"
CONFIG = json.loads((AI_DIR / "sources.json").read_text(encoding="utf-8"))
SOURCE_BY_ID = {s["id"]: s for s in CONFIG["sources"]}
OUT_DIR = AI_DIR / CONFIG["target"]["output_dir"]
SPLITS = ("train", "val", "test")
SPLIT_SEED = "waste-v1"
TEST_SHARE = 10  # percent of the provided train split moved to test


def target_classes() -> list[str]:
    return list(CONFIG["target"]["classes"])


def fetchable_sources() -> list[str]:
    return [s["id"] for s in CONFIG["sources"]
            if s["redistributable"] and s.get("mendeley")]


def map_class(index: int, source_classes: list[str], class_map: dict[str, str],
              target: list[str]) -> int | None:
    if not 0 <= index < len(source_classes):
        return None
    name = source_classes[index]
    mapped = class_map.get(name)
    return target.index(mapped) if mapped in target else None


def remap_label_text(text: str, source_classes: list[str], class_map: dict[str, str],
                     target: list[str]) -> list[str]:
    lines: list[str] = []
    for raw in text.splitlines():
        parts = raw.split()
        if len(parts) != 5:
            continue
        try:
            index = int(parts[0])
            coords = [float(value) for value in parts[1:]]
        except ValueError:
            continue
        mapped = map_class(index, source_classes, class_map, target)
        if mapped is None or not all(0.0 <= value <= 1.0 for value in coords):
            continue
        lines.append(" ".join([str(mapped), *parts[1:]]))
    return lines


def split_for(name: str) -> str:
    digest = hashlib.sha256((SPLIT_SEED + name).encode()).hexdigest()[:8]
    return "test" if int(digest, 16) % 100 < TEST_SHARE else "train"


# --- download -------------------------------------------------------------

def _get_json(url: str) -> list | dict:
    request = urllib.request.Request(url, headers={"Accept": "application/json",
                                                  "User-Agent": "smart-waste-build/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def _mendeley_files(dataset_id: str, version: int, folder_id: str) -> list[dict]:
    files: list[dict] = []
    start = 0
    while True:
        url = (f"https://data.mendeley.com/public-api/datasets/{dataset_id}/files"
               f"?folder_id={folder_id}&version={version}&$start={start}&$limit=1000")
        page = _get_json(url)
        if not isinstance(page, list) or not page:
            return files
        files.extend(page)
        if len(page) < 1000:
            return files
        start += 1000


def _download(url: str, dest: Path, attempts: int = 4) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_name(dest.name + ".part")
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "smart-waste-build/1.0"})
            with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as out:
                shutil.copyfileobj(response, out)
            partial.replace(dest)
            return
        except (urllib.error.URLError, OSError) as exc:
            if attempt == attempts:
                print(f"  failed after {attempts} attempts: {dest.name}: {exc}")
                return
            time.sleep(2 * attempt)


def fetch_source(source: dict, workers: int = 16) -> None:
    mendeley = source.get("mendeley")
    if not mendeley:
        raise SystemExit(f"{source['id']}: no automated downloader, see datasets.md")
    root = RAW_DIR / source["id"]
    for stale in root.rglob("*.part"):
        stale.unlink()
    jobs: list[tuple[str, Path]] = []
    for key, folder_id in mendeley["folders"].items():
        split, kind = key.split("_", 1)
        files = _mendeley_files(mendeley["dataset_id"], mendeley["version"], folder_id)
        for item in files:
            url = item["content_details"]["download_url"]
            jobs.append((url, root / split / kind / item["filename"]))
    print(f"{source['id']}: {len(jobs)} files")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for index, _ in enumerate(pool.map(lambda job: _download(*job), jobs), 1):
            if index % 250 == 0:
                print(f"  {index}/{len(jobs)}")


# --- prepare --------------------------------------------------------------

def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _reset_output() -> None:
    for split in SPLITS:
        for kind in ("images", "labels"):
            directory = OUT_DIR / kind / split
            if directory.exists():
                shutil.rmtree(directory)
            directory.mkdir(parents=True, exist_ok=True)


def prepare() -> dict[str, int]:
    target = target_classes()
    _reset_output()
    seen: set[str] = set()
    counts = {"images": 0, "boxes": 0, "skipped_duplicate": 0, "skipped_empty": 0}

    for source in CONFIG["sources"]:
        if source["id"] not in fetchable_sources():
            continue
        root = RAW_DIR / source["id"]
        for provided_split in ("train", "val"):
            image_dir = root / provided_split / "images"
            label_dir = root / provided_split / "labels"
            if not image_dir.is_dir():
                continue
            for image in sorted(image_dir.iterdir()):
                if image.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                    continue
                label = label_dir / f"{image.stem}.txt"
                if not label.is_file():
                    continue
                lines = remap_label_text(label.read_text(encoding="utf-8"),
                                         source["source_classes"], source["class_map"], target)
                if not lines:
                    counts["skipped_empty"] += 1
                    continue
                digest = _sha256(image)
                if digest in seen:
                    counts["skipped_duplicate"] += 1
                    continue
                seen.add(digest)
                split = provided_split if provided_split == "val" else split_for(image.name)
                stem = f"{source['id']}__{image.stem}"
                shutil.copy2(image, OUT_DIR / "images" / split / f"{stem}{image.suffix.lower()}")
                (OUT_DIR / "labels" / split / f"{stem}.txt").write_text(
                    "\n".join(lines) + "\n", encoding="utf-8")
                counts["images"] += 1
                counts["boxes"] += len(lines)
    return counts


# --- check ----------------------------------------------------------------

def check() -> dict:
    target = target_classes()
    report: dict = {"classes": target, "splits": {}, "errors": []}
    for split in SPLITS:
        images = {p.stem for p in (OUT_DIR / "images" / split).glob("*")}
        labels = {p.stem for p in (OUT_DIR / "labels" / split).glob("*.txt")}
        histogram = {name: 0 for name in target}
        boxes = 0
        for stem in images:
            if stem not in labels:
                report["errors"].append(f"{split}/{stem}: image without label")
                continue
            for number, line in enumerate(
                    (OUT_DIR / "labels" / split / f"{stem}.txt").read_text(encoding="utf-8").splitlines(), 1):
                parts = line.split()
                if len(parts) != 5:
                    report["errors"].append(f"{split}/{stem}:{number}: expected 5 fields")
                    continue
                index = int(parts[0])
                if not 0 <= index < len(target):
                    report["errors"].append(f"{split}/{stem}:{number}: class {index} out of range")
                    continue
                if not all(0.0 <= float(value) <= 1.0 for value in parts[1:]):
                    report["errors"].append(f"{split}/{stem}:{number}: coordinate outside [0,1]")
                    continue
                histogram[target[index]] += 1
                boxes += 1
        for orphan in sorted(labels - images):
            report["errors"].append(f"{split}/{orphan}: label without image")
        report["splits"][split] = {"images": len(images), "boxes": boxes, "per_class": histogram}
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="download redistributable sources")
    parser.add_argument("--prepare", action="store_true", help="remap, dedupe and split")
    parser.add_argument("--check", action="store_true", help="validate the output")
    parser.add_argument("--all", action="store_true", help="fetch, prepare and check")
    parser.add_argument("--workers", type=int, default=16, help="parallel downloads")
    args = parser.parse_args(argv)
    if not (args.fetch or args.prepare or args.check or args.all):
        parser.print_help()
        return 2

    if args.fetch or args.all:
        for source in CONFIG["sources"]:
            if source["id"] in fetchable_sources():
                fetch_source(source, args.workers)
    if args.prepare or args.all:
        print(json.dumps(prepare(), indent=2))
    if args.check or args.all:
        report = check()
        print(json.dumps(report, indent=2))
        return 1 if report["errors"] else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
