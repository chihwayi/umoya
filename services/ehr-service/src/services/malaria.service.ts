import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { MalariaCase } from '../entities/malaria-case.entity';
import { MalariaTest } from '../entities/malaria-test.entity';
import { MalariaTreatment } from '../entities/malaria-treatment.entity';
import { MalariaContactTracing } from '../entities/malaria-contact-tracing.entity';
import { MalariaSurveillanceReport } from '../entities/malaria-surveillance-report.entity';

@Injectable()
export class MalariaService {
  private readonly logger = new Logger(MalariaService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

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
    const saved = await repo.save(repo.create(dto as any));
    // Fire-and-forget CDSS risk assessment for the exposed contact
    this.cdssService.riskAssessment({
      patientId: (dto as any).contactPatientId || (dto as any).contactId,
      context: 'malaria_contact',
      exposureDetails: dto,
      specialty: 'infectious_disease',
      module: 'malaria_care',
    }).catch((e: any) => this.logger.warn(`[Malaria] CDSS contact risk failed: ${e?.message}`));
    return saved;
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
    try {
      return await this.cdssService.getGuidelines('malaria treatment protocol', {
        ...payload,
        specialty: 'infectious_disease',
        module: 'malaria_care',
      });
    } catch (err: any) {
      this.logger.warn(`[Malaria] CDSS treatment recommendation unavailable, using local fallback: ${err?.message}`);
      return this.localMalariaTreatment(payload);
    }
  }

  async scoreSeverity(payload: Record<string, any>) {
    try {
      return await this.cdssService.riskAssessment({
        ...payload,
        context: 'malaria_severity',
        specialty: 'infectious_disease',
        module: 'malaria_care',
      });
    } catch (err: any) {
      this.logger.warn(`[Malaria] CDSS severity scoring unavailable, using local fallback: ${err?.message}`);
      return this.localMalariaSeverity(payload);
    }
  }

  /** WHO 2015 malaria treatment — local fallback.
   *  First-line: Artemether-Lumefantrine (AL) for uncomplicated P. falciparum.
   *  Severe: IV Artesunate, ICU referral.
   */
  private localMalariaTreatment(payload: Record<string, any>): Record<string, any> {
    const species = String(payload.species || payload.parasite_species || '').toLowerCase();
    const severe = payload.severe === true || payload.severity === 'severe';
    const pregnancyTrimester = Number(payload.pregnancy_trimester ?? 0);
    const ageYears = Number(payload.age ?? payload.age_years ?? 99);

    if (severe) {
      return {
        source: 'local_fallback',
        regimen: 'IV Artesunate 2.4 mg/kg at 0, 12, 24 h then daily',
        notes: 'Admit to ICU. Switch to oral AL once patient can tolerate oral medication (≥3 doses IV).',
        guideline: 'WHO Severe Malaria Guidelines 2015',
      };
    }
    if (pregnancyTrimester === 1) {
      return {
        source: 'local_fallback',
        regimen: 'Quinine + Clindamycin for 7 days',
        notes: 'Artemisinin derivatives avoid in first trimester. Monitor closely.',
        guideline: 'WHO Malaria in Pregnancy Guidelines 2015',
      };
    }
    if (species.includes('vivax') || species.includes('ovale')) {
      return {
        source: 'local_fallback',
        regimen: 'Chloroquine 25 mg/kg over 3 days + Primaquine 0.25 mg/kg/day × 14 days (check G6PD)',
        notes: 'Screen for G6PD deficiency before primaquine.',
        guideline: 'WHO Guidelines for Treatment of Malaria 2015',
      };
    }
    // Default: uncomplicated P. falciparum / unknown species
    return {
      source: 'local_fallback',
      regimen: ageYears < 5
        ? 'Artemether-Lumefantrine paediatric (weight-based dosing) × 3 days'
        : 'Artemether-Lumefantrine 80/480 mg BD × 3 days (with fatty food)',
      notes: 'Check parasite clearance at 72 h. Treat severe cases with IV artesunate.',
      guideline: 'WHO Guidelines for Treatment of Malaria 2015',
    };
  }

  /** WHO severe malaria criteria — local severity scoring fallback. */
  private localMalariaSeverity(payload: Record<string, any>): Record<string, any> {
    const flags: string[] = [];
    if (payload.gcs !== undefined && Number(payload.gcs) < 11) flags.push('Impaired consciousness (GCS<11)');
    if (payload.respiratory_distress) flags.push('Respiratory distress');
    if (Number(payload.hemoglobin ?? 999) < 7) flags.push('Severe anaemia (Hb<7 g/dL)');
    if (payload.repeated_convulsions) flags.push('Repeated convulsions');
    if (Number(payload.systolic_bp ?? 999) < 70) flags.push('Circulatory collapse');
    if (payload.abnormal_bleeding) flags.push('Abnormal bleeding');
    if (Number(payload.parasite_density ?? 0) > 250000) flags.push('Hyperparasitaemia (>250,000/µL)');
    if (payload.jaundice) flags.push('Jaundice');
    if (Number(payload.creatinine ?? 0) > 265) flags.push('Acute kidney injury');
    if (payload.pulmonary_oedema) flags.push('Pulmonary oedema');
    const severe = flags.length > 0;
    return {
      source: 'local_fallback',
      severity: severe ? 'severe' : 'uncomplicated',
      who_criteria_met: flags,
      recommendation: severe
        ? 'Admit immediately — treat as severe malaria with IV artesunate'
        : 'Treat as uncomplicated malaria with oral artemisinin-based combination therapy',
      guideline: 'WHO Severe Malaria Guidelines 2015',
    };
  }
}
