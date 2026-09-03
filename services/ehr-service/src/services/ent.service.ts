import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { EntVisit } from '../entities/ent-visit.entity';
import { AudiogramRecord } from '../entities/audiogram-record.entity';

// Pure-tone average (500+1k+2k+4k Hz ÷ 4)
function calcPta(r500: number | null, r1000: number | null, r2000: number | null, r4000: number | null): number | null {
  const vals = [r500, r1000, r2000, r4000].filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function classifyHearingLoss(pta: number | null): string {
  if (pta === null) return 'unknown';
  if (pta <= 25) return 'normal';
  if (pta <= 40) return 'mild';
  if (pta <= 55) return 'moderate';
  if (pta <= 70) return 'moderately_severe';
  if (pta <= 90) return 'severe';
  return 'profound';
}

@Injectable()
export class EntService {
  private readonly logger = new Logger(EntService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── ENT Visits ────────────────────────────────────────────────────────────

  async recordVisit(tenantId: string, data: Partial<EntVisit>): Promise<EntVisit> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EntVisit);
    return repo.save(repo.create(data));
  }

  async getVisits(tenantId: string, patientId: string): Promise<EntVisit[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(EntVisit).find({ where: { patientId }, order: { visitDate: 'DESC' } });
  }

  async getVisit(tenantId: string, id: string): Promise<EntVisit> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const visit = await db.getRepository(EntVisit).findOne({ where: { id } });
    if (!visit) throw new NotFoundException(`ENT visit ${id} not found`);
    return visit;
  }

  async updateVisit(tenantId: string, id: string, data: Partial<EntVisit>): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.getRepository(EntVisit).update(id, data as any);
  }

  // ── Audiograms ────────────────────────────────────────────────────────────

  async recordAudiogram(tenantId: string, data: Partial<AudiogramRecord>): Promise<AudiogramRecord & { analysis: any }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);

    // Auto-compute PTA and classification before save
    const ptaRight = data.ptaRightDb ?? calcPta(data.r500hzAc ?? null, data.r1000hzAc ?? null, data.r2000hzAc ?? null, data.r4000hzAc ?? null);
    const ptaLeft = data.ptaLeftDb ?? calcPta(data.l500hzAc ?? null, data.l1000hzAc ?? null, data.l2000hzAc ?? null, data.l4000hzAc ?? null);
    const enriched: Partial<AudiogramRecord> = {
      ...data,
      ptaRightDb: ptaRight,
      ptaLeftDb: ptaLeft,
      classificationRight: data.classificationRight ?? classifyHearingLoss(ptaRight),
      classificationLeft: data.classificationLeft ?? classifyHearingLoss(ptaLeft),
    };

    const repo = db.getRepository(AudiogramRecord);
    const saved = await repo.save(repo.create(enriched));

    const analysis = {
      ptaRight,
      ptaLeft,
      classificationRight: enriched.classificationRight,
      classificationLeft: enriched.classificationLeft,
      hearingAidIndication: (ptaRight !== null && ptaRight > 40) || (ptaLeft !== null && ptaLeft > 40),
      referralRecommendation: this.audiogramReferral(enriched.classificationRight ?? 'unknown', enriched.classificationLeft ?? 'unknown'),
    };

    return { ...saved, analysis };
  }

  private audiogramReferral(right: string, left: string): string {
    const worst = [right, left].some(c => c === 'profound' || c === 'severe') ? 'severe_profound'
      : [right, left].some(c => c === 'moderately_severe') ? 'moderately_severe'
      : [right, left].some(c => c === 'moderate') ? 'moderate'
      : 'mild_normal';
    if (worst === 'severe_profound') return 'Urgent ENT + audiology referral — cochlear implant evaluation';
    if (worst === 'moderately_severe') return 'ENT referral + hearing aid fitting within 4 weeks';
    if (worst === 'moderate') return 'Audiology referral for hearing aid evaluation';
    return 'Routine monitoring; patient education on noise protection';
  }

  async getAudiograms(tenantId: string, patientId: string): Promise<AudiogramRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(AudiogramRecord).find({ where: { patientId }, order: { testDate: 'DESC' } });
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async tonsillitisTriage(payload: Record<string, any>): Promise<any> {
    const centor = calculateCentor(payload);
    const cdss = await this.cdssService.diagnosisAssist({
      chiefComplaint: 'sore throat',
      symptoms: payload.symptoms ?? [],
      age: payload.age,
      vitals: payload.vitals,
      context: 'ent_tonsillitis',
      specialty: 'ent',
      module: 'pharyngitis_tonsillitis',
    }, false).catch((e: any) => {
      this.logger.warn(`CDSS tonsillitis triage diagnosis assistance fetch failed: ${e?.message}`);
      return null;
    });
    return { ...centor, cdss: cdss ?? { cdssUnavailable: true } };
  }

  async rhinosinusitisTriage(payload: Record<string, any>): Promise<any> {
    const local = rhinosinusitisClassify(payload);
    const cdss = await this.cdssService.getGuidelines('ent', {
      specialty: 'ent',
      module: 'rhinosinusitis',
      ...payload,
    }).catch((e: any) => {
      this.logger.warn(`CDSS rhinosinusitis guideline fetch failed: ${e?.message}`);
      return null;
    });
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }
}

function calculateCentor(p: Record<string, any>): Record<string, any> {
  let score = 0;
  const factors: string[] = [];
  if (p.tonsillarExudate) { score += 1; factors.push('Tonsillar exudate (+1)'); }
  if (p.tenderAnteriorCervicalNodes) { score += 1; factors.push('Tender anterior cervical lymphadenopathy (+1)'); }
  if (p.historyOfFever || (p.temperature && Number(p.temperature) >= 38)) { score += 1; factors.push('History of fever/temp ≥38°C (+1)'); }
  if (!p.cough) { score += 1; factors.push('Absence of cough (+1)'); }
  const age = Number(p.age ?? 99);
  if (age >= 15 && age <= 44) { /* no modification */ }
  else if (age >= 45) { score -= 1; factors.push('Age ≥45 (−1)'); }
  else if (age < 15) { score += 1; factors.push('Age 3–14 (+1)'); }

  let recommendation: string;
  if (score <= 0) recommendation = 'Bacterial GAS unlikely — symptomatic treatment only, no antibiotics';
  else if (score <= 1) recommendation = 'Low probability GAS — symptomatic treatment; no routine antibiotics';
  else if (score <= 3) recommendation = 'Moderate probability — consider throat swab/RADT before antibiotics';
  else recommendation = 'High probability GAS pharyngitis — consider empirical penicillin/amoxicillin';

  return { centorScore: score, factors, recommendation };
}

function rhinosinusitisClassify(p: Record<string, any>): Record<string, any> {
  const durationDays = Number(p.durationDays ?? 0);
  const severity = String(p.severity ?? 'mild').toLowerCase();
  const redFlags = p.periorbitalSwelling || p.visionChange || p.meningism || p.severeHeadache;

  if (redFlags) return {
    classification: 'complicated_sinusitis',
    urgency: 'immediate_referral',
    recommendation: 'RED FLAG — periorbital/intracranial complication suspected. Immediate ENT + CT orbit/sinuses',
  };
  if (durationDays > 90) return {
    classification: 'chronic_rhinosinusitis',
    urgency: 'elective_ent',
    recommendation: 'Chronic rhinosinusitis (>3 months) — intranasal corticosteroids, saline irrigation, consider CT sinuses, ENT referral',
  };
  if (durationDays > 10 && (severity === 'severe' || p.worseningAfterImprovement)) return {
    classification: 'acute_bacterial_rhinosinusitis',
    urgency: 'gp_treatment',
    recommendation: 'Acute bacterial rhinosinusitis likely — amoxicillin 5–7 days; nasal saline; review in 72 h',
  };
  return {
    classification: 'acute_viral_rhinosinusitis',
    urgency: 'symptomatic',
    recommendation: 'Viral rhinosinusitis — analgesics, saline irrigation, decongestants; review if not improving in 10 days',
  };
}
