import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface CreateCourseDto {
  title: string;
  description?: string;
  category?: string;
  targetAudience?: string;
  defaultLanguageCode?: string;
}

interface AddLessonDto {
  title: string;
  contentBody: string;
  contentType?: string;
  durationMinutes?: number;
}

interface LessonTranslationDto {
  languageCode: string;
  title: string;
  contentBody: string;
}

@Injectable()
export class HealthEducationService {
  async listCourses(tenantDb: DataSource) {
    return tenantDb.query(`
      SELECT
        c.*,
        COUNT(DISTINCT e.patient_id)::int AS enrolled_count,
        COUNT(DISTINCT m.id)::int AS module_count,
        COUNT(DISTINCT l.id)::int AS lesson_count
      FROM education_courses c
      LEFT JOIN education_modules m ON m.course_id = c.id
      LEFT JOIN education_lessons l ON l.module_id = m.id
      LEFT JOIN education_enrollments e ON e.course_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
  }

  async getCourse(courseId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `SELECT * FROM education_courses WHERE id=$1`,
      [courseId],
    );
    if (!rows[0]) throw new NotFoundException('Course not found');
    return rows[0];
  }

  async getModules(courseId: string, tenantDb: DataSource) {
    return tenantDb.query(
      `SELECT m.*, COUNT(l.id)::int AS lesson_count
       FROM education_modules m
       LEFT JOIN education_lessons l ON l.module_id = m.id
       WHERE m.course_id=$1
       GROUP BY m.id
       ORDER BY m.order_index`,
      [courseId],
    );
  }

  async createCourse(dto: CreateCourseDto, staffId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `INSERT INTO education_courses
         (title, description, category, target_audience, default_language_code, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [dto.title, dto.description, dto.category, dto.targetAudience, dto.defaultLanguageCode ?? 'en', staffId],
    );
    return rows[0];
  }

  async updateCourse(courseId: string, dto: Partial<CreateCourseDto>, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `UPDATE education_courses
       SET title=$1, description=$2, category=$3, target_audience=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [dto.title, dto.description, dto.category, dto.targetAudience, courseId],
    );
    if (!rows[0]) throw new NotFoundException('Course not found');
    return rows[0];
  }

  async publishCourse(courseId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `UPDATE education_courses
       SET published=true, published_at=NOW(), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [courseId],
    );
    if (!rows[0]) throw new NotFoundException('Course not found');
    return rows[0];
  }

  async unpublishCourse(courseId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `UPDATE education_courses SET published=false, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [courseId],
    );
    if (!rows[0]) throw new NotFoundException('Course not found');
    return rows[0];
  }

  async addModule(courseId: string, title: string, tenantDb: DataSource) {
    const orderRows = await tenantDb.query(
      `SELECT COALESCE(MAX(order_index),0)+1 AS next FROM education_modules WHERE course_id=$1`,
      [courseId],
    );
    const rows = await tenantDb.query(
      `INSERT INTO education_modules (course_id, title, order_index) VALUES ($1,$2,$3) RETURNING *`,
      [courseId, title, orderRows[0].next],
    );
    return rows[0];
  }

  async reorderModule(moduleId: string, direction: 'up' | 'down', tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `SELECT * FROM education_modules WHERE id=$1`,
      [moduleId],
    );
    const mod = rows[0];
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

  async addLesson(moduleId: string, dto: AddLessonDto, tenantDb: DataSource) {
    const orderRows = await tenantDb.query(
      `SELECT COALESCE(MAX(order_index),0)+1 AS next FROM education_lessons WHERE module_id=$1`,
      [moduleId],
    );
    const lessonRows = await tenantDb.query(
      `INSERT INTO education_lessons (module_id, content_type, duration_minutes, order_index)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [moduleId, dto.contentType ?? 'text', dto.durationMinutes, orderRows[0].next],
    );
    const lesson = lessonRows[0];

    await tenantDb.query(
      `INSERT INTO education_lesson_translations (lesson_id, language_code, title, content_body)
       VALUES ($1,'en',$2,$3)`,
      [lesson.id, dto.title, dto.contentBody],
    );

    return lesson;
  }

  async upsertTranslation(lessonId: string, dto: LessonTranslationDto, tenantDb: DataSource) {
    const allowed = ['en', 'sn', 'nd', 'fr', 'pt', 'sw', 'zu', 'af'];
    if (!allowed.includes(dto.languageCode)) {
      throw new BadRequestException(`Unsupported language: ${dto.languageCode}`);
    }

    const rows = await tenantDb.query(
      `INSERT INTO education_lesson_translations (lesson_id, language_code, title, content_body)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (lesson_id, language_code)
       DO UPDATE SET title=$3, content_body=$4
       RETURNING *`,
      [lessonId, dto.languageCode, dto.title, dto.contentBody],
    );
    return rows[0];
  }

  async createQuiz(lessonId: string, passThreshold: number, maxAttempts: number, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `INSERT INTO education_quizzes (lesson_id, pass_threshold, max_attempts)
       VALUES ($1,$2,$3)
       ON CONFLICT (lesson_id) DO UPDATE SET pass_threshold=$2, max_attempts=$3
       RETURNING *`,
      [lessonId, passThreshold, maxAttempts],
    );
    return rows[0];
  }

  async addQuestion(
    quizId: string,
    questionText: string,
    options: { text: string; isCorrect: boolean }[],
    tenantDb: DataSource,
  ) {
    const questionRows = await tenantDb.query(
      `INSERT INTO education_quiz_questions (quiz_id, question_text, order_index)
       VALUES ($1,$2,(SELECT COALESCE(MAX(order_index),0)+1 FROM education_quiz_questions WHERE quiz_id=$1))
       RETURNING *`,
      [quizId, questionText],
    );
    const question = questionRows[0];

    for (let i = 0; i < options.length; i++) {
      await tenantDb.query(
        `INSERT INTO education_quiz_options (question_id, option_text, is_correct, order_index)
         VALUES ($1,$2,$3,$4)`,
        [question.id, options[i].text, options[i].isCorrect, i],
      );
    }

    return question;
  }

  async assignToPatient(courseId: string, patientId: string, staffId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `INSERT INTO education_enrollments (patient_id, course_id, assigned_by)
       VALUES ($1,$2,$3)
       ON CONFLICT (patient_id, course_id) DO NOTHING
       RETURNING *`,
      [patientId, courseId, staffId],
    );
    return rows[0] ?? { message: 'Already enrolled' };
  }

  async assignToAll(courseId: string, staffId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `INSERT INTO education_enrollments (patient_id, course_id, assigned_by)
       SELECT id, $1, $2 FROM patients
       ON CONFLICT (patient_id, course_id) DO NOTHING
       RETURNING id`,
      [courseId, staffId],
    );
    return { enrolled: rows.length };
  }

  async getCourseProgress(courseId: string, tenantDb: DataSource) {
    return tenantDb.query(`
      SELECT
        p.id AS patient_id,
        p.first_name,
        p.last_name,
        e.enrolled_at,
        e.completed_at,
        COUNT(DISTINCT lp.lesson_id)::int AS lessons_completed,
        COUNT(DISTINCT l.id)::int AS total_lessons,
        MAX(qa.score) AS best_quiz_score
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
  }
}
