import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { HtnRegister } from '../entities/htn-register.entity';
import { BpReading } from '../entities/bp-reading.entity';
import { NcdTreatmentReview } from '../entities/ncd-treatment-review.entity';

@Injectable()
export class HypertensionService {
  constructor(private readonly tenantService: TenantService) {}

  // ── HTN Register ─────────────────────────────────────────────────────────

  async enroll(
    tenantId: string,
    enrolledBy: string | null,
    dto: Partial<HtnRegister>,
  ): Promise<HtnRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(HtnRegister);
    const entity = repo.create({
      ...dto,
      enrolledBy: enrolledBy ?? dto.enrolledBy,
      enrolledAt: dto.enrolledAt ?? new Date().toISOString().slice(0, 10),
    } as Partial<HtnRegister>);
    return repo.save(entity) as unknown as HtnRegister;
  }

  async getRegisterEntry(tenantId: string, patientId: string): Promise<HtnRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(HtnRegister).findOne({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateRegisterEntry(
    tenantId: string,
    id: string,
    dto: Partial<HtnRegister>,
  ): Promise<HtnRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(HtnRegister);
    await repo.update(id, dto as object);
    return repo.findOne({ where: { id } });
  }

  // ── BP Readings ───────────────────────────────────────────────────────────

  async recordBp(
    tenantId: string,
    recordedBy: string | null,
    dto: Partial<BpReading>,
  ): Promise<BpReading> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(BpReading);
    const classification = dto.sbp != null && dto.dbp != null
      ? this._classifyBp(dto.sbp, dto.dbp)
      : null;
    const entity = repo.create({
      ...dto,
      recordedBy: recordedBy ?? dto.recordedBy,
      classification,
    } as Partial<BpReading>);
    return repo.save(entity) as unknown as BpReading;
  }

  async getBpHistory(tenantId: string, patientId: string, limit = 30): Promise<BpReading[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(BpReading).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: limit,
    });
  }

  // ── Treatment Reviews ─────────────────────────────────────────────────────

  async recordReview(
    tenantId: string,
    reviewedBy: string | null,
    dto: Partial<NcdTreatmentReview>,
  ): Promise<NcdTreatmentReview> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NcdTreatmentReview);
    const entity = repo.create({
      ...dto,
      reviewedBy: reviewedBy ?? dto.reviewedBy,
      reviewedAt: dto.reviewedAt ?? new Date().toISOString().slice(0, 10),
    } as Partial<NcdTreatmentReview>);
    return repo.save(entity) as unknown as NcdTreatmentReview;
  }

  async getReviews(tenantId: string, patientId: string): Promise<NcdTreatmentReview[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(NcdTreatmentReview).find({
      where: { patientId },
      order: { reviewedAt: 'DESC' },
    });
  }

  // ── Local classification helper ───────────────────────────────────────────

  private _classifyBp(sbp: number, dbp: number): string {
    if (sbp >= 180 || dbp >= 120) return 'hypertensive_crisis';
    if (sbp >= 140 || dbp >= 90) return 'stage2';
    if (sbp >= 130 || dbp >= 80) return 'stage1';
    if (sbp >= 120 && dbp < 80) return 'elevated';
    return 'normal';
  }
}
