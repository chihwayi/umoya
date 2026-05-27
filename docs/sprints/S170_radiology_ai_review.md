# S170 — Radiology AI Review Controller

**Phase:** 1 — Fix Broken Wires  
**Effort:** M  
**Depends on:** S169  
**Goal:** Wire `CdssService.radiologyAnalysis()` output through a new controller and React panel so radiologists see AI findings inline on every imaging study — currently the analysis runs but results are never stored or displayed.

---

## Problem

`CdssService` has a `radiologyAnalysis(imagingStudyId, tenantId)` method that returns findings, confidence scores, and urgency flags. Nothing stores these results, and the EHR radiology module has no panel to show them. The wire is broken at the persistence and display layers.

---

## Acceptance Criteria

1. When a radiology study is opened in the EHR, `radiologyAnalysis` is called (if not already cached).
2. Results are stored in `radiology_ai_findings` table with full JSON payload.
3. EHR radiology panel shows AI findings panel: list of findings, confidence bars, urgency badge.
4. Radiologist can mark a finding as "confirmed", "rejected", or "needs review".
5. If CDSS is unavailable, panel shows "AI Unavailable" badge (not an error).
6. Findings with urgency `CRITICAL` or `HIGH` trigger `broadcastCriticalAlert`.
7. `GET /radiology/studies/:studyId/ai-findings` returns stored findings.
8. `PATCH /radiology/ai-findings/:findingId/review` updates status.
9. AI findings appear in patient timeline.
10. `tsc --noEmit` and lint pass.

---

## 1. Database Provisioning

Add to `getProvisioningBundles()` in `database-provisioning.service.ts`:

```typescript
{
  id: 'radiology_ai_findings',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS radiology_ai_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      study_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      requested_by UUID,
      cdss_raw_response JSONB NOT NULL DEFAULT '{}',
      findings JSONB NOT NULL DEFAULT '[]',
      urgency VARCHAR(32) NOT NULL DEFAULT 'ROUTINE'
        CHECK (urgency IN ('ROUTINE','LOW','MEDIUM','HIGH','CRITICAL')),
      modality VARCHAR(32),
      body_part VARCHAR(64),
      overall_confidence NUMERIC(4,3),
      radiologist_review_status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (radiologist_review_status IN ('pending','confirmed','rejected','needs_review')),
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      reviewer_comment TEXT,
      alert_sent BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_raf_study
      ON radiology_ai_findings(study_id)`,
    `CREATE INDEX IF NOT EXISTS idx_raf_patient
      ON radiology_ai_findings(patient_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_raf_urgency
      ON radiology_ai_findings(urgency) WHERE urgency IN ('HIGH','CRITICAL')`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_raf_study_unique
      ON radiology_ai_findings(study_id)`,
  ],
},
```

---

## 2. Backend — RadiologyAiService

Create `services/ehr-service/src/services/radiology-ai.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { CdssService } from './cdss.service';
import { AlertDeliveryService } from './alert-delivery.service';

@Injectable()
export class RadiologyAiService {
  private readonly logger = new Logger(RadiologyAiService.name);

  constructor(
    @Optional() private readonly cdss: CdssService,
    @Optional() private readonly alertDelivery: AlertDeliveryService,
  ) {}

  async analyseStudy(
    studyId: string,
    patientId: string,
    requestedBy: string,
    db: any,
    subdomain: string,
    meta?: { modality?: string; bodyPart?: string },
  ): Promise<unknown> {
    // Return cached result if already analysed
    const existing = await db.query(
      `SELECT * FROM radiology_ai_findings WHERE study_id = $1 LIMIT 1`,
      [studyId],
    );
    if (existing.length > 0) return existing[0];

    // Call CDSS
    let cdssResponse: any = null;
    let urgency = 'ROUTINE';
    let findings: unknown[] = [];
    let confidence = 0;

    if (this.cdss) {
      try {
        cdssResponse = await this.cdss.radiologyAnalysis(studyId, patientId);
        urgency = cdssResponse?.urgency ?? 'ROUTINE';
        findings = cdssResponse?.findings ?? [];
        confidence = cdssResponse?.overallConfidence ?? 0;
      } catch (err) {
        this.logger.warn(`CDSS radiology unavailable for ${studyId}: ${err.message}`);
        // Insert abstention row
        const rows = await db.query(
          `INSERT INTO radiology_ai_findings
             (study_id, patient_id, requested_by, cdss_raw_response, findings,
              urgency, modality, body_part, overall_confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [
            studyId, patientId, requestedBy,
            JSON.stringify({ error: 'cdss_unavailable', message: err.message }),
            JSON.stringify([]), 'ROUTINE',
            meta?.modality ?? null, meta?.bodyPart ?? null, 0,
          ],
        );
        return rows[0];
      }
    } else {
      this.logger.warn('CdssService not available — recording abstention');
    }

    const rows = await db.query(
      `INSERT INTO radiology_ai_findings
         (study_id, patient_id, requested_by, cdss_raw_response, findings,
          urgency, modality, body_part, overall_confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        studyId, patientId, requestedBy,
        JSON.stringify(cdssResponse ?? {}),
        JSON.stringify(findings),
        urgency,
        meta?.modality ?? null,
        meta?.bodyPart ?? null,
        confidence,
      ],
    );
    const record = rows[0];

    // Send alert for high-urgency findings
    if (['HIGH', 'CRITICAL'].includes(urgency) && this.alertDelivery) {
      try {
        await this.alertDelivery.broadcastCriticalAlert(subdomain, {
          alertType: 'radiology_urgent_finding',
          sourceEntityId: record.id,
          patientId,
          severity: urgency === 'CRITICAL' ? 'critical' : 'urgent',
          message: `Radiology AI: ${urgency} urgency finding for study ${studyId}`,
          payload: { studyId, urgency, confidence },
        });
        await db.query(
          `UPDATE radiology_ai_findings SET alert_sent = true WHERE id = $1`,
          [record.id],
        );
      } catch (alertErr) {
        this.logger.warn(`Alert delivery failed: ${alertErr.message}`);
      }
    }

    return record;
  }

  async getFindingsByStudy(studyId: string, db: any): Promise<unknown> {
    const rows = await db.query(
      `SELECT * FROM radiology_ai_findings WHERE study_id = $1 LIMIT 1`,
      [studyId],
    );
    return rows[0] ?? null;
  }

  async reviewFinding(
    findingId: string,
    reviewerId: string,
    status: 'confirmed' | 'rejected' | 'needs_review',
    comment: string | undefined,
    db: any,
  ): Promise<unknown> {
    const rows = await db.query(
      `UPDATE radiology_ai_findings
       SET radiologist_review_status = $2,
           reviewed_by = $3,
           reviewed_at = now(),
           reviewer_comment = $4,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [findingId, status, reviewerId, comment ?? null],
    );
    return rows[0] ?? null;
  }

  async getPatientRadiologyHistory(patientId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT raf.*, ir.study_date, ir.description AS study_description
       FROM radiology_ai_findings raf
       LEFT JOIN imaging_requests ir ON ir.id::text = raf.study_id::text
       WHERE raf.patient_id = $1
       ORDER BY raf.created_at DESC
       LIMIT 20`,
      [patientId],
    );
  }
}
```

---

## 3. Backend — RadiologyAiController

Create `services/ehr-service/src/controllers/radiology-ai.controller.ts`:

```typescript
import {
  Controller, Get, Post, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RadiologyAiService } from '../services/radiology-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('radiology')
export class RadiologyAiController {
  constructor(private readonly radiologyAi: RadiologyAiService) {}

  @Post('studies/:studyId/analyse')
  async analyseStudy(
    @Param('studyId') studyId: string,
    @Body() body: { patientId: string; modality?: string; bodyPart?: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.radiologyAi.analyseStudy(
      studyId,
      body.patientId,
      req.user.sub,
      req.tenantDb,
      req.tenantSubdomain ?? '',
      { modality: body.modality, bodyPart: body.bodyPart },
    );
  }

  @Get('studies/:studyId/ai-findings')
  async getFindings(
    @Param('studyId') studyId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.radiologyAi.getFindingsByStudy(studyId, req.tenantDb);
  }

  @Patch('ai-findings/:findingId/review')
  async reviewFinding(
    @Param('findingId') findingId: string,
    @Body() body: { status: 'confirmed' | 'rejected' | 'needs_review'; comment?: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.radiologyAi.reviewFinding(
      findingId,
      req.user.sub,
      body.status,
      body.comment,
      req.tenantDb,
    );
  }

  @Get('patients/:patientId/history')
  async getHistory(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.radiologyAi.getPatientRadiologyHistory(patientId, req.tenantDb);
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { RadiologyAiService } from './services/radiology-ai.service';
import { RadiologyAiController } from './controllers/radiology-ai.controller';

// In @Module:
controllers: [ /* ...existing... */ RadiologyAiController ],
providers: [ /* ...existing... */ RadiologyAiService ],
```

---

## 5. EHR Frontend — RadiologyAiFindingsPanel

Create `ehr-frontend/src/components/RadiologyAiFindingsPanel.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Finding {
  description: string;
  confidence: number;
  region?: string;
}

interface AiFindingRecord {
  id: string;
  urgency: string;
  findings: Finding[];
  overall_confidence: number;
  radiologist_review_status: string;
  modality?: string;
}

interface Props {
  studyId: string;
  patientId: string;
}

export const RadiologyAiFindingsPanel: React.FC<Props> = ({ studyId, patientId }) => {
  const [data, setData] = useState<AiFindingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState('');

  useEffect(() => {
    loadFindings();
  }, [studyId]);

  const loadFindings = async () => {
    setLoading(true);
    try {
      // Try to get cached, trigger analysis if missing
      let res = await api.get(`/radiology/studies/${studyId}/ai-findings`);
      if (!res.data) {
        res = await api.post(`/radiology/studies/${studyId}/analyse`, { patientId });
      }
      setData(res.data);
      setReviewStatus(res.data?.radiologist_review_status ?? 'pending');
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (status: 'confirmed' | 'rejected' | 'needs_review') => {
    if (!data) return;
    await api.patch(`/radiology/ai-findings/${data.id}/review`, { status });
    setReviewStatus(status);
  };

  const urgencyColors: Record<string, string> = {
    CRITICAL: '#dc2626',
    HIGH: '#f97316',
    MEDIUM: '#d97706',
    LOW: '#2563eb',
    ROUTINE: '#16a34a',
  };

  if (loading) {
    return (
      <div style={{ padding: 16, color: '#6b7280', fontSize: 13 }}>
        Analysing imaging study...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8,
        color: '#6b7280', fontSize: 13, textAlign: 'center',
      }}>
        AI Unavailable
      </div>
    );
  }

  const findings: Finding[] = Array.isArray(data.findings) ? data.findings : [];

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>AI Radiology Findings</span>
        <span style={{
          fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 12,
          backgroundColor: urgencyColors[data.urgency] + '20',
          color: urgencyColors[data.urgency],
        }}>
          {data.urgency}
        </span>
      </div>

      {data.overall_confidence > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Overall Confidence: {Math.round(data.overall_confidence * 100)}%
          </span>
          <div style={{
            marginTop: 4, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3,
          }}>
            <div style={{
              height: 6, borderRadius: 3,
              width: `${Math.round(data.overall_confidence * 100)}%`,
              backgroundColor: data.overall_confidence > 0.8 ? '#16a34a' : '#f97316',
            }} />
          </div>
        </div>
      )}

      {findings.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No significant findings detected.</p>
      ) : (
        <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
          {findings.map((f, i) => (
            <li key={i} style={{ marginBottom: 8, fontSize: 13 }}>
              <span>{f.description}</span>
              {f.region && <span style={{ color: '#9ca3af', marginLeft: 6 }}>({f.region})</span>}
              {f.confidence > 0 && (
                <span style={{ marginLeft: 8, color: '#2563eb', fontWeight: 600 }}>
                  {Math.round(f.confidence * 100)}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
        <span style={{ fontSize: 12, color: '#6b7280', marginRight: 8 }}>
          Radiologist Review:
        </span>
        {reviewStatus !== 'pending' ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
            {reviewStatus.toUpperCase()}
          </span>
        ) : (
          <span>
            {(['confirmed', 'rejected', 'needs_review'] as const).map((s) => (
              <button
                key={s}
                onClick={() => submitReview(s)}
                style={{
                  marginRight: 6, padding: '3px 10px', fontSize: 12,
                  borderRadius: 6, border: '1px solid #d1d5db',
                  cursor: 'pointer', backgroundColor: 'white',
                }}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
};
```

Import and render `<RadiologyAiFindingsPanel studyId={study.id} patientId={study.patient_id} />` inside the existing radiology study detail view in `EHRDashboard.tsx` or the radiology module page.

---

## 6. i18n Keys — All 8 Locales

### `en.json`:
```json
"radiology_ai": {
  "panel_title": "AI Radiology Findings",
  "urgency_critical": "Critical",
  "urgency_high": "High",
  "urgency_routine": "Routine",
  "no_findings": "No significant findings detected.",
  "ai_unavailable": "AI Unavailable",
  "confidence": "Confidence",
  "review_confirm": "confirm",
  "review_reject": "reject",
  "review_needs": "needs review",
  "analysing": "Analysing imaging study..."
}
```

### `sn.json`:
```json
"radiology_ai": {
  "panel_title": "Zvinotariswa neAI muRadiology",
  "urgency_critical": "Kudiwa Kwakanyanya",
  "urgency_high": "Kukwirira",
  "urgency_routine": "Pakutanga",
  "no_findings": "Hapana zvinotariswa zvakawanwa.",
  "ai_unavailable": "AI Haikwanisi",
  "confidence": "Chivimbo",
  "review_confirm": "simbisa",
  "review_reject": "ramba",
  "review_needs": "inoda kuonekwa",
  "analysing": "Kuyera mufananidzo..."
}
```

### `nd.json`:
```json
"radiology_ai": {
  "panel_title": "Imiphumela ye-AI ye-Radiology",
  "urgency_critical": "Isikhulu kakhulu",
  "urgency_high": "Ephezulu",
  "urgency_routine": "Okujwayelekile",
  "no_findings": "Azikho izimpawu ezibalulekile ezinotholakaliyo.",
  "ai_unavailable": "I-AI ayitholakali",
  "confidence": "Ukuqiniseka",
  "review_confirm": "qinisekisa",
  "review_reject": "nqaba",
  "review_needs": "idinga ukuphenywa",
  "analysing": "Kuhlahlwa isifundo sokuqwashisa..."
}
```

### `pt.json`:
```json
"radiology_ai": {
  "panel_title": "Achados de IA em Radiologia",
  "urgency_critical": "Crítico",
  "urgency_high": "Alto",
  "urgency_routine": "Rotina",
  "no_findings": "Nenhum achado significativo detectado.",
  "ai_unavailable": "IA Indisponível",
  "confidence": "Confiança",
  "review_confirm": "confirmar",
  "review_reject": "rejeitar",
  "review_needs": "necessita revisão",
  "analysing": "Analisando o estudo de imagem..."
}
```

### `fr.json`:
```json
"radiology_ai": {
  "panel_title": "Résultats IA en Radiologie",
  "urgency_critical": "Critique",
  "urgency_high": "Élevé",
  "urgency_routine": "Routine",
  "no_findings": "Aucun résultat significatif détecté.",
  "ai_unavailable": "IA Indisponible",
  "confidence": "Confiance",
  "review_confirm": "confirmer",
  "review_reject": "rejeter",
  "review_needs": "nécessite un examen",
  "analysing": "Analyse de l'étude d'imagerie..."
}
```

### `sw.json`:
```json
"radiology_ai": {
  "panel_title": "Matokeo ya AI ya Radiolojia",
  "urgency_critical": "Muhimu sana",
  "urgency_high": "Juu",
  "urgency_routine": "Kawaida",
  "no_findings": "Hakuna matokeo muhimu yaliyogunduliwa.",
  "ai_unavailable": "AI Haipatikani",
  "confidence": "Imani",
  "review_confirm": "thibitisha",
  "review_reject": "kataa",
  "review_needs": "inahitaji ukaguzi",
  "analysing": "Inachambua uchunguzi wa picha..."
}
```

### `zu.json`:
```json
"radiology_ai": {
  "panel_title": "Imiphumela ye-AI ye-Radioloji",
  "urgency_critical": "Ebalulekile kakhulu",
  "urgency_high": "Ephezulu",
  "urgency_routine": "Okujwayelekile",
  "no_findings": "Awekho amatholakalo abalulekile atholakele.",
  "ai_unavailable": "I-AI ayitholakali",
  "confidence": "Ukuqiniseka",
  "review_confirm": "qinisekisa",
  "review_reject": "nqaba",
  "review_needs": "idinga ukuhlolwa",
  "analysing": "Kuhlahlwa ucwaningo lwezithombe..."
}
```

### `af.json`:
```json
"radiology_ai": {
  "panel_title": "KI Radiologie-bevindinge",
  "urgency_critical": "Krities",
  "urgency_high": "Hoog",
  "urgency_routine": "Roetine",
  "no_findings": "Geen beduidende bevindinge opgespoor nie.",
  "ai_unavailable": "KI Nie Beskikbaar",
  "confidence": "Vertroue",
  "review_confirm": "bevestig",
  "review_reject": "verwerp",
  "review_needs": "benodig hersiening",
  "analysing": "Beeldstudie word geanaliseer..."
}
```

---

## 7. Jest Spec

Create `services/ehr-service/src/services/radiology-ai.service.spec.ts`:

```typescript
import { RadiologyAiService } from './radiology-ai.service';

function makeService(cdssOverride?: any, alertOverride?: any) {
  const cdss = cdssOverride ?? {
    radiologyAnalysis: jest.fn().mockResolvedValue({
      urgency: 'ROUTINE',
      findings: [{ description: 'No abnormality', confidence: 0.9 }],
      overallConfidence: 0.9,
    }),
  };
  const alert = alertOverride ?? {
    broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined),
  };
  return new RadiologyAiService(cdss, alert);
}

function makeDb(existing: any[] = [], insertReturn: any = { id: 'finding-1' }) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT') && sql.includes('radiology_ai_findings')) {
        return Promise.resolve(existing);
      }
      if (sql.includes('INSERT')) return Promise.resolve([insertReturn]);
      if (sql.includes('UPDATE')) return Promise.resolve([{ ...insertReturn }]);
      return Promise.resolve([]);
    }),
  };
}

describe('RadiologyAiService', () => {
  it('returns cached result if study already analysed', async () => {
    const svc = makeService();
    const cached = { id: 'f1', urgency: 'ROUTINE', findings: [] };
    const db = makeDb([cached]);
    const result = await svc.analyseStudy('study-1', 'p1', 'doc-1', db, 'test');
    expect(result).toEqual(cached);
  });

  it('calls CDSS and inserts new finding for new study', async () => {
    const svc = makeService();
    const db = makeDb([]);
    const result = await svc.analyseStudy('study-2', 'p1', 'doc-1', db, 'test');
    expect(result).toMatchObject({ id: 'finding-1' });
  });

  it('stores abstention row when CDSS throws', async () => {
    const cdss = { radiologyAnalysis: jest.fn().mockRejectedValue(new Error('timeout')) };
    const svc = makeService(cdss);
    const db = makeDb([]);
    const result = await svc.analyseStudy('study-3', 'p1', 'doc-1', db, 'test');
    expect(result).toMatchObject({ id: 'finding-1' });
    const insertCall = (db.query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT'));
    expect(insertCall).toBeTruthy();
    expect(insertCall[1]).toContain('ROUTINE');
  });

  it('broadcasts alert when urgency is CRITICAL', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const cdss = {
      radiologyAnalysis: jest.fn().mockResolvedValue({
        urgency: 'CRITICAL', findings: [], overallConfidence: 0.95,
      }),
    };
    const svc = makeService(cdss, alert);
    const db = makeDb([]);
    await svc.analyseStudy('study-4', 'p1', 'doc-1', db, 'clinic1');
    expect(alert.broadcastCriticalAlert).toHaveBeenCalledWith(
      'clinic1',
      expect.objectContaining({ severity: 'critical' }),
    );
  });

  it('does not broadcast for ROUTINE urgency', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(undefined, alert);
    const db = makeDb([]);
    await svc.analyseStudy('study-5', 'p1', 'doc-1', db, 'clinic1');
    expect(alert.broadcastCriticalAlert).not.toHaveBeenCalled();
  });

  it('reviewFinding updates status', async () => {
    const svc = makeService();
    const db = makeDb();
    const result = await svc.reviewFinding('f1', 'doc-1', 'confirmed', 'Verified', db);
    expect(result).toMatchObject({ id: 'finding-1' });
  });

  it('getPatientRadiologyHistory returns array', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ id: 'f1' }]) };
    const result = await svc.getPatientRadiologyHistory('p1', db);
    expect(result).toHaveLength(1);
  });
});
```

---

## 8. Definition of Done

- [ ] `radiology_ai_findings` table provisioned and repair passes
- [ ] `RadiologyAiService` and `RadiologyAiController` registered in `ehr.module.ts`
- [ ] `POST /radiology/studies/:studyId/analyse` returns findings
- [ ] `GET /radiology/studies/:studyId/ai-findings` returns cached findings
- [ ] `PATCH /radiology/ai-findings/:findingId/review` updates review status
- [ ] CRITICAL/HIGH findings trigger `broadcastCriticalAlert`
- [ ] CDSS unavailability returns graceful abstention row (no 500)
- [ ] `RadiologyAiFindingsPanel` imported and rendered in EHR radiology module
- [ ] `tsc --noEmit` passes in `services/ehr-service/` and `ehr-frontend/`
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
