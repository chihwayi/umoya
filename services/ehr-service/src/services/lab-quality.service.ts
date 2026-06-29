import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class LabQualityService {
  constructor(private readonly tenantService: TenantService) {}

  async recordEqaScore(tenantId: string, dto: any): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const zScore = dto.z_score ?? this.computeZScore(dto.assigned_value, dto.measured_value, dto.sd);
    const resultFlag = this.eqaFlag(Math.abs(zScore));
    const result = await db.query(
      `INSERT INTO lab_eqa_scores
         (tenant_id, scheme_name, survey_round, analyte, specimen_type,
          assigned_value, measured_value, unit, z_score, result_flag,
          report_date, corrective_action_taken)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        tenantId, dto.scheme_name, dto.survey_round, dto.analyte,
        dto.specimen_type ?? null, dto.assigned_value, dto.measured_value,
        dto.unit ?? null, zScore, resultFlag, dto.report_date,
        dto.corrective_action_taken ?? null,
      ],
    );
    return result[0];
  }

  async recordQcFailure(tenantId: string, dto: any): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const result = await db.query(
      `INSERT INTO lab_qc_failures
         (tenant_id, analyzer_id, analyte, qc_level, expected_range_low,
          expected_range_high, measured_value, rule_violated, failure_date,
          action_taken, patient_samples_held)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        tenantId, dto.analyzer_id ?? null, dto.analyte, dto.qc_level,
        dto.expected_range_low ?? null, dto.expected_range_high ?? null,
        dto.measured_value, dto.rule_violated ?? null, dto.failure_date,
        dto.action_taken ?? null, dto.patient_samples_held ?? 0,
      ],
    );
    return result[0];
  }

  async checkAndFlagRepeatTest(
    tenantId: string,
    newOrderId: string,
    patientId: string,
    analyte: string,
  ): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const prior = await db.query(
      `SELECT id, ordered_at FROM lab_orders
       WHERE tenant_id = $1 AND patient_id = $2
         AND test_code = $3 AND id <> $4
         AND ordered_at >= NOW() - INTERVAL '7 days'
       ORDER BY ordered_at DESC LIMIT 1`,
      [tenantId, patientId, analyte, newOrderId],
    );
    if (!prior.length) return;
    const newOrder = await db.query(
      `SELECT ordered_at FROM lab_orders WHERE id = $1`,
      [newOrderId],
    );
    if (!newOrder.length) return;
    const days = Math.round(
      (new Date(newOrder[0].ordered_at).getTime() - new Date(prior[0].ordered_at).getTime()) / 86400000,
    );
    const flagReason =
      days < 1 ? 'possible_error_repeat' : days <= 3 ? 'clinically_justified_close' : 'surveillance';
    await db.query(
      `INSERT INTO lab_repeat_test_flags
         (tenant_id, patient_id, analyte, first_order_id, repeat_order_id, days_between, flag_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [tenantId, patientId, analyte, prior[0].id, newOrderId, days, flagReason],
    );
  }

  async getLabQualitySummary(tenantId: string, period: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const year = period.slice(0, 4);
    const month = period.slice(4, 6);
    const startDate = `${year}-${month}-01`;

    const [eqaRow] = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE result_flag = 'satisfactory') AS satisfactory,
         COUNT(*) FILTER (WHERE result_flag = 'warning') AS warning,
         COUNT(*) FILTER (WHERE result_flag IN ('unsatisfactory','unacceptable')) AS unsatisfactory
       FROM lab_eqa_scores
       WHERE tenant_id = $1
         AND DATE_TRUNC('month', report_date) = DATE_TRUNC('month', $2::DATE)`,
      [tenantId, startDate],
    );

    const qcRows = await db.query(
      `SELECT analyte, COUNT(*) AS cnt
       FROM lab_qc_failures
       WHERE tenant_id = $1
         AND DATE_TRUNC('month', failure_date) = DATE_TRUNC('month', $2::TIMESTAMPTZ)
       GROUP BY analyte ORDER BY cnt DESC`,
      [tenantId, startDate],
    );

    const [repeatRow] = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE flag_reason = 'possible_error_repeat') AS possible_error,
         COUNT(*) FILTER (WHERE flag_reason = 'clinically_justified_close') AS clinically_close,
         COUNT(*) AS total
       FROM lab_repeat_test_flags
       WHERE tenant_id = $1
         AND DATE_TRUNC('month', flagged_at) = DATE_TRUNC('month', $2::TIMESTAMPTZ)`,
      [tenantId, startDate],
    );

    const [tatRow] = await db.query(
      `SELECT
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - ordered_at))/3600) AS p50_hours,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - ordered_at))/3600) AS p95_hours
       FROM lab_orders
       WHERE tenant_id = $1
         AND completed_at IS NOT NULL
         AND DATE_TRUNC('month', ordered_at) = DATE_TRUNC('month', $2::TIMESTAMPTZ)`,
      [tenantId, startDate],
    );

    const [critRow] = await db.query(
      `SELECT
         COUNT(*) AS total_critical,
         COUNT(*) FILTER (WHERE notified_at IS NOT NULL
           AND EXTRACT(EPOCH FROM (notified_at - resulted_at))/3600 <= 1) AS notified_within_1h
       FROM lab_critical_values
       WHERE tenant_id = $1
         AND DATE_TRUNC('month', resulted_at) = DATE_TRUNC('month', $2::TIMESTAMPTZ)`,
      [tenantId, startDate],
    );

    const [rejRow] = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
         COUNT(*) AS total
       FROM lab_orders
       WHERE tenant_id = $1
         AND DATE_TRUNC('month', ordered_at) = DATE_TRUNC('month', $2::TIMESTAMPTZ)`,
      [tenantId, startDate],
    );

    const byAnalyte: Record<string, number> = {};
    qcRows.forEach((r: any) => { byAnalyte[r.analyte] = Number(r.cnt); });

    const totalCritical = Number(critRow?.total_critical ?? 0);
    const totalOrders = Number(rejRow?.total ?? 0);

    return {
      eqa_scores: {
        satisfactory: Number(eqaRow?.satisfactory ?? 0),
        warning: Number(eqaRow?.warning ?? 0),
        unsatisfactory: Number(eqaRow?.unsatisfactory ?? 0),
      },
      qc_failures: {
        total: qcRows.reduce((s: number, r: any) => s + Number(r.cnt), 0),
        by_analyte: byAnalyte,
      },
      repeat_test_flags: {
        possible_error: Number(repeatRow?.possible_error ?? 0),
        clinically_close: Number(repeatRow?.clinically_close ?? 0),
        total: Number(repeatRow?.total ?? 0),
      },
      turnaround_p50_hours: tatRow?.p50_hours ? Number(Number(tatRow.p50_hours).toFixed(1)) : null,
      turnaround_p95_hours: tatRow?.p95_hours ? Number(Number(tatRow.p95_hours).toFixed(1)) : null,
      critical_value_notification_rate: totalCritical > 0
        ? Number(((Number(critRow.notified_within_1h) / totalCritical) * 100).toFixed(1)) : null,
      specimen_rejection_rate: totalOrders > 0
        ? Number(((Number(rejRow.rejected) / totalOrders) * 100).toFixed(1)) : null,
    };
  }

  async getEqaZScoreTrend(tenantId: string, analyte: string): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.query(
      `SELECT survey_round AS round, z_score, result_flag AS flag, scheme_name
       FROM lab_eqa_scores
       WHERE tenant_id = $1 AND analyte = $2
       ORDER BY report_date ASC`,
      [tenantId, analyte],
    );
  }

  async getRepeatFlags(tenantId: string, startDate: string, endDate: string): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.query(
      `SELECT rtf.*,
              rtf.flagged_at::date AS flag_date
       FROM lab_repeat_test_flags rtf
       WHERE rtf.tenant_id = $1
         AND rtf.flagged_at >= $2::DATE
         AND rtf.flagged_at < $3::DATE + INTERVAL '1 day'
       ORDER BY rtf.flagged_at DESC
       LIMIT 200`,
      [tenantId, startDate, endDate],
    );
  }

  private computeZScore(assigned: number, measured: number, sd?: number): number {
    if (!sd || sd === 0) return 0;
    return Number(((measured - assigned) / sd).toFixed(2));
  }

  private eqaFlag(absZ: number): string {
    if (absZ <= 2) return 'satisfactory';
    if (absZ <= 3) return 'warning';
    return 'unacceptable';
  }
}
