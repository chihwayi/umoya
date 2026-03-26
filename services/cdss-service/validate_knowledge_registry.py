from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Dict, List


REQUIRED_DOC_FIELDS = [
    "knowledge_id",
    "condition",
    "title",
    "source_name",
    "source_version",
    "source_published_at",
    "reviewed_at",
    "specialty",
    "module",
    "target_population",
    "local_adaptation",
    "evidence_level",
    "recommendation_blocks",
]


@dataclass
class ValidationIssue:
    path: str
    message: str


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_date(raw: Any, field_name: str, issues: List[ValidationIssue], path: Path) -> None:
    value = str(raw or "").strip()
    if not value:
        issues.append(ValidationIssue(str(path), f"{field_name} is required"))
        return
    try:
        date.fromisoformat(value)
    except ValueError:
        issues.append(ValidationIssue(str(path), f"{field_name} must be ISO date YYYY-MM-DD"))


def validate_knowledge_registry(knowledge_dir: str | Path) -> Dict[str, Any]:
    root = Path(knowledge_dir)
    issues: List[ValidationIssue] = []

    if not root.exists():
        return {"ok": False, "issues": [{"path": str(root), "message": "knowledge directory does not exist"}]}

    release_path = root / "releases.json"
    if not release_path.exists():
        return {"ok": False, "issues": [{"path": str(release_path), "message": "missing releases.json"}]}

    releases_payload = _load_json(release_path)
    releases = releases_payload if isinstance(releases_payload, list) else [releases_payload]
    if not releases:
        issues.append(ValidationIssue(str(release_path), "at least one release is required"))

    active_releases = [release for release in releases if str(release.get("status") or "").lower() == "active"]
    if len(active_releases) != 1:
        issues.append(ValidationIssue(str(release_path), "exactly one active release is required"))

    seen_release_ids: set[str] = set()
    referenced_files: set[str] = set()
    for release in releases:
        release_id = str(release.get("release_id") or "").strip()
        if not release_id:
            issues.append(ValidationIssue(str(release_path), "release_id is required for every release"))
        elif release_id in seen_release_ids:
            issues.append(ValidationIssue(str(release_path), f"duplicate release_id: {release_id}"))
        seen_release_ids.add(release_id)

        version = str(release.get("version") or "").strip()
        if not version:
            issues.append(ValidationIssue(str(release_path), f"release {release_id or '<unknown>'} is missing version"))

        files = release.get("files")
        if not isinstance(files, list) or not files:
            issues.append(ValidationIssue(str(release_path), f"release {release_id or '<unknown>'} must list files"))
            continue

        for file_name in files:
            name = str(file_name or "").strip()
            if not name:
                issues.append(ValidationIssue(str(release_path), f"release {release_id or '<unknown>'} contains blank file name"))
                continue
            file_path = root / name
            if not file_path.exists():
                issues.append(ValidationIssue(str(release_path), f"release {release_id or '<unknown>'} references missing file {name}"))
            referenced_files.add(name)

    knowledge_files = sorted(path for path in root.glob("*.json") if path.name != "releases.json")
    undeclared_files = [path.name for path in knowledge_files if path.name not in referenced_files]
    if undeclared_files:
        issues.append(ValidationIssue(str(release_path), f"release manifest does not declare files: {', '.join(undeclared_files)}"))

    seen_ids: set[str] = set()
    doc_count = 0
    for path in knowledge_files:
        payload = _load_json(path)
        docs = payload if isinstance(payload, list) else [payload]
        if not docs:
            issues.append(ValidationIssue(str(path), "knowledge file must contain at least one document"))
            continue
        for index, doc in enumerate(docs):
            doc_count += 1
            if not isinstance(doc, dict):
                issues.append(ValidationIssue(str(path), f"document #{index + 1} must be an object"))
                continue
            for field_name in REQUIRED_DOC_FIELDS:
                if field_name not in doc:
                    issues.append(ValidationIssue(str(path), f"document #{index + 1} missing field {field_name}"))

            knowledge_id = str(doc.get("knowledge_id") or "").strip()
            if knowledge_id:
                if knowledge_id in seen_ids:
                    issues.append(ValidationIssue(str(path), f"duplicate knowledge_id: {knowledge_id}"))
                seen_ids.add(knowledge_id)

            if not isinstance(doc.get("recommendation_blocks"), list) or not doc.get("recommendation_blocks"):
                issues.append(ValidationIssue(str(path), f"{knowledge_id or 'document'} must define recommendation_blocks"))
            if not isinstance(doc.get("local_adaptation"), bool):
                issues.append(ValidationIssue(str(path), f"{knowledge_id or 'document'} local_adaptation must be boolean"))

            _parse_date(doc.get("source_published_at"), "source_published_at", issues, path)
            _parse_date(doc.get("reviewed_at"), "reviewed_at", issues, path)

    return {
        "ok": not issues,
        "release_count": len(releases),
        "active_release_count": len(active_releases),
        "document_count": doc_count,
        "issues": [{"path": issue.path, "message": issue.message} for issue in issues],
    }


if __name__ == "__main__":
    default_dir = Path(__file__).resolve().parent / "knowledge_registry"
    result = validate_knowledge_registry(default_dir)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["ok"] else 1)
