# Sprint 246 — NICU Follow-up Programme

**Module key:** `nicu_followup`
**Bundle ID:** `sprint246_nicu_followup`
**Version:** `2026.06.23.0`
**Depends on:** `sprint236_nicu_core`, `sprint237_nicu_advanced`, `sprint240_neonatal_screening`
**Followed by:** S247 (Patient Transport)

---

## Sprint Goal

Build a dedicated NICU Follow-up Programme module for post-discharge monitoring of high-risk neonates:
1. **Post-NICU discharge register** — all NICU graduates enrolled, corrected age calculation, risk-stratification tier
2. **Follow-up visit schedule** — NICU-graduated follow-up contacts at 1m, 3m, 6m, 9m, 12m, 18m, 24m corrected age
3. **Bayley-III developmental assessments** — cognitive, language, motor composite scores with domain-specific subtests, age-appropriate normative comparison
4. **ROP follow-up scheduler** — zone/stage tracking, laser treatment records, ophthalmology visit scheduler
5. **HIE (Hypoxic Ischaemic Encephalopathy) outcome tracking** — Sarnat grade, cooling treatment record, MRI brain result, neurodevelopmental outcome at 18–24m

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint246_nicu_followup',
  label: 'Sprint 246 — NICU Follow-up: discharge register, corrected age, Bayley-III, ROP schedule, HIE outcomes',
  version: '2026.06.23.0',
  description: 'nicu_followup_register, nicu_followup_visits, bayley_assessments, rop_records, hie_records',
  statements: () => [
    // ── NICU Follow-up Register ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_followup_register (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id            UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      nicu_admission_id     UUID REFERENCES nicu_admissions(id),
      discharge_date        DATE NOT NULL,
      gestational_age_weeks SMALLINT NOT NULL,
      birth_weight_g        NUMERIC(6,1) NOT NULL,
      discharge_weight_g    NUMERIC(6,1),
      risk_tier             TEXT NOT NULL DEFAULT 'high' CHECK (risk_tier IN ('standard','high','very_high')),
      primary_diagnosis     TEXT,
      enrolled_by           UUID REFERENCES users(id),
      is_active             BOOLEAN NOT NULL DEFAULT TRUE,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_followup_patient ON nicu_followup_register(patient_id)`,

    // ── Corrected Age view ──────────────────────────────────────────────
    -- Corrected age = chronological age - (40 - GA at birth) weeks, used until 24m CA
    `CREATE OR REPLACE VIEW nicu_corrected_ages AS
      SELECT
        nfr.id,
        nfr.patient_id,
        p.date_of_birth AS dob,
        nfr.gestational_age_weeks AS ga_weeks,
        EXTRACT(DAY FROM NOW() - p.date_of_birth)::int AS chronological_age_days,
        GREATEST(0, EXTRACT(DAY FROM NOW() - p.date_of_birth)::int - ((40 - nfr.gestational_age_weeks) * 7)) AS corrected_age_days,
        ROUND(GREATEST(0, EXTRACT(DAY FROM NOW() - p.date_of_birth)::numeric - ((40 - nfr.gestational_age_weeks) * 7)) / 30.44, 1) AS corrected_age_months
      FROM nicu_followup_register nfr
      JOIN patients p ON p.id = nfr.patient_id`,

    // ── Follow-up Visits ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_followup_visits (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      register_id     UUID NOT NULL REFERENCES nicu_followup_register(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id),
      visit_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      corrected_age_months NUMERIC(4,1),
      weight_g        NUMERIC(6,1),
      length_cm       NUMERIC(5,2),
      head_circ_cm    NUMERIC(5,2),
      feeding_type    TEXT CHECK (feeding_type IN ('exclusive_breast','mixed','formula','solids',NULL)),
      developmental_concerns TEXT,
      vision_concern  BOOLEAN NOT NULL DEFAULT FALSE,
      hearing_concern BOOLEAN NOT NULL DEFAULT FALSE,
      next_visit_due  DATE,
      seen_by         UUID REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_followup_visits_register ON nicu_followup_visits(register_id)`,

    // ── Bayley-III Assessments ────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS bayley_assessments (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      register_id          UUID NOT NULL REFERENCES nicu_followup_register(id),
      assessed_at          DATE NOT NULL DEFAULT CURRENT_DATE,
      corrected_age_months NUMERIC(4,1) NOT NULL,
      cognitive_composite  SMALLINT,
      language_composite   SMALLINT,
      motor_composite      SMALLINT,
      receptive_comm_ss    SMALLINT,
      expressive_comm_ss   SMALLINT,
      fine_motor_ss        SMALLINT,
      gross_motor_ss       SMALLINT,
      cognitive_delay      BOOLEAN GENERATED ALWAYS AS (cognitive_composite IS NOT NULL AND cognitive_composite < 85) STORED,
      language_delay       BOOLEAN GENERATED ALWAYS AS (language_composite IS NOT NULL AND language_composite < 85) STORED,
      motor_delay          BOOLEAN GENERATED ALWAYS AS (motor_composite IS NOT NULL AND motor_composite < 85) STORED,
      any_significant_delay BOOLEAN GENERATED ALWAYS AS (
                              COALESCE(cognitive_composite < 85, FALSE)
                              OR COALESCE(language_composite < 85, FALSE)
                              OR COALESCE(motor_composite < 85, FALSE)
                            ) STORED,
      assessed_by          UUID REFERENCES users(id),
      referral_made        BOOLEAN NOT NULL DEFAULT FALSE,
      referral_type        TEXT,
      notes                TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bayley_patient ON bayley_assessments(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bayley_delay ON bayley_assessments(any_significant_delay) WHERE any_significant_delay = TRUE`,

    // ── ROP Records ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS rop_records (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      admission_id    UUID REFERENCES nicu_admissions(id),
      screening_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      right_eye_zone  TEXT CHECK (right_eye_zone IN ('zone_1','zone_2','zone_3','normal',NULL)),
      right_eye_stage SMALLINT CHECK (right_eye_stage BETWEEN 0 AND 5),
      right_plus_disease BOOLEAN NOT NULL DEFAULT FALSE,
      left_eye_zone   TEXT CHECK (left_eye_zone IN ('zone_1','zone_2','zone_3','normal',NULL)),
      left_eye_stage  SMALLINT CHECK (left_eye_stage BETWEEN 0 AND 5),
      left_plus_disease BOOLEAN NOT NULL DEFAULT FALSE,
      treatment_required BOOLEAN GENERATED ALWAYS AS (
                            (right_eye_stage >= 3 AND right_eye_zone IN ('zone_1','zone_2'))
                            OR right_plus_disease
                            OR (left_eye_stage >= 3 AND left_eye_zone IN ('zone_1','zone_2'))
                            OR left_plus_disease
                          ) STORED,
      treatment_type  TEXT CHECK (treatment_type IN ('laser','anti_vegf','cryotherapy','vitrectomy',NULL)),
      treatment_date  DATE,
      next_screen_due DATE,
      screened_by     UUID REFERENCES users(id),
      notes           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rop_patient ON rop_records(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_rop_treatment ON rop_records(treatment_required) WHERE treatment_required = TRUE`,

    // ── HIE Records ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS hie_records (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      admission_id    UUID REFERENCES nicu_admissions(id),
      sarnat_grade    SMALLINT NOT NULL CHECK (sarnat_grade BETWEEN 1 AND 3),
      cooling_initiated BOOLEAN NOT NULL DEFAULT FALSE,
      cooling_start_hours_of_life SMALLINT,
      cooling_duration_hours SMALLINT DEFAULT 72,
      amplitude_eeg_performed BOOLEAN NOT NULL DEFAULT FALSE,
      amplitude_eeg_result TEXT,
      mri_performed   BOOLEAN NOT NULL DEFAULT FALSE,
      mri_date        DATE,
      mri_result      TEXT,
      mri_classification TEXT CHECK (mri_classification IN ('normal','mild','moderate','severe',NULL)),
      neurodevelopmental_outcome TEXT CHECK (neurodevelopmental_outcome IN ('normal','mild_delay','moderate_delay','severe_delay','cerebral_palsy','deceased',NULL)),
      outcome_assessed_at DATE,
      epilepsy_diagnosed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hie_patient ON hie_records(patient_id)`,
  ],
},
```

**Add `nicu_followup` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/nicu-followup.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NicuFollowupService } from '../services/nicu-followup.service';

@UseGuards(JwtAuthGuard)
@Controller('nicu-followup')
export class NicuFollowupController {
  constructor(private readonly svc: NicuFollowupService) {}

  @Post('register')
  enrollPatient(@Req() req: any, @Body() body: any) {
    return this.svc.enrollPatient(req.tenantDb, req.user.id, body);
  }

  @Get('register')
  getRegister(@Req() req: any) {
    return this.svc.getRegister(req.tenantDb);
  }

  @Get('corrected-age/:patientId')
  getCorrectedAge(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getCorrectedAge(req.tenantDb, patientId);
  }

  @Post('visits')
  recordVisit(@Req() req: any, @Body() body: any) {
    return this.svc.recordVisit(req.tenantDb, req.user.id, body);
  }

  @Post('bayley')
  recordBayley(@Req() req: any, @Body() body: any) {
    return this.svc.recordBayley(req.tenantDb, req.user.id, body);
  }

  @Get('bayley/:patientId')
  getBayleyHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getBayleyHistory(req.tenantDb, patientId);
  }

  @Post('rop')
  recordRop(@Req() req: any, @Body() body: any) {
    return this.svc.recordRop(req.tenantDb, req.user.id, body);
  }

  @Get('rop/pending-screening')
  getRopPendingScreening(@Req() req: any) {
    return this.svc.getRopPendingScreening(req.tenantDb);
  }

  @Post('hie')
  recordHie(@Req() req: any, @Body() body: any) {
    return this.svc.recordHie(req.tenantDb, body);
  }

  @Patch('hie/:id/outcome')
  recordHieOutcome(@Req() req: any, @Param('id') id: string, @Body() body: { outcome: string; assessedAt?: string }) {
    return this.svc.recordHieOutcome(req.tenantDb, id, body);
  }
}
```

**Create file:** `services/ehr-service/src/services/nicu-followup.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// Bayley-III: composite score <85 = 1SD below mean = significant delay
const BAYLEY_THRESHOLD = 85;

// ROP follow-up intervals per UKROP/ROP screen guidelines
const ROP_NEXT_INTERVAL_WEEKS: Record<string, number> = {
  zone_1_stage_1_2: 1, zone_1_stage_3: 0.5, zone_2_stage_2: 2, zone_2_stage_3: 1, zone_3: 4, normal: 0,
};

@Injectable()
export class NicuFollowupService {

  async enrollPatient(db: any, enrolledBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_followup_register (patient_id, nicu_admission_id, discharge_date, gestational_age_weeks, birth_weight_g, discharge_weight_g, risk_tier, primary_diagnosis, enrolled_by)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (patient_id) DO UPDATE SET is_active=TRUE
       RETURNING *`,
      [body.patientId, body.nicuAdmissionId ?? null, body.dischargeDate, body.gestationalAgeWeeks, body.birthWeightG, body.dischargeWeightG ?? null, body.riskTier ?? 'high', body.primaryDiagnosis ?? null, enrolledBy],
    );
    return rows[0] ?? null;
  }

  async getRegister(db: any): Promise<any[]> {
    return db.query(
      `SELECT nfr.*, p.first_name, p.last_name, p.date_of_birth,
              ca.corrected_age_months, ca.corrected_age_days
       FROM nicu_followup_register nfr
       JOIN patients p ON p.id = nfr.patient_id
       LEFT JOIN nicu_corrected_ages ca ON ca.patient_id = nfr.patient_id
       WHERE nfr.is_active = TRUE
       ORDER BY ca.corrected_age_months ASC`,
    );
  }

  async getCorrectedAge(db: any, patientId: string): Promise<any> {
    const rows = await db.query(
      `SELECT * FROM nicu_corrected_ages WHERE patient_id=$1`,
      [patientId],
    );
    return rows[0] ?? null;
  }

  async recordVisit(db: any, seenBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_followup_visits (register_id, patient_id, visit_date, corrected_age_months, weight_g, length_cm, head_circ_cm, feeding_type, developmental_concerns, vision_concern, hearing_concern, next_visit_due, seen_by, notes)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13,$14) RETURNING *`,
      [body.registerId, body.patientId, body.visitDate ?? new Date().toISOString().slice(0, 10), body.correctedAgeMonths ?? null, body.weightG ?? null, body.lengthCm ?? null, body.headCircCm ?? null, body.feedingType ?? null, body.developmentalConcerns ?? null, body.visionConcern ?? false, body.hearingConcern ?? false, body.nextVisitDue ?? null, seenBy, body.notes ?? null],
    );
    return rows[0] ?? null;
  }

  async recordBayley(db: any, assessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO bayley_assessments (patient_id, register_id, assessed_at, corrected_age_months, cognitive_composite, language_composite, motor_composite, receptive_comm_ss, expressive_comm_ss, fine_motor_ss, gross_motor_ss, assessed_by, referral_type, notes)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *, cognitive_delay, language_delay, motor_delay, any_significant_delay`,
      [body.patientId, body.registerId, body.assessedAt ?? new Date().toISOString().slice(0, 10), body.correctedAgeMonths, body.cognitiveComposite ?? null, body.languageComposite ?? null, body.motorComposite ?? null, body.receptiveCommSs ?? null, body.expressiveCommSs ?? null, body.fineMotorSs ?? null, body.grossMotorSs ?? null, assessedBy, body.referralType ?? null, body.notes ?? null],
    );
    const result = rows[0];
    const alerts: string[] = [];
    if (result?.cognitive_delay) alerts.push(`Cognitive composite ${body.cognitiveComposite} <85 — significant delay. Early intervention referral required.`);
    if (result?.language_delay)  alerts.push(`Language composite ${body.languageComposite} <85 — speech-language therapy referral required.`);
    if (result?.motor_delay)     alerts.push(`Motor composite ${body.motorComposite} <85 — physiotherapy/OT referral required.`);
    return { ...result, cdss_alerts: alerts };
  }

  async getBayleyHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT *, any_significant_delay FROM bayley_assessments WHERE patient_id=$1 ORDER BY assessed_at ASC`,
      [patientId],
    );
  }

  async recordRop(db: any, screenedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO rop_records (patient_id, admission_id, screening_date, right_eye_zone, right_eye_stage, right_plus_disease, left_eye_zone, left_eye_stage, left_plus_disease, next_screen_due, screened_by, notes)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10::date,$11,$12)
       RETURNING *, treatment_required`,
      [body.patientId, body.admissionId ?? null, body.screeningDate ?? new Date().toISOString().slice(0, 10), body.rightEyeZone ?? null, body.rightEyeStage ?? null, body.rightPlusDisease ?? false, body.leftEyeZone ?? null, body.leftEyeStage ?? null, body.leftPlusDisease ?? false, body.nextScreenDue ?? null, screenedBy, body.notes ?? null],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.treatment_required
        ? `⚠ ROP TREATMENT REQUIRED: Stage ≥3 in zone 1/2 or plus disease identified. Urgent ophthalmology referral for laser/anti-VEGF within 48 hours.`
        : null,
    };
  }

  async getRopPendingScreening(db: any): Promise<any[]> {
    return db.query(
      `SELECT rr.*, p.first_name, p.last_name
       FROM rop_records rr
       JOIN patients p ON p.id = rr.patient_id
       WHERE rr.next_screen_due IS NOT NULL AND rr.next_screen_due <= CURRENT_DATE + INTERVAL '3 days'
       ORDER BY rr.next_screen_due ASC`,
    );
  }

  async recordHie(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hie_records (patient_id, admission_id, sarnat_grade, cooling_initiated, cooling_start_hours_of_life, amplitude_eeg_performed, amplitude_eeg_result, mri_performed, mri_date, mri_result, mri_classification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11) RETURNING *`,
      [body.patientId, body.admissionId ?? null, body.sarnatGrade, body.coolingInitiated ?? false, body.coolingStartHoursOfLife ?? null, body.amplitudeEegPerformed ?? false, body.amplitudeEegResult ?? null, body.mriPerformed ?? false, body.mriDate ?? null, body.mriResult ?? null, body.mriClassification ?? null],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: body.sarnatGrade >= 2 && !body.coolingInitiated
        ? `⚠ HIE Grade ${body.sarnatGrade}: Therapeutic hypothermia (cooling) indicated if ≤6 hours of life. Initiate immediately if criteria met and not already done.`
        : null,
    };
  }

  async recordHieOutcome(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE hie_records SET neurodevelopmental_outcome=$1, outcome_assessed_at=$2::date WHERE id=$3 RETURNING *`,
      [body.outcome, body.assessedAt ?? new Date().toISOString().slice(0, 10), id],
    );
    return rows[0] ?? null;
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/NicuFollowupDashboard.tsx`:
- **Corrected Age Timeline** — per patient strip showing chronological vs corrected age, follow-up contact markers
- **Bayley Score Chart** — cognitive/language/motor composite trend across assessments; red zone shading below 85
- **ROP Pending List** — patients with `next_screen_due` within 3 days, highlighted amber
- **HIE Outcome Register** — table by Sarnat grade, cooling status, MRI classification, 18–24m outcome

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/NicuFollowupScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Brain, Eye, Activity } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const DELAY_COLOR = (score: number | null) =>
  score == null ? C.textMuted : score < 70 ? C.red : score < 85 ? C.coral : C.green;

export default function NicuFollowupScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [correctedAge, setCorrectedAge] = useState<any>(null);
  const [bayley, setBayley] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/nicu-followup/corrected-age/${patientId}`).then((r: any) => setCorrectedAge(r.data ?? r)),
      api.get(`/nicu-followup/bayley/${patientId}`).then((r: any) => setBayley(r.data ?? r)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const latest = bayley[bayley.length - 1];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>NICU Follow-up</Text>
      <Text style={s.sub}>{patientName}</Text>

      {correctedAge && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Corrected Age</Text>
          <Text style={s.big}>{correctedAge.corrected_age_months} months</Text>
          <Text style={s.detail}>Chronological: {correctedAge.chronological_age_days} days</Text>
        </View>
      )}

      {latest && (
        <View style={s.card}>
          <View style={s.row}><Brain size={14} color={C.teal} /><Text style={s.sectionTitle}> Latest Bayley-III ({latest.corrected_age_months}m CA)</Text></View>
          <View style={s.scores}>
            <View style={s.scoreItem}>
              <Text style={s.scoreLbl}>Cognitive</Text>
              <Text style={[s.scoreNum, { color: DELAY_COLOR(latest.cognitive_composite) }]}>{latest.cognitive_composite ?? '—'}</Text>
            </View>
            <View style={s.scoreItem}>
              <Text style={s.scoreLbl}>Language</Text>
              <Text style={[s.scoreNum, { color: DELAY_COLOR(latest.language_composite) }]}>{latest.language_composite ?? '—'}</Text>
            </View>
            <View style={s.scoreItem}>
              <Text style={s.scoreLbl}>Motor</Text>
              <Text style={[s.scoreNum, { color: DELAY_COLOR(latest.motor_composite) }]}>{latest.motor_composite ?? '—'}</Text>
            </View>
          </View>
          {latest.any_significant_delay && (
            <Text style={s.delayAlert}>⚠ Significant developmental delay identified — referral required</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  sectionTitle:{ fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  big:         { fontFamily: FONT.uiBd, fontSize: 28, color: C.teal },
  detail:      { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  scores:      { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  scoreItem:   { alignItems: 'center' },
  scoreLbl:    { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginBottom: 4 },
  scoreNum:    { fontFamily: FONT.uiBd, fontSize: 24 },
  delayAlert:  { fontFamily: FONT.uiSb, fontSize: 12, color: C.coral, marginTop: 10 },
});
```

**Register:** `<Stack.Screen name="NicuFollowup" component={NicuFollowupScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
@app.post("/nicu-followup/cdss/bayley-interpret")
async def bayley_interpret(body: dict):
    """
    Interpret Bayley-III composite scores.
    body: { cognitive: int|None, language: int|None, motor: int|None, corrected_age_months: float }
    """
    delays = []
    referrals = []

    def classify(score, domain):
        if score is None: return "not_tested"
        if score < 70:   return "severe"
        if score < 85:   return "moderate"
        if score < 100:  return "borderline"
        return "normal"

    for domain, key in [("cognitive", "cognitive"), ("language", "language"), ("motor", "motor")]:
        score = body.get(key)
        cls = classify(score, domain)
        if cls in ("severe", "moderate"):
            delays.append({"domain": domain, "score": score, "classification": cls})
            if domain == "language":   referrals.append("Speech-Language Therapy")
            if domain == "motor":      referrals.append("Physiotherapy and Occupational Therapy")
            if domain == "cognitive":  referrals.append("Early Childhood Intervention Programme")

    return {
        "delays": delays,
        "referrals": list(set(referrals)),
        "any_delay": len(delays) > 0,
        "recommendation": "; ".join(f"{d['domain'].title()} {d['classification']} delay (score {d['score']})" for d in delays) or "No significant developmental delay identified."
    }
```

---

## Acceptance Criteria

- [ ] `nicu_corrected_ages` view correctly computes `corrected_age_months` as `(chronological_days - prematurity_weeks * 7) / 30.44`
- [ ] `bayley_assessments.cognitive_delay`, `language_delay`, `motor_delay`, `any_significant_delay` are generated columns using composite < 85 threshold
- [ ] `rop_records.treatment_required` is a generated column correctly applying zone/stage/plus disease criteria
- [ ] `POST /nicu-followup/rop` returns `cdss_alert` when `treatment_required = TRUE`
- [ ] `POST /nicu-followup/hie` alerts when Sarnat ≥2 and cooling not initiated
- [ ] `POST /nicu-followup/bayley` returns `cdss_alerts` per delayed domain with referral type
- [ ] `NicuFollowupScreen.tsx` shows Bayley scores coloured by threshold (green/coral/red)
- [ ] `'nicu_followup'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
