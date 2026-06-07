"""
Phase-0 patient-safety gates (Correction Sprint).

Reproduces the experts' synthetic high-risk patient and asserts the system now:
- synthesises sepsis (SIRS/qSOFA), DKA/HHS, and severe-pain signals from structured vitals,
- classifies the patient as ACUTE_DETERIORATION, and
- has the safety governor OVERRIDE any low-risk / discharge-oriented readmission output.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from clinical_safety import evaluate, apply_safety_governor, extract_vitals  # noqa: E402


# The exact synthetic high-risk vitals from ci-errors.
CRITICAL_VITALS = {
    "bloodPressure": "195/115",
    "heartRate": 128,
    "temperature": 39.4,
    "spo2": 86,
    "respiratoryRate": 28,
    "painLevel": 9,
    "bloodGlucose": 21.1,  # mmol/L
}

STABLE_VITALS = {
    "bloodPressure": "118/76",
    "heartRate": 72,
    "temperature": 36.6,
    "spo2": 98,
    "respiratoryRate": 16,
    "painLevel": 1,
    "bloodGlucose": 5.4,
}


def test_critical_patient_is_acute_deterioration():
    ev = evaluate(CRITICAL_VITALS)
    assert ev["acute_deterioration"] is True
    assert ev["acute_state"] == "ACUTE_DETERIORATION"
    assert ev["aggregate_severity"] == "critical"


def test_critical_patient_sepsis_screen_positive():
    ev = evaluate(CRITICAL_VITALS)
    # SIRS: temp 39.4, HR 128, RR 28 → 3 criteria
    assert ev["sirs"]["positive"] is True
    assert ev["sirs"]["score"] >= 3
    assert ev["sepsis_screen_positive"] is True
    assert any(a["type"] == "sepsis_screen" for a in ev["syndrome_alerts"])


def test_critical_patient_dka_and_pain_alerts():
    ev = evaluate(CRITICAL_VITALS)
    assert ev["dka_hhs"]["flag"] is True
    assert ev["dka_hhs"]["severity"] == "severe"
    assert ev["severe_pain"]["flag"] is True
    types = {a["type"] for a in ev["syndrome_alerts"]}
    assert "dka_hhs_screen" in types
    assert "severe_pain" in types
    assert "multi_system_deterioration" in types


def test_critical_flags_detect_hypoxia_hypertension_tachypnea():
    ev = evaluate(CRITICAL_VITALS)
    params = {f["parameter"] for f in ev["critical_flags"]}
    assert "spo2" in params           # 86% < 90
    assert "systolic" in params       # 195 > 180
    assert "respiratory_rate" in params  # 28 > 24


def test_governor_overrides_low_readmission_output():
    """The core fix: a 'low / discharge / routine' readmission payload must be overridden."""
    readmission_payload = {
        "overall_score": 0.0,
        "risk_level": "low",
        "recommendations": ["Low readmission risk", "Standard discharge instructions", "Routine follow-up"],
    }
    governed = apply_safety_governor(readmission_payload, CRITICAL_VITALS)
    assert governed["risk_level"] == "critical"
    assert governed["risk_model_conflict"] is True
    assert governed["readmission_assessment"]["suppressed"] is True
    # No discharge/routine language should survive in the surfaced recommendations.
    joined = " ".join(governed["recommendations"]).lower()
    assert "discharge instructions" not in joined
    assert "routine follow-up" not in joined
    assert "immediate clinician review" in joined
    assert "governor_banner" in governed


def test_governor_leaves_stable_patient_untouched():
    payload = {"overall_score": 10.0, "risk_level": "low", "recommendations": ["Routine follow-up"]}
    governed = apply_safety_governor(payload, STABLE_VITALS)
    assert governed["risk_level"] == "low"
    assert governed.get("risk_model_conflict") in (None, False)
    assert governed["acute_safety"]["acute_deterioration"] is False


def test_glucose_mgdl_is_normalised_to_mmol():
    v = extract_vitals({"bloodGlucose": 380})  # 380 mg/dL ≈ 21.1 mmol/L
    assert v["glucose"] is not None and 20.0 <= v["glucose"] <= 22.0


def test_evaluate_is_safe_with_empty_vitals():
    ev = evaluate({})
    assert ev["acute_deterioration"] is False
    assert ev["syndrome_alerts"] == []
