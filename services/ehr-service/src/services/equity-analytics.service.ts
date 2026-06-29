import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

const AGE_BANDS = [
  { label: '0-4', min: 0, max: 4 },
  { label: '5-14', min: 5, max: 14 },
  { label: '15-24', min: 15, max: 24 },
  { label: '25-49', min: 25, max: 49 },
  { label: '50-64', min: 50, max: 64 },
  { label: '65+', min: 65, max: 999 },
];

type Dimension = 'age_band' | 'sex' | 'location' | 'insurance';

type KpiName =
  | 'anc_coverage'
  | 'delivery_facility'
  | 'hiv_on_art'
  | 'tb_treatment_success'
  | 'hypertension_controlled'
  | 'diabetes_controlled'
  | 'vaccination_coverage'
  | 'nutrition_sam_recovery';

const KPI_QUERIES: Record<KpiName, {
  numeratorSql: (dim: string, period: string) => string;
  denominatorSql: (dim: string, period: string) => string;
}> = {
  anc_coverage: {
    numeratorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(DISTINCT patient_id) AS n
       FROM anc_visits
       WHERE TO_CHAR(visit_date,'YYYYMM') = '${period}'
       GROUP BY 1`,
    denominatorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(*) AS d
       FROM patients
       WHERE status='active'
       GROUP BY 1`,
  },
  delivery_facility: {
    numeratorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(*) AS n
       FROM maternity_deliveries
       WHERE TO_CHAR(delivery_date,'YYYYMM') = '${period}' AND delivery_location='facility'
       GROUP BY 1`,
    denominatorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(*) AS d
       FROM maternity_deliveries
       WHERE TO_CHAR(delivery_date,'YYYYMM') = '${period}'
       GROUP BY 1`,
  },
  hiv_on_art: {
    numeratorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(DISTINCT patient_id) AS n
       FROM hiv_art_regimens
       WHERE status='active' AND TO_CHAR(start_date,'YYYYMM') <= '${period}'
       GROUP BY 1`,
    denominatorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(DISTINCT patient_id) AS d
       FROM hiv_diagnoses
       WHERE TO_CHAR(diagnosis_date,'YYYYMM') <= '${period}'
       GROUP BY 1`,
  },
  tb_treatment_success: {
    numeratorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(*) AS n
       FROM tb_cases
       WHERE outcome IN ('cured','treatment_completed') AND TO_CHAR(outcome_date,'YYYYMM') = '${period}'
       GROUP BY 1`,
    denominatorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(*) AS d
       FROM tb_cases
       WHERE outcome IS NOT NULL AND TO_CHAR(outcome_date,'YYYYMM') = '${period}'
       GROUP BY 1`,
  },
  hypertension_controlled: {
    numeratorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(DISTINCT patient_id) AS n
       FROM vitals
       WHERE TO_CHAR(recorded_at,'YYYYMM') = '${period}' AND systolic_bp < 140 AND diastolic_bp < 90
       GROUP BY 1`,
    denominatorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(DISTINCT patient_id) AS d
       FROM chronic_disease_registry
       WHERE condition_code='I10' AND status='active'
       GROUP BY 1`,
  },
  diabetes_controlled: {
    numeratorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(DISTINCT patient_id) AS n
       FROM lab_results lr
       WHERE TO_CHAR(lr.resulted_at,'YYYYMM') = '${period}'
         AND lr.test_name ILIKE '%HbA1c%' AND lr.numeric_value < 7.0
       GROUP BY 1`,
    denominatorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(DISTINCT patient_id) AS d
       FROM chronic_disease_registry
       WHERE condition_code IN ('E10','E11','E13') AND status='active'
       GROUP BY 1`,
  },
  vaccination_coverage: {
    numeratorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(DISTINCT patient_id) AS n
       FROM immunization_records
       WHERE TO_CHAR(administered_date,'YYYYMM') = '${period}'
       GROUP BY 1`,
    denominatorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(*) AS d
       FROM patients WHERE status='active'
       GROUP BY 1`,
  },
  nutrition_sam_recovery: {
    numeratorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(*) AS n
       FROM nutrition_admissions
       WHERE discharge_outcome='recovered' AND TO_CHAR(discharge_date,'YYYYMM') = '${period}'
       GROUP BY 1`,
    denominatorSql: (dim, period) =>
      `SELECT ${dim} AS dval, COUNT(*) AS d
       FROM nutrition_admissions
       WHERE discharge_date IS NOT NULL AND TO_CHAR(discharge_date,'YYYYMM') = '${period}'
       GROUP BY 1`,
  },
};

@Injectable()
export class EquityAnalyticsService {
  constructor(private readonly tenantService: TenantService) {}

  async disaggregate(tenantId: string, kpi: string, dimension: Dimension, period: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);

    const dimCol = this.resolveDimColumn(dimension);
    const query = await this.buildDisaggregateQuery(db, kpi, dimCol, period, dimension);

    const equityRatio = this.computeEquityRatio(query);

    await this.upsertResults(db, tenantId, kpi, dimension, period, query);

    return {
      kpi,
      dimension,
      period,
      data: query,
      equity_ratio: equityRatio,
      equity_gap: this.describeGap(query),
    };
  }

  async getHeatMatrix(tenantId: string, period: string, kpis: string[]): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const dimensions: Dimension[] = ['sex', 'age_band'];
    const matrix: any[] = [];

    for (const kpi of kpis.slice(0, 5)) {
      for (const rowDim of dimensions) {
        for (const colDim of dimensions) {
          if (rowDim === colDim) continue;
          try {
            const rowData = await this.disaggregate(tenantId, kpi, rowDim, period);
            const colData = await this.disaggregate(tenantId, kpi, colDim, period);

            for (const r of rowData.data) {
              for (const c of colData.data) {
                if (!r.dval || !c.dval) continue;
                const avgRate = r.rate != null && c.rate != null ? (Number(r.rate) + Number(c.rate)) / 2 : null;
                matrix.push({
                  kpi,
                  row_dim: rowDim, row_value: r.dval,
                  col_dim: colDim, col_value: c.dval,
                  rate: avgRate,
                  equity_ratio: rowData.equity_ratio,
                });
              }
            }
          } catch { /* skip if table doesn't exist */ }
        }
      }
    }

    return { period, matrix };
  }

  async getEquitySummary(tenantId: string, period: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const rows = await db.query(
      `SELECT kpi_name, dimension, dimension_value, rate
       FROM equity_kpi_results
       WHERE tenant_id=$1 AND period=$2
       ORDER BY kpi_name, dimension, rate`,
      [tenantId, period],
    ).catch(() => []);

    const grouped: Record<string, any> = {};
    for (const r of rows) {
      const key = `${r.kpi_name}__${r.dimension}`;
      if (!grouped[key]) grouped[key] = { kpi: r.kpi_name, dimension: r.dimension, values: [] };
      grouped[key].values.push({ label: r.dimension_value, rate: Number(r.rate) });
    }

    return Object.values(grouped).map((g: any) => ({
      ...g,
      equity_ratio: this.computeEquityRatio(g.values.map((v: any) => ({ dval: v.label, rate: v.rate }))),
    }));
  }

  private async buildDisaggregateQuery(db: any, kpi: string, dimCol: string, period: string, dimension: Dimension) {
    const def = KPI_QUERIES[kpi as KpiName];
    if (!def) return [];

    try {
      const numRows = await db.query(def.numeratorSql(dimCol, period));
      const denRows = await db.query(def.denominatorSql(dimCol, period));

      const denMap: Record<string, number> = {};
      for (const r of denRows) denMap[r.dval] = Number(r.d);

      return numRows.map((r: any) => {
        const d = denMap[r.dval] ?? 0;
        const n = Number(r.n);
        const rate = d > 0 ? n / d : null;

        if (dimension === 'age_band') {
          const band = this.mapAgeBand(r.dval);
          return { dval: band, numerator: n, denominator: d, rate };
        }
        return { dval: r.dval, numerator: n, denominator: d, rate };
      }).filter((r: any) => r.dval);
    } catch {
      return [];
    }
  }

  private computeEquityRatio(data: { rate: number | null }[]): number | null {
    const rates = data.map(d => d.rate).filter((r): r is number => r !== null && r > 0);
    if (rates.length < 2) return null;
    const best = Math.max(...rates);
    const worst = Math.min(...rates);
    return best > 0 ? Number((worst / best).toFixed(4)) : null;
  }

  private describeGap(data: { dval: string; rate: number | null }[]): string | null {
    const valid = data.filter(d => d.rate !== null) as { dval: string; rate: number }[];
    if (valid.length < 2) return null;
    const sorted = [...valid].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const gapPp = ((best.rate - worst.rate) * 100).toFixed(1);
    return `${best.dval} (${(best.rate * 100).toFixed(1)}%) vs ${worst.dval} (${(worst.rate * 100).toFixed(1)}%) — ${gapPp}pp gap`;
  }

  private resolveDimColumn(dimension: Dimension): string {
    switch (dimension) {
      case 'age_band': return 'EXTRACT(YEAR FROM AGE(date_of_birth))::INT';
      case 'sex': return 'sex';
      case 'location': return 'COALESCE(district, province, \'Unknown\')';
      case 'insurance': return 'COALESCE(insurance_type, \'uninsured\')';
    }
  }

  private mapAgeBand(ageOrStr: any): string {
    const age = Number(ageOrStr);
    if (isNaN(age)) return ageOrStr;
    for (const band of AGE_BANDS) {
      if (age >= band.min && age <= band.max) return band.label;
    }
    return '65+';
  }

  private async upsertResults(db: any, tenantId: string, kpi: string, dimension: string, period: string, data: any[]) {
    for (const row of data) {
      if (!row.dval || row.rate == null) continue;
      await db.query(
        `INSERT INTO equity_kpi_results
           (tenant_id, kpi_name, dimension, dimension_value, period, numerator, denominator, rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tenant_id, kpi_name, dimension, dimension_value, period)
         DO UPDATE SET numerator=$6, denominator=$7, rate=$8, computed_at=NOW()`,
        [tenantId, kpi, dimension, row.dval, period, row.numerator ?? 0, row.denominator ?? 0, row.rate],
      ).catch(() => { /* table may not exist yet */ });
    }
  }
}
