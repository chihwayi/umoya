# Umoya Architecture Reference

Last updated: 2026-05-29

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
| `storeroom_core` | Central inventory: `inventory_locations`, `storeroom_catalog`, `location_stock`, `stock_movements`, `stock_transfers`, `transfer_items`, `stock_requests`, `request_items`, `consumption_records` |
| `storeroom_ai` | AI layer: `demand_forecasts`, `storeroom_anomaly_events`, `reorder_suggestions` |
| `storeroom_soft_lock` | `stock_reservations` — soft locks on prescription creation; auto-expire after 24 hours; partial indexes for active/prescription lookups |
| `storeroom_expiry_coldchain` | `requires_refrigeration` + `cold_chain_notes` on `storeroom_catalog`; `expiry_alert_sent_at` on `location_stock` |
| `storeroom_module_integration` | `location_subtype` on `inventory_locations`; `emergency_kit_items`; `is_arv`, `is_emergency_kit`, `is_chemo_component` flags on catalog; `chemo_regimen_components` |
| `storeroom_procurement` | `storeroom_suppliers`, `storeroom_purchase_orders`, `storeroom_po_items`; `preferred_supplier_id`, `reorder_level`, `reorder_quantity` on catalog |
| `storeroom_drug_substitution` | `atc_code`, `drug_class`, `category` on catalog; `drug_equivalents` mapping table |
| `clinical_conflict_safety` | `clinical_resolution_queue` (safety-critical sync conflict review queue); `sync_safety_fields` (per-field LWW vs queue strategy registry) |
| `qr_checkin` | `patient_checkin_tokens` (SHA-256 hashed one-time tokens); `actual_checkin_at`, `checkin_method` columns on `appointments` |
| `pre_visit_intake` | `pre_visit_intake_forms` (patient-completed demographics, symptoms, medications, allergies, consent, insurance before arrival) |
| `discharge_push` | `patient_discharge_documents` (PDF discharge papers in MinIO); `finalized_at`, `finalized_by`, `discharge_sent` columns on `encounters` |
| `wearable_sync` | `wearable_devices`, `wearable_readings` (append-only), `wearable_trend_alerts` (3-consecutive-abnormal AI detection) |
| `referral_tracking` | `referral_status_log` (audit trail), `referral_messages` (secure thread), `referral_webhook_keys` (SHA-256 receiving-facility API keys) |
| `pro_risk_loop` | `risk_outreach_tasks` (auto-created for high-risk patients); `latest_risk_score`, `latest_risk_level`, `risk_updated_at` cache columns on `patients` |
| `in_app_payment` | `patient_payment_transactions` (EcoCash/OneMoney/ZiG); `payment_status`, `paid_at`, `paid_via` columns on `invoices` |
| `queue_wait_time` | `clinic_queue` (daily queue with position and wait estimate); `queue_config` (configurable average consult duration) |
| `theatre_utilization` | `theatre_rooms`, `theatre_cases` (planned vs actual times, surgeon, cancellation reason), `theatre_config` |
| `csat_survey` | `csat_surveys` (SHA-256 token-gated CSAT/NPS/category ratings + free text, 48 h expiry) |
| `ward_round` | `ward_beds`, `inpatient_admissions`, `ward_round_notes` (structured SOAP), `ward_orders` (medication/lab/imaging/nursing) |
| `household_family_graph` | `household_groups`, `patient_family_links`; `household_id` on `patients`; `household_alerts` (infectious/genetic propagation) |
| `digital_consent` | `consent_form_templates` (procedure-specific risks/benefits), `consent_requests` (e-signature + PDF via pdfkit → MinIO) |
| `stock_transfer` | `stock_transfer_orders` (cross-facility transfer lifecycle); `min_stock_level`, `reorder_point` columns on `storeroom_items` |

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
| `StoreroomController` | `/storeroom` | Multi-location inventory, catalog, stock, transfers, requests, expiry/FEFO, emergency kits, ARV/chemo, procurement, AI intelligence (forecast, anomalies, reorder, expiry risk), drug substitution |
| `ConflictResolutionController` | `/conflict-queue` | Safety-critical sync conflict queue — list, resolve (keep server / keep client), patient-scoped view, badge count |
| `CheckinController` | `/checkin` | QR token generation, token redemption on nurse scan, today's waiting queue |
| `PreVisitIntakeController` | `/intake` | Token-gated pre-visit form fetch, patient submission, encounter sync, intake status badge |
| `DischargeController` | `/encounters/:id/discharge` | Finalise and push discharge documents to patient app |
| `PatientDischargeController` | `/patient/discharge-documents` | Patient portal discharge document list and presigned download URLs |
| `WearableController` | `/wearable` | Device registration, reading ingestion with auto-flagging, 7-day timeline, trend alert management |
| `ProRiskController` | `/risk` | High-risk patient list, per-patient score history, outreach task management |
| `InAppPaymentController` | `/payments/patient` | Patient-facing invoice list, EcoCash/OneMoney payment initiation, transaction status polling |
| `QueueController` | `/queue` | Enqueue patient, update status, real-time WebSocket broadcasts via QueueGateway |
| `TheatreController` | `/theatre` | Theatre room listing, case scheduling, day schedule (Gantt), utilisation metrics, case start/end/cancel |
| `CsatController` | `/csat` | Post-visit survey dispatch (SMS + push), token-gated survey fetch and submission, aggregate and per-clinician stats |
| `WardRoundController` | `/ward` | Inpatient census, admissions, bedside SOAP note save/load, order creation and retrieval |
| `HouseholdRiskController` | `/household` | Household creation and assignment, family linking, diagnosis propagation, alert management |
| `DigitalConsentController` | `/consent` | Consent request creation, token-gated form fetch, e-signature submission → PDF → MinIO, encounter consent status |
| `CrossFacilityStockController` | `/network/stock` | Cross-tenant stock level aggregation, AI rebalancing recommendations, transfer order lifecycle |

---

## EHR Service Rules

- All controllers must be registered in `services/ehr-service/src/ehr.module.ts` in `controllers: []`.
- Staff endpoints use `@UseGuards(JwtAuthGuard)`. `tenantId` from `X-Tenant-ID` header → `req.tenantId`. Tenant DB at `req.tenantDb`.
- Patient portal endpoints use `@UseGuards(PatientJwtAuthGuard)`. Patient identity at `req.patientId` — never `req.user.sub`.
- DB queries: `db.query(sql, params)` returns a plain array (not `{ rows }`). Use `rows[0] ?? null` for single-row semantics.
- No DatabaseService wrapper — inject `db: any` and call `db.query()` directly.
- No Bull queue inside `ehr-service`.

---

## CDSS Clinical Safety Governor

Deterministic patient-safety layer that overrides probabilistic AI output. Lives in
`services/cdss-service/clinical_safety.py` (pure, fully unit-tested in
`tests/test_clinical_safety.py`, gated in CI).

- `extract_vitals()` normalises raw vitals (parses `"195/115"` BP, glucose mg/dL→mmol/L when >45).
- Deterministic scorers: `compute_qsofa()`, `compute_sirs()`, `screen_dka_hhs()` (ADA-correct),
  `severe_pain()`, `critical_flags()` (SpO2<90, SBP>180, DBP>120, RR>24, HR>130, temp≥39.5).
- `evaluate()` returns acute state (`ACUTE_DETERIORATION`/`STABLE`), aggregate severity,
  `syndrome_alerts`, `mortality_risk` (NEWS2/RCP-2017 band), labelled `risk_domains`
  (acute-deterioration vs mortality — never conflated with readmission), and a deterministic
  `copilot_summary`.
- `apply_safety_governor(response_data, vitals)` — wired into `POST /risk/calculate`: when the
  patient is acutely deteriorating it forces `risk_level='critical'`, sets
  `risk_model_conflict=true`, suppresses the readmission/discharge assessment, and replaces
  recommendations with escalation guidance + a `governor_banner`. **This is the contract: AI
  risk output must never present "low/discharge" for a patient flagged acute.**
- `POST /clinical/safety-eval` exposes `evaluate()` directly; surfaced on web
  (`VitalsPanel.tsx`) and mobile (`NurseVitalsScreen.tsx`) via the shared `/cdss/safety-eval`
  proxy. Copilot "Accept" is interlocked (disabled until rationale entered) during acute states.

---

## Clinical LLM Backend

Pluggable LLM provider in `services/ehr-service/src/services/clinical-llm.service.ts`, selected
by `CLINICAL_LLM_BACKEND` = `ollama` | `aws_bedrock` | `anthropic` | `azure_openai` (env vars in
`.env.example`). Default local dev = **Ollama** (`llama3.1:latest` on the host). HIPAA-eligible
production = **AWS Bedrock** (Claude 3.5 Sonnet).

**Bedrock auth is credential-free where possible** — use an EC2 instance role, or a `~/.aws`
profile that assumes the scoped role; never hardcode `AWS_ACCESS_KEY_ID`/`SECRET` in code or
`.env`. The IAM policy is least-privilege (Bedrock `InvokeModel` on the one model ARN only).

Reference resources (account `505887203685`, `us-east-1`):

| Resource | ARN / name |
|---|---|
| IAM role | `arn:aws:iam::505887203685:role/hipaa-ehr-bedrock-role` |
| IAM policy | `hipaa-ehr-bedrock-policy` (Bedrock `InvokeModel` only) |
| Model | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| KMS CMK | `arn:aws:kms:us-east-1:505887203685:key/2fbea39a-67ad-4f11-a459-e7707e33b34f` |

**Production HIPAA controls still OPEN before go-live** (BAA, KMS-at-rest, TLS, least-privilege
IAM, and role-based auth are already in place):

- Disable root account access keys; enable MFA on root.
- Enable CloudTrail audit logging.
- Use VPC PrivateLink endpoints for Bedrock (set `BEDROCK_ENDPOINT_URL`).
- Implement PHI de-identification in the prompt layer before sending to any external model.
- Recreate the KMS CMK for production; rotate deploy credentials every 90 days.

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
