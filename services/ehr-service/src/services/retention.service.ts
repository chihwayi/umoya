import { Injectable } from '@nestjs/common';

@Injectable()
export class RetentionService {
  async computeRetention(cohortStartDate: string, followupMonths: 6 | 12 | 24, db: any): Promise<any> {
    const cohortEnd = new Date(cohortStartDate);
    cohortEnd.setMonth(cohortEnd.getMonth() + followupMonths);
    const cohortEndStr = cohortEnd.toISOString().split('T')[0];

    const [total] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'`,
      [cohortStartDate],
    );

    const [aliveOnArt] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments e
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'
         AND art_status = 'on_art'
         AND EXISTS (
           SELECT 1 FROM hiv_clinical_visits v
           WHERE v.patient_id = e.patient_id AND v.visit_date >= $2::DATE - INTERVAL '90 days'
         )`,
      [cohortStartDate, cohortEndStr],
    );

    const [ltfu] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments e
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'
         AND art_status = 'on_art'
         AND NOT EXISTS (
           SELECT 1 FROM hiv_clinical_visits v
           WHERE v.patient_id = e.patient_id AND v.visit_date >= $2::DATE - INTERVAL '90 days'
         )`,
      [cohortStartDate, cohortEndStr],
    );

    const [died] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'
         AND art_status = 'died'`,
      [cohortStartDate],
    );

    const [transferred] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'
         AND art_status = 'transferred_out'`,
      [cohortStartDate],
    );

    const totalN    = parseInt(total.cnt);
    const aliveN    = parseInt(aliveOnArt.cnt);
    const ltfuN     = parseInt(ltfu.cnt);
    const diedN     = parseInt(died.cnt);
    const transferN = parseInt(transferred.cnt);

    const retentionRate = totalN > 0 ? (aliveN / totalN) * 100 : 0;
    const ltfuRate      = totalN > 0 ? (ltfuN / totalN) * 100 : 0;

    return {
      cohortStartDate, followupMonths,
      totalEnrolled: totalN, aliveOnArt: aliveN,
      ltfuCount: ltfuN, diedCount: diedN, transferredOut: transferN,
      stoppedArt: totalN - aliveN - ltfuN - diedN - transferN,
      retentionRate: Math.round(retentionRate * 10) / 10,
      ltfuRate: Math.round(ltfuRate * 10) / 10,
    };
  }

  async recordReengagement(params: {
    patientId: string; ltfuDate: string; returnedDate: string;
    returnedBy: string; returnNotes?: string;
  }, db: any): Promise<void> {
    const ltfu = new Date(params.ltfuDate);
    const returned = new Date(params.returnedDate);
    const days = Math.floor((returned.getTime() - ltfu.getTime()) / (1000 * 60 * 60 * 24));
    await db.query(
      `INSERT INTO ltfu_reengagement_log (patient_id, ltfu_date, ltfu_duration_days, returned_date, returned_by, return_notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [params.patientId, params.ltfuDate, days, params.returnedDate, params.returnedBy, params.returnNotes ?? null],
    );
    await db.query(
      `UPDATE hiv_enrollments SET art_status = 'on_art', enrollment_status = 'active' WHERE patient_id = $1`,
      [params.patientId],
    );
  }
}
