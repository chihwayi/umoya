from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main


def test_health_endpoint_allows_missing_tenant():
    with TestClient(main.app) as client:
        response = client.get("/health")
    assert response.status_code == 200


def test_non_public_endpoint_requires_tenant_header():
    with TestClient(main.app) as client:
        response = client.post("/diagnosis/suggest", json={"symptoms": ["fever"]})
    assert response.status_code == 400
    assert "X-Tenant-ID" in str(response.json().get("message", ""))


def test_hiv_algorithm_endpoint_requires_tenant_header():
    with TestClient(main.app) as client:
        response = client.post("/hiv/testing/algorithm", json={"tests": []})
    assert response.status_code == 400
    assert "X-Tenant-ID" in str(response.json().get("message", ""))


def test_non_public_endpoint_accepts_tenant_header(monkeypatch):
    class _StubAssistant:
        def suggest_diagnosis(self, **kwargs):
            return {
                "suggested_diagnoses": [],
                "confidence_scores": [],
                "recommended_tests": [],
                "red_flags": [],
                "vitals_clues": [],
            }

    monkeypatch.setattr(main, "diagnostic_assistant", _StubAssistant())

    with TestClient(main.app) as client:
        response = client.post(
            "/diagnosis/suggest",
            json={"symptoms": ["fever"]},
            headers={"X-Tenant-ID": "tenant-a"},
        )
    assert response.status_code == 200
    assert response.json().get("source") == "rule_based_cdss"


def test_job_owner_source_ignores_untrusted_header():
    req = SimpleNamespace(headers={"x-owner-email": "attacker@example.com"}, state=SimpleNamespace())
    assert main._job_owner_from_request(req) == "service"

    req.state.service_identity = "ehr-service"
    assert main._job_owner_from_request(req) == "ehr-service"


def test_require_tenant_cache_key_rejects_missing_header():
    req = SimpleNamespace(headers={}, state=SimpleNamespace())
    with pytest.raises(HTTPException) as exc:
        main._require_tenant_cache_key_from_request(req)
    assert exc.value.status_code == 400
