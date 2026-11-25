# R0 Drift Analysis (S-003 root cause + every "live 500" explained)

Method: repo's own auditors (`scripts/audit-tenant-provisioning.mjs`,
`audit-migration-sequence.mjs`, `audit-tenant-fk-drift.mjs`) plus targeted
code↔bundle diffs for each audit "live 500". All paths below are the R0 HEAD
(`0429ada7`).

## 1. Machine-verified drift (no judgment involved)

- **Entity↔bundle columns:** 441 entity tables, 0 missing tables, **7 tables
  with entity columns absent from the bundle** (`audit-tenant-provisioning`,
  exit 1): `patients` (confidentiality_tier, deceased_at, vip_flag),
  `post_visit_sessions` (ambient_session_id), `readmission_predictions`
  (readmission_30_day_risk), `fhir_ingestion_logs`/`iot_data_ingestions`/
  `iot_device_registrations` (created_at et al.), `vaccine_inventory`
  (7 columns).
- **FK type drift:** 6 TEXT foreign keys pointing at UUID primary keys
  (`audit-tenant-fk-drift`, 6 mismatches): PatientFamilyHistory/
  PatientMedicalHistory/PatientSocialHistory `.patient_id`, PatientWristband
  `.patient_id/.issued_by/.deactivated_by`. Explains the `invalid input
  syntax for type uuid` live errors.
- **Migrations:** 59 files, sequential 001–059, no gaps
  (`audit-migration-sequence` ✓). Relationship between `database/migrations/`
  and the bundle patch list is undocumented — R1 must establish which is
  authoritative per database (see §4).

## 2. Every audit "live 500" traced to one of four drift classes

**Class A — entity column never added to any bundle (fresh tenants broken).**
S-003: `Patient` entity declares `deceased_at`/`vip_flag`/`confidentiality_tier`
(`patient.entity.ts:158-164`); the bundle has zero mentions — any patient read
selecting them 500s on a fresh tenant.

**Class B — code references objects with no entity and no bundle entry
(entity↔bundle auditor is blind here).** P-003: `getFamilyPanel` queries
`diagnoses` (`household-risk.service.ts:83-96`) — no `CREATE TABLE diagnoses`
in the bundle. RES-007: `validateToken` selects `q.tenant_id`
(`research-portal.service.ts:88-94`) — `research_queries` has no `tenant_id`
(bundle line 8440). S-005: `getTenantSecurityPolicy` selects `mfaRequired`
(`tenant.service.ts`) — zero bundle hits; live log confirms the column does
not exist. Proposed R1 rule: **raw SQL is banned from referencing tables/
columns without a paired bundle statement; the CI check must parse raw SQL
too, not just entities.**

**Class C — raw SQL written against property names instead of physical
columns.** P-001: `redeemCheckinToken` selects `mrn`
(`checkin.service.ts:66`) — the column is `patient_number` (`mrn` is a
JS-only getter, `patient.entity.ts:255`). F-004: `getPatientEverything` raw
SQL uses camelCase `"patientId"`, `"recordDate"`, `type` (`fhir.service.ts`
~line 511) against snake_case `medical_records(patient_id, …)`. RES-003:
de-id export INSERTs `exported_by/cohort_name/purpose` into `deid_export_log`
whose schema is `requested_by/cohort_id/…` (bundle line 1091).
`getFamilyPanel` also selects `p.latest_risk_level` and joins
`p.household_id` — both exist only as `ADD COLUMN IF NOT EXISTS` patches
(bundle lines 4426/4660), so they fail on tenants whose patch application
stalled (see below).

**Class D — failed/partial bundle application.** The applier collects
per-statement errors and retries the bundle later (`database-provisioning.
service.ts:11841-11939`); version is stamped only on full success. A tenant
can therefore exist half-provisioned, and any Class-C-style query against a
not-yet-applied patch column 500s until the retry succeeds. R1 must add
alerting on `bundle.apply.failed` (currently event-only) and a provisioning
health gate.

**Confirmed NOT drift (code bugs, mapped to their own fixes):** I-015 MPI
precedence (`registration-ai.service.ts:52-69`), O-002 poison 400s, S-004
VARCHAR(50) vs ciphertext (bundle sizes verified: `id_number`/`phone`
VARCHAR(50) + encryption transformer at `patient.entity.ts:28` — needs widening
via FX-002, not a missing column).

## 3. Impact ranking (top 4)

1. **patients VIP columns (Class A)** — breaks *every* patient read on fresh
   tenants (S-003); masks S-001/IDOR re-tests behind 500s.
2. **`mrn`/virtual-getter raw SQL (Class C, P-001)** — QR check-in 100% broken;
   pattern recurs (F-004, RES-003) so the fix must be the CI rule, not one
   column.
3. **Blind-spot tables (Class B: diagnoses, tenant_id, mfaRequired)** — each is
   a live 500 with zero auditor coverage today.
4. **TEXT→UUID FK drift** — silent wrong-join/cast class across history and
   wristband tables (BCMA-adjacent: wristband reads).

## 4. Proposed single mechanism (R1 implements; this document specifies)

1. **One schema source of truth:** the versioned bundle list in
   `database-provisioning.service.ts` generates `database/migrations/` (or
   vice versa — R1 decides, documents, and deletes the loser path). Both
   existing in parallel with no documented precedence is how Class A happened.
2. **CI drift gate (fails on):** (a) entity column ∉ bundle; (b) raw-SQL
   table/column ∉ bundle (parse `FROM/INSERT INTO/UPDATE/JOIN` + selected
   identifiers in `*.service.ts`/`*.controller.ts`, same normalizer as the
   existing auditor); (c) FK type ≠ referenced PK type; (d) any `SELECT *`
   in a versioned API path (forces explicit columns); (e) master `tenants`
   columns ∉ master repair path.
3. **Provisioning health:** `bundle.apply.failed` → alert + tenant health
   endpoint reflects pending bundles; repair scripts retry to green.
4. Reuse, don't rewrite: extend `scripts/audit-tenant-provisioning.mjs` (it
   already extracts entities) with a raw-SQL pass and wire it into CI.
