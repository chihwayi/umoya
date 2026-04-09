# MediCore SADC Completion Sprints — S129 to S146
## Master Implementation Guide

**Created:** 2026-04-09
**Scope:** 18 sprints closing all critical SADC/Africa health system gaps
**Source:** docs/SADC_AFRICA_GAP_ANALYSIS.md

---

## Standing Rules — Apply to Every Sprint

These rules are non-negotiable and apply to every workstream in every sprint below.

### Database Changes
1. Every new table, column, index, or constraint MUST be provisioned through `DatabaseProvisioningService` first.
2. Create or extend a provisioning statements file in `services/tenant-service/src/generated/`.
3. Register the new bundle inside `DatabaseProvisioningService.getProvisioningBundles()`.
4. After provisioning, run the tenant repair endpoint so the change propagates to all existing tenant databases.
5. Query the actual database directly to confirm the schema change is present before moving on.

### Code Quality Gate — Before Every Commit
- `npm run lint` (or the workspace equivalent) must pass for all touched files.
- `npm run build` / `tsc --noEmit` must pass for all touched services/packages.
- `npm test -- --runInBand` must pass for all touched modules.
- No syntax errors, no TypeScript errors, no obvious runtime bugs in the changed path.

### No Mock Data
- If any `setTimeout`, hardcoded stub, `Math.random()` fake data, or placeholder array is found in touched code — remove it and wire it to the real endpoint.
- If the real endpoint does not exist, create it in this sprint before the frontend wires to it.
- `TODO`, `FIXME`, `mock`, `stub`, `fake`, `placeholder` comments in changed code are a block on committing.

### API Style
- All new backend routes follow existing controller/service/DTO/guard patterns.
- All new routes require `X-Tenant-ID` header and `Authorization: Bearer <jwt>`.
- No hardcoded URLs — always use `ConfigService` or env-backed clients.
- All CDSS calls route through the governed pathway (`CdssService.callGovernedJson()`).

---

## Sprint S129 — EPI / Immunization Registry

### Goal
Build a national EPI (Expanded Program on Immunization) schedule engine, child vaccination record, cold chain logging, defaulter tracing, AEFI recording, and DHIS2 Tracker EPI program write. This is mandatory for all 16 SADC states (GAVI performance metrics depend on it).

### Problems Being Solved
1. No structured vaccination record per child.
2. No national EPI schedule engine (BCG, OPV, DPV-HepB-Hib, PCV, Rotavirus, MCV, HPV — by age in days/weeks/months).
3. No cold chain temperature log per vaccine lot.
4. No defaulter tracing (children who missed a scheduled dose).
5. No AEFI (Adverse Event Following Immunization) recording.
6. No DHIS2 Tracker EPI program write (TEI enrollment + vaccination events).

### New Database Tables

```sql
-- Immunization schedule definitions (per country EPI programme)
CREATE TABLE IF NOT EXISTS epi_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(3) NOT NULL,
  vaccine_name VARCHAR(100) NOT NULL,
  dose_number INTEGER NOT NULL,
  due_age_days INTEGER NOT NULL,
  window_early_days INTEGER DEFAULT 0,
  window_late_days INTEGER DEFAULT 30,
  antigen_code VARCHAR(50),
  route VARCHAR(20),
  site VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Per-patient vaccination records
CREATE TABLE IF NOT EXISTS immunization_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  epi_schedule_id UUID REFERENCES epi_schedules(id),
  vaccine_name VARCHAR(100) NOT NULL,
  dose_number INTEGER NOT NULL,
  lot_number VARCHAR(50),
  manufacturer VARCHAR(100),
  expiry_date DATE,
  administered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  administered_by UUID,
  site VARCHAR(50),
  route VARCHAR(20),
  dose_ml NUMERIC(5,2),
  facility_id UUID,
  dhis2_event_uid VARCHAR(50),
  status VARCHAR(20) DEFAULT 'given' NOT NULL, -- given | missed | contraindicated
  contraindication_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Vaccine lot inventory and cold chain
CREATE TABLE IF NOT EXISTS vaccine_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number VARCHAR(50) NOT NULL,
  vaccine_name VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(100),
  expiry_date DATE NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  storage_location VARCHAR(100),
  min_temp_celsius NUMERIC(4,1) DEFAULT 2.0,
  max_temp_celsius NUMERIC(4,1) DEFAULT 8.0,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Cold chain temperature logs
CREATE TABLE IF NOT EXISTS cold_chain_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaccine_lot_id UUID REFERENCES vaccine_lots(id),
  storage_location VARCHAR(100) NOT NULL,
  temperature_celsius NUMERIC(4,1) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  recorded_by UUID,
  excursion_detected BOOLEAN DEFAULT false NOT NULL,
  excursion_action TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Adverse Events Following Immunization
CREATE TABLE IF NOT EXISTS aefi_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  immunization_record_id UUID REFERENCES immunization_records(id),
  event_type VARCHAR(100) NOT NULL,
  onset_date DATE NOT NULL,
  severity VARCHAR(20) NOT NULL, -- mild | moderate | severe | fatal
  outcome VARCHAR(50),
  description TEXT NOT NULL,
  hospitalized BOOLEAN DEFAULT false NOT NULL,
  reported_to_moh BOOLEAN DEFAULT false NOT NULL,
  moh_reference VARCHAR(50),
  reported_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- DHIS2 Tracker sync log for EPI
CREATE TABLE IF NOT EXISTS dhis2_tracker_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- patient | immunization | encounter
  entity_id UUID NOT NULL,
  dhis2_tei_uid VARCHAR(50),
  dhis2_enrollment_uid VARCHAR(50),
  dhis2_event_uid VARCHAR(50),
  program_uid VARCHAR(50),
  org_unit_uid VARCHAR(50),
  sync_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### Provisioning Bundle

File: `services/tenant-service/src/generated/tenant-epi-registry.statements.ts`

```typescript
export const TENANT_EPI_REGISTRY_BUNDLE_VERSION = '2026.04.09.1';
export const TENANT_EPI_REGISTRY_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS epi_schedules ( ... )`,
  `CREATE TABLE IF NOT EXISTS immunization_records ( ... )`,
  `CREATE TABLE IF NOT EXISTS vaccine_lots ( ... )`,
  `CREATE TABLE IF NOT EXISTS cold_chain_logs ( ... )`,
  `CREATE TABLE IF NOT EXISTS aefi_reports ( ... )`,
  `CREATE TABLE IF NOT EXISTS dhis2_tracker_sync_log ( ... )`,
  `CREATE INDEX IF NOT EXISTS idx_immunization_records_patient ON immunization_records(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_immunization_records_status ON immunization_records(status)`,
  `CREATE INDEX IF NOT EXISTS idx_dhis2_tracker_sync_log_entity ON dhis2_tracker_sync_log(entity_type, entity_id)`,
];
```

Register in `DatabaseProvisioningService.getProvisioningBundles()`:
```typescript
{
  id: 'epi-registry',
  label: 'EPI / Immunization Registry',
  version: TENANT_EPI_REGISTRY_BUNDLE_VERSION,
  statements: () => TENANT_EPI_REGISTRY_STATEMENTS,
}
```

After provisioning → run tenant repair → query `SELECT table_name FROM information_schema.tables WHERE table_name = 'immunization_records'` to confirm.

### Backend Workstreams

#### WS1 — EHR Service: Immunization Controller + Service

File: `services/ehr-service/src/controllers/immunization.controller.ts`

```
POST   /immunization/records               — Record a vaccine dose given
GET    /immunization/records/:patientId    — Get full vaccination history for patient
GET    /immunization/schedule/:patientId   — Get upcoming due dates for patient (based on DOB + country EPI schedule)
GET    /immunization/defaulters            — List patients who missed a due dose (paginated, by facility)
POST   /immunization/aefi                 — Report an AEFI event
GET    /immunization/aefi/:patientId       — Get AEFI history for patient
GET    /immunization/lots                  — List active vaccine lots
POST   /immunization/lots                  — Add a new vaccine lot
POST   /immunization/cold-chain           — Record a temperature log entry
GET    /immunization/cold-chain/excursions — List cold chain excursions in last 30 days
GET    /immunization/coverage             — Coverage rate by vaccine/facility for reporting period
```

No mocks. All data from `immunization_records`, `epi_schedules`, `vaccine_lots`, `cold_chain_logs`, `aefi_reports`.

Schedule calculation: `due_date = patient.date_of_birth + epi_schedules.due_age_days`.
Defaulter: patient where `due_date < TODAY` and no `immunization_records` row exists for that `epi_schedule_id`.

#### WS2 — CDSS Service: DHIS2 Tracker EPI Push

File: `services/cdss-service/services/dhis2_tracker.py`

```
POST /dhis2/tracker/enroll              — Enroll patient as DHIS2 TEI in EPI program
POST /dhis2/tracker/event               — Push a vaccination event to DHIS2 Tracker
GET  /dhis2/tracker/sync/status         — Get sync status for a patient
POST /dhis2/tracker/sync/batch          — Batch sync all pending immunization records
```

Real DHIS2 Tracker API:
- `POST {DHIS2_BASE_URL}/api/trackedEntityInstances` — enroll TEI
- `POST {DHIS2_BASE_URL}/api/events` — push program stage event
- Auth: `Authorization: Basic base64(DHIS2_USERNAME:DHIS2_PASSWORD)`
- Org unit UID from tenant config (not hardcoded)

Store `dhis2_tei_uid`, `dhis2_event_uid` back into `dhis2_tracker_sync_log`.

#### WS3 — Frontend: Immunization Dashboard

File: `ehr-frontend/src/pages/ImmunizationDashboard.tsx`

Sections:
- Patient vaccination card (all doses given, upcoming, missed)
- Defaulter list with patient name, vaccine, days overdue, contact details
- Cold chain status panel (current temp per fridge, last excursion)
- AEFI reporting form
- Coverage rate chart (bar, by vaccine, current month vs. target)
- DHIS2 sync status indicator

All data from real endpoints above. No hardcoded arrays. No `Math.random()` coverage values.

### Real External APIs
- **DHIS2 Tracker API** — `{DHIS2_BASE_URL}/api/trackedEntityInstances`, `/api/events`, `/api/enrollments`
- **DHIS2 Data Value Sets** — `/api/dataValueSets` for aggregate coverage reporting

### Verification Gates
```bash
npm run lint -w @medicore/ehr-service
npm run build -w @medicore/ehr-service
npm test -w @medicore/ehr-service -- --testPathPattern=immunization
npm run build -w medicore-ehr-frontend
npx tsc --noEmit -p ehr-frontend/tsconfig.json
```

### Done When
- Vaccination record can be created and retrieved per patient.
- EPI schedule shows upcoming doses based on real DOB + country schedule.
- Defaulter list populates from real DB queries (not hardcoded).
- Cold chain excursion alert fires when temp log exceeds range.
- DHIS2 Tracker push succeeds and stores `dhis2_tei_uid` in sync log.
- All provisioning statements applied and confirmed in actual DB.
- Lint, build, and tests pass.

---

## Sprint S130 — Outbreak Surveillance + Notifiable Disease Alerts

### Goal
Build a configurable notifiable disease alert system, automated MOH threshold alerts, SORMAS case notification export, IHR event notification, and contact tracing module for communicable disease outbreaks.

### Problems Being Solved
1. No per-country notifiable disease list.
2. No automated alert when case count exceeds MOH threshold.
3. No SORMAS integration for outbreak case export.
4. No IHR (International Health Regulations) event notification.
5. No contact tracing module linking index case to exposed contacts.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS notifiable_diseases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(3) NOT NULL,
  disease_name VARCHAR(100) NOT NULL,
  icd10_codes TEXT[] NOT NULL,
  alert_threshold INTEGER DEFAULT 1,
  alert_window_days INTEGER DEFAULT 7,
  report_within_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS outbreak_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  notifiable_disease_id UUID REFERENCES notifiable_diseases(id),
  diagnosis_date DATE NOT NULL,
  onset_date DATE,
  status VARCHAR(20) DEFAULT 'suspected' NOT NULL, -- suspected | probable | confirmed | discarded
  exposure_location TEXT,
  exposure_date DATE,
  case_classification VARCHAR(50),
  lab_result VARCHAR(50),
  outcome VARCHAR(20),
  reported_to_moh BOOLEAN DEFAULT false NOT NULL,
  moh_reference VARCHAR(50),
  sormas_case_uuid VARCHAR(50),
  reported_by UUID,
  facility_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_traces (
  id UUID PRIMARY KEY DEFAULT gen_encounters_uuid(),
  index_case_id UUID REFERENCES outbreak_cases(id),
  contact_patient_id UUID,
  contact_name VARCHAR(200),
  contact_phone VARCHAR(30),
  contact_relationship VARCHAR(50),
  exposure_date DATE,
  exposure_type VARCHAR(50),
  follow_up_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  follow_up_due_date DATE,
  last_follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS moh_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notifiable_disease_id UUID REFERENCES notifiable_diseases(id),
  alert_type VARCHAR(50) NOT NULL, -- threshold | single_case | ihr_event
  case_count INTEGER,
  window_start DATE,
  window_end DATE,
  alert_sent_at TIMESTAMP WITH TIME ZONE,
  recipient_email TEXT,
  ihr_event_id VARCHAR(50),
  acknowledged BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-outbreak-surveillance.statements.ts`, version `2026.04.09.2`.

### Backend Workstreams

#### WS1 — EHR Service: Outbreak Controller

```
POST   /outbreak/cases                        — Register a notifiable disease case
GET    /outbreak/cases                        — List cases (filter: disease, status, date range)
PATCH  /outbreak/cases/:id                    — Update case status/lab result/outcome
POST   /outbreak/cases/:id/contacts           — Add a contact trace to an index case
GET    /outbreak/cases/:id/contacts           — List contacts for an index case
PATCH  /outbreak/contacts/:id/follow-up       — Record follow-up on a contact
GET    /outbreak/dashboard                    — Epidemic curve + active alert summary
GET    /outbreak/notifiable-diseases          — List notifiable diseases for tenant country
POST   /outbreak/notifiable-diseases          — Add/update notifiable disease config (admin)
GET    /outbreak/alerts                       — List MOH alerts sent
POST   /outbreak/alerts/:id/acknowledge       — Acknowledge an MOH alert
```

Threshold check: after every new case insert, query case count for that disease in the last `alert_window_days`. If ≥ `alert_threshold`, create a `moh_alerts` row and send email via existing notification service.

#### WS2 — CDSS Service: SORMAS + IHR Integration

File: `services/cdss-service/services/sormas_client.py`

```
POST /outbreak/sormas/export/:caseId   — Export a case to SORMAS
GET  /outbreak/sormas/sync/status      — Sync status for SORMAS-exported cases
POST /outbreak/ihr/notify              — Submit IHR event notification
```

Real SORMAS API:
- `POST {SORMAS_BASE_URL}/api/cases` — create case in SORMAS
- Auth: `Authorization: Basic base64(SORMAS_USERNAME:SORMAS_PASSWORD)`
- Env vars: `SORMAS_BASE_URL`, `SORMAS_USERNAME`, `SORMAS_PASSWORD`, `SORMAS_REGION_UUID`, `SORMAS_DISTRICT_UUID`
- Store returned `sormas_case_uuid` back in `outbreak_cases`.

IHR Notification:
- Send structured email (or REST call if country IHR portal has API) with case details.
- No mock email — use existing `NotificationService` / `EmailService` in EHR service.

#### WS3 — Frontend: Outbreak Surveillance Dashboard

File: `ehr-frontend/src/pages/OutbreakDashboard.tsx`

Sections:
- Epidemic curve (bar chart by day, real data from `outbreak_cases`)
- Active alerts panel (MOH threshold breaches, with acknowledge button)
- Case linelist table (date, disease, status, outcome, SORMAS status)
- Contact tracing panel (index case → contacts, follow-up status)
- New case report form

No hardcoded disease lists — fetch from `GET /outbreak/notifiable-diseases`. No fake case counts.

### Real External APIs
- **SORMAS REST API** — `{SORMAS_BASE_URL}/api/cases`, `/api/contacts`
- **Existing EmailService** — for MOH alert emails
- **Africa CDC / WHO IHR** — structured email notification (no public API; use email + reference number)

### Done When
- Notifiable disease case can be registered and triggers threshold check.
- MOH alert email fires when threshold exceeded.
- SORMAS export creates real case in SORMAS and stores `sormas_case_uuid`.
- Contact tracing list populates from real DB rows.
- Epidemic curve renders from real `outbreak_cases` data.
- All provisioning confirmed in DB. Lint, build, tests pass.

---

## Sprint S131 — Mobile Money Payment Gateway

### Goal
Integrate M-Pesa Daraja API, MTN Mobile Money API, EcoCash API, Airtel Money API, and Flutterwave multi-country aggregator as payment methods in the billing module. Enable mobile payment receipts and reconciliation.

### Problems Being Solved
1. No mobile money payment option in billing (80%+ of African health payments are mobile money or cash).
2. Private medical aid billing exists but is inaccessible to most rural African patients.
3. No mobile money reconciliation against invoices.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS mobile_money_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(30) NOT NULL, -- mpesa | mtn_momo | ecocash | airtel | flutterwave
  country_code VARCHAR(3) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  api_base_url TEXT NOT NULL,
  business_short_code VARCHAR(20),
  till_number VARCHAR(20),
  merchant_id VARCHAR(50),
  callback_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS mobile_money_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  provider VARCHAR(30) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(5) NOT NULL,
  provider_reference VARCHAR(100),
  checkout_request_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending | success | failed | cancelled
  failure_reason TEXT,
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  receipt_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-mobile-money.statements.ts`, version `2026.04.09.3`.

### Backend Workstreams

#### WS1 — EHR Service: Mobile Money Controller

```
POST   /payments/mobile-money/initiate         — Initiate STK push / payment request
POST   /payments/mobile-money/callback/mpesa   — M-Pesa Daraja callback webhook
POST   /payments/mobile-money/callback/mtn     — MTN MoMo callback webhook
POST   /payments/mobile-money/callback/ecocash — EcoCash callback webhook
POST   /payments/mobile-money/callback/airtel  — Airtel Money callback webhook
POST   /payments/mobile-money/callback/flutterwave — Flutterwave webhook
GET    /payments/mobile-money/:transactionId   — Get transaction status
GET    /payments/mobile-money/invoice/:invoiceId — All mobile money payments for an invoice
GET    /payments/mobile-money/receipt/:transactionId — Download PDF receipt
```

#### WS2 — Mobile Money Client Services

File: `services/ehr-service/src/services/mobile-money.service.ts`

Sub-clients (one per provider, no shared mock class):

**M-Pesa Daraja (Kenya, Tanzania, Mozambique, DRC):**
- OAuth token: `POST {MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`
- STK Push: `POST {MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`
- Env: `MPESA_BASE_URL`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`

**MTN Mobile Money (Zambia, Uganda, Ghana):**
- Create payment: `POST {MTN_BASE_URL}/collection/v1_0/requesttopay`
- Status: `GET {MTN_BASE_URL}/collection/v1_0/requesttopay/{referenceId}`
- Env: `MTN_BASE_URL`, `MTN_SUBSCRIPTION_KEY`, `MTN_API_USER`, `MTN_API_KEY`, `MTN_COLLECTION_PRIMARY_KEY`

**EcoCash (Zimbabwe):**
- Merchant payment: `POST {ECOCASH_BASE_URL}/transactions/merchant-payment`
- Env: `ECOCASH_BASE_URL`, `ECOCASH_MERCHANT_CODE`, `ECOCASH_MERCHANT_PIN`

**Airtel Money (Malawi, Zambia, DRC):**
- Initiate: `POST {AIRTEL_BASE_URL}/merchant/v1/payments/`
- Env: `AIRTEL_BASE_URL`, `AIRTEL_CLIENT_ID`, `AIRTEL_CLIENT_SECRET`, `AIRTEL_COUNTRY`, `AIRTEL_CURRENCY`

**Flutterwave (multi-country aggregator):**
- Initiate charge: `POST https://api.flutterwave.com/v3/charges?type=mobile_money_{country}`
- Verify: `GET https://api.flutterwave.com/v3/transactions/{id}/verify`
- Env: `FLUTTERWAVE_SECRET_KEY`

All callbacks update `mobile_money_transactions.status` and call existing `BillingService.recordPayment()` — no new payment recording logic.

#### WS3 — Frontend: Mobile Money Payment UI

Extend `BillingDashboard.tsx` and invoice payment modal:
- Payment method selector: Medical Aid | Cash | Mobile Money
- If Mobile Money: provider dropdown (populated from active `mobile_money_configs` for tenant country), phone number input
- Polling or webhook-driven status update (show "Awaiting payment confirmation on your phone")
- On success: show receipt number, download PDF receipt button

All provider options from real `GET /payments/mobile-money/configs` — no hardcoded provider list.

### Real External APIs
- M-Pesa Daraja API (Safaricom)
- MTN Mobile Money API
- EcoCash API (Cassava Fintech)
- Airtel Money API
- Flutterwave API v3

### Done When
- M-Pesa STK push initiates and callback updates transaction status.
- All 4 providers + Flutterwave configured via env (no hardcoded credentials).
- Invoice marked paid when callback confirms success.
- PDF receipt generated with real transaction reference.
- All provisioning confirmed. Lint, build, tests pass.

---

## Sprint S132 — Community Health Worker (CHW) Module

### Goal
Build CHW-specific mobile screens, household register, daily service tally, MUAC nutrition screening, task assignment from facility, supervision dashboard, and CHW performance reporting to DHIS2.

### Problems Being Solved
1. No household register (family/community unit).
2. No MUAC (mid-upper arm circumference) nutrition screening form.
3. No CHW task assignment from facility to field.
4. No CHW supervision dashboard.
5. No CHW daily service tally for DHIS2 aggregate reporting.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_code VARCHAR(30) NOT NULL UNIQUE,
  head_of_household VARCHAR(200),
  address TEXT,
  village VARCHAR(100),
  ward VARCHAR(100),
  district VARCHAR(100),
  gps_lat NUMERIC(9,6),
  gps_lng NUMERIC(9,6),
  water_source VARCHAR(50),
  sanitation_type VARCHAR(50),
  assigned_chw_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) NOT NULL,
  patient_id UUID,
  member_name VARCHAR(200) NOT NULL,
  date_of_birth DATE,
  sex VARCHAR(10),
  relationship VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS chw_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chw_id UUID NOT NULL,
  household_id UUID REFERENCES households(id),
  patient_id UUID,
  visit_date DATE NOT NULL,
  visit_type VARCHAR(50) NOT NULL, -- antenatal | postnatal | sick_child | tb_dot | growth_monitoring | other
  muac_mm INTEGER,
  muac_classification VARCHAR(10), -- SAM | MAM | normal
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  temperature_celsius NUMERIC(4,1),
  referred_to_facility BOOLEAN DEFAULT false NOT NULL,
  referral_reason TEXT,
  services_provided TEXT[],
  notes TEXT,
  gps_lat NUMERIC(9,6),
  gps_lng NUMERIC(9,6),
  synced BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS chw_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to_chw_id UUID NOT NULL,
  patient_id UUID,
  household_id UUID REFERENCES households(id),
  task_type VARCHAR(50) NOT NULL, -- follow_up | tb_dot | anc_visit | immunization_defaulter | other
  due_date DATE NOT NULL,
  priority VARCHAR(10) DEFAULT 'normal',
  instructions TEXT,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_notes TEXT,
  assigned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS chw_daily_tallies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chw_id UUID NOT NULL,
  tally_date DATE NOT NULL,
  households_visited INTEGER DEFAULT 0,
  anc_visits INTEGER DEFAULT 0,
  postnatal_visits INTEGER DEFAULT 0,
  sick_children_seen INTEGER DEFAULT 0,
  tb_dot_observations INTEGER DEFAULT 0,
  muac_screenings INTEGER DEFAULT 0,
  sam_cases_identified INTEGER DEFAULT 0,
  referrals_made INTEGER DEFAULT 0,
  immunizations_given INTEGER DEFAULT 0,
  dhis2_synced BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(chw_id, tally_date)
);
```

Provisioning bundle: `tenant-chw-module.statements.ts`, version `2026.04.09.4`.

### Backend Workstreams

#### WS1 — EHR Service: CHW Controller

```
POST   /chw/households                         — Register a household
GET    /chw/households                         — List households (by CHW, village, ward)
GET    /chw/households/:id                     — Household detail + members + visit history
POST   /chw/households/:id/members             — Add a household member
POST   /chw/visits                             — Record a CHW visit (with MUAC, vitals, services)
GET    /chw/visits                             — List visits (by CHW, date range, household)
GET    /chw/tasks                              — Get tasks assigned to a CHW
POST   /chw/tasks                              — Assign a task to a CHW (from facility)
PATCH  /chw/tasks/:id/complete                 — Mark task complete with notes
GET    /chw/tally/:chwId/:date                 — Get daily tally for a CHW
POST   /chw/tally                              — Submit / update daily tally
POST   /chw/sync/batch                         — Offline batch sync (visits, tallies, tasks)
GET    /chw/supervision/dashboard              — Supervisor view: CHW performance metrics
GET    /chw/supervision/defaulters             — Patients needing follow-up visits
```

MUAC classification in service:
- `< 115mm` → SAM (Severe Acute Malnutrition)
- `115–124mm` → MAM (Moderate Acute Malnutrition)
- `≥ 125mm` → Normal

#### WS2 — DHIS2 Aggregate: CHW Tally Sync

Extend existing DHIS2 sync service to push `chw_daily_tallies` as DHIS2 aggregate data values.
Env: `DHIS2_CHW_DATASET_UID` for the DHIS2 dataset receiving CHW aggregate data.
No hardcoded data element UIDs — read from tenant DHIS2 config.

#### WS3 — Mobile App: CHW Screens

New screens in React Native mobile app:

- `CHWHomeScreen` — task list, today's tally summary, households needing visit
- `HouseholdRegisterScreen` — list all households in CHW catchment area
- `HouseholdDetailScreen` — family members, visit history, task list
- `RecordVisitScreen` — full visit form: MUAC tape, weight, services given, referral toggle, GPS capture
- `DailyTallyScreen` — end-of-day tally form, submit to server
- `CHWSyncScreen` — offline queue status, sync button, last sync timestamp

All screens connect to real EHR service endpoints above. No setTimeout placeholders. Offline queue uses existing AsyncStorage sync pattern.

### Done When
- CHW can register household, add members, record visit with MUAC, and mark referral.
- MUAC classification displays automatically.
- Tasks assigned from facility appear on CHW mobile app.
- Daily tally syncs to DHIS2 aggregate data values.
- Offline queue syncs when connection restored.
- All provisioning confirmed. Lint, build, tests pass.

---

## Sprint S133 — SAM / CMAM Nutrition Programs

### Goal
Build MUAC-based SAM/MAM screening, RUTF (Ready-to-Use Therapeutic Food) dispensing, IMAM protocol clinical decision support, inpatient therapeutic feeding tracking, and CMAM program DHIS2 reporting.

### Problems Being Solved
1. No CMAM (Community-Based Management of Acute Malnutrition) clinical pathway.
2. No RUTF dispensing and stock management.
3. No SAM inpatient therapeutic feeding (F75/F100) tracking.
4. No CMAM program registers (OTP, SC, TSFP) for DHIS2 reporting.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS nutrition_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  assessment_date DATE NOT NULL,
  assessed_by UUID,
  muac_mm INTEGER,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  whz_score NUMERIC(5,2),
  bilateral_pitting_oedema BOOLEAN DEFAULT false,
  oedema_grade VARCHAR(5),
  classification VARCHAR(10) NOT NULL, -- SAM | MAM | normal
  program_type VARCHAR(10), -- OTP | SC | TSFP
  admission_type VARCHAR(20), -- new | readmission | relapsed | transfer_in
  discharge_reason VARCHAR(30),
  discharge_date DATE,
  outcome VARCHAR(20), -- recovered | defaulted | died | non_recovered | transfer_out
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS rutf_dispensing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  nutrition_assessment_id UUID REFERENCES nutrition_assessments(id),
  dispensed_date DATE NOT NULL,
  dispensed_by UUID,
  product_name VARCHAR(50) NOT NULL, -- Plumpy'Nut | BP-100 | F75 | F100 | RUSF
  sachets_dispensed INTEGER,
  weight_kg NUMERIC(5,2),
  dose_sachets_per_day INTEGER,
  lot_number VARCHAR(50),
  expiry_date DATE,
  next_visit_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS therapeutic_feeding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  admission_id UUID,
  feeding_date DATE NOT NULL,
  feeding_phase VARCHAR(10) NOT NULL, -- stabilisation | transition | rehabilitation
  formula VARCHAR(10) NOT NULL, -- F75 | F100 | RUSF
  volume_ml_per_feed INTEGER,
  feeds_per_day INTEGER,
  weight_kg NUMERIC(5,2),
  noted_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-nutrition-cmam.statements.ts`, version `2026.04.09.5`.

### Backend Workstreams

#### WS1 — EHR Service: Nutrition Controller

```
POST   /nutrition/assess                       — Create nutrition assessment + auto-classify
GET    /nutrition/assessments/:patientId        — Get assessment history for patient
POST   /nutrition/rutf/dispense                — Record RUTF dispensing
GET    /nutrition/rutf/:patientId              — RUTF dispensing history for patient
POST   /nutrition/feeding                      — Record therapeutic feeding (inpatient)
GET    /nutrition/feeding/:patientId           — Feeding records for patient
GET    /nutrition/cmam/otp-register            — OTP (Outpatient Therapeutic Programme) register
GET    /nutrition/cmam/sc-register             — Stabilisation Centre register
GET    /nutrition/cmam/tsfp-register           — Targeted Supplementary Feeding register
GET    /nutrition/cmam/reporting               — Aggregate CMAM indicators for DHIS2 period
```

WHZ score calculation: use WHO child growth standards tables. Load reference tables from JSON file (WHO MGRS data) — do not hardcode Z-score values inline.

CDSS endpoint: `POST /cdss/nutrition/cmam-protocol` — given classification + oedema grade, returns IMAM admission criteria, RUTF dose by weight, therapeutic feeding schedule.

#### WS2 — Frontend: Nutrition Assessment + CMAM Panels

Extend `NurseDashboard.tsx` with nutrition tab:
- MUAC entry → auto-classify on blur
- WHZ score calculated from weight/height and DOB (real WHO table lookup)
- RUTF dose recommendation from CDSS (real endpoint)
- Program enrollment form (OTP/SC/TSFP)
- CMAM register view (admission list, outcome summary)

### Done When
- SAM/MAM/Normal classification fires from real MUAC + WHZ entry.
- RUTF dispensing records created with lot number and expiry.
- CMAM registers populate from real DB.
- DHIS2 CMAM indicators report for selected period.
- Lint, build, tests pass.

---

## Sprint S134 — NHIF / CBHI Capitation Billing Model

### Goal
Add capitation payment model, NHIF claims format (Kenya, Tanzania), community health insurance member enrollment, co-pay calculation, and Zambia NHIMA integration alongside the existing fee-for-service medical aid model.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS nhif_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_code VARCHAR(20) NOT NULL UNIQUE,
  scheme_name VARCHAR(100) NOT NULL,
  country_code VARCHAR(3) NOT NULL,
  payment_model VARCHAR(20) NOT NULL, -- capitation | fee_for_service | mixed
  capitation_rate NUMERIC(10,2),
  capitation_currency VARCHAR(5),
  api_base_url TEXT,
  api_key_env_var TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS scheme_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  nhif_scheme_id UUID REFERENCES nhif_schemes(id),
  member_number VARCHAR(50) NOT NULL,
  principal_member_number VARCHAR(50),
  relationship VARCHAR(30),
  enrollment_date DATE NOT NULL,
  expiry_date DATE,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  contribution_amount NUMERIC(10,2),
  contribution_frequency VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS nhif_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  scheme_member_id UUID REFERENCES scheme_members(id),
  nhif_scheme_id UUID REFERENCES nhif_schemes(id),
  claim_number VARCHAR(50),
  claim_date DATE NOT NULL,
  visit_type VARCHAR(30),
  diagnosis_icd10 VARCHAR(10),
  procedure_codes TEXT[],
  claimed_amount NUMERIC(10,2),
  approved_amount NUMERIC(10,2),
  copay_amount NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'submitted' NOT NULL,
  scheme_reference VARCHAR(50),
  rejection_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS capitation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nhif_scheme_id UUID REFERENCES nhif_schemes(id),
  payment_month DATE NOT NULL,
  member_count INTEGER NOT NULL,
  rate_per_member NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(5) NOT NULL,
  received_date DATE,
  reference VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-nhif-cbhi.statements.ts`, version `2026.04.09.6`.

### Backend Workstreams

#### WS1 — EHR Service: NHIF/CBHI Controller

```
POST   /nhif/schemes                           — Register a scheme (admin)
GET    /nhif/schemes                           — List active schemes for tenant country
POST   /nhif/members                           — Enroll a patient in a scheme
GET    /nhif/members/:patientId                — Get patient scheme memberships
POST   /nhif/claims                            — Submit a NHIF claim
GET    /nhif/claims                            — List claims (filter: status, scheme, date)
PATCH  /nhif/claims/:id                        — Update claim status from scheme response
POST   /nhif/capitation                        — Record a capitation payment received
GET    /nhif/capitation/report                 — Monthly capitation summary
POST   /nhif/eligibility/:memberId             — Check member eligibility (live API call)
```

Eligibility check:
- Kenya NHIF: `POST https://api.nhif.or.ke/claimsAPI/api/eligibility` (real endpoint)
- Tanzania NHIF: `POST {NHIF_TZ_BASE_URL}/eligibility` (env-backed)
- Zambia NHIMA: `POST {NHIMA_BASE_URL}/api/member/verify` (env-backed)

All credentials from env vars, never hardcoded.

#### WS2 — Frontend: NHIF Billing Panels

Extend `BillingDashboard.tsx`:
- Scheme selector at patient registration (if patient is scheme member)
- Co-pay calculation on invoice generation (claimed_amount − copay_amount)
- NHIF claims queue view (pending, submitted, approved, rejected)
- Capitation received log

### Done When
- Scheme member enrollment persists to DB.
- Eligibility check calls real NHIF/NHIMA API (or gracefully fails if unreachable with real error, not mock response).
- Claim submission creates real DB record.
- Capitation payment model calculates monthly total from member count × rate.
- Lint, build, tests pass.

---

## Sprint S135 — SA National System Interop (NHLS + TIER.net + ETR.net)

### Goal
Build NHLS HL7 v2 lab result inbound parser, TIER.net ART cohort XML export, and ETR.net TB case notification export for South Africa public sector compliance.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS nhls_lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID,
  nhls_patient_id VARCHAR(50),
  nhls_lab_number VARCHAR(50) NOT NULL,
  test_loinc_code VARCHAR(20),
  test_name VARCHAR(100) NOT NULL,
  result_value TEXT,
  result_unit VARCHAR(30),
  reference_range VARCHAR(50),
  abnormal_flag VARCHAR(5),
  result_status VARCHAR(20),
  collected_at TIMESTAMP WITH TIME ZONE,
  resulted_at TIMESTAMP WITH TIME ZONE,
  hl7_raw TEXT,
  processed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS tier_net_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  export_date DATE NOT NULL,
  export_type VARCHAR(20) NOT NULL, -- art_cohort | viral_load
  export_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  tier_net_uid VARCHAR(50),
  payload_xml TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS etr_net_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  tb_case_id UUID,
  notification_date DATE NOT NULL,
  export_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  etr_reference VARCHAR(50),
  payload_json JSONB,
  submitted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-sa-national-interop.statements.ts`, version `2026.04.09.7`.

### Backend Workstreams

#### WS1 — EHR Service: NHLS HL7 Inbound

File: `services/ehr-service/src/services/nhls-hl7.service.ts`

```
POST   /nhls/hl7/ingest                       — Accept raw HL7 v2 ORU message (from NHLS)
GET    /nhls/results/:patientId               — NHLS results for patient
GET    /nhls/results/pending                  — Results not yet linked to a patient
PATCH  /nhls/results/:id/link                 — Link an NHLS result to a MediCore patient
```

HL7 v2 parser: use `simple-hl7` npm package (already or add to `ehr-service` dependencies). Parse OBR (order), OBX (result) segments. Map NHLS test codes to LOINC using a JSON mapping table in `services/ehr-service/src/data/nhls-loinc-map.json`.

#### WS2 — EHR Service: TIER.net Export

File: `services/ehr-service/src/services/tier-net.service.ts`

```
POST   /tier-net/export/:patientId            — Generate TIER.net XML for one ART patient
POST   /tier-net/export/batch                 — Batch export all active ART patients
GET    /tier-net/exports                      — Export job history
GET    /tier-net/exports/:id/download         — Download XML payload
```

TIER.net XML schema: follows TIER.net v2.x XML format (DOH SA spec). Build XML from patient ART data (HIV monitoring records, regimen history, viral load history, CD4 history). Use `xmlbuilder2` npm package.

#### WS3 — EHR Service: ETR.net Notification

File: `services/ehr-service/src/services/etr-net.service.ts`

```
POST   /etr-net/notify/:tbCaseId              — Submit TB case notification to ETR.net
GET    /etr-net/notifications                 — List ETR.net notification history
```

ETR.net API: `POST {ETR_NET_BASE_URL}/api/case-notification` (env-backed: `ETR_NET_BASE_URL`, `ETR_NET_API_KEY`).

### Done When
- NHLS HL7 ORU message parses, maps to LOINC, creates `nhls_lab_results` row.
- TIER.net XML export generates valid XML (validate against schema) and stores payload.
- ETR.net notification submits to configured endpoint.
- All provisioning confirmed. Lint, build, tests pass.

---

## Sprint S136 — DHIS2 Tracker (Individual TEI) + DATIM MER 2.x

### Goal
Add DHIS2 Tracker individual-level TEI enrollment and program stage event write. Complete DATIM MER 2.x indicator set with correct age/sex/KP disaggregates. Add DATIM API push (separate from generic DHIS2).

### New Database Tables

```sql
-- Already added in S129 (dhis2_tracker_sync_log). Re-use.

CREATE TABLE IF NOT EXISTS datim_indicator_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mer_indicator VARCHAR(50) NOT NULL,
  disaggregate VARCHAR(50) NOT NULL,
  datim_de_uid VARCHAR(50) NOT NULL,
  datim_coc_uid VARCHAR(50) NOT NULL,
  period_type VARCHAR(10) NOT NULL, -- monthly | quarterly
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(mer_indicator, disaggregate)
);

CREATE TABLE IF NOT EXISTS datim_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period VARCHAR(10) NOT NULL,
  org_unit_uid VARCHAR(50) NOT NULL,
  indicator_count INTEGER,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  datim_import_summary JSONB,
  submitted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-dhis2-tracker-datim.statements.ts`, version `2026.04.09.8`.

### Backend Workstreams

#### WS1 — CDSS Service: DHIS2 Tracker Client (extend from S129)

Add endpoints:
```
POST /dhis2/tracker/enroll/hiv              — Enroll HIV patient as TEI in DHIS2 HIV program
POST /dhis2/tracker/enroll/tb               — Enroll TB patient as TEI in DHIS2 TB program
POST /dhis2/tracker/event/art-visit         — Push ART visit as program stage event
POST /dhis2/tracker/event/tb-visit          — Push TB treatment visit as program stage event
GET  /dhis2/tracker/tei/:patientId          — Get DHIS2 TEI UID for patient
```

Real DHIS2 API: `POST {DHIS2_BASE_URL}/api/trackedEntityInstances` with tracked entity instance payload and program enrollment. Program UIDs from tenant config (not hardcoded).

#### WS2 — EHR Service: DATIM MER Indicator Engine

File: `services/ehr-service/src/services/datim-mer.service.ts`

Full MER 2.x indicator set:
- `TX_NEW` — New on ART, disaggregated by age band (< 1, 1-4, 5-9, ..., 65+) × sex × KP (FSW, MSM, PWID, TG)
- `TX_CURR` — Currently on ART
- `TX_PVLS` — Viral load suppressed (< 1000 copies/mL), TX_PVLS_D (denominator, those with VL test)
- `HTS_TST` — HIV tests conducted, disaggregated by modality (VCT, PMTCT, IPD, OPD, etc.)
- `HTS_TST_POS` — HIV positive tests
- `PMTCT_STAT` — Pregnant women with known HIV status
- `PMTCT_EID` — Infant virological testing
- `PMTCT_HEI_POS` — Infants testing HIV positive
- `TB_PREV` — TB preventive therapy started/completed
- `TB_ART` — HIV+ TB patients on ART
- `TB_STAT` — TB patients with known HIV status

All values computed from real DB queries against `hiv_monitoring_records`, `patients`, `lab_results`. No hardcoded or estimated figures.

```
POST /datim/submit/:period                  — Compute and submit MER indicators for period
GET  /datim/submissions                     — DATIM submission history
GET  /datim/preview/:period                 — Preview computed values before submission
GET  /datim/indicator-mappings             — List DE/COC UID mappings
POST /datim/indicator-mappings             — Upsert a DE/COC mapping (admin)
```

Real DATIM API: `POST https://datim.org/api/dataValueSets` with `Content-Type: application/json`, authenticated with `DATIM_USERNAME` / `DATIM_PASSWORD` env vars.

### Done When
- DHIS2 Tracker TEI enrollment creates real TEI in DHIS2 instance.
- ART visit event pushed as program stage event with correct data elements.
- DATIM MER preview shows computed values from real patient data.
- DATIM submission endpoint posts to real DATIM API.
- Lint, build, tests pass.

---

## Sprint S137 — Africa's Talking SMS / USSD Gateway

### Goal
Integrate Africa's Talking SMS API for appointment reminders, ARV refill reminders, lab result notifications, immunization defaulter outreach, and TB DOT confirmation. Add basic USSD menu for patient-facing feature-phone access.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- appointment_reminder | arv_refill | lab_result | immunization | tb_dot | custom
  message_text TEXT NOT NULL,
  provider VARCHAR(20) DEFAULT 'africastalking',
  at_message_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'queued' NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS ussd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL UNIQUE,
  phone_number VARCHAR(20) NOT NULL,
  patient_id UUID,
  current_menu VARCHAR(50),
  session_data JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ended BOOLEAN DEFAULT false NOT NULL
);
```

Provisioning bundle: `tenant-africastalking-sms.statements.ts`, version `2026.04.09.9`.

### Backend Workstreams

#### WS1 — EHR Service: SMS Controller

```
POST   /sms/send                              — Send an ad-hoc SMS to a patient
POST   /sms/campaigns/appointment-reminders   — Trigger SMS to all patients with appointments tomorrow
POST   /sms/campaigns/arv-refill              — Trigger SMS to ARV patients due for refill
POST   /sms/campaigns/immunization-defaulters — Trigger SMS to EPI defaulters
POST   /sms/campaigns/tb-dot                  — Daily TB DOT confirmation SMS
POST   /sms/callback/delivery                 — Africa's Talking delivery receipt webhook
GET    /sms/logs                              — SMS log (filter by patient, type, status)
```

Real Africa's Talking SMS API:
- `POST https://api.africastalking.com/version1/messaging`
- Headers: `apiKey: {AT_API_KEY}`, `Content-Type: application/x-www-form-urlencoded`
- Body: `username={AT_USERNAME}&to={phone}&message={text}&from={shortcode}`
- Env: `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID`

TB DOT two-way SMS:
- `POST /sms/callback/incoming` — Africa's Talking inbound SMS webhook
- Parse "YES" reply → update `tb_dot_adherence` record for patient

#### WS2 — EHR Service: USSD Controller

```
POST   /ussd/session                          — Africa's Talking USSD callback endpoint
```

USSD menu tree (stateless, stored in `ussd_sessions`):
```
1. Appointments     → Show next appointment date + time
2. Lab Results      → Show last 3 lab results (numeric only, no full report)
3. Medications      → Show current ARV/medication list
4. Speak to Clinic  → Send SMS alert to reception
0. Exit
```

Phone number → patient lookup via `patients.phone_number`. Session state stored in `ussd_sessions`. All menu data from real DB queries.

Real Africa's Talking USSD API: AT sends `POST` to your configured callback URL with `sessionId`, `phoneNumber`, `serviceCode`, `text`. Respond with `CON` (continue) or `END` (close session) + menu text.

#### WS3 — Frontend: SMS Campaign Dashboard Panel

Extend `CampaignsDashboard.tsx`:
- SMS send log table (real data from `sms_logs`)
- Campaign trigger buttons (appointment reminders, ARV refill, immunization defaulters)
- Delivery rate metric (delivered/sent %)

No fake delivery stats. All from real `sms_logs` queries.

### Done When
- Appointment reminder SMS fires via real Africa's Talking API.
- TB DOT "YES" reply updates DOT adherence record.
- USSD session shows real patient appointment data.
- SMS logs persist with real AT message IDs.
- Lint, build, tests pass.

---

## Sprint S138 — OpenMRS Patient Import + National Patient ID Registry

### Goal
Build an OpenMRS REST patient importer with concept mapping, OpenCR (Open Client Registry) integration for national patient ID resolution, and cross-system patient deduplication.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS patient_external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  id_type VARCHAR(50) NOT NULL, -- national_id | smartcare | ipms | openmrs | unhcr | nhif
  external_id VARCHAR(100) NOT NULL,
  assigning_authority VARCHAR(100),
  verified BOOLEAN DEFAULT false NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(id_type, external_id)
);

CREATE TABLE IF NOT EXISTS openmrs_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  patients_found INTEGER DEFAULT 0,
  patients_imported INTEGER DEFAULT 0,
  patients_skipped INTEGER DEFAULT 0,
  patients_errored INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_log JSONB DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-openmrs-import.statements.ts`, version `2026.04.09.10`.

### Backend Workstreams

#### WS1 — EHR Service: OpenMRS Importer

```
POST   /import/openmrs/start                  — Start an OpenMRS patient import job
GET    /import/openmrs/jobs                   — List import jobs and progress
GET    /import/openmrs/jobs/:id               — Job detail + error log
POST   /import/openmrs/jobs/:id/retry         — Retry failed patients
```

Real OpenMRS REST API:
- `GET {OPENMRS_BASE_URL}/ws/rest/v1/patient?v=full&limit=100&startIndex=0`
- `GET {OPENMRS_BASE_URL}/ws/rest/v1/obs?patient={uuid}&v=full`
- Auth: `Authorization: Basic base64(OPENMRS_USERNAME:OPENMRS_PASSWORD)`
- Env: `OPENMRS_BASE_URL`, `OPENMRS_USERNAME`, `OPENMRS_PASSWORD`

Concept mapping: `services/ehr-service/src/data/openmrs-concept-map.json` — maps OpenMRS concept UUIDs to SNOMED CT / LOINC / ICD-10 codes. Populate from WHO/OpenMRS concept dictionary (not hardcoded inline).

Deduplication: before creating a patient, check `patient_external_ids` for matching `openmrs` UUID. Also fuzzy-match on name + DOB using existing deduplication service.

#### WS2 — EHR Service: National Patient ID (OpenCR)

```
GET    /registry/lookup/:idType/:externalId   — Look up patient by national ID in OpenCR
POST   /registry/link                         — Link a MediCore patient to a national ID
GET    /patients/:id/external-ids             — List all external IDs for a patient
```

Real OpenCR API:
- `GET {OPENCR_BASE_URL}/fhir/Patient?identifier={system}|{value}` (FHIR patient search)
- Env: `OPENCR_BASE_URL`, `OPENCR_API_KEY`

### Done When
- OpenMRS import job pages through all patients, maps concepts, creates MediCore patients.
- Duplicates detected and skipped (not doubled up).
- National patient ID stored in `patient_external_ids`.
- OpenCR lookup returns FHIR patient bundle for valid national IDs.
- Lint, build, tests pass.

---

## Sprint S139 — CRVS Birth / Death Notification

### Goal
Build birth notification form to country CRVS APIs, stillbirth recording, ICD-10 coded death certificate generation, Maternal Death Surveillance (MDSR) notification, and Perinatal Death Review workflow.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS birth_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL, -- the newborn
  mother_patient_id UUID,
  maternity_record_id UUID,
  birth_date TIMESTAMP WITH TIME ZONE NOT NULL,
  birth_type VARCHAR(20) NOT NULL, -- live_birth | stillbirth | miscarriage
  gestational_age_weeks INTEGER,
  birth_weight_grams INTEGER,
  delivery_mode VARCHAR(30),
  birth_order INTEGER DEFAULT 1,
  plurality VARCHAR(10), -- singleton | twin | triplet
  place_of_birth VARCHAR(100),
  crvs_reference VARCHAR(50),
  submitted_to_crvs BOOLEAN DEFAULT false NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS death_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  death_date DATE NOT NULL,
  death_time TIME,
  place_of_death VARCHAR(100),
  cause_of_death_primary VARCHAR(200) NOT NULL,
  cause_of_death_icd10 VARCHAR(10) NOT NULL,
  cause_of_death_secondary VARCHAR(200),
  cause_of_death_secondary_icd10 VARCHAR(10),
  manner_of_death VARCHAR(30),
  certifying_provider UUID,
  crvs_reference VARCHAR(50),
  submitted_to_crvs BOOLEAN DEFAULT false NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  pdf_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS mdsr_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  death_certificate_id UUID REFERENCES death_certificates(id),
  death_date DATE NOT NULL,
  weeks_gestation_at_death INTEGER,
  primary_cause VARCHAR(200),
  primary_cause_icd10 VARCHAR(10),
  avoidable BOOLEAN,
  avoidance_factors TEXT,
  committee_review_date DATE,
  reviewed_by UUID,
  action_points TEXT,
  submitted_to_moh BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-crvs.statements.ts`, version `2026.04.09.11`.

### Backend Workstreams

#### WS1 — EHR Service: CRVS Controller

```
POST   /crvs/birth                            — Register birth + submit to national CRVS
POST   /crvs/stillbirth                       — Register stillbirth
POST   /crvs/death                            — Register death + generate certificate
GET    /crvs/death/:patientId                 — Get death certificate
GET    /crvs/death/:id/pdf                    — Download death certificate PDF
POST   /crvs/mdsr                             — Submit maternal death notification
GET    /crvs/mdsr                             — List MDSR notifications for review
PATCH  /crvs/mdsr/:id/review                  — Record committee review of maternal death
```

Country CRVS API integration (env-backed):
- **Zimbabwe ZIMSTAT:** `POST {ZIMSTAT_BASE_URL}/api/birth-notification`
- **SA Dept Home Affairs:** `POST {DHA_BASE_URL}/api/notifications/birth`
- **Generic MOH endpoint:** `POST {CRVS_BASE_URL}/api/vital-events` (fallback for other SADC countries)
- Env: `CRVS_BASE_URL`, `CRVS_API_KEY`, `CRVS_COUNTRY_CODE`

PDF generation: use existing PDF generation service (puppeteer or pdfmake) for death certificate. Template includes ICD-10 coded cause of death, certifying provider, facility stamp.

### Done When
- Birth notification creates DB record and submits to configured CRVS endpoint.
- Stillbirth recorded as distinct event type.
- Death certificate PDF generates with ICD-10 cause of death.
- MDSR notification submitted to MOH.
- Committee review recorded with action points.
- Lint, build, tests pass.

---

## Sprint S140 — NTD Programs + Malaria Clinical Depth

### Goal
Add structured NTD (Neglected Tropical Disease) clinical assessment forms, MDA campaign tracking, malaria severity scoring, RDT structured result capture, G6PD flag before primaquine, IPTp tracking, and ACT weight-based dosing.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS ntd_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  disease_type VARCHAR(50) NOT NULL, -- schistosomiasis | filariasis | trachoma | leprosy | hat | onchocerciasis
  assessment_date DATE NOT NULL,
  assessed_by UUID,
  disease_stage VARCHAR(50),
  disability_grade INTEGER,
  mda_eligible BOOLEAN,
  treatment_given VARCHAR(100),
  dose_mg NUMERIC(8,2),
  lot_number VARCHAR(50),
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS mda_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(100) NOT NULL,
  disease_type VARCHAR(50) NOT NULL,
  drug_name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_population INTEGER,
  treated_count INTEGER DEFAULT 0,
  coverage_area TEXT,
  dhis2_dataset_uid VARCHAR(50),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS malaria_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  episode_date DATE NOT NULL,
  rdt_result VARCHAR(20), -- positive_pf | positive_pv | positive_mixed | negative
  species_confirmed VARCHAR(30),
  parasite_density INTEGER,
  severity_criteria TEXT[],
  severity_grade VARCHAR(20), -- uncomplicated | severe | cerebral
  g6pd_tested BOOLEAN DEFAULT false,
  g6pd_result VARCHAR(20),
  primaquine_given BOOLEAN DEFAULT false,
  treatment_regimen VARCHAR(100),
  weight_kg NUMERIC(5,2),
  act_dose_mg NUMERIC(8,2),
  iptp_dose_number INTEGER,
  iptp_sp_given BOOLEAN DEFAULT false,
  admitted BOOLEAN DEFAULT false,
  outcome VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-ntd-malaria.statements.ts`, version `2026.04.09.12`.

### Backend Workstreams

#### WS1 — EHR Service: NTD + Malaria Controller

```
POST   /ntd/assess                            — Record NTD assessment
GET    /ntd/assessments/:patientId            — NTD history for patient
POST   /ntd/mda/campaigns                     — Create MDA campaign
PATCH  /ntd/mda/campaigns/:id/record          — Record treated count for a session
POST   /malaria/episodes                      — Record malaria episode
GET    /malaria/episodes/:patientId           — Malaria history for patient
POST   /malaria/iptp/record                   — Record IPTp SP dose for pregnant patient
GET    /malaria/iptp/:patientId               — IPTp dose history
```

#### WS2 — CDSS Service: Malaria Clinical Decision Support

```
POST /cdss/malaria/severity                   — Given symptoms + lab values → severity grade
POST /cdss/malaria/act-dose                   — Given weight + species → ACT dose (mg + tablet count)
POST /cdss/malaria/g6pd-check                 — Flag primaquine contraindication if G6PD not tested
POST /cdss/malaria/iptp-due                   — Given gestational age + prior doses → next IPTp due
```

Severity criteria: WHO 2015 severe malaria criteria (prostration, impaired consciousness, respiratory distress, severe anaemia Hb < 5, hypoglycaemia, severe thrombocytopenia, jaundice, haemoglobinuria, hyperparasitaemia > 5%). All criteria hard-coded from WHO guideline — no LLM for this.

ACT dosing: Artemether-lumefantrine dosing table by weight band (from WHO malaria treatment guidelines). JSON lookup table in `services/cdss-service/data/act_dosing.json`.

#### WS3 — Frontend: Malaria Episode Form

Extend `DoctorPatientDetail.tsx` malaria section:
- RDT result dropdown (populated from enum, not hardcoded string)
- Severity criteria checklist (WHO criteria, checkboxes)
- G6PD warning banner if primaquine intended and G6PD not tested
- ACT dose recommendation panel (from real CDSS endpoint)
- IPTp tracking for pregnant patients

No mock dosing values. All from real CDSS endpoint.

### Done When
- Malaria episode records with RDT result, severity grade, ACT dose.
- G6PD warning fires from real CDSS check.
- IPTp due date calculated from real gestational age + prior doses.
- NTD assessment and MDA campaign tracking functional.
- Lint, build, tests pass.

---

## Sprint S141 — mhGAP Mental Health + SADC Language Tools

### Goal
Add mhGAP Intervention Guide CDS for nurse/CHW-delivered mental health care, screening tools in 12 SADC languages, substance use disorder structured assessment, community mental health care plan, and mental health referral pathway.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS mental_health_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  screened_by UUID,
  screening_date DATE NOT NULL,
  tool_name VARCHAR(30) NOT NULL, -- PHQ9 | GAD7 | AUDIT | DAST | mhGAP | SRQ | MINI
  language_code VARCHAR(5) NOT NULL,
  responses JSONB NOT NULL,
  total_score INTEGER,
  severity VARCHAR(20),
  action_taken VARCHAR(100),
  referred BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS mental_health_care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  diagnosis_icd10 VARCHAR(10),
  diagnosis_name VARCHAR(100),
  care_level VARCHAR(20), -- community | clinic | district | specialist
  assigned_chw_id UUID,
  assigned_provider UUID,
  goals TEXT[],
  interventions TEXT[],
  medication VARCHAR(100),
  review_date DATE,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS mental_health_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID REFERENCES mental_health_care_plans(id),
  patient_id UUID NOT NULL,
  followup_date DATE NOT NULL,
  conducted_by UUID,
  status VARCHAR(20),
  symptom_change VARCHAR(20),
  medication_adherent BOOLEAN,
  safety_concern BOOLEAN DEFAULT false,
  notes TEXT,
  next_followup_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-mental-health-mhgap.statements.ts`, version `2026.04.09.13`.

### Backend Workstreams

#### WS1 — CDSS Service: mhGAP CDS

```
POST /cdss/mental-health/mhgap-assess         — Given symptoms → mhGAP condition identification + management steps
POST /cdss/mental-health/screening-interpret  — Interpret PHQ-9/GAD-7/AUDIT score → severity + action
POST /cdss/mental-health/safety-plan          — Generate safety plan template for suicide/self-harm risk
GET  /cdss/mental-health/screening-tools      — List available tools with SADC language options
```

mhGAP logic: rule-based (not pure LLM). Implement WHO mhGAP-IG 2.0 decision trees as structured JSON rules in `services/cdss-service/data/mhgap_rules.json`. LLM used only for free-text clinical advice generation — not for diagnosis classification.

Screening tools in SADC languages: PHQ-9 and GAD-7 questions stored as JSON in `services/cdss-service/data/screening_tools/` with one file per language code (e.g., `phq9_sw.json`, `phq9_zu.json`, `phq9_pt.json`). English, Swahili, Zulu, Xhosa, Afrikaans, Shona, Ndebele, Setswana, Chichewa, Portuguese, French, Lingala.

#### WS2 — EHR Service: Mental Health Controller

```
POST   /mental-health/screen                  — Record a screening with full responses
GET    /mental-health/screenings/:patientId   — Screening history
POST   /mental-health/care-plans              — Create community mental health care plan
GET    /mental-health/care-plans/:patientId   — Get active care plans
POST   /mental-health/followups               — Record a community follow-up visit
GET    /mental-health/referral-pathway        — Get referral pathway for tenant country
```

#### WS3 — Frontend: Mental Health Screening UI

Extend `NurseDashboard.tsx` and `CHWHomeScreen` (mobile):
- Screening tool selector (PHQ-9, GAD-7, AUDIT, mhGAP) + language selector
- Questionnaire renders from JSON tool file (not hardcoded JSX per language)
- Score auto-calculated, severity badge shown
- Care plan creation form
- Safety plan template displayed when suicide risk detected

No hardcoded question text. All questions from real JSON tool files fetched via `GET /cdss/mental-health/screening-tools`.

### Done When
- PHQ-9 renders in Swahili, Zulu, Shona, Portuguese (from real JSON files).
- mhGAP assessment returns management steps from rule-based engine.
- Screening score + severity persists to DB.
- Community care plan created and linked to CHW for follow-up.
- Lint, build, tests pass.

---

## Sprint S142 — Multi-language Clinical Form Templates

### Goal
Translate and serve clinical documentation templates (ANC visit, referral letter, consent forms, discharge summary) in Portuguese, French, Swahili, Shona, Ndebele, and Setswana for country-specific deployments.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS clinical_template_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(50) NOT NULL, -- anc_visit | referral_letter | consent | discharge_summary
  language_code VARCHAR(5) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  translated_text TEXT NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  reviewed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(template_key, language_code, field_key)
);
```

Provisioning bundle: `tenant-clinical-template-i18n.statements.ts`, version `2026.04.09.14`.

### Backend Workstreams

#### WS1 — EHR Service: Template Translation Controller

```
GET    /templates/:templateKey/fields         — Get template fields in specified language
GET    /templates/:templateKey/languages      — List available languages for a template
POST   /templates/translations                — Upsert a field translation (admin)
GET    /templates/translations                — List all translations (paginated, filterable)
```

Seed translations: create `services/ehr-service/src/data/template-translations/` directory with JSON seed files per template per language. Seeding script runs on deployment if `clinical_template_translations` is empty.

Templates to translate:
- `anc_visit` — ANC visit form fields (EN, PT, FR, SW, SN, ND, TN)
- `referral_letter` — Referral letter template (EN, PT, FR, SW, SN, ND, TN)
- `consent_form` — Patient consent form (all 12 SADC NLP languages)
- `discharge_summary` — Discharge summary template (EN, PT, FR, SW)
- `tb_treatment_card` — TB treatment card (EN, PT, FR, SW, SN)
- `hiv_art_card` — ART patient card (EN, PT, FR, SW)

#### WS2 — Frontend: Language-Aware Clinical Forms

- Add language selector (defaults to tenant preferred language from settings, overridable per patient)
- All clinical form labels, placeholders, section headers rendered from `GET /templates/{key}/fields?lang={code}`
- No hardcoded English-only label strings in clinical form components
- Print/PDF export renders in the selected language

### Done When
- ANC visit form renders in Portuguese with all field labels from real translation DB.
- Referral letter generates PDF with French labels for DRC tenant.
- Consent form available in all 12 SADC languages.
- Adding a new translation via POST persists without redeploy.
- Lint, build, tests pass.

---

## Sprint S143 — Traditional Medicine Documentation + Herb-Drug Interactions

### Goal
Add traditional medicine / herbal remedy use field in patient history, herb-drug interaction flags (especially ARV interactions), and bidirectional traditional healer referral workflow.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS traditional_medicine_use (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  recorded_by UUID,
  recorded_date DATE NOT NULL,
  remedy_name VARCHAR(200) NOT NULL,
  remedy_type VARCHAR(50), -- herb | root | bark | animal | mineral | ritual
  local_name VARCHAR(200),
  preparation_method VARCHAR(100),
  frequency VARCHAR(50),
  duration_used VARCHAR(50),
  indication VARCHAR(200),
  traditional_practitioner_name VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS herb_drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_name VARCHAR(200) NOT NULL,
  herb_aliases TEXT[],
  drug_name VARCHAR(100) NOT NULL,
  drug_rxnorm_code VARCHAR(20),
  severity VARCHAR(20) NOT NULL, -- contraindicated | major | moderate | minor
  mechanism TEXT,
  clinical_effect TEXT,
  management TEXT,
  evidence_level VARCHAR(20),
  references TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS traditional_healer_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  referral_direction VARCHAR(20) NOT NULL, -- to_healer | from_healer
  healer_name VARCHAR(200),
  healer_location VARCHAR(200),
  reason TEXT,
  referral_date DATE NOT NULL,
  follow_up_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-traditional-medicine.statements.ts`, version `2026.04.09.15`.

Seed `herb_drug_interactions` with known clinically significant interactions:
- St. John's Wort + ARVs (NNRTIs/PIs) — contraindicated (CYP3A4 induction)
- Moringa (Moringa oleifera) + warfarin — anticoagulant potentiation
- Umckaloabo (Pelargonium sidoides) + anticoagulants
- Artemisia afra + antiretrovirals
- African potato (Hypoxis hemerocallidea) + ARVs — contraindicated
- Sutherlandia (Cancer bush) + ARVs — contraindicated
- Grapefruit juice + PIs — CYP3A4 inhibition
- Cat's claw + ARVs

Seed script: `services/ehr-service/src/seeds/herb-drug-interactions.seed.ts` — inserts known interactions, idempotent (uses ON CONFLICT DO NOTHING).

### Backend Workstreams

#### WS1 — CDSS Service: Herb-Drug Interaction Check

```
POST /cdss/herb-drug/check                    — Given herb names + current medications → interaction flags
GET  /cdss/herb-drug/herbs                    — Search herb names (autocomplete)
```

Check logic: query `herb_drug_interactions` table. If any herb in patient's `traditional_medicine_use` matches a known interaction with a current prescription, return severity + management. No external API (DB-backed, seeded from evidence).

#### WS2 — EHR Service: Traditional Medicine Controller

```
POST   /traditional-medicine/record           — Record traditional medicine use for patient
GET    /traditional-medicine/:patientId        — List traditional medicine use history
POST   /traditional-medicine/check-interactions — Check current herb list against prescriptions
POST   /traditional-medicine/referrals        — Create traditional healer referral
GET    /traditional-medicine/referrals/:patientId — Referral history
```

#### WS3 — Frontend: Traditional Medicine Panel

In `DoctorPatientDetail.tsx` → medication section → add Traditional Medicine sub-section:
- Herb/remedy entry form with local name field
- Interaction check button → calls real CDSS endpoint → shows severity badges
- Contraindicated herbs shown as red alert before prescribing ARVs
- Traditional healer referral form

No hardcoded interaction list in frontend. All from real CDSS endpoint.

### Done When
- Traditional medicine use records persist to DB.
- African potato + ARV interaction flagged as contraindicated from real DB lookup.
- Herb-drug check fires when recording traditional medicine for a patient on ARVs.
- Traditional healer referral creates DB record.
- Lint, build, tests pass.

---

## Sprint S144 — Refugee / Stateless Patient Workflows

### Goal
Add UNHCR ProGres ID as valid patient identifier, stateless patient pathway, cross-border health record access for refugee patients, and UNHCR/MSF clinic interoperability concepts.

### New Database Tables

```sql
-- Extends patient_external_ids (from S138) — add 'unhcr' and 'asylum_seeker' id types
-- No new table needed; use patient_external_ids with id_type = 'unhcr' | 'asylum_seeker'

CREATE TABLE IF NOT EXISTS refugee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL UNIQUE,
  unhcr_id VARCHAR(50),
  country_of_origin VARCHAR(3),
  arrival_country VARCHAR(3),
  arrival_date DATE,
  camp_name VARCHAR(100),
  status VARCHAR(30), -- refugee | asylum_seeker | stateless | idp
  case_size INTEGER DEFAULT 1,
  language_preference VARCHAR(5),
  interpreter_needed BOOLEAN DEFAULT false NOT NULL,
  unhcr_registration_verified BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-refugee-workflows.statements.ts`, version `2026.04.09.16`.

### Backend Workstreams

#### WS1 — EHR Service: Refugee Profile Controller

```
POST   /patients/:id/refugee-profile          — Create/update refugee profile for patient
GET    /patients/:id/refugee-profile          — Get refugee profile
POST   /patients/register/refugee             — Streamlined refugee registration (no national ID required)
GET    /patients/search/unhcr/:unhcrId        — Find patient by UNHCR ProGres ID
POST   /patients/:id/cross-border-export      — Export FHIR bundle for cross-border transfer
```

Registration: allow patient creation without national ID when `status = 'refugee'` or `'asylum_seeker'`. UNHCR ProGres ID (format: `XXX-XXXXXXX` or `XXX/XXXXXXX/XXXX`) as the primary identifier.

UNHCR ProGres verification (if configured): `GET {UNHCR_PROGRES_BASE_URL}/api/individual/{id}` — env `UNHCR_PROGRES_BASE_URL`, `UNHCR_PROGRES_API_KEY`. Graceful degradation if env not set (mark `unhcr_registration_verified = false`).

Cross-border FHIR export: use existing FHIR service to generate Patient bundle — already built in EHR service. No new code, just expose dedicated endpoint that calls existing FHIR bundle generator.

#### WS2 — Frontend: Refugee Registration Form

Extend patient registration modal:
- "Refugee / Asylum Seeker" toggle
- When toggled: national ID becomes optional, UNHCR ID field appears
- Country of origin, camp name, interpreter needed checkbox
- Language preference (from existing SADC language list)

No hardcoded country lists — use existing country code reference.

### Done When
- Patient registration completes with UNHCR ID and no national ID.
- UNHCR ID lookup returns correct patient.
- Refugee profile persists with camp, origin country, status.
- FHIR bundle export generates for refugee patient.
- Lint, build, tests pass.

---

## Sprint S145 — OpenLMIS Supply Chain + GS1 Barcodes

### Goal
Integrate OpenLMIS REST API for requisition orders, stock status sync, stockout alerts. Add GS1 GTIN product lookup and barcode scanner integration at pharmacy dispensing.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS openlmis_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  openlmis_id VARCHAR(50) NOT NULL UNIQUE,
  product_code VARCHAR(50),
  full_product_name VARCHAR(200) NOT NULL,
  gs1_gtin VARCHAR(14),
  unit_of_issue VARCHAR(20),
  pack_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS openlmis_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  openlmis_requisition_id VARCHAR(50),
  facility_id UUID,
  program_code VARCHAR(30) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS gs1_product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gtin VARCHAR(14) NOT NULL UNIQUE,
  product_name VARCHAR(200) NOT NULL,
  brand VARCHAR(100),
  manufacturer VARCHAR(100),
  unit VARCHAR(20),
  pack_size INTEGER,
  country_of_origin VARCHAR(3),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-openlmis-gs1.statements.ts`, version `2026.04.09.17`.

### Backend Workstreams

#### WS1 — EHR Service: OpenLMIS Integration

```
POST   /supply/openlmis/requisitions          — Create a stock requisition via OpenLMIS
GET    /supply/openlmis/requisitions          — List requisitions and status
GET    /supply/openlmis/stock-status          — Current stock levels from OpenLMIS
GET    /supply/openlmis/stockouts             — Products currently stocked out
POST   /supply/openlmis/sync                  — Pull latest stock data from OpenLMIS
```

Real OpenLMIS API:
- `POST {OPENLMIS_BASE_URL}/api/requisitions` — submit requisition
- `GET {OPENLMIS_BASE_URL}/api/stockCardSummaries` — stock levels
- Auth: OAuth2 `POST {OPENLMIS_BASE_URL}/api/oauth/token`
- Env: `OPENLMIS_BASE_URL`, `OPENLMIS_CLIENT_ID`, `OPENLMIS_CLIENT_SECRET`, `OPENLMIS_USERNAME`, `OPENLMIS_PASSWORD`

#### WS2 — EHR Service: GS1 Barcode

```
GET    /supply/gs1/:gtin                      — Look up product by GS1 GTIN
POST   /supply/gs1/catalog                    — Add product to GS1 catalog (admin)
POST   /pharmacy/dispense/scan                — Scan GS1 barcode at dispense point → return product + lot + expiry
```

GS1 GTIN lookup: first check local `gs1_product_catalog`. If not found, call GS1 Cloud API `GET https://cloud.gs1.org/api/v1/gs1/gtin/{gtin}` with `Authorization: Bearer {GS1_CLOUD_TOKEN}` (env: `GS1_CLOUD_TOKEN`). Cache result in local catalog.

Barcode scanner: frontend uses browser `BarcodeDetector` API (Web) or `expo-barcode-scanner` (mobile). On scan success → `POST /pharmacy/dispense/scan` with GTIN → return product info for dispense confirmation.

#### WS3 — Frontend: Supply Chain + Barcode UI

Extend `PharmacyDashboard.tsx`:
- Stockout alert panel (from real OpenLMIS stock status)
- Requisition submission form
- Barcode scanner button — activates camera, scans GS1 barcode, auto-populates product at dispense

No hardcoded product lists. All from real OpenLMIS + GS1 endpoints.

### Done When
- OpenLMIS requisition submits to real OpenLMIS instance.
- Stock status panel shows real stockout data.
- GS1 barcode scan returns real product name and lot from catalog or GS1 Cloud.
- Pharmacy dispense pre-populates from barcode scan.
- Lint, build, tests pass.

---

## Sprint S146 — PACTR / AfricaTrials + One Health / Zoonotic

### Goal
Add Pan African Clinical Trials Registry (PACTR) integration for Africa-specific trial matching, animal exposure history in patient registration, zoonotic disease clinical pathways, and One Health case report export.

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS animal_exposures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  recorded_by UUID,
  recorded_date DATE NOT NULL,
  animal_type VARCHAR(50) NOT NULL, -- cattle | goat | sheep | dog | rodent | wildlife | poultry | camel
  exposure_type VARCHAR(50) NOT NULL, -- bite | scratch | contact | consumption | vector_borne
  exposure_date DATE,
  exposure_location VARCHAR(200),
  animal_ill BOOLEAN,
  animal_vaccinated BOOLEAN,
  rabies_pep_started BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS one_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  animal_exposure_id UUID REFERENCES animal_exposures(id),
  suspected_zoonosis VARCHAR(100) NOT NULL, -- brucellosis | anthrax | rabies | rvf | hat | q_fever | leptospirosis
  icd10_code VARCHAR(10),
  report_date DATE NOT NULL,
  reported_by UUID,
  submitted_to_vet_authority BOOLEAN DEFAULT false NOT NULL,
  vet_authority_reference VARCHAR(50),
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Provisioning bundle: `tenant-one-health-pactr.statements.ts`, version `2026.04.09.18`.

### Backend Workstreams

#### WS1 — CDSS Service: PACTR Trial Matching

```
POST /cdss/trials/match/pactr                 — Match patient to eligible PACTR trials
GET  /cdss/trials/pactr/search                — Search PACTR registry by condition/keyword
```

Real PACTR API:
- `GET https://pactr.samrc.ac.za/RegistryDisplay.aspx` (PACTR public search — use web scraping + JSON parse if no REST API available, or check for PACTR ICTRP XML feed)
- ICTRP (WHO International Clinical Trials Registry Platform) XML feed: `https://trialsearch.who.int/` — includes PACTR registrations
- WHO ICTRP API: `GET https://trialsearch.who.int/api/search?query={condition}&registry=PACTR`
- Supplement existing `ClinicalTrialMatchingService` with PACTR source alongside ClinicalTrials.gov

#### WS2 — EHR Service: One Health + Zoonotic Controller

```
POST   /one-health/exposures                  — Record animal exposure in patient history
GET    /one-health/exposures/:patientId        — Animal exposure history
POST   /one-health/reports                    — Submit One Health case report
GET    /one-health/reports                    — List One Health reports (filter: zoonosis, date)
POST   /one-health/rabies-pep                 — Start rabies PEP schedule (5-dose Essen protocol)
GET    /one-health/rabies-pep/:patientId       — Rabies PEP dose schedule and status
```

Zoonotic disease CDSS:
```
POST /cdss/zoonotic/assess                    — Given animal exposure + symptoms → suspected zoonosis + management
```

Vet authority notification: `POST {VET_AUTHORITY_BASE_URL}/api/one-health-report` — env `VET_AUTHORITY_BASE_URL`, `VET_AUTHORITY_API_KEY`. Graceful degradation (log and mark `submitted_to_vet_authority = false` if endpoint unreachable).

Rabies PEP schedule: 5-dose Essen protocol (day 0, 3, 7, 14, 28) or 4-dose Zagreb protocol. Generate scheduled appointment dates from exposure date. Store doses as immunization records (re-use `immunization_records` table from S129 with `vaccine_name = 'Rabies vaccine'`).

#### WS3 — Frontend: One Health + Zoonotic Panel

Extend patient registration and history:
- Animal exposure section in patient history tab (not just anamnesis free text)
- Zoonotic risk alert when recording animal bite/contact
- One Health report form (submitted to vet authority)
- Rabies PEP dose schedule tracker

Extend clinical trial matching UI:
- PACTR source toggle alongside ClinicalTrials.gov
- Show PACTR trial country flag and registry number

### Done When
- Animal exposure records persist with type, date, location.
- Zoonotic disease assessment returns suspected diagnosis from real CDSS rule engine.
- One Health report submits to configured vet authority endpoint.
- Rabies PEP schedule generates real appointment dates.
- PACTR trial matching queries WHO ICTRP or PACTR feed (real external call).
- Lint, build, tests pass.

---

## Cross-Sprint Verification Checklist

For each sprint before marking complete and moving on:

### Database
- [ ] Provisioning bundle file created in `services/tenant-service/src/generated/`
- [ ] Bundle registered in `DatabaseProvisioningService.getProvisioningBundles()`
- [ ] Provisioning endpoint called and returns success
- [ ] Tenant repair endpoint called — all existing tenant DBs updated
- [ ] Direct DB query confirms new tables/columns exist in actual tenant database

### API
- [ ] All new endpoints require `X-Tenant-ID` and `Authorization` headers
- [ ] No hardcoded URLs — all external endpoints use `ConfigService` / env vars
- [ ] No mock data, stubbed responses, `setTimeout` fakes, or hardcoded arrays
- [ ] All CDSS calls route through governed pathway
- [ ] Callback/webhook endpoints registered and reachable (ngrok or configured public URL)

### Code Quality
- [ ] `npm run lint` passes for all touched files
- [ ] `npm run build` / `tsc --noEmit` passes for all touched services
- [ ] `npm test -- --runInBand` passes for all touched modules
- [ ] No TypeScript errors, no syntax errors, no `console.log` left in production paths

### Frontend
- [ ] No hardcoded label strings in clinical form components (use translation service)
- [ ] No placeholder array data (e.g., `[{id:1, name:'Test'}]`)
- [ ] Loading and error states handled (no empty div on fetch failure)
- [ ] Mobile screens follow existing offline-queue pattern for new entity types

### Git
- [ ] Commit message follows `feat(sprint-SXXX): ...` pattern
- [ ] Commit only after all checklist items above pass
- [ ] Push to `main` only after commit passes

---

## Appendix: Environment Variables Summary

All new env vars introduced across S129–S146. Add to `.env.example` and Docker Compose files.

```env
# S129 — EPI
DHIS2_BASE_URL=
DHIS2_USERNAME=
DHIS2_PASSWORD=
DHIS2_CHW_DATASET_UID=

# S130 — Outbreak
SORMAS_BASE_URL=
SORMAS_USERNAME=
SORMAS_PASSWORD=
SORMAS_REGION_UUID=
SORMAS_DISTRICT_UUID=

# S131 — Mobile Money
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=
MTN_BASE_URL=https://sandbox.momodeveloper.mtn.com
MTN_SUBSCRIPTION_KEY=
MTN_API_USER=
MTN_API_KEY=
MTN_COLLECTION_PRIMARY_KEY=
ECOCASH_BASE_URL=
ECOCASH_MERCHANT_CODE=
ECOCASH_MERCHANT_PIN=
AIRTEL_BASE_URL=https://openapi.airtel.africa
AIRTEL_CLIENT_ID=
AIRTEL_CLIENT_SECRET=
AIRTEL_COUNTRY=
AIRTEL_CURRENCY=
FLUTTERWAVE_SECRET_KEY=

# S132 — CHW
# (uses existing DHIS2 env vars)

# S134 — NHIF/CBHI
NHIF_KE_BASE_URL=https://api.nhif.or.ke
NHIF_TZ_BASE_URL=
NHIMA_BASE_URL=

# S135 — SA Interop
ETR_NET_BASE_URL=
ETR_NET_API_KEY=
NHLS_HL7_PORT=2575

# S136 — DATIM
DATIM_BASE_URL=https://datim.org
DATIM_USERNAME=
DATIM_PASSWORD=

# S137 — Africa's Talking
AT_API_KEY=
AT_USERNAME=
AT_SENDER_ID=

# S138 — OpenMRS / OpenCR
OPENMRS_BASE_URL=
OPENMRS_USERNAME=
OPENMRS_PASSWORD=
OPENCR_BASE_URL=
OPENCR_API_KEY=

# S139 — CRVS
CRVS_BASE_URL=
CRVS_API_KEY=
CRVS_COUNTRY_CODE=
ZIMSTAT_BASE_URL=
DHA_BASE_URL=

# S143 — Traditional Medicine
# (no new env vars — DB-backed herb-drug interaction table)

# S144 — Refugee
UNHCR_PROGRES_BASE_URL=
UNHCR_PROGRES_API_KEY=

# S145 — OpenLMIS / GS1
OPENLMIS_BASE_URL=
OPENLMIS_CLIENT_ID=
OPENLMIS_CLIENT_SECRET=
OPENLMIS_USERNAME=
OPENLMIS_PASSWORD=
GS1_CLOUD_TOKEN=

# S146 — One Health / PACTR
VET_AUTHORITY_BASE_URL=
VET_AUTHORITY_API_KEY=
```

---

*Master guide covers 18 sprints (S129–S146), 30 SADC health system gaps, full DB provisioning statements, real external API contracts, and no mock data. Follow sprint order — earlier sprints lay DB foundations used by later ones (e.g., S129 `dhis2_tracker_sync_log` is re-used in S136, S132 CHW visits use S133 MUAC classification).*
