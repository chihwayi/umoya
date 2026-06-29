import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';

export type CascadeStep = {
  label: string;
  value: number;
  denominator: number;
  percentage: number;
  delta: number;
  colour: 'teal' | 'amber' | 'coral';
};

function stepColour(pct: number): 'teal' | 'amber' | 'coral' {
  if (pct >= 90) return 'teal';
  if (pct >= 75) return 'amber';
  return 'coral';
}

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

@Injectable()
export class CascadeAnalyticsService {
  constructor(private readonly tenantService: TenantService) {}

  private async getDb(tenantId: string): Promise<DataSource> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) throw new ServiceUnavailableException('Tenant database unavailable');
    return db;
  }

  async getHivCascade(tenantId: string, period: { start: string; end: string }) {
    const db = await this.getDb(tenantId);

    // Diagnosed PLHIV in system
    const [{ diagnosed }] = await db.query(
      `SELECT COUNT(DISTINCT hp.id)::int AS diagnosed
         FROM hiv_care_enrollments hp
        WHERE hp.art_start_date IS NOT NULL OR hp.enrollment_date IS NOT NULL`,
    ).catch(() => [{ diagnosed: 0 }]);

    // On ART (TX_CURR proxy)
    const [{ on_art }] = await db.query(
      `SELECT COUNT(DISTINCT e.patient_id)::int AS on_art
         FROM hiv_care_enrollments e
        WHERE e.art_start_date IS NOT NULL
          AND e.art_start_date <= $1::date
          AND (e.transfer_out_date IS NULL OR e.transfer_out_date > $1::date)
          AND COALESCE(e.enrollment_status, 'active') NOT IN ('deceased', 'discontinued')`,
      [period.end],
    ).catch(() => [{ on_art: 0 }]);

    // VL suppressed (<1000 copies/mL in last 12 months)
    const [{ suppressed }] = await db.query(
      `SELECT COUNT(DISTINCT lr.patient_id)::int AS suppressed
         FROM lab_results lr
        WHERE lr.test_type ILIKE '%viral%load%'
          AND lr.result_value::numeric < 1000
          AND lr.result_date >= $1::date - INTERVAL '12 months'
          AND lr.result_date <= $1::date`,
      [period.end],
    ).catch(() => [{ suppressed: 0 }]);

    // Estimated PLHIV (use diagnosed as proxy if no external estimate)
    const population = Math.round(diagnosed * 1.45); // rough 69% diagnosis rate proxy

    const firstNinety = pct(diagnosed, population);
    const secondNinety = pct(on_art, diagnosed);
    const thirdNinety = pct(suppressed, on_art);

    const funnelSteps: CascadeStep[] = [
      { label: 'Estimated PLHIV', value: population, denominator: population, percentage: 100, delta: 0, colour: 'teal' },
      { label: 'Diagnosed', value: diagnosed, denominator: population, percentage: firstNinety, delta: 0, colour: stepColour(firstNinety) },
      { label: 'On ART', value: on_art, denominator: diagnosed, percentage: secondNinety, delta: 0, colour: stepColour(secondNinety) },
      { label: 'Virally Suppressed', value: suppressed, denominator: on_art, percentage: thirdNinety, delta: 0, colour: stepColour(thirdNinety) },
    ];

    return {
      population,
      diagnosedPlhiv: diagnosed,
      onArt: on_art,
      virallySuppressed: suppressed,
      firstNinety,
      secondNinety,
      thirdNinety,
      overallCoverage: pct(suppressed, population),
      funnelSteps,
      gaps: {
        notDiagnosed: population - diagnosed,
        diagnosedNotOnArt: diagnosed - on_art,
        onArtNotSuppressed: on_art - suppressed,
      },
    };
  }

  async getPmtctCascade(tenantId: string, period: { start: string; end: string }) {
    const db = await this.getDb(tenantId);

    const [{ anc_attendees }] = await db.query(
      `SELECT COUNT(*)::int AS anc_attendees FROM anc_registrations
        WHERE registration_date BETWEEN $1::date AND $2::date`,
      [period.start, period.end],
    ).catch(() => [{ anc_attendees: 0 }]);

    const [{ hiv_tested }] = await db.query(
      `SELECT COUNT(DISTINCT patient_id)::int AS hiv_tested
         FROM hiv_tests
        WHERE test_date BETWEEN $1::date AND $2::date`,
      [period.start, period.end],
    ).catch(() => [{ hiv_tested: 0 }]);

    const [{ hiv_positive }] = await db.query(
      `SELECT COUNT(*)::int AS hiv_positive
         FROM hiv_care_enrollments
        WHERE enrollment_date BETWEEN $1::date AND $2::date`,
      [period.start, period.end],
    ).catch(() => [{ hiv_positive: 0 }]);

    const [{ on_art }] = await db.query(
      `SELECT COUNT(*)::int AS on_art
         FROM hiv_care_enrollments
        WHERE art_start_date IS NOT NULL
          AND enrollment_date BETWEEN $1::date AND $2::date`,
      [period.start, period.end],
    ).catch(() => [{ on_art: 0 }]);

    const [{ live_births }] = await db.query(
      `SELECT COUNT(*)::int AS live_births
         FROM deliveries
        WHERE delivery_date BETWEEN $1::date AND $2::date
          AND maternal_outcome NOT IN ('maternal_death') `,
      [period.start, period.end],
    ).catch(() => [{ live_births: 0 }]);

    const [{ eid_early }] = await db.query(
      `SELECT COUNT(*)::int AS eid_early
         FROM eid_results
        WHERE sample_date BETWEEN $1::date AND $2::date
          AND age_weeks_at_test <= 8`,
      [period.start, period.end],
    ).catch(() => [{ eid_early: 0 }]);

    const [{ eid_result_known }] = await db.query(
      `SELECT COUNT(*)::int AS eid_result_known
         FROM eid_results
        WHERE sample_date BETWEEN $1::date AND $2::date
          AND result IS NOT NULL`,
      [period.start, period.end],
    ).catch(() => [{ eid_result_known: 0 }]);

    const [{ hiv_free }] = await db.query(
      `SELECT COUNT(*)::int AS hiv_free
         FROM encounter_outcomes
        WHERE encounter_type = 'delivery'
          AND follow_up_window_days = 365
          AND outcome_type IN ('alive_stable', 'cured')
          AND outcome_date BETWEEN $1::date AND $2::date`,
      [period.start, period.end],
    ).catch(() => [{ hiv_free: 0 }]);

    const mtctRate = eid_result_known > 0
      ? pct(eid_result_known - hiv_free, eid_result_known) : 0;
    const eidCoverage = hiv_positive > 0 ? pct(eid_early, hiv_positive) : 0;

    const funnelSteps: CascadeStep[] = [
      { label: 'ANC Attendees', value: anc_attendees, denominator: anc_attendees, percentage: 100, delta: 0, colour: 'teal' },
      { label: 'HIV Tested at Booking', value: hiv_tested, denominator: anc_attendees, percentage: pct(hiv_tested, anc_attendees), delta: 0, colour: stepColour(pct(hiv_tested, anc_attendees)) },
      { label: 'HIV+ at Booking', value: hiv_positive, denominator: hiv_tested, percentage: pct(hiv_positive, hiv_tested), delta: 0, colour: 'teal' },
      { label: 'On ART', value: on_art, denominator: hiv_positive, percentage: pct(on_art, hiv_positive), delta: 0, colour: stepColour(pct(on_art, hiv_positive)) },
      { label: 'Live Births (HIV+ mothers)', value: live_births, denominator: on_art, percentage: pct(live_births, on_art), delta: 0, colour: 'teal' },
      { label: 'EID Tested ≤2 Months', value: eid_early, denominator: live_births, percentage: pct(eid_early, live_births), delta: 0, colour: stepColour(pct(eid_early, live_births)) },
      { label: 'EID Result Known', value: eid_result_known, denominator: eid_early, percentage: pct(eid_result_known, eid_early), delta: 0, colour: stepColour(pct(eid_result_known, eid_early)) },
      { label: 'HIV-Free at 18 Months', value: hiv_free, denominator: eid_result_known, percentage: pct(hiv_free, eid_result_known), delta: 0, colour: stepColour(pct(hiv_free, eid_result_known)) },
    ];

    return { funnelSteps, mtctRate, eidCoverage };
  }

  async getTbHivCascade(tenantId: string, period: { start: string; end: string }) {
    const db = await this.getDb(tenantId);

    const [{ tb_notified }] = await db.query(
      `SELECT COUNT(*)::int AS tb_notified FROM tb_cases
        WHERE date_registered BETWEEN $1::date AND $2::date`,
      [period.start, period.end],
    ).catch(() => [{ tb_notified: 0 }]);

    const [{ hiv_status_known }] = await db.query(
      `SELECT COUNT(*)::int AS hiv_status_known FROM tb_cases
        WHERE date_registered BETWEEN $1::date AND $2::date
          AND hiv_status_known = TRUE`,
      [period.start, period.end],
    ).catch(() => [{ hiv_status_known: 0 }]);

    const [{ hiv_positive }] = await db.query(
      `SELECT COUNT(*)::int AS hiv_positive FROM tb_cases
        WHERE date_registered BETWEEN $1::date AND $2::date
          AND hiv_result = 'positive'`,
      [period.start, period.end],
    ).catch(() => [{ hiv_positive: 0 }]);

    const [{ on_art }] = await db.query(
      `SELECT COUNT(*)::int AS on_art FROM tb_cases
        WHERE date_registered BETWEEN $1::date AND $2::date
          AND hiv_result = 'positive' AND art_started = TRUE`,
      [period.start, period.end],
    ).catch(() => [{ on_art: 0 }]);

    const [{ tb_completed }] = await db.query(
      `SELECT COUNT(*)::int AS tb_completed
         FROM encounter_outcomes
        WHERE encounter_type = 'tb_case'
          AND outcome_type IN ('cured', 'alive_stable')
          AND outcome_date BETWEEN $1::date AND $2::date`,
      [period.start, period.end],
    ).catch(() => [{ tb_completed: 0 }]);

    const [{ vl_suppressed }] = await db.query(
      `SELECT COUNT(DISTINCT lr.patient_id)::int AS vl_suppressed
         FROM lab_results lr
         JOIN tb_cases tc ON tc.patient_id = lr.patient_id
        WHERE tc.date_registered BETWEEN ($1::date - INTERVAL '12 months') AND $2::date
          AND tc.hiv_result = 'positive'
          AND lr.test_type ILIKE '%viral%load%'
          AND lr.result_value::numeric < 1000
          AND lr.result_date BETWEEN $1::date AND ($2::date + INTERVAL '12 months')`,
      [period.start, period.end],
    ).catch(() => [{ vl_suppressed: 0 }]);

    const funnelSteps: CascadeStep[] = [
      { label: 'TB Cases Notified', value: tb_notified, denominator: tb_notified, percentage: 100, delta: 0, colour: 'teal' },
      { label: 'HIV Status Known', value: hiv_status_known, denominator: tb_notified, percentage: pct(hiv_status_known, tb_notified), delta: 0, colour: stepColour(pct(hiv_status_known, tb_notified)) },
      { label: 'HIV-Positive', value: hiv_positive, denominator: hiv_status_known, percentage: pct(hiv_positive, hiv_status_known), delta: 0, colour: 'teal' },
      { label: 'On ART', value: on_art, denominator: hiv_positive, percentage: pct(on_art, hiv_positive), delta: 0, colour: stepColour(pct(on_art, hiv_positive)) },
      { label: 'TB Treatment Success', value: tb_completed, denominator: on_art, percentage: pct(tb_completed, on_art), delta: 0, colour: stepColour(pct(tb_completed, on_art)) },
      { label: 'VL Suppressed at 12m', value: vl_suppressed, denominator: tb_completed, percentage: pct(vl_suppressed, tb_completed), delta: 0, colour: stepColour(pct(vl_suppressed, tb_completed)) },
    ];

    return {
      funnelSteps,
      tbHivCoinfectionRate: pct(hiv_positive, tb_notified),
      artCoverageAmongHivPosTb: pct(on_art, hiv_positive),
      tbTreatmentSuccessRate: pct(tb_completed, on_art),
      gaps: { hivStatusUnknown: tb_notified - hiv_status_known },
    };
  }

  async getNcdCascade(tenantId: string, condition: 'hypertension' | 'diabetes' | 'ckd', period: { start: string; end: string }) {
    const db = await this.getDb(tenantId);

    const icdMap = { hypertension: 'I1%', diabetes: 'E1%', ckd: 'N18%' };
    const icdPattern = icdMap[condition];
    const controlQuery: Record<string, string> = {
      diabetes: `EXISTS (
        SELECT 1 FROM lab_results lr2
         WHERE lr2.patient_id = p.id
           AND lr2.test_type ILIKE '%hba1c%'
           AND lr2.result_value::numeric < 7
           AND lr2.result_date >= NOW() - INTERVAL '12 months'
      )`,
      hypertension: `EXISTS (
        SELECT 1 FROM patient_vitals pv2
         WHERE pv2.patient_id = p.id
           AND pv2.systolic_bp < 140 AND pv2.diastolic_bp < 90
           AND pv2.recorded_at >= NOW() - INTERVAL '6 months'
      )`,
      ckd: `EXISTS (
        SELECT 1 FROM lab_results lr3
         WHERE lr3.patient_id = p.id
           AND lr3.test_type ILIKE '%gfr%'
           AND lr3.result_value::numeric >= 30
           AND lr3.result_date >= NOW() - INTERVAL '12 months'
      )`,
    };

    const [{ diagnosed }] = await db.query(
      `SELECT COUNT(DISTINCT pd.patient_id)::int AS diagnosed
         FROM patient_diagnoses pd
        WHERE pd.icd10_code ILIKE $1`,
      [icdPattern],
    ).catch(() => [{ diagnosed: 0 }]);

    const [{ in_care }] = await db.query(
      `SELECT COUNT(DISTINCT p.id)::int AS in_care
         FROM patients p
        WHERE EXISTS (
          SELECT 1 FROM patient_diagnoses pd WHERE pd.patient_id = p.id AND pd.icd10_code ILIKE $1
        )
          AND EXISTS (
          SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.appointment_date >= NOW() - INTERVAL '6 months'
        )`,
      [icdPattern],
    ).catch(() => [{ in_care: 0 }]);

    const testColumn = condition === 'diabetes' ? 'hba1c' : condition === 'hypertension' ? 'bp' : 'gfr';
    const [{ measured }] = await db.query(
      `SELECT COUNT(DISTINCT p.id)::int AS measured
         FROM patients p
        WHERE EXISTS (
          SELECT 1 FROM patient_diagnoses pd WHERE pd.patient_id = p.id AND pd.icd10_code ILIKE $1
        )
          AND (
            EXISTS (SELECT 1 FROM lab_results lr WHERE lr.patient_id = p.id AND lr.test_type ILIKE $2 AND lr.result_date >= NOW() - INTERVAL '12 months')
            OR EXISTS (SELECT 1 FROM patient_vitals pv WHERE pv.patient_id = p.id AND pv.recorded_at >= NOW() - INTERVAL '6 months')
          )`,
      [icdPattern, `%${testColumn}%`],
    ).catch(() => [{ measured: 0 }]);

    const [{ controlled }] = await db.query(
      `SELECT COUNT(DISTINCT p.id)::int AS controlled
         FROM patients p
        WHERE EXISTS (
          SELECT 1 FROM patient_diagnoses pd WHERE pd.patient_id = p.id AND pd.icd10_code ILIKE $1
        )
          AND ${controlQuery[condition]}`,
      [icdPattern],
    ).catch(() => [{ controlled: 0 }]);

    const population = Math.round(diagnosed * 1.48);

    const funnelSteps: CascadeStep[] = [
      { label: 'Estimated Population', value: population, denominator: population, percentage: 100, delta: 0, colour: 'teal' },
      { label: 'Diagnosed in System', value: diagnosed, denominator: population, percentage: pct(diagnosed, population), delta: 0, colour: stepColour(pct(diagnosed, population)) },
      { label: 'In Active Care (<6m)', value: in_care, denominator: diagnosed, percentage: pct(in_care, diagnosed), delta: 0, colour: stepColour(pct(in_care, diagnosed)) },
      { label: 'Test Measured', value: measured, denominator: in_care, percentage: pct(measured, in_care), delta: 0, colour: stepColour(pct(measured, in_care)) },
      { label: 'Controlled', value: controlled, denominator: measured, percentage: pct(controlled, measured), delta: 0, colour: stepColour(pct(controlled, measured)) },
    ];

    return {
      funnelSteps,
      controlRate: pct(controlled, measured),
      inCareRate: pct(in_care, diagnosed),
      measurementCoverageRate: pct(measured, in_care),
      gaps: { notInCare: diagnosed - in_care },
    };
  }

  async getHivGap(tenantId: string, gap: 'not-on-art' | 'not-suppressed') {
    const db = await this.getDb(tenantId);
    if (gap === 'not-on-art') {
      return db.query(
        `SELECT p.id AS patient_id, p.full_name AS name,
                p.phone_number AS phone_number,
                e.enrollment_date AS last_seen,
                (CURRENT_DATE - e.enrollment_date::date) AS days_overdue
           FROM hiv_care_enrollments e
           JOIN patients p ON p.id = e.patient_id
          WHERE e.art_start_date IS NULL
            AND COALESCE(e.enrollment_status, 'active') NOT IN ('deceased', 'discontinued', 'transferred_out')
          ORDER BY e.enrollment_date
          LIMIT 500`,
      ).catch(() => []);
    }
    return db.query(
      `SELECT p.id AS patient_id, p.full_name AS name,
              p.phone_number AS phone_number,
              MAX(lr.result_date) AS last_seen,
              (CURRENT_DATE - MAX(lr.result_date)::date) AS days_overdue
         FROM hiv_care_enrollments e
         JOIN patients p ON p.id = e.patient_id
         LEFT JOIN lab_results lr ON lr.patient_id = e.patient_id AND lr.test_type ILIKE '%viral%load%'
        WHERE e.art_start_date IS NOT NULL
          AND COALESCE(e.enrollment_status, 'active') NOT IN ('deceased', 'discontinued')
        GROUP BY p.id, p.full_name, p.phone_number, e.enrollment_date
       HAVING MAX(lr.result_value::numeric) >= 1000 OR MAX(lr.result_date) IS NULL
        ORDER BY last_seen NULLS FIRST
        LIMIT 500`,
    ).catch(() => []);
  }

  async getPmtctGap(tenantId: string) {
    const db = await this.getDb(tenantId);
    return db.query(
      `SELECT p.id AS patient_id, p.full_name AS name, p.phone_number,
              e.enrollment_date AS last_seen, 8 AS days_overdue
         FROM hiv_care_enrollments e
         JOIN patients p ON p.id = e.patient_id
        WHERE e.enrollment_date >= NOW() - INTERVAL '3 months'
          AND NOT EXISTS (
            SELECT 1 FROM eid_results er WHERE er.mother_id = e.patient_id
          )
        ORDER BY e.enrollment_date
        LIMIT 200`,
    ).catch(() => []);
  }

  async getTbHivGap(tenantId: string, period: { start: string; end: string }) {
    const db = await this.getDb(tenantId);
    return db.query(
      `SELECT p.id AS patient_id, p.full_name AS name, p.phone_number,
              tc.date_registered AS last_seen,
              (CURRENT_DATE - tc.date_registered::date) AS days_overdue
         FROM tb_cases tc
         JOIN patients p ON p.id = tc.patient_id
        WHERE tc.date_registered BETWEEN $1::date AND $2::date
          AND (tc.hiv_status_known IS NULL OR tc.hiv_status_known = FALSE)
        ORDER BY tc.date_registered
        LIMIT 500`,
      [period.start, period.end],
    ).catch(() => []);
  }

  async getNcdGap(tenantId: string, condition: string) {
    const db = await this.getDb(tenantId);
    const icdMap: Record<string, string> = { hypertension: 'I1%', diabetes: 'E1%', ckd: 'N18%' };
    const icdPattern = icdMap[condition] ?? 'E1%';
    return db.query(
      `SELECT p.id AS patient_id, p.full_name AS name, p.phone_number,
              MAX(a.appointment_date) AS last_seen,
              (CURRENT_DATE - MAX(a.appointment_date)::date) AS days_overdue
         FROM patients p
         JOIN patient_diagnoses pd ON pd.patient_id = p.id AND pd.icd10_code ILIKE $1
         LEFT JOIN appointments a ON a.patient_id = p.id
        GROUP BY p.id, p.full_name, p.phone_number
       HAVING MAX(a.appointment_date) < NOW() - INTERVAL '6 months' OR MAX(a.appointment_date) IS NULL
        ORDER BY last_seen NULLS FIRST
        LIMIT 500`,
      [icdPattern],
    ).catch(() => []);
  }
}
