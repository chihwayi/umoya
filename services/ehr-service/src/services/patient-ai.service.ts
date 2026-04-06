import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { SymptomCheckerSession } from '../entities/symptom-checker-session.entity';
import { AdherenceChatLog } from '../entities/adherence-chat-log.entity';
import { PatientAiSession } from '../entities/patient-ai-session.entity';
import { PatientAiEscalation } from '../entities/patient-ai-escalation.entity';
import { PatientFollowupOrchestration } from '../entities/patient-followup-orchestration.entity';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { HipaaAuditService } from './hipaa-audit.service';
import { AiSurfaceContractService } from './ai-surface-contract.service';

@Injectable()
export class PatientAiService {
  private readonly logger = new Logger(PatientAiService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly hipaaAuditService: HipaaAuditService,
    private readonly aiSurfaceContractService: AiSurfaceContractService,
  ) {}

  private buildAiMetadata(args: {
    useCase: 'patient_symptom_check' | 'patient_adherence_chat';
    model?: string | null;
    governance?: Record<string, any> | null;
  }) {
    return this.aiSurfaceContractService.buildSurfaceMetadata({
      aiSurface: 'patient_ai',
      useCase: args.useCase,
      source: 'patient_ai_service',
      modelId: args.model || 'patient_ai_proxy',
      modelVersion: args.model || 'patient_ai_proxy',
      provider: String(args.governance?.vendor_id || args.governance?.vendorId || args.governance?.provider || 'local'),
      recorded: true,
    });
  }

  private mapTriageToUrgency(triageLevel?: string | null): 'routine' | 'urgent' | 'emergency' {
    const normalized = String(triageLevel || '').trim().toLowerCase();
    if (normalized === 'emergency' || normalized === 'stat') return 'emergency';
    if (normalized === 'urgent') return 'urgent';
    return 'routine';
  }

  private buildSymptomSafetyPolicy(result: {
    triageLevel?: string;
    recommendedAction?: string;
    abstained?: boolean;
    abstainReason?: string | null;
  }) {
    const urgency = this.mapTriageToUrgency(result.triageLevel);
    const urgentSignal = urgency !== 'routine';
    const escalationRoute = urgency === 'emergency' ? 'emergency' : urgency === 'urgent' ? 'doctor' : 'self_care';
    const policyMessage =
      urgency === 'emergency'
        ? 'Emergency red flag detected. Seek emergency care immediately or call local emergency services.'
        : urgency === 'urgent'
          ? 'Urgent clinician review is recommended. Contact your care team as soon as possible.'
          : 'No immediate emergency signal was detected from the governed symptom workflow.';

    return {
      urgency,
      urgentSignal,
      escalationRoute,
      policyMessage,
      requiresClinicianFollowUp: urgentSignal || result.abstained === true,
      dueHours: urgency === 'emergency' ? 2 : urgency === 'urgent' ? 24 : 72,
      abstainReason: result.abstainReason || null,
    };
  }

  private buildAdherenceSafetyPolicy(result: {
    adherenceConcern?: boolean;
    requiresClinicianFollowUp?: boolean;
    urgency?: 'routine' | 'urgent';
    abstained?: boolean;
    abstainReason?: string | null;
  }) {
    const urgency = result.urgency === 'urgent' ? 'urgent' : 'routine';
    const urgentSignal = urgency === 'urgent';
    return {
      urgency,
      urgentSignal,
      escalationRoute: urgentSignal ? 'doctor' : 'care_manager',
      policyMessage: urgentSignal
        ? 'Medication concern needs prompt clinician review.'
        : 'Follow-up adherence support should continue through the normal care pathway.',
      requiresClinicianFollowUp:
        result.requiresClinicianFollowUp === true || result.adherenceConcern === true || result.abstained === true,
      dueHours: urgentSignal ? 24 : 72,
      abstainReason: result.abstainReason || null,
    };
  }

  private offsetDueAt(hours: number): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private async createPatientAiSession(
    tenantDb: any,
    payload: {
      patientId: string;
      sessionType: 'symptom_check' | 'adherence_chat';
      sourceSessionId?: string | null;
      status: string;
      latestMessage?: string | null;
      latestReply?: string | null;
      latestIntent?: string | null;
      triageLevel?: string | null;
      urgency: string;
      guidanceSummary?: string | null;
      requiresClinicianFollowUp: boolean;
      urgentSignal: boolean;
      abstained: boolean;
      abstainReason?: string | null;
      citations?: Array<Record<string, any>>;
      provenance?: Record<string, any>;
    },
  ) {
    const repo = tenantDb.getRepository(PatientAiSession);
    return repo.save(
      repo.create({
        patientId: payload.patientId,
        sessionType: payload.sessionType,
        sourceSessionId: payload.sourceSessionId || null,
        status: payload.status,
        latestMessage: payload.latestMessage || null,
        latestReply: payload.latestReply || null,
        latestIntent: payload.latestIntent || null,
        triageLevel: payload.triageLevel || null,
        urgency: payload.urgency,
        guidanceSummary: payload.guidanceSummary || null,
        requiresClinicianFollowUp: payload.requiresClinicianFollowUp,
        urgentSignal: payload.urgentSignal,
        abstained: payload.abstained,
        abstainReason: payload.abstainReason || null,
        citations: payload.citations || [],
        provenance: payload.provenance || {},
      }),
    );
  }

  private async createPatientAiEscalation(
    tenantDb: any,
    payload: {
      patientId: string;
      patientAiSessionId: string;
      sourceType: string;
      severity: string;
      routeTarget: string;
      triggerSummary: string;
      recommendedAction?: string | null;
      provenance?: Record<string, any>;
    },
  ) {
    const repo = tenantDb.getRepository(PatientAiEscalation);
    return repo.save(
      repo.create({
        patientId: payload.patientId,
        patientAiSessionId: payload.patientAiSessionId,
        sourceType: payload.sourceType,
        severity: payload.severity,
        routeTarget: payload.routeTarget,
        triggerSummary: payload.triggerSummary,
        recommendedAction: payload.recommendedAction || null,
        provenance: payload.provenance || {},
      }),
    );
  }

  private async createFollowupOrchestration(
    tenantDb: any,
    payload: {
      patientId: string;
      patientAiSessionId: string;
      triggerType: string;
      riskLevel: string;
      nextAction: string;
      unresolvedQuestion?: string | null;
      nonadherenceFlag?: boolean;
      missedFollowupFlag?: boolean;
      routeBackTarget?: string | null;
      dueAt?: Date | null;
      payload?: Record<string, any>;
    },
  ) {
    const repo = tenantDb.getRepository(PatientFollowupOrchestration);
    return repo.save(
      repo.create({
        patientId: payload.patientId,
        patientAiSessionId: payload.patientAiSessionId,
        triggerType: payload.triggerType,
        riskLevel: payload.riskLevel,
        status: 'open',
        reminderState: 'pending',
        nextAction: payload.nextAction,
        unresolvedQuestion: payload.unresolvedQuestion || null,
        nonadherenceFlag: payload.nonadherenceFlag === true,
        missedFollowupFlag: payload.missedFollowupFlag === true,
        routeBackTarget: payload.routeBackTarget || null,
        dueAt: payload.dueAt || null,
        lastTouchedAt: new Date(),
        payload: payload.payload || {},
      }),
    );
  }

  private async recordPatientAiPromptAudit(
    subdomain: string,
    tenantDb: any,
    payload: {
      useCase: 'patient_symptom_check' | 'patient_adherence_chat';
      patientId?: string;
      model: string;
      requestBody: Record<string, any>;
      responseSummary: Record<string, any>;
      governance?: Record<string, any>;
      sessionId?: string;
    },
  ): Promise<void> {
    try {
      const promptHash = createHash('sha256')
        .update(JSON.stringify(payload.requestBody || {}))
        .digest('hex');
      const modelId = String(payload.model || 'unknown_model');
      const provider = String(payload.governance?.vendor_id || payload.governance?.vendorId || 'local');
      await this.hipaaAuditService.registerModelEntry(tenantDb, {
        modelId,
        modelName: modelId,
        modelVersion: String(process.env.CDSS_MODEL_VERSION || modelId),
        provider,
        status: 'active',
        metadata: {
          source: 'patient_ai_service',
          useCase: payload.useCase,
          subdomain,
        },
      });
      await this.hipaaAuditService.logPromptAudit(tenantDb, {
        promptHash,
        templateVersion: 'sprint111_moas11_v1',
        modelId,
        patientId: payload.patientId || null,
        sessionId: null,
        requestId: uuidv4(),
        safetyGateTriggered: payload.responseSummary?.abstained === true,
        metadata: {
          source: 'patient_ai_service',
          subdomain,
          useCase: payload.useCase,
          sessionId: payload.sessionId || null,
          governance: payload.governance || {},
          responseSummary: payload.responseSummary || {},
        },
      });
    } catch (error: any) {
      this.logger.warn(`Patient AI prompt audit failed for ${payload.useCase}: ${error?.message || error}`);
    }
  }

  // ── Symptom Checker ────────────────────────────────────────────────────────

  async checkSymptoms(subdomain: string, dto: {
    patientId: string;
    symptoms: string[];
    durationDays?: number;
    severity?: string;
    context?: Record<string, any>;
  }): Promise<any> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);

    let result: any = {
      differential: [],
      triage_level: 'routine',
      recommended_action: 'Schedule appointment with your doctor.',
      confidence: 0,
      model: 'symptom_check_rules_v1',
      governance: { governed_path: false },
    };

    try {
      const routed = await this.cdssService.patientSymptomCheck(
        {
          symptoms: dto.symptoms,
          durationDays: dto.durationDays,
          severity: dto.severity,
          patientContext: dto.context || {},
        },
        subdomain,
      );
      result = {
        differential: routed.differential,
        triage_level: routed.triageLevel,
        recommended_action: routed.recommendedAction,
        confidence: routed.confidence,
        model: routed.model,
        abstained: routed.abstained,
        abstain_reason: routed.abstainReason,
        governance: routed.governance,
      };
      await this.recordPatientAiPromptAudit(subdomain, ds, {
        useCase: 'patient_symptom_check',
        patientId: dto.patientId,
        model: routed.model,
        requestBody: {
          symptoms: dto.symptoms,
          durationDays: dto.durationDays,
          severity: dto.severity,
          patientContextKeys: Object.keys(dto.context || {}).sort(),
        },
        responseSummary: {
          triageLevel: routed.triageLevel,
          confidence: routed.confidence,
          abstained: routed.abstained,
          abstainReason: routed.abstainReason || null,
        },
        governance: routed.governance,
      });
    } catch (e: any) {
      this.logger.warn(`Symptom check governed CDSS path unavailable: ${e?.message}`);
    }

    const repo = ds.getRepository(SymptomCheckerSession);
    const savedSession = await repo.save(repo.create({
      patientId: dto.patientId,
      reportedSymptoms: dto.symptoms,
      durationDays: dto.durationDays,
      severity: dto.severity,
      differential: result.differential || [],
      triageLevel: result.triage_level,
      recommendedAction: result.recommended_action,
    }));

    const safetyPolicy = this.buildSymptomSafetyPolicy({
      triageLevel: result.triage_level,
      recommendedAction: result.recommended_action,
      abstained: result.abstained,
      abstainReason: result.abstain_reason,
    });

    const patientAiSession = await this.createPatientAiSession(ds, {
      patientId: dto.patientId,
      sessionType: 'symptom_check',
      sourceSessionId: savedSession.id,
      status: safetyPolicy.requiresClinicianFollowUp ? 'needs_follow_up' : 'closed',
      latestMessage: dto.symptoms.join(', '),
      latestReply: result.recommended_action || null,
      triageLevel: result.triage_level || null,
      urgency: safetyPolicy.urgency,
      guidanceSummary: safetyPolicy.policyMessage,
      requiresClinicianFollowUp: safetyPolicy.requiresClinicianFollowUp,
      urgentSignal: safetyPolicy.urgentSignal,
      abstained: result.abstained === true,
      abstainReason: result.abstain_reason || null,
      provenance: {
        source: 'patient_ai_symptom_check',
        model: result.model || 'symptom_check_rules_v1',
        governance: result.governance || {},
      },
    });

    let escalation: PatientAiEscalation | null = null;
    if (safetyPolicy.urgentSignal) {
      escalation = await this.createPatientAiEscalation(ds, {
        patientId: dto.patientId,
        patientAiSessionId: patientAiSession.id,
        sourceType: 'symptom_check',
        severity: safetyPolicy.urgency === 'emergency' ? 'critical' : 'high',
        routeTarget: safetyPolicy.escalationRoute,
        triggerSummary: `Governed symptom check classified the current symptom set as ${result.triage_level || 'urgent'}.`,
        recommendedAction: result.recommended_action || safetyPolicy.policyMessage,
        provenance: {
          symptoms: dto.symptoms,
          durationDays: dto.durationDays ?? null,
          severity: dto.severity || null,
        },
      });
    }

    const followupOrchestration = await this.createFollowupOrchestration(ds, {
      patientId: dto.patientId,
      patientAiSessionId: patientAiSession.id,
      triggerType: 'symptom_check',
      riskLevel: safetyPolicy.urgency,
      nextAction: result.recommended_action || safetyPolicy.policyMessage,
      unresolvedQuestion: result.abstained === true ? safetyPolicy.abstainReason : null,
      missedFollowupFlag: dto.context?.missedFollowUp === true,
      routeBackTarget: safetyPolicy.requiresClinicianFollowUp ? safetyPolicy.escalationRoute : 'self_care',
      dueAt: this.offsetDueAt(safetyPolicy.dueHours),
      payload: {
        reportedSymptoms: dto.symptoms,
        differential: result.differential || [],
        context: dto.context || {},
      },
    });

    return {
      ...savedSession,
      aiSessionId: patientAiSession.id,
      aiMetadata: this.buildAiMetadata({
        useCase: 'patient_symptom_check',
        model: result.model,
        governance: result.governance,
      }),
      safetyPolicy,
      escalation,
      followupOrchestration,
    };
  }

  async getSymptomHistory(subdomain: string, patientId: string): Promise<SymptomCheckerSession[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SymptomCheckerSession).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async escalateToEncounter(subdomain: string, sessionId: string, encounterId: string): Promise<void> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    await ds.getRepository(SymptomCheckerSession).update(sessionId, {
      escalatedToEncounter: true, encounterId,
    });
  }

  // ── Adherence Chatbot (Claude API) ─────────────────────────────────────────

  async adherenceChat(subdomain: string, dto: {
    patientId: string;
    sessionId?: string;
    message: string;
    medications?: string[];
    missedFollowUp?: boolean;
    context?: {
      visitContext?: {
        visitId?: string;
        visitDate?: string;
        doctorName?: string;
        diagnoses?: string[];
        soap?: { subjective?: string; objective?: string; assessment?: string; plan?: string };
        quickSummary?: string;
      };
    };
  }): Promise<{
    sessionId: string;
    aiSessionId: string;
    aiMetadata: Record<string, any>;
    reply: string;
    intent?: string;
    adherenceConcern: boolean;
    requiresClinicianFollowUp: boolean;
    urgency: 'routine' | 'urgent';
    confidence: number;
    model: string;
    abstained: boolean;
    abstainReason?: string | null;
    governance?: Record<string, any>;
    safetyPolicy: Record<string, any>;
    escalation: PatientAiEscalation | null;
    followupOrchestration: PatientFollowupOrchestration;
  }> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const sessionId = dto.sessionId || uuidv4();
    const repo = ds.getRepository(AdherenceChatLog);

    // Save user message
    await repo.save(repo.create({
      patientId: dto.patientId,
      sessionId,
      messageRole: 'user',
      message: dto.message,
      medicationsDiscussed: dto.medications || [],
    }));

    // Get recent history for context
    const history = await repo.find({
      where: { patientId: dto.patientId, sessionId },
      order: { createdAt: 'ASC' },
      take: 10,
    });

    const messages = history.map(h => ({ role: h.messageRole as 'user' | 'assistant', content: h.message }));

    let reply = 'I understand. Please take your medications as prescribed and contact your healthcare provider if you have concerns.';
    let intent: string | undefined = 'general';
    let adherenceConcern = false;
    let requiresClinicianFollowUp = false;
    let urgency: 'routine' | 'urgent' = 'routine';
    let confidence = 0.2;
    let model = 'cdss_patient_adherence_guardrail';
    let abstained = false;
    let abstainReason: string | null = null;
    let governance: Record<string, any> | undefined;

    try {
      const response = await this.cdssService.patientAdherenceAssist(
        {
          patientId: dto.patientId,
          sessionId,
          message: dto.message,
          medications: dto.medications || [],
          history: messages,
          visitContext: dto.context?.visitContext,
        },
        subdomain,
      );

      reply = response.reply || reply;
      intent = response.intent || intent;
      adherenceConcern = response.adherenceConcern;
      requiresClinicianFollowUp = response.requiresClinicianFollowUp;
      urgency = response.urgency;
      confidence = response.confidence;
      model = response.model;
      abstained = response.abstained;
      abstainReason = response.abstainReason || null;
      governance = response.governance;
      await this.recordPatientAiPromptAudit(subdomain, ds, {
        useCase: 'patient_adherence_chat',
        patientId: dto.patientId,
        model: response.model,
        requestBody: {
          messageHash: createHash('sha256').update(String(dto.message || '')).digest('hex'),
          medications: dto.medications || [],
          historyCount: messages.length,
        },
        responseSummary: {
          intent: response.intent,
          urgency: response.urgency,
          confidence: response.confidence,
          abstained: response.abstained,
          abstainReason: response.abstainReason || null,
          requiresClinicianFollowUp: response.requiresClinicianFollowUp,
        },
        governance: response.governance,
        sessionId,
      });
    } catch (e: any) {
      this.logger.warn(`Adherence chat governed CDSS path failed: ${e?.message}`);
    }

    // Save assistant reply
    await repo.save(repo.create({
      patientId: dto.patientId,
      sessionId,
      messageRole: 'assistant',
      message: reply,
      intent,
      medicationsDiscussed: dto.medications || [],
      adherenceConcernFlagged: adherenceConcern,
    }));

    const safetyPolicy = this.buildAdherenceSafetyPolicy({
      adherenceConcern,
      requiresClinicianFollowUp,
      urgency,
      abstained,
      abstainReason,
    });

    const patientAiSession = await this.createPatientAiSession(ds, {
      patientId: dto.patientId,
      sessionType: 'adherence_chat',
      sourceSessionId: sessionId,
      status: safetyPolicy.requiresClinicianFollowUp ? 'needs_follow_up' : 'open',
      latestMessage: dto.message,
      latestReply: reply,
      latestIntent: intent || null,
      urgency: safetyPolicy.urgency,
      guidanceSummary: safetyPolicy.policyMessage,
      requiresClinicianFollowUp: safetyPolicy.requiresClinicianFollowUp,
      urgentSignal: safetyPolicy.urgentSignal,
      abstained,
      abstainReason,
      provenance: {
        source: 'patient_ai_adherence_chat',
        model,
        governance: governance || {},
      },
    });

    let escalation: PatientAiEscalation | null = null;
    if (safetyPolicy.requiresClinicianFollowUp) {
      escalation = await this.createPatientAiEscalation(ds, {
        patientId: dto.patientId,
        patientAiSessionId: patientAiSession.id,
        sourceType: 'adherence_chat',
        severity: safetyPolicy.urgency === 'urgent' ? 'high' : 'moderate',
        routeTarget: safetyPolicy.escalationRoute,
        triggerSummary: `Governed adherence chat flagged ${adherenceConcern ? 'an adherence concern' : 'a follow-up need'}${intent ? ` for intent ${intent}` : ''}.`,
        recommendedAction: reply,
        provenance: {
          medications: dto.medications || [],
          intent: intent || null,
          confidence,
        },
      });
    }

    const followupOrchestration = await this.createFollowupOrchestration(ds, {
      patientId: dto.patientId,
      patientAiSessionId: patientAiSession.id,
      triggerType: 'adherence_chat',
      riskLevel: safetyPolicy.urgency,
      nextAction: reply,
      unresolvedQuestion: abstained ? abstainReason : null,
      nonadherenceFlag: adherenceConcern,
      missedFollowupFlag: dto.missedFollowUp === true,
      routeBackTarget: safetyPolicy.requiresClinicianFollowUp ? safetyPolicy.escalationRoute : 'patient_support',
      dueAt: this.offsetDueAt(safetyPolicy.dueHours),
      payload: {
        medications: dto.medications || [],
        intent: intent || null,
        confidence,
      },
    });

    return {
      sessionId,
      aiSessionId: patientAiSession.id,
      aiMetadata: this.buildAiMetadata({
        useCase: 'patient_adherence_chat',
        model,
        governance,
      }),
      reply,
      intent,
      adherenceConcern,
      requiresClinicianFollowUp,
      urgency,
      confidence,
      model,
      abstained,
      abstainReason,
      governance,
      safetyPolicy,
      escalation,
      followupOrchestration,
    };
  }

  async getChatHistory(subdomain: string, patientId: string, sessionId?: string): Promise<AdherenceChatLog[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: any = sessionId ? { patientId, sessionId } : { patientId };
    return ds.getRepository(AdherenceChatLog).find({
      where, order: { createdAt: 'ASC' },
    });
  }

  async getPatientAiSessions(subdomain: string, patientId: string): Promise<PatientAiSession[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PatientAiSession).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async getPatientAiEscalations(subdomain: string, patientId: string): Promise<PatientAiEscalation[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PatientAiEscalation).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async getPatientFollowupOrchestrations(subdomain: string, patientId: string): Promise<PatientFollowupOrchestration[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PatientFollowupOrchestration).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async updateFollowupOrchestration(
    subdomain: string,
    orchestrationId: string,
    updates: { status?: string; reminderState?: string },
  ): Promise<PatientFollowupOrchestration | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PatientFollowupOrchestration);
    const record = await repo.findOneBy({ id: orchestrationId });
    if (!record) return null;

    return repo.save({
      ...record,
      status: updates.status || record.status,
      reminderState: updates.reminderState || record.reminderState,
      lastTouchedAt: new Date(),
      completedAt: updates.status === 'completed' ? new Date() : record.completedAt,
    });
  }
}
