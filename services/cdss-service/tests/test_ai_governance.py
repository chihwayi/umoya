from ai_governance import apply_safety_gate, compute_confidence_score


def test_compute_confidence_score_with_evidence_boost():
    score = compute_confidence_score(
        suggested_diagnoses=[{"diagnosis": "A", "probability": 0.62}],
        clinical_recommendation={"evidence_level": "High"},
    )
    assert score >= 0.75


def test_apply_safety_gate_abstains_on_low_confidence_and_no_citations():
    result = {
        "suggested_diagnoses": [{"diagnosis": "A", "probability": 0.4}],
        "guideline_citations": [],
    }
    gated = apply_safety_gate(
        result,
        {
            "min_confidence_score": 0.7,
            "require_citations": True,
            "min_citation_count": 1,
            "abstain_on_low_confidence": True,
        },
    )
    assert gated["abstained"] is True
    assert gated["abstain_reason"] == "low_confidence"
    assert gated["safety_gate"]["passed"] is False
    assert gated["safety_gate"]["status"] == "blocked"
    assert "low_confidence" in gated["safety_gate"]["reasons"]
    assert "insufficient_citations" in gated["safety_gate"]["reasons"]


def test_apply_safety_gate_passes_when_thresholds_met():
    result = {
        "suggested_diagnoses": [{"diagnosis": "A", "probability": 0.82}],
        "guideline_citations": [{"source": "WHO"}],
        "clinical_recommendation": {"evidence_level": "Moderate"},
    }
    gated = apply_safety_gate(
        result,
        {
            "min_confidence_score": 0.7,
            "require_citations": True,
            "min_citation_count": 1,
            "abstain_on_low_confidence": True,
        },
    )
    assert gated["abstained"] is False
    assert gated["abstain_reason"] is None
    assert gated["safety_gate"]["passed"] is True
    assert gated["safety_gate"]["status"] == "passed"


def test_apply_safety_gate_blocks_overconfident_language_when_low_confidence():
    result = {
        "suggested_diagnoses": [{"diagnosis": "Pneumonia", "probability": 0.45}],
        "guideline_citations": [{"text": "General fever and cough management guidance"}],
        "clinical_recommendation": {"text": "This is definitively bacterial pneumonia."},
    }
    gated = apply_safety_gate(
        result,
        {
            "min_confidence_score": 0.4,
            "require_citations": True,
            "min_citation_count": 1,
            "abstain_on_low_confidence": True,
            "contradiction_check_enabled": True,
        },
    )
    assert gated["abstained"] is True
    assert "overconfident_language" in gated["safety_gate"]["reasons"]


def test_assert_no_phi_in_payload_blocks_simple():
    from ai_governance import assert_no_phi_in_payload

    try:
        assert_no_phi_in_payload("Patient SSN 987-65-4321")
        blocked = False
    except RuntimeError:
        blocked = True
    assert blocked is True


def test_assert_no_phi_in_payload_passes_non_phi():
    from ai_governance import assert_no_phi_in_payload
    assert_no_phi_in_payload({"notes": "Only mention of fever and cough."})
