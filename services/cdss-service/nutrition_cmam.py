from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/cdss/nutrition", tags=["nutrition"])


class CmamProtocolRequest(BaseModel):
    classification: str
    oedema_grade: str | None = None
    weight_kg: float | None = None
    age_months: int | None = None


class CmamProtocolResponse(BaseModel):
    admission_criteria: list[str]
    program: str
    rutf_product: str
    rutf_sachets_per_day: int | None
    rutf_sachets_total: int | None
    therapeutic_formula: str | None
    therapeutic_volume_ml_per_feed: int | None
    therapeutic_feeds_per_day: int | None
    next_visit_days: int
    danger_signs: list[str]
    notes: str


def _otp_sachets_per_day(weight_kg: float | None) -> int | None:
    if weight_kg is None or weight_kg < 3.5:
        return None
    if weight_kg <= 3.9:
        return 2
    if weight_kg <= 6.9:
        return 3
    if weight_kg <= 8.4:
        return 4
    return 5


@router.post("/cmam-protocol", response_model=CmamProtocolResponse)
def cmam_protocol(req: CmamProtocolRequest) -> CmamProtocolResponse:
    classification = (req.classification or "normal").strip().upper()
    oedema_grade = (req.oedema_grade or "").strip()
    weight = req.weight_kg

    danger_signs = [
        "Poor appetite or anorexia",
        "Lethargy or unconsciousness",
        "Persistent vomiting",
        "Convulsions",
        "Severe dehydration",
        "Severe respiratory distress",
        "High fever or hypothermia",
    ]

    if classification == "SAM" and oedema_grade in {"++", "+++"}:
        feeds_per_day = 8
        volume_per_feed = None
        if weight and weight > 0:
            volume_per_feed = int(round((100 * weight) / feeds_per_day))

        return CmamProtocolResponse(
            admission_criteria=[
                "Severe acute malnutrition",
                f"Bilateral pitting oedema {oedema_grade}",
                "Stabilisation care required",
            ],
            program="SC",
            rutf_product="None during stabilisation",
            rutf_sachets_per_day=None,
            rutf_sachets_total=None,
            therapeutic_formula="F75",
            therapeutic_volume_ml_per_feed=volume_per_feed,
            therapeutic_feeds_per_day=feeds_per_day,
            next_visit_days=1,
            danger_signs=danger_signs,
            notes=(
                "Admit to stabilisation centre. Start F75 at 100 ml/kg/day divided into 8 feeds, "
                "then transition to F100 or RUTF when clinically stable. Any anorexia or medical "
                "complication should also be managed as SC even if oedema grading is incomplete."
            ),
        )

    if classification == "SAM":
        sachets_per_day = _otp_sachets_per_day(weight)
        total_sachets = sachets_per_day * 56 if sachets_per_day is not None else None
        return CmamProtocolResponse(
            admission_criteria=[
                "Severe acute malnutrition without inpatient danger criteria captured",
                "Outpatient therapeutic feeding candidate",
            ],
            program="OTP",
            rutf_product="Plumpy'Nut",
            rutf_sachets_per_day=sachets_per_day,
            rutf_sachets_total=total_sachets,
            therapeutic_formula=None,
            therapeutic_volume_ml_per_feed=None,
            therapeutic_feeds_per_day=None,
            next_visit_days=7,
            danger_signs=danger_signs,
            notes=(
                "Treat as outpatient therapeutic program when there is no anorexia, severe oedema, "
                "or other medical complication. Dose RUTF using UNICEF weight-band guidance at "
                "approximately 200 kcal/kg/day."
            ),
        )

    if classification == "MAM":
        sachets_per_day = None
        total_sachets = None
        if weight and weight > 0:
            sachets_per_day = max(1, int(round((75 * weight) / 500)))
            total_sachets = sachets_per_day * 56

        return CmamProtocolResponse(
            admission_criteria=[
                "Moderate acute malnutrition",
                "Supplementary feeding indicated",
            ],
            program="TSFP",
            rutf_product="RUSF",
            rutf_sachets_per_day=sachets_per_day,
            rutf_sachets_total=total_sachets,
            therapeutic_formula=None,
            therapeutic_volume_ml_per_feed=None,
            therapeutic_feeds_per_day=None,
            next_visit_days=14,
            danger_signs=danger_signs,
            notes=(
                "Manage in targeted supplementary feeding with RUSF or BP-100 support, nutrition "
                "counselling, and fortnightly review. Escalate to SAM pathway if oedema or complications emerge."
            ),
        )

    return CmamProtocolResponse(
        admission_criteria=["No acute malnutrition admission criteria met"],
        program="community",
        rutf_product="None",
        rutf_sachets_per_day=None,
        rutf_sachets_total=None,
        therapeutic_formula=None,
        therapeutic_volume_ml_per_feed=None,
        therapeutic_feeds_per_day=None,
        next_visit_days=30,
        danger_signs=danger_signs,
        notes="Provide community nutrition counselling, growth monitoring, and routine follow-up.",
    )
