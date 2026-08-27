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

from datetime import datetime, timezone
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
        "heart_rate": _to_float(v.get("heartRate") or v.get("pulse") or v.get("heart_rate") or v.get("hr")),
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


def _vital_findings(v: Dict[str, Optional[float]]) -> List[str]:
    """Human-readable findings for the gestalt summary (worst-first)."""
    f: List[str] = []
    if v["spo2"] is not None and v["spo2"] < 90:
        f.append(f"severe hypoxaemia (SpO₂ {v['spo2']:g}%)")
    elif v["spo2"] is not None and v["spo2"] < 94:
        f.append(f"mild hypoxaemia (SpO₂ {v['spo2']:g}%)")
    if v["respiratory_rate"] is not None and v["respiratory_rate"] > 24:
        f.append(f"marked tachypnoea (RR {v['respiratory_rate']:g})")
    elif v["respiratory_rate"] is not None and v["respiratory_rate"] > 20:
        f.append(f"tachypnoea (RR {v['respiratory_rate']:g})")
    if v["temperature"] is not None and v["temperature"] >= 38.0:
        f.append(f"fever ({v['temperature']:g}°C)")
    elif v["temperature"] is not None and v["temperature"] <= 35.0:
        f.append(f"hypothermia ({v['temperature']:g}°C)")
    if v["heart_rate"] is not None and v["heart_rate"] > 120:
        f.append(f"tachycardia (HR {v['heart_rate']:g})")
    if v["systolic"] is not None and (v["systolic"] > 180 or (v["diastolic"] or 0) > 120):
        f.append(f"hypertensive crisis ({v['systolic']:g}/{v['diastolic']:g} mmHg)" if v["diastolic"] else f"severe hypertension (SBP {v['systolic']:g})")
    elif v["systolic"] is not None and v["systolic"] < 90:
        f.append(f"hypotension (SBP {v['systolic']:g})")
    if v["glucose"] is not None and v["glucose"] >= 13.9:
        f.append(f"severe hyperglycaemia ({v['glucose']:g} mmol/L)")
    if v["pain"] is not None and v["pain"] >= 7:
        f.append(f"severe pain ({v['pain']:g}/10)")
    return f


# ── deterioration trajectory (trend deltas vs the previous reading) ──────────────────
def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        text = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _humanize_window(minutes: Optional[float]) -> str:
    if minutes is None or minutes < 0:
        return ""
    if minutes < 90:
        return f"over {int(round(minutes))} min"
    hours = minutes / 60.0
    if hours < 48:
        return f"over {hours:.0f} h"
    return f"over {hours / 24:.0f} d"


# Per-vital adverse-direction rules: (is the current value abnormal AND moving the
# wrong way by a clinically meaningful step?). Trajectory only surfaces worsening trends.
def compute_trajectory(v: Dict[str, Optional[float]], historical_vitals: Optional[List[Dict[str, Any]]],
                       current_recorded_at: Any = None) -> Dict[str, Any]:
    """Compare the current reading to the most recent *prior* reading and surface
    deterioration deltas (e.g. SpO₂ 94→86). Deterministic, worst-first.

    The history payload usually includes the current reading itself (it was just
    persisted), so we exclude any entry at-or-after the current timestamp before
    choosing the previous reading — otherwise the current reading becomes its own
    baseline and every delta is zero."""
    if not historical_vitals:
        return {"deltas": [], "window": ""}

    cur_dt = _parse_dt(current_recorded_at)

    candidates = []
    for h in historical_vitals:
        hdt = _parse_dt(h.get("recordedAt") or h.get("recorded_at"))
        if cur_dt is not None and hdt is not None and hdt >= cur_dt:
            continue  # skip the current reading (and anything newer)
        candidates.append((hdt, h))
    if not candidates:
        return {"deltas": [], "window": ""}

    # Most recent prior reading (entries without a parseable date sort earliest).
    _epoch = datetime.min.replace(tzinfo=timezone.utc)
    candidates.sort(key=lambda x: (x[0] is not None, x[0] or _epoch))
    prev_dt, prev_raw = candidates[-1]
    prev = extract_vitals(prev_raw)

    minutes = None
    if prev_dt is not None:
        end = cur_dt or datetime.now(timezone.utc)
        minutes = max(0.0, (end - prev_dt).total_seconds() / 60.0)

    def adverse(key: str, curr: float, delta: float) -> bool:
        if key == "spo2":
            return curr < 94 and delta <= -2
        if key == "respiratory_rate":
            return curr > 20 and delta >= 2
        if key == "heart_rate":
            return curr > 100 and delta >= 5
        if key == "temperature":
            return curr >= 38.0 and delta >= 0.5
        if key == "systolic":
            return (curr > 180 and delta >= 5) or (curr < 90 and delta <= -5)
        if key == "glucose":
            return curr >= 11.0 and delta >= 1
        return False

    labels = {
        "spo2": "SpO₂", "respiratory_rate": "RR", "heart_rate": "HR",
        "temperature": "Temp", "systolic": "SBP", "glucose": "glucose",
    }
    deltas: List[Dict[str, Any]] = []
    for key in ("spo2", "respiratory_rate", "heart_rate", "temperature", "systolic", "glucose"):
        curr, before = v.get(key), prev.get(key)
        if curr is None or before is None:
            continue
        delta = round(curr - before, 1)
        if delta != 0 and adverse(key, curr, delta):
            deltas.append({
                "parameter": key, "label": labels[key],
                "previous": before, "current": curr, "delta": delta,
            })
    return {"deltas": deltas, "window": _humanize_window(minutes), "minutes": minutes}


def _trajectory_phrase(trajectory: Dict[str, Any]) -> str:
    deltas = trajectory.get("deltas") or []
    if not deltas:
        return ""
    window = trajectory.get("window")
    pieces = [f"{d['label']} {d['previous']:g}→{d['current']:g}" for d in deltas]
    suffix = f" {window}" if window else ""
    return f"Trajectory: {', '.join(pieces)}{suffix}."


def build_copilot_summary(v: Dict[str, Optional[float]], ev: Dict[str, Any]) -> str:
    """One-paragraph gestalt synthesis a clinician reads first (deterministic)."""
    findings = _vital_findings(v)
    if ev["acute_deterioration"]:
        lead = "Acute deterioration detected."
    elif findings or ev["syndrome_alerts"]:
        lead = "Some findings outside normal range."
    else:
        return "All recorded vitals are within normal limits. No immediate clinical concern; continue routine monitoring."

    parts = [lead]
    if v["news2"] is not None:
        parts.append(f"NEWS2 {v['news2']:g}.")
    if findings:
        parts.append("Findings: " + ", ".join(findings) + ".")

    trajectory_phrase = _trajectory_phrase(ev.get("trajectory") or {})
    if trajectory_phrase:
        parts.append(trajectory_phrase)

    concern_map = {
        "sepsis_screen": "sepsis", "dka_hhs_screen": "DKA/HHS",
        "multi_system_deterioration": "multi-system deterioration", "severe_pain": "uncontrolled pain",
    }
    concerns = [concern_map[a["type"]] for a in ev["syndrome_alerts"] if a["type"] in concern_map]
    if concerns:
        parts.append("Concern for " + ", ".join(dict.fromkeys(concerns)) + ".")

    if ev["acute_deterioration"]:
        parts.append("Immediate clinician review recommended; repeat full observations within 15 minutes.")
        if ev["sepsis_screen_positive"]:
            parts.append("Initiate sepsis screen (blood cultures, lactate).")
        if ev["dka_hhs"].get("severity") == "severe":
            parts.append("Check ketones + venous blood gas.")
        if v["spo2"] is not None and v["spo2"] < 90:
            parts.append("Commence oxygen therapy.")
    return " ".join(parts)


def mortality_risk(news2: Optional[float], has_critical: bool) -> Dict[str, Any]:
    """Deterministic, NEWS2-aligned mortality/ICU-risk band (RCP 2017: NEWS2≥7 = high risk
    of death/ICU admission). A distinct risk *domain* from readmission and acute state — the
    experts flagged that conflating these answers the wrong clinical question."""
    if has_critical or (news2 is not None and news2 >= 7):
        band = "high"
    elif news2 is not None and news2 >= 5:
        band = "medium"
    elif news2 is not None:
        band = "low"
    else:
        band = "unknown"
    return {"band": band, "basis": "NEWS2 + critical vitals (RCP 2017)"}


def evaluate(vitals: Optional[Dict[str, Any]], altered_mentation: bool = False,
             historical_vitals: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
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

    result = {
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
    # Distinct, labelled risk domains (A9) — each answers a different clinical question.
    # Readmission risk is owned by the readmission model and governed separately; here we
    # surface the two vitals-driven domains so they're never conflated with discharge risk.
    mortality = mortality_risk(news2, has_critical)
    result["mortality_risk"] = mortality
    result["risk_domains"] = {
        "acute_deterioration": {"state": acute_state, "severity": aggregate},
        "mortality": mortality,
    }
    current_recorded_at = (vitals or {}).get("recordedAt") or (vitals or {}).get("recorded_at")
    result["trajectory"] = compute_trajectory(v, historical_vitals, current_recorded_at)
    result["copilot_summary"] = build_copilot_summary(v, result)
    return result


# ── the safety governor ─────────────────────────────────────────────────────────────
_DISCHARGE_TERMS = ("discharge", "routine follow", "low readmission", "low risk")


def apply_safety_governor(response_data: Dict[str, Any], vitals: Optional[Dict[str, Any]],
                          altered_mentation: bool = False,
                          historical_vitals: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Intercept a risk/AI payload and refuse to present low-risk / discharge-oriented
    output while the patient is acutely deteriorating. Deterministic rules win."""
    if not isinstance(response_data, dict):
        return response_data
    ev = evaluate(vitals, altered_mentation, historical_vitals)
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


# ── diagnosis/discharge safety checks (S262) ────────────────────────────────────────
# apply_safety_governor() above is shaped specifically for the readmission-risk payload
# (risk_level/overall_score/readmission_assessment). /diagnosis/suggest,
# /diagnosis/suggest/intelligent, and /discharge/intelligence have different response
# shapes, so these two lightweight helpers reuse the same underlying evaluate() without
# assuming those fields exist. Deliberately pure (no FastAPI/main.py imports) so they can
# be unit-tested without pulling in the full ML dependency stack main.py loads.
def diagnosis_acute_check(vitals: Optional[Dict[str, Any]],
                          altered_mentation: bool = False) -> Dict[str, Any]:
    """For /diagnosis/suggest and /diagnosis/suggest/intelligent. Returns the acute_safety
    evaluation plus a red-flag string to prepend when the patient is acutely deteriorating
    (None otherwise)."""
    ev = evaluate(vitals, altered_mentation)
    warning = (
        "ACUTE DETERIORATION DETECTED — immediate clinician review required before "
        "acting on these diagnosis suggestions."
        if ev["acute_deterioration"] else None
    )
    return {"acute_safety": ev, "warning": warning}


def discharge_acute_check(vitals_at_discharge: Optional[Dict[str, Any]],
                          altered_mentation: bool = False) -> Dict[str, Any]:
    """For /discharge/intelligence. LACE+ only scores 30-day readmission risk from
    admission-time factors — it has no vitals input, so a patient who is acutely
    decompensating AT the moment of discharge can still score "low readmission risk".
    Returns whether discharge is currently safe plus interventions to prepend."""
    ev = evaluate(vitals_at_discharge, altered_mentation)
    if not ev["acute_deterioration"]:
        return {"acute_safety": ev, "discharge_safe": True, "interventions": []}

    interventions = ["ACUTE DETERIORATION DETECTED at discharge vitals — do not discharge. Immediate clinician review required."]
    interventions += [a["action"] for a in ev.get("syndrome_alerts", [])]
    return {"acute_safety": ev, "discharge_safe": False, "interventions": interventions}
