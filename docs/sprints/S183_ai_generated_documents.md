# S183 — AI-Generated Clinical Documents

**Phase:** 3 — System-Wide AI-First UX  
**Effort:** L  
**Depends on:** S181  
**Goal:** One-click generation of referral letters, discharge summaries, and pre-authorisation requests — pulling from the patient's full record and producing a clinician-ready draft that can be reviewed, edited, and signed in under 2 minutes.

---

## Problem

Referral letters and discharge summaries take 15–30 minutes of manual typing per patient. Clinicians copy-paste from the EHR, miss information, and produce inconsistent documents. This is the largest administrative time sink in the system.

---

## Acceptance Criteria

1. `POST /documents/generate` generates any of: `referral_letter`, `discharge_summary`, `pre_auth`.
2. Document is generated from real patient data: diagnoses, medications, labs, encounter notes.
3. Generated document stored in `clinical_documents` table with `status: draft`.
4. EHR shows a "Generate Documents" button on patient record that opens a type selector.
5. Clinician reviews and edits in a rich text editor before signing.
6. Signing sets `status: signed` and records `signed_by` + `signed_at`.
7. Patient portal: discharge summary appears under "My Documents" when signed.
8. Mobile: "Referral" button in doctor encounter screen triggers generation.
9. Documents support export to PDF (return `pdfUrl` or raw content string).
10. `tsc --noEmit` and lint pass; all tests pass.

---

## 1. Database Provisioning

```typescript
{
  id: 'clinical_documents',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS clinical_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      encounter_id UUID,
      document_type VARCHAR(32) NOT NULL
        CHECK (document_type IN ('referral_letter','discharge_summary','pre_auth','sick_note','other')),
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','signed','revoked')),
      generated_by UUID NOT NULL,
      signed_by UUID,
      signed_at TIMESTAMPTZ,
      recipient VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cd_patient ON clinical_documents(patient_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_cd_type ON clinical_documents(document_type, status)`,
    `CREATE INDEX IF NOT EXISTS idx_cd_signed ON clinical_documents(signed_at DESC) WHERE status = 'signed'`,
  ],
},
```

---

## 2. Backend — ClinicalDocumentService

Create `services/ehr-service/src/services/clinical-document.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';

type DocumentType = 'referral_letter' | 'discharge_summary' | 'pre_auth' | 'sick_note' | 'other';

@Injectable()
export class ClinicalDocumentService {
  private readonly logger = new Logger(ClinicalDocumentService.name);

  constructor(
    @Optional() private readonly llm: PostVisitGroundedLlmService,
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
    // Gather patient data
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

    // Build raw document
    const raw = this.buildRawDocument(
      documentType,
      pt,
      diagnoses,
      meds,
      labs,
      notes,
      vit,
      options,
    );

    // Polish with LLM
    let content = raw;
    if (this.llm) {
      try {
        const polished = await this.llm.draftReferralLetter({
          documentType,
          rawContent: raw,
          patientId,
          recipient: options?.recipient,
          additionalContext: options?.additionalContext,
        });
        content = polished?.content ?? raw;
      } catch (err) {
        this.logger.warn(`LLM document generation failed: ${err.message}`);
      }
    }

    const title = this.documentTitle(documentType, pt);

    const rows = await db.query(
      `INSERT INTO clinical_documents
         (patient_id, encounter_id, document_type, title, content,
          generated_by, recipient)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        patientId,
        options?.encounterId ?? null,
        documentType,
        title,
        content,
        generatedBy,
        options?.recipient ?? null,
      ],
    );
    return rows[0];
  }

  async signDocument(
    documentId: string,
    signedBy: string,
    db: any,
  ): Promise<unknown> {
    const rows = await db.query(
      `UPDATE clinical_documents
       SET status = 'signed', signed_by = $2, signed_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [documentId, signedBy],
    );
    return rows[0] ?? null;
  }

  async updateContent(
    documentId: string,
    content: string,
    db: any,
  ): Promise<unknown> {
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
    const typeLabels: Record<DocumentType, string> = {
      referral_letter: 'Referral Letter',
      discharge_summary: 'Discharge Summary',
      pre_auth: 'Pre-Authorisation Request',
      sick_note: 'Medical Certificate',
      other: 'Clinical Document',
    };
    return `${typeLabels[type]} — ${name} — ${date}`;
  }

  private buildRawDocument(
    type: DocumentType,
    patient: any,
    diagnoses: any[],
    meds: any[],
    labs: any[],
    notes: any[],
    vitals: any,
    options?: any,
  ): string {
    const name = `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim();
    const dob = patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'Unknown';
    const date = new Date().toLocaleDateString();

    const header = [
      `Date: ${date}`,
      `Patient: ${name}`,
      `DOB: ${dob}`,
      `MRN: ${patient.mrn ?? 'Unknown'}`,
      options?.recipient ? `To: ${options.recipient}` : '',
      '',
    ];

    const dx = diagnoses.map((d: any) => `  - ${d.icd10_code}: ${d.description}`).join('\n') || '  - None documented';
    const rxList = meds.map((m: any) => `  - ${m.drug_name} ${m.dose} ${m.frequency}`).join('\n') || '  - None';
    const labList = labs.map((l: any) => `  - ${l.test_name}: ${l.value} ${l.unit ?? ''} ${l.flag ? `[${l.flag}]` : ''}`).join('\n') || '  - None recent';

    if (type === 'referral_letter') {
      return [...header,
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
      return [...header,
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
      return [...header,
        `PRE-AUTHORISATION REQUEST`,
        '',
        `To Whom It May Concern,`,
        '',
        `We are requesting pre-authorisation for the above patient for the following procedure/medication.`,
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
```

---

## 3. Controller

Create `services/ehr-service/src/controllers/clinical-document.controller.ts`:

```typescript
import {
  Controller, Get, Post, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { ClinicalDocumentService } from '../services/clinical-document.service';

@Controller('documents')
export class ClinicalDocumentController {
  constructor(private readonly docService: ClinicalDocumentService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generate(
    @Body() body: {
      patientId: string;
      documentType: string;
      encounterId?: string;
      recipient?: string;
      additionalContext?: string;
    },
    @Req() req: any,
  ): Promise<unknown> {
    return this.docService.generateDocument(
      body.patientId,
      body.documentType as any,
      req.user.sub,
      req.tenantDb,
      { encounterId: body.encounterId, recipient: body.recipient, additionalContext: body.additionalContext },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('patients/:patientId')
  async listDocuments(@Param('patientId') patientId: string, @Req() req: any): Promise<unknown[]> {
    return this.docService.getDocuments(patientId, req.tenantDb);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':documentId')
  async getDocument(@Param('documentId') documentId: string, @Req() req: any): Promise<unknown> {
    return this.docService.getDocument(documentId, req.tenantDb);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':documentId/content')
  async updateContent(
    @Param('documentId') documentId: string,
    @Body() body: { content: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.docService.updateContent(documentId, body.content, req.tenantDb);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':documentId/sign')
  async sign(@Param('documentId') documentId: string, @Req() req: any): Promise<unknown> {
    return this.docService.signDocument(documentId, req.user.sub, req.tenantDb);
  }

  // Patient portal — view signed documents
  @UseGuards(PatientJwtAuthGuard)
  @Get('patient/my-documents')
  async myDocuments(@Req() req: any): Promise<unknown[]> {
    const rows = await req.tenantDb.query(
      `SELECT id, document_type, title, created_at, signed_at
       FROM clinical_documents
       WHERE patient_id = $1 AND status = 'signed'
       ORDER BY signed_at DESC`,
      [req.patientId],
    );
    return rows;
  }

  @UseGuards(PatientJwtAuthGuard)
  @Get('patient/:documentId')
  async getPatientDocument(
    @Param('documentId') documentId: string,
    @Req() req: any,
  ): Promise<unknown> {
    const rows = await req.tenantDb.query(
      `SELECT id, document_type, title, content, signed_at
       FROM clinical_documents
       WHERE id = $1 AND patient_id = $2 AND status = 'signed'`,
      [documentId, req.patientId],
    );
    return rows[0] ?? null;
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { ClinicalDocumentService } from './services/clinical-document.service';
import { ClinicalDocumentController } from './controllers/clinical-document.controller';

controllers: [ /* ...existing... */ ClinicalDocumentController ],
providers: [ /* ...existing... */ ClinicalDocumentService ],
```

---

## 5. EHR Frontend — Document Generator Modal

Create `ehr-frontend/src/components/DocumentGeneratorModal.tsx`:

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';

interface Props { patientId: string; onClose: () => void; }

const DOC_TYPES = [
  { value: 'referral_letter', label: 'Referral Letter' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'pre_auth', label: 'Pre-Authorisation Request' },
  { value: 'sick_note', label: 'Medical Certificate' },
];

export const DocumentGeneratorModal: React.FC<Props> = ({ patientId, onClose }) => {
  const [docType, setDocType] = useState('referral_letter');
  const [recipient, setRecipient] = useState('');
  const [context, setContext] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/documents/generate', {
        patientId, documentType: docType, recipient, additionalContext: context,
      });
      setGeneratedDoc(res.data);
      setContent(res.data.content);
    } finally {
      setLoading(false);
    }
  };

  const sign = async () => {
    await api.post(`/documents/${generatedDoc.id}/sign`);
    setSigned(true);
  };

  const saveEdit = async () => {
    await api.patch(`/documents/${generatedDoc.id}/content`, { content });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, width: 700, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Generate AI Document</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        {!generatedDoc ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Recipient (optional)</label>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. Dr. Smith, Cardiology"
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Additional Context</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                placeholder="Reason for referral, reason for admission, etc."
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
              />
            </div>
            <button
              onClick={generate}
              disabled={loading}
              style={{
                width: '100%', padding: '10px', backgroundColor: '#7c3aed', color: 'white',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600,
              }}
            >
              {loading ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
        ) : signed ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#16a34a' }}>Document Signed!</div>
            <button onClick={onClose} style={{ marginTop: 20, padding: '8px 24px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Close</button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Review and edit the generated document, then sign.
            </p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #d1d5db', fontFamily: 'monospace', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={saveEdit}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', backgroundColor: 'white' }}
              >
                Save Edits
              </button>
              <button
                onClick={sign}
                style={{ padding: '8px 24px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
              >
                Sign Document
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## 6. Mobile — Referral Button

In `mobile/src/screens/EncounterScreen.tsx`:

```tsx
const [showDocGen, setShowDocGen] = useState(false);

<TouchableOpacity
  onPress={() => setShowDocGen(true)}
  style={{
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    padding: SPACING.sm, backgroundColor: C.blue + '10',
    borderRadius: RADIUS.md, marginBottom: SPACING.sm,
  }}
>
  <Text style={{ fontFamily: FONT.uiBd, fontSize: 13, color: C.blue }}>
    {t('documents.generate_referral')}
  </Text>
</TouchableOpacity>

{showDocGen && (
  // Mobile sheet that calls POST /documents/generate
  // and shows a simple review before signing
  <View style={{ /* bottom sheet styles */ }}>
    {/* minimal implementation — submit to /documents/generate and show result */}
  </View>
)}
```

---

## 7. i18n Keys — All 8 Locales

### `en.json`:
```json
"documents": {
  "generate": "Generate Document",
  "generate_referral": "Generate Referral",
  "referral_letter": "Referral Letter",
  "discharge_summary": "Discharge Summary",
  "pre_auth": "Pre-Authorisation",
  "sick_note": "Medical Certificate",
  "sign": "Sign Document",
  "signed": "Signed",
  "draft": "Draft",
  "my_documents": "My Documents",
  "generating": "Generating with AI..."
}
```

### `sn.json`:
```json
"documents": {
  "generate": "Gadzira Chinyorwa",
  "generate_referral": "Gadzira Tsamba yeKutumira",
  "referral_letter": "Tsamba yeKutumira",
  "discharge_summary": "Pfupiso yekubuda",
  "pre_auth": "Kubvumidzwa Kusati Kwaitwa",
  "sick_note": "Chirevo chekurwara",
  "sign": "Sainha Chinyorwa",
  "signed": "Yasainwa",
  "draft": "Dhrafiti",
  "my_documents": "Zvinyorwa zvangu",
  "generating": "Kugadzirwa neAI..."
}
```

### `nd.json`:
```json
"documents": {
  "generate": "Yakhela Isiqephu",
  "generate_referral": "Yakhela Incwadi Yokudlulisela",
  "referral_letter": "Incwadi Yokudlulisela",
  "discharge_summary": "Isifinyezo Sokuphuma",
  "pre_auth": "Imvume Yangaphambili",
  "sick_note": "Isitifiketi Sezokwelapha",
  "sign": "Sayina Isiqephu",
  "signed": "Isayinwe",
  "draft": "Umdwebo",
  "my_documents": "Amadokhumenti Ami",
  "generating": "Ikhiqizwa yi-AI..."
}
```

### `pt.json`:
```json
"documents": {
  "generate": "Gerar Documento",
  "generate_referral": "Gerar Referenciação",
  "referral_letter": "Carta de Referenciação",
  "discharge_summary": "Resumo de Alta",
  "pre_auth": "Pré-Autorização",
  "sick_note": "Atestado Médico",
  "sign": "Assinar Documento",
  "signed": "Assinado",
  "draft": "Rascunho",
  "my_documents": "Os Meus Documentos",
  "generating": "A gerar com IA..."
}
```

### `fr.json`:
```json
"documents": {
  "generate": "Générer Document",
  "generate_referral": "Générer Orientation",
  "referral_letter": "Lettre d'Orientation",
  "discharge_summary": "Résumé de Sortie",
  "pre_auth": "Pré-Autorisation",
  "sick_note": "Certificat Médical",
  "sign": "Signer le Document",
  "signed": "Signé",
  "draft": "Brouillon",
  "my_documents": "Mes Documents",
  "generating": "Génération avec IA..."
}
```

### `sw.json`:
```json
"documents": {
  "generate": "Tengeneza Hati",
  "generate_referral": "Tengeneza Barua ya Rufaa",
  "referral_letter": "Barua ya Rufaa",
  "discharge_summary": "Muhtasari wa Kutolewa",
  "pre_auth": "Idhini ya Awali",
  "sick_note": "Cheti cha Matibabu",
  "sign": "Tia Saini Hati",
  "signed": "Imesainiwa",
  "draft": "Rasimu",
  "my_documents": "Hati Zangu",
  "generating": "Inatengenezwa na AI..."
}
```

### `zu.json`:
```json
"documents": {
  "generate": "Khiqiza Idokhumenti",
  "generate_referral": "Khiqiza Incwadi Yokudlulisela",
  "referral_letter": "Incwadi Yokudlulisela",
  "discharge_summary": "Isifinyezo Sokukhishwa",
  "pre_auth": "Imvume Yangaphambili",
  "sick_note": "Isitifiketi Sezokwelapha",
  "sign": "Sayina Idokhumenti",
  "signed": "Isayiniwe",
  "draft": "Umdwebo",
  "my_documents": "Amadokhumenti Ami",
  "generating": "Ikhiqizwa yi-AI..."
}
```

### `af.json`:
```json
"documents": {
  "generate": "Genereer Dokument",
  "generate_referral": "Genereer Verwysing",
  "referral_letter": "Verwysingbrief",
  "discharge_summary": "Ontslagopsomming",
  "pre_auth": "Vooraf-Magtiging",
  "sick_note": "Mediese Sertifikaat",
  "sign": "Teken Dokument",
  "signed": "Geteken",
  "draft": "Konsep",
  "my_documents": "My Dokumente",
  "generating": "Genereer met KI..."
}
```

---

## 8. Jest Spec

Create `services/ehr-service/src/services/clinical-document.service.spec.ts`:

```typescript
import { ClinicalDocumentService } from './clinical-document.service';

function makeService(llm?: any) {
  return new ClinicalDocumentService(llm ?? null);
}

function makeDb(patientRow?: any) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients')) return Promise.resolve(patientRow ? [patientRow] : [{ first_name: 'John', last_name: 'Doe', mrn: 'MRN001', sex: 'M' }]);
      if (sql.includes('patient_diagnoses')) return Promise.resolve([{ icd10_code: 'I10', description: 'Hypertension', status: 'chronic' }]);
      if (sql.includes('FROM prescriptions')) return Promise.resolve([{ drug_name: 'Amlodipine', dose: '5mg', frequency: 'once daily' }]);
      if (sql.includes('FROM lab_results')) return Promise.resolve([]);
      if (sql.includes('clinical_notes')) return Promise.resolve([]);
      if (sql.includes('FROM vitals')) return Promise.resolve([]);
      if (sql.includes('INSERT INTO clinical_documents')) return Promise.resolve([{ id: 'doc-1', content: 'REFERRAL...', status: 'draft' }]);
      if (sql.includes('UPDATE clinical_documents')) return Promise.resolve([{ id: 'doc-1', status: 'signed', signed_at: new Date() }]);
      return Promise.resolve([]);
    }),
  };
}

describe('ClinicalDocumentService', () => {
  it('generates referral letter from raw data', async () => {
    const svc = makeService();
    const db = makeDb();
    const result: any = await svc.generateDocument('p1', 'referral_letter', 'doc1', db, { recipient: 'Dr. Smith' });
    expect(result).toMatchObject({ id: 'doc-1', status: 'draft' });
  });

  it('uses LLM when available', async () => {
    const llm = { draftReferralLetter: jest.fn().mockResolvedValue({ content: 'Dear Dr Smith, Please see...' }) };
    const svc = makeService(llm);
    const db = makeDb();
    await svc.generateDocument('p1', 'referral_letter', 'doc1', db);
    expect(llm.draftReferralLetter).toHaveBeenCalled();
  });

  it('signDocument updates status', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ id: 'doc-1', status: 'signed' }]) };
    const result: any = await svc.signDocument('doc-1', 'doc1', db);
    expect(result.status).toBe('signed');
  });

  it('getDocument returns null for unknown id', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getDocument('unknown', db);
    expect(result).toBeNull();
  });
});
```

---

## 9. Definition of Done

- [ ] `clinical_documents` table provisioned; repair passes
- [ ] `ClinicalDocumentService` and `ClinicalDocumentController` in `ehr.module.ts`
- [ ] `POST /documents/generate` returns draft document
- [ ] `PATCH /documents/:id/content` saves edits
- [ ] `POST /documents/:id/sign` sets status to `signed`
- [ ] `GET /documents/patient/my-documents` returns signed documents (patient portal)
- [ ] `DocumentGeneratorModal` component exists and renders in EHR
- [ ] Mobile has referral generation trigger button in encounter screen
- [ ] `tsc --noEmit` passes
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
