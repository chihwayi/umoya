# Sprint 236 — NICU Core (Neonatal Intensive Care Unit)

**Module key:** `nicu`  
**Bundle ID:** `sprint236_nicu_core`  
**Version:** `2026.06.23.0`  
**Depends on:** `intensive_care` (S234 — shares ICU infrastructure), `maternity` module (deliveries table for birth linkage)  
**Followed by:** S237 (NICU Feeds, Drug Orders & Neonatal Screening)

---

## Sprint Goal

Build the NICU module: newborn admission register, incubator/radiant warmer management, phototherapy (jaundice) tracking on the Bhutani nomogram, Kangaroo Mother Care (KMC) sessions, and neonatal vitals charting. KMC is a first-class feature — it is the WHO-standard low-resource intervention and is central to Zimbabwe's MNCH programme.

---

## Scope

**IN:**
- `nicu_admissions`, `nicu_incubator_settings`, `nicu_vitals`, `nicu_phototherapy_sessions`, `nicu_kmc_sessions` tables
- `NicuController` + `NicuService`
- `NicuDashboard.tsx` (web)
- `NicuAdmissionScreen.tsx` (mobile)
- `NicuKmcScreen.tsx` (mobile) — nurses log KMC hours on the ward
- `nicu` in `ALL_MODULE_KEYS`

**OUT:** Neonatal drug orders, weight-based dosing, NBS screening, feeding/PN programme (→ S237)

---

## Cornerstone 1: Database Provisioning

### Step 1 — Add `nicu` to `ALL_MODULE_KEYS`

```typescript
// services/tenant-service/src/services/tenant.service.ts
const ALL_MODULE_KEYS = [
  // ... existing ...
  'intensive_care',
  'nicu',  // ← ADD
] as const;
```

### Step 2 — Provisioning bundle

```typescript
{
  id: 'sprint236_nicu_core',
  label: 'Sprint 236 — NICU Core: admissions, incubator, phototherapy, KMC, neonatal vitals',
  version: '2026.06.23.0',
  description: 'Neonatal ICU tables: nicu_admissions (birth/GA data), nicu_incubator_settings, nicu_vitals, nicu_phototherapy_sessions (Bhutani), nicu_kmc_sessions',
  statements: () => [
    // ── NICU Admissions ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_admissions (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      delivery_id         UUID,
      mother_patient_id   UUID REFERENCES patients(id),
      admission_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      discharge_at        TIMESTAMPTZ,
      gestational_age_weeks NUMERIC(4,1) NOT NULL,
      birth_weight_grams  SMALLINT NOT NULL,
      birth_length_cm     NUMERIC(4,1),
      head_circumference_cm NUMERIC(4,1),
      apgar_1min          SMALLINT CHECK (apgar_1min BETWEEN 0 AND 10),
      apgar_5min          SMALLINT CHECK (apgar_5min BETWEEN 0 AND 10),
      apgar_10min         SMALLINT CHECK (apgar_10min BETWEEN 0 AND 10),
      delivery_type       TEXT CHECK (delivery_type IN ('svd','lscs','instrumental','breech')),
      admission_reason    TEXT NOT NULL,
      primary_diagnosis   TEXT,
      incubator_code      TEXT,
      is_premature        BOOLEAN GENERATED ALWAYS AS (gestational_age_weeks < 37) STORED,
      is_vlbw             BOOLEAN GENERATED ALWAYS AS (birth_weight_grams < 1500) STORED,
      is_elbw             BOOLEAN GENERATED ALWAYS AS (birth_weight_grams < 1000) STORED,
      hiv_exposed         BOOLEAN NOT NULL DEFAULT FALSE,
      resuscitation_required BOOLEAN NOT NULL DEFAULT FALSE,
      status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharged','transferred','deceased')),
      discharge_weight_grams SMALLINT,
      los_days            NUMERIC(6,1) GENERATED ALWAYS AS (
                            EXTRACT(EPOCH FROM (COALESCE(discharge_at, NOW()) - admission_at)) / 86400
                          ) STORED,
      admitted_by         UUID REFERENCES users(id),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_adm_patient ON nicu_admissions(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_adm_status ON nicu_admissions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_adm_mother ON nicu_admissions(mother_patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_adm_premature ON nicu_admissions(is_premature) WHERE is_premature = TRUE`,

    // ── Incubator / Radiant Warmer Settings ───────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_incubator_settings (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      device_type      TEXT NOT NULL DEFAULT 'incubator' CHECK (device_type IN ('incubator','radiant_warmer','open_cot')),
      set_temp_celsius NUMERIC(4,1),
      humidity_pct     SMALLINT,
      skin_temp_celsius NUMERIC(4,1),
      axillary_temp_celsius NUMERIC(4,1),
      notes            TEXT,
      recorded_by      UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_incubator_adm ON nicu_incubator_settings(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_incubator_time ON nicu_incubator_settings(recorded_at DESC)`,

    // ── Neonatal Vitals (lighter than ICU — per 2–4 hours) ────────────────
    `CREATE TABLE IF NOT EXISTS nicu_vitals (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      charted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      hr               SMALLINT,
      rr               SMALLINT,
      spo2             SMALLINT,
      temperature      NUMERIC(4,1),
      bp_systolic      SMALLINT,
      weight_grams     SMALLINT,
      blood_glucose    NUMERIC(5,2),
      crt_seconds      NUMERIC(3,1),
      color            TEXT CHECK (color IN ('pink','pale','cyanotic','mottled','jaundiced')),
      tone             TEXT CHECK (tone IN ('normal','hypotonic','hypertonic')),
      activity         TEXT CHECK (activity IN ('active','quiet','lethargic','unresponsive')),
      apnoea_episodes  SMALLINT,
      charted_by       UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_vitals_adm ON nicu_vitals(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_vitals_time ON nicu_vitals(charted_at DESC)`,

    // ── Phototherapy / Jaundice Management ───────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_phototherapy_sessions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at         TIMESTAMPTZ,
      total_bilirubin  NUMERIC(6,2) NOT NULL,
      direct_bilirubin NUMERIC(6,2),
      hours_of_life    NUMERIC(6,1) NOT NULL,
      phototherapy_type TEXT NOT NULL DEFAULT 'conventional' CHECK (phototherapy_type IN ('conventional','intensive_double','fibre_optic','led')),
      eye_shields_applied BOOLEAN NOT NULL DEFAULT TRUE,
      bilirubin_trend  TEXT CHECK (bilirubin_trend IN ('rising','stable','falling')),
      exchange_transfusion_threshold_reached BOOLEAN NOT NULL DEFAULT FALSE,
      stopped_reason   TEXT CHECK (stopped_reason IN ('target_met','exchange_required','clinician_decision','patient_transfer')),
      notes            TEXT,
      ordered_by       UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_photo_adm ON nicu_phototherapy_sessions(admission_id)`,

    // ── Bilirubin / TSB readings (linked to a phototherapy session) ────────
    `CREATE TABLE IF NOT EXISTS nicu_bilirubin_readings (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      session_id       UUID REFERENCES nicu_phototherapy_sessions(id),
      measured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      hours_of_life    NUMERIC(6,1) NOT NULL,
      total_bilirubin  NUMERIC(6,2) NOT NULL,
      method           TEXT CHECK (method IN ('transcutaneous','serum_tsb')),
      above_phototherapy_threshold BOOLEAN,
      above_exchange_threshold     BOOLEAN,
      recorded_by      UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_bili_adm ON nicu_bilirubin_readings(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_bili_time ON nicu_bilirubin_readings(measured_at DESC)`,

    // ── Kangaroo Mother Care (KMC) Sessions ──────────────────────────────
    `CREATE TABLE IF NOT EXISTS nicu_kmc_sessions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id     UUID NOT NULL REFERENCES nicu_admissions(id) ON DELETE CASCADE,
      mother_patient_id UUID REFERENCES patients(id),
      caregiver_name   TEXT,
      started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at         TIMESTAMPTZ,
      duration_mins    INTEGER GENERATED ALWAYS AS (
                         EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 60
                       ) STORED,
      temp_during_kmc  NUMERIC(4,1),
      fed_during_kmc   BOOLEAN DEFAULT FALSE,
      notes            TEXT,
      recorded_by      UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_kmc_adm ON nicu_kmc_sessions(admission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nicu_kmc_mother ON nicu_kmc_sessions(mother_patient_id)`,

    // ── KMC cumulative hours view ──────────────────────────────────────────
    `CREATE OR REPLACE VIEW nicu_kmc_daily_summary AS
      SELECT
        admission_id,
        DATE(started_at) AS kmc_date,
        COUNT(*) AS sessions,
        ROUND(SUM(duration_mins)::numeric / 60, 1) AS total_hours
      FROM nicu_kmc_sessions
      WHERE ended_at IS NOT NULL
      GROUP BY admission_id, DATE(started_at)`,

    `CREATE OR REPLACE TRIGGER trg_nicu_admissions_updated_at
      BEFORE UPDATE ON nicu_admissions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  ],
},
```

---

## Cornerstone 2: Backend — NestJS EHR Service

### Controller

**Create file:** `services/ehr-service/src/controllers/nicu.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NicuService } from '../services/nicu.service';

@UseGuards(JwtAuthGuard)
@Controller('nicu')
export class NicuController {
  constructor(private readonly nicu: NicuService) {}

  // ── Admissions ────────────────────────────────────────────────────────

  @Post('admissions')
  admit(@Req() req: any, @Body() body: {
    patientId: string; deliveryId?: string; motherPatientId?: string;
    gestationalAgeWeeks: number; birthWeightGrams: number; birthLengthCm?: number;
    headCircumferenceCm?: number; apgar1min?: number; apgar5min?: number;
    deliveryType?: string; admissionReason: string; incubatorCode?: string;
    hivExposed?: boolean; resuscitationRequired?: boolean;
  }) {
    return this.nicu.admitNewborn(req.tenantDb, req.user.id, body);
  }

  @Get('census')
  getCensus(@Req() req: any) {
    return this.nicu.getCensus(req.tenantDb);
  }

  @Get('admissions/:id')
  getAdmission(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getAdmission(req.tenantDb, id);
  }

  @Patch('admissions/:id/discharge')
  discharge(@Req() req: any, @Param('id') id: string, @Body() body: { dischargeWeightGrams?: number; status?: string }) {
    return this.nicu.discharge(req.tenantDb, id, body);
  }

  // ── Incubator settings ────────────────────────────────────────────────

  @Post('admissions/:id/incubator')
  setIncubator(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.nicu.recordIncubatorSettings(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/incubator')
  getIncubator(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getLatestIncubatorSettings(req.tenantDb, id);
  }

  // ── Vitals ────────────────────────────────────────────────────────────

  @Post('admissions/:id/vitals')
  chartVitals(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.nicu.chartVitals(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/vitals')
  getVitals(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getVitals(req.tenantDb, id);
  }

  // ── Bilirubin / Phototherapy ──────────────────────────────────────────

  @Post('admissions/:id/bilirubin')
  recordBilirubin(@Req() req: any, @Param('id') id: string, @Body() body: {
    totalBilirubin: number; hoursOfLife: number; method?: string; sessionId?: string;
  }) {
    return this.nicu.recordBilirubin(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/bilirubin')
  getBilirubinHistory(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getBilirubinHistory(req.tenantDb, id);
  }

  @Post('admissions/:id/phototherapy/start')
  startPhototherapy(@Req() req: any, @Param('id') id: string, @Body() body: {
    totalBilirubin: number; hoursOfLife: number; phototherapyType?: string;
  }) {
    return this.nicu.startPhototherapy(req.tenantDb, req.user.id, id, body);
  }

  @Patch('phototherapy/:sessionId/stop')
  stopPhototherapy(@Req() req: any, @Param('sessionId') sessionId: string, @Body() body: { stoppedReason: string }) {
    return this.nicu.stopPhototherapy(req.tenantDb, sessionId, body.stoppedReason);
  }

  // ── KMC ──────────────────────────────────────────────────────────────

  @Post('admissions/:id/kmc/start')
  startKmc(@Req() req: any, @Param('id') id: string, @Body() body: { motherPatientId?: string; caregiverName?: string }) {
    return this.nicu.startKmc(req.tenantDb, req.user.id, id, body);
  }

  @Patch('kmc/:sessionId/stop')
  stopKmc(@Req() req: any, @Param('sessionId') sessionId: string, @Body() body: { tempDuringKmc?: number; fedDuringKmc?: boolean; notes?: string }) {
    return this.nicu.stopKmc(req.tenantDb, sessionId, body);
  }

  @Get('admissions/:id/kmc')
  getKmcSummary(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getKmcSummary(req.tenantDb, id);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.nicu.getDashboard(req.tenantDb);
  }
}
```

### Service (key methods)

**Create file:** `services/ehr-service/src/services/nicu.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// Bhutani nomogram thresholds (total bilirubin in μmol/L by hours of life, term infants ≥38 weeks)
// Source: Bhutani VK, Johnson L, Sivieri EM. Pediatrics 1999
const PHOTOTHERAPY_THRESHOLDS_UMOL_L: Array<{ hourMin: number; hourMax: number; photoThreshold: number; exchangeThreshold: number }> = [
  { hourMin: 0,  hourMax: 24,  photoThreshold: 102, exchangeThreshold: 257 },
  { hourMin: 24, hourMax: 48,  photoThreshold: 154, exchangeThreshold: 308 },
  { hourMin: 48, hourMax: 72,  photoThreshold: 188, exchangeThreshold: 342 },
  { hourMin: 72, hourMax: 999, photoThreshold: 205, exchangeThreshold: 359 },
];

function getBilirubinThresholds(hoursOfLife: number): { photoThreshold: number; exchangeThreshold: number } {
  const row = PHOTOTHERAPY_THRESHOLDS_UMOL_L.find(
    r => hoursOfLife >= r.hourMin && hoursOfLife < r.hourMax,
  );
  return row ?? { photoThreshold: 205, exchangeThreshold: 359 };
}

@Injectable()
export class NicuService {

  async admitNewborn(db: any, admittedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_admissions (patient_id, delivery_id, mother_patient_id, gestational_age_weeks, birth_weight_grams,
         birth_length_cm, head_circumference_cm, apgar_1min, apgar_5min, delivery_type, admission_reason,
         incubator_code, hiv_exposed, resuscitation_required, admitted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *, is_premature, is_vlbw, is_elbw`,
      [body.patientId, body.deliveryId ?? null, body.motherPatientId ?? null, body.gestationalAgeWeeks,
       body.birthWeightGrams, body.birthLengthCm, body.headCircumferenceCm, body.apgar1min, body.apgar5min,
       body.deliveryType, body.admissionReason, body.incubatorCode, body.hivExposed ?? false,
       body.resuscitationRequired ?? false, admittedBy],
    );
    return rows[0] ?? null;
  }

  async getCensus(db: any): Promise<any[]> {
    return db.query(
      `SELECT na.id, na.gestational_age_weeks, na.birth_weight_grams, na.is_premature, na.is_vlbw,
              na.incubator_code, na.los_days, na.hiv_exposed, na.status,
              p.first_name, p.last_name,
              latest_bili.total_bilirubin, latest_bili.hours_of_life,
              latest_bili.above_phototherapy_threshold,
              kmc_today.total_hours AS kmc_hours_today,
              latest_weight.weight_grams AS current_weight
       FROM nicu_admissions na
       JOIN patients p ON p.id = na.patient_id
       LEFT JOIN LATERAL (
         SELECT total_bilirubin, hours_of_life, above_phototherapy_threshold
         FROM nicu_bilirubin_readings WHERE admission_id = na.id ORDER BY measured_at DESC LIMIT 1
       ) latest_bili ON TRUE
       LEFT JOIN nicu_kmc_daily_summary kmc_today
         ON kmc_today.admission_id = na.id AND kmc_today.kmc_date = CURRENT_DATE
       LEFT JOIN LATERAL (
         SELECT weight_grams FROM nicu_vitals WHERE admission_id = na.id AND weight_grams IS NOT NULL ORDER BY charted_at DESC LIMIT 1
       ) latest_weight ON TRUE
       WHERE na.status = 'active'
       ORDER BY na.is_vlbw DESC, na.gestational_age_weeks ASC`,
    );
  }

  async getAdmission(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `SELECT na.*, p.first_name, p.last_name, p.date_of_birth,
              m.first_name AS mother_first, m.last_name AS mother_last
       FROM nicu_admissions na
       JOIN patients p ON p.id = na.patient_id
       LEFT JOIN patients m ON m.id = na.mother_patient_id
       WHERE na.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async discharge(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE nicu_admissions SET
         status=COALESCE($1,'discharged'), discharge_at=NOW(),
         discharge_weight_grams=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *, los_days`,
      [body.status, body.dischargeWeightGrams, id],
    );
    return rows[0] ?? null;
  }

  async recordIncubatorSettings(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_incubator_settings (admission_id, device_type, set_temp_celsius, humidity_pct, skin_temp_celsius, axillary_temp_celsius, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [admissionId, body.deviceType ?? 'incubator', body.setTempCelsius, body.humidityPct, body.skinTempCelsius, body.axillaryTempCelsius, body.notes, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getLatestIncubatorSettings(db: any, admissionId: string): Promise<any> {
    const rows = await db.query(
      `SELECT * FROM nicu_incubator_settings WHERE admission_id=$1 ORDER BY recorded_at DESC LIMIT 1`,
      [admissionId],
    );
    return rows[0] ?? null;
  }

  async chartVitals(db: any, chartedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_vitals (admission_id, hr, rr, spo2, temperature, bp_systolic, weight_grams,
         blood_glucose, crt_seconds, color, tone, activity, apnoea_episodes, charted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [admissionId, body.hr, body.rr, body.spo2, body.temperature, body.bpSystolic, body.weightGrams,
       body.bloodGlucose, body.crtSeconds, body.color, body.tone, body.activity, body.apnoeaEpisodes, chartedBy],
    );
    return rows[0] ?? null;
  }

  async getVitals(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM nicu_vitals WHERE admission_id=$1 ORDER BY charted_at DESC LIMIT 24`,
      [admissionId],
    );
  }

  async recordBilirubin(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const thresholds = getBilirubinThresholds(body.hoursOfLife);
    const abovePhoto = body.totalBilirubin >= thresholds.photoThreshold;
    const aboveExchange = body.totalBilirubin >= thresholds.exchangeThreshold;

    const rows = await db.query(
      `INSERT INTO nicu_bilirubin_readings (admission_id, session_id, hours_of_life, total_bilirubin, method,
         above_phototherapy_threshold, above_exchange_threshold, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [admissionId, body.sessionId ?? null, body.hoursOfLife, body.totalBilirubin, body.method ?? 'serum_tsb',
       abovePhoto, aboveExchange, recordedBy],
    );
    return {
      ...(rows[0] ?? {}),
      thresholds,
      cdss_alert: aboveExchange
        ? '⚠ EXCHANGE TRANSFUSION THRESHOLD MET. Urgent senior review required.'
        : abovePhoto
          ? 'Phototherapy indicated based on Bhutani nomogram.'
          : null,
    };
  }

  async getBilirubinHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM nicu_bilirubin_readings WHERE admission_id=$1 ORDER BY measured_at ASC`,
      [admissionId],
    );
  }

  async startPhototherapy(db: any, orderedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_phototherapy_sessions (admission_id, total_bilirubin, hours_of_life, phototherapy_type, ordered_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [admissionId, body.totalBilirubin, body.hoursOfLife, body.phototherapyType ?? 'conventional', orderedBy],
    );
    return rows[0] ?? null;
  }

  async stopPhototherapy(db: any, sessionId: string, stoppedReason: string): Promise<any> {
    const rows = await db.query(
      `UPDATE nicu_phototherapy_sessions SET ended_at=NOW(), stopped_reason=$1 WHERE id=$2 RETURNING *`,
      [stoppedReason, sessionId],
    );
    return rows[0] ?? null;
  }

  async startKmc(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_kmc_sessions (admission_id, mother_patient_id, caregiver_name, recorded_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [admissionId, body.motherPatientId ?? null, body.caregiverName ?? null, recordedBy],
    );
    return rows[0] ?? null;
  }

  async stopKmc(db: any, sessionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE nicu_kmc_sessions SET ended_at=NOW(), temp_during_kmc=$1, fed_during_kmc=$2, notes=$3
       WHERE id=$4 RETURNING *, duration_mins`,
      [body.tempDuringKmc, body.fedDuringKmc ?? false, body.notes, sessionId],
    );
    return rows[0] ?? null;
  }

  async getKmcSummary(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM nicu_kmc_daily_summary WHERE admission_id=$1 ORDER BY kmc_date DESC LIMIT 7`,
      [admissionId],
    );
  }

  async getDashboard(db: any): Promise<any> {
    const [census, jaundice, kmc] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_premature) AS premature, COUNT(*) FILTER (WHERE is_vlbw) AS vlbw FROM nicu_admissions WHERE status='active'`),
      db.query(`SELECT COUNT(*) AS needs_photo FROM nicu_bilirubin_readings WHERE above_phototherapy_threshold AND measured_at >= NOW() - INTERVAL '24 hours'`),
      db.query(`SELECT ROUND(AVG(total_hours),1) AS avg_kmc_hrs FROM nicu_kmc_daily_summary WHERE kmc_date = CURRENT_DATE`),
    ]);
    return { census: census[0], jaundice: jaundice[0], kmcToday: kmc[0] };
  }
}
```

### Module registration

```typescript
// services/ehr-service/src/ehr.module.ts
import { NicuController } from './controllers/nicu.controller';
import { NicuService } from './services/nicu.service';
// Add to controllers: [] and providers: []
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/NicuDashboard.tsx`

Key UI elements:
- **NICU Census Cards** — one card per admission. Badge color: green (term, normal weight), amber (premature), coral (VLBW), red (ELBW). Show current weight trend (↑/↓/→).
- **Jaundice Nomogram Banner** — amber banner showing count of babies currently above phototherapy threshold.
- **KMC Progress Bar** — per-baby daily KMC hours vs 8-hour WHO target (progress bar `#0AA98A`).

```tsx
// Color utility
const nicuBadgeColor = (adm: any) =>
  adm.is_elbw ? '#C62828' : adm.is_vlbw ? '#E8614D' : adm.is_premature ? '#F0954A' : '#1B6B3A';
```

---

## Cornerstone 4: Mobile Screens

### NicuAdmissionScreen.tsx

**Create file:** `mobile/src/screens/NicuAdmissionScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Baby, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const weightColor = (adm: any) =>
  adm.is_elbw ? C.red : adm.is_vlbw ? C.coral : adm.is_premature ? C.amber : C.green;

export default function NicuAdmissionScreen() {
  const [census, setCensus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/nicu/census').then((r: any) => setCensus(r.data ?? r)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Baby size={22} color={C.teal} />
        <Text style={s.heading}>NICU Census</Text>
      </View>

      <FlatList
        data={census}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card}>
            <View style={s.row}>
              <View style={[s.badge, { backgroundColor: `${weightColor(item)}22` }]}>
                <Text style={[s.badgeText, { color: weightColor(item) }]}>
                  {item.is_elbw ? 'ELBW' : item.is_vlbw ? 'VLBW' : item.is_premature ? 'Prem' : 'Term'}
                </Text>
              </View>
              <Text style={s.bed}>{item.incubator_code ?? 'Open Cot'}</Text>
              {item.above_phototherapy_threshold && <AlertTriangle size={14} color={C.amber} />}
            </View>

            <Text style={s.name}>{item.first_name} {item.last_name}</Text>

            <View style={s.row}>
              <Text style={s.sub}>GA: {item.gestational_age_weeks}w</Text>
              <Text style={s.sub}>BW: {item.birth_weight_grams}g</Text>
              {item.current_weight && <Text style={s.sub}>CW: {item.current_weight}g</Text>}
            </View>

            <View style={s.row}>
              <Text style={s.sub}>Day {Math.floor(item.los_days ?? 0)}</Text>
              {item.kmc_hours_today != null && (
                <Text style={[s.sub, { color: C.teal }]}>KMC: {item.kmc_hours_today}h today</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No active NICU admissions.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  heading:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge:     { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: FONT.uiSb, fontSize: 11, letterSpacing: 0.4 },
  bed:       { fontFamily: FONT.mono, fontSize: 12, color: C.textSecondary },
  name:      { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, marginBottom: 4 },
  sub:       { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
```

### NicuKmcScreen.tsx

**Create file:** `mobile/src/screens/NicuKmcScreen.tsx`

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Heart } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function NicuKmcScreen({ route }: { route: any }) {
  const { admissionId, patientName } = route.params;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    setSaving(true);
    try {
      const r: any = await api.post(`/nicu/admissions/${admissionId}/kmc/start`, {});
      setSessionId(r.data?.id ?? r.id);
      setStartedAt(new Date());
      Alert.alert('KMC Started', 'Session timer started. Tap "End KMC" when done.');
    } catch {
      Alert.alert('Error', 'Could not start KMC session.');
    } finally { setSaving(false); }
  }

  async function handleStop() {
    if (!sessionId) return;
    setSaving(true);
    try {
      await api.patch(`/nicu/kmc/${sessionId}/stop`, { fedDuringKmc: false });
      const mins = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 60000) : 0;
      Alert.alert('KMC Ended', `Session recorded: ${mins} minutes.`);
      setSessionId(null);
      setStartedAt(null);
    } catch {
      Alert.alert('Error', 'Could not stop KMC session.');
    } finally { setSaving(false); }
  }

  return (
    <View style={s.container}>
      <Heart size={32} color={C.coral} style={{ marginBottom: 12 }} />
      <Text style={s.heading}>Kangaroo Mother Care</Text>
      <Text style={s.sub}>{patientName}</Text>

      {startedAt && (
        <View style={s.timerCard}>
          <Text style={s.timerLabel}>Session in progress</Text>
          <Text style={s.timerValue}>Started {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.btn, sessionId ? s.btnStop : s.btnStart, saving && { opacity: 0.5 }]}
        onPress={sessionId ? handleStop : handleStart}
        disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>{sessionId ? 'End KMC' : 'Start KMC'}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading:    { fontFamily: FONT.uiBd, fontSize: 24, color: C.text, marginBottom: 4 },
  sub:        { fontFamily: FONT.ui, fontSize: 14, color: C.textSecondary, marginBottom: 32 },
  timerCard:  { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 20, alignItems: 'center', marginBottom: 24, ...SHADOW.teal, width: '100%' },
  timerLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.teal, marginBottom: 4 },
  timerValue: { fontFamily: FONT.mono, fontSize: 18, color: C.text },
  btn:        { borderRadius: RADIUS.lg, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  btnStart:   { backgroundColor: C.teal },
  btnStop:    { backgroundColor: C.coral },
  btnText:    { fontFamily: FONT.uiBd, fontSize: 16, color: '#fff' },
});
```

**Register both screens in `mobile/src/navigation/RootNavigator.tsx`:**
```tsx
import NicuAdmissionScreen from '../screens/NicuAdmissionScreen';
import NicuKmcScreen from '../screens/NicuKmcScreen';

<Stack.Screen name="NicuCensus" component={NicuAdmissionScreen} options={{ title: 'NICU' }} />
<Stack.Screen name="NicuKmc" component={NicuKmcScreen} options={{ title: 'KMC Session' }} />
```

---

## CDSS Integration

In `services/cdss-service/nicu.py`:

```python
PHOTOTHERAPY_THRESHOLDS = [
    {"hour_min": 0,  "hour_max": 24,  "photo": 102, "exchange": 257},
    {"hour_min": 24, "hour_max": 48,  "photo": 154, "exchange": 308},
    {"hour_min": 48, "hour_max": 72,  "photo": 188, "exchange": 342},
    {"hour_min": 72, "hour_max": 9999,"photo": 205, "exchange": 359},
]

def evaluate_jaundice(total_bilirubin_umol_l: float, hours_of_life: float, gestation_weeks: float) -> dict:
    """
    Bhutani nomogram evaluation.
    Preterm adjustment: lower thresholds apply — deduct 34 μmol/L for GA < 35 weeks.
    """
    row = next((r for r in PHOTOTHERAPY_THRESHOLDS if r["hour_min"] <= hours_of_life < r["hour_max"]), PHOTOTHERAPY_THRESHOLDS[-1])
    preterm_offset = 34 if gestation_weeks < 35 else 0
    photo_threshold = row["photo"] - preterm_offset
    exchange_threshold = row["exchange"] - preterm_offset

    above_exchange = total_bilirubin_umol_l >= exchange_threshold
    above_photo    = total_bilirubin_umol_l >= photo_threshold

    return {
        "photo_threshold": photo_threshold,
        "exchange_threshold": exchange_threshold,
        "above_phototherapy_threshold": above_photo,
        "above_exchange_threshold": above_exchange,
        "recommendation": (
            "URGENT: Exchange transfusion threshold met. Escalate immediately."
            if above_exchange else
            "Start phototherapy — TSB above threshold for gestational age and hours of life."
            if above_photo else
            "Monitor. TSB below phototherapy threshold. Repeat TSB as clinically indicated."
        ),
        "urgency": "critical" if above_exchange else "high" if above_photo else "routine",
    }
```

Expose in `main.py`:
```python
from nicu import evaluate_jaundice

@app.post("/nicu/cdss/jaundice-eval")
async def nicu_jaundice_eval(body: dict):
    return evaluate_jaundice(
        total_bilirubin_umol_l=body["total_bilirubin"],
        hours_of_life=body["hours_of_life"],
        gestation_weeks=body.get("gestation_weeks", 38),
    )
```

---

## Acceptance Criteria

- [ ] `nicu_admissions` with computed columns `is_premature`, `is_vlbw`, `is_elbw`, `los_days` provision correctly
- [ ] `nicu_bilirubin_readings` records `above_phototherapy_threshold` and `above_exchange_threshold` at insert time using `getBilirubinThresholds()` in service
- [ ] `nicu_kmc_sessions` records `duration_mins` as generated column
- [ ] `nicu_kmc_daily_summary` view aggregates session hours per day
- [ ] `POST /nicu/admissions/:id/kmc/start` + `PATCH /nicu/kmc/:sessionId/stop` start/stop KMC sessions
- [ ] `GET /nicu/census` returns NICU census with KMC hours today and latest bilirubin
- [ ] `POST /nicu/cdss/jaundice-eval` returns Bhutani-based recommendation with preterm adjustment
- [ ] `NicuKmcScreen.tsx` shows session timer and start/stop button with coral (`C.coral`) stop button
- [ ] `NicuAdmissionScreen.tsx` shows amber alert icon when `above_phototherapy_threshold` is true
- [ ] `'nicu'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
