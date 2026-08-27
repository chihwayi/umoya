"""S262 — the acute-deterioration safety governor must apply to /diagnosis/suggest,
/diagnosis/suggest/intelligent, and /discharge/intelligence, not just /risk/calculate.
See docs/AI-INTELLIGENCE-AUDIT-ROADMAP.md F1.

Tests the pure clinical_safety.py helpers directly (diagnosis_acute_check,
discharge_acute_check) rather than going through main.py's FastAPI app — main.py
imports torch/transformers/chromadb at module level, which the CI safety-gate step
deliberately doesn't install (keeps this gate fast). clinical_safety.py has zero
heavy dependencies, so these tests stay lightweight like the rest of this file's
siblings in this directory."""
from clinical_safety import diagnosis_acute_check, discharge_acute_check

CRITICAL_VITALS = {"spo2": 88}  # SpO2 < 90 alone triggers critical_flags() -> acute_deterioration
STABLE_VITALS = {"spo2": 98, "heartRate": 76, "respiratoryRate": 16, "temperature": 36.8}


def test_diagnosis_acute_check_flags_critical_vitals():
    result = diagnosis_acute_check(CRITICAL_VITALS)
    assert result["acute_safety"]["acute_deterioration"] is True
    assert result["warning"] is not None
    assert "ACUTE DETERIORATION" in result["warning"]


def test_diagnosis_acute_check_stable_vitals_no_false_positive():
    result = diagnosis_acute_check(STABLE_VITALS)
    assert result["acute_safety"]["acute_deterioration"] is False
    assert result["warning"] is None


def test_discharge_acute_check_blocks_discharge_on_critical_vitals():
    # 'hr' is the key /discharge/intelligence's own request model uses for heart rate —
    # regression test for the extract_vitals() alias gap found while wiring this sprint.
    result = discharge_acute_check({"spo2": 87, "hr": 140, "bp": "78/50"})
    assert result["acute_safety"]["acute_deterioration"] is True
    assert result["discharge_safe"] is False
    assert any("do not discharge" in i.lower() for i in result["interventions"])


def test_discharge_acute_check_stable_vitals_allows_discharge():
    result = discharge_acute_check({"spo2": 98, "hr": 78, "bp": "118/76"})
    assert result["acute_safety"]["acute_deterioration"] is False
    assert result["discharge_safe"] is True
    assert result["interventions"] == []
