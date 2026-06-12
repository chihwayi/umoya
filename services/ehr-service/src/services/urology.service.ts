import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { UrologyRegister } from '../entities/urology-register.entity';

@Injectable()
export class UrologyService {
  private readonly logger = new Logger(UrologyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async enroll(tenantId: string, data: Partial<UrologyRegister>): Promise<UrologyRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(UrologyRegister);
    return repo.save(repo.create(data));
  }

  async getRegister(tenantId: string, patientId: string): Promise<UrologyRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(UrologyRegister).findOne({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async listRegisters(tenantId: string, opts: { category?: string; limit?: number } = {}): Promise<UrologyRegister[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(UrologyRegister).createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC').take(opts.limit ?? 100);
    if (opts.category) qb.andWhere('u.diagnosis_category = :c', { c: opts.category });
    return qb.getMany();
  }

  async updateRegister(tenantId: string, id: string, data: Partial<UrologyRegister>): Promise<UrologyRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(UrologyRegister);
    if (!(await repo.findOne({ where: { id } }))) throw new NotFoundException(`Urology register ${id} not found`);
    await repo.update(id, data as any);
    return repo.findOne({ where: { id } }) as Promise<UrologyRegister>;
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async bphManagement(payload: Record<string, any>): Promise<any> {
    const local = bphAlgorithm(payload);
    const cdss = await this.cdssService.getGuidelines('urology', {
      specialty: 'urology',
      module: 'bph_management',
      ...payload,
    }).catch(() => null);
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }

  async renalStoneManagement(payload: Record<string, any>): Promise<any> {
    const local = stoneAlgorithm(payload);
    const cdss = await this.cdssService.diagnosisAssist({
      chiefComplaint: 'renal colic',
      symptoms: payload.symptoms ?? [],
      vitals: payload.vitals ?? {},
      age: payload.age,
      context: 'urology_renal_stone',
      specialty: 'urology',
      module: 'renal_stone_management',
    }, false).catch(() => null);
    return { ...local, cdss: cdss ?? { cdssUnavailable: true } };
  }

  async psaInterpretation(payload: Record<string, any>): Promise<any> {
    return psaAlgorithm(payload);
  }
}

function bphAlgorithm(p: Record<string, any>): Record<string, any> {
  const ipss = Number(p.ipssScore ?? 0);
  const psa = Number(p.psaNgMl ?? 0);
  const prostateVolume = Number(p.prostateVolumeMl ?? 0);
  const retentionHistory = p.acuteUrinaryRetention === true;

  if (retentionHistory) return {
    severity: 'acute_retention',
    recommendation: 'Acute urinary retention — immediate catheterisation (urethral or suprapubic); trial of voiding with alpha-blocker; urology referral',
    urgency: 'immediate',
  };
  if (ipss >= 20) return {
    severity: 'severe_luts',
    recommendation: 'Severe LUTS (IPSS ≥20) — medical therapy: alpha-blocker (tamsulosin) ± 5-ARI (finasteride if prostate >40 mL); consider cystoscopy + uroflowmetry; referral for surgical options (TURP/HoLEP)',
    medications: prostateVolume > 40 ? 'Tamsulosin + Finasteride (5-ARI reduces operative risk)' : 'Tamsulosin alone',
    psa_note: psa > 4 ? 'PSA >4 ng/mL — investigate for prostate cancer before 5-ARI initiation' : null,
  };
  if (ipss >= 8) return {
    severity: 'moderate_luts',
    recommendation: 'Moderate LUTS (IPSS 8–19) — lifestyle advice first; if bothersome, alpha-blocker; 3-month review',
    lifestyle: 'Limit evening fluids, caffeine, alcohol; double voiding; bladder training',
  };
  return {
    severity: 'mild_luts',
    recommendation: 'Mild LUTS (IPSS <8) — reassurance, watchful waiting, lifestyle modification; annual review',
  };
}

function stoneAlgorithm(p: Record<string, any>): Record<string, any> {
  const sizeMm = Number(p.stoneSizeMm ?? 0);
  const location = String(p.stoneLocation ?? '').toLowerCase();
  const infectionFeatures = p.fever || p.rigors || p.wcc > 11;

  if (infectionFeatures) return {
    urgency: 'emergency',
    recommendation: 'Obstructed infected kidney — EMERGENCY: IV antibiotics + urgent decompression (ureteric stent or nephrostomy); urosepsis risk',
  };
  if (sizeMm <= 4) return {
    management: 'conservative',
    recommendation: 'Stone ≤4 mm — 95% pass spontaneously; analgesia (NSAID/opioid); hydration; medical expulsive therapy (tamsulosin); strain urine to collect stone for analysis; review 4 weeks',
  };
  if (sizeMm <= 10) return {
    management: 'mep_or_swl',
    recommendation: `Stone ${sizeMm} mm — medical expulsive therapy + analgesia; consider SWL (shockwave lithotripsy) if ${location.includes('ureter') ? 'proximal ureter' : 'renal pelvis'}; urology referral`,
  };
  return {
    management: 'intervention',
    recommendation: `Stone ${sizeMm} mm >10 mm — urological intervention required: URS (ureteroscopy + laser) or PCNL depending on location and size; urgent urology referral`,
  };
}

function psaAlgorithm(p: Record<string, any>): Record<string, any> {
  const psa = Number(p.psaNgMl ?? 0);
  const age = Number(p.age ?? 60);
  const priorBiopsy = p.priorBiopsy === true;
  const prostateVolume = Number(p.prostateVolumeMl ?? 40);

  // Age-adjusted PSA upper limits
  const ageAdjustedLimit = age < 50 ? 2.5 : age < 60 ? 3.5 : age < 70 ? 4.5 : 6.5;
  const psaDensity = prostateVolume > 0 ? psa / prostateVolume : null;

  if (psa > 10 || (priorBiopsy && psa > 4)) return {
    risk: 'high',
    recommendation: 'PSA >10 ng/mL or rising after prior negative biopsy — refer urology for transrectal ultrasound-guided biopsy; consider multiparametric MRI first',
  };
  if (psa > ageAdjustedLimit) return {
    risk: 'intermediate',
    recommendation: `PSA ${psa} ng/mL above age-adjusted limit ${ageAdjustedLimit} ng/mL — repeat PSA in 6 weeks (excluding prostatitis/UTI); if confirmed elevated, urology referral for mpMRI ± biopsy. PSA density: ${psaDensity !== null ? psaDensity.toFixed(2) : 'N/A'} ng/mL/mL`,
  };
  return {
    risk: 'low',
    recommendation: `PSA ${psa} ng/mL within age-adjusted normal range (${ageAdjustedLimit} ng/mL). Annual PSA monitoring recommended for men 50–70 years.`,
  };
}
