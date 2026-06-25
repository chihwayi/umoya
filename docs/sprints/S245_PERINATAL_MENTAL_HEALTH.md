# Sprint 245 — Perinatal Mental Health (EPDS, Bonding & Safeguarding)

**Module key:** `perinatal_mental_health`
**Bundle ID:** `sprint245_perinatal_mental_health`
**Version:** `2026.06.23.0`
**Depends on:** `sprint238_well_baby_clinic` (patients with recent delivery), `sprint228_partograph` (delivery context)
**Followed by:** S246 (NICU Follow-up)

---

## Sprint Goal

Build a Perinatal Mental Health module covering:
1. **EPDS (Edinburgh Postnatal Depression Scale)** — digital 10-item questionnaire, auto-scored, threshold alerts at ≥10 (probable depression) and ≥13 (clinical depression), immediate action pathway at Q10 ≥1 (self-harm ideation)
2. **Mother-infant bonding assessment** — Postpartum Bonding Questionnaire (PBQ) adapted, scored and flagged
3. **Perinatal mental health history** — antenatal mental health screen, medication review in pregnancy, safeguarding risk factors
4. **Safeguarding flags** — risk factor checklist, safeguarding referral workflow, multi-agency case conference documentation
5. **Follow-up schedule** — EPDS re-screen at 6 weeks and 3 months postpartum

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint245_perinatal_mental_health',
  label: 'Sprint 245 — Perinatal Mental Health: EPDS digital screening, PBQ bonding, safeguarding, follow-up schedule',
  version: '2026.06.23.0',
  description: 'pmh_assessments, epds_responses, pbq_responses, pmh_safeguarding_flags, pmh_followup_schedule',
  statements: () => [
    // ── Perinatal Mental Health Assessments ────────────────────────────────
    `CREATE TABLE IF NOT EXISTS pmh_assessments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      days_postpartum SMALLINT,
      timing          TEXT NOT NULL CHECK (timing IN ('antenatal_booking','antenatal_28w','postnatal_6w','postnatal_3m','postnatal_6m','crisis')),
      previous_pmh    BOOLEAN NOT NULL DEFAULT FALSE,
      previous_pmh_details TEXT,
      current_medications TEXT,
      social_support_adequate BOOLEAN,
      domestic_violence_screen TEXT CHECK (domestic_violence_screen IN ('no_concerns','concerns_identified','declined_to_answer',NULL)),
      substance_use   BOOLEAN NOT NULL DEFAULT FALSE,
      housing_concerns BOOLEAN NOT NULL DEFAULT FALSE,
      assessed_by     UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pmh_patient ON pmh_assessments(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pmh_timing ON pmh_assessments(timing, assessment_date DESC)`,

    // ── EPDS Responses ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS epds_responses (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id   UUID NOT NULL REFERENCES pmh_assessments(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id),
      q1_score        SMALLINT NOT NULL CHECK (q1_score BETWEEN 0 AND 3),
      q2_score        SMALLINT NOT NULL CHECK (q2_score BETWEEN 0 AND 3),
      q3_score        SMALLINT NOT NULL CHECK (q3_score BETWEEN 0 AND 3),
      q4_score        SMALLINT NOT NULL CHECK (q4_score BETWEEN 0 AND 3),
      q5_score        SMALLINT NOT NULL CHECK (q5_score BETWEEN 0 AND 3),
      q6_score        SMALLINT NOT NULL CHECK (q6_score BETWEEN 0 AND 3),
      q7_score        SMALLINT NOT NULL CHECK (q7_score BETWEEN 0 AND 3),
      q8_score        SMALLINT NOT NULL CHECK (q8_score BETWEEN 0 AND 3),
      q9_score        SMALLINT NOT NULL CHECK (q9_score BETWEEN 0 AND 3),
      q10_score       SMALLINT NOT NULL CHECK (q10_score BETWEEN 0 AND 3),
      total_score     SMALLINT GENERATED ALWAYS AS (
                          q1_score + q2_score + q3_score + q4_score + q5_score
                          + q6_score + q7_score + q8_score + q9_score + q10_score
                        ) STORED,
      risk_level      TEXT GENERATED ALWAYS AS (
                          CASE
                            WHEN q10_score >= 1 THEN 'critical'
                            WHEN q1_score + q2_score + q3_score + q4_score + q5_score
                                 + q6_score + q7_score + q8_score + q9_score + q10_score >= 13 THEN 'high'
                            WHEN q1_score + q2_score + q3_score + q4_score + q5_score
                                 + q6_score + q7_score + q8_score + q9_score + q10_score >= 10 THEN 'moderate'
                            ELSE 'low'
                          END
                        ) STORED,
      self_harm_ideation BOOLEAN GENERATED ALWAYS AS (q10_score >= 1) STORED,
      reviewed_by     UUID REFERENCES users(id),
      reviewed_at     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_epds_patient ON epds_responses(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_epds_critical ON epds_responses(risk_level) WHERE risk_level = 'critical'`,
    `CREATE INDEX IF NOT EXISTS idx_epds_self_harm ON epds_responses(self_harm_ideation) WHERE self_harm_ideation = TRUE`,

    // ── Safeguarding Flags ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS pmh_safeguarding_flags (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      assessment_id   UUID REFERENCES pmh_assessments(id),
      flag_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      risk_factors    JSONB NOT NULL DEFAULT '[]'::jsonb,
      risk_level      TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','immediate')),
      referral_made   BOOLEAN NOT NULL DEFAULT FALSE,
      referred_to     TEXT,
      referral_date   DATE,
      case_conference_date DATE,
      child_protection_plan BOOLEAN NOT NULL DEFAULT FALSE,
      flagged_by      UUID REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_safeguarding_patient ON pmh_safeguarding_flags(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_safeguarding_urgent ON pmh_safeguarding_flags(risk_level) WHERE risk_level = 'immediate'`,

    // ── Follow-up Schedule ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS pmh_followup_schedule (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      due_date        DATE NOT NULL,
      assessment_timing TEXT NOT NULL,
      completed       BOOLEAN NOT NULL DEFAULT FALSE,
      completed_assessment_id UUID REFERENCES pmh_assessments(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_pmh_followup_unique ON pmh_followup_schedule(patient_id, assessment_timing)`,
  ],
},
```

**Add `perinatal_mental_health` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/perinatal-mental-health.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PerinatalMentalHealthService } from '../services/perinatal-mental-health.service';

@UseGuards(JwtAuthGuard)
@Controller('pmh')
export class PerinatalMentalHealthController {
  constructor(private readonly svc: PerinatalMentalHealthService) {}

  @Post('assessments')
  createAssessment(@Req() req: any, @Body() body: any) {
    return this.svc.createAssessment(req.tenantDb, req.user.id, body);
  }

  @Post('epds')
  submitEpds(
    @Req() req: any,
    @Body() body: {
      assessmentId: string; patientId: string;
      q1: number; q2: number; q3: number; q4: number; q5: number;
      q6: number; q7: number; q8: number; q9: number; q10: number;
    },
  ) {
    return this.svc.submitEpds(req.tenantDb, req.user.id, body);
  }

  @Get('epds/:patientId/history')
  getEpdsHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getEpdsHistory(req.tenantDb, patientId);
  }

  @Get('epds/critical-queue')
  getCriticalQueue(@Req() req: any) {
    return this.svc.getCriticalQueue(req.tenantDb);
  }

  @Patch('epds/:id/reviewed')
  markReviewed(@Req() req: any, @Param('id') id: string) {
    return this.svc.markEpdsReviewed(req.tenantDb, id, req.user.id);
  }

  @Post('safeguarding')
  raiseSafeguardingFlag(@Req() req: any, @Body() body: any) {
    return this.svc.raiseSafeguardingFlag(req.tenantDb, req.user.id, body);
  }

  @Get('safeguarding/:patientId')
  getSafeguardingFlags(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getSafeguardingFlags(req.tenantDb, patientId);
  }

  @Get('followup/overdue')
  getOverdueFollowups(@Req() req: any) {
    return this.svc.getOverdueFollowups(req.tenantDb);
  }
}
```

**Create file:** `services/ehr-service/src/services/perinatal-mental-health.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// EPDS risk interpretation
function interpretEpds(totalScore: number, q10Score: number): { level: string; action: string } {
  if (q10Score >= 1) {
    return {
      level: 'critical',
      action: '🚨 IMMEDIATE SAFETY CONCERN: Patient endorsed self-harm ideation (Q10). Do not leave patient alone. Conduct urgent psychiatric assessment NOW. Complete risk assessment. Notify senior clinician.',
    };
  }
  if (totalScore >= 13) {
    return {
      level: 'high',
      action: 'EPDS ≥13: Probable major depressive episode. Refer to psychiatrist or perinatal mental health specialist within 24 hours. Consider pharmacotherapy. Ensure safe home environment and support.',
    };
  }
  if (totalScore >= 10) {
    return {
      level: 'moderate',
      action: 'EPDS 10–12: Possible depression. Enhanced monitoring. Schedule review in 2 weeks. Counsel on sleep, support networks. Consider CBT referral. Repeat EPDS in 2 weeks.',
    };
  }
  return {
    level: 'low',
    action: 'EPDS <10: Low risk. Routine postnatal support. Re-screen at 3 months postpartum as scheduled.',
  };
}

@Injectable()
export class PerinatalMentalHealthService {

  async createAssessment(db: any, assessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO pmh_assessments (patient_id, assessment_date, days_postpartum, timing, previous_pmh, previous_pmh_details, current_medications, social_support_adequate, domestic_violence_screen, substance_use, housing_concerns, assessed_by)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [body.patientId, body.assessmentDate ?? new Date().toISOString().slice(0, 10), body.daysPostpartum ?? null, body.timing, body.previousPmh ?? false, body.previousPmhDetails ?? null, body.currentMedications ?? null, body.socialSupportAdequate ?? null, body.domesticViolenceScreen ?? null, body.substanceUse ?? false, body.housingConcerns ?? false, assessedBy],
    );
    return rows[0] ?? null;
  }

  async submitEpds(db: any, reviewedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO epds_responses (assessment_id, patient_id, q1_score, q2_score, q3_score, q4_score, q5_score, q6_score, q7_score, q8_score, q9_score, q10_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *, total_score, risk_level, self_harm_ideation`,
      [body.assessmentId, body.patientId, body.q1, body.q2, body.q3, body.q4, body.q5, body.q6, body.q7, body.q8, body.q9, body.q10],
    );
    const result = rows[0];
    const interpretation = interpretEpds(result?.total_score ?? 0, body.q10);

    // Schedule follow-up if not critical
    if (result && result.risk_level !== 'critical') {
      await this.scheduleFollowups(db, body.patientId);
    }

    return {
      ...result,
      cdss_alert: interpretation.action,
      cdss_risk_level: interpretation.level,
    };
  }

  async scheduleFollowups(db: any, patientId: string): Promise<void> {
    const now = new Date();
    const followups = [
      { timing: 'postnatal_6w',  offsetDays: 42  },
      { timing: 'postnatal_3m',  offsetDays: 90  },
      { timing: 'postnatal_6m',  offsetDays: 180 },
    ];
    for (const f of followups) {
      const due = new Date(now.getTime() + f.offsetDays * 86400000);
      await db.query(
        `INSERT INTO pmh_followup_schedule (patient_id, due_date, assessment_timing)
         VALUES ($1,$2::date,$3) ON CONFLICT DO NOTHING`,
        [patientId, due.toISOString().slice(0, 10), f.timing],
      );
    }
  }

  async getEpdsHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT *, total_score, risk_level, self_harm_ideation FROM epds_responses WHERE patient_id=$1 ORDER BY created_at DESC`,
      [patientId],
    );
  }

  async getCriticalQueue(db: any): Promise<any[]> {
    return db.query(
      `SELECT er.*, p.first_name, p.last_name, p.phone
       FROM epds_responses er
       JOIN patients p ON p.id = er.patient_id
       WHERE er.risk_level = 'critical' AND er.reviewed_at IS NULL
       ORDER BY er.created_at ASC`,
    );
  }

  async markEpdsReviewed(db: any, id: string, reviewedBy: string): Promise<any> {
    const rows = await db.query(
      `UPDATE epds_responses SET reviewed_by=$1, reviewed_at=NOW() WHERE id=$2 RETURNING *`,
      [reviewedBy, id],
    );
    return rows[0] ?? null;
  }

  async raiseSafeguardingFlag(db: any, flaggedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO pmh_safeguarding_flags (patient_id, assessment_id, risk_factors, risk_level, referred_to, referral_date, notes, flagged_by)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6::date,$7,$8) RETURNING *`,
      [body.patientId, body.assessmentId ?? null, JSON.stringify(body.riskFactors ?? []), body.riskLevel, body.referredTo ?? null, body.referralDate ?? null, body.notes ?? null, flaggedBy],
    );
    return rows[0] ?? null;
  }

  async getSafeguardingFlags(db: any, patientId: string): Promise<any[]> {
    return db.query(`SELECT * FROM pmh_safeguarding_flags WHERE patient_id=$1 ORDER BY flag_date DESC`, [patientId]);
  }

  async getOverdueFollowups(db: any): Promise<any[]> {
    return db.query(
      `SELECT pf.*, p.first_name, p.last_name, p.phone
       FROM pmh_followup_schedule pf
       JOIN patients p ON p.id = pf.patient_id
       WHERE pf.completed = FALSE AND pf.due_date < CURRENT_DATE
       ORDER BY pf.due_date ASC`,
    );
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/PmhDashboard.tsx`:
- **Critical EPDS Queue** — red/coral banner at top of page when any unreviewed Q10 ≥1 cases exist; patient name, score, time since screening
- **EPDS Digital Form** — 10 questions rendered as radio buttons with UMOYA dark surface styling; running total visible to clinician; final submission triggers CDSS alert display
- **Safeguarding Board** — flagged cases by risk level (immediate=red, high=coral, medium=amber, low=teal)

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/EpdsScreen.tsx`

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { AlertTriangle, CheckCircle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const EPDS_QUESTIONS = [
  { key: 'q1', text: 'I have been able to laugh and see the funny side of things.', reverse: true },
  { key: 'q2', text: 'I have looked forward with enjoyment to things.', reverse: true },
  { key: 'q3', text: 'I have blamed myself unnecessarily when things went wrong.', reverse: false },
  { key: 'q4', text: 'I have been anxious or worried for no good reason.', reverse: false },
  { key: 'q5', text: 'I have felt scared or panicky for no very good reason.', reverse: false },
  { key: 'q6', text: 'Things have been getting on top of me.', reverse: false },
  { key: 'q7', text: 'I have been so unhappy that I have had difficulty sleeping.', reverse: false },
  { key: 'q8', text: 'I have felt sad or miserable.', reverse: false },
  { key: 'q9', text: 'I have been so unhappy that I have been crying.', reverse: false },
  { key: 'q10', text: 'The thought of harming myself has occurred to me.', reverse: false },
];

const OPTIONS_NORMAL  = ['As much as always','Not quite so much','Definitely not so much','Not at all'];
const OPTIONS_REVERSE = ['Never','Hardly ever','Sometimes','Yes, most of the time'];

export default function EpdsScreen({ route }: { route: any }) {
  const { assessmentId, patientId } = route.params;
  const [scores, setScores] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const allAnswered = Object.keys(scores).length === 10;

  const submit = async () => {
    if (!allAnswered) { Alert.alert('Incomplete', 'Please answer all 10 questions.'); return; }
    setSubmitting(true);
    try {
      const r: any = await api.post('/pmh/epds', { assessmentId, patientId, ...Object.fromEntries(EPDS_QUESTIONS.map(q => [q.key.replace('q','q'), scores[q.key]])) });
      setResult(r.data ?? r);
    } catch { Alert.alert('Error', 'Submission failed.'); }
    finally { setSubmitting(false); }
  };

  const riskColor: Record<string, string> = { critical: C.red, high: C.coral, moderate: C.amber, low: C.green };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>EPDS Screening</Text>
      <Text style={s.sub}>Total so far: <Text style={s.total}>{total}</Text> / 30</Text>

      {result ? (
        <View style={[s.resultCard, { borderLeftColor: riskColor[result.cdss_risk_level] ?? C.textMuted, borderLeftWidth: 4 }]}>
          <Text style={[s.resultScore, { color: riskColor[result.cdss_risk_level] }]}>Score: {result.total_score}</Text>
          <Text style={[s.resultLevel, { color: riskColor[result.cdss_risk_level] }]}>{result.risk_level?.toUpperCase()}</Text>
          <Text style={s.resultAction}>{result.cdss_alert}</Text>
        </View>
      ) : (
        <>
          {EPDS_QUESTIONS.map((q, qi) => (
            <View key={q.key} style={s.qCard}>
              <Text style={s.qText}>{qi + 1}. {q.text}</Text>
              {(q.reverse ? OPTIONS_NORMAL : OPTIONS_REVERSE).map((opt, oi) => (
                <TouchableOpacity
                  key={oi}
                  style={[s.option, scores[q.key] === oi && s.optionSelected]}
                  onPress={() => setScores(prev => ({ ...prev, [q.key]: oi }))}
                >
                  <Text style={[s.optionText, scores[q.key] === oi && s.optionTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <TouchableOpacity style={[s.submitBtn, !allAnswered && s.submitDisabled]} onPress={submit} disabled={!allAnswered || submitting}>
            <Text style={s.submitText}>{submitting ? 'Submitting…' : 'Submit EPDS'}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  heading:            { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:                { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  total:              { fontFamily: FONT.uiBd, color: C.teal },
  qCard:              { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 12, ...SHADOW.sm },
  qText:              { fontFamily: FONT.uiMd, fontSize: 14, color: C.text, marginBottom: 10 },
  option:             { paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.sm, marginBottom: 4 },
  optionSelected:     { backgroundColor: C.teal + '33' },
  optionText:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  optionTextSelected: { fontFamily: FONT.uiMd, color: C.teal },
  submitBtn:          { backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitDisabled:     { opacity: 0.5 },
  submitText:         { fontFamily: FONT.uiSb, fontSize: 15, color: C.bg },
  resultCard:         { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, ...SHADOW.card },
  resultScore:        { fontFamily: FONT.uiBd, fontSize: 32 },
  resultLevel:        { fontFamily: FONT.uiSb, fontSize: 14, marginBottom: 10 },
  resultAction:       { fontFamily: FONT.ui, fontSize: 13, color: C.text, lineHeight: 20 },
});
```

**Register:** `<Stack.Screen name="Epds" component={EpdsScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
@app.post("/pmh/cdss/epds-interpret")
async def epds_interpret(body: dict):
    """
    Interpret EPDS total score and Q10.
    body: { total_score: int, q10_score: int, days_postpartum: int }
    """
    total = body.get("total_score", 0)
    q10  = body.get("q10_score", 0)

    if q10 >= 1:
        return {
            "risk_level": "critical",
            "action": "IMMEDIATE SAFETY RISK — self-harm ideation endorsed. Do not leave patient alone. Urgent psychiatric assessment required NOW.",
            "next_steps": ["Stay with patient", "Notify senior clinician immediately", "Complete risk assessment", "Consider psychiatric admission"],
        }
    if total >= 13:
        return {
            "risk_level": "high",
            "action": "Probable major depression (EPDS ≥13). Psychiatric/perinatal MH referral within 24 hours.",
            "next_steps": ["Urgent referral", "Consider SSRIs (discuss breastfeeding safety)", "Safety plan", "Involve family/social support"],
        }
    if total >= 10:
        return {
            "risk_level": "moderate",
            "action": "Possible depression (EPDS 10–12). Enhanced monitoring and psychological support.",
            "next_steps": ["Re-screen in 2 weeks", "CBT or peer support referral", "Sleep support", "Social work if needed"],
        }
    return {
        "risk_level": "low",
        "action": "Low risk (EPDS <10). Routine postnatal support. Scheduled re-screen at 3 months.",
        "next_steps": ["Routine postnatal care", "Re-screen at 3 months"],
    }
```

---

## Acceptance Criteria

- [ ] `epds_responses.total_score` is a generated column summing Q1–Q10
- [ ] `epds_responses.risk_level` is a generated column: `critical` if Q10≥1, `high` if ≥13, `moderate` if ≥10, else `low`
- [ ] `epds_responses.self_harm_ideation` is generated as `q10_score >= 1`
- [ ] `POST /pmh/epds` returns `cdss_alert` with appropriate action and auto-schedules follow-up
- [ ] `GET /pmh/epds/critical-queue` returns only unreviewed Q10≥1 responses
- [ ] `PATCH /pmh/epds/:id/reviewed` sets `reviewed_by` and `reviewed_at`
- [ ] `POST /pmh/cdss/epds-interpret` returns immediate safety action when Q10≥1
- [ ] `EpdsScreen.tsx` shows all 10 EPDS questions with UMOYA dark surface; result shows risk colour
- [ ] `'perinatal_mental_health'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
