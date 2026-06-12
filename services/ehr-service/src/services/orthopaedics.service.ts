import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { OrthopaedicRegister } from '../entities/orthopaedic-register.entity';
import { FractureRecord } from '../entities/fracture-record.entity';
import { JointReplacementRecord } from '../entities/joint-replacement-record.entity';

// Gustilo-Anderson open fracture classification → management urgency
function gustiloUrgency(grade: string | null): string {
  if (!grade) return 'routine';
  const g = grade.toUpperCase();
  if (g === 'IIIB' || g === 'IIIC') return 'immediate_theatre';
  if (g === 'IIIA' || g === 'IIB') return 'urgent_theatre';
  if (g === 'IIA' || g === 'II') return 'semi_urgent';
  return 'urgent';
}

// Neurovascular compromise always → immediate
function fractureUrgency(fracture: Record<string, any>): { urgency: string; alerts: string[] } {
  const alerts: string[] = [];
  let urgency = 'semi_urgent';

  if (fracture['hasNeurovascularCompromise']) {
    alerts.push('NEUROVASCULAR COMPROMISE — immediate vascular/orthopaedic review');
    urgency = 'immediate';
  }
  if (fracture['isOpen']) {
    const gUrgency = gustiloUrgency(fracture['gustiloGrade'] ?? null);
    alerts.push(`Open fracture Gustilo ${fracture['gustiloGrade'] ?? 'ungraded'} — ${gUrgency}`);
    if (gUrgency === 'immediate_theatre') urgency = 'immediate';
    else if (gUrgency === 'urgent_theatre' && urgency !== 'immediate') urgency = 'urgent';
  }
  return { urgency, alerts };
}

@Injectable()
export class OrthopaedicsService {
  private readonly logger = new Logger(OrthopaedicsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async enroll(tenantId: string, data: Partial<OrthopaedicRegister>): Promise<OrthopaedicRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OrthopaedicRegister);
    return repo.save(repo.create(data));
  }

  async getRegister(tenantId: string, patientId: string): Promise<OrthopaedicRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(OrthopaedicRegister).findOne({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async listRegisters(tenantId: string, opts: { status?: string; limit?: number } = {}): Promise<OrthopaedicRegister[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(OrthopaedicRegister)
      .createQueryBuilder('o')
      .orderBy('o.created_at', 'DESC')
      .take(opts.limit ?? 100);
    if (opts.status) qb.andWhere('o.status = :status', { status: opts.status });
    return qb.getMany();
  }

  async updateRegister(tenantId: string, id: string, data: Partial<OrthopaedicRegister>): Promise<OrthopaedicRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OrthopaedicRegister);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Orthopaedic register ${id} not found`);
    await repo.update(id, data as any);
    return repo.findOne({ where: { id } }) as Promise<OrthopaedicRegister>;
  }

  // ── Fractures ─────────────────────────────────────────────────────────────

  async recordFracture(tenantId: string, data: Partial<FractureRecord>): Promise<FractureRecord & { triage: any }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(FractureRecord);
    const saved = await repo.save(repo.create(data));
    const triage = fractureUrgency(data);

    // CDSS risk assessment for complex fractures
    const cdss = await this.cdssService.riskAssessment({
      patientId: data.patientId,
      diagnoses: [`fracture ${data.fractureSite ?? ''}`.trim(), data.isOpen ? 'open fracture' : 'closed fracture'],
      vitals: {},
      context: 'orthopaedic_fracture',
      specialty: 'orthopaedics',
      module: 'trauma_care',
    }, null as any, undefined).catch((e) => {
      this.logger.warn(`CDSS fracture risk failed: ${e?.message}`);
      return null;
    });

    return { ...saved, triage: { ...triage, cdss: cdss ?? { cdssUnavailable: true } } };
  }

  async getFractures(tenantId: string, patientId: string): Promise<FractureRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(FractureRecord).find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async updateFracture(tenantId: string, id: string, data: Partial<FractureRecord>): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.getRepository(FractureRecord).update(id, data as any);
  }

  // ── Joint Replacement ────────────────────────────────────────────────────

  async recordJointReplacement(tenantId: string, data: Partial<JointReplacementRecord>): Promise<JointReplacementRecord> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(JointReplacementRecord);
    return repo.save(repo.create(data));
  }

  async getJointReplacements(tenantId: string, patientId: string): Promise<JointReplacementRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(JointReplacementRecord).find({ where: { patientId }, order: { operationDate: 'DESC' } });
  }

  async updateJointReplacement(tenantId: string, id: string, data: Partial<JointReplacementRecord>): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.getRepository(JointReplacementRecord).update(id, data as any);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async getRehabPlan(tenantId: string, payload: Record<string, any>): Promise<any> {
    const local = buildRehabPlan(payload);
    const cdss = await this.cdssService.getGuidelines('orthopaedics', {
      specialty: 'orthopaedics',
      module: 'rehabilitation',
      ...payload,
    }).catch(() => null);
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }

  async dvtRisk(payload: Record<string, any>): Promise<any> {
    // Wells DVT score calculation
    const wells = calculateWellsDvt(payload);
    const cdss = await this.cdssService.riskAssessment({
      patientId: payload.patientId,
      diagnoses: ['post-operative', 'DVT risk assessment'],
      vitals: {},
      context: 'dvt_prophylaxis',
      specialty: 'orthopaedics',
      module: 'vte_prevention',
    }, null as any, undefined).catch(() => null);
    return { ...wells, cdss: cdss ?? { cdssUnavailable: true } };
  }
}

function buildRehabPlan(p: Record<string, any>): Record<string, any> {
  const procedure = String(p.procedure ?? p.fractureType ?? '').toLowerCase();
  if (procedure.includes('tha') || procedure.includes('hip replacement')) {
    return {
      phase1: 'Day 0–2: bed exercises, ankle pumps, gentle hip ROM within precautions',
      phase2: 'Day 3–14: mobilise with frame, NWB or TTWB, hip precautions',
      phase3: 'Week 3–6: progress to walking aids, hydrotherapy if available',
      phase4: 'Week 7–12: full weight-bearing, stair training, return to function',
      precautions: 'No hip flexion >90°, no adduction past midline, no internal rotation',
      outcomeTool: 'Oxford Hip Score (OHS)',
    };
  }
  if (procedure.includes('tka') || procedure.includes('knee replacement')) {
    return {
      phase1: 'Day 0–2: quad sets, SLR, ankle pumps, CPM if available',
      phase2: 'Day 3–7: mobilise with frame, TTWB, ROM target 0–90° flexion',
      phase3: 'Week 2–6: walking stick, cycling, progress ROM to >110°',
      phase4: 'Week 7–12: full weight-bearing, stairs, functional activities',
      outcomeTool: 'Oxford Knee Score (OKS)',
    };
  }
  return {
    phase1: 'Acute: pain control, swelling reduction, protect the injury',
    phase2: 'Sub-acute: restore ROM, early weight-bearing as tolerated',
    phase3: 'Strengthening: progressive resistance exercises',
    phase4: 'Return to function: functional tasks, sport-specific if needed',
    outcomeTool: 'DASH score for upper limb; LEFS for lower limb',
  };
}

function calculateWellsDvt(p: Record<string, any>): Record<string, any> {
  let score = 0;
  const factors: string[] = [];
  if (p.activeCancer) { score += 1; factors.push('Active cancer (+1)'); }
  if (p.paralysisParesisPlasterCast) { score += 1; factors.push('Paralysis/paresis/plaster cast (+1)'); }
  if (p.bedRiddenOver3Days || p.surgeryLast12Weeks) { score += 1; factors.push('Bedridden >3 days or surgery last 12 weeks (+1)'); }
  if (p.localTendernessAlongDvt) { score += 1; factors.push('Localised tenderness along deep venous system (+1)'); }
  if (p.entireLegSwollen) { score += 1; factors.push('Entire leg swollen (+1)'); }
  if (p.calfSwellingOver3cm) { score += 1; factors.push('Calf swelling >3 cm cf. asymptomatic side (+1)'); }
  if (p.pittingOedemaSymptomaticLeg) { score += 1; factors.push('Pitting oedema (+1)'); }
  if (p.collateralSuperficialVeins) { score += 1; factors.push('Collateral superficial veins (+1)'); }
  if (p.alternativeDiagnosisLikely) { score -= 2; factors.push('Alternative diagnosis at least as likely (−2)'); }

  let risk: string, recommendation: string;
  if (score >= 3) {
    risk = 'high';
    recommendation = 'High probability DVT — proceed directly to proximal compression ultrasound; start anticoagulation if ultrasound unavailable';
  } else if (score === 1 || score === 2) {
    risk = 'moderate';
    recommendation = 'Moderate probability — D-dimer; if positive proceed to ultrasound';
  } else {
    risk = 'low';
    recommendation = 'Low probability — D-dimer; if negative DVT excluded';
  }
  return { wellsScore: score, risk, recommendation, factors };
}
