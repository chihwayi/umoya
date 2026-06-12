import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { FamilyPlanningEnrollment } from '../entities/family-planning-enrollment.entity';
import { FamilyPlanningFollowup } from '../entities/family-planning-followup.entity';

@Injectable()
export class FamilyPlanningService {
  private readonly logger = new Logger(FamilyPlanningService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async enroll(
    tenantId: string,
    enrolledBy: string | null,
    dto: Partial<FamilyPlanningEnrollment>,
  ): Promise<FamilyPlanningEnrollment> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(FamilyPlanningEnrollment);

    if (dto.patientId) {
      await repo.update(
        { patientId: dto.patientId, status: 'active' },
        {
          status: 'discontinued',
          discontinuationReason: 'Superseded by new family planning enrollment',
        } as Partial<FamilyPlanningEnrollment>,
      );
    }

    const entity = repo.create({
      ...dto,
      enrolledBy: enrolledBy ?? dto.enrolledBy,
    } as Partial<FamilyPlanningEnrollment>);
    return repo.save(entity) as unknown as FamilyPlanningEnrollment;
  }

  async getEnrollments(tenantId: string, patientId: string): Promise<FamilyPlanningEnrollment[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(FamilyPlanningEnrollment).find({
      where: { patientId },
      order: { enrolledAt: 'DESC' },
    });
  }

  async getActiveEnrollment(tenantId: string, patientId: string): Promise<FamilyPlanningEnrollment | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(FamilyPlanningEnrollment).findOne({
      where: { patientId, status: 'active' },
      order: { enrolledAt: 'DESC' },
    });
  }

  async updateEnrollment(
    tenantId: string,
    id: string,
    dto: Partial<FamilyPlanningEnrollment>,
  ): Promise<FamilyPlanningEnrollment | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(FamilyPlanningEnrollment);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Family planning enrollment not found');
    }
    await repo.update(id, dto);
    return repo.findOne({ where: { id } });
  }

  async recordFollowup(
    tenantId: string,
    conductedBy: string | null,
    dto: Partial<FamilyPlanningFollowup>,
  ): Promise<FamilyPlanningFollowup> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(FamilyPlanningFollowup);
    const entity = repo.create({
      ...dto,
      conductedBy: conductedBy ?? dto.conductedBy,
    } as Partial<FamilyPlanningFollowup>);
    return repo.save(entity) as unknown as FamilyPlanningFollowup;
  }

  async getFollowups(tenantId: string, patientId: string): Promise<FamilyPlanningFollowup[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(FamilyPlanningFollowup).find({
      where: { patientId },
      order: { visitDate: 'DESC', createdAt: 'DESC' },
    });
  }

  // ── CDSS ─────────────────────────────────────────────────────────────────────

  async methodCounselling(payload: Record<string, any>): Promise<any> {
    const local = whoMecCounselling(payload);
    const cdss = await this.cdssService.getGuidelines('family_planning', {
      specialty: 'reproductive_health',
      module: 'contraception_counselling',
      ...payload,
    }).catch((e) => { this.logger.warn(`FP CDSS unavailable: ${e?.message}`); return null; });
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }

  async missedMethodProtocol(payload: Record<string, any>): Promise<any> {
    return missedMethodGuidance(payload);
  }

  async postpartumContraception(payload: Record<string, any>): Promise<any> {
    const local = postpartumGuidance(payload);
    const cdss = await this.cdssService.getGuidelines('postpartum_contraception', {
      specialty: 'reproductive_health',
      module: 'postpartum_family_planning',
      ...payload,
    }).catch(() => null);
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }
}

// ── WHO MEC 4th Edition local algorithm ─────────────────────────────────────

function whoMecCounselling(p: Record<string, any>): Record<string, any> {
  const conditions: string[] = [];
  const contraindicated: string[] = [];
  const recommended: string[] = [];
  const caution: string[] = [];

  const hivPositive = !!p.hivPositive;
  const onArv = !!p.onArv;
  const hypertension = !!p.hypertension || Number(p.systolicBp ?? 0) >= 140;
  const smoking = !!p.smoking;
  const ageOver35 = Number(p.age ?? 0) > 35;
  const breastfeeding = !!p.breastfeeding;
  const weeksPostpartum = Number(p.weeksPostpartum ?? 999);
  const diabetes = !!p.diabetes;
  const migraineWithAura = !!p.migraineWithAura;
  const dvtHistory = !!p.dvtHistory || !!p.thrombophilia;
  const liverDisease = !!p.liverDisease || !!p.cirrhosis;
  const desiredMethod = String(p.desiredMethod ?? '').toLowerCase();

  // Combined oral contraceptives (COC) contraindications
  const cocContraindicated = [
    hypertension && smoking && ageOver35,
    migraineWithAura,
    dvtHistory,
    liverDisease,
    breastfeeding && weeksPostpartum < 6,
  ].some(Boolean);

  if (cocContraindicated) {
    contraindicated.push('Combined oral contraceptive (COC)');
    conditions.push(...[
      migraineWithAura ? 'Migraine with aura (MEC 4 for COC)' : '',
      dvtHistory ? 'DVT/thrombophilia history (MEC 4 for COC)' : '',
      liverDisease ? 'Liver disease (MEC 3-4 for COC)' : '',
    ].filter(Boolean));
  } else {
    recommended.push('Combined oral contraceptive (COC) — take at same time daily');
  }

  // Progestogen-only (POP/implant/DMPA) — generally safer
  if (!liverDisease) {
    recommended.push('Progestogen-only pill (POP) — safe with HIV/ARVs (check enzyme-inducing ARVs)');
    recommended.push('Subdermal implant (e.g., Jadelle) — highly effective, reversible; check ARV interactions');
  }

  // DMPA (Depo-Provera) — caution with bone density
  if (!liverDisease) {
    caution.push('DMPA (Depo-Provera) 150 mg IM every 12 weeks — monitor bone density in long-term use');
  }

  // IUCD — generally safe; avoid if recent STI
  if (!p.recentPid && !p.unexplainedVaginalBleeding) {
    recommended.push('Copper IUCD — non-hormonal, 10 years, MEC 1 for most conditions');
    recommended.push('Levonorgestrel IUS (Mirena) — 5 years; reduces menorrhagia');
  }

  // Male/female condom always recommended for dual protection
  recommended.push('Male condom — dual protection (pregnancy + STI/HIV prevention); recommend regardless of other method');

  // HIV-positive specific
  if (hivPositive) {
    conditions.push('HIV+ patient: all hormonal methods MEC 1 except check for enzyme-inducing ARVs (EFV, NVP, LPV/r) which reduce implant/POP efficacy by 40–50%');
    caution.push('With EFV/NVP/LPV-r: prefer copper IUCD or DMPA (higher dose estrogen or shorter interval)');
  }

  // Emergency contraception
  const ecRecommendation = 'Emergency contraception: Levonorgestrel 1.5 mg within 72 h (up to 120 h reduces efficacy); copper IUCD within 5 days is most effective EC';

  return {
    source: 'local_who_mec_4th_ed',
    recommended,
    caution,
    contraindicated,
    conditionNotes: conditions,
    emergencyContraception: ecRecommendation,
    guideline: 'WHO Medical Eligibility Criteria for Contraceptive Use, 4th edition (2015)',
  };
}

function missedMethodGuidance(p: Record<string, any>): Record<string, any> {
  const method = String(p.method ?? '').toLowerCase();
  const hoursLate = Number(p.hoursLate ?? 0);
  const pillsMissed = Number(p.pillsMissed ?? 1);

  if (method.includes('coc') || method.includes('combined')) {
    if (pillsMissed === 1) return { guidance: 'Take missed pill immediately. Continue pack as normal. No additional contraception needed.', ecRequired: false };
    if (pillsMissed >= 2 && p.weekInPack <= 2) return { guidance: 'Take most recent missed pill immediately. Discard others. Use condoms for 7 days. If missed in week 1 and unprotected sex: consider EC.', ecRequired: p.weekInPack === 1, source: 'WHO_FP_manual' };
    return { guidance: 'Take most recent missed pill. Finish pack. Use condoms for 7 days. Omit pill-free interval if week 3.', ecRequired: false };
  }

  if (method.includes('dmpa') || method.includes('depo')) {
    return hoursLate <= 4 * 7 * 24
      ? { guidance: 'Repeat injection now — up to 4 weeks late is acceptable. No additional contraception needed.', ecRequired: false }
      : { guidance: 'Injection overdue >4 weeks. Rule out pregnancy before giving. Use condoms until next injection on time.', ecRequired: false };
  }

  if (method.includes('pop') || method.includes('progestogen')) {
    return hoursLate <= 3
      ? { guidance: 'Take pill immediately. Continue as normal.', ecRequired: false }
      : { guidance: 'Take pill immediately. Use condoms for 48 hours. If unprotected sex in window: consider EC.', ecRequired: true };
  }

  return { guidance: 'Refer to package insert for specific method instructions. Use condoms until method effectiveness restored.', ecRequired: null };
}

function postpartumGuidance(p: Record<string, any>): Record<string, any> {
  const weeksPostpartum = Number(p.weeksPostpartum ?? 0);
  const breastfeeding = !!p.breastfeeding;

  if (weeksPostpartum < 6 && breastfeeding) {
    return {
      recommendation: 'Progestogen-only methods (POP, implant, DMPA) safe from birth if breastfeeding. COC and IUCD: defer until 6 weeks postpartum.',
      lac: 'LAM (Lactational Amenorrhoea Method) highly effective if: exclusively breastfeeding, amenorrhoeic, <6 months postpartum — 98% efficacy',
      guideline: 'WHO MEC 4th Ed; WHO FP Global Handbook',
    };
  }
  if (weeksPostpartum < 6 && !breastfeeding) {
    return {
      recommendation: 'All progestogen-only methods safe from birth. COC: defer until 3 weeks (VTE risk). Copper IUCD: can insert within 48 h or after 4 weeks.',
      guideline: 'WHO MEC 4th Ed',
    };
  }
  return {
    recommendation: 'All contraceptive methods now eligible. Choose based on patient preference and MEC conditions.',
    guideline: 'WHO MEC 4th Ed',
  };
}
