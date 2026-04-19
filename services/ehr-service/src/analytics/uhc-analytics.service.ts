import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { Dhis2Service } from '../services/dhis2.service';
import { UhcIndicatorSnapshot } from './entities/uhc-indicator-snapshot.entity';
import { SdgIndicatorTarget } from './entities/sdg-indicator-target.entity';

@Injectable()
export class UhcAnalyticsService {
  private readonly logger = new Logger(UhcAnalyticsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly dhis2Service: Dhis2Service,
  ) {}

  private async tenantDb(tenantId: string): Promise<DataSource> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) {
      throw new NotFoundException('Tenant database unavailable');
    }
    return db;
  }

  private parsePct(row: Record<string, any> | undefined, keys: string[]): number | null {
    if (!row) return null;
    for (const k of keys) {
      const v = row[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        const n = parseFloat(String(v));
        if (Number.isFinite(n)) {
          return Math.round(n * 100) / 100;
        }
      }
    }
    return null;
  }

  private async safeQuery(tenantDb: DataSource, sql: string, params: unknown[]): Promise<any[]> {
    try {
      return await tenantDb.query(sql, params);
    } catch {
      return [];
    }
  }

  private async computeAnc4Coverage(tenantDb: DataSource, year: number): Promise<number | null> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT (
        COUNT(*) FILTER (WHERE visit_group.visits >= 4)::float
        / NULLIF(COUNT(*) FILTER (WHERE visit_group.visits >= 1), 0)
      ) * 100 AS pct
      FROM (
        SELECT maternity_enrollment_id, COUNT(*)::int AS visits
        FROM anc_visits
        WHERE EXTRACT(YEAR FROM visit_date::timestamp) = $1
        GROUP BY maternity_enrollment_id
      ) AS visit_group
      `,
      [year],
    );
    return this.parsePct(rows[0], ['pct']);
  }

  private async computeDtp3Coverage(tenantDb: DataSource, year: number): Promise<number | null> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      WITH cohort AS (
        SELECT COUNT(DISTINCT patient_id)::float AS n
        FROM immunization_records
        WHERE EXTRACT(YEAR FROM administered_at::timestamp) = $1
      )
      SELECT COUNT(DISTINCT ir.patient_id)::float / NULLIF((SELECT n FROM cohort), 0) * 100 AS pct
      FROM immunization_records ir
      WHERE ir.dose_number >= 3
        AND (
          LOWER(ir.vaccine_name) LIKE '%dtp%'
          OR LOWER(ir.vaccine_name) LIKE '%pcv%'
          OR LOWER(ir.vaccine_name) LIKE '%pentavalent%'
        )
        AND EXTRACT(YEAR FROM ir.administered_at::timestamp) = $1
      `,
      [year],
    );
    return this.parsePct(rows[0], ['pct']);
  }

  private async computeMeaslesCoverage(tenantDb: DataSource, year: number): Promise<number | null> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      WITH cohort AS (
        SELECT COUNT(DISTINCT patient_id)::float AS n
        FROM immunization_records
        WHERE EXTRACT(YEAR FROM administered_at::timestamp) = $1
      )
      SELECT COUNT(DISTINCT ir.patient_id)::float / NULLIF((SELECT n FROM cohort), 0) * 100 AS pct
      FROM immunization_records ir
      WHERE (
          LOWER(ir.vaccine_name) LIKE '%measles%'
          OR LOWER(ir.vaccine_name) LIKE '%mcv%'
          OR LOWER(ir.vaccine_name) LIKE '%rubella%'
        )
        AND EXTRACT(YEAR FROM ir.administered_at::timestamp) = $1
      `,
      [year],
    );
    return this.parsePct(rows[0], ['pct']);
  }

  private async computeArtCoverage(tenantDb: DataSource): Promise<number | null> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT COUNT(*) FILTER (WHERE art_started = true)::float
        / NULLIF(COUNT(*) FILTER (WHERE LOWER(TRIM(hiv_status_at_booking)) = 'positive'), 0) * 100 AS pct
      FROM pmtct_enrollments
      `,
      [],
    );
    return this.parsePct(rows[0], ['pct']);
  }

  private async computeTbSuccessRate(tenantDb: DataSource, year: number): Promise<number | null> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT COUNT(*) FILTER (
          WHERE LOWER(COALESCE(outcome, '')) IN ('cured', 'treatment_completed', 'completed')
        )::float
        / NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL AND TRIM(outcome) <> ''), 0) * 100 AS pct
      FROM tb_treatment_episodes
      WHERE EXTRACT(YEAR FROM COALESCE(outcome_date::timestamp, actual_end::timestamp, start_date::timestamp)) = $1
      `,
      [year],
    );
    return this.parsePct(rows[0], ['pct']);
  }

  private async computeHtnCoverage(tenantDb: DataSource): Promise<number | null> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT COUNT(*) FILTER (WHERE LOWER(TRIM(status)) IN ('active', 'controlled'))::float
        / NULLIF(COUNT(*), 0) * 100 AS pct
      FROM htn_register
      `,
      [],
    );
    return this.parsePct(rows[0], ['pct']);
  }

  private async computeCbhiCoverage(tenantDb: DataSource): Promise<number | null> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT COUNT(*) FILTER (WHERE LOWER(TRIM(membership_status)) = 'active')::float
        / NULLIF(COUNT(*), 0) * 100 AS pct
      FROM cbhi_households
      `,
      [],
    );
    return this.parsePct(rows[0], ['pct']);
  }

  async getTargetsMap(tenantId: string): Promise<Record<string, number>> {
    const db = await this.tenantDb(tenantId);
    const targets = await db.getRepository(SdgIndicatorTarget).find({ where: { isActive: true } });
    return Object.fromEntries(
      targets.map((t) => {
        const useNational = t.nationalTarget != null && !Number.isNaN(Number(t.nationalTarget));
        const v = useNational ? Number(t.nationalTarget) : Number(t.targetValue);
        return [t.indicatorCode, v];
      }),
    );
  }

  async computeIndicators(tenantId: string, year: number, quarter?: number): Promise<UhcIndicatorSnapshot> {
    const db = await this.tenantDb(tenantId);
    const snapshotRepo = db.getRepository(UhcIndicatorSnapshot);

    const [
      anc4,
      dtp3,
      measles,
      artCoverage,
      tbSuccess,
      htnCoverage,
      cbhiCoverage,
    ] = await Promise.all([
      this.computeAnc4Coverage(db, year),
      this.computeDtp3Coverage(db, year),
      this.computeMeaslesCoverage(db, year),
      this.computeArtCoverage(db),
      this.computeTbSuccessRate(db, year),
      this.computeHtnCoverage(db),
      this.computeCbhiCoverage(db),
    ]);

    const snapshot = await snapshotRepo.save(
      snapshotRepo.create({
        periodYear: year,
        periodQuarter: quarter ?? null,
        periodMonth: null,
        anc4Coverage: anc4,
        dtp3Coverage: dtp3,
        measlesCoverage: measles,
        hivArtCoverage: artCoverage,
        tbTreatmentSuccessRate: tbSuccess,
        htnTreatmentCoverage: htnCoverage,
        cbhiCoverage,
        computedAt: new Date(),
        computationMethod: 'facility_query',
        cdssGapFlags: [],
        cdssPriorityActions: [],
      }),
    );

    try {
      const targets = await this.getTargetsMap(tenantId);
      const indicators: Record<string, number> = {};
      if (anc4 !== null) indicators.anc4_coverage = anc4;
      if (dtp3 !== null) indicators.dtp3_coverage = dtp3;
      if (measles !== null) indicators.measles_coverage = measles;
      if (artCoverage !== null) indicators.hiv_art_coverage = artCoverage;
      if (tbSuccess !== null) indicators.tb_treatment_success_rate = tbSuccess;
      if (htnCoverage !== null) indicators.htn_treatment_coverage = htnCoverage;
      if (cbhiCoverage !== null) indicators.cbhi_coverage = cbhiCoverage;

      const cdssRaw = await this.cdssService.uhcGapAnalysis(
        {
          indicators,
          targets,
          facility_type: 'district',
          country: 'Zimbabwe',
          year,
        },
        tenantId,
      );

      const abstained = cdssRaw?.abstained === true;
      const body = cdssRaw as Record<string, any>;
      if (!abstained && body && typeof body === 'object') {
        const sci = body.uhc_sci_score ?? body.uhcSciScore;
        const patch: Partial<UhcIndicatorSnapshot> = {
          cdssGapFlags: Array.isArray(body.gap_flags) ? body.gap_flags : [],
          cdssPriorityActions: Array.isArray(body.priority_actions) ? body.priority_actions : [],
        };
        if (sci != null && sci !== '') {
          patch.uhcSciComposite = Number(sci);
        }
        if (body.confidence != null && body.confidence !== '') {
          patch.cdssConfidence = Number(body.confidence);
        }
        await snapshotRepo.update(snapshot.id, patch);
      }
    } catch (e: any) {
      this.logger.warn(`CDSS UHC gap analysis failed: ${e?.message || e}`);
    }

    const updated = await snapshotRepo.findOne({ where: { id: snapshot.id } });
    if (!updated) {
      throw new NotFoundException('Snapshot not found after compute');
    }
    return updated;
  }

  async getSnapshots(tenantId: string, year?: number): Promise<UhcIndicatorSnapshot[]> {
    const db = await this.tenantDb(tenantId);
    const repo = db.getRepository(UhcIndicatorSnapshot);
    const where = year != null ? { periodYear: year } : {};
    return repo.find({ where, order: { computedAt: 'DESC' } });
  }

  async getLatestSnapshot(tenantId: string): Promise<UhcIndicatorSnapshot | null> {
    const db = await this.tenantDb(tenantId);
    return db.getRepository(UhcIndicatorSnapshot).findOne({
      where: {},
      order: { computedAt: 'DESC' },
    });
  }

  async getTargets(tenantId: string): Promise<SdgIndicatorTarget[]> {
    const db = await this.tenantDb(tenantId);
    return db.getRepository(SdgIndicatorTarget).find({
      where: { isActive: true },
      order: { sdgGoal: 'ASC', indicatorCode: 'ASC' },
    });
  }

  async updateTarget(
    tenantId: string,
    code: string,
    targetValue: number,
    nationalTarget?: number,
  ): Promise<SdgIndicatorTarget> {
    const db = await this.tenantDb(tenantId);
    const repo = db.getRepository(SdgIndicatorTarget);
    const target = await repo.findOne({ where: { indicatorCode: code } });
    if (!target) {
      throw new NotFoundException(`Target ${code} not found`);
    }
    await repo.update(target.id, {
      targetValue,
      ...(nationalTarget !== undefined ? { nationalTarget } : {}),
    });
    const next = await repo.findOne({ where: { id: target.id } });
    if (!next) {
      throw new NotFoundException('Target not found after update');
    }
    return next;
  }

  async pushToDhis2(tenantId: string, snapshotId: string): Promise<Record<string, unknown>> {
    const db = await this.tenantDb(tenantId);
    const snapshot = await db.getRepository(UhcIndicatorSnapshot).findOne({ where: { id: snapshotId } });
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }
    const month = snapshot.periodMonth ?? (snapshot.periodQuarter != null ? snapshot.periodQuarter * 3 : 12);
    const period = `${snapshot.periodYear}${String(month).padStart(2, '0')}`;
    const aggregate = await this.dhis2Service.sendAggregateReport(
      {
        profile: 'maternal_newborn',
        period,
        dataValues: [],
      },
      db,
      tenantId,
    );
    return {
      snapshotId,
      delegated: true,
      dhis2: aggregate,
      note:
        'DHIS2 aggregate push uses configured maternal_newborn profile metrics for the period; extend mapping to attach explicit UHC snapshot data elements when configured.',
    };
  }
}
