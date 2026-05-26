# NC-S07 — Healthcare Worker Training Platform

**Sprint ID:** NC-S07  
**Priority:** P2 — Newlands national training mandate  
**Effort:** 3 weeks  
**Dependencies:** None  
**Covers gaps:** 9.1 (trainee registration), 9.2 (course/curriculum), 9.3 (competency assessments), 9.4 (CPD/CME tracking), 9.5 (cervical cancer course), 9.7 (clinical simulation — partial → complete)

---

## 1. Codebase Context — What Already Exists

No training, course, curriculum, trainee, competency, CPD, or CME modules exist anywhere in the codebase.

**What exists that we can reuse:**
- `services/ehr-service/src/services/cervical-cancer.service.ts` — clinical cervical cancer module (treatment, screening)
- `services/ehr-service/src/entities/health-education-content.entity.ts` — `health_education_content` table in per-tenant DB (title, body HTML, category, language, tags)
- `services/ehr-service/src/ehr.module.ts` — 168 registered controllers (add TrainingController here)

**Architecture decision:** The training platform lives in the **EHR service** (not a separate service) because:
1. Trainee registration must link to the `users` table (staff accounts)
2. Clinical simulation uses real patient data patterns from existing CDSS
3. Avoids a new microservice for this sprint scope

---

## 2. What This Sprint Builds

1. **Trainee registry** — register healthcare workers attending Newlands training courses
2. **Course catalogue** — manage courses (National Advanced Clinical HIV Management Course, Cervical Cancer Course, etc.)
3. **Curriculum modules** — each course has ordered modules/topics
4. **Pre/post assessments** — multiple-choice assessment per module with scoring and pass/fail
5. **CPD/CME credit tracking** — credits accumulated per trainee
6. **Attendance tracking** — session-level attendance per trainee
7. **Training dashboard** — super-admin and training coordinator views
8. **Certificate generation** — graduate certificate with name, course, date, CPD credits

---

## 3. Database Changes

Add bundle to `getProvisioningBundles()`:

```typescript
{
  id: 'nc_training_platform',
  label: 'Healthcare Worker Training Platform',
  version: '2026.05.17.1',
  description: 'Trainee registry, course catalogue, assessments, CPD tracking, attendance',
  statements: () => [
    // Courses
    `CREATE TABLE IF NOT EXISTS training_courses (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_code         VARCHAR(20)  NOT NULL UNIQUE,  -- e.g. 'NACHMC', 'CERVICAL'
      course_name         VARCHAR(300) NOT NULL,
      course_type         VARCHAR(60)  NOT NULL,  -- 'clinical_hiv' | 'cervical_cancer' | 'nursing' | 'pharmacy' | 'lab' | 'other'
      description         TEXT,
      duration_days       INTEGER,
      cpd_credits         NUMERIC(5,1),   -- total CPD credits on completion
      target_audience     TEXT,           -- e.g. 'Nurses, Clinical Officers, Doctors'
      prerequisites       TEXT,
      pass_mark_pct       INTEGER  NOT NULL DEFAULT 70,  -- minimum % to pass
      accrediting_body    VARCHAR(200),   -- e.g. 'Medical Council of Zimbabwe', 'Nursing Council'
      certificate_template TEXT,          -- HTML template for certificate
      is_active           BOOLEAN  NOT NULL DEFAULT true,
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,

    // Seed standard Newlands courses
    `INSERT INTO training_courses (course_code, course_name, course_type, description, duration_days, cpd_credits, target_audience, pass_mark_pct, accrediting_body)
     VALUES
       ('NACHMC', 'National Advanced Clinical HIV Management Course', 'clinical_hiv',
        'Flagship 5-day intensive HIV clinical management course run by Newlands Clinic since 2004. Covers ART initiation, monitoring, treatment failure, OI management, and PMTCT.',
        5, 40.0, 'Nurses, Clinical Officers, Medical Officers', 70, 'Medical Council of Zimbabwe / Nursing Council of Zimbabwe'),
       ('CERVICAL', 'Cervical Cancer Diagnosis and Treatment Course', 'cervical_cancer',
        'Training in VIA/VILI screening, colposcopy, LEEP, and cryotherapy for cervical cancer. Run since 2013.',
        3, 24.0, 'Nurses, Midwives, Clinical Officers', 70, 'Medical Council of Zimbabwe')
     ON CONFLICT (course_code) DO NOTHING`,

    // Curriculum modules
    `CREATE TABLE IF NOT EXISTS training_modules (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id       UUID         NOT NULL REFERENCES training_courses(id),
      module_order    INTEGER      NOT NULL,
      module_code     VARCHAR(20),
      module_name     VARCHAR(300) NOT NULL,
      description     TEXT,
      duration_hours  NUMERIC(4,1),
      learning_objectives TEXT,
      facilitator_notes   TEXT,
      content_url     VARCHAR(1000),  -- link to slide deck / resource
      cpd_credits     NUMERIC(4,1)    DEFAULT 0,
      UNIQUE (course_id, module_order)
    )`,

    // Assessments (MCQ questions per module)
    `CREATE TABLE IF NOT EXISTS training_assessment_questions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_id       UUID         NOT NULL REFERENCES training_modules(id),
      question_text   TEXT         NOT NULL,
      option_a        TEXT         NOT NULL,
      option_b        TEXT         NOT NULL,
      option_c        TEXT,
      option_d        TEXT,
      correct_option  CHAR(1)      NOT NULL,   -- 'A' | 'B' | 'C' | 'D'
      explanation     TEXT,                     -- shown after answering
      points          INTEGER      NOT NULL DEFAULT 1,
      assessment_type VARCHAR(10)  NOT NULL DEFAULT 'post',  -- 'pre' | 'post'
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,

    // Trainee profiles
    `CREATE TABLE IF NOT EXISTS training_trainees (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name          VARCHAR(100) NOT NULL,
      last_name           VARCHAR(100) NOT NULL,
      email               VARCHAR(200) UNIQUE,
      phone               VARCHAR(50),
      national_id         VARCHAR(50),
      professional_category VARCHAR(60) NOT NULL,  -- 'nurse' | 'clinical_officer' | 'doctor' | 'pharmacist' | 'lab_tech' | 'midwife' | 'other'
      current_facility    VARCHAR(300),
      current_district    VARCHAR(100),
      current_province    VARCHAR(100),
      employer            VARCHAR(200),            -- 'MoHCC' | 'MSF' | 'PSI' | 'Private' | 'NGO' | etc.
      registration_number VARCHAR(100),            -- professional council reg number
      total_cpd_credits   NUMERIC(8,1) NOT NULL DEFAULT 0,
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_trainee_email    ON training_trainees (email)`,
    `CREATE INDEX IF NOT EXISTS idx_trainee_facility ON training_trainees (current_facility)`,

    // Course enrolments
    `CREATE TABLE IF NOT EXISTS training_enrolments (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trainee_id          UUID         NOT NULL REFERENCES training_trainees(id),
      course_id           UUID         NOT NULL REFERENCES training_courses(id),
      cohort_label        VARCHAR(100),           -- e.g. 'May 2026 Cohort'
      start_date          DATE         NOT NULL,
      end_date            DATE,
      status              VARCHAR(20)  NOT NULL DEFAULT 'enrolled',
      -- Values: 'enrolled' | 'in_progress' | 'completed' | 'passed' | 'failed' | 'withdrawn'
      overall_score_pct   NUMERIC(5,2),
      cpd_credits_earned  NUMERIC(5,1) DEFAULT 0,
      certificate_number  VARCHAR(50)  UNIQUE,
      certificate_issued  BOOLEAN      NOT NULL DEFAULT false,
      certificate_date    DATE,
      notes               TEXT,
      enrolled_by         UUID,
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      UNIQUE (trainee_id, course_id, start_date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_enrolment_trainee ON training_enrolments (trainee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_enrolment_course  ON training_enrolments (course_id)`,

    // Session attendance
    `CREATE TABLE IF NOT EXISTS training_attendance (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrolment_id    UUID         NOT NULL REFERENCES training_enrolments(id),
      module_id       UUID         NOT NULL REFERENCES training_modules(id),
      session_date    DATE         NOT NULL,
      attended        BOOLEAN      NOT NULL DEFAULT true,
      absence_reason  TEXT,
      UNIQUE (enrolment_id, module_id, session_date)
    )`,

    // Assessment results
    `CREATE TABLE IF NOT EXISTS training_assessment_results (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrolment_id        UUID         NOT NULL REFERENCES training_enrolments(id),
      module_id           UUID         NOT NULL REFERENCES training_modules(id),
      assessment_type     VARCHAR(10)  NOT NULL,   -- 'pre' | 'post'
      score_raw           INTEGER      NOT NULL,    -- number of correct answers
      score_total         INTEGER      NOT NULL,    -- total questions
      score_pct           NUMERIC(5,2) NOT NULL,    -- score_raw / score_total * 100
      passed              BOOLEAN      NOT NULL,
      answers             JSONB,                    -- { questionId: selectedOption }
      submitted_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_assessment_result_enrolment ON training_assessment_results (enrolment_id)`,

    // CPD ledger
    `CREATE TABLE IF NOT EXISTS cpd_ledger (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trainee_id      UUID         NOT NULL REFERENCES training_trainees(id),
      source_type     VARCHAR(30)  NOT NULL,  -- 'course_completion' | 'module_completion' | 'manual_award' | 'external_activity'
      source_id       UUID,                   -- enrolment_id or module_id
      credit_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
      credits         NUMERIC(5,1) NOT NULL,
      description     VARCHAR(400),
      awarded_by      UUID,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cpd_ledger_trainee ON cpd_ledger (trainee_id)`,
  ],
},
```

Run `POST /api/admin/tenants/repair-all` after adding.

---

## 4. Backend Implementation

### 4.1 Training Service

**File to create:** `services/ehr-service/src/services/training.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TrainingService {
  // --- Course Management ---
  async listCourses(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM training_courses WHERE is_active = true ORDER BY course_name`);
  }

  async getCourseWithModules(courseId: string, db: any): Promise<any> {
    const [course] = await db.query(`SELECT * FROM training_courses WHERE id = $1`, [courseId]);
    if (!course) return null;
    const modules = await db.query(
      `SELECT * FROM training_modules WHERE course_id = $1 ORDER BY module_order`,
      [courseId],
    );
    return { ...course, modules };
  }

  // --- Trainee Registration ---
  async registerTrainee(dto: {
    firstName: string; lastName: string; email?: string; phone?: string;
    nationalId?: string; professionalCategory: string;
    currentFacility?: string; currentDistrict?: string; currentProvince?: string;
    employer?: string; registrationNumber?: string;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO training_trainees
         (first_name, last_name, email, phone, national_id, professional_category,
          current_facility, current_district, current_province, employer, registration_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (email) DO UPDATE SET
         first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
         professional_category = EXCLUDED.professional_category,
         current_facility = EXCLUDED.current_facility, updated_at = now()
       RETURNING *`,
      [dto.firstName, dto.lastName, dto.email ?? null, dto.phone ?? null,
       dto.nationalId ?? null, dto.professionalCategory,
       dto.currentFacility ?? null, dto.currentDistrict ?? null, dto.currentProvince ?? null,
       dto.employer ?? null, dto.registrationNumber ?? null],
    );
    return row;
  }

  async searchTrainees(query: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM training_trainees
       WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR current_facility ILIKE $1
       ORDER BY last_name, first_name LIMIT 50`,
      [`%${query}%`],
    );
  }

  // --- Enrolments ---
  async enrolTrainee(dto: {
    traineeId: string; courseId: string; cohortLabel?: string;
    startDate: string; endDate?: string; enrolledBy: string;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO training_enrolments
         (trainee_id, course_id, cohort_label, start_date, end_date, enrolled_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,'enrolled') RETURNING *`,
      [dto.traineeId, dto.courseId, dto.cohortLabel ?? null,
       dto.startDate, dto.endDate ?? null, dto.enrolledBy],
    );
    return row;
  }

  // --- Assessments ---
  async submitAssessment(dto: {
    enrolmentId: string;
    moduleId: string;
    assessmentType: 'pre' | 'post';
    answers: Record<string, string>;   // { questionId: 'A' | 'B' | 'C' | 'D' }
  }, db: any): Promise<{ scoreRaw: number; scoreTotal: number; scorePct: number; passed: boolean; feedback: any[] }> {
    // Load questions
    const questions = await db.query(
      `SELECT * FROM training_assessment_questions WHERE module_id = $1 AND assessment_type = $2`,
      [dto.moduleId, dto.assessmentType],
    );

    let correct = 0;
    const feedback = questions.map((q: any) => {
      const selected = dto.answers[q.id];
      const isCorrect = selected === q.correct_option;
      if (isCorrect) correct++;
      return { questionId: q.id, selected, correctOption: q.correct_option, isCorrect, explanation: q.explanation };
    });

    const scoreTotal = questions.length;
    const scorePct   = scoreTotal > 0 ? (correct / scoreTotal) * 100 : 0;

    // Get course pass mark
    const [enrolment] = await db.query(
      `SELECT c.pass_mark_pct FROM training_enrolments e
       JOIN training_courses c ON c.id = e.course_id WHERE e.id = $1`,
      [dto.enrolmentId],
    );
    const passed = scorePct >= (enrolment?.pass_mark_pct ?? 70);

    await db.query(
      `INSERT INTO training_assessment_results
         (enrolment_id, module_id, assessment_type, score_raw, score_total, score_pct, passed, answers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [dto.enrolmentId, dto.moduleId, dto.assessmentType, correct, scoreTotal, scorePct, passed, JSON.stringify(dto.answers)],
    );

    return { scoreRaw: correct, scoreTotal, scorePct, passed, feedback };
  }

  // --- Completion + Certificate ---
  async calculateOverallScore(enrolmentId: string, db: any): Promise<{ scorePct: number; passed: boolean }> {
    const [result] = await db.query(
      `SELECT
         AVG(score_pct) AS avg_score,
         BOOL_AND(passed) AS all_passed
       FROM training_assessment_results
       WHERE enrolment_id = $1 AND assessment_type = 'post'`,
      [enrolmentId],
    );
    return { scorePct: parseFloat(result?.avg_score ?? '0'), passed: result?.all_passed ?? false };
  }

  async completeCourse(enrolmentId: string, db: any): Promise<any> {
    const { scorePct, passed } = await this.calculateOverallScore(enrolmentId, db);

    // Award CPD credits if passed
    if (passed) {
      const [enrolment] = await db.query(
        `SELECT e.*, c.cpd_credits, c.course_name FROM training_enrolments e
         JOIN training_courses c ON c.id = e.course_id WHERE e.id = $1`,
        [enrolmentId],
      );
      const certNumber = `NEWLANDS-${new Date().getFullYear()}-${uuidv4().split('-')[0].toUpperCase()}`;

      await db.query(
        `UPDATE training_enrolments SET
           status = 'passed', overall_score_pct = $1, cpd_credits_earned = $2,
           certificate_number = $3, certificate_issued = true, certificate_date = CURRENT_DATE
         WHERE id = $4`,
        [scorePct, enrolment.cpd_credits, certNumber, enrolmentId],
      );

      // Update trainee total CPD credits
      await db.query(
        `UPDATE training_trainees SET total_cpd_credits = total_cpd_credits + $1, updated_at = now()
         WHERE id = $2`,
        [enrolment.cpd_credits, enrolment.trainee_id],
      );

      // Write CPD ledger entry
      await db.query(
        `INSERT INTO cpd_ledger (trainee_id, source_type, source_id, credits, description)
         VALUES ($1, 'course_completion', $2, $3, $4)`,
        [enrolment.trainee_id, enrolmentId, enrolment.cpd_credits, `Completed: ${enrolment.course_name}`],
      );

      return { status: 'passed', scorePct, certificateNumber: certNumber, cpdCreditsEarned: enrolment.cpd_credits };
    } else {
      await db.query(
        `UPDATE training_enrolments SET status = 'failed', overall_score_pct = $1 WHERE id = $2`,
        [scorePct, enrolmentId],
      );
      return { status: 'failed', scorePct };
    }
  }

  // --- Reporting ---
  async getCohortReport(courseId: string, cohortLabel: string, db: any): Promise<any> {
    return db.query(
      `SELECT
         t.first_name, t.last_name, t.professional_category, t.current_facility, t.current_province,
         e.status, e.overall_score_pct, e.cpd_credits_earned, e.certificate_number, e.certificate_date
       FROM training_enrolments e
       JOIN training_trainees t ON t.id = e.trainee_id
       WHERE e.course_id = $1 AND ($2::TEXT IS NULL OR e.cohort_label = $2)
       ORDER BY t.last_name, t.first_name`,
      [courseId, cohortLabel || null],
    );
  }

  async getAlumniByFacility(db: any): Promise<any[]> {
    return db.query(`
      SELECT
        t.current_facility, t.current_province, t.current_district,
        COUNT(DISTINCT t.id) AS trained_staff,
        SUM(e.cpd_credits_earned) AS total_cpd_earned,
        array_agg(DISTINCT c.course_code) AS courses_completed
      FROM training_trainees t
      JOIN training_enrolments e ON e.trainee_id = t.id AND e.status = 'passed'
      JOIN training_courses c ON c.id = e.course_id
      GROUP BY t.current_facility, t.current_province, t.current_district
      ORDER BY trained_staff DESC
    `);
  }
}
```

### 4.2 Controller

**File to create:** `services/ehr-service/src/controllers/training.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TrainingService } from '../services/training.service';

@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly svc: TrainingService) {}

  // Courses
  @Get('courses')
  listCourses(@Req() req: any) { return this.svc.listCourses(req.tenantDb); }

  @Get('courses/:id')
  getCourse(@Param('id') id: string, @Req() req: any) { return this.svc.getCourseWithModules(id, req.tenantDb); }

  // Trainees
  @Get('trainees')
  searchTrainees(@Query('q') q: string, @Req() req: any) { return this.svc.searchTrainees(q ?? '', req.tenantDb); }

  @Post('trainees')
  registerTrainee(@Body() body: any, @Req() req: any) { return this.svc.registerTrainee(body, req.tenantDb); }

  // Enrolments
  @Post('enrolments')
  enrolTrainee(@Body() body: any, @Req() req: any) {
    return this.svc.enrolTrainee({ ...body, enrolledBy: req.user.sub }, req.tenantDb);
  }

  @Get('courses/:courseId/cohort-report')
  getCohortReport(@Param('courseId') cid: string, @Query('cohort') cohort: string, @Req() req: any) {
    return this.svc.getCohortReport(cid, cohort, req.tenantDb);
  }

  // Assessments
  @Post('enrolments/:id/assessments')
  submitAssessment(@Param('id') enrolmentId: string, @Body() body: any, @Req() req: any) {
    return this.svc.submitAssessment({ ...body, enrolmentId }, req.tenantDb);
  }

  // Completion
  @Post('enrolments/:id/complete')
  completeCourse(@Param('id') id: string, @Req() req: any) {
    return this.svc.completeCourse(id, req.tenantDb);
  }

  // Alumni map
  @Get('alumni/by-facility')
  getAlumniByFacility(@Req() req: any) { return this.svc.getAlumniByFacility(req.tenantDb); }
}
```

**Register** `TrainingController`, `TrainingService` in `services/ehr-service/src/ehr.module.ts`.

---

## 5. Frontend Implementation

### 5.1 Training Dashboard

**File to create:** `ehr-frontend/src/pages/TrainingDashboard.tsx`

Tabs: Courses | Trainees | Enrolments | Assessments | Reports | Alumni Map

**Courses tab:**
- Course cards with: name, code, duration, CPD credits, enrolled/passed counts
- Expand to see module list with order, duration, learning objectives

**Trainees tab:**
- Search bar (name, facility, email)
- Table: Name | Professional Category | Facility | Province | Total CPD Credits | Courses Completed
- "Register Trainee" form modal

**Enrolments tab:**
- Cohort selector (course + cohort label)
- Table: Trainee name | Status badge | Overall score | Certificate number | CPD earned
- "Enrol Trainee" button
- "Mark Complete" button per enrolment

**Assessments tab:**
- Per-module MCQ question bank management
- Add/Edit/Delete questions
- Preview assessment as trainee would see it

**Reports tab:**
- Cohort summary table (exportable to CSV)
- Pass rate chart by cohort
- CPD credits distributed per month (bar chart)

**Alumni Map tab:**
- Table: Facility | District | Province | Trained Staff Count | Courses Completed
- (Future: map integration)

---

## 6. Tests Required

```typescript
// training.service.spec.ts
describe('TrainingService', () => {
  it('submitAssessment calculates correct score', async () => {
    const mockDb = {
      query: jest.fn()
        .mockResolvedValueOnce([  // questions
          { id: 'q1', correct_option: 'A', explanation: 'Because A' },
          { id: 'q2', correct_option: 'B', explanation: 'Because B' },
          { id: 'q3', correct_option: 'C', explanation: 'Because C' },
        ])
        .mockResolvedValueOnce([{ pass_mark_pct: 70 }])  // enrolment
        .mockResolvedValue([]),   // insert result
    };
    const svc = new TrainingService();
    const result = await svc.submitAssessment({
      enrolmentId: 'e1',
      moduleId: 'm1',
      assessmentType: 'post',
      answers: { q1: 'A', q2: 'B', q3: 'A' },  // 2/3 correct = 66.6%
    }, mockDb);
    expect(result.scoreRaw).toBe(2);
    expect(result.scoreTotal).toBe(3);
    expect(result.passed).toBe(false);  // 66.6% < 70%
  });

  it('completeCourse awards certificate when passed', async () => {
    const mockDb = {
      query: jest.fn()
        .mockResolvedValueOnce([{ avg_score: '85', all_passed: true }])
        .mockResolvedValueOnce([{ trainee_id: 't1', cpd_credits: 40, course_name: 'NACHMC' }])
        .mockResolvedValue([]),
    };
    const svc = new TrainingService();
    const result = await svc.completeCourse('e1', mockDb);
    expect(result.status).toBe('passed');
    expect(result.certificateNumber).toMatch(/^NEWLANDS-\d{4}-/);
    expect(result.cpdCreditsEarned).toBe(40);
  });

  it('completeCourse marks failed when score below pass mark', async () => {
    const mockDb = {
      query: jest.fn()
        .mockResolvedValueOnce([{ avg_score: '55', all_passed: false }])
        .mockResolvedValue([]),
    };
    const svc = new TrainingService();
    const result = await svc.completeCourse('e1', mockDb);
    expect(result.status).toBe('failed');
  });
});
```

---

## 7. Sign-off Criteria

- [ ] All 9 training tables provisioned in all tenant DBs: `training_courses`, `training_modules`, `training_assessment_questions`, `training_trainees`, `training_enrolments`, `training_attendance`, `training_assessment_results`, `cpd_ledger` 
- [ ] Seed data: NACHMC and CERVICAL courses exist after provisioning
- [ ] `repair-all` backfills all tables in existing tenants
- [ ] `POST /training/trainees` creates trainee; re-registering with same email updates record (ON CONFLICT)
- [ ] `POST /training/enrolments` creates enrolment with status 'enrolled'
- [ ] `POST /training/enrolments/:id/assessments` correctly scores answers: 2/3 correct = 66.7%
- [ ] Incorrect MCQ answer → `isCorrect: false` in feedback; `explanation` included in feedback
- [ ] Score < pass_mark_pct → `passed: false`; score ≥ pass_mark_pct → `passed: true`
- [ ] `POST /training/enrolments/:id/complete` issues certificate number with `NEWLANDS-YYYY-` prefix
- [ ] On pass: `cpd_ledger` entry inserted; `training_trainees.total_cpd_credits` incremented
- [ ] On fail: `status = 'failed'`; no CPD awarded; no certificate issued
- [ ] `GET /training/alumni/by-facility` returns aggregated alumni counts by facility
- [ ] Training Dashboard renders with all tabs
- [ ] Cohort report exportable (CSV button triggers download)
- [ ] `TrainingController` registered in `ehr.module.ts`
- [ ] `npm run lint` passes zero errors
- [ ] `npm test` passes zero failures
- [ ] CI `build-and-test` job passes green
