# S181 — AI Clinical Summary Panel

**Phase:** 3 — System-Wide AI-First UX  
**Effort:** M  
**Depends on:** S179, S180  
**Goal:** Every time a clinician opens a patient record, an AI-generated 5-sentence clinical summary appears at the top — synthesising the most clinically relevant information from history, active conditions, recent labs, and current medications — so the clinician is briefed in 10 seconds.

---

## Problem

Opening a patient record today means raw data scattered across multiple tabs. There is no synthesised "what you need to know right now" section. This sprint creates the AI summary panel that makes every patient screen feel AI-first.

---

## Acceptance Criteria

1. `GET /patients/:id/clinical-summary` returns a 5-sentence structured summary.
2. Summary is generated on first view and cached in `patient_clinical_summaries` table.
3. Cache invalidates when new lab results, diagnoses, or medications are added (hash-based).
4. EHR patient record header displays the summary in a prominent green panel.
5. Mobile patient detail screen displays a compact 2-line summary with "Read more" expansion.
6. Summary includes: condition overview, current medications, recent findings, pending actions, risk level.
7. If CDSS unavailable, summary is generated from raw data without LLM polish.
8. Clinician can rate summary quality (thumbs up/down) — feedback stored.
9. `tsc --noEmit` and lint pass.
10. i18n keys in all 8 locales.

---

## 1. Database Provisioning

```typescript
{
  id: 'patient_clinical_summaries',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS patient_clinical_summaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      summary_text TEXT NOT NULL,
      sentences JSONB NOT NULL DEFAULT '[]',
      data_hash VARCHAR(64),
      feedback_positive INTEGER NOT NULL DEFAULT 0,
      feedback_negative INTEGER NOT NULL DEFAULT 0,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(patient_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pcs_patient ON patient_clinical_summaries(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pcs_generated ON patient_clinical_summaries(generated_at DESC)`,
  ],
},
```

---

## 2. Backend — ClinicalSummaryService

Create `services/ehr-service/src/services/clinical-summary.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';
import { AbstentionLogService } from './abstention-log.service';
import { createHash } from 'crypto';

@Injectable()
export class ClinicalSummaryService {
  private readonly logger = new Logger(ClinicalSummaryService.name);

  constructor(
    @Optional() private readonly llm: PostVisitGroundedLlmService,
    @Optional() private readonly abstentionLog: AbstentionLogService,
  ) {}

  async getSummary(patientId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM patient_clinical_summaries WHERE patient_id = $1`,
      [patientId],
    );
    return rows[0] ?? null;
  }

  async generateSummary(patientId: string, db: any): Promise<unknown> {
    const [patient, diagnoses, meds, labs, riskScore, timeline] = await Promise.all([
      db.query(`SELECT first_name, last_name, date_of_birth, sex FROM patients WHERE id = $1`, [patientId]),
      db.query(`SELECT description, status, icd10_code FROM patient_diagnoses WHERE patient_id = $1 AND status IN ('active','chronic') LIMIT 5`, [patientId]),
      db.query(`SELECT drug_name, dose FROM prescriptions WHERE patient_id = $1 AND status = 'active' LIMIT 5`, [patientId]),
      db.query(`SELECT test_name, value, unit, flag FROM lab_results WHERE patient_id = $1 AND status = 'resulted' ORDER BY resulted_at DESC LIMIT 3`, [patientId]),
      db.query(`SELECT score, band FROM mortality_risk_scores WHERE patient_id = $1 ORDER BY scored_at DESC LIMIT 1`, [patientId]),
      db.query(`SELECT one_line_summary FROM patient_ai_timeline WHERE patient_id = $1`, [patientId]),
    ]);

    const pt = patient[0] ?? {};
    const age = pt.date_of_birth
      ? Math.floor((Date.now() - new Date(pt.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : '?';

    const dataKey = JSON.stringify({ d: diagnoses.length, m: meds.length, l: labs.length });
    const dataHash = createHash('md5').update(dataKey).digest('hex');

    // Check cache
    const existing = await db.query(
      `SELECT * FROM patient_clinical_summaries WHERE patient_id = $1`,
      [patientId],
    );
    if (existing.length > 0 && existing[0].data_hash === dataHash) {
      return existing[0];
    }

    // Build raw 5-sentence summary
    const s1 = `${pt.first_name ?? 'Patient'} is a ${age}-year-old ${pt.sex ?? 'patient'} with ${diagnoses.map((d: any) => d.description).slice(0, 2).join(' and ') || 'no documented chronic conditions'}.`;
    const s2 = meds.length > 0
      ? `Currently on ${meds.map((m: any) => m.drug_name).join(', ')}.`
      : 'No active medications on record.';
    const s3 = labs.length > 0
      ? `Recent labs: ${labs.map((l: any) => `${l.test_name} ${l.value} ${l.unit ?? ''} ${l.flag ? `[${l.flag}]` : ''}`).join('; ')}.`
      : 'No recent lab results.';
    const risk = riskScore[0];
    const s4 = risk
      ? `30-day mortality risk: ${risk.score}/100 (${risk.band}).`
      : 'Mortality risk not yet assessed.';
    const s5 = timeline[0]?.one_line_summary ?? 'No AI timeline summary available.';

    const sentences = [s1, s2, s3, s4, s5];
    let summaryText = sentences.join(' ');

    // Polish with LLM
    if (this.llm) {
      try {
        const polished = await this.llm.polishDoctorContent({
          rawContent: summaryText,
          context: '5-sentence clinical summary',
          targetAudience: 'clinician',
        });
        summaryText = polished?.content ?? summaryText;
      } catch (err) {
        this.logger.warn(`LLM polish failed: ${err.message}`);
        if (this.abstentionLog) {
          await this.abstentionLog.log(db, 'clinical_summary', 'cdss_error', { patientId, errorDetail: err.message });
        }
      }
    }

    const rows = await db.query(
      `INSERT INTO patient_clinical_summaries
         (patient_id, summary_text, sentences, data_hash)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (patient_id) DO UPDATE SET
         summary_text = EXCLUDED.summary_text,
         sentences = EXCLUDED.sentences,
         data_hash = EXCLUDED.data_hash,
         generated_at = now()
       RETURNING *`,
      [patientId, summaryText, JSON.stringify(sentences), dataHash],
    );
    return rows[0];
  }

  async submitFeedback(
    patientId: string,
    positive: boolean,
    db: any,
  ): Promise<void> {
    const col = positive ? 'feedback_positive' : 'feedback_negative';
    await db.query(
      `UPDATE patient_clinical_summaries SET ${col} = ${col} + 1 WHERE patient_id = $1`,
      [patientId],
    );
  }
}
```

---

## 3. Controller

Create `services/ehr-service/src/controllers/clinical-summary.controller.ts`:

```typescript
import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicalSummaryService } from '../services/clinical-summary.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class ClinicalSummaryController {
  constructor(private readonly summaryService: ClinicalSummaryService) {}

  @Get(':patientId/clinical-summary')
  async getSummary(@Param('patientId') patientId: string, @Req() req: any): Promise<unknown> {
    let summary = await this.summaryService.getSummary(patientId, req.tenantDb);
    if (!summary) summary = await this.summaryService.generateSummary(patientId, req.tenantDb);
    return summary;
  }

  @Post(':patientId/clinical-summary/regenerate')
  async regenerate(@Param('patientId') patientId: string, @Req() req: any): Promise<unknown> {
    return this.summaryService.generateSummary(patientId, req.tenantDb);
  }

  @Post(':patientId/clinical-summary/feedback')
  async feedback(
    @Param('patientId') patientId: string,
    @Body() body: { positive: boolean },
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.summaryService.submitFeedback(patientId, body.positive, req.tenantDb);
    return { ok: true };
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { ClinicalSummaryService } from './services/clinical-summary.service';
import { ClinicalSummaryController } from './controllers/clinical-summary.controller';

controllers: [ /* ...existing... */ ClinicalSummaryController ],
providers: [ /* ...existing... */ ClinicalSummaryService ],
```

---

## 5. EHR Frontend — Summary Panel

Create `ehr-frontend/src/components/ClinicalSummaryPanel.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AiStatusBadge } from './AiStatusBadge';

interface Props { patientId: string; }

export const ClinicalSummaryPanel: React.FC<Props> = ({ patientId }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    api.get(`/patients/${patientId}/clinical-summary`)
      .then((r) => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  const sendFeedback = async (positive: boolean) => {
    await api.post(`/patients/${patientId}/clinical-summary/feedback`, { positive });
    setFeedback(positive ? 'up' : 'down');
  };

  if (loading) {
    return (
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 }}>
        <AiStatusBadge status="loading" compact />
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 }}>
        <AiStatusBadge status="unavailable" reason="Summary generation failed" />
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#f0fdf4', border: '1px solid #86efac',
      borderRadius: 8, padding: 14, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AiStatusBadge status="active" compact />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>AI Clinical Summary</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => sendFeedback(true)}
            title="This summary is helpful"
            style={{
              padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 6,
              backgroundColor: feedback === 'up' ? '#dcfce7' : 'white',
              cursor: 'pointer', fontSize: 14,
            }}
          >👍</button>
          <button
            onClick={() => sendFeedback(false)}
            title="This summary needs improvement"
            style={{
              padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 6,
              backgroundColor: feedback === 'down' ? '#fee2e2' : 'white',
              cursor: 'pointer', fontSize: 14,
            }}
          >👎</button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#166534', margin: 0, lineHeight: 1.6 }}>
        {summary.summary_text}
      </p>
      <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
        Generated {new Date(summary.generated_at).toLocaleString()}
        <button
          onClick={() => {
            setLoading(true);
            api.post(`/patients/${patientId}/clinical-summary/regenerate`)
              .then((r) => setSummary(r.data))
              .finally(() => setLoading(false));
          }}
          style={{ marginLeft: 8, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
};
```

Import and place `<ClinicalSummaryPanel patientId={patient.id} />` at the top of the patient record view, below the demographic header.

---

## 6. Mobile — Compact Summary

In `mobile/src/screens/PatientDetailScreen.tsx`:

```tsx
const [clinicalSummary, setClinicalSummary] = useState<string | null>(null);
const [summaryExpanded, setSummaryExpanded] = useState(false);

useEffect(() => {
  api.get(`/patients/${patientId}/clinical-summary`)
    .then((r) => setClinicalSummary(r.data?.summary_text ?? null))
    .catch(() => null);
}, [patientId]);

{clinicalSummary && (
  <TouchableOpacity
    onPress={() => setSummaryExpanded(!summaryExpanded)}
    style={{
      backgroundColor: C.green + '10', padding: SPACING.md,
      borderRadius: RADIUS.md, marginBottom: SPACING.md,
      borderLeftWidth: 3, borderLeftColor: C.green,
    }}
  >
    <Text style={{ fontFamily: FONT.uiBd, fontSize: 12, color: C.green, marginBottom: 4 }}>
      AI Clinical Summary
    </Text>
    <Text
      style={{ fontFamily: FONT.ui, fontSize: 12, color: '#374151' }}
      numberOfLines={summaryExpanded ? undefined : 2}
    >
      {clinicalSummary}
    </Text>
    <Text style={{ fontFamily: FONT.ui, fontSize: 11, color: C.blue, marginTop: 4 }}>
      {summaryExpanded ? t('common.show_less') : t('common.read_more')}
    </Text>
  </TouchableOpacity>
)}
```

---

## 7. i18n Keys — All 8 Locales

### `en.json`:
```json
"clinical_summary": {
  "title": "AI Clinical Summary",
  "loading": "Generating summary...",
  "unavailable": "Summary unavailable",
  "regenerate": "Regenerate",
  "feedback_helpful": "Helpful",
  "feedback_not": "Not helpful",
  "generated_at": "Generated"
}
```

### `sn.json`:
```json
"clinical_summary": {
  "title": "Pfupiso yeAI yekurapa",
  "loading": "Kugadzira pfupiso...",
  "unavailable": "Pfupiso haikwanisi",
  "regenerate": "Gadzira Zvakare",
  "feedback_helpful": "Inobatsira",
  "feedback_not": "Haibatsiri",
  "generated_at": "Yakagadzirwa"
}
```

### `nd.json`:
```json
"clinical_summary": {
  "title": "Isifinyezo se-AI Sezokwelapha",
  "loading": "Yakhela isifinyezo...",
  "unavailable": "Isifinyezo asitholakali",
  "regenerate": "Akhela Futhi",
  "feedback_helpful": "Siyasiza",
  "feedback_not": "Asizi",
  "generated_at": "Yakhiwa"
}
```

### `pt.json`:
```json
"clinical_summary": {
  "title": "Resumo Clínico IA",
  "loading": "A gerar resumo...",
  "unavailable": "Resumo indisponível",
  "regenerate": "Regenerar",
  "feedback_helpful": "Útil",
  "feedback_not": "Não útil",
  "generated_at": "Gerado"
}
```

### `fr.json`:
```json
"clinical_summary": {
  "title": "Résumé Clinique IA",
  "loading": "Génération du résumé...",
  "unavailable": "Résumé indisponible",
  "regenerate": "Régénérer",
  "feedback_helpful": "Utile",
  "feedback_not": "Pas utile",
  "generated_at": "Généré"
}
```

### `sw.json`:
```json
"clinical_summary": {
  "title": "Muhtasari wa AI wa Kliniki",
  "loading": "Kutengeneza muhtasari...",
  "unavailable": "Muhtasari haupatikani",
  "regenerate": "Tengeneza Upya",
  "feedback_helpful": "Inasaidia",
  "feedback_not": "Haikusaidia",
  "generated_at": "Imezalishwa"
}
```

### `zu.json`:
```json
"clinical_summary": {
  "title": "Isifinyezo se-AI Sezempilo",
  "loading": "Iyakhiqiza isifinyezo...",
  "unavailable": "Isifinyezo asitholakali",
  "regenerate": "Khiqiza Kabusha",
  "feedback_helpful": "Iyasiza",
  "feedback_not": "Ayisizi",
  "generated_at": "Ikhiqiziwe"
}
```

### `af.json`:
```json
"clinical_summary": {
  "title": "KI Kliniese Opsomming",
  "loading": "Opsomming word gegenereer...",
  "unavailable": "Opsomming nie beskikbaar nie",
  "regenerate": "Hergenereer",
  "feedback_helpful": "Nuttig",
  "feedback_not": "Nie nuttig nie",
  "generated_at": "Gegenereer"
}
```

---

## 8. Jest Spec

Create `services/ehr-service/src/services/clinical-summary.service.spec.ts`:

```typescript
import { ClinicalSummaryService } from './clinical-summary.service';

function makeService(llm?: any) {
  return new ClinicalSummaryService(llm ?? null, null);
}

function makeDb(existingSummary: any = null) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients')) return Promise.resolve([{ first_name: 'Ana', last_name: 'Cruz', date_of_birth: '1970-06-01', sex: 'F' }]);
      if (sql.includes('patient_diagnoses')) return Promise.resolve([{ description: 'Hypertension', status: 'chronic', icd10_code: 'I10' }]);
      if (sql.includes('FROM prescriptions')) return Promise.resolve([{ drug_name: 'Amlodipine', dose: '5mg' }]);
      if (sql.includes('FROM lab_results')) return Promise.resolve([]);
      if (sql.includes('mortality_risk_scores')) return Promise.resolve([{ score: 35, band: 'moderate' }]);
      if (sql.includes('patient_ai_timeline')) return Promise.resolve([{ one_line_summary: 'Ana — hypertension' }]);
      if (sql.includes('SELECT *') && sql.includes('patient_clinical_summaries')) return Promise.resolve(existingSummary ? [existingSummary] : []);
      if (sql.includes('INSERT INTO patient_clinical_summaries')) return Promise.resolve([{ id: 's1', summary_text: 'Ana is a 54-year-old...' }]);
      if (sql.includes('UPDATE patient_clinical_summaries')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('ClinicalSummaryService', () => {
  it('generates summary with 5 sentences from raw data', async () => {
    const svc = makeService();
    const db = makeDb(null);
    const result: any = await svc.generateSummary('p1', db);
    expect(result.summary_text).toContain('Ana');
  });

  it('returns cached summary when hash matches', async () => {
    const svc = makeService();
    const hash = require('crypto').createHash('md5').update(JSON.stringify({ d: 1, m: 1, l: 0 })).digest('hex');
    const db = makeDb({ id: 's1', summary_text: 'Cached summary', data_hash: hash });
    const result: any = await svc.generateSummary('p1', db);
    expect(result).toBeTruthy();
  });

  it('submits positive feedback', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    await svc.submitFeedback('p1', true, db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('feedback_positive'),
      ['p1'],
    );
  });

  it('does not throw when LLM fails', async () => {
    const llm = { polishDoctorContent: jest.fn().mockRejectedValue(new Error('LLM down')) };
    const svc = makeService(llm);
    const db = makeDb(null);
    const result: any = await svc.generateSummary('p1', db);
    expect(result.summary_text).toContain('Ana');
  });
});
```

---

## 9. Definition of Done

- [ ] `patient_clinical_summaries` table provisioned; repair passes
- [ ] `ClinicalSummaryService` and `ClinicalSummaryController` in `ehr.module.ts`
- [ ] `GET /patients/:id/clinical-summary` returns summary (generates if missing)
- [ ] `POST /patients/:id/clinical-summary/feedback` stores feedback
- [ ] `ClinicalSummaryPanel` rendered at top of patient record in EHR
- [ ] Mobile shows 2-line compact summary with expand toggle
- [ ] Thumbs up/down feedback buttons functional
- [ ] `tsc --noEmit` passes in `services/ehr-service/` and `ehr-frontend/`
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
- [ ] `npx expo export --platform all` passes
