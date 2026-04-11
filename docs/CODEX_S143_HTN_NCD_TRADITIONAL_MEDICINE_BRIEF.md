# Codex Sprint Brief — S143: Hypertension Register + WHO PEN NCD Protocol + Traditional Medicine & Herb-Drug Interactions

**Date:** 2026-04-11
**Branch:** main
**Reviewer:** Claude (signs off before you move to S144)

---

## 1. Goal

This sprint delivers two distinct but clinically linked modules:

**Part A — Already implemented (do NOT recreate):**
- **Hypertension (HTN) Register** — WHO PEN NCD chronic disease register: enrolment, serial BP readings, treatment step progression
- **WHO PEN Step Therapy** — 4-step pharmacotherapy protocol with BP-target adjudication per comorbidity (DM/CKD/HF/post-MI/pregnancy/age ≥80)
- **CVD Risk Stratification** — simplified 10-year risk scoring → low/moderate/high/very_high tier + action
- **NCD Treatment Reviews** — structured clinician review records capturing PEN step, adherence, side effects, referral triggers

**Part B — New work for Codex:**
- **Traditional Medicine (TM) Documentation module** — structured recording of herbal/traditional remedies alongside conventional prescriptions
- **Herb-Drug Interaction (HDI) CDSS** — real-time alerts for pharmacokinetic and pharmacodynamic interactions (CYP450 enzyme system), patterned after existing DDI checks
- **ICD-11 TM2 / SNOMED CT coding** — terminological anchoring so TM data is interoperable and research-ready
- **Adherence linkage** — TM use as an explanatory factor for non-adherence to conventional therapy
- **Toxicity tracker** — unexplained hepato/nephrotoxicity flagged when recorded herb matches known hepatotoxic/nephrotoxic agents

---

## 2. What Already Exists — Do NOT Recreate

### Part A — S143 HTN/NCD (already live, do NOT touch)

#### CDSS (`services/cdss-service/main.py`)
- `POST /cdss/htn/step-therapy` — WHO PEN 4-step adjudication
- `POST /cdss/htn/cvd-risk` — CVD risk point scoring → tier + 10yr %
- Data file: `services/cdss-service/data/who_pen_htn_protocol.json`

#### EHR Service (`services/ehr-service/src/`)
- `entities/htn-register.entity.ts` + `htn_register` table — HTN enrolment record
- `entities/bp-reading.entity.ts` + `bp_readings` table — serial BP observations
- `entities/ncd-treatment-review.entity.ts` + `ncd_treatment_reviews` table — PEN step reviews
- `services/hypertension.service.ts` — enrol, recordBp, getBpHistory, recordReview, getReviews
- `controllers/hypertension.controller.ts` — all routes under `/hypertension/`
  - `POST /hypertension/patient/:id/register`
  - `GET  /hypertension/patient/:id/register`
  - `PATCH /hypertension/register/:id`
  - `POST /hypertension/patient/:id/bp`
  - `GET  /hypertension/patient/:id/bp`
  - `POST /hypertension/patient/:id/reviews`
  - `GET  /hypertension/patient/:id/reviews`
  - `POST /hypertension/cdss/step-therapy`
  - `POST /hypertension/cdss/cvd-risk`
- `services/cdss.service.ts` — `htnStepTherapy()` and `htnCvdRisk()` methods (already added)

#### Provisioning
- File: `services/tenant-service/src/generated/tenant-htn-ncd.statements.ts`
- Bundle ID: `sprint143_htn_ncd_register` — version `2026.04.11.16`
- **Already applied** to all tenant databases — do NOT re-run provisioning for this bundle

#### Frontend
- `ehr-frontend/src/components/HypertensionDashboard.tsx` — 3-tab component (BP readings, register, reviews)
- `ehr-frontend/src/services/api.ts` — `hypertensionApi` namespace (enroll, getRegisterEntry, updateRegisterEntry, recordBp, getBpHistory, recordReview, getReviews, getStepTherapy, getCvdRisk)
- `ehr-frontend/src/pages/NurseDashboard.tsx` — NCD / Hypertension sidebar section + render block already added

#### Module registration
- `ehr-service/src/ehr.module.ts` — `HypertensionController` and `HypertensionService` already registered
- `ehr-service/src/services/tenant.service.ts` — `HtnRegister`, `BpReading`, `NcdTreatmentReview` already in DataSource `entities[]`

### Pre-existing modules — do NOT touch
- `controllers/pmtct.controller.ts`, `services/pmtct.service.ts` — PMTCT
- `controllers/cervical-cancer.controller.ts`, `services/cervical-cancer.service.ts` — Cervical screening (S142)
- `controllers/family-planning.controller.ts`, `services/family-planning.service.ts` — Family planning (S142)
- `controllers/mental-health.controller.ts` — mhGAP (S141)
- `controllers/oncology.controller.ts` — general oncology
- Any other existing controller — leave untouched

---

## 3. Database Changes (Part B — New)

### 3a. New tables

```sql
-- ── Traditional Medicine Remedies ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tm_remedies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL,
  recorded_by           UUID NOT NULL,
  recorded_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  remedy_name           VARCHAR(200) NOT NULL,          -- local/common name
  scientific_name       VARCHAR(200),                   -- botanical/Latin name
  preparation           VARCHAR(50),                    -- decoction | infusion | powder | raw | capsule | topical | other
  route                 VARCHAR(30) DEFAULT 'oral',     -- oral | topical | inhaled | rectal | other
  dose_description      TEXT,                           -- free text (e.g. "1 cup twice daily")
  frequency             VARCHAR(50),                    -- daily | twice_daily | weekly | as_needed
  duration_days         INT,                            -- intended duration; NULL = ongoing
  indication            TEXT,                           -- patient-reported reason for use
  source                VARCHAR(50),                    -- traditional_healer | self | family | pharmacy | online
  icd11_tm2_code        VARCHAR(30),                    -- ICD-11 TM2 code if available
  snomed_concept_id     VARCHAR(30),                    -- SNOMED CT substance concept
  is_disclosed          BOOLEAN NOT NULL DEFAULT true,  -- patient disclosed to clinician
  is_ongoing            BOOLEAN NOT NULL DEFAULT true,
  stopped_at            DATE,
  notes                 TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tm_remedy_patient     ON tm_remedies(patient_id);
CREATE INDEX IF NOT EXISTS idx_tm_remedy_recorded_at ON tm_remedies(recorded_at);
CREATE INDEX IF NOT EXISTS idx_tm_remedy_ongoing     ON tm_remedies(is_ongoing);

-- ── Herb-Drug Interaction Alerts ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hdi_alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL,
  tm_remedy_id          UUID,                           -- links to tm_remedies.id (no FK constraint)
  drug_name             VARCHAR(200) NOT NULL,          -- conventional drug involved
  drug_rxcui            VARCHAR(30),                    -- RxNorm CUI if available
  interaction_type      VARCHAR(30) NOT NULL,           -- pharmacokinetic | pharmacodynamic | unknown
  mechanism             VARCHAR(100),                   -- e.g. CYP3A4_inhibition | serotonin_syndrome | additive_sedation
  severity              VARCHAR(15) NOT NULL,           -- contraindicated | major | moderate | minor | informational
  clinical_effect       TEXT NOT NULL,                  -- plain-language description of the effect
  management            TEXT,                           -- recommended clinical action
  evidence_level        VARCHAR(10),                    -- high | moderate | low | theoretical
  triggered_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  acknowledged_by       UUID,
  acknowledged_at       TIMESTAMP WITH TIME ZONE,
  override_reason       TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hdi_alert_patient     ON hdi_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_hdi_alert_severity    ON hdi_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_hdi_alert_acknowledged ON hdi_alerts(acknowledged_at);

-- ── TM Toxicity Events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tm_toxicity_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL,
  tm_remedy_id          UUID,                           -- suspect remedy (no FK)
  recorded_by           UUID NOT NULL,
  recorded_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  organ_system          VARCHAR(30) NOT NULL,           -- hepatic | renal | cardiac | neurological | haematological | other
  presentation          TEXT NOT NULL,                  -- clinical presentation description
  lab_markers           JSONB,                          -- e.g. {"ALT":320,"AST":280,"creatinine":2.1}
  causality_assessment  VARCHAR(20),                    -- definite | probable | possible | unlikely
  outcome               VARCHAR(30),                    -- resolved | ongoing | hospitalised | fatal
  notes                 TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tm_toxicity_patient   ON tm_toxicity_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_tm_toxicity_organ     ON tm_toxicity_events(organ_system);
```

### 3b. Provisioning bundle

File: `services/tenant-service/src/generated/tenant-tm-hdi.statements.ts`
Bundle version: `2026.04.11.17`

```typescript
export const TENANT_TM_HDI_BUNDLE_VERSION = '2026.04.11.17';
export const TENANT_TM_HDI_STATEMENTS = (): string[] => [
  // all CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS statements above
];
```

Register in `services/tenant-service/src/services/database-provisioning.service.ts` — import and add after the `sprint143_htn_ncd_register` entry:

```typescript
{
  id: 'sprint143b_traditional_medicine_hdi',
  label: 'Traditional Medicine Documentation + Herb-Drug Interaction Alerts',
  version: TENANT_TM_HDI_BUNDLE_VERSION,
  description: 'S143b — TM remedy records, HDI alerts, TM toxicity events',
  statements: TENANT_TM_HDI_STATEMENTS,
},
```

---

## 4. New Entities (Part B)

All files go in `services/ehr-service/src/entities/`.

### `tm-remedy.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tm_remedies')
export class TmRemedy {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' }) recordedAt: Date;
  @Column({ name: 'remedy_name', length: 200 }) remedyName: string;
  @Column({ name: 'scientific_name', length: 200, nullable: true }) scientificName: string | null;
  @Column({ length: 50, nullable: true }) preparation: string | null;
  @Column({ length: 30, default: 'oral' }) route: string;
  @Column({ name: 'dose_description', type: 'text', nullable: true }) doseDescription: string | null;
  @Column({ length: 50, nullable: true }) frequency: string | null;
  @Column({ name: 'duration_days', type: 'int', nullable: true }) durationDays: number | null;
  @Column({ type: 'text', nullable: true }) indication: string | null;
  @Column({ length: 50, nullable: true }) source: string | null;
  @Column({ name: 'icd11_tm2_code', length: 30, nullable: true }) icd11Tm2Code: string | null;
  @Column({ name: 'snomed_concept_id', length: 30, nullable: true }) snomedConceptId: string | null;
  @Column({ name: 'is_disclosed', type: 'boolean', default: true }) isDisclosed: boolean;
  @Column({ name: 'is_ongoing', type: 'boolean', default: true }) isOngoing: boolean;
  @Column({ name: 'stopped_at', type: 'date', nullable: true }) stoppedAt: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

### `hdi-alert.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('hdi_alerts')
export class HdiAlert {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'tm_remedy_id', type: 'uuid', nullable: true }) tmRemedyId: string | null;
  @Column({ name: 'drug_name', length: 200 }) drugName: string;
  @Column({ name: 'drug_rxcui', length: 30, nullable: true }) drugRxcui: string | null;
  @Column({ name: 'interaction_type', length: 30 }) interactionType: string;
  @Column({ length: 100, nullable: true }) mechanism: string | null;
  @Column({ length: 15 }) severity: string;
  @Column({ name: 'clinical_effect', type: 'text' }) clinicalEffect: string;
  @Column({ type: 'text', nullable: true }) management: string | null;
  @Column({ name: 'evidence_level', length: 10, nullable: true }) evidenceLevel: string | null;
  @Column({ name: 'triggered_at', type: 'timestamptz', default: () => 'NOW()' }) triggeredAt: Date;
  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true }) acknowledgedBy: string | null;
  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true }) acknowledgedAt: Date | null;
  @Column({ name: 'override_reason', type: 'text', nullable: true }) overrideReason: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

### `tm-toxicity-event.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tm_toxicity_events')
export class TmToxicityEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'tm_remedy_id', type: 'uuid', nullable: true }) tmRemedyId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' }) recordedAt: Date;
  @Column({ name: 'organ_system', length: 30 }) organSystem: string;
  @Column({ type: 'text' }) presentation: string;
  @Column({ name: 'lab_markers', type: 'jsonb', nullable: true }) labMarkers: Record<string, number> | null;
  @Column({ name: 'causality_assessment', length: 20, nullable: true }) causalityAssessment: string | null;
  @Column({ length: 30, nullable: true }) outcome: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

Register all three in `services/ehr-service/src/services/tenant.service.ts` — add imports and append to the DataSource `entities[]` array after `NcdTreatmentReview`.

Register all three in `services/ehr-service/src/ehr.module.ts` — no controller/service changes needed yet; TypeORM picks them up from the DataSource.

---

## 5. CDSS Data File (Part B)

Create `services/cdss-service/data/herb_drug_interactions.json`:

```json
{
  "version": "2026.04.11",
  "source": "WHO-TM2 / Natural Medicines Database / Stockley's Herbal Medicines Interactions (representative subset)",
  "interactions": [
    {
      "herb_names": ["St. John's Wort", "Hypericum perforatum"],
      "snomed_concept": "412588008",
      "drug_classes": ["anticoagulants", "immunosuppressants", "antiretrovirals", "oral_contraceptives", "antidepressants_ssri"],
      "example_drugs": ["warfarin", "cyclosporine", "efavirenz", "ethinyl estradiol", "sertraline"],
      "interaction_type": "pharmacokinetic",
      "mechanism": "CYP3A4_induction + P-gp induction",
      "severity": "major",
      "clinical_effect": "Significantly reduces plasma levels of affected drugs, leading to therapeutic failure (e.g. INR drop, transplant rejection, HIV virologic failure, contraceptive failure, serotonin syndrome risk with SSRIs).",
      "management": "Avoid concurrent use. If unavoidable, increase monitoring (INR, drug levels). Counsel patient on contraceptive failure risk.",
      "evidence_level": "high"
    },
    {
      "herb_names": ["Garlic", "Allium sativum"],
      "snomed_concept": "256535006",
      "drug_classes": ["anticoagulants", "antiplatelet_agents", "antiretrovirals"],
      "example_drugs": ["warfarin", "aspirin", "ritonavir"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "additive_antiplatelet + CYP3A4_inhibition",
      "severity": "moderate",
      "clinical_effect": "Increased bleeding risk with anticoagulants/antiplatelets. High-dose garlic may reduce saquinavir levels via CYP3A4.",
      "management": "Monitor INR closely. Advise patients to disclose garlic supplement use before surgery.",
      "evidence_level": "moderate"
    },
    {
      "herb_names": ["Ginkgo biloba"],
      "snomed_concept": "256562001",
      "drug_classes": ["anticoagulants", "antiplatelet_agents", "antiepileptics", "antidepressants_ssri"],
      "example_drugs": ["warfarin", "aspirin", "valproate", "fluoxetine"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "additive_antiplatelet + serotonin_modulation",
      "severity": "moderate",
      "clinical_effect": "Increased bleeding risk. Case reports of seizures with valproate. Possible serotonin syndrome with SSRIs.",
      "management": "Monitor coagulation. Avoid in patients on antiepileptics with narrow therapeutic window.",
      "evidence_level": "moderate"
    },
    {
      "herb_names": ["Kava", "Piper methysticum"],
      "snomed_concept": "412596001",
      "drug_classes": ["benzodiazepines", "antipsychotics", "anaesthetics", "alcohol"],
      "example_drugs": ["diazepam", "haloperidol", "propofol"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "additive_CNS_depression",
      "severity": "major",
      "clinical_effect": "Dangerous additive sedation, respiratory depression. Hepatotoxicity risk (direct + additive with hepatotoxic drugs).",
      "management": "Contraindicated with CNS depressants. Stop at least 24 h before anaesthesia. Liver function monitoring.",
      "evidence_level": "high"
    },
    {
      "herb_names": ["Valerian", "Valeriana officinalis"],
      "snomed_concept": "256562002",
      "drug_classes": ["benzodiazepines", "barbiturates", "anaesthetics"],
      "example_drugs": ["lorazepam", "phenobarbital"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "additive_CNS_depression",
      "severity": "moderate",
      "clinical_effect": "Enhanced sedation, prolonged anaesthesia recovery.",
      "management": "Taper valerian before elective surgery. Inform anaesthetist.",
      "evidence_level": "moderate"
    },
    {
      "herb_names": ["Echinacea", "Echinacea purpurea"],
      "snomed_concept": "412577002",
      "drug_classes": ["immunosuppressants", "hepatotoxic_drugs"],
      "example_drugs": ["cyclosporine", "methotrexate"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "immune_stimulation + potential_hepatotoxicity",
      "severity": "moderate",
      "clinical_effect": "May antagonise immunosuppression. Possible additive hepatotoxicity with methotrexate.",
      "management": "Avoid in transplant patients or anyone on immunosuppression.",
      "evidence_level": "moderate"
    },
    {
      "herb_names": ["Ginseng", "Panax ginseng"],
      "snomed_concept": "227316000",
      "drug_classes": ["anticoagulants", "antidiabetics", "stimulants"],
      "example_drugs": ["warfarin", "metformin", "insulin", "caffeine"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "antiplatelet_effect + hypoglycaemia_potentiation",
      "severity": "moderate",
      "clinical_effect": "Increased bleeding risk. Additive hypoglycaemic effect with antidiabetics. Worsens INR variability.",
      "management": "Monitor blood glucose and INR closely. Advise diabetic patients to report hypoglycaemic episodes.",
      "evidence_level": "moderate"
    },
    {
      "herb_names": ["Liquorice", "Glycyrrhiza glabra"],
      "snomed_concept": "256563006",
      "drug_classes": ["antihypertensives", "corticosteroids", "digoxin"],
      "example_drugs": ["amlodipine", "prednisolone", "digoxin"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "pseudohyperaldosteronism + potassium_depletion",
      "severity": "major",
      "clinical_effect": "Sodium retention, hypokalaemia, oedema — antagonises antihypertensives. Potassium depletion potentiates digoxin toxicity.",
      "management": "Avoid in hypertensive patients. Monitor electrolytes and digoxin levels.",
      "evidence_level": "high"
    },
    {
      "herb_names": ["Turmeric", "Curcuma longa"],
      "snomed_concept": "227355007",
      "drug_classes": ["anticoagulants", "antiplatelet_agents", "antidiabetics"],
      "example_drugs": ["warfarin", "aspirin", "glibenclamide"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "additive_antiplatelet + CYP2C9_inhibition",
      "severity": "minor",
      "clinical_effect": "Mild increased bleeding risk at high supplemental doses. May slightly potentiate antidiabetics.",
      "management": "Informational alert at culinary doses. Monitor INR with supplemental doses (>1 g/day curcumin).",
      "evidence_level": "low"
    },
    {
      "herb_names": ["Aloe vera (oral)", "Aloe barbadensis"],
      "snomed_concept": "256604001",
      "drug_classes": ["antidiabetics", "antiarrhythmics", "corticosteroids"],
      "example_drugs": ["glibenclamide", "digoxin", "prednisolone"],
      "interaction_type": "pharmacodynamic",
      "mechanism": "hypoglycaemia_potentiation + hypokalaemia",
      "severity": "moderate",
      "clinical_effect": "Additive hypoglycaemia. Laxative effect depletes potassium → digoxin toxicity risk.",
      "management": "Avoid prolonged oral use with antidiabetics/digoxin. Monitor electrolytes.",
      "evidence_level": "moderate"
    },
    {
      "herb_names": ["African potato", "Hypoxis hemerocallidea"],
      "snomed_concept": "442562001",
      "drug_classes": ["antiretrovirals"],
      "example_drugs": ["efavirenz", "lopinavir", "nevirapine"],
      "interaction_type": "pharmacokinetic",
      "mechanism": "CYP3A4_inhibition",
      "severity": "major",
      "clinical_effect": "May reduce plasma ARV levels → HIV virologic failure. Commonly used in Southern Africa alongside ART.",
      "management": "Strongly advise against concurrent use. Document and escalate to HIV clinician.",
      "evidence_level": "moderate"
    }
  ],
  "hepatotoxic_herbs": [
    "Kava (Piper methysticum)",
    "Comfrey (Symphytum officinale)",
    "Pennyroyal (Mentha pulegium)",
    "Chaparral (Larrea tridentata)",
    "Germander (Teucrium chamaedrys)",
    "Pyrrolizidine alkaloid-containing plants",
    "Atractylis gummifera"
  ],
  "nephrotoxic_herbs": [
    "Aristolochic acid-containing plants (e.g. Aristolochia spp.)",
    "Thunder God Vine (Tripterygium wilfordii)",
    "Licorice root (high dose)"
  ]
}
```

---

## 6. CDSS Endpoints (Part B)

Add to `services/cdss-service/main.py` — insert **before** the Sprint 143 HTN section:

### 6a. Request models

```python
class TmHdiCheckRequest(BaseModel):
    herb_names: list[str]           # one or more names (common or scientific)
    current_drugs: list[str]        # drug names from active prescriptions
    drug_classes: list[str] = []    # optional drug class hints

class TmToxicityRiskRequest(BaseModel):
    herb_names: list[str]
    organ_concerns: list[str] = []  # e.g. ["hepatic", "renal"] — filters output
```

### 6b. POST `/cdss/tm/hdi-check`

```python
@app.post("/cdss/tm/hdi-check")
async def tm_hdi_check(req: TmHdiCheckRequest):
    """
    Check herb-drug interactions for a given list of herbs vs active drugs.
    Returns matched interaction records sorted by severity.
    """
    data = _load_supporting_json("herb_drug_interactions.json")
    interactions = data.get("interactions", [])
    severity_order = {"contraindicated": 0, "major": 1, "moderate": 2, "minor": 3, "informational": 4}

    hits = []
    req_herbs_lower = [h.lower() for h in req.herb_names]
    req_drugs_lower = [d.lower() for d in req.current_drugs]
    req_classes_lower = [c.lower() for c in req.drug_classes]

    for item in interactions:
        item_herbs_lower = [n.lower() for n in item["herb_names"]]
        herb_match = any(rh in ih or ih in rh for rh in req_herbs_lower for ih in item_herbs_lower)
        if not herb_match:
            continue

        drug_match = any(rd in ed.lower() or ed.lower() in rd for rd in req_drugs_lower for ed in item.get("example_drugs", []))
        class_match = any(rc in ic.lower() for rc in req_classes_lower for ic in item.get("drug_classes", []))

        if drug_match or class_match:
            hits.append({
                "herb": item["herb_names"][0],
                "snomed_concept_id": item.get("snomed_concept"),
                "matched_drugs": [d for d in req.current_drugs if any(d.lower() in ed.lower() for ed in item.get("example_drugs", []))],
                "interaction_type": item["interaction_type"],
                "mechanism": item.get("mechanism"),
                "severity": item["severity"],
                "clinical_effect": item["clinical_effect"],
                "management": item.get("management"),
                "evidence_level": item.get("evidence_level"),
            })

    hits.sort(key=lambda x: severity_order.get(x["severity"], 99))
    has_major = any(h["severity"] in ("contraindicated", "major") for h in hits)

    return {
        "herbs_checked": req.herb_names,
        "drugs_checked": req.current_drugs,
        "interactions_found": len(hits),
        "has_major_interaction": has_major,
        "alert_level": "danger" if has_major else ("warning" if hits else "none"),
        "interactions": hits,
    }
```

### 6c. POST `/cdss/tm/toxicity-risk`

```python
@app.post("/cdss/tm/toxicity-risk")
async def tm_toxicity_risk(req: TmToxicityRiskRequest):
    """
    Flags if any herb in the list has known hepatotoxic or nephrotoxic risk.
    """
    data = _load_supporting_json("herb_drug_interactions.json")
    hepatotoxic = [h.lower() for h in data.get("hepatotoxic_herbs", [])]
    nephrotoxic = [h.lower() for h in data.get("nephrotoxic_herbs", [])]

    req_herbs_lower = [h.lower() for h in req.herb_names]
    flags = []

    for herb in req.herb_names:
        herb_l = herb.lower()
        if any(herb_l in hh or hh in herb_l for hh in hepatotoxic):
            flags.append({"herb": herb, "risk": "hepatotoxic", "organ_system": "hepatic",
                          "clinical_note": "Known hepatotoxic herb. Monitor LFTs (ALT, AST, bilirubin). Causality assessment required for unexplained liver dysfunction."})
        if any(herb_l in nh or nh in herb_l for nh in nephrotoxic):
            flags.append({"herb": herb, "risk": "nephrotoxic", "organ_system": "renal",
                          "clinical_note": "Known nephrotoxic herb. Monitor creatinine, eGFR, urinalysis."})

    organ_filtered = [f for f in flags if not req.organ_concerns or f["organ_system"] in req.organ_concerns]

    return {
        "herbs_checked": req.herb_names,
        "toxicity_flags": organ_filtered,
        "has_toxicity_risk": len(organ_filtered) > 0,
        "recommendation": "Obtain relevant organ function labs and document in TM toxicity events." if organ_filtered else "No known toxicity risk flagged for these herbs.",
    }
```

---

## 7. EHR Service Layer (Part B)

### 7a. `services/ehr-service/src/services/traditional-medicine.service.ts`

Inject `TmRemedy`, `HdiAlert`, `TmToxicityEvent` repositories from TypeORM and `CdssService`.

Methods:
- `recordRemedy(patientId, recordedBy, dto)` → saves `TmRemedy`; immediately calls `checkInteractions()` against patient's active prescriptions
- `getRemedies(patientId)` → returns all remedies DESC by `recorded_at`
- `updateRemedy(id, dto)` → patch `is_ongoing`, `stopped_at`, `notes`
- `checkInteractions(patientId, herbs, activeDrugs)` → calls `cdssService.tmHdiCheck()`, saves any returned alerts as `HdiAlert` records
- `getAlerts(patientId)` → returns all `HdiAlert` DESC, unacknowledged first
- `acknowledgeAlert(alertId, userId, overrideReason)` → sets `acknowledged_by`, `acknowledged_at`, `override_reason`
- `recordToxicityEvent(patientId, recordedBy, dto)` → saves `TmToxicityEvent`; calls `cdssService.tmToxicityRisk()` for additional guidance
- `getToxicityEvents(patientId)` → returns all events DESC

### 7b. `services/ehr-service/src/controllers/traditional-medicine.controller.ts`

All routes under `/traditional-medicine/`:

```
POST   /traditional-medicine/patient/:patientId/remedies          → recordRemedy
GET    /traditional-medicine/patient/:patientId/remedies          → getRemedies
PATCH  /traditional-medicine/remedies/:id                         → updateRemedy
POST   /traditional-medicine/patient/:patientId/interactions      → checkInteractions (manual re-check)
GET    /traditional-medicine/patient/:patientId/alerts            → getAlerts
PATCH  /traditional-medicine/alerts/:alertId/acknowledge          → acknowledgeAlert
POST   /traditional-medicine/patient/:patientId/toxicity          → recordToxicityEvent
GET    /traditional-medicine/patient/:patientId/toxicity          → getToxicityEvents
POST   /traditional-medicine/cdss/hdi-check                       → proxy to CDSS
POST   /traditional-medicine/cdss/toxicity-risk                   → proxy to CDSS
```

### 7c. `services/ehr-service/src/services/cdss.service.ts`

Add after `htnCvdRisk()`:

```typescript
async tmHdiCheck(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>('POST', 'tmHdiCheck', '/cdss/tm/hdi-check', payload, this.defaultTimeoutMs, tenantId);
}
async tmToxicityRisk(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>('POST', 'tmToxicityRisk', '/cdss/tm/toxicity-risk', payload, this.defaultTimeoutMs, tenantId);
}
```

### 7d. `services/ehr-service/src/ehr.module.ts`

Add `TraditionalMedicineController` to `controllers[]` and `TraditionalMedicineService` to `providers[]`.

---

## 8. Frontend (Part B)

### 8a. `ehr-frontend/src/services/api.ts`

Add `traditionalMedicineApi` export:

```typescript
export const traditionalMedicineApi = {
  recordRemedy: (patientId: string, data: any) =>
    ehrApi.post(`/traditional-medicine/patient/${patientId}/remedies`, data).then(r => r.data),
  getRemedies: (patientId: string) =>
    ehrApi.get(`/traditional-medicine/patient/${patientId}/remedies`).then(r => r.data),
  updateRemedy: (id: string, data: any) =>
    ehrApi.patch(`/traditional-medicine/remedies/${id}`, data).then(r => r.data),
  checkInteractions: (patientId: string, data: any) =>
    ehrApi.post(`/traditional-medicine/patient/${patientId}/interactions`, data).then(r => r.data),
  getAlerts: (patientId: string) =>
    ehrApi.get(`/traditional-medicine/patient/${patientId}/alerts`).then(r => r.data),
  acknowledgeAlert: (alertId: string, data: any) =>
    ehrApi.patch(`/traditional-medicine/alerts/${alertId}/acknowledge`, data).then(r => r.data),
  recordToxicityEvent: (patientId: string, data: any) =>
    ehrApi.post(`/traditional-medicine/patient/${patientId}/toxicity`, data).then(r => r.data),
  getToxicityEvents: (patientId: string) =>
    ehrApi.get(`/traditional-medicine/patient/${patientId}/toxicity`).then(r => r.data),
  hdiCheck: (data: any) =>
    ehrApi.post('/traditional-medicine/cdss/hdi-check', data).then(r => r.data),
  toxicityRisk: (data: any) =>
    ehrApi.post('/traditional-medicine/cdss/toxicity-risk', data).then(r => r.data),
};
```

### 8b. `ehr-frontend/src/components/TraditionalMedicineDashboard.tsx`

New component — 3 tabs:

**Tab 1 — `remedies`** "Remedies & Interactions"
- Form: remedy name, scientific name, preparation, route, dose, frequency, duration, indication, source, ICD-11 TM2 code, SNOMED concept ID, `is_disclosed` toggle
- On submit: POST remedy → automatically triggers HDI check against patient's active prescriptions
- HDI alert banner below form — colour-coded by severity (`danger` = red, `warning` = amber, `none` = green)
- Table of all recorded remedies with status chip (ongoing/stopped)

**Tab 2 — `alerts`** "Herb-Drug Alerts"
- List of all `HdiAlert` records, unacknowledged first
- Each card shows: herb, matched drug, severity badge, mechanism, clinical effect, management guidance
- Acknowledge button with override reason textarea
- Manual re-check button (re-runs checkInteractions with all ongoing remedies)

**Tab 3 — `toxicity`** "Toxicity Events"
- Form: organ system (hepatic/renal/cardiac/neurological/haematological/other), presentation text, lab markers (JSON key-value entry), causality assessment, outcome
- List of past toxicity events

### 8c. `ehr-frontend/src/pages/NurseDashboard.tsx`

1. Import: `import TraditionalMedicineDashboard from '../components/TraditionalMedicineDashboard'`
2. Extend `activeTab` union: add `| 'traditional-medicine'`
3. Add to the `ncd` sidebar section children:
   ```typescript
   { label: 'Traditional Medicine', tab: 'traditional-medicine', icon: Leaf }
   ```
   (import `Leaf` from `lucide-react`)
4. Add render block inside `activeSection === 'ncd'`:
   ```tsx
   {activeTab === 'traditional-medicine' && selectedPatient && (
     <TraditionalMedicineDashboard patientId={selectedPatient.id} />
   )}
   {activeTab === 'traditional-medicine' && !selectedPatient && (
     <div className="text-slate-500 text-sm">Select a patient to view their traditional medicine record.</div>
   )}
   ```

---

## 9. Rationale — Why Traditional Medicine belongs in a modern EHR

### Clinical Safety (primary driver)
- Many patients concurrently use herbal remedies and conventional drugs **without disclosing** — creating an information gap that causes preventable adverse drug events
- Herbs modulate the **CYP450 enzyme system** (the primary metabolic pathway for most pharmaceuticals):
  - **Inducers** (St. John's Wort, African potato) → sub-therapeutic drug levels → treatment failure
  - **Inhibitors** (Kava, Ginkgo) → drug accumulation → toxicity
- HDI alerts at the point of prescribing/dispensing prevent these events **before** they occur

### Terminological Interoperability
- **ICD-11 TM2** (WHO International Classification of Diseases — Traditional Medicine module) provides official codes for TM conditions and substances — data coded to this standard is understandable across health systems
- **SNOMED CT** substance concepts enable cross-institutional data exchange and pharmacovigilance research
- **LOINC** codes are useful for lab observations influenced by herbal intake (e.g. LFTs, INR)
- All three coding fields are nullable — data remains useful even without codes

### 360-Degree Patient Profiling
- Non-adherence to prescribed medications is often explained by concurrent TM use — documenting it closes the adherence monitoring gap
- Unexplained hepato/nephrotoxicity presentations become diagnosable when herb records are available (toxicity tracker)
- Particularly critical in **LMIC/African contexts** where traditional healer consultations precede or run parallel to formal healthcare

### Epidemiological and Research Value
- Structured, coded TM records enable pharmacovigilance signal detection across a patient population
- Links to conventional prescription records allow retrospective interaction analysis

---

## 10. Key Constraints

| Constraint | Detail |
|---|---|
| No FK constraints | All cross-entity UUID references are plain `@Column`, no TypeORM `@ManyToOne` or `@JoinColumn` |
| No hardcoded env | All service URLs, secrets, and DB credentials come from `process.env.*` / `os.getenv()` — no string literals |
| No setTimeout mocks | All data flows through real API calls; no stub delays |
| Idempotent DDL | All SQL uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` |
| No duplicate provisioning | The `sprint143_htn_ncd_register` bundle is already applied — do NOT re-register it; only add the new `sprint143b_traditional_medicine_hdi` bundle |
| Python syntax | After editing `main.py`, validate with `python3 -c "import ast; ast.parse(open('services/cdss-service/main.py').read()); print('OK')"` |
| TypeScript compile | After editing TS files, validate with `cd services/ehr-service && npx tsc --noEmit` and `cd ehr-frontend && npx tsc --noEmit` |

---

## 11. Acceptance Criteria

- [ ] `tm_remedies`, `hdi_alerts`, `tm_toxicity_events` tables created in all tenant DBs via `repair:tenants`
- [ ] `POST /traditional-medicine/patient/:id/remedies` saves a remedy and auto-triggers HDI check
- [ ] `GET /traditional-medicine/patient/:id/alerts` returns interaction alerts sorted severity-first
- [ ] `PATCH /traditional-medicine/alerts/:id/acknowledge` records acknowledgement
- [ ] `POST /cdss/tm/hdi-check` returns correct interaction matches for St. John's Wort + warfarin
- [ ] `POST /cdss/tm/toxicity-risk` flags Kava as hepatotoxic
- [ ] `TraditionalMedicineDashboard` renders in NurseDashboard under NCD > Traditional Medicine
- [ ] Recording a remedy with an interaction automatically surfaces an alert banner on the Remedies tab
- [ ] TypeScript: zero compile errors
- [ ] Python: `ast.parse` returns OK
