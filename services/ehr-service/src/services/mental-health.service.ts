import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { MentalHealthScreening } from '../entities/mental-health-screening.entity';
import { PsychiatricEncounter } from '../entities/psychiatric-encounter.entity';
import { CrisisEvent } from '../entities/crisis-event.entity';
import { SafePlan } from '../entities/safe-plan.entity';
import { PsychotropicMedication } from '../entities/psychotropic-medication.entity';

@Injectable()
export class MentalHealthService {
  private readonly logger = new Logger(MentalHealthService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

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
    try {
      return await this.cdssService.diagnosisAssist(
        {
          tool,
          responses,
          context: 'mental_health_screening',
          specialty: 'mental_health',
          module: 'screening_and_crisis',
        },
        true,
      );
    } catch (err: any) {
      this.logger.warn(`[MentalHealth] CDSS screening score unavailable: ${err?.message}`);
      return this.localScreeningScore(tool, responses);
    }
  }

  async assessSuicideRisk(payload: Record<string, any>) {
    try {
      return await this.cdssService.riskAssessment({
        ...payload,
        context: 'suicide_risk',
        specialty: 'mental_health',
        module: 'screening_and_crisis',
      });
    } catch (err: any) {
      this.logger.warn(`[MentalHealth] CDSS suicide risk assessment unavailable: ${err?.message}`);
      return this.localSuicideRisk(payload);
    }
  }

  async monitorMedication(payload: Record<string, any>) {
    try {
      return await this.cdssService.checkHighRiskMedications(
        Array.isArray(payload.medications) ? payload.medications : [payload.medication],
        payload.age,
        payload.gender,
        payload.renal_function,
      );
    } catch (err: any) {
      this.logger.warn(`[MentalHealth] CDSS medication monitoring unavailable: ${err?.message}`);
      return this.localPsychotropicMonitor(payload);
    }
  }

  /** Local scoring for PHQ-9, GAD-7, EPDS, PCL-5. */
  private localScreeningScore(tool: string, responses: Record<string, number>): Record<string, any> {
    const total = Object.values(responses).reduce((s, v) => s + (Number(v) || 0), 0);
    const toolUpper = tool.toUpperCase();

    if (toolUpper === 'PHQ-9' || toolUpper === 'PHQ9') {
      const severity = total <= 4 ? 'minimal' : total <= 9 ? 'mild' : total <= 14 ? 'moderate' : total <= 19 ? 'moderately_severe' : 'severe';
      const q9 = Number(responses['q9'] ?? responses[9] ?? 0);
      return { source: 'local_fallback', tool, total, severity, suicidal_ideation: q9 >= 1, recommendation: total >= 10 ? 'Further assessment and treatment indicated' : 'Monitor; re-screen in 2–4 weeks', guideline: 'Kroenke K et al. PHQ-9. J Gen Intern Med 2001' };
    }
    if (toolUpper === 'GAD-7') {
      const severity = total <= 4 ? 'minimal' : total <= 9 ? 'mild' : total <= 14 ? 'moderate' : 'severe';
      return { source: 'local_fallback', tool, total, severity, recommendation: total >= 10 ? 'Further evaluation for anxiety disorder' : 'Monitor', guideline: 'Spitzer RL et al. GAD-7. Arch Intern Med 2006' };
    }
    if (toolUpper === 'EPDS') {
      const q10 = Number(responses['q10'] ?? responses[10] ?? 0);
      return { source: 'local_fallback', tool, total, probable_depression: total >= 13, self_harm_risk: q10 >= 1, recommendation: total >= 13 ? 'Refer for postnatal depression assessment' : 'Low risk; continue monitoring', guideline: 'Cox JL et al. EPDS. Br J Psychiatry 1987' };
    }
    return { source: 'local_fallback', tool, total, recommendation: 'Manual scoring required for this tool' };
  }

  /** Local Columbia Suicide Severity Rating Scale (C-SSRS) risk stratification. */
  private localSuicideRisk(payload: Record<string, any>): Record<string, any> {
    const ideation = Number(payload.ideation_level ?? 0);   // 0–5
    const behavior = Number(payload.behavior_level ?? 0);   // 0–5
    const intent   = Boolean(payload.has_intent);
    const plan     = Boolean(payload.has_plan);
    const means    = Boolean(payload.has_means);

    let riskLevel = 'low';
    const flags: string[] = [];
    if (ideation >= 4) { flags.push('Active suicidal ideation with intent'); riskLevel = 'high'; }
    if (behavior >= 3) { flags.push('Recent suicidal behaviour'); riskLevel = 'high'; }
    if (intent)        { flags.push('Intent present'); riskLevel = 'high'; }
    if (plan)          { flags.push('Plan identified'); riskLevel = riskLevel === 'low' ? 'moderate' : 'high'; }
    if (means)         { flags.push('Means available'); riskLevel = riskLevel === 'low' ? 'moderate' : riskLevel; }

    return {
      source: 'local_fallback',
      risk_level: riskLevel,
      flags,
      recommendation: riskLevel === 'high'
        ? 'Immediate psychiatric review; consider inpatient admission; activate crisis protocol'
        : riskLevel === 'moderate'
          ? 'Urgent outpatient psychiatric assessment within 24–48 h; safety plan required'
          : 'Safety planning; re-screen at next visit; ensure support network',
      guideline: 'Columbia Suicide Severity Rating Scale (C-SSRS)',
    };
  }

  /** Local psychotropic medication monitoring flags. */
  private localPsychotropicMonitor(payload: Record<string, any>): Record<string, any> {
    const meds: string[] = Array.isArray(payload.medications) ? payload.medications : [payload.medication].filter(Boolean);
    const flags: string[] = [];

    for (const med of meds.map((m: string) => m.toLowerCase())) {
      if (med.includes('lithium'))      flags.push('Lithium: monitor serum levels (0.6–1.0 mmol/L), renal function, thyroid every 6 months');
      if (med.includes('clozapine'))    flags.push('Clozapine: mandatory weekly FBC for 18 weeks, then fortnightly; watch for agranulocytosis');
      if (med.includes('valproate'))    flags.push('Valproate: LFTs, FBC at baseline; avoid in women of childbearing potential (teratogenic)');
      if (med.includes('olanzapine'))   flags.push('Olanzapine: monitor weight, fasting glucose, lipids quarterly');
      if (med.includes('quetiapine'))   flags.push('Quetiapine: monitor QTc, metabolic parameters; caution in QT-prolonging drug combinations');
      if (med.includes('amitriptyline') || med.includes('tricyclic')) flags.push('TCA: ECG monitoring; high overdose risk — limit supply');
      if (med.includes('ssri') || med.includes('fluoxetine') || med.includes('sertraline')) flags.push('SSRI: monitor for activation/agitation in first 2 weeks; serotonin syndrome risk with tramadol/triptans');
    }

    return {
      source: 'local_fallback',
      medications: meds,
      monitoring_flags: flags,
      recommendation: flags.length ? 'Review monitoring requirements above' : 'No specific psychotropic monitoring alerts',
      guideline: 'NICE Medicines Optimisation Guidance; Maudsley Prescribing Guidelines 14th Ed',
    };
  }
}
