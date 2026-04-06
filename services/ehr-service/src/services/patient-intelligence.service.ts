import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EncounterCopilotService } from './encounter-copilot.service';
import { ProactiveAiService } from './proactive-ai.service';
import { RadiologyAiService } from './radiology-ai.service';
import { RiskStratificationService } from './risk-stratification.service';
import { AiSurfaceContractService } from './ai-surface-contract.service';

@Injectable()
export class PatientIntelligenceService {
  private readonly logger = new Logger(PatientIntelligenceService.name);

  constructor(
    private readonly proactiveAiService: ProactiveAiService,
    private readonly encounterCopilotService: EncounterCopilotService,
    private readonly radiologyAiService: RadiologyAiService,
    private readonly riskStratificationService: RiskStratificationService,
    private readonly aiSurfaceContractService: AiSurfaceContractService,
  ) {}

  private isMissingRelationError(error: any): boolean {
    return (
      error?.code === '42P01' ||
      String(error?.message || '').toLowerCase().includes('does not exist')
    );
  }

  private async safeQuery(tenantDb: DataSource, sql: string, params: any[] = []) {
    try {
      return await tenantDb.query(sql, params);
    } catch (error) {
      if (this.isMissingRelationError(error)) {
        return [];
      }
      throw error;
    }
  }

  async getPatientIntelligence(
    patientId: string,
    tenantId: string,
    tenantDb: DataSource,
    actorUserId?: string | null,
  ): Promise<Record<string, any>> {
    let proactiveSnapshot = await this.proactiveAiService.getSnapshot(patientId, tenantId);

    // Populate an initial snapshot inline only when no cached snapshot exists yet.
    if (!proactiveSnapshot) {
      try {
        proactiveSnapshot = await this.proactiveAiService.runAnalysisSync({
          patientId,
          tenantId,
          triggeredByUserId: actorUserId || undefined,
          triggerType: 'chart_open',
        });
      } catch (error: any) {
        this.logger.warn(`Initial proactive snapshot unavailable for ${patientId}: ${error?.message || error}`);
      }
    }

    const [alerts, riskTier, encounterSessions, radiologyFindings, careGaps, postVisitFollowups, resultFollowups] =
      await Promise.all([
        this.proactiveAiService.getActiveAlerts(patientId, tenantId),
        this.riskStratificationService.getPatientRiskTier(patientId, tenantId),
        this.encounterCopilotService.listPatientSessions(tenantDb, patientId, 1),
        this.radiologyAiService.getFindingsForPatient(tenantId, patientId),
        this.getOpenCareGaps(tenantDb, patientId),
        this.getPostVisitFollowups(tenantDb, patientId),
        this.getResultFollowups(tenantDb, patientId),
      ]);

    let encounterCopilot: Record<string, any> | null = null;
    const latestEncounterSession = encounterSessions?.[0];
    if (latestEncounterSession?.id) {
      try {
        encounterCopilot = await this.encounterCopilotService.getSessionById(tenantDb, latestEncounterSession.id);
      } catch (error: any) {
        this.logger.warn(`Encounter copilot summary unavailable for ${patientId}: ${error?.message || error}`);
      }
    }

    const radiologySummary = this.buildRadiologySummary(radiologyFindings || []);
    const proactiveMetadata = proactiveSnapshot
      ? this.aiSurfaceContractService.buildSurfaceMetadata({
          aiSurface: 'proactive_ai',
          useCase: 'patient_proactive_analysis',
          source: 'patient_intelligence_service',
          modelId: proactiveSnapshot.modelVersion || 'patient_proactive_analysis_proxy',
          modelVersion: proactiveSnapshot.modelVersion || 'patient_proactive_analysis_proxy',
          provider: 'local',
          recorded: true,
        })
      : null;
    const normalizedRiskTier = riskTier
      ? {
          tier: riskTier.tier,
          compositeScore: riskTier.compositeScore,
          contributingFactors: riskTier.contributingFactors || [],
          recommendedActions: riskTier.recommendedActions || [],
          modelVersion: riskTier.modelVersion || null,
          validUntil: riskTier.validUntil || null,
          createdAt: riskTier.createdAt || null,
          aiMetadata: this.aiSurfaceContractService.buildSurfaceMetadata({
            aiSurface: 'risk_tier',
            useCase: 'risk_stratification',
            source: 'patient_intelligence_service',
            modelId: riskTier.modelVersion || 'risk_stratification_proxy',
            modelVersion: riskTier.modelVersion || 'risk_stratification_proxy',
            provider: 'local',
            recorded: true,
          }),
        }
      : null;
    const normalizedEncounterCopilot = encounterCopilot
      ? {
          id: encounterCopilot.id,
          createdAt: encounterCopilot.createdAt,
          summary: encounterCopilot.summary || null,
          confidenceScore: encounterCopilot.confidenceScore ?? null,
          likelyCareGaps: Array.isArray(encounterCopilot.likelyCareGaps) ? encounterCopilot.likelyCareGaps : [],
          suggestedOrders: Array.isArray(encounterCopilot.suggestedOrders) ? encounterCopilot.suggestedOrders : [],
          resultFollowupTasks: Array.isArray(encounterCopilot.resultFollowupTasks) ? encounterCopilot.resultFollowupTasks : [],
          aiMetadata: this.aiSurfaceContractService.buildSurfaceMetadata({
            aiSurface: 'encounter_copilot',
            useCase: 'encounter_copilot',
            source: 'patient_intelligence_service',
            modelId: 'encounter_copilot_proxy',
            modelVersion: 'encounter_copilot_proxy',
            provider: 'local',
            recorded: true,
          }),
        }
      : null;
    const nextActions = this.buildNextActions({
      alerts,
      careGaps,
      postVisitFollowups,
      resultFollowups,
      radiologySummary,
      encounterCopilot: normalizedEncounterCopilot,
      proactiveSnapshot,
      riskTier: normalizedRiskTier,
    });
    const summary = this.buildSummary({
      proactiveSnapshot,
      alerts,
      careGaps,
      radiologySummary,
      nextActions,
      riskTier: normalizedRiskTier,
    });

    return {
      generatedAt: new Date().toISOString(),
      summary,
      proactiveSnapshot: proactiveSnapshot
        ? {
            clinicalSummary: proactiveSnapshot.clinicalSummary,
            riskScores: proactiveSnapshot.riskScores,
            activeFlags: proactiveSnapshot.activeFlags,
            news2Score: proactiveSnapshot.news2Score,
            qsofaScore: proactiveSnapshot.qsofaScore,
            generatedAt: proactiveSnapshot.snapshotGeneratedAt,
            modelVersion: proactiveSnapshot.modelVersion || null,
            analysisPayload: proactiveSnapshot.analysisPayload || {},
            aiMetadata: proactiveMetadata,
          }
        : null,
      alerts: (alerts || []).slice(0, 5).map((alert: any) => ({
        id: alert.id,
        severity: alert.severity,
        category: alert.category,
        title: alert.title,
        message: alert.message,
        recommendedAction: alert.recommendedAction || null,
        guidelineReference: alert.guidelineReference || null,
        confidenceScore: alert.confidenceScore ?? null,
        createdAt: alert.createdAt,
      })),
      riskTier: normalizedRiskTier,
      encounterCopilot: normalizedEncounterCopilot,
      radiology: radiologySummary,
      careGaps,
      postVisitFollowups,
      resultFollowups,
      nextActions,
    };
  }

  private async getOpenCareGaps(tenantDb: DataSource, patientId: string): Promise<Record<string, any>[]> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        id,
        gap_type,
        gap_description,
        recommended_action,
        priority,
        due_date,
        status,
        detected_at
      FROM care_gap_detections
      WHERE patient_id = $1
        AND status = 'open'
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END ASC,
        detected_at DESC
      LIMIT 5
      `,
      [patientId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      gapType: row.gap_type,
      gapDescription: row.gap_description,
      recommendedAction: row.recommended_action || null,
      priority: row.priority || 'medium',
      dueDate: row.due_date || null,
      status: row.status,
      detectedAt: row.detected_at,
    }));
  }

  private async getPostVisitFollowups(tenantDb: DataSource, patientId: string): Promise<Record<string, any>[]> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        id,
        trigger_type,
        risk_level,
        status,
        reminder_state,
        next_action,
        unresolved_question,
        route_back_target,
        due_at,
        created_at,
        payload
      FROM patient_followup_orchestrations
      WHERE patient_id = $1
        AND status IN ('open', 'pending')
        AND (
          trigger_type LIKE 'post_visit%'
          OR COALESCE(payload->>'source', '') = 'post_visit_companion'
        )
      ORDER BY COALESCE(due_at, created_at) ASC
      LIMIT 5
      `,
      [patientId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      triggerType: row.trigger_type,
      riskLevel: row.risk_level || 'routine',
      status: row.status,
      reminderState: row.reminder_state,
      nextAction: row.next_action,
      unresolvedQuestion: row.unresolved_question || null,
      routeBackTarget: row.route_back_target || null,
      dueAt: row.due_at || null,
      createdAt: row.created_at,
      payload: row.payload || {},
    }));
  }

  private async getResultFollowups(tenantDb: DataSource, patientId: string): Promise<Record<string, any>[]> {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        id,
        source_type,
        task_type,
        task_title,
        task_summary,
        priority,
        status,
        recommended_action,
        due_at,
        created_at,
        evidence
      FROM result_followup_tasks
      WHERE patient_id = $1
        AND status = 'open'
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 0
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END ASC,
        COALESCE(due_at, created_at) ASC
      LIMIT 5
      `,
      [patientId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      sourceType: row.source_type,
      taskType: row.task_type,
      taskTitle: row.task_title,
      taskSummary: row.task_summary,
      priority: row.priority || 'high',
      status: row.status,
      recommendedAction: row.recommended_action || null,
      dueAt: row.due_at || null,
      createdAt: row.created_at,
      evidence: row.evidence || {},
    }));
  }

  private buildRadiologySummary(findings: any[]) {
    const normalized = (findings || []).map((finding: any) => {
      const detailedFindings = Array.isArray(finding.findings) ? finding.findings : [];
      const hasCriticalDetail = detailedFindings.some((item: any) => String(item?.severity || '').toLowerCase() === 'critical');
      const overallConfidence = Number(finding.overallConfidence ?? 0);
      return {
        id: finding.id,
        studyId: finding.studyId,
        modality: finding.modality || 'imaging',
        topFinding: finding.topFinding || 'AI finding available',
        overallConfidence,
        modelVersion: finding.modelVersion || null,
        alerted: Boolean(finding.alerted),
        radiologistReviewed: Boolean(finding.radiologistReviewed),
        analyzedAt: finding.analyzedAt || finding.createdAt || null,
        critical: hasCriticalDetail || Boolean(finding.alerted) || overallConfidence >= 0.85,
        findings: detailedFindings,
        aiMetadata: this.aiSurfaceContractService.buildSurfaceMetadata({
          aiSurface: 'radiology_ai',
          useCase: 'radiology_analysis',
          source: 'patient_intelligence_service',
          modelId: finding.modelVersion || 'radiology_analysis_proxy',
          modelVersion: finding.modelVersion || 'radiology_analysis_proxy',
          provider: 'local',
          recorded: true,
        }),
      };
    });

    const sorted = normalized.sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      if (a.overallConfidence !== b.overallConfidence) return b.overallConfidence - a.overallConfidence;
      return new Date(b.analyzedAt || 0).getTime() - new Date(a.analyzedAt || 0).getTime();
    });

    return {
      criticalFindingCount: sorted.filter((item) => item.critical).length,
      totalFindingCount: sorted.length,
      findings: sorted.slice(0, 3),
      aiMetadata: this.aiSurfaceContractService.buildSurfaceMetadata({
        aiSurface: 'radiology_ai',
        useCase: 'radiology_analysis',
        source: 'patient_intelligence_service',
        modelId: String(sorted[0]?.modelVersion || 'radiology_analysis_proxy'),
        modelVersion: String(sorted[0]?.modelVersion || 'radiology_analysis_proxy'),
        provider: 'local',
        recorded: true,
      }),
    };
  }

  private buildSummary(args: {
    proactiveSnapshot: any;
    alerts: any[];
    careGaps: any[];
    radiologySummary: Record<string, any>;
    nextActions: Record<string, any>[];
    riskTier: any;
  }) {
    const criticalAlertCount = (args.alerts || []).filter((alert) => String(alert?.severity || '').toLowerCase() === 'critical').length;
    const criticalRadiologyCount = Number(args.radiologySummary?.criticalFindingCount || 0);
    const tier = String(args.riskTier?.tier || '').toLowerCase();

    let tone: 'critical' | 'attention' | 'stable' = 'stable';
    if (criticalAlertCount > 0 || criticalRadiologyCount > 0 || tier === 'critical') {
      tone = 'critical';
    } else if ((args.alerts || []).length > 0 || (args.careGaps || []).length > 0 || (args.nextActions || []).length > 0 || tier === 'high') {
      tone = 'attention';
    }

    const headline =
      args.proactiveSnapshot?.clinicalSummary ||
      (tone === 'critical'
        ? 'Immediate clinician attention recommended.'
        : tone === 'attention'
          ? 'Several AI signals need follow-through.'
          : 'No high-urgency AI signals are currently open.');

    const stats = {
      activeAlertCount: (args.alerts || []).length,
      openCareGapCount: (args.careGaps || []).length,
      criticalRadiologyCount,
      nextActionCount: (args.nextActions || []).length,
    };

    return {
      tone,
      headline,
      stats,
      lastUpdatedAt:
        args.proactiveSnapshot?.snapshotGeneratedAt ||
        args.proactiveSnapshot?.generatedAt ||
        new Date().toISOString(),
    };
  }

  private buildNextActions(args: {
    alerts: any[];
    careGaps: any[];
    postVisitFollowups: any[];
    resultFollowups: any[];
    radiologySummary: Record<string, any>;
    encounterCopilot: Record<string, any> | null;
    proactiveSnapshot: any;
    riskTier: any;
  }): Record<string, any>[] {
    const actions: Record<string, any>[] = [];

    for (const alert of (args.alerts || []).slice(0, 3)) {
      actions.push({
        id: `alert:${alert.id}`,
        source: 'proactive_alert',
        priority: alert.severity || 'high',
        title: alert.title || 'Review active alert',
        summary: alert.message || 'AI-generated alert requires clinician review.',
        recommendedAction: alert.recommendedAction || null,
        dueAt: alert.expiresAt || null,
        confidenceScore: alert.confidenceScore ?? null,
        evidenceLabel: alert.guidelineReference || null,
        backingType: 'AI alert',
        reviewState: 'Open alert',
        aiMetadata: this.aiSurfaceContractService.buildSurfaceMetadata({
          aiSurface: 'proactive_ai',
          useCase: 'patient_proactive_analysis',
          source: 'patient_intelligence_service',
          modelId: args.proactiveSnapshot?.modelVersion || 'patient_proactive_analysis_proxy',
          modelVersion: args.proactiveSnapshot?.modelVersion || 'patient_proactive_analysis_proxy',
          provider: 'local',
          recorded: true,
        }),
      });
    }

    for (const gap of (args.careGaps || []).slice(0, 2)) {
      actions.push({
        id: `gap:${gap.id}`,
        source: 'care_gap',
        priority: gap.priority || 'medium',
        title: `Close ${(gap.gapType || 'care_gap').replace(/_/g, ' ')}`,
        summary: gap.gapDescription,
        recommendedAction: gap.recommendedAction || null,
        dueAt: gap.dueDate || null,
        backingType: 'Rule-backed',
        reviewState: 'Open gap',
      });
    }

    for (const followup of (args.postVisitFollowups || []).slice(0, 2)) {
      actions.push({
        id: `postvisit:${followup.id}`,
        source: 'post_visit_followup',
        priority: followup.riskLevel || 'routine',
        title: 'Complete post-visit follow-up',
        summary: followup.nextAction,
        recommendedAction: followup.unresolvedQuestion || followup.nextAction,
        dueAt: followup.dueAt || null,
        evidenceLabel:
          typeof followup.payload?.source === 'string'
            ? String(followup.payload.source).replace(/_/g, ' ')
            : null,
        backingType: 'Workflow follow-through',
        reviewState: followup.reminderState || followup.status || 'Open',
      });
    }

    for (const followup of (args.resultFollowups || []).slice(0, 2)) {
      actions.push({
        id: `result:${followup.id}`,
        source: 'result_followup',
        priority: followup.priority || 'high',
        title: followup.taskTitle || 'Review result follow-up',
        summary: followup.taskSummary,
        recommendedAction: followup.recommendedAction || null,
        dueAt: followup.dueAt || null,
        evidenceLabel: this.extractEvidenceLabel(followup.evidence),
        backingType: 'Result workflow',
        reviewState: followup.status || 'Open',
      });
    }

    const topRadiologyFinding = args.radiologySummary?.findings?.[0];
    if (topRadiologyFinding?.critical) {
      actions.push({
        id: `radiology:${topRadiologyFinding.id}`,
        source: 'radiology_ai',
        priority: 'critical',
        title: 'Review critical radiology AI finding',
        summary: topRadiologyFinding.topFinding,
        recommendedAction: 'Confirm the finding, acknowledge if appropriate, and update the care plan.',
        dueAt: topRadiologyFinding.analyzedAt || null,
        confidenceScore: topRadiologyFinding.overallConfidence ?? null,
        evidenceLabel: topRadiologyFinding.modality || null,
        backingType: 'Imaging AI',
        reviewState: topRadiologyFinding.radiologistReviewed ? 'Radiologist reviewed' : 'Pending radiologist review',
        aiMetadata: topRadiologyFinding.aiMetadata || args.radiologySummary?.aiMetadata || null,
      });
    }

    if ((args.encounterCopilot?.resultFollowupTasks || []).length > 0) {
      const task = args.encounterCopilot.resultFollowupTasks[0];
      actions.push({
        id: `copilot:${task.id}`,
        source: 'encounter_copilot',
        priority: task.priority || 'high',
        title: task.taskTitle || 'Review encounter follow-up',
        summary: task.taskSummary || 'Encounter copilot generated a follow-up task.',
        recommendedAction: task.recommendedAction || null,
        dueAt: task.dueAt || null,
        confidenceScore: args.encounterCopilot?.confidenceScore ?? null,
        evidenceLabel:
          Array.isArray(args.encounterCopilot?.likelyCareGaps) && args.encounterCopilot.likelyCareGaps.length > 0
            ? args.encounterCopilot.likelyCareGaps
                .slice(0, 2)
                .map((gap: any) => gap?.title || gap?.gapType || 'care gap')
                .join(', ')
            : null,
        backingType: 'Clinician copilot',
        reviewState: 'Open follow-up',
        aiMetadata: args.encounterCopilot?.aiMetadata || null,
      });
    }

    if (args.riskTier?.recommendedActions?.length) {
      actions.push({
        id: 'risk-tier:recommended-actions',
        source: 'risk_tier',
        priority: String(args.riskTier?.tier || 'medium').toLowerCase(),
        title: 'Review risk-tier recommendations',
        summary: String(args.riskTier.recommendedActions[0] || 'AI risk tier generated follow-up actions.'),
        recommendedAction: String(args.riskTier.recommendedActions[0] || ''),
        dueAt: args.riskTier?.validUntil || null,
        confidenceScore: typeof args.riskTier?.compositeScore === 'number' ? args.riskTier.compositeScore : null,
        evidenceLabel:
          Array.isArray(args.riskTier?.contributingFactors) && args.riskTier.contributingFactors.length > 0
            ? args.riskTier.contributingFactors.slice(0, 3).join(', ')
            : null,
        backingType: 'Risk model',
        reviewState: args.riskTier?.validUntil ? 'Active recommendation window' : 'Open recommendation',
        aiMetadata: args.riskTier?.aiMetadata || null,
      });
    }

    const weight = (priority: string) => {
      switch (String(priority || '').toLowerCase()) {
        case 'critical':
          return 0;
        case 'urgent':
          return 1;
        case 'high':
          return 2;
        case 'attention':
          return 2;
        case 'moderate':
        case 'medium':
          return 3;
        default:
          return 4;
      }
    };

    return actions
      .sort((a, b) => {
        const byPriority = weight(a.priority) - weight(b.priority);
        if (byPriority !== 0) return byPriority;
        return new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime();
      })
      .slice(0, 6);
  }

  private extractEvidenceLabel(evidence: any): string | null {
    if (!evidence) {
      return null;
    }

    if (typeof evidence === 'string') {
      return evidence;
    }

    const candidate = evidence.guidelineReference || evidence.reference || evidence.source || evidence.summary || evidence.title;
    if (candidate) {
      return String(candidate);
    }

    return Object.keys(evidence || {}).length > 0 ? 'Evidence on file' : null;
  }
}
