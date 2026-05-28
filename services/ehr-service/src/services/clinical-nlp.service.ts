import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { ClinicalLlmService } from './clinical-llm.service';
import { AbstentionLogService } from './abstention-log.service';

export interface ClinicalEntities {
  diagnoses: Array<{ text: string; icd10Hint?: string; confidence: number }>;
  medications: Array<{ name: string; dose?: string; frequency?: string; confidence: number }>;
  allergies: Array<{ substance: string; reaction?: string; confidence: number }>;
  symptoms: Array<{ text: string; duration?: string; severity?: string; confidence: number }>;
  procedures: Array<{ text: string; confidence: number }>;
  aiSource: string;
}

const EMPTY_ENTITIES: ClinicalEntities = {
  diagnoses: [], medications: [], allergies: [],
  symptoms: [], procedures: [], aiSource: 'rule',
};

@Injectable()
export class ClinicalNlpService {
  private readonly logger = new Logger(ClinicalNlpService.name);

  constructor(
    @Optional() private readonly llm?: ClinicalLlmService,
    @Optional() private readonly abstentionLog?: AbstentionLogService,
  ) {}

  async extractEntities(
    text: string,
    opts: { context: string; patientId?: number; encounterId?: number },
    db?: any,
  ): Promise<ClinicalEntities> {
    if (!text || text.trim().length < 5) return { ...EMPTY_ENTITIES };
    if (!this.llm) return this.ruleBasedFallback(text);

    const inputHash = createHash('sha256').update(text).digest('hex').slice(0, 16);
    const prompt =
      `Extract all clinical entities from the following note. ` +
      `Return ONLY valid JSON matching this schema exactly:\n` +
      `{"diagnoses":[{"text":"","icd10Hint":"","confidence":0.0}],` +
      `"medications":[{"name":"","dose":"","frequency":"","confidence":0.0}],` +
      `"allergies":[{"substance":"","reaction":"","confidence":0.0}],` +
      `"symptoms":[{"text":"","duration":"","severity":"","confidence":0.0}],` +
      `"procedures":[{"text":"","confidence":0.0}]}\n\n` +
      `Note:\n${text.slice(0, 2000)}`;

    const start = Date.now();
    const result = await this.llm.generate(
      prompt,
      { context: opts.context, maxTokens: 600, temperature: 0.1 },
      db,
    );
    const latencyMs = Date.now() - start;

    if (!result) {
      await this.abstentionLog?.log(
        db,
        `clinical_nlp:${opts.context}` as any,
        'timeout',
        opts.patientId ? { patientId: String(opts.patientId) } : undefined,
      );
      if (db) {
        await this.audit(db, opts, inputHash, EMPTY_ENTITIES, 'unknown', 'unknown', latencyMs, false, 'llm_null');
      }
      return this.ruleBasedFallback(text);
    }

    try {
      const parsed = JSON.parse(result.text) as Omit<ClinicalEntities, 'aiSource'>;
      const entities: ClinicalEntities = { ...parsed, aiSource: `llm:${result.backend}` };
      if (db) {
        await this.audit(db, opts, inputHash, entities, result.backend, result.model, latencyMs, true, null);
      }
      return entities;
    } catch (parseErr: any) {
      this.logger.warn(`NLP JSON parse failed: ${parseErr.message}`);
      await this.abstentionLog?.log(
        db,
        `clinical_nlp:${opts.context}` as any,
        'low_confidence',
        opts.patientId
          ? { patientId: String(opts.patientId), errorDetail: 'json_parse_failed' }
          : undefined,
      );
      if (db) {
        await this.audit(
          db, opts, inputHash, EMPTY_ENTITIES,
          result.backend, result.model, latencyMs, false, 'json_parse_failed',
        );
      }
      return this.ruleBasedFallback(text);
    }
  }

  parseClinicalNarrative(text: string): Partial<ClinicalEntities> {
    return this.ruleBasedFallback(text);
  }

  private ruleBasedFallback(text: string): ClinicalEntities {
    const lower = text.toLowerCase();
    const diagnoses: ClinicalEntities['diagnoses'] = [];
    const medications: ClinicalEntities['medications'] = [];
    const allergies: ClinicalEntities['allergies'] = [];
    const symptoms: ClinicalEntities['symptoms'] = [];

    const COMMON_DX = [
      'hypertension', 'diabetes', 'hiv', 'tuberculosis', 'malaria',
      'asthma', 'copd', 'heart failure', 'anaemia', 'anemia',
      'pneumonia', 'stroke', 'cancer', 'depression', 'epilepsy',
    ];
    for (const dx of COMMON_DX) {
      if (lower.includes(dx)) diagnoses.push({ text: dx, confidence: 0.6 });
    }

    const ALLERGY_PATTERN = /allerg(?:ic|y) to ([a-zA-Z\s]+?)(?:\.|,|;|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = ALLERGY_PATTERN.exec(text)) !== null) {
      allergies.push({ substance: m[1].trim(), confidence: 0.7 });
    }

    const SYMPTOM_WORDS = [
      'pain', 'cough', 'fever', 'fatigue', 'dyspnoea', 'nausea', 'vomiting', 'diarrhoea',
    ];
    for (const sym of SYMPTOM_WORDS) {
      if (lower.includes(sym)) symptoms.push({ text: sym, confidence: 0.5 });
    }

    return { diagnoses, medications, allergies, symptoms, procedures: [], aiSource: 'rule' };
  }

  private async audit(
    db: any,
    opts: { context: string; patientId?: number; encounterId?: number },
    inputHash: string,
    entities: ClinicalEntities,
    backend: string,
    model: string,
    latencyMs: number,
    success: boolean,
    errorMsg: string | null,
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO clinical_nlp_extractions
           (patient_id, encounter_id, context, input_hash, entities,
            backend, model, latency_ms, success, error_msg)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          opts.patientId ?? null, opts.encounterId ?? null,
          opts.context, inputHash, JSON.stringify(entities),
          backend, model, latencyMs, success, errorMsg,
        ],
      );
    } catch {
      // Audit failure must never block the caller
    }
  }
}
