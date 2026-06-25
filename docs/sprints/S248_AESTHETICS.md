# Sprint 248 — Aesthetics & Wellness

**Module key:** `aesthetics`
**Bundle ID:** `sprint248_aesthetics`
**Version:** `2026.06.23.0`
**Depends on:** `sprint243_hyperbaric` (HBOT wellness sessions link here)
**Followed by:** S249 (Paediatric Cardiology)

---

## Sprint Goal

Build an Aesthetics & Wellness module covering:
1. **Treatment register** — injectable, laser, body contouring, PRP procedures with product lot tracking
2. **Photo documentation** — before/after photo references (stored securely), consent documentation
3. **PRP (Platelet-Rich Plasma) log** — centrifuge protocol, platelet count, yield, injection sites
4. **Skin analysis record** — Fitzpatrick skin type, Glogau classification, skin concerns baseline
5. **HBOT wellness linkage** — link HBOT wellness courses to aesthetics patient record
6. **Consultation & treatment planner** — treatment programme with session intervals and product needs

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint248_aesthetics',
  label: 'Sprint 248 — Aesthetics: treatment register, photo documentation, PRP, skin analysis, HBOT wellness linkage, planner',
  version: '2026.06.23.0',
  description: 'aesthetics_patients, aesthetic_procedures, prp_sessions, skin_analysis_records, aesthetic_consent_records',
  statements: () => [
    // ── Aesthetics Patient Profiles ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS aesthetics_patients (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id         UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      fitzpatrick_type   SMALLINT CHECK (fitzpatrick_type BETWEEN 1 AND 6),
      glogau_class       SMALLINT CHECK (glogau_class BETWEEN 1 AND 4),
      primary_concerns   JSONB NOT NULL DEFAULT '[]'::jsonb,
      allergies          TEXT,
      current_skincare   TEXT,
      smoking_status     TEXT CHECK (smoking_status IN ('non_smoker','ex_smoker','current_smoker',NULL)),
      is_on_retinoids    BOOLEAN NOT NULL DEFAULT FALSE,
      is_on_blood_thinners BOOLEAN NOT NULL DEFAULT FALSE,
      enrolled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── Aesthetic Procedures ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS aesthetic_procedures (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      procedure_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      procedure_type   TEXT NOT NULL CHECK (procedure_type IN (
                         'botulinum_toxin','dermal_filler','prp','laser_hair_removal',
                         'laser_rejuvenation','chemical_peel','microneedling','body_contouring',
                         'hbot_wellness','iv_vitamin_therapy','carboxy_therapy','other'
                       )),
      treatment_areas  JSONB NOT NULL DEFAULT '[]'::jsonb,
      product_used     TEXT,
      product_lot      TEXT,
      product_expiry   DATE,
      units_or_ml      NUMERIC(7,2),
      pre_photo_ref    TEXT,
      post_photo_ref   TEXT,
      next_session_due DATE,
      performed_by     UUID REFERENCES users(id),
      cost_usd         NUMERIC(10,2),
      consent_id       UUID,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_aesthetic_proc_patient ON aesthetic_procedures(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_aesthetic_proc_type ON aesthetic_procedures(procedure_type, procedure_date DESC)`,

    // ── PRP Sessions ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS prp_sessions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      procedure_id     UUID NOT NULL REFERENCES aesthetic_procedures(id) ON DELETE CASCADE,
      patient_id       UUID NOT NULL REFERENCES patients(id),
      blood_drawn_ml   NUMERIC(5,1) NOT NULL,
      centrifuge_rpm   SMALLINT,
      centrifuge_mins  SMALLINT,
      prp_yield_ml     NUMERIC(5,2),
      platelet_count_before NUMERIC(8,1),
      platelet_count_prp    NUMERIC(8,1),
      platelet_concentration_factor NUMERIC(5,2) GENERATED ALWAYS AS (
                              CASE WHEN platelet_count_before IS NOT NULL AND platelet_count_before > 0
                                   THEN ROUND(platelet_count_prp / platelet_count_before, 2) ELSE NULL END
                            ) STORED,
      activation_agent TEXT CHECK (activation_agent IN ('thrombin','calcium_chloride','autologous_thrombin','none')),
      injection_sites  JSONB NOT NULL DEFAULT '[]'::jsonb,
      performed_by     UUID REFERENCES users(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── Skin Analysis Records ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS skin_analysis_records (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      assessed_at      DATE NOT NULL DEFAULT CURRENT_DATE,
      hydration_score  SMALLINT CHECK (hydration_score BETWEEN 0 AND 100),
      sebum_score      SMALLINT CHECK (sebum_score BETWEEN 0 AND 100),
      pigmentation_score SMALLINT CHECK (pigmentation_score BETWEEN 0 AND 100),
      pore_score       SMALLINT CHECK (pore_score BETWEEN 0 AND 100),
      wrinkle_score    SMALLINT CHECK (wrinkle_score BETWEEN 0 AND 100),
      skin_age_estimate SMALLINT,
      analysis_device  TEXT,
      recommendations  JSONB NOT NULL DEFAULT '[]'::jsonb,
      assessed_by      UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_skin_analysis_patient ON skin_analysis_records(patient_id)`,

    // ── Consent Records ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS aesthetic_consent_records (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      procedure_type   TEXT NOT NULL,
      consented_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      consent_version  TEXT NOT NULL DEFAULT '1.0',
      risks_explained  JSONB NOT NULL DEFAULT '[]'::jsonb,
      patient_questions TEXT,
      signed_by_patient BOOLEAN NOT NULL DEFAULT FALSE,
      witnessed_by     UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_aesthetic_consent_patient ON aesthetic_consent_records(patient_id)`,
  ],
},
```

**Add `aesthetics` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/aesthetics.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AestheticsService } from '../services/aesthetics.service';

@UseGuards(JwtAuthGuard)
@Controller('aesthetics')
export class AestheticsController {
  constructor(private readonly svc: AestheticsService) {}

  @Post('patients')
  enrollPatient(@Req() req: any, @Body() body: any) {
    return this.svc.enrollPatient(req.tenantDb, body);
  }

  @Get('patients/:patientId/profile')
  getProfile(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getProfile(req.tenantDb, patientId);
  }

  @Post('consent')
  recordConsent(@Req() req: any, @Body() body: any) {
    return this.svc.recordConsent(req.tenantDb, req.user.id, body);
  }

  @Post('procedures')
  recordProcedure(
    @Req() req: any,
    @Body() body: {
      patientId: string; procedureType: string; treatmentAreas: string[];
      productUsed?: string; productLot?: string; productExpiry?: string;
      unitsOrMl?: number; prePhotoRef?: string; postPhotoRef?: string;
      nextSessionDue?: string; costUsd?: number; notes?: string;
    },
  ) {
    return this.svc.recordProcedure(req.tenantDb, req.user.id, body);
  }

  @Get('procedures/:patientId')
  getPatientProcedures(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientProcedures(req.tenantDb, patientId);
  }

  @Post('prp')
  recordPrpSession(@Req() req: any, @Body() body: any) {
    return this.svc.recordPrpSession(req.tenantDb, req.user.id, body);
  }

  @Post('skin-analysis')
  recordSkinAnalysis(@Req() req: any, @Body() body: any) {
    return this.svc.recordSkinAnalysis(req.tenantDb, req.user.id, body);
  }

  @Get('skin-analysis/:patientId')
  getSkinHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getSkinHistory(req.tenantDb, patientId);
  }

  @Get('upcoming-sessions')
  getUpcomingSessions(@Req() req: any) {
    return this.svc.getUpcomingSessions(req.tenantDb);
  }
}
```

**Create file:** `services/ehr-service/src/services/aesthetics.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// Contraindication check for common aesthetic procedures
const PROCEDURE_CONTRAINDICATIONS: Record<string, string[]> = {
  botulinum_toxin: ['pregnancy', 'myasthenia_gravis', 'aminoglycoside_use', 'neuromuscular_disease'],
  dermal_filler: ['is_on_blood_thinners', 'active_skin_infection', 'autoimmune_condition'],
  laser_hair_removal: ['fitzpatrick_5_6_without_appropriate_laser', 'photosensitising_medication'],
  prp: ['platelet_dysfunction', 'anaemia', 'active_infection', 'anticoagulation'],
};

@Injectable()
export class AestheticsService {

  async enrollPatient(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aesthetics_patients (patient_id, fitzpatrick_type, glogau_class, primary_concerns, allergies, smoking_status, is_on_retinoids, is_on_blood_thinners)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
       ON CONFLICT (patient_id) DO UPDATE SET fitzpatrick_type=$2, glogau_class=$3, primary_concerns=$4::jsonb
       RETURNING *`,
      [body.patientId, body.fitzpatrickType ?? null, body.glogauClass ?? null, JSON.stringify(body.primaryConcerns ?? []), body.allergies ?? null, body.smokingStatus ?? null, body.isOnRetinoids ?? false, body.isOnBloodThinners ?? false],
    );
    return rows[0] ?? null;
  }

  async getProfile(db: any, patientId: string): Promise<any> {
    const [profile, recent, skin] = await Promise.all([
      db.query(`SELECT ap.*, p.first_name, p.last_name, p.date_of_birth FROM aesthetics_patients ap JOIN patients p ON p.id=ap.patient_id WHERE ap.patient_id=$1`, [patientId]),
      db.query(`SELECT * FROM aesthetic_procedures WHERE patient_id=$1 ORDER BY procedure_date DESC LIMIT 10`, [patientId]),
      db.query(`SELECT * FROM skin_analysis_records WHERE patient_id=$1 ORDER BY assessed_at DESC LIMIT 1`, [patientId]),
    ]);
    return { profile: profile[0] ?? null, recent_procedures: recent, latest_skin_analysis: skin[0] ?? null };
  }

  async recordConsent(db: any, witnessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aesthetic_consent_records (patient_id, procedure_type, consent_version, risks_explained, patient_questions, signed_by_patient, witnessed_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING *`,
      [body.patientId, body.procedureType, body.consentVersion ?? '1.0', JSON.stringify(body.risksExplained ?? []), body.patientQuestions ?? null, body.signedByPatient ?? true, witnessedBy],
    );
    return rows[0] ?? null;
  }

  async recordProcedure(db: any, performedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aesthetic_procedures (patient_id, procedure_type, treatment_areas, product_used, product_lot, product_expiry, units_or_ml, pre_photo_ref, post_photo_ref, next_session_due, performed_by, cost_usd, notes)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6::date,$7,$8,$9,$10::date,$11,$12,$13) RETURNING *`,
      [body.patientId, body.procedureType, JSON.stringify(body.treatmentAreas ?? []), body.productUsed ?? null, body.productLot ?? null, body.productExpiry ?? null, body.unitsOrMl ?? null, body.prePhotoRef ?? null, body.postPhotoRef ?? null, body.nextSessionDue ?? null, performedBy, body.costUsd ?? null, body.notes ?? null],
    );
    return rows[0] ?? null;
  }

  async getPatientProcedures(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM aesthetic_procedures WHERE patient_id=$1 ORDER BY procedure_date DESC`,
      [patientId],
    );
  }

  async recordPrpSession(db: any, performedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO prp_sessions (procedure_id, patient_id, blood_drawn_ml, centrifuge_rpm, centrifuge_mins, prp_yield_ml, platelet_count_before, platelet_count_prp, activation_agent, injection_sites, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       RETURNING *, platelet_concentration_factor`,
      [body.procedureId, body.patientId, body.bloodDrawnMl, body.centrifugeRpm ?? null, body.centrifugeMins ?? null, body.prpYieldMl ?? null, body.plateletCountBefore ?? null, body.plateletCountPrp ?? null, body.activationAgent ?? 'none', JSON.stringify(body.injectionSites ?? []), performedBy],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_note: result?.platelet_concentration_factor
        ? `PRP concentration factor: ${result.platelet_concentration_factor}x. Therapeutic range typically 3–8x baseline.`
        : null,
    };
  }

  async recordSkinAnalysis(db: any, assessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO skin_analysis_records (patient_id, assessed_at, hydration_score, sebum_score, pigmentation_score, pore_score, wrinkle_score, skin_age_estimate, analysis_device, recommendations, assessed_by)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING *`,
      [body.patientId, body.assessedAt ?? new Date().toISOString().slice(0, 10), body.hydrationScore ?? null, body.sebumScore ?? null, body.pigmentationScore ?? null, body.poreScore ?? null, body.wrinkleScore ?? null, body.skinAgeEstimate ?? null, body.analysisDevice ?? null, JSON.stringify(body.recommendations ?? []), assessedBy],
    );
    return rows[0] ?? null;
  }

  async getSkinHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(`SELECT * FROM skin_analysis_records WHERE patient_id=$1 ORDER BY assessed_at DESC`, [patientId]);
  }

  async getUpcomingSessions(db: any): Promise<any[]> {
    return db.query(
      `SELECT ap.*, p.first_name, p.last_name
       FROM aesthetic_procedures ap
       JOIN patients p ON p.id = ap.patient_id
       WHERE ap.next_session_due IS NOT NULL AND ap.next_session_due BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
       ORDER BY ap.next_session_due ASC`,
    );
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/AestheticsDashboard.tsx`:
- **Patient Treatment Timeline** — horizontal timeline showing procedure dots by date, hoverable for product/area detail
- **Skin Analysis Radar Chart** — hexagonal radar of 5 skin dimensions (hydration/sebum/pigmentation/pores/wrinkles) using teal fill `rgba(10,169,138,0.3)`
- **Upcoming Sessions Table** — 14-day view of `next_session_due` with procedure type, patient name, days until session

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/AestheticsTreatmentScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Sparkles, Calendar } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const PROC_ICON_COLOR: Record<string, string> = {
  botulinum_toxin: C.blue, dermal_filler: C.teal, prp: C.amber,
  laser_rejuvenation: C.coral, chemical_peel: C.amber, hbot_wellness: C.teal,
};

export default function AestheticsTreatmentScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/aesthetics/procedures/${patientId}`)
      .then((r: any) => setProcedures(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Treatment History</Text>
      <Text style={s.sub}>{patientName}</Text>
      {procedures.length === 0 && <Text style={s.empty}>No procedures on file.</Text>}
      <FlatList
        data={procedures}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Sparkles size={14} color={PROC_ICON_COLOR[item.procedure_type] ?? C.teal} />
              <Text style={s.type}> {item.procedure_type?.replace(/_/g, ' ')}</Text>
            </View>
            <Text style={s.date}>{item.procedure_date}</Text>
            {item.product_used && <Text style={s.product}>{item.product_used} {item.units_or_ml ? `— ${item.units_or_ml} units/ml` : ''}</Text>}
            {item.next_session_due && (
              <View style={s.nextRow}>
                <Calendar size={12} color={C.textMuted} />
                <Text style={s.next}> Next session: {item.next_session_due}</Text>
              </View>
            )}
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
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  type:      { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, textTransform: 'capitalize' },
  date:      { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginBottom: 4 },
  product:   { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  nextRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  next:      { fontFamily: FONT.ui, fontSize: 12, color: C.teal },
});
```

**Register:** `<Stack.Screen name="AestheticsTreatment" component={AestheticsTreatmentScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
BOTOX_CONTRAINDICATIONS = ["myasthenia_gravis", "eaton_lambert", "aminoglycoside_use", "pregnancy", "breastfeeding"]
FILLER_CONTRAINDICATIONS = ["blood_thinners", "active_infection", "autoimmune_condition", "known_filler_hypersensitivity"]

@app.post("/aesthetics/cdss/contraindication-check")
async def aesthetics_contraindication_check(body: dict):
    """
    Check procedure-specific contraindications.
    body: { procedure_type: str, conditions: list[str], medications: list[str], fitzpatrick_type: int }
    """
    procedure = body.get("procedure_type", "")
    conditions = [c.lower() for c in body.get("conditions", [])]
    meds = [m.lower() for m in body.get("medications", [])]
    fitz = body.get("fitzpatrick_type", 3)
    flags = []

    if procedure == "botulinum_toxin":
        for ci in BOTOX_CONTRAINDICATIONS:
            if ci in conditions: flags.append({"severity": "absolute", "condition": ci, "guidance": f"{ci.replace('_',' ').title()} is a contraindication for botulinum toxin. Do not proceed."})

    if procedure == "dermal_filler":
        if any("warfarin" in m or "clopidogrel" in m or "apixaban" in m for m in meds):
            flags.append({"severity": "relative", "condition": "anticoagulation", "guidance": "Anticoagulants increase bruising/haematoma risk. Consider withholding if clinically safe."})

    if procedure in ("laser_hair_removal", "laser_rejuvenation") and fitz >= 5:
        flags.append({"severity": "caution", "condition": "fitzpatrick_5_6", "guidance": f"Fitzpatrick {fitz}: high melanin — ensure appropriate wavelength (Nd:YAG). Test patch mandatory."})

    if procedure == "prp":
        if any("haemophilia" in c or "platelet_disorder" in c for c in conditions):
            flags.append({"severity": "absolute", "condition": "platelet_disorder", "guidance": "Platelet disorder is a contraindication for PRP. Do not proceed."})

    return {
        "clear_to_proceed": not any(f["severity"] == "absolute" for f in flags),
        "flags": flags,
    }
```

---

## Acceptance Criteria

- [ ] `prp_sessions.platelet_concentration_factor` is a generated column from `platelet_count_prp / platelet_count_before`
- [ ] `aesthetics_patients.patient_id` is UNIQUE — one profile per patient
- [ ] `POST /aesthetics/procedures` stores `pre_photo_ref` and `post_photo_ref` as references (not binary)
- [ ] `GET /aesthetics/upcoming-sessions` returns next 14 days of `next_session_due`
- [ ] `POST /aesthetics/cdss/contraindication-check` flags Fitzpatrick 5/6 for laser procedures
- [ ] `AestheticsTreatmentScreen.tsx` shows procedure type with icon colour per UMOYA palette
- [ ] `'aesthetics'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
