# S188 — Clinical NLP & True CDSS: Entity Extraction and Decision Support

**Phase:** 4 — True AI-First Foundation  
**Effort:** L (5–6 days)  
**Depends on:** S186 (ClinicalLlmService), S187 (AI wiring)  
**Blocks:** nothing — this is the final sprint achieving 100% AI-first

---

## Problem

Three categories of intelligence still run on pattern matching and static lookup tables rather than genuine language understanding:

1. **Drug substitution** identifies candidates by exact drug name match against a hard-coded map. It cannot reason about pharmacological class, contraindications, patient history, or formulary availability.
2. **Care gap detection** uses `RegExp` and age/sex rules. It cannot extract diagnoses from free-text notes, identify undocumented conditions, or reason about missed guideline steps.
3. **CDSS** (`CdssService`) has a `parseClinicalNarrative()` signature referenced by multiple sprint docs but never implemented. The service calls an external CDSS endpoint or falls back silently with no NLP processing.

Without NLP entity extraction feeding these systems, AI-first is limited to structured data. Unstructured notes — the majority of clinical documentation — are invisible.

---

## Goal

1. Build `ClinicalNlpService`: an LLM-backed entity extractor that turns free-text clinical notes into structured JSON (diagnoses, medications, allergies, symptoms, procedures)
2. Wire `ClinicalNlpService` into `DrugSubstitutionService`, `CareGapEngineService`, and `CdssService.parseClinicalNarrative()`
3. Build `CdssNlpController` exposing a `/cdss/parse-narrative` endpoint so the EHR encounter view can extract structured data from a clinician's typed note in real time
4. Add a mobile `NarrativeExtractorSheet` for voice-captured note review
5. Every entity extraction call is audited in the `clinical_nlp_extractions` table

---

## Database Provisioning

Add to `getProvisioningBundles()` in  
`services/tenant-service/src/services/database-provisioning.service.ts`:

```typescript
{
  id: 'clinical_nlp_extractions',
  label: 'Sprint 188 — Clinical NLP Extraction Audit',
  version: '2026.05.28.3',
  description: 'Audit log for every ClinicalNlpService entity extraction call',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS clinical_nlp_extractions (
      id            BIGSERIAL   PRIMARY KEY,
      patient_id    INTEGER,
      encounter_id  INTEGER,
      context       TEXT        NOT NULL,
      input_hash    TEXT        NOT NULL,
      entities      JSONB       NOT NULL DEFAULT '{}',
      backend       TEXT        NOT NULL,
      model         TEXT        NOT NULL,
      latency_ms    INTEGER,
      success       BOOLEAN     NOT NULL DEFAULT TRUE,
      error_msg     TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nlp_patient
       ON clinical_nlp_extractions(patient_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_nlp_context
       ON clinical_nlp_extractions(context, created_at DESC)`,
  ],
},
```

---

## Backend — ClinicalNlpService

**File:** `services/ehr-service/src/services/clinical-nlp.service.ts`

```typescript
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
    @Optional() private readonly llm: ClinicalLlmService,
    @Optional() private readonly abstentionLog: AbstentionLogService,
  ) {}

  async extractEntities(
    text: string,
    opts: {
      context: string;
      patientId?: number;
      encounterId?: number;
    },
    db?: any,
  ): Promise<ClinicalEntities> {
    if (!text || text.trim().length < 5) return { ...EMPTY_ENTITIES };
    if (!this.llm) {
      return this.ruleBasedFallback(text);
    }

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
    const result = await this.llm.generate(prompt, {
      context: opts.context,
      maxTokens: 600,
      temperature: 0.1,
    }, db);

    const latencyMs = Date.now() - start;

    if (!result) {
      await this.abstentionLog?.log(
        db, `clinical_nlp:${opts.context}`, 'timeout',
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
        db, `clinical_nlp:${opts.context}`, 'low_confidence',
        opts.patientId ? { patientId: String(opts.patientId), errorDetail: 'json_parse_failed' } : undefined,
      );
      if (db) {
        await this.audit(db, opts, inputHash, EMPTY_ENTITIES, result.backend, result.model, latencyMs, false, 'json_parse_failed');
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
      if (lower.includes(dx)) {
        diagnoses.push({ text: dx, confidence: 0.6 });
      }
    }

    const ALLERGY_PATTERN = /allerg(?:ic|y) to ([a-zA-Z\s]+?)(?:\.|,|;|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = ALLERGY_PATTERN.exec(text)) !== null) {
      allergies.push({ substance: m[1].trim(), confidence: 0.7 });
    }

    const SYMPTOM_WORDS = ['pain', 'cough', 'fever', 'fatigue', 'dyspnoea', 'nausea', 'vomiting', 'diarrhoea'];
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
           (patient_id, encounter_id, context, input_hash, entities, backend, model, latency_ms, success, error_msg)
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
```

---

## CdssService — parseClinicalNarrative Bridge

Update `services/ehr-service/src/services/cdss.service.ts` to delegate `parseClinicalNarrative` to `ClinicalNlpService`:

```typescript
import { ClinicalNlpService } from './clinical-nlp.service';

// In constructor (add @Optional()):
constructor(
  // ... existing deps ...
  @Optional() private readonly clinicalNlp: ClinicalNlpService,
) {}

// Implement parseClinicalNarrative():
async parseClinicalNarrative(
  text: string,
  db?: any,
  opts?: { patientId?: number; encounterId?: number },
): Promise<Partial<import('./clinical-nlp.service').ClinicalEntities>> {
  if (this.clinicalNlp) {
    return this.clinicalNlp.extractEntities(text, {
      context: 'cdss_narrative',
      patientId: opts?.patientId,
      encounterId: opts?.encounterId,
    }, db);
  }
  return {};
}
```

---

## CareGapEngineService — NLP enrichment

Wire `ClinicalNlpService` into `detectGaps()` to extract diagnoses from recent clinical notes **before** running gap rules:

```typescript
import { ClinicalNlpService } from './clinical-nlp.service';

// In constructor:
constructor(
  @Optional() private readonly llm: ClinicalLlmService,
  @Optional() private readonly abstentionLog: AbstentionLogService,
  @Optional() private readonly nlp: ClinicalNlpService,
) {}

// At the start of detectGaps(), after fetching structured data:
// Also fetch recent clinical notes
const recentNotes = await db.query(
  `SELECT content FROM clinical_notes
    WHERE patient_id = $1 AND note_type IN ('soap','progress','discharge')
    ORDER BY created_at DESC LIMIT 3`,
  [patientId],
);

if (this.nlp && recentNotes.length > 0) {
  const noteText = recentNotes.map((n: any) => n.content).join('\n---\n');
  const extracted = await this.nlp.extractEntities(noteText, {
    context: 'care_gap_nlp',
    patientId: Number(patientId),
  }, db);
  // Merge NLP-extracted diagnoses into the structured diagnoses array
  for (const d of extracted.diagnoses) {
    if (!diagnoses.find((x: any) => x.description?.toLowerCase() === d.text.toLowerCase())) {
      diagnoses.push({ icd10_code: d.icd10Hint ?? '', description: d.text, status: 'active', nlpExtracted: true });
    }
  }
}
```

---

## DrugSubstitutionService — NLP allergy/context extraction

Wire `ClinicalNlpService` to extract allergies and active symptoms from recent notes for contraindication checking:

```typescript
import { ClinicalNlpService } from './clinical-nlp.service';

// In constructor:
constructor(
  @Optional() private readonly abstentionLog: AbstentionLogService,
  @Optional() private readonly llm: ClinicalLlmService,
  @Optional() private readonly nlp: ClinicalNlpService,
) {}

// In getSuggestions(), before ruleBasedFallback():
if (this.nlp && db && params.patientId) {
  const notes = await db.query(
    `SELECT content FROM clinical_notes
      WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 2`,
    [params.patientId],
  );
  if (notes.length > 0) {
    const noteText = notes.map((n: any) => n.content).join('\n');
    const extracted = await this.nlp.extractEntities(noteText, {
      context: 'drug_sub_nlp', patientId: params.patientId,
    }, db);
    // Merge NLP allergies into params.allergies
    if (!params.allergies) params.allergies = [];
    for (const a of extracted.allergies) {
      if (!params.allergies.includes(a.substance)) {
        params.allergies.push(a.substance);
      }
    }
  }
}
```

---

## Backend — CdssNlpController

**File:** `services/ehr-service/src/controllers/cdss-nlp.controller.ts`

```typescript
import {
  Controller, Post, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicalNlpService } from '../services/clinical-nlp.service';

@UseGuards(JwtAuthGuard)
@Controller('cdss/nlp')
export class CdssNlpController {
  constructor(private readonly nlp: ClinicalNlpService) {}

  @Post('extract')
  async extract(
    @Req() req: any,
    @Body() body: {
      text: string;
      patientId?: number;
      encounterId?: number;
      context?: string;
    },
  ) {
    return this.nlp.extractEntities(
      body.text,
      {
        context: body.context ?? 'ehr_realtime',
        patientId: body.patientId,
        encounterId: body.encounterId,
      },
      req.tenantDb,
    );
  }
}
```

---

## EHR Component — NarrativeExtractorPanel

**File:** `ehr-frontend/src/components/NarrativeExtractorPanel.tsx`

Renders extracted entities inline below the note textarea. Clinician can type a SOAP note and see live entity extraction.

```tsx
import React, { useState, useRef } from 'react';
import api from '../services/api';
import AiStatusBadge from './AiStatusBadge';
import AiSourceTag from './AiSourceTag';
import type { ClinicalEntities } from '../types/clinical';

interface Props {
  patientId: number;
  encounterId?: number;
  onEntitiesExtracted?: (entities: ClinicalEntities) => void;
}

export default function NarrativeExtractorPanel({
  patientId, encounterId, onEntitiesExtracted,
}: Props) {
  const [text, setText] = useState('');
  const [entities, setEntities] = useState<ClinicalEntities | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 20) { setEntities(null); return; }
    debounceRef.current = setTimeout(() => extractEntities(val), 800);
  }

  async function extractEntities(noteText: string) {
    setLoading(true);
    try {
      const result = await api.post('/cdss/nlp/extract', {
        text: noteText, patientId, encounterId, context: 'ehr_realtime',
      });
      setEntities(result);
      onEntitiesExtracted?.(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <label style={{ fontWeight: 700, fontSize: 14 }}>Clinical Note</label>
        {entities && <AiSourceTag aiSource={entities.aiSource} />}
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        rows={6}
        placeholder="Type or dictate the clinical note…"
        style={{
          width: '100%', border: '1px solid #d1d5db', borderRadius: 8,
          padding: '10px 12px', fontSize: 14, resize: 'vertical',
          fontFamily: 'monospace',
        }}
      />
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <AiStatusBadge status="loading" />
          <span style={{ fontSize: 12, color: '#6b7280' }}>Extracting entities…</span>
        </div>
      )}
      {entities && !loading && (
        <div style={{
          marginTop: 8, padding: 12, background: '#f0f9ff',
          border: '1px solid #bae6fd', borderRadius: 8,
        }}>
          <EntitySection title="Diagnoses" items={entities.diagnoses.map(d => `${d.text}${d.icd10Hint ? ` (${d.icd10Hint})` : ''}`)} color="#1d4ed8" />
          <EntitySection title="Medications" items={entities.medications.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}`)} color="#0369a1" />
          <EntitySection title="Allergies" items={entities.allergies.map(a => `${a.substance}${a.reaction ? ` → ${a.reaction}` : ''}`)} color="#dc2626" />
          <EntitySection title="Symptoms" items={entities.symptoms.map(s => s.text)} color="#7c3aed" />
          <EntitySection title="Procedures" items={entities.procedures.map(p => p.text)} color="#065f46" />
        </div>
      )}
    </div>
  );
}

function EntitySection({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color, marginRight: 6 }}>{title}:</span>
      <span style={{ fontSize: 13 }}>{items.join(' · ')}</span>
    </div>
  );
}
```

---

## Mobile Component — NarrativeExtractorSheet

**File:** `mobile/src/components/NarrativeExtractorSheet.tsx`

```tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { AiStatusChip } from '../components/AiStatusChip';
import AiSourcePill from '../components/AiSourcePill';
import api from '../services/api';

interface ClinicalEntities {
  diagnoses: Array<{ text: string; icd10Hint?: string }>;
  medications: Array<{ name: string; dose?: string }>;
  allergies: Array<{ substance: string; reaction?: string }>;
  symptoms: Array<{ text: string }>;
  procedures: Array<{ text: string }>;
  aiSource: string;
}

interface Props {
  patientId: number;
  encounterId?: number;
  initialText?: string;
  onExtracted?: (entities: ClinicalEntities) => void;
}

export default function NarrativeExtractorSheet({
  patientId, encounterId, initialText = '', onExtracted,
}: Props) {
  const [text, setText] = useState(initialText);
  const [entities, setEntities] = useState<ClinicalEntities | null>(null);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(val: string) {
    setText(val);
    clearTimeout(debounce.current);
    if (val.trim().length < 20) { setEntities(null); return; }
    debounce.current = setTimeout(() => extractEntities(val), 900);
  }

  async function extractEntities(noteText: string) {
    setLoading(true);
    try {
      const result = await api.post('/cdss/nlp/extract', {
        text: noteText, patientId, encounterId, context: 'mobile_note',
      });
      setEntities(result);
      onExtracted?.(result);
    } catch { /* fail silently */ } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Clinical Note</Text>
        {entities && <AiSourcePill aiSource={entities.aiSource} />}
      </View>

      <TextInput
        value={text}
        onChangeText={handleChange}
        multiline
        numberOfLines={6}
        placeholder="Type or dictate clinical note…"
        style={styles.input}
        placeholderTextColor={C.textMuted}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={C.blue} />
          <AiStatusChip status="loading" />
          <Text style={styles.loadingText}>Extracting entities…</Text>
        </View>
      )}

      {entities && !loading && (
        <ScrollView style={styles.entitiesBox}>
          <EntityRow label="Diagnoses" items={entities.diagnoses.map(d => d.text)} color={C.blue} />
          <EntityRow label="Medications" items={entities.medications.map(m => m.name)} color={C.teal} />
          <EntityRow label="Allergies" items={entities.allergies.map(a => a.substance)} color={C.red} />
          <EntityRow label="Symptoms" items={entities.symptoms.map(s => s.text)} color={C.amber} />
          <EntityRow label="Procedures" items={entities.procedures.map(p => p.text)} color={C.green} />
        </ScrollView>
      )}
    </View>
  );
}

function EntityRow({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontFamily: FONT.uiBd, fontSize: 11, color, marginBottom: 2 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: FONT.ui, fontSize: 13, color: C.text }}>
        {items.join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.card,
    padding: 16,
    ...SHADOW.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heading: {
    fontFamily: FONT.uiBd,
    fontSize: 15,
    color: C.text,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.sm,
    padding: 10,
    fontFamily: FONT.mono,
    fontSize: 13,
    color: C.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  loadingText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: C.textSecondary,
  },
  entitiesBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: C.surface2,
    borderRadius: RADIUS.sm,
    maxHeight: 200,
  },
});
```

---

## i18n Keys

Add `clinical_nlp` block BEFORE `ai_source` block in all 8 locale files:

**en.json:**
```json
"clinical_nlp": {
  "title": "AI Entity Extraction",
  "extracting": "Extracting clinical entities…",
  "diagnoses": "Diagnoses",
  "medications": "Medications",
  "allergies": "Allergies",
  "symptoms": "Symptoms",
  "procedures": "Procedures",
  "no_entities": "No entities detected",
  "review_notice": "AI-extracted entities require clinician review before use"
}
```

| Key | sn | nd | pt | fr | sw | zu | af |
|-----|----|----|----|----|----|----|-----|
| title | AI Kubvisa Zvinhu | AI Ukukhipha Izinto | Extração de Entidades IA | Extraction d'Entités IA | Utambuzi wa Vipengele vya AI | Ukukhipha Izinto ze-AI | KI Entiteitsekstraksie |
| extracting | Kubvisa zvinhu zvekiriniki… | Ikhipha izinto zezobuchwepheshe… | Extraindo entidades clínicas… | Extraction des entités cliniques… | Inatoa vipengele vya kliniki… | Ikhipha izinto zezobuchwepheshe… | Onttrek kliniese entiteite… |
| diagnoses | Zvirwere | Izifo | Diagnósticos | Diagnostics | Magonjwa | Izigameko Zezifo | Diagnoses |
| medications | Mishonga | Imithi | Medicamentos | Médicaments | Dawa | Imithi | Medikasie |
| allergies | Allergy | Ama-allergy | Alergias | Allergies | Mzio | Ama-allergy | Allergieë |
| review_notice | Simbisa zvinhu zvakatanhwa ne-AI usati washandisa | Hlola izinto ezikhishwe yi-AI ngaphambi kokuzisebenzisa | Entidades AI requerem revisão antes de usar | Entités IA nécessitent une vérification avant utilisation | Vipengele vya AI vinahitaji ukaguzi kabla ya kutumia | Izinto ze-AI zidinga ukuhlolwa ngaphambi kokusetshenziswa | KI-entiteite vereis hersiening voor gebruik |

---

## Module Registration

**File:** `services/ehr-service/src/ehr.module.ts`

```typescript
import { ClinicalNlpService } from './services/clinical-nlp.service';
import { CdssNlpController } from './controllers/cdss-nlp.controller';

// In @Module:
providers: [...existingProviders, ClinicalNlpService],
controllers: [...existingControllers, CdssNlpController],
```

---

## Jest Spec

**File:** `services/ehr-service/src/services/clinical-nlp.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { ClinicalNlpService } from './clinical-nlp.service';
import { ClinicalLlmService } from './clinical-llm.service';

describe('ClinicalNlpService', () => {
  let svc: ClinicalNlpService;
  let db: any;
  let llmMock: jest.Mocked<Partial<ClinicalLlmService>>;

  const LLM_JSON = JSON.stringify({
    diagnoses: [{ text: 'Hypertension', icd10Hint: 'I10', confidence: 0.95 }],
    medications: [{ name: 'Amlodipine', dose: '10mg', frequency: 'OD', confidence: 0.9 }],
    allergies: [{ substance: 'Penicillin', reaction: 'Rash', confidence: 0.88 }],
    symptoms: [{ text: 'headache', duration: '3 days', severity: 'moderate', confidence: 0.8 }],
    procedures: [],
  });

  beforeEach(() => {
    db = { query: jest.fn().mockResolvedValue([]) };
  });

  it('extracts entities from LLM JSON response', async () => {
    llmMock = {
      generate: jest.fn().mockResolvedValue({
        text: LLM_JSON, backend: 'ollama', model: 'llama3', latencyMs: 300,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalNlpService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalNlpService);

    const result = await svc.extractEntities(
      'Patient has hypertension. On Amlodipine 10mg OD. Allergic to Penicillin.',
      { context: 'test' },
      db,
    );

    expect(result.diagnoses[0].text).toBe('Hypertension');
    expect(result.medications[0].name).toBe('Amlodipine');
    expect(result.allergies[0].substance).toBe('Penicillin');
    expect(result.aiSource).toBe('llm:ollama');
  });

  it('falls back to rule extraction when LLM returns null', async () => {
    llmMock = { generate: jest.fn().mockResolvedValue(null) };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalNlpService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalNlpService);

    const result = await svc.extractEntities(
      'Patient has hypertension. Allergic to penicillin.',
      { context: 'test' },
      db,
    );

    expect(result.aiSource).toBe('rule');
    expect(result.diagnoses.some(d => d.text === 'hypertension')).toBe(true);
  });

  it('falls back to rule extraction when LLM returns malformed JSON', async () => {
    llmMock = {
      generate: jest.fn().mockResolvedValue({
        text: 'not json', backend: 'ollama', model: 'llama3', latencyMs: 100,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalNlpService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalNlpService);
    const result = await svc.extractEntities('has diabetes and cough', { context: 'test' }, db);
    expect(result.aiSource).toBe('rule');
  });

  it('returns empty entities for very short input', async () => {
    const module = await Test.createTestingModule({
      providers: [ClinicalNlpService],
    }).compile();
    svc = module.get(ClinicalNlpService);
    const result = await svc.extractEntities('ok', { context: 'test' }, db);
    expect(result.diagnoses).toHaveLength(0);
  });

  it('audits every extraction call', async () => {
    llmMock = {
      generate: jest.fn().mockResolvedValue({
        text: LLM_JSON, backend: 'ollama', model: 'llama3', latencyMs: 200,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalNlpService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalNlpService);
    await svc.extractEntities('Patient has HIV.', { context: 'test', patientId: 1 }, db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO clinical_nlp_extractions'),
      expect.any(Array),
    );
  });
});
```

---

## Acceptance Criteria

1. `POST /cdss/nlp/extract` with `{ text: "Patient has hypertension. Allergic to penicillin." }` returns structured JSON with `diagnoses` containing `{ text: "Hypertension" }` and `allergies` containing `{ substance: "penicillin" }`.
2. When Ollama is available, `aiSource` in the response is `'llm:ollama'`.
3. When LLM is unavailable, rule-based fallback returns entities with `aiSource: 'rule'` — no 500 error.
4. `CdssService.parseClinicalNarrative()` delegates to `ClinicalNlpService` — no longer a no-op.
5. `CareGapEngineService.detectGaps()` includes NLP-extracted diagnoses from recent notes in its rule evaluation.
6. `DrugSubstitutionService.getSuggestions()` includes NLP-extracted allergies in the LLM prompt.
7. Every extraction call (success or failure) writes one row to `clinical_nlp_extractions`.
8. `NarrativeExtractorPanel` debounces at 800ms and shows entity chips below the textarea.
9. `NarrativeExtractorSheet` (mobile) debounces at 900ms; uses `C.surface2` for entity box background; all design tokens from `'../design/tokens'`.
10. All 8 i18n locale files have `clinical_nlp.*` keys.
11. `tsc --noEmit` clean; Jest spec 5/5 green.

---

## Definition of Done

- [ ] DB provisioning bundle `clinical_nlp_extractions` added with `CREATE TABLE IF NOT EXISTS`
- [ ] `ClinicalNlpService` injects `ClinicalLlmService` via `@Optional()`; rule-based fallback always present
- [ ] JSON schema in prompt matches the `ClinicalEntities` interface exactly (LLM output is type-safe)
- [ ] Parse failure path uses rule fallback — never throws to caller
- [ ] `CdssService.parseClinicalNarrative()` delegates to `ClinicalNlpService`
- [ ] `CareGapEngineService` merges NLP diagnoses before gap rule evaluation
- [ ] `DrugSubstitutionService` adds NLP allergies to LLM enrichment prompt
- [ ] `CdssNlpController` POST `/cdss/nlp/extract` guarded by `JwtAuthGuard`, uses `req.tenantDb`
- [ ] `NarrativeExtractorPanel` (EHR): debounced, shows typed entity sections
- [ ] `NarrativeExtractorSheet` (mobile): uses `'../design/tokens'` imports; correct token names (`C.textMuted`, `C.textSecondary`, `C.surface2`)
- [ ] All 8 i18n locale files have `clinical_nlp.*` keys
- [ ] Module registration complete (providers + controllers)
- [ ] Jest spec: 5 tests passing
- [ ] `tsc --noEmit` clean in `ehr-service`
- [ ] **100% AI-First declaration:** Every AI surface in MediCore (clinical summary, care gaps, drug substitution, follow-up, documents, CDSS NLP) now routes through `ClinicalLlmService` with rule-based fallback. `ai_source = 'rule'` in production indicates an LLM outage, not a missing AI feature.
- [ ] Reviewer certification signed off
