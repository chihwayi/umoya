import { Injectable } from '@nestjs/common';

@Injectable()
export class CascadeMetricsService {
  async computeCascade(db: any): Promise<{
    diagnosedCount: number;
    onArtCount: number;
    suppressedCount: number;
    second95: number;
    third95: number;
    byAgeBand: Record<string, any>;
    bySex: Record<string, any>;
  }> {
    const [diagnosed] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments WHERE enrollment_status NOT IN ('closed', 'transferred_out')`,
    );
    const [onArt] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments
       WHERE art_status = 'on_art' AND enrollment_status NOT IN ('closed', 'transferred_out')`,
    );
    const [suppressed] = await db.query(
      `SELECT COUNT(DISTINCT cv.patient_id) AS cnt
       FROM hiv_clinical_visits cv
       WHERE cv.viral_load < 1000
         AND cv.viral_load IS NOT NULL
         AND cv.visit_date >= CURRENT_DATE - INTERVAL '12 months'
         AND EXISTS (
           SELECT 1 FROM hiv_enrollments e WHERE e.patient_id = cv.patient_id
           AND e.art_status = 'on_art' AND e.enrollment_status NOT IN ('closed', 'transferred_out')
         )`,
    );

    const dCount = parseInt(diagnosed.cnt);
    const aCount = parseInt(onArt.cnt);
    const sCount = parseInt(suppressed.cnt);

    const bySexRows = await db.query(`
      SELECT p.sex,
        COUNT(DISTINCT e.patient_id) AS diagnosed,
        COUNT(DISTINCT e.patient_id) FILTER (WHERE e.art_status = 'on_art') AS on_art,
        COUNT(DISTINCT cv.patient_id) FILTER (WHERE cv.viral_load < 1000 AND cv.viral_load IS NOT NULL AND cv.visit_date >= CURRENT_DATE - INTERVAL '12 months') AS suppressed
      FROM hiv_enrollments e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN hiv_clinical_visits cv ON cv.patient_id = e.patient_id
      WHERE e.enrollment_status NOT IN ('closed', 'transferred_out')
      GROUP BY p.sex
    `);

    const byAgeBandRows = await db.query(`
      SELECT
        CASE
          WHEN DATE_PART('year', AGE(p.date_of_birth)) < 15 THEN '<15'
          WHEN DATE_PART('year', AGE(p.date_of_birth)) < 25 THEN '15-24'
          WHEN DATE_PART('year', AGE(p.date_of_birth)) < 50 THEN '25-49'
          ELSE '50+'
        END AS age_band,
        COUNT(DISTINCT e.patient_id) AS diagnosed,
        COUNT(DISTINCT e.patient_id) FILTER (WHERE e.art_status = 'on_art') AS on_art,
        COUNT(DISTINCT cv.patient_id) FILTER (WHERE cv.viral_load < 1000 AND cv.viral_load IS NOT NULL AND cv.visit_date >= CURRENT_DATE - INTERVAL '12 months') AS suppressed
      FROM hiv_enrollments e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN hiv_clinical_visits cv ON cv.patient_id = e.patient_id
      WHERE e.enrollment_status NOT IN ('closed', 'transferred_out')
      GROUP BY age_band ORDER BY age_band
    `);

    const bySex = Object.fromEntries(bySexRows.map((r: any) => [r.sex, r]));
    const byAgeBand = Object.fromEntries(byAgeBandRows.map((r: any) => [r.age_band, r]));

    const second95 = dCount > 0 ? (aCount / dCount) * 100 : 0;
    const third95  = aCount > 0 ? (sCount / aCount) * 100 : 0;

    return { diagnosedCount: dCount, onArtCount: aCount, suppressedCount: sCount, second95, third95, bySex, byAgeBand };
  }

  async saveSnapshot(cascade: any, periodLabel: string, db: any): Promise<void> {
    await db.query(
      `INSERT INTO cascade_snapshots
         (snapshot_date, period_label, diagnosed_count, on_art_count, suppressed_count,
          second_95, third_95, by_sex, by_age_band)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7, $8)`,
      [periodLabel, cascade.diagnosedCount, cascade.onArtCount, cascade.suppressedCount,
       cascade.second95, cascade.third95, JSON.stringify(cascade.bySex), JSON.stringify(cascade.byAgeBand)],
    );
  }

  async getSnapshots(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM cascade_snapshots ORDER BY snapshot_date DESC LIMIT 12`);
  }
}
