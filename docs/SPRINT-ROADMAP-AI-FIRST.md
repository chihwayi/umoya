# MediCore — AI-First EHR Sprint Roadmap
### Sprints 59–117 · Complete as of 2026-03-27

**Authored:** 2026-03-18 · **Completed:** 2026-03-27
**Motto:** "AI first, Human last"
**Base sprint:** All sprints 59–117 are ✅ DONE. See completion log below.

> **STATUS: 100% AI-First maturity achieved.** Every clinical surface has AI assistance. Every AI output is visible, explainable, and auditable. The full sprint series (59 → 117) has been executed and committed.

---

## GOLDEN RULE — DATABASE PROVISIONING

> **Every single database change — new table, new column, renamed column, new index, new constraint — MUST be delivered via a provisioning script.**
>
> Pattern: `scripts/provision-sprint-NNN-<name>.ts`
>
> The script MUST:
> 1. Connect to `medicore_master`
> 2. Enumerate **all active tenants** from the `tenants` table
> 3. Connect to **each tenant database** individually
> 4. Apply all SQL using `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
> 5. Record the applied version in `tenant_schema_versions` (upsert by `bundle_id`)
> 6. Skip tenants where `bundle_id + version` already applied (idempotent)
>
> **Never** apply schema changes via raw SQL directly against a tenant DB.
> **Never** assume a column or table exists without the provision script having run.
> **Always** test with `npx ts-node scripts/provision-sprint-NNN-<name>.ts` against local dev before merging.
>
> Bundle ID format: `sprint{NN}_{snake_case_name}`
> Bundle Version format: `YYYY.MM.DD`

---

## TIER 1 — FOUNDATIONAL AI-FIRST FIXES
### Sprints 59–65 · "Fix the clay before you sculpt"

These are prerequisite to everything else. The AI is only as smart as the data it reads. Bad data models produce bad AI.

---

### Sprint 59 — Vitals Data Model Fix + Extended Vitals
**Goal:** Fix the `bloodPressure VARCHAR` bug that prevents AI alerting. Expand vitals to support clinical scoring.

**Why it's Tier 1:** You cannot run NEWS2, sepsis screening, or BP trend alerts while BP is stored as the string "120/80".

#### Backend Changes
- `services/ehr-service/src/entities/vitals.entity.ts`
  - Remove `bloodPressure: string`
  - Add `systolicBp: number`, `diastolicBp: number`
  - Add computed getter `bloodPressure` for backwards compat display
  - Add: `waistCircumference`, `headCircumference`, `muac` (mid-upper arm circumference)
  - Add: `peakFlowRate`, `gcsEye`, `gcsVerbal`, `gcsMotor`, `gcsTotalScore`
  - Add: `pupilLeft`, `pupilRight` (size in mm), `pupilReactivityLeft`, `pupilReactivityRight`
  - Add: `capillaryRefillSeconds`, `edemaGrade` (0–4 scale)
  - Add: `newsScore` (auto-calculated by service, stored for trending)
  - Add: `mewsScore`, `fallsRiskScore`, `bradenScore`
  - Add: `painLocation` (varchar), `painCharacter` (varchar — sharp/dull/burning etc.)
  - Add: `vitalSource` (manual/device/wearable/import)
- `services/ehr-service/src/vitals/vitals.service.ts`
  - Auto-calculate NEWS2 on every vitals save (no UI button needed)
  - Auto-calculate BMI if weight+height present
  - Fire critical alert if NEWS2 ≥ 7 (triggers `critical_result_alerts`)

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint59-vitals-extended.ts`
```
BUNDLE_ID  = 'sprint59_vitals_extended'
BUNDLE_VERSION = '2026.MM.DD'

SQL statements (all IF NOT EXISTS / ADD COLUMN IF NOT EXISTS):
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS systolic_bp INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS diastolic_bp INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS waist_circumference DECIMAL(5,2)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS head_circumference DECIMAL(5,2)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS muac DECIMAL(5,2)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS peak_flow_rate INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS gcs_eye INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS gcs_verbal INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS gcs_motor INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS gcs_total INT GENERATED ALWAYS AS (gcs_eye + gcs_verbal + gcs_motor) STORED
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pupil_left DECIMAL(3,1)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pupil_right DECIMAL(3,1)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pupil_reactivity_left VARCHAR(20)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pupil_reactivity_right VARCHAR(20)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS capillary_refill_seconds DECIMAL(3,1)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS edema_grade INT CHECK (edema_grade BETWEEN 0 AND 4)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS news_score INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS mews_score INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS falls_risk_score INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS braden_score INT
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pain_location VARCHAR(100)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pain_character VARCHAR(100)
  ALTER TABLE vitals ADD COLUMN IF NOT EXISTS vital_source VARCHAR(30) DEFAULT 'manual'
  -- Backfill: parse existing blood_pressure strings into systolic/diastolic
  UPDATE vitals SET
    systolic_bp = SPLIT_PART(blood_pressure, '/', 1)::INT,
    diastolic_bp = SPLIT_PART(blood_pressure, '/', 2)::INT
  WHERE blood_pressure LIKE '%/%' AND systolic_bp IS NULL
  -- Index for trending
  CREATE INDEX IF NOT EXISTS idx_vitals_news_score ON vitals(patient_id, news_score, recorded_at DESC)
  CREATE INDEX IF NOT EXISTS idx_vitals_systolic ON vitals(patient_id, systolic_bp, recorded_at DESC)
```

#### Frontend Changes
- `ehr-frontend/src/components/vitals/` — Split BP input into two fields (systolic / diastolic)
- Display NEWS2 score colour-coded (green/amber/red) on vitals entry and patient header
- Show auto-calculated BMI inline

---

### Sprint 60 — Expanded Patient Entity + SDOH
**Goal:** Make the patient record rich enough for AI risk stratification and personalized care.

**Why it's Tier 1:** The patient entity is the AI's primary context. Thin patient data = dumb AI.

#### Backend Changes
- `services/ehr-service/src/entities/patient.entity.ts`
  - Add: `ethnicity`, `race`, `preferredLanguage` (ISO 639-1 code)
  - Add: `maritalStatus` (single/married/divorced/widowed/partnered)
  - Add: `occupation`, `employmentStatus` (employed/unemployed/student/retired/disabled)
  - Add: `educationLevel` (none/primary/secondary/tertiary)
  - Add: `religion` (free-text, optional)
  - Add: `nationality`, `countryOfBirth`
  - Add: `disabilityStatus`, `disabilityType`
  - Add: `preferredProviderId` (FK users)
  - Add: `preferredPharmacyId` (FK pharmacy_suppliers)
  - Add: `smokingStatus` (never/former/current), `packYears` (decimal)
  - Add: `alcoholUse` (none/occasional/moderate/heavy), `auditCScore` (int)
  - Add: `substanceUse` (boolean), `substanceUseDetails` (text)
  - Add: `pregnancyStatus` (not_pregnant/pregnant/postpartum/unknown)
  - Add: `gestationalAgeWeeks` (int, nullable)
  - Add: `advanceDirectiveOnFile` (boolean), `advanceDirectiveDocumentId` (UUID FK documents)
  - Add: `interpreterRequired` (boolean)
- New entity: `patient_sdoh.entity.ts` (Social Determinants of Health)
  - `patientId`, `assessmentDate`
  - `housingStatus` (stable/unstable/homeless/at_risk)
  - `foodSecurityStatus` (secure/insecure/hungry)
  - `transportationAccess` (own/public/none/barrier)
  - `socialIsolationScore` (0–10)
  - `financialStrain` (none/mild/moderate/severe)
  - `literacyLevel` (adequate/limited/inadequate)
  - `icdZCodes` (JSONB array of applicable Z-codes)
  - `communityResourceReferrals` (JSONB)
  - `assessedBy`, `nextAssessmentDue`

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint60-patient-extended-sdoh.ts`
```
BUNDLE_ID = 'sprint60_patient_extended_sdoh'

SQL:
  -- patient table columns (all ADD COLUMN IF NOT EXISTS)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(100)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS race VARCHAR(100)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en'
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS occupation VARCHAR(150)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS education_level VARCHAR(50)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS religion VARCHAR(100)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality VARCHAR(100)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS country_of_birth VARCHAR(100)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS disability_status BOOLEAN DEFAULT FALSE
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS disability_type VARCHAR(200)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_provider_id UUID REFERENCES users(id) ON DELETE SET NULL
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS smoking_status VARCHAR(20)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS pack_years DECIMAL(5,1)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS alcohol_use VARCHAR(20)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS audit_c_score INT
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS substance_use BOOLEAN DEFAULT FALSE
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS substance_use_details TEXT
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS pregnancy_status VARCHAR(30)
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS gestational_age_weeks INT
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS advance_directive_on_file BOOLEAN DEFAULT FALSE
  ALTER TABLE patients ADD COLUMN IF NOT EXISTS interpreter_required BOOLEAN DEFAULT FALSE
  -- New SDOH table
  CREATE TABLE IF NOT EXISTS patient_sdoh (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    housing_status VARCHAR(30),
    food_security_status VARCHAR(30),
    transportation_access VARCHAR(30),
    social_isolation_score INT CHECK (social_isolation_score BETWEEN 0 AND 10),
    financial_strain VARCHAR(30),
    literacy_level VARCHAR(30),
    icd_z_codes JSONB NOT NULL DEFAULT '[]',
    community_resource_referrals JSONB NOT NULL DEFAULT '[]',
    assessed_by UUID REFERENCES users(id),
    next_assessment_due DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  CREATE INDEX IF NOT EXISTS idx_patient_sdoh_patient ON patient_sdoh(patient_id, assessment_date DESC)
```

#### Frontend Changes
- Expand patient registration/edit form with new demographic fields
- Add SDOH assessment tab on patient profile
- Show Z-code badges on patient header when SDOH flags are active

---

### Sprint 61 — Outcome Feedback Loop (CDSS Learning)
**Goal:** Every CDSS recommendation is tracked to its outcome. Build the closed loop the AI needs to improve.

**Why it's Tier 1:** Without outcome data, the AI is static. This closes the loop between AI suggestion → clinician action → patient outcome.

#### Backend Changes
- New entity: `cdss_decision_log.entity.ts`
  - `patientId`, `encounterId`, `userId`
  - `decisionType` (diagnosis/drug_interaction/dosing/risk/care_gap/lab_interpretation)
  - `cdssRequestPayload` (JSONB — what was sent to CDSS)
  - `cdssResponsePayload` (JSONB — what CDSS returned)
  - `topRecommendation` (varchar)
  - `confidenceScore` (decimal)
  - `clinicianAction` (accepted/modified/overridden/ignored)
  - `overrideReason` (text, required when action=overridden)
  - `patientOutcomeLinked` (FK clinical_outcomes)
  - `outcomeAt30Days`, `outcomeAt90Days` (JSONB)
  - `feedbackSentToCdss` (boolean)
  - `feedbackSentAt` (timestamptz)
- `services/cdss-service/` — New endpoint `POST /feedback/outcome` to receive outcome data
- Background job: weekly batch to match `cdss_decision_log` entries to outcomes and push to CDSS

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint61-cdss-outcome-feedback.ts`
```
BUNDLE_ID = 'sprint61_cdss_outcome_feedback'

SQL:
  CREATE TABLE IF NOT EXISTS cdss_decision_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id UUID,
    user_id UUID REFERENCES users(id),
    decision_type VARCHAR(60) NOT NULL,
    cdss_request_payload JSONB NOT NULL DEFAULT '{}',
    cdss_response_payload JSONB NOT NULL DEFAULT '{}',
    top_recommendation TEXT,
    confidence_score DECIMAL(5,4),
    clinician_action VARCHAR(20) CHECK (clinician_action IN ('accepted','modified','overridden','ignored')),
    override_reason TEXT,
    patient_outcome_id UUID REFERENCES clinical_outcomes(id) ON DELETE SET NULL,
    outcome_at_30_days JSONB,
    outcome_at_90_days JSONB,
    feedback_sent_to_cdss BOOLEAN DEFAULT FALSE,
    feedback_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  CREATE INDEX IF NOT EXISTS idx_cdss_decision_log_patient ON cdss_decision_log(patient_id, created_at DESC)
  CREATE INDEX IF NOT EXISTS idx_cdss_decision_log_type ON cdss_decision_log(decision_type, clinician_action)
  CREATE INDEX IF NOT EXISTS idx_cdss_decision_log_feedback ON cdss_decision_log(feedback_sent_to_cdss, created_at)
```

---

### Sprint 62 — Proactive Care Gap Engine
**Goal:** Convert care gap detection from a pull API into a push engine that creates nurse tasks automatically.

**Why it's Tier 1:** Pull-based care gaps mean clinicians have to remember to check. Push-based means the system acts first.

#### Backend Changes
- `services/ehr-service/src/care-gaps/care-gap-scheduler.service.ts` (new)
  - Runs nightly cron (configurable)
  - For each active patient with an appointment in the next 7 days, calls CDSS `POST /care-gaps/detect`
  - Creates `nurse_tasks` entries for detected gaps
  - Sends notification to assigned nurse
- New entity: `nurse_task.entity.ts`
  - `patientId`, `assignedToUserId`, `assignedBySystem` (boolean)
  - `taskType` (care_gap/follow_up/order_reminder/result_review/medication_check)
  - `priority` (low/medium/high/urgent)
  - `title`, `description`, `dueDate`
  - `sourceType` (cdss/manual/protocol), `sourceId`
  - `status` (pending/in_progress/completed/cancelled)
  - `completedBy`, `completedAt`, `completionNotes`
- New entity: `care_gap_detection.entity.ts`
  - `patientId`, `detectedAt`, `detectedBy` (cdss/manual)
  - `gapType`, `gapDescription`, `recommendedAction`
  - `dueDate`, `priority`, `icdCode`, `linkedTaskId`
  - `status` (open/resolved/deferred/patient_declined)

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint62-proactive-care-gaps.ts`
```
BUNDLE_ID = 'sprint62_proactive_care_gaps'

SQL:
  CREATE TABLE IF NOT EXISTS nurse_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_system BOOLEAN DEFAULT FALSE,
    task_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    source_type VARCHAR(30),
    source_id UUID,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    completed_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  CREATE TABLE IF NOT EXISTS care_gap_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detected_by VARCHAR(20) NOT NULL DEFAULT 'cdss',
    gap_type VARCHAR(100) NOT NULL,
    gap_description TEXT NOT NULL,
    recommended_action TEXT,
    due_date DATE,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    icd_code VARCHAR(20),
    linked_task_id UUID REFERENCES nurse_tasks(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_nurse_tasks_assigned_to ON nurse_tasks(assigned_to, status, due_date)
  CREATE INDEX IF NOT EXISTS idx_nurse_tasks_patient ON nurse_tasks(patient_id, status)
  CREATE INDEX IF NOT EXISTS idx_care_gap_patient ON care_gap_detections(patient_id, status)
  CREATE INDEX IF NOT EXISTS idx_care_gap_due_date ON care_gap_detections(due_date, priority, status)
```

---

### Sprint 63 — Ambient AI (Real-Time Visit Transcription → EHR)
**Goal:** During a consultation, audio is transcribed in real-time. AI populates SOAP fields, queues orders, flags drug interactions — before the doctor touches the keyboard.

**Why it's Tier 1:** This is the core "AI first" experience. Everything else is table stakes if you can't do ambient documentation.

#### Architecture
```
Browser (ehr-frontend)
  → WebSocket/WebRTC audio stream
  → EHR Service (WS endpoint: /ambient/session/:sessionId)
  → CDSS Service (streaming POST /transcription/process/stream)
  → Faster-Whisper (real-time STT)
  → Ambient AI Engine (extracts: chief complaint, HPI, medications, diagnoses, orders)
  → Push structured data back to frontend via WebSocket
  → Frontend pre-fills SOAP note fields in real-time
```

#### Backend Changes
- New entity: `ambient_session.entity.ts`
  - `patientId`, `appointmentId`, `providerId`
  - `status` (active/paused/completed/failed)
  - `audioStorageKey` (MinIO reference)
  - `transcriptRaw` (text — full transcript)
  - `structuredOutput` (JSONB — extracted entities)
  - `draftNote` (JSONB — pre-filled SOAP fields)
  - `aiSuggestedOrders` (JSONB array)
  - `aiSuggestedDiagnoses` (JSONB array)
  - `alertsRaised` (JSONB — real-time alerts during session)
  - `providerAcceptedFields` (JSONB — which AI suggestions were kept)
  - `sessionStartedAt`, `sessionEndedAt`
- `services/ehr-service/src/ambient/` — New module
  - `ambient.gateway.ts` — NestJS WebSocket gateway
  - `ambient.service.ts` — Session management, CDSS proxy
- `services/cdss-service/` — New route: `POST /transcription/stream` (streaming)
  - Chunks audio → Whisper → extract entities → return structured JSON events
  - Entity types: `diagnosis_mention`, `medication_mention`, `allergy_mention`, `order_suggestion`, `vital_mentioned`, `alert_triggered`

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint63-ambient-ai.ts`
```
BUNDLE_ID = 'sprint63_ambient_ai'

SQL:
  CREATE TABLE IF NOT EXISTS ambient_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    provider_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','paused','completed','failed')),
    audio_storage_key TEXT,
    transcript_raw TEXT,
    structured_output JSONB NOT NULL DEFAULT '{}',
    draft_note JSONB NOT NULL DEFAULT '{}',
    ai_suggested_orders JSONB NOT NULL DEFAULT '[]',
    ai_suggested_diagnoses JSONB NOT NULL DEFAULT '[]',
    alerts_raised JSONB NOT NULL DEFAULT '[]',
    provider_accepted_fields JSONB NOT NULL DEFAULT '{}',
    session_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  CREATE INDEX IF NOT EXISTS idx_ambient_session_patient ON ambient_sessions(patient_id, session_started_at DESC)
  CREATE INDEX IF NOT EXISTS idx_ambient_session_appointment ON ambient_sessions(appointment_id)
  CREATE INDEX IF NOT EXISTS idx_ambient_session_provider ON ambient_sessions(provider_id, status)
```

#### Frontend Changes
- `ehr-frontend/src/components/ambient/AmbientBar.tsx` — Sticky bar at top of encounter showing: mic on/off, live transcript ticker, suggested diagnoses (badges), suggested orders (buttons), active alerts (red)
- Doctor can one-click accept a suggestion or dismiss it
- All accepted/dismissed events are logged to `cdss_decision_log`

---

### Sprint 64 — Pre-Charting AI
**Goal:** 30 minutes before an appointment, AI prepares the chart. Doctor opens a pre-filled encounter — not a blank one.

#### Backend Changes
- `services/ehr-service/src/appointments/appointment-precharter.service.ts` (new)
  - Cron: runs every 30 minutes, finds appointments starting in 25–35 minutes
  - Calls CDSS `POST /patient/summarize` to get clinical summary
  - Calls CDSS `POST /care-gaps/detect` for this patient
  - Calls CDSS `POST /diagnosis/suggest/intelligent` with last 3 visits' chief complaints
  - Calls CDSS `POST /risk/calculate` for applicable risk scores
  - Saves result to `encounter_precharts` table
- New entity: `encounter_prechart.entity.ts`
  - `appointmentId`, `patientId`, `generatedAt`
  - `clinicalSummary` (text — AI-generated narrative)
  - `activeProblems` (JSONB)
  - `currentMedications` (JSONB)
  - `allergies` (JSONB)
  - `outstandingCareGaps` (JSONB)
  - `suggestedAgenda` (JSONB — likely topics for this visit)
  - `riskFlags` (JSONB — elevated risk scores)
  - `lastLabAbnormalities` (JSONB)
  - `lastImagingFindings` (JSONB)
  - `providerReviewed` (boolean), `providerReviewedAt`

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint64-pre-charting.ts`
```
BUNDLE_ID = 'sprint64_pre_charting'

SQL:
  CREATE TABLE IF NOT EXISTS encounter_precharts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clinical_summary TEXT,
    active_problems JSONB NOT NULL DEFAULT '[]',
    current_medications JSONB NOT NULL DEFAULT '[]',
    allergies JSONB NOT NULL DEFAULT '[]',
    outstanding_care_gaps JSONB NOT NULL DEFAULT '[]',
    suggested_agenda JSONB NOT NULL DEFAULT '[]',
    risk_flags JSONB NOT NULL DEFAULT '[]',
    last_lab_abnormalities JSONB NOT NULL DEFAULT '[]',
    last_imaging_findings JSONB NOT NULL DEFAULT '[]',
    provider_reviewed BOOLEAN DEFAULT FALSE,
    provider_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  CREATE INDEX IF NOT EXISTS idx_prechart_appointment ON encounter_precharts(appointment_id)
  CREATE INDEX IF NOT EXISTS idx_prechart_patient ON encounter_precharts(patient_id, generated_at DESC)
```

---

### Sprint 65 — Smart Inbox AI Triage
**Goal:** All incoming messages, results, alerts are AI-triaged before the doctor sees them. Critical items surface instantly. Routine items are batched.

#### Backend Changes
- New entity: `inbox_item.entity.ts`
  - `userId` (recipient), `patientId`, `sourceType` (lab_result/imaging_result/patient_message/critical_alert/task/referral_response)
  - `sourceId` (UUID), `title`, `preview` (text, 200 chars)
  - `aiPriority` (critical/urgent/routine/informational)
  - `aiPriorityReason` (text — why AI assigned this priority)
  - `aiDraftReply` (text — AI-suggested response for messages)
  - `isRead` (bool), `isActioned` (bool), `actionedAt`
  - `dueBy` (timestamptz — AI-suggested action deadline)
  - `triageScore` (int 0–100), `triageModel` (varchar)
- `services/ehr-service/src/inbox/inbox-triage.service.ts` (new)
  - Triggered when: lab result saved, imaging result saved, patient message received, critical alert created
  - Calls CDSS to score urgency
  - Creates `inbox_item` with AI priority
  - Sends WebSocket push to logged-in recipient
- Frontend: `ehr-frontend/src/components/inbox/SmartInbox.tsx`
  - Replaces current notification list
  - Colour-coded by AI priority
  - AI draft reply pre-populated for messages
  - Shows "AI says: critical — BP 180/110 on latest vitals" reasoning

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint65-smart-inbox.ts`
```
BUNDLE_ID = 'sprint65_smart_inbox'

SQL:
  CREATE TABLE IF NOT EXISTS inbox_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    title VARCHAR(255) NOT NULL,
    preview TEXT,
    ai_priority VARCHAR(20) NOT NULL DEFAULT 'routine'
      CHECK (ai_priority IN ('critical','urgent','routine','informational')),
    ai_priority_reason TEXT,
    ai_draft_reply TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_actioned BOOLEAN NOT NULL DEFAULT FALSE,
    actioned_at TIMESTAMPTZ,
    due_by TIMESTAMPTZ,
    triage_score INT,
    triage_model VARCHAR(60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_items(user_id, is_read, ai_priority, created_at DESC)
  CREATE INDEX IF NOT EXISTS idx_inbox_patient ON inbox_items(patient_id, created_at DESC)
  CREATE INDEX IF NOT EXISTS idx_inbox_critical ON inbox_items(user_id, ai_priority, is_actioned) WHERE ai_priority IN ('critical','urgent')
```

---

## TIER 2 — MISSING CLINICAL MODULES
### Sprints 66–80 · "Cover every disease burden in the region"

**Note on all Tier 2 sprints:** Each sprint creates:
1. NestJS entity files + module/service/controller
2. CDSS Python service extension (new routes/logic)
3. EHR frontend dashboard/page
4. Provisioning script (REQUIRED for all DB changes)

---

### Sprint 66 — Tuberculosis Module
**Goal:** Full TB care pathway including pulmonary TB, EPTB, MDR-TB, HIV/TB co-infection, DOT tracking. Zimbabwe has ~221 TB per 100,000.

#### Entities to Create
- `tb_patient` — TB registration, case type (pulmonary/extrapulmonary/MDR/XDR), treatment category
- `tb_diagnosis` — sputum smear result, GeneXpert result, culture result, CXR finding, anatomical site
- `tb_treatment_episode` — regimen (2HRZE/4HR etc.), start date, expected end date, outcome
- `tb_dot_record` — Daily observed therapy records, DOT worker ID, observed/unobserved, reason missed
- `tb_contact_investigation` — Household contacts, screening status, LTBI status, prophylaxis
- `tb_drug_susceptibility` — DST results, resistance pattern, date reported
- `tb_outcome` — Cured/treatment_completed/failed/died/LTFU/not_evaluated, outcome date

#### CDSS Extensions
- `POST /tb/regimen/recommend` — Based on case type and DST, suggest appropriate regimen
- `POST /tb/contact/risk` — Risk score for household contacts
- `POST /tb/dot/adherence` — Adherence trend analysis and default prediction

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint66-tb-module.ts`
```
BUNDLE_ID = 'sprint66_tb_module'
Tables: tb_patients, tb_diagnoses, tb_treatment_episodes, tb_dot_records,
        tb_contact_investigations, tb_drug_susceptibilities, tb_outcomes
All with standard id/patient_id/created_at/updated_at pattern.
Full SQL in script body.
```

---

### Sprint 67 — Pediatrics Module
**Goal:** Age-appropriate care for patients 0–18. Growth charts, developmental milestones, weight-based dosing, neonatal care.

#### Entities to Create
- `pediatric_profile` — gestation at birth, birth weight, APGAR scores, feeding type (breast/formula/mixed), neonatal complications
- `growth_measurement` — date, weight, height, head_circumference, weight_for_age_z, height_for_age_z, weight_for_height_z, bmi_for_age_z, growth_chart_percentile (WHO 2006 standards)
- `developmental_milestone` — domain (gross_motor/fine_motor/language/social/cognitive), milestone, achieved_date, age_at_achievement_months, status (achieved/delayed/referred)
- `neonatal_record` — delivery type, APGAR 1min/5min, birth weight, gestational age, resuscitation required, special care unit admission
- `school_health_record` — vision screening, hearing screening, dental status, immunization status, growth status, referrals

#### CDSS Extensions
- `POST /dosing/pediatric` — Weight-based dosing calculator (mg/kg with safe range validation)
- `POST /growth/assess` — Plot on WHO Z-score charts, flag malnutrition/stunting/wasting/overweight
- `POST /milestone/assess` — Flag developmental delays against age norms

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint67-pediatrics-module.ts`
```
BUNDLE_ID = 'sprint67_pediatrics_module'
Tables: pediatric_profiles, growth_measurements, developmental_milestones,
        neonatal_records, school_health_records
```

---

### Sprint 68 — Mental Health Module
**Goal:** Structured mental health screening, psychiatric notes, crisis protocols, medication management for psychotropics.

#### Entities to Create
- `mental_health_screening` — patientId, screeningDate, screeningType (PHQ-9/GAD-7/AUDIT-C/CAGE/DAST/CSSRS/MMSE/MoCA/EPDS/MDQ), score, interpretation, conductedBy
- `psychiatric_encounter` — presentingComplaints, mentalStatusExam (JSONB — appearance/speech/mood/affect/thought/perception/cognition/insight/judgment), riskAssessment, formulation, diagnosis, plan
- `crisis_event` — patientId, eventType (suicidal_ideation/suicide_attempt/self_harm/psychotic_break/substance_overdose), severity, trigger, intervention, hospitalizationRequired, safePlanCreated
- `safe_plan` — patientId, warningSignals, copingStrategies, supportContacts, crisisContacts, meansRestriction, followUpPlan
- `psychotropic_medication` — separate tracking for psych meds with monitoring requirements (lithium levels, clozapine WBC counts, metabolic monitoring for antipsychotics)

#### CDSS Extensions
- `POST /mental-health/screen` — Score and interpret PHQ-9, GAD-7, AUDIT-C, CSSRS
- `POST /mental-health/risk` — Suicide risk stratification
- `POST /mental-health/medication/monitor` — Alert on required monitoring (clozapine, lithium, valproate)

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint68-mental-health-module.ts`
```
BUNDLE_ID = 'sprint68_mental_health_module'
Tables: mental_health_screenings, psychiatric_encounters, crisis_events,
        safe_plans, psychotropic_medications
```

---

### Sprint 69 — Malaria Module
**Goal:** Malaria case management for endemic SADC region. RDT/microscopy workflows, treatment protocols, surveillance.

#### Entities to Create
- `malaria_case` — patientId, caseType (uncomplicated/severe), species (falciparum/vivax/malariae/ovale/knowlesi), testMethod (RDT/microscopy/PCR), parasitaemia, haemoglobin, treatmentProtocol
- `malaria_test` — testDate, testType, result (positive/negative/indeterminate), species, parasiteDensity, gametocytes, performedBy
- `malaria_treatment` — regimen (AL/ASAQ/IV_artesunate/quinine), dose, durationDays, ACT lot number, dayOneObserved, followUpDay3Results
- `malaria_contact_tracing` — household contacts, index case linked, screening dates
- `malaria_surveillance_report` — weekly aggregated data for MOHCC/DHIS2 reporting

#### CDSS Extensions
- `POST /malaria/treatment` — Species-appropriate treatment protocol recommendation
- `POST /malaria/severity` — WHO severe malaria criteria scoring

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint69-malaria-module.ts`
```
BUNDLE_ID = 'sprint69_malaria_module'
Tables: malaria_cases, malaria_tests, malaria_treatments,
        malaria_contact_tracing, malaria_surveillance_reports
```

---

### Sprint 70 — Geriatrics Module
**Goal:** Structured assessment and management for elderly patients. Frailty, cognitive decline, polypharmacy, falls, pressure injury.

#### Entities to Create
- `geriatric_assessment` — patientId, assessmentDate, clinicalFrailtyScale (1–9), barthelIndex (0–100), adlScore, iadlScore, tinnettiScore, mmseScore, mocaScore, gdsScore (geriatric depression)
- `falls_assessment` — morseScore, fallHistory (number in last year), primaryDiagnosis, ambulation, IV_line, gait, mentalStatus, medications (JSONB), riskCategory (low/medium/high), preventionPlan
- `pressure_injury_assessment` — bradenScore, existingInjuries (JSONB — site/stage/dimension/depth), preventionProtocol, repositioningSchedule, specialSurfaceRequired
- `polypharmacy_review` — totalMedications, beers_criteria_flags (JSONB), stopp_start_flags (JSONB), deprescribingRecommendations, reviewDate, reviewedBy
- `advance_care_planning` — patientId, documentType (DNACPR/living_will/health_proxy), documentDate, summary, documentStorageKey, witnessSigned, physicianSigned

#### CDSS Extensions
- `POST /geriatrics/frailty` — Clinical frailty score interpretation and care implications
- `POST /geriatrics/polypharmacy` — Beers Criteria check on medication list
- `POST /geriatrics/fall-risk` — Combined Morse/Tinetti risk assessment

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint70-geriatrics-module.ts`
```
BUNDLE_ID = 'sprint70_geriatrics_module'
Tables: geriatric_assessments, falls_assessments, pressure_injury_assessments,
        polypharmacy_reviews, advance_care_planning
```

---

### Sprint 71 — Neurology Module
**Goal:** Seizure management, stroke pathway, headache classification, Parkinson's, common neurology workflows.

#### Entities to Create
- `seizure_record` — patientId, seizureDate, seizureType (focal/generalized/unknown), duration, triggers, postictalState, injuryOccurred, witnessPresent, videoCapture, currentAED (JSONB)
- `stroke_assessment` — nihssScore, strokeType (ischemic/hemorrhagic/TIA), onsetTime, lastKnownWell, ctFindings, ivtpaAdministered, thrombectomyPerformed, mrsScore
- `headache_diary` — date/time, severity (VAS), type (migraine/tension/cluster/other), duration, triggers (JSONB), auraPresent, medicationUsed, disability (HIT-6 score)
- `neurology_examination` — cranialNerves (JSONB), motorExam (JSONB), sensoryExam (JSONB), cerebellar (JSONB), gait, reflexes (JSONB), mmt (JSONB)
- `cognitive_assessment` — mmseScore (0–30), mocaScore (0–30), assessmentDate, cdtScore, domainScores (JSONB — memory/attention/language/visuospatial/executive), interpretation, followUpDate

#### CDSS Extensions
- `POST /neurology/stroke/triage` — Onset-to-door time alerts, tPA eligibility check
- `POST /neurology/seizure/classify` — Seizure classification and AED selection guidance
- `POST /neurology/headache/diagnose` — ICHD-3 headache classification

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint71-neurology-module.ts`
```
BUNDLE_ID = 'sprint71_neurology_module'
Tables: seizure_records, stroke_assessments, headache_diaries,
        neurology_examinations, cognitive_assessments
```

---

### Sprint 72 — Pulmonology Module
**Goal:** Spirometry, COPD/asthma management, peak flow tracking, oxygen therapy, respiratory support.

#### Entities to Create
- `spirometry_result` — patientId, testDate, fvc, fev1, fev1_fvc_ratio, fef2575, pef, tlc, dlco, interpretation (normal/obstructive/restrictive/mixed), gold_stage (1-4 for COPD), pre_post_bronchodilator
- `copd_assessment` — catScore (0–40), mmrcDyspnea (0–4), abcdGroup, exacerbationHistory (JSONB), hospitalAdmissionsLast12Months, currentInhalerTherapy (JSONB)
- `asthma_record` — actScore (5–25), acqScore, severity (intermittent/mild/moderate/severe), control (controlled/partly_controlled/uncontrolled), triggerFactors (JSONB), asthmaActionPlan (JSONB — green/yellow/red zones)
- `peak_flow_diary` — date, time, pefValue, percentPredicted, symptoms, medicationTaken
- `oxygen_therapy_record` — deliveryDevice, flowRate, targetSaturation, durationHours, indication, response

#### CDSS Extensions
- `POST /pulmonology/spirometry/interpret` — GOLD staging, pattern classification
- `POST /pulmonology/asthma/stepup` — GINA step-up/step-down recommendations
- `POST /pulmonology/oxygen/prescribe` — Oxygen prescription calculator

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint72-pulmonology-module.ts`
```
BUNDLE_ID = 'sprint72_pulmonology_module'
Tables: spirometry_results, copd_assessments, asthma_records,
        peak_flow_diaries, oxygen_therapy_records
```

---

### Sprint 73 — Nephrology Module
**Goal:** CKD staging, eGFR trending, proteinuria monitoring, dialysis tracking, fluid balance.

#### Entities to Create
- `ckd_assessment` — patientId, assessmentDate, egfr, ckdStage (G1-G5), albuminCreatinineRatio, ackCategory (A1/A2/A3), primaryCause, ckdProgressionRisk (low/moderate/high/very_high), gfr_slope_monthly
- `dialysis_record` — dialysisType (haemodialysis/peritoneal/CRRT), sessionDate, sessionDuration, preWeight, postWeight, ultrafiltrationVolume, ktv, accessType (AVF/AVG/tunnelled_CVC/Tenckhoff), access_site, complications
- `fluid_balance` — patientId, date, hour, intake (oral/IV/NGT/other), output (urine/drain/stoma/other), netBalance, cumulativeBalance, recordedBy
- `renal_biopsy` — biopsyDate, indication, histopathology, eGFRAtBiopsy, pathologyReport, recommendation
- `transplant_record` — transplantDate, donorType (living/deceased), HLA_matching, immunosuppression (JSONB), rejectionEpisodes, currentGFR

#### CDSS Extensions
- `POST /nephrology/ckd/stage` — KDIGO staging + medication dose adjustment alerts
- `POST /nephrology/dialysis/adequacy` — Kt/V calculation and adequacy assessment
- `POST /nephrology/drug-dosing/renal-adjust` — Renal dose adjustment for any medication

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint73-nephrology-module.ts`
```
BUNDLE_ID = 'sprint73_nephrology_module'
Tables: ckd_assessments, dialysis_records, fluid_balance_records,
        renal_biopsies, transplant_records
```

---

### Sprint 74 — Dermatology Module
**Goal:** Skin lesion documentation, wound assessment, dermatology consultations, AI-assisted lesion classification.

#### Entities to Create
- `skin_lesion` — patientId, bodyLocation (JSONB with anatomical site + coordinates for body map), lesionType, dimensions (JSONB — length/width/depth), morphology, colour, borders, surface, evolution (JSONB — change over time), photographStorageKey, dermoscopyImageKey
- `wound_assessment` — patientId, woundType (surgical/pressure/diabetic_foot/venous/arterial/burn/trauma), location, size, depth (JSONB), tissue_type (JSONB — necrotic%/sloughy%/granulating%/epithelialising%), exudate, odour, periwound, wound_score (PUSH/BWAT), treatmentPlan, reviewDate
- `burn_assessment` — patientId, estimatedTBSA (rule of nines / Lund-Browder), burnDepth (JSONB by zone), fluidResuscitation (Parkland formula result), escharotomyRequired
- `dermatology_note` — patientId, presentingComplaint, morphologyDescription, differentialDiagnosis (JSONB), aiLesionClassification (JSONB), treatment, followUpPlan

#### CDSS Extensions
- `POST /dermatology/lesion/classify` — AI vision model for lesion classification (malignant/benign likelihood)
- `POST /dermatology/burn/fluid` — Parkland formula calculation

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint74-dermatology-module.ts`
```
BUNDLE_ID = 'sprint74_dermatology_module'
Tables: skin_lesions, wound_assessments, burn_assessments, dermatology_notes
```

---

### Sprint 75 — Palliative Care Module
**Goal:** Goals of care, symptom burden management, advance care planning, end-of-life workflows.

#### Entities to Create
- `palliative_assessment` — patientId, ecogStatus (0–4), kpsScore (0–100), palliativePhase (stable/unstable/deteriorating/terminal/dying), prognosis, prognosisDiscussedWithPatient, prognosisDiscussedWithFamily, symptomBurden (ESAS/Edmonton Symptom Assessment)
- `symptom_burden` — patientId, date, pain (0–10), fatigue, nausea, depression, anxiety, drowsiness, appetite, wellbeing, shortness_of_breath, esas_total, esas_distress_score
- `goals_of_care` — patientId, documentDate, primaryGoal (curative/life_prolonging/comfort), cpr_wishes (full_resuscitation/limited/DNR), ventilation_wishes, artificial_nutrition_wishes, hospitalization_wishes, discussion_participants (JSONB), facilitated_by
- `advance_directive_record` — documentType, documentDate, summary, witnessName, physicianName, storageKey, active, supersededById
- `palliative_medication_review` — opioidEquivalence, syringe_driver_contents (JSONB), prn_medications (JSONB), discontinued_futile_medications (JSONB)

#### CDSS Extensions
- `POST /palliative/prognosis` — PPI/Palliative Prognosis Score calculation
- `POST /palliative/opioid/convert` — Opioid equianalgesic dose conversion
- `POST /palliative/symptom/manage` — Evidence-based symptom management suggestions

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint75-palliative-care-module.ts`
```
BUNDLE_ID = 'sprint75_palliative_care_module'
Tables: palliative_assessments, symptom_burden_scores, goals_of_care,
        advance_directive_records, palliative_medication_reviews
```

---

### Sprint 76 — Nutrition & Dietetics Module
**Goal:** Nutritional risk screening, dietary prescriptions, malnutrition tracking, therapeutic feeding.

#### Entities to Create
- `nutritional_screening` — patientId, screeningTool (NRS2002/MUST/MNA/STAMP_pediatric), totalScore, riskCategory (low/moderate/high), followUpRequired
- `nutritional_assessment` — patientId, dietitianId, sgaScore, bodyComposition (JSONB — fat%/muscle%/visceral), dietaryHistory, intolerances, mealFrequency, supplements, assessmentDate
- `dietary_prescription` — patientId, calorieTarget, proteinTarget, fluidTarget, route (oral/NGT/PEG/TPN/PN), formula (for tube feeding), specialDiet (diabetic/renal/cardiac/low_sodium/low_fat/ketogenic), restrictions (JSONB)
- `nutrition_monitoring` — patientId, date, actualCaloriesIntake, actualProteinIntake, oralIntakePercent, toleranceIssues, weight, albumin, prealbumin, plan_adjustment

#### CDSS Extensions
- `POST /nutrition/screen` — NRS-2002/MUST scoring
- `POST /nutrition/prescribe` — Calorie/protein/fluid requirements calculator (Harris-Benedict, Mifflin-St Jeor)
- `POST /nutrition/refeeding-risk` — Refeeding syndrome risk assessment

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint76-nutrition-module.ts`
```
BUNDLE_ID = 'sprint76_nutrition_module'
Tables: nutritional_screenings, nutritional_assessments,
        dietary_prescriptions, nutrition_monitoring
```

---

### Sprint 77 — ICU / Critical Care Module
**Goal:** Complete ICU management: SOFA scoring, ventilator settings, sedation protocols, lines, ICU medication tracking.

#### Entities to Create
- `icu_admission` — patientId, admissionId, icuAdmissionDate, icuDischargeDate, admissionSource, primaryDiagnosis, apacheII_score, sofa_admission, icuLos, icuDischargeReason, mortalityPredicted
- `sofa_score` — patientId, scoredAt, respiration (pao2_fio2), coagulation (platelets), liver (bilirubin), cardiovascular (map/vasopressors), cns (gcs), renal (creatinine), total_sofa, delta_sofa
- `ventilator_settings` — patientId, recordedAt, mode (AC/SIMV/CPAP/PRVC/BiPAP), tidalVolume, rate, fio2, peep, iPressure, ePressure, pip, map_airway, iTime, eTime, compliance, resistance
- `sedation_record` — patientId, date, rass_target, rass_actual, cam_icu_result, analgesic (JSONB), sedative (JSONB), nmba_used, sab_hold_date, wakefulness_trial_completed
- `central_line_record` — patientId, lineType (CVL/arterial/PICC/Midline), site, insertionDate, removalDate, insertedBy, indication, dressing_changes (JSONB), infections (JSONB)
- `vasopressor_record` — patientId, drug, dose, unit, startTime, stopTime, titrations (JSONB array of {time, dose, reason})

#### CDSS Extensions
- `POST /icu/sofa/calculate` — SOFA score from lab/clinical data
- `POST /icu/vent/protocol` — ARDSnet protective ventilation calculator
- `POST /icu/sedation/assess` — RASS target and delirium screening

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint77-icu-module.ts`
```
BUNDLE_ID = 'sprint77_icu_module'
Tables: icu_admissions, sofa_scores, ventilator_settings, sedation_records,
        central_line_records, vasopressor_records
```

---

### Sprint 78 — SDOH Module (Structured Social Determinants)
**Goal:** Standalone SDOH clinical workflow including screening tools, Z-code assignment, community resource referrals.

**Note:** Sprint 60 adds SDOH fields to the patient entity. Sprint 78 builds the full workflow module.

#### Entities to Create
*(patient_sdoh already created in Sprint 60 provisioning)*
- `community_resource` — name, category (food_bank/shelter/transport/financial_assistance/mental_health/domestic_violence/employment), description, address, phone, website, eligibilityCriteria, languages, availability, tenant_specific (bool)
- `sdoh_referral` — patientId, resourceId, referralDate, referralReason, referredBy, status (sent/accepted/completed/declined), outcome, followUpDate
- `sdoh_screening_log` — patientId, screeningDate, toolUsed (PRAPARE/AHC_HRSN/SEEK), responses (JSONB), positiveScreens (JSONB), conductedBy

#### CDSS Extensions
- `POST /sdoh/screen` — Score PRAPARE/AHC-HRSN and identify Z-codes
- `POST /sdoh/resource/match` — Match patient SDOH needs to community resources

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint78-sdoh-module.ts`
```
BUNDLE_ID = 'sprint78_sdoh_module'
Tables: community_resources, sdoh_referrals, sdoh_screening_logs
```

---

### Sprint 79 — Neglected Tropical Diseases + Regional Module
**Goal:** Schistosomiasis (bilharzia), cholera, typhoid, sleeping sickness — high prevalence in Zimbabwe/SADC.

#### Entities to Create
- `ntd_case` — patientId, disease (schistosomiasis/soil_transmitted_helminth/lymphatic_filariasis/trachoma/leprosy), species, acquisitionRoute, presentingManifestations, stool_urine_result, treatment, massChemoprophylaxisCampaign
- `cholera_case` — patientId, caseClassification (suspected/probable/confirmed), onset, dehydration_severity, ivf_given, oral_rehydration, antibiotic, contactTracing, outbreak_cluster
- `typhoid_case` — widal_titer, blood_culture_result, resistance_pattern, chloramphenicol_sensitivity, treatment, complication
- `regional_disease_report` — aggregated weekly/monthly reports for MOHCC submission (malaria + NTDs + cholera + typhoid)

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint79-ntd-regional.ts`
```
BUNDLE_ID = 'sprint79_ntd_regional'
Tables: ntd_cases, cholera_cases, typhoid_cases, regional_disease_reports
```

---

### Sprint 80 — Advanced HIV Module (PMTCT + PEPFAR MER)
**Goal:** Complete PMTCT workflows, PEPFAR MER indicator reporting, DATIM-compatible data export.

#### Entities to Create
*(Extends existing hiv_patient, hiv_appointment entities)*
- `pmtct_enrollment` — patientId (mother), gestationalAgeAtEnrollment, hivStatusAtBooking, artStarted, artRegimen, viralLoadAtBooking, viralLoadAtDelivery, deliveryMode, infantNvpProvided
- `pmtct_infant` — motherPatientId, infantPatientId, birthDate, birthWeight, hiv_test_at_6weeks, dbs_result_6weeks, hiv_test_18months, final_hiv_status, breastfeedingStatus, cotrimoxazole_started
- `pepfar_mer_indicator` — reportingPeriod (quarter), indicator (TX_CURR/TX_NEW/TX_PVLS/HTS_TST/PMTCT_STAT/PMTCT_ART/etc.), numerator, denominator, disaggregations (JSONB), submittedToDataIM
- `art_cohort` — cohortStartDate, cohortSize, alive_on_art_12m, lost_to_followup_12m, died_12m, transferred_out_12m, retention_rate

#### CDSS Extensions
- `POST /hiv/pmtct/risk` — Mother-to-child transmission risk calculation
- `POST /hiv/mer/calculate` — PEPFAR MER indicator aggregation

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint80-advanced-hiv-pmtct-pepfar.ts`
```
BUNDLE_ID = 'sprint80_advanced_hiv_pmtct_pepfar'
Tables: pmtct_enrollments, pmtct_infants, pepfar_mer_indicators, art_cohorts
```

---

## TIER 3 — ELITE AI FEATURES
### Sprints 81–95 · "Make the AI act first, not respond"

---

### Sprint 81 — Auto-ICD-10/CPT Coding NLP Pipeline
**Goal:** Every saved clinical note is processed by NLP to extract diagnosis codes and procedure codes automatically. Doctor reviews, doesn't type from scratch.

#### Architecture
```
Note saved → EHR Service event → CDSS Service POST /nlp/extract-codes
  → spaCy + medspacy + clinical NER pipeline
  → Returns: ICD-10 suggestions (ranked by confidence), CPT suggestions
  → Saved to auto_coding_suggestions table
  → Doctor reviews in billing interface — 1-click confirm or edit
  → Confirmed codes flow to billing automatically
```

#### Backend Changes
- New entity: `auto_coding_suggestion.entity.ts`
  - `noteId`, `patientId`, `encounterId`
  - `suggestedIcd10Codes` (JSONB array — code/description/confidence/evidence_span)
  - `suggestedCptCodes` (JSONB array)
  - `reviewStatus` (pending/confirmed/modified/rejected)
  - `confirmedCodes` (JSONB — final codes after review)
  - `reviewedBy`, `reviewedAt`
  - `codingModel` (which NLP model version)
- CDSS: `POST /nlp/extract-codes` — NER on clinical text → ICD-10 / CPT
- CDSS: Add `medspacy` + `scispacy` + `en_core_sci_lg` to Python deps
- Hook into medical_records save → fire async coding job

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint81-auto-coding.ts`
```
BUNDLE_ID = 'sprint81_auto_coding'
Tables: auto_coding_suggestions
Indexes: on note_id, review_status, patient_id
```

---

### Sprint 82 — Pharmacogenomics Module
**Goal:** PGx-guided prescribing. Flag patients whose genetics predict poor drug metabolism or adverse reactions.

#### Entities to Create
- `pgx_profile` — patientId, genotypeSource (lab_test/patient_reported/inferred), reportDate
  - CYP2D6 phenotype (poor/intermediate/normal/ultrarapid metabolizer)
  - CYP2C19 phenotype
  - CYP2C9 phenotype + VKORC1 (warfarin sensitivity)
  - TPMT (thiopurine — azathioprine/6-MP risk)
  - HLA_B_5701 (abacavir hypersensitivity)
  - HLA_B_1502 (carbamazepine SJS risk — critical for Asian populations)
  - SLCO1B1 (statin myopathy risk)
  - G6PD status (primaquine/dapsone haemolysis risk — critical for Africa)
  - UGT1A1 (irinotecan toxicity)
  - rawGenotypingData (JSONB)
- `pgx_alert` — patientId, drug, pgxInteraction, clinicalImplication, alternativeRecommended, severity, generated_at

#### CDSS Extensions
- `POST /pgx/check` — Given drug + patient PGx profile → flag interactions
- Integrate into existing prescribing workflow (fires on every new prescription)

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint82-pharmacogenomics.ts`
```
BUNDLE_ID = 'sprint82_pharmacogenomics'
Tables: pgx_profiles, pgx_alerts
```

---

### Sprint 83 — Local Antibiogram AI
**Goal:** Antimicrobial recommendations based on actual local resistance patterns, not generic guidelines.

#### Entities to Create
- `antibiogram_entry` — tenant-specific, organism, antibiotic, year, quarter, susceptiblePercent, intermediatePercent, resistantPercent, totalIsolates, specimenType (wound/urine/blood/sputum/stool), ward
- `antibiogram_summary` — aggregated per period, used by CDSS for empirical recommendations
- `culture_sensitivity_result` — (extends existing lab results) — organism isolated, disk_diffusion results (JSONB), MIC values (JSONB), CLSI interpretation (S/I/R)

#### CDSS Extensions
- `POST /antimicrobial/empirical` — Given: infection site + patient risk factors → recommend antibiotic based on local antibiogram (not just global guidelines)
- `POST /antimicrobial/deescalate` — Once culture is back → suggest de-escalation from empirical to targeted therapy
- Background job: monthly antibiogram recalculation from culture_sensitivity_results

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint83-antibiogram.ts`
```
BUNDLE_ID = 'sprint83_antibiogram'
Tables: antibiogram_entries, antibiogram_summaries, culture_sensitivity_results
```

---

### Sprint 84 — AI Explainability Layer
**Goal:** Every AI recommendation carries: confidence score, reasoning chain, top 3 evidence citations, and override tracking. Nothing is a black box.

#### Architecture
Every CDSS response gets an `explanation` envelope added:
```json
{
  "recommendation": "...",
  "confidence": 0.87,
  "reasoning": "Patient has eGFR 35 mL/min; metformin is contraindicated below 30 but warrants monitoring at this level. Local guideline ZW-MOHCC-2024 recommends dose reduction.",
  "evidence": [
    { "source": "ZW-MOHCC Clinical Guidelines 2024", "section": "Diabetes §4.3", "strength": "A" },
    { "source": "KDIGO 2022 CKD Guidelines", "strength": "1B" }
  ],
  "alternatives_considered": ["..."],
  "override_logged": false
}
```

#### Backend Changes
- All CDSS endpoint responses wrapped in `ExplainedRecommendation<T>` Pydantic model
- New entity: `ai_recommendation_audit.entity.ts`
  - `decisionLogId` (FK cdss_decision_log), `recommendationType`
  - `confidence`, `reasoning`, `evidence` (JSONB), `alternatives` (JSONB)
  - `overrideLogged`, `overrideReason`, `overrideBy`
  - `displayedToUser` (bool), `userReadAt`
- Frontend: Every AI badge/alert has an expandable "Why?" panel showing reasoning and citations

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint84-ai-explainability.ts`
```
BUNDLE_ID = 'sprint84_ai_explainability'
Tables: ai_recommendation_audits
```

---

### Sprint 85 — Streaming Differential Diagnosis
**Goal:** As the doctor types chief complaint + HPI, the differential diagnosis updates in real-time. No submit button.

#### Architecture
```
Doctor types in HPI field (debounced 800ms)
  → Frontend sends partial text to EHR Service
  → EHR Service calls CDSS POST /diagnosis/suggest/stream (SSE/WebSocket)
  → CDSS returns streaming ranked differential (top 5)
  → Frontend shows live-updating "AI thinks..." panel beside the HPI field
  → Each diagnosis badge is clickable → expands to show supporting criteria
```

#### Backend Changes
- CDSS: `POST /diagnosis/suggest/stream` — SSE endpoint for streaming differential
- CDSS: Caches last request per patient/session to avoid redundant re-computation
- Frontend: `DiagnosticAssistPanel.tsx` — right sidebar in encounter form
  - Shows: ranked differential with confidence, supporting findings, red-flag alerts
  - Click a diagnosis → auto-populate ICD-10, suggest relevant investigations

---

### Sprint 86 — Smart Scheduling AI
**Goal:** AI predicts no-shows, recommends optimal appointment duration, and fills cancellations proactively.

#### Entities to Create
- `scheduling_ai_prediction` — appointmentId, noShowProbability, cancelProbability, recommendedDuration (minutes), confidenceScore, featureImportance (JSONB), model, predictionDate
- Extend `appointments` entity:
  - Add `aiRecommendedDuration INT`
  - Add `noShowRisk VARCHAR(20)` (low/medium/high)
  - Add `overbookingSlot BOOLEAN` (this appointment fills an overbooking slot)

#### CDSS Extensions
- `POST /scheduling/predict` — No-show/cancel risk, duration recommendation
- Background job: run prediction for all next-7-day appointments each morning
- Notification to scheduler: "3 high no-show risk appointments tomorrow — consider double-booking slot 2PM"

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint86-smart-scheduling.ts`
```
BUNDLE_ID = 'sprint86_smart_scheduling'
Tables: scheduling_ai_predictions
Columns: ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ai_recommended_duration INT
         ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_risk VARCHAR(20)
         ALTER TABLE appointments ADD COLUMN IF NOT EXISTS overbooking_slot BOOLEAN DEFAULT FALSE
```

---

### Sprint 87 — Smart Defaults + Dynamic Forms
**Goal:** Forms adapt to patient context. Fields pre-populate from AI inference. Irrelevant fields hide automatically.

#### Implementation
- `services/ehr-service/src/form-intelligence/` — New module
  - `SmartDefaultsService` — Given patient context (age, sex, diagnoses, medications), returns a map of field → suggested value + confidence
  - `FormVisibilityService` — Returns field visibility rules based on context
- Rules engine (simple JSON-based, configurable per tenant):
  - `gender=female AND age=12-55` → show `pregnancy_status`
  - `diagnoses includes T2DM` → pre-populate `blood_glucose` units, show HbA1c trend
  - `child < 18` → switch `weight_based_dosing=true`, show growth chart link
  - `BP systolic > 160` → auto-trigger hypertension care gap
- New entity: `form_intelligence_config.entity.ts` — tenant-configurable rules (JSON)

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint87-smart-defaults.ts`
```
BUNDLE_ID = 'sprint87_smart_defaults'
Tables: form_intelligence_configs
```

---

### Sprint 88 — Formulary Optimization AI
**Goal:** When prescribing, AI shows: branded drug vs generic alternative, cost difference, medical aid formulary status, equivalent efficacy score.

#### Entities to Create
- `formulary_ai_suggestion` — prescriptionId, brandedDrug, genericAlternative, brandedCost, genericCost, savingAmount, medicalAidCoverage (bool), medicalAidTier, evidenceEquivalence (A/B/C), aiRecommendation (generic/branded/no_substitute), reason, accepted (bool)
- Extend `drugs` table:
  - Add `generic_name_canonical VARCHAR` (normalized)
  - Add `formulary_tier INT` (1–4)
  - Add `average_unit_cost_usd DECIMAL(10,4)`
  - Add `bioequivalent_group VARCHAR` (same as reference drug group)

#### CDSS Extensions
- `POST /formulary/optimize` — Given prescription → return generic alternatives with cost/evidence comparison
- Fires automatically on every new prescription created

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint88-formulary-optimization.ts`
```
BUNDLE_ID = 'sprint88_formulary_optimization'
Tables: formulary_ai_suggestions
Columns: ALTER TABLE drugs ADD COLUMN IF NOT EXISTS generic_name_canonical VARCHAR(255)
         ALTER TABLE drugs ADD COLUMN IF NOT EXISTS formulary_tier INT
         ALTER TABLE drugs ADD COLUMN IF NOT EXISTS average_unit_cost_usd DECIMAL(10,4)
         ALTER TABLE drugs ADD COLUMN IF NOT EXISTS bioequivalent_group VARCHAR(100)
```

---

### Sprint 89 — Predictive Deterioration & Readmission AI
**Goal:** Predict which inpatients will deteriorate and which discharged patients will be readmitted within 30 days.

#### Entities to Create
- `deterioration_prediction` — patientId, admissionId, predictionTime, deteriorationScore (0–100), predictedEventType (sepsis/respiratory_failure/cardiac_arrest/AKI), predictedTimeframe (hours), featureContributions (JSONB), triggered_alert (bool)
- `readmission_prediction` — patientId, dischargeId, predictionDate, readmission30DayRisk (0–1), riskCategory (low/medium/high), keyRiskFactors (JSONB), recommendedFollowUpInterval, predictionModel
- Extend `discharges` table:
  - Add `readmission_risk_score DECIMAL(5,4)`
  - Add `readmission_risk_category VARCHAR(20)`
  - Add `ai_followup_recommendation TEXT`

#### CDSS Extensions
- `POST /risk/deterioration` — Modified Early Warning Score + ML model for inpatient deterioration
- `POST /risk/readmission` — LACE+/HOSPITAL score + local ML model
- Runs every 4 hours on all active admissions

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint89-predictive-deterioration.ts`
```
BUNDLE_ID = 'sprint89_predictive_deterioration'
Tables: deterioration_predictions, readmission_predictions
Columns: ALTER TABLE discharges ADD COLUMN IF NOT EXISTS readmission_risk_score DECIMAL(5,4)
         ALTER TABLE discharges ADD COLUMN IF NOT EXISTS readmission_risk_category VARCHAR(20)
         ALTER TABLE discharges ADD COLUMN IF NOT EXISTS ai_followup_recommendation TEXT
```

---

### Sprint 90 — Federated Learning Infrastructure
**Goal:** AI models improve from outcomes across all tenants without any patient data leaving each clinic's database.

#### Architecture
```
Each Tenant DB                     Central CDSS
  └─ Outcomes + CDSS decisions     └─ Aggregation Server
       ↓ (local training)               ↑
  Local gradient updates ──────────────┘
  (no raw patient data sent)

Differential privacy noise added before transmission.
Central model aggregated monthly.
Tenants receive updated model weights.
```

#### Backend Changes
- New CDSS service: `federated_learning/`
  - `fl_coordinator.py` — Orchestrate federated rounds
  - `fl_local_trainer.py` — Train local model on tenant outcomes data
  - `fl_aggregator.py` — FedAvg algorithm, differential privacy (add Gaussian noise to gradients)
- New master DB table: `fl_rounds` — roundId, startDate, participatingTenants, modelVersion, aggregationMethod, deployedAt
- New tenant table: `fl_participation_log` — roundId, gradientHash, trainingLoss, dataPointsUsed, sentAt

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint90-federated-learning.ts`
```
BUNDLE_ID = 'sprint90_federated_learning'
Tenant Tables: fl_participation_logs
Master DB Tables (apply to medicore_master): fl_rounds
```

---

### Sprint 91 — PEPFAR MER + MOHCC HIMIS + OpenMRS Compatibility
**Goal:** Regulatory reporting for Zimbabwe. PEPFAR MER indicators, MOHCC national reporting, OpenMRS patient import.

#### Backend Changes
- `services/ehr-service/src/reporting/pepfar/` — MER indicator calculator
  - TX_CURR, TX_NEW, TX_PVLS, HTS_TST, HTS_TST_POS, PMTCT_STAT, PMTCT_ART, TB_ART, TB_PREV
  - Export to DATIM-compatible XML/JSON format
- `services/ehr-service/src/reporting/mohcc/` — Zimbabwe national reporting
  - HMIS 004 (OPD attendance), HMIS 006 (maternity), HMIS 015 (lab), HMIS 022 (TB)
  - Monthly aggregated CSV exports matching MOHCC templates
- `services/ehr-service/src/interoperability/openmrs/` — OpenMRS 2.x import
  - Parse OpenMRS patient export JSON → MediCore patient entity mapping
  - Medication, diagnosis, visit history migration

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint91-regulatory-reporting.ts`
```
BUNDLE_ID = 'sprint91_regulatory_reporting'
Tables: pepfar_mer_exports, mohcc_report_submissions, openmrs_migration_logs
```

---

### Sprint 92 — Bidirectional FHIR Reconciliation
**Goal:** Receive FHIR R4 bundles from external systems, parse them, and reconcile with existing patient data with conflict resolution.

#### Backend Changes
- `services/ehr-service/src/fhir/` — Extend existing FHIR module
  - `FhirInboundService` — Accept `POST /fhir/Bundle`
  - Parse FHIR Patient, Observation, MedicationRequest, Condition, DiagnosticReport resources
  - Map to internal entities
  - Conflict resolution: newer timestamp wins for observations; all diagnoses merged with source tag; medications flagged for pharmacist review if duplicate
- New entity: `fhir_ingestion_log.entity.ts`
  - `sourceSystem`, `bundleId`, `receivedAt`, `resourcesReceived`, `resourcesImported`, `conflictsDetected`, `conflictsResolved`, `status`
- `POST /fhir/Patient/:id/$summary` — Outbound patient summary as FHIR DocumentReference

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint92-fhir-bidirectional.ts`
```
BUNDLE_ID = 'sprint92_fhir_bidirectional'
Tables: fhir_ingestion_logs
```

---

### Sprint 93 — Multilingual AI Patient Education
**Goal:** AI-generated patient education materials in Shona, Ndebele, English, and Portuguese (for Mozambique/Angola SADC expansion).

#### Architecture
```
Diagnosis/prescription saved
  → Education content generator (CDSS POST /education/generate)
  → Templates per condition + language
  → Reading level adaptation (plain language for low literacy)
  → Stored as patient_education_materials
  → Delivered via: patient portal, SMS (short form), print PDF
```

#### Backend Changes
- New entity: `patient_education_material.entity.ts`
  - `patientId`, `encounterId`, `topic`, `language`, `readingLevel` (grade 4/6/8)
  - `content` (text), `contentHtml`, `pdfStorageKey`
  - `deliveryMethod` (portal/sms/printed), `deliveredAt`
  - `aiGenerated` (bool), `templateId`
- CDSS: `POST /education/generate` — Condition + language + literacy level → patient education text
- LLM prompt: "Write a patient education message about [condition] in [language] at Grade [N] reading level. Include: what it is, what to watch for, when to go to hospital."

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint93-multilingual-education.ts`
```
BUNDLE_ID = 'sprint93_multilingual_education'
Tables: patient_education_materials, education_templates
```

---

### Sprint 94 — Offline Mode + Background Sync (PWA)
**Goal:** Clinicians can use the EHR during power outages or poor connectivity. Data syncs when connection restores.

#### Architecture
```
EHR Frontend (PWA)
  ├─ Service Worker: caches critical app shell + recent patient data
  ├─ IndexedDB: stores offline writes (vitals, notes, orders)
  ├─ Sync Queue: processes IndexedDB on connectivity restore
  └─ Conflict Resolution: server wins for lab results; client wins for new entries
```

#### Backend Changes
- New entity: `sync_queue_log.entity.ts` (tenant DB)
  - `clientId`, `operationType` (create/update), `entityType`, `entityId`
  - `payload` (JSONB), `syncStatus` (pending/synced/conflict/failed)
  - `clientTimestamp`, `serverTimestamp`, `conflictDetails`
- `POST /sync/batch` — Accept array of offline writes, apply with conflict resolution, return results
- `GET /sync/checkpoint` — Returns last-sync timestamp + list of changes since then for a user
- Frontend: Offline banner with sync status indicator; offline-capable pages: patient list, vitals entry, note creation, prescription entry

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint94-offline-sync.ts`
```
BUNDLE_ID = 'sprint94_offline_sync'
Tables: sync_queue_logs
```

---

### Sprint 95 — Wearables & IoT Integration Pipeline
**Goal:** Ingest patient-generated health data from wearables, CGMs, BP monitors, pulse oximeters into the EHR.

#### Architecture
```
Patient Device (Apple Health / Google Fit / Libre CGM / Withings / Fitbit)
  → Patient Portal (OAuth2 device authorization)
  → Ingestion endpoint: POST /iot/data
  → FHIR Device + Observation resources
  → Normalized into: vitals / glucose_monitoring / remote_patient_monitoring
  → AI analyzes trend → triggers alerts if thresholds exceeded
```

#### Backend Changes
- New entity: `iot_device_registration.entity.ts`
  - `patientId`, `deviceType` (CGM/BP_monitor/pulse_oximeter/smartwatch/scale)
  - `manufacturer`, `model`, `serialNumber`
  - `oauthTokenEncrypted`, `oauthExpiresAt`, `lastSyncAt`
  - `status` (active/revoked/expired)
- New entity: `iot_data_ingestion.entity.ts`
  - `patientId`, `deviceId`, `measurementType`, `value`, `unit`
  - `measuredAt`, `ingestedAt`, `fhirObservationId`
  - `aiProcessed` (bool), `alertTriggered` (bool)
- Extend `remote_patient_monitoring` entity — add: `deviceId`, `dataSource` (manual/iot/import)
- CDSS: `POST /iot/analyze` — Pattern analysis on time-series device data → trend alerts

#### Provisioning Script (REQUIRED)
`scripts/provision-sprint95-iot-wearables.ts`
```
BUNDLE_ID = 'sprint95_iot_wearables'
Tables: iot_device_registrations, iot_data_ingestions
Columns: ALTER TABLE remote_patient_monitoring ADD COLUMN IF NOT EXISTS device_id UUID
         ALTER TABLE remote_patient_monitoring ADD COLUMN IF NOT EXISTS data_source VARCHAR(30)
```

---

## SPRINT EXECUTION GUIDE

### For Every Sprint, Follow This Order:
1. **Write provisioning script first** — `scripts/provision-sprint-NNN-*.ts`
2. **Test provisioning** — `npx ts-node scripts/provision-sprint-NNN-*.ts` against local dev
3. **Create/update entity files** — `services/ehr-service/src/entities/`
4. **Create module/service/controller** — `services/ehr-service/src/[module]/`
5. **Extend CDSS service** — `services/cdss-service/` (Python)
6. **Build frontend components** — `ehr-frontend/src/`
7. **Wire to patient portal** if patient-facing
8. **Write smoke test** — `scripts/smoke-[module].mjs`
9. **Run smoke test** — verify end-to-end
10. **Update `clinic-template.sql`** — add new tables to the canonical template for new tenant provisioning

### Running a Provision Script
```bash
# Local dev
npx ts-node scripts/provision-sprint59-vitals-extended.ts

# Against specific DB host
DB_HOST=prod-db.example.com DB_PASSWORD=secret npx ts-node scripts/provision-sprint59-vitals-extended.ts

# Verify applied
psql -d <tenant_db> -c "SELECT * FROM tenant_schema_versions ORDER BY applied_at DESC LIMIT 10;"
```

### Sprint Duration Recommendation
| Tier | Sprints | Recommended Duration Each |
|------|---------|--------------------------|
| Tier 1 | 59–65 | 1–2 weeks |
| Tier 2 | 66–80 | 1–2 weeks |
| Tier 3 | 81–95 | 2–3 weeks |

### Priority Order Within Each Tier
**Do not start Tier 2 until Sprint 59 + 60 are complete** — the patient entity fix and vitals fix are referenced by almost every module. Do not start Tier 3 until Sprint 61 (outcome feedback) is in place — without it, the elite AI features have no learning foundation.

---

## Summary: Complete Gap Closure

### Original Roadmap — Sprints 59–95 (all ✅ DONE 2026-03-18 to 2026-03-20)

| # | Sprint | Gap Closed | Tier | Status |
|---|--------|-----------|------|--------|
| 59 | Vitals Extended | BP data model bug, NEWS2 auto-calc, extended measurements | 1 | ✅ DONE |
| 60 | Patient Extended + SDOH | Thin patient entity, missing SDOH | 1 | ✅ DONE |
| 61 | CDSS Outcome Feedback | AI doesn't learn from outcomes | 1 | ✅ DONE |
| 62 | Proactive Care Gaps | Pull-based gaps become push | 1 | ✅ DONE |
| 63 | Ambient AI | In-visit AI documentation | 1 | ✅ DONE |
| 64 | Pre-Charting AI | Charts start blank not pre-filled | 1 | ✅ DONE |
| 65 | Smart Inbox | Unfiltered message/result queue | 1 | ✅ DONE |
| 66 | TB Module | Missing critical regional disease | 2 | ✅ DONE |
| 67 | Pediatrics | No pediatric-specific workflows | 2 | ✅ DONE |
| 68 | Mental Health | No psychiatric/screening workflows | 2 | ✅ DONE |
| 69 | Malaria | Missing endemic disease | 2 | ✅ DONE |
| 70 | Geriatrics | No frailty/cognitive/polypharmacy tools | 2 | ✅ DONE |
| 71 | Neurology | No seizure/stroke/headache workflows | 2 | ✅ DONE |
| 72 | Pulmonology | No spirometry/COPD/asthma action plans | 2 | ✅ DONE |
| 73 | Nephrology | No CKD/dialysis/GFR trending | 2 | ✅ DONE |
| 74 | Dermatology | No wound/lesion tracking | 2 | ✅ DONE |
| 75 | Palliative Care | No end-of-life workflows | 2 | ✅ DONE |
| 76 | Nutrition | No dietetics/malnutrition module | 2 | ✅ DONE |
| 77 | ICU | No SOFA/ventilator/ICU tracking | 2 | ✅ DONE |
| 78 | SDOH Full Module | SDOH workflow incomplete | 2 | ✅ DONE |
| 79 | NTD / Regional | No NTD, cholera, typhoid | 2 | ✅ DONE |
| 80 | PMTCT + PEPFAR | No PMTCT, PEPFAR MER reporting | 2 | ✅ DONE |
| 81 | Auto-Coding NLP | Manual ICD-10/CPT coding | 3 | ✅ DONE |
| 82 | Pharmacogenomics | No PGx-guided prescribing | 3 | ✅ DONE |
| 83 | Local Antibiogram | Generic antibiotic recommendations | 3 | ✅ DONE |
| 84 | AI Explainability | Black-box AI recommendations | 3 | ✅ DONE |
| 85 | Streaming Differential | Manual diagnosis lookup | 3 | ✅ DONE |
| 86 | Smart Scheduling | No no-show prediction | 3 | ✅ DONE |
| 87 | Smart Defaults/Dynamic Forms | Blank forms, no context awareness | 3 | ✅ DONE |
| 88 | Formulary Optimization | No cost/generic substitution AI | 3 | ✅ DONE |
| 89 | Predictive Deterioration | No deterioration/readmission AI | 3 | ✅ DONE |
| 90 | Federated Learning | Static AI models | 3 | ✅ DONE |
| 91 | Regulatory Reporting | No PEPFAR/MOHCC/OpenMRS | 3 | ✅ DONE |
| 92 | Bidirectional FHIR | Outbound-only interoperability | 3 | ✅ DONE |
| 93 | Multilingual Education | English-only patient education | 3 | ✅ DONE |
| 94 | Offline Mode | No offline capability | 3 | ✅ DONE |
| 95 | Wearables/IoT | No patient device data ingestion | 3 | ✅ DONE |

---

### Extension Sprints — World-Class Completion (96–102, 104–108, 109–111)

Gaps identified after S95 completion. Executed 2026-03-19 to 2026-03-22.

| # | Sprint | Gap Closed | Status |
|---|--------|-----------|--------|
| 96 | Radiology AI | DicomStudy + RadiologyAiFinding; CXR/retinal/derm AI via CDSS `/radiology/analyze` | ✅ DONE |
| 97 | Real-Time Critical Alert Delivery | FCM push → WebSocket → SMS fallback, CriticalAlertGateway, delivery tracking | ✅ DONE |
| 98 | AI Model Drift & Fairness Monitoring | ModelPerformanceMetric + ModelFairnessReport; weekly AUC/Brier/calibration + fairness breakdown | ✅ DONE |
| 99 | Patient Conversational AI | SymptomCheckerSession + AdherenceChatLog; symptom checker, adherence chatbot, mental health check-in | ✅ DONE |
| 100 | Clinical Trial Matching | AI scoring against oncology/HIV/TB/rare-disease trials; weekly re-check cron | ✅ DONE |
| 101 | Supply Chain Stockout Prediction | Consumption velocity, days-to-stockout projection, auto-procurement alerts at <30 days | ✅ DONE |
| 102 | Real CDSS Microservice Completion | All missing Python endpoints: deterioration, readmission, PGx, formulary, radiology, trial-match, stockout | ✅ DONE |
| 103 | *(skipped — gap analysis)*  | | — |
| 104 | Telemedicine Real Video (Daily.co) | Replace stub video service; real Daily.co room/token/recording APIs | ✅ DONE |
| 105 | Telemedicine WebSocket Gateway | `/telemedicine` namespace; participant events, quality/issue reporting | ✅ DONE |
| 106 | Telemedicine Notifications + State Machine | SMS notifications, status state machine, fixed PUT endpoint, reminder cron | ✅ DONE |
| 107 | Telemedicine ↔ PostVisit Bridge | Auto-create PostVisit session on consultation end; recording upload + transcription kickoff | ✅ DONE |
| 108 | PostVisit Service Decomposition | God Class → 5 focused services; inline DDL removed; controller validation hardened | ✅ DONE |
| 109 | Encounter + Pharmacy Intelligence | Encounter copilot, pharmacy substitution, order appropriateness AI | ✅ DONE |
| 110 | AI-First Hardening (Governed CDSS) | All clinical AI surfaces routed through governed CDSS gateway with HIPAA guardrails | ✅ DONE |
| 111 | Encounter Copilot + Pharmacy Curbside | Ambient session AI, pre-auth AI, pharmacy intelligence completion | ✅ DONE |

---

### AI-First Maturity Sprints 112–117 — 100% Coverage (all ✅ DONE 2026-03-27)

Executed to close every remaining gap identified in `docs/SPRINT_VALIDATION_AI_FIRST_MATURITY.md`.

| # | Sprint | Doc | Gap Closed | Status |
|---|--------|-----|-----------|--------|
| 112 | P0 Safety Foundations | `SPRINT_112_P0_SAFETY_FOUNDATIONS.md` | SQLite→PG feedback migration, consent guard, AES-256 encryption, contraindication hard-stop, inbox triage fix | ✅ DONE |
| 113 | UI Completeness | `SPRINT_113_UI_COMPLETENESS.md` | 8 UI wiring items: ML deterioration widget, pharmacy adherence timeline, guideline citation chip, imaging SLA badge, SDOH widget | ✅ DONE |
| 114 | Clinical RAG | `SPRINT_114_CLINICAL_RAG.md` | pgvector RAG — PDF/DOCX upload → embed → hybrid BM25+vector search; replaces hallucinated citations | ✅ DONE |
| 115 | Denial Prediction | `SPRINT_115_DENIAL_PREDICTION.md` | Denial prediction ML, appeal letter drafting, financial hardship routing, PDMP drug check | ✅ DONE |
| 116 | Risk Stratification + Self-Learning | `SPRINT_116_RISK_STRATIFICATION_SELF_LEARNING.md` | 6-dimension risk engine, nightly batch, self-learning flywheel, model release gates, AI Ops Dashboard | ✅ DONE |
| 117 | Registration AI + DICOM Viewer | `SPRINT_117_REGISTRATION_AND_RADIOLOGY_VIEWER.md` | Phonetic patient matching, insurance card OCR, SDOH intake (AHC HRSN), DICOM viewer with AI heatmap overlay | ✅ DONE |

---

## Post-Maturity Hardening Sprints (118+)

> Identified via full AI/CDSS system audit (2026-03-27). These sprints improve AI display quality, compliance, and clinical coverage beyond the initial maturity baseline.

| Sprint | Focus | Doc | Description | Status |
|--------|-------|-----|-------------|--------|
| 118 | Frontend AI Transparency | `SPRINT_118_FRONTEND_AI_TRANSPARENCY.md` | Universal AiOutputWrapper, useCdssResponse hook, abstention handling, confidence bands, 6 P0 crash fixes, FDA SaMD disclosure compliance | ✅ DONE |
| 119 | Clinical Order Intelligence | inline | Order set suggestions (AI-driven), imaging appropriateness (ACR-inspired pre-submission check), prior auth prediction, lab reorder suppression | ✅ DONE |
| 120 | Nursing Intelligence Suite | inline | Nursing care plan AI (NANDA/NIC), SBAR handoff generator, Morse fall risk assessment, wound staging (NPIAP) | ✅ DONE |
| 121 | Medication Reconciliation AI | inline | Admission + discharge med rec, PDMP controlled-substance detection, opioid+benzo FDA black-box alert, naloxone flag | ✅ DONE |
| 122 | Discharge Intelligence | inline | Discharge summary AI, LACE+ readmission risk, return precautions, patient education, follow-up timing with lab flags | ✅ DONE |
| 123 | AI Self-Learning Hardening | inline | A/B shadow mode eval, demographic bias audit (parity gap per attribute), audit anomaly detection (accuracy drop/latency spike/fairness), integrated into AiOpsDashboard | ✅ DONE |

---

## 🏁 Final State — 2026-03-27

**65 sprints executed. Sprints 59–123 complete. System is fully AI-First.**

Every clinical surface in MediCore now has:
- AI assistance powered by the governed CDSS gateway
- Full HIPAA-compliant audit trail for every AI output
- Human override capability at every decision point
- Explainability layer (confidence scores, evidence citations, heatmaps)
- Self-learning loop (outcome collection → model evaluation → release gates → deployment)

**Branches:**
- `feat/ai-first-maturity-sprints-112-116` — Sprints 112–116
- `harden/governed-cdss-ai-all-clinical-surfaces` — Sprint 117 + final hardening