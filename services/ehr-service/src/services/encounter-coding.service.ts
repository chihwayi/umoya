import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';
import { Icd10Service } from './icd10.service';
import { MlFeedbackService } from './ml-feedback.service';
import { MlModelsService } from './ml-models.service';

export interface CodeSuggestion {
  code: string;
  description: string;
  confidence: number;
}

export interface EncounterCodeResult {
  id: string;
  icd10: CodeSuggestion[];
  cpt: CodeSuggestion[];
  emLevel: string | null;
  emRationale: string | null;
  modifiers: string[];
  confidence: number;
  source: string;
}

@Injectable()
export class EncounterCodingService {
  private readonly logger = new Logger(EncounterCodingService.name);

  constructor(
    private readonly llmService: PostVisitGroundedLlmService,
    private readonly icd10Service: Icd10Service,
    @Optional() private readonly mlFeedbackService?: MlFeedbackService,
    @Optional() private readonly mlModelsService?: MlModelsService,
  ) {}

  async suggestEncounterCodes(
    tenantDb: DataSource,
    sessionId: string | null,
    appointmentId: string | null,
    patientId: string,
    actorId: string,
    tenantId?: string,
  ): Promise<EncounterCodeResult> {
    const clinicalText = await this.gatherClinicalText(tenantDb, sessionId, appointmentId);

    // Try ML model first (3-tier: ML -> LLM -> keyword)
    if (this.mlModelsService && clinicalText.trim()) {
      try {
        const mlResult = await this.mlModelsService.suggestCodesMl(tenantDb, clinicalText);
        if (mlResult && (mlResult.icd10.length > 0 || mlResult.cpt.length > 0)) {
          const ctx = this.emptyContext();
          ctx.problemsAddressed = mlResult.icd10.length;
          const emResult = this.calculateEmLevel(ctx);
          const modifiers = this.suggestModifiers(mlResult.cpt, emResult.level);
          const overallConfidence = this.computeOverallConfidence(mlResult.icd10, mlResult.cpt);

          const row = await tenantDb.query(
            `INSERT INTO encounter_code_suggestions
              (session_id, appointment_id, patient_id, suggested_icd10, suggested_cpt,
               em_level, em_rationale, suggested_modifiers, confidence, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ml')
             RETURNING id`,
            [sessionId, appointmentId, patientId, JSON.stringify(mlResult.icd10), JSON.stringify(mlResult.cpt),
             emResult.level, emResult.rationale, JSON.stringify(modifiers), overallConfidence],
          );
          return {
            id: row[0].id, icd10: mlResult.icd10, cpt: mlResult.cpt,
            emLevel: emResult.level, emRationale: emResult.rationale,
            modifiers, confidence: overallConfidence, source: 'ml',
          };
        }
      } catch (e) {
        this.logger.warn(`ML coding suggestion failed, falling back to LLM/keyword: ${e.message}`);
      }
    }

    // LLM -> keyword fallback
    const diagnoses = await this.extractDiagnosesAndProcedures(clinicalText, tenantId);

    const icd10Suggestions = await this.resolveIcd10Codes(tenantDb, diagnoses.diagnoses);
    const cptSuggestions = this.deriveCptCodes(diagnoses.procedures, diagnoses.context);
    const emResult = this.calculateEmLevel(diagnoses.context);
    const modifiers = this.suggestModifiers(cptSuggestions, emResult.level);
    const overallConfidence = this.computeOverallConfidence(icd10Suggestions, cptSuggestions);

    const row = await tenantDb.query(
      `INSERT INTO encounter_code_suggestions
        (session_id, appointment_id, patient_id, suggested_icd10, suggested_cpt,
         em_level, em_rationale, suggested_modifiers, confidence, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ai')
       RETURNING id`,
      [
        sessionId,
        appointmentId,
        patientId,
        JSON.stringify(icd10Suggestions),
        JSON.stringify(cptSuggestions),
        emResult.level,
        emResult.rationale,
        JSON.stringify(modifiers),
        overallConfidence,
      ],
    );

    return {
      id: row[0].id,
      icd10: icd10Suggestions,
      cpt: cptSuggestions,
      emLevel: emResult.level,
      emRationale: emResult.rationale,
      modifiers,
      confidence: overallConfidence,
      source: 'ai',
    };
  }

  async reviewEncounterCodes(
    tenantDb: DataSource,
    suggestionId: string,
    body: { acceptedCodes: string[]; rejectedCodes: string[] },
    actorId: string,
  ): Promise<{ id: string; acceptedCodes: string[]; rejectedCodes: string[] }> {
    const existing = await tenantDb.query(
      `SELECT id FROM encounter_code_suggestions WHERE id = $1 LIMIT 1`,
      [suggestionId],
    );
    if (!existing?.length) {
      throw new NotFoundException('Encounter code suggestion not found');
    }

    await tenantDb.query(
      `UPDATE encounter_code_suggestions
       SET accepted_codes = $1, rejected_codes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [JSON.stringify(body.acceptedCodes), JSON.stringify(body.rejectedCodes), actorId, suggestionId],
    );

    if (this.mlFeedbackService) {
      try {
        await this.mlFeedbackService.recordCodingFeedback(tenantDb, suggestionId);
      } catch (e) { this.logger.warn(`ML coding feedback failed: ${e.message}`); }
    }

    return { id: suggestionId, acceptedCodes: body.acceptedCodes, rejectedCodes: body.rejectedCodes };
  }

  async getSuggestionsForSession(
    tenantDb: DataSource,
    sessionId: string,
  ): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM encounter_code_suggestions WHERE session_id = $1 ORDER BY created_at DESC`,
      [sessionId],
    );
  }

  async getSuggestionsForAppointment(
    tenantDb: DataSource,
    appointmentId: string,
  ): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM encounter_code_suggestions WHERE appointment_id = $1 ORDER BY created_at DESC`,
      [appointmentId],
    );
  }

  private async gatherClinicalText(
    tenantDb: DataSource,
    sessionId: string | null,
    appointmentId: string | null,
  ): Promise<string> {
    const parts: string[] = [];

    if (sessionId) {
      const [soapRows, summaryRows, transcriptRows] = await Promise.all([
        tenantDb.query(
          `SELECT content FROM post_visit_draft_artifacts WHERE session_id = $1 AND artifact_type = 'soap_note' LIMIT 1`,
          [sessionId],
        ),
        tenantDb.query(
          `SELECT content FROM post_visit_draft_artifacts WHERE session_id = $1 AND artifact_type = 'visit_summary' LIMIT 1`,
          [sessionId],
        ),
        tenantDb.query(
          `SELECT segment_text FROM post_visit_transcript_segments WHERE session_id = $1 ORDER BY start_second ASC LIMIT 200`,
          [sessionId],
        ),
      ]);

      if (soapRows?.length) {
        const soap = typeof soapRows[0].content === 'string' ? JSON.parse(soapRows[0].content) : soapRows[0].content;
        if (soap?.subjective) parts.push(`Subjective: ${soap.subjective}`);
        if (soap?.objective) parts.push(`Objective: ${soap.objective}`);
        if (soap?.assessment) parts.push(`Assessment: ${soap.assessment}`);
        if (soap?.plan) parts.push(`Plan: ${soap.plan}`);
      }

      if (summaryRows?.length) {
        const summary = typeof summaryRows[0].content === 'string' ? JSON.parse(summaryRows[0].content) : summaryRows[0].content;
        if (summary?.summaryText) parts.push(`Visit Summary: ${summary.summaryText}`);
      }

      if (transcriptRows?.length) {
        parts.push(`Transcript: ${transcriptRows.map((r: any) => r.segment_text).join(' ').substring(0, 3000)}`);
      }
    }

    if (appointmentId) {
      const noteRows = await tenantDb.query(
        `SELECT chief_complaint, clinical_notes, diagnosis, assessment, plan FROM appointments WHERE id = $1 LIMIT 1`,
        [appointmentId],
      );
      if (noteRows?.length) {
        const n = noteRows[0];
        if (n.chief_complaint) parts.push(`Chief Complaint: ${n.chief_complaint}`);
        if (n.clinical_notes) parts.push(`Clinical Notes: ${n.clinical_notes}`);
        if (n.diagnosis) parts.push(`Diagnosis: ${n.diagnosis}`);
        if (n.assessment) parts.push(`Assessment: ${n.assessment}`);
        if (n.plan) parts.push(`Plan: ${n.plan}`);
      }
    }

    return parts.join('\n\n');
  }

  private async extractDiagnosesAndProcedures(clinicalText: string, tenantId?: string): Promise<{
    diagnoses: string[];
    procedures: string[];
    context: ClinicalContext;
  }> {
    if (!clinicalText.trim()) {
      return { diagnoses: [], procedures: [], context: this.emptyContext() };
    }

    try {
      const llmResult = await (this.llmService as any).requestJsonCompletion?.(
        [
          {
            role: 'system',
            content: `You are a medical coding assistant. Extract diagnoses and procedures from the clinical encounter text.
Return JSON: { "diagnoses": ["string"], "procedures": ["string"], "problems_addressed": number, "data_reviewed": ["labs","imaging","external_records"], "risk_level": "low"|"moderate"|"high", "counseling_dominant": boolean, "total_time_minutes": number|null }
If unsure, return empty arrays. Do NOT fabricate diagnoses.`,
          },
          { role: 'user', content: clinicalText.substring(0, 4000) },
        ],
        0.1,
        {
          useCase: 'clinical_code_extraction',
          templateVersion: 'encounter-coding-extract-v1',
          tenantId,
        },
      );

      if (llmResult?.json) {
        return {
          diagnoses: Array.isArray(llmResult.json.diagnoses) ? llmResult.json.diagnoses : [],
          procedures: Array.isArray(llmResult.json.procedures) ? llmResult.json.procedures : [],
          context: {
            problemsAddressed: llmResult.json.problems_addressed || 1,
            dataReviewed: Array.isArray(llmResult.json.data_reviewed) ? llmResult.json.data_reviewed : [],
            riskLevel: llmResult.json.risk_level || 'low',
            counselingDominant: Boolean(llmResult.json.counseling_dominant),
            totalTimeMinutes: llmResult.json.total_time_minutes || null,
          },
        };
      }
    } catch (err) {
      this.logger.warn('LLM extraction failed, falling back to keyword extraction');
    }

    return this.keywordFallback(clinicalText);
  }

  private keywordFallback(text: string): {
    diagnoses: string[];
    procedures: string[];
    context: ClinicalContext;
  } {
    const lower = text.toLowerCase();
    const diagnoses: string[] = [];
    const procedures: string[] = [];

    const diagnosisPatterns: [RegExp, string][] = [
      [/\bhypertension\b/, 'Hypertension'],
      [/\bdiabetes\s*(mellitus)?\s*(type\s*[12])?\b/i, 'Diabetes mellitus'],
      [/\basthma\b/, 'Asthma'],
      [/\bcopd\b|chronic obstructive pulmonary/, 'COPD'],
      [/\bpneumonia\b/, 'Pneumonia'],
      [/\bupper respiratory\b|uri\b/, 'Upper respiratory infection'],
      [/\burinary tract infection\b|uti\b/, 'Urinary tract infection'],
      [/\bheadache\b|migraine/, 'Headache'],
      [/\bdepression\b|major depressive/, 'Depression'],
      [/\banxiety\b/, 'Anxiety'],
      [/\bhyperlipidemia\b|hypercholesterol/, 'Hyperlipidemia'],
      [/\bgerd\b|gastroesophageal reflux/, 'GERD'],
      [/\bback pain\b|low back pain/, 'Low back pain'],
      [/\bosteoarthritis\b/, 'Osteoarthritis'],
      [/\bheart failure\b|chf\b/, 'Heart failure'],
      [/\batrial fibrillation\b|afib\b/, 'Atrial fibrillation'],
      [/\banemia\b/, 'Anemia'],
      [/\bhypothyroidism\b/, 'Hypothyroidism'],
    ];

    for (const [pattern, label] of diagnosisPatterns) {
      if (pattern.test(lower)) diagnoses.push(label);
    }

    const procPatterns: [RegExp, string][] = [
      [/\becg\b|electrocardiogram/, 'ECG'],
      [/\bspirometry\b/, 'Spirometry'],
      [/\binjection\b/, 'Injection'],
      [/\bincision\b|drainage/, 'Incision and drainage'],
      [/\bsuture\b|laceration repair/, 'Laceration repair'],
      [/\bskin biopsy\b/, 'Skin biopsy'],
    ];

    for (const [pattern, label] of procPatterns) {
      if (pattern.test(lower)) procedures.push(label);
    }

    return {
      diagnoses,
      procedures,
      context: {
        problemsAddressed: Math.max(1, diagnoses.length),
        dataReviewed: [],
        riskLevel: diagnoses.length > 2 ? 'moderate' : 'low',
        counselingDominant: false,
        totalTimeMinutes: null,
      },
    };
  }

  private async resolveIcd10Codes(
    tenantDb: DataSource,
    diagnoses: string[],
  ): Promise<CodeSuggestion[]> {
    const results: CodeSuggestion[] = [];

    for (const diagnosis of diagnoses.slice(0, 10)) {
      try {
        const codes = await this.icd10Service.searchIcd10Codes(diagnosis, 1, 0, true, tenantDb);
        if (codes?.length) {
          const best = codes[0];
          results.push({
            code: best.code,
            description: best.description,
            confidence: best.rank ? Math.min(1, best.rank / 100) : 0.7,
          });
        } else {
          results.push({ code: '—', description: diagnosis, confidence: 0.3 });
        }
      } catch {
        results.push({ code: '—', description: diagnosis, confidence: 0.2 });
      }
    }

    return results;
  }

  private deriveCptCodes(procedures: string[], ctx: ClinicalContext): CodeSuggestion[] {
    const cptMap: Record<string, { code: string; description: string }> = {
      'ECG': { code: '93000', description: 'Electrocardiogram, routine, 12-lead' },
      'Spirometry': { code: '94010', description: 'Spirometry with bronchodilator response' },
      'Injection': { code: '96372', description: 'Therapeutic injection, subcutaneous or intramuscular' },
      'Incision and drainage': { code: '10060', description: 'Incision and drainage of abscess, simple' },
      'Laceration repair': { code: '12001', description: 'Simple repair, superficial wounds' },
      'Skin biopsy': { code: '11102', description: 'Tangential biopsy of skin' },
    };

    const results: CodeSuggestion[] = [];

    for (const proc of procedures.slice(0, 5)) {
      const mapped = cptMap[proc];
      if (mapped) {
        results.push({ code: mapped.code, description: mapped.description, confidence: 0.8 });
      } else {
        results.push({ code: '—', description: proc, confidence: 0.3 });
      }
    }

    const emCpt = this.emLevelToCpt(this.calculateEmLevel(ctx).level);
    if (emCpt) {
      results.unshift({ code: emCpt.code, description: emCpt.description, confidence: 0.85 });
    }

    return results;
  }

  private calculateEmLevel(ctx: ClinicalContext): { level: string; rationale: string } {
    const problems = ctx.problemsAddressed;
    const dataPoints = ctx.dataReviewed.length;
    const risk = ctx.riskLevel;

    if (ctx.counselingDominant && ctx.totalTimeMinutes) {
      if (ctx.totalTimeMinutes >= 40) return { level: '99215', rationale: `Time-based: ${ctx.totalTimeMinutes} min, >50% counseling.` };
      if (ctx.totalTimeMinutes >= 30) return { level: '99214', rationale: `Time-based: ${ctx.totalTimeMinutes} min, >50% counseling.` };
      if (ctx.totalTimeMinutes >= 20) return { level: '99213', rationale: `Time-based: ${ctx.totalTimeMinutes} min, >50% counseling.` };
      return { level: '99212', rationale: `Time-based: ${ctx.totalTimeMinutes} min, counseling-dominant.` };
    }

    if (risk === 'high' || problems >= 4) {
      return {
        level: '99215',
        rationale: `${problems} problems addressed, risk=${risk}, ${dataPoints} data categories reviewed. High complexity.`,
      };
    }
    if (risk === 'moderate' || problems >= 2 || dataPoints >= 2) {
      return {
        level: '99214',
        rationale: `${problems} problem(s), risk=${risk}, ${dataPoints} data categories. Moderate complexity.`,
      };
    }
    if (problems >= 1 && dataPoints >= 1) {
      return {
        level: '99213',
        rationale: `${problems} problem(s), risk=${risk}, ${dataPoints} data category. Low complexity.`,
      };
    }
    return {
      level: '99212',
      rationale: `${problems} problem(s), straightforward. Minimal complexity.`,
    };
  }

  private emLevelToCpt(level: string): { code: string; description: string } | null {
    const map: Record<string, { code: string; description: string }> = {
      '99212': { code: '99212', description: 'Office visit, established patient, straightforward MDM' },
      '99213': { code: '99213', description: 'Office visit, established patient, low MDM' },
      '99214': { code: '99214', description: 'Office visit, established patient, moderate MDM' },
      '99215': { code: '99215', description: 'Office visit, established patient, high MDM' },
    };
    return map[level] || null;
  }

  private suggestModifiers(cptSuggestions: CodeSuggestion[], emLevel: string | null): string[] {
    const modifiers: string[] = [];
    const procedureCodes = cptSuggestions.filter(
      (c) => c.code !== '—' && !c.code.startsWith('9921'),
    );

    if (emLevel && procedureCodes.length > 0) {
      modifiers.push('25');
    }

    if (procedureCodes.length > 1) {
      modifiers.push('59');
    }

    return modifiers;
  }

  private computeOverallConfidence(icd10: CodeSuggestion[], cpt: CodeSuggestion[]): number {
    const all = [...icd10, ...cpt];
    if (!all.length) return 0;
    return Math.round((all.reduce((sum, c) => sum + c.confidence, 0) / all.length) * 100) / 100;
  }

  private emptyContext(): ClinicalContext {
    return {
      problemsAddressed: 0,
      dataReviewed: [],
      riskLevel: 'low',
      counselingDominant: false,
      totalTimeMinutes: null,
    };
  }
}

interface ClinicalContext {
  problemsAddressed: number;
  dataReviewed: string[];
  riskLevel: 'low' | 'moderate' | 'high';
  counselingDominant: boolean;
  totalTimeMinutes: number | null;
}
