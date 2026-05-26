# NC-S05 — ALHIV Transition + HIV Disclosure + GBV Care Pathway

**Sprint ID:** NC-S05  
**Priority:** P1 — Core clinical safety + child protection  
**Effort:** 1.5 weeks  
**Dependencies:** NC-S03  
**Covers gaps:** 7.7 (disclosure — 30% → 100%), 7.8 (ALHIV transition — 25% → 100%), 7.3 (GBV — 20% → 90%), 7.1 (counsellor notes — partial → complete)

---

## 1. Codebase Context — What Already Exists

| File | What it has |
|---|---|
| `services/ehr-service/src/services/hiv.service.ts` | `disclosureHivStatus` (string), `disclosureHivStatusToWhom` (string), `disclosureHivStatusFinalDate`, `disclosureHivStatusFinalToWhom` — all free-text |
| `services/ehr-service/src/services/pediatrics.service.ts` | Paediatric dosing, developmental milestones |
| `services/ehr-service/src/entities/pediatric-profile.entity.ts` | Paediatric profile entity |
| `services/ehr-service/src/cultural/entities/social-determinant.entity.ts` | `gbvScreenPositive` boolean, `gbvScreenDate` |
| `services/ehr-service/src/entities/community-resource.entity.ts` | Category: `domestic_violence` |
| `services/ehr-service/src/services/post-visit.service.ts` | Age-based specialist routing: age < 15 → paediatrics |

**What's missing:**
- No structured HIV disclosure codification (free-text only)
- No disclosure readiness assessment tool
- No disclosure history / timeline
- No ALHIV transition readiness assessment
- No adolescent-to-adult transfer protocol
- No structured GBV screening instrument (HITS tool)
- No GBV safety planning or referral workflow
- No dedicated psychosocial counsellor encounter notes module

---

## 2. What This Sprint Builds

### Part A — Structured HIV Disclosure Module
- Structured disclosure status with controlled values
- Disclosure history timeline
- Disclosure readiness assessment (age-appropriate for children/adolescents)

### Part B — ALHIV Transition Module
- Transition readiness assessment (validated TRAQ tool adapted for Zimbabwe)
- Graduated transition steps with checklists
- Adult transfer letter generation

### Part C — GBV Care Pathway
- HITS screening instrument (4 questions)
- Safety assessment
- GBV referral workflow with community resource linking
- Sensitive role-restricted access

### Part D — Psychosocial Counsellor Module
- Dedicated counsellor encounter notes (not in main clinical notes)
- Session types: EAC, disclosure counselling, grief, GBV, adherence

---

## 3. Database Changes

Add bundle to `getProvisioningBundles()`:

```typescript
{
  id: 'nc_alhiv_disclosure_gbv',
  label: 'ALHIV Transition + HIV Disclosure + GBV Pathway',
  version: '2026.05.17.1',
  description: 'Structured HIV disclosure records, ALHIV transition assessments, GBV care pathway, counsellor notes',
  statements: () => [
    // Structured HIV disclosure
    `CREATE TABLE IF NOT EXISTS hiv_disclosure_records (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id            UUID         NOT NULL,
      assessment_date       DATE         NOT NULL,
      assessed_by           UUID,
      patient_age           INTEGER,
      disclosure_status     VARCHAR(40)  NOT NULL,
      -- Values: 'not_disclosed' | 'partially_disclosed' | 'fully_disclosed' | 'disclosure_not_applicable'
      disclosed_to          VARCHAR(300),  -- JSON array: ['partner', 'parent', 'sibling', 'employer', 'friend']
      readiness_score       INTEGER,       -- 0–10 self-reported readiness
      barriers              TEXT,          -- free-text barriers to disclosure
      support_needed        TEXT,
      counselling_provided  BOOLEAN  NOT NULL DEFAULT false,
      counselling_notes     TEXT,
      next_review_date      DATE,
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_disclosure_patient ON hiv_disclosure_records (patient_id)`,

    -- ALHIV transition assessments (patients 10–24)
    `CREATE TABLE IF NOT EXISTS alhiv_transition_assessments (
      id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id                UUID         NOT NULL,
      assessment_date           DATE         NOT NULL,
      assessed_by               UUID,
      patient_age               INTEGER      NOT NULL,
      -- TRAQ domains (1=never, 5=always for each)
      knows_diagnosis           INTEGER,      -- domain: disease knowledge
      knows_medications         INTEGER,      -- knows name and dose
      manages_own_medications   INTEGER,      -- takes without reminder
      attends_appointments_alone INTEGER,     -- can book and attend
      communicates_with_provider INTEGER,     -- asks questions independently
      understands_confidentiality INTEGER,
      has_adult_provider_identified BOOLEAN NOT NULL DEFAULT false,
      adult_provider_name       VARCHAR(200),
      adult_facility_name       VARCHAR(200),
      transition_stage          VARCHAR(30)  NOT NULL DEFAULT 'pre_transition',
      -- Values: 'pre_transition' | 'transition_preparation' | 'active_transition' | 'transferred' | 'transfer_failed'
      target_transfer_date      DATE,
      actual_transfer_date      DATE,
      transfer_letter_issued    BOOLEAN      NOT NULL DEFAULT false,
      transfer_letter_date      DATE,
      post_transfer_follow_up_due DATE,
      notes                     TEXT,
      created_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_alhiv_transition_patient ON alhiv_transition_assessments (patient_id)`,

    -- GBV screening and safety planning
    `CREATE TABLE IF NOT EXISTS gbv_assessments (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id            UUID         NOT NULL,
      screened_by           UUID,
      screen_date           DATE         NOT NULL,
      -- HITS Tool (Hurt, Insult, Threaten, Scream) — score 1-5 each
      hits_hurt             INTEGER,     -- Partner physically hurts you
      hits_insult           INTEGER,     -- Partner insults or talks down to you
      hits_threaten         INTEGER,     -- Partner threatens you with harm
      hits_scream           INTEGER,     -- Partner screams or curses at you
      hits_total            INTEGER,     -- Sum 4–20; >= 11 = positive screen
      screen_positive       BOOLEAN      NOT NULL DEFAULT false,
      danger_assessment     VARCHAR(30), -- 'safe' | 'moderate_risk' | 'high_risk' | 'imminent_danger'
      safety_plan_created   BOOLEAN      NOT NULL DEFAULT false,
      safety_plan_notes     TEXT,
      referred_to           TEXT,        -- community resource name(s)
      follow_up_date        DATE,
      outcome               VARCHAR(40), -- 'declined_services' | 'accepted_referral' | 'left_relationship' | 'ongoing_support'
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_gbv_patient ON gbv_assessments (patient_id)`,

    -- Counsellor encounter notes (separate from clinical notes)
    `CREATE TABLE IF NOT EXISTS counsellor_sessions (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        UUID         NOT NULL,
      session_date      DATE         NOT NULL,
      counsellor_id     UUID         NOT NULL,
      session_type      VARCHAR(40)  NOT NULL,
      -- Values: 'eac' | 'disclosure_counselling' | 'adherence' | 'gbv' | 'grief' | 'mental_health' | 'family' | 'other'
      session_number    INTEGER,
      duration_minutes  INTEGER,
      attendance        VARCHAR(20)  NOT NULL DEFAULT 'attended',  -- 'attended' | 'dna' | 'late_cancel'
      presenting_issues TEXT,
      session_notes     TEXT,         -- restricted access — counsellor only
      goals_set         TEXT,
      progress_noted    TEXT,
      next_session_date DATE,
      referral_made     BOOLEAN      NOT NULL DEFAULT false,
      referral_details  TEXT,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_counsellor_sessions_patient    ON counsellor_sessions (patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_counsellor_sessions_counsellor ON counsellor_sessions (counsellor_id)`,
  ],
},
```

Run `POST /api/admin/tenants/repair-all` after adding.

---

## 4. Backend Implementation

### 4.1 HIV Disclosure Service

**File to create:** `services/ehr-service/src/services/hiv-disclosure.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class HivDisclosureService {
  async createDisclosureRecord(params: {
    patientId: string;
    assessedBy: string;
    patientAge: number;
    disclosureStatus: 'not_disclosed' | 'partially_disclosed' | 'fully_disclosed' | 'disclosure_not_applicable';
    disclosedTo: string[];
    readinessScore: number;       // 0–10
    barriers?: string;
    supportNeeded?: string;
    counsellingProvided: boolean;
    counsellingNotes?: string;
    nextReviewDate?: string;
    db: any;
  }): Promise<any> {
    const [row] = await params.db.query(
      `INSERT INTO hiv_disclosure_records
         (patient_id, assessment_date, assessed_by, patient_age, disclosure_status,
          disclosed_to, readiness_score, barriers, support_needed, counselling_provided,
          counselling_notes, next_review_date)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [params.patientId, params.assessedBy, params.patientAge, params.disclosureStatus,
       JSON.stringify(params.disclosedTo), params.readinessScore,
       params.barriers ?? null, params.supportNeeded ?? null,
       params.counsellingProvided, params.counsellingNotes ?? null,
       params.nextReviewDate ?? null],
    );
    return row;
  }

  async getDisclosureHistory(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM hiv_disclosure_records WHERE patient_id = $1 ORDER BY assessment_date DESC`,
      [patientId],
    );
  }

  async getLatestDisclosureStatus(patientId: string, db: any): Promise<string | null> {
    const [row] = await db.query(
      `SELECT disclosure_status FROM hiv_disclosure_records
       WHERE patient_id = $1 ORDER BY assessment_date DESC LIMIT 1`,
      [patientId],
    );
    return row?.disclosure_status ?? null;
  }
}
```

### 4.2 ALHIV Transition Service

**File to create:** `services/ehr-service/src/services/alhiv-transition.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AlhivTransitionService {
  calculateTransitionReadiness(params: {
    knowsDiagnosis: number;
    knowsMedications: number;
    managesOwnMedications: number;
    attendsAppointmentsAlone: number;
    communicatesWithProvider: number;
    understandsConfidentiality: number;
  }): { totalScore: number; readinessLevel: 'low' | 'moderate' | 'high'; recommendation: string } {
    const scores = Object.values(params);
    const totalScore = scores.reduce((a, b) => a + b, 0);  // max 30

    if (totalScore < 12) {
      return { totalScore, readinessLevel: 'low', recommendation: 'Continue paediatric care. Intensive preparation programme required. Focus on disease knowledge and self-management skills.' };
    }
    if (totalScore < 21) {
      return { totalScore, readinessLevel: 'moderate', recommendation: 'Begin formal transition preparation. Identify adult provider. Practice self-management with decreasing support.' };
    }
    return { totalScore, readinessLevel: 'high', recommendation: 'Patient ready for transition. Identify adult provider, schedule joint handover appointment, issue transfer letter.' };
  }

  async createTransitionAssessment(params: {
    patientId: string;
    assessedBy: string;
    patientAge: number;
    scores: {
      knowsDiagnosis: number;
      knowsMedications: number;
      managesOwnMedications: number;
      attendsAppointmentsAlone: number;
      communicatesWithProvider: number;
      understandsConfidentiality: number;
    };
    adultProviderName?: string;
    adultFacilityName?: string;
    targetTransferDate?: string;
    notes?: string;
    db: any;
  }): Promise<any> {
    const readiness = this.calculateTransitionReadiness(params.scores);
    const stage = readiness.readinessLevel === 'high' ? 'transition_preparation' :
                  readiness.readinessLevel === 'moderate' ? 'pre_transition' : 'pre_transition';

    const [row] = await params.db.query(
      `INSERT INTO alhiv_transition_assessments
         (patient_id, assessment_date, assessed_by, patient_age,
          knows_diagnosis, knows_medications, manages_own_medications,
          attends_appointments_alone, communicates_with_provider, understands_confidentiality,
          adult_provider_name, adult_facility_name, transition_stage, target_transfer_date, notes)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [params.patientId, params.assessedBy, params.patientAge,
       params.scores.knowsDiagnosis, params.scores.knowsMedications,
       params.scores.managesOwnMedications, params.scores.attendsAppointmentsAlone,
       params.scores.communicatesWithProvider, params.scores.understandsConfidentiality,
       params.adultProviderName ?? null, params.adultFacilityName ?? null,
       stage, params.targetTransferDate ?? null, params.notes ?? null],
    );
    return { ...row, readiness };
  }

  async markTransferred(assessmentId: string, transferDate: string, db: any): Promise<void> {
    await db.query(
      `UPDATE alhiv_transition_assessments
       SET transition_stage = 'transferred', actual_transfer_date = $1,
           post_transfer_follow_up_due = $1::DATE + interval '3 months'
       WHERE id = $2`,
      [transferDate, assessmentId],
    );
  }
}
```

### 4.3 GBV Service

**File to create:** `services/ehr-service/src/services/gbv.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class GbvService {
  calculateHitsScore(hits: { hurt: number; insult: number; threaten: number; scream: number }): number {
    return hits.hurt + hits.insult + hits.threaten + hits.scream;
  }

  classifyDanger(hitsTotal: number, additionalFactors: { weaponInHome: boolean; escalatingViolence: boolean }): 'safe' | 'moderate_risk' | 'high_risk' | 'imminent_danger' {
    if (additionalFactors.weaponInHome || (hitsTotal >= 16 && additionalFactors.escalatingViolence)) return 'imminent_danger';
    if (hitsTotal >= 16 || additionalFactors.escalatingViolence) return 'high_risk';
    if (hitsTotal >= 11) return 'moderate_risk';
    return 'safe';
  }

  async createGbvAssessment(params: {
    patientId: string;
    screenedBy: string;
    hits: { hurt: number; insult: number; threaten: number; scream: number };
    dangerAssessment: string;
    safetyPlanCreated: boolean;
    safetyPlanNotes?: string;
    referredTo?: string;
    followUpDate?: string;
    db: any;
  }): Promise<any> {
    const total = this.calculateHitsScore(params.hits);
    const screenPositive = total >= 11;

    const [row] = await params.db.query(
      `INSERT INTO gbv_assessments
         (patient_id, screened_by, screen_date, hits_hurt, hits_insult, hits_threaten, hits_scream,
          hits_total, screen_positive, danger_assessment, safety_plan_created, safety_plan_notes,
          referred_to, follow_up_date)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [params.patientId, params.screenedBy,
       params.hits.hurt, params.hits.insult, params.hits.threaten, params.hits.scream,
       total, screenPositive, params.dangerAssessment, params.safetyPlanCreated,
       params.safetyPlanNotes ?? null, params.referredTo ?? null, params.followUpDate ?? null],
    );
    return row;
  }

  async getGbvHistory(patientId: string, db: any): Promise<any[]> {
    // GBV records are sensitive — only counsellors and senior nurses can access
    return db.query(
      `SELECT * FROM gbv_assessments WHERE patient_id = $1 ORDER BY screen_date DESC`,
      [patientId],
    );
  }
}
```

### 4.4 Counsellor Notes Service

**File to create:** `services/ehr-service/src/services/counsellor-sessions.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class CounsellorSessionsService {
  async createSession(params: {
    patientId: string;
    counsellorId: string;
    sessionType: string;
    sessionNumber?: number;
    durationMinutes?: number;
    attendance: string;
    presentingIssues?: string;
    sessionNotes?: string;
    goalsSet?: string;
    progressNoted?: string;
    nextSessionDate?: string;
    referralMade?: boolean;
    referralDetails?: string;
    db: any;
  }): Promise<any> {
    const [row] = await params.db.query(
      `INSERT INTO counsellor_sessions
         (patient_id, session_date, counsellor_id, session_type, session_number, duration_minutes,
          attendance, presenting_issues, session_notes, goals_set, progress_noted,
          next_session_date, referral_made, referral_details)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, session_date, session_type, attendance, next_session_date`,
      [params.patientId, params.counsellorId, params.sessionType, params.sessionNumber ?? null,
       params.durationMinutes ?? null, params.attendance, params.presentingIssues ?? null,
       params.sessionNotes ?? null, params.goalsSet ?? null, params.progressNoted ?? null,
       params.nextSessionDate ?? null, params.referralMade ?? false, params.referralDetails ?? null],
    );
    return row;
  }

  async getPatientSessions(patientId: string, counsellorId: string | null, db: any): Promise<any[]> {
    if (counsellorId) {
      // Counsellors only see their own sessions
      return db.query(
        `SELECT * FROM counsellor_sessions WHERE patient_id = $1 AND counsellor_id = $2 ORDER BY session_date DESC`,
        [patientId, counsellorId],
      );
    }
    // Senior staff see all sessions but session_notes is redacted
    return db.query(
      `SELECT id, session_date, counsellor_id, session_type, attendance, next_session_date, referral_made
       FROM counsellor_sessions WHERE patient_id = $1 ORDER BY session_date DESC`,
      [patientId],
    );
  }
}
```

### 4.5 Controller — Disclosure + Transition + GBV + Counsellor Endpoints

**File to create:** `services/ehr-service/src/controllers/psychosocial.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HivDisclosureService } from '../services/hiv-disclosure.service';
import { AlhivTransitionService } from '../services/alhiv-transition.service';
import { GbvService } from '../services/gbv.service';
import { CounsellorSessionsService } from '../services/counsellor-sessions.service';

@Controller('psychosocial')
@UseGuards(JwtAuthGuard)
export class PsychosocialController {
  constructor(
    private readonly disclosureSvc: HivDisclosureService,
    private readonly transitionSvc: AlhivTransitionService,
    private readonly gbvSvc: GbvService,
    private readonly counsellorSvc: CounsellorSessionsService,
  ) {}

  // --- Disclosure ---
  @Get('patients/:id/disclosure')
  getDisclosureHistory(@Param('id') id: string, @Req() req: any) {
    return this.disclosureSvc.getDisclosureHistory(id, req.tenantDb);
  }

  @Post('patients/:id/disclosure')
  createDisclosure(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.disclosureSvc.createDisclosureRecord({ ...body, patientId: id, assessedBy: req.user.sub, db: req.tenantDb });
  }

  // --- ALHIV Transition ---
  @Get('patients/:id/transition')
  async getTransitionHistory(@Param('id') id: string, @Req() req: any) {
    return req.tenantDb.query(
      `SELECT * FROM alhiv_transition_assessments WHERE patient_id = $1 ORDER BY assessment_date DESC`,
      [id],
    );
  }

  @Post('patients/:id/transition')
  createTransitionAssessment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.transitionSvc.createTransitionAssessment({ ...body, patientId: id, assessedBy: req.user.sub, db: req.tenantDb });
  }

  @Patch('transition/:assessmentId/mark-transferred')
  markTransferred(@Param('assessmentId') id: string, @Body() body: { transferDate: string }, @Req() req: any) {
    return this.transitionSvc.markTransferred(id, body.transferDate, req.tenantDb);
  }

  // --- GBV (restricted) ---
  @Get('patients/:id/gbv')
  getGbvHistory(@Param('id') id: string, @Req() req: any) {
    // TODO: add role check — only 'counsellor' | 'nurse_senior' | 'doctor'
    return this.gbvSvc.getGbvHistory(id, req.tenantDb);
  }

  @Post('patients/:id/gbv')
  createGbvAssessment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.gbvSvc.createGbvAssessment({ ...body, patientId: id, screenedBy: req.user.sub, db: req.tenantDb });
  }

  // --- Counsellor Sessions ---
  @Get('patients/:id/sessions')
  getSessions(@Param('id') id: string, @Req() req: any) {
    const isCounsellor = req.user.role === 'counsellor';
    return this.counsellorSvc.getPatientSessions(id, isCounsellor ? req.user.sub : null, req.tenantDb);
  }

  @Post('patients/:id/sessions')
  createSession(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.counsellorSvc.createSession({ ...body, patientId: id, counsellorId: req.user.sub, db: req.tenantDb });
  }
}
```

**Register** `PsychosocialController`, `HivDisclosureService`, `AlhivTransitionService`, `GbvService`, `CounsellorSessionsService` in `services/ehr-service/src/ehr.module.ts`.

---

## 5. Frontend Implementation

### 5.1 Psychosocial Tab in Patient Record

**File to create:** `ehr-frontend/src/components/PsychosocialTab.tsx`

Tabs within: Disclosure | Transition (if age 10–24) | GBV (role-restricted) | Counsellor Sessions

**Disclosure sub-tab:**
- Timeline of disclosure records (date, status, readiness score, disclosed_to list)
- "Record Disclosure Assessment" modal with all fields

**Transition sub-tab (shown only when patient age 10–24):**
- Transition readiness score radar chart (6 TRAQ domains)
- Current stage badge: Pre-Transition → Preparation → Active → Transferred
- "New Assessment" button
- "Mark as Transferred" button when stage = active_transition

**GBV sub-tab (only visible to counsellor | senior_nurse | doctor roles):**
- HITS questionnaire with 1–5 sliders for each question
- Real-time HITS total score (≥11 = positive = red)
- Danger classification display
- Safety plan text area
- Community resource quick-link to `domestic_violence` resources

**Counsellor Sessions sub-tab:**
- Session list (date, type, attendance)
- `session_notes` only visible if current user is the counsellor who created the session
- "New Session" modal

---

## 6. Tests Required

```typescript
// alhiv-transition.service.spec.ts
describe('AlhivTransitionService', () => {
  const svc = new AlhivTransitionService();
  it('classifies low readiness when total < 12', () => {
    const result = svc.calculateTransitionReadiness({ knowsDiagnosis: 1, knowsMedications: 2, managesOwnMedications: 1, attendsAppointmentsAlone: 2, communicatesWithProvider: 2, understandsConfidentiality: 1 });
    expect(result.readinessLevel).toBe('low');
    expect(result.totalScore).toBe(9);
  });
  it('classifies high readiness when total ≥ 21', () => {
    const result = svc.calculateTransitionReadiness({ knowsDiagnosis: 5, knowsMedications: 4, managesOwnMedications: 4, attendsAppointmentsAlone: 4, communicatesWithProvider: 5, understandsConfidentiality: 4 });
    expect(result.readinessLevel).toBe('high');
  });
});

// gbv.service.spec.ts
describe('GbvService', () => {
  const svc = new GbvService();
  it('calculates HITS score correctly', () => {
    expect(svc.calculateHitsScore({ hurt: 3, insult: 4, threaten: 2, scream: 3 })).toBe(12);
  });
  it('classifies ≥11 as moderate_risk', () => {
    expect(svc.classifyDanger(12, { weaponInHome: false, escalatingViolence: false })).toBe('moderate_risk');
  });
  it('classifies imminent_danger when weapon in home', () => {
    expect(svc.classifyDanger(8, { weaponInHome: true, escalatingViolence: false })).toBe('imminent_danger');
  });
  it('returns safe for score < 11', () => {
    expect(svc.classifyDanger(8, { weaponInHome: false, escalatingViolence: false })).toBe('safe');
  });
});
```

---

## 7. Sign-off Criteria

- [ ] `hiv_disclosure_records`, `alhiv_transition_assessments`, `gbv_assessments`, `counsellor_sessions` tables provisioned in all tenant DBs
- [ ] `repair-all` backfills tables in existing tenants
- [ ] `POST /psychosocial/patients/:id/disclosure` creates record with structured status (not free-text)
- [ ] `GET /psychosocial/patients/:id/disclosure` returns ordered timeline
- [ ] ALHIV transition readiness: score 9 = 'low', score 25 = 'high'
- [ ] `POST /psychosocial/patients/:id/transition` stores TRAQ scores and returns readiness classification
- [ ] `PATCH /psychosocial/transition/:id/mark-transferred` sets `transition_stage='transferred'` and `post_transfer_follow_up_due = transferDate + 3 months`
- [ ] HITS total ≥ 11 → `screen_positive = true`
- [ ] HITS danger: weapon in home → `imminent_danger` regardless of score
- [ ] `GET /psychosocial/patients/:id/gbv` returns full records to counsellors; endpoint exists and returns 200
- [ ] Counsellor sessions: `session_notes` NOT included in response when requester is not the authoring counsellor
- [ ] PsychosocialTab renders in EHR frontend with all 4 sub-tabs
- [ ] Transition sub-tab hidden for patients outside age 10–24
- [ ] GBV sub-tab hidden for staff roles other than counsellor, senior_nurse, doctor
- [ ] `PsychosocialController` registered in `ehr.module.ts`
- [ ] `npm run lint` passes zero errors
- [ ] `npm test` passes zero failures
- [ ] CI `build-and-test` job passes green
