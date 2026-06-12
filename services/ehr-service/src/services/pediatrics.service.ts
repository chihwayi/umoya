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

  // ── IMCI ─────────────────────────────────────────────────────────────────────

  async imciAssessment(payload: Record<string, any>): Promise<any> {
    const local = imciClassify(payload);
    const cdss = await this.cdssService.diagnosisAssist({
      patientId: payload.patientId,
      symptoms: payload.symptoms ?? [],
      vitals: payload.vitals ?? {},
      specialty: 'pediatrics',
      module: 'imci',
    }, null as any, undefined).catch(() => null);
    return { ...local, cdss: cdss ?? { cdssUnavailable: true } };
  }

  async epiSchedule(payload: Record<string, any>): Promise<any> {
    return zimbabweEpiSchedule(payload);
  }
}

// ── IMCI classification (WHO/Zimbabwe integrated management of childhood illness) ──

function imciClassify(p: Record<string, any>): Record<string, any> {
  const ageMonths = Number(p.ageMonths ?? p.age_months ?? 0);
  const temp = Number(p.temperature ?? p.tempC ?? NaN);
  const rr = Number(p.respiratoryRate ?? p.rr ?? NaN);
  const spo2 = Number(p.spo2 ?? NaN);
  const muac = Number(p.muacCm ?? p.muac_cm ?? NaN);
  const dangerSigns: string[] = [];
  const classifications: string[] = [];
  const treatments: string[] = [];

  // General danger signs
  if (p.notAbleToEat || p.notAbleToDrink) dangerSigns.push('Unable to feed/drink');
  if (p.vomitsEverything) dangerSigns.push('Vomits everything');
  if (p.convulsionsNow || p.convulsionsInIllness) dangerSigns.push('Convulsions');
  if (p.lethargyOrUnconscious) dangerSigns.push('Lethargic/unconscious');
  if (p.bulgedFontanelle && ageMonths < 18) dangerSigns.push('Bulging fontanelle');

  // Respiratory: classify by age
  let fastBreathing = false;
  if (!isNaN(rr)) {
    if (ageMonths < 2 && rr >= 60) fastBreathing = true;
    else if (ageMonths < 12 && rr >= 50) fastBreathing = true;
    else if (ageMonths < 60 && rr >= 40) fastBreathing = true;
  }

  const chestIndrawing = !!p.chestIndrawing;
  const stridorCalm = !!p.stridorCalm;
  const cough = !!p.cough || Number(p.coughDays ?? 0) > 0;

  if (cough || !isNaN(rr)) {
    if (dangerSigns.length || chestIndrawing || stridorCalm || (!isNaN(spo2) && spo2 < 90)) {
      classifications.push('Severe pneumonia or very severe disease');
      treatments.push('URGENT referral; oxygen if SpO2 <90%; IV ampicillin + gentamicin');
    } else if (fastBreathing) {
      classifications.push('Pneumonia');
      treatments.push('Amoxicillin 40 mg/kg/dose BD × 5 days; soothe cough; follow up in 2 days');
    } else if (Number(p.coughDays ?? 0) >= 21) {
      classifications.push('Chronic cough — assess for TB/asthma');
      treatments.push('Sputum/GeneXpert if TB suspected; TB prophylaxis if HIV-exposed; refer');
    }
  }

  // Diarrhoea
  if (p.hasDiarrhoea || Number(p.diarrhoeaDays ?? 0) > 0) {
    const dehydration = p.sunkenEyes || p.skinTurgorSlow || p.unableToMakeTearsOrDrink;
    const severeDehydration = p.extremelyLethargic || (dehydration && dangerSigns.length > 0);
    if (severeDehydration) {
      classifications.push('Severe dehydration with diarrhoea');
      treatments.push('Ringer\'s Lactate/NS IV; URGENT referral; ORS after rehydration');
    } else if (dehydration) {
      classifications.push('Some dehydration');
      treatments.push('ORS Plan B: 75 ml/kg over 4 hours; reassess; zinc 20 mg/day × 10 days');
    } else {
      classifications.push('Diarrhoea without dehydration');
      treatments.push('ORS Plan A: offer after each loose stool; zinc 20 mg/day × 10 days; continue feeding');
    }
    if (Number(p.diarrhoeaDays ?? 0) >= 14) {
      classifications.push('Persistent diarrhoea — rule out HIV, TB enteritis');
      treatments.push('Investigate: HIV test, stool culture, nutritional assessment');
    }
  }

  // Fever / malaria
  if (!isNaN(temp) && temp >= 37.5 || p.hasFever) {
    if (p.neckStiffness || p.bulgingFontanelle || p.petechiaeOrPurpura) {
      classifications.push('Very severe febrile disease — possible meningitis/sepsis');
      treatments.push('IV ceftriaxone 100 mg/kg; URGENT referral; blood glucose; lumbar puncture');
    } else if (p.malariaPosRdt) {
      classifications.push('Malaria — confirmed RDT positive');
      treatments.push(ageMonths < 12
        ? 'Artemether-Lumefantrine (weight-based) × 3 days with fatty food'
        : 'AL 80/480 mg BD × 3 days or ACT per national protocol; paracetamol for fever');
    } else {
      treatments.push('Paracetamol 15 mg/kg; tepid sponging; re-test for malaria; monitor');
    }
  }

  // Malnutrition
  if (!isNaN(muac)) {
    if (muac < 11.5 || p.visibleSevereWasting || p.bilateralOedema) {
      classifications.push('Severe acute malnutrition (SAM)');
      treatments.push('RUTF/F-75/F-100 per protocol; treat complications; ITFP referral');
    } else if (muac < 12.5) {
      classifications.push('Moderate acute malnutrition (MAM)');
      treatments.push('SFP enrolment; RUSF; monthly weight monitoring');
    }
  }

  const urgent = dangerSigns.length > 0 || classifications.some(c => c.includes('Severe') || c.includes('Very severe'));

  return {
    source: 'local_imci',
    dangerSigns,
    classifications,
    treatments,
    urgent,
    guideline: 'WHO IMCI Chart Booklet 2014; Zimbabwe IMCI Guidelines',
  };
}

// ── Zimbabwe EPI Schedule ─────────────────────────────────────────────────────

function zimbabweEpiSchedule(p: Record<string, any>): Record<string, any> {
  const schedule = [
    { age: 'Birth', vaccines: ['BCG', 'OPV 0', 'HepB 0 (birth dose within 24h)'] },
    { age: '6 weeks', vaccines: ['DTP-HepB-Hib 1', 'OPV 1', 'PCV 1', 'Rota 1'] },
    { age: '10 weeks', vaccines: ['DTP-HepB-Hib 2', 'OPV 2', 'PCV 2', 'Rota 2'] },
    { age: '14 weeks', vaccines: ['DTP-HepB-Hib 3', 'OPV 3', 'PCV 3', 'IPV'] },
    { age: '9 months', vaccines: ['Measles 1', 'Yellow Fever (endemic areas)'] },
    { age: '18 months', vaccines: ['Measles 2 (MR booster)', 'DTP booster'] },
    { age: 'Grade 3 (~9 yrs)', vaccines: ['HPV dose 1 (girls)'] },
    { age: 'Grade 4 (~10 yrs)', vaccines: ['HPV dose 2 (girls, 6 months after dose 1)'] },
  ];

  const ageWeeks = Number(p.ageWeeks ?? p.age_weeks ?? NaN);
  const ageMonths = Number(p.ageMonths ?? p.age_months ?? (!isNaN(ageWeeks) ? ageWeeks / 4.33 : NaN));

  let due: string[] = [];
  if (!isNaN(ageMonths)) {
    if (ageMonths < 1) due = ['BCG', 'OPV 0', 'HepB 0'];
    else if (ageMonths < 2.5) due = ['DTP-HepB-Hib 1', 'OPV 1', 'PCV 1', 'Rota 1'];
    else if (ageMonths < 3.5) due = ['DTP-HepB-Hib 2', 'OPV 2', 'PCV 2', 'Rota 2'];
    else if (ageMonths < 5) due = ['DTP-HepB-Hib 3', 'OPV 3', 'PCV 3', 'IPV'];
    else if (ageMonths < 10) due = ['Measles 1'];
    else if (ageMonths < 20) due = ['Measles 2', 'DTP booster'];
  }

  return {
    fullSchedule: schedule,
    dueNow: due,
    catchUpNote: 'If vaccinations are overdue: restart schedule from where left off; do not restart from beginning (WHO catch-up guidance)',
    contraindications: [
      'BCG: do not give to confirmed HIV-positive with CD4<200 or severely immunocompromised',
      'Oral Rotavirus: delay if infant is unwell with diarrhoea/vomiting',
      'Yellow Fever: do not give <6 months or to severely immunocompromised',
    ],
    guideline: 'Zimbabwe National Immunisation Programme (NIP) 2023; WHO EPI guidelines',
  };
}
