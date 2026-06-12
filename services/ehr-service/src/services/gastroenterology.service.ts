import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { GastroRegister } from '../entities/gastro-register.entity';
import { EndoscopyRecord } from '../entities/endoscopy-record.entity';

// Child-Pugh liver disease severity
function childPughScore(p: Record<string, any>): { score: number; grade: string; prognosis: string } {
  let score = 0;
  const bilirubin = Number(p.bilirubinMmolL ?? 0);
  score += bilirubin < 34 ? 1 : bilirubin <= 51 ? 2 : 3;
  const albumin = Number(p.albuminGdL ?? 99);
  score += albumin > 35 ? 1 : albumin >= 28 ? 2 : 3;
  const pt = Number(p.ptProlongationSeconds ?? 0);
  score += pt < 4 ? 1 : pt <= 6 ? 2 : 3;
  const ascites = String(p.ascites ?? 'none').toLowerCase();
  score += ascites === 'none' ? 1 : ascites === 'mild' ? 2 : 3;
  const encephalopathy = String(p.encephalopathy ?? 'none').toLowerCase();
  score += encephalopathy === 'none' ? 1 : encephalopathy === 'grade_1_2' ? 2 : 3;

  const grade = score <= 6 ? 'A' : score <= 9 ? 'B' : 'C';
  const prognosis = grade === 'A' ? '1-year survival ~100%, 2-year ~85%'
    : grade === 'B' ? '1-year survival ~81%, 2-year ~57%'
    : '1-year survival ~45%, 2-year ~35%';
  return { score, grade, prognosis };
}

@Injectable()
export class GastroenterologyService {
  private readonly logger = new Logger(GastroenterologyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async enroll(tenantId: string, data: Partial<GastroRegister>): Promise<GastroRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(GastroRegister);
    return repo.save(repo.create(data));
  }

  async getRegister(tenantId: string, patientId: string): Promise<GastroRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(GastroRegister).findOne({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async listRegisters(tenantId: string, opts: { giRegion?: string; limit?: number } = {}): Promise<GastroRegister[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(GastroRegister).createQueryBuilder('g')
      .orderBy('g.created_at', 'DESC').take(opts.limit ?? 100);
    if (opts.giRegion) qb.andWhere('g.gi_region = :r', { r: opts.giRegion });
    return qb.getMany();
  }

  async updateRegister(tenantId: string, id: string, data: Partial<GastroRegister>): Promise<GastroRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(GastroRegister);
    if (!(await repo.findOne({ where: { id } }))) throw new NotFoundException(`Gastro register ${id} not found`);
    await repo.update(id, data as any);
    return repo.findOne({ where: { id } }) as Promise<GastroRegister>;
  }

  // ── Endoscopy ─────────────────────────────────────────────────────────────

  async recordEndoscopy(tenantId: string, data: Partial<EndoscopyRecord>): Promise<EndoscopyRecord> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EndoscopyRecord);
    return repo.save(repo.create(data));
  }

  async getEndoscopies(tenantId: string, patientId: string): Promise<EndoscopyRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(EndoscopyRecord).find({ where: { patientId }, order: { procedureDate: 'DESC' } });
  }

  async updateEndoscopy(tenantId: string, id: string, data: Partial<EndoscopyRecord>): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.getRepository(EndoscopyRecord).update(id, data as any);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async upperGiBleedRisk(payload: Record<string, any>): Promise<any> {
    // Rockall score
    const rockall = calcRockall(payload);
    const cdss = await this.cdssService.riskAssessment({
      patientId: payload.patientId,
      diagnoses: ['upper GI bleed'],
      vitals: payload.vitals ?? {},
      context: 'upper_gi_bleed',
      specialty: 'gastroenterology',
      module: 'gi_haemorrhage',
    }, null as any, undefined).catch(() => null);
    return { ...rockall, cdss: cdss ?? { cdssUnavailable: true } };
  }

  async cirrhosisRisk(payload: Record<string, any>): Promise<any> {
    const cp = childPughScore(payload);
    const cdss = await this.cdssService.getGuidelines('gastroenterology', {
      specialty: 'gastroenterology',
      module: 'cirrhosis_management',
      childPughGrade: cp.grade,
      ...payload,
    }).catch(() => null);
    return { ...cp, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }

  async dyspepsiaGuidance(payload: Record<string, any>): Promise<any> {
    const local = dyspepsiaAlgorithm(payload);
    const cdss = await this.cdssService.diagnosisAssist({
      chiefComplaint: 'dyspepsia',
      symptoms: payload.symptoms ?? [],
      age: payload.age,
      vitals: payload.vitals,
      context: 'gastroenterology_dyspepsia',
      specialty: 'gastroenterology',
      module: 'dyspepsia_management',
    }, false).catch(() => null);
    return { ...local, cdss: cdss ?? { cdssUnavailable: true } };
  }
}

function calcRockall(p: Record<string, any>): Record<string, any> {
  let score = 0;
  const factors: string[] = [];
  const age = Number(p.age ?? 0);
  if (age >= 80) { score += 2; factors.push('Age ≥80 (+2)'); }
  else if (age >= 60) { score += 1; factors.push('Age 60–79 (+1)'); }
  const sbp = Number(p.systolicBp ?? 120);
  const hr = Number(p.heartRate ?? 80);
  if (sbp < 100 && hr > 100) { score += 2; factors.push('Shock: SBP <100, HR >100 (+2)'); }
  else if (sbp < 100) { score += 2; factors.push('Hypotension SBP <100 (+2)'); }
  else if (hr > 100) { score += 1; factors.push('Tachycardia HR >100 (+1)'); }
  if (p.liverDisease || p.renalFailure || p.disseminatedMalignancy) { score += 2; factors.push('Major comorbidity (+2)'); }
  else if (p.cardiacFailure || p.ischemicHeartDisease || p.anyMajorComorbidity) { score += 1; factors.push('Comorbidity (+1)'); }

  const risk = score <= 2 ? 'low' : score <= 4 ? 'moderate' : 'high';
  const recommendation = score <= 2
    ? 'Low risk (Rockall ≤2) — consider outpatient endoscopy if haemodynamically stable'
    : score <= 4
    ? 'Moderate risk — inpatient endoscopy within 24 h, IV PPI'
    : 'High risk (Rockall >4) — urgent endoscopy within 12 h, resuscitate, involve surgery';
  return { rockallScore: score, risk, recommendation, factors };
}

function dyspepsiaAlgorithm(p: Record<string, any>): Record<string, any> {
  const alarmFeatures = p.dysphagia || p.unintentionalWeightLoss || p.vomiting ||
    p.gi_bleed || p.anaemia || (Number(p.age ?? 0) >= 55 && p.newOnsetDyspepsia);
  if (alarmFeatures) return {
    classification: 'alarm_features_present',
    urgency: 'urgent_endoscopy',
    recommendation: 'ALARM features present — urgent OGD within 2 weeks to exclude malignancy',
  };
  const hPyloriTested = p.hPyloriStatus;
  if (hPyloriTested === 'positive') return {
    classification: 'h_pylori_positive_dyspepsia',
    urgency: 'treat',
    recommendation: 'H. pylori positive — triple therapy (PPI + amoxicillin + clarithromycin) 7–14 days; test of cure 4 weeks post-treatment',
  };
  return {
    classification: 'functional_dyspepsia',
    urgency: 'medical_management',
    recommendation: 'H. pylori test-and-treat strategy; PPI trial 4–8 weeks; lifestyle advice; reassess',
  };
}
