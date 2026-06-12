import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { RheumatologyRegister } from '../entities/rheumatology-register.entity';
import { JointAssessment } from '../entities/joint-assessment.entity';
import { DmardRecord } from '../entities/dmard-record.entity';

// DAS28-ESR = 0.56√(TJC28) + 0.28√(SJC28) + 0.70 ln(ESR) + 0.014(PGA)
function calcDas28Esr(tjc: number, sjc: number, esr: number, pga: number): number {
  return Math.round((0.56 * Math.sqrt(tjc) + 0.28 * Math.sqrt(sjc) + 0.70 * Math.log(esr) + 0.014 * pga) * 100) / 100;
}

function das28Activity(das28: number): string {
  if (das28 < 2.6) return 'remission';
  if (das28 < 3.2) return 'low';
  if (das28 <= 5.1) return 'moderate';
  return 'high';
}

@Injectable()
export class RheumatologyService {
  private readonly logger = new Logger(RheumatologyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async enroll(tenantId: string, data: Partial<RheumatologyRegister>): Promise<RheumatologyRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(RheumatologyRegister);
    return repo.save(repo.create(data));
  }

  async getRegister(tenantId: string, patientId: string): Promise<RheumatologyRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(RheumatologyRegister).findOne({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async listRegisters(tenantId: string, opts: { diagnosis?: string; limit?: number } = {}): Promise<RheumatologyRegister[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(RheumatologyRegister).createQueryBuilder('r')
      .orderBy('r.created_at', 'DESC').take(opts.limit ?? 100);
    if (opts.diagnosis) qb.andWhere('r.primary_diagnosis ILIKE :d', { d: `%${opts.diagnosis}%` });
    return qb.getMany();
  }

  async updateRegister(tenantId: string, id: string, data: Partial<RheumatologyRegister>): Promise<RheumatologyRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(RheumatologyRegister);
    if (!(await repo.findOne({ where: { id } }))) throw new NotFoundException(`Rheumatology register ${id} not found`);
    await repo.update(id, data as any);
    return repo.findOne({ where: { id } }) as Promise<RheumatologyRegister>;
  }

  // ── Joint Assessment ──────────────────────────────────────────────────────

  async recordAssessment(tenantId: string, data: Partial<JointAssessment>): Promise<JointAssessment & { diseaseActivity: any }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);

    // Auto-compute DAS28-ESR if components available
    let das28Esr = data.das28Esr ?? null;
    if (
      data.tenderJointCount28 !== null && data.tenderJointCount28 !== undefined &&
      data.swollenJointCount28 !== null && data.swollenJointCount28 !== undefined &&
      data.esrMmHr !== null && data.esrMmHr !== undefined &&
      data.patientGlobalVas !== null && data.patientGlobalVas !== undefined
    ) {
      das28Esr = calcDas28Esr(
        data.tenderJointCount28,
        data.swollenJointCount28,
        data.esrMmHr,
        data.patientGlobalVas,
      );
    }
    const enriched = { ...data, das28Esr };
    const repo = db.getRepository(JointAssessment);
    const saved = await repo.save(repo.create(enriched));

    // Update register with latest DAS28
    if (data.rheumatologyRegisterId && das28Esr !== null) {
      await db.getRepository(RheumatologyRegister).update(data.rheumatologyRegisterId, {
        currentDas28: das28Esr,
        das28Date: data.assessmentDate,
        diseaseActivity: das28Activity(das28Esr),
      } as any);
    }

    return { ...saved, diseaseActivity: { das28Esr, activity: das28Esr !== null ? das28Activity(das28Esr) : null } };
  }

  async getAssessments(tenantId: string, patientId: string): Promise<JointAssessment[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(JointAssessment).find({ where: { patientId }, order: { assessmentDate: 'DESC' } });
  }

  // ── DMARDs ───────────────────────────────────────────────────────────────

  async recordDmard(tenantId: string, data: Partial<DmardRecord>): Promise<DmardRecord> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(DmardRecord);
    return repo.save(repo.create(data));
  }

  async getDmards(tenantId: string, patientId: string): Promise<DmardRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(DmardRecord).find({ where: { patientId }, order: { startDate: 'DESC' } });
  }

  async stopDmard(tenantId: string, id: string, reason: string): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.getRepository(DmardRecord).update(id, {
      isActive: false,
      stopDate: new Date().toISOString().slice(0, 10),
      stopReason: reason,
    } as any);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async treatToTarget(payload: Record<string, any>): Promise<any> {
    const das28 = Number(payload.das28 ?? 99);
    const local = treatToTargetStrategy(das28, payload);
    const cdss = await this.cdssService.getGuidelines('rheumatology', {
      specialty: 'rheumatology',
      module: 'treat_to_target',
      das28,
      diagnosis: payload.diagnosis,
    }).catch(() => null);
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }

  async goutManagement(payload: Record<string, any>): Promise<any> {
    const local = goutAlgorithm(payload);
    const cdss = await this.cdssService.diagnosisAssist({
      chiefComplaint: 'gout',
      symptoms: payload.symptoms ?? [],
      age: payload.age,
      vitals: payload.vitals,
      context: 'rheumatology_gout',
      specialty: 'rheumatology',
      module: 'gout_management',
    }, false).catch(() => null);
    return { ...local, cdss: cdss ?? { cdssUnavailable: true } };
  }

  async biologicSafetyScan(payload: Record<string, any>): Promise<any> {
    const checks = biologicPreScreen(payload);
    // Always check TB screen before biologic — critical for Zimbabwe TB burden
    const cdss = await this.cdssService.getGuidelines('rheumatology', {
      specialty: 'rheumatology',
      module: 'biologic_pre_screening',
      ...payload,
    }).catch(() => null);
    return { ...checks, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }
}

function treatToTargetStrategy(das28: number, p: Record<string, any>): Record<string, any> {
  const activity = das28Activity(das28);
  if (activity === 'remission') return {
    recommendation: 'Remission achieved (DAS28 <2.6) — maintain current therapy; consider cautious tapering if sustained ≥12 months',
    target: 'sustained_remission',
    tapering: 'Consider reducing biologic frequency after ≥6 months sustained remission',
  };
  if (activity === 'low') return {
    recommendation: 'Low disease activity — target remission; continue and optimise current DMARDs; review 3-monthly',
    target: 'remission',
  };
  if (activity === 'moderate') return {
    recommendation: 'Moderate disease activity — intensify therapy: add/switch csDMARD or introduce bDMARD/JAKi if ≥2 csDMARDs failed',
    target: 'low_or_remission',
    dmardOptions: p.biologicNaive
      ? 'Consider adding MTX + another csDMARD (HCQ/SSZ/LEF) or step up to bDMARD'
      : 'Consider bDMARD switch or JAK inhibitor if csDMARDs have failed',
  };
  return {
    recommendation: 'High disease activity — aggressive treatment escalation; bDMARD or JAKi; consider short bridge steroid; urgent review in 4 weeks',
    target: 'remission',
    urgent: true,
  };
}

function goutAlgorithm(p: Record<string, any>): Record<string, any> {
  const uricAcid = Number(p.uricAcidMmolL ?? 0);
  const acuteGout = p.acuteGout === true || p.acuteGout === 'true';

  if (acuteGout) return {
    phase: 'acute',
    recommendation: 'NSAID (naproxen/indomethacin) if no CKD/peptic ulcer; or colchicine 0.5 mg BD; or prednisolone 30 mg 5 days. DO NOT start ULT during acute attack.',
    contraindications: 'Avoid NSAIDs in CKD, peptic ulcer, anticoagulation',
  };

  const ulTargetMmolL = 0.36; // 360 µmol/L WHO target
  if (uricAcid > ulTargetMmolL || p.frequentFlares || p.tophi || p.urolithiasis) return {
    phase: 'urate_lowering',
    recommendation: `Urate-lowering therapy (ULT) indicated. Allopurinol start 100 mg/day; titrate to uric acid target <360 µmol/L (current: ${(uricAcid * 1000).toFixed(0)} µmol/L). Prophylactic colchicine 0.5 mg BD for first 6 months.`,
    target: '360 µmol/L (<0.36 mmol/L)',
    dietAdvice: 'Reduce purine-rich foods, alcohol (especially beer), fructose. Increase hydration ≥2L/day.',
  };

  return {
    phase: 'monitoring',
    recommendation: 'Uric acid within target — continue diet modification; annual uric acid monitoring; reassess for ULT if flares recur',
  };
}

function biologicPreScreen(p: Record<string, any>): Record<string, any> {
  const contraindications: string[] = [];
  const warnings: string[] = [];

  if (p.activeTb || p.tbSputumPositive) contraindications.push('ABSOLUTE CONTRAINDICATION: Active TB — treat TB before biologic');
  if (!p.tbScreened) warnings.push('CRITICAL: TB screening (TST/IGRA + CXR) mandatory before initiating any biologic in Zimbabwe (high TB burden)');
  if (p.activeSeriousInfection) contraindications.push('Active serious infection — defer biologic');
  if (p.hivPositive && !p.onArt) warnings.push('HIV positive — ensure stable ART and CD4 >200 before biologic; infectious disease consult');
  if (p.heartFailure && (p.nyha === 'III' || p.nyha === 'IV')) contraindications.push('TNF inhibitors contraindicated in NYHA class III/IV heart failure');
  if (p.hepatitisB === 'positive') warnings.push('Hepatitis B — prophylactic antiviral (lamivudine/tenofovir) required during biologic therapy');
  if (p.activeMalignancy) contraindications.push('Active or recent malignancy (<5 years) — assess risk/benefit carefully; haematological malignancy: avoid TNF-i');

  return {
    safeToStart: contraindications.length === 0,
    contraindications,
    warnings,
    mandatoryScreening: ['TB (TST/IGRA + CXR)', 'Hepatitis B & C serology', 'HIV', 'FBC', 'LFTs', 'Renal function', 'Varicella immunity', 'Pregnancy test if applicable'],
  };
}
