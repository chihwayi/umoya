# Sprint 240 — Neonatal Screening Programme (NBS, Hearing, CCHD, Bilirubin)

**Module key:** `neonatal_screening`
**Bundle ID:** `sprint240_neonatal_screening`
**Version:** `2026.06.23.0`
**Depends on:** `sprint236_nicu_core`, `sprint237_nicu_advanced` (for NICU admission linkage), `sprint238_well_baby_clinic`
**Followed by:** S241 (Dialysis)

---

## Sprint Goal

Build a standalone Neonatal Screening Programme module that serves both NICU discharges and well-baby patients:
1. **NBS heel prick** — sample sent, batch registration with laboratory, result tracking (TSH, PKU, G6PD, SCD, CAH panel), abnormal result escalation workflow
2. **Newborn hearing screening** — automated OAE (AOAE) pass/refer per ear, ABR referral pathway, follow-up scheduling
3. **CCHD pulse-oximetry protocol** — post-ductal SpO₂, bilateral readings, 3-attempt pass/fail algorithm
4. **Bilirubin screening** — transcutaneous bilirubin (TcB) integration with Bhutani nomogram (from S236), hour-specific risk zone display
5. **Screening completion dashboard** — facility-level coverage tracking per screen type

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint240_neonatal_screening',
  label: 'Sprint 240 — Neonatal Screening: NBS heel prick, hearing OAE, CCHD pulse-ox, bilirubin nomogram, coverage dashboard',
  version: '2026.06.23.0',
  description: 'nbs_batches, nbs_samples, hearing_screening_records, cchd_screening_records, neo_screening_coverage',
  statements: () => [
    // ── NBS Batch Registration ────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nbs_batches (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_ref     TEXT NOT NULL UNIQUE,
      dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lab_name      TEXT NOT NULL DEFAULT 'NSSA / MOHCC NBS Laboratory',
      sample_count  SMALLINT NOT NULL DEFAULT 0,
      results_received BOOLEAN NOT NULL DEFAULT FALSE,
      received_at   TIMESTAMPTZ,
      created_by    UUID REFERENCES users(id)
    )`,

    // ── NBS Samples ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nbs_samples (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id        UUID NOT NULL REFERENCES nbs_batches(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id),
      admission_id    UUID REFERENCES nicu_admissions(id),
      collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      collected_by    UUID REFERENCES users(id),
      age_at_collection_hours SMALLINT,
      card_number     TEXT NOT NULL UNIQUE,
      tsh_result      NUMERIC(8,3),
      tsh_unit        TEXT DEFAULT 'mIU/L',
      tsh_abnormal    BOOLEAN GENERATED ALWAYS AS (tsh_result IS NOT NULL AND tsh_result > 10.0) STORED,
      pku_result      NUMERIC(8,3),
      pku_abnormal    BOOLEAN GENERATED ALWAYS AS (pku_result IS NOT NULL AND pku_result > 120.0) STORED,
      g6pd_result     TEXT CHECK (g6pd_result IN ('normal','deficient','intermediate',NULL)),
      scd_result      TEXT,
      scd_abnormal    BOOLEAN,
      result_status   TEXT NOT NULL DEFAULT 'pending' CHECK (result_status IN ('pending','normal','abnormal','unsatisfactory','repeat_required')),
      any_abnormal    BOOLEAN GENERATED ALWAYS AS (
                        COALESCE(tsh_abnormal, FALSE) OR COALESCE(pku_abnormal, FALSE)
                        OR g6pd_result = 'deficient' OR COALESCE(scd_abnormal, FALSE)
                      ) STORED,
      notified        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nbs_batch ON nbs_samples(batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nbs_patient ON nbs_samples(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nbs_abnormal ON nbs_samples(any_abnormal) WHERE any_abnormal = TRUE`,

    // ── Hearing Screening ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS hearing_screening_records (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id),
      screened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      method          TEXT NOT NULL DEFAULT 'aoae' CHECK (method IN ('aoae','aabr','abr')),
      left_ear_result TEXT NOT NULL CHECK (left_ear_result IN ('pass','refer','incomplete')),
      right_ear_result TEXT NOT NULL CHECK (right_ear_result IN ('pass','refer','incomplete')),
      overall_result  TEXT GENERATED ALWAYS AS (
                        CASE WHEN left_ear_result = 'pass' AND right_ear_result = 'pass' THEN 'bilateral_pass'
                             WHEN left_ear_result = 'refer' AND right_ear_result = 'refer' THEN 'bilateral_refer'
                             WHEN left_ear_result = 'refer' OR right_ear_result = 'refer' THEN 'unilateral_refer'
                             ELSE 'incomplete' END
                      ) STORED,
      requires_abr    BOOLEAN GENERATED ALWAYS AS (
                        left_ear_result = 'refer' OR right_ear_result = 'refer'
                      ) STORED,
      abr_scheduled   BOOLEAN NOT NULL DEFAULT FALSE,
      screened_by     UUID REFERENCES users(id),
      notes           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hearing_patient ON hearing_screening_records(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hearing_abr ON hearing_screening_records(requires_abr) WHERE requires_abr = TRUE`,

    // ── CCHD Pulse-Ox Screening ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cchd_screening_records (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id),
      screened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      age_at_screen_hours SMALLINT NOT NULL,
      attempt_number  SMALLINT NOT NULL DEFAULT 1,
      right_hand_spo2 NUMERIC(4,1),
      foot_spo2       NUMERIC(4,1),
      differential    NUMERIC(4,1) GENERATED ALWAYS AS (
                        CASE WHEN right_hand_spo2 IS NOT NULL AND foot_spo2 IS NOT NULL
                             THEN ABS(right_hand_spo2 - foot_spo2) ELSE NULL END
                      ) STORED,
      screen_result   TEXT GENERATED ALWAYS AS (
                        CASE WHEN right_hand_spo2 >= 95 AND foot_spo2 >= 95
                             AND ABS(right_hand_spo2 - foot_spo2) <= 3 THEN 'pass'
                             WHEN right_hand_spo2 < 90 OR foot_spo2 < 90 THEN 'fail_urgent'
                             ELSE 'fail_repeat' END
                      ) STORED,
      screened_by     UUID REFERENCES users(id),
      notes           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cchd_patient ON cchd_screening_records(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cchd_fail ON cchd_screening_records(screen_result) WHERE screen_result IN ('fail_urgent','fail_repeat')`,

    // ── Neo Screening Coverage Summary View ────────────────────────────────
    `CREATE OR REPLACE VIEW neo_screening_coverage AS
      SELECT
        DATE_TRUNC('month', p.created_at)::date AS month,
        COUNT(DISTINCT p.id)                     AS newborns_registered,
        COUNT(DISTINCT ns.patient_id)            AS nbs_completed,
        COUNT(DISTINCT hs.patient_id)            AS hearing_completed,
        COUNT(DISTINCT cs.patient_id)            AS cchd_completed,
        ROUND(COUNT(DISTINCT ns.patient_id)::numeric / NULLIF(COUNT(DISTINCT p.id), 0) * 100, 1) AS nbs_coverage_pct
      FROM patients p
      LEFT JOIN nbs_samples ns ON ns.patient_id = p.id
      LEFT JOIN hearing_screening_records hs ON hs.patient_id = p.id
      LEFT JOIN cchd_screening_records cs ON cs.patient_id = p.id
      WHERE p.date_of_birth >= NOW() - INTERVAL '1 year'
      GROUP BY DATE_TRUNC('month', p.created_at)
      ORDER BY month DESC`,
  ],
},
```

**Add `neonatal_screening` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/neonatal-screening.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NeonatalScreeningService } from '../services/neonatal-screening.service';

@UseGuards(JwtAuthGuard)
@Controller('neonatal-screening')
export class NeonatalScreeningController {
  constructor(private readonly svc: NeonatalScreeningService) {}

  @Post('nbs/batch')
  createNbsBatch(@Req() req: any, @Body() body: { labName?: string }) {
    return this.svc.createNbsBatch(req.tenantDb, req.user.id, body);
  }

  @Post('nbs/sample')
  addNbsSample(
    @Req() req: any,
    @Body() body: {
      batchId: string; patientId: string; admissionId?: string;
      cardNumber: string; ageAtCollectionHours?: number;
    },
  ) {
    return this.svc.addNbsSample(req.tenantDb, req.user.id, body);
  }

  @Patch('nbs/sample/:id/results')
  recordNbsResults(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { tshResult?: number; pkuResult?: number; g6pdResult?: string; scdResult?: string; scdAbnormal?: boolean; resultStatus: string },
  ) {
    return this.svc.recordNbsResults(req.tenantDb, id, body);
  }

  @Get('nbs/abnormal')
  getAbnormalNbsResults(@Req() req: any) {
    return this.svc.getAbnormalNbsResults(req.tenantDb);
  }

  @Post('hearing')
  recordHearingScreen(
    @Req() req: any,
    @Body() body: { patientId: string; method?: string; leftEarResult: string; rightEarResult: string; notes?: string },
  ) {
    return this.svc.recordHearingScreen(req.tenantDb, req.user.id, body);
  }

  @Get('hearing/pending-abr')
  getPendingAbr(@Req() req: any) {
    return this.svc.getPendingAbrReferrals(req.tenantDb);
  }

  @Post('cchd')
  recordCchdScreen(
    @Req() req: any,
    @Body() body: { patientId: string; ageAtScreenHours: number; rightHandSpo2: number; footSpo2: number; attemptNumber?: number },
  ) {
    return this.svc.recordCchdScreen(req.tenantDb, req.user.id, body);
  }

  @Get('coverage')
  getCoverage(@Req() req: any) {
    return this.svc.getCoverage(req.tenantDb);
  }

  @Get('patient/:patientId/summary')
  getPatientScreeningSummary(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientScreeningSummary(req.tenantDb, patientId);
  }
}
```

**Create file:** `services/ehr-service/src/services/neonatal-screening.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// CCHD AAP 2011 Algorithm: 3 attempts, fail if <90% or >3% differential
function interpretCchd(rightHandSpo2: number, footSpo2: number): { result: string; action: string } {
  if (rightHandSpo2 < 90 || footSpo2 < 90) {
    return { result: 'fail_urgent', action: 'URGENT: SpO₂ <90%. Immediate paediatric/cardiology evaluation. Rule out CCHD, sepsis, respiratory failure.' };
  }
  if (rightHandSpo2 >= 95 && footSpo2 >= 95 && Math.abs(rightHandSpo2 - footSpo2) <= 3) {
    return { result: 'pass', action: 'CCHD screen PASSED. No further action required.' };
  }
  return { result: 'fail_repeat', action: 'CCHD screen FAILED. Repeat in 1 hour. 3 consecutive fails requires cardiac evaluation.' };
}

@Injectable()
export class NeonatalScreeningService {

  async createNbsBatch(db: any, createdBy: string, body: any): Promise<any> {
    const ref = `NBS-${Date.now().toString(36).toUpperCase()}`;
    const rows = await db.query(
      `INSERT INTO nbs_batches (batch_ref, lab_name, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [ref, body.labName ?? 'NSSA / MOHCC NBS Laboratory', createdBy],
    );
    return rows[0] ?? null;
  }

  async addNbsSample(db: any, collectedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nbs_samples (batch_id, patient_id, admission_id, card_number, age_at_collection_hours, collected_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.batchId, body.patientId, body.admissionId ?? null, body.cardNumber, body.ageAtCollectionHours ?? null, collectedBy],
    );
    // Update batch sample count
    await db.query(`UPDATE nbs_batches SET sample_count = sample_count + 1 WHERE id=$1`, [body.batchId]);
    return rows[0] ?? null;
  }

  async recordNbsResults(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE nbs_samples SET
         tsh_result=$1, pku_result=$2, g6pd_result=$3, scd_result=$4, scd_abnormal=$5, result_status=$6
       WHERE id=$7 RETURNING *, tsh_abnormal, pku_abnormal, any_abnormal`,
      [body.tshResult ?? null, body.pkuResult ?? null, body.g6pdResult ?? null, body.scdResult ?? null, body.scdAbnormal ?? false, body.resultStatus, id],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.any_abnormal
        ? `⚠ ABNORMAL NBS RESULT: Immediate escalation required. Notify paediatric team. Do not wait for symptoms.`
        : null,
    };
  }

  async getAbnormalNbsResults(db: any): Promise<any[]> {
    return db.query(
      `SELECT ns.*, p.first_name, p.last_name, p.date_of_birth, b.batch_ref
       FROM nbs_samples ns
       JOIN patients p ON p.id = ns.patient_id
       JOIN nbs_batches b ON b.id = ns.batch_id
       WHERE ns.any_abnormal = TRUE AND ns.notified = FALSE
       ORDER BY ns.created_at DESC`,
    );
  }

  async recordHearingScreen(db: any, screenedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hearing_screening_records (patient_id, method, left_ear_result, right_ear_result, screened_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *, overall_result, requires_abr`,
      [body.patientId, body.method ?? 'aoae', body.leftEarResult, body.rightEarResult, screenedBy, body.notes ?? null],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.requires_abr
        ? `Hearing screen: ${result.overall_result?.replace(/_/g,' ')}. ABR referral required. Schedule within 3 months.`
        : null,
    };
  }

  async getPendingAbrReferrals(db: any): Promise<any[]> {
    return db.query(
      `SELECT hs.*, p.first_name, p.last_name
       FROM hearing_screening_records hs
       JOIN patients p ON p.id = hs.patient_id
       WHERE hs.requires_abr = TRUE AND hs.abr_scheduled = FALSE
       ORDER BY hs.screened_at ASC`,
    );
  }

  async recordCchdScreen(db: any, screenedBy: string, body: any): Promise<any> {
    const interpretation = interpretCchd(body.rightHandSpo2, body.footSpo2);
    const rows = await db.query(
      `INSERT INTO cchd_screening_records (patient_id, age_at_screen_hours, attempt_number, right_hand_spo2, foot_spo2, screened_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *, screen_result, differential`,
      [body.patientId, body.ageAtScreenHours, body.attemptNumber ?? 1, body.rightHandSpo2, body.footSpo2, screenedBy],
    );
    return { ...rows[0], cdss_alert: interpretation.action };
  }

  async getCoverage(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM neo_screening_coverage LIMIT 12`);
  }

  async getPatientScreeningSummary(db: any, patientId: string): Promise<any> {
    const [nbs, hearing, cchd] = await Promise.all([
      db.query(`SELECT * FROM nbs_samples WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 1`, [patientId]),
      db.query(`SELECT *, overall_result, requires_abr FROM hearing_screening_records WHERE patient_id=$1 ORDER BY screened_at DESC LIMIT 1`, [patientId]),
      db.query(`SELECT *, screen_result, differential FROM cchd_screening_records WHERE patient_id=$1 ORDER BY screened_at DESC LIMIT 1`, [patientId]),
    ]);
    return { nbs: nbs[0] ?? null, hearing: hearing[0] ?? null, cchd: cchd[0] ?? null };
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/NeonatalScreeningDashboard.tsx`:
- **Screening Completion Matrix** — table of all newborns, 4 screening columns (NBS/Hearing/CCHD/Bili), checkmark or pending chip
- **Coverage Stats** — 4 metric cards: NBS coverage%, hearing pass rate%, CCHD pass rate%, ABR pending count
- **Abnormal NBS Alert Queue** — coral banner list of unnotified abnormal NBS results with "Notify team" button

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/NeonatalScreeningScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CheckCircle, AlertTriangle, Ear, Heart, Droplet } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const RESULT_COLOR: Record<string, string> = {
  pass: C.green, bilateral_pass: C.green,
  refer: C.coral, bilateral_refer: C.coral, unilateral_refer: C.amber,
  fail_urgent: C.red, fail_repeat: C.coral,
  normal: C.green, abnormal: C.coral, pending: C.textMuted,
};

export default function NeonatalScreeningScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/neonatal-screening/patient/${patientId}/summary`)
      .then((r: any) => setSummary(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const { nbs, hearing, cchd } = summary ?? {};

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>Newborn Screening</Text>
      <Text style={s.sub}>{patientName}</Text>

      {/* NBS Card */}
      <View style={s.card}>
        <View style={s.row}><Droplet size={16} color={C.teal} /><Text style={s.cardTitle}> Heel Prick NBS</Text></View>
        {nbs ? (
          <>
            <Text style={[s.result, { color: RESULT_COLOR[nbs.result_status] ?? C.textMuted }]}>
              {nbs.result_status?.toUpperCase()}
            </Text>
            {nbs.any_abnormal && <Text style={s.alert}>⚠ Abnormal result — escalation required</Text>}
            <Text style={s.detail}>Card: {nbs.card_number}</Text>
          </>
        ) : <Text style={s.notDone}>Not yet collected</Text>}
      </View>

      {/* Hearing Card */}
      <View style={s.card}>
        <View style={s.row}><Ear size={16} color={C.blue} /><Text style={s.cardTitle}> Hearing Screening (AOAE)</Text></View>
        {hearing ? (
          <>
            <Text style={[s.result, { color: RESULT_COLOR[hearing.overall_result] ?? C.textMuted }]}>
              {hearing.overall_result?.replace(/_/g,' ').toUpperCase()}
            </Text>
            <Text style={s.detail}>L: {hearing.left_ear_result} | R: {hearing.right_ear_result}</Text>
            {hearing.requires_abr && <Text style={s.alert}>ABR referral required</Text>}
          </>
        ) : <Text style={s.notDone}>Not yet screened</Text>}
      </View>

      {/* CCHD Card */}
      <View style={s.card}>
        <View style={s.row}><Heart size={16} color={C.coral} /><Text style={s.cardTitle}> CCHD Pulse-Ox</Text></View>
        {cchd ? (
          <>
            <Text style={[s.result, { color: RESULT_COLOR[cchd.screen_result] ?? C.textMuted }]}>
              {cchd.screen_result?.replace(/_/g,' ').toUpperCase()}
            </Text>
            <Text style={s.detail}>RH: {cchd.right_hand_spo2}% | Foot: {cchd.foot_spo2}% | Diff: {cchd.differential?.toFixed(1)}%</Text>
            {cchd.screen_result === 'fail_urgent' && <Text style={s.alertRed}>⚠ URGENT — immediate review</Text>}
          </>
        ) : <Text style={s.notDone}>Not yet screened</Text>}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:    { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:        { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle:  { fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary },
  result:     { fontFamily: FONT.uiBd, fontSize: 18 },
  detail:     { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 4 },
  notDone:    { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
  alert:      { fontFamily: FONT.uiSb, fontSize: 12, color: C.amber, marginTop: 6 },
  alertRed:   { fontFamily: FONT.uiSb, fontSize: 12, color: C.red, marginTop: 6 },
});
```

**Register:** `<Stack.Screen name="NeonatalScreening" component={NeonatalScreeningScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
@app.post("/neonatal-screening/cdss/cchd-algorithm")
async def cchd_algorithm(body: dict):
    """
    AAP 2011 CCHD pulse-oximetry algorithm.
    body: { right_hand_spo2: float, foot_spo2: float, attempt_number: int }
    """
    rh = body.get("right_hand_spo2", 0)
    foot = body.get("foot_spo2", 0)
    attempt = body.get("attempt_number", 1)
    diff = abs(rh - foot)

    if rh < 90 or foot < 90:
        return {"result": "fail_urgent", "action": "URGENT EVALUATION — SpO₂ below 90%. Immediate cardiorespiratory assessment.", "repeat": False}
    if rh >= 95 and foot >= 95 and diff <= 3:
        return {"result": "pass", "action": "CCHD screen PASSED.", "repeat": False}
    if attempt >= 3:
        return {"result": "fail_final", "action": "3 failed attempts. Echocardiography and paediatric cardiology evaluation required.", "repeat": False}
    return {"result": "fail_repeat", "action": f"Attempt {attempt} failed. Repeat in 1 hour.", "repeat": True, "next_attempt": attempt + 1}
```

---

## Acceptance Criteria

- [ ] `nbs_samples.tsh_abnormal` generated as `tsh_result > 10.0`; `pku_abnormal` as `pku_result > 120.0`
- [ ] `nbs_samples.any_abnormal` is a generated column using COALESCE on all abnormal flags
- [ ] `hearing_screening_records.overall_result` and `requires_abr` are generated columns
- [ ] `cchd_screening_records.screen_result` and `differential` are generated columns
- [ ] `PATCH /neonatal-screening/nbs/sample/:id/results` returns `cdss_alert` if `any_abnormal`
- [ ] `GET /neonatal-screening/hearing/pending-abr` returns all unscheduled ABR referrals
- [ ] `POST /neonatal-screening/cchd` returns correct result based on AAP algorithm
- [ ] `NeonatalScreeningScreen.tsx` shows correct result colours per UMOYA palette
- [ ] `'neonatal_screening'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
