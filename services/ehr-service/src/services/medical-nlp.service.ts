import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ALLERGEN_DICTIONARY,
  REACTION_DICTIONARY,
  SEVERITY_MAP,
  AllergenEntry,
  ReactionEntry,
} from '../config/medical-nlp-dictionaries';

export interface ParsedAllergy {
  allergen: string;
  allergenSnomedCode: string | null;
  allergenSnomedTerm: string | null;
  category: string | null;
  severity: 'mild' | 'moderate' | 'severe' | null;
  reaction: string | null;
  reactionSnomedCode: string | null;
  reactionSnomedTerm: string | null;
  confidence: number;
}

export interface ReconciliationReport {
  added: number;
  skipped: number;
  parsed: ParsedAllergy[];
}

@Injectable()
export class MedicalNlpService {
  private readonly logger = new Logger(MedicalNlpService.name);

  extractAllergiesFromText(freeText: string): ParsedAllergy[] {
    if (!freeText?.trim()) return [];

    const normalized = freeText.trim();
    if (/^(nkda|nka|none|nil|no known|none known|no known allergies|no known drug allergies)$/i.test(normalized)) {
      return [];
    }

    const phrases = normalized
      .split(/[,;\n]+|\band\b|\b\/\b/)
      .map((p) => p.trim())
      .filter((p) => p.length > 1);

    const results: ParsedAllergy[] = [];
    const seen = new Set<string>();

    for (const phrase of phrases) {
      const parsed = this.parseAllergyPhrase(phrase);
      if (parsed) {
        const key = parsed.allergen.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push(parsed);
        }
      }
    }

    return results;
  }

  async reconcilePatientAllergies(
    tenantDb: DataSource,
    patientId: string,
  ): Promise<ReconciliationReport> {
    const patientRows = await tenantDb.query(
      `SELECT allergies FROM patients WHERE id = $1 LIMIT 1`,
      [patientId],
    );
    if (!patientRows?.length || !patientRows[0].allergies?.trim()) {
      return { added: 0, skipped: 0, parsed: [] };
    }

    const parsed = this.extractAllergiesFromText(patientRows[0].allergies);
    if (!parsed.length) return { added: 0, skipped: 0, parsed: [] };

    const existing = await tenantDb.query(
      `SELECT LOWER(allergen) as allergen FROM allergies WHERE patient_id = $1`,
      [patientId],
    );
    const existingSet = new Set((existing || []).map((r: any) => r.allergen));

    let added = 0;
    let skipped = 0;

    for (const allergy of parsed) {
      if (existingSet.has(allergy.allergen.toLowerCase())) {
        skipped++;
        continue;
      }

      try {
        await tenantDb.query(
          `INSERT INTO allergies
            (patient_id, allergen, allergen_snomed_code, allergen_snomed_term,
             reaction, reaction_snomed_code, reaction_snomed_term,
             severity, clinical_status, verification_status, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 'unconfirmed', 'nlp_extracted')
           ON CONFLICT DO NOTHING`,
          [
            patientId,
            allergy.allergen,
            allergy.allergenSnomedCode,
            allergy.allergenSnomedTerm,
            allergy.reaction,
            allergy.reactionSnomedCode,
            allergy.reactionSnomedTerm,
            allergy.severity,
          ],
        );
        added++;
      } catch (err) {
        this.logger.warn(`Failed to insert allergy for patient ${patientId}: ${err.message}`);
      }
    }

    this.logger.log(`Reconciled allergies for patient ${patientId}: added=${added}, skipped=${skipped}`);
    return { added, skipped, parsed };
  }

  async batchReconcileAllPatients(
    tenantDb: DataSource,
  ): Promise<{ patientsProcessed: number; totalAdded: number }> {
    const patients = await tenantDb.query(
      `SELECT id FROM patients
       WHERE allergies IS NOT NULL AND allergies != '' AND LOWER(allergies) NOT IN ('nkda', 'none', 'nil', 'nka', 'no known allergies')`,
    );

    let patientsProcessed = 0;
    let totalAdded = 0;

    for (const p of (patients || [])) {
      try {
        const result = await this.reconcilePatientAllergies(tenantDb, p.id);
        totalAdded += result.added;
        patientsProcessed++;
      } catch (err) {
        this.logger.warn(`Failed to reconcile patient ${p.id}: ${err.message}`);
      }
    }

    this.logger.log(`Batch reconciliation complete: ${patientsProcessed} patients, ${totalAdded} allergies added`);
    return { patientsProcessed, totalAdded };
  }

  private parseAllergyPhrase(phrase: string): ParsedAllergy | null {
    let allergenText = '';
    let severityText = '';
    let reactionText = '';

    // Pattern 1: "allergen - severity reaction" e.g. "penicillin - severe anaphylaxis"
    const m1 = phrase.match(/^(.+?)\s*[-–:]\s*(\w+)?\s*(.*)?$/i);
    if (m1 && m1[1].trim().length > 1) {
      allergenText = m1[1].trim();
      const word2 = (m1[2] || '').toLowerCase();
      const word3 = (m1[3] || '').trim();
      if (SEVERITY_MAP[word2]) {
        severityText = word2;
        reactionText = word3;
      } else {
        reactionText = `${m1[2] || ''} ${word3}`.trim();
      }
    }

    // Pattern 2: "severity reaction to allergen" e.g. "severe rash to amoxicillin"
    if (!allergenText) {
      const m2 = phrase.match(/^(mild|moderate|severe|serious|anaphylactic)\s+(.+?)\s+(?:to|from|with)\s+(.+)$/i);
      if (m2) {
        severityText = m2[1].toLowerCase();
        reactionText = m2[2].trim();
        allergenText = m2[3].trim();
      }
    }

    // Pattern 3: "allergen (reaction)" e.g. "latex (hives)"
    if (!allergenText) {
      const m3 = phrase.match(/^(.+?)\s*\((.+)\)\s*$/);
      if (m3) {
        allergenText = m3[1].trim();
        reactionText = m3[2].trim();
      }
    }

    // Pattern 4: whole phrase is the allergen
    if (!allergenText) {
      allergenText = phrase.trim();
    }

    if (!allergenText || allergenText.length < 2) return null;

    const allergenMatch = this.matchAllergen(allergenText);
    const reactionMatch = reactionText ? this.matchReaction(reactionText) : null;
    const severity = this.detectSeverity(severityText, reactionText);

    let confidence = 0.3;
    if (allergenMatch) confidence = 0.9;
    else if (this.isPartialAllergenMatch(allergenText)) confidence = 0.5;

    return {
      allergen: allergenMatch?.name || allergenText,
      allergenSnomedCode: allergenMatch?.snomedCode || null,
      allergenSnomedTerm: allergenMatch?.snomedTerm || null,
      category: allergenMatch?.category || null,
      severity,
      reaction: reactionMatch?.name || reactionText || null,
      reactionSnomedCode: reactionMatch?.snomedCode || null,
      reactionSnomedTerm: reactionMatch?.snomedTerm || null,
      confidence,
    };
  }

  private matchAllergen(text: string): AllergenEntry | null {
    const lower = text.toLowerCase().trim();
    for (const entry of ALLERGEN_DICTIONARY) {
      for (const alias of entry.aliases) {
        if (lower === alias || lower.includes(alias) || alias.includes(lower)) {
          return entry;
        }
      }
    }
    return null;
  }

  private isPartialAllergenMatch(text: string): boolean {
    const lower = text.toLowerCase();
    for (const entry of ALLERGEN_DICTIONARY) {
      for (const alias of entry.aliases) {
        if (lower.includes(alias.substring(0, 4)) || alias.includes(lower.substring(0, 4))) {
          return true;
        }
      }
    }
    return false;
  }

  private matchReaction(text: string): ReactionEntry | null {
    const lower = text.toLowerCase().trim();
    for (const entry of REACTION_DICTIONARY) {
      for (const alias of entry.aliases) {
        if (lower === alias || lower.includes(alias) || alias.includes(lower)) {
          return entry;
        }
      }
    }
    return null;
  }

  private detectSeverity(
    severityText: string,
    reactionText: string,
  ): 'mild' | 'moderate' | 'severe' | null {
    const combined = `${severityText} ${reactionText}`.toLowerCase();
    for (const [keyword, level] of Object.entries(SEVERITY_MAP)) {
      if (combined.includes(keyword)) return level;
    }
    return null;
  }
}
