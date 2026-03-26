import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { DeteriorationPrediction } from '../entities/deterioration-prediction.entity';
import { ReadmissionPrediction } from '../entities/readmission-prediction.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class PredictiveRiskService {
  private readonly logger = new Logger(PredictiveRiskService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Deterioration ─────────────────────────────────────────────────────────

  async predictDeterioration(subdomain: string, patientId: string, admissionId?: string, vitals?: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    let predData: any = { score: 0, event_type: null, timeframe_hours: null, features: {}, model: 'MEWS' };
    try {
      predData = await this.cdssService.predictDeteriorationRisk(
        { patientId, admissionId, vitals },
        subdomain,
        ds,
      );
    } catch (e: any) {
      this.logger.warn(`Deterioration prediction failed: ${e?.message}`);
    }

    const repo = ds.getRepository(DeteriorationPrediction);
    const saved = await repo.save(repo.create({
      patientId, admissionId,
      predictionTime: new Date(),
      deteriorationScore: predData.score,
      predictedEventType: predData.event_type,
      predictedTimeframeHours: predData.timeframe_hours,
      featureContributions: predData.features || {},
      triggeredAlert: predData.score >= 70,
    }));
    return saved;
  }

  async getDeteriorationHistory(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(DeteriorationPrediction).find({
      where: { patientId },
      order: { predictionTime: 'DESC' },
    });
  }

  // ── Readmission ───────────────────────────────────────────────────────────

  async predictReadmission(subdomain: string, patientId: string, dischargeId?: string, clinicalData?: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    let predData: any = { risk: 0.1, category: 'low', factors: [], followup_days: 30, model: 'LACE+' };
    try {
      predData = await this.cdssService.predictReadmissionRisk(
        { patientId, dischargeId, clinicalData },
        subdomain,
        ds,
      );
    } catch (e: any) {
      this.logger.warn(`Readmission prediction failed: ${e?.message}`);
    }

    const repo = ds.getRepository(ReadmissionPrediction);
    const saved = await repo.save(repo.create({
      patientId, dischargeId,
      predictionDate: new Date().toISOString().split('T')[0],
      readmission30DayRisk: predData.risk,
      riskCategory: predData.category,
      keyRiskFactors: predData.factors || [],
      recommendedFollowupInterval: predData.followup_days,
      predictionModel: predData.model,
    }));

    // Update discharge record
    if (dischargeId) {
      await ds.query(
        `UPDATE discharges SET readmission_risk_score=$1, readmission_risk_category=$2, ai_followup_recommendation=$3 WHERE id=$4`,
        [predData.risk, predData.category, `Follow up in ${predData.followup_days} days`, dischargeId]
      ).catch(() => {});
    }
    return saved;
  }

  async getReadmissionRisk(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ReadmissionPrediction).find({
      where: { patientId },
      order: { predictionDate: 'DESC' },
    });
  }

  // ── 4-hour cron for active admissions ─────────────────────────────────────

  @Cron('0 */4 * * *')
  async runDeteriorationSweep() {
    this.logger.log('Running 4-hourly deterioration prediction sweep…');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const tenant of tenants) {
        const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
        if (!subdomain) {
          continue;
        }
        await this.sweepActiveAdmissions(subdomain).catch(e =>
          this.logger.error(`Deterioration sweep failed for ${subdomain}: ${e?.message}`));
      }
    } catch (e: any) { this.logger.error(`Deterioration sweep error: ${e?.message}`); }
  }

  private async sweepActiveAdmissions(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const active = await ds.query(
      `SELECT id, patient_id FROM admissions WHERE discharge_date IS NULL LIMIT 100`
    ).catch(() => []);
    for (const adm of active) {
      await this.predictDeterioration(subdomain, adm.patient_id, adm.id).catch(() => {});
    }
  }
}
