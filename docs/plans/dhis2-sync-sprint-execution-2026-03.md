# DHIS2 Tenant Sync Sprint Execution (March 2026)

Status: Active (Sprint 4 in progress)
Start date: 2026-03-10
Target baseline: DHIS2 `2.40.0` local (`http://localhost:8888`)

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

## 4. Implementation Board (Current)

Completed:
1. `S1-T1` Add `tenant_dhis2_config` to master schema.
2. `S1-T2` Add `TenantService.getTenantDhis2Config(tenantIdentifier)`.
3. `S1-T3` Refactor DHIS2 service client creation per tenant + PAT support.
4. `S1-T4` Pass `tenantId` from controller to DHIS2 service methods.
5. `S2-T1` Add blank-instance DHIS2 metadata bootstrap script + runbook.
6. `S3-T1` Add idempotent patient sync mapping + tenant sync logs.

In progress (Sprint 4):
1. `S4-T1` Event push must resolve patient UUID -> DHIS2 TEI mapping (`dhis2_patient_mappings`).
2. `S4-T2` Aggregate push must use tenant org unit + dataset, with monthly service delivery metrics.
3. `S4-T3` Write event/aggregate/data-value outcomes into `dhis2_sync_log`.
4. `S4-T4` Expand `GET /dhis2/sync-status` to report per-tenant patient/event/data-value counters.
5. `S4-T5` Validate with build/tests before commit and push.

## 5. Validation Checklist

- [ ] PAT auth validated against local DHIS2 (`/api/me`).
- [ ] Tenant A and Tenant B write only to their own org units.
- [ ] No config => `not_configured` response, no DHIS2 writes.
- [ ] Build/test checks pass in touched services.
- [ ] Commit message references sprint task IDs.

## 6. Commit Strategy

Planned commits:
1. `feat(dhis2): add tenant dhis2 config schema + resolver`
2. `feat(dhis2): add PAT auth and tenant-scoped dhis2 client`
3. `docs(dhis2): add push reference and sprint execution board`

## 7. Immediate Next Action

Finish Sprint 4 acceptance checks with real tenant payloads:
- send one event linked to a synced patient TEI,
- send one aggregate/data-value push to tenant dataset,
- confirm counters in `GET /dhis2/sync-status`.
