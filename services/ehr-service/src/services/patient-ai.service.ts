import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { SymptomCheckerSession } from '../entities/symptom-checker-session.entity';
import { AdherenceChatLog } from '../entities/adherence-chat-log.entity';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { HipaaAuditService } from './hipaa-audit.service';

@Injectable()
export class PatientAiService {
  private readonly logger = new Logger(PatientAiService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly hipaaAuditService: HipaaAuditService,
  ) {}

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
  }): Promise<SymptomCheckerSession> {
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
    return repo.save(repo.create({
      patientId: dto.patientId,
      reportedSymptoms: dto.symptoms,
      durationDays: dto.durationDays,
      severity: dto.severity,
      differential: result.differential || [],
      triageLevel: result.triage_level,
      recommendedAction: result.recommended_action,
    }));
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
  }): Promise<{
    sessionId: string;
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

    return {
      sessionId,
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
    };
  }

  async getChatHistory(subdomain: string, patientId: string, sessionId?: string): Promise<AdherenceChatLog[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: any = sessionId ? { patientId, sessionId } : { patientId };
    return ds.getRepository(AdherenceChatLog).find({
      where, order: { createdAt: 'ASC' },
    });
  }
}
