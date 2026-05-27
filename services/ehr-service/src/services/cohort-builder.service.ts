import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class CohortBuilderService {
  private readonly ALLOWED_FIELDS: Record<string, string> = {
    'age_min':           `DATE_PART('year', AGE(p.date_of_birth)) >= :value`,
    'age_max':           `DATE_PART('year', AGE(p.date_of_birth)) <= :value`,
    'sex':               `p.sex = :value`,
    'district':          `p.district ILIKE :value`,
    'province':          `p.province ILIKE :value`,
    'art_status':        `e.art_status = :value`,
    'regimen_line':      `e.current_regimen_line = :value`,
    'vl_max':            `EXISTS (SELECT 1 FROM hiv_clinical_visits v WHERE v.patient_id = p.id AND v.viral_load <= :value AND v.visit_date >= CURRENT_DATE - INTERVAL '12 months')`,
    'cd4_min':           `EXISTS (SELECT 1 FROM hiv_clinical_visits v WHERE v.patient_id = p.id AND v.cd4_count >= :value AND v.visit_date >= CURRENT_DATE - INTERVAL '12 months')`,
    'on_art_months_min': `DATE_PART('month', AGE(CURRENT_DATE, e.art_start_date)) >= :value`,
    'has_oi_alert':      `EXISTS (SELECT 1 FROM oi_early_warning_alerts a WHERE a.patient_id = p.id AND a.status = 'active')`,
    'is_stable':         `EXISTS (SELECT 1 FROM hiv_stable_patient_flags f WHERE f.patient_id = p.id AND f.is_active = true)`,
  };

  buildQuery(criteria: { conditions: any[]; logic: 'AND' | 'OR' }): { sql: string; params: any[] } {
    const params: any[] = [];
    const clauses = criteria.conditions.map(c => {
      const template = this.ALLOWED_FIELDS[c.field];
      if (!template) throw new BadRequestException(`Unknown cohort field: ${c.field}`);
      params.push(c.value);
      return template.replace(':value', `$${params.length}`);
    });

    const where = clauses.length > 0 ? clauses.join(` ${criteria.logic} `) : 'TRUE';
    const sql = `
      SELECT p.id, p.full_name, p.date_of_birth, p.sex, p.district, p.province,
             e.art_status, e.art_start_date, e.current_regimen
      FROM patients p
      JOIN hiv_enrollments e ON e.patient_id = p.id
      WHERE ${where}
      ORDER BY p.full_name
    `;
    return { sql, params };
  }

  async runCohort(criteria: any, db: any): Promise<{ count: number; patients: any[] }> {
    const { sql, params } = this.buildQuery(criteria);
    const patients = await db.query(sql, params);
    return { count: patients.length, patients };
  }

  async saveCohort(dto: {
    cohortName: string; description?: string; criteria: any; isShared?: boolean; createdBy: string;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO cohort_definitions (cohort_name, description, criteria, is_shared, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [dto.cohortName, dto.description ?? null, JSON.stringify(dto.criteria), dto.isShared ?? false, dto.createdBy],
    );
    return row;
  }

  async runSavedCohort(cohortId: string, db: any): Promise<any> {
    const [def] = await db.query(`SELECT * FROM cohort_definitions WHERE id = $1`, [cohortId]);
    if (!def) throw new BadRequestException('Cohort not found');
    const result = await this.runCohort(def.criteria, db);
    await db.query(
      `UPDATE cohort_definitions SET last_run_at = now(), last_run_count = $1 WHERE id = $2`,
      [result.count, cohortId],
    );
    return result;
  }

  async listSavedCohorts(userId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT id, cohort_name, description, is_shared, last_run_at, last_run_count, created_at
       FROM cohort_definitions WHERE created_by = $1 OR is_shared = true ORDER BY updated_at DESC`,
      [userId],
    );
  }
}
