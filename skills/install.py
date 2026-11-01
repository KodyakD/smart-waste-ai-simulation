"""Install agent skills from their upstream repositories into skills/.

    python skills/install.py            # install what is missing
    python skills/install.py --refresh  # re-download everything
    python skills/install.py --check    # verify files match manifest.json

Third-party skills keep their own license; see skills/README.md.
"""

from __future__ import annotations

import hashlib
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "manifest.json"
RAW = "https://raw.githubusercontent.com/{repo}/main/{path}"


def fetch(repo: str, path: str) -> bytes:
    url = RAW.format(repo=repo, path=path)
    request = urllib.request.Request(url, headers={"User-Agent": "smart-waste-skills/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def local_dir(repo: str) -> Path:
    return ROOT / repo.replace("/", "__")


def load_spec() -> list[dict]:
    return json.loads((ROOT / "sources.json").read_text(encoding="utf-8"))["sources"]


def install(refresh: bool) -> int:
    manifest: dict[str, dict] = {}
    added = updated = 0
    failures: list[str] = []

    for source in load_spec():
        repo = source["repo"]
        license_path = local_dir(repo) / "LICENSE"
        if refresh or not license_path.exists():
            try:
                license_path.parent.mkdir(parents=True, exist_ok=True)
                license_path.write_bytes(fetch(repo, source["license_file"]))
            except urllib.error.HTTPError:
                print(f"  {repo}: no license file upstream ({source['license']})")

        for name in source["skills"]:
            remote_path = source["skill_path"].format(name=name)
            destination = local_dir(repo) / name / "SKILL.md"
            try:
                data = fetch(repo, remote_path)
            except (urllib.error.URLError, urllib.error.HTTPError) as exc:
                failures.append(f"{repo}/{name}: {exc}")
                continue

            if not destination.exists():
                added += 1
            elif destination.read_bytes() != data:
                updated += 1
                print(f"  updated {repo}/{name}")

            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            manifest.setdefault(repo, {})[name] = {
                "path": destination.relative_to(ROOT).as_posix(),
                "license": source["license"],
                "sha256": hashlib.sha256(data).hexdigest(),
                "bytes": len(data),
            }

    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"installed: {added} new, {updated} updated, {sum(len(v) for v in manifest.values())} total")
    for failure in failures:
        print(f"  FAILED {failure}")
    return 1 if failures else 0


def check() -> int:
    if not MANIFEST.exists():
        print("manifest.json missing — run install.py first")
        return 1
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    problems = 0
    for repo, skills in manifest.items():
        for name, entry in skills.items():
            path = ROOT / entry["path"]
            if not path.exists():
                print(f"  missing {entry['path']}")
                problems += 1
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != entry["sha256"]:
                print(f"  modified {entry['path']}")
                problems += 1
    print(f"checked {sum(len(v) for v in manifest.values())} skills, {problems} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(check())
    sys.exit(install(refresh="--refresh" in sys.argv))
