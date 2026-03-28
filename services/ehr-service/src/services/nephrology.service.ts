import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { CkdAssessment } from '../entities/ckd-assessment.entity';
import { DialysisRecord } from '../entities/dialysis-record.entity';
import { FluidBalanceRecord } from '../entities/fluid-balance-record.entity';
import { RenalBiopsy } from '../entities/renal-biopsy.entity';
import { TransplantRecord } from '../entities/transplant-record.entity';

@Injectable()
export class NephrologyService {
  private readonly logger = new Logger(NephrologyService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── CKD ────────────────────────────────────────────────────────────────────

  async addCkdAssessment(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CkdAssessment);
    return repo.save(repo.create(dto));
  }

  async getCkdAssessments(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(CkdAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Dialysis ───────────────────────────────────────────────────────────────

  async addDialysisRecord(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(DialysisRecord);
    return repo.save(repo.create(dto));
  }

  async getDialysisRecords(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(DialysisRecord).find({
      where: { patientId },
      order: { sessionDate: 'DESC' },
      take: 50,
    });
  }

  async updateDialysisRecord(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(DialysisRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Fluid Balance ──────────────────────────────────────────────────────────

  async addFluidBalance(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(FluidBalanceRecord);
    return repo.save(repo.create(dto));
  }

  async getFluidBalance(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FluidBalanceRecord).find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: 96,
    });
  }

  // ── Renal Biopsy ───────────────────────────────────────────────────────────

  async addBiopsy(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(RenalBiopsy);
    return repo.save(repo.create(dto));
  }

  async getBiopsies(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(RenalBiopsy).find({
      where: { patientId },
      order: { biopsyDate: 'DESC' },
    });
  }

  // ── Transplant ─────────────────────────────────────────────────────────────

  async addTransplantRecord(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(TransplantRecord);
    return repo.save(repo.create(dto));
  }

  async getTransplantRecords(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(TransplantRecord).find({
      where: { patientId },
      order: { transplantDate: 'DESC' },
    });
  }

  async updateTransplantRecord(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(TransplantRecord);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async stageCkd(body: any) {
    try {
      return await this.cdssService.riskAssessment({
        ...body,
        context: 'ckd_staging',
        specialty: 'nephrology',
        module: 'chronic_kidney_disease',
      });
    } catch (err: any) {
      this.logger.warn(`[Nephrology] CDSS CKD staging unavailable: ${err?.message}`);
      return this.localCkdStaging(body);
    }
  }

  async assessDialysisAdequacy(body: any) {
    try {
      return await this.cdssService.getGuidelines('dialysis adequacy Kt/V', {
        ...body,
        specialty: 'nephrology',
        module: 'renal_replacement_therapy',
      });
    } catch (err: any) {
      this.logger.warn(`[Nephrology] CDSS dialysis adequacy unavailable: ${err?.message}`);
      return this.localDialysisAdequacy(body);
    }
  }

  async renalDrugDosing(body: any) {
    try {
      return await this.cdssService.getDosingRecommendation(body);
    } catch (err: any) {
      this.logger.warn(`[Nephrology] CDSS renal drug dosing unavailable: ${err?.message}`);
      return this.localRenalDosing(body);
    }
  }

  /** KDIGO 2022 CKD staging by eGFR + albuminuria. */
  private localCkdStaging(body: any): Record<string, any> {
    const egfr = Number(body.egfr ?? body.eGFR ?? body.gfr ?? NaN);
    const acr  = Number(body.acr ?? body.albumin_creatinine_ratio ?? NaN); // mg/g

    let gStage = 'unknown';
    if (!isNaN(egfr)) {
      if (egfr >= 90)      gStage = 'G1';
      else if (egfr >= 60) gStage = 'G2';
      else if (egfr >= 45) gStage = 'G3a';
      else if (egfr >= 30) gStage = 'G3b';
      else if (egfr >= 15) gStage = 'G4';
      else                 gStage = 'G5';
    }

    let aStage = 'unknown';
    if (!isNaN(acr)) {
      if (acr < 30)        aStage = 'A1';
      else if (acr < 300)  aStage = 'A2';
      else                 aStage = 'A3';
    }

    const highRisk = ['G3b', 'G4', 'G5'].includes(gStage) || aStage === 'A3';
    return {
      source: 'local_fallback',
      gfr_stage: gStage,
      albuminuria_stage: aStage,
      egfr,
      acr,
      high_risk: highRisk,
      recommendation: gStage === 'G5'
        ? 'Prepare for renal replacement therapy (dialysis or transplant)'
        : highRisk
          ? 'Refer to nephrology; optimise BP (<130/80), RAAS blockade, dietary protein restriction'
          : 'Monitor eGFR and ACR every 3–12 months; control blood pressure and blood glucose',
      guideline: 'KDIGO CKD Guidelines 2022',
    };
  }

  /** Kt/V adequacy assessment — HD target ≥1.2, PD ≥1.7. */
  private localDialysisAdequacy(body: any): Record<string, any> {
    const ktv = Number(body.ktv ?? body.kt_v ?? NaN);
    const modality = String(body.modality || body.dialysis_modality || 'hd').toLowerCase();
    const target = modality.includes('pd') ? 1.7 : 1.2;
    const adequate = !isNaN(ktv) && ktv >= target;
    return {
      source: 'local_fallback',
      ktv,
      modality,
      target_ktv: target,
      adequate,
      recommendation: adequate
        ? 'Dialysis dose is adequate. Continue current prescription.'
        : `Kt/V ${isNaN(ktv) ? 'not provided' : ktv.toFixed(2)} is below target of ${target}. Increase session time, blood flow rate, or dialyser surface area.`,
      guideline: 'KDOQI Clinical Practice Guidelines for Hemodialysis Adequacy 2015',
    };
  }

  /** eGFR-based drug dosing adjustment flag. */
  private localRenalDosing(body: any): Record<string, any> {
    const egfr = Number(body.egfr ?? body.eGFR ?? NaN);
    const drug = String(body.drug ?? body.medication ?? '').toLowerCase();
    const flags: string[] = [];

    if (!isNaN(egfr)) {
      if (egfr < 10)       flags.push('Avoid most renally cleared drugs or use dialysis dosing');
      else if (egfr < 30)  flags.push('Significant dose reduction required for most renally cleared drugs');
      else if (egfr < 60)  flags.push('Moderate dose reduction; review individual drug guidance');
    }

    const avoidBelow30 = ['metformin', 'spironolactone', 'nsaids', 'ibuprofen', 'naproxen', 'tenofovir'];
    const avoidBelow45 = ['nitrofurantoin', 'digoxin'];
    if (drug && egfr < 30 && avoidBelow30.some(d => drug.includes(d))) flags.push(`${drug} should be avoided at eGFR <30`);
    if (drug && egfr < 45 && avoidBelow45.some(d => drug.includes(d))) flags.push(`${drug} should be avoided at eGFR <45`);

    return {
      source: 'local_fallback',
      egfr,
      drug,
      flags,
      recommendation: flags.length ? flags.join('; ') : 'No specific renal dosing adjustment required at this eGFR',
      guideline: 'BNF / Renal Drug Handbook 4th Edition',
    };
  }
}
