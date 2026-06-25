FFD_RULES = {
    "hypertension_stage2": {
        "condition": lambda v: v.get("bp_systolic", 0) > 160 or v.get("bp_diastolic", 0) > 100,
        "flag": "Blood pressure exceeds Stage 2 threshold (>160/100). Restrict from safety-critical roles (heights, heavy machinery) pending cardiology review.",
        "suggested_category": "fit_with_restrictions",
    },
    "spirometry_obstruction": {
        "condition": lambda v: (v.get("fev1_fvc_ratio", 1.0)) < 0.70 and v.get("spirometry_fev1", 100) < 60,
        "flag": "FEV1/FVC < 0.70 with FEV1 < 60% predicted. Significant obstruction. Consider respiratory surveillance protocol and restrict from dusty environments.",
        "suggested_category": "fit_with_restrictions",
    },
    "substance_positive": {
        "condition": lambda v: v.get("substance_screen_result") == "positive",
        "flag": "Positive substance screen. Employee must not operate vehicles or heavy machinery. Refer to EAP/SAP before return-to-work clearance.",
        "suggested_category": "temporarily_unfit",
    },
}


def evaluate_ffd(vitals: dict) -> dict:
    """Called by POST /oem/cdss/ffd-eval"""
    flags = []
    suggested_category = "fit"
    escalation = ["fit", "fit_with_restrictions", "temporarily_unfit", "permanently_unfit"]

    for rule_name, rule in FFD_RULES.items():
        if rule["condition"](vitals):
            flags.append({"rule": rule_name, "message": rule["flag"]})
            current_idx = escalation.index(suggested_category)
            new_idx = escalation.index(rule["suggested_category"])
            if new_idx > current_idx:
                suggested_category = rule["suggested_category"]

    return {
        "suggested_fitness_category": suggested_category,
        "flags": flags,
        "requires_specialist_review": len(flags) > 0,
    }
