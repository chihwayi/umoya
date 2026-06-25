# Sprint 241 — Dialysis: HD, CRRT & Peritoneal Dialysis

**Module key:** `dialysis`
**Bundle ID:** `sprint241_dialysis`
**Version:** `2026.06.23.0`
**Depends on:** none (standalone module, references `patients` and `users`)
**Followed by:** S242 (Aviation Medicine)

---

## Sprint Goal

Build a comprehensive Dialysis module covering all three modalities used at specialist centres:
1. **Haemodialysis (HD) session log** — machine parameters (blood flow, dialysate flow, UFR), session duration, access site, weight pre/post, Kt/V calculation
2. **Vascular access register** — AVF/AVG/CVC/PD catheter tracking, maturation, complications, outcomes
3. **CRRT (Continuous Renal Replacement Therapy)** — ICU CRRT session documentation, effluent dose target, anticoagulation log
4. **Peritoneal Dialysis (PD) records** — dwell prescription, drain/fill volumes, adequacy (weekly Kt/V)
5. **Dialysis adequacy dashboard** — monthly Kt/V trending, session attendance, anaemia management

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint241_dialysis',
  label: 'Sprint 241 — Dialysis: HD sessions, Kt/V, vascular access, CRRT, peritoneal dialysis, adequacy dashboard',
  version: '2026.06.23.0',
  description: 'dialysis_patients, hd_sessions, vascular_access, crrt_sessions, pd_exchanges',
  statements: () => [
    // ── Dialysis Patient Register ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS dialysis_patients (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      modality        TEXT NOT NULL CHECK (modality IN ('hd','crrt','pd','home_hd','home_pd')),
      start_date      DATE NOT NULL,
      primary_diagnosis TEXT NOT NULL,
      target_weight_kg  NUMERIC(5,2),
      interdialytic_weight_gain_limit_kg NUMERIC(4,2) DEFAULT 2.0,
      dialysis_frequency TEXT DEFAULT 'thrice_weekly',
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dialysis_patient ON dialysis_patients(patient_id)`,

    // ── Vascular Access Register ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS vascular_access (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      access_type     TEXT NOT NULL CHECK (access_type IN ('avf','avg','cvc_tunnelled','cvc_non_tunnelled','pd_catheter')),
      site            TEXT NOT NULL,
      creation_date   DATE NOT NULL,
      maturation_date DATE,
      first_use_date  DATE,
      status          TEXT NOT NULL DEFAULT 'maturing' CHECK (status IN ('maturing','in_use','thrombosed','infected','abandoned','removed')),
      flow_ml_min     NUMERIC(6,1),
      complications   JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_primary      BOOLEAN NOT NULL DEFAULT TRUE,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vascular_patient ON vascular_access(patient_id)`,

    // ── HD Sessions ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS hd_sessions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      access_id        UUID REFERENCES vascular_access(id),
      session_date     DATE NOT NULL DEFAULT CURRENT_DATE,
      start_time       TIME NOT NULL,
      end_time         TIME,
      duration_hours   NUMERIC(4,2) GENERATED ALWAYS AS (
                          CASE WHEN end_time IS NOT NULL
                               THEN EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0 ELSE NULL END
                       ) STORED,
      pre_weight_kg    NUMERIC(5,2),
      post_weight_kg   NUMERIC(5,2),
      uf_volume_ml     NUMERIC(7,1) GENERATED ALWAYS AS (
                          CASE WHEN pre_weight_kg IS NOT NULL AND post_weight_kg IS NOT NULL
                               THEN ROUND((pre_weight_kg - post_weight_kg) * 1000, 1) ELSE NULL END
                       ) STORED,
      blood_flow_ml_min   NUMERIC(5,1),
      dialysate_flow_ml_min NUMERIC(6,1),
      dialysate_sodium    NUMERIC(5,1),
      kt_v_measured    NUMERIC(4,3),
      kt_v_adequate    BOOLEAN GENERATED ALWAYS AS (kt_v_measured IS NOT NULL AND kt_v_measured >= 1.2) STORED,
      pre_bp_systolic  SMALLINT,
      pre_bp_diastolic SMALLINT,
      post_bp_systolic SMALLINT,
      post_bp_diastolic SMALLINT,
      access_needled_by UUID REFERENCES users(id),
      session_completed BOOLEAN NOT NULL DEFAULT FALSE,
      complications    JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hd_sessions_patient ON hd_sessions(patient_id, session_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_hd_ktv ON hd_sessions(kt_v_adequate) WHERE kt_v_adequate = FALSE AND kt_v_measured IS NOT NULL`,

    // ── CRRT Sessions ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS crrt_sessions (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id            UUID NOT NULL REFERENCES patients(id),
      icu_admission_id      UUID REFERENCES icu_admissions(id),
      start_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_at                TIMESTAMPTZ,
      modality              TEXT NOT NULL DEFAULT 'cvvhdf' CHECK (modality IN ('cvvh','cvvhd','cvvhdf','scuf')),
      blood_flow_ml_min     NUMERIC(5,1),
      dialysate_flow_ml_h   NUMERIC(6,1),
      replacement_rate_ml_h NUMERIC(6,1),
      target_effluent_ml_kg_h NUMERIC(4,2) DEFAULT 25.0,
      actual_effluent_ml_kg_h NUMERIC(4,2),
      met_dose_target       BOOLEAN GENERATED ALWAYS AS (
                              actual_effluent_ml_kg_h IS NOT NULL
                              AND actual_effluent_ml_kg_h >= target_effluent_ml_kg_h * 0.9
                            ) STORED,
      anticoagulation       TEXT DEFAULT 'none' CHECK (anticoagulation IN ('none','heparin','citrate','prostacyclin')),
      filter_life_hours     NUMERIC(5,1),
      net_fluid_removal_ml_h NUMERIC(6,1),
      managed_by            UUID REFERENCES users(id),
      notes                 TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_crrt_patient ON crrt_sessions(patient_id)`,

    // ── PD Exchanges ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS pd_exchanges (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id),
      exchange_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      exchange_number SMALLINT NOT NULL,
      fill_volume_ml  NUMERIC(6,1) NOT NULL,
      dwell_hours     NUMERIC(4,2) NOT NULL,
      drain_volume_ml NUMERIC(6,1),
      ultrafiltration_ml NUMERIC(6,1) GENERATED ALWAYS AS (
                           CASE WHEN drain_volume_ml IS NOT NULL
                                THEN drain_volume_ml - fill_volume_ml ELSE NULL END
                         ) STORED,
      glucose_pct     NUMERIC(3,1) NOT NULL CHECK (glucose_pct IN (1.5, 2.27, 4.25)),
      effluent_colour TEXT CHECK (effluent_colour IN ('clear','cloudy','bloody','brown',NULL)),
      is_cloudy       BOOLEAN GENERATED ALWAYS AS (effluent_colour = 'cloudy') STORED,
      recorded_by     UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pd_patient ON pd_exchanges(patient_id, exchange_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_pd_peritonitis ON pd_exchanges(is_cloudy) WHERE is_cloudy = TRUE`,

    // ── Dialysis Adequacy View ─────────────────────────────────────────────
    `CREATE OR REPLACE VIEW dialysis_adequacy_summary AS
      SELECT
        patient_id,
        DATE_TRUNC('month', session_date)::date AS month,
        COUNT(*) AS sessions_attended,
        AVG(kt_v_measured) AS avg_ktv,
        SUM(CASE WHEN kt_v_adequate THEN 1 ELSE 0 END) AS adequate_sessions,
        AVG(pre_weight_kg - post_weight_kg) AS avg_uf_kg
      FROM hd_sessions
      WHERE session_completed = TRUE
      GROUP BY patient_id, DATE_TRUNC('month', session_date)
      ORDER BY month DESC`,
  ],
},
```

**Add `dialysis` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/dialysis.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DialysisService } from '../services/dialysis.service';

@UseGuards(JwtAuthGuard)
@Controller('dialysis')
export class DialysisController {
  constructor(private readonly svc: DialysisService) {}

  @Post('patients')
  registerDialysisPatient(@Req() req: any, @Body() body: any) {
    return this.svc.registerDialysisPatient(req.tenantDb, body);
  }

  @Post('access')
  registerAccess(@Req() req: any, @Body() body: any) {
    return this.svc.registerAccess(req.tenantDb, body);
  }

  @Patch('access/:id/status')
  updateAccessStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string; flowMlMin?: number }) {
    return this.svc.updateAccessStatus(req.tenantDb, id, body);
  }

  @Post('hd-sessions')
  startHdSession(
    @Req() req: any,
    @Body() body: {
      patientId: string; accessId?: string;
      preWeightKg: number; bloodFlowMlMin?: number; dialysateFlowMlMin?: number;
      preBpSystolic?: number; preBpDiastolic?: number;
    },
  ) {
    return this.svc.startHdSession(req.tenantDb, req.user.id, body);
  }

  @Patch('hd-sessions/:id/complete')
  completeHdSession(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { postWeightKg: number; ktV?: number; endTime: string; complications?: any[] },
  ) {
    return this.svc.completeHdSession(req.tenantDb, id, body);
  }

  @Get('hd-sessions/:patientId')
  getHdHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getHdHistory(req.tenantDb, patientId);
  }

  @Post('crrt')
  startCrrt(@Req() req: any, @Body() body: any) {
    return this.svc.startCrrt(req.tenantDb, req.user.id, body);
  }

  @Post('pd-exchanges')
  recordPdExchange(@Req() req: any, @Body() body: any) {
    return this.svc.recordPdExchange(req.tenantDb, req.user.id, body);
  }

  @Get('adequacy/:patientId')
  getAdequacy(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getAdequacy(req.tenantDb, patientId);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.svc.getDashboard(req.tenantDb);
  }
}
```

**Create file:** `services/ehr-service/src/services/dialysis.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// Daugirdas II single-pool Kt/V formula approximation
// Kt/V = -ln(R - 0.008t) + (4 - 3.5R) * UF/W
// Where R = post BUN / pre BUN (approximated if not available)
// For simplified calculation: use measured Kt/V if provided, otherwise flag for lab

@Injectable()
export class DialysisService {

  async registerDialysisPatient(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO dialysis_patients (patient_id, modality, start_date, primary_diagnosis, target_weight_kg, dialysis_frequency)
       VALUES ($1,$2,$3::date,$4,$5,$6)
       ON CONFLICT (patient_id) DO UPDATE SET modality=$2, is_active=TRUE, target_weight_kg=$5
       RETURNING *`,
      [body.patientId, body.modality, body.startDate, body.primaryDiagnosis, body.targetWeightKg ?? null, body.dialysisFrequency ?? 'thrice_weekly'],
    );
    return rows[0] ?? null;
  }

  async registerAccess(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO vascular_access (patient_id, access_type, site, creation_date, status, is_primary)
       VALUES ($1,$2,$3,$4::date,$5,$6) RETURNING *`,
      [body.patientId, body.accessType, body.site, body.creationDate, body.status ?? 'maturing', body.isPrimary ?? true],
    );
    return rows[0] ?? null;
  }

  async updateAccessStatus(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE vascular_access SET status=$1, flow_ml_min=COALESCE($2, flow_ml_min) WHERE id=$3 RETURNING *`,
      [body.status, body.flowMlMin ?? null, id],
    );
    return rows[0] ?? null;
  }

  async startHdSession(db: any, accessNeedledBy: string, body: any): Promise<any> {
    const now = new Date();
    const startTime = now.toTimeString().slice(0, 5);
    const rows = await db.query(
      `INSERT INTO hd_sessions (patient_id, access_id, start_time, pre_weight_kg, blood_flow_ml_min, dialysate_flow_ml_min, pre_bp_systolic, pre_bp_diastolic, access_needled_by)
       VALUES ($1,$2,$3::time,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.patientId, body.accessId ?? null, startTime, body.preWeightKg, body.bloodFlowMlMin ?? null, body.dialysateFlowMlMin ?? null, body.preBpSystolic ?? null, body.preBpDiastolic ?? null, accessNeedledBy],
    );
    return rows[0] ?? null;
  }

  async completeHdSession(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE hd_sessions
       SET post_weight_kg=$1, kt_v_measured=$2, end_time=$3::time, session_completed=TRUE,
           complications=$4::jsonb, post_bp_systolic=$5, post_bp_diastolic=$6
       WHERE id=$7 RETURNING *, kt_v_adequate, uf_volume_ml, duration_hours`,
      [body.postWeightKg, body.ktV ?? null, body.endTime, JSON.stringify(body.complications ?? []), body.postBpSystolic ?? null, body.postBpDiastolic ?? null, id],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.kt_v_adequate === false
        ? `⚠ Kt/V ${result.kt_v_measured} is BELOW 1.2 target. Review session length, blood flow, and access adequacy. Consider increasing dialysis frequency.`
        : null,
    };
  }

  async getHdHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT *, kt_v_adequate, uf_volume_ml, duration_hours
       FROM hd_sessions WHERE patient_id=$1 ORDER BY session_date DESC, start_time DESC LIMIT 30`,
      [patientId],
    );
  }

  async startCrrt(db: any, managedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO crrt_sessions (patient_id, icu_admission_id, modality, blood_flow_ml_min, dialysate_flow_ml_h, replacement_rate_ml_h, target_effluent_ml_kg_h, anticoagulation, managed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.patientId, body.icuAdmissionId ?? null, body.modality ?? 'cvvhdf', body.bloodFlowMlMin ?? null, body.dialysateFlowMlH ?? null, body.replacementRateMlH ?? null, body.targetEffluentMlKgH ?? 25, body.anticoagulation ?? 'none', managedBy],
    );
    return rows[0] ?? null;
  }

  async recordPdExchange(db: any, recordedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO pd_exchanges (patient_id, exchange_number, fill_volume_ml, dwell_hours, drain_volume_ml, glucose_pct, effluent_colour, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *, ultrafiltration_ml, is_cloudy`,
      [body.patientId, body.exchangeNumber, body.fillVolumeMl, body.dwellHours, body.drainVolumeMl ?? null, body.glucosePct, body.effluentColour ?? null, recordedBy],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.is_cloudy
        ? `⚠ CLOUDY EFFLUENT: Suspected peritonitis. Send effluent for cell count, culture and sensitivity. Start empirical antibiotics per PD peritonitis protocol.`
        : null,
    };
  }

  async getAdequacy(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM dialysis_adequacy_summary WHERE patient_id=$1 LIMIT 12`,
      [patientId],
    );
  }

  async getDashboard(db: any): Promise<any> {
    const [activePatients, todaySessions, inadequate] = await Promise.all([
      db.query(`SELECT COUNT(*) AS count FROM dialysis_patients WHERE is_active=TRUE`),
      db.query(`SELECT COUNT(*) AS count FROM hd_sessions WHERE session_date=CURRENT_DATE`),
      db.query(`SELECT COUNT(*) AS count FROM hd_sessions WHERE kt_v_adequate=FALSE AND session_date >= CURRENT_DATE - INTERVAL '30 days'`),
    ]);
    return {
      active_patients: Number(activePatients[0]?.count ?? 0),
      sessions_today: Number(todaySessions[0]?.count ?? 0),
      inadequate_sessions_30d: Number(inadequate[0]?.count ?? 0),
    };
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/DialysisDashboard.tsx`:
- **Session Log Table** — session date, Kt/V with green badge ≥1.2 / coral badge <1.2, UF volume, duration, complications
- **Access Status Panel** — per-patient access: type chip (AVF=teal, CVC=amber, PD=blue), status, flow rate
- **Adequacy Trend** — monthly Kt/V line chart; target line at 1.2

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/DialysisSessionScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Activity, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function DialysisSessionScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/dialysis/hd-sessions/${patientId}`)
      .then((r: any) => setSessions(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>HD Session History</Text>
      <Text style={s.sub}>{patientName}</Text>
      <FlatList
        data={sessions}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Activity size={14} color={C.teal} />
              <Text style={s.date}> {item.session_date}</Text>
              {item.kt_v_adequate === true && <CheckCircle size={14} color={C.green} style={s.ml} />}
              {item.kt_v_adequate === false && <AlertTriangle size={14} color={C.coral} style={s.ml} />}
            </View>
            <View style={s.metrics}>
              <Text style={s.metric}>Kt/V: <Text style={[s.val, { color: item.kt_v_adequate ? C.green : C.coral }]}>{item.kt_v_measured ?? '—'}</Text></Text>
              <Text style={s.metric}>UF: <Text style={s.val}>{item.uf_volume_ml ? `${item.uf_volume_ml} ml` : '—'}</Text></Text>
              <Text style={s.metric}>Duration: <Text style={s.val}>{item.duration_hours ? `${parseFloat(item.duration_hours).toFixed(1)}h` : '—'}</Text></Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:       { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  date:      { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, flex: 1 },
  ml:        { marginLeft: 4 },
  metrics:   { flexDirection: 'row', gap: 20 },
  metric:    { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  val:       { fontFamily: FONT.uiSb, color: C.text },
});
```

**Register:** `<Stack.Screen name="DialysisSession" component={DialysisSessionScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
@app.post("/dialysis/cdss/ktv-calculator")
async def calculate_ktv(body: dict):
    """
    Daugirdas II single-pool Kt/V.
    body: { pre_bun: float, post_bun: float, uf_liters: float, post_weight_kg: float, session_hours: float }
    """
    pre_bun = body.get("pre_bun", 1)
    post_bun = body.get("post_bun", 1)
    uf_l = body.get("uf_liters", 0)
    weight_kg = body.get("post_weight_kg", 70)
    t_hours = body.get("session_hours", 4)

    if pre_bun <= 0 or post_bun <= 0 or weight_kg <= 0:
        return {"error": "Invalid inputs for Kt/V calculation."}

    R = post_bun / pre_bun
    import math
    ktv = -math.log(R - 0.008 * t_hours) + (4 - 3.5 * R) * uf_l / weight_kg

    adequate = ktv >= 1.2
    return {
        "kt_v": round(ktv, 3),
        "adequate": adequate,
        "recommendation": "Kt/V adequate." if adequate else f"Kt/V {ktv:.3f} below target 1.2. Increase session duration or blood flow rate."
    }
```

---

## Acceptance Criteria

- [ ] `hd_sessions.uf_volume_ml` generated from `(pre_weight_kg - post_weight_kg) * 1000`
- [ ] `hd_sessions.duration_hours` generated from `end_time - start_time`
- [ ] `hd_sessions.kt_v_adequate` generated as `kt_v_measured >= 1.2`
- [ ] `crrt_sessions.met_dose_target` generated as `actual_effluent >= target * 0.9`
- [ ] `pd_exchanges.ultrafiltration_ml` generated as `drain - fill`; `is_cloudy` generated
- [ ] `POST /dialysis/pd-exchanges` returns peritonitis `cdss_alert` when effluent is cloudy
- [ ] `PATCH /dialysis/hd-sessions/:id/complete` returns Kt/V inadequacy alert when below 1.2
- [ ] `POST /dialysis/cdss/ktv-calculator` correctly computes Daugirdas II Kt/V
- [ ] `'dialysis'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
