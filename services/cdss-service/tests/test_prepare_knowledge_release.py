from __future__ import annotations

import json

from prepare_knowledge_release import prepare_release


def test_prepare_release_supersedes_previous_active_release(tmp_path):
    (tmp_path / "guidelines-a.json").write_text(
        json.dumps(
            [
                {
                    "knowledge_id": "guideline-1",
                    "condition": "hypertension",
                    "title": "Hypertension",
                    "source_name": "WHO",
                    "source_version": "2026.01",
                    "source_published_at": "2026-01-01",
                    "reviewed_at": "2026-03-01",
                    "specialty": "primary_care",
                    "module": "chronic_care",
                    "target_population": "adults",
                    "local_adaptation": True,
                    "evidence_level": "high",
                    "recommendation_blocks": ["Use first-line therapy."],
                }
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "releases.json").write_text(
        json.dumps(
            [
                {
                    "release_id": "old-release",
                    "version": "2026.03.01.1",
                    "status": "active",
                    "released_at": "2026-03-01",
                    "reviewed_at": "2026-03-01",
                    "summary": "Old release",
                    "files": ["guidelines-a.json"],
                }
            ]
        ),
        encoding="utf-8",
    )

    result = prepare_release(
        knowledge_dir=tmp_path,
        release_id="new-release",
        version="2026.03.24.2",
        summary="New release",
        files=["guidelines-a.json"],
    )

    manifest = json.loads((tmp_path / "releases.json").read_text(encoding="utf-8"))
    assert result["ok"] is True
    assert manifest[0]["status"] == "superseded"
    assert manifest[1]["status"] == "active"
    assert manifest[1]["release_id"] == "new-release"


def test_prepare_release_rejects_duplicate_release_id(tmp_path):
    (tmp_path / "guidelines-a.json").write_text(
        json.dumps(
            [
                {
                    "knowledge_id": "guideline-1",
                    "condition": "hypertension",
                    "title": "Hypertension",
                    "source_name": "WHO",
                    "source_version": "2026.01",
                    "source_published_at": "2026-01-01",
                    "reviewed_at": "2026-03-01",
                    "specialty": "primary_care",
                    "module": "chronic_care",
                    "target_population": "adults",
                    "local_adaptation": True,
                    "evidence_level": "high",
                    "recommendation_blocks": ["Use first-line therapy."],
                }
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "releases.json").write_text(
        json.dumps(
            [
                {
                    "release_id": "existing-release",
                    "version": "2026.03.01.1",
                    "status": "active",
                    "released_at": "2026-03-01",
                    "reviewed_at": "2026-03-01",
                    "summary": "Old release",
                    "files": ["guidelines-a.json"],
                }
            ]
        ),
        encoding="utf-8",
    )

    try:
        prepare_release(
            knowledge_dir=tmp_path,
            release_id="existing-release",
            version="2026.03.24.2",
            summary="Duplicate release",
            files=["guidelines-a.json"],
        )
    except ValueError as exc:
        assert "release_id already exists" in str(exc)
    else:
        raise AssertionError("expected duplicate release_id to fail")
