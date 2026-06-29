import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { Dhis2Service } from './dhis2.service';

const OUTLIER_THRESHOLD = 0.20; // 20% deviation
const OUTLIER_CRITICAL = 0.50;  // 50% = critical

@Injectable()
export class Dhis2ValidationService {
  private readonly logger = new Logger(Dhis2ValidationService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly dhis2Service: Dhis2Service,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runNightlyValidation() {
    this.logger.log('DHIS2 nightly validation sweep starting');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const tenant of tenants.slice(0, 50)) {
        await this.runValidationForTenant(tenant.id).catch(err =>
          this.logger.warn(`Validation failed for tenant ${tenant.id}: ${err.message}`),
        );
      }
    } catch (err: any) {
      this.logger.error('Nightly validation sweep failed: ' + err.message);
    }
  }

  async runValidationForTenant(tenantId: string, period?: string): Promise<any> {
    const p = period || this.lastMonthPeriod();
    const db = await this.tenantService.getTenantDatabase(tenantId);

    // Pull available data elements from DHIS2 (using existing dhis2Service client)
    const dhis2Values = await this.pullDhis2DataValues(tenantId, p);
    if (!dhis2Values.length) return { pulled: 0, outliers: 0 };

    const local = await this.computeLocalValues(db, tenantId, p);

    let outliersFound = 0;
    for (const dv of dhis2Values) {
      const localVal = local[dv.dataElementCode ?? dv.dataElementId];
      const deviation = this.computeDeviation(Number(dv.value), localVal);
      const isOutlier = Math.abs(deviation) > OUTLIER_THRESHOLD;
      const severity = Math.abs(deviation) > OUTLIER_CRITICAL ? 'critical' : isOutlier ? 'warning' : 'ok';
      if (isOutlier) outliersFound++;

      await db.query(
        `INSERT INTO dhis2_validation_snapshots
           (tenant_id, data_element_id, data_element_name, period, org_unit_id,
            dhis2_value, local_value, deviation_pct, outlier_flag, outlier_severity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (tenant_id, data_element_id, period, org_unit_id)
         DO UPDATE SET dhis2_value=$6, local_value=$7, deviation_pct=$8,
           outlier_flag=$9, outlier_severity=$10, pulled_at=NOW()`,
        [
          tenantId, dv.dataElementId, dv.dataElementName ?? null, p,
          dv.orgUnit ?? '', dv.value, localVal ?? null,
          Math.round(deviation * 10000) / 100,
          isOutlier, severity,
        ],
      ).catch(() => { /* table may not exist yet */ });
    }

    return { period: p, pulled: dhis2Values.length, outliers: outliersFound };
  }

  async getOutlierReport(tenantId: string, period: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const p = period || this.lastMonthPeriod();
    const [outliers, summary] = await Promise.all([
      db.query(
        `SELECT data_element_name, data_element_id, dhis2_value, local_value,
                deviation_pct, outlier_severity, pulled_at
         FROM dhis2_validation_snapshots
         WHERE tenant_id=$1 AND period=$2 AND outlier_flag=true
         ORDER BY ABS(deviation_pct) DESC`,
        [tenantId, p],
      ).catch(() => []),
      db.query(
        `SELECT outlier_severity, COUNT(*)::int AS n
         FROM dhis2_validation_snapshots
         WHERE tenant_id=$1 AND period=$2
         GROUP BY outlier_severity`,
        [tenantId, p],
      ).catch(() => []),
    ]);

    const summaryMap: Record<string, number> = {};
    for (const r of summary) summaryMap[r.outlier_severity] = Number(r.n);

    return {
      period: p,
      total_checked: Object.values(summaryMap).reduce((a, b) => a + b, 0),
      ok: summaryMap['ok'] ?? 0,
      warnings: summaryMap['warning'] ?? 0,
      critical: summaryMap['critical'] ?? 0,
      outliers: outliers.map((r: any) => ({
        name: r.data_element_name ?? r.data_element_id,
        dhis2: r.dhis2_value != null ? Number(r.dhis2_value) : null,
        local: r.local_value != null ? Number(r.local_value) : null,
        deviation_pct: Number(r.deviation_pct),
        severity: r.outlier_severity,
        pulled_at: r.pulled_at,
      })),
    };
  }

  async resolveAlert(
    tenantId: string,
    dataElementId: string,
    period: string,
    resolution: 'investigated' | 'accepted_correct' | 'corrected',
    resolvedBy: string,
    note?: string,
  ): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.query(
      `UPDATE dhis2_validation_snapshots
          SET outlier_flag = (CASE WHEN $5 = 'corrected' THEN true ELSE false END),
              resolved_at = NOW(), resolved_by = $4, resolution = $5, resolution_note = $6
        WHERE tenant_id = $1 AND data_element_id = $2 AND period = $3`,
      [tenantId, dataElementId, period, resolvedBy, resolution, note ?? null],
    ).catch(() => { /* column may not exist on older schemas */ });
  }

  async getDqaScore(tenantId: string, period: string): Promise<{ score: number; period: string }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const [total, unresolved] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS n FROM dhis2_validation_snapshots WHERE tenant_id=$1 AND period=$2`,
        [tenantId, period],
      ).catch(() => [{ n: 0 }]),
      db.query(
        `SELECT COUNT(*)::int AS n FROM dhis2_validation_snapshots WHERE tenant_id=$1 AND period=$2 AND outlier_flag=true AND resolved_at IS NULL`,
        [tenantId, period],
      ).catch(() => [{ n: 0 }]),
    ]);
    const t = Number(total[0]?.n ?? 0);
    const u = Number(unresolved[0]?.n ?? 0);
    const score = t === 0 ? 100 : Math.round(((t - u) / t) * 1000) / 10;
    return { score, period };
  }

  async getValidationHistory(tenantId: string, dataElementId: string, periods = 6): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const rows = await db.query(
      `SELECT period, dhis2_value, local_value, deviation_pct, outlier_severity
       FROM dhis2_validation_snapshots
       WHERE tenant_id=$1 AND data_element_id=$2
       ORDER BY period DESC LIMIT $3`,
      [tenantId, dataElementId, periods],
    ).catch(() => []);
    return rows.reverse();
  }

  private async pullDhis2DataValues(tenantId: string, period: string): Promise<any[]> {
    try {
      const periodFmt = period.slice(0, 4) + period.slice(4, 6); // YYYYMM → already in that format
      const result = await (this.dhis2Service as any).pullDataValues?.(tenantId, periodFmt);
      if (Array.isArray(result)) return result;
    } catch { /* DHIS2 may not be configured */ }
    return [];
  }

  private async computeLocalValues(db: any, tenantId: string, period: string): Promise<Record<string, number>> {
    // Map commonly pushed data elements to local counts
    const [newPatients, outpatient, hivVl, tbCases, anc, delivery, immuniz] = await Promise.allSettled([
      db.query(`SELECT COUNT(*)::int AS n FROM patients WHERE tenant_id=$1 AND TO_CHAR(created_at,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM encounters WHERE tenant_id=$1 AND encounter_type='outpatient' AND TO_CHAR(encounter_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM hiv_viral_loads WHERE tenant_id=$1 AND TO_CHAR(collection_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM tb_cases WHERE tenant_id=$1 AND TO_CHAR(notification_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM anc_visits WHERE tenant_id=$1 AND TO_CHAR(visit_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM maternity_deliveries WHERE tenant_id=$1 AND TO_CHAR(delivery_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM immunization_records WHERE tenant_id=$1 AND TO_CHAR(administered_date,'YYYYMM')=$2`, [tenantId, period]),
    ]);
    const get = (s: PromiseSettledResult<any>) =>
      s.status === 'fulfilled' ? Number(s.value?.[0]?.n ?? 0) : 0;
    return {
      'MC_DE_NEW_PATIENTS': get(newPatients),
      'MC_DE_OPD_VISITS': get(outpatient),
      'MC_DE_HIV_VL_TESTS': get(hivVl),
      'MC_DE_TB_NOTIFICATIONS': get(tbCases),
      'MC_DE_ANC_VISITS': get(anc),
      'MC_DE_DELIVERIES': get(delivery),
      'MC_DE_IMMUNIZATIONS': get(immuniz),
    };
  }

  private computeDeviation(dhis2Val: number, localVal: number | undefined | null): number {
    if (localVal == null || localVal === 0) return dhis2Val > 0 ? 1 : 0;
    return (dhis2Val - localVal) / localVal;
  }

  private lastMonthPeriod(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7).replace('-', '');
  }
}
