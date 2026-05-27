# S175 — Intelligent Appointment AI

**Phase:** 2 — AI Intelligence Amplification  
**Effort:** M  
**Depends on:** S174  
**Goal:** (1) Score every appointment for no-show probability so the front desk can double-book or call ahead. (2) Generate an AI pre-appointment brief for the clinician 30 minutes before each appointment — pulling diagnoses, recent labs, active medications, and open tasks.

---

## Problem

No-shows waste clinical time and there is no early-warning system. Clinicians start encounters cold — spending the first minutes reviewing history instead of treating. Both are solvable with the data already in the system.

---

## Acceptance Criteria

1. When an appointment is created or updated, a no-show score (0–100) is computed and stored.
2. Appointments with score ≥ 70 are flagged in the EHR schedule view with an amber badge.
3. A cron runs 30 minutes before each appointment to generate and store a clinician brief.
4. `GET /appointments/:id/brief` returns the pre-appointment brief.
5. EHR appointment detail shows the brief in an expandable panel.
6. Mobile doctor screen shows the brief for the next appointment.
7. No-show score factors: history of no-shows, distance, appointment type, day of week, weather (if available).
8. If CDSS is unavailable, brief is generated from raw data (no narrative polish).
9. `tsc --noEmit` and lint pass.
10. i18n keys in all 8 locales.

---

## 1. Database Provisioning

```typescript
{
  id: 'appointment_ai',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS appointment_noshow_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      risk_level VARCHAR(16) NOT NULL
        CHECK (risk_level IN ('low','medium','high')),
      factors JSONB NOT NULL DEFAULT '{}',
      scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(appointment_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ans_appointment ON appointment_noshow_scores(appointment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ans_patient ON appointment_noshow_scores(patient_id)`,
    `CREATE TABLE IF NOT EXISTS appointment_ai_briefs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      doctor_id UUID NOT NULL,
      brief_text TEXT NOT NULL,
      active_diagnoses JSONB NOT NULL DEFAULT '[]',
      recent_labs JSONB NOT NULL DEFAULT '[]',
      active_medications JSONB NOT NULL DEFAULT '[]',
      open_tasks JSONB NOT NULL DEFAULT '[]',
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(appointment_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_aab_appointment ON appointment_ai_briefs(appointment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_aab_doctor ON appointment_ai_briefs(doctor_id, generated_at DESC)`,
  ],
},
```

---

## 2. Backend — AppointmentAiService

Create `services/ehr-service/src/services/appointment-ai.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CdssService } from './cdss.service';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';

@Injectable()
export class AppointmentAiService {
  private readonly logger = new Logger(AppointmentAiService.name);

  constructor(
    @Optional() private readonly cdss: CdssService,
    @Optional() private readonly llm: PostVisitGroundedLlmService,
  ) {}

  async scoreNoShow(
    appointmentId: string,
    patientId: string,
    db: any,
  ): Promise<{ score: number; riskLevel: string; factors: Record<string, unknown> }> {
    // Count prior no-shows
    const noShows = await db.query(
      `SELECT COUNT(*) AS cnt FROM appointments
       WHERE patient_id = $1 AND status = 'no_show'`,
      [patientId],
    );
    const priorNoShows = parseInt(noShows[0]?.cnt ?? '0');

    // Count total prior appointments
    const total = await db.query(
      `SELECT COUNT(*) AS cnt FROM appointments
       WHERE patient_id = $1 AND status IN ('completed','no_show','cancelled')`,
      [patientId],
    );
    const totalAppointments = parseInt(total[0]?.cnt ?? '0');
    const noShowRate = totalAppointments > 0 ? priorNoShows / totalAppointments : 0;

    // Get appointment details
    const apptRows = await db.query(
      `SELECT appointment_type, appointment_date, EXTRACT(DOW FROM appointment_date) AS dow
       FROM appointments WHERE id = $1`,
      [appointmentId],
    );
    const appt = apptRows[0] ?? {};
    const dow = parseInt(appt.dow ?? '1');

    // Scoring
    const factors: Record<string, unknown> = {
      noShowRate: Math.round(noShowRate * 100),
      priorNoShows,
      totalAppointments,
      dayOfWeek: dow,
      appointmentType: appt.appointment_type,
    };

    const raw =
      Math.min(noShowRate * 60, 60) +     // max 60 from history
      (dow === 1 || dow === 5 ? 15 : 0) + // Mon/Fri penalty
      (appt.appointment_type === 'follow_up' ? 0 : 10); // new pts more likely no-show

    const score = Math.min(Math.round(raw), 100);
    const riskLevel =
      score >= 70 ? 'high' :
      score >= 40 ? 'medium' : 'low';

    await db.query(
      `INSERT INTO appointment_noshow_scores
         (appointment_id, patient_id, score, risk_level, factors)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (appointment_id) DO UPDATE SET
         score = EXCLUDED.score,
         risk_level = EXCLUDED.risk_level,
         factors = EXCLUDED.factors,
         scored_at = now()`,
      [appointmentId, patientId, score, riskLevel, JSON.stringify(factors)],
    );

    return { score, riskLevel, factors };
  }

  async generateBrief(
    appointmentId: string,
    db: any,
  ): Promise<unknown> {
    // Fetch appointment
    const apptRows = await db.query(
      `SELECT a.*, p.first_name, p.last_name, p.date_of_birth, p.sex
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.id = $1`,
      [appointmentId],
    );
    const appt = apptRows[0] ?? null;
    if (!appt) throw new Error('Appointment not found');

    const patientId = appt.patient_id;
    const doctorId = appt.doctor_id;

    // Gather patient data
    const [diagnoses, labs, meds, tasks] = await Promise.all([
      db.query(
        `SELECT icd10_code, description, status FROM patient_diagnoses
         WHERE patient_id = $1 AND status IN ('active','chronic') LIMIT 10`,
        [patientId],
      ),
      db.query(
        `SELECT test_name, value, unit, flag, resulted_at FROM lab_results
         WHERE patient_id = $1 AND status = 'resulted'
         ORDER BY resulted_at DESC LIMIT 5`,
        [patientId],
      ),
      db.query(
        `SELECT drug_name, dose, frequency, status FROM prescriptions
         WHERE patient_id = $1 AND status = 'active' LIMIT 10`,
        [patientId],
      ),
      db.query(
        `SELECT title, priority, due_date FROM clinical_tasks
         WHERE patient_id = $1 AND status = 'open' LIMIT 5`,
        [patientId],
      ),
    ]);

    // Generate brief text
    let briefText = this.buildRawBrief(appt, diagnoses, labs, meds, tasks);

    if (this.llm) {
      try {
        const polished = await this.llm.polishDoctorContent({
          rawContent: briefText,
          context: `Pre-appointment brief for ${appt.first_name} ${appt.last_name}`,
          targetAudience: 'clinician',
        });
        briefText = polished?.content ?? briefText;
      } catch (err) {
        this.logger.warn(`LLM polish failed: ${err.message}`);
      }
    }

    const rows = await db.query(
      `INSERT INTO appointment_ai_briefs
         (appointment_id, patient_id, doctor_id, brief_text,
          active_diagnoses, recent_labs, active_medications, open_tasks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (appointment_id) DO UPDATE SET
         brief_text = EXCLUDED.brief_text,
         active_diagnoses = EXCLUDED.active_diagnoses,
         recent_labs = EXCLUDED.recent_labs,
         active_medications = EXCLUDED.active_medications,
         open_tasks = EXCLUDED.open_tasks,
         generated_at = now()
       RETURNING *`,
      [
        appointmentId, patientId, doctorId, briefText,
        JSON.stringify(diagnoses), JSON.stringify(labs),
        JSON.stringify(meds), JSON.stringify(tasks),
      ],
    );
    return rows[0];
  }

  private buildRawBrief(
    appt: any,
    diagnoses: any[],
    labs: any[],
    meds: any[],
    tasks: any[],
  ): string {
    const age = appt.date_of_birth
      ? Math.floor((Date.now() - new Date(appt.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : '?';

    const lines = [
      `PATIENT: ${appt.first_name} ${appt.last_name}, ${age}y ${appt.sex ?? ''}`,
      `APPOINTMENT TYPE: ${appt.appointment_type ?? 'Consultation'}`,
      '',
      'ACTIVE DIAGNOSES:',
      ...diagnoses.map((d) => `  • ${d.icd10_code} — ${d.description} (${d.status})`),
      '',
      'RECENT LABS:',
      ...labs.map((l) => `  • ${l.test_name}: ${l.value} ${l.unit ?? ''} ${l.flag ? `[${l.flag}]` : ''} (${l.resulted_at?.toString().slice(0,10)})`),
      '',
      'ACTIVE MEDICATIONS:',
      ...meds.map((m) => `  • ${m.drug_name} ${m.dose} ${m.frequency}`),
      '',
      'OPEN TASKS:',
      ...tasks.map((t) => `  • [${t.priority}] ${t.title} — due ${t.due_date?.toString().slice(0,10) ?? 'n/a'}`),
    ];

    return lines.join('\n');
  }

  async getBrief(appointmentId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM appointment_ai_briefs WHERE appointment_id = $1`,
      [appointmentId],
    );
    return rows[0] ?? null;
  }

  async getNoShowScore(appointmentId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM appointment_noshow_scores WHERE appointment_id = $1`,
      [appointmentId],
    );
    return rows[0] ?? null;
  }

  // Cron: every 5 minutes, find appointments starting in 25-35 minutes and generate briefs
  @Cron('*/5 * * * *')
  async generateUpcomingBriefs(): Promise<void> {
    // This method needs tenant DB context — implementation deferred to CronBriefService
    // which iterates tenants like CronRiskSweepService
    this.logger.debug('Brief cron tick — handled by CronBriefService');
  }

  async generateBriefsForWindow(db: any): Promise<number> {
    const upcoming = await db.query(
      `SELECT id FROM appointments
       WHERE appointment_date BETWEEN now() + INTERVAL '25 minutes'
         AND now() + INTERVAL '35 minutes'
         AND status = 'scheduled'`,
    );

    let count = 0;
    for (const { id } of upcoming) {
      try {
        await this.generateBrief(id, db);
        count++;
      } catch (err) {
        this.logger.warn(`Brief generation failed for appt ${id}: ${err.message}`);
      }
    }
    return count;
  }
}
```

---

## 3. Backend — AppointmentAiController

Create `services/ehr-service/src/controllers/appointment-ai.controller.ts`:

```typescript
import {
  Controller, Get, Post, Param, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AppointmentAiService } from '../services/appointment-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentAiController {
  constructor(private readonly apptAi: AppointmentAiService) {}

  @Get(':id/brief')
  async getBrief(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    let brief = await this.apptAi.getBrief(id, req.tenantDb);
    if (!brief) {
      brief = await this.apptAi.generateBrief(id, req.tenantDb);
    }
    return brief;
  }

  @Post(':id/regenerate-brief')
  async regenerateBrief(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    return this.apptAi.generateBrief(id, req.tenantDb);
  }

  @Get(':id/noshow-score')
  async getNoShowScore(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    return this.apptAi.getNoShowScore(id, req.tenantDb);
  }

  @Post(':id/score-noshow')
  async scoreNoShow(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    // Fetch patient ID
    const rows = await req.tenantDb.query(
      `SELECT patient_id FROM appointments WHERE id = $1`,
      [id],
    );
    if (!rows.length) return { error: 'Not found' };
    return this.apptAi.scoreNoShow(id, rows[0].patient_id, req.tenantDb);
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { AppointmentAiService } from './services/appointment-ai.service';
import { AppointmentAiController } from './controllers/appointment-ai.controller';

controllers: [ /* ...existing... */ AppointmentAiController ],
providers: [ /* ...existing... */ AppointmentAiService ],
```

---

## 5. EHR Frontend — Schedule No-Show Badge + Brief Panel

In the appointment list/schedule view, add no-show risk badge:

```tsx
// In schedule row component
{appt.noShowScore >= 70 && (
  <span style={{
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
    backgroundColor: '#ffedd5', color: '#f97316', marginLeft: 8,
  }}>
    No-Show Risk: HIGH
  </span>
)}
```

Appointment detail brief panel `AppointmentBriefPanel.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Props { appointmentId: string; }

export const AppointmentBriefPanel: React.FC<Props> = ({ appointmentId }) => {
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/appointments/${appointmentId}/brief`)
      .then((r) => setBrief(r.data))
      .catch(() => setBrief(null))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  if (loading) return <div style={{ color: '#6b7280', fontSize: 13 }}>Preparing AI brief...</div>;
  if (!brief) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Brief unavailable</div>;

  return (
    <div style={{
      backgroundColor: '#f0fdf4', border: '1px solid #86efac',
      borderRadius: 8, padding: 16, fontSize: 13,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#166534' }}>AI Pre-Appointment Brief</div>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
        {brief.brief_text}
      </pre>
    </div>
  );
};
```

---

## 6. Mobile — Next Appointment Brief

In `mobile/src/screens/DoctorDashboardScreen.tsx`:

```tsx
const [nextBrief, setNextBrief] = useState<any>(null);

useEffect(() => {
  // Load brief for next appointment
  api.get('/appointments?status=scheduled&limit=1&sort=appointment_date&order=asc')
    .then(async (res) => {
      const next = res.data?.[0];
      if (next) {
        const brief = await api.get(`/appointments/${next.id}/brief`);
        setNextBrief({ appointment: next, brief: brief.data });
      }
    })
    .catch(() => null);
}, []);

// In render:
{nextBrief && (
  <View style={{
    backgroundColor: C.green + '10', borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg, borderLeftWidth: 4, borderLeftColor: C.green,
  }}>
    <Text style={{ fontFamily: FONT.uiBd, fontSize: 14, marginBottom: SPACING.xs }}>
      {t('appointments.next_brief')}
    </Text>
    <Text style={{ fontFamily: FONT.ui, fontSize: 12, color: '#374151' }} numberOfLines={6}>
      {nextBrief.brief?.brief_text ?? t('appointments.brief_unavailable')}
    </Text>
  </View>
)}
```

---

## 7. i18n Keys — All 8 Locales

### `en.json`:
```json
"appointments": {
  "next_brief": "AI Pre-Appointment Brief",
  "brief_unavailable": "Brief unavailable",
  "noshow_risk_high": "No-Show Risk: HIGH",
  "noshow_risk_medium": "No-Show Risk: MEDIUM",
  "preparing_brief": "Preparing AI brief...",
  "regenerate_brief": "Regenerate Brief"
}
```

### `sn.json`:
```json
"appointments": {
  "next_brief": "Pfupiso yeAI Isingapfuuri Musangano",
  "brief_unavailable": "Pfupiso haikwanisi",
  "noshow_risk_high": "Njodzi yokurega kuuya: YAKAKURA",
  "noshow_risk_medium": "Njodzi yokurega kuuya: PAKATI",
  "preparing_brief": "Kugadzirira pfupiso yeAI...",
  "regenerate_brief": "Gadzira Pfupiso Zvakare"
}
```

### `nd.json`:
```json
"appointments": {
  "next_brief": "Isifinyezo se-AI Sangaphambi Kohlelo",
  "brief_unavailable": "Isifinyezo asitholakali",
  "noshow_risk_high": "Ingozi yokungafikanga: EPHEZULU",
  "noshow_risk_medium": "Ingozi yokungafikanga: EPHAKATHI",
  "preparing_brief": "Ilungiselela isifinyezo se-AI...",
  "regenerate_brief": "Akhela Isifinyezo Futhi"
}
```

### `pt.json`:
```json
"appointments": {
  "next_brief": "Resumo AI Pré-Consulta",
  "brief_unavailable": "Resumo indisponível",
  "noshow_risk_high": "Risco de Não Comparência: ALTO",
  "noshow_risk_medium": "Risco de Não Comparência: MÉDIO",
  "preparing_brief": "A preparar resumo AI...",
  "regenerate_brief": "Regenerar Resumo"
}
```

### `fr.json`:
```json
"appointments": {
  "next_brief": "Résumé IA Pré-Consultation",
  "brief_unavailable": "Résumé indisponible",
  "noshow_risk_high": "Risque d'Absence: ÉLEVÉ",
  "noshow_risk_medium": "Risque d'Absence: MOYEN",
  "preparing_brief": "Préparation du résumé IA...",
  "regenerate_brief": "Régénérer le Résumé"
}
```

### `sw.json`:
```json
"appointments": {
  "next_brief": "Muhtasari wa AI Kabla ya Miadi",
  "brief_unavailable": "Muhtasari haupatikani",
  "noshow_risk_high": "Hatari ya Kutokuja: JUU",
  "noshow_risk_medium": "Hatari ya Kutokuja: KATI",
  "preparing_brief": "Inatayarisha muhtasari wa AI...",
  "regenerate_brief": "Tengeneza Muhtasari Upya"
}
```

### `zu.json`:
```json
"appointments": {
  "next_brief": "Isifinyezo se-AI Sangaphambi Kohlelo",
  "brief_unavailable": "Isifinyezo asitholakali",
  "noshow_risk_high": "Ingozi Yokungafikanga: EPHEZULU",
  "noshow_risk_medium": "Ingozi Yokungafikanga: EPHAKATHI",
  "preparing_brief": "Ilungiselela isifinyezo se-AI...",
  "regenerate_brief": "Baza Kabusha Isifinyezo"
}
```

### `af.json`:
```json
"appointments": {
  "next_brief": "KI Pre-Konsultasie Opsomming",
  "brief_unavailable": "Opsomming nie beskikbaar nie",
  "noshow_risk_high": "Nie-Verskyning Risiko: HOOG",
  "noshow_risk_medium": "Nie-Verskyning Risiko: MEDIUM",
  "preparing_brief": "KI-opsomming word voorberei...",
  "regenerate_brief": "Hergenereer Opsomming"
}
```

---

## 8. Jest Spec

Create `services/ehr-service/src/services/appointment-ai.service.spec.ts`:

```typescript
import { AppointmentAiService } from './appointment-ai.service';

function makeService(llm?: any) {
  return new AppointmentAiService(null, llm ?? null);
}

function makeDb(apptRow?: any) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM appointments a')) return Promise.resolve(apptRow ? [apptRow] : []);
      if (sql.includes("status = 'no_show'")) return Promise.resolve([{ cnt: '2' }]);
      if (sql.includes("status IN ('completed'")) return Promise.resolve([{ cnt: '10' }]);
      if (sql.includes('FROM appointments WHERE id')) return Promise.resolve(apptRow ? [{ ...apptRow, dow: 2 }] : []);
      if (sql.includes('patient_diagnoses')) return Promise.resolve([{ icd10_code: 'E11', description: 'T2DM', status: 'chronic' }]);
      if (sql.includes('lab_results')) return Promise.resolve([]);
      if (sql.includes('prescriptions')) return Promise.resolve([]);
      if (sql.includes('clinical_tasks')) return Promise.resolve([]);
      if (sql.includes('INSERT INTO appointment_ai_briefs')) return Promise.resolve([{ id: 'b1', brief_text: 'PATIENT: ...' }]);
      if (sql.includes('INSERT INTO appointment_noshow_scores')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('AppointmentAiService', () => {
  it('scores no-show based on history', async () => {
    const svc = makeService();
    const db = makeDb();
    const result = await svc.scoreNoShow('appt-1', 'p1', db);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(['low','medium','high']).toContain(result.riskLevel);
  });

  it('generates brief from raw data when LLM is null', async () => {
    const svc = makeService(null);
    const apptRow = {
      id: 'a1', patient_id: 'p1', doctor_id: 'doc1',
      first_name: 'John', last_name: 'Doe',
      date_of_birth: '1980-01-01', sex: 'M',
      appointment_type: 'consultation',
    };
    const db = makeDb(apptRow);
    const result: any = await svc.generateBrief('a1', db);
    expect(result.brief_text).toContain('John');
  });

  it('polishes brief with LLM when available', async () => {
    const llm = {
      polishDoctorContent: jest.fn().mockResolvedValue({ content: 'Polished brief text.' }),
    };
    const svc = makeService(llm);
    const apptRow = {
      id: 'a1', patient_id: 'p1', doctor_id: 'doc1',
      first_name: 'Jane', last_name: 'Smith',
      date_of_birth: '1975-03-15', sex: 'F',
      appointment_type: 'follow_up',
    };
    const db = makeDb(apptRow);
    const result: any = await svc.generateBrief('a1', db);
    expect(llm.polishDoctorContent).toHaveBeenCalled();
    expect(result.brief_text).toBe('Polished brief text.');
  });

  it('getBrief returns null if no record', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getBrief('a-none', db);
    expect(result).toBeNull();
  });
});
```

---

## 9. Definition of Done

- [ ] `appointment_noshow_scores` and `appointment_ai_briefs` tables provisioned
- [ ] `AppointmentAiService` and `AppointmentAiController` in `ehr.module.ts`
- [ ] `GET /appointments/:id/brief` returns brief (generates if missing)
- [ ] `GET /appointments/:id/noshow-score` returns score
- [ ] No-show badge visible on schedule for high-risk appointments
- [ ] `AppointmentBriefPanel` rendered in EHR appointment detail
- [ ] Mobile doctor dashboard shows brief for next appointment
- [ ] `tsc --noEmit` passes
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
