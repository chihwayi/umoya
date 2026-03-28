/**
 * PostVisitBillingIntelligenceService
 *
 * S108 extraction: billing suggestion generation, documentation sufficiency scoring,
 * suggestion review/approval, workflow routing to accounts.
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
import { ReviewPostVisitBillingSuggestionDto } from '../dto/post-visit.dto';
import { HipaaAuditService, HipaaAuditAction } from './hipaa-audit.service';

// ─── Local types (not exported from dto) ─────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PostVisitBillingIntelligenceService {
  constructor(
    @Optional() private readonly hipaaAuditService?: HipaaAuditService,
  ) {}

  // ── Feature flag ───────────────────────────────────────────────────────────

  isBillingIntelligenceEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitBillingIntelligence;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE || 'false').toLowerCase() === 'true';
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async getSessionBillingIntelligence(
    tenantDb: DataSource,
    sessionId: string,
    options: { actorUserId?: string | null } = {},
  ) {
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

  async reviewBillingSuggestion(
    tenantDb: DataSource,
    sessionId: string,
    suggestionId: string,
    payload: ReviewPostVisitBillingSuggestionDto,
    options: { actorUserId?: string | null } = {},
  ) {
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

  /**
   * Called from draft generation pipeline (PostVisitService.generateSessionDraft).
   * Upserts billing suggestions based on latest SOAP/summary/recommendation artifacts.
   */
  async refreshSessionBillingIntelligence(
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
          existing
            ? 'Billing suggestion refreshed from latest draft artifacts.'
            : 'Billing suggestion generated from draft artifacts.',
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

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getSessionRow(tenantDb: DataSource, sessionId: string) {
    const rows = await tenantDb.query(
      `SELECT * FROM post_visit_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows?.length) {
      throw new NotFoundException('Post-visit session not found');
    }
    return rows[0];
  }

  mapBillingSuggestion(row: any) {
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

    return { score, status, checks, gaps };
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

    return { score, status, checks, gaps };
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
        (item) =>
          item.codeType === draft.codeType &&
          String(item.code).toUpperCase() === String(draft.code).toUpperCase(),
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
      confidence: Math.min(
        0.98,
        Number((cptConfidenceBase * (0.6 + args.documentation.score / 250)).toFixed(2)),
      ),
      justification: `Encounter context (${sourceType || 'in_person'}) and documentation score ${args.documentation.score} support this CPT level.`,
      metadata: { sourceType, documentationScore: args.documentation.score },
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
        metadata: { trigger: rule.pattern.source, documentationScore: args.documentation.score },
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
        metadata: { fallback: true, documentationScore: args.documentation.score },
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
          args.note ||
            `Doctor-approved ${args.codeType.toUpperCase()} ${args.code} from post-visit billing intelligence.`,
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
}
