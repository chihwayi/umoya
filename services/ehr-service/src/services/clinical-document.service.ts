import { Injectable, Logger, Optional } from '@nestjs/common';
import { ClinicalLlmService } from './clinical-llm.service';
import { AbstentionLogService } from './abstention-log.service';

type DocumentType = 'referral_letter' | 'discharge_summary' | 'pre_auth' | 'sick_note' | 'other';

@Injectable()
export class ClinicalDocumentService {
  private readonly logger = new Logger(ClinicalDocumentService.name);

  constructor(
    @Optional() private readonly llm?: ClinicalLlmService,
    @Optional() private readonly abstentionLog?: AbstentionLogService,
  ) {}

  async generateDocument(
    patientId: string,
    documentType: DocumentType,
    generatedBy: string,
    db: any,
    options?: {
      encounterId?: string;
      recipient?: string;
      additionalContext?: string;
    },
  ): Promise<unknown> {
    const [patient, diagnoses, meds, labs, notes, vitals] = await Promise.all([
      db.query(
        `SELECT first_name, last_name, date_of_birth, sex, mrn, phone, address
         FROM patients WHERE id = $1`,
        [patientId],
      ),
      db.query(
        `SELECT icd10_code, description, status FROM patient_diagnoses
         WHERE patient_id = $1 AND status IN ('active','chronic') LIMIT 10`,
        [patientId],
      ),
      db.query(
        `SELECT drug_name, dose, frequency FROM prescriptions
         WHERE patient_id = $1 AND status = 'active' LIMIT 10`,
        [patientId],
      ),
      db.query(
        `SELECT test_name, value, unit, flag, resulted_at FROM lab_results
         WHERE patient_id = $1 AND status = 'resulted'
         ORDER BY resulted_at DESC LIMIT 5`,
        [patientId],
      ),
      db.query(
        `SELECT content, note_type FROM clinical_notes
         WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 3`,
        [patientId],
      ),
      db.query(
        `SELECT systolic_bp, diastolic_bp, heart_rate, temperature, weight, height
         FROM vitals WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
        [patientId],
      ),
    ]);

    const pt = patient[0] ?? {};
    const vit = vitals[0] ?? {};

    let content = this.buildRawDocument(
      documentType, pt, diagnoses, meds, labs, notes, vit, options,
    );
    const title = this.documentTitle(documentType, pt);
    let aiSource = 'rule';

    if (this.llm) {
      const docLabel = documentType.replace(/_/g, ' ');
      const prompt =
        `You are a clinical documentation specialist. Rewrite this ${docLabel} to be ` +
        `professionally worded and clinically precise. Keep all factual data (patient name, ` +
        `DOB, MRN, diagnoses, medications, labs) intact — improve only the clinical language ` +
        `and professional tone. Do not add information that is not present in the original.\n\n` +
        `---\n${content}\n---\n\nReturn the full rewritten document only, no preamble.`;

      try {
        const result = await this.llm.generate(
          prompt,
          { context: 'clinical_document', maxTokens: 800, temperature: 0.2 },
          db,
        );
        if (result && result.text.length > 100) {
          content = result.text;
          aiSource = `llm:${result.backend}`;
        } else {
          await this.abstentionLog?.log(db, 'clinical_document', 'low_confidence', {
            errorDetail: documentType,
          });
        }
      } catch {
        // Raw template already set
      }
    }

    const rows = await db.query(
      `INSERT INTO clinical_documents
         (patient_id, encounter_id, document_type, title, content, generated_by, recipient, ai_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        patientId,
        options?.encounterId ?? null,
        documentType,
        title,
        content,
        generatedBy,
        options?.recipient ?? null,
        aiSource,
      ],
    );
    return rows[0];
  }

  async signDocument(documentId: string, signedBy: string, db: any): Promise<unknown> {
    const rows = await db.query(
      `UPDATE clinical_documents
       SET status = 'signed', signed_by = $2, signed_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [documentId, signedBy],
    );
    return rows[0] ?? null;
  }

  async updateContent(documentId: string, content: string, db: any): Promise<unknown> {
    const rows = await db.query(
      `UPDATE clinical_documents
       SET content = $2, updated_at = now()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [documentId, content],
    );
    return rows[0] ?? null;
  }

  async getDocuments(patientId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT id, document_type, title, status, signed_at, created_at
       FROM clinical_documents
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId],
    );
  }

  async getDocument(documentId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM clinical_documents WHERE id = $1`,
      [documentId],
    );
    return rows[0] ?? null;
  }

  private documentTitle(type: DocumentType, patient: any): string {
    const name = `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim();
    const date = new Date().toLocaleDateString();
    const labels: Record<DocumentType, string> = {
      referral_letter: 'Referral Letter',
      discharge_summary: 'Discharge Summary',
      pre_auth: 'Pre-Authorisation Request',
      sick_note: 'Medical Certificate',
      other: 'Clinical Document',
    };
    return `${labels[type]} — ${name} — ${date}`;
  }

  private buildRawDocument(
    type: DocumentType,
    patient: any,
    diagnoses: any[],
    meds: any[],
    labs: any[],
    _notes: any[],
    _vitals: any,
    options?: any,
  ): string {
    const name = `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim();
    const dob = patient.date_of_birth
      ? new Date(patient.date_of_birth).toLocaleDateString()
      : 'Unknown';
    const date = new Date().toLocaleDateString();

    const header = [
      `Date: ${date}`,
      `Patient: ${name}`,
      `DOB: ${dob}`,
      `MRN: ${patient.mrn ?? 'Unknown'}`,
      options?.recipient ? `To: ${options.recipient}` : '',
      '',
    ].filter(Boolean);

    const dx =
      diagnoses.map((d: any) => `  - ${d.icd10_code}: ${d.description}`).join('\n') ||
      '  - None documented';
    const rxList =
      meds.map((m: any) => `  - ${m.drug_name} ${m.dose} ${m.frequency ?? ''}`.trim()).join('\n') ||
      '  - None';
    const labList =
      labs
        .map(
          (l: any) =>
            `  - ${l.test_name}: ${l.value} ${l.unit ?? ''} ${l.flag ? `[${l.flag}]` : ''}`.trim(),
        )
        .join('\n') || '  - None recent';

    if (type === 'referral_letter') {
      return [
        ...header,
        `RE: REFERRAL — ${name}`,
        '',
        `Dear Colleague,`,
        '',
        `I am referring the above-named patient for further assessment and management.`,
        '',
        `ACTIVE DIAGNOSES:\n${dx}`,
        '',
        `CURRENT MEDICATIONS:\n${rxList}`,
        '',
        `RECENT INVESTIGATIONS:\n${labList}`,
        '',
        `Please review and advise on further management.`,
        '',
        `Yours faithfully,`,
      ].join('\n');
    }

    if (type === 'discharge_summary') {
      return [
        ...header,
        `DISCHARGE SUMMARY`,
        '',
        `REASON FOR ADMISSION: ${options?.additionalContext ?? 'See clinical notes'}`,
        '',
        `DIAGNOSES AT DISCHARGE:\n${dx}`,
        '',
        `MEDICATIONS ON DISCHARGE:\n${rxList}`,
        '',
        `INVESTIGATIONS:\n${labList}`,
        '',
        `FOLLOW-UP: To be arranged by the primary care team within 2 weeks.`,
      ].join('\n');
    }

    if (type === 'pre_auth') {
      return [
        ...header,
        `PRE-AUTHORISATION REQUEST`,
        '',
        `To Whom It May Concern,`,
        '',
        `We are requesting pre-authorisation for the above patient.`,
        '',
        `CLINICAL INDICATION:\n${dx}`,
        '',
        `REQUESTED SERVICE: ${options?.additionalContext ?? 'See attached'}`,
        '',
        `CURRENT MEDICATIONS:\n${rxList}`,
        '',
        `Supporting documentation available on request.`,
      ].join('\n');
    }

    return [...header, `CLINICAL DOCUMENT\n\n${options?.additionalContext ?? ''}`].join('\n');
  }
}
