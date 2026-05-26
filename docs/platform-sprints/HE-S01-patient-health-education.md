# HE-S01 — Patient Health Education Module

**Sprint:** HE-S01  
**Duration:** 10 days  
**Depends on:** NC-S11 (i18n infrastructure), PP-S22 (patient portal education read surface), S19 (mobile education screen)

---

## Overview

This sprint introduces a tenant-scoped, clinician-authored patient health education system. Think Moodle for patients: structured courses with modules and lessons, multilingual content (EN/SN/ND and all 8 mobile locales), optional MCQ quizzes with pass thresholds, and per-patient progress tracking. A new `is_health_educator` staff flag gates the authoring tools in the EHR frontend. Patients consume content through the existing patient portal education page (PP-S22) and mobile education screen (S19) — both re-wired to the new tenant-specific API.

**What changes hands:**
- DB: 10 new per-tenant tables provisioned via a single bundle
- Backend: 2 new NestJS controllers, 2 services, 1 guard
- EHR frontend: 3 new pages (course list, course editor, progress dashboard)
- Patient portal: existing PP-S22 pages re-wired + progress UI added
- Mobile: existing S19 screen re-wired + lesson/quiz screens added

---

## Development Methodology

Every change in this sprint follows three non-negotiable steps in order:

1. **Provision DB first** — all new tables go into a provisioning bundle using `CREATE TABLE IF NOT EXISTS`. Run `POST /api/admin/tenants/repair-all` before writing any service code.
2. **Lint and CI gate** — `npm run lint` must pass after every service/controller addition. `npm test` runs against coverage thresholds before the sprint is signed off.
3. **Extend the existing UI/UX stack** — EHR frontend uses the established Tailwind + React page/card/modal patterns. Patient portal continues the existing card-grid layout from PP-S22. Mobile extends the existing FlatList + Modal patterns from S19. No new UI libraries.

---

## Phase 1 — Database Provisioning

### 1.1 Staff role column

Add to `ensureSubscriptionSchema()` in `services/tenant-service/src/services/tenant.service.ts`:

```sql
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_health_educator BOOLEAN DEFAULT false;
```

This is a per-tenant column on the existing `staff` table — no new table, no new bundle.

### 1.2 Provisioning bundle

Add to `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`:

```typescript
{
  id: 'patient_health_education',
  label: 'Patient Health Education',
  version: '2026.05.17.1',
  description: 'Tenant-scoped clinician-authored education courses with multilingual content, quizzes, and patient progress tracking.',
  statements: () => [
    // ── Course catalogue ────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS education_courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),           -- e.g. 'HIV', 'Maternal', 'Nutrition', 'Medication'
      target_audience VARCHAR(100),    -- e.g. 'all', 'hiv_positive', 'anc', 'paediatric'
      default_language_code VARCHAR(5) DEFAULT 'en',
      published BOOLEAN DEFAULT false,
      published_at TIMESTAMPTZ,
      created_by UUID NOT NULL,        -- staff.id
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS education_modules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES education_courses(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS education_lessons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_id UUID NOT NULL REFERENCES education_modules(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      content_type VARCHAR(20) NOT NULL DEFAULT 'text', -- 'text' | 'video_url' | 'pdf_url'
      duration_minutes INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    -- Multilingual content stored separately so each lesson can have
    -- EN + SN + ND (or any subset) without nullable columns on the lesson row
    `CREATE TABLE IF NOT EXISTS education_lesson_translations (
      lesson_id UUID NOT NULL REFERENCES education_lessons(id) ON DELETE CASCADE,
      language_code VARCHAR(5) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content_body TEXT NOT NULL,      -- Markdown for 'text'; URL for video/pdf types
      PRIMARY KEY (lesson_id, language_code)
    )`,

    // ── Quiz layer (optional per lesson) ───────────────────────────
    `CREATE TABLE IF NOT EXISTS education_quizzes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id UUID NOT NULL REFERENCES education_lessons(id) ON DELETE CASCADE,
      pass_threshold INTEGER NOT NULL DEFAULT 70,  -- percentage
      max_attempts INTEGER NOT NULL DEFAULT 3,
      UNIQUE (lesson_id)
    )`,

    `CREATE TABLE IF NOT EXISTS education_quiz_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_id UUID NOT NULL REFERENCES education_quizzes(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0
    )`,

    `CREATE TABLE IF NOT EXISTS education_quiz_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id UUID NOT NULL REFERENCES education_quiz_questions(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL DEFAULT false,
      order_index INTEGER NOT NULL DEFAULT 0
    )`,

    // ── Patient progress ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS education_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      course_id UUID NOT NULL REFERENCES education_courses(id) ON DELETE CASCADE,
      enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      assigned_by UUID,                -- staff.id if staff-assigned; NULL if self-enrolled
      UNIQUE (patient_id, course_id)
    )`,

    `CREATE TABLE IF NOT EXISTS education_lesson_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES education_enrollments(id) ON DELETE CASCADE,
      lesson_id UUID NOT NULL REFERENCES education_lessons(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      UNIQUE (enrollment_id, lesson_id)
    )`,

    `CREATE TABLE IF NOT EXISTS education_quiz_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES education_enrollments(id) ON DELETE CASCADE,
      quiz_id UUID NOT NULL REFERENCES education_quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,          -- percentage 0-100
      passed BOOLEAN NOT NULL,
      answers JSONB NOT NULL,          -- [{questionId, selectedOptionId}]
      attempted_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Indexes ────────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_edu_modules_course ON education_modules(course_id)`,
    `CREATE INDEX IF NOT EXISTS idx_edu_lessons_module ON education_lessons(module_id)`,
    `CREATE INDEX IF NOT EXISTS idx_edu_translations_lesson ON education_lesson_translations(lesson_id)`,
    `CREATE INDEX IF NOT EXISTS idx_edu_enrollments_patient ON education_enrollments(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_edu_enrollments_course ON education_enrollments(course_id)`,
    `CREATE INDEX IF NOT EXISTS idx_edu_progress_enrollment ON education_lesson_progress(enrollment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_edu_attempts_enrollment ON education_quiz_attempts(enrollment_id)`,
  ],
},
```

**After adding the bundle, run:**

```bash
POST /api/admin/tenants/repair-all
```

This backfills all existing tenants. Confirm response contains `patient_health_education` in the applied bundles list before proceeding to Phase 2.

---

## Phase 2 — Backend Services

### 2.1 Health Educator Guard

`services/ehr-service/src/guards/health-educator.guard.ts`

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class HealthEducatorGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const staffId = req.user?.sub;
    const tenantDb = req.tenantDb;
    const result = await tenantDb.query(
      `SELECT is_health_educator FROM staff WHERE id = $1`,
      [staffId],
    );
    if (!result.rows[0]?.is_health_educator) {
      throw new ForbiddenException('Health educator role required');
    }
    return true;
  }
}
```

No changes to JWT issuance — the guard does a single DB lookup on every authoring request.

### 2.2 HealthEducationService (staff authoring)

`services/ehr-service/src/services/health-education.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class HealthEducationService {

  // ── Courses ──────────────────────────────────────────────────────

  async listCourses(tenantDb: Pool) {
    const { rows } = await tenantDb.query(`
      SELECT
        c.*,
        COUNT(DISTINCT e.patient_id)::int AS enrolled_count,
        COUNT(DISTINCT m.id)::int         AS module_count,
        COUNT(DISTINCT l.id)::int         AS lesson_count
      FROM education_courses c
      LEFT JOIN education_modules m ON m.course_id = c.id
      LEFT JOIN education_lessons l ON l.module_id = m.id
      LEFT JOIN education_enrollments e ON e.course_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return rows;
  }

  async createCourse(dto: CreateCourseDto, staffId: string, tenantDb: Pool) {
    const { rows } = await tenantDb.query(
      `INSERT INTO education_courses
         (title, description, category, target_audience, default_language_code, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [dto.title, dto.description, dto.category, dto.targetAudience, dto.defaultLanguageCode ?? 'en', staffId],
    );
    return rows[0];
  }

  async updateCourse(courseId: string, dto: Partial<CreateCourseDto>, tenantDb: Pool) {
    const { rows } = await tenantDb.query(
      `UPDATE education_courses
       SET title=$1, description=$2, category=$3, target_audience=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [dto.title, dto.description, dto.category, dto.targetAudience, courseId],
    );
    if (!rows[0]) throw new NotFoundException('Course not found');
    return rows[0];
  }

  async publishCourse(courseId: string, tenantDb: Pool) {
    const { rows } = await tenantDb.query(
      `UPDATE education_courses
       SET published=true, published_at=NOW(), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [courseId],
    );
    if (!rows[0]) throw new NotFoundException('Course not found');
    return rows[0];
  }

  async unpublishCourse(courseId: string, tenantDb: Pool) {
    const { rows } = await tenantDb.query(
      `UPDATE education_courses SET published=false, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [courseId],
    );
    if (!rows[0]) throw new NotFoundException('Course not found');
    return rows[0];
  }

  // ── Modules ──────────────────────────────────────────────────────

  async addModule(courseId: string, title: string, tenantDb: Pool) {
    const orderRes = await tenantDb.query(
      `SELECT COALESCE(MAX(order_index),0)+1 AS next FROM education_modules WHERE course_id=$1`,
      [courseId],
    );
    const { rows } = await tenantDb.query(
      `INSERT INTO education_modules (course_id, title, order_index) VALUES ($1,$2,$3) RETURNING *`,
      [courseId, title, orderRes.rows[0].next],
    );
    return rows[0];
  }

  async reorderModule(moduleId: string, direction: 'up' | 'down', tenantDb: Pool) {
    const { rows: [mod] } = await tenantDb.query(
      `SELECT * FROM education_modules WHERE id=$1`, [moduleId],
    );
    if (!mod) throw new NotFoundException('Module not found');
    const delta = direction === 'up' ? -1 : 1;
    await tenantDb.query(
      `UPDATE education_modules SET order_index=order_index+$1
       WHERE course_id=$2 AND order_index=$3`,
      [-delta, mod.course_id, mod.order_index + delta],
    );
    await tenantDb.query(
      `UPDATE education_modules SET order_index=$1 WHERE id=$2`,
      [mod.order_index + delta, moduleId],
    );
  }

  // ── Lessons ──────────────────────────────────────────────────────

  async addLesson(moduleId: string, dto: AddLessonDto, tenantDb: Pool) {
    const orderRes = await tenantDb.query(
      `SELECT COALESCE(MAX(order_index),0)+1 AS next FROM education_lessons WHERE module_id=$1`,
      [moduleId],
    );
    const { rows: [lesson] } = await tenantDb.query(
      `INSERT INTO education_lessons (module_id, content_type, duration_minutes, order_index)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [moduleId, dto.contentType, dto.durationMinutes, orderRes.rows[0].next],
    );
    // Seed the default (EN) translation immediately
    await tenantDb.query(
      `INSERT INTO education_lesson_translations (lesson_id, language_code, title, content_body)
       VALUES ($1,'en',$2,$3)`,
      [lesson.id, dto.title, dto.contentBody],
    );
    return lesson;
  }

  async upsertTranslation(lessonId: string, dto: LessonTranslationDto, tenantDb: Pool) {
    const ALLOWED = ['en','sn','nd','fr','pt','sw','zu','af'];
    if (!ALLOWED.includes(dto.languageCode)) {
      throw new BadRequestException(`Unsupported language: ${dto.languageCode}`);
    }
    const { rows } = await tenantDb.query(
      `INSERT INTO education_lesson_translations (lesson_id, language_code, title, content_body)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (lesson_id, language_code)
       DO UPDATE SET title=$3, content_body=$4
       RETURNING *`,
      [lessonId, dto.languageCode, dto.title, dto.contentBody],
    );
    return rows[0];
  }

  // ── Quiz builder ─────────────────────────────────────────────────

  async createQuiz(lessonId: string, passThreshold: number, maxAttempts: number, tenantDb: Pool) {
    const { rows } = await tenantDb.query(
      `INSERT INTO education_quizzes (lesson_id, pass_threshold, max_attempts)
       VALUES ($1,$2,$3)
       ON CONFLICT (lesson_id) DO UPDATE SET pass_threshold=$2, max_attempts=$3
       RETURNING *`,
      [lessonId, passThreshold, maxAttempts],
    );
    return rows[0];
  }

  async addQuestion(quizId: string, questionText: string, options: { text: string; isCorrect: boolean }[], tenantDb: Pool) {
    const { rows: [question] } = await tenantDb.query(
      `INSERT INTO education_quiz_questions (quiz_id, question_text, order_index)
       VALUES ($1,$2,(SELECT COALESCE(MAX(order_index),0)+1 FROM education_quiz_questions WHERE quiz_id=$1))
       RETURNING *`,
      [quizId, questionText],
    );
    for (let i = 0; i < options.length; i++) {
      await tenantDb.query(
        `INSERT INTO education_quiz_options (question_id, option_text, is_correct, order_index)
         VALUES ($1,$2,$3,$4)`,
        [question.id, options[i].text, options[i].isCorrect, i],
      );
    }
    return question;
  }

  // ── Assignment ───────────────────────────────────────────────────

  async assignToPatient(courseId: string, patientId: string, staffId: string, tenantDb: Pool) {
    const { rows } = await tenantDb.query(
      `INSERT INTO education_enrollments (patient_id, course_id, assigned_by)
       VALUES ($1,$2,$3)
       ON CONFLICT (patient_id, course_id) DO NOTHING
       RETURNING *`,
      [patientId, courseId, staffId],
    );
    return rows[0] ?? { message: 'Already enrolled' };
  }

  async assignToAll(courseId: string, staffId: string, tenantDb: Pool) {
    const { rowCount } = await tenantDb.query(
      `INSERT INTO education_enrollments (patient_id, course_id, assigned_by)
       SELECT id, $1, $2 FROM patients
       ON CONFLICT (patient_id, course_id) DO NOTHING`,
      [courseId, staffId],
    );
    return { enrolled: rowCount };
  }

  // ── Progress overview (staff view) ───────────────────────────────

  async getCourseProgress(courseId: string, tenantDb: Pool) {
    const { rows } = await tenantDb.query(`
      SELECT
        p.id AS patient_id,
        p.first_name,
        p.last_name,
        e.enrolled_at,
        e.completed_at,
        COUNT(DISTINCT lp.lesson_id)::int      AS lessons_completed,
        COUNT(DISTINCT l.id)::int               AS total_lessons,
        MAX(qa.score)                           AS best_quiz_score
      FROM education_enrollments e
      JOIN patients p ON p.id = e.patient_id
      JOIN education_modules m ON m.course_id = e.course_id
      JOIN education_lessons l ON l.module_id = m.id
      LEFT JOIN education_lesson_progress lp
        ON lp.enrollment_id = e.id AND lp.lesson_id = l.id AND lp.completed_at IS NOT NULL
      LEFT JOIN education_quiz_attempts qa ON qa.enrollment_id = e.id AND qa.passed = true
      WHERE e.course_id = $1
      GROUP BY p.id, p.first_name, p.last_name, e.enrolled_at, e.completed_at
      ORDER BY e.enrolled_at DESC
    `, [courseId]);
    return rows;
  }
}
```

### 2.3 PatientHealthEducationService (patient consumption)

`services/ehr-service/src/services/patient-health-education.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PatientHealthEducationService {

  private resolveLanguage(preferred: string): string {
    const SUPPORTED = ['en','sn','nd','fr','pt','sw','zu','af'];
    return SUPPORTED.includes(preferred) ? preferred : 'en';
  }

  async getMyCourses(patientId: string, lang: string, tenantDb: Pool) {
    const language = this.resolveLanguage(lang);
    const { rows } = await tenantDb.query(`
      SELECT
        c.id, c.title, c.description, c.category, c.target_audience,
        e.id AS enrollment_id, e.enrolled_at, e.completed_at,
        COUNT(DISTINCT l.id)::int AS total_lessons,
        COUNT(DISTINCT lp.lesson_id)::int AS completed_lessons
      FROM education_enrollments e
      JOIN education_courses c ON c.id = e.course_id
      JOIN education_modules m ON m.course_id = c.id
      JOIN education_lessons l ON l.module_id = m.id
      LEFT JOIN education_lesson_progress lp
        ON lp.enrollment_id = e.id AND lp.lesson_id = l.id AND lp.completed_at IS NOT NULL
      WHERE e.patient_id = $1 AND c.published = true
      GROUP BY c.id, e.id
      ORDER BY e.enrolled_at DESC
    `, [patientId]);
    return rows.map(r => ({
      ...r,
      progressPct: r.total_lessons > 0
        ? Math.round((r.completed_lessons / r.total_lessons) * 100)
        : 0,
    }));
  }

  async getBrowsableCourses(patientId: string, lang: string, tenantDb: Pool) {
    const { rows } = await tenantDb.query(`
      SELECT c.id, c.title, c.description, c.category, c.target_audience,
             COUNT(DISTINCT m.id)::int AS module_count,
             COUNT(DISTINCT l.id)::int AS lesson_count
      FROM education_courses c
      LEFT JOIN education_modules m ON m.course_id = c.id
      LEFT JOIN education_lessons l ON l.module_id = m.id
      WHERE c.published = true
        AND c.id NOT IN (
          SELECT course_id FROM education_enrollments WHERE patient_id = $1
        )
      GROUP BY c.id
      ORDER BY c.published_at DESC
    `, [patientId]);
    return rows;
  }

  async getCourseContent(patientId: string, courseId: string, lang: string, tenantDb: Pool) {
    const language = this.resolveLanguage(lang);

    const { rows: [course] } = await tenantDb.query(
      `SELECT * FROM education_courses WHERE id=$1 AND published=true`, [courseId],
    );
    if (!course) throw new NotFoundException('Course not found');

    const { rows: [enrollment] } = await tenantDb.query(
      `SELECT * FROM education_enrollments WHERE patient_id=$1 AND course_id=$2`,
      [patientId, courseId],
    );

    const { rows: modules } = await tenantDb.query(
      `SELECT * FROM education_modules WHERE course_id=$1 ORDER BY order_index`, [courseId],
    );

    for (const mod of modules) {
      const { rows: lessons } = await tenantDb.query(
        `SELECT l.*,
           COALESCE(
             (SELECT title FROM education_lesson_translations WHERE lesson_id=l.id AND language_code=$2),
             (SELECT title FROM education_lesson_translations WHERE lesson_id=l.id AND language_code='en')
           ) AS title,
           COALESCE(
             (SELECT content_body FROM education_lesson_translations WHERE lesson_id=l.id AND language_code=$2),
             (SELECT content_body FROM education_lesson_translations WHERE lesson_id=l.id AND language_code='en')
           ) AS content_body,
           lp.completed_at AS completed_at,
           q.id AS quiz_id, q.pass_threshold, q.max_attempts,
           (SELECT COUNT(*) FROM education_quiz_attempts qa
            WHERE qa.quiz_id=q.id AND qa.enrollment_id=$3) AS attempts_used,
           (SELECT passed FROM education_quiz_attempts qa
            WHERE qa.quiz_id=q.id AND qa.enrollment_id=$3 AND qa.passed=true LIMIT 1) AS quiz_passed
         FROM education_lessons l
         LEFT JOIN education_lesson_progress lp
           ON lp.lesson_id=l.id AND lp.enrollment_id=$3
         LEFT JOIN education_quizzes q ON q.lesson_id=l.id
         WHERE l.module_id=$1
         ORDER BY l.order_index`,
        [mod.id, language, enrollment?.id ?? null],
      );
      mod.lessons = lessons;
    }

    return { course, enrollment, modules };
  }

  async selfEnroll(patientId: string, courseId: string, tenantDb: Pool) {
    const { rows: [course] } = await tenantDb.query(
      `SELECT id FROM education_courses WHERE id=$1 AND published=true`, [courseId],
    );
    if (!course) throw new NotFoundException('Course not found or not published');
    const { rows } = await tenantDb.query(
      `INSERT INTO education_enrollments (patient_id, course_id)
       VALUES ($1,$2) ON CONFLICT (patient_id, course_id) DO NOTHING RETURNING *`,
      [patientId, courseId],
    );
    return rows[0] ?? { message: 'Already enrolled' };
  }

  async markLessonComplete(patientId: string, lessonId: string, tenantDb: Pool) {
    const { rows: [enrollment] } = await tenantDb.query(
      `SELECT e.id, e.course_id FROM education_enrollments e
       JOIN education_modules m ON m.course_id = e.course_id
       JOIN education_lessons l ON l.module_id = m.id AND l.id = $2
       WHERE e.patient_id = $1`,
      [patientId, lessonId],
    );
    if (!enrollment) throw new NotFoundException('Enrollment not found for this lesson');

    await tenantDb.query(
      `INSERT INTO education_lesson_progress (enrollment_id, lesson_id, completed_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (enrollment_id, lesson_id)
       DO UPDATE SET completed_at=COALESCE(education_lesson_progress.completed_at, NOW())`,
      [enrollment.id, lessonId],
    );

    // Check if all lessons in course are now complete → mark course complete
    const { rows: [counts] } = await tenantDb.query(`
      SELECT
        COUNT(DISTINCT l.id)::int AS total,
        COUNT(DISTINCT lp.lesson_id)::int AS done
      FROM education_modules m
      JOIN education_lessons l ON l.module_id = m.id
      LEFT JOIN education_lesson_progress lp
        ON lp.lesson_id = l.id AND lp.enrollment_id = $1 AND lp.completed_at IS NOT NULL
      WHERE m.course_id = $2
    `, [enrollment.id, enrollment.course_id]);

    if (counts.total > 0 && counts.total === counts.done) {
      await tenantDb.query(
        `UPDATE education_enrollments SET completed_at=NOW() WHERE id=$1 AND completed_at IS NULL`,
        [enrollment.id],
      );
    }

    return { lessonId, completed: true };
  }

  async submitQuizAttempt(patientId: string, quizId: string, answers: { questionId: string; selectedOptionId: string }[], tenantDb: Pool) {
    const { rows: [quiz] } = await tenantDb.query(
      `SELECT q.*, l.id AS lesson_id, m.course_id
       FROM education_quizzes q
       JOIN education_lessons l ON l.id = q.lesson_id
       JOIN education_modules m ON m.id = l.module_id
       WHERE q.id = $1`,
      [quizId],
    );
    if (!quiz) throw new NotFoundException('Quiz not found');

    const { rows: [enrollment] } = await tenantDb.query(
      `SELECT id FROM education_enrollments WHERE patient_id=$1 AND course_id=$2`,
      [patientId, quiz.course_id],
    );
    if (!enrollment) throw new BadRequestException('Not enrolled in this course');

    const { rows: [usedCount] } = await tenantDb.query(
      `SELECT COUNT(*)::int AS n FROM education_quiz_attempts WHERE enrollment_id=$1 AND quiz_id=$2`,
      [enrollment.id, quizId],
    );
    if (usedCount.n >= quiz.max_attempts) {
      throw new BadRequestException(`Maximum attempts (${quiz.max_attempts}) reached`);
    }

    // Score: count correct answers
    const { rows: questions } = await tenantDb.query(
      `SELECT qq.id AS question_id, qo.id AS correct_option_id
       FROM education_quiz_questions qq
       JOIN education_quiz_options qo ON qo.question_id = qq.id AND qo.is_correct = true
       WHERE qq.quiz_id = $1`,
      [quizId],
    );

    let correct = 0;
    for (const q of questions) {
      const submitted = answers.find(a => a.questionId === q.question_id);
      if (submitted?.selectedOptionId === q.correct_option_id) correct++;
    }
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= quiz.pass_threshold;

    const { rows: [attempt] } = await tenantDb.query(
      `INSERT INTO education_quiz_attempts (enrollment_id, quiz_id, score, passed, answers)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [enrollment.id, quizId, score, passed, JSON.stringify(answers)],
    );

    return { score, passed, passThreshold: quiz.pass_threshold, attempt };
  }
}
```

### 2.4 Controllers

**Staff authoring controller** — `services/ehr-service/src/controllers/health-education.controller.ts`

```typescript
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HealthEducatorGuard } from '../guards/health-educator.guard';
import { HealthEducationService } from '../services/health-education.service';

@Controller('health-education')
@UseGuards(JwtAuthGuard, HealthEducatorGuard)
export class HealthEducationController {
  constructor(private readonly edu: HealthEducationService) {}

  @Get('courses')
  listCourses(@Req() req) {
    return this.edu.listCourses(req.tenantDb);
  }

  @Post('courses')
  createCourse(@Body() dto, @Req() req) {
    return this.edu.createCourse(dto, req.user.sub, req.tenantDb);
  }

  @Patch('courses/:id')
  updateCourse(@Param('id') id: string, @Body() dto, @Req() req) {
    return this.edu.updateCourse(id, dto, req.tenantDb);
  }

  @Post('courses/:id/publish')
  publishCourse(@Param('id') id: string, @Req() req) {
    return this.edu.publishCourse(id, req.tenantDb);
  }

  @Post('courses/:id/unpublish')
  unpublishCourse(@Param('id') id: string, @Req() req) {
    return this.edu.unpublishCourse(id, req.tenantDb);
  }

  @Post('courses/:courseId/modules')
  addModule(@Param('courseId') courseId: string, @Body() body, @Req() req) {
    return this.edu.addModule(courseId, body.title, req.tenantDb);
  }

  @Post('modules/:moduleId/lessons')
  addLesson(@Param('moduleId') moduleId: string, @Body() dto, @Req() req) {
    return this.edu.addLesson(moduleId, dto, req.tenantDb);
  }

  @Post('lessons/:lessonId/translations')
  upsertTranslation(@Param('lessonId') lessonId: string, @Body() dto, @Req() req) {
    return this.edu.upsertTranslation(lessonId, dto, req.tenantDb);
  }

  @Post('lessons/:lessonId/quiz')
  createQuiz(@Param('lessonId') lessonId: string, @Body() body, @Req() req) {
    return this.edu.createQuiz(lessonId, body.passThreshold ?? 70, body.maxAttempts ?? 3, req.tenantDb);
  }

  @Post('quizzes/:quizId/questions')
  addQuestion(@Param('quizId') quizId: string, @Body() body, @Req() req) {
    return this.edu.addQuestion(quizId, body.questionText, body.options, req.tenantDb);
  }

  @Post('courses/:courseId/assign/:patientId')
  assignToPatient(@Param('courseId') courseId: string, @Param('patientId') patientId: string, @Req() req) {
    return this.edu.assignToPatient(courseId, patientId, req.user.sub, req.tenantDb);
  }

  @Post('courses/:courseId/assign-all')
  assignToAll(@Param('courseId') courseId: string, @Req() req) {
    return this.edu.assignToAll(courseId, req.user.sub, req.tenantDb);
  }

  @Get('courses/:courseId/progress')
  getCourseProgress(@Param('courseId') courseId: string, @Req() req) {
    return this.edu.getCourseProgress(courseId, req.tenantDb);
  }
}
```

**Patient-facing controller** — `services/ehr-service/src/controllers/patient-portal-health-education.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { PatientHealthEducationService } from '../services/patient-health-education.service';

@Controller('patient-portal/education')
@UseGuards(PatientJwtAuthGuard)
export class PatientPortalHealthEducationController {
  constructor(private readonly edu: PatientHealthEducationService) {}

  @Get('courses')
  async getCourses(@Req() req, @Query('lang') lang: string) {
    const patientId = req.user.sub;
    const language = lang ?? 'en';
    const [enrolled, browsable] = await Promise.all([
      this.edu.getMyCourses(patientId, language, req.tenantDb),
      this.edu.getBrowsableCourses(patientId, language, req.tenantDb),
    ]);
    return { enrolled, browsable };
  }

  @Get('courses/:courseId')
  getCourseContent(@Param('courseId') courseId: string, @Query('lang') lang: string, @Req() req) {
    return this.edu.getCourseContent(req.user.sub, courseId, lang ?? 'en', req.tenantDb);
  }

  @Post('courses/:courseId/enroll')
  selfEnroll(@Param('courseId') courseId: string, @Req() req) {
    return this.edu.selfEnroll(req.user.sub, courseId, req.tenantDb);
  }

  @Post('lessons/:lessonId/complete')
  markComplete(@Param('lessonId') lessonId: string, @Req() req) {
    return this.edu.markLessonComplete(req.user.sub, lessonId, req.tenantDb);
  }

  @Post('quizzes/:quizId/attempt')
  submitAttempt(@Param('quizId') quizId: string, @Body() body, @Req() req) {
    return this.edu.submitQuizAttempt(req.user.sub, quizId, body.answers, req.tenantDb);
  }
}
```

### 2.5 Module registration

Add to `controllers: []` in `services/ehr-service/src/ehr.module.ts`:

```typescript
HealthEducationController,
PatientPortalHealthEducationController,
```

Add to `providers: []`:

```typescript
HealthEducationService,
PatientHealthEducationService,
HealthEducatorGuard,
```

---

## Phase 3 — EHR Frontend (Authoring Interface)

All pages follow the existing Tailwind + React pattern: page container → header row with title + action buttons → card/table body. No new UI libraries.

### 3.1 Course list page

`ehr-frontend/src/pages/HealthEducationPage.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Course {
  id: string; title: string; category: string; published: boolean;
  enrolled_count: number; lesson_count: number;
}

export default function HealthEducationPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('HIV');

  useEffect(() => { api.get('/health-education/courses').then(r => setCourses(r.data)); }, []);

  async function handleCreate() {
    await api.post('/health-education/courses', {
      title: newTitle, category: newCategory, defaultLanguageCode: 'en',
    });
    setCreating(false);
    setNewTitle('');
    const r = await api.get('/health-education/courses');
    setCourses(r.data);
  }

  const CATEGORIES = ['HIV', 'Maternal', 'Nutrition', 'Medication', 'Preventive', 'Mental Health', 'General'];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Health Education</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + New Course
        </button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl shadow p-4 mb-6 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Course Title</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. Understanding Your HIV Medication"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              className="border rounded px-3 py-2 text-sm"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
            Create
          </button>
          <button onClick={() => setCreating(false)} className="text-gray-500 text-sm px-2">
            Cancel
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {courses.map(course => (
          <div key={course.id} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">{course.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  course.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {course.published ? 'Published' : 'Draft'}
                </span>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                  {course.category}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {course.lesson_count} lessons · {course.enrolled_count} patients enrolled
              </p>
            </div>
            <a
              href={`/health-education/${course.id}`}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              Edit →
            </a>
          </div>
        ))}
        {courses.length === 0 && (
          <p className="text-center text-gray-400 py-12">No courses yet. Create your first course above.</p>
        )}
      </div>
    </div>
  );
}
```

### 3.2 Course editor page

`ehr-frontend/src/pages/CourseEditorPage.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import LessonEditorModal from '../components/LessonEditorModal';
import TranslationModal from '../components/TranslationModal';
import QuizBuilderModal from '../components/QuizBuilderModal';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sn', label: 'ChiShona' },
  { code: 'nd', label: 'IsiNdebele' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'sw', label: 'Kiswahili' },
];

export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [lessonModal, setLessonModal] = useState<{ moduleId: string } | null>(null);
  const [translationModal, setTranslationModal] = useState<{ lessonId: string } | null>(null);
  const [quizModal, setQuizModal] = useState<{ lessonId: string } | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  async function load() {
    const [cr, mr] = await Promise.all([
      api.get(`/health-education/courses/${id}`),
      api.get(`/health-education/courses/${id}/modules`),
    ]);
    setCourse(cr.data);
    setModules(mr.data);
  }

  useEffect(() => { load(); }, [id]);

  async function addModule() {
    if (!newModuleTitle.trim()) return;
    await api.post(`/health-education/courses/${id}/modules`, { title: newModuleTitle });
    setNewModuleTitle('');
    load();
  }

  async function togglePublish() {
    const endpoint = course.published ? 'unpublish' : 'publish';
    await api.post(`/health-education/courses/${id}/${endpoint}`);
    load();
  }

  async function assignAll() {
    if (!window.confirm('Enroll all current patients in this course?')) return;
    const r = await api.post(`/health-education/courses/${id}/assign-all`);
    alert(`Enrolled ${r.data.enrolled} new patients`);
  }

  if (!course) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/health-education" className="text-sm text-gray-400 hover:underline">← Courses</a>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{course.title}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            course.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {course.published ? 'Published' : 'Draft'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = `/health-education/${id}/progress`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm"
          >
            Progress Dashboard
          </button>
          <button
            onClick={assignAll}
            className="border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm"
          >
            Assign to All Patients
          </button>
          <button
            onClick={togglePublish}
            className={`px-4 py-2 rounded-lg text-sm text-white ${
              course.published ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {course.published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Module list */}
      <div className="space-y-4 mb-6">
        {modules.map((mod, mi) => (
          <div key={mod.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">
                Module {mi + 1}: {mod.title}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => api.post(`/health-education/modules/${mod.id}/reorder`, { direction: 'up' }).then(load)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                >↑</button>
                <button
                  onClick={() => api.post(`/health-education/modules/${mod.id}/reorder`, { direction: 'down' }).then(load)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                >↓</button>
              </div>
            </div>

            {/* Lessons */}
            <div className="space-y-2 pl-2">
              {(mod.lessons ?? []).map((lesson: any) => (
                <div key={lesson.id} className="flex items-center justify-between py-1 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {lesson.content_type === 'video_url' ? '▶' : lesson.content_type === 'pdf_url' ? '📄' : '📝'}
                    </span>
                    <span className="text-sm text-gray-700">{lesson.title ?? '(untitled)'}</span>
                    {lesson.quiz_id && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-1.5 rounded">Quiz</span>
                    )}
                    {lesson.duration_minutes && (
                      <span className="text-xs text-gray-400">{lesson.duration_minutes} min</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTranslationModal({ lessonId: lesson.id })}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Translations
                    </button>
                    {!lesson.quiz_id && (
                      <button
                        onClick={() => setQuizModal({ lessonId: lesson.id })}
                        className="text-xs text-purple-500 hover:underline"
                      >
                        + Quiz
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setLessonModal({ moduleId: mod.id })}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                + Add Lesson
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add module */}
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm"
          placeholder="New module title"
          value={newModuleTitle}
          onChange={e => setNewModuleTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addModule()}
        />
        <button onClick={addModule} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
          Add Module
        </button>
      </div>

      {lessonModal && (
        <LessonEditorModal
          moduleId={lessonModal.moduleId}
          onSave={() => { setLessonModal(null); load(); }}
          onClose={() => setLessonModal(null)}
        />
      )}
      {translationModal && (
        <TranslationModal
          lessonId={translationModal.lessonId}
          languages={LANGUAGES}
          onClose={() => { setTranslationModal(null); load(); }}
        />
      )}
      {quizModal && (
        <QuizBuilderModal
          lessonId={quizModal.lessonId}
          onClose={() => { setQuizModal(null); load(); }}
        />
      )}
    </div>
  );
}
```

### 3.3 Lesson editor modal

`ehr-frontend/src/components/LessonEditorModal.tsx`

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';

type ContentType = 'text' | 'video_url' | 'pdf_url';

export default function LessonEditorModal({ moduleId, onSave, onClose }: {
  moduleId: string; onSave: () => void; onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<ContentType>('text');
  const [contentBody, setContentBody] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await api.post(`/health-education/modules/${moduleId}/lessons`, {
      title, contentType, contentBody, durationMinutes: duration ? Number(duration) : null,
    });
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">New Lesson</h2>

        <label className="block text-xs text-gray-500 mb-1">Title</label>
        <input
          className="w-full border rounded px-3 py-2 text-sm mb-3"
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. What is ARV therapy?"
        />

        <label className="block text-xs text-gray-500 mb-1">Content Type</label>
        <div className="flex gap-2 mb-3">
          {(['text', 'video_url', 'pdf_url'] as ContentType[]).map(t => (
            <button
              key={t}
              onClick={() => setContentType(t)}
              className={`px-3 py-1.5 rounded text-sm border ${
                contentType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'
              }`}
            >
              {t === 'text' ? 'Text / Markdown' : t === 'video_url' ? 'Video URL' : 'PDF URL'}
            </button>
          ))}
        </div>

        <label className="block text-xs text-gray-500 mb-1">
          {contentType === 'text' ? 'Content (Markdown)' : 'URL'}
        </label>
        {contentType === 'text' ? (
          <textarea
            className="w-full border rounded px-3 py-2 text-sm mb-3 font-mono"
            rows={6}
            value={contentBody}
            onChange={e => setContentBody(e.target.value)}
            placeholder="Write lesson content in Markdown..."
          />
        ) : (
          <input
            className="w-full border rounded px-3 py-2 text-sm mb-3"
            value={contentBody}
            onChange={e => setContentBody(e.target.value)}
            placeholder={contentType === 'video_url' ? 'https://...' : 'https://.../file.pdf'}
          />
        )}

        <label className="block text-xs text-gray-500 mb-1">Duration (minutes, optional)</label>
        <input
          type="number" min="1"
          className="w-full border rounded px-3 py-2 text-sm mb-4"
          value={duration} onChange={e => setDuration(e.target.value)}
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim() || !contentBody.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Lesson'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3.4 Translation modal

`ehr-frontend/src/components/TranslationModal.tsx`

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';

export default function TranslationModal({ lessonId, languages, onClose }: {
  lessonId: string;
  languages: { code: string; label: string }[];
  onClose: () => void;
}) {
  const [lang, setLang] = useState(languages[1]?.code ?? 'sn');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await api.post(`/health-education/lessons/${lessonId}/translations`, {
      languageCode: lang, title, contentBody: body,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setTitle(''); setBody('');
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Add Translation</h2>

        <div className="flex gap-2 mb-4">
          {languages.filter(l => l.code !== 'en').map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-3 py-1 rounded text-sm border ${
                lang === l.code ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <label className="block text-xs text-gray-500 mb-1">Title in {languages.find(l => l.code === lang)?.label}</label>
        <input
          className="w-full border rounded px-3 py-2 text-sm mb-3"
          value={title} onChange={e => setTitle(e.target.value)}
        />

        <label className="block text-xs text-gray-500 mb-1">Content</label>
        <textarea
          className="w-full border rounded px-3 py-2 text-sm mb-4 font-mono"
          rows={6} value={body} onChange={e => setBody(e.target.value)}
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600">Done</button>
          <button
            onClick={save}
            disabled={saving || !title.trim() || !body.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Translation'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3.5 Quiz builder modal

`ehr-frontend/src/components/QuizBuilderModal.tsx`

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';

interface Option { text: string; isCorrect: boolean; }
interface Question { questionText: string; options: Option[]; }

export default function QuizBuilderModal({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const [passThreshold, setPassThreshold] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [questions, setQuestions] = useState<Question[]>([
    { questionText: '', options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ]},
  ]);
  const [saving, setSaving] = useState(false);

  function updateQuestion(qi: number, text: string) {
    setQuestions(qs => qs.map((q, i) => i === qi ? { ...q, questionText: text } : q));
  }
  function updateOption(qi: number, oi: number, text: string) {
    setQuestions(qs => qs.map((q, i) => i !== qi ? q : {
      ...q, options: q.options.map((o, j) => j === oi ? { ...o, text } : o),
    }));
  }
  function setCorrect(qi: number, oi: number) {
    setQuestions(qs => qs.map((q, i) => i !== qi ? q : {
      ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oi })),
    }));
  }
  function addQuestion() {
    setQuestions(qs => [...qs, {
      questionText: '',
      options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }],
    }]);
  }

  async function save() {
    setSaving(true);
    const quizRes = await api.post(`/health-education/lessons/${lessonId}/quiz`, {
      passThreshold, maxAttempts,
    });
    const quizId = quizRes.data.id;
    for (const q of questions) {
      if (q.questionText.trim()) {
        await api.post(`/health-education/quizzes/${quizId}/questions`, {
          questionText: q.questionText,
          options: q.options.filter(o => o.text.trim()),
        });
      }
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4">
        <h2 className="text-lg font-semibold mb-4">Build Quiz</h2>

        <div className="flex gap-4 mb-5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pass Threshold (%)</label>
            <input
              type="number" min="1" max="100"
              className="border rounded px-3 py-1.5 text-sm w-24"
              value={passThreshold} onChange={e => setPassThreshold(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max Attempts</label>
            <input
              type="number" min="1" max="10"
              className="border rounded px-3 py-1.5 text-sm w-24"
              value={maxAttempts} onChange={e => setMaxAttempts(Number(e.target.value))}
            />
          </div>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="border rounded-lg p-4 mb-4">
            <label className="block text-xs text-gray-500 mb-1">Question {qi + 1}</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm mb-3"
              value={q.questionText} onChange={e => updateQuestion(qi, e.target.value)}
              placeholder="Enter question..."
            />
            <p className="text-xs text-gray-400 mb-2">Click circle to mark correct answer</p>
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setCorrect(qi, oi)}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                    o.isCorrect ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}
                />
                <input
                  className="flex-1 border rounded px-3 py-1.5 text-sm"
                  value={o.text} onChange={e => updateOption(qi, oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                />
              </div>
            ))}
          </div>
        ))}

        <button onClick={addQuestion} className="text-blue-600 text-sm hover:underline mb-4">
          + Add Question
        </button>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600">Cancel</button>
          <button
            onClick={save} disabled={saving}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3.6 Progress dashboard

`ehr-frontend/src/pages/CourseProgressPage.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';

export default function CourseProgressPage() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all');

  useEffect(() => {
    api.get(`/health-education/courses/${id}/progress`).then(r => setRows(r.data));
  }, [id]);

  const filtered = rows.filter(r => {
    if (filter === 'completed') return !!r.completed_at;
    if (filter === 'in_progress') return !r.completed_at && r.lessons_completed > 0;
    return true;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a href={`/health-education/${id}`} className="text-sm text-gray-400 hover:underline">← Editor</a>
        <h1 className="text-2xl font-bold text-gray-800">Patient Progress</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'completed', 'in_progress'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm border ${
              filter === f ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'
            }`}
          >
            {f === 'all' ? 'All' : f === 'completed' ? 'Completed' : 'In Progress'}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">{filtered.length} patients</span>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Patient</th>
              <th className="px-4 py-3 text-left">Enrolled</th>
              <th className="px-4 py-3 text-left">Progress</th>
              <th className="px-4 py-3 text-left">Best Quiz</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(r => {
              const pct = r.total_lessons > 0
                ? Math.round((r.lessons_completed / r.total_lessons) * 100)
                : 0;
              return (
                <tr key={r.patient_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.first_name} {r.last_name}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(r.enrolled_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.best_quiz_score !== null
                      ? <span className={r.best_quiz_score >= 70 ? 'text-green-600' : 'text-red-500'}>
                          {r.best_quiz_score}%
                        </span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {r.completed_at
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completed</span>
                      : r.lessons_completed > 0
                        ? <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">In Progress</span>
                        : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Not Started</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">No patients match this filter.</p>
        )}
      </div>
    </div>
  );
}
```

### 3.7 EHR frontend routing and nav

In `ehr-frontend/src/App.tsx`, add routes:

```tsx
<Route path="/health-education" element={<HealthEducationPage />} />
<Route path="/health-education/:id" element={<CourseEditorPage />} />
<Route path="/health-education/:id/progress" element={<CourseProgressPage />} />
```

In `ehr-frontend/src/components/Sidebar.tsx`, add nav item (render only when `staff.isHealthEducator`):

```tsx
{user?.isHealthEducator && (
  <SidebarItem icon="📚" label="Health Education" href="/health-education" />
)}
```

---

## Phase 4 — Patient Portal (Re-wiring PP-S22)

PP-S22 already ships `HealthEducationPage.tsx` and the article browser. This phase re-wires the data source from the generic endpoint to the tenant-specific one and adds enrollment + progress UI.

### 4.1 API functions

Add to `patient-portal/src/services/api.ts`:

```typescript
export const getMyEducationCourses = (lang: string) =>
  apiClient.get(`/patient-portal/education/courses?lang=${lang}`);

export const getEducationCourse = (courseId: string, lang: string) =>
  apiClient.get(`/patient-portal/education/courses/${courseId}?lang=${lang}`);

export const enrollInCourse = (courseId: string) =>
  apiClient.post(`/patient-portal/education/courses/${courseId}/enroll`);

export const markLessonComplete = (lessonId: string) =>
  apiClient.post(`/patient-portal/education/lessons/${lessonId}/complete`);

export const submitQuizAttempt = (quizId: string, answers: { questionId: string; selectedOptionId: string }[]) =>
  apiClient.post(`/patient-portal/education/quizzes/${quizId}/attempt`, { answers });
```

### 4.2 Updated HealthEducationPage (from PP-S22)

Replace the generic API call with the tenant-specific endpoint. The existing category tab strip, article grid, and detail modal remain unchanged — only the data source changes, and a progress bar is added to each enrolled course card:

```tsx
// In HealthEducationPage.tsx — replace the useEffect fetch:
const lang = i18n.language;
const { data } = await getMyEducationCourses(lang);
setEnrolled(data.enrolled);
setBrowsable(data.browsable);

// Enrolled course card — add below the title:
<div className="mt-2">
  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
    <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
    <span>{course.progressPct}%</span>
  </div>
  <div className="w-full bg-gray-100 rounded-full h-1.5">
    <div
      className="bg-blue-500 h-1.5 rounded-full transition-all"
      style={{ width: `${course.progressPct}%` }}
    />
  </div>
  {course.completed_at && (
    <p className="text-xs text-green-600 mt-1 font-medium">Course complete ✓</p>
  )}
</div>
```

### 4.3 Course reader page

`patient-portal/src/pages/CourseReaderPage.tsx` — new page showing module accordion with lesson content and quiz:

```tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { getEducationCourse, markLessonComplete, submitQuizAttempt } from '../services/api';

export default function CourseReaderPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { i18n, t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);

  async function load() {
    const r = await getEducationCourse(courseId!, i18n.language);
    setData(r.data);
  }

  useEffect(() => { load(); }, [courseId]);

  async function completeLesson(lessonId: string) {
    await markLessonComplete(lessonId);
    load();
  }

  async function submitQuiz(quizId: string) {
    const answers = Object.entries(quizAnswers).map(([questionId, selectedOptionId]) => ({
      questionId, selectedOptionId,
    }));
    const r = await submitQuizAttempt(quizId, answers);
    setQuizResult(r.data);
  }

  if (!data) return <div className="p-6 text-gray-400">Loading...</div>;

  const { course, modules } = data;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <a href="/education" className="text-sm text-gray-400 hover:underline">← {t('education.back')}</a>
      <h1 className="text-2xl font-bold text-gray-800 mt-2 mb-6">{course.title}</h1>

      {modules.map((mod: any, mi: number) => (
        <div key={mod.id} className="mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-2">
            {mi + 1}. {mod.title}
          </h2>
          <div className="space-y-2">
            {mod.lessons.map((lesson: any) => (
              <div key={lesson.id} className="bg-white rounded-xl shadow p-4">
                <button
                  className="w-full text-left flex items-center justify-between"
                  onClick={() => setActiveLesson(activeLesson?.id === lesson.id ? null : lesson)}
                >
                  <div className="flex items-center gap-2">
                    {lesson.completed_at
                      ? <span className="text-green-500 text-sm">✓</span>
                      : <span className="w-4 h-4 rounded-full border-2 border-gray-300 inline-block" />
                    }
                    <span className="text-sm font-medium text-gray-700">{lesson.title}</span>
                    {lesson.duration_minutes && (
                      <span className="text-xs text-gray-400">{lesson.duration_minutes} min</span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs">{activeLesson?.id === lesson.id ? '▲' : '▼'}</span>
                </button>

                {activeLesson?.id === lesson.id && (
                  <div className="mt-4 border-t pt-4">
                    {lesson.content_type === 'text' && (
                      <div className="prose prose-sm max-w-none text-gray-700">
                        <ReactMarkdown>{lesson.content_body}</ReactMarkdown>
                      </div>
                    )}
                    {lesson.content_type === 'video_url' && (
                      <div className="aspect-video">
                        <iframe
                          src={lesson.content_body} className="w-full h-full rounded"
                          allow="fullscreen" title={lesson.title}
                        />
                      </div>
                    )}
                    {lesson.content_type === 'pdf_url' && (
                      <a href={lesson.content_body} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"
                      >
                        📄 {t('education.openPdf')}
                      </a>
                    )}

                    {/* Quiz block */}
                    {lesson.quiz_id && !lesson.quiz_passed && (
                      <div className="mt-4 bg-purple-50 rounded-lg p-4">
                        <p className="text-sm font-semibold text-purple-700 mb-3">
                          {t('education.quiz')} — {t('education.passThreshold', { pct: lesson.pass_threshold })}
                        </p>
                        {/* questions rendered via separate fetch or embedded in lesson data */}
                        {quizResult && (
                          <div className={`text-sm font-medium mb-2 ${quizResult.passed ? 'text-green-600' : 'text-red-500'}`}>
                            {quizResult.passed
                              ? `${t('education.quizPassed')} — ${quizResult.score}%`
                              : `${t('education.quizFailed')} — ${quizResult.score}%`
                            }
                          </div>
                        )}
                        {!quizResult && (
                          <button
                            onClick={() => submitQuiz(lesson.quiz_id)}
                            className="bg-purple-600 text-white px-4 py-2 rounded text-sm"
                          >
                            {t('education.submitQuiz')}
                          </button>
                        )}
                      </div>
                    )}
                    {lesson.quiz_passed && (
                      <p className="mt-3 text-xs text-green-600">✓ {t('education.quizPassed')}</p>
                    )}

                    {!lesson.completed_at && (
                      <button
                        onClick={() => completeLesson(lesson.id)}
                        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded text-sm"
                      >
                        {t('education.markComplete')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

Add route in `patient-portal/src/App.tsx`:

```tsx
<Route path="/education/courses/:courseId" element={<CourseReaderPage />} />
```

Install `react-markdown` (already likely present; if not):

```bash
cd patient-portal && npm install react-markdown
```

### 4.4 Translation keys

Add to all three locale files (`en.json`, `sn.json`, `nd.json`):

```json
"education": {
  "back": "Back to Education",
  "openPdf": "Open PDF document",
  "quiz": "Knowledge Check",
  "passThreshold": "Pass mark: {{pct}}%",
  "quizPassed": "Passed",
  "quizFailed": "Try again",
  "submitQuiz": "Submit Answers",
  "markComplete": "Mark as Complete",
  "enrolled": "My Courses",
  "browse": "Explore Courses",
  "enroll": "Start Course",
  "progress": "Progress",
  "complete": "Complete"
}
```

---

## Phase 5 — Mobile (Re-wiring S19)

S19 ships `PatientEducationScreen` with category tabs, article FlatList, and WebView modal. This phase re-wires it to the tenant-specific endpoint and adds a course reader screen.

### 5.1 API additions

Add to `mobile/src/services/api.ts`:

```typescript
export const getMyEducationCourses = (lang: string) =>
  api.get(`/patient-portal/education/courses?lang=${lang}`);

export const getEducationCourse = (courseId: string, lang: string) =>
  api.get(`/patient-portal/education/courses/${courseId}?lang=${lang}`);

export const enrollInCourse = (courseId: string) =>
  api.post(`/patient-portal/education/courses/${courseId}/enroll`);

export const markLessonComplete = (lessonId: string) =>
  api.post(`/patient-portal/education/lessons/${lessonId}/complete`);

export const submitQuizAttempt = (quizId: string, answers: { questionId: string; selectedOptionId: string }[]) =>
  api.post(`/patient-portal/education/quizzes/${quizId}/attempt`, { answers });
```

### 5.2 Updated PatientEducationScreen (S19 re-wire)

Replace the generic fetch in the existing screen with:

```typescript
// Replace old fetch with:
const lang = i18n.language;
const response = await getMyEducationCourses(lang);
const { enrolled, browsable } = response.data;
setEnrolledCourses(enrolled);
setBrowsableCourses(browsable);
```

The existing category tabs, FlatList, and card layout are preserved. Course cards gain a progress bar using Animated or a simple View:

```tsx
{/* Progress bar under each enrolled course card */}
<View style={{ marginTop: 6 }}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
      {item.completed_lessons}/{item.total_lessons} lessons
    </Text>
    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{item.progressPct}%</Text>
  </View>
  <View style={{ height: 4, backgroundColor: '#F3F4F6', borderRadius: 2 }}>
    <View style={{
      height: 4, backgroundColor: '#3B82F6', borderRadius: 2,
      width: `${item.progressPct}%`,
    }} />
  </View>
</View>
```

### 5.3 Course reader screen

`mobile/src/screens/patient/EducationCourseScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getEducationCourse, markLessonComplete, submitQuizAttempt, enrollInCourse } from '../../services/api';

export default function EducationCourseScreen({ route, navigation }: any) {
  const { courseId, courseTitle } = route.params;
  const { i18n, t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const r = await getEducationCourse(courseId, i18n.language);
    setData(r.data);
  }

  useEffect(() => { load(); }, [courseId]);

  async function handleEnroll() {
    await enrollInCourse(courseId);
    load();
  }

  async function handleComplete(lessonId: string) {
    await markLessonComplete(lessonId);
    load();
  }

  async function handleQuiz(quizId: string, passThreshold: number) {
    // For simplicity in mobile, navigate to a dedicated QuizScreen
    navigation.navigate('PHEducationQuiz', { quizId, passThreshold, onDone: load });
  }

  if (!data) return (
    <View style={styles.center}><Text style={styles.loading}>Loading...</Text></View>
  );

  const { course, enrollment, modules } = data;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{course.title}</Text>
      <Text style={styles.meta}>{course.category} · {course.target_audience}</Text>

      {!enrollment && (
        <TouchableOpacity style={styles.enrollBtn} onPress={handleEnroll}>
          <Text style={styles.enrollBtnText}>{t('education.enroll')}</Text>
        </TouchableOpacity>
      )}

      {modules.map((mod: any, mi: number) => (
        <View key={mod.id} style={styles.moduleCard}>
          <Text style={styles.moduleTitle}>{mi + 1}. {mod.title}</Text>
          {mod.lessons.map((lesson: any) => (
            <View key={lesson.id}>
              <TouchableOpacity
                style={styles.lessonRow}
                onPress={() => setExpanded(expanded === lesson.id ? null : lesson.id)}
              >
                <Text style={lesson.completed_at ? styles.lessonDone : styles.lessonPending}>
                  {lesson.completed_at ? '✓ ' : '○ '}{lesson.title}
                </Text>
                {lesson.duration_minutes > 0 && (
                  <Text style={styles.duration}>{lesson.duration_minutes}m</Text>
                )}
              </TouchableOpacity>

              {expanded === lesson.id && (
                <View style={styles.lessonBody}>
                  {lesson.content_type === 'text' && (
                    <Text style={styles.bodyText}>{lesson.content_body}</Text>
                  )}
                  {(lesson.content_type === 'video_url' || lesson.content_type === 'pdf_url') && (
                    <TouchableOpacity onPress={() => Linking.openURL(lesson.content_body)}>
                      <Text style={styles.link}>
                        {lesson.content_type === 'pdf_url' ? '📄 Open PDF' : '▶ Watch Video'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {lesson.quiz_id && !lesson.quiz_passed && enrollment && (
                    <TouchableOpacity
                      style={styles.quizBtn}
                      onPress={() => handleQuiz(lesson.quiz_id, lesson.pass_threshold)}
                    >
                      <Text style={styles.quizBtnText}>{t('education.quiz')}</Text>
                    </TouchableOpacity>
                  )}
                  {lesson.quiz_passed && (
                    <Text style={styles.quizPassed}>✓ {t('education.quizPassed')}</Text>
                  )}

                  {!lesson.completed_at && enrollment && (
                    <TouchableOpacity
                      style={styles.completeBtn}
                      onPress={() => handleComplete(lesson.id)}
                    >
                      <Text style={styles.completeBtnText}>{t('education.markComplete')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { color: '#9CA3AF' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  meta: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  enrollBtn: { backgroundColor: '#2563EB', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 16 },
  enrollBtnText: { color: '#fff', fontWeight: '600' },
  moduleCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  moduleTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  lessonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  lessonDone: { fontSize: 14, color: '#059669', flex: 1 },
  lessonPending: { fontSize: 14, color: '#374151', flex: 1 },
  duration: { fontSize: 12, color: '#9CA3AF' },
  lessonBody: { paddingVertical: 12, paddingHorizontal: 8 },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  link: { color: '#2563EB', fontSize: 14 },
  quizBtn: { backgroundColor: '#7C3AED', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  quizBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  quizPassed: { color: '#059669', fontSize: 13, marginTop: 8 },
  completeBtn: { borderColor: '#2563EB', borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  completeBtnText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
});
```

### 5.4 Navigator registration

In `mobile/src/navigation/PatientStackNavigator.tsx`:

```tsx
<Stack.Screen name="PHEducationCourse" component={EducationCourseScreen} options={{ title: '' }} />
```

In the existing `PatientEducationScreen`, wire course card `onPress`:

```tsx
onPress={() => navigation.navigate('PHEducationCourse', {
  courseId: item.id,
  courseTitle: item.title,
})}
```

### 5.5 Mobile i18n

Add to all 8 locale files under `mobile/src/i18n/locales/`:

```json
"education": {
  "enroll": "Start Course",
  "quiz": "Knowledge Check",
  "quizPassed": "Passed",
  "markComplete": "Mark Complete",
  "progress": "Progress",
  "openPdf": "Open PDF",
  "back": "Back"
}
```

---

## Phase 6 — Lint and CI

### 6.1 Lint gate

After every phase:

```bash
cd services/ehr-service && npm run lint
cd ehr-frontend && npm run lint
cd patient-portal && npm run lint
cd mobile && npm run lint
```

Zero lint errors before proceeding to next phase.

### 6.2 Test stubs

`services/ehr-service/src/services/health-education.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { HealthEducationService } from './health-education.service';

describe('HealthEducationService', () => {
  let service: HealthEducationService;
  let mockDb: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [HealthEducationService],
    }).compile();
    service = module.get(HealthEducationService);
    mockDb = { query: jest.fn() };
  });

  describe('createCourse', () => {
    it('inserts course and returns row', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'Test' }] });
      const result = await service.createCourse(
        { title: 'Test', category: 'HIV', targetAudience: 'all', defaultLanguageCode: 'en' },
        'staff-1', mockDb,
      );
      expect(result.id).toBe('c1');
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('upsertTranslation', () => {
    it('rejects unknown language codes', async () => {
      await expect(
        service.upsertTranslation('l1', { languageCode: 'xx', title: 'X', contentBody: 'Y' }, mockDb),
      ).rejects.toThrow('Unsupported language');
    });
  });

  describe('submitQuizAttempt', () => {
    it('throws when max attempts exceeded', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'q1', pass_threshold: 70, max_attempts: 3, lesson_id: 'l1', course_id: 'c1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'e1', course_id: 'c1' }] })
        .mockResolvedValueOnce({ rows: [{ n: 3 }] }); // used = max
      await expect(
        service.submitQuizAttempt('p1', 'q1', [], mockDb),
      ).rejects.toThrow('Maximum attempts');
    });
  });
});
```

Run:

```bash
cd services/ehr-service && npm test -- --coverage
```

Coverage thresholds (branches 70%, functions/lines/statements 75%) must pass.

### 6.3 DB repair-all confirmation

After provisioning bundle is in place and before frontend work begins, confirm:

```bash
curl -X POST http://localhost:3000/api/admin/tenants/repair-all \
  -H "Authorization: Bearer <super_admin_token>"
```

Response must include `"patient_health_education"` in the applied bundles list. If a tenant already has the tables (re-run), the `IF NOT EXISTS` clauses make it a no-op.

---

## Rollout Registration

### New controllers (add to `docs/rollout/README.md`):

| Controller | Sprint | Route prefix |
|---|---|---|
| `HealthEducationController` | HE-S01 | `/health-education` |
| `PatientPortalHealthEducationController` | HE-S01 | `/patient-portal/education` |

### New DB bundle:

| Bundle ID | Sprint |
|---|---|
| `patient_health_education` | HE-S01 |

### Staff role column:

`staff.is_health_educator` — added via `ensureSubscriptionSchema()` (HE-S01)

---

## Sign-off Checklist

Complete each item in order. Do not sign off until all 22 are green.

**DB Provisioning**
- [ ] `patient_health_education` bundle added to `getProvisioningBundles()`
- [ ] `staff.is_health_educator` column added to `ensureSubscriptionSchema()`
- [ ] `POST /api/admin/tenants/repair-all` run — response confirms bundle applied
- [ ] All 10 tables visible in a tenant DB (`\dt education_*` returns 10 rows)
- [ ] All 7 indexes present (`\di idx_edu_*` returns 7 rows)

**Backend**
- [ ] `HealthEducatorGuard` created and DB-lookup tested manually (staff without flag gets 403)
- [ ] `HealthEducationController` registered in `ehr.module.ts` controllers
- [ ] `PatientPortalHealthEducationController` registered in `ehr.module.ts` controllers
- [ ] `HealthEducationService` and `PatientHealthEducationService` in providers
- [ ] `POST /health-education/courses` returns 201 with `id` field
- [ ] `POST /patient-portal/education/courses/:id/enroll` requires patient JWT (401 without)
- [ ] `POST /patient-portal/education/lessons/:id/complete` auto-marks course complete when all lessons done
- [ ] `submitQuizAttempt` correctly scores MCQ and returns `passed: true/false`

**Lint and CI**
- [ ] `npm run lint` passes in `ehr-service`, `ehr-frontend`, `patient-portal`, `mobile`
- [ ] `npm test` passes in `ehr-service` with coverage thresholds met
- [ ] CI `build-and-test` workflow green on branch

**EHR Frontend**
- [ ] `/health-education` route renders course list for `is_health_educator = true` staff
- [ ] Sidebar item hidden for staff without health educator flag
- [ ] Course editor: can create module, add lesson, add translation, add quiz in sequence
- [ ] Progress dashboard shows per-patient completion bar and quiz score

**Patient Portal**
- [ ] `/education` page shows enrolled courses with progress bars
- [ ] Course reader page renders Markdown content correctly
- [ ] "Mark as Complete" button advances progress and auto-completes course when final lesson done
- [ ] Language toggle selects correct translation (falls back to EN if translation missing)

**Mobile**
- [ ] `PatientEducationScreen` loads tenant-specific courses (not generic endpoint)
- [ ] `EducationCourseScreen` renders lesson list and expands lesson body on tap
- [ ] Lesson progress persists after marking complete and reloading
- [ ] New i18n keys present in all 8 locale files
