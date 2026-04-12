# CODEX S145 — Epilepsy NCD Register + AED Protocol

**Sprint**: S145
**Module**: Epilepsy NCD Register, AED Therapy Tracking, Drug Interaction & Status Epilepticus Protocol
**Bundle version**: `2026.04.12.19`
**Bundle ID**: `sprint145_epilepsy_ncd_register`
**Date**: 2026-04-12

---

## 1. Clinical Rationale

Epilepsy is the most prevalent serious neurological condition in Sub-Saharan Africa, affecting an estimated **10 million people** with a treatment gap of ~75% — the majority receive no anti-epileptic drug (AED) therapy. WHO mhGAP-IG 2.0 includes epilepsy as a priority condition alongside depression, psychosis, and substance use.

### Why this sprint closes a real gap

The codebase already has:
- `seizure_records` entity — individual seizure event log (type, duration, triggers, postictal state, status_epilepticus flag)
- `POST /neurology/seizure/classify` CDSS endpoint — basic ILAE seizure type classification
- `neurology.controller.ts` — `POST/GET /patient/:patientId/seizures`, `POST /cdss/seizure/classify`

**What is completely missing:**
- An **epilepsy register** (enrollment, ILAE syndrome classification, etiology, diagnosis date, seizure freedom tracking)
- **AED therapy records** (drug name, dose, frequency, start/stop, reason for change, drug level result)
- **AED toxicity event recording** (VPA hepatotoxicity, CBZ Stevens-Johnson syndrome, phenobarb bone marrow suppression, hyponatraemia)
- **Drug interaction intelligence** — the most dangerous gap:
  - Phenobarbital is a potent CYP3A4 inducer → reduces ARV levels (lopinavir, efavirenz, nevirapine) by 30–75%
  - Rifampicin reduces carbamazepine levels 50–70% (TB co-treatment)
  - Sodium valproate is teratogenic (neural tube defects) → must be flagged in women of reproductive age
  - Phenytoin + INH (isoniazid) → phenytoin toxicity (CYP2C9 inhibition)
- **Status epilepticus protocol** — Diazepam rectal/IV → Lorazepam IV → Phenobarbital IV escalation (mhGAP-IG / WHO emergency guidelines)
- NurseDashboard NCD tab, `epilepsyApi` frontend namespace

### Key clinical standards implemented

| Standard | Application |
|---|---|
| ILAE 2017 seizure classification | Focal / Generalised / Unknown onset; aware/impaired awareness |
| ILAE 2017 epilepsy syndrome classification | Childhood absence, JME, LGS, Dravet, unknown |
| WHO mhGAP-IG 2.0 | First-line AED selection (phenobarb/VPA/CBZ), dose targets, follow-up protocol |
| WHO Emergency Triage | Status epilepticus 5-min → 20-min → 30-min escalation ladder |
| CYP450 interaction system | CYP3A4 induction (phenobarb, CBZ, phenytoin) vs inhibition (VPA); drug level interpretation |
| ICD-11 coding | G40.x epilepsy, G41 status epilepticus |

---

## 2. Do Not Touch

These files already exist and are fully working. **Do not recreate or modify them for S145:**

- `services/ehr-service/src/entities/seizure-record.entity.ts`
- `services/ehr-service/src/entities/neurology-examination.entity.ts`
- `services/ehr-service/src/controllers/neurology.controller.ts`
- `services/ehr-service/src/services/neurology.service.ts` (if present)
- `services/cdss-service/main.py` routes `/neurology/seizure/classify`, `/neurology/stroke/triage`, `/neurology/headache/diagnose`

S145 adds epilepsy **register + AED + toxicity** infrastructure that sits alongside the existing seizure event log — it does not replace it. The `EpilepsyDashboard.tsx` seizure diary tab should **read from the existing `/neurology/patient/:patientId/seizures` endpoint** via `api.ts`.

---

## 3. Provisioning Bundle

### `services/tenant-service/src/generated/tenant-epilepsy.statements.ts`

```typescript
export const TENANT_EPILEPSY_BUNDLE_VERSION = '2026.04.12.19';

export const TENANT_EPILEPSY_STATEMENTS: string[] = [
  // ── Epilepsy Register ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS epilepsy_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    enrolled_by UUID NOT NULL,
    enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
    diagnosis_date DATE,
    ilae_seizure_type TEXT,
    ilae_syndrome TEXT,
    etiology TEXT,
    etiology_detail TEXT,
    icd11_code TEXT,
    seizure_freedom_since DATE,
    last_seizure_date DATE,
    seizure_frequency_per_month NUMERIC(6,2),
    current_status TEXT NOT NULL DEFAULT 'active',
    driving_restriction BOOLEAN NOT NULL DEFAULT false,
    pregnancy_risk_counselled BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    next_review_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_epilepsy_reg_patient ON epilepsy_register(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_epilepsy_reg_status ON epilepsy_register(current_status)`,
  `CREATE INDEX IF NOT EXISTS idx_epilepsy_reg_next_review ON epilepsy_register(next_review_date)`,

  // ── AED Therapy Records ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS aed_therapy_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    epilepsy_register_id UUID,
    recorded_by UUID NOT NULL,
    drug_name TEXT NOT NULL,
    dose_mg NUMERIC(8,2) NOT NULL,
    frequency TEXT NOT NULL,
    route TEXT NOT NULL DEFAULT 'oral',
    start_date DATE NOT NULL,
    stop_date DATE,
    stop_reason TEXT,
    drug_level_result NUMERIC(8,2),
    drug_level_unit TEXT,
    drug_level_date DATE,
    drug_level_interpretation TEXT,
    indication TEXT,
    prescriber_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_aed_patient ON aed_therapy_records(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_aed_register ON aed_therapy_records(epilepsy_register_id)`,
  `CREATE INDEX IF NOT EXISTS idx_aed_drug ON aed_therapy_records(drug_name)`,
  `CREATE INDEX IF NOT EXISTS idx_aed_active ON aed_therapy_records(patient_id, stop_date) WHERE stop_date IS NULL`,

  // ── AED Toxicity Events ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS aed_toxicity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    aed_therapy_record_id UUID,
    recorded_by UUID NOT NULL,
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    drug_name TEXT NOT NULL,
    toxicity_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'mild',
    organ_system TEXT,
    clinical_findings TEXT,
    lab_markers JSONB DEFAULT '{}',
    action_taken TEXT,
    outcome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_aed_tox_patient ON aed_toxicity_events(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_aed_tox_drug ON aed_toxicity_events(drug_name)`,
  `CREATE INDEX IF NOT EXISTS idx_aed_tox_severity ON aed_toxicity_events(severity)`,
];
```

### Register in `services/tenant-service/src/services/database-provisioning.service.ts`

Add the following entry **after** the `sprint144_scd_haemoglobinopathy` block (around line 1398):

```typescript
{
  id: 'sprint145_epilepsy_ncd_register',
  label: 'Epilepsy NCD Register + AED Therapy Protocol',
  version: TENANT_EPILEPSY_BUNDLE_VERSION,
  description: 'S145 — epilepsy register, AED therapy records, AED toxicity events',
  statements: TENANT_EPILEPSY_STATEMENTS,
},
```

Add the import at the top of the file alongside the other tenant statement imports:

```typescript
import { TENANT_EPILEPSY_STATEMENTS, TENANT_EPILEPSY_BUNDLE_VERSION } from '../generated/tenant-epilepsy.statements';
```

---

## 4. Entities

### 4a. `services/ehr-service/src/entities/epilepsy-register.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('epilepsy_register')
export class EpilepsyRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'enrolled_by', type: 'uuid' }) enrolledBy: string;
  @Column({ name: 'enrolled_at', type: 'date' }) enrolledAt: string;
  @Column({ name: 'diagnosis_date', type: 'date', nullable: true }) diagnosisDate: string | null;
  @Column({ name: 'ilae_seizure_type', type: 'text', nullable: true }) ilaeSeizureType: string | null;
  @Column({ name: 'ilae_syndrome', type: 'text', nullable: true }) ilaeSyndrome: string | null;
  @Column({ type: 'text', nullable: true }) etiology: string | null;
  @Column({ name: 'etiology_detail', type: 'text', nullable: true }) etiologyDetail: string | null;
  @Column({ name: 'icd11_code', type: 'text', nullable: true }) icd11Code: string | null;
  @Column({ name: 'seizure_freedom_since', type: 'date', nullable: true }) seizureFreedomSince: string | null;
  @Column({ name: 'last_seizure_date', type: 'date', nullable: true }) lastSeizureDate: string | null;
  @Column({ name: 'seizure_frequency_per_month', type: 'numeric', precision: 6, scale: 2, nullable: true }) seizureFrequencyPerMonth: number | null;
  @Column({ name: 'current_status', type: 'text', default: 'active' }) currentStatus: string;
  @Column({ name: 'driving_restriction', type: 'boolean', default: false }) drivingRestriction: boolean;
  @Column({ name: 'pregnancy_risk_counselled', type: 'boolean', default: false }) pregnancyRiskCounselled: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ name: 'next_review_date', type: 'date', nullable: true }) nextReviewDate: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 4b. `services/ehr-service/src/entities/aed-therapy-record.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('aed_therapy_records')
export class AedTherapyRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'epilepsy_register_id', type: 'uuid', nullable: true }) epilepsyRegisterId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'drug_name', type: 'text' }) drugName: string;
  @Column({ name: 'dose_mg', type: 'numeric', precision: 8, scale: 2 }) doseMg: number;
  @Column({ type: 'text' }) frequency: string;
  @Column({ type: 'text', default: 'oral' }) route: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'stop_date', type: 'date', nullable: true }) stopDate: string | null;
  @Column({ name: 'stop_reason', type: 'text', nullable: true }) stopReason: string | null;
  @Column({ name: 'drug_level_result', type: 'numeric', precision: 8, scale: 2, nullable: true }) drugLevelResult: number | null;
  @Column({ name: 'drug_level_unit', type: 'text', nullable: true }) drugLevelUnit: string | null;
  @Column({ name: 'drug_level_date', type: 'date', nullable: true }) drugLevelDate: string | null;
  @Column({ name: 'drug_level_interpretation', type: 'text', nullable: true }) drugLevelInterpretation: string | null;
  @Column({ type: 'text', nullable: true }) indication: string | null;
  @Column({ name: 'prescriber_id', type: 'uuid', nullable: true }) prescriberId: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 4c. `services/ehr-service/src/entities/aed-toxicity-event.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('aed_toxicity_events')
export class AedToxicityEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'aed_therapy_record_id', type: 'uuid', nullable: true }) aedTherapyRecordId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'event_date', type: 'date' }) eventDate: string;
  @Column({ name: 'drug_name', type: 'text' }) drugName: string;
  @Column({ name: 'toxicity_type', type: 'text' }) toxicityType: string;
  @Column({ type: 'text', default: 'mild' }) severity: string;
  @Column({ name: 'organ_system', type: 'text', nullable: true }) organSystem: string | null;
  @Column({ name: 'clinical_findings', type: 'text', nullable: true }) clinicalFindings: string | null;
  @Column({ name: 'lab_markers', type: 'jsonb', default: {} }) labMarkers: Record<string, any>;
  @Column({ name: 'action_taken', type: 'text', nullable: true }) actionTaken: string | null;
  @Column({ type: 'text', nullable: true }) outcome: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

---

## 5. CDSS Data File

### `services/cdss-service/data/epilepsy_protocol.json`

```json
{
  "version": "mhGAP-IG-2.0 / ILAE-2017 / WHO-Emergency-2024",
  "source": "WHO mhGAP Intervention Guide 2.0, ILAE 2017 Classification, WHO Emergency Triage Guidelines",
  "ilae_seizure_types": {
    "focal_aware": "Focal onset, awareness retained (previously 'simple partial')",
    "focal_impaired": "Focal onset, awareness impaired (previously 'complex partial')",
    "focal_to_bilateral_tonic_clonic": "Focal to bilateral tonic-clonic",
    "generalised_tonic_clonic": "Generalised onset tonic-clonic",
    "absence": "Generalised onset absence",
    "myoclonic": "Generalised onset myoclonic",
    "atonic": "Generalised onset atonic (drop attack)",
    "unknown_onset": "Unknown onset"
  },
  "ilae_syndromes": [
    "Childhood absence epilepsy",
    "Juvenile absence epilepsy",
    "Juvenile myoclonic epilepsy",
    "Lennox-Gastaut syndrome",
    "Dravet syndrome",
    "Self-limited epilepsy with centrotemporal spikes (SECTS)",
    "Temporal lobe epilepsy",
    "Frontal lobe epilepsy",
    "Unclassified"
  ],
  "etiologies": {
    "structural": ["stroke", "tumour", "cortical dysplasia", "hippocampal sclerosis", "trauma", "neurocysticercosis"],
    "genetic": ["Dravet (SCN1A)", "JME", "childhood absence"],
    "infectious": ["cerebral malaria", "HIV encephalopathy", "bacterial meningitis (sequelae)", "neurocysticercosis"],
    "metabolic": ["hypoglycaemia", "hyponatraemia", "hypocalcaemia", "uraemia"],
    "immune": ["autoimmune encephalitis"],
    "unknown": ["unknown etiology"]
  },
  "aed_first_line": {
    "adults_generalised_tonic_clonic": {
      "first_choice": "sodium_valproate",
      "alternative_male": "carbamazepine",
      "alternative_wra": "lamotrigine",
      "avoid_in_wra": "sodium_valproate",
      "avoid_reason_wra": "Teratogenic — associated with neural tube defects and neurodevelopmental impairment in offspring. Contraindicated in women of reproductive age unless no alternatives and effective contraception in place."
    },
    "adults_focal": {
      "first_choice": "carbamazepine",
      "alternative": "phenobarbital",
      "low_resource_first_choice": "phenobarbital"
    },
    "children_generalised": {
      "first_choice": "sodium_valproate",
      "alternative": "phenobarbital",
      "absence_first_choice": "sodium_valproate"
    },
    "children_focal": {
      "first_choice": "carbamazepine",
      "alternative": "phenobarbital"
    },
    "low_resource_fallback": "phenobarbital"
  },
  "aed_dosing": {
    "phenobarbital": {
      "adult_starting_mg": 60,
      "adult_maintenance_range_mg": [60, 180],
      "adult_frequency": "once daily at night",
      "pediatric_mg_per_kg_starting": 3,
      "pediatric_mg_per_kg_max": 6,
      "therapeutic_level_mcg_ml": { "min": 15, "max": 40 },
      "notes": "Most affordable AED in LMIC. Strong CYP3A4/CYP2C9 inducer — significant ARV and TB drug interactions."
    },
    "sodium_valproate": {
      "adult_starting_mg": 400,
      "adult_maintenance_range_mg": [400, 2000],
      "adult_frequency": "twice daily",
      "pediatric_mg_per_kg_starting": 10,
      "pediatric_mg_per_kg_max": 40,
      "therapeutic_level_mcg_ml": { "min": 50, "max": 100 },
      "contraindications": ["pregnancy", "liver_disease", "pancreatitis", "urea_cycle_disorders"],
      "wra_warning": true,
      "notes": "Monitor LFTs. Teratogenic — neural tube defects. Avoid in women of reproductive age."
    },
    "carbamazepine": {
      "adult_starting_mg": 100,
      "adult_target_mg": 400,
      "adult_maintenance_range_mg": [200, 1200],
      "adult_frequency": "twice daily",
      "pediatric_mg_per_kg_starting": 5,
      "pediatric_mg_per_kg_max": 20,
      "therapeutic_level_mcg_ml": { "min": 4, "max": 12 },
      "notes": "CYP3A4 inducer (auto-induction). Reduces rifampicin efficacy and ARV levels. Monitor Na — risk of hyponatraemia."
    },
    "phenytoin": {
      "adult_starting_mg": 150,
      "adult_maintenance_range_mg": [200, 400],
      "adult_frequency": "twice daily",
      "therapeutic_level_mcg_ml": { "min": 10, "max": 20 },
      "notes": "Non-linear kinetics — small dose increases can cause toxicity. INH inhibits CYP2C9 → phenytoin toxicity risk."
    },
    "lamotrigine": {
      "adult_starting_mg": 25,
      "adult_titration_weeks": 8,
      "adult_maintenance_range_mg": [100, 400],
      "adult_frequency": "twice daily",
      "notes": "Preferred for women of reproductive age. Slow titration required to reduce SJS risk."
    }
  },
  "drug_interactions": [
    {
      "aed": "phenobarbital",
      "interacting_drug_class": "ARVs (NNRTIs / PIs)",
      "examples": ["efavirenz", "nevirapine", "lopinavir/ritonavir", "atazanavir"],
      "mechanism": "CYP3A4 induction",
      "effect": "Phenobarbital reduces ARV plasma levels by 30–75% → virological failure risk",
      "severity": "critical",
      "management": "Avoid combination where possible. If unavoidable: switch to integrase inhibitor-based ART (dolutegravir — less affected). Monitor viral load closely."
    },
    {
      "aed": "phenobarbital",
      "interacting_drug_class": "TB drugs",
      "examples": ["rifampicin"],
      "mechanism": "Additive CYP3A4 induction (bidirectional)",
      "effect": "Phenobarbital levels may decrease; rifampicin efficacy maintained but monitor phenobarb levels",
      "severity": "moderate",
      "management": "Monitor clinical seizure control. Check phenobarbital drug level after starting TB therapy."
    },
    {
      "aed": "carbamazepine",
      "interacting_drug_class": "TB drugs",
      "examples": ["rifampicin"],
      "mechanism": "CYP3A4 induction by rifampicin",
      "effect": "CBZ plasma levels reduced 50–70% — seizure breakthrough risk",
      "severity": "critical",
      "management": "Increase CBZ dose with close drug level monitoring. Consider switching AED during TB treatment."
    },
    {
      "aed": "carbamazepine",
      "interacting_drug_class": "ARVs",
      "examples": ["lopinavir/ritonavir", "atazanavir"],
      "mechanism": "CYP3A4 mutual induction/inhibition",
      "effect": "CBZ levels may increase (ritonavir inhibits CYP3A4) or decrease — unpredictable",
      "severity": "major",
      "management": "Prefer alternative AED. If combined: measure CBZ level and titrate carefully."
    },
    {
      "aed": "phenytoin",
      "interacting_drug_class": "TB drugs",
      "examples": ["isoniazid (INH)"],
      "mechanism": "INH inhibits CYP2C9",
      "effect": "Phenytoin toxicity (nystagmus, ataxia, confusion) at therapeutic doses",
      "severity": "major",
      "management": "Monitor phenytoin level within 2 weeks of starting INH. Reduce phenytoin dose if level elevated."
    },
    {
      "aed": "sodium_valproate",
      "interacting_drug_class": "ARVs",
      "examples": ["lopinavir/ritonavir"],
      "mechanism": "Lopinavir/ritonavir induces VPA glucuronidation",
      "effect": "VPA levels reduced up to 75% — seizure risk",
      "severity": "major",
      "management": "Monitor VPA level after starting lopinavir/ritonavir. May need dose increase."
    },
    {
      "aed": "sodium_valproate",
      "interacting_drug_class": "other_aed",
      "examples": ["lamotrigine"],
      "mechanism": "VPA inhibits lamotrigine glucuronidation (UGT)",
      "effect": "Lamotrigine levels double — toxicity risk (dizziness, diplopia, SJS)",
      "severity": "major",
      "management": "Halve lamotrigine starting dose and titrate more slowly when combined with VPA."
    }
  ],
  "drug_level_thresholds": {
    "phenobarbital": { "subtherapeutic_below": 15, "toxic_above": 40, "unit": "mcg/mL" },
    "sodium_valproate": { "subtherapeutic_below": 50, "toxic_above": 100, "unit": "mcg/mL" },
    "carbamazepine": { "subtherapeutic_below": 4, "toxic_above": 12, "unit": "mcg/mL" },
    "phenytoin": { "subtherapeutic_below": 10, "toxic_above": 20, "unit": "mcg/mL" }
  },
  "status_epilepticus_protocol": {
    "definition": "Seizure lasting ≥5 minutes OR ≥2 seizures without recovery of consciousness",
    "phases": [
      {
        "phase": 1,
        "time_minutes": "0–5",
        "action": "Position patient, protect airway, O2, IV access, glucose check",
        "drug": null
      },
      {
        "phase": 2,
        "time_minutes": "5–20",
        "action": "Benzodiazepine — first line",
        "drug": "diazepam",
        "dose_adult": "10mg IV over 2 min OR 10–20mg rectal (if no IV)",
        "dose_pediatric": "0.3 mg/kg IV (max 10mg) OR 0.5 mg/kg rectal",
        "repeat": "May repeat once after 5 min if seizure continues",
        "alternative": "Lorazepam 4mg IV (adult) / 0.1 mg/kg IV (child)"
      },
      {
        "phase": 3,
        "time_minutes": "20–40",
        "action": "If benzodiazepine failed — second line",
        "drug": "phenobarbital",
        "dose_adult": "20 mg/kg IV at 50–100 mg/min (max 1g)",
        "dose_pediatric": "20 mg/kg IV at max 1 mg/kg/min",
        "note": "Phenytoin 20mg/kg IV at ≤50 mg/min if phenobarb unavailable"
      },
      {
        "phase": 4,
        "time_minutes": ">40 (refractory SE)",
        "action": "Refer urgently to ICU. Intubation + anaesthesia (propofol/midazolam/thiopentone)",
        "drug": "ICU_referral",
        "note": "Mortality 20–30% in refractory SE"
      }
    ]
  },
  "aed_toxicity_profiles": {
    "phenobarbital": {
      "common": ["sedation", "cognitive_impairment", "hyperactivity_children", "osteoporosis"],
      "serious": ["hepatotoxicity", "bone_marrow_suppression", "paradoxical_excitement"],
      "monitoring": ["LFT at baseline and 3-monthly", "FBC if prolonged use"]
    },
    "sodium_valproate": {
      "common": ["weight_gain", "tremor", "alopecia", "nausea"],
      "serious": ["hepatotoxicity", "pancreatitis", "thrombocytopenia", "encephalopathy", "teratogenicity"],
      "monitoring": ["LFT monthly for first 6 months then 6-monthly", "platelet count", "VPA level"]
    },
    "carbamazepine": {
      "common": ["dizziness", "diplopia", "ataxia", "nausea"],
      "serious": ["Stevens-Johnson_syndrome", "hyponatraemia", "agranulocytosis", "aplastic_anaemia"],
      "monitoring": ["FBC and Na at baseline and 3-monthly", "CBZ level", "LFT"]
    },
    "phenytoin": {
      "common": ["gingival_hyperplasia", "hirsuitism", "coarsened_facies"],
      "serious": ["Stevens-Johnson_syndrome", "cerebellar_atrophy_chronic", "osteoporosis"],
      "monitoring": ["phenytoin level", "FBC", "LFT", "dental hygiene review"]
    }
  },
  "wra_aed_safety": {
    "contraindicated": ["sodium_valproate"],
    "caution_counselling_required": ["carbamazepine", "phenobarbital", "phenytoin"],
    "preferred": ["lamotrigine"],
    "notes": "All AEDs except lamotrigine reduce OCP efficacy via CYP induction. Advise barrier contraception. Folic acid 5mg daily for all women of reproductive age on AEDs."
  },
  "follow_up_schedule": {
    "newly_diagnosed": "2 weeks, then 1 month, then 3-monthly until stable",
    "stable": "6-monthly",
    "seizure_free_2_years": "Annual review, discuss AED withdrawal (specialist decision)",
    "drug_level_monitoring": "At baseline, 4 weeks after dose change, then annually or with clinical change"
  }
}
```

---

## 6. CDSS Endpoints — `services/cdss-service/main.py`

Add the following Pydantic models and endpoint functions. All three read from `epilepsy_protocol.json` via the existing `_load_supporting_json()` helper.

### 6a. Pydantic request models (add with other model definitions)

```python
class EpilepsyAedDoseRequest(BaseModel):
    seizure_type: str  # 'focal' | 'generalised_tonic_clonic' | 'absence' | 'myoclonic' | etc.
    patient_age_years: float
    patient_weight_kg: Optional[float] = None
    sex: Optional[str] = None  # 'male' | 'female'
    is_wra: Optional[bool] = False  # women of reproductive age (12–49)
    current_aeds: Optional[List[str]] = []  # list of current AED drug names
    concurrent_arv: Optional[bool] = False
    concurrent_tb_treatment: Optional[bool] = False
    comorbidities: Optional[List[str]] = []  # 'liver_disease', 'pregnancy', etc.
    low_resource_setting: Optional[bool] = True

class EpilepsyDrugInteractionRequest(BaseModel):
    aed_name: str  # e.g. 'phenobarbital', 'carbamazepine'
    concurrent_drugs: List[str]  # e.g. ['efavirenz', 'rifampicin']
    is_wra: Optional[bool] = False

class EpilepsyStatusEpilepticusRequest(BaseModel):
    duration_minutes: float
    phase_reached: Optional[int] = None  # 1|2|3 — phase already administered
    patient_age_years: float
    patient_weight_kg: Optional[float] = None
    iv_access: Optional[bool] = True
    drugs_available: Optional[List[str]] = []  # ['diazepam', 'phenobarbital', 'lorazepam']
```

### 6b. `POST /cdss/epilepsy/aed-dose`

```python
@app.post("/cdss/epilepsy/aed-dose")
async def epilepsy_aed_dose(req: EpilepsyAedDoseRequest):
    """
    mhGAP-IG first-line AED selection and weight-based dosing with interaction flags.
    """
    data = _load_supporting_json("epilepsy_protocol.json")
    dosing = data["aed_dosing"]
    first_line = data["aed_first_line"]
    wra_safety = data["wra_aed_safety"]
    interactions = data["drug_interactions"]

    warnings = []
    recommendations = []
    selected_aed = None

    is_pediatric = req.patient_age_years < 18
    is_focal = "focal" in req.seizure_type.lower()
    is_absence = "absence" in req.seizure_type.lower()
    is_gtc = "generalised" in req.seizure_type.lower() or "tonic" in req.seizure_type.lower()

    # AED selection
    if req.is_wra:
        warnings.append("Women of reproductive age: AVOID sodium valproate — teratogenic (neural tube defects, neurodevelopmental harm). Preferred AED: lamotrigine.")
        if is_gtc or is_focal:
            selected_aed = "lamotrigine"
        else:
            selected_aed = "lamotrigine"
        warnings.append("Folic acid 5mg daily recommended for all women of reproductive age on AEDs.")
        warnings.append("All enzyme-inducing AEDs (phenobarbital, carbamazepine, phenytoin) reduce OCP efficacy — advise barrier contraception.")
    elif is_pediatric:
        if is_absence:
            selected_aed = "sodium_valproate" if not req.comorbidities or "liver_disease" not in req.comorbidities else "ethosuximide"
        elif is_focal:
            selected_aed = "phenobarbital" if req.low_resource_setting else "carbamazepine"
        else:
            selected_aed = "phenobarbital" if req.low_resource_setting else "sodium_valproate"
    else:
        if is_focal:
            selected_aed = "phenobarbital" if req.low_resource_setting else "carbamazepine"
        elif is_gtc:
            selected_aed = "phenobarbital" if req.low_resource_setting else "sodium_valproate"
        else:
            selected_aed = "phenobarbital"

    # Override if contraindicated
    if selected_aed == "sodium_valproate" and "liver_disease" in (req.comorbidities or []):
        selected_aed = "phenobarbital"
        warnings.append("Sodium valproate contraindicated in liver disease — switched to phenobarbital.")
    if selected_aed == "sodium_valproate" and "pregnancy" in (req.comorbidities or []):
        selected_aed = "lamotrigine"
        warnings.append("Sodium valproate CONTRAINDICATED in pregnancy. Switching to lamotrigine — urgent specialist review required.")

    # Dosing
    dose_info = dosing.get(selected_aed, {})
    dose_recommendation = {}
    if is_pediatric and req.patient_weight_kg:
        starting = dose_info.get("pediatric_mg_per_kg_starting", 0) * req.patient_weight_kg
        max_dose = dose_info.get("pediatric_mg_per_kg_max", 0) * req.patient_weight_kg
        dose_recommendation = {
            "starting_dose_mg": round(starting, 1),
            "max_dose_mg": round(max_dose, 1),
            "frequency": dose_info.get("adult_frequency", "daily"),
            "weight_kg": req.patient_weight_kg
        }
    else:
        dose_recommendation = {
            "starting_dose_mg": dose_info.get("adult_starting_mg"),
            "maintenance_range_mg": dose_info.get("adult_maintenance_range_mg"),
            "target_dose_mg": dose_info.get("adult_target_mg"),
            "frequency": dose_info.get("adult_frequency"),
        }

    # Drug interaction checks
    interaction_alerts = []
    for interaction in interactions:
        if interaction["aed"].lower() == selected_aed.replace("_", " ").lower() or \
           interaction["aed"].lower() == selected_aed.lower():
            if req.concurrent_arv and "ARV" in interaction.get("interacting_drug_class", ""):
                interaction_alerts.append({
                    "severity": interaction["severity"],
                    "interaction": f"{selected_aed} + ARVs: {interaction['effect']}",
                    "management": interaction["management"]
                })
            if req.concurrent_tb_treatment and "TB" in interaction.get("interacting_drug_class", ""):
                interaction_alerts.append({
                    "severity": interaction["severity"],
                    "interaction": f"{selected_aed} + TB drugs: {interaction['effect']}",
                    "management": interaction["management"]
                })

    # Drug level monitoring
    level_info = data.get("drug_level_thresholds", {}).get(selected_aed, {})

    return {
        "recommended_aed": selected_aed,
        "dose_recommendation": dose_recommendation,
        "drug_level_monitoring": level_info,
        "interaction_alerts": sorted(interaction_alerts, key=lambda x: {"critical": 0, "major": 1, "moderate": 2}.get(x["severity"], 3)),
        "warnings": warnings,
        "notes": dose_info.get("notes", ""),
        "follow_up": data["follow_up_schedule"]["newly_diagnosed"]
    }
```

### 6c. `POST /cdss/epilepsy/drug-interactions`

```python
@app.post("/cdss/epilepsy/drug-interactions")
async def epilepsy_drug_interactions(req: EpilepsyDrugInteractionRequest):
    """
    AED vs concurrent medication interaction checker (ARVs, TB drugs, other AEDs).
    """
    data = _load_supporting_json("epilepsy_protocol.json")
    interactions = data["drug_interactions"]
    wra_safety = data["wra_aed_safety"]

    alerts = []
    aed_normalised = req.aed_name.lower().replace(" ", "_")

    for interaction in interactions:
        if interaction["aed"].lower().replace(" ", "_") == aed_normalised:
            for concurrent in req.concurrent_drugs:
                concurrent_lower = concurrent.lower()
                examples_lower = [e.lower() for e in interaction.get("examples", [])]
                drug_class = interaction.get("interacting_drug_class", "").lower()
                if concurrent_lower in examples_lower or \
                   any(concurrent_lower in ex for ex in examples_lower) or \
                   concurrent_lower in drug_class:
                    alerts.append({
                        "aed": req.aed_name,
                        "interacting_drug": concurrent,
                        "drug_class": interaction["interacting_drug_class"],
                        "mechanism": interaction["mechanism"],
                        "clinical_effect": interaction["effect"],
                        "severity": interaction["severity"],
                        "management": interaction["management"]
                    })

    # WRA-specific AED check
    wra_warnings = []
    if req.is_wra and aed_normalised in [w.lower().replace(" ", "_") for w in wra_safety["contraindicated"]]:
        wra_warnings.append(f"{req.aed_name} is CONTRAINDICATED in women of reproductive age. {wra_safety['notes']}")
    elif req.is_wra and aed_normalised in [w.lower().replace(" ", "_") for w in wra_safety["caution_counselling_required"]]:
        wra_warnings.append(f"{req.aed_name} requires counselling for women of reproductive age. {wra_safety['notes']}")

    sorted_alerts = sorted(alerts, key=lambda x: {"critical": 0, "major": 1, "moderate": 2, "minor": 3}.get(x["severity"], 4))

    return {
        "aed": req.aed_name,
        "interaction_count": len(sorted_alerts),
        "alerts": sorted_alerts,
        "wra_warnings": wra_warnings,
        "has_critical": any(a["severity"] == "critical" for a in sorted_alerts)
    }
```

### 6d. `POST /cdss/epilepsy/status-epilepticus`

```python
@app.post("/cdss/epilepsy/status-epilepticus")
async def epilepsy_status_epilepticus(req: EpilepsyStatusEpilepticusRequest):
    """
    Status epilepticus triage protocol — next intervention step based on duration and phase.
    """
    data = _load_supporting_json("epilepsy_protocol.json")
    protocol = data["status_epilepticus_protocol"]
    phases = protocol["phases"]

    is_pediatric = req.patient_age_years < 18
    already_in_phase = req.phase_reached or 0

    # Determine current phase
    if req.duration_minutes < 5:
        current_phase_index = 0
    elif req.duration_minutes < 20:
        current_phase_index = 1
    elif req.duration_minutes < 40:
        current_phase_index = 2
    else:
        current_phase_index = 3

    current_phase = phases[current_phase_index]

    # Build recommended action
    action = {
        "phase": current_phase["phase"],
        "time_window": current_phase["time_minutes"],
        "immediate_action": current_phase["action"],
        "drug": current_phase.get("drug"),
        "is_refractory": current_phase_index >= 3
    }

    if current_phase.get("drug") and current_phase["drug"] != "ICU_referral":
        drug = current_phase["drug"]
        if is_pediatric and req.patient_weight_kg:
            dose = current_phase.get("dose_pediatric", "").replace(
                "0.3 mg/kg", f"{round(0.3 * req.patient_weight_kg, 1)} mg"
            ).replace(
                "0.5 mg/kg", f"{round(0.5 * req.patient_weight_kg, 1)} mg"
            ).replace(
                "20 mg/kg", f"{round(20 * req.patient_weight_kg, 0):.0f} mg"
            ).replace(
                "1 mg/kg/min", f"{round(req.patient_weight_kg, 0):.0f} mg/min max rate"
            )
            action["dose"] = dose or current_phase.get("dose_pediatric", "")
        else:
            action["dose"] = current_phase.get("dose_adult", "")
        action["alternative"] = current_phase.get("alternative", None)
        if drug == "diazepam" and not req.iv_access:
            action["route_note"] = "No IV access — use rectal diazepam"
        if drug in (req.drugs_available or []) or not req.drugs_available:
            action["drug_available"] = True
        else:
            action["drug_available"] = False
            action["drug_note"] = f"{drug} not listed as available — check pharmacy. Alternative: {current_phase.get('alternative', 'seek senior help')}"

    if current_phase_index >= 3:
        action["urgent_referral"] = "URGENT ICU referral for refractory status epilepticus. Mortality 20–30% without anaesthetic management."

    return {
        "duration_minutes": req.duration_minutes,
        "se_definition": protocol["definition"],
        "current_recommendation": action,
        "next_phase_trigger": f"If seizure continues beyond {phases[min(current_phase_index+1, 3)]['time_minutes']} min, escalate to Phase {min(current_phase_index + 2, 4)}",
        "is_status_epilepticus": req.duration_minutes >= 5
    }
```

---

## 7. EHR Service

### 7a. `services/ehr-service/src/services/epilepsy.service.ts`

Inject `EpilepsyRegister`, `AedTherapyRecord`, `AedToxicityEvent` repositories and `CdssService`.

Methods:
- `enroll(tenantId, patientId, enrolledBy, dto)` → saves `EpilepsyRegister`; `pregnancyRiskCounselled` defaults to `false` — do not auto-detect; caller supplies via DTO
- `getRegister(tenantId, patientId)` → latest register entry
- `updateRegister(tenantId, id, dto)` → patch status, seizure freedom, next review
- `recordAedTherapy(tenantId, patientId, recordedBy, dto)` → saves `AedTherapyRecord`; automatically calls `cdssService.epilepsyDrugInteractions()` with `concurrent_drugs` from dto if provided, returns `{ aedRecord, interactionAlerts }`
- `getAedTherapy(tenantId, patientId)` → all records DESC; `stop_date IS NULL` records are active
- `stopAedTherapy(tenantId, id, stopDate, stopReason)` → sets stop_date and stop_reason
- `recordToxicityEvent(tenantId, patientId, recordedBy, dto)` → saves `AedToxicityEvent`
- `getToxicityEvents(tenantId, patientId)` → all events DESC
- `getAedDose(tenantId, payload)` → calls `cdssService.epilepsyAedDose(payload, tenantId)`
- `checkDrugInteractions(tenantId, payload)` → calls `cdssService.epilepsyDrugInteractions(payload, tenantId)`
- `getStatusEpilepticusProtocol(tenantId, payload)` → calls `cdssService.epilepsyStatusEpilepticus(payload, tenantId)`

### 7b. `services/ehr-service/src/controllers/epilepsy.controller.ts`

All routes under `/epilepsy/`:

| Method | Path | Service call |
|---|---|---|
| POST | `/epilepsy/patient/:patientId/enroll` | `enroll` |
| GET | `/epilepsy/patient/:patientId/register` | `getRegister` |
| PATCH | `/epilepsy/register/:id` | `updateRegister` |
| POST | `/epilepsy/patient/:patientId/aed` | `recordAedTherapy` |
| GET | `/epilepsy/patient/:patientId/aed` | `getAedTherapy` |
| PATCH | `/epilepsy/aed/:id/stop` | `stopAedTherapy` |
| POST | `/epilepsy/patient/:patientId/toxicity` | `recordToxicityEvent` |
| GET | `/epilepsy/patient/:patientId/toxicity` | `getToxicityEvents` |
| POST | `/epilepsy/cdss/aed-dose` | `getAedDose` |
| POST | `/epilepsy/cdss/drug-interactions` | `checkDrugInteractions` |
| POST | `/epilepsy/cdss/status-epilepticus` | `getStatusEpilepticusProtocol` |

All routes: `@UseGuards(JwtAuthGuard)`. Extract `tenantId` from `req.tenantId` and `userId` from `(req.user as any)?.userId ?? (req.user as any)?.id`.

---

## 8. CdssService Methods

Add to `services/ehr-service/src/services/cdss.service.ts` following the established `requestWithPolicy` pattern (see existing `scdHydroxyureaDose` at line ~2241 as template):

```typescript
async epilepsyAedDose(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>(
    'POST', 'epilepsyAedDose', '/cdss/epilepsy/aed-dose',
    payload, this.defaultTimeoutMs, tenantId,
  );
}

async epilepsyDrugInteractions(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>(
    'POST', 'epilepsyDrugInteractions', '/cdss/epilepsy/drug-interactions',
    payload, this.defaultTimeoutMs, tenantId,
  );
}

async epilepsyStatusEpilepticus(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>(
    'POST', 'epilepsyStatusEpilepticus', '/cdss/epilepsy/status-epilepticus',
    payload, this.defaultTimeoutMs, tenantId,
  );
}
```

---

## 9. Module Registration

### `services/ehr-service/src/services/tenant.service.ts`

Add the three new entities to the DataSource `entities[]` array (alongside `ScdRegister` etc. at lines ~685–688):

```typescript
EpilepsyRegister,
AedTherapyRecord,
AedToxicityEvent,
```

Add imports at the top of the file:

```typescript
import { EpilepsyRegister } from '../entities/epilepsy-register.entity';
import { AedTherapyRecord } from '../entities/aed-therapy-record.entity';
import { AedToxicityEvent } from '../entities/aed-toxicity-event.entity';
```

### `services/ehr-service/src/ehr.module.ts`

Add to `controllers` array:
```typescript
EpilepsyController,
```

Add to `providers` array:
```typescript
EpilepsyService,
```

Add imports:
```typescript
import { EpilepsyController } from './controllers/epilepsy.controller';
import { EpilepsyService } from './services/epilepsy.service';
import { EpilepsyRegister } from './entities/epilepsy-register.entity';
import { AedTherapyRecord } from './entities/aed-therapy-record.entity';
import { AedToxicityEvent } from './entities/aed-toxicity-event.entity';
```

---

## 10. Frontend

### 10a. `epilepsyApi` in `ehr-frontend/src/services/api.ts`

Add `export const epilepsyApi` after `scdApi`. 13 methods:

```typescript
export const epilepsyApi = {
  enroll: (patientId: string, data: Record<string, any>) =>
    api.post(`/epilepsy/patient/${patientId}/enroll`, data),
  getRegister: (patientId: string) =>
    api.get(`/epilepsy/patient/${patientId}/register`),
  updateRegister: (id: string, data: Record<string, any>) =>
    api.patch(`/epilepsy/register/${id}`, data),
  recordAed: (patientId: string, data: Record<string, any>) =>
    api.post(`/epilepsy/patient/${patientId}/aed`, data),
  getAedTherapy: (patientId: string) =>
    api.get(`/epilepsy/patient/${patientId}/aed`),
  stopAed: (id: string, data: Record<string, any>) =>
    api.patch(`/epilepsy/aed/${id}/stop`, data),
  recordToxicity: (patientId: string, data: Record<string, any>) =>
    api.post(`/epilepsy/patient/${patientId}/toxicity`, data),
  getToxicityEvents: (patientId: string) =>
    api.get(`/epilepsy/patient/${patientId}/toxicity`),
  getAedDose: (data: Record<string, any>) =>
    api.post('/epilepsy/cdss/aed-dose', data),
  checkDrugInteractions: (data: Record<string, any>) =>
    api.post('/epilepsy/cdss/drug-interactions', data),
  getStatusEpilepticusProtocol: (data: Record<string, any>) =>
    api.post('/epilepsy/cdss/status-epilepticus', data),
  getSeizureHistory: (patientId: string) =>
    api.get(`/neurology/patient/${patientId}/seizures`),
  recordSeizure: (patientId: string, data: Record<string, any>) =>
    api.post(`/neurology/patient/${patientId}/seizures`, data),
};
```

Note: `getSeizureHistory` and `recordSeizure` proxy to the **existing** `/neurology/` endpoints — do not create new seizure endpoints.

### 10b. `ehr-frontend/src/components/EpilepsyDashboard.tsx`

4-tab component: `register` | `seizures` | `aed` | `toxicity`

**Props**: `patientId: string`

**Tab: `register`**
- Enroll form (if no register): ILAE seizure type (select), ILAE syndrome (select), etiology (select), diagnosis date, ICD-11 code, next review date, pregnancy risk counselled (checkbox)
- Existing register display: status badge, seizure freedom date, last seizure date, frequency/month, driving restriction flag, next review date
- PATCH via `epilepsyApi.updateRegister`
- AED Dose Advisor panel: seizure type, age, weight, sex, is_wra toggle, concurrent_arv toggle, concurrent_tb toggle → calls `epilepsyApi.getAedDose` → shows recommended AED, dose, warnings, interaction alerts prominently (critical = red banner)

**Tab: `seizures`**
- Read seizure history from `epilepsyApi.getSeizureHistory` (existing `/neurology/` endpoint)
- Record new seizure via `epilepsyApi.recordSeizure`
- Show: date, type, duration, status epilepticus flag, triggers, postictal state
- Status Epilepticus Protocol button: form with duration_minutes, weight, IV access toggle, available drugs → calls `epilepsyApi.getStatusEpilepticusProtocol` → renders current phase recommendation with drug + dose in a high-contrast card

**Tab: `aed`**
- Active AED list (stop_date IS NULL) with stop action
- Add AED form: drug name (select from known AEDs), dose_mg, frequency, route, start_date, drug_level_result, drug_level_unit, drug_level_date
- On submit, display returned `interactionAlerts` inline before saving confirmation
- Drug level history per AED with therapeutic range indicator
- Drug interaction checker: select AED, enter concurrent drugs (comma-separated or multi-select) → calls `epilepsyApi.checkDrugInteractions` → renders severity-sorted alert cards

**Tab: `toxicity`**
- Record toxicity event form: drug_name, toxicity_type (select from known profiles), severity (select), organ_system, clinical_findings, lab_markers (JSON field), action_taken, outcome
- Toxicity event history table: date, drug, type, severity badge, outcome

### 10c. `ehr-frontend/src/pages/NurseDashboard.tsx`

**Four changes:**

1. **Import** (after `ScdDashboard` import ~line 41):
```tsx
import EpilepsyDashboard from '../components/EpilepsyDashboard';
```

2. **`activeTab` union** — add `| 'epilepsy'` to the existing union type at line ~241:
```typescript
// Current ends with: | 'scd'>('dashboard')
// Change to:        | 'scd' | 'epilepsy'>('dashboard')
```

3. **Sidebar NCD child entry** (after the `{ label: 'Sickle Cell Disease', tab: 'scd', icon: Droplets }` entry at line ~1036):
```tsx
{ label: 'Epilepsy', tab: 'epilepsy', icon: Brain },
```
`Brain` is already imported from `lucide-react` (used in mental health — verify; if not present add to the existing lucide import line).

4. **Render block** (after the `scd` render block at lines ~5130–5135):
```tsx
{activeTab === 'epilepsy' && selectedPatient && (
  <EpilepsyDashboard patientId={selectedPatient.id} />
)}
{activeTab === 'epilepsy' && !selectedPatient && (
  <div className="p-8 text-center text-gray-500">Select a patient to view the Epilepsy NCD Register</div>
)}
```

---

## 11. Provisioning — Post-Implementation Steps

After all code changes are committed:

```bash
# 1. Rebuild tenant-service to include the new bundle
docker compose build tenant-service

# 2. Bring up updated container
docker compose up -d tenant-service

# 3. Apply bundle to all tenant databases
npm run repair:tenants
# or:
npm run provision:all-tenants
```

Verify bundle applied:
```
bundle.apply.success sprint145_epilepsy_ncd_register v2026.04.12.19
```

---

## 12. Acceptance Criteria

### TypeScript / NestJS
- [ ] `tsc --noEmit` passes with zero errors across `ehr-service` and `tenant-service`
- [ ] All 3 entities compile; `@Entity` decorator names match DDL table names exactly
- [ ] `epilepsy.service.ts` and `epilepsy.controller.ts` import correctly; no circular dependencies
- [ ] `EpilepsyController` and `EpilepsyService` appear in `ehr.module.ts` `controllers[]` and `providers[]`
- [ ] All 3 entities appear in `tenant.service.ts` DataSource `entities[]`

### Python / CDSS
- [ ] `python3 -c "import ast; ast.parse(open('services/cdss-service/main.py').read()); print('ok')"` passes
- [ ] `epilepsy_protocol.json` parses as valid JSON
- [ ] All three endpoints registered: `POST /cdss/epilepsy/aed-dose`, `/cdss/epilepsy/drug-interactions`, `/cdss/epilepsy/status-epilepticus`

### Provisioning
- [ ] `tenant-epilepsy.statements.ts` exports `TENANT_EPILEPSY_STATEMENTS` and `TENANT_EPILEPSY_BUNDLE_VERSION`
- [ ] Bundle registered in `database-provisioning.service.ts` with correct ID, label, version
- [ ] After container rebuild + `repair:tenants`: all 3 tables (`epilepsy_register`, `aed_therapy_records`, `aed_toxicity_events`) exist in each tenant database

### Frontend
- [ ] `epilepsyApi` has exactly 13 methods in `api.ts`
- [ ] `EpilepsyDashboard.tsx` renders without TypeScript errors; 4 tab keys present
- [ ] `NurseDashboard.tsx`: `'epilepsy'` in `activeTab` union, `Brain` icon imported, sidebar entry present, render block present

### CDSS Acceptance Cases

**Case 1 — AED dose, adult male focal epilepsy, low-resource:**
```json
POST /cdss/epilepsy/aed-dose
{ "seizure_type": "focal_aware", "patient_age_years": 34, "patient_weight_kg": 70, "sex": "male", "low_resource_setting": true, "concurrent_arv": false, "concurrent_tb_treatment": false }
```
Expected: `recommended_aed = "phenobarbital"`, starting dose 60mg, maintenance 60–180mg, drug level threshold 15–40 mcg/mL.

**Case 2 — AED dose, woman of reproductive age with ARV co-treatment:**
```json
POST /cdss/epilepsy/aed-dose
{ "seizure_type": "generalised_tonic_clonic", "patient_age_years": 26, "sex": "female", "is_wra": true, "concurrent_arv": true, "low_resource_setting": true }
```
Expected: `recommended_aed = "lamotrigine"`, VPA avoid warning present, folic acid warning present, ARV interaction note (if lamotrigine also has an ARV interaction — if none, `interaction_alerts = []` is correct).

**Case 3 — Drug interaction, phenobarbital + efavirenz:**
```json
POST /cdss/epilepsy/drug-interactions
{ "aed_name": "phenobarbital", "concurrent_drugs": ["efavirenz"], "is_wra": false }
```
Expected: `has_critical = true`, one alert with `severity = "critical"`, management recommends dolutegravir-based ART.

**Case 4 — Drug interaction, carbamazepine + rifampicin:**
```json
POST /cdss/epilepsy/drug-interactions
{ "aed_name": "carbamazepine", "concurrent_drugs": ["rifampicin"], "is_wra": false }
```
Expected: one alert `severity = "critical"`, effect mentions 50–70% reduction in CBZ levels.

**Case 5 — Status epilepticus, 12-minute seizure, pediatric 20kg, IV access, diazepam available:**
```json
POST /cdss/epilepsy/status-epilepticus
{ "duration_minutes": 12, "patient_age_years": 7, "patient_weight_kg": 20, "iv_access": true, "drugs_available": ["diazepam"] }
```
Expected: Phase 2, drug = `diazepam`, pediatric dose ~6mg IV (0.3 × 20), `is_status_epilepticus = true`.

**Case 6 — Status epilepticus, 35-minute seizure, adult, no diazepam, phenobarbital available:**
```json
POST /cdss/epilepsy/status-epilepticus
{ "duration_minutes": 35, "patient_age_years": 45, "patient_weight_kg": 75, "iv_access": true, "drugs_available": ["phenobarbital"] }
```
Expected: Phase 3, drug = `phenobarbital`, dose = 20mg/kg = 1500mg IV, `is_status_epilepticus = true`.

---

## 13. What Not to Change

- Do **not** modify `seizure-record.entity.ts`, `neurology.controller.ts`, or any existing `/neurology/` CDSS endpoints
- Do **not** add a new `seizure_records` table or duplicate seizure recording — use the existing table and endpoints
- Do **not** auto-detect `pregnancyRiskCounselled` or `drivingRestriction` from other records — both default to `false` and are set explicitly by the clinician via the form
- The `Brain` lucide-react icon: verify it is already imported in `NurseDashboard.tsx` before adding it. If absent, add it to the existing lucide import statement — do not add a second import line for lucide-react
