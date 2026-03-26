from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

from validate_knowledge_registry import validate_knowledge_registry


def _load_manifest(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, list) else [payload]


def prepare_release(
    knowledge_dir: str | Path,
    release_id: str,
    version: str,
    summary: str,
    files: List[str],
    reviewed_at: str | None = None,
    activate: bool = True,
) -> Dict[str, Any]:
    root = Path(knowledge_dir)
    release_path = root / "releases.json"
    releases = _load_manifest(release_path)
    original_releases = json.loads(json.dumps(releases))
    today = date.today().isoformat()
    normalized_files = [str(name).strip() for name in files if str(name).strip()]
    if not normalized_files:
        raise ValueError("at least one file is required")

    for name in normalized_files:
        if not (root / name).exists():
            raise FileNotFoundError(f"knowledge file does not exist: {name}")

    if any(str(item.get("release_id") or "") == release_id for item in releases):
        raise ValueError(f"release_id already exists: {release_id}")

    if activate:
        for item in releases:
            if str(item.get("status") or "").lower() == "active":
                item["status"] = "superseded"

    release = {
        "release_id": release_id,
        "version": version,
        "status": "active" if activate else "draft",
        "released_at": today,
        "reviewed_at": reviewed_at or today,
        "summary": summary,
        "files": normalized_files,
    }
    releases.append(release)
    release_path.write_text(json.dumps(releases, indent=2) + "\n", encoding="utf-8")

    validation = validate_knowledge_registry(root)
    if not validation["ok"]:
        release_path.write_text(json.dumps(original_releases, indent=2) + "\n", encoding="utf-8")
        raise ValueError(f"release validation failed: {json.dumps(validation['issues'])}")

    return {"ok": True, "release": release, "validation": validation}


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare and validate a governed clinical knowledge release.")
    parser.add_argument("--knowledge-dir", default=str(Path(__file__).resolve().parent / "knowledge_registry"))
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--files", required=True, nargs="+")
    parser.add_argument("--reviewed-at")
    parser.add_argument("--draft", action="store_true")
    args = parser.parse_args()

    result = prepare_release(
        knowledge_dir=args.knowledge_dir,
        release_id=args.release_id,
        version=args.version,
        summary=args.summary,
        files=args.files,
        reviewed_at=args.reviewed_at,
        activate=not args.draft,
    )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
