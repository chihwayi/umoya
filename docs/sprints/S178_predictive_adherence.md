# S178 — Predictive Medication Adherence Engine

**Phase:** 2 — AI Intelligence Amplification  
**Effort:** M  
**Depends on:** S173  
**Goal:** Daily, score each patient's medication adherence risk. For patients at high risk of missing doses, automatically send a personalised SMS/push nudge — before the dose is missed, not after.

---

## Problem

Medication non-adherence is the leading cause of treatment failure in the system's HIV and hypertension cohorts. The system records missed doses after the fact but never predicts or prevents them. The data exists; the nudge pipeline doesn't.

---

## Acceptance Criteria

1. A daily cron (08:00) scores all patients with active prescriptions for adherence risk.
2. Risk factors: prior missed doses (7/30 day window), refill history, appointment attendance.
3. Risk levels: `low`, `at_risk`, `high_risk`.
4. Patients scoring `at_risk` or `high_risk` receive an SMS/push nudge.
5. Nudge message is personalised (includes patient name and medication name).
6. Nudge history stored in `adherence_nudges` table — no duplicate nudges within 24h.
7. EHR shows adherence risk badge on patient card in the ward list.
8. Clinician dashboard shows top 10 adherence-at-risk patients.
9. Patient portal shows "Adherence Reminder" notification when nudge is sent.
10. `tsc --noEmit` and lint pass.

---

## 1. Database Provisioning

```typescript
{
  id: 'medication_adherence',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS adherence_risk_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      risk_level VARCHAR(16) NOT NULL
        CHECK (risk_level IN ('low','at_risk','high_risk')),
      factors JSONB NOT NULL DEFAULT '{}',
      scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ars_patient ON adherence_risk_scores(patient_id, scored_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_ars_level ON adherence_risk_scores(risk_level, scored_at DESC)`,
    `CREATE TABLE IF NOT EXISTS adherence_nudges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      prescription_id UUID,
      channel VARCHAR(16) NOT NULL
        CHECK (channel IN ('sms','push','both')),
      message_text TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      delivery_status VARCHAR(32) DEFAULT 'sent',
      risk_level VARCHAR(16)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_an_patient ON adherence_nudges(patient_id, sent_at DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_an_24h
      ON adherence_nudges(patient_id)
      WHERE sent_at > now() - INTERVAL '24 hours'`,
  ],
},
```

> Note: The `UNIQUE INDEX ... WHERE sent_at > now()` is a partial index. It prevents the same patient from receiving more than one nudge per 24-hour window via unique constraint violations.
> 
> However, because PostgreSQL evaluates partial index conditions at index creation time, the runtime deduplication must also be enforced in application code. See service below.

---

## 2. Backend — AdherenceEngineService

Create `services/ehr-service/src/services/adherence-engine.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertDeliveryService } from './alert-delivery.service';

@Injectable()
export class AdherenceEngineService {
  private readonly logger = new Logger(AdherenceEngineService.name);

  constructor(
    @Optional() private readonly alertDelivery: AlertDeliveryService,
  ) {}

  async scorePatient(
    patientId: string,
    db: any,
  ): Promise<{ score: number; level: string; factors: Record<string, unknown> }> {
    // Missed doses in last 7 days
    const missed7 = await db.query(
      `SELECT COUNT(*) AS cnt FROM medication_administrations
       WHERE patient_id = $1 AND status = 'missed'
         AND scheduled_at > now() - INTERVAL '7 days'`,
      [patientId],
    );
    const missed7Count = parseInt(missed7[0]?.cnt ?? '0');

    // Missed doses in last 30 days
    const missed30 = await db.query(
      `SELECT COUNT(*) AS cnt FROM medication_administrations
       WHERE patient_id = $1 AND status = 'missed'
         AND scheduled_at > now() - INTERVAL '30 days'`,
      [patientId],
    );
    const missed30Count = parseInt(missed30[0]?.cnt ?? '0');

    // Overdue refills
    const refills = await db.query(
      `SELECT COUNT(*) AS cnt FROM prescriptions
       WHERE patient_id = $1 AND status = 'active'
         AND next_refill_date < now()`,
      [patientId],
    );
    const overdueRefills = parseInt(refills[0]?.cnt ?? '0');

    // Missed appointments in last 60 days
    const appts = await db.query(
      `SELECT COUNT(*) AS cnt FROM appointments
       WHERE patient_id = $1 AND status = 'no_show'
         AND appointment_date > now() - INTERVAL '60 days'`,
      [patientId],
    );
    const missedAppts = parseInt(appts[0]?.cnt ?? '0');

    const factors = { missed7Count, missed30Count, overdueRefills, missedAppts };

    const raw =
      Math.min(missed7Count * 10, 40) +
      Math.min(missed30Count * 2, 30) +
      Math.min(overdueRefills * 15, 20) +
      Math.min(missedAppts * 5, 10);

    const score = Math.min(raw, 100);
    const level =
      score >= 60 ? 'high_risk' :
      score >= 30 ? 'at_risk' : 'low';

    await db.query(
      `INSERT INTO adherence_risk_scores (patient_id, score, risk_level, factors)
       VALUES ($1,$2,$3,$4)`,
      [patientId, score, level, JSON.stringify(factors)],
    );

    return { score, level, factors };
  }

  async sendNudge(
    patientId: string,
    db: any,
    subdomain: string,
    riskLevel: string,
  ): Promise<boolean> {
    // Check if nudge already sent in last 24h (application-level dedup)
    const recent = await db.query(
      `SELECT id FROM adherence_nudges
       WHERE patient_id = $1 AND sent_at > now() - INTERVAL '24 hours'
       LIMIT 1`,
      [patientId],
    );
    if (recent.length > 0) {
      this.logger.debug(`Nudge already sent for patient ${patientId} in last 24h`);
      return false;
    }

    // Get patient name and top active medication
    const patientRows = await db.query(
      `SELECT p.first_name, p.phone, pr.drug_name
       FROM patients p
       LEFT JOIN prescriptions pr ON pr.patient_id = p.id AND pr.status = 'active'
       WHERE p.id = $1
       ORDER BY pr.created_at DESC LIMIT 1`,
      [patientId],
    );
    const patient = patientRows[0] ?? {};

    const message = patient.drug_name
      ? `Hi ${patient.first_name ?? 'there'}, this is a reminder to take your ${patient.drug_name}. Consistent medication is key to your recovery. 💊`
      : `Hi ${patient.first_name ?? 'there'}, don't forget to take your medications today. Your health depends on it!`;

    await db.query(
      `INSERT INTO adherence_nudges
         (patient_id, channel, message_text, risk_level)
       VALUES ($1,'push',$2,$3)`,
      [patientId, message, riskLevel],
    );

    // Deliver via push/alert
    if (this.alertDelivery) {
      try {
        await this.alertDelivery.broadcastCriticalAlert(subdomain, {
          alertType: 'adherence_nudge',
          sourceEntityId: patientId,
          patientId,
          severity: 'info' as any,
          message,
          payload: { type: 'adherence_nudge', riskLevel },
        });
      } catch (err) {
        this.logger.warn(`Nudge delivery failed for patient ${patientId}: ${err.message}`);
      }
    }

    // Insert patient notification for portal
    await db.query(
      `INSERT INTO patient_notifications (patient_id, type, title, body)
       VALUES ($1,'adherence_reminder','Medication Reminder',$2)
       ON CONFLICT DO NOTHING`,
      [patientId, message],
    );

    return true;
  }

  async runDailySweep(
    db: any,
    subdomain: string,
  ): Promise<{ scored: number; nudgesSent: number }> {
    const patients = await db.query(
      `SELECT DISTINCT patient_id FROM prescriptions WHERE status = 'active'`,
    );

    let scored = 0;
    let nudgesSent = 0;

    for (const { patient_id } of patients) {
      try {
        const { score, level } = await this.scorePatient(patient_id, db);
        scored++;
        if (level !== 'low') {
          const sent = await this.sendNudge(patient_id, db, subdomain, level);
          if (sent) nudgesSent++;
        }
      } catch (err) {
        this.logger.warn(`Adherence score failed for ${patient_id}: ${err.message}`);
      }
    }

    return { scored, nudgesSent };
  }

  async getAtRiskPatients(db: any, limit = 20): Promise<unknown[]> {
    return db.query(
      `SELECT DISTINCT ON (ars.patient_id)
         ars.patient_id, ars.score, ars.risk_level, ars.scored_at,
         p.first_name, p.last_name, p.mrn
       FROM adherence_risk_scores ars
       JOIN patients p ON p.id = ars.patient_id
       WHERE ars.risk_level IN ('at_risk','high_risk')
         AND ars.scored_at > now() - INTERVAL '25 hours'
       ORDER BY ars.patient_id, ars.score DESC
       LIMIT $1`,
      [limit],
    );
  }

  async getPatientAdherenceHistory(patientId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT score, risk_level, factors, scored_at
       FROM adherence_risk_scores
       WHERE patient_id = $1
       ORDER BY scored_at DESC LIMIT 30`,
      [patientId],
    );
  }
}
```

---

## 3. Cron Service

Create `services/ehr-service/src/services/cron-adherence.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdherenceEngineService } from './adherence-engine.service';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class CronAdherenceService {
  private readonly logger = new Logger(CronAdherenceService.name);

  constructor(
    private readonly adherence: AdherenceEngineService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Cron('0 8 * * *')
  async runDailySweep(): Promise<void> {
    const tenants = await this.tenantContext.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const { scored, nudgesSent } = await this.adherence.runDailySweep(tenant.db, tenant.subdomain);
        this.logger.log(`${tenant.subdomain}: ${scored} scored, ${nudgesSent} nudges sent`);
      } catch (err) {
        this.logger.error(`Adherence sweep failed for ${tenant.subdomain}: ${err.message}`);
      }
    }
  }
}
```

---

## 4. Backend — AdherenceController

Create `services/ehr-service/src/controllers/adherence.controller.ts`:

```typescript
import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdherenceEngineService } from '../services/adherence-engine.service';

@UseGuards(JwtAuthGuard)
@Controller('adherence')
export class AdherenceController {
  constructor(private readonly adherence: AdherenceEngineService) {}

  @Get('at-risk')
  async getAtRisk(@Req() req: any): Promise<unknown[]> {
    return this.adherence.getAtRiskPatients(req.tenantDb);
  }

  @Get('patients/:patientId/history')
  async getHistory(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.adherence.getPatientAdherenceHistory(patientId, req.tenantDb);
  }

  @Post('patients/:patientId/score')
  async scorePatient(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.adherence.scorePatient(patientId, req.tenantDb);
  }
}
```

---

## 5. Register in ehr.module.ts

```typescript
import { AdherenceEngineService } from './services/adherence-engine.service';
import { CronAdherenceService } from './services/cron-adherence.service';
import { AdherenceController } from './controllers/adherence.controller';

controllers: [ /* ...existing... */ AdherenceController ],
providers: [ /* ...existing... */ AdherenceEngineService, CronAdherenceService ],
```

---

## 6. EHR Frontend — Adherence Risk Badge on Patient Card

In the patient list/ward view, add a small badge next to patients with adherence risk:

```tsx
// In patient card component
{patient.adherenceRisk && patient.adherenceRisk !== 'low' && (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
    backgroundColor: patient.adherenceRisk === 'high_risk' ? '#fee2e2' : '#fff7ed',
    color: patient.adherenceRisk === 'high_risk' ? '#dc2626' : '#f97316',
    marginLeft: 6,
  }}>
    {patient.adherenceRisk === 'high_risk' ? 'ADHERENCE ⚠' : 'AT RISK'}
  </span>
)}
```

Add adherence at-risk panel to clinician dashboard — similar to `RiskHeatmapPanel` (S173) but for adherence.

---

## 7. Mobile — Adherence At-Risk List for Nurses

In `mobile/src/screens/NurseDashboardScreen.tsx`, add after the risk list:

```tsx
const [atRisk, setAtRisk] = useState<any[]>([]);

useEffect(() => {
  api.get('/adherence/at-risk?limit=5')
    .then((r) => setAtRisk(r.data ?? []))
    .catch(() => setAtRisk([]));
}, []);

{atRisk.length > 0 && (
  <View style={{ marginBottom: SPACING.lg }}>
    <Text style={{ fontFamily: FONT.uiBd, fontSize: 15, marginBottom: SPACING.sm }}>
      {t('adherence.at_risk_title')}
    </Text>
    {atRisk.map((p) => (
      <View key={p.patient_id} style={{
        flexDirection: 'row', justifyContent: 'space-between',
        padding: SPACING.sm, backgroundColor: C.bg,
        borderRadius: RADIUS.md, marginBottom: SPACING.xs, ...SHADOW.sm,
      }}>
        <Text style={{ fontFamily: FONT.ui, fontSize: 13 }}>
          {p.first_name} {p.last_name}
        </Text>
        <Text style={{
          fontFamily: FONT.uiBd, fontSize: 12,
          color: p.risk_level === 'high_risk' ? C.red : C.amber,
        }}>
          {p.score}
        </Text>
      </View>
    ))}
  </View>
)}
```

---

## 8. i18n Keys — All 8 Locales

### `en.json`:
```json
"adherence": {
  "at_risk_title": "Adherence At-Risk Patients",
  "high_risk": "High Risk",
  "at_risk": "At Risk",
  "low": "Adherent",
  "nudge_sent": "Medication reminder sent",
  "score": "Adherence Score",
  "history": "Adherence History"
}
```

### `sn.json`:
```json
"adherence": {
  "at_risk_title": "Varwere Vane Njodzi yokurega Mishonga",
  "high_risk": "Njodzi Yakakura",
  "at_risk": "Ari Munhamo",
  "low": "Anotevedzera",
  "nudge_sent": "Cherechedzo chemishonga chatumirwa",
  "score": "Nhamba yokuTevedzera",
  "history": "Nhoroondo yokuTevedzera"
}
```

### `nd.json`:
```json
"adherence": {
  "at_risk_title": "Iziguli Ezingabhekile Ukuthi Zingaphutha",
  "high_risk": "Ingozi Ephezulu",
  "at_risk": "Esengozini",
  "low": "Iyalandela",
  "nudge_sent": "Isikhumbuzo semithi sithunyiwe",
  "score": "Inombolo Yokulandela",
  "history": "Umlando Wokulandela"
}
```

### `pt.json`:
```json
"adherence": {
  "at_risk_title": "Pacientes em Risco de Não Adesão",
  "high_risk": "Alto Risco",
  "at_risk": "Em Risco",
  "low": "Aderente",
  "nudge_sent": "Lembrete de medicação enviado",
  "score": "Pontuação de Adesão",
  "history": "Histórico de Adesão"
}
```

### `fr.json`:
```json
"adherence": {
  "at_risk_title": "Patients à Risque de Non-Observance",
  "high_risk": "Haut Risque",
  "at_risk": "À Risque",
  "low": "Observant",
  "nudge_sent": "Rappel médicament envoyé",
  "score": "Score d'Observance",
  "history": "Historique d'Observance"
}
```

### `sw.json`:
```json
"adherence": {
  "at_risk_title": "Wagonjwa Walio Hatarini ya Kukosa Dawa",
  "high_risk": "Hatari Kubwa",
  "at_risk": "Katika Hatari",
  "low": "Anafuata",
  "nudge_sent": "Ukumbusho wa dawa umetumwa",
  "score": "Alama ya Kufuata",
  "history": "Historia ya Kufuata"
}
```

### `zu.json`:
```json
"adherence": {
  "at_risk_title": "Iziguli Ezisengozini Yokushiya Umuthi",
  "high_risk": "Ingozi Ephezulu",
  "at_risk": "Esengozini",
  "low": "Iyalandela",
  "nudge_sent": "Isikhumbuzo somuthi sithunyiwe",
  "score": "Inombolo Yokulandela",
  "history": "Umlando Wokulandela"
}
```

### `af.json`:
```json
"adherence": {
  "at_risk_title": "Pasiënte met Nakoming Risiko",
  "high_risk": "Hoë Risiko",
  "at_risk": "Onder Risiko",
  "low": "Voldoet",
  "nudge_sent": "Medikasie herinnering gestuur",
  "score": "Nakomingspelling",
  "history": "Nakomingsgeskiedenis"
}
```

---

## 9. Jest Spec

Create `services/ehr-service/src/services/adherence-engine.service.spec.ts`:

```typescript
import { AdherenceEngineService } from './adherence-engine.service';

function makeService(alert?: any) {
  return new AdherenceEngineService(alert ?? null);
}

function makeDb(missed7 = '0', missed30 = '0', refills = '0', missedAppts = '0') {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes("INTERVAL '7 days'")) return Promise.resolve([{ cnt: missed7 }]);
      if (sql.includes("INTERVAL '30 days'")) return Promise.resolve([{ cnt: missed30 }]);
      if (sql.includes('next_refill_date')) return Promise.resolve([{ cnt: refills }]);
      if (sql.includes("status = 'no_show'")) return Promise.resolve([{ cnt: missedAppts }]);
      if (sql.includes('INSERT INTO adherence_risk_scores')) return Promise.resolve([]);
      if (sql.includes('FROM adherence_nudges')) return Promise.resolve([]);
      if (sql.includes('FROM patients')) return Promise.resolve([{ first_name: 'John', phone: '+263771234567', drug_name: 'Metformin' }]);
      if (sql.includes('INSERT INTO adherence_nudges')) return Promise.resolve([]);
      if (sql.includes('patient_notifications')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('AdherenceEngineService', () => {
  it('scores low when no missed doses', async () => {
    const svc = makeService();
    const db = makeDb();
    const result = await svc.scorePatient('p1', db);
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
  });

  it('scores high_risk with many missed doses', async () => {
    const svc = makeService();
    const db = makeDb('4', '15', '0', '0');
    const result = await svc.scorePatient('p1', db);
    expect(result.level).toBe('high_risk');
  });

  it('does not send duplicate nudge within 24h', async () => {
    const svc = makeService();
    const db = makeDb();
    // Mock recent nudge exists
    db.query.mockResolvedValueOnce([{ cnt: '0' }]) // missed7
      .mockResolvedValueOnce([{ cnt: '0' }]) // missed30
      .mockResolvedValueOnce([{ cnt: '0' }]) // refills
      .mockResolvedValueOnce([{ cnt: '0' }]) // missedAppts
      .mockResolvedValueOnce([]) // INSERT adherence_risk_scores
      .mockResolvedValueOnce([{ id: 'existing-nudge' }]); // recent nudge exists

    const sent = await svc.sendNudge('p1', db, 'test', 'at_risk');
    expect(sent).toBe(false);
  });

  it('sends nudge for at_risk patient with no recent nudge', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(alert);
    const db = makeDb();
    const sent = await svc.sendNudge('p1', db, 'clinic1', 'at_risk');
    expect(sent).toBe(true);
  });

  it('getAtRiskPatients returns array', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ patient_id: 'p1', score: 65, risk_level: 'high_risk' }]) };
    const result = await svc.getAtRiskPatients(db);
    expect(result).toHaveLength(1);
  });
});
```

---

## 10. Definition of Done

- [ ] `adherence_risk_scores` and `adherence_nudges` tables provisioned; repair passes
- [ ] `AdherenceEngineService`, `CronAdherenceService`, `AdherenceController` in `ehr.module.ts`
- [ ] Cron runs at `0 8 * * *`
- [ ] `POST /adherence/patients/:id/score` returns `{ score, level, factors }`
- [ ] `GET /adherence/at-risk` returns top at-risk patients
- [ ] No duplicate nudges within 24h (application + DB level)
- [ ] Patient portal shows adherence reminder notification when nudge sent
- [ ] EHR patient cards show adherence risk badge
- [ ] Mobile nurse dashboard shows at-risk adherence list
- [ ] `tsc --noEmit` passes
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
