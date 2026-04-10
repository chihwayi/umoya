import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { DatimIndicatorMapping } from '../entities/datim-indicator-mapping.entity';
import { DatimSubmission } from '../entities/datim-submission.entity';

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
  constructor(private readonly tenantService: TenantService) {}

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

    return this.flatten(counts);
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
    const configuredBase = String(process.env.DATIM_BASE_URL || 'https://datim.org').trim();
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

    if (!dataSet || !username || !password) {
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
}
