# MediCore Architecture Reference

Last updated: 2026-05-11
Last verified: 2026-05-11 (PP-S21–PP-S25 verified 67/67 criteria, committed 2f68ade7)

This document contains the architecture rules, DB provisioning patterns, and agent constraints that apply to all work on this codebase. Read it before editing any file.

---

## Completed Sprints

Sprints S01–S20 are fully implemented and tested.

| Sprint | What was built |
|---|---|
| S01 | `countryCode` and locale defaults per tenant |
| S02 | Clinic / hospital / ministry deployment mode feature visibility |
| S03 | Rollout readiness dashboard in super-admin portal |
| S04 | CSV patient import with dry-run and duplicate detection |
| S05 | Dismissible role-based onboarding checklists in EHR frontend |
| S06 | Patient PRO questionnaire completion on mobile |
| S07 | SaaS billing enforcer — demo expiry, grace periods, payment confirmation, hourly cron |
| S08 | `TenantModuleRoute` route guard and sidebar filtering per deployment mode |
| S09 | CRVS civil registry birth/death transport and cross-facility referral with email fallback |
| S10 | Mobile i18n in 8 languages (en, fr, pt, sw, sn, zu, nd, af) with device-locale auto-detection |
| S11 | Africa's Talking SMS — 6 transactional triggers: grace period, suspension, demo expiry, 7-day warning, payment confirmed, PRO assigned, appointment booked. Gated by `SMS_ENABLED`. |
| S12 | Multi-provider payment gateway — Flutterwave, M-Pesa, ZimSwitch, Stripe. `IPaymentGateway` interface + factory. Webhook → auto billing extension. `payment_transactions` system table. |
| S13 | PRO completion — `ProInterpretationService` for 12 validated scales, clinician→patient feedback loop (`pro_clinician_feedback`), enhanced mobile result card with severity pill, `ProAlerts.tsx` "Reply to Patient" modal. |
| S14 | Telemedicine 10/10 — screen sharing enabled, patient consent enforced before joining (`checkConsent` in `getMeetingToken`), consent REST endpoints (`POST/GET /telemedicine/consultations/:id/consent`), WebSocket CORS hardened to `CORS_ORIGINS` env var. |
| S15 | Ambient/Whisper AI 10/10 — failed CDSS chunk retry queue (3× with backoff), `endSession()` auto-creates `post_visit_sessions` row with `source_type='in_person'` and `ambient_session_id` link. Completes the ambient → PostVisit handoff. |
| S16 | PostVisit AI 10/10 + full three-module integration — `PostVisitIngestionCronService` (every 2 min) polls captured sessions; ambient path uses stored transcript directly; telemedicine path downloads recording from MinIO and calls Whisper; both call `ingestTranscriptionResult()` → `draft_ready`. Mobile `PatientPostVisitScreen`. Feature-flagged via `FEATURE_POSTVISIT_INGESTION_CRON`. |
| S17 | Patient medication refill request + home nav fix — `requestRefill`/`getRefillRequests`/`cancelRefillRequest` in `prescriptions.ts`; "Request Refill" button and pending-refill badge in `MedDetailSheet`; load pending requests on mount; Messages tile added to `PatientHomeScreen` (5th grid item). i18n `meds.*` in 8 locales. |
| S18 | Medication adherence check-in (real API) — `logAdherence`/`getAdherenceSummary`/`getAdherenceLogs` in `prescriptions.ts`; `handleMark` wired to `POST /prescriptions/:id/adherence` with optimistic update and rollback; real 7-day adherence dot array from logs; real `adherencePct` from summary; `takenToday` checked against today's logs on mount. i18n `adherence.*` in 8 locales. |
| S19 | Localized health education screen — new `EducationService` (`education.ts`); new `PatientEducationScreen` with category tab strip, article FlatList, and HTML body in a WebView modal; registered as `PHEducation` in `PatientStackNavigator`; Education tile in `PatientHomeScreen` (6th item); locale passed as query param. i18n `education.*` + `nav.education` in 8 locales. |
| S20 | Caregiver / guardian access — new `PatientFamilyAccessScreen` with grant list, add-caregiver bottom-sheet form (name, email, phone, relationship, access level, expiry), and revoke confirmation; `getFamilyAccess`/`grantFamilyAccess`/`revokeFamilyAccess` in `patientPortal.ts`; registered as `PHFamilyAccess`; entry point added to `PatientHealthScreen` profile sub-tab. i18n `family.*` in 8 locales. |
| PP-S21 | Patient portal — Notifications Centre (`/notifications`): filter tabs (All/Unread/type), per-type icon gradients, mark-read/delete, load-more, bell "See all" link from dashboard, dashboard tile. |
| PP-S22 | Patient portal — Health Education browser (`/education`): 8-locale selector, 9 category tabs, article grid, detail modal with HTML body, deep-link `/education/:articleId`, `getEducationContent` + `getEducationArticle` in `api.ts`. |
| PP-S23 | Patient portal — Whisper AI voice input: `VoiceInputButton` component (MediaRecorder, idle/recording/processing/error states, 60s auto-stop); `POST /patient-portal/voice-transcribe` endpoint; wired into SymptomChecker, Messages, Vitals. |
| PP-S24 | Patient portal — Caregiver portal login: `password_hash` column provisioned on `patient_family_access` (repair-all applied); `POST caregiver/login` + `set-password` + `GET patient-summary` endpoints; `CaregiverAuthContext`, `CaregiverLoginPage` (pink/rose palette), `CaregiverDashboard` (read-only), invitation code sharing in `FamilyAccessPage`. |
| PP-S25 | Patient portal — Real `ResetPasswordPage` (Mode A: email request, Mode B: token + strength meter); all `/demo-clinic/` hardcoded fallback routes replaced with `/select-tenant` catch-all; dashboard `unreadMessages` wired to live API; "Forgot password?" link on LoginPage. JWT expiry enforcement in `PatientAuthContext` (decode exp on mount, 60s interval, 401 event dispatch). |

---

## System Layout

| Component | Path | Notes |
|---|---|---|
| Tenant service | `services/tenant-service/` | NestJS + TypeORM. Manages tenant lifecycle and billing. |
| EHR service | `services/ehr-service/` | NestJS. All clinical, operational, financial, and interoperability API. |
| CDSS service | `services/cdss-service/` | FastAPI (Python). Clinical decision support and AI. |
| Super-admin portal | `web-app/src/` | React + Tailwind. Pages in `web-app/src/pages/`. |
| EHR frontend | `ehr-frontend/src/` | React + Tailwind. Pages in `ehr-frontend/src/pages/`. |
| Mobile | `mobile/src/` | Expo React Native. API via `mobile/src/services/api.ts`. |

## Tenant Entity Facts

- File: `services/tenant-service/src/entities/tenant.entity.ts`
- Already has: `country: string` (default `'Zimbabwe'`), `enabledModules: string[]` (JSONB), `featureFlags: Record<string, boolean>` (JSONB), `deploymentMode: string`, `subscriptionState`, `billingEndsAt`, `graceEndsAt`, `autoDeleteAt`, `demoExpiresAt`.
- Extend these fields — do not add parallel fields.
- Valid module key strings (defined in `tenant.service.ts`): `finance`, `nurse_general`, `claims`, `hiv`, `maternity`, `radiology`, `oncology`, `cardiology`, `diabetes`, `pharmacy`, `laboratory`, `telemedicine`, `patient_portal`, `operating_room`, `emergency`, `ophthalmology`, `blood_bank`, `infection_control`, `revenue_cycle`, `population_health`.

## Adding Columns to the System `tenants` Table

Add an `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS …` inside `TenantService.ensureSubscriptionSchema()` in `services/tenant-service/src/services/tenant.service.ts`. This runs on every startup and is safe to re-run. Never write a raw migration file for system-table changes.

## Adding Tables to Per-Tenant Databases

Add a provisioning bundle to `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`. Each bundle needs: `id` (unique camelCase), `label`, `version` (`YYYY.MM.DD.N`), `description`, `statements: () => string[]`. Always use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. After adding, run `POST /admin-maintenance/tenants/repair-all` to backfill existing tenants.

## EHR Service Rules

- All controllers must be registered in `services/ehr-service/src/ehr.module.ts` in `controllers: []`.
- All clinical endpoints use `@UseGuards(JwtAuthGuard)`. `tenantId` comes from `X-Tenant-ID` header → `req.tenantId`. Tenant DB connection is at `req.tenantDb`.

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

## Stop Conditions

Stop and ask before:

- Changing JWT auth or tenant isolation logic.
- Changing billing calculations or subscription state machine.
- Changing clinical safety logic (drug interactions, CDSS hard-stops).
- Changing database provisioning scripts in ways that could drop or truncate data.
- Rewriting navigation from scratch in any app.
