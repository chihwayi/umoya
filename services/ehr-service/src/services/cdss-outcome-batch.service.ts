import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { In } from 'typeorm';
import { TenantService } from './tenant.service';
import { CdssDecisionLogService } from './cdss-decision-log.service';
import { OutcomeLearningJob } from '../entities/outcome-learning-job.entity';
import { ModelShadowEvaluation } from '../entities/model-shadow-evaluation.entity';
import { ModelRegistry } from '../entities/model-registry.entity';
import { FlRound } from '../entities/fl-round.entity';
import { FederatedLearningService } from './federated-learning.service';
import { CdssService } from './cdss.service';

/**
 * Weekly batch job that:
 * 1. Iterates all active tenants
 * 2. Finds CdssDecisionLog entries that have clinician actions but haven't
 *    been fed back to the CDSS yet
 * 3. Pushes them to the CDSS /feedback/outcome endpoint
 * 4. Marks entries as sent
 *
 * It also claims approved feedback entries back from CDSS and persists them
 * as governed tenant-side learning jobs.
 *
 * Sprint 61 — CDSS Outcome Feedback Loop
 * Sprint 111 — governed outcome learning jobs
 */
@Injectable()
export class CdssOutcomeBatchService {
  private readonly logger = new Logger(CdssOutcomeBatchService.name);
  private readonly learningClaimTenant = 'system-learning';
  private readonly governedTrainingModels = new Set(['deterioration', 'readmission', 'sepsis', 'no_show']);
  private readonly minLearningJobsForTraining = Math.max(
    parseInt(process.env.CDSS_LEARNING_MIN_JOBS || '5', 10) || 5,
    1,
  );

  constructor(
    @Optional() @Inject(TenantService) private readonly tenantService: TenantService,
    @Optional() @Inject(CdssDecisionLogService) private readonly decisionLogService: CdssDecisionLogService,
    @Optional() @Inject(CdssService) private readonly cdssService?: CdssService,
    @Optional() @Inject(FederatedLearningService) private readonly federatedLearningService?: FederatedLearningService,
  ) {}

  /**
   * Runs every Sunday at 02:00 server time.
   * Configurable via CDSS_FEEDBACK_CRON env var.
   */
  @Cron(process.env.CDSS_FEEDBACK_CRON || '0 2 * * 0')
  async runWeeklyFeedbackBatch(): Promise<void> {
    if (!this.tenantService || !this.decisionLogService) {
      this.logger.warn('CdssOutcomeBatchService: dependencies not injected, skipping batch');
      return;
    }
    if (!this.cdssService) {
      this.logger.warn('CdssOutcomeBatchService: CdssService not injected, skipping outcome feedback batch');
      return;
    }

    this.logger.log('Starting weekly CDSS outcome feedback batch...');

    let processed = 0;
    let errors = 0;

    try {
      const tenants = await this.tenantService.getAllActiveTenants();

      for (const tenant of tenants) {
        try {
          const tenantDb = await this.tenantService.getTenantDatabase(tenant.subdomain);
          if (!tenantDb) continue;

          const pending = await this.decisionLogService.getPendingFeedback(tenantDb);
          if (!pending.length) continue;

          const actionable = pending.filter((entry) => !!entry.clinicianAction);
          if (!actionable.length) continue;

          const payload = actionable.map((entry) => ({
            logId: entry.id,
            patientId: entry.patientId,
            decisionType: entry.decisionType,
            tenantSubdomain: tenant.subdomain,
            sourceModel: this.resolveSourceModel(entry),
            topRecommendation: entry.topRecommendation,
            confidenceScore: entry.confidenceScore,
            clinicianAction: entry.clinicianAction,
            overrideReason: entry.overrideReason,
            outcomeAt30Days: entry.outcomeAt30Days,
            outcomeAt90Days: entry.outcomeAt90Days,
            createdAt: entry.createdAt,
          }));

          await this.cdssService.submitOutcomeFeedback(payload, tenant.subdomain);

          await this.decisionLogService.markFeedbackSent(
            actionable.map((entry) => entry.id),
            tenantDb,
          );

          processed += actionable.length;
          this.logger.log(`Tenant ${tenant.subdomain}: pushed ${actionable.length} feedback entries`);
        } catch (tenantErr: any) {
          this.logger.error(`Feedback batch error for tenant ${tenant.subdomain}: ${String(tenantErr?.message || tenantErr)}`);
          errors++;
        }
      }
    } catch (err: any) {
      this.logger.error(`Fatal error in CDSS feedback batch: ${String(err?.message || err)}`);
    }

    this.logger.log(`Weekly CDSS outcome feedback batch complete. Processed: ${processed}, Errors: ${errors}`);
  }

  @Cron(process.env.CDSS_LEARNING_CLAIM_CRON || '15 */6 * * *')
  async runApprovedLearningClaimBatch(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('CdssOutcomeBatchService: tenant service not injected, skipping approved learning claim batch');
      return;
    }
    if (!this.cdssService) {
      this.logger.warn('CdssOutcomeBatchService: CdssService not injected, skipping approved learning claim batch');
      return;
    }

    try {
      const data = await this.cdssService.claimOutcomeFeedbackForLearning(50, this.learningClaimTenant);

      const entries = Array.isArray(data?.entries) ? data.entries : [];
      if (!entries.length) {
        this.logger.log('No approved outcome feedback entries were available for governed learning claim');
        return;
      }

      let createdJobs = 0;
      for (const entry of entries) {
        const tenantSubdomain = String(entry?.tenant_subdomain || '').trim();
        if (!tenantSubdomain) {
          this.logger.warn(`Skipping claimed feedback entry ${entry?.log_id || 'unknown'} because tenant_subdomain is missing`);
          continue;
        }

        const tenantDb = await this.tenantService.getTenantDatabase(tenantSubdomain);
        if (!tenantDb) {
          this.logger.warn(`Skipping claimed feedback entry ${entry?.log_id || 'unknown'} because tenant DB ${tenantSubdomain} could not be loaded`);
          continue;
        }

        const repo = tenantDb.getRepository(OutcomeLearningJob);
        const feedbackLogId = String(entry.log_id || '').trim();
        if (!feedbackLogId) {
          continue;
        }

        const existing = await repo.findOne({
          where: { feedbackLogId },
        });
        if (existing) {
          continue;
        }

        await repo.save(repo.create({
          feedbackLogId,
          tenantSubdomain,
          patientId: String(entry.patient_id || ''),
          decisionType: String(entry.decision_type || 'unknown'),
          modelName: this.resolveClaimModelName(entry),
          jobStatus: 'claimed',
          sourceKind: 'outcome_feedback',
          claimBatchId: entry.batch_id ? String(entry.batch_id) : null,
          processingNotes: 'Claimed from governed CDSS feedback store for review-to-learning workflow',
          payload: entry,
          claimedAt: new Date(),
          queuedAt: new Date(),
        }));
        createdJobs += 1;
      }

      this.logger.log(`Approved learning claim batch complete. Created ${createdJobs} governed outcome learning job(s).`);
    } catch (err: any) {
      this.logger.error(`Governed learning claim batch failed: ${String(err?.message || err)}`);
    }
  }

  @Cron(process.env.CDSS_LEARNING_ORCHESTRATION_CRON || '45 */6 * * *')
  async runGovernedLearningOrchestration(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('CdssOutcomeBatchService: tenant service not injected, skipping governed learning orchestration');
      return;
    }

    const tenants = await this.tenantService.getAllActiveTenants();
    let processedModels = 0;

    for (const tenant of tenants) {
      try {
        processedModels += await this.orchestrateTenantLearningJobs(tenant.subdomain);
      } catch (err: any) {
        this.logger.error(`Governed learning orchestration failed for tenant ${tenant.subdomain}: ${String(err?.message || err)}`);
      }
    }

    this.logger.log(`Governed learning orchestration complete. Processed ${processedModels} model batch(es).`);
  }

  @Cron(process.env.CDSS_LEARNING_RECONCILE_CRON || '5 */6 * * *')
  async reconcileGovernedShadowEvaluations(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('CdssOutcomeBatchService: tenant service not injected, skipping governed shadow evaluation reconciliation');
      return;
    }

    const tenants = await this.tenantService.getAllActiveTenants();
    let reconciled = 0;

    for (const tenant of tenants) {
      try {
        reconciled += await this.reconcileTenantShadowEvaluations(tenant.subdomain);
      } catch (err: any) {
        this.logger.error(`Governed shadow evaluation reconciliation failed for tenant ${tenant.subdomain}: ${String(err?.message || err)}`);
      }
    }

    this.logger.log(`Governed shadow evaluation reconciliation complete. Reconciled ${reconciled} evaluation(s).`);
  }

  private async orchestrateTenantLearningJobs(subdomain: string): Promise<number> {
    const tenantDb = await this.tenantService.getTenantDatabase(subdomain);
    if (!tenantDb) {
      return 0;
    }

    const jobRepo = tenantDb.getRepository(OutcomeLearningJob);
    const shadowRepo = tenantDb.getRepository(ModelShadowEvaluation);
    const roundRepo = tenantDb.getRepository(FlRound);
    const registryRepo = tenantDb.getRepository(ModelRegistry);
    const pendingJobs = await jobRepo.find({
      where: { jobStatus: In(['claimed', 'review_pending']) },
      order: { createdAt: 'ASC' },
      take: 200,
    });

    if (!pendingJobs.length) {
      return 0;
    }

    const grouped = new Map<string, OutcomeLearningJob[]>();
    for (const job of pendingJobs) {
      const key = String(job.modelName || 'unknown').trim() || 'unknown';
      const current = grouped.get(key) || [];
      current.push(job);
      grouped.set(key, current);
    }

    let processedModels = 0;
    for (const [modelName, jobs] of grouped.entries()) {
      const activeEvaluation = await shadowRepo.findOne({
        where: {
          modelName,
          evaluationStatus: In(['training_requested', 'in_progress', 'candidate_registered', 'review_pending']),
        },
        order: { createdAt: 'DESC' },
      });

      if (activeEvaluation) {
        await this.attachJobsToShadowEvaluation(jobRepo, shadowRepo, activeEvaluation, jobs);
        processedModels += 1;
        continue;
      }

      const production = await registryRepo.findOne({
        where: { modelName, status: 'production' },
      });
      const supportedForTraining = this.governedTrainingModels.has(modelName);
      const shouldRequestTraining = supportedForTraining && jobs.length >= this.minLearningJobsForTraining;
      const evaluationSummary = {
        sourceFeedbackLogIds: jobs.map((job) => job.feedbackLogId),
        sourcePatientIds: jobs.map((job) => job.patientId),
        sourceStatuses: jobs.map((job) => job.jobStatus),
        requestedTraining: shouldRequestTraining,
        supportedForFederatedTraining: supportedForTraining,
        jobCount: jobs.length,
        minimumJobThreshold: this.minLearningJobsForTraining,
        generatedAt: new Date().toISOString(),
      };

      if (!shouldRequestTraining) {
        const evaluation = await shadowRepo.save(shadowRepo.create({
          modelName,
          evaluationKind: 'manual_review',
          evaluationStatus: 'review_pending',
          candidateRegistryId: null,
          candidateVersion: null,
          productionRegistryId: production?.id || null,
          productionVersion: production?.version || null,
          flRoundId: null,
          sourceJobCount: jobs.length,
          sourceJobIds: jobs.map((job) => job.id),
          summary: {
            ...evaluationSummary,
            reviewReason: supportedForTraining
              ? `Only ${jobs.length} governed learning job(s) available; minimum threshold for retraining request is ${this.minLearningJobsForTraining}`
              : `Model ${modelName} is not yet wired for governed federated retraining`,
          },
          requestedBy: 'cdss-outcome-batch',
          decisionNotes: supportedForTraining
            ? 'Queued for manual governance review until more approved feedback accumulates'
            : 'Queued for manual governance review because no automated retraining path is wired for this model family',
          startedAt: new Date(),
        }));
        await this.updateLearningJobBatch(jobRepo, jobs, 'review_pending', `Queued for governed manual review under shadow evaluation ${evaluation.id}`);
        processedModels += 1;
        continue;
      }

      let round = await roundRepo.findOne({
        where: {
          modelType: modelName,
          status: In(['pending', 'aggregating']),
        },
        order: { initiatedAt: 'DESC' },
      });

      let orchestrationNotes = 'Attached governed learning jobs to an existing federated round';
      if (!round && this.federatedLearningService) {
        round = await this.federatedLearningService.initiateRound(subdomain, modelName);
        orchestrationNotes = 'Requested a new federated retraining round from governed learning jobs';
      }

      const evaluationStatus = round ? 'training_requested' : 'review_pending';
      const evaluation = await shadowRepo.save(shadowRepo.create({
        modelName,
        evaluationKind: round ? 'federated_retrain' : 'manual_review',
        evaluationStatus,
        candidateRegistryId: null,
        candidateVersion: null,
        productionRegistryId: production?.id || null,
        productionVersion: production?.version || null,
        flRoundId: round?.id || null,
        sourceJobCount: jobs.length,
        sourceJobIds: jobs.map((job) => job.id),
        summary: {
          ...evaluationSummary,
          flRoundId: round?.id || null,
          flRoundStatus: round?.status || null,
          orchestrationNotes,
        },
        requestedBy: 'cdss-outcome-batch',
        decisionNotes: round
          ? orchestrationNotes
          : 'Federated training service was unavailable, so the learning batch has been queued for manual governance review',
        startedAt: new Date(),
      }));

      await this.updateLearningJobBatch(
        jobRepo,
        jobs,
        round ? 'training_requested' : 'review_pending',
        round
          ? `Requested governed federated shadow evaluation ${evaluation.id} via round ${round.id}`
          : `Queued for governed manual review under shadow evaluation ${evaluation.id}`,
      );
      processedModels += 1;
    }

    return processedModels;
  }

  private async reconcileTenantShadowEvaluations(subdomain: string): Promise<number> {
    const tenantDb = await this.tenantService.getTenantDatabase(subdomain);
    if (!tenantDb) {
      return 0;
    }

    const shadowRepo = tenantDb.getRepository(ModelShadowEvaluation);
    const roundRepo = tenantDb.getRepository(FlRound);
    const registryRepo = tenantDb.getRepository(ModelRegistry);
    const jobRepo = tenantDb.getRepository(OutcomeLearningJob);
    const evaluations = await shadowRepo.find({
      where: {
        evaluationStatus: In(['training_requested', 'in_progress']),
      },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    let reconciled = 0;
    for (const evaluation of evaluations) {
      if (!evaluation.flRoundId) {
        continue;
      }

      const round = await roundRepo.findOneBy({ id: evaluation.flRoundId });
      if (!round) {
        await shadowRepo.update(evaluation.id, {
          evaluationStatus: 'failed',
          completedAt: new Date(),
          decisionNotes: `Governed shadow evaluation could not find FL round ${evaluation.flRoundId}`,
        });
        await this.updateLearningJobsByIds(
          jobRepo,
          evaluation.sourceJobIds,
          'failed',
          `Governed shadow evaluation ${evaluation.id} could not reconcile FL round ${evaluation.flRoundId}`,
          true,
        );
        reconciled += 1;
        continue;
      }

      if (round.status === 'pending' || round.status === 'aggregating') {
        if (evaluation.evaluationStatus !== 'in_progress') {
          await shadowRepo.update(evaluation.id, {
            evaluationStatus: 'in_progress',
            startedAt: evaluation.startedAt || new Date(),
            summary: {
              ...(evaluation.summary || {}),
              flRoundStatus: round.status,
              lastReconciledAt: new Date().toISOString(),
            } as any,
          });
        }
        continue;
      }

      if (round.status === 'failed') {
        await shadowRepo.update(evaluation.id, {
          evaluationStatus: 'failed',
          completedAt: new Date(),
          decisionNotes: `Federated round ${round.id} failed before a governed shadow candidate was registered`,
          summary: {
            ...(evaluation.summary || {}),
            flRoundStatus: round.status,
            lastReconciledAt: new Date().toISOString(),
          } as any,
        });
        await this.updateLearningJobsByIds(
          jobRepo,
          evaluation.sourceJobIds,
          'failed',
          `Federated round ${round.id} failed before a governed shadow candidate was registered`,
          true,
        );
        reconciled += 1;
        continue;
      }

      if (round.status !== 'completed') {
        continue;
      }

      const candidate = await registryRepo.findOne({
        where: {
          roundId: round.id,
          modelName: evaluation.modelName,
        },
        order: { createdAt: 'DESC' },
      });

      if (!candidate) {
        await shadowRepo.update(evaluation.id, {
          evaluationStatus: 'review_pending',
          decisionNotes: `Federated round ${round.id} completed but no governed candidate registry entry was found`,
          summary: {
            ...(evaluation.summary || {}),
            flRoundStatus: round.status,
            lastReconciledAt: new Date().toISOString(),
            aggregatedMetrics: round.aggregatedMetrics || {},
            modelWeightsRef: round.modelWeightsRef || null,
          } as any,
        });
        await this.updateLearningJobsByIds(
          jobRepo,
          evaluation.sourceJobIds,
          'review_pending',
          `Federated round ${round.id} completed without a linked model registry candidate; manual governance review required`,
        );
        reconciled += 1;
        continue;
      }

      await shadowRepo.update(evaluation.id, {
        candidateRegistryId: candidate.id,
        candidateVersion: candidate.version,
        evaluationStatus: 'candidate_registered',
        completedAt: new Date(),
        decisionNotes: `Governed shadow candidate ${candidate.version} registered from FL round ${round.id}`,
        summary: {
          ...(evaluation.summary || {}),
          flRoundStatus: round.status,
          lastReconciledAt: new Date().toISOString(),
          aggregatedMetrics: round.aggregatedMetrics || {},
          modelWeightsRef: round.modelWeightsRef || null,
          candidateRegistryId: candidate.id,
          candidateDeploymentStage: candidate.deploymentStage,
        } as any,
      });
      await this.updateLearningJobsByIds(
        jobRepo,
        evaluation.sourceJobIds,
        'candidate_registered',
        `Governed shadow candidate ${candidate.version} registered under evaluation ${evaluation.id}`,
      );
      reconciled += 1;
    }

    return reconciled;
  }

  private async attachJobsToShadowEvaluation(
    jobRepo: any,
    shadowRepo: any,
    evaluation: ModelShadowEvaluation,
    jobs: OutcomeLearningJob[],
  ): Promise<void> {
    const mergedJobIds = this.mergeUniqueIds(evaluation.sourceJobIds || [], jobs.map((job) => job.id));
    await shadowRepo.update(evaluation.id, {
      sourceJobCount: mergedJobIds.length,
      sourceJobIds: mergedJobIds,
      summary: {
        ...(evaluation.summary || {}),
        lastAttachedAt: new Date().toISOString(),
        latestAttachedFeedbackLogIds: jobs.map((job) => job.feedbackLogId),
        accumulatedJobCount: mergedJobIds.length,
      },
    });

    const nextStatus = evaluation.flRoundId
      ? 'training_requested'
      : evaluation.evaluationStatus === 'candidate_registered'
        ? 'candidate_registered'
        : 'review_pending';
    const notes = evaluation.flRoundId
      ? `Attached to governed shadow evaluation ${evaluation.id} for FL round ${evaluation.flRoundId}`
      : `Attached to governed shadow evaluation ${evaluation.id}`;
    await this.updateLearningJobBatch(jobRepo, jobs, nextStatus, notes);
  }

  private async updateLearningJobBatch(
    jobRepo: any,
    jobs: OutcomeLearningJob[],
    jobStatus: string,
    processingNotes: string,
    markCompleted = false,
  ): Promise<void> {
    await this.updateLearningJobsByIds(
      jobRepo,
      jobs.map((job) => job.id),
      jobStatus,
      processingNotes,
      markCompleted,
    );
  }

  private async updateLearningJobsByIds(
    jobRepo: any,
    jobIds: string[],
    jobStatus: string,
    processingNotes: string,
    markCompleted = false,
  ): Promise<void> {
    if (!jobIds.length) {
      return;
    }
    await jobRepo.update(
      { id: In(jobIds) },
      {
        jobStatus,
        processingNotes,
        queuedAt: new Date(),
        completedAt: markCompleted ? new Date() : null,
      },
    );
  }

  private mergeUniqueIds(existing: string[], incoming: string[]): string[] {
    return Array.from(new Set([...(existing || []), ...(incoming || [])].filter(Boolean)));
  }

  private resolveSourceModel(entry: any): string {
    const responseModel = entry?.cdssResponsePayload?.model;
    if (typeof responseModel === 'string' && responseModel.trim()) {
      return responseModel.trim();
    }
    return this.normalizeDecisionModelName(entry?.decisionType);
  }

  private resolveClaimModelName(entry: any): string {
    const sourceModel = entry?.source_model;
    if (typeof sourceModel === 'string' && sourceModel.trim()) {
      return sourceModel.trim();
    }
    return this.normalizeDecisionModelName(entry?.decision_type);
  }

  private normalizeDecisionModelName(decisionType: unknown): string {
    const normalized = String(decisionType || '').trim().toLowerCase();
    switch (normalized) {
      case 'risk':
      case 'deterioration':
      case 'early_warning':
        return 'deterioration';
      case 'readmission':
        return 'readmission';
      case 'sepsis_alert':
      case 'sepsis':
        return 'sepsis';
      case 'no_show':
        return 'no_show';
      default:
        return normalized || 'unknown';
    }
  }
}
