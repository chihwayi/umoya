# Sprint 235 — ICU AI: Deterioration Alerts, Ventilator Safety & Quality

**Module key:** `icu` (extends S234)
**Bundle ID:** `sprint235_icu_ai_quality`
**Version:** `2026.06.23.0`
**Depends on:** `sprint234_icu_core`
**Followed by:** S237 (NICU Advanced)

---

## Sprint Goal

Extend the ICU module with AI-powered safety and quality features:
1. **SOFA deterioration alerts** — track SOFA delta over 24h, alert when rising ≥2 points (sepsis-3 organ dysfunction criterion)
2. **Lung-protective ventilation guard** — real-time check of tidal volume vs IBW, plateau pressure, driving pressure against ARDSnet protocol limits
3. **AI overnight handover summary** — auto-generate structured ICU handover note from DB state (critical patients, active drips, vent alarms, pending labs)
4. **VAP (Ventilator-Associated Pneumonia) & CAUTI prevention bundles** — checklist documentation and compliance tracking
5. **Fluid overload early warning** — 48h cumulative fluid balance trending with alert threshold

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint235_icu_ai_quality',
  label: 'Sprint 235 — ICU AI: SOFA alerts, vent safety, VAP/CAUTI bundles, handover, fluid balance warnings',
  version: '2026.06.23.0',
  description: 'icu_sofa_delta_alerts, icu_vent_safety_checks, icu_care_bundles, icu_handover_notes',
  statements: () => [
    // ── SOFA Delta Alerts ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_sofa_delta_alerts (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id    UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id),
      score_now       SMALLINT NOT NULL,
      score_24h_ago   SMALLINT NOT NULL,
      delta           SMALLINT GENERATED ALWAYS AS (score_now - score_24h_ago) STORED,
      is_deteriorating BOOLEAN GENERATED ALWAYS AS (score_now - score_24h_ago >= 2) STORED,
      alert_severity  TEXT GENERATED ALWAYS AS (
                        CASE WHEN score_now - score_24h_ago >= 4 THEN 'critical'
                             WHEN score_now - score_24h_ago >= 2 THEN 'high'
                             ELSE 'stable' END
                      ) STORED,
      acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
      acknowledged_by UUID REFERENCES users(id),
      acknowledged_at TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sofa_alert_admission ON icu_sofa_delta_alerts(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sofa_alert_deteriorating ON icu_sofa_delta_alerts(is_deteriorating, created_at DESC) WHERE is_deteriorating = TRUE`,

    // ── Ventilator Safety Checks ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_vent_safety_checks (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id    UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      vent_setting_id UUID REFERENCES icu_ventilator_settings(id),
      patient_ibw_kg  NUMERIC(5,2),
      tv_ml_per_kg_ibw NUMERIC(5,2) GENERATED ALWAYS AS (
                          CASE WHEN patient_ibw_kg > 0
                               THEN NULL  -- computed in application from vent settings join
                               ELSE NULL END
                        ) STORED,
      plateau_safe    BOOLEAN,
      driving_safe    BOOLEAN,
      tv_safe         BOOLEAN,
      overall_safe    BOOLEAN GENERATED ALWAYS AS (
                        COALESCE(plateau_safe, TRUE) AND COALESCE(driving_safe, TRUE) AND COALESCE(tv_safe, TRUE)
                      ) STORED,
      violations      JSONB NOT NULL DEFAULT '[]'::jsonb,
      checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vent_safety_admission ON icu_vent_safety_checks(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vent_safety_unsafe ON icu_vent_safety_checks(overall_safe) WHERE overall_safe = FALSE`,

    // ── VAP / CAUTI Care Bundle Documentation ─────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_care_bundles (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id    UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      bundle_date     DATE NOT NULL DEFAULT CURRENT_DATE,
      bundle_type     TEXT NOT NULL CHECK (bundle_type IN ('vap','cauti','ssc','clabsi','dvt')),
      items           JSONB NOT NULL DEFAULT '[]'::jsonb,
      compliant_count SMALLINT,
      total_items     SMALLINT,
      compliance_pct  NUMERIC(5,2) GENERATED ALWAYS AS (
                        CASE WHEN total_items > 0
                             THEN ROUND(compliant_count::numeric / total_items * 100, 2)
                             ELSE NULL END
                      ) STORED,
      documented_by   UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_care_bundle_day ON icu_care_bundles(admission_id, bundle_date, bundle_type)`,
    `CREATE INDEX IF NOT EXISTS idx_care_bundle_type ON icu_care_bundles(bundle_type, bundle_date DESC)`,

    // ── ICU Handover Notes ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_handover_notes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      handover_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      shift           TEXT NOT NULL CHECK (shift IN ('morning','afternoon','night')),
      generated_by    UUID REFERENCES users(id),
      is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
      patient_count   SMALLINT,
      critical_count  SMALLINT,
      summary_text    TEXT NOT NULL,
      key_actions     JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_handover_shift ON icu_handover_notes(handover_date, shift)`,

    // ── 48h Fluid Balance View ────────────────────────────────────────────
    `CREATE OR REPLACE VIEW icu_fluid_48h_summary AS
      SELECT
        admission_id,
        SUM(net_balance_ml) AS cumulative_48h_ml,
        COUNT(*)            AS balance_days_recorded,
        MAX(balance_date)   AS last_balance_date
      FROM icu_fluid_balance
      WHERE balance_date >= CURRENT_DATE - INTERVAL '2 days'
      GROUP BY admission_id`,
  ],
},
```

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/icu-ai.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IcuAiService } from '../services/icu-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('icu/ai')
export class IcuAiController {
  constructor(private readonly svc: IcuAiService) {}

  @Post('sofa-alert')
  createSofaAlert(
    @Req() req: any,
    @Body() body: { admissionId: string; patientId: string; scoreNow: number; score24hAgo: number },
  ) {
    return this.svc.createSofaAlert(req.tenantDb, body);
  }

  @Get('sofa-alerts/active')
  getActiveSofaAlerts(@Req() req: any) {
    return this.svc.getActiveSofaAlerts(req.tenantDb);
  }

  @Patch('sofa-alerts/:id/acknowledge')
  acknowledgeSofaAlert(@Req() req: any, @Param('id') id: string) {
    return this.svc.acknowledgeSofaAlert(req.tenantDb, id, req.user.id);
  }

  @Post('vent-safety-check')
  ventSafetyCheck(
    @Req() req: any,
    @Body() body: { admissionId: string; ventSettingId?: string; patientIbwKg: number },
  ) {
    return this.svc.runVentSafetyCheck(req.tenantDb, body);
  }

  @Post('care-bundle')
  documentBundle(
    @Req() req: any,
    @Body() body: {
      admissionId: string; bundleType: string;
      items: Array<{ name: string; compliant: boolean }>;
    },
  ) {
    return this.svc.documentCareBundle(req.tenantDb, req.user.id, body);
  }

  @Get('care-bundle/:admissionId')
  getBundleHistory(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getBundleHistory(req.tenantDb, admissionId);
  }

  @Post('handover/generate')
  generateHandover(@Req() req: any, @Body() body: { shift: string }) {
    return this.svc.generateHandoverNote(req.tenantDb, req.user.id, body.shift);
  }

  @Get('handover/latest')
  getLatestHandover(@Req() req: any) {
    return this.svc.getLatestHandover(req.tenantDb);
  }

  @Get('fluid-overload-warnings')
  getFluidOverloadWarnings(@Req() req: any) {
    return this.svc.getFluidOverloadWarnings(req.tenantDb);
  }
}
```

**Create file:** `services/ehr-service/src/services/icu-ai.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// ARDSnet ventilator safety thresholds
const VENT_LIMITS = {
  plateau_max_cmH2O: 30,
  driving_max_cmH2O: 15,
  tv_max_ml_per_kg: 6,    // 6 ml/kg IBW
  tv_warning_ml_per_kg: 8, // warn above 8
};

// VAP bundle items per ICU best practice
const VAP_BUNDLE_ITEMS = [
  'head_of_bed_30_45_degrees',
  'daily_sedation_vacation',
  'daily_extubation_assessment',
  'peptic_ulcer_prophylaxis',
  'dvt_prophylaxis',
  'oral_care_with_chlorhexidine',
];

// CAUTI bundle items
const CAUTI_BUNDLE_ITEMS = [
  'catheter_necessity_reviewed',
  'closed_drainage_system',
  'catheter_below_bladder',
  'daily_catheter_care',
  'consider_removal_today',
];

@Injectable()
export class IcuAiService {
  constructor(private readonly http: HttpService) {}

  async createSofaAlert(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_sofa_delta_alerts (admission_id, patient_id, score_now, score_24h_ago)
       VALUES ($1,$2,$3,$4) RETURNING *, delta, is_deteriorating, alert_severity`,
      [body.admissionId, body.patientId, body.scoreNow, body.score24hAgo],
    );
    return rows[0] ?? null;
  }

  async getActiveSofaAlerts(db: any): Promise<any[]> {
    return db.query(
      `SELECT sa.*, p.first_name, p.last_name, ia.bed_number
       FROM icu_sofa_delta_alerts sa
       JOIN patients p ON p.id = sa.patient_id
       JOIN icu_admissions ia ON ia.id = sa.admission_id
       WHERE sa.acknowledged = FALSE AND sa.is_deteriorating = TRUE
       ORDER BY sa.alert_severity DESC, sa.created_at DESC`,
    );
  }

  async acknowledgeSofaAlert(db: any, id: string, acknowledgedBy: string): Promise<any> {
    const rows = await db.query(
      `UPDATE icu_sofa_delta_alerts SET acknowledged=TRUE, acknowledged_by=$1, acknowledged_at=NOW()
       WHERE id=$2 RETURNING *`,
      [acknowledgedBy, id],
    );
    return rows[0] ?? null;
  }

  async runVentSafetyCheck(db: any, body: any): Promise<any> {
    // Fetch latest ventilator settings for this admission
    const settings = await db.query(
      `SELECT * FROM icu_ventilator_settings WHERE admission_id=$1 ORDER BY recorded_at DESC LIMIT 1`,
      [body.admissionId],
    );
    if (!settings[0]) return { safe: null, message: 'No ventilator settings found.' };

    const vent = settings[0];
    const ibwKg = body.patientIbwKg ?? 70;
    const tvPerKg = vent.tidal_volume_ml / ibwKg;
    const violations: string[] = [];

    const plateauSafe = (vent.plateau_pressure_cmh2o ?? 0) <= VENT_LIMITS.plateau_max_cmH2O;
    const drivingSafe = (vent.driving_pressure ?? 0) <= VENT_LIMITS.driving_max_cmH2O;
    const tvSafe = tvPerKg <= VENT_LIMITS.tv_max_ml_per_kg;

    if (!plateauSafe) violations.push(`Plateau pressure ${vent.plateau_pressure_cmh2o} cmH₂O exceeds 30 cmH₂O limit — adjust PEEP or TV.`);
    if (!drivingSafe) violations.push(`Driving pressure ${vent.driving_pressure} cmH₂O exceeds 15 cmH₂O limit — increase PEEP or reduce TV.`);
    if (!tvSafe) violations.push(`TV ${tvPerKg.toFixed(1)} ml/kg IBW exceeds ARDSnet 6 ml/kg limit — reduce tidal volume.`);
    else if (tvPerKg > VENT_LIMITS.tv_warning_ml_per_kg) violations.push(`TV ${tvPerKg.toFixed(1)} ml/kg IBW is above 8 ml/kg — consider reduction if ARDS suspected.`);

    await db.query(
      `INSERT INTO icu_vent_safety_checks (admission_id, vent_setting_id, patient_ibw_kg, plateau_safe, driving_safe, tv_safe, violations)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [body.admissionId, vent.id, ibwKg, plateauSafe, drivingSafe, tvSafe, JSON.stringify(violations.map(v => ({ message: v })))],
    );
    return {
      overall_safe: plateauSafe && drivingSafe && tvSafe,
      plateau_safe: plateauSafe,
      driving_safe: drivingSafe,
      tv_safe: tvSafe,
      tv_per_kg_ibw: tvPerKg.toFixed(2),
      violations,
    };
  }

  async documentCareBundle(db: any, documentedBy: string, body: any): Promise<any> {
    const compliantCount = body.items.filter((i: any) => i.compliant).length;
    const rows = await db.query(
      `INSERT INTO icu_care_bundles (admission_id, bundle_type, items, compliant_count, total_items, documented_by)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6)
       ON CONFLICT (admission_id, bundle_date, bundle_type)
       DO UPDATE SET items=$3::jsonb, compliant_count=$4, total_items=$5, documented_by=$6, created_at=NOW()
       RETURNING *, compliance_pct`,
      [body.admissionId, body.bundleType, JSON.stringify(body.items), compliantCount, body.items.length, documentedBy],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.compliance_pct < 80
        ? `⚠ ${body.bundleType.toUpperCase()} bundle compliance ${result.compliance_pct}% — below 80% threshold. Review non-compliant items.`
        : null,
    };
  }

  async getBundleHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_care_bundles WHERE admission_id=$1 ORDER BY bundle_date DESC, bundle_type`,
      [admissionId],
    );
  }

  async generateHandoverNote(db: any, generatedBy: string, shift: string): Promise<any> {
    // Gather current ICU census state
    const [census, alerts, ventAlarms, fluidWarnings] = await Promise.all([
      db.query(`SELECT p.first_name, p.last_name, ia.bed_number, ia.diagnosis, ia.sofa_score FROM icu_admissions ia JOIN patients p ON p.id=ia.patient_id WHERE ia.discharge_at IS NULL ORDER BY ia.sofa_score DESC NULLS LAST`),
      db.query(`SELECT p.first_name, ia.bed_number, sa.score_now, sa.delta FROM icu_sofa_delta_alerts sa JOIN icu_admissions ia ON ia.id=sa.admission_id JOIN patients p ON p.id=sa.patient_id WHERE sa.acknowledged=FALSE AND sa.is_deteriorating=TRUE`),
      db.query(`SELECT ia.bed_number, p.first_name FROM icu_ventilator_settings vs JOIN icu_admissions ia ON ia.id=vs.admission_id JOIN patients p ON p.id=ia.patient_id WHERE vs.is_alarm_driving_pressure=TRUE OR vs.is_alarm_plateau=TRUE`),
      db.query(`SELECT ia.bed_number, p.first_name, f.cumulative_48h_ml FROM icu_fluid_48h_summary f JOIN icu_admissions ia ON ia.id=f.admission_id JOIN patients p ON p.id=ia.patient_id WHERE f.cumulative_48h_ml > 3000`),
    ]);

    const criticalCount = census.filter((p: any) => p.sofa_score >= 10).length;

    const summaryLines = [
      `ICU ${shift.toUpperCase()} HANDOVER — ${new Date().toISOString().slice(0, 10)}`,
      `Total patients: ${census.length} | Critical (SOFA≥10): ${criticalCount}`,
      '',
      '--- ACTIVE DETERIORATION ALERTS ---',
      ...(alerts.length > 0 ? alerts.map((a: any) => `• Bed ${a.bed_number} ${a.first_name}: SOFA ${a.score_now} (Δ+${a.delta})`) : ['None']),
      '',
      '--- VENTILATOR ALARMS ---',
      ...(ventAlarms.length > 0 ? ventAlarms.map((v: any) => `• Bed ${v.bed_number} ${v.first_name}: Vent alarm active`) : ['None']),
      '',
      '--- FLUID OVERLOAD WARNINGS (48h cumulative >3L) ---',
      ...(fluidWarnings.length > 0 ? fluidWarnings.map((f: any) => `• Bed ${f.bed_number} ${f.first_name}: +${f.cumulative_48h_ml} ml`) : ['None']),
      '',
      '--- CENSUS ---',
      ...census.map((p: any) => `Bed ${p.bed_number}: ${p.first_name} ${p.last_name} — ${p.diagnosis ?? 'unknown'} — SOFA ${p.sofa_score ?? '?'}`),
    ];

    const summaryText = summaryLines.join('\n');

    const rows = await db.query(
      `INSERT INTO icu_handover_notes (handover_date, shift, generated_by, is_ai_generated, patient_count, critical_count, summary_text, key_actions)
       VALUES (CURRENT_DATE,$1,$2,TRUE,$3,$4,$5,'[]'::jsonb)
       ON CONFLICT (handover_date, shift) DO UPDATE SET summary_text=$5, patient_count=$3, critical_count=$4, created_at=NOW()
       RETURNING *`,
      [shift, generatedBy, census.length, criticalCount, summaryText],
    );
    return rows[0] ?? null;
  }

  async getLatestHandover(db: any): Promise<any> {
    const rows = await db.query(
      `SELECT * FROM icu_handover_notes ORDER BY handover_date DESC, created_at DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async getFluidOverloadWarnings(db: any): Promise<any[]> {
    return db.query(
      `SELECT f.*, ia.bed_number, p.first_name, p.last_name
       FROM icu_fluid_48h_summary f
       JOIN icu_admissions ia ON ia.id = f.admission_id
       JOIN patients p ON p.id = ia.patient_id
       WHERE f.cumulative_48h_ml > 3000
       ORDER BY f.cumulative_48h_ml DESC`,
    );
  }
}
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/IcuAiDashboard.tsx`

Key UI elements:
- **Alert Rail** (left sidebar) — SOFA deterioration alerts as stacked cards with coral `#E8614D` left border; acknowledge button on each
- **Vent Safety Panel** — per-ventilated patient: green checkmarks if safe, coral exclamation per violation
- **Bundle Compliance Gauges** — VAP + CAUTI compliance % as arc gauges; <80% = coral fill, ≥80% = teal
- **Handover Modal** — "Generate Handover" button opens modal with rendered handover text, copy to clipboard action

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/IcuAlertsScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { AlertTriangle, CheckCircle, Wind } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const SEVERITY_COLOR: Record<string, string> = {
  critical: C.red,
  high:     C.coral,
  stable:   C.teal,
};

export default function IcuAlertsScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/icu/ai/sofa-alerts/active')
      .then((r: any) => setAlerts(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const acknowledge = async (id: string) => {
    try {
      await api.patch(`/icu/ai/sofa-alerts/${id}/acknowledge`, {});
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {
      Alert.alert('Error', 'Could not acknowledge alert.');
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>ICU Active Alerts</Text>
      <Text style={s.sub}>{alerts.length} active deterioration alert{alerts.length !== 1 ? 's' : ''}</Text>

      {alerts.length === 0 && (
        <View style={s.emptyBox}>
          <CheckCircle size={32} color={C.green} />
          <Text style={s.emptyText}>No active alerts</Text>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[s.card, { borderLeftColor: SEVERITY_COLOR[item.alert_severity], borderLeftWidth: 4 }]}>
            <View style={s.row}>
              <AlertTriangle size={16} color={SEVERITY_COLOR[item.alert_severity]} />
              <Text style={s.name}> Bed {item.bed_number} — {item.first_name} {item.last_name}</Text>
            </View>
            <Text style={[s.severity, { color: SEVERITY_COLOR[item.alert_severity] }]}>
              {item.alert_severity?.toUpperCase()} — SOFA {item.score_now} (Δ +{item.delta})
            </Text>
            <Text style={s.ts}>{new Date(item.created_at).toLocaleTimeString()}</Text>
            <TouchableOpacity style={s.ackBtn} onPress={() => acknowledge(item.id)}>
              <Text style={s.ackText}>Acknowledge</Text>
            </TouchableOpacity>
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
  emptyBox:  { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontFamily: FONT.uiMd, fontSize: 16, color: C.textMuted },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  name:      { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  severity:  { fontFamily: FONT.uiSb, fontSize: 13 },
  ts:        { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 4 },
  ackBtn:    { marginTop: 12, backgroundColor: C.teal + '22', borderRadius: RADIUS.pill, paddingVertical: 8, alignItems: 'center' },
  ackText:   { fontFamily: FONT.uiSb, fontSize: 13, color: C.teal },
});
```

**Register:** `<Stack.Screen name="IcuAlerts" component={IcuAlertsScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
# ── ICU AI CDSS endpoints ──────────────────────────────────────────────────

@app.post("/icu/cdss/vent-safety")
async def check_ventilator_safety(body: dict):
    """
    Validate current ventilator settings against ARDSnet lung-protective thresholds.
    body: {
      tidal_volume_ml: float,
      plateau_pressure_cmh2o: float,
      peep_cmh2o: float,
      fio2: float,
      patient_height_cm: float,
      sex: str   # 'male' or 'female' for IBW calculation
    }
    """
    h = body.get("patient_height_cm", 170)
    sex = body.get("sex", "male")
    # IBW calculation (Devine formula)
    ibw = (50 if sex == "male" else 45.5) + 0.91 * (h - 152.4)
    ibw = max(ibw, 30)

    tv = body.get("tidal_volume_ml", 500)
    plateau = body.get("plateau_pressure_cmh2o", 0)
    peep = body.get("peep_cmh2o", 5)
    driving = plateau - peep
    tv_per_kg = tv / ibw

    violations = []
    if tv_per_kg > 6:
        violations.append({"severity": "critical", "param": "tidal_volume", "message": f"TV {tv_per_kg:.1f} ml/kg IBW exceeds ARDSnet 6 ml/kg. Reduce to {ibw*6:.0f} ml."})
    elif tv_per_kg > 8:
        violations.append({"severity": "warning", "param": "tidal_volume", "message": f"TV {tv_per_kg:.1f} ml/kg IBW > 8 ml/kg. Consider reduction if ARDS risk."})
    if plateau > 30:
        violations.append({"severity": "critical", "param": "plateau_pressure", "message": f"Plateau {plateau} cmH₂O exceeds 30 cmH₂O. Reduce TV or adjust PEEP."})
    if driving > 15:
        violations.append({"severity": "critical", "param": "driving_pressure", "message": f"Driving pressure {driving:.0f} cmH₂O exceeds 15 cmH₂O (mortality risk). Increase PEEP or reduce TV."})

    return {
        "ibw_kg": round(ibw, 1),
        "tv_per_kg_ibw": round(tv_per_kg, 2),
        "driving_pressure": round(driving, 1),
        "lung_protective": len(violations) == 0,
        "violations": violations,
    }

@app.post("/icu/cdss/sofa-trend")
async def sofa_trend_analysis(body: dict):
    """
    Analyse SOFA score trend for early sepsis deterioration.
    body: { scores: list[{ timestamp: str, score: int }] }
    """
    scores = body.get("scores", [])
    if len(scores) < 2:
        return {"trend": "insufficient_data", "recommendation": "Need at least 2 SOFA readings to trend."}

    latest = scores[-1]["score"]
    earliest = scores[0]["score"]
    delta = latest - earliest
    peak = max(s["score"] for s in scores)

    if delta >= 4:
        trend = "rapidly_deteriorating"
        rec = "CRITICAL: SOFA increased ≥4 points. Immediate senior review. Sepsis-3 organ dysfunction. Consider early resuscitation escalation."
    elif delta >= 2:
        trend = "deteriorating"
        rec = "WARNING: SOFA increased ≥2 points (Sepsis-3 criterion met). Review source control, fluid balance, vasopressor needs."
    elif delta <= -2:
        trend = "improving"
        rec = "SOFA improving. Continue current management. Daily reassessment."
    else:
        trend = "stable"
        rec = "SOFA stable. Monitor as per protocol."

    return {
        "trend": trend,
        "delta": delta,
        "latest_sofa": latest,
        "peak_sofa": peak,
        "recommendation": rec,
    }
```

---

## Acceptance Criteria

- [ ] `icu_sofa_delta_alerts.delta`, `is_deteriorating`, and `alert_severity` are generated columns
- [ ] `icu_care_bundles.compliance_pct` is a generated column (NUMERIC, handles 0/NULL total_items)
- [ ] `icu_vent_safety_checks.overall_safe` is generated from `plateau_safe AND driving_safe AND tv_safe`
- [ ] `GET /icu/ai/sofa-alerts/active` returns unacknowledged alerts ordered by severity
- [ ] `POST /icu/ai/vent-safety-check` fetches latest vent settings and returns violations
- [ ] `POST /icu/ai/handover/generate` builds full handover note from live DB state
- [ ] `POST /icu/cdss/vent-safety` correctly applies ARDSnet thresholds and Devine IBW formula
- [ ] `POST /icu/cdss/sofa-trend` flags delta ≥2 as deteriorating (Sepsis-3 criterion)
- [ ] `IcuAlertsScreen.tsx` shows correct severity colours and acknowledge button
- [ ] Smoke test passes
