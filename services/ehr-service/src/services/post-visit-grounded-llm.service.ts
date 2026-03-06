import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

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
}

export interface PostVisitPatientAnswerInput {
  sessionId: string;
  language?: string;
  question: string;
  summary: string;
  checklist: string[];
  citations: GroundingCitation[];
}

export interface PostVisitPatientAnswerOutput {
  answer: string;
  citationsUsed: string[];
  model: string;
  abstained: boolean;
  abstainReason?: string;
  urgentSignal: boolean;
}

@Injectable()
export class PostVisitGroundedLlmService {
  private readonly logger = new Logger(PostVisitGroundedLlmService.name);
  private readonly enabled = String(process.env.POSTVISIT_GROUNDED_LLM_ENABLED || 'true').toLowerCase() !== 'false';
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

  async polishDoctorContent(input: PostVisitDoctorPolishInput): Promise<PostVisitDoctorPolishOutput | null> {
    if (!this.canUseLlm()) {
      return null;
    }
    if (!input?.baseSummary) {
      return null;
    }

    const allowedCitationIds = new Set(input.citations.map((citation) => String(citation.id || '').trim()).filter(Boolean));

    try {
      const json = await this.requestJsonCompletion(
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
      const json = await this.requestJsonCompletion(
        [
          {
            role: 'system',
            content:
              'You are a post-visit patient companion. Answer only from doctor-approved summary/checklist and citations. Never invent instructions. Prefer abstaining when uncertain.',
          },
          {
            role: 'user',
            content: JSON.stringify({
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
              allowed_citations: input.citations,
              output_schema: {
                abstain: 'boolean',
                abstain_reason: 'string|null',
                answer: 'string',
                citations_used: 'string[]',
                urgent_signal: 'boolean',
              },
            }),
          },
        ],
        0.1,
      );

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
      };
    } catch (error: any) {
      this.logger.warn(`Patient answer LLM request failed, using deterministic fallback: ${String(error?.message || error)}`);
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

  private async requestJsonCompletion(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, temperature = 0.1) {
    const response = await axios.post(
      this.apiUrl,
      {
        model: this.apiModel,
        temperature,
        response_format: {
          type: 'json_object',
        },
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

    const content = response?.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Missing LLM JSON content');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error('LLM JSON parse failed');
    }
  }
}
