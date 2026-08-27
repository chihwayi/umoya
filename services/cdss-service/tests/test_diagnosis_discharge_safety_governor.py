"""S262 — the acute-deterioration safety governor must apply to /diagnosis/suggest,
/diagnosis/suggest/intelligent, and /discharge/intelligence, not just /risk/calculate.
See docs/AI-INTELLIGENCE-AUDIT-ROADMAP.md F1."""
from fastapi.testclient import TestClient

import main

TENANT_HEADERS = {"X-Tenant-ID": "tenant-a"}
CRITICAL_VITALS = {"spo2": 88}  # SpO2 < 90 alone triggers critical_flags() -> acute_deterioration
STABLE_VITALS = {"spo2": 98, "heartRate": 76, "respiratoryRate": 16, "temperature": 36.8}


def test_diagnosis_suggest_flags_acute_deterioration(monkeypatch):
    class _StubAssistant:
        def suggest_diagnosis(self, **kwargs):
            return {
                "suggested_diagnoses": [{"condition": "Pneumonia", "probability": 0.3}],
                "confidence_scores": {"Pneumonia": "moderate"},
                "recommended_tests": ["Chest X-ray"],
                "red_flags": [],
                "vitals_clues": [],
            }

    monkeypatch.setattr(main, "diagnostic_assistant", _StubAssistant())

    with TestClient(main.app) as client:
        response = client.post(
            "/diagnosis/suggest",
            json={"symptoms": ["cough"], "vitals": CRITICAL_VITALS},
            headers=TENANT_HEADERS,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["acute_safety"]["acute_deterioration"] is True
    assert any("ACUTE DETERIORATION" in flag for flag in body["red_flags"])


def test_diagnosis_suggest_stable_vitals_no_false_positive(monkeypatch):
    class _StubAssistant:
        def suggest_diagnosis(self, **kwargs):
            return {
                "suggested_diagnoses": [],
                "confidence_scores": {},
                "recommended_tests": [],
                "red_flags": [],
                "vitals_clues": [],
            }

    monkeypatch.setattr(main, "diagnostic_assistant", _StubAssistant())

    with TestClient(main.app) as client:
        response = client.post(
            "/diagnosis/suggest",
            json={"symptoms": ["cough"], "vitals": STABLE_VITALS},
            headers=TENANT_HEADERS,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["acute_safety"]["acute_deterioration"] is False
    assert not any("ACUTE DETERIORATION" in flag for flag in body["red_flags"])


def test_discharge_intelligence_blocks_discharge_on_critical_vitals():
    with TestClient(main.app) as client:
        response = client.post(
            "/discharge/intelligence",
            json={
                "admission_diagnosis": "Community-acquired pneumonia",
                "length_of_stay_days": 3,
                "diagnoses": ["pneumonia"],
                "vitals_at_discharge": {"spo2": 87, "hr": 140, "bp": "78/50"},
            },
            headers=TENANT_HEADERS,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["discharge_safe"] is False
    assert body["acute_safety"]["acute_deterioration"] is True
    assert any("do not discharge" in i.lower() for i in body["interventions"])


def test_discharge_intelligence_stable_vitals_allows_discharge():
    with TestClient(main.app) as client:
        response = client.post(
            "/discharge/intelligence",
            json={
                "admission_diagnosis": "Uncomplicated UTI",
                "length_of_stay_days": 1,
                "diagnoses": ["uti"],
                "vitals_at_discharge": {"spo2": 98, "hr": 78, "bp": "118/76"},
            },
            headers=TENANT_HEADERS,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["discharge_safe"] is True
    assert body["acute_safety"]["acute_deterioration"] is False
