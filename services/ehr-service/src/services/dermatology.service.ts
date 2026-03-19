import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { SkinLesion } from '../entities/skin-lesion.entity';
import { WoundAssessment } from '../entities/wound-assessment.entity';
import { BurnAssessment } from '../entities/burn-assessment.entity';
import { DermatologyNote } from '../entities/dermatology-note.entity';
import axios from 'axios';

@Injectable()
export class DermatologyService {
  constructor(private readonly tenantService: TenantService) {}

  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // ── Skin Lesions ───────────────────────────────────────────────────────────

  async addLesion(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SkinLesion);
    return repo.save(repo.create(dto));
  }

  async getLesions(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SkinLesion).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
    });
  }

  async updateLesion(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SkinLesion);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Wound Assessments ──────────────────────────────────────────────────────

  async addWound(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(WoundAssessment);
    return repo.save(repo.create(dto));
  }

  async getWounds(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(WoundAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async updateWound(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(WoundAssessment);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Burn Assessments ───────────────────────────────────────────────────────

  async addBurn(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(BurnAssessment);
    return repo.save(repo.create(dto));
  }

  async getBurns(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(BurnAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Dermatology Notes ──────────────────────────────────────────────────────

  async addNote(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(DermatologyNote);
    return repo.save(repo.create(dto));
  }

  async getNotes(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(DermatologyNote).find({
      where: { patientId },
      order: { noteDate: 'DESC' },
    });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async classifyLesion(body: any) {
    const res = await axios.post(`${this.cdssUrl}/dermatology/lesion/classify`, body);
    return res.data;
  }

  async calculateBurnFluid(body: any) {
    const res = await axios.post(`${this.cdssUrl}/dermatology/burn/fluid`, body);
    return res.data;
  }
}
