"""Neonatal CDSS — Bhutani nomogram jaundice evaluation with preterm adjustment."""

PHOTOTHERAPY_THRESHOLDS = [
    {"hour_min": 0,  "hour_max": 24,  "photo": 102, "exchange": 257},
    {"hour_min": 24, "hour_max": 48,  "photo": 154, "exchange": 308},
    {"hour_min": 48, "hour_max": 72,  "photo": 188, "exchange": 342},
    {"hour_min": 72, "hour_max": 9999,"photo": 205, "exchange": 359},
]


def evaluate_jaundice(
    total_bilirubin_umol_l: float,
    hours_of_life: float,
    gestation_weeks: float,
) -> dict:
    """
    Bhutani nomogram evaluation.
    Preterm adjustment: deduct 34 μmol/L from both thresholds for GA < 35 weeks.
    """
    row = next(
        (r for r in PHOTOTHERAPY_THRESHOLDS if r["hour_min"] <= hours_of_life < r["hour_max"]),
        PHOTOTHERAPY_THRESHOLDS[-1],
    )
    preterm_offset = 34 if gestation_weeks < 35 else 0
    photo_threshold    = row["photo"]    - preterm_offset
    exchange_threshold = row["exchange"] - preterm_offset

    above_exchange = total_bilirubin_umol_l >= exchange_threshold
    above_photo    = total_bilirubin_umol_l >= photo_threshold

    return {
        "photo_threshold":              photo_threshold,
        "exchange_threshold":           exchange_threshold,
        "above_phototherapy_threshold": above_photo,
        "above_exchange_threshold":     above_exchange,
        "recommendation": (
            "URGENT: Exchange transfusion threshold met. Escalate immediately."
            if above_exchange else
            "Start phototherapy — TSB above threshold for gestational age and hours of life."
            if above_photo else
            "Monitor. TSB below phototherapy threshold. Repeat TSB as clinically indicated."
        ),
        "urgency": "critical" if above_exchange else "high" if above_photo else "routine",
    }
