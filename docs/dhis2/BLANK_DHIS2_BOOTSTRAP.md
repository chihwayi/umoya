# Blank DHIS2 2.40 Bootstrap (Medicore)

Date: 2026-03-10  
Target: local DHIS2 `http://localhost:8888` (`d2 cluster up --port 8888`)

## 1. Purpose

Create the minimum metadata on a blank DHIS2 so tenant-based Medicore sync can start immediately.

The bootstrap is idempotent:
- reuses metadata by `code` when found,
- creates missing resources only.

## 2. Prerequisites

- DHIS2 is running and reachable (`http://localhost:8888`).
- Personal Access Token generated in DHIS2 (`Server/script context`).
- Backend has network path to DHIS2.

## 3. Command

```bash
DHIS2_URL=http://localhost:8888 \
DHIS2_API_VERSION=40 \
DHIS2_PAT=your_token_here \
DHIS2_CLINIC_CODE=clinic_a \
DHIS2_CLINIC_NAME="Clinic A" \
npm run dhis2:bootstrap
```

Optional:

```bash
DHIS2_BOOTSTRAP_OUTPUT=/tmp/clinic-a-bootstrap.json
```

## 4. What It Creates/Reuses

Script: `scripts/bootstrap-dhis2-metadata.mjs`

- Organisation Unit by code: `DHIS2_CLINIC_CODE`
- Tracked Entity Type:
  - code: `MC_TET_PATIENT`
  - name: `MediCore Patient`
- Tracked Entity Attributes:
  - `MC_ATTR_PATIENT_NUMBER`
  - `MC_ATTR_FIRST_NAME`
  - `MC_ATTR_LAST_NAME`
  - `MC_ATTR_DOB`
  - `MC_ATTR_GENDER`
  - `MC_ATTR_NATIONAL_ID`
  - `MC_ATTR_PHONE`
- Aggregate Data Elements:
  - `MC_DE_TOTAL_CONSULTATIONS`
  - `MC_DE_COMPLETED_CONSULTATIONS`
  - `MC_DE_TOTAL_ADMISSIONS`
  - `MC_DE_TOTAL_DISCHARGES`
  - `MC_DE_TOTAL_ED_VISITS`
- DataSet:
  - code: `MC_DS_SERVICE_DELIVERY_MONTHLY`
  - period: monthly
- DHIS2 user org-unit access:
  - ensures authenticated PAT user has org-unit/data-view/TEI-search access,
  - preserves previously assigned org units when bootstrapping additional clinics.

## 5. Output

On success:
- JSON summary printed to stdout,
- JSON summary saved to `/tmp/dhis2-bootstrap-output.json` (or custom path).

Use output IDs in tenant config:
- `orgUnitId`
- `trackedEntityTypeId`
- `dataSetId`

## 6. Tenant Config Follow-Up

After bootstrap, call tenant config API:

- `PUT /api/tenants/:id/dhis2-config`

Payload minimum:

```json
{
  "baseUrl": "http://localhost:8888",
  "apiVersion": "40",
  "authType": "pat",
  "pat": "d2pat_...",
  "orgUnitId": "ORG_UNIT_UID",
  "trackedEntityTypeId": "TRACKED_ENTITY_TYPE_UID",
  "datasetId": "DATASET_UID",
  "enabled": true
}
```

## 7. Validation

Run:

1. `GET /api/dhis2/sync-status` with tenant context.
2. `POST /api/dhis2/sync/patients` with tenant context.
3. Confirm TEIs in DHIS2 under tenant org unit.

## 8. Security Notes

- Do not commit PAT values to git.
- Prefer tenant-specific PATs over shared tokens.
- For production, restrict token IPs to backend egress addresses and enforce trusted proxy header handling.
