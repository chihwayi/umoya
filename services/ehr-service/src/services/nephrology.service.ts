import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CkdAssessment } from '../entities/ckd-assessment.entity';
import { DialysisRecord } from '../entities/dialysis-record.entity';
import { FluidBalanceRecord } from '../entities/fluid-balance-record.entity';
import { RenalBiopsy } from '../entities/renal-biopsy.entity';
import { TransplantRecord } from '../entities/transplant-record.entity';
import axios from 'axios';

@Injectable()
export class NephrologyService {
  constructor(private readonly tenantService: TenantService) {}

  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // ── CKD ────────────────────────────────────────────────────────────────────

  async addCkdAssessment(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CkdAssessment);
    return repo.save(repo.create(dto));
  }

  async getCkdAssessments(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(CkdAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Dialysis ───────────────────────────────────────────────────────────────

  async addDialysisRecord(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(DialysisRecord);
    return repo.save(repo.create(dto));
  }

  async getDialysisRecords(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(DialysisRecord).find({
      where: { patientId },
      order: { sessionDate: 'DESC' },
      take: 50,
    });
  }

  async updateDialysisRecord(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(DialysisRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Fluid Balance ──────────────────────────────────────────────────────────

  async addFluidBalance(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(FluidBalanceRecord);
    return repo.save(repo.create(dto));
  }

  async getFluidBalance(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FluidBalanceRecord).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 96,
    });
  }

  // ── Renal Biopsy ───────────────────────────────────────────────────────────

  async addBiopsy(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(RenalBiopsy);
    return repo.save(repo.create(dto));
  }

  async getBiopsies(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(RenalBiopsy).find({
      where: { patientId },
      order: { biopsyDate: 'DESC' },
    });
  }

  // ── Transplant ─────────────────────────────────────────────────────────────

  async addTransplantRecord(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(TransplantRecord);
    return repo.save(repo.create(dto));
  }

  async getTransplantRecords(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(TransplantRecord).find({
      where: { patientId },
      order: { transplantDate: 'DESC' },
    });
  }

  async updateTransplantRecord(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(TransplantRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async stageCkd(body: any) {
    const res = await axios.post(`${this.cdssUrl}/nephrology/ckd/stage`, body);
    return res.data;
  }

  async assessDialysisAdequacy(body: any) {
    const res = await axios.post(`${this.cdssUrl}/nephrology/dialysis/adequacy`, body);
    return res.data;
  }

  async renalDrugDosing(body: any) {
    const res = await axios.post(`${this.cdssUrl}/nephrology/drug-dosing/renal-adjust`, body);
    return res.data;
  }
}
