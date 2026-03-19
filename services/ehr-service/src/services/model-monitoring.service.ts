import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { ModelPerformanceMetric } from '../entities/model-performance-metric.entity';
import { ModelFairnessReport } from '../entities/model-fairness-report.entity';
import axios from 'axios';

@Injectable()
export class ModelMonitoringService {
  private readonly logger = new Logger(ModelMonitoringService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // AUC baselines — populated on first compute, used to detect drift
  private baselines: Record<string, number> = {};

  constructor(private readonly tenantService: TenantService) {}

  // ── Manual / on-demand evaluation ─────────────────────────────────────────

  async evaluateModel(subdomain: string, modelName: string, period?: string): Promise<ModelPerformanceMetric> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const evalPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

    const outcomes = await this.fetchOutcomes(ds, modelName, evalPeriod);
    let metrics: any = { auc_roc: null, brier_score: null, sensitivity: null, specificity: null, ppv: null, calibration: [] };

    try {
      const { data } = await axios.post(`${this.cdssUrl}/model/performance`, {
        modelName, period: evalPeriod, outcomes,
      });
      metrics = data;
    } catch (e: any) {
      this.logger.warn(`Model performance API unavailable, computing locally: ${e?.message}`);
      metrics = this.computeLocalMetrics(outcomes);
    }

    const baselineKey = `${subdomain}:${modelName}`;
    const driftDetected = this.baselines[baselineKey]
      ? metrics.auc_roc !== null && (this.baselines[baselineKey] - metrics.auc_roc) > 0.05
      : false;

    if (!this.baselines[baselineKey] && metrics.auc_roc) {
      this.baselines[baselineKey] = metrics.auc_roc;
    }

    const repo = ds.getRepository(ModelPerformanceMetric);
    const saved = await repo.save(repo.create({
      modelName,
      evaluationPeriod: evalPeriod,
      sampleCount: outcomes.length,
      aucRoc: metrics.auc_roc,
      brierScore: metrics.brier_score,
      sensitivity: metrics.sensitivity,
      specificity: metrics.specificity,
      ppv: metrics.ppv,
      calibrationData: metrics.calibration || [],
      driftDetected,
      baselineAuc: this.baselines[baselineKey] || null,
    }));

    if (driftDetected) {
      this.logger.warn(`Model drift detected for ${modelName} in ${subdomain}: AUC dropped from ${this.baselines[baselineKey].toFixed(3)} to ${metrics.auc_roc?.toFixed(3)}`);
    }

    // Compute fairness
    await this.computeFairness(subdomain, ds, modelName, evalPeriod, outcomes).catch(() => {});

    return saved;
  }

  async getMetrics(subdomain: string, modelName: string): Promise<ModelPerformanceMetric[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: any = modelName ? { modelName } : {};
    return ds.getRepository(ModelPerformanceMetric).find({
      where, order: { computedAt: 'DESC' }, take: 24,
    });
  }

  async getFairnessReports(subdomain: string, modelName: string): Promise<ModelFairnessReport[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelFairnessReport).find({
      where: { modelName }, order: { computedAt: 'DESC' }, take: 24,
    });
  }

  // ── Monthly cron ───────────────────────────────────────────────────────────

  @Cron('0 1 1 * *') // 1st of each month at 01:00
  async monthlyModelEvaluation() {
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const period = prevMonth.toISOString().slice(0, 7);
    this.logger.log(`Running monthly model evaluation for ${period}…`);

    const models = ['deterioration', 'readmission', 'sepsis', 'no_show'];
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const subdomain of tenants) {
        for (const model of models) {
          await this.evaluateModel(subdomain, model, period).catch(e =>
            this.logger.error(`Model eval failed ${model}@${subdomain}: ${e?.message}`));
        }
      }
    } catch (e: any) {
      this.logger.error(`Monthly model evaluation error: ${e?.message}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async fetchOutcomes(ds: any, modelName: string, period: string): Promise<Array<{
    predicted: number; actual: number; age?: number; gender?: string;
  }>> {
    const yearMonth = period + '-01';
    try {
      if (modelName === 'deterioration') {
        return await ds.query(`
          SELECT dp.deterioration_score / 100.0 AS predicted,
                 CASE WHEN a.icu_transfer_at IS NOT NULL THEN 1 ELSE 0 END AS actual,
                 EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
                 p.gender
          FROM deterioration_predictions dp
          JOIN patients p ON p.id = dp.patient_id
          LEFT JOIN admissions a ON a.id = dp.admission_id
          WHERE DATE_TRUNC('month', dp.prediction_time) = DATE_TRUNC('month', $1::date)
          LIMIT 5000
        `, [yearMonth]).catch(() => []);
      }
      if (modelName === 'readmission') {
        return await ds.query(`
          SELECT rp.readmission_30day_risk AS predicted,
                 CASE WHEN EXISTS(
                   SELECT 1 FROM admissions a2
                   WHERE a2.patient_id = rp.patient_id
                   AND a2.admission_date > rp.prediction_date
                   AND a2.admission_date <= rp.prediction_date + INTERVAL '30 days'
                 ) THEN 1 ELSE 0 END AS actual,
                 EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
                 p.gender
          FROM readmission_predictions rp
          JOIN patients p ON p.id = rp.patient_id
          WHERE DATE_TRUNC('month', rp.prediction_date::date) = DATE_TRUNC('month', $1::date)
          LIMIT 5000
        `, [yearMonth]).catch(() => []);
      }
    } catch (e) {}
    return [];
  }

  private computeLocalMetrics(outcomes: Array<{ predicted: number; actual: number }>): any {
    if (!outcomes.length) return { auc_roc: null, brier_score: null };
    const brierScore = outcomes.reduce((sum, o) => sum + Math.pow(o.predicted - o.actual, 2), 0) / outcomes.length;
    // Simple AUC approximation via Wilcoxon-Mann-Whitney
    const pos = outcomes.filter(o => o.actual === 1);
    const neg = outcomes.filter(o => o.actual === 0);
    if (!pos.length || !neg.length) return { auc_roc: null, brier_score };
    let wins = 0;
    for (const p of pos) for (const n of neg) { if (p.predicted > n.predicted) wins++; }
    const auc_roc = wins / (pos.length * neg.length);
    return { auc_roc, brier_score: brierScore };
  }

  private async computeFairness(subdomain: string, ds: any, modelName: string, period: string, outcomes: any[]): Promise<void> {
    if (outcomes.length < 50) return;
    const repo = ds.getRepository(ModelFairnessReport);

    for (const dimension of ['gender', 'age_group'] as const) {
      const groups: Record<string, typeof outcomes> = {};
      for (const o of outcomes) {
        const key = dimension === 'age_group'
          ? (o.age < 18 ? 'pediatric' : o.age < 65 ? 'adult' : 'elderly')
          : (o.gender || 'unknown');
        if (!groups[key]) groups[key] = [];
        groups[key].push(o);
      }

      const groupMetrics: Record<string, any> = {};
      let aucs: number[] = [];
      for (const [group, data] of Object.entries(groups)) {
        const m = this.computeLocalMetrics(data);
        groupMetrics[group] = { auc: m.auc_roc, n: data.length };
        if (m.auc_roc !== null) aucs.push(m.auc_roc);
      }

      const maxDisparity = aucs.length > 1 ? Math.max(...aucs) - Math.min(...aucs) : 0;

      await repo.save(repo.create({
        modelName,
        evaluationPeriod: period,
        dimension,
        groupMetrics,
        maxDisparity,
        fairnessFlag: maxDisparity > 0.05,
      }));
    }
  }
}
