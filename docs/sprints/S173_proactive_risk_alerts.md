# S173 — Proactive Patient Risk Alert Engine

**Phase:** 2 — AI Intelligence Amplification  
**Effort:** L  
**Depends on:** S167, S168  
**Goal:** Run a nightly risk-scoring job across all active patients. For any patient whose composite risk score crosses a threshold, proactively push an alert to their primary nurse — before the patient deteriorates, not after.

---

## Problem

Risk scoring runs only on explicit clinician request. There is no automated daily sweep. Nurses only learn of at-risk patients when the patient presents acutely. The system has all the data to predict deterioration but never acts on it autonomously.

---

## Acceptance Criteria

1. A nightly cron (02:00 tenant local time) runs risk scoring for all active patients.
2. Patients are scored on: NEWS2 trend, OI alert history, missed medications, BMI/vitals.
3. Risk levels: `low` (0–30), `medium` (31–60), `high` (61–85), `critical` (86–100).
4. Patients scoring `high` or `critical` push an alert to their assigned nurse via `AlertDeliveryService`.
5. Scores are stored in `patient_risk_scores` table with full component breakdown.
6. EHR dashboard shows a risk heatmap of the ward — patients ranked by score descending.
7. Mobile nurse screen shows "High Risk Patients" list sorted by score.
8. Score history is available for trend chart (last 30 days).
9. Clinician can manually trigger a re-score for a single patient.
10. `tsc --noEmit` and lint pass; all tests pass.

---

## 1. Database Provisioning

```typescript
{
  id: 'patient_risk_scores',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS patient_risk_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      risk_level VARCHAR(16) NOT NULL
        CHECK (risk_level IN ('low','medium','high','critical')),
      components JSONB NOT NULL DEFAULT '{}',
      alert_sent BOOLEAN NOT NULL DEFAULT false,
      scored_by VARCHAR(64) NOT NULL DEFAULT 'cron',
      scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_prs_patient
      ON patient_risk_scores(patient_id, scored_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_prs_level
      ON patient_risk_scores(risk_level, scored_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_prs_recent
      ON patient_risk_scores(scored_at DESC)`,
  ],
},
```

---

## 2. Backend — PatientRiskScoringService

Create `services/ehr-service/src/services/patient-risk-scoring.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertDeliveryService } from './alert-delivery.service';

interface RiskComponents {
  news2Score: number;
  oiAlertCount: number;
  missedMedications: number;
  abnormalVitals: number;
  labFlags: number;
}

interface RiskResult {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  components: RiskComponents;
}

@Injectable()
export class PatientRiskScoringService {
  private readonly logger = new Logger(PatientRiskScoringService.name);
  private tenantRegistry: Map<string, { db: any; subdomain: string }> = new Map();

  constructor(
    @Optional() private readonly alertDelivery: AlertDeliveryService,
  ) {}

  registerTenant(tenantId: string, db: any, subdomain: string): void {
    this.tenantRegistry.set(tenantId, { db, subdomain });
  }

  async scorePatient(patientId: string, db: any): Promise<RiskResult> {
    // Fetch NEWS2 latest score
    const news2Rows = await db.query(
      `SELECT total_score FROM news2_assessments
       WHERE patient_id = $1 ORDER BY assessed_at DESC LIMIT 1`,
      [patientId],
    );
    const news2Score = news2Rows[0]?.total_score ?? 0;

    // Count active OI alerts in last 48h
    const oiRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM oi_alerts
       WHERE patient_id = $1 AND status = 'active'
         AND created_at > now() - INTERVAL '48 hours'`,
      [patientId],
    );
    const oiAlertCount = parseInt(oiRows[0]?.cnt ?? '0');

    // Count missed medication doses in last 7 days
    const medRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM medication_administrations
       WHERE patient_id = $1 AND status = 'missed'
         AND scheduled_at > now() - INTERVAL '7 days'`,
      [patientId],
    );
    const missedMedications = parseInt(medRows[0]?.cnt ?? '0');

    // Count abnormal vitals in last 24h
    const vitalRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM vitals
       WHERE patient_id = $1 AND is_abnormal = true
         AND recorded_at > now() - INTERVAL '24 hours'`,
      [patientId],
    );
    const abnormalVitals = parseInt(vitalRows[0]?.cnt ?? '0');

    // Count flagged lab results
    const labRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM lab_results
       WHERE patient_id = $1 AND flag IN ('H','L','HH','LL','critical')
         AND resulted_at > now() - INTERVAL '72 hours'`,
      [patientId],
    );
    const labFlags = parseInt(labRows[0]?.cnt ?? '0');

    // Composite scoring formula
    const components: RiskComponents = {
      news2Score,
      oiAlertCount,
      missedMedications,
      abnormalVitals,
      labFlags,
    };

    const raw =
      Math.min(news2Score * 4, 40) +       // max 40 pts
      Math.min(oiAlertCount * 10, 20) +    // max 20 pts
      Math.min(missedMedications * 3, 15) + // max 15 pts
      Math.min(abnormalVitals * 5, 15) +   // max 15 pts
      Math.min(labFlags * 5, 10);          // max 10 pts

    const score = Math.min(Math.round(raw), 100);
    const level: RiskResult['level'] =
      score >= 86 ? 'critical' :
      score >= 61 ? 'high' :
      score >= 31 ? 'medium' : 'low';

    return { score, level, components };
  }

  async scoreAndPersist(
    patientId: string,
    db: any,
    subdomain: string,
    scoredBy = 'cron',
  ): Promise<RiskResult> {
    const result = await this.scorePatient(patientId, db);

    await db.query(
      `INSERT INTO patient_risk_scores
         (patient_id, score, risk_level, components, scored_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        patientId,
        result.score,
        result.level,
        JSON.stringify(result.components),
        scoredBy,
      ],
    );

    if (['high', 'critical'].includes(result.level) && this.alertDelivery) {
      try {
        await this.alertDelivery.broadcastCriticalAlert(subdomain, {
          alertType: 'proactive_risk_alert',
          sourceEntityId: patientId,
          patientId,
          severity: result.level === 'critical' ? 'critical' : 'urgent',
          message: `Proactive Risk Alert: Patient score ${result.score}/100 (${result.level.toUpperCase()})`,
          payload: { score: result.score, components: result.components },
        });
        await db.query(
          `UPDATE patient_risk_scores SET alert_sent = true
           WHERE patient_id = $1 ORDER BY scored_at DESC LIMIT 1`,
          [patientId],
        );
      } catch (err) {
        this.logger.warn(`Alert failed for patient ${patientId}: ${err.message}`);
      }
    }

    return result;
  }

  async runNightlySweep(db: any, subdomain: string): Promise<{ scored: number; alerts: number }> {
    const patients = await db.query(
      `SELECT DISTINCT p.id FROM patients p
       JOIN encounters e ON e.patient_id = p.id
       WHERE e.status = 'active' OR e.created_at > now() - INTERVAL '30 days'`,
    );

    let scored = 0;
    let alerts = 0;

    for (const { id } of patients) {
      try {
        const result = await this.scoreAndPersist(id, db, subdomain);
        scored++;
        if (['high', 'critical'].includes(result.level)) alerts++;
      } catch (err) {
        this.logger.warn(`Scoring failed for patient ${id}: ${err.message}`);
      }
    }

    this.logger.log(`Nightly sweep: ${scored} patients scored, ${alerts} alerts sent`);
    return { scored, alerts };
  }

  async getRiskScoreHistory(
    patientId: string,
    db: any,
    days = 30,
  ): Promise<unknown[]> {
    return db.query(
      `SELECT score, risk_level, components, scored_at
       FROM patient_risk_scores
       WHERE patient_id = $1 AND scored_at > now() - ($2 || ' days')::INTERVAL
       ORDER BY scored_at ASC`,
      [patientId, days],
    );
  }

  async getHighRiskPatients(db: any, limit = 50): Promise<unknown[]> {
    return db.query(
      `SELECT DISTINCT ON (prs.patient_id)
         prs.patient_id, prs.score, prs.risk_level, prs.scored_at,
         p.first_name, p.last_name, p.mrn,
         e.ward, e.bed_number
       FROM patient_risk_scores prs
       JOIN patients p ON p.id = prs.patient_id
       LEFT JOIN encounters e ON e.patient_id = prs.patient_id AND e.status = 'active'
       WHERE prs.risk_level IN ('high','critical')
         AND prs.scored_at > now() - INTERVAL '25 hours'
       ORDER BY prs.patient_id, prs.scored_at DESC, prs.score DESC
       LIMIT $1`,
      [limit],
    );
  }
}
```

---

## 3. Backend — ProactiveRiskController

Create `services/ehr-service/src/controllers/proactive-risk.controller.ts`:

```typescript
import {
  Controller, Get, Post, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientRiskScoringService } from '../services/patient-risk-scoring.service';

@UseGuards(JwtAuthGuard)
@Controller('risk')
export class ProactiveRiskController {
  constructor(private readonly riskService: PatientRiskScoringService) {}

  @Get('high-risk-patients')
  async getHighRisk(
    @Query('limit') limit: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.riskService.getHighRiskPatients(req.tenantDb, limit ? parseInt(limit) : 50);
  }

  @Get('patients/:patientId/risk-history')
  async getRiskHistory(
    @Param('patientId') patientId: string,
    @Query('days') days: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.riskService.getRiskScoreHistory(
      patientId,
      req.tenantDb,
      days ? parseInt(days) : 30,
    );
  }

  @Post('patients/:patientId/rescore')
  async rescore(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.riskService.scoreAndPersist(
      patientId,
      req.tenantDb,
      req.tenantSubdomain ?? '',
      req.user.sub,
    );
  }

  @Post('sweep')
  async triggerSweep(@Req() req: any): Promise<{ scored: number; alerts: number }> {
    return this.riskService.runNightlySweep(
      req.tenantDb,
      req.tenantSubdomain ?? '',
    );
  }
}
```

---

## 4. Nightly Cron — CronRiskSweepService

Create `services/ehr-service/src/services/cron-risk-sweep.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PatientRiskScoringService } from './patient-risk-scoring.service';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class CronRiskSweepService {
  private readonly logger = new Logger(CronRiskSweepService.name);

  constructor(
    private readonly riskScoring: PatientRiskScoringService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // Runs at 02:00 UTC daily
  @Cron('0 2 * * *')
  async runDailySweep(): Promise<void> {
    this.logger.log('Starting nightly risk scoring sweep');
    const tenants = await this.tenantContext.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const { scored, alerts } = await this.riskScoring.runNightlySweep(
          tenant.db,
          tenant.subdomain,
        );
        this.logger.log(`Tenant ${tenant.subdomain}: ${scored} scored, ${alerts} alerts`);
      } catch (err) {
        this.logger.error(`Sweep failed for tenant ${tenant.subdomain}: ${err.message}`);
      }
    }
  }
}
```

> **Note:** `TenantContextService` must provide `getAllActiveTenants()` returning `{ db, subdomain }[]`.
> If it doesn't exist yet, add a method to the existing `TenantService` that queries the system DB for all active tenants and opens their DB connections.

---

## 5. Register in ehr.module.ts

```typescript
import { PatientRiskScoringService } from './services/patient-risk-scoring.service';
import { CronRiskSweepService } from './services/cron-risk-sweep.service';
import { ProactiveRiskController } from './controllers/proactive-risk.controller';

controllers: [ /* ...existing... */ ProactiveRiskController ],
providers: [ /* ...existing... */ PatientRiskScoringService, CronRiskSweepService ],
```

---

## 6. EHR Frontend — Risk Heatmap Panel

Create `ehr-frontend/src/components/RiskHeatmapPanel.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface RiskPatient {
  patient_id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  score: number;
  risk_level: string;
  ward?: string;
  bed_number?: string;
}

export const RiskHeatmapPanel: React.FC = () => {
  const [patients, setPatients] = useState<RiskPatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/risk/high-risk-patients?limit=20')
      .then((r) => setPatients(r.data ?? []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const levelColors: Record<string, string> = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#d97706',
    low: '#16a34a',
  };

  if (loading) return <div style={{ padding: 16, color: '#6b7280' }}>Loading risk data...</div>;

  if (patients.length === 0) {
    return (
      <div style={{ padding: 16, color: '#16a34a', fontWeight: 600 }}>
        No high-risk patients in the last 24 hours.
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontWeight: 700, marginBottom: 12 }}>High Risk Patients</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Patient</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>MRN</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Ward/Bed</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Score</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Level</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.patient_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 12px' }}>
                {p.first_name} {p.last_name}
              </td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{p.mrn}</td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>
                {p.ward ?? '—'} {p.bed_number ? `/ ${p.bed_number}` : ''}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                {p.score}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 10,
                  backgroundColor: levelColors[p.risk_level] + '20',
                  color: levelColors[p.risk_level],
                }}>
                  {p.risk_level.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

Import and render `<RiskHeatmapPanel />` on the EHR nurse dashboard.

---

## 7. Mobile — High Risk Patient List

In `mobile/src/screens/NurseDashboardScreen.tsx`, add:

```tsx
const [highRisk, setHighRisk] = useState<any[]>([]);

useEffect(() => {
  api.get('/risk/high-risk-patients?limit=10')
    .then((r) => setHighRisk(r.data ?? []))
    .catch(() => setHighRisk([]));
}, []);

// In render:
{highRisk.length > 0 && (
  <View style={{ marginBottom: SPACING.lg }}>
    <Text style={{ fontFamily: FONT.uiBd, fontSize: 16, marginBottom: SPACING.sm, color: C.red }}>
      {t('risk.high_risk_patients')} ({highRisk.length})
    </Text>
    {highRisk.map((p) => (
      <TouchableOpacity
        key={p.patient_id}
        onPress={() => navigation.navigate('PatientDetail', { patientId: p.patient_id })}
        style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          padding: SPACING.sm, backgroundColor: C.bg, borderRadius: RADIUS.md,
          marginBottom: SPACING.xs, ...SHADOW.sm,
          borderLeftWidth: 4,
          borderLeftColor: p.risk_level === 'critical' ? C.red : C.amber,
        }}
      >
        <View>
          <Text style={{ fontFamily: FONT.uiBd, fontSize: 14 }}>
            {p.first_name} {p.last_name}
          </Text>
          <Text style={{ fontFamily: FONT.ui, fontSize: 12, color: '#6b7280' }}>
            {p.ward ?? ''} {p.bed_number ? `Bed ${p.bed_number}` : ''}
          </Text>
        </View>
        <View style={{
          backgroundColor: p.risk_level === 'critical' ? C.red + '20' : C.amber + '20',
          borderRadius: RADIUS.sm, padding: SPACING.xs, alignItems: 'center',
        }}>
          <Text style={{
            fontFamily: FONT.uiBd, fontSize: 16,
            color: p.risk_level === 'critical' ? C.red : C.amber,
          }}>
            {p.score}
          </Text>
          <Text style={{ fontFamily: FONT.ui, fontSize: 9, color: '#9ca3af' }}>RISK</Text>
        </View>
      </TouchableOpacity>
    ))}
  </View>
)}
```

---

## 8. i18n Keys — All 8 Locales

### `en.json`:
```json
"risk": {
  "high_risk_patients": "High Risk Patients",
  "risk_score": "Risk Score",
  "critical": "Critical",
  "high": "High",
  "medium": "Medium",
  "low": "Low",
  "last_scored": "Last Scored",
  "rescore": "Re-Score Patient",
  "no_high_risk": "No high-risk patients today"
}
```

### `sn.json`:
```json
"risk": {
  "high_risk_patients": "Varwere Vane Njodzi Yakakura",
  "risk_score": "Nhamba yeNjodzi",
  "critical": "Kukurwa Kwakanyanya",
  "high": "Kukwirira",
  "medium": "Pakati",
  "low": "Pasi",
  "last_scored": "Yakaverengwa Pamugumo",
  "rescore": "Verengazve Murwere",
  "no_high_risk": "Hapana varwere vane njodzi yakakura nhasi"
}
```

### `nd.json`:
```json
"risk": {
  "high_risk_patients": "Iziguli Ezinengozi Ephezulu",
  "risk_score": "Inombolo Yengozi",
  "critical": "Esikhulu Kakhulu",
  "high": "Ephezulu",
  "medium": "Phakathi",
  "low": "Phansi",
  "last_scored": "Idingiwe Okwokugcina",
  "rescore": "Bheka Futhi Isiguli",
  "no_high_risk": "Azikho iziguli ezinengozi ephezulu namuhla"
}
```

### `pt.json`:
```json
"risk": {
  "high_risk_patients": "Pacientes de Alto Risco",
  "risk_score": "Pontuação de Risco",
  "critical": "Crítico",
  "high": "Alto",
  "medium": "Médio",
  "low": "Baixo",
  "last_scored": "Última Avaliação",
  "rescore": "Re-avaliar Paciente",
  "no_high_risk": "Nenhum paciente de alto risco hoje"
}
```

### `fr.json`:
```json
"risk": {
  "high_risk_patients": "Patients à Haut Risque",
  "risk_score": "Score de Risque",
  "critical": "Critique",
  "high": "Élevé",
  "medium": "Moyen",
  "low": "Faible",
  "last_scored": "Dernière Évaluation",
  "rescore": "Ré-évaluer le Patient",
  "no_high_risk": "Aucun patient à haut risque aujourd'hui"
}
```

### `sw.json`:
```json
"risk": {
  "high_risk_patients": "Wagonjwa wa Hatari Kubwa",
  "risk_score": "Alama ya Hatari",
  "critical": "Muhimu Sana",
  "high": "Juu",
  "medium": "Kati",
  "low": "Chini",
  "last_scored": "Alipimwa Mara ya Mwisho",
  "rescore": "Pima Tena Mgonjwa",
  "no_high_risk": "Hakuna wagonjwa wa hatari kubwa leo"
}
```

### `zu.json`:
```json
"risk": {
  "high_risk_patients": "Iziguli Ezinobungozi Obuphezulu",
  "risk_score": "Inombolo Yobungozi",
  "critical": "Ebalulekile Kakhulu",
  "high": "Ephezulu",
  "medium": "Phakathi",
  "low": "Phansi",
  "last_scored": "Kudingiwe Okwamuva",
  "rescore": "Bala Kabusha Isiguli",
  "no_high_risk": "Azikho iziguli ezinobungozi obuphezulu namuhla"
}
```

### `af.json`:
```json
"risk": {
  "high_risk_patients": "Hoërisiko Pasiënte",
  "risk_score": "Risikotelling",
  "critical": "Krities",
  "high": "Hoog",
  "medium": "Medium",
  "low": "Laag",
  "last_scored": "Laas Beoordeel",
  "rescore": "Herbeoordeel Pasiënt",
  "no_high_risk": "Geen hoërisiko pasiënte vandag nie"
}
```

---

## 9. Jest Spec

Create `services/ehr-service/src/services/patient-risk-scoring.service.spec.ts`:

```typescript
import { PatientRiskScoringService } from './patient-risk-scoring.service';

function makeService(alertMock?: any) {
  return new PatientRiskScoringService(alertMock ?? null);
}

function makeDb(overrides: Partial<Record<string, any[]>> = {}) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('news2_assessments')) return Promise.resolve(overrides.news2 ?? [{ total_score: 0 }]);
      if (sql.includes('oi_alerts')) return Promise.resolve(overrides.oi ?? [{ cnt: '0' }]);
      if (sql.includes('medication_administrations')) return Promise.resolve(overrides.meds ?? [{ cnt: '0' }]);
      if (sql.includes('vitals') && sql.includes('is_abnormal')) return Promise.resolve(overrides.vitals ?? [{ cnt: '0' }]);
      if (sql.includes('lab_results')) return Promise.resolve(overrides.labs ?? [{ cnt: '0' }]);
      if (sql.includes('encounters')) return Promise.resolve(overrides.patients ?? []);
      return Promise.resolve([]);
    }),
  };
}

describe('PatientRiskScoringService', () => {
  it('scores low when all components are zero', async () => {
    const svc = makeService();
    const db = makeDb();
    const result = await svc.scorePatient('p1', db);
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
  });

  it('scores critical when NEWS2 is maximum', async () => {
    const svc = makeService();
    const db = makeDb({ news2: [{ total_score: 10 }] });
    const result = await svc.scorePatient('p1', db);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it('does not broadcast for low risk', async () => {
    const alertDelivery = { broadcastCriticalAlert: jest.fn() };
    const svc = makeService(alertDelivery);
    const db = makeDb();
    await svc.scoreAndPersist('p1', db, 'test');
    expect(alertDelivery.broadcastCriticalAlert).not.toHaveBeenCalled();
  });

  it('broadcasts alert for high risk', async () => {
    const alertDelivery = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(alertDelivery);
    // Force high score: NEWS2=10 (40pts) + 3 OI alerts (30pts) = 70 → high
    const db = makeDb({
      news2: [{ total_score: 10 }],
      oi: [{ cnt: '3' }],
    });
    await svc.scoreAndPersist('p1', db, 'clinic1');
    expect(alertDelivery.broadcastCriticalAlert).toHaveBeenCalledWith(
      'clinic1',
      expect.objectContaining({ patientId: 'p1' }),
    );
  });

  it('runNightlySweep processes all patients', async () => {
    const svc = makeService();
    const db = makeDb({ patients: [{ id: 'p1' }, { id: 'p2' }] });
    const result = await svc.runNightlySweep(db, 'test');
    expect(result.scored).toBe(2);
  });

  it('getHighRiskPatients returns array', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ patient_id: 'p1', score: 90, risk_level: 'critical' }]) };
    const result = await svc.getHighRiskPatients(db);
    expect(result).toHaveLength(1);
  });
});
```

---

## 10. Definition of Done

- [ ] `patient_risk_scores` table provisioned; repair passes
- [ ] `PatientRiskScoringService`, `CronRiskSweepService`, `ProactiveRiskController` in `ehr.module.ts`
- [ ] Cron runs at `0 2 * * *` without error
- [ ] `POST /risk/patients/:id/rescore` returns `{ score, level, components }`
- [ ] `GET /risk/high-risk-patients` returns patients sorted by score
- [ ] `high`/`critical` scores trigger `broadcastCriticalAlert`
- [ ] EHR shows `RiskHeatmapPanel` on nurse dashboard
- [ ] Mobile nurse dashboard shows high-risk patient list with score badges
- [ ] `tsc --noEmit` passes in `services/ehr-service/` and `ehr-frontend/`
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
- [ ] `npx expo export --platform all` passes
