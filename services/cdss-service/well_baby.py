"""
Well-Baby Clinic CDSS — ASQ-3 milestone evaluation and WHO growth classification.
"""

# ASQ-3 cut-off scores by age interval (simplified — based on published ASQ-3 normative data)
ASQ3_CUTOFFS = {
    2:  {"communication": 19.09, "gross_motor": 18.98, "fine_motor": 20.09, "problem_solving": 15.97, "personal_social": 18.26},
    4:  {"communication": 19.86, "gross_motor": 29.67, "fine_motor": 22.83, "problem_solving": 21.24, "personal_social": 23.99},
    6:  {"communication": 27.98, "gross_motor": 33.74, "fine_motor": 30.88, "problem_solving": 31.62, "personal_social": 35.48},
    9:  {"communication": 23.83, "gross_motor": 39.59, "fine_motor": 32.53, "problem_solving": 28.28, "personal_social": 35.33},
    12: {"communication": 20.34, "gross_motor": 44.61, "fine_motor": 32.72, "problem_solving": 29.35, "personal_social": 36.18},
    18: {"communication": 26.76, "gross_motor": 49.77, "fine_motor": 39.18, "problem_solving": 29.84, "personal_social": 37.60},
    24: {"communication": 27.22, "gross_motor": 55.00, "fine_motor": 42.77, "problem_solving": 35.17, "personal_social": 44.91},
    30: {"communication": 32.89, "gross_motor": 55.00, "fine_motor": 48.39, "problem_solving": 40.17, "personal_social": 49.49},
    36: {"communication": 35.58, "gross_motor": 55.00, "fine_motor": 46.67, "problem_solving": 41.40, "personal_social": 47.36},
    48: {"communication": 40.56, "gross_motor": 55.00, "fine_motor": 45.78, "problem_solving": 43.11, "personal_social": 44.29},
    60: {"communication": 43.61, "gross_motor": 55.00, "fine_motor": 47.09, "problem_solving": 46.20, "personal_social": 48.01},
}


def evaluate_milestones(age_months: float, scores: dict) -> dict:
    """
    Evaluate ASQ-3 scores against age-specific cutoffs.

    scores dict keys: communication, gross_motor, fine_motor, problem_solving, personal_social
    Returns: overall_result, red_flags, recommendation
    """
    age_key = min(ASQ3_CUTOFFS.keys(), key=lambda k: abs(k - age_months))
    cutoffs = ASQ3_CUTOFFS[age_key]
    flags = []

    for domain, score in scores.items():
        if score is None:
            continue
        cutoff = cutoffs.get(domain)
        if cutoff is None:
            continue
        if score < cutoff:
            flags.append({
                "domain": domain,
                "score": score,
                "cutoff": cutoff,
                "message": f"{domain.replace('_', ' ').title()} score {score} is below age-expected cutoff ({cutoff}) at {age_months} months.",
            })

    urgent = len(flags) >= 3
    refer  = len(flags) >= 2

    return {
        "overall_result": (
            "urgent_refer" if urgent else
            "refer"        if refer  else
            "monitor"      if flags  else
            "on_track"
        ),
        "red_flags": flags,
        "age_months_assessed": age_months,
        "asq3_age_interval_used": age_key,
        "recommendation": (
            "URGENT referral to developmental paediatrician — 3+ domains below cutoff."
            if urgent else
            "Refer to appropriate therapy (speech/OT/physiotherapy) based on affected domains."
            if refer else
            "Monitor at next WBC visit — rescreen in 4–6 weeks."
            if flags else
            "Developmental screening on track. Continue routine WBC schedule."
        ),
    }


def classify_nutrition_risk(wfa_zscore: float | None, muac_cm: float | None, oedema: bool) -> dict:
    """
    Classify nutritional status by WHO/CMAM criteria and return management guidance.
    """
    if oedema:
        return {
            "classification": "sam",
            "severity": "critical",
            "action": "Admit to CMAM inpatient unit immediately. Bilateral pitting oedema indicates complicated SAM.",
        }
    if muac_cm is not None:
        if muac_cm < 11.5:
            return {"classification": "sam", "severity": "critical",
                    "action": "Enrol in CMAM outpatient programme (OTP). MUAC < 11.5 cm."}
        if muac_cm < 12.5:
            return {"classification": "mam", "severity": "moderate",
                    "action": "Enrol in Supplementary Feeding Programme (SFP). MUAC 11.5–12.5 cm."}
    if wfa_zscore is not None:
        if wfa_zscore < -3:
            return {"classification": "sam", "severity": "critical",
                    "action": "Enrol in CMAM outpatient programme (OTP). WFA z-score < -3."}
        if wfa_zscore < -2:
            return {"classification": "mam", "severity": "moderate",
                    "action": "Counsel on nutrition, increase feeding frequency, recheck in 2 weeks. WFA z-score -2 to -3."}
        if wfa_zscore < -1:
            return {"classification": "mild_wasting", "severity": "mild",
                    "action": "Dietary counselling, iron/zinc supplementation, recheck in 4 weeks."}
    return {
        "classification": "normal",
        "severity": "none",
        "action": "Continue routine feeding support and scheduled WBC visits.",
    }
