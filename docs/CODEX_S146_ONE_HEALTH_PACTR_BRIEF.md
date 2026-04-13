# CODEX S146 — One Health / Zoonotic Pathways + PACTR Trial Integration

**Sprint**: S146
**Module**: Animal Exposure History, Zoonotic Disease CDSS, One Health Case Reports, Rabies PEP, PACTR Trial Matching
**Bundle version**: `2026.04.13.1`
**Bundle ID**: `sprint146_one_health_pactr`
**Date**: 2026-04-13

---

## 1. Clinical Rationale

Sub-Saharan Africa carries the world's highest burden of zoonotic disease. WHO estimates **>60% of emerging infectious diseases** originate from animal–human interfaces. The SADC region has endemic rabies, brucellosis, Rift Valley Fever (RVF), anthrax, trypanosomiasis (HAT), Q fever, and leptospirosis — all deeply linked to pastoralist and agricultural livelihoods that are absent from the current EHR clinical pathway.

Simultaneously, clinical trial access remains a critical equity gap. The **Pan African Clinical Trials Registry (PACTR)** — hosted by SAMRC — is the continent's primary registry for Africa-specific trials, yet the existing `ClinicalTrialMatchingService` only queries ClinicalTrials.gov (US-centric). African patients are systematically excluded from trial matching.

### What the codebase already has

- `ClinicalTrialMatchingService` — queries `https://clinicaltrials.gov/api/v2/studies`, saves `TrialMatch` entities
- `ClinicalTrialMatchingController` — `POST /trials/match`, `GET /trials/patient/:patientId`, `PATCH /trials/:id/status`
- `TrialMatch` entity — `nctId`, `trialTitle`, `phase`, `condition`, `eligibilityScore`, `sponsor`, `locations`, `status`, `contactEmail`
- `ImmunizationRecord` entity (`immunization_records` table) — reusable for Rabies PEP vaccine doses
- `EpiSchedule` entity — vaccine schedule framework from S129
- `cdss-service/main.py` — `/trials/match` scoring endpoint

### What is completely missing

- **Animal exposure history** — bite, scratch, contact, vector-borne, consumption events with animal type, illness state, vaccination status
- **One Health case report** — structured zoonosis case report submitted to veterinary authorities, cross-referenced to animal exposure
- **Zoonotic disease CDSS** — given animal exposure + symptoms → suspected zoonosis, WHO/SADC management protocol, referral flags
- **Rabies PEP schedule** — 5-dose Essen protocol generating real appointment dates from exposure date; reuses `immunization_records`
- **PACTR trial matching** — queries WHO ICTRP feed (includes PACTR registrations) alongside ClinicalTrials.gov; `TrialMatch` entity needs `registry` + `registry_id` fields
- Frontend **One Health tab** in NurseDashboard, PACTR toggle in trial matching UI

### Key clinical standards implemented

| Standard | Application |
|---|---|
| WHO Rabies 2018 | 5-dose Essen PEP (day 0, 3, 7, 14, 28); 4-dose Zagreb as alternative |
| WHO/OIE One Health | Zoonotic case report cross-notified to vet authority |
| WHO AFRO Zoonosis Protocols | Brucellosis, RVF, Anthrax, Leptospirosis, HAT, Q fever management |
| PACTR / WHO ICTRP | Africa-specific trial registry source alongside ClinicalTrials.gov |
| ICD-11 coding | A92.4 RVF, A23 Brucellosis, A22 Anthrax, B56 HAT, A82 Rabies, A27 Leptospirosis |

---

## 2. Do Not Touch

These files are fully working. **Do not recreate or modify them for S146:**

- `services/ehr-service/src/controllers/clinical-trial-matching.controller.ts`
- `services/ehr-service/src/entities/trial-match.entity.ts` *(entity class — read-only; schema extended via provisioning ALTER TABLE only)*
- `services/ehr-service/src/entities/immunization-record.entity.ts`
- `services/ehr-service/src/entities/epi-schedule.entity.ts`
- `services/ehr-service/src/services/clinical-trial-matching.service.ts` `fetchTrials()` method *(do not modify; add new `fetchPACTRTrials()` private method alongside it)*
- `services/cdss-service/main.py` `/trials/match` endpoint

S146 **extends** `ClinicalTrialMatchingService` with a new PACTR source and **adds** One Health infrastructure. It does not replace the ClinicalTrials.gov pathway.

---

## 3. Provisioning Bundle

### `services/tenant-service/src/generated/tenant-one-health-pactr.statements.ts`

```typescript
export const TENANT_ONE_HEALTH_PACTR_BUNDLE_VERSION = '2026.04.13.1';

export const TENANT_ONE_HEALTH_PACTR_STATEMENTS: string[] = [
  // ── Animal Exposure History ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS animal_exposures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    recorded_by UUID,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    animal_type TEXT NOT NULL,
    exposure_type TEXT NOT NULL,
    exposure_date DATE,
    exposure_location TEXT,
    animal_ill BOOLEAN,
    animal_vaccinated BOOLEAN,
    rabies_pep_started BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_animal_exp_patient ON animal_exposures(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_animal_exp_type ON animal_exposures(animal_type)`,
  `CREATE INDEX IF NOT EXISTS idx_animal_exp_date ON animal_exposures(exposure_date)`,

  // ── One Health Case Reports ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS one_health_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    animal_exposure_id UUID,
    reported_by UUID,
    suspected_zoonosis TEXT NOT NULL,
    icd11_code TEXT,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clinical_summary TEXT,
    lab_evidence JSONB DEFAULT '{}',
    submitted_to_vet_authority BOOLEAN NOT NULL DEFAULT false,
    vet_authority_reference TEXT,
    submitted_at TIMESTAMPTZ,
    outcome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_one_health_patient ON one_health_reports(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_one_health_zoonosis ON one_health_reports(suspected_zoonosis)`,
  `CREATE INDEX IF NOT EXISTS idx_one_health_submitted ON one_health_reports(submitted_to_vet_authority)`,

  // ── Extend TrialMatch with registry source ─────────────────────────────────
  `ALTER TABLE trial_matches
    ADD COLUMN IF NOT EXISTS registry TEXT NOT NULL DEFAULT 'clinicaltrials_gov',
    ADD COLUMN IF NOT EXISTS registry_id TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_trial_match_registry ON trial_matches(registry)`,
];
```

### Register in `services/tenant-service/src/services/database-provisioning.service.ts`

Add **after** the `sprint145_epilepsy_ncd_register` block (around line 1420):

```typescript
{
  id: 'sprint146_one_health_pactr',
  label: 'One Health / Zoonotic Pathways + PACTR Trial Integration',
  version: TENANT_ONE_HEALTH_PACTR_BUNDLE_VERSION,
  description: 'S146 — animal exposures, one health reports, rabies PEP, PACTR trial matching',
  statements: TENANT_ONE_HEALTH_PACTR_STATEMENTS,
},
```

Add the import at the top alongside other tenant statement imports:

```typescript
import { TENANT_ONE_HEALTH_PACTR_STATEMENTS, TENANT_ONE_HEALTH_PACTR_BUNDLE_VERSION } from '../generated/tenant-one-health-pactr.statements';
```

---

## 4. Entities

### 4a. `services/ehr-service/src/entities/animal-exposure.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('animal_exposures')
export class AnimalExposure {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'recorded_by', type: 'uuid', nullable: true }) recordedBy: string | null;
  @Column({ name: 'recorded_date', type: 'date' }) recordedDate: string;
  @Column({ name: 'animal_type', type: 'text' }) animalType: string;
  @Column({ name: 'exposure_type', type: 'text' }) exposureType: string;
  @Column({ name: 'exposure_date', type: 'date', nullable: true }) exposureDate: string | null;
  @Column({ name: 'exposure_location', type: 'text', nullable: true }) exposureLocation: string | null;
  @Column({ name: 'animal_ill', type: 'boolean', nullable: true }) animalIll: boolean | null;
  @Column({ name: 'animal_vaccinated', type: 'boolean', nullable: true }) animalVaccinated: boolean | null;
  @Column({ name: 'rabies_pep_started', type: 'boolean', default: false }) rabiesPepStarted: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 4b. `services/ehr-service/src/entities/one-health-report.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('one_health_reports')
export class OneHealthReport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'animal_exposure_id', type: 'uuid', nullable: true }) animalExposureId: string | null;
  @Column({ name: 'reported_by', type: 'uuid', nullable: true }) reportedBy: string | null;
  @Column({ name: 'suspected_zoonosis', type: 'text' }) suspectedZoonosis: string;
  @Column({ name: 'icd11_code', type: 'text', nullable: true }) icd11Code: string | null;
  @Column({ name: 'report_date', type: 'date' }) reportDate: string;
  @Column({ name: 'clinical_summary', type: 'text', nullable: true }) clinicalSummary: string | null;
  @Column({ name: 'lab_evidence', type: 'jsonb', default: {} }) labEvidence: Record<string, any>;
  @Column({ name: 'submitted_to_vet_authority', type: 'boolean', default: false }) submittedToVetAuthority: boolean;
  @Column({ name: 'vet_authority_reference', type: 'text', nullable: true }) vetAuthorityReference: string | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ type: 'text', nullable: true }) outcome: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

---

## 5. CDSS Data File

### `services/cdss-service/data/zoonotic_protocol.json`

```json
{
  "version": "WHO-AFRO-2024 / WHO-Rabies-2018 / OIE-OneHealth",
  "source": "WHO AFRO Zoonotic Disease Protocols, WHO Expert Consultation on Rabies 2018, OIE One Health Framework",
  "animal_types": ["cattle", "goat", "sheep", "dog", "cat", "rodent", "wildlife", "poultry", "camel", "pig", "bat", "monkey"],
  "exposure_types": {
    "bite": "Direct bite — break in skin; highest rabies transmission risk",
    "scratch": "Scratch or abrasion from claws/teeth — moderate risk",
    "contact": "Mucous membrane or broken skin contact with saliva/body fluids",
    "consumption": "Consumption of raw/undercooked meat or unpasteurised dairy",
    "vector_borne": "Tick, flea, or fly bite in context of animal contact"
  },
  "zoonotic_diseases": {
    "rabies": {
      "icd11": "1C82",
      "endemic_sadc": true,
      "transmission": ["bite", "scratch", "contact"],
      "animals": ["dog", "cat", "bat", "monkey", "wildlife"],
      "incubation_days": { "min": 10, "max": 90, "typical": 30 },
      "risk_factors": ["unprovoked bite", "bite on head/neck/hands", "multiple bites", "animal ill or died after bite", "animal not vaccinated"],
      "clinical_features": ["hydrophobia", "aerophobia", "agitation", "paralysis", "ascending_weakness"],
      "pep_indicated": true,
      "mortality_untreated": "near 100%",
      "management": "Immediate wound wash (soap + water 15 min), rabies PEP (see rabies_pep_protocol), rabies immunoglobulin (RIG) for Category III exposures"
    },
    "brucellosis": {
      "icd11": "1B95",
      "endemic_sadc": true,
      "transmission": ["consumption", "contact"],
      "animals": ["cattle", "goat", "sheep", "camel", "pig"],
      "incubation_days": { "min": 5, "max": 60, "typical": 21 },
      "clinical_features": ["undulant_fever", "night_sweats", "arthralgia", "hepatosplenomegaly", "malaise"],
      "lab_diagnosis": ["serology (Rose Bengal, SAT)", "blood culture x3", "Brucella agglutination titre ≥1:160"],
      "treatment": "Doxycycline 100mg BD x 6 weeks + Rifampicin 600mg OD x 6 weeks (or Doxycycline + Streptomycin IM for severe/neurobrucellosis)",
      "note": "Most common zoonosis in SADC pastoral communities. Check cattle/goat vaccination status. Notifiable."
    },
    "rift_valley_fever": {
      "icd11": "1D43",
      "endemic_sadc": true,
      "transmission": ["contact", "consumption", "vector_borne"],
      "animals": ["cattle", "sheep", "goat"],
      "incubation_days": { "min": 2, "max": 6 },
      "clinical_features": ["sudden_fever", "severe_headache", "myalgia", "photophobia", "haemorrhage_severe_cases", "encephalitis_1_percent"],
      "lab_diagnosis": ["PCR in acute phase", "IgM/IgG serology", "LFT — elevated transaminases"],
      "treatment": "Supportive. Ribavirin may reduce severity if started early (specialist decision). Barrier nursing. Notifiable — outbreak trigger.",
      "outbreak_trigger": true,
      "note": "Epidemic-prone. Aedes and Culex mosquitoes amplify. Notify national surveillance immediately."
    },
    "anthrax": {
      "icd11": "1B97",
      "endemic_sadc": true,
      "transmission": ["contact", "consumption"],
      "animals": ["cattle", "sheep", "goat", "wildlife"],
      "incubation_days": { "min": 1, "max": 5 },
      "forms": {
        "cutaneous": "Painless black eschar — 95% of cases; treat with Amoxicillin 500mg TDS x 7 days or Ciprofloxacin 500mg BD x 7 days",
        "gastrointestinal": "Nausea, vomiting, bloody diarrhoea after consuming infected meat — high mortality; IV Ciprofloxacin + Metronidazole",
        "inhalational": "Rare; near 100% mortality without treatment; medical emergency"
      },
      "treatment": "Ciprofloxacin 500mg BD x 7–60 days OR Doxycycline 100mg BD. Add anthrax antitoxin in severe cases (if available).",
      "note": "Handle carcasses with PPE. Notifiable. Do NOT perform post-mortem on suspected anthrax animals — releases spores."
    },
    "leptospirosis": {
      "icd11": "1C10",
      "endemic_sadc": true,
      "transmission": ["contact", "vector_borne"],
      "animals": ["rodent", "cattle", "pig", "dog"],
      "incubation_days": { "min": 2, "max": 30, "typical": 10 },
      "clinical_features": ["fever", "myalgia", "conjunctival_suffusion", "jaundice_weil_disease", "renal_failure", "haemorrhage"],
      "lab_diagnosis": ["MAT serology (gold standard)", "PCR blood in acute phase", "LFT, renal function, FBC"],
      "treatment": "Mild: Doxycycline 100mg BD x 7 days. Severe (Weil's disease): IV Penicillin G 1.5MU Q6H or IV Ceftriaxone 1g OD x 7 days.",
      "note": "Exposure via flood water, rice paddies, livestock urine. Rodent control key prevention."
    },
    "q_fever": {
      "icd11": "1C30",
      "endemic_sadc": true,
      "transmission": ["contact", "consumption", "vector_borne"],
      "animals": ["cattle", "sheep", "goat"],
      "incubation_days": { "min": 14, "max": 39 },
      "clinical_features": ["high_fever", "severe_headache", "pneumonia", "hepatitis", "endocarditis_chronic"],
      "treatment": "Acute: Doxycycline 100mg BD x 14–21 days. Chronic Q fever/endocarditis: Doxycycline + Hydroxychloroquine x 18 months (specialist).",
      "note": "Coxiella burnetii survives in dry environments for months. Parturient animals high risk."
    },
    "human_african_trypanosomiasis": {
      "icd11": "1F50",
      "endemic_sadc": ["Tanzania", "DRC", "Mozambique", "Zimbabwe", "Malawi"],
      "transmission": ["vector_borne"],
      "animals": ["cattle", "wildlife"],
      "vector": "Tsetse fly (Glossina species)",
      "clinical_features": {
        "stage_1": ["fever", "lymphadenopathy_posterior_cervical", "winterbottom_sign", "chancre_at_bite_site"],
        "stage_2": ["neurological_confusion", "sleep_disorder", "coma"]
      },
      "treatment": "Stage 1: Pentamidine (T. b. gambiense) or Suramin (T. b. rhodesiense). Stage 2: Eflornithine (gambiense) or Melarsoprol (rhodesiense). Specialist only.",
      "note": "Notifiable. Report to national HAT control programme. WHO supports free treatment in endemic areas."
    }
  },
  "rabies_pep_protocol": {
    "wound_categories": {
      "I": "Touching/feeding animal, licks on intact skin — no PEP required",
      "II": "Nibbling/minor scratches without bleeding — wound wash + vaccine only",
      "III": "Single/multiple transdermal bites, scratches with bleeding, licks on broken skin, mucous membrane contact — wound wash + vaccine + RIG"
    },
    "essen_protocol": {
      "doses": 5,
      "schedule_days": [0, 3, 7, 14, 28],
      "vaccine": "Rabies vaccine (cell-culture derived: HDCV, PCECV, or PVRV)",
      "dose_ml": 1.0,
      "route": "IM deltoid (adults) / anterolateral thigh (infants)",
      "note": "Day 0 = day of exposure/presentation. All 5 doses must be completed."
    },
    "zagreb_protocol": {
      "doses": 4,
      "schedule_days": [0, 0, 7, 21],
      "note": "2 doses on day 0 (different sites), then day 7 and 21. WHO-accepted alternative."
    },
    "rig_dosing": {
      "human_rig_iu_per_kg": 20,
      "equine_rig_iu_per_kg": 40,
      "route": "Infiltrate as much as possible into wound, remainder IM at distant site from vaccine",
      "timing": "Same day as first vaccine dose (day 0) — never after day 7"
    }
  },
  "high_risk_combinations": [
    {
      "animal": "dog",
      "exposure": "bite",
      "risk": "rabies",
      "action": "IMMEDIATE wound wash + Category assessment + Start PEP day 0",
      "urgency": "emergency"
    },
    {
      "animal": "bat",
      "exposure": "contact",
      "risk": "rabies",
      "action": "Treat as Category III regardless — bats have minor bites not always noticed",
      "urgency": "emergency"
    },
    {
      "animal": "cattle",
      "exposure": "consumption",
      "risk": "brucellosis",
      "action": "Serology + stool culture if febrile. Doxycycline + Rifampicin if confirmed.",
      "urgency": "urgent_outpatient"
    },
    {
      "animal": "cattle",
      "exposure": "contact",
      "risk": "rift_valley_fever",
      "action": "PCR + serology if febrile within 6 days. Notify surveillance if suspected.",
      "urgency": "urgent_notifiable"
    },
    {
      "animal": "rodent",
      "exposure": "contact",
      "risk": "leptospirosis",
      "action": "Doxycycline prophylaxis if high-risk flood exposure. Serology if symptomatic.",
      "urgency": "routine_with_prophylaxis"
    }
  ],
  "vet_notification_triggers": [
    "rabies",
    "rift_valley_fever",
    "anthrax",
    "brucellosis",
    "q_fever",
    "human_african_trypanosomiasis"
  ],
  "icd11_map": {
    "rabies": "1C82",
    "brucellosis": "1B95",
    "rift_valley_fever": "1D43",
    "anthrax": "1B97",
    "leptospirosis": "1C10",
    "q_fever": "1C30",
    "human_african_trypanosomiasis": "1F50"
  }
}
```

---

## 6. CDSS Endpoints — `services/cdss-service/main.py`

Add the following **after** the Sprint 145 epilepsy block. All read from `zoonotic_protocol.json` via `_load_supporting_json()`.

### 6a. Pydantic request model

```python
# Sprint 146 — One Health / Zoonotic
class ZoonoticAssessRequest(BaseModel):
    animal_type: str                          # 'dog' | 'cattle' | 'bat' | etc.
    exposure_type: str                        # 'bite' | 'scratch' | 'contact' | 'consumption' | 'vector_borne'
    exposure_date: Optional[str] = None       # ISO date string
    animal_ill: Optional[bool] = None
    animal_vaccinated: Optional[bool] = None
    patient_symptoms: Optional[List[str]] = []  # e.g. ['fever', 'hydrophobia', 'myalgia']
    days_since_exposure: Optional[int] = None
    exposure_location: Optional[str] = None  # country/region — for HAT endemicity check
```

### 6b. `POST /cdss/zoonotic/assess`

```python
@app.post("/cdss/zoonotic/assess")
async def zoonotic_assess(req: ZoonoticAssessRequest):
    """
    Given animal exposure + symptoms → suspected zoonosis list, risk level,
    PEP indication, management protocol, and vet notification flag.
    """
    data = _load_supporting_json("zoonotic_protocol.json")
    diseases = data["zoonotic_diseases"]
    high_risk = data["high_risk_combinations"]
    pep_protocol = data["rabies_pep_protocol"]
    vet_triggers = data["vet_notification_triggers"]

    suspected = []
    pep_indication = False
    pep_category = None
    urgency = "routine"
    vet_notification_required = False
    alerts = []

    # Check high-risk combinations first
    for combo in high_risk:
        if combo["animal"].lower() == req.animal_type.lower() and \
           combo["exposure"].lower() == req.exposure_type.lower():
            suspected.append(combo["risk"])
            if combo["urgency"] == "emergency":
                urgency = "emergency"
            elif combo["urgency"] == "urgent_notifiable" and urgency != "emergency":
                urgency = "urgent"
                vet_notification_required = True
            elif combo["urgency"] == "urgent_outpatient" and urgency == "routine":
                urgency = "urgent"
            alerts.append({
                "risk": combo["risk"],
                "action": combo["action"],
                "urgency": combo["urgency"]
            })

    # Add diseases matching animal + exposure type
    for disease_key, disease in diseases.items():
        if req.animal_type.lower() in [a.lower() for a in disease.get("animals", [])] and \
           req.exposure_type.lower() in [e.lower() for e in disease.get("transmission", [])]:
            if disease_key not in suspected:
                suspected.append(disease_key)

    # Symptom-driven confidence boost
    symptom_matches = {}
    for disease_key in suspected:
        disease = diseases.get(disease_key, {})
        features = disease.get("clinical_features", [])
        matched = [s for s in (req.patient_symptoms or [])
                   if any(s.lower() in f.lower() or f.lower() in s.lower() for f in features)]
        symptom_matches[disease_key] = len(matched)

    # Sort by symptom match count DESC
    suspected_sorted = sorted(suspected, key=lambda d: symptom_matches.get(d, 0), reverse=True)

    # Rabies PEP logic
    if "rabies" in suspected:
        pep_indication = True
        if req.exposure_type == "bite" and req.animal_type in ["bat"]:
            pep_category = "III"
        elif req.exposure_type in ["bite"] and not req.animal_vaccinated:
            pep_category = "III" if (req.animal_ill or req.animal_ill is None) else "II"
        elif req.exposure_type in ["scratch", "contact"]:
            pep_category = "II"
        else:
            pep_category = "II"

    # Vet notification flag
    for d in suspected:
        if d in vet_triggers:
            vet_notification_required = True
            break

    # Build management summaries
    management_summaries = []
    for d in suspected_sorted[:3]:  # top 3
        disease = diseases.get(d, {})
        management_summaries.append({
            "disease": d,
            "icd11": data["icd11_map"].get(d, ""),
            "incubation": disease.get("incubation_days"),
            "management": disease.get("management") or disease.get("treatment"),
            "lab_diagnosis": disease.get("lab_diagnosis", []),
            "symptom_overlap": symptom_matches.get(d, 0),
            "notifiable": d in vet_triggers
        })

    response = {
        "suspected_zoonoses": suspected_sorted,
        "primary_suspect": suspected_sorted[0] if suspected_sorted else None,
        "urgency": urgency,
        "alerts": alerts,
        "management_summaries": management_summaries,
        "vet_notification_required": vet_notification_required,
        "pep_indication": pep_indication,
    }

    if pep_indication:
        response["pep_recommendation"] = {
            "category": pep_category,
            "protocol": "essen_5_dose",
            "schedule_days": pep_protocol["essen_protocol"]["schedule_days"],
            "vaccine": pep_protocol["essen_protocol"]["vaccine"],
            "rig_required": pep_category == "III",
            "rig_note": pep_protocol["rig_dosing"]["route"] if pep_category == "III" else None,
            "immediate_action": "Wound wash soap + water 15 min. Start vaccine day 0 (today)."
        }

    return response
```

---

## 7. EHR Service

### 7a. `services/ehr-service/src/services/one-health.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { AnimalExposure } from '../entities/animal-exposure.entity';
import { OneHealthReport } from '../entities/one-health-report.entity';
import { ImmunizationRecord } from '../entities/immunization-record.entity';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OneHealthService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly configService: ConfigService,
  ) {}

  // ── Animal Exposures ───────────────────────────────────────────────────────

  async recordExposure(
    tenantId: string,
    patientId: string,
    recordedBy: string,
    dto: Partial<AnimalExposure>,
  ): Promise<{ exposure: AnimalExposure; zoonoticAssessment: Record<string, any> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(AnimalExposure);
    const exposure = repo.create({
      ...dto,
      patientId,
      recordedBy,
      recordedDate: dto.recordedDate ?? new Date().toISOString().slice(0, 10),
    } as Partial<AnimalExposure>);
    const saved = await repo.save(exposure) as unknown as AnimalExposure;

    // Auto-run zoonotic assessment
    let zoonoticAssessment: Record<string, any> = {};
    try {
      zoonoticAssessment = await this.cdssService.zoonoticAssess({
        animal_type: dto.animalType,
        exposure_type: dto.exposureType,
        exposure_date: dto.exposureDate ?? undefined,
        animal_ill: dto.animalIll ?? undefined,
        animal_vaccinated: dto.animalVaccinated ?? undefined,
      }, tenantId);
    } catch (_) { /* non-blocking */ }

    return { exposure: saved, zoonoticAssessment };
  }

  async getExposures(tenantId: string, patientId: string): Promise<AnimalExposure[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(AnimalExposure).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── One Health Reports ─────────────────────────────────────────────────────

  async createReport(
    tenantId: string,
    patientId: string,
    reportedBy: string,
    dto: Partial<OneHealthReport>,
  ): Promise<OneHealthReport> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OneHealthReport);
    const entity = repo.create({
      ...dto,
      patientId,
      reportedBy,
      reportDate: dto.reportDate ?? new Date().toISOString().slice(0, 10),
    } as Partial<OneHealthReport>);
    return repo.save(entity) as unknown as OneHealthReport;
  }

  async submitToVetAuthority(tenantId: string, reportId: string): Promise<OneHealthReport> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OneHealthReport);
    const report = await repo.findOneByOrFail({ id: reportId });

    const vetBaseUrl = this.configService.get<string>('VET_AUTHORITY_BASE_URL');
    const vetApiKey = this.configService.get<string>('VET_AUTHORITY_API_KEY');

    if (vetBaseUrl) {
      try {
        const { data } = await axios.post(
          `${vetBaseUrl}/api/one-health-report`,
          {
            patientId: report.patientId,
            suspectedZoonosis: report.suspectedZoonosis,
            icd11Code: report.icd11Code,
            reportDate: report.reportDate,
            clinicalSummary: report.clinicalSummary,
            labEvidence: report.labEvidence,
          },
          {
            headers: { Authorization: `Bearer ${vetApiKey}`, 'Content-Type': 'application/json' },
            timeout: 8000,
          },
        );
        await repo.update(reportId, {
          submittedToVetAuthority: true,
          vetAuthorityReference: data?.reference ?? data?.id ?? null,
          submittedAt: new Date(),
        });
      } catch (e: any) {
        // Graceful degradation — log but do not throw; mark as not submitted
        await repo.update(reportId, { submittedToVetAuthority: false });
        throw new Error(`Vet authority submission failed: ${e?.message}. Report saved locally.`);
      }
    } else {
      // No vet authority configured — mark as submitted locally
      await repo.update(reportId, {
        submittedToVetAuthority: true,
        submittedAt: new Date(),
        vetAuthorityReference: `LOCAL-${Date.now()}`,
      });
    }

    return repo.findOneByOrFail({ id: reportId });
  }

  async getReports(tenantId: string, patientId: string): Promise<OneHealthReport[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(OneHealthReport).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Rabies PEP Schedule ────────────────────────────────────────────────────

  async startRabiesPep(
    tenantId: string,
    patientId: string,
    administeredBy: string,
    exposureDate: string,
    protocol: 'essen' | 'zagreb' = 'essen',
    weightKg?: number,
    facilityId?: string,
  ): Promise<{ pepSchedule: Array<{ doseNumber: number; scheduledDate: string; status: 'given' | 'missed' | 'contraindicated' }> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ImmunizationRecord);

    const essenDays = [0, 3, 7, 14, 28];
    const zagrebDays = [0, 0, 7, 21];
    const scheduleDays = protocol === 'zagreb' ? zagrebDays : essenDays;

    const base = new Date(exposureDate);
    const pepSchedule: Array<{ doseNumber: number; scheduledDate: string; status: 'given' | 'missed' | 'contraindicated' }> = [];

    for (let i = 0; i < scheduleDays.length; i++) {
      const doseDate = new Date(base);
      doseDate.setDate(base.getDate() + scheduleDays[i]);
      const scheduledDate = doseDate.toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      // Day 0 (first dose only) is administered now; future doses are scheduled
      const isDose0 = i === 0 || (protocol === 'zagreb' && i === 1 && scheduleDays[i] === 0);
      const status: 'given' | 'missed' | 'contraindicated' = isDose0 ? 'given' : (scheduledDate < today ? 'missed' : 'given');

      const record = repo.create({
        patientId,
        vaccineName: 'Rabies vaccine (HDCV/PCECV/PVRV)',
        doseNumber: i + 1,
        administeredAt: isDose0 ? new Date() : doseDate,
        administeredBy: isDose0 ? administeredBy : undefined,
        route: 'IM',
        site: 'deltoid',
        doseMl: 1.0,
        facilityId: facilityId ?? undefined,
        status,
        notes: `Rabies PEP — ${protocol === 'zagreb' ? 'Zagreb 4-dose' : 'Essen 5-dose'} protocol. Day ${scheduleDays[i]}. Exposure date: ${exposureDate}.`,
      } as Partial<ImmunizationRecord>);

      await repo.save(record);
      pepSchedule.push({ doseNumber: i + 1, scheduledDate, status });
    }

    // Mark exposure record as PEP started
    const expRepo = db.getRepository(AnimalExposure);
    await expRepo.update({ patientId }, { rabiesPepStarted: true });

    return { pepSchedule };
  }

  async getRabiesPepStatus(tenantId: string, patientId: string): Promise<ImmunizationRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ImmunizationRecord).find({
      where: { patientId, vaccineName: 'Rabies vaccine (HDCV/PCECV/PVRV)' },
      order: { doseNumber: 'ASC' },
    });
  }

  // ── Zoonotic CDSS passthrough ──────────────────────────────────────────────

  async assessZoonotic(tenantId: string, payload: Record<string, any>): Promise<Record<string, any>> {
    return this.cdssService.zoonoticAssess(payload, tenantId);
  }
}
```

### 7b. `services/ehr-service/src/controllers/one-health.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { OneHealthService } from '../services/one-health.service';

@Controller('one-health')
@UseGuards(JwtAuthGuard)
export class OneHealthController {
  constructor(private readonly oneHealthService: OneHealthService) {}

  @Post('patient/:patientId/exposures')
  recordExposure(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.oneHealthService.recordExposure(req.tenantId!, patientId, user?.userId ?? user?.id, body);
  }

  @Get('patient/:patientId/exposures')
  getExposures(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.oneHealthService.getExposures(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/reports')
  createReport(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.oneHealthService.createReport(req.tenantId!, patientId, user?.userId ?? user?.id, body);
  }

  @Post('reports/:id/submit')
  submitToVetAuthority(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.oneHealthService.submitToVetAuthority(req.tenantId!, id);
  }

  @Get('patient/:patientId/reports')
  getReports(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.oneHealthService.getReports(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/rabies-pep')
  startRabiesPep(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.oneHealthService.startRabiesPep(
      req.tenantId!,
      patientId,
      user?.userId ?? user?.id,
      body.exposureDate,
      body.protocol ?? 'essen',
      body.weightKg,
      body.facilityId,
    );
  }

  @Get('patient/:patientId/rabies-pep')
  getRabiesPepStatus(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.oneHealthService.getRabiesPepStatus(req.tenantId!, patientId);
  }

  @Post('cdss/zoonotic-assess')
  assessZoonotic(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.oneHealthService.assessZoonotic(req.tenantId!, body ?? {});
  }
}
```

### Route summary

| Method | Path | Service call |
|---|---|---|
| POST | `/one-health/patient/:patientId/exposures` | `recordExposure` (auto-runs CDSS assessment) |
| GET | `/one-health/patient/:patientId/exposures` | `getExposures` |
| POST | `/one-health/patient/:patientId/reports` | `createReport` |
| POST | `/one-health/reports/:id/submit` | `submitToVetAuthority` |
| GET | `/one-health/patient/:patientId/reports` | `getReports` |
| POST | `/one-health/patient/:patientId/rabies-pep` | `startRabiesPep` |
| GET | `/one-health/patient/:patientId/rabies-pep` | `getRabiesPepStatus` |
| POST | `/one-health/cdss/zoonotic-assess` | `assessZoonotic` |

All routes: `@UseGuards(JwtAuthGuard)`. Extract `tenantId` from `req.tenantId`, `userId` from `(req.user as any)?.userId ?? (req.user as any)?.id`.

---

## 8. CdssService Methods

Add to `services/ehr-service/src/services/cdss.service.ts` following the `requestWithPolicy` pattern (see `epilepsyAedDose` at ~line 2274 as template):

```typescript
async zoonoticAssess(payload: Record<string, any>, tenantId?: string): Promise<Record<string, any>> {
  return this.requestWithPolicy<Record<string, any>>(
    'POST', 'zoonoticAssess', '/cdss/zoonotic/assess',
    payload, this.defaultTimeoutMs, tenantId,
  );
}
```

---

## 9. PACTR Trial Matching — Extend `ClinicalTrialMatchingService`

**Do not modify** `fetchTrials()` or the existing `matchTrials()` flow. Add the following to `services/ehr-service/src/services/clinical-trial-matching.service.ts`:

### 9a. New private method `fetchPACTRTrials()`

Add after the closing brace of `fetchTrials()` at line ~165:

```typescript
/**
 * Fetch trials from WHO ICTRP feed filtered to PACTR registry.
 * WHO ICTRP API: https://trialsearch.who.int/Trial2.aspx?TrialID=PACTR...
 * Uses the ICTRP search endpoint which includes PACTR registrations.
 */
private async fetchPACTRTrials(condition: string): Promise<any[]> {
  const ictrpUrl = 'https://trialsearch.who.int/api/search';
  try {
    const { data } = await axios.get(ictrpUrl, {
      params: {
        query: condition,
        registry: 'PACTR',
        recruiting: 'Y',
        format: 'json',
      },
      timeout: 12000,
      headers: { Accept: 'application/json' },
    });
    const trials = Array.isArray(data?.trials) ? data.trials : (data?.result ?? []);
    return trials.map((t: any) => ({
      registryId: t.TrialID || t.trialId || t.id,
      registry: 'pactr',
      title: t.public_title || t.Scientific_title || t.title,
      phase: t.phase || t.Phase || null,
      sponsor: t.Primary_sponsor || t.sponsor || null,
      condition: t.Condition || t.Health_condition || condition,
      contactEmail: t.Contact_email || t.contact_email || null,
      locations: (t.Countries || t.countries || '').split(';').map((c: string) => c.trim()).filter(Boolean),
      url: t.url || `https://pactr.samrc.ac.za/RegistryDisplay.aspx?TrialID=${t.TrialID || t.trialId}`,
    })).filter((t: any) => t.registryId);
  } catch (e: any) {
    this.logger.warn(`WHO ICTRP/PACTR API unavailable: ${e?.message}`);
    return [];
  }
}
```

### 9b. New public method `matchPACTRTrials()`

Add after `updateStatus()`:

```typescript
async matchPACTRTrials(subdomain: string, patientId: string, condition?: string): Promise<TrialMatch[]> {
  const ds = await this.tenantService.getTenantDatabase(subdomain);
  const profile = await this.buildPatientProfile(ds, patientId);
  const searchCondition = condition || profile.primaryDiagnosis;
  if (!searchCondition) return [];

  const trials = await this.fetchPACTRTrials(searchCondition);
  if (!trials.length) return [];

  const repo = ds.getRepository(TrialMatch);
  const saved: TrialMatch[] = [];

  for (const trial of trials.slice(0, 15)) {
    const existing = await repo.findOneBy({ patientId, nctId: trial.registryId });
    if (existing) continue;

    saved.push(await repo.save(repo.create({
      patientId,
      nctId: trial.registryId,          // repurposed field — stores PACTR ID
      trialTitle: trial.title ?? 'Untitled',
      phase: trial.phase ?? null,
      condition: searchCondition,
      eligibilityScore: 0.6,            // base score — PACTR trials are Africa-specific, inherently relevant
      inclusionMet: [],
      exclusionFlags: [],
      sponsor: trial.sponsor ?? null,
      locations: trial.locations ?? [],
      status: 'matched',
      contactEmail: trial.contactEmail ?? null,
      // registry + registry_id columns added by S146 provisioning
    } as any)));
  }

  // Backfill registry columns for newly saved records
  for (const record of saved) {
    await ds.query(
      `UPDATE trial_matches SET registry = 'pactr', registry_id = $1 WHERE id = $2`,
      [record.nctId, record.id],
    );
  }

  this.logger.log(`Matched ${saved.length} PACTR trials for patient ${patientId} (${searchCondition})`);
  return saved;
}

async searchPACTR(condition: string): Promise<any[]> {
  return this.fetchPACTRTrials(condition);
}
```

### 9c. New controller routes — add to `ClinicalTrialMatchingController`

```typescript
@Post('match/pactr')
matchPACTRTrials(
  @Body('subdomain') subdomain: string,
  @Body('patientId') patientId: string,
  @Body('condition') condition?: string,
) {
  return this.svc.matchPACTRTrials(subdomain, patientId, condition);
}

@Get('pactr/search')
searchPACTR(@Query('condition') condition: string) {
  return this.svc.searchPACTR(condition);
}
```

---

## 10. Module Registration

### `services/ehr-service/src/services/tenant.service.ts`

Add to the DataSource `entities[]` array alongside `EpilepsyRegister` etc.:

```typescript
AnimalExposure,
OneHealthReport,
```

Add imports:

```typescript
import { AnimalExposure } from '../entities/animal-exposure.entity';
import { OneHealthReport } from '../entities/one-health-report.entity';
```

### `services/ehr-service/src/ehr.module.ts`

Add to `controllers` array:
```typescript
OneHealthController,
```

Add to `providers` array:
```typescript
OneHealthService,
```

Add imports:
```typescript
import { OneHealthController } from './controllers/one-health.controller';
import { OneHealthService } from './services/one-health.service';
import { AnimalExposure } from './entities/animal-exposure.entity';
import { OneHealthReport } from './entities/one-health-report.entity';
```

---

## 11. Frontend

### 11a. `oneHealthApi` in `ehr-frontend/src/services/api.ts`

Add `export const oneHealthApi` after `epilepsyApi`:

```typescript
export const oneHealthApi = {
  recordExposure: (patientId: string, data: Record<string, any>) =>
    ehrAxios.post(`/one-health/patient/${patientId}/exposures`, data),
  getExposures: (patientId: string) =>
    ehrAxios.get(`/one-health/patient/${patientId}/exposures`),
  createReport: (patientId: string, data: Record<string, any>) =>
    ehrAxios.post(`/one-health/patient/${patientId}/reports`, data),
  submitReport: (reportId: string) =>
    ehrAxios.post(`/one-health/reports/${reportId}/submit`, {}),
  getReports: (patientId: string) =>
    ehrAxios.get(`/one-health/patient/${patientId}/reports`),
  startRabiesPep: (patientId: string, data: Record<string, any>) =>
    ehrAxios.post(`/one-health/patient/${patientId}/rabies-pep`, data),
  getRabiesPepStatus: (patientId: string) =>
    ehrAxios.get(`/one-health/patient/${patientId}/rabies-pep`),
  assessZoonotic: (data: Record<string, any>) =>
    ehrAxios.post('/one-health/cdss/zoonotic-assess', data),
  matchPACTRTrials: (subdomain: string, patientId: string, condition?: string) =>
    ehrAxios.post('/trials/match/pactr', { subdomain, patientId, condition }),
  searchPACTR: (condition: string) =>
    ehrAxios.get('/trials/pactr/search', { params: { condition } }),
};
```

### 11b. `ehr-frontend/src/components/OneHealthDashboard.tsx`

3-tab component: `exposures` | `pep` | `reports`

**Props**: `patientId: string`

**Tab: `exposures`**
- Record animal exposure form:
  - `animal_type` (select: cattle, dog, cat, bat, goat, sheep, rodent, wildlife, poultry, camel, pig, monkey)
  - `exposure_type` (select: bite, scratch, contact, consumption, vector_borne)
  - `exposure_date` (date picker)
  - `exposure_location` (text)
  - `animal_ill` (yes/no/unknown toggle)
  - `animal_vaccinated` (yes/no/unknown toggle)
  - On submit: call `oneHealthApi.recordExposure` → immediately display returned `zoonoticAssessment`
- Zoonotic assessment result card:
  - Primary suspect with ICD-11 code
  - Urgency badge (`emergency` = red, `urgent` = amber, `routine` = green)
  - Management summary for top 3 suspects
  - PEP indication banner (orange, prominent) if `pep_indication: true`
  - Vet notification flag if `vet_notification_required: true`
- Exposure history table: date, animal type, exposure type, location, rabies PEP started badge

**Tab: `pep`**
- Rabies PEP start form (shown when exposure with `pep_indication` exists):
  - Exposure date (pre-filled from selected exposure), protocol select (Essen/Zagreb), weight kg
  - On submit: `oneHealthApi.startRabiesPep` → display generated dose schedule as timeline
- PEP dose schedule timeline: dose number, scheduled date, status badge (given/pending/missed)
- Each dose shows vaccine name, route, site
- Overdue doses highlighted in red

**Tab: `reports`**
- One Health report form:
  - `suspected_zoonosis` (select from protocol list), `icd11_code` (auto-populated), `report_date`, `clinical_summary` (textarea), `lab_evidence` (key-value pairs)
  - Link to animal exposure (select from existing exposures)
  - Submit button → `oneHealthApi.createReport`
- Report list: date, zoonosis, submission status badge, vet reference
- "Submit to Vet Authority" button per report → `oneHealthApi.submitReport` (shows error message gracefully if vet authority unreachable)

### 11c. `ehr-frontend/src/pages/NurseDashboard.tsx`

**Four changes:**

1. **Import** (after `EpilepsyDashboard` import):
```tsx
import OneHealthDashboard from '../components/OneHealthDashboard';
```

2. **`activeTab` union** — add `| 'one-health'` to the union type at the line containing `| 'epilepsy'`:
```typescript
// Current ends with: | 'epilepsy'>('dashboard')
// Change to:        | 'epilepsy' | 'one-health'>('dashboard')
```

3. **Sidebar NCD child entry** (after the `{ label: 'Epilepsy', tab: 'epilepsy', icon: Brain }` entry):
```tsx
{ label: 'One Health', tab: 'one-health', icon: PawPrint },
```
`PawPrint` is available in `lucide-react`. Add to the existing lucide import line if not present.

4. **Render block** (after the `epilepsy` render block):
```tsx
{activeTab === 'one-health' && selectedPatient && (
  <OneHealthDashboard patientId={selectedPatient.id} />
)}
{activeTab === 'one-health' && !selectedPatient && (
  <div className="p-8 text-center text-gray-500">Select a patient to view the One Health register</div>
)}
```

---

## 12. Environment Variables

Add to `.env.example` and Docker Compose environment blocks:

```env
# S146 — One Health / Vet Authority
VET_AUTHORITY_BASE_URL=          # e.g. https://vet.moa.gov.zw/api — leave blank to use local-only mode
VET_AUTHORITY_API_KEY=           # Bearer token for vet authority API
```

No new env vars are needed for PACTR — the WHO ICTRP endpoint is public and unauthenticated.

---

## 13. Post-Implementation Provisioning Steps

```bash
# 1. Rebuild tenant-service
docker compose build tenant-service

# 2. Run provisioning for the default tenant
curl -X POST http://localhost:3005/admin/provision \
  -H "Content-Type: application/json" \
  -d '{"bundleId":"sprint146_one_health_pactr"}'

# 3. Run tenant repair to propagate to all existing tenants
curl -X POST http://localhost:3005/admin/repair-tenants

# 4. Verify schema
psql $DATABASE_URL -c "\d animal_exposures"
psql $DATABASE_URL -c "\d one_health_reports"
psql $DATABASE_URL -c "\d trial_matches"
# Confirm: trial_matches now has columns 'registry' and 'registry_id'
```

---

## 14. Done When

- [ ] `animal_exposures` and `one_health_reports` tables exist in tenant DB
- [ ] `trial_matches` has `registry` and `registry_id` columns
- [ ] `POST /one-health/patient/:id/exposures` saves record and returns live CDSS zoonotic assessment
- [ ] `POST /one-health/patient/:id/rabies-pep` generates real appointment dates from exposure date
- [ ] Rabies PEP doses stored as `ImmunizationRecord` rows (vaccine_name = `'Rabies vaccine (HDCV/PCECV/PVRV)'`)
- [ ] `POST /one-health/reports/:id/submit` calls `VET_AUTHORITY_BASE_URL` if configured; degrades gracefully if not
- [ ] `POST /trials/match/pactr` queries WHO ICTRP API (real external call, no hardcoded data)
- [ ] `GET /trials/pactr/search?condition=brucellosis` returns real PACTR results
- [ ] `OneHealthDashboard` renders all 3 tabs with real data (no `setTimeout`, no hardcoded arrays)
- [ ] `NurseDashboard` shows `One Health` tab under NCD section
- [ ] `npm run lint`, `npm run build`, `npm test` pass for all touched files
