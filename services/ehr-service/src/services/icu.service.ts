import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { IcuAdmission } from '../entities/icu-admission.entity';
import { SofaScore } from '../entities/sofa-score.entity';
import { VentilatorSettings } from '../entities/ventilator-settings.entity';
import { SedationRecord } from '../entities/sedation-record.entity';
import { CentralLineRecord } from '../entities/central-line-record.entity';
import { VasopressorRecord } from '../entities/vasopressor-record.entity';
import axios from 'axios';

@Injectable()
export class IcuService {
  constructor(private readonly tenantService: TenantService) {}

  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // ── ICU Admission ──────────────────────────────────────────────────────────

  async addAdmission(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(IcuAdmission);
    return repo.save(repo.create(dto));
  }

  async getAdmissions(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(IcuAdmission).find({
      where: { patientId },
      order: { icuAdmissionDate: 'DESC' },
    });
  }

  async updateAdmission(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(IcuAdmission);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── SOFA Scores ────────────────────────────────────────────────────────────

  async addSofa(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SofaScore);
    return repo.save(repo.create({ ...dto, scoredAt: dto.scoredAt || new Date() }));
  }

  async getSofaScores(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SofaScore).find({
      where: { patientId },
      order: { scoredAt: 'DESC' },
      take: 48,
    });
  }

  // ── Ventilator Settings ────────────────────────────────────────────────────

  async addVentSettings(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(VentilatorSettings);
    return repo.save(repo.create({ ...dto, recordedAt: dto.recordedAt || new Date() }));
  }

  async getVentSettings(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(VentilatorSettings).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 48,
    });
  }

  // ── Sedation Records ───────────────────────────────────────────────────────

  async addSedation(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SedationRecord);
    return repo.save(repo.create({ ...dto, recordedAt: dto.recordedAt || new Date() }));
  }

  async getSedation(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SedationRecord).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 24,
    });
  }

  // ── Central Lines ──────────────────────────────────────────────────────────

  async addLine(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CentralLineRecord);
    return repo.save(repo.create(dto));
  }

  async getLines(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(CentralLineRecord).find({
      where: { patientId },
      order: { insertionDate: 'DESC' },
    });
  }

  async updateLine(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CentralLineRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Vasopressors ───────────────────────────────────────────────────────────

  async addVasopressor(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(VasopressorRecord);
    return repo.save(repo.create(dto));
  }

  async getVasopressors(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(VasopressorRecord).find({
      where: { patientId },
      order: { startTime: 'DESC' },
    });
  }

  async updateVasopressor(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(VasopressorRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async calculateSofa(body: any) {
    const res = await axios.post(`${this.cdssUrl}/icu/sofa/calculate`, body);
    return res.data;
  }

  async ventProtocol(body: any) {
    const res = await axios.post(`${this.cdssUrl}/icu/vent/protocol`, body);
    return res.data;
  }

  async assessSedation(body: any) {
    const res = await axios.post(`${this.cdssUrl}/icu/sedation/assess`, body);
    return res.data;
  }
}
