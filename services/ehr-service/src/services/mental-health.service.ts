import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TenantService } from './tenant.service';
import { MentalHealthScreening } from '../entities/mental-health-screening.entity';
import { PsychiatricEncounter } from '../entities/psychiatric-encounter.entity';
import { CrisisEvent } from '../entities/crisis-event.entity';
import { SafePlan } from '../entities/safe-plan.entity';
import { PsychotropicMedication } from '../entities/psychotropic-medication.entity';

@Injectable()
export class MentalHealthService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly http: HttpService,
  ) {}

  private get cdssBase(): string {
    return process.env.CDSS_SERVICE_URL || 'http://localhost:8001';
  }

  // ── Screenings ─────────────────────────────────────────────────────────────

  async addScreening(tenantSubdomain: string, dto: Partial<MentalHealthScreening>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(MentalHealthScreening);
    const record = repo.create(dto as any);
    return repo.save(record);
  }

  async getScreenings(tenantSubdomain: string, patientId: string, tool?: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(MentalHealthScreening);
    const qb = repo.createQueryBuilder('s')
      .where('s.patientId = :patientId', { patientId })
      .orderBy('s.screenedAt', 'DESC');
    if (tool) qb.andWhere('s.tool = :tool', { tool });
    return qb.getMany();
  }

  async getLatestScreening(tenantSubdomain: string, patientId: string, tool: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(MentalHealthScreening).findOne({
      where: { patientId, tool },
      order: { screenedAt: 'DESC' },
    });
  }

  // ── Psychiatric Encounters ──────────────────────────────────────────────────

  async addEncounter(tenantSubdomain: string, dto: Partial<PsychiatricEncounter>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(PsychiatricEncounter);
    return repo.save(repo.create(dto as any));
  }

  async getEncounters(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(PsychiatricEncounter).find({
      where: { patientId },
      order: { encounterDate: 'DESC' },
    });
  }

  async updateEncounter(tenantSubdomain: string, id: string, dto: Partial<PsychiatricEncounter>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(PsychiatricEncounter);
    const enc = await repo.findOne({ where: { id } });
    if (!enc) throw new NotFoundException('Encounter not found');
    await repo.update(id, dto as any);
    return repo.findOne({ where: { id } });
  }

  // ── Crisis Events ───────────────────────────────────────────────────────────

  async addCrisisEvent(tenantSubdomain: string, dto: Partial<CrisisEvent>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(CrisisEvent);
    return repo.save(repo.create(dto as any));
  }

  async getCrisisEvents(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(CrisisEvent).find({
      where: { patientId },
      order: { eventDate: 'DESC' },
    });
  }

  async updateCrisisEvent(tenantSubdomain: string, id: string, dto: Partial<CrisisEvent>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(CrisisEvent);
    await repo.update(id, dto as any);
    return repo.findOne({ where: { id } });
  }

  // ── Safe Plans ──────────────────────────────────────────────────────────────

  async upsertSafePlan(tenantSubdomain: string, patientId: string, dto: Partial<SafePlan>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(SafePlan);
    // Deactivate old active plan
    await repo.update({ patientId, isActive: true }, { isActive: false } as any);
    const plan = repo.create({ ...dto, patientId, isActive: true } as any);
    return repo.save(plan);
  }

  async getActiveSafePlan(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(SafePlan).findOne({
      where: { patientId, isActive: true },
    });
  }

  async getSafePlanHistory(tenantSubdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    return ds.getRepository(SafePlan).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Psychotropic Medications ────────────────────────────────────────────────

  async addMedication(tenantSubdomain: string, dto: Partial<PsychotropicMedication>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(PsychotropicMedication);
    return repo.save(repo.create(dto as any));
  }

  async getMedications(tenantSubdomain: string, patientId: string, activeOnly = false) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const where: any = { patientId };
    if (activeOnly) where.status = 'active';
    return ds.getRepository(PsychotropicMedication).find({
      where,
      order: { startDate: 'DESC' },
    });
  }

  async updateMedication(tenantSubdomain: string, id: string, dto: Partial<PsychotropicMedication>) {
    const ds = await this.tenantService.getTenantDatabase(tenantSubdomain);
    const repo = ds.getRepository(PsychotropicMedication);
    await repo.update(id, dto as any);
    return repo.findOne({ where: { id } });
  }

  // ── CDSS Proxies ────────────────────────────────────────────────────────────

  async scoreScreening(tool: string, responses: Record<string, number>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/mental-health/screen`, { tool, responses }),
    );
    return data;
  }

  async assessSuicideRisk(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/mental-health/risk`, payload),
    );
    return data;
  }

  async monitorMedication(payload: Record<string, any>) {
    const { data } = await firstValueFrom(
      this.http.post(`${this.cdssBase}/mental-health/medication/monitor`, payload),
    );
    return data;
  }
}
