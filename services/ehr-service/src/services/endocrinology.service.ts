import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { EndocrineRegister } from '../entities/endocrine-register.entity';

@Injectable()
export class EndocrinologyService {
  private readonly logger = new Logger(EndocrinologyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async enroll(tenantId: string, data: Partial<EndocrineRegister>): Promise<EndocrineRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EndocrineRegister);
    return repo.save(repo.create(data));
  }

  async getRegister(tenantId: string, patientId: string): Promise<EndocrineRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(EndocrineRegister).findOne({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async listRegisters(tenantId: string, opts: { system?: string; limit?: number } = {}): Promise<EndocrineRegister[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(EndocrineRegister).createQueryBuilder('e')
      .orderBy('e.created_at', 'DESC').take(opts.limit ?? 100);
    if (opts.system) qb.andWhere('e.endocrine_system = :s', { s: opts.system });
    return qb.getMany();
  }

  async updateRegister(tenantId: string, id: string, data: Partial<EndocrineRegister>): Promise<EndocrineRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EndocrineRegister);
    if (!(await repo.findOne({ where: { id } }))) throw new NotFoundException(`Endocrine register ${id} not found`);
    await repo.update(id, data as any);
    return repo.findOne({ where: { id } }) as Promise<EndocrineRegister>;
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async thyroidManagement(payload: Record<string, any>): Promise<any> {
    const local = thyroidAlgorithm(payload);
    const cdss = await this.cdssService.getGuidelines('endocrinology', {
      specialty: 'endocrinology',
      module: 'thyroid_management',
      ...payload,
    }).catch(() => null);
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }

  async adrenalCrisisProtocol(payload: Record<string, any>): Promise<any> {
    const local = adrenalCrisisManagement(payload);
    const cdss = await this.cdssService.riskAssessment({
      patientId: payload.patientId,
      diagnoses: ['adrenal crisis', 'adrenal insufficiency'],
      vitals: payload.vitals ?? {},
      context: 'endocrine_adrenal_crisis',
      specialty: 'endocrinology',
      module: 'adrenal_crisis',
    }, null as any, undefined).catch(() => null);
    return { ...local, cdss: cdss ?? { cdssUnavailable: true } };
  }

  async levothyroxineDose(payload: Record<string, any>): Promise<any> {
    const local = calcLevothyroxine(payload);
    const cdss = await this.cdssService.diagnosisAssist({
      chiefComplaint: 'hypothyroidism dosing',
      symptoms: payload.symptoms ?? [],
      age: payload.age,
      context: 'endocrine_levothyroxine',
      specialty: 'endocrinology',
      module: 'thyroid_hormone_replacement',
    }, false).catch(() => null);
    return { ...local, cdss: cdss ?? { cdssUnavailable: true } };
  }
}

function thyroidAlgorithm(p: Record<string, any>): Record<string, any> {
  const tsh = Number(p.tshMiuL ?? 0);
  const ft4 = Number(p.ft4PmolL ?? 0);
  const symptoms = String(p.symptoms ?? '').toLowerCase();

  if (tsh > 10 || (tsh > 4.5 && symptoms.includes('symptom'))) return {
    classification: 'overt_hypothyroidism',
    recommendation: 'Overt hypothyroidism — initiate levothyroxine 1.6 µg/kg/day; lower dose in elderly/cardiac disease. Recheck TFTs in 6–8 weeks. Target TSH 0.5–2.5 mIU/L.',
    urgency: 'treat_now',
  };
  if (tsh > 4.5 && tsh <= 10) return {
    classification: 'subclinical_hypothyroidism',
    recommendation: 'Subclinical hypothyroidism — treat if TSH >10 or symptomatic or pregnant or TPO Ab positive. Otherwise monitor 6-monthly.',
    urgency: 'clinical_judgement',
  };
  if (tsh < 0.1 && ft4 > 22) return {
    classification: 'overt_hyperthyroidism',
    recommendation: 'Overt hyperthyroidism — measure TRAB; if positive → Graves disease: carbimazole (titration or block-and-replace). If negative → toxic nodule: nuclear medicine/surgery. Beta-blocker for symptom control.',
    urgency: 'treat_now',
  };
  if (tsh < 0.4 && tsh >= 0.1) return {
    classification: 'subclinical_hyperthyroidism',
    recommendation: 'Subclinical hyperthyroidism — treat if persistent, age >65, cardiac disease, or osteoporosis. Monitor AF risk. Repeat TFTs in 3 months.',
    urgency: 'monitor',
  };
  return {
    classification: 'euthyroid',
    recommendation: 'TFTs within normal range. If on levothyroxine, current dose appropriate. Annual TFT monitoring.',
    urgency: 'routine',
  };
}

function adrenalCrisisManagement(p: Record<string, any>): Record<string, any> {
  return {
    emergency: true,
    immediate_steps: [
      '1. IV access — draw cortisol, electrolytes, glucose BEFORE treatment if possible (do not delay)',
      '2. Hydrocortisone 100 mg IV/IM STAT — do not wait for results',
      '3. 0.9% NaCl 1 litre over 30–60 min (correct hypotension)',
      '4. 5–10% dextrose if blood glucose <4 mmol/L',
      '5. Monitor hourly: BP, HR, glucose, urine output',
      '6. Hydrocortisone 200 mg/24h continuous infusion OR 50 mg IM every 6h',
      '7. Identify and treat precipitating cause (infection most common in Zimbabwe — consider TB)',
    ],
    monitoring: 'Cortisol + ACTH stimulation test once stable; transition to oral hydrocortisone when eating',
    sickDayRules: 'Sick day rule: double/triple oral dose during intercurrent illness; parenteral if vomiting; medical alert bracelet',
    precipitants: p.precipitant ?? 'Identify: infection (TB, malaria, typhoid), surgery, missed steroids, GI illness',
  };
}

function calcLevothyroxine(p: Record<string, any>): Record<string, any> {
  const weightKg = Number(p.weightKg ?? 70);
  const age = Number(p.age ?? 45);
  const cardiacDisease = p.cardiacDisease === true;
  const pregnant = p.pregnant === true;
  const tsh = Number(p.tshMiuL ?? 10);

  const targetDoseMcg = Math.round(1.6 * weightKg);
  let startDoseMcg: number;
  let titrationNote: string;

  if (cardiacDisease || age > 65) {
    startDoseMcg = 25;
    titrationNote = 'Start 25 µg; increase by 12.5–25 µg every 6–8 weeks; cardiac monitoring';
  } else if (tsh > 50 || p.myxoedema) {
    startDoseMcg = 50;
    titrationNote = 'Start 50 µg (severe hypothyroidism); increase to full replacement over 6–12 weeks';
  } else {
    startDoseMcg = 50;
    titrationNote = 'Start 50 µg; increase by 25–50 µg every 6–8 weeks to target dose';
  }

  return {
    targetDoseMcg,
    startDoseMcg,
    titrationNote,
    targetTsh: pregnant ? '0.1–2.5 mIU/L' : '0.5–2.5 mIU/L',
    monitoringFrequency: 'Every 6–8 weeks during titration; annually once stable',
    administrationAdvice: 'Take 30–60 min before breakfast; away from calcium, iron, PPIs (reduce absorption)',
    pregnancyNote: pregnant ? 'Increase dose by 25–30% immediately on confirmation of pregnancy; monitor TFTs monthly; target TSH <2.5 in first trimester' : null,
  };
}
