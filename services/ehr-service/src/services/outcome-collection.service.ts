import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { AiOpsMetric } from '../entities/ai-ops-metric.entity';
import { ModelDeployment } from '../entities/model-deployment.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class OutcomeCollectionService {
  private readonly logger = new Logger(OutcomeCollectionService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  /**
   * Nightly at 01:00 UTC — collect outcomes for CDSS decisions made 30+ days ago.
   * Runs across all active tenants.
   */
  @Cron('0 1 * * *')
  async collectOutcomes(): Promise<void> {
    this.logger.log('Starting nightly outcome collection...');
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        await this.collectOutcomesForTenant(tenant.subdomain);
      } catch (err) {
        this.logger.error(`Outcome collection failed for tenant ${tenant.subdomain}: ${err}`);
      }
    }
  }

  /**
   * Weekly Sunday at 02:00 UTC — aggregate ops metrics and check release gates.
   */
  @Cron('0 2 * * 0')
  async runModelEvaluation(): Promise<void> {
    this.logger.log('Starting weekly model evaluation...');
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        await this.runModelEvaluationForTenant(tenant.subdomain);
      } catch (err) {
        this.logger.error(`Model evaluation failed for tenant ${tenant.subdomain}: ${err}`);
      }
    }
  }

  private async collectOutcomesForTenant(tenantId: string): Promise<void> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) return;

    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const auditRows = await tenantDb.query(`
      SELECT pal.id,
             pal.metadata->>'surface' AS surface,
             pal.patient_id,
             pal.created_at,
             pal.metadata->>'task' AS decision_summary
      FROM prompt_audit_log pal
      WHERE pal.created_at < $1
        AND NOT EXISTS (
          SELECT 1 FROM cdss_feedback_entries cfe
          WHERE cfe.prompt_audit_log_id = pal.id
        )
      LIMIT 500
    `, [cutoffDate]);

    if (auditRows.length === 0) {
      this.logger.log(`No new outcomes to collect for tenant ${tenantId}.`);
      return;
    }

    const batchId = crypto.randomUUID();
    const entries = [];

    for (const row of auditRows) {
      const surface = row.surface ?? 'unknown';
      const outcomeScore = await this.resolveOutcomeScore(row.patient_id, surface, row.created_at, tenantDb);
      entries.push({
        batch_id: batchId,
        surface,
        prompt_audit_log_id: row.id,
        patient_id: row.patient_id,
        decision_summary: row.decision_summary ?? surface,
        outcome_label: outcomeScore >= 0.7 ? 'good' : outcomeScore >= 0.4 ? 'partial' : 'poor',
        outcome_score: outcomeScore,
        outcome_observed_at: new Date().toISOString(),
      });
    }

    try {
      await this.cdssService.collectOutcomeFeedbackBatch(entries, tenantId);
      this.logger.log(`Collected ${entries.length} outcomes in batch ${batchId} for tenant ${tenantId}`);
    } catch (err) {
      this.logger.error(`Outcome collection batch-collect failed for tenant ${tenantId}: ${err}`);
    }
  }

  private async runModelEvaluationForTenant(tenantId: string): Promise<void> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) return;

    const surfaces = await tenantDb.query(`
      SELECT DISTINCT metadata->>'surface' AS surface FROM prompt_audit_log
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND metadata->>'surface' IS NOT NULL
    `);

    for (const { surface } of surfaces) {
      await this.evaluateSurface(surface, tenantId, tenantDb);
    }
  }

  private async evaluateSurface(surface: string, tenantId: string, tenantDb: any): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const [callStats, feedbackStats] = await Promise.all([
      tenantDb.query(`
        SELECT COUNT(*) as total_calls,
               SUM(CASE WHEN safety_gate_triggered THEN 1 ELSE 0 END) as abstention_count,
               AVG(latency_ms) as avg_latency_ms
        FROM prompt_audit_log
        WHERE metadata->>'surface' = $1 AND created_at > NOW() - INTERVAL '7 days'
      `, [surface]),
      tenantDb.query(`
        SELECT COUNT(*) as total,
               AVG(outcome_score) as avg_outcome
        FROM cdss_feedback_entries
        WHERE surface = $1 AND created_at > NOW() - INTERVAL '30 days'
          AND approved_for_learning = FALSE
      `, [surface]),
    ]);

    const totalCalls = Number(callStats[0]?.total_calls ?? 0);
    const abstentions = Number(callStats[0]?.abstention_count ?? 0);
    const avgLatency = callStats[0]?.avg_latency_ms ? Number(callStats[0].avg_latency_ms) : null;
    const accuracy = feedbackStats[0]?.avg_outcome ? Number(feedbackStats[0].avg_outcome) : null;

    const opsMetricRepo = tenantDb.getRepository(AiOpsMetric);
    await opsMetricRepo.upsert(
      {
        surface,
        metricDate: today,
        totalCalls,
        abstentionCount: abstentions,
        avgLatencyMs: avgLatency,
        accuracy,
      },
      ['surface', 'metricDate'],
    );

    // Compute SDOH fairness parity
    const fairnessStats = await tenantDb.query(`
      SELECT
        CASE WHEN EXISTS (
          SELECT 1 FROM sdoh_screening_logs s
          WHERE s.patient_id = cfe.patient_id
            AND jsonb_array_length(s.positive_screens) > 0
        ) THEN 'sdoh_risk' ELSE 'no_sdoh_risk' END as group_label,
        AVG(cfe.outcome_score) as avg_outcome,
        COUNT(*) as n
      FROM cdss_feedback_entries cfe
      WHERE cfe.surface = $1
        AND cfe.created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1
    `, [surface]);

    const groupScores: Record<string, number> = {};
    fairnessStats.forEach((r: any) => {
      groupScores[r.group_label] = Number(r.avg_outcome);
    });
    const sdohParity = (groupScores['sdoh_risk'] && groupScores['no_sdoh_risk'])
      ? Math.min(
          groupScores['sdoh_risk'] / groupScores['no_sdoh_risk'],
          groupScores['no_sdoh_risk'] / groupScores['sdoh_risk'],
        )
      : null;

    if (sdohParity !== null) {
      await opsMetricRepo.update(
        { surface, metricDate: today },
        { fairnessSdohParity: sdohParity },
      );
    }

    // Release gate check: block if accuracy dropped > 5% vs previous week
    if (accuracy !== null) {
      const prevWeek = await tenantDb.query(`
        SELECT accuracy FROM ai_ops_metrics
        WHERE surface = $1 AND metric_date = CURRENT_DATE - INTERVAL '7 days'
      `, [surface]);

      const prevAccuracy = prevWeek[0]?.accuracy ? Number(prevWeek[0].accuracy) : null;
      if (prevAccuracy !== null && prevAccuracy - accuracy > 0.05) {
        this.logger.warn(`RELEASE GATE FAILED for surface ${surface} tenant ${tenantId}: accuracy dropped from ${prevAccuracy} to ${accuracy}`);
        return;
      }

      if (accuracy > 0.70) {
        await tenantDb.query(`
          UPDATE cdss_feedback_entries
          SET approved_for_learning = TRUE
          WHERE surface = $1
            AND approved_for_learning = FALSE
            AND outcome_score >= 0.70
        `, [surface]);
        this.logger.log(`Release gate passed for ${surface} tenant ${tenantId}. Learning batch approved.`);

        // Queue approved feedback for a human-reviewed retraining cycle. This does
        // NOT deploy a new model — there is no automated retrain/redeploy pipeline
        // wired up (see cdss-service's claim_for_learning). Record the outcome
        // honestly rather than fabricating a new model version.
        let confirmedVersion = 'unknown';
        try {
          const claimRes = await this.cdssService.triggerOutcomeLearningRetraining(surface, [
            { tenant_id: tenantId, approved: true },
          ], tenantId);
          this.logger.log(`[retraining] Surface "${surface}" tenant "${tenantId}": ${(claimRes as any)?.message ?? 'feedback queued'}`);

          const versionRes = await this.cdssService.getModelVersion(surface, tenantId);
          confirmedVersion = (versionRes as any)?.version ?? 'unknown';
        } catch (err) {
          this.logger.warn(`[retraining] Could not queue feedback or read model version for ${surface}: ${err}`);
        }

        // Record that feedback was queued for review — not a deployment.
        const deploymentRepo = tenantDb.getRepository(ModelDeployment);
        await deploymentRepo.save(deploymentRepo.create({
          surface,
          modelVersion: confirmedVersion,
          previousVersion: confirmedVersion,
          evalRunId: crypto.randomUUID(),
          releaseGateId: crypto.randomUUID(),
          accuracyBefore: prevAccuracy,
          accuracyAfter: accuracy,
          deploymentMethod: 'manual_review_required',
          status: 'feedback_queued',
        }));
      }
    }
  }

  private async resolveOutcomeScore(
    patientId: string,
    surface: string,
    decisionDate: Date,
    tenantDb: any,
  ): Promise<number> {
    const thirtyDaysLater = new Date(decisionDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (surface === 'vitals_interpretation' || surface === 'risk_deterioration') {
      const adverse = await tenantDb.query(`
        SELECT COUNT(*) as cnt FROM encounters
        WHERE patient_id = $1
          AND encounter_type IN ('icu_admission', 'emergency')
          AND started_at BETWEEN $2 AND $3
      `, [patientId, decisionDate, thirtyDaysLater]);
      return Number(adverse[0]?.cnt) === 0 ? 0.9 : 0.2;
    }

    if (surface === 'denial_prediction') {
      const claim = await tenantDb.query(`
        SELECT actual_outcome FROM claim_risk_scores
        WHERE patient_id = $1 AND feedback_recorded_at IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      `, [patientId]);
      return claim[0]?.actual_outcome === 'approved' ? 1.0 : 0.0;
    }

    return 0.5;
  }
}
