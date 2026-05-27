# S174 — AI Lab Interpretation Narratives

**Phase:** 2 — AI Intelligence Amplification  
**Effort:** M  
**Depends on:** S173  
**Goal:** When a lab result is filed, the AI generates two plain-language narratives: one for the clinician (technical interpretation with differentials) and one for the patient (plain-language explanation). Both appear automatically on the result view — no extra clicks required.

---

## Problem

Lab results are filed as raw numbers with reference ranges. Clinicians must manually interpret them; patients receive numbers they cannot understand. The CDSS can interpret these values but is never called on lab result creation.

---

## Acceptance Criteria

1. When a `lab_result` row is inserted or updated with status `resulted`, an AI narrative is generated.
2. Two narratives are stored: `clinician_narrative` and `patient_narrative`.
3. EHR lab results view shows the clinician narrative inline under each result.
4. Patient portal shows the patient narrative on the lab results page.
5. Mobile app shows patient narrative with a plain-language expandable section.
6. If CDSS is unavailable, both narratives default to "Interpretation pending — please consult your clinician."
7. Critical/panic values trigger `broadcastCriticalAlert`.
8. `GET /labs/results/:resultId/narrative` returns both narratives.
9. Narratives are regenerated if a result is amended.
10. `tsc --noEmit` and lint pass.

---

## 1. Database Provisioning

```typescript
{
  id: 'lab_ai_narratives',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS lab_ai_narratives (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      result_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      clinician_narrative TEXT NOT NULL DEFAULT '',
      patient_narrative TEXT NOT NULL DEFAULT '',
      key_findings JSONB NOT NULL DEFAULT '[]',
      has_critical_value BOOLEAN NOT NULL DEFAULT false,
      alert_sent BOOLEAN NOT NULL DEFAULT false,
      model_version VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(result_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lan_result ON lab_ai_narratives(result_id)`,
    `CREATE INDEX IF NOT EXISTS idx_lan_patient ON lab_ai_narratives(patient_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_lan_critical ON lab_ai_narratives(has_critical_value) WHERE has_critical_value = true`,
  ],
},
```

---

## 2. Backend — LabAiNarrativeService

Create `services/ehr-service/src/services/lab-ai-narrative.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { CdssService } from './cdss.service';
import { AlertDeliveryService } from './alert-delivery.service';
import { AbstentionLogService } from './abstention-log.service';

const ABSTENTION_NARRATIVE =
  'Interpretation pending — please consult your clinician.';

@Injectable()
export class LabAiNarrativeService {
  private readonly logger = new Logger(LabAiNarrativeService.name);

  constructor(
    @Optional() private readonly cdss: CdssService,
    @Optional() private readonly alertDelivery: AlertDeliveryService,
    @Optional() private readonly abstentionLog: AbstentionLogService,
  ) {}

  async generateNarrative(
    resultId: string,
    patientId: string,
    db: any,
    subdomain: string,
  ): Promise<unknown> {
    // Fetch the result with panel data
    const results = await db.query(
      `SELECT lr.*, lp.name AS panel_name
       FROM lab_results lr
       LEFT JOIN lab_panels lp ON lp.id = lr.panel_id
       WHERE lr.id = $1`,
      [resultId],
    );
    const result = results[0] ?? null;
    if (!result) throw new Error(`Lab result ${resultId} not found`);

    // Fetch patient demographics for context
    const patients = await db.query(
      `SELECT first_name, last_name, date_of_birth, sex
       FROM patients WHERE id = $1`,
      [patientId],
    );
    const patient = patients[0] ?? {};

    let clinicianNarrative = ABSTENTION_NARRATIVE;
    let patientNarrative = ABSTENTION_NARRATIVE;
    let keyFindings: unknown[] = [];
    let hasCritical = false;

    if (this.cdss) {
      try {
        const interpretation = await this.cdss.interpretLabResult({
          resultId,
          patientId,
          testName: result.test_name ?? result.panel_name,
          value: result.value,
          unit: result.unit,
          referenceRange: result.reference_range,
          flag: result.flag,
          patientAge: this.calcAge(patient.date_of_birth),
          patientSex: patient.sex,
          previousValues: await this.getPreviousValues(patientId, result.test_name, db),
        });

        clinicianNarrative = interpretation?.clinicianNarrative ?? ABSTENTION_NARRATIVE;
        patientNarrative = interpretation?.patientNarrative ?? ABSTENTION_NARRATIVE;
        keyFindings = interpretation?.keyFindings ?? [];
        hasCritical = interpretation?.hasCriticalValue ?? false;
      } catch (err) {
        this.logger.warn(`CDSS lab interpretation failed: ${err.message}`);
        if (this.abstentionLog) {
          await this.abstentionLog.log(db, 'lab_interpretation', 'cdss_error', {
            patientId,
            errorDetail: err.message,
          });
        }
      }
    } else {
      if (this.abstentionLog) {
        await this.abstentionLog.log(db, 'lab_interpretation', 'not_configured', { patientId });
      }
    }

    // Detect critical flags even without CDSS
    if (['HH', 'LL', 'critical'].includes(result.flag)) hasCritical = true;

    // Upsert narrative
    const rows = await db.query(
      `INSERT INTO lab_ai_narratives
         (result_id, patient_id, clinician_narrative, patient_narrative,
          key_findings, has_critical_value)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (result_id) DO UPDATE SET
         clinician_narrative = EXCLUDED.clinician_narrative,
         patient_narrative = EXCLUDED.patient_narrative,
         key_findings = EXCLUDED.key_findings,
         has_critical_value = EXCLUDED.has_critical_value,
         updated_at = now()
       RETURNING *`,
      [
        resultId, patientId, clinicianNarrative, patientNarrative,
        JSON.stringify(keyFindings), hasCritical,
      ],
    );
    const record = rows[0];

    // Send critical alert
    if (hasCritical && !result.alert_sent && this.alertDelivery) {
      try {
        await this.alertDelivery.broadcastCriticalAlert(subdomain, {
          alertType: 'critical_lab_value',
          sourceEntityId: resultId,
          patientId,
          severity: 'critical',
          message: `Critical lab value: ${result.test_name} = ${result.value} ${result.unit ?? ''} (${result.flag})`,
          payload: { resultId, testName: result.test_name, value: result.value, flag: result.flag },
        });
        await db.query(
          `UPDATE lab_ai_narratives SET alert_sent = true WHERE id = $1`,
          [record.id],
        );
      } catch (alertErr) {
        this.logger.warn(`Critical lab alert failed: ${alertErr.message}`);
      }
    }

    return record;
  }

  async getNarrative(resultId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM lab_ai_narratives WHERE result_id = $1`,
      [resultId],
    );
    return rows[0] ?? null;
  }

  private calcAge(dob?: string): number | null {
    if (!dob) return null;
    const born = new Date(dob);
    const now = new Date();
    return Math.floor((now.getTime() - born.getTime()) / (365.25 * 24 * 3600 * 1000));
  }

  private async getPreviousValues(
    patientId: string,
    testName: string,
    db: any,
  ): Promise<Array<{ value: string; resultedAt: string }>> {
    const rows = await db.query(
      `SELECT value, resulted_at FROM lab_results
       WHERE patient_id = $1 AND test_name = $2 AND status = 'resulted'
       ORDER BY resulted_at DESC LIMIT 5`,
      [patientId, testName],
    );
    return rows.map((r: any) => ({ value: r.value, resultedAt: r.resulted_at }));
  }
}
```

---

## 3. Backend — LabNarrativeController

Create `services/ehr-service/src/controllers/lab-narrative.controller.ts`:

```typescript
import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { LabAiNarrativeService } from '../services/lab-ai-narrative.service';

@Controller('labs')
export class LabNarrativeController {
  constructor(private readonly narrativeSvc: LabAiNarrativeService) {}

  // Staff: get or generate narrative for a result
  @UseGuards(JwtAuthGuard)
  @Get('results/:resultId/narrative')
  async getNarrative(
    @Param('resultId') resultId: string,
    @Req() req: any,
  ): Promise<unknown> {
    let narrative = await this.narrativeSvc.getNarrative(resultId, req.tenantDb);
    if (!narrative) {
      // Trigger generation if not yet created
      const results = await req.tenantDb.query(
        `SELECT patient_id FROM lab_results WHERE id = $1`,
        [resultId],
      );
      if (results.length > 0) {
        narrative = await this.narrativeSvc.generateNarrative(
          resultId,
          results[0].patient_id,
          req.tenantDb,
          req.tenantSubdomain ?? '',
        );
      }
    }
    return narrative;
  }

  // Staff: force regenerate
  @UseGuards(JwtAuthGuard)
  @Post('results/:resultId/regenerate-narrative')
  async regenerate(
    @Param('resultId') resultId: string,
    @Req() req: any,
  ): Promise<unknown> {
    const results = await req.tenantDb.query(
      `SELECT patient_id FROM lab_results WHERE id = $1`,
      [resultId],
    );
    if (!results.length) return { error: 'Result not found' };
    return this.narrativeSvc.generateNarrative(
      resultId,
      results[0].patient_id,
      req.tenantDb,
      req.tenantSubdomain ?? '',
    );
  }

  // Patient portal: get patient-facing narrative
  @UseGuards(PatientJwtAuthGuard)
  @Get('patient/results/:resultId/narrative')
  async getPatientNarrative(
    @Param('resultId') resultId: string,
    @Req() req: any,
  ): Promise<{ patientNarrative: string; hasCriticalValue: boolean }> {
    const narrative: any = await this.narrativeSvc.getNarrative(resultId, req.tenantDb);
    return {
      patientNarrative: narrative?.patient_narrative ?? 'Interpretation pending.',
      hasCriticalValue: narrative?.has_critical_value ?? false,
    };
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { LabAiNarrativeService } from './services/lab-ai-narrative.service';
import { LabNarrativeController } from './controllers/lab-narrative.controller';

controllers: [ /* ...existing... */ LabNarrativeController ],
providers: [ /* ...existing... */ LabAiNarrativeService ],
```

---

## 5. EHR Frontend — Lab Narrative Inline Panel

In the existing lab results table/list, after each result row, add a collapsible section:

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';
import { AiStatusBadge } from './AiStatusBadge';

interface Props { resultId: string; }

export const LabNarrativePanel: React.FC<Props> = ({ resultId }) => {
  const [narrative, setNarrative] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (narrative) { setOpen(!open); return; }
    setLoading(true);
    try {
      const res = await api.get(`/labs/results/${resultId}/narrative`);
      setNarrative(res.data);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={load}
        style={{
          fontSize: 12, color: '#2563eb', background: 'none',
          border: 'none', cursor: 'pointer', padding: '2px 0',
        }}
      >
        {loading ? 'Loading AI interpretation...' : open ? '▲ Hide AI Interpretation' : '▼ View AI Interpretation'}
      </button>

      {open && narrative && (
        <div style={{
          marginTop: 8, padding: 12, backgroundColor: '#f0f9ff',
          borderRadius: 8, borderLeft: '3px solid #2563eb', fontSize: 13,
        }}>
          {narrative.has_critical_value && (
            <div style={{
              marginBottom: 8, padding: '4px 10px',
              backgroundColor: '#fee2e2', color: '#dc2626',
              borderRadius: 6, fontWeight: 700, fontSize: 12,
            }}>
              CRITICAL VALUE — Immediate clinical attention required
            </div>
          )}
          <p style={{ marginBottom: 0 }}>{narrative.clinician_narrative}</p>
        </div>
      )}

      {open && !narrative && (
        <AiStatusBadge status="unavailable" reason="Narrative not available" compact />
      )}
    </div>
  );
};
```

---

## 6. Patient Portal — Plain Language Narrative

In `patient-portal/src/pages/LabResultsPage.tsx`, add under each result:

```tsx
const [narratives, setNarratives] = useState<Record<string, string>>({});

const loadNarrative = async (resultId: string) => {
  if (narratives[resultId]) return;
  try {
    const res = await api.get(`/labs/patient/results/${resultId}/narrative`);
    setNarratives((prev) => ({
      ...prev,
      [resultId]: res.data.patientNarrative,
    }));
  } catch {
    setNarratives((prev) => ({
      ...prev,
      [resultId]: 'Interpretation pending — please consult your clinician.',
    }));
  }
};

// In result row:
<details onToggle={() => loadNarrative(result.id)}>
  <summary style={{ cursor: 'pointer', color: '#2563eb', fontSize: 13 }}>
    What does this mean?
  </summary>
  <p style={{ margin: '8px 0 0', fontSize: 13, color: '#374151' }}>
    {narratives[result.id] ?? 'Loading...'}
  </p>
</details>
```

---

## 7. Mobile — Lab Interpretation Expandable

In `mobile/src/screens/LabResultsScreen.tsx`:

```tsx
const [expandedId, setExpandedId] = useState<string | null>(null);
const [narratives, setNarratives] = useState<Record<string, string>>({});

const expand = async (resultId: string) => {
  setExpandedId(expandedId === resultId ? null : resultId);
  if (!narratives[resultId]) {
    try {
      const res = await api.get(`/labs/patient/results/${resultId}/narrative`);
      setNarratives((prev) => ({ ...prev, [resultId]: res.data.patientNarrative }));
    } catch {
      setNarratives((prev) => ({ ...prev, [resultId]: t('labs.interpretation_pending') }));
    }
  }
};

// In FlatList renderItem:
<TouchableOpacity onPress={() => expand(item.id)}>
  <Text style={{ fontFamily: FONT.ui, fontSize: 12, color: C.blue }}>
    {t('labs.what_does_this_mean')}
  </Text>
</TouchableOpacity>
{expandedId === item.id && (
  <View style={{
    marginTop: SPACING.xs, padding: SPACING.sm,
    backgroundColor: C.blue + '10', borderRadius: RADIUS.sm,
    borderLeftWidth: 3, borderLeftColor: C.blue,
  }}>
    <Text style={{ fontFamily: FONT.ui, fontSize: 13 }}>
      {narratives[item.id] ?? t('labs.loading')}
    </Text>
  </View>
)}
```

---

## 8. i18n Keys — All 8 Locales

### `en.json`:
```json
"labs": {
  "what_does_this_mean": "What does this mean?",
  "interpretation_pending": "Interpretation pending — please consult your clinician.",
  "critical_value_notice": "Critical value — immediate attention required",
  "loading": "Loading interpretation...",
  "ai_interpretation": "AI Interpretation",
  "hide_interpretation": "Hide interpretation"
}
```

### `sn.json`:
```json
"labs": {
  "what_does_this_mean": "Izvi zvinoreva chii?",
  "interpretation_pending": "Tsananguro ichiri kumirirwa — taura negurukota rako.",
  "critical_value_notice": "Kukosha kukuru — kutarisira kwakukurumidza kunodiwa",
  "loading": "Kugadzirira tsananguro...",
  "ai_interpretation": "Tsananguro yeAI",
  "hide_interpretation": "Viga tsananguro"
}
```

### `nd.json`:
```json
"labs": {
  "what_does_this_mean": "Lokhu kutsho ukuthini?",
  "interpretation_pending": "Incazelo ilindile — xoxisana nodokotela wakho.",
  "critical_value_notice": "Inani elibalulekile — kudingeleka ukunakekela okusheshayo",
  "loading": "Kulayisha incazelo...",
  "ai_interpretation": "Incazelo ye-AI",
  "hide_interpretation": "Fihla incazelo"
}
```

### `pt.json`:
```json
"labs": {
  "what_does_this_mean": "O que isso significa?",
  "interpretation_pending": "Interpretação pendente — consulte o seu clínico.",
  "critical_value_notice": "Valor crítico — atenção imediata necessária",
  "loading": "A carregar interpretação...",
  "ai_interpretation": "Interpretação IA",
  "hide_interpretation": "Ocultar interpretação"
}
```

### `fr.json`:
```json
"labs": {
  "what_does_this_mean": "Que signifie cela?",
  "interpretation_pending": "Interprétation en attente — consultez votre clinicien.",
  "critical_value_notice": "Valeur critique — attention immédiate requise",
  "loading": "Chargement de l'interprétation...",
  "ai_interpretation": "Interprétation IA",
  "hide_interpretation": "Masquer l'interprétation"
}
```

### `sw.json`:
```json
"labs": {
  "what_does_this_mean": "Hii inamaanisha nini?",
  "interpretation_pending": "Tafsiri inasubiri — wasiliana na daktari wako.",
  "critical_value_notice": "Thamani muhimu — umakini wa haraka unahitajika",
  "loading": "Inapakia tafsiri...",
  "ai_interpretation": "Tafsiri ya AI",
  "hide_interpretation": "Ficha tafsiri"
}
```

### `zu.json`:
```json
"labs": {
  "what_does_this_mean": "Lokhu kusho ukuthini?",
  "interpretation_pending": "Incazelo ilindile — xoxisana nodokotela wakho.",
  "critical_value_notice": "Inani elibalulekile — ukunakekela okusheshayo kuyadingeka",
  "loading": "Kulayisha incazelo...",
  "ai_interpretation": "Incazelo ye-AI",
  "hide_interpretation": "Fihla incazelo"
}
```

### `af.json`:
```json
"labs": {
  "what_does_this_mean": "Wat beteken dit?",
  "interpretation_pending": "Interpretasie hangende — raadpleeg u klinikus.",
  "critical_value_notice": "Kritiese waarde — onmiddellike aandag nodig",
  "loading": "Laai interpretasie...",
  "ai_interpretation": "KI-Interpretasie",
  "hide_interpretation": "Verberg interpretasie"
}
```

---

## 9. Jest Spec

Create `services/ehr-service/src/services/lab-ai-narrative.service.spec.ts`:

```typescript
import { LabAiNarrativeService } from './lab-ai-narrative.service';

function makeService(cdss?: any, alert?: any, abstention?: any) {
  return new LabAiNarrativeService(
    cdss ?? null,
    alert ?? null,
    abstention ?? null,
  );
}

function makeDb(result: any = null) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM lab_results lr')) return Promise.resolve(result ? [result] : []);
      if (sql.includes('FROM patients')) return Promise.resolve([{ first_name: 'J', date_of_birth: '1980-01-01', sex: 'M' }]);
      if (sql.includes('FROM lab_results') && sql.includes('ORDER BY')) return Promise.resolve([]);
      if (sql.includes('INSERT INTO lab_ai_narratives')) return Promise.resolve([{ id: 'n1', patient_narrative: 'Test result is normal.' }]);
      if (sql.includes('UPDATE lab_ai_narratives')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('LabAiNarrativeService', () => {
  const mockResult = {
    id: 'r1', patient_id: 'p1', test_name: 'Haemoglobin',
    value: '12', unit: 'g/dL', reference_range: '13-17', flag: 'L',
  };

  it('generates narrative via CDSS', async () => {
    const cdss = {
      interpretLabResult: jest.fn().mockResolvedValue({
        clinicianNarrative: 'Mild anaemia.',
        patientNarrative: 'Your haemoglobin is slightly low.',
        keyFindings: [],
        hasCriticalValue: false,
      }),
    };
    const svc = makeService(cdss);
    const db = makeDb(mockResult);
    await svc.generateNarrative('r1', 'p1', db, 'test');
    expect(cdss.interpretLabResult).toHaveBeenCalled();
  });

  it('returns abstention narrative when CDSS is null', async () => {
    const svc = makeService(null);
    const db = makeDb(mockResult);
    const result: any = await svc.generateNarrative('r1', 'p1', db, 'test');
    expect(result.patient_narrative).toBe('Test result is normal.'); // from mock insert return
  });

  it('sends critical alert for HH flag', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(null, alert);
    const db = makeDb({ ...mockResult, flag: 'HH' });
    await svc.generateNarrative('r1', 'p1', db, 'clinic1');
    expect(alert.broadcastCriticalAlert).toHaveBeenCalledWith(
      'clinic1',
      expect.objectContaining({ severity: 'critical' }),
    );
  });

  it('getNarrative returns null when no record', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getNarrative('r-none', db);
    expect(result).toBeNull();
  });
});
```

---

## 10. Definition of Done

- [ ] `lab_ai_narratives` table provisioned; repair passes
- [ ] `LabAiNarrativeService` and `LabNarrativeController` in `ehr.module.ts`
- [ ] `GET /labs/results/:id/narrative` returns both narratives
- [ ] `GET /labs/patient/results/:id/narrative` returns patient narrative only
- [ ] Critical flags (HH/LL) trigger `broadcastCriticalAlert`
- [ ] CDSS unavailability returns abstention text (no 500 error)
- [ ] EHR shows `LabNarrativePanel` on each result row
- [ ] Patient portal shows "What does this mean?" expandable
- [ ] Mobile expandable narrative section works
- [ ] `tsc --noEmit` passes everywhere
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
