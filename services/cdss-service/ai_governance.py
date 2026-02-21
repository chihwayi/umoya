from typing import Any, Dict, List, Optional
import hashlib
import json
import re


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


def compute_request_hash(payload: Dict[str, Any]) -> str:
    encoded = json.dumps(payload or {}, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _extract_keywords(text: str) -> List[str]:
    if not text:
        return []
    tokens = re.findall(r"[a-zA-Z]{4,}", text.lower())
    return [t for t in tokens if t not in {"with", "from", "this", "that", "have", "patient", "clinical"}]


def detect_citation_contradictions(result: Dict[str, Any], confidence_score: float) -> List[str]:
    reasons: List[str] = []
    citations = result.get("guideline_citations") or []
    citation_text = " ".join(str(c.get("text") or "") for c in citations).lower()
    recommendation = str((result.get("clinical_recommendation") or {}).get("text") or "").lower()
    diagnoses = result.get("suggested_diagnoses") or []

    high_prob = [d for d in diagnoses if _safe_float(d.get("probability"), 0.0) >= 0.7][:3]
    for d in high_prob:
        name = str(d.get("diagnosis") or "").strip().lower()
        if not name:
            continue
        keys = _extract_keywords(name)
        if keys and citation_text and not any(k in citation_text for k in keys):
            reasons.append(f"diagnosis_not_supported:{name}")

    certainty_terms = ("definitive", "confirmed", "certain", "proven", "diagnostic of")
    if recommendation and any(term in recommendation for term in certainty_terms) and confidence_score < 0.8:
        reasons.append("overconfident_language")

    return reasons


# ----------------------------------------------------------------------------
# PHI / prompt scanning helpers
# ----------------------------------------------------------------------------

def _scan_for_phi(item: Any) -> bool:
    """Recursively scan a payload for PHI-sensitive strings.
    Returns True if any string element contains PHI according to privacy_guard.contains_phi.
    """
    from privacy_guard import contains_phi

    if isinstance(item, str):
        return contains_phi(item)
    if isinstance(item, dict):
        for v in item.values():
            if _scan_for_phi(v):
                return True
        return False
    if isinstance(item, list):
        for v in item:
            if _scan_for_phi(v):
                return True
        return False
    # other types (int, float, None) cannot contain PHI
    return False


def assert_no_phi_in_payload(payload: Any) -> None:
    """Raise RuntimeError if payload contains PHI string patterns."""
    if _scan_for_phi(payload):
        raise RuntimeError("PHI detected in input payload")


def apply_safety_gate(result: Dict[str, Any], policy: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    policy = policy or {}
    min_confidence = _safe_float(policy.get("min_confidence_score"), 0.55)
    require_citations = bool(policy.get("require_citations", True))
    min_citations = int(_safe_float(policy.get("min_citation_count"), 1))
    abstain_on_low_confidence = bool(policy.get("abstain_on_low_confidence", True))
    contradiction_check_enabled = bool(policy.get("contradiction_check_enabled", True))

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
    if contradiction_check_enabled:
        blocked_reasons.extend(detect_citation_contradictions(result, confidence_score))

    gate = {
        "status": "passed" if len(blocked_reasons) == 0 else "blocked",
        "passed": len(blocked_reasons) == 0,
        "confidence_score": round(confidence_score, 4),
        "citation_count": citation_count,
        "thresholds": {
            "min_confidence_score": min_confidence,
            "require_citations": require_citations,
            "min_citation_count": min_citations,
            "abstain_on_low_confidence": abstain_on_low_confidence,
            "contradiction_check_enabled": contradiction_check_enabled,
        },
        "reasons": blocked_reasons,
    }

    out = dict(result)
    out["safety_gate"] = gate
    out["model_trace"] = out.get("model_trace") or {}

    if blocked_reasons and abstain_on_low_confidence:
        out["abstained"] = True
        out["abstain_reason"] = blocked_reasons[0] if blocked_reasons else "safety_gate_blocked"
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
        out["abstain_reason"] = None

    return out
