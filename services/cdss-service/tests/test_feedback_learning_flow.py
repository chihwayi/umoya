import os
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

import main


def test_outcome_feedback_persists_reviews_and_claims(tmp_path: Path, monkeypatch):
    feedback_db = tmp_path / "feedback.sqlite3"
    monkeypatch.setenv("CDSS_FEEDBACK_DB_PATH", str(feedback_db))
    monkeypatch.setattr(
        main,
        "s3_client",
        SimpleNamespace(head_bucket=lambda **_: None, create_bucket=lambda **_: None),
    )
    monkeypatch.setattr(main, "_start_job_worker", lambda: None)
    monkeypatch.setattr(main, "_rehydrate_queued_jobs_on_startup", lambda: None)
    main._init_feedback_store()
    headers = {"X-Tenant-ID": "tenant-test"}

    payload = {
        "entries": [
            {
                "logId": "log-1",
                "patientId": "patient-1",
                "decisionType": "diagnosis",
                "tenantSubdomain": "tenant-test",
                "sourceModel": "diagnosis_rules_v1",
                "topRecommendation": "Observe and review adherence",
                "confidenceScore": 0.82,
                "clinicianAction": "accepted",
                "overrideReason": None,
                "outcomeAt30Days": {"status": "stable"},
                "outcomeAt90Days": None,
                "createdAt": "2026-03-24T10:00:00Z",
            }
        ]
    }

    with TestClient(main.app) as client:
        receive = client.post("/feedback/outcome", json=payload, headers=headers)
        assert receive.status_code == 200
        receive_json = receive.json()
        assert receive_json["status"] == "received"
        assert receive_json["storage"]["mode"] == "durable_sqlite"
        assert receive_json["total"] == 1

        summary = client.get("/feedback/outcome/summary", headers=headers)
        assert summary.status_code == 200
        summary_json = summary.json()
        assert summary_json["summary"]["counts"]["total_entries"] == 1
        assert summary_json["summary"]["counts"]["pending_review_entries"] == 1

        batch = summary_json["summary"]["batches"][0]
        assert batch["entry_count"] == 1
        assert batch["review_status"] == "pending_review"

        # Claiming before approval should return nothing.
        empty_claim = client.post("/feedback/outcome/learning/claim", headers=headers)
        assert empty_claim.status_code == 200
        assert empty_claim.json()["claimedCount"] == 0

        review = client.post(
            "/feedback/outcome/review/1",
            json={
                "learning_status": "approved_for_learning",
                "review_notes": "Safe for governed learning queue",
            },
            headers=headers,
        )
        assert review.status_code == 200
        review_json = review.json()
        assert review_json["entry"]["learning_status"] == "approved_for_learning"
        assert review_json["entry"]["processing_status"] == "reviewed"

        claimed = client.post("/feedback/outcome/learning/claim?limit=10", headers=headers)
        assert claimed.status_code == 200
        claimed_json = claimed.json()
        assert claimed_json["claimedCount"] == 1
        assert claimed_json["entries"][0]["log_id"] == "log-1"
        assert claimed_json["entries"][0]["tenant_subdomain"] == "tenant-test"
        assert claimed_json["entries"][0]["source_model"] == "diagnosis_rules_v1"
        assert claimed_json["entries"][0]["processing_status"] == "claimed_for_learning"
        assert claimed_json["entries"][0]["learning_status"] == "approved_for_learning"
        assert claimed_json["entries"][0]["outcome_at_30_days"] == {"status": "stable"}

        post_claim_summary = client.get("/feedback/outcome/summary", headers=headers)
        assert post_claim_summary.status_code == 200
        assert post_claim_summary.json()["summary"]["counts"]["pending_review_entries"] == 0

    if feedback_db.exists():
        os.remove(feedback_db)
