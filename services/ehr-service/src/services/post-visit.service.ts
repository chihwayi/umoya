import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import 'multer';
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

interface EscalationDetectionResult {
  detected: boolean;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  routeTarget: 'emergency' | 'doctor' | 'nurse';
  triggerTerms: string[];
  triggerType: string;
  slaMinutes: number;
}

@Injectable()
export class PostVisitService {
  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly patientService: PatientService,
    private readonly notificationsService?: NotificationsService,
    private readonly emailService?: EmailService,
    private readonly patientNotificationsService?: PatientNotificationsService,
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
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
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
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
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
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_extracted_entities_session ON post_visit_extracted_entities(session_id, entity_type)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_draft_artifacts_session ON post_visit_draft_artifacts(session_id, artifact_type)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_session ON post_visit_review_actions(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_artifact ON post_visit_review_actions(artifact_type, action)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_session ON post_visit_rule_citations(session_id, rule_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_guideline ON post_visit_rule_citations(guideline_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_session ON post_visit_action_executions(session_id, recommendation_id)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_status ON post_visit_action_executions(status, executed_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_session ON post_visit_companion_threads(session_id, status)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_patient ON post_visit_companion_threads(patient_id, last_message_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_session ON post_visit_companion_messages(session_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_thread ON post_visit_companion_messages(thread_id, created_at ASC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_patient ON post_visit_companion_messages(patient_id, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_escalation ON post_visit_companion_messages(escalation_detected, created_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_session ON post_visit_escalation_events(session_id, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_status ON post_visit_escalation_events(status, severity, detected_at DESC)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_route ON post_visit_escalation_events(route_target, status, sla_due_at)`);
    await tenantDb.query(`CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_patient ON post_visit_escalation_events(patient_id, detected_at DESC)`);
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

  private detectEscalationSignals(message: string): EscalationDetectionResult {
    const text = String(message || '').toLowerCase();
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
    ];
    const moderateTerms = [
      'dizziness',
      'nausea',
      'vomiting',
      'swelling',
      'rash',
      'side effects',
      'medication reaction',
    ];

    const matched = (terms: string[]) => terms.filter((term) => text.includes(term));
    const criticalMatches = matched(criticalTerms);
    if (criticalMatches.length) {
      return {
        detected: true,
        severity: 'critical',
        routeTarget: 'emergency',
        triggerTerms: criticalMatches,
        triggerType: 'symptom_keyword',
        slaMinutes: 15,
      };
    }

    const highMatches = matched(highTerms);
    if (highMatches.length) {
      return {
        detected: true,
        severity: 'high',
        routeTarget: 'doctor',
        triggerTerms: highMatches,
        triggerType: 'symptom_keyword',
        slaMinutes: 60,
      };
    }

    const moderateMatches = matched(moderateTerms);
    if (moderateMatches.length) {
      return {
        detected: true,
        severity: 'moderate',
        routeTarget: 'nurse',
        triggerTerms: moderateMatches,
        triggerType: 'symptom_keyword',
        slaMinutes: 240,
      };
    }

    return {
      detected: false,
      severity: 'low',
      routeTarget: 'nurse',
      triggerTerms: [],
      triggerType: 'none',
      slaMinutes: 0,
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
          detected_at,
          sla_due_at,
          metadata
        ) VALUES (
          $1,$2,$3,$4,'open',$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb
        )
        RETURNING *
      `,
      [
        args.sessionRow.id,
        args.sessionRow.patient_id,
        args.threadId,
        args.messageId,
        args.detection.severity,
        args.detection.routeTarget,
        args.detection.triggerType,
        JSON.stringify(args.detection.triggerTerms),
        args.messageText,
        detectedAt.toISOString(),
        slaDueAt ? slaDueAt.toISOString() : null,
        JSON.stringify({
          source: 'post_visit_companion_message',
          trigger_terms: args.detection.triggerTerms,
        }),
      ],
    );

    const inserted = rows[0];
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

  private buildGroundedCompanionAnswer(args: {
    question: string;
    visitSummaryArtifact: any;
    recommendationArtifact: any;
    escalation: EscalationDetectionResult;
  }) {
    if (args.escalation.detected && args.escalation.routeTarget === 'emergency') {
      return 'Your symptoms may be urgent. Please call emergency services now or go to the nearest emergency facility immediately.';
    }

    const summary = String(args.visitSummaryArtifact?.content?.plain_language_summary || '').trim();
    const recommendations = Array.isArray(args.recommendationArtifact?.content?.items)
      ? args.recommendationArtifact.content.items
      : [];
    const checklist = recommendations.slice(0, 3).map((item: any) => String(item?.title || '').trim()).filter(Boolean);
    const lowerQuestion = String(args.question || '').toLowerCase();

    if (lowerQuestion.includes('medicine') || lowerQuestion.includes('medication') || lowerQuestion.includes('dose')) {
      if (checklist.length) {
        return `Based on your approved visit plan, follow these medication-related actions: ${checklist.join('; ')}. If symptoms worsen, contact the clinic immediately.`;
      }
    }

    if (lowerQuestion.includes('when') || lowerQuestion.includes('follow up') || lowerQuestion.includes('next visit')) {
      if (checklist.length) {
        return `Your approved follow-up checklist includes: ${checklist.join('; ')}. Please complete these and keep your next review appointment.`;
      }
    }

    if (summary) {
      return `From your approved visit summary: ${summary} Please follow the checklist and contact the clinic if you have worsening symptoms.`;
    }

    return 'I can help with your approved visit plan and checklist. If you share your concern, I will guide you based on your doctor-approved instructions.';
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
            metadata
          ) VALUES ($1,'recommendation_bundle',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
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

  async getSessionDraft(tenantDb: DataSource, sessionId: string) {
    await this.ensurePostVisitSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    const [artifacts, extractedEntities, segments, reviewActions, ruleCitations, actionExecutions] = await Promise.all([
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
          SELECT segment_order, start_second, end_second, text, confidence, language
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
          SELECT id, recommendation_id, rule_id, guideline_id, citation_label, citation_source, citation_url, evidence_excerpt, confidence, metadata, created_at
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
          order: row.segment_order,
          start: Number(row.start_second),
          end: Number(row.end_second),
          text: row.text,
          confidence: row.confidence,
          language: row.language,
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

    const summaryContent = this.buildVisitSummaryContent({
      patientContext,
      soapNote,
      extractedEntities: extractedEntityRows,
      session: sessionRow,
    });

    const rules = this.buildRecommendationRules(patientContext, extractedEntityRows);
    const executionByRecommendationId = new Map<string, any>(
      actionExecutionRows.map((row: any) => [String(row.recommendation_id), row]),
    );

    const recommendationItems = rules.map((rule) => ({
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

  async publishSession(
    tenantDb: DataSource,
    sessionId: string,
    payload: { note?: string; publishMetadata?: Record<string, any> } = {},
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
          publish_metadata: payload.publishMetadata || {},
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

    const detection = this.detectEscalationSignals(messageText);
    let escalation: any = null;
    if (detection.detected) {
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

    const assistantMessageText = this.buildGroundedCompanionAnswer({
      question: messageText,
      visitSummaryArtifact,
      recommendationArtifact,
      escalation: detection,
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
        assistantMessageText,
        JSON.stringify(groundedContext),
        detection.detected,
        escalation?.id || null,
        JSON.stringify({
          source: 'post_visit_companion_assistant',
          escalation_route: detection.detected ? detection.routeTarget : null,
          escalation_severity: detection.detected ? detection.severity : null,
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
      escalation: escalation ? this.mapEscalationEvent(escalation) : null,
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

  async listEscalations(
    tenantDb: DataSource,
    filters: {
      status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
      severity?: 'low' | 'moderate' | 'high' | 'critical';
      routeTarget?: 'emergency' | 'doctor' | 'nurse';
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
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (!segment || typeof segment.text !== 'string') continue;
      const start = Number(segment.start);
      const end = Number(segment.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      await tenantDb.query(
        `
          INSERT INTO post_visit_transcript_segments (
            session_id, segment_order, start_second, end_second, text, confidence, language, metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        `,
        [
          sessionId,
          i,
          start,
          end,
          segment.text.trim(),
          typeof result.confidence === 'number' ? result.confidence : null,
          normalizedLanguage,
          JSON.stringify({ source: options.source || 'transcription_pipeline' }),
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
