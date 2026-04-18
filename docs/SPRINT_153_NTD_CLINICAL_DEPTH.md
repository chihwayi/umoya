# Sprint 153 — NTD Clinical Depth: Leprosy MDT, Onchocerciasis, Filariasis

**Sprint**: S153  
**Module**: Leprosy MDT Programme, Onchocerciasis MDA, Lymphatic Filariasis/Loiasis  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint153_ntd_clinical_depth`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

MediCore has a basic NTD module from S140 covering malaria and broad NTD concepts. What is missing is the clinical depth required for facility-level NTD programme management:

| NTD | AFRO Burden | Missing |
|---|---|---|
| Leprosy | 200k+ new cases/year globally; Africa contributes ~35%; WHO NLEP targets zero | No PB/MB classification, no MDT regimen tracking, no nerve function impairment grading, no reaction management |
| Onchocerciasis (River Blindness) | 99% burden in Africa; APOC/ESPEN MDA programmes ongoing | No Ov16 serology, no skin snip result, no ivermectin MDA round tracking |
| Lymphatic Filariasis / Loiasis | LF: 47 of 49 African countries endemic; Loa loa: DEC contraindicated if MF >8000/mL | No lymphoedema staging, no MDA dose tracking, no Loa loa microfilaria safety check |

### What already exists (do NOT recreate)

- Basic NTD module from S140 — do NOT duplicate; extend with these new entities
- `PatientService`, `CdssService`, `ehr.module.ts`
- `database-provisioning.service.ts`, `tenant.service.ts`

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-ntd-clinical-depth.statements.ts`**

```typescript
export const TENANT_NTD_DEPTH_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_NTD_DEPTH_STATEMENTS: string[] = [

  // ── Leprosy Cases ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS leprosy_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    registered_by UUID NOT NULL,
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- WHO Classification
    classification TEXT NOT NULL,        -- 'PB' (paucibacillary, 1-5 lesions) | 'MB' (multibacillary, 6+ lesions or BL/LL)
    ridley_jopling_type TEXT,            -- 'TT' | 'BT' | 'BB' | 'BL' | 'LL' | 'pure_neural'
    -- Bacilloscopy
    bacteriological_index DECIMAL(3,1), -- 0-6 Ridley scale
    skin_smear_sites INTEGER,
    -- Disability grading (WHO 0/1/2)
    right_eye_grade INTEGER,             -- 0 = no impairment; 1 = impairment, VA>6/60; 2 = severe, VA<=6/60 or lagophthalmos
    left_eye_grade INTEGER,
    right_hand_grade INTEGER,            -- 0 = no anaesthesia; 1 = anaesthesia; 2 = visible deformity/damage
    left_hand_grade INTEGER,
    right_foot_grade INTEGER,
    left_foot_grade INTEGER,
    max_disability_grade INTEGER,        -- derived: max of all 6 sites
    -- Nerve Function Impairment
    nfi_present BOOLEAN NOT NULL DEFAULT false,
    nfi_nerves_affected JSONB DEFAULT '[]',  -- ['ulnar_right','common_peroneal_left','facial_right']
    nfi_motor_loss BOOLEAN NOT NULL DEFAULT false,
    nfi_sensory_loss BOOLEAN NOT NULL DEFAULT false,
    -- MDT Treatment
    mdt_regimen TEXT NOT NULL,           -- 'PB_6months' | 'MB_12months'
    mdt_start_date DATE,
    mdt_expected_completion DATE,        -- start + 6 or 12 months
    mdt_completed_date DATE,
    rft_date DATE,                       -- Release From Treatment
    monthly_supervised_doses INTEGER NOT NULL DEFAULT 0,   -- rifampicin+clofazimine (MB) or rifampicin (PB) at clinic
    self_administered_doses INTEGER NOT NULL DEFAULT 0,    -- dapsone ± clofazimine daily at home
    doses_missed INTEGER NOT NULL DEFAULT 0,
    -- Lepra Reactions
    reaction_type TEXT,                  -- 'type_1_reversal' | 'type_2_eni' | 'none'
    reaction_start_date DATE,
    reaction_treatment TEXT,             -- 'prednisolone' | 'thalidomide_males_only' | 'nsaid'
    reaction_dose TEXT,
    -- Contact screening
    household_contacts_screened INTEGER NOT NULL DEFAULT 0,
    -- Outcome
    outcome TEXT,                        -- 'completed_treatment' | 'defaulted' | 'transferred_out' | 'died' | 'under_treatment'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_leprosy_patient ON leprosy_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_leprosy_classification ON leprosy_cases(classification)`,
  `CREATE INDEX IF NOT EXISTS idx_leprosy_outcome ON leprosy_cases(outcome)`,

  // ── Onchocerciasis Cases ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS onchocerciasis_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    registered_by UUID NOT NULL,
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Diagnosis
    ov16_serology TEXT,                  -- 'positive' | 'negative' | 'pending'
    ov16_test_date DATE,
    skin_snip_result TEXT,               -- 'positive' | 'negative' | 'pending'
    skin_snip_sites TEXT,                -- 'iliac_crest_bilateral' | 'scapular'
    microfilaria_per_mg_skin DECIMAL(8,2),
    -- Clinical
    ocular_involvement BOOLEAN NOT NULL DEFAULT false,
    ocular_findings TEXT,                -- 'punctate_keratitis' | 'sclerosing_keratitis' | 'chorioretinopathy' | 'optic_atrophy'
    visual_acuity_right TEXT,
    visual_acuity_left TEXT,
    skin_disease TEXT,                   -- 'sowda' | 'lichenified' | 'depigmented_leopard' | 'pruritus_only'
    nodule_count INTEGER,
    -- MDA (Mass Drug Administration)
    ivermectin_dose_mg DECIMAL(5,2),
    mda_round INTEGER,
    last_ivermectin_date DATE,
    ivermectin_administered_by TEXT,     -- 'facility' | 'community_directed_distributor'
    adverse_reactions JSONB DEFAULT '[]', -- [{reaction, severity, date}]
    -- Programme
    cdti_village TEXT,                   -- Community-Directed Treatment with Ivermectin
    espen_programme TEXT,                -- 'APOC' | 'ESPEN' | 'national'
    -- Outcome
    follow_up_required BOOLEAN NOT NULL DEFAULT true,
    outcome TEXT,                        -- 'under_mda' | 'ocular_stabilised' | 'blind' | 'transferred'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_oncho_patient ON onchocerciasis_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oncho_mda_round ON onchocerciasis_cases(mda_round)`,

  // ── Filariasis Cases ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS filariasis_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    registered_by UUID NOT NULL,
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Disease type
    disease_type TEXT NOT NULL,          -- 'lymphatic_wuchereria' | 'lymphatic_brugia' | 'loiasis'
    -- Diagnosis
    mf_count_per_ml INTEGER,             -- microfilaria count per mL blood (crucial for Loa loa safety)
    mf_test_method TEXT,                 -- 'thick_blood_film' | 'filtration' | 'Og4C3_antigen'
    mf_test_date DATE,
    antigen_card_test TEXT,              -- 'positive' | 'negative' (for Wuchereria bancrofti)
    -- Clinical (Lymphatic Filariasis)
    lymphoedema_stage INTEGER,           -- 0-7 Dreyer staging: 0=none, 1=reversible swelling, 7=mossy foot
    lymphoedema_sites JSONB DEFAULT '[]', -- ['left_leg','right_leg','left_arm','scrotum','breast']
    hydrocele BOOLEAN NOT NULL DEFAULT false,
    hydrocele_side TEXT,                 -- 'left' | 'right' | 'bilateral'
    acute_adenolymphangitis_episodes INTEGER NOT NULL DEFAULT 0,
    -- Clinical (Loiasis specific)
    calabar_swelling BOOLEAN NOT NULL DEFAULT false,
    subconjunctival_worm BOOLEAN NOT NULL DEFAULT false,
    loa_loa_mf_count INTEGER,            -- separate field — safety threshold for ivermectin/DEC
    -- MDA / Treatment
    dec_dose_mg DECIMAL(6,2),            -- diethylcarbamazine — CONTRAINDICATED in loiasis if MF >8000
    albendazole_dose_mg DECIMAL(6,2),
    ivermectin_dose_mg DECIMAL(6,2),
    mda_round INTEGER,
    last_treatment_date DATE,
    treatment_safe BOOLEAN,              -- CDSS-computed safety flag
    treatment_contraindication TEXT,     -- free text if unsafe
    -- Morbidity Management
    lymphoedema_hygiene_education BOOLEAN NOT NULL DEFAULT false,
    hydrocelectomy_referral BOOLEAN NOT NULL DEFAULT false,
    -- Programme
    espen_programme TEXT,
    -- Outcome
    outcome TEXT,                        -- 'under_mda' | 'lymphoedema_managed' | 'hydrocele_operated' | 'transferred'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_filariasis_patient ON filariasis_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_filariasis_type ON filariasis_cases(disease_type)`,

];
```

### 2b. Register Bundle in `database-provisioning.service.ts`

```typescript
import {
  TENANT_NTD_DEPTH_BUNDLE_VERSION,
  TENANT_NTD_DEPTH_STATEMENTS,
} from './generated/tenant-ntd-clinical-depth.statements';

{
  id: 'sprint153_ntd_clinical_depth',
  label: 'Sprint 153 — NTD Depth: Leprosy MDT, Onchocerciasis, Filariasis',
  version: TENANT_NTD_DEPTH_BUNDLE_VERSION,
  description: 'Creates leprosy_cases, onchocerciasis_cases, filariasis_cases tables',
  statements: TENANT_NTD_DEPTH_STATEMENTS,
},
```

---

## 3. TypeORM Entities

**File: `services/ehr-service/src/ntd/entities/leprosy-case.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'leprosy_cases' })
export class LeprosyCase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'registered_by' }) registeredBy: string;
  @Column({ name: 'registration_date', type: 'date' }) registrationDate: string;
  @Column({ name: 'classification' }) classification: string;
  @Column({ name: 'ridley_jopling_type', nullable: true }) ridleyJoplingType: string;
  @Column({ name: 'bacteriological_index', type: 'decimal', precision: 3, scale: 1, nullable: true }) bacteriologicalIndex: number;
  @Column({ name: 'skin_smear_sites', nullable: true }) skinSmearSites: number;
  @Column({ name: 'right_eye_grade', nullable: true }) rightEyeGrade: number;
  @Column({ name: 'left_eye_grade', nullable: true }) leftEyeGrade: number;
  @Column({ name: 'right_hand_grade', nullable: true }) rightHandGrade: number;
  @Column({ name: 'left_hand_grade', nullable: true }) leftHandGrade: number;
  @Column({ name: 'right_foot_grade', nullable: true }) rightFootGrade: number;
  @Column({ name: 'left_foot_grade', nullable: true }) leftFootGrade: number;
  @Column({ name: 'max_disability_grade', nullable: true }) maxDisabilityGrade: number;
  @Column({ name: 'nfi_present', default: false }) nfiPresent: boolean;
  @Column({ name: 'nfi_nerves_affected', type: 'jsonb', default: [] }) nfiNervesAffected: string[];
  @Column({ name: 'nfi_motor_loss', default: false }) nfiMotorLoss: boolean;
  @Column({ name: 'nfi_sensory_loss', default: false }) nfiSensoryLoss: boolean;
  @Column({ name: 'mdt_regimen' }) mdtRegimen: string;
  @Column({ name: 'mdt_start_date', type: 'date', nullable: true }) mdtStartDate: string;
  @Column({ name: 'mdt_expected_completion', type: 'date', nullable: true }) mdtExpectedCompletion: string;
  @Column({ name: 'mdt_completed_date', type: 'date', nullable: true }) mdtCompletedDate: string;
  @Column({ name: 'rft_date', type: 'date', nullable: true }) rftDate: string;
  @Column({ name: 'monthly_supervised_doses', default: 0 }) monthlySupervisedDoses: number;
  @Column({ name: 'self_administered_doses', default: 0 }) selfAdministeredDoses: number;
  @Column({ name: 'doses_missed', default: 0 }) dosesMissed: number;
  @Column({ name: 'reaction_type', nullable: true }) reactionType: string;
  @Column({ name: 'reaction_start_date', type: 'date', nullable: true }) reactionStartDate: string;
  @Column({ name: 'reaction_treatment', nullable: true }) reactionTreatment: string;
  @Column({ name: 'reaction_dose', nullable: true }) reactionDose: string;
  @Column({ name: 'household_contacts_screened', default: 0 }) householdContactsScreened: number;
  @Column({ name: 'outcome', nullable: true }) outcome: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

**File: `services/ehr-service/src/ntd/entities/onchocerciasis-case.entity.ts`** — mirror pattern above using all `onchocerciasis_cases` columns (ov16Serology, skinSnipResult, ocularInvolvement, ivermectinDoseMg, mdaRound, lastIvermectinDate, etc.).

**File: `services/ehr-service/src/ntd/entities/filariasis-case.entity.ts`** — mirror pattern using all `filariasis_cases` columns (diseaseType, mfCountPerMl, lymphoedemaStage, hydrocele, decDoseMg, albendazoleDoseMg, treatmentSafe, treatmentContraindication, etc.).

### 3a. Register in `tenant.service.ts`

```typescript
import { LeprosyCase } from '../ehr/ntd/entities/leprosy-case.entity';
import { OnchocerciasisCase } from '../ehr/ntd/entities/onchocerciasis-case.entity';
import { FilariasisCase } from '../ehr/ntd/entities/filariasis-case.entity';
// Add to entities array: LeprosyCase, OnchocerciasisCase, FilariasisCase
```

---

## 4. CDSS Python Endpoints

```python
class LeprosyMdtRequest(BaseModel):
    classification: str                  # 'PB' | 'MB'
    ridley_jopling_type: Optional[str]
    nfi_present: bool
    nfi_nerves_affected: List[str]
    reaction_type: Optional[str]
    doses_completed: int
    doses_missed: int
    age_years: int
    pregnant: bool
    hiv_positive: bool

class LeprosyMdtResponse(BaseModel):
    mdt_regimen: str
    treatment_duration_months: int
    monthly_supervised_drugs: str        # rifampicin 600mg + clofazimine 300mg (MB) / rifampicin 600mg (PB)
    daily_self_drugs: str
    nfi_management: str
    reaction_management: str
    steroid_dose: Optional[str]
    compliance_threshold_pct: int
    disability_prevention_actions: List[str]
    contact_screening_required: bool
    confidence: float
    citations: List[str]

class FilariasisSafetyRequest(BaseModel):
    disease_type: str                    # 'lymphatic_wuchereria' | 'loiasis'
    loa_loa_mf_count: Optional[int]
    age_years: int
    weight_kg: float
    pregnant: bool
    epilepsy: bool
    lymphoedema_stage: Optional[int]

class FilariasisSafetyResponse(BaseModel):
    dec_safe: bool
    ivermectin_safe: bool
    albendazole_safe: bool
    contraindications: List[str]
    safety_rationale: str
    recommended_regimen: str
    dose_dec_mg: Optional[float]
    dose_ivermectin_mg: Optional[float]
    dose_albendazole_mg: Optional[float]
    pre_treatment_mf_count_required: bool
    morbidity_management: List[str]
    confidence: float
    citations: List[str]

@app.post("/cdss/ntd/leprosy-mdt")
async def leprosy_mdt_guidance(req: LeprosyMdtRequest):
    """
    WHO Leprosy MDT guidance: regimen selection, reaction management, disability prevention.
    Based on WHO 2018 Guidelines for the Diagnosis, Treatment and Prevention of Leprosy.
    """
    prompt = f"""
    You are a leprosy specialist using WHO 2018 Leprosy Guidelines and WHO MDT blister pack protocols.

    Patient:
    - Classification: {req.classification} ({req.ridley_jopling_type})
    - NFI: {req.nfi_present} — nerves: {req.nfi_nerves_affected}
    - Reaction: {req.reaction_type}
    - Treatment adherence: {req.doses_completed} doses completed, {req.doses_missed} missed
    - Age: {req.age_years}, Pregnant: {req.pregnant}, HIV+: {req.hiv_positive}

    Provide:
    1. MDT regimen (PB=rifampicin 600mg monthly supervised + dapsone 100mg daily x6; MB=rifampicin 600mg+clofazimine 300mg monthly + dapsone 100mg+clofazimine 50mg daily x12)
    2. NFI: if present → prednisolone 40mg/day tapering; nerve function assessment monthly
    3. Type 1 reversal: prednisolone 40-60mg/day tapering over 3-6 months; continue MDT
    4. Type 2 ENI: thalidomide 100-300mg/day (males only); clofazimine 100mg TID or prednisolone
    5. Disability prevention: foot care, protective footwear, eye drops, self-care education
    6. HIV co-infection: dapsone toxicity monitoring; consider cotrimoxazole interaction

    Return JSON: mdt_regimen, treatment_duration_months, monthly_supervised_drugs, daily_self_drugs,
    nfi_management, reaction_management, steroid_dose, compliance_threshold_pct,
    disability_prevention_actions (list), contact_screening_required, confidence (0-1), citations (list).
    """
    result = await call_governed_json(prompt, surface="leprosy_mdt", phi_present=True)
    return result

@app.post("/cdss/ntd/filariasis-safety")
async def filariasis_treatment_safety(req: FilariasisSafetyRequest):
    """
    Filariasis MDA drug safety check — critical for Loa loa co-endemicity where DEC/ivermectin
    cause fatal encephalopathy if Loa loa MF count > 8000/mL. Based on WHO 2017 LF Elimination Guidelines.
    """
    prompt = f"""
    You are an NTD specialist using WHO 2017 Lymphatic Filariasis Elimination Guidelines and
    WHO 2012 Loa loa safety guidelines for ivermectin MDA.

    Patient:
    - Disease: {req.disease_type}
    - Loa loa MF count: {req.loa_loa_mf_count} per mL (CRITICAL: >8000/mL → DEC AND ivermectin CONTRAINDICATED)
    - Age: {req.age_years}, Weight: {req.weight_kg} kg
    - Pregnant: {req.pregnant} (DEC contraindicated in pregnancy and children <2)
    - Epilepsy: {req.epilepsy}
    - Lymphoedema stage: {req.lymphoedema_stage}

    Safety rules:
    1. Loa loa MF > 8000/mL: BOTH DEC and ivermectin CONTRAINDICATED (risk of fatal encephalopathy)
    2. Loa loa MF 1000-8000/mL: ivermectin with extreme caution, close monitoring
    3. Pregnancy: DEC contraindicated; albendazole after 1st trimester only
    4. Children <2: albendazole + ivermectin; DEC only in LF-endemic (non-Loa loa) areas
    5. LF regimen: DEC 6mg/kg/day x12 days (single agent) OR albendazole 400mg + DEC/ivermectin single dose MDA

    Return JSON: dec_safe, ivermectin_safe, albendazole_safe, contraindications (list), safety_rationale,
    recommended_regimen, dose_dec_mg, dose_ivermectin_mg, dose_albendazole_mg,
    pre_treatment_mf_count_required, morbidity_management (list), confidence (0-1), citations (list).
    """
    result = await call_governed_json(prompt, surface="filariasis_safety", phi_present=True)
    return result
```

---

## 5. NestJS Service + Controller

**File: `services/ehr-service/src/ntd/ntd-depth.service.ts`**

Implement methods:
- `registerLeprosyCase(dto)` — save + call CDSS leprosy-mdt; store regimen guidance on record
- `getLeprosyCases()` / `getLeprosyCase(id)`
- `updateLeprosyCase(id, dto)` — update MDT progress (doses, reaction)
- `getLeprosyMdtGuidance(id)` — call CDSS with current case data
- `registerOnchocerciasisCase(dto)` / `getOnchocerciasisCases()` / `updateOnchocerciasisCase(id, dto)`
- `registerFilariasisCase(dto)` — save + call CDSS filariasis-safety; flag unsafe treatment
- `getFilariasisCases()` / `updateFilariasisCase(id, dto)`
- `getFilariasisSafety(id)` — call CDSS with MF count and patient data
- `getNtdSummary()` — counts by disease type

All CDSS calls use `this.cdssService.callGovernedJson(...)`. Handle `abstained: true`.

**File: `services/ehr-service/src/ntd/ntd-depth.controller.ts`**

Routes:
```
POST   /ntd/leprosy
GET    /ntd/leprosy
PATCH  /ntd/leprosy/:id
POST   /ntd/leprosy/:id/mdt-guidance
POST   /ntd/onchocerciasis
GET    /ntd/onchocerciasis
PATCH  /ntd/onchocerciasis/:id
POST   /ntd/filariasis
GET    /ntd/filariasis
PATCH  /ntd/filariasis/:id
POST   /ntd/filariasis/:id/safety-check
GET    /ntd/summary
```

All routes protected with `JwtAuthGuard` + `RolesGuard`. Roles: `doctor`, `nurse`, `public_health`.

**File: `services/ehr-service/src/ntd/ntd-depth.module.ts`** — standard pattern; import `CdssModule`; export `NtdDepthService`.

Register `NtdDepthModule` in `ehr.module.ts`.

---

## 6. Frontend

### API in `ehr-frontend/src/services/api.ts`

```typescript
export const ntdDepthApi = {
  registerLeprosy: (d: any) => api.post('/ntd/leprosy', d),
  getLeprosyCases: () => api.get('/ntd/leprosy'),
  updateLeprosy: (id: string, d: any) => api.patch(`/ntd/leprosy/${id}`, d),
  getLeprosyGuidance: (id: string) => api.post(`/ntd/leprosy/${id}/mdt-guidance`, {}),
  registerOncho: (d: any) => api.post('/ntd/onchocerciasis', d),
  getOnchoCases: () => api.get('/ntd/onchocerciasis'),
  updateOncho: (id: string, d: any) => api.patch(`/ntd/onchocerciasis/${id}`, d),
  registerFilariasis: (d: any) => api.post('/ntd/filariasis', d),
  getFilariasisCases: () => api.get('/ntd/filariasis'),
  updateFilariasis: (id: string, d: any) => api.patch(`/ntd/filariasis/${id}`, d),
  getFilariasisSafety: (id: string) => api.post(`/ntd/filariasis/${id}/safety-check`, {}),
  getNtdSummary: () => api.get('/ntd/summary'),
};
```

### Component Spec — `NtdDepthDashboard.tsx`

Three tabs:

1. **Leprosy MDT** — Registration form (classification PB/MB, Ridley-Jopling type, NFI checkbox + nerve selector). MDT tracker showing: doses given vs expected, "Get MDT Guidance" button → CDSS panel with regimen, reaction management, disability actions, confidence. Red alert if doses_missed > 2.

2. **Onchocerciasis / MDA** — Registration form (Ov16 serology, skin snip result, MF count, ocular involvement). MDA tracking table (round, dose, date, administered by). CDSS: no separate endpoint needed — display standard ESPEN MDA guidance inline based on MF count.

3. **Filariasis** — Registration form (disease type selector, Loa loa MF count field prominently labelled "⚠️ Required for safety check if from Loa loa co-endemic area"). "Safety Check" button calls CDSS; displays: drug safety flags (green/red per drug), contraindications list, recommended regimen, confidence. If `dec_safe: false` or `ivermectin_safe: false` → prominent red banner "CONTRAINDICATED — See CDSS guidance".

Wire into NTD section of public health dashboard.

---

## 7. Post-Implementation Steps

```bash
docker compose build tenant-service
./scripts/provision-repair-all.sh
# Fallback: curl -X POST http://localhost:3001/admin/tenants/repair-all -H "Authorization: Bearer <token>"

psql $DATABASE_URL -c "\d leprosy_cases"
psql $DATABASE_URL -c "\d onchocerciasis_cases"
psql $DATABASE_URL -c "\d filariasis_cases"

npx tsc --noEmit

curl -X POST http://localhost:8000/cdss/ntd/filariasis-safety \
  -H "Content-Type: application/json" \
  -d '{"disease_type":"loiasis","loa_loa_mf_count":12000,"age_years":35,"weight_kg":65,"pregnant":false,"epilepsy":false,"lymphoedema_stage":0}'

npm run lint

git add services/tenant-service/src/generated/tenant-ntd-clinical-depth.statements.ts \
        services/ehr-service/src/ntd/ \
        ehr-frontend/src/services/api.ts \
        ehr-frontend/src/components/NtdDepthDashboard.tsx
git commit -m "feat: implement Sprint 153 — NTD clinical depth (leprosy MDT, onchocerciasis, filariasis)"
```

---

## 8. Done-When Checklist

- [ ] `tenant-ntd-clinical-depth.statements.ts` with 3 tables (idempotent SQL)
- [ ] Bundle registered in `database-provisioning.service.ts`
- [ ] `LeprosyCase`, `OnchocerciasisCase`, `FilariasisCase` TypeORM entities
- [ ] All 3 entities in `tenant.service.ts`
- [ ] `NtdDepthModule` created and in `ehr.module.ts`
- [ ] `NtdDepthService` with all 12 methods; CDSS calls non-blocking
- [ ] `NtdDepthController` with 12 routes
- [ ] CDSS `POST /cdss/ntd/leprosy-mdt` — WHO MDT regimen + reaction management
- [ ] CDSS `POST /cdss/ntd/filariasis-safety` — Loa loa MF threshold safety gate
- [ ] Filariasis: DEC/ivermectin contraindication displayed as red banner when triggered
- [ ] `ntdDepthApi` in `api.ts`
- [ ] `NtdDepthDashboard.tsx` — 3 tabs with CDSS integration
- [ ] `provision-repair-all.sh` clean; all tables exist
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 153 — NTD clinical depth (leprosy MDT, onchocerciasis, filariasis)`
