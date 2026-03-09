# MediCore v2 — Complete Sprint Execution Plan

**Goal:** Transform MediCore into a production-grade, AI-First Human-Last, unique niche EHR that private practices and hospitals will want to buy.  
**Created:** 2026-03-08  
**Sprints:** 26 sprints across 7 phases (20 original + 6 gap remediation)  
**Principle:** Every sprint must provision new database tables/columns in `database-provisioning.service.ts` (`getProvisioningBundles()`). No schema-only migrations — all changes flow through provisioning.

**Sprint execution workflow:** At **every feature / milestone / deliverable** completion:

1. Run: `cd ehr-frontend && npx tsc --noEmit` (must pass).
2. Then: `git add` → `git commit` → `git push`.

So each completed milestone ends with a clean type-check and a push, not only at the end of a full sprint.

---

## Tackle now (current focus)

**All sprints complete.**

- **Phase E–J**: 20 sprints — all done.
- **Phase K** (Gap Remediation): 6 sprints (K1–K6) — all done.
- **Total**: 26 sprints across 7 phases — fully implemented.

---

## Table of Contents

- [Phase E — Critical Bug Fixes & API Alignment](#phase-e--critical-bug-fixes--api-alignment)
  - [Sprint E1 — Immunization API Alignment + Travel Vaccine Engine](#sprint-e1)
  - [Sprint E2 — Hospital Module Wiring (BCMA, OR, PACU, ED)](#sprint-e2)
  - [Sprint E3 — Security Fixes (Sepsis SQL Injection, Auth Consistency, 2FA)](#sprint-e3)
- [Phase F — Hospital Module Completion](#phase-f--hospital-module-completion)
  - [Sprint F1 — OR Surgical Safety + Preference Cards + Counts](#sprint-f1)
  - [Sprint F2 — Blood Bank Crossmatch + Transfusion Workflow](#sprint-f2)
  - [Sprint F3 — Infection Control Completion + Sepsis Bundle Automation](#sprint-f3)
  - [Sprint F4 — BCMA Prescription-to-MAR + Witness Workflow](#sprint-f4)
- [Phase G — Intelligent Clinical Features](#phase-g--intelligent-clinical-features)
  - [Sprint G1 — Allergy Cross-Reactivity + Structured CDSS Integration](#sprint-g1)
  - [Sprint G2 — Real-Time Encounter Auto-Coding (ICD/CPT)](#sprint-g2)
  - [Sprint G3 — Predictive Scheduling + No-Show AI](#sprint-g3)
  - [Sprint G4 — Population Health Registry + Preventive Care Reminders](#sprint-g4)
- [Phase H — Practice Management & Revenue](#phase-h--practice-management--revenue)
  - [Sprint H1 — Fee Schedule + Superbill + Insurance Verification](#sprint-h1)
  - [Sprint H2 — Prior Authorization Workflow](#sprint-h2)
  - [Sprint H3 — Patient Portal Bill Pay + Health Education + Family Access](#sprint-h3)
  - [Sprint H4 — Recall Campaigns + Bulk Notifications](#sprint-h4)
- [Phase I — Africa/Zimbabwe-Specific Edge](#phase-i--africazimbabwe-specific-edge)
  - [Sprint I1 — Travel Vaccine Destination Engine + Yellow Card](#sprint-i1)
  - [Sprint I2 — Multi-Currency Billing + Medical Aid Integration](#sprint-i2)
- [Phase J — AI-First Human-Last Completion](#phase-j--ai-first-human-last-completion)
  - [Sprint J1 — Auto-Generated Referral Letters + Clinical Note Drafts](#sprint-j1)
  - [Sprint J2 — Deterioration Detection + Early Warning Score (NEWS2)](#sprint-j2)
  - [Sprint J3 — Pregnancy-Aware Prescribing + Renal/Hepatic Dose Adjustment](#sprint-j3)
- [Phase K — Gap Remediation & Hardening](#phase-k--gap-remediation--hardening)
  - [Sprint K1 — Encounter Auto-Coding Service + UI](#sprint-k1)
  - [Sprint K2 — No-Show Prediction Service + UI](#sprint-k2)
  - [Sprint K3 — Allergy Cross-Reactivity Engine](#sprint-k3)
  - [Sprint K4 — Infection Control Frontend + Sepsis Auto-Screening](#sprint-k4)
  - [Sprint K5 — Scheduled MAR Timeline + Witness UI](#sprint-k5)
  - [Sprint K6 — Auth Consistency Sweep + E1 Seed Data Completion](#sprint-k6)
- [Appendix — Provisioning Checklist](#appendix--provisioning-checklist)
- [Appendix — Mobile-Ready API Summary](#appendix--mobile-ready-api-summary)

---

<a id="sprint-e1"></a>
## Phase E — Critical Bug Fixes & API Alignment

### Sprint E1 — Immunization API Alignment + Travel Vaccine Engine

#### Problem

Frontend calls three immunization endpoints that don't exist on the backend:
- `GET /immunizations/schedules` → 404
- `GET /immunizations/inventory` → 404
- `POST /immunizations/patient/:patientId/administer` → 404

Patient portal forecast returns an array but frontend expects `{ forecast: [...] }`, so forecast is always empty.

Immunization tables are NOT in `getProvisioningBundles()` — new tenants never get them.

Only 7 routine vaccines are seeded. No travel, no BCG, no Hib, no PCV13, no Varicella, no Hepatitis A, no Tdap, no Zoster, no Meningococcal, no Rotavirus.

#### Architecture

```
ImmunizationController (existing)
├── POST /                                    (exists — keep)
├── GET /patient/:patientId                   (exists — keep)
├── GET /patient/:patientId/forecast          (exists — keep)
├── POST /:id/adverse-event                   (exists — keep)
├── GET /schedules                            (NEW — return all active schedules)
├── GET /schedules?schedule_type=travel       (NEW — filter by type)
├── GET /inventory                            (NEW — return vaccine inventory)
├── GET /inventory?vaccine_code=YF            (NEW — filter by vaccine code)
└── POST /patient/:patientId/administer       (NEW — alias for POST / with patientId in path)
```

#### Step 1: Database Provisioning

**File:** `services/tenant-service/src/services/database-provisioning.service.ts`

Add a new provisioning bundle `sprint_e1_immunization_alignment` inside `getProvisioningBundles()` with a `statements()` method that returns `this.getSprintE1ImmunizationAlignmentStatements()`.

Add private method `getSprintE1ImmunizationAlignmentStatements(): string[]` that returns an array of SQL strings:

```sql
-- 1. Create immunization tables if they don't exist (idempotent)
CREATE TABLE IF NOT EXISTS immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immunization_number VARCHAR(30),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vaccine_code VARCHAR(20) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  cvx_code VARCHAR(10),
  vaccine_group VARCHAR(100),
  dose_number INTEGER,
  dose_quantity DECIMAL(5,2),
  dose_unit VARCHAR(20) DEFAULT 'mL',
  route VARCHAR(50),
  site VARCHAR(100),
  lot_number VARCHAR(50),
  manufacturer VARCHAR(100),
  expiration_date DATE,
  administration_date TIMESTAMP WITH TIME ZONE NOT NULL,
  administered_by UUID REFERENCES users(id),
  ordering_provider UUID REFERENCES users(id),
  vis_document VARCHAR(255),
  vis_date DATE,
  vis_presented BOOLEAN DEFAULT false,
  patient_eligibility VARCHAR(100),
  funding_source VARCHAR(100),
  information_source VARCHAR(100) DEFAULT 'new_immunization_record',
  status VARCHAR(50) DEFAULT 'completed',
  refusal_reason TEXT,
  notes TEXT,
  registry_status VARCHAR(50) DEFAULT 'pending',
  registry_submission_date TIMESTAMP WITH TIME ZONE,
  registry_acknowledgement TEXT,
  snomed_vaccine_code VARCHAR(20),
  snomed_vaccine_term TEXT,
  snomed_route_code VARCHAR(20),
  snomed_route_term TEXT,
  snomed_site_code VARCHAR(20),
  snomed_site_term TEXT,
  target_disease_snomed_codes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_immunizations_patient ON immunizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_immunizations_vaccine ON immunizations(vaccine_code);
CREATE INDEX IF NOT EXISTS idx_immunizations_date ON immunizations(administration_date);
CREATE INDEX IF NOT EXISTS idx_immunizations_status ON immunizations(status);
CREATE INDEX IF NOT EXISTS idx_immunizations_lot ON immunizations(lot_number);
CREATE INDEX IF NOT EXISTS idx_immunizations_registry ON immunizations(registry_status);

CREATE TABLE IF NOT EXISTS vaccine_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaccine_code VARCHAR(20) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(100),
  lot_number VARCHAR(50) NOT NULL,
  expiration_date DATE NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  quantity_administered INTEGER DEFAULT 0,
  quantity_wasted INTEGER DEFAULT 0,
  storage_location VARCHAR(100),
  storage_temperature_min DECIMAL(5,2),
  storage_temperature_max DECIMAL(5,2),
  current_temperature DECIMAL(5,2),
  temperature_alert BOOLEAN DEFAULT false,
  received_date DATE NOT NULL,
  received_by UUID REFERENCES users(id),
  funding_source VARCHAR(100),
  cost_per_dose DECIMAL(10,2),
  ndc_code VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','expired','recalled','depleted','quarantined')),
  recall_information TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lot_number, vaccine_code)
);
CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_code ON vaccine_inventory(vaccine_code);
CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_status ON vaccine_inventory(status);
CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_expiry ON vaccine_inventory(expiration_date);
CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_lot ON vaccine_inventory(lot_number);

CREATE TABLE IF NOT EXISTS immunization_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name VARCHAR(255) NOT NULL,
  vaccine_code VARCHAR(20) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  age_group VARCHAR(50),
  minimum_age_months INTEGER,
  maximum_age_months INTEGER,
  dose_number INTEGER NOT NULL,
  recommended_age_months INTEGER,
  minimum_interval_days INTEGER,
  is_required BOOLEAN DEFAULT true,
  schedule_type VARCHAR(50) DEFAULT 'routine' CHECK (schedule_type IN ('routine','catch_up','risk_based','travel')),
  contraindications JSONB DEFAULT '[]'::jsonb,
  precautions JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  cdc_schedule_version VARCHAR(20),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  target_disease_snomed_codes JSONB DEFAULT '[]'::jsonb,
  contraindications_snomed JSONB DEFAULT '[]'::jsonb,
  precautions_snomed JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_imm_schedules_type ON immunization_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_imm_schedules_code ON immunization_schedules(vaccine_code);
CREATE INDEX IF NOT EXISTS idx_imm_schedules_active ON immunization_schedules(is_active);

CREATE TABLE IF NOT EXISTS vaccine_adverse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immunization_id UUID NOT NULL REFERENCES immunizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('mild','moderate','severe','life_threatening')),
  outcome VARCHAR(50),
  treatment_given TEXT,
  hospitalized BOOLEAN DEFAULT false,
  reported_to_vaers BOOLEAN DEFAULT false,
  vaers_report_number VARCHAR(50),
  reported_by UUID REFERENCES users(id),
  reported_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vaers_imm ON vaccine_adverse_events(immunization_id);
CREATE INDEX IF NOT EXISTS idx_vaers_patient ON vaccine_adverse_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_vaers_date ON vaccine_adverse_events(event_date);
CREATE INDEX IF NOT EXISTS idx_vaers_severity ON vaccine_adverse_events(severity);

CREATE TABLE IF NOT EXISTS immunization_registry_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immunization_id UUID NOT NULL REFERENCES immunizations(id) ON DELETE CASCADE,
  submission_type VARCHAR(50) DEFAULT 'new',
  message_format VARCHAR(20) DEFAULT 'HL7_VXU',
  message_content TEXT,
  submission_status VARCHAR(50) DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE,
  response_code VARCHAR(20),
  response_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS immunization_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vaccine_code VARCHAR(20) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  dose_number INTEGER NOT NULL,
  recommended_date DATE,
  earliest_date DATE,
  latest_date DATE,
  status VARCHAR(20) DEFAULT 'due' CHECK (status IN ('due','overdue','upcoming','completed','contraindicated')),
  schedule_id UUID REFERENCES immunization_schedules(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Then insert the FULL vaccine schedule seed (idempotent with `ON CONFLICT DO NOTHING` or `INSERT ... WHERE NOT EXISTS`):

```sql
-- Routine childhood vaccines
INSERT INTO immunization_schedules (schedule_name, vaccine_code, vaccine_name, age_group, minimum_age_months, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
SELECT * FROM (VALUES
  ('BCG', '19', 'BCG (Tuberculosis)', 'infant', 0, 1, 0, NULL, true, 'routine', CURRENT_DATE),
  ('OPV Dose 0', '02', 'OPV (Oral Polio)', 'infant', 0, 1, 0, NULL, true, 'routine', CURRENT_DATE),
  ('OPV Dose 1', '02', 'OPV (Oral Polio)', 'infant', 1, 2, 2, 28, true, 'routine', CURRENT_DATE),
  ('OPV Dose 2', '02', 'OPV (Oral Polio)', 'infant', 2, 3, 3, 28, true, 'routine', CURRENT_DATE),
  ('OPV Dose 3', '02', 'OPV (Oral Polio)', 'infant', 3, 4, 4, 28, true, 'routine', CURRENT_DATE),
  ('Rotavirus Dose 1', '116', 'Rotavirus', 'infant', 1, 1, 2, NULL, true, 'routine', CURRENT_DATE),
  ('Rotavirus Dose 2', '116', 'Rotavirus', 'infant', 2, 2, 4, 28, true, 'routine', CURRENT_DATE),
  ('PCV13 Dose 1', '133', 'Pneumococcal Conjugate (PCV13)', 'infant', 1, 1, 2, NULL, true, 'routine', CURRENT_DATE),
  ('PCV13 Dose 2', '133', 'Pneumococcal Conjugate (PCV13)', 'infant', 2, 2, 4, 28, true, 'routine', CURRENT_DATE),
  ('PCV13 Dose 3', '133', 'Pneumococcal Conjugate (PCV13)', 'infant', 9, 3, 12, 56, true, 'routine', CURRENT_DATE),
  ('Hib Dose 1', '17', 'Hib (Haemophilus influenzae type b)', 'infant', 1, 1, 2, NULL, true, 'routine', CURRENT_DATE),
  ('Hib Dose 2', '17', 'Hib (Haemophilus influenzae type b)', 'infant', 2, 2, 4, 28, true, 'routine', CURRENT_DATE),
  ('Hib Dose 3', '17', 'Hib (Haemophilus influenzae type b)', 'infant', 9, 3, 12, 56, true, 'routine', CURRENT_DATE),
  ('Varicella Dose 1', '21', 'Varicella (Chickenpox)', 'child', 12, 1, 12, NULL, true, 'routine', CURRENT_DATE),
  ('Varicella Dose 2', '21', 'Varicella (Chickenpox)', 'child', 48, 2, 48, 84, true, 'routine', CURRENT_DATE),
  ('Hepatitis A Dose 1', '83', 'Hepatitis A', 'child', 12, 1, 12, NULL, true, 'routine', CURRENT_DATE),
  ('Hepatitis A Dose 2', '83', 'Hepatitis A', 'child', 18, 2, 18, 168, true, 'routine', CURRENT_DATE),
  ('Meningococcal ACWY Dose 1', '114', 'Meningococcal Conjugate (MenACWY)', 'adolescent', 132, 1, 132, NULL, true, 'routine', CURRENT_DATE),
  ('Meningococcal ACWY Dose 2', '114', 'Meningococcal Conjugate (MenACWY)', 'adolescent', 192, 2, 192, 56, true, 'routine', CURRENT_DATE),
  ('Tdap Booster', '115', 'Tdap (Tetanus, Diphtheria, Pertussis)', 'adolescent', 132, 1, 132, NULL, true, 'routine', CURRENT_DATE),
  ('PPSV23', '33', 'Pneumococcal Polysaccharide (PPSV23)', 'adult', 780, 1, 780, NULL, false, 'risk_based', CURRENT_DATE),
  ('Zoster (Shingrix) Dose 1', '187', 'Shingles (Zoster Recombinant)', 'adult', 600, 1, 600, NULL, false, 'routine', CURRENT_DATE),
  ('Zoster (Shingrix) Dose 2', '187', 'Shingles (Zoster Recombinant)', 'adult', 600, 2, 602, 56, false, 'routine', CURRENT_DATE)
) AS v(schedule_name, vaccine_code, vaccine_name, age_group, minimum_age_months, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, effective_date)
WHERE NOT EXISTS (
  SELECT 1 FROM immunization_schedules s
  WHERE s.vaccine_code = v.vaccine_code AND s.dose_number = v.dose_number AND s.schedule_type = v.schedule_type
);

-- Travel vaccines
INSERT INTO immunization_schedules (schedule_name, vaccine_code, vaccine_name, age_group, minimum_age_months, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, notes, effective_date)
SELECT * FROM (VALUES
  ('Yellow Fever', 'YF', 'Yellow Fever (17D)', 'adult', 108, 1, NULL, NULL, true, 'travel', 'Required for entry to many African and South American countries. Single dose provides lifelong immunity per WHO 2016.', CURRENT_DATE),
  ('Typhoid (Injectable)', '101', 'Typhoid Vi Polysaccharide', 'adult', 24, 1, NULL, NULL, false, 'travel', 'Recommended for travel to South Asia, Africa. Revaccinate every 2 years if continued risk.', CURRENT_DATE),
  ('Typhoid (Oral)', '25', 'Typhoid Oral Ty21a', 'adult', 72, 1, NULL, NULL, false, 'travel', '4-dose oral series. Revaccinate every 5 years.', CURRENT_DATE),
  ('Rabies Pre-Exposure Dose 1', '40', 'Rabies Pre-Exposure', 'adult', 0, 1, NULL, NULL, false, 'travel', 'For travelers to rabies-endemic areas with limited access to PEP. Days 0, 7, 21–28.', CURRENT_DATE),
  ('Rabies Pre-Exposure Dose 2', '40', 'Rabies Pre-Exposure', 'adult', 0, 2, NULL, 7, false, 'travel', 'Day 7.', CURRENT_DATE),
  ('Rabies Pre-Exposure Dose 3', '40', 'Rabies Pre-Exposure', 'adult', 0, 3, NULL, 14, false, 'travel', 'Day 21–28.', CURRENT_DATE),
  ('Cholera (Oral)', '26', 'Cholera Oral (Dukoral/Shanchol)', 'adult', 24, 1, NULL, NULL, false, 'travel', 'Recommended for travel to cholera-endemic areas. 2-dose series 7–42 days apart.', CURRENT_DATE),
  ('Cholera (Oral) Dose 2', '26', 'Cholera Oral (Dukoral/Shanchol)', 'adult', 24, 2, NULL, 7, false, 'travel', 'Second dose 7–42 days after first.', CURRENT_DATE),
  ('Japanese Encephalitis Dose 1', '134', 'Japanese Encephalitis', 'adult', 2, 1, NULL, NULL, false, 'travel', 'For travel to rural Asia. 2-dose series days 0 and 28.', CURRENT_DATE),
  ('Japanese Encephalitis Dose 2', '134', 'Japanese Encephalitis', 'adult', 2, 2, NULL, 28, false, 'travel', 'Day 28.', CURRENT_DATE),
  ('Meningococcal ACWY (Travel)', '114', 'Meningococcal Conjugate (MenACWY)', 'adult', 24, 1, NULL, NULL, true, 'travel', 'Required for Hajj/Umrah travel and meningitis belt of sub-Saharan Africa.', CURRENT_DATE)
) AS v(schedule_name, vaccine_code, vaccine_name, age_group, minimum_age_months, dose_number, recommended_age_months, minimum_interval_days, is_required, schedule_type, notes, effective_date)
WHERE NOT EXISTS (
  SELECT 1 FROM immunization_schedules s
  WHERE s.vaccine_code = v.vaccine_code AND s.dose_number = v.dose_number AND s.schedule_type = v.schedule_type
);
```

Also add a provisioning script `scripts/provision-sprint-e1-immunization-alignment.ts` following the exact pattern of `scripts/provision-sprint57-post-visit-intravisit-alerts.ts`.

#### Step 2: Backend — New Endpoints

**File:** `services/ehr-service/src/controllers/immunization.controller.ts`

Add three new endpoints:

```typescript
@Get('schedules')
@ApiOperation({ summary: 'Get immunization schedules' })
async getSchedules(
  @Request() req: RequestWithTenant,
  @Query('schedule_type') scheduleType?: 'routine' | 'catch_up' | 'risk_based' | 'travel',
  @Query('age_group') ageGroup?: string,
  @Query('is_active') isActive?: string,
) {
  return this.immunizationService.getSchedules(req.tenantDb, { scheduleType, ageGroup, isActive: isActive !== 'false' });
}

@Get('inventory')
@ApiOperation({ summary: 'Get vaccine inventory' })
async getInventory(
  @Request() req: RequestWithTenant,
  @Query('vaccine_code') vaccineCode?: string,
  @Query('status') status?: string,
) {
  return this.immunizationService.getInventory(req.tenantDb, { vaccineCode, status });
}

@Post('patient/:patientId/administer')
@ApiOperation({ summary: 'Administer vaccine to patient' })
async administerVaccine(
  @Request() req: RequestWithTenant,
  @Param('patientId') patientId: string,
  @Body() body: any,
) {
  return this.immunizationService.recordImmunization(req.tenantDb, { ...body, patientId }, req.user?.userId);
}
```

**File:** `services/ehr-service/src/services/immunization.service.ts`

Add two new methods:

```typescript
async getSchedules(
  tenantDb: DataSource,
  filters: { scheduleType?: string; ageGroup?: string; isActive?: boolean },
) {
  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.scheduleType) {
    whereClauses.push(`schedule_type = $${paramIndex++}`);
    params.push(filters.scheduleType);
  }
  if (filters.ageGroup) {
    whereClauses.push(`age_group = $${paramIndex++}`);
    params.push(filters.ageGroup);
  }
  if (filters.isActive !== false) {
    whereClauses.push(`is_active = true`);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const rows = await tenantDb.query(
    `SELECT * FROM immunization_schedules ${where} ORDER BY schedule_type, vaccine_name, dose_number`,
    params,
  );
  return { schedules: rows, total: rows.length };
}

async getInventory(
  tenantDb: DataSource,
  filters: { vaccineCode?: string; status?: string },
) {
  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.vaccineCode) {
    whereClauses.push(`vaccine_code = $${paramIndex++}`);
    params.push(filters.vaccineCode);
  }
  if (filters.status) {
    whereClauses.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const rows = await tenantDb.query(
    `SELECT * FROM vaccine_inventory ${where} ORDER BY vaccine_name, expiration_date`,
    params,
  );
  return { inventory: rows, total: rows.length };
}
```

#### Step 3: Patient Portal Forecast Fix

**File:** `services/ehr-service/src/controllers/patient-portal.controller.ts`

Find the immunization forecast endpoint. Change the return from:

```typescript
return forecastRows;
```

to:

```typescript
return { forecast: forecastRows };
```

#### Step 4: Tests

1. Unit test for `getSchedules` — verify filter by `schedule_type = 'travel'` returns only travel vaccines.
2. Unit test for `getInventory` — verify filter by `vaccine_code` and `status`.
3. Unit test for `POST /immunizations/patient/:patientId/administer` — verify it calls `recordImmunization` with patientId from path.
4. Verify patient portal forecast returns `{ forecast: [...] }`.

#### Acceptance

- `GET /immunizations/schedules` returns all active schedules (7 existing + ~30 new).
- `GET /immunizations/schedules?schedule_type=travel` returns Yellow Fever, Typhoid, Rabies, Cholera, Japanese Encephalitis, Meningococcal.
- `GET /immunizations/inventory` returns vaccine inventory with filters.
- `POST /immunizations/patient/:patientId/administer` records immunization.
- Patient portal forecast no longer returns empty array.
- New tenants get immunization tables via provisioning.

---

<a id="sprint-e2"></a>
### Sprint E2 — Hospital Module Wiring (BCMA, OR, PACU, ED)

#### Problem

Multiple hospital module UIs have buttons/modals that are imported but never wired:
- BCMA: "Scan & Give" button has no onClick; MedicationScannerModal never opens.
- PACU: "Vitals", "Pain Meds", "Discharge" buttons have no handlers; AldreteScoreModal never opens.
- ED: `POST /ed/visits/:id/disposition` endpoint does not exist but EDDispositionModal calls it.
- ED: Tracking board only shows `waiting` status; triage/in_treatment patients are invisible.
- ED: Metrics structure mismatch between backend and frontend.

#### Step 1: ED Disposition Endpoint

**File:** `services/ehr-service/src/controllers/ed.controller.ts`

Add:

```typescript
@Post('visits/:id/disposition')
@ApiOperation({ summary: 'Complete ED visit disposition' })
async completeDisposition(
  @Request() req: RequestWithTenant,
  @Param('id') id: string,
  @Body() body: any,
) {
  return this.edService.completeDisposition(req.tenantDb, id, body, req.user?.userId);
}
```

**File:** `services/ehr-service/src/services/ed.service.ts`

Add `completeDisposition()` method that:
1. Loads the ED visit.
2. Validates disposition type (discharge, admit, transfer, ama, lwbs, expired).
3. Sets `disposition`, `disposition_time`, `discharge_diagnosis`, `discharge_diagnosis_icd10`.
4. Calculates `total_ed_time` from arrival to disposition.
5. Updates `ed_status` to 'discharged' or 'admitted'.
6. If admitting, triggers bed management admission.

#### Step 2: ED Tracking Board Fix

**File:** `services/ehr-service/src/services/ed.service.ts`

In `getEDTrackingBoard()`, change the query filter from:

```typescript
WHERE ed_status = 'waiting'
```

to:

```typescript
WHERE ed_status NOT IN ('discharged', 'admitted', 'transferred', 'left_ama', 'left_without_being_seen', 'expired')
```

This shows all active ED patients (waiting, triaged, in_treatment, observation).

#### Step 3: ED Metrics Alignment

**File:** `services/ehr-service/src/services/ed.service.ts`

Update `getEDMetrics()` to return the fields the frontend expects:

```typescript
return {
  total_visits_today: Number(row.total_visits || 0),
  current_census: Number(row.current_census || 0),
  average_wait_time_minutes: Number(row.avg_wait || 0),
  average_door_to_provider_minutes: Number(row.avg_door_to_provider || 0),
  lwbs_count: Number(row.lwbs_count || 0),
  lwbs_rate: Number(row.lwbs_rate || 0),
  admission_rate: Number(row.admission_rate || 0),
  esi_level_1: Number(row.esi_1 || 0),
  esi_level_2: Number(row.esi_2 || 0),
  esi_level_3: Number(row.esi_3 || 0),
  esi_level_4: Number(row.esi_4 || 0),
  esi_level_5: Number(row.esi_5 || 0),
};
```

#### Step 4: Wire BCMA MedicationScannerModal

**File:** `ehr-frontend/src/pages/MARDashboard.tsx`

Find the "Scan & Give" button and add `onClick={() => setScannerOpen(true)}`. The state `scannerOpen` and the `<MedicationScannerModal>` import already exist; wire them together.

#### Step 5: Wire PACU Dashboard

**File:** `ehr-frontend/src/pages/PACUDashboard.tsx`

Wire the existing imported `AldreteScoreModal` to the "Vitals" button via state. Add `onClick` handlers for:
- "Vitals" → opens AldreteScoreModal for the selected patient.
- "Discharge" → calls `POST /anesthesia/pacu/:id/discharge` with confirmation dialog.

#### Step 6: Auth Consistency Fix

**Files:** Blood Bank, Infection Control, Sepsis controllers

Replace all instances of `req.user.id` with `req.user?.userId || (req.user as any)?.id` to match the JWT payload used throughout the rest of the system.

#### Acceptance

- EDDispositionModal submits successfully.
- ED tracking board shows all active patients.
- ED metrics match frontend expectations.
- BCMA "Scan & Give" opens the scanner modal.
- PACU buttons are functional.
- No more `req.user.id` inconsistencies.

---

<a id="sprint-e3"></a>
### Sprint E3 — Security Fixes (Sepsis SQL Injection, Auth, 2FA)

#### Problem

1. `updateBundleElement()` in sepsis service uses `${element}` — SQL injection risk.
2. No 2FA enforcement despite schema fields existing.
3. No session timeout enforcement.

#### Step 1: Fix Sepsis SQL Injection

**File:** `services/ehr-service/src/services/sepsis.service.ts`

In `updateBundleElement()`, validate `element` against an allowlist:

```typescript
const ALLOWED_ELEMENTS = [
  'lactate_measured', 'blood_cultures_drawn', 'broad_spectrum_antibiotics_given',
  'fluid_bolus_given', 'vasopressors_initiated',
];
if (!ALLOWED_ELEMENTS.includes(element)) {
  throw new BadRequestException(`Invalid bundle element: ${element}`);
}
```

Then use the validated element name in the query (it's safe after allowlist check).

#### Step 2: 2FA / TOTP Implementation

**File:** `services/ehr-service/src/controllers/auth.controller.ts`

Add endpoints:

```typescript
@Post('2fa/setup')    // Generate TOTP secret + QR code
@Post('2fa/verify')   // Verify TOTP code and enable 2FA
@Post('2fa/disable')  // Disable 2FA (requires current TOTP code)
```

**File:** `services/ehr-service/src/services/auth.service.ts`

Add methods using `otplib` (add to package.json):
- `setup2FA(userId)` — generate secret, return otpauth URL for QR.
- `verify2FA(userId, token)` — verify TOTP, set `two_factor_enabled = true`.
- `disable2FA(userId, token)` — verify TOTP, set `two_factor_enabled = false`, clear secret.

In `login()`, if user has `two_factor_enabled = true`, return `{ requiresTwoFactor: true, tempToken }` instead of full JWT. Second call with TOTP code completes login.

**Database:** Add columns to `users` table if not present:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
```

Add to provisioning bundle.

#### Step 3: Session Timeout

**File:** `ehr-frontend/src/components/AutoLogoutProvider.tsx`

This component already exists. Verify it:
1. Listens for mouse/keyboard/touch events.
2. Resets a timer on activity.
3. Shows a warning modal at T-60 seconds.
4. Logs out and redirects to login at timeout.
5. Default timeout: 30 minutes (configurable via env var `REACT_APP_SESSION_TIMEOUT_MS`).

If the component exists but is not used in `App.tsx`, wrap the authenticated routes with `<AutoLogoutProvider>`.

#### Acceptance

- Sepsis `updateBundleElement` rejects invalid element names.
- 2FA setup generates QR code; login enforces TOTP when enabled.
- Session auto-logout after 30 minutes of inactivity.

---

## Phase F — Hospital Module Completion

<a id="sprint-f1"></a>
### Sprint F1 — OR Surgical Safety + Preference Cards + Counts

#### Problem

OR module lacks WHO Surgical Safety Checklist, count sheets, preference card CRUD, and specimen tracking.

#### Database

Add provisioning bundle `sprint_f1_or_surgical_safety`:

```sql
CREATE TABLE IF NOT EXISTS surgical_safety_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id) ON DELETE CASCADE,
  -- Sign In (before anesthesia)
  sign_in_completed BOOLEAN DEFAULT false,
  sign_in_completed_at TIMESTAMP WITH TIME ZONE,
  sign_in_completed_by UUID REFERENCES users(id),
  patient_identity_confirmed BOOLEAN DEFAULT false,
  site_marked BOOLEAN DEFAULT false,
  consent_confirmed BOOLEAN DEFAULT false,
  anesthesia_safety_check BOOLEAN DEFAULT false,
  known_allergy BOOLEAN DEFAULT false,
  allergy_details TEXT,
  difficult_airway_risk BOOLEAN DEFAULT false,
  aspiration_risk BOOLEAN DEFAULT false,
  blood_loss_risk BOOLEAN DEFAULT false,
  blood_loss_estimated_ml INTEGER,
  -- Time Out (before skin incision)
  time_out_completed BOOLEAN DEFAULT false,
  time_out_completed_at TIMESTAMP WITH TIME ZONE,
  time_out_completed_by UUID REFERENCES users(id),
  team_members_introduced BOOLEAN DEFAULT false,
  procedure_confirmed BOOLEAN DEFAULT false,
  site_confirmed BOOLEAN DEFAULT false,
  anticipated_critical_events TEXT,
  antibiotic_prophylaxis_given BOOLEAN DEFAULT false,
  antibiotic_time TIMESTAMP WITH TIME ZONE,
  imaging_displayed BOOLEAN DEFAULT false,
  -- Sign Out (before patient leaves OR)
  sign_out_completed BOOLEAN DEFAULT false,
  sign_out_completed_at TIMESTAMP WITH TIME ZONE,
  sign_out_completed_by UUID REFERENCES users(id),
  procedure_recorded BOOLEAN DEFAULT false,
  instrument_sponge_needle_counts_correct BOOLEAN DEFAULT false,
  specimen_labelled BOOLEAN DEFAULT false,
  equipment_issues TEXT,
  key_concerns_recovery TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ssc_case ON surgical_safety_checklists(surgical_case_id);

CREATE TABLE IF NOT EXISTS surgical_count_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id) ON DELETE CASCADE,
  count_type VARCHAR(30) NOT NULL CHECK (count_type IN ('sponge', 'needle', 'instrument', 'other')),
  item_name VARCHAR(255) NOT NULL,
  initial_count INTEGER NOT NULL,
  final_count INTEGER,
  count_correct BOOLEAN,
  discrepancy_note TEXT,
  counted_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  count_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_count_case ON surgical_count_sheets(surgical_case_id);

CREATE TABLE IF NOT EXISTS surgical_specimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id) ON DELETE CASCADE,
  specimen_type VARCHAR(100) NOT NULL,
  specimen_source VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 1,
  fixative VARCHAR(100) DEFAULT 'formalin',
  collected_by UUID REFERENCES users(id),
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pathology_lab_order_id UUID,
  label_verified BOOLEAN DEFAULT false,
  label_verified_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_specimen_case ON surgical_specimens(surgical_case_id);
```

#### Backend

Add to `OperatingRoomController`:

```
POST /operating-room/cases/:id/safety-checklist/sign-in
POST /operating-room/cases/:id/safety-checklist/time-out
POST /operating-room/cases/:id/safety-checklist/sign-out
GET  /operating-room/cases/:id/safety-checklist
POST /operating-room/cases/:id/count-sheets
GET  /operating-room/cases/:id/count-sheets
PUT  /operating-room/count-sheets/:id/verify
POST /operating-room/cases/:id/specimens
GET  /operating-room/cases/:id/specimens
GET  /operating-room/preference-cards
POST /operating-room/preference-cards
PUT  /operating-room/preference-cards/:id
GET  /operating-room/preference-cards/surgeon/:surgeonId
```

#### Frontend

Add to `SurgicalCaseDetailModal`:
- WHO Surgical Safety Checklist panel with Sign In / Time Out / Sign Out sections (checkboxes + timestamps).
- Count sheet panel (add items, initial count, final count, verify).
- Specimen tracking panel.

Add `PreferenceCardManager` component to OR settings.

#### Acceptance

- WHO checklist must be completed before case status moves to 'completed'.
- Count discrepancy blocks Sign Out unless documented.
- Specimens linked to pathology lab orders.
- Preference cards CRUD functional.

---

<a id="sprint-f2"></a>
### Sprint F2 — Blood Bank Crossmatch + Transfusion Workflow

#### Database

Add provisioning bundle `sprint_f2_blood_bank_crossmatch`:

```sql
-- blood_cross_match already exists in schema but has no service. Ensure it exists:
CREATE TABLE IF NOT EXISTS blood_cross_match (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  inventory_id UUID REFERENCES blood_inventory(id),
  blood_group VARCHAR(10) NOT NULL,
  rh_factor VARCHAR(10) NOT NULL,
  antibody_screen VARCHAR(20) DEFAULT 'negative',
  antibody_identified TEXT,
  major_cross_match VARCHAR(20),
  minor_cross_match VARCHAR(20),
  cross_match_result VARCHAR(20) CHECK (cross_match_result IN ('compatible', 'incompatible', 'pending')),
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crossmatch_patient ON blood_cross_match(patient_id);
CREATE INDEX IF NOT EXISTS idx_crossmatch_inventory ON blood_cross_match(inventory_id);
CREATE INDEX IF NOT EXISTS idx_crossmatch_result ON blood_cross_match(cross_match_result);

CREATE TABLE IF NOT EXISTS transfusion_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfusion_id UUID NOT NULL REFERENCES blood_transfusions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  reaction_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reaction_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
  symptoms TEXT,
  vitals_at_reaction JSONB,
  treatment_given TEXT,
  transfusion_stopped BOOLEAN DEFAULT true,
  blood_bank_notified BOOLEAN DEFAULT false,
  physician_notified BOOLEAN DEFAULT false,
  investigation_status VARCHAR(20) DEFAULT 'pending',
  investigation_findings TEXT,
  reported_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_txn_reaction_patient ON transfusion_reactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_txn_reaction_transfusion ON transfusion_reactions(transfusion_id);
```

#### Backend

Add to `BloodBankController`:

```
POST /blood-bank/type-and-screen          — Type and screen for patient
POST /blood-bank/crossmatch               — Perform crossmatch
GET  /blood-bank/crossmatch/patient/:id   — Get patient crossmatch history
POST /blood-bank/transfusions/:id/reaction — Report transfusion reaction
GET  /blood-bank/transfusions/:id/reaction — Get reaction details
POST /blood-bank/massive-transfusion-protocol — Activate MTP
GET  /blood-bank/utilization-report        — Blood utilization metrics
```

Fix auth: replace `req.user.id` with `req.user?.userId`.

#### Frontend

Add to `BloodBankDashboard`:
- Type & Screen panel (order, result entry).
- Crossmatch workflow (select unit, perform, document).
- Transfusion order/start/stop/complete workflow buttons.
- Transfusion reaction reporting form.
- MTP activation button with protocol checklist.

#### Acceptance

- Type and screen → crossmatch → reserve → transfuse → complete lifecycle works.
- Reaction reporting triggers investigation workflow.
- MTP activation reserves multiple units and notifies blood bank staff.

---

<a id="sprint-f3"></a>
### Sprint F3 — Infection Control Completion + Sepsis Bundle Automation

#### Database

Add provisioning bundle `sprint_f3_infection_sepsis`:

```sql
CREATE TABLE IF NOT EXISTS hand_hygiene_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_id UUID NOT NULL REFERENCES users(id),
  observed_staff_id UUID REFERENCES users(id),
  observation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  department VARCHAR(100),
  opportunity_type VARCHAR(50) NOT NULL CHECK (opportunity_type IN (
    'before_patient_contact', 'before_aseptic_task', 'after_body_fluid_exposure',
    'after_patient_contact', 'after_surroundings_contact'
  )),
  hand_hygiene_performed BOOLEAN NOT NULL,
  method VARCHAR(30) CHECK (method IN ('soap_and_water', 'alcohol_rub', 'none')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hh_date ON hand_hygiene_observations(observation_date);
CREATE INDEX IF NOT EXISTS idx_hh_department ON hand_hygiene_observations(department);

CREATE TABLE IF NOT EXISTS device_day_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('central_line', 'urinary_catheter', 'ventilator')),
  inserted_date DATE NOT NULL,
  removed_date DATE,
  inserted_by UUID REFERENCES users(id),
  location VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_patient ON device_day_tracking(patient_id);
CREATE INDEX IF NOT EXISTS idx_device_type ON device_day_tracking(device_type);

ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS lactate_measured_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS blood_cultures_drawn_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS antibiotics_given_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS fluid_bolus_given_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS vasopressors_initiated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sepsis_bundles ADD COLUMN IF NOT EXISTS sepsis_onset_time TIMESTAMP WITH TIME ZONE;
```

#### Backend

**Infection Control** — add to controller:

```
POST /infection-control/hand-hygiene           — Record observation
GET  /infection-control/hand-hygiene/compliance — Compliance rate by department/period
POST /infection-control/device-days             — Track device insertion
PUT  /infection-control/device-days/:id/remove  — Track device removal
GET  /infection-control/device-days/rates       — CAUTI/CLABSI/VAP rates (infections ÷ device-days × 1000)
```

**Sepsis** — modify `updateBundleElement()`:
1. Validate element against allowlist (E3 fix).
2. Set `${element}_at = NOW()` timestamp when element is completed.
3. Auto-calculate `three_hour_bundle_complete` when lactate + cultures + antibiotics are all done within 3 hours of `sepsis_onset_time`.
4. Calculate per-element time-to-completion metrics.

**Automated sepsis screening** — add to vitals recording:
In `VitalsService.recordVitals()`, after saving vitals, check qSOFA criteria:
- Respiratory rate ≥ 22
- Systolic BP ≤ 100
- Altered mental status (GCS < 15)

If qSOFA ≥ 2, auto-create sepsis alert (reuse existing sepsis screening endpoint internally).

#### Frontend

Add to `InfectionControlDashboard`:
- Hand hygiene compliance panel (WHO 5 Moments, % compliance by department).
- Device day tracking panel (active devices, CAUTI/CLABSI/VAP rates).

Add to `SepsisDashboard`:
- Bundle element timeline (per-element completion times).
- Screening initiation form (currently view-only).

#### Acceptance

- Hand hygiene compliance tracked with WHO 5 Moments.
- Device-day denominators enable standard HAI rate calculation.
- Sepsis bundle tracks per-element timing.
- Auto-screening from vitals detects qSOFA ≥ 2.

---

<a id="sprint-f4"></a>
### Sprint F4 — BCMA Prescription-to-MAR + Witness Workflow

#### Database

Add provisioning bundle `sprint_f4_bcma_mar`:

```sql
CREATE TABLE IF NOT EXISTS mar_scheduled_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  medication_name VARCHAR(255) NOT NULL,
  dose VARCHAR(100) NOT NULL,
  unit VARCHAR(50),
  route VARCHAR(50),
  frequency VARCHAR(100),
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(30) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'administered', 'held', 'refused', 'missed', 'late')),
  mar_id UUID REFERENCES medication_administration_records(id),
  requires_witness BOOLEAN DEFAULT false,
  is_high_alert BOOLEAN DEFAULT false,
  is_controlled BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mar_sched_patient ON mar_scheduled_entries(patient_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_mar_sched_status ON mar_scheduled_entries(status);
CREATE INDEX IF NOT EXISTS idx_mar_sched_prescription ON mar_scheduled_entries(prescription_id);
```

#### Backend

Add to `BcmaService`:

```typescript
async generateMARFromPrescription(tenantDb, prescriptionId, patientId, admissionId) {
  // 1. Load prescription (medication_name, dose, route, frequency).
  // 2. Parse frequency into scheduled times (e.g., "TDS" → 08:00, 14:00, 20:00).
  // 3. Generate mar_scheduled_entries for the next 24 hours.
  // 4. Flag is_high_alert / is_controlled / requires_witness from medication_barcode_master.
}

async administerMedication(tenantDb, marEntryId, body, actorId) {
  // 1. Load mar_scheduled_entry.
  // 2. If requires_witness && !body.witnessedById → throw BadRequestException.
  // 3. Create medication_administration_record.
  // 4. Update mar_scheduled_entry.status = 'administered', link mar_id.
}
```

Add new endpoints:

```
POST /bcma/generate-mar/:prescriptionId — Generate scheduled MAR entries from prescription
GET  /bcma/mar/scheduled/:patientId     — Get scheduled MAR entries for patient
POST /bcma/mar/scheduled/:id/administer — Administer from scheduled entry (with witness enforcement)
```

#### Frontend

Update `MARDashboard`:
- Show scheduled MAR entries as a timeline (08:00, 14:00, 20:00, etc.).
- Each entry shows medication, dose, status (scheduled/given/held/refused/missed).
- "Scan & Give" opens MedicationScannerModal pre-filled with the selected MAR entry.
- If `requires_witness`, show witness field (search for co-worker by name).

#### Acceptance

- Prescriptions auto-generate scheduled MAR entries.
- MAR dashboard shows a 24-hour medication timeline.
- High-alert / controlled substances require witness before administration.
- Scanner modal opens and completes the 4-step verification flow.

---

## Phase G — Intelligent Clinical Features

<a id="sprint-g1"></a>
### Sprint G1 — Allergy Cross-Reactivity + Structured CDSS Integration

#### Problem

CDSS allergy check uses legacy `patient.allergies` text field instead of structured `allergies` table. No cross-reactivity (penicillin ↔ cephalosporin, sulfa cross-class).

#### Backend

**File:** `services/ehr-service/src/services/cdss.service.ts` (or the proxy handler)

Add a `getAllergyWarnings(patientId, medicationName, tenantDb)` method that:
1. Loads structured allergies from `allergies` table (not legacy text).
2. Loads drug class from `drugs` table or RxNorm API.
3. Checks exact allergen match.
4. Checks cross-reactivity rules:
   - Penicillin allergy → flag all penicillins AND warn on cephalosporins (1-2% cross-react risk).
   - Sulfonamide allergy → flag all sulfa drugs.
   - NSAID allergy → flag all NSAIDs.
   - Aspirin allergy → flag all salicylates.
5. Returns `{ warnings: [{ severity, allergen, medication, crossReactivity, message }] }`.

**File:** `services/ehr-service/src/config/allergy-cross-reactivity.ts` (new)

```typescript
export const CROSS_REACTIVITY_MAP: Record<string, { relatedClasses: string[]; riskLevel: string; message: string }> = {
  penicillin: {
    relatedClasses: ['cephalosporin', 'carbapenem'],
    riskLevel: 'moderate',
    message: '1-2% cross-reactivity risk with cephalosporins; use with caution or avoid.',
  },
  sulfonamide: {
    relatedClasses: ['sulfonylurea', 'thiazide'],
    riskLevel: 'low',
    message: 'Low cross-reactivity risk; monitor for hypersensitivity.',
  },
  nsaid: {
    relatedClasses: ['aspirin', 'salicylate', 'cox2_inhibitor'],
    riskLevel: 'high',
    message: 'Cross-reactivity between NSAIDs is common; avoid entire class unless tested.',
  },
};
```

**File:** `services/ehr-service/src/controllers/cdss.controller.ts`

Add endpoint:

```
POST /cdss/allergy-check-structured — Check structured allergies with cross-reactivity
```

**Frontend:**

In `PrescriptionsModal`, before save:
1. Call `POST /cdss/allergy-check-structured` with patient ID and selected medication.
2. If warnings returned, show alert panel with severity badges.
3. If severity = 'high', require explicit acknowledgement before saving.

#### Acceptance

- Patient with penicillin allergy gets warning when prescribing amoxicillin (exact match) AND cefazolin (cross-reactivity).
- Cross-reactivity map is configurable and extensible.
- CDSS uses structured allergies table, not legacy text.

---

<a id="sprint-g2"></a>
### Sprint G2 — Real-Time Encounter Auto-Coding (ICD/CPT)

#### Database

Add provisioning bundle `sprint_g2_encounter_coding`:

```sql
CREATE TABLE IF NOT EXISTS encounter_code_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100),
  appointment_id UUID,
  patient_id UUID NOT NULL REFERENCES patients(id),
  suggested_icd10 JSONB DEFAULT '[]'::jsonb,
  suggested_cpt JSONB DEFAULT '[]'::jsonb,
  em_level VARCHAR(10),
  em_rationale TEXT,
  suggested_modifiers JSONB DEFAULT '[]'::jsonb,
  confidence DOUBLE PRECISION,
  source VARCHAR(30) DEFAULT 'ai',
  accepted_codes JSONB DEFAULT '[]'::jsonb,
  rejected_codes JSONB DEFAULT '[]'::jsonb,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enc_codes_patient ON encounter_code_suggestions(patient_id);
CREATE INDEX IF NOT EXISTS idx_enc_codes_appointment ON encounter_code_suggestions(appointment_id);
```

#### Backend

Add to `PostVisitService` or a new `EncounterCodingService`:

```typescript
async suggestEncounterCodes(tenantDb, sessionId, appointmentId, patientId) {
  // 1. Load clinical note / SOAP / transcript from session or appointment.
  // 2. Extract diagnoses and procedures from text using CDSS diagnosis-assist + NLP.
  // 3. Map diagnoses to ICD-10 codes using Icd10Service.
  // 4. Map procedures to CPT codes using terminology mapping.
  // 5. Calculate E&M level based on:
  //    - Number of problems addressed
  //    - Data reviewed (labs, imaging, external records)
  //    - Risk of complications / management decisions
  //    - Time-based if > 50% counseling
  // 6. Suggest modifiers (25 for significant separate E&M, 59 for distinct procedure).
  // 7. Persist suggestions to encounter_code_suggestions.
  // 8. Return { icd10: [...], cpt: [...], emLevel, modifiers, confidence }.
}

async reviewEncounterCodes(tenantDb, suggestionId, body, actorId) {
  // Accept/reject individual codes. Update accepted_codes, rejected_codes.
}
```

Add endpoints:

```
POST /post-visit/sessions/:id/suggest-codes — Generate ICD/CPT suggestions from session
POST /encounters/:appointmentId/suggest-codes — Generate from appointment/note
PUT  /encounter-codes/:id/review — Accept/reject suggestions
```

#### Frontend

Add to `DoctorDashboard` (consultation view) and `PostVisitDoctorWorkspace`:
- "Suggest Codes" button that calls the API.
- Panel showing suggested ICD-10 codes with descriptions and confidence.
- Panel showing suggested CPT codes with E&M level rationale.
- Accept/reject toggles per code.
- Final accepted codes auto-populate the billing/charge capture.

#### Acceptance

- After completing a clinical note, doctor clicks "Suggest Codes" and gets ICD-10 + CPT recommendations.
- E&M level calculated with rationale.
- Doctor reviews and accepts/rejects; accepted codes flow into billing.

---

<a id="sprint-g3"></a>
### Sprint G3 — Predictive Scheduling + No-Show AI

#### Database

Add provisioning bundle `sprint_g3_scheduling_ai`:

```sql
CREATE TABLE IF NOT EXISTS appointment_no_show_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  no_show_probability DOUBLE PRECISION NOT NULL,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  suggested_action VARCHAR(50),
  action_taken VARCHAR(50),
  model_version VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_noshow_appointment ON appointment_no_show_predictions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_noshow_patient ON appointment_no_show_predictions(patient_id);
CREATE INDEX IF NOT EXISTS idx_noshow_probability ON appointment_no_show_predictions(no_show_probability DESC);
```

#### Backend

Add `SchedulingIntelligenceService`:

```typescript
async predictNoShow(tenantDb, appointmentId) {
  // 1. Load appointment + patient history.
  // 2. Calculate features:
  //    - Historical no-show rate for this patient
  //    - Day of week / time of day patterns
  //    - Lead time (days between booking and appointment)
  //    - Number of previous cancellations
  //    - Insurance/payment status
  //    - Weather (optional external API)
  //    - Distance from clinic (if address available)
  // 3. Apply weighted scoring model (rule-based initially; ML later).
  // 4. Return { probability, riskFactors, suggestedAction }.
  //    Actions: 'send_extra_reminder', 'offer_telehealth', 'overbook_slot', 'call_patient'
}

async getSmartSlotSuggestions(tenantDb, patientId, visitType, preferredDoctor) {
  // 1. Load patient appointment history (preferred day/time patterns).
  // 2. Load doctor availability.
  // 3. Score each available slot by:
  //    - Patient preference alignment
  //    - Expected no-show rate for that slot
  //    - Provider workload balance
  // 4. Return top 5 ranked slots with reasons.
}
```

Add endpoints:

```
GET  /appointments/:id/no-show-prediction  — Get no-show prediction
POST /appointments/smart-suggestions       — Get AI slot suggestions for a patient
GET  /appointments/no-show-risk/today       — Today's high-risk appointments
```

Add a hook in `AppointmentService.createAppointment()` that auto-runs `predictNoShow` for every new appointment. If probability > 0.5, auto-send extra reminder.

#### Frontend

Add to `AppointmentManagement`:
- Risk badge on appointment cards (green/yellow/red based on no-show probability).
- "High Risk" filter tab showing appointments with > 40% no-show probability.
- Smart slot suggestions in "Create Appointment" modal.

#### Acceptance

- Every new appointment gets a no-show prediction score.
- High-risk appointments are flagged with suggested actions.
- Smart slot suggestions rank by patient preference + workload balance.

---

<a id="sprint-g4"></a>
### Sprint G4 — Population Health Registry + Preventive Care Reminders

#### Database

Add provisioning bundle `sprint_g4_population_health`:

```sql
CREATE TABLE IF NOT EXISTS chronic_disease_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_code VARCHAR(20) NOT NULL,
  condition_name VARCHAR(255) NOT NULL,
  condition_type VARCHAR(50) CHECK (condition_type IN ('hypertension','diabetes','asthma','copd','ckd','heart_failure','obesity','depression','other')),
  onset_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','controlled','uncontrolled','remission','resolved')),
  risk_level VARCHAR(20) DEFAULT 'moderate' CHECK (risk_level IN ('low','moderate','high','critical')),
  last_review_date DATE,
  next_review_date DATE,
  care_team JSONB DEFAULT '[]'::jsonb,
  management_plan TEXT,
  target_metrics JSONB DEFAULT '{}'::jsonb,
  current_metrics JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cdr_patient ON chronic_disease_registry(patient_id);
CREATE INDEX IF NOT EXISTS idx_cdr_condition ON chronic_disease_registry(condition_type);
CREATE INDEX IF NOT EXISTS idx_cdr_status ON chronic_disease_registry(status);
CREATE INDEX IF NOT EXISTS idx_cdr_risk ON chronic_disease_registry(risk_level);
CREATE INDEX IF NOT EXISTS idx_cdr_next_review ON chronic_disease_registry(next_review_date);

CREATE TABLE IF NOT EXISTS preventive_care_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  screening_type VARCHAR(100) NOT NULL,
  recommended_by VARCHAR(100) DEFAULT 'USPSTF',
  due_date DATE,
  last_completed_date DATE,
  status VARCHAR(20) DEFAULT 'due' CHECK (status IN ('due','overdue','completed','declined','not_applicable')),
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcr_patient ON preventive_care_reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcr_status ON preventive_care_reminders(status);
CREATE INDEX IF NOT EXISTS idx_pcr_due ON preventive_care_reminders(due_date);

CREATE TABLE IF NOT EXISTS recall_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  criteria JSONB NOT NULL,
  patient_count INTEGER DEFAULT 0,
  last_generated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recall_name ON recall_lists(name);
```

#### Backend

Add `PopulationHealthService`:

```typescript
async enrollInRegistry(tenantDb, patientId, condition) { ... }
async getRegistryDashboard(tenantDb, filters) {
  // Return: total by condition_type, risk distribution, overdue reviews, uncontrolled count
}
async generatePreventiveCareReminders(tenantDb, patientId) {
  // Based on age, sex, conditions:
  // - Mammography (women 50-74, every 2 years)
  // - Colonoscopy (all 45-75, every 10 years)
  // - Pap smear (women 21-65, every 3 years)
  // - Lipid panel (all 40+, every 5 years)
  // - HbA1c (diabetics, every 3-6 months)
  // - Eye exam (diabetics, annually)
  // - Bone density (women 65+)
  // - AAA screening (men 65-75 who ever smoked)
}
async generateRecallList(tenantDb, criteria) {
  // Build patient list from criteria (overdue screenings, lost to follow-up, etc.)
  // Return patient list for bulk notification
}
```

Add endpoints:

```
POST /population-health/registry              — Enroll patient
GET  /population-health/registry              — Dashboard (filters: condition, risk, status)
GET  /population-health/registry/patient/:id  — Patient registry entries
GET  /population-health/preventive-care/:patientId — Get due screenings
POST /population-health/preventive-care/generate — Generate reminders for all patients
POST /population-health/recall-lists           — Create recall list
GET  /population-health/recall-lists           — Get recall lists
POST /population-health/recall-lists/:id/notify — Bulk notify patients on list
```

#### Frontend

Add `PopulationHealthDashboard` page (accessible from admin/doctor dashboard):
- Chronic disease registry summary (pie chart by condition, bar chart by risk level).
- Overdue reviews panel.
- Preventive care panel (due/overdue screenings across patient panel).
- Recall list management (create, generate, bulk SMS/email).

#### Acceptance

- Chronic conditions tracked with risk stratification.
- Preventive care reminders auto-generated based on age/sex/conditions.
- Recall lists generated and bulk notifications sent.

---

## Phase H — Practice Management & Revenue

<a id="sprint-h1"></a>
### Sprint H1 — Fee Schedule + Superbill + Insurance Verification

#### Database

Add provisioning bundle `sprint_h1_practice_management`:

```sql
CREATE TABLE IF NOT EXISTS fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  payer_type VARCHAR(50) CHECK (payer_type IN ('self_pay','medical_aid','insurance','government','other')),
  payer_name VARCHAR(255),
  effective_date DATE NOT NULL,
  end_date DATE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_schedule_id UUID NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
  cpt_code VARCHAR(10) NOT NULL,
  description VARCHAR(500),
  charge_amount DECIMAL(12,2) NOT NULL,
  allowed_amount DECIMAL(12,2),
  modifier VARCHAR(10),
  effective_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fsi_schedule ON fee_schedule_items(fee_schedule_id);
CREATE INDEX IF NOT EXISTS idx_fsi_cpt ON fee_schedule_items(cpt_code);

CREATE TABLE IF NOT EXISTS superbill_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  payer_name VARCHAR(255),
  policy_number VARCHAR(100),
  group_number VARCHAR(100),
  verification_status VARCHAR(30) DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','denied','expired','not_found')),
  coverage_details JSONB DEFAULT '{}'::jsonb,
  copay_amount DECIMAL(10,2),
  deductible_remaining DECIMAL(10,2),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iv_patient ON insurance_verifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_iv_appointment ON insurance_verifications(appointment_id);
```

#### Backend + Frontend

Standard CRUD + management UI for fee schedules, superbill templates, insurance verification workflow.

---

<a id="sprint-h2"></a>
### Sprint H2 — Prior Authorization Workflow

#### Database

```sql
CREATE TABLE IF NOT EXISTS prior_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  payer_name VARCHAR(255),
  authorization_type VARCHAR(50) CHECK (authorization_type IN ('medication','procedure','imaging','referral','dme','other')),
  service_description TEXT NOT NULL,
  cpt_code VARCHAR(10),
  icd10_code VARCHAR(10),
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','submitted','pending','approved','denied','expired','appeal')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  decision_at TIMESTAMP WITH TIME ZONE,
  authorization_number VARCHAR(100),
  authorized_units INTEGER,
  authorized_from DATE,
  authorized_to DATE,
  denial_reason TEXT,
  appeal_deadline DATE,
  notes TEXT,
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_patient ON prior_authorizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_pa_status ON prior_authorizations(status);
```

Standard CRUD + status workflow + UI in billing/admin dashboard.

---

<a id="sprint-h3"></a>
### Sprint H3 — Patient Portal: Bill Pay + Health Education + Family Access

#### Database

```sql
CREATE TABLE IF NOT EXISTS patient_portal_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  bill_id UUID,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(30) CHECK (payment_method IN ('ecocash','onemoney','card','bank_transfer')),
  payment_reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_education_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  category VARCHAR(100),
  content_type VARCHAR(30) DEFAULT 'article' CHECK (content_type IN ('article','video','infographic','faq')),
  body TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  tags JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hec_category ON health_education_content(category);
CREATE INDEX IF NOT EXISTS idx_hec_language ON health_education_content(language);

CREATE TABLE IF NOT EXISTS patient_family_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  proxy_name VARCHAR(255) NOT NULL,
  proxy_email VARCHAR(255) NOT NULL,
  proxy_phone VARCHAR(30),
  relationship VARCHAR(50),
  access_level VARCHAR(30) DEFAULT 'view_only' CHECK (access_level IN ('view_only','full','emergency_only')),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pfa_patient ON patient_family_access(patient_id);
```

Add patient portal endpoints for bill payment, health education browsing, and family access management.

---

<a id="sprint-h4"></a>
### Sprint H4 — Recall Campaigns + Bulk Notifications

Add bulk SMS/email campaign tables, campaign management service, and admin UI for sending recall notifications to patient lists. Integrate with existing `NotificationsService`.

---

## Phase I — Africa/Zimbabwe-Specific Edge

<a id="sprint-i1"></a>
### Sprint I1 — Travel Vaccine Destination Engine + Yellow Card

Status: **done**

#### Database

```sql
CREATE TABLE IF NOT EXISTS travel_vaccine_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name VARCHAR(100) NOT NULL,
  iso_code VARCHAR(3) NOT NULL UNIQUE,
  region VARCHAR(100),
  required_vaccines JSONB DEFAULT '[]'::jsonb,
  recommended_vaccines JSONB DEFAULT '[]'::jsonb,
  malaria_prophylaxis_zones JSONB DEFAULT '[]'::jsonb,
  special_notes TEXT,
  last_updated DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tvd_iso ON travel_vaccine_destinations(iso_code);

CREATE TABLE IF NOT EXISTS vaccination_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  certificate_number VARCHAR(50) NOT NULL UNIQUE,
  certificate_type VARCHAR(30) DEFAULT 'yellow_card' CHECK (certificate_type IN ('yellow_card','covid_card','general')),
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by UUID REFERENCES users(id),
  issuing_center VARCHAR(255),
  immunization_ids JSONB DEFAULT '[]'::jsonb,
  pdf_storage_key VARCHAR(500),
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vc_patient ON vaccination_certificates(patient_id);
```

Seed destination data for 50+ countries (Africa, South America, South/Southeast Asia) with Yellow Fever, Typhoid, Rabies, Cholera, JE requirements.

Backend: `TravelVaccineService` with:
- `getDestinationRequirements(countryCode)` — returns required/recommended vaccines + malaria zones.
- `assessPatientTravelReadiness(patientId, destinations[])` — compare patient immunization history vs. destination requirements; return gaps.
- `generateYellowCard(patientId)` — generate International Certificate of Vaccination PDF.

Frontend: Travel clinic workflow in immunization module.

---

<a id="sprint-i2"></a>
### Sprint I2 — Multi-Currency Billing + Medical Aid Integration

Status: **done**

Add currency field to billing tables, support USD/ZAR/ZiG, exchange rate management.

Medical aid integration stubs for CIMAS, First Mutual, PSMAS (claim submission format, eligibility check, remittance processing).

---

## Phase J — AI-First Human-Last Completion

<a id="sprint-j1"></a>
### Sprint J1 — Auto-Generated Referral Letters + Clinical Note Drafts

Status: **done**

Use CDSS LLM to auto-generate referral letters from encounter context. Doctor reviews and sends.

Auto-generate clinical note drafts from transcription (beyond SOAP — include assessment, plan, follow-up).

---

<a id="sprint-j2"></a>
### Sprint J2 — Deterioration Detection + Early Warning Score (NEWS2)

Status: **done**

#### Database

```sql
CREATE TABLE IF NOT EXISTS patient_early_warning_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  score_type VARCHAR(20) DEFAULT 'NEWS2' CHECK (score_type IN ('NEWS2', 'MEWS', 'PEWS')),
  total_score INTEGER NOT NULL,
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'low_medium', 'medium', 'high')),
  component_scores JSONB NOT NULL,
  vitals_id UUID,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  alert_triggered BOOLEAN DEFAULT false,
  alert_acknowledged_by UUID REFERENCES users(id),
  alert_acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ews_patient ON patient_early_warning_scores(patient_id);
CREATE INDEX IF NOT EXISTS idx_ews_score ON patient_early_warning_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_ews_risk ON patient_early_warning_scores(risk_level);
```

Auto-calculate NEWS2 from vitals (respiratory rate, SpO2, supplemental O2, temperature, systolic BP, heart rate, consciousness). Alert when score ≥ 5 or any single parameter scores 3.

---

<a id="sprint-j3"></a>
### Sprint J3 — Pregnancy-Aware Prescribing + Renal/Hepatic Dose Adjustment

Status: **done**

Add FDA pregnancy category / Australian category checks during prescribing. If patient has active maternity enrollment, flag teratogenic medications.

Add renal dose adjustment: if patient has eGFR < 60 (from latest labs), suggest dose reduction for renally-cleared medications. Same for hepatic impairment (Child-Pugh score from labs/conditions).

---

## Phase K — Gap Remediation & Hardening

> **Context:** A comprehensive audit on 2026-03-07 identified implementation gaps where database provisioning was completed but service logic, controller endpoints, or frontend UI were not built (or only partially built). Phase K ensures every planned feature is fully delivered end-to-end before MediCore v2 ships.

---

<a id="sprint-k1"></a>
### Sprint K1 — Encounter Auto-Coding Service + UI (G2 gap)

**Addresses:** Sprint G2 — Real-Time Encounter Auto-Coding (ICD/CPT). The `encounter_code_suggestions` table and provisioning bundle exist, but no service, controller, or frontend was implemented.

#### Backend

**File:** `services/ehr-service/src/services/encounter-coding.service.ts` (new)

Create `EncounterCodingService` with:

```typescript
async suggestEncounterCodes(tenantDb, sessionId, appointmentId, patientId) {
  // 1. Load clinical note / SOAP / transcript from session or appointment.
  // 2. Extract diagnoses and procedures from text using CDSS diagnosis-assist + NLP.
  // 3. Map diagnoses to ICD-10 codes using Icd10Service.
  // 4. Map procedures to CPT codes using terminology mapping.
  // 5. Calculate E&M level based on:
  //    - Number of problems addressed
  //    - Data reviewed (labs, imaging, external records)
  //    - Risk of complications / management decisions
  //    - Time-based if > 50% counseling
  // 6. Suggest modifiers (25 for significant separate E&M, 59 for distinct procedure).
  // 7. Persist suggestions to encounter_code_suggestions.
  // 8. Return { icd10: [...], cpt: [...], emLevel, modifiers, confidence }.
}

async reviewEncounterCodes(tenantDb, suggestionId, body, actorId) {
  // Accept/reject individual codes. Update accepted_codes, rejected_codes.
}
```

**File:** `services/ehr-service/src/controllers/encounter-coding.controller.ts` (new)

```
POST /post-visit/sessions/:id/suggest-codes  — Generate ICD/CPT suggestions from session
POST /encounters/:appointmentId/suggest-codes — Generate from appointment/note
PUT  /encounter-codes/:id/review              — Accept/reject suggestions
```

Register in `ehr.module.ts`.

#### Frontend

Add to `PostVisitDoctorWorkspace` and/or `DoctorDashboard`:
- "Suggest Codes" button that calls the API.
- Panel showing suggested ICD-10 codes with descriptions and confidence.
- Panel showing suggested CPT codes with E&M level rationale.
- Accept/reject toggles per code.
- Final accepted codes auto-populate the billing/charge capture.

Add API helpers to `ehr-frontend/src/services/api.ts`.

#### Acceptance

- After completing a clinical note, doctor clicks "Suggest Codes" and gets ICD-10 + CPT recommendations.
- E&M level calculated with rationale.
- Doctor reviews and accepts/rejects; accepted codes flow into billing.

---

<a id="sprint-k2"></a>
### Sprint K2 — No-Show Prediction Service + UI (G3 gap)

**Addresses:** Sprint G3 — Predictive Scheduling + No-Show AI. The `appointment_no_show_predictions` table and provisioning bundle exist, but no service, controller, or frontend was implemented.

#### Backend

**File:** `services/ehr-service/src/services/scheduling-intelligence.service.ts` (new)

Create `SchedulingIntelligenceService` with:

```typescript
async predictNoShow(tenantDb, appointmentId) {
  // 1. Load appointment + patient history.
  // 2. Calculate features:
  //    - Historical no-show rate for this patient
  //    - Day of week / time of day patterns
  //    - Lead time (days between booking and appointment)
  //    - Number of previous cancellations
  //    - Insurance/payment status
  // 3. Apply weighted scoring model (rule-based initially).
  // 4. Persist prediction to appointment_no_show_predictions.
  // 5. Return { probability, riskFactors, suggestedAction }.
  //    Actions: 'send_extra_reminder', 'offer_telehealth', 'overbook_slot', 'call_patient'
}

async getSmartSlotSuggestions(tenantDb, patientId, visitType, preferredDoctor) {
  // 1. Load patient appointment history (preferred day/time patterns).
  // 2. Load doctor availability.
  // 3. Score each available slot by patient preference, no-show rate, workload balance.
  // 4. Return top 5 ranked slots with reasons.
}
```

**File:** `services/ehr-service/src/controllers/scheduling-intelligence.controller.ts` (new)

```
GET  /appointments/:id/no-show-prediction   — Get no-show prediction
POST /appointments/smart-suggestions        — Get AI slot suggestions
GET  /appointments/no-show-risk/today        — Today's high-risk appointments
```

Register in `ehr.module.ts`.

**Hook:** In `AppointmentService.createAppointment()`, after saving the appointment, call `schedulingIntelligenceService.predictNoShow()`. If probability > 0.5, auto-send extra reminder.

#### Frontend

Update `AppointmentManagement`:
- Risk badge on appointment cards (green/yellow/red based on no-show probability).
- "High Risk" filter tab showing appointments with > 40% no-show probability.
- Smart slot suggestions in "Create Appointment" modal.

Add API helpers to `ehr-frontend/src/services/api.ts`.

#### Acceptance

- Every new appointment gets a no-show prediction score.
- High-risk appointments are flagged with suggested actions.
- Smart slot suggestions rank by patient preference + workload balance.

---

<a id="sprint-k3"></a>
### Sprint K3 — Allergy Cross-Reactivity Engine (G1 gap)

**Addresses:** Sprint G1 — Allergy Cross-Reactivity + Structured CDSS Integration. The current allergy check uses legacy `patient.allergies` text field and local fuzzy matching. No cross-reactivity map, no structured CDSS endpoint.

#### Backend

**File:** `services/ehr-service/src/config/allergy-cross-reactivity.ts` (new)

```typescript
export const CROSS_REACTIVITY_MAP: Record<string, { relatedClasses: string[]; riskLevel: string; message: string }> = {
  penicillin: {
    relatedClasses: ['cephalosporin', 'carbapenem'],
    riskLevel: 'moderate',
    message: '1-2% cross-reactivity risk with cephalosporins; use with caution or avoid.',
  },
  sulfonamide: {
    relatedClasses: ['sulfonylurea', 'thiazide'],
    riskLevel: 'low',
    message: 'Low cross-reactivity risk; monitor for hypersensitivity.',
  },
  nsaid: {
    relatedClasses: ['aspirin', 'salicylate', 'cox2_inhibitor'],
    riskLevel: 'high',
    message: 'Cross-reactivity between NSAIDs is common; avoid entire class unless tested.',
  },
};
```

**File:** `services/ehr-service/src/services/cdss.service.ts`

Add `getAllergyWarnings(patientId, medicationName, tenantDb)`:
1. Load structured allergies from `allergies` table (not legacy text).
2. Load drug class from `drugs` table or infer from medication name.
3. Check exact allergen match.
4. Check cross-reactivity via `CROSS_REACTIVITY_MAP`.
5. Return `{ warnings: [{ severity, allergen, medication, crossReactivity, message }] }`.

**File:** `services/ehr-service/src/controllers/cdss.controller.ts`

Add endpoint:

```
POST /cdss/allergy-check-structured — Check structured allergies with cross-reactivity
```

#### Frontend

In `PrescriptionsModal`, before save:
1. Call `POST /cdss/allergy-check-structured` with patient ID and selected medication.
2. If warnings returned, show alert panel with severity badges.
3. If severity = 'high', require explicit acknowledgement before saving.

#### Acceptance

- Patient with penicillin allergy gets warning when prescribing amoxicillin (exact match) AND cefazolin (cross-reactivity).
- Cross-reactivity map is configurable and extensible.
- CDSS uses structured allergies table, not legacy text.

---

<a id="sprint-k4"></a>
### Sprint K4 — Infection Control Frontend + Sepsis Auto-Screening (F3 gap)

**Addresses:** Sprint F3 — Infection Control Completion + Sepsis Bundle Automation. Backend endpoints for hand hygiene and device days exist but frontend panels are missing. Auto sepsis screening via qSOFA in VitalsService and auto `three_hour_bundle_complete` are missing.

#### Backend Fixes

**File:** `services/ehr-service/src/services/sepsis.service.ts`

In `updateBundleElement()`, after setting the element and timestamp:
- Check if `lactate_measured`, `blood_cultures_drawn`, and `broad_spectrum_antibiotics_given` are all true.
- If so, and all their `_at` timestamps are within 3 hours of `sepsis_onset_time`, set `three_hour_bundle_complete = true`.

**File:** `services/ehr-service/src/services/vitals.service.ts`

In `recordVitals()`, after saving vitals, add qSOFA check:
- Respiratory rate >= 22
- Systolic BP <= 100
- Altered mental status (GCS < 15, if available)
- If qSOFA >= 2, auto-create sepsis screening alert via `SepsisService`.

#### Frontend

**File:** `ehr-frontend/src/pages/InfectionControlDashboard.tsx`

Add two new panels:
1. **Hand Hygiene Compliance** — Call `GET /infection-control/hand-hygiene/compliance`, display WHO 5 Moments compliance % by department. Add observation recording form calling `POST /infection-control/hand-hygiene`.
2. **Device Day Tracking** — Call `GET /infection-control/device-days/rates`, display CAUTI/CLABSI/VAP rates. Add device insertion/removal forms.

**File:** `ehr-frontend/src/pages/SepsisDashboard.tsx`

Add **Bundle Element Timeline** panel showing per-element completion times (lactate, cultures, antibiotics, fluids, vasopressors) with timestamps relative to `sepsis_onset_time`.

#### Acceptance

- Hand hygiene compliance tracked with WHO 5 Moments.
- Device-day denominators enable standard HAI rate calculation.
- Sepsis bundle auto-completes 3-hour bundle when criteria met.
- qSOFA >= 2 from vitals auto-triggers sepsis screening.
- Bundle timeline shows per-element timing.

---

<a id="sprint-k5"></a>
### Sprint K5 — Scheduled MAR Timeline + Witness UI (F4 gap)

**Addresses:** Sprint F4 — BCMA Prescription-to-MAR + Witness Workflow. Backend endpoints for scheduled MAR entries and witness enforcement exist but the frontend doesn't use them.

#### Frontend

**File:** `ehr-frontend/src/pages/MARDashboard.tsx`

Replace or augment the current MAR records view:
1. Fetch scheduled entries from `GET /bcma/mar/scheduled/:patientId`.
2. Display as a **24-hour medication timeline** (08:00, 14:00, 20:00, etc.).
3. Each entry shows: medication name, dose, route, status (scheduled/given/held/refused/missed/late).
4. "Scan & Give" from a scheduled entry opens `MedicationScannerModal` pre-filled with the entry data.
5. Use `POST /bcma/mar/scheduled/:id/administer` for administration.

**File:** `ehr-frontend/src/components/MedicationScannerModal.tsx`

Add witness enforcement:
1. If the scheduled entry has `requires_witness = true` (high-alert or controlled substance), show a **Witness** field.
2. Witness field: search for co-worker by name, select.
3. Include `witnessedById` in the administration request body.
4. Block submission without a witness when required.

#### Acceptance

- Prescriptions auto-generate scheduled MAR entries (backend already works).
- MAR dashboard shows a 24-hour medication timeline.
- High-alert / controlled substances require witness before administration.
- Scanner modal opens and completes the verification flow from a scheduled entry.

---

<a id="sprint-k6"></a>
### Sprint K6 — Auth Consistency Sweep + E1 Seed Data Completion

**Addresses:** Multiple minor gaps from the audit.

#### 1. Auth Consistency Sweep

**Problem:** Several controllers still use `req.user.id` instead of the safe pattern `req.user?.userId ?? (req.user as any)?.id`. This can cause runtime errors if the JWT payload uses `userId` instead of `id`.

**Files to fix (grep for `req.user.id` and `req.user.userId` without optional chaining):**
- `services/ehr-service/src/controllers/anesthesia.controller.ts`
- `services/ehr-service/src/controllers/dietary.controller.ts`
- `services/ehr-service/src/controllers/lab-order.controller.ts`
- `services/ehr-service/src/controllers/prescription.controller.ts`
- `services/ehr-service/src/controllers/revenue-cycle.controller.ts`
- Any other controllers found via grep.

Replace all with: `req.user?.userId ?? (req.user as any)?.id`

#### 2. E1 Vaccine Seed Data Completion

**Problem:** Only 3 vaccine seeds were inserted in the E1 provisioning bundle. Plan calls for 23+ routine + 11+ travel vaccines.

**File:** `services/tenant-service/src/services/database-provisioning.service.ts`

In `getSprintE1ImmunizationAlignmentStatements()`, add the full vaccine schedule seed as specified in the E1 plan:
- 23 routine vaccines (BCG, OPV x4, Rotavirus x2, PCV13 x3, Hib x3, Varicella x2, Hep A x2, MenACWY x2, Tdap, PPSV23, Zoster x2)
- 11 travel vaccines (Yellow Fever, Typhoid Injectable + Oral, Rabies x3, Cholera x2, JE x2, MenACWY Travel)

Use `INSERT ... WHERE NOT EXISTS` for idempotency.

#### 3. E1 Administer Endpoint Alignment

**File:** `services/ehr-service/src/controllers/immunization.controller.ts`

Add `POST /patient/:patientId/administer` endpoint that maps to `recordImmunization` with `patientId` from the path parameter (as specified in plan). Keep existing `POST /administer` as well for backwards compatibility.

#### 4. Provisioning Appendix Update

Add `H4` bundle to the provisioning checklist appendix table (it was implemented but not listed).

#### Acceptance

- No controller uses `req.user.id` directly — all use the safe pattern.
- E1 provisioning seeds 34 vaccines (23 routine + 11 travel).
- `POST /immunizations/patient/:patientId/administer` endpoint exists.
- Provisioning checklist appendix matches actual bundles.

---

## Appendix — Provisioning Checklist

Every sprint that introduces new tables or columns MUST add a provisioning bundle in `services/tenant-service/src/services/database-provisioning.service.ts` inside `getProvisioningBundles()`. The bundle must:

1. Have a unique `id` (e.g., `sprint_e1_immunization_alignment`).
2. Have a `label`, `version` (date string), and `description`.
3. Return `statements: () => this.getSprintXXStatements()`.
4. The private method returns an array of idempotent SQL strings (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT ... WHERE NOT EXISTS`).
5. A provisioning script in `scripts/provision-sprint-XX-*.ts` following the pattern of `scripts/provision-sprint57-post-visit-intravisit-alerts.ts`.

**Bundles for this plan:**

| Sprint | Bundle ID | Tables/Changes |
|--------|-----------|----------------|
| E1 | `sprint_e1_immunization_alignment` | immunizations, vaccine_inventory, immunization_schedules, vaccine_adverse_events, immunization_registry_submissions, immunization_forecasts + seed data |
| E3 | `sprint_e3_security_2fa` | ALTER users ADD two_factor_secret, two_factor_enabled |
| F1 | `sprint_f1_or_surgical_safety` | surgical_safety_checklists, surgical_count_sheets, surgical_specimens |
| F2 | `sprint_f2_blood_bank_crossmatch` | blood_cross_match, transfusion_reactions |
| F3 | `sprint_f3_infection_sepsis` | hand_hygiene_observations, device_day_tracking; ALTER sepsis_bundles |
| F4 | `sprint_f4_bcma_mar` | mar_scheduled_entries |
| G2 | `sprint_g2_encounter_coding` | encounter_code_suggestions |
| G3 | `sprint_g3_scheduling_ai` | appointment_no_show_predictions |
| G4 | `sprint_g4_population_health` | chronic_disease_registry, preventive_care_reminders, recall_lists |
| H1 | `sprint_h1_practice_management` | fee_schedules, fee_schedule_items, superbill_templates, insurance_verifications |
| H2 | `sprint_h2_prior_auth` | prior_authorizations |
| H3 | `sprint_h3_patient_portal_enhancements` | patient_portal_payments, health_education_content, patient_family_access |
| H4 | `sprint_h4_recall_campaigns` | notification_campaigns, notification_campaign_recipients |
| I1 | `sprint_i1_travel_vaccines` | travel_vaccine_destinations, vaccination_certificates |
| J2 | `sprint_j2_early_warning` | patient_early_warning_scores |

---

## Appendix — Mobile-Ready API Summary

All new patient-facing endpoints are designed for mobile consumption:

| Endpoint | Mobile Use |
|----------|-----------|
| `GET /patient-portal/immunizations/forecast` | Show due vaccines |
| `GET /patient-portal/preventive-care` | Show due screenings |
| `GET /patient-portal/health-education` | Browse articles/videos |
| `POST /patient-portal/bills/:id/pay` | Pay bills |
| `GET /patient-portal/family-access` | Manage family/caregiver access |
| `POST /patient-portal/appointments/request-with-payment` | Book with payment |
| `GET /patient-portal/travel-vaccine-readiness` | Travel vaccine assessment |

---

## Execution Board

| Sprint | Status |
|--------|--------|
| E1 Immunization API Alignment + Travel Vaccines | `done` |
| E2 Hospital Module Wiring (BCMA/OR/PACU/ED) | `done` |
| E3 Security Fixes (SQL injection, 2FA, session) | `done` |
| F1 OR Surgical Safety + Preference Cards | `done` |
| F2 Blood Bank Crossmatch + Transfusion | `done` |
| F3 Infection Control + Sepsis Automation | `done` |
| F4 BCMA Prescription-to-MAR + Witness | `done` |
| G1 Allergy Cross-Reactivity + CDSS | `done` |
| G2 Real-Time Encounter Auto-Coding | `done` |
| G3 Predictive Scheduling + No-Show AI | `done` |
| G4 Population Health + Preventive Care | `done` |
| H1 Fee Schedule + Superbill + Insurance | `done` |
| H2 Prior Authorization Workflow | `done` |
| H3 Patient Portal (Pay/Education/Family) | `done` |
| H4 Recall Campaigns + Bulk Notifications | `done` |
| I1 Travel Vaccine Engine + Yellow Card | `done` |
| I2 Multi-Currency + Medical Aid | `done` |
| J1 Auto Referral Letters + Note Drafts | `done` |
| J2 Deterioration Detection + NEWS2 | `done` |
| J3 Pregnancy-Aware + Renal/Hepatic Dosing | `done` |
| **Phase K — Gap Remediation** | |
| K1 Encounter Auto-Coding Service + UI (G2 gap) | `done` |
| K2 No-Show Prediction Service + UI (G3 gap) | `done` |
| K3 Allergy Cross-Reactivity Engine (G1 gap) | `done` |
| K4 Infection Control Frontend + Sepsis Auto-Screening (F3 gap) | `done` |
| K5 Scheduled MAR Timeline + Witness UI (F4 gap) | `done` |
| K6 Auth Consistency Sweep + E1 Seed Data (E1/E2 gap) | `done` |
