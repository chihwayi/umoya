import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { SymptomCheckerSession } from '../entities/symptom-checker-session.entity';
import { AdherenceChatLog } from '../entities/adherence-chat-log.entity';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PatientAiService {
  private readonly logger = new Logger(PatientAiService.name);
  private claudeApiKey = process.env.ANTHROPIC_API_KEY || '';
  private claudeModel = 'claude-sonnet-4-6';

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

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
    };

    try {
      result = await this.cdssService.diagnosisAssist({
        symptoms: dto.symptoms,
        duration_days: dto.durationDays,
        severity: dto.severity,
        patient_context: dto.context || {},
        context: 'symptom_checker',
      }, true);
    } catch (e: any) {
      this.logger.warn(`Symptom check CDSS unavailable: ${e?.message}`);
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
  }): Promise<{ sessionId: string; reply: string; intent?: string; adherenceConcern: boolean }> {
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
    let intent: string | undefined;
    let adherenceConcern = false;

    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: this.claudeModel,
        max_tokens: 512,
        system: `You are a compassionate medication adherence assistant for a healthcare platform.
Help patients understand their medications, manage side effects, and stay adherent.
Medications: ${(dto.medications || []).join(', ') || 'not specified'}.
Always recommend consulting their doctor for medical decisions.
Detect if the patient is reporting: skipping doses, side effects, running out of medication, or cost barriers.
Keep responses concise (2-3 sentences max).`,
        messages,
      }, {
        headers: { 'x-api-key': this.claudeApiKey, 'anthropic-version': '2023-06-01' },
        timeout: 20000,
      });

      reply = response.data.content?.[0]?.text || reply;

      // Detect intent from message keywords
      const lower = dto.message.toLowerCase();
      if (lower.includes('side effect') || lower.includes('feeling sick')) intent = 'side_effect';
      else if (lower.includes('refill') || lower.includes('running out')) intent = 'refill_request';
      else if (lower.includes('skip') || lower.includes('forgot') || lower.includes('miss')) {
        intent = 'adherence_check';
        adherenceConcern = true;
      } else intent = 'general';
    } catch (e: any) {
      this.logger.warn(`Adherence chat Claude API failed: ${e?.message}`);
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

    return { sessionId, reply, intent, adherenceConcern };
  }

  async getChatHistory(subdomain: string, patientId: string, sessionId?: string): Promise<AdherenceChatLog[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: any = sessionId ? { patientId, sessionId } : { patientId };
    return ds.getRepository(AdherenceChatLog).find({
      where, order: { createdAt: 'ASC' },
    });
  }
}
