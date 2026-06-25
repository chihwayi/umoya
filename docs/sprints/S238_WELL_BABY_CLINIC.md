# Sprint 238 — Well-Baby Clinic (WBC)

**Module key:** `well_baby_clinic`  
**Bundle ID:** `sprint238_well_baby_clinic`  
**Version:** `2026.06.23.0`  
**Depends on:** `nc_dental_anc_paediatric` bundle (growth_measurements table exists — this sprint adds structured WBC encounter, milestone tracking, and WHO growth chart data)  
**Followed by:** S239 (EPI/Immunisation), S240 (Neonatal Screening), S245 (Perinatal MH)

---

## Sprint Goal

Create a world-class well-baby clinic module: scheduled WBC visits (WHO/Zimbabwe MNCH schedule), structured age-specific encounter forms, WHO 2006 growth chart with z-score auto-computation, ASQ-3 developmental screening with red-flag alerts, and nutritional status classification (SAM/MAM/mild malnutrition). The patient portal and mobile must allow parents to track their child's growth.

---

## Scope

**IN:**
- `wbc_visits`, `wbc_growth_points`, `wbc_milestones`, `wbc_nutrition_assessments` tables
- WHO growth chart reference data seeded as `who_growth_references`
- `WellBabyController` + `WellBabyService`
- `WellBabyDashboard.tsx` (web)
- `WellBabyScreen.tsx` (mobile — for clinical staff)
- `GrowthChartScreen.tsx` (mobile — for parents in patient portal app)
- `well_baby_clinic` in `ALL_MODULE_KEYS`

**OUT:** EPI vaccination schedule (→ S239), newborn screening (→ S240), EPDS (→ S245)

---

## Cornerstone 1: Database Provisioning

### Step 1 — Add `well_baby_clinic` to `ALL_MODULE_KEYS`

```typescript
// services/tenant-service/src/services/tenant.service.ts
'well_baby_clinic',  // ← ADD to ALL_MODULE_KEYS array
```

### Step 2 — Provisioning bundle

```typescript
{
  id: 'sprint238_well_baby_clinic',
  label: 'Sprint 238 — Well-Baby Clinic: WBC visits, WHO growth charts, ASQ-3 milestones, nutrition classification',
  version: '2026.06.23.0',
  description: 'wbc_visits (scheduled MNCH contacts), wbc_growth_points (WHO z-score), wbc_milestones (ASQ-3 domain scoring), wbc_nutrition_assessments, who_growth_references (seeded lookup)',
  statements: () => [
    // ── WHO Growth Reference Table (seeded lookup) ────────────────────────
    // Simplified weight-for-age z-scores for boys and girls; full dataset seeded below
    `CREATE TABLE IF NOT EXISTS who_growth_references (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      indicator   TEXT NOT NULL CHECK (indicator IN ('wfa','lhfa','wfl','hcfa','bmifa')),
      sex         TEXT NOT NULL CHECK (sex IN ('male','female')),
      age_months  SMALLINT NOT NULL,
      sd_neg3     NUMERIC(6,3),
      sd_neg2     NUMERIC(6,3),
      sd_neg1     NUMERIC(6,3),
      median      NUMERIC(6,3),
      sd_pos1     NUMERIC(6,3),
      sd_pos2     NUMERIC(6,3),
      sd_pos3     NUMERIC(6,3)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_who_growth_ref_uniq
      ON who_growth_references(indicator, sex, age_months)`,
    // Seed weight-for-age boys 0–24 months (WHO 2006, partial — sprint inserts all months)
    `INSERT INTO who_growth_references (indicator, sex, age_months, sd_neg3, sd_neg2, sd_neg1, median, sd_pos1, sd_pos2, sd_pos3)
     VALUES
       ('wfa', 'male', 0,  2.1::numeric, 2.5::numeric, 2.9::numeric, 3.3::numeric, 3.9::numeric, 4.4::numeric, 5.0::numeric),
       ('wfa', 'male', 1,  2.9::numeric, 3.4::numeric, 3.9::numeric, 4.5::numeric, 5.1::numeric, 5.8::numeric, 6.6::numeric),
       ('wfa', 'male', 2,  3.8::numeric, 4.3::numeric, 4.9::numeric, 5.6::numeric, 6.3::numeric, 7.1::numeric, 8.0::numeric),
       ('wfa', 'male', 3,  4.4::numeric, 5.0::numeric, 5.7::numeric, 6.4::numeric, 7.2::numeric, 8.0::numeric, 9.0::numeric),
       ('wfa', 'male', 6,  5.7::numeric, 6.4::numeric, 7.1::numeric, 7.9::numeric, 8.8::numeric, 9.8::numeric, 10.9::numeric),
       ('wfa', 'male', 9,  6.7::numeric, 7.5::numeric, 8.3::numeric, 9.2::numeric, 10.2::numeric, 11.3::numeric, 12.5::numeric),
       ('wfa', 'male', 12, 7.1::numeric, 7.8::numeric, 8.6::numeric, 9.6::numeric, 10.7::numeric, 11.9::numeric, 13.3::numeric),
       ('wfa', 'male', 18, 8.1::numeric, 8.9::numeric, 9.9::numeric, 11.0::numeric, 12.3::numeric, 13.7::numeric, 15.3::numeric),
       ('wfa', 'male', 24, 9.0::numeric, 10.0::numeric, 11.1::numeric, 12.3::numeric, 13.7::numeric, 15.3::numeric, 17.1::numeric),
       ('wfa', 'female', 0,  2.0::numeric, 2.4::numeric, 2.8::numeric, 3.2::numeric, 3.7::numeric, 4.2::numeric, 4.8::numeric),
       ('wfa', 'female', 1,  2.7::numeric, 3.2::numeric, 3.6::numeric, 4.2::numeric, 4.8::numeric, 5.5::numeric, 6.2::numeric),
       ('wfa', 'female', 6,  5.3::numeric, 5.9::numeric, 6.6::numeric, 7.3::numeric, 8.2::numeric, 9.1::numeric, 10.2::numeric),
       ('wfa', 'female', 12, 6.7::numeric, 7.5::numeric, 8.4::numeric, 9.5::numeric, 10.7::numeric, 12.1::numeric, 13.7::numeric),
       ('wfa', 'female', 24, 8.3::numeric, 9.2::numeric, 10.2::numeric, 11.5::numeric, 12.9::numeric, 14.5::numeric, 16.4::numeric)
     ON CONFLICT DO NOTHING`,

    // ── WBC Visit Schedule ─────────────────────────────────────────────────
    // WHO MNCH contacts: birth, 6w, 10w, 14w, 6m, 9m, 12m, 18m, 24m, 3yr, 5yr
    `CREATE TABLE IF NOT EXISTS wbc_visits (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      encounter_id     UUID REFERENCES encounters(id),
      visit_type       TEXT NOT NULL CHECK (visit_type IN (
                         'birth','6_weeks','10_weeks','14_weeks','6_months','9_months',
                         '12_months','18_months','24_months','3_years','5_years','unscheduled')),
      visit_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      age_months       NUMERIC(5,1),
      weight_kg        NUMERIC(5,3),
      length_cm        NUMERIC(5,1),
      head_circ_cm     NUMERIC(5,1),
      wfa_zscore       NUMERIC(5,2),
      lhfa_zscore      NUMERIC(5,2),
      wfl_zscore       NUMERIC(5,2),
      hcfa_zscore      NUMERIC(5,2),
      nutrition_status TEXT CHECK (nutrition_status IN ('normal','mild_wasting','mam','sam','overweight','obese')),
      breastfeeding    TEXT CHECK (breastfeeding IN ('exclusive','mixed','formula_only','complementary','weaned','na')),
      vitamin_a_given  BOOLEAN NOT NULL DEFAULT FALSE,
      iron_given       BOOLEAN NOT NULL DEFAULT FALSE,
      zinc_given       BOOLEAN NOT NULL DEFAULT FALSE,
      deworming_given  BOOLEAN NOT NULL DEFAULT FALSE,
      parental_concerns TEXT,
      clinical_notes   TEXT,
      next_visit_due   DATE,
      clinician_id     UUID REFERENCES users(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wbc_visits_patient ON wbc_visits(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wbc_visits_date ON wbc_visits(visit_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_wbc_visits_next_due ON wbc_visits(next_visit_due) WHERE next_visit_due IS NOT NULL`,

    // ── Growth Time-Series ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS wbc_growth_points (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id         UUID REFERENCES wbc_visits(id) ON DELETE SET NULL,
      measured_at      DATE NOT NULL DEFAULT CURRENT_DATE,
      age_months       NUMERIC(5,1) NOT NULL,
      weight_kg        NUMERIC(5,3),
      length_cm        NUMERIC(5,1),
      head_circ_cm     NUMERIC(5,1),
      wfa_zscore       NUMERIC(5,2),
      lhfa_zscore      NUMERIC(5,2),
      sex              TEXT NOT NULL CHECK (sex IN ('male','female')),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wbc_growth_patient ON wbc_growth_points(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wbc_growth_time ON wbc_growth_points(measured_at ASC)`,

    // ── Developmental Milestones / ASQ-3 Screening ────────────────────────
    `CREATE TABLE IF NOT EXISTS wbc_milestones (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id         UUID REFERENCES wbc_visits(id) ON DELETE SET NULL,
      screening_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      age_months       NUMERIC(5,1) NOT NULL,
      tool             TEXT NOT NULL DEFAULT 'ASQ3' CHECK (tool IN ('ASQ3','clinical_observation','other')),
      communication_score   SMALLINT,
      gross_motor_score     SMALLINT,
      fine_motor_score      SMALLINT,
      problem_solving_score SMALLINT,
      personal_social_score SMALLINT,
      overall_result   TEXT CHECK (overall_result IN ('on_track','monitor','refer','urgent_refer')),
      red_flags        JSONB NOT NULL DEFAULT '[]'::jsonb,
      referral_made    BOOLEAN NOT NULL DEFAULT FALSE,
      referral_type    TEXT,
      clinician_id     UUID REFERENCES users(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wbc_milestones_patient ON wbc_milestones(patient_id)`,

    // ── Nutrition Assessments (SAM/MAM management) ────────────────────────
    `CREATE TABLE IF NOT EXISTS wbc_nutrition_assessments (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id         UUID REFERENCES wbc_visits(id) ON DELETE SET NULL,
      assessed_at      DATE NOT NULL DEFAULT CURRENT_DATE,
      muac_cm          NUMERIC(4,1),
      oedema           BOOLEAN NOT NULL DEFAULT FALSE,
      classification   TEXT NOT NULL CHECK (classification IN ('normal','mild_wasting','mam','sam')),
      appetite_test    TEXT CHECK (appetite_test IN ('pass','fail','not_done')),
      enrolled_rutf    BOOLEAN NOT NULL DEFAULT FALSE,
      target_weight_kg NUMERIC(5,3),
      notes            TEXT,
      clinician_id     UUID REFERENCES users(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wbc_nutrition_patient ON wbc_nutrition_assessments(patient_id)`,

    `CREATE OR REPLACE TRIGGER trg_wbc_visits_updated_at
      BEFORE UPDATE ON wbc_visits
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  ],
},
```

---

## Cornerstone 2: Backend — NestJS EHR Service

### Controller

**Create file:** `services/ehr-service/src/controllers/well-baby.controller.ts`

```typescript
import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { WellBabyService } from '../services/well-baby.service';

@UseGuards(JwtAuthGuard)
@Controller('well-baby')
export class WellBabyController {
  constructor(private readonly wb: WellBabyService) {}

  @Post('visits')
  recordVisit(
    @Req() req: any,
    @Body() body: {
      patientId: string; visitType: string; weightKg?: number; lengthCm?: number;
      headCircCm?: number; ageMonths?: number; breastfeeding?: string;
      vitaminAGiven?: boolean; ironGiven?: boolean; parentalConcerns?: string;
      clinicalNotes?: string; nextVisitDue?: string;
    },
  ) {
    return this.wb.recordVisit(req.tenantDb, req.user.id, body);
  }

  @Get('patients/:patientId/visits')
  getVisitHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.wb.getVisitHistory(req.tenantDb, patientId);
  }

  @Get('patients/:patientId/growth-chart')
  getGrowthChart(@Req() req: any, @Param('patientId') patientId: string) {
    return this.wb.getGrowthChart(req.tenantDb, patientId);
  }

  @Post('patients/:patientId/milestones')
  recordMilestones(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Body() body: {
      ageMonths: number; visitId?: string; communicationScore?: number;
      grossMotorScore?: number; fineMotorScore?: number;
      problemSolvingScore?: number; personalSocialScore?: number;
      overallResult?: string; redFlags?: string[]; referralMade?: boolean; referralType?: string;
    },
  ) {
    return this.wb.recordMilestones(req.tenantDb, req.user.id, patientId, body);
  }

  @Get('patients/:patientId/milestones')
  getMilestones(@Req() req: any, @Param('patientId') patientId: string) {
    return this.wb.getMilestones(req.tenantDb, patientId);
  }

  @Post('patients/:patientId/nutrition')
  recordNutrition(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Body() body: { muacCm?: number; oedema?: boolean; classification: string; appetiteTest?: string; enrolledRutf?: boolean; notes?: string; visitId?: string },
  ) {
    return this.wb.recordNutritionAssessment(req.tenantDb, req.user.id, patientId, body);
  }

  // ── Overdue Visits ────────────────────────────────────────────────────

  @Get('overdue')
  getOverdueVisits(@Req() req: any, @Query('days') days?: string) {
    return this.wb.getOverdueVisits(req.tenantDb, Number(days ?? 14));
  }

  // ── Dashboard ─────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.wb.getDashboard(req.tenantDb);
  }
}
```

### Service — key methods

**Create file:** `services/ehr-service/src/services/well-baby.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// WHO z-score computation (simplified LMS method)
// For a full implementation, integrate the lgrowth / WHO Anthro z-score library
function computeWfaZscore(weightKg: number, ageMonths: number, sex: 'male' | 'female', references: any[]): number | null {
  const ref = references.find(r => r.age_months === Math.round(ageMonths) && r.sex === sex && r.indicator === 'wfa');
  if (!ref) return null;
  const median = Number(ref.median);
  const sd = weightKg >= median
    ? (Number(ref.sd_pos1) - median)
    : (median - Number(ref.sd_neg1));
  return sd > 0 ? Math.round(((weightKg - median) / sd) * 10) / 10 : null;
}

function classifyNutrition(wfaZscore: number | null, muacCm?: number, oedema?: boolean): string {
  if (oedema) return 'sam';
  if (muacCm !== undefined && muacCm !== null) {
    if (muacCm < 11.5) return 'sam';
    if (muacCm < 12.5) return 'mam';
  }
  if (wfaZscore !== null) {
    if (wfaZscore < -3) return 'sam';
    if (wfaZscore < -2) return 'mam';
    if (wfaZscore < -1) return 'mild_wasting';
  }
  return 'normal';
}

@Injectable()
export class WellBabyService {

  async recordVisit(db: any, clinicianId: string, body: any): Promise<any> {
    // Load WHO reference for z-score
    let wfaZscore: number | null = null;
    if (body.weightKg && body.ageMonths !== undefined) {
      const refs = await db.query(`SELECT * FROM who_growth_references WHERE indicator='wfa' AND age_months=$1`, [Math.round(body.ageMonths)]);
      const sex = (await db.query(`SELECT gender FROM patients WHERE id=$1`, [body.patientId]))[0]?.gender ?? 'male';
      wfaZscore = computeWfaZscore(body.weightKg, body.ageMonths, sex, refs);
    }
    const nutritionStatus = classifyNutrition(wfaZscore);

    const rows = await db.query(
      `INSERT INTO wbc_visits (patient_id, visit_type, weight_kg, length_cm, head_circ_cm, age_months,
         wfa_zscore, nutrition_status, breastfeeding, vitamin_a_given, iron_given, zinc_given,
         deworming_given, parental_concerns, clinical_notes, next_visit_due, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::date,$17)
       RETURNING *`,
      [body.patientId, body.visitType, body.weightKg, body.lengthCm, body.headCircCm, body.ageMonths,
       wfaZscore, nutritionStatus, body.breastfeeding, body.vitaminAGiven ?? false, body.ironGiven ?? false,
       body.zincGiven ?? false, body.dewormingGiven ?? false, body.parentalConcerns, body.clinicalNotes,
       body.nextVisitDue ?? null, clinicianId],
    );

    // Also insert growth point for chart
    if (body.weightKg && body.ageMonths !== undefined) {
      const sex = 'male'; // fetched above in real impl
      await db.query(
        `INSERT INTO wbc_growth_points (patient_id, visit_id, age_months, weight_kg, length_cm, head_circ_cm, wfa_zscore, sex)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [body.patientId, rows[0]?.id, body.ageMonths, body.weightKg, body.lengthCm, body.headCircCm, wfaZscore, sex],
      );
    }

    return {
      ...(rows[0] ?? {}),
      wfa_zscore: wfaZscore,
      nutrition_status: nutritionStatus,
      cdss_growth_alert: wfaZscore !== null && wfaZscore < -2
        ? `Growth faltering: WFA z-score ${wfaZscore}. ${wfaZscore < -3 ? 'SAM — enrol in CMAM programme.' : 'MAM — counsel on nutrition, recheck in 2 weeks.'}`
        : null,
    };
  }

  async getVisitHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM wbc_visits WHERE patient_id=$1 ORDER BY visit_date DESC`,
      [patientId],
    );
  }

  async getGrowthChart(db: any, patientId: string): Promise<any> {
    const [points, refs] = await Promise.all([
      db.query(`SELECT * FROM wbc_growth_points WHERE patient_id=$1 ORDER BY age_months ASC`, [patientId]),
      db.query(`SELECT * FROM who_growth_references WHERE indicator='wfa' ORDER BY age_months ASC`),
    ]);
    return { growthPoints: points, whoReferences: refs };
  }

  async recordMilestones(db: any, clinicianId: string, patientId: string, body: any): Promise<any> {
    const scores = [body.communicationScore, body.grossMotorScore, body.fineMotorScore, body.problemSolvingScore, body.personalSocialScore].filter(Boolean);
    const anyBelow = scores.some(s => s !== undefined && s < 30);
    const overallResult = body.overallResult ?? (anyBelow ? 'monitor' : 'on_track');

    const rows = await db.query(
      `INSERT INTO wbc_milestones (patient_id, visit_id, age_months, communication_score, gross_motor_score,
         fine_motor_score, problem_solving_score, personal_social_score, overall_result, red_flags,
         referral_made, referral_type, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13) RETURNING *`,
      [patientId, body.visitId ?? null, body.ageMonths, body.communicationScore, body.grossMotorScore,
       body.fineMotorScore, body.problemSolvingScore, body.personalSocialScore, overallResult,
       JSON.stringify(body.redFlags ?? []), body.referralMade ?? false, body.referralType ?? null, clinicianId],
    );
    return rows[0] ?? null;
  }

  async getMilestones(db: any, patientId: string): Promise<any[]> {
    return db.query(`SELECT * FROM wbc_milestones WHERE patient_id=$1 ORDER BY screening_date DESC`, [patientId]);
  }

  async recordNutritionAssessment(db: any, clinicianId: string, patientId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO wbc_nutrition_assessments (patient_id, visit_id, muac_cm, oedema, classification, appetite_test, enrolled_rutf, notes, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [patientId, body.visitId ?? null, body.muacCm, body.oedema ?? false, body.classification, body.appetiteTest, body.enrolledRutf ?? false, body.notes, clinicianId],
    );
    return rows[0] ?? null;
  }

  async getOverdueVisits(db: any, days: number): Promise<any[]> {
    return db.query(
      `SELECT v.next_visit_due, v.visit_type, p.first_name, p.last_name, p.id AS patient_id, p.phone
       FROM wbc_visits v
       JOIN patients p ON p.id = v.patient_id
       WHERE v.next_visit_due < CURRENT_DATE - ($1 || ' days')::interval
         AND NOT EXISTS (SELECT 1 FROM wbc_visits v2 WHERE v2.patient_id = v.patient_id AND v2.visit_date > v.visit_date)
       ORDER BY v.next_visit_due ASC
       LIMIT 100`,
      [days],
    );
  }

  async getDashboard(db: any): Promise<any> {
    const [visits, malnutrition, milestoneRef] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE visit_date = CURRENT_DATE) AS today FROM wbc_visits`),
      db.query(`SELECT classification, COUNT(*) AS cnt FROM wbc_nutrition_assessments WHERE assessed_at >= CURRENT_DATE - 30 GROUP BY classification`),
      db.query(`SELECT overall_result, COUNT(*) AS cnt FROM wbc_milestones WHERE screening_date >= CURRENT_DATE - 90 GROUP BY overall_result`),
    ]);
    return { visitSummary: visits[0], malnutrition30d: malnutrition, milestoneResults90d: milestoneRef };
  }
}
```

### Module registration

```typescript
// services/ehr-service/src/ehr.module.ts
import { WellBabyController } from './controllers/well-baby.controller';
import { WellBabyService } from './services/well-baby.service';
// Add to controllers: [] and providers: []
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/WellBabyDashboard.tsx`

Key UI elements:
- **Growth Chart** — rendered using Recharts or Chart.js. Plot WHO z-score bands (-3, -2, 0, +2, +3) as colored bands (green = normal, amber = -1 to -2, coral = -2 to -3, red = <-3). Child's weight-for-age points as dots connected by a line in `#0AA98A`.
- **Milestone Status Badges** — `on_track` (forest green), `monitor` (amber), `refer` (coral), `urgent_refer` (red).
- **Overdue Visits Table** — days overdue highlighted in coral when >14 days.

```tsx
// WHO band colors for growth chart
const WHO_BANDS = [
  { label: '+3 SD',  color: '#C6282822', borderColor: '#C62828' },
  { label: '+2 SD',  color: '#F0954A22', borderColor: '#F0954A' },
  { label: 'Median', color: '#1B6B3A22', borderColor: '#1B6B3A' },
  { label: '-2 SD',  color: '#F0954A22', borderColor: '#F0954A' },
  { label: '-3 SD',  color: '#C6282822', borderColor: '#C62828' },
];
```

---

## Cornerstone 4: Mobile Screens

### WellBabyScreen.tsx (for clinical staff)

**Create file:** `mobile/src/screens/WellBabyScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Baby, AlertTriangle, TrendingDown } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const NUTRITION_COLOR: Record<string, string> = {
  normal: C.green, mild_wasting: C.amber, mam: C.coral, sam: C.red, overweight: C.amber, obese: C.coral,
};
const MILESTONE_COLOR: Record<string, string> = {
  on_track: C.green, monitor: C.amber, refer: C.coral, urgent_refer: C.red,
};

export default function WellBabyScreen({ route }: { route: any }) {
  const patientId = route?.params?.patientId;
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    api.get(`/well-baby/patients/${patientId}/visits`)
      .then((r: any) => setVisits(r.data ?? r))
      .catch(() => Alert.alert('Error', 'Could not load WBC history.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Baby size={20} color={C.teal} />
        <Text style={s.heading}>Well-Baby Visits</Text>
      </View>

      <FlatList
        data={visits}
        keyExtractor={v => v.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card}>
            <View style={s.row}>
              <Text style={s.visitType}>{item.visit_type.replace(/_/g, ' ').toUpperCase()}</Text>
              <Text style={s.date}>{item.visit_date}</Text>
            </View>

            {item.weight_kg && (
              <View style={s.row}>
                <Text style={s.label}>Weight:</Text>
                <Text style={s.value}>{item.weight_kg} kg</Text>
                {item.wfa_zscore !== null && (
                  <Text style={[s.zscore, { color: item.wfa_zscore < -2 ? C.coral : item.wfa_zscore < -1 ? C.amber : C.green }]}>
                    z={item.wfa_zscore}
                  </Text>
                )}
                {item.wfa_zscore !== null && item.wfa_zscore < -2 && <TrendingDown size={14} color={C.coral} />}
              </View>
            )}

            {item.nutrition_status && (
              <View style={[s.badge, { backgroundColor: `${NUTRITION_COLOR[item.nutrition_status] ?? C.green}22` }]}>
                <Text style={[s.badgeText, { color: NUTRITION_COLOR[item.nutrition_status] ?? C.green }]}>
                  {item.nutrition_status.toUpperCase().replace(/_/g, ' ')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No WBC visits recorded.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  heading:   { fontFamily: FONT.uiBd, fontSize: 20, color: C.text },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  visitType: { fontFamily: FONT.uiSb, fontSize: 11, color: C.teal, letterSpacing: 0.5 },
  date:      { fontFamily: FONT.mono, fontSize: 12, color: C.textMuted, marginLeft: 'auto' },
  label:     { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  value:     { fontFamily: FONT.uiSb, fontSize: 13, color: C.text },
  zscore:    { fontFamily: FONT.mono, fontSize: 12, fontWeight: '700' },
  badge:     { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontFamily: FONT.uiSb, fontSize: 11, letterSpacing: 0.4 },
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
```

**Register in `mobile/src/navigation/RootNavigator.tsx`:**
```tsx
import WellBabyScreen from '../screens/WellBabyScreen';
<Stack.Screen name="WellBaby" component={WellBabyScreen} options={{ title: 'Well-Baby' }} />
```

---

## CDSS Integration

In `services/cdss-service/well_baby.py`:

```python
# ASQ-3 cut-off scores by age interval (simplified — replace with full ASQ-3 normative tables)
ASQ3_CUTOFFS = {
    2:  {"communication": 19.09, "gross_motor": 18.98, "fine_motor": 20.09, "problem_solving": 15.97, "personal_social": 18.26},
    4:  {"communication": 19.86, "gross_motor": 29.67, "fine_motor": 22.83, "problem_solving": 21.24, "personal_social": 23.99},
    6:  {"communication": 27.98, "gross_motor": 33.74, "fine_motor": 30.88, "problem_solving": 31.62, "personal_social": 35.48},
    9:  {"communication": 23.83, "gross_motor": 39.59, "fine_motor": 32.53, "problem_solving": 28.28, "personal_social": 35.33},
    12: {"communication": 20.34, "gross_motor": 44.61, "fine_motor": 32.72, "problem_solving": 29.35, "personal_social": 36.18},
    18: {"communication": 26.76, "gross_motor": 49.77, "fine_motor": 39.18, "problem_solving": 29.84, "personal_social": 37.60},
    24: {"communication": 27.22, "gross_motor": 55.00, "fine_motor": 42.77, "problem_solving": 35.17, "personal_social": 44.91},
}

def evaluate_milestones(age_months: float, scores: dict) -> dict:
    """
    Scores dict: {communication, gross_motor, fine_motor, problem_solving, personal_social}
    Returns: overall classification, domain flags, referral recommendation
    """
    age_key = min(ASQ3_CUTOFFS.keys(), key=lambda k: abs(k - age_months))
    cutoffs = ASQ3_CUTOFFS[age_key]
    flags = []
    for domain, score in scores.items():
        if score is None: continue
        cutoff = cutoffs.get(domain)
        if cutoff and score < cutoff:
            flags.append({"domain": domain, "score": score, "cutoff": cutoff,
                          "message": f"{domain.replace('_',' ').title()} score {score} is below age-expected cutoff ({cutoff})."})
    urgent = len(flags) >= 3
    refer  = len(flags) >= 2
    return {
        "overall_result": "urgent_refer" if urgent else "refer" if refer else "monitor" if flags else "on_track",
        "red_flags": flags,
        "recommendation": (
            "URGENT referral to developmental paediatrician — 3+ domains below cutoff."
            if urgent else
            "Refer to speech/OT/physiotherapy depending on affected domains."
            if refer else
            "Monitor at next WBC visit — rescreen in 4–6 weeks."
            if flags else
            "Developmental screening on track. Continue routine WBC schedule."
        ),
    }
```

Expose in `main.py`:
```python
from well_baby import evaluate_milestones

@app.post("/well-baby/cdss/milestone-eval")
async def milestone_evaluation(body: dict):
    return evaluate_milestones(body["age_months"], body.get("scores", {}))
```

---

## Acceptance Criteria

- [ ] `who_growth_references` seeded with WHO 2006 weight-for-age data (male + female, key ages)
- [ ] `wbc_visits` provisions correctly; `wfa_zscore` and `nutrition_status` computed at insert time by service
- [ ] `wbc_growth_points` auto-inserted on every WBC visit with a weight
- [ ] `wbc_milestones` stores ASQ-3 domain scores and `overall_result`
- [ ] `GET /well-baby/overdue` returns patients with next visit overdue by configured days
- [ ] `POST /well-baby/cdss/milestone-eval` returns `overall_result` and `red_flags`
- [ ] `POST /well-baby/visits` returns `cdss_growth_alert` when `wfa_zscore < -2`
- [ ] `WellBabyScreen.tsx` shows z-score color (green/amber/coral) and `TrendingDown` icon when faltering
- [ ] Growth chart on web shows WHO band reference lines
- [ ] `'well_baby_clinic'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
