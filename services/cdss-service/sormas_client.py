"""
SORMAS Client — S130 Outbreak Surveillance

Handles:
  - Exporting an outbreak case to SORMAS as a CaseDataDto
  - Fetching case sync status from SORMAS
  - IHR event notification (structured email via EHR notification service)

Environment variables required:
  SORMAS_BASE_URL         e.g. https://sormas.example.org
  SORMAS_USERNAME         service account username
  SORMAS_PASSWORD         service account password
  SORMAS_REGION_UUID      UUID of the SORMAS region for this deployment
  SORMAS_DISTRICT_UUID    UUID of the SORMAS district for this deployment
  EHR_SERVICE_URL         internal EHR service URL (default: http://ehr-service:3000)
  INTERNAL_SERVICE_TOKEN  service-to-service JWT
"""

import os
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/outbreak", tags=["outbreak-sormas"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _sormas_auth() -> str:
    username = os.getenv("SORMAS_USERNAME", "")
    password = os.getenv("SORMAS_PASSWORD", "")
    if not username or not password:
        raise HTTPException(status_code=503, detail="SORMAS credentials not configured")
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {token}"


def _sormas_base_url() -> str:
    url = os.getenv("SORMAS_BASE_URL", "").rstrip("/")
    if not url:
        raise HTTPException(status_code=503, detail="SORMAS_BASE_URL not configured")
    return url


def _ehr_headers(tenant_id: str) -> dict:
    return {
        "X-Tenant-ID": tenant_id,
        "Authorization": f"Bearer {os.getenv('INTERNAL_SERVICE_TOKEN', '')}",
        "Content-Type": "application/json",
    }


# ── Request / Response models ──────────────────────────────────────────────────

class SormasExportRequest(BaseModel):
    case_id: str
    disease_name: str
    patient_id: str
    patient_first_name: str
    patient_last_name: str
    date_of_birth: Optional[str] = None
    sex: Optional[str] = None          # MALE | FEMALE | UNKNOWN
    diagnosis_date: str                # YYYY-MM-DD
    onset_date: Optional[str] = None
    status: str                        # suspected | probable | confirmed | discarded
    exposure_location: Optional[str] = None
    facility_id: Optional[str] = None
    org_unit_uid: Optional[str] = None


class IhrNotifyRequest(BaseModel):
    disease_name: str
    case_count: int
    country_code: str
    window_start: str
    window_end: str
    alert_id: str
    recipient_email: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/sormas/export/{case_id}")
async def export_to_sormas(case_id: str, body: SormasExportRequest, x_tenant_id: str = Header(...)):
    """
    Export an outbreak case to SORMAS as a CaseDataDto.
    Stores the returned sormas_case_uuid back in the EHR outbreak_cases table.
    """
    base_url = _sormas_base_url()
    auth = _sormas_auth()
    region_uuid = os.getenv("SORMAS_REGION_UUID", "")
    district_uuid = os.getenv("SORMAS_DISTRICT_UUID", "")

    # SORMAS disease enum mapping (subset — extend as needed)
    disease_map = {
        "cholera": "CHOLERA",
        "ebola": "EVD",
        "measles": "MEASLES",
        "malaria": "MALARIA",
        "typhoid": "TYPHOID_FEVER",
        "mpox": "MONKEYPOX",
        "covid-19": "CORONAVIRUS",
        "yellow fever": "YELLOW_FEVER",
        "rabies": "RABIES",
        "plague": "PLAGUE",
    }
    sormas_disease = disease_map.get(body.disease_name.lower(), "OTHER")

    # SORMAS status mapping
    status_map = {
        "suspected": "SUSPECT",
        "probable": "PROBABLE",
        "confirmed": "CONFIRMED",
        "discarded": "NO_CASE",
    }
    sormas_classification = status_map.get(body.status.lower(), "SUSPECT")

    case_payload = {
        "uuid": None,  # SORMAS generates UUID on create
        "disease": sormas_disease,
        "caseClassification": sormas_classification,
        "investigationStatus": "PENDING",
        "outcomeDate": None,
        "reportDate": body.diagnosis_date,
        "symptomOnset": body.onset_date,
        "region": {"uuid": region_uuid} if region_uuid else None,
        "district": {"uuid": district_uuid} if district_uuid else None,
        "person": {
            "firstName": body.patient_first_name,
            "lastName": body.patient_last_name,
            "birthdateDD": None,
            "birthdateMM": None,
            "birthdateYYYY": int(body.date_of_birth[:4]) if body.date_of_birth else None,
            "sex": (body.sex or "UNKNOWN").upper(),
        },
        "externalID": body.patient_id,
        "externalToken": body.case_id,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{base_url}/sormas-rest/cases/push",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json=[case_payload],  # SORMAS push accepts array
        )

    if resp.status_code not in (200, 201, 204):
        logger.error(f"SORMAS export failed: {resp.status_code} {resp.text[:500]}")
        raise HTTPException(status_code=502, detail=f"SORMAS export failed: {resp.text[:200]}")

    # Extract SORMAS UUID from response
    sormas_case_uuid = None
    try:
        data = resp.json()
        if isinstance(data, list) and data:
            sormas_case_uuid = data[0].get("uuid") or data[0].get("createdUuid")
        elif isinstance(data, dict):
            sormas_case_uuid = data.get("uuid") or data.get("createdUuid")
    except Exception:
        pass

    # Store sormas_case_uuid back in EHR
    if sormas_case_uuid:
        ehr_base = os.getenv("EHR_SERVICE_URL", "http://ehr-service:3000").rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.patch(
                f"{ehr_base}/outbreak/cases/{case_id}",
                headers=_ehr_headers(x_tenant_id),
                json={"sormasCaseUuid": sormas_case_uuid, "reportedToMoh": True},
            )

    return {
        "case_id": case_id,
        "sormas_case_uuid": sormas_case_uuid,
        "status": "exported",
    }


@router.get("/sormas/sync/status")
async def get_sormas_sync_status(x_tenant_id: str = Header(...)):
    """
    Fetch all outbreak cases that have a sormas_case_uuid and check their
    current classification in SORMAS.
    """
    ehr_base = os.getenv("EHR_SERVICE_URL", "http://ehr-service:3000").rstrip("/")
    base_url = _sormas_base_url()
    auth = _sormas_auth()

    # Get cases with sormas UUIDs from EHR
    async with httpx.AsyncClient(timeout=15.0) as client:
        cases_resp = await client.get(
            f"{ehr_base}/outbreak/cases",
            headers=_ehr_headers(x_tenant_id),
            params={"limit": 200},
        )

    if cases_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch outbreak cases from EHR")

    result = cases_resp.json()
    cases = result.get("data", result) if isinstance(result, dict) else result
    synced = [c for c in cases if c.get("sormasCaseUuid")]

    statuses = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for case in synced[:50]:  # cap at 50 per call
            uuid = case["sormasCaseUuid"]
            r = await client.get(
                f"{base_url}/sormas-rest/cases/{uuid}",
                headers={"Authorization": auth},
            )
            if r.status_code == 200:
                sormas_data = r.json()
                statuses.append({
                    "case_id": case["id"],
                    "sormas_case_uuid": uuid,
                    "sormas_classification": sormas_data.get("caseClassification"),
                    "sormas_investigation_status": sormas_data.get("investigationStatus"),
                })
            else:
                statuses.append({
                    "case_id": case["id"],
                    "sormas_case_uuid": uuid,
                    "error": f"SORMAS returned {r.status_code}",
                })

    return {"count": len(statuses), "cases": statuses}


@router.post("/ihr/notify")
async def notify_ihr(body: IhrNotifyRequest, x_tenant_id: str = Header(...)):
    """
    Submit an IHR (International Health Regulations) event notification.
    Sends a structured notification via the EHR notification service.
    IHR does not have a public REST API — notification is via email to
    the country IHR focal point.
    """
    ehr_base = os.getenv("EHR_SERVICE_URL", "http://ehr-service:3000").rstrip("/")
    recipient = body.recipient_email or os.getenv("IHR_FOCAL_POINT_EMAIL", "")

    if not recipient:
        raise HTTPException(status_code=400, detail="recipient_email required (or set IHR_FOCAL_POINT_EMAIL env var)")

    notification_payload = {
        "type": "ihr_event",
        "recipientEmail": recipient,
        "subject": f"IHR Event Notification — {body.disease_name} — {body.country_code}",
        "body": (
            f"IHR Event Notification\n\n"
            f"Disease: {body.disease_name}\n"
            f"Country: {body.country_code}\n"
            f"Case Count: {body.case_count}\n"
            f"Reporting Window: {body.window_start} to {body.window_end}\n"
            f"Alert ID: {body.alert_id}\n\n"
            f"This notification is submitted in accordance with IHR (2005) Article 6 obligations.\n"
            f"Generated by MediCore EHR at {datetime.now(timezone.utc).isoformat()}."
        ),
        "metadata": {
            "alertId": body.alert_id,
            "diseaseNname": body.disease_name,
            "countryCode": body.country_code,
            "caseCount": body.case_count,
        },
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{ehr_base}/notifications/send",
            headers=_ehr_headers(x_tenant_id),
            json=notification_payload,
        )

    if resp.status_code not in (200, 201, 204):
        logger.error(f"IHR notification failed: {resp.status_code} {resp.text[:300]}")
        raise HTTPException(status_code=502, detail="IHR notification delivery failed")

    # Acknowledge the MOH alert in EHR
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(
            f"{ehr_base}/outbreak/alerts/{body.alert_id}/acknowledge",
            headers=_ehr_headers(x_tenant_id),
        )

    return {
        "status": "notified",
        "alert_id": body.alert_id,
        "recipient": recipient,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
