import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TenantService } from './tenant.service';
import { MalariaCase } from '../entities/malaria-case.entity';
import { MalariaTest } from '../entities/malaria-test.entity';
import { MalariaTreatment } from '../entities/malaria-treatment.entity';
import { MalariaContactTracing } from '../entities/malaria-contact-tracing.entity';
import { MalariaSurveillanceReport } from '../entities/malaria-surveillance-report.entity';

@Injectable()
export class MalariaService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly http: HttpService,
  ) {}

  private get cdssBase(): string {
    return process.env.CDSS_SERVICE_URL || 'http://localhost:8001';
  }

  // ── Cases ──────────────────────────────────────────────────────────────────

  async registerCase(tenantSubdomain: string, dto: Partial<MalariaCase>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(MalariaCase);
    return repo.save(repo.create(dto as any));
  }

  async listCases(tenantSubdomain: string, patientId?: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const where: any = {};
    if (patientId) where.patientId = patientId;
    return ds.getRepository(MalariaCase).find({ where, order: { registeredAt: 'DESC' } });
  }

  async getCase(tenantSubdomain: string, id: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const c = await ds.getRepository(MalariaCase).findOne({ where: { id } });
    if (!c) throw new NotFoundException('Malaria case not found');
    return c;
  }

  async updateCase(tenantSubdomain: string, id: string, dto: Partial<MalariaCase>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    await ds.getRepository(MalariaCase).update(id, dto as any);
    return this.getCase(tenantSubdomain, id);
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  async addTest(tenantSubdomain: string, dto: Partial<MalariaTest>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(MalariaTest);
    const record = repo.save(repo.create(dto as any));
    // If positive, upgrade case type if needed
    if ((dto as any).result === 'positive' && dto.malariaCaseId) {
      await ds.getRepository(MalariaCase).update(dto.malariaCaseId, { updatedAt: new Date() } as any);
    }
    return record;
  }

  async getTests(tenantSubdomain: string, caseId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(MalariaTest).find({
      where: { malariaCaseId: caseId },
      order: { testDate: 'DESC' },
    });
  }

  // ── Treatments ─────────────────────────────────────────────────────────────

  async startTreatment(tenantSubdomain: string, dto: Partial<MalariaTreatment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(MalariaTreatment);
    return repo.save(repo.create(dto as any));
  }

  async getTreatments(tenantSubdomain: string, caseId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(MalariaTreatment).find({
      where: { malariaCaseId: caseId },
      order: { startDate: 'DESC' },
    });
  }

  async updateTreatment(tenantSubdomain: string, id: string, dto: Partial<MalariaTreatment>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    await ds.getRepository(MalariaTreatment).update(id, dto as any);
    return ds.getRepository(MalariaTreatment).findOne({ where: { id } });
  }

  // ── Contact Tracing ────────────────────────────────────────────────────────

  async addContact(tenantSubdomain: string, dto: Partial<MalariaContactTracing>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(MalariaContactTracing);
    return repo.save(repo.create(dto as any));
  }

  async getContacts(tenantSubdomain: string, caseId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(MalariaContactTracing).find({
      where: { malariaCaseId: caseId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateContact(tenantSubdomain: string, id: string, dto: Partial<MalariaContactTracing>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    await ds.getRepository(MalariaContactTracing).update(id, dto as any);
    return ds.getRepository(MalariaContactTracing).findOne({ where: { id } });
  }

  // ── Surveillance Reports ───────────────────────────────────────────────────

  async upsertSurveillanceReport(tenantSubdomain: string, dto: Partial<MalariaSurveillanceReport>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(MalariaSurveillanceReport);
    const existing = await repo.findOne({
      where: { reportWeek: dto.reportWeek, reportYear: dto.reportYear, facilityId: dto.facilityId || null } as any,
    });
    if (existing) {
      await repo.update(existing.id, dto as any);
      return repo.findOne({ where: { id: existing.id } });
    }
    return repo.save(repo.create(dto as any));
  }

  async getSurveillanceReports(tenantSubdomain: string, year?: number) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const where: any = {};
    if (year) where.reportYear = year;
    return ds.getRepository(MalariaSurveillanceReport).find({
      where,
      order: { reportYear: 'DESC', reportWeek: 'DESC' },
    });
  }

  // ── CDSS Proxies ───────────────────────────────────────────────────────────

  async recommendTreatment(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/malaria/treatment`, payload),
    );
    return data;
  }

  async scoreSeverity(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/malaria/severity`, payload),
    );
    return data;
  }
}
