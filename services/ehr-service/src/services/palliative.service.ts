import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PalliativeAssessment } from '../entities/palliative-assessment.entity';
import { SymptomBurdenScore } from '../entities/symptom-burden-score.entity';
import { GoalsOfCare } from '../entities/goals-of-care.entity';
import { AdvanceDirectiveRecord } from '../entities/advance-directive-record.entity';
import { PalliativeMedicationReview } from '../entities/palliative-medication-review.entity';
import axios from 'axios';

@Injectable()
export class PalliativeService {
  constructor(private readonly tenantService: TenantService) {}

  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // ── Palliative Assessment ──────────────────────────────────────────────────

  async addAssessment(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PalliativeAssessment);
    return repo.save(repo.create(dto));
  }

  async getAssessments(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PalliativeAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── ESAS Symptom Burden ────────────────────────────────────────────────────

  async addSymptomScore(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SymptomBurdenScore);
    return repo.save(repo.create(dto));
  }

  async getSymptomScores(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SymptomBurdenScore).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 60,
    });
  }

  // ── Goals of Care ──────────────────────────────────────────────────────────

  async upsertGoalsOfCare(subdomain: string, patientId: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(GoalsOfCare);
    // deactivate existing active record
    await repo.update({ patientId, isActive: true }, { isActive: false } as any);
    return repo.save(repo.create({ ...dto, patientId, isActive: true }));
  }

  async getActiveGoalsOfCare(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(GoalsOfCare).findOne({ where: { patientId, isActive: true } });
  }

  async getGoalsOfCareHistory(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(GoalsOfCare).find({
      where: { patientId },
      order: { documentDate: 'DESC' },
    });
  }

  // ── Advance Directives ─────────────────────────────────────────────────────

  async addDirective(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AdvanceDirectiveRecord);
    return repo.save(repo.create(dto));
  }

  async getDirectives(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(AdvanceDirectiveRecord).find({
      where: { patientId },
      order: { documentDate: 'DESC' },
    });
  }

  async updateDirective(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AdvanceDirectiveRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Medication Review ──────────────────────────────────────────────────────

  async addMedReview(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PalliativeMedicationReview);
    return repo.save(repo.create(dto));
  }

  async getMedReviews(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PalliativeMedicationReview).find({
      where: { patientId },
      order: { reviewDate: 'DESC' },
    });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async calcPrognosis(body: any) {
    const res = await axios.post(`${this.cdssUrl}/palliative/prognosis`, body);
    return res.data;
  }

  async convertOpioid(body: any) {
    const res = await axios.post(`${this.cdssUrl}/palliative/opioid/convert`, body);
    return res.data;
  }

  async manageSymptom(body: any) {
    const res = await axios.post(`${this.cdssUrl}/palliative/symptom/manage`, body);
    return res.data;
  }
}
