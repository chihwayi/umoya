import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { SpirometryResult } from '../entities/spirometry-result.entity';
import { CopdAssessment } from '../entities/copd-assessment.entity';
import { AsthmaRecord } from '../entities/asthma-record.entity';
import { PeakFlowDiary } from '../entities/peak-flow-diary.entity';
import { OxygenTherapyRecord } from '../entities/oxygen-therapy-record.entity';
import axios from 'axios';

@Injectable()
export class PulmonologyService {
  constructor(private readonly tenantService: TenantService) {}

  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // ── Spirometry ─────────────────────────────────────────────────────────────

  async addSpirometry(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SpirometryResult);
    return repo.save(repo.create(dto));
  }

  async getSpirometryResults(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SpirometryResult).find({
      where: { patientId },
      order: { testDate: 'DESC' },
    });
  }

  // ── COPD ───────────────────────────────────────────────────────────────────

  async addCopdAssessment(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CopdAssessment);
    return repo.save(repo.create(dto));
  }

  async getCopdAssessments(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(CopdAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async updateCopdAssessment(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CopdAssessment);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Asthma ─────────────────────────────────────────────────────────────────

  async addAsthmaRecord(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AsthmaRecord);
    return repo.save(repo.create(dto));
  }

  async getAsthmaRecords(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(AsthmaRecord).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async updateAsthmaRecord(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AsthmaRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Peak Flow ──────────────────────────────────────────────────────────────

  async addPeakFlow(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PeakFlowDiary);
    return repo.save(repo.create(dto));
  }

  async getPeakFlowDiary(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PeakFlowDiary).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 90,
    });
  }

  // ── Oxygen Therapy ─────────────────────────────────────────────────────────

  async addOxygenTherapy(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(OxygenTherapyRecord);
    return repo.save(repo.create(dto));
  }

  async getOxygenTherapy(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(OxygenTherapyRecord).find({
      where: { patientId },
      order: { startDate: 'DESC' },
    });
  }

  async updateOxygenTherapy(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(OxygenTherapyRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async interpretSpirometry(body: any) {
    const res = await axios.post(`${this.cdssUrl}/pulmonology/spirometry/interpret`, body);
    return res.data;
  }

  async asthmaStepUp(body: any) {
    const res = await axios.post(`${this.cdssUrl}/pulmonology/asthma/stepup`, body);
    return res.data;
  }

  async prescribeOxygen(body: any) {
    const res = await axios.post(`${this.cdssUrl}/pulmonology/oxygen/prescribe`, body);
    return res.data;
  }
}
