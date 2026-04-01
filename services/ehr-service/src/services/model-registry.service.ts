import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantService } from './tenant.service';
import { ModelRegistry } from '../entities/model-registry.entity';
import { ModelPerformanceMetric } from '../entities/model-performance-metric.entity';
import { ModelFairnessReport } from '../entities/model-fairness-report.entity';
import { ModelPromotionReview } from '../entities/model-promotion-review.entity';
import { ModelCard } from '../entities/model-card.entity';
import { ModelShadowEvaluation } from '../entities/model-shadow-evaluation.entity';
import { OutcomeLearningJob } from '../entities/outcome-learning-job.entity';
import { CdssService } from './cdss.service';

export interface PromotionReviewRequest {
  requestedStage?: 'shadow' | 'canary' | 'production';
  requestedBy?: string;
  decisionBy?: string;
  decisionNotes?: string;
  shadowValidationPassed?: boolean;
  rollbackReady?: boolean;
  clinicalApproval?: boolean;
}

export interface ShadowEvaluationReviewRequest {
  decision: 'approve' | 'reject';
  requestedStage?: 'canary' | 'production';
  decisionBy: string;
  decisionNotes?: string;
  rollbackReady?: boolean;
  clinicalApproval?: boolean;
}

type PromotionGateSummary = Record<string, string | number | boolean | null>;

@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);
  private static readonly MIN_AUC = 0.55;
  private static readonly MIN_AUC_IMPROVEMENT = 0.01;
  private static readonly MAX_BRIER_SCORE = 0.25;

  // AUC of the current production model per name — cached to avoid DB hit on every prediction
  private productionAuc = new Map<string, number>();

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Registration ───────────────────────────────────────────────────────────

  async register(subdomain: string, dto: {
    modelName: string;
    roundId?: string;
    minioPath: string;
    aucRoc?: number;
    brierScore?: number;
    sampleCount?: number;
    tenantCount?: number;
    modelHash?: string;
    featureNames?: string[];
    framework?: string;
  }): Promise<ModelRegistry> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ModelRegistry);
    const cardRepo = ds.getRepository(ModelCard);

    // Determine next version number
    const latest = await repo.findOne({
      where: { modelName: dto.modelName },
      order: { createdAt: 'DESC' },
    });
    const nextVersion = latest
      ? `v${parseInt(latest.version.replace('v', ''), 10) + 1}`
      : 'v1';

    const saved = await repo.save(repo.create({
      modelName: dto.modelName,
      version: nextVersion,
      roundId: dto.roundId,
      minioPath: dto.minioPath,
      aucRoc: dto.aucRoc,
      brierScore: dto.brierScore,
      sampleCount: dto.sampleCount || 0,
      tenantCount: dto.tenantCount || 0,
      modelHash: dto.modelHash,
      featureNames: dto.featureNames || [],
      framework: dto.framework || 'sklearn',
      status: 'staging',
      deploymentStage: 'development',
      promotionBlockedReason: null,
    }));

    await this.upsertModelCard(cardRepo, saved, {
      deploymentStage: 'development',
      trainingSummary: {
        roundId: dto.roundId || null,
        sampleCount: dto.sampleCount || 0,
        tenantCount: dto.tenantCount || 0,
        framework: dto.framework || 'sklearn',
      },
      evaluationSummary: {
        aucRoc: dto.aucRoc ?? null,
        brierScore: dto.brierScore ?? null,
      },
      governanceSummary: {
        registeredAt: new Date().toISOString(),
        registrationSource: dto.roundId ? 'federated_learning' : 'local_ml',
      },
    });

    return saved;
  }

  // ── Promotion ──────────────────────────────────────────────────────────────

  async evaluateAndPromote(
    subdomain: string,
    registryId: string,
    reviewRequest?: PromotionReviewRequest,
  ): Promise<{
    promoted: boolean;
    reason: string;
    model?: ModelRegistry;
    review?: ModelPromotionReview;
    gates?: PromotionGateSummary;
  }> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ModelRegistry);
    const performanceRepo = ds.getRepository(ModelPerformanceMetric);
    const fairnessRepo = ds.getRepository(ModelFairnessReport);
    const reviewRepo = ds.getRepository(ModelPromotionReview);

    const candidate = await repo.findOneBy({ id: registryId });
    if (!candidate) return { promoted: false, reason: 'Model not found' };

    const requestedStage = reviewRequest?.requestedStage || 'production';
    const current = await this.getCurrentProduction(subdomain, candidate.modelName);
    const currentAuc = current?.aucRoc ?? 0;
    const candidateAuc = candidate.aucRoc ?? null;
    const improvement = candidateAuc === null ? null : candidateAuc - currentAuc;
    const latestPerformance = await performanceRepo.findOne({
      where: { modelName: candidate.modelName },
      order: { computedAt: 'DESC' },
    });
    const latestFairness = await fairnessRepo.findOne({
      where: { modelName: candidate.modelName },
      order: { computedAt: 'DESC' },
    });

    const calibrationPassed = this.meetsCalibrationGate(candidate, latestPerformance);
    const fairnessPassed = latestFairness ? !latestFairness.fairnessFlag : false;
    const aucPassed = candidateAuc !== null && candidateAuc >= ModelRegistryService.MIN_AUC;
    const improvementPassed = !current || (improvement !== null && improvement >= ModelRegistryService.MIN_AUC_IMPROVEMENT);
    const shadowValidationPassed = !!reviewRequest?.shadowValidationPassed;
    const rollbackReady = !!reviewRequest?.rollbackReady;
    const clinicalApproval = !!reviewRequest?.clinicalApproval;

    const gateSummary = {
      requestedStage,
      candidateAuc,
      currentAuc,
      improvement,
      aucPassed,
      improvementPassed,
      calibrationPassed,
      fairnessPassed,
      shadowValidationPassed,
      rollbackReady,
      clinicalApproval,
      latestBrierScore: candidate.brierScore ?? latestPerformance?.brierScore ?? null,
      fairnessFlag: latestFairness?.fairnessFlag ?? null,
    };

    const unmetGates = this.resolveUnmetGates(requestedStage, gateSummary);
    const blockedReason = unmetGates.length
      ? `Governed promotion blocked: ${unmetGates.join('; ')}`
      : null;

    const reviewStatus =
      requestedStage === 'shadow'
        ? 'approved'
        : unmetGates.length
          ? (aucPassed ? 'pending_review' : 'rejected')
          : 'approved';

    const review = await reviewRepo.save(reviewRepo.create({
      modelRegistryId: candidate.id,
      modelName: candidate.modelName,
      candidateVersion: candidate.version,
      requestedStage,
      reviewStatus,
      requestedBy: reviewRequest?.requestedBy || 'manual',
      decisionBy: reviewRequest?.decisionBy || null,
      decisionNotes: reviewRequest?.decisionNotes || blockedReason,
      metricSummary: gateSummary,
      shadowValidationPassed,
      calibrationPassed,
      fairnessPassed,
      rollbackReady,
      clinicalApproval,
      decidedAt: reviewStatus === 'pending_review' ? null : new Date(),
    }));

    if (requestedStage === 'shadow') {
      await repo.update(registryId, {
        status: 'staging',
        deploymentStage: 'shadow',
        promotionBlockedReason: reviewRequest?.decisionNotes || 'Shadow evaluation required before canary or production',
      });
      const staged = await repo.findOneBy({ id: registryId });
      await this.syncModelCard(subdomain, staged!, review, gateSummary);
      return {
        promoted: false,
        reason: 'Model staged for governed shadow evaluation',
        model: staged!,
        review,
        gates: gateSummary,
      };
    }

    if (requestedStage === 'canary') {
      if (unmetGates.length) {
        await repo.update(registryId, {
          status: aucPassed ? 'staging' : 'rejected',
          deploymentStage: 'shadow',
          promotionBlockedReason: blockedReason,
        });
        const staged = await repo.findOneBy({ id: registryId });
        await this.syncModelCard(subdomain, staged!, review, gateSummary);
        return { promoted: false, reason: blockedReason!, model: staged!, review, gates: gateSummary };
      }

      await repo.update(registryId, {
        status: 'staging',
        deploymentStage: 'canary',
        promotionBlockedReason: null,
      });
      const canary = await repo.findOneBy({ id: registryId });
      await this.syncModelCard(subdomain, canary!, review, gateSummary);
      return {
        promoted: false,
        reason: 'Model approved for governed canary stage; production promotion still requires an explicit production approval request',
        model: canary!,
        review,
        gates: gateSummary,
      };
    }

    if (unmetGates.length) {
      await repo.update(registryId, {
        status: aucPassed ? 'staging' : 'rejected',
        deploymentStage: aucPassed ? 'shadow' : 'development',
        promotionBlockedReason: blockedReason,
      });
      const staged = await repo.findOneBy({ id: registryId });
      await this.syncModelCard(subdomain, staged!, review, gateSummary);
      return { promoted: false, reason: blockedReason!, model: staged!, review, gates: gateSummary };
    }

    if (current) {
      await repo.update(current.id, { status: 'retired', retiredAt: new Date() });
    }

    await repo.update(registryId, {
      status: 'production',
      deploymentStage: 'production',
      promotionBlockedReason: null,
      promotedAt: new Date(),
    });

    await this.notifyCdssPromote(candidate.modelName, candidate.minioPath).catch(e =>
      this.logger.warn(`CDSS promote notification failed: ${e?.message}`));

    if (candidateAuc !== null) {
      this.productionAuc.set(candidate.modelName, candidateAuc);
    }

    this.logger.log(
      `Model ${candidate.modelName} ${candidate.version} promoted to production with governed approval ` +
      `(AUC ${candidateAuc?.toFixed(3) ?? 'n/a'}, improvement ${improvement !== null ? `${(improvement * 100).toFixed(2)}%` : 'n/a'})`
    );

    const promoted = await repo.findOneBy({ id: registryId });
    await this.syncModelCard(subdomain, promoted!, review, gateSummary);
    return {
      promoted: true,
      reason: 'Promoted via governed review with calibration, fairness, shadow validation, rollback readiness, and clinical approval gates satisfied',
      model: promoted!,
      review,
      gates: gateSummary,
    };
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async getCurrentProduction(subdomain: string, modelName: string): Promise<ModelRegistry | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelRegistry).findOne({
      where: { modelName, status: 'production' },
    });
  }

  async getHistory(subdomain: string, modelName: string): Promise<ModelRegistry[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelRegistry).find({
      where: { modelName },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async getAllProduction(subdomain: string): Promise<ModelRegistry[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelRegistry).find({ where: { status: 'production' } });
  }

  async getModelCards(subdomain: string): Promise<ModelCard[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelCard).find({
      order: { updatedAt: 'DESC' },
      take: 50,
    });
  }

  async getModelCard(subdomain: string, modelName: string): Promise<ModelCard | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelCard).findOne({
      where: { modelName },
    });
  }

  async getShadowEvaluations(subdomain: string, modelName?: string): Promise<ModelShadowEvaluation[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelShadowEvaluation).find({
      where: modelName ? { modelName } : {},
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async reviewShadowEvaluation(
    subdomain: string,
    evaluationId: string,
    review: ShadowEvaluationReviewRequest,
  ): Promise<{
    approved: boolean;
    reason: string;
    evaluation?: ModelShadowEvaluation | null;
    promotion?: {
      promoted: boolean;
      reason: string;
      deploymentStage?: string | null;
      reviewId?: string | null;
    };
  }> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const shadowRepo = ds.getRepository(ModelShadowEvaluation);
    const jobRepo = ds.getRepository(OutcomeLearningJob);
    const evaluation = await shadowRepo.findOneBy({ id: evaluationId });
    if (!evaluation) {
      return { approved: false, reason: 'Shadow evaluation not found', evaluation: null };
    }

    const now = new Date();
    const reviewSummary = {
      decision: review.decision,
      decisionBy: review.decisionBy,
      decisionNotes: review.decisionNotes || null,
      requestedStage: review.requestedStage || 'canary',
      rollbackReady: !!review.rollbackReady,
      clinicalApproval: !!review.clinicalApproval,
      reviewedAt: now.toISOString(),
    };

    if (review.decision === 'reject') {
      await shadowRepo.update(evaluation.id, {
        evaluationStatus: 'review_rejected',
        decisionNotes: review.decisionNotes || 'Shadow evaluation was rejected by governance review',
        completedAt: now,
        summary: {
          ...(evaluation.summary || {}),
          review: reviewSummary,
        } as any,
      });
      await this.updateOutcomeLearningJobs(
        jobRepo,
        evaluation.sourceJobIds || [],
        'review_rejected',
        `Shadow evaluation ${evaluation.id} was rejected by ${review.decisionBy}`,
        true,
      );
      return {
        approved: false,
        reason: 'Shadow evaluation rejected',
        evaluation: await shadowRepo.findOneBy({ id: evaluation.id }),
      };
    }

    if (!evaluation.candidateRegistryId) {
      await shadowRepo.update(evaluation.id, {
        evaluationStatus: 'review_blocked',
        decisionNotes: review.decisionNotes || 'Shadow evaluation cannot be approved before a candidate registry entry exists',
        summary: {
          ...(evaluation.summary || {}),
          review: reviewSummary,
        } as any,
      });
      return {
        approved: false,
        reason: 'Shadow evaluation has no candidate registry entry to promote',
        evaluation: await shadowRepo.findOneBy({ id: evaluation.id }),
      };
    }

    const promotion = await this.evaluateAndPromote(subdomain, evaluation.candidateRegistryId, {
      requestedStage: review.requestedStage || 'canary',
      requestedBy: 'shadow-evaluation-review',
      decisionBy: review.decisionBy,
      decisionNotes: review.decisionNotes || 'Shadow evaluation approved by governed operator review',
      shadowValidationPassed: true,
      rollbackReady: !!review.rollbackReady,
      clinicalApproval: !!review.clinicalApproval,
    });

    const deploymentStage = promotion.model?.deploymentStage || null;
    const approvedForStage = deploymentStage === 'canary' || deploymentStage === 'production';
    const nextEvaluationStatus = approvedForStage
      ? deploymentStage === 'production'
        ? 'production_approved'
        : 'canary_approved'
      : 'promotion_blocked';

    await shadowRepo.update(evaluation.id, {
      candidateRegistryId: promotion.model?.id || evaluation.candidateRegistryId,
      candidateVersion: promotion.model?.version || evaluation.candidateVersion,
      evaluationStatus: nextEvaluationStatus,
      decisionNotes: promotion.reason,
      completedAt: approvedForStage ? now : null,
      summary: {
        ...(evaluation.summary || {}),
        review: reviewSummary,
        promotion: {
          promoted: promotion.promoted,
          reason: promotion.reason,
          deploymentStage,
          reviewId: promotion.review?.id || null,
          gates: promotion.gates || {},
        },
      } as any,
    });

    if (approvedForStage) {
      await this.updateOutcomeLearningJobs(
        jobRepo,
        evaluation.sourceJobIds || [],
        'shadow_reviewed',
        `Shadow evaluation ${evaluation.id} approved for ${deploymentStage} by ${review.decisionBy}`,
        true,
      );
    }

    return {
      approved: approvedForStage,
      reason: promotion.reason,
      evaluation: await shadowRepo.findOneBy({ id: evaluation.id }),
      promotion: {
        promoted: promotion.promoted,
        reason: promotion.reason,
        deploymentStage,
        reviewId: promotion.review?.id || null,
      },
    };
  }

  // ── Manual rollback ────────────────────────────────────────────────────────

  async rollback(subdomain: string, modelName: string): Promise<ModelRegistry | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ModelRegistry);

    const current = await repo.findOne({ where: { modelName, status: 'production' } });
    const previous = await repo.findOne({
      where: { modelName, status: 'retired' },
      order: { retiredAt: 'DESC' },
    });

    if (!previous) return null;

    if (current) {
      await repo.update(current.id, {
        status: 'rolled_back',
        deploymentStage: 'rolled_back',
        retiredAt: new Date(),
        promotionBlockedReason: 'Rolled back by governed operator action',
      });
    }
    await repo.update(previous.id, {
      status: 'production',
      deploymentStage: 'production',
      promotedAt: new Date(),
      retiredAt: null as any,
      promotionBlockedReason: null,
    });

    await this.notifyCdssPromote(modelName, previous.minioPath).catch(() => {});
    await this.syncModelCard(subdomain, await repo.findOneBy({ id: previous.id }), null, {
      requestedStage: 'production',
      candidateAuc: previous.aucRoc ?? null,
      currentAuc: previous.aucRoc ?? null,
      improvement: null,
      aucPassed: true,
      improvementPassed: true,
      calibrationPassed: true,
      fairnessPassed: true,
      shadowValidationPassed: true,
      rollbackReady: true,
      clinicalApproval: true,
      latestBrierScore: previous.brierScore ?? null,
      fairnessFlag: false,
      rollbackApplied: true,
    });

    this.logger.warn(`Model ${modelName} rolled back to ${previous.version}`);
    return repo.findOneBy({ id: previous.id });
  }

  // ── CDSS notify ────────────────────────────────────────────────────────────

  private async notifyCdssPromote(modelName: string, minioPath: string): Promise<void> {
    await this.cdssService.loadCdssModel(modelName, minioPath);
  }

  private meetsCalibrationGate(
    candidate: ModelRegistry,
    latestPerformance: ModelPerformanceMetric | null,
  ): boolean {
    const candidateBrier = candidate.brierScore;
    if (typeof candidateBrier === 'number') {
      return candidateBrier <= ModelRegistryService.MAX_BRIER_SCORE;
    }
    const observedBrier = latestPerformance?.brierScore;
    return typeof observedBrier === 'number' && observedBrier <= ModelRegistryService.MAX_BRIER_SCORE;
  }

  private resolveUnmetGates(
    requestedStage: string,
    gates: PromotionGateSummary,
  ): string[] {
    if (requestedStage === 'shadow') {
      return [];
    }

    const unmet: string[] = [];
    if (!gates.aucPassed) {
      unmet.push(`AUC ${(gates.candidateAuc as number | null)?.toFixed?.(3) ?? 'n/a'} below minimum ${ModelRegistryService.MIN_AUC.toFixed(2)}`);
    }
    if (!gates.improvementPassed) {
      unmet.push(`AUC improvement ${typeof gates.improvement === 'number' ? `${(gates.improvement * 100).toFixed(2)}%` : 'n/a'} below required ${(ModelRegistryService.MIN_AUC_IMPROVEMENT * 100).toFixed(0)}%`);
    }
    if (!gates.calibrationPassed) {
      unmet.push('calibration gate failed or no qualifying Brier score was recorded');
    }
    if (!gates.fairnessPassed) {
      unmet.push('fairness gate failed or no fairness report is available');
    }
    if (!gates.shadowValidationPassed) {
      unmet.push('shadow validation has not been explicitly approved');
    }
    if (!gates.rollbackReady) {
      unmet.push('rollback readiness was not confirmed');
    }
    if (!gates.clinicalApproval) {
      unmet.push('clinical approval is required before promotion');
    }
    return unmet;
  }

  private async syncModelCard(
    subdomain: string,
    registry: ModelRegistry | null,
    review: ModelPromotionReview | null,
    gateSummary: PromotionGateSummary,
  ): Promise<void> {
    if (!registry) return;
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const cardRepo = ds.getRepository(ModelCard);
    await this.upsertModelCard(cardRepo, registry, {
      deploymentStage: registry.deploymentStage,
      trainingSummary: {
        roundId: registry.roundId || null,
        sampleCount: registry.sampleCount || 0,
        tenantCount: registry.tenantCount || 0,
        framework: registry.framework || 'sklearn',
      },
      evaluationSummary: {
        aucRoc: registry.aucRoc ?? null,
        brierScore: registry.brierScore ?? null,
        latestReviewId: review?.id || null,
      },
      governanceSummary: {
        latestReviewId: review?.id || null,
        reviewStatus: review?.reviewStatus || null,
        requestedStage: review?.requestedStage || gateSummary.requestedStage || null,
        blockedReason: registry.promotionBlockedReason || null,
        gates: gateSummary,
      },
      lastReviewedAt: review?.decidedAt || new Date(),
    });
  }

  private async upsertModelCard(
    cardRepo: any,
    registry: ModelRegistry,
    payload: {
      deploymentStage: string;
      trainingSummary: Record<string, any>;
      evaluationSummary: Record<string, any>;
      governanceSummary: Record<string, any>;
      lastReviewedAt?: Date | null;
    },
  ): Promise<void> {
    const existing = await cardRepo.findOne({
      where: { modelName: registry.modelName },
    });
    const modelFamily = registry.roundId ? 'federated_learning' : 'local_ml';
    const values = {
      modelName: registry.modelName,
      modelFamily,
      latestRegistryId: registry.id,
      currentVersion: registry.version,
      deploymentStage: payload.deploymentStage,
      intendedUse: `Governed clinical decision support for ${registry.modelName}`,
      limitations: 'Requires governed review, calibration checks, fairness review, and human authorization before production use.',
      clinicalScope: registry.modelName,
      trainingSummary: payload.trainingSummary,
      evaluationSummary: payload.evaluationSummary,
      governanceSummary: payload.governanceSummary,
      lastReviewedAt: payload.lastReviewedAt || null,
    };
    if (existing) {
      await cardRepo.update(existing.id, values);
      return;
    }
    await cardRepo.save(cardRepo.create(values));
  }

  private async updateOutcomeLearningJobs(
    repo: any,
    jobIds: string[],
    jobStatus: string,
    processingNotes: string,
    markCompleted = false,
  ): Promise<void> {
    if (!jobIds.length) {
      return;
    }
    await repo.update(
      { id: In(jobIds) },
      {
        jobStatus,
        processingNotes,
        queuedAt: new Date(),
        completedAt: markCompleted ? new Date() : null,
      },
    );
  }
}
