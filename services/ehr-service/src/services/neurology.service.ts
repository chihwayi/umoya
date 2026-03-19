import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TenantService } from './tenant.service';
import { SeizureRecord } from '../entities/seizure-record.entity';
import { StrokeAssessment } from '../entities/stroke-assessment.entity';
import { HeadacheDiary } from '../entities/headache-diary.entity';
import { NeurologyExamination } from '../entities/neurology-examination.entity';
import { CognitiveAssessment } from '../entities/cognitive-assessment.entity';

@Injectable()
export class NeurologyService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly http: HttpService,
  ) {}

  private get cdssBase(): string {
    return process.env.CDSS_SERVICE_URL || 'http://localhost:8001';
  }

  // ── Seizures ───────────────────────────────────────────────────────────────

  async addSeizure(tenantSubdomain: string, dto: Partial<SeizureRecord>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(SeizureRecord);
    return repo.save(repo.create(dto as any));
  }

  async getSeizures(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(SeizureRecord).find({
      where: { patientId },
      order: { seizureDate: 'DESC' },
    });
  }

  // ── Stroke ─────────────────────────────────────────────────────────────────

  async addStrokeAssessment(tenantSubdomain: string, dto: Partial<StrokeAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(StrokeAssessment);
    return repo.save(repo.create(dto as any));
  }

  async getStrokeAssessments(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(StrokeAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async updateStrokeAssessment(tenantSubdomain: string, id: string, dto: Partial<StrokeAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    await ds.getRepository(StrokeAssessment).update(id, dto as any);
    return ds.getRepository(StrokeAssessment).findOne({ where: { id } });
  }

  // ── Headache Diary ─────────────────────────────────────────────────────────

  async addHeadacheEntry(tenantSubdomain: string, dto: Partial<HeadacheDiary>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(HeadacheDiary);
    return repo.save(repo.create(dto as any));
  }

  async getHeadacheDiary(tenantSubdomain: string, patientId: string, limit = 30) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(HeadacheDiary).find({
      where: { patientId },
      order: { entryDate: 'DESC' },
      take: limit,
    });
  }

  // ── Neurology Exam ─────────────────────────────────────────────────────────

  async addExam(tenantSubdomain: string, dto: Partial<NeurologyExamination>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(NeurologyExamination);
    return repo.save(repo.create(dto as any));
  }

  async getExams(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(NeurologyExamination).find({
      where: { patientId },
      order: { examDate: 'DESC' },
    });
  }

  // ── Cognitive Assessments ──────────────────────────────────────────────────

  async addCognitiveAssessment(tenantSubdomain: string, dto: Partial<CognitiveAssessment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(CognitiveAssessment);
    return repo.save(repo.create(dto as any));
  }

  async getCognitiveAssessments(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(CognitiveAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── CDSS Proxies ───────────────────────────────────────────────────────────

  async triageStroke(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/neurology/stroke/triage`, payload),
    );
    return data;
  }

  async classifySeizure(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/neurology/seizure/classify`, payload),
    );
    return data;
  }

  async diagnoseHeadache(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/neurology/headache/diagnose`, payload),
    );
    return data;
  }
}
