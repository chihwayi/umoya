import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CdssService } from './cdss.service';
import { ClaimRiskScore } from '../entities/claim-risk-score.entity';
import { ClaimAppeal } from '../entities/claim-appeal.entity';
import { FinancialHardshipReferral } from '../entities/financial-hardship-referral.entity';
import { PdmpCheck } from '../entities/pdmp-check.entity';
import { AiSurfaceContractService } from './ai-surface-contract.service';

export interface ClaimPayload {
  claimId: string;
  patientId: string;
  encounterId?: string;
  procedureCodes: string[];
  diagnosisCodes: string[];
  totalAmount: number;
  planType: string;
  hasPreAuthorization: boolean;
  isInpatient: boolean;
  patientAge: number;
  priorDenialCount12m: number;
  providerSpecialty: string;
  modifiers?: string[];
  referralCode?: string;
  daysSinceLastClaim?: number;
}

@Injectable()
export class ClaimsAiService {
  private readonly logger = new Logger(ClaimsAiService.name);
  private readonly WARN_THRESHOLD = 0.70;
  private readonly BLOCK_THRESHOLD = 0.90;

  constructor(
    private readonly cdssService: CdssService,
    private readonly aiSurfaceContractService: AiSurfaceContractService,
  ) {}

  async scoreClaimBeforeSubmission(
    claim: ClaimPayload,
    tenantId: string,
    tenantDb: DataSource,
  ): Promise<{
    allowed: boolean;
    action: 'allow' | 'warn' | 'block';
    riskScore: ClaimRiskScore;
    aiMetadata: Record<string, any>;
  }> {
    const cdssPayload = {
      procedure_codes: claim.procedureCodes,
      diagnosis_codes: claim.diagnosisCodes,
      total_amount: claim.totalAmount,
      plan_type: claim.planType,
      has_pre_authorization: claim.hasPreAuthorization,
      is_inpatient: claim.isInpatient,
      patient_age: claim.patientAge,
      prior_denial_count_12m: claim.priorDenialCount12m,
      provider_specialty: claim.providerSpecialty,
      modifiers: claim.modifiers ?? [],
      referral_code: claim.referralCode ?? null,
      days_since_last_claim: claim.daysSinceLastClaim ?? 999,
    };

    const result = await this.cdssService.predictClaimDenial(cdssPayload, tenantId, tenantDb);

    const riskScoreRepo = tenantDb.getRepository(ClaimRiskScore);
    const score = riskScoreRepo.create({
      claimId: claim.claimId,
      patientId: claim.patientId,
      encounterId: claim.encounterId ?? null,
      riskScore: result.risk_score,
      confidence: result.confidence,
      topReasons: result.top_reasons,
      modelVersion: result.model_version,
      featureSnapshot: result.feature_snapshot,
      thresholdAction: result.threshold_action,
    });
    await riskScoreRepo.save(score);

    const aiMetadata = await this.aiSurfaceContractService.recordExecution({
      tenantDb,
      tenantId,
      aiSurface: 'claims_ai',
      useCase: 'claims_denial_prediction',
      source: 'claims_ai_service.scoreClaimBeforeSubmission',
      modelId: result.model_version,
      modelVersion: result.model_version,
      patientId: claim.patientId,
      encounterId: claim.encounterId ?? null,
      responseSummary: { riskScore: result.risk_score, thresholdAction: result.threshold_action },
    }).catch((e: any) => {
      this.logger.warn(`AI surface audit recording failed for claim ${claim.claimId}: ${e?.message}`);
      return this.aiSurfaceContractService.buildSurfaceMetadata({
        aiSurface: 'claims_ai', useCase: 'claims_denial_prediction', source: 'claims_ai_service.scoreClaimBeforeSubmission',
        modelId: result.model_version, modelVersion: result.model_version, provider: 'local', recorded: false,
      });
    });

    if (result.threshold_action !== 'allow' && claim.totalAmount > 10000) {
      await this.createHardshipReferral(claim.patientId, claim.claimId, tenantId, 'high_risk_claim', tenantDb);
    }

    return {
      allowed: result.threshold_action !== 'block',
      action: result.threshold_action,
      riskScore: score,
      aiMetadata,
    };
  }

  async overrideBlock(riskScoreId: string, userId: string, reason: string, tenantDb: DataSource): Promise<void> {
    if (reason.length < 30) {
      throw new BadRequestException('Override reason must be at least 30 characters');
    }
    await tenantDb.getRepository(ClaimRiskScore).update(riskScoreId, {
      thresholdAction: 'allow',
      overrideReason: reason,
      overrideUserId: userId,
    });
  }

  async generateAppealTemplate(
    claimId: string,
    patientId: string,
    denialReasonCode: string,
    claimDetails: Record<string, unknown>,
    tenantId: string,
    tenantDb: DataSource,
  ): Promise<ClaimAppeal> {
    const result = await this.cdssService.generateAppealTemplateCdss({
      claim_id: claimId,
      denial_reason_code: denialReasonCode,
      ...claimDetails,
    }, tenantId, tenantDb);

    const appealRepo = tenantDb.getRepository(ClaimAppeal);
    const appeal = appealRepo.create({
      claimId,
      patientId,
      denialReasonCode,
      denialReasonDescription: result.denial_reason_code,
      draftLetter: result.draft_letter,
      ragSources: result.rag_sources ?? [],
      status: 'draft',
    });
    const savedAppeal = await appealRepo.save(appeal);
    (savedAppeal as any).aiMetadata = await this.aiSurfaceContractService.recordExecution({
      tenantDb,
      tenantId,
      aiSurface: 'claims_ai',
      useCase: 'claims_appeal_generation',
      source: 'claims_ai_service.generateAppealTemplate',
      modelId: result.model_version,
      modelVersion: result.model_version,
      patientId,
      responseSummary: { denialReasonCode, ragSourceCount: (result.rag_sources ?? []).length },
    }).catch((e: any) => {
      this.logger.warn(`AI surface audit recording failed for claim ${claimId}: ${e?.message}`);
      return this.aiSurfaceContractService.buildSurfaceMetadata({
        aiSurface: 'claims_ai', useCase: 'claims_appeal_generation', source: 'claims_ai_service.generateAppealTemplate',
        modelId: result.model_version, modelVersion: result.model_version, provider: 'local', recorded: false,
      });
    });
    return savedAppeal as ClaimAppeal;
  }

  async recordClaimOutcome(
    claimId: string,
    outcome: 'approved' | 'denied' | 'partial' | 'appealed',
    tenantDb: DataSource,
  ): Promise<void> {
    await tenantDb.getRepository(ClaimRiskScore).update(
      { claimId },
      { actualOutcome: outcome, feedbackRecordedAt: new Date() },
    );
    this.logger.log(`Claim outcome recorded: claimId=${claimId} outcome=${outcome}`);
  }

  async checkPdmp(
    patientId: string,
    prescriberId: string,
    drugName: string,
    deaSchedule: string | null,
    dailyDoseMg: number,
    tenantId: string,
    tenantDb: DataSource,
  ): Promise<PdmpCheck> {
    const result = await this.cdssService.checkPdmpDrug({
      drug_name: drugName,
      dea_schedule: deaSchedule,
      daily_dose_mg: dailyDoseMg,
      other_active_controlled_prescriptions: [],
      prior_substance_abuse_flags: [],
    }, tenantId, tenantDb);

    const pdmpRepo = tenantDb.getRepository(PdmpCheck);
    const check = pdmpRepo.create({
      patientId,
      prescriberId,
      drugName,
      deaSchedule: deaSchedule ?? null,
      morphineMilligramEquivalent: result.morphine_milligram_equivalent ?? null,
      riskLevel: result.risk_level as any,
      prescriberAlerts: result.prescriber_alerts,
      otherActivePrescriptions: result.other_active_prescriptions,
      dispensingBlocked: result.dispensing_blocked,
    });
    const saved = await pdmpRepo.save(check);
    (saved as any).aiMetadata = await this.aiSurfaceContractService.recordExecution({
      tenantDb,
      tenantId,
      aiSurface: 'claims_ai',
      useCase: 'pharmacy_pdmp_check',
      source: 'claims_ai_service.checkPdmp',
      modelId: 'pharmacy_pdmp_check_proxy',
      modelVersion: 'pharmacy_pdmp_check_proxy',
      patientId,
      responseSummary: { riskLevel: result.risk_level, dispensingBlocked: result.dispensing_blocked },
    }).catch((e: any) => {
      this.logger.warn(`AI surface audit recording failed for PDMP check ${saved.id}: ${e?.message}`);
      return this.aiSurfaceContractService.buildSurfaceMetadata({
        aiSurface: 'claims_ai', useCase: 'pharmacy_pdmp_check', source: 'claims_ai_service.checkPdmp',
        modelId: 'pharmacy_pdmp_check_proxy', modelVersion: 'pharmacy_pdmp_check_proxy', provider: 'local', recorded: false,
      });
    });

    if (result.dispensing_blocked) {
      throw new BadRequestException({
        code: 'PDMP_BLOCK',
        message: result.cdss_recommendation,
        pdmpCheckId: saved.id,
        alerts: result.prescriber_alerts,
        aiMetadata: (saved as any).aiMetadata,
      });
    }

    return saved;
  }

  private async createHardshipReferral(
    patientId: string,
    claimId: string,
    tenantId: string,
    triggerReason: string,
    tenantDb: DataSource,
  ): Promise<void> {
    const hardshipRepo = tenantDb.getRepository(FinancialHardshipReferral);
    const existing = await hardshipRepo.findOne({ where: { patientId, claimId } });
    if (existing) return;

    let programsMatched: any[] = [];
    let aiRecommendation: string | null = null;
    try {
      const result = await this.cdssService.requestGovernedJson(
        {
          useCase: 'financial_hardship',
          schemaDescription: 'List of financial assistance programs matched for the patient',
          patientId,
          messages: [{ role: 'user', content: `Match financial assistance programs for patient. Trigger: ${triggerReason}` }],
        },
        tenantId,
        tenantDb,
      );
      programsMatched = (result as any)?.programs_matched ?? [];
      aiRecommendation = (result as any)?.ai_recommendation ?? null;
    } catch {
      // non-critical — referral still created
    }

    const referral = hardshipRepo.create({
      patientId,
      claimId,
      triggerReason,
      programsMatched,
      aiRecommendation,
      status: 'pending',
    });
    await hardshipRepo.save(referral);
  }
}
