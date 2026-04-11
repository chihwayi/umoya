# Codex Sprint Brief — S144: Sickle Cell Disease (SCD) Register + Haemoglobinopathy Protocol

**Date:** 2026-04-11
**Branch:** main
**Reviewer:** Claude (signs off before you move to S145)

---

## 1. Goal

Build a complete end-to-end Sickle Cell Disease module — the highest-burden haemoglobinopathy in Sub-Saharan Africa with ~300 000 affected births per year and zero current coverage in this EHR.

This sprint delivers:

- **SCD/Haemoglobinopathy Register** — structured enrolment capturing genotype (HbSS, HbSC, HbS/β-thal, carrier HbAS), diagnosis context, and comorbidity flags
- **Crisis Event Log** — vaso-occlusive crisis (VOC), acute chest syndrome (ACS), splenic sequestration, stroke/TIA — each with severity grade and management actions taken
- **Complication Screening Schedule** — annual TCD (transcranial Doppler) for stroke risk, spleen palpation, eye exam, renal function, priapism, leg ulcer — WHO/ASH 2020 protocol
- **Treatment Record** — hydroxyurea therapy (indication, dose, dose adjustments), prophylactic penicillin, folic acid, malaria prophylaxis, transfusion records
- **CDSS: Hydroxyurea Dosing** — weight-based starting dose, titration schedule, lab monitoring thresholds (Hb, MCV, WBC, reticulocytes, ANC, platelets)
- **CDSS: Crisis Triage** — severity classification (uncomplicated VOC → ACS → life-threatening), emergency escalation triggers, analgesia ladder (WHO step 3 for SCD pain)
- **CDSS: Complication Risk** — stroke risk score (TCD velocity, prior TIA, anaemia severity), priapism recurrence risk, renal involvement flag
- **Newborn Screening Linkage** — link SCD enrolment to CRVS birth registration (S139) by patient ID
- **Malaria Prophylaxis Integration** — auto-flag patients with HbSS/HbSC for chloroquine/proguanil prophylaxis where endemic (links to S140 malaria module)
- **SCD Dashboard** — full NurseDashboard integration under the existing NCD section

---

## 2. What Already Exists — Do NOT Recreate

### CDSS (`services/cdss-service/main.py`)
These endpoints already exist — **do not recreate them**:
- `POST /malaria/act-dose`, `POST /malaria/g6pd-check`, `POST /malaria/iptp-due` — malaria, leave alone
- `POST /mental-health/screen`, `POST /mental-health/risk` — mental health, leave alone
- `POST /cdss/htn/step-therapy`, `POST /cdss/htn/cvd-risk` — HTN (S143), leave alone
- `POST /cdss/tm/hdi-check`, `POST /cdss/tm/toxicity-risk` — TM/HDI (S143b), leave alone
- `POST /cdss/cervical-cancer/screen-recommend` — cervical (S142), leave alone
- `POST /cdss/family-planning/method-eligibility` — FP (S142), leave alone

### EHR Service — do NOT touch these
- `controllers/hypertension.controller.ts` — HTN register (S143)
- `controllers/traditional-medicine.controller.ts` — TM/HDI (S143b)
- `controllers/cervical-cancer.controller.ts`, `controllers/family-planning.controller.ts` — S142
- `controllers/diabetes.controller.ts` — Diabetes (existing, comprehensive)
- `controllers/tb.controller.ts` — TB DOTS (existing)
- `controllers/malaria.controller.ts`, `controllers/malaria-episode.controller.ts` — Malaria (S140)
- All other existing controllers — leave untouched

### Frontend — do NOT replace
- `components/HypertensionDashboard.tsx` — HTN (S143)
- `components/TraditionalMedicineDashboard.tsx` — TM/HDI (S143b)
- `components/MalariaDashboard.tsx`, `components/TbDashboard.tsx` — existing
- `pages/NurseDashboard.tsx` — **extend only** (add SCD tab to NCD section)

No SCD/haemoglobinopathy entity, controller, service, CDSS endpoint, or frontend component exists anywhere in the codebase. These are entirely new.

---

## 3. Database Changes

### 3a. New tables

```sql
-- ── SCD / Haemoglobinopathy Register ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS scd_register (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL,
  enrolled_by           UUID NOT NULL,
  enrolled_at           DATE NOT NULL,
  genotype              VARCHAR(20) NOT NULL,  -- HbSS | HbSC | HbS_beta_thal | HbAS | HbAC | other
  diagnosis_method      VARCHAR(30),           -- newborn_screening | electrophoresis | hplc | sickling_test | clinical
  diagnosis_date        DATE,
  is_confirmed          BOOLEAN NOT NULL DEFAULT false,
  linked_birth_id       UUID,                  -- optional link to CRVS birth registration (no FK)
  baseline_hb_g_dl      NUMERIC(4,1),          -- baseline Hb g/dL at enrolment
  blood_group           VARCHAR(5),            -- ABO+Rh
  has_stroke_history    BOOLEAN NOT NULL DEFAULT false,
  has_acs_history       BOOLEAN NOT NULL DEFAULT false,
  has_priapism_history  BOOLEAN NOT NULL DEFAULT false,
  has_renal_disease     BOOLEAN NOT NULL DEFAULT false,
  has_avascular_necrosis BOOLEAN NOT NULL DEFAULT false,
  on_hydroxyurea        BOOLEAN NOT NULL DEFAULT false,
  on_penicillin_prophylaxis BOOLEAN NOT NULL DEFAULT false,
  on_folic_acid         BOOLEAN NOT NULL DEFAULT false,
  on_malaria_prophylaxis BOOLEAN NOT NULL DEFAULT false,
  transcranial_doppler_velocity NUMERIC(5,1),  -- cm/s — latest TCD result
  tcd_date              DATE,
  spleen_status         VARCHAR(20),           -- normal | enlarged | auto_infarcted | removed
  status                VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | lost_to_follow_up | transferred | deceased
  next_review_date      DATE,
  notes                 TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scd_register_patient     ON scd_register(patient_id);
CREATE INDEX IF NOT EXISTS idx_scd_register_genotype    ON scd_register(genotype);
CREATE INDEX IF NOT EXISTS idx_scd_register_status      ON scd_register(status);
CREATE INDEX IF NOT EXISTS idx_scd_register_next_review ON scd_register(next_review_date);

-- ── SCD Crisis Events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scd_crisis_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL,
  scd_register_id       UUID,                  -- links to scd_register.id (no FK)
  recorded_by           UUID NOT NULL,
  event_date            DATE NOT NULL,
  crisis_type           VARCHAR(30) NOT NULL,  -- voc | acs | splenic_sequestration | stroke | tia | priapism | aplastic_crisis | other
  severity              VARCHAR(15) NOT NULL,  -- mild | moderate | severe | life_threatening
  pain_score            INT,                   -- 0–10 NRS
  trigger_identified    VARCHAR(100),          -- infection | dehydration | cold_exposure | stress | unknown
  sbp_at_event          INT,
  dbp_at_event          INT,
  spo2_at_event         INT,                   -- %
  hb_at_event           NUMERIC(4,1),          -- g/dL
  wbc_at_event          NUMERIC(6,2),          -- ×10⁹/L
  management            TEXT,                  -- what was done
  analgesia_given       VARCHAR(200),          -- e.g. "morphine 0.1mg/kg IV + ketorolac"
  transfusion_given     BOOLEAN NOT NULL DEFAULT false,
  transfusion_units     INT,
  hospitalised          BOOLEAN NOT NULL DEFAULT false,
  hospital_days         INT,
  outcome               VARCHAR(30),           -- resolved | ongoing | transferred | deceased
  notes                 TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scd_crisis_patient       ON scd_crisis_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_scd_crisis_register      ON scd_crisis_events(scd_register_id);
CREATE INDEX IF NOT EXISTS idx_scd_crisis_type          ON scd_crisis_events(crisis_type);
CREATE INDEX IF NOT EXISTS idx_scd_crisis_date          ON scd_crisis_events(event_date);

-- ── SCD Treatment Records ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scd_treatment_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL,
  scd_register_id       UUID,                  -- (no FK)
  recorded_by           UUID NOT NULL,
  recorded_at           DATE NOT NULL,
  treatment_type        VARCHAR(30) NOT NULL,  -- hydroxyurea | penicillin_prophylaxis | folic_acid | malaria_prophylaxis | transfusion | bone_marrow_transplant | other
  drug_name             VARCHAR(100),
  dose_mg               NUMERIC(8,2),
  dose_mg_per_kg        NUMERIC(6,2),
  frequency             VARCHAR(50),
  indication            TEXT,
  -- Hydroxyurea monitoring labs (recorded at each HU review visit)
  hb_g_dl               NUMERIC(4,1),
  mcv_fl                NUMERIC(5,1),          -- mean corpuscular volume — rises with HU response
  wbc_x10_9             NUMERIC(6,2),
  anc_x10_9             NUMERIC(6,2),          -- absolute neutrophil count — hold HU if <2.0
  platelets_x10_9       NUMERIC(7,2),          -- hold HU if <80
  reticulocytes_pct     NUMERIC(4,1),
  hbf_pct               NUMERIC(4,1),          -- foetal Hb % — target >20% on HU
  action                VARCHAR(30),           -- continue | dose_up | dose_hold | stop | switch
  next_review_date      DATE,
  notes                 TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scd_treatment_patient    ON scd_treatment_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_scd_treatment_register   ON scd_treatment_records(scd_register_id);
CREATE INDEX IF NOT EXISTS idx_scd_treatment_type       ON scd_treatment_records(treatment_type);
CREATE INDEX IF NOT EXISTS idx_scd_treatment_date       ON scd_treatment_records(recorded_at);

-- ── SCD Complication Screenings ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scd_complication_screenings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL,
  scd_register_id       UUID,                  -- (no FK)
  screened_by           UUID NOT NULL,
  screened_at           DATE NOT NULL,
  screening_type        VARCHAR(30) NOT NULL,  -- tcd | eye | renal | cardiac | pulmonary | bone | growth | neurocognitive
  result_normal         BOOLEAN,
  result_detail         TEXT,                  -- structured free text / measurement
  -- TCD-specific
  tcd_velocity_cm_s     NUMERIC(5,1),          -- >200 cm/s = abnormal → stroke risk
  tcd_classification    VARCHAR(20),           -- normal | conditional | abnormal
  -- Renal-specific
  egfr_ml_min           NUMERIC(6,1),
  urine_albumin_creatinine NUMERIC(7,2),       -- mg/mmol — microalbuminuria flag
  -- Referral outcome
  referred              BOOLEAN NOT NULL DEFAULT false,
  referral_reason       TEXT,
  next_screening_date   DATE,
  notes                 TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scd_screen_patient       ON scd_complication_screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_scd_screen_register      ON scd_complication_screenings(scd_register_id);
CREATE INDEX IF NOT EXISTS idx_scd_screen_type          ON scd_complication_screenings(screening_type);
```

### 3b. Provisioning bundle

File: `services/tenant-service/src/generated/tenant-scd.statements.ts`
Bundle version: `2026.04.11.18`

```typescript
export const TENANT_SCD_BUNDLE_VERSION = '2026.04.11.18';
export const TENANT_SCD_STATEMENTS = (): string[] => [
  // all CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS statements above
];
```

Register in `services/tenant-service/src/services/database-provisioning.service.ts` — import and add after the `sprint143b_traditional_medicine_hdi` entry:

```typescript
{
  id: 'sprint144_scd_haemoglobinopathy',
  label: 'Sickle Cell Disease Register + Complication Protocol',
  version: TENANT_SCD_BUNDLE_VERSION,
  description: 'S144 — SCD register, crisis events, treatment records, complication screenings',
  statements: TENANT_SCD_STATEMENTS,
},
```

---

## 4. New Entities

All files go in `services/ehr-service/src/entities/`.

### `scd-register.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('scd_register')
export class ScdRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'enrolled_by', type: 'uuid' }) enrolledBy: string;
  @Column({ name: 'enrolled_at', type: 'date' }) enrolledAt: string;
  @Column({ length: 20 }) genotype: string;
  @Column({ name: 'diagnosis_method', length: 30, nullable: true }) diagnosisMethod: string | null;
  @Column({ name: 'diagnosis_date', type: 'date', nullable: true }) diagnosisDate: string | null;
  @Column({ name: 'is_confirmed', type: 'boolean', default: false }) isConfirmed: boolean;
  @Column({ name: 'linked_birth_id', type: 'uuid', nullable: true }) linkedBirthId: string | null;
  @Column({ name: 'baseline_hb_g_dl', type: 'numeric', precision: 4, scale: 1, nullable: true }) baselineHbGDl: number | null;
  @Column({ name: 'blood_group', length: 5, nullable: true }) bloodGroup: string | null;
  @Column({ name: 'has_stroke_history', type: 'boolean', default: false }) hasStrokeHistory: boolean;
  @Column({ name: 'has_acs_history', type: 'boolean', default: false }) hasAcsHistory: boolean;
  @Column({ name: 'has_priapism_history', type: 'boolean', default: false }) hasPriapismHistory: boolean;
  @Column({ name: 'has_renal_disease', type: 'boolean', default: false }) hasRenalDisease: boolean;
  @Column({ name: 'has_avascular_necrosis', type: 'boolean', default: false }) hasAvascularNecrosis: boolean;
  @Column({ name: 'on_hydroxyurea', type: 'boolean', default: false }) onHydroxyurea: boolean;
  @Column({ name: 'on_penicillin_prophylaxis', type: 'boolean', default: false }) onPenicillinProphylaxis: boolean;
  @Column({ name: 'on_folic_acid', type: 'boolean', default: false }) onFolicAcid: boolean;
  @Column({ name: 'on_malaria_prophylaxis', type: 'boolean', default: false }) onMalariaProphylaxis: boolean;
  @Column({ name: 'transcranial_doppler_velocity', type: 'numeric', precision: 5, scale: 1, nullable: true }) transcranialDopplerVelocity: number | null;
  @Column({ name: 'tcd_date', type: 'date', nullable: true }) tcdDate: string | null;
  @Column({ name: 'spleen_status', length: 20, nullable: true }) spleenStatus: string | null;
  @Column({ length: 20, default: 'active' }) status: string;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

### `scd-crisis-event.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scd_crisis_events')
export class ScdCrisisEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'scd_register_id', type: 'uuid', nullable: true }) scdRegisterId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'event_date', type: 'date' }) eventDate: string;
  @Column({ name: 'crisis_type', length: 30 }) crisisType: string;
  @Column({ length: 15 }) severity: string;
  @Column({ name: 'pain_score', type: 'int', nullable: true }) painScore: number | null;
  @Column({ name: 'trigger_identified', length: 100, nullable: true }) triggerIdentified: string | null;
  @Column({ name: 'sbp_at_event', type: 'int', nullable: true }) sbpAtEvent: number | null;
  @Column({ name: 'dbp_at_event', type: 'int', nullable: true }) dbpAtEvent: number | null;
  @Column({ name: 'spo2_at_event', type: 'int', nullable: true }) spo2AtEvent: number | null;
  @Column({ name: 'hb_at_event', type: 'numeric', precision: 4, scale: 1, nullable: true }) hbAtEvent: number | null;
  @Column({ name: 'wbc_at_event', type: 'numeric', precision: 6, scale: 2, nullable: true }) wbcAtEvent: number | null;
  @Column({ type: 'text', nullable: true }) management: string | null;
  @Column({ name: 'analgesia_given', length: 200, nullable: true }) analgesiaGiven: string | null;
  @Column({ name: 'transfusion_given', type: 'boolean', default: false }) transfusionGiven: boolean;
  @Column({ name: 'transfusion_units', type: 'int', nullable: true }) transfusionUnits: number | null;
  @Column({ name: 'hospitalised', type: 'boolean', default: false }) hospitalised: boolean;
  @Column({ name: 'hospital_days', type: 'int', nullable: true }) hospitalDays: number | null;
  @Column({ length: 30, nullable: true }) outcome: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

### `scd-treatment-record.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scd_treatment_records')
export class ScdTreatmentRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'scd_register_id', type: 'uuid', nullable: true }) scdRegisterId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'date' }) recordedAt: string;
  @Column({ name: 'treatment_type', length: 30 }) treatmentType: string;
  @Column({ name: 'drug_name', length: 100, nullable: true }) drugName: string | null;
  @Column({ name: 'dose_mg', type: 'numeric', precision: 8, scale: 2, nullable: true }) doseMg: number | null;
  @Column({ name: 'dose_mg_per_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) doseMgPerKg: number | null;
  @Column({ length: 50, nullable: true }) frequency: string | null;
  @Column({ type: 'text', nullable: true }) indication: string | null;
  @Column({ name: 'hb_g_dl', type: 'numeric', precision: 4, scale: 1, nullable: true }) hbGDl: number | null;
  @Column({ name: 'mcv_fl', type: 'numeric', precision: 5, scale: 1, nullable: true }) mcvFl: number | null;
  @Column({ name: 'wbc_x10_9', type: 'numeric', precision: 6, scale: 2, nullable: true }) wbcX10_9: number | null;
  @Column({ name: 'anc_x10_9', type: 'numeric', precision: 6, scale: 2, nullable: true }) ancX10_9: number | null;
  @Column({ name: 'platelets_x10_9', type: 'numeric', precision: 7, scale: 2, nullable: true }) plateletsX10_9: number | null;
  @Column({ name: 'reticulocytes_pct', type: 'numeric', precision: 4, scale: 1, nullable: true }) reticulocytesPct: number | null;
  @Column({ name: 'hbf_pct', type: 'numeric', precision: 4, scale: 1, nullable: true }) hbfPct: number | null;
  @Column({ length: 30, nullable: true }) action: string | null;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

### `scd-complication-screening.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('scd_complication_screenings')
export class ScdComplicationScreening {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'scd_register_id', type: 'uuid', nullable: true }) scdRegisterId: string | null;
  @Column({ name: 'screened_by', type: 'uuid' }) screenedBy: string;
  @Column({ name: 'screened_at', type: 'date' }) screenedAt: string;
  @Column({ name: 'screening_type', length: 30 }) screeningType: string;
  @Column({ name: 'result_normal', type: 'boolean', nullable: true }) resultNormal: boolean | null;
  @Column({ name: 'result_detail', type: 'text', nullable: true }) resultDetail: string | null;
  @Column({ name: 'tcd_velocity_cm_s', type: 'numeric', precision: 5, scale: 1, nullable: true }) tcdVelocityCmS: number | null;
  @Column({ name: 'tcd_classification', length: 20, nullable: true }) tcdClassification: string | null;
  @Column({ name: 'egfr_ml_min', type: 'numeric', precision: 6, scale: 1, nullable: true }) egfrMlMin: number | null;
  @Column({ name: 'urine_albumin_creatinine', type: 'numeric', precision: 7, scale: 2, nullable: true }) urineAlbuminCreatinine: number | null;
  @Column({ type: 'boolean', default: false }) referred: boolean;
  @Column({ name: 'referral_reason', type: 'text', nullable: true }) referralReason: string | null;
  @Column({ name: 'next_screening_date', type: 'date', nullable: true }) nextScreeningDate: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

Register all four entities in `services/ehr-service/src/services/tenant.service.ts` — add imports and append to DataSource `entities[]` after `TmToxicityEvent`.

Register in `services/ehr-service/src/ehr.module.ts` — import `ScdController` and `ScdService`, add both to `controllers[]` and `providers[]`.

---

## 5. CDSS Data File

Create `services/cdss-service/data/scd_protocol.json`:

```json
{
  "version": "2026.04.11",
  "source": "ASH 2020 SCD Guidelines + WHO SCD management resource (representative protocol)",
  "genotypes": {
    "HbSS": { "severity": "severe", "common_name": "Sickle Cell Anaemia" },
    "HbSC": { "severity": "moderate", "common_name": "Haemoglobin SC Disease" },
    "HbS_beta_thal": { "severity": "moderate_to_severe", "common_name": "Sickle Beta-Thalassaemia" },
    "HbAS": { "severity": "carrier", "common_name": "Sickle Cell Trait" },
    "HbAC": { "severity": "carrier", "common_name": "Haemoglobin C Trait" }
  },
  "hydroxyurea": {
    "indication_genotypes": ["HbSS", "HbS_beta_thal"],
    "indication_criteria": [
      "≥3 VOC per year requiring medical attention",
      "History of ACS",
      "Severe symptomatic anaemia (Hb <6 g/dL)",
      "All children ≥9 months (ASH 2020 universal HU recommendation for HbSS)"
    ],
    "starting_dose_mg_per_kg": 15,
    "max_dose_mg_per_kg": 35,
    "dose_escalation_interval_weeks": 8,
    "dose_increment_mg_per_kg": 5,
    "hold_thresholds": {
      "anc_x10_9_below": 2.0,
      "platelets_x10_9_below": 80,
      "reticulocytes_x10_9_below": 80,
      "hb_g_dl_below": 5.0
    },
    "response_targets": {
      "hbf_pct_above": 20,
      "mcv_fl_above": 100,
      "hb_g_dl_above": 8.5
    },
    "monitoring_schedule": {
      "on_titration_weeks": 8,
      "on_stable_dose_months": 3
    },
    "monitoring_labs": ["CBC_with_diff", "reticulocytes", "HbF_if_available", "LFTs", "creatinine"]
  },
  "prophylaxis": {
    "penicillin": {
      "indication": "All HbSS/HbS-beta-thal from 2 months of age",
      "under_5_dose": "Penicillin V 125 mg BD",
      "age_5_to_adult_dose": "Penicillin V 250 mg BD",
      "stop_age_years": null,
      "note": "Continue indefinitely if spleen has auto-infarcted or splenectomy performed"
    },
    "folic_acid": {
      "dose_adults": "5 mg daily",
      "dose_children": "2.5 mg daily (under 12)"
    },
    "malaria_prophylaxis": {
      "indication": "All SCD patients in endemic regions",
      "preferred": "Proguanil 100 mg daily (children: weight-based)",
      "alternative": "Chloroquine 5 mg/kg weekly (where sensitive)"
    }
  },
  "tcd_classification": {
    "normal_cm_s_below": 170,
    "conditional_cm_s": [170, 200],
    "abnormal_cm_s_above": 200,
    "abnormal_action": "Refer urgently for chronic transfusion programme or HU intensification — stroke risk >10% per year",
    "conditional_action": "Repeat TCD in 3 months; ensure HU optimised",
    "screening_frequency_years": 1
  },
  "crisis_management": {
    "voc_mild": {
      "definition": "Pain score 1–4, manageable at home",
      "management": "Oral NSAIDs (ibuprofen/diclofenac), oral paracetamol, high oral fluids ≥2L/day, warm compress, rest",
      "escalate_if": "No relief in 2h, pain worsening, fever, vomiting"
    },
    "voc_moderate": {
      "definition": "Pain score 5–7, requires clinic attendance",
      "management": "IV access, IV fluids 1.5× maintenance, oral or IV morphine 0.05–0.1 mg/kg, anti-emetic, O2 if SpO2 <94%",
      "escalate_if": "Pain uncontrolled at 1h, signs of ACS (cough, pleuritic chest pain, fever + new CXR infiltrate)"
    },
    "voc_severe": {
      "definition": "Pain score 8–10 or life-threatening complication",
      "management": "Hospital admission, IV morphine PCA or regular dosing, IV fluids, blood group & crossmatch, incentive spirometry, haematology consult"
    },
    "acs_triggers": ["new_cough", "pleuritic_chest_pain", "fever", "new_infiltrate_on_cxr", "falling_spo2"],
    "acs_management": "Admit urgently, O2 to maintain SpO2 ≥95%, IV fluids (not aggressive), empiric antibiotics (cover Mycoplasma/Chlamydia), exchange transfusion if deteriorating, incentive spirometry",
    "splenic_sequestration_action": "Urgent transfusion to raise Hb by 2 g/dL (not fully correct — risk of hyper-viscosity). Splenectomy referral for recurrent episodes.",
    "stroke_action": "Immediate exchange transfusion targeting HbS <30%. CT/MRI brain. Chronic transfusion programme post-stroke."
  },
  "annual_complication_schedule": [
    { "screening": "tcd", "frequency": "annually_age_2_to_16", "urgency": "mandatory" },
    { "screening": "eye", "frequency": "annually", "urgency": "recommended" },
    { "screening": "renal", "frequency": "annually", "urgency": "mandatory" },
    { "screening": "cardiac_echo", "frequency": "every_3_years", "urgency": "recommended" },
    { "screening": "growth", "frequency": "every_6_months_under_18", "urgency": "recommended" },
    { "screening": "neurocognitive", "frequency": "annually_under_18", "urgency": "recommended" }
  ],
  "vaccination_requirements": [
    "Pneumococcal conjugate + polysaccharide (PCV13 then PPSV23 at ≥2 years)",
    "Annual influenza",
    "Meningococcal MenACWY",
    "Haemophilus influenzae type b (Hib)",
    "Hepatitis B (due to transfusion risk)"
  ]
}
```

---

## 6. CDSS Endpoints

Add to `services/cdss-service/main.py` — insert as a new section **before** the Sprint 143 HTN block. After editing, validate with:

```bash
python3 -c "import ast; ast.parse(open('services/cdss-service/main.py').read()); print('OK')"
```

### 6a. Request models

```python
class ScdHydroxyureaRequest(BaseModel):
    patient_weight_kg: float
    age_years: float
    genotype: str                          # HbSS | HbSC | HbS_beta_thal
    current_dose_mg: Optional[float] = None
    indication: str = "standard"           # standard | crisis_prevention | acs_prevention
    # Lab values at current visit
    hb_g_dl: Optional[float] = None
    mcv_fl: Optional[float] = None
    wbc_x10_9: Optional[float] = None
    anc_x10_9: Optional[float] = None
    platelets_x10_9: Optional[float] = None
    reticulocytes_x10_9: Optional[float] = None
    hbf_pct: Optional[float] = None
    weeks_on_current_dose: Optional[int] = None

class ScdCrisisTriageRequest(BaseModel):
    crisis_type: str                       # voc | acs | splenic_sequestration | priapism | stroke
    pain_score: Optional[int] = None       # 0–10
    spo2_pct: Optional[int] = None
    fever: bool = False
    new_chest_symptoms: bool = False       # cough, pleuritic pain
    hb_g_dl: Optional[float] = None
    new_neuro_symptoms: bool = False       # stroke flag
    age_years: Optional[float] = None

class ScdComplicationRiskRequest(BaseModel):
    genotype: str
    age_years: float
    tcd_velocity_cm_s: Optional[float] = None
    has_stroke_history: bool = False
    hb_g_dl: Optional[float] = None
    on_hydroxyurea: bool = False
    hbf_pct: Optional[float] = None
    prior_acs_episodes: int = 0
    has_renal_disease: bool = False
    systolic_bp: Optional[float] = None
```

### 6b. POST `/cdss/scd/hydroxyurea-dose`

```python
@app.post("/cdss/scd/hydroxyurea-dose")
async def scd_hydroxyurea_dose(req: ScdHydroxyureaRequest):
    """
    Weight-based HU dose calculation with lab-gated hold/escalation logic.
    """
    data = _load_supporting_json("scd_protocol.json")
    hu_data = data["hydroxyurea"]
    hold = hu_data["hold_thresholds"]
    targets = hu_data["response_targets"]

    warnings = []
    hold_flags = []

    # Check hold thresholds
    if req.anc_x10_9 is not None and req.anc_x10_9 < hold["anc_x10_9_below"]:
        hold_flags.append(f"ANC {req.anc_x10_9} ×10⁹/L < {hold['anc_x10_9_below']} — HOLD hydroxyurea")
    if req.platelets_x10_9 is not None and req.platelets_x10_9 < hold["platelets_x10_9_below"]:
        hold_flags.append(f"Platelets {req.platelets_x10_9} ×10⁹/L < {hold['platelets_x10_9_below']} — HOLD hydroxyurea")
    if req.hb_g_dl is not None and req.hb_g_dl < hold["hb_g_dl_below"]:
        hold_flags.append(f"Hb {req.hb_g_dl} g/dL < {hold['hb_g_dl_below']} — HOLD hydroxyurea")

    if hold_flags:
        return {
            "action": "hold",
            "reason": hold_flags,
            "resume_when": "Recheck CBC in 2–4 weeks. Resume when counts recover above thresholds.",
            "recommended_dose_mg": None,
            "next_review_weeks": 2,
        }

    # Starting dose
    start_dose_mg = round(req.patient_weight_kg * hu_data["starting_dose_mg_per_kg"] / 100) * 100
    max_dose_mg = round(req.patient_weight_kg * hu_data["max_dose_mg_per_kg"] / 100) * 100

    if req.current_dose_mg is None:
        return {
            "action": "start",
            "recommended_dose_mg": start_dose_mg,
            "dose_mg_per_kg": round(start_dose_mg / req.patient_weight_kg, 1),
            "max_dose_mg": max_dose_mg,
            "monitoring_interval_weeks": hu_data["monitoring_schedule"]["on_titration_weeks"],
            "monitoring_labs": hu_data["monitoring_labs"],
            "warnings": warnings,
        }

    # Escalation: if on current dose ≥8 weeks and not at max and not at target
    at_target = (
        (req.hbf_pct or 0) >= targets["hbf_pct_above"] or
        (req.mcv_fl or 0) >= targets["mcv_fl_above"] or
        (req.hb_g_dl or 0) >= targets["hb_g_dl_above"]
    )
    can_escalate = (
        (req.weeks_on_current_dose or 0) >= hu_data["monitoring_schedule"]["on_titration_weeks"] and
        req.current_dose_mg < max_dose_mg and
        not at_target
    )

    if can_escalate:
        increment = req.patient_weight_kg * 5  # 5 mg/kg increment
        new_dose_mg = min(round((req.current_dose_mg + increment) / 100) * 100, max_dose_mg)
        return {
            "action": "escalate",
            "recommended_dose_mg": new_dose_mg,
            "previous_dose_mg": req.current_dose_mg,
            "dose_mg_per_kg": round(new_dose_mg / req.patient_weight_kg, 1),
            "monitoring_interval_weeks": hu_data["monitoring_schedule"]["on_titration_weeks"],
            "monitoring_labs": hu_data["monitoring_labs"],
            "warnings": warnings,
        }

    return {
        "action": "continue",
        "recommended_dose_mg": req.current_dose_mg,
        "dose_mg_per_kg": round(req.current_dose_mg / req.patient_weight_kg, 1),
        "at_target": at_target,
        "monitoring_interval_weeks": hu_data["monitoring_schedule"]["on_stable_dose_months"] * 4,
        "monitoring_labs": hu_data["monitoring_labs"],
        "warnings": warnings,
    }
```

### 6c. POST `/cdss/scd/crisis-triage`

```python
@app.post("/cdss/scd/crisis-triage")
async def scd_crisis_triage(req: ScdCrisisTriageRequest):
    """
    Crisis severity classification and emergency escalation guidance.
    """
    data = _load_supporting_json("scd_protocol.json")
    cm = data["crisis_management"]

    if req.crisis_type == "stroke" or req.new_neuro_symptoms:
        return {
            "severity": "life_threatening",
            "crisis_type": "stroke",
            "immediate_action": "EMERGENCY: Activate stroke protocol. Urgent exchange transfusion targeting HbS <30%. Obtain CT/MRI brain stat. Do NOT delay for imaging if exchange is available.",
            "management": cm["stroke_action"],
            "escalate_now": True,
        }

    if req.crisis_type == "acs" or req.new_chest_symptoms:
        return {
            "severity": "severe",
            "crisis_type": "acs",
            "immediate_action": "Admit urgently. O2 to SpO2 ≥95%. Empiric antibiotics covering atypical organisms. Incentive spirometry. Blood group & crossmatch for exchange transfusion if SpO2 falling.",
            "management": cm["acs_management"],
            "escalate_now": True,
        }

    if req.crisis_type == "splenic_sequestration":
        return {
            "severity": "severe",
            "crisis_type": "splenic_sequestration",
            "immediate_action": "Urgent transfusion — raise Hb by 2 g/dL only (avoid hyperviscosity). IV access. Blood group & crossmatch.",
            "management": cm["splenic_sequestration_action"],
            "escalate_now": True,
        }

    # VOC classification
    pain = req.pain_score or 0
    if req.fever or (req.spo2_pct and req.spo2_pct < 94) or pain >= 8:
        level = cm["voc_severe"]
        severity = "severe"
    elif pain >= 5:
        level = cm["voc_moderate"]
        severity = "moderate"
    else:
        level = cm["voc_mild"]
        severity = "mild"

    return {
        "severity": severity,
        "crisis_type": "voc",
        "management": level["management"],
        "escalate_if": level.get("escalate_if"),
        "escalate_now": severity in ("severe",),
        "analgesia_ladder": {
            "mild": "Oral NSAIDs + paracetamol",
            "moderate": "Oral/IV morphine 0.05–0.1 mg/kg + anti-emetic",
            "severe": "IV morphine PCA or regular dosing + haematology consult",
        }[severity],
    }
```

### 6d. POST `/cdss/scd/complication-risk`

```python
@app.post("/cdss/scd/complication-risk")
async def scd_complication_risk(req: ScdComplicationRiskRequest):
    """
    Multi-domain complication risk flags: stroke, ACS, renal, cardiac.
    """
    data = _load_supporting_json("scd_protocol.json")
    tcd_cls = data["tcd_classification"]
    schedule = data["annual_complication_schedule"]
    risks = []

    # Stroke risk (TCD)
    if req.tcd_velocity_cm_s is not None:
        if req.tcd_velocity_cm_s >= tcd_cls["abnormal_cm_s_above"]:
            risks.append({"domain": "stroke", "risk_level": "high",
                          "finding": f"TCD {req.tcd_velocity_cm_s} cm/s — ABNORMAL",
                          "action": tcd_cls["abnormal_action"]})
        elif req.tcd_velocity_cm_s >= tcd_cls["conditional_cm_s"][0]:
            risks.append({"domain": "stroke", "risk_level": "moderate",
                          "finding": f"TCD {req.tcd_velocity_cm_s} cm/s — CONDITIONAL",
                          "action": tcd_cls["conditional_action"]})
    if req.has_stroke_history:
        risks.append({"domain": "stroke", "risk_level": "very_high",
                      "finding": "Prior stroke — on chronic transfusion programme?",
                      "action": "Confirm enrolment in chronic transfusion programme targeting HbS <30%."})

    # ACS / pulmonary
    if req.prior_acs_episodes >= 2:
        risks.append({"domain": "pulmonary", "risk_level": "high",
                      "finding": f"≥2 prior ACS episodes ({req.prior_acs_episodes})",
                      "action": "Escalate HU to maximum tolerated dose. Consider chronic transfusion."})

    # Anaemia
    if req.hb_g_dl is not None and req.hb_g_dl < 7.0:
        risks.append({"domain": "anaemia", "risk_level": "moderate",
                      "finding": f"Hb {req.hb_g_dl} g/dL — below 7 g/dL",
                      "action": "Review HU response (HbF%). Blood group & hold. Consider transfusion if symptomatic."})

    # Renal
    if req.has_renal_disease:
        risks.append({"domain": "renal", "risk_level": "moderate",
                      "finding": "Known renal disease",
                      "action": "Annual eGFR + urine ACR. ACE inhibitor/ARB for microalbuminuria. Avoid NSAIDs."})

    overall = "high" if any(r["risk_level"] in ("high", "very_high") for r in risks) else \
              "moderate" if risks else "low"

    overdue_screens = [s["screening"] for s in schedule if s.get("urgency") == "mandatory"]

    return {
        "genotype": req.genotype,
        "overall_risk": overall,
        "risk_flags": risks,
        "vaccinations_required": data["vaccination_requirements"],
        "overdue_screening_check": overdue_screens,
        "hu_indicator": not req.on_hydroxyurea and req.genotype in ("HbSS", "HbS_beta_thal"),
    }
```

---

## 7. EHR Service Layer

### 7a. `services/ehr-service/src/services/scd.service.ts`

Inject `ScdRegister`, `ScdCrisisEvent`, `ScdTreatmentRecord`, `ScdComplicationScreening` repositories and `CdssService`.

Methods:
- `enroll(patientId, enrolledBy, dto)` → saves `ScdRegister`; auto-flags `on_malaria_prophylaxis` field based on facility region if available
- `getRegister(patientId)` → latest register entry for patient
- `updateRegister(id, dto)` → patch status, treatment flags, next review, TCD result
- `recordCrisis(patientId, recordedBy, dto)` → saves `ScdCrisisEvent`; calls `cdssService.scdCrisisTriage()` and returns triage guidance inline
- `getCrisisHistory(patientId)` → all crisis events DESC
- `recordTreatment(patientId, recordedBy, dto)` → saves `ScdTreatmentRecord`; if `treatment_type === 'hydroxyurea'` calls `cdssService.scdHydroxyureaDose()` with labs
- `getTreatmentHistory(patientId)` → all treatment records DESC
- `recordScreening(patientId, screenedBy, dto)` → saves `ScdComplicationScreening`
- `getScreeningHistory(patientId)` → all screenings DESC
- `getComplicationRisk(patientId, payload)` → calls `cdssService.scdComplicationRisk()`

### 7b. `services/ehr-service/src/controllers/scd.controller.ts`

All routes under `/scd/`:

```
POST   /scd/patient/:patientId/register           → enroll
GET    /scd/patient/:patientId/register           → getRegister
PATCH  /scd/register/:id                          → updateRegister
POST   /scd/patient/:patientId/crisis             → recordCrisis
GET    /scd/patient/:patientId/crisis             → getCrisisHistory
POST   /scd/patient/:patientId/treatment          → recordTreatment
GET    /scd/patient/:patientId/treatment          → getTreatmentHistory
POST   /scd/patient/:patientId/screening          → recordScreening
GET    /scd/patient/:patientId/screening          → getScreeningHistory
POST   /scd/patient/:patientId/risk               → getComplicationRisk
POST   /scd/cdss/hydroxyurea-dose                 → proxy to CDSS
POST   /scd/cdss/crisis-triage                    → proxy to CDSS
POST   /scd/cdss/complication-risk                → proxy to CDSS
```

### 7c. `services/ehr-service/src/services/cdss.service.ts`

Add after `tmToxicityRisk()`:

```typescript
async scdHydroxyureaDose(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>('POST', 'scdHydroxyureaDose', '/cdss/scd/hydroxyurea-dose', payload, this.defaultTimeoutMs, tenantId);
}
async scdCrisisTriage(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>('POST', 'scdCrisisTriage', '/cdss/scd/crisis-triage', payload, this.defaultTimeoutMs, tenantId);
}
async scdComplicationRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>('POST', 'scdComplicationRisk', '/cdss/scd/complication-risk', payload, this.defaultTimeoutMs, tenantId);
}
```

---

## 8. Frontend

### 8a. `ehr-frontend/src/services/api.ts`

Add `scdApi` export:

```typescript
export const scdApi = {
  enroll: (patientId: string, data: any) =>
    ehrApi.post(`/scd/patient/${patientId}/register`, data).then(r => r.data),
  getRegister: (patientId: string) =>
    ehrApi.get(`/scd/patient/${patientId}/register`).then(r => r.data),
  updateRegister: (id: string, data: any) =>
    ehrApi.patch(`/scd/register/${id}`, data).then(r => r.data),
  recordCrisis: (patientId: string, data: any) =>
    ehrApi.post(`/scd/patient/${patientId}/crisis`, data).then(r => r.data),
  getCrisisHistory: (patientId: string) =>
    ehrApi.get(`/scd/patient/${patientId}/crisis`).then(r => r.data),
  recordTreatment: (patientId: string, data: any) =>
    ehrApi.post(`/scd/patient/${patientId}/treatment`, data).then(r => r.data),
  getTreatmentHistory: (patientId: string) =>
    ehrApi.get(`/scd/patient/${patientId}/treatment`).then(r => r.data),
  recordScreening: (patientId: string, data: any) =>
    ehrApi.post(`/scd/patient/${patientId}/screening`, data).then(r => r.data),
  getScreeningHistory: (patientId: string) =>
    ehrApi.get(`/scd/patient/${patientId}/screening`).then(r => r.data),
  getComplicationRisk: (patientId: string, data: any) =>
    ehrApi.post(`/scd/patient/${patientId}/risk`, data).then(r => r.data),
  hydroxyureaDose: (data: any) =>
    ehrApi.post('/scd/cdss/hydroxyurea-dose', data).then(r => r.data),
  crisisTriage: (data: any) =>
    ehrApi.post('/scd/cdss/crisis-triage', data).then(r => r.data),
  complicationRisk: (data: any) =>
    ehrApi.post('/scd/cdss/complication-risk', data).then(r => r.data),
};
```

### 8b. `ehr-frontend/src/components/ScdDashboard.tsx`

New component — 4 tabs:

**Tab 1 — `register`** "SCD Register"
- Enrolment form: genotype selector (HbSS/HbSC/HbS-β-thal/HbAS/HbAC/other), diagnosis method, confirmed toggle, blood group, baseline Hb, linked birth ID
- Treatment flags panel: on HU / penicillin prophylaxis / folic acid / malaria prophylaxis — toggle switches
- Comorbidity history checkboxes: prior stroke, ACS, priapism, renal disease, AVN
- Latest TCD velocity entry + date
- Spleen status selector
- Complication risk panel: on load (if register exists), calls `scdApi.getComplicationRisk()` → displays risk flags with colour-coded severity chips (red = high/very_high, amber = moderate, green = low)
- Vaccination checklist from protocol data

**Tab 2 — `crisis`** "Crisis Events"
- Crisis recording form: crisis type (VOC/ACS/splenic sequestration/stroke/TIA/priapism/aplastic crisis), pain score slider (0–10), vitals (SpO2, BP, Hb, WBC), fever toggle, new chest symptoms toggle, new neuro symptoms toggle
- On submit: calls `scdApi.recordCrisis()` which auto-calls CDSS → displays **immediate triage card** colour-coded:
  - Red border = life-threatening → "EMERGENCY" + escalate_now banner
  - Orange border = severe → management protocol displayed
  - Yellow border = moderate
  - Green border = mild
- Analgesia ladder shown per severity
- Timeline of past crisis events (table: date, type, severity, hospitalised Y/N, outcome)

**Tab 3 — `treatment`** "Hydroxyurea & Medications"
- Treatment form: treatment type selector, drug name, dose (mg and mg/kg auto-calc from weight), frequency, indication
- HU-specific panel (shown when `treatment_type === 'hydroxyurea'`): lab entry fields (Hb, MCV, WBC, ANC, platelets, retics, HbF%), weeks on current dose
- On submit when HU selected: auto-calls `scdApi.hydroxyureaDose()` → displays action card:
  - Red = HOLD (with hold reason)
  - Blue = START (starting dose)
  - Green = CONTINUE (at target)
  - Amber = ESCALATE (new dose recommendation)
- Treatment history table: date, type, dose, action, next review

**Tab 4 — `screening`** "Complication Screening"
- Screening form: type (TCD/eye/renal/cardiac/bone/growth/neurocognitive), result normal toggle, result detail textarea
- TCD sub-form (shown when `type === 'tcd'`): velocity (cm/s) → displays auto-classification badge (Normal/Conditional/Abnormal) on input
- Renal sub-form: eGFR + urine ACR
- Referral flag + reason
- Annual screening schedule tracker: shows each mandatory screening type with last-done date and next-due date
- History table of all screenings

### 8c. `ehr-frontend/src/pages/NurseDashboard.tsx`

1. Import: `import ScdDashboard from '../components/ScdDashboard'`
2. Extend `activeTab` union: add `| 'scd'`
3. Add to the `ncd` sidebar section children:
   ```typescript
   { label: 'Sickle Cell Disease', tab: 'scd', icon: Droplets }
   ```
   (import `Droplets` from `lucide-react`)
4. Add render block inside `activeSection === 'ncd'`:
   ```tsx
   {activeTab === 'scd' && selectedPatient && (
     <ScdDashboard patientId={selectedPatient.id} patientWeightKg={selectedPatient.weightKg} />
   )}
   {activeTab === 'scd' && !selectedPatient && (
     <div className="text-slate-500 text-sm">Select a patient to view their SCD record.</div>
   )}
   ```

---

## 9. Key Constraints

| Constraint | Detail |
|---|---|
| No FK constraints | All cross-entity UUID references are plain `@Column`, no `@ManyToOne` or `@JoinColumn` |
| No hardcoded env | All service URLs and secrets via `process.env.*` / `os.getenv()` |
| No setTimeout mocks | All data from real API calls |
| Idempotent DDL | `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` throughout |
| Don't touch S143/S143b | HTN register, TM/HDI controller, CDSS HTN/TM endpoints — leave untouched |
| Python validation | `python3 -c "import ast; ast.parse(open('services/cdss-service/main.py').read()); print('OK')"` |
| TypeScript validation | `cd services/ehr-service && npx tsc --noEmit` + `cd ehr-frontend && npx tsc --noEmit` |
| DB gate | Run `docker-compose build tenant-service && docker-compose up -d tenant-service` then `docker exec medicore-tenant-service npm run repair:tenants` — confirm `sprint144_scd_haemoglobinopathy` → `bundle.apply.success` |

---

## 10. Acceptance Criteria

- [ ] `scd_register`, `scd_crisis_events`, `scd_treatment_records`, `scd_complication_screenings` tables in all tenant DBs
- [ ] `POST /scd/patient/:id/register` enrolls patient and returns register entry
- [ ] `POST /scd/patient/:id/crisis` saves event + returns inline CDSS triage (severity + management)
- [ ] `POST /scd/patient/:id/treatment` with `treatment_type=hydroxyurea` + labs returns HU dose action
- [ ] `POST /cdss/scd/hydroxyurea-dose` with ANC < 2.0 returns `action: "hold"`
- [ ] `POST /cdss/scd/crisis-triage` with `new_neuro_symptoms: true` returns `life_threatening` + stroke escalation
- [ ] `POST /cdss/scd/complication-risk` with TCD > 200 cm/s returns `high` stroke risk flag
- [ ] `ScdDashboard` renders in NurseDashboard under NCD > Sickle Cell Disease
- [ ] Recording a crisis event surfaces the triage card inline with colour-coded severity
- [ ] HU HOLD card renders in red with hold reasons when ANC is below threshold
- [ ] TypeScript: zero compile errors
- [ ] Python: `ast.parse` returns OK
- [ ] Jest spec file for `scd.service.ts` passes
