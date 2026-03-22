import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { SpirometryResult } from '../entities/spirometry-result.entity';
import { CopdAssessment } from '../entities/copd-assessment.entity';
import { AsthmaRecord } from '../entities/asthma-record.entity';
import { PeakFlowDiary } from '../entities/peak-flow-diary.entity';
import { OxygenTherapyRecord } from '../entities/oxygen-therapy-record.entity';

@Injectable()
export class PulmonologyService {
  private readonly logger = new Logger(PulmonologyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Spirometry ─────────────────────────────────────────────────────────────

  async addSpirometry(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SpirometryResult);
    return repo.save(repo.create(dto));
  }

  async getSpirometryResults(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SpirometryResult).find({
      where: { patientId },
      order: { testDate: 'DESC' },
    });
  }

  // ── COPD ───────────────────────────────────────────────────────────────────

  async addCopdAssessment(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CopdAssessment);
    return repo.save(repo.create(dto));
  }

  async getCopdAssessments(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(CopdAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async updateCopdAssessment(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CopdAssessment);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Asthma ─────────────────────────────────────────────────────────────────

  async addAsthmaRecord(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AsthmaRecord);
    return repo.save(repo.create(dto));
  }

  async getAsthmaRecords(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(AsthmaRecord).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async updateAsthmaRecord(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AsthmaRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Peak Flow ──────────────────────────────────────────────────────────────

  async addPeakFlow(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PeakFlowDiary);
    return repo.save(repo.create(dto));
  }

  async getPeakFlowDiary(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PeakFlowDiary).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 90,
    });
  }

  // ── Oxygen Therapy ─────────────────────────────────────────────────────────

  async addOxygenTherapy(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(OxygenTherapyRecord);
    return repo.save(repo.create(dto));
  }

  async getOxygenTherapy(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(OxygenTherapyRecord).find({
      where: { patientId },
      order: { startDate: 'DESC' },
    });
  }

  async updateOxygenTherapy(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(OxygenTherapyRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async interpretSpirometry(body: any) {
    try {
      return await this.cdssService.interpretLabResults(body);
    } catch (err: any) {
      this.logger.warn(`[Pulmonology] CDSS spirometry unavailable: ${err?.message}`);
      return this.localSpirometryInterpret(body);
    }
  }

  async asthmaStepUp(body: any) {
    try {
      return await this.cdssService.getGuidelines('asthma step-up therapy GINA', body);
    } catch (err: any) {
      this.logger.warn(`[Pulmonology] CDSS asthma step-up unavailable: ${err?.message}`);
      return this.localAsthmaStepUp(body);
    }
  }

  async prescribeOxygen(body: any) {
    try {
      return await this.cdssService.getGuidelines('long-term oxygen therapy LTOT criteria', body);
    } catch (err: any) {
      this.logger.warn(`[Pulmonology] CDSS oxygen prescription unavailable: ${err?.message}`);
      return this.localOxygenPrescription(body);
    }
  }

  /** ATS/ERS 2022 spirometry interpretation. */
  private localSpirometryInterpret(body: any): Record<string, any> {
    const fev1    = Number(body.fev1 ?? NaN);       // L
    const fvc     = Number(body.fvc ?? NaN);         // L
    const fev1fvc = Number(body.fev1_fvc ?? (!isNaN(fev1) && !isNaN(fvc) && fvc > 0 ? fev1 / fvc : NaN));
    const fev1pct = Number(body.fev1_percent_predicted ?? NaN); // % predicted

    let pattern = 'normal';
    let severity = 'none';
    const findings: string[] = [];

    if (!isNaN(fev1fvc)) {
      if (fev1fvc < 0.7) {
        pattern = 'obstructive';
        findings.push(`FEV1/FVC ${(fev1fvc * 100).toFixed(1)}% — obstructive pattern`);
        if (!isNaN(fev1pct)) {
          if (fev1pct >= 80)      { severity = 'mild';     findings.push('Severity: mild (FEV1 ≥80% predicted)'); }
          else if (fev1pct >= 50) { severity = 'moderate'; findings.push('Severity: moderate (FEV1 50–79%)'); }
          else if (fev1pct >= 30) { severity = 'severe';   findings.push('Severity: severe (FEV1 30–49%)'); }
          else                    { severity = 'very_severe'; findings.push('Severity: very severe (FEV1 <30%)'); }
        }
      } else if (!isNaN(fvc) && !isNaN(fev1pct) && fvc < 0.8 && fev1pct < 80) {
        pattern = 'restrictive';
        findings.push('Restrictive pattern: reduced FVC with normal FEV1/FVC ratio');
      }
    }

    return {
      source: 'local_fallback',
      pattern,
      severity,
      fev1, fvc, fev1_fvc: fev1fvc, fev1_percent_predicted: fev1pct,
      findings,
      recommendation: pattern === 'obstructive'
        ? 'Consider bronchodilator reversibility test; COPD/asthma pathway'
        : pattern === 'restrictive'
          ? 'Investigate for ILD, chest wall restriction, or neuromuscular disease; consider HRCT'
          : 'Spirometry within normal limits',
      guideline: 'ATS/ERS Standardisation of Spirometry 2022',
    };
  }

  /** GINA 2023 asthma step-up therapy. */
  private localAsthmaStepUp(body: any): Record<string, any> {
    const currentStep = Number(body.current_step ?? body.gina_step ?? 1);
    const acq = Number(body.acq ?? body.asthma_control_score ?? NaN);
    const steps: Record<number, string> = {
      1: 'Step 1: As-needed low-dose ICS-formoterol (preferred) or SABA',
      2: 'Step 2: Daily low-dose ICS + as-needed SABA or as-needed low-dose ICS-formoterol',
      3: 'Step 3: Low-dose ICS-LABA + as-needed SABA',
      4: 'Step 4: Medium/high-dose ICS-LABA + as-needed SABA; consider LAMA add-on',
      5: 'Step 5: Refer to specialist; consider add-on biologic therapy (anti-IL-5, anti-IL-4/13, anti-IgE)',
    };
    const nextStep = Math.min(currentStep + 1, 5);
    const uncontrolled = !isNaN(acq) ? acq >= 1.5 : body.uncontrolled;
    return {
      source: 'local_fallback',
      current_step: currentStep,
      recommended_step: uncontrolled ? nextStep : currentStep,
      action: uncontrolled ? `Step up to Step ${nextStep}` : 'Asthma controlled — maintain current step; consider step-down if stable ≥3 months',
      regimen: steps[uncontrolled ? nextStep : currentStep],
      guideline: 'GINA Global Strategy for Asthma Management 2023',
    };
  }

  /** LTOT criteria — BTS/NICE 2019. */
  private localOxygenPrescription(body: any): Record<string, any> {
    const spo2  = Number(body.spo2 ?? body.oxygen_saturation ?? NaN);
    const pao2  = Number(body.pao2 ?? NaN);        // mmHg
    const hypercapnia = body.hypercapnia === true;
    const meetsLtot = (!isNaN(spo2) && spo2 <= 88) || (!isNaN(pao2) && pao2 <= 55);
    return {
      source: 'local_fallback',
      spo2, pao2,
      ltot_indicated: meetsLtot,
      flow_rate: meetsLtot ? (hypercapnia ? '1–2 L/min (risk of CO₂ retention — titrate carefully)' : '1–4 L/min; titrate to SpO2 88–92%') : null,
      target_spo2: '88–92% (avoid over-oxygenation in COPD)',
      duration: meetsLtot ? '≥15 h/day (ideally 24 h)' : null,
      recommendation: meetsLtot
        ? 'LTOT indicated. Prescribe home oxygen. Refer for ambulatory O₂ assessment.'
        : `LTOT not indicated (SpO2 ${isNaN(spo2) ? 'not provided' : spo2 + '%'}). Reassess if condition worsens.`,
      guideline: 'BTS Guidelines for Home Oxygen 2015; NICE NG115 2019',
    };
  }
}
