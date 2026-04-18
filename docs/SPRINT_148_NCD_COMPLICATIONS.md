# Sprint 148 — NCD Complication Registry

**Sprint**: S148  
**Module**: Diabetic Foot & Wound Care, Diabetic Retinopathy Screening, CKD Staging, NCD Complication Tracking  
**Bundle version**: `2026.04.16.1`  
**Bundle ID**: `sprint148_ncd_complications`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

MediCore completed a full NCD suite in S142–S145 (HTN, cervical, sickle cell, epilepsy). What is entirely missing is **NCD complication tracking** — the downstream organ damage from poorly controlled diabetes and hypertension that drives the majority of chronic disease mortality in SADC.

| Complication | SADC Burden | Missing in MediCore |
|---|---|---|
| Diabetic foot ulcer | 15–25% of PLWDM develop foot ulcers; #1 cause of non-traumatic amputation | No Wagner grading, no wound tracking |
| Diabetic retinopathy | 1 in 3 with DM for >10 years; leading cause of preventable blindness | No screening record, no fundus grading |
| CKD from diabetes/HTN | 40% of ESRD in SADC from diabetic nephropathy | No CKD staging, no eGFR tracking |
| Hypertensive end-organ damage | Retinopathy, LVH, nephropathy — all undocumented | No systematic complication register |

### What already exists (do NOT recreate)

- Diabetes and Hypertension modules with patient registers (added in S142)
- `NurseService`, `DoctorService` — injectable
- `NurseDashboard.tsx`, `DoctorDashboard.tsx` — add tabs here
- Lab service with eGFR computation capability (check if eGFR calculated — if not, add it)
- Imaging service with study records

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-ncd-complications.statements.ts`**

```typescript
export const TENANT_NCD_COMPLICATIONS_BUNDLE_VERSION = '2026.04.16.1';

export const TENANT_NCD_COMPLICATIONS_STATEMENTS: string[] = [

  // ── Diabetic Foot Assessments ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS diabetic_foot_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    assessed_by UUID NOT NULL,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Inspection
    right_foot_sensation TEXT,          -- 'intact' | 'reduced' | 'absent'
    left_foot_sensation TEXT,
    right_foot_pulses TEXT,             -- 'present' | 'diminished' | 'absent'
    left_foot_pulses TEXT,
    right_foot_deformity BOOLEAN NOT NULL DEFAULT false,
    left_foot_deformity BOOLEAN NOT NULL DEFAULT false,
    deformity_description TEXT,
    callus_present BOOLEAN NOT NULL DEFAULT false,
    -- Wagner Classification (0–5)
    -- 0: No ulcer, high risk foot
    -- 1: Superficial ulcer, no infection
    -- 2: Deep ulcer, no abscess/osteomyelitis
    -- 3: Deep ulcer + abscess or osteomyelitis
    -- 4: Gangrene forefoot
    -- 5: Gangrene whole foot
    right_wagner_grade INT,             -- 0-5, NULL if no lesion
    left_wagner_grade INT,
    ulcer_present BOOLEAN NOT NULL DEFAULT false,
    ulcer_location TEXT,                -- e.g. 'plantar, 1st metatarsal head, right'
    ulcer_size_cm2 DECIMAL(6,2),        -- length × width in cm²
    ulcer_depth TEXT,                   -- 'superficial' | 'deep_no_tendon' | 'tendon_capsule' | 'bone'
    wound_bed TEXT,                     -- 'granulating' | 'sloughy' | 'necrotic' | 'epithelialising'
    infection_signs JSONB DEFAULT '[]', -- ['erythema','warmth','purulence','odour']
    -- ABI (Ankle-Brachial Index) — optional
    right_abi DECIMAL(4,2),
    left_abi DECIMAL(4,2),
    -- Referral
    referred_to_podiatry BOOLEAN NOT NULL DEFAULT false,
    referred_to_surgery BOOLEAN NOT NULL DEFAULT false,
    -- Plan
    dressing_type TEXT,
    offloading_device TEXT,             -- 'none' | 'felted_foam' | 'total_contact_cast' | 'wheelchair'
    antibiotic_prescribed TEXT,
    review_in_days INT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dfa_patient ON diabetic_foot_assessments(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dfa_date ON diabetic_foot_assessments(assessment_date)`,
  `CREATE INDEX IF NOT EXISTS idx_dfa_ulcer ON diabetic_foot_assessments(ulcer_present)`,

  // ── Retinopathy Screening ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS retinopathy_screenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    screened_by UUID NOT NULL,
    screening_date DATE NOT NULL DEFAULT CURRENT_DATE,
    method TEXT NOT NULL DEFAULT 'ophthalmoscopy',  -- 'ophthalmoscopy' | 'fundus_photo' | 'slit_lamp'
    right_eye_grade TEXT,   -- ETDRS: 'none' | 'mild_npdr' | 'moderate_npdr' | 'severe_npdr' | 'pdr' | 'ungradable'
    left_eye_grade TEXT,
    right_eye_dme BOOLEAN,  -- Diabetic Macular Oedema
    left_eye_dme BOOLEAN,
    right_eye_notes TEXT,
    left_eye_notes TEXT,
    overall_grade TEXT,     -- worst eye grade
    -- Hypertensive retinopathy (Keith-Wagener-Barker grade)
    hypertensive_retinopathy_grade INT,  -- 0-4; NULL if not assessed
    -- Referral
    referred_to_ophthalmology BOOLEAN NOT NULL DEFAULT false,
    urgency TEXT,           -- 'routine' | 'urgent_within_1_week' | 'emergency_same_day'
    next_screening_months INT NOT NULL DEFAULT 12,  -- months until next screen
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ret_patient ON retinopathy_screenings(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ret_date ON retinopathy_screenings(screening_date)`,
  `CREATE INDEX IF NOT EXISTS idx_ret_grade ON retinopathy_screenings(overall_grade)`,

  // ── CKD Staging & Nephropathy Tracking ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ckd_staging_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    recorded_by UUID NOT NULL,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    creatinine_umol_l DECIMAL(8,2),     -- serum creatinine
    egfr_ml_min_1_73m2 DECIMAL(6,2),   -- eGFR (CKD-EPI or MDRD equation)
    egfr_equation TEXT DEFAULT 'CKD-EPI',
    -- CKD Stage (KDIGO 2012)
    -- G1: eGFR ≥90  (normal/high)
    -- G2: eGFR 60–89 (mildly decreased)
    -- G3a: eGFR 45–59 (mild-moderate)
    -- G3b: eGFR 30–44 (moderate-severe)
    -- G4: eGFR 15–29 (severely decreased)
    -- G5: eGFR <15   (kidney failure)
    ckd_stage TEXT,
    -- Albuminuria (KDIGO A1-A3)
    uacr_mg_g DECIMAL(8,2),             -- urine albumin-creatinine ratio
    urine_dipstick_protein TEXT,        -- 'negative' | 'trace' | '1+' | '2+' | '3+'
    albuminuria_category TEXT,          -- 'A1' | 'A2' | 'A3'
    -- Cause
    primary_cause TEXT,                 -- 'diabetic_nephropathy' | 'hypertensive_nephropathy' | 'other' | 'unknown'
    -- Clinical
    haemoglobin_g_dl DECIMAL(4,1),     -- anaemia of CKD
    potassium_mmol_l DECIMAL(4,2),
    bicarbonate_mmol_l DECIMAL(4,2),
    phosphate_mmol_l DECIMAL(4,2),
    -- Blood pressure at this visit
    sbp_mmhg INT,
    dbp_mmhg INT,
    -- Referral
    referred_to_nephrology BOOLEAN NOT NULL DEFAULT false,
    -- Medications (changes prompted by CKD)
    ace_inhibitor_arb BOOLEAN,          -- on ACEI or ARB (renoprotective)
    metformin_stopped BOOLEAN,          -- stopped if eGFR <30
    nsaid_stopped BOOLEAN,
    dose_adjusted_drugs JSONB DEFAULT '[]',  -- [{ "drug": "Metformin", "action": "halve_dose", "reason": "eGFR 35" }]
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ckd_patient ON ckd_staging_records(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ckd_date ON ckd_staging_records(record_date)`,
  `CREATE INDEX IF NOT EXISTS idx_ckd_stage ON ckd_staging_records(ckd_stage)`,

  // ── NCD Complication Summary (one row per patient, latest snapshot) ────────
  `CREATE TABLE IF NOT EXISTS ncd_complication_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL UNIQUE,
    -- Foot
    worst_wagner_grade INT,
    active_foot_ulcer BOOLEAN NOT NULL DEFAULT false,
    amputation_history BOOLEAN NOT NULL DEFAULT false,
    -- Eye
    worst_retinopathy_grade TEXT,
    dme_present BOOLEAN NOT NULL DEFAULT false,
    visual_impairment BOOLEAN NOT NULL DEFAULT false,
    -- Kidney
    current_ckd_stage TEXT,
    current_egfr DECIMAL(6,2),
    on_dialysis BOOLEAN NOT NULL DEFAULT false,
    -- Cardiovascular
    mi_history BOOLEAN NOT NULL DEFAULT false,
    stroke_history BOOLEAN NOT NULL DEFAULT false,
    -- Overall
    complication_count INT NOT NULL DEFAULT 0,
    high_risk BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ncd_summary_patient ON ncd_complication_summaries(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ncd_summary_high_risk ON ncd_complication_summaries(high_risk)`,
];
```

### 2b. Register bundle in `database-provisioning.service.ts`

Add after `sprint147_maternal_mortality_emonc` block:

```typescript
{
  id: 'sprint148_ncd_complications',
  label: 'NCD Complication Registry — Diabetic Foot, Retinopathy, CKD Staging',
  version: TENANT_NCD_COMPLICATIONS_BUNDLE_VERSION,
  description: 'S148 — diabetic_foot_assessments, retinopathy_screenings, ckd_staging_records, ncd_complication_summaries',
  statements: TENANT_NCD_COMPLICATIONS_STATEMENTS,
},
```

Import:

```typescript
import {
  TENANT_NCD_COMPLICATIONS_STATEMENTS,
  TENANT_NCD_COMPLICATIONS_BUNDLE_VERSION,
} from '../generated/tenant-ncd-complications.statements';
```

---

## 3. TypeORM Entities

### 3a. `services/ehr-service/src/entities/diabetic-foot-assessment.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('diabetic_foot_assessments')
export class DiabeticFootAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'assessed_by', type: 'uuid' }) assessedBy: string;
  @Column({ name: 'assessment_date', type: 'date' }) assessmentDate: string;
  @Column({ name: 'right_foot_sensation', type: 'text', nullable: true }) rightFootSensation: string | null;
  @Column({ name: 'left_foot_sensation', type: 'text', nullable: true }) leftFootSensation: string | null;
  @Column({ name: 'right_foot_pulses', type: 'text', nullable: true }) rightFootPulses: string | null;
  @Column({ name: 'left_foot_pulses', type: 'text', nullable: true }) leftFootPulses: string | null;
  @Column({ name: 'right_foot_deformity', type: 'boolean', default: false }) rightFootDeformity: boolean;
  @Column({ name: 'left_foot_deformity', type: 'boolean', default: false }) leftFootDeformity: boolean;
  @Column({ name: 'deformity_description', type: 'text', nullable: true }) deformityDescription: string | null;
  @Column({ name: 'callus_present', type: 'boolean', default: false }) callusPresent: boolean;
  @Column({ name: 'right_wagner_grade', type: 'int', nullable: true }) rightWagnerGrade: number | null;
  @Column({ name: 'left_wagner_grade', type: 'int', nullable: true }) leftWagnerGrade: number | null;
  @Column({ name: 'ulcer_present', type: 'boolean', default: false }) ulcerPresent: boolean;
  @Column({ name: 'ulcer_location', type: 'text', nullable: true }) ulcerLocation: string | null;
  @Column({ name: 'ulcer_size_cm2', type: 'decimal', precision: 6, scale: 2, nullable: true }) ulcerSizeCm2: number | null;
  @Column({ name: 'ulcer_depth', type: 'text', nullable: true }) ulcerDepth: string | null;
  @Column({ name: 'wound_bed', type: 'text', nullable: true }) woundBed: string | null;
  @Column({ name: 'infection_signs', type: 'jsonb', default: [] }) infectionSigns: string[];
  @Column({ name: 'right_abi', type: 'decimal', precision: 4, scale: 2, nullable: true }) rightAbi: number | null;
  @Column({ name: 'left_abi', type: 'decimal', precision: 4, scale: 2, nullable: true }) leftAbi: number | null;
  @Column({ name: 'referred_to_podiatry', type: 'boolean', default: false }) referredToPodiatry: boolean;
  @Column({ name: 'referred_to_surgery', type: 'boolean', default: false }) referredToSurgery: boolean;
  @Column({ name: 'dressing_type', type: 'text', nullable: true }) dressingType: string | null;
  @Column({ name: 'offloading_device', type: 'text', nullable: true }) offloadingDevice: string | null;
  @Column({ name: 'antibiotic_prescribed', type: 'text', nullable: true }) antibioticPrescribed: string | null;
  @Column({ name: 'review_in_days', type: 'int', nullable: true }) reviewInDays: number | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 3b. `services/ehr-service/src/entities/retinopathy-screening.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('retinopathy_screenings')
export class RetinopathyScreening {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'screened_by', type: 'uuid' }) screenedBy: string;
  @Column({ name: 'screening_date', type: 'date' }) screeningDate: string;
  @Column({ type: 'text', default: 'ophthalmoscopy' }) method: string;
  @Column({ name: 'right_eye_grade', type: 'text', nullable: true }) rightEyeGrade: string | null;
  @Column({ name: 'left_eye_grade', type: 'text', nullable: true }) leftEyeGrade: string | null;
  @Column({ name: 'right_eye_dme', type: 'boolean', nullable: true }) rightEyeDme: boolean | null;
  @Column({ name: 'left_eye_dme', type: 'boolean', nullable: true }) leftEyeDme: boolean | null;
  @Column({ name: 'right_eye_notes', type: 'text', nullable: true }) rightEyeNotes: string | null;
  @Column({ name: 'left_eye_notes', type: 'text', nullable: true }) leftEyeNotes: string | null;
  @Column({ name: 'overall_grade', type: 'text', nullable: true }) overallGrade: string | null;
  @Column({ name: 'hypertensive_retinopathy_grade', type: 'int', nullable: true }) hypertensiveRetinopathyGrade: number | null;
  @Column({ name: 'referred_to_ophthalmology', type: 'boolean', default: false }) referredToOphthalmology: boolean;
  @Column({ type: 'text', nullable: true }) urgency: string | null;
  @Column({ name: 'next_screening_months', type: 'int', default: 12 }) nextScreeningMonths: number;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 3c. `services/ehr-service/src/entities/ckd-staging-record.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ckd_staging_records')
export class CkdStagingRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'record_date', type: 'date' }) recordDate: string;
  @Column({ name: 'creatinine_umol_l', type: 'decimal', precision: 8, scale: 2, nullable: true }) creatinineUmolL: number | null;
  @Column({ name: 'egfr_ml_min_1_73m2', type: 'decimal', precision: 6, scale: 2, nullable: true }) egfrMlMin173m2: number | null;
  @Column({ name: 'egfr_equation', type: 'text', default: 'CKD-EPI' }) egfrEquation: string;
  @Column({ name: 'ckd_stage', type: 'text', nullable: true }) ckdStage: string | null;
  @Column({ name: 'uacr_mg_g', type: 'decimal', precision: 8, scale: 2, nullable: true }) uacrMgG: number | null;
  @Column({ name: 'urine_dipstick_protein', type: 'text', nullable: true }) urineDipstickProtein: string | null;
  @Column({ name: 'albuminuria_category', type: 'text', nullable: true }) albuminuriaCategory: string | null;
  @Column({ name: 'primary_cause', type: 'text', nullable: true }) primaryCause: string | null;
  @Column({ name: 'haemoglobin_g_dl', type: 'decimal', precision: 4, scale: 1, nullable: true }) haemoglobinGDl: number | null;
  @Column({ name: 'potassium_mmol_l', type: 'decimal', precision: 4, scale: 2, nullable: true }) potassiumMmolL: number | null;
  @Column({ name: 'bicarbonate_mmol_l', type: 'decimal', precision: 4, scale: 2, nullable: true }) bicarbonateMmolL: number | null;
  @Column({ name: 'phosphate_mmol_l', type: 'decimal', precision: 4, scale: 2, nullable: true }) phosphateMmolL: number | null;
  @Column({ name: 'sbp_mmhg', type: 'int', nullable: true }) sbpMmhg: number | null;
  @Column({ name: 'dbp_mmhg', type: 'int', nullable: true }) dbpMmhg: number | null;
  @Column({ name: 'referred_to_nephrology', type: 'boolean', default: false }) referredToNephrology: boolean;
  @Column({ name: 'ace_inhibitor_arb', type: 'boolean', nullable: true }) aceInhibitorArb: boolean | null;
  @Column({ name: 'metformin_stopped', type: 'boolean', nullable: true }) metforminStopped: boolean | null;
  @Column({ name: 'nsaid_stopped', type: 'boolean', nullable: true }) nsaidStopped: boolean | null;
  @Column({ name: 'dose_adjusted_drugs', type: 'jsonb', default: [] }) doseAdjustedDrugs: Record<string, any>[];
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

---

## 4. CDSS Endpoints

**File**: `services/cdss-service/main.py` — add after S147 block.

### 4a. Pydantic models

```python
# Sprint 148 — NCD Complications
class DiabeticFootRiskRequest(BaseModel):
    right_wagner_grade: Optional[int] = None
    left_wagner_grade: Optional[int] = None
    right_foot_sensation: Optional[str] = 'intact'
    left_foot_sensation: Optional[str] = 'intact'
    right_foot_pulses: Optional[str] = 'present'
    left_foot_pulses: Optional[str] = 'present'
    right_abi: Optional[float] = None
    left_abi: Optional[float] = None
    infection_signs: Optional[List[str]] = []
    ulcer_present: Optional[bool] = False
    hba1c: Optional[float] = None           # % — if available
    diabetes_duration_years: Optional[int] = None

class CkdManagementRequest(BaseModel):
    egfr: float
    uacr_mg_g: Optional[float] = None
    cause: Optional[str] = None             # 'diabetic' | 'hypertensive' | 'other'
    sbp: Optional[int] = None
    potassium: Optional[float] = None
    on_metformin: Optional[bool] = None
    on_ace_arb: Optional[bool] = None
    haemoglobin: Optional[float] = None

class RetinopathyRiskRequest(BaseModel):
    right_grade: Optional[str] = 'none'
    left_grade: Optional[str] = 'none'
    dme_present: Optional[bool] = False
    diabetes_duration_years: Optional[int] = None
    hba1c: Optional[float] = None
    sbp: Optional[int] = None
```

### 4b. `POST /cdss/ncd/diabetic-foot-risk`

```python
@app.post("/cdss/ncd/diabetic-foot-risk")
async def diabetic_foot_risk(req: DiabeticFootRiskRequest):
    """
    Assess diabetic foot risk level, amputation risk, and management recommendations
    based on Wagner grade, neurovascular status, ABI, and infection signs.
    """
    max_wagner = max(
        req.right_wagner_grade or 0,
        req.left_wagner_grade or 0,
    )
    infection_count = len(req.infection_signs or [])

    # Risk classification
    if max_wagner >= 4 or (max_wagner >= 3 and infection_count >= 2):
        risk_level = 'critical'
        action = 'Urgent surgical referral — risk of major amputation. Admit patient.'
    elif max_wagner == 3 or (max_wagner >= 2 and infection_count >= 1):
        risk_level = 'high'
        action = 'Urgent referral to surgeon within 24 hours. IV antibiotics. Off-loading.'
    elif max_wagner == 2:
        risk_level = 'high'
        action = 'Refer to wound care team. Deep wound — assess for tendon/bone involvement. Off-loading mandatory.'
    elif max_wagner == 1:
        risk_level = 'moderate'
        action = 'Wound care: moist dressing + off-loading. Antibiotics if signs of infection. Review in 3–5 days.'
    elif (req.right_foot_sensation in ['reduced', 'absent'] or
          req.left_foot_sensation in ['reduced', 'absent'] or
          req.right_foot_pulses in ['diminished', 'absent'] or
          req.left_foot_pulses in ['diminished', 'absent']):
        risk_level = 'moderate'
        action = 'High-risk foot — no current ulcer. Preventive footwear. Foot care education. 3-monthly assessment.'
    else:
        risk_level = 'low'
        action = 'Low-risk foot. Annual review. Foot hygiene education. Appropriate footwear.'

    # ABI interpretation
    abi_flags = []
    for side, abi in [('right', req.right_abi), ('left', req.left_abi)]:
        if abi is not None:
            if abi < 0.4:
                abi_flags.append(f'{side.capitalize()} ABI {abi:.2f}: CRITICAL ischaemia — urgent vascular referral')
            elif abi < 0.6:
                abi_flags.append(f'{side.capitalize()} ABI {abi:.2f}: Severe PAD — vascular surgery referral')
            elif abi < 0.9:
                abi_flags.append(f'{side.capitalize()} ABI {abi:.2f}: Mild-moderate PAD — monitor, consider vascular referral')
            elif abi > 1.3:
                abi_flags.append(f'{side.capitalize()} ABI {abi:.2f}: Non-compressible vessels (calcification) — Toe-Brachial Index recommended')

    wagner_descriptions = {
        0: 'Grade 0: No open lesion; high-risk features (neuropathy, deformity, callus)',
        1: 'Grade 1: Superficial ulcer — skin and subcutaneous tissue only',
        2: 'Grade 2: Deep ulcer — penetrates to tendon, capsule, or bone without abscess',
        3: 'Grade 3: Deep ulcer + abscess, osteomyelitis, or septic arthritis',
        4: 'Grade 4: Gangrene of forefoot or toes',
        5: 'Grade 5: Extensive gangrene of entire foot',
    }

    return {
        'risk_level': risk_level,
        'max_wagner_grade': max_wagner,
        'wagner_description': wagner_descriptions.get(max_wagner, ''),
        'recommended_action': action,
        'amputation_risk': 'very_high' if max_wagner >= 4 else ('high' if max_wagner >= 3 else ('moderate' if max_wagner >= 1 else 'low')),
        'abi_flags': abi_flags,
        'infection_assessment': f'{infection_count} infection signs present — {"start systemic antibiotics" if infection_count >= 2 else ("monitor closely" if infection_count == 1 else "no active infection")}',
        'next_screening_weeks': 1 if risk_level == 'critical' else (4 if risk_level == 'high' else (13 if risk_level == 'moderate' else 52)),
        'care_principles': [
            'Off-loading is the single most important intervention for plantar ulcers',
            'Total Contact Cast (TCC) is gold standard for off-loading',
            'Debride necrotic tissue at every visit',
            'Wound swab if infection suspected — empiric antibiotic then adjust per culture',
            'Control blood glucose: target HbA1c <7.0% (53 mmol/mol)',
            'Ensure adequate blood supply before attempting wound healing',
        ],
    }
```

### 4c. `POST /cdss/ncd/ckd-management`

```python
@app.post("/cdss/ncd/ckd-management")
async def ckd_management(req: CkdManagementRequest):
    """
    CKD staging (KDIGO G1-G5), albuminuria category (A1-A3),
    medication safety flags, and management recommendations.
    """
    # eGFR staging
    egfr = req.egfr
    if egfr >= 90:
        stage, progression_risk = 'G1', 'low_if_no_markers'
        stage_description = 'Normal or high kidney function (≥90 mL/min/1.73m²)'
    elif egfr >= 60:
        stage, progression_risk = 'G2', 'low'
        stage_description = 'Mildly decreased kidney function (60–89)'
    elif egfr >= 45:
        stage, progression_risk = 'G3a', 'moderate'
        stage_description = 'Mild-to-moderately decreased (45–59)'
    elif egfr >= 30:
        stage, progression_risk = 'G3b', 'moderate_high'
        stage_description = 'Moderately to severely decreased (30–44)'
    elif egfr >= 15:
        stage, progression_risk = 'G4', 'high'
        stage_description = 'Severely decreased (15–29) — prepare for renal replacement therapy'
    else:
        stage, progression_risk = 'G5', 'kidney_failure'
        stage_description = 'Kidney failure (<15) — initiate renal replacement therapy discussion'

    # Albuminuria category
    uacr = req.uacr_mg_g
    if uacr is None:
        albumin_cat = 'unknown'
    elif uacr < 30:
        albumin_cat = 'A1'
    elif uacr < 300:
        albumin_cat = 'A2'
    else:
        albumin_cat = 'A3'

    # Medication safety
    med_flags = []
    if req.on_metformin and egfr < 30:
        med_flags.append({'drug': 'Metformin', 'flag': 'STOP', 'reason': 'eGFR <30 — risk of lactic acidosis. Contraindicated.'})
    elif req.on_metformin and egfr < 45:
        med_flags.append({'drug': 'Metformin', 'flag': 'REDUCE_DOSE', 'reason': 'eGFR 30–44 — halve dose, monitor closely.'})
    if not req.on_ace_arb and req.cause in ['diabetic', 'hypertensive'] and egfr >= 30:
        med_flags.append({'drug': 'ACE inhibitor / ARB', 'flag': 'START_IF_NOT_CONTRAINDICATED', 'reason': 'Renoprotective in diabetic/hypertensive nephropathy with albuminuria. Target BP <130/80.'})
    if req.potassium and req.potassium > 5.5:
        med_flags.append({'drug': 'ACE inhibitor / ARB / K-sparing diuretics', 'flag': 'CAUTION', 'reason': f'Potassium {req.potassium} mmol/L — hyperkalaemia. Review potassium-raising medications.'})
    if req.haemoglobin and req.haemoglobin < 10.0 and egfr < 45:
        med_flags.append({'drug': 'Erythropoietin-stimulating agent (ESA)', 'flag': 'CONSIDER', 'reason': f'Hb {req.haemoglobin} g/dL with CKD {stage} — anaemia of CKD. Consider ESA + iron supplementation.'})

    recommendations = [f'CKD {stage}: {stage_description}']
    if egfr < 30:
        recommendations.append('Refer to nephrology urgently — approaching kidney failure')
    elif egfr < 45:
        recommendations.append('Refer to nephrology for co-management')
    if req.sbp and req.sbp > 130:
        recommendations.append(f'BP {req.sbp} mmHg — target <130/80 in CKD. Consider ACEI/ARB as first-line if not contraindicated.')
    recommendations.append('Monitor eGFR and UACR every 3–6 months')
    recommendations.append('Restrict dietary protein to 0.8 g/kg/day in CKD G3b–G5')
    recommendations.append('Restrict sodium to <2g/day')

    return {
        'ckd_stage': stage,
        'stage_description': stage_description,
        'egfr': egfr,
        'progression_risk': progression_risk,
        'albuminuria_category': albumin_cat,
        'uacr': uacr,
        'medication_flags': med_flags,
        'recommendations': recommendations,
        'referral_required': egfr < 45,
        'urgency': 'urgent' if egfr < 15 else ('routine' if egfr >= 30 else 'soon'),
        'next_review_months': 1 if egfr < 15 else (3 if egfr < 30 else (6 if egfr < 45 else 12)),
    }
```

---

## 5. EHR Service

### 5a. `services/ehr-service/src/services/ncd-complication.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { DiabeticFootAssessment } from '../entities/diabetic-foot-assessment.entity';
import { RetinopathyScreening } from '../entities/retinopathy-screening.entity';
import { CkdStagingRecord } from '../entities/ckd-staging-record.entity';

@Injectable()
export class NcdComplicationService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Diabetic Foot ──────────────────────────────────────────────────────────

  async recordFootAssessment(
    tenantId: string,
    assessedBy: string,
    dto: Partial<DiabeticFootAssessment>,
  ): Promise<{ assessment: DiabeticFootAssessment; riskAnalysis: Record<string, any> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const entity = db.getRepository(DiabeticFootAssessment).create({ ...dto, assessedBy } as Partial<DiabeticFootAssessment>);
    const assessment = await db.getRepository(DiabeticFootAssessment).save(entity) as unknown as DiabeticFootAssessment;

    let riskAnalysis: Record<string, any> = {};
    try {
      riskAnalysis = await this.cdssService.requestWithPolicy<Record<string, any>>(
        'POST', 'diabeticFootRisk', '/cdss/ncd/diabetic-foot-risk',
        {
          right_wagner_grade: dto.rightWagnerGrade ?? undefined,
          left_wagner_grade: dto.leftWagnerGrade ?? undefined,
          right_foot_sensation: dto.rightFootSensation ?? 'intact',
          left_foot_sensation: dto.leftFootSensation ?? 'intact',
          right_foot_pulses: dto.rightFootPulses ?? 'present',
          left_foot_pulses: dto.leftFootPulses ?? 'present',
          right_abi: dto.rightAbi ?? undefined,
          left_abi: dto.leftAbi ?? undefined,
          infection_signs: dto.infectionSigns ?? [],
          ulcer_present: dto.ulcerPresent ?? false,
        },
        10000, tenantId,
      );
    } catch (_) { /* non-blocking */ }

    return { assessment, riskAnalysis };
  }

  async getFootHistory(tenantId: string, patientId: string): Promise<DiabeticFootAssessment[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(DiabeticFootAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Retinopathy ────────────────────────────────────────────────────────────

  async recordRetinopathyScreening(
    tenantId: string,
    screenedBy: string,
    dto: Partial<RetinopathyScreening>,
  ): Promise<RetinopathyScreening> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const entity = db.getRepository(RetinopathyScreening).create({ ...dto, screenedBy } as Partial<RetinopathyScreening>);
    return db.getRepository(RetinopathyScreening).save(entity) as unknown as RetinopathyScreening;
  }

  async getRetinopathyHistory(tenantId: string, patientId: string): Promise<RetinopathyScreening[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(RetinopathyScreening).find({
      where: { patientId },
      order: { screeningDate: 'DESC' },
    });
  }

  // ── CKD ────────────────────────────────────────────────────────────────────

  async recordCkdStaging(
    tenantId: string,
    recordedBy: string,
    dto: Partial<CkdStagingRecord>,
  ): Promise<{ record: CkdStagingRecord; management: Record<string, any> }> {
    // Auto-calculate eGFR if creatinine provided and eGFR not provided
    // CKD-EPI equation (simplified — requires age and sex from patient profile ideally)
    // For now: accept eGFR directly or compute basic estimate
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const entity = db.getRepository(CkdStagingRecord).create({ ...dto, recordedBy } as Partial<CkdStagingRecord>);
    const record = await db.getRepository(CkdStagingRecord).save(entity) as unknown as CkdStagingRecord;

    let management: Record<string, any> = {};
    if (dto.egfrMlMin173m2) {
      try {
        management = await this.cdssService.requestWithPolicy<Record<string, any>>(
          'POST', 'ckdManagement', '/cdss/ncd/ckd-management',
          {
            egfr: dto.egfrMlMin173m2,
            uacr_mg_g: dto.uacrMgG ?? undefined,
            cause: dto.primaryCause ?? undefined,
            sbp: dto.sbpMmhg ?? undefined,
            potassium: dto.potassiumMmolL ?? undefined,
            on_metformin: dto.metforminStopped === false ? true : undefined,
            on_ace_arb: dto.aceInhibitorArb ?? undefined,
            haemoglobin: dto.haemoglobinGDl ?? undefined,
          },
          10000, tenantId,
        );
        // Auto-stage if CDSS returns stage
        if (management?.ckd_stage) {
          await db.getRepository(CkdStagingRecord).update(record.id, { ckdStage: management.ckd_stage });
        }
      } catch (_) { /* non-blocking */ }
    }

    return { record, management };
  }

  async getCkdHistory(tenantId: string, patientId: string): Promise<CkdStagingRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(CkdStagingRecord).find({
      where: { patientId },
      order: { recordDate: 'DESC' },
    });
  }

  // ── Register View (all patients with any complication) ────────────────────

  async getComplicationRegister(
    tenantId: string,
    options: { complicationType?: string; highRiskOnly?: boolean } = {},
  ): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    let query = `
      SELECT DISTINCT
        p.id AS patient_id,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        -- Latest foot assessment
        (SELECT MAX(dfa.assessment_date) FROM diabetic_foot_assessments dfa WHERE dfa.patient_id = p.id) AS last_foot_assessment,
        (SELECT MAX(dfa.right_wagner_grade) FROM diabetic_foot_assessments dfa WHERE dfa.patient_id = p.id) AS max_wagner,
        -- Latest retinopathy screening
        (SELECT MAX(rs.screening_date) FROM retinopathy_screenings rs WHERE rs.patient_id = p.id) AS last_eye_screening,
        (SELECT rs.overall_grade FROM retinopathy_screenings rs WHERE rs.patient_id = p.id ORDER BY rs.screening_date DESC LIMIT 1) AS latest_retinopathy_grade,
        -- Latest CKD
        (SELECT MAX(ckd.record_date) FROM ckd_staging_records ckd WHERE ckd.patient_id = p.id) AS last_ckd_record,
        (SELECT ckd.ckd_stage FROM ckd_staging_records ckd WHERE ckd.patient_id = p.id ORDER BY ckd.record_date DESC LIMIT 1) AS current_ckd_stage
      FROM patients p
      WHERE (
        EXISTS (SELECT 1 FROM diabetic_foot_assessments dfa WHERE dfa.patient_id = p.id)
        OR EXISTS (SELECT 1 FROM retinopathy_screenings rs WHERE rs.patient_id = p.id)
        OR EXISTS (SELECT 1 FROM ckd_staging_records ckd WHERE ckd.patient_id = p.id)
      )
      ORDER BY p.last_name, p.first_name
      LIMIT 500
    `;

    return db.query(query);
  }
}
```

### 5b. `services/ehr-service/src/controllers/ncd-complication.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NcdComplicationService } from '../services/ncd-complication.service';

@Controller('ncd-complications')
@UseGuards(JwtAuthGuard)
export class NcdComplicationController {
  constructor(private readonly svc: NcdComplicationService) {}

  // Diabetic Foot
  @Post('foot/:patientId')
  recordFootAssessment(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.svc.recordFootAssessment(req.tenantId!, user?.userId ?? user?.id, { ...body, patientId });
  }

  @Get('foot/:patientId')
  getFootHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.svc.getFootHistory(req.tenantId!, patientId);
  }

  // Retinopathy
  @Post('retinopathy/:patientId')
  recordRetinopathy(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.svc.recordRetinopathyScreening(req.tenantId!, user?.userId ?? user?.id, { ...body, patientId });
  }

  @Get('retinopathy/:patientId')
  getRetinopathyHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.svc.getRetinopathyHistory(req.tenantId!, patientId);
  }

  // CKD
  @Post('ckd/:patientId')
  recordCkd(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.svc.recordCkdStaging(req.tenantId!, user?.userId ?? user?.id, { ...body, patientId });
  }

  @Get('ckd/:patientId')
  getCkdHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.svc.getCkdHistory(req.tenantId!, patientId);
  }

  // Register
  @Get('register')
  getRegister(
    @Query('complicationType') complicationType?: string,
    @Query('highRiskOnly') highRiskOnly?: string,
    @Request() req?: RequestWithTenant,
  ) {
    return this.svc.getComplicationRegister(req!.tenantId!, {
      complicationType,
      highRiskOnly: highRiskOnly === 'true',
    });
  }
}
```

### Route Summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/ncd-complications/foot/:patientId` | Record foot assessment; returns CDSS risk analysis |
| GET | `/ncd-complications/foot/:patientId` | Foot assessment history |
| POST | `/ncd-complications/retinopathy/:patientId` | Record eye screening |
| GET | `/ncd-complications/retinopathy/:patientId` | Eye screening history |
| POST | `/ncd-complications/ckd/:patientId` | Record CKD staging; returns CDSS management advice |
| GET | `/ncd-complications/ckd/:patientId` | CKD history |
| GET | `/ncd-complications/register` | All patients with any complication (register view) |

---

## 6. Module Registration

### `services/ehr-service/src/services/tenant.service.ts` — entities array

```typescript
DiabeticFootAssessment,
RetinopathyScreening,
CkdStagingRecord,
```

Imports:

```typescript
import { DiabeticFootAssessment } from '../entities/diabetic-foot-assessment.entity';
import { RetinopathyScreening } from '../entities/retinopathy-screening.entity';
import { CkdStagingRecord } from '../entities/ckd-staging-record.entity';
```

### `services/ehr-service/src/ehr.module.ts`

```typescript
// controllers array
NcdComplicationController,

// providers array
NcdComplicationService,
```

Imports:

```typescript
import { NcdComplicationController } from './controllers/ncd-complication.controller';
import { NcdComplicationService } from './services/ncd-complication.service';
```

---

## 7. Frontend

### 7a. `ehr-frontend/src/services/api.ts`

```typescript
export const ncdComplicationApi = {
  recordFootAssessment: (patientId: string, data: Record<string, any>) =>
    ehrAxios.post(`/ncd-complications/foot/${patientId}`, data),
  getFootHistory: (patientId: string) =>
    ehrAxios.get(`/ncd-complications/foot/${patientId}`),
  recordRetinopathy: (patientId: string, data: Record<string, any>) =>
    ehrAxios.post(`/ncd-complications/retinopathy/${patientId}`, data),
  getRetinopathyHistory: (patientId: string) =>
    ehrAxios.get(`/ncd-complications/retinopathy/${patientId}`),
  recordCkd: (patientId: string, data: Record<string, any>) =>
    ehrAxios.post(`/ncd-complications/ckd/${patientId}`, data),
  getCkdHistory: (patientId: string) =>
    ehrAxios.get(`/ncd-complications/ckd/${patientId}`),
  getRegister: (params?: { complicationType?: string; highRiskOnly?: boolean }) =>
    ehrAxios.get('/ncd-complications/register', { params }),
};
```

### 7b. `ehr-frontend/src/components/NcdComplicationDashboard.tsx`

4-tab component: `foot` | `eye` | `kidney` | `register`

**Props**: `patientId: string | null` — register tab works without patientId; the other 3 tabs require it.

**Tab: `foot` — Diabetic Foot**

Form (show when `patientId` is set):
- Sensation: Right / Left select (intact / reduced / absent)
- Pulses: Right / Left select (present / diminished / absent)
- Deformity: Right / Left checkbox
- Callus: checkbox
- Wagner Grade: Right / Left select (0–5) with description tooltip per grade
- Ulcer Present: checkbox (if yes, show): Location text, Size cm², Depth select, Wound Bed select
- Infection signs: multi-checkbox (erythema, warmth, purulence, odour, cellulitis)
- ABI: Right / Left decimal input (optional)
- Dressing Type: text, Offloading Device: select, Antibiotic: text, Review In Days: number

On submit: `ncdComplicationApi.recordFootAssessment()` → display returned `riskAnalysis`:
- Risk badge: critical (red) / high (orange) / moderate (amber) / low (green)
- Max Wagner grade badge
- Recommended action (prominent text)
- Amputation risk badge
- ABI flags (if any)

History table: date, Wagner R/L, ulcer (yes/no), risk level badge, review date.

**Tab: `eye` — Retinopathy**

Form:
- Method: select (Ophthalmoscopy / Fundus photo / Slit lamp)
- Right eye grade: select (none / Mild NPDR / Moderate NPDR / Severe NPDR / PDR / Ungradable) with description tooltip
- Left eye grade: same
- DME Right / Left: checkbox
- Hypertensive retinopathy grade: select (0–4) — optional
- Referred to ophthalmology: checkbox; if yes, show urgency select (routine / urgent within 1 week / emergency same day)
- Next screening months: number (auto-filled per grade)

Submit → `ncdComplicationApi.recordRetinopathy()`

History: date, R grade, L grade, DME (R/L), referred (yes/no), next screening date.

**Tab: `kidney` — CKD Staging**

Form:
- Creatinine µmol/L: decimal, eGFR: decimal (if creatinine entered but no eGFR, show: "Enter eGFR or compute manually")
- eGFR Equation: select (CKD-EPI / MDRD)
- UACR mg/g: decimal, Urine dipstick protein: select
- Primary cause: select (Diabetic / Hypertensive / Other / Unknown)
- BP: SBP / DBP
- Labs: Hb, K+, HCO3, Phosphate (all optional)
- Medications: ACE/ARB checkbox, Metformin stopped checkbox, NSAID stopped checkbox

Submit → `ncdComplicationApi.recordCkd()` → display CDSS `management`:
- CKD Stage badge (G1–G5, colour coded: G1-G2=green, G3a=yellow, G3b=amber, G4=orange, G5=red)
- eGFR value + stage description
- Medication flags (each flag as a coloured pill: STOP=red, REDUCE_DOSE=amber, START=blue, CONSIDER=teal, CAUTION=orange)
- Recommendations list

History: date, creatinine, eGFR, CKD stage badge, albuminuria category, BP.

**Tab: `register` — Complication Register**

- "High Risk Only" toggle filter
- Table columns: Patient Name | Last Foot Assessment | Max Wagner | Last Eye Screening | Retinopathy Grade | Last CKD Record | CKD Stage
- Overdue screening alerts (red): foot assessment >3 months ago for high-risk foot; eye screening >12 months; CKD record >6 months for G3+
- Click row → opens patient-level view (sets patientId and switches to relevant tab)

### 7c. Add tab to `NurseDashboard.tsx`

Add after the `one-health` entry in the NCD sidebar section:

```tsx
import NcdComplicationDashboard from '../components/NcdComplicationDashboard';
```

```tsx
{ label: 'NCD Complications', tab: 'ncd-complications', icon: Activity },
```

```tsx
{activeTab === 'ncd-complications' && (
  <NcdComplicationDashboard patientId={selectedPatient?.id ?? null} />
)}
```

`Activity` is in `lucide-react`.

---

## 8. Post-Implementation Steps

> **Why these steps are mandatory**: The `sprint148_ncd_complications` bundle only runs on new tenants
> automatically. Every *existing* tenant DB must have the bundle applied manually via step 2 below.
> Skipping step 2 means live clinics will get 404 / missing-table errors on the new endpoints.

```bash
# 1. Rebuild tenant-service so the new statements file is compiled in
docker compose build tenant-service

# 2. Apply provisioning bundle to ALL existing tenant databases (mandatory)
./scripts/provision-repair-all.sh
# If the script is unavailable, use the API endpoint instead:
curl -X POST http://localhost:3001/admin/tenants/repair-all \
  -H "Authorization: Bearer <admin-token>"

# 3. Verify tables exist in the tenant DB (replace DB name as needed)
psql $DATABASE_URL -c "\d diabetic_foot_assessments"
psql $DATABASE_URL -c "\d retinopathy_screenings"
psql $DATABASE_URL -c "\d ckd_staging_records"
psql $DATABASE_URL -c "\d ncd_complication_summaries"
# All four must return column listings — if any says "Did not find any relation" the bundle did not apply.

# 4. TypeScript check
npx tsc --noEmit

# 5. Test CDSS foot risk
curl -X POST http://localhost:8000/cdss/ncd/diabetic-foot-risk \
  -H "Content-Type: application/json" \
  -d '{"right_wagner_grade":2,"left_wagner_grade":0,"right_foot_sensation":"reduced","right_foot_pulses":"diminished","infection_signs":["erythema"],"ulcer_present":true}'
# Expected: risk_level: "high"

# 6. Test CDSS CKD management
curl -X POST http://localhost:8000/cdss/ncd/ckd-management \
  -H "Content-Type: application/json" \
  -d '{"egfr":32,"uacr_mg_g":380,"cause":"diabetic","sbp":150,"on_metformin":true}'
# Expected: ckd_stage: "G3b", medication_flags includes REDUCE_DOSE for Metformin, referral_required: true
```

---

## 9. Done When

- [ ] `diabetic_foot_assessments`, `retinopathy_screenings`, `ckd_staging_records`, `ncd_complication_summaries` tables exist in all tenant DBs
- [ ] `POST /ncd-complications/foot/:patientId` returns live CDSS risk analysis (risk_level, amputation_risk, recommended_action)
- [ ] `POST /ncd-complications/ckd/:patientId` returns live CDSS management guidance (CKD stage, medication flags, referral_required)
- [ ] `GET /ncd-complications/register` returns all patients with any complication record
- [ ] `NurseDashboard` shows "NCD Complications" tab
- [ ] Foot tab: form → submit → CDSS risk badge and recommended action displayed
- [ ] Kidney tab: form → submit → CKD stage badge + medication flags displayed (no hardcoded stages)
- [ ] Register tab: overdue assessments highlighted in red
- [ ] `npx tsc --noEmit` zero errors
- [ ] `npm run lint` passes for all touched files
