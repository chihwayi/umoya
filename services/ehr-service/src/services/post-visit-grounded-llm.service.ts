import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { LruCache } from '../utils/lru-cache';

export interface GroundingCitation {
  id: string;
  label: string;
  source?: string;
  url?: string | null;
  excerpt?: string | null;
  guidelineId?: string;
  recommendationId?: string;
  ruleId?: string;
}

export interface PostVisitDoctorPolishInput {
  sessionId: string;
  language?: string;
  soapNote?: Record<string, any>;
  baseSummary: {
    summaryText?: string;
    plainLanguageSummary?: string;
    keyPoints?: string[];
  };
  recommendationItems: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  citations: GroundingCitation[];
}

export interface PostVisitDoctorPolishOutput {
  plainLanguageSummary: string;
  keyPoints: string[];
  summaryText?: string;
  recommendationRewrites: Array<{
    recommendationId: string;
    title?: string;
    description?: string;
  }>;
  citationsUsed: string[];
  model: string;
  audit?: LlmAuditMetadata;
}

export interface PostVisitPatientAnswerInput {
  sessionId: string;
  language?: string;
  question: string;
  summary: string;
  checklist: string[];
  memoryFacts?: string[];
  citations: GroundingCitation[];
  sectionType?: string;
  sectionContent?: string;
}

export interface PostVisitPatientAnswerOutput {
  answer: string;
  citationsUsed: string[];
  model: string;
  abstained: boolean;
  abstainReason?: string;
  urgentSignal: boolean;
  audit?: LlmAuditMetadata;
}

export interface PostVisitEscalationClassifierInput {
  sessionId?: string;
  message: string;
  triggerTerms: string[];
  candidateSeverity: 'low' | 'moderate' | 'high' | 'critical';
}

export interface PostVisitEscalationClassifierOutput {
  severity: 'low' | 'moderate' | 'high' | 'critical';
  routeTarget: 'emergency' | 'doctor' | 'nurse';
  temporality: 'current' | 'historical' | 'unclear';
  confidence: number;
  rationale?: string;
  model: string;
  audit?: LlmAuditMetadata;
}

export interface LlmAuditMetadata {
  promptHash: string;
  templateVersion: string;
  inputTokenCount: number;
  outputTokenCount: number;
  latencyMs: number;
  safetyGateTriggered: boolean;
}

@Injectable()
export class PostVisitGroundedLlmService {
  private readonly logger = new Logger(PostVisitGroundedLlmService.name);
  private readonly enabled = String(process.env.POSTVISIT_GROUNDED_LLM_ENABLED || 'true').toLowerCase() !== 'false';
  private readonly circuitBreaker = new CircuitBreaker(5, 30000);
  private readonly responseCache = new LruCache<{ json: any; audit: LlmAuditMetadata }>(200, 3600000);
  private readonly apiUrl = String(process.env.POSTVISIT_LLM_API_URL || 'https://api.openai.com/v1/chat/completions');
  private readonly apiModel = String(process.env.POSTVISIT_LLM_MODEL || 'gpt-4o-mini');
  private readonly timeoutMs = Math.min(
    Math.max(Number(process.env.POSTVISIT_LLM_TIMEOUT_MS || 12000), 3000),
    45000,
  );

  private get apiKey(): string {
    return String(process.env.POSTVISIT_LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY || '').trim();
  }

  private canUseLlm() {
    return this.enabled && this.apiKey.length > 0;
  }

  async draftReferralLetter(input: {
    sessionId: string;
    language?: string | null;
    patientLabel?: string | null;
    clinicianLabel?: string | null;
    recipientLabel?: string | null;
    referralReason?: string | null;
    soapNote?: Record<string, any> | null;
    visitSummary?: Record<string, any> | null;
    recommendationItems?: any[];
  }): Promise<{ letterText: string; model: string; audit?: LlmAuditMetadata } | null> {
    if (!this.canUseLlm()) return null;
    if (!input?.sessionId) return null;

    try {
      const llmResponse = await this.requestJsonCompletion(
        [
          {
            role: 'system',
            content:
              'You write clinician referral letters. Use only the provided encounter context. Do not invent diagnoses, labs, medications, allergies, or history. If insufficient context, abstain.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'draft_referral_letter',
              language: input.language || 'en',
              session_id: input.sessionId,
              constraints: {
                max_chars: 3500,
                tone: 'professional_clinical',
                include_sections: ['header', 'reason', 'summary', 'assessment', 'plan', 'requested_action', 'signature'],
              },
              context: {
                patient: input.patientLabel || null,
                clinician: input.clinicianLabel || null,
                recipient: input.recipientLabel || null,
                referral_reason: input.referralReason || null,
                soap_note: input.soapNote || {},
                visit_summary: input.visitSummary || {},
                recommendations: Array.isArray(input.recommendationItems) ? input.recommendationItems.slice(0, 12) : [],
              },
              output_schema: {
                abstain: 'boolean',
                abstain_reason: 'string|null',
                letter_text: 'string',
              },
            }),
          },
        ],
        0.2,
      );

      const json = llmResponse.json;
      if (json?.abstain === true) return null;
      const letterText = this.normalizeText(json?.letter_text, 3600);
      if (!letterText) return null;
      return { letterText, model: this.apiModel, audit: llmResponse.audit };
    } catch {
      return null;
    }
  }

  async draftClinicalNote(input: {
    sessionId: string;
    language?: string | null;
    transcriptText?: string | null;
    soapNote?: Record<string, any> | null;
    visitSummary?: Record<string, any> | null;
    recommendationItems?: any[];
  }): Promise<{ noteText: string; model: string; audit?: LlmAuditMetadata } | null> {
    if (!this.canUseLlm()) return null;
    if (!input?.sessionId) return null;

    try {
      const llmResponse = await this.requestJsonCompletion(
        [
          {
            role: 'system',
            content:
              'You draft clinician progress notes from transcription + structured context. Do not invent diagnoses, medications, labs, or vitals. If insufficient context, abstain. Output a concise but complete note.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'draft_clinical_note',
              language: input.language || 'en',
              session_id: input.sessionId,
              constraints: {
                max_chars: 5000,
                format: 'markdown',
                required_sections: ['Subjective', 'Objective', 'Assessment', 'Plan', 'Follow-up'],
              },
              context: {
                transcript_text: (input.transcriptText || '').slice(0, 12000),
                soap_note: input.soapNote || {},
                visit_summary: input.visitSummary || {},
                recommendations: Array.isArray(input.recommendationItems) ? input.recommendationItems.slice(0, 15) : [],
              },
              output_schema: {
                abstain: 'boolean',
                abstain_reason: 'string|null',
                note_text: 'string',
              },
            }),
          },
        ],
        0.2,
      );

      const json = llmResponse.json;
      if (json?.abstain === true) return null;
      const noteText = this.normalizeText(json?.note_text, 5200);
      if (!noteText) return null;
      return { noteText, model: this.apiModel, audit: llmResponse.audit };
    } catch {
      return null;
    }
  }

  async polishDoctorContent(input: PostVisitDoctorPolishInput): Promise<PostVisitDoctorPolishOutput | null> {
    if (!this.canUseLlm()) {
      return null;
    }
    if (!input?.baseSummary) {
      return null;
    }

    const allowedCitationIds = new Set(input.citations.map((citation) => String(citation.id || '').trim()).filter(Boolean));

    try {
      const llmResponse = await this.requestJsonCompletion(
        [
          {
            role: 'system',
            content:
              'You are a clinical documentation polisher. Only rewrite text using provided context and citations. Do not invent diagnoses, dosages, labs, or plans. If grounding is insufficient, abstain.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'polish_doctor_post_visit_artifacts',
              constraints: {
                max_plain_summary_chars: 900,
                max_key_points: 8,
                max_recommendation_rewrites: 20,
                cite_using_allowed_ids_only: true,
              },
              session_id: input.sessionId,
              language: input.language || 'en',
              soap_note: input.soapNote || {},
              base_summary: input.baseSummary,
              recommendation_items: input.recommendationItems,
              allowed_citations: input.citations,
              output_schema: {
                abstain: 'boolean',
                abstain_reason: 'string|null',
                plain_language_summary: 'string',
                key_points: 'string[]',
                summary_text: 'string|null',
                recommendation_rewrites: [{ recommendation_id: 'string', title: 'string|null', description: 'string|null' }],
                citations_used: 'string[]',
              },
            }),
          },
        ],
        0.1,
      );
      const json = llmResponse.json;

      const abstain = json?.abstain === true;
      if (abstain) {
        return null;
      }

      const plainLanguageSummary = this.normalizeText(json?.plain_language_summary, 900);
      if (!plainLanguageSummary) {
        return null;
      }

      const keyPoints = Array.isArray(json?.key_points)
        ? json.key_points.map((entry: any) => this.normalizeText(entry, 220)).filter(Boolean)
        : [];

      const citationsUsed = this.validateCitationIds(json?.citations_used, allowedCitationIds, allowedCitationIds.size > 0);
      if (!citationsUsed) {
        return null;
      }

      const recommendationRewrites = Array.isArray(json?.recommendation_rewrites)
        ? json.recommendation_rewrites
            .map((entry: any) => ({
              recommendationId: String(entry?.recommendation_id || '').trim(),
              title: this.normalizeText(entry?.title, 180),
              description: this.normalizeText(entry?.description, 600),
            }))
            .filter((entry: any) => entry.recommendationId.length > 0)
        : [];

      return {
        plainLanguageSummary,
        keyPoints: keyPoints.slice(0, 8),
        summaryText: this.normalizeText(json?.summary_text, 3000) || undefined,
        recommendationRewrites,
        citationsUsed,
        model: this.apiModel,
        audit: {
          ...llmResponse.audit,
          safetyGateTriggered: false,
        },
      };
    } catch (error: any) {
      this.logger.warn(`Doctor polish LLM request failed, using deterministic fallback: ${String(error?.message || error)}`);
      return null;
    }
  }

  async answerPatientQuestion(input: PostVisitPatientAnswerInput): Promise<PostVisitPatientAnswerOutput | null> {
    if (!this.canUseLlm()) {
      return null;
    }
    const question = this.normalizeText(input.question, 1200);
    if (!question) {
      return null;
    }

    const allowedCitationIds = new Set(input.citations.map((citation) => String(citation.id || '').trim()).filter(Boolean));

    try {
      const llmResponse = await this.requestJsonCompletion(
        [
          {
            role: 'system',
            content:
              'You are a post-visit patient companion. Answer only from doctor-approved summary/checklist and citations. Never invent instructions. Prefer abstaining when uncertain.',
          },
          {
            role: 'user',
            content: (() => {
              const payload: Record<string, any> = {
                task: 'patient_grounded_answer',
                constraints: {
                  max_answer_chars: 1200,
                  cite_using_allowed_ids_only: true,
                  use_plain_language: true,
                  include_emergency_warning_when_urgent_signal: true,
                },
                session_id: input.sessionId,
                language: input.language || 'en',
                question,
                approved_summary: input.summary,
                approved_checklist: input.checklist,
                companion_memory_facts: Array.isArray(input.memoryFacts) ? input.memoryFacts.slice(0, 8) : [],
                allowed_citations: input.citations,
                output_schema: {
                  abstain: 'boolean',
                  abstain_reason: 'string|null',
                  answer: 'string',
                  citations_used: 'string[]',
                  urgent_signal: 'boolean',
                },
              };
              if (input.sectionType && input.sectionContent) {
                payload.section_scope = {
                  section_type: input.sectionType,
                  section_content: input.sectionContent,
                  instruction: `Focus your answer on the "${input.sectionType}" section of the visit summary. The content of this section is provided in "section_content". Answer the question specifically in the context of this section. If the question is not related to this section, say so and provide context from the full summary instead.`,
                };
              }
              return JSON.stringify(payload);
            })(),
          },
        ],
        0.1,
      );
      const json = llmResponse.json;

      const abstained = json?.abstain === true;
      const citationsUsed = this.validateCitationIds(
        json?.citations_used,
        allowedCitationIds,
        !abstained && allowedCitationIds.size > 0,
      );
      if (!citationsUsed) {
        return null;
      }

      if (abstained) {
        return {
          answer: '',
          citationsUsed,
          model: this.apiModel,
          abstained: true,
          abstainReason: this.normalizeText(json?.abstain_reason, 400) || 'Insufficient grounded context.',
          urgentSignal: json?.urgent_signal === true,
          audit: {
            ...llmResponse.audit,
            safetyGateTriggered: true,
          },
        };
      }

      const answer = this.normalizeText(json?.answer, 1200);
      if (!answer) {
        return null;
      }

      return {
        answer,
        citationsUsed,
        model: this.apiModel,
        abstained: false,
        urgentSignal: json?.urgent_signal === true,
        audit: {
          ...llmResponse.audit,
          safetyGateTriggered: false,
        },
      };
    } catch (error: any) {
      this.logger.warn(`Patient answer LLM request failed, using deterministic fallback: ${String(error?.message || error)}`);
      return null;
    }
  }

  async classifyEscalationSignal(
    input: PostVisitEscalationClassifierInput,
  ): Promise<PostVisitEscalationClassifierOutput | null> {
    if (!this.canUseLlm()) {
      return null;
    }

    const message = this.normalizeText(input?.message, 1200);
    if (!message) {
      return null;
    }

    try {
      const llmResponse = await this.requestJsonCompletion(
        [
          {
            role: 'system',
            content:
              'You are a clinical escalation classifier for post-visit patient messages. Output strict JSON only. Classify severity, route, temporality, and confidence. Be conservative for emergency routing.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'post_visit_escalation_classification_v2',
              session_id: input?.sessionId || null,
              message,
              stage1_prefilter: {
                trigger_terms: Array.isArray(input.triggerTerms) ? input.triggerTerms.slice(0, 12) : [],
                candidate_severity: input.candidateSeverity || 'low',
              },
              rules: {
                emergency_requires_current_temporality: true,
                route_targets: ['emergency', 'doctor', 'nurse'],
                temporality_values: ['current', 'historical', 'unclear'],
                confidence_range: [0, 1],
              },
              output_schema: {
                severity: 'low|moderate|high|critical',
                route_target: 'emergency|doctor|nurse',
                temporality: 'current|historical|unclear',
                confidence: 'number',
                rationale: 'string|null',
              },
            }),
          },
        ],
        0.05,
      );

      const json = llmResponse.json || {};
      const severityRaw = String(json?.severity || '').toLowerCase();
      const routeRaw = String(json?.route_target || '').toLowerCase();
      const temporalityRaw = String(json?.temporality || '').toLowerCase();
      const confidenceRaw = Number(json?.confidence);

      const severity = ['low', 'moderate', 'high', 'critical'].includes(severityRaw)
        ? (severityRaw as 'low' | 'moderate' | 'high' | 'critical')
        : null;
      const routeTarget = ['emergency', 'doctor', 'nurse'].includes(routeRaw)
        ? (routeRaw as 'emergency' | 'doctor' | 'nurse')
        : null;
      const temporality = ['current', 'historical', 'unclear'].includes(temporalityRaw)
        ? (temporalityRaw as 'current' | 'historical' | 'unclear')
        : null;

      if (!severity || !routeTarget || !temporality || !Number.isFinite(confidenceRaw)) {
        return null;
      }

      return {
        severity,
        routeTarget,
        temporality,
        confidence: Math.min(1, Math.max(0, confidenceRaw)),
        rationale: this.normalizeText(json?.rationale, 600) || undefined,
        model: this.apiModel,
        audit: {
          ...llmResponse.audit,
          templateVersion: 'postvisit-escalation-v2',
          safetyGateTriggered: false,
        },
      };
    } catch (error: any) {
      this.logger.warn(`Escalation classifier LLM request failed, using deterministic fallback: ${String(error?.message || error)}`);
      return null;
    }
  }

  private normalizeText(value: any, maxLength: number): string {
    if (typeof value !== 'string') {
      return '';
    }
    const compact = value.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return '';
    }
    return compact.slice(0, maxLength);
  }

  private validateCitationIds(raw: any, allowed: Set<string>, required: boolean): string[] | null {
    if (!Array.isArray(raw)) {
      return required ? null : [];
    }
    const normalized = Array.from(
      new Set(
        raw
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    );
    if (required && normalized.length === 0) {
      return null;
    }
    if (normalized.some((citationId) => !allowed.has(citationId))) {
      return null;
    }
    return normalized;
  }

  private approximateTokenCount(text: string): number {
    return Math.max(1, Math.ceil(String(text || '').length / 4));
  }

  async requestJsonCompletion(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, temperature = 0.1) {
    const promptText = messages.map((message) => `${message.role}:${message.content}`).join('\n');
    const promptHash = createHash('sha256').update(promptText).digest('hex');

    // 1. Check cache
    const cached = this.responseCache.get(promptHash);
    if (cached) {
      this.logger.debug(`LLM cache hit for prompt ${promptHash.substring(0, 8)}`);
      return { ...cached, source: 'cache' as const };
    }

    // 2. Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      this.logger.warn(`Circuit breaker OPEN — skipping LLM call (state: ${this.circuitBreaker.getState()})`);
      return null;
    }

    // 3. Make API call
    try {
      const startedAt = Date.now();
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.apiModel,
          temperature,
          response_format: { type: 'json_object' },
          messages,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeoutMs,
        },
      );
      const latencyMs = Date.now() - startedAt;

      const content = response?.data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        this.circuitBreaker.recordFailure();
        return null;
      }

      const parsed = JSON.parse(content);
      const result = {
        json: parsed,
        audit: {
          promptHash,
          templateVersion: 'postvisit-grounded-v1',
          inputTokenCount: this.approximateTokenCount(promptText),
          outputTokenCount: this.approximateTokenCount(content),
          latencyMs,
          safetyGateTriggered: false,
        } as LlmAuditMetadata,
      };

      this.circuitBreaker.recordSuccess();
      this.responseCache.set(promptHash, result);
      return { ...result, source: 'llm' as const };
    } catch (error: any) {
      this.circuitBreaker.recordFailure();
      this.logger.warn(`LLM call failed (circuit: ${this.circuitBreaker.getState()}): ${error.message}`);
      return null;
    }
  }
}
