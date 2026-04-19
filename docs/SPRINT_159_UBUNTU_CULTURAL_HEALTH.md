# Sprint 159 — Ubuntu Cultural Health Model

**Sprint**: S159  
**Module**: Ubuntu Social Determinants, Family Council Consent, Community Healer Coordination, Psychosocial Wellbeing  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint159_ubuntu_cultural_health`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

------

## 1. Clinical Rationale

Ubuntu ("I am because we are") is the foundational social philosophy across Southern and Eastern Africa that shapes health-seeking behaviour, consent processes, and care decisions. Western bioethics models (individual autonomy) directly conflict with Ubuntu collectivism, causing:

- Family members making medical decisions over patients who are deemed too ill to decide
- Traditional healer visits concurrent with biomedical treatment → herb-drug interactions
- Families refusing HIV disclosure to spouses, undermining contact tracing
- Mental health stigma managed through community/spiritual healing first
- Social determinants (food insecurity, housing, gender-based violence) documented nowhere in the EHR

### What already exists (do NOT recreate)

- Traditional medicine module from S143 (`traditional-medicine.controller.ts`, `tm-remedy.entity.ts`, `tm-toxicity-event.entity.ts`) — TM healer types already tracked; **link don't duplicate**
- `PatientService`, `CdssService`
- `database-provisioning.service.ts`, `tenant.service.ts`, `ehr.module.ts`

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-ubuntu-cultural-health.statements.ts`**

```typescript
export const TENANT_UBUNTU_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_UBUNTU_STATEMENTS: string[] = [

  // ── Social Determinants of Health ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS social_determinants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL UNIQUE,
    assessed_by UUID,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Food Security (HFIAS-adapted)
    food_insecurity TEXT NOT NULL DEFAULT 'unknown',  -- 'food_secure' | 'mildly_insecure' | 'moderately_insecure' | 'severely_insecure'
    meals_per_day INTEGER,
    -- Housing
    housing_type TEXT,                   -- 'permanent' | 'semi_permanent' | 'informal_shack' | 'homeless'
    household_members INTEGER,
    water_source TEXT,                   -- 'piped' | 'borehole' | 'river' | 'purchased'
    sanitation TEXT,                     -- 'flush_toilet' | 'pit_latrine' | 'open_defecation'
    electricity BOOLEAN,
    -- Income / Employment
    household_income_usd_month DECIMAL(8,2),
    employment_status TEXT,              -- 'employed' | 'self_employed' | 'unemployed' | 'subsistence'
    social_grant_recipient BOOLEAN NOT NULL DEFAULT false,
    social_grant_types JSONB DEFAULT '[]',  -- ['old_age_pension','child_support','disability']
    -- Education
    education_level TEXT,                -- 'none' | 'primary' | 'secondary' | 'tertiary'
    literacy TEXT,                       -- 'literate' | 'partial_literacy' | 'illiterate'
    -- Safety
    gbv_screen_positive BOOLEAN,        -- Gender-Based Violence screen
    gbv_screen_date DATE,
    child_protection_concern BOOLEAN NOT NULL DEFAULT false,
    -- Ubuntu-specific social support
    extended_family_support TEXT,        -- 'strong' | 'moderate' | 'weak' | 'none'
    community_group_member BOOLEAN NOT NULL DEFAULT false,
    community_group_types JSONB DEFAULT '[]',  -- ['church','women_group','burial_society','stokvels']
    -- CDSS risk score
    sdoh_risk_score INTEGER,             -- 0-100, CDSS-computed (higher = higher social risk)
    sdoh_risk_level TEXT,                -- 'low' | 'moderate' | 'high'
    social_worker_referral_needed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_sdoh_patient ON social_determinants(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sdoh_risk ON social_determinants(sdoh_risk_level)`,

  // ── Family Council Consent Records ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS family_council_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    encounter_id UUID,
    -- Council meeting
    meeting_date TIMESTAMP NOT NULL DEFAULT NOW(),
    meeting_facilitated_by UUID,         -- clinician/social worker who facilitated
    -- Family representatives present
    family_members_present JSONB NOT NULL DEFAULT '[]',  -- [{name, relationship, phone}]
    community_elder_present BOOLEAN NOT NULL DEFAULT false,
    traditional_healer_present BOOLEAN NOT NULL DEFAULT false,
    religious_leader_present BOOLEAN NOT NULL DEFAULT false,
    -- Decision context
    decision_type TEXT NOT NULL,         -- 'treatment_consent' | 'disclosure' | 'end_of_life' | 'surgery' | 'hiv_disclosure' | 'mental_health'
    clinical_information_shared TEXT NOT NULL,
    patient_capacity_assessed BOOLEAN NOT NULL DEFAULT true,
    patient_has_capacity BOOLEAN NOT NULL DEFAULT true,
    -- Outcome
    consensus_reached BOOLEAN NOT NULL,
    decision_made TEXT NOT NULL,         -- free text: what was decided
    patient_agrees BOOLEAN,
    cultural_conflict_noted BOOLEAN NOT NULL DEFAULT false,
    cultural_conflict_description TEXT,
    ethics_consultation_requested BOOLEAN NOT NULL DEFAULT false,
    -- Audit
    documented_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_family_consent_patient ON family_council_consents(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_family_consent_type ON family_council_consents(decision_type)`,

  // ── Ubuntu Wellbeing Assessments ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ubuntu_wellbeing_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    assessed_by UUID,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Psychosocial dimensions
    social_connectedness TEXT NOT NULL DEFAULT 'moderate',  -- 'strong' | 'moderate' | 'weak' | 'isolated'
    community_belonging TEXT,            -- 'high' | 'moderate' | 'low' | 'excluded'
    spiritual_wellbeing TEXT,            -- 'well' | 'distressed' | 'crisis'
    ancestral_harmony TEXT,              -- patient-reported: 'at_peace' | 'troubled' | 'seeking_guidance'
    grief_bereavement BOOLEAN NOT NULL DEFAULT false,
    grief_type TEXT,                     -- 'recent_death' | 'prolonged_grief' | 'multiple_losses'
    -- Traditional healing concurrent use
    currently_using_traditional_healer BOOLEAN NOT NULL DEFAULT false,
    traditional_healer_type TEXT,        -- 'sangoma' | 'nyangas' | 'faith_healer' | 'herbalist'
    traditional_healer_treatment TEXT,  -- what is being given
    herb_drug_interaction_risk TEXT,     -- 'none' | 'possible' | 'high' (CDSS-assessed)
    -- Mental health (mhGAP-linked)
    phq9_score INTEGER,                  -- 0-27
    gad7_score INTEGER,                  -- 0-21
    stigma_experienced BOOLEAN,
    help_seeking_barriers JSONB DEFAULT '[]',  -- ['stigma','cost','transport','family_opposition']
    -- CDSS
    cdss_psychosocial_risk TEXT,         -- 'low' | 'moderate' | 'high'
    cdss_recommendation TEXT,
    cdss_confidence DECIMAL(4,3),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ubuntu_wellbeing_patient ON ubuntu_wellbeing_assessments(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ubuntu_wellbeing_risk ON ubuntu_wellbeing_assessments(cdss_psychosocial_risk)`,

];
```

### 2b. Register Bundle

```typescript
import {
  TENANT_UBUNTU_BUNDLE_VERSION,
  TENANT_UBUNTU_STATEMENTS,
} from './generated/tenant-ubuntu-cultural-health.statements';

{
  id: 'sprint159_ubuntu_cultural_health',
  label: 'Sprint 159 — Ubuntu Cultural Health Model',
  version: TENANT_UBUNTU_BUNDLE_VERSION,
  description: 'Creates social_determinants, family_council_consents, ubuntu_wellbeing_assessments tables',
  statements: TENANT_UBUNTU_STATEMENTS,
},
```

---

## 3. TypeORM Entities

**File: `services/ehr-service/src/cultural/entities/social-determinant.entity.ts`**

Mirror all `social_determinants` columns. `patientId` is unique (one SDOH record per patient, upserted).

**File: `services/ehr-service/src/cultural/entities/family-council-consent.entity.ts`**

Mirror all `family_council_consents` columns. `familyMembersPresent` is `type: 'jsonb'`.

**File: `services/ehr-service/src/cultural/entities/ubuntu-wellbeing-assessment.entity.ts`**

Mirror all `ubuntu_wellbeing_assessments` columns. `helpSeekingBarriers` is `type: 'jsonb'`.

Register all 3 in `tenant.service.ts`:
```typescript
import { SocialDeterminant } from '../ehr/cultural/entities/social-determinant.entity';
import { FamilyCouncilConsent } from '../ehr/cultural/entities/family-council-consent.entity';
import { UbuntuWellbeingAssessment } from '../ehr/cultural/entities/ubuntu-wellbeing-assessment.entity';
// Add all 3 to entities array
```

---

## 4. CDSS Python Endpoints

```python
class SdohRiskRequest(BaseModel):
    food_insecurity: str                 # 'food_secure' | 'mildly_insecure' | 'moderately_insecure' | 'severely_insecure'
    housing_type: str
    household_income_usd_month: Optional[float]
    employment_status: str
    social_grant_recipient: bool
    education_level: str
    gbv_screen_positive: Optional[bool]
    child_protection_concern: bool
    extended_family_support: str
    chronic_disease: bool
    hiv_positive: bool
    pregnant: bool

class SdohRiskResponse(BaseModel):
    sdoh_risk_score: int                 # 0-100
    sdoh_risk_level: str                 # 'low' | 'moderate' | 'high'
    key_risk_factors: List[str]
    social_worker_referral_needed: bool
    recommended_community_resources: List[str]
    confidence: float

class UbuntuPsychosocialRequest(BaseModel):
    social_connectedness: str
    community_belonging: str
    spiritual_wellbeing: str
    grief_bereavement: bool
    grief_type: Optional[str]
    traditional_healer_active: bool
    traditional_healer_treatment: Optional[str]
    phq9_score: Optional[int]
    gad7_score: Optional[int]
    stigma_experienced: bool
    help_seeking_barriers: List[str]
    chronic_illness: bool
    hiv_positive: bool

class UbuntuPsychosocialResponse(BaseModel):
    psychosocial_risk: str               # 'low' | 'moderate' | 'high'
    herb_drug_interaction_risk: str      # 'none' | 'possible' | 'high'
    culturally_adapted_interventions: List[str]
    referral_recommendations: List[str]
    ubuntu_strengths_to_leverage: List[str]  # e.g. community support, spiritual resources
    confidence: float
    citations: List[str]

@app.post("/cdss/cultural/sdoh-risk")
async def sdoh_risk_assessment(req: SdohRiskRequest):
    prompt = f"""
    You are a social determinants of health specialist using WHO SDOH framework
    and Southern Africa poverty/vulnerability indicators.

    Patient social profile:
    - Food security: {req.food_insecurity}
    - Housing: {req.housing_type}
    - Income: USD {req.household_income_usd_month}/month
    - Employment: {req.employment_status}
    - Social grant: {req.social_grant_recipient}
    - Education: {req.education_level}
    - GBV screen positive: {req.gbv_screen_positive}
    - Child protection concern: {req.child_protection_concern}
    - Family support: {req.extended_family_support}
    - Health: chronic_disease={req.chronic_disease}, HIV={req.hiv_positive}, pregnant={req.pregnant}

    Compute SDOH risk score 0-100 (higher = more vulnerability):
    - Severe food insecurity → +25
    - Informal/homeless housing → +20
    - GBV screen positive → +20
    - Income <$50/month → +15
    - Illiteracy → +10
    - No family support → +10
    - Child protection concern → +15

    Recommend community resources appropriate to Southern Africa context
    (food banks, social grants, GBV shelters, faith community support, stokvels/burial societies).

    Return JSON: sdoh_risk_score, sdoh_risk_level, key_risk_factors (list),
    social_worker_referral_needed, recommended_community_resources (list), confidence (0-1).
    """
    result = await call_governed_json(prompt, surface="sdoh_risk_assessment", phi_present=True)
    return result

@app.post("/cdss/cultural/ubuntu-psychosocial")
async def ubuntu_psychosocial_assessment(req: UbuntuPsychosocialRequest):
    prompt = f"""
    You are a clinical psychologist specialised in Ubuntu-based psychosocial care in Southern Africa,
    using mhGAP Intervention Guide 2.0 and culturally-adapted mental health frameworks for sub-Saharan Africa.

    Patient:
    - Social connectedness: {req.social_connectedness}
    - Community belonging: {req.community_belonging}
    - Spiritual wellbeing: {req.spiritual_wellbeing}
    - Grief/bereavement: {req.grief_bereavement} ({req.grief_type})
    - Traditional healer concurrent: {req.traditional_healer_active} — treatment: {req.traditional_healer_treatment}
    - PHQ-9: {req.phq9_score}, GAD-7: {req.gad7_score}
    - Stigma: {req.stigma_experienced}, Barriers: {req.help_seeking_barriers}
    - Chronic illness: {req.chronic_illness}, HIV+: {req.hiv_positive}

    Provide:
    1. Psychosocial risk level
    2. Herb-drug interaction risk from traditional healer (if active)
    3. Culturally-adapted interventions that WORK in Ubuntu contexts (community therapy circles, peer support, integration with faith healers, family therapy, not just individual CBT)
    4. Ubuntu strengths to leverage (community, ancestors, collective resilience)

    Return JSON: psychosocial_risk, herb_drug_interaction_risk, culturally_adapted_interventions (list),
    referral_recommendations (list), ubuntu_strengths_to_leverage (list), confidence (0-1), citations (list).
    """
    result = await call_governed_json(prompt, surface="ubuntu_psychosocial", phi_present=True)
    return result
```

---

## 5. NestJS Service

**File: `services/ehr-service/src/cultural/cultural.service.ts`**

Methods:
- `upsertSocialDeterminants(dto)` — save/update SDOH; call CDSS sdoh-risk; update risk score
- `getSocialDeterminants(patientId)` / `getSdohRisk(patientId)` — trigger CDSS if stale
- `recordFamilyCouncilConsent(dto)` / `getFamilyConsents(patientId)` / `getConsent(id)`
- `recordWellbeingAssessment(dto)` — save; call CDSS ubuntu-psychosocial; if herb-drug-interaction-risk='high' → flag in TM module
- `getWellbeingHistory(patientId)` / `getWellbeingAssessment(id)`
- `getCulturalSummary(patientId)` — SDOH score, wellbeing risk, consent count, TM interaction flag

All CDSS calls use `this.cdssService.callGovernedJson(...)`.

**File: `services/ehr-service/src/cultural/cultural.controller.ts`**

Routes:
```
POST   /cultural/sdoh
GET    /cultural/sdoh/:patientId
GET    /cultural/sdoh/:patientId/risk
POST   /cultural/family-consent
GET    /cultural/family-consent/:patientId
GET    /cultural/family-consent/record/:id
POST   /cultural/wellbeing
GET    /cultural/wellbeing/:patientId
GET    /cultural/summary/:patientId
```

**Module** (`cultural.module.ts`) — import `CdssModule`; export `CulturalService`; register in `ehr.module.ts`.

---

## 6. Frontend

### API in `api.ts`

```typescript
export const culturalApi = {
  upsertSdoh: (d: any) => api.post('/cultural/sdoh', d),
  getSdoh: (patientId: string) => api.get(`/cultural/sdoh/${patientId}`),
  getSdohRisk: (patientId: string) => api.get(`/cultural/sdoh/${patientId}/risk`),
  recordFamilyConsent: (d: any) => api.post('/cultural/family-consent', d),
  getFamilyConsents: (patientId: string) => api.get(`/cultural/family-consent/${patientId}`),
  recordWellbeing: (d: any) => api.post('/cultural/wellbeing', d),
  getWellbeingHistory: (patientId: string) => api.get(`/cultural/wellbeing/${patientId}`),
  getCulturalSummary: (patientId: string) => api.get(`/cultural/summary/${patientId}`),
};
```

### Component Spec — `UbuntuCulturalPanel.tsx`

Display as a collapsible panel in the patient record (not a separate dashboard — contextual to the patient):

**Tab 1 — Social Determinants**: SDOH form with colour-coded risk domains (food/housing/safety/income). CDSS score: 0-100 dial + key risk factors + recommended community resources. Social worker referral button.

**Tab 2 — Family & Consent**: "Record Family Council Meeting" form. List of past consent records by type (colour-coded: HIV disclosure = purple, end-of-life = grey, surgery = blue). Show cultural conflict flag (amber warning).

**Tab 3 — Wellbeing**: PHQ-9/GAD-7 score inputs + Ubuntu social assessment (connectedness, community belonging, spiritual wellbeing dropdowns). Traditional healer concurrent use toggle — if active, CDSS assesses herb-drug interaction risk and flags it prominently. CDSS culturally-adapted interventions list.

Wire into the patient detail page alongside existing demographics, vitals, medications.

---

## 7. Post-Implementation Steps

```bash
docker compose build tenant-service
./scripts/provision-repair-all.sh
# Fallback: curl -X POST http://localhost:3001/admin/tenants/repair-all -H "Authorization: Bearer <token>"

psql $DATABASE_URL -c "\d social_determinants"
psql $DATABASE_URL -c "\d family_council_consents"
psql $DATABASE_URL -c "\d ubuntu_wellbeing_assessments"

npx tsc --noEmit

curl -X POST http://localhost:8000/cdss/cultural/sdoh-risk \
  -H "Content-Type: application/json" \
  -d '{"food_insecurity":"severely_insecure","housing_type":"informal_shack","household_income_usd_month":30,"employment_status":"unemployed","social_grant_recipient":true,"education_level":"primary","gbv_screen_positive":true,"child_protection_concern":false,"extended_family_support":"strong","chronic_disease":false,"hiv_positive":true,"pregnant":false}'

npm run lint

git add services/tenant-service/src/generated/tenant-ubuntu-cultural-health.statements.ts \
        services/ehr-service/src/cultural/ \
        ehr-frontend/src/services/api.ts \
        ehr-frontend/src/components/UbuntuCulturalPanel.tsx
git commit -m "feat: implement Sprint 159 — Ubuntu cultural health model with SDOH, family consent, psychosocial wellbeing"
```

---

## 8. Done-When Checklist

- [ ] `tenant-ubuntu-cultural-health.statements.ts` — 3 tables, idempotent SQL
- [ ] Bundle in `database-provisioning.service.ts`
- [ ] `SocialDeterminant`, `FamilyCouncilConsent`, `UbuntuWellbeingAssessment` entities in `tenant.service.ts`
- [ ] `CulturalModule` in `ehr.module.ts`
- [ ] `CulturalService` with all 10 methods; CDSS calls non-blocking
- [ ] `CulturalController` with 9 routes
- [ ] CDSS `POST /cdss/cultural/sdoh-risk` — Southern Africa SDOH scoring with community resource recommendations
- [ ] CDSS `POST /cdss/cultural/ubuntu-psychosocial` — herb-drug interaction + Ubuntu-adapted interventions
- [ ] Herb-drug interaction 'high' triggers flag in TM module / displays red banner
- [ ] `culturalApi` in `api.ts`
- [ ] `UbuntuCulturalPanel.tsx` — 3 tabs in patient detail page: SDOH, Family Consent, Wellbeing
- [ ] `provision-repair-all.sh` clean
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 159 — Ubuntu cultural health model with SDOH, family consent, psychosocial wellbeing`
