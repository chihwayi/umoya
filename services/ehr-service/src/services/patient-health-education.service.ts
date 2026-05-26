import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PatientHealthEducationService {
  private resolveLanguage(preferred: string): string {
    const supported = ['en', 'sn', 'nd', 'fr', 'pt', 'sw', 'zu', 'af'];
    return supported.includes(preferred) ? preferred : 'en';
  }

  async getMyCourses(patientId: string, lang: string, tenantDb: DataSource) {
    this.resolveLanguage(lang);
    const rows = await tenantDb.query(`
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

    return rows.map((row) => ({
      ...row,
      progressPct: row.total_lessons > 0
        ? Math.round((row.completed_lessons / row.total_lessons) * 100)
        : 0,
    }));
  }

  async getBrowsableCourses(patientId: string, lang: string, tenantDb: DataSource) {
    this.resolveLanguage(lang);
    return tenantDb.query(`
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
  }

  async getCourseContent(patientId: string, courseId: string, lang: string, tenantDb: DataSource) {
    const language = this.resolveLanguage(lang);

    const courseRows = await tenantDb.query(
      `SELECT * FROM education_courses WHERE id=$1 AND published=true`,
      [courseId],
    );
    const course = courseRows[0];
    if (!course) throw new NotFoundException('Course not found');

    const enrollmentRows = await tenantDb.query(
      `SELECT * FROM education_enrollments WHERE patient_id=$1 AND course_id=$2`,
      [patientId, courseId],
    );
    const enrollment = enrollmentRows[0];

    const modules = await tenantDb.query(
      `SELECT * FROM education_modules WHERE course_id=$1 ORDER BY order_index`,
      [courseId],
    );

    for (const mod of modules) {
      const lessons = await tenantDb.query(
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

  async selfEnroll(patientId: string, courseId: string, tenantDb: DataSource) {
    const courseRows = await tenantDb.query(
      `SELECT id FROM education_courses WHERE id=$1 AND published=true`,
      [courseId],
    );
    if (!courseRows[0]) throw new NotFoundException('Course not found or not published');

    const rows = await tenantDb.query(
      `INSERT INTO education_enrollments (patient_id, course_id)
       VALUES ($1,$2) ON CONFLICT (patient_id, course_id) DO NOTHING RETURNING *`,
      [patientId, courseId],
    );
    return rows[0] ?? { message: 'Already enrolled' };
  }

  async markLessonComplete(patientId: string, lessonId: string, tenantDb: DataSource) {
    const enrollmentRows = await tenantDb.query(
      `SELECT e.id, e.course_id FROM education_enrollments e
       JOIN education_modules m ON m.course_id = e.course_id
       JOIN education_lessons l ON l.module_id = m.id AND l.id = $2
       WHERE e.patient_id = $1`,
      [patientId, lessonId],
    );
    const enrollment = enrollmentRows[0];
    if (!enrollment) throw new NotFoundException('Enrollment not found for this lesson');

    await tenantDb.query(
      `INSERT INTO education_lesson_progress (enrollment_id, lesson_id, completed_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (enrollment_id, lesson_id)
       DO UPDATE SET completed_at=COALESCE(education_lesson_progress.completed_at, NOW())`,
      [enrollment.id, lessonId],
    );

    const countRows = await tenantDb.query(`
      SELECT
        COUNT(DISTINCT l.id)::int AS total,
        COUNT(DISTINCT lp.lesson_id)::int AS done
      FROM education_modules m
      JOIN education_lessons l ON l.module_id = m.id
      LEFT JOIN education_lesson_progress lp
        ON lp.lesson_id = l.id AND lp.enrollment_id = $1 AND lp.completed_at IS NOT NULL
      WHERE m.course_id = $2
    `, [enrollment.id, enrollment.course_id]);
    const counts = countRows[0];

    if (counts.total > 0 && counts.total === counts.done) {
      await tenantDb.query(
        `UPDATE education_enrollments SET completed_at=NOW() WHERE id=$1 AND completed_at IS NULL`,
        [enrollment.id],
      );
    }

    return { lessonId, completed: true };
  }

  async submitQuizAttempt(
    patientId: string,
    quizId: string,
    answers: { questionId: string; selectedOptionId: string }[],
    tenantDb: DataSource,
  ) {
    const quizRows = await tenantDb.query(
      `SELECT q.*, l.id AS lesson_id, m.course_id
       FROM education_quizzes q
       JOIN education_lessons l ON l.id = q.lesson_id
       JOIN education_modules m ON m.id = l.module_id
       WHERE q.id = $1`,
      [quizId],
    );
    const quiz = quizRows[0];
    if (!quiz) throw new NotFoundException('Quiz not found');

    const enrollmentRows = await tenantDb.query(
      `SELECT id FROM education_enrollments WHERE patient_id=$1 AND course_id=$2`,
      [patientId, quiz.course_id],
    );
    const enrollment = enrollmentRows[0];
    if (!enrollment) throw new BadRequestException('Not enrolled in this course');

    const usedRows = await tenantDb.query(
      `SELECT COUNT(*)::int AS n FROM education_quiz_attempts WHERE enrollment_id=$1 AND quiz_id=$2`,
      [enrollment.id, quizId],
    );
    if (usedRows[0].n >= quiz.max_attempts) {
      throw new BadRequestException(`Maximum attempts (${quiz.max_attempts}) reached`);
    }

    const questions = await tenantDb.query(
      `SELECT qq.id AS question_id, qo.id AS correct_option_id
       FROM education_quiz_questions qq
       JOIN education_quiz_options qo ON qo.question_id = qq.id AND qo.is_correct = true
       WHERE qq.quiz_id = $1`,
      [quizId],
    );

    let correct = 0;
    for (const question of questions) {
      const submitted = answers.find((answer) => answer.questionId === question.question_id);
      if (submitted?.selectedOptionId === question.correct_option_id) correct++;
    }

    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= quiz.pass_threshold;

    const attemptRows = await tenantDb.query(
      `INSERT INTO education_quiz_attempts (enrollment_id, quiz_id, score, passed, answers)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [enrollment.id, quizId, score, passed, JSON.stringify(answers)],
    );

    return { score, passed, passThreshold: quiz.pass_threshold, attempt: attemptRows[0] };
  }
}
