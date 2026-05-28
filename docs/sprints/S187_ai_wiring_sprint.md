# S187 — AI Wiring Sprint: Replace Rule Fallbacks with ClinicalLlmService

**Phase:** 4 — True AI-First Foundation  
**Effort:** L (5–6 days)  
**Depends on:** S186 (ClinicalLlmService)  
**Blocks:** S188 (clinical NLP)

---

## Problem

Five services built in S181–S185 generate text using rule-based string concatenation and record `ai_source = 'rule'` in the database. They have `@Optional()` stubs for LLM dependencies that were never wired because no general-purpose generation method existed. With `ClinicalLlmService` now available (S186), all five services must be updated to call it and record `ai_source = 'llm:<backend>'` when generation succeeds.

**Affected services:**

| Service | File | Rule Behaviour to Replace |
|---------|------|--------------------------|
| `ClinicalSummaryService` | `clinical-summary.service.ts` | Builds `s1–s5` sentence template |
| `CareGapEngineService` | `care-gap-engine.service.ts` | `description` + `recommendedAction` strings |
| `DrugSubstitutionService` | `drug-substitution.service.ts` | `rationale` field in `SubstituteSuggestion` |
| `FollowUpRecommendationService` | `followup-recommendation.service.ts` | `reasoning` narrative string |
| `ClinicalDocumentService` | `clinical-document.service.ts` | `buildRawDocument()` template output |

---

## Goal

For each service:

1. Inject `ClinicalLlmService` via `@Optional()` (rule-based path remains if LLM is absent)
2. Build a focused, context-rich prompt from the structured data already gathered
3. Call `ClinicalLlmService.generate()` and use the returned text when `result !== null`
4. Fall back to the existing rule-based string when `result === null`
5. Update `ai_source` to `llm:<backend>` on success, keep `'rule'` on fallback
6. Log abstention via `AbstentionLogService` only when falling back (not on every call)

**Invariant:** removing `CLINICAL_LLM_BACKEND` or pointing it at an unreachable endpoint must not break any service — the rule path always remains.

---

## Wiring Spec — ClinicalSummaryService

**File:** `services/ehr-service/src/services/clinical-summary.service.ts`

### Changes

1. Add constructor injection of `ClinicalLlmService` and `AbstentionLogService`
2. After computing `sentences`, call `generate()` with a summarisation prompt
3. Use LLM text as `summaryText` when successful; record `aiSource`

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { ClinicalLlmService } from './clinical-llm.service';
import { AbstentionLogService } from './abstention-log.service';

@Injectable()
export class ClinicalSummaryService {
  private readonly logger = new Logger(ClinicalSummaryService.name);

  constructor(
    @Optional() private readonly llm: ClinicalLlmService,
    @Optional() private readonly abstentionLog: AbstentionLogService,
  ) {}

  // ... existing getSummary() unchanged ...

  async generateSummary(patientId: string, db: any): Promise<unknown> {
    // ... existing data fetching unchanged (patient, diagnoses, meds, labs, riskScore, timeline) ...

    // Rule-based sentences (unchanged fallback)
    const ruleSentences = [s1, s2, s3, s4, s5];
    let summaryText = ruleSentences.join(' ');
    let aiSource = 'rule';

    // LLM enrichment
    if (this.llm) {
      const prompt =
        `You are a clinical documentation assistant. Write a concise 2–3 sentence clinical summary ` +
        `for a ${age}-year-old ${pt.sex ?? 'patient'} with the following data:\n` +
        `Diagnoses: ${diagnoses.map((d: any) => d.description).slice(0, 5).join(', ') || 'none'}\n` +
        `Medications: ${meds.map((m: any) => `${m.drug_name} ${m.dose}`).join(', ') || 'none'}\n` +
        `Recent labs: ${labs.map((l: any) => `${l.test_name} ${l.value}${l.unit ?? ''}${l.flag ? ` [${l.flag}]` : ''}`).join('; ') || 'none'}\n` +
        `30-day mortality risk: ${riskScore[0] ? `${riskScore[0].score}/100 (${riskScore[0].band})` : 'not assessed'}\n` +
        `AI timeline: ${timeline[0]?.one_line_summary ?? 'none'}\n` +
        `Focus on clinically actionable findings. Do not start with "Patient" — vary the opening.`;

      const result = await this.llm.generate(prompt, {
        context: 'clinical_summary',
        maxTokens: 300,
        temperature: 0.25,
      }, db);

      if (result && result.text.length > 30) {
        summaryText = result.text;
        aiSource = `llm:${result.backend}`;
      } else {
        await this.abstentionLog?.log(db, 'clinical_summary', 'low_confidence', {
          patientId: String(patientId),
        });
      }
    }

    // Upsert with aiSource persisted
    const rows = await db.query(
      `INSERT INTO patient_clinical_summaries
         (patient_id, summary_text, sentences, data_hash, ai_source)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (patient_id) DO UPDATE SET
         summary_text = EXCLUDED.summary_text,
         sentences    = EXCLUDED.sentences,
         data_hash    = EXCLUDED.data_hash,
         ai_source    = EXCLUDED.ai_source,
         generated_at = NOW()
       RETURNING *`,
      [patientId, summaryText, JSON.stringify(ruleSentences), dataHash, aiSource],
    );
    return rows[0];
  }
}
```

> **Schema migration:** Add `ai_source TEXT NOT NULL DEFAULT 'rule'` column to `patient_clinical_summaries`. Included in the provisioning bundle below.

---

## Wiring Spec — CareGapEngineService

**File:** `services/ehr-service/src/services/care-gap-engine.service.ts`

### Changes

After the rule engine detects gaps, call LLM to enrich each gap's `description` and `recommendedAction` with patient-specific context:

```typescript
import { ClinicalLlmService } from './clinical-llm.service';
import { AbstentionLogService } from './abstention-log.service';

// In constructor:
constructor(
  @Optional() private readonly llm: ClinicalLlmService,
  @Optional() private readonly abstentionLog: AbstentionLogService,
) {}

// After gaps array is built, before DB persist:
async enrichGapsWithLlm(gaps: CareGap[], patientContext: string, db: any): Promise<CareGap[]> {
  if (!this.llm || gaps.length === 0) return gaps;

  const prompt =
    `Patient context: ${patientContext}\n\n` +
    `The following care gaps have been identified by protocol rules:\n` +
    gaps.map((g, i) =>
      `${i + 1}. [${g.priority.toUpperCase()}] ${g.gapType}: ${g.description}\n` +
      `   Recommended action: ${g.recommendedAction}`
    ).join('\n') +
    `\n\nFor each gap, rewrite the description (1 sentence, specific to this patient) and ` +
    `recommended action (1 sentence, actionable). Reply in JSON array format:\n` +
    `[{"description":"...","recommendedAction":"..."},...]`;

  const result = await this.llm.generate(prompt, {
    context: 'care_gap_enrichment',
    maxTokens: 600,
    temperature: 0.2,
  }, db);

  if (!result) {
    await this.abstentionLog?.log(db, 'care_gap_enrichment', 'timeout');
    return gaps;
  }

  try {
    const enriched: Array<{ description: string; recommendedAction: string }> =
      JSON.parse(result.text);
    return gaps.map((g, i) => ({
      ...g,
      description: enriched[i]?.description ?? g.description,
      recommendedAction: enriched[i]?.recommendedAction ?? g.recommendedAction,
      aiSource: `llm:${result.backend}`,
    }));
  } catch {
    return gaps;
  }
}
```

Add `aiSource?: string` field to the `CareGap` interface. Call `enrichGapsWithLlm()` in `detectGaps()` before the DB INSERT.

---

## Wiring Spec — DrugSubstitutionService

**File:** `services/ehr-service/src/services/drug-substitution.service.ts`

### Changes

After rule-based suggestions are built, call LLM to generate patient-specific `rationale` for each suggestion:

```typescript
import { ClinicalLlmService } from './clinical-llm.service';

// In constructor:
constructor(
  @Optional() private readonly abstentionLog: AbstentionLogService,
  @Optional() private readonly llm: ClinicalLlmService,
) {}

// In getSuggestions(), after ruleBasedFallback():
if (this.llm && suggestions.length > 0 && params.diagnoses?.length) {
  const prompt =
    `A clinician is considering substituting ${originalDrug}` +
    (originalDose ? ` ${originalDose}` : '') +
    ` for a patient with these diagnoses: ${params.diagnoses.slice(0, 5).join(', ')}` +
    (params.allergies?.length ? `. Known allergies: ${params.allergies.join(', ')}` : '') +
    `.\n\nFor each substitute below, write a 1-sentence patient-specific rationale ` +
    `and flag any caveat (or write "none").\n` +
    suggestions.map((s, i) => `${i + 1}. ${s.drug}`).join('\n') +
    `\nReply JSON: [{"rationale":"...","caveat":"..."},...]`;

  const result = await this.llm.generate(prompt, {
    context: 'drug_substitution',
    maxTokens: 400,
    temperature: 0.2,
  }, db);

  if (result) {
    try {
      const enriched: Array<{ rationale: string; caveat: string }> = JSON.parse(result.text);
      suggestions = suggestions.map((s, i) => ({
        ...s,
        rationale: enriched[i]?.rationale ?? s.rationale,
        caveat: enriched[i]?.caveat === 'none' ? '' : (enriched[i]?.caveat ?? s.caveat),
        sourceType: `llm:${result.backend}` as any,
      }));
    } catch { /* keep rule rationales */ }
  }
}
```

Update the `sourceType` field in `SubstituteSuggestion` from `'rule'` literal to `string`.

---

## Wiring Spec — FollowUpRecommendationService

**File:** `services/ehr-service/src/services/followup-recommendation.service.ts`

### Changes

Replace the dummy `this.llm.polishDoctorContent()` call (which was dropped in S185 due to type incompatibility) with a direct `ClinicalLlmService.generate()` call:

```typescript
import { ClinicalLlmService } from './clinical-llm.service';

// In constructor — replace PostVisitGroundedLlmService with ClinicalLlmService:
constructor(
  @Optional() private readonly llm: ClinicalLlmService,
  @Optional() private readonly abstentionLog: AbstentionLogService,
  @Optional() private readonly alertDelivery: AlertDeliveryService,
  @Optional() @Inject(TenantService) private readonly tenantService: TenantService,
) {}

// In generateRecommendation(), after computeInterval():
if (this.llm) {
  const prompt =
    `Write 1–2 sentences explaining why a ${riskBand}-risk patient who had a ` +
    `${encounterType} encounter should follow up in ${days} days via ${modality}. ` +
    `Active diagnoses: ${diagnoses.slice(0, 4).join(', ') || 'none'}. ` +
    `Open care gaps: ${openCareGapsCount}. ` +
    `Medications changed this encounter: ${medicationsChanged ? 'yes' : 'no'}. ` +
    `Be specific and avoid generic statements.`;

  const result = await this.llm.generate(prompt, {
    context: 'followup_reasoning',
    maxTokens: 200,
    temperature: 0.3,
  }, db);

  if (result && result.text.length > 20) {
    reasoning = result.text;
    aiSource = `llm:${result.backend}`;
  }
}
```

---

## Wiring Spec — ClinicalDocumentService

**File:** `services/ehr-service/src/services/clinical-document.service.ts`

### Changes

After `buildRawDocument()` produces a template string, call LLM to polish it into professional clinical prose:

```typescript
import { ClinicalLlmService } from './clinical-llm.service';
import { AbstentionLogService } from './abstention-log.service';

// In constructor:
constructor(
  @Optional() private readonly llm: ClinicalLlmService,
  @Optional() private readonly abstentionLog: AbstentionLogService,
) {}

// In generateDocument(), after buildRawDocument():
let content = this.buildRawDocument(documentType, pt, diagnoses, meds, labs, notes, vit, options);
let aiSource = 'rule';

if (this.llm) {
  const typeLabel: Record<string, string> = {
    referral_letter: 'a formal referral letter',
    discharge_summary: 'a discharge summary',
    pre_auth: 'a pre-authorisation request',
    sick_note: 'a medical certificate',
    other: 'a clinical document',
  };
  const prompt =
    `You are a senior clinician. Rewrite the following as ${typeLabel[documentType] ?? 'a clinical document'} ` +
    `in professional clinical language. Preserve all facts. Do not add information not present. ` +
    (options?.recipient ? `Addressed to: ${options.recipient}. ` : '') +
    (options?.additionalContext ? `Context: ${options.additionalContext}. ` : '') +
    `\n\n---\n${content}\n---\n\nRewrite:`;

  const result = await this.llm.generate(prompt, {
    context: `clinical_document:${documentType}`,
    maxTokens: 800,
    temperature: 0.2,
  }, db);

  if (result && result.text.length > 100) {
    content = result.text;
    aiSource = `llm:${result.backend}`;
  } else {
    await this.abstentionLog?.log(db, `clinical_document:${documentType}`, 'low_confidence', {
      patientId: String(patientId),
    });
  }
}
```

Add `ai_source TEXT NOT NULL DEFAULT 'rule'` to the `clinical_documents` INSERT.

---

## Database Provisioning

Add migration bundle after `clinical_llm_audit` in  
`services/tenant-service/src/services/database-provisioning.service.ts`:

```typescript
{
  id: 'ai_source_columns_s187',
  label: 'Sprint 187 — ai_source columns for LLM wiring',
  version: '2026.05.28.2',
  description: 'Add ai_source tracking to tables updated in S181–S185',
  statements: () => [
    `ALTER TABLE patient_clinical_summaries
       ADD COLUMN IF NOT EXISTS ai_source TEXT NOT NULL DEFAULT 'rule'`,
    `ALTER TABLE patient_care_gaps
       ADD COLUMN IF NOT EXISTS ai_source TEXT NOT NULL DEFAULT 'rule'`,
    `ALTER TABLE drug_substitution_suggestions
       ADD COLUMN IF NOT EXISTS ai_source TEXT NOT NULL DEFAULT 'rule'`,
    `ALTER TABLE followup_recommendations
       ADD COLUMN IF NOT EXISTS ai_source TEXT NOT NULL DEFAULT 'rule'`,
    `ALTER TABLE clinical_documents
       ADD COLUMN IF NOT EXISTS ai_source TEXT NOT NULL DEFAULT 'rule'`,
  ],
},
```

---

## EHR Component — AiSourceTag

**File:** `ehr-frontend/src/components/AiSourceTag.tsx`

A small inline tag that shows where AI text originated. Displayed next to generated content in clinical panels.

```tsx
import React from 'react';

interface Props {
  aiSource: string;
}

const SOURCE_LABEL: Record<string, string> = {
  'rule':            '📋 Protocol',
  'llm:ollama':      '🤖 Local AI',
  'llm:azure_openai':'☁️ Azure AI',
  'llm:aws_bedrock': '☁️ AWS AI',
  'llm:anthropic':   '☁️ Anthropic AI',
};

export default function AiSourceTag({ aiSource }: Props) {
  const label = SOURCE_LABEL[aiSource] ?? `🤖 ${aiSource}`;
  const isLlm = aiSource.startsWith('llm:');
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: isLlm ? '#0369a1' : '#6b7280',
      background: isLlm ? '#e0f2fe' : '#f3f4f6',
      padding: '1px 8px', borderRadius: 10,
      border: `1px solid ${isLlm ? '#bae6fd' : '#e5e7eb'}`,
    }}>
      {label}
    </span>
  );
}
```

---

## Mobile Component — AiSourcePill

**File:** `mobile/src/components/AiSourcePill.tsx`

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../design/tokens';

interface Props {
  aiSource: string;
}

const LABEL: Record<string, string> = {
  'rule':            'Protocol',
  'llm:ollama':      'Local AI',
  'llm:azure_openai':'Azure AI',
  'llm:aws_bedrock': 'AWS AI',
  'llm:anthropic':   'Claude AI',
};

export default function AiSourcePill({ aiSource }: Props) {
  const isLlm = aiSource.startsWith('llm:');
  const label = LABEL[aiSource] ?? 'AI';
  return (
    <View style={[styles.pill, { backgroundColor: isLlm ? '#dbeafe' : '#f3f4f6' }]}>
      <Text style={[styles.text, { color: isLlm ? C.blue : C.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FONT.uiSb,
    fontSize: 10,
  },
});
```

---

## i18n Keys

Add `ai_source` block BEFORE the existing `ai_status` block in all 8 locale files:

**en.json:**
```json
"ai_source": {
  "rule":         "Protocol Rules",
  "local_ai":     "Local AI",
  "azure_ai":     "Azure AI",
  "aws_ai":       "AWS AI",
  "anthropic_ai": "Anthropic AI",
  "label":        "Generated by"
}
```

| Key | sn | nd | pt | fr | sw | zu | af |
|-----|----|----|----|----|----|----|-----|
| rule | Mitemo yeMutsara | Imithetho | Regras do Protocolo | Règles du Protocole | Sheria za Itifaki | Imithetho Yohlelo | Protokolreëls |
| local_ai | AI Yepasi | I-AI Yendawo | IA Local | IA Locale | AI ya Ndani | I-AI Yendawo | Plaaslike KI |
| azure_ai | Azure AI | I-Azure AI | IA Azure | IA Azure | AI ya Azure | I-Azure AI | Azure KI |
| aws_ai | AWS AI | I-AWS AI | IA AWS | IA AWS | AI ya AWS | I-AWS AI | AWS KI |
| anthropic_ai | Anthropic AI | I-Anthropic AI | IA Anthropic | IA Anthropic | AI ya Anthropic | I-Anthropic AI | Anthropic KI |
| label | Yakagadzirwa na | Yenziwe ngu | Gerado por | Généré par | Imetengenezwa na | Yenziwa ngu | Gegenereer deur |

---

## Jest Spec

**File:** `services/ehr-service/src/services/clinical-summary.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { ClinicalSummaryService } from './clinical-summary.service';
import { ClinicalLlmService } from './clinical-llm.service';

describe('ClinicalSummaryService — LLM wiring', () => {
  let svc: ClinicalSummaryService;
  let db: any;
  let llmMock: jest.Mocked<Partial<ClinicalLlmService>>;

  const makeDb = (rows: Record<string, any[]> = {}) => ({
    query: jest.fn().mockImplementation((sql: string) => {
      if (/FROM patients/.test(sql)) return Promise.resolve(rows.patient ?? [{ first_name: 'Jane', last_name: 'Doe', date_of_birth: '1980-01-01', sex: 'female' }]);
      if (/patient_diagnoses/.test(sql)) return Promise.resolve(rows.diagnoses ?? [{ description: 'Hypertension' }]);
      if (/prescriptions/.test(sql)) return Promise.resolve(rows.meds ?? []);
      if (/lab_results/.test(sql)) return Promise.resolve(rows.labs ?? []);
      if (/mortality_risk/.test(sql)) return Promise.resolve([]);
      if (/patient_ai_timeline/.test(sql)) return Promise.resolve([]);
      if (/patient_clinical_summaries/.test(sql)) return Promise.resolve([{ id: 1, summary_text: 'test', ai_source: 'llm:ollama' }]);
      return Promise.resolve([]);
    }),
  });

  it('uses LLM text when generate() succeeds', async () => {
    llmMock = { generate: jest.fn().mockResolvedValue({ text: 'AI-generated clinical summary.', backend: 'ollama', model: 'llama3', latencyMs: 250 }) };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalSummaryService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalSummaryService);
    db = makeDb();
    await svc.generateSummary('1', db);
    const insertCall = db.query.mock.calls.find((c: any[]) => c[0].includes('patient_clinical_summaries'));
    expect(insertCall[1]).toContain('AI-generated clinical summary.');
  });

  it('falls back to rule text when LLM returns null', async () => {
    llmMock = { generate: jest.fn().mockResolvedValue(null) };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalSummaryService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalSummaryService);
    db = makeDb();
    await svc.generateSummary('1', db);
    const insertCall = db.query.mock.calls.find((c: any[]) => c[0].includes('patient_clinical_summaries'));
    expect(insertCall[1][4]).toBe('rule');
  });

  it('records ai_source = llm:ollama when LLM succeeds', async () => {
    llmMock = { generate: jest.fn().mockResolvedValue({ text: 'Summary text here.', backend: 'ollama', model: 'llama3', latencyMs: 100 }) };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalSummaryService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalSummaryService);
    db = makeDb();
    await svc.generateSummary('2', db);
    const insertCall = db.query.mock.calls.find((c: any[]) => c[0].includes('patient_clinical_summaries'));
    expect(insertCall[1][4]).toBe('llm:ollama');
  });

  it('generates summary without LLM when service not injected', async () => {
    const module = await Test.createTestingModule({
      providers: [ClinicalSummaryService],
    }).compile();
    svc = module.get(ClinicalSummaryService);
    db = makeDb();
    await expect(svc.generateSummary('3', db)).resolves.not.toThrow();
  });
});
```

---

## Acceptance Criteria

1. After S187, `GET /clinical-summary/:patientId` with Ollama running returns `ai_source: 'llm:ollama'` in the DB row.
2. After S187, `POST /drug-substitution/suggest` for Amoxicillin returns suggestions with LLM-enriched `rationale` fields.
3. After S187, `POST /followup/recommend` returns `aiSource: 'llm:<backend>'` in the response body.
4. After S187, `POST /documents/generate` returns a polished document; the DB row has `ai_source = 'llm:<backend>'`.
5. Removing `CLINICAL_LLM_BACKEND` (or setting an unreachable URL) causes all five services to fall back to rule-based text with `ai_source = 'rule'` — no 500 errors.
6. `AiSourceTag` in EHR shows "☁️ Azure AI" when `ai_source = 'llm:azure_openai'`.
7. `AiSourcePill` in mobile shows "Local AI" when `ai_source = 'llm:ollama'`.
8. `tsc --noEmit` passes for both `ehr-service` and `ehr-frontend`.
9. Jest spec: 4 tests passing.

---

## Definition of Done

- [ ] All five services inject `ClinicalLlmService` via `@Optional()`
- [ ] LLM path called first; rule path is the fallback — not the default
- [ ] `ai_source` persisted as `llm:<backend>` on success, `rule` on fallback
- [ ] Abstention logged via `AbstentionLogService` when falling back from LLM
- [ ] DB migration bundle `ai_source_columns_s187` adds `ai_source` columns
- [ ] `AiSourceTag` EHR component shows backend-specific label
- [ ] `AiSourcePill` mobile component uses design tokens throughout
- [ ] All 8 i18n locale files have `ai_source.*` keys
- [ ] Jest spec: 4 tests passing
- [ ] `tsc --noEmit` clean
- [ ] Reviewer certification signed off
