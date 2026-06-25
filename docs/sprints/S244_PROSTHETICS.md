# Sprint 244 — Prosthetics & Rehabilitation (Amputee Care)

**Module key:** `prosthetics`
**Bundle ID:** `sprint244_prosthetics`
**Version:** `2026.06.23.0`
**Depends on:** none (references `patients` and `users`)
**Followed by:** S245 (Perinatal Mental Health)

---

## Sprint Goal

Build a Prosthetics & Rehabilitation module covering:
1. **Amputee register** — amputation level (BK/AK/BKB/trans-radial/etc.), aetiology, residual limb status
2. **K-level (Medicare Functional Classification) assessment** — K0–K4 scoring with CDSS-assisted functional potential prediction
3. **Device prescription log** — prosthetic device type, component specification, socket type, alignment notes
4. **Rehabilitation episode** — therapy goals, session attendance, functional milestone tracking
5. **Outcome measures** — TAPES, AMP-Pro, TUG (Timed Up and Go), 6MWT, satisfaction scores

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint244_prosthetics',
  label: 'Sprint 244 — Prosthetics: amputee register, K-level, device prescription, rehab episodes, outcome measures',
  version: '2026.06.23.0',
  description: 'amputee_register, prosthetic_prescriptions, rehab_episodes, prosthetic_outcomes',
  statements: () => [
    // ── Amputee Register ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS amputee_register (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      amputation_date DATE,
      amputation_level TEXT NOT NULL CHECK (amputation_level IN (
                         'hip_disarticulation','transfemoral','knee_disarticulation','transtibial',
                         'syme','foot_partial','shoulder_disarticulation','transhumeral',
                         'elbow_disarticulation','transradial','wrist_disarticulation','hand_partial','bilateral'
                       )),
      laterality      TEXT NOT NULL CHECK (laterality IN ('left','right','bilateral')),
      aetiology       TEXT NOT NULL CHECK (aetiology IN (
                         'dysvascular','diabetic','trauma','congenital','tumour','infection','other'
                       )),
      residual_limb_length TEXT,
      skin_condition  TEXT CHECK (skin_condition IN ('intact','scarred','fragile','ulcerated',NULL)),
      phantom_pain    BOOLEAN NOT NULL DEFAULT FALSE,
      residual_pain   BOOLEAN NOT NULL DEFAULT FALSE,
      k_level         SMALLINT CHECK (k_level BETWEEN 0 AND 4),
      k_assessed_date DATE,
      referral_source TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_amputee_patient ON amputee_register(patient_id)`,

    // ── Prosthetic Prescriptions ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS prosthetic_prescriptions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      prescribed_date DATE NOT NULL DEFAULT CURRENT_DATE,
      device_category TEXT NOT NULL CHECK (device_category IN ('lower_limb','upper_limb','partial_foot','cosmetic')),
      device_type     TEXT NOT NULL,
      socket_type     TEXT,
      suspension_system TEXT,
      knee_component  TEXT,
      foot_ankle_component TEXT,
      liner_type      TEXT,
      prescribed_k_level SMALLINT CHECK (prescribed_k_level BETWEEN 0 AND 4),
      fitting_date    DATE,
      delivery_date   DATE,
      status          TEXT NOT NULL DEFAULT 'prescribed' CHECK (status IN ('prescribed','in_fabrication','fitted','delivered','rejected','returned')),
      prosthetist_id  UUID REFERENCES users(id),
      cost_usd        NUMERIC(10,2),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_prosthetic_patient ON prosthetic_prescriptions(patient_id)`,

    // ── Rehabilitation Episodes ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS prosthetic_rehab_episodes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      prescription_id UUID REFERENCES prosthetic_prescriptions(id),
      start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      end_date        DATE,
      total_sessions_planned SMALLINT DEFAULT 20,
      sessions_attended SMALLINT DEFAULT 0,
      goals           JSONB NOT NULL DEFAULT '[]'::jsonb,
      discharge_status TEXT CHECK (discharge_status IN ('goals_met','partial_goals_met','discharged_early','lost_to_followup',NULL)),
      therapist_id    UUID REFERENCES users(id),
      notes           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rehab_patient ON prosthetic_rehab_episodes(patient_id)`,

    // ── Outcome Measures ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS prosthetic_outcomes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      episode_id      UUID NOT NULL REFERENCES prosthetic_rehab_episodes(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id),
      measured_at     DATE NOT NULL DEFAULT CURRENT_DATE,
      tug_seconds     NUMERIC(6,2),
      six_mwt_metres  NUMERIC(7,2),
      amp_pro_score   SMALLINT CHECK (amp_pro_score BETWEEN 0 AND 42),
      satisfaction_score SMALLINT CHECK (satisfaction_score BETWEEN 0 AND 10),
      daily_wear_hours NUMERIC(4,1),
      gait_deviation  TEXT,
      recorded_by     UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_prosthetic_outcomes_episode ON prosthetic_outcomes(episode_id)`,
  ],
},
```

**Add `prosthetics` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/prosthetics.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProstheticsService } from '../services/prosthetics.service';

@UseGuards(JwtAuthGuard)
@Controller('prosthetics')
export class ProstheticsController {
  constructor(private readonly svc: ProstheticsService) {}

  @Post('register')
  registerAmputee(@Req() req: any, @Body() body: any) {
    return this.svc.registerAmputee(req.tenantDb, body);
  }

  @Get('register')
  getAmputeeRegister(@Req() req: any) {
    return this.svc.getAmputeeRegister(req.tenantDb);
  }

  @Patch('register/:patientId/k-level')
  updateKLevel(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Body() body: { kLevel: number },
  ) {
    return this.svc.updateKLevel(req.tenantDb, patientId, body.kLevel);
  }

  @Post('prescriptions')
  prescribeDevice(@Req() req: any, @Body() body: any) {
    return this.svc.prescribeDevice(req.tenantDb, req.user.id, body);
  }

  @Get('prescriptions/:patientId')
  getPatientPrescriptions(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientPrescriptions(req.tenantDb, patientId);
  }

  @Patch('prescriptions/:id/status')
  updateDeviceStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string; deliveryDate?: string }) {
    return this.svc.updateDeviceStatus(req.tenantDb, id, body);
  }

  @Post('rehab-episodes')
  startRehabEpisode(@Req() req: any, @Body() body: any) {
    return this.svc.startRehabEpisode(req.tenantDb, req.user.id, body);
  }

  @Post('outcomes')
  recordOutcome(@Req() req: any, @Body() body: any) {
    return this.svc.recordOutcome(req.tenantDb, req.user.id, body);
  }

  @Get('outcomes/:episodeId')
  getOutcomes(@Req() req: any, @Param('episodeId') episodeId: string) {
    return this.svc.getOutcomes(req.tenantDb, episodeId);
  }
}
```

**Create file:** `services/ehr-service/src/services/prosthetics.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// K-level functional descriptions per Medicare HCPCS
const K_LEVEL_DESCRIPTIONS: Record<number, string> = {
  0: 'K0 — No potential to ambulate or transfer. Prosthesis does not enhance quality of life.',
  1: 'K1 — Limited household ambulator. Fixed cadence, level surfaces.',
  2: 'K2 — Limited community ambulator. Traverses low-level environmental barriers.',
  3: 'K3 — Community ambulator. Variable cadence, traverses most barriers.',
  4: 'K4 — High activity. Exceeds basic ambulation, prosthetic limb demands beyond community.',
};

@Injectable()
export class ProstheticsService {

  async registerAmputee(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO amputee_register (patient_id, amputation_date, amputation_level, laterality, aetiology, residual_limb_length, skin_condition, phantom_pain, residual_pain, referral_source, notes)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (patient_id) DO UPDATE SET amputation_level=$3, laterality=$4, aetiology=$5
       RETURNING *`,
      [body.patientId, body.amputationDate ?? null, body.amputationLevel, body.laterality, body.aetiology, body.residualLimbLength ?? null, body.skinCondition ?? null, body.phantomPain ?? false, body.residualPain ?? false, body.referralSource ?? null, body.notes ?? null],
    );
    return rows[0] ?? null;
  }

  async getAmputeeRegister(db: any): Promise<any[]> {
    return db.query(
      `SELECT ar.*, p.first_name, p.last_name, p.date_of_birth
       FROM amputee_register ar
       JOIN patients p ON p.id = ar.patient_id
       ORDER BY p.last_name, p.first_name`,
    );
  }

  async updateKLevel(db: any, patientId: string, kLevel: number): Promise<any> {
    const rows = await db.query(
      `UPDATE amputee_register SET k_level=$1, k_assessed_date=CURRENT_DATE WHERE patient_id=$2 RETURNING *`,
      [kLevel, patientId],
    );
    const result = rows[0];
    return { ...result, k_description: K_LEVEL_DESCRIPTIONS[kLevel] };
  }

  async prescribeDevice(db: any, prosthetistId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO prosthetic_prescriptions (patient_id, device_category, device_type, socket_type, suspension_system, knee_component, foot_ankle_component, liner_type, prescribed_k_level, cost_usd, notes, prosthetist_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [body.patientId, body.deviceCategory, body.deviceType, body.socketType ?? null, body.suspensionSystem ?? null, body.kneeComponent ?? null, body.footAnkleComponent ?? null, body.linerType ?? null, body.prescribedKLevel ?? null, body.costUsd ?? null, body.notes ?? null, prosthetistId],
    );
    return rows[0] ?? null;
  }

  async getPatientPrescriptions(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM prosthetic_prescriptions WHERE patient_id=$1 ORDER BY prescribed_date DESC`,
      [patientId],
    );
  }

  async updateDeviceStatus(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE prosthetic_prescriptions SET status=$1, delivery_date=COALESCE($2::date, delivery_date) WHERE id=$3 RETURNING *`,
      [body.status, body.deliveryDate ?? null, id],
    );
    return rows[0] ?? null;
  }

  async startRehabEpisode(db: any, therapistId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO prosthetic_rehab_episodes (patient_id, prescription_id, total_sessions_planned, goals, therapist_id)
       VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *`,
      [body.patientId, body.prescriptionId ?? null, body.totalSessionsPlanned ?? 20, JSON.stringify(body.goals ?? []), therapistId],
    );
    return rows[0] ?? null;
  }

  async recordOutcome(db: any, recordedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO prosthetic_outcomes (episode_id, patient_id, measured_at, tug_seconds, six_mwt_metres, amp_pro_score, satisfaction_score, daily_wear_hours, gait_deviation, recorded_by)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [body.episodeId, body.patientId, body.measuredAt ?? new Date().toISOString().slice(0, 10), body.tugSeconds ?? null, body.sixMwtMetres ?? null, body.ampProScore ?? null, body.satisfactionScore ?? null, body.dailyWearHours ?? null, body.gaitDeviation ?? null, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getOutcomes(db: any, episodeId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM prosthetic_outcomes WHERE episode_id=$1 ORDER BY measured_at ASC`,
      [episodeId],
    );
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/ProstheticsDashboard.tsx`:
- **Amputee Register Table** — amputation level, laterality, K-level badge (K0=muted, K1=blue, K2=teal, K3=green, K4=amber), aetiology, device status
- **K-Level Assessment Card** — dropdown K0–K4 with live description text updating below; CDSS prediction score displayed
- **Outcome Trend Charts** — TUG seconds line (lower=better), 6MWT metres line (higher=better) across rehab sessions

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/ProstheticsScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { User, Activity } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const K_COLOR: Record<number, string> = { 0: C.textMuted, 1: C.blue, 2: C.teal, 3: C.green, 4: C.amber };

export default function ProstheticsScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/prosthetics/prescriptions/${patientId}`)
      .then((r: any) => setPrescriptions(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>Prosthetic Devices</Text>
      <Text style={s.sub}>{patientName}</Text>

      {prescriptions.length === 0 && <Text style={s.empty}>No devices prescribed yet.</Text>}

      {prescriptions.map((p: any) => (
        <View key={p.id} style={s.card}>
          <View style={s.row}>
            <User size={14} color={C.teal} />
            <Text style={s.device}> {p.device_type}</Text>
          </View>
          <Text style={s.category}>{p.device_category?.replace(/_/g,' ')}</Text>
          {p.prescribed_k_level != null && (
            <View style={[s.badge, { backgroundColor: (K_COLOR[p.prescribed_k_level] ?? C.textMuted) + '22' }]}>
              <Text style={[s.badgeText, { color: K_COLOR[p.prescribed_k_level] ?? C.textMuted }]}>
                K{p.prescribed_k_level}
              </Text>
            </View>
          )}
          <Text style={[s.status, { color: p.status === 'delivered' ? C.green : p.status === 'rejected' ? C.coral : C.amber }]}>
            {p.status?.toUpperCase().replace(/_/g,' ')}
          </Text>
          <Text style={s.date}>Prescribed: {p.prescribed_date}</Text>
          {p.delivery_date && <Text style={s.date}>Delivered: {p.delivery_date}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:       { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  device:    { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  category:  { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  badge:     { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill, marginBottom: 6 },
  badgeText: { fontFamily: FONT.uiSb, fontSize: 12 },
  status:    { fontFamily: FONT.uiSb, fontSize: 12, marginBottom: 4 },
  date:      { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
});
```

**Register:** `<Stack.Screen name="Prosthetics" component={ProstheticsScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
@app.post("/prosthetics/cdss/k-level-prediction")
async def predict_k_level(body: dict):
    """
    Predict MFCL K-level from clinical parameters.
    body: { amputation_level: str, aetiology: str, age: int, pre_amputation_ambulatory: bool,
             contralateral_limb_intact: bool, cardiovascular_disease: bool, cognition_intact: bool }
    """
    score = 0
    aetiology = body.get("aetiology", "")
    age = body.get("age", 60)

    # Vascular/diabetic aetiology reduces functional potential
    if aetiology in ("dysvascular", "diabetic"): score -= 1
    if aetiology in ("trauma", "congenital"):    score += 1
    if age < 50:  score += 1
    elif age > 70: score -= 1

    if body.get("pre_amputation_ambulatory"):  score += 2
    if body.get("contralateral_limb_intact"):  score += 1
    if body.get("cardiovascular_disease"):      score -= 1
    if not body.get("cognition_intact", True):  score -= 2

    # Level penalty: higher amputation = lower functional potential
    level = body.get("amputation_level", "transtibial")
    if level in ("transtibial", "syme", "foot_partial"):   score += 1
    elif level in ("transfemoral", "knee_disarticulation"): score -= 1
    elif level in ("hip_disarticulation", "bilateral"):      score -= 2

    predicted = max(0, min(4, 2 + score))  # baseline K2 ± adjustments
    descriptions = {0: "No functional potential", 1: "Household ambulator", 2: "Limited community", 3: "Community ambulator", 4: "High activity"}

    return {
        "predicted_k_level": predicted,
        "description": descriptions[predicted],
        "rationale": f"Score {score} based on aetiology ({aetiology}), age {age}, pre-amputation status, contralateral limb, comorbidities, and amputation level.",
        "note": "Clinical judgement must confirm. K-level determines prosthetic component eligibility."
    }
```

---

## Acceptance Criteria

- [ ] `amputee_register.patient_id` is UNIQUE — one amputee record per patient
- [ ] `PATCH /prosthetics/register/:patientId/k-level` returns K-level description string
- [ ] `POST /prosthetics/outcomes` stores TUG, 6MWT, AMP-Pro, satisfaction score
- [ ] `POST /prosthetics/cdss/k-level-prediction` returns K-level 0–4 based on clinical inputs
- [ ] `ProstheticsScreen.tsx` renders K-level badge with correct UMOYA colour per level
- [ ] `'prosthetics'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
