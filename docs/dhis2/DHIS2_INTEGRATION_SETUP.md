# DHIS2 Integration Setup Guide (Tenant-Based)

Date: 2026-03-10  
Target: DHIS2 `2.40.0` (`d2 cluster up --port 8888`)

## 1. Objective

Configure MediCore so each tenant/clinic syncs to DHIS2 with its own:
- auth binding (PAT preferred),
- org unit,
- metadata mapping (tracked entity type, dataset).

## 2. PAT Generation (DHIS2 UI)

Path: `User Profile -> Personal Access Tokens -> Generate new token`

Use:
- Context: `Server/script context`
- Allowed HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Expiration: long-lived for local dev, shorter in production

### Allowed IP addresses (what to put)

- Local dev on your machine: leave it blank.
- Locked-down environment:
  - put exact backend egress IP(s), one per line,
  - include `127.0.0.1` only if backend reaches DHIS2 locally on loopback.
- Important: enforce `X-Forwarded-For` overwrite at proxy/load balancer, otherwise source IP checks are weak.

Store generated token in backend env as `DHIS2_PAT` or tenant config API input.

## 3. Environment Variables (Fallback Mode)

Per-tenant config is primary. These env vars are fallback/default when tenant config is absent:

```bash
DHIS2_URL=http://host.docker.internal:8888
DHIS2_API_VERSION=40
DHIS2_PAT=your_dhis2_personal_access_token
DHIS2_ORG_UNIT=YOUR_ORG_UNIT_ID
DHIS2_TRACKED_ENTITY_TYPE=YOUR_TRACKED_ENTITY_TYPE_ID
DHIS2_DATASET_ID=YOUR_DATASET_ID
DHIS2_USE_MOCK=false
```

If EHR runs outside Docker, use `http://localhost:8888` instead.

PAT auth header used by integration:

```bash
Authorization: ApiToken <DHIS2_PAT>
```

## 4. Blank Instance Bootstrap

For a fresh DHIS2 instance, bootstrap minimum metadata:

```bash
DHIS2_URL=http://localhost:8888 \
DHIS2_API_VERSION=40 \
DHIS2_PAT=... \
DHIS2_CLINIC_CODE=clinic_a \
DHIS2_CLINIC_NAME="Clinic A" \
npm run dhis2:bootstrap
```

Script: `scripts/bootstrap-dhis2-metadata.mjs`  
Output file (default): `/tmp/dhis2-bootstrap-output.json`

Bootstrap creates/reuses:
- Organisation Unit (clinic code/name),
- Tracked Entity Type (`MC_TET_PATIENT`),
- Patient tracked entity attributes,
- Aggregate data elements,
- Monthly service delivery dataset.

See details: `docs/dhis2/BLANK_DHIS2_BOOTSTRAP.md`.

## 5. Tenant ↔ DHIS2 Link API

Tenant service endpoints (JWT-protected):

- `GET /api/tenants/:id/dhis2-config`
- `PUT /api/tenants/:id/dhis2-config`
- `DELETE /api/tenants/:id/dhis2-config`

`PUT` payload example:

```json
{
  "baseUrl": "http://host.docker.internal:8888",
  "apiVersion": "40",
  "authType": "pat",
  "pat": "d2pat_...",
  "orgUnitId": "DHIS2_ORG_UNIT_UID",
  "trackedEntityTypeId": "DHIS2_TET_UID",
  "datasetId": "DHIS2_DATASET_UID",
  "enabled": true
}
```

Secrets are not returned in full; PAT is masked in read responses.

## 6. Sync Endpoints (Tenant Scoped)

Use tenant context in request (e.g. `X-Tenant-Id`):

- `POST /api/dhis2/sync/patients`
- `GET /api/dhis2/sync-status`
- `GET /api/dhis2/sync-log`
- `POST /api/dhis2/retry-failed`
- `POST /api/dhis2/events`
- `POST /api/dhis2/reports/aggregate`

Behavior:
- if tenant config exists and enabled: push to that tenant’s DHIS2 org unit,
- if missing/disabled: return not configured / fallback behavior,
- patient sync is idempotent using tenant tables:
  - `dhis2_patient_mappings`
  - `dhis2_sync_log`

Event linkage note:
- For tracker events, `patientId` must already be mapped to a DHIS2 TEI via patient sync.
- `POST /api/dhis2/events` now resolves `patientId -> dhis2_patient_mappings.dhis2_tei_id`.
- If mapping is missing, event push returns an error instructing you to run patient sync first.

## 7. Ops Endpoints (Sprint 5)

### A) Sync log drilldown

`GET /api/dhis2/sync-log?status=error&entityType=event&limit=50&offset=0`

Returns:
- paged tenant-local `dhis2_sync_log` entries,
- summary counts grouped by entity type and status.

### B) Retry failed pushes

`POST /api/dhis2/retry-failed`

Body example:

```json
{
  "entityType": "event",
  "limit": 25,
  "dryRun": true
}
```

Behavior:
- replays failed logs in tenant scope only,
- requires `payload.request` in the failed log for automatic replay,
- supports entity types: `patient`, `event`, `aggregate`, `data_value_set`,
- `dryRun=true` returns what would be retried without pushing.

## 8. Troubleshooting

- `401 Unauthorized`: PAT invalid/expired or wrong header format.
- `403 Forbidden`: PAT lacks required authorities.
- `404 Not Found`: wrong API version or missing metadata IDs.
- `status=PARTIAL_SUCCESS`: some entities failed; inspect `dhis2_sync_log`.

## 9. References

- Data push reference: `docs/dhis2/DHIS2_DATA_PUSH_REFERENCE.md`
- Development plan: `docs/plans/dhis2-tenant-sync-development-plan.md`
- Sprint plan: `docs/plans/dhis2-sync-sprint-execution-2026-03.md`
