from pathlib import Path
import json

from evaluation.run_release_gate_suite import evaluate_suite, run_suite


def test_release_gate_suite_covers_all_required_surfaces():
    manifest_path = (
        Path(__file__).resolve().parents[1]
        / "evaluation"
        / "fixtures"
        / "release_gate_suite.v1.json"
    )
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    report = evaluate_suite(payload, manifest_path.parent)

    assert report["blocked"] is False
    assert [surface["ai_surface"] for surface in report["surfaces"]] == [
        "diagnosis_assist",
        "patient_ai",
        "radiology_ai",
        "post_visit_grounded_answers",
        "smart_defaults",
    ]
    for surface in report["surfaces"]:
        statuses = {gate["status"] for gate in surface["gates"]}
        assert "failed" not in statuses


def test_run_suite_writes_report(tmp_path: Path):
    manifest_path = (
        Path(__file__).resolve().parents[1]
        / "evaluation"
        / "fixtures"
        / "release_gate_suite.v1.json"
    )
    output_path = tmp_path / "release-gate-suite.json"
    report = run_suite(manifest_path, output_path)

    assert output_path.exists()
    serialized = json.loads(output_path.read_text(encoding="utf-8"))
    assert serialized["blocked"] is False
    assert len(serialized["surfaces"]) == 5
    assert report["suite_version"] == "2026-03-26.v1"
