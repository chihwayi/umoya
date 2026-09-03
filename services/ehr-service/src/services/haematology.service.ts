import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { HaematologyRegister } from '../entities/haematology-register.entity';

@Injectable()
export class HaematologyService {
  private readonly logger = new Logger(HaematologyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async enroll(tenantId: string, data: Partial<HaematologyRegister>): Promise<HaematologyRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(HaematologyRegister);
    return repo.save(repo.create(data));
  }

  async getRegister(tenantId: string, patientId: string): Promise<HaematologyRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(HaematologyRegister).findOne({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async listRegisters(tenantId: string, opts: { category?: string; limit?: number } = {}): Promise<HaematologyRegister[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(HaematologyRegister).createQueryBuilder('h')
      .orderBy('h.created_at', 'DESC').take(opts.limit ?? 100);
    if (opts.category) qb.andWhere('h.diagnosis_category = :c', { c: opts.category });
    return qb.getMany();
  }

  async updateRegister(tenantId: string, id: string, data: Partial<HaematologyRegister>): Promise<HaematologyRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(HaematologyRegister);
    if (!(await repo.findOne({ where: { id } }))) throw new NotFoundException(`Haematology register ${id} not found`);
    await repo.update(id, data as any);
    return repo.findOne({ where: { id } }) as Promise<HaematologyRegister>;
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async anaemiaWorkup(payload: Record<string, any>): Promise<any> {
    const local = anaemiaClassify(payload);
    const cdss = await this.cdssService.diagnosisAssist({
      chiefComplaint: 'anaemia workup',
      symptoms: payload.symptoms ?? [],
      age: payload.age,
      gender: payload.gender,
      vitals: payload.vitals,
      context: 'haematology_anaemia',
      specialty: 'haematology',
      module: 'anaemia_management',
    }, false).catch((e: any) => {
      this.logger.warn(`CDSS anaemia diagnosis assistance fetch failed: ${e?.message}`);
      return null;
    });
    return { ...local, cdss: cdss ?? { cdssUnavailable: true } };
  }

  async transfusionTrigger(payload: Record<string, any>): Promise<any> {
    const local = transfusionThreshold(payload);
    const cdss = await this.cdssService.getGuidelines('haematology', {
      specialty: 'haematology',
      module: 'transfusion_trigger',
      ...payload,
    }).catch((e: any) => {
      this.logger.warn(`CDSS transfusion trigger guideline fetch failed: ${e?.message}`);
      return null;
    });
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }

  async lymphomaStaging(payload: Record<string, any>): Promise<any> {
    const local = annArborStaging(payload);
    const cdss = await this.cdssService.getGuidelines('haematology', {
      specialty: 'haematology',
      module: 'lymphoma_staging',
      ...payload,
    }).catch((e: any) => {
      this.logger.warn(`CDSS lymphoma staging guideline fetch failed: ${e?.message}`);
      return null;
    });
    return { ...local, cdssGuidelines: cdss ?? { cdssUnavailable: true } };
  }
}

function anaemiaClassify(p: Record<string, any>): Record<string, any> {
  const hb = Number(p.hbGDl ?? p.haemoglobin ?? 0);
  const mcv = Number(p.mcvFl ?? 0);
  const reticulocytes = Number(p.reticulocytesPct ?? 0);
  const ferritin = Number(p.ferritinUgL ?? 0);
  const b12 = Number(p.b12PmolL ?? 0);
  const folate = Number(p.folateMmolL ?? 0);

  const severity = hb >= 10 ? 'mild' : hb >= 8 ? 'moderate' : 'severe';

  let morphology: string;
  let probableCause: string;
  let workup: string[];

  if (mcv < 80) {
    morphology = 'microcytic';
    if (ferritin > 0 && ferritin < 30) {
      probableCause = 'iron_deficiency_anaemia';
      workup = ['Serum iron', 'TIBC', 'Reticulocyte count', 'Stool for occult blood', 'Investigate bleeding source'];
    } else {
      probableCause = 'thalassaemia_or_anaemia_of_chronic_disease';
      workup = ['Haemoglobin electrophoresis', 'Serum ferritin/iron studies', 'CRP/ESR'];
    }
  } else if (mcv > 100) {
    morphology = 'macrocytic';
    if (b12 > 0 && b12 < 148) {
      probableCause = 'b12_deficiency';
      workup = ['Schillings test / IF antibodies', 'Folate', 'Bone marrow if needed'];
    } else if (folate > 0 && folate < 10) {
      probableCause = 'folate_deficiency';
      workup = ['B12 level', 'Diet history', 'Malabsorption screen'];
    } else {
      probableCause = 'haemolysis_liver_disease_hypothyroid_or_drugs';
      workup = ['LFTs', 'TFTs', 'Reticulocyte count', 'DAT', 'Drug history'];
    }
  } else {
    morphology = 'normocytic';
    if (reticulocytes > 2) {
      probableCause = 'haemolytic_or_post_haemorrhage';
      workup = ['Blood film', 'DAT', 'LDH', 'Haptoglobin', 'Bilirubin', 'G6PD screen'];
    } else {
      probableCause = 'anaemia_of_chronic_disease_or_bone_marrow_failure';
      workup = ['CRP', 'ESR', 'Renal function', 'Bone marrow biopsy if unexplained'];
    }
  }

  return { hb, severity, morphology, probableCause, workup };
}

function transfusionThreshold(p: Record<string, any>): Record<string, any> {
  const hb = Number(p.hbGDl ?? 0);
  const symptomatic = p.symptomatic === true || p.symptomatic === 'true';
  const cardiacDisease = p.cardiacDisease === true;
  const acute = p.acuteBleed === true;

  if (acute) return {
    trigger: 'clinical_judgement',
    recommendation: 'Acute haemorrhage — trigger transfusion on haemodynamic instability, not just Hb. Target Hb ≥8 g/dL in active bleeding. Massive transfusion protocol if >4 units/4h.',
  };
  if (cardiacDisease) return {
    trigger: hb < 8 ? 'transfuse' : 'hold',
    recommendation: `Cardiac disease — transfuse if Hb <8 g/dL (current: ${hb}). Transfuse 1 unit, recheck, target 8–10 g/dL.`,
  };
  if (symptomatic && hb < 8) return {
    trigger: 'transfuse',
    recommendation: `Symptomatic anaemia with Hb <8 g/dL (current: ${hb}) — transfuse to relieve symptoms; 1 unit, reassess.`,
  };
  if (hb < 7) return {
    trigger: 'transfuse',
    recommendation: `Hb <7 g/dL (current: ${hb}) — transfuse; 1–2 units packed red cells; check post-transfusion Hb.`,
  };
  return {
    trigger: 'hold',
    recommendation: `Hb ${hb} g/dL — no transfusion trigger met (restrictive strategy). Identify and treat underlying cause.`,
  };
}

function annArborStaging(p: Record<string, any>): Record<string, any> {
  const stage = Number(p.stageNumber ?? 0);
  const b = p.bSymptoms === true; // fever, night sweats, weight loss
  const e = p.extranodal === true;
  const x = p.bulky === true; // >10 cm
  const stageName = `${stage}${b ? 'B' : 'A'}${e ? 'E' : ''}${x ? 'X' : ''}`;
  let prognosis: string, recommendation: string;
  if (stage <= 2 && !b && !x) {
    prognosis = 'Favourable limited stage';
    recommendation = 'Abbreviated CHOP-R × 3–4 cycles + involved-site RT; or CHOP-R × 6 cycles';
  } else if (stage <= 2) {
    prognosis = 'Unfavourable limited stage';
    recommendation = 'CHOP-R × 6 cycles + RT; or clinical trial';
  } else {
    prognosis = 'Advanced stage';
    recommendation = 'CHOP-R × 6–8 cycles; PET-CT response assessment mid-treatment; consider consolidation for high-risk';
  }
  return { annArborStage: stageName, stage, bSymptoms: b, prognosis, recommendation };
}
