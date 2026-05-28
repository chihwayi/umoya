import { Injectable, Optional } from '@nestjs/common';
import { AbstentionLogService } from './abstention-log.service';
import { ClinicalLlmService } from './clinical-llm.service';
import { ClinicalNlpService } from './clinical-nlp.service';

export interface SubstituteSuggestion {
  drug: string;
  confidence: number;
  rationale: string;
  caveat: string;
  sourceType: 'rule' | 'llm';
}

export interface SubstitutionResult {
  id: number;
  originalDrug: string;
  suggestions: SubstituteSuggestion[];
  cdssAvailable: boolean;
}

@Injectable()
export class DrugSubstitutionService {
  constructor(
    @Optional() private readonly abstentionLog?: AbstentionLogService,
    @Optional() private readonly llm?: ClinicalLlmService,
    @Optional() private readonly nlp?: ClinicalNlpService,
  ) {}

  async getSuggestions(
    db: any,
    params: {
      originalDrug: string;
      originalDose?: string;
      patientId?: number;
      requestedBy: number;
      subdomain: string;
      diagnoses?: string[];
      allergies?: string[];
    },
  ): Promise<SubstitutionResult> {
    const { originalDrug, originalDose, patientId, requestedBy, diagnoses } = params;
    let allergies = params.allergies ? [...params.allergies] : [];

    // Enrich allergies from clinical notes via NLP
    if (this.nlp && db && patientId) {
      const notes = await db.query(
        `SELECT content FROM clinical_notes
          WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 2`,
        [patientId],
      );
      if (notes.length > 0) {
        const noteText = notes.map((n: any) => n.content).join('\n');
        const extracted = await this.nlp.extractEntities(
          noteText,
          { context: 'drug_sub_nlp', patientId },
          db,
        );
        for (const a of extracted.allergies) {
          if (!allergies.includes(a.substance)) allergies.push(a.substance);
        }
      }
    }

    let suggestions = this.ruleBasedFallback(originalDrug);
    let aiSource = 'rule';
    let cdssAvailable = false;
    let abstentionReason: string | null = null;

    if (!suggestions.length) {
      abstentionReason = 'no_data';
      await this.abstentionLog?.log(db, 'drug_substitution', 'no_data', {
        errorDetail: originalDrug,
      });
    } else if (this.llm) {
      suggestions = await this.enrichWithLlm(
        suggestions,
        originalDrug,
        originalDose,
        diagnoses,
        allergies,
        db,
      ).then(({ enriched, backend }) => {
        if (backend) {
          aiSource = `llm:${backend}`;
          cdssAvailable = true;
        } else {
          abstentionReason = 'low_confidence';
        }
        return enriched;
      }).catch(() => {
        abstentionReason = 'cdss_error';
        return suggestions;
      });

      if (abstentionReason) {
        await this.abstentionLog?.log(
          db,
          'drug_substitution',
          abstentionReason as any,
          { errorDetail: originalDrug },
        );
      }
    } else {
      abstentionReason = 'cdss_error';
      await this.abstentionLog?.log(db, 'drug_substitution', 'cdss_error', {
        errorDetail: originalDrug,
      });
    }

    const insertRes = await db.query(
      `INSERT INTO drug_substitution_suggestions
         (original_drug, original_dose, patient_id, requested_by, suggestions,
          cdss_available, abstention_reason, ai_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        originalDrug,
        originalDose ?? null,
        patientId ?? null,
        requestedBy,
        JSON.stringify(suggestions),
        cdssAvailable,
        abstentionReason,
        aiSource,
      ],
    );

    return {
      id: insertRes[0].id,
      originalDrug,
      suggestions,
      cdssAvailable,
    };
  }

  async selectSubstitute(
    db: any,
    suggestionId: number,
    selectedDrug: string,
    selectedBy: number,
  ): Promise<void> {
    await db.query(
      `UPDATE drug_substitution_suggestions
         SET selected_drug = $1, selected_by = $2, selected_at = NOW(),
             updated_at = NOW()
       WHERE id = $3`,
      [selectedDrug, selectedBy, suggestionId],
    );
  }

  async getPatientHistory(db: any, patientId: number): Promise<any[]> {
    return db.query(
      `SELECT id, original_drug, original_dose, suggestions, selected_drug,
              selected_at, cdss_available, created_at
         FROM drug_substitution_suggestions
        WHERE patient_id = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [patientId],
    );
  }

  private async enrichWithLlm(
    suggestions: SubstituteSuggestion[],
    originalDrug: string,
    originalDose?: string,
    diagnoses?: string[],
    allergies?: string[],
    db?: any,
  ): Promise<{ enriched: SubstituteSuggestion[]; backend: string | null }> {
    if (!this.llm) return { enriched: suggestions, backend: null };

    const dxText = diagnoses?.join(', ') || 'not provided';
    const allergyText = allergies?.join(', ') || 'none documented';
    const drugLabel = originalDose ? `${originalDrug} ${originalDose}` : originalDrug;

    const substList = suggestions.map(s => s.drug).join(', ');

    const prompt =
      `You are a clinical pharmacist assistant. Provide an enhanced 1-sentence rationale ` +
      `for substituting ${drugLabel} with: ${substList}.\n` +
      `Patient diagnoses: ${dxText}\n` +
      `Known allergies: ${allergyText}\n` +
      `Return a JSON array of strings, one enhanced rationale per substitute in the same order. ` +
      `JSON only, no other text. Example: ["Enhanced rationale for substitute 1"]`;

    const result = await this.llm.generate(
      prompt,
      { context: 'drug_substitution', maxTokens: 300, temperature: 0.2 },
      db,
    );

    if (!result || result.text.length < 10) {
      return { enriched: suggestions, backend: null };
    }

    const raw = result.text.trim();
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) {
      return { enriched: suggestions, backend: null };
    }

    let rationales: string[];
    try {
      rationales = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return { enriched: suggestions, backend: null };
    }

    if (!Array.isArray(rationales) || rationales.length !== suggestions.length) {
      return { enriched: suggestions, backend: null };
    }

    return {
      enriched: suggestions.map((s, i) => ({
        ...s,
        rationale: rationales[i] ?? s.rationale,
        sourceType: 'llm' as const,
      })),
      backend: result.backend,
    };
  }

  private ruleBasedFallback(drug: string): SubstituteSuggestion[] {
    const lower = drug.toLowerCase();
    const rules: Record<string, SubstituteSuggestion[]> = {
      amoxicillin: [{
        drug: 'Ampicillin 500mg',
        confidence: 0.80,
        rationale: 'Same aminopenicillin class',
        caveat: 'Avoid if penicillin allergy',
        sourceType: 'rule',
      }],
      metformin: [{
        drug: 'Glipizide 5mg',
        confidence: 0.70,
        rationale: 'Alternative first-line oral hypoglycaemic',
        caveat: 'Monitor for hypoglycaemia; avoid in renal impairment',
        sourceType: 'rule',
      }],
      atenolol: [{
        drug: 'Bisoprolol 5mg',
        confidence: 0.82,
        rationale: 'Beta-1 selective blocker equivalence',
        caveat: 'Titrate dose; avoid abrupt cessation',
        sourceType: 'rule',
      }],
      amlodipine: [{
        drug: 'Nifedipine LA 30mg',
        confidence: 0.75,
        rationale: 'Same dihydropyridine CCB class',
        caveat: 'Check heart rate and BP at initiation',
        sourceType: 'rule',
      }],
    };
    for (const [key, subs] of Object.entries(rules)) {
      if (lower.includes(key)) return subs;
    }
    return [];
  }
}
