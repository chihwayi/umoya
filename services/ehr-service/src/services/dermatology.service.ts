import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { SkinLesion } from '../entities/skin-lesion.entity';
import { WoundAssessment } from '../entities/wound-assessment.entity';
import { BurnAssessment } from '../entities/burn-assessment.entity';
import { DermatologyNote } from '../entities/dermatology-note.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class DermatologyService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Skin Lesions ───────────────────────────────────────────────────────────

  async addLesion(ds: DataSource, dto: any) {
    const repo = ds.getRepository(SkinLesion);
    return repo.save(repo.create(dto));
  }

  async getLesions(ds: DataSource, patientId: string) {
    return ds.getRepository(SkinLesion).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
    });
  }

  async updateLesion(ds: DataSource, id: string, dto: any) {
    const repo = ds.getRepository(SkinLesion);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Wound Assessments ──────────────────────────────────────────────────────

  async addWound(ds: DataSource, dto: any) {
    const repo = ds.getRepository(WoundAssessment);
    return repo.save(repo.create(dto));
  }

  async getWounds(ds: DataSource, patientId: string) {
    return ds.getRepository(WoundAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async updateWound(ds: DataSource, id: string, dto: any) {
    const repo = ds.getRepository(WoundAssessment);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Burn Assessments ───────────────────────────────────────────────────────

  async addBurn(ds: DataSource, dto: any) {
    const repo = ds.getRepository(BurnAssessment);
    return repo.save(repo.create(dto));
  }

  async getBurns(ds: DataSource, patientId: string) {
    return ds.getRepository(BurnAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Dermatology Notes ──────────────────────────────────────────────────────

  async addNote(ds: DataSource, dto: any) {
    const repo = ds.getRepository(DermatologyNote);
    return repo.save(repo.create(dto));
  }

  async getNotes(ds: DataSource, patientId: string) {
    return ds.getRepository(DermatologyNote).find({
      where: { patientId },
      order: { noteDate: 'DESC' },
    });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async classifyLesion(body: any, tenantId?: string, tenantDb?: any) {
    return this.cdssService.classifyDermatologyLesion(body, tenantId, tenantDb);
  }

  async calculateBurnFluid(body: any, tenantId?: string, tenantDb?: any) {
    return this.cdssService.calculateDermatologyBurnFluid(body, tenantId, tenantDb);
  }
}
