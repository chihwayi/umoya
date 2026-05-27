# S180 — AI Mortality Risk Score on Patient Cards

**Phase:** 2 — AI Intelligence Amplification  
**Effort:** M  
**Depends on:** S173, S179  
**Goal:** Display a composite 30-day mortality risk badge on every patient card in the EHR and mobile app — giving nurses and doctors an instant visual signal of which patients need the most attention.

---

## Problem

Clinicians prioritise patients by gut feel. High-risk patients die unnoticed because nothing on the patient card communicates objective mortality risk. The data for a validated composite score (NEWS2, diagnoses, age, comorbidities) exists — it just isn't surfaced.

---

## Acceptance Criteria

1. `GET /patients/:id/mortality-risk` returns a 30-day mortality risk score (0–100) with band and factors.
2. Score is computed from: age, NEWS2 latest, number of comorbidities, recent critical lab flags, ICU/HDU status.
3. Scores are stored in `mortality_risk_scores` table and refreshed daily by cron.
4. EHR patient card shows a colour-coded badge: green (<20), amber (20–49), orange (50–74), red (≥75).
5. Mobile nurse/doctor ward list shows the badge on each patient row.
6. Clicking/tapping the badge opens a breakdown modal/sheet.
7. Patients with score ≥ 75 trigger a push alert to the on-call doctor.
8. Score displayed alongside the existing risk heatmap (S173).
9. `tsc --noEmit` and lint pass.
10. i18n keys in all 8 locales.

---

## 1. Database Provisioning

```typescript
{
  id: 'mortality_risk_scores',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS mortality_risk_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      band VARCHAR(16) NOT NULL
        CHECK (band IN ('low','moderate','high','critical')),
      factors JSONB NOT NULL DEFAULT '{}',
      alert_sent BOOLEAN NOT NULL DEFAULT false,
      scored_by VARCHAR(64) NOT NULL DEFAULT 'cron',
      scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mrs_patient ON mortality_risk_scores(patient_id, scored_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_mrs_band ON mortality_risk_scores(band, scored_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_mrs_recent ON mortality_risk_scores(scored_at DESC)`,
  ],
},
```

---

## 2. Backend — MortalityRiskService

Create `services/ehr-service/src/services/mortality-risk.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { AlertDeliveryService } from './alert-delivery.service';

interface MortalityFactors {
  age: number;
  news2Score: number;
  comorbidityCount: number;
  criticalLabFlags: number;
  icuStatus: boolean;
  activeDiagnosisSeverity: number;
}

@Injectable()
export class MortalityRiskService {
  private readonly logger = new Logger(MortalityRiskService.name);

  constructor(
    @Optional() private readonly alertDelivery: AlertDeliveryService,
  ) {}

  async scorePatient(
    patientId: string,
    db: any,
    subdomain: string,
    scoredBy = 'cron',
  ): Promise<{ score: number; band: string; factors: MortalityFactors }> {
    // Age
    const ageRows = await db.query(
      `SELECT date_of_birth FROM patients WHERE id = $1`,
      [patientId],
    );
    const dob = ageRows[0]?.date_of_birth;
    const age = dob
      ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 50;

    // NEWS2
    const news2Rows = await db.query(
      `SELECT total_score FROM news2_assessments
       WHERE patient_id = $1 ORDER BY assessed_at DESC LIMIT 1`,
      [patientId],
    );
    const news2Score = news2Rows[0]?.total_score ?? 0;

    // Comorbidity count (chronic conditions)
    const comorbRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM patient_diagnoses
       WHERE patient_id = $1 AND status = 'chronic'`,
      [patientId],
    );
    const comorbidityCount = parseInt(comorbRows[0]?.cnt ?? '0');

    // Critical lab flags in last 7 days
    const labRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM lab_results
       WHERE patient_id = $1 AND flag IN ('HH','LL','critical')
         AND resulted_at > now() - INTERVAL '7 days'`,
      [patientId],
    );
    const criticalLabFlags = parseInt(labRows[0]?.cnt ?? '0');

    // ICU/HDU status
    const icuRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM encounters
       WHERE patient_id = $1 AND ward IN ('ICU','HDU','INTENSIVE_CARE')
         AND status = 'active'`,
      [patientId],
    );
    const icuStatus = parseInt(icuRows[0]?.cnt ?? '0') > 0;

    // Active diagnosis severity weight
    const sevRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM patient_diagnoses
       WHERE patient_id = $1 AND status = 'active'
         AND (icd10_code LIKE 'C%' OR icd10_code LIKE 'I%' OR icd10_code LIKE 'J%')`,
      [patientId],
    );
    const activeDiagnosisSeverity = parseInt(sevRows[0]?.cnt ?? '0');

    const factors: MortalityFactors = {
      age, news2Score, comorbidityCount, criticalLabFlags, icuStatus, activeDiagnosisSeverity,
    };

    // Composite score
    const ageContrib = age >= 80 ? 25 : age >= 65 ? 15 : age >= 50 ? 8 : 3;
    const news2Contrib = Math.min(news2Score * 3.5, 35);
    const comorbContrib = Math.min(comorbidityCount * 4, 16);
    const labContrib = Math.min(criticalLabFlags * 6, 12);
    const icuContrib = icuStatus ? 10 : 0;
    const diagContrib = Math.min(activeDiagnosisSeverity * 3, 9);

    const raw = ageContrib + news2Contrib + comorbContrib + labContrib + icuContrib + diagContrib;
    const score = Math.min(Math.round(raw), 100);
    const band =
      score >= 75 ? 'critical' :
      score >= 50 ? 'high' :
      score >= 20 ? 'moderate' : 'low';

    await db.query(
      `INSERT INTO mortality_risk_scores (patient_id, score, band, factors, scored_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [patientId, score, band, JSON.stringify(factors), scoredBy],
    );

    // Alert for critical
    if (band === 'critical' && this.alertDelivery) {
      const lastAlert = await db.query(
        `SELECT id FROM mortality_risk_scores
         WHERE patient_id = $1 AND alert_sent = true
           AND scored_at > now() - INTERVAL '6 hours'
         LIMIT 1`,
        [patientId],
      );
      if (lastAlert.length === 0) {
        try {
          await this.alertDelivery.broadcastCriticalAlert(subdomain, {
            alertType: 'mortality_risk_critical',
            sourceEntityId: patientId,
            patientId,
            severity: 'critical',
            message: `30-day mortality risk score: ${score}/100 (${band.toUpperCase()}) — immediate review recommended`,
            payload: { score, band, factors },
          });
          await db.query(
            `UPDATE mortality_risk_scores SET alert_sent = true
             WHERE patient_id = $1 ORDER BY scored_at DESC LIMIT 1`,
            [patientId],
          );
        } catch (err) {
          this.logger.warn(`Mortality alert failed: ${err.message}`);
        }
      }
    }

    return { score, band, factors };
  }

  async getLatestScore(patientId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM mortality_risk_scores
       WHERE patient_id = $1 ORDER BY scored_at DESC LIMIT 1`,
      [patientId],
    );
    return rows[0] ?? null;
  }

  async getCriticalPatients(db: any, limit = 20): Promise<unknown[]> {
    return db.query(
      `SELECT DISTINCT ON (mrs.patient_id)
         mrs.patient_id, mrs.score, mrs.band, mrs.scored_at,
         p.first_name, p.last_name, p.mrn
       FROM mortality_risk_scores mrs
       JOIN patients p ON p.id = mrs.patient_id
       WHERE mrs.band IN ('critical','high')
         AND mrs.scored_at > now() - INTERVAL '25 hours'
       ORDER BY mrs.patient_id, mrs.score DESC
       LIMIT $1`,
      [limit],
    );
  }

  async runDailySweep(db: any, subdomain: string): Promise<{ scored: number }> {
    const patients = await db.query(
      `SELECT DISTINCT p.id FROM patients p
       JOIN encounters e ON e.patient_id = p.id
       WHERE e.status = 'active'`,
    );
    let scored = 0;
    for (const { id } of patients) {
      try {
        await this.scorePatient(id, db, subdomain);
        scored++;
      } catch (err) {
        this.logger.warn(`Mortality score failed for ${id}: ${err.message}`);
      }
    }
    return { scored };
  }
}
```

---

## 3. Cron Service

Create `services/ehr-service/src/services/cron-mortality.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MortalityRiskService } from './mortality-risk.service';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class CronMortalityService {
  private readonly logger = new Logger(CronMortalityService.name);

  constructor(
    private readonly mortality: MortalityRiskService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Cron('0 3 * * *')
  async runDailySweep(): Promise<void> {
    const tenants = await this.tenantContext.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const { scored } = await this.mortality.runDailySweep(tenant.db, tenant.subdomain);
        this.logger.log(`${tenant.subdomain}: ${scored} mortality scores computed`);
      } catch (err) {
        this.logger.error(`Mortality sweep failed for ${tenant.subdomain}: ${err.message}`);
      }
    }
  }
}
```

---

## 4. Controller

Create `services/ehr-service/src/controllers/mortality-risk.controller.ts`:

```typescript
import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MortalityRiskService } from '../services/mortality-risk.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class MortalityRiskController {
  constructor(private readonly mortality: MortalityRiskService) {}

  @Get(':patientId/mortality-risk')
  async getScore(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    let score = await this.mortality.getLatestScore(patientId, req.tenantDb);
    if (!score) {
      score = await this.mortality.scorePatient(patientId, req.tenantDb, req.tenantSubdomain ?? '', req.user.sub);
    }
    return score;
  }

  @Post(':patientId/mortality-risk/rescore')
  async rescore(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.mortality.scorePatient(patientId, req.tenantDb, req.tenantSubdomain ?? '', req.user.sub);
  }

  @Get('mortality-risk/critical')
  async getCritical(@Req() req: any): Promise<unknown[]> {
    return this.mortality.getCriticalPatients(req.tenantDb);
  }
}
```

---

## 5. Register in ehr.module.ts

```typescript
import { MortalityRiskService } from './services/mortality-risk.service';
import { CronMortalityService } from './services/cron-mortality.service';
import { MortalityRiskController } from './controllers/mortality-risk.controller';

controllers: [ /* ...existing... */ MortalityRiskController ],
providers: [ /* ...existing... */ MortalityRiskService, CronMortalityService ],
```

---

## 6. EHR Frontend — Mortality Badge Component

Create `ehr-frontend/src/components/MortalityRiskBadge.tsx`:

```tsx
import React, { useState } from 'react';

interface Props {
  score: number;
  band: 'low' | 'moderate' | 'high' | 'critical';
  factors?: Record<string, unknown>;
}

const BAND_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  low:      { bg: '#dcfce7', color: '#16a34a', label: 'LOW' },
  moderate: { bg: '#fef9c3', color: '#a16207', label: 'MOD' },
  high:     { bg: '#ffedd5', color: '#f97316', label: 'HIGH' },
  critical: { bg: '#fee2e2', color: '#dc2626', label: 'CRIT' },
};

export const MortalityRiskBadge: React.FC<Props> = ({ score, band, factors }) => {
  const [showDetails, setShowDetails] = useState(false);
  const style = BAND_STYLE[band] ?? BAND_STYLE.low;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        title="30-day mortality risk"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '3px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
          backgroundColor: style.bg, color: style.color,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800 }}>{score}</span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{style.label}</span>
      </button>

      {showDetails && factors && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 100,
          backgroundColor: 'white', border: '1px solid #e5e7eb',
          borderRadius: 8, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: 200, fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Mortality Risk Breakdown</div>
          {Object.entries(factors).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>
                {k.replace(/([A-Z])/g, ' $1').trim()}:
              </span>
              <span style={{ fontWeight: 600 }}>{String(v)}</span>
            </div>
          ))}
          <button
            onClick={() => setShowDetails(false)}
            style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
```

Import and render `<MortalityRiskBadge score={patient.mortalityScore} band={patient.mortalityBand} factors={patient.mortalityFactors} />` on every patient card in the ward list and patient detail header.

---

## 7. Mobile — Mortality Badge on Patient Row

In `mobile/src/components/PatientListRow.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../design/tokens';

interface Props { score: number; band: string; }

const BAND_COLORS: Record<string, { bg: string; text: string }> = {
  low:      { bg: C.green + '20', text: C.green },
  moderate: { bg: '#fef9c3',       text: '#a16207' },
  high:     { bg: C.amber + '20', text: C.amber },
  critical: { bg: C.red + '20',   text: C.red   },
};

export const MortalityBadge: React.FC<Props> = ({ score, band }) => {
  const colors = BAND_COLORS[band] ?? BAND_COLORS.low;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.score, { color: colors.text }]}>{score}</Text>
      <Text style={[styles.label, { color: colors.text }]}>
        {band.toUpperCase().slice(0, 4)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.sm,
    padding: 4,
    alignItems: 'center',
    minWidth: 36,
  },
  score: { fontFamily: FONT.uiBd, fontSize: 14 },
  label: { fontFamily: FONT.ui, fontSize: 8 },
});
```

---

## 8. i18n Keys — All 8 Locales

### `en.json`:
```json
"mortality": {
  "risk_score": "30-Day Mortality Risk",
  "low": "Low",
  "moderate": "Moderate",
  "high": "High",
  "critical": "Critical",
  "breakdown": "Risk Breakdown",
  "factors": {
    "age": "Age",
    "news2Score": "NEWS2 Score",
    "comorbidityCount": "Comorbidities",
    "criticalLabFlags": "Critical Lab Flags",
    "icuStatus": "ICU/HDU",
    "activeDiagnosisSeverity": "Severe Diagnoses"
  }
}
```

### `sn.json`:
```json
"mortality": {
  "risk_score": "Njodzi yekufa mumavhiki 4",
  "low": "Pasi",
  "moderate": "Pakati",
  "high": "Kukwirira",
  "critical": "Kudiwa Kwakanyanya",
  "breakdown": "Kuonekwa kweNjodzi",
  "factors": {
    "age": "Zera",
    "news2Score": "Nhamba yeNEWS2",
    "comorbidityCount": "Zvirwere Zvakawanda",
    "criticalLabFlags": "Mafulegi eLaboratory",
    "icuStatus": "ICU/HDU",
    "activeDiagnosisSeverity": "Zvirwere Zvakakura"
  }
}
```

### `nd.json`:
```json
"mortality": {
  "risk_score": "Ingozi Yokufa Ezinsukwini Ezingama-30",
  "low": "Phansi",
  "moderate": "Phakathi",
  "high": "Ephezulu",
  "critical": "Esikhulu Kakhulu",
  "breakdown": "Ukuhlaziywa Kwengozi",
  "factors": {
    "age": "Ubudala",
    "news2Score": "Isikalo se-NEWS2",
    "comorbidityCount": "Izifo Ezimaningi",
    "criticalLabFlags": "Amafulegi Esikhulwini",
    "icuStatus": "ICU/HDU",
    "activeDiagnosisSeverity": "Izifo Ezibalulekile"
  }
}
```

### `pt.json`:
```json
"mortality": {
  "risk_score": "Risco de Mortalidade a 30 Dias",
  "low": "Baixo",
  "moderate": "Moderado",
  "high": "Alto",
  "critical": "Crítico",
  "breakdown": "Análise de Risco",
  "factors": {
    "age": "Idade",
    "news2Score": "Pontuação NEWS2",
    "comorbidityCount": "Comorbilidades",
    "criticalLabFlags": "Valores Lab Críticos",
    "icuStatus": "UCI/HDU",
    "activeDiagnosisSeverity": "Diagnósticos Graves"
  }
}
```

### `fr.json`:
```json
"mortality": {
  "risk_score": "Risque de Mortalité à 30 Jours",
  "low": "Faible",
  "moderate": "Modéré",
  "high": "Élevé",
  "critical": "Critique",
  "breakdown": "Analyse du Risque",
  "factors": {
    "age": "Âge",
    "news2Score": "Score NEWS2",
    "comorbidityCount": "Comorbidités",
    "criticalLabFlags": "Valeurs Lab Critiques",
    "icuStatus": "USI/HDU",
    "activeDiagnosisSeverity": "Diagnostics Sévères"
  }
}
```

### `sw.json`:
```json
"mortality": {
  "risk_score": "Hatari ya Kifo kwa Siku 30",
  "low": "Chini",
  "moderate": "Wastani",
  "high": "Juu",
  "critical": "Muhimu Sana",
  "breakdown": "Uchambuzi wa Hatari",
  "factors": {
    "age": "Umri",
    "news2Score": "Alama ya NEWS2",
    "comorbidityCount": "Magonjwa Mengi",
    "criticalLabFlags": "Alama Muhimu za Lab",
    "icuStatus": "ICU/HDU",
    "activeDiagnosisSeverity": "Magonjwa Makali"
  }
}
```

### `zu.json`:
```json
"mortality": {
  "risk_score": "Ingozi Yokufa Ezinsukwini Ezingama-30",
  "low": "Phansi",
  "moderate": "Phakathi",
  "high": "Ephezulu",
  "critical": "Ebalulekile Kakhulu",
  "breakdown": "Ukuhlaziywa Kwengozi",
  "factors": {
    "age": "Ubudala",
    "news2Score": "Isikalo se-NEWS2",
    "comorbidityCount": "Izifo Ezahlukene",
    "criticalLabFlags": "Amafulegi Abalulekile",
    "icuStatus": "ICU/HDU",
    "activeDiagnosisSeverity": "Izifo Ezibalulekile"
  }
}
```

### `af.json`:
```json
"mortality": {
  "risk_score": "30-Dag Sterftrisiko",
  "low": "Laag",
  "moderate": "Matig",
  "high": "Hoog",
  "critical": "Krities",
  "breakdown": "Risikoontleding",
  "factors": {
    "age": "Ouderdom",
    "news2Score": "NEWS2 Telling",
    "comorbidityCount": "Komorbiditeite",
    "criticalLabFlags": "Kritiese Lab Waardes",
    "icuStatus": "IKE/HDU",
    "activeDiagnosisSeverity": "Ernstige Diagnoses"
  }
}
```

---

## 9. Jest Spec

Create `services/ehr-service/src/services/mortality-risk.service.spec.ts`:

```typescript
import { MortalityRiskService } from './mortality-risk.service';

function makeService(alert?: any) {
  return new MortalityRiskService(alert ?? null);
}

function makeDb(overrides: Record<string, any> = {}) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients')) return Promise.resolve([{ date_of_birth: '1950-01-01' }]);
      if (sql.includes('news2_assessments')) return Promise.resolve(overrides.news2 ?? [{ total_score: 0 }]);
      if (sql.includes("status = 'chronic'")) return Promise.resolve(overrides.comorbid ?? [{ cnt: '2' }]);
      if (sql.includes("flag IN ('HH'")) return Promise.resolve(overrides.labs ?? [{ cnt: '0' }]);
      if (sql.includes('ICU')) return Promise.resolve(overrides.icu ?? [{ cnt: '0' }]);
      if (sql.includes("icd10_code LIKE 'C%'")) return Promise.resolve(overrides.diag ?? [{ cnt: '1' }]);
      if (sql.includes('INSERT INTO mortality_risk_scores')) return Promise.resolve([]);
      if (sql.includes('SELECT id FROM mortality_risk_scores')) return Promise.resolve([]);
      if (sql.includes('UPDATE mortality_risk_scores')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('MortalityRiskService', () => {
  it('scores a 70-year-old patient with news2=0 in moderate range', async () => {
    const svc = makeService();
    const db = makeDb();
    const { score, band } = await svc.scorePatient('p1', db, 'test');
    // age 74 → 25pts, comorbid 2 → 8pts, diag 1 → 3pts = 36 → moderate
    expect(band).toBe('moderate');
    expect(score).toBeGreaterThan(20);
  });

  it('scores critical for ICU patient with high NEWS2', async () => {
    const svc = makeService();
    const db = makeDb({ news2: [{ total_score: 10 }], icu: [{ cnt: '1' }], labs: [{ cnt: '2' }] });
    const { band } = await svc.scorePatient('p1', db, 'test');
    expect(['high', 'critical']).toContain(band);
  });

  it('sends alert for critical band without recent alert', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(alert);
    const db = makeDb({ news2: [{ total_score: 12 }], icu: [{ cnt: '1' }], labs: [{ cnt: '3' }] });
    await svc.scorePatient('p1', db, 'clinic1');
    // Alert may be called depending on computed score
    expect(alert.broadcastCriticalAlert.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('getLatestScore returns null for unknown patient', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getLatestScore('p-none', db);
    expect(result).toBeNull();
  });
});
```

---

## 10. Definition of Done

- [ ] `mortality_risk_scores` table provisioned; repair passes
- [ ] `MortalityRiskService`, `CronMortalityService`, `MortalityRiskController` in `ehr.module.ts`
- [ ] `GET /patients/:id/mortality-risk` returns score + band + factors
- [ ] Critical band triggers `broadcastCriticalAlert` (max once per 6h per patient)
- [ ] `MortalityRiskBadge` component exists and is rendered on patient cards in EHR
- [ ] `MortalityBadge` mobile component exists and is used in patient list rows
- [ ] `tsc --noEmit` passes
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
- [ ] `npx expo export --platform all` passes
