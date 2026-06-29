import { Injectable, Optional } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { DatimIndicatorMapping } from '../entities/datim-indicator-mapping.entity';
import { DatimSubmission } from '../entities/datim-submission.entity';
import { ClinicalLlmService } from './clinical-llm.service';

type DatimRow = {
  indicator: string;
  disaggregate: string;
  value: number;
};

type PeriodWindow = {
  period: string;
  periodType: 'monthly' | 'quarterly';
  startDate: string;
  endDate: string;
};

@Injectable()
export class DatimMerService {
  constructor(
    private readonly tenantService: TenantService,
    @Optional() private readonly llm: ClinicalLlmService,
  ) {}

  private parsePeriod(period: string): PeriodWindow {
    if (/^\d{6}$/.test(period)) {
      const year = Number(period.slice(0, 4));
      const month = Number(period.slice(4, 6));
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      return {
        period,
        periodType: 'monthly',
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    }

    const quarterlyMatch = period.match(/^(\d{4})Q([1-4])$/);
    if (quarterlyMatch) {
      const year = Number(quarterlyMatch[1]);
      const quarter = Number(quarterlyMatch[2]);
      const startMonth = (quarter - 1) * 3;
      const start = new Date(Date.UTC(year, startMonth, 1));
      const end = new Date(Date.UTC(year, startMonth + 3, 0));
      return {
        period,
        periodType: 'quarterly',
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    }

    throw new Error(`Unsupported DATIM period format: ${period}`);
  }

  private ageBand(dateOfBirth: string | Date | null | undefined, asOfDate: Date): string {
    if (!dateOfBirth) return 'unknown';
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return 'unknown';

    let age = asOfDate.getUTCFullYear() - dob.getUTCFullYear();
    const monthDelta = asOfDate.getUTCMonth() - dob.getUTCMonth();
    if (monthDelta < 0 || (monthDelta === 0 && asOfDate.getUTCDate() < dob.getUTCDate())) {
      age -= 1;
    }

    if (age < 1) return '<1';
    if (age <= 4) return '1-4';
    if (age <= 9) return '5-9';
    if (age <= 14) return '10-14';
    if (age <= 19) return '15-19';
    if (age <= 24) return '20-24';
    if (age <= 29) return '25-29';
    if (age <= 34) return '30-34';
    if (age <= 39) return '35-39';
    if (age <= 44) return '40-44';
    if (age <= 49) return '45-49';
    return '50+';
  }

  private sexCode(value: string | null | undefined): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized.startsWith('m')) return 'M';
    if (normalized.startsWith('f')) return 'F';
    return 'U';
  }

  private disaggregate(sex: string | null | undefined, dateOfBirth: string | Date | null | undefined, periodEnd: string): string {
    return `${this.sexCode(sex)}_${this.ageBand(dateOfBirth, new Date(`${periodEnd}T00:00:00.000Z`))}`;
  }

  private increment(store: Map<string, number>, indicator: string, disaggregate: string, value = 1) {
    const key = `${indicator}::${disaggregate}`;
    store.set(key, (store.get(key) || 0) + value);
  }

  private flatten(store: Map<string, number>): DatimRow[] {
    return Array.from(store.entries())
      .map(([key, value]) => {
        const [indicator, disaggregate] = key.split('::');
        return { indicator, disaggregate, value };
      })
      .sort((a, b) => {
        if (a.indicator === b.indicator) {
          return a.disaggregate.localeCompare(b.disaggregate);
        }
        return a.indicator.localeCompare(b.indicator);
      });
  }

  private async computeIndicators(tenantId: string, period: string): Promise<DatimRow[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const window = this.parsePeriod(period);
    const counts = new Map<string, number>();

    const txNewRows = await db.query(
      `SELECT p.date_of_birth, p.gender
       FROM hiv_care_enrollments e
       INNER JOIN patients p ON p.id = e.patient_id
       WHERE e.art_start_date >= $1::date
         AND e.art_start_date <= $2::date`,
      [window.startDate, window.endDate],
    );
    for (const row of txNewRows) {
      this.increment(counts, 'TX_NEW', this.disaggregate(row.gender, row.date_of_birth, window.endDate));
    }

    const txCurrRows = await db.query(
      `SELECT DISTINCT e.patient_id, p.date_of_birth, p.gender
       FROM hiv_care_enrollments e
       INNER JOIN patients p ON p.id = e.patient_id
       WHERE e.art_start_date IS NOT NULL
         AND e.art_start_date <= $1::date
         AND (e.transfer_out_date IS NULL OR e.transfer_out_date > $1::date)
         AND COALESCE(e.enrollment_status, 'active') NOT IN ('deceased', 'discontinued')`,
      [window.endDate],
    );
    for (const row of txCurrRows) {
      this.increment(counts, 'TX_CURR', this.disaggregate(row.gender, row.date_of_birth, window.endDate));
    }

    const txPvlsRows = await db.query(
      `SELECT DISTINCT ON (e.patient_id)
          e.patient_id,
          p.date_of_birth,
          p.gender,
          v.viral_load
       FROM hiv_clinical_visits v
       INNER JOIN hiv_care_enrollments e ON e.id = v.enrollment_id
       INNER JOIN patients p ON p.id = e.patient_id
       WHERE v.viral_load IS NOT NULL
         AND COALESCE(v.viral_load_test_date, v.visit_date) >= ($1::date - INTERVAL '12 months')
         AND COALESCE(v.viral_load_test_date, v.visit_date) <= $1::date
         AND e.art_start_date IS NOT NULL
         AND e.art_start_date <= $1::date
         AND (e.transfer_out_date IS NULL OR e.transfer_out_date > $1::date)
       ORDER BY e.patient_id, COALESCE(v.viral_load_test_date, v.visit_date) DESC`,
      [window.endDate],
    );
    for (const row of txPvlsRows) {
      const disaggregate = this.disaggregate(row.gender, row.date_of_birth, window.endDate);
      this.increment(counts, 'TX_PVLS_D', disaggregate);
      if (Number(row.viral_load) < 1000) {
        this.increment(counts, 'TX_PVLS', disaggregate);
      }
    }

    const htsRows = await db.query(
      `SELECT p.date_of_birth, p.gender, h.test_result
       FROM hiv_tests h
       INNER JOIN patients p ON p.id = h.patient_id
       WHERE DATE(h.test_date) >= $1::date
         AND DATE(h.test_date) <= $2::date`,
      [window.startDate, window.endDate],
    );
    for (const row of htsRows) {
      const disaggregate = this.disaggregate(row.gender, row.date_of_birth, window.endDate);
      this.increment(counts, 'HTS_TST', disaggregate);
      const result = String(row.test_result || '').trim().toLowerCase();
      if (result === 'positive' || result === 'reactive') {
        this.increment(counts, 'HTS_TST_POS', disaggregate);
      }
    }

    // MER v3: TX_ML — patients active at period start who had a treatment interruption during the period
    const txMlRows = await db.query(
      `SELECT p.date_of_birth, p.gender, COALESCE(e.enrollment_status, 'active') AS status
       FROM hiv_care_enrollments e
       INNER JOIN patients p ON p.id = e.patient_id
       WHERE e.art_start_date IS NOT NULL
         AND e.art_start_date < $1::date
         AND (
           (e.transfer_out_date >= $1::date AND e.transfer_out_date <= $2::date)
           OR (
             COALESCE(e.enrollment_status, 'active') IN ('ltfu', 'deceased', 'discontinued', 'stopped')
             AND e.updated_at >= $1::timestamp
             AND e.updated_at <= $2::timestamp + INTERVAL '1 day'
           )
         )`,
      [window.startDate, window.endDate],
    );
    for (const row of txMlRows) {
      this.increment(counts, 'TX_ML', this.disaggregate(row.gender, row.date_of_birth, window.endDate));
    }

    // MER v3: TX_RTT — patients who had missed pickups and restarted ART during the period
    const txRttRows = await db.query(
      `SELECT p.date_of_birth, p.gender
       FROM hiv_care_enrollments e
       INNER JOIN patients p ON p.id = e.patient_id
       WHERE e.art_restart_date >= $1::date
         AND e.art_restart_date <= $2::date`,
      [window.startDate, window.endDate],
    );
    for (const row of txRttRows) {
      this.increment(counts, 'TX_RTT', this.disaggregate(row.gender, row.date_of_birth, window.endDate));
    }

    return this.flatten(counts);
  }

  private previousPeriod(period: string): string {
    if (/^\d{6}$/.test(period)) {
      const year = Number(period.slice(0, 4));
      const month = Number(period.slice(4, 6));
      const prev = new Date(Date.UTC(year, month - 2, 1));
      return `${prev.getUTCFullYear()}${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    const quarterlyMatch = period.match(/^(\d{4})Q([1-4])$/);
    if (quarterlyMatch) {
      const year = Number(quarterlyMatch[1]);
      const quarter = Number(quarterlyMatch[2]);
      if (quarter === 1) return `${year - 1}Q4`;
      return `${year}Q${quarter - 1}`;
    }
    throw new Error(`Cannot compute previous period for: ${period}`);
  }

  async previewIndicators(tenantId: string, period: string): Promise<any> {
    const rows = await this.computeIndicators(tenantId, period);
    return { period, rows };
  }

  async submitToDatim(tenantId: string, period: string, orgUnitUid: string): Promise<DatimSubmission> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const submissionRepo = db.getRepository(DatimSubmission);
    const mappingRepo = db.getRepository(DatimIndicatorMapping);
    const rows = await this.computeIndicators(tenantId, period);

    const mappings = await mappingRepo.find();
    const mappingIndex = new Map(mappings.map((item) => [`${item.merIndicator}::${item.disaggregate}`, item]));
    const dataSet = String(process.env.DATIM_DATASET_UID || '').trim();
    const username = String(process.env.DATIM_USERNAME || '').trim();
    const password = String(process.env.DATIM_PASSWORD || '').trim();
    const configuredBase = String(process.env.DATIM_BASE_URL || '').trim();
    const endpoint = configuredBase.includes('/api/dataValueSets')
      ? configuredBase
      : `${configuredBase.replace(/\/$/, '')}/api/dataValueSets`;

    const dataValues = rows
      .map((row) => {
        const mapping = mappingIndex.get(`${row.indicator}::${row.disaggregate}`);
        if (!mapping) return null;
        return {
          dataElement: mapping.datimDeUid,
          categoryOptionCombo: mapping.datimCocUid,
          value: row.value,
        };
      })
      .filter((value): value is { dataElement: string; categoryOptionCombo: string; value: number } => Boolean(value));

    if (!dataSet || !username || !password || !configuredBase) {
      const failed = submissionRepo.create({
        period,
        orgUnitUid,
        indicatorCount: dataValues.length,
        status: 'failed',
        errorMessage: 'DATIM configuration missing',
      });
      return submissionRepo.save(failed) as unknown as DatimSubmission;
    }

    const payload = {
      dataSet,
      period,
      orgUnit: orgUnitUid,
      dataValues,
    };

    try {
      const response = await axios.post(endpoint, payload, {
        auth: { username, password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      const saved = submissionRepo.create({
        period,
        orgUnitUid,
        indicatorCount: dataValues.length,
        status: 'submitted',
        datimImportSummary: response.data,
        submittedAt: new Date(),
      });
      return submissionRepo.save(saved) as unknown as DatimSubmission;
    } catch (error: any) {
      const failed = submissionRepo.create({
        period,
        orgUnitUid,
        indicatorCount: dataValues.length,
        status: 'failed',
        errorMessage:
          typeof error?.response?.data === 'string'
            ? error.response.data
            : JSON.stringify(error?.response?.data || error?.message || 'DATIM submission failed'),
      });
      return submissionRepo.save(failed) as unknown as DatimSubmission;
    }
  }

  async getSubmissions(tenantId: string): Promise<DatimSubmission[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(DatimSubmission).find({ order: { createdAt: 'DESC' } });
  }

  async upsertIndicatorMapping(tenantId: string, body: any): Promise<DatimIndicatorMapping> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(DatimIndicatorMapping);
    await repo.upsert(body, ['merIndicator', 'disaggregate']);
    return repo.findOne({
      where: {
        merIndicator: body.merIndicator,
        disaggregate: body.disaggregate,
      },
    }) as unknown as Promise<DatimIndicatorMapping>;
  }

  async getIndicatorMappings(tenantId: string): Promise<DatimIndicatorMapping[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(DatimIndicatorMapping).find({ order: { merIndicator: 'ASC', disaggregate: 'ASC' } });
  }

  // ─── Extended MER 3.0 Indicators ─────────────────────────────────────────

  private async computeTxTb(db: any, period: string): Promise<DatimRow[]> {
    const window = this.parsePeriod(period);
    const counts = new Map<string, number>();
    const rows = await db.query(
      `SELECT p.date_of_birth, p.gender
         FROM hiv_clinical_visits v
         INNER JOIN hiv_care_enrollments e ON e.id = v.enrollment_id
         INNER JOIN patients p ON p.id = e.patient_id
        WHERE v.tb_screened = TRUE
          AND v.visit_date >= $1::date AND v.visit_date <= $2::date`,
      [window.startDate, window.endDate],
    ).catch(() => [] as any[]);
    for (const row of rows) {
      this.increment(counts, 'TX_TB', this.disaggregate(row.gender, row.date_of_birth, window.endDate));
    }
    return this.flatten(counts);
  }

  private async computeTxTbDenominator(db: any, period: string): Promise<DatimRow[]> {
    const window = this.parsePeriod(period);
    const counts = new Map<string, number>();
    const rows = await db.query(
      `SELECT DISTINCT e.patient_id, p.date_of_birth, p.gender
         FROM hiv_care_enrollments e
         INNER JOIN patients p ON p.id = e.patient_id
        WHERE e.art_start_date IS NOT NULL
          AND e.art_start_date <= $1::date
          AND (e.transfer_out_date IS NULL OR e.transfer_out_date > $1::date)
          AND COALESCE(e.enrollment_status, 'active') NOT IN ('deceased', 'discontinued')`,
      [window.endDate],
    ).catch(() => [] as any[]);
    for (const row of rows) {
      this.increment(counts, 'TX_TB_D', this.disaggregate(row.gender, row.date_of_birth, window.endDate));
    }
    return this.flatten(counts);
  }

  private async computeTbStat(db: any, period: string): Promise<{ numerator: DatimRow[]; denominator: DatimRow[] }> {
    const window = this.parsePeriod(period);
    const numCounts = new Map<string, number>();
    const denCounts = new Map<string, number>();
    const rows = await db.query(
      `SELECT hiv_status_known, hiv_result, p.date_of_birth, p.gender
         FROM tb_cases tc
         INNER JOIN patients p ON p.id = tc.patient_id
        WHERE tc.date_registered >= $1::date AND tc.date_registered <= $2::date`,
      [window.startDate, window.endDate],
    ).catch(() => [] as any[]);
    for (const row of rows) {
      const dis = this.disaggregate(row.gender, row.date_of_birth, window.endDate);
      this.increment(denCounts, 'TB_STAT_D', dis);
      if (row.hiv_status_known) this.increment(numCounts, 'TB_STAT', dis);
    }
    return { numerator: this.flatten(numCounts), denominator: this.flatten(denCounts) };
  }

  private async computeTbArt(db: any, period: string): Promise<DatimRow[]> {
    const window = this.parsePeriod(period);
    const counts = new Map<string, number>();
    const rows = await db.query(
      `SELECT p.date_of_birth, p.gender, tc.art_start_date IS NOT NULL AND tc.art_start_date < tc.date_registered AS already_on_art
         FROM tb_cases tc
         INNER JOIN patients p ON p.id = tc.patient_id
        WHERE tc.date_registered >= $1::date AND tc.date_registered <= $2::date
          AND tc.hiv_result = 'positive'
          AND tc.art_started = TRUE`,
      [window.startDate, window.endDate],
    ).catch(() => [] as any[]);
    for (const row of rows) {
      const dis = `${row.already_on_art ? 'Already on ART' : 'New on ART'}`;
      this.increment(counts, 'TB_ART', dis);
    }
    return this.flatten(counts);
  }

  private async computeTbPrev(db: any, period: string): Promise<DatimRow[]> {
    const window = this.parsePeriod(period);
    const counts = new Map<string, number>();
    const rows = await db.query(
      `SELECT t.hiv_patient_id IS NOT NULL AS on_art
         FROM tb_preventive_therapy t
        WHERE t.completion_date >= $1::date AND t.completion_date <= $2::date
          AND t.status = 'completed'`,
      [window.startDate, window.endDate],
    ).catch(() => [] as any[]);
    for (const row of rows) {
      this.increment(counts, 'TB_PREV', row.on_art ? 'New on ART' : 'Previously on ART');
    }
    return this.flatten(counts);
  }

  private async computePmtctEid(db: any, period: string): Promise<{ early: number; late: number }> {
    const window = this.parsePeriod(period);
    const rows = await db.query(
      `SELECT age_weeks_at_test
         FROM eid_results
        WHERE sample_date >= $1::date AND sample_date <= $2::date`,
      [window.startDate, window.endDate],
    ).catch(() => [] as any[]);
    let early = 0;
    let late = 0;
    for (const row of rows) {
      const weeks = Number(row.age_weeks_at_test ?? 99);
      if (weeks <= 8) early++;
      else if (weeks <= 52) late++;
    }
    return { early, late };
  }

  private async computePmtctFo(db: any, period: string): Promise<{ hivFree: number; hivInfected: number; deceased: number; ltfu: number }> {
    const window = this.parsePeriod(period);
    const rows = await db.query(
      `SELECT o.outcome_type
         FROM encounter_outcomes o
        WHERE o.encounter_type = 'delivery'
          AND o.follow_up_window_days = 365
          AND o.outcome_date >= $1::date AND o.outcome_date <= $2::date`,
      [window.startDate, window.endDate],
    ).catch(() => [] as any[]);
    let hivFree = 0, hivInfected = 0, deceased = 0, ltfu = 0;
    for (const row of rows) {
      const t = row.outcome_type;
      if (t === 'alive_stable' || t === 'cured') hivFree++;
      else if (t === 'alive_uncontrolled' || t === 'alive_in_care') hivInfected++;
      else if (t === 'deceased') deceased++;
      else if (t === 'ltfu') ltfu++;
    }
    return { hivFree, hivInfected, deceased, ltfu };
  }

  private async computeHtsSelf(db: any, period: string): Promise<DatimRow[]> {
    const window = this.parsePeriod(period);
    const counts = new Map<string, number>();
    const rows = await db.query(
      `SELECT recipient_sex, recipient_age_band, key_population, result_returned, result, linked_to_hts
         FROM hts_self_tests
        WHERE distribution_date >= $1::date AND distribution_date <= $2::date`,
      [window.startDate, window.endDate],
    ).catch(() => [] as any[]);
    for (const row of rows) {
      const sex = row.recipient_sex ?? 'Unknown';
      const band = row.recipient_age_band ?? 'Unknown';
      this.increment(counts, 'HTS_SELF', `${sex}_${band}`);
    }
    return this.flatten(counts);
  }

  async getExtendedIndicators(tenantId: string, period: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const [txTb, txTbD, tbStat, tbArt, tbPrev, pmtctEid, pmtctFo, htsSelf] = await Promise.all([
      this.computeTxTb(db, period),
      this.computeTxTbDenominator(db, period),
      this.computeTbStat(db, period),
      this.computeTbArt(db, period),
      this.computeTbPrev(db, period),
      this.computePmtctEid(db, period),
      this.computePmtctFo(db, period),
      this.computeHtsSelf(db, period),
    ]);
    const txTbTotal = txTb.reduce((s, r) => s + r.value, 0);
    const txTbDTotal = txTbD.reduce((s, r) => s + r.value, 0);
    const tbStatNum = tbStat.numerator.reduce((s, r) => s + r.value, 0);
    const tbStatDen = tbStat.denominator.reduce((s, r) => s + r.value, 0);
    const tbArtTotal = tbArt.reduce((s, r) => s + r.value, 0);
    const tbPrevTotal = tbPrev.reduce((s, r) => s + r.value, 0);
    const htsSelfTotal = htsSelf.reduce((s, r) => s + r.value, 0);
    return {
      period,
      tbHiv: {
        txTb: { rows: txTb, total: txTbTotal },
        txTbD: { rows: txTbD, total: txTbDTotal },
        coverage: txTbDTotal > 0 ? Math.round((txTbTotal / txTbDTotal) * 1000) / 10 : 0,
        tbStat: { numerator: tbStatNum, denominator: tbStatDen, rows: tbStat.numerator,
          coverage: tbStatDen > 0 ? Math.round((tbStatNum / tbStatDen) * 1000) / 10 : 0 },
        tbArt: { rows: tbArt, total: tbArtTotal,
          coverage: tbStatNum > 0 ? Math.round((tbArtTotal / tbStatNum) * 1000) / 10 : 0 },
        tbPrev: { rows: tbPrev, total: tbPrevTotal },
      },
      pmtct: { eid: pmtctEid, fo: pmtctFo },
      htsSelf: {
        rows: htsSelf,
        total: htsSelfTotal,
        female: htsSelf.filter((r) => r.disaggregate.startsWith('F')).reduce((s, r) => s + r.value, 0),
        male: htsSelf.filter((r) => r.disaggregate.startsWith('M')).reduce((s, r) => s + r.value, 0),
      },
    };
  }

  async recordTpt(tenantId: string, body: { patientId: string; hivPatientId?: string; regimen: string; startDate: string }): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const regimenDays: Record<string, number> = { '6H': 180, '3HP': 90, '1HP': 30, '4R': 120 };
    const days = regimenDays[body.regimen] ?? 180;
    const start = new Date(body.startDate);
    const expectedEnd = new Date(start.getTime() + days * 86_400_000).toISOString().slice(0, 10);
    const [row] = await db.query(
      `INSERT INTO tb_preventive_therapy
        (patient_id, tenant_id, hiv_patient_id, regimen, start_date, expected_end, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
      [body.patientId, tenantId, body.hivPatientId ?? null, body.regimen, body.startDate, expectedEnd],
    );
    return row;
  }

  async recordHtsSelf(tenantId: string, body: any): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const [row] = await db.query(
      `INSERT INTO hts_self_tests
        (tenant_id, distribution_date, kit_type, distribution_point, recipient_age_band,
         recipient_sex, key_population, result_returned, result, linked_to_hts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        tenantId, body.distributionDate, body.kitType ?? 'oral',
        body.distributionPoint ?? null, body.recipientAgeBand ?? null,
        body.recipientSex ?? null, body.keyPopulation ?? null,
        body.resultReturned ?? false, body.result ?? null, body.linkedToHts ?? false,
      ],
    );
    return row;
  }

  async generateAnomalyNarrative(tenantId: string, period: string): Promise<{ narrative: string; anomalies: any[]; model: string | null }> {
    const [current, prevPeriod] = await Promise.all([
      this.computeIndicators(tenantId, period),
      this.computeIndicators(tenantId, this.previousPeriod(period)).catch(() => [] as DatimRow[]),
    ]);

    const prevIndex = new Map(prevPeriod.map((r) => [`${r.indicator}::${r.disaggregate}`, r.value]));

    // Aggregate totals per indicator for easier comparison
    const totals = new Map<string, number>();
    for (const r of current) {
      totals.set(r.indicator, (totals.get(r.indicator) ?? 0) + r.value);
    }
    const prevTotals = new Map<string, number>();
    for (const r of prevPeriod) {
      prevTotals.set(r.indicator, (prevTotals.get(r.indicator) ?? 0) + r.value);
    }

    const anomalies: Array<{ indicator: string; current: number; previous: number; pctChange: number }> = [];
    for (const [indicator, curr] of totals.entries()) {
      const prev = prevTotals.get(indicator) ?? 0;
      if (prev === 0 && curr === 0) continue;
      const pctChange = prev === 0 ? 100 : Math.round(((curr - prev) / prev) * 100);
      if (Math.abs(pctChange) >= 10 || prev === 0) {
        anomalies.push({ indicator, current: curr, previous: prev, pctChange });
      }
    }
    anomalies.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));

    if (!this.llm?.isConfigured() || anomalies.length === 0) {
      const lines = anomalies.map((a) => {
        const dir = a.pctChange >= 0 ? `up ${a.pctChange}%` : `down ${Math.abs(a.pctChange)}%`;
        return `• ${a.indicator}: ${a.current} (${dir} vs previous period, was ${a.previous})`;
      });
      return {
        narrative: lines.length
          ? `Indicator summary vs previous period:\n${lines.join('\n')}`
          : 'No significant changes detected compared to the previous reporting period.',
        anomalies,
        model: null,
      };
    }

    const bulletList = anomalies
      .slice(0, 10)
      .map((a) => {
        const dir = a.pctChange >= 0 ? `increased by ${a.pctChange}%` : `decreased by ${Math.abs(a.pctChange)}%`;
        return `- ${a.indicator}: ${a.current} (${dir} vs previous period of ${a.previous})`;
      })
      .join('\n');

    const prompt =
      `You are a public health data analyst reviewing PEPFAR MER indicator data for a healthcare facility.\n` +
      `The following indicators changed significantly compared to the previous reporting period (${this.previousPeriod(period)} → ${period}):\n\n` +
      `${bulletList}\n\n` +
      `Write a concise plain-language narrative (3–5 sentences) for a clinician reviewing these indicators before submitting to DATIM. ` +
      `Highlight the most concerning changes, suggest likely causes, and recommend any immediate follow-up actions. ` +
      `Be specific to HIV/TB programme management. Do not add headers or bullet points — write as continuous prose.`;

    const result = await this.llm.generate(prompt, { context: 'datim_anomaly_narrative', maxTokens: 400, temperature: 0.3 });

    return {
      narrative: result?.text ?? anomalies.map((a) => `${a.indicator}: ${a.current} (${a.pctChange >= 0 ? '+' : ''}${a.pctChange}% vs ${a.previous})`).join('; '),
      anomalies,
      model: result?.model ?? null,
    };
  }
}
