# Sprint 156 — Traditional Birth Attendant Module & Rural Birth Registration

**Sprint**: S156  
**Module**: TBA Supervision, Home Birth Records, Rural Birth Notification to CRVS  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint156_tba_birth_registration`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

-----

## 1. Clinical Rationale

In Africa, 40-60% of births in rural areas are attended by Traditional Birth Attendants (TBAs) and never reach a facility. These births go unregistered with CRVS, creating invisible neonatal deaths and maternal complications. MediCore has a maternity module and CRVS integration (S135) but no TBA linkage, no home birth record, and no rural birth notification workflow.

| Gap | Impact |
|---|---|
| No TBA register | Cannot track TBA activity, skill level, or referrals |
| No home birth record | ~40% of African births invisible in MediCore |
| No CRVS auto-notification | Rural births unregistered → children without documents → school/health barriers |
| No TBA supervision scoring | No risk stratification to prioritise CHW visits to high-risk TBAs |

### What already exists (do NOT recreate)

- `MaternityService` / maternal mortality module from S147
- CRVS integration from S135 (`crvs.controller.ts`, `crvs.service.ts`)
- CHW module from S133 (`chw.controller.ts`, `chw-visit.entity.ts`)
- `CdssService`, `ehr.module.ts`, `tenant.service.ts`

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-tba-birth-registration.statements.ts`**

```typescript
export const TENANT_TBA_BIRTH_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_TBA_BIRTH_STATEMENTS: string[] = [

  // ── TBA Register ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tba_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- TBA identity
    tba_code TEXT NOT NULL UNIQUE,       -- district-assigned code (e.g. 'MAS-TBA-0042')
    full_name TEXT NOT NULL,
    sex TEXT NOT NULL DEFAULT 'female',
    date_of_birth DATE,
    phone TEXT,
    village TEXT NOT NULL,
    ward TEXT,
    district TEXT NOT NULL,
    -- Registration
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    registration_status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'inactive' | 'deceased'
    -- Training
    trained BOOLEAN NOT NULL DEFAULT false,
    training_type TEXT,                  -- 'basic_TBA_training' | 'skilled_birth_attendant' | 'none'
    last_training_date DATE,
    training_institution TEXT,
    -- Supervision
    assigned_chw_id UUID,                -- CHW responsible for TBA supervision
    assigned_facility_id TEXT,           -- nearest facility for referrals
    supervising_midwife_id UUID,
    last_supervision_date DATE,
    supervision_score INTEGER,           -- 0-100, CDSS-computed
    supervision_risk TEXT,               -- 'low' | 'medium' | 'high' (CDSS)
    -- Activity stats (maintained by triggers/service)
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    maternal_deaths INTEGER NOT NULL DEFAULT 0,
    neonatal_deaths INTEGER NOT NULL DEFAULT 0,
    referrals_made INTEGER NOT NULL DEFAULT 0,
    -- Audit
    registered_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_tba_register_district ON tba_register(district)`,
  `CREATE INDEX IF NOT EXISTS idx_tba_register_status ON tba_register(registration_status)`,

  // ── Home Birth Records ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS home_birth_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Attendant
    tba_id UUID REFERENCES tba_register(id),
    attended_by_type TEXT NOT NULL,      -- 'tba' | 'relative' | 'alone' | 'other'
    attended_by_name TEXT,
    -- Mother
    mother_patient_id UUID,              -- if registered in MediCore
    mother_name TEXT NOT NULL,
    mother_phone TEXT,
    mother_village TEXT NOT NULL,
    mother_age_years INTEGER,
    mother_parity INTEGER,               -- number of previous deliveries
    antenatal_visits INTEGER NOT NULL DEFAULT 0,
    last_anc_date DATE,
    -- Birth
    birth_date DATE NOT NULL,
    birth_time TIME,
    birth_place_description TEXT,        -- 'home' | 'under_tree' | 'community_hall'
    gestational_age_weeks INTEGER,
    -- Baby
    baby_alive BOOLEAN NOT NULL DEFAULT true,
    baby_sex TEXT,                       -- 'male' | 'female' | 'unknown'
    birth_weight_kg DECIMAL(4,2),
    apgar_score INTEGER,
    birth_outcome TEXT NOT NULL,         -- 'live_birth' | 'fresh_stillbirth' | 'macerated_stillbirth'
    multiple_birth BOOLEAN NOT NULL DEFAULT false,
    multiple_birth_count INTEGER,
    -- Maternal status
    maternal_alive BOOLEAN NOT NULL DEFAULT true,
    maternal_complications JSONB DEFAULT '[]',  -- ['PPH','eclampsia','prolonged_labour','sepsis','tear']
    maternal_complication_outcome TEXT,
    -- Immediate care
    cord_cut_with TEXT,                  -- 'sterile_blade' | 'unsterile_blade' | 'string' | 'unknown'
    misoprostol_given BOOLEAN NOT NULL DEFAULT false,  -- for PPH prevention
    vitamin_k_given BOOLEAN NOT NULL DEFAULT false,
    eye_care_given BOOLEAN NOT NULL DEFAULT false,     -- tetracycline/chloramphenicol drops
    breastfeeding_initiated BOOLEAN,
    -- Referral
    referred BOOLEAN NOT NULL DEFAULT false,
    referral_reason TEXT,
    referral_facility TEXT,
    referral_outcome TEXT,               -- 'accepted' | 'arrived' | 'died_in_transit' | 'refused'
    -- CRVS notification
    crvs_notified BOOLEAN NOT NULL DEFAULT false,
    crvs_notification_date DATE,
    birth_certificate_number TEXT,
    -- CDSS risk assessment
    cdss_risk_level TEXT,                -- 'low' | 'moderate' | 'high'
    cdss_recommendation TEXT,
    cdss_confidence DECIMAL(4,3),
    -- Recording
    recorded_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_home_births_tba ON home_birth_records(tba_id)`,
  `CREATE INDEX IF NOT EXISTS idx_home_births_date ON home_birth_records(birth_date)`,
  `CREATE INDEX IF NOT EXISTS idx_home_births_mother ON home_birth_records(mother_patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_home_births_crvs ON home_birth_records(crvs_notified)`,

];
```

### 2b. Register Bundle

```typescript
import {
  TENANT_TBA_BIRTH_BUNDLE_VERSION,
  TENANT_TBA_BIRTH_STATEMENTS,
} from './generated/tenant-tba-birth-registration.statements';

{
  id: 'sprint156_tba_birth_registration',
  label: 'Sprint 156 — TBA Module + Rural Birth Registration',
  version: TENANT_TBA_BIRTH_BUNDLE_VERSION,
  description: 'Creates tba_register, home_birth_records tables',
  statements: TENANT_TBA_BIRTH_STATEMENTS,
},
```

---

## 3. TypeORM Entities

**File: `services/ehr-service/src/tba/entities/tba-register.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { HomeBirthRecord } from './home-birth-record.entity';

@Entity({ name: 'tba_register' })
export class TbaRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tba_code', unique: true }) tbaCode: string;
  @Column({ name: 'full_name' }) fullName: string;
  @Column({ name: 'sex', default: 'female' }) sex: string;
  @Column({ name: 'date_of_birth', type: 'date', nullable: true }) dateOfBirth: string;
  @Column({ name: 'phone', nullable: true }) phone: string;
  @Column({ name: 'village' }) village: string;
  @Column({ name: 'ward', nullable: true }) ward: string;
  @Column({ name: 'district' }) district: string;
  @Column({ name: 'registration_date', type: 'date' }) registrationDate: string;
  @Column({ name: 'registration_status', default: 'active' }) registrationStatus: string;
  @Column({ name: 'trained', default: false }) trained: boolean;
  @Column({ name: 'training_type', nullable: true }) trainingType: string;
  @Column({ name: 'last_training_date', type: 'date', nullable: true }) lastTrainingDate: string;
  @Column({ name: 'training_institution', nullable: true }) trainingInstitution: string;
  @Column({ name: 'assigned_chw_id', nullable: true }) assignedChwId: string;
  @Column({ name: 'assigned_facility_id', nullable: true }) assignedFacilityId: string;
  @Column({ name: 'supervising_midwife_id', nullable: true }) supervisingMidwifeId: string;
  @Column({ name: 'last_supervision_date', type: 'date', nullable: true }) lastSupervisionDate: string;
  @Column({ name: 'supervision_score', nullable: true }) supervisionScore: number;
  @Column({ name: 'supervision_risk', nullable: true }) supervisionRisk: string;
  @Column({ name: 'total_deliveries', default: 0 }) totalDeliveries: number;
  @Column({ name: 'maternal_deaths', default: 0 }) maternalDeaths: number;
  @Column({ name: 'neonatal_deaths', default: 0 }) neonatalDeaths: number;
  @Column({ name: 'referrals_made', default: 0 }) referralsMade: number;
  @Column({ name: 'registered_by', nullable: true }) registeredBy: string;
  @OneToMany(() => HomeBirthRecord, b => b.tba) births: HomeBirthRecord[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

**File: `services/ehr-service/src/tba/entities/home-birth-record.entity.ts`** — mirror all `home_birth_records` columns with proper TypeORM decorators; `@ManyToOne(() => TbaRegister, t => t.births)` on `tbaId`.

Register in `tenant.service.ts`:
```typescript
import { TbaRegister } from '../ehr/tba/entities/tba-register.entity';
import { HomeBirthRecord } from '../ehr/tba/entities/home-birth-record.entity';
// Add: TbaRegister, HomeBirthRecord
```

---

## 4. CDSS Python Endpoints

```python
class TbaRiskRequest(BaseModel):
    tba_code: str
    total_deliveries: int
    maternal_deaths: int
    neonatal_deaths: int
    referrals_made: int
    trained: bool
    training_type: Optional[str]
    last_supervision_months_ago: int
    misoprostol_use_rate: float          # 0-1 (proportion of deliveries where misoprostol given)
    cord_safe_practice_rate: float       # proportion using sterile blade

class TbaRiskResponse(BaseModel):
    supervision_score: int               # 0-100
    supervision_risk: str                # 'low' | 'medium' | 'high'
    risk_factors: List[str]
    priority_for_supervision: str        # 'urgent' | 'soon' | 'routine'
    recommended_training: List[str]
    confidence: float

class HomeBirthRiskRequest(BaseModel):
    mother_age_years: int
    parity: int
    antenatal_visits: int
    gestational_age_weeks: Optional[int]
    previous_complications: List[str]    # ['PPH','eclampsia','previous_cs']
    attended_by_trained_tba: bool
    distance_to_facility_km: float
    maternal_complications: List[str]    # complications during this birth

class HomeBirthRiskResponse(BaseModel):
    immediate_referral_required: bool
    referral_reason: str
    neonatal_risk: str                   # 'low' | 'moderate' | 'high'
    maternal_risk: str
    immediate_actions: List[str]         # for TBA to take before/during referral
    crvs_notification_required: bool
    confidence: float

@app.post("/cdss/tba/supervision-risk")
async def tba_supervision_risk(req: TbaRiskRequest):
    prompt = f"""
    You are a maternal health programme officer using WHO Safe Motherhood TBA guidelines and
    UNFPA TBA supervision frameworks.

    TBA profile:
    - Total deliveries: {req.total_deliveries}
    - Maternal deaths: {req.maternal_deaths} (MMR = {req.maternal_deaths/max(req.total_deliveries,1)*100000:.0f}/100k)
    - Neonatal deaths: {req.neonatal_deaths}
    - Referrals made: {req.referrals_made} ({req.referrals_made/max(req.total_deliveries,1)*100:.0f}% referral rate)
    - Trained: {req.trained} ({req.training_type})
    - Last supervision: {req.last_supervision_months_ago} months ago
    - Misoprostol use: {req.misoprostol_use_rate*100:.0f}%
    - Safe cord practice: {req.cord_safe_practice_rate*100:.0f}%

    Score 0-100 (higher = better practice). Risk factors that lower score:
    - Any maternal death → -30
    - Untrained → -20
    - Not supervised in >6 months → -15
    - Misoprostol use <50% → -15
    - Unsafe cord practice >20% → -10

    Return JSON: supervision_score, supervision_risk, risk_factors (list), priority_for_supervision,
    recommended_training (list), confidence (0-1).
    """
    result = await call_governed_json(prompt, surface="tba_supervision_risk", phi_present=False)
    return result

@app.post("/cdss/tba/home-birth-risk")
async def home_birth_risk(req: HomeBirthRiskRequest):
    prompt = f"""
    You are a midwife using WHO Intrapartum Care guidelines and UNFPA safe delivery guidelines.

    Home birth:
    - Mother: age={req.mother_age_years}, parity={req.parity}, ANC visits={req.antenatal_visits}
    - GA: {req.gestational_age_weeks} weeks
    - Past complications: {req.previous_complications}
    - Attended by trained TBA: {req.attended_by_trained_tba}
    - Distance to facility: {req.distance_to_facility_km} km
    - Current complications: {req.maternal_complications}

    Determine immediate referral need (PPH, eclampsia, retained placenta, prolonged labour, neonatal distress = refer NOW).
    Provide immediate actions for TBA.

    Return JSON: immediate_referral_required, referral_reason, neonatal_risk, maternal_risk,
    immediate_actions (list), crvs_notification_required, confidence (0-1).
    """
    result = await call_governed_json(prompt, surface="home_birth_risk", phi_present=True)
    return result
```

---

## 5. NestJS Service + Controller

**File: `services/ehr-service/src/tba/tba.service.ts`**

Methods:
- `registerTba(dto)` — save TBA; auto-score risk via CDSS
- `getTbas(district?)` / `getTba(id)` / `updateTba(id, dto)`
- `scoreTbaRisk(id)` — call CDSS supervision-risk; update `supervisionScore` + `supervisionRisk`
- `recordHomeBirth(dto)` — save birth; call CDSS home-birth-risk; if `immediate_referral_required` → update `referred: true`; after save, auto-notify CRVS if `crvs_notification_required`
- `getHomeBirths(filters)` / `getHomeBirth(id)` / `updateHomeBirth(id, dto)`
- `notifyCRVS(birthId)` — call existing CRVS service to submit birth notification; update `crvsNotified: true`
- `getTbaSummary(district)` — counts, deaths, referral rate

**File: `services/ehr-service/src/tba/tba.controller.ts`**

Routes:
```
POST   /tba/register
GET    /tba/register
GET    /tba/register/:id
PATCH  /tba/register/:id
POST   /tba/register/:id/score-risk
POST   /tba/births
GET    /tba/births
GET    /tba/births/:id
PATCH  /tba/births/:id
POST   /tba/births/:id/notify-crvs
GET    /tba/summary/:district
```

**Module** (`tba.module.ts`) — import `CdssModule`; export `TbaService`. Register in `ehr.module.ts`.

---

## 6. Frontend

### API in `api.ts`

```typescript
export const tbaApi = {
  registerTba: (d: any) => api.post('/tba/register', d),
  getTbas: (district?: string) => api.get('/tba/register', { params: { district } }),
  updateTba: (id: string, d: any) => api.patch(`/tba/register/${id}`, d),
  scoreTbaRisk: (id: string) => api.post(`/tba/register/${id}/score-risk`, {}),
  recordBirth: (d: any) => api.post('/tba/births', d),
  getBirths: (params?: any) => api.get('/tba/births', { params }),
  updateBirth: (id: string, d: any) => api.patch(`/tba/births/${id}`, d),
  notifyCrvs: (id: string) => api.post(`/tba/births/${id}/notify-crvs`, {}),
  getSummary: (district: string) => api.get(`/tba/summary/${district}`),
};
```

### Component Spec — `TbaDashboard.tsx`

Three tabs:

1. **TBA Register** — Registration form. List with risk badges (red=high, amber=medium, green=low). "Score Risk" button per TBA → CDSS result: score/100, risk level, risk factors list, recommended training. Red flag for any TBA with supervision_risk='high' who hasn't been visited in >3 months.

2. **Home Births** — Birth recording form with mother details, birth outcome, complications, immediate care checklist (misoprostol, vitamin K, cord care). After save: CDSS panel (immediate referral required? → red alert; maternal/neonatal risk). "Notify CRVS" button for unregistered births → sends to CRVS and marks as notified.

3. **Summary** — District summary: TBA count, active %, high-risk TBA count, total home births this month, unregistered births (crvs_notified=false), maternal/neonatal death count.

Wire into CHW/Community Health section of dashboard.

---

## 7. Post-Implementation Steps

```bash
docker compose build tenant-service
./scripts/provision-repair-all.sh
# Fallback: curl -X POST http://localhost:3001/admin/tenants/repair-all -H "Authorization: Bearer <token>"

psql $DATABASE_URL -c "\d tba_register"
psql $DATABASE_URL -c "\d home_birth_records"

npx tsc --noEmit
npm run lint

git add services/tenant-service/src/generated/tenant-tba-birth-registration.statements.ts \
        services/ehr-service/src/tba/ \
        ehr-frontend/src/services/api.ts \
        ehr-frontend/src/components/TbaDashboard.tsx
git commit -m "feat: implement Sprint 156 — TBA module and rural birth registration"
```

---

## 8. Done-When Checklist

- [ ] `tenant-tba-birth-registration.statements.ts` — 2 tables, idempotent SQL
- [ ] Bundle registered in `database-provisioning.service.ts`
- [ ] `TbaRegister` + `HomeBirthRecord` TypeORM entities in `tenant.service.ts`
- [ ] `TbaModule` in `ehr.module.ts`
- [ ] `TbaService`: all methods including CRVS auto-notify on high-risk births
- [ ] `TbaController` with 11 routes
- [ ] CDSS `POST /cdss/tba/supervision-risk` — TBA risk scoring 0-100
- [ ] CDSS `POST /cdss/tba/home-birth-risk` — referral need + immediate actions
- [ ] `tbaApi` in `api.ts`
- [ ] `TbaDashboard.tsx` — 3 tabs: Register, Home Births, Summary
- [ ] Immediate referral alert shown as red banner
- [ ] CRVS "Notify" button marks birth as registered
- [ ] `provision-repair-all.sh` clean
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 156 — TBA module and rural birth registration`
