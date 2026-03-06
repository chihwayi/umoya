import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import 'multer';
import axios from 'axios';
import * as FormData from 'form-data';
import { createHash } from 'crypto';
import { config } from '@medicore/config';
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
import { HipaaAuditService } from './hipaa-audit.service';

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

type PostVisitSoapSpecialty = 'general_practice' | 'mental_health' | 'cardiology' | 'paediatrics';

interface SpecialtySoapCheckResult {
  id: string;
  label: string;
  passed: boolean;
  guidance: string;
}

interface SpecialtySoapValidationSummary {
  specialty: PostVisitSoapSpecialty;
  templateVersion: 'v1';
  isComplete: boolean;
  completenessScore: number;
  checks: SpecialtySoapCheckResult[];
  missingCheckIds: string[];
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
  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly patientService: PatientService,
    private readonly notificationsService?: NotificationsService,
    private readonly emailService?: EmailService,
    private readonly patientNotificationsService?: PatientNotificationsService,
    private readonly groundedLlmService?: PostVisitGroundedLlmService,
    private readonly hipaaAuditService?: HipaaAuditService,
  ) {}

  private async ensurePostVisitSchema(tenantDb: DataSource) {
    await tenantDb.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(100),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
        consultation_id UUID REFERENCES telemedicine_consultations(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'captured'
          CHECK (status IN ('captured','processing','draft_ready','doctor_reviewed','published','closed')),
        source_type VARCHAR(20) NOT NULL DEFAULT 'in_person'
          CHECK (source_type IN ('in_person','telemedicine','hybrid')),
        language VARCHAR(10) DEFAULT 'en',
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        published_at TIMESTAMP WITH TIME ZONE,
        safety_level VARCHAR(20),
        risk_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_transcript_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        segment_order INTEGER NOT NULL,
        start_second DOUBLE PRECISION NOT NULL,
        end_second DOUBLE PRECISION NOT NULL,
        text TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        language VARCHAR(10),
        speaker_label VARCHAR(60),
        speaker_role VARCHAR(20) NOT NULL DEFAULT 'unknown'
          CHECK (speaker_role IN ('doctor','patient','unknown')),
        diarization_confidence DOUBLE PRECISION,
        speaker_assignment_status VARCHAR(20) NOT NULL DEFAULT 'unresolved'
          CHECK (speaker_assignment_status IN ('auto','confirmed','reassigned','unresolved')),
        needs_review BOOLEAN NOT NULL DEFAULT FALSE,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_transcript_segments
      ADD COLUMN IF NOT EXISTS speaker_label VARCHAR(60),
      ADD COLUMN IF NOT EXISTS speaker_role VARCHAR(20) NOT NULL DEFAULT 'unknown'
        CHECK (speaker_role IN ('doctor','patient','unknown')),
      ADD COLUMN IF NOT EXISTS diarization_confidence DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS speaker_assignment_status VARCHAR(20) NOT NULL DEFAULT 'unresolved'
        CHECK (speaker_assignment_status IN ('auto','confirmed','reassigned','unresolved')),
      ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_extracted_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        entity_type VARCHAR(60) NOT NULL,
        entity_value TEXT NOT NULL,
        normalized_value JSONB NOT NULL DEFAULT '{}'::jsonb,
        confidence DOUBLE PRECISION,
        source_start_second DOUBLE PRECISION,
        source_end_second DOUBLE PRECISION,
        source_origin VARCHAR(30) NOT NULL DEFAULT 'transcript',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_draft_artifacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        artifact_type VARCHAR(50) NOT NULL,
        artifact_status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK (artifact_status IN ('draft','reviewed','published')),
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        citations JSONB NOT NULL DEFAULT '[]'::jsonb,
        confidence DOUBLE PRECISION,
        generated_by VARCHAR(80) NOT NULL DEFAULT 'post_visit_pipeline',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, artifact_type)
      )
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_review_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        artifact_id UUID REFERENCES post_visit_draft_artifacts(id) ON DELETE SET NULL,
        artifact_type VARCHAR(50) NOT NULL,
        action VARCHAR(20) NOT NULL CHECK (action IN ('accept','edit','reject')),
        review_reason TEXT,
        review_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        before_content JSONB NOT NULL DEFAULT '{}'::jsonb,
        after_content JSONB NOT NULL DEFAULT '{}'::jsonb,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        source VARCHAR(80) NOT NULL DEFAULT 'post_visit_review',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_rule_citations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        artifact_type VARCHAR(50) NOT NULL DEFAULT 'recommendation_bundle',
        recommendation_id VARCHAR(120),
        rule_id VARCHAR(120) NOT NULL,
        guideline_id VARCHAR(120) NOT NULL,
        citation_label VARCHAR(255) NOT NULL,
        citation_source VARCHAR(255) NOT NULL,
        citation_url TEXT,
        evidence_excerpt TEXT,
        confidence DOUBLE PRECISION,
        relevance_score DOUBLE PRECISION,
        citation_year INTEGER,
        is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
        superseded_by_guideline_id VARCHAR(120),
        doctor_acknowledged_superseded BOOLEAN NOT NULL DEFAULT FALSE,
        superseded_acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        superseded_acknowledged_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_rule_citations
      ADD COLUMN IF NOT EXISTS relevance_score DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS citation_year INTEGER,
      ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS superseded_by_guideline_id VARCHAR(120),
      ADD COLUMN IF NOT EXISTS doctor_acknowledged_superseded BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS superseded_acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS superseded_acknowledged_at TIMESTAMP WITH TIME ZONE
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_action_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        recommendation_id VARCHAR(120) NOT NULL,
        action_key VARCHAR(160) NOT NULL,
        action_type VARCHAR(60) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'executed' CHECK (status IN ('executed','failed','skipped')),
        execution_note TEXT,
        result_resource_type VARCHAR(80),
        result_resource_id VARCHAR(120),
        result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_message TEXT,
        executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        source VARCHAR(80) NOT NULL DEFAULT 'post_visit_execute',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, recommendation_id, action_key)
      )
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_companion_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','closed')),
        message_count INTEGER NOT NULL DEFAULT 0,
        last_message_at TIMESTAMP WITH TIME ZONE,
        last_patient_message_at TIMESTAMP WITH TIME ZONE,
        last_clinician_message_at TIMESTAMP WITH TIME ZONE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, patient_id)
      )
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_companion_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES post_visit_companion_threads(id) ON DELETE CASCADE,
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL
          CHECK (sender_type IN ('patient','clinician','system')),
        sender_id UUID,
        message_type VARCHAR(30) NOT NULL DEFAULT 'question'
          CHECK (message_type IN ('question','answer','summary','checklist','alert','system')),
        message_text TEXT NOT NULL,
        grounded_context JSONB NOT NULL DEFAULT '{}'::jsonb,
        escalation_detected BOOLEAN NOT NULL DEFAULT FALSE,
        escalation_event_id UUID,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_document_intelligence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        document_type VARCHAR(40) NOT NULL
          CHECK (document_type IN ('lab_report','prescription','imaging_report','discharge_summary','other')),
        document_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120),
        file_size INTEGER,
        file_sha256 VARCHAR(128) NOT NULL,
        duplicate_of_document_id UUID REFERENCES post_visit_document_intelligence(id) ON DELETE SET NULL,
        duplicate_similarity DOUBLE PRECISION,
        extraction_status VARCHAR(20) NOT NULL DEFAULT 'processed'
          CHECK (extraction_status IN ('processed','failed','duplicate')),
        ocr_engine VARCHAR(120),
        ocr_confidence DOUBLE PRECISION,
        extracted_text TEXT,
        structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        fhir_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
        critical_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
        critical_detected BOOLEAN NOT NULL DEFAULT FALSE,
        critical_routed BOOLEAN NOT NULL DEFAULT FALSE,
        escalation_event_id UUID,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_document_intelligence
      ADD COLUMN IF NOT EXISTS duplicate_of_document_id UUID REFERENCES post_visit_document_intelligence(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS duplicate_similarity DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) NOT NULL DEFAULT 'processed'
        CHECK (extraction_status IN ('processed','failed','duplicate')),
      ADD COLUMN IF NOT EXISTS ocr_engine VARCHAR(120),
      ADD COLUMN IF NOT EXISTS ocr_confidence DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS extracted_text TEXT,
      ADD COLUMN IF NOT EXISTS structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS fhir_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS critical_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS critical_detected BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS critical_routed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS escalation_event_id UUID,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_escalation_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        thread_id UUID REFERENCES post_visit_companion_threads(id) ON DELETE SET NULL,
        message_id UUID REFERENCES post_visit_companion_messages(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open'
          CHECK (status IN ('open','acknowledged','resolved','dismissed')),
        severity VARCHAR(20) NOT NULL
          CHECK (severity IN ('low','moderate','high','critical')),
        route_target VARCHAR(20) NOT NULL
          CHECK (route_target IN ('emergency','doctor','nurse')),
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'symptom_keyword',
        trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
        signal_text TEXT,
        classification_confidence DOUBLE PRECISION,
        classification_temporality VARCHAR(20)
          CHECK (classification_temporality IN ('current','historical','unclear')),
        classification_source VARCHAR(30),
        classification_reason TEXT,
        classification_stage VARCHAR(20) NOT NULL DEFAULT 'v1',
        detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        sla_due_at TIMESTAMP WITH TIME ZONE,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolution_note TEXT,
        workflow_key VARCHAR(160),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_escalation_events
      ADD COLUMN IF NOT EXISTS classification_confidence DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS classification_temporality VARCHAR(20)
        CHECK (classification_temporality IN ('current','historical','unclear')),
      ADD COLUMN IF NOT EXISTS classification_source VARCHAR(30),
      ADD COLUMN IF NOT EXISTS classification_reason TEXT,
      ADD COLUMN IF NOT EXISTS classification_stage VARCHAR(20) NOT NULL DEFAULT 'v1'
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_intravisit_alert_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'open'
          CHECK (status IN ('open','confirmed','dismissed')),
        alert_type VARCHAR(80) NOT NULL,
        severity VARCHAR(20) NOT NULL
          CHECK (severity IN ('moderate','high','critical')),
        route_target VARCHAR(20) NOT NULL DEFAULT 'doctor'
          CHECK (route_target IN ('doctor','nurse','emergency')),
        assigned_role VARCHAR(20) NOT NULL DEFAULT 'doctor'
          CHECK (assigned_role IN ('doctor','nurse','rapid_response')),
        assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_team VARCHAR(80),
        policy_version VARCHAR(20) NOT NULL DEFAULT 'c3.v1',
        routing_rationale TEXT,
        source VARCHAR(60) NOT NULL DEFAULT 'streamed_transcript',
        transcript_offset_seconds INTEGER,
        signal_text TEXT,
        alert_message TEXT NOT NULL,
        suggested_action TEXT,
        confidence DOUBLE PRECISION,
        trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        sla_due_at TIMESTAMP WITH TIME ZONE,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
        acknowledgment_note TEXT,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolution_note TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_intravisit_alert_events
      ADD COLUMN IF NOT EXISTS route_target VARCHAR(20) NOT NULL DEFAULT 'doctor'
        CHECK (route_target IN ('doctor','nurse','emergency')),
      ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(20) NOT NULL DEFAULT 'doctor'
        CHECK (assigned_role IN ('doctor','nurse','rapid_response')),
      ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(80),
      ADD COLUMN IF NOT EXISTS policy_version VARCHAR(20) NOT NULL DEFAULT 'c3.v1',
      ADD COLUMN IF NOT EXISTS routing_rationale TEXT,
      ADD COLUMN IF NOT EXISTS source VARCHAR(60) NOT NULL DEFAULT 'streamed_transcript',
      ADD COLUMN IF NOT EXISTS transcript_offset_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS signal_text TEXT,
      ADD COLUMN IF NOT EXISTS trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS acknowledgment_note TEXT,
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS resolution_note TEXT
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_billing_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        suggestion_key VARCHAR(120) NOT NULL,
        code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('cpt','icd10')),
        code VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        justification TEXT,
        documentation_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
        documentation_score INTEGER NOT NULL DEFAULT 0,
        documentation_status VARCHAR(20) NOT NULL DEFAULT 'insufficient'
          CHECK (documentation_status IN ('sufficient','partial','insufficient')),
        status VARCHAR(20) NOT NULL DEFAULT 'proposed'
          CHECK (status IN ('proposed','approved','rejected')),
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP WITH TIME ZONE,
        approval_note TEXT,
        source VARCHAR(80) NOT NULL DEFAULT 'post_visit_billing_intelligence_v1',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, suggestion_key)
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_billing_suggestions
      ADD COLUMN IF NOT EXISTS suggestion_key VARCHAR(120),
      ADD COLUMN IF NOT EXISTS code_type VARCHAR(20),
      ADD COLUMN IF NOT EXISTS code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS justification TEXT,
      ADD COLUMN IF NOT EXISTS documentation_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS documentation_score INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS documentation_status VARCHAR(20) NOT NULL DEFAULT 'insufficient'
        CHECK (documentation_status IN ('sufficient','partial','insufficient')),
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed','approved','rejected')),
      ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS approval_note TEXT,
      ADD COLUMN IF NOT EXISTS source VARCHAR(80) NOT NULL DEFAULT 'post_visit_billing_intelligence_v1',
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_billing_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        suggestion_id UUID REFERENCES post_visit_billing_suggestions(id) ON DELETE CASCADE,
        action VARCHAR(30) NOT NULL CHECK (action IN ('generated','approved','rejected','refreshed')),
        action_by UUID REFERENCES users(id) ON DELETE SET NULL,
        action_note TEXT,
        before_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_previsit_briefs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        scheduled_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','archived')),
        brief_content JSONB NOT NULL DEFAULT '{}'::jsonb,
        follow_up_risk_score INTEGER NOT NULL DEFAULT 0,
        follow_up_risk_tier VARCHAR(20) NOT NULL DEFAULT 'low'
          CHECK (follow_up_risk_tier IN ('low','moderate','high','critical')),
        follow_up_risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
        nudge_policy VARCHAR(120),
        source VARCHAR(80) NOT NULL DEFAULT 'post_visit_previsit_brief_v1',
        generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_previsit_briefs
      ADD COLUMN IF NOT EXISTS appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','archived')),
      ADD COLUMN IF NOT EXISTS brief_content JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS follow_up_risk_score INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS follow_up_risk_tier VARCHAR(20) NOT NULL DEFAULT 'low'
        CHECK (follow_up_risk_tier IN ('low','moderate','high','critical')),
      ADD COLUMN IF NOT EXISTS follow_up_risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS nudge_policy VARCHAR(120),
      ADD COLUMN IF NOT EXISTS source VARCHAR(80) NOT NULL DEFAULT 'post_visit_previsit_brief_v1',
      ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_admin_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        document_type VARCHAR(40) NOT NULL
          CHECK (document_type IN ('referral_letter','sick_note','return_to_work')),
        version_no INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'signed'
          CHECK (status IN ('draft','signed','dispatched','voided')),
        title VARCHAR(255) NOT NULL,
        body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        immutable_hash VARCHAR(128) NOT NULL,
        signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        signed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, document_type, version_no)
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_admin_documents
      ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS document_type VARCHAR(40)
        CHECK (document_type IN ('referral_letter','sick_note','return_to_work')),
      ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'signed'
        CHECK (status IN ('draft','signed','dispatched','voided')),
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS immutable_hash VARCHAR(128),
      ADD COLUMN IF NOT EXISTS signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_trial_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        trial_source VARCHAR(40) NOT NULL DEFAULT 'clinicaltrials_gov_v2',
        trial_id VARCHAR(80) NOT NULL,
        trial_title TEXT NOT NULL,
        trial_phase VARCHAR(80),
        trial_status VARCHAR(80),
        condition_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_url TEXT,
        eligibility_score INTEGER NOT NULL DEFAULT 0,
        eligibility_rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
        match_status VARCHAR(20) NOT NULL DEFAULT 'proposed'
          CHECK (match_status IN ('proposed','considered','deferred','excluded','enrolled')),
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        review_note TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, trial_id)
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_trial_matches
      ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS trial_source VARCHAR(40) NOT NULL DEFAULT 'clinicaltrials_gov_v2',
      ADD COLUMN IF NOT EXISTS trial_id VARCHAR(80),
      ADD COLUMN IF NOT EXISTS trial_title TEXT,
      ADD COLUMN IF NOT EXISTS trial_phase VARCHAR(80),
      ADD COLUMN IF NOT EXISTS trial_status VARCHAR(80),
      ADD COLUMN IF NOT EXISTS condition_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS source_url TEXT,
      ADD COLUMN IF NOT EXISTS eligibility_score INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS eligibility_rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS match_status VARCHAR(20) NOT NULL DEFAULT 'proposed'
        CHECK (match_status IN ('proposed','considered','deferred','excluded','enrolled')),
      ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS review_note TEXT,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_trial_match_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        trial_match_id UUID NOT NULL REFERENCES post_visit_trial_matches(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        action VARCHAR(20) NOT NULL
          CHECK (action IN ('consider','defer','exclude','enroll')),
        previous_status VARCHAR(20)
          CHECK (previous_status IN ('proposed','considered','deferred','excluded','enrolled')),
        next_status VARCHAR(20) NOT NULL
          CHECK (next_status IN ('proposed','considered','deferred','excluded','enrolled')),
        note TEXT,
        acted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        acted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_trial_match_audit_log
      ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS trial_match_id UUID REFERENCES post_visit_trial_matches(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS action VARCHAR(20)
        CHECK (action IN ('consider','defer','exclude','enroll')),
      ADD COLUMN IF NOT EXISTS previous_status VARCHAR(20)
        CHECK (previous_status IN ('proposed','considered','deferred','excluded','enrolled')),
      ADD COLUMN IF NOT EXISTS next_status VARCHAR(20)
        CHECK (next_status IN ('proposed','considered','deferred','excluded','enrolled')),
      ADD COLUMN IF NOT EXISTS note TEXT,
      ADD COLUMN IF NOT EXISTS acted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS acted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_companion_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        memory_type VARCHAR(60) NOT NULL,
        memory_key VARCHAR(120) NOT NULL,
        memory_value TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        source_message_id UUID REFERENCES post_visit_companion_messages(id) ON DELETE SET NULL,
        created_by UUID,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        promoted_at TIMESTAMP WITH TIME ZONE,
        promoted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        retired_at TIMESTAMP WITH TIME ZONE,
        retired_by UUID REFERENCES users(id) ON DELETE SET NULL,
        curation_note TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`
      ALTER TABLE IF EXISTS post_visit_companion_memory
      ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS memory_type VARCHAR(60),
      ADD COLUMN IF NOT EXISTS memory_key VARCHAR(120),
      ADD COLUMN IF NOT EXISTS memory_value TEXT,
      ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES post_visit_companion_messages(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_by UUID,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS promoted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS retired_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS retired_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS curation_note TEXT,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS post_visit_companion_acknowledgements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        acknowledgement_type VARCHAR(60) NOT NULL
          CHECK (acknowledgement_type IN ('teach_back','medication_adherence','follow_up_commitment','warning_sign_understanding')),
        acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_patient_id ON post_visit_sessions(patient_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_doctor_id ON post_visit_sessions(doctor_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_status ON post_visit_sessions(status)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_started_at ON post_visit_sessions(started_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_transcript_segments_session ON post_visit_transcript_segments(session_id, segment_order)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_transcript_needs_review ON post_visit_transcript_segments(session_id, needs_review, segment_order)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_transcript_speaker_role ON post_visit_transcript_segments(session_id, speaker_role, segment_order)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_extracted_entities_session ON post_visit_extracted_entities(session_id, entity_type)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_draft_artifacts_session ON post_visit_draft_artifacts(session_id, artifact_type)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_session ON post_visit_review_actions(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_artifact ON post_visit_review_actions(artifact_type, action)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_session ON post_visit_rule_citations(session_id, rule_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_guideline ON post_visit_rule_citations(guideline_id)`);
    await tenantDb.query(`
      CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_quality
      ON post_visit_rule_citations(session_id, is_superseded, doctor_acknowledged_superseded, relevance_score DESC)
    `);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_session ON post_visit_action_executions(session_id, recommendation_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_status ON post_visit_action_executions(status, executed_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_session ON post_visit_companion_threads(session_id, status)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_patient ON post_visit_companion_threads(patient_id, last_message_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_session ON post_visit_companion_messages(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_thread ON post_visit_companion_messages(thread_id, created_at ASC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_patient ON post_visit_companion_messages(patient_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_escalation ON post_visit_companion_messages(escalation_detected, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_session ON post_visit_document_intelligence(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_hash ON post_visit_document_intelligence(session_id, file_sha256)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_critical ON post_visit_document_intelligence(session_id, critical_detected, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_session ON post_visit_escalation_events(session_id, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_status ON post_visit_escalation_events(status, severity, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_route ON post_visit_escalation_events(route_target, status, sla_due_at)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_trigger ON post_visit_escalation_events(trigger_type, status, route_target, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_patient ON post_visit_escalation_events(patient_id, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_confidence ON post_visit_escalation_events(classification_confidence DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_temporality ON post_visit_escalation_events(classification_temporality, status, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_session ON post_visit_intravisit_alert_events(session_id, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_status ON post_visit_intravisit_alert_events(status, severity, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_patient ON post_visit_intravisit_alert_events(patient_id, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_route ON post_visit_intravisit_alert_events(route_target, assigned_role, status, sla_due_at)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_ack ON post_visit_intravisit_alert_events(status, acknowledged_at, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_billing_suggestions_session ON post_visit_billing_suggestions(session_id, status, code_type, confidence DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_billing_suggestions_patient ON post_visit_billing_suggestions(patient_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_billing_suggestions_code ON post_visit_billing_suggestions(code_type, code)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_billing_audit_session ON post_visit_billing_audit_log(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_billing_audit_suggestion ON post_visit_billing_audit_log(suggestion_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_previsit_briefs_appointment ON post_visit_previsit_briefs(appointment_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_previsit_briefs_patient ON post_visit_previsit_briefs(patient_id, generated_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_previsit_briefs_doctor ON post_visit_previsit_briefs(doctor_id, generated_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_previsit_briefs_risk ON post_visit_previsit_briefs(follow_up_risk_tier, follow_up_risk_score DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_admin_documents_session ON post_visit_admin_documents(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_admin_documents_patient ON post_visit_admin_documents(patient_id, document_type, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_admin_documents_hash ON post_visit_admin_documents(immutable_hash)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_trial_matches_session ON post_visit_trial_matches(session_id, eligibility_score DESC, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_trial_matches_patient ON post_visit_trial_matches(patient_id, match_status, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_trial_matches_trial_id ON post_visit_trial_matches(trial_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_trial_audit_session ON post_visit_trial_match_audit_log(session_id, acted_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_trial_audit_match ON post_visit_trial_match_audit_log(trial_match_id, acted_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_trial_audit_actor ON post_visit_trial_match_audit_log(acted_by, acted_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_memory_patient ON post_visit_companion_memory(patient_id, is_active, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_memory_session ON post_visit_companion_memory(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_memory_key ON post_visit_companion_memory(memory_type, memory_key, is_active)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_memory_curation ON post_visit_companion_memory(patient_id, promoted_at DESC, retired_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_ack_session ON post_visit_companion_acknowledgements(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_ack_patient ON post_visit_companion_acknowledgements(patient_id, acknowledgement_type)`);
  }

  private mapSession(row: any) {
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
  }

  private mapEscalationEvent(row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      threadId: row.thread_id || null,
      messageId: row.message_id || null,
      status: row.status,
      severity: row.severity,
      routeTarget: row.route_target,
      triggerType: row.trigger_type,
      triggerTerms: row.trigger_terms || [],
      signalText: row.signal_text || null,
      classificationConfidence:
        row.classification_confidence === null || row.classification_confidence === undefined
          ? null
          : Number(row.classification_confidence),
      classificationTemporality: row.classification_temporality || null,
      classificationSource: row.classification_source || null,
      classificationReason: row.classification_reason || null,
      classificationStage: row.classification_stage || 'v1',
      detectedAt: row.detected_at,
      slaDueAt: row.sla_due_at || null,
      acknowledgedAt: row.acknowledged_at || null,
      acknowledgedBy: row.acknowledged_by || null,
      resolvedAt: row.resolved_at || null,
      resolvedBy: row.resolved_by || null,
      resolutionNote: row.resolution_note || null,
      workflowKey: row.workflow_key || null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapIntraVisitAlertEvent(row: any) {
    const acknowledgedAt = row.acknowledged_at || null;
    const slaDueAt = row.sla_due_at || null;
    const isAcknowledged = acknowledgedAt !== null;
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
        row.transcript_offset_seconds === null || row.transcript_offset_seconds === undefined
          ? null
          : Number(row.transcript_offset_seconds),
      signalText: row.signal_text || null,
      alertMessage: row.alert_message,
      suggestedAction: row.suggested_action || null,
      confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
      triggerTerms: Array.isArray(row.trigger_terms) ? row.trigger_terms : [],
      metadata: row.metadata || {},
      detectedAt: row.detected_at,
      slaDueAt,
      isAcknowledged,
      acknowledgedAt,
      acknowledgedBy: row.acknowledged_by || null,
      acknowledgmentNote: row.acknowledgment_note || null,
      resolvedAt: row.resolved_at || null,
      resolvedBy: row.resolved_by || null,
      resolutionNote: row.resolution_note || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapBillingSuggestion(row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      suggestionKey: row.suggestion_key,
      codeType: row.code_type,
      code: row.code,
      description: row.description,
      confidence:
        row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
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
  }

  private mapPreVisitBrief(row: any) {
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
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAdminDocument(row: any) {
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
  }

  private mapTrialMatch(row: any) {
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
  }

  private mapTrialMatchAuditRow(row: any) {
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
  }

  private mapCompanionMemory(row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      memoryType: row.memory_type,
      memoryKey: row.memory_key,
      memoryValue: row.memory_value,
      confidence:
        row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
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
  }

  private normalizeLanguage(language?: string | null) {
    const raw = String(language || '').trim().toLowerCase();
    if (!raw) return 'en';
    if (raw === 'english' || raw === 'eng') return 'en';
    if (raw === 'shona') return 'sn';
    if (raw === 'ndebele') return 'nd';
    return raw;
  }

  private isDiarizationReviewEnabled(): boolean {
    return String(process.env.FEATURE_POSTVISIT_DIARIZATION_REVIEW || 'false').toLowerCase() === 'true';
  }

  private getDiarizationConfidenceThreshold(): number {
    const raw = Number(process.env.POSTVISIT_DIARIZATION_MIN_CONFIDENCE || 0.65);
    if (!Number.isFinite(raw)) return 0.65;
    return Math.min(0.95, Math.max(0.2, raw));
  }

  private normalizeDiarizationConfidence(value: any): number | null {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.min(1, Math.max(0, num));
  }

  private normalizeSegmentSpeakerRole(value: any): 'doctor' | 'patient' | 'unknown' {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'unknown';
    if (['doctor', 'dr', 'clinician', 'provider'].includes(normalized)) return 'doctor';
    if (['patient', 'pt', 'client'].includes(normalized)) return 'patient';
    return 'unknown';
  }

  private isCitationQualityV2Enabled(): boolean {
    return String(process.env.FEATURE_POSTVISIT_CITATION_QUALITY_V2 || 'false').toLowerCase() === 'true';
  }

  private getCitationRelevanceThreshold(): number {
    const raw = Number(process.env.POSTVISIT_CITATION_MIN_RELEVANCE || 0.55);
    if (!Number.isFinite(raw)) return 0.55;
    return Math.min(0.95, Math.max(0.2, raw));
  }

  private normalizeCitationRelevanceScore(value: any): number | null {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.min(1, Math.max(0, num));
  }

  private extractGuidelineYear(guidelineId?: string | null): number | null {
    const source = String(guidelineId || '');
    const match = source.match(/(19|20)\d{2}/);
    if (!match) return null;
    const year = Number(match[0]);
    if (!Number.isFinite(year)) return null;
    return year;
  }

  private isPostVisitOcrEnabled(): boolean {
    return String(process.env.FEATURE_POSTVISIT_OCR_INTELLIGENCE || 'false').toLowerCase() === 'true';
  }

  private isMedicationIntelligenceV2Enabled(): boolean {
    return String(process.env.FEATURE_POSTVISIT_MEDICATION_INTELLIGENCE_V2 || 'false').toLowerCase() === 'true';
  }

  private isSpecialtySoapEnabled(): boolean {
    return String(process.env.FEATURE_POSTVISIT_SPECIALTY_SOAP || 'false').toLowerCase() === 'true';
  }

  private isMultilingualTeachBackEnabled(): boolean {
    return String(process.env.FEATURE_POSTVISIT_MULTILINGUAL_TEACHBACK || 'false').toLowerCase() === 'true';
  }

  private isIntraVisitAlertsEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitIntraVisitAlerts;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_INTRAVISIT_ALERTS || 'false').toLowerCase() === 'true';
  }

  private isBillingIntelligenceEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitBillingIntelligence;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE || 'false').toLowerCase() === 'true';
  }

  private isPreVisitBriefEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitPreVisitBrief;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_PREVISIT_BRIEF || 'false').toLowerCase() === 'true';
  }

  private isAdminDocumentsEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitAdminDocuments;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_ADMIN_DOCS || 'false').toLowerCase() === 'true';
  }

  private isVoiceReviewEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitVoiceReview;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_VOICE_REVIEW || 'false').toLowerCase() === 'true';
  }

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

  private isCompanionMemoryEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitCompanionMemory;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_COMPANION_MEMORY || 'true').toLowerCase() !== 'false';
  }

  private resolveClinicalTrialsApiUrl(): string {
    const direct = String(process.env.POSTVISIT_CLINICALTRIALS_API_URL || '').trim();
    if (direct) return direct;
    return 'https://clinicaltrials.gov/api/v2/studies';
  }

  private getTrialDecisionSlaHours(): number {
    const configured = Number((config as any)?.features?.postVisitTrialDecisionSlaHours);
    const raw = Number.isFinite(configured)
      ? configured
      : Number(process.env.POSTVISIT_TRIAL_DECISION_SLA_HOURS || '72');
    if (!Number.isFinite(raw)) return 72;
    return Math.min(Math.max(Math.round(raw), 1), 24 * 30);
  }

  private getTrialDecisionEscalationRouteTarget(): 'doctor' | 'nurse' {
    const configuredValue = (config as any)?.features?.postVisitTrialDecisionEscalationRoute;
    const configured = String(configuredValue || process.env.POSTVISIT_TRIAL_DECISION_ESCALATION_ROUTE || 'doctor')
      .trim()
      .toLowerCase();
    if (configured === 'nurse') return 'nurse';
    return 'doctor';
  }

  private getTrialSlaEmailMinSeverity(): TrialSlaNotificationSeverity {
    const configuredValue = (config as any)?.features?.postVisitTrialSlaEmailMinSeverity;
    const normalized = String(configuredValue || process.env.POSTVISIT_TRIAL_SLA_EMAIL_MIN_SEVERITY || 'high')
      .trim()
      .toLowerCase();
    if (normalized === 'moderate' || normalized === 'critical') return normalized;
    return 'high';
  }

  private getTrialSlaSmsMinSeverity(): TrialSlaNotificationSeverity {
    const configuredValue = (config as any)?.features?.postVisitTrialSlaSmsMinSeverity;
    const normalized = String(configuredValue || process.env.POSTVISIT_TRIAL_SLA_SMS_MIN_SEVERITY || 'critical')
      .trim()
      .toLowerCase();
    if (normalized === 'moderate' || normalized === 'high') return normalized;
    return 'critical';
  }

  private getTrialSlaMaxRecipients(): number {
    const configuredValue = Number((config as any)?.features?.postVisitTrialSlaNotifyMaxRecipients);
    const raw = Number.isFinite(configuredValue)
      ? configuredValue
      : Number(process.env.POSTVISIT_TRIAL_SLA_NOTIFY_MAX_RECIPIENTS || '3');
    if (!Number.isFinite(raw)) return 3;
    return Math.min(Math.max(Math.round(raw), 1), 20);
  }

  private severityRank(severity: PostVisitEscalationSeverity | TrialSlaNotificationSeverity): number {
    if (severity === 'critical') return 4;
    if (severity === 'high') return 3;
    if (severity === 'moderate') return 2;
    return 1;
  }

  private isSeverityAtLeast(
    severity: PostVisitEscalationSeverity | TrialSlaNotificationSeverity,
    threshold: TrialSlaNotificationSeverity,
  ): boolean {
    return this.severityRank(severity) >= this.severityRank(threshold);
  }

  private computeTrialDecisionAgeHours(createdAt: any, reviewedAt: any): number {
    const reference = reviewedAt || createdAt;
    const parsed = new Date(reference);
    if (Number.isNaN(parsed.getTime())) return 0;
    return Math.max(0, (Date.now() - parsed.getTime()) / (1000 * 60 * 60));
  }

  private normalizeVoiceCommand(input?: string | null): PostVisitVoiceCommand | null {
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
  }

  private resolveFollowUpRiskTier(score: number): PostVisitFollowUpRiskTier {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'moderate';
    return 'low';
  }

  private resolveNudgePolicyForRiskTier(tier: PostVisitFollowUpRiskTier): string {
    if (tier === 'critical') return 'immediate_clinician_outreach';
    if (tier === 'high') return 'same_day_nurse_followup';
    if (tier === 'moderate') return 'next_day_companion_nudge';
    return 'routine_weekly_checkin';
  }

  private resolveLocalOcrUrl(): string {
    const direct = String(process.env.LOCAL_OCR_URL || config.ai?.ocr?.localUrl || '').trim();
    if (direct) {
      return direct.replace(/\/+$/, '');
    }
    return '';
  }

  private getLocalOcrTimeoutMs(): number {
    const raw = Number(process.env.POSTVISIT_OCR_TIMEOUT_MS || 120000);
    if (!Number.isFinite(raw)) return 120000;
    return Math.min(300000, Math.max(5000, raw));
  }

  private hashFile(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private normalizeDocumentText(text: string): string {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s./%-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private computeDocumentSimilarity(leftRaw: string, rightRaw: string): number {
    const left = this.normalizeDocumentText(leftRaw);
    const right = this.normalizeDocumentText(rightRaw);
    if (!left || !right) return 0;
    if (left === right) return 1;

    const leftTokens = new Set(left.split(/\s+/).filter((token) => token.length > 1));
    const rightTokens = new Set(right.split(/\s+/).filter((token) => token.length > 1));
    if (!leftTokens.size || !rightTokens.size) return 0;

    let overlap = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) overlap += 1;
    }
    const union = leftTokens.size + rightTokens.size - overlap;
    if (union <= 0) return 0;
    return overlap / union;
  }

  private normalizeDocumentType(type?: string): PostVisitDocumentType {
    const normalized = String(type || '').trim().toLowerCase();
    if (['lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'other'].includes(normalized)) {
      return normalized as PostVisitDocumentType;
    }
    return 'other';
  }

  private parseDocumentIntelligenceFromText(
    text: string,
    documentType: PostVisitDocumentType,
  ): PostVisitDocumentIntelligenceModel {
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
  }

  private mapDocumentIntelligenceToFhir(
    sessionRow: any,
    documentId: string,
    model: PostVisitDocumentIntelligenceModel,
  ): any[] {
    const encounterRef = `Encounter/post-visit-${sessionRow.id}`;
    const patientRef = `Patient/${sessionRow.patient_id}`;
    const effectiveDate = this.toIsoDate(new Date());

    const observationResources = model.observations.map((observation, index) => ({
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
      referenceRange: observation.referenceRange
        ? [
            {
              text: observation.referenceRange,
            },
          ]
        : undefined,
    }));

    const medicationResources = model.medications.map((medication, index) => ({
      resourceType: 'MedicationRequest',
      id: `post-visit-docmed-${this.safeToken(documentId)}-${index + 1}`,
      status: 'active',
      intent: 'order',
      subject: { reference: patientRef },
      encounter: { reference: encounterRef },
      authoredOn: effectiveDate,
      medicationCodeableConcept: {
        text: medication.medicationName,
      },
      dosageInstruction: [
        {
          text: [medication.dose, medication.frequency].filter(Boolean).join(' ').trim(),
        },
      ],
    }));

    const diagnosticReportResource = {
      resourceType: 'DiagnosticReport',
      id: `post-visit-docreport-${this.safeToken(documentId)}`,
      status: 'final',
      code: {
        text: `${model.documentType.replace(/_/g, ' ')} intelligence extract`,
      },
      subject: {
        reference: patientRef,
      },
      encounter: {
        reference: encounterRef,
      },
      effectiveDateTime: effectiveDate,
      issued: effectiveDate,
      conclusion: model.findings.join('; ') || model.summary.slice(0, 500),
      result: observationResources.map((observation) => ({
        reference: `Observation/${observation.id}`,
      })),
    };

    return [...observationResources, ...medicationResources, diagnosticReportResource];
  }

  private detectCriticalDocumentFlags(model: PostVisitDocumentIntelligenceModel): PostVisitDocumentCriticalFlag[] {
    const flags: PostVisitDocumentCriticalFlag[] = [];
    const thresholds: Array<{
      code: string;
      label: string;
      matcher: RegExp;
      criticalHigh?: number;
      criticalLow?: number;
      highHigh?: number;
      highLow?: number;
      unit?: string;
    }> = [
      {
        code: 'potassium',
        label: 'Potassium critical',
        matcher: /potassium|k\+/i,
        criticalHigh: 6.0,
        criticalLow: 2.8,
        highHigh: 5.5,
        highLow: 3.0,
        unit: 'mmol/L',
      },
      {
        code: 'glucose',
        label: 'Glucose critical',
        matcher: /glucose|blood sugar/i,
        criticalHigh: 22.0,
        criticalLow: 2.5,
        highHigh: 16.0,
        highLow: 3.0,
        unit: 'mmol/L',
      },
      {
        code: 'hemoglobin',
        label: 'Hemoglobin critical',
        matcher: /hemoglobin|haemoglobin|hb/i,
        criticalLow: 6.5,
        highLow: 7.5,
        unit: 'g/dL',
      },
    ];

    for (const observation of model.observations) {
      const name = String(observation.name || '');
      const value = Number(observation.value);
      if (!Number.isFinite(value)) continue;
      for (const threshold of thresholds) {
        if (!threshold.matcher.test(name)) continue;
        if (threshold.criticalHigh !== undefined && value >= threshold.criticalHigh) {
          flags.push({
            code: threshold.code,
            label: threshold.label,
            severity: 'critical',
            value,
            unit: observation.unit || threshold.unit || null,
            threshold: `>= ${threshold.criticalHigh}`,
          });
          continue;
        }
        if (threshold.criticalLow !== undefined && value <= threshold.criticalLow) {
          flags.push({
            code: threshold.code,
            label: threshold.label,
            severity: 'critical',
            value,
            unit: observation.unit || threshold.unit || null,
            threshold: `<= ${threshold.criticalLow}`,
          });
          continue;
        }
        if (threshold.highHigh !== undefined && value >= threshold.highHigh) {
          flags.push({
            code: threshold.code,
            label: threshold.label,
            severity: 'high',
            value,
            unit: observation.unit || threshold.unit || null,
            threshold: `>= ${threshold.highHigh}`,
          });
          continue;
        }
        if (threshold.highLow !== undefined && value <= threshold.highLow) {
          flags.push({
            code: threshold.code,
            label: threshold.label,
            severity: 'high',
            value,
            unit: observation.unit || threshold.unit || null,
            threshold: `<= ${threshold.highLow}`,
          });
        }
      }
    }

    return flags;
  }

  private splitIntoPhrases(value?: string) {
    const text = String(value || '').trim();
    if (!text || text.toLowerCase() === 'not provided') {
      return [];
    }
    return text
      .split(/[\n.;]+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  private parseBloodPressure(bp?: string | null) {
    const raw = String(bp || '').trim();
    const match = raw.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!match) return null;
    return {
      systolic: Number(match[1]),
      diastolic: Number(match[2]),
    };
  }

  private parseNumericValue(value: any): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const numeric = Number(match[0]);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private normalizeMedicationToken(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\b\d+(?:\.\d+)?\s?(mg|mcg|g|ml|iu|units?)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private splitMedicationTextList(value: string): string[] {
    const raw = String(value || '').trim();
    if (!raw) return [];
    return raw
      .split(/[,\n;|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private getMedicationSeverityRank(severity: MedicationRiskSeverity | 'major' | 'moderate' | null | undefined): number {
    if (severity === 'contraindicated') return 4;
    if (severity === 'major') return 3;
    if (severity === 'moderate') return 2;
    if (severity === 'minor') return 1;
    return 0;
  }

  private inferMedicationNormalization(inputName: string): MedicationNormalizationRecord {
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
      { token: 'sildenafil', normalizedName: 'sildenafil', rxCui: '136411' },
      { token: 'nitroglycerin', normalizedName: 'nitroglycerin', rxCui: '4917' },
      { token: 'diazepam', normalizedName: 'diazepam', rxCui: '3322' },
      { token: 'diphenhydramine', normalizedName: 'diphenhydramine', rxCui: '3498' },
      { token: 'amitriptyline', normalizedName: 'amitriptyline', rxCui: '704' },
      { token: 'zolpidem', normalizedName: 'zolpidem', rxCui: '39993' },
      { token: 'nitrofurantoin', normalizedName: 'nitrofurantoin', rxCui: '7454' },
      { token: 'enoxaparin', normalizedName: 'enoxaparin', rxCui: '67108' },
    ];

    const dictionaryHit = dictionary.find((entry) => normalizedInput.includes(entry.token));
    if (dictionaryHit) {
      return {
        inputName,
        normalizedName: dictionaryHit.normalizedName,
        rxCui: dictionaryHit.rxCui,
        source: 'rxnorm_dictionary',
      };
    }

    const fallbackToken = normalizedInput.split(/\s+/)[0] || normalizedInput;
    return {
      inputName,
      normalizedName: fallbackToken || normalizedInput || 'unknown_medication',
      rxCui: null,
      source: fallbackToken ? 'heuristic' : 'unknown',
    };
  }

  private extractEstimatedEgfr(patientContext: any, extractedEntities: any[]): number | null {
    const entityHit = extractedEntities.find((entity: any) => {
      const type = String(entity?.entity_type || entity?.type || '').toLowerCase();
      const value = String(entity?.entity_value || entity?.value || '').toLowerCase();
      return type.includes('egfr') || /e\s*gfr|glomerular/i.test(value);
    });
    const entityEgfr = this.parseNumericValue(entityHit?.entity_value || entityHit?.value);
    if (entityEgfr !== null) return entityEgfr;

    const labAlert = patientContext?.modules?.lab?.latestCriticalAlert;
    const componentName = String(labAlert?.component_name || '').toLowerCase();
    if (componentName.includes('egfr') || componentName.includes('glomerular')) {
      const alertEgfr = this.parseNumericValue(labAlert?.result_value);
      if (alertEgfr !== null) return alertEgfr;
    }

    return null;
  }

  private buildMedicationIntelligenceAssessment(
    patientContext: any,
    extractedEntities: any[],
  ): MedicationIntelligenceAssessment {
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

    const modules = patientContext?.modules || {};
    const age = Number(patientContext?.patient?.age || 0);
    const medicationCandidates: string[] = [];
    const pushCandidate = (value?: any) => {
      const text = String(value || '').trim();
      if (!text) return;
      medicationCandidates.push(text);
    };

    const latestPrescription = modules?.pharmacy?.latestPrescription;
    pushCandidate(latestPrescription?.medication_name);
    pushCandidate(latestPrescription?.generic_name);

    const edCurrentMedications = this.splitMedicationTextList(modules?.ed?.latestVisit?.current_medications || '');
    for (const med of edCurrentMedications) {
      pushCandidate(med);
    }

    pushCandidate(modules?.hiv?.latestEnrollment?.current_regimen);
    pushCandidate(modules?.hiv?.latestClinicalVisit?.arv_regimen_name);

    for (const entity of extractedEntities) {
      const entityType = String(entity?.entity_type || entity?.type || '').toLowerCase();
      const entityValue = String(entity?.entity_value || entity?.value || '').trim();
      if (!entityValue) continue;
      if (entityType.includes('medication') || entityType.includes('drug') || /\b\d+(?:\.\d+)?\s?(mg|mcg|g|ml|iu)\b/i.test(entityValue)) {
        pushCandidate(entityValue);
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

    const interactionCatalog: MedicationInteractionSignal[] = [
      {
        pair: ['sildenafil', 'nitroglycerin'],
        severity: 'contraindicated',
        rationale: 'Concurrent PDE5 inhibitors and nitrates can cause profound hypotension.',
        guidelineId: 'fda-drug-safety-pde5-nitrates',
      },
      {
        pair: ['clarithromycin', 'simvastatin'],
        severity: 'major',
        rationale: 'Clarithromycin increases simvastatin concentration and myopathy risk.',
        guidelineId: 'fda-simvastatin-drug-interaction-safety',
      },
      {
        pair: ['warfarin', 'aspirin'],
        severity: 'major',
        rationale: 'Dual anticoagulant/antiplatelet exposure increases bleeding risk.',
        guidelineId: 'acc-antithrombotic-bleeding-risk',
      },
      {
        pair: ['spironolactone', 'lisinopril'],
        severity: 'major',
        rationale: 'Combined RAAS/potassium-sparing therapy increases hyperkalemia risk.',
        guidelineId: 'kdigo-hyperkalemia-management',
      },
    ];

    const interactions = interactionCatalog.filter(
      (item) => normalizedMedicationSet.has(item.pair[0]) && normalizedMedicationSet.has(item.pair[1]),
    );

    const beersCatalog: Array<{ medication: string; severity: 'major' | 'moderate'; rationale: string }> = [
      { medication: 'diphenhydramine', severity: 'major', rationale: 'High anticholinergic burden in older adults.' },
      { medication: 'amitriptyline', severity: 'major', rationale: 'Strong anticholinergic and orthostatic hypotension risk.' },
      { medication: 'diazepam', severity: 'major', rationale: 'Long-acting benzodiazepine with fall/cognitive risk.' },
      { medication: 'zolpidem', severity: 'moderate', rationale: 'Sedative-hypnotic with confusion/fall risk in age 65+.' },
    ];
    const beersAlerts: MedicationBeersSignal[] =
      age >= 65
        ? beersCatalog.filter((item) => normalizedMedicationSet.has(item.medication))
        : [];

    const egfr = this.extractEstimatedEgfr(patientContext, extractedEntities);
    const renalAlerts: MedicationRenalSignal[] = [];
    if (egfr !== null) {
      const pushRenalAlert = (
        medication: string,
        severity: 'major' | 'moderate',
        rationale: string,
      ) => {
        if (!normalizedMedicationSet.has(medication)) return;
        renalAlerts.push({ medication, severity, rationale, egfr });
      };

      if (egfr < 30) {
        pushRenalAlert('metformin', 'major', 'Metformin should generally be avoided when eGFR is below 30 mL/min.');
        pushRenalAlert('nitrofurantoin', 'major', 'Nitrofurantoin efficacy/safety is reduced in severe renal impairment.');
        pushRenalAlert('enoxaparin', 'major', 'Enoxaparin dosing requires major adjustment when eGFR is below 30.');
      } else if (egfr < 45) {
        pushRenalAlert('metformin', 'moderate', 'Metformin dose reduction and closer monitoring are recommended when eGFR < 45.');
      }
      if (egfr < 60) {
        pushRenalAlert('gabapentin', 'moderate', 'Gabapentin dose review is recommended when eGFR < 60.');
      }
      if (egfr < 50) {
        pushRenalAlert('rivaroxaban', 'major', 'Rivaroxaban renal-dose review is required when eGFR < 50.');
      }
    }

    let highestSeverity: MedicationRiskSeverity | null = null;
    for (const interaction of interactions) {
      if (!highestSeverity || this.getMedicationSeverityRank(interaction.severity) > this.getMedicationSeverityRank(highestSeverity)) {
        highestSeverity = interaction.severity;
      }
    }
    for (const beers of beersAlerts) {
      if (!highestSeverity || this.getMedicationSeverityRank(beers.severity) > this.getMedicationSeverityRank(highestSeverity)) {
        highestSeverity = beers.severity;
      }
    }
    for (const renal of renalAlerts) {
      if (!highestSeverity || this.getMedicationSeverityRank(renal.severity) > this.getMedicationSeverityRank(highestSeverity)) {
        highestSeverity = renal.severity;
      }
    }

    const highRiskCount =
      interactions.filter((item) => ['contraindicated', 'major'].includes(item.severity)).length +
      beersAlerts.filter((item) => item.severity === 'major').length +
      renalAlerts.filter((item) => item.severity === 'major').length;

    const narrativeParts: string[] = [];
    if (medications.length > 0) {
      const mappedCount = medications.filter((item) => item.rxCui).length;
      narrativeParts.push(`${medications.length} medication signal(s) identified (${mappedCount} RxNorm mapped).`);
    }
    if (interactions.length > 0) {
      narrativeParts.push(
        `Interaction alerts: ${interactions
          .map((item) => `${item.pair[0]} + ${item.pair[1]} (${item.severity})`)
          .join('; ')}.`,
      );
    }
    if (beersAlerts.length > 0) {
      narrativeParts.push(`Beers age-65+ alerts: ${beersAlerts.map((item) => `${item.medication} (${item.severity})`).join('; ')}.`);
    }
    if (renalAlerts.length > 0 && egfr !== null) {
      narrativeParts.push(
        `Renal dosing alerts at eGFR ${egfr}: ${renalAlerts.map((item) => `${item.medication} (${item.severity})`).join('; ')}.`,
      );
    } else if (egfr !== null) {
      narrativeParts.push(`eGFR ${egfr} reviewed with no deterministic renal dosing flags.`);
    }
    if (narrativeParts.length === 0) {
      narrativeParts.push('No medication safety signals were found from available context.');
    }

    return {
      enabled: true,
      medications,
      interactions,
      beersAlerts,
      renalAlerts,
      highestSeverity,
      highRiskCount,
      egfr,
      riskNarrative: narrativeParts.join(' ').slice(0, 1200),
    };
  }

  private extractEntitiesFromTranscription(result: TranscriptionResult): ExtractedEntityInput[] {
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
          normalizedValue: {
            systolic: Number(bpMatch[1]),
            diastolic: Number(bpMatch[2]),
            unit: 'mmHg',
          },
          confidence,
          sourceOrigin: 'transcript',
        });
      }

      const heartRateMatch = transcriptionText.match(/\b(?:heart rate|hr)\s*(?:is|of)?\s*(\d{2,3})\b/i);
      if (heartRateMatch) {
        entities.push({
          entityType: 'vital_heart_rate',
          entityValue: heartRateMatch[1],
          normalizedValue: {
            value: Number(heartRateMatch[1]),
            unit: 'bpm',
          },
          confidence,
          sourceOrigin: 'transcript',
        });
      }
    }

    return entities;
  }

  private async getSessionRow(tenantDb: DataSource, sessionId: string) {
    const rows = await tenantDb.query(`SELECT * FROM post_visit_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
    if (!rows?.length) {
      throw new NotFoundException('Post-visit session not found');
    }
    return rows[0];
  }

  private async getArtifactRow(tenantDb: DataSource, sessionId: string, artifactType: string) {
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
  }

  private assertPatientSessionAccess(sessionRow: any, patientId: string) {
    if (String(sessionRow.patient_id) !== String(patientId)) {
      throw new ForbiddenException('You do not have access to this post-visit session');
    }
  }

  private assertPatientCompanionAccessAllowed(sessionRow: any) {
    const status = String(sessionRow.status || '').toLowerCase();
    if (!['published', 'closed'].includes(status)) {
      throw new ForbiddenException('Post-visit session is not yet published for patient companion access');
    }
  }

  private async ensureCompanionThread(
    tenantDb: DataSource,
    sessionRow: any,
    createdBy: string | null,
  ) {
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
      [sessionRow.id, sessionRow.patient_id, createdBy],
    );
    return rows[0];
  }

  private isEscalationConfidenceV2Enabled(): boolean {
    return String(process.env.FEATURE_POSTVISIT_ESCALATION_CONFIDENCE || 'false').toLowerCase() === 'true';
  }

  private buildEscalationPrefilter(message: string): EscalationPrefilterResult {
    const text = String(message || '').toLowerCase().trim();
    const criticalTerms = [
      'chest pain',
      'shortness of breath',
      'difficulty breathing',
      'cannot breathe',
      'suicidal',
      'seizure',
      'stroke',
      'fainted',
      'fainting',
      'heavy bleeding',
      'vomiting blood',
      'coughing blood',
    ];
    const highTerms = [
      'severe headache',
      'vision loss',
      'confusion',
      'high fever',
      'very dizzy',
      'palpitations',
      'worsening pain',
      'severe pain',
      'passed out',
    ];
    const moderateTerms = [
      'dizziness',
      'nausea',
      'vomiting',
      'swelling',
      'rash',
      'side effects',
      'medication reaction',
      'mild pain',
      'headache',
    ];

    const matched = (terms: string[]) => terms.filter((term) => text.includes(term));
    const criticalMatches = matched(criticalTerms);
    if (criticalMatches.length) {
      return {
        matched: true,
        text,
        candidateSeverity: 'critical',
        routeTarget: 'emergency',
        triggerTerms: criticalMatches,
        triggerType: 'symptom_keyword',
      };
    }

    const highMatches = matched(highTerms);
    if (highMatches.length) {
      return {
        matched: true,
        text,
        candidateSeverity: 'high',
        routeTarget: 'doctor',
        triggerTerms: highMatches,
        triggerType: 'symptom_keyword',
      };
    }

    const moderateMatches = matched(moderateTerms);
    if (moderateMatches.length) {
      return {
        matched: true,
        text,
        candidateSeverity: 'moderate',
        routeTarget: 'nurse',
        triggerTerms: moderateMatches,
        triggerType: 'symptom_keyword',
      };
    }

    return {
      matched: false,
      text,
      candidateSeverity: 'low',
      routeTarget: 'nurse',
      triggerTerms: [],
      triggerType: 'none',
    };
  }

  private inferTemporalityFromText(text: string): 'current' | 'historical' | 'unclear' {
    const normalized = String(text || '').toLowerCase();
    if (!normalized) return 'unclear';
    if (
      normalized.includes('right now') ||
      normalized.includes('currently') ||
      normalized.includes('at the moment') ||
      normalized.includes('today') ||
      normalized.includes('now ')
    ) {
      return 'current';
    }
    if (
      normalized.includes('last week') ||
      normalized.includes('last month') ||
      normalized.includes('yesterday') ||
      normalized.includes('previously') ||
      normalized.includes('used to')
    ) {
      return 'historical';
    }
    return 'unclear';
  }

  private getEscalationConfidenceThreshold(severity: 'low' | 'moderate' | 'high' | 'critical'): number {
    if (severity === 'critical') return 0.85;
    if (severity === 'high') return 0.7;
    if (severity === 'moderate') return 0.55;
    return 0.5;
  }

  private getSlaMinutesForSeverity(severity: 'low' | 'moderate' | 'high' | 'critical'): number {
    if (severity === 'critical') return 15;
    if (severity === 'high') return 60;
    if (severity === 'moderate') return 240;
    return 0;
  }

  private normalizeIntraVisitAlertSource(source?: string): string {
    const normalized = String(source || '').trim().toLowerCase();
    if (!normalized) return 'streamed_transcript';
    return normalized.slice(0, 60);
  }

  private normalizeIntraVisitTranscriptOffset(value?: number): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.floor(numeric));
  }

  private collectMatchingTerms(text: string, terms: string[]): string[] {
    const matches: string[] = [];
    for (const term of terms) {
      if (text.includes(term)) {
        matches.push(term);
      }
    }
    return matches;
  }

  private getIntraVisitSeverityRank(severity: IntraVisitAlertSeverity): number {
    if (severity === 'critical') return 3;
    if (severity === 'high') return 2;
    return 1;
  }

  private getIntraVisitSlaMinutes(severity: IntraVisitAlertSeverity): number {
    const defaults: Record<IntraVisitAlertSeverity, number> = {
      critical: 5,
      high: 20,
      moderate: 60,
    };
    const envMap: Record<IntraVisitAlertSeverity, string | undefined> = {
      critical: process.env.POSTVISIT_INTRAVISIT_SLA_CRITICAL_MINUTES,
      high: process.env.POSTVISIT_INTRAVISIT_SLA_HIGH_MINUTES,
      moderate: process.env.POSTVISIT_INTRAVISIT_SLA_MODERATE_MINUTES,
    };
    const raw = Number(envMap[severity]);
    if (!Number.isFinite(raw)) return defaults[severity];
    return Math.max(1, Math.min(24 * 60, Math.floor(raw)));
  }

  private async findLatestActiveClinician(
    tenantDb: DataSource,
    roles: Array<'doctor' | 'nurse' | 'nurse_accounts'>,
    preferredUserId?: string | null,
  ): Promise<{ id: string; role: IntraVisitAlertAssignedRole } | null> {
    if (preferredUserId) {
      const preferredRows = await tenantDb.query(
        `
          SELECT id, role
          FROM users
          WHERE id = $1
            AND is_active = true
          LIMIT 1
        `,
        [preferredUserId],
      );
      const preferred = preferredRows?.[0];
      const preferredRole = String(preferred?.role || '').toLowerCase();
      if (preferred?.id && roles.includes(preferredRole as 'doctor' | 'nurse' | 'nurse_accounts')) {
        return {
          id: preferred.id,
          role: preferredRole === 'doctor' ? 'doctor' : 'nurse',
        };
      }
    }

    const rows = await tenantDb.query(
      `
        SELECT id, role
        FROM users
        WHERE role = ANY($1::text[])
          AND is_active = true
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `,
      [roles],
    );
    const row = rows?.[0];
    if (!row?.id) return null;
    const rowRole = String(row.role || '').toLowerCase();
    return {
      id: row.id,
      role: rowRole === 'doctor' ? 'doctor' : 'nurse',
    };
  }

  private async resolveIntraVisitRoutingDecision(
    tenantDb: DataSource,
    sessionRow: any,
    alertDraft: IntraVisitAlertDraft,
  ): Promise<IntraVisitRoutingDecision> {
    const emergencyAlertTypes = new Set<string>([
      'cardiorespiratory_emergency_signal',
      'critical_hypoxia_signal',
      'hypertensive_crisis_signal',
    ]);

    const severity = alertDraft.severity;
    const routeTarget: IntraVisitAlertRouteTarget =
      emergencyAlertTypes.has(alertDraft.alertType)
        ? 'emergency'
        : severity === 'critical' || severity === 'high'
          ? 'doctor'
          : 'nurse';

    const slaMinutes = this.getIntraVisitSlaMinutes(severity);
    const slaDueAt = new Date(Date.now() + slaMinutes * 60 * 1000);

    if (routeTarget === 'emergency') {
      const emergencyAssignee = await this.findLatestActiveClinician(
        tenantDb,
        ['doctor', 'nurse', 'nurse_accounts'],
        sessionRow?.doctor_id || null,
      );
      return {
        routeTarget,
        assignedRole: emergencyAssignee ? emergencyAssignee.role : 'rapid_response',
        assignedUserId: emergencyAssignee?.id || null,
        assignedTeam: 'Emergency Response',
        routingRationale:
          'Critical emergency-pattern signal detected; routed to rapid response path with immediate acknowledgement SLA.',
        policyVersion: 'c3.v1',
        slaDueAt,
      };
    }

    if (routeTarget === 'doctor') {
      const doctorAssignee = await this.findLatestActiveClinician(tenantDb, ['doctor'], sessionRow?.doctor_id || null);
      return {
        routeTarget,
        assignedRole: 'doctor',
        assignedUserId: doctorAssignee?.id || null,
        assignedTeam: 'Doctor Primary',
        routingRationale:
          severity === 'critical'
            ? 'Critical non-emergency signal routed to responsible doctor for immediate confirmation.'
            : 'High-severity signal routed to responsible doctor for expedited review.',
        policyVersion: 'c3.v1',
        slaDueAt,
      };
    }

    const nurseAssignee = await this.findLatestActiveClinician(tenantDb, ['nurse', 'nurse_accounts'], null);
    return {
      routeTarget: 'nurse',
      assignedRole: 'nurse',
      assignedUserId: nurseAssignee?.id || null,
      assignedTeam: 'Nurse Triage',
      routingRationale: 'Moderate-severity signal routed to nurse triage with acknowledgement SLA.',
      policyVersion: 'c3.v1',
      slaDueAt,
    };
  }

  private dedupeIntraVisitAlertDrafts(items: IntraVisitAlertDraft[]): IntraVisitAlertDraft[] {
    const byType = new Map<string, IntraVisitAlertDraft>();
    for (const item of items) {
      const existing = byType.get(item.alertType);
      if (!existing) {
        byType.set(item.alertType, item);
        continue;
      }
      const nextRank = this.getIntraVisitSeverityRank(item.severity);
      const currentRank = this.getIntraVisitSeverityRank(existing.severity);
      if (nextRank > currentRank || (nextRank === currentRank && item.confidence > existing.confidence)) {
        byType.set(item.alertType, item);
      }
    }
    return Array.from(byType.values()).sort((left, right) => {
      const severityDelta = this.getIntraVisitSeverityRank(right.severity) - this.getIntraVisitSeverityRank(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return right.confidence - left.confidence;
    });
  }

  private detectIntraVisitAlertDrafts(text: string): IntraVisitAlertDraft[] {
    const normalized = String(text || '').toLowerCase();
    if (!normalized.trim()) return [];
    const drafts: IntraVisitAlertDraft[] = [];

    const cardiorespiratoryTerms = [
      'chest pain',
      'shortness of breath',
      'difficulty breathing',
      'cannot breathe',
      'can not breathe',
      'fainted',
      'passed out',
      'seizure',
    ];
    const cardiorespiratoryMatches = this.collectMatchingTerms(normalized, cardiorespiratoryTerms);
    if (cardiorespiratoryMatches.length > 0) {
      drafts.push({
        alertType: 'cardiorespiratory_emergency_signal',
        severity: 'critical',
        alertMessage: 'Potential cardiorespiratory emergency signal detected in live transcript.',
        suggestedAction: 'Pause routine flow and activate emergency response pathway with immediate vital reassessment.',
        confidence: 0.94,
        triggerTerms: cardiorespiratoryMatches.slice(0, 8),
        metadata: {
          detection: 'keyword_bundle_v1',
        },
      });
    }

    const behavioralTerms = ['suicidal', 'suicide', 'self harm', 'self-harm', 'overdose', 'kill myself'];
    const behavioralMatches = this.collectMatchingTerms(normalized, behavioralTerms);
    if (behavioralMatches.length > 0) {
      drafts.push({
        alertType: 'acute_behavioral_safety_signal',
        severity: 'critical',
        alertMessage: 'Acute behavioral safety risk phrase detected.',
        suggestedAction: 'Initiate safety protocol, keep patient supervised, and escalate to urgent behavioral response.',
        confidence: 0.92,
        triggerTerms: behavioralMatches.slice(0, 8),
        metadata: {
          detection: 'keyword_bundle_v1',
        },
      });
    }

    const medicationReactionTerms = ['allergic reaction', 'rash after', 'swelling lips', 'swollen tongue', 'medication reaction'];
    const medicationReactionMatches = this.collectMatchingTerms(normalized, medicationReactionTerms);
    if (medicationReactionMatches.length > 0) {
      drafts.push({
        alertType: 'acute_medication_reaction_signal',
        severity: 'high',
        alertMessage: 'Possible acute medication reaction detected.',
        suggestedAction: 'Review recent medication exposure immediately and trigger urgent allergy/adverse reaction assessment.',
        confidence: 0.84,
        triggerTerms: medicationReactionMatches.slice(0, 8),
        metadata: {
          detection: 'keyword_bundle_v1',
        },
      });
    }

    const painScoreMatch = normalized.match(/(?:pain\s*(?:score)?\s*[:=]?\s*)(10|[8-9])\s*(?:\/\s*10)?/i);
    if (painScoreMatch) {
      drafts.push({
        alertType: 'severe_pain_signal',
        severity: 'high',
        alertMessage: 'Severe pain score captured during encounter.',
        suggestedAction: 'Run severe pain protocol with urgent reassessment and doctor intervention.',
        confidence: 0.79,
        triggerTerms: [`pain_score_${painScoreMatch[1]}`],
        metadata: {
          detection: 'numeric_pattern_v1',
        },
      });
    }

    const bloodPressureMatch = normalized.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
    if (bloodPressureMatch) {
      const systolic = Number(bloodPressureMatch[1]);
      const diastolic = Number(bloodPressureMatch[2]);
      if (Number.isFinite(systolic) && Number.isFinite(diastolic)) {
        if (systolic >= 180 || diastolic >= 120) {
          drafts.push({
            alertType: 'hypertensive_crisis_signal',
            severity: 'critical',
            alertMessage: `Severely elevated blood pressure detected (${systolic}/${diastolic}).`,
            suggestedAction: 'Trigger urgent hypertensive emergency workflow and verify measurement immediately.',
            confidence: 0.9,
            triggerTerms: [`bp_${systolic}_${diastolic}`],
            metadata: {
              systolic,
              diastolic,
              detection: 'vitals_pattern_v1',
            },
          });
        } else if (systolic >= 160 || diastolic >= 100) {
          drafts.push({
            alertType: 'severe_hypertension_signal',
            severity: 'high',
            alertMessage: `Severe hypertension range detected (${systolic}/${diastolic}).`,
            suggestedAction: 'Repeat blood pressure and prioritize clinician review in current visit.',
            confidence: 0.81,
            triggerTerms: [`bp_${systolic}_${diastolic}`],
            metadata: {
              systolic,
              diastolic,
              detection: 'vitals_pattern_v1',
            },
          });
        } else if (systolic < 90 || diastolic < 60) {
          drafts.push({
            alertType: 'hypotension_signal',
            severity: 'high',
            alertMessage: `Possible hypotension detected (${systolic}/${diastolic}).`,
            suggestedAction: 'Assess perfusion signs and repeat vitals with urgent clinician review.',
            confidence: 0.8,
            triggerTerms: [`bp_${systolic}_${diastolic}`],
            metadata: {
              systolic,
              diastolic,
              detection: 'vitals_pattern_v1',
            },
          });
        }
      }
    }

    const spo2Match = normalized.match(/(?:spo2|oxygen saturation)\s*(?:is|of|:|=)?\s*(\d{2,3})\s*%?/i);
    if (spo2Match) {
      const spo2 = Number(spo2Match[1]);
      if (Number.isFinite(spo2)) {
        if (spo2 < 90) {
          drafts.push({
            alertType: 'critical_hypoxia_signal',
            severity: 'critical',
            alertMessage: `Critical oxygen saturation detected (${spo2}%).`,
            suggestedAction: 'Start urgent hypoxia management protocol and escalate immediately.',
            confidence: 0.93,
            triggerTerms: [`spo2_${spo2}`],
            metadata: {
              spo2,
              detection: 'vitals_pattern_v1',
            },
          });
        } else if (spo2 < 93) {
          drafts.push({
            alertType: 'hypoxia_risk_signal',
            severity: 'high',
            alertMessage: `Low oxygen saturation detected (${spo2}%).`,
            suggestedAction: 'Repeat pulse oximetry and evaluate for respiratory compromise.',
            confidence: 0.86,
            triggerTerms: [`spo2_${spo2}`],
            metadata: {
              spo2,
              detection: 'vitals_pattern_v1',
            },
          });
        }
      }
    }

    return this.dedupeIntraVisitAlertDrafts(drafts);
  }

  private async classifyEscalationSignals(args: {
    sessionId: string;
    message: string;
    language?: string;
  }): Promise<EscalationDetectionResult> {
    const prefilter = this.buildEscalationPrefilter(args.message);
    const confidenceV2Enabled = this.isEscalationConfidenceV2Enabled();

    if (!confidenceV2Enabled) {
      const severity = prefilter.candidateSeverity;
      const confidence = prefilter.matched ? (severity === 'critical' ? 0.9 : severity === 'high' ? 0.8 : 0.68) : 0.2;
      const temporality = prefilter.matched ? 'current' : 'unclear';
      return {
        detected: prefilter.matched,
        severity,
        routeTarget: prefilter.routeTarget,
        triggerTerms: prefilter.triggerTerms,
        triggerType: prefilter.triggerType,
        slaMinutes: this.getSlaMinutesForSeverity(severity),
        confidence,
        temporality,
        classifierSource: 'keyword_prefilter',
        candidateSeverity: prefilter.candidateSeverity,
        escalationSuppressedReason: prefilter.matched ? null : 'no_stage1_match',
        classifierModel: null,
        classifierRationale: null,
        classifierAudit: null,
      };
    }

    let llmClassification: PostVisitEscalationClassifierOutput | null = null;
    if (prefilter.matched && this.groundedLlmService) {
      llmClassification = await this.groundedLlmService.classifyEscalationSignal({
        sessionId: args.sessionId,
        message: args.message,
        triggerTerms: prefilter.triggerTerms,
        candidateSeverity: prefilter.candidateSeverity,
      });
    }

    const severity = llmClassification?.severity || prefilter.candidateSeverity;
    const suggestedRoute = llmClassification?.routeTarget || prefilter.routeTarget;
    const confidence = Math.min(
      1,
      Math.max(
        0,
        Number.isFinite(Number(llmClassification?.confidence))
          ? Number(llmClassification?.confidence)
          : prefilter.matched
            ? severity === 'critical'
              ? 0.78
              : severity === 'high'
                ? 0.66
                : 0.56
            : 0.18,
      ),
    );
    const temporality =
      llmClassification?.temporality || this.inferTemporalityFromText(prefilter.text) || 'unclear';
    const threshold = this.getEscalationConfidenceThreshold(severity);
    const temporalGatePassed = temporality === 'current';
    const confidenceGatePassed = confidence >= threshold;
    const detected = prefilter.matched && temporalGatePassed && confidenceGatePassed;

    let finalRoute: 'emergency' | 'doctor' | 'nurse' = suggestedRoute;
    let suppressionReason: EscalationDetectionResult['escalationSuppressedReason'] = null;

    if (!prefilter.matched) {
      finalRoute = 'nurse';
      suppressionReason = 'no_stage1_match';
    } else if (!confidenceGatePassed) {
      finalRoute = severity === 'critical' || severity === 'high' ? 'doctor' : 'nurse';
      suppressionReason = 'low_confidence';
    } else if (!temporalGatePassed) {
      finalRoute = severity === 'critical' || severity === 'high' ? 'doctor' : 'nurse';
      suppressionReason = temporality === 'historical' ? 'historical_signal' : 'unclear_temporality';
    }

    return {
      detected,
      severity,
      routeTarget: finalRoute,
      triggerTerms: prefilter.triggerTerms,
      triggerType: prefilter.triggerType,
      slaMinutes: detected ? this.getSlaMinutesForSeverity(severity) : 0,
      confidence,
      temporality,
      classifierSource: llmClassification ? 'hybrid_v2' : 'keyword_prefilter',
      candidateSeverity: prefilter.candidateSeverity,
      escalationSuppressedReason: detected ? null : suppressionReason,
      classifierModel: llmClassification?.model || null,
      classifierRationale: llmClassification?.rationale || null,
      classifierAudit: llmClassification?.audit || null,
    };
  }

  private async routeEscalationToWorkflow(
    tenantDb: DataSource,
    args: {
      sessionRow: any;
      escalationId: string;
      routeTarget: 'emergency' | 'doctor' | 'nurse';
      severity: 'low' | 'moderate' | 'high' | 'critical';
      triggerTerms: string[];
    },
  ): Promise<string | null> {
    const workflowKey = `post_visit_escalation:${args.escalationId}`;
    try {
      await tenantDb.query(
        `
          INSERT INTO nurse_cross_module_workflow_state (
            workflow_key,
            module,
            item_type,
            source_record_id,
            patient_id,
            status,
            destination_role,
            destination_service,
            destination_specialty,
            note,
            context
          ) VALUES (
            $1,
            'post_visit',
            'companion_escalation',
            $2,
            $3,
            'pending',
            $4,
            'post_visit_companion',
            CASE
              WHEN $4 = 'emergency' THEN 'Emergency'
              WHEN $4 = 'doctor' THEN 'General Medicine'
              ELSE 'Nursing'
            END,
            $5,
            $6::jsonb
          )
          ON CONFLICT (workflow_key) DO UPDATE
          SET status = EXCLUDED.status,
              destination_role = EXCLUDED.destination_role,
              destination_service = EXCLUDED.destination_service,
              destination_specialty = EXCLUDED.destination_specialty,
              note = EXCLUDED.note,
              context = EXCLUDED.context,
              updated_at = NOW()
        `,
        [
          workflowKey,
          args.escalationId,
          args.sessionRow.patient_id,
          args.routeTarget,
          `Post-visit companion escalation (${args.severity})`,
          JSON.stringify({
            escalation_id: args.escalationId,
            severity: args.severity,
            route_target: args.routeTarget,
            trigger_terms: args.triggerTerms,
            source: 'post_visit_companion',
          }),
        ],
      );
      return workflowKey;
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('nurse_cross_module_workflow_state')) {
        return null;
      }
      throw error;
    }
  }

  private async createEscalationEvent(
    tenantDb: DataSource,
    args: {
      sessionRow: any;
      threadId: string;
      messageId: string;
      detection: EscalationDetectionResult;
      messageText: string;
      tenantId?: string;
    },
  ) {
    const detectedAt = new Date();
    const slaDueAt =
      args.detection.slaMinutes > 0
        ? new Date(detectedAt.getTime() + args.detection.slaMinutes * 60 * 1000)
        : null;
    const initialStatus = args.detection.detected ? 'open' : 'dismissed';

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
          $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17::jsonb
        )
        RETURNING *
      `,
      [
        args.sessionRow.id,
        args.sessionRow.patient_id,
        args.threadId,
        args.messageId,
        initialStatus,
        args.detection.severity,
        args.detection.routeTarget,
        args.detection.triggerType,
        JSON.stringify(args.detection.triggerTerms),
        args.messageText,
        args.detection.confidence,
        args.detection.temporality,
        args.detection.classifierSource,
        args.detection.classifierRationale || args.detection.escalationSuppressedReason || null,
        args.detection.classifierSource === 'keyword_prefilter' ? 'v1' : 'v2',
        detectedAt.toISOString(),
        slaDueAt ? slaDueAt.toISOString() : null,
        JSON.stringify({
          source: 'post_visit_companion_message',
          trigger_terms: args.detection.triggerTerms,
          classification: {
            confidence: args.detection.confidence,
            temporality: args.detection.temporality,
            source: args.detection.classifierSource,
            candidate_severity: args.detection.candidateSeverity,
            final_severity: args.detection.severity,
            final_route_target: args.detection.routeTarget,
            detected: args.detection.detected,
            suppression_reason: args.detection.escalationSuppressedReason || null,
            classifier_model: args.detection.classifierModel || null,
            rationale: args.detection.classifierRationale || null,
          },
        }),
      ],
    );

    const inserted = rows[0];
    if (args.detection.detected) {
      const workflowKey = await this.routeEscalationToWorkflow(tenantDb, {
        sessionRow: args.sessionRow,
        escalationId: inserted.id,
        routeTarget: args.detection.routeTarget,
        severity: args.detection.severity,
        triggerTerms: args.detection.triggerTerms,
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

      const channelDelivery = await this.sendEscalationAlerts(tenantDb, {
        escalationId: inserted.id,
        sessionRow: args.sessionRow,
        detection: args.detection,
        messageText: args.messageText,
        tenantId: args.tenantId,
      });
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
      );
    }

    if (args.detection.classifierAudit && args.detection.classifierModel) {
      await this.persistGroundedLlmAudit(tenantDb, {
        model: args.detection.classifierModel,
        audit: args.detection.classifierAudit,
        sessionId: args.sessionRow.id,
        patientId: args.sessionRow.patient_id,
        encounterId: args.sessionRow.appointment_id || args.sessionRow.consultation_id || null,
        actorRole: 'patient',
        metadata: {
          channel: 'post_visit_escalation_classifier',
          escalation_id: inserted.id,
          classification_detected: args.detection.detected,
          route_target: args.detection.routeTarget,
          severity: args.detection.severity,
          temporality: args.detection.temporality,
          confidence: args.detection.confidence,
        },
      });
    }

    return inserted;
  }

  private async sendEscalationAlerts(
    tenantDb: DataSource,
    args: {
      escalationId: string;
      sessionRow: any;
      detection: EscalationDetectionResult;
      messageText: string;
      tenantId?: string;
    },
  ) {
    const channels = {
      patientInApp: false,
      patientSms: false,
      patientEmail: false,
      clinicianSms: false,
      clinicianEmail: false,
      errors: [] as string[],
    };

    const [patientRow] = await tenantDb.query(
      `
        SELECT id, first_name, last_name, phone, email
        FROM patients
        WHERE id = $1
        LIMIT 1
      `,
      [args.sessionRow.patient_id],
    );

    if (args.tenantId && this.patientNotificationsService) {
      try {
        await this.patientNotificationsService.createNotification(
          args.sessionRow.patient_id,
          'system_alert',
          'Post-Visit Safety Alert',
          args.detection.routeTarget === 'emergency'
            ? 'Your message contains urgent symptoms. Please seek emergency care now.'
            : 'Your message was flagged for rapid clinician review. The care team has been alerted.',
          args.tenantId,
          {
            actionUrl: `/post-visit/sessions/${args.sessionRow.id}/summary`,
            actionLabel: 'Open Post-Visit Summary',
            priority: args.detection.severity === 'critical' ? 'urgent' : 'high',
            metadata: {
              escalationId: args.escalationId,
              routeTarget: args.detection.routeTarget,
              severity: args.detection.severity,
            },
          },
        );
        channels.patientInApp = true;
      } catch (error: any) {
        channels.errors.push(`patient_notification:${String(error?.message || error)}`);
      }
    }

    const patientAlertText =
      args.detection.routeTarget === 'emergency'
        ? 'Urgent symptoms detected. Please call emergency services immediately.'
        : `Your care team has been alerted to review your symptoms: ${args.messageText.slice(0, 120)}`;

    if (patientRow?.phone && this.notificationsService && ['high', 'critical'].includes(args.detection.severity)) {
      try {
        await this.notificationsService.sendSms(
          {
            phone: patientRow.phone,
            message: patientAlertText,
          },
          tenantDb,
        );
        channels.patientSms = true;
      } catch (error: any) {
        channels.errors.push(`patient_sms:${String(error?.message || error)}`);
      }
    }

    if (patientRow?.email && this.emailService && ['high', 'critical'].includes(args.detection.severity)) {
      try {
        await this.emailService.sendEmail({
          to: patientRow.email,
          subject: 'Post-Visit Safety Alert',
          text: patientAlertText,
        });
        channels.patientEmail = true;
      } catch (error: any) {
        channels.errors.push(`patient_email:${String(error?.message || error)}`);
      }
    }

    let clinicianRow: any = null;
    if (args.detection.routeTarget === 'doctor' && args.sessionRow.doctor_id) {
      const rows = await tenantDb.query(
        `
          SELECT id, first_name, last_name, phone, email
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [args.sessionRow.doctor_id],
      );
      clinicianRow = rows?.[0] || null;
    } else if (args.detection.routeTarget === 'nurse') {
      const rows = await tenantDb.query(
        `
          SELECT id, first_name, last_name, phone, email
          FROM users
          WHERE role IN ('nurse','nurse_accounts')
            AND is_active = true
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        `,
      );
      clinicianRow = rows?.[0] || null;
    } else if (args.detection.routeTarget === 'emergency') {
      const rows = await tenantDb.query(
        `
          SELECT id, first_name, last_name, phone, email
          FROM users
          WHERE role IN ('doctor','nurse','nurse_accounts')
            AND is_active = true
          ORDER BY CASE WHEN role = 'doctor' THEN 0 ELSE 1 END, updated_at DESC NULLS LAST
          LIMIT 1
        `,
      );
      clinicianRow = rows?.[0] || null;
    }

    const clinicianText = `Post-visit escalation ${args.escalationId} (${args.detection.severity}, ${args.detection.routeTarget}) for patient ${patientRow?.first_name || 'patient'} ${patientRow?.last_name || ''}.`;

    if (clinicianRow?.phone && this.notificationsService && ['high', 'critical'].includes(args.detection.severity)) {
      try {
        await this.notificationsService.sendSms(
          {
            phone: clinicianRow.phone,
            message: clinicianText,
          },
          tenantDb,
        );
        channels.clinicianSms = true;
      } catch (error: any) {
        channels.errors.push(`clinician_sms:${String(error?.message || error)}`);
      }
    }

    if (clinicianRow?.email && this.emailService) {
      try {
        await this.emailService.sendEmail({
          to: clinicianRow.email,
          subject: `Post-Visit Escalation (${args.detection.severity.toUpperCase()})`,
          text: `${clinicianText}\nMessage snippet: ${args.messageText.slice(0, 240)}`,
        });
        channels.clinicianEmail = true;
      } catch (error: any) {
        channels.errors.push(`clinician_email:${String(error?.message || error)}`);
      }
    }

    return channels;
  }

  private buildCitationCatalogFromRecommendations(recommendationArtifact: any): GroundingCitation[] {
    const items = Array.isArray(recommendationArtifact?.content?.items)
      ? recommendationArtifact.content.items
      : [];
    const citations: GroundingCitation[] = [];
    for (const item of items) {
      const recommendationId = String(item?.id || item?.recommendation_id || '').trim();
      const ruleId = String(item?.rule_id || '').trim() || undefined;
      const itemCitations = Array.isArray(item?.citations) ? item.citations : [];
      for (const citation of itemCitations) {
        const citationId = String(citation?.citation_id || '').trim();
        if (!citationId) {
          continue;
        }
        citations.push({
          id: citationId,
          label: String(citation?.label || citation?.title || '').trim() || citationId,
          source: String(citation?.source || '').trim() || undefined,
          url: citation?.url || null,
          excerpt: citation?.excerpt || null,
          guidelineId: String(citation?.guideline_id || '').trim() || undefined,
          recommendationId: recommendationId || undefined,
          ruleId,
        });
      }
    }
    return citations;
  }

  private applyRecommendationLlmRewrites(
    recommendationItems: any[],
    rewrites: Array<{ recommendationId: string; title?: string; description?: string }>,
  ) {
    if (!Array.isArray(recommendationItems) || !Array.isArray(rewrites) || rewrites.length === 0) {
      return recommendationItems;
    }
    const rewriteById = new Map<string, { title?: string; description?: string }>();
    for (const rewrite of rewrites) {
      const recommendationId = String(rewrite?.recommendationId || '').trim();
      if (!recommendationId) continue;
      rewriteById.set(recommendationId, {
        title: typeof rewrite.title === 'string' ? rewrite.title.trim() : undefined,
        description: typeof rewrite.description === 'string' ? rewrite.description.trim() : undefined,
      });
    }
    return recommendationItems.map((item) => {
      const rewrite = rewriteById.get(String(item?.id || '').trim());
      if (!rewrite) {
        return item;
      }
      return {
        ...item,
        title: rewrite.title || item?.title,
        description: rewrite.description || item?.description,
      };
    });
  }

  private async buildGroundedCompanionAnswer(args: {
    sessionId: string;
    question: string;
    visitSummaryArtifact: any;
    recommendationArtifact: any;
    escalation: EscalationDetectionResult;
    memoryFacts?: string[];
  }): Promise<{
    answer: string;
    source: 'deterministic' | 'llm';
    citationsUsed: string[];
    model: string | null;
    abstained: boolean;
    llmAudit: LlmAuditMetadata | null;
  }> {
    if (args.escalation.detected && args.escalation.routeTarget === 'emergency') {
      return {
        answer: 'Your symptoms may be urgent. Please call emergency services now or go to the nearest emergency facility immediately.',
        source: 'deterministic',
        citationsUsed: [],
        model: null,
        abstained: false,
        llmAudit: null,
      };
    }

    const summary = String(args.visitSummaryArtifact?.content?.plain_language_summary || '').trim();
    const recommendations = Array.isArray(args.recommendationArtifact?.content?.items)
      ? args.recommendationArtifact.content.items
      : [];
    const checklist = recommendations.slice(0, 3).map((item: any) => String(item?.title || '').trim()).filter(Boolean);
    const memoryFacts = Array.isArray(args.memoryFacts) ? args.memoryFacts.slice(0, 8) : [];
    const citationCatalog = this.buildCitationCatalogFromRecommendations(args.recommendationArtifact).slice(0, 30);
    let llmAuditAttempt: LlmAuditMetadata | null = null;
    let llmModelAttempt: string | null = null;
    let llmAbstainedAttempt = false;

    if (this.groundedLlmService) {
      const llmResult = await this.groundedLlmService.answerPatientQuestion({
        sessionId: String(args.sessionId || args.visitSummaryArtifact?.session_id || args.recommendationArtifact?.session_id || ''),
        language: String(args.visitSummaryArtifact?.content?.language || 'en'),
        question: args.question,
        summary,
        checklist,
        memoryFacts,
        citations: citationCatalog,
      });
      llmAuditAttempt = llmResult?.audit || null;
      llmModelAttempt = llmResult?.model || null;
      llmAbstainedAttempt = llmResult?.abstained === true;
      if (llmResult && !llmResult.abstained && llmResult.answer) {
        const answer = args.escalation.detected
          ? `${llmResult.answer} We have also routed your concern to the care team for follow-up.`
          : llmResult.answer;
        return {
          answer,
          source: 'llm',
          citationsUsed: llmResult.citationsUsed || [],
          model: llmResult.model || null,
          abstained: false,
          llmAudit: llmAuditAttempt,
        };
      }
    }

    const lowerQuestion = String(args.question || '').toLowerCase();
    const clinicianEscalationSuffix = args.escalation.detected
      ? ' We have alerted the care team to review your message.'
      : '';
    const memorySuffix = memoryFacts.length
      ? ` I also remembered these prior context points: ${memoryFacts.slice(0, 2).join(' ; ')}.`
      : '';

    if (lowerQuestion.includes('medicine') || lowerQuestion.includes('medication') || lowerQuestion.includes('dose')) {
      if (checklist.length) {
        return {
          answer: `Based on your approved visit plan, follow these medication-related actions: ${checklist.join('; ')}. If symptoms worsen, contact the clinic immediately.${memorySuffix}${clinicianEscalationSuffix}`,
          source: 'deterministic',
          citationsUsed: citationCatalog.map((citation) => citation.id).slice(0, 3),
          model: llmModelAttempt,
          abstained: llmAbstainedAttempt,
          llmAudit: llmAuditAttempt,
        };
      }
    }

    if (lowerQuestion.includes('when') || lowerQuestion.includes('follow up') || lowerQuestion.includes('next visit')) {
      if (checklist.length) {
        return {
          answer: `Your approved follow-up checklist includes: ${checklist.join('; ')}. Please complete these and keep your next review appointment.${memorySuffix}${clinicianEscalationSuffix}`,
          source: 'deterministic',
          citationsUsed: citationCatalog.map((citation) => citation.id).slice(0, 3),
          model: llmModelAttempt,
          abstained: llmAbstainedAttempt,
          llmAudit: llmAuditAttempt,
        };
      }
    }

    if (summary) {
      return {
        answer: `From your approved visit summary: ${summary} Please follow the checklist and contact the clinic if you have worsening symptoms.${memorySuffix}${clinicianEscalationSuffix}`,
        source: 'deterministic',
        citationsUsed: citationCatalog.map((citation) => citation.id).slice(0, 3),
        model: llmModelAttempt,
        abstained: llmAbstainedAttempt,
        llmAudit: llmAuditAttempt,
      };
    }

    return {
      answer:
        `I can help with your approved visit plan and checklist. If you share your concern, I will guide you based on your doctor-approved instructions.${memorySuffix}${clinicianEscalationSuffix}`.trim(),
      source: 'deterministic',
      citationsUsed: citationCatalog.map((citation) => citation.id).slice(0, 3),
      model: llmModelAttempt,
      abstained: llmAbstainedAttempt,
      llmAudit: llmAuditAttempt,
    };
  }

  private async persistGroundedLlmAudit(
    tenantDb: DataSource,
    args: {
      model: string | null;
      audit: LlmAuditMetadata | null;
      sessionId: string;
      patientId?: string | null;
      encounterId?: string | null;
      actorUserId?: string | null;
      actorRole?: string | null;
      requestId?: string | null;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    if (!this.hipaaAuditService) {
      return;
    }
    const modelName = String(args.model || '').trim();
    if (!modelName || !args.audit?.promptHash) {
      return;
    }

    try {
      const modelId = this.toModelRegistryId(modelName);
      await this.hipaaAuditService.registerModelEntry(tenantDb, {
        modelId,
        modelName,
        modelVersion: String(args.audit.templateVersion || 'v1'),
        provider: this.inferModelProvider(modelName),
        status: 'active',
        metadata: {
          feature: 'post_visit_grounded_llm',
        },
      });

      await this.hipaaAuditService.logPromptAudit(tenantDb, {
        promptHash: args.audit.promptHash,
        templateVersion: args.audit.templateVersion || 'postvisit-grounded-v1',
        modelId,
        sessionId: args.sessionId,
        patientId: args.patientId || null,
        encounterId: args.encounterId || null,
        actorId: this.normalizeUuid(args.actorUserId),
        actorRole: args.actorRole || null,
        inputTokenCount: args.audit.inputTokenCount,
        outputTokenCount: args.audit.outputTokenCount,
        latencyMs: args.audit.latencyMs,
        safetyGateTriggered: args.audit.safetyGateTriggered === true,
        requestId: args.requestId || null,
        metadata: {
          model_name: modelName,
          ...args.metadata,
        },
      });
    } catch (_error) {
      // Prompt/model audit is best-effort and must not block patient or doctor workflows.
    }
  }

  private toModelRegistryId(modelName: string): string {
    return `postvisit.${String(modelName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')}`;
  }

  private inferModelProvider(modelName: string): string {
    const normalized = String(modelName || '').toLowerCase();
    if (!normalized) return 'unknown';
    if (normalized.includes('gpt') || normalized.includes('openai')) return 'openai';
    if (normalized.includes('claude')) return 'anthropic';
    if (normalized.includes('llama') || normalized.includes('mistral') || normalized.includes('qwen')) return 'ollama';
    if (normalized.includes('whisper')) return 'whisper-local';
    return 'custom';
  }

  private normalizeUuid(value?: string | null): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized) ? normalized : null;
  }

  private async touchCompanionThreadAfterMessage(
    tenantDb: DataSource,
    threadId: string,
    senderType: 'patient' | 'clinician' | 'system',
  ) {
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
  }

  private async upsertDraftArtifact(
    tenantDb: DataSource,
    args: {
      sessionId: string;
      artifactType: string;
      content: Record<string, any>;
      citations?: Array<Record<string, any>>;
      confidence?: number | null;
      generatedBy?: string;
      actorUserId?: string | null;
      artifactStatus?: 'draft' | 'reviewed' | 'published';
    },
  ) {
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
  }

  private async replaceRuleCitations(
    tenantDb: DataSource,
    sessionId: string,
    citations: Array<{
      recommendationId: string;
      ruleId: string;
      citation: RuleCitation;
      metadata?: Record<string, any>;
    }>,
  ) {
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
          this.normalizeCitationRelevanceScore(
            row.citation.relevanceScore ?? row.citation.confidence ?? null,
          ),
          row.citation.publicationYear ?? this.extractGuidelineYear(row.citation.guidelineId),
          row.citation.isSuperseded === true,
          row.citation.supersededByGuidelineId || null,
          JSON.stringify(row.metadata || {}),
        ],
      );
    }
  }

  private buildRecommendationRules(
    patientContext: any,
    extractedEntities: any[],
  ): RecommendationRuleResult[] {
    const rules: RecommendationRuleResult[] = [];
    const latestVitals = patientContext?.latestVitals || {};
    const modules = patientContext?.modules || {};

    const extractedBpEntity = extractedEntities.find(
      (entity) => String(entity.entity_type || entity.type) === 'vital_blood_pressure',
    );
    const extractedBp = this.parseBloodPressure(extractedBpEntity?.entity_value || extractedBpEntity?.value);
    const contextBp = this.parseBloodPressure(latestVitals?.blood_pressure || latestVitals?.bloodPressure);
    const bp = extractedBp || contextBp;

    if (bp && (bp.systolic >= 140 || bp.diastolic >= 90)) {
      rules.push({
        ruleId: 'htn_followup_rule',
        recommendationId: 'htn_followup',
        title: 'Elevated blood pressure follow-up',
        description:
          'Schedule blood pressure reassessment and initiate hypertension workup/order-set if persistent at follow-up.',
        urgency: bp.systolic >= 180 || bp.diastolic >= 120 ? 'stat' : 'urgent',
        actionType: 'follow_up',
        confidence: 0.86,
        context: {
          bloodPressure: `${bp.systolic}/${bp.diastolic}`,
          source: extractedBp ? 'transcript' : 'latest_vitals',
        },
        citations: [
          {
            guidelineId: 'who-pen-hypertension-2023',
            label: 'WHO PEN hypertension follow-up threshold guidance',
            source: 'WHO PEN',
            url: 'https://www.who.int/publications/i/item/9789240009226',
            excerpt: 'Repeat and confirm elevated blood pressure before definitive long-term management.',
            confidence: 0.88,
          },
        ],
      });
    }

    const labCritical = modules?.lab?.latestCriticalAlert;
    if (labCritical && ['pending', 'unacknowledged'].includes(String(labCritical.alert_status || '').toLowerCase())) {
      rules.push({
        ruleId: 'critical_lab_followup_rule',
        recommendationId: 'critical_lab_followup',
        title: 'Critical lab escalation callback',
        description:
          'Contact patient urgently and document immediate safety instructions linked to unresolved critical lab alert.',
        urgency: 'stat',
        actionType: 'monitoring',
        confidence: 0.9,
        context: {
          alertId: labCritical.id,
          component: labCritical.component_name,
          severity: labCritical.severity,
        },
        citations: [
          {
            guidelineId: 'joint-commission-critical-lab-policy',
            label: 'Critical laboratory result communication policy',
            source: 'Clinical Safety Policy',
            excerpt: 'Critical values must trigger timely provider notification and documented patient communication.',
            confidence: 0.84,
          },
        ],
      });
    }

    const hivEnrollment = modules?.hiv?.latestEnrollment;
    if (hivEnrollment) {
      rules.push({
        ruleId: 'hiv_followup_continuity_rule',
        recommendationId: 'hiv_followup_continuity',
        title: 'HIV continuity follow-up scheduling',
        description:
          'Confirm next HIV clinical review date, adherence counseling checkpoint, and required lab monitoring timeline.',
        urgency: 'routine',
        actionType: 'follow_up',
        confidence: 0.82,
        context: {
          enrollmentId: hivEnrollment.id,
          nextReviewDate: modules?.hiv?.latestClinicalVisit?.next_review_date || null,
        },
        citations: [
          {
            guidelineId: 'who-hiv-care-followup-2024',
            label: 'WHO HIV care and treatment clinical follow-up guidance',
            source: 'WHO HIV Guidelines',
            url: 'https://www.who.int/teams/global-hiv-hepatitis-and-stis-programmes/hiv/treatment',
            excerpt: 'Maintain scheduled clinical and laboratory follow-up to support retention and viral suppression.',
            confidence: 0.86,
          },
        ],
      });
    }

    const medicationIntelligence = this.buildMedicationIntelligenceAssessment(patientContext, extractedEntities);
    if (medicationIntelligence.enabled && medicationIntelligence.medications.length > 0) {
      const highestSeverity = medicationIntelligence.highestSeverity;
      const hasHighRisk = highestSeverity !== null && this.getMedicationSeverityRank(highestSeverity) >= 3;
      const issueCount =
        medicationIntelligence.interactions.length +
        medicationIntelligence.beersAlerts.length +
        medicationIntelligence.renalAlerts.length;

      if (issueCount > 0) {
        rules.push({
          ruleId: 'medication_safety_intelligence_v2_rule',
          recommendationId: 'medication_safety_intelligence_v2',
          title: hasHighRisk ? 'High-risk medication safety review' : 'Medication safety review',
          description: medicationIntelligence.riskNarrative,
          urgency: hasHighRisk ? 'urgent' : 'routine',
          actionType: 'medication',
          confidence: hasHighRisk ? 0.91 : 0.83,
          context: {
            medicationIntelligence,
            issueCount,
            highRisk: hasHighRisk,
          },
          citations: [
            {
              guidelineId: 'fda-drug-safety-interactions',
              label: 'FDA drug interaction safety communication',
              source: 'FDA Safety',
              excerpt: 'Clinicians should proactively identify and mitigate high-risk drug-drug interactions.',
              confidence: 0.86,
            },
            {
              guidelineId: 'ags-beers-criteria-2023',
              label: 'AGS Beers Criteria for potentially inappropriate medications in older adults',
              source: 'AGS Beers',
              excerpt: 'Avoid high-risk medications in adults 65+ when safer alternatives exist.',
              confidence: 0.85,
            },
            {
              guidelineId: 'kdigo-drug-dosing-ckd-2024',
              label: 'KDIGO kidney disease drug dosing safety recommendations',
              source: 'KDIGO',
              excerpt: 'Renally cleared medications require eGFR-based dose review and adjustment.',
              confidence: 0.84,
            },
          ],
        });
      }
    }

    const activePrescriptionCount =
      Number(modules?.pharmacy?.activePrescriptionCount || 0) ||
      Number(modules?.pharmacy?.active_count || 0);
    if (activePrescriptionCount > 0) {
      rules.push({
        ruleId: 'medication_adherence_reinforcement_rule',
        recommendationId: 'medication_adherence_reinforcement',
        title: 'Medication adherence reinforcement',
        description:
          medicationIntelligence.enabled
            ? `${medicationIntelligence.riskNarrative} Reinforce adherence and confirm understanding using teach-back.`
            : 'Issue plain-language medication adherence reminders and confirm patient understanding via teach-back.',
        urgency: 'routine',
        actionType: 'medication',
        confidence: 0.78,
        context: {
          activePrescriptionCount,
          medicationIntelligence: medicationIntelligence.enabled
            ? {
                highestSeverity: medicationIntelligence.highestSeverity,
                highRiskCount: medicationIntelligence.highRiskCount,
                egfr: medicationIntelligence.egfr,
              }
            : null,
        },
        citations: [
          {
            guidelineId: 'adherence-counseling-best-practice',
            label: 'Medication adherence counseling best practice',
            source: 'Clinical Adherence Guidance',
            excerpt: 'Use teach-back and reminder reinforcement to reduce post-visit medication errors.',
            confidence: 0.79,
          },
        ],
      });
    }

    if (!rules.length) {
      rules.push({
        ruleId: 'general_post_visit_followup_rule',
        recommendationId: 'general_post_visit_followup',
        title: 'General post-visit follow-up package',
        description:
          'Provide plain-language summary, follow-up date recommendation, and return-precaution instructions.',
        urgency: 'routine',
        actionType: 'follow_up',
        confidence: 0.72,
        context: {},
        citations: [
          {
            guidelineId: 'transition-of-care-best-practice',
            label: 'Transitions of care communication guidance',
            source: 'Care Continuity Framework',
            excerpt: 'Clear discharge communication improves adherence and reduces avoidable return visits.',
            confidence: 0.74,
          },
        ],
      });
    }

    return rules;
  }

  private resolveSoapSpecialty(patientContext: any): PostVisitSoapSpecialty {
    const modules = patientContext?.modules || {};
    const age = Number(patientContext?.patient?.age || 0);

    if (modules?.cardiology?.latestEncounter) {
      return 'cardiology';
    }
    if (age > 0 && age < 15) {
      return 'paediatrics';
    }
    if (modules?.mentalHealth?.latestEncounter || modules?.mental_health?.latestEncounter) {
      return 'mental_health';
    }
    return 'general_practice';
  }

  private evaluateSpecialtySoapTemplate(
    specialty: PostVisitSoapSpecialty,
    soapNote: any,
    patientContext: any,
  ): SpecialtySoapValidationSummary {
    const subjective = String(soapNote?.subjective || '').trim();
    const objective = String(soapNote?.objective || '').trim();
    const assessment = String(soapNote?.assessment || '').trim();
    const plan = String(soapNote?.plan || '').trim();

    const modules = patientContext?.modules || {};
    const age = Number(patientContext?.patient?.age || 0);
    const hasWeight =
      this.parseNumericValue(patientContext?.latestVitals?.weightKg) !== null ||
      this.parseNumericValue(patientContext?.latestVitals?.weight) !== null;

    const checksBySpecialty: Record<PostVisitSoapSpecialty, SpecialtySoapCheckResult[]> = {
      general_practice: [
        {
          id: 'gp_subjective_present',
          label: 'Subjective history documented',
          passed: subjective.length > 0,
          guidance: 'Capture chief complaint and patient-reported symptoms in subjective.',
        },
        {
          id: 'gp_assessment_present',
          label: 'Assessment documented',
          passed: assessment.length > 0,
          guidance: 'Document clinical impression/diagnosis in assessment.',
        },
        {
          id: 'gp_plan_present',
          label: 'Plan documented',
          passed: plan.length > 0,
          guidance: 'Document clear follow-up or treatment plan.',
        },
      ],
      cardiology: [
        {
          id: 'cardio_subjective_symptoms',
          label: 'Cardiac symptom narrative present',
          passed: /(chest|palpitation|dyspnea|shortness of breath|syncope|edema|angina)/i.test(subjective),
          guidance: 'Document key cardiac symptoms (e.g., chest pain, dyspnea, palpitations).',
        },
        {
          id: 'cardio_objective_vitals',
          label: 'Objective cardiovascular findings present',
          passed:
            /(bp|blood pressure|heart rate|ecg|ekg|rhythm|murmur|troponin|spo2)/i.test(objective) ||
            !!modules?.cardiology?.latestEncounter,
          guidance: 'Include objective cardiovascular findings/vitals or ECG context.',
        },
        {
          id: 'cardio_plan_followup',
          label: 'Cardiology follow-up/management plan present',
          passed: /(follow|echo|ecg|stress|angi|cardio|review)/i.test(plan),
          guidance: 'Include cardiology-specific plan/follow-up actions.',
        },
      ],
      paediatrics: [
        {
          id: 'peds_age_context',
          label: 'Paediatric age context confirmed',
          passed: age > 0 && age < 15,
          guidance: 'Ensure paediatric template is used only for paediatric patients.',
        },
        {
          id: 'peds_weight_documented',
          label: 'Weight documented for dosing context',
          passed: hasWeight || /(weight|kg)/i.test(objective),
          guidance: 'Capture child weight for safe dosing and growth context.',
        },
        {
          id: 'peds_guardian_plan',
          label: 'Caregiver/follow-up instructions present',
          passed: /(caregiver|guardian|parent|return|follow)/i.test(plan),
          guidance: 'Document caregiver education and return/follow-up instructions.',
        },
      ],
      mental_health: [
        {
          id: 'mh_subjective_mse',
          label: 'Mood/affect symptom narrative present',
          passed: /(mood|anxiety|sleep|stress|depress|psych|panic|hallucinat)/i.test(subjective),
          guidance: 'Capture symptom narrative relevant to mental health visit.',
        },
        {
          id: 'mh_assessment_risk',
          label: 'Risk/safety assessment documented',
          passed: /(risk|suicid|self-harm|homicid|safety)/i.test(assessment),
          guidance: 'Include risk/safety assessment in mental-health assessment.',
        },
        {
          id: 'mh_plan_support',
          label: 'Plan includes support/therapy/follow-up',
          passed: /(therapy|counsel|follow|support|referral|safety plan)/i.test(plan),
          guidance: 'Include treatment/support or referral plan.',
        },
      ],
    };

    const checks = checksBySpecialty[specialty];
    const missingCheckIds = checks.filter((check) => !check.passed).map((check) => check.id);
    const passedCount = checks.filter((check) => check.passed).length;
    const completenessScore = checks.length ? Number((passedCount / checks.length).toFixed(2)) : 0;

    return {
      specialty,
      templateVersion: 'v1',
      isComplete: missingCheckIds.length === 0,
      completenessScore,
      checks,
      missingCheckIds,
    };
  }

  private evaluateBillingDocumentationSufficiency(args: {
    sessionRow: any;
    soapNote: any;
    summaryContent: any;
    recommendationItems: any[];
  }): PostVisitBillingDocumentationSummary {
    const subjective = String(args.soapNote?.subjective || '').trim();
    const objective = String(args.soapNote?.objective || '').trim();
    const assessment = String(args.soapNote?.assessment || '').trim();
    const plan = String(args.soapNote?.plan || '').trim();
    const plainSummary = String(args.summaryContent?.plain_language_summary || '').trim();
    const sourceType = String(args.sessionRow?.source_type || '').toLowerCase();
    const startedAtMs = new Date(args.sessionRow?.started_at || args.sessionRow?.created_at || 0).getTime();
    const completedAtMs = new Date(args.sessionRow?.completed_at || args.sessionRow?.updated_at || 0).getTime();
    const durationMinutes =
      Number.isFinite(startedAtMs) && Number.isFinite(completedAtMs) && completedAtMs >= startedAtMs
        ? Math.round((completedAtMs - startedAtMs) / (1000 * 60))
        : null;
    const recommendationCount = Array.isArray(args.recommendationItems) ? args.recommendationItems.length : 0;

    const checks: PostVisitBillingDocumentationCheck[] = [
      {
        id: 'subjective_documented',
        label: 'Subjective complaint narrative present',
        passed: subjective.length >= 10,
        guidance: 'Add chief complaint and symptom narrative in subjective.',
      },
      {
        id: 'objective_documented',
        label: 'Objective findings documented',
        passed: objective.length >= 10,
        guidance: 'Add measurable objective findings (vitals, exam, or tests).',
      },
      {
        id: 'assessment_documented',
        label: 'Assessment/diagnostic impression documented',
        passed: assessment.length >= 10,
        guidance: 'Add explicit clinical impression/diagnosis in assessment.',
      },
      {
        id: 'plan_documented',
        label: 'Treatment/follow-up plan documented',
        passed: plan.length >= 10,
        guidance: 'Add treatment steps and follow-up plan.',
      },
      {
        id: 'diagnosis_evidence_present',
        label: 'Diagnosis evidence present for coding',
        passed: /(diagnos|hypertension|diabetes|hiv|chest pain|anxiety|depress|infection|headache|fever)/i.test(
          `${assessment} ${plainSummary}`,
        ),
        guidance: 'Include a diagnosable condition statement that supports ICD coding.',
      },
      {
        id: 'care_complexity_supported',
        label: 'Care complexity supported by plan/recommendations',
        passed:
          recommendationCount > 0 ||
          /(urgent|stat|monitor|order|referral|follow[- ]?up|adherence|safety)/i.test(`${plan} ${plainSummary}`),
        guidance: 'Document complexity indicators such as orders, monitoring, referrals, or urgent follow-up.',
      },
      {
        id: 'encounter_context_present',
        label: 'Encounter context supports claim documentation',
        passed:
          ['in_person', 'telemedicine', 'hybrid'].includes(sourceType) &&
          (durationMinutes === null || durationMinutes >= 5),
        guidance: 'Ensure encounter context/time is captured for compliant billing justification.',
      },
    ];

    const passedCount = checks.filter((check) => check.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);
    const status: PostVisitBillingDocumentationSummary['status'] =
      score >= 85 ? 'sufficient' : score >= 60 ? 'partial' : 'insufficient';
    const gaps = checks.filter((check) => !check.passed).map((check) => check.guidance);

    return {
      score,
      status,
      checks,
      gaps,
    };
  }

  private buildBillingSuggestionDrafts(args: {
    sessionRow: any;
    soapNote: any;
    summaryContent: any;
    recommendationItems: any[];
    documentation: PostVisitBillingDocumentationSummary;
  }): PostVisitBillingSuggestionDraft[] {
    const subjective = String(args.soapNote?.subjective || '').trim();
    const objective = String(args.soapNote?.objective || '').trim();
    const assessment = String(args.soapNote?.assessment || '').trim();
    const plan = String(args.soapNote?.plan || '').trim();
    const combined = `${subjective}\n${objective}\n${assessment}\n${plan}\n${String(
      args.summaryContent?.plain_language_summary || '',
    )}`.toLowerCase();
    const sourceType = String(args.sessionRow?.source_type || '').toLowerCase();

    const suggestions: PostVisitBillingSuggestionDraft[] = [];
    const pushSuggestion = (draft: PostVisitBillingSuggestionDraft) => {
      const exists = suggestions.some(
        (item) => item.codeType === draft.codeType && String(item.code).toUpperCase() === String(draft.code).toUpperCase(),
      );
      if (!exists) suggestions.push(draft);
    };

    const cptCode =
      sourceType === 'telemedicine'
        ? '99442'
        : args.documentation.score >= 80
          ? '99214'
          : '99213';
    const cptDescription =
      cptCode === '99442'
        ? 'Telephone/telehealth E/M service'
        : cptCode === '99214'
          ? 'Established patient office/outpatient visit, moderate complexity'
          : 'Established patient office/outpatient visit, low complexity';
    const cptConfidenceBase = cptCode === '99214' ? 0.83 : cptCode === '99442' ? 0.8 : 0.74;
    pushSuggestion({
      suggestionKey: `cpt:${cptCode}`,
      codeType: 'cpt',
      code: cptCode,
      description: cptDescription,
      confidence: Math.min(0.98, Number((cptConfidenceBase * (0.6 + args.documentation.score / 250)).toFixed(2))),
      justification: `Encounter context (${sourceType || 'in_person'}) and documentation score ${args.documentation.score} support this CPT level.`,
      metadata: {
        sourceType,
        documentationScore: args.documentation.score,
      },
    });

    const icdRules: Array<{
      code: string;
      description: string;
      pattern: RegExp;
      confidence: number;
      reason: string;
    }> = [
      { code: 'I10', description: 'Essential (primary) hypertension', pattern: /\bhypertension\b|high blood pressure|\bbp\b/, confidence: 0.86, reason: 'Assessment indicates elevated blood pressure/hypertension context.' },
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', pattern: /\bdiabetes\b|\bhyperglyc/i, confidence: 0.84, reason: 'Documentation references diabetes care context.' },
      { code: 'B20', description: 'HIV disease', pattern: /\bhiv\b|antiretroviral|\bart\b/, confidence: 0.9, reason: 'Encounter references HIV diagnosis/management.' },
      { code: 'R07.9', description: 'Chest pain, unspecified', pattern: /chest pain|angina|tightness/, confidence: 0.8, reason: 'Symptom narrative includes chest pain-related complaint.' },
      { code: 'R06.02', description: 'Shortness of breath', pattern: /shortness of breath|dyspnea|cannot breathe|difficulty breathing/, confidence: 0.8, reason: 'Respiratory symptom documented in encounter.' },
      { code: 'R51.9', description: 'Headache, unspecified', pattern: /headache|migraine/, confidence: 0.75, reason: 'Headache symptom appears in clinical narrative.' },
      { code: 'R50.9', description: 'Fever, unspecified', pattern: /\bfever\b|febrile/, confidence: 0.74, reason: 'Fever signal appears in subjective/objective findings.' },
      { code: 'F41.9', description: 'Anxiety disorder, unspecified', pattern: /\banxiety\b|panic|anxious/, confidence: 0.76, reason: 'Mental health documentation suggests anxiety condition.' },
      { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', pattern: /\bdepress/i, confidence: 0.76, reason: 'Assessment includes depressive symptom context.' },
      { code: 'R52', description: 'Pain, unspecified', pattern: /\bpain\b/, confidence: 0.65, reason: 'General pain symptom documented without more specific coding evidence.' },
    ];

    for (const rule of icdRules) {
      if (!rule.pattern.test(combined)) continue;
      const tunedConfidence = Math.min(
        0.98,
        Number((rule.confidence * (0.62 + args.documentation.score / 240)).toFixed(2)),
      );
      pushSuggestion({
        suggestionKey: `icd10:${rule.code}`,
        codeType: 'icd10',
        code: rule.code,
        description: rule.description,
        confidence: tunedConfidence,
        justification: `${rule.reason} Documentation sufficiency score ${args.documentation.score}.`,
        metadata: {
          trigger: rule.pattern.source,
          documentationScore: args.documentation.score,
        },
      });
    }

    if (!suggestions.some((item) => item.codeType === 'icd10')) {
      pushSuggestion({
        suggestionKey: 'icd10:Z09',
        codeType: 'icd10',
        code: 'Z09',
        description: 'Follow-up examination after treatment for conditions other than malignant neoplasm',
        confidence: 0.58,
        justification: 'Default follow-up ICD recommendation due to insufficient disease-specific coding evidence.',
        metadata: {
          fallback: true,
          documentationScore: args.documentation.score,
        },
      });
    }

    return suggestions.sort((left, right) => right.confidence - left.confidence).slice(0, 12);
  }

  private async routeBillingSuggestionToWorkflow(
    tenantDb: DataSource,
    args: {
      suggestionId: string;
      sessionId: string;
      patientId: string;
      codeType: PostVisitBillingCodeType;
      code: string;
      actorUserId?: string | null;
      note?: string | null;
    },
  ): Promise<string | null> {
    const workflowKey = `post_visit_billing:${args.suggestionId}`;
    try {
      await tenantDb.query(
        `
          INSERT INTO nurse_cross_module_workflow_state (
            workflow_key,
            module,
            item_type,
            source_record_id,
            patient_id,
            status,
            destination_role,
            destination_service,
            destination_specialty,
            note,
            context
          ) VALUES (
            $1,
            'post_visit',
            'billing_code_suggestion',
            $2,
            $3,
            'pending',
            'accounts',
            'billing',
            'Revenue Cycle',
            $4,
            $5::jsonb
          )
          ON CONFLICT (workflow_key) DO UPDATE
          SET status = EXCLUDED.status,
              destination_role = EXCLUDED.destination_role,
              destination_service = EXCLUDED.destination_service,
              destination_specialty = EXCLUDED.destination_specialty,
              note = EXCLUDED.note,
              context = EXCLUDED.context,
              updated_at = NOW()
        `,
        [
          workflowKey,
          args.suggestionId,
          args.patientId,
          args.note || `Doctor-approved ${args.codeType.toUpperCase()} ${args.code} from post-visit billing intelligence.`,
          JSON.stringify({
            suggestion_id: args.suggestionId,
            session_id: args.sessionId,
            code_type: args.codeType,
            code: args.code,
            approved_by: args.actorUserId || null,
            source: 'post_visit_billing_intelligence',
          }),
        ],
      );
      return workflowKey;
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('nurse_cross_module_workflow_state')) {
        return null;
      }
      throw error;
    }
  }

  private buildBillingDocumentationSummaryFromSuggestionRows(
    rows: any[],
  ): PostVisitBillingDocumentationSummary | null {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const primary = rows[0];
    const checks = Array.isArray(primary?.documentation_checks)
      ? primary.documentation_checks.map((row: any, index: number) => ({
          id: String(row?.id || `check_${index + 1}`),
          label: String(row?.label || row?.id || `Check ${index + 1}`),
          passed: row?.passed === true,
          guidance: String(row?.guidance || row?.label || 'Documentation requirement not met.'),
        }))
      : [];
    const metadataGaps = Array.isArray(primary?.metadata?.documentation?.gaps)
      ? primary.metadata.documentation.gaps
          .map((gap: any) => String(gap || '').trim())
          .filter((gap: string) => gap.length > 0)
      : [];
    const gaps =
      metadataGaps.length > 0
        ? metadataGaps
        : checks.filter((check) => !check.passed).map((check) => check.guidance);
    const score = Math.max(0, Math.min(100, Number(primary?.documentation_score || 0)));
    const statusRaw = String(primary?.documentation_status || 'insufficient').toLowerCase();
    const status: PostVisitBillingDocumentationSummary['status'] =
      statusRaw === 'sufficient' || statusRaw === 'partial' || statusRaw === 'insufficient'
        ? statusRaw
        : 'insufficient';

    return {
      score,
      status,
      checks,
      gaps,
    };
  }

  private async refreshSessionBillingIntelligence(
    tenantDb: DataSource,
    args: {
      sessionRow: any;
      soapNote: any;
      summaryContent: any;
      recommendationItems: any[];
      actorUserId?: string | null;
      source?: string;
    },
  ) {
    if (!this.isBillingIntelligenceEnabled()) {
      return {
        featureEnabled: false,
        documentation: null,
        suggestions: [],
      };
    }

    const documentation = this.evaluateBillingDocumentationSufficiency({
      sessionRow: args.sessionRow,
      soapNote: args.soapNote,
      summaryContent: args.summaryContent,
      recommendationItems: args.recommendationItems,
    });
    const drafts = this.buildBillingSuggestionDrafts({
      sessionRow: args.sessionRow,
      soapNote: args.soapNote,
      summaryContent: args.summaryContent,
      recommendationItems: args.recommendationItems,
      documentation,
    });

    const existingRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_billing_suggestions
        WHERE session_id = $1
      `,
      [args.sessionRow.id],
    );
    const existingByKey = new Map<string, any>(
      (Array.isArray(existingRows) ? existingRows : []).map((row: any) => [String(row?.suggestion_key || ''), row]),
    );
    const currentKeys = drafts.map((draft) => draft.suggestionKey);

    if (currentKeys.length > 0) {
      await tenantDb.query(
        `
          DELETE FROM post_visit_billing_suggestions
          WHERE session_id = $1
            AND NOT (suggestion_key = ANY($2::text[]))
            AND status <> 'approved'
        `,
        [args.sessionRow.id, currentKeys],
      );
    } else {
      await tenantDb.query(
        `
          DELETE FROM post_visit_billing_suggestions
          WHERE session_id = $1
            AND status <> 'approved'
        `,
        [args.sessionRow.id],
      );
    }

    const source = String(args.source || 'post_visit_billing_intelligence_v1').trim() || 'post_visit_billing_intelligence_v1';
    for (const draft of drafts) {
      const metadata = {
        ...(draft.metadata || {}),
        documentation: {
          score: documentation.score,
          status: documentation.status,
          gaps: documentation.gaps,
        },
        refreshed_at: new Date().toISOString(),
      };
      const upsertedRows = await tenantDb.query(
        `
          INSERT INTO post_visit_billing_suggestions (
            session_id,
            patient_id,
            suggestion_key,
            code_type,
            code,
            description,
            confidence,
            justification,
            documentation_checks,
            documentation_score,
            documentation_status,
            status,
            source,
            metadata
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,'proposed',$12,$13::jsonb
          )
          ON CONFLICT (session_id, suggestion_key) DO UPDATE
          SET code_type = EXCLUDED.code_type,
              code = EXCLUDED.code,
              description = EXCLUDED.description,
              confidence = EXCLUDED.confidence,
              justification = EXCLUDED.justification,
              documentation_checks = EXCLUDED.documentation_checks,
              documentation_score = EXCLUDED.documentation_score,
              documentation_status = EXCLUDED.documentation_status,
              status = CASE
                WHEN post_visit_billing_suggestions.status = 'approved' THEN post_visit_billing_suggestions.status
                ELSE 'proposed'
              END,
              approved_by = CASE
                WHEN post_visit_billing_suggestions.status = 'approved' THEN post_visit_billing_suggestions.approved_by
                ELSE NULL
              END,
              approved_at = CASE
                WHEN post_visit_billing_suggestions.status = 'approved' THEN post_visit_billing_suggestions.approved_at
                ELSE NULL
              END,
              approval_note = CASE
                WHEN post_visit_billing_suggestions.status = 'approved' THEN post_visit_billing_suggestions.approval_note
                ELSE NULL
              END,
              source = EXCLUDED.source,
              metadata = EXCLUDED.metadata,
              updated_at = NOW()
          RETURNING *
        `,
        [
          args.sessionRow.id,
          args.sessionRow.patient_id,
          draft.suggestionKey,
          draft.codeType,
          draft.code,
          draft.description,
          draft.confidence,
          draft.justification,
          JSON.stringify(documentation.checks),
          documentation.score,
          documentation.status,
          source,
          JSON.stringify(metadata),
        ],
      );
      const updatedRow = upsertedRows[0];
      const existing = existingByKey.get(draft.suggestionKey);

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
          args.sessionRow.id,
          updatedRow.id,
          existing ? 'refreshed' : 'generated',
          args.actorUserId || null,
          existing ? 'Billing suggestion refreshed from latest draft artifacts.' : 'Billing suggestion generated from draft artifacts.',
          JSON.stringify(existing ? this.mapBillingSuggestion(existing) : {}),
          JSON.stringify(this.mapBillingSuggestion(updatedRow)),
          JSON.stringify({
            source,
            documentation_score: documentation.score,
            documentation_status: documentation.status,
          }),
        ],
      );
    }

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
      [args.sessionRow.id],
    );

    return {
      featureEnabled: true,
      documentation,
      suggestions: rows.map((row: any) => this.mapBillingSuggestion(row)),
    };
  }

  private simplifyClinicalLanguage(value: string): string {
    let text = String(value || '').trim();
    if (!text) return '';
    const replacements: Array<[RegExp, string]> = [
      [/\bhypertension\b/gi, 'high blood pressure'],
      [/\bmyocardial infarction\b/gi, 'heart attack'],
      [/\bdyspnea\b/gi, 'shortness of breath'],
      [/\badherence\b/gi, 'taking medicine as directed'],
      [/\bmonitoring\b/gi, 'regular checking'],
      [/\bevaluation\b/gi, 'checkup'],
      [/\bprophylaxis\b/gi, 'prevention treatment'],
      [/\bcontraindicated\b/gi, 'not safe together'],
    ];
    for (const [pattern, replacement] of replacements) {
      text = text.replace(pattern, replacement);
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  private estimateLiteracyScore(value: string): { score: number; level: 'easy' | 'moderate' | 'hard' } {
    const text = String(value || '').trim();
    if (!text) {
      return { score: 100, level: 'easy' };
    }
    const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
    const words = text.split(/\s+/).map((part) => part.trim()).filter(Boolean);
    const sentenceCount = Math.max(1, sentences.length);
    const wordCount = Math.max(1, words.length);
    const averageWordsPerSentence = wordCount / sentenceCount;
    const averageWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;

    const score = Math.max(0, Math.min(100, Math.round(100 - averageWordsPerSentence * 1.4 - averageWordLength * 5.5)));
    if (score >= 70) {
      return { score, level: 'easy' };
    }
    if (score >= 45) {
      return { score, level: 'moderate' };
    }
    return { score, level: 'hard' };
  }

  private localizePlainSummary(value: string, language: string): string {
    const normalizedLanguage = this.normalizeLanguage(language || 'en');
    const text = String(value || '').trim();
    if (!text) return '';
    if (normalizedLanguage === 'sn') {
      return `Pfupiso yekushanya kwanhasi: ${text}`;
    }
    if (normalizedLanguage === 'nd') {
      return `Isifinyezo sokuhlangana kwanamhlanje: ${text}`;
    }
    return text;
  }

  private buildTeachBackQuestions(keyPoints: string[], language: string): string[] {
    const normalizedLanguage = this.normalizeLanguage(language || 'en');
    const prompts =
      normalizedLanguage === 'sn'
        ? [
            'Mungatsanangura nemazwi enyu kuti muchaita sei:',
            'Kana zviratidzo zvikawedzera, muchaita sei:',
            'Ndeipi nguva yekudzoka muchipatara yamanzwisisa:',
          ]
        : normalizedLanguage === 'nd'
          ? [
              'Ungachaza ngamazwi akho ukuthi uzakwenza njani:',
              'Nxa izimpawu zisiba zimbi, uzakwenzani:',
              'Yisiphi isikhathi sokubuya esivunyelwene:',
            ]
          : [
              'Can you explain in your own words how you will do this step:',
              'If symptoms get worse, what will you do first:',
              'What follow-up date or timing did you understand:',
            ];
    return keyPoints
      .filter((point) => point.length > 0)
      .slice(0, 3)
      .map((point, index) => `${prompts[index] || prompts[prompts.length - 1]} ${point}`);
  }

  private buildCompanionTopicChecklist(summary: string, plan: string, keyPoints: string[]): string[] {
    const combined = `${summary} ${plan}`.toLowerCase();
    const topics: string[] = [];
    if (/(medication|dose|tablet|medicine|drug)/i.test(combined)) {
      topics.push('Medication schedule and dose clarity');
    }
    if (/(follow|review|return|appointment|clinic)/i.test(combined)) {
      topics.push('Follow-up date and return plan');
    }
    if (/(danger|worse|urgent|emergency|warning|severe|pain|bleeding|breathing)/i.test(combined)) {
      topics.push('Warning signs and escalation plan');
    }
    if (topics.length === 0) {
      topics.push('Key care instructions');
    }

    const extraPoints = keyPoints
      .slice(0, 2)
      .map((point) => point.replace(/\s+/g, ' ').trim())
      .filter((point) => point.length > 0)
      .map((point) => `Confirm understanding: ${point}`);

    return [...topics, ...extraPoints].slice(0, 5);
  }

  private buildVisitSummaryContent(args: {
    patientContext: any;
    soapNote: any;
    extractedEntities: any[];
    session: any;
  }) {
    const patientName =
      args.patientContext?.patient?.fullName ||
      `${args.patientContext?.patient?.firstName || ''} ${args.patientContext?.patient?.lastName || ''}`.trim() ||
      'Patient';
    const subjective = String(args.soapNote?.subjective || '').trim();
    const objective = String(args.soapNote?.objective || '').trim();
    const assessment = String(args.soapNote?.assessment || '').trim();
    const plan = String(args.soapNote?.plan || '').trim();

    const keyPoints = [subjective, objective, assessment, plan]
      .flatMap((part) => this.splitIntoPhrases(part))
      .slice(0, 8);

    const plainLanguageSummaryRaw = [
      `Today ${patientName} was reviewed.`,
      assessment ? `Main clinical assessment: ${assessment}.` : '',
      plan ? `Next steps: ${plan}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const simplifiedSummary = this.simplifyClinicalLanguage(plainLanguageSummaryRaw);
    const preferredLanguage = this.normalizeLanguage(
      args.session?.language || args.patientContext?.patient?.preferredLanguage || 'en',
    );
    const localizedPlainLanguageSummary = this.localizePlainSummary(simplifiedSummary, preferredLanguage);
    const literacy = this.estimateLiteracyScore(localizedPlainLanguageSummary);
    const teachBackQuestions = this.isMultilingualTeachBackEnabled()
      ? this.buildTeachBackQuestions(keyPoints.length ? keyPoints : [plan || assessment || subjective], preferredLanguage)
      : [];
    const companionTopicChecklist = this.isMultilingualTeachBackEnabled()
      ? this.buildCompanionTopicChecklist(localizedPlainLanguageSummary, plan, keyPoints)
      : [];

    return {
      summary_text: [subjective, objective, assessment, plan].filter(Boolean).join('\n\n'),
      plain_language_summary: localizedPlainLanguageSummary || simplifiedSummary || plainLanguageSummaryRaw,
      key_points: keyPoints,
      language: preferredLanguage,
      literacy_score: literacy.score,
      literacy_level: literacy.level,
      teach_back_questions: teachBackQuestions,
      companion_topic_checklist: companionTopicChecklist,
      generated_from: {
        sessionId: args.session.id,
        sourceType: args.session.source_type,
        extractedEntityCount: args.extractedEntities.length,
      },
    };
  }

  private mapOrderPriorityFromUrgency(urgency?: string) {
    const normalized = String(urgency || '').toLowerCase();
    if (normalized === 'stat' || normalized === 'urgent') {
      return 'urgent';
    }
    return 'normal';
  }

  private mapLabPriorityFromUrgency(urgency?: string) {
    const normalized = String(urgency || '').toLowerCase();
    if (normalized === 'stat') return 'stat';
    if (normalized === 'urgent') return 'urgent';
    return 'routine';
  }

  private async createGeneralOrderFromRecommendation(
    tenantDb: DataSource,
    args: {
      sessionRow: any;
      recommendation: Record<string, any>;
      actorUserId: string;
      note?: string;
    },
  ) {
    const actionType = String(args.recommendation.action_type || '').toLowerCase();
    const mappedOrderType =
      actionType === 'medication'
        ? 'medication'
        : actionType === 'monitoring'
          ? 'activity'
          : actionType === 'follow_up' || actionType === 'referral'
            ? 'consultation'
            : 'procedure';

    const instructions = [
      String(args.recommendation.description || '').trim(),
      args.note ? `Doctor note: ${args.note}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const rows = await tenantDb.query(
      `
        INSERT INTO orders (
          patient_id,
          appointment_id,
          doctor_id,
          order_type,
          order_name,
          description,
          instructions,
          priority,
          status,
          authorized_by,
          authorized_at,
          execution_notes,
          external_codes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'authorized',$3,NOW(),$9,$10::jsonb)
        RETURNING id, order_type, order_name, status, priority, created_at
      `,
      [
        args.sessionRow.patient_id,
        args.sessionRow.appointment_id || null,
        args.actorUserId,
        mappedOrderType,
        String(args.recommendation.title || args.recommendation.id || 'Post-visit action'),
        String(args.recommendation.description || '').trim() || null,
        instructions || 'Follow post-visit recommendation.',
        this.mapOrderPriorityFromUrgency(args.recommendation.urgency),
        args.note || null,
        JSON.stringify({
          source: 'post_visit_recommendation_execute',
          session_id: args.sessionRow.id,
          recommendation_id: args.recommendation.id || null,
          rule_id: args.recommendation.rule_id || null,
        }),
      ],
    );
    return {
      resourceType: 'order',
      resourceId: rows[0].id,
      payload: rows[0],
    };
  }

  private async createLabOrderFromRecommendation(
    tenantDb: DataSource,
    args: {
      sessionRow: any;
      recommendation: Record<string, any>;
      actorUserId: string;
      note?: string;
    },
  ) {
    const countRows = await tenantDb.query(`SELECT COUNT(*)::int AS count FROM lab_orders`);
    const totalCount = Number(countRows?.[0]?.count || 0);
    const orderNumber = `LAB${String(totalCount + 1).padStart(8, '0')}`;

    const defaultTestName = String(args.recommendation.title || 'Post-visit test').trim();
    const defaultTestCode = String(args.recommendation.rule_id || args.recommendation.id || 'POSTVISIT').trim();
    const testPayload =
      Array.isArray(args.recommendation.actionPayload?.tests) && args.recommendation.actionPayload.tests.length
        ? args.recommendation.actionPayload.tests
        : [
            {
              testCode: defaultTestCode,
              testName: defaultTestName,
              category: 'chemistry',
              specimenType: 'blood',
              instructions: String(args.recommendation.description || '').trim() || undefined,
            },
          ];

    const rows = await tenantDb.query(
      `
        INSERT INTO lab_orders (
          order_number,
          patient_id,
          ordering_provider_id,
          tests,
          priority,
          status,
          clinical_info,
          special_instructions,
          payment_status
        ) VALUES ($1,$2,$3,$4::jsonb,$5,'ordered',$6,$7,'payment_confirmed')
        RETURNING id, order_number, status, priority, created_at
      `,
      [
        orderNumber,
        args.sessionRow.patient_id,
        args.actorUserId,
        JSON.stringify(testPayload),
        this.mapLabPriorityFromUrgency(args.recommendation.urgency),
        String(args.recommendation.description || '').trim() || null,
        args.note || null,
      ],
    );

    return {
      resourceType: 'lab_order',
      resourceId: rows[0].id,
      payload: rows[0],
    };
  }

  private async syncRecommendationExecutionIntoArtifact(
    tenantDb: DataSource,
    args: {
      sessionId: string;
      recommendationId: string;
      execution: Record<string, any>;
      actorUserId: string;
    },
  ) {
    const artifact = await this.getArtifactRow(tenantDb, args.sessionId, 'recommendation_bundle');
    if (!artifact) return;

    const content = artifact.content && typeof artifact.content === 'object' ? { ...artifact.content } : {};
    const actionExecutions =
      content.action_executions && typeof content.action_executions === 'object'
        ? { ...content.action_executions }
        : {};
    actionExecutions[args.recommendationId] = args.execution;
    content.action_executions = actionExecutions;

    if (Array.isArray(content.items)) {
      content.items = content.items.map((item: any) => {
        if (String(item?.id) !== String(args.recommendationId)) {
          return item;
        }
        return {
          ...item,
          execution: args.execution,
        };
      });
    }

    await this.upsertDraftArtifact(tenantDb, {
      sessionId: args.sessionId,
      artifactType: 'recommendation_bundle',
      content,
      citations: Array.isArray(artifact.citations) ? artifact.citations : [],
      confidence: typeof artifact.confidence === 'number' ? artifact.confidence : null,
      generatedBy: 'post_visit_execute',
      actorUserId: args.actorUserId,
      artifactStatus: artifact.artifact_status || 'draft',
    });
  }

  private async safeSyncCrossModuleWorkflow(
    tenantDb: DataSource,
    args: {
      sessionRow: any;
      recommendation: Record<string, any>;
      actorUserId: string;
      result: { resourceType: string; resourceId: string; payload: Record<string, any> };
    },
  ) {
    const actionType = String(args.recommendation.action_type || '').toLowerCase();
    const workflowKey = `post_visit:${args.sessionRow.id}:${args.recommendation.id}`;
    try {
      await tenantDb.query(
        `
          INSERT INTO nurse_cross_module_workflow_state (
            workflow_key,
            module,
            item_type,
            source_record_id,
            patient_id,
            status,
            destination_role,
            destination_service,
            destination_specialty,
            completed_by,
            completed_at,
            note,
            context
          ) VALUES (
            $1,
            'post_visit',
            $2,
            $3,
            $4,
            'completed',
            'doctor',
            'post_visit',
            'General Medicine',
            $5,
            NOW(),
            $6,
            $7::jsonb
          )
          ON CONFLICT (workflow_key) DO UPDATE
          SET status = 'completed',
              completed_by = EXCLUDED.completed_by,
              completed_at = EXCLUDED.completed_at,
              note = EXCLUDED.note,
              context = EXCLUDED.context,
              updated_at = NOW()
        `,
        [
          workflowKey,
          actionType || 'follow_up',
          String(args.sessionRow.id),
          args.sessionRow.patient_id,
          args.actorUserId,
          `Executed from post-visit recommendation ${args.recommendation.id}`,
          JSON.stringify({
            source: 'post_visit_execute',
            recommendation_id: args.recommendation.id,
            result_resource_type: args.result.resourceType,
            result_resource_id: args.result.resourceId,
          }),
        ],
      );
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('nurse_cross_module_workflow_state')) {
        return;
      }
      throw error;
    }
  }

  async createSession(
    tenantDb: DataSource,
    dto: CreatePostVisitSessionDto,
    requestContext: { tenantId?: string; actorUserId?: string | null } = {},
  ) {
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

  async getSession(tenantDb: DataSource, sessionId: string) {
    await this.ensurePostVisitSchema(tenantDb);
    const row = await this.getSessionRow(tenantDb, sessionId);
    return this.mapSession(row);
  }

  async listSessions(
    tenantDb: DataSource,
    options: ListPostVisitSessionsOptions = {},
  ) {
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

  async getSessionDraft(tenantDb: DataSource, sessionId: string) {
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
          speakerRole: row.speaker_role || 'unknown',
          diarizationConfidence:
            row.diarization_confidence === null || row.diarization_confidence === undefined
              ? null
              : Number(row.diarization_confidence),
          speakerAssignmentStatus: row.speaker_assignment_status || 'unresolved',
          needsReview: row.needs_review === true,
          reviewedBy: row.reviewed_by || null,
          reviewedAt: row.reviewed_at || null,
        })),
      },
      reviewActions: reviewActions.map((row: any) => ({
        id: row.id,
        artifactId: row.artifact_id,
        artifactType: row.artifact_type,
        action: row.action,
        reason: row.review_reason,
        metadata: row.review_metadata || {},
        reviewedBy: row.reviewed_by,
        source: row.source,
        createdAt: row.created_at,
      })),
      ruleCitations: ruleCitations.map((row: any) => ({
        id: row.id,
        recommendationId: row.recommendation_id,
        ruleId: row.rule_id,
        guidelineId: row.guideline_id,
        label: row.citation_label,
        source: row.citation_source,
        url: row.citation_url,
        excerpt: row.evidence_excerpt,
        confidence: row.confidence,
        relevanceScore:
          row.relevance_score === null || row.relevance_score === undefined ? null : Number(row.relevance_score),
        citationYear: row.citation_year === null || row.citation_year === undefined ? null : Number(row.citation_year),
        isSuperseded: row.is_superseded === true,
        supersededByGuidelineId: row.superseded_by_guideline_id || null,
        acknowledgedSuperseded: row.doctor_acknowledged_superseded === true,
        acknowledgedBy: row.superseded_acknowledged_by || null,
        acknowledgedAt: row.superseded_acknowledged_at || null,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      })),
      actionExecutions: actionExecutions.map((row: any) => ({
        id: row.id,
        recommendationId: row.recommendation_id,
        actionKey: row.action_key,
        actionType: row.action_type,
        status: row.status,
        note: row.execution_note,
        resultResourceType: row.result_resource_type,
        resultResourceId: row.result_resource_id,
        resultPayload: row.result_payload || {},
        errorMessage: row.error_message,
        executedBy: row.executed_by,
        executedAt: row.executed_at,
        source: row.source,
        metadata: row.metadata || {},
      })),
      documentIntelligence: documentIntelligenceRows.map((row: any) => ({
        id: row.id,
        documentType: row.document_type,
        documentName: row.document_name,
        mimeType: row.mime_type || null,
        fileSize: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
        extractionStatus: row.extraction_status,
        duplicateOfDocumentId: row.duplicate_of_document_id || null,
        duplicateSimilarity:
          row.duplicate_similarity === null || row.duplicate_similarity === undefined
            ? null
            : Number(row.duplicate_similarity),
        ocrEngine: row.ocr_engine || null,
        ocrConfidence:
          row.ocr_confidence === null || row.ocr_confidence === undefined
            ? null
            : Number(row.ocr_confidence),
        extractedText: row.extracted_text || null,
        structured: row.structured_payload || {},
        fhirResources: row.fhir_resources || [],
        criticalFlags: row.critical_flags || [],
        criticalDetected: row.critical_detected === true,
        criticalRouted: row.critical_routed === true,
        escalationEventId: row.escalation_event_id || null,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      })),
      billingIntelligence: {
        featureEnabled: this.isBillingIntelligenceEnabled(),
        documentation: billingDocumentation,
        suggestions: billingSuggestions,
        summary: billingSummary,
      },
    };
  }

  async getSessionBillingIntelligence(
    tenantDb: DataSource,
    sessionId: string,
  ) {
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
    return {
      featureEnabled: this.isBillingIntelligenceEnabled(),
      sessionId,
      patientId: sessionRow.patient_id,
      documentation: this.buildBillingDocumentationSummaryFromSuggestionRows(rows),
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

  async reviewBillingSuggestion(
    tenantDb: DataSource,
    sessionId: string,
    suggestionId: string,
    payload: ReviewPostVisitBillingSuggestionDto,
    options: { actorUserId?: string | null } = {},
  ) {
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
    options: { actorUserId?: string | null; forceRefresh?: boolean } = {},
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
          metadata
        ) VALUES (
          $1,$2,$3,$4,'active',$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,NOW(),$12::jsonb
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
      ],
    );

    return {
      featureEnabled: true,
      ...this.mapPreVisitBrief(upsertedRows[0]),
      reused: false,
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

    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated doctor user is required to sign admin documents');
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

    return {
      featureEnabled: true,
      sessionId,
      generatedCount: documents.length,
      documents,
    };
  }

  async listSessionAdminDocuments(
    tenantDb: DataSource,
    sessionId: string,
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

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
    return {
      featureEnabled: true,
      sessionId,
      documents: rows.map((row: any) => this.mapAdminDocument(row)),
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

      const sourceUrl = `https://clinicaltrials.gov/study/${id}`;
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
    args: { sessionId: string; routeTarget: 'doctor' | 'nurse' },
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
      routeTarget: 'doctor' | 'nurse';
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
    await this.ensurePostVisitSchema(tenantDb);
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);

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

  async listSessionCompanionMemory(
    tenantDb: DataSource,
    sessionId: string,
    options: { limit?: number; includeInactive?: boolean } = {},
  ) {
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

  async curateCompanionMemory(
    tenantDb: DataSource,
    sessionId: string,
    memoryId: string,
    payload: CuratePostVisitCompanionMemoryDto,
    options: { actorUserId?: string | null } = {},
  ) {
    await this.ensurePostVisitSchema(tenantDb);
    if (!this.isCompanionMemoryEnabled()) {
      throw new BadRequestException('Companion memory is disabled by feature flag');
    }
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const action = String(payload.action || '').toLowerCase() as PostVisitCompanionMemoryCurationAction;
    if (!['promote', 'retire', 'reactivate'].includes(action)) {
      throw new BadRequestException('Invalid companion memory curation action');
    }

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
        profile: ['https://medicore.health/fhir/StructureDefinition/post-visit-encounter'],
        tag: [{ system: 'https://medicore.health/fhir/tags', code: 'post-visit' }],
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

  async reviewDraftArtifact(
    tenantDb: DataSource,
    sessionId: string,
    payload: ReviewPostVisitArtifactDto,
    options: { tenantId?: string; actorUserId?: string | null; source?: string } = {},
  ) {
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
    payload: { note?: string; publishMetadata?: Record<string, any>; acknowledgedSupersededCitationIds?: string[] } = {},
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

    const thread = await this.ensureCompanionThread(tenantDb, updatedSessionRows[0], options.actorUserId);

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
          updatedSessionRows[0].patient_id,
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

    return {
      session: this.mapSession(updatedSessionRows[0]),
      companionThread: {
        id: thread.id,
        status: thread.status,
        messageCount: thread.message_count,
        lastMessageAt: thread.last_message_at || null,
      },
    };
  }

  async listPatientSessions(
    tenantDb: DataSource,
    patientId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
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

    return {
      session: this.mapSession(sessionRow),
      summary: {
        plainLanguageSummary: visitSummaryArtifact.content?.plain_language_summary || '',
        keyPoints: Array.isArray(visitSummaryArtifact.content?.key_points)
          ? visitSummaryArtifact.content.key_points
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

    const assistantAnswer = await this.buildGroundedCompanionAnswer({
      sessionId,
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
    const drafts = this.detectIntraVisitAlertDrafts(text);
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

    if (!audioFile?.buffer || !Buffer.isBuffer(audioFile.buffer) || audioFile.buffer.length === 0) {
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

  async listIntraVisitAlerts(
    tenantDb: DataSource,
    sessionId: string,
    filters: {
      status?: IntraVisitAlertStatus;
      limit?: number;
      offset?: number;
    } = {},
  ) {
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

  async acknowledgeIntraVisitAlert(
    tenantDb: DataSource,
    sessionId: string,
    alertId: string,
    payload: { note?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
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

    return this.mapIntraVisitAlertEvent(updatedRows[0]);
  }

  async resolveIntraVisitAlert(
    tenantDb: DataSource,
    sessionId: string,
    alertId: string,
    payload: { status?: 'confirmed' | 'dismissed'; note?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
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

  async resolveEscalation(
    tenantDb: DataSource,
    escalationId: string,
    payload: { status?: 'resolved' | 'dismissed'; resolutionNote?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
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

    return {
      ...persisted,
      soapNote: result.soap_note || null,
      audioUrl: result.audio_url || null,
    };
  }
}
