import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';

interface MetricDef {
  label: string;
  sql: (period: string) => string;
  higherIsBetter: boolean;
}

const METRICS: Record<string, MetricDef> = {
  hiv_viral_suppression: {
    label: 'HIV Viral Suppression Rate',
    sql: (p) => `
      SELECT COALESCE(
        COUNT(*) FILTER (WHERE vl_result < 1000)::NUMERIC /
        NULLIF(COUNT(*) FILTER (WHERE vl_result IS NOT NULL), 0), 0)
      FROM hiv_viral_loads WHERE TO_CHAR(collection_date,'YYYYMM') = '${p}'`,
    higherIsBetter: true,
  },
  tb_treatment_success: {
    label: 'TB Treatment Success Rate',
    sql: (p) => `
      SELECT COALESCE(
        COUNT(*) FILTER (WHERE outcome IN ('cured','treatment_completed'))::NUMERIC /
        NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 0)
      FROM tb_cases WHERE TO_CHAR(outcome_date,'YYYYMM') = '${p}'`,
    higherIsBetter: true,
  },
  anc_first_visit_before_16w: {
    label: 'ANC First Visit <16 Weeks',
    sql: (p) => `
      SELECT COALESCE(
        COUNT(*) FILTER (WHERE gestational_age_weeks < 16)::NUMERIC /
        NULLIF(COUNT(*), 0), 0)
      FROM anc_visits WHERE visit_number = 1 AND TO_CHAR(visit_date,'YYYYMM') = '${p}'`,
    higherIsBetter: true,
  },
  facility_delivery_rate: {
    label: 'Facility Delivery Rate',
    sql: (p) => `
      SELECT COALESCE(
        COUNT(*) FILTER (WHERE delivery_location = 'facility')::NUMERIC /
        NULLIF(COUNT(*), 0), 0)
      FROM maternity_deliveries WHERE TO_CHAR(delivery_date,'YYYYMM') = '${p}'`,
    higherIsBetter: true,
  },
  hypertension_controlled: {
    label: 'Hypertension Control Rate',
    sql: (p) => `
      SELECT COALESCE(
        COUNT(DISTINCT v.patient_id) FILTER (WHERE v.systolic_bp < 140)::NUMERIC /
        NULLIF(COUNT(DISTINCT r.patient_id), 0), 0)
      FROM chronic_disease_registry r
      LEFT JOIN vitals v ON v.patient_id = r.patient_id
        AND TO_CHAR(v.recorded_at,'YYYYMM') = '${p}'
      WHERE r.condition_code = 'I10' AND r.status = 'active'`,
    higherIsBetter: true,
  },
  average_lab_tat_hours: {
    label: 'Average Lab TAT (hours)',
    sql: (p) => `
      SELECT COALESCE(AVG(
        EXTRACT(EPOCH FROM (resulted_at - ordered_at))/3600
      ), 0)
      FROM lab_orders WHERE TO_CHAR(ordered_at,'YYYYMM') = '${p}' AND resulted_at IS NOT NULL`,
    higherIsBetter: false,
  },
  appointment_kept_rate: {
    label: 'Appointment Kept Rate',
    sql: (p) => `
      SELECT COALESCE(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC /
        NULLIF(COUNT(*), 0), 0)
      FROM appointments WHERE TO_CHAR(scheduled_date,'YYYYMM') = '${p}'`,
    higherIsBetter: true,
  },
  prescription_error_rate: {
    label: 'Prescription Error Rate',
    sql: (p) => `
      SELECT COALESCE(
        COUNT(*) FILTER (WHERE status = 'cancelled' AND cancellation_reason ILIKE '%error%')::NUMERIC /
        NULLIF(COUNT(*), 0), 0)
      FROM prescriptions WHERE TO_CHAR(created_at,'YYYYMM') = '${p}'`,
    higherIsBetter: false,
  },
};

// Synthetic national P75 benchmarks (Zimbabwe MOHCC targets where available)
const NATIONAL_P75: Record<string, number> = {
  hiv_viral_suppression: 0.95,
  tb_treatment_success: 0.90,
  anc_first_visit_before_16w: 0.60,
  facility_delivery_rate: 0.80,
  hypertension_controlled: 0.65,
  average_lab_tat_hours: 6,
  appointment_kept_rate: 0.75,
  prescription_error_rate: 0.005,
};

@Injectable()
export class BenchmarkingService {
  private readonly logger = new Logger(BenchmarkingService.name);

  constructor(private readonly tenantService: TenantService) {}

  async computeFacilitySnapshot(tenantId: string, facilityId: string, period: string): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);

    for (const [metricName, def] of Object.entries(METRICS)) {
      let rawValue: number | null = null;
      try {
        const [row] = await db.query(def.sql(period));
        rawValue = row ? Number(Object.values(row)[0]) : null;
      } catch { /* table may not exist */ }

      if (rawValue === null) continue;

      const natP75 = NATIONAL_P75[metricName] ?? null;
      const status = this.rateStatus(rawValue, natP75, def.higherIsBetter);

      // Peer percentile: compare vs own historical snapshots as a proxy
      const history = await db.query(
        `SELECT raw_value FROM facility_benchmark_snapshots
         WHERE tenant_id=$1 AND facility_id=$2 AND metric_name=$3
           AND period < $4
         ORDER BY period DESC LIMIT 12`,
        [tenantId, facilityId, metricName, period],
      ).catch((e: any) => { this.logger.warn(`facility_benchmark_snapshots history query failed: ${e?.message}`); return []; });

      const vals = history.map((r: any) => Number(r.raw_value)).filter((v: number) => !isNaN(v));
      vals.push(rawValue);
      vals.sort((a: number, b: number) => a - b);
      const rank = vals.length > 1
        ? vals.indexOf(rawValue) / (vals.length - 1) * 100
        : 50;

      await db.query(
        `INSERT INTO facility_benchmark_snapshots
           (tenant_id, facility_id, metric_name, period, raw_value,
            peer_p25, peer_p50, peer_p75, national_p75, percentile_rank, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (tenant_id, facility_id, metric_name, period)
         DO UPDATE SET raw_value=$5, peer_p25=$6, peer_p50=$7, peer_p75=$8,
           national_p75=$9, percentile_rank=$10, status=$11, computed_at=NOW()`,
        [
          tenantId, facilityId, metricName, period, rawValue,
          this.percentile(vals, 25), this.percentile(vals, 50), this.percentile(vals, 75),
          natP75, Number(rank.toFixed(1)), status,
        ],
      ).catch((e: any) => this.logger.warn(`facility_benchmark_snapshots INSERT failed: ${e?.message}`));
    }
  }

  async getFacilityScorecard(tenantId: string, facilityId: string, period: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const rows = await db.query(
      `SELECT metric_name, raw_value, peer_p25, peer_p50, peer_p75, national_p75, percentile_rank, status
       FROM facility_benchmark_snapshots
       WHERE tenant_id=$1 AND facility_id=$2 AND period=$3
       ORDER BY metric_name`,
      [tenantId, facilityId, period],
    ).catch((e: any) => { this.logger.warn(`facility_benchmark_snapshots scorecard query failed: ${e?.message}`); return []; });

    return {
      facility_id: facilityId,
      period,
      metrics: rows.map((r: any) => ({
        name: r.metric_name,
        label: METRICS[r.metric_name]?.label ?? r.metric_name,
        value: Number(r.raw_value),
        peer_p25: r.peer_p25 != null ? Number(r.peer_p25) : null,
        peer_p50: r.peer_p50 != null ? Number(r.peer_p50) : null,
        peer_p75: r.peer_p75 != null ? Number(r.peer_p75) : null,
        national_p75: r.national_p75 != null ? Number(r.national_p75) : null,
        percentile_rank: Number(r.percentile_rank),
        status: r.status,
        higher_is_better: METRICS[r.metric_name]?.higherIsBetter ?? true,
      })),
      overall_score: this.overallScore(rows),
    };
  }

  async getTrend(tenantId: string, facilityId: string, metricName: string, periods = 12): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const rows = await db.query(
      `SELECT period, raw_value, percentile_rank, status
       FROM facility_benchmark_snapshots
       WHERE tenant_id=$1 AND facility_id=$2 AND metric_name=$3
       ORDER BY period DESC LIMIT $4`,
      [tenantId, facilityId, metricName, periods],
    ).catch((e: any) => { this.logger.warn(`facility_benchmark_snapshots trend query failed: ${e?.message}`); return []; });
    return rows.reverse();
  }

  async getMetricDefinitions(): Promise<any[]> {
    return Object.entries(METRICS).map(([key, def]) => ({
      key,
      label: def.label,
      higher_is_better: def.higherIsBetter,
      national_p75: NATIONAL_P75[key] ?? null,
    }));
  }

  private percentile(sorted: number[], p: number): number | null {
    if (sorted.length === 0) return null;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  private rateStatus(value: number, target: number | null, higherIsBetter: boolean): string {
    if (target == null) return 'no_target';
    const ratio = higherIsBetter ? value / target : target / value;
    if (ratio >= 1.0) return 'above_target';
    if (ratio >= 0.8) return 'near_target';
    return 'below_target';
  }

  private overallScore(rows: any[]): number {
    if (rows.length === 0) return 0;
    const scores = rows.map((r: any) => {
      const rank = Number(r.percentile_rank) / 100;
      return METRICS[r.metric_name]?.higherIsBetter ?? true ? rank : 1 - rank;
    });
    return Number(((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(1));
  }
}
