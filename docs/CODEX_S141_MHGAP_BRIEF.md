# Codex Sprint Brief — S141: mhGAP Mental Health + SADC Language Tools

**Date:** 2026-04-11
**Branch:** main
**Reviewer:** Claude (signs off before you move to S142)

---

## 1. Goal

Extend the EHR with:
- **mhGAP Intervention Guide (IG 2.0)** CDS — rule-based decision trees for nurse/CHW-delivered mental health care
- **SADC multilingual screening tools** — PHQ-9 and GAD-7 questions served as JSON in 12 languages (not hardcoded JSX)
- **Community mental health care plans** — structured plans with CHW assignment and review scheduling
- **Community follow-up visits** — linked to care plans, with safety concern flags
- **Mental health referral pathway** — configurable per-country pathway returned from the EHR

---

## 2. What Already Exists — Do NOT Recreate

### CDSS (`services/cdss-service/main.py`)
These endpoints already exist — **call them, do not recreate them**:
- `POST /mental-health/screen` — PHQ-9/GAD-7/AUDIT score interpretation
- `POST /mental-health/risk` — suicide/self-harm risk stratification
- `POST /mental-health/medication/monitor` — medication adherence monitoring

### EHR Service (`services/ehr-service/src/`)
These already exist — **do not recreate them**:
- `services/mental-health.service.ts` — screening, encounters, crisis notes, safe plans, medications
- `controllers/mental-health.controller.ts` — all routes under `/mental-health/`
  - `POST /mental-health/patient/:patientId/screenings`
  - `GET  /mental-health/patient/:patientId/screenings`
  - `GET  /mental-health/patient/:patientId/screenings/latest`
  - `POST /mental-health/patient/:patientId/encounters`
  - `GET  /mental-health/patient/:patientId/encounters`
  - `PATCH /mental-health/encounters/:id`
  - `POST /mental-health/patient/:patientId/crisis`
  - `GET  /mental-health/patient/:patientId/crisis`
  - `PATCH /mental-health/crisis/:id`
  - `POST /mental-health/patient/:patientId/safe-plan`
  - `GET  /mental-health/patient/:patientId/safe-plan`
  - `GET  /mental-health/patient/:patientId/safe-plan/history`
  - `POST /mental-health/patient/:patientId/medications`
  - `GET  /mental-health/patient/:patientId/medications`
  - `PATCH /mental-health/medications/:id`
  - `POST /mental-health/cdss/screen` (proxies CDSS)
  - `POST /mental-health/cdss/risk` (proxies CDSS)
  - `POST /mental-health/cdss/medication/monitor` (proxies CDSS)
- `entities/mental-health-screening.entity.ts` + `mental_health_screenings` table — already exist

### Frontend (`ehr-frontend/src/`)
These already exist — **extend, do not replace**:
- `components/MentalHealthDashboard.tsx`
- `pages/NurseDashboard.tsx`

---

## 3. Database Changes

### 3a. ALTER existing `mental_health_screenings` table
Add two missing columns. Use `ADD COLUMN IF NOT EXISTS` — the table already exists.

```sql
ALTER TABLE mental_health_screenings
  ADD COLUMN IF NOT EXISTS language_code VARCHAR(5) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS referred BOOLEAN NOT NULL DEFAULT false;
```

Also update the `MentalHealthScreening` entity to add these two fields:
```typescript
@Column({ name: 'language_code', default: 'en' }) languageCode: string;
@Column({ name: 'referred', default: false }) referred: boolean;
```

### 3b. New tables

```sql
CREATE TABLE IF NOT EXISTS mental_health_care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  diagnosis_icd10 VARCHAR(10),
  diagnosis_name VARCHAR(100),
  care_level VARCHAR(20),          -- community | clinic | district | specialist
  assigned_chw_id UUID,
  assigned_provider UUID,
  goals TEXT[],
  interventions TEXT[],
  medication VARCHAR(100),
  review_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mh_care_plans_patient ON mental_health_care_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_mh_care_plans_status  ON mental_health_care_plans(status);

CREATE TABLE IF NOT EXISTS mental_health_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID,
  patient_id UUID NOT NULL,
  followup_date DATE NOT NULL,
  conducted_by UUID,
  status VARCHAR(20),
  symptom_change VARCHAR(20),
  medication_adherent BOOLEAN,
  safety_concern BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  next_followup_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mh_followups_patient   ON mental_health_followups(patient_id);
CREATE INDEX IF NOT EXISTS idx_mh_followups_care_plan ON mental_health_followups(care_plan_id);
CREATE INDEX IF NOT EXISTS idx_mh_followups_safety    ON mental_health_followups(safety_concern);
```

### 3c. Provisioning bundle
File: `services/tenant-service/src/generated/tenant-mental-health-mhgap.statements.ts`
Bundle version: `2026.04.11.14`

The bundle must contain **all** of the above: the two `ADD COLUMN IF NOT EXISTS` statements followed by the two `CREATE TABLE IF NOT EXISTS` blocks and their indexes.

Register in `services/tenant-service/src/services/database-provisioning.service.ts` — import and add to the provisioning sequence, same pattern as all previous bundles.

---

## 4. New Entities

### `services/ehr-service/src/entities/mental-health-care-plan.entity.ts`
Map every column from the SQL above. Use:
- `@Column({ type: 'text', array: true, nullable: true })` for `goals` and `interventions`
- `@UpdateDateColumn` for `updated_at`

### `services/ehr-service/src/entities/mental-health-followup.entity.ts`
Map every column from the SQL above. `care_plan_id` is nullable (no FK constraint in the entity — no TypeORM `@ManyToOne`, just a plain `@Column({ nullable: true })`).

---

## 5. EHR Service — New Endpoints

Add to the **existing** `mental-health.service.ts` and `mental-health.controller.ts`. Do not create new files.

### Service methods to add
```
createCarePlan(tenantId, userId, body)   → save MentalHealthCarePlan
getCarePlans(tenantId, patientId)        → find by patientId, order by created_at DESC
updateCarePlan(tenantId, id, body)       → update + return updated record
recordFollowup(tenantId, userId, body)   → save MentalHealthFollowup
getFollowups(tenantId, patientId)        → find by patientId, order by followup_date DESC
getReferralPathway(tenantId)             → return static pathway object (see Section 7)
```

### Controller routes to add
```
POST   /mental-health/care-plans                 → createCarePlan
GET    /mental-health/care-plans/:patientId      → getCarePlans
PATCH  /mental-health/care-plans/:id             → updateCarePlan
POST   /mental-health/followups                  → recordFollowup
GET    /mental-health/followups/:patientId       → getFollowups
GET    /mental-health/referral-pathway           → getReferralPathway
```

All new routes must be behind `@UseGuards(JwtAuthGuard)` (already applies at controller level — just add the methods and routes).

Use `req.tenantId!` from `RequestWithTenant` for tenant extraction — match the existing pattern in the controller.

---

## 6. CDSS Service — New Endpoints

Add to `services/cdss-service/main.py`. Do not touch any existing endpoints.

### 6a. Pydantic models

```python
class MhGapAssessRequest(BaseModel):
    presenting_complaint: str
    duration_weeks: Optional[int] = None
    functional_impairment: bool = False
    prior_episode: bool = False
    substance_use: bool = False
    safety_concern: bool = False
    age_years: Optional[int] = None
    pregnancy: bool = False

class ScreeningInterpretRequest(BaseModel):
    tool: str          # PHQ9 | GAD7 | AUDIT | SRQ | MINI
    score: int
    language_code: str = "en"
    age_years: Optional[int] = None
    pregnancy: bool = False

class SafetyPlanRequest(BaseModel):
    risk_level: str    # low | moderate | high | imminent
    patient_age: Optional[int] = None
    prior_attempt: bool = False

class ScreeningToolsQuery(BaseModel):
    tool: str          # PHQ9 | GAD7
    language_code: str = "en"
```

### 6b. Endpoint: `POST /cdss/mental-health/mhgap-assess`

Rule-based — do NOT use an LLM for condition classification. Load `data/mhgap_rules.json` and match the presenting complaint against condition keys. Return the matched condition, mhGAP management steps, and whether specialist referral is required.

Response shape:
```json
{
  "condition": "Depression",
  "icd10": "F32",
  "severity": "moderate",
  "management_steps": ["..."],
  "refer_specialist": false,
  "safety_alert": false,
  "guideline": "WHO mhGAP-IG 2.0"
}
```

### 6c. Endpoint: `POST /cdss/mental-health/screening-interpret`

Interprets a raw score for any supported tool + language. Load score cutoffs from `data/mhgap_rules.json`. Return severity label, recommended action, and the tool name in the requested language (from the screening tools data files).

Response shape:
```json
{
  "tool": "PHQ9",
  "score": 14,
  "severity": "moderate",
  "action": "Initiate antidepressant or psychosocial intervention; review in 2 weeks",
  "refer_specialist": false,
  "guideline": "WHO mhGAP-IG 2.0"
}
```

This endpoint handles languages that the original `POST /mental-health/screen` does not support. Do not replace the original endpoint.

### 6d. Endpoint: `POST /cdss/mental-health/safety-plan`

Returns a structured safety plan template. Rule-based — no LLM. Imminent risk always triggers "emergency services / inpatient referral."

Response shape:
```json
{
  "risk_level": "high",
  "warning_signs": ["..."],
  "coping_strategies": ["..."],
  "support_contacts": ["..."],
  "means_restriction_advice": "...",
  "emergency_action": "...",
  "guideline": "WHO mhGAP-IG 2.0"
}
```

### 6e. Endpoint: `GET /cdss/mental-health/screening-tools`

Returns list of available screening tools with supported language codes and display names.

```python
@app.get("/cdss/mental-health/screening-tools")
async def list_screening_tools():
    ...
```

Response shape:
```json
{
  "tools": [
    {
      "id": "PHQ9",
      "name": "Patient Health Questionnaire – 9",
      "languages": ["en", "sw", "zu", "xh", "af", "sn", "nd", "tn", "ny", "pt", "fr", "ln"]
    },
    {
      "id": "GAD7",
      "name": "Generalised Anxiety Disorder Scale – 7",
      "languages": ["en", "sw", "zu", "xh", "af", "sn", "nd", "tn", "ny", "pt", "fr", "ln"]
    }
  ]
}
```

---

## 7. CDSS Data Files

### 7a. `services/cdss-service/data/mhgap_rules.json`

Structure:
```json
{
  "conditions": {
    "depression": {
      "icd10": "F32",
      "keywords": ["sad", "depressed", "hopeless", "low mood", "worthless", "sleep", "appetite"],
      "management_steps": [
        "Assess for suicide/self-harm risk (ask directly)",
        "Identify psychosocial stressors",
        "Provide psychosocial support (problem-solving, behavioural activation)",
        "Consider antidepressant (amitriptyline or fluoxetine) if moderate-severe",
        "Review in 2 weeks; refer if no improvement at 4 weeks"
      ],
      "refer_if": ["psychosis", "bipolar", "no improvement at 4 weeks", "suicide risk high"]
    },
    "anxiety": {
      "icd10": "F41",
      "keywords": ["anxious", "worry", "panic", "fear", "palpitations", "restless"],
      "management_steps": [
        "Rule out medical causes (thyroid, cardiac)",
        "Psychoeducation about anxiety",
        "Relaxation techniques and breathing exercises",
        "Consider benzodiazepine only for short-term (<2 weeks) severe acute anxiety",
        "Review in 2–4 weeks; refer if persistent"
      ],
      "refer_if": ["severe panic disorder", "PTSD", "OCD"]
    },
    "psychosis": {
      "icd10": "F20",
      "keywords": ["voices", "hallucination", "delusion", "paranoid", "bizarre behaviour", "disorganised"],
      "management_steps": [
        "Ensure safety of patient and others",
        "Administer antipsychotic (haloperidol or chlorpromazine) per local formulary",
        "Refer urgently to mental health specialist",
        "Educate family on supportive care",
        "Follow up monthly once stabilised"
      ],
      "refer_if": ["first episode", "treatment-resistant", "risk of harm"]
    },
    "substance_use": {
      "icd10": "F10",
      "keywords": ["alcohol", "drugs", "substance", "withdrawal", "dependence", "craving"],
      "management_steps": [
        "Conduct AUDIT-C for alcohol use severity",
        "Assess for withdrawal risk (seizures, delirium)",
        "Provide brief motivational intervention",
        "Refer to addiction counselling if available",
        "Treat withdrawal medically if indicated"
      ],
      "refer_if": ["severe dependence", "withdrawal seizures", "dual diagnosis"]
    },
    "ptsd": {
      "icd10": "F43.1",
      "keywords": ["trauma", "flashback", "nightmare", "avoidance", "hypervigilant", "startle"],
      "management_steps": [
        "Validate patient's experience; psychoeducation about trauma reactions",
        "Trauma-focused CBT (if available) or problem management plus",
        "Avoid benzodiazepines for long-term use",
        "Refer to specialist if symptoms persist beyond 3 months"
      ],
      "refer_if": ["severe dissociation", "suicidality", "complex PTSD"]
    }
  },
  "score_cutoffs": {
    "PHQ9": [
      { "min": 0,  "max": 4,  "severity": "none",     "action": "No specific intervention; reassure and monitor" },
      { "min": 5,  "max": 9,  "severity": "mild",     "action": "Watchful waiting; repeat PHQ-9 in 2–4 weeks" },
      { "min": 10, "max": 14, "severity": "moderate", "action": "Psychosocial intervention; consider antidepressant; review in 2 weeks" },
      { "min": 15, "max": 19, "severity": "moderately_severe", "action": "Antidepressant and/or psychotherapy; review in 1 week" },
      { "min": 20, "max": 27, "severity": "severe",   "action": "Immediate medication management; consider specialist referral" }
    ],
    "GAD7": [
      { "min": 0,  "max": 4,  "severity": "none",     "action": "No specific intervention" },
      { "min": 5,  "max": 9,  "severity": "mild",     "action": "Monitor; psychoeducation and self-help strategies" },
      { "min": 10, "max": 14, "severity": "moderate", "action": "Psychosocial intervention; consider medication if impaired" },
      { "min": 15, "max": 21, "severity": "severe",   "action": "Combined medication and therapy; consider referral" }
    ],
    "AUDIT": [
      { "min": 0,  "max": 7,  "severity": "low",      "action": "Low-risk drinking; alcohol education" },
      { "min": 8,  "max": 15, "severity": "hazardous","action": "Brief counselling; advice on safe limits" },
      { "min": 16, "max": 19, "severity": "harmful",  "action": "Refer to addiction counselling" },
      { "min": 20, "max": 40, "severity": "dependent","action": "Refer to specialist addiction services; assess withdrawal risk" }
    ],
    "SRQ": [
      { "min": 0,  "max": 7,  "severity": "none",     "action": "No significant distress detected" },
      { "min": 8,  "max": 20, "severity": "probable_disorder", "action": "Further assessment required; apply PHQ-9 or GAD-7" }
    ]
  }
}
```

### 7b. `services/cdss-service/data/screening_tools/`

Create a subdirectory. Create **PHQ-9** and **GAD-7** JSON files for all 12 SADC language codes:

| Language | Code | PHQ-9 file | GAD-7 file |
|----------|------|-----------|-----------|
| English | `en` | `phq9_en.json` | `gad7_en.json` |
| Swahili | `sw` | `phq9_sw.json` | `gad7_sw.json` |
| Zulu | `zu` | `phq9_zu.json` | `gad7_zu.json` |
| Xhosa | `xh` | `phq9_xh.json` | `gad7_xh.json` |
| Afrikaans | `af` | `phq9_af.json` | `gad7_af.json` |
| Shona | `sn` | `phq9_sn.json` | `gad7_sn.json` |
| Ndebele | `nd` | `phq9_nd.json` | `gad7_nd.json` |
| Setswana | `tn` | `phq9_tn.json` | `gad7_tn.json` |
| Chichewa | `ny` | `phq9_ny.json` | `gad7_ny.json` |
| Portuguese | `pt` | `phq9_pt.json` | `gad7_pt.json` |
| French | `fr` | `phq9_fr.json` | `gad7_fr.json` |
| Lingala | `ln` | `phq9_ln.json` | `gad7_ln.json` |

Each file has the same structure — only the question text is translated:

```json
{
  "tool_id": "PHQ9",
  "language_code": "sw",
  "language_name": "Swahili",
  "title": "Dodoso la Afya ya Mgonjwa – 9",
  "instructions": "Katika wiki 2 zilizopita, umekuwa ukijisikiaje kuhusu matatizo yafuatayo?",
  "response_options": [
    { "value": 0, "label": "Kamwe" },
    { "value": 1, "label": "Siku chache" },
    { "value": 2, "label": "Zaidi ya nusu ya siku" },
    { "value": 3, "label": "Karibu kila siku" }
  ],
  "questions": [
    { "id": 1, "text": "Kupoteza hamu au furaha katika mambo unayoyapenda" },
    { "id": 2, "text": "Kuhisi huzuni, kukata tamaa, au kukosa matumaini" },
    { "id": 3, "text": "Matatizo ya kulala, kukaa macho, au kulala kupita kiasi" },
    { "id": 4, "text": "Kuhisi uchovu au kukosa nguvu" },
    { "id": 5, "text": "Kula kidogo au kupita kiasi" },
    { "id": 6, "text": "Kuhisi vibaya kuhusu nafsi yako — au hisia ya kukosea au kukuwa mzigo kwa familia yako" },
    { "id": 7, "text": "Matatizo ya kuzingatia mambo kama vile kusoma au kutazama televisheni" },
    { "id": 8, "text": "Kusogea au kuongea pole sana kiasi watu wamegundua — au kinyume chake, kukuwa na wasiwasi au kutembea zaidi ya kawaida" },
    { "id": 9, "text": "Mawazo ya kujidhuru au kwamba ungependa kufa" }
  ],
  "scoring": { "min": 0, "max": 27 }
}
```

GAD-7 has 7 questions. Use the same structure with the correct 7 GAD-7 items translated per language.

Use standard WHO-validated translations where they exist (PHQ-9 validated translations exist for Swahili, Zulu, Xhosa, Afrikaans, Portuguese, French). For languages without an official WHO translation (Shona, Ndebele, Setswana, Chichewa, Lingala), produce a faithful back-translatable rendering of the English items.

---

## 8. EHR Service — Referral Pathway (static helper)

The `getReferralPathway` service method returns a static pathway JSON. No DB table needed. Pathway is keyed by tenant country if determinable, otherwise returns a generic SADC default:

```typescript
// In mental-health.service.ts
async getReferralPathway(tenantId: string): Promise<Record<string, any>> {
  return {
    levels: [
      { level: 'CHW', description: 'Community Health Worker — first point of contact; psychoeducation, referral triage' },
      { level: 'Clinic', description: 'Primary care nurse/clinician — screening, medication initiation, brief counselling' },
      { level: 'District', description: 'District hospital — clinical psychologist, complex medication management' },
      { level: 'Specialist', description: 'Psychiatrist — inpatient, treatment-resistant, forensic cases' },
    ],
    emergency_contacts: ['National mental health helpline', 'Emergency services (locally configured)'],
    guideline: 'WHO mhGAP-IG 2.0 / national mental health policy',
  };
}
```

---

## 9. Module Registration

### `services/ehr-service/src/services/tenant.service.ts`
Import and add the two new entities to the DataSource `entities[]` array:
```typescript
import { MentalHealthCarePlan } from '../entities/mental-health-care-plan.entity';
import { MentalHealthFollowup } from '../entities/mental-health-followup.entity';
// Add to entities array: MentalHealthCarePlan, MentalHealthFollowup
```

### `services/ehr-service/src/ehr.module.ts`
No new controller or service files — the new entities only need to be added as providers if necessary for injection. Since `MentalHealthService` uses `TenantService.getTenantDatabase()` pattern (no `@InjectRepository`), no additional module wiring is needed beyond the `tenant.service.ts` DataSource registration.

---

## 10. Frontend

### 10a. Extend `ehr-frontend/src/components/MentalHealthDashboard.tsx`

Add three new tabs/panels to the existing component. Do not rewrite or replace the existing component — add to it:

1. **mhGAP Assess tab**: free-text presenting complaint input → calls `POST /cdss/mental-health/mhgap-assess` → shows condition, management steps, referral recommendation
2. **Care Plans tab**: create care plan form (diagnosis, care level, CHW assigned, goals, interventions, review date) → calls `POST /mental-health/care-plans`; lists existing care plans with `GET /mental-health/care-plans/:patientId`
3. **Community Follow-ups tab**: record follow-up form (symptom change, medication adherent, safety concern, next date) → calls `POST /mental-health/followups`; lists history with `GET /mental-health/followups/:patientId`

### 10b. Multilingual screening in `MentalHealthDashboard.tsx`

Update the existing screening form to:
- Add a **language selector** (dropdown populated from `GET /cdss/mental-health/screening-tools` response)
- Render PHQ-9 / GAD-7 questions dynamically from the API response — not hardcoded — so language switch re-renders the correct translated questions
- Pass `language_code` in the POST body when recording a screening
- Use `POST /cdss/mental-health/screening-interpret` instead of (or in addition to) the existing `/cdss/screen` for score interpretation with language context

### 10c. Extend `ehr-frontend/src/pages/NurseDashboard.tsx`

Add a **Mental Health / mhGAP** quick-access section to the existing nurse dashboard:
- Screening tool selector + language selector
- Score entry → severity badge with action
- One-click create care plan → opens care plan form in `MentalHealthDashboard`
- Safety plan display when suicide/self-harm risk detected (from `POST /cdss/mental-health/safety-plan`)

No new page needed — this is embedded in the existing nurse dashboard.

---

## 11. Tests

### `services/ehr-service/src/services/mental-health.service.spec.ts`
Add tests for the new methods: `createCarePlan`, `getCarePlans`, `recordFollowup`, `getFollowups`. Follow the existing mock pattern in the repo (mock `TenantService.getTenantDatabase`, mock repo methods).

### `services/cdss-service/` (Python)
The existing `py_compile` check is sufficient — no new pytest files required.

---

## 12. Validation Checklist (run before marking done)

```bash
cd services/tenant-service && npx tsc --noEmit
cd services/ehr-service     && npx tsc --noEmit
cd ehr-frontend             && npx tsc --noEmit
cd services/cdss-service    && python3 -m py_compile main.py
cd services/ehr-service     && npx jest src/services/mental-health.service.spec.ts --runInBand
git diff --check
```

Also verify:
- `mental_health_care_plans` and `mental_health_followups` tables exist in at least one tenant DB after running provisioning
- `language_code` and `referred` columns added to `mental_health_screenings`
- `data/mhgap_rules.json` loads and the `POST /cdss/mental-health/mhgap-assess` endpoint returns a valid response for `{ "presenting_complaint": "sad and hopeless" }`
- All 24 screening tool JSON files exist under `data/screening_tools/`

---

## 13. Conventions (same as all previous sprints)

- Tenant header: `X-Tenant-ID` (current convention — use this, not `X-Tenant-Subdomain`)
- EHR API calls from frontend: `ehrAxios` from `src/services/api.ts`
- CDSS API calls from frontend: `cdssAxios` from `src/services/api.ts`
- No `import.meta` / `VITE_*` in frontend — this is CRA/craco (webpack); use `process.env.REACT_APP_*`
- No hardcoded production URLs as env var fallbacks — use empty string + guard
- All new EHR controller routes behind `@UseGuards(JwtAuthGuard)`
- Use `req.tenantId!` from `RequestWithTenant` for tenant extraction in new routes

---

## 14. Done When

- PHQ-9 renders in at least Swahili, Zulu, Shona, and Portuguese from real JSON files (not hardcoded JSX)
- mhGAP assessment returns rule-based management steps for depression, anxiety, and psychosis inputs
- Screening score + severity + `language_code` persists to `mental_health_screenings`
- Community care plan created and linked to CHW for follow-up
- Follow-up with safety concern flag records and retrieves correctly
- Safety plan template displayed for high/imminent risk
- Lint, TypeScript, build, and tests pass
