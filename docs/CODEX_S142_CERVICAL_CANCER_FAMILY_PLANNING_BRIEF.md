# Codex Sprint Brief — S142: Cervical Cancer Screening + Family Planning

**Date:** 2026-04-11
**Branch:** main
**Reviewer:** Claude (signs off before you move to S143)

---

## 1. Goal

Extend the EHR with two Africa-critical reproductive health modules that have zero current coverage:

- **Cervical cancer screening** — WHO screen-and-treat protocol: VIA/VILI visual inspection + HPV testing, followed by cryotherapy/thermocoagulation on-site or LEEP referral (no cytology lab required)
- **Family planning** — Contraceptive method enrollment, WHO Medical Eligibility Criteria (MEC) CDSS, continuation visits, side-effect tracking, LARC insertion/removal records

Both connect to the existing CHW module (`chw.controller.ts`) and PMTCT module (`pmtct.controller.ts`).

---

## 2. What Already Exists — Do NOT Recreate

### CDSS (`services/cdss-service/main.py`)
These endpoints exist — **do not touch them**:
- `POST /mental-health/screen`, `POST /mental-health/risk` — mental health only, leave alone
- `POST /malaria/act-dose`, `POST /malaria/g6pd-check`, `POST /malaria/iptp-due` — malaria, leave alone

### EHR Service
These controllers/services exist — **do not touch them**:
- `controllers/pmtct.controller.ts` + `services/pmtct.service.ts` — PMTCT, separate concern
- `controllers/maternity.controller.ts` + `services/maternity.service.ts` — maternity, separate concern
- `controllers/chw.controller.ts` — CHW module, **reference for how linkage should work** (by `patient_id`)
- `controllers/immunization.controller.ts` — EPI, separate concern
- `controllers/oncology.controller.ts` — general oncology, does not cover cervical screening

No cervical cancer or family planning controller, service, or entity exists anywhere in the codebase. These are new modules.

### Frontend (`ehr-frontend/src/`)
No existing cervical cancer or family planning component. Both are new.

---

## 3. Database Changes

### 3a. New tables

```sql
-- ── Cervical Cancer Screening ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cervical_screenings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL,
  screened_by           UUID NOT NULL,
  screened_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  method                VARCHAR(10) NOT NULL,      -- VIA | VILI | HPV | PAP
  result                VARCHAR(30) NOT NULL,      -- negative | positive | suspicious_cancer | unsatisfactory
  acetowhite            BOOLEAN,                  -- VIA: acetowhite lesion present
  acetowhite_area_pct   INT,                      -- estimated % of transformation zone
  lesion_location       VARCHAR(30),              -- ectocervix | squamocolumnar_junction | endocervix
  hpv_genotype          VARCHAR(20),              -- 16_18 | other_high_risk | negative (HPV tests)
  notes                 TEXT,
  next_screening_date   DATE,
  language_code         VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cerv_screen_patient   ON cervical_screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_cerv_screen_result    ON cervical_screenings(result);
CREATE INDEX IF NOT EXISTS idx_cerv_screen_date      ON cervical_screenings(screened_at);

CREATE TABLE IF NOT EXISTS cervical_treatments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id      UUID,                        -- links to cervical_screenings.id (no FK constraint)
  patient_id        UUID NOT NULL,
  treated_by        UUID NOT NULL,
  treated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  method            VARCHAR(30) NOT NULL,        -- cryotherapy | thermocoagulation | leep | lletz | referral_cancer
  outcome           VARCHAR(30),                 -- successful | incomplete | referred | deferred
  referral_reason   TEXT,
  follow_up_date    DATE,
  notes             TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cerv_treat_patient    ON cervical_treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_cerv_treat_screening  ON cervical_treatments(screening_id);

-- ── Family Planning ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_planning_enrollments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID NOT NULL,
  enrolled_by         UUID NOT NULL,
  enrolled_at         DATE NOT NULL,
  method              VARCHAR(30) NOT NULL,  -- coc | pop | implant | dmpa_im | dmpa_sc | lng_iud | cu_iud | condom | sterilisation | other
  method_detail       VARCHAR(100),          -- brand, sub-type, etc.
  mec_category        INT,                  -- 1 | 2 | 3 | 4 (WHO MEC)
  insertion_date      DATE,                 -- for LARC: implant / IUD
  removal_date        DATE,                 -- for LARC when removed
  expiry_date         DATE,                 -- for implants / IUDs
  next_visit_date     DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | discontinued | completed
  discontinuation_reason TEXT,
  notes               TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fp_enroll_patient     ON family_planning_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_fp_enroll_status      ON family_planning_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_fp_enroll_method      ON family_planning_enrollments(method);

CREATE TABLE IF NOT EXISTS family_planning_followups (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id           UUID,                          -- no FK constraint; nullable
  patient_id              UUID NOT NULL,
  conducted_by            UUID,
  visit_date              DATE NOT NULL,
  continuing              BOOLEAN NOT NULL DEFAULT true,
  side_effects            TEXT[],                        -- array of reported side effects
  side_effect_severity    VARCHAR(10),                  -- mild | moderate | severe
  method_change           BOOLEAN NOT NULL DEFAULT false,
  new_method              VARCHAR(30),
  counselling_given       BOOLEAN NOT NULL DEFAULT false,
  notes                   TEXT,
  next_visit_date         DATE,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fp_followup_patient    ON family_planning_followups(patient_id);
CREATE INDEX IF NOT EXISTS idx_fp_followup_enrollment ON family_planning_followups(enrollment_id);
```

### 3b. Provisioning bundle

File: `services/tenant-service/src/generated/tenant-cervical-fp.statements.ts`
Bundle version: `2026.04.11.15`

The bundle exports:
```typescript
export const TENANT_CERVICAL_FP_BUNDLE_VERSION = '2026.04.11.15';
export const TENANT_CERVICAL_FP_STATEMENTS = (): string[] => [ ... all SQL above ... ];
```

Register in `services/tenant-service/src/services/database-provisioning.service.ts` — import and add to the provisioning sequence after the existing mhGAP bundle, same pattern as all previous bundles.

---

## 4. New Entities

### `services/ehr-service/src/entities/cervical-screening.entity.ts`
Map every column from `cervical_screenings`. Use `@UpdateDateColumn` for `updated_at`.

### `services/ehr-service/src/entities/cervical-treatment.entity.ts`
Map every column from `cervical_treatments`. `screening_id` is nullable plain `@Column({ type: 'uuid', nullable: true })` — no TypeORM `@ManyToOne`.

### `services/ehr-service/src/entities/family-planning-enrollment.entity.ts`
Map every column from `family_planning_enrollments`. Use `@UpdateDateColumn` for `updated_at`. `side_effects` is not on this entity (it's on the followup).

### `services/ehr-service/src/entities/family-planning-followup.entity.ts`
Map every column from `family_planning_followups`. `enrollment_id` is nullable plain `@Column({ type: 'uuid', nullable: true })`. `side_effects` uses `@Column({ type: 'text', array: true, nullable: true })`.

---

## 5. EHR Service — Cervical Cancer Module

### New file: `services/ehr-service/src/services/cervical-cancer.service.ts`

```typescript
@Injectable()
export class CervicalCancerService {
  constructor(private readonly tenantService: TenantService) {}

  async recordScreening(tenantId: string, screenedBy: string | null, dto: Partial<CervicalScreening>)
  // save CervicalScreening; auto-set screened_by = screenedBy ?? dto.screenedBy

  async getScreenings(tenantId: string, patientId: string)
  // find by patientId, order screened_at DESC

  async getLatestScreening(tenantId: string, patientId: string)
  // findOne by patientId, order screened_at DESC

  async recordTreatment(tenantId: string, treatedBy: string | null, dto: Partial<CervicalTreatment>)
  // save CervicalTreatment; auto-set treated_by = treatedBy ?? dto.treatedBy

  async getTreatments(tenantId: string, patientId: string)
  // find by patientId, order treated_at DESC

  async getScreenTreatRecommendation(method: string, result: string, acetowhiteAreaPct?: number, hpvGenotype?: string, lesionLocation?: string): Promise<Record<string, any>>
  // call cdssService or return local recommendation (see Section 5b below)
}
```

#### 5b. Local screen-and-treat recommendation fallback

If CDSS is unavailable, apply WHO screen-and-treat rules directly in the service:

```typescript
private localScreenTreatRecommend(
  method: string, result: string,
  acetowhiteAreaPct?: number,
  hpvGenotype?: string,
  lesionLocation?: string,
): Record<string, any> {
  const METHOD = method.toUpperCase();
  const RESULT = result.toLowerCase();

  // Suspicious for cancer — always refer
  if (RESULT === 'suspicious_cancer') {
    return {
      recommendation: 'refer_cancer_treatment',
      action: 'Refer urgently to oncology or cancer treatment centre',
      eligible_for_ablative_treatment: false,
      refer_specialist: true,
      urgency: 'urgent',
      guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
    };
  }

  // Negative result
  if (RESULT === 'negative') {
    const nextYears = (METHOD === 'HPV' && hpvGenotype?.includes('16') || hpvGenotype?.includes('18')) ? 1 : 3;
    return {
      recommendation: 'routine_rescreening',
      action: `Result negative. Rescreening recommended in ${nextYears} year(s).`,
      eligible_for_ablative_treatment: false,
      refer_specialist: false,
      urgency: 'routine',
      guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
    };
  }

  // Positive VIA/VILI — apply cryotherapy eligibility criteria
  if (METHOD === 'VIA' || METHOD === 'VILI') {
    const smallLesion = (acetowhiteAreaPct ?? 100) <= 75;
    const ectocervixLocation = !lesionLocation || lesionLocation === 'ectocervix' || lesionLocation === 'squamocolumnar_junction';
    const cryoEligible = smallLesion && ectocervixLocation;

    return {
      recommendation: cryoEligible ? 'cryotherapy' : 'refer_leep',
      action: cryoEligible
        ? 'Lesion eligible for cryotherapy. Treat same day (screen-and-treat). Schedule follow-up in 12 months.'
        : 'Lesion not eligible for cryotherapy (too large or extends into endocervix). Refer for LEEP/LLETZ.',
      eligible_for_ablative_treatment: cryoEligible,
      refer_specialist: !cryoEligible,
      urgency: 'same_day',
      guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
    };
  }

  // HPV positive
  if (METHOD === 'HPV') {
    const highRisk1618 = hpvGenotype === '16_18';
    return {
      recommendation: highRisk1618 ? 'refer_colposcopy' : 'via_triage',
      action: highRisk1618
        ? 'HPV 16/18 positive. Refer for colposcopy and biopsy.'
        : 'HPV positive (non-16/18). Perform VIA triage. If VIA positive, treat; if negative, rescreening in 12 months.',
      eligible_for_ablative_treatment: false,
      refer_specialist: highRisk1618,
      urgency: highRisk1618 ? 'within_4_weeks' : 'routine',
      guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
    };
  }

  return {
    recommendation: 'clinical_review',
    action: 'Discuss results with clinician.',
    eligible_for_ablative_treatment: false,
    refer_specialist: false,
    urgency: 'routine',
    guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
  };
}
```

### New file: `services/ehr-service/src/controllers/cervical-cancer.controller.ts`

```typescript
@Controller('cervical-cancer')
@UseGuards(JwtAuthGuard)
export class CervicalCancerController {
  // POST /cervical-cancer/patient/:patientId/screenings
  // GET  /cervical-cancer/patient/:patientId/screenings
  // GET  /cervical-cancer/patient/:patientId/screenings/latest
  // POST /cervical-cancer/patient/:patientId/treatments
  // GET  /cervical-cancer/patient/:patientId/treatments
  // POST /cervical-cancer/cdss/screen-recommend
}
```

Use `req.tenantId!` from `RequestWithTenant`. Use `req.user?.sub || req.user?.id || null` for `screenedBy`/`treatedBy`.

---

## 6. EHR Service — Family Planning Module

### New file: `services/ehr-service/src/services/family-planning.service.ts`

```typescript
@Injectable()
export class FamilyPlanningService {
  constructor(private readonly tenantService: TenantService) {}

  async enroll(tenantId: string, enrolledBy: string | null, dto: Partial<FamilyPlanningEnrollment>)
  // If patient already has an 'active' enrollment, set it to 'discontinued' before saving the new one

  async getEnrollments(tenantId: string, patientId: string)
  // find by patientId, order enrolled_at DESC

  async getActiveEnrollment(tenantId: string, patientId: string)
  // findOne by patientId, status = 'active'

  async updateEnrollment(tenantId: string, id: string, dto: Partial<FamilyPlanningEnrollment>)
  // update + return updated record; throw NotFoundException if not found

  async recordFollowup(tenantId: string, conductedBy: string | null, dto: Partial<FamilyPlanningFollowup>)
  // save; conductedBy = conductedBy ?? dto.conductedBy

  async getFollowups(tenantId: string, patientId: string)
  // find by patientId, order visit_date DESC
}
```

### New file: `services/ehr-service/src/controllers/family-planning.controller.ts`

```typescript
@Controller('family-planning')
@UseGuards(JwtAuthGuard)
export class FamilyPlanningController {
  // POST /family-planning/patient/:patientId/enroll
  // GET  /family-planning/patient/:patientId/enrollments
  // GET  /family-planning/patient/:patientId/active
  // PATCH /family-planning/enrollments/:id
  // POST /family-planning/patient/:patientId/followups
  // GET  /family-planning/patient/:patientId/followups
  // POST /family-planning/cdss/method-eligibility
}
```

`/family-planning/cdss/method-eligibility` — calls the CDSS endpoint and returns the result to the client. Body passes through to `POST /cdss/family-planning/method-eligibility`.

---

## 7. CDSS Service — New Endpoints

Add to `services/cdss-service/main.py`. Do not touch any existing endpoints.

### 7a. Pydantic models

```python
class CervicalScreenRecommendRequest(BaseModel):
    method: str                          # VIA | VILI | HPV | PAP
    result: str                          # negative | positive | suspicious_cancer | unsatisfactory
    acetowhite_area_pct: Optional[int] = None   # 0–100
    lesion_location: Optional[str] = None       # ectocervix | squamocolumnar_junction | endocervix
    hpv_genotype: Optional[str] = None         # 16_18 | other_high_risk | negative
    patient_age: Optional[int] = None
    prior_treatment: bool = False

class FpMethodEligibilityRequest(BaseModel):
    age: Optional[int] = None
    parity: Optional[int] = None
    breastfeeding_weeks_postpartum: Optional[int] = None  # weeks since delivery; None if not postpartum
    bmi: Optional[float] = None
    smoking: bool = False
    hypertension: bool = False
    systolic_bp: Optional[int] = None
    diabetes: bool = False
    hiv_positive: bool = False
    arv_regimen: Optional[str] = None   # efv_nvp | pi_based | dtg | none
    prior_dvt_or_pe: bool = False
    migraine_with_aura: bool = False
    liver_disease: bool = False
    breast_cancer_history: bool = False
```

### 7b. Endpoint: `POST /cdss/cervical-cancer/screen-recommend`

Rule-based — no LLM. Load `data/cervical_cancer_protocol.json` and apply the WHO screen-and-treat algorithm.

Decision logic:
1. `suspicious_cancer` → **always** `refer_cancer_treatment` (urgent)
2. `negative` → routine rescreening (3 years for VIA/VILI; 1 year if HPV 16/18 other-hrHPV; 3 years if HPV negative)
3. VIA/VILI `positive` → cryotherapy eligible if: lesion ≤75% of transformation zone AND confined to ectocervix/SCJ; otherwise refer for LEEP/LLETZ
4. HPV `positive` with 16/18 → refer colposcopy; with other hrHPV → VIA triage first

Response shape:
```json
{
  "recommendation": "cryotherapy",
  "action": "Lesion eligible for cryotherapy. Treat same day (screen-and-treat). Schedule follow-up in 12 months.",
  "eligible_for_ablative_treatment": true,
  "refer_specialist": false,
  "urgency": "same_day",
  "guideline": "WHO Cervical Cancer Prevention & Control (2021)"
}
```

### 7c. Endpoint: `POST /cdss/family-planning/method-eligibility`

Rule-based — no LLM. Load `data/who_mec_rules.json` and evaluate WHO MEC Category (1–4) for each method.

Methods to evaluate: `coc`, `pop`, `implant`, `dmpa_im`, `dmpa_sc`, `lng_iud`, `cu_iud`, `condom`

Key MEC rules (encode exactly — these are WHO MEC 5th edition):
| Condition | Method | Category |
|-----------|--------|----------|
| Breastfeeding < 6 weeks postpartum | COC | 4 |
| Breastfeeding 6 weeks–6 months | COC | 3 |
| HIV on EFV/NVP/ritonavir-boosted PI | COC, POP, implant | 2 |
| HIV on DTG | COC, implant | 1 |
| Hypertension ≥160 systolic OR SBP uncontrolled | COC | 4 |
| Hypertension ≥160 | DMPA-IM | 3 |
| Hypertension ≥160 | POP, implant, LNG-IUD, Cu-IUD | 2 |
| Migraine with aura (any age) | COC | 4 |
| Migraine without aura ≥35 | COC | 3 |
| Prior DVT/PE | COC | 4 |
| Prior DVT/PE | DMPA-IM | 2 |
| Breast cancer history | All hormonal methods | 4 |
| Liver disease (active) | COC, POP, implant | 3 |
| Age < 18 | DMPA-IM | 2 (bone density concern) |
| Age ≥ 40 | COC | 2 |
| Smoking + age ≥ 35 | COC | 3–4 depending on heaviness |

Condom is always Category 1 (no medical contraindications).
Cu-IUD is always Category 1 for all above conditions (non-hormonal).

Response shape:
```json
{
  "patient_summary": {
    "age": 28,
    "hiv_positive": true,
    "arv_regimen": "efv_nvp"
  },
  "methods": [
    { "method": "coc",     "mec_category": 2, "notes": "Potential interaction with EFV/NVP — may reduce efficacy; use with caution, consider dual method" },
    { "method": "pop",     "mec_category": 2, "notes": "Potential interaction with EFV/NVP" },
    { "method": "implant", "mec_category": 2, "notes": "Potential interaction with EFV/NVP" },
    { "method": "dmpa_im", "mec_category": 1, "notes": "No clinically significant interaction with ARVs" },
    { "method": "dmpa_sc", "mec_category": 1, "notes": "No clinically significant interaction with ARVs" },
    { "method": "lng_iud", "mec_category": 1, "notes": "Suitable; local effect, minimal systemic absorption" },
    { "method": "cu_iud",  "mec_category": 1, "notes": "Suitable; non-hormonal, no drug interaction" },
    { "method": "condom",  "mec_category": 1, "notes": "Always recommended additionally for STI/HIV prevention" }
  ],
  "recommended": ["dmpa_im", "dmpa_sc", "lng_iud", "cu_iud", "condom"],
  "contraindicated": [],
  "guideline": "WHO Medical Eligibility Criteria for Contraceptive Use, 5th edition (2015, updated 2016)"
}
```

### 7d. Endpoint: `GET /cdss/family-planning/methods`

Returns all supported methods with descriptions — no input required.

```json
{
  "methods": [
    { "id": "coc",      "name": "Combined Oral Contraceptive",   "type": "hormonal_oral",    "duration": "daily", "larc": false },
    { "id": "pop",      "name": "Progestogen-Only Pill",         "type": "hormonal_oral",    "duration": "daily", "larc": false },
    { "id": "implant",  "name": "Subdermal Implant",             "type": "hormonal_implant", "duration": "3–5 years", "larc": true },
    { "id": "dmpa_im",  "name": "DMPA Injectable (IM)",          "type": "hormonal_inject",  "duration": "3 months", "larc": false },
    { "id": "dmpa_sc",  "name": "DMPA-SC Sayana Press",          "type": "hormonal_inject",  "duration": "3 months", "larc": false },
    { "id": "lng_iud",  "name": "Levonorgestrel IUD (Mirena)",   "type": "hormonal_iud",     "duration": "5 years", "larc": true },
    { "id": "cu_iud",   "name": "Copper IUD",                    "type": "non_hormonal_iud", "duration": "10 years", "larc": true },
    { "id": "condom",   "name": "Male/Female Condom",            "type": "barrier",          "duration": "per use", "larc": false }
  ]
}
```

---

## 8. CDSS Data Files

### 8a. `services/cdss-service/data/cervical_cancer_protocol.json`

```json
{
  "version": "WHO-2021",
  "guideline": "WHO Cervical Cancer Prevention & Control (2021)",
  "screen_and_treat_pathways": {
    "VIA": {
      "negative": { "recommendation": "routine_rescreening", "next_screen_years": 3 },
      "positive": {
        "eligible_for_cryotherapy_if": "acetowhite_area_pct <= 75 AND lesion_location IN (ectocervix, squamocolumnar_junction)",
        "cryotherapy_action": "Treat same day. Follow-up in 12 months.",
        "leep_action": "Refer for LEEP/LLETZ within 4 weeks."
      },
      "suspicious_cancer": { "recommendation": "refer_cancer_treatment", "urgency": "urgent" },
      "unsatisfactory": { "recommendation": "repeat_in_3_months" }
    },
    "VILI": {
      "negative": { "recommendation": "routine_rescreening", "next_screen_years": 3 },
      "positive": {
        "eligible_for_cryotherapy_if": "acetowhite_area_pct <= 75 AND lesion_location IN (ectocervix, squamocolumnar_junction)",
        "cryotherapy_action": "Treat same day. Follow-up in 12 months.",
        "leep_action": "Refer for LEEP/LLETZ within 4 weeks."
      },
      "suspicious_cancer": { "recommendation": "refer_cancer_treatment", "urgency": "urgent" }
    },
    "HPV": {
      "negative": { "recommendation": "routine_rescreening", "next_screen_years": 5 },
      "positive_16_18": { "recommendation": "refer_colposcopy", "urgency": "within_4_weeks" },
      "positive_other_hrHPV": { "recommendation": "via_triage_first", "urgency": "routine" }
    }
  },
  "age_based_screening_start": 25,
  "notes": "Where HPV test unavailable, VIA is the WHO-recommended alternative for LMIC settings."
}
```

### 8b. `services/cdss-service/data/who_mec_rules.json`

Structure — all values are WHO MEC Category (1–4). Only include entries that deviate from Category 1.

```json
{
  "version": "WHO-MEC-5th-2015",
  "guideline": "WHO Medical Eligibility Criteria for Contraceptive Use, 5th edition",
  "categories": {
    "1": "Use without restriction",
    "2": "Advantages generally outweigh risks",
    "3": "Risks generally outweigh advantages",
    "4": "Unacceptable health risk — do not use"
  },
  "rules": [
    { "condition": "breastfeeding_lt_6_weeks",       "method": "coc",     "category": 4, "notes": "Oestrogen reduces milk supply and passes to infant" },
    { "condition": "breastfeeding_lt_6_weeks",       "method": "pop",     "category": 2, "notes": "Progestogen-only; caution but generally acceptable" },
    { "condition": "breastfeeding_6w_to_6m",         "method": "coc",     "category": 3, "notes": "Milk supply considerations; prefer progestogen-only" },
    { "condition": "hiv_arv_efv_nvp_rtv_pi",         "method": "coc",     "category": 2, "notes": "Drug interaction may reduce efficacy; use additional method" },
    { "condition": "hiv_arv_efv_nvp_rtv_pi",         "method": "pop",     "category": 2, "notes": "Drug interaction possible; use additional method" },
    { "condition": "hiv_arv_efv_nvp_rtv_pi",         "method": "implant", "category": 2, "notes": "Drug interaction — EFV reduces implant efficacy" },
    { "condition": "hypertension_gte_160",            "method": "coc",     "category": 4, "notes": "High cardiovascular risk with oestrogen" },
    { "condition": "hypertension_gte_160",            "method": "dmpa_im", "category": 3, "notes": "Theoretical cardiovascular concern; monitor BP" },
    { "condition": "hypertension_gte_160",            "method": "pop",     "category": 2 },
    { "condition": "hypertension_gte_160",            "method": "implant", "category": 2 },
    { "condition": "hypertension_gte_160",            "method": "lng_iud", "category": 2 },
    { "condition": "migraine_with_aura",              "method": "coc",     "category": 4, "notes": "Stroke risk with oestrogen + aura" },
    { "condition": "migraine_no_aura_age_gte_35",    "method": "coc",     "category": 3 },
    { "condition": "prior_dvt_pe",                   "method": "coc",     "category": 4 },
    { "condition": "prior_dvt_pe",                   "method": "dmpa_im", "category": 2 },
    { "condition": "breast_cancer_history",           "method": "coc",     "category": 4 },
    { "condition": "breast_cancer_history",           "method": "pop",     "category": 4 },
    { "condition": "breast_cancer_history",           "method": "implant", "category": 4 },
    { "condition": "breast_cancer_history",           "method": "dmpa_im", "category": 4 },
    { "condition": "breast_cancer_history",           "method": "lng_iud", "category": 4 },
    { "condition": "liver_disease_active",            "method": "coc",     "category": 3 },
    { "condition": "liver_disease_active",            "method": "pop",     "category": 3 },
    { "condition": "liver_disease_active",            "method": "implant", "category": 3 },
    { "condition": "age_lt_18",                      "method": "dmpa_im", "category": 2, "notes": "Bone density concern; consider implant or IUD instead" },
    { "condition": "age_gte_40",                     "method": "coc",     "category": 2, "notes": "Age-related cardiovascular risk" },
    { "condition": "smoking_age_gte_35",             "method": "coc",     "category": 3 }
  ],
  "always_category_1": ["cu_iud", "condom"]
}
```

---

## 9. Module Registration

### `services/ehr-service/src/services/tenant.service.ts`
Import and add all four new entities to the DataSource `entities[]` array:
```typescript
import { CervicalScreening } from '../entities/cervical-screening.entity';
import { CervicalTreatment } from '../entities/cervical-treatment.entity';
import { FamilyPlanningEnrollment } from '../entities/family-planning-enrollment.entity';
import { FamilyPlanningFollowup } from '../entities/family-planning-followup.entity';
// Add all four to entities[]
```

### `services/ehr-service/src/ehr.module.ts`
Register both new controllers and services:
```typescript
import { CervicalCancerController } from './controllers/cervical-cancer.controller';
import { CervicalCancerService } from './services/cervical-cancer.service';
import { FamilyPlanningController } from './controllers/family-planning.controller';
import { FamilyPlanningService } from './services/family-planning.service';
// Add to controllers[] and providers[]
```

---

## 10. Frontend

### 10a. New component: `ehr-frontend/src/components/CervicalCancerDashboard.tsx`

Standalone component that receives `patientId: string` as a prop. Two tabs:

**Screenings tab:**
- List of past screenings (date, method, result, action taken)
- "Add Screening" form: method selector (VIA/VILI/HPV/PAP), result selector, optional acetowhite area %, lesion location, HPV genotype (shown only when method = HPV)
- After save: automatically calls `POST /cdss/cervical-cancer/screen-recommend` with the screening data and shows the WHO recommendation as an inline alert panel (colour-coded by urgency: green=routine, amber=within_4_weeks, red=urgent/same_day)

**Treatments tab:**
- List of past treatments
- "Record Treatment" form: links to a past screening (dropdown), method (cryotherapy/thermocoagulation/LEEP/referral_cancer), outcome, referral reason (shown when outcome=referred), follow-up date

### 10b. New component: `ehr-frontend/src/components/FamilyPlanningDashboard.tsx`

Standalone component that receives `patientId: string`. Three tabs:

**Current Method tab:**
- Displays active enrollment (method, date enrolled, expiry date, next visit date)
- "Enrol / Switch Method" button: opens form with method selector, then triggers `POST /cdss/family-planning/method-eligibility` to show MEC categories before saving
- MEC results displayed as a table: each method with a colour-coded badge (1=green, 2=yellow, 3=orange, 4=red) and notes; recommended methods highlighted

**Record Visit tab:**
- Follow-up form: continuing (yes/no), side effects (multi-select checkboxes), severity, method change (if yes, show new method selector), counselling given, next visit date
- On submit: `POST /family-planning/patient/:patientId/followups`

**History tab:**
- Past enrollments and visits table

### 10c. Wire into existing dashboards

**`ehr-frontend/src/pages/NurseDashboard.tsx`** — add a "Reproductive Health" section (collapsible card) with:
- "Cervical Screening" button → opens `CervicalCancerDashboard` modal
- "Family Planning" button → opens `FamilyPlanningDashboard` modal

No new routes needed — modal pattern only, same as existing nurse dashboard modals.

### 10d. `ehr-frontend/src/services/api.ts` — add methods

Add a `cervicalCancer` namespace object and a `familyPlanning` namespace object with methods that call the new endpoints. Use `ehrAxios` for all EHR service calls. Use `cdssAxios` for the two CDSS calls.

```typescript
// EHR calls — ehrAxios
ehrAxios.post(`/cervical-cancer/patient/${patientId}/screenings`, dto, { headers })
ehrAxios.get(`/cervical-cancer/patient/${patientId}/screenings`, { headers })
ehrAxios.get(`/cervical-cancer/patient/${patientId}/screenings/latest`, { headers })
ehrAxios.post(`/cervical-cancer/patient/${patientId}/treatments`, dto, { headers })
ehrAxios.get(`/cervical-cancer/patient/${patientId}/treatments`, { headers })
ehrAxios.post(`/family-planning/patient/${patientId}/enroll`, dto, { headers })
ehrAxios.get(`/family-planning/patient/${patientId}/enrollments`, { headers })
ehrAxios.get(`/family-planning/patient/${patientId}/active`, { headers })
ehrAxios.patch(`/family-planning/enrollments/${id}`, dto, { headers })
ehrAxios.post(`/family-planning/patient/${patientId}/followups`, dto, { headers })
ehrAxios.get(`/family-planning/patient/${patientId}/followups`, { headers })

// CDSS calls — cdssAxios
cdssAxios.post('/cdss/cervical-cancer/screen-recommend', data, { headers })
cdssAxios.post('/cdss/family-planning/method-eligibility', data, { headers })
cdssAxios.get('/cdss/family-planning/methods', { headers })
```

---

## 11. Tests

### `services/ehr-service/src/services/cervical-cancer.service.spec.ts`
Test `recordScreening`, `getScreenings`, `getLatestScreening`, `recordTreatment`. Follow the existing mock pattern (mock `TenantService.getTenantDatabase`, mock repo methods).

### `services/ehr-service/src/services/family-planning.service.spec.ts`
Test `enroll` (including auto-discontinue of existing active enrollment), `getActiveEnrollment`, `recordFollowup`. Same mock pattern.

### CDSS (Python)
`py_compile` check is sufficient — no new pytest files required.

---

## 12. Validation Checklist (run before marking done)

```bash
cd services/tenant-service && npx tsc --noEmit
cd services/ehr-service     && npx tsc --noEmit
cd ehr-frontend             && npx tsc --noEmit
cd services/cdss-service    && python3 -m py_compile main.py
cd services/ehr-service     && npx jest src/services/cervical-cancer.service.spec.ts src/services/family-planning.service.spec.ts --runInBand
git diff --check
```

Also verify:
- All four tables (`cervical_screenings`, `cervical_treatments`, `family_planning_enrollments`, `family_planning_followups`) exist in at least one tenant DB after provisioning
- `POST /cdss/cervical-cancer/screen-recommend` returns `cryotherapy` recommendation for `{ "method": "VIA", "result": "positive", "acetowhite_area_pct": 50, "lesion_location": "ectocervix" }`
- `POST /cdss/cervical-cancer/screen-recommend` returns `refer_cancer_treatment` for `{ "method": "VIA", "result": "suspicious_cancer" }`
- `POST /cdss/family-planning/method-eligibility` returns `category: 4` for COC when `migraine_with_aura: true`
- `POST /cdss/family-planning/method-eligibility` returns `category: 1` for `cu_iud` regardless of conditions

---

## 13. Conventions (same as all previous sprints)

- Tenant header: `X-Tenant-ID`
- EHR API calls from frontend: `ehrAxios` from `src/services/api.ts`
- CDSS API calls from frontend: `cdssAxios` from `src/services/api.ts`
- No `import.meta` / `VITE_*` in frontend — this is CRA/craco (webpack); use `process.env.REACT_APP_*`
- No hardcoded production URLs as env var fallbacks — use empty string + guard
- All new EHR controller routes behind `@UseGuards(JwtAuthGuard)`
- Use `req.tenantId!` from `RequestWithTenant` for tenant extraction in new routes
- No FK constraints on cross-entity UUID references — use plain nullable `@Column`

---

## 14. Done When

- VIA-positive screening with small ectocervical lesion → CDSS returns `cryotherapy` recommendation
- HPV-positive with 16/18 genotype → CDSS returns `refer_colposcopy`
- Suspicious cancer result → CDSS returns `refer_cancer_treatment` (urgent)
- Family planning enrollment creates a record; enrolling a second method auto-discontinues the first
- MEC eligibility check returns Category 4 (do not use) for COC + migraine with aura
- MEC eligibility check returns Category 1 for Cu-IUD regardless of conditions
- Follow-up records side effects and links to enrollment
- DMPA injection recommended (Category 1) for HIV+ patient on EFV regimen
- Lint, TypeScript, build, and tests pass
