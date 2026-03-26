import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TbPatient } from '../entities/tb-patient.entity';
import { TbDiagnosis } from '../entities/tb-diagnosis.entity';
import { TbTreatmentEpisode } from '../entities/tb-treatment-episode.entity';
import { TbDotRecord } from '../entities/tb-dot-record.entity';
import { TbContactInvestigation } from '../entities/tb-contact-investigation.entity';
import { TbDrugSusceptibility } from '../entities/tb-drug-susceptibility.entity';
import { TbOutcome } from '../entities/tb-outcome.entity';
import { CdssService } from './cdss.service';

// WHO W4SS criteria keys
const W4SS_SYMPTOMS = ['cough', 'fever', 'night_sweats', 'weight_loss'] as const;

// DST-based regimen rules — WHO consolidated guidelines 2022
function localRegimenFromDst(dst: Record<string, string>): {
  regimen: string;
  rationale: string;
  urgency: string;
} {
  const r = (drug: string) => String(dst[drug] || '').toLowerCase();
  const resistant = (drug: string) => r(drug) === 'resistant' || r(drug) === 'r';
  const susceptible = (drug: string) => r(drug) === 'susceptible' || r(drug) === 's';

  if (resistant('rifampicin') && resistant('isoniazid') && resistant('fluoroquinolone')) {
    return {
      regimen: 'XDR-TB protocol: BPaLM (bedaquiline + pretomanid + linezolid + moxifloxacin)',
      rationale: 'Pre-XDR/XDR-TB pattern detected. Specialist consultation mandatory.',
      urgency: 'urgent',
    };
  }
  if (resistant('rifampicin') && resistant('isoniazid')) {
    return {
      regimen: 'MDR-TB: BPaL or BPaLM (bedaquiline + pretomanid + linezolid ± moxifloxacin)',
      rationale: 'MDR-TB pattern. WHO 2022 short BPaL regimen preferred where feasible.',
      urgency: 'urgent',
    };
  }
  if (resistant('rifampicin') && susceptible('isoniazid')) {
    return {
      regimen: 'RR-TB: bedaquiline + levofloxacin + clofazimine + cycloserine (18–20 months)',
      rationale: 'Rifampicin-resistant mono-resistance. Treat as RR-TB per WHO 2022.',
      urgency: 'high',
    };
  }
  if (resistant('isoniazid') && susceptible('rifampicin')) {
    return {
      regimen: 'Hr-TB: 6RZE (rifampicin + pyrazinamide + ethambutol, 6 months)',
      rationale: 'INH-resistant, RIF-susceptible. Avoid INH; use 6RZE per WHO 2021 guidance.',
      urgency: 'high',
    };
  }
  // Default: pan-susceptible or unknown
  return {
    regimen: 'First-line: 2HRZE/4HR (isoniazid + rifampicin + pyrazinamide + ethambutol)',
    rationale: 'Pan-susceptible or pending DST. Standard WHO first-line 6-month regimen.',
    urgency: 'routine',
  };
}

// Local contact risk stratification
function localContactRisk(contact: Record<string, any>): {
  riskLevel: 'high' | 'medium' | 'low';
  factors: string[];
  recommendation: string;
} {
  const factors: string[] = [];
  let score = 0;

  const age = Number(contact.age ?? contact.contactAge ?? 99);
  if (age < 5) { score += 3; factors.push('Age < 5 years (high-risk group)'); }
  else if (age < 15) { score += 1; factors.push('Age 5–14 years'); }

  const hivStatus = String(contact.hivStatus || contact.hiv_status || '').toLowerCase();
  if (hivStatus === 'positive' || hivStatus === 'hiv+') { score += 3; factors.push('HIV-positive'); }

  const relationship = String(contact.relationship || '').toLowerCase();
  if (['household', 'spouse', 'child', 'parent', 'sibling'].some(r => relationship.includes(r))) {
    score += 2; factors.push('Household contact');
  }

  const exposureHours = Number(contact.dailyExposureHours ?? contact.daily_exposure_hours ?? 0);
  if (exposureHours >= 8) { score += 2; factors.push('High-intensity daily exposure (≥8 h/day)'); }
  else if (exposureHours >= 4) { score += 1; factors.push('Moderate daily exposure (4–8 h/day)'); }

  const malnourished = String(contact.malnourished || '').toLowerCase();
  if (malnourished === 'true' || malnourished === 'yes') { score += 2; factors.push('Malnourished'); }

  let riskLevel: 'high' | 'medium' | 'low';
  let recommendation: string;
  if (score >= 4) {
    riskLevel = 'high';
    recommendation = 'Immediate TB screening + TB preventive therapy (TPT) if eligible. Priority follow-up.';
  } else if (score >= 2) {
    riskLevel = 'medium';
    recommendation = 'TB screening within 2 weeks. Consider TPT for eligible contacts.';
  } else {
    riskLevel = 'low';
    recommendation = 'Routine TB screening. Educate on TB symptom recognition.';
  }

  return { riskLevel, factors, recommendation };
}

@Injectable()
export class TbService {
  private readonly logger = new Logger(TbService.name);

  constructor(private readonly cdssService: CdssService) {}

  // ── Registration ──────────────────────────────────────────────────────────

  async registerPatient(data: Partial<TbPatient>, tenantDb: DataSource): Promise<TbPatient> {
    const repo = tenantDb.getRepository(TbPatient);
    return repo.save(repo.create(data));
  }

  async getTbPatient(tbPatientId: string, tenantDb: DataSource): Promise<TbPatient> {
    const p = await tenantDb.getRepository(TbPatient).findOne({ where: { id: tbPatientId } });
    if (!p) throw new NotFoundException(`TB patient ${tbPatientId} not found`);
    return p;
  }

  async getTbPatientByPatientId(patientId: string, tenantDb: DataSource): Promise<TbPatient | null> {
    return tenantDb.getRepository(TbPatient).findOne({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async updateTbPatient(id: string, data: Partial<TbPatient>, tenantDb: DataSource): Promise<TbPatient> {
    await tenantDb.getRepository(TbPatient).update(id, data as any);
    return this.getTbPatient(id, tenantDb);
  }

  async listTbPatients(
    tenantDb: DataSource,
    opts: { status?: string; caseType?: string; limit?: number } = {},
  ): Promise<TbPatient[]> {
    const qb = tenantDb.getRepository(TbPatient)
      .createQueryBuilder('tp')
      .orderBy('tp.registration_date', 'DESC')
      .take(opts.limit ?? 100);
    if (opts.status)   qb.andWhere('tp.status = :status', { status: opts.status });
    if (opts.caseType) qb.andWhere('tp.case_type = :caseType', { caseType: opts.caseType });
    return qb.getMany();
  }

  // ── Diagnosis ─────────────────────────────────────────────────────────────

  async addDiagnosis(data: Partial<TbDiagnosis>, tenantDb: DataSource): Promise<TbDiagnosis> {
    const repo = tenantDb.getRepository(TbDiagnosis);
    return repo.save(repo.create(data));
  }

  async getDiagnoses(tbPatientId: string, tenantDb: DataSource): Promise<TbDiagnosis[]> {
    return tenantDb.getRepository(TbDiagnosis).find({
      where: { tbPatientId },
      order: { diagnosisDate: 'DESC' },
    });
  }

  // ── Treatment episodes ────────────────────────────────────────────────────

  async startEpisode(data: Partial<TbTreatmentEpisode>, tenantDb: DataSource): Promise<TbTreatmentEpisode> {
    const repo = tenantDb.getRepository(TbTreatmentEpisode);
    return repo.save(repo.create(data));
  }

  async getEpisodes(tbPatientId: string, tenantDb: DataSource): Promise<TbTreatmentEpisode[]> {
    return tenantDb.getRepository(TbTreatmentEpisode).find({
      where: { tbPatientId },
      order: { startDate: 'DESC' },
    });
  }

  async updateEpisode(id: string, data: Partial<TbTreatmentEpisode>, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(TbTreatmentEpisode).update(id, data as any);
  }

  // ── DOT records ───────────────────────────────────────────────────────────

  async recordDot(data: Partial<TbDotRecord>, tenantDb: DataSource): Promise<TbDotRecord> {
    const repo = tenantDb.getRepository(TbDotRecord);
    return repo.save(repo.create(data));
  }

  async getDotRecords(
    tbPatientId: string,
    tenantDb: DataSource,
    opts: { from?: Date; to?: Date; episodeId?: string } = {},
  ): Promise<TbDotRecord[]> {
    const qb = tenantDb.getRepository(TbDotRecord)
      .createQueryBuilder('d')
      .where('d.tb_patient_id = :tbPatientId', { tbPatientId })
      .orderBy('d.dot_date', 'DESC');
    if (opts.from) qb.andWhere('d.dot_date >= :from', { from: opts.from });
    if (opts.to)   qb.andWhere('d.dot_date <= :to', { to: opts.to });
    if (opts.episodeId) qb.andWhere('d.episode_id = :episodeId', { episodeId: opts.episodeId });
    return qb.getMany();
  }

  // ── Contact investigation ─────────────────────────────────────────────────

  async addContact(data: Partial<TbContactInvestigation>, tenantDb: DataSource): Promise<TbContactInvestigation> {
    const repo = tenantDb.getRepository(TbContactInvestigation);
    return repo.save(repo.create(data));
  }

  async getContacts(tbPatientId: string, tenantDb: DataSource): Promise<TbContactInvestigation[]> {
    return tenantDb.getRepository(TbContactInvestigation).find({
      where: { tbPatientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateContact(id: string, data: Partial<TbContactInvestigation>, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(TbContactInvestigation).update(id, data as any);
  }

  // ── DST ───────────────────────────────────────────────────────────────────

  async addDst(data: Partial<TbDrugSusceptibility>, tenantDb: DataSource): Promise<TbDrugSusceptibility & { regimenRecommendation?: any }> {
    const repo = tenantDb.getRepository(TbDrugSusceptibility);
    const saved = await repo.save(repo.create(data));

    // Auto-generate regimen recommendation from DST result
    const dstPattern: Record<string, string> = {};
    for (const key of ['rifampicin', 'isoniazid', 'ethambutol', 'pyrazinamide', 'fluoroquinolone', 'streptomycin', 'bedaquiline', 'linezolid']) {
      const val = (data as any)[key] ?? (data as any)[`dst_${key}`];
      if (val) dstPattern[key] = String(val);
    }

    let regimenRecommendation: any = null;
    if (Object.keys(dstPattern).length > 0) {
      regimenRecommendation = await this.recommendRegimen({
        tbPatientId: data.tbPatientId,
        dstResults: dstPattern,
        caseType: (data as any).caseType,
        hivStatus: (data as any).hivStatus,
      });
    }

    return { ...saved, regimenRecommendation };
  }

  async getDstResults(tbPatientId: string, tenantDb: DataSource): Promise<TbDrugSusceptibility[]> {
    return tenantDb.getRepository(TbDrugSusceptibility).find({
      where: { tbPatientId },
      order: { specimenDate: 'DESC' },
    });
  }

  // ── Outcome ───────────────────────────────────────────────────────────────

  async recordOutcome(data: Partial<TbOutcome>, tenantDb: DataSource): Promise<TbOutcome> {
    const repo = tenantDb.getRepository(TbOutcome);
    const saved = await repo.save(repo.create(data));
    // Mirror onto TbPatient.status
    if (data.tbPatientId && data.outcome) {
      await tenantDb.getRepository(TbPatient).update(data.tbPatientId, { status: data.outcome } as any);
    }
    return saved;
  }

  async getOutcomes(tbPatientId: string, tenantDb: DataSource): Promise<TbOutcome[]> {
    return tenantDb.getRepository(TbOutcome).find({
      where: { tbPatientId },
      order: { outcomeDate: 'DESC' },
    });
  }

  // ── CDSS helpers ──────────────────────────────────────────────────────────

  /**
   * WHO W4SS TB screening + CDSS diagnosis assist.
   * Any positive W4SS symptom triggers CDSS call; local rule engine fallback if CDSS unavailable.
   */
  async screenForTb(payload: Record<string, any>): Promise<any> {
    const symptoms: string[] = [];
    for (const key of W4SS_SYMPTOMS) {
      const val = payload[key] ?? payload[key.replace('_', '')];
      if (val === true || val === 'true' || val === 'yes' || Number(val) > 0) {
        symptoms.push(key.replace('_', ' '));
      }
    }

    // Cough duration check — ≥2 weeks is the WHO threshold
    const coughWeeks = Number(payload.coughDurationWeeks ?? payload.cough_duration_weeks ?? 0);
    const coughPositive = symptoms.includes('cough') || coughWeeks >= 2;
    const w4ssPositive = coughPositive && symptoms.length >= 1;
    const w4ssSymptomCount = symptoms.length + (coughWeeks >= 2 && !symptoms.includes('cough') ? 1 : 0);

    const localResult = {
      w4ssPositive,
      w4ssSymptomCount,
      symptoms,
      coughWeeks: coughWeeks || null,
      tbSuspicion: w4ssSymptomCount >= 2 ? 'high' : w4ssSymptomCount === 1 ? 'moderate' : 'low',
      recommendation: w4ssPositive
        ? 'WHO W4SS screen positive — refer for sputum smear, GeneXpert, and CXR'
        : 'WHO W4SS screen negative — document and rescreen at next visit',
      source: 'local_w4ss',
    };

    if (!w4ssPositive) {
      return localResult;
    }

    // CDSS diagnosis assist for screen-positive patients
    const cdssResult = await this.cdssService
      .diagnosisAssist({
        chiefComplaint: 'cough',
        symptoms: [...symptoms, ...(coughWeeks >= 2 ? ['prolonged cough ≥2 weeks'] : [])],
        age: payload.age,
        gender: payload.gender,
        vitals: payload.vitals,
        context: 'tb_screen',
        specialty: 'infectious_disease',
        module: 'tuberculosis_care',
      }, false)
      .catch((e: any) => {
        this.logger.warn(`CDSS TB screen diagnosis assist failed: ${e?.message || e}`);
        return null;
      });

    return {
      ...localResult,
      cdss: cdssResult ?? { cdssUnavailable: true },
    };
  }

  async recommendRegimen(payload: Record<string, any>): Promise<any> {
    const dstResults: Record<string, string> = payload.dstResults ?? {};

    // Local fallback always available — DST-based rule engine
    const local = localRegimenFromDst(dstResults);

    // Try CDSS for enhanced recommendation
    const cdssResult = await this.cdssService
      .getGuidelines('tuberculosis', {
        age: payload.age,
        gender: payload.gender,
        comorbidities: payload.hivStatus === 'positive' ? ['HIV'] : [],
        specialty: 'infectious_disease',
        module: 'tuberculosis_care',
      })
      .catch((e: any) => {
        this.logger.warn(`CDSS TB regimen guideline failed: ${e?.message || e}`);
        return null;
      });

    return {
      ...local,
      cdssGuidelines: cdssResult ?? { cdssUnavailable: true },
      dstPattern: dstResults,
      hivConsiderations: payload.hivStatus === 'positive'
        ? 'HIV co-infection: start ART within 2 weeks of TB treatment; use efavirenz-based ART; monitor for IRIS'
        : null,
    };
  }

  async assessContactRisk(payload: Record<string, any>): Promise<any> {
    // Local rule-based fallback is always applied
    const local = localContactRisk(payload);

    // CDSS risk assessment for enrichment
    const cdssResult = await this.cdssService
      .riskAssessment({
        patientId: payload.contactId ?? payload.patientId,
        age: payload.age ?? payload.contactAge,
        gender: payload.gender,
        diagnoses: ['tuberculosis contact'],
        vitals: {},
        context: 'tuberculosis_contact',
        specialty: 'infectious_disease',
        module: 'tuberculosis_care',
      }, null as any, undefined)
      .catch((e: any) => {
        this.logger.warn(`CDSS TB contact risk assessment failed: ${e?.message || e}`);
        return null;
      });

    return {
      ...local,
      cdss: cdssResult ?? { cdssUnavailable: true },
    };
  }

  async analyseAdherence(payload: Record<string, any>, tenantDb?: DataSource): Promise<any> {
    // Local DOT adherence analysis if tenantDb is provided
    let localAdherence: any = null;
    if (tenantDb && payload.tbPatientId) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (payload.lookbackDays ?? 30));
      const records = await tenantDb.getRepository(TbDotRecord).find({
        where: { tbPatientId: payload.tbPatientId } as any,
        order: { dotDate: 'DESC' } as any,
      }).catch(() => []);

      const recent = records.filter((r: any) => new Date(r.dotDate) >= cutoff);
      const taken = recent.filter((r: any) => r.status === 'taken' || r.taken === true).length;
      const total = recent.length;
      const adherencePct = total > 0 ? Math.round((taken / total) * 100) : null;

      const missed = recent.filter((r: any) => r.status === 'missed' || r.taken === false);
      const missedStreak = missed.length > 0
        ? missed.filter((r: any) => {
            const d = new Date(r.dotDate);
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            return d >= threeDaysAgo;
          }).length
        : 0;

      localAdherence = {
        adherencePercent: adherencePct,
        dosesTaken: taken,
        dosesTotal: total,
        missedStreak,
        riskLevel: adherencePct === null ? 'unknown'
          : adherencePct >= 90 ? 'low'
          : adherencePct >= 80 ? 'moderate'
          : 'high',
        recommendation: adherencePct !== null && adherencePct < 80
          ? 'Adherence below 80% — intensified DOT support and counselling required'
          : adherencePct !== null && adherencePct < 90
          ? 'Adherence 80–89% — reinforce counselling, identify barriers'
          : 'Adherence satisfactory — continue current support',
      };
    }

    // CDSS analysis for richer insights
    const cdssResult = await this.cdssService
      .diagnosisAssist({
        chiefComplaint: 'TB treatment adherence review',
        symptoms: payload.symptoms ?? [],
        vitals: payload.vitals,
        age: payload.age,
        gender: payload.gender,
        context: 'tb_treatment_adherence',
        specialty: 'infectious_disease',
        module: 'tuberculosis_care',
      }, false)
      .catch((e: any) => {
        this.logger.warn(`CDSS TB adherence analysis failed: ${e?.message || e}`);
        return null;
      });

    return {
      local: localAdherence,
      cdss: cdssResult ?? { cdssUnavailable: true },
    };
  }
}
