# MediCore Architecture Reference

Last updated: 2026-05-17
Last verified: 2026-05-17 (PP-S21–PP-S25 verified 67/67 criteria, committed 2f68ade7; NC-S01–NC-S16 sprint docs authored)

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

## Newlands Clinic Sprints (NC-S01 – NC-S15)

Sprint documents live in `docs/newlands-sprints/`. Each document contains the full DB provisioning bundle, backend service/controller code, frontend implementation, test stubs, and sign-off checklist for that sprint. Sign-off requires `npm run lint` + `npm test` + CI `build-and-test` all green, then `POST /api/admin/tenants/repair-all` to backfill new tables.

| Sprint | File | What it builds |
|---|---|---|
| NC-S01 | `NC-S01-baa-cdpa-compliance.md` | BAA vendor registry (system DB, 8 seeded vendors); CDPA 2021 per-tenant compliance table (18 controls seeded); `BaaRegistryController` in tenant-service; `CdpaController` in ehr-service; super-admin BAA page; EHR CDPA compliance page. |
| NC-S02 | `NC-S02-mfa-session-encryption.md` | TOTP 2FA via `speakeasy`; `MfaGuard` + `@SkipMfa()` decorator applied globally; `active_staff_sessions` + `emergency_access_log` per-tenant tables; idle session timeout middleware; AES-256-GCM encryption on `nationalId`, `phoneNumber`, `email` fields; tenant-level `mfaRequired`, `sessionTimeoutMinutes`, `allowEmergencyBypass` columns. |
| NC-S03 | `NC-S03-oi-hiv-geriatric-fasttrack.md` | OI early-warning rules (PCP/Cryptococcal/MAC/CMV/Toxo/TB by CD4 threshold); VACS Index 2.0 geriatric comorbidity score; HIV stable-patient fast-track classification; auto-flag on age ≥ 50; `oi_early_warning_alerts`, `hiv_geriatric_flags`, `hiv_stable_patient_flags` tables. |
| NC-S04 | `NC-S04-drug-resistance-regimen-mmd.md` | Drug resistance assessment; Zimbabwe national formulary regimen-switch engine (NNRTI→PI→NATC approval); VL trend classification; MMD scheduling (3-month suppressed, 6-month criteria); `hiv_resistance_assessments`, `hiv_regimen_switches`, `hiv_mmd_schedules`, `lab_import_audit` tables; NHLS HL7 range validation. |
| NC-S05 | `NC-S05-alhiv-disclosure-gbv.md` | Structured HIV disclosure records; TRAQ 6-domain adolescent transition assessment; HITS GBV screening (score ≥ 11 positive, ≥ 16 + weapon = imminent danger); role-restricted counsellor session notes; `PsychosocialController`; `PsychosocialTab.tsx` with 4 sub-tabs. |
| NC-S06 | `NC-S06-weep-meep-support-groups.md` | WEEP/MEEP economic empowerment programmes with enrolment, milestones, and economic outcome indicators; support groups with members, sessions, and attendance; `EmpowermentDashboard.tsx`; `SupportGroupsPage.tsx`. |
| NC-S07 | `NC-S07-training-platform.md` | NACHMC (40 CPD) and CERVICAL CANCER (24 CPD) courses seeded; MCQ assessment scoring with per-question feedback; certificate generation (`NEWLANDS-YYYY-XXXXXXXX`); CPD ledger; alumni deployment map; `TrainingDashboard.tsx` (6 tabs). |
| NC-S08 | `NC-S08-research-cohort-95-retention.md` | 95-95-95 cascade computation with sex/age disaggregation; LTFU definition (>90 days past expected visit); 6/12/24-month retention; re-engagement recording; SQL-injection-safe JSONB cohort builder with `ALLOWED_FIELDS` whitelist; `CascadeDashboard.tsx`, `RetentionDashboard.tsx`, `CohortBuilder.tsx`. |
| NC-S09 | `NC-S09-publication-analytics-research-day.md` | HIPAA Safe Harbor de-identification (18 PHI fields, 5-year age bands, YYYY-MM dates, age ≥ 90 → '90+'); Kaplan-Meier survival with Greenwood 95% CI; pharmacovigilance adverse event reporting (VigiBase-compatible, `NEWLANDS-AE-XXXXX` IDs); time-limited public Research Day portal (no JWT, token-gated). |
| NC-S10 | `NC-S10-ussd-adherence-nudges.md` | USSD state machine (appointment confirm, refill request, lab results, opt-out menus) via Africa's Talking webhook; Bull queue bulk SMS dispatch; Twilio provider failover; adherence nudge scheduler with Shona/Ndebele templates; `ussd_sessions`, `sms_campaigns`, `sms_dispatch_log`, `sms_opt_outs`, `adherence_nudge_schedules` tables. |
| NC-S11 | `NC-S11-shona-ndebele-localisation.md` | `react-i18next` + `i18next-http-backend` in patient portal and EHR frontend; embedded bundle in Expo mobile; complete English/ChiShona/IsiNdebele translation JSON files; `LanguageSelector` component; preference persisted to `patients.preferred_language`; PDF appointment letters and discharge summaries in patient's preferred language. |
| NC-S12 | `NC-S12-breach-detection-disaster-recovery.md` | 5-rule breach detection engine (bulk download >200/h, brute-force login >10/5 min, after-hours sensitive access, audit log sequence gaps, unauthorised bulk export); SHA-256 hash-chained audit log for tamper detection; encrypted `pg_dump` + S3 upload with checksum verification; POTRAZ 72-hour breach notification workflow (CDPA 2021 Art. 43) with overdue tracking; `breach_incidents`, `backup_jobs`, `anomaly_events` tables. |
| NC-S13 | `NC-S13-grafana-clinical-monitoring-offline-first.md` | Grafana + Prometheus added to `docker-compose.yml`; 5 provisioned dashboards (95-95-95, LTFU/retention, OI alerts, MMD adherence, security anomalies); conflict resolver upgraded from stub to field-level Last-Write-Wins merge; offline entity coverage expanded to `hiv_clinical_visits`, `hiv_counselling_sessions`, `gbv_assessments`, `disclosure_records`, `alhiv_transition_assessments`, `counsellor_sessions`; real-time OI/anomaly/MMD alert badge counts in EHR sidebar. |
| NC-S14 | `NC-S14-dental-anc-hiv-paediatric-growth.md` | Dental module: FDI 32-tooth chart, perio charting (6-point per tooth), treatment plans; ANC HIV+ PMTCT pathway: EDD calculation, VL ≥ 36 weeks MTR flag, NVP prophylaxis tracking; EID schedule (6w/4m/12m/18m) with positive result → immediate ART flag; WHO LMS z-score growth charts (WAZ/HAZ/WHZ/BAZ) with malnutrition categorisation and nutrition referral trigger (WAZ < −2); Zimbabwe MOHCC paediatric weight-band ART dosing table with band-change detection. |
| NC-S15 | `NC-S15-alumni-network-mfa-extensions-final.md` | Alumni network searchable directory with CSV export and facility map; WebAuthn/FIDO2 hardware token MFA via `@simplewebauthn/server` alongside existing TOTP; per-patient CDPA consent records with withdrawal tracking and expiry alerts; telemedicine pre-consultation form → EHR clinical visit draft bridge (`teleconsult_ehr_links`); `RolesGuard` with 9-tier role matrix (`super_admin`→`researcher`); Jest coverage thresholds (branches 70%, lines/functions 75%); pre-push lint hook via Husky; CI `test:ci` script. |
| NC-S16 | `NC-S16-patient-portal-mobile-feature-completion.md` | Patient portal: `PatientPortalHivController` with 11 `PatientJwtAuthGuard`-protected endpoints covering MMD schedule/refill, support groups, communication preferences (per-nudge toggles + global SMS opt-out), ANC/EID tracker with computed timepoint status, growth history, dental treatment plan, and `GET /patient-portal/my-flags` for conditional navigation; 5 new portal pages (`SupportGroupsPage`, `CommunicationPreferencesPage`, `AncEidTrackerPage`, `GrowthChartPage`, `DentalSummaryPage`); MMD block added to `MedicationsPage`; `recharts` WAZ line chart with WHO reference lines; conditional navbar items gated on patient flags; 10 new API functions in `api.ts`. Mobile: `GrowthMeasurementScreen` (z-score form + referral alert) and `MmdScheduleScreen` (pickup countdown + schedule history) registered in `PatientStackNavigator`. EN/SN/ND translation keys added for all new strings. `patient_portal_visible` column added to `anc_registrations` and `eid_schedules`. |

### Newlands Clinic DB Provisioning Bundles

All NC sprint tables are provisioned via bundles in `getProvisioningBundles()` in `services/ehr-service/src/services/database-provisioning.service.ts`. Bundle IDs:

| Bundle ID | Sprint |
|---|---|
| `nc_cdpa_compliance` | NC-S01 |
| `nc_session_management` | NC-S02 |
| `nc_oi_geriatric_fasttrack` | NC-S03 |
| `nc_resistance_mmd` | NC-S04 |
| `nc_alhiv_disclosure_gbv` | NC-S05 |
| `nc_empowerment_support_groups` | NC-S06 |
| `nc_training_platform` | NC-S07 |
| `nc_research_platform` | NC-S08 |
| `nc_publication_research_day` | NC-S09 |
| `nc_ussd_campaigns` | NC-S10 |
| `nc_offline_hardening` | NC-S13 |
| `nc_breach_detection` | NC-S12 |
| `nc_dental_anc_paediatric` | NC-S14 |
| `nc_alumni_consent_webauthn` | NC-S15 |

NC-S11 (localisation) adds only `staff.preferred_language` column via `ensureSubscriptionSchema()` — no per-tenant bundle.

NC-S16 (patient portal / mobile) adds only `patient_portal_visible BOOLEAN DEFAULT true` to `anc_registrations` and `eid_schedules` via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in the existing `nc_dental_anc_paediatric` bundle — no new bundle ID.

HE-S01 (patient health education) adds bundle `patient_health_education` (10 tables, 7 indexes) and `staff.is_health_educator BOOLEAN DEFAULT false` via `ensureSubscriptionSchema()`.

### Newlands Clinic New Controllers

Every controller below must appear in `controllers: []` in `services/ehr-service/src/ehr.module.ts`:

| Controller | Sprint | Route prefix |
|---|---|---|
| `CdpaController` | NC-S01 | `/cdpa` |
| `PsychosocialController` | NC-S05 | `/psychosocial` |
| `EmpowermentController` | NC-S06 | `/empowerment` |
| `TrainingController` | NC-S07 | `/training` |
| `ResearchController` | NC-S08 | `/research` |
| `ResearchDayController` | NC-S09 | `/research-day` |
| `UssdController` | NC-S10 | `/ussd` |
| `SmsCampaignController` | NC-S10 | `/sms` |
| `PreferencesController` | NC-S11 | `/preferences` |
| `BreachDetectionController` | NC-S12 | `/security` |
| `SyncController` | NC-S13 | `/sync` |
| `ClinicalSpecialtiesController` | NC-S14 | `/clinical` |
| `WebAuthnController` | NC-S15 | `/auth/webauthn` |
| `ConsentController` | NC-S15 | `/consent` |
| `PatientPortalHivController` | NC-S16 | `/patient-portal` |
| `HealthEducationController` | HE-S01 | `/health-education` |
| `PatientPortalHealthEducationController` | HE-S01 | `/patient-portal/education` |

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
