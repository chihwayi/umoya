from typing import Any, Dict, List, Optional


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def compute_confidence_score(
    suggested_diagnoses: Optional[List[Dict[str, Any]]],
    clinical_recommendation: Optional[Dict[str, Any]] = None,
) -> float:
    diagnoses = suggested_diagnoses or []
    top_probability = 0.0
    if diagnoses:
        top_probability = max(_safe_float(d.get("probability"), 0.0) for d in diagnoses)

    evidence_level = str((clinical_recommendation or {}).get("evidence_level") or "").strip().lower()
    evidence_boost = {
        "high": 0.15,
        "moderate": 0.08,
        "low": 0.0,
    }.get(evidence_level, 0.0)

    return max(0.0, min(1.0, top_probability + evidence_boost))


def apply_safety_gate(result: Dict[str, Any], policy: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    policy = policy or {}
    min_confidence = _safe_float(policy.get("min_confidence_score"), 0.55)
    require_citations = bool(policy.get("require_citations", True))
    min_citations = int(_safe_float(policy.get("min_citation_count"), 1))
    abstain_on_low_confidence = bool(policy.get("abstain_on_low_confidence", True))

    confidence_score = compute_confidence_score(
        suggested_diagnoses=result.get("suggested_diagnoses"),
        clinical_recommendation=result.get("clinical_recommendation"),
    )
    citations = result.get("guideline_citations") or []
    citation_count = len(citations)

    blocked_reasons: List[str] = []
    if confidence_score < min_confidence:
        blocked_reasons.append("low_confidence")
    if require_citations and citation_count < max(0, min_citations):
        blocked_reasons.append("insufficient_citations")

    gate = {
        "passed": len(blocked_reasons) == 0,
        "confidence_score": round(confidence_score, 4),
        "citation_count": citation_count,
        "thresholds": {
            "min_confidence_score": min_confidence,
            "require_citations": require_citations,
            "min_citation_count": min_citations,
            "abstain_on_low_confidence": abstain_on_low_confidence,
        },
        "reasons": blocked_reasons,
    }

    out = dict(result)
    out["safety_gate"] = gate

    if blocked_reasons and abstain_on_low_confidence:
        out["abstained"] = True
        out["clinical_recommendation"] = {
            "text": "Insufficient evidence/confidence for a definitive AI recommendation. Escalate to clinician review.",
            "evidence_level": "Low",
            "reasoning": "Safety gate blocked final recommendation.",
            "action_items": [
                "Review patient details manually",
                "Order confirmatory diagnostics",
                "Re-run AI after additional evidence is available",
            ],
        }
    else:
        out["abstained"] = False

    return out
