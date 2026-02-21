from pathlib import Path
import json

from evaluation.offline_clinical_eval import evaluate_dataset, run


def test_evaluate_dataset_baseline_metrics_are_stable():
    fixture_path = (
        Path(__file__).resolve().parents[1]
        / "evaluation"
        / "fixtures"
        / "clinical_eval_cases.v1.json"
    )
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    report = evaluate_dataset(payload)
    metrics = report["summary"]["metrics"]

    assert metrics["retrieval_recall_at_k"] == 0.4
    assert metrics["retrieval_hit_rate_at_k"] == 0.6
    assert metrics["citation_support_rate"] == 0.6
    assert metrics["abstain_correctness"] == 0.8333
    assert metrics["unsafe_overconfident_output_rate"] == 0.1667


def test_run_writes_report(tmp_path: Path):
    fixture_path = (
        Path(__file__).resolve().parents[1]
        / "evaluation"
        / "fixtures"
        / "clinical_eval_cases.v1.json"
    )
    output_path = tmp_path / "clinical-eval-report.json"
    report = run(fixture_path, output_path)

    assert output_path.exists()
    serialized = json.loads(output_path.read_text(encoding="utf-8"))
    assert serialized["summary"]["total_cases"] == 6
    assert serialized["summary"]["k"] == 3
    assert report["summary"]["metrics"]["citation_support_rate"] == 0.6

