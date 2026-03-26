import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CdssService } from './cdss.service';
import { PediatricProfile } from '../entities/pediatric-profile.entity';
import { GrowthMeasurement } from '../entities/growth-measurement.entity';
import { DevelopmentalMilestone } from '../entities/developmental-milestone.entity';
import { NeonatalRecord } from '../entities/neonatal-record.entity';
import { SchoolHealthRecord } from '../entities/school-health-record.entity';

@Injectable()
export class PediatricsService {
  private readonly logger = new Logger(PediatricsService.name);

  constructor(private readonly cdssService: CdssService) {}

  // ── Pediatric Profile ─────────────────────────────────────────────────────

  async getOrCreateProfile(patientId: string, tenantDb: DataSource): Promise<PediatricProfile> {
    const repo = tenantDb.getRepository(PediatricProfile);
    const existing = await repo.findOne({ where: { patientId } });
    if (existing) return existing;
    return repo.save(repo.create({ patientId }));
  }

  async updateProfile(patientId: string, data: Partial<PediatricProfile>, tenantDb: DataSource): Promise<PediatricProfile> {
    const repo = tenantDb.getRepository(PediatricProfile);
    const existing = await repo.findOne({ where: { patientId } });
    if (existing) {
      await repo.update(existing.id, data as any);
      return repo.findOne({ where: { patientId } }) as Promise<PediatricProfile>;
    }
    return repo.save(repo.create({ ...data, patientId }));
  }

  // ── Growth ────────────────────────────────────────────────────────────────

  async addGrowthMeasurement(data: Partial<GrowthMeasurement>, tenantDb: DataSource): Promise<GrowthMeasurement> {
    const repo = tenantDb.getRepository(GrowthMeasurement);
    const saved = await repo.save(repo.create(data));

    // Auto-calculate Z-scores via CDSS (non-blocking update)
    if (data.patientId && (data.weightKg || data.heightCm)) {
      this.assessGrowth({
        patient_id:  data.patientId,
        age_months:  data.ageMonths,
        weight_kg:   data.weightKg,
        height_cm:   data.heightCm,
        head_circ_cm: data.headCircumferenceCm,
        muac_cm:     data.muacCm,
        gender:      null,
      }).then((result) => {
        if (!result?.error) {
          repo.update(saved.id, {
            weightForAgeZ:      result.weight_for_age_z,
            heightForAgeZ:      result.height_for_age_z,
            weightForHeightZ:   result.weight_for_height_z,
            bmiForAgeZ:         result.bmi_for_age_z,
            nutritionalStatus:  result.nutritional_status,
          } as any);
        }
      }).catch(() => {});
    }

    return saved;
  }

  async getGrowthHistory(patientId: string, tenantDb: DataSource, limit = 24): Promise<GrowthMeasurement[]> {
    return tenantDb.getRepository(GrowthMeasurement).find({
      where: { patientId },
      order: { measuredAt: 'DESC' },
      take: limit,
    });
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  async upsertMilestone(data: Partial<DevelopmentalMilestone>, tenantDb: DataSource): Promise<DevelopmentalMilestone> {
    const repo = tenantDb.getRepository(DevelopmentalMilestone);
    if (data.patientId && data.domain && data.milestone) {
      const existing = await repo.findOne({
        where: { patientId: data.patientId, domain: data.domain, milestone: data.milestone },
      });
      if (existing) {
        await repo.update(existing.id, data as any);
        return repo.findOne({ where: { id: existing.id } }) as Promise<DevelopmentalMilestone>;
      }
    }
    return repo.save(repo.create(data));
  }

  async getMilestones(patientId: string, tenantDb: DataSource, domain?: string): Promise<DevelopmentalMilestone[]> {
    const where: any = { patientId };
    if (domain) where.domain = domain;
    return tenantDb.getRepository(DevelopmentalMilestone).find({ where, order: { expectedAgeMonths: 'ASC' } });
  }

  // ── Neonatal ──────────────────────────────────────────────────────────────

  async getNeonatalRecord(patientId: string, tenantDb: DataSource): Promise<NeonatalRecord | null> {
    return tenantDb.getRepository(NeonatalRecord).findOne({ where: { patientId } });
  }

  async saveNeonatalRecord(data: Partial<NeonatalRecord>, tenantDb: DataSource): Promise<NeonatalRecord> {
    const repo = tenantDb.getRepository(NeonatalRecord);
    const existing = await repo.findOne({ where: { patientId: data.patientId } });
    if (existing) {
      await repo.update(existing.id, data as any);
      return repo.findOne({ where: { id: existing.id } }) as Promise<NeonatalRecord>;
    }
    return repo.save(repo.create(data));
  }

  // ── School health ─────────────────────────────────────────────────────────

  async addSchoolHealthRecord(data: Partial<SchoolHealthRecord>, tenantDb: DataSource): Promise<SchoolHealthRecord> {
    const repo = tenantDb.getRepository(SchoolHealthRecord);
    return repo.save(repo.create(data));
  }

  async getSchoolHealthRecords(patientId: string, tenantDb: DataSource): Promise<SchoolHealthRecord[]> {
    return tenantDb.getRepository(SchoolHealthRecord).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async pediatricDosing(payload: Record<string, any>): Promise<any> {
    return this.cdssService.getDosingRecommendation(payload);
  }

  async assessGrowth(payload: Record<string, any>): Promise<any> {
    try {
      return await this.cdssService.diagnosisAssist(
        {
          ...payload,
          context: 'growth_assessment',
          specialty: 'pediatrics',
          module: 'growth_and_development',
        },
        true,
      );
    } catch (err: any) {
      this.logger.warn(`[Pediatrics] CDSS growth assessment unavailable: ${err?.message}`);
      return this.localGrowthFlag(payload);
    }
  }

  /** WHO weight-for-age red flags — nutritional status local approximation. */
  private localGrowthFlag(payload: Record<string, any>): Record<string, any> {
    const waz = Number(payload.weight_for_age_z ?? NaN);
    const haz = Number(payload.height_for_age_z ?? NaN);
    const whz = Number(payload.weight_for_height_z ?? NaN);
    const muac = Number(payload.muac_cm ?? NaN);

    let nutritionalStatus = 'normal';
    const flags: string[] = [];
    if (!isNaN(whz) || !isNaN(muac)) {
      const sam = (!isNaN(whz) && whz < -3) || (!isNaN(muac) && muac < 11.5);
      const mam = (!isNaN(whz) && whz < -2) || (!isNaN(muac) && muac < 12.5);
      if (sam)      { nutritionalStatus = 'SAM'; flags.push('Severe acute malnutrition (SAM)'); }
      else if (mam) { nutritionalStatus = 'MAM'; flags.push('Moderate acute malnutrition (MAM)'); }
    }
    if (!isNaN(haz) && haz < -2) flags.push('Stunting (HAZ <-2)');
    if (!isNaN(waz) && waz < -2) flags.push('Underweight (WAZ <-2)');

    return {
      source: 'local_fallback',
      nutritional_status: nutritionalStatus,
      flags,
      recommendation: nutritionalStatus === 'SAM'
        ? 'SAM: Refer to inpatient therapeutic feeding programme (ITFP); RUTF if uncomplicated'
        : nutritionalStatus === 'MAM'
          ? 'MAM: Supplementary feeding programme (SFP); RUSF or fortified blended foods; monthly monitoring'
          : flags.length
            ? 'Stunting or underweight: dietary assessment, micronutrient supplementation, monthly monitoring'
            : 'Growth within normal range',
      guideline: 'WHO Child Growth Standards 2006; IMAM Guidelines',
    };
  }

  async assessMilestones(payload: Record<string, any>): Promise<any> {
    try {
      return await this.cdssService.diagnosisAssist(
        {
          ...payload,
          context: 'developmental_milestone_assessment',
          specialty: 'pediatrics',
          module: 'growth_and_development',
        },
        true,
      );
    } catch (err: any) {
      this.logger.warn(`[Pediatrics] CDSS milestone assessment unavailable: ${err?.message}`);
      return this.localMilestoneAssessment(payload);
    }
  }

  /** CDC/WHO developmental milestone red flags (local fallback). */
  private localMilestoneAssessment(payload: Record<string, any>): Record<string, any> {
    const ageMonths = Number(payload.age_months ?? payload.ageMonths ?? NaN);
    const redFlags: string[] = [];

    if (!isNaN(ageMonths)) {
      if (ageMonths >= 2  && !payload.social_smile)            redFlags.push('No social smile by 2 months');
      if (ageMonths >= 4  && !payload.head_control)             redFlags.push('Poor head control at 4 months');
      if (ageMonths >= 6  && !payload.sits_with_support)        redFlags.push('Not sitting with support at 6 months');
      if (ageMonths >= 9  && !payload.babbling)                 redFlags.push('No babbling at 9 months');
      if (ageMonths >= 12 && !payload.walks_with_support)       redFlags.push('Not pulling to stand at 12 months');
      if (ageMonths >= 12 && !payload.single_words)             redFlags.push('No single words at 12 months');
      if (ageMonths >= 18 && !payload.walks_independently)      redFlags.push('Not walking independently at 18 months');
      if (ageMonths >= 24 && !payload.two_word_phrases)         redFlags.push('No two-word phrases at 24 months');
      if (ageMonths >= 36 && !payload.intelligible_speech_50pct)redFlags.push('Less than 50% intelligible speech at 36 months');
    }

    return {
      source: 'local_fallback',
      age_months: ageMonths,
      red_flags: redFlags,
      requires_referral: redFlags.length > 0,
      recommendation: redFlags.length
        ? `Developmental concern: ${redFlags.join('; ')}. Refer to developmental paediatrics.`
        : 'Developmental milestones appropriate for age. Continue routine surveillance.',
      guideline: 'CDC Developmental Milestones 2022; WHO Motor Development Study',
    };
  }
}
