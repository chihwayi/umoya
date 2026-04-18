# Sprint 150 — Mpox, Ebola & Viral Haemorrhagic Fever Case Management

**Sprint**: S150  
**Module**: VHF Surveillance, Mpox Clinical Management, Contact Tracing, IPC Protocols  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint150_vhf_case_management`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

Mpox re-emerged as a WHO PHEIC in 2022 and again in 2024, with Clade Ib spreading across DRC, Uganda, Rwanda, Burundi, and Kenya. Ebola, Marburg, Lassa Fever, and Rift Valley Fever remain endemic threats across the African continent. MediCore has no VHF case detection, contact tracing, IPC protocol enforcement, or WHO IHR notification workflow. This sprint closes that critical biosecurity gap.

| Pathogen | AFRO Risk | Missing in MediCore |
|---|---|---|
| Mpox (Clade I/II) | WHO PHEIC 2024; DRC-adjacent spread | No case detection, no lesion assessment, no antiviral tracking |
| Ebola/Marburg VHF | West/Central/East Africa endemic | No suspected case form, no contact list, no isolation workflow |
| Lassa Fever | West Africa (Nigeria/Sierra Leone) | No ribavirin protocol, no lab PCR bridge |
| Rift Valley Fever | East/Southern Africa livestock-linked | No exposure history, no case register |

### What already exists (do NOT recreate)

- `Patient` entity, `PatientService` — injectable
- `NotificationService` — for staff alerts
- `CdssService` with `callGovernedJson()` and `requestWithPolicy()`
- `ehr.module.ts`, `tenant.service.ts` — register entities here
- `database-provisioning.service.ts` — register bundle here

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-vhf-case-management.statements.ts`**

```typescript
export const TENANT_VHF_CASE_MANAGEMENT_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_VHF_CASE_MANAGEMENT_STATEMENTS: string[] = [

  // ── VHF Cases ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS vhf_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    reported_by UUID NOT NULL,
    -- Pathogen
    pathogen TEXT NOT NULL,              -- 'mpox_clade_i' | 'mpox_clade_ii' | 'ebola' | 'marburg' | 'lassa' | 'rvf' | 'crimean_congo'
    pathogen_clade TEXT,                 -- for mpox: 'Ia' | 'Ib' | 'IIa' | 'IIb'
    -- Exposure history
    exposure_date DATE,
    exposure_type TEXT,                  -- 'animal_contact' | 'human_contact' | 'healthcare_worker' | 'unknown'
    travel_history JSONB DEFAULT '[]',   -- [{country, city, date_from, date_to}]
    animal_exposure JSONB DEFAULT '[]',  -- [{species, date, type}]
    -- Clinical timeline
    symptom_onset_date DATE,
    date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Classification
    classification TEXT NOT NULL DEFAULT 'suspected',  -- 'suspected' | 'probable' | 'confirmed' | 'discarded'
    case_definition_met TEXT,            -- free text: which WHO criteria met
    -- Isolation
    isolation_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'isolated' | 'home_isolation' | 'discharged'
    isolation_start_date TIMESTAMP,
    isolation_location TEXT,             -- ward/room
    ppe_protocol_followed BOOLEAN NOT NULL DEFAULT false,
    ppe_breaches_noted TEXT,
    -- Lab
    specimen_collected BOOLEAN NOT NULL DEFAULT false,
    specimen_collection_date TIMESTAMP,
    specimen_type TEXT,                  -- 'swab' | 'blood' | 'lesion_fluid'
    lab_pcr_result TEXT,                 -- 'positive' | 'negative' | 'indeterminate' | 'pending'
    lab_result_date TIMESTAMP,
    lab_cycle_threshold DECIMAL(5,2),    -- Ct value for PCR
    -- Contacts
    contacts_listed INTEGER NOT NULL DEFAULT 0,
    contacts_under_followup INTEGER NOT NULL DEFAULT 0,
    -- WHO IHR Notification
    notified_district_health BOOLEAN NOT NULL DEFAULT false,
    notified_national_health BOOLEAN NOT NULL DEFAULT false,
    notified_who BOOLEAN NOT NULL DEFAULT false,
    notified_at TIMESTAMP,
    who_event_id TEXT,
    -- Outcome
    outcome TEXT,                        -- 'recovered' | 'died' | 'transferred' | 'under_care'
    outcome_date DATE,
    case_fatality BOOLEAN NOT NULL DEFAULT false,
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_vhf_cases_patient ON vhf_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vhf_cases_pathogen ON vhf_cases(pathogen)`,
  `CREATE INDEX IF NOT EXISTS idx_vhf_cases_classification ON vhf_cases(classification)`,
  `CREATE INDEX IF NOT EXISTS idx_vhf_cases_reported ON vhf_cases(date_reported)`,

  // ── VHF Contacts ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS vhf_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vhf_cases(id) ON DELETE CASCADE,
    -- Contact identity (may not be a registered patient)
    contact_name TEXT NOT NULL,
    contact_phone TEXT,
    contact_address TEXT,
    contact_type TEXT NOT NULL,          -- 'household' | 'healthcare_worker' | 'community' | 'sexual'
    relationship TEXT,                   -- 'spouse' | 'child' | 'colleague' | 'neighbour' | other
    -- Exposure window
    first_exposure_date DATE NOT NULL,
    last_exposure_date DATE NOT NULL,
    exposure_nature TEXT,                -- 'direct_contact' | 'bodily_fluids' | 'same_room_no_ppe' | 'ppe_protected'
    -- Monitoring
    monitoring_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    monitoring_end_date DATE NOT NULL,   -- typically last_exposure_date + 21 days
    daily_symptoms JSONB DEFAULT '[]',   -- [{date, fever, rash, fatigue, reported_by}]
    -- Status
    status TEXT NOT NULL DEFAULT 'under_monitoring',  -- 'under_monitoring' | 'cleared' | 'became_case' | 'lost_to_followup'
    became_case_id UUID REFERENCES vhf_cases(id),
    -- CHW assignment
    assigned_chw_id UUID,
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_vhf_contacts_case ON vhf_contacts(case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vhf_contacts_status ON vhf_contacts(status)`,
  `CREATE INDEX IF NOT EXISTS idx_vhf_contacts_monitoring_end ON vhf_contacts(monitoring_end_date)`,

  // ── Mpox Lesion Assessments ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS mpox_lesion_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    vhf_case_id UUID REFERENCES vhf_cases(id),
    assessed_by UUID NOT NULL,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Clinical stage
    stage TEXT NOT NULL,                 -- 'prodrome' | 'macules' | 'papules' | 'vesicles' | 'pustules' | 'crusting' | 'resolving'
    day_of_illness INTEGER,
    -- Lesion characterisation
    lesion_count_estimate INTEGER,       -- total body count
    lesion_count_category TEXT,          -- 'few_<10' | 'moderate_10-100' | 'many_>100'
    lesion_distribution JSONB DEFAULT '{}', -- {face, trunk, arms, legs, palms, soles, genitalia, oral_mucosa} each: true/false
    lesion_depth TEXT,                   -- 'superficial' | 'deep' | 'umbilicated'
    lesion_synchrony TEXT,               -- 'all_same_stage' | 'different_stages'
    -- Complications
    secondary_bacterial_infection BOOLEAN NOT NULL DEFAULT false,
    corneal_involvement BOOLEAN NOT NULL DEFAULT false,
    respiratory_involvement BOOLEAN NOT NULL DEFAULT false,
    encephalitis BOOLEAN NOT NULL DEFAULT false,
    genital_lesions BOOLEAN NOT NULL DEFAULT false,
    proctitis BOOLEAN NOT NULL DEFAULT false,
    complications_notes TEXT,
    -- CNSI / neurological
    cns_involvement BOOLEAN NOT NULL DEFAULT false,
    cns_symptoms JSONB DEFAULT '[]',     -- ['confusion', 'seizure', 'meningism']
    -- Treatment
    antiviral_indicated BOOLEAN NOT NULL DEFAULT false,
    antiviral_drug TEXT,                 -- 'tecovirimat' | 'brincidofovir' | 'cidofovir'
    antiviral_start_date DATE,
    antiviral_dose TEXT,
    supportive_care JSONB DEFAULT '[]',  -- ['wound_care', 'pain_management', 'hydration']
    -- Severity score (1-10, CDSS-computed)
    cdss_severity_score DECIMAL(3,1),
    cdss_recommendation TEXT,
    cdss_confidence DECIMAL(4,3),
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_mpox_lesion_patient ON mpox_lesion_assessments(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mpox_lesion_case ON mpox_lesion_assessments(vhf_case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mpox_lesion_date ON mpox_lesion_assessments(assessment_date)`,

];
```

### 2b. Register Bundle in `database-provisioning.service.ts`

In `services/tenant-service/src/database-provisioning.service.ts`, add to the `provisioningBundles` array:

```typescript
import {
  TENANT_VHF_CASE_MANAGEMENT_BUNDLE_VERSION,
  TENANT_VHF_CASE_MANAGEMENT_STATEMENTS,
} from './generated/tenant-vhf-case-management.statements';

// Inside the bundles array:
{
  id: 'sprint150_vhf_case_management',
  label: 'Sprint 150 — Mpox / Ebola / VHF Case Management',
  version: TENANT_VHF_CASE_MANAGEMENT_BUNDLE_VERSION,
  description: 'Creates vhf_cases, vhf_contacts, mpox_lesion_assessments tables',
  statements: TENANT_VHF_CASE_MANAGEMENT_STATEMENTS,
},
```

---

## 3. TypeORM Entities

**File: `services/ehr-service/src/vhf/entities/vhf-case.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { VhfContact } from './vhf-contact.entity';
import { MpoxLesionAssessment } from './mpox-lesion-assessment.entity';

@Entity({ name: 'vhf_cases' })
export class VhfCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'reported_by' })
  reportedBy: string;

  @Column({ name: 'pathogen' })
  pathogen: string;

  @Column({ name: 'pathogen_clade', nullable: true })
  pathogenClade: string;

  @Column({ name: 'exposure_date', type: 'date', nullable: true })
  exposureDate: string;

  @Column({ name: 'exposure_type', nullable: true })
  exposureType: string;

  @Column({ name: 'travel_history', type: 'jsonb', default: [] })
  travelHistory: object[];

  @Column({ name: 'animal_exposure', type: 'jsonb', default: [] })
  animalExposure: object[];

  @Column({ name: 'symptom_onset_date', type: 'date', nullable: true })
  symptomOnsetDate: string;

  @Column({ name: 'date_reported', type: 'date' })
  dateReported: string;

  @Column({ name: 'classification', default: 'suspected' })
  classification: string;

  @Column({ name: 'case_definition_met', nullable: true })
  caseDefinitionMet: string;

  @Column({ name: 'isolation_status', default: 'pending' })
  isolationStatus: string;

  @Column({ name: 'isolation_start_date', type: 'timestamp', nullable: true })
  isolationStartDate: Date;

  @Column({ name: 'isolation_location', nullable: true })
  isolationLocation: string;

  @Column({ name: 'ppe_protocol_followed', default: false })
  ppeProtocolFollowed: boolean;

  @Column({ name: 'ppe_breaches_noted', nullable: true })
  ppeBReachesNoted: string;

  @Column({ name: 'specimen_collected', default: false })
  specimenCollected: boolean;

  @Column({ name: 'specimen_collection_date', type: 'timestamp', nullable: true })
  specimenCollectionDate: Date;

  @Column({ name: 'specimen_type', nullable: true })
  specimenType: string;

  @Column({ name: 'lab_pcr_result', nullable: true })
  labPcrResult: string;

  @Column({ name: 'lab_result_date', type: 'timestamp', nullable: true })
  labResultDate: Date;

  @Column({ name: 'lab_cycle_threshold', type: 'decimal', precision: 5, scale: 2, nullable: true })
  labCycleThreshold: number;

  @Column({ name: 'contacts_listed', default: 0 })
  contactsListed: number;

  @Column({ name: 'contacts_under_followup', default: 0 })
  contactsUnderFollowup: number;

  @Column({ name: 'notified_district_health', default: false })
  notifiedDistrictHealth: boolean;

  @Column({ name: 'notified_national_health', default: false })
  notifiedNationalHealth: boolean;

  @Column({ name: 'notified_who', default: false })
  notifiedWho: boolean;

  @Column({ name: 'notified_at', type: 'timestamp', nullable: true })
  notifiedAt: Date;

  @Column({ name: 'who_event_id', nullable: true })
  whoEventId: string;

  @Column({ name: 'outcome', nullable: true })
  outcome: string;

  @Column({ name: 'outcome_date', type: 'date', nullable: true })
  outcomeDate: string;

  @Column({ name: 'case_fatality', default: false })
  caseFatality: boolean;

  @OneToMany(() => VhfContact, c => c.case)
  contacts: VhfContact[];

  @OneToMany(() => MpoxLesionAssessment, a => a.vhfCase)
  lesionAssessments: MpoxLesionAssessment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**File: `services/ehr-service/src/vhf/entities/vhf-contact.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { VhfCase } from './vhf-case.entity';

@Entity({ name: 'vhf_contacts' })
export class VhfContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id' })
  caseId: string;

  @ManyToOne(() => VhfCase, c => c.contacts)
  @JoinColumn({ name: 'case_id' })
  case: VhfCase;

  @Column({ name: 'contact_name' })
  contactName: string;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone: string;

  @Column({ name: 'contact_address', nullable: true })
  contactAddress: string;

  @Column({ name: 'contact_type' })
  contactType: string;

  @Column({ name: 'relationship', nullable: true })
  relationship: string;

  @Column({ name: 'first_exposure_date', type: 'date' })
  firstExposureDate: string;

  @Column({ name: 'last_exposure_date', type: 'date' })
  lastExposureDate: string;

  @Column({ name: 'exposure_nature', nullable: true })
  exposureNature: string;

  @Column({ name: 'monitoring_start_date', type: 'date' })
  monitoringStartDate: string;

  @Column({ name: 'monitoring_end_date', type: 'date' })
  monitoringEndDate: string;

  @Column({ name: 'daily_symptoms', type: 'jsonb', default: [] })
  dailySymptoms: object[];

  @Column({ name: 'status', default: 'under_monitoring' })
  status: string;

  @Column({ name: 'became_case_id', nullable: true })
  becameCaseId: string;

  @Column({ name: 'assigned_chw_id', nullable: true })
  assignedChwId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**File: `services/ehr-service/src/vhf/entities/mpox-lesion-assessment.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { VhfCase } from './vhf-case.entity';

@Entity({ name: 'mpox_lesion_assessments' })
export class MpoxLesionAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'vhf_case_id', nullable: true })
  vhfCaseId: string;

  @ManyToOne(() => VhfCase, c => c.lesionAssessments, { nullable: true })
  @JoinColumn({ name: 'vhf_case_id' })
  vhfCase: VhfCase;

  @Column({ name: 'assessed_by' })
  assessedBy: string;

  @Column({ name: 'assessment_date', type: 'date' })
  assessmentDate: string;

  @Column({ name: 'stage' })
  stage: string;

  @Column({ name: 'day_of_illness', nullable: true })
  dayOfIllness: number;

  @Column({ name: 'lesion_count_estimate', nullable: true })
  lesionCountEstimate: number;

  @Column({ name: 'lesion_count_category', nullable: true })
  lesionCountCategory: string;

  @Column({ name: 'lesion_distribution', type: 'jsonb', default: {} })
  lesionDistribution: object;

  @Column({ name: 'lesion_depth', nullable: true })
  lesionDepth: string;

  @Column({ name: 'lesion_synchrony', nullable: true })
  lesionSynchrony: string;

  @Column({ name: 'secondary_bacterial_infection', default: false })
  secondaryBacterialInfection: boolean;

  @Column({ name: 'corneal_involvement', default: false })
  cornealInvolvement: boolean;

  @Column({ name: 'respiratory_involvement', default: false })
  respiratoryInvolvement: boolean;

  @Column({ name: 'encephalitis', default: false })
  encephalitis: boolean;

  @Column({ name: 'genital_lesions', default: false })
  genitalLesions: boolean;

  @Column({ name: 'proctitis', default: false })
  proctitis: boolean;

  @Column({ name: 'complications_notes', nullable: true })
  complicationsNotes: string;

  @Column({ name: 'cns_involvement', default: false })
  cnsInvolvement: boolean;

  @Column({ name: 'cns_symptoms', type: 'jsonb', default: [] })
  cnsSymptoms: string[];

  @Column({ name: 'antiviral_indicated', default: false })
  antiviralIndicated: boolean;

  @Column({ name: 'antiviral_drug', nullable: true })
  antiviralDrug: string;

  @Column({ name: 'antiviral_start_date', type: 'date', nullable: true })
  antiviralStartDate: string;

  @Column({ name: 'antiviral_dose', nullable: true })
  antiviralDose: string;

  @Column({ name: 'supportive_care', type: 'jsonb', default: [] })
  supportiveCare: string[];

  @Column({ name: 'cdss_severity_score', type: 'decimal', precision: 3, scale: 1, nullable: true })
  cdssSeverityScore: number;

  @Column({ name: 'cdss_recommendation', nullable: true })
  cdssRecommendation: string;

  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true })
  cdssConfidence: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 3a. Register entities in `tenant.service.ts`

In `services/tenant-service/src/tenant.service.ts`, add to the `entities` array:

```typescript
import { VhfCase } from '../ehr/vhf/entities/vhf-case.entity';
import { VhfContact } from '../ehr/vhf/entities/vhf-contact.entity';
import { MpoxLesionAssessment } from '../ehr/vhf/entities/mpox-lesion-assessment.entity';

// Add to entities array:
VhfCase,
VhfContact,
MpoxLesionAssessment,
```

---

## 4. CDSS Python Endpoints

**File: `services/cdss-service/main.py`** — add these endpoints:

```python
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from fastapi import APIRouter

# ── Request / Response models ──────────────────────────────────────────────────

class VhfRiskTriageRequest(BaseModel):
    pathogen: str                           # 'mpox_clade_i' | 'ebola' | 'marburg' | 'lassa' | 'rvf'
    symptom_onset_days: Optional[int]
    fever: bool
    rash: bool
    haemorrhage: bool
    vomiting: bool
    diarrhoea: bool
    myalgia: bool
    headache: bool
    pharyngitis: bool
    travel_endemic_area: bool
    animal_contact: bool
    contact_with_vhf_case: bool
    healthcare_worker: bool
    lab_pcr_result: Optional[str]           # 'positive' | 'negative' | 'pending' | None
    age_years: int
    immunocompromised: bool
    pregnant: bool

class VhfRiskTriageResponse(BaseModel):
    classification: str                     # 'suspected' | 'probable' | 'confirmed' | 'low_risk'
    risk_level: str                         # 'critical' | 'high' | 'moderate' | 'low'
    isolation_required: bool
    ppe_level: str                          # 'standard' | 'droplet' | 'airborne_contact' | 'enhanced_vhf'
    notifiable: bool
    notify_within_hours: int                # 0=immediate, 24, 72
    recommended_specimens: List[str]
    immediate_actions: List[str]
    treatment_guidance: str
    prognosis_notes: str
    confidence: float
    citations: List[str]

class MpoxSeverityRequest(BaseModel):
    stage: str                              # 'prodrome' | 'macules' | 'papules' | 'vesicles' | 'pustules' | 'crusting'
    day_of_illness: int
    lesion_count_category: str             # 'few_<10' | 'moderate_10-100' | 'many_>100'
    mucocutaneous_sites: List[str]         # ['oral', 'genital', 'anal', 'conjunctival']
    corneal_involvement: bool
    respiratory_involvement: bool
    secondary_infection: bool
    cns_involvement: bool
    immunocompromised: bool
    hiv_positive: bool
    age_years: int
    pregnant: bool
    clade: Optional[str]                   # 'Ia' | 'Ib' | 'IIa' | 'IIb'

class MpoxSeverityResponse(BaseModel):
    severity_score: float                  # 0-10
    severity_category: str                 # 'mild' | 'moderate' | 'severe' | 'critical'
    antiviral_indicated: bool
    antiviral_drug: Optional[str]          # 'tecovirimat' | 'brincidofovir'
    antiviral_dose: Optional[str]
    hospitalisation_required: bool
    icu_risk: bool
    isolation_duration_days: int
    care_principles: List[str]
    monitoring_parameters: List[str]
    confidence: float
    citations: List[str]

# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/cdss/vhf/risk-triage", response_model=VhfRiskTriageResponse)
async def vhf_risk_triage(req: VhfRiskTriageRequest):
    """
    WHO VHF Case Definition triage.
    Classifies suspected/probable/confirmed based on epidemiological + clinical criteria.
    Outputs isolation level, PPE requirement, notification urgency, specimen recommendations.
    """
    prompt = f"""
    You are a WHO VHF surveillance expert trained on the 2022 WHO Mpox Clinical Management and Infection Prevention guidelines,
    2018 WHO Ebola case definition, and IHR 2005 Annex 2 decision tree.

    Patient profile:
    - Pathogen concern: {req.pathogen}
    - Symptoms (days since onset): {req.symptom_onset_days}
    - Fever: {req.fever}, Rash: {req.rash}, Haemorrhage: {req.haemorrhage}
    - Vomiting: {req.vomiting}, Diarrhoea: {req.diarrhoea}, Myalgia: {req.myalgia}
    - Headache: {req.headache}, Pharyngitis: {req.pharyngitis}
    - Epidemiological links: Travel endemic area: {req.travel_endemic_area}, Animal contact: {req.animal_contact}
    - Contact with VHF case: {req.contact_with_vhf_case}, Healthcare worker: {req.healthcare_worker}
    - Lab PCR: {req.lab_pcr_result}
    - Age: {req.age_years}, Immunocompromised: {req.immunocompromised}, Pregnant: {req.pregnant}

    Apply:
    1. WHO Mpox case definition (suspected = compatible clinical + epi link; probable = compatible + rapid Ag+; confirmed = PCR+)
    2. VHF haemorrhagic fever IHR Annex 2 decision algorithm
    3. Africa CDC PPE guidance for VHF (enhanced VHF precautions = gown + gloves + N95 + face shield + boot covers)
    4. WHO IHR 24-hour notification if PHEIC-relevant pathogen confirmed or probable

    Return JSON with keys: classification, risk_level, isolation_required, ppe_level, notifiable, notify_within_hours,
    recommended_specimens (list), immediate_actions (list), treatment_guidance, prognosis_notes, confidence (0-1), citations (list).
    """
    result = await call_governed_json(prompt, surface="vhf_risk_triage", phi_present=True)
    return result

@app.post("/cdss/vhf/mpox-severity", response_model=MpoxSeverityResponse)
async def mpox_severity_assessment(req: MpoxSeverityRequest):
    """
    Mpox severity scoring and antiviral indication assessment.
    Based on WHO 2022 Mpox Clinical Management guidelines and ACAM2000/tecovirimat compassionate use criteria.
    """
    prompt = f"""
    You are a clinical expert in Mpox management using the 2022 WHO Mpox Clinical Management guidelines
    and the UKHSA Mpox Clinical Guidance 2022.

    Patient:
    - Disease stage: {req.stage} (day {req.day_of_illness})
    - Lesion burden: {req.lesion_count_category}
    - Mucocutaneous sites: {req.mucocutaneous_sites}
    - Severe complications: corneal={req.corneal_involvement}, respiratory={req.respiratory_involvement},
      secondary_infection={req.secondary_infection}, CNS={req.cns_involvement}
    - Host factors: immunocompromised={req.immunocompromised}, HIV={req.hiv_positive},
      age={req.age_years}, pregnant={req.pregnant}
    - Clade: {req.clade}

    Determine:
    1. Severity score 0-10 (mild <4, moderate 4-6, severe 7-8, critical 9-10)
    2. Tecovirimat indication (WHO criteria: severe disease, immunocompromised, ocular/CNS involvement, clade I)
    3. Hospitalisation need (severe pain, inability to eat/drink, secondary infection, respiratory compromise)
    4. Isolation duration (21 days from onset OR until all lesions crusted, whichever longer)
    5. Monitoring parameters

    Return JSON: severity_score, severity_category, antiviral_indicated, antiviral_drug, antiviral_dose,
    hospitalisation_required, icu_risk, isolation_duration_days, care_principles (list), monitoring_parameters (list),
    confidence (0-1), citations (list).
    """
    result = await call_governed_json(prompt, surface="mpox_severity_assessment", phi_present=True)
    return result
```

---

## 5. NestJS Service

**File: `services/ehr-service/src/vhf/vhf.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VhfCase } from './entities/vhf-case.entity';
import { VhfContact } from './entities/vhf-contact.entity';
import { MpoxLesionAssessment } from './entities/mpox-lesion-assessment.entity';
import { CdssService } from '../cdss/cdss.service';

@Injectable()
export class VhfService {
  constructor(
    @InjectRepository(VhfCase)
    private vhfCaseRepo: Repository<VhfCase>,
    @InjectRepository(VhfContact)
    private contactRepo: Repository<VhfContact>,
    @InjectRepository(MpoxLesionAssessment)
    private lesionRepo: Repository<MpoxLesionAssessment>,
    private cdssService: CdssService,
  ) {}

  async reportCase(dto: Partial<VhfCase>): Promise<VhfCase> {
    const saved = await this.vhfCaseRepo.save(this.vhfCaseRepo.create(dto));

    // Auto-trigger CDSS triage on every new case
    try {
      const cdssInput = {
        pathogen: saved.pathogen,
        symptom_onset_days: saved.symptomOnsetDate
          ? Math.floor((Date.now() - new Date(saved.symptomOnsetDate).getTime()) / 86400000)
          : null,
        fever: true,
        rash: saved.pathogen.startsWith('mpox'),
        haemorrhage: ['ebola', 'marburg', 'lassa', 'rvf', 'crimean_congo'].includes(saved.pathogen),
        vomiting: false,
        diarrhoea: false,
        myalgia: false,
        headache: false,
        pharyngitis: false,
        travel_endemic_area: (saved.travelHistory as object[]).length > 0,
        animal_contact: (saved.animalExposure as object[]).length > 0,
        contact_with_vhf_case: false,
        healthcare_worker: false,
        lab_pcr_result: saved.labPcrResult ?? null,
        age_years: 30,
        immunocompromised: false,
        pregnant: false,
      };
      await this.cdssService.requestWithPolicy('POST', '/cdss/vhf/risk-triage', cdssInput, 'vhf_risk_triage');
    } catch {
      // Non-blocking — case saved regardless
    }

    return saved;
  }

  async getCases(filters?: { pathogen?: string; classification?: string }): Promise<VhfCase[]> {
    const qb = this.vhfCaseRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.contacts', 'contacts')
      .orderBy('c.dateReported', 'DESC');
    if (filters?.pathogen) qb.andWhere('c.pathogen = :pathogen', { pathogen: filters.pathogen });
    if (filters?.classification) qb.andWhere('c.classification = :classification', { classification: filters.classification });
    return qb.getMany();
  }

  async getCase(id: string): Promise<VhfCase> {
    return this.vhfCaseRepo.findOneOrFail({ where: { id }, relations: ['contacts', 'lesionAssessments'] });
  }

  async updateCase(id: string, dto: Partial<VhfCase>): Promise<VhfCase> {
    await this.vhfCaseRepo.update(id, dto);
    return this.getCase(id);
  }

  async addContact(caseId: string, dto: Partial<VhfContact>): Promise<VhfContact> {
    const vhfCase = await this.getCase(caseId);
    const contact = this.contactRepo.create({ ...dto, caseId });
    const saved = await this.contactRepo.save(contact);
    await this.vhfCaseRepo.update(caseId, { contactsListed: (vhfCase.contactsListed ?? 0) + 1 });
    return saved;
  }

  async getContacts(caseId: string): Promise<VhfContact[]> {
    return this.contactRepo.find({ where: { caseId }, order: { monitoringEndDate: 'ASC' } });
  }

  async updateContactStatus(contactId: string, status: string, becameCaseId?: string): Promise<VhfContact> {
    await this.contactRepo.update(contactId, { status, ...(becameCaseId ? { becameCaseId } : {}) });
    return this.contactRepo.findOneOrFail({ where: { id: contactId } });
  }

  async recordLesionAssessment(dto: Partial<MpoxLesionAssessment>): Promise<MpoxLesionAssessment> {
    const saved = await this.lesionRepo.save(this.lesionRepo.create(dto));

    // CDSS severity scoring
    try {
      const cdssResult = await this.cdssService.callGovernedJson('/cdss/vhf/mpox-severity', {
        stage: saved.stage,
        day_of_illness: saved.dayOfIllness ?? 0,
        lesion_count_category: saved.lesionCountCategory ?? 'few_<10',
        mucocutaneous_sites: saved.lesionDistribution ?? [],
        corneal_involvement: saved.cornealInvolvement,
        respiratory_involvement: saved.respiratoryInvolvement,
        secondary_infection: saved.secondaryBacterialInfection,
        cns_involvement: saved.cnsInvolvement,
        immunocompromised: false,
        hiv_positive: false,
        age_years: 30,
        pregnant: false,
        clade: null,
      });
      if (cdssResult && !cdssResult.abstained) {
        await this.lesionRepo.update(saved.id, {
          cdssSeverityScore: cdssResult.result?.severity_score,
          cdssRecommendation: cdssResult.result?.care_principles?.join('; '),
          cdssConfidence: cdssResult.confidence,
        });
        saved.cdssSeverityScore = cdssResult.result?.severity_score;
        saved.cdssRecommendation = cdssResult.result?.care_principles?.join('; ');
        saved.cdssConfidence = cdssResult.confidence;
      }
    } catch {
      // Non-blocking
    }

    return saved;
  }

  async getLesionHistory(patientId: string): Promise<MpoxLesionAssessment[]> {
    return this.lesionRepo.find({ where: { patientId }, order: { assessmentDate: 'DESC' } });
  }

  async triageCase(caseId: string, triageDto: object): Promise<object> {
    const vhfCase = await this.getCase(caseId);
    return this.cdssService.callGovernedJson('/cdss/vhf/risk-triage', {
      pathogen: vhfCase.pathogen,
      ...triageDto,
    });
  }

  async getActiveSurveillanceSummary(): Promise<object> {
    const [total, suspected, confirmed, contacts] = await Promise.all([
      this.vhfCaseRepo.count(),
      this.vhfCaseRepo.count({ where: { classification: 'suspected' } }),
      this.vhfCaseRepo.count({ where: { classification: 'confirmed' } }),
      this.contactRepo.count({ where: { status: 'under_monitoring' } }),
    ]);
    return { total, suspected, confirmed, contactsUnderMonitoring: contacts };
  }
}
```

---

## 6. NestJS Controller

**File: `services/ehr-service/src/vhf/vhf.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { VhfService } from './vhf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('vhf')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VhfController {
  constructor(private readonly vhfService: VhfService) {}

  @Post('cases')
  @Roles('doctor', 'nurse', 'infection_control', 'admin')
  reportCase(@Body() dto: any) {
    return this.vhfService.reportCase(dto);
  }

  @Get('cases')
  @Roles('doctor', 'nurse', 'infection_control', 'admin', 'public_health')
  getCases(@Query('pathogen') pathogen?: string, @Query('classification') classification?: string) {
    return this.vhfService.getCases({ pathogen, classification });
  }

  @Get('cases/:id')
  @Roles('doctor', 'nurse', 'infection_control', 'admin')
  getCase(@Param('id') id: string) {
    return this.vhfService.getCase(id);
  }

  @Patch('cases/:id')
  @Roles('doctor', 'infection_control', 'admin')
  updateCase(@Param('id') id: string, @Body() dto: any) {
    return this.vhfService.updateCase(id, dto);
  }

  @Post('cases/:id/contacts')
  @Roles('doctor', 'nurse', 'infection_control', 'public_health')
  addContact(@Param('id') id: string, @Body() dto: any) {
    return this.vhfService.addContact(id, dto);
  }

  @Get('cases/:id/contacts')
  @Roles('doctor', 'nurse', 'infection_control', 'public_health')
  getContacts(@Param('id') id: string) {
    return this.vhfService.getContacts(id);
  }

  @Patch('contacts/:id/status')
  @Roles('doctor', 'nurse', 'infection_control', 'public_health')
  updateContactStatus(@Param('id') id: string, @Body() dto: { status: string; becameCaseId?: string }) {
    return this.vhfService.updateContactStatus(id, dto.status, dto.becameCaseId);
  }

  @Post('mpox/lesion-assessment')
  @Roles('doctor', 'nurse', 'infection_control')
  recordLesionAssessment(@Body() dto: any) {
    return this.vhfService.recordLesionAssessment(dto);
  }

  @Get('mpox/lesion-history/:patientId')
  @Roles('doctor', 'nurse', 'infection_control')
  getLesionHistory(@Param('patientId') patientId: string) {
    return this.vhfService.getLesionHistory(patientId);
  }

  @Post('cases/:id/triage')
  @Roles('doctor', 'infection_control', 'admin')
  triageCase(@Param('id') id: string, @Body() dto: any) {
    return this.vhfService.triageCase(id, dto);
  }

  @Get('surveillance/summary')
  @Roles('doctor', 'nurse', 'infection_control', 'admin', 'public_health')
  getSurveillanceSummary() {
    return this.vhfService.getActiveSurveillanceSummary();
  }
}
```

### 6a. NestJS Module

**File: `services/ehr-service/src/vhf/vhf.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VhfCase } from './entities/vhf-case.entity';
import { VhfContact } from './entities/vhf-contact.entity';
import { MpoxLesionAssessment } from './entities/mpox-lesion-assessment.entity';
import { VhfService } from './vhf.service';
import { VhfController } from './vhf.controller';
import { CdssModule } from '../cdss/cdss.module';

@Module({
  imports: [TypeOrmModule.forFeature([VhfCase, VhfContact, MpoxLesionAssessment]), CdssModule],
  providers: [VhfService],
  controllers: [VhfController],
  exports: [VhfService],
})
export class VhfModule {}
```

### 6b. Register in `ehr.module.ts`

```typescript
import { VhfModule } from './vhf/vhf.module';

// Add to @Module imports array:
VhfModule,
```

---

## 7. Frontend

### 7a. API functions in `ehr-frontend/src/services/api.ts`

```typescript
// ── VHF / Mpox ──────────────────────────────────────────────────────────────
export const vhfApi = {
  reportCase: (data: any) => api.post('/vhf/cases', data),
  getCases: (params?: { pathogen?: string; classification?: string }) =>
    api.get('/vhf/cases', { params }),
  getCase: (id: string) => api.get(`/vhf/cases/${id}`),
  updateCase: (id: string, data: any) => api.patch(`/vhf/cases/${id}`, data),
  addContact: (caseId: string, data: any) => api.post(`/vhf/cases/${caseId}/contacts`, data),
  getContacts: (caseId: string) => api.get(`/vhf/cases/${caseId}/contacts`),
  updateContactStatus: (contactId: string, data: any) => api.patch(`/vhf/contacts/${contactId}/status`, data),
  recordLesionAssessment: (data: any) => api.post('/vhf/mpox/lesion-assessment', data),
  getLesionHistory: (patientId: string) => api.get(`/vhf/mpox/lesion-history/${patientId}`),
  triageCase: (caseId: string, data: any) => api.post(`/vhf/cases/${caseId}/triage`, data),
  getSurveillanceSummary: () => api.get('/vhf/surveillance/summary'),
};
```

### 7b. Frontend Component

**File: `ehr-frontend/src/components/VhfSurveillanceDashboard.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { vhfApi } from '../services/api';
import { AlertTriangle, Users, Activity, Eye, Shield, CheckCircle, XCircle } from 'lucide-react';

type Tab = 'cases' | 'contacts' | 'mpox' | 'summary';

export default function VhfSurveillanceDashboard() {
  const [tab, setTab] = useState<Tab>('cases');
  const [cases, setCases] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [triageResult, setTriageResult] = useState<any>(null);
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [casesRes, summaryRes] = await Promise.all([
        vhfApi.getCases(),
        vhfApi.getSurveillanceSummary(),
      ]);
      setCases(casesRes.data);
      setSummary(summaryRes.data);
    } finally {
      setLoading(false);
    }
  }

  async function loadContacts(caseId: string) {
    const res = await vhfApi.getContacts(caseId);
    setContacts(res.data);
  }

  async function handleTriageCase(caseId: string, triageData: any) {
    const res = await vhfApi.triageCase(caseId, triageData);
    setTriageResult(res.data);
  }

  const PATHOGEN_COLOURS: Record<string, string> = {
    mpox_clade_i: 'bg-orange-100 text-orange-800',
    mpox_clade_ii: 'bg-yellow-100 text-yellow-800',
    ebola: 'bg-red-100 text-red-800',
    marburg: 'bg-red-100 text-red-800',
    lassa: 'bg-purple-100 text-purple-800',
    rvf: 'bg-blue-100 text-blue-800',
    crimean_congo: 'bg-pink-100 text-pink-800',
  };

  const CLASSIFICATION_COLOURS: Record<string, string> = {
    suspected: 'bg-yellow-100 text-yellow-800',
    probable: 'bg-orange-100 text-orange-800',
    confirmed: 'bg-red-100 text-red-800',
    discarded: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Cases</div>
            <div className="text-3xl font-bold text-gray-900">{summary.total}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="text-sm text-yellow-700">Suspected</div>
            <div className="text-3xl font-bold text-yellow-800">{summary.suspected}</div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="text-sm text-red-700">Confirmed</div>
            <div className="text-3xl font-bold text-red-800">{summary.confirmed}</div>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <div className="text-sm text-blue-700">Contacts Monitored</div>
            <div className="text-3xl font-bold text-blue-800">{summary.contactsUnderMonitoring}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg border">
        <div className="flex border-b">
          {(['cases', 'contacts', 'mpox', 'summary'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500'}`}
            >
              {t === 'cases' ? 'VHF Cases' : t === 'contacts' ? 'Contact Tracing' : t === 'mpox' ? 'Mpox Lesions' : 'Surveillance'}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'cases' && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" /> VHF Case Register
                </h3>
                <button
                  onClick={() => setShowNewCaseForm(!showNewCaseForm)}
                  className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700"
                >
                  Report New Case
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Pathogen</th>
                    <th className="pb-2">Classification</th>
                    <th className="pb-2">Isolation</th>
                    <th className="pb-2">WHO Notified</th>
                    <th className="pb-2">Outcome</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">{c.dateReported}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PATHOGEN_COLOURS[c.pathogen] ?? 'bg-gray-100 text-gray-700'}`}>
                          {c.pathogen.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CLASSIFICATION_COLOURS[c.classification]}`}>
                          {c.classification}
                        </span>
                      </td>
                      <td className="py-2 capitalize">{c.isolationStatus}</td>
                      <td className="py-2">
                        {c.notifiedWho ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                      </td>
                      <td className="py-2 capitalize">{c.outcome ?? 'Under care'}</td>
                      <td className="py-2">
                        <button
                          onClick={() => { setSelectedCase(c); loadContacts(c.id); setTab('contacts'); }}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Contacts
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'contacts' && (
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-blue-600" /> Contact Tracing
                {selectedCase && <span className="text-sm text-gray-500 font-normal">— Case: {selectedCase.pathogen}</span>}
              </h3>
              {contacts.length === 0 ? (
                <p className="text-gray-400 text-sm">Select a case from the VHF Cases tab to view contacts.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Last Exposure</th>
                      <th className="pb-2">Monitoring Until</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">CHW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="py-2">{c.contactName}</td>
                        <td className="py-2 capitalize">{c.contactType}</td>
                        <td className="py-2">{c.lastExposureDate}</td>
                        <td className="py-2">{c.monitoringEndDate}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${c.status === 'under_monitoring' ? 'bg-yellow-100 text-yellow-800' : c.status === 'cleared' ? 'bg-green-100 text-green-800' : c.status === 'became_case' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                            {c.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2">{c.assignedChwId ? 'Assigned' : 'Unassigned'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'mpox' && (
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-orange-600" /> Mpox Lesion Assessment
              </h3>
              <p className="text-sm text-gray-500 mb-3">Record mpox stage, lesion distribution, and complications. CDSS will compute severity score and antiviral indication automatically.</p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                <strong>CDSS Integration:</strong> Every lesion assessment triggers automated severity scoring via WHO Mpox Clinical Management guidelines. Tecovirimat indication is flagged when severity score ≥ 7 or immunocompromised host.
              </div>
            </div>
          )}

          {tab === 'summary' && (
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-gray-600" /> Active Surveillance Summary
              </h3>
              {summary && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">Active Contacts Under Monitoring</div>
                    <div className="text-4xl font-bold text-blue-700">{summary.contactsUnderMonitoring}</div>
                    <div className="text-xs text-gray-400 mt-1">Follow-up required daily for 21 days</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    IHR 2005 Art. 12 — Any confirmed VHF case is a potential PHEIC event. Notify WHO within 24 hours of confirmation.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 7c. Wire into existing dashboard

In `ehr-frontend/src/components/InfectionControlDashboard.tsx` (or create if absent, and register a new navigation route):

```tsx
import VhfSurveillanceDashboard from './VhfSurveillanceDashboard';

// Add a tab "VHF / Mpox Surveillance" rendering <VhfSurveillanceDashboard />
```

If no InfectionControl dashboard exists, add a route in the main router:
```tsx
{ path: '/vhf-surveillance', element: <VhfSurveillanceDashboard /> }
```

---

## 8. Post-Implementation Steps

```bash
# 1. Rebuild tenant-service to pick up new bundle
docker compose build tenant-service

# ⚠️  MANDATORY: Run provisioning before any application startup
# This creates vhf_cases, vhf_contacts, mpox_lesion_assessments in every tenant DB.
# If skipped, TypeORM will error on first VHF endpoint call.
./scripts/provision-repair-all.sh

# Fallback if script unavailable:
curl -X POST http://localhost:3001/admin/tenants/repair-all \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"

# 2. Verify tables exist (run for each tenant DB)
psql $DATABASE_URL -c "\d vhf_cases"
psql $DATABASE_URL -c "\d vhf_contacts"
psql $DATABASE_URL -c "\d mpox_lesion_assessments"
# If any output says "Did not find any relation" — the bundle did not apply. Re-run provision.

# 3. TypeScript compile check
npx tsc --noEmit
# Must return 0 errors before proceeding.

# 4. Test CDSS endpoints
curl -X POST http://localhost:8000/cdss/vhf/risk-triage \
  -H "Content-Type: application/json" \
  -d '{"pathogen":"mpox_clade_i","fever":true,"rash":true,"contact_with_vhf_case":true,"age_years":28,"immunocompromised":false,"pregnant":false,"haemorrhage":false,"vomiting":false,"diarrhoea":false,"myalgia":true,"headache":true,"pharyngitis":false,"travel_endemic_area":true,"animal_contact":false,"healthcare_worker":false,"lab_pcr_result":"pending","symptom_onset_days":4}'

curl -X POST http://localhost:8000/cdss/vhf/mpox-severity \
  -H "Content-Type: application/json" \
  -d '{"stage":"pustules","day_of_illness":8,"lesion_count_category":"moderate_10-100","mucocutaneous_sites":["genital"],"corneal_involvement":false,"respiratory_involvement":false,"secondary_infection":false,"cns_involvement":false,"immunocompromised":false,"hiv_positive":false,"age_years":28,"pregnant":false,"clade":"Ib"}'

# 5. Lint check
npm run lint
# Must pass with 0 errors.

# 6. Git commit (only after all gates pass)
git add services/tenant-service/src/generated/tenant-vhf-case-management.statements.ts \
        services/ehr-service/src/vhf/ \
        ehr-frontend/src/services/api.ts \
        ehr-frontend/src/components/VhfSurveillanceDashboard.tsx
git commit -m "feat: implement Sprint 150 — Mpox/Ebola/VHF case management and surveillance"
```

---

## 9. Done-When Checklist

- [ ] `tenant-vhf-case-management.statements.ts` created with idempotent SQL for 3 tables
- [ ] Bundle registered in `database-provisioning.service.ts` with correct ID and version
- [ ] `VhfCase`, `VhfContact`, `MpoxLesionAssessment` TypeORM entities created
- [ ] All 3 entities registered in `tenant.service.ts` entities array
- [ ] `VhfModule` created and imported into `ehr.module.ts`
- [ ] `VhfService` implements all 10+ methods using repository pattern
- [ ] `VhfController` exposes 11 routes
- [ ] CDSS endpoint `POST /cdss/vhf/risk-triage` implemented with WHO case definition logic
- [ ] CDSS endpoint `POST /cdss/vhf/mpox-severity` implemented with WHO severity criteria
- [ ] All CDSS calls use `callGovernedJson()` or `requestWithPolicy()` — never direct HTTP
- [ ] `vhfApi` added to `ehr-frontend/src/services/api.ts`
- [ ] `VhfSurveillanceDashboard.tsx` created with 4 tabs: VHF Cases, Contact Tracing, Mpox Lesions, Surveillance
- [ ] Dashboard wired into existing navigation (InfectionControl or new route)
- [ ] `provision-repair-all.sh` runs clean (all 3 tables present in tenant DBs)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed with message: `feat: implement Sprint 150 — Mpox/Ebola/VHF case management and surveillance`
