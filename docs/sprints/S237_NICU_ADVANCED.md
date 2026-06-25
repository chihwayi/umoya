# Sprint 237 — NICU Advanced: Neonatal Drug Dosing, PN Calculator & Screening

**Module key:** `nicu` (extends S236)
**Bundle ID:** `sprint237_nicu_advanced`
**Version:** `2026.06.23.0`
**Depends on:** `sprint236_nicu_core`
**Followed by:** S239 (EPI/Immunisation)

---

## Sprint Goal

Extend the NICU module with advanced neonatal-specific clinical tools:
1. **Weight-based neonatal drug dosing calculator** — NICU formulary with weight/gestational-age-adjusted dose computation and toxicity range guards
2. **Neonatal Parenteral Nutrition (PN) calculator** — daily macro and micronutrient prescription generation based on weight, gestational age, and postnatal day
3. **Newborn Screening register** — heel prick NBS result tracking, hearing OAE pass/refer, CCHD pulse-ox screening, ROP referral tracker
4. **Neonatal abstinence scoring (NAS/NAS-modified Finnegan)** — 21-item score per shift, treatment threshold alerts
5. **CPAP/High-flow circuit documentation** — weaning schedule and tolerance assessments

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint237_nicu_advanced',
  label: 'Sprint 237 — NICU Advanced: weight-based drug dosing, PN calculator, NBS/hearing/CCHD/ROP screening, NAS scoring',
  version: '2026.06.23.0',
  description: 'nicu_drug_formulary, nicu_drug_orders, nicu_pn_prescriptions, nicu_screening_results, nicu_nas_scores',
  statements: () => [
    // ── Neonatal Drug Formulary ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_drug_formulary (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      drug_name         TEXT NOT NULL UNIQUE,
      drug_code         TEXT NOT NULL UNIQUE,
      category          TEXT NOT NULL,
      dose_mg_per_kg    NUMERIC(8,4) NOT NULL,
      dose_max_mg       NUMERIC(8,2),
      frequency         TEXT NOT NULL,
      route             TEXT NOT NULL,
      min_ga_weeks      SMALLINT,
      max_dose_per_day_mg_per_kg NUMERIC(8,4),
      toxicity_threshold_mg_per_kg NUMERIC(8,4),
      monitoring_required TEXT,
      is_active         BOOLEAN NOT NULL DEFAULT TRUE
    )`,
    // Seed common NICU drugs
    `INSERT INTO nicu_drug_formulary (drug_name, drug_code, category, dose_mg_per_kg, frequency, route, min_ga_weeks, max_dose_per_day_mg_per_kg, toxicity_threshold_mg_per_kg, monitoring_required)
     VALUES
       ('Caffeine Citrate Loading','CAFF-LOAD','respiratory',20,'single_dose','oral_ng',28,20,30,'serum_caffeine_level'),
       ('Caffeine Citrate Maintenance','CAFF-MAINT','respiratory',5,'every_24h','oral_ng',28,10,20,'serum_caffeine_level'),
       ('Gentamicin','GENT','antibiotic',4,'every_36h','iv',28,4,5,'trough_and_peak'),
       ('Ampicillin','AMPI','antibiotic',50,'every_12h','iv',NULL,200,NULL,NULL),
       ('Phenobarbitone Loading','PHENO-LOAD','anticonvulsant',20,'single_dose','iv',NULL,20,40,'drug_level_24h'),
       ('Phenobarbitone Maintenance','PHENO-MAINT','anticonvulsant',5,'every_24h','iv',NULL,8,15,'drug_level'),
       ('Morphine','MORPH','analgesic_sedation',0.05,'every_4h_prn','iv',NULL,0.3,NULL,'pain_score_resp_rate'),
       ('Surfactant (Poractant)','SURF-PORA','respiratory',200,'single_repeat_once','intratracheal',NULL,200,NULL,'SpO2_FiO2'),
       ('Indomethacin Dose 1','INDO-D1','pda_closure',0.2,'single_dose','iv',NULL,0.2,NULL,'urine_output_creatinine'),
       ('Vitamin K','VIT-K','prophylaxis',0.5,'single_dose','im',NULL,0.5,NULL,NULL)
     ON CONFLICT DO NOTHING`,

    // ── Neonatal Drug Orders ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_drug_orders (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id    UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      drug_code       TEXT NOT NULL,
      weight_kg       NUMERIC(5,3) NOT NULL,
      dose_calculated_mg NUMERIC(8,4) GENERATED ALWAYS AS (
                          weight_kg * (
                            SELECT dose_mg_per_kg FROM nicu_drug_formulary WHERE drug_code = nicu_drug_orders.drug_code LIMIT 1
                          )
                        ) STORED,
      exceeds_max     BOOLEAN,
      near_toxicity   BOOLEAN,
      ordered_by      UUID REFERENCES users(id),
      ordered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      administered_at TIMESTAMPTZ,
      notes           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_drug_orders_admission ON nicu_drug_orders(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_drug_orders_date ON nicu_drug_orders(ordered_at DESC)`,

    // ── Neonatal PN Prescriptions ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_pn_prescriptions (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id          UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      prescription_date     DATE NOT NULL DEFAULT CURRENT_DATE,
      weight_kg             NUMERIC(5,3) NOT NULL,
      postnatal_day         SMALLINT NOT NULL,
      gestational_age_weeks SMALLINT NOT NULL,
      fluid_ml_per_kg_per_day NUMERIC(6,2) NOT NULL,
      glucose_g_per_kg_per_day  NUMERIC(6,3),
      amino_acid_g_per_kg_per_day NUMERIC(6,3),
      lipid_g_per_kg_per_day    NUMERIC(6,3),
      sodium_mmol_per_kg_per_day NUMERIC(6,3),
      potassium_gir_mg_per_kg_per_min NUMERIC(6,3),
      calcium_mmol_per_kg_per_day NUMERIC(6,3),
      total_kcal_per_kg_per_day NUMERIC(7,2) GENERATED ALWAYS AS (
                                  ROUND(
                                    COALESCE(glucose_g_per_kg_per_day, 0) * 3.4
                                    + COALESCE(amino_acid_g_per_kg_per_day, 0) * 4.0
                                    + COALESCE(lipid_g_per_kg_per_day, 0) * 9.0,
                                    2
                                  )
                                ) STORED,
      prescribed_by         UUID REFERENCES users(id),
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_pn_admission ON nicu_pn_prescriptions(admission_id)`,

    // ── Newborn Screening Results ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_screening_results (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id    UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id),
      screening_type  TEXT NOT NULL CHECK (screening_type IN ('nbs_heel_prick','hearing_oae','cchd_pulse_ox','rop_referral','metabolic_screen')),
      performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      result_status   TEXT NOT NULL CHECK (result_status IN ('pass','refer','inconclusive','not_done','awaiting')),
      result_details  JSONB NOT NULL DEFAULT '{}'::jsonb,
      followup_required BOOLEAN GENERATED ALWAYS AS (result_status IN ('refer','inconclusive')) STORED,
      referred_to     TEXT,
      referred_at     DATE,
      performed_by    UUID REFERENCES users(id),
      notes           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_screening_admission ON nicu_screening_results(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_screening_followup ON nicu_screening_results(followup_required) WHERE followup_required = TRUE`,

    // ── NAS (Neonatal Abstinence) Scores ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_nas_scores (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id    UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      scored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      score_items     JSONB NOT NULL DEFAULT '{}'::jsonb,
      total_score     SMALLINT NOT NULL,
      requires_treatment BOOLEAN GENERATED ALWAYS AS (total_score >= 8) STORED,
      treatment_escalation_needed BOOLEAN GENERATED ALWAYS AS (total_score >= 12) STORED,
      scored_by       UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nas_admission ON nicu_nas_scores(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nas_treatment ON nicu_nas_scores(requires_treatment) WHERE requires_treatment = TRUE`,
  ],
},
```

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/nicu-advanced.controller.ts`

```typescript
import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NicuAdvancedService } from '../services/nicu-advanced.service';

@UseGuards(JwtAuthGuard)
@Controller('nicu/advanced')
export class NicuAdvancedController {
  constructor(private readonly svc: NicuAdvancedService) {}

  // ── Drug Dosing ──────────────────────────────────────────────────────────
  @Get('formulary')
  getFormulary(@Req() req: any) {
    return this.svc.getFormulary(req.tenantDb);
  }

  @Post('drug-orders')
  orderDrug(
    @Req() req: any,
    @Body() body: { admissionId: string; drugCode: string; weightKg: number; notes?: string },
  ) {
    return this.svc.orderDrug(req.tenantDb, req.user.id, body);
  }

  @Get('drug-orders/:admissionId')
  getDrugOrders(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getDrugOrders(req.tenantDb, admissionId);
  }

  // ── PN Calculator ────────────────────────────────────────────────────────
  @Post('pn-prescription')
  prescribePN(
    @Req() req: any,
    @Body() body: {
      admissionId: string; weightKg: number;
      postnatalDay: number; gestationalAgeWeeks: number;
    },
  ) {
    return this.svc.prescribePN(req.tenantDb, req.user.id, body);
  }

  @Get('pn-prescription/:admissionId')
  getPNHistory(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getPNHistory(req.tenantDb, admissionId);
  }

  // ── Newborn Screening ─────────────────────────────────────────────────────
  @Post('screening')
  recordScreening(
    @Req() req: any,
    @Body() body: {
      admissionId: string; patientId: string; screeningType: string;
      resultStatus: string; resultDetails?: object; notes?: string;
    },
  ) {
    return this.svc.recordScreening(req.tenantDb, req.user.id, body);
  }

  @Get('screening/:admissionId')
  getScreeningResults(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getScreeningResults(req.tenantDb, admissionId);
  }

  @Get('screening/pending-followup')
  getPendingFollowups(@Req() req: any) {
    return this.svc.getPendingScreeningFollowups(req.tenantDb);
  }

  // ── NAS Scoring ─────────────────────────────────────────────────────────
  @Post('nas-score')
  recordNasScore(
    @Req() req: any,
    @Body() body: { admissionId: string; scoreItems: Record<string, number>; totalScore: number },
  ) {
    return this.svc.recordNasScore(req.tenantDb, req.user.id, body);
  }

  @Get('nas-score/:admissionId')
  getNasHistory(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getNasHistory(req.tenantDb, admissionId);
  }
}
```

**Create file:** `services/ehr-service/src/services/nicu-advanced.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// PN target ranges per postnatal day and gestational age
// Source: ESPGHAN 2018 neonatal nutrition guidelines
function computePNTargets(postnatalDay: number, gaWeeks: number): Record<string, number> {
  const premature = gaWeeks < 37;
  const vlbw = gaWeeks < 30;

  const fluidTarget = postnatalDay <= 1
    ? (premature ? 80 : 60)
    : postnatalDay <= 3
      ? (premature ? 100 : 80)
      : (premature ? 150 : 120);

  const aaTarget = postnatalDay <= 1
    ? (vlbw ? 2.5 : 1.5)
    : postnatalDay <= 3
      ? (vlbw ? 3.0 : 2.0)
      : (vlbw ? 3.5 : 2.5);

  const lipidTarget = postnatalDay <= 1 ? 1.0 : postnatalDay <= 3 ? 2.0 : 3.0;
  const glucoseTarget = vlbw ? 7.0 : 5.0; // g/kg/day

  return {
    fluid_ml_per_kg_per_day: fluidTarget,
    amino_acid_g_per_kg_per_day: aaTarget,
    lipid_g_per_kg_per_day: lipidTarget,
    glucose_g_per_kg_per_day: glucoseTarget,
    sodium_mmol_per_kg_per_day: postnatalDay <= 2 ? 0 : 2.0,
    potassium_gir_mg_per_kg_per_min: postnatalDay <= 2 ? 0 : 1.5,
    calcium_mmol_per_kg_per_day: 1.0,
  };
}

@Injectable()
export class NicuAdvancedService {

  async getFormulary(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM nicu_drug_formulary WHERE is_active ORDER BY category, drug_name`);
  }

  async orderDrug(db: any, orderedBy: string, body: any): Promise<any> {
    // Fetch formulary entry first
    const formulary = await db.query(
      `SELECT * FROM nicu_drug_formulary WHERE drug_code=$1 LIMIT 1`,
      [body.drugCode],
    );
    if (!formulary[0]) throw new Error(`Drug code ${body.drugCode} not in formulary.`);

    const drug = formulary[0];
    const doseMg = body.weightKg * drug.dose_mg_per_kg;
    const exceedsMax = drug.dose_max_mg != null && doseMg > drug.dose_max_mg;
    const nearToxicity = drug.toxicity_threshold_mg_per_kg != null
      && body.weightKg * drug.toxicity_threshold_mg_per_kg < doseMg * 1.2;

    const rows = await db.query(
      `INSERT INTO nicu_drug_orders (admission_id, drug_code, weight_kg, exceeds_max, near_toxicity, ordered_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *, dose_calculated_mg`,
      [body.admissionId, body.drugCode, body.weightKg, exceedsMax, nearToxicity, orderedBy, body.notes ?? null],
    );
    const result = rows[0];
    const alerts: string[] = [];
    if (exceedsMax) alerts.push(`⚠ DOSE EXCEEDS MAXIMUM: ${drug.drug_name} maximum dose is ${drug.dose_max_mg} mg. Calculated: ${doseMg.toFixed(3)} mg. Use max dose.`);
    if (nearToxicity) alerts.push(`⚠ NEAR TOXICITY THRESHOLD: Monitor ${drug.monitoring_required} closely.`);
    if (drug.monitoring_required) alerts.push(`Monitoring required: ${drug.monitoring_required}.`);

    return { ...result, cdss_alerts: alerts, recommended_dose_mg: exceedsMax ? drug.dose_max_mg : doseMg.toFixed(4) };
  }

  async getDrugOrders(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT no.*, df.drug_name, df.route, df.frequency, df.monitoring_required
       FROM nicu_drug_orders no
       JOIN nicu_drug_formulary df ON df.drug_code = no.drug_code
       WHERE no.admission_id=$1 ORDER BY no.ordered_at DESC`,
      [admissionId],
    );
  }

  async prescribePN(db: any, prescribedBy: string, body: any): Promise<any> {
    const targets = computePNTargets(body.postnatalDay, body.gestationalAgeWeeks);

    const rows = await db.query(
      `INSERT INTO nicu_pn_prescriptions (admission_id, weight_kg, postnatal_day, gestational_age_weeks,
         fluid_ml_per_kg_per_day, glucose_g_per_kg_per_day, amino_acid_g_per_kg_per_day,
         lipid_g_per_kg_per_day, sodium_mmol_per_kg_per_day, potassium_gir_mg_per_kg_per_min,
         calcium_mmol_per_kg_per_day, prescribed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *, total_kcal_per_kg_per_day`,
      [body.admissionId, body.weightKg, body.postnatalDay, body.gestationalAgeWeeks,
        targets.fluid_ml_per_kg_per_day, targets.glucose_g_per_kg_per_day,
        targets.amino_acid_g_per_kg_per_day, targets.lipid_g_per_kg_per_day,
        targets.sodium_mmol_per_kg_per_day, targets.potassium_gir_mg_per_kg_per_min,
        targets.calcium_mmol_per_kg_per_day, prescribedBy],
    );
    const result = rows[0];
    // Absolute volume targets
    const w = body.weightKg;
    return {
      ...result,
      absolute_targets: {
        total_fluid_ml_per_day: (targets.fluid_ml_per_kg_per_day * w).toFixed(1),
        amino_acid_ml_per_day_at_10pct: (targets.amino_acid_g_per_kg_per_day * w / 0.1).toFixed(1),
        lipid_ml_per_day_at_20pct: (targets.lipid_g_per_kg_per_day * w / 0.2).toFixed(1),
      },
    };
  }

  async getPNHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, total_kcal_per_kg_per_day FROM nicu_pn_prescriptions WHERE admission_id=$1 ORDER BY prescription_date DESC`,
      [admissionId],
    );
  }

  async recordScreening(db: any, performedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_screening_results (admission_id, patient_id, screening_type, result_status, result_details, notes, performed_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING *, followup_required`,
      [body.admissionId, body.patientId, body.screeningType, body.resultStatus, JSON.stringify(body.resultDetails ?? {}), body.notes ?? null, performedBy],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.followup_required
        ? `⚠ SCREENING ${body.screeningType.toUpperCase()}: Result is ${body.resultStatus.toUpperCase()}. Referral and follow-up documentation required.`
        : null,
    };
  }

  async getScreeningResults(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, followup_required FROM nicu_screening_results WHERE admission_id=$1 ORDER BY performed_at DESC`,
      [admissionId],
    );
  }

  async getPendingScreeningFollowups(db: any): Promise<any[]> {
    return db.query(
      `SELECT ns.*, p.first_name, p.last_name, na.gestational_age_weeks
       FROM nicu_screening_results ns
       JOIN nicu_admissions na ON na.id = ns.admission_id
       JOIN patients p ON p.id = ns.patient_id
       WHERE ns.followup_required = TRUE AND ns.referred_at IS NULL
       ORDER BY ns.performed_at ASC`,
    );
  }

  async recordNasScore(db: any, scoredBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_nas_scores (admission_id, score_items, total_score, scored_by)
       VALUES ($1,$2::jsonb,$3,$4) RETURNING *, requires_treatment, treatment_escalation_needed`,
      [body.admissionId, JSON.stringify(body.scoreItems), body.totalScore, scoredBy],
    );
    const result = rows[0];
    let alert: string | null = null;
    if (result?.treatment_escalation_needed) {
      alert = `⚠ NAS SCORE ${body.totalScore} ≥ 12: TREATMENT ESCALATION REQUIRED. Consider increasing morphine dose or adding clonidine. Senior review immediately.`;
    } else if (result?.requires_treatment) {
      alert = `NAS SCORE ${body.totalScore} ≥ 8: Initiate morphine treatment per NAS protocol. Supportive measures: swaddle, reduce stimulation, non-nutritive sucking.`;
    }
    return { ...result, cdss_alert: alert };
  }

  async getNasHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, requires_treatment, treatment_escalation_needed FROM nicu_nas_scores WHERE admission_id=$1 ORDER BY scored_at DESC`,
      [admissionId],
    );
  }
}
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/NicuAdvancedPanel.tsx`

Key UI elements:
- **Drug Dosing Calculator** — drug code dropdown from formulary, weight input, computed dose shown instantly with amber badge if near toxicity, coral banner if exceeds max
- **PN Prescription Card** — postnatal day + weight form, auto-fills all targets via `computePNTargets`, shows absolute volumes (fluid ml/day, AA volume, lipid volume) with total kcal/kg/day in large teal text
- **Screening Checklist** — 5 screening types as checkboxes: NBS, Hearing, CCHD, ROP, Metabolic. Each shows pass/refer badge
- **NAS Trend Sparkline** — 21-item score per shift displayed as line chart, treatment threshold line at 8, escalation line at 12 in coral

---

## Cornerstone 4: Mobile Screens

**Create file:** `mobile/src/screens/NicuDrugDoseScreen.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Zap, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function NicuDrugDoseScreen({ route }: { route: any }) {
  const { admissionId } = route.params;
  const [formulary, setFormulary] = useState<any[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<any>(null);
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/nicu/advanced/formulary')
      .then((r: any) => setFormulary(r.data ?? r))
      .catch(() => {});
  }, []);

  const calculate = async () => {
    if (!selectedDrug || !weight) { Alert.alert('Error', 'Select drug and enter weight.'); return; }
    setLoading(true);
    try {
      const r: any = await api.post('/nicu/advanced/drug-orders', {
        admissionId, drugCode: selectedDrug.drug_code, weightKg: parseFloat(weight),
      });
      setResult(r.data ?? r);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  return (
    <View style={s.container}>
      <Text style={s.heading}>Neonatal Drug Dosing</Text>

      <TextInput
        style={s.input}
        placeholder="Weight (kg)"
        placeholderTextColor={C.textMuted}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
      />

      <Text style={s.label}>Select Drug</Text>
      <FlatList
        data={formulary}
        keyExtractor={i => i.drug_code}
        horizontal={false}
        style={{ maxHeight: 200, marginBottom: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.drugItem, selectedDrug?.drug_code === item.drug_code && s.drugSelected]}
            onPress={() => setSelectedDrug(item)}
          >
            <Text style={s.drugName}>{item.drug_name}</Text>
            <Text style={s.drugDose}>{item.dose_mg_per_kg} mg/kg — {item.frequency}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={s.calcBtn} onPress={calculate} disabled={loading}>
        <Zap size={16} color={C.bg} />
        <Text style={s.calcText}> {loading ? 'Calculating...' : 'Calculate & Order'}</Text>
      </TouchableOpacity>

      {result && (
        <View style={s.resultCard}>
          <Text style={s.resultTitle}>Recommended Dose</Text>
          <Text style={s.doseNum}>{result.recommended_dose_mg} mg</Text>
          {result.cdss_alerts?.map((a: string, i: number) => (
            <View key={i} style={s.alert}>
              <AlertTriangle size={14} color={a.includes('EXCEEDS') ? C.coral : C.amber} />
              <Text style={[s.alertText, { color: a.includes('EXCEEDS') ? C.coral : C.amber }]}> {a}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  heading:      { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 16 },
  input:        { backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontFamily: FONT.ui, marginBottom: 12 },
  label:        { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  drugItem:     { backgroundColor: C.surface, borderRadius: RADIUS.sm, padding: 12, marginBottom: 6 },
  drugSelected: { borderWidth: 1.5, borderColor: C.teal },
  drugName:     { fontFamily: FONT.uiSb, fontSize: 14, color: C.text },
  drugDose:     { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  calcBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 14, marginBottom: 16 },
  calcText:     { fontFamily: FONT.uiSb, fontSize: 15, color: C.bg },
  resultCard:   { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, ...SHADOW.teal },
  resultTitle:  { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, marginBottom: 4 },
  doseNum:      { fontFamily: FONT.uiBd, fontSize: 32, color: C.teal, marginBottom: 12 },
  alert:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  alertText:    { fontFamily: FONT.ui, fontSize: 12, flex: 1 },
});
```

**Register:** `<Stack.Screen name="NicuDrugDose" component={NicuDrugDoseScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
# ── NICU Advanced CDSS endpoints ───────────────────────────────────────────

NAS_ITEM_SCORES = {
    "high_pitched_cry": 3, "continuous_high_pitched_cry": 2,
    "sleeps_less_than_1h": 3, "sleeps_less_than_2h": 2, "sleeps_less_than_3h": 1,
    "hyperactive_moro": 2, "markedly_hyperactive_moro": 3,
    "mild_tremor_undisturbed": 1, "mod_severe_tremor_undisturbed": 2,
    "mild_tremor_disturbed": 1, "mod_severe_tremor_disturbed": 2,
    "increased_muscle_tone": 2,
    "excoriation": 1,
    "myoclonic_jerks": 3,
    "generalized_convulsions": 5,
    "sweating": 1, "fever_less_38_5": 1, "fever_38_5_plus": 2,
    "frequent_yawning": 1, "mottling": 1, "stuffy_nose": 1,
    "sneezing": 1, "nasal_flaring": 2, "respiratory_rate_gt_60": 1,
    "poor_feeding": 2, "regurgitation": 2, "projectile_vomiting": 3,
    "loose_stools": 2, "watery_stools": 3,
}

@app.post("/nicu/cdss/nas-score")
async def compute_nas_score(body: dict):
    """
    Compute NAS (Modified Finnegan) score from item dict.
    body: { items: { item_name: bool } }
    Returns total score, severity, and treatment recommendation.
    """
    items = body.get("items", {})
    total = sum(NAS_ITEM_SCORES.get(k, 0) for k, v in items.items() if v)

    if total >= 12:
        severity = "severe"
        treatment = "Escalate morphine dose. Consider adding clonidine. Urgent senior review."
    elif total >= 8:
        severity = "moderate"
        treatment = "Initiate morphine per NAS protocol. Supportive care: swaddle, dim lights, non-nutritive sucking."
    elif total >= 4:
        severity = "mild"
        treatment = "Intensive supportive care: rooming-in, breastfeeding if possible. Rescore in 4 hours."
    else:
        severity = "normal"
        treatment = "No treatment required. Routine NAS monitoring."

    return {
        "total_score": total,
        "severity": severity,
        "requires_treatment": total >= 8,
        "treatment_escalation": total >= 12,
        "recommendation": treatment,
    }

@app.post("/nicu/cdss/pn-adequacy")
async def check_pn_adequacy(body: dict):
    """
    Check if a PN prescription meets ESPGHAN 2018 targets for given GA and postnatal day.
    body: { postnatal_day: int, ga_weeks: int, amino_acid_g_per_kg: float, lipid_g_per_kg: float,
             glucose_g_per_kg: float, fluid_ml_per_kg: float }
    """
    pnd = body.get("postnatal_day", 1)
    ga = body.get("ga_weeks", 36)
    premature = ga < 37
    vlbw = ga < 30

    targets = {
        "fluid_min": 80 if premature else 60,
        "aa_min": 2.5 if vlbw else 1.5,
        "lipid_min": 1.0 if pnd <= 1 else 2.0,
        "glucose_min": 7.0 if vlbw else 5.0,
    }

    alerts = []
    if body.get("amino_acid_g_per_kg", 0) < targets["aa_min"]:
        alerts.append(f"Amino acid {body['amino_acid_g_per_kg']} g/kg/day below minimum {targets['aa_min']} g/kg/day for day {pnd} GA {ga}w.")
    if body.get("lipid_g_per_kg", 0) < targets["lipid_min"]:
        alerts.append(f"Lipid {body['lipid_g_per_kg']} g/kg/day below minimum {targets['lipid_min']} g/kg/day for day {pnd}.")
    if body.get("fluid_ml_per_kg", 0) < targets["fluid_min"]:
        alerts.append(f"Fluid {body['fluid_ml_per_kg']} ml/kg/day below minimum {targets['fluid_min']} ml/kg/day.")

    return {"adequate": len(alerts) == 0, "alerts": alerts, "targets": targets}
```

---

## Acceptance Criteria

- [ ] `nicu_drug_formulary` seeds 10 standard NICU drugs with correct `dose_mg_per_kg`
- [ ] `nicu_drug_orders.dose_calculated_mg` is a PostgreSQL generated column (subquery on formulary)
- [ ] `nicu_pn_prescriptions.total_kcal_per_kg_per_day` is a generated column using correct macro kcal/g factors
- [ ] `nicu_screening_results.followup_required` is generated from `result_status IN ('refer','inconclusive')`
- [ ] `nicu_nas_scores.requires_treatment` generated as `total_score >= 8`; `treatment_escalation_needed` as `total_score >= 12`
- [ ] `POST /nicu/advanced/drug-orders` returns `cdss_alerts` with explicit max-dose override and monitoring guidance
- [ ] `POST /nicu/advanced/pn-prescription` uses `computePNTargets()` and returns `absolute_targets`
- [ ] `POST /nicu/cdss/nas-score` returns correct `total_score` from Finnegan items
- [ ] `NicuDrugDoseScreen.tsx` shows computed dose with UMOYA alert colours
- [ ] Smoke test passes
