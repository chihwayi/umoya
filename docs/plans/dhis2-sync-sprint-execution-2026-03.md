# DHIS2 Tenant Sync Sprint Execution (March 2026)

Status: Active (Sprint 6 complete; Sprint 7 ops hardening in progress)
Start date: 2026-03-10
Target baseline: DHIS2 `2.40.0` local UI (`http://localhost:8888`), container access (`http://host.docker.internal:8888`)

## 1. Sprint Goal

Deliver production-grade, tenant-scoped Medicore → DHIS2 sync with:
- tenant-to-DHIS2 credential/org-unit linking,
- PAT authentication support,
- tracker + aggregate payload contracts,
- repeatable provisioning-safe schema evolution,
- CI-level verification (build/tests) before commit/push.

## 2. Non-Negotiables

- All DB changes go through provisioning/schema files.
- No cross-tenant leakage.
- No write to DHIS2 when tenant config is absent/disabled.
- Build/tests pass before commit.

## 3. Sprint Breakdown

## Sprint 1: Tenant Auth + Config Foundation (now)

Scope:
- Add master DB table `tenant_dhis2_config`.
- Add tenant config resolver in EHR `TenantService`.
- Refactor `Dhis2Service` to support PAT (`Authorization: ApiToken <token>`) and per-tenant config.
- Thread `tenantId` from DHIS2 controller into service calls.

Acceptance:
- Per-request DHIS2 client uses tenant binding when present.
- PAT-only config works without username/password.
- Missing config returns explicit not-configured behavior.

## Sprint 2: Metadata Bootstrap + Mapping Registry

Scope:
- Add DHIS2 bootstrap/runbook for blank instances (OU/TET/attributes/program/dataset).
- Create mapping registry format for indicator code ↔ DHIS2 UID.

Acceptance:
- New blank DHIS2 can be prepared in <30 min from runbook.
- At least one tenant fully mapped end-to-end.

## Sprint 3: Tracker Patient Sync Hardening

Scope:
- Patient TEI create/update idempotency.
- Store TEI linkage in tenant DB.
- Sync logs with clear failure diagnostics.

Acceptance:
- Re-runs do not duplicate TEIs.
- Sync result includes created/updated/failed counts.

## Sprint 4: Aggregate Datasets v1

Scope:
- Implement monthly aggregate push for:
  - service delivery,
  - maternal/newborn,
  - HIV quality subset,
  - immunization counts.

Acceptance:
- DataValueSets post successfully per tenant org unit.
- Payloads reproducible from SQL.

## Sprint 5: Observability + Admin Controls

Scope:
- Tenant admin API/UI for DHIS2 config.
- Sync status endpoint with per-tenant metrics.
- Alerting for auth failures and sustained push errors.

Acceptance:
- Operators can see tenant-level health and retry safely.

## Sprint 6: High-Value Dataset Expansion

Scope:
- Implement aggregate profile pipelines for maternal/newborn, HIV monthly, immunization monthly, and pharmacy stock.
- Expand blank-DHIS2 bootstrap metadata so profile datasets and elements are available by code.
- Validate profile pushes against live DHIS2 tenant flow.

Acceptance:
- Profile pushes succeed via `POST /dhis2/reports/aggregate` using profile keys.
- Dataset/data-element resolution works by DHIS2 metadata codes.
- Build/tests pass and live validation is documented.

## 4. Implementation Board (Current)

Completed:
1. `S1-T1` Add `tenant_dhis2_config` to master schema.
2. `S1-T2` Add `TenantService.getTenantDhis2Config(tenantIdentifier)`.
3. `S1-T3` Refactor DHIS2 service client creation per tenant + PAT support.
4. `S1-T4` Pass `tenantId` from controller to DHIS2 service methods.
5. `S2-T1` Add blank-instance DHIS2 metadata bootstrap script + runbook.
6. `S3-T1` Add idempotent patient sync mapping + tenant sync logs.

Completed (Sprint 4):
1. `S4-T1` Event push must resolve patient UUID -> DHIS2 TEI mapping (`dhis2_patient_mappings`).
2. `S4-T2` Aggregate push must use tenant org unit + dataset, with monthly service delivery metrics.
3. `S4-T3` Write event/aggregate/data-value outcomes into `dhis2_sync_log`.
4. `S4-T4` Expand `GET /dhis2/sync-status` to report per-tenant patient/event/data-value counters.
5. `S4-T5` Validate with build/tests before commit and push.
6. `S4-T6` Auto-enroll TEI for `WITH_REGISTRATION` programs before tracker event push.
7. `S4-T7` Resolve patient tracked-entity attribute IDs by DHIS2 codes (`MC_ATTR_*`) with env/legacy fallback.
8. `S4-T8` Retry aggregate push with DHIS2 latest open future period when current period is rejected (`E7641`).

## 5. Validation Checklist

- [x] PAT auth validated against local DHIS2 (`/api/me`).
- [x] Tenant A and Tenant B write only to their own org units.
- [x] No config => `not_configured` response, no DHIS2 writes.
- [x] Build/test checks pass in touched services.
- [x] Commit message references sprint task IDs.

## 6. Commit Strategy

Planned commits:
1. `feat(dhis2): add tenant dhis2 config schema + resolver`
2. `feat(dhis2): add PAT auth and tenant-scoped dhis2 client`
3. `docs(dhis2): add push reference and sprint execution board`

In progress (Sprint 5):
1. `S5-T1` Add tenant-level sync log drilldown and replay controls. (complete)
2. `S5-T2` Add scheduled tenant sync orchestration with safe defaults. (complete, feature-flagged by `DHIS2_SCHEDULED_SYNC_ENABLED`)
3. `S5-T3` Validate multi-tenant org-unit isolation with at least two tenants. (complete)
4. `S5-T4` Add alerting hooks for sustained DHIS2 auth/push failures. (complete, optional webhook)
5. `S5-T5` Add per-tenant scheduler controls in `tenant_dhis2_config` (`scheduledSyncEnabled`, retry/alert fields) and wire scheduler to tenant config. (complete)
6. `S5-T6` Apply master schema migration + run tenant repair across all provisioned tenant DBs. (complete)

Completed (Sprint 6):
1. `S6-T1` Add aggregate profile engine for `maternal_newborn`, `hiv_monthly`, `immunization_monthly`, `pharmacy_stock`.
2. `S6-T2` Add dataset/data-element resolution by DHIS2 metadata code for profile pushes.
3. `S6-T3` Expand bootstrap metadata for all aggregate datasets and elements.
4. `S6-T4` Validate profile pushes live against DHIS2 2.40.0.

## 7. Immediate Next Action

Start next execution block:
- add scheduler frequency override support (per-tenant cadence windows),
- widen profile QA with denominator/coverage-specific validation rules,
- add role-based guardrails and audit trail for manual run-now operations.

Completed (Sprint 7):
1. `S7-T1` Add Slack/PagerDuty alert sink support to scheduler alerting.
2. `S7-T2` Add tenant-scoped manual run-now endpoint and admin UI trigger.
