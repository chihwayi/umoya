import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { PalliativeAssessment } from '../entities/palliative-assessment.entity';
import { SymptomBurdenScore } from '../entities/symptom-burden-score.entity';
import { GoalsOfCare } from '../entities/goals-of-care.entity';
import { AdvanceDirectiveRecord } from '../entities/advance-directive-record.entity';
import { PalliativeMedicationReview } from '../entities/palliative-medication-review.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class PalliativeService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Palliative Assessment ──────────────────────────────────────────────────

  async addAssessment(ds: DataSource, dto: any) {
    const repo = ds.getRepository(PalliativeAssessment);
    return repo.save(repo.create(dto));
  }

  async getAssessments(ds: DataSource, patientId: string) {
    return ds.getRepository(PalliativeAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── ESAS Symptom Burden ────────────────────────────────────────────────────

  async addSymptomScore(ds: DataSource, dto: any) {
    const repo = ds.getRepository(SymptomBurdenScore);
    return repo.save(repo.create(dto));
  }

  async getSymptomScores(ds: DataSource, patientId: string) {
    return ds.getRepository(SymptomBurdenScore).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 60,
    });
  }

  // ── Goals of Care ──────────────────────────────────────────────────────────

  async upsertGoalsOfCare(ds: DataSource, patientId: string, dto: any) {
    const repo = ds.getRepository(GoalsOfCare);
    // deactivate existing active record
    await repo.update({ patientId, isActive: true }, { isActive: false } as any);
    return repo.save(repo.create({ ...dto, patientId, isActive: true }));
  }

  async getActiveGoalsOfCare(ds: DataSource, patientId: string) {
    return ds.getRepository(GoalsOfCare).findOne({ where: { patientId, isActive: true } });
  }

  async getGoalsOfCareHistory(ds: DataSource, patientId: string) {
    return ds.getRepository(GoalsOfCare).find({
      where: { patientId },
      order: { documentDate: 'DESC' },
    });
  }

  // ── Advance Directives ─────────────────────────────────────────────────────

  async addDirective(ds: DataSource, dto: any) {
    const repo = ds.getRepository(AdvanceDirectiveRecord);
    return repo.save(repo.create(dto));
  }

  async getDirectives(ds: DataSource, patientId: string) {
    return ds.getRepository(AdvanceDirectiveRecord).find({
      where: { patientId },
      order: { documentDate: 'DESC' },
    });
  }

  async updateDirective(ds: DataSource, id: string, dto: any) {
    const repo = ds.getRepository(AdvanceDirectiveRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Medication Review ──────────────────────────────────────────────────────

  async addMedReview(ds: DataSource, dto: any) {
    const repo = ds.getRepository(PalliativeMedicationReview);
    return repo.save(repo.create(dto));
  }

  async getMedReviews(ds: DataSource, patientId: string) {
    return ds.getRepository(PalliativeMedicationReview).find({
      where: { patientId },
      order: { reviewDate: 'DESC' },
    });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async calcPrognosis(body: any, tenantId?: string, tenantDb?: any) {
    return this.cdssService.palliativePrognosis(body, tenantId, tenantDb);
  }

  async convertOpioid(body: any, tenantId?: string, tenantDb?: any) {
    return this.cdssService.palliativeOpioidConvert(body, tenantId, tenantDb);
  }

  async manageSymptom(body: any, tenantId?: string, tenantDb?: any) {
    return this.cdssService.palliativeSymptomManage(body, tenantId, tenantDb);
  }
}
