import { Injectable, Optional } from '@nestjs/common';
import { AbstentionLogService } from './abstention-log.service';

export interface SubstituteSuggestion {
  drug: string;
  confidence: number;
  rationale: string;
  caveat: string;
  sourceType: 'rule';
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
    @Optional() private readonly abstentionLog: AbstentionLogService,
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
    const { originalDrug, originalDose, patientId, requestedBy } = params;

    const suggestions = this.ruleBasedFallback(originalDrug);
    const cdssAvailable = false;
    let abstentionReason: string | null = null;

    if (!suggestions.length) {
      abstentionReason = 'no_data';
      await this.abstentionLog?.log(db, 'drug_substitution', 'no_data', {
        errorDetail: originalDrug,
      });
    } else {
      abstentionReason = 'cdss_error';
      await this.abstentionLog?.log(db, 'drug_substitution', 'cdss_error', {
        errorDetail: originalDrug,
      });
    }

    const insertRes = await db.query(
      `INSERT INTO drug_substitution_suggestions
         (original_drug, original_dose, patient_id, requested_by, suggestions,
          cdss_available, abstention_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        originalDrug,
        originalDose ?? null,
        patientId ?? null,
        requestedBy,
        JSON.stringify(suggestions),
        cdssAvailable,
        abstentionReason,
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
