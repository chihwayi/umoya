import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { IcuAdmission } from '../entities/icu-admission.entity';
import { SofaScore } from '../entities/sofa-score.entity';
import { VentilatorSettings } from '../entities/ventilator-settings.entity';
import { SedationRecord } from '../entities/sedation-record.entity';
import { CentralLineRecord } from '../entities/central-line-record.entity';
import { VasopressorRecord } from '../entities/vasopressor-record.entity';

@Injectable()
export class IcuService {
  private readonly logger = new Logger(IcuService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── ICU Admission ──────────────────────────────────────────────────────────

  async addAdmission(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(IcuAdmission);
    return repo.save(repo.create(dto));
  }

  async getAdmissions(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(IcuAdmission).find({
      where: { patientId },
      order: { icuAdmissionDate: 'DESC' },
    });
  }

  async updateAdmission(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(IcuAdmission);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── SOFA Scores ────────────────────────────────────────────────────────────

  async addSofa(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SofaScore);
    return repo.save(repo.create({ ...dto, scoredAt: dto.scoredAt || new Date() }));
  }

  async getSofaScores(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SofaScore).find({
      where: { patientId },
      order: { scoredAt: 'DESC' },
      take: 48,
    });
  }

  // ── Ventilator Settings ────────────────────────────────────────────────────

  async addVentSettings(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(VentilatorSettings);
    return repo.save(repo.create({ ...dto, recordedAt: dto.recordedAt || new Date() }));
  }

  async getVentSettings(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(VentilatorSettings).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 48,
    });
  }

  // ── Sedation Records ───────────────────────────────────────────────────────

  async addSedation(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SedationRecord);
    return repo.save(repo.create({ ...dto, recordedAt: dto.recordedAt || new Date() }));
  }

  async getSedation(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SedationRecord).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 24,
    });
  }

  // ── Central Lines ──────────────────────────────────────────────────────────

  async addLine(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CentralLineRecord);
    return repo.save(repo.create(dto));
  }

  async getLines(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(CentralLineRecord).find({
      where: { patientId },
      order: { insertionDate: 'DESC' },
    });
  }

  async updateLine(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CentralLineRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Vasopressors ───────────────────────────────────────────────────────────

  async addVasopressor(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(VasopressorRecord);
    return repo.save(repo.create(dto));
  }

  async getVasopressors(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(VasopressorRecord).find({
      where: { patientId },
      order: { startTime: 'DESC' },
    });
  }

  async updateVasopressor(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(VasopressorRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async calculateSofa(body: any) {
    try {
      return await this.cdssService.riskAssessment({ ...body, context: 'sofa_score' });
    } catch (err: any) {
      this.logger.warn(`[ICU] CDSS SOFA unavailable: ${err?.message}`);
      return this.localSofaScore(body);
    }
  }

  async ventProtocol(body: any) {
    try {
      return await this.cdssService.getGuidelines('mechanical ventilation lung protective protocol', body);
    } catch (err: any) {
      this.logger.warn(`[ICU] CDSS vent protocol unavailable: ${err?.message}`);
      return this.localVentProtocol(body);
    }
  }

  async assessSedation(body: any) {
    try {
      return await this.cdssService.getGuidelines('ICU sedation analgesia delirium PADIS', body);
    } catch (err: any) {
      this.logger.warn(`[ICU] CDSS sedation assessment unavailable: ${err?.message}`);
      return this.localSedationAssessment(body);
    }
  }

  /** SOFA score local calculation — 6 organ systems, 0–4 each (max 24). */
  private localSofaScore(body: any): Record<string, any> {
    const pao2fio2 = Number(body.pao2_fio2 ?? body.pf_ratio ?? NaN);
    const platelets = Number(body.platelets ?? NaN);
    const bilirubin = Number(body.bilirubin ?? NaN);
    const map = Number(body.mean_arterial_pressure ?? body.map ?? NaN);
    const gcs = Number(body.gcs ?? NaN);
    const creatinine = Number(body.creatinine ?? NaN);

    const resp  = isNaN(pao2fio2) ? 0 : pao2fio2 >= 400 ? 0 : pao2fio2 >= 300 ? 1 : pao2fio2 >= 200 ? 2 : pao2fio2 >= 100 ? 3 : 4;
    const coag  = isNaN(platelets) ? 0 : platelets >= 150 ? 0 : platelets >= 100 ? 1 : platelets >= 50 ? 2 : platelets >= 20 ? 3 : 4;
    const liver = isNaN(bilirubin) ? 0 : bilirubin < 1.2 ? 0 : bilirubin <= 1.9 ? 1 : bilirubin <= 5.9 ? 2 : bilirubin <= 11.9 ? 3 : 4;
    const cardio= isNaN(map) ? 0 : map >= 70 ? 0 : 1; // simplified; vasopressor details not available
    const neuro = isNaN(gcs) ? 0 : gcs === 15 ? 0 : gcs >= 13 ? 1 : gcs >= 10 ? 2 : gcs >= 6 ? 3 : 4;
    const renal = isNaN(creatinine) ? 0 : creatinine < 1.2 ? 0 : creatinine <= 1.9 ? 1 : creatinine <= 3.4 ? 2 : creatinine <= 4.9 ? 3 : 4;

    const total = resp + coag + liver + cardio + neuro + renal;
    const mortality = total >= 11 ? '>50%' : total >= 7 ? '~40%' : total >= 5 ? '~20%' : '<10%';

    return {
      source: 'local_fallback',
      total_sofa: total,
      components: { respiratory: resp, coagulation: coag, liver, cardiovascular: cardio, neurological: neuro, renal },
      estimated_mortality: mortality,
      recommendation: total >= 11 ? 'Very high mortality risk — escalate care goals discussion' : 'Continue organ-supportive care per SOFA trend',
      guideline: 'Vincent JL et al. SOFA Score. Intensive Care Med 1996',
    };
  }

  /** ARDSnet lung-protective ventilation protocol. */
  private localVentProtocol(body: any): Record<string, any> {
    const weightKg = Number(body.ideal_body_weight ?? body.weight_kg ?? NaN);
    const tvTarget = !isNaN(weightKg) ? `${(weightKg * 6).toFixed(0)}–${(weightKg * 8).toFixed(0)} mL` : '6–8 mL/kg IBW';
    return {
      source: 'local_fallback',
      tidal_volume: tvTarget,
      plateau_pressure_target: '≤30 cmH₂O',
      peep_strategy: 'Start PEEP 5–8 cmH₂O; titrate FiO2/PEEP per ARDSnet low-PEEP table',
      fio2_target: 'Titrate to SpO2 88–95%',
      rate: '14–35 breaths/min to maintain pH 7.30–7.45',
      prone_positioning: body.pao2_fio2 < 150 ? 'Consider prone positioning ≥16 h/day for P/F < 150' : 'Prone if P/F deteriorates below 150',
      guideline: 'ARDSnet NEJM 2000; PADIS Guidelines CCM 2018',
    };
  }

  /** PADIS (Pain, Agitation, Delirium, Immobility, Sleep) assessment. */
  private localSedationAssessment(body: any): Record<string, any> {
    const rass = Number(body.rass ?? body.richmond_agitation_sedation_scale ?? NaN);
    const camIcu = body.cam_icu;
    const nrs = Number(body.pain_score ?? NaN);
    const recommendations: string[] = [];

    if (!isNaN(nrs) && nrs >= 4) recommendations.push('Treat pain first (NRS ≥4): IV morphine or fentanyl; reassess in 30 min');
    if (!isNaN(rass)) {
      if (rass > 1)  recommendations.push('Agitated (RASS >+1): Propofol or dexmedetomidine; check for reversible causes');
      if (rass < -2) recommendations.push('Over-sedated (RASS <-2): Reduce/hold sedatives; perform daily sedation interruption (SAT)');
    }
    if (camIcu === true || camIcu === 'positive') recommendations.push('CAM-ICU positive: Treat delirium; minimise benzodiazepines; early mobilisation');
    if (recommendations.length === 0) recommendations.push('RASS within target (-2 to 0); continue analgesia-first approach');

    return {
      source: 'local_fallback',
      rass,
      cam_icu: camIcu,
      pain_score: nrs,
      recommendations,
      guideline: 'PADIS Guidelines, Crit Care Med 2018',
    };
  }
}
