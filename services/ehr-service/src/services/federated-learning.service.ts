import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { FlRound } from '../entities/fl-round.entity';
import { FlParticipationLog } from '../entities/fl-participation-log.entity';
import { ModelRegistryService } from './model-registry.service';
import axios from 'axios';

const MODEL_TYPES = ['deterioration', 'readmission', 'sepsis', 'no_show'];

@Injectable()
export class FederatedLearningService {
  private readonly logger = new Logger(FederatedLearningService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // Minimum outcomes before training is worthwhile
  private readonly MIN_OUTCOMES = 50;

  constructor(
    private readonly tenantService: TenantService,
    @Inject(forwardRef(() => ModelRegistryService))
    private readonly modelRegistry: ModelRegistryService,
  ) {}

  // ── Round Management ───────────────────────────────────────────────────────

  async initiateRound(subdomain: string, modelType: string): Promise<FlRound> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(FlRound);

    const lastRound = await repo.findOne({ where: { modelType }, order: { roundNumber: 'DESC' } });
    const nextRound = (lastRound?.roundNumber || 0) + 1;

    const round = await repo.save(repo.create({
      roundNumber: nextRound,
      globalModelVersion: `${modelType}-v${nextRound}`,
      modelType,
      status: 'pending',
    }));

    this.logger.log(`Initiated FL round ${nextRound} for model ${modelType}`);

    // Kick off local training across all tenants
    this.runLocalTrainingAcrossAllTenants(subdomain, round.id, modelType).catch(e =>
      this.logger.error(`Local training kickoff failed: ${e?.message}`));

    return round;
  }

  async submitLocalMetrics(
    subdomain: string,
    roundId: string,
    metrics: { localModelMetrics: any; sampleCount: number; gradientNorm?: number; privacyEpsilon?: number },
  ): Promise<FlParticipationLog> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const log = await ds.getRepository(FlParticipationLog).save(
      ds.getRepository(FlParticipationLog).create({
        roundId,
        tenantSubdomain: subdomain,
        ...metrics,
        status: 'submitted',
      }),
    );

    // Try to aggregate whenever a new submission arrives
    this.aggregateRound(subdomain, roundId).catch(e =>
      this.logger.warn(`FL aggregation failed for round ${roundId}: ${e?.message}`));

    return log;
  }

  async getRound(subdomain: string, roundId: string): Promise<FlRound | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FlRound).findOneBy({ id: roundId });
  }

  async getRounds(subdomain: string, modelType?: string): Promise<FlRound[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: any = modelType ? { modelType } : {};
    return ds.getRepository(FlRound).find({ where, order: { roundNumber: 'DESC' } });
  }

  async getParticipationLogs(subdomain: string, roundId: string): Promise<FlParticipationLog[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FlParticipationLog).find({ where: { roundId } });
  }

  // ── Local Training ─────────────────────────────────────────────────────────

  /**
   * For each active tenant: fetch local outcomes → send to CDSS /fl/train-local
   * → submit metrics back → aggregation fires automatically.
   */
  async runLocalTrainingAcrossAllTenants(coordinatorSubdomain: string, roundId: string, modelType: string): Promise<void> {
    const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
    this.logger.log(`Running local training for ${tenants.length} tenants (round ${roundId}, model ${modelType})`);

    let submitted = 0;
    for (const tenant of tenants) {
      const subdomain = tenant.subdomain;
      try {
        await this.trainLocalModel(subdomain, roundId, modelType);
        submitted++;
      } catch (e: any) {
        this.logger.warn(`Local training failed for ${subdomain}: ${e?.message}`);
      }
    }
    this.logger.log(`Local training complete: ${submitted}/${tenants.length} tenants submitted`);
  }

  async trainLocalModel(subdomain: string, roundId: string, modelType: string): Promise<FlParticipationLog> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);

    // Fetch training outcomes from this tenant's DB
    const outcomes = await this.fetchTrainingOutcomes(ds, modelType);

    if (outcomes.length < this.MIN_OUTCOMES) {
      this.logger.debug(`${subdomain} has only ${outcomes.length} outcomes for ${modelType} — skipping`);
      // Submit empty contribution so round isn't blocked
      return this.submitLocalMetrics(subdomain, roundId, {
        localModelMetrics: { skipped: true, reason: 'insufficient_data' },
        sampleCount: outcomes.length,
      });
    }

    // Send to CDSS for sklearn training
    const { data } = await axios.post(`${this.cdssUrl}/fl/train-local`, {
      modelType,
      roundId,
      outcomes,
      privacyEpsilon: 1.0, // differential privacy budget
    }, { timeout: 120000 }); // training can take a while

    return this.submitLocalMetrics(subdomain, roundId, {
      localModelMetrics: {
        auc: data.auc,
        brier: data.brier,
        feature_importances: data.feature_importances,
      },
      sampleCount: data.sample_count,
      gradientNorm: data.gradient_norm,
      privacyEpsilon: 1.0,
    });
  }

  // ── Aggregation + Auto-Promote ─────────────────────────────────────────────

  private async aggregateRound(subdomain: string, roundId: string): Promise<void> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const roundRepo = ds.getRepository(FlRound);
    const logRepo = ds.getRepository(FlParticipationLog);

    const round = await roundRepo.findOneBy({ id: roundId });
    if (!round || round.status === 'completed' || round.status === 'failed') return;

    const allTenants = await this.tenantService.getAllActiveTenants?.() ?? [];
    const logs = await logRepo.find({ where: { roundId, status: 'submitted' } });

    // Wait until all tenants submitted OR 24h have passed since round start
    const hoursSinceInit = (Date.now() - new Date(round.initiatedAt).getTime()) / 3_600_000;
    const allSubmitted = logs.length >= Math.max(allTenants.length, 1);
    if (!allSubmitted && hoursSinceInit < 24) return;

    await roundRepo.update(roundId, { status: 'aggregating' });

    const realContributions = logs.filter(l => !l.localModelMetrics?.skipped);
    if (!realContributions.length) {
      await roundRepo.update(roundId, { status: 'failed' });
      this.logger.warn(`Round ${roundId} failed — no valid contributions`);
      return;
    }

    try {
      const { data } = await axios.post(`${this.cdssUrl}/fl/aggregate`, {
        roundId,
        modelType: round.modelType,
        contributions: realContributions.map(l => ({
          tenant: l.tenantSubdomain,
          metrics: l.localModelMetrics,
          sampleCount: l.sampleCount,
          gradientNorm: l.gradientNorm,
          privacyEpsilon: l.privacyEpsilon,
        })),
      }, { timeout: 60000 });

      await roundRepo.update(roundId, {
        aggregatedMetrics: data.aggregatedMetrics || {},
        modelWeightsRef: data.modelWeightsRef,
        participatingTenants: realContributions.map(l => l.tenantSubdomain),
        status: 'completed',
        completedAt: new Date(),
      });

      this.logger.log(`FL round ${round.roundNumber} aggregated — ${realContributions.length} tenants, weights at ${data.modelWeightsRef}`);

      // Register + evaluate + auto-promote
      await this.registerAndPromote(subdomain, round, data).catch(e =>
        this.logger.error(`Post-aggregation promote failed: ${e?.message}`));

    } catch (e: any) {
      this.logger.error(`FL aggregation error for round ${roundId}: ${e?.message}`);
      await roundRepo.update(roundId, { status: 'failed' });
    }
  }

  private async registerAndPromote(subdomain: string, round: FlRound, aggregateData: any): Promise<void> {
    if (!aggregateData.modelWeightsRef) return;

    // Evaluate the aggregated model first
    let aucRoc: number | undefined;
    let brierScore: number | undefined;
    let sampleCount = aggregateData.totalSamples || 0;

    try {
      const ds = await this.tenantService.getTenantDatabase(subdomain);
      const holdout = await this.fetchTrainingOutcomes(ds, round.modelType, true);
      if (holdout.length >= 20) {
        const { data: evalData } = await axios.post(`${this.cdssUrl}/fl/evaluate`, {
          modelType: round.modelType,
          minioPath: aggregateData.modelWeightsRef,
          outcomes: holdout,
        }, { timeout: 60000 });
        aucRoc = evalData.auc_roc;
        brierScore = evalData.brier_score;
        sampleCount = evalData.sample_count || sampleCount;
      }
    } catch (e: any) {
      this.logger.warn(`Model evaluation failed, using aggregated metrics: ${e?.message}`);
      aucRoc = aggregateData.aggregatedMetrics?.auc;
    }

    // Register in model registry
    const registered = await this.modelRegistry.register(subdomain, {
      modelName: round.modelType,
      roundId: round.id,
      minioPath: aggregateData.modelWeightsRef,
      aucRoc,
      brierScore,
      sampleCount,
      tenantCount: aggregateData.participantCount || 0,
      modelHash: aggregateData.modelHash,
      featureNames: aggregateData.featureNames || [],
    });

    // Never auto-promote FL candidates to production. Stage them for governed shadow review first.
    const result = await this.modelRegistry.evaluateAndPromote(subdomain, registered.id, {
      requestedStage: 'shadow',
      requestedBy: 'federated-learning',
      decisionNotes: 'Federated aggregation completed. Candidate staged for governed shadow evaluation before canary or production.',
    });
    this.logger.log(`Model ${round.modelType} governance staging: ${result.promoted ? '✓' : '…'} — ${result.reason}`);
  }

  // ── Outcome fetching (training data) ──────────────────────────────────────

  private async fetchTrainingOutcomes(ds: any, modelType: string, holdout = false): Promise<any[]> {
    // holdout = last 10% of data for evaluation; training = first 90%
    const limit = holdout ? 500 : 5000;
    const orderDir = holdout ? 'DESC' : 'ASC';

    try {
      if (modelType === 'deterioration') {
        return await ds.query(`
          SELECT
            dp.deterioration_score / 100.0 AS predicted,
            CASE WHEN a.icu_transfer_at IS NOT NULL THEN 1 ELSE 0 END AS actual,
            (dp.feature_contributions->>'respiratory_rate')::float AS respiratory_rate,
            (dp.feature_contributions->>'spo2')::float AS spo2,
            (dp.feature_contributions->>'systolic_bp')::float AS systolic_bp,
            (dp.feature_contributions->>'heart_rate')::float AS heart_rate,
            (dp.feature_contributions->>'temperature')::float AS temperature,
            COALESCE(EXTRACT(YEAR FROM AGE(p.date_of_birth))::int, 45) AS age,
            CASE WHEN p.gender = 'male' THEN 1 ELSE 0 END AS gender_male
          FROM deterioration_predictions dp
          JOIN patients p ON p.id = dp.patient_id
          LEFT JOIN admissions a ON a.id = dp.admission_id
          WHERE dp.prediction_time > NOW() - INTERVAL '6 months'
          ORDER BY dp.prediction_time ${orderDir}
          LIMIT ${limit}
        `).catch(() => []);
      }

      if (modelType === 'readmission') {
        return await ds.query(`
          SELECT
            rp.readmission_30day_risk AS predicted,
            CASE WHEN EXISTS(
              SELECT 1 FROM admissions a2
              WHERE a2.patient_id = rp.patient_id
              AND a2.admission_date > rp.prediction_date
              AND a2.admission_date <= rp.prediction_date + INTERVAL '30 days'
            ) THEN 1 ELSE 0 END AS actual,
            COALESCE(EXTRACT(YEAR FROM AGE(p.date_of_birth))::int, 45) AS age,
            CASE WHEN p.gender = 'male' THEN 1 ELSE 0 END AS gender_male,
            (SELECT COUNT(*)::int FROM admissions a3
             WHERE a3.patient_id = rp.patient_id
             AND a3.admission_date < rp.prediction_date
             AND a3.admission_date > rp.prediction_date - INTERVAL '90 days') AS prior_admissions_90d,
            (SELECT COUNT(*)::int FROM problems pr
             WHERE pr.patient_id = rp.patient_id AND pr.status = 'active') AS comorbidity_count
          FROM readmission_predictions rp
          JOIN patients p ON p.id = rp.patient_id
          WHERE rp.prediction_date > NOW() - INTERVAL '6 months'
          ORDER BY rp.prediction_date ${orderDir}
          LIMIT ${limit}
        `).catch(() => []);
      }

      if (modelType === 'no_show') {
        return await ds.query(`
          SELECT
            COALESCE(sap.no_show_probability, 0.3) AS predicted,
            CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END AS actual,
            COALESCE(EXTRACT(YEAR FROM AGE(p.date_of_birth))::int, 40) AS age,
            CASE WHEN p.gender = 'male' THEN 1 ELSE 0 END AS gender_male,
            EXTRACT(DOW FROM a.appointment_date)::int AS day_of_week,
            EXTRACT(HOUR FROM a.appointment_date)::int AS hour_of_day
          FROM appointments a
          JOIN patients p ON p.id = a.patient_id
          LEFT JOIN scheduling_ai_predictions sap ON sap.appointment_id = a.id
          WHERE a.appointment_date > NOW() - INTERVAL '6 months'
          ORDER BY a.appointment_date ${orderDir}
          LIMIT ${limit}
        `).catch(() => []);
      }
    } catch (e: any) {
      this.logger.warn(`Outcome fetch failed for ${modelType}: ${e?.message}`);
    }
    return [];
  }

  // ── Cron triggers ──────────────────────────────────────────────────────────

  /** Every Sunday 02:00 — train all models */
  @Cron('0 2 * * 0')
  async weeklyFederatedRound() {
    this.logger.log('Starting weekly federated learning round…');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      if (!tenants.length) return;
      const coordinator = tenants[0]?.subdomain;
      if (!coordinator) return;
      for (const modelType of MODEL_TYPES) {
        await this.initiateRound(coordinator, modelType).catch(e =>
          this.logger.error(`Weekly FL round failed for ${modelType}: ${e?.message}`));
      }
    } catch (e: any) {
      this.logger.error(`Weekly FL cron error: ${e?.message}`);
    }
  }
}
