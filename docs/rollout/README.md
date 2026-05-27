# MediCore Architecture Reference

Last updated: 2026-05-27

This document contains the architecture rules, DB provisioning patterns, and agent constraints that apply to all work on this codebase. Read it before editing any file.

---

## System Layout

| Component | Path | Notes |
|---|---|---|
| Tenant service | `services/tenant-service/` | NestJS + TypeORM. Manages tenant lifecycle and billing. |
| EHR service | `services/ehr-service/` | NestJS. All clinical, operational, financial, and interoperability API. |
| CDSS service | `services/cdss-service/` | FastAPI (Python). Clinical decision support and AI. |
| Super-admin portal | `web-app/src/` | React + Tailwind. Pages in `web-app/src/pages/`. |
| EHR frontend | `ehr-frontend/src/` | React + Tailwind. Pages in `ehr-frontend/src/pages/`. |
| Patient portal | `patient-portal/src/` | React + Tailwind. Auth via `PatientAuthContext`. Routes under `/:tenantSlug/`. |
| Mobile | `mobile/src/` | Expo React Native. API via `mobile/src/services/api.ts`. |

---

## Tenant Entity Facts

- File: `services/tenant-service/src/entities/tenant.entity.ts`
- Already has: `country: string` (default `'Zimbabwe'`), `enabledModules: string[]` (JSONB), `featureFlags: Record<string, boolean>` (JSONB), `deploymentMode: string`, `subscriptionState`, `billingEndsAt`, `graceEndsAt`, `autoDeleteAt`, `demoExpiresAt`.
- Extend these fields — do not add parallel fields.
- Valid module key strings (defined in `tenant.service.ts`): `finance`, `nurse_general`, `claims`, `hiv`, `maternity`, `radiology`, `oncology`, `cardiology`, `diabetes`, `pharmacy`, `laboratory`, `telemedicine`, `patient_portal`, `operating_room`, `emergency`, `ophthalmology`, `blood_bank`, `infection_control`, `revenue_cycle`, `population_health`.

---

## Adding Columns to the System `tenants` Table

Add an `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS …` inside `TenantService.ensureSubscriptionSchema()` in `services/tenant-service/src/services/tenant.service.ts`. This runs on every startup and is safe to re-run. Never write a raw migration file for system-table changes.

---

## Adding Tables to Per-Tenant Databases

Add a provisioning bundle to `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`. Each bundle needs: `id` (unique camelCase), `label`, `version` (`YYYY.MM.DD.N`), `description`, `statements: () => string[]`. Always use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. After adding, run `POST /admin-maintenance/tenants/repair-all` to backfill existing tenants.

---

## DB Provisioning Bundles (all tenants)

| Bundle ID | What it creates |
|---|---|
| `nc_cdpa_compliance` | CDPA 2021 18-control register + consent records |
| `nc_session_management` | Active sessions, emergency access log, AES column encryption |
| `nc_oi_geriatric_fasttrack` | OI early-warning alerts, geriatric flags, stable fast-track flags |
| `nc_resistance_mmd` | Drug resistance assessments, regimen switches, MMD schedules, lab import audit |
| `nc_alhiv_disclosure_gbv` | Disclosure records, adolescent transition assessments, GBV screenings, counsellor sessions |
| `nc_empowerment_support_groups` | WEEP/MEEP programmes, support groups, group sessions, attendance |
| `nc_training_platform` | CPD courses, modules, MCQ questions, attempts, certificates, CPD ledger, alumni |
| `nc_research_platform` | Cohort queries, retention snapshots |
| `nc_publication_research_day` | Adverse event reports, research portal tokens |
| `nc_ussd_campaigns` | USSD sessions, SMS campaigns, dispatch log, opt-outs, nudge schedules |
| `nc_breach_detection` | Anomaly events, breach incidents, backup jobs |
| `nc_offline_hardening` | Offline sync queue, conflict log |
| `nc_dental_anc_paediatric` | Dental chart + treatment plans, ANC registrations, EID schedules, growth measurements |
| `nc_alumni_consent_webauthn` | WebAuthn credentials, teleconsult-EHR links |
| `patient_health_education` | 10 education tables: courses, modules, lessons, translations, quizzes, questions, options, enrollments, lesson progress, quiz attempts |

### System-level column additions (via `ensureSubscriptionSchema()`)

- `staff.preferred_language` — staff UI language preference
- `staff.is_health_educator` — grants access to health education authoring

---

## Registered Controllers (`services/ehr-service/src/ehr.module.ts`)

Every controller must appear in `controllers: []`.

| Controller | Route prefix | Notes |
|---|---|---|
| `CdpaController` | `/cdpa` | CDPA compliance |
| `PsychosocialController` | `/psychosocial` | Adolescent HIV, GBV, disclosure |
| `EmpowermentController` | `/empowerment` | WEEP/MEEP, support groups |
| `TrainingController` | `/training` | CPD courses and certificates |
| `ResearchController` | `/research` | Cascade, retention, cohorts |
| `ResearchDayController` | `/research-day` | De-identified public portal |
| `UssdController` | `/ussd` | Africa's Talking USSD webhook |
| `SmsCampaignController` | `/sms` | Bulk SMS campaigns |
| `PreferencesController` | `/preferences` | Language and communication prefs |
| `BreachDetectionController` | `/security` | Anomaly detection, breach lifecycle |
| `SyncController` | `/sync` | Offline conflict resolution |
| `ClinicalSpecialtiesController` | `/clinical` | Dental, growth, ANC/EID |
| `WebAuthnController` | `/auth/webauthn` | FIDO2 hardware token MFA |
| `ConsentController` | `/consent` | CDPA per-patient consent records |
| `PatientPortalHivController` | `/patient-portal` | MMD, support groups, comms prefs, ANC/EID, growth, dental, flags |
| `HealthEducationController` | `/health-education` | Staff course authoring (requires `is_health_educator`) |
| `PatientPortalHealthEducationController` | `/patient-portal/education` | Patient course enrollment and progress |

---

## EHR Service Rules

- All controllers must be registered in `services/ehr-service/src/ehr.module.ts` in `controllers: []`.
- Staff endpoints use `@UseGuards(JwtAuthGuard)`. `tenantId` from `X-Tenant-ID` header → `req.tenantId`. Tenant DB at `req.tenantDb`.
- Patient portal endpoints use `@UseGuards(PatientJwtAuthGuard)`. Patient identity at `req.patientId` — never `req.user.sub`.
- DB queries: `db.query(sql, params)` returns a plain array (not `{ rows }`). Use `rows[0] ?? null` for single-row semantics.
- No DatabaseService wrapper — inject `db: any` and call `db.query()` directly.
- No Bull queue inside `ehr-service`.

---

## Patient Portal Rules

- All protected routes require `PatientJwtAuthGuard`.
- `PatientJwtAuthGuard` sets `request.patientId = tokenType === 'caregiver' ? user.patientId : user.sub`.
- Every patient DB query must filter by `patient_id`.
- API client in `patient-portal/src/services/api.ts` uses `patientPortalApi` pattern with `(token, tenantSlug)` params.
- Routes follow `/:tenantSlug/<resource>` pattern under `<ProtectedRoute requireLinked>`.
- i18n: 8 locale files under `patient-portal/public/locales/{en,sn,nd,pt,fr,sw,zu,af}/translation.json`.

---

## Mobile Rules

- Use the existing `api` client in `mobile/src/services/api.ts`. Do not create a new Axios instance.
- i18n: `mobile/src/i18n/index.ts`. Add new translation keys to all 8 locale files under `mobile/src/i18n/locales/`.
- Offline queue: `mobile/src/services/offlineQueue.ts`. Offline cache: `mobile/src/services/offlineCache.ts`.

---

## Rules For All Agents

- Never delete existing modules, routes, or navigation items.
- Never rename existing TypeORM entities, columns, or API routes.
- Never add a NestJS controller without registering it in the module's `controllers: []`.
- Never add a new `tenants` table column without a safe migration in `ensureSubscriptionSchema()`.
- Never create a per-tenant table without a provisioning bundle in `getProvisioningBundles()`.
- Never use bare `CREATE TABLE` or `CREATE INDEX` — always use `IF NOT EXISTS` variants.
- Never expose PHI in admin or rollout views.
- Every new field on `Tenant` entity must also appear in `CreateTenantDto` and `UpdateTenantDto` as `@IsOptional()`.

---

## Stop Conditions

Stop and ask before:

- Changing JWT auth or tenant isolation logic.
- Changing billing calculations or subscription state machine.
- Changing clinical safety logic (drug interactions, CDSS hard-stops).
- Changing database provisioning scripts in ways that could drop or truncate data.
- Rewriting navigation from scratch in any app.
