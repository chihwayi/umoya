import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { createHash } from 'crypto';
import { config, env } from '@umoya/config';
import {
  CuratePostVisitCompanionMemoryDto,
  CreatePostVisitSessionDto,
  ExecutePostVisitVoiceCommandDto,
  GeneratePostVisitAdminDocumentsDto,
  ReviewPostVisitTrialMatchDto,
  ReviewPostVisitBillingSuggestionDto,
  ExecutePostVisitRecommendationDto,
  ReviewPostVisitArtifactDto,
} from '../dto/post-visit.dto';
import {
  TranscriptionResult,
  TranscriptionService,
  TranscriptionOptions,
  TranscriptionRequestContext,
} from './transcription.service';
import { PatientService } from './patient.service';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { PatientNotificationsService } from './patient-notifications.service';
import {
  GroundingCitation,
  LlmAuditMetadata,
  PostVisitEscalationClassifierOutput,
  PostVisitGroundedLlmService,
} from './post-visit-grounded-llm.service';
import { HipaaAuditService, HipaaAuditAction } from './hipaa-audit.service';
import { FileStorageService } from './file-storage.service';
import {
  getValidationSummary,
  type PostVisitSoapSpecialty,
  type SpecialtySoapValidationSummary,
} from './soap-template-registry';
import { PostVisitEscalationService } from './post-visit-escalation.service';
import { PostVisitEscalationRoutingService, EscalationSignal } from './post-visit-escalation-routing.service';
import { PostVisitBillingIntelligenceService } from './post-visit-billing-intelligence.service';
import { PostVisitCompanionMemoryService } from './post-visit-companion-memory.service';
import { PostVisitSessionService } from './post-visit-session.service';
import { PostVisitDraftService } from './post-visit-draft.service';
import { detectFromTranscript as realTimeAlertEngineDetect } from './real-time-alert-engine';
import { PostVisitSession } from '../entities/post-visit-session.entity';
import { PatientAiSession } from '../entities/patient-ai-session.entity';
import { PatientAiEscalation } from '../entities/patient-ai-escalation.entity';
import { PatientFollowupOrchestration } from '../entities/patient-followup-orchestration.entity';
import { annotateTextWithEntities, AnnotatedSpan } from '../utils/entity-annotation';

type PostVisitSessionStatus =
  | 'captured'
  | 'processing'
  | 'draft_ready'
  | 'doctor_reviewed'
  | 'published'
  | 'closed';

interface ExtractedEntityInput {
  entityType: string;
  entityValue: string;
  normalizedValue?: Record<string, any>;
  confidence?: number | null;
  sourceStartSecond?: number | null;
  sourceEndSecond?: number | null;
  sourceOrigin?: string;
  metadata?: Record<string, any>;
}

interface IngestTranscriptionOptions {
  tenantId?: string;
  actorUserId?: string | null;
  source?: string;
}

interface GenerateDraftOptions {
  tenantId?: string;
  actorUserId?: string | null;
  source?: string;
  reason?: string;
}

interface ExecuteRecommendationOptions {
  tenantId?: string;
  actorUserId?: string | null;
  source?: string;
}

interface RuleCitation {
  guidelineId: string;
  label: string;
  source: string;
  url?: string;
  excerpt?: string;
  confidence?: number;
  relevanceScore?: number;
  publicationYear?: number | null;
  isSuperseded?: boolean;
  supersededByGuidelineId?: string | null;
}

interface RecommendationRuleResult {
  ruleId: string;
  recommendationId: string;
  title: string;
  description: string;
  urgency: 'routine' | 'urgent' | 'stat';
  actionType: 'follow_up' | 'lab_order' | 'referral' | 'monitoring' | 'medication';
  confidence: number;
  citations: RuleCitation[];
  context: Record<string, any>;
}

interface PublishSessionOptions {
  tenantId?: string;
  actorUserId?: string | null;
  source?: string;
}

type PostVisitDocumentType = 'lab_report' | 'prescription' | 'imaging_report' | 'discharge_summary' | 'other';
type PostVisitAdminDocumentType = 'referral_letter' | 'sick_note' | 'return_to_work';
type PostVisitVoiceCommand =
  | 'APPROVE_SUMMARY'
  | 'APPROVE_BUNDLE'
  | 'GENERATE_ADMIN_DOCS'
  | 'REGENERATE_DRAFT'
  | 'SIGN_AND_PUBLISH';
type PostVisitTrialMatchStatus = 'proposed' | 'considered' | 'deferred' | 'excluded' | 'enrolled';
type PostVisitTrialReviewAction = 'consider' | 'defer' | 'exclude' | 'enroll';
type PostVisitCompanionMemoryCurationAction = 'promote' | 'retire' | 'reactivate';
type PostVisitEscalationSeverity = 'low' | 'moderate' | 'high' | 'critical';
type TrialSlaNotificationSeverity = 'moderate' | 'high' | 'critical';

interface PostVisitDocumentObservation {
  name: string;
  value: number;
  unit?: string | null;
  referenceRange?: string | null;
  interpretation?: string | null;
}

interface PostVisitMedicationMention {
  medicationName: string;
  dose?: string | null;
  frequency?: string | null;
  route?: string | null;
}

interface PostVisitDocumentIntelligenceModel {
  documentType: PostVisitDocumentType;
  summary: string;
  observations: PostVisitDocumentObservation[];
  medications: PostVisitMedicationMention[];
  findings: string[];
}

interface PostVisitDocumentCriticalFlag {
  code: string;
  label: string;
  severity: 'moderate' | 'high' | 'critical';
  value: number;
  unit?: string | null;
  threshold: string;
}

type IntraVisitAlertSeverity = 'moderate' | 'high' | 'critical';
type IntraVisitAlertStatus = 'open' | 'confirmed' | 'dismissed';
type IntraVisitAlertRouteTarget = 'doctor' | 'nurse' | 'emergency';
type IntraVisitAlertAssignedRole = 'doctor' | 'nurse' | 'rapid_response';

interface IntraVisitAlertDraft {
  alertType: string;
  severity: IntraVisitAlertSeverity;
  alertMessage: string;
  suggestedAction: string;
  confidence: number;
  triggerTerms?: string[];
  metadata?: Record<string, any>;
}

interface IntraVisitRoutingDecision {
  routeTarget: IntraVisitAlertRouteTarget;
  assignedRole: IntraVisitAlertAssignedRole;
  assignedUserId: string | null;
  assignedTeam: string | null;
  routingRationale: string;
  policyVersion: 'c3.v1';
  slaDueAt: Date | null;
}

type MedicationRiskSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

interface MedicationNormalizationRecord {
  inputName: string;
  normalizedName: string;
  rxCui: string | null;
  source: 'rxnorm_dictionary' | 'heuristic' | 'unknown';
}

interface MedicationInteractionSignal {
  pair: [string, string];
  severity: MedicationRiskSeverity;
  rationale: string;
  guidelineId: string;
}

interface MedicationBeersSignal {
  medication: string;
  severity: 'major' | 'moderate';
  rationale: string;
}

interface MedicationRenalSignal {
  medication: string;
  severity: 'major' | 'moderate';
  rationale: string;
  egfr: number;
}

interface MedicationIntelligenceAssessment {
  enabled: boolean;
  medications: MedicationNormalizationRecord[];
  interactions: MedicationInteractionSignal[];
  beersAlerts: MedicationBeersSignal[];
  renalAlerts: MedicationRenalSignal[];
  highestSeverity: MedicationRiskSeverity | null;
  highRiskCount: number;
  egfr: number | null;
  riskNarrative: string;
}

type PostVisitBillingCodeType = 'cpt' | 'icd10';
type PostVisitBillingSuggestionStatus = 'proposed' | 'approved' | 'rejected';

interface PostVisitBillingDocumentationCheck {
  id: string;
  label: string;
  passed: boolean;
  guidance: string;
}

interface PostVisitBillingDocumentationSummary {
  score: number;
  status: 'sufficient' | 'partial' | 'insufficient';
  checks: PostVisitBillingDocumentationCheck[];
  gaps: string[];
}

interface PostVisitBillingSuggestionDraft {
  suggestionKey: string;
  codeType: PostVisitBillingCodeType;
  code: string;
  description: string;
  confidence: number;
  justification: string;
  metadata?: Record<string, any>;
}

type PostVisitFollowUpRiskTier = 'low' | 'moderate' | 'high' | 'critical';

interface PostVisitFollowUpRiskAssessment {
  score: number;
  tier: PostVisitFollowUpRiskTier;
  reasons: string[];
  nudgePolicy: string;
}

interface ListPostVisitSessionsOptions {
  status?: PostVisitSessionStatus;
  patientId?: string;
  doctorId?: string;
  sourceType?: 'in_person' | 'telemedicine' | 'hybrid';
  includePublishedOnly?: boolean;
  limit?: number;
  offset?: number;
}

interface EscalationDetectionResult {
  detected: boolean;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  routeTarget: 'emergency' | 'doctor' | 'nurse';
  triggerTerms: string[];
  triggerType: string;
  slaMinutes: number;
  confidence: number;
  temporality: 'current' | 'historical' | 'unclear';
  classifierSource: 'keyword_prefilter' | 'llm_v2' | 'hybrid_v2';
  candidateSeverity: 'low' | 'moderate' | 'high' | 'critical';
  escalationSuppressedReason?: 'no_stage1_match' | 'low_confidence' | 'historical_signal' | 'unclear_temporality' | null;
  classifierModel?: string | null;
  classifierRationale?: string | null;
  classifierAudit?: LlmAuditMetadata | null;
}

interface EscalationPrefilterResult {
  matched: boolean;
  text: string;
  candidateSeverity: 'low' | 'moderate' | 'high' | 'critical';
  routeTarget: 'emergency' | 'doctor' | 'nurse';
  triggerTerms: string[];
  triggerType: string;
}

interface PostVisitMobileEvent {
  id: string;
  eventType: string;
  occurredAt: string | null;
  actorType: 'system' | 'clinician' | 'patient';
  actorId: string | null;
  severity: 'low' | 'moderate' | 'high' | 'critical' | null;
  payload: Record<string, any>;
}

@Injectable()
export class PostVisitService {
  private readonly logger = new Logger(PostVisitService.name);
  private readonly postVisitSchemaReady = new WeakSet<DataSource>();
  private readonly postVisitSchemaInFlight = new WeakMap<DataSource, Promise<void>>();

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly patientService: PatientService,
    private readonly notificationsService?: NotificationsService,
    private readonly emailService?: EmailService,
    private readonly patientNotificationsService?: PatientNotificationsService,
    private readonly groundedLlmService?: PostVisitGroundedLlmService,
    private readonly hipaaAuditService?: HipaaAuditService,
    private readonly fileStorageService?: FileStorageService,
    @Optional() private readonly escalationService?: PostVisitEscalationService,
    @Optional() private readonly billingIntelligenceService?: PostVisitBillingIntelligenceService,
    @Optional() private readonly companionMemoryService?: PostVisitCompanionMemoryService,
    @Optional() private readonly sessionService?: PostVisitSessionService,
    @Optional() private readonly draftService?: PostVisitDraftService,
    @Optional() private readonly escalationRouter?: PostVisitEscalationRoutingService,
  ) {}

  private isTrialMatcherEnabled(): boolean {
    const runtimeOverride = process.env.FEATURE_POSTVISIT_TRIAL_MATCHER;
    if (runtimeOverride !== undefined) {
      return String(runtimeOverride).toLowerCase() === 'true';
    }
    const configured = (config as any)?.features?.postVisitTrialMatcher;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_TRIAL_MATCHER || 'false').toLowerCase() === 'true';
  }

  private getTrialDecisionSlaHours(): number {
    const configured = Number(
      (config as any)?.features?.postVisitTrialDecisionSlaHours
        ?? process.env.POSTVISIT_TRIAL_DECISION_SLA_HOURS
        ?? 72,
    );
    return Number.isFinite(configured) && configured > 0 ? configured : 72;
  }

  private getTrialDecisionEscalationRouteTarget(): 'doctor' | 'nurse' | 'emergency' {
    const configured = String(
      (config as any)?.features?.postVisitTrialDecisionEscalationRouteTarget
        ?? process.env.POSTVISIT_TRIAL_DECISION_ROUTE_TARGET
        ?? 'doctor',
    )
      .trim()
      .toLowerCase();
    return ['doctor', 'nurse', 'emergency'].includes(configured)
      ? (configured as 'doctor' | 'nurse' | 'emergency')
      : 'doctor';
  }

  // S108: Schema is now authoritative in provisioning scripts (sprint48–sprint58).
  // This method verifies the core table exists and logs a clear error if not,
  // instead of silently creating it inline (which caused drift with migrations).
  private async ensurePostVisitSchema(tenantDb: DataSource) {
    if (this.postVisitSchemaReady.has(tenantDb)) {
      return;
    }

    const inFlight = this.postVisitSchemaInFlight.get(tenantDb);
    if (inFlight) {
      await inFlight;
      return;
    }

    const initPromise = this.checkPostVisitSchema(tenantDb);
    this.postVisitSchemaInFlight.set(tenantDb, initPromise);

    try {
      await initPromise;
      this.postVisitSchemaReady.add(tenantDb);
    } finally {
      this.postVisitSchemaInFlight.delete(tenantDb);
    }
  }

  private async checkPostVisitSchema(tenantDb: DataSource): Promise<void> {
    const [row] = await tenantDb.query(`
      SELECT to_regclass('post_visit_sessions') AS tbl
    `).catch(() => [null]);

    if (!row) {
      return;
    }

    if (!row?.tbl) {
      throw new Error(
        'post_visit_sessions table not found. ' +
        'Run provisioning scripts sprint48 through sprint58 before using the PostVisit module.',
      );
    }
  }

  private getOptionalRepository<T = any>(tenantDb: DataSource, entity: new () => T): any | null {
    const dataSource = tenantDb as any;
    return typeof dataSource?.getRepository === 'function' ? dataSource.getRepository(entity) : null;
  }

  private mapPostVisitSeverityToUrgency(severity?: string | null): 'routine' | 'urgent' | 'emergency' {
    const normalized = String(severity || '').trim().toLowerCase();
    if (normalized === 'critical') return 'emergency';
    if (normalized === 'high' || normalized === 'moderate') return 'urgent';
    return 'routine';
  }

  private buildPostVisitDueAt(urgency: 'routine' | 'urgent' | 'emergency'): Date {
    const hours = urgency === 'emergency' ? 2 : urgency === 'urgent' ? 24 : 72;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private async createPostVisitPatientAiArtifacts(
    tenantDb: DataSource,
    args: {
      sessionId: string;
      threadId: string;
      patientId: string;
      patientMessageId: string;
      assistantMessageId: string;
      messageText: string;
      assistantAnswer: { answer: string; abstained?: boolean; abstainReason?: string | null; citationsUsed?: string[]; model?: string | null; source?: string | null };
      detection: { detected: boolean; severity: string; routeTarget: string; confidence: number; temporality?: string | null; classifierSource?: string | null };
      postVisitEscalationId?: string | null;
    },
  ): Promise<{
    patientAiSession: PatientAiSession | null;
    patientAiEscalation: PatientAiEscalation | null;
    followupOrchestration: PatientFollowupOrchestration | null;
  }> {
    const sessionRepo = this.getOptionalRepository(tenantDb, PatientAiSession);
    const escalationRepo = this.getOptionalRepository(tenantDb, PatientAiEscalation);
    const followupRepo = this.getOptionalRepository(tenantDb, PatientFollowupOrchestration);

    if (!sessionRepo || !followupRepo) {
      return {
        patientAiSession: null,
        patientAiEscalation: null,
        followupOrchestration: null,
      };
    }

    const urgency = this.mapPostVisitSeverityToUrgency(args.detection?.severity);
    const requiresClinicianFollowUp = args.detection?.detected === true || args.assistantAnswer?.abstained === true;
    const patientAiSession = await sessionRepo.save(
      sessionRepo.create({
        patientId: args.patientId,
        sessionType: 'post_visit_companion',
        sourceSessionId: args.sessionId,
        status: requiresClinicianFollowUp ? 'needs_follow_up' : 'open',
        latestMessage: args.messageText,
        latestReply: args.assistantAnswer?.answer || null,
        latestIntent: 'post_visit_companion_answer',
        triageLevel: args.detection?.detected ? args.detection?.severity || null : null,
        urgency,
        guidanceSummary: args.assistantAnswer?.answer || null,
        requiresClinicianFollowUp,
        urgentSignal: args.detection?.detected === true,
        abstained: args.assistantAnswer?.abstained === true,
        abstainReason: args.assistantAnswer?.abstainReason || null,
        citations: Array.isArray(args.assistantAnswer?.citationsUsed)
          ? args.assistantAnswer.citationsUsed.map((citationId) => ({ id: citationId }))
          : [],
        provenance: {
          source: 'post_visit_companion',
          model: args.assistantAnswer?.model || null,
          answerEngine: args.assistantAnswer?.source || null,
          sessionId: args.sessionId,
          threadId: args.threadId,
          patientMessageId: args.patientMessageId,
          assistantMessageId: args.assistantMessageId,
          postVisitEscalationId: args.postVisitEscalationId || null,
        },
      }),
    );

    let patientAiEscalation: PatientAiEscalation | null = null;
    if (args.detection?.detected === true && escalationRepo) {
      patientAiEscalation = await escalationRepo.save(
        escalationRepo.create({
          patientId: args.patientId,
          patientAiSessionId: patientAiSession.id,
          sourceType: 'post_visit_companion',
          severity: args.detection.severity,
          routeTarget: args.detection.routeTarget,
          status: 'open',
          triggerSummary: `Post-visit companion escalation routed to ${args.detection.routeTarget} from patient message review.`,
          recommendedAction: args.assistantAnswer?.answer || null,
          provenance: {
            source: 'post_visit_companion',
            sessionId: args.sessionId,
            threadId: args.threadId,
            patientMessageId: args.patientMessageId,
            assistantMessageId: args.assistantMessageId,
            postVisitEscalationId: args.postVisitEscalationId || null,
            classifierSource: args.detection.classifierSource || null,
            confidence: args.detection.confidence,
            temporality: args.detection.temporality || null,
          },
        }),
      );
    }

    const followupOrchestration = await followupRepo.save(
      followupRepo.create({
        patientId: args.patientId,
        patientAiSessionId: patientAiSession.id,
        triggerType: 'post_visit_companion_message',
        riskLevel: urgency,
        status: 'open',
        reminderState: 'pending',
        nextAction: args.detection?.detected
          ? `Route to ${args.detection.routeTarget} and continue clinician follow-up.`
          : args.assistantAnswer?.answer || 'Continue post-visit follow-up plan.',
        unresolvedQuestion: args.assistantAnswer?.abstained === true ? args.messageText : null,
        nonadherenceFlag: false,
        missedFollowupFlag: /\bmiss(ed|ing)\b/i.test(args.messageText),
        routeBackTarget: args.detection?.detected ? args.detection.routeTarget : 'patient_support',
        dueAt: this.buildPostVisitDueAt(urgency),
        lastTouchedAt: new Date(),
        payload: {
          source: 'post_visit_companion',
          sessionId: args.sessionId,
          threadId: args.threadId,
          patientMessageId: args.patientMessageId,
          assistantMessageId: args.assistantMessageId,
          postVisitEscalationId: args.postVisitEscalationId || null,
          citationsUsed: Array.isArray(args.assistantAnswer?.citationsUsed) ? args.assistantAnswer.citationsUsed : [],
        },
      }),
    );

    if (args.postVisitEscalationId) {
      await tenantDb.query(
        `
          UPDATE post_visit_escalation_events
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          args.postVisitEscalationId,
          JSON.stringify({
            patient_ai_session_id: patientAiSession.id,
            patient_ai_escalation_id: patientAiEscalation?.id || null,
            patient_followup_orchestration_id: followupOrchestration.id,
          }),
        ],
      );
    }

    return {
      patientAiSession,
      patientAiEscalation,
      followupOrchestration,
    };
  }

  private async syncResolvedPostVisitEscalationIntoPatientAi(
    tenantDb: DataSource,
    escalationRow: any,
    payload: { status: 'resolved' | 'dismissed'; resolutionNote?: string | null; actorUserId?: string | null },
  ): Promise<void> {
    const metadata = typeof escalationRow?.metadata === 'string'
      ? (() => {
          try {
            return JSON.parse(escalationRow.metadata);
          } catch {
            return {};
          }
        })()
      : escalationRow?.metadata || {};

    const sessionRepo = this.getOptionalRepository(tenantDb, PatientAiSession);
    const escalationRepo = this.getOptionalRepository(tenantDb, PatientAiEscalation);
    const followupRepo = this.getOptionalRepository(tenantDb, PatientFollowupOrchestration);

    if (escalationRepo && metadata?.patient_ai_escalation_id) {
      const aiEscalation = await escalationRepo.findOneBy({ id: metadata.patient_ai_escalation_id });
      if (aiEscalation) {
        await escalationRepo.save({
          ...aiEscalation,
          status: payload.status,
          resolutionNotes: payload.resolutionNote || aiEscalation.resolutionNotes || null,
          resolvedAt: new Date(),
          resolvedBy: payload.actorUserId || aiEscalation.resolvedBy || null,
          provenance: {
            ...(aiEscalation.provenance || {}),
            postVisitEscalationStatus: payload.status,
          },
        });
      }
    }

    if (followupRepo && metadata?.patient_followup_orchestration_id) {
      const followup = await followupRepo.findOneBy({ id: metadata.patient_followup_orchestration_id });
      if (followup) {
        await followupRepo.save({
          ...followup,
          status: payload.status === 'resolved' ? 'completed' : 'dismissed',
          reminderState: payload.status === 'resolved' ? 'acknowledged' : followup.reminderState,
          completedAt: payload.status === 'resolved' ? new Date() : followup.completedAt,
          lastTouchedAt: new Date(),
          payload: {
            ...(followup.payload || {}),
            postVisitEscalationStatus: payload.status,
            resolutionNote: payload.resolutionNote || null,
          },
        });
      }
    }

    if (sessionRepo && metadata?.patient_ai_session_id) {
      const aiSession = await sessionRepo.findOneBy({ id: metadata.patient_ai_session_id });
      if (aiSession) {
        await sessionRepo.save({
          ...aiSession,
          status: payload.status === 'resolved' ? 'closed' : aiSession.status,
          provenance: {
            ...(aiSession.provenance || {}),
            postVisitEscalationStatus: payload.status,
          },
        });
      }
    }
  }

  private normalizeEscalationMetadata(this: any, metadata: any): Record<string, any> {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return {};
      }
    }
    return typeof metadata === 'object' ? metadata : {};
  }

  private buildEscalationTrustSummary(this: any, row: any, metadata: Record<string, any>) {
    const classificationSource = String(row.classification_source ?? row.classificationSource ?? '').trim().toLowerCase();
    const triggerType = String(row.trigger_type ?? row.triggerType ?? '').trim().toLowerCase();
    const linkedPatientAiSessionId = metadata.patient_ai_session_id || null;
    const linkedPatientAiEscalationId = metadata.patient_ai_escalation_id || null;
    const linkedFollowupOrchestrationId = metadata.patient_followup_orchestration_id || null;

    let backingType = 'Companion workflow';
    let sourceLabel = 'Post-visit companion';

    if (linkedPatientAiSessionId || linkedPatientAiEscalationId) {
      backingType = 'Patient AI linked';
      sourceLabel = 'Post-visit companion + patient AI';
    } else if (classificationSource.startsWith('keyword') || triggerType === 'symptom_keyword') {
      backingType = 'Rule-backed safety logic';
      sourceLabel = 'Keyword escalation policy';
    } else if (classificationSource) {
      backingType = 'Governed classifier';
      sourceLabel = classificationSource.replace(/_/g, ' ');
    }

    const reviewState =
      row.status === 'resolved'
        ? 'Resolved by clinician'
        : row.status === 'dismissed'
          ? 'Dismissed by clinician'
          : row.status === 'acknowledged'
            ? 'Acknowledged and awaiting closure'
            : 'Open clinician review';

    return {
      sourceLabel,
      backingType,
      reviewState,
      classifierStage: row.classification_stage ?? row.classificationStage ?? 'v1',
      linkedPatientAiSessionId,
      linkedPatientAiEscalationId,
      linkedFollowupOrchestrationId,
    };
  }



  // S108: Delegated to PostVisitSessionService.
  async createSession(
    tenantDb: DataSource,
    dto: CreatePostVisitSessionDto,
    requestContext: { tenantId?: string; actorUserId?: string | null } = {},
  ) {
    if (this.sessionService) return this.sessionService.createSession(tenantDb, dto, requestContext);
    await this.ensurePostVisitSchema(tenantDb);

    const patientRows = await tenantDb.query(`SELECT id FROM patients WHERE id = $1 LIMIT 1`, [dto.patientId]);
    if (!patientRows?.length) {
      throw new BadRequestException('Patient not found for post-visit session');
    }

    const resolvedDoctorId = dto.doctorId || requestContext.actorUserId || null;

    const inserted = await tenantDb.query(
      `
        INSERT INTO post_visit_sessions (
          tenant_id,
          patient_id,
          doctor_id,
          appointment_id,
          consultation_id,
          status,
          source_type,
          language,
          started_at
        ) VALUES ($1,$2,$3,$4,$5,'captured',$6,$7,$8)
        RETURNING *
      `,
      [
        requestContext.tenantId || null,
        dto.patientId,
        resolvedDoctorId,
        dto.appointmentId || null,
        dto.consultationId || null,
        dto.sourceType || 'in_person',
        this.normalizeLanguage(dto.language || 'en'),
        dto.startedAt || null,
      ],
    );

    return this.mapSession(inserted[0]);
  }

  // S108: Delegated to PostVisitSessionService.
  async getSession(tenantDb: DataSource, sessionId: string) {
    if (this.sessionService) return this.sessionService.getSession(tenantDb, sessionId);
    await this.ensurePostVisitSchema(tenantDb);
    const row = await this.getSessionRow(tenantDb, sessionId);
    return this.mapSession(row);
  }

  // S108: Delegated to PostVisitSessionService.
  async listSessions(
    tenantDb: DataSource,
    options: ListPostVisitSessionsOptions = {},
  ) {
    if (this.sessionService) return this.sessionService.listSessions(tenantDb, options);
    await this.ensurePostVisitSchema(tenantDb);

    const limit = Math.min(Math.max(Number(options.limit || 25), 1), 100);
    const offset = Math.max(Number(options.offset || 0), 0);
    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    const allowedStatuses: PostVisitSessionStatus[] = [
      'captured',
      'processing',
      'draft_ready',
      'doctor_reviewed',
      'published',
      'closed',
    ];
    const allowedSourceTypes = new Set(['in_person', 'telemedicine', 'hybrid']);

    if (options.includePublishedOnly) {
      whereClauses.push(`s.status IN ('published','closed')`);
    }
    if (options.status && allowedStatuses.includes(options.status)) {
      whereParams.push(options.status);
      whereClauses.push(`s.status = $${whereParams.length}`);
    }
    if (options.patientId) {
      whereParams.push(options.patientId);
      whereClauses.push(`s.patient_id = $${whereParams.length}`);
    }
    if (options.doctorId) {
      whereParams.push(options.doctorId);
      whereClauses.push(`s.doctor_id = $${whereParams.length}`);
    }
    if (options.sourceType && allowedSourceTypes.has(options.sourceType)) {
      whereParams.push(options.sourceType);
      whereClauses.push(`s.source_type = $${whereParams.length}`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await tenantDb.query(
      `
        SELECT
          s.*,
          p.first_name AS patient_first_name,
          p.last_name AS patient_last_name,
          p.patient_number AS patient_number,
          d.first_name AS doctor_first_name,
          d.last_name AS doctor_last_name,
          vs.artifact_status AS visit_summary_status,
          rb.artifact_status AS recommendation_bundle_status,
          COALESCE(seg.segment_count, 0) AS transcript_segment_count,
          COALESCE(msg.message_count, 0) AS companion_message_count
        FROM post_visit_sessions s
        LEFT JOIN patients p ON p.id = s.patient_id
        LEFT JOIN users d ON d.id = s.doctor_id
        LEFT JOIN post_visit_draft_artifacts vs
          ON vs.session_id = s.id
         AND vs.artifact_type = 'visit_summary'
        LEFT JOIN post_visit_draft_artifacts rb
          ON rb.session_id = s.id
         AND rb.artifact_type = 'recommendation_bundle'
        LEFT JOIN (
          SELECT session_id, COUNT(*)::int AS segment_count
          FROM post_visit_transcript_segments
          GROUP BY session_id
        ) seg ON seg.session_id = s.id
        LEFT JOIN (
          SELECT session_id, COUNT(*)::int AS message_count
          FROM post_visit_companion_messages
          GROUP BY session_id
        ) msg ON msg.session_id = s.id
        ${whereSql}
        ORDER BY COALESCE(s.started_at, s.created_at) DESC
        LIMIT $${whereParams.length + 1}
        OFFSET $${whereParams.length + 2}
      `,
      [...whereParams, limit, offset],
    );

    const totalRows = await tenantDb.query(
      `
        SELECT COUNT(*)::int AS total
        FROM post_visit_sessions s
        ${whereSql}
      `,
      whereParams,
    );

    return {
      sessions: rows.map((row: any) => ({
        ...this.mapSession(row),
        patient: {
          id: row.patient_id,
          firstName: row.patient_first_name || null,
          lastName: row.patient_last_name || null,
          patientNumber: row.patient_number || null,
        },
        doctor: {
          id: row.doctor_id || null,
          firstName: row.doctor_first_name || null,
          lastName: row.doctor_last_name || null,
        },
        artifacts: {
          visitSummaryStatus: row.visit_summary_status || null,
          recommendationBundleStatus: row.recommendation_bundle_status || null,
        },
        telemetry: {
          transcriptSegmentCount: Number(row.transcript_segment_count || 0),
          companionMessageCount: Number(row.companion_message_count || 0),
        },
      })),
      paging: {
        limit,
        offset,
        total: Number(totalRows?.[0]?.total || 0),
      },
    };
  }

  // S108: Delegated to PostVisitDraftService.
  async getSessionDraft(tenantDb: DataSource, sessionId: string) {
    if (this.draftService) return this.draftService.getSessionDraft(tenantDb, sessionId);
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    const [artifacts, extractedEntities, segments, reviewActions, ruleCitations, actionExecutions, documentIntelligenceRows, billingSuggestionRows] = await Promise.all([
      tenantDb.query(
        `
          SELECT id, artifact_type, artifact_status, content, citations, confidence, generated_by, created_at, updated_at
          FROM post_visit_draft_artifacts
          WHERE session_id = $1
          ORDER BY created_at DESC
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT id, entity_type, entity_value, normalized_value, confidence, source_start_second, source_end_second, source_origin, metadata, created_at
          FROM post_visit_extracted_entities
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 200
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT
            id,
            segment_order,
            start_second,
            end_second,
            text,
            confidence,
            language,
            speaker_label,
            speaker_role,
            diarization_confidence,
            speaker_assignment_status,
            needs_review,
            reviewed_by,
            reviewed_at
          FROM post_visit_transcript_segments
          WHERE session_id = $1
          ORDER BY segment_order ASC
          LIMIT 2000
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT id, artifact_id, artifact_type, action, review_reason, review_metadata, reviewed_by, source, created_at
          FROM post_visit_review_actions
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 200
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT
            id,
            recommendation_id,
            rule_id,
            guideline_id,
            citation_label,
            citation_source,
            citation_url,
            evidence_excerpt,
            confidence,
            relevance_score,
            citation_year,
            is_superseded,
            superseded_by_guideline_id,
            doctor_acknowledged_superseded,
            superseded_acknowledged_by,
            superseded_acknowledged_at,
            metadata,
            created_at
          FROM post_visit_rule_citations
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 400
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT id, recommendation_id, action_key, action_type, status, execution_note, result_resource_type, result_resource_id, result_payload, error_message, executed_by, executed_at, source, metadata
          FROM post_visit_action_executions
          WHERE session_id = $1
          ORDER BY executed_at DESC
          LIMIT 400
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT
            id,
            document_type,
            document_name,
            mime_type,
            file_size,
            duplicate_of_document_id,
            duplicate_similarity,
            extraction_status,
            ocr_engine,
            ocr_confidence,
            extracted_text,
            structured_payload,
            fhir_resources,
            critical_flags,
            critical_detected,
            critical_routed,
            escalation_event_id,
            metadata,
            created_at
          FROM post_visit_document_intelligence
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 200
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT *
          FROM post_visit_billing_suggestions
          WHERE session_id = $1
          ORDER BY
            CASE status
              WHEN 'approved' THEN 1
              WHEN 'proposed' THEN 2
              ELSE 3
            END,
            confidence DESC NULLS LAST,
            created_at DESC
          LIMIT 120
        `,
        [sessionId],
      ),
    ]);

    const billingDocumentation = this.buildBillingDocumentationSummaryFromSuggestionRows(billingSuggestionRows);
    const billingSuggestions = Array.isArray(billingSuggestionRows)
      ? billingSuggestionRows.map((row: any) => this.mapBillingSuggestion(row))
      : [];
    const billingSummary = {
      total: billingSuggestions.length,
      proposedCount: billingSuggestions.filter((item: any) => item.status === 'proposed').length,
      approvedCount: billingSuggestions.filter((item: any) => item.status === 'approved').length,
      rejectedCount: billingSuggestions.filter((item: any) => item.status === 'rejected').length,
      highConfidenceCount: billingSuggestions.filter((item: any) => Number(item.confidence || 0) >= 0.8).length,
    };

    return {
      sessionId,
      artifacts: artifacts.map((row: any) => ({
        id: row.id,
        type: row.artifact_type,
        status: row.artifact_status,
        content: row.content || {},
        citations: row.citations || [],
        confidence: row.confidence,
        generatedBy: row.generated_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      extractedEntities: extractedEntities.map((row: any) => ({
        id: row.id,
        type: row.entity_type,
        value: row.entity_value,
        normalizedValue: row.normalized_value || {},
        confidence: row.confidence,
        source: {
          origin: row.source_origin,
          startSecond: row.source_start_second,
          endSecond: row.source_end_second,
        },
        metadata: row.metadata || {},
        createdAt: row.created_at,
      })),
      transcript: {
        segmentCount: segments.length,
        segments: segments.map((row: any) => ({
          id: row.id,
          order: row.segment_order,
          start: Number(row.start_second),
          end: Number(row.end_second),
          text: row.text,
          confidence: row.confidence,
          language: row.language,
          speakerLabel: row.speaker_label || null,
          speakerRole: row.speaker_role || null,
          diarizationConfidence: row.diarization_confidence,
          speakerAssignmentStatus: row.speaker_assignment_status,
          needsReview: row.needs_review,
          reviewedBy: row.reviewed_by,
          reviewedAt: row.reviewed_at,
        })),
      },
      reviewActions: (reviewActions as any[]).map((row: any) => ({
        id: row.id,
        artifactId: row.artifact_id,
        artifactType: row.artifact_type,
        action: row.action,
        reviewReason: row.review_reason,
        reviewMetadata: row.review_metadata || {},
        reviewedBy: row.reviewed_by,
        source: row.source,
        createdAt: row.created_at,
      })),
      ruleCitations: (ruleCitations as any[]).map((row: any) => this.mapRuleCitationRow(row)),
      actionExecutions: (actionExecutions as any[]).map((row: any) => this.mapActionExecutionRow(row)),
      documentIntelligence: (documentIntelligenceRows as any[]).map((row: any) => this.mapDocumentIntelligenceRow(row)),
      billingIntelligence: {
        featureEnabled: true,
        documentation: billingDocumentation,
        suggestions: billingSuggestions,
        summary: billingSummary,
      },
    };
  }

  // S108: Delegated to PostVisitDraftService.
  async getAnnotatedDraft(sessionId: string, tenantDb: DataSource) {
    if (this.draftService) return this.draftService.getAnnotatedDraft(sessionId, tenantDb);
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    const [artifactRows, entityRows] = await Promise.all([
      tenantDb.query(
        `SELECT id, artifact_type, artifact_status, content, citations, confidence
         FROM post_visit_draft_artifacts WHERE session_id = $1 ORDER BY created_at DESC`,
        [sessionId],
      ),
      tenantDb.query(
        `SELECT id, entity_type, entity_value, normalized_value, confidence
         FROM post_visit_extracted_entities WHERE session_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [sessionId],
      ),
    ]);

    const entityList = (entityRows as any[]).map((e: any) => ({
      id: e.id,
      entityType: e.entity_type,
      entityValue: e.entity_value,
      normalizedValue: e.normalized_value || {},
      confidence: e.confidence,
    }));

    const annotated = (artifactRows as any[]).map((row: any) => {
      const content = row.content || {};
      const annotatedContent: Record<string, { raw: string; spans: AnnotatedSpan[] } | any> = {};

      for (const [key, value] of Object.entries(content)) {
        if (typeof value === 'string' && value.length > 10) {
          annotatedContent[key] = {
            raw: value,
            spans: annotateTextWithEntities(value, entityList),
          };
        } else if (Array.isArray(value)) {
          annotatedContent[key] = value.map((item: any) => {
            if (typeof item === 'string') {
              return { raw: item, spans: annotateTextWithEntities(item, entityList) };
            }
            if (typeof item === 'object' && item !== null && typeof item.text === 'string') {
              return { ...item, spans: annotateTextWithEntities(item.text, entityList) };
            }
            return item;
          });
        } else {
          annotatedContent[key] = value;
        }
      }

      return {
        id: row.id,
        artifactType: row.artifact_type,
        artifactStatus: row.artifact_status,
        content: annotatedContent,
        citations: row.citations || [],
        confidence: row.confidence,
      };
    });

    return {
      sessionId,
      entities: entityList,
      artifacts: annotated,
    };
  }

  // S108: Delegated to PostVisitDraftService.
  async askAboutSection(
    sessionId: string,
    body: { question: string; sectionType: string; artifactType?: string },
    tenantDb: DataSource,
  ) {
    if (this.draftService) return this.draftService.askAboutSection(sessionId, body, tenantDb);
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    const targetType = body.artifactType || 'visit_summary';
    const artifactRows = await tenantDb.query(
      `SELECT id, artifact_type, content, citations FROM post_visit_draft_artifacts
       WHERE session_id = $1 AND artifact_type = $2 LIMIT 1`,
      [sessionId, targetType],
    );
    const artifact = artifactRows[0] as any;
    if (!artifact) {
      return { answer: 'No summary artifact found for this session.', abstained: true };
    }

    const content = artifact.content || {};
    const sectionContent = this.extractSectionContent(content, body.sectionType);

    const fullSummary =
      typeof content.plain_language_summary === 'string'
        ? content.plain_language_summary
        : JSON.stringify(content);

    const recRows = await tenantDb.query(
      `SELECT content FROM post_visit_draft_artifacts
       WHERE session_id = $1 AND artifact_type = 'recommendation_bundle' LIMIT 1`,
      [sessionId],
    );
    const checklist: string[] = [];
    const recContent = (recRows[0] as any)?.content;
    if (recContent?.items && Array.isArray(recContent.items)) {
      for (const item of recContent.items) {
        checklist.push(typeof item === 'string' ? item : item.text || JSON.stringify(item));
      }
    }

    const citations = (artifact.citations || []).map((c: any, i: number) => ({
      id: c.id || `cit-${i}`,
      label: c.label || c.source || `Citation ${i + 1}`,
      source: c.source || 'visit',
      excerpt: c.excerpt || '',
    }));

    if (!this.groundedLlmService) {
      return { answer: 'Grounded LLM is not configured.', abstained: true };
    }
    const result = await this.groundedLlmService.answerPatientQuestion({
      sessionId,
      question: body.question,
      summary: fullSummary,
      checklist,
      citations,
      sectionType: body.sectionType,
      sectionContent,
    });
    return result || { answer: 'Unable to answer at this time.', abstained: true };
  }

  private extractSectionContent(content: Record<string, any>, sectionType: string): string {
    const keyMap: Record<string, string[]> = {
      chief_complaint: ['chief_complaint', 'chiefComplaint'],
      hpi: ['history_of_present_illness', 'hpi', 'historyOfPresentIllness'],
      reported_symptoms: ['reported_symptoms', 'reportedSymptoms', 'symptoms'],
      physical_exam: ['physical_examination', 'physicalExamination', 'objective', 'physical_exam'],
      assessment: ['assessment'],
      plan: ['plan', 'treatment_plan', 'treatmentPlan'],
      recommendations: ['recommendations', 'items'],
      subjective: ['subjective'],
      objective: ['objective'],
      quick_summary: ['plain_language_summary', 'quick_summary', 'summary'],
      key_points: ['key_points', 'keyPoints'],
    };
    const keys = keyMap[sectionType] || [sectionType];
    for (const key of keys) {
      if (content[key]) {
        const val = content[key];
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) {
          return val
            .map((v: any) => (typeof v === 'string' ? v : v.text || JSON.stringify(v)))
            .join('\n');
        }
        return JSON.stringify(val);
      }
    }
    return '';
  }

  private mapRuleCitationRow(row: any) {
    return {
      id: row.id,
      recommendationId: row.recommendation_id,
      ruleId: row.rule_id,
      guidelineId: row.guideline_id,
      label: row.citation_label,
      source: row.citation_source,
      url: row.citation_url,
      excerpt: row.evidence_excerpt,
      confidence: row.confidence,
      relevanceScore: row.relevance_score,
      citationYear: row.citation_year,
      isSuperseded: row.is_superseded,
      supersededByGuidelineId: row.superseded_by_guideline_id,
      acknowledgedSuperseded: row.doctor_acknowledged_superseded,
      supersededAcknowledgedBy: row.superseded_acknowledged_by,
      supersededAcknowledgedAt: row.superseded_acknowledged_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  private mapActionExecutionRow(row: any) {
    return {
      id: row.id,
      recommendationId: row.recommendation_id,
      actionKey: row.action_key,
      actionType: row.action_type,
      status: row.status,
      executionNote: row.execution_note,
      resultResourceType: row.result_resource_type,
      resultResourceId: row.result_resource_id,
      resultPayload: row.result_payload,
      errorMessage: row.error_message,
      executedBy: row.executed_by,
      executedAt: row.executed_at,
      source: row.source,
      metadata: row.metadata || {},
    };
  }

  private mapDocumentIntelligenceRow(row: any) {
    return {
      id: row.id,
      documentType: row.document_type,
      documentName: row.document_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      duplicateOfDocumentId: row.duplicate_of_document_id,
      duplicateSimilarity: row.duplicate_similarity,
      extractionStatus: row.extraction_status,
      ocrEngine: row.ocr_engine,
      ocrConfidence: row.ocr_confidence,
      extractedText: row.extracted_text,
      structuredPayload: row.structured_payload,
      fhirResources: row.fhir_resources,
      criticalFlags: row.critical_flags,
      criticalDetected: row.critical_detected,
      criticalRouted: row.critical_routed,
      escalationEventId: row.escalation_event_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  // S108: Delegated to PostVisitBillingIntelligenceService.
  async getSessionBillingIntelligence(
    tenantDb: DataSource,
    sessionId: string,
    options: { actorUserId?: string | null } = {},
  ) {
    if (this.billingIntelligenceService) {
      return this.billingIntelligenceService.getSessionBillingIntelligence(tenantDb, sessionId, options);
    }
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_billing_suggestions
        WHERE session_id = $1
        ORDER BY
          CASE status
            WHEN 'approved' THEN 1
            WHEN 'proposed' THEN 2
            ELSE 3
          END,
          confidence DESC NULLS LAST,
          created_at DESC
      `,
      [sessionId],
    );

    const suggestions = Array.isArray(rows) ? rows.map((row: any) => this.mapBillingSuggestion(row)) : [];
    const documentation = this.buildBillingDocumentationSummaryFromSuggestionRows(rows);

    if (
      this.isBillingIntelligenceEnabled() &&
      suggestions.length > 0 &&
      this.hipaaAuditService &&
      options.actorUserId &&
      sessionRow.patient_id
    ) {
      await this.hipaaAuditService
        .logPhiAccess(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.BILLING_VIEW,
          'post_visit_billing_intelligence',
          sessionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          sessionId,
          { fields: ['suggestions', 'documentation'], recordCount: suggestions.length },
          { sessionId },
        )
        .catch(() => {});
    }

    return {
      featureEnabled: this.isBillingIntelligenceEnabled(),
      sessionId,
      patientId: sessionRow.patient_id,
      documentation,
      suggestions,
      summary: {
        total: suggestions.length,
        proposedCount: suggestions.filter((item: any) => item.status === 'proposed').length,
        approvedCount: suggestions.filter((item: any) => item.status === 'approved').length,
        rejectedCount: suggestions.filter((item: any) => item.status === 'rejected').length,
        highConfidenceCount: suggestions.filter((item: any) => Number(item.confidence || 0) >= 0.8).length,
      },
    };
  }

  // S108: Delegated to PostVisitBillingIntelligenceService.
  async reviewBillingSuggestion(
    tenantDb: DataSource,
    sessionId: string,
    suggestionId: string,
    payload: ReviewPostVisitBillingSuggestionDto,
    options: { actorUserId?: string | null } = {},
  ) {
    if (this.billingIntelligenceService) {
      return this.billingIntelligenceService.reviewBillingSuggestion(tenantDb, sessionId, suggestionId, payload, options);
    }
    await this.ensurePostVisitSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated doctor user is required for billing suggestion review');
    }
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    const suggestionRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_billing_suggestions
        WHERE id = $1
          AND session_id = $2
        LIMIT 1
      `,
      [suggestionId, sessionId],
    );
    if (!suggestionRows?.length) {
      throw new NotFoundException('Billing suggestion not found for this post-visit session');
    }

    const before = this.mapBillingSuggestion(suggestionRows[0]);
    const action = payload.action === 'reject' ? 'reject' : 'approve';
    const targetStatus: PostVisitBillingSuggestionStatus = action === 'approve' ? 'approved' : 'rejected';

    const updatedRows = await tenantDb.query(
      `
        UPDATE post_visit_billing_suggestions
        SET status = $3,
            approved_by = CASE WHEN $3 = 'approved' THEN $4 ELSE NULL END,
            approved_at = CASE WHEN $3 = 'approved' THEN NOW() ELSE NULL END,
            approval_note = COALESCE($5, approval_note),
            metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
            updated_at = NOW()
        WHERE id = $1
          AND session_id = $2
        RETURNING *
      `,
      [
        suggestionId,
        sessionId,
        targetStatus,
        options.actorUserId,
        payload.note || null,
        JSON.stringify({
          last_reviewed_at: new Date().toISOString(),
          last_reviewed_by: options.actorUserId,
          last_review_action: action,
        }),
      ],
    );

    let updatedRow = updatedRows[0];
    let workflowKey: string | null = null;
    if (targetStatus === 'approved') {
      workflowKey = await this.routeBillingSuggestionToWorkflow(tenantDb, {
        suggestionId: updatedRow.id,
        sessionId,
        patientId: sessionRow.patient_id,
        codeType: updatedRow.code_type,
        code: updatedRow.code,
        actorUserId: options.actorUserId,
        note: payload.note || null,
      });
      if (workflowKey) {
        const routedRows = await tenantDb.query(
          `
            UPDATE post_visit_billing_suggestions
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = NOW()
            WHERE id = $1
              AND session_id = $2
            RETURNING *
          `,
          [
            suggestionId,
            sessionId,
            JSON.stringify({
              workflow_key: workflowKey,
              workflow_routed_at: new Date().toISOString(),
              workflow_destination: 'accounts',
            }),
          ],
        );
        if (routedRows?.length) {
          updatedRow = routedRows[0];
        }
      }
    }

    const after = this.mapBillingSuggestion(updatedRow);
    await tenantDb.query(
      `
        INSERT INTO post_visit_billing_audit_log (
          session_id,
          suggestion_id,
          action,
          action_by,
          action_note,
          before_payload,
          after_payload,
          metadata
        ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)
      `,
      [
        sessionId,
        suggestionId,
        action === 'approve' ? 'approved' : 'rejected',
        options.actorUserId,
        payload.note || null,
        JSON.stringify(before),
        JSON.stringify(after),
        JSON.stringify({
          workflow_key: workflowKey,
          source: 'post_visit_billing_review',
        }),
      ],
    );

    if (this.hipaaAuditService && sessionRow.patient_id) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId!,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_UPDATE,
          'post_visit_billing_suggestion',
          suggestionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionId,
          { action: action === 'approve' ? 'approved' : 'rejected', sessionId },
        )
        .catch(() => {});
    }

    return {
      featureEnabled: this.isBillingIntelligenceEnabled(),
      sessionId,
      action,
      workflowKey,
      suggestion: after,
    };
  }

  private buildFollowUpRiskAssessment(args: {
    openCriticalEscalationCount: number;
    openHighEscalationCount: number;
    pendingActionCount: number;
    failedActionCount: number;
    followUpCommitmentAcknowledged: boolean;
    unresolvedIntraVisitCriticalCount: number;
  }): PostVisitFollowUpRiskAssessment {
    let score = 0;
    const reasons: string[] = [];

    if (args.openCriticalEscalationCount > 0) {
      score += 35;
      reasons.push(`${args.openCriticalEscalationCount} critical post-visit escalation(s) still open.`);
    }
    if (args.openHighEscalationCount > 0) {
      score += 20;
      reasons.push(`${args.openHighEscalationCount} high-severity escalation(s) pending.`);
    }
    if (args.unresolvedIntraVisitCriticalCount > 0) {
      score += 20;
      reasons.push(`${args.unresolvedIntraVisitCriticalCount} unresolved intra-visit critical alert(s).`);
    }
    if (args.pendingActionCount >= 3) {
      score += 15;
      reasons.push(`${args.pendingActionCount} follow-up checklist item(s) remain unexecuted.`);
    } else if (args.pendingActionCount > 0) {
      score += 8;
      reasons.push(`${args.pendingActionCount} follow-up action(s) still pending.`);
    }
    if (args.failedActionCount > 0) {
      score += 12;
      reasons.push(`${args.failedActionCount} prior recommendation execution(s) failed.`);
    }
    if (!args.followUpCommitmentAcknowledged) {
      score += 10;
      reasons.push('No recent follow-up commitment acknowledgement was recorded.');
    }

    score = Math.max(0, Math.min(100, score));
    const tier = this.resolveFollowUpRiskTier(score);
    const nudgePolicy = this.resolveNudgePolicyForRiskTier(tier);
    if (reasons.length === 0) {
      reasons.push('No unresolved high-risk post-visit signals found.');
    }

    return {
      score,
      tier,
      reasons,
      nudgePolicy,
    };
  }

  async generateAppointmentPreVisitBrief(
    tenantDb: DataSource,
    appointmentId: string,
    options: { actorUserId?: string | null; forceRefresh?: boolean; fromJob?: boolean } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const appointmentRows = await tenantDb.query(
      `
        SELECT
          a.id,
          a.patient_id,
          a.doctor_id,
          a.appointment_date,
          a.appointment_type,
          a.reason,
          a.notes,
          p.first_name AS patient_first_name,
          p.last_name AS patient_last_name,
          p.patient_number,
          d.first_name AS doctor_first_name,
          d.last_name AS doctor_last_name
        FROM appointments a
        LEFT JOIN patients p ON p.id = a.patient_id
        LEFT JOIN users d ON d.id = a.doctor_id
        WHERE a.id = $1
        LIMIT 1
      `,
      [appointmentId],
    );
    if (!appointmentRows?.length) {
      throw new NotFoundException('Appointment not found for pre-visit brief');
    }
    const appointment = appointmentRows[0];

    if (!this.isPreVisitBriefEnabled()) {
      return {
        featureEnabled: false,
        appointmentId,
        patientId: appointment.patient_id,
        doctorId: appointment.doctor_id || null,
        message: 'Pre-visit AI brief is disabled by feature flag.',
      };
    }

    const existingRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_previsit_briefs
        WHERE appointment_id = $1
        LIMIT 1
      `,
      [appointmentId],
    );
    const existing = existingRows?.[0] || null;
    if (existing && options.forceRefresh !== true) {
      if (
        this.hipaaAuditService &&
        (options.actorUserId || options.fromJob) &&
        appointment.patient_id
      ) {
        await this.hipaaAuditService
          .logPhiAccess(
            tenantDb,
            options.actorUserId || 'system',
            '',
            undefined,
            HipaaAuditAction.APPOINTMENT_VIEW,
            'post_visit_previsit_brief',
            existing.id,
            appointment.patient_id,
            undefined,
            undefined,
            undefined,
            { fields: ['brief_content', 'follow_up_risk'], recordCount: 1 },
            { appointmentId },
          )
          .catch(() => {});
      }
      return {
        featureEnabled: true,
        ...this.mapPreVisitBrief(existing),
        reused: true,
      };
    }

    const [latestSessionRows, openEscalationRows, intraVisitRows, actionStatusRows, followupAckRows] = await Promise.all([
      tenantDb.query(
        `
          SELECT id, published_at, updated_at
          FROM post_visit_sessions
          WHERE patient_id = $1
            AND status IN ('published','closed')
          ORDER BY COALESCE(published_at, updated_at) DESC
          LIMIT 1
        `,
        [appointment.patient_id],
      ),
      tenantDb.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical_count,
            COUNT(*) FILTER (WHERE severity = 'high')::int AS high_count
          FROM post_visit_escalation_events
          WHERE patient_id = $1
            AND status IN ('open','acknowledged')
        `,
        [appointment.patient_id],
      ),
      tenantDb.query(
        `
          SELECT COUNT(*)::int AS unresolved_critical_count
          FROM post_visit_intravisit_alert_events
          WHERE patient_id = $1
            AND status = 'open'
            AND severity = 'critical'
        `,
        [appointment.patient_id],
      ),
      tenantDb.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE status <> 'executed')::int AS pending_count,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count
          FROM post_visit_action_executions pvae
          WHERE pvae.session_id IN (
            SELECT id
            FROM post_visit_sessions
            WHERE patient_id = $1
              AND status IN ('published','closed')
            ORDER BY COALESCE(published_at, updated_at) DESC
            LIMIT 3
          )
        `,
        [appointment.patient_id],
      ),
      tenantDb.query(
        `
          SELECT COUNT(*)::int AS acknowledged_count
          FROM post_visit_companion_acknowledgements
          WHERE patient_id = $1
            AND acknowledgement_type = 'follow_up_commitment'
            AND acknowledged = TRUE
            AND created_at >= NOW() - INTERVAL '120 days'
        `,
        [appointment.patient_id],
      ),
    ]);

    const latestSessionId = latestSessionRows?.[0]?.id || null;
    const [latestSummaryArtifact, latestRecommendationArtifact] = latestSessionId
      ? await Promise.all([
          this.getArtifactRow(tenantDb, latestSessionId, 'visit_summary'),
          this.getArtifactRow(tenantDb, latestSessionId, 'recommendation_bundle'),
        ])
      : [null, null];

    const recommendationItems = Array.isArray(latestRecommendationArtifact?.content?.items)
      ? latestRecommendationArtifact.content.items
      : [];
    const pendingActions = recommendationItems
      .filter((item: any) => String(item?.execution?.status || '').toLowerCase() !== 'executed')
      .slice(0, 6)
      .map((item: any) => ({
        id: item?.id || null,
        title: item?.title || null,
        urgency: item?.urgency || 'routine',
        actionType: item?.action_type || 'follow_up',
      }));

    const openEscalations = openEscalationRows?.[0] || { critical_count: 0, high_count: 0 };
    const actionStatus = actionStatusRows?.[0] || { pending_count: 0, failed_count: 0 };
    const intraVisitStatus = intraVisitRows?.[0] || { unresolved_critical_count: 0 };
    const followupAck = followupAckRows?.[0] || { acknowledged_count: 0 };

    const risk = this.buildFollowUpRiskAssessment({
      openCriticalEscalationCount: Number(openEscalations.critical_count || 0),
      openHighEscalationCount: Number(openEscalations.high_count || 0),
      pendingActionCount: Number(actionStatus.pending_count || 0),
      failedActionCount: Number(actionStatus.failed_count || 0),
      followUpCommitmentAcknowledged: Number(followupAck.acknowledged_count || 0) > 0,
      unresolvedIntraVisitCriticalCount: Number(intraVisitStatus.unresolved_critical_count || 0),
    });

    const summaryText = String(latestSummaryArtifact?.content?.plain_language_summary || '').trim();
    const briefContent = {
      appointment: {
        appointmentId,
        scheduledAt: appointment.appointment_date || null,
        appointmentType: appointment.appointment_type || null,
        reason: appointment.reason || null,
      },
      patient: {
        id: appointment.patient_id,
        fullName: `${String(appointment.patient_first_name || '').trim()} ${String(appointment.patient_last_name || '').trim()}`.trim(),
        patientNumber: appointment.patient_number || null,
      },
      doctor: {
        id: appointment.doctor_id || null,
        fullName: `${String(appointment.doctor_first_name || '').trim()} ${String(appointment.doctor_last_name || '').trim()}`.trim() || null,
      },
      latestPostVisitSessionId: latestSessionId,
      latestSummary: summaryText || null,
      pendingActions,
      escalationSnapshot: {
        criticalOpen: Number(openEscalations.critical_count || 0),
        highOpen: Number(openEscalations.high_count || 0),
        unresolvedIntraVisitCritical: Number(intraVisitStatus.unresolved_critical_count || 0),
      },
      followUpRisk: risk,
      generatedAt: new Date().toISOString(),
    };

    const deliveredAt = options.fromJob === true ? new Date() : null;
    const upsertedRows = await tenantDb.query(
      `
        INSERT INTO post_visit_previsit_briefs (
          appointment_id,
          patient_id,
          doctor_id,
          scheduled_at,
          status,
          brief_content,
          follow_up_risk_score,
          follow_up_risk_tier,
          follow_up_risk_reasons,
          nudge_policy,
          source,
          generated_by,
          generated_at,
          metadata,
          delivered_at
        ) VALUES (
          $1,$2,$3,$4,'active',$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,NOW(),$12::jsonb,$13
        )
        ON CONFLICT (appointment_id) DO UPDATE
        SET patient_id = EXCLUDED.patient_id,
            doctor_id = EXCLUDED.doctor_id,
            scheduled_at = EXCLUDED.scheduled_at,
            status = 'active',
            brief_content = EXCLUDED.brief_content,
            follow_up_risk_score = EXCLUDED.follow_up_risk_score,
            follow_up_risk_tier = EXCLUDED.follow_up_risk_tier,
            follow_up_risk_reasons = EXCLUDED.follow_up_risk_reasons,
            nudge_policy = EXCLUDED.nudge_policy,
            source = EXCLUDED.source,
            generated_by = EXCLUDED.generated_by,
            generated_at = NOW(),
            metadata = EXCLUDED.metadata,
            delivered_at = COALESCE(EXCLUDED.delivered_at, post_visit_previsit_briefs.delivered_at),
            updated_at = NOW()
        RETURNING *
      `,
      [
        appointmentId,
        appointment.patient_id,
        appointment.doctor_id || null,
        appointment.appointment_date || null,
        JSON.stringify(briefContent),
        risk.score,
        risk.tier,
        JSON.stringify(risk.reasons),
        risk.nudgePolicy,
        'post_visit_previsit_brief_v1',
        options.actorUserId || null,
        JSON.stringify({
          regenerated: options.forceRefresh === true,
          latest_session_id: latestSessionId,
        }),
        deliveredAt,
      ],
    );

    const briefRow = upsertedRows[0];
    if (
      this.hipaaAuditService &&
      (options.actorUserId || options.fromJob) &&
      appointment.patient_id
    ) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId || 'system',
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_UPDATE,
          'post_visit_previsit_brief',
          briefRow.id,
          appointment.patient_id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          { appointmentId, fromJob: options.fromJob === true },
        )
        .catch(() => {});
      await this.hipaaAuditService
        .logPhiAccess(
          tenantDb,
          options.actorUserId || 'system',
          '',
          undefined,
          HipaaAuditAction.APPOINTMENT_VIEW,
          'post_visit_previsit_brief',
          briefRow.id,
          appointment.patient_id,
          undefined,
          undefined,
          undefined,
          { fields: ['brief_content', 'follow_up_risk'], recordCount: 1 },
          { appointmentId },
        )
        .catch(() => {});
    }

    if (
      (risk.tier === 'high' || risk.tier === 'critical') &&
      briefRow?.id &&
      appointment.patient_id
    ) {
      await tenantDb
        .query(
          `
            INSERT INTO post_visit_coordinator_tasks (
              brief_id,
              appointment_id,
              patient_id,
              risk_tier,
              nudge_policy,
              status
            ) VALUES ($1,$2,$3,$4,$5,'pending')
            ON CONFLICT (brief_id) DO UPDATE SET
              risk_tier = EXCLUDED.risk_tier,
              nudge_policy = EXCLUDED.nudge_policy,
              updated_at = NOW()
          `,
          [
            briefRow.id,
            appointmentId,
            appointment.patient_id,
            risk.tier,
            risk.nudgePolicy || null,
          ],
        )
        .catch(() => {});
    }

    return {
      featureEnabled: true,
      ...this.mapPreVisitBrief(briefRow),
      reused: false,
    };
  }

  /**
   * Generate pre-visit briefs for appointments starting within the given window (e.g. next 60 minutes).
   * Intended to be called by a cron/scheduler. When feature flag is off, skips generation.
   */
  async generatePreVisitBriefsForUpcomingAppointments(
    tenantDb: DataSource,
    options: { withinMinutes?: number } = {},
  ): Promise<{ generated: number; skipped: number; errors: Array<{ appointmentId: string; error: string }> }> {
    await this.ensurePostVisitSchema(tenantDb);
    const withinMinutes = Math.min(1440, Math.max(1, Number(options.withinMinutes) || 60));
    const appointmentRows = await tenantDb.query(
      `
        SELECT id
        FROM appointments
        WHERE appointment_date >= NOW()
          AND appointment_date <= NOW() + ($1::int * interval '1 minute')
          AND status IN ('scheduled','confirmed')
        ORDER BY appointment_date ASC
      `,
      [withinMinutes],
    );
    let generated = 0;
    let skipped = 0;
    const errors: Array<{ appointmentId: string; error: string }> = [];
    if (!this.isPreVisitBriefEnabled()) {
      return { generated: 0, skipped: appointmentRows?.length || 0, errors: [] };
    }
    for (const row of appointmentRows || []) {
      const appointmentId = row?.id;
      if (!appointmentId) continue;
      try {
        const result = await this.generateAppointmentPreVisitBrief(tenantDb, appointmentId, {
          fromJob: true,
        });
        const reused = 'reused' in result && result.reused;
        if (result.featureEnabled && !reused) generated += 1;
        else if (reused) skipped += 1;
      } catch (e: any) {
        errors.push({
          appointmentId: String(appointmentId),
          error: e?.message || String(e),
        });
      }
    }
    return {
      generated,
      skipped: (appointmentRows?.length || 0) - generated - errors.length,
      errors,
    };
  }

  private buildAdminDocumentTemplate(args: {
    documentType: PostVisitAdminDocumentType;
    sessionRow: any;
    patientLabel: string | null;
    doctorLabel: string | null;
    summaryText: string;
    recommendationTitles: string[];
    note?: string | null;
    appointmentReason?: string | null;
  }) {
    const dateIssued = new Date().toISOString();
    const subjectLine = args.appointmentReason || 'Post-visit follow-up plan';
    const recommendations = args.recommendationTitles.slice(0, 8);
    const summary = args.summaryText || 'Clinician-reviewed post-visit summary available in chart.';

    if (args.documentType === 'referral_letter') {
      const title = `Referral Letter - ${args.patientLabel || 'Patient'}`;
      return {
        title,
        body: {
          templateVersion: 'd1.v1',
          templateType: 'referral_letter',
          issuedAt: dateIssued,
          patient: args.patientLabel,
          clinician: args.doctorLabel,
          subject: subjectLine,
          summary,
          referralReason: subjectLine,
          recommendedActions: recommendations,
          note: args.note || null,
        },
      };
    }

    if (args.documentType === 'sick_note') {
      const title = `Medical Sick Note - ${args.patientLabel || 'Patient'}`;
      return {
        title,
        body: {
          templateVersion: 'd1.v1',
          templateType: 'sick_note',
          issuedAt: dateIssued,
          patient: args.patientLabel,
          clinician: args.doctorLabel,
          clinicalSummary: summary,
          recommendationHighlights: recommendations,
          note: args.note || null,
        },
      };
    }

    const title = `Return-to-Work Certificate - ${args.patientLabel || 'Patient'}`;
    return {
      title,
      body: {
        templateVersion: 'd1.v1',
        templateType: 'return_to_work',
        issuedAt: dateIssued,
        patient: args.patientLabel,
        clinician: args.doctorLabel,
        clinicalSummary: summary,
        workReadinessBasis: recommendations.length ? recommendations : ['No active high-risk blockers in post-visit checklist.'],
        note: args.note || null,
      },
    };
  }

  async generateSessionAdminDocuments(
    tenantDb: DataSource,
    sessionId: string,
    payload: GeneratePostVisitAdminDocumentsDto = {},
    options: { actorUserId?: string | null } = {},
  ) {
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated doctor user is required to sign admin documents');
    }

    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    if (!this.isAdminDocumentsEnabled()) {
      return {
        featureEnabled: false,
        sessionId,
        documents: [],
        message: 'Post-visit admin document generation is disabled by feature flag.',
      };
    }

    const allowedTypes: PostVisitAdminDocumentType[] = ['referral_letter', 'sick_note', 'return_to_work'];
    const requestedTypes = Array.isArray(payload.documentTypes)
      ? payload.documentTypes
          .map((item) => String(item || '').trim().toLowerCase())
          .filter((item): item is PostVisitAdminDocumentType => allowedTypes.includes(item as PostVisitAdminDocumentType))
      : [];
    const documentTypes: PostVisitAdminDocumentType[] = requestedTypes.length ? Array.from(new Set(requestedTypes)) : allowedTypes;
    const signImmediately = payload.signImmediately !== false;

    const [patientRows, doctorRows] = await Promise.all([
      tenantDb.query(
        `
          SELECT id, first_name, last_name, patient_number
          FROM patients
          WHERE id = $1
          LIMIT 1
        `,
        [sessionRow.patient_id],
      ),
      sessionRow.doctor_id
        ? tenantDb.query(
            `
              SELECT id, first_name, last_name
              FROM users
              WHERE id = $1
              LIMIT 1
            `,
            [sessionRow.doctor_id],
          )
        : Promise.resolve([]),
    ]);

    const patientLabel = this.buildPatientDisplay(patientRows?.[0] || null);
    const doctorLabel = this.buildUserDisplay(doctorRows?.[0] || null);

    const [visitSummaryArtifact, recommendationArtifact, appointmentRows] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
      sessionRow.appointment_id
        ? tenantDb.query(`SELECT reason FROM appointments WHERE id = $1 LIMIT 1`, [sessionRow.appointment_id])
        : Promise.resolve([]),
    ]);

    const summaryText = String(visitSummaryArtifact?.content?.plain_language_summary || '').trim();
    const recommendationTitles = Array.isArray(recommendationArtifact?.content?.items)
      ? recommendationArtifact.content.items
          .map((item: any) => String(item?.title || '').trim())
          .filter((title: string) => title.length > 0)
      : [];
    const appointmentReason = String(appointmentRows?.[0]?.reason || '').trim() || null;

    const documents = [] as any[];
    for (const documentType of documentTypes) {
      const [versionRow] = await tenantDb.query(
        `
          SELECT COALESCE(MAX(version_no), 0)::int AS current_version
          FROM post_visit_admin_documents
          WHERE session_id = $1
            AND document_type = $2
        `,
        [sessionId, documentType],
      );
      const version = Number(versionRow?.current_version || 0) + 1;
      const template = this.buildAdminDocumentTemplate({
        documentType,
        sessionRow,
        patientLabel,
        doctorLabel,
        summaryText,
        recommendationTitles,
        note: payload.note || null,
        appointmentReason,
      });
      const immutableHash = createHash('sha256')
        .update(
          JSON.stringify({
            sessionId,
            documentType,
            version,
            patientId: sessionRow.patient_id,
            doctorId: sessionRow.doctor_id || null,
            signedBy: options.actorUserId,
            template,
          }),
        )
        .digest('hex');

      const insertedRows = await tenantDb.query(
        `
          INSERT INTO post_visit_admin_documents (
            session_id,
            patient_id,
            doctor_id,
            document_type,
            version_no,
            status,
            title,
            body_json,
            immutable_hash,
            signed_by,
            signed_at,
            metadata
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb
          )
          RETURNING *
        `,
        [
          sessionId,
          sessionRow.patient_id,
          sessionRow.doctor_id || null,
          documentType,
          version,
          signImmediately ? 'signed' : 'draft',
          template.title,
          JSON.stringify(template.body),
          immutableHash,
          signImmediately ? options.actorUserId : null,
          signImmediately ? new Date().toISOString() : null,
          JSON.stringify({
            source: 'post_visit_admin_docs_v1',
            note: payload.note || null,
            generated_by: options.actorUserId || null,
            sign_immediately: signImmediately,
          }),
        ],
      );

      if (insertedRows?.[0]) {
        documents.push(this.mapAdminDocument(insertedRows[0]));
      }
    }

    if (
      documents.length > 0 &&
      this.hipaaAuditService &&
      options.actorUserId &&
      sessionRow.patient_id
    ) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_CREATE,
          'post_visit_admin_document',
          sessionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionId,
          {
            documentCount: documents.length,
            documentTypes: documentTypes,
            signImmediately,
          },
        )
        .catch(() => {});
    }

    if (signImmediately && documents.length > 0) {
      for (const doc of documents) {
        await this.queueFhirWriteBack(tenantDb, {
          sessionId,
          resourceType: 'DocumentReference',
          resourceId: doc.id,
          operation: 'create',
        }).catch(() => {});
      }
    }

    return {
      featureEnabled: true,
      sessionId,
      generatedCount: documents.length,
      documents,
    };
  }

  async generateSessionReferralLetterDraft(
    tenantDb: DataSource,
    sessionId: string,
    payload: { recipientLabel?: string; referralReason?: string } = {},
    options: { tenantId?: string; actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    const [patientRows, doctorRows] = await Promise.all([
      tenantDb.query(
        `SELECT id, first_name, last_name, patient_number FROM patients WHERE id = $1 LIMIT 1`,
        [sessionRow.patient_id],
      ),
      sessionRow.doctor_id
        ? tenantDb.query(`SELECT id, first_name, last_name FROM users WHERE id = $1 LIMIT 1`, [sessionRow.doctor_id])
        : Promise.resolve([]),
    ]);

    const patientLabel = this.buildPatientDisplay(patientRows?.[0] || null);
    const doctorLabel = this.buildUserDisplay(doctorRows?.[0] || null);

    const [soapArtifact, visitSummaryArtifact, recommendationArtifact, transcriptRows] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'soap_note'),
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
      tenantDb.query(
        `SELECT segment_text FROM post_visit_transcript_segments WHERE session_id = $1 ORDER BY start_second ASC LIMIT 250`,
        [sessionId],
      ),
    ]);

    const transcriptText = (transcriptRows || [])
      .map((row: any) => String(row?.segment_text || '').trim())
      .filter(Boolean)
      .join('\n')
      .slice(0, 12000);

    const recommendationItems = Array.isArray(recommendationArtifact?.content?.items)
      ? recommendationArtifact.content.items
      : [];

    const llmResult = await this.groundedLlmService?.draftReferralLetter({
      sessionId,
      language: sessionRow.language || 'en',
      tenantId: options.tenantId,
      patientLabel,
      clinicianLabel: doctorLabel,
      recipientLabel: payload.recipientLabel || null,
      referralReason: payload.referralReason || null,
      soapNote: soapArtifact?.content?.soap_note || null,
      visitSummary: visitSummaryArtifact?.content || null,
      recommendationItems,
    });

    const fallback = this.buildAdminDocumentTemplate({
      documentType: 'referral_letter',
      sessionRow,
      patientLabel,
      doctorLabel,
      summaryText: String(visitSummaryArtifact?.content?.plain_language_summary || '').trim(),
      recommendationTitles: recommendationItems
        .map((item: any) => String(item?.title || '').trim())
        .filter((t: string) => t.length > 0),
      note: payload.referralReason || null,
      appointmentReason: payload.referralReason || null,
    });

    const content = {
      type: 'referral_letter_draft',
      generatedAt: new Date().toISOString(),
      patientLabel,
      clinicianLabel: doctorLabel,
      recipientLabel: payload.recipientLabel || null,
      referralReason: payload.referralReason || null,
      transcriptExcerpt: transcriptText ? transcriptText.slice(0, 2000) : null,
      letterText: llmResult?.letterText || null,
      fallbackTemplate: fallback,
      model: llmResult?.model || null,
      audit: llmResult?.audit || null,
      aiMetadata: llmResult?.aiMetadata || null,
      warnings: llmResult ? [] : ['LLM unavailable; fallback template only'],
    };

    const row = await this.upsertDraftArtifact(tenantDb, {
      sessionId,
      artifactType: 'referral_letter_draft',
      content,
      generatedBy: llmResult ? 'post_visit_grounded_llm' : 'post_visit_template_fallback',
      actorUserId: options.actorUserId || null,
      artifactStatus: 'draft',
    });

    return {
      sessionId,
      artifact: {
        id: row.id,
        type: row.artifact_type,
        status: row.artifact_status,
        content: row.content,
        citations: row.citations,
      },
    };
  }

  async generateSessionClinicalNoteDraft(
    tenantDb: DataSource,
    sessionId: string,
    payload: { includeTranscript?: boolean } = {},
    options: { tenantId?: string; actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    const [soapArtifact, visitSummaryArtifact, recommendationArtifact, transcriptRows] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'soap_note'),
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
      payload.includeTranscript === false
        ? Promise.resolve([])
        : tenantDb.query(
            `SELECT segment_text FROM post_visit_transcript_segments WHERE session_id = $1 ORDER BY start_second ASC LIMIT 300`,
            [sessionId],
          ),
    ]);

    const transcriptText = (transcriptRows || [])
      .map((row: any) => String(row?.segment_text || '').trim())
      .filter(Boolean)
      .join('\n')
      .slice(0, 12000);

    const recommendationItems = Array.isArray(recommendationArtifact?.content?.items)
      ? recommendationArtifact.content.items
      : [];

    const llmResult = await this.groundedLlmService?.draftClinicalNote({
      sessionId,
      language: sessionRow.language || 'en',
      tenantId: options.tenantId,
      transcriptText,
      soapNote: soapArtifact?.content?.soap_note || null,
      visitSummary: visitSummaryArtifact?.content || null,
      recommendationItems,
    });

    const content = {
      type: 'clinical_note_draft',
      generatedAt: new Date().toISOString(),
      noteText: llmResult?.noteText || '',
      model: llmResult?.model || null,
      audit: llmResult?.audit || null,
      aiMetadata: llmResult?.aiMetadata || null,
      transcriptIncluded: payload.includeTranscript !== false,
      warnings: llmResult ? [] : ['LLM unavailable; no clinical note draft generated'],
    };

    const row = await this.upsertDraftArtifact(tenantDb, {
      sessionId,
      artifactType: 'clinical_note_draft',
      content,
      generatedBy: llmResult ? 'post_visit_grounded_llm' : 'post_visit_grounded_llm_unavailable',
      actorUserId: options.actorUserId || null,
      artifactStatus: 'draft',
    });

    return {
      sessionId,
      artifact: {
        id: row.id,
        type: row.artifact_type,
        status: row.artifact_status,
        content: row.content,
        citations: row.citations,
      },
    };
  }

  async listSessionAdminDocuments(
    tenantDb: DataSource,
    sessionId: string,
    options: { actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    if (!this.isAdminDocumentsEnabled()) {
      return {
        featureEnabled: false,
        sessionId,
        documents: [],
        message: 'Post-visit admin document generation is disabled by feature flag.',
      };
    }

    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_admin_documents
        WHERE session_id = $1
        ORDER BY created_at DESC
      `,
      [sessionId],
    );

    if (
      this.hipaaAuditService &&
      (options.actorUserId || '') !== '' &&
      sessionRow.patient_id &&
      (rows?.length ?? 0) > 0
    ) {
      await this.hipaaAuditService
        .logPhiAccess(
          tenantDb,
          options.actorUserId!,
          '',
          undefined,
          HipaaAuditAction.PRINT_DOCUMENT,
          'post_visit_admin_document',
          sessionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          sessionId,
          { fields: ['title', 'body_json', 'document_type'], recordCount: rows.length },
          { sessionId },
        )
        .catch(() => {});
    }

    return {
      featureEnabled: true,
      sessionId,
      documents: rows.map((row: any) => this.mapAdminDocument(row)),
    };
  }

  /**
   * Mark a signed admin document as dispatched (e.g. sent to patient or external system).
   * Only documents with status 'signed' can be dispatched. Emits HIPAA audit.
   */
  async markAdminDocumentDispatched(
    tenantDb: DataSource,
    documentId: string,
    options: { actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const rows = await tenantDb.query(
      `SELECT id, session_id, patient_id, status FROM post_visit_admin_documents WHERE id = $1 LIMIT 1`,
      [documentId],
    );
    const doc = rows?.[0];
    if (!doc) {
      throw new NotFoundException('Admin document not found');
    }
    if (String(doc.status || '').toLowerCase() !== 'signed') {
      throw new BadRequestException('Only signed admin documents can be marked as dispatched');
    }
    await tenantDb.query(
      `UPDATE post_visit_admin_documents SET status = 'dispatched', updated_at = NOW() WHERE id = $1`,
      [documentId],
    );
    if (
      this.hipaaAuditService &&
      options.actorUserId &&
      doc.patient_id
    ) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_UPDATE,
          'post_visit_admin_document_dispatch',
          documentId,
          doc.patient_id,
          undefined,
          undefined,
          undefined,
          undefined,
          doc.session_id,
          { previousStatus: 'signed', newStatus: 'dispatched' },
        )
        .catch(() => {});
    }
    const [updated] = await tenantDb.query(
      `SELECT * FROM post_visit_admin_documents WHERE id = $1 LIMIT 1`,
      [documentId],
    );
    return {
      documentId,
      sessionId: doc.session_id,
      patientId: doc.patient_id,
      status: 'dispatched',
      document: updated ? this.mapAdminDocument(updated) : null,
    };
  }

  async executeVoiceReviewCommand(
    tenantDb: DataSource,
    sessionId: string,
    payload: ExecutePostVisitVoiceCommandDto,
    options: { tenantId?: string; actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated doctor user is required for voice review actions');
    }

    if (!this.isVoiceReviewEnabled()) {
      return {
        featureEnabled: false,
        sessionId,
        command: String(payload.command || ''),
        status: 'ignored',
        message: 'Voice review command execution is disabled by feature flag.',
      };
    }

    const normalizedCommand = this.normalizeVoiceCommand(payload.command);
    if (!normalizedCommand) {
      throw new BadRequestException(
        'Unsupported voice command. Supported commands: APPROVE_SUMMARY, APPROVE_BUNDLE, GENERATE_ADMIN_DOCS, REGENERATE_DRAFT, SIGN_AND_PUBLISH.',
      );
    }

    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const baseNote = String(payload.note || '').trim() || `Voice command ${normalizedCommand}`;
    let result: any = null;
    if (normalizedCommand === 'APPROVE_SUMMARY') {
      result = await this.reviewDraftArtifact(
        tenantDb,
        sessionId,
        {
          artifactType: 'visit_summary',
          action: 'accept',
          reason: baseNote,
          reviewMetadata: { channel: 'voice_command', command: normalizedCommand },
        },
        {
          tenantId: options.tenantId,
          actorUserId: options.actorUserId,
          source: 'post_visit_voice_command',
        },
      );
    } else if (normalizedCommand === 'APPROVE_BUNDLE') {
      result = await this.reviewDraftArtifact(
        tenantDb,
        sessionId,
        {
          artifactType: 'recommendation_bundle',
          action: 'accept',
          reason: baseNote,
          reviewMetadata: { channel: 'voice_command', command: normalizedCommand },
        },
        {
          tenantId: options.tenantId,
          actorUserId: options.actorUserId,
          source: 'post_visit_voice_command',
        },
      );
    } else if (normalizedCommand === 'GENERATE_ADMIN_DOCS') {
      result = await this.generateSessionAdminDocuments(
        tenantDb,
        sessionId,
        {
          signImmediately: true,
          note: baseNote,
        },
        {
          actorUserId: options.actorUserId,
        },
      );
    } else if (normalizedCommand === 'REGENERATE_DRAFT') {
      result = await this.generateDraftArtifacts(
        tenantDb,
        sessionId,
        {
          tenantId: options.tenantId,
          actorUserId: options.actorUserId,
          source: 'post_visit_voice_command',
          reason: baseNote,
        },
      );
    } else if (normalizedCommand === 'SIGN_AND_PUBLISH') {
      if (payload.confirmSignAndPublish !== true) {
        throw new BadRequestException('SIGN_AND_PUBLISH requires explicit confirmSignAndPublish=true.');
      }
      result = await this.publishSession(
        tenantDb,
        sessionId,
        {
          note: baseNote,
          publishMetadata: {
            ...(payload.publishMetadata || {}),
            command: normalizedCommand,
            channel: 'voice_command',
          },
        },
        {
          tenantId: options.tenantId,
          actorUserId: options.actorUserId,
          source: 'post_visit_voice_command',
        },
      );
    }

    if (
      this.hipaaAuditService &&
      options.actorUserId &&
      sessionRow.patient_id
    ) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_UPDATE,
          'post_visit_voice_command',
          sessionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionId,
          { command: normalizedCommand, channel: 'voice_command' },
        )
        .catch(() => {});
    }

    return {
      featureEnabled: true,
      sessionId,
      command: normalizedCommand,
      status: 'executed',
      result,
    };
  }

  private normalizeTrialSearchToken(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Returns only de-identified condition/search terms suitable for the external ClinicalTrials.gov API.
   * No raw PHI (names, MRN, free text) is included. Only whitelisted condition terms or filtered tokens are returned.
   */
  private deriveTrialSearchTerms(input: string): string[] {
    const normalized = this.normalizeTrialSearchToken(input);
    if (!normalized) return [];

    const conditionRules: Array<{ term: string; pattern: RegExp }> = [
      { term: 'hiv', pattern: /\bhiv\b|human immunodeficiency/ },
      { term: 'tuberculosis', pattern: /\btb\b|tuberculosis/ },
      { term: 'hypertension', pattern: /hypertension|blood pressure/ },
      { term: 'heart failure', pattern: /heart failure/ },
      { term: 'atrial fibrillation', pattern: /atrial fibrillation|afib/ },
      { term: 'diabetes', pattern: /diabetes|hyperglyc/ },
      { term: 'asthma', pattern: /asthma/ },
      { term: 'copd', pattern: /copd|chronic obstructive/ },
      { term: 'chronic kidney disease', pattern: /chronic kidney|renal/ },
      { term: 'stroke', pattern: /stroke|cerebrovascular/ },
      { term: 'depression', pattern: /depression|major depressive/ },
      { term: 'anxiety', pattern: /anxiety/ },
      { term: 'pregnancy', pattern: /pregnan|antenatal|maternal/ },
      { term: 'breast cancer', pattern: /breast cancer/ },
      { term: 'lung cancer', pattern: /lung cancer/ },
      { term: 'prostate cancer', pattern: /prostate cancer/ },
      { term: 'cancer', pattern: /\bcancer\b|oncology|tumou?r/ },
    ];

    const terms = new Set<string>();
    for (const rule of conditionRules) {
      if (rule.pattern.test(normalized)) {
        terms.add(rule.term);
      }
    }

    if (terms.size > 0) {
      return Array.from(terms).slice(0, 5);
    }

    const fallback = normalized
      .split(' ')
      .filter((token) => token.length >= 4)
      .filter((token) => !['with', 'from', 'this', 'that', 'have', 'been', 'were', 'patient', 'visit', 'follow', 'need'].includes(token))
      .slice(0, 6)
      .join(' ');
    return fallback ? [fallback] : [];
  }

  private extractTrialStudyCandidates(payload: any): Array<{
    trialId: string;
    trialTitle: string;
    trialPhase: string | null;
    trialStatus: string | null;
    conditions: string[];
    sourceUrl: string | null;
    eligibleSexes: Array<'male' | 'female'>;
    minAgeYears: number | null;
    maxAgeYears: number | null;
  }> {
    const studies = Array.isArray(payload?.studies)
      ? payload.studies
      : Array.isArray(payload?.data?.studies)
        ? payload.data.studies
        : Array.isArray(payload?.StudyFieldsResponse?.StudyFields)
          ? payload.StudyFieldsResponse.StudyFields
          : [];

    const results = [] as Array<{
      trialId: string;
      trialTitle: string;
      trialPhase: string | null;
      trialStatus: string | null;
      conditions: string[];
      sourceUrl: string | null;
      eligibleSexes: Array<'male' | 'female'>;
      minAgeYears: number | null;
      maxAgeYears: number | null;
    }>;

    for (const study of studies) {
      const module = study?.protocolSection || {};
      const id = String(
        study?.nctId ||
          module?.identificationModule?.nctId ||
          (Array.isArray(study?.NCTId) ? study.NCTId[0] : '') ||
          '',
      ).trim();
      if (!id) continue;

      const title = String(
        module?.identificationModule?.briefTitle ||
          study?.briefTitle ||
          (Array.isArray(study?.BriefTitle) ? study.BriefTitle[0] : '') ||
          '',
      ).trim();
      if (!title) continue;

      const phaseRaw =
        module?.designModule?.phases ||
        study?.phase ||
        (Array.isArray(study?.Phase) ? study.Phase[0] : null);
      const phase = Array.isArray(phaseRaw) ? String(phaseRaw[0] || '').trim() : String(phaseRaw || '').trim();

      const status = String(
        module?.statusModule?.overallStatus ||
          study?.overallStatus ||
          (Array.isArray(study?.OverallStatus) ? study.OverallStatus[0] : '') ||
          '',
      ).trim();

      const conditionsRaw =
        module?.conditionsModule?.conditions ||
        study?.conditions ||
        (Array.isArray(study?.Condition) ? study.Condition : []);
      const conditions = Array.isArray(conditionsRaw)
        ? conditionsRaw.map((entry: any) => String(entry || '').trim()).filter((entry: string) => entry.length > 0)
        : [];

      const eligibilityModule = module?.eligibilityModule || {};
      const sexRaw = String(
        eligibilityModule?.sex ||
          study?.sex ||
          (Array.isArray(study?.Gender) ? study.Gender[0] : '') ||
          '',
      )
        .trim()
        .toLowerCase();
      const eligibleSexes: Array<'male' | 'female'> =
        sexRaw === 'male'
          ? ['male']
          : sexRaw === 'female'
            ? ['female']
            : ['male', 'female'];

      const minimumAgeRaw =
        eligibilityModule?.minimumAge ||
        study?.minimumAge ||
        (Array.isArray(study?.MinimumAge) ? study.MinimumAge[0] : null);
      const maximumAgeRaw =
        eligibilityModule?.maximumAge ||
        study?.maximumAge ||
        (Array.isArray(study?.MaximumAge) ? study.MaximumAge[0] : null);
      const minAgeYears = this.parseTrialAgeYears(minimumAgeRaw);
      const maxAgeYears = this.parseTrialAgeYears(maximumAgeRaw);

      const clinicalTrialsStudyBaseUrl = String(
        process.env.POSTVISIT_CLINICALTRIALS_STUDY_BASE_URL || env.POSTVISIT_CLINICALTRIALS_STUDY_BASE_URL || '',
      ).replace(/\/+$/, '');
      const sourceUrl = clinicalTrialsStudyBaseUrl ? `${clinicalTrialsStudyBaseUrl}/${id}` : null;
      results.push({
        trialId: id,
        trialTitle: title,
        trialPhase: phase || null,
        trialStatus: status || null,
        conditions,
        sourceUrl,
        eligibleSexes,
        minAgeYears,
        maxAgeYears,
      });
    }

    return results;
  }

  private parseTrialAgeYears(rawValue: any): number | null {
    const raw = String(rawValue || '').trim().toLowerCase();
    if (!raw || raw === 'n/a' || raw === 'na') {
      return null;
    }
    const match = raw.match(/(\d+(?:\.\d+)?)\s*(year|years|month|months|week|weeks|day|days)/i);
    if (!match) {
      const numeric = Number(raw.replace(/[^0-9.]/g, ''));
      return Number.isFinite(numeric) ? numeric : null;
    }
    const value = Number(match[1]);
    if (!Number.isFinite(value)) {
      return null;
    }
    const unit = String(match[2] || '').toLowerCase();
    if (unit.startsWith('month')) return value / 12;
    if (unit.startsWith('week')) return value / 52;
    if (unit.startsWith('day')) return value / 365;
    return value;
  }

  private calculateAgeInYears(dateOfBirth: any): number | null {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  }

  private normalizeSexLabel(value: any): 'male' | 'female' | null {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (['male', 'm'].includes(normalized)) return 'male';
    if (['female', 'f'].includes(normalized)) return 'female';
    return null;
  }

  private async getPatientTrialEligibilityContext(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
        SELECT date_of_birth, gender
        FROM patients
        WHERE id = $1
        LIMIT 1
      `,
      [patientId],
    );
    const row = rows?.[0] || null;
    return {
      ageYears: this.calculateAgeInYears(row?.date_of_birth),
      sex: this.normalizeSexLabel(row?.gender),
    };
  }

  private scoreTrialMatchCandidate(args: {
    trial: {
      trialId: string;
      trialTitle: string;
      trialPhase: string | null;
      trialStatus: string | null;
      conditions: string[];
      sourceUrl: string | null;
      eligibleSexes: Array<'male' | 'female'>;
      minAgeYears: number | null;
      maxAgeYears: number | null;
    };
    searchTerms: string[];
    patient: {
      ageYears: number | null;
      sex: 'male' | 'female' | null;
    };
  }) {
    const rationale: string[] = [];
    let score = 30;
    const loweredTitle = this.normalizeTrialSearchToken(args.trial.trialTitle);
    const loweredConditions = args.trial.conditions.map((item) => this.normalizeTrialSearchToken(item));

    let termMatches = 0;
    for (const term of args.searchTerms) {
      const normalizedTerm = this.normalizeTrialSearchToken(term);
      const matchInTitle = loweredTitle.includes(normalizedTerm);
      const matchInCondition = loweredConditions.some((condition) => condition.includes(normalizedTerm));
      if (matchInTitle || matchInCondition) {
        termMatches += 1;
      }
    }
    if (termMatches > 0) {
      score += Math.min(30, termMatches * 12);
      rationale.push(`Matched ${termMatches} condition/search term(s) from post-visit context.`);
    }

    const status = String(args.trial.trialStatus || '').toLowerCase();
    if (status.includes('recruit')) {
      score += 20;
      rationale.push('Trial status indicates actively recruiting.');
    } else if (status.includes('active')) {
      score += 10;
      rationale.push('Trial status is active.');
    } else if (status.length > 0) {
      score -= 8;
      rationale.push(`Trial status is ${args.trial.trialStatus}; recruitment may be limited.`);
    }

    const phase = String(args.trial.trialPhase || '').toLowerCase();
    if (phase.includes('phase 3') || phase.includes('phase 4')) {
      score += 8;
      rationale.push('Late-phase trial often has mature protocol pathways.');
    } else if (phase.includes('phase 1')) {
      score -= 3;
      rationale.push('Early-phase trial may have stricter eligibility and experimental interventions.');
    }

    if (args.patient.sex) {
      if (Array.isArray(args.trial.eligibleSexes) && args.trial.eligibleSexes.length > 0) {
        if (args.trial.eligibleSexes.includes(args.patient.sex)) {
          score += 10;
          rationale.push(`Sex eligibility aligned (${args.patient.sex}).`);
        } else {
          score -= 35;
          rationale.push('Sex eligibility mismatch with trial criteria.');
        }
      }
    } else {
      rationale.push('Patient sex unavailable for strict eligibility filtering.');
    }

    if (args.patient.ageYears !== null && args.patient.ageYears !== undefined) {
      if (
        args.trial.minAgeYears !== null &&
        args.trial.minAgeYears !== undefined &&
        args.patient.ageYears < args.trial.minAgeYears
      ) {
        score -= 30;
        rationale.push(`Patient age below minimum (${Math.floor(args.trial.minAgeYears)}y).`);
      } else if (
        args.trial.maxAgeYears !== null &&
        args.trial.maxAgeYears !== undefined &&
        args.patient.ageYears > args.trial.maxAgeYears
      ) {
        score -= 30;
        rationale.push(`Patient age above maximum (${Math.floor(args.trial.maxAgeYears)}y).`);
      } else if (
        (args.trial.minAgeYears !== null && args.trial.minAgeYears !== undefined) ||
        (args.trial.maxAgeYears !== null && args.trial.maxAgeYears !== undefined)
      ) {
        score += 10;
        rationale.push(`Age appears within trial bounds (${args.patient.ageYears}y).`);
      }
    } else {
      rationale.push('Patient age unavailable for strict eligibility filtering.');
    }

    score = Math.max(0, Math.min(100, score));
    if (rationale.length === 0) {
      rationale.push('General candidate trial based on available context.');
    }

    return {
      score,
      rationale,
    };
  }

  /**
   * Fetches trial candidates from external API. Called only with de-identified search terms from deriveTrialSearchTerms.
   * No PHI is sent to the external API.
   */
  private async fetchClinicalTrialCandidates(searchTerms: string[]) {
    const apiUrl = this.resolveClinicalTrialsApiUrl();
    const candidates = [] as Array<{
      trialId: string;
      trialTitle: string;
      trialPhase: string | null;
      trialStatus: string | null;
      conditions: string[];
      sourceUrl: string | null;
      eligibleSexes: Array<'male' | 'female'>;
      minAgeYears: number | null;
      maxAgeYears: number | null;
    }>;

    for (const term of searchTerms.slice(0, 4)) {
      try {
        const response = await axios.get(apiUrl, {
          params: {
            'query.term': term,
            pageSize: 8,
            format: 'json',
          },
          timeout: 12000,
        });
        const parsed = this.extractTrialStudyCandidates(response.data);
        candidates.push(...parsed);
      } catch {
        // External trial lookup is best-effort and should not block doctor workflows.
      }
    }

    const deduped = new Map<string, typeof candidates[0]>();
    for (const item of candidates) {
      if (!item?.trialId) continue;
      if (!deduped.has(item.trialId)) {
        deduped.set(item.trialId, item);
      }
    }
    return Array.from(deduped.values());
  }

  private async refreshSessionTrialMatches(
    tenantDb: DataSource,
    sessionRow: any,
    actorUserId?: string | null,
  ) {
    const [visitSummaryArtifact, recommendationArtifact] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionRow.id, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionRow.id, 'recommendation_bundle'),
    ]);

    const summaryText = String(visitSummaryArtifact?.content?.plain_language_summary || '').trim();
    const recommendationText = Array.isArray(recommendationArtifact?.content?.items)
      ? recommendationArtifact.content.items
          .map((item: any) => `${String(item?.title || '').trim()} ${String(item?.description || '').trim()}`)
          .join(' ')
      : '';
    const searchTerms = this.deriveTrialSearchTerms([summaryText, recommendationText].filter(Boolean).join(' '));

    if (searchTerms.length === 0) {
      return [];
    }

    const patientEligibility = await this.getPatientTrialEligibilityContext(tenantDb, sessionRow.patient_id);
    const trialCandidates = await this.fetchClinicalTrialCandidates(searchTerms);
    const scoredCandidates = trialCandidates
      .map((candidate) => {
        const scoring = this.scoreTrialMatchCandidate({
          trial: candidate,
          searchTerms,
          patient: patientEligibility,
        });
        return {
          ...candidate,
          eligibilityScore: scoring.score,
          eligibilityRationale: scoring.rationale,
        };
      })
      .sort((left, right) => right.eligibilityScore - left.eligibilityScore)
      .slice(0, 15);

    for (const match of scoredCandidates) {
      await tenantDb.query(
        `
          INSERT INTO post_visit_trial_matches (
            session_id,
            patient_id,
            trial_source,
            trial_id,
            trial_title,
            trial_phase,
            trial_status,
            condition_tags,
            source_url,
            eligibility_score,
            eligibility_rationale,
            metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb)
          ON CONFLICT (session_id, trial_id)
          DO UPDATE SET
            trial_title = EXCLUDED.trial_title,
            trial_phase = EXCLUDED.trial_phase,
            trial_status = EXCLUDED.trial_status,
            condition_tags = EXCLUDED.condition_tags,
            source_url = EXCLUDED.source_url,
            eligibility_score = EXCLUDED.eligibility_score,
            eligibility_rationale = EXCLUDED.eligibility_rationale,
            metadata = COALESCE(post_visit_trial_matches.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            updated_at = NOW()
        `,
        [
          sessionRow.id,
          sessionRow.patient_id,
          'clinicaltrials_gov_v2',
          match.trialId,
          match.trialTitle,
          match.trialPhase,
          match.trialStatus,
          JSON.stringify(match.conditions),
          match.sourceUrl,
          match.eligibilityScore,
          JSON.stringify(match.eligibilityRationale),
          JSON.stringify({
            refreshed_by: actorUserId || null,
            refreshed_at: new Date().toISOString(),
            search_terms: searchTerms,
            patient_eligibility_context: patientEligibility,
            trial_eligibility_profile: {
              eligible_sexes: match.eligibleSexes,
              min_age_years: match.minAgeYears,
              max_age_years: match.maxAgeYears,
            },
          }),
        ],
      );
    }

    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_trial_matches
        WHERE session_id = $1
        ORDER BY eligibility_score DESC, created_at DESC
      `,
      [sessionRow.id],
    );
    return rows;
  }

  private async resolveTrialSlaFanoutRecipients(
    tenantDb: DataSource,
    args: { sessionId: string; routeTarget: 'doctor' | 'nurse' | 'emergency' },
  ) {
    const maxRecipients = this.getTrialSlaMaxRecipients();
    if (args.routeTarget === 'doctor') {
      const doctorRows = await tenantDb.query(
        `
          SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.phone,
            u.email,
            u.role
          FROM post_visit_sessions s
          LEFT JOIN users u ON u.id = s.doctor_id
          WHERE s.id = $1
            AND u.id IS NOT NULL
          LIMIT 1
        `,
        [args.sessionId],
      );
      if (doctorRows?.length) {
        return doctorRows;
      }

      return tenantDb.query(
        `
          SELECT id, first_name, last_name, phone, email, role
          FROM users
          WHERE role IN ('doctor', 'physician')
            AND is_active = true
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT $1
        `,
        [1],
      );
    }

    const nurseRows = await tenantDb.query(
      `
        SELECT id, first_name, last_name, phone, email, role
        FROM users
        WHERE role IN ('nurse', 'nurse_accounts')
          AND is_active = true
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $1
      `,
      [maxRecipients],
    );
    if (nurseRows?.length) return nurseRows;

    return tenantDb.query(
      `
        SELECT id, first_name, last_name, phone, email, role
        FROM users
        WHERE role IN ('doctor', 'physician')
          AND is_active = true
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `,
    );
  }

  private async sendTrialSlaInboxNotification(
    tenantDb: DataSource,
    args: {
      escalationId: string;
      sessionId: string;
      patientId: string;
      recipientId: string;
      recipientRole: string | null;
      subject: string;
      messageText: string;
      isUrgent: boolean;
    },
  ) {
    const tableRows = await tenantDb.query(
      `
        SELECT
          to_regclass('message_threads') AS message_threads_table,
          to_regclass('provider_messages') AS provider_messages_table
      `,
    );
    const tables = tableRows?.[0] || {};
    if (!tables.message_threads_table || !tables.provider_messages_table) {
      return false;
    }

    const sessionRows = await tenantDb.query(
      `
        SELECT doctor_id, appointment_id
        FROM post_visit_sessions
        WHERE id = $1
        LIMIT 1
      `,
      [args.sessionId],
    );
    const sessionRow = sessionRows?.[0] || {};
    const senderId = sessionRow.doctor_id || args.recipientId;
    if (!senderId) return false;

    const participants = Array.from(new Set([String(senderId), String(args.recipientId)].filter(Boolean)));
    const threadRows = await tenantDb.query(
      `
        INSERT INTO message_threads (
          subject,
          patient_id,
          related_entity_type,
          related_entity_id,
          participants,
          last_message_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
        RETURNING id
      `,
      [args.subject, args.patientId, 'post_visit_escalation', args.escalationId, JSON.stringify(participants)],
    );
    const threadId = threadRows?.[0]?.id;
    if (!threadId) return false;

    await tenantDb.query(
      `
        INSERT INTO provider_messages (
          thread_id,
          sender_id,
          recipient_id,
          recipient_role,
          recipient_team,
          subject,
          message_text,
          message_type,
          priority,
          status,
          patient_id,
          appointment_id,
          related_entity_type,
          related_entity_id,
          requires_response,
          response_required_by,
          is_urgent,
          sent_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW() + INTERVAL '2 hours',$16,NOW()
        )
      `,
      [
        threadId,
        senderId,
        args.recipientId,
        args.recipientRole || null,
        null,
        args.subject,
        args.messageText,
        'message',
        args.isUrgent ? 'high' : 'normal',
        'sent',
        args.patientId,
        sessionRow.appointment_id || null,
        'post_visit_escalation',
        args.escalationId,
        true,
        args.isUrgent === true,
      ],
    );
    return true;
  }

  private async sendTrialDecisionSlaFanout(
    tenantDb: DataSource,
    args: {
      escalationId: string;
      sessionId: string;
      patientId: string;
      routeTarget: 'doctor' | 'nurse' | 'emergency';
      severity: TrialSlaNotificationSeverity;
      trialTitle: string | null;
      trialId: string | null;
      staleHours: number;
      slaHours: number;
    },
  ) {
    const emailMinSeverity = this.getTrialSlaEmailMinSeverity();
    const smsMinSeverity = this.getTrialSlaSmsMinSeverity();
    const shouldSendEmail = this.isSeverityAtLeast(args.severity, emailMinSeverity);
    const shouldSendSms = this.isSeverityAtLeast(args.severity, smsMinSeverity);

    const channels = {
      inAppQueue: true,
      inAppRecipientCount: 0,
      inAppInboxSentCount: 0,
      emailSentCount: 0,
      smsSentCount: 0,
      emailPolicyMinSeverity: emailMinSeverity,
      smsPolicyMinSeverity: smsMinSeverity,
      recipients: [] as Array<{ id: string; role: string | null; label: string }>,
      errors: [] as string[],
    };

    const [patientRows, recipientRows] = await Promise.all([
      tenantDb.query(
        `
          SELECT id, first_name, last_name, patient_number
          FROM patients
          WHERE id = $1
          LIMIT 1
        `,
        [args.patientId],
      ),
      this.resolveTrialSlaFanoutRecipients(tenantDb, {
        sessionId: args.sessionId,
        routeTarget: args.routeTarget,
      }),
    ]);

    const patientRow = patientRows?.[0] || null;
    const patientLabel = [patientRow?.first_name, patientRow?.last_name].filter(Boolean).join(' ').trim() || 'Patient';
    const trialLabel = String(args.trialTitle || args.trialId || 'trial candidate').trim();
    const staleHoursRounded = Math.round(Number(args.staleHours || 0) * 10) / 10;

    const notificationSubject = `Trial decision SLA breach (${args.severity.toUpperCase()})`;
    const notificationText =
      `Post-visit trial decision SLA breached for ${patientLabel}: ${trialLabel}. ` +
      `Age ${staleHoursRounded}h (SLA ${args.slaHours}h).` +
      ` Escalation ID: ${args.escalationId}.`;

    const seenRecipientIds = new Set<string>();
    const uniqueRecipients = (Array.isArray(recipientRows) ? recipientRows : []).filter((row: any) => {
      const key = String(row?.id || '').trim();
      if (!key) return false;
      if (seenRecipientIds.has(key)) return false;
      seenRecipientIds.add(key);
      return true;
    });

    channels.inAppRecipientCount = uniqueRecipients.length;
    channels.recipients = uniqueRecipients.map((row: any) => ({
      id: String(row.id),
      role: row.role || null,
      label: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || String(row.id),
    }));

    for (const recipient of uniqueRecipients) {
      try {
        const delivered = await this.sendTrialSlaInboxNotification(tenantDb, {
          escalationId: args.escalationId,
          sessionId: args.sessionId,
          patientId: args.patientId,
          recipientId: String(recipient.id),
          recipientRole: recipient.role || null,
          subject: notificationSubject,
          messageText: notificationText,
          isUrgent: args.severity === 'high' || args.severity === 'critical',
        });
        if (delivered) {
          channels.inAppInboxSentCount += 1;
        }
      } catch (error: any) {
        channels.errors.push(`in_app_inbox:${String(error?.message || error)}`);
      }
    }

    if (this.emailService && shouldSendEmail) {
      for (const recipient of uniqueRecipients) {
        if (!recipient?.email) continue;
        try {
          await this.emailService.sendEmail({
            to: recipient.email,
            subject: notificationSubject,
            text: notificationText,
          });
          channels.emailSentCount += 1;
        } catch (error: any) {
          channels.errors.push(`email:${String(error?.message || error)}`);
        }
      }
    }

    if (this.notificationsService && shouldSendSms) {
      for (const recipient of uniqueRecipients) {
        if (!recipient?.phone) continue;
        try {
          await this.notificationsService.sendSms(
            {
              phone: recipient.phone,
              message: notificationText.slice(0, 300),
            },
            tenantDb,
          );
          channels.smsSentCount += 1;
        } catch (error: any) {
          channels.errors.push(`sms:${String(error?.message || error)}`);
        }
      }
    }

    return channels;
  }

  private async ensureTrialDecisionSlaEscalations(
    tenantDb: DataSource,
    filters: {
      sessionId?: string;
      limit?: number;
    } = {},
  ) {
    if (!this.isTrialMatcherEnabled()) {
      return {
        staleCandidates: 0,
        insertedEscalations: 0,
      };
    }

    const slaHours = this.getTrialDecisionSlaHours();
    const routeTarget = this.getTrialDecisionEscalationRouteTarget();
    const limit = Math.min(Math.max(Number(filters.limit || 150), 1), 500);
    const conditions: string[] = [
      `tm.match_status IN ('proposed','deferred')`,
      `EXTRACT(EPOCH FROM (NOW() - COALESCE(tm.reviewed_at, tm.created_at))) / 3600 >= $1`,
    ];
    const params: any[] = [slaHours];
    let paramIndex = 2;

    if (filters.sessionId) {
      conditions.push(`tm.session_id = $${paramIndex++}`);
      params.push(filters.sessionId);
    }

    const staleRows = await tenantDb.query(
      `
        SELECT
          tm.id,
          tm.session_id,
          tm.patient_id,
          tm.trial_id,
          tm.trial_title,
          tm.match_status,
          tm.eligibility_score,
          tm.created_at,
          tm.reviewed_at
        FROM post_visit_trial_matches tm
        WHERE ${conditions.join(' AND ')}
        ORDER BY COALESCE(tm.reviewed_at, tm.created_at) ASC
        LIMIT $${paramIndex}
      `,
      [...params, limit],
    );

    let insertedEscalations = 0;
    for (const row of staleRows) {
      const existingRows = await tenantDb.query(
        `
          SELECT id
          FROM post_visit_escalation_events
          WHERE session_id = $1
            AND status IN ('open', 'acknowledged')
            AND trigger_type = 'trial_decision_sla_breach'
            AND (metadata->>'trial_match_id') = $2
          LIMIT 1
        `,
        [row.session_id, row.id],
      );
      if (existingRows?.length) {
        continue;
      }

      const staleHours = this.computeTrialDecisionAgeHours(row.created_at, row.reviewed_at);
      const severity: 'moderate' | 'high' = staleHours >= slaHours * 2 ? 'high' : 'moderate';

      const insertedRows = await tenantDb.query(
        `
          INSERT INTO post_visit_escalation_events (
            session_id,
            patient_id,
            status,
            severity,
            route_target,
            trigger_type,
            trigger_terms,
            signal_text,
            classification_confidence,
            classification_temporality,
            classification_source,
            classification_reason,
            classification_stage,
            detected_at,
            sla_due_at,
            workflow_key,
            metadata
          ) VALUES (
            $1,$2,'open',$3,$4,'trial_decision_sla_breach',$5::jsonb,$6,$7,'current','rule_engine',$8,'trial_sla_v1',NOW(),NOW() + INTERVAL '2 hours','post_visit_trial_decision_sla',$9::jsonb
          )
          RETURNING *
        `,
        [
          row.session_id,
          row.patient_id,
          severity,
          routeTarget,
          JSON.stringify([row.match_status, row.trial_id].filter(Boolean)),
          `Trial decision overdue for ${String(row.trial_title || row.trial_id || 'candidate trial').trim()}.`,
          0.99,
          `Trial decision pending beyond ${slaHours}h SLA threshold.`,
          JSON.stringify({
            trial_match_id: row.id,
            trial_id: row.trial_id || null,
            trial_title: row.trial_title || null,
            match_status: row.match_status || null,
            eligibility_score: row.eligibility_score === null || row.eligibility_score === undefined ? null : Number(row.eligibility_score),
            stale_hours: Math.round(staleHours * 10) / 10,
            sla_hours: slaHours,
            route_policy: routeTarget,
            source: 'post_visit_trial_sla_automation',
          }),
        ],
      );
      insertedEscalations += 1;

      const insertedEscalation = insertedRows?.[0] || null;
      if (insertedEscalation?.id) {
        try {
          const fanout = await this.sendTrialDecisionSlaFanout(tenantDb, {
            escalationId: insertedEscalation.id,
            sessionId: row.session_id,
            patientId: row.patient_id,
            routeTarget,
            severity,
            trialTitle: row.trial_title || null,
            trialId: row.trial_id || null,
            staleHours,
            slaHours,
          });
          await tenantDb.query(
            `
              UPDATE post_visit_escalation_events
              SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                  updated_at = NOW()
              WHERE id = $1
            `,
            [
              insertedEscalation.id,
              JSON.stringify({
                notification_fanout: fanout,
              }),
            ],
          );
        } catch {
          // Notification fanout is best-effort and must not block SLA escalation persistence.
        }
      }
    }

    return {
      staleCandidates: staleRows.length,
      insertedEscalations,
    };
  }

  async listSessionTrialMatches(
    tenantDb: DataSource,
    sessionId: string,
    options: { refresh?: boolean; actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    if (!this.isTrialMatcherEnabled()) {
      return {
        featureEnabled: false,
        sessionId,
        matches: [],
        summary: {
          total: 0,
          proposed: 0,
          considered: 0,
          deferred: 0,
          excluded: 0,
          enrolled: 0,
        },
        message: 'Clinical trial matcher is disabled by feature flag.',
      };
    }

    let rows = await tenantDb.query(
      `
        SELECT
          id,
          session_id,
          patient_id,
          trial_source,
          trial_id,
          trial_title,
          trial_phase,
          trial_status,
          condition_tags,
          source_url,
          eligibility_score,
          eligibility_rationale,
          match_status,
          review_note,
          reviewed_by,
          reviewed_at,
          metadata,
          created_at,
          updated_at
        FROM post_visit_trial_matches
        WHERE session_id = $1
        ORDER BY eligibility_score DESC, created_at DESC
      `,
      [sessionId],
    );

    if (options.refresh === true || !rows.length) {
      rows = await this.refreshSessionTrialMatches(tenantDb, sessionRow, options.actorUserId);
    }
    await this.ensureTrialDecisionSlaEscalations(tenantDb, {
      sessionId,
      limit: 80,
    });

    const matches = rows.map((row: any) => this.mapTrialMatch(row));
    const summary = {
      total: matches.length,
      proposed: matches.filter((item: any) => item.matchStatus === 'proposed').length,
      considered: matches.filter((item: any) => item.matchStatus === 'considered').length,
      deferred: matches.filter((item: any) => item.matchStatus === 'deferred').length,
      excluded: matches.filter((item: any) => item.matchStatus === 'excluded').length,
      enrolled: matches.filter((item: any) => item.matchStatus === 'enrolled').length,
    };

    if (
      this.hipaaAuditService &&
      options.actorUserId &&
      sessionRow.patient_id &&
      matches.length > 0
    ) {
      await this.hipaaAuditService
        .logPhiAccess(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_VIEW,
          'post_visit_trial_matches',
          sessionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          sessionId,
          { fields: ['matches', 'eligibility'], recordCount: matches.length },
          { sessionId },
        )
        .catch(() => {});
    }

    return {
      featureEnabled: true,
      sessionId,
      matches,
      summary,
    };
  }

  async reviewTrialMatch(
    tenantDb: DataSource,
    sessionId: string,
    matchId: string,
    payload: ReviewPostVisitTrialMatchDto,
    options: { actorUserId?: string | null } = {},
  ) {
    const statusMap: Record<PostVisitTrialReviewAction, PostVisitTrialMatchStatus> = {
      consider: 'considered',
      defer: 'deferred',
      exclude: 'excluded',
      enroll: 'enrolled',
    };

    const nextStatus = statusMap[payload.action as PostVisitTrialReviewAction];
    if (!nextStatus) {
      throw new BadRequestException('Invalid trial review action');
    }

    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    const existingRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_trial_matches
        WHERE id = $1
          AND session_id = $2
        LIMIT 1
      `,
      [matchId, sessionId],
    );
    const existing = existingRows?.[0];
    if (!existing) {
      throw new NotFoundException('Trial match not found for this post-visit session');
    }

    const previousStatus = (existing.match_status || 'proposed') as PostVisitTrialMatchStatus;
    const rows = await tenantDb.query(
      `
        UPDATE post_visit_trial_matches
        SET match_status = $3,
            reviewed_by = $4,
            reviewed_at = NOW(),
            review_note = $5,
            metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
            updated_at = NOW()
        WHERE id = $1
          AND session_id = $2
        RETURNING *
      `,
      [
        matchId,
        sessionId,
        nextStatus,
        options.actorUserId || null,
        payload.note || null,
        JSON.stringify({
          review_action: payload.action,
          reviewed_at: new Date().toISOString(),
        }),
      ],
    );

    if (!rows?.length) {
      throw new NotFoundException('Trial match not found for this post-visit session');
    }
    const updated = rows[0];

    await tenantDb.query(
      `
        INSERT INTO post_visit_trial_match_audit_log (
          session_id,
          trial_match_id,
          patient_id,
          action,
          previous_status,
          next_status,
          note,
          acted_by,
          acted_at,
          metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9::jsonb)
      `,
      [
        sessionId,
        matchId,
        sessionRow.patient_id,
        payload.action,
        previousStatus,
        nextStatus,
        payload.note || null,
        options.actorUserId || null,
        JSON.stringify({
          trial_id: updated.trial_id || null,
          trial_title: updated.trial_title || null,
          eligibility_score: updated.eligibility_score ?? null,
          source: 'post_visit_doctor_trial_review',
        }),
      ],
    );

    await tenantDb.query(
      `
        UPDATE post_visit_escalation_events
        SET status = 'resolved',
            resolved_at = NOW(),
            resolved_by = COALESCE($3, resolved_by),
            resolution_note = COALESCE($4, resolution_note),
            updated_at = NOW()
        WHERE session_id = $1
          AND trigger_type = 'trial_decision_sla_breach'
          AND status IN ('open','acknowledged')
          AND (metadata->>'trial_match_id') = $2
      `,
      [
        sessionId,
        matchId,
        options.actorUserId || null,
        `Automatically resolved after trial decision action: ${payload.action}`,
      ],
    );

    if (
      this.hipaaAuditService &&
      options.actorUserId &&
      sessionRow.patient_id
    ) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_UPDATE,
          'post_visit_trial_match_review',
          matchId,
          sessionRow.patient_id,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionId,
          { action: payload.action, previousStatus, nextStatus },
        )
        .catch(() => {});
    }

    return {
      sessionId,
      action: payload.action,
      match: this.mapTrialMatch(updated),
    };
  }

  async listTrialMatchAuditLog(
    tenantDb: DataSource,
    sessionId: string,
    matchId: string,
    options: { limit?: number } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);
    const limit = Math.min(Math.max(Number(options.limit || 50), 1), 200);
    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_trial_match_audit_log
        WHERE session_id = $1
          AND trial_match_id = $2
        ORDER BY acted_at DESC, created_at DESC
        LIMIT $3
      `,
      [sessionId, matchId, limit],
    );
    const entries = rows.map((row: any) => this.mapTrialMatchAuditRow(row));
    return {
      sessionId,
      matchId,
      entries,
      summary: {
        total: entries.length,
        lastAction: entries.length > 0 ? entries[0].action : null,
      },
    };
  }

  /**
   * Log a FHIR write-back attempt to fhir_sync_log. Used for audit and retry queue.
   */
  async logFhirSyncAttempt(
    tenantDb: DataSource,
    params: {
      tenantId?: string | null;
      sessionId?: string | null;
      resourceType: string;
      resourceId: string;
      fhirResourceId?: string | null;
      operation?: 'create' | 'update' | 'delete';
      status: 'pending' | 'success' | 'failed';
      attemptCount?: number;
      maxAttempts?: number;
      lastError?: string | null;
      nextRetryAt?: Date | null;
      metadata?: Record<string, any>;
    },
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const [row] = await tenantDb.query(
      `
        INSERT INTO fhir_sync_log (
          tenant_id,
          session_id,
          resource_type,
          resource_id,
          fhir_resource_id,
          operation,
          status,
          attempt_count,
          max_attempts,
          last_error,
          next_retry_at,
          metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
        RETURNING *
      `,
      [
        params.tenantId || null,
        params.sessionId || null,
        params.resourceType,
        params.resourceId,
        params.fhirResourceId || null,
        params.operation || 'create',
        params.status,
        Math.max(0, params.attemptCount ?? 0),
        Math.min(20, Math.max(1, params.maxAttempts ?? 5)),
        params.lastError || null,
        params.nextRetryAt || null,
        JSON.stringify(params.metadata || {}),
      ],
    );
    return row;
  }

  /**
   * Queue a FHIR write-back for a signed artifact. Logs to fhir_sync_log with status pending.
   */
  async queueFhirWriteBack(
    tenantDb: DataSource,
    params: {
      tenantId?: string | null;
      sessionId: string;
      resourceType: string;
      resourceId: string;
      operation?: 'create' | 'update';
    },
  ) {
    if (!this.isFhirWriteBackEnabled()) return null;
    return this.logFhirSyncAttempt(tenantDb, {
      ...params,
      status: 'pending',
      attemptCount: 0,
      nextRetryAt: new Date(),
      metadata: { queued_at: new Date().toISOString() },
    });
  }

  async getFhirSyncLogForSession(tenantDb: DataSource, sessionId: string) {
    await this.ensurePostVisitSchema(tenantDb);
    const rows = await tenantDb.query(
      `SELECT * FROM fhir_sync_log WHERE session_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [sessionId],
    );
    return rows.map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      fhirResourceId: row.fhir_resource_id,
      operation: row.operation,
      status: row.status,
      attemptCount: row.attempt_count,
      lastError: row.last_error,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Build a de-identified summary for peer consult (condition/demographic buckets only, no names/MRN).
   */
  private async buildDeidentifiedPeerConsultSummary(tenantDb: DataSource, sessionId: string): Promise<string> {
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const [summaryArtifact, recommendationArtifact, entityRows] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
      tenantDb.query(
        `SELECT entity_type, normalized_value FROM post_visit_extracted_entities WHERE session_id = $1 LIMIT 50`,
        [sessionId],
      ),
    ]);
    const conditions = (entityRows || [])
      .filter((r: any) => ['condition', 'problem', 'diagnosis'].includes(String(r.entity_type || '').toLowerCase()))
      .map((r: any) => String(r.normalized_value || r.entity_type || '').trim())
      .filter(Boolean);
    const summarySnippet = String(summaryArtifact?.content?.plain_language_summary || '')
      .trim()
      .slice(0, 500)
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[Name]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ID]')
      .replace(/\b\d{10,}\b/g, '[Number]');
    const recTitles = Array.isArray(recommendationArtifact?.content?.items)
      ? recommendationArtifact.content.items.map((item: any) => String(item?.title || '').trim()).filter(Boolean)
      : [];
    const parts = [
      conditions.length ? `Conditions: ${[...new Set(conditions)].slice(0, 10).join(', ')}` : '',
      recTitles.length ? `Recommendations: ${recTitles.slice(0, 5).join('; ')}` : '',
      summarySnippet ? `Summary excerpt: ${summarySnippet}` : '',
    ].filter(Boolean);
    return parts.join(' | ') || 'Post-visit session summary (de-identified).';
  }

  /**
   * Create a peer consultation request with de-identified summary. Traceable via consult id and audit.
   */
  async createPeerConsultRequest(
    tenantDb: DataSource,
    sessionId: string,
    options: { actorUserId?: string | null } = {},
  ) {
    if (!this.isPeerConsultEnabled()) {
      throw new BadRequestException('Peer consultation is disabled by feature flag');
    }
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const requestSummary = await this.buildDeidentifiedPeerConsultSummary(tenantDb, sessionId);
    const [row] = await tenantDb.query(
      `
        INSERT INTO post_visit_peer_consults (
          session_id,
          patient_id,
          request_summary_deidentified,
          status,
          requested_by
        ) VALUES ($1,$2,$3,'requested',$4)
        RETURNING *
      `,
      [sessionId, sessionRow.patient_id, requestSummary, options.actorUserId || null],
    );
    if (this.hipaaAuditService && options.actorUserId && sessionRow.patient_id) {
      await this.hipaaAuditService
        .logPhiModification(tenantDb, options.actorUserId, '', undefined, HipaaAuditAction.MEDICAL_RECORD_CREATE, 'post_visit_peer_consult', row.id, sessionRow.patient_id, undefined, undefined, undefined, undefined, sessionId, { action: 'request_created' })
        .catch(() => {});
    }
    return {
      id: row.id,
      sessionId: row.session_id,
      status: row.status,
      requestSummaryDeidentified: row.request_summary_deidentified,
      requestedBy: row.requested_by,
      createdAt: row.created_at,
    };
  }

  /**
   * Respond to a peer consult with de-identified response summary.
   */
  async respondPeerConsult(
    tenantDb: DataSource,
    consultId: string,
    payload: { responseSummaryDeidentified: string },
    options: { actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    if (!this.isPeerConsultEnabled()) {
      throw new BadRequestException('Peer consultation is disabled by feature flag');
    }
    const [existing] = await tenantDb.query(
      `SELECT * FROM post_visit_peer_consults WHERE id = $1 LIMIT 1`,
      [consultId],
    );
    if (!existing) throw new NotFoundException('Peer consult not found');
    if (String(existing.status) !== 'requested') {
      throw new BadRequestException('Consult already responded or closed');
    }
    const summary = String(payload.responseSummaryDeidentified || '').trim().slice(0, 4000) || 'No summary provided.';
    await tenantDb.query(
      `UPDATE post_visit_peer_consults SET response_summary_deidentified = $2, status = 'responded', responded_by = $3, responded_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [consultId, summary, options.actorUserId || null],
    );
    if (this.hipaaAuditService && options.actorUserId && existing.patient_id) {
      await this.hipaaAuditService
        .logPhiModification(tenantDb, options.actorUserId, '', undefined, HipaaAuditAction.MEDICAL_RECORD_UPDATE, 'post_visit_peer_consult', consultId, existing.patient_id, undefined, undefined, undefined, undefined, existing.session_id, { action: 'responded' })
        .catch(() => {});
    }
    const [updated] = await tenantDb.query(`SELECT * FROM post_visit_peer_consults WHERE id = $1 LIMIT 1`, [consultId]);
    return {
      id: updated.id,
      sessionId: updated.session_id,
      status: updated.status,
      responseSummaryDeidentified: updated.response_summary_deidentified,
      respondedBy: updated.responded_by,
      respondedAt: updated.responded_at,
    };
  }

  async listPeerConsults(
    tenantDb: DataSource,
    options: { sessionId?: string; status?: string; limit?: number } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    if (!this.isPeerConsultEnabled()) {
      return { featureEnabled: false, consults: [], message: 'Peer consultation is disabled by feature flag.' };
    }
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const conditions: string[] = [];
    const params: any[] = [];
    if (options.sessionId) {
      params.push(options.sessionId);
      conditions.push(`session_id = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    params.push(limit);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await tenantDb.query(
      `SELECT id, session_id, patient_id, request_summary_deidentified, response_summary_deidentified, status, requested_by, responded_by, responded_at, created_at FROM post_visit_peer_consults ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return {
      featureEnabled: true,
      consults: rows.map((r: any) => ({
        id: r.id,
        sessionId: r.session_id,
        status: r.status,
        requestSummaryDeidentified: r.request_summary_deidentified,
        responseSummaryDeidentified: r.response_summary_deidentified ?? null,
        requestedBy: r.requested_by,
        respondedBy: r.responded_by ?? null,
        respondedAt: r.responded_at ?? null,
        createdAt: r.created_at,
      })),
    };
  }

  /**
   * Derives a short, safe topic label from a patient question for topic persistence.
   * Used so companion answers can reference "prior session turns" via topic_discussed memory. No PHI in label.
   */
  private deriveTopicLabelFromQuestion(question: string): string | null {
    const lower = String(question || '').trim().toLowerCase();
    if (!lower || lower.length < 3) return null;
    const topicRules: Array<{ pattern: RegExp; label: string }> = [
      { pattern: /\b(medication|medicine|meds|dose|pill|prescription)\b/, label: 'medication' },
      { pattern: /\b(follow[- ]?up|return|next visit|appointment)\b/, label: 'follow-up' },
      { pattern: /\b(symptom|pain|warning sign|when to call|emergency)\b/, label: 'symptoms and warning signs' },
      { pattern: /\b(diet|food|eat|exercise|activity)\b/, label: 'lifestyle' },
      { pattern: /\b(test|lab|result|blood)\b/, label: 'tests and results' },
      { pattern: /\b(referral|specialist|doctor)\b/, label: 'referrals' },
    ];
    for (const { pattern, label } of topicRules) {
      if (pattern.test(lower)) return label;
    }
    return 'general care instructions';
  }

  private extractCompanionMemoryCandidates(message: string) {
    const text = String(message || '').trim();
    if (!text) return [] as Array<{ memoryType: string; memoryKey: string; memoryValue: string; confidence: number }>;
    const lower = text.toLowerCase();
    const candidates = [] as Array<{ memoryType: string; memoryKey: string; memoryValue: string; confidence: number }>;

    const allergyMatch = lower.match(/(?:allergic to|allergy to|cannot take)\s+([a-z0-9\s-]{3,60})/i);
    if (allergyMatch?.[1]) {
      candidates.push({
        memoryType: 'clinical_constraint',
        memoryKey: 'allergy',
        memoryValue: allergyMatch[1].trim(),
        confidence: 0.82,
      });
    }

    const preferenceMatch = lower.match(/(?:i prefer|prefer to|please)\s+([a-z0-9\s-]{4,90})/i);
    if (preferenceMatch?.[1]) {
      candidates.push({
        memoryType: 'preference',
        memoryKey: 'communication_preference',
        memoryValue: preferenceMatch[1].trim(),
        confidence: 0.64,
      });
    }

    const barrierMatch = lower.match(/(?:cannot|can.t|unable to|struggle to)\s+([a-z0-9\s-]{4,90})/i);
    if (barrierMatch?.[1]) {
      candidates.push({
        memoryType: 'adherence_barrier',
        memoryKey: 'followup_barrier',
        memoryValue: barrierMatch[1].trim(),
        confidence: 0.68,
      });
    }

    const commitmentMatch = lower.match(/(?:i will|i can|i plan to)\s+([a-z0-9\s-]{4,90})/i);
    if (commitmentMatch?.[1]) {
      candidates.push({
        memoryType: 'followup_commitment',
        memoryKey: 'patient_commitment',
        memoryValue: commitmentMatch[1].trim(),
        confidence: 0.6,
      });
    }

    const dedupe = new Set<string>();
    return candidates.filter((entry) => {
      const key = `${entry.memoryType}:${entry.memoryKey}:${entry.memoryValue}`.toLowerCase();
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    });
  }

  private async persistCompanionMemoryEntries(
    tenantDb: DataSource,
    args: {
      sessionId: string;
      patientId: string;
      sourceMessageId?: string | null;
      createdBy?: string | null;
      entries: Array<{ memoryType: string; memoryKey: string; memoryValue: string; confidence: number }>;
      metadata?: Record<string, any>;
    },
  ) {
    if (!this.isCompanionMemoryEnabled()) {
      return [];
    }
    if (!Array.isArray(args.entries) || args.entries.length === 0) return [];

    const inserted = [] as any[];
    for (const entry of args.entries.slice(0, 8)) {
      const value = String(entry.memoryValue || '').trim();
      if (!value) continue;
      const existingRows = await tenantDb.query(
        `
          SELECT id
          FROM post_visit_companion_memory
          WHERE patient_id = $1
            AND memory_type = $2
            AND memory_key = $3
            AND memory_value = $4
            AND is_active = TRUE
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [args.patientId, entry.memoryType, entry.memoryKey, value],
      );
      if (existingRows?.length) {
        continue;
      }

      const rows = await tenantDb.query(
        `
          INSERT INTO post_visit_companion_memory (
            session_id,
            patient_id,
            memory_type,
            memory_key,
            memory_value,
            confidence,
            source_message_id,
            created_by,
            is_active,
            metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9::jsonb)
          RETURNING *
        `,
        [
          args.sessionId,
          args.patientId,
          entry.memoryType,
          entry.memoryKey,
          value,
          Number(entry.confidence || 0.5),
          args.sourceMessageId || null,
          args.createdBy || null,
          JSON.stringify(args.metadata || {}),
        ],
      );
      if (rows?.[0]) {
        inserted.push(rows[0]);
      }
    }

    return inserted;
  }

  /**
   * Loads companion memory facts for use in grounded answers. Prior session turns are referenced only via
   * these persisted facts (no raw message text), so answers stay within safe, curated context.
   */
  private async getPatientCompanionMemoryFacts(
    tenantDb: DataSource,
    patientId: string,
    limit = 8,
  ) {
    if (!this.isCompanionMemoryEnabled()) {
      return [] as string[];
    }

    const rows = await tenantDb.query(
      `
        SELECT memory_type, memory_key, memory_value
        FROM post_visit_companion_memory
        WHERE patient_id = $1
          AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [patientId, Math.min(Math.max(Number(limit || 8), 1), 30)],
    );

    const facts = [] as string[];
    const dedupe = new Set<string>();
    for (const row of rows) {
      const label = `${String(row.memory_type || '').replace(/_/g, ' ')}: ${String(row.memory_value || '').trim()}`;
      const normalized = label.toLowerCase();
      if (!label.trim() || dedupe.has(normalized)) continue;
      dedupe.add(normalized);
      facts.push(label);
    }
    return facts;
  }

  // S108: Delegated to PostVisitCompanionMemoryService.
  async listSessionCompanionMemory(
    tenantDb: DataSource,
    sessionId: string,
    options: { limit?: number; includeInactive?: boolean } = {},
  ) {
    if (this.companionMemoryService) {
      return this.companionMemoryService.listSessionCompanionMemory(tenantDb, sessionId, options);
    }
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    if (!this.isCompanionMemoryEnabled()) {
      return {
        featureEnabled: false,
        sessionId,
        memories: [],
        message: 'Companion memory is disabled by feature flag.',
      };
    }

    const limit = Math.min(Math.max(Number(options.limit || 30), 1), 120);
    const includeInactive = options.includeInactive === true;
    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_companion_memory
        WHERE patient_id = $1
          AND ($3::boolean = TRUE OR is_active = TRUE)
        ORDER BY is_active DESC, updated_at DESC, created_at DESC
        LIMIT $2
      `,
      [sessionRow.patient_id, limit, includeInactive],
    );

    const memories = rows.map((row: any) => this.mapCompanionMemory(row));
    return {
      featureEnabled: true,
      sessionId,
      patientId: sessionRow.patient_id,
      memories,
      summary: {
        total: memories.length,
        active: memories.filter((item: any) => item.isActive !== false).length,
        retired: memories.filter((item: any) => item.isActive === false).length,
      },
    };
  }

  // S108: Delegated to PostVisitCompanionMemoryService.
  async curateCompanionMemory(
    tenantDb: DataSource,
    sessionId: string,
    memoryId: string,
    payload: CuratePostVisitCompanionMemoryDto,
    options: { actorUserId?: string | null } = {},
  ) {
    if (this.companionMemoryService) {
      return this.companionMemoryService.curateCompanionMemory(tenantDb, sessionId, memoryId, payload, options);
    }
    const action = String(payload.action || '').toLowerCase() as PostVisitCompanionMemoryCurationAction;
    if (!['promote', 'retire', 'reactivate'].includes(action)) {
      throw new BadRequestException('Invalid companion memory curation action');
    }
    await this.ensurePostVisitSchema(tenantDb);
    if (!this.isCompanionMemoryEnabled()) {
      throw new BadRequestException('Companion memory is disabled by feature flag');
    }
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    const existingRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_companion_memory
        WHERE id = $1
          AND patient_id = $2
        LIMIT 1
      `,
      [memoryId, sessionRow.patient_id],
    );
    const existing = existingRows?.[0];
    if (!existing) {
      throw new NotFoundException('Companion memory entry not found for this session patient');
    }

    const shouldRetire = action === 'retire';
    const metadataPatch =
      action === 'retire'
        ? {
            retired_via: 'doctor_workspace',
            retired_at: new Date().toISOString(),
            retired_by: options.actorUserId || null,
          }
        : {
            promoted_via: 'doctor_workspace',
            promoted_at: new Date().toISOString(),
            promoted_by: options.actorUserId || null,
          };

    const rows = await tenantDb.query(
      `
        UPDATE post_visit_companion_memory
        SET is_active = $3,
            promoted_at = CASE WHEN $4::boolean = TRUE THEN NOW() ELSE promoted_at END,
            promoted_by = CASE WHEN $4::boolean = TRUE THEN $5 ELSE promoted_by END,
            retired_at = CASE WHEN $6::boolean = TRUE THEN NOW() ELSE NULL END,
            retired_by = CASE WHEN $6::boolean = TRUE THEN $5 ELSE NULL END,
            curation_note = $7,
            metadata = COALESCE(metadata, '{}'::jsonb) || $8::jsonb,
            updated_at = NOW()
        WHERE id = $1
          AND patient_id = $2
        RETURNING *
      `,
      [
        memoryId,
        sessionRow.patient_id,
        !shouldRetire,
        !shouldRetire,
        options.actorUserId || null,
        shouldRetire,
        payload.note || null,
        JSON.stringify(metadataPatch),
      ],
    );
    if (!rows?.length) {
      throw new NotFoundException('Companion memory entry not found for this session patient');
    }

    return {
      sessionId,
      patientId: sessionRow.patient_id,
      action,
      memory: this.mapCompanionMemory(rows[0]),
    };
  }

  async getSessionDiarization(
    tenantDb: DataSource,
    sessionId: string,
    options: { limit?: number; unresolvedOnly?: boolean } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    const limit = Math.min(Math.max(Number(options.limit || 150), 1), 2000);
    const unresolvedOnly = options.unresolvedOnly === true;

    const rows = await tenantDb.query(
      `
        SELECT
          id,
          segment_order,
          start_second,
          end_second,
          text,
          confidence,
          language,
          speaker_label,
          speaker_role,
          diarization_confidence,
          speaker_assignment_status,
          needs_review,
          reviewed_by,
          reviewed_at,
          metadata,
          created_at,
          updated_at
        FROM post_visit_transcript_segments
        WHERE session_id = $1
          ${unresolvedOnly ? 'AND needs_review = TRUE' : ''}
        ORDER BY segment_order ASC
        LIMIT $2
      `,
      [sessionId, limit],
    );

    const [summaryRow] = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total_segments,
          COUNT(*) FILTER (WHERE needs_review = TRUE)::int AS unresolved_segments,
          COUNT(*) FILTER (WHERE speaker_role = 'doctor')::int AS doctor_segments,
          COUNT(*) FILTER (WHERE speaker_role = 'patient')::int AS patient_segments,
          COUNT(*) FILTER (WHERE speaker_role = 'unknown')::int AS unknown_segments,
          AVG(diarization_confidence)::float AS avg_confidence
        FROM post_visit_transcript_segments
        WHERE session_id = $1
      `,
      [sessionId],
    );

    return {
      sessionId,
      reviewEnabled: this.isDiarizationReviewEnabled(),
      confidenceThreshold: this.getDiarizationConfidenceThreshold(),
      summary: {
        totalSegments: Number(summaryRow?.total_segments || 0),
        unresolvedSegments: Number(summaryRow?.unresolved_segments || 0),
        doctorSegments: Number(summaryRow?.doctor_segments || 0),
        patientSegments: Number(summaryRow?.patient_segments || 0),
        unknownSegments: Number(summaryRow?.unknown_segments || 0),
        averageConfidence:
          summaryRow?.avg_confidence === null || summaryRow?.avg_confidence === undefined
            ? null
            : Number(summaryRow.avg_confidence),
      },
      segments: rows.map((row: any) => ({
        id: row.id,
        order: row.segment_order,
        start: Number(row.start_second),
        end: Number(row.end_second),
        text: row.text,
        confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
        language: row.language || null,
        speakerLabel: row.speaker_label || null,
        speakerRole: row.speaker_role || 'unknown',
        diarizationConfidence:
          row.diarization_confidence === null || row.diarization_confidence === undefined
            ? null
            : Number(row.diarization_confidence),
        speakerAssignmentStatus: row.speaker_assignment_status || 'unresolved',
        needsReview: row.needs_review === true,
        reviewedBy: row.reviewed_by || null,
        reviewedAt: row.reviewed_at || null,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  }

  async reassignDiarizationSegment(
    tenantDb: DataSource,
    sessionId: string,
    segmentId: string,
    payload: { speakerRole: 'doctor' | 'patient' | 'unknown'; speakerLabel?: string; note?: string },
    options: { actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated user is required to reassign diarization segment');
    }
    if (!['doctor', 'patient', 'unknown'].includes(String(payload.speakerRole || ''))) {
      throw new BadRequestException('speakerRole must be doctor, patient, or unknown');
    }

    const [updated] = await tenantDb.query(
      `
        UPDATE post_visit_transcript_segments
        SET speaker_role = $3,
            speaker_label = $4,
            speaker_assignment_status = CASE WHEN $3 = 'unknown' THEN 'unresolved' ELSE 'reassigned' END,
            needs_review = CASE WHEN $3 = 'unknown' THEN TRUE ELSE FALSE END,
            reviewed_by = $5,
            reviewed_at = NOW(),
            metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
            updated_at = NOW()
        WHERE id = $1
          AND session_id = $2
        RETURNING *
      `,
      [
        segmentId,
        sessionId,
        payload.speakerRole,
        payload.speakerLabel ? payload.speakerLabel.slice(0, 60) : null,
        options.actorUserId,
        JSON.stringify({
          diarization_reassign_note: payload.note || null,
          diarization_reassigned_by: options.actorUserId,
          diarization_reassigned_at: new Date().toISOString(),
        }),
      ],
    );

    if (!updated) {
      throw new NotFoundException('Transcript segment not found for diarization reassignment');
    }

    return {
      id: updated.id,
      sessionId,
      speakerRole: updated.speaker_role,
      speakerLabel: updated.speaker_label || null,
      speakerAssignmentStatus: updated.speaker_assignment_status || 'unresolved',
      needsReview: updated.needs_review === true,
      reviewedBy: updated.reviewed_by || null,
      reviewedAt: updated.reviewed_at || null,
      diarizationConfidence:
        updated.diarization_confidence === null || updated.diarization_confidence === undefined
          ? null
          : Number(updated.diarization_confidence),
    };
  }

  async getSessionFhirProjection(
    tenantDb: DataSource,
    sessionId: string,
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    const [
      summaryArtifact,
      recommendationArtifact,
      actionExecutionRows,
      citationRows,
      patientRows,
      doctorRows,
      acknowledgementRows,
      documentIntelligenceRows,
    ] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
      tenantDb.query(
        `
          SELECT recommendation_id, action_type, status, result_resource_type, result_resource_id, result_payload, executed_by, executed_at
          FROM post_visit_action_executions
          WHERE session_id = $1
          ORDER BY executed_at DESC
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT recommendation_id, rule_id, guideline_id, citation_label, citation_source, citation_url, confidence
          FROM post_visit_rule_citations
          WHERE session_id = $1
          ORDER BY created_at ASC
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT id, first_name, last_name, patient_number
          FROM patients
          WHERE id = $1
          LIMIT 1
        `,
        [sessionRow.patient_id],
      ),
      sessionRow.doctor_id
        ? tenantDb.query(
            `
              SELECT id, first_name, last_name
              FROM users
              WHERE id = $1
              LIMIT 1
            `,
            [sessionRow.doctor_id],
          )
        : Promise.resolve([]),
      tenantDb.query(
        `
          SELECT acknowledgement_type, acknowledged, details, created_at
          FROM post_visit_companion_acknowledgements
          WHERE session_id = $1
          ORDER BY created_at ASC
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT id, document_type, document_name, fhir_resources, structured_payload, created_at
          FROM post_visit_document_intelligence
          WHERE session_id = $1
          ORDER BY created_at ASC
        `,
        [sessionId],
      ),
    ]);

    const patientRow = patientRows?.[0] || null;
    const doctorRow = doctorRows?.[0] || null;
    const recommendationItems = Array.isArray(recommendationArtifact?.content?.items)
      ? recommendationArtifact.content.items
      : [];
    const executionByRecommendation = new Map<string, any>(
      actionExecutionRows.map((row: any) => [String(row.recommendation_id || ''), row]),
    );
    const citationsByRecommendation = new Map<string, Array<any>>();
    for (const row of citationRows) {
      const recommendationId = String(row.recommendation_id || '');
      if (!citationsByRecommendation.has(recommendationId)) {
        citationsByRecommendation.set(recommendationId, []);
      }
      citationsByRecommendation.get(recommendationId)?.push(row);
    }

    const bundleTimestamp = this.toIsoDate(new Date());
    const encounterId = `post-visit-${sessionId}`;
    const patientReference = `Patient/${sessionRow.patient_id}`;
    const practitionerReference = sessionRow.doctor_id ? `Practitioner/${sessionRow.doctor_id}` : null;

    const encounterResource = {
      resourceType: 'Encounter',
      id: encounterId,
      status: sessionRow.status === 'published' || sessionRow.status === 'closed' ? 'finished' : 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: sessionRow.source_type === 'telemedicine' ? 'VR' : 'AMB',
        display: sessionRow.source_type === 'telemedicine' ? 'virtual' : 'ambulatory',
      },
      subject: {
        reference: patientReference,
        display: this.buildPatientDisplay(patientRow),
      },
      participant: practitionerReference
        ? [{ individual: { reference: practitionerReference, display: this.buildUserDisplay(doctorRow) } }]
        : [],
      period: {
        start: this.toIsoDate(sessionRow.started_at || sessionRow.created_at),
        end: this.toIsoDate(sessionRow.completed_at || sessionRow.updated_at),
      },
      meta: {
        profile: ['https://umoya.health/fhir/StructureDefinition/post-visit-encounter'],
        tag: [{ system: 'https://umoya.health/fhir/tags', code: 'post-visit' }],
      },
    };

    const documentReferenceResource = {
      resourceType: 'DocumentReference',
      id: `post-visit-summary-${sessionId}`,
      status: String(summaryArtifact?.artifact_status || '').toLowerCase() === 'published' ? 'current' : 'preliminary',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '11506-3',
            display: 'Progress note',
          },
        ],
      },
      subject: { reference: patientReference },
      context: {
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
      date: this.toIsoDate(summaryArtifact?.updated_at || summaryArtifact?.created_at || sessionRow.updated_at),
      author: practitionerReference ? [{ reference: practitionerReference, display: this.buildUserDisplay(doctorRow) }] : [],
      description: summaryArtifact?.content?.plain_language_summary || 'Post-visit summary',
      content: [
        {
          attachment: {
            contentType: 'application/json',
            title: 'Post-visit summary',
            data: Buffer.from(JSON.stringify(summaryArtifact?.content || {}), 'utf8').toString('base64'),
          },
        },
      ],
    };

    const taskResources = recommendationItems.map((item: any, index: number) => {
      const recommendationId = String(item?.id || item?.recommendation_id || `rec-${index + 1}`);
      const execution = executionByRecommendation.get(recommendationId);
      const citations = citationsByRecommendation.get(recommendationId) || [];
      return {
        resourceType: 'Task',
        id: `post-visit-task-${this.safeToken(recommendationId)}`,
        status: execution?.status === 'executed' ? 'completed' : execution?.status === 'failed' ? 'failed' : 'requested',
        intent: 'order',
        for: {
          reference: patientReference,
        },
        encounter: {
          reference: `Encounter/${encounterId}`,
        },
        description: item?.title || item?.description || recommendationId,
        authoredOn: this.toIsoDate(sessionRow.reviewed_at || sessionRow.updated_at),
        executionPeriod: execution?.executed_at
          ? {
              start: this.toIsoDate(execution.executed_at),
              end: this.toIsoDate(execution.executed_at),
            }
          : undefined,
        input: [
          {
            type: { text: 'recommendation_id' },
            valueString: recommendationId,
          },
          {
            type: { text: 'action_type' },
            valueString: String(item?.action_type || 'follow_up'),
          },
          {
            type: { text: 'urgency' },
            valueString: String(item?.urgency || 'routine'),
          },
          {
            type: { text: 'citations' },
            valueString: citations
              .map((citation: any) => `${citation.citation_label} (${citation.guideline_id})`)
              .join('; '),
          },
        ],
      };
    });

    const serviceRequestResources = actionExecutionRows
      .filter((row: any) => String(row.status || '').toLowerCase() === 'executed')
      .map((row: any) => ({
        resourceType: 'ServiceRequest',
        id: `post-visit-servicerequest-${this.safeToken(row.recommendation_id || row.result_resource_id || row.executed_at)}`,
        status: 'active',
        intent: 'order',
        subject: { reference: patientReference },
        encounter: { reference: `Encounter/${encounterId}` },
        authoredOn: this.toIsoDate(row.executed_at),
        requester: practitionerReference ? { reference: practitionerReference, display: this.buildUserDisplay(doctorRow) } : undefined,
        code: {
          text: String(row.recommendation_id || row.action_type || 'post_visit_recommendation'),
        },
        note: [
          {
            text: `Executed via post-visit recommendation (${String(row.action_type || 'follow_up')})`,
          },
        ],
      }));

    const documentFhirResources = documentIntelligenceRows.flatMap((row: any) => {
      const resources = Array.isArray(row?.fhir_resources) ? row.fhir_resources : [];
      return resources
        .filter((resource: any) => resource && typeof resource === 'object' && String(resource.resourceType || '').trim())
        .map((resource: any, index: number) => ({
          ...resource,
          id:
            typeof resource.id === 'string' && resource.id.trim().length > 0
              ? resource.id
              : `post-visit-doc-${this.safeToken(row.id || row.document_name || `${index}`)}-${index + 1}`,
        }));
    });

    const carePlanResource = {
      resourceType: 'CarePlan',
      id: `post-visit-careplan-${sessionId}`,
      status: sessionRow.status === 'published' || sessionRow.status === 'closed' ? 'active' : 'draft',
      intent: 'plan',
      subject: { reference: patientReference },
      encounter: { reference: `Encounter/${encounterId}` },
      created: this.toIsoDate(sessionRow.updated_at),
      title: 'Post-visit recommendation bundle',
      description: summaryArtifact?.content?.plain_language_summary || 'Doctor-reviewed post-visit care plan',
      activity: taskResources.map((task: any) => ({
        reference: {
          reference: `Task/${task.id}`,
          display: task.description,
        },
      })),
    };

    const communicationResource = {
      resourceType: 'Communication',
      id: `post-visit-communication-${sessionId}`,
      status: sessionRow.status === 'published' || sessionRow.status === 'closed' ? 'completed' : 'in-progress',
      subject: { reference: patientReference },
      encounter: { reference: `Encounter/${encounterId}` },
      sent: this.toIsoDate(sessionRow.published_at || sessionRow.updated_at),
      payload: [
        {
          contentString: summaryArtifact?.content?.plain_language_summary || 'Post-visit summary generated',
        },
      ],
    };

    const questionnaireResponseResource = {
      resourceType: 'QuestionnaireResponse',
      id: `post-visit-questionnaire-${sessionId}`,
      status: acknowledgementRows.length > 0 ? 'completed' : 'in-progress',
      subject: { reference: patientReference },
      authored: this.toIsoDate(acknowledgementRows[acknowledgementRows.length - 1]?.created_at || sessionRow.updated_at),
      item: acknowledgementRows.map((row: any) => ({
        linkId: row.acknowledgement_type,
        text: row.acknowledgement_type,
        answer: [
          {
            valueBoolean: row.acknowledged !== false,
          },
          {
            valueString: JSON.stringify(row.details || {}),
          },
        ],
      })),
    };

    const provenanceTargetReferences = [
      `Encounter/${encounterResource.id}`,
      `CarePlan/${carePlanResource.id}`,
      `DocumentReference/${documentReferenceResource.id}`,
      `Communication/${communicationResource.id}`,
      `QuestionnaireResponse/${questionnaireResponseResource.id}`,
      ...taskResources.map((task: any) => `Task/${task.id}`),
      ...serviceRequestResources.map((resource: any) => `ServiceRequest/${resource.id}`),
    ];

    const provenanceResource = {
      resourceType: 'Provenance',
      id: `post-visit-provenance-${sessionId}`,
      recorded: bundleTimestamp,
      target: provenanceTargetReferences.map((reference) => ({ reference })),
      activity: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
            code: 'CREATE',
            display: 'create',
          },
        ],
      },
      agent: practitionerReference
        ? [
            {
              type: { text: 'author' },
              who: {
                reference: practitionerReference,
                display: this.buildUserDisplay(doctorRow),
              },
            },
          ]
        : [],
      entity: [
        {
          role: 'source',
          what: {
            reference: `PostVisitSession/${sessionId}`,
            display: 'Doctor-reviewed post-visit session',
          },
        },
      ],
    };

    const resources = [
      encounterResource,
      carePlanResource,
      communicationResource,
      documentReferenceResource,
      questionnaireResponseResource,
      ...taskResources,
      ...serviceRequestResources,
      ...documentFhirResources,
      provenanceResource,
    ];

    return {
      sessionId,
      exportVersion: 'post-visit-fhir-r4.v1',
      generatedAt: bundleTimestamp,
      bundle: {
        resourceType: 'Bundle',
        type: 'collection',
        id: `post-visit-fhir-${sessionId}`,
        timestamp: bundleTimestamp,
        entry: resources.map((resource) => ({
          fullUrl: `urn:uuid:${resource.id}`,
          resource,
        })),
      },
      stats: {
        resourceCount: resources.length,
        recommendationTaskCount: taskResources.length,
        executedServiceRequestCount: serviceRequestResources.length,
        documentResourceCount: documentFhirResources.length,
        acknowledgementCount: acknowledgementRows.length,
      },
    };
  }

  async getSessionMobileContract(
    tenantDb: DataSource,
    sessionId: string,
    options: { version?: string } = {},
  ) {
    const version = String(options.version || 'v1').trim().toLowerCase();
    if (!['v1', '1'].includes(version)) {
      throw new BadRequestException(`Unsupported post-visit mobile contract version "${options.version}"`);
    }

    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    const [summaryArtifact, recommendationArtifact, actionExecutionRows, escalationSummaryRows] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
      tenantDb.query(
        `
          SELECT recommendation_id, status, action_type, executed_at
          FROM post_visit_action_executions
          WHERE session_id = $1
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status IN ('open','acknowledged'))::int AS active_count,
            COUNT(*) FILTER (WHERE severity IN ('high','critical') AND status IN ('open','acknowledged'))::int AS high_priority_active_count
          FROM post_visit_escalation_events
          WHERE session_id = $1
        `,
        [sessionId],
      ),
    ]);

    const recommendationItems = Array.isArray(recommendationArtifact?.content?.items)
      ? recommendationArtifact.content.items
      : [];
    const executionByRecommendation = new Map<string, any>(
      actionExecutionRows.map((row: any) => [String(row.recommendation_id || ''), row]),
    );
    const checklist = recommendationItems.map((item: any, index: number) => {
      const recommendationId = String(item?.id || item?.recommendation_id || `rec-${index + 1}`);
      const execution = executionByRecommendation.get(recommendationId);
      const status = execution
        ? String(execution.status || '').toLowerCase() === 'executed'
          ? 'completed'
          : String(execution.status || '').toLowerCase() === 'failed'
            ? 'blocked'
            : 'in_progress'
        : 'pending';
      return {
        id: recommendationId,
        title: item?.title || recommendationId,
        description: item?.description || '',
        urgency: String(item?.urgency || 'routine'),
        actionType: String(item?.action_type || 'follow_up'),
        status,
        executedAt: this.toIsoDate(execution?.executed_at || null),
      };
    });

    const completedChecklistCount = checklist.filter((item) => item.status === 'completed').length;
    const escalationSummary = escalationSummaryRows?.[0] || { total: 0, active_count: 0, high_priority_active_count: 0 };

    const cards = [
      {
        id: 'post_visit_summary',
        type: 'summary',
        status: String(summaryArtifact?.artifact_status || '').toLowerCase() === 'published' ? 'published' : 'draft',
        title: 'Visit summary',
        body: summaryArtifact?.content?.plain_language_summary || 'Summary pending doctor approval.',
        metadata: {
          keyPoints: Array.isArray(summaryArtifact?.content?.key_points) ? summaryArtifact.content.key_points : [],
        },
      },
      {
        id: 'post_visit_checklist',
        type: 'checklist',
        status: checklist.length === 0 ? 'empty' : completedChecklistCount === checklist.length ? 'completed' : 'in_progress',
        title: 'Follow-up checklist',
        body: `${completedChecklistCount}/${checklist.length} items complete`,
        metadata: {
          totalItems: checklist.length,
          completedItems: completedChecklistCount,
        },
      },
      {
        id: 'post_visit_escalations',
        type: 'escalation',
        status: Number(escalationSummary.active_count || 0) > 0 ? 'attention' : 'clear',
        title: 'Safety escalations',
        body: `${Number(escalationSummary.active_count || 0)} active`,
        metadata: {
          total: Number(escalationSummary.total || 0),
          active: Number(escalationSummary.active_count || 0),
          highPriorityActive: Number(escalationSummary.high_priority_active_count || 0),
        },
      },
    ];

    return {
      contractVersion: 'post-visit-mobile.v1',
      generatedAt: this.toIsoDate(new Date()),
      session: {
        id: sessionRow.id,
        status: sessionRow.status,
        language: sessionRow.language || 'en',
        sourceType: sessionRow.source_type || 'in_person',
        publishedAt: this.toIsoDate(sessionRow.published_at),
        reviewedAt: this.toIsoDate(sessionRow.reviewed_at),
        updatedAt: this.toIsoDate(sessionRow.updated_at),
      },
      cards,
      checklist,
      actions: {
        canPublish: ['doctor_reviewed'].includes(String(sessionRow.status || '').toLowerCase()),
        canExecuteRecommendations: ['doctor_reviewed', 'published', 'closed'].includes(String(sessionRow.status || '').toLowerCase()),
        canAccessCompanion: ['published', 'closed'].includes(String(sessionRow.status || '').toLowerCase()),
      },
      eventsContract: {
        contractVersion: 'post-visit-mobile-events.v1',
        endpoint: `/post-visit/sessions/${sessionId}/mobile-events?version=v1`,
        supportedEventTypes: [
          'post_visit.session.published',
          'post_visit.review_action.recorded',
          'post_visit.recommendation.executed',
          'post_visit.recommendation.failed',
          'post_visit.escalation.triggered',
          'post_visit.escalation.resolved',
          'post_visit.patient.acknowledged',
        ],
      },
    };
  }

  async listSessionMobileEvents(
    tenantDb: DataSource,
    sessionId: string,
    options: { version?: string; limit?: number; offset?: number } = {},
  ) {
    const version = String(options.version || 'v1').trim().toLowerCase();
    if (!['v1', '1'].includes(version)) {
      throw new BadRequestException(`Unsupported post-visit mobile events contract version "${options.version}"`);
    }

    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const limit = Math.min(Math.max(Number(options.limit || 50), 1), 200);
    const offset = Math.max(Number(options.offset || 0), 0);

    const [reviewRows, executionRows, escalationRows, acknowledgementRows] = await Promise.all([
      tenantDb.query(
        `
          SELECT id, action, artifact_type, review_reason, reviewed_by, created_at
          FROM post_visit_review_actions
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 400
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT id, recommendation_id, action_type, status, error_message, executed_by, executed_at
          FROM post_visit_action_executions
          WHERE session_id = $1
          ORDER BY executed_at DESC
          LIMIT 400
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT id, status, severity, route_target, trigger_type, trigger_terms, detected_at, resolved_at, resolved_by
          FROM post_visit_escalation_events
          WHERE session_id = $1
          ORDER BY detected_at DESC
          LIMIT 400
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT id, acknowledgement_type, acknowledged, details, created_by, created_at
          FROM post_visit_companion_acknowledgements
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 400
        `,
        [sessionId],
      ),
    ]);

    const events: PostVisitMobileEvent[] = [];

    if (sessionRow.published_at) {
      events.push({
        id: `publish:${sessionRow.id}`,
        eventType: 'post_visit.session.published',
        occurredAt: this.toIsoDate(sessionRow.published_at),
        actorType: 'clinician',
        actorId: sessionRow.reviewed_by || sessionRow.doctor_id || null,
        severity: null,
        payload: {
          sessionStatus: sessionRow.status,
        },
      });
    }

    for (const row of reviewRows) {
      events.push({
        id: `review:${row.id}`,
        eventType: 'post_visit.review_action.recorded',
        occurredAt: this.toIsoDate(row.created_at),
        actorType: 'clinician',
        actorId: row.reviewed_by || null,
        severity: null,
        payload: {
          action: row.action,
          artifactType: row.artifact_type,
          reason: row.review_reason || null,
        },
      });
    }

    for (const row of executionRows) {
      const status = String(row.status || '').toLowerCase();
      events.push({
        id: `execution:${row.id}`,
        eventType: status === 'failed' ? 'post_visit.recommendation.failed' : 'post_visit.recommendation.executed',
        occurredAt: this.toIsoDate(row.executed_at),
        actorType: 'clinician',
        actorId: row.executed_by || null,
        severity: status === 'failed' ? 'moderate' : null,
        payload: {
          recommendationId: row.recommendation_id,
          actionType: row.action_type,
          status,
          errorMessage: row.error_message || null,
        },
      });
    }

    for (const row of escalationRows) {
      events.push({
        id: `escalation-open:${row.id}`,
        eventType: 'post_visit.escalation.triggered',
        occurredAt: this.toIsoDate(row.detected_at),
        actorType: 'system',
        actorId: null,
        severity: row.severity || null,
        payload: {
          escalationId: row.id,
          status: row.status,
          routeTarget: row.route_target,
          triggerType: row.trigger_type,
          triggerTerms: row.trigger_terms || [],
        },
      });
      if (row.resolved_at) {
        events.push({
          id: `escalation-resolve:${row.id}`,
          eventType: 'post_visit.escalation.resolved',
          occurredAt: this.toIsoDate(row.resolved_at),
          actorType: 'clinician',
          actorId: row.resolved_by || null,
          severity: row.severity || null,
          payload: {
            escalationId: row.id,
            routeTarget: row.route_target,
          },
        });
      }
    }

    for (const row of acknowledgementRows) {
      events.push({
        id: `ack:${row.id}`,
        eventType: 'post_visit.patient.acknowledged',
        occurredAt: this.toIsoDate(row.created_at),
        actorType: 'patient',
        actorId: row.created_by || null,
        severity: null,
        payload: {
          acknowledgementType: row.acknowledgement_type,
          acknowledged: row.acknowledged !== false,
          details: row.details || {},
        },
      });
    }

    events.sort((a, b) => {
      const left = new Date(a.occurredAt || 0).getTime();
      const right = new Date(b.occurredAt || 0).getTime();
      return right - left;
    });
    const page = events.slice(offset, offset + limit);

    return {
      contractVersion: 'post-visit-mobile-events.v1',
      sessionId,
      events: page,
      paging: {
        limit,
        offset,
        total: events.length,
      },
    };
  }

  async generateDraftArtifacts(
    tenantDb: DataSource,
    sessionId: string,
    options: GenerateDraftOptions = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    const [soapArtifact, existingRecommendationArtifact, extractedEntityRows, actionExecutionRows] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'soap_note'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
      tenantDb.query(
        `
          SELECT entity_type, entity_value, normalized_value, confidence, source_origin
          FROM post_visit_extracted_entities
          WHERE session_id = $1
          ORDER BY created_at ASC
        `,
        [sessionId],
      ),
      tenantDb.query(
        `
          SELECT recommendation_id, action_key, action_type, status, result_resource_type, result_resource_id, result_payload, error_message, executed_at
          FROM post_visit_action_executions
          WHERE session_id = $1
        `,
        [sessionId],
      ),
    ]);

    const soapNote = soapArtifact?.content?.soap_note || {};
    let patientContext: any = null;
    try {
      patientContext = await this.patientService.getPatientContext(sessionRow.patient_id, tenantDb);
    } catch (error) {
      patientContext = null;
    }

    const soapSpecialty = this.resolveSoapSpecialty(patientContext);
    const specialtySoapValidation = this.evaluateSpecialtySoapTemplate(soapSpecialty, soapNote, patientContext);

    let rules = this.buildRecommendationRules(patientContext, extractedEntityRows);

    // HIPAA: audit PHI read when medication intelligence V2 runs (medications, age, eGFR — no PHI in log payload)
    const medicationRule = rules.find((r) => r.recommendationId === 'medication_safety_intelligence_v2');
    if (
      this.hipaaAuditService &&
      medicationRule?.context?.medicationIntelligence &&
      sessionRow.patient_id
    ) {
      await this.hipaaAuditService
        .logPhiAccess(
          tenantDb,
          options.actorUserId || 'system',
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_VIEW,
          'post_visit_medication_intelligence',
          sessionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          sessionId,
          { fields: ['medications', 'age', 'egfr'], recordCount: 1 },
          { sessionId, source: options.source },
        )
        .catch(() => {});
    }

    if (this.isSpecialtySoapEnabled() && !specialtySoapValidation.isComplete) {
      const missingLabels = specialtySoapValidation.checks
        .filter((check) => !check.passed)
        .map((check) => check.label)
        .slice(0, 3);
      rules = [
        {
          ruleId: 'specialty_soap_completion_rule',
          recommendationId: 'specialty_soap_completion',
          title: `Complete ${soapSpecialty.replace('_', ' ')} SOAP checklist`,
          description: `Specialty SOAP template is incomplete. Missing checks: ${missingLabels.join('; ')}.`,
          urgency: 'routine',
          actionType: 'follow_up',
          confidence: 0.88,
          context: {
            specialtySoap: specialtySoapValidation,
          },
          citations: [
            {
              guidelineId: 'who-clinical-documentation-quality',
              label: 'Clinical documentation quality and continuity guidance',
              source: 'WHO Documentation Quality',
              excerpt: 'Structured encounter documentation should capture required specialty context before signoff.',
              confidence: 0.82,
            },
          ],
        },
        ...rules,
      ];
    }
    const executionByRecommendationId = new Map<string, any>(
      actionExecutionRows.map((row: any) => [String(row.recommendation_id), row]),
    );

    let recommendationItems = rules.map((rule) => ({
      id: rule.recommendationId,
      rule_id: rule.ruleId,
      title: rule.title,
      description: rule.description,
      urgency: rule.urgency,
      action_type: rule.actionType,
      action_id: rule.recommendationId,
      confidence: rule.confidence,
      context: rule.context,
      executable: {
        enabled: true,
        execution_endpoint: `/post-visit/sessions/${sessionId}/recommendations/${rule.recommendationId}/execute`,
      },
      execution: (() => {
        const existingExecution = executionByRecommendationId.get(rule.recommendationId);
        if (!existingExecution) return null;
        return {
          status: existingExecution.status,
          action_key: existingExecution.action_key,
          action_type: existingExecution.action_type,
          result_resource_type: existingExecution.result_resource_type,
          result_resource_id: existingExecution.result_resource_id,
          result_payload: existingExecution.result_payload || {},
          error_message: existingExecution.error_message || null,
          executed_at: existingExecution.executed_at,
        };
      })(),
      citations: rule.citations.map((citation, idx) => ({
        citation_id: `${rule.ruleId}-${idx + 1}`,
        guideline_id: citation.guidelineId,
        label: citation.label,
        source: citation.source,
        url: citation.url || null,
        excerpt: citation.excerpt || null,
        confidence: citation.confidence ?? rule.confidence,
        relevance_score: this.normalizeCitationRelevanceScore(
          citation.relevanceScore ?? citation.confidence ?? rule.confidence,
        ),
        citation_year: citation.publicationYear ?? this.extractGuidelineYear(citation.guidelineId),
        is_superseded: citation.isSuperseded === true,
        superseded_by_guideline_id: citation.supersededByGuidelineId || null,
      })),
    }));

    const flattenedCitations = rules.flatMap((rule) =>
      rule.citations.map((citation) => ({
        recommendationId: rule.recommendationId,
        ruleId: rule.ruleId,
        citation,
        metadata: {
          generatedBy: options.source || 'post_visit_draft_generation',
          tenantId: options.tenantId || null,
        },
      })),
    );

    let summaryContent: any = this.buildVisitSummaryContent({
      patientContext,
      soapNote,
      extractedEntities: extractedEntityRows,
      session: sessionRow,
    });
    summaryContent = {
      ...summaryContent,
      specialty_soap: specialtySoapValidation,
    };

    const llmCitationCatalog: GroundingCitation[] = recommendationItems.flatMap((item: any) =>
      (Array.isArray(item?.citations) ? item.citations : [])
        .map((citation: any) => ({
          id: String(citation?.citation_id || '').trim(),
          label: String(citation?.label || '').trim(),
          source: String(citation?.source || '').trim() || undefined,
          url: citation?.url || null,
          excerpt: citation?.excerpt || null,
          guidelineId: String(citation?.guideline_id || '').trim() || undefined,
          recommendationId: String(item?.id || '').trim() || undefined,
          ruleId: String(item?.rule_id || '').trim() || undefined,
        }))
        .filter((citation: GroundingCitation) => citation.id.length > 0),
    );

    if (this.groundedLlmService) {
      const llmPolish = await this.groundedLlmService.polishDoctorContent({
        sessionId,
        language: sessionRow.language || 'en',
        tenantId: options.tenantId,
        soapNote,
        baseSummary: {
          summaryText: summaryContent.summary_text,
          plainLanguageSummary: summaryContent.plain_language_summary,
          keyPoints: summaryContent.key_points,
        },
        recommendationItems: recommendationItems.map((item: any) => ({
          id: String(item?.id || ''),
          title: String(item?.title || ''),
          description: String(item?.description || ''),
        })),
        citations: llmCitationCatalog,
      });

      if (llmPolish) {
        recommendationItems = this.applyRecommendationLlmRewrites(recommendationItems, llmPolish.recommendationRewrites);
        summaryContent = {
          ...summaryContent,
          summary_text: llmPolish.summaryText || summaryContent.summary_text,
          plain_language_summary: llmPolish.plainLanguageSummary || summaryContent.plain_language_summary,
          key_points: Array.isArray(llmPolish.keyPoints) && llmPolish.keyPoints.length
            ? llmPolish.keyPoints
            : summaryContent.key_points,
          grounded_llm: {
            enabled: true,
            model: llmPolish.model,
            citations_used: llmPolish.citationsUsed,
            polished_at: new Date().toISOString(),
            aiMetadata: llmPolish.aiMetadata || null,
          },
        };
        await this.persistGroundedLlmAudit(tenantDb, {
          model: llmPolish.model || null,
          audit: llmPolish.audit || null,
          sessionId,
          patientId: sessionRow.patient_id,
          encounterId: sessionRow.appointment_id || sessionRow.consultation_id || null,
          actorUserId: options.actorUserId || null,
          actorRole: 'doctor',
          metadata: {
            channel: 'doctor_draft_polish',
            source: options.source || 'post_visit_draft_generation',
            citation_count: Array.isArray(llmPolish.citationsUsed) ? llmPolish.citationsUsed.length : 0,
          },
        });
      } else {
        summaryContent = {
          ...summaryContent,
          grounded_llm: {
            enabled: false,
            reason: 'fallback_deterministic',
          },
        };
      }
    }

    const recommendationContent = {
      generated_at: new Date().toISOString(),
      generated_by: options.source || 'post_visit_draft_generation',
      item_count: recommendationItems.length,
      items: recommendationItems,
      action_executions:
        existingRecommendationArtifact?.content?.action_executions &&
        typeof existingRecommendationArtifact.content.action_executions === 'object'
          ? existingRecommendationArtifact.content.action_executions
          : {},
      context_snapshot: {
        patient_id: sessionRow.patient_id,
        modules_available: patientContext ? Object.keys(patientContext.modules || {}) : [],
      },
      specialty_soap: specialtySoapValidation,
      grounded_llm: summaryContent.grounded_llm || {
        enabled: false,
        reason: 'not_configured',
      },
    };

    await this.upsertDraftArtifact(tenantDb, {
      sessionId,
      artifactType: 'visit_summary',
      content: summaryContent,
      citations: [],
      confidence: 0.8,
      generatedBy: options.source || 'post_visit_draft_generation',
      actorUserId: options.actorUserId || null,
      artifactStatus: 'draft',
    });

    // HIPAA: audit PHI write when visit summary (incl. teach-back/literacy) is persisted; no PHI in log payload
    if (this.hipaaAuditService && sessionRow.patient_id) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId || 'system',
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_UPDATE,
          'post_visit_visit_summary',
          sessionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionId,
          {
            hasTeachBackQuestions: Array.isArray(summaryContent.teach_back_questions) && summaryContent.teach_back_questions.length > 0,
            language: summaryContent.language || null,
            literacyScored: typeof summaryContent.literacy_score === 'number',
          },
        )
        .catch(() => {});
    }

    const recommendationArtifact = await this.upsertDraftArtifact(tenantDb, {
      sessionId,
      artifactType: 'recommendation_bundle',
      content: recommendationContent,
      citations: flattenedCitations.map((entry) => ({
        recommendation_id: entry.recommendationId,
        rule_id: entry.ruleId,
        guideline_id: entry.citation.guidelineId,
        label: entry.citation.label,
        source: entry.citation.source,
        url: entry.citation.url || null,
        excerpt: entry.citation.excerpt || null,
        confidence: entry.citation.confidence ?? null,
      })),
      confidence: 0.82,
      generatedBy: options.source || 'post_visit_draft_generation',
      actorUserId: options.actorUserId || null,
      artifactStatus: 'draft',
    });

    await this.replaceRuleCitations(tenantDb, sessionId, flattenedCitations);

    let billingIntelligenceMeta: Record<string, any> | null = null;
    if (this.isBillingIntelligenceEnabled()) {
      const billingResult = await this.refreshSessionBillingIntelligence(tenantDb, {
        sessionRow,
        soapNote,
        summaryContent,
        recommendationItems,
        actorUserId: options.actorUserId || null,
        source: options.source || 'post_visit_draft_generation',
      });
      const documentation = billingResult.documentation;
      billingIntelligenceMeta = {
        enabled: true,
        suggestionCount: Array.isArray(billingResult.suggestions) ? billingResult.suggestions.length : 0,
        documentationScore: documentation?.score ?? null,
        documentationStatus: documentation?.status ?? null,
      };
    }

    await tenantDb.query(
      `
        UPDATE post_visit_sessions
        SET status = 'draft_ready',
            updated_at = NOW(),
            meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
        WHERE id = $1
      `,
      [
        sessionId,
        JSON.stringify({
          last_draft_generated_at: new Date().toISOString(),
          draft_generation_reason: options.reason || null,
          recommendation_artifact_id: recommendationArtifact.id,
          billing_intelligence: billingIntelligenceMeta || {
            enabled: false,
          },
        }),
      ],
    );

    return this.getSessionDraft(tenantDb, sessionId);
  }

  private safeToken(value: any) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'value';
  }

  private toIsoDate(value: any) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private buildPatientDisplay(patientRow: any) {
    if (!patientRow) return null;
    const fullName = `${String(patientRow.first_name || '').trim()} ${String(patientRow.last_name || '').trim()}`.trim();
    if (fullName && patientRow.patient_number) {
      return `${fullName} (${patientRow.patient_number})`;
    }
    return fullName || patientRow.patient_number || null;
  }

  private buildUserDisplay(userRow: any) {
    if (!userRow) return null;
    const fullName = `${String(userRow.first_name || '').trim()} ${String(userRow.last_name || '').trim()}`.trim();
    return fullName || null;
  }

  // S108: Delegated to PostVisitDraftService.
  async reviewDraftArtifact(
    tenantDb: DataSource,
    sessionId: string,
    payload: ReviewPostVisitArtifactDto,
    options: { tenantId?: string; actorUserId?: string | null; source?: string } = {},
  ) {
    if (this.draftService) return this.draftService.reviewDraftArtifact(tenantDb, sessionId, payload, options);
    await this.ensurePostVisitSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated reviewer is required');
    }

    await this.getSessionRow(tenantDb, sessionId);
    const artifact = await this.getArtifactRow(tenantDb, sessionId, payload.artifactType);
    if (!artifact) {
      throw new NotFoundException(`Post-visit artifact "${payload.artifactType}" not found`);
    }

    const beforeContent = artifact.content || {};
    const afterContent =
      payload.action === 'edit'
        ? payload.editedContent || beforeContent
        : beforeContent;
    const artifactStatus = payload.action === 'reject' ? 'draft' : 'reviewed';

    const updatedArtifactRows = await tenantDb.query(
      `
        UPDATE post_visit_draft_artifacts
        SET artifact_status = $3,
            content = $4::jsonb,
            updated_by = $5,
            updated_at = NOW()
        WHERE id = $1
          AND session_id = $2
        RETURNING *
      `,
      [
        artifact.id,
        sessionId,
        artifactStatus,
        JSON.stringify(afterContent),
        options.actorUserId,
      ],
    );

    const reviewActionRows = await tenantDb.query(
      `
        INSERT INTO post_visit_review_actions (
          session_id,
          artifact_id,
          artifact_type,
          action,
          review_reason,
          review_metadata,
          before_content,
          after_content,
          reviewed_by,
          source
        ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10)
        RETURNING *
      `,
      [
        sessionId,
        artifact.id,
        payload.artifactType,
        payload.action,
        payload.reason || null,
        JSON.stringify(payload.reviewMetadata || {}),
        JSON.stringify(beforeContent),
        JSON.stringify(afterContent),
        options.actorUserId,
        options.source || 'post_visit_review',
      ],
    );

    const sessionStatus: PostVisitSessionStatus = payload.action === 'reject' ? 'draft_ready' : 'doctor_reviewed';
    const safetyLevel =
      typeof payload.reviewMetadata?.safetyLevel === 'string'
        ? String(payload.reviewMetadata.safetyLevel)
        : null;
    const riskFlags =
      payload.reviewMetadata?.riskFlags && typeof payload.reviewMetadata.riskFlags === 'object'
        ? payload.reviewMetadata.riskFlags
        : null;

    const updatedSessionRows = await tenantDb.query(
      `
        UPDATE post_visit_sessions
        SET status = $2,
            reviewed_at = NOW(),
            reviewed_by = $3,
            safety_level = COALESCE($4, safety_level),
            risk_flags = CASE
              WHEN $5::jsonb IS NULL THEN risk_flags
              ELSE COALESCE(risk_flags, '{}'::jsonb) || $5::jsonb
            END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [sessionId, sessionStatus, options.actorUserId, safetyLevel, riskFlags ? JSON.stringify(riskFlags) : null],
    );

    return {
      session: this.mapSession(updatedSessionRows[0]),
      artifact: {
        id: updatedArtifactRows[0].id,
        type: updatedArtifactRows[0].artifact_type,
        status: updatedArtifactRows[0].artifact_status,
        content: updatedArtifactRows[0].content,
        citations: updatedArtifactRows[0].citations || [],
        updatedAt: updatedArtifactRows[0].updated_at,
      },
      reviewAction: {
        id: reviewActionRows[0].id,
        action: reviewActionRows[0].action,
        reason: reviewActionRows[0].review_reason,
        metadata: reviewActionRows[0].review_metadata || {},
        reviewedBy: reviewActionRows[0].reviewed_by,
        createdAt: reviewActionRows[0].created_at,
      },
    };
  }

  private async excludeWeakCitationsFromRecommendationArtifact(
    tenantDb: DataSource,
    sessionId: string,
    weakCitationRows: Array<{ rule_id: string; guideline_id: string; citation_label: string }>,
    actorUserId?: string | null,
  ) {
    if (!weakCitationRows.length) {
      return 0;
    }

    const weakKey = new Set<string>(
      weakCitationRows.map((row) =>
        `${String(row.rule_id || '').trim()}::${String(row.guideline_id || '').trim()}::${String(row.citation_label || '').trim()}`,
      ),
    );

    const artifact = await this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle');
    if (!artifact) {
      return 0;
    }

    const originalItems = Array.isArray(artifact.content?.items) ? artifact.content.items : [];
    let removedCount = 0;
    const filteredItems = originalItems.map((item: any) => {
      const ruleId = String(item?.rule_id || '').trim();
      const citations = Array.isArray(item?.citations) ? item.citations : [];
      const filteredCitations = citations.filter((citation: any) => {
        const key = `${ruleId}::${String(citation?.guideline_id || '').trim()}::${String(citation?.label || '').trim()}`;
        const remove = weakKey.has(key);
        if (remove) removedCount += 1;
        return !remove;
      });
      if (filteredCitations.length === citations.length) return item;
      return {
        ...item,
        citations: filteredCitations,
      };
    });

    if (removedCount <= 0) {
      return 0;
    }

    const nextContent = {
      ...(artifact.content || {}),
      items: filteredItems,
      citation_quality: {
        ...(artifact.content?.citation_quality || {}),
        weak_excluded_count: removedCount,
        weak_excluded_at: new Date().toISOString(),
      },
    };

    await tenantDb.query(
      `
        UPDATE post_visit_draft_artifacts
        SET content = $3::jsonb,
            citations = $4::jsonb,
            updated_by = $5,
            updated_at = NOW()
        WHERE id = $1
          AND session_id = $2
      `,
      [
        artifact.id,
        sessionId,
        JSON.stringify(nextContent),
        JSON.stringify(
          filteredItems.flatMap((item: any) => (Array.isArray(item?.citations) ? item.citations : [])),
        ),
        actorUserId || null,
      ],
    );

    await tenantDb.query(
      `
        UPDATE post_visit_rule_citations
        SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE session_id = $1
          AND (
            relevance_score IS NOT NULL
            AND relevance_score < $3
          )
      `,
      [
        sessionId,
        JSON.stringify({
          excluded_from_publish: true,
          excluded_reason: 'low_relevance',
          excluded_at: new Date().toISOString(),
        }),
        this.getCitationRelevanceThreshold(),
      ],
    );

    return removedCount;
  }

  private async enforceSpecialtySoapPublishGate(
    tenantDb: DataSource,
    sessionRow: any,
  ): Promise<SpecialtySoapValidationSummary | null> {
    if (!this.isSpecialtySoapEnabled()) {
      return null;
    }

    const soapArtifact = await this.getArtifactRow(tenantDb, sessionRow.id, 'soap_note');
    if (!soapArtifact?.content?.soap_note) {
      throw new BadRequestException('Publish blocked. SOAP note is missing for specialty template validation.');
    }

    let patientContext: any = null;
    try {
      patientContext = await this.patientService.getPatientContext(sessionRow.patient_id, tenantDb);
    } catch {
      patientContext = null;
    }

    const specialty = this.resolveSoapSpecialty(patientContext);
    const validation = this.evaluateSpecialtySoapTemplate(specialty, soapArtifact.content.soap_note, patientContext);
    if (!validation.isComplete) {
      const missingLabels = validation.checks
        .filter((check) => !check.passed)
        .map((check) => check.label)
        .join('; ');
      throw new BadRequestException(
        `Publish blocked. Specialty SOAP template (${specialty.replace('_', ' ')}) incomplete: ${missingLabels}`,
      );
    }

    return validation;
  }

  async publishSession(
    tenantDb: DataSource,
    sessionId: string,
    payload: {
      note?: string;
      publishMetadata?: Record<string, any>;
      acknowledgedSupersededCitationIds?: string[];
      /** When Medication Intelligence V2 is on and high-risk alerts exist, must be true to publish. */
      acknowledgedMedicationHighRisk?: boolean;
    } = {},
    options: PublishSessionOptions = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated doctor user is required for publish');
    }

    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const allowedStatuses = ['doctor_reviewed', 'published', 'closed'];
    if (!allowedStatuses.includes(String(sessionRow.status || '').toLowerCase())) {
      throw new BadRequestException(
        'Session must be doctor_reviewed before publish. Review visit_summary and recommendation_bundle first.',
      );
    }

    const requiredArtifacts = await tenantDb.query(
      `
        SELECT artifact_type, artifact_status
        FROM post_visit_draft_artifacts
        WHERE session_id = $1
          AND artifact_type IN ('visit_summary', 'recommendation_bundle')
      `,
      [sessionId],
    );

    const missingOrUnreviewed = ['visit_summary', 'recommendation_bundle'].filter((artifactType) => {
      const artifact = requiredArtifacts.find((row: any) => String(row.artifact_type) === artifactType);
      if (!artifact) return true;
      return !['reviewed', 'published'].includes(String(artifact.artifact_status || '').toLowerCase());
    });

    if (missingOrUnreviewed.length > 0) {
      throw new BadRequestException(
        `Publish blocked. Artifact(s) require doctor review: ${missingOrUnreviewed.join(', ')}`,
      );
    }

    const specialtySoapValidation = await this.enforceSpecialtySoapPublishGate(tenantDb, sessionRow);

    // HIPAA: audit PHI read when specialty SOAP validation runs (SOAP note + patient context; no PHI in log payload)
    if (
      specialtySoapValidation &&
      this.hipaaAuditService &&
      sessionRow.patient_id
    ) {
      await this.hipaaAuditService
        .logPhiAccess(
          tenantDb,
          options.actorUserId || 'system',
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_VIEW,
          'post_visit_specialty_soap_validation',
          sessionId,
          sessionRow.patient_id,
          undefined,
          undefined,
          sessionId,
          { fields: ['soap_note', 'patient_context'], recordCount: 1 },
          { sessionId, specialty: specialtySoapValidation.specialty },
        )
        .catch(() => {});
    }

    let citationQualityMeta: Record<string, any> | null = null;
    if (this.isCitationQualityV2Enabled()) {
      const relevanceThreshold = this.getCitationRelevanceThreshold();
      const citationRows = await tenantDb.query(
        `
          SELECT
            id,
            rule_id,
            guideline_id,
            citation_label,
            relevance_score,
            is_superseded,
            doctor_acknowledged_superseded
          FROM post_visit_rule_citations
          WHERE session_id = $1
        `,
        [sessionId],
      );

      const weakRows = citationRows.filter((row: any) => {
        const score = row?.relevance_score;
        if (score === null || score === undefined) return false;
        const numericScore = Number(score);
        if (!Number.isFinite(numericScore)) return false;
        return numericScore < relevanceThreshold;
      });

      if (weakRows.length > 0) {
        await this.excludeWeakCitationsFromRecommendationArtifact(tenantDb, sessionId, weakRows, options.actorUserId);
      }

      const acknowledgedIds = Array.isArray(payload.acknowledgedSupersededCitationIds)
        ? payload.acknowledgedSupersededCitationIds
            .map((value) => String(value || '').trim())
            .filter((value) => value.length > 0)
        : [];

      if (acknowledgedIds.length > 0) {
        await tenantDb.query(
          `
            UPDATE post_visit_rule_citations
            SET doctor_acknowledged_superseded = TRUE,
                superseded_acknowledged_by = $3,
                superseded_acknowledged_at = NOW(),
                metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                updated_at = NOW()
            WHERE session_id = $1
              AND id = ANY($2::uuid[])
          `,
          [
            sessionId,
            acknowledgedIds,
            options.actorUserId || null,
            JSON.stringify({
              superseded_acknowledged_by: options.actorUserId || null,
              superseded_acknowledged_at: new Date().toISOString(),
              source: options.source || 'post_visit_publish',
            }),
          ],
        );
      }

      const acknowledgedSet = new Set<string>(acknowledgedIds);
      const unresolvedSuperseded = citationRows.filter((row: any) => {
        const isSuperseded = row?.is_superseded === true;
        if (!isSuperseded) return false;
        const alreadyAcknowledged = row?.doctor_acknowledged_superseded === true;
        const acknowledgedInPayload = acknowledgedSet.has(String(row?.id || ''));
        return !alreadyAcknowledged && !acknowledgedInPayload;
      });

      if (unresolvedSuperseded.length > 0) {
        throw new BadRequestException(
          `Publish blocked. Superseded citation acknowledgement required for: ${unresolvedSuperseded
            .map((row: any) => String(row.id || '').trim())
            .filter((value: string) => value.length > 0)
            .join(', ')}`,
        );
      }

      citationQualityMeta = {
        relevanceThreshold,
        weakExcludedCount: weakRows.length,
        supersededCount: citationRows.filter((row: any) => row?.is_superseded === true).length,
        supersededAcknowledgedCount: citationRows.filter(
          (row: any) =>
            row?.is_superseded === true &&
            (row?.doctor_acknowledged_superseded === true || acknowledgedSet.has(String(row?.id || ''))),
        ).length,
      };
    }

    if (this.isDiarizationReviewEnabled()) {
      const [reviewRow] = await tenantDb.query(
        `
          SELECT COUNT(*)::int AS unresolved_count
          FROM post_visit_transcript_segments
          WHERE session_id = $1
            AND needs_review = TRUE
        `,
        [sessionId],
      );
      const unresolvedCount = Number(reviewRow?.unresolved_count || 0);
      if (unresolvedCount > 0) {
        throw new BadRequestException(
          `Publish blocked. ${unresolvedCount} transcript segment(s) require diarization review before signoff.`,
        );
      }
    }

    // HIPAA-aligned: high-risk medication alerts must be acknowledged before signoff when Medication Intelligence V2 is on
    if (this.isMedicationIntelligenceV2Enabled()) {
      const recBundleArtifact = await this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle');
      const items = recBundleArtifact?.content?.items ?? recBundleArtifact?.content?.recommendations ?? [];
      const medicationItem = Array.isArray(items)
        ? items.find((item: any) => String(item?.id || item?.recommendation_id) === 'medication_safety_intelligence_v2')
        : null;
      const ctx = medicationItem?.context ?? {};
      const highRisk =
        ctx.highRisk === true ||
        (Number(ctx.medicationIntelligence?.highRiskCount ?? ctx.highRiskCount ?? 0) > 0) ||
        ['contraindicated', 'major'].includes(String(ctx.medicationIntelligence?.highestSeverity ?? ctx.highestSeverity ?? '').toLowerCase());
      if (highRisk && payload.acknowledgedMedicationHighRisk !== true) {
        throw new BadRequestException(
          'Publish blocked. High-risk medication safety alert must be acknowledged before signoff. Review Recommendation Bundle and set acknowledgedMedicationHighRisk to confirm.',
        );
      }
    }

    await tenantDb.query(
      `
        UPDATE post_visit_draft_artifacts
        SET artifact_status = 'published',
            updated_by = $2,
            updated_at = NOW()
        WHERE session_id = $1
          AND artifact_type IN ('visit_summary', 'recommendation_bundle')
      `,
      [sessionId, options.actorUserId],
    );

    const updatedSessionRows = await tenantDb.query(
      `
        UPDATE post_visit_sessions
        SET status = 'published',
            published_at = NOW(),
            updated_at = NOW(),
            meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        sessionId,
        JSON.stringify({
          published_by: options.actorUserId,
          publish_source: options.source || 'post_visit_publish',
          publish_note: payload.note || null,
          publish_metadata: {
            ...(payload.publishMetadata || {}),
            ...(citationQualityMeta ? { citation_quality: citationQualityMeta } : {}),
            ...(specialtySoapValidation ? { specialty_soap: specialtySoapValidation } : {}),
          },
        }),
      ],
    );

    const publishedSessionRow = updatedSessionRows?.[0] || null;
    let threadSessionRow = publishedSessionRow;
    if (!threadSessionRow?.id || !threadSessionRow?.patient_id) {
      threadSessionRow = await this.getSessionRow(tenantDb, sessionId);
    }
    const resolvedPublishedSession = threadSessionRow;
    const thread = await this.ensureCompanionThread(tenantDb, resolvedPublishedSession, options.actorUserId);

    const [visitSummaryArtifact, recommendationArtifact] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
    ]);

    const existingSummaryRows = await tenantDb.query(
      `
        SELECT id
        FROM post_visit_companion_messages
        WHERE session_id = $1
          AND message_type = 'summary'
        LIMIT 1
      `,
      [sessionId],
    );

    if (!existingSummaryRows?.length) {
      const plainSummary = String(visitSummaryArtifact?.content?.plain_language_summary || '').trim();
      const checklistItems = Array.isArray(recommendationArtifact?.content?.items)
        ? recommendationArtifact.content.items.slice(0, 5)
        : [];

      const summaryMessage = [
        plainSummary || 'Your doctor-approved visit summary is now available.',
        checklistItems.length
          ? `Checklist: ${checklistItems.map((item: any) => item?.title).filter(Boolean).join('; ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      await tenantDb.query(
        `
          INSERT INTO post_visit_companion_messages (
            thread_id,
            session_id,
            patient_id,
            sender_type,
            sender_id,
            message_type,
            message_text,
            grounded_context,
            escalation_detected,
            metadata
          ) VALUES ($1,$2,$3,'system',$4,'summary',$5,$6::jsonb,false,$7::jsonb)
        `,
        [
          thread.id,
          sessionId,
          resolvedPublishedSession.patient_id,
          options.actorUserId,
          summaryMessage,
          JSON.stringify({
            artifact_type: 'visit_summary',
            recommendation_count: checklistItems.length,
          }),
          JSON.stringify({
            source: 'post_visit_publish',
          }),
        ],
      );
      await this.touchCompanionThreadAfterMessage(tenantDb, thread.id, 'system');
    }

    if (this.isPatientStoryEnabled() && resolvedPublishedSession?.patient_id) {
      this.regeneratePatientStoryForPatient(
        tenantDb,
        resolvedPublishedSession.patient_id,
        sessionId,
      ).catch(() => {});
    }

    return {
      session: this.mapSession(resolvedPublishedSession),
      companionThread: {
        id: thread.id,
        status: thread.status,
        messageCount: thread.message_count,
        lastMessageAt: thread.last_message_at || null,
      },
    };
  }

  // S108: Delegated to PostVisitSessionService.
  async listPatientSessions(
    tenantDb: DataSource,
    patientId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    if (this.sessionService) return this.sessionService.listPatientSessions(tenantDb, patientId, options);
    await this.ensurePostVisitSchema(tenantDb);
    const limit = Math.min(Math.max(Number(options.limit || 20), 1), 100);
    const offset = Math.max(Number(options.offset || 0), 0);

    const rows = await tenantDb.query(
      `
        SELECT
          s.id,
          s.status,
          s.source_type,
          s.language,
          s.started_at,
          s.completed_at,
          s.published_at,
          s.updated_at,
          vs.content AS visit_summary_content,
          rb.content AS recommendation_bundle_content
        FROM post_visit_sessions s
        LEFT JOIN post_visit_draft_artifacts vs
          ON vs.session_id = s.id
         AND vs.artifact_type = 'visit_summary'
         AND vs.artifact_status = 'published'
        LEFT JOIN post_visit_draft_artifacts rb
          ON rb.session_id = s.id
         AND rb.artifact_type = 'recommendation_bundle'
         AND rb.artifact_status = 'published'
        WHERE s.patient_id = $1
          AND s.status IN ('published','closed')
        ORDER BY COALESCE(s.published_at, s.updated_at) DESC
        LIMIT $2
        OFFSET $3
      `,
      [patientId, limit, offset],
    );

    const sessions = rows.map((row: any) => {
      const checklistItems = Array.isArray(row.recommendation_bundle_content?.items)
        ? row.recommendation_bundle_content.items
        : [];
      return {
        id: row.id,
        status: row.status,
        sourceType: row.source_type,
        language: row.language,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        summarySnippet: row.visit_summary_content?.plain_language_summary || null,
        checklistCount: checklistItems.length,
      };
    });

    return {
      patientId,
      sessions,
      paging: {
        limit,
        offset,
      },
    };
  }

  // S108: Delegated to PostVisitSessionService.
  async getPatientStoryLatest(
    tenantDb: DataSource,
    patientId: string,
    options: { actorUserId?: string | null } = {},
  ) {
    if (this.sessionService) return this.sessionService.getPatientStoryLatest(tenantDb, patientId, options);
    await this.ensurePostVisitSchema(tenantDb);
    if (!this.isPatientStoryEnabled()) {
      return { featureEnabled: false, story: null, version: null };
    }
    const rows = await tenantDb.query(
      `
        SELECT id, patient_id, version, session_id, content, created_at
        FROM post_visit_patient_story
        WHERE patient_id = $1
        ORDER BY version DESC
        LIMIT 1
      `,
      [patientId],
    );
    const row = rows?.[0];
    if (!row) {
      return { featureEnabled: true, story: null, version: null };
    }
    if (this.hipaaAuditService && options.actorUserId && patientId) {
      await this.hipaaAuditService
        .logPhiAccess(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_VIEW,
          'post_visit_patient_story',
          row.id,
          patientId,
          undefined,
          undefined,
          undefined,
          { fields: ['timeline', 'content'], recordCount: 1 },
          { action: 'get_latest' },
        )
        .catch(() => {});
    }
    return {
      featureEnabled: true,
      story: {
        id: row.id,
        patientId: row.patient_id,
        version: row.version,
        sessionId: row.session_id,
        content: row.content || {},
        createdAt: row.created_at,
      },
      version: row.version,
    };
  }

  // S108: Delegated to PostVisitSessionService.
  async getPatientStoryVersions(tenantDb: DataSource, patientId: string, limit = 20) {
    if (this.sessionService) return this.sessionService.getPatientStoryVersions(tenantDb, patientId, limit);
    await this.ensurePostVisitSchema(tenantDb);
    if (!this.isPatientStoryEnabled()) {
      return { featureEnabled: false, versions: [] };
    }
    const rows = await tenantDb.query(
      `
        SELECT id, version, session_id, created_at
        FROM post_visit_patient_story
        WHERE patient_id = $1
        ORDER BY version DESC
        LIMIT $2
      `,
      [patientId, Math.min(Math.max(Number(limit), 1), 100)],
    );
    return {
      featureEnabled: true,
      versions: (rows || []).map((r: any) => ({
        id: r.id,
        version: r.version,
        sessionId: r.session_id,
        createdAt: r.created_at,
      })),
    };
  }

  // S108: Delegated to PostVisitSessionService.
  async getPatientStoryVersion(tenantDb: DataSource, patientId: string, version: number) {
    if (this.sessionService) return this.sessionService.getPatientStoryVersion(tenantDb, patientId, version);
    await this.ensurePostVisitSchema(tenantDb);
    if (!this.isPatientStoryEnabled()) {
      return { featureEnabled: false, story: null };
    }
    const [row] = await tenantDb.query(
      `
        SELECT id, patient_id, version, session_id, content, created_at
        FROM post_visit_patient_story
        WHERE patient_id = $1 AND version = $2
        LIMIT 1
      `,
      [patientId, version],
    );
    if (!row) {
      return { featureEnabled: true, story: null };
    }
    return {
      featureEnabled: true,
      story: {
        id: row.id,
        patientId: row.patient_id,
        version: row.version,
        sessionId: row.session_id,
        content: row.content || {},
        createdAt: row.created_at,
      },
    };
  }

  // S108: Delegated to PostVisitSessionService.
  async getPatientStoryDiff(
    tenantDb: DataSource,
    patientId: string,
    fromVersion: number,
    toVersion: number,
  ) {
    if (this.sessionService) return this.sessionService.getPatientStoryDiff(tenantDb, patientId, fromVersion, toVersion);
    await this.ensurePostVisitSchema(tenantDb);
    if (!this.isPatientStoryEnabled()) {
      return { featureEnabled: false, from: null, to: null, diff: null };
    }
    const [fromRow, toRow] = await Promise.all([
      tenantDb.query(
        `SELECT version, content, created_at FROM post_visit_patient_story WHERE patient_id = $1 AND version = $2 LIMIT 1`,
        [patientId, fromVersion],
      ),
      tenantDb.query(
        `SELECT version, content, created_at FROM post_visit_patient_story WHERE patient_id = $1 AND version = $2 LIMIT 1`,
        [patientId, toVersion],
      ),
    ]);
    const from = fromRow?.[0];
    const to = toRow?.[0];
    if (!from || !to) {
      return { featureEnabled: true, from: from ? { version: from.version, content: from.content, createdAt: from.created_at } : null, to: to ? { version: to.version, content: to.content, createdAt: to.created_at } : null, diff: null };
    }
    const fromTimeline = Array.isArray(from.content?.timeline) ? from.content.timeline : [];
    const toTimeline = Array.isArray(to.content?.timeline) ? to.content.timeline : [];
    const diff = {
      timelineAdded: toTimeline.filter((t: any) => !fromTimeline.some((f: any) => f.sessionId === t.sessionId)),
      timelineRemoved: fromTimeline.filter((f: any) => !toTimeline.some((t: any) => t.sessionId === f.sessionId)),
      fromVersion: from.version,
      toVersion: to.version,
    };
    return {
      featureEnabled: true,
      from: { version: from.version, content: from.content, createdAt: from.created_at },
      to: { version: to.version, content: to.content, createdAt: to.created_at },
      diff,
    };
  }

  async getPatientSessionSummary(
    tenantDb: DataSource,
    sessionId: string,
    patientId: string,
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    this.assertPatientSessionAccess(sessionRow, patientId);
    this.assertPatientCompanionAccessAllowed(sessionRow);

    const [visitSummaryArtifact, recommendationArtifact, actionExecutionRows] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
      tenantDb.query(
        `
          SELECT recommendation_id, status, action_type, executed_at, result_resource_type, result_resource_id
          FROM post_visit_action_executions
          WHERE session_id = $1
        `,
        [sessionId],
      ),
    ]);

    if (!visitSummaryArtifact || String(visitSummaryArtifact.artifact_status).toLowerCase() !== 'published') {
      throw new ForbiddenException('Doctor-approved patient summary has not been published for this session');
    }

    if (!recommendationArtifact || String(recommendationArtifact.artifact_status).toLowerCase() !== 'published') {
      throw new ForbiddenException('Doctor-approved patient checklist has not been published for this session');
    }

    const executionMap = new Map<string, any>(
      actionExecutionRows.map((row: any) => [String(row.recommendation_id), row]),
    );

    const checklist = (Array.isArray(recommendationArtifact.content?.items) ? recommendationArtifact.content.items : []).map(
      (item: any) => {
        const execution = executionMap.get(String(item?.id || item?.recommendation_id || ''));
        return {
          id: item?.id || item?.recommendation_id || null,
          title: item?.title || null,
          description: item?.description || null,
          urgency: item?.urgency || 'routine',
          actionType: item?.action_type || null,
          completed: execution ? execution.status === 'executed' : false,
          execution: execution
            ? {
                status: execution.status,
                actionType: execution.action_type,
                executedAt: execution.executed_at,
                resultResourceType: execution.result_resource_type,
                resultResourceId: execution.result_resource_id,
              }
            : null,
        };
      },
    );

    const content = visitSummaryArtifact.content || {};
    return {
      session: this.mapSession(sessionRow),
      summary: {
        plainLanguageSummary: content.plain_language_summary || '',
        keyPoints: Array.isArray(content.key_points) ? content.key_points : [],
        language: content.language || 'en',
        literacyScore: typeof content.literacy_score === 'number' ? content.literacy_score : null,
        literacyLevel: content.literacy_level || null,
        teachBackQuestions: Array.isArray(content.teach_back_questions) ? content.teach_back_questions : [],
        companionTopicChecklist: Array.isArray(content.companion_topic_checklist)
          ? content.companion_topic_checklist
          : [],
        generatedAt: visitSummaryArtifact.updated_at || visitSummaryArtifact.created_at || null,
      },
      checklist,
    };
  }

  async listCompanionMessages(
    tenantDb: DataSource,
    sessionId: string,
    patientId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    this.assertPatientSessionAccess(sessionRow, patientId);
    this.assertPatientCompanionAccessAllowed(sessionRow);

    const limit = Math.min(Math.max(Number(options.limit || 50), 1), 200);
    const offset = Math.max(Number(options.offset || 0), 0);
    const thread = await this.ensureCompanionThread(tenantDb, sessionRow, patientId);

    const rows = await tenantDb.query(
      `
        SELECT id, sender_type, sender_id, message_type, message_text, grounded_context, escalation_detected, escalation_event_id, metadata, created_at
        FROM post_visit_companion_messages
        WHERE thread_id = $1
        ORDER BY created_at ASC
        LIMIT $2
        OFFSET $3
      `,
      [thread.id, limit, offset],
    );

    return {
      sessionId,
      thread: {
        id: thread.id,
        status: thread.status,
        messageCount: thread.message_count || 0,
        lastMessageAt: thread.last_message_at || null,
      },
      messages: rows.map((row: any) => ({
        id: row.id,
        senderType: row.sender_type,
        senderId: row.sender_id,
        messageType: row.message_type,
        message: row.message_text,
        escalationDetected: row.escalation_detected,
        escalationEventId: row.escalation_event_id,
        groundedContext: row.grounded_context || {},
        metadata: row.metadata || {},
        createdAt: row.created_at,
      })),
      paging: { limit, offset },
    };
  }

  async sendCompanionMessage(
    tenantDb: DataSource,
    sessionId: string,
    patientId: string,
    payload: { message: string; language?: string; messageType?: string },
    options: { tenantId?: string } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const messageText = String(payload.message || '').trim();
    if (!messageText) {
      throw new BadRequestException('Message is required');
    }
    if (messageText.length > 4000) {
      throw new BadRequestException('Message exceeds maximum allowed length');
    }

    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    this.assertPatientSessionAccess(sessionRow, patientId);
    this.assertPatientCompanionAccessAllowed(sessionRow);

    const [visitSummaryArtifact, recommendationArtifact] = await Promise.all([
      this.getArtifactRow(tenantDb, sessionId, 'visit_summary'),
      this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle'),
    ]);

    if (!visitSummaryArtifact || String(visitSummaryArtifact.artifact_status || '').toLowerCase() !== 'published') {
      throw new ForbiddenException('Companion messaging is unavailable until doctor-approved summary is published');
    }

    if (!recommendationArtifact || String(recommendationArtifact.artifact_status || '').toLowerCase() !== 'published') {
      throw new ForbiddenException('Companion messaging is unavailable until doctor-approved checklist is published');
    }

    const thread = await this.ensureCompanionThread(tenantDb, sessionRow, patientId);
    const groundedContext = {
      summary_artifact_id: visitSummaryArtifact.id,
      recommendation_artifact_id: recommendationArtifact.id,
      summary_excerpt: visitSummaryArtifact.content?.plain_language_summary || null,
      checklist_preview: Array.isArray(recommendationArtifact.content?.items)
        ? recommendationArtifact.content.items.slice(0, 3).map((item: any) => item?.title).filter(Boolean)
        : [],
    };

    const patientMessageRows = await tenantDb.query(
      `
        INSERT INTO post_visit_companion_messages (
          thread_id,
          session_id,
          patient_id,
          sender_type,
          sender_id,
          message_type,
          message_text,
          grounded_context,
          escalation_detected,
          metadata
        ) VALUES ($1,$2,$3,'patient',$4,$5,$6,$7::jsonb,false,$8::jsonb)
        RETURNING *
      `,
      [
        thread.id,
        sessionId,
        patientId,
        patientId,
        payload.messageType || 'question',
        messageText,
        JSON.stringify(groundedContext),
        JSON.stringify({
          language: this.normalizeLanguage(payload.language || sessionRow.language || 'en'),
          source: 'patient_portal_post_visit_companion',
        }),
      ],
    );

    const patientMessage = patientMessageRows[0];
    await this.touchCompanionThreadAfterMessage(tenantDb, thread.id, 'patient');

    const memoryCandidates = this.extractCompanionMemoryCandidates(messageText);
    const topicLabel = this.deriveTopicLabelFromQuestion(messageText);
    if (topicLabel && this.isCompanionMemoryEnabled()) {
      memoryCandidates.push({
        memoryType: 'topic_discussed',
        memoryKey: topicLabel.replace(/\s+/g, '_'),
        memoryValue: topicLabel,
        confidence: 0.6,
      });
    }
    const persistedMemories = await this.persistCompanionMemoryEntries(tenantDb, {
      sessionId,
      patientId,
      sourceMessageId: patientMessage.id,
      createdBy: patientId,
      entries: memoryCandidates,
      metadata: {
        source: 'patient_message',
      },
    });
    const memoryFacts = await this.getPatientCompanionMemoryFacts(tenantDb, patientId, 8);

    const detection = await this.classifyEscalationSignals({
      sessionId,
      message: messageText,
      language: this.normalizeLanguage(payload.language || sessionRow.language || 'en'),
    });
    let escalation: any = null;
    if (detection.detected || this.isEscalationConfidenceV2Enabled()) {
      escalation = await this.createEscalationEvent(tenantDb, {
        sessionRow,
        threadId: thread.id,
        messageId: patientMessage.id,
        detection,
        messageText,
        tenantId: options.tenantId,
      });

      await tenantDb.query(
        `
          UPDATE post_visit_companion_messages
          SET escalation_detected = TRUE,
              escalation_event_id = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [patientMessage.id, escalation.id],
      );
      patientMessage.escalation_detected = true;
      patientMessage.escalation_event_id = escalation.id;
    }

    if (this.escalationRouter && detection.severity && detection.severity !== 'low') {
      const signal: EscalationSignal = {
        escalationLevel: detection.severity as EscalationSignal['escalationLevel'],
        summary: detection.rationale ?? 'Escalation signal detected in post-visit message',
        findings: Array.isArray(detection.triggerTerms) ? detection.triggerTerms : [],
        recommendedAction: detection.recommendedAction,
      };
      // Not rethrown — the patient must still get an answer even if the secondary
      // nurse-task/alert routing fails — but no longer silently invisible (S264).
      const routingEscalationId = await this.escalationRouter
        .routeEscalation(sessionId, patientId, signal, tenantDb)
        .catch((err: any) => {
          this.logger.error(
            `Escalation routing failed for session ${sessionId} (severity ${signal.escalationLevel}): ${err?.message}`,
          );
          return null;
        });

      // Link the two escalation records (S265) — post_visit_escalation_events (created
      // above, SLA/workflow lifecycle) and post_visit_escalations (the actionable nurse
      // task + alert delivery) are both written for this same trigger but previously had
      // no cross-reference, so a dashboard reading one had no way to find the other.
      if (routingEscalationId && escalation?.id) {
        await tenantDb
          .query(
            `UPDATE post_visit_escalation_events SET routing_escalation_id = $2, updated_at = NOW() WHERE id = $1`,
            [escalation.id, routingEscalationId],
          )
          .catch((err: any) => {
            this.logger.error(`Failed to link escalation event ${escalation.id} to routing escalation ${routingEscalationId}: ${err?.message}`);
          });
      }
    }

    const assistantAnswer = await this.buildGroundedCompanionAnswer({
      sessionId,
      tenantId: options.tenantId,
      question: messageText,
      visitSummaryArtifact,
      recommendationArtifact,
      escalation: detection,
      memoryFacts,
    });
    await this.persistGroundedLlmAudit(tenantDb, {
      model: assistantAnswer.model,
      audit: assistantAnswer.llmAudit,
      sessionId,
      patientId,
      encounterId: sessionRow.appointment_id || sessionRow.consultation_id || null,
      actorUserId: null,
      actorRole: 'patient',
      metadata: {
        channel: 'patient_companion_answer',
        answer_engine: assistantAnswer.source,
        escalation_detected: detection.detected,
        citation_count: Array.isArray(assistantAnswer.citationsUsed) ? assistantAnswer.citationsUsed.length : 0,
        memory_fact_count: memoryFacts.length,
      },
    });

    const assistantMessageRows = await tenantDb.query(
      `
        INSERT INTO post_visit_companion_messages (
          thread_id,
          session_id,
          patient_id,
          sender_type,
          sender_id,
          message_type,
          message_text,
          grounded_context,
          escalation_detected,
          escalation_event_id,
          metadata
        ) VALUES ($1,$2,$3,'system',NULL,$4,$5,$6::jsonb,$7,$8,$9::jsonb)
        RETURNING *
      `,
      [
        thread.id,
        sessionId,
        patientId,
        detection.detected ? 'alert' : 'answer',
        assistantAnswer.answer,
        JSON.stringify(groundedContext),
        detection.detected,
        escalation?.id || null,
        JSON.stringify({
          source: 'post_visit_companion_assistant',
          escalation_route: detection.detected ? detection.routeTarget : null,
          escalation_severity: detection.detected ? detection.severity : null,
          escalation_confidence: detection.confidence,
          escalation_temporality: detection.temporality,
          escalation_classifier_source: detection.classifierSource,
          escalation_suppressed_reason: detection.detected ? null : detection.escalationSuppressedReason || null,
          answer_engine: assistantAnswer.source,
          llm_model: assistantAnswer.model,
          grounded_citation_ids: assistantAnswer.citationsUsed,
          llm_abstained: assistantAnswer.abstained,
        }),
      ],
    );
    const assistantMessage = assistantMessageRows[0];
    await this.touchCompanionThreadAfterMessage(tenantDb, thread.id, 'system');

    const patientAiArtifacts = await this.createPostVisitPatientAiArtifacts(tenantDb, {
      sessionId,
      threadId: thread.id,
      patientId,
      patientMessageId: patientMessage.id,
      assistantMessageId: assistantMessage.id,
      messageText,
      assistantAnswer,
      detection,
      postVisitEscalationId: escalation?.id || null,
    });

    return {
      sessionId,
      threadId: thread.id,
      patientMessage: {
        id: patientMessage.id,
        message: patientMessage.message_text,
        messageType: patientMessage.message_type,
        escalationDetected: patientMessage.escalation_detected,
        escalationEventId: patientMessage.escalation_event_id,
        createdAt: patientMessage.created_at,
      },
      assistantMessage: {
        id: assistantMessage.id,
        message: assistantMessage.message_text,
        messageType: assistantMessage.message_type,
        createdAt: assistantMessage.created_at,
      },
      escalation: escalation && detection.detected ? this.mapEscalationEvent(escalation) : null,
      patientAi: {
        sessionId: patientAiArtifacts.patientAiSession?.id || null,
        escalationId: patientAiArtifacts.patientAiEscalation?.id || null,
        followupOrchestrationId: patientAiArtifacts.followupOrchestration?.id || null,
      },
      memory: {
        enabled: this.isCompanionMemoryEnabled(),
        newEntries: persistedMemories.map((row: any) => this.mapCompanionMemory(row)),
        factCount: memoryFacts.length,
      },
    };
  }

  async recordCompanionAcknowledgement(
    tenantDb: DataSource,
    sessionId: string,
    patientId: string,
    payload: {
      acknowledgementType: 'teach_back' | 'medication_adherence' | 'follow_up_commitment' | 'warning_sign_understanding';
      acknowledged?: boolean;
      details?: Record<string, any>;
    },
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    this.assertPatientSessionAccess(sessionRow, patientId);
    this.assertPatientCompanionAccessAllowed(sessionRow);

    const rows = await tenantDb.query(
      `
        INSERT INTO post_visit_companion_acknowledgements (
          session_id,
          patient_id,
          acknowledgement_type,
          acknowledged,
          details,
          created_by
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)
        RETURNING *
      `,
      [
        sessionId,
        patientId,
        payload.acknowledgementType,
        payload.acknowledged !== false,
        JSON.stringify(payload.details || {}),
        patientId,
      ],
    );

    if (payload.acknowledgementType === 'follow_up_commitment' && payload.acknowledged !== false) {
      const commitmentText = String(payload.details?.commitment || payload.details?.note || 'Patient confirmed follow-up commitment').trim();
      await this.persistCompanionMemoryEntries(tenantDb, {
        sessionId,
        patientId,
        createdBy: patientId,
        entries: [
          {
            memoryType: 'followup_commitment',
            memoryKey: 'acknowledged_commitment',
            memoryValue: commitmentText,
            confidence: 0.9,
          },
        ],
        metadata: {
          source: 'acknowledgement',
          acknowledgement_type: payload.acknowledgementType,
        },
      });
      await tenantDb.query(
        `
          UPDATE patient_followup_orchestrations
          SET status = 'completed',
              reminder_state = 'acknowledged',
              completed_at = NOW(),
              last_touched_at = NOW(),
              payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
                'followUpCommitmentAcknowledged', true,
                'commitmentText', $3
              )
          WHERE patient_id = $1
            AND trigger_type = 'post_visit_companion_message'
            AND status = 'open'
            AND COALESCE(payload->>'sessionId', '') = $2
        `,
        [patientId, sessionId, commitmentText],
      ).catch(() => undefined);
    }

    return {
      id: rows[0].id,
      sessionId: rows[0].session_id,
      patientId: rows[0].patient_id,
      acknowledgementType: rows[0].acknowledgement_type,
      acknowledged: rows[0].acknowledged,
      details: rows[0].details || {},
      createdAt: rows[0].created_at,
    };
  }

  async classifyEscalation(
    tenantDb: DataSource,
    payload: { message: string; sessionId?: string; language?: string },
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const message = String(payload.message || '').trim();
    if (!message) {
      throw new BadRequestException('Message is required');
    }
    if (message.length > 4000) {
      throw new BadRequestException('Message exceeds maximum allowed length');
    }

    const sessionId = String(payload.sessionId || '').trim();
    const classification = await this.classifyEscalationSignals({
      sessionId: sessionId || 'adhoc',
      message,
      language: this.normalizeLanguage(payload.language || 'en'),
    });

    return {
      sessionId: sessionId || null,
      message,
      classification: {
        detected: classification.detected,
        severity: classification.severity,
        routeTarget: classification.routeTarget,
        triggerType: classification.triggerType,
        triggerTerms: classification.triggerTerms,
        confidence: classification.confidence,
        temporality: classification.temporality,
        classifierSource: classification.classifierSource,
        classifierModel: classification.classifierModel || null,
        suppressedReason: classification.escalationSuppressedReason || null,
        slaMinutes: classification.slaMinutes,
      },
    };
  }

  async analyzeIntraVisitAlerts(
    tenantDb: DataSource,
    sessionId: string,
    payload: { text?: string; source?: string; transcriptOffsetSeconds?: number } = {},
    options: { actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const text = String(payload.text || '').trim();
    if (!text) {
      throw new BadRequestException('Transcript text is required');
    }
    if (text.length > 4000) {
      throw new BadRequestException('Transcript text exceeds maximum allowed length');
    }

    if (!this.isIntraVisitAlertsEnabled()) {
      return {
        featureEnabled: false,
        sessionId,
        analyzedAt: new Date().toISOString(),
        alerts: [],
        summary: {
          total: 0,
          openCount: 0,
          acknowledgedOpenCount: 0,
          overdueUnacknowledgedCount: 0,
          criticalOpenCount: 0,
          highOpenCount: 0,
          moderateOpenCount: 0,
        },
      };
    }

    const source = this.normalizeIntraVisitAlertSource(payload.source);
    const transcriptOffsetSeconds = this.normalizeIntraVisitTranscriptOffset(payload.transcriptOffsetSeconds);
    const drafts = realTimeAlertEngineDetect(text) as IntraVisitAlertDraft[];
    const insertedAlerts: any[] = [];

    for (const draft of drafts) {
      const recentRows = await tenantDb.query(
        `
          SELECT id
          FROM post_visit_intravisit_alert_events
          WHERE session_id = $1
            AND status = 'open'
            AND alert_type = $2
            AND signal_text = $3
            AND detected_at >= NOW() - INTERVAL '20 minutes'
          LIMIT 1
        `,
        [sessionId, draft.alertType, text],
      );
      if (recentRows?.length) {
        continue;
      }

      const routingDecision = await this.resolveIntraVisitRoutingDecision(tenantDb, sessionRow, draft);

      const rows = await tenantDb.query(
        `
          INSERT INTO post_visit_intravisit_alert_events (
            session_id,
            patient_id,
            status,
            alert_type,
            severity,
            route_target,
            assigned_role,
            assigned_user_id,
            assigned_team,
            policy_version,
            routing_rationale,
            source,
            transcript_offset_seconds,
            signal_text,
            alert_message,
            suggested_action,
            confidence,
            trigger_terms,
            sla_due_at,
            metadata
          ) VALUES (
            $1,$2,'open',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19::jsonb
          )
          RETURNING *
        `,
        [
          sessionId,
          sessionRow.patient_id,
          draft.alertType,
          draft.severity,
          routingDecision.routeTarget,
          routingDecision.assignedRole,
          routingDecision.assignedUserId,
          routingDecision.assignedTeam,
          routingDecision.policyVersion,
          routingDecision.routingRationale,
          source,
          transcriptOffsetSeconds,
          text,
          draft.alertMessage,
          draft.suggestedAction,
          draft.confidence,
          JSON.stringify(Array.isArray(draft.triggerTerms) ? draft.triggerTerms : []),
          routingDecision.slaDueAt ? routingDecision.slaDueAt.toISOString() : null,
          JSON.stringify({
            ...(draft.metadata || {}),
            source_pipeline: 'post_visit_intravisit_alert_engine_v1',
            actor_user_id: options.actorUserId || null,
            routing_policy: {
              version: routingDecision.policyVersion,
              route_target: routingDecision.routeTarget,
              assigned_role: routingDecision.assignedRole,
              assigned_user_id: routingDecision.assignedUserId,
              assigned_team: routingDecision.assignedTeam,
              rationale: routingDecision.routingRationale,
            },
          }),
        ],
      );
      insertedAlerts.push(rows[0]);
    }

    const summaryRows = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
          COUNT(*) FILTER (WHERE status = 'open' AND acknowledged_at IS NOT NULL)::int AS acknowledged_open_count,
          COUNT(*) FILTER (WHERE status = 'open' AND acknowledged_at IS NULL AND sla_due_at IS NOT NULL AND sla_due_at < NOW())::int AS overdue_unacknowledged_count,
          COUNT(*) FILTER (WHERE status = 'open' AND severity = 'critical')::int AS critical_open_count,
          COUNT(*) FILTER (WHERE status = 'open' AND severity = 'high')::int AS high_open_count,
          COUNT(*) FILTER (WHERE status = 'open' AND severity = 'moderate')::int AS moderate_open_count
        FROM post_visit_intravisit_alert_events
        WHERE session_id = $1
      `,
      [sessionId],
    );

    const summary = summaryRows?.[0] || {};
    return {
      featureEnabled: true,
      sessionId,
      analyzedAt: new Date().toISOString(),
      alerts: insertedAlerts.map((row: any) => this.mapIntraVisitAlertEvent(row)),
      summary: {
        total: Number(summary.total || 0),
        openCount: Number(summary.open_count || 0),
        acknowledgedOpenCount: Number(summary.acknowledged_open_count || 0),
        overdueUnacknowledgedCount: Number(summary.overdue_unacknowledged_count || 0),
        criticalOpenCount: Number(summary.critical_open_count || 0),
        highOpenCount: Number(summary.high_open_count || 0),
        moderateOpenCount: Number(summary.moderate_open_count || 0),
      },
    };
  }

  async analyzeIntraVisitAudioChunk(
    tenantDb: DataSource,
    sessionId: string,
    audioFile: Express.Multer.File,
    payload: {
      language?: 'en' | 'sn' | 'nd' | 'auto';
      temperature?: number;
      prompt?: string;
      source?: string;
      transcriptOffsetSeconds?: number;
    } = {},
    options: { actorUserId?: string | null; tenantId?: string; authorization?: string } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    const hasBuffer = !!(audioFile?.buffer && Buffer.isBuffer(audioFile.buffer) && audioFile.buffer.length > 0);
    const hasPath = typeof (audioFile as any)?.path === 'string' && String((audioFile as any).path).trim().length > 0;
    if (!hasBuffer && !hasPath) {
      throw new BadRequestException('Audio chunk file is required');
    }

    const normalizedLanguage =
      payload.language === 'en' || payload.language === 'sn' || payload.language === 'nd' || payload.language === 'auto'
        ? payload.language
        : 'auto';
    const temperatureRaw = Number(payload.temperature);
    const normalizedTemperature = Number.isFinite(temperatureRaw)
      ? Math.max(0, Math.min(1, temperatureRaw))
      : 0;

    const transcription = await this.transcriptionService.transcribe(
      audioFile,
      {
        language: normalizedLanguage,
        temperature: normalizedTemperature,
        prompt:
          String(payload.prompt || '').trim() ||
          'Live medical consultation chunk. Transcribe critical symptoms, vitals, medication reactions, and emergency safety phrases accurately.',
      },
      {
        tenantId: options.tenantId,
        authorization: options.authorization,
      },
    );

    const transcriptText = String(transcription.text || '').trim();
    if (!transcriptText) {
      const existing = await this.listIntraVisitAlerts(tenantDb, sessionId, { status: 'open', limit: 20, offset: 0 });
      return {
        featureEnabled: existing.featureEnabled,
        sessionId,
        transcript: {
          text: '',
          language: transcription.language || normalizedLanguage || 'en',
          confidence: transcription.confidence ?? null,
          segmentCount: Array.isArray(transcription.segments) ? transcription.segments.length : 0,
        },
        alerts: [],
        summary: existing.summary,
      };
    }

    const analyzed = await this.analyzeIntraVisitAlerts(
      tenantDb,
      sessionId,
      {
        text: transcriptText,
        source: payload.source || 'streamed_audio_chunk',
        transcriptOffsetSeconds: payload.transcriptOffsetSeconds,
      },
      {
        actorUserId: options.actorUserId || null,
      },
    );

    return {
      featureEnabled: analyzed.featureEnabled,
      sessionId,
      transcript: {
        text: transcriptText,
        language: transcription.language || normalizedLanguage || 'en',
        confidence: transcription.confidence ?? null,
        segmentCount: Array.isArray(transcription.segments) ? transcription.segments.length : 0,
      },
      alerts: analyzed.alerts,
      summary: analyzed.summary,
    };
  }

  // S108: Delegated to PostVisitEscalationService.
  async listIntraVisitAlerts(
    tenantDb: DataSource,
    sessionId: string,
    filters: {
      status?: IntraVisitAlertStatus;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    if (this.escalationService) return this.escalationService.listIntraVisitAlerts(tenantDb, sessionId, filters);
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 200);
    const offset = Math.max(Number(filters.offset || 0), 0);

    if (!this.isIntraVisitAlertsEnabled()) {
      return {
        featureEnabled: false,
        sessionId,
        items: [],
        summary: {
          total: 0,
          openCount: 0,
          acknowledgedOpenCount: 0,
          overdueUnacknowledgedCount: 0,
          criticalOpenCount: 0,
          highOpenCount: 0,
          moderateOpenCount: 0,
        },
        paging: {
          limit,
          offset,
        },
      };
    }

    const params: any[] = [sessionId];
    let whereSql = `WHERE session_id = $1`;
    if (filters.status && ['open', 'confirmed', 'dismissed'].includes(filters.status)) {
      params.push(filters.status);
      whereSql += ` AND status = $${params.length}`;
    }
    params.push(limit);
    params.push(offset);

    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_intravisit_alert_events
        ${whereSql}
        ORDER BY detected_at DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params,
    );

    const summaryRows = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
          COUNT(*) FILTER (WHERE status = 'open' AND acknowledged_at IS NOT NULL)::int AS acknowledged_open_count,
          COUNT(*) FILTER (WHERE status = 'open' AND acknowledged_at IS NULL AND sla_due_at IS NOT NULL AND sla_due_at < NOW())::int AS overdue_unacknowledged_count,
          COUNT(*) FILTER (WHERE status = 'open' AND severity = 'critical')::int AS critical_open_count,
          COUNT(*) FILTER (WHERE status = 'open' AND severity = 'high')::int AS high_open_count,
          COUNT(*) FILTER (WHERE status = 'open' AND severity = 'moderate')::int AS moderate_open_count
        FROM post_visit_intravisit_alert_events
        WHERE session_id = $1
      `,
      [sessionId],
    );
    const summary = summaryRows?.[0] || {};

    return {
      featureEnabled: true,
      sessionId,
      items: rows.map((row: any) => this.mapIntraVisitAlertEvent(row)),
      summary: {
        total: Number(summary.total || 0),
        openCount: Number(summary.open_count || 0),
        acknowledgedOpenCount: Number(summary.acknowledged_open_count || 0),
        overdueUnacknowledgedCount: Number(summary.overdue_unacknowledged_count || 0),
        criticalOpenCount: Number(summary.critical_open_count || 0),
        highOpenCount: Number(summary.high_open_count || 0),
        moderateOpenCount: Number(summary.moderate_open_count || 0),
      },
      paging: {
        limit,
        offset,
      },
    };
  }

  // S108: Delegated to PostVisitEscalationService.
  async acknowledgeIntraVisitAlert(
    tenantDb: DataSource,
    sessionId: string,
    alertId: string,
    payload: { note?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
    if (this.escalationService) return this.escalationService.acknowledgeIntraVisitAlert(tenantDb, sessionId, alertId, payload, options);
    await this.ensurePostVisitSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated user is required to acknowledge intra-visit alert');
    }
    await this.getSessionRow(tenantDb, sessionId);

    const existingRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_intravisit_alert_events
        WHERE id = $1
          AND session_id = $2
        LIMIT 1
      `,
      [alertId, sessionId],
    );
    if (!existingRows?.length) {
      throw new NotFoundException('Intra-visit alert not found');
    }

    const existing = existingRows[0];
    if (String(existing.status || '').toLowerCase() !== 'open') {
      throw new BadRequestException('Only open intra-visit alerts can be acknowledged');
    }

    const updatedRows = await tenantDb.query(
      `
        UPDATE post_visit_intravisit_alert_events
        SET acknowledged_at = COALESCE(acknowledged_at, NOW()),
            acknowledged_by = COALESCE(acknowledged_by, $3),
            acknowledgment_note = COALESCE($4, acknowledgment_note),
            updated_at = NOW()
        WHERE id = $1
          AND session_id = $2
        RETURNING *
      `,
      [alertId, sessionId, options.actorUserId, payload.note || null],
    );

    if (this.hipaaAuditService && existing.patient_id) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_UPDATE,
          'post_visit_intravisit_alert',
          alertId,
          existing.patient_id,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionId,
          { action: 'acknowledge', sessionId },
        )
        .catch(() => {});
    }
    return this.mapIntraVisitAlertEvent(updatedRows[0]);
  }

  // S108: Delegated to PostVisitEscalationService.
  async resolveIntraVisitAlert(
    tenantDb: DataSource,
    sessionId: string,
    alertId: string,
    payload: { status?: 'confirmed' | 'dismissed'; note?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
    if (this.escalationService) return this.escalationService.resolveIntraVisitAlert(tenantDb, sessionId, alertId, payload, options);
    await this.ensurePostVisitSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated user is required to resolve intra-visit alert');
    }
    await this.getSessionRow(tenantDb, sessionId);

    const existingRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_intravisit_alert_events
        WHERE id = $1
          AND session_id = $2
        LIMIT 1
      `,
      [alertId, sessionId],
    );
    if (!existingRows?.length) {
      throw new NotFoundException('Intra-visit alert not found');
    }

    const targetStatus = payload.status === 'dismissed' ? 'dismissed' : 'confirmed';
    const existing = existingRows[0];
    const patientId = existing.patient_id;
    const updatedRows = await tenantDb.query(
      `
        UPDATE post_visit_intravisit_alert_events
        SET status = $3,
            acknowledged_at = COALESCE(acknowledged_at, NOW()),
            acknowledged_by = COALESCE(acknowledged_by, $4),
            acknowledgment_note = COALESCE(acknowledgment_note, $5),
            resolved_at = NOW(),
            resolved_by = $4,
            resolution_note = COALESCE($5, resolution_note),
            updated_at = NOW()
        WHERE id = $1
          AND session_id = $2
        RETURNING *
      `,
      [alertId, sessionId, targetStatus, options.actorUserId, payload.note || null],
    );
    if (this.hipaaAuditService && patientId) {
      await this.hipaaAuditService
        .logPhiModification(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_UPDATE,
          'post_visit_intravisit_alert',
          alertId,
          patientId,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionId,
          { action: 'resolve', status: targetStatus, sessionId },
        )
        .catch(() => {});
    }
    return this.mapIntraVisitAlertEvent(updatedRows[0]);
  }

  async getTrialMemoryAnalytics(
    tenantDb: DataSource,
    options: {
      days?: number;
      routeTarget?: 'doctor' | 'nurse' | 'emergency';
    } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.ensureTrialDecisionSlaEscalations(tenantDb, { limit: 300 });

    const days = Math.min(Math.max(Number(options.days || 30), 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const slaHours = this.getTrialDecisionSlaHours();

    const trialRows = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE match_status = 'proposed')::int AS proposed,
          COUNT(*) FILTER (WHERE match_status = 'considered')::int AS considered,
          COUNT(*) FILTER (WHERE match_status = 'deferred')::int AS deferred,
          COUNT(*) FILTER (WHERE match_status = 'excluded')::int AS excluded,
          COUNT(*) FILTER (WHERE match_status = 'enrolled')::int AS enrolled,
          COUNT(*) FILTER (
            WHERE match_status = 'proposed'
              AND EXTRACT(EPOCH FROM (NOW() - COALESCE(reviewed_at, created_at))) / 3600 >= $2
          )::int AS stale_proposed,
          COUNT(*) FILTER (
            WHERE match_status = 'deferred'
              AND EXTRACT(EPOCH FROM (NOW() - COALESCE(reviewed_at, created_at))) / 3600 >= $2
          )::int AS stale_deferred
        FROM post_visit_trial_matches
        WHERE created_at >= $1
      `,
      [since.toISOString(), slaHours],
    );

    const actionRows = await tenantDb.query(
      `
        SELECT action, COUNT(*)::int AS count
        FROM post_visit_trial_match_audit_log
        WHERE created_at >= $1
        GROUP BY action
      `,
      [since.toISOString()],
    );

    const memoryRows = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
          COUNT(*) FILTER (WHERE is_active = FALSE)::int AS retired,
          COUNT(*) FILTER (WHERE promoted_at IS NOT NULL AND promoted_at >= $1)::int AS promoted_recent,
          COUNT(*) FILTER (WHERE retired_at IS NOT NULL AND retired_at >= $1)::int AS retired_recent
        FROM post_visit_companion_memory
        WHERE created_at >= $1 OR updated_at >= $1
      `,
      [since.toISOString()],
    );

    const escalationConditions: string[] = [`trigger_type = 'trial_decision_sla_breach'`, `detected_at >= $1`];
    const escalationParams: any[] = [since.toISOString()];
    if (options.routeTarget) {
      escalationConditions.push(`route_target = $2`);
      escalationParams.push(options.routeTarget);
    }

    const escalationRows = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
          COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS acknowledged_count,
          COUNT(*) FILTER (
            WHERE status IN ('open','acknowledged')
              AND sla_due_at IS NOT NULL
              AND sla_due_at < NOW()
          )::int AS breached_count
        FROM post_visit_escalation_events
        WHERE ${escalationConditions.join(' AND ')}
      `,
      escalationParams,
    );

    const trial = trialRows?.[0] || {};
    const memory = memoryRows?.[0] || {};
    const escalation = escalationRows?.[0] || {};
    const totalTrials = Number(trial.total || 0);
    const considered = Number(trial.considered || 0);
    const enrolled = Number(trial.enrolled || 0);

    return {
      generatedAt: new Date().toISOString(),
      window: {
        days,
        since: since.toISOString(),
      },
      trialFunnel: {
        total: totalTrials,
        proposed: Number(trial.proposed || 0),
        considered,
        deferred: Number(trial.deferred || 0),
        excluded: Number(trial.excluded || 0),
        enrolled,
        staleProposed: Number(trial.stale_proposed || 0),
        staleDeferred: Number(trial.stale_deferred || 0),
        considerationRatePercent: totalTrials > 0 ? Math.round(((considered + enrolled) / totalTrials) * 100) : 0,
        enrollmentRatePercent: totalTrials > 0 ? Math.round((enrolled / totalTrials) * 100) : 0,
      },
      trialActions: {
        byAction: actionRows.reduce((acc: Record<string, number>, row: any) => {
          acc[String(row.action || 'unknown')] = Number(row.count || 0);
          return acc;
        }, {}),
      },
      companionMemory: {
        total: Number(memory.total || 0),
        active: Number(memory.active || 0),
        retired: Number(memory.retired || 0),
        promotedRecent: Number(memory.promoted_recent || 0),
        retiredRecent: Number(memory.retired_recent || 0),
      },
      trialDecisionSla: {
        hours: slaHours,
        openEscalations: Number(escalation.open_count || 0),
        acknowledgedEscalations: Number(escalation.acknowledged_count || 0),
        breachedEscalations: Number(escalation.breached_count || 0),
        totalEscalations: Number(escalation.total || 0),
      },
    };
  }

  async getTrialDecisionSlaAccountability(
    tenantDb: DataSource,
    options: {
      days?: number;
      routeTarget?: 'doctor' | 'nurse' | 'emergency';
      clinicianId?: string;
      limit?: number;
    } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.ensureTrialDecisionSlaEscalations(tenantDb, { limit: 300 });

    const days = Math.min(Math.max(Number(options.days || 30), 1), 365);
    const limit = Math.min(Math.max(Number(options.limit || 25), 1), 200);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const conditions: string[] = [
      `e.trigger_type = 'trial_decision_sla_breach'`,
      `e.detected_at >= $1`,
      `s.doctor_id IS NOT NULL`,
    ];
    const params: any[] = [since.toISOString()];
    let index = 2;
    if (options.routeTarget) {
      conditions.push(`e.route_target = $${index++}`);
      params.push(options.routeTarget);
    }
    if (options.clinicianId) {
      conditions.push(`s.doctor_id = $${index++}`);
      params.push(options.clinicianId);
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    const rows = await tenantDb.query(
      `
        SELECT
          s.doctor_id AS clinician_id,
          u.first_name,
          u.last_name,
          u.role,
          u.email,
          COUNT(*)::int AS total_assigned,
          COUNT(*) FILTER (WHERE e.status IN ('open','acknowledged'))::int AS open_count,
          COUNT(*) FILTER (
            WHERE e.status IN ('open','acknowledged')
              AND e.sla_due_at IS NOT NULL
              AND e.sla_due_at < NOW()
          )::int AS breached_open_count,
          COUNT(*) FILTER (WHERE e.acknowledged_at IS NOT NULL)::int AS acknowledged_count,
          COUNT(*) FILTER (WHERE e.status IN ('resolved','dismissed'))::int AS resolved_count,
          COUNT(*) FILTER (
            WHERE e.status IN ('resolved','dismissed')
              AND e.sla_due_at IS NOT NULL
              AND e.resolved_at IS NOT NULL
              AND e.resolved_at <= e.sla_due_at
          )::int AS resolved_within_sla_count,
          AVG(EXTRACT(EPOCH FROM (e.acknowledged_at - e.detected_at)) / 60.0)
            FILTER (WHERE e.acknowledged_at IS NOT NULL) AS avg_ack_minutes,
          AVG(EXTRACT(EPOCH FROM (e.resolved_at - e.detected_at)) / 60.0)
            FILTER (WHERE e.resolved_at IS NOT NULL) AS avg_resolve_minutes,
          MAX(COALESCE(e.resolved_at, e.acknowledged_at, e.detected_at)) AS last_action_at
        FROM post_visit_escalation_events e
        LEFT JOIN post_visit_sessions s ON s.id = e.session_id
        LEFT JOIN users u ON u.id = s.doctor_id
        ${whereSql}
        GROUP BY s.doctor_id, u.first_name, u.last_name, u.role, u.email
        ORDER BY breached_open_count DESC, open_count DESC, total_assigned DESC, last_action_at DESC
        LIMIT $${index}
      `,
      [...params, limit],
    );

    const summaryRows = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total_escalations,
          COUNT(*) FILTER (WHERE e.status IN ('open','acknowledged'))::int AS open_escalations,
          COUNT(*) FILTER (
            WHERE e.status IN ('open','acknowledged')
              AND e.sla_due_at IS NOT NULL
              AND e.sla_due_at < NOW()
          )::int AS breached_open_escalations,
          COUNT(*) FILTER (WHERE e.status IN ('resolved','dismissed'))::int AS resolved_escalations,
          COUNT(*) FILTER (
            WHERE e.status IN ('resolved','dismissed')
              AND e.sla_due_at IS NOT NULL
              AND e.resolved_at IS NOT NULL
              AND e.resolved_at <= e.sla_due_at
          )::int AS resolved_within_sla,
          COUNT(DISTINCT s.doctor_id)::int AS clinicians_with_assignments
        FROM post_visit_escalation_events e
        LEFT JOIN post_visit_sessions s ON s.id = e.session_id
        ${whereSql}
      `,
      params,
    );

    const summaryRow = summaryRows?.[0] || {};
    const resolvedTotal = Number(summaryRow.resolved_escalations || 0);
    const resolvedWithinSla = Number(summaryRow.resolved_within_sla || 0);

    return {
      generatedAt: new Date().toISOString(),
      window: {
        days,
        since: since.toISOString(),
      },
      summary: {
        totalEscalations: Number(summaryRow.total_escalations || 0),
        openEscalations: Number(summaryRow.open_escalations || 0),
        breachedOpenEscalations: Number(summaryRow.breached_open_escalations || 0),
        resolvedEscalations: resolvedTotal,
        resolvedWithinSla,
        resolvedWithinSlaPercent: resolvedTotal > 0 ? Math.round((resolvedWithinSla / resolvedTotal) * 100) : 0,
        cliniciansWithAssignments: Number(summaryRow.clinicians_with_assignments || 0),
      },
      items: rows.map((row: any) => {
        const resolvedCount = Number(row.resolved_count || 0);
        const resolvedWithinSlaCount = Number(row.resolved_within_sla_count || 0);
        return {
          clinician: {
            id: row.clinician_id,
            firstName: row.first_name || null,
            lastName: row.last_name || null,
            role: row.role || null,
            email: row.email || null,
          },
          totalAssigned: Number(row.total_assigned || 0),
          openCount: Number(row.open_count || 0),
          breachedOpenCount: Number(row.breached_open_count || 0),
          acknowledgedCount: Number(row.acknowledged_count || 0),
          resolvedCount,
          resolvedWithinSlaCount,
          resolvedWithinSlaPercent: resolvedCount > 0 ? Math.round((resolvedWithinSlaCount / resolvedCount) * 100) : 0,
          averageAcknowledgeMinutes:
            row.avg_ack_minutes === null || row.avg_ack_minutes === undefined
              ? null
              : Math.round(Number(row.avg_ack_minutes) * 10) / 10,
          averageResolveMinutes:
            row.avg_resolve_minutes === null || row.avg_resolve_minutes === undefined
              ? null
              : Math.round(Number(row.avg_resolve_minutes) * 10) / 10,
          lastActionAt: row.last_action_at || null,
        };
      }),
    };
  }

  private normalizeTrialAuditExportFormat(format?: string | null): 'json' | 'csv' {
    const normalized = String(format || 'json').trim().toLowerCase();
    if (normalized === 'csv') return 'csv';
    return 'json';
  }

  private escapeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const serialized =
      typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);
    if (serialized.includes(',') || serialized.includes('"') || serialized.includes('\n')) {
      return `"${serialized.replace(/"/g, '""')}"`;
    }
    return serialized;
  }

  private buildCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
    const header = columns.join(',');
    const body = rows.map((row) => columns.map((column) => this.escapeCsvCell(row[column])).join(',')).join('\n');
    return body ? `${header}\n${body}` : `${header}\n`;
  }

  async exportTrialMemoryAudit(
    tenantDb: DataSource,
    options: {
      days?: number;
      format?: 'json' | 'csv' | string;
      routeTarget?: 'doctor' | 'nurse' | 'emergency';
      clinicianId?: string;
      sessionId?: string;
      limit?: number;
    } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.ensureTrialDecisionSlaEscalations(tenantDb, { limit: 300 });

    const format = this.normalizeTrialAuditExportFormat(options.format);
    const days = Math.min(Math.max(Number(options.days || 30), 1), 365);
    const limit = Math.min(Math.max(Number(options.limit || 2000), 1), 10000);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const sharedConditions: string[] = [`detected_at >= $1`];
    const sharedParams: any[] = [since.toISOString()];
    let sharedIndex = 2;
    if (options.routeTarget) {
      sharedConditions.push(`route_target = $${sharedIndex++}`);
      sharedParams.push(options.routeTarget);
    }
    if (options.sessionId) {
      sharedConditions.push(`session_id = $${sharedIndex++}`);
      sharedParams.push(options.sessionId);
    }

    const escalationRows = await tenantDb.query(
      `
        SELECT
          e.*,
          s.doctor_id AS session_doctor_id,
          u.first_name AS doctor_first_name,
          u.last_name AS doctor_last_name
        FROM post_visit_escalation_events e
        LEFT JOIN post_visit_sessions s ON s.id = e.session_id
        LEFT JOIN users u ON u.id = s.doctor_id
        WHERE e.trigger_type = 'trial_decision_sla_breach'
          AND ${sharedConditions.join(' AND ').replace(/detected_at/g, 'e.detected_at').replace(/route_target/g, 'e.route_target').replace(/session_id/g, 'e.session_id')}
          ${options.clinicianId ? `AND s.doctor_id = $${sharedIndex++}` : ''}
        ORDER BY e.detected_at DESC
        LIMIT $${sharedIndex}
      `,
      [...sharedParams, ...(options.clinicianId ? [options.clinicianId] : []), limit],
    );

    const trialAuditRows = await tenantDb.query(
      `
        SELECT
          a.*,
          tm.trial_id,
          tm.trial_title,
          tm.match_status,
          s.doctor_id AS session_doctor_id,
          u.first_name AS doctor_first_name,
          u.last_name AS doctor_last_name
        FROM post_visit_trial_match_audit_log a
        LEFT JOIN post_visit_trial_matches tm ON tm.id = a.trial_match_id
        LEFT JOIN post_visit_sessions s ON s.id = a.session_id
        LEFT JOIN users u ON u.id = s.doctor_id
        WHERE a.acted_at >= $1
          ${options.sessionId ? 'AND a.session_id = $2' : ''}
          ${options.clinicianId ? `AND s.doctor_id = $${options.sessionId ? 3 : 2}` : ''}
        ORDER BY a.acted_at DESC
        LIMIT $${options.sessionId ? (options.clinicianId ? 4 : 3) : options.clinicianId ? 3 : 2}
      `,
      [
        since.toISOString(),
        ...(options.sessionId ? [options.sessionId] : []),
        ...(options.clinicianId ? [options.clinicianId] : []),
        limit,
      ],
    );

    const memoryRows = await tenantDb.query(
      `
        SELECT
          m.*,
          s.doctor_id AS session_doctor_id,
          u.first_name AS doctor_first_name,
          u.last_name AS doctor_last_name
        FROM post_visit_companion_memory m
        LEFT JOIN post_visit_sessions s ON s.id = m.session_id
        LEFT JOIN users u ON u.id = s.doctor_id
        WHERE COALESCE(m.updated_at, m.created_at) >= $1
          ${options.sessionId ? 'AND m.session_id = $2' : ''}
          ${options.clinicianId ? `AND s.doctor_id = $${options.sessionId ? 3 : 2}` : ''}
        ORDER BY COALESCE(m.updated_at, m.created_at) DESC
        LIMIT $${options.sessionId ? (options.clinicianId ? 4 : 3) : options.clinicianId ? 3 : 2}
      `,
      [
        since.toISOString(),
        ...(options.sessionId ? [options.sessionId] : []),
        ...(options.clinicianId ? [options.clinicianId] : []),
        limit,
      ],
    );

    const escalationRecords = escalationRows.map((row: any) => {
      const metadata = row.metadata || {};
      const clinicianName = [row.doctor_first_name, row.doctor_last_name].filter(Boolean).join(' ').trim() || null;
      return {
        eventType: 'trial_sla_escalation',
        eventTimestamp: row.detected_at,
        sessionId: row.session_id,
        patientId: row.patient_id,
        clinicianId: row.session_doctor_id || null,
        clinicianName,
        routeTarget: row.route_target || null,
        severity: row.severity || null,
        status: row.status || null,
        action: 'sla_breach_opened',
        previousStatus: null,
        nextStatus: row.status || null,
        trialMatchId: metadata?.trial_match_id || null,
        trialId: metadata?.trial_id || null,
        trialTitle: metadata?.trial_title || null,
        memoryId: null,
        memoryType: null,
        memoryKey: null,
        memoryValue: null,
        staleHours: metadata?.stale_hours ?? null,
        slaHours: metadata?.sla_hours ?? null,
        acknowledgedAt: row.acknowledged_at || null,
        resolvedAt: row.resolved_at || null,
        note: row.classification_reason || row.resolution_note || null,
        metadata,
      };
    });

    const trialDecisionRecords = trialAuditRows.map((row: any) => {
      const clinicianName = [row.doctor_first_name, row.doctor_last_name].filter(Boolean).join(' ').trim() || null;
      return {
        eventType: 'trial_match_review_action',
        eventTimestamp: row.acted_at || row.created_at,
        sessionId: row.session_id,
        patientId: row.patient_id,
        clinicianId: row.session_doctor_id || row.acted_by || null,
        clinicianName,
        routeTarget: null,
        severity: null,
        status: row.next_status || null,
        action: row.action || null,
        previousStatus: row.previous_status || null,
        nextStatus: row.next_status || null,
        trialMatchId: row.trial_match_id || null,
        trialId: row.trial_id || null,
        trialTitle: row.trial_title || null,
        memoryId: null,
        memoryType: null,
        memoryKey: null,
        memoryValue: null,
        staleHours: null,
        slaHours: this.getTrialDecisionSlaHours(),
        acknowledgedAt: null,
        resolvedAt: null,
        note: row.note || null,
        metadata: row.metadata || {},
      };
    });

    const memoryRecords = memoryRows.map((row: any) => {
      const clinicianName = [row.doctor_first_name, row.doctor_last_name].filter(Boolean).join(' ').trim() || null;
      const isRetired = row.is_active === false;
      const action = isRetired ? 'retired' : row.promoted_at ? 'promoted' : 'recorded';
      return {
        eventType: 'companion_memory_state',
        eventTimestamp: row.updated_at || row.created_at,
        sessionId: row.session_id,
        patientId: row.patient_id,
        clinicianId: row.session_doctor_id || row.retired_by || row.promoted_by || row.created_by || null,
        clinicianName,
        routeTarget: null,
        severity: null,
        status: isRetired ? 'retired' : 'active',
        action,
        previousStatus: null,
        nextStatus: isRetired ? 'retired' : 'active',
        trialMatchId: null,
        trialId: null,
        trialTitle: null,
        memoryId: row.id,
        memoryType: row.memory_type || null,
        memoryKey: row.memory_key || null,
        memoryValue: row.memory_value || null,
        staleHours: null,
        slaHours: null,
        acknowledgedAt: null,
        resolvedAt: null,
        note: row.curation_note || null,
        metadata: row.metadata || {},
      };
    });

    const records = [...escalationRecords, ...trialDecisionRecords, ...memoryRecords].sort(
      (left, right) => new Date(right.eventTimestamp || 0).getTime() - new Date(left.eventTimestamp || 0).getTime(),
    );

    const responseBase = {
      generatedAt: new Date().toISOString(),
      window: {
        days,
        since: since.toISOString(),
      },
      filters: {
        routeTarget: options.routeTarget || null,
        clinicianId: options.clinicianId || null,
        sessionId: options.sessionId || null,
        limit,
      },
      summary: {
        totalRecords: records.length,
        trialSlaEscalations: escalationRecords.length,
        trialReviewActions: trialDecisionRecords.length,
        companionMemoryEvents: memoryRecords.length,
      },
    };

    if (format === 'csv') {
      const columns = [
        'eventType',
        'eventTimestamp',
        'sessionId',
        'patientId',
        'clinicianId',
        'clinicianName',
        'routeTarget',
        'severity',
        'status',
        'action',
        'previousStatus',
        'nextStatus',
        'trialMatchId',
        'trialId',
        'trialTitle',
        'memoryId',
        'memoryType',
        'memoryKey',
        'memoryValue',
        'staleHours',
        'slaHours',
        'acknowledgedAt',
        'resolvedAt',
        'note',
        'metadata',
      ];
      const csvRows = records.map((row) => ({
        ...row,
        metadata: JSON.stringify(row.metadata || {}),
      }));
      return {
        ...responseBase,
        format: 'csv',
        csv: this.buildCsv(columns, csvRows),
      };
    }

    return {
      ...responseBase,
      format: 'json',
      records,
    };
  }

  async listTrialDecisionCoordinationQueue(
    tenantDb: DataSource,
    filters: {
      status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
      routeTarget?: 'doctor' | 'nurse' | 'emergency';
      limit?: number;
      offset?: number;
    } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.ensureTrialDecisionSlaEscalations(tenantDb, { limit: 300 });

    const status = filters.status || 'open';
    const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 200);
    const offset = Math.max(Number(filters.offset || 0), 0);

    const conditions: string[] = [`e.trigger_type = 'trial_decision_sla_breach'`, `e.status = $1`];
    const params: any[] = [status];
    let index = 2;
    if (filters.routeTarget) {
      conditions.push(`e.route_target = $${index++}`);
      params.push(filters.routeTarget);
    }

    const rows = await tenantDb.query(
      `
        SELECT
          e.*,
          p.first_name,
          p.last_name,
          p.patient_number
        FROM post_visit_escalation_events e
        LEFT JOIN patients p ON p.id = e.patient_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY e.detected_at DESC
        LIMIT $${index++}
        OFFSET $${index++}
      `,
      [...params, limit, offset],
    );

    const summaryRows = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
          COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS acknowledged_count,
          COUNT(*) FILTER (
            WHERE status IN ('open','acknowledged')
              AND sla_due_at IS NOT NULL
              AND sla_due_at < NOW()
          )::int AS breached_count
        FROM post_visit_escalation_events
        WHERE trigger_type = 'trial_decision_sla_breach'
      `,
    );

    return {
      items: rows.map((row: any) => ({
        id: row.id,
        escalation: this.mapEscalationEvent(row),
        trialMatch: {
          id: row.metadata?.trial_match_id || null,
          trialId: row.metadata?.trial_id || null,
          trialTitle: row.metadata?.trial_title || null,
          matchStatus: row.metadata?.match_status || null,
          eligibilityScore:
            row.metadata?.eligibility_score === null || row.metadata?.eligibility_score === undefined
              ? null
              : Number(row.metadata.eligibility_score),
          staleHours:
            row.metadata?.stale_hours === null || row.metadata?.stale_hours === undefined
              ? null
              : Number(row.metadata.stale_hours),
          slaHours:
            row.metadata?.sla_hours === null || row.metadata?.sla_hours === undefined
              ? this.getTrialDecisionSlaHours()
              : Number(row.metadata.sla_hours),
        },
        patient: {
          id: row.patient_id,
          firstName: row.first_name || null,
          lastName: row.last_name || null,
          patientNumber: row.patient_number || null,
        },
      })),
      summary: summaryRows?.[0]
        ? {
            total: Number(summaryRows[0].total || 0),
            openCount: Number(summaryRows[0].open_count || 0),
            acknowledgedCount: Number(summaryRows[0].acknowledged_count || 0),
            breachedCount: Number(summaryRows[0].breached_count || 0),
          }
        : {
            total: 0,
            openCount: 0,
            acknowledgedCount: 0,
            breachedCount: 0,
          },
      paging: {
        limit,
        offset,
      },
    };
  }

  // S108: Delegated to PostVisitEscalationService — implementation lives there.
  async listEscalations(
    tenantDb: DataSource,
    filters: {
      status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
      severity?: 'low' | 'moderate' | 'high' | 'critical';
      routeTarget?: 'emergency' | 'doctor' | 'nurse';
      triggerType?: string;
      temporality?: 'current' | 'historical' | 'unclear';
      minConfidence?: number;
      sessionId?: string;
      patientId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    if (this.escalationService) return this.escalationService.listEscalations(tenantDb, filters);
    await this.ensurePostVisitSchema(tenantDb);
    const conditions: string[] = [];
    const params: any[] = [];
    let index = 1;

    if (filters.status) {
      conditions.push(`e.status = $${index++}`);
      params.push(filters.status);
    }
    if (filters.severity) {
      conditions.push(`e.severity = $${index++}`);
      params.push(filters.severity);
    }
    if (filters.routeTarget) {
      conditions.push(`e.route_target = $${index++}`);
      params.push(filters.routeTarget);
    }
    if (filters.triggerType) {
      conditions.push(`e.trigger_type = $${index++}`);
      params.push(String(filters.triggerType));
    }
    if (filters.temporality) {
      conditions.push(`e.classification_temporality = $${index++}`);
      params.push(filters.temporality);
    }
    if (typeof filters.minConfidence === 'number' && Number.isFinite(filters.minConfidence)) {
      conditions.push(`COALESCE(e.classification_confidence, 0) >= $${index++}`);
      params.push(Math.max(0, Math.min(1, Number(filters.minConfidence))));
    }
    if (filters.sessionId) {
      conditions.push(`e.session_id = $${index++}`);
      params.push(filters.sessionId);
    }
    if (filters.patientId) {
      conditions.push(`e.patient_id = $${index++}`);
      params.push(filters.patientId);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200);
    const offset = Math.max(Number(filters.offset || 0), 0);

    const rows = await tenantDb.query(
      `
        SELECT
          e.*,
          p.first_name,
          p.last_name,
          p.patient_number
        FROM post_visit_escalation_events e
        LEFT JOIN patients p ON p.id = e.patient_id
        ${whereSql}
        ORDER BY e.detected_at DESC
        LIMIT $${index++}
        OFFSET $${index++}
      `,
      [...params, limit, offset],
    );

    const summaryRows = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
          COUNT(*) FILTER (WHERE severity IN ('high','critical') AND status IN ('open','acknowledged'))::int AS high_priority_open_count
        FROM post_visit_escalation_events e
        ${whereSql}
      `,
      params,
    );

    return {
      escalations: rows.map((row: any) => ({
        ...this.mapEscalationEvent(row),
        patient: {
          id: row.patient_id,
          firstName: row.first_name || null,
          lastName: row.last_name || null,
          patientNumber: row.patient_number || null,
        },
      })),
      summary: summaryRows?.[0]
        ? {
            total: Number(summaryRows[0].total || 0),
            openCount: Number(summaryRows[0].open_count || 0),
            highPriorityOpenCount: Number(summaryRows[0].high_priority_open_count || 0),
          }
        : {
            total: 0,
            openCount: 0,
            highPriorityOpenCount: 0,
          },
      paging: {
        limit,
        offset,
      },
    };
  }

  // S108: Delegated to PostVisitEscalationService.
  async resolveEscalation(
    tenantDb: DataSource,
    escalationId: string,
    payload: { status?: 'resolved' | 'dismissed'; resolutionNote?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
    if (this.escalationService) return this.escalationService.resolveEscalation(tenantDb, escalationId, payload, options);
    await this.ensurePostVisitSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated user is required to resolve escalation');
    }

    const existingRows = await tenantDb.query(
      `SELECT * FROM post_visit_escalation_events WHERE id = $1 LIMIT 1`,
      [escalationId],
    );
    if (!existingRows?.length) {
      throw new NotFoundException('Post-visit escalation not found');
    }
    const existing = existingRows[0];
    const targetStatus = payload.status || 'resolved';

    const updatedRows = await tenantDb.query(
      `
        UPDATE post_visit_escalation_events
        SET status = $2,
            resolved_at = NOW(),
            resolved_by = $3,
            resolution_note = COALESCE($4, resolution_note),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [escalationId, targetStatus, options.actorUserId, payload.resolutionNote || null],
    );
    const updated = updatedRows[0];

    if (existing.workflow_key) {
      try {
        await tenantDb.query(
          `
            UPDATE nurse_cross_module_workflow_state
            SET status = 'completed',
                completed_by = $2,
                completed_at = NOW(),
                note = COALESCE($3, note),
                updated_at = NOW()
            WHERE workflow_key = $1
          `,
          [existing.workflow_key, options.actorUserId, payload.resolutionNote || null],
        );
      } catch (error: any) {
        const message = String(error?.message || '');
        if (!message.includes('nurse_cross_module_workflow_state')) {
          throw error;
        }
      }
    }

    await this.syncResolvedPostVisitEscalationIntoPatientAi(tenantDb, existing, {
      status: targetStatus,
      resolutionNote: payload.resolutionNote || null,
      actorUserId: options.actorUserId,
    });

    return this.mapEscalationEvent(updated);
  }

  async executeRecommendationAction(
    tenantDb: DataSource,
    sessionId: string,
    actionId: string,
    payload: ExecutePostVisitRecommendationDto = {},
    options: ExecuteRecommendationOptions = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated doctor user is required for recommendation execution');
    }

    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const recommendationArtifact = await this.getArtifactRow(tenantDb, sessionId, 'recommendation_bundle');
    if (!recommendationArtifact) {
      throw new NotFoundException('Recommendation bundle not found for this post-visit session');
    }

    const recommendationItems = Array.isArray(recommendationArtifact.content?.items)
      ? recommendationArtifact.content.items
      : [];
    const recommendation = recommendationItems.find(
      (item: any) =>
        String(item?.id) === String(actionId) ||
        String(item?.action_id) === String(actionId) ||
        String(item?.recommendation_id) === String(actionId),
    );
    if (!recommendation) {
      throw new NotFoundException(`Recommendation action "${actionId}" not found in bundle`);
    }

    const recommendationId = String(recommendation.id || actionId);
    const actionType = String(recommendation.action_type || '').toLowerCase() || 'follow_up';
    const actionKey = `${actionType}:${recommendationId}`;

    const existingRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_action_executions
        WHERE session_id = $1
          AND recommendation_id = $2
          AND action_key = $3
        LIMIT 1
      `,
      [sessionId, recommendationId, actionKey],
    );
    if (existingRows?.length) {
      const existing = existingRows[0];
      return {
        reused: true,
        execution: {
          id: existing.id,
          recommendationId: existing.recommendation_id,
          actionKey: existing.action_key,
          actionType: existing.action_type,
          status: existing.status,
          resultResourceType: existing.result_resource_type,
          resultResourceId: existing.result_resource_id,
          resultPayload: existing.result_payload || {},
          errorMessage: existing.error_message || null,
          executedAt: existing.executed_at,
        },
      };
    }

    const executableRecommendation = {
      ...recommendation,
      actionPayload:
        payload.actionPayload && typeof payload.actionPayload === 'object'
          ? payload.actionPayload
          : recommendation.actionPayload || {},
    };

    let executionStatus: 'executed' | 'failed' = 'executed';
    let executionError: string | null = null;
    let executionResult: { resourceType: string; resourceId: string; payload: Record<string, any> } | null = null;

    try {
      if (actionType === 'lab_order') {
        executionResult = await this.createLabOrderFromRecommendation(tenantDb, {
          sessionRow,
          recommendation: executableRecommendation,
          actorUserId: options.actorUserId,
          note: payload.note,
        });
      } else {
        executionResult = await this.createGeneralOrderFromRecommendation(tenantDb, {
          sessionRow,
          recommendation: executableRecommendation,
          actorUserId: options.actorUserId,
          note: payload.note,
        });
      }
    } catch (error: any) {
      executionStatus = 'failed';
      executionError = String(error?.message || error || 'Execution failed');
    }

    const executionRows = await tenantDb.query(
      `
        INSERT INTO post_visit_action_executions (
          session_id,
          recommendation_id,
          action_key,
          action_type,
          status,
          execution_note,
          result_resource_type,
          result_resource_id,
          result_payload,
          error_message,
          executed_by,
          executed_at,
          source,
          metadata
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,NOW(),$12,$13::jsonb
        )
        RETURNING *
      `,
      [
        sessionId,
        recommendationId,
        actionKey,
        actionType,
        executionStatus,
        payload.note || null,
        executionResult?.resourceType || null,
        executionResult?.resourceId || null,
        JSON.stringify(executionResult?.payload || {}),
        executionError,
        options.actorUserId,
        options.source || 'post_visit_execute',
        JSON.stringify({
          tenantId: options.tenantId || null,
          recommendation_title: recommendation.title || null,
          rule_id: recommendation.rule_id || null,
        }),
      ],
    );

    const executionRecord = executionRows[0];

    const normalizedExecution = {
      status: executionRecord.status,
      action_key: executionRecord.action_key,
      action_type: executionRecord.action_type,
      result_resource_type: executionRecord.result_resource_type,
      result_resource_id: executionRecord.result_resource_id,
      result_payload: executionRecord.result_payload || {},
      error_message: executionRecord.error_message || null,
      executed_at: executionRecord.executed_at,
    };

    await this.syncRecommendationExecutionIntoArtifact(tenantDb, {
      sessionId,
      recommendationId,
      execution: normalizedExecution,
      actorUserId: options.actorUserId,
    });

    if (executionStatus === 'executed' && executionResult) {
      await this.safeSyncCrossModuleWorkflow(tenantDb, {
        sessionRow,
        recommendation: executableRecommendation,
        actorUserId: options.actorUserId,
        result: executionResult,
      });
    }

    if (executionStatus === 'failed') {
      throw new BadRequestException(
        `Recommendation action execution failed: ${executionError || 'unknown error'}`,
      );
    }

    return {
      reused: false,
      execution: {
        id: executionRecord.id,
        recommendationId: executionRecord.recommendation_id,
        actionKey: executionRecord.action_key,
        actionType: executionRecord.action_type,
        status: executionRecord.status,
        resultResourceType: executionRecord.result_resource_type,
        resultResourceId: executionRecord.result_resource_id,
        resultPayload: executionRecord.result_payload || {},
        errorMessage: executionRecord.error_message || null,
        executedAt: executionRecord.executed_at,
      },
    };
  }

  private async extractDocumentTextWithLocalOcr(
    file: Express.Multer.File,
    options: { language?: string } = {},
  ): Promise<{ text: string; confidence: number | null; engine: string; raw: any }> {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('Document file buffer is empty');
    }

    const mime = String(file.mimetype || '').toLowerCase();
    if (
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('csv') ||
      mime.includes('html')
    ) {
      const text = file.buffer.toString('utf8');
      return {
        text,
        confidence: 1,
        engine: 'native_text_decode',
        raw: { mode: 'native_text_decode' },
      };
    }

    if (!this.isPostVisitOcrEnabled()) {
      return {
        text: '',
        confidence: null,
        engine: 'ocr_disabled',
        raw: { mode: 'ocr_disabled' },
      };
    }

    const baseUrl = this.resolveLocalOcrUrl();
    if (!baseUrl) {
      throw new BadRequestException(
        'LOCAL_OCR_URL is not configured. Set LOCAL_OCR_URL or LOCAL_AI_BASE_URL + LOCAL_OCR_PATH.',
      );
    }
    const endpoint = /\/extract$/i.test(baseUrl) ? baseUrl : `${baseUrl}/extract`;
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname || 'document.bin',
      contentType: file.mimetype || 'application/octet-stream',
    });
    if (options.language) {
      formData.append('language', String(options.language));
    }

    const response = await axios.post(endpoint, formData, {
      headers: {
        ...(formData.getHeaders() as Record<string, string>),
      },
      timeout: this.getLocalOcrTimeoutMs(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const payload = response.data;
    if (typeof payload === 'string') {
      return {
        text: payload,
        confidence: null,
        engine: 'local_ocr',
        raw: payload,
      };
    }

    const text =
      String(payload?.text || payload?.ocr?.text || payload?.result?.text || payload?.data?.text || '').trim();
    const confidence = Number(payload?.confidence ?? payload?.ocr?.confidence ?? payload?.result?.confidence);
    const engine = String(payload?.engine || payload?.ocr?.engine || 'local_ocr').trim() || 'local_ocr';

    return {
      text,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null,
      engine,
      raw: payload,
    };
  }

  private async createDocumentCriticalEscalation(
    tenantDb: DataSource,
    args: {
      sessionRow: any;
      documentId: string;
      documentName: string;
      criticalFlags: PostVisitDocumentCriticalFlag[];
      actorUserId?: string | null;
    },
  ) {
    const severity: 'high' | 'critical' = args.criticalFlags.some((flag) => flag.severity === 'critical')
      ? 'critical'
      : 'high';
    const detectedAt = new Date();
    const slaMinutes = severity === 'critical' ? 30 : 90;
    const slaDueAt = new Date(detectedAt.getTime() + slaMinutes * 60 * 1000);
    const triggerTerms = args.criticalFlags.map((flag) => flag.label).slice(0, 8);

    const rows = await tenantDb.query(
      `
        INSERT INTO post_visit_escalation_events (
          session_id,
          patient_id,
          thread_id,
          message_id,
          status,
          severity,
          route_target,
          trigger_type,
          trigger_terms,
          signal_text,
          classification_confidence,
          classification_temporality,
          classification_source,
          classification_reason,
          classification_stage,
          detected_at,
          sla_due_at,
          metadata
        ) VALUES (
          $1,$2,NULL,NULL,'open',$3,'doctor','document_critical_value',$4::jsonb,$5,0.93,'current','document_intelligence_v1',$6,'v2',$7,$8,$9::jsonb
        )
        RETURNING *
      `,
      [
        args.sessionRow.id,
        args.sessionRow.patient_id,
        severity,
        JSON.stringify(triggerTerms),
        `Critical value(s) detected in ${args.documentName}`,
        `Critical values detected in document intelligence extract (${args.documentName})`,
        detectedAt.toISOString(),
        slaDueAt.toISOString(),
        JSON.stringify({
          source: 'post_visit_document_intelligence',
          document_id: args.documentId,
          critical_flags: args.criticalFlags,
          triage_policy: 'non_emergency_clinician_queue',
        }),
      ],
    );

    const inserted = rows[0];
    const workflowKey = await this.routeEscalationToWorkflow(tenantDb, {
      sessionRow: args.sessionRow,
      escalationId: inserted.id,
      routeTarget: 'doctor',
      severity,
      triggerTerms,
    });

    if (workflowKey) {
      await tenantDb.query(
        `
          UPDATE post_visit_escalation_events
          SET workflow_key = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [inserted.id, workflowKey],
      );
      inserted.workflow_key = workflowKey;
    }

    return inserted;
  }

  async ingestDocumentIntelligence(
    tenantDb: DataSource,
    sessionId: string,
    file: Express.Multer.File,
    payload: { documentType?: string; language?: string; note?: string } = {},
    options: { actorUserId?: string | null; tenantId?: string } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

    if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('Document file is required');
    }

    const fileHash = this.hashFile(file.buffer);
    const documentType = this.normalizeDocumentType(payload.documentType);

    const existingRows = await tenantDb.query(
      `
        SELECT id, file_sha256, extracted_text, document_name
        FROM post_visit_document_intelligence
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 400
      `,
      [sessionId],
    );

    const exactDuplicate = existingRows.find((row: any) => String(row.file_sha256 || '') === fileHash);
    let duplicateOfDocumentId: string | null = exactDuplicate ? String(exactDuplicate.id) : null;
    let duplicateSimilarity = exactDuplicate ? 1 : 0;

    const ocr = await this.extractDocumentTextWithLocalOcr(file, {
      language: payload.language || sessionRow.language || 'en',
    });

    const extractedText = String(ocr.text || '').trim();
    if (!duplicateOfDocumentId && extractedText.length > 0) {
      for (const row of existingRows) {
        const score = this.computeDocumentSimilarity(extractedText, String(row?.extracted_text || ''));
        if (score > duplicateSimilarity) {
          duplicateSimilarity = score;
          duplicateOfDocumentId = score >= 0.9 ? String(row.id) : duplicateOfDocumentId;
        }
      }
    }

    const structured = this.parseDocumentIntelligenceFromText(extractedText, documentType);
    const fhirResources = this.mapDocumentIntelligenceToFhir(sessionRow, `${sessionId}-${Date.now()}`, structured);
    const criticalFlags = this.detectCriticalDocumentFlags(structured);
    const criticalDetected = criticalFlags.length > 0;
    const extractionStatus = duplicateOfDocumentId
      ? 'duplicate'
      : extractedText.length > 0
        ? 'processed'
        : 'failed';

    const insertRows = await tenantDb.query(
      `
        INSERT INTO post_visit_document_intelligence (
          session_id,
          patient_id,
          document_type,
          document_name,
          mime_type,
          file_size,
          file_sha256,
          duplicate_of_document_id,
          duplicate_similarity,
          extraction_status,
          ocr_engine,
          ocr_confidence,
          extracted_text,
          structured_payload,
          fhir_resources,
          critical_flags,
          critical_detected,
          critical_routed,
          metadata,
          created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19::jsonb,$20
        )
        RETURNING *
      `,
      [
        sessionId,
        sessionRow.patient_id,
        documentType,
        file.originalname || `post-visit-document-${Date.now()}`,
        file.mimetype || null,
        Number(file.size || file.buffer.length || 0),
        fileHash,
        duplicateOfDocumentId,
        duplicateSimilarity > 0 ? duplicateSimilarity : null,
        extractionStatus,
        ocr.engine,
        ocr.confidence,
        extractedText || null,
        JSON.stringify(structured),
        JSON.stringify(fhirResources),
        JSON.stringify(criticalFlags),
        criticalDetected,
        false,
        JSON.stringify({
          source: 'post_visit_document_intelligence',
          note: payload.note || null,
          ocr_raw: ocr.raw || {},
          duplicate_similarity: duplicateSimilarity,
        }),
        options.actorUserId || null,
      ],
    );

    const inserted = insertRows[0];

    let escalationEvent: any = null;
    if (criticalDetected && !duplicateOfDocumentId) {
      escalationEvent = await this.createDocumentCriticalEscalation(tenantDb, {
        sessionRow,
        documentId: inserted.id,
        documentName: inserted.document_name,
        criticalFlags,
        actorUserId: options.actorUserId || null,
      });

      await tenantDb.query(
        `
          UPDATE post_visit_document_intelligence
          SET escalation_event_id = $2,
              critical_routed = TRUE,
              updated_at = NOW()
          WHERE id = $1
        `,
        [inserted.id, escalationEvent.id],
      );
      inserted.escalation_event_id = escalationEvent.id;
      inserted.critical_routed = true;
    }

    await tenantDb.query(
      `
        UPDATE post_visit_sessions
        SET updated_at = NOW(),
            meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
        WHERE id = $1
      `,
      [
        sessionId,
        JSON.stringify({
          document_intelligence_last_ingested_at: new Date().toISOString(),
          document_intelligence_count_delta: 1,
        }),
      ],
    );

    return {
      id: inserted.id,
      sessionId,
      patientId: inserted.patient_id,
      documentType: inserted.document_type,
      documentName: inserted.document_name,
      extractionStatus: inserted.extraction_status,
      duplicate: Boolean(duplicateOfDocumentId),
      duplicateOfDocumentId: duplicateOfDocumentId || null,
      duplicateSimilarity: duplicateSimilarity > 0 ? duplicateSimilarity : null,
      ocr: {
        engine: inserted.ocr_engine,
        confidence:
          inserted.ocr_confidence === null || inserted.ocr_confidence === undefined
            ? null
            : Number(inserted.ocr_confidence),
      },
      structured,
      fhirResources,
      criticalDetected,
      criticalFlags,
      escalationEvent: escalationEvent ? this.mapEscalationEvent(escalationEvent) : null,
      createdAt: inserted.created_at,
    };
  }

  async listSessionDocumentIntelligence(
    tenantDb: DataSource,
    sessionId: string,
    options: { limit?: number } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);
    const limit = Math.min(Math.max(Number(options.limit || 80), 1), 300);

    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_document_intelligence
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [sessionId, limit],
    );

    return {
      sessionId,
      items: rows.map((row: any) => ({
        id: row.id,
        documentType: row.document_type,
        documentName: row.document_name,
        mimeType: row.mime_type || null,
        extractionStatus: row.extraction_status,
        duplicateOfDocumentId: row.duplicate_of_document_id || null,
        duplicateSimilarity:
          row.duplicate_similarity === null || row.duplicate_similarity === undefined
            ? null
            : Number(row.duplicate_similarity),
        ocrEngine: row.ocr_engine || null,
        ocrConfidence: row.ocr_confidence === null || row.ocr_confidence === undefined ? null : Number(row.ocr_confidence),
        structured: row.structured_payload || {},
        fhirResources: row.fhir_resources || [],
        criticalFlags: row.critical_flags || [],
        criticalDetected: row.critical_detected === true,
        criticalRouted: row.critical_routed === true,
        escalationEventId: row.escalation_event_id || null,
        createdAt: row.created_at,
      })),
    };
  }

  async getSessionLabTrends(tenantDb: DataSource, sessionId: string) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);
    const rows = await tenantDb.query(
      `
        SELECT document_type, structured_payload, created_at
        FROM post_visit_document_intelligence
        WHERE session_id = $1 AND document_type = 'lab_report' AND extraction_status = 'processed'
        ORDER BY created_at ASC
        LIMIT 100
      `,
      [sessionId],
    );
    const trendMap = new Map<string, Array<{ value: number; unit: string; createdAt: string }>>();
    for (const row of rows as any[]) {
      const createdAt = row.created_at ? new Date(row.created_at).toISOString() : new Date(0).toISOString();
      const structured = row.structured_payload || {};
      const observations = Array.isArray(structured.observations) ? structured.observations : [];
      for (const obs of observations) {
        const numericValue = Number(obs?.value);
        if (!Number.isFinite(numericValue)) continue;
        const name = String(obs?.name || '').trim();
        if (!name) continue;
        const unit = String(obs?.unit || '').trim();
        const key = `${name}__${unit}`;
        if (!trendMap.has(key)) trendMap.set(key, []);
        trendMap.get(key)!.push({ value: numericValue, unit, createdAt });
      }
    }
    const trends = Array.from(trendMap.entries())
      .map(([key, points]) => {
        const [name, unit] = key.split('__');
        const sortedPoints = [...points]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(-8);
        const values = sortedPoints.map((p) => p.value);
        const max = Math.max(...values);
        const min = Math.min(...values);
        return {
          key,
          name,
          unit,
          points: sortedPoints,
          latest: sortedPoints[sortedPoints.length - 1]?.value ?? null,
          previous: sortedPoints.length > 1 ? sortedPoints[sortedPoints.length - 2]?.value ?? null : null,
          min,
          max,
        };
      })
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, 6);
    return { sessionId, trends };
  }

  async ingestTranscriptionResult(
    tenantDb: DataSource,
    sessionId: string,
    result: TranscriptionResult,
    options: IngestTranscriptionOptions = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    await tenantDb.query(
      `
        UPDATE post_visit_sessions
        SET status = 'processing',
            updated_at = NOW()
        WHERE id = $1
      `,
      [sessionId],
    );

    const normalizedLanguage = this.normalizeLanguage(result.language);
    const segments = Array.isArray(result.segments) ? result.segments : [];
    const extractedEntities = this.extractEntitiesFromTranscription(result);

    await tenantDb.query(`DELETE FROM post_visit_transcript_segments WHERE session_id = $1`, [sessionId]);
    const diarizationEnabled = this.isDiarizationReviewEnabled();
    const diarizationThreshold = this.getDiarizationConfidenceThreshold();
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i] as any;
      if (!segment || typeof segment.text !== 'string') continue;
      const start = Number(segment.start);
      const end = Number(segment.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const speakerRole = this.normalizeSegmentSpeakerRole(segment.speakerRole ?? segment.speaker);
      const diarizationConfidence = this.normalizeDiarizationConfidence(segment.diarizationConfidence ?? segment.confidence ?? result.confidence);
      const needsReview =
        diarizationEnabled &&
        (speakerRole === 'unknown' || diarizationConfidence === null || diarizationConfidence < diarizationThreshold);
      const assignmentStatus = needsReview ? 'unresolved' : 'auto';
      await tenantDb.query(
        `
          INSERT INTO post_visit_transcript_segments (
            session_id,
            segment_order,
            start_second,
            end_second,
            text,
            confidence,
            language,
            speaker_label,
            speaker_role,
            diarization_confidence,
            speaker_assignment_status,
            needs_review,
            metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
        `,
        [
          sessionId,
          i,
          start,
          end,
          segment.text.trim(),
          typeof result.confidence === 'number' ? result.confidence : null,
          normalizedLanguage,
          typeof segment.speakerLabel === 'string' ? segment.speakerLabel.slice(0, 60) : null,
          speakerRole,
          diarizationConfidence,
          assignmentStatus,
          needsReview,
          JSON.stringify({
            source: options.source || 'transcription_pipeline',
            diarization_enabled: diarizationEnabled,
            diarization_threshold: diarizationThreshold,
          }),
        ],
      );
    }

    await tenantDb.query(`DELETE FROM post_visit_extracted_entities WHERE session_id = $1`, [sessionId]);
    for (const entity of extractedEntities) {
      await tenantDb.query(
        `
          INSERT INTO post_visit_extracted_entities (
            session_id,
            entity_type,
            entity_value,
            normalized_value,
            confidence,
            source_start_second,
            source_end_second,
            source_origin,
            metadata
          ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb)
        `,
        [
          sessionId,
          entity.entityType,
          entity.entityValue,
          JSON.stringify(entity.normalizedValue || {}),
          typeof entity.confidence === 'number' ? entity.confidence : null,
          entity.sourceStartSecond ?? null,
          entity.sourceEndSecond ?? null,
          entity.sourceOrigin || 'transcript',
          JSON.stringify(entity.metadata || {}),
        ],
      );
    }

    await this.upsertDraftArtifact(tenantDb, {
      sessionId,
      artifactType: 'soap_note',
      artifactStatus: 'draft',
      content: {
        soap_note: result.soap_note || null,
        transcription_text: result.text || '',
        language: normalizedLanguage,
        audio_url: result.audio_url || null,
      },
      citations: [],
      confidence: typeof result.confidence === 'number' ? result.confidence : null,
      generatedBy: options.source || 'transcription_pipeline',
      actorUserId: options.actorUserId || null,
    });

    const updatedRows = await tenantDb.query(
      `
        UPDATE post_visit_sessions
        SET status = 'draft_ready',
            language = $2,
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW(),
            meta = COALESCE(meta, '{}'::jsonb) || $3::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        sessionId,
        normalizedLanguage,
        JSON.stringify({
          last_ingested_at: new Date().toISOString(),
          transcript_segment_count: segments.length,
          extracted_entity_count: extractedEntities.length,
          diarization_review_enabled: diarizationEnabled,
        }),
      ],
    );

    const generatedDraft = await this.generateDraftArtifacts(tenantDb, sessionId, {
      tenantId: options.tenantId,
      actorUserId: options.actorUserId || null,
      source: options.source || 'transcription_pipeline',
      reason: 'auto_generate_after_transcription',
    });

    return {
      session: this.mapSession(updatedRows[0]),
      transcript: {
        text: result.text,
        language: normalizedLanguage,
        confidence: typeof result.confidence === 'number' ? result.confidence : null,
        segmentCount: segments.length,
      },
      draft: {
        artifactType: 'soap_note',
        hasSoapNote: Boolean(result.soap_note),
        extractedEntityCount: extractedEntities.length,
      },
      generatedDraft,
    };
  }

  async transcribeSessionAudio(
    tenantDb: DataSource,
    sessionId: string,
    audioFile: Express.Multer.File,
    options: TranscriptionOptions = {},
    requestContext: TranscriptionRequestContext & { actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    const result = await this.transcriptionService.transcribe(audioFile, options, requestContext);
    const persisted = await this.ingestTranscriptionResult(tenantDb, sessionId, result, {
      tenantId: requestContext.tenantId,
      actorUserId: requestContext.actorUserId || null,
      source: 'post_visit_session_transcribe',
    });

    const tenantId = requestContext.tenantId || '';
    if (this.fileStorageService && audioFile?.buffer && Buffer.isBuffer(audioFile.buffer)) {
      try {
        const storageKey = `tenant/${tenantId}/post-visit/${sessionId}/recording${this.getExtension(audioFile.mimetype)}`;
        const bucket = 'post-visit-recordings';
        const uploadResult = await this.fileStorageService.uploadBuffer(
          bucket,
          storageKey,
          audioFile.buffer,
          audioFile.mimetype || 'audio/webm',
        );
        let durationMs: number | null = null;
        if (result.segments && Array.isArray(result.segments) && result.segments.length > 0) {
          const last = result.segments[result.segments.length - 1] as { end?: number; duration?: number };
          const endSec = typeof last?.end === 'number' ? last.end : last?.duration;
          if (typeof endSec === 'number') durationMs = Math.round(endSec * 1000);
        }
        const sessionRepo = tenantDb.getRepository(PostVisitSession);
        await sessionRepo.update(sessionId, {
          recordingStorageKey: uploadResult.key,
          recordingBucket: uploadResult.bucket,
          recordingMimeType: audioFile.mimetype || 'audio/webm',
          recordingSizeBytes: uploadResult.size,
          recordingSha256: uploadResult.sha256,
          recordingDurationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
          recordingUploadedAt: new Date(),
        });
      } catch {
        // non-fatal: transcription already persisted
      }
    }

    return {
      ...persisted,
      soapNote: result.soap_note || null,
      audioUrl: result.audio_url || null,
    };
  }

  private getExtension(mime: string): string {
    const map: Record<string, string> = {
      'audio/webm': '.webm',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/mp3': '.mp3',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/x-m4a': '.m4a',
    };
    return map[mime] || '.audio';
  }

  // S108: Delegated to PostVisitSessionService.
  async getSessionRecordingUrl(
    sessionId: string,
    tenantDb: DataSource,
  ): Promise<{ url: string; mimeType: string; durationMs: number | null } | { url: null }> {
    if (this.sessionService) return this.sessionService.getSessionRecordingUrl(sessionId, tenantDb);
    const repo = tenantDb.getRepository(PostVisitSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session?.recordingStorageKey || !this.fileStorageService) {
      return { url: null };
    }
    const url = await this.fileStorageService.getSignedDownloadUrl(
      session.recordingBucket || 'post-visit-recordings',
      session.recordingStorageKey,
      900,
    );
    return {
      url,
      mimeType: session.recordingMimeType || 'audio/webm',
      durationMs: session.recordingDurationMs ?? null,
    };
  }

  // S108: Delegated to PostVisitSessionService.
  async getSessionForPatient(
    sessionId: string,
    patientId: string,
    tenantDb: DataSource,
  ): Promise<PostVisitSession | null> {
    if (this.sessionService) return this.sessionService.getSessionForPatient(sessionId, patientId, tenantDb);
    const repo = tenantDb.getRepository(PostVisitSession);
    return repo.findOne({ where: { id: sessionId, patientId } });
  }
}

// S111/MOAS-09: restore the missing post-extraction helper surface as a
// compatibility layer so the remaining public service methods compile and run
// against the extracted services.
export interface PostVisitService {
  [key: string]: any;
}

Object.assign(PostVisitService.prototype as any, {
  normalizeLanguage(this: any, language?: string | null) {
    const raw = String(language || '').trim().toLowerCase();
    if (!raw) return 'en';
    if (raw === 'english' || raw === 'eng') return 'en';
    if (raw === 'shona') return 'sn';
    if (raw === 'ndebele') return 'nd';
    return raw;
  },

  async getSessionRow(this: any, tenantDb: DataSource, sessionId: string) {
    if (this.sessionService?.getSessionRow) {
      return this.sessionService.getSessionRow(tenantDb, sessionId);
    }
    const rows = await tenantDb.query(`SELECT * FROM post_visit_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
    if (!rows?.length) {
      throw new NotFoundException('Post-visit session not found');
    }
    return rows[0];
  },

  mapSession(this: any, row: any) {
    if (this.sessionService?.mapSession) {
      return this.sessionService.mapSession(row);
    }
    return {
      id: row.id,
      tenantId: row.tenant_id ?? null,
      patientId: row.patient_id,
      doctorId: row.doctor_id ?? null,
      appointmentId: row.appointment_id ?? null,
      consultationId: row.consultation_id ?? null,
      status: row.status as PostVisitSessionStatus,
      sourceType: row.source_type,
      language: row.language || 'en',
      startedAt: row.started_at,
      completedAt: row.completed_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by ?? null,
      publishedAt: row.published_at,
      safetyLevel: row.safety_level ?? null,
      riskFlags: row.risk_flags || {},
      meta: row.meta || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async getArtifactRow(this: any, tenantDb: DataSource, sessionId: string, artifactType: string) {
    if (this.draftService?.getArtifactRow) {
      return this.draftService.getArtifactRow(tenantDb, sessionId, artifactType);
    }
    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_draft_artifacts
        WHERE session_id = $1
          AND artifact_type = $2
        LIMIT 1
      `,
      [sessionId, artifactType],
    );
    return rows?.length ? rows[0] : null;
  },

  mapEscalationEvent(this: any, row: any) {
    const metadata = this.normalizeEscalationMetadata(row.metadata);
    return {
      id: row.id,
      sessionId: row.session_id ?? row.sessionId ?? null,
      patientId: row.patient_id ?? row.patientId ?? null,
      threadId: row.thread_id ?? row.threadId ?? null,
      messageId: row.message_id ?? row.messageId ?? null,
      status: row.status,
      severity: row.severity,
      routeTarget: row.route_target ?? row.routeTarget ?? null,
      triggerType: row.trigger_type ?? row.triggerType ?? null,
      triggerTerms: row.trigger_terms ?? row.triggerTerms ?? [],
      signalText: row.signal_text ?? row.signalText ?? null,
      classificationConfidence:
        row.classification_confidence == null && row.classificationConfidence == null
          ? null
          : Number(row.classification_confidence ?? row.classificationConfidence),
      classificationTemporality: row.classification_temporality ?? row.classificationTemporality ?? null,
      classificationSource: row.classification_source ?? row.classificationSource ?? null,
      classificationReason: row.classification_reason ?? row.classificationReason ?? null,
      classificationStage: row.classification_stage ?? row.classificationStage ?? 'v1',
      detectedAt: row.detected_at ?? row.detectedAt ?? null,
      slaDueAt: row.sla_due_at ?? row.slaDueAt ?? null,
      acknowledgedAt: row.acknowledged_at ?? row.acknowledgedAt ?? null,
      acknowledgedBy: row.acknowledged_by ?? row.acknowledgedBy ?? null,
      resolvedAt: row.resolved_at ?? row.resolvedAt ?? null,
      resolvedBy: row.resolved_by ?? row.resolvedBy ?? null,
      resolutionNote: row.resolution_note ?? row.resolutionNote ?? null,
      workflowKey: row.workflow_key ?? row.workflowKey ?? null,
      metadata,
      trustSummary: this.buildEscalationTrustSummary(row, metadata),
      createdAt: row.created_at ?? row.createdAt ?? null,
      updatedAt: row.updated_at ?? row.updatedAt ?? null,
    };
  },

  mapIntraVisitAlertEvent(this: any, row: any) {
    const acknowledgedAt = row.acknowledged_at || null;
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      status: row.status,
      alertType: row.alert_type,
      severity: row.severity,
      routeTarget: (row.route_target || 'doctor') as IntraVisitAlertRouteTarget,
      assignedRole: (row.assigned_role || 'doctor') as IntraVisitAlertAssignedRole,
      assignedUserId: row.assigned_user_id || null,
      assignedTeam: row.assigned_team || null,
      policyVersion: row.policy_version || 'c3.v1',
      routingRationale: row.routing_rationale || null,
      source: row.source || 'streamed_transcript',
      transcriptOffsetSeconds:
        row.transcript_offset_seconds == null ? null : Number(row.transcript_offset_seconds),
      signalText: row.signal_text || null,
      alertMessage: row.alert_message,
      suggestedAction: row.suggested_action || null,
      confidence: row.confidence == null ? null : Number(row.confidence),
      triggerTerms: Array.isArray(row.trigger_terms) ? row.trigger_terms : [],
      metadata: row.metadata || {},
      detectedAt: row.detected_at,
      slaDueAt: row.sla_due_at || null,
      isAcknowledged: acknowledgedAt !== null,
      acknowledgedAt,
      acknowledgedBy: row.acknowledged_by || null,
      acknowledgmentNote: row.acknowledgment_note || null,
      resolvedAt: row.resolved_at || null,
      resolvedBy: row.resolved_by || null,
      resolutionNote: row.resolution_note || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  mapBillingSuggestion(this: any, row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      suggestionKey: row.suggestion_key,
      codeType: row.code_type,
      code: row.code,
      description: row.description,
      confidence: row.confidence == null ? null : Number(row.confidence),
      justification: row.justification || null,
      documentationChecks: Array.isArray(row.documentation_checks) ? row.documentation_checks : [],
      documentationScore: Number(row.documentation_score || 0),
      documentationStatus: row.documentation_status || 'insufficient',
      status: row.status || 'proposed',
      approvedBy: row.approved_by || null,
      approvedAt: row.approved_at || null,
      approvalNote: row.approval_note || null,
      source: row.source || 'post_visit_billing_intelligence_v1',
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  buildBillingDocumentationSummaryFromSuggestionRows(this: any, rows: any[]) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    const primary = rows[0];
    const checks = Array.isArray(primary?.documentation_checks)
      ? primary.documentation_checks.map((row: any, index: number) => ({
          id: String(row?.id || `check_${index + 1}`),
          label: String(row?.label || row?.id || `Check ${index + 1}`),
          passed: row?.passed === true,
          guidance: String(row?.guidance || row?.label || 'Documentation requirement not met.'),
        }))
      : [];
    const score = Math.max(0, Math.min(100, Number(primary?.documentation_score || 0)));
    const statusRaw = String(primary?.documentation_status || 'insufficient').toLowerCase();
    const status =
      statusRaw === 'sufficient' || statusRaw === 'partial' || statusRaw === 'insufficient'
        ? statusRaw
        : score >= 80
          ? 'sufficient'
          : score >= 50
            ? 'partial'
            : 'insufficient';
    const gaps = checks.filter((check: any) => !check.passed).map((check: any) => check.label);
    return { score, status, checks, gaps };
  },

  isBillingIntelligenceEnabled(this: any): boolean {
    const configured = (config as any)?.features?.postVisitBillingIntelligence;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE || 'false').toLowerCase() === 'true';
  },

  async routeBillingSuggestionToWorkflow(this: any, tenantDb: DataSource, args: any) {
    const workflowKey = `post_visit_billing:${String(args?.suggestionId || '').trim()}`;
    await tenantDb.query(
      `
        INSERT INTO nurse_cross_module_workflow_state (
          workflow_key,
          workflow_type,
          patient_id,
          appointment_id,
          consultation_id,
          assigned_role,
          assigned_user_id,
          status,
          priority,
          note,
          metadata
        ) VALUES ($1,$2,$3,$4,$5,'doctor',NULL,'open','normal',$6,$7::jsonb)
      `,
      [
        workflowKey,
        'post_visit_billing_review',
        args.patientId || null,
        null,
        null,
        args.note || null,
        JSON.stringify({
          suggestionId: args.suggestionId || null,
          sessionId: args.sessionId || null,
          code: args.code || null,
          codeType: args.codeType || null,
        }),
      ],
    ).catch(() => {});
    return workflowKey;
  },

  isPreVisitBriefEnabled(this: any): boolean {
    const configured = (config as any)?.features?.postVisitPreVisitBrief;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_PREVISIT_BRIEF || 'false').toLowerCase() === 'true';
  },

  mapPreVisitBrief(this: any, row: any) {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      patientId: row.patient_id,
      doctorId: row.doctor_id || null,
      scheduledAt: row.scheduled_at || null,
      status: row.status || 'active',
      brief: row.brief_content || {},
      followUpRisk: {
        score: Number(row.follow_up_risk_score || 0),
        tier: row.follow_up_risk_tier || 'low',
        reasons: Array.isArray(row.follow_up_risk_reasons) ? row.follow_up_risk_reasons : [],
        nudgePolicy: row.nudge_policy || null,
      },
      source: row.source || 'post_visit_previsit_brief_v1',
      generatedBy: row.generated_by || null,
      generatedAt: row.generated_at,
      deliveredAt: row.delivered_at || null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  isAdminDocumentsEnabled(this: any): boolean {
    const configured = (config as any)?.features?.postVisitAdminDocuments;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_ADMIN_DOCS || 'false').toLowerCase() === 'true';
  },

  mapAdminDocument(this: any, row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      doctorId: row.doctor_id || null,
      documentType: row.document_type,
      version: Number(row.version_no || 1),
      status: row.status || 'signed',
      title: row.title || null,
      body: row.body_json || {},
      immutableHash: row.immutable_hash || null,
      signedBy: row.signed_by || null,
      signedAt: row.signed_at || null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  isVoiceReviewEnabled(this: any): boolean {
    const configured = (config as any)?.features?.postVisitVoiceReview;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_VOICE_REVIEW || 'false').toLowerCase() === 'true';
  },

  normalizeVoiceCommand(this: any, input?: string | null): PostVisitVoiceCommand | null {
    const normalized = String(input || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const aliases: Record<string, PostVisitVoiceCommand> = {
      APPROVE_SUMMARY: 'APPROVE_SUMMARY',
      ACCEPT_SUMMARY: 'APPROVE_SUMMARY',
      APPROVE_VISIT_SUMMARY: 'APPROVE_SUMMARY',
      APPROVE_BUNDLE: 'APPROVE_BUNDLE',
      ACCEPT_BUNDLE: 'APPROVE_BUNDLE',
      APPROVE_RECOMMENDATION_BUNDLE: 'APPROVE_BUNDLE',
      GENERATE_ADMIN_DOCS: 'GENERATE_ADMIN_DOCS',
      CREATE_ADMIN_DOCS: 'GENERATE_ADMIN_DOCS',
      REGENERATE_DRAFT: 'REGENERATE_DRAFT',
      REFRESH_DRAFT: 'REGENERATE_DRAFT',
      SIGN_AND_PUBLISH: 'SIGN_AND_PUBLISH',
      PUBLISH: 'SIGN_AND_PUBLISH',
    };
    return aliases[normalized] || null;
  },

  isCompanionMemoryEnabled(this: any): boolean {
    const configured = (config as any)?.features?.postVisitCompanionMemory;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_COMPANION_MEMORY || 'true').toLowerCase() !== 'false';
  },

  mapCompanionMemory(this: any, row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      memoryType: row.memory_type,
      memoryKey: row.memory_key,
      memoryValue: row.memory_value,
      confidence: row.confidence == null ? null : Number(row.confidence),
      sourceMessageId: row.source_message_id || null,
      createdBy: row.created_by || null,
      isActive: row.is_active !== false,
      promotedAt: row.promoted_at || null,
      promotedBy: row.promoted_by || null,
      retiredAt: row.retired_at || null,
      retiredBy: row.retired_by || null,
      curationNote: row.curation_note || null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  resolveFollowUpRiskTier(this: any, score: number): PostVisitFollowUpRiskTier {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'moderate';
    return 'low';
  },

  resolveNudgePolicyForRiskTier(this: any, tier: PostVisitFollowUpRiskTier): string {
    if (tier === 'critical') return 'immediate_clinician_outreach';
    if (tier === 'high') return 'same_day_nurse_followup';
    if (tier === 'moderate') return 'next_day_companion_nudge';
    return 'routine_weekly_checkin';
  },

  isDiarizationReviewEnabled(this: any): boolean {
    return String(process.env.FEATURE_POSTVISIT_DIARIZATION_REVIEW || 'false').toLowerCase() === 'true';
  },

  isIntraVisitAlertsEnabled(this: any): boolean {
    const configured = (config as any)?.features?.postVisitIntraVisitAlerts;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_INTRAVISIT_ALERTS || 'false').toLowerCase() === 'true';
  },

  getDiarizationConfidenceThreshold(this: any): number {
    const raw = Number(process.env.POSTVISIT_DIARIZATION_MIN_CONFIDENCE || 0.65);
    if (!Number.isFinite(raw)) return 0.65;
    return Math.min(0.95, Math.max(0.2, raw));
  },

  normalizeDiarizationConfidence(this: any, value: any): number | null {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.min(1, Math.max(0, num));
  },

  normalizeSegmentSpeakerRole(this: any, value: any): 'doctor' | 'patient' | 'unknown' {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'unknown';
    if (['doctor', 'dr', 'clinician', 'provider'].includes(normalized)) return 'doctor';
    if (['patient', 'pt', 'client'].includes(normalized)) return 'patient';
    return 'unknown';
  },

  isPostVisitOcrEnabled(this: any): boolean {
    return String(process.env.FEATURE_POSTVISIT_OCR_INTELLIGENCE || 'false').toLowerCase() === 'true';
  },

  resolveLocalOcrUrl(this: any): string {
    const direct = String(process.env.LOCAL_OCR_URL || config.ai?.ocr?.localUrl || '').trim();
    return direct ? direct.replace(/\/+$/, '') : '';
  },

  getLocalOcrTimeoutMs(this: any): number {
    const raw = Number(process.env.POSTVISIT_OCR_TIMEOUT_MS || 120000);
    if (!Number.isFinite(raw)) return 120000;
    return Math.min(300000, Math.max(5000, raw));
  },

  hashFile(this: any, buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  },

  normalizeDocumentText(this: any, text: string): string {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\\s./%-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  computeDocumentSimilarity(this: any, leftRaw: string, rightRaw: string): number {
    const left = this.normalizeDocumentText(leftRaw);
    const right = this.normalizeDocumentText(rightRaw);
    if (!left || !right) return 0;
    if (left === right) return 1;
    const leftTokens = new Set(left.split(/\s+/).filter((token: string) => token.length > 1));
    const rightTokens = new Set(right.split(/\s+/).filter((token: string) => token.length > 1));
    if (!leftTokens.size || !rightTokens.size) return 0;
    let overlap = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) overlap += 1;
    }
    const union = leftTokens.size + rightTokens.size - overlap;
    return union <= 0 ? 0 : overlap / union;
  },

  normalizeDocumentType(this: any, type?: string): PostVisitDocumentType {
    const normalized = String(type || '').trim().toLowerCase();
    if (['lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'other'].includes(normalized)) {
      return normalized as PostVisitDocumentType;
    }
    return 'other';
  },

  parseDocumentIntelligenceFromText(this: any, text: string, documentType: PostVisitDocumentType): PostVisitDocumentIntelligenceModel {
    const normalizedText = String(text || '').trim();
    const lines = normalizedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const observations: PostVisitDocumentObservation[] = [];
    const medications: PostVisitMedicationMention[] = [];
    const findings: string[] = [];
    const observationPattern =
      /^([A-Za-z][A-Za-z0-9()[\] %/._-]{1,80}?)\s*[:=-]\s*(-?\d+(?:\.\d+)?)\s*([A-Za-z%/^\d.-]+)?(?:\s*\(([^)]+)\))?$/i;
    const medicationPattern =
      /^([A-Z][A-Za-z0-9-]+(?:\s+[A-Za-z0-9-]+){0,2})\s+(\d+(?:\.\d+)?)\s?(mg|mcg|g|ml|iu|units?)\b(?:\s*(.*))?$/i;
    for (const line of lines) {
      const observationMatch = line.match(observationPattern);
      if (observationMatch) {
        observations.push({
          name: observationMatch[1].trim(),
          value: Number(observationMatch[2]),
          unit: observationMatch[3] ? observationMatch[3].trim() : null,
          referenceRange: observationMatch[4] ? observationMatch[4].trim() : null,
          interpretation: null,
        });
        continue;
      }
      const medicationMatch = line.match(medicationPattern);
      if (medicationMatch) {
        medications.push({
          medicationName: medicationMatch[1].trim(),
          dose: `${medicationMatch[2]} ${medicationMatch[3]}`,
          frequency: medicationMatch[4] ? medicationMatch[4].trim() : null,
          route: null,
        });
        continue;
      }
      if (/impression|conclusion|assessment|finding|diagnosis|recommendation/i.test(line)) {
        findings.push(line);
      }
    }
    return {
      documentType,
      summary: normalizedText.slice(0, 1200),
      observations: observations.slice(0, 120),
      medications: medications.slice(0, 80),
      findings: findings.slice(0, 80),
    };
  },

  mapDocumentIntelligenceToFhir(this: any, sessionRow: any, documentId: string, model: PostVisitDocumentIntelligenceModel): any[] {
    const encounterRef = `Encounter/post-visit-${sessionRow.id}`;
    const patientRef = `Patient/${sessionRow.patient_id}`;
    const effectiveDate = this.toIsoDate(new Date());
    const observationResources = model.observations.map((observation: any, index: number) => ({
      resourceType: 'Observation',
      id: `post-visit-docobs-${this.safeToken(documentId)}-${index + 1}`,
      status: 'final',
      category: [{ text: 'laboratory' }],
      code: { text: observation.name },
      subject: { reference: patientRef },
      encounter: { reference: encounterRef },
      effectiveDateTime: effectiveDate,
      valueQuantity: {
        value: observation.value,
        unit: observation.unit || undefined,
      },
      referenceRange: observation.referenceRange ? [{ text: observation.referenceRange }] : undefined,
    }));
    const medicationResources = model.medications.map((medication: any, index: number) => ({
      resourceType: 'MedicationRequest',
      id: `post-visit-docmed-${this.safeToken(documentId)}-${index + 1}`,
      status: 'active',
      intent: 'order',
      subject: { reference: patientRef },
      encounter: { reference: encounterRef },
      authoredOn: effectiveDate,
      medicationCodeableConcept: { text: medication.medicationName },
      dosageInstruction: [{ text: [medication.dose, medication.frequency].filter(Boolean).join(' ').trim() }],
    }));
    const diagnosticReportResource = {
      resourceType: 'DiagnosticReport',
      id: `post-visit-docreport-${this.safeToken(documentId)}`,
      status: 'final',
      code: { text: `${model.documentType.replace(/_/g, ' ')} intelligence extract` },
      subject: { reference: patientRef },
      encounter: { reference: encounterRef },
      effectiveDateTime: effectiveDate,
      issued: effectiveDate,
      conclusion: model.findings.join('; ') || model.summary.slice(0, 500),
      result: observationResources.map((observation: any) => ({ reference: `Observation/${observation.id}` })),
    };
    return [...observationResources, ...medicationResources, diagnosticReportResource];
  },

  detectCriticalDocumentFlags(this: any, model: PostVisitDocumentIntelligenceModel): PostVisitDocumentCriticalFlag[] {
    const flags: PostVisitDocumentCriticalFlag[] = [];
    const thresholds = [
      { code: 'potassium', label: 'Potassium critical', matcher: /potassium|k\+/i, criticalHigh: 6.0, highHigh: 5.5, unit: 'mmol/L' },
      { code: 'glucose', label: 'Glucose critical', matcher: /glucose|blood sugar/i, criticalHigh: 22.0, criticalLow: 2.5, highHigh: 16.0, highLow: 3.0, unit: 'mmol/L' },
      { code: 'hemoglobin', label: 'Hemoglobin critical', matcher: /hemoglobin|haemoglobin|hb/i, criticalLow: 6.5, highLow: 7.5, unit: 'g/dL' },
    ];
    for (const observation of model.observations) {
      const value = Number(observation.value);
      if (!Number.isFinite(value)) continue;
      for (const threshold of thresholds) {
        if (!threshold.matcher.test(String(observation.name || ''))) continue;
        if (threshold.criticalHigh != null && value >= threshold.criticalHigh) {
          flags.push({ code: threshold.code, label: threshold.label, severity: 'critical', value, unit: observation.unit || threshold.unit || null, threshold: `>= ${threshold.criticalHigh}` });
        } else if (threshold.criticalLow != null && value <= threshold.criticalLow) {
          flags.push({ code: threshold.code, label: threshold.label, severity: 'critical', value, unit: observation.unit || threshold.unit || null, threshold: `<= ${threshold.criticalLow}` });
        } else if (threshold.highHigh != null && value >= threshold.highHigh) {
          flags.push({ code: threshold.code, label: threshold.label, severity: 'high', value, unit: observation.unit || threshold.unit || null, threshold: `>= ${threshold.highHigh}` });
        } else if (threshold.highLow != null && value <= threshold.highLow) {
          flags.push({ code: threshold.code, label: threshold.label, severity: 'high', value, unit: observation.unit || threshold.unit || null, threshold: `<= ${threshold.highLow}` });
        }
      }
    }
    return flags;
  },

  splitIntoPhrases(this: any, value?: string) {
    const text = String(value || '').trim();
    if (!text || text.toLowerCase() === 'not provided') return [];
    return text.split(/[\n.;]+/).map((part) => part.trim()).filter((part) => part.length > 0);
  },

  parseBloodPressure(this: any, bp?: string | null) {
    const raw = String(bp || '').trim();
    const match = raw.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!match) return null;
    return { systolic: Number(match[1]), diastolic: Number(match[2]) };
  },

  parseNumericValue(this: any, value: any): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const numeric = Number(match[0]);
    return Number.isFinite(numeric) ? numeric : null;
  },

  normalizeMedicationToken(this: any, value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\b\d+(?:\.\d+)?\s?(mg|mcg|g|ml|iu|units?)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  splitMedicationTextList(this: any, value: string): string[] {
    const raw = String(value || '').trim();
    if (!raw) return [];
    return raw.split(/[,\n;|]+/).map((item) => item.trim()).filter((item) => item.length > 0);
  },

  getMedicationSeverityRank(this: any, severity: MedicationRiskSeverity | 'major' | 'moderate' | null | undefined): number {
    if (severity === 'contraindicated') return 4;
    if (severity === 'major') return 3;
    if (severity === 'moderate') return 2;
    if (severity === 'minor') return 1;
    return 0;
  },

  inferMedicationNormalization(this: any, inputName: string): MedicationNormalizationRecord {
    const normalizedInput = this.normalizeMedicationToken(inputName);
    const dictionary: Array<{ token: string; normalizedName: string; rxCui: string }> = [
      { token: 'metformin', normalizedName: 'metformin', rxCui: '6809' },
      { token: 'gabapentin', normalizedName: 'gabapentin', rxCui: '25480' },
      { token: 'rivaroxaban', normalizedName: 'rivaroxaban', rxCui: '1114195' },
      { token: 'warfarin', normalizedName: 'warfarin', rxCui: '11289' },
      { token: 'aspirin', normalizedName: 'aspirin', rxCui: '1191' },
      { token: 'clarithromycin', normalizedName: 'clarithromycin', rxCui: '21212' },
      { token: 'simvastatin', normalizedName: 'simvastatin', rxCui: '36567' },
      { token: 'lisinopril', normalizedName: 'lisinopril', rxCui: '29046' },
      { token: 'spironolactone', normalizedName: 'spironolactone', rxCui: '9997' },
    ];
    const dictionaryHit = dictionary.find((entry) => normalizedInput.includes(entry.token));
    if (dictionaryHit) {
      return { inputName, normalizedName: dictionaryHit.normalizedName, rxCui: dictionaryHit.rxCui, source: 'rxnorm_dictionary' };
    }
    const fallbackToken = normalizedInput.split(/\s+/)[0] || normalizedInput;
    return {
      inputName,
      normalizedName: fallbackToken || normalizedInput || 'unknown_medication',
      rxCui: null,
      source: fallbackToken ? 'heuristic' : 'unknown',
    };
  },

  extractEstimatedEgfr(this: any, patientContext: any, extractedEntities: any[]): number | null {
    const entityHit = extractedEntities.find((entity: any) => {
      const type = String(entity?.entity_type || entity?.type || '').toLowerCase();
      const value = String(entity?.entity_value || entity?.value || '').toLowerCase();
      return type.includes('egfr') || /e\s*gfr|glomerular/i.test(value);
    });
    const entityEgfr = this.parseNumericValue(entityHit?.entity_value || entityHit?.value);
    if (entityEgfr !== null) return entityEgfr;
    const labAlert = patientContext?.modules?.lab?.latestCriticalAlert;
    return this.parseNumericValue(labAlert?.result_value);
  },

  buildMedicationIntelligenceAssessment(this: any, patientContext: any, extractedEntities: any[]): MedicationIntelligenceAssessment {
    if (!this.isMedicationIntelligenceV2Enabled()) {
      return {
        enabled: false,
        medications: [],
        interactions: [],
        beersAlerts: [],
        renalAlerts: [],
        highestSeverity: null,
        highRiskCount: 0,
        egfr: null,
        riskNarrative: 'Medication intelligence v2 is disabled by feature flag.',
      };
    }
    const age = Number(patientContext?.patient?.age || 0);
    const medicationCandidates: string[] = [];
    const latestPrescription = patientContext?.modules?.pharmacy?.latestPrescription;
    for (const candidate of [
      latestPrescription?.medication_name,
      latestPrescription?.generic_name,
      ...(extractedEntities || []).map((entity: any) => entity?.entity_value || entity?.value),
    ]) {
      if (String(candidate || '').trim()) {
        medicationCandidates.push(String(candidate).trim());
      }
    }
    const deduped = Array.from(
      new Map(
        medicationCandidates
          .map((candidate) => [this.normalizeMedicationToken(candidate), candidate] as const)
          .filter(([key]) => key.length > 0),
      ).entries(),
    ).map(([, original]) => original);
    const medications = deduped.map((name) => this.inferMedicationNormalization(name));
    const normalizedMedicationSet = new Set(medications.map((item) => item.normalizedName));
    const interactions: MedicationInteractionSignal[] = [];
    if (normalizedMedicationSet.has('clarithromycin') && normalizedMedicationSet.has('simvastatin')) {
      interactions.push({
        pair: ['clarithromycin', 'simvastatin'],
        severity: 'major',
        rationale: 'Clarithromycin increases simvastatin concentration and myopathy risk.',
        guidelineId: 'fda-simvastatin-drug-interaction-safety',
      });
    }
    const egfr = this.extractEstimatedEgfr(patientContext, extractedEntities);
    const renalAlerts: MedicationRenalSignal[] = [];
    if (egfr !== null && egfr < 50 && normalizedMedicationSet.has('rivaroxaban')) {
      renalAlerts.push({
        medication: 'rivaroxaban',
        severity: 'major',
        rationale: 'Rivaroxaban renal-dose review is required when eGFR < 50.',
        egfr,
      });
    }
    const beersAlerts: MedicationBeersSignal[] =
      age >= 65 && normalizedMedicationSet.has('simvastatin')
        ? [{ medication: 'simvastatin', severity: 'moderate', rationale: 'Review statin tolerance and myalgia in older adults.' }]
        : [];
    let highestSeverity: MedicationRiskSeverity | null = null;
    for (const signal of [...interactions, ...beersAlerts, ...renalAlerts]) {
      if (!highestSeverity || this.getMedicationSeverityRank(signal.severity) > this.getMedicationSeverityRank(highestSeverity)) {
        highestSeverity = signal.severity as MedicationRiskSeverity;
      }
    }
    const highRiskCount =
      interactions.filter((item) => ['contraindicated', 'major'].includes(item.severity)).length +
      renalAlerts.filter((item) => item.severity === 'major').length;
    return {
      enabled: true,
      medications,
      interactions,
      beersAlerts,
      renalAlerts,
      highestSeverity,
      highRiskCount,
      egfr,
      riskNarrative: highRiskCount > 0
        ? 'High-risk medication safety signals detected.'
        : 'No high-risk medication safety signals detected.',
    };
  },

  isMedicationIntelligenceV2Enabled(this: any): boolean {
    return String(process.env.FEATURE_POSTVISIT_MEDICATION_INTELLIGENCE_V2 || 'false').toLowerCase() === 'true';
  },

  extractEntitiesFromTranscription(this: any, result: TranscriptionResult): ExtractedEntityInput[] {
    const entities: ExtractedEntityInput[] = [];
    const language = this.normalizeLanguage(result.language);
    const confidence = typeof result.confidence === 'number' ? result.confidence : null;
    const pushSection = (section: string, value?: string) => {
      for (const phrase of this.splitIntoPhrases(value)) {
        entities.push({
          entityType: section,
          entityValue: phrase,
          normalizedValue: { language },
          confidence,
          sourceOrigin: 'soap_note',
        });
      }
    };
    pushSection('subjective', result.soap_note?.subjective);
    pushSection('objective', result.soap_note?.objective);
    pushSection('assessment', result.soap_note?.assessment);
    pushSection('plan', result.soap_note?.plan);
    const transcriptionText = String(result.text || '').trim();
    if (transcriptionText) {
      const bpMatch = transcriptionText.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
      if (bpMatch) {
        entities.push({
          entityType: 'vital_blood_pressure',
          entityValue: `${bpMatch[1]}/${bpMatch[2]}`,
          normalizedValue: { systolic: Number(bpMatch[1]), diastolic: Number(bpMatch[2]), unit: 'mmHg' },
          confidence,
          sourceOrigin: 'transcript',
        });
      }
      const heartRateMatch = transcriptionText.match(/\b(?:heart rate|hr)\s*(?:is|of)?\s*(\d{2,3})\b/i);
      if (heartRateMatch) {
        entities.push({
          entityType: 'vital_heart_rate',
          entityValue: heartRateMatch[1],
          normalizedValue: { value: Number(heartRateMatch[1]), unit: 'bpm' },
          confidence,
          sourceOrigin: 'transcript',
        });
      }
    }
    return entities;
  },

  async upsertDraftArtifact(this: any, tenantDb: DataSource, args: {
    sessionId: string;
    artifactType: string;
    content: Record<string, any>;
    citations?: Array<Record<string, any>>;
    confidence?: number | null;
    generatedBy?: string;
    actorUserId?: string | null;
    artifactStatus?: 'draft' | 'reviewed' | 'published';
  }) {
    const rows = await tenantDb.query(
      `
        INSERT INTO post_visit_draft_artifacts (
          session_id,
          artifact_type,
          artifact_status,
          content,
          citations,
          confidence,
          generated_by,
          created_by,
          updated_by
        ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$8)
        ON CONFLICT (session_id, artifact_type)
        DO UPDATE SET
          artifact_status = EXCLUDED.artifact_status,
          content = EXCLUDED.content,
          citations = EXCLUDED.citations,
          confidence = EXCLUDED.confidence,
          generated_by = EXCLUDED.generated_by,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `,
      [
        args.sessionId,
        args.artifactType,
        args.artifactStatus || 'draft',
        JSON.stringify(args.content || {}),
        JSON.stringify(args.citations || []),
        typeof args.confidence === 'number' ? args.confidence : null,
        args.generatedBy || 'post_visit_pipeline',
        args.actorUserId || null,
      ],
    );
    return rows[0];
  },

  isSpecialtySoapEnabled(this: any): boolean {
    return String(process.env.FEATURE_POSTVISIT_SPECIALTY_SOAP || 'false').toLowerCase() === 'true';
  },

  resolveSoapSpecialty(this: any, patientContext: any): PostVisitSoapSpecialty {
    const modules = patientContext?.modules || {};
    const age = Number(patientContext?.patient?.age || 0);
    if (modules?.cardiology?.latestEncounter) return 'cardiology';
    if (age > 0 && age < 15) return 'paediatrics';
    if (modules?.mentalHealth?.latestEncounter || modules?.mental_health?.latestEncounter) return 'mental_health';
    return 'general_practice';
  },

  evaluateSpecialtySoapTemplate(this: any, specialty: PostVisitSoapSpecialty, soapNote: any, patientContext: any): SpecialtySoapValidationSummary {
    const soapNoteFields = {
      subjective: String(soapNote?.subjective || '').trim(),
      objective: String(soapNote?.objective || '').trim(),
      assessment: String(soapNote?.assessment || '').trim(),
      plan: String(soapNote?.plan || '').trim(),
    };
    const context = {
      modules: patientContext?.modules || {},
      age: Number(patientContext?.patient?.age || 0),
      hasWeight:
        this.parseNumericValue(patientContext?.latestVitals?.weightKg) !== null ||
        this.parseNumericValue(patientContext?.latestVitals?.weight) !== null,
    };
    return getValidationSummary(specialty, soapNoteFields, context);
  },

  buildRecommendationRules(this: any, patientContext: any, extractedEntities: any[]): RecommendationRuleResult[] {
    const rules: RecommendationRuleResult[] = [];
    const latestVitals = patientContext?.latestVitals || {};
    const modules = patientContext?.modules || {};
    const extractedBpEntity = extractedEntities.find((entity: any) => String(entity.entity_type || entity.type) === 'vital_blood_pressure');
    const bp = this.parseBloodPressure(extractedBpEntity?.entity_value || extractedBpEntity?.value) ||
      this.parseBloodPressure(latestVitals?.blood_pressure || latestVitals?.bloodPressure);
    if (bp && (bp.systolic >= 140 || bp.diastolic >= 90)) {
      rules.push({
        ruleId: 'htn_followup_rule',
        recommendationId: 'htn_followup',
        title: 'Elevated blood pressure follow-up',
        description: 'Schedule blood pressure reassessment and hypertension workup if persistent.',
        urgency: bp.systolic >= 180 || bp.diastolic >= 120 ? 'stat' : 'urgent',
        actionType: 'follow_up',
        confidence: 0.86,
        context: { bloodPressure: `${bp.systolic}/${bp.diastolic}` },
        citations: [{
          guidelineId: 'who-pen-hypertension-2023',
          label: 'WHO PEN hypertension follow-up threshold guidance',
          source: 'WHO PEN',
          confidence: 0.88,
        }],
      });
    }
    const labCritical = modules?.lab?.latestCriticalAlert;
    if (labCritical && ['pending', 'unacknowledged'].includes(String(labCritical.alert_status || '').toLowerCase())) {
      rules.push({
        ruleId: 'critical_lab_followup_rule',
        recommendationId: 'critical_lab_followup',
        title: 'Critical lab escalation callback',
        description: 'Contact patient urgently and document immediate safety instructions.',
        urgency: 'stat',
        actionType: 'monitoring',
        confidence: 0.9,
        context: { alertId: labCritical.id, component: labCritical.component_name, severity: labCritical.severity },
        citations: [{
          guidelineId: 'joint-commission-critical-lab-policy',
          label: 'Critical laboratory result communication policy',
          source: 'Clinical Safety Policy',
          confidence: 0.84,
        }],
      });
    }
    const hivEnrollment = modules?.hiv?.latestEnrollment;
    if (hivEnrollment) {
      rules.push({
        ruleId: 'hiv_followup_continuity_rule',
        recommendationId: 'hiv_followup_continuity',
        title: 'HIV continuity follow-up scheduling',
        description: 'Confirm next HIV clinical review date, adherence counseling checkpoint, and required lab monitoring timeline.',
        urgency: 'routine',
        actionType: 'follow_up',
        confidence: 0.82,
        context: { enrollmentId: hivEnrollment.id, nextReviewDate: modules?.hiv?.latestClinicalVisit?.next_review_date || null },
        citations: [{
          guidelineId: 'who-hiv-care-followup-2024',
          label: 'WHO HIV care and treatment clinical follow-up guidance',
          source: 'WHO HIV Guidelines',
          confidence: 0.86,
        }],
      });
    }
    const medicationIntelligence = this.buildMedicationIntelligenceAssessment(patientContext, extractedEntities);
    const issueCount =
      medicationIntelligence.interactions.length +
      medicationIntelligence.beersAlerts.length +
      medicationIntelligence.renalAlerts.length;
    if (medicationIntelligence.enabled && issueCount > 0) {
      const hasHighRisk =
        medicationIntelligence.highestSeverity !== null &&
        this.getMedicationSeverityRank(medicationIntelligence.highestSeverity) >= 3;
      rules.push({
        ruleId: 'medication_safety_intelligence_v2_rule',
        recommendationId: 'medication_safety_intelligence_v2',
        title: hasHighRisk ? 'High-risk medication safety review' : 'Medication safety review',
        description: medicationIntelligence.riskNarrative,
        urgency: hasHighRisk ? 'urgent' : 'routine',
        actionType: 'medication',
        confidence: hasHighRisk ? 0.91 : 0.83,
        context: { medicationIntelligence, issueCount, highRisk: hasHighRisk },
        citations: [{
          guidelineId: 'fda-drug-safety-interactions',
          label: 'FDA drug interaction safety communication',
          source: 'FDA Safety',
          confidence: 0.86,
        }],
      });
    }
    const activePrescriptionCount = Number(modules?.pharmacy?.activePrescriptionCount || 0) || Number(modules?.pharmacy?.active_count || 0);
    if (activePrescriptionCount > 0) {
      rules.push({
        ruleId: 'medication_adherence_reinforcement_rule',
        recommendationId: 'medication_adherence_reinforcement',
        title: 'Medication adherence reinforcement',
        description: 'Issue plain-language medication adherence reminders and confirm understanding via teach-back.',
        urgency: 'routine',
        actionType: 'medication',
        confidence: 0.78,
        context: { activePrescriptionCount },
        citations: [{
          guidelineId: 'adherence-counseling-best-practice',
          label: 'Medication adherence counseling best practice',
          source: 'Clinical Adherence Guidance',
          confidence: 0.79,
        }],
      });
    }
    if (!rules.length) {
      rules.push({
        ruleId: 'general_post_visit_followup_rule',
        recommendationId: 'general_post_visit_followup',
        title: 'General post-visit follow-up package',
        description: 'Provide plain-language summary, follow-up date recommendation, and return-precaution instructions.',
        urgency: 'routine',
        actionType: 'follow_up',
        confidence: 0.72,
        context: {},
        citations: [{
          guidelineId: 'transition-of-care-best-practice',
          label: 'Transitions of care communication guidance',
          source: 'Care Continuity Framework',
          confidence: 0.74,
        }],
      });
    }
    return rules;
  },

  buildVisitSummaryContent(this: any, args: {
    patientContext: any;
    soapNote: any;
    extractedEntities: any[];
    session: any;
  }) {
    const subjective = String(args.soapNote?.subjective || '').trim();
    const objective = String(args.soapNote?.objective || '').trim();
    const assessment = String(args.soapNote?.assessment || '').trim();
    const plan = String(args.soapNote?.plan || '').trim();
    const language = args.session?.language || 'en';
    const keyPoints = [assessment, plan, objective].filter((item) => item.length > 0).slice(0, 5);
    const plainLanguageSummary = [subjective, assessment, plan]
      .filter((item) => item.length > 0)
      .join('. ')
      .trim() || 'Doctor-approved post-visit summary is available.';
    return {
      language,
      summary_text: [subjective, objective, assessment, plan].filter(Boolean).join('\n'),
      plain_language_summary: plainLanguageSummary,
      key_points: keyPoints,
      teach_back_questions: [
        'Can you explain the main plan in your own words?',
        'What symptoms would make you seek urgent help?',
      ],
      companion_topic_checklist: keyPoints.length ? keyPoints : ['follow_up', 'medication', 'warning_signs'],
      literacy_score: Math.max(0, Math.min(100, 72)),
      generated_at: new Date().toISOString(),
    };
  },

  applyRecommendationLlmRewrites(this: any, items: any[], rewrites: any[]) {
    if (!Array.isArray(items) || !Array.isArray(rewrites) || rewrites.length === 0) {
      return items;
    }
    const rewriteMap = new Map(
      rewrites.map((rewrite: any) => [
        String(rewrite?.recommendationId || rewrite?.recommendation_id || rewrite?.id || ''),
        rewrite,
      ]),
    );
    return items.map((item: any) => {
      const rewrite = rewriteMap.get(String(item?.id || ''));
      if (!rewrite) return item;
      return {
        ...item,
        title: rewrite.title || item?.title,
        description: rewrite.description || item?.description,
      };
    });
  },

  normalizeCitationRelevanceScore(this: any, value: any): number | null {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.min(1, Math.max(0, num));
  },

  extractGuidelineYear(this: any, guidelineId?: string | null): number | null {
    const source = String(guidelineId || '');
    const match = source.match(/(19|20)\d{2}/);
    if (!match) return null;
    const year = Number(match[0]);
    return Number.isFinite(year) ? year : null;
  },

  async replaceRuleCitations(this: any, tenantDb: DataSource, sessionId: string, citations: Array<{ recommendationId: string; ruleId: string; citation: RuleCitation; metadata?: Record<string, any>; }>) {
    await tenantDb.query(`DELETE FROM post_visit_rule_citations WHERE session_id = $1`, [sessionId]);
    for (const row of citations) {
      await tenantDb.query(
        `
          INSERT INTO post_visit_rule_citations (
            session_id,
            artifact_type,
            recommendation_id,
            rule_id,
            guideline_id,
            citation_label,
            citation_source,
            citation_url,
            evidence_excerpt,
            confidence,
            relevance_score,
            citation_year,
            is_superseded,
            superseded_by_guideline_id,
            metadata
          ) VALUES ($1,'recommendation_bundle',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
        `,
        [
          sessionId,
          row.recommendationId,
          row.ruleId,
          row.citation.guidelineId,
          row.citation.label,
          row.citation.source,
          row.citation.url || null,
          row.citation.excerpt || null,
          typeof row.citation.confidence === 'number' ? row.citation.confidence : null,
          this.normalizeCitationRelevanceScore(row.citation.relevanceScore ?? row.citation.confidence ?? null),
          row.citation.publicationYear ?? this.extractGuidelineYear(row.citation.guidelineId),
          row.citation.isSuperseded === true,
          row.citation.supersededByGuidelineId || null,
          JSON.stringify(row.metadata || {}),
        ],
      );
    }
  },

  async refreshSessionBillingIntelligence(this: any, tenantDb: DataSource, args: any) {
    if (this.billingIntelligenceService?.refreshSessionBillingIntelligence) {
      return this.billingIntelligenceService.refreshSessionBillingIntelligence(tenantDb, args);
    }
    return {
      suggestions: [],
      documentation: { score: 0, status: 'insufficient', checks: [], gaps: [] },
    };
  },

  isPatientStoryEnabled(this: any): boolean {
    const configured = (config as any)?.features?.postVisitPatientStory;
    if (typeof configured === 'boolean') return configured;
    return String(process.env.FEATURE_POSTVISIT_PATIENT_STORY || 'false').toLowerCase() === 'true';
  },

  async regeneratePatientStoryForPatient(this: any, _tenantDb: DataSource, _patientId: string, _triggerSessionId?: string) {
    return;
  },

  isFhirWriteBackEnabled(this: any): boolean {
    return String(process.env.FEATURE_POSTVISIT_FHIR_WRITEBACK || 'false').toLowerCase() === 'true';
  },

  isPeerConsultEnabled(this: any): boolean {
    return String(process.env.FEATURE_POSTVISIT_PEER_CONSULT || 'false').toLowerCase() === 'true';
  },

  isCitationQualityV2Enabled(this: any): boolean {
    return String(process.env.FEATURE_POSTVISIT_CITATION_QUALITY_V2 || 'false').toLowerCase() === 'true';
  },

  getCitationRelevanceThreshold(this: any): number {
    const raw = Number(process.env.POSTVISIT_CITATION_MIN_RELEVANCE || 0.55);
    if (!Number.isFinite(raw)) return 0.55;
    return Math.min(0.95, Math.max(0.2, raw));
  },

  resolveClinicalTrialsApiUrl(this: any): string {
    const direct = String(process.env.POSTVISIT_CLINICALTRIALS_API_URL || env.POSTVISIT_CLINICALTRIALS_API_URL || '').trim();
    if (direct) return direct;
    throw new Error('POSTVISIT_CLINICALTRIALS_API_URL is not configured.');
  },

  getTrialSlaEmailMinSeverity(this: any): TrialSlaNotificationSeverity {
    const normalized = String((config as any)?.features?.postVisitTrialSlaEmailMinSeverity || process.env.POSTVISIT_TRIAL_SLA_EMAIL_MIN_SEVERITY || 'high').trim().toLowerCase();
    if (normalized === 'moderate' || normalized === 'critical') return normalized;
    return 'high';
  },

  getTrialSlaSmsMinSeverity(this: any): TrialSlaNotificationSeverity {
    const normalized = String((config as any)?.features?.postVisitTrialSlaSmsMinSeverity || process.env.POSTVISIT_TRIAL_SLA_SMS_MIN_SEVERITY || 'critical').trim().toLowerCase();
    if (normalized === 'moderate' || normalized === 'high') return normalized;
    return 'critical';
  },

  getTrialSlaMaxRecipients(this: any): number {
    const raw = Number((config as any)?.features?.postVisitTrialSlaNotifyMaxRecipients ?? process.env.POSTVISIT_TRIAL_SLA_NOTIFY_MAX_RECIPIENTS ?? '3');
    if (!Number.isFinite(raw)) return 3;
    return Math.min(Math.max(Math.round(raw), 1), 20);
  },

  severityRank(this: any, severity: PostVisitEscalationSeverity | TrialSlaNotificationSeverity): number {
    if (severity === 'critical') return 4;
    if (severity === 'high') return 3;
    if (severity === 'moderate') return 2;
    return 1;
  },

  isSeverityAtLeast(this: any, severity: PostVisitEscalationSeverity | TrialSlaNotificationSeverity, threshold: TrialSlaNotificationSeverity): boolean {
    return this.severityRank(severity) >= this.severityRank(threshold);
  },

  computeTrialDecisionAgeHours(this: any, createdAt: any, reviewedAt: any): number {
    const reference = reviewedAt || createdAt;
    const parsed = new Date(reference);
    if (Number.isNaN(parsed.getTime())) return 0;
    return Math.max(0, (Date.now() - parsed.getTime()) / (1000 * 60 * 60));
  },

  mapTrialMatch(this: any, row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      trialSource: row.trial_source || 'clinicaltrials_gov_v2',
      trialId: row.trial_id,
      trialTitle: row.trial_title,
      trialPhase: row.trial_phase || null,
      trialStatus: row.trial_status || null,
      conditionTags: Array.isArray(row.condition_tags) ? row.condition_tags : [],
      sourceUrl: row.source_url || null,
      eligibilityScore: Number(row.eligibility_score || 0),
      eligibilityRationale: Array.isArray(row.eligibility_rationale) ? row.eligibility_rationale : [],
      matchStatus: (row.match_status || 'proposed') as PostVisitTrialMatchStatus,
      reviewedBy: row.reviewed_by || null,
      reviewedAt: row.reviewed_at || null,
      reviewNote: row.review_note || null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  mapTrialMatchAuditRow(this: any, row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      trialMatchId: row.trial_match_id,
      patientId: row.patient_id,
      action: row.action || null,
      previousStatus: row.previous_status || null,
      nextStatus: row.next_status || null,
      note: row.note || null,
      actedBy: row.acted_by || null,
      actedAt: row.acted_at || row.created_at || null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  assertPatientSessionAccess(this: any, sessionRow: any, patientId: string) {
    if (String(sessionRow.patient_id) !== String(patientId)) {
      throw new ForbiddenException('You do not have access to this post-visit session');
    }
  },

  assertPatientCompanionAccessAllowed(this: any, sessionRow: any) {
    const status = String(sessionRow.status || '').toLowerCase();
    if (!['published', 'closed'].includes(status)) {
      throw new ForbiddenException('Post-visit session is not yet published for patient companion access');
    }
  },

  async ensureCompanionThread(this: any, tenantDb: DataSource, sessionRow: any, createdBy: string | null) {
    const resolvedSessionId = String(sessionRow?.id || '').trim();
    const resolvedPatientId = String(sessionRow?.patient_id || '').trim();
    if (!resolvedSessionId || !resolvedPatientId) {
      throw new InternalServerErrorException('Unable to initialize companion thread due to missing post-visit session identity.');
    }
    const rows = await tenantDb.query(
      `
        INSERT INTO post_visit_companion_threads (
          session_id,
          patient_id,
          status,
          created_by
        ) VALUES ($1,$2,'active',$3)
        ON CONFLICT (session_id, patient_id)
        DO UPDATE SET updated_at = NOW()
        RETURNING *
      `,
      [resolvedSessionId, resolvedPatientId, createdBy],
    );
    return rows[0];
  },

  async touchCompanionThreadAfterMessage(this: any, tenantDb: DataSource, threadId: string, senderType: 'patient' | 'clinician' | 'system') {
    const stampColumn =
      senderType === 'patient'
        ? 'last_patient_message_at'
        : senderType === 'clinician'
          ? 'last_clinician_message_at'
          : null;
    if (stampColumn) {
      await tenantDb.query(
        `
          UPDATE post_visit_companion_threads
          SET message_count = message_count + 1,
              last_message_at = NOW(),
              ${stampColumn} = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `,
        [threadId],
      );
      return;
    }
    await tenantDb.query(
      `
        UPDATE post_visit_companion_threads
        SET message_count = message_count + 1,
            last_message_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [threadId],
    );
  },

  isEscalationConfidenceV2Enabled(this: any): boolean {
    return String(process.env.FEATURE_POSTVISIT_ESCALATION_CONFIDENCE || 'false').toLowerCase() === 'true';
  },

  classifyEscalationSignals(this: any, payload: any): PostVisitEscalationClassifierOutput {
    const text = String(payload?.message || payload || '').toLowerCase().trim();
    const criticalTerms = ['chest pain', 'shortness of breath', 'difficulty breathing', 'cannot breathe', 'suicidal', 'seizure', 'stroke'];
    const highTerms = ['severe headache', 'vision loss', 'confusion', 'high fever', 'palpitations', 'worsening pain'];
    const moderateTerms = ['dizziness', 'nausea', 'vomiting', 'swelling', 'rash', 'side effects'];
    const matchTerms = (terms: string[]) => terms.filter((term) => text.includes(term));
    const temporality =
      text.includes('last week') || text.includes('last month') || text.includes('yesterday') || text.includes('previously')
        ? 'historical'
        : text.includes('right now') || text.includes('currently') || text.includes('today') || text.includes('now')
          ? 'current'
          : 'unclear';
    const criticalMatches = matchTerms(criticalTerms);
    if (criticalMatches.length) {
      if (temporality === 'historical' && this.isEscalationConfidenceV2Enabled()) {
        return { detected: false, severity: 'critical', routeTarget: 'doctor', confidence: 0.95, triggerTerms: criticalMatches, temporality, classifierSource: 'keyword_v1', rationale: 'Historical high-risk signal suppressed.', escalationSuppressedReason: 'historical_signal', classifierModel: null, triggerType: 'symptom_keyword', slaMinutes: 30 } as any;
      }
      return { detected: true, severity: 'critical', routeTarget: 'emergency', confidence: 0.95, triggerTerms: criticalMatches, temporality: temporality === 'unclear' ? 'current' : temporality, classifierSource: 'keyword_v1', rationale: 'Critical symptom keywords matched.', escalationSuppressedReason: null, classifierModel: null, triggerType: 'symptom_keyword', slaMinutes: 5 } as any;
    }
    const highMatches = matchTerms(highTerms);
    if (highMatches.length) {
      if (temporality === 'historical' && this.isEscalationConfidenceV2Enabled()) {
        return { detected: false, severity: 'high', routeTarget: 'doctor', confidence: 0.84, triggerTerms: highMatches, temporality, classifierSource: 'keyword_v1', rationale: 'Historical high-risk signal suppressed.', escalationSuppressedReason: 'historical_signal', classifierModel: null, triggerType: 'symptom_keyword', slaMinutes: 60 } as any;
      }
      return { detected: true, severity: 'high', routeTarget: 'doctor', confidence: 0.84, triggerTerms: highMatches, temporality: temporality === 'unclear' ? 'current' : temporality, classifierSource: 'keyword_v1', rationale: 'High-risk symptom keywords matched.', escalationSuppressedReason: null, classifierModel: null, triggerType: 'symptom_keyword', slaMinutes: 60 } as any;
    }
    const moderateMatches = matchTerms(moderateTerms);
    if (moderateMatches.length) {
      return { detected: true, severity: 'moderate', routeTarget: 'nurse', confidence: 0.72, triggerTerms: moderateMatches, temporality: temporality === 'unclear' ? 'current' : temporality, classifierSource: 'keyword_v1', rationale: 'Moderate symptom keywords matched.', escalationSuppressedReason: null, classifierModel: null, triggerType: 'symptom_keyword', slaMinutes: 240 } as any;
    }
    return { detected: false, severity: 'low', routeTarget: 'nurse', confidence: 0.2, triggerTerms: [], temporality, classifierSource: 'keyword_v1', rationale: 'No escalation signal matched.', escalationSuppressedReason: null, classifierModel: null, triggerType: 'none', slaMinutes: null } as any;
  },

  normalizeIntraVisitAlertSource(this: any, value: any): string {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || 'streamed_transcript';
  },

  normalizeIntraVisitTranscriptOffset(this: any, value: any): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
  },

  resolveIntraVisitRoutingDecision(this: any, _tenantDb: DataSource, _sessionRow: any, alert: IntraVisitAlertDraft): IntraVisitRoutingDecision {
    const routeTarget = alert.severity === 'critical' ? 'emergency' : alert.severity === 'high' ? 'doctor' : 'nurse';
    const assignedRole = routeTarget === 'emergency' ? 'rapid_response' : routeTarget === 'doctor' ? 'doctor' : 'nurse';
    return {
      routeTarget,
      assignedRole,
      assignedUserId: null,
      assignedTeam: null,
      routingRationale: `Severity ${alert.severity} routed to ${routeTarget}.`,
      policyVersion: 'c3.v1',
      slaDueAt: routeTarget === 'emergency' ? new Date(Date.now() + 5 * 60 * 1000) : routeTarget === 'doctor' ? new Date(Date.now() + 30 * 60 * 1000) : new Date(Date.now() + 2 * 60 * 60 * 1000),
    };
  },

  async routeEscalationToWorkflow(this: any, tenantDb: DataSource, args: any) {
    const workflowKey = `post_visit_escalation:${String(args.escalationId || args.sessionId || '')}:${Date.now()}`;
    try {
      await tenantDb.query(
        `
          INSERT INTO nurse_cross_module_workflow_state (
            workflow_key,
            workflow_type,
            patient_id,
            appointment_id,
            consultation_id,
            assigned_role,
            assigned_user_id,
            status,
            priority,
            note,
            metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9,$10::jsonb)
        `,
        [
          workflowKey,
          'post_visit_escalation',
          args.patientId || null,
          args.appointmentId || null,
          args.consultationId || null,
          args.routeTarget || 'doctor',
          null,
          args.severity === 'critical' ? 'critical' : args.severity === 'high' ? 'high' : 'normal',
          args.signalText || null,
          JSON.stringify(args.metadata || {}),
        ],
      );
    } catch (e: any) {
      // F11 fix (S269) — previously returned workflowKey unconditionally even when
      // this insert failed, so callers' `if (workflowKey) { UPDATE ... workflow_key }`
      // would set post_visit_escalation_events.workflow_key to a key that references
      // a row that was never created (a "ghost workflow" no dashboard join could find).
      this.logger.error(`routeEscalationToWorkflow failed for escalation ${args.escalationId || args.sessionId}: ${e?.message}`);
      return null;
    }
    return workflowKey;
  },

  async createEscalationEvent(this: any, tenantDb: DataSource, args: any) {
    const detection = args.detection || {};
    const sessionRow = args.sessionRow || {};
    const sessionId = args.sessionId || sessionRow.id;
    const patientId = args.patientId || sessionRow.patient_id;
    const messageText = args.messageText || args.signalText || null;
    const routeTarget = args.routeTarget || detection.routeTarget || 'doctor';
    const severity = args.severity || detection.severity || 'moderate';
    const insertedRows = await tenantDb.query(
      `
        INSERT INTO post_visit_escalation_events (
          session_id,
          patient_id,
          thread_id,
          message_id,
          status,
          severity,
          route_target,
          trigger_type,
          trigger_terms,
          signal_text,
          classification_confidence,
          classification_temporality,
          classification_source,
          classification_reason,
          classification_stage,
          sla_due_at,
          metadata
        ) VALUES (
          $1,$2,$3,$4,'open',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb
        )
        RETURNING *
      `,
      [
        sessionId,
        patientId,
        args.threadId || null,
        args.messageId || null,
        severity,
        routeTarget,
        args.triggerType || detection.triggerType || 'patient_message',
        args.triggerTerms || detection.triggerTerms || [],
        messageText,
        typeof args.classificationConfidence === 'number' ? args.classificationConfidence : detection.confidence ?? null,
        args.classificationTemporality || detection.temporality || null,
        args.classificationSource || detection.classifierSource || null,
        args.classificationReason || detection.rationale || null,
        args.classificationStage || 'v1',
        args.slaDueAt || null,
        JSON.stringify({
          ...(args.metadata || {}),
          channel_delivery: args.channelDelivery || null,
        }),
      ],
    );
    const inserted = insertedRows[0];
    if (!inserted) {
      throw new InternalServerErrorException('Failed to create post-visit escalation event');
    }

    const channelDelivery = {
      patientInApp: false,
      patientSms: false,
      patientEmail: false,
      clinicianSms: false,
      clinicianEmail: false,
    };

    if (this.patientNotificationsService?.createNotification && patientId) {
      await this.patientNotificationsService
        .createNotification(
          patientId,
          'system_alert',
          'Post-Visit Safety Alert',
          routeTarget === 'emergency'
            ? 'Please seek urgent care immediately.'
            : 'Your care team has been notified to review your message.',
          args.tenantId || null,
          {
            escalationId: inserted.id,
            sessionId,
            routeTarget,
            severity,
          },
        )
        .then(() => {
          channelDelivery.patientInApp = true;
        })
        .catch(() => undefined);
    }

    if (patientId && (this.notificationsService?.sendSms || this.emailService?.sendEmail)) {
      const patientRows = await tenantDb.query(
        `
          SELECT id, first_name, last_name, phone, email
          FROM patients
          WHERE id = $1
          LIMIT 1
        `,
        [patientId],
      ).catch(() => []);
      const patient = patientRows?.[0];
      if (patient?.phone && this.notificationsService?.sendSms) {
        await this.notificationsService
          .sendSms(
            patient.phone,
            routeTarget === 'emergency'
              ? 'Urgent post-visit alert: seek emergency care now.'
              : 'Your post-visit message was routed to the care team.',
          )
          .then(() => {
            channelDelivery.patientSms = true;
          })
          .catch(() => undefined);
      }
      if (patient?.email && this.emailService?.sendEmail) {
        await this.emailService
          .sendEmail({
            to: patient.email,
            subject: 'Post-Visit Safety Alert',
            text:
              routeTarget === 'emergency'
                ? 'Urgent post-visit alert: seek emergency care now.'
                : 'Your post-visit message was routed to the care team.',
          })
          .then(() => {
            channelDelivery.patientEmail = true;
          })
          .catch(() => undefined);
      }
    }

    if (this.notificationsService?.sendSms || this.emailService?.sendEmail) {
      const clinicianRows = await tenantDb.query(
        `
          SELECT id, first_name, last_name, phone, email
          FROM users
          WHERE role IN ('doctor','nurse','nurse_accounts')
          ORDER BY created_at DESC NULLS LAST, id ASC
          LIMIT 3
        `,
      ).catch(() => []);
      for (const clinician of clinicianRows || []) {
        if (clinician?.phone && this.notificationsService?.sendSms && !channelDelivery.clinicianSms) {
          await this.notificationsService
            .sendSms(
              clinician.phone,
              `Post-visit escalation requires ${routeTarget} review.`,
            )
            .then(() => {
              channelDelivery.clinicianSms = true;
            })
            .catch(() => undefined);
        }
        if (clinician?.email && this.emailService?.sendEmail && !channelDelivery.clinicianEmail) {
          await this.emailService
            .sendEmail({
              to: clinician.email,
              subject: 'Post-Visit Escalation',
              text: `Post-visit escalation requires ${routeTarget} review.`,
            })
            .then(() => {
              channelDelivery.clinicianEmail = true;
            })
            .catch(() => undefined);
        }
      }
    }

    let workflowKey: string | null = null;
    if (String(args.routeTarget || '').length > 0) {
      workflowKey = await this.routeEscalationToWorkflow(tenantDb, {
        escalationId: inserted.id,
        sessionId,
        patientId,
        appointmentId: args.appointmentId || sessionRow.appointment_id || null,
        consultationId: args.consultationId || sessionRow.consultation_id || null,
        routeTarget,
        severity,
        signalText: messageText,
        metadata: args.metadata || {},
      }).catch(() => null);
    }
    if (workflowKey) {
      await tenantDb.query(
        `
          UPDATE post_visit_escalation_events
          SET workflow_key = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [inserted.id, workflowKey],
      ).catch(() => {});
      inserted.workflow_key = workflowKey;
    }
    if (Object.values(channelDelivery).some(Boolean)) {
      inserted.metadata = {
        ...(inserted.metadata || {}),
        channel_delivery: channelDelivery,
      };
      await tenantDb.query(
        `
          UPDATE post_visit_escalation_events
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `,
        [inserted.id, JSON.stringify({ channel_delivery: channelDelivery })],
      ).catch(() => {});
    }
    return this.mapEscalationEvent(inserted);
  },

  async buildGroundedCompanionAnswer(this: any, args: any) {
    if (args?.escalation?.detected && args?.escalation?.routeTarget === 'emergency') {
      return {
        answer: 'Your symptoms may be urgent. Please call emergency services now or go to the nearest emergency facility immediately.',
        source: 'deterministic',
        citationsUsed: [],
        model: null,
        abstained: false,
        llmAudit: null,
      };
    }
    const summary = String(args?.visitSummaryArtifact?.content?.plain_language_summary || '').trim();
    const recommendations = Array.isArray(args?.recommendationArtifact?.content?.items)
      ? args.recommendationArtifact.content.items
      : [];
    const citationCatalog = recommendations.flatMap((item: any) =>
      (Array.isArray(item?.citations) ? item.citations : []).map((citation: any) => ({
        id: String(citation?.citation_id || ''),
        label: String(citation?.label || ''),
        source: String(citation?.source || ''),
        excerpt: citation?.excerpt || '',
      })),
    );
    if (this.groundedLlmService?.answerPatientQuestion) {
      const llmResult = await this.groundedLlmService.answerPatientQuestion({
        sessionId: String(args.sessionId || ''),
        tenantId: args.tenantId,
        language: String(args?.visitSummaryArtifact?.content?.language || 'en'),
        question: args.question,
        summary,
        checklist: recommendations.map((item: any) => String(item?.title || '').trim()).filter(Boolean),
        citations: citationCatalog,
      });
      if (llmResult && !llmResult.abstained && llmResult.answer) {
        return {
          answer: llmResult.answer,
          source: 'llm',
          citationsUsed: llmResult.citationsUsed || [],
          model: llmResult.model || null,
          abstained: false,
          llmAudit: llmResult.audit || null,
        };
      }
    }
    return {
      answer: summary || 'I can help with your approved visit plan and checklist.',
      source: 'deterministic',
      citationsUsed: [],
      model: null,
      abstained: false,
      llmAudit: null,
    };
  },

  async persistGroundedLlmAudit(this: any, tenantDb: DataSource, args: any) {
    if (!this.hipaaAuditService) {
      return;
    }
    const modelName = String(args?.model || '').trim();
    const audit = args?.audit || null;
    if (!modelName || !audit?.promptHash) {
      return;
    }
    const modelId = `postvisit.${modelName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`;
    const provider =
      modelName.toLowerCase().includes('gpt') || modelName.toLowerCase().includes('openai')
        ? 'openai'
        : modelName.toLowerCase().includes('claude')
          ? 'anthropic'
          : 'custom';
    await this.hipaaAuditService.registerModelEntry(tenantDb, {
      modelId,
      modelName,
      modelVersion: String(audit.templateVersion || 'v1'),
      provider,
      status: 'active',
      metadata: { feature: 'post_visit_grounded_llm' },
    }).catch(() => undefined);
    await this.hipaaAuditService.logPromptAudit(tenantDb, {
      promptHash: audit.promptHash,
      templateVersion: audit.templateVersion || 'postvisit-grounded-v1',
      modelId,
      sessionId: args.sessionId,
      patientId: args.patientId || null,
      encounterId: args.encounterId || null,
      actorId: args.actorUserId || null,
      actorRole: args.actorRole || null,
      inputTokenCount: audit.inputTokenCount,
      outputTokenCount: audit.outputTokenCount,
      latencyMs: audit.latencyMs,
      safetyGateTriggered: audit.safetyGateTriggered === true,
      requestId: args.requestId || null,
      metadata: {
        model_name: modelName,
        ...(args.metadata || {}),
      },
    }).catch(() => undefined);
  },

  async createGeneralOrderFromRecommendation(this: any, tenantDb: DataSource, args: any) {
    const recommendation = args.recommendation || {};
    const rows = await tenantDb.query(
      `
        INSERT INTO orders (
          patient_id,
          appointment_id,
          consultation_id,
          order_type,
          order_name,
          description,
          status,
          priority,
          created_by,
          notes
        ) VALUES ($1,$2,$3,$4,$5,$6,'authorized',$7,$8,$9)
        RETURNING *
      `,
      [
        args.sessionRow.patient_id,
        args.sessionRow.appointment_id || null,
        args.sessionRow.consultation_id || null,
        recommendation.action_type || 'follow_up',
        recommendation.title || 'Post-visit recommendation',
        recommendation.description || null,
        recommendation.urgency === 'stat' ? 'stat' : recommendation.urgency === 'urgent' ? 'urgent' : 'normal',
        args.actorUserId || null,
        args.note || null,
      ],
    );
    const row = rows[0];
    return {
      resourceType: 'order',
      resourceId: row?.id || null,
      payload: row || {},
    };
  },

  async createLabOrderFromRecommendation(this: any, tenantDb: DataSource, args: any) {
    return this.createGeneralOrderFromRecommendation(tenantDb, {
      ...args,
      recommendation: {
        ...args.recommendation,
        action_type: 'lab_order',
      },
    });
  },

  async syncRecommendationExecutionIntoArtifact(this: any, tenantDb: DataSource, args: any) {
    const artifact = await this.getArtifactRow(tenantDb, args.sessionId, 'recommendation_bundle');
    if (!artifact) return;
    const content = artifact.content || {};
    const actionExecutions = content.action_executions && typeof content.action_executions === 'object'
      ? content.action_executions
      : {};
    actionExecutions[args.recommendationId] = args.execution;
    await tenantDb.query(
      `
        UPDATE post_visit_draft_artifacts
        SET content = $3::jsonb,
            updated_by = $4,
            updated_at = NOW()
        WHERE session_id = $1
          AND artifact_type = $2
      `,
      [args.sessionId, 'recommendation_bundle', JSON.stringify({ ...content, action_executions: actionExecutions }), args.actorUserId || null],
    ).catch(() => {});
  },

  async safeSyncCrossModuleWorkflow(this: any, _tenantDb: DataSource, _args: any) {
    return;
  },
});
