import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { MohccReportSubmission } from '../entities/mohcc-report-submission.entity';
import { OpenMrsMigrationLog } from '../entities/openmrs-migration-log.entity';
import axios from 'axios';

@Injectable()
export class HimisReportingService {
  private readonly logger = new Logger(HimisReportingService.name);
  private himisUrl = process.env.MOHCC_HIMIS_URL || 'http://himis.mohcc.gov.zw/api';

  constructor(private readonly tenantService: TenantService) {}

  // ── MOHCC HIMIS Submission ─────────────────────────────────────────────────

  async submitHimisMonthly(subdomain: string, periodLabel: string, submittedBy?: string): Promise<MohccReportSubmission> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);

    // Aggregate monthly indicators from DB
    const [opd, ipd, labs] = await Promise.all([
      ds.query(`SELECT COUNT(*) AS cnt FROM appointments WHERE DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', $1::date)`, [periodLabel + '-01']).catch(() => [{ cnt: 0 }]),
      ds.query(`SELECT COUNT(*) AS cnt FROM admissions WHERE DATE_TRUNC('month', admission_date) = DATE_TRUNC('month', $1::date)`, [periodLabel + '-01']).catch(() => [{ cnt: 0 }]),
      ds.query(`SELECT COUNT(*) AS cnt FROM lab_orders WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $1::date)`, [periodLabel + '-01']).catch(() => [{ cnt: 0 }]),
    ]);

    const payload = {
      reportType: 'HIMIS_MONTHLY',
      period: periodLabel,
      indicators: {
        opd_visits: Number(opd[0]?.cnt || 0),
        ipd_admissions: Number(ipd[0]?.cnt || 0),
        lab_tests_done: Number(labs[0]?.cnt || 0),
      },
    };

    const repo = ds.getRepository(MohccReportSubmission);
    const record = await repo.save(repo.create({
      reportType: 'HIMIS_MONTHLY',
      periodLabel,
      payload,
      submittedBy,
      status: 'pending',
    }));

    // Submit async
    this.pushToHimis(ds, record.id, payload).catch(e =>
      this.logger.warn(`HIMIS submission failed for ${periodLabel}: ${e?.message}`));

    return record;
  }

  async getSubmissions(subdomain: string, reportType?: string): Promise<MohccReportSubmission[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: any = reportType ? { reportType } : {};
    return ds.getRepository(MohccReportSubmission).find({ where, order: { createdAt: 'DESC' } });
  }

  // ── OpenMRS Migration ──────────────────────────────────────────────────────

  async migrateFromOpenMrs(subdomain: string, batchId: string, records: Array<{
    resourceType: string; openmrsUuid: string; data: any;
  }>): Promise<{ migrated: number; failed: number }> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const logRepo = ds.getRepository(OpenMrsMigrationLog);
    let migrated = 0;
    let failed = 0;

    for (const rec of records) {
      try {
        const medicoreId = await this.importOpenMrsRecord(ds, rec.resourceType, rec.data);
        await logRepo.save(logRepo.create({
          batchId, resourceType: rec.resourceType,
          openmrsUuid: rec.openmrsUuid,
          medicoreId,
          rawRecord: rec.data,
          status: 'migrated',
        }));
        migrated++;
      } catch (e: any) {
        await logRepo.save(logRepo.create({
          batchId, resourceType: rec.resourceType,
          openmrsUuid: rec.openmrsUuid,
          rawRecord: rec.data,
          errorDetails: e.message,
          status: 'failed',
        }));
        failed++;
      }
    }

    return { migrated, failed };
  }

  async getMigrationLogs(subdomain: string, batchId?: string): Promise<OpenMrsMigrationLog[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: any = batchId ? { batchId } : {};
    return ds.getRepository(OpenMrsMigrationLog).find({ where, order: { migratedAt: 'DESC' } });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async pushToHimis(ds: any, recordId: string, payload: any): Promise<void> {
    const repo = ds.getRepository(MohccReportSubmission);
    try {
      const { data, status } = await axios.post(`${this.himisUrl}/submit`, payload, {
        headers: { Authorization: `Bearer ${process.env.MOHCC_HIMIS_TOKEN || ''}` },
        timeout: 15000,
      });
      await repo.update(recordId, {
        status: 'submitted',
        submittedAt: new Date(),
        responseCode: String(status),
        responseMessage: data?.message || 'OK',
      });
    } catch (e: any) {
      await repo.update(recordId, {
        status: 'rejected',
        responseMessage: e?.message,
      });
      throw e;
    }
  }

  private async importOpenMrsRecord(ds: any, resourceType: string, data: any): Promise<string | undefined> {
    switch (resourceType) {
      case 'Patient': {
        const result = await ds.query(
          `INSERT INTO patients (first_name, last_name, date_of_birth, gender, national_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (national_id) DO UPDATE SET first_name = EXCLUDED.first_name RETURNING id`,
          [data.givenName, data.familyName, data.birthdate, data.gender, data.identifiers?.[0]?.identifier],
        ).catch(() => []);
        return result[0]?.id;
      }
      default:
        return undefined;
    }
  }

  // ── Monthly auto-submission ────────────────────────────────────────────────

  @Cron('0 3 5 * *') // 5th of each month at 03:00
  async monthlyHimisSubmission() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodLabel = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    this.logger.log(`Auto-submitting HIMIS report for ${periodLabel}…`);
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const subdomain of tenants) {
        await this.submitHimisMonthly(subdomain, periodLabel, 'auto').catch(e =>
          this.logger.error(`HIMIS auto-submit failed for ${subdomain}: ${e?.message}`));
      }
    } catch (e: any) {
      this.logger.error(`HIMIS monthly sweep error: ${e?.message}`);
    }
  }
}
