import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import 'multer';
import axios from 'axios';
import * as FormData from 'form-data';
import { createHash } from 'crypto';
import {
  CreatePostVisitSessionDto,
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
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_patient ON post_visit_escalation_events(patient_id, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_confidence ON post_visit_escalation_events(classification_confidence DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_temporality ON post_visit_escalation_events(classification_temporality, status, detected_at DESC)`);
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

  private resolveLocalOcrUrl(): string {
    const direct = String(process.env.LOCAL_OCR_URL || '').trim();
    if (direct) {
      return direct.replace(/\/+$/, '');
    }
    return 'http://127.0.0.1:8081';
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

    if (lowerQuestion.includes('medicine') || lowerQuestion.includes('medication') || lowerQuestion.includes('dose')) {
      if (checklist.length) {
        return {
          answer: `Based on your approved visit plan, follow these medication-related actions: ${checklist.join('; ')}. If symptoms worsen, contact the clinic immediately.${clinicianEscalationSuffix}`,
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
          answer: `Your approved follow-up checklist includes: ${checklist.join('; ')}. Please complete these and keep your next review appointment.${clinicianEscalationSuffix}`,
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
        answer: `From your approved visit summary: ${summary} Please follow the checklist and contact the clinic if you have worsening symptoms.${clinicianEscalationSuffix}`,
        source: 'deterministic',
        citationsUsed: citationCatalog.map((citation) => citation.id).slice(0, 3),
        model: llmModelAttempt,
        abstained: llmAbstainedAttempt,
        llmAudit: llmAuditAttempt,
      };
    }

    return {
      answer:
        `I can help with your approved visit plan and checklist. If you share your concern, I will guide you based on your doctor-approved instructions.${clinicianEscalationSuffix}`.trim(),
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

    const activePrescriptionCount =
      Number(modules?.pharmacy?.activePrescriptionCount || 0) ||
      Number(modules?.pharmacy?.active_count || 0);
    if (activePrescriptionCount > 0) {
      rules.push({
        ruleId: 'medication_adherence_reinforcement_rule',
        recommendationId: 'medication_adherence_reinforcement',
        title: 'Medication adherence reinforcement',
        description:
          'Issue plain-language medication adherence reminders and confirm patient understanding via teach-back.',
        urgency: 'routine',
        actionType: 'medication',
        confidence: 0.78,
        context: {
          activePrescriptionCount,
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

    const plainLanguageSummary = [
      `Today ${patientName} was reviewed.`,
      assessment ? `Main clinical assessment: ${assessment}.` : '',
      plan ? `Next steps: ${plan}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      summary_text: [subjective, objective, assessment, plan].filter(Boolean).join('\n\n'),
      plain_language_summary: plainLanguageSummary,
      key_points: keyPoints,
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

    const [artifacts, extractedEntities, segments, reviewActions, ruleCitations, actionExecutions, documentIntelligenceRows] = await Promise.all([
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
    ]);

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

    const rules = this.buildRecommendationRules(patientContext, extractedEntityRows);
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

  async listEscalations(
    tenantDb: DataSource,
    filters: {
      status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
      severity?: 'low' | 'moderate' | 'high' | 'critical';
      routeTarget?: 'emergency' | 'doctor' | 'nurse';
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
        FROM post_visit_escalation_events
      `,
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
    const endpoint = `${baseUrl}/extract`;
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
