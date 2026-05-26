import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TrainingService {
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

  async submitAssessment(dto: {
    enrolmentId: string;
    moduleId: string;
    assessmentType: 'pre' | 'post';
    answers: Record<string, string>;
  }, db: any): Promise<{ scoreRaw: number; scoreTotal: number; scorePct: number; passed: boolean; feedback: any[] }> {
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

      await db.query(
        `UPDATE training_trainees SET total_cpd_credits = total_cpd_credits + $1, updated_at = now()
         WHERE id = $2`,
        [enrolment.cpd_credits, enrolment.trainee_id],
      );

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

  async getCohortReport(courseId: string, cohortLabel: string, db: any): Promise<any[]> {
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
