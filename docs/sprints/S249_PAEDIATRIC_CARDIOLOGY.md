# Sprint 249 — Paediatric Cardiology

**Module key:** `paediatric_cardiology`
**Bundle ID:** `sprint249_paediatric_cardiology`
**Version:** `2026.06.23.0`
**Depends on:** `sprint238_well_baby_clinic`, `sprint236_nicu_core` (neonatal CHD links here)
**Followed by:** — (final sprint in this series)

---

## Sprint Goal

Build a Paediatric Cardiology module covering:
1. **CHD (Congenital Heart Disease) register** — diagnosis, anatomy, shunt direction, cyanotic/acyanotic classification
2. **Paediatric echocardiography templates** — structured echo report with measurements (annulus, valve, ventricular dimensions), Z-scores, function
3. **Murmur CDSS** — AI-assisted murmur characterisation → innocent vs pathological → differential diagnosis
4. **SBE (Subacute Bacterial Endocarditis) prophylaxis decision support** — procedure risk + cardiac risk classification → antibiotic recommendation
5. **Surgical/catheter intervention log** — palliative and corrective procedures, haemodynamic data, outcomes
6. **Follow-up schedule** — condition-specific surveillance intervals with overdue alerts

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint249_paediatric_cardiology',
  label: 'Sprint 249 — Paediatric Cardiology: CHD register, echo templates, murmur CDSS, SBE prophylaxis, surgical log, follow-up',
  version: '2026.06.23.0',
  description: 'chd_register, paed_echo_reports, paed_cardiac_interventions, paed_cardiac_followup',
  statements: () => [
    // ── CHD Register ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS chd_register (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      primary_diagnosis TEXT NOT NULL,
      diagnosis_date  DATE,
      anatomy_detail  TEXT,
      chd_category    TEXT NOT NULL CHECK (chd_category IN ('acyanotic','cyanotic','complex','acquired')),
      shunt_direction TEXT CHECK (shunt_direction IN ('left_to_right','right_to_left','bidirectional','no_shunt',NULL)),
      cardiac_anatomy JSONB NOT NULL DEFAULT '{}'::jsonb,
      genetic_syndrome TEXT,
      antenatal_diagnosis BOOLEAN NOT NULL DEFAULT FALSE,
      current_status  TEXT NOT NULL DEFAULT 'active' CHECK (current_status IN ('active','palliated','corrected','lost_to_followup','deceased')),
      primary_cardiologist UUID REFERENCES users(id),
      enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chd_patient ON chd_register(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chd_category ON chd_register(chd_category, current_status)`,

    // ── Paediatric Echo Reports ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS paed_echo_reports (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      echo_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      indication      TEXT NOT NULL,
      weight_kg       NUMERIC(5,2),

      -- Ventricular Function
      lv_edd_mm       NUMERIC(5,2),
      lv_esd_mm       NUMERIC(5,2),
      lv_sf_pct       NUMERIC(5,2) GENERATED ALWAYS AS (
                          CASE WHEN lv_edd_mm > 0 THEN ROUND((lv_edd_mm - lv_esd_mm) / lv_edd_mm * 100, 2) ELSE NULL END
                        ) STORED,
      lv_ef_pct       NUMERIC(5,2),
      rv_function     TEXT CHECK (rv_function IN ('normal','mildly_reduced','moderately_reduced','severely_reduced',NULL)),
      septal_motion   TEXT CHECK (septal_motion IN ('normal','flat','paradoxical',NULL)),

      -- Valve Assessments
      mitral_regurg   TEXT CHECK (mitral_regurg IN ('none','trivial','mild','moderate','severe',NULL)),
      tricuspid_regurg TEXT CHECK (tricuspid_regurg IN ('none','trivial','mild','moderate','severe',NULL)),
      aortic_stenosis_mean_grad_mmhg NUMERIC(5,1),
      pulm_stenosis_peak_grad_mmhg   NUMERIC(5,1),

      -- Pulmonary Artery
      pa_systolic_pressure_mmhg NUMERIC(5,1),
      pulmonary_hypertension BOOLEAN GENERATED ALWAYS AS (pa_systolic_pressure_mmhg IS NOT NULL AND pa_systolic_pressure_mmhg > 35) STORED,

      -- Shunt / Defect
      pda_present     BOOLEAN NOT NULL DEFAULT FALSE,
      asd_present     BOOLEAN NOT NULL DEFAULT FALSE,
      vsd_present     BOOLEAN NOT NULL DEFAULT FALSE,
      defect_size_mm  NUMERIC(5,2),
      shunt_direction TEXT CHECK (shunt_direction IN ('left_to_right','right_to_left','bidirectional',NULL)),

      -- Administration
      sonographer_id  UUID REFERENCES users(id),
      reporting_cardiologist UUID REFERENCES users(id),
      conclusion      TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_paed_echo_patient ON paed_echo_reports(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_paed_echo_phtn ON paed_echo_reports(pulmonary_hypertension) WHERE pulmonary_hypertension = TRUE`,

    // ── Cardiac Interventions ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS paed_cardiac_interventions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      procedure_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      intervention_type TEXT NOT NULL CHECK (intervention_type IN (
                          'blalock_taussig_shunt','norwood','glenn','fontan',
                          'arterial_switch','vsd_repair','asd_closure','pda_ligation',
                          'tetralogy_repair','balloon_valvuloplasty','device_closure',
                          'catheter_ablation','ppvi','other'
                        )),
      intent          TEXT NOT NULL CHECK (intent IN ('palliative','corrective','diagnostic')),
      approach        TEXT NOT NULL CHECK (approach IN ('open_heart','catheter_based','hybrid')),
      bypass_minutes  SMALLINT,
      cross_clamp_mins SMALLINT,
      outcome         TEXT NOT NULL CHECK (outcome IN ('successful','successful_with_complications','failed','abandoned')),
      discharge_date  DATE,
      complications   JSONB NOT NULL DEFAULT '[]'::jsonb,
      surgeon_id      UUID REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_paed_intervention_patient ON paed_cardiac_interventions(patient_id)`,

    // ── Paediatric Cardiac Follow-up Schedule ─────────────────────────────
    `CREATE TABLE IF NOT EXISTS paed_cardiac_followup (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      followup_type   TEXT NOT NULL CHECK (followup_type IN ('clinic','echo','holter','exercise_test','cath','other')),
      due_date        DATE NOT NULL,
      reason          TEXT,
      completed       BOOLEAN NOT NULL DEFAULT FALSE,
      completed_date  DATE,
      is_overdue      BOOLEAN GENERATED ALWAYS AS (completed = FALSE AND due_date < CURRENT_DATE) STORED,
      assigned_to     UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_paed_cardiac_followup_patient ON paed_cardiac_followup(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_paed_cardiac_overdue ON paed_cardiac_followup(is_overdue) WHERE is_overdue = TRUE`,
  ],
},
```

**Add `paediatric_cardiology` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/paediatric-cardiology.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PaediatricCardiologyService } from '../services/paediatric-cardiology.service';

@UseGuards(JwtAuthGuard)
@Controller('paed-cardiology')
export class PaediatricCardiologyController {
  constructor(private readonly svc: PaediatricCardiologyService) {}

  @Post('chd-register')
  registerChd(@Req() req: any, @Body() body: any) {
    return this.svc.registerChd(req.tenantDb, req.user.id, body);
  }

  @Get('chd-register')
  getChdRegister(@Req() req: any) {
    return this.svc.getChdRegister(req.tenantDb);
  }

  @Post('echo')
  recordEcho(@Req() req: any, @Body() body: any) {
    return this.svc.recordEcho(req.tenantDb, req.user.id, body);
  }

  @Get('echo/:patientId')
  getEchoHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getEchoHistory(req.tenantDb, patientId);
  }

  @Post('intervention')
  recordIntervention(@Req() req: any, @Body() body: any) {
    return this.svc.recordIntervention(req.tenantDb, req.user.id, body);
  }

  @Post('followup')
  scheduleFollowup(@Req() req: any, @Body() body: any) {
    return this.svc.scheduleFollowup(req.tenantDb, req.user.id, body);
  }

  @Get('followup/overdue')
  getOverdue(@Req() req: any) {
    return this.svc.getOverdueFollowups(req.tenantDb);
  }

  @Patch('followup/:id/complete')
  markFollowupComplete(@Req() req: any, @Param('id') id: string) {
    return this.svc.markFollowupComplete(req.tenantDb, id);
  }
}
```

**Create file:** `services/ehr-service/src/services/paediatric-cardiology.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// LV shortening fraction normal range in children: 28–44%
const LV_SF_NORMAL_MIN = 28;
const LV_SF_NORMAL_MAX = 44;

// AHA/ACC SBE prophylaxis — high-risk cardiac conditions
const HIGH_RISK_CARDIAC_CONDITIONS = [
  'prosthetic_heart_valve', 'previous_ie', 'cyanotic_chd_uncorrected',
  'corrected_chd_with_prosthetic_material_6m', 'repaired_chd_with_residual_defect',
  'cardiac_transplant_with_valvulopathy',
];

@Injectable()
export class PaediatricCardiologyService {

  async registerChd(db: any, cardiologistId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO chd_register (patient_id, primary_diagnosis, diagnosis_date, anatomy_detail, chd_category, shunt_direction, genetic_syndrome, antenatal_diagnosis, primary_cardiologist)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (patient_id) DO UPDATE SET primary_diagnosis=$2, chd_category=$5, current_status='active'
       RETURNING *`,
      [body.patientId, body.primaryDiagnosis, body.diagnosisDate ?? null, body.anatomyDetail ?? null, body.chdCategory, body.shuntDirection ?? null, body.geneticSyndrome ?? null, body.antenatalDiagnosis ?? false, cardiologistId],
    );
    return rows[0] ?? null;
  }

  async getChdRegister(db: any): Promise<any[]> {
    return db.query(
      `SELECT cr.*, p.first_name, p.last_name, p.date_of_birth
       FROM chd_register cr
       JOIN patients p ON p.id = cr.patient_id
       WHERE cr.current_status != 'lost_to_followup'
       ORDER BY cr.chd_category, p.last_name`,
    );
  }

  async recordEcho(db: any, reportingBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO paed_echo_reports (patient_id, echo_date, indication, weight_kg,
         lv_edd_mm, lv_esd_mm, lv_ef_pct, rv_function, septal_motion,
         mitral_regurg, tricuspid_regurg, aortic_stenosis_mean_grad_mmhg, pulm_stenosis_peak_grad_mmhg,
         pa_systolic_pressure_mmhg, pda_present, asd_present, vsd_present, defect_size_mm, shunt_direction,
         reporting_cardiologist, conclusion)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *, lv_sf_pct, pulmonary_hypertension`,
      [body.patientId, body.echoDate ?? new Date().toISOString().slice(0, 10), body.indication, body.weightKg ?? null,
       body.lvEddMm ?? null, body.lvEsdMm ?? null, body.lvEfPct ?? null, body.rvFunction ?? null, body.septalMotion ?? null,
       body.mitralRegurg ?? null, body.tricuspidRegurg ?? null, body.aorticStenosisMeanGradMmhg ?? null, body.pulmStenosisPeakGradMmhg ?? null,
       body.paSystolicPressureMmhg ?? null, body.pdaPresent ?? false, body.asdPresent ?? false, body.vsdPresent ?? false, body.defectSizeMm ?? null, body.shuntDirection ?? null,
       reportingBy, body.conclusion ?? null],
    );
    const result = rows[0];
    const alerts: string[] = [];
    const sf = result?.lv_sf_pct;
    if (sf != null) {
      if (sf < LV_SF_NORMAL_MIN) alerts.push(`LV shortening fraction ${sf}% is BELOW normal (28–44%). Systolic dysfunction — cardiology review urgently.`);
      else if (sf > LV_SF_NORMAL_MAX) alerts.push(`LV SF ${sf}% above normal range. Consider volume depletion or hyperdynamic circulation.`);
    }
    if (result?.pulmonary_hypertension) {
      alerts.push(`PA systolic pressure ${body.paSystolicPressureMmhg} mmHg — PULMONARY HYPERTENSION. Formal evaluation and specialist referral required.`);
    }
    if (body.mitralRegurg === 'severe' || body.tricuspidRegurg === 'severe') {
      alerts.push('Severe valvular regurgitation identified. Surgical/interventional cardiology referral required.');
    }
    return { ...result, cdss_alerts: alerts };
  }

  async getEchoHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT *, lv_sf_pct, pulmonary_hypertension FROM paed_echo_reports WHERE patient_id=$1 ORDER BY echo_date DESC`,
      [patientId],
    );
  }

  async recordIntervention(db: any, surgeonId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO paed_cardiac_interventions (patient_id, procedure_date, intervention_type, intent, approach, bypass_minutes, cross_clamp_mins, outcome, discharge_date, complications, notes, surgeon_id)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9::date,$10::jsonb,$11,$12) RETURNING *`,
      [body.patientId, body.procedureDate ?? new Date().toISOString().slice(0, 10), body.interventionType, body.intent, body.approach, body.bypassMinutes ?? null, body.crossClampMins ?? null, body.outcome, body.dischargeDate ?? null, JSON.stringify(body.complications ?? []), body.notes ?? null, surgeonId],
    );
    return rows[0] ?? null;
  }

  async scheduleFollowup(db: any, assignedTo: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO paed_cardiac_followup (patient_id, followup_type, due_date, reason, assigned_to)
       VALUES ($1,$2,$3::date,$4,$5) RETURNING *`,
      [body.patientId, body.followupType, body.dueDate, body.reason ?? null, assignedTo],
    );
    return rows[0] ?? null;
  }

  async getOverdueFollowups(db: any): Promise<any[]> {
    return db.query(
      `SELECT pf.*, p.first_name, p.last_name, cr.primary_diagnosis
       FROM paed_cardiac_followup pf
       JOIN patients p ON p.id = pf.patient_id
       LEFT JOIN chd_register cr ON cr.patient_id = pf.patient_id
       WHERE pf.is_overdue = TRUE
       ORDER BY pf.due_date ASC`,
    );
  }

  async markFollowupComplete(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `UPDATE paed_cardiac_followup SET completed=TRUE, completed_date=CURRENT_DATE WHERE id=$1 RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/PaedCardiologyDashboard.tsx`:
- **CHD Register Table** — diagnosis, category chip (cyanotic=coral `#E8614D`, acyanotic=teal `#0AA98A`, complex=amber), current status badge
- **Echo Trend Panel** — LV SF% and LV EF% over time as dual axis chart; normal range shading (SF 28–44%)
- **Overdue Follow-ups Rail** — right sidebar list of overdue patients; days overdue in coral number badge

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/PaedCardiologyScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Heart, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const CATEGORY_COLOR: Record<string, string> = {
  cyanotic: C.coral, acyanotic: C.teal, complex: C.amber, acquired: C.blue,
};

export default function PaedCardiologyScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [echos, setEchos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/paed-cardiology/echo/${patientId}`)
      .then((r: any) => setEchos(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const latest = echos[0];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>Paediatric Cardiology</Text>
      <Text style={s.sub}>{patientName}</Text>

      {latest && (
        <View style={s.card}>
          <View style={s.row}><Heart size={16} color={C.teal} /><Text style={s.cardTitle}> Latest Echo — {latest.echo_date}</Text></View>

          <View style={s.metricRow}>
            <View style={s.metric}>
              <Text style={s.metricLabel}>LV EF</Text>
              <Text style={[s.metricVal, { color: latest.lv_ef_pct < 50 ? C.coral : C.teal }]}>
                {latest.lv_ef_pct != null ? `${latest.lv_ef_pct}%` : '—'}
              </Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricLabel}>LV SF</Text>
              <Text style={[s.metricVal, { color: latest.lv_sf_pct < 28 || latest.lv_sf_pct > 44 ? C.coral : C.green }]}>
                {latest.lv_sf_pct != null ? `${latest.lv_sf_pct}%` : '—'}
              </Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricLabel}>PA Systolic</Text>
              <Text style={[s.metricVal, { color: latest.pulmonary_hypertension ? C.coral : C.text }]}>
                {latest.pa_systolic_pressure_mmhg != null ? `${latest.pa_systolic_pressure_mmhg} mmHg` : '—'}
              </Text>
            </View>
          </View>

          {latest.pulmonary_hypertension && (
            <View style={s.alertBox}>
              <AlertTriangle size={14} color={C.coral} />
              <Text style={s.alertText}> Pulmonary hypertension detected</Text>
            </View>
          )}

          {/* Defects */}
          <View style={s.defectRow}>
            {[['PDA', latest.pda_present], ['ASD', latest.asd_present], ['VSD', latest.vsd_present]].map(([label, present]) => (
              <View key={label as string} style={[s.defectChip, { backgroundColor: present ? C.coral + '22' : C.surface }]}>
                <Text style={[s.defectText, { color: present ? C.coral : C.textMuted }]}>{label as string}</Text>
              </View>
            ))}
          </View>

          {latest.conclusion && <Text style={s.conclusion}>{latest.conclusion}</Text>}
        </View>
      )}

      {echos.length === 0 && <Text style={s.empty}>No echo reports on file.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  empty:       { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, ...SHADOW.card },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle:   { fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary },
  metricRow:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  metric:      { alignItems: 'center' },
  metricLabel: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginBottom: 4 },
  metricVal:   { fontFamily: FONT.uiBd, fontSize: 20 },
  alertBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.coral + '22', borderRadius: RADIUS.sm, padding: 10, marginBottom: 12 },
  alertText:   { fontFamily: FONT.uiSb, fontSize: 13, color: C.coral },
  defectRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  defectChip:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.pill },
  defectText:  { fontFamily: FONT.uiSb, fontSize: 12 },
  conclusion:  { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, lineHeight: 18 },
});
```

**Register:** `<Stack.Screen name="PaedCardiology" component={PaedCardiologyScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
# ── Paediatric Cardiology CDSS ─────────────────────────────────────────────

INNOCENT_MURMUR_FEATURES = {
    "still_vibratory": True, "ejection_systolic": True, "grade_1_to_2": True,
    "no_radiation": True, "varies_with_position": True, "no_thrill": True,
}

HIGH_RISK_CARDIAC_FOR_SBE = [
    "prosthetic_valve", "previous_infective_endocarditis", "unrepaired_cyanotic_chd",
    "corrected_chd_prosthetic_material_lt_6m", "repaired_chd_residual_defect", "cardiac_transplant_valvulopathy"
]

HIGH_RISK_PROCEDURES_FOR_SBE = [
    "dental_procedure_gingival_manipulation", "dental_implant", "oral_biopsy",
    "tonsillectomy", "adenoidectomy", "respiratory_tract_incision", "gi_biopsy_infected_site"
]

@app.post("/paed-cardiology/cdss/murmur-assess")
async def murmur_assessment(body: dict):
    """
    Differentiate innocent vs pathological murmur.
    body: { timing: str, grade: int, quality: str, location: str, radiation: bool,
             thrill: bool, varies_with_position: bool, associated_symptoms: list[str] }
    """
    grade = body.get("grade", 2)
    timing = body.get("timing", "systolic")
    radiation = body.get("radiation", False)
    thrill = body.get("thrill", False)
    quality = body.get("quality", "")
    symptoms = body.get("associated_symptoms", [])

    red_flags = []
    if grade >= 3:        red_flags.append(f"Murmur grade {grade}/6 — high grade.")
    if thrill:            red_flags.append("Palpable thrill — significant gradient likely.")
    if radiation:         red_flags.append("Radiation to axilla/back/neck — structural lesion.")
    if timing == "diastolic": red_flags.append("Diastolic murmur — always pathological in children.")
    if timing == "continuous": red_flags.append("Continuous murmur — evaluate for PDA or AV fistula.")
    if any(s in symptoms for s in ["syncope", "cyanosis", "exercise_intolerance"]):
        red_flags.append("Significant associated symptoms — urgent evaluation.")

    innocent = len(red_flags) == 0 and quality in ("vibratory", "musical", "blowing") and grade <= 2
    return {
        "likely_innocent": innocent,
        "red_flags": red_flags,
        "recommendation": "INNOCENT MURMUR likely. No investigation required if otherwise well. Re-evaluate if symptoms develop." if innocent
                         else f"PATHOLOGICAL MURMUR suspected — {len(red_flags)} red flag(s). Echocardiography required. Paediatric cardiology referral."
    }

@app.post("/paed-cardiology/cdss/sbe-prophylaxis")
async def sbe_prophylaxis(body: dict):
    """
    AHA 2007 SBE prophylaxis guideline.
    body: { cardiac_condition: str, procedure: str, penicillin_allergic: bool }
    """
    cardiac = body.get("cardiac_condition", "")
    procedure = body.get("procedure", "")
    pcn_allergy = body.get("penicillin_allergic", False)

    high_risk_cardiac = any(c in cardiac for c in HIGH_RISK_CARDIAC_FOR_SBE)
    high_risk_procedure = any(p in procedure for p in HIGH_RISK_PROCEDURES_FOR_SBE)

    if not high_risk_cardiac:
        return {"prophylaxis_indicated": False, "recommendation": "Cardiac condition is NOT in high-risk category. SBE prophylaxis is NOT indicated."}
    if not high_risk_procedure:
        return {"prophylaxis_indicated": False, "recommendation": "Procedure is NOT in high-risk category. SBE prophylaxis is NOT indicated for this procedure."}

    if pcn_allergy:
        regimen = "Clindamycin 20 mg/kg (max 600 mg) orally/IV 30–60 min before procedure."
    else:
        regimen = "Amoxicillin 50 mg/kg (max 2 g) orally 30–60 min before procedure. If oral not possible: Ampicillin 50 mg/kg IV/IM."

    return {
        "prophylaxis_indicated": True,
        "regimen": regimen,
        "recommendation": f"SBE prophylaxis INDICATED: high-risk cardiac condition + high-risk procedure. Give {regimen}",
    }
```

---

## Acceptance Criteria

- [ ] `paed_echo_reports.lv_sf_pct` is a generated column from `(lv_edd_mm - lv_esd_mm) / lv_edd_mm * 100`
- [ ] `paed_echo_reports.pulmonary_hypertension` is a generated column: `pa_systolic_pressure_mmhg > 35`
- [ ] `paed_cardiac_followup.is_overdue` is a generated column: `completed = FALSE AND due_date < CURRENT_DATE`
- [ ] `POST /paed-cardiology/echo` returns `cdss_alerts` for LV SF outside 28–44% and for pulmonary hypertension
- [ ] `GET /paed-cardiology/followup/overdue` returns all overdue follow-ups with CHD diagnosis
- [ ] `POST /paed-cardiology/cdss/murmur-assess` correctly flags diastolic murmurs as pathological
- [ ] `POST /paed-cardiology/cdss/sbe-prophylaxis` returns correct amoxicillin and clindamycin regimens
- [ ] `PaedCardiologyScreen.tsx` shows LV SF% colour (coral if abnormal, green if normal), PA pressure, defect chips
- [ ] `'paediatric_cardiology'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
