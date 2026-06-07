"""
Deterministic clinical-safety synthesis + governor (Correction Sprint, Phase 0).

Why this exists
---------------
The readmission model (`risk_scoring.py`) has no vitals input, so for an acutely
deteriorating patient it returns "low / 0.0 / discharge / routine" — which was shown
beside CRITICAL safety alerts (NEWS2=10). Five expert reviewers flagged this as the #1
patient-safety defect. This module:

1. Synthesises the clinical signals the system was missing — **qSOFA, SIRS/sepsis screen,
   DKA/HHS screen, severe pain** — from the structured vitals already sent to /risk/calculate.
2. Derives an **acute clinical state** + **aggregate severity**.
3. Provides a **safety governor** that overrides/suppresses any low-risk / discharge-oriented
   AI output while the patient is acutely deteriorating, and flags the rule-vs-AI conflict.

Pure functions, no external dependencies — safe to unit-test in the CI offline safety gates.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


# ── vitals normalisation ────────────────────────────────────────────────────────────
def _to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_glucose_mmol(value: Optional[float]) -> Optional[float]:
    """Patient/portal flows sometimes store mg/dL; clinical entry uses mmol/L.
    Values > 45 are almost certainly mg/dL (45 mmol/L is non-physiological)."""
    if value is None:
        return None
    return round(value / 18.0, 1) if value > 45 else value


def extract_vitals(vitals: Optional[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    """Pull the structured vitals we need, tolerant of the various field names used
    across the EHR/portal payloads."""
    v = vitals or {}
    systolic = _to_float(v.get("systolicBp") or v.get("systolic"))
    diastolic = _to_float(v.get("diastolicBp") or v.get("diastolic"))
    bp = v.get("bloodPressure") or v.get("bp")
    if (systolic is None or diastolic is None) and isinstance(bp, str) and "/" in bp:
        parts = bp.split("/")
        systolic = systolic if systolic is not None else _to_float(parts[0])
        diastolic = diastolic if diastolic is not None else _to_float(parts[1] if len(parts) > 1 else None)

    return {
        "systolic": systolic,
        "diastolic": diastolic,
        "spo2": _to_float(v.get("spo2") or v.get("oxygenSaturation") or v.get("oxygen_saturation")),
        "heart_rate": _to_float(v.get("heartRate") or v.get("pulse") or v.get("heart_rate")),
        "temperature": _to_float(v.get("temperature") or v.get("temp")),
        "respiratory_rate": _to_float(v.get("respiratoryRate") or v.get("respiratory_rate") or v.get("rr")),
        "glucose": _normalize_glucose_mmol(_to_float(v.get("bloodGlucose") or v.get("glucose") or v.get("bgl"))),
        "pain": _to_float(v.get("painLevel") or v.get("painScore") or v.get("pain")),
        "news2": _to_float(v.get("news2") or v.get("news2Score")),
    }


# ── deterministic clinical calculators ──────────────────────────────────────────────
def compute_qsofa(v: Dict[str, Optional[float]], altered_mentation: bool = False) -> Dict[str, Any]:
    """qSOFA: RR>=22, SBP<=100, altered mentation. >=2 = high sepsis risk."""
    criteria = []
    if v["respiratory_rate"] is not None and v["respiratory_rate"] >= 22:
        criteria.append("respiratory rate >= 22")
    if v["systolic"] is not None and v["systolic"] <= 100:
        criteria.append("systolic BP <= 100")
    if altered_mentation:
        criteria.append("altered mentation")
    return {"score": len(criteria), "criteria": criteria, "high_risk": len(criteria) >= 2}


def compute_sirs(v: Dict[str, Optional[float]]) -> Dict[str, Any]:
    """SIRS: temp >38 or <36, HR>90, RR>20 (+WBC if available). >=2 = SIRS positive."""
    criteria = []
    if v["temperature"] is not None and (v["temperature"] > 38.0 or v["temperature"] < 36.0):
        criteria.append("temperature abnormal")
    if v["heart_rate"] is not None and v["heart_rate"] > 90:
        criteria.append("heart rate > 90")
    if v["respiratory_rate"] is not None and v["respiratory_rate"] > 20:
        criteria.append("respiratory rate > 20")
    return {"score": len(criteria), "criteria": criteria, "positive": len(criteria) >= 2}


def screen_dka_hhs(v: Dict[str, Optional[float]]) -> Dict[str, Any]:
    """Hyperglycaemia screen. Per ADA, glucose alone does NOT diagnose DKA/HHS —
    it triggers a ketone + venous-blood-gas (acidosis) workup."""
    g = v["glucose"]
    if g is None:
        return {"flag": False}
    if g >= 13.9:
        return {
            "flag": True, "severity": "severe", "glucose_mmol": g,
            "action": (f"Severe hyperglycaemia ({g} mmol/L). Check ketones + venous blood gas; "
                       "assess for DKA/HHS (do not label DKA without ketones/acidosis)."),
        }
    if g >= 11.0:
        return {"flag": True, "severity": "moderate", "glucose_mmol": g,
                "action": f"Hyperglycaemia ({g} mmol/L). Recheck and monitor."}
    return {"flag": False, "glucose_mmol": g}


def severe_pain(v: Dict[str, Optional[float]]) -> Dict[str, Any]:
    p = v["pain"]
    if p is not None and p >= 7:
        return {"flag": True, "score": p,
                "action": f"Severe pain {int(p)}/10 — urgent analgesia and assess cause."}
    return {"flag": False, "score": p}


def critical_flags(v: Dict[str, Optional[float]]) -> List[Dict[str, str]]:
    """Per-vital red-thresholds that, alone, indicate acute danger."""
    flags: List[Dict[str, str]] = []
    if v["spo2"] is not None and v["spo2"] < 90:
        flags.append({"parameter": "spo2", "severity": "critical", "detail": f"SpO2 {v['spo2']}% (<90)"})
    if v["systolic"] is not None and v["systolic"] > 180:
        flags.append({"parameter": "systolic", "severity": "critical", "detail": f"Systolic {v['systolic']} (>180)"})
    if v["diastolic"] is not None and v["diastolic"] > 120:
        flags.append({"parameter": "diastolic", "severity": "critical", "detail": f"Diastolic {v['diastolic']} (>120)"})
    if v["systolic"] is not None and v["systolic"] < 90:
        flags.append({"parameter": "systolic", "severity": "critical", "detail": f"Systolic {v['systolic']} (<90)"})
    if v["respiratory_rate"] is not None and (v["respiratory_rate"] > 24 or v["respiratory_rate"] < 8):
        flags.append({"parameter": "respiratory_rate", "severity": "critical", "detail": f"RR {v['respiratory_rate']}"})
    if v["heart_rate"] is not None and (v["heart_rate"] > 130 or v["heart_rate"] < 40):
        flags.append({"parameter": "heart_rate", "severity": "high", "detail": f"HR {v['heart_rate']}"})
    if v["temperature"] is not None and (v["temperature"] >= 39.5 or v["temperature"] <= 35.0):
        flags.append({"parameter": "temperature", "severity": "high", "detail": f"Temp {v['temperature']}°C"})
    return flags


def evaluate(vitals: Optional[Dict[str, Any]], altered_mentation: bool = False) -> Dict[str, Any]:
    """Single source of truth: synthesise all signals + acute state + syndrome alerts."""
    v = extract_vitals(vitals)
    qsofa = compute_qsofa(v, altered_mentation)
    sirs = compute_sirs(v)
    dka = screen_dka_hhs(v)
    pain = severe_pain(v)
    flags = critical_flags(v)
    news2 = v["news2"]

    sepsis_positive = sirs["positive"] or qsofa["high_risk"]
    has_critical = any(f["severity"] == "critical" for f in flags)
    news2_high = news2 is not None and news2 >= 7

    acute = bool(has_critical or news2_high or qsofa["high_risk"]
                 or (sepsis_positive and (v["temperature"] is not None and v["temperature"] > 38.0))
                 or (dka.get("severity") == "severe"))

    if acute:
        aggregate = "critical" if (has_critical or news2_high) else "high"
        acute_state = "ACUTE_DETERIORATION"
    elif flags or sepsis_positive or dka.get("flag") or pain["flag"]:
        aggregate = "high"
        acute_state = "STABLE"
    else:
        aggregate = "low"
        acute_state = "STABLE"

    syndrome_alerts: List[Dict[str, str]] = []
    if sepsis_positive and v["temperature"] is not None and v["temperature"] > 38.0:
        syndrome_alerts.append({
            "type": "sepsis_screen", "severity": "critical",
            "message": (f"Sepsis screen POSITIVE — SIRS {sirs['score']}/qSOFA {qsofa['score']}: "
                        + ", ".join(sirs["criteria"]) + "."),
            "action": "Screen for sepsis: blood cultures ×2, lactate, consider hour-1 bundle (Surviving Sepsis).",
        })
    if dka.get("flag") and dka.get("severity") == "severe":
        syndrome_alerts.append({"type": "dka_hhs_screen", "severity": "high", "message": dka["action"],
                                "action": "Ketones + VBG; electrolytes; assess DKA/HHS."})
    if pain["flag"]:
        syndrome_alerts.append({"type": "severe_pain", "severity": "high", "message": pain["action"],
                                "action": "Urgent analgesia + causality review."})
    if has_critical:
        syndrome_alerts.append({
            "type": "multi_system_deterioration", "severity": "critical",
            "message": "Multi-system acute deterioration — " + "; ".join(f["detail"] for f in flags) + ".",
            "action": "Immediate clinician review. Repeat full vitals within 15 minutes.",
        })

    return {
        "acute_deterioration": acute,
        "acute_state": acute_state,
        "aggregate_severity": aggregate,
        "qsofa": qsofa,
        "sirs": sirs,
        "dka_hhs": dka,
        "severe_pain": pain,
        "critical_flags": flags,
        "sepsis_screen_positive": sepsis_positive,
        "syndrome_alerts": syndrome_alerts,
    }


# ── the safety governor ─────────────────────────────────────────────────────────────
_DISCHARGE_TERMS = ("discharge", "routine follow", "low readmission", "low risk")


def apply_safety_governor(response_data: Dict[str, Any], vitals: Optional[Dict[str, Any]],
                          altered_mentation: bool = False) -> Dict[str, Any]:
    """Intercept a risk/AI payload and refuse to present low-risk / discharge-oriented
    output while the patient is acutely deteriorating. Deterministic rules win."""
    if not isinstance(response_data, dict):
        return response_data
    ev = evaluate(vitals, altered_mentation)
    response_data["acute_safety"] = ev

    if not ev["acute_deterioration"]:
        return response_data

    original_level = response_data.get("risk_level")
    original_score = response_data.get("overall_score")
    is_low = str(original_level or "").lower() in ("low", "moderate", "unknown")

    # Preserve the original (readmission) assessment but mark it deferred.
    response_data["readmission_assessment"] = {
        "suppressed": True,
        "original_risk_level": original_level,
        "original_score": original_score,
        "reason": "Patient in active deterioration — discharge/readmission assessment deferred.",
    }
    response_data["risk_model_conflict"] = bool(is_low)
    response_data["risk_level"] = "critical"

    escalation: List[str] = ["Immediate clinician review required — acute deterioration detected."]
    escalation += [a["action"] for a in ev["syndrome_alerts"]]
    escalation.append("Readmission/discharge assessment deferred until the patient stabilises.")
    response_data["recommendations"] = escalation

    response_data["governor_banner"] = (
        "ACUTE DETERIORATION — discharge/readmission assessment suppressed. "
        "Resolve the acute episode before discharge planning."
    )
    return response_data
