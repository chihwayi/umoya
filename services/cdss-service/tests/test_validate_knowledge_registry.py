from __future__ import annotations

import json

from validate_knowledge_registry import validate_knowledge_registry


def test_validate_knowledge_registry_accepts_valid_release(tmp_path):
    (tmp_path / "releases.json").write_text(
        json.dumps(
            [
                {
                    "release_id": "test-release",
                    "version": "2026.03.24.1",
                    "status": "active",
                    "files": ["guidelines.json"],
                }
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "guidelines.json").write_text(
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

    result = validate_knowledge_registry(tmp_path)

    assert result["ok"] is True
    assert result["release_count"] == 1
    assert result["document_count"] == 1


def test_validate_knowledge_registry_rejects_missing_release_file_reference(tmp_path):
    (tmp_path / "releases.json").write_text(
        json.dumps(
            [
                {
                    "release_id": "test-release",
                    "version": "2026.03.24.1",
                    "status": "active",
                    "files": ["guidelines.json"],
                }
            ]
        ),
        encoding="utf-8",
    )

    result = validate_knowledge_registry(tmp_path)

    assert result["ok"] is False
    assert any("references missing file guidelines.json" in issue["message"] for issue in result["issues"])


def test_validate_knowledge_registry_rejects_duplicate_knowledge_ids(tmp_path):
    (tmp_path / "releases.json").write_text(
        json.dumps(
            [
                {
                    "release_id": "test-release",
                    "version": "2026.03.24.1",
                    "status": "active",
                    "files": ["guidelines.json"],
                }
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "guidelines.json").write_text(
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
                },
                {
                    "knowledge_id": "guideline-1",
                    "condition": "asthma",
                    "title": "Asthma",
                    "source_name": "GINA",
                    "source_version": "2026.01",
                    "source_published_at": "2026-01-01",
                    "reviewed_at": "2026-03-01",
                    "specialty": "primary_care",
                    "module": "respiratory_care",
                    "target_population": "mixed",
                    "local_adaptation": True,
                    "evidence_level": "high",
                    "recommendation_blocks": ["Use ICS-containing therapy."],
                }
            ]
        ),
        encoding="utf-8",
    )

    result = validate_knowledge_registry(tmp_path)

    assert result["ok"] is False
    assert any("duplicate knowledge_id: guideline-1" in issue["message"] for issue in result["issues"])


def test_validate_knowledge_registry_rejects_missing_module(tmp_path):
    (tmp_path / "releases.json").write_text(
        json.dumps(
            [
                {
                    "release_id": "test-release",
                    "version": "2026.03.24.1",
                    "status": "active",
                    "files": ["guidelines.json"],
                }
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "guidelines.json").write_text(
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
                    "target_population": "adults",
                    "local_adaptation": True,
                    "evidence_level": "high",
                    "recommendation_blocks": ["Use first-line therapy."],
                }
            ]
        ),
        encoding="utf-8",
    )

    result = validate_knowledge_registry(tmp_path)

    assert result["ok"] is False
    assert any("missing field module" in issue["message"] for issue in result["issues"])
