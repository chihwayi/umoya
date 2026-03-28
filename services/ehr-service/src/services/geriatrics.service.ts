import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { GeriatricAssessment } from '../entities/geriatric-assessment.entity';
import { FallsAssessment } from '../entities/falls-assessment.entity';
import { PressureInjuryAssessment } from '../entities/pressure-injury-assessment.entity';
import { PolypharmacyReview } from '../entities/polypharmacy-review.entity';
import { AdvanceCarePlanning } from '../entities/advance-care-planning.entity';

@Injectable()
export class GeriatricsService {
  private readonly logger = new Logger(GeriatricsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

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
    try {
      return await this.cdssService.riskAssessment({
        ...payload,
        context: 'frailty_assessment',
        specialty: 'geriatrics',
        module: 'frailty_and_cga',
      });
    } catch (err: any) {
      this.logger.warn(`[Geriatrics] CDSS frailty assessment unavailable: ${err?.message}`);
      return this.localFrailtyAssessment(payload);
    }
  }

  async checkPolypharmacy(payload: Record<string, any>) {
    try {
      const meds = payload.medications || payload.drugs || [];
      return await this.cdssService.checkHighRiskMedications(meds, payload.age, payload.gender);
    } catch (err: any) {
      this.logger.warn(`[Geriatrics] CDSS polypharmacy check unavailable: ${err?.message}`);
      return this.localPolypharmacyCheck(payload);
    }
  }

  async assessFallRisk(payload: Record<string, any>) {
    try {
      return await this.cdssService.riskAssessment({
        ...payload,
        context: 'fall_risk',
        specialty: 'geriatrics',
        module: 'fall_prevention',
      });
    } catch (err: any) {
      this.logger.warn(`[Geriatrics] CDSS fall risk assessment unavailable: ${err?.message}`);
      return this.localFallRisk(payload);
    }
  }

  /** Fried Frailty Phenotype (5 criteria). */
  private localFrailtyAssessment(payload: Record<string, any>): Record<string, any> {
    let score = 0;
    const criteria: string[] = [];
    if (payload.weight_loss || payload.unintentional_weight_loss_5kg) { score++; criteria.push('Unintentional weight loss >5 kg in past year'); }
    if (payload.exhaustion || payload.self_reported_exhaustion)        { score++; criteria.push('Self-reported exhaustion'); }
    if (payload.low_activity || payload.low_physical_activity)        { score++; criteria.push('Low physical activity (kcal/week below sex-specific threshold)'); }
    if (payload.slow_gait || payload.gait_speed_ms < 0.8)             { score++; criteria.push(`Slow gait speed (${payload.gait_speed_ms ?? '<0.8'} m/s)`); }
    if (payload.weak_grip || Number(payload.grip_strength_kg ?? 999) < (payload.gender === 'female' ? 18 : 27)) {
      score++;
      criteria.push('Weak grip strength');
    }
    const frailty = score >= 3 ? 'frail' : score >= 1 ? 'pre-frail' : 'robust';
    return {
      source: 'local_fallback',
      fried_score: score,
      frailty_category: frailty,
      criteria_met: criteria,
      recommendation: frailty === 'frail'
        ? 'Comprehensive geriatric assessment; falls prevention; physiotherapy; medication review; nutrition support'
        : frailty === 'pre-frail'
          ? 'Physical activity programme; nutritional assessment; medication review; 6-monthly review'
          : 'Maintain activity; annual screening',
      guideline: 'Fried LP et al. Frailty in Older Adults. J Gerontol 2001',
    };
  }

  /** Polypharmacy flag — Beers Criteria 2023 + medication count threshold. */
  private localPolypharmacyCheck(payload: Record<string, any>): Record<string, any> {
    const meds: string[] = (payload.medications || payload.drugs || []).map((m: any) => String(m.name || m).toLowerCase());
    const count = meds.length;
    const beersFlags: string[] = [];
    const beersHighRisk = ['amitriptyline', 'diphenhydramine', 'diazepam', 'nitrazepam', 'glibenclamide', 'indomethacin', 'chlorphenamine', 'promethazine'];
    for (const med of meds) {
      if (beersHighRisk.some(b => med.includes(b))) beersFlags.push(`${med} — on AGS Beers Criteria 2023 (avoid in age ≥65)`);
    }
    return {
      source: 'local_fallback',
      medication_count: count,
      polypharmacy: count >= 5,
      excessive_polypharmacy: count >= 10,
      beers_flags: beersFlags,
      recommendation: count >= 10
        ? 'Excessive polypharmacy (≥10 drugs): Immediate medication review with pharmacist — deprescribing strongly recommended'
        : count >= 5
          ? 'Polypharmacy (≥5 drugs): Structured medication review recommended using STOPPFrail/START criteria'
          : 'No polypharmacy concern',
      guideline: 'AGS Beers Criteria 2023; STOPP/START v3 2023',
    };
  }

  /** Morse Fall Scale — local calculation. */
  private localFallRisk(payload: Record<string, any>): Record<string, any> {
    let score = 0;
    if (payload.history_of_falls)     score += 25;
    if (payload.secondary_diagnosis)  score += 15;
    if (payload.ambulatory_aid === 'furniture' || payload.ambulatory_aid === 'crutches') score += 30;
    if (payload.iv_access)            score += 20;
    if (payload.gait === 'impaired')  score += 10;
    if (payload.gait === 'weak')      score += 10;
    if (payload.mental_status === 'confused') score += 15;

    const risk = score >= 45 ? 'high' : score >= 25 ? 'moderate' : 'low';
    return {
      source: 'local_fallback',
      morse_score: score,
      risk_level: risk,
      recommendation: risk === 'high'
        ? 'High fall risk: bed alarm, non-slip footwear, physiotherapy, medication review (sedatives/antihypertensives), hip protectors, call bell within reach'
        : risk === 'moderate'
          ? 'Moderate fall risk: standard fall precautions; review contributing medications'
          : 'Low fall risk: standard safety measures',
      guideline: 'Morse JM. Morse Fall Scale. Adv Nurs Sci 1989',
    };
  }
}
