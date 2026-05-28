import { Injectable, Logger } from '@nestjs/common';

interface RankedCourse {
  courseId: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  relevanceScore: number;
  matchedDiagnoses: string[];
  completionStatus: 'not_started' | 'in_progress' | 'completed';
  clinicianRecommended: boolean;
}

@Injectable()
export class EducationPersonalizationService {
  private readonly logger = new Logger(EducationPersonalizationService.name);

  async getPersonalizedCourses(patientId: string, db: any, limit = 10): Promise<RankedCourse[]> {
    const diagnoses = await db.query(
      `SELECT d.icd10_code, d.snomed_code, d.status
       FROM patient_diagnoses d
       WHERE d.patient_id = $1 AND d.status IN ('active','chronic')`,
      [patientId],
    );

    if (diagnoses.length === 0) {
      return this.getPopularCourses(patientId, db, limit);
    }

    const icd10Codes = diagnoses.map((d: any) => d.icd10_code).filter(Boolean);
    const snomedCodes = diagnoses.map((d: any) => d.snomed_code).filter(Boolean);

    const mapped = await db.query(
      `SELECT
         ec.id AS course_id, ec.title, ec.description,
         ec.thumbnail_url,
         SUM(ecdm.relevance_weight) AS relevance_score,
         ARRAY_AGG(DISTINCT COALESCE(ecdm.icd10_code, ecdm.snomed_code)) AS matched_codes
       FROM education_courses ec
       JOIN education_course_diagnosis_map ecdm ON ecdm.course_id = ec.id
       WHERE ecdm.icd10_code = ANY($1) OR ecdm.snomed_code = ANY($2)
       GROUP BY ec.id, ec.title, ec.description, ec.thumbnail_url
       ORDER BY relevance_score DESC
       LIMIT $3`,
      [icd10Codes, snomedCodes, limit * 2],
    );

    const enrolments = await db.query(
      `SELECT course_id, status FROM education_enrolments WHERE patient_id = $1`,
      [patientId],
    );
    const enrolmentMap = new Map<string, string>(enrolments.map((e: any) => [e.course_id, e.status]));

    const recommendations = await db.query(
      `SELECT course_id FROM education_clinician_recommendations
       WHERE patient_id = $1 AND status IN ('pending','accepted')`,
      [patientId],
    );
    const recommendedSet = new Set<string>(recommendations.map((r: any) => r.course_id));

    const ranked: RankedCourse[] = mapped
      .filter((c: any) => enrolmentMap.get(c.course_id) !== 'completed')
      .slice(0, limit)
      .map((c: any) => ({
        courseId: c.course_id,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnail_url,
        relevanceScore: parseFloat(c.relevance_score),
        matchedDiagnoses: c.matched_codes,
        completionStatus: (enrolmentMap.get(c.course_id) as any) ?? 'not_started',
        clinicianRecommended: recommendedSet.has(c.course_id),
      }));

    const recommendedCourses = await this.getClinicianRecommended(patientId, db);
    const rankedIds = new Set(ranked.map((r) => r.courseId));
    for (const rec of recommendedCourses) {
      if (!rankedIds.has(rec.courseId)) {
        ranked.unshift({ ...rec, clinicianRecommended: true, relevanceScore: 999 });
      }
    }

    return ranked;
  }

  async getClinicianRecommended(patientId: string, db: any): Promise<RankedCourse[]> {
    const rows = await db.query(
      `SELECT ec.id AS course_id, ec.title, ec.description, ec.thumbnail_url,
              ecr.status AS enrolment_status
       FROM education_clinician_recommendations ecr
       JOIN education_courses ec ON ec.id = ecr.course_id
       WHERE ecr.patient_id = $1 AND ecr.status IN ('pending','accepted')
       ORDER BY ecr.created_at DESC`,
      [patientId],
    );
    return rows.map((r: any) => ({
      courseId: r.course_id,
      title: r.title,
      description: r.description,
      thumbnailUrl: r.thumbnail_url,
      relevanceScore: 999,
      matchedDiagnoses: [],
      completionStatus: r.enrolment_status ?? 'not_started',
      clinicianRecommended: true,
    }));
  }

  private async getPopularCourses(patientId: string, db: any, limit: number): Promise<RankedCourse[]> {
    const rows = await db.query(
      `SELECT ec.id AS course_id, ec.title, ec.description, ec.thumbnail_url,
              COUNT(ee.id) AS enrolment_count
       FROM education_courses ec
       LEFT JOIN education_enrolments ee ON ee.course_id = ec.id
       GROUP BY ec.id, ec.title, ec.description, ec.thumbnail_url
       ORDER BY enrolment_count DESC NULLS LAST
       LIMIT $1`,
      [limit],
    );
    const enrolments = await db.query(
      `SELECT course_id, status FROM education_enrolments WHERE patient_id = $1`,
      [patientId],
    );
    const enrolmentMap = new Map<string, string>(enrolments.map((e: any) => [e.course_id, e.status]));
    return rows.map((r: any) => ({
      courseId: r.course_id,
      title: r.title,
      description: r.description,
      thumbnailUrl: r.thumbnail_url,
      relevanceScore: parseInt(r.enrolment_count ?? '0'),
      matchedDiagnoses: [],
      completionStatus: (enrolmentMap.get(r.course_id) as any) ?? 'not_started',
      clinicianRecommended: false,
    }));
  }

  async recommendCourse(
    patientId: string,
    courseId: string,
    recommendedBy: string,
    note: string | undefined,
    db: any,
  ): Promise<unknown> {
    const rows = await db.query(
      `INSERT INTO education_clinician_recommendations
         (patient_id, course_id, recommended_by, note)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (patient_id, course_id)
         DO UPDATE SET note = EXCLUDED.note, status = 'pending', recommended_by = EXCLUDED.recommended_by
       RETURNING *`,
      [patientId, courseId, recommendedBy, note ?? null],
    );
    return rows[0];
  }

  async seedDiagnosisMap(
    courseId: string,
    mappings: Array<{ icd10Code?: string; snomedCode?: string; weight?: number }>,
    db: any,
  ): Promise<void> {
    for (const m of mappings) {
      await db.query(
        `INSERT INTO education_course_diagnosis_map
           (course_id, icd10_code, snomed_code, relevance_weight)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [courseId, m.icd10Code ?? null, m.snomedCode ?? null, m.weight ?? 1.0],
      );
    }
  }

  async getEnrolmentStats(courseId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT ecdm.icd10_code, ecdm.snomed_code,
              COUNT(DISTINCT ee.patient_id) AS enrolled_patients
       FROM education_course_diagnosis_map ecdm
       LEFT JOIN education_enrolments ee ON ee.course_id = ecdm.course_id
       WHERE ecdm.course_id = $1
       GROUP BY ecdm.icd10_code, ecdm.snomed_code`,
      [courseId],
    );
  }
}
