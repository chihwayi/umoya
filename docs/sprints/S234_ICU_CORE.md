# Sprint 234 — ICU Management Core

**Module key:** `intensive_care`  
**Bundle ID:** `sprint234_icu_core`  
**Version:** `2026.06.23.0`  
**Depends on:** `ward_round` bundle (already exists — `ward_beds` table is reused), `emergency` module  
**Followed by:** S235 (ICU AI Quality — SOFA alerts, lung-protective ventilation guard, AI handover summary)

---

## Sprint Goal

Build a dedicated ICU management layer with bed registry (ICU/SICU/MICU/NICU/HDU types), high-frequency vital sign charting, ventilator settings record, 24-hour fluid balance sheet, vasopressor/sedation orders, daily ICU goals checklist, and SOFA/APACHE II scoring. The `ward_round` module covers general ward SOAP notes — the ICU layer is a purpose-built clinical workhorse that sits on top of it.

---

## Scope

**IN:**
- `icu_admissions`, `icu_vitals`, `icu_ventilator_settings`, `icu_fluid_balance`, `icu_infusions`, `icu_daily_goals`, `icu_scores` tables
- `IcuController` + `IcuService`
- `IcuDashboard.tsx` (web) — census with bed map, ventilator flags
- `IcuBedScreen.tsx` (mobile)
- `intensive_care` in `ALL_MODULE_KEYS`
- Provisioning bundle

**OUT:** AI-driven weaning readiness, overnight summary generation, VAP/CAUTI tracking (→ S235)

---

## Cornerstone 1: Database Provisioning

### Step 1 — Add `intensive_care` to `ALL_MODULE_KEYS`

**File:** `services/tenant-service/src/services/tenant.service.ts`

```typescript
const ALL_MODULE_KEYS = [
  // ... existing + S230/S232 additions ...
  'intensive_care',  // ← ADD
] as const;
```

### Step 2 — Provisioning bundle

**File:** `services/tenant-service/src/services/database-provisioning.service.ts`

```typescript
{
  id: 'sprint234_icu_core',
  label: 'Sprint 234 — ICU Core: admissions, ventilator, fluid balance, SOFA/APACHE scoring, daily goals',
  version: '2026.06.23.0',
  description: 'Dedicated ICU management tables: icu_admissions, icu_vitals (high-freq), icu_ventilator_settings, icu_fluid_balance, icu_infusions, icu_daily_goals, icu_scores',
  statements: () => [
    // ── ICU Admissions ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_admissions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      encounter_id     UUID REFERENCES encounters(id),
      icu_type         TEXT NOT NULL DEFAULT 'general' CHECK (icu_type IN ('general','surgical','medical','neonatal','hdu')),
      bed_code         TEXT NOT NULL,
      admission_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      discharge_at     TIMESTAMPTZ,
      admission_diagnosis TEXT,
      admission_apache2_score SMALLINT,
      admission_sofa_score SMALLINT,
      isolation_required BOOLEAN NOT NULL DEFAULT FALSE,
      isolation_type   TEXT,
      ventilator_required BOOLEAN NOT NULL DEFAULT FALSE,
      admitted_by      UUID REFERENCES users(id),
      status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharged','transferred','deceased')),
      discharge_destination TEXT,
      los_days         NUMERIC(6,1) GENERATED ALWAYS AS (
                         EXTRACT(EPOCH FROM (COALESCE(discharge_at, NOW()) - admission_at)) / 86400
                       ) STORED,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_icu_admissions_patient ON icu_admissions(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_icu_admissions_status ON icu_admissions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_icu_admissions_icu_type ON icu_admissions(icu_type)`,
    `CREATE INDEX IF NOT EXISTS idx_icu_admissions_bed ON icu_admissions(bed_code) WHERE status = 'active'`,

    // ── High-Frequency ICU Vitals ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_vitals (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      charted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      hr               SMALLINT,
      bp_systolic      SMALLINT,
      bp_diastolic     SMALLINT,
      map              SMALLINT,
      cvp              SMALLINT,
      spo2             SMALLINT,
      rr               SMALLINT,
      temp             NUMERIC(4,1),
      gcs_eye          SMALLINT CHECK (gcs_eye BETWEEN 1 AND 4),
      gcs_verbal       SMALLINT CHECK (gcs_verbal BETWEEN 1 AND 5),
      gcs_motor        SMALLINT CHECK (gcs_motor BETWEEN 1 AND 6),
      urine_output_ml  SMALLINT,
      etco2            SMALLINT,
      charted_by       UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_icu_vitals_admission ON icu_vitals(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_icu_vitals_time ON icu_vitals(charted_at DESC)`,

    // ── Ventilator Settings ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_ventilator_settings (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      mode             TEXT CHECK (mode IN ('vc_ac','pc_ac','simv','cpap','psv','bipap','hfov','ncpap','nhfnc','spontaneous')),
      fio2             NUMERIC(4,2) CHECK (fio2 BETWEEN 0.21 AND 1.0),
      peep             SMALLINT,
      tidal_volume_ml  SMALLINT,
      rate             SMALLINT,
      ps_above_peep    SMALLINT,
      plateau_pressure SMALLINT,
      driving_pressure SMALLINT GENERATED ALWAYS AS (plateau_pressure - peep) STORED,
      compliance_ml_cmH2O NUMERIC(5,1),
      pip              SMALLINT,
      i_e_ratio        TEXT,
      pf_ratio         SMALLINT,
      is_alarm_driving_pressure BOOLEAN GENERATED ALWAYS AS (plateau_pressure - peep > 15) STORED,
      is_alarm_plateau BOOLEAN GENERATED ALWAYS AS (plateau_pressure > 30) STORED,
      recorded_by      UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_icu_vent_admission ON icu_ventilator_settings(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_icu_vent_alarms ON icu_ventilator_settings(is_alarm_driving_pressure, is_alarm_plateau)
       WHERE is_alarm_driving_pressure = TRUE OR is_alarm_plateau = TRUE`,

    // ── 24-Hour Fluid Balance ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_fluid_balance (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      balance_date     DATE NOT NULL DEFAULT CURRENT_DATE,
      iv_fluids_ml     INTEGER NOT NULL DEFAULT 0,
      medications_ml   INTEGER NOT NULL DEFAULT 0,
      enteral_ml       INTEGER NOT NULL DEFAULT 0,
      oral_ml          INTEGER NOT NULL DEFAULT 0,
      blood_products_ml INTEGER NOT NULL DEFAULT 0,
      urine_out_ml     INTEGER NOT NULL DEFAULT 0,
      drain_out_ml     INTEGER NOT NULL DEFAULT 0,
      ng_out_ml        INTEGER NOT NULL DEFAULT 0,
      stool_out_ml     INTEGER NOT NULL DEFAULT 0,
      insensible_ml    INTEGER NOT NULL DEFAULT 0,
      net_balance_ml   INTEGER GENERATED ALWAYS AS (
                         (iv_fluids_ml + medications_ml + enteral_ml + oral_ml + blood_products_ml)
                         - (urine_out_ml + drain_out_ml + ng_out_ml + stool_out_ml + insensible_ml)
                       ) STORED,
      recorded_by      UUID REFERENCES users(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_icu_fluid_uniq ON icu_fluid_balance(admission_id, balance_date)`,
    `CREATE INDEX IF NOT EXISTS idx_icu_fluid_admission ON icu_fluid_balance(admission_id)`,

    // ── Vasopressor / Inotrope Infusions ──────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_infusions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      drug_name        TEXT NOT NULL,
      concentration    TEXT,
      rate_ml_hr       NUMERIC(6,2),
      dose_mcg_kg_min  NUMERIC(6,3),
      started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      stopped_at       TIMESTAMPTZ,
      rationale        TEXT,
      ordered_by       UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_icu_infusions_admission ON icu_infusions(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_icu_infusions_active ON icu_infusions(stopped_at) WHERE stopped_at IS NULL`,

    // ── Daily ICU Goals Checklist ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_daily_goals (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      goal_date        DATE NOT NULL DEFAULT CURRENT_DATE,
      dvt_prophylaxis  BOOLEAN,
      stress_ulcer_prx BOOLEAN,
      hob_elevation_30 BOOLEAN,
      oral_care_done   BOOLEAN,
      spontaneous_breathing_trial BOOLEAN,
      cam_icu_result   TEXT CHECK (cam_icu_result IN ('positive','negative','unable_to_assess')),
      rass_target      SMALLINT CHECK (rass_target BETWEEN -5 AND 4),
      rass_actual      SMALLINT CHECK (rass_actual BETWEEN -5 AND 4),
      central_line_days SMALLINT,
      foley_days       SMALLINT,
      ett_days         SMALLINT,
      nutrition_goal_kcal INTEGER,
      nutrition_delivered_kcal INTEGER,
      goals_met        BOOLEAN,
      notes            TEXT,
      completed_by     UUID REFERENCES users(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_icu_goals_uniq ON icu_daily_goals(admission_id, goal_date)`,

    // ── ICU Severity Scores ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS icu_scores (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES icu_admissions(id) ON DELETE CASCADE,
      scored_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sofa_resp        SMALLINT,
      sofa_coag        SMALLINT,
      sofa_liver       SMALLINT,
      sofa_cardio      SMALLINT,
      sofa_cns         SMALLINT,
      sofa_renal       SMALLINT,
      sofa_total       SMALLINT GENERATED ALWAYS AS (
                         COALESCE(sofa_resp,0)+COALESCE(sofa_coag,0)+COALESCE(sofa_liver,0)+
                         COALESCE(sofa_cardio,0)+COALESCE(sofa_cns,0)+COALESCE(sofa_renal,0)
                       ) STORED,
      apache2_score    SMALLINT,
      predicted_mortality_pct NUMERIC(5,2),
      scored_by        UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_icu_scores_admission ON icu_scores(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_icu_scores_time ON icu_scores(scored_at DESC)`,

    `CREATE OR REPLACE TRIGGER trg_icu_admissions_updated_at
      BEFORE UPDATE ON icu_admissions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

    `CREATE OR REPLACE TRIGGER trg_icu_fluid_updated_at
      BEFORE UPDATE ON icu_fluid_balance
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  ],
},
```

---

## Cornerstone 2: Backend — NestJS EHR Service

### Controller

**Create file:** `services/ehr-service/src/controllers/icu.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IcuService } from '../services/icu.service';

@UseGuards(JwtAuthGuard)
@Controller('icu')
export class IcuController {
  constructor(private readonly icu: IcuService) {}

  @Get('census')
  getCensus(@Req() req: any, @Query('icuType') icuType?: string) {
    return this.icu.getCensus(req.tenantDb, icuType);
  }

  @Post('admissions')
  admit(@Req() req: any, @Body() body: { patientId: string; encounterId?: string; icuType?: string; bedCode: string; diagnosis?: string; ventilatorRequired?: boolean; isolationRequired?: boolean; isolationType?: string }) {
    return this.icu.admitPatient(req.tenantDb, req.user.id, body);
  }

  @Patch('admissions/:id/discharge')
  discharge(@Req() req: any, @Param('id') id: string, @Body() body: { destination?: string }) {
    return this.icu.dischargePatient(req.tenantDb, id, body.destination);
  }

  @Post('admissions/:id/vitals')
  chartVitals(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.icu.chartVitals(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/vitals')
  getVitals(@Req() req: any, @Param('id') id: string, @Query('hours') hours?: string) {
    return this.icu.getVitals(req.tenantDb, id, Number(hours ?? 24));
  }

  @Post('admissions/:id/ventilator')
  recordVentilator(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.icu.recordVentilatorSettings(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/ventilator')
  getVentilatorHistory(@Req() req: any, @Param('id') id: string) {
    return this.icu.getVentilatorHistory(req.tenantDb, id);
  }

  @Post('admissions/:id/ventilator-alarms')
  getVentilatorAlarms(@Req() req: any, @Param('id') id: string) {
    return this.icu.getActiveVentilatorAlarms(req.tenantDb, id);
  }

  @Post('admissions/:id/fluid-balance')
  upsertFluidBalance(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.icu.upsertFluidBalance(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/fluid-balance')
  getFluidBalance(@Req() req: any, @Param('id') id: string) {
    return this.icu.getFluidBalance(req.tenantDb, id);
  }

  @Post('admissions/:id/infusions')
  startInfusion(@Req() req: any, @Param('id') id: string, @Body() body: { drugName: string; concentration?: string; rateMlHr?: number; doseMcgKgMin?: number; rationale?: string }) {
    return this.icu.startInfusion(req.tenantDb, req.user.id, id, body);
  }

  @Patch('infusions/:infusionId/stop')
  stopInfusion(@Req() req: any, @Param('infusionId') infusionId: string) {
    return this.icu.stopInfusion(req.tenantDb, infusionId);
  }

  @Get('admissions/:id/infusions')
  getActiveInfusions(@Req() req: any, @Param('id') id: string) {
    return this.icu.getActiveInfusions(req.tenantDb, id);
  }

  @Post('admissions/:id/daily-goals')
  saveDailyGoals(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.icu.saveDailyGoals(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/daily-goals')
  getDailyGoals(@Req() req: any, @Param('id') id: string) {
    return this.icu.getDailyGoals(req.tenantDb, id);
  }

  @Post('admissions/:id/scores')
  recordScore(@Req() req: any, @Param('id') id: string, @Body() body: { sofaResp?: number; sofaCoag?: number; sofaLiver?: number; sofaCardio?: number; sofaCns?: number; sofaRenal?: number; apache2Score?: number }) {
    return this.icu.recordScore(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/scores')
  getScores(@Req() req: any, @Param('id') id: string) {
    return this.icu.getScores(req.tenantDb, id);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.icu.getDashboard(req.tenantDb);
  }
}
```

### Service (key methods)

**Create file:** `services/ehr-service/src/services/icu.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class IcuService {

  async getCensus(db: any, icuType?: string): Promise<any[]> {
    return db.query(
      `SELECT ia.id, ia.icu_type, ia.bed_code, ia.admission_at, ia.los_days, ia.isolation_required,
              ia.ventilator_required, ia.status,
              p.first_name, p.last_name, p.date_of_birth,
              COALESCE(latest_sofa.sofa_total, 0) AS latest_sofa,
              latest_vent.is_alarm_driving_pressure, latest_vent.is_alarm_plateau
       FROM icu_admissions ia
       JOIN patients p ON p.id = ia.patient_id
       LEFT JOIN LATERAL (
         SELECT sofa_total FROM icu_scores WHERE admission_id = ia.id ORDER BY scored_at DESC LIMIT 1
       ) latest_sofa ON TRUE
       LEFT JOIN LATERAL (
         SELECT is_alarm_driving_pressure, is_alarm_plateau
         FROM icu_ventilator_settings WHERE admission_id = ia.id ORDER BY recorded_at DESC LIMIT 1
       ) latest_vent ON TRUE
       WHERE ia.status = 'active'
         AND ($1::text IS NULL OR ia.icu_type = $1)
       ORDER BY ia.los_days DESC`,
      [icuType ?? null],
    );
  }

  async admitPatient(db: any, admittedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_admissions (patient_id, encounter_id, icu_type, bed_code, admission_diagnosis, ventilator_required, isolation_required, isolation_type, admitted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.patientId, body.encounterId ?? null, body.icuType ?? 'general', body.bedCode,
       body.diagnosis, body.ventilatorRequired ?? false, body.isolationRequired ?? false,
       body.isolationType ?? null, admittedBy],
    );
    return rows[0] ?? null;
  }

  async dischargePatient(db: any, id: string, destination?: string): Promise<any> {
    const rows = await db.query(
      `UPDATE icu_admissions SET status='discharged', discharge_at=NOW(), discharge_destination=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *, los_days`,
      [destination ?? null, id],
    );
    return rows[0] ?? null;
  }

  async chartVitals(db: any, chartedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_vitals (admission_id, hr, bp_systolic, bp_diastolic, map, cvp, spo2, rr, temp,
         gcs_eye, gcs_verbal, gcs_motor, urine_output_ml, etco2, charted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [admissionId, body.hr, body.bpSystolic, body.bpDiastolic, body.map, body.cvp, body.spo2,
       body.rr, body.temp, body.gcsEye, body.gcsVerbal, body.gcsMotor, body.urineOutputMl,
       body.etco2, chartedBy],
    );
    return rows[0] ?? null;
  }

  async getVitals(db: any, admissionId: string, hours: number): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_vitals WHERE admission_id=$1 AND charted_at >= NOW() - ($2 || ' hours')::interval ORDER BY charted_at`,
      [admissionId, hours],
    );
  }

  async recordVentilatorSettings(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_ventilator_settings (admission_id, mode, fio2, peep, tidal_volume_ml, rate, ps_above_peep,
         plateau_pressure, compliance_ml_cmH2O, pip, i_e_ratio, pf_ratio, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *, driving_pressure, is_alarm_driving_pressure, is_alarm_plateau`,
      [admissionId, body.mode, body.fio2, body.peep, body.tidalVolumeMl, body.rate, body.psAbovePeep,
       body.plateauPressure, body.complianceMlCmH2O, body.pip, body.ieRatio, body.pfRatio, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getVentilatorHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_ventilator_settings WHERE admission_id=$1 ORDER BY recorded_at DESC LIMIT 48`,
      [admissionId],
    );
  }

  async getActiveVentilatorAlarms(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_ventilator_settings
       WHERE admission_id=$1
         AND (is_alarm_driving_pressure = TRUE OR is_alarm_plateau = TRUE)
       ORDER BY recorded_at DESC LIMIT 10`,
      [admissionId],
    );
  }

  async upsertFluidBalance(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_fluid_balance (admission_id, balance_date, iv_fluids_ml, medications_ml, enteral_ml, oral_ml,
         blood_products_ml, urine_out_ml, drain_out_ml, ng_out_ml, stool_out_ml, insensible_ml, recorded_by)
       VALUES ($1,COALESCE($2::date,CURRENT_DATE),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (admission_id, balance_date) DO UPDATE SET
         iv_fluids_ml=$3, medications_ml=$4, enteral_ml=$5, oral_ml=$6, blood_products_ml=$7,
         urine_out_ml=$8, drain_out_ml=$9, ng_out_ml=$10, stool_out_ml=$11, insensible_ml=$12,
         recorded_by=$13, updated_at=NOW()
       RETURNING *, net_balance_ml`,
      [admissionId, body.balanceDate ?? null, body.ivFluidsMl ?? 0, body.medicationsMl ?? 0,
       body.enteralMl ?? 0, body.oralMl ?? 0, body.bloodProductsMl ?? 0,
       body.urineOutMl ?? 0, body.drainOutMl ?? 0, body.ngOutMl ?? 0, body.stoolOutMl ?? 0,
       body.insensibleMl ?? 400, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getFluidBalance(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, net_balance_ml FROM icu_fluid_balance WHERE admission_id=$1 ORDER BY balance_date DESC LIMIT 7`,
      [admissionId],
    );
  }

  async startInfusion(db: any, orderedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_infusions (admission_id, drug_name, concentration, rate_ml_hr, dose_mcg_kg_min, rationale, ordered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [admissionId, body.drugName, body.concentration, body.rateMlHr, body.doseMcgKgMin, body.rationale, orderedBy],
    );
    return rows[0] ?? null;
  }

  async stopInfusion(db: any, infusionId: string): Promise<any> {
    const rows = await db.query(
      `UPDATE icu_infusions SET stopped_at=NOW() WHERE id=$1 RETURNING *`,
      [infusionId],
    );
    return rows[0] ?? null;
  }

  async getActiveInfusions(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_infusions WHERE admission_id=$1 AND stopped_at IS NULL ORDER BY started_at`,
      [admissionId],
    );
  }

  async saveDailyGoals(db: any, completedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_daily_goals (admission_id, goal_date, dvt_prophylaxis, stress_ulcer_prx, hob_elevation_30,
         oral_care_done, spontaneous_breathing_trial, cam_icu_result, rass_target, rass_actual,
         central_line_days, foley_days, ett_days, nutrition_goal_kcal, nutrition_delivered_kcal, goals_met, notes, completed_by)
       VALUES ($1,COALESCE($2::date,CURRENT_DATE),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (admission_id, goal_date) DO UPDATE SET
         dvt_prophylaxis=$3, stress_ulcer_prx=$4, hob_elevation_30=$5, oral_care_done=$6,
         spontaneous_breathing_trial=$7, cam_icu_result=$8, rass_target=$9, rass_actual=$10,
         central_line_days=$11, foley_days=$12, ett_days=$13, nutrition_goal_kcal=$14,
         nutrition_delivered_kcal=$15, goals_met=$16, notes=$17, completed_by=$18
       RETURNING *`,
      [admissionId, body.goalDate ?? null, body.dvtProphylaxis, body.stressUlcerPrx, body.hobElevation30,
       body.oralCareDone, body.spontaneousBreathingTrial, body.camIcuResult, body.rassTarget, body.rassActual,
       body.centralLineDays, body.foleyDays, body.ettDays, body.nutritionGoalKcal, body.nutritionDeliveredKcal,
       body.goalsMet, body.notes, completedBy],
    );
    return rows[0] ?? null;
  }

  async getDailyGoals(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_daily_goals WHERE admission_id=$1 ORDER BY goal_date DESC LIMIT 3`,
      [admissionId],
    );
  }

  async recordScore(db: any, scoredBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_scores (admission_id, sofa_resp, sofa_coag, sofa_liver, sofa_cardio, sofa_cns, sofa_renal, apache2_score, scored_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *, sofa_total`,
      [admissionId, body.sofaResp, body.sofaCoag, body.sofaLiver, body.sofaCardio, body.sofaCns, body.sofaRenal, body.apache2Score, scoredBy],
    );
    return rows[0] ?? null;
  }

  async getScores(db: any, admissionId: string): Promise<any[]> {
    return db.query(`SELECT *, sofa_total FROM icu_scores WHERE admission_id=$1 ORDER BY scored_at DESC LIMIT 10`, [admissionId]);
  }

  async getDashboard(db: any): Promise<any> {
    const [census, alarms, avgSofa] = await Promise.all([
      db.query(`SELECT icu_type, COUNT(*) AS cnt FROM icu_admissions WHERE status='active' GROUP BY icu_type`),
      db.query(`SELECT COUNT(*) AS cnt FROM icu_ventilator_settings WHERE (is_alarm_driving_pressure OR is_alarm_plateau) AND recorded_at >= NOW() - INTERVAL '1 hour'`),
      db.query(`SELECT ROUND(AVG(sofa_total),1) AS avg_sofa FROM icu_scores WHERE scored_at >= NOW() - INTERVAL '24 hours'`),
    ]);
    return { census, recentVentAlarms: alarms[0]?.cnt ?? 0, avgSofa24h: avgSofa[0]?.avg_sofa };
  }
}
```

### Module registration

**File:** `services/ehr-service/src/ehr.module.ts`

```typescript
import { IcuController } from './controllers/icu.controller';
import { IcuService } from './services/icu.service';
// Add to controllers: [] and providers: []
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/IcuDashboard.tsx`

Key UI elements:
- **ICU Bed Map** — grid of bed cards color-coded by SOFA score (green ≤4, amber 5–8, coral 9–11, deep red ≥12)
- **Ventilator Alarm Banner** — coral banner (`#E8614D`) counting active driving pressure or plateau alarms
- **Fluid Balance Sparkline** — 7-day net balance trend per patient

Color mapping for SOFA:
```tsx
const SOFA_COLOR = (score: number) =>
  score <= 4 ? '#1B6B3A' : score <= 8 ? '#F0954A' : score <= 11 ? '#E8614D' : '#C62828';
```

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/IcuBedScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { AlertTriangle, Wind } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const sofaColor = (s: number) =>
  s <= 4 ? C.green : s <= 8 ? C.amber : s <= 11 ? C.coral : C.red;

export default function IcuBedScreen() {
  const [census, setCensus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/icu/census')
      .then((r: any) => setCensus(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>ICU Census</Text>
      <FlatList
        data={census}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card}>
            <View style={s.row}>
              <View style={[s.bedBadge, { backgroundColor: `${sofaColor(item.latest_sofa)}22` }]}>
                <Text style={[s.bedText, { color: sofaColor(item.latest_sofa) }]}>{item.bed_code}</Text>
              </View>
              <Text style={s.icuType}>{(item.icu_type ?? '').toUpperCase()}</Text>
              {(item.is_alarm_driving_pressure || item.is_alarm_plateau) && (
                <Wind size={14} color={C.coral} />
              )}
            </View>
            <Text style={s.name}>{item.first_name} {item.last_name}</Text>
            <View style={s.row}>
              <Text style={s.sub}>SOFA: <Text style={{ color: sofaColor(item.latest_sofa) }}>{item.latest_sofa}</Text></Text>
              <Text style={s.sub}>Day {Math.floor(item.los_days ?? 0)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No active ICU admissions.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 16 },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bedBadge:  { borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  bedText:   { fontFamily: FONT.mono, fontSize: 12, fontWeight: '700' },
  icuType:   { fontFamily: FONT.uiMd, fontSize: 10, color: C.textMuted, letterSpacing: 0.5 },
  name:      { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, marginBottom: 4 },
  sub:       { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
```

---

## CDSS Safety Governor Extension (S235 preview)

In S235, add to `services/cdss-service/clinical_safety.py`:

```python
def check_ventilator_safety(settings: dict) -> list[dict]:
    """
    Called on every ventilator settings POST.
    Returns list of safety alerts if lung-protective thresholds are breached.
    """
    alerts = []
    plateau = settings.get("plateau_pressure", 0) or 0
    peep    = settings.get("peep", 0) or 0
    driving = plateau - peep

    if driving > 15:
        alerts.append({
            "severity": "critical",
            "rule": "driving_pressure",
            "message": f"Driving pressure {driving} cmH₂O exceeds 15. Reduce tidal volume or increase PEEP to protect lungs.",
        })
    if plateau > 30:
        alerts.append({
            "severity": "critical",
            "rule": "plateau_pressure",
            "message": f"Plateau pressure {plateau} cmH₂O exceeds 30. Risk of ventilator-induced lung injury (VILI). Reduce tidal volume.",
        })
    return alerts
```

---

## Acceptance Criteria

- [ ] `icu_admissions`, `icu_vitals`, `icu_ventilator_settings`, `icu_fluid_balance`, `icu_infusions`, `icu_daily_goals`, `icu_scores` tables created on new tenant
- [ ] `driving_pressure` and `is_alarm_driving_pressure` computed columns auto-populate
- [ ] `net_balance_ml` computed column auto-populates on fluid balance upsert
- [ ] `sofa_total` computed column auto-sums on score insert
- [ ] `los_days` computed column auto-calculates from `admission_at`
- [ ] `GET /icu/census` returns patients with latest SOFA score and ventilator alarm flags
- [ ] `POST /icu/admissions/:id/fluid-balance` upserts by `(admission_id, balance_date)` — no duplicates
- [ ] `POST /icu/admissions/:id/ventilator` returns `is_alarm_driving_pressure` and `is_alarm_plateau`
- [ ] `IcuBedScreen.tsx` colors SOFA score using `sofaColor()` function, shows wind icon for vent alarms
- [ ] `'intensive_care'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
