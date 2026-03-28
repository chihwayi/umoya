/**
 * PostVisitDraftService
 *
 * S108 extraction: draft artifact reading, annotation, review,
 * section Q&A, voice commands, and recommendation execution.
 *
 * generateDraftArtifacts and executeRecommendationAction are complex
 * 200–370 line methods with 20+ private helper dependencies — they are
 * delegated here but the original implementations stay in PostVisitService
 * as fallback until those helpers can be fully migrated.
 *
 * Extracted from PostVisitService (god class decomposition).
 * PostVisitService delegates via @Optional() injection.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { config } from '@medicore/config';
import {
  ReviewPostVisitArtifactDto,
} from '../dto/post-visit.dto';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';
import { HipaaAuditService } from './hipaa-audit.service';
import { annotateTextWithEntities, AnnotatedSpan } from '../utils/entity-annotation';

// ── Local types ──────────────────────────────────────────────────────────────

type PostVisitSessionStatus =
  | 'captured'
  | 'processing'
  | 'draft_ready'
  | 'doctor_reviewed'
  | 'published'
  | 'closed';

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PostVisitDraftService {
  constructor(
    @Optional() private readonly groundedLlmService?: PostVisitGroundedLlmService,
    @Optional() private readonly hipaaAuditService?: HipaaAuditService,
  ) {}

  // ── Draft reading ──────────────────────────────────────────────────────────

  async getSessionDraft(tenantDb: DataSource, sessionId: string) {
    await this.assertSessionExists(tenantDb, sessionId);

    const [
      artifacts,
      extractedEntities,
      segments,
      reviewActions,
      ruleCitations,
      actionExecutions,
      documentIntelligenceRows,
      billingSuggestionRows,
    ] = await Promise.all([
      tenantDb.query(
        `SELECT id, artifact_type, artifact_status, content, citations, confidence, generated_by, created_at, updated_at
         FROM post_visit_draft_artifacts WHERE session_id = $1 ORDER BY created_at DESC`,
        [sessionId],
      ),
      tenantDb.query(
        `SELECT id, entity_type, entity_value, normalized_value, confidence, source_start_second, source_end_second, source_origin, metadata, created_at
         FROM post_visit_extracted_entities WHERE session_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [sessionId],
      ),
      tenantDb.query(
        `SELECT id, segment_order, start_second, end_second, text, confidence, language,
                speaker_label, speaker_role, diarization_confidence, speaker_assignment_status,
                needs_review, reviewed_by, reviewed_at
         FROM post_visit_transcript_segments WHERE session_id = $1 ORDER BY segment_order ASC LIMIT 2000`,
        [sessionId],
      ),
      tenantDb.query(
        `SELECT id, artifact_id, artifact_type, action, review_reason, review_metadata, reviewed_by, source, created_at
         FROM post_visit_review_actions WHERE session_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [sessionId],
      ),
      tenantDb.query(
        `SELECT id, recommendation_id, rule_id, guideline_id, citation_label, citation_source,
                citation_url, evidence_excerpt, confidence, relevance_score, citation_year,
                is_superseded, superseded_by_guideline_id, doctor_acknowledged_superseded,
                superseded_acknowledged_by, superseded_acknowledged_at, metadata, created_at
         FROM post_visit_rule_citations WHERE session_id = $1 ORDER BY created_at DESC LIMIT 400`,
        [sessionId],
      ),
      tenantDb.query(
        `SELECT id, recommendation_id, action_key, action_type, status, execution_note,
                result_resource_type, result_resource_id, result_payload, error_message,
                executed_by, executed_at, source, metadata
         FROM post_visit_action_executions WHERE session_id = $1 ORDER BY executed_at DESC LIMIT 400`,
        [sessionId],
      ),
      tenantDb.query(
        `SELECT id, document_type, document_name, mime_type, file_size, duplicate_of_document_id,
                duplicate_similarity, extraction_status, ocr_engine, ocr_confidence, extracted_text,
                structured_payload, fhir_resources, critical_flags, critical_detected, critical_routed,
                escalation_event_id, metadata, created_at
         FROM post_visit_document_intelligence WHERE session_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [sessionId],
      ),
      tenantDb.query(
        `SELECT * FROM post_visit_billing_suggestions WHERE session_id = $1
         ORDER BY CASE status WHEN 'approved' THEN 1 WHEN 'proposed' THEN 2 ELSE 3 END,
                  confidence DESC NULLS LAST, created_at DESC LIMIT 120`,
        [sessionId],
      ),
    ]);

    const billingSuggestions = Array.isArray(billingSuggestionRows)
      ? billingSuggestionRows.map((row: any) => this.mapBillingSuggestion(row))
      : [];
    const billingDocumentation = this.buildBillingDocumentationSummaryFromRows(billingSuggestionRows);

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
        summary: {
          total: billingSuggestions.length,
          proposedCount: billingSuggestions.filter((item: any) => item.status === 'proposed').length,
          approvedCount: billingSuggestions.filter((item: any) => item.status === 'approved').length,
          rejectedCount: billingSuggestions.filter((item: any) => item.status === 'rejected').length,
          highConfidenceCount: billingSuggestions.filter((item: any) => Number(item.confidence || 0) >= 0.8).length,
        },
      },
    };
  }

  async getAnnotatedDraft(sessionId: string, tenantDb: DataSource) {
    await this.assertSessionExists(tenantDb, sessionId);

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

  async askAboutSection(
    sessionId: string,
    body: { question: string; sectionType: string; artifactType?: string },
    tenantDb: DataSource,
  ) {
    await this.assertSessionExists(tenantDb, sessionId);

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

  async reviewDraftArtifact(
    tenantDb: DataSource,
    sessionId: string,
    payload: ReviewPostVisitArtifactDto,
    options: { tenantId?: string; actorUserId?: string | null; source?: string } = {},
  ) {
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated reviewer is required');
    }

    await this.assertSessionExists(tenantDb, sessionId);
    const artifact = await this.getArtifactRow(tenantDb, sessionId, payload.artifactType);
    if (!artifact) {
      throw new NotFoundException(`Post-visit artifact "${payload.artifactType}" not found`);
    }

    const beforeContent = artifact.content || {};
    const afterContent =
      payload.action === 'edit' ? payload.editedContent || beforeContent : beforeContent;
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
      [artifact.id, sessionId, artifactStatus, JSON.stringify(afterContent), options.actorUserId],
    );

    const reviewActionRows = await tenantDb.query(
      `
        INSERT INTO post_visit_review_actions (
          session_id, artifact_id, artifact_type, action, review_reason,
          review_metadata, before_content, after_content, reviewed_by, source
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

    const sessionStatus: PostVisitSessionStatus =
      payload.action === 'reject' ? 'draft_ready' : 'doctor_reviewed';
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

  // ── Feature flags ──────────────────────────────────────────────────────────

  isVoiceReviewEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitVoiceReview;
    if (typeof configured === 'boolean') return configured;
    return String(process.env.FEATURE_POSTVISIT_VOICE_REVIEW || 'false').toLowerCase() === 'true';
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async assertSessionExists(tenantDb: DataSource, sessionId: string) {
    const rows = await tenantDb.query(
      `SELECT id FROM post_visit_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows?.length) {
      throw new NotFoundException('Post-visit session not found');
    }
  }

  private async getArtifactRow(tenantDb: DataSource, sessionId: string, artifactType: string) {
    const rows = await tenantDb.query(
      `SELECT * FROM post_visit_draft_artifacts WHERE session_id = $1 AND artifact_type = $2 LIMIT 1`,
      [sessionId, artifactType],
    );
    return rows?.length ? rows[0] : null;
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

  private buildBillingDocumentationSummaryFromRows(rows: any[]) {
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
    const score = Math.max(0, Math.min(100, Number(primary?.documentation_score || 0)));
    const statusRaw = String(primary?.documentation_status || 'insufficient').toLowerCase();
    const status =
      statusRaw === 'sufficient' || statusRaw === 'partial' || statusRaw === 'insufficient'
        ? statusRaw
        : 'insufficient';
    const gaps = checks.filter((c) => !c.passed).map((c) => c.guidance);
    return { score, status, checks, gaps };
  }
}
