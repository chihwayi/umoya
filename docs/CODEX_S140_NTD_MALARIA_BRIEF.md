# Codex Sprint Brief — S140: NTD Programs + Malaria Clinical Depth

**Date:** 2026-04-11
**Branch:** main
**Reviewer:** Claude (signs off before you move to S141)

---

## 1. Goal

Extend the EHR with:
- **NTD (Neglected Tropical Disease)** clinical assessments and Mass Drug Administration (MDA) campaign tracking
- **Malaria clinical depth**: structured RDT capture, WHO severity criteria checklist, G6PD warning before primaquine, weight-based ACT dose recommendation, and IPTp tracking for pregnant patients

---

## 2. What Already Exists (Do NOT Duplicate)

The CDSS service already has these endpoints — **call them, do not recreate them**:
- `POST /malaria/severity` — WHO 2015 severity scoring (maps to S140's `/cdss/malaria/severity`)
- `POST /malaria/treatment` — ACT regimen recommendation

The EHR service already has a full malaria case management module (`/malaria` routes) and `MalariaDashboard.tsx` component.

**S140 adds on top of these:**
1. Three new DB tables (`ntd_assessments`, `mda_campaigns`, `malaria_episodes`)
2. Three new CDSS endpoints (`/malaria/act-dose`, `/malaria/g6pd-check`, `/malaria/iptp-due`)
3. New EHR endpoints for NTD and malaria episodes
4. Extend `MalariaDashboard.tsx` with the new S140 features (RDT structured form, G6PD banner, ACT dose panel, IPTp tab)
5. New `NtdDashboard.tsx` page

---

## 3. Non-Negotiable Rules

### 3.1 — No hardcoded credentials or URLs
- No real passwords, API keys, or production URLs in source code.
- Spec files must use `Object.assign(process.env, TEST_ENV)` with `?? 'ci-stub'` fallbacks — **never** `process.env.SOME_PASSWORD = 'literal'`.

### 3.2 — No mock data
- Zero `setTimeout(() => resolve(fakeData))`.
- Zero hardcoded fake patient/dose arrays.
- All frontend calls via `ehrAxios` (EHR endpoints) or `cdssAxios` (CDSS endpoints) from `src/services/api.ts`.

### 3.3 — Dual entity registration
Every new entity in BOTH:
1. `services/ehr-service/src/services/tenant.service.ts` — `entities: [...]` array in `getTenantDatabase()`
2. `services/ehr-service/src/ehr.module.ts` — `controllers: [...]` and `providers: [...]`

### 3.4 — DB changes via DatabaseProvisioningService only
Never execute raw DDL directly. Follow the 4-step pattern in section 4.

### 3.5 — TypeScript quality gate (all three must pass zero errors)
```bash
cd services/ehr-service && npx tsc --noEmit
cd services/tenant-service && npx tsc --noEmit
cd ehr-frontend && npx tsc --noEmit
```

### 3.6 — Python quality gate
```bash
cd services/cdss-service && python -m py_compile main.py
```

---

## 4. Database Provisioning

### Step A — Create provisioning file

**File:** `services/tenant-service/src/generated/tenant-ntd-malaria.statements.ts`

```typescript
export const TENANT_NTD_MALARIA_BUNDLE_VERSION = '2026.04.11.13';

export const TENANT_NTD_MALARIA_STATEMENTS = (): string[] => [
  `CREATE TABLE IF NOT EXISTS ntd_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    disease_type VARCHAR(50) NOT NULL,
    assessment_date DATE NOT NULL,
    assessed_by UUID,
    disease_stage VARCHAR(50),
    disability_grade INTEGER,
    mda_eligible BOOLEAN,
    treatment_given VARCHAR(100),
    dose_mg NUMERIC(8,2),
    lot_number VARCHAR(50),
    follow_up_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ntd_assessments_patient ON ntd_assessments(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ntd_assessments_disease ON ntd_assessments(disease_type)`,

  `CREATE TABLE IF NOT EXISTS mda_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name VARCHAR(100) NOT NULL,
    disease_type VARCHAR(50) NOT NULL,
    drug_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    target_population INTEGER,
    treated_count INTEGER DEFAULT 0,
    coverage_area TEXT,
    dhis2_dataset_uid VARCHAR(50),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mda_campaigns_disease ON mda_campaigns(disease_type)`,
  `CREATE INDEX IF NOT EXISTS idx_mda_campaigns_dates ON mda_campaigns(start_date, end_date)`,

  `CREATE TABLE IF NOT EXISTS malaria_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    episode_date DATE NOT NULL,
    rdt_result VARCHAR(20),
    species_confirmed VARCHAR(30),
    parasite_density INTEGER,
    severity_criteria TEXT[],
    severity_grade VARCHAR(20),
    g6pd_tested BOOLEAN DEFAULT false,
    g6pd_result VARCHAR(20),
    primaquine_given BOOLEAN DEFAULT false,
    treatment_regimen VARCHAR(100),
    weight_kg NUMERIC(5,2),
    act_dose_mg NUMERIC(8,2),
    iptp_dose_number INTEGER,
    iptp_sp_given BOOLEAN DEFAULT false,
    admitted BOOLEAN DEFAULT false,
    outcome VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_malaria_episodes_patient ON malaria_episodes(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_malaria_episodes_date ON malaria_episodes(episode_date)`,
  `CREATE INDEX IF NOT EXISTS idx_malaria_episodes_severity ON malaria_episodes(severity_grade)`,
];
```

### Step B — Register bundle

In `services/tenant-service/src/services/database-provisioning.service.ts`, add to `getProvisioningBundles()`:

```typescript
import { TENANT_NTD_MALARIA_BUNDLE_VERSION, TENANT_NTD_MALARIA_STATEMENTS } from '../generated/tenant-ntd-malaria.statements';

{
  id: 'sprint140_ntd_malaria',
  label: 'NTD Programs + Malaria Clinical Depth',
  version: TENANT_NTD_MALARIA_BUNDLE_VERSION,
  description: 'S140 — NTD assessments, MDA campaigns, structured malaria episodes',
  statements: TENANT_NTD_MALARIA_STATEMENTS,
},
```

### Step C — Run tenant repair

```bash
DB_HOST=127.0.0.1 DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=postgres \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/medicore \
npm run provision:all-tenants -w @medicore/tenant-service
```

### Step D — Confirm tables exist

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('ntd_assessments', 'mda_campaigns', 'malaria_episodes');
-- Must return 3 rows in each tenant DB
```

---

## 5. New Entities

### `ntd-assessment.entity.ts`
```typescript
@Entity('ntd_assessments')
export class NtdAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'disease_type' }) diseaseType: string;
  @Column({ name: 'assessment_date', type: 'date' }) assessmentDate: string;
  @Column({ name: 'assessed_by', type: 'uuid', nullable: true }) assessedBy: string | null;
  @Column({ name: 'disease_stage', nullable: true }) diseaseStage: string | null;
  @Column({ name: 'disability_grade', type: 'int', nullable: true }) disabilityGrade: number | null;
  @Column({ name: 'mda_eligible', type: 'boolean', nullable: true }) mdaEligible: boolean | null;
  @Column({ name: 'treatment_given', nullable: true }) treatmentGiven: string | null;
  @Column({ name: 'dose_mg', type: 'numeric', precision: 8, scale: 2, nullable: true }) doseMg: number | null;
  @Column({ name: 'lot_number', nullable: true }) lotNumber: string | null;
  @Column({ name: 'follow_up_date', type: 'date', nullable: true }) followUpDate: string | null;
  @Column({ name: 'notes', type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

### `mda-campaign.entity.ts`
```typescript
@Entity('mda_campaigns')
export class MdaCampaign {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'campaign_name' }) campaignName: string;
  @Column({ name: 'disease_type' }) diseaseType: string;
  @Column({ name: 'drug_name' }) drugName: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'end_date', type: 'date' }) endDate: string;
  @Column({ name: 'target_population', type: 'int', nullable: true }) targetPopulation: number | null;
  @Column({ name: 'treated_count', type: 'int', default: 0 }) treatedCount: number;
  @Column({ name: 'coverage_area', type: 'text', nullable: true }) coverageArea: string | null;
  @Column({ name: 'dhis2_dataset_uid', nullable: true }) dhis2DatasetUid: string | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

### `malaria-episode.entity.ts`
```typescript
@Entity('malaria_episodes')
export class MalariaEpisode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'episode_date', type: 'date' }) episodeDate: string;
  @Column({ name: 'rdt_result', nullable: true }) rdtResult: string | null;
  @Column({ name: 'species_confirmed', nullable: true }) speciesConfirmed: string | null;
  @Column({ name: 'parasite_density', type: 'int', nullable: true }) parasiteDensity: number | null;
  @Column({ name: 'severity_criteria', type: 'text', array: true, nullable: true }) severityCriteria: string[] | null;
  @Column({ name: 'severity_grade', nullable: true }) severityGrade: string | null;
  @Column({ name: 'g6pd_tested', default: false }) g6pdTested: boolean;
  @Column({ name: 'g6pd_result', nullable: true }) g6pdResult: string | null;
  @Column({ name: 'primaquine_given', default: false }) primaquineGiven: boolean;
  @Column({ name: 'treatment_regimen', nullable: true }) treatmentRegimen: string | null;
  @Column({ name: 'weight_kg', type: 'numeric', precision: 5, scale: 2, nullable: true }) weightKg: number | null;
  @Column({ name: 'act_dose_mg', type: 'numeric', precision: 8, scale: 2, nullable: true }) actDoseMg: number | null;
  @Column({ name: 'iptp_dose_number', type: 'int', nullable: true }) iptpDoseNumber: number | null;
  @Column({ name: 'iptp_sp_given', default: false }) iptpSpGiven: boolean;
  @Column({ name: 'admitted', default: false }) admitted: boolean;
  @Column({ name: 'outcome', nullable: true }) outcome: string | null;
  @Column({ name: 'notes', type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

---

## 6. EHR Backend — NtdService + NtdController

**File:** `services/ehr-service/src/services/ntd.service.ts`

Methods:
```typescript
async recordAssessment(tenantId: string, userId: string, body: any): Promise<NtdAssessment>
async getPatientAssessments(tenantId: string, patientId: string): Promise<NtdAssessment[]>
async createCampaign(tenantId: string, userId: string, body: any): Promise<MdaCampaign>
async recordTreatedCount(tenantId: string, campaignId: string, count: number): Promise<MdaCampaign>
async listCampaigns(tenantId: string): Promise<MdaCampaign[]>
```

**File:** `services/ehr-service/src/controllers/ntd.controller.ts`

```
POST   /ntd/assess                         — Record NTD assessment
GET    /ntd/assessments/:patientId         — NTD history for patient
POST   /ntd/mda/campaigns                  — Create MDA campaign
GET    /ntd/mda/campaigns                  — List MDA campaigns
PATCH  /ntd/mda/campaigns/:id/record       — Record treated count for a session
```

All endpoints JWT-guarded via `@UseGuards(JwtAuthGuard)` at class level.

---

## 7. EHR Backend — MalariaEpisodeService + MalariaEpisodeController

**File:** `services/ehr-service/src/services/malaria-episode.service.ts`

Methods:
```typescript
async recordEpisode(tenantId: string, body: any): Promise<MalariaEpisode>
async getPatientEpisodes(tenantId: string, patientId: string): Promise<MalariaEpisode[]>
async recordIptp(tenantId: string, body: any): Promise<MalariaEpisode>
async getIptpHistory(tenantId: string, patientId: string): Promise<MalariaEpisode[]>
```

**File:** `services/ehr-service/src/controllers/malaria-episode.controller.ts`

```
POST   /malaria/episodes                   — Record malaria episode (RDT + severity + treatment)
GET    /malaria/episodes/:patientId        — Malaria episode history for patient
POST   /malaria/iptp/record                — Record IPTp SP dose for pregnant patient
GET    /malaria/iptp/:patientId            — IPTp dose history
```

All endpoints JWT-guarded. Extract `tenantId` from `req.tenantId`.

---

## 8. Entity Registration

### `services/ehr-service/src/services/tenant.service.ts`
Append to `entities: [...]` in `getTenantDatabase()`:
```typescript
NtdAssessment,
MdaCampaign,
MalariaEpisode,
```

### `services/ehr-service/src/ehr.module.ts`
Add to `controllers: [...]`:
```typescript
NtdController,
MalariaEpisodeController,
```
Add to `providers: [...]`:
```typescript
NtdService,
MalariaEpisodeService,
```

---

## 9. CDSS Service — Three New Endpoints

Add to `services/cdss-service/main.py`. **Do not create a new file** — add directly to `main.py` alongside the existing `/malaria/severity` and `/malaria/treatment` endpoints.

### 9.1 — ACT weight-based dosing

Create `services/cdss-service/data/act_dosing.json` with the WHO Artemether-Lumefantrine weight-band table:

```json
{
  "AL": [
    { "min_kg": 5,  "max_kg": 14.9, "tablets_per_dose": 1, "dose_mg": 20,  "label": "1 tablet (20/120 mg) × 6 doses over 3 days" },
    { "min_kg": 15, "max_kg": 24.9, "tablets_per_dose": 2, "dose_mg": 40,  "label": "2 tablets × 6 doses over 3 days" },
    { "min_kg": 25, "max_kg": 34.9, "tablets_per_dose": 3, "dose_mg": 60,  "label": "3 tablets × 6 doses over 3 days" },
    { "min_kg": 35, "max_kg": 999,  "tablets_per_dose": 4, "dose_mg": 80,  "label": "4 tablets × 6 doses over 3 days" }
  ]
}
```

New CDSS endpoint:
```python
class ActDoseRequest(BaseModel):
    weight_kg: float
    species: str = "falciparum"
    regimen: str = "AL"

@app.post("/malaria/act-dose")
async def malaria_act_dose(req: ActDoseRequest):
    # Load act_dosing.json, find matching weight band, return tablets + mg
    ...
    return {
        "regimen": req.regimen,
        "weight_kg": req.weight_kg,
        "tablets_per_dose": band["tablets_per_dose"],
        "dose_mg": band["dose_mg"],
        "label": band["label"],
        "warning": None  # or "Weight below 5 kg — consult paediatrician"
    }
```

### 9.2 — G6PD check before primaquine

```python
class G6pdCheckRequest(BaseModel):
    species: str          # vivax | ovale | falciparum | ...
    intend_primaquine: bool
    g6pd_tested: bool
    g6pd_result: Optional[str] = None   # normal | deficient | intermediate

@app.post("/malaria/g6pd-check")
async def malaria_g6pd_check(req: G6pdCheckRequest):
    # Returns warning if primaquine intended but G6PD not tested / deficient
    ...
    return {
        "safe_to_give": bool,
        "warning": str | None,
        "recommendation": str
    }
```

Logic:
- If `intend_primaquine=True` and `g6pd_tested=False` → `safe_to_give=False`, `warning="G6PD status unknown — test before prescribing primaquine"`
- If `g6pd_result="deficient"` → `safe_to_give=False`, `warning="G6PD deficiency — avoid standard primaquine; use weekly low-dose protocol (supervised)"`
- If `g6pd_result="intermediate"` → `safe_to_give=False`, `warning="Intermediate G6PD — seek specialist guidance before primaquine"`
- Otherwise → `safe_to_give=True`, `warning=None`

### 9.3 — IPTp due date

```python
class IptpDueRequest(BaseModel):
    gestational_age_weeks: int
    prior_dose_count: int
    last_dose_date: Optional[str] = None   # ISO date string

@app.post("/malaria/iptp-due")
async def malaria_iptp_due(req: IptpDueRequest):
    # WHO recommends SP at each ANC visit from 13 weeks, at least 4 weeks apart, up to 3 doses
    ...
    return {
        "next_dose_number": int,
        "due_now": bool,
        "next_due_date": str | None,   # ISO date
        "message": str
    }
```

Logic (WHO 2015 IPTp guidelines):
- Start from 13 weeks gestation, minimum 4 weeks between doses
- Maximum 3 doses recommended (some guidelines allow more — flag after dose 3)
- If `gestational_age_weeks < 13`: not yet due
- If `prior_dose_count >= 3`: maximum reached, recommend continued monitoring

---

## 10. Frontend — MalariaDashboard Extensions

**File:** `ehr-frontend/src/components/MalariaDashboard.tsx`

The existing component uses `cdssApi` (which routes through `ehrAxios` internally — **do not change the import**). Add these features to the existing component:

### New tab: "Episodes" (or extend existing structure)
Add a tab or sub-section for structured malaria episodes using the new `/malaria/episodes` EHR endpoint:
- RDT result dropdown: `positive_pf | positive_pv | positive_mixed | negative`
- Severity criteria checklist (checkboxes, WHO criteria, populated from real CDSS response via `/malaria/severity`)
- **G6PD warning banner**: shown automatically when `primaquine_given=true` — calls `/malaria/g6pd-check` on the CDSS and displays red warning if `safe_to_give=false`
- **ACT dose panel**: show recommended dose by calling `/malaria/act-dose` when `weight_kg` is entered
- IPTp section (visible when `iptp_sp_given=true`): shows dose number and calls `/malaria/iptp-due` for due-date guidance

### API helpers to add to `api.ts` (cdssApi section):
```typescript
getActDose: async (data: { weight_kg: number; species?: string }) => {
  const res = await cdssAxios.post('/malaria/act-dose', data);
  return res.data;
},
checkG6pd: async (data: { species: string; intend_primaquine: boolean; g6pd_tested: boolean; g6pd_result?: string }) => {
  const res = await cdssAxios.post('/malaria/g6pd-check', data);
  return res.data;
},
getIptpDue: async (data: { gestational_age_weeks: number; prior_dose_count: number; last_dose_date?: string }) => {
  const res = await cdssAxios.post('/malaria/iptp-due', data);
  return res.data;
},
```

---

## 11. Frontend — NtdDashboard

**File:** `ehr-frontend/src/pages/NtdDashboard.tsx`

### Props
```typescript
interface NtdDashboardProps {
  tenantSlug: string;
  token?: string;
}
```

### Two tabs:
1. **Patient Assessments** — form to record NTD assessment; patient ID input; history table per patient
2. **MDA Campaigns** — create campaign form; campaigns table with treated_count tracker; "Record Session" button to PATCH treated count

### Disease type options (dropdown):
`schistosomiasis | filariasis | trachoma | leprosy | HAT (sleeping sickness) | onchocerciasis`

### All API calls via `ehrAxios`:
```typescript
ehrAxios.post(`/ehr/${tenantSlug}/ntd/assess`, body)
ehrAxios.get(`/ehr/${tenantSlug}/ntd/assessments/${patientId}`)
ehrAxios.post(`/ehr/${tenantSlug}/ntd/mda/campaigns`, body)
ehrAxios.get(`/ehr/${tenantSlug}/ntd/mda/campaigns`)
ehrAxios.patch(`/ehr/${tenantSlug}/ntd/mda/campaigns/${id}/record`, { count })
```

### Theme:
```
bg-slate-950 / bg-slate-900/80 / border-slate-800 / text-slate-300
```

### Route in `App.tsx`:
```typescript
const NtdDashboard = lazy(() => import('./pages/NtdDashboard'));
// Add route:
<Route
  path="/ehr/:tenantSlug/ntd"
  element={
    <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
      <TenantScopedNtdDashboard />
    </RoleProtectedRoute>
  }
/>
```

---

## 12. Spec Files

### `services/ehr-service/src/services/ntd.service.spec.ts`
Cover:
1. `recordAssessment` — NTD record created with correct disease type
2. `createCampaign` — MDA campaign stored
3. `recordTreatedCount` — treated_count incremented correctly

### `services/ehr-service/src/services/malaria-episode.service.spec.ts`
Cover:
1. `recordEpisode` — episode with RDT result, severity grade, ACT dose stored
2. `recordIptp` — IPTp record stored with dose number
3. `getIptpHistory` — returns episodes filtered to those with `iptp_sp_given=true`

**Credential pattern in both specs:**
```typescript
// No env vars needed for these — no external HTTP calls in EHR service
// Just mock the DB repository as usual
```

---

## 13. Done-When Checklist

- [ ] `tenant-ntd-malaria.statements.ts` created and registered
- [ ] Tenant repair run; all 3 tables exist in tenant DBs with correct indexes
- [ ] 3 new entities created and dual-registered
- [ ] `NtdService` + `NtdController` — 5 endpoints
- [ ] `MalariaEpisodeService` + `MalariaEpisodeController` — 4 endpoints
- [ ] CDSS `main.py` has 3 new endpoints (`/malaria/act-dose`, `/malaria/g6pd-check`, `/malaria/iptp-due`)
- [ ] `act_dosing.json` created in `services/cdss-service/data/`
- [ ] `MalariaDashboard.tsx` extended with G6PD banner, ACT dose panel, IPTp section
- [ ] 3 new `cdssApi` helpers added to `api.ts`
- [ ] `NtdDashboard.tsx` — 2 tabs, `ehrAxios` only, no mocks
- [ ] Route added to `App.tsx`
- [ ] Focused specs for NTD and MalariaEpisode services
- [ ] `npx tsc --noEmit` passes in all 3 packages
- [ ] `python -m py_compile main.py` passes
- [ ] `git diff --check` passes
- [ ] No hardcoded credentials or production URLs anywhere in new files

---

## 14. Commit Message

```
feat: complete sprint 140 NTD programs and malaria clinical depth

Add NTD assessment + MDA campaign tracking, structured malaria episode
recording (RDT, severity, ACT dose, IPTp), and three CDSS endpoints for
weight-based ACT dosing, G6PD primaquine safety check, and IPTp due-date
calculation per WHO 2015 guidelines.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
