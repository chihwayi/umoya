# S182 — AI Treatment Gap & Care Opportunity Engine

**Phase:** 3 — System-Wide AI-First UX  
**Effort:** M  
**Depends on:** S181  
**Goal:** Automatically detect care gaps for every patient — missing screenings, overdue vaccinations, untreated conditions, lapsed follow-ups — and surface them as actionable cards in the EHR and mobile app with one-click ordering.

---

## Problem

Clinicians know care guidelines but cannot manually check every patient against every guideline at every visit. Preventable gaps go undetected. This sprint builds the engine that does it automatically.

---

## Acceptance Criteria

1. `GET /patients/:id/care-gaps` returns a list of detected care gaps with recommended actions.
2. Gaps are detected by rules: age/sex-based screenings, vaccine schedule, lapsed follow-up (>90 days), unmanaged chronic conditions.
3. Each gap includes: `type`, `description`, `priority`, `recommended_action`, `guidelineReference`.
4. EHR shows care gap cards in a right-side panel — each card has "Order" and "Dismiss" buttons.
5. Clicking "Order" pre-fills an order creation form for the recommended action.
6. Dismissed gaps are hidden for 30 days and logged.
7. Mobile shows care gap count badge on patient row and a tap-through list.
8. Gaps are refreshed daily by cron.
9. `tsc --noEmit` and lint pass.
10. i18n keys in all 8 locales.

---

## 1. Database Provisioning

```typescript
{
  id: 'care_gaps',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS care_gaps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      gap_type VARCHAR(64) NOT NULL,
      description TEXT NOT NULL,
      priority VARCHAR(16) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low','medium','high','critical')),
      recommended_action TEXT NOT NULL,
      guideline_reference VARCHAR(128),
      status VARCHAR(16) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','dismissed','resolved','ordered')),
      dismissed_at TIMESTAMPTZ,
      dismissed_by UUID,
      dismissed_until TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(patient_id, gap_type)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cg_patient ON care_gaps(patient_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_cg_open ON care_gaps(status, detected_at DESC) WHERE status = 'open'`,
  ],
},
```

---

## 2. Backend — CareGapEngine

Create `services/ehr-service/src/services/care-gap-engine.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

interface CareGap {
  gapType: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
  guidelineReference?: string;
}

@Injectable()
export class CareGapEngineService {
  private readonly logger = new Logger(CareGapEngineService.name);

  async detectGaps(patientId: string, db: any): Promise<CareGap[]> {
    const gaps: CareGap[] = [];

    const [patient, diagnoses, labs, vaccinations, encounters] = await Promise.all([
      db.query(`SELECT date_of_birth, sex FROM patients WHERE id = $1`, [patientId]),
      db.query(`SELECT icd10_code, description, status FROM patient_diagnoses WHERE patient_id = $1`, [patientId]),
      db.query(`SELECT test_name, resulted_at FROM lab_results WHERE patient_id = $1 AND status = 'resulted' ORDER BY resulted_at DESC`, [patientId]),
      db.query(`SELECT vaccine_name, administered_at FROM vaccinations WHERE patient_id = $1`, [patientId]),
      db.query(`SELECT status, created_at FROM encounters WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1`, [patientId]),
    ]);

    const pt = patient[0] ?? {};
    const age = pt.date_of_birth
      ? Math.floor((Date.now() - new Date(pt.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 0;
    const sex = pt.sex?.toUpperCase() ?? '';

    // Cervical cancer screening (women 25–65, no pap smear in last 3 years)
    if (sex === 'F' && age >= 25 && age <= 65) {
      const pap = labs.find((l: any) => /pap smear|cervical/i.test(l.test_name));
      const lastPap = pap ? new Date(pap.resulted_at) : null;
      const daysSincePap = lastPap ? (Date.now() - lastPap.getTime()) / (1000 * 3600 * 24) : Infinity;
      if (daysSincePap > 1095) {
        gaps.push({
          gapType: 'cervical_screening',
          description: 'Cervical cancer screening overdue (>3 years)',
          priority: 'high',
          recommendedAction: 'Order Pap smear or HPV DNA test',
          guidelineReference: 'WHO Cervical Cancer Screening Guidelines 2021',
        });
      }
    }

    // Diabetes monitoring: HbA1c every 3 months for diabetics
    const hasDiabetes = diagnoses.some((d: any) => /^E1[01]/.test(d.icd10_code ?? ''));
    if (hasDiabetes) {
      const hba1c = labs.find((l: any) => /hba1c|glycated|glycosylated/i.test(l.test_name));
      const lastHba1c = hba1c ? new Date(hba1c.resulted_at) : null;
      const daysSince = lastHba1c ? (Date.now() - lastHba1c.getTime()) / (1000 * 3600 * 24) : Infinity;
      if (daysSince > 90) {
        gaps.push({
          gapType: 'diabetes_hba1c',
          description: 'HbA1c not checked in last 90 days — required for diabetes management',
          priority: 'high',
          recommendedAction: 'Order HbA1c blood test',
          guidelineReference: 'ADA Standards of Diabetes Care 2024',
        });
      }
    }

    // HIV testing (adults 15–65, no HIV test in last 12 months)
    if (age >= 15 && age <= 65) {
      const hivTest = labs.find((l: any) => /hiv|rapid test/i.test(l.test_name));
      const lastHiv = hivTest ? new Date(hivTest.resulted_at) : null;
      const daysSince = lastHiv ? (Date.now() - lastHiv.getTime()) / (1000 * 3600 * 24) : Infinity;
      if (daysSince > 365) {
        gaps.push({
          gapType: 'hiv_screening',
          description: 'Annual HIV screening overdue',
          priority: 'medium',
          recommendedAction: 'Order HIV rapid test',
          guidelineReference: 'UNAIDS/WHO Testing Guidelines 2020',
        });
      }
    }

    // Flu vaccination (annual)
    const fluVax = vaccinations.find((v: any) => /influenza|flu/i.test(v.vaccine_name));
    const lastFlu = fluVax ? new Date(fluVax.administered_at) : null;
    const daysSinceFlu = lastFlu ? (Date.now() - lastFlu.getTime()) / (1000 * 3600 * 24) : Infinity;
    if (daysSinceFlu > 365) {
      gaps.push({
        gapType: 'flu_vaccination',
        description: 'Annual influenza vaccination overdue',
        priority: 'low',
        recommendedAction: 'Schedule influenza vaccination',
        guidelineReference: 'WHO Influenza Vaccination Policy',
      });
    }

    // Lapsed follow-up (>90 days since last encounter)
    const lastEncounter = encounters[0];
    if (lastEncounter) {
      const days = (Date.now() - new Date(lastEncounter.created_at).getTime()) / (1000 * 3600 * 24);
      if (days > 90) {
        gaps.push({
          gapType: 'lapsed_followup',
          description: `No clinical contact in ${Math.round(days)} days`,
          priority: days > 180 ? 'high' : 'medium',
          recommendedAction: 'Schedule follow-up appointment',
          guidelineReference: 'Internal care continuity standard',
        });
      }
    }

    return gaps;
  }

  async upsertGaps(patientId: string, gaps: CareGap[], db: any): Promise<void> {
    for (const gap of gaps) {
      await db.query(
        `INSERT INTO care_gaps
           (patient_id, gap_type, description, priority, recommended_action, guideline_reference)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (patient_id, gap_type) DO UPDATE SET
           description = EXCLUDED.description,
           priority = EXCLUDED.priority,
           recommended_action = EXCLUDED.recommended_action,
           detected_at = now()
         WHERE care_gaps.status = 'open'`,
        [patientId, gap.gapType, gap.description, gap.priority, gap.recommendedAction, gap.guidelineReference ?? null],
      );
    }
  }

  async getOpenGaps(patientId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT * FROM care_gaps
       WHERE patient_id = $1
         AND status = 'open'
         AND (dismissed_until IS NULL OR dismissed_until < now())
       ORDER BY
         CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
      [patientId],
    );
  }

  async dismissGap(gapId: string, dismissedBy: string, db: any): Promise<void> {
    await db.query(
      `UPDATE care_gaps
       SET status = 'dismissed', dismissed_by = $2,
           dismissed_at = now(),
           dismissed_until = now() + INTERVAL '30 days'
       WHERE id = $1`,
      [gapId, dismissedBy],
    );
  }

  async resolveGap(gapId: string, db: any): Promise<void> {
    await db.query(
      `UPDATE care_gaps SET status = 'resolved', resolved_at = now() WHERE id = $1`,
      [gapId],
    );
  }

  async refreshPatient(patientId: string, db: any): Promise<void> {
    const gaps = await this.detectGaps(patientId, db);
    await this.upsertGaps(patientId, gaps, db);
  }
}
```

---

## 3. Controller

Create `services/ehr-service/src/controllers/care-gap.controller.ts`:

```typescript
import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CareGapEngineService } from '../services/care-gap-engine.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class CareGapController {
  constructor(private readonly gapEngine: CareGapEngineService) {}

  @Get(':patientId/care-gaps')
  async getGaps(@Param('patientId') patientId: string, @Req() req: any): Promise<unknown[]> {
    let gaps = await this.gapEngine.getOpenGaps(patientId, req.tenantDb);
    if (gaps.length === 0) {
      await this.gapEngine.refreshPatient(patientId, req.tenantDb);
      gaps = await this.gapEngine.getOpenGaps(patientId, req.tenantDb);
    }
    return gaps;
  }

  @Post(':patientId/care-gaps/refresh')
  async refresh(@Param('patientId') patientId: string, @Req() req: any): Promise<{ ok: boolean }> {
    await this.gapEngine.refreshPatient(patientId, req.tenantDb);
    return { ok: true };
  }

  @Post('care-gaps/:gapId/dismiss')
  async dismiss(
    @Param('gapId') gapId: string,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.gapEngine.dismissGap(gapId, req.user.sub, req.tenantDb);
    return { ok: true };
  }

  @Post('care-gaps/:gapId/resolve')
  async resolve(@Param('gapId') gapId: string, @Req() req: any): Promise<{ ok: boolean }> {
    await this.gapEngine.resolveGap(gapId, req.tenantDb);
    return { ok: true };
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { CareGapEngineService } from './services/care-gap-engine.service';
import { CareGapController } from './controllers/care-gap.controller';

controllers: [ /* ...existing... */ CareGapController ],
providers: [ /* ...existing... */ CareGapEngineService ],
```

---

## 5. EHR Frontend — Care Gap Panel

Create `ehr-frontend/src/components/CareGapPanel.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface CareGap {
  id: string;
  gap_type: string;
  description: string;
  priority: string;
  recommended_action: string;
  guideline_reference?: string;
}

interface Props { patientId: string; onOrder?: (action: string) => void; }

export const CareGapPanel: React.FC<Props> = ({ patientId, onOrder }) => {
  const [gaps, setGaps] = useState<CareGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/patients/${patientId}/care-gaps`)
      .then((r) => setGaps(r.data ?? []))
      .catch(() => setGaps([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  const dismiss = async (gapId: string) => {
    await api.post(`/patients/care-gaps/${gapId}/dismiss`);
    setGaps((prev) => prev.filter((g) => g.id !== gapId));
  };

  const priorityColors: Record<string, string> = {
    critical: '#dc2626', high: '#f97316', medium: '#d97706', low: '#9ca3af',
  };

  if (loading) return <div style={{ padding: 12, color: '#6b7280', fontSize: 13 }}>Checking care gaps...</div>;
  if (gaps.length === 0) return (
    <div style={{ padding: 12, color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
      ✓ No care gaps detected
    </div>
  );

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
        Care Gaps ({gaps.length})
      </div>
      {gaps.map((gap) => (
        <div key={gap.id} style={{
          border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 8,
          borderLeftWidth: 3, borderLeftColor: priorityColors[gap.priority],
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{gap.description}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
              backgroundColor: priorityColors[gap.priority] + '20',
              color: priorityColors[gap.priority],
            }}>
              {gap.priority.toUpperCase()}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#2563eb', marginBottom: 6 }}>
            → {gap.recommended_action}
          </p>
          {gap.guideline_reference && (
            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
              {gap.guideline_reference}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {onOrder && (
              <button
                onClick={() => onOrder(gap.recommended_action)}
                style={{
                  padding: '4px 12px', backgroundColor: '#2563eb', color: 'white',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                }}
              >
                Order
              </button>
            )}
            <button
              onClick={() => dismiss(gap.id)}
              style={{
                padding: '4px 12px', backgroundColor: '#f3f4f6',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
              }}
            >
              Dismiss (30d)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## 6. Mobile — Care Gap Badge + List

In `mobile/src/screens/PatientDetailScreen.tsx`, show a count badge and a tappable list:

```tsx
const [careGaps, setCareGaps] = useState<any[]>([]);

useEffect(() => {
  api.get(`/patients/${patientId}/care-gaps`)
    .then((r) => setCareGaps(r.data ?? []))
    .catch(() => setCareGaps([]));
}, [patientId]);

{careGaps.length > 0 && (
  <View style={{ marginBottom: SPACING.md }}>
    <Text style={{ fontFamily: FONT.uiBd, fontSize: 14, marginBottom: SPACING.sm }}>
      {t('care_gaps.title')} ({careGaps.length})
    </Text>
    {careGaps.slice(0, 3).map((gap) => (
      <View key={gap.id} style={{
        padding: SPACING.sm, backgroundColor: C.bg,
        borderRadius: RADIUS.md, marginBottom: SPACING.xs,
        borderLeftWidth: 3,
        borderLeftColor: gap.priority === 'high' || gap.priority === 'critical' ? C.red : C.amber,
        ...SHADOW.sm,
      }}>
        <Text style={{ fontFamily: FONT.uiBd, fontSize: 12 }}>{gap.description}</Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 11, color: C.blue }}>
          → {gap.recommended_action}
        </Text>
      </View>
    ))}
  </View>
)}
```

---

## 7. i18n Keys — All 8 Locales

### `en.json`:
```json
"care_gaps": {
  "title": "Care Gaps",
  "no_gaps": "No care gaps detected",
  "order": "Order",
  "dismiss": "Dismiss (30d)",
  "high": "High",
  "medium": "Medium",
  "guideline": "Guideline"
}
```

### `sn.json`:
```json
"care_gaps": {
  "title": "Mikana yeUreri",
  "no_gaps": "Hapana mikana yakawanwa",
  "order": "Raira",
  "dismiss": "Siya (mazuva 30)",
  "high": "Kukwirira",
  "medium": "Pakati",
  "guideline": "Murayiridzo"
}
```

### `nd.json`:
```json
"care_gaps": {
  "title": "Izikhala Zokunakekela",
  "no_gaps": "Azikho izikhala ezinotholakaliyo",
  "order": "Lawula",
  "dismiss": "Yeka (izinsuku ezingama-30)",
  "high": "Ephezulu",
  "medium": "Ephakathi",
  "guideline": "Umhlahlandlela"
}
```

### `pt.json`:
```json
"care_gaps": {
  "title": "Lacunas de Cuidados",
  "no_gaps": "Nenhuma lacuna detectada",
  "order": "Pedir",
  "dismiss": "Ignorar (30 dias)",
  "high": "Alto",
  "medium": "Médio",
  "guideline": "Directriz"
}
```

### `fr.json`:
```json
"care_gaps": {
  "title": "Lacunes de Soins",
  "no_gaps": "Aucune lacune détectée",
  "order": "Commander",
  "dismiss": "Ignorer (30 jours)",
  "high": "Élevé",
  "medium": "Moyen",
  "guideline": "Directive"
}
```

### `sw.json`:
```json
"care_gaps": {
  "title": "Mapungufu ya Huduma",
  "no_gaps": "Mapungufu hayakugunduliwa",
  "order": "Agiza",
  "dismiss": "Kataa (siku 30)",
  "high": "Juu",
  "medium": "Kati",
  "guideline": "Mwongozo"
}
```

### `zu.json`:
```json
"care_gaps": {
  "title": "Izikhala Zokunakekela",
  "no_gaps": "Azikho izikhala ezinotholakaliyo",
  "order": "Layela",
  "dismiss": "Yeka (izinsuku ezingama-30)",
  "high": "Ephezulu",
  "medium": "Ephakathi",
  "guideline": "Umhlahlandlela"
}
```

### `af.json`:
```json
"care_gaps": {
  "title": "Sorggapings",
  "no_gaps": "Geen sorggapings opgespoor nie",
  "order": "Bestel",
  "dismiss": "Verwerp (30 dae)",
  "high": "Hoog",
  "medium": "Medium",
  "guideline": "Riglyn"
}
```

---

## 8. Jest Spec

Create `services/ehr-service/src/services/care-gap-engine.service.spec.ts`:

```typescript
import { CareGapEngineService } from './care-gap-engine.service';

function makeDb(overrides: Record<string, any> = {}) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients')) return Promise.resolve(overrides.patient ?? [{ date_of_birth: '1980-01-01', sex: 'F' }]);
      if (sql.includes('patient_diagnoses')) return Promise.resolve(overrides.diagnoses ?? []);
      if (sql.includes('FROM lab_results')) return Promise.resolve(overrides.labs ?? []);
      if (sql.includes('vaccinations')) return Promise.resolve(overrides.vaccinations ?? []);
      if (sql.includes('FROM encounters')) return Promise.resolve(overrides.encounters ?? []);
      if (sql.includes('INSERT INTO care_gaps')) return Promise.resolve([]);
      if (sql.includes('SELECT * FROM care_gaps')) return Promise.resolve(overrides.gaps ?? []);
      if (sql.includes('UPDATE care_gaps')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('CareGapEngineService', () => {
  let svc: CareGapEngineService;
  beforeEach(() => { svc = new CareGapEngineService(); });

  it('detects cervical screening gap for woman aged 45 with no pap smear', async () => {
    const db = makeDb({ patient: [{ date_of_birth: '1980-01-01', sex: 'F' }] });
    const gaps = await svc.detectGaps('p1', db);
    expect(gaps.find((g) => g.gapType === 'cervical_screening')).toBeTruthy();
  });

  it('does not flag cervical screening for male patient', async () => {
    const db = makeDb({ patient: [{ date_of_birth: '1980-01-01', sex: 'M' }] });
    const gaps = await svc.detectGaps('p1', db);
    expect(gaps.find((g) => g.gapType === 'cervical_screening')).toBeUndefined();
  });

  it('detects HbA1c gap for diabetic patient', async () => {
    const db = makeDb({
      patient: [{ date_of_birth: '1970-01-01', sex: 'M' }],
      diagnoses: [{ icd10_code: 'E11', description: 'T2DM', status: 'chronic' }],
    });
    const gaps = await svc.detectGaps('p1', db);
    expect(gaps.find((g) => g.gapType === 'diabetes_hba1c')).toBeTruthy();
  });

  it('detects lapsed follow-up when last encounter was >90 days ago', async () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString();
    const db = makeDb({ encounters: [{ created_at: oldDate, status: 'completed' }] });
    const gaps = await svc.detectGaps('p1', db);
    expect(gaps.find((g) => g.gapType === 'lapsed_followup')).toBeTruthy();
  });

  it('dismissGap updates status and dismissed_until', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    await svc.dismissGap('gap-1', 'doc-1', db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('dismissed_until'),
      expect.any(Array),
    );
  });
});
```

---

## 9. Definition of Done

- [ ] `care_gaps` table provisioned; repair passes
- [ ] `CareGapEngineService` and `CareGapController` in `ehr.module.ts`
- [ ] `GET /patients/:id/care-gaps` returns open gaps (detects if empty)
- [ ] `POST /patients/care-gaps/:id/dismiss` sets `dismissed_until` 30 days from now
- [ ] `CareGapPanel` rendered in EHR patient record with Order + Dismiss buttons
- [ ] Mobile shows gap count and top 3 gaps on patient detail screen
- [ ] `tsc --noEmit` passes
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
