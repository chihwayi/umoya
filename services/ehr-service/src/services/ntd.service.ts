import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { NtdCase } from '../entities/ntd-case.entity';
import { CholeraCase } from '../entities/cholera-case.entity';
import { TyphoidCase } from '../entities/typhoid-case.entity';
import { RegionalDiseaseReport } from '../entities/regional-disease-report.entity';
import axios from 'axios';

@Injectable()
export class NtdService {
  constructor(private readonly tenantService: TenantService) {}

  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // ── NTD Cases ──────────────────────────────────────────────────────────────

  async addNtdCase(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(NtdCase);
    return repo.save(repo.create(dto));
  }

  async getNtdCases(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(NtdCase).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateNtdCase(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(NtdCase);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Cholera Cases ─────────────────────────────────────────────────────────

  async addCholeraCase(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CholeraCase);
    return repo.save(repo.create(dto));
  }

  async getCholeraCases(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(CholeraCase).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateCholeraCase(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CholeraCase);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Typhoid Cases ─────────────────────────────────────────────────────────

  async addTyphoidCase(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(TyphoidCase);
    return repo.save(repo.create(dto));
  }

  async getTyphoidCases(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(TyphoidCase).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateTyphoidCase(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(TyphoidCase);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Regional Disease Reports ───────────────────────────────────────────────

  async upsertReport(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(RegionalDiseaseReport);
    const existing = await repo.findOne({
      where: { reportPeriod: dto.reportPeriod, periodType: dto.periodType },
    });
    if (existing) {
      await repo.update(existing.id, dto);
      return repo.findOneBy({ id: existing.id });
    }
    return repo.save(repo.create(dto));
  }

  async getReports(subdomain: string, periodType?: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const qb = ds.getRepository(RegionalDiseaseReport)
      .createQueryBuilder('r')
      .orderBy('r.report_period', 'DESC');
    if (periodType) qb.where('r.period_type = :periodType', { periodType });
    return qb.getMany();
  }

  async aggregateReport(subdomain: string, reportPeriod: string, periodType: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const raw = await ds.query(
      `SELECT
        (SELECT COUNT(*) FROM cholera_cases WHERE created_at::date >= $2 AND created_at::date <= $3) AS cholera_cases,
        (SELECT COUNT(*) FROM typhoid_cases WHERE created_at::date >= $2 AND created_at::date <= $3) AS typhoid_cases,
        (SELECT COUNT(*) FROM ntd_cases WHERE created_at::date >= $2 AND created_at::date <= $3) AS ntd_cases,
        (SELECT COUNT(*) FROM ntd_cases WHERE disease = 'schistosomiasis' AND created_at::date >= $2 AND created_at::date <= $3) AS schistosomiasis_cases`,
      [reportPeriod, this.periodStart(reportPeriod, periodType), this.periodEnd(reportPeriod, periodType)]
    );
    return raw[0];
  }

  private periodStart(period: string, type: string): string {
    if (type === 'weekly') {
      const [year, week] = period.split('-W').map(Number);
      const d = new Date(year, 0, 1 + (week - 1) * 7);
      return d.toISOString().split('T')[0];
    }
    return `${period}-01`;
  }

  private periodEnd(period: string, type: string): string {
    if (type === 'weekly') {
      const [year, week] = period.split('-W').map(Number);
      const d = new Date(year, 0, 1 + (week - 1) * 7 + 6);
      return d.toISOString().split('T')[0];
    }
    const [year, month] = period.split('-').map(Number);
    const last = new Date(year, month, 0);
    return last.toISOString().split('T')[0];
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async screenNtd(payload: any) {
    const { data } = await axios.post(`${this.cdssUrl}/ntd/screen`, payload);
    return data;
  }

  async choleraRisk(payload: any) {
    const { data } = await axios.post(`${this.cdssUrl}/ntd/cholera/risk`, payload);
    return data;
  }
}
