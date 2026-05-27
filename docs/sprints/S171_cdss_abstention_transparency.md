# S171 — CDSS Abstention Transparency

**Phase:** 1 — Fix Broken Wires  
**Effort:** S  
**Depends on:** S170  
**Goal:** When the AI / CDSS cannot produce a recommendation (offline, low confidence, out-of-scope), every clinical screen shows a clear "AI Unavailable" or "AI Abstained" badge with a reason — instead of silently showing nothing, which clinicians misread as "AI found nothing wrong."

---

## Problem

When `CdssService` returns null, throws, or signals abstention, the EHR, patient portal, and mobile app all silently render empty panels. Clinicians interpret absence of AI output as "all clear." This is a patient-safety issue. The fix is: **always render a badge** when AI output is absent or degraded.

---

## Acceptance Criteria

1. A reusable `AiStatusBadge` component exists in the EHR frontend.
2. `AiStatusBadge` renders "AI Active", "AI Unavailable", or "AI Abstained" with color coding.
3. Every clinical panel that shows AI output uses `AiStatusBadge` when output is null/empty.
4. Backend: `GET /cdss/health` endpoint returns `{ status, latency, lastChecked }`.
5. Backend: All AI-producing services log abstentions to `ai_abstention_log` table.
6. Mobile: `AiStatusChip` component follows design tokens.
7. Patient portal: AI panels show "Analysis unavailable — your care team has been notified" when CDSS is down.
8. `tsc --noEmit` and lint pass.
9. No screen shows blank space where AI output would normally appear.
10. Abstention log records reason: `cdss_error`, `low_confidence`, `no_data`, `out_of_scope`.

---

## 1. Database Provisioning

```typescript
{
  id: 'ai_abstention_log',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS ai_abstention_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID,
      context VARCHAR(128) NOT NULL,
      reason VARCHAR(64) NOT NULL
        CHECK (reason IN ('cdss_error','low_confidence','no_data','out_of_scope','timeout','not_configured')),
      error_detail TEXT,
      requested_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_aal_patient
      ON ai_abstention_log(patient_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_aal_context
      ON ai_abstention_log(context, created_at DESC)`,
  ],
},
```

---

## 2. Backend — AbstentionLogService

Create `services/ehr-service/src/services/abstention-log.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

export type AbstentionReason = 'cdss_error' | 'low_confidence' | 'no_data' | 'out_of_scope' | 'timeout' | 'not_configured';

@Injectable()
export class AbstentionLogService {
  private readonly logger = new Logger(AbstentionLogService.name);

  async log(
    db: any,
    context: string,
    reason: AbstentionReason,
    options?: { patientId?: string; requestedBy?: string; errorDetail?: string },
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO ai_abstention_log (patient_id, context, reason, error_detail, requested_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          options?.patientId ?? null,
          context,
          reason,
          options?.errorDetail ?? null,
          options?.requestedBy ?? null,
        ],
      );
    } catch (err) {
      this.logger.warn(`Failed to log abstention: ${err.message}`);
    }
  }

  async getAbstentions(
    db: any,
    patientId?: string,
    limit = 20,
  ): Promise<unknown[]> {
    if (patientId) {
      return db.query(
        `SELECT * FROM ai_abstention_log
         WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [patientId, limit],
      );
    }
    return db.query(
      `SELECT * FROM ai_abstention_log ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
  }
}
```

---

## 3. Backend — CdssHealthController

Create `services/ehr-service/src/controllers/cdss-health.controller.ts`:

```typescript
import { Controller, Get, Optional, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CdssService } from '../services/cdss.service';

@UseGuards(JwtAuthGuard)
@Controller('cdss')
export class CdssHealthController {
  constructor(@Optional() private readonly cdss: CdssService) {}

  @Get('health')
  async getHealth(@Req() req: any): Promise<{
    status: string;
    latency: number | null;
    lastChecked: string;
    available: boolean;
  }> {
    if (!this.cdss) {
      return {
        status: 'not_configured',
        latency: null,
        lastChecked: new Date().toISOString(),
        available: false,
      };
    }

    const start = Date.now();
    try {
      await this.cdss.ping?.();
      return {
        status: 'ok',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString(),
        available: true,
      };
    } catch (err) {
      return {
        status: 'error',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString(),
        available: false,
      };
    }
  }

  @Get('abstentions')
  async getAbstentions(@Req() req: any): Promise<unknown[]> {
    return req.tenantDb.query(
      `SELECT context, reason, COUNT(*) as count
       FROM ai_abstention_log
       WHERE created_at > now() - INTERVAL '24 hours'
       GROUP BY context, reason
       ORDER BY count DESC`,
    );
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { AbstentionLogService } from './services/abstention-log.service';
import { CdssHealthController } from './controllers/cdss-health.controller';

controllers: [ /* ...existing... */ CdssHealthController ],
providers: [ /* ...existing... */ AbstentionLogService ],
```

---

## 5. EHR Frontend — AiStatusBadge Component

Create `ehr-frontend/src/components/AiStatusBadge.tsx`:

```tsx
import React from 'react';

export type AiStatus =
  | 'active'        // AI returned results
  | 'unavailable'   // CDSS down / network error
  | 'abstained'     // AI decided not to answer
  | 'low_confidence'// Result returned but confidence below threshold
  | 'loading';

interface Props {
  status: AiStatus;
  reason?: string;
  compact?: boolean;
}

const CONFIG: Record<AiStatus, { label: string; color: string; bg: string; icon: string }> = {
  active:         { label: 'AI Active',         color: '#16a34a', bg: '#dcfce7', icon: '●' },
  unavailable:    { label: 'AI Unavailable',    color: '#dc2626', bg: '#fee2e2', icon: '✕' },
  abstained:      { label: 'AI Abstained',      color: '#f97316', bg: '#ffedd5', icon: '○' },
  low_confidence: { label: 'Low Confidence',    color: '#d97706', bg: '#fef9c3', icon: '◐' },
  loading:        { label: 'AI Analysing...',   color: '#2563eb', bg: '#dbeafe', icon: '⟳' },
};

export const AiStatusBadge: React.FC<Props> = ({ status, reason, compact = false }) => {
  const cfg = CONFIG[status];
  return (
    <span
      title={reason}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '1px 6px' : '3px 10px',
        borderRadius: 12,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        backgroundColor: cfg.bg,
        color: cfg.color,
        cursor: reason ? 'help' : 'default',
      }}
    >
      <span style={{ fontSize: compact ? 8 : 10 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};
```

### Usage in any AI panel

```tsx
// When CDSS response is null:
<AiStatusBadge status="unavailable" reason="CDSS service unreachable" />

// When AI answered:
<AiStatusBadge status="active" />

// When confidence < 0.6:
<AiStatusBadge status="low_confidence" reason="Confidence below threshold" />
```

Add `AiStatusBadge` to these existing panels:
- `RadiologyAiFindingsPanel` (S170) — replace empty state
- Encounter Copilot sidebar
- NEWS2/OI alert panel (S166)
- Post-visit AI panel
- Drug interaction checker

---

## 6. Patient Portal — Abstention Message

In any patient-facing AI panel (lab interpretation, post-visit summary), replace blank render with:

```tsx
{!aiData && (
  <div style={{
    padding: 16, backgroundColor: '#fff7ed', borderRadius: 8,
    border: '1px solid #fed7aa', color: '#9a3412', fontSize: 13,
  }}>
    Analysis unavailable — your care team has been notified.
  </div>
)}
```

---

## 7. Mobile — AiStatusChip

Create `mobile/src/components/AiStatusChip.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../design/tokens';

type Status = 'active' | 'unavailable' | 'abstained' | 'loading';

interface Props { status: Status; }

const CHIP_COLORS: Record<Status, { bg: string; text: string }> = {
  active:      { bg: C.green + '20', text: C.green },
  unavailable: { bg: C.red + '20',   text: C.red   },
  abstained:   { bg: C.amber + '20', text: C.amber  },
  loading:     { bg: C.blue + '20',  text: C.blue   },
};

const CHIP_LABELS: Record<Status, string> = {
  active:      'AI Active',
  unavailable: 'AI Unavailable',
  abstained:   'AI Abstained',
  loading:     'Analysing…',
};

export const AiStatusChip: React.FC<Props> = ({ status }) => {
  const col = CHIP_COLORS[status];
  return (
    <View style={[styles.chip, { backgroundColor: col.bg }]}>
      <Text style={[styles.label, { color: col.text }]}>
        {CHIP_LABELS[status]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FONT.uiBd,
    fontSize: 11,
  },
});
```

Import and use `<AiStatusChip status="unavailable" />` on any mobile AI panel that receives no data.

---

## 8. i18n Keys — All 8 Locales

### `en.json`:
```json
"ai_status": {
  "active": "AI Active",
  "unavailable": "AI Unavailable",
  "abstained": "AI Abstained",
  "low_confidence": "Low Confidence",
  "loading": "Analysing...",
  "patient_notice": "Analysis unavailable — your care team has been notified."
}
```

### `sn.json`:
```json
"ai_status": {
  "active": "AI Inoshanda",
  "unavailable": "AI Haikwanisi",
  "abstained": "AI Yarega",
  "low_confidence": "Chivimbo Chishoma",
  "loading": "Kuyera...",
  "patient_notice": "Ongororo haikwanisi — timu yako yokurera yakuziviswa."
}
```

### `nd.json`:
```json
"ai_status": {
  "active": "I-AI Iyasebenza",
  "unavailable": "I-AI Ayitholakali",
  "abstained": "I-AI Yama",
  "low_confidence": "Ukuqiniseka Okuphansi",
  "loading": "Kuhlahlwa...",
  "patient_notice": "Ukuhlaziywa akutholakali — ithimba lakho lokunakekelwa laziswe."
}
```

### `pt.json`:
```json
"ai_status": {
  "active": "IA Ativa",
  "unavailable": "IA Indisponível",
  "abstained": "IA Absteve-se",
  "low_confidence": "Baixa Confiança",
  "loading": "A analisar...",
  "patient_notice": "Análise indisponível — a sua equipa de cuidados foi notificada."
}
```

### `fr.json`:
```json
"ai_status": {
  "active": "IA Active",
  "unavailable": "IA Indisponible",
  "abstained": "IA Abstenue",
  "low_confidence": "Confiance Faible",
  "loading": "Analyse en cours...",
  "patient_notice": "Analyse indisponible — votre équipe soignante a été notifiée."
}
```

### `sw.json`:
```json
"ai_status": {
  "active": "AI Inafanya kazi",
  "unavailable": "AI Haipatikani",
  "abstained": "AI Ilijiepusha",
  "low_confidence": "Imani ya Chini",
  "loading": "Inachambua...",
  "patient_notice": "Uchambuzi haupatikani — timu yako ya huduma imearifiwa."
}
```

### `zu.json`:
```json
"ai_status": {
  "active": "I-AI Iyasebenza",
  "unavailable": "I-AI Ayitholakali",
  "abstained": "I-AI Yazibamba",
  "low_confidence": "Ukuqiniseka Okuphansi",
  "loading": "Kuhlahlwa...",
  "patient_notice": "Ukuhlaziywa akutholakali — ithimba lakho lokunakekelwa liyaziwe."
}
```

### `af.json`:
```json
"ai_status": {
  "active": "KI Aktief",
  "unavailable": "KI Nie Beskikbaar",
  "abstained": "KI Onthoud",
  "low_confidence": "Lae Vertroue",
  "loading": "Ontleed...",
  "patient_notice": "Ontleding onbeskikbaar — u sorgspan is ingelig."
}
```

---

## 9. Jest Spec

Create `services/ehr-service/src/services/abstention-log.service.spec.ts`:

```typescript
import { AbstentionLogService } from './abstention-log.service';

describe('AbstentionLogService', () => {
  let svc: AbstentionLogService;
  let db: any;

  beforeEach(() => {
    svc = new AbstentionLogService();
    db = { query: jest.fn().mockResolvedValue([]) };
  });

  it('logs abstention with all fields', async () => {
    await svc.log(db, 'encounter_copilot', 'cdss_error', {
      patientId: 'p1',
      requestedBy: 'doc1',
      errorDetail: 'Connection timeout',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_abstention_log'),
      ['p1', 'encounter_copilot', 'cdss_error', 'Connection timeout', 'doc1'],
    );
  });

  it('does not throw if db.query fails', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    await expect(
      svc.log(db, 'radiology', 'timeout'),
    ).resolves.not.toThrow();
  });

  it('getAbstentions queries by patient if provided', async () => {
    db.query.mockResolvedValue([{ id: '1', reason: 'cdss_error' }]);
    const result = await svc.getAbstentions(db, 'p1');
    expect(result).toHaveLength(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE patient_id'),
      expect.any(Array),
    );
  });

  it('getAbstentions queries all if no patientId', async () => {
    db.query.mockResolvedValue([]);
    await svc.getAbstentions(db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY created_at DESC'),
      expect.any(Array),
    );
  });
});
```

---

## 10. Definition of Done

- [ ] `ai_abstention_log` table provisioned; repair passes
- [ ] `AbstentionLogService` and `CdssHealthController` registered in `ehr.module.ts`
- [ ] `GET /cdss/health` returns `{ status, available, latency, lastChecked }`
- [ ] `AiStatusBadge` component exists and used in at least 3 AI panels in EHR
- [ ] `AiStatusChip` component exists in mobile and used in AI panels
- [ ] Patient portal shows "Analysis unavailable" message when AI is absent
- [ ] All 9 AI panels never show blank space — always show status badge
- [ ] `tsc --noEmit` passes in `services/ehr-service/`, `ehr-frontend/`, and `patient-portal/`
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
