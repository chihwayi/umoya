import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { PhysioReferral } from '../entities/physio-referral.entity';
import { PhysioSession } from '../entities/physio-session.entity';

@Injectable()
export class PhysiotherapyService {
  private readonly logger = new Logger(PhysiotherapyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Referrals ─────────────────────────────────────────────────────────────

  async createReferral(tenantId: string, data: Partial<PhysioReferral>): Promise<PhysioReferral> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(PhysioReferral);
    return repo.save(repo.create({ ...data, status: data.status ?? 'pending' }));
  }

  async getReferral(tenantId: string, id: string): Promise<PhysioReferral> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const ref = await db.getRepository(PhysioReferral).findOne({ where: { id } });
    if (!ref) throw new NotFoundException(`Physio referral ${id} not found`);
    return ref;
  }

  async getPatientReferrals(tenantId: string, patientId: string): Promise<PhysioReferral[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(PhysioReferral).find({ where: { patientId }, order: { referralDate: 'DESC' } });
  }

  async listReferrals(tenantId: string, opts: { status?: string; rehabType?: string; limit?: number } = {}): Promise<PhysioReferral[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(PhysioReferral).createQueryBuilder('r')
      .orderBy('r.referral_date', 'DESC').take(opts.limit ?? 100);
    if (opts.status) qb.andWhere('r.status = :s', { s: opts.status });
    if (opts.rehabType) qb.andWhere('r.rehab_type = :t', { t: opts.rehabType });
    return qb.getMany();
  }

  async updateReferral(tenantId: string, id: string, data: Partial<PhysioReferral>): Promise<PhysioReferral> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.getRepository(PhysioReferral).update(id, data as any);
    return this.getReferral(tenantId, id);
  }

  async acceptReferral(tenantId: string, id: string): Promise<PhysioReferral> {
    return this.updateReferral(tenantId, id, { status: 'active', acceptedDate: new Date().toISOString().slice(0, 10) });
  }

  async dischargeReferral(tenantId: string, id: string, notes?: string): Promise<PhysioReferral> {
    return this.updateReferral(tenantId, id, {
      status: 'completed',
      dischargeDate: new Date().toISOString().slice(0, 10),
      notes,
    });
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async recordSession(tenantId: string, referralId: string, data: Partial<PhysioSession>): Promise<PhysioSession> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const referral = await db.getRepository(PhysioReferral).findOne({ where: { id: referralId } });

    const sessionNumber = data.sessionNumber ?? ((referral?.sessionsAttended ?? 0) + 1);
    const repo = db.getRepository(PhysioSession);
    const session = await repo.save(repo.create({ ...data, physioReferralId: referralId, sessionNumber }));

    // Increment sessions attended on referral
    if (referral) {
      await db.getRepository(PhysioReferral).update(referralId, {
        sessionsAttended: (referral.sessionsAttended ?? 0) + 1,
      } as any);
    }

    return session;
  }

  async getSessions(tenantId: string, patientId: string): Promise<PhysioSession[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(PhysioSession).find({ where: { patientId }, order: { sessionDate: 'DESC' } });
  }

  async getSessionsByReferral(tenantId: string, referralId: string): Promise<PhysioSession[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(PhysioSession).find({ where: { physioReferralId: referralId }, order: { sessionNumber: 'ASC' } });
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async strokeRehab(payload: Record<string, any>): Promise<any> {
    const local = strokeRehabPlan(payload);
    const cdss = await this.cdssService.getGuidelines('physiotherapy', {
      specialty: 'rehabilitation',
      module: 'stroke_rehabilitation',
    }).catch(() => null);
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }

  async cardiacRehab(payload: Record<string, any>): Promise<any> {
    const local = cardiacRehabPhases(payload);
    const cdss = await this.cdssService.getGuidelines('physiotherapy', {
      specialty: 'rehabilitation',
      module: 'cardiac_rehabilitation',
    }).catch(() => null);
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }
}

function strokeRehabPlan(p: Record<string, any>): Record<string, any> {
  const barthel = Number(p.barthelIndex ?? 100);
  const daysSinceStroke = Number(p.daysSinceStroke ?? 0);
  return {
    intensity: daysSinceStroke <= 7 ? 'early_mobilisation' : daysSinceStroke <= 90 ? 'active_rehabilitation' : 'maintenance',
    barthelCategory: barthel >= 85 ? 'minimal_disability' : barthel >= 60 ? 'moderate_disability' : 'severe_disability',
    goals: [
      'Sitting balance and transfers',
      'Standing and gait training',
      'Upper limb function and dexterity',
      'ADL retraining (dressing, feeding)',
      'Cognitive and communication therapy as needed',
      'Secondary prevention — exercise prescription',
    ],
    frequency: barthel < 60 ? '5–7 days/week inpatient' : '3–5 sessions/week outpatient or community',
    outcome_tools: ['Barthel Index', 'Modified Rankin Scale (mRS)', 'Berg Balance Scale', 'Fugl-Meyer (upper limb)'],
    referrals: ['Occupational Therapy', 'Speech and Language Therapy (if dysphagia/dysphasia)', 'Psychology if post-stroke depression'],
  };
}

function cardiacRehabPhases(p: Record<string, any>): Record<string, any> {
  const indication = String(p.indication ?? '').toLowerCase();
  const lvef = Number(p.lvefPercent ?? 55);
  return {
    phase1: 'Inpatient (days 1–5): early mobilisation, 50–100 m walking, breathing exercises, education on CHD/HF',
    phase2: 'Early outpatient (weeks 2–6): monitored exercise, aerobic training 60–70% HR max, patient education',
    phase3: 'Supervised exercise programme (weeks 7–12): progressive aerobic + resistance training 3×/week',
    phase4: 'Maintenance (ongoing): independent exercise, community programme, annual review',
    contraindications: ['Uncontrolled arrhythmia', 'Unstable angina', 'Decompensated HF', 'Severe AS'],
    heartFailureNote: lvef < 40
      ? 'Reduced LVEF — start low intensity; supervised aerobic training proven safe and beneficial in HFrEF (NICE/ESC recommendation)'
      : null,
    targetHr: `${Math.round(0.6 * (220 - Number(p.age ?? 60)))}–${Math.round(0.75 * (220 - Number(p.age ?? 60)))} bpm (60–75% age-predicted max HR)`,
  };
}
