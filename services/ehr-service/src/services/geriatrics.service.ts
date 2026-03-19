import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TenantService } from './tenant.service';
import { GeriatricAssessment } from '../entities/geriatric-assessment.entity';
import { FallsAssessment } from '../entities/falls-assessment.entity';
import { PressureInjuryAssessment } from '../entities/pressure-injury-assessment.entity';
import { PolypharmacyReview } from '../entities/polypharmacy-review.entity';
import { AdvanceCarePlanning } from '../entities/advance-care-planning.entity';

@Injectable()
export class GeriatricsService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly http: HttpService,
  ) {}

  private get cdssBase(): string {
    return process.env.CDSS_SERVICE_URL || 'http://localhost:8001';
  }

  // ── Geriatric Assessments ──────────────────────────────────────────────────

  async addAssessment(tenantSubdomain: string, dto: Partial<GeriatricAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(GeriatricAssessment);
    return repo.save(repo.create(dto as any));
  }

  async getAssessments(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(GeriatricAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async getLatestAssessment(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(GeriatricAssessment).findOne({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Falls Assessments ──────────────────────────────────────────────────────

  async addFallsAssessment(tenantSubdomain: string, dto: Partial<FallsAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(FallsAssessment);
    return repo.save(repo.create(dto as any));
  }

  async getFallsAssessments(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(FallsAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Pressure Injury ────────────────────────────────────────────────────────

  async addPressureAssessment(tenantSubdomain: string, dto: Partial<PressureInjuryAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(PressureInjuryAssessment);
    return repo.save(repo.create(dto as any));
  }

  async getPressureAssessments(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(PressureInjuryAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Polypharmacy Reviews ───────────────────────────────────────────────────

  async addPolypharmacyReview(tenantSubdomain: string, dto: Partial<PolypharmacyReview>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(PolypharmacyReview);
    return repo.save(repo.create(dto as any));
  }

  async getPolypharmacyReviews(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(PolypharmacyReview).find({
      where: { patientId },
      order: { reviewDate: 'DESC' },
    });
  }

  // ── Advance Care Planning ──────────────────────────────────────────────────

  async addAcpDocument(tenantSubdomain: string, dto: Partial<AdvanceCarePlanning>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(AdvanceCarePlanning);
    return repo.save(repo.create(dto as any));
  }

  async getAcpDocuments(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(AdvanceCarePlanning).find({
      where: { patientId },
      order: { documentDate: 'DESC' },
    });
  }

  async updateAcpDocument(tenantSubdomain: string, id: string, dto: Partial<AdvanceCarePlanning>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    await ds.getRepository(AdvanceCarePlanning).update(id, dto as any);
    return ds.getRepository(AdvanceCarePlanning).findOne({ where: { id } });
  }

  // ── CDSS Proxies ───────────────────────────────────────────────────────────

  async assessFrailty(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/geriatrics/frailty`, payload),
    );
    return data;
  }

  async checkPolypharmacy(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/geriatrics/polypharmacy`, payload),
    );
    return data;
  }

  async assessFallRisk(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/geriatrics/fall-risk`, payload),
    );
    return data;
  }
}
