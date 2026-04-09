"""
DHIS2 Tracker Client — S129 EPI / Immunization Registry

Handles:
  - Enrolling a patient as a Tracked Entity Instance (TEI) in DHIS2 Tracker
  - Pushing a vaccination event to a DHIS2 Tracker program stage
  - Batch syncing all pending immunization records from the sync log table

Environment variables required:
  DHIS2_BASE_URL      e.g. https://play.dhis2.org/dev
  DHIS2_USERNAME      service account username
  DHIS2_PASSWORD      service account password
  DHIS2_EPI_PROGRAM   UID of the EPI Tracker program
  DHIS2_ORG_UNIT      default org unit UID (can be overridden per tenant)
"""

import os
import base64
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dhis2/tracker", tags=["dhis2-tracker"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _dhis2_auth_header() -> str:
    username = os.getenv("DHIS2_USERNAME", "")
    password = os.getenv("DHIS2_PASSWORD", "")
    if not username or not password:
        raise HTTPException(status_code=503, detail="DHIS2 credentials not configured")
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {token}"


def _dhis2_base_url() -> str:
    url = os.getenv("DHIS2_BASE_URL", "").rstrip("/")
    if not url:
        raise HTTPException(status_code=503, detail="DHIS2_BASE_URL not configured")
    return url


def _epi_program_uid() -> str:
    uid = os.getenv("DHIS2_EPI_PROGRAM", "")
    if not uid:
        raise HTTPException(status_code=503, detail="DHIS2_EPI_PROGRAM not configured")
    return uid


def _org_unit_uid() -> str:
    return os.getenv("DHIS2_ORG_UNIT", "")


# ── Request / Response models ──────────────────────────────────────────────────

class EnrollTeiRequest(BaseModel):
    patient_id: str
    first_name: str
    last_name: str
    date_of_birth: str           # YYYY-MM-DD
    sex: Optional[str] = None    # MALE | FEMALE | UNKNOWN
    org_unit_uid: Optional[str] = None
    enrollment_date: Optional[str] = None  # YYYY-MM-DD, defaults to today


class PushEventRequest(BaseModel):
    patient_id: str
    dhis2_tei_uid: str
    dhis2_enrollment_uid: str
    vaccine_name: str
    dose_number: int
    administered_at: str         # ISO 8601
    lot_number: Optional[str] = None
    org_unit_uid: Optional[str] = None
    program_stage_uid: Optional[str] = None  # defaults to env DHIS2_EPI_PROGRAM_STAGE


class BatchSyncRequest(BaseModel):
    tenant_id: str
    limit: int = 50


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/enroll")
async def enroll_tei(body: EnrollTeiRequest, x_tenant_id: str = Header(...)):
    """
    Enroll a patient as a DHIS2 Tracked Entity Instance in the EPI programme.
    Returns dhis2_tei_uid and dhis2_enrollment_uid.
    """
    base_url = _dhis2_base_url()
    auth = _dhis2_auth_header()
    program_uid = _epi_program_uid()
    org_unit = body.org_unit_uid or _org_unit_uid()

    if not org_unit:
        raise HTTPException(status_code=400, detail="org_unit_uid required (set DHIS2_ORG_UNIT or pass in request)")

    enrollment_date = body.enrollment_date or datetime.now(timezone.utc).date().isoformat()

    # Build TEI payload — attribute UIDs must match the DHIS2 metadata for the deployed instance.
    # Attribute UIDs are expected in env vars so different DHIS2 instances can be supported.
    first_name_attr = os.getenv("DHIS2_ATTR_FIRST_NAME", "")
    last_name_attr = os.getenv("DHIS2_ATTR_LAST_NAME", "")
    dob_attr = os.getenv("DHIS2_ATTR_DOB", "")
    sex_attr = os.getenv("DHIS2_ATTR_SEX", "")

    attributes = []
    if first_name_attr:
        attributes.append({"attribute": first_name_attr, "value": body.first_name})
    if last_name_attr:
        attributes.append({"attribute": last_name_attr, "value": body.last_name})
    if dob_attr:
        attributes.append({"attribute": dob_attr, "value": body.date_of_birth})
    if sex_attr and body.sex:
        attributes.append({"attribute": sex_attr, "value": body.sex.upper()})

    tei_payload = {
        "trackedEntityType": os.getenv("DHIS2_TEI_TYPE", "nEenWmSyUEp"),
        "orgUnit": org_unit,
        "attributes": attributes,
        "enrollments": [
            {
                "orgUnit": org_unit,
                "program": program_uid,
                "enrollmentDate": enrollment_date,
                "incidentDate": enrollment_date,
            }
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{base_url}/api/trackedEntityInstances",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json=tei_payload,
        )

    if resp.status_code not in (200, 201):
        logger.error(f"DHIS2 TEI enroll failed: {resp.status_code} {resp.text[:500]}")
        raise HTTPException(status_code=502, detail=f"DHIS2 enrollment failed: {resp.text[:200]}")

    data = resp.json()
    tei_uid = None
    enrollment_uid = None

    # DHIS2 returns reference UIDs in the response summary
    reference = data.get("response", data)
    imported_summaries = reference.get("importSummaries", [])
    if imported_summaries:
        tei_uid = imported_summaries[0].get("reference")
        enrollment_summaries = imported_summaries[0].get("enrollments", {}).get("importSummaries", [])
        if enrollment_summaries:
            enrollment_uid = enrollment_summaries[0].get("reference")

    return {
        "dhis2_tei_uid": tei_uid,
        "dhis2_enrollment_uid": enrollment_uid,
        "patient_id": body.patient_id,
        "org_unit_uid": org_unit,
        "program_uid": program_uid,
    }


@router.post("/event")
async def push_vaccination_event(body: PushEventRequest, x_tenant_id: str = Header(...)):
    """
    Push a vaccination event to DHIS2 Tracker program stage.
    Returns the dhis2_event_uid.
    """
    base_url = _dhis2_base_url()
    auth = _dhis2_auth_header()
    program_uid = _epi_program_uid()
    org_unit = body.org_unit_uid or _org_unit_uid()
    program_stage_uid = body.program_stage_uid or os.getenv("DHIS2_EPI_PROGRAM_STAGE", "")

    if not org_unit:
        raise HTTPException(status_code=400, detail="org_unit_uid required")
    if not program_stage_uid:
        raise HTTPException(status_code=503, detail="DHIS2_EPI_PROGRAM_STAGE not configured")

    event_date = body.administered_at[:10]  # YYYY-MM-DD

    # Data element UIDs come from env — deployed instance specific.
    de_vaccine = os.getenv("DHIS2_DE_VACCINE_NAME", "")
    de_dose = os.getenv("DHIS2_DE_DOSE_NUMBER", "")
    de_lot = os.getenv("DHIS2_DE_LOT_NUMBER", "")

    data_values = []
    if de_vaccine:
        data_values.append({"dataElement": de_vaccine, "value": body.vaccine_name})
    if de_dose:
        data_values.append({"dataElement": de_dose, "value": str(body.dose_number)})
    if de_lot and body.lot_number:
        data_values.append({"dataElement": de_lot, "value": body.lot_number})

    event_payload = {
        "program": program_uid,
        "programStage": program_stage_uid,
        "orgUnit": org_unit,
        "trackedEntityInstance": body.dhis2_tei_uid,
        "enrollment": body.dhis2_enrollment_uid,
        "eventDate": event_date,
        "status": "COMPLETED",
        "dataValues": data_values,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{base_url}/api/events",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json=event_payload,
        )

    if resp.status_code not in (200, 201):
        logger.error(f"DHIS2 event push failed: {resp.status_code} {resp.text[:500]}")
        raise HTTPException(status_code=502, detail=f"DHIS2 event push failed: {resp.text[:200]}")

    data = resp.json()
    event_uid = None
    summaries = data.get("response", data).get("importSummaries", [])
    if summaries:
        event_uid = summaries[0].get("reference")

    return {
        "dhis2_event_uid": event_uid,
        "patient_id": body.patient_id,
        "vaccine_name": body.vaccine_name,
        "event_date": event_date,
    }


@router.get("/sync/status")
async def get_sync_status(patient_id: str, x_tenant_id: str = Header(...)):
    """
    Return DHIS2 sync status for a patient from the EHR service.
    Proxies to /epi/sync/status/:entityId on ehr-service.
    """
    ehr_base = os.getenv("EHR_SERVICE_URL", "http://ehr-service:3000").rstrip("/")
    service_token = os.getenv("INTERNAL_SERVICE_TOKEN", "")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{ehr_base}/epi/sync/status/{patient_id}",
            headers={
                "X-Tenant-ID": x_tenant_id,
                "Authorization": f"Bearer {service_token}",
            },
        )

    if resp.status_code == 404:
        return {"sync_status": "not_synced", "patient_id": patient_id}
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="EHR sync status lookup failed")

    return resp.json()


@router.post("/sync/batch")
async def batch_sync(body: BatchSyncRequest, x_tenant_id: str = Header(...)):
    """
    Batch sync all pending immunization records to DHIS2 Tracker.
    Fetches pending records from EHR service sync log, then pushes each event.
    Returns a summary of successes and failures.
    """
    ehr_base = os.getenv("EHR_SERVICE_URL", "http://ehr-service:3000").rstrip("/")
    service_token = os.getenv("INTERNAL_SERVICE_TOKEN", "")

    headers = {
        "X-Tenant-ID": body.tenant_id,
        "Authorization": f"Bearer {service_token}",
        "Content-Type": "application/json",
    }

    # Fetch pending sync log entries from EHR service
    async with httpx.AsyncClient(timeout=15.0) as client:
        pending_resp = await client.get(
            f"{ehr_base}/epi/sync/pending",
            headers=headers,
        )

    if pending_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch pending sync records from EHR service")

    pending = pending_resp.json()
    if not isinstance(pending, list):
        pending = pending.get("data", [])

    successes = []
    failures = []

    for record in pending[: body.limit]:
        entity_id = record.get("entity_id") or record.get("entityId")
        tei_uid = record.get("dhis2_tei_uid") or record.get("dhis2TeiUid")
        enrollment_uid = record.get("dhis2_enrollment_uid") or record.get("dhis2EnrollmentUid")

        if not tei_uid or not enrollment_uid:
            failures.append({"entity_id": entity_id, "reason": "missing_tei_or_enrollment_uid"})
            continue

        event_body = PushEventRequest(
            patient_id=record.get("patient_id", entity_id),
            dhis2_tei_uid=tei_uid,
            dhis2_enrollment_uid=enrollment_uid,
            vaccine_name=record.get("vaccine_name", "Unknown"),
            dose_number=record.get("dose_number", 1),
            administered_at=record.get("administered_at") or datetime.now(timezone.utc).isoformat(),
            lot_number=record.get("lot_number"),
        )

        try:
            result = await push_vaccination_event(event_body, x_tenant_id=body.tenant_id)
            successes.append({"entity_id": entity_id, "dhis2_event_uid": result.get("dhis2_event_uid")})
        except Exception as e:
            failures.append({"entity_id": entity_id, "reason": str(e)})

    return {
        "processed": len(pending[: body.limit]),
        "succeeded": len(successes),
        "failed": len(failures),
        "successes": successes,
        "failures": failures,
    }
