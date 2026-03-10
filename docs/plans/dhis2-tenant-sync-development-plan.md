# Medicore → DHIS2 Tenant-Based Sync — Development Plan

**Goal:** Sync Medicore clinic/tenant data to a blank DHIS2 instance (d2 cluster up 2.40.0 @ `http://localhost:8888`), with each tenant mapped to its own DHIS2 org unit and authentication via Personal Access Token (PAT).  
**Created:** 2026-03-10  
**DHIS2:** 2.40.0, local (port 8888)  
**Auth:** PAT from User Profile → Personal Access Tokens (Server/script context)

---

## 1. Current State

- **DHIS2:** Blank instance at `http://localhost:8888`. You are on the PAT creation page (`/dhis-web-user-profile/#/personalAccessTokens`). Token will have `F_TRACKED_ENTITY_INSTANCE_SEARCH_IN_ALL_ORGUNITS` (and optionally full CRUD via GET/POST/PUT/PATCH/DELETE).
- **Medicore:** Multi-tenant (database-per-tenant). Tenants identified by `X-Tenant-Id` (UUID or subdomain). EHR has `Dhis2Service` and `Dhis2Controller` with global env config (`DHIS2_URL`, `DHIS2_USERNAME`, `DHIS2_PASSWORD`) and **no per-tenant DHIS2 config or PAT support**.
- **Gap:** One global DHIS2 config; no link between “tenant login” (tenantId) and “DHIS2 instance/login” (per-tenant URL + PAT + org unit).

---

## 2. Target Architecture

- **One DHIS2 instance** (e.g. `http://localhost:8888`) used by multiple tenants.
- **Per tenant:** One DHIS2 **Organisation Unit** (OU) = one clinic. Each tenant has its own PAT (or shared instance user with different OUs).
- **Link:** Tenant ↔ DHIS2 = stored **per-tenant config**: base URL, PAT, org unit ID, tracked entity type, dataset/program IDs. When a request has `X-Tenant-Id`, the EHR uses that tenant’s DHIS2 config for all DHIS2 API calls.
- **Auth:** Use **Personal Access Token** in `Authorization` header (DHIS2 2.40 PAT). Prefer PAT over username/password for server/script integrations.

---

## 3. Immediate: Token Setup (You, in DHIS2 UI)

1. On the “Generate new token” modal (where you are now):
   - **Context:** Keep **“Server/script context”** (for Medicore backend).
   - **Expiration:** Set as needed (e.g. Custom → 01/01/2030 for dev).
   - **Allowed HTTP methods:** Enable at least GET, POST, PUT, PATCH, DELETE for sync (create/update TEIs, events, data values).
   - **Authorities:** Ensure `F_TRACKED_ENTITY_INSTANCE_SEARCH_IN_ALL_ORGUNITS`; add any needed for creating TEIs, events, and data value sets (e.g. org unit data write, program/tracked entity type write if you create metadata via API).
2. Click **“Generate new token”**, copy the token **once** (it won’t be shown again).
3. Store it securely; it will be used as `DHIS2_PAT` (or per-tenant PAT) in Medicore.

---

## 4. Sprint Overview

| Sprint | Focus | Outcomes |
|--------|--------|----------|
| **D1** | Tenant–DHIS2 link + PAT auth | Per-tenant DHIS2 config storage; Dhis2Service supports PAT; EHR uses config by `tenantId` |
| **D2** | Blank DHIS2 bootstrap + metadata | Doc/script for OU + TET + attributes + program/dataset so “blank” instance is ready for sync |
| **D3** | Patient → TEI sync (tenant-scoped) | Sync patients to DHIS2 as TEIs under tenant’s OU; store TEI ID for idempotent updates |
| **D4** | Events + aggregate reporting | Send program events and data value sets per tenant; sync status and basic error handling |
| **D5** | Admin UI + docs | Tenant DHIS2 config UI; runbook and env template |

---

## 5. Sprint D1 — Tenant–DHIS2 Link & PAT Auth

**Objective:** Each tenant has a DHIS2 config (URL, PAT, org unit, TET); EHR uses it for all DHIS2 calls and supports PAT authentication.

### 5.1 Tenant DHIS2 config storage

- **Option A (recommended):** New table in **master DB**: `tenant_dhis2_config`.
  - Columns: `tenant_id` (FK → tenants), `base_url`, `api_version`, `auth_type` (`pat` | `basic`), `pat` (encrypted or secret), `username`, `password` (nullable, for basic), `org_unit_id`, `tracked_entity_type_id`, `dataset_id` (optional), `enabled`, `created_at`, `updated_at`.
  - One row per tenant; unique on `tenant_id`.
- **Option B:** Add columns on `tenants`: e.g. `dhis2_base_url`, `dhis2_pat`, `dhis2_org_unit_id`, `dhis2_tracked_entity_type_id`, `dhis2_dataset_id`, `dhis2_enabled`. Simpler but mixes integration config with core tenant data.
- **Provisioning:** If tenant-service owns master schema, add migration/creation for `tenant_dhis2_config` (or new columns). EHR service only reads this config (via master DB or internal API).

### 5.2 EHR: Resolve config by tenant

- In **ehr-service**, ensure a way to read master DB (already done for tenant DB lookup). Add:
  - `getTenantDhis2Config(tenantId: string): Promise<TenantDhis2Config | null>`.
  - Return type: `{ baseUrl, apiVersion, authType, pat?, username?, password?, orgUnitId, trackedEntityTypeId, datasetId?, enabled }`.
  - If no config or `enabled === false`, DHIS2 calls for that tenant behave as “disabled” (e.g. return 200 with `sync: 'disabled'` or 404).

### 5.3 Dhis2Service: per-tenant client & PAT

- **Auth:** Support both PAT and Basic.
  - **PAT:** `Authorization: ApiToken <token>` (confirm in DHIS2 2.40 docs; may be `Bearer <token>` — verify once token is generated).
  - **Basic:** keep current `auth: { username, password }` for backward compatibility.
- **Per-tenant:** Do **not** hold a single global `dhis2Client`. For each request that needs DHIS2:
  - Resolve `tenantId` from request (e.g. `req.tenantId` set by tenant middleware).
  - Load `TenantDhis2Config` for that tenant.
  - Create an axios instance (or use a short-lived client) with that config: base URL, API version, and either PAT header or basic auth.
  - Use this client for all DHIS2 calls in that request (sync patients, events, data values, getPrograms, getSyncStatus, etc.).
- **Fallback:** If env still has global `DHIS2_URL` + `DHIS2_USERNAME`/`DHIS2_PASSWORD` or `DHIS2_PAT`, and tenant has no config, optionally fall back to global config for that tenant (document this as “default” for single-tenant or dev). Prefer explicit per-tenant config for multi-tenant.

### 5.4 Controller

- All DHIS2 controller methods already receive `req` with `tenantId` and `tenantDb`. Pass `tenantId` (and optionally `tenantDb` where needed) into `Dhis2Service` so it can call `getTenantDhis2Config(tenantId)` and build the client.

### 5.5 Acceptance criteria (D1)

- [ ] Master DB has `tenant_dhis2_config` (or extended tenants) and one row per tenant that uses DHIS2.
- [ ] EHR can return per-tenant DHIS2 config by `tenantId`.
- [ ] Dhis2Service uses PAT when `authType === 'pat'` and tenant config is present.
- [ ] Sync status / sync patients use tenant’s org unit and URL; no cross-tenant leakage.
- [ ] If tenant has no config or disabled, sync endpoints return a clear “DHIS2 not configured” style response.

---

## 6. Sprint D2 — Blank DHIS2 Bootstrap & Metadata

**Objective:** Blank DHIS2 at localhost:8888 has the minimal metadata so Medicore can create TEIs and events.

### 6.1 Metadata to create (in DHIS2 or via API)

- **Organisation Unit (OU):** One per Medicore tenant (e.g. “Clinic A”, “Clinic B”). Create via Maintenance → Organisation Units, or via API `POST /organisationUnits`. Store the returned `id` in `tenant_dhis2_config.org_unit_id`.
- **Tracked Entity Type (TET):** e.g. “Person” or “Patient”. Create if not present; use its ID in `tracked_entity_type_id`.
- **Tracked Entity Attributes:** Map to patient fields (first name, last name, DoB, gender, national ID). Create or reuse; note attribute IDs for mapping in Medicore (current code uses hardcoded IDs like `w75KJ2mc4zz` — these are example IDs; replace with your instance’s IDs).
- **Program (optional but recommended):** e.g. “Clinic Visits” or “HIV Care”, with at least one program stage and data elements for events.
- **Dataset (optional):** For aggregate reporting; link to org unit.

### 6.2 Deliverables

- **Document:** `docs/dhis2/BLANK_DHIS2_BOOTSTRAP.md` with steps (UI or API) to create one OU, one TET, attributes, one program, one dataset. Include sample payloads for API.
- **Optional script:** Node or curl script that creates minimal metadata using the PAT (e.g. create one test OU, one TET, attributes). Run once per new DHIS2 instance or per tenant OU.

### 6.3 Acceptance criteria (D2)

- [ ] Doc describes how to create OU, TET, attributes, program, dataset on a blank 2.40 instance.
- [ ] After following the doc, Medicore can use the created IDs in tenant config and sync (tested in D3).

---

## 7. Sprint D3 — Patient → TEI Sync (Tenant-Scoped)

**Objective:** Sync patients from a tenant’s DB to DHIS2 as Tracked Entity Instances under that tenant’s org unit; idempotent and traceable.

### 7.1 Patient → TEI mapping

- For each patient in `tenantDb` (e.g. active patients): map to DHIS2 TEI payload: `trackedEntityType`, `orgUnit` (from tenant config), `attributes` (first name, last name, DoB, gender, national ID). Use attribute IDs from tenant config or from bootstrap doc.
- **Idempotency:** Store DHIS2 TEI ID per patient. Options:
  - New column `patients.dhis2_tracked_entity_instance_id` (tenant DB), or
  - New table in tenant DB: `dhis2_sync_mapping` (`patient_id`, `dhis2_tei_id`, `last_synced_at`, `status`).
- If `dhis2_tei_id` exists, use **update** (DHIS2 API for TEI update) or “create or update” pattern; otherwise create new TEI and save the returned ID.

### 7.2 Sync flow

- `POST /dhis2/sync/patients` (existing): with `req.tenantId` and `req.tenantDb`.
  - Load tenant DHIS2 config; if missing or disabled, return 200 with `{ sync: 'disabled', reason: '...' }`.
  - Build per-tenant DHIS2 client (PAT or basic).
  - Fetch patients from `tenantDb`; for each, check existing TEI ID; create or update TEI in DHIS2; persist TEI ID in tenant DB.
  - Return counts: created, updated, failed, skipped.

### 7.3 Sync log (optional but recommended)

- In tenant DB: table `dhis2_sync_log` (e.g. `id`, `entity_type` = 'patient'|'event'|'aggregate', `entity_id`, `dhis2_id`, `action` = 'create'|'update', `status`, `error_message`, `synced_at`). Use for debugging and “last sync” reporting.

### 7.4 Acceptance criteria (D3)

- [ ] Syncing patients creates/updates TEIs in DHIS2 under the tenant’s org unit only.
- [ ] Tenant A’s patients never appear under Tenant B’s org unit.
- [ ] Re-running sync does not duplicate TEIs (idempotent).
- [ ] Sync status (or sync log) can report last sync time and counts per tenant.

---

## 8. Sprint D4 — Events & Aggregate Reporting

**Objective:** Send program events and data value sets to DHIS2 per tenant; improve error handling and sync status.

### 8.1 Events

- When a clinical event occurs (e.g. visit, lab result), optionally send an event to a DHIS2 program (program stage + data elements). Use tenant’s config for `orgUnit`, `program`, and DHIS2 client. Link event to TEI via stored `dhis2_tracked_entity_instance_id`.

### 8.2 Aggregate reports

- `POST /dhis2/reports/aggregate`: build payload from tenant’s `org_unit_id` and `dataset_id`; use tenant’s client. Period and data elements as already designed; ensure counts (e.g. consultations) come from `tenantDb`.

### 8.3 Sync status

- `GET /dhis2/sync-status`: use tenant’s client; return connection status, last sync time (from `dhis2_sync_log` or similar), and counts (patients synced, events sent, errors). If tenant has no config, return `{ status: 'not_configured' }`.

### 8.4 Acceptance criteria (D4)

- [ ] Events are sent to DHIS2 with correct org unit and program; linked to correct TEI.
- [ ] Aggregate report uses tenant’s org unit and dataset.
- [ ] Sync status reflects per-tenant state and last sync.

---

## 9. Sprint D5 — Admin UI & Documentation

**Objective:** Tenant admins can link their clinic to DHIS2; runbook and env template for PAT and bootstrap.

### 9.1 Tenant DHIS2 config UI

- In admin/settings (tenant-scoped): form to set DHIS2 Base URL, PAT (masked), Org Unit ID, Tracked Entity Type ID, Dataset ID (optional), Enable/Disable. Save to `tenant_dhis2_config` (or tenant columns). Only tenant admins can edit.
- **Security:** PAT stored encrypted or in a secrets manager; never log or expose in API responses (mask in UI).

### 9.2 Docs

- **Runbook:** How to generate a PAT in DHIS2 (Server/script context, expiry, methods, authorities); where to paste it (tenant config UI or env for single-tenant); how to create first OU and TET (link to `BLANK_DHIS2_BOOTSTRAP.md`).
- **Env template:** In `docs/dhis2/` or `.env.example`: `DHIS2_URL`, `DHIS2_PAT` (or username/password) for default/fallback; note that per-tenant config overrides when set.

### 9.3 Acceptance criteria (D5)

- [ ] Tenant admin can configure DHIS2 URL, PAT, OU, TET, dataset and enable/disable sync from UI.
- [ ] Runbook and env template document PAT setup and bootstrap; link tenant login (tenantId) to “DHIS2 login” (PAT + org unit).

---

## 10. Tenant Login ↔ DHIS2 “Login” Link (Summary)

- **Medicore tenant “login”:** User logs in with tenant context; API requests send `X-Tenant-Id` (and JWT). That identifies the clinic (tenant).
- **DHIS2 “login”:** For that tenant, Medicore uses the **stored config** for that `tenantId`: base URL + PAT (and org unit, TET, dataset). So “tenant login” in Medicore is **linked** to “DHIS2 instance/login” via the **tenant_dhis2_config** row (or tenant columns). No separate “DHIS2 login” by the user; the backend uses the PAT on behalf of that tenant.
- **Multi-tenant:** Each tenant can point to the same DHIS2 instance (e.g. localhost:8888) with different PAT and different org unit, or different instances; the link is always tenant → config → DHIS2.

---

## 11. Suggested Order of Work

1. **You:** Generate PAT in DHIS2 (Server/script, methods GET/POST/PUT/PATCH/DELETE, correct authorities). Save token.
2. **Dev:** Sprint D1 — add `tenant_dhis2_config`, wire PAT and per-tenant client in Dhis2Service, resolve config by `tenantId`.
3. **Dev:** Sprint D2 — write `BLANK_DHIS2_BOOTSTRAP.md` and optionally a small bootstrap script; create one test OU and TET in localhost:8888.
4. **Dev:** Sprint D3 — implement patient → TEI sync with tenant config and TEI ID storage; test with one tenant and one org unit.
5. **Dev:** Sprints D4 and D5 — events/aggregates and admin UI + docs.

---

## 12. File / Code Touchpoints

| Area | File(s) / location |
|------|---------------------|
| Tenant config storage | Master DB: `tenant_dhis2_config` table or `tenants` columns (tenant-service or shared migration). |
| Config resolution | ehr-service: new `TenantDhis2ConfigService` or extend `TenantService` to read DHIS2 config from master. |
| PAT + per-tenant client | `services/ehr-service/src/services/dhis2.service.ts`: accept `tenantId`/config, build axios with `Authorization: ApiToken <pat>`, use config’s baseUrl and org unit. |
| Controller | `services/ehr-service/src/controllers/dhis2.controller.ts`: pass `req.tenantId` into service methods. |
| Patient ↔ TEI | Tenant DB: `patients.dhis2_tracked_entity_instance_id` or `dhis2_sync_mapping`; provisioning in database-provisioning (tenant-service). |
| Sync log | Tenant DB: `dhis2_sync_log` table; provisioning. |
| Bootstrap doc | `docs/dhis2/BLANK_DHIS2_BOOTSTRAP.md`. |
| Setup doc | Update `docs/dhis2/DHIS2_INTEGRATION_SETUP.md` with PAT and per-tenant config. |
| Admin UI | ehr-frontend (or admin app): tenant settings → DHIS2 config form. |

---

## 13. DHIS2 2.40 PAT Note

- After generating the token, verify the exact header format in DHIS2 2.40 (e.g. `Authorization: ApiToken <token>` or `Authorization: Bearer <token>`). Use that in the axios client for PAT auth in D1.

This plan keeps sync **clinic/tenant-based**, links each **tenant login** to **DHIS2** via per-tenant config and PAT, and ensures everything necessary (patients, events, aggregates) is pushed to DHIS2 under the correct org unit per tenant.
