import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { ModelPerformanceMetric } from '../entities/model-performance-metric.entity';
import { ModelFairnessReport } from '../entities/model-fairness-report.entity';
import { AiEvalRun } from '../entities/ai-eval-run.entity';
import { AiReleaseGateResult } from '../entities/ai-release-gate-result.entity';
import { FederatedLearningService } from './federated-learning.service';

export interface OfflineAiEvalRunInput {
  aiSurface: string;
  caseSetName: string;
  datasetVersion: string;
  totalCases: number;
  modelName?: string | null;
  reportPath?: string | null;
  executedBy?: string | null;
  summary?: Record<string, any>;
  metrics: {
    retrievalRecallAtK?: number | null;
    retrievalHitRateAtK?: number | null;
    citationSupportRate?: number | null;
    abstainCorrectness?: number | null;
    unsafeOverconfidentOutputRate?: number | null;
  };
  gateInputs?: {
    calibrationDrift?: number | null;
    maxDisparity?: number | null;
  };
}

interface ReleaseGateComputation {
  gateName: string;
  gateStatus: 'passed' | 'failed' | 'not_applicable';
  comparator: 'gte' | 'lte' | null;
  observedValue: number | null;
  thresholdValue: number | null;
  details: Record<string, any>;
}

@Injectable()
export class ModelMonitoringService {
  private readonly logger = new Logger(ModelMonitoringService.name);

  // AUC baselines — populated on first compute, used to detect drift
  private baselines: Record<string, number> = {};

  constructor(
    private readonly tenantService: TenantService,
    @Inject(forwardRef(() => FederatedLearningService))
    private readonly federatedLearning: FederatedLearningService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Manual / on-demand evaluation ─────────────────────────────────────────

  async evaluateModel(subdomain: string, modelName: string, period?: string): Promise<ModelPerformanceMetric> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const evalPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

    const outcomes = await this.fetchOutcomes(ds, modelName, evalPeriod);
    let metrics: any = { auc_roc: null, brier_score: null, sensitivity: null, specificity: null, ppv: null, calibration: [] };

    try {
      const result = await this.cdssService.evaluateModelPerformance(
        { modelName, period: evalPeriod, outcomes },
        subdomain,
        ds,
      );
      if ((result as any)?.auc_roc !== undefined) {
        metrics = result;
      } else {
        throw new Error('CDSS response did not include model metrics');
      }
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
      // Auto-trigger retraining when drift is detected
      this.federatedLearning.initiateRound(subdomain, modelName).catch(e =>
        this.logger.error(`Drift-triggered retrain failed for ${modelName}: ${e?.message}`));
    }

    // Compute fairness
    await this.computeFairness(subdomain, ds, modelName, evalPeriod, outcomes).catch((e: any) => this.logger.warn(`model fairness computation failed: ${e?.message}`));

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

  async recordOfflineEvalRun(subdomain: string, payload: OfflineAiEvalRunInput): Promise<{
    run: AiEvalRun;
    releaseGates: AiReleaseGateResult[];
    blocked: boolean;
  }> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const runRepo = ds.getRepository(AiEvalRun);
    const gateRepo = ds.getRepository(AiReleaseGateResult);

    const derivedSignals = await this.resolveReleaseSignals(ds, payload.modelName || null);
    const releaseGates = this.computeReleaseGates(payload, derivedSignals);
    const blocked = releaseGates.some((gate) => gate.gateStatus === 'failed');

    const run = await runRepo.save(runRepo.create({
      aiSurface: payload.aiSurface,
      modelName: payload.modelName || null,
      caseSetName: payload.caseSetName,
      datasetVersion: payload.datasetVersion,
      runStatus: blocked ? 'blocked' : 'passed',
      totalCases: Number(payload.totalCases || 0),
      reportPath: payload.reportPath || null,
      retrievalRecallAtK: this.toNullableNumber(payload.metrics?.retrievalRecallAtK),
      retrievalHitRateAtK: this.toNullableNumber(payload.metrics?.retrievalHitRateAtK),
      citationSupportRate: this.toNullableNumber(payload.metrics?.citationSupportRate),
      abstainCorrectness: this.toNullableNumber(payload.metrics?.abstainCorrectness),
      unsafeOverconfidentOutputRate: this.toNullableNumber(payload.metrics?.unsafeOverconfidentOutputRate),
      summary: payload.summary || {},
      gateSummary: {
        blocked,
        failedGateCount: releaseGates.filter((gate) => gate.gateStatus === 'failed').length,
        passedGateCount: releaseGates.filter((gate) => gate.gateStatus === 'passed').length,
        notApplicableGateCount: releaseGates.filter((gate) => gate.gateStatus === 'not_applicable').length,
      },
      executedBy: payload.executedBy || null,
    }));

    const savedGates = await gateRepo.save(
      releaseGates.map((gate) => gateRepo.create({
        evalRunId: run.id,
        aiSurface: payload.aiSurface,
        gateName: gate.gateName,
        gateStatus: gate.gateStatus,
        comparator: gate.comparator,
        observedValue: gate.observedValue,
        thresholdValue: gate.thresholdValue,
        details: gate.details,
      })),
    );

    return {
      run,
      releaseGates: savedGates,
      blocked,
    };
  }

  async getOfflineEvalRuns(subdomain: string, aiSurface?: string): Promise<AiEvalRun[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: Record<string, any> = aiSurface ? { aiSurface } : {};
    return ds.getRepository(AiEvalRun).find({
      where,
      order: { createdAt: 'DESC' },
      take: 24,
    });
  }

  async getReleaseGateResults(subdomain: string, aiSurface?: string): Promise<AiReleaseGateResult[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: Record<string, any> = aiSurface ? { aiSurface } : {};
    return ds.getRepository(AiReleaseGateResult).find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getReleaseReadiness(subdomain: string, aiSurface: string): Promise<{
    aiSurface: string;
    releaseStatus: 'ready' | 'blocked' | 'unknown';
    latestRun: AiEvalRun | null;
    latestGateResults: AiReleaseGateResult[];
  }> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const runRepo = ds.getRepository(AiEvalRun);
    const gateRepo = ds.getRepository(AiReleaseGateResult);
    const latestRun = await runRepo.findOne({
      where: { aiSurface },
      order: { createdAt: 'DESC' },
    });

    if (!latestRun) {
      return {
        aiSurface,
        releaseStatus: 'unknown',
        latestRun: null,
        latestGateResults: [],
      };
    }

    const latestGateResults = await gateRepo.find({
      where: { evalRunId: latestRun.id },
      order: { createdAt: 'ASC' },
    });

    return {
      aiSurface,
      releaseStatus: latestGateResults.some((gate) => gate.gateStatus === 'failed') ? 'blocked' : 'ready',
      latestRun,
      latestGateResults,
    };
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
      for (const tenant of tenants) {
        const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
        if (!subdomain) {
          continue;
        }
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
        `, [yearMonth]).catch((e: any) => { this.logger.warn(`deterioration_predictions outcomes query failed: ${e?.message}`); return []; });
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
        `, [yearMonth]).catch((e: any) => { this.logger.warn(`readmission_predictions outcomes query failed: ${e?.message}`); return []; });
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
    if (!pos.length || !neg.length) return { auc_roc: null, brier_score: brierScore };
    let wins = 0;
    for (const p of pos) for (const n of neg) { if (p.predicted > n.predicted) wins++; }
    const auc_roc = wins / (pos.length * neg.length);
    return { auc_roc, brier_score: brierScore };
  }

  private async resolveReleaseSignals(ds: any, modelName: string | null): Promise<{
    calibrationDrift: number | null;
    maxDisparity: number | null;
  }> {
    if (!modelName) {
      return { calibrationDrift: null, maxDisparity: null };
    }

    const metricRepo = ds.getRepository(ModelPerformanceMetric);
    const fairnessRepo = ds.getRepository(ModelFairnessReport);
    const latestMetric = await metricRepo.findOne({
      where: { modelName },
      order: { computedAt: 'DESC' },
    });
    const latestFairness = await fairnessRepo.findOne({
      where: { modelName },
      order: { computedAt: 'DESC' },
    });

    const calibrationDrift = (
      latestMetric?.baselineAuc !== null &&
      latestMetric?.baselineAuc !== undefined &&
      latestMetric?.aucRoc !== null &&
      latestMetric?.aucRoc !== undefined
    )
      ? Number(latestMetric.baselineAuc) - Number(latestMetric.aucRoc)
      : null;

    return {
      calibrationDrift,
      maxDisparity: latestFairness?.maxDisparity ?? null,
    };
  }

  private computeReleaseGates(
    payload: OfflineAiEvalRunInput,
    derivedSignals: { calibrationDrift: number | null; maxDisparity: number | null },
  ): ReleaseGateComputation[] {
    const calibrationDrift = this.toNullableNumber(
      payload.gateInputs?.calibrationDrift ?? derivedSignals.calibrationDrift,
    );
    const maxDisparity = this.toNullableNumber(
      payload.gateInputs?.maxDisparity ?? derivedSignals.maxDisparity,
    );

    return [
      this.makeGateResult(
        'citation_support_rate',
        this.toNullableNumber(payload.metrics?.citationSupportRate),
        0.7,
        'gte',
      ),
      this.makeGateResult(
        'abstain_correctness',
        this.toNullableNumber(payload.metrics?.abstainCorrectness),
        0.9,
        'gte',
      ),
      this.makeGateResult(
        'unsafe_overconfident_output_rate',
        this.toNullableNumber(payload.metrics?.unsafeOverconfidentOutputRate),
        0.05,
        'lte',
      ),
      this.makeGateResult(
        'calibration_drift',
        calibrationDrift,
        0.05,
        'lte',
        { source: payload.modelName ? 'model_performance_metrics' : 'not_applicable' },
      ),
      this.makeGateResult(
        'subgroup_disparities',
        maxDisparity,
        0.05,
        'lte',
        { source: payload.modelName ? 'model_fairness_reports' : 'not_applicable' },
      ),
    ];
  }

  private makeGateResult(
    gateName: string,
    observedValue: number | null,
    thresholdValue: number,
    comparator: 'gte' | 'lte',
    details: Record<string, any> = {},
  ): ReleaseGateComputation {
    if (observedValue === null || observedValue === undefined || Number.isNaN(observedValue)) {
      return {
        gateName,
        gateStatus: 'not_applicable',
        comparator,
        observedValue: null,
        thresholdValue,
        details,
      };
    }

    const passed = comparator === 'gte'
      ? observedValue >= thresholdValue
      : observedValue <= thresholdValue;

    return {
      gateName,
      gateStatus: passed ? 'passed' : 'failed',
      comparator,
      observedValue,
      thresholdValue,
      details,
    };
  }

  private toNullableNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
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
