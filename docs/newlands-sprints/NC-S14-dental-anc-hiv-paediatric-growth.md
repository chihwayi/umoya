# NC-S14 — Dental Module + ANC HIV+ Pathway + Paediatric Growth WHO Charts

**Sprint ID:** NC-S14  
**Priority:** High  
**Effort:** 10 days  
**Dependencies:** NC-S01 (provisioning), NC-S03 (OI/geriatric), NC-S11 (localisation)  
**Gaps Covered:**
- Feature 10.1 — Dental clinical module (0% → 100%)
- Feature 10.2 — ANC HIV+ pathway: PMTCT, EID, infant follow-up (0% → 100%)
- Feature 10.3 — Paediatric growth charts with WHO 2006/2007 standards (0% → 100%)
- Feature 10.4 — Paediatric ART weight-band dosing table (0% → 100%)

---

## 1. Codebase Context

### Existing Clinical Infrastructure
- `services/ehr-service/src/services/hiv.service.ts` — HIV adult workflows; no paediatric or ANC specialisation
- `services/ehr-service/src/services/appointments.service.ts` — generic appointments
- `services/ehr-service/src/entities/patient.entity.ts` — has `dateOfBirth`, `sex`, `weight`, `height`; no dental, ANC, or growth-specific fields
- No dental tables, no ANC-specific tables, no growth chart tables exist anywhere
- `services/ehr-service/src/controllers/` — no dental or ANC controllers

### WHO Growth Chart Standards
- **WHO Child Growth Standards 2006** — 0–5 years: Weight-for-age, Length/Height-for-age, BMI-for-age, Weight-for-length
- **WHO Reference 2007** — 5–19 years: BMI-for-age, Height-for-age
- Z-score computation: `Z = (X^L - M^L) / (S * M^L)` where L, M, S are WHO table parameters per age-sex strata
- Severe undernutrition: WAZ < -3; Moderate: WAZ -3 to -2; Normal: WAZ > -2
- Stunting: HAZ < -2; Wasting: WHZ < -2

### Paediatric ART Weight-Band Dosing (Zimbabwe MOHCC 2023)
| Weight Band | ABC 3TC (FDC) | EFV | LPV/r (liquid) |
|-------------|---------------|-----|-----------------|
| 3–5.9 kg    | 30/15 mg BID  | —   | 16/4 mg/kg BID  |
| 6–9.9 kg    | 60/30 mg BID  | —   | 13/3.25 mg/kg   |
| 10–13.9 kg  | 1 tab OD      | 200 mg OD | 200/50 mg BID |
| 14–19.9 kg  | 1.5 tabs OD   | 200 mg OD | 200/50 mg BID |
| 20–24.9 kg  | 2 tabs OD     | 300 mg OD | 300/75 mg BID |
| ≥25 kg      | Adult dosing  | 600 mg OD | Adult dosing  |

### PMTCT Key Clinical Thresholds
- VL >1000 copies/mL at 36 weeks → enhanced adherence counselling + Maternal Transmission Risk Flag
- All HIV+ mothers: DTG-based ART throughout; NVP prophylaxis to baby for 6 weeks (or 12 weeks if high-risk)
- EID (Early Infant Diagnosis): DNA PCR at 6 weeks, 4 months, 12 months, 18 months
- EID positive result: immediate ART initiation for infant (LPV/r-based)

---

## 2. What This Sprint Builds

### Part A — Dental Module
Full dental clinical encounter module:
- Dental chart (32 tooth notation, FDI system)
- Per-tooth condition coding (caries, missing, filled, crown, RCT, extraction needed)
- Treatment plan: procedures with dates and costs
- X-ray notes and referral management
- Perio chart (6-point probing per tooth)

### Part B — ANC HIV+ Pathway (PMTCT)
- ANC registration linked to HIV enrollment
- PMTCT visit schedule generator
- VL monitoring at 36 weeks with MTR flag
- NVP prophylaxis tracking for infant
- EID schedule generator (6w, 4m, 12m, 18m) with result recording
- Maternal transmission outcome at 18 months

### Part C — WHO Paediatric Growth Charts
- Z-score computation for WAZ, HAZ, WHZ, BAZ
- Red/amber/green nutritional status from z-scores
- Growth chart visualisation (plotted as SVG in frontend)
- Nutrition referral trigger when WAZ < -2

### Part D — Paediatric ART Dosing Table
- Lookup service: given patient weight → return recommended doses per drug
- Auto-populate regimen recommendation on paediatric ART initiation form
- Weight-band change detection: alert when patient crosses to next weight band

---

## 3. Database Changes

### 3.1 Provisioning Bundle — add to `getProvisioningBundles()` in `ehr-service`

```typescript
{
  id: 'nc_dental_anc_paediatric',
  tables: [
    // ─── DENTAL ───
    `CREATE TABLE IF NOT EXISTS dental_charts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
      dentist_id UUID NOT NULL,
      chief_complaint TEXT,
      oral_hygiene_index VARCHAR(16),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dental_charts_patient ON dental_charts(patient_id)`,

    `CREATE TABLE IF NOT EXISTS dental_tooth_conditions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chart_id UUID NOT NULL REFERENCES dental_charts(id) ON DELETE CASCADE,
      tooth_number INTEGER NOT NULL CHECK (tooth_number BETWEEN 11 AND 48),
      surface VARCHAR(8),
      condition_code VARCHAR(16) NOT NULL,
      notes TEXT,
      UNIQUE(chart_id, tooth_number, surface)
    )`,
    -- condition_code values: 'healthy','caries','filled','missing','crown','rct','bridge','implant','extraction_needed','watch'

    `CREATE TABLE IF NOT EXISTS dental_treatment_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      chart_id UUID REFERENCES dental_charts(id),
      tooth_number INTEGER,
      procedure_code VARCHAR(32) NOT NULL,
      procedure_description VARCHAR(255) NOT NULL,
      planned_date DATE,
      completed_date DATE,
      cost_usd NUMERIC(8,2),
      status VARCHAR(32) NOT NULL DEFAULT 'planned',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dental_plans_patient ON dental_treatment_plans(patient_id)`,

    `CREATE TABLE IF NOT EXISTS dental_perio_charts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chart_id UUID NOT NULL REFERENCES dental_charts(id) ON DELETE CASCADE,
      tooth_number INTEGER NOT NULL,
      site VARCHAR(8) NOT NULL,
      probing_depth_mm INTEGER,
      bleeding_on_probing BOOLEAN DEFAULT false,
      recession_mm INTEGER DEFAULT 0,
      UNIQUE(chart_id, tooth_number, site)
    )`,

    // ─── ANC / PMTCT ───
    `CREATE TABLE IF NOT EXISTS anc_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL UNIQUE,
      lmp_date DATE,
      edd DATE,
      gravida INTEGER NOT NULL DEFAULT 1,
      para INTEGER NOT NULL DEFAULT 0,
      hiv_status VARCHAR(16) NOT NULL DEFAULT 'positive',
      art_start_date DATE,
      current_regimen VARCHAR(128),
      vl_at_36_weeks INTEGER,
      maternal_transmission_risk VARCHAR(16),
      delivery_date DATE,
      delivery_facility VARCHAR(255),
      mode_of_delivery VARCHAR(32),
      birth_outcome VARCHAR(32),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_anc_registrations_patient ON anc_registrations(patient_id)`,

    `CREATE TABLE IF NOT EXISTS pmtct_visits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      anc_registration_id UUID NOT NULL REFERENCES anc_registrations(id),
      visit_date DATE NOT NULL,
      gestational_age_weeks INTEGER,
      weight_kg NUMERIC(5,2),
      blood_pressure VARCHAR(16),
      cd4_count INTEGER,
      viral_load INTEGER,
      adherence_score INTEGER CHECK (adherence_score BETWEEN 0 AND 100),
      nvp_given_to_baby BOOLEAN DEFAULT false,
      notes TEXT,
      clinician_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pmtct_visits_anc ON pmtct_visits(anc_registration_id)`,

    `CREATE TABLE IF NOT EXISTS eid_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mother_patient_id UUID NOT NULL,
      infant_patient_id UUID,
      infant_name VARCHAR(255),
      birth_date DATE NOT NULL,
      nvp_start_date DATE NOT NULL,
      nvp_duration_weeks INTEGER NOT NULL DEFAULT 6,
      test_6w_due DATE,
      test_6w_result VARCHAR(16),
      test_6w_done_at DATE,
      test_4m_due DATE,
      test_4m_result VARCHAR(16),
      test_4m_done_at DATE,
      test_12m_due DATE,
      test_12m_result VARCHAR(16),
      test_12m_done_at DATE,
      test_18m_due DATE,
      test_18m_result VARCHAR(16),
      test_18m_done_at DATE,
      final_hiv_status VARCHAR(16),
      transmission_occurred BOOLEAN,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_eid_schedules_mother ON eid_schedules(mother_patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_eid_schedules_overdue ON eid_schedules(test_6w_due) WHERE test_6w_result IS NULL`,

    // ─── GROWTH CHARTS ───
    `CREATE TABLE IF NOT EXISTS growth_measurements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      measurement_date DATE NOT NULL,
      age_months NUMERIC(5,1),
      weight_kg NUMERIC(5,2),
      height_cm NUMERIC(5,1),
      head_circumference_cm NUMERIC(4,1),
      muac_cm NUMERIC(4,1),
      waz NUMERIC(5,2),
      haz NUMERIC(5,2),
      whz NUMERIC(5,2),
      baz NUMERIC(5,2),
      waz_category VARCHAR(32),
      haz_category VARCHAR(32),
      whz_category VARCHAR(32),
      nutrition_referral_needed BOOLEAN NOT NULL DEFAULT false,
      recorded_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_growth_patient ON growth_measurements(patient_id, measurement_date)`,
    `CREATE INDEX IF NOT EXISTS idx_growth_referral ON growth_measurements(nutrition_referral_needed) WHERE nutrition_referral_needed = true`,
  ],
}
```

### 3.2 After provisioning: `POST /api/admin/tenants/repair-all`

---

## 4. Backend Implementation

### 4.1 Growth Chart Service
**File:** `services/ehr-service/src/services/growth-chart.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

// WHO 2006 LMS parameters — abbreviated sample for WAZ female 0–24 months
// Full table must be loaded from WHO published LMS tables
// Structure: { sex: 'F'|'M', ageMonths: number, L: number, M: number, S: number }
// In production: load from a JSON file bundled with the service
const WHO_WAZ_TABLE: Array<{ sex: string; ageMonths: number; L: number; M: number; S: number }> = [
  // Female
  { sex: 'F', ageMonths: 0, L: 0.3809, M: 3.2322, S: 0.14171 },
  { sex: 'F', ageMonths: 1, L: 0.2361, M: 4.1873, S: 0.13724 },
  { sex: 'F', ageMonths: 3, L: 0.2986, M: 5.7769, S: 0.12520 },
  { sex: 'F', ageMonths: 6, L: 0.3520, M: 7.2986, S: 0.11737 },
  { sex: 'F', ageMonths: 12, L: 0.6972, M: 9.1649, S: 0.11659 },
  { sex: 'F', ageMonths: 24, L: 0.7915, M: 11.4797, S: 0.12026 },
  // Male
  { sex: 'M', ageMonths: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
  { sex: 'M', ageMonths: 1, L: 0.2297, M: 4.4709, S: 0.13395 },
  { sex: 'M', ageMonths: 3, L: 0.2986, M: 6.3762, S: 0.12580 },
  { sex: 'M', ageMonths: 6, L: 0.2134, M: 7.9340, S: 0.11657 },
  { sex: 'M', ageMonths: 12, L: 0.5563, M: 9.6479, S: 0.11316 },
  { sex: 'M', ageMonths: 24, L: 0.4349, M: 12.1884, S: 0.11257 },
];

export interface GrowthZScores {
  waz: number | null;
  haz: number | null;
  whz: number | null;
  baz: number | null;
  wazCategory: string;
  hazCategory: string;
  nutritionReferralNeeded: boolean;
}

@Injectable()
export class GrowthChartService {
  constructor(private readonly db: DatabaseService) {}

  computeZScore(measurement: number, L: number, M: number, S: number): number {
    // WHO LMS method: Z = (X^L - M^L) / (S * M^L)
    if (L === 0) {
      return Math.log(measurement / M) / S;
    }
    return (Math.pow(measurement / M, L) - 1) / (L * S);
  }

  private getLmsParams(
    table: typeof WHO_WAZ_TABLE,
    ageMonths: number,
    sex: 'M' | 'F',
  ): { L: number; M: number; S: number } | null {
    // Find closest age bracket
    const sexRows = table.filter((r) => r.sex === sex);
    const sorted = sexRows.sort((a, b) => Math.abs(a.ageMonths - ageMonths) - Math.abs(b.ageMonths - ageMonths));
    return sorted[0] ?? null;
  }

  computeAllZScores(
    weightKg: number | null,
    heightCm: number | null,
    ageMonths: number,
    sex: 'M' | 'F',
  ): GrowthZScores {
    let waz: number | null = null;
    let haz: number | null = null;
    let whz: number | null = null;
    let baz: number | null = null;

    if (weightKg !== null) {
      const params = this.getLmsParams(WHO_WAZ_TABLE, ageMonths, sex);
      if (params) {
        waz = Number(this.computeZScore(weightKg, params.L, params.M, params.S).toFixed(2));
      }
    }

    // HAZ, WHZ, BAZ — use same pattern with respective WHO tables
    // For production: load WHO_HAZ_TABLE, WHO_WHZ_TABLE, WHO_BAZ_TABLE from JSON files

    const wazCategory = this.categoriseWaz(waz);
    const hazCategory = this.categoriseHaz(haz);
    const nutritionReferralNeeded = (waz !== null && waz < -2) || (whz !== null && whz < -2);

    return { waz, haz, whz, baz, wazCategory, hazCategory, nutritionReferralNeeded };
  }

  private categoriseWaz(waz: number | null): string {
    if (waz === null) return 'unknown';
    if (waz < -3) return 'severe_underweight';
    if (waz < -2) return 'underweight';
    if (waz <= 2) return 'normal';
    return 'overweight';
  }

  private categoriseHaz(haz: number | null): string {
    if (haz === null) return 'unknown';
    if (haz < -3) return 'severely_stunted';
    if (haz < -2) return 'stunted';
    return 'normal';
  }

  async recordGrowthMeasurement(
    patientId: string,
    measurementDate: string,
    weightKg: number | null,
    heightCm: number | null,
    headCircumferenceCm: number | null,
    muacCm: number | null,
    sex: 'M' | 'F',
    dateOfBirth: string,
    recordedBy: string,
    tenantDb: string,
  ): Promise<GrowthZScores & { id: string }> {
    const dob = new Date(dateOfBirth);
    const measureDate = new Date(measurementDate);
    const ageMonths = Math.round(
      (measureDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.4375),
    );

    const zScores = this.computeAllZScores(weightKg, heightCm, ageMonths, sex);

    const [row] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO growth_measurements (
         patient_id, measurement_date, age_months, weight_kg, height_cm,
         head_circumference_cm, muac_cm, waz, haz, whz, baz,
         waz_category, haz_category, whz_category,
         nutrition_referral_needed, recorded_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        patientId, measurementDate, ageMonths, weightKg, heightCm,
        headCircumferenceCm, muacCm, zScores.waz, zScores.haz, zScores.whz, zScores.baz,
        zScores.wazCategory, zScores.hazCategory, null,
        zScores.nutritionReferralNeeded, recordedBy,
      ],
    );

    return { ...zScores, id: row.id };
  }

  async getGrowthHistory(patientId: string, tenantDb: string) {
    return this.db.query(
      tenantDb,
      `SELECT * FROM growth_measurements WHERE patient_id = $1 ORDER BY measurement_date ASC`,
      [patientId],
    );
  }
}
```

### 4.2 Paediatric Dosing Service
**File:** `services/ehr-service/src/services/paediatric-dosing.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface WeightBandDose {
  weightMin: number;
  weightMax: number;
  abcLtcFdc?: string;
  efv?: string;
  lpvR?: string;
  azt3tc?: string;
  nvp?: string;
  note?: string;
}

const WEIGHT_BAND_TABLE: WeightBandDose[] = [
  {
    weightMin: 3, weightMax: 5.9,
    abcLtcFdc: '30/15 mg BID',
    lpvR: '16/4 mg/kg BID (liquid)',
    nvp: '5 mg/kg OD for 2 weeks then 5 mg/kg BID',
    note: 'EFV not recommended <3 years',
  },
  {
    weightMin: 6, weightMax: 9.9,
    abcLtcFdc: '60/30 mg BID',
    lpvR: '13/3.25 mg/kg BID (liquid)',
    nvp: '5 mg/kg OD for 2 weeks then 5 mg/kg BID',
  },
  {
    weightMin: 10, weightMax: 13.9,
    abcLtcFdc: 'ABC/3TC 1 tab OD (adult FDC)',
    efv: '200 mg OD',
    lpvR: '200/50 mg BID (tablet)',
  },
  {
    weightMin: 14, weightMax: 19.9,
    abcLtcFdc: 'ABC/3TC 1.5 tabs OD',
    efv: '200 mg OD',
    lpvR: '200/50 mg BID',
  },
  {
    weightMin: 20, weightMax: 24.9,
    abcLtcFdc: 'ABC/3TC 2 tabs OD',
    efv: '300 mg OD',
    lpvR: '300/75 mg BID',
  },
  {
    weightMin: 25, weightMax: 999,
    abcLtcFdc: 'Adult dosing — TDF/3TC/DTG 1 tab OD',
    efv: 'Adult: EFV 600 mg OD',
    lpvR: 'Adult: LPV/r 400/100 mg BID',
    note: '≥25 kg — use adult formulations',
  },
];

@Injectable()
export class PaediatricDosingService {
  getDoseForWeight(weightKg: number): WeightBandDose | null {
    return WEIGHT_BAND_TABLE.find(
      (band) => weightKg >= band.weightMin && weightKg <= band.weightMax,
    ) ?? null;
  }

  detectWeightBandChange(previousWeight: number, currentWeight: number): {
    changed: boolean;
    previousBand: string;
    newBand: string;
  } {
    const prevBand = this.getDoseForWeight(previousWeight);
    const newBand = this.getDoseForWeight(currentWeight);

    const bandLabel = (b: WeightBandDose | null) =>
      b ? `${b.weightMin}–${b.weightMax} kg` : 'unknown';

    return {
      changed: prevBand?.weightMin !== newBand?.weightMin,
      previousBand: bandLabel(prevBand),
      newBand: bandLabel(newBand),
    };
  }

  getFullDoseTable(): WeightBandDose[] {
    return WEIGHT_BAND_TABLE;
  }
}
```

### 4.3 ANC / PMTCT Service
**File:** `services/ehr-service/src/services/pmtct.service.ts`

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class PmtctService {
  constructor(private readonly db: DatabaseService) {}

  async registerAnc(
    data: {
      patientId: string;
      lmpDate: string;
      gravida: number;
      para: number;
      artStartDate?: string;
      currentRegimen?: string;
    },
    tenantDb: string,
  ): Promise<{ id: string; edd: string }> {
    const lmp = new Date(data.lmpDate);
    const edd = new Date(lmp);
    edd.setDate(edd.getDate() + 280); // Naegele's rule

    const [row] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO anc_registrations (patient_id, lmp_date, edd, gravida, para, hiv_status, art_start_date, current_regimen)
       VALUES ($1, $2, $3, $4, $5, 'positive', $6, $7)
       ON CONFLICT (patient_id) DO UPDATE SET
         lmp_date = EXCLUDED.lmp_date, edd = EXCLUDED.edd,
         gravida = EXCLUDED.gravida, para = EXCLUDED.para,
         updated_at = NOW()
       RETURNING id`,
      [data.patientId, data.lmpDate, edd.toISOString().split('T')[0], data.gravida, data.para, data.artStartDate ?? null, data.currentRegimen ?? null],
    );

    return { id: row.id, edd: edd.toISOString().split('T')[0] };
  }

  async recordPmtctVisit(
    data: {
      ancRegistrationId: string;
      visitDate: string;
      gestationalAgeWeeks: number;
      weightKg?: number;
      bloodPressure?: string;
      cd4Count?: number;
      viralLoad?: number;
      adherenceScore?: number;
    },
    clinicianId: string,
    tenantDb: string,
  ): Promise<{ id: string; maternalTransmissionRisk?: string }> {
    let mtr: string | undefined;

    // PMTCT protocol: VL >1000 at ≥36 weeks = high MTR
    if (data.gestationalAgeWeeks >= 36 && data.viralLoad !== undefined && data.viralLoad > 1000) {
      mtr = 'high';
      await this.db.query(
        tenantDb,
        `UPDATE anc_registrations SET vl_at_36_weeks = $2, maternal_transmission_risk = 'high', updated_at = NOW()
         WHERE id = $1`,
        [data.ancRegistrationId, data.viralLoad],
      );
    }

    const [row] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO pmtct_visits (anc_registration_id, visit_date, gestational_age_weeks, weight_kg, blood_pressure, cd4_count, viral_load, adherence_score, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        data.ancRegistrationId, data.visitDate, data.gestationalAgeWeeks,
        data.weightKg ?? null, data.bloodPressure ?? null,
        data.cd4Count ?? null, data.viralLoad ?? null,
        data.adherenceScore ?? null, clinicianId,
      ],
    );

    return { id: row.id, maternalTransmissionRisk: mtr };
  }

  async createEidSchedule(
    data: {
      motherPatientId: string;
      infantName: string;
      birthDate: string;
      isHighRisk: boolean;
    },
    tenantDb: string,
  ): Promise<{ id: string }> {
    const birth = new Date(data.birthDate);
    const addWeeks = (d: Date, w: number) => new Date(d.getTime() + w * 7 * 86400000);
    const addMonths = (d: Date, m: number) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const nvpDuration = data.isHighRisk ? 12 : 6;

    const [row] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO eid_schedules (
         mother_patient_id, infant_name, birth_date, nvp_start_date, nvp_duration_weeks,
         test_6w_due, test_4m_due, test_12m_due, test_18m_due
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        data.motherPatientId, data.infantName, data.birthDate,
        fmt(birth), nvpDuration,
        fmt(addWeeks(birth, 6)),
        fmt(addMonths(birth, 4)),
        fmt(addMonths(birth, 12)),
        fmt(addMonths(birth, 18)),
      ],
    );

    return row;
  }

  async recordEidResult(
    eidId: string,
    timepoint: '6w' | '4m' | '12m' | '18m',
    result: 'positive' | 'negative' | 'indeterminate',
    doneDate: string,
    tenantDb: string,
  ): Promise<{ requiresImmediateArt: boolean }> {
    const col = `test_${timepoint}`;
    await this.db.query(
      tenantDb,
      `UPDATE eid_schedules SET ${col}_result = $2, ${col}_done_at = $3, updated_at = NOW() WHERE id = $1`,
      [eidId, result, doneDate],
    );

    if (result === 'positive') {
      await this.db.query(
        tenantDb,
        `UPDATE eid_schedules SET final_hiv_status = 'positive', transmission_occurred = true WHERE id = $1`,
        [eidId],
      );
      return { requiresImmediateArt: true };
    }

    if (timepoint === '18m' && result === 'negative') {
      await this.db.query(
        tenantDb,
        `UPDATE eid_schedules SET final_hiv_status = 'negative', transmission_occurred = false WHERE id = $1`,
        [eidId],
      );
    }

    return { requiresImmediateArt: false };
  }

  async getOverdueEid(tenantDb: string) {
    return this.db.query(
      tenantDb,
      `SELECT e.*, p.first_name || ' ' || p.last_name as mother_name
       FROM eid_schedules e
       JOIN patients p ON p.id = e.mother_patient_id
       WHERE (e.test_6w_result IS NULL AND e.test_6w_due < CURRENT_DATE)
          OR (e.test_4m_result IS NULL AND e.test_4m_due < CURRENT_DATE)
          OR (e.test_12m_result IS NULL AND e.test_12m_due < CURRENT_DATE)
          OR (e.test_18m_result IS NULL AND e.test_18m_due < CURRENT_DATE)
       ORDER BY LEAST(
         CASE WHEN e.test_6w_result IS NULL THEN e.test_6w_due END,
         CASE WHEN e.test_4m_result IS NULL THEN e.test_4m_due END
       ) ASC`,
      [],
    );
  }
}
```

### 4.4 Dental Service
**File:** `services/ehr-service/src/services/dental.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

type ToothCondition = 'healthy' | 'caries' | 'filled' | 'missing' | 'crown' | 'rct' | 'bridge' | 'implant' | 'extraction_needed' | 'watch';
type PerioSite = 'MB' | 'B' | 'DB' | 'ML' | 'L' | 'DL'; // Mesiobuccal, Buccal, Distobuccal, Mesiolingual, Lingual, Distolingual

@Injectable()
export class DentalService {
  constructor(private readonly db: DatabaseService) {}

  async createDentalChart(
    data: {
      patientId: string;
      dentistId: string;
      chiefComplaint?: string;
      oralHygieneIndex?: string;
      notes?: string;
    },
    tenantDb: string,
  ): Promise<{ id: string }> {
    const [row] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO dental_charts (patient_id, dentist_id, chief_complaint, oral_hygiene_index, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [data.patientId, data.dentistId, data.chiefComplaint ?? null, data.oralHygieneIndex ?? null, data.notes ?? null],
    );
    return row;
  }

  async recordToothCondition(
    chartId: string,
    toothNumber: number,
    surface: string | null,
    condition: ToothCondition,
    notes: string | null,
    tenantDb: string,
  ): Promise<void> {
    if (toothNumber < 11 || toothNumber > 48) {
      throw new Error(`Invalid FDI tooth number: ${toothNumber}. Must be 11–48.`);
    }
    await this.db.query(
      tenantDb,
      `INSERT INTO dental_tooth_conditions (chart_id, tooth_number, surface, condition_code, notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (chart_id, tooth_number, surface) DO UPDATE SET condition_code = EXCLUDED.condition_code, notes = EXCLUDED.notes`,
      [chartId, toothNumber, surface, condition, notes],
    );
  }

  async recordPerioChart(
    chartId: string,
    entries: Array<{ toothNumber: number; site: PerioSite; probingDepthMm: number; bleedingOnProbing: boolean; recessionMm?: number }>,
    tenantDb: string,
  ): Promise<void> {
    for (const entry of entries) {
      await this.db.query(
        tenantDb,
        `INSERT INTO dental_perio_charts (chart_id, tooth_number, site, probing_depth_mm, bleeding_on_probing, recession_mm)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (chart_id, tooth_number, site) DO UPDATE SET
           probing_depth_mm = EXCLUDED.probing_depth_mm,
           bleeding_on_probing = EXCLUDED.bleeding_on_probing,
           recession_mm = EXCLUDED.recession_mm`,
        [chartId, entry.toothNumber, entry.site, entry.probingDepthMm, entry.bleedingOnProbing, entry.recessionMm ?? 0],
      );
    }
  }

  async addTreatmentPlan(
    data: {
      patientId: string;
      chartId?: string;
      toothNumber?: number;
      procedureCode: string;
      procedureDescription: string;
      plannedDate?: string;
      costUsd?: number;
      notes?: string;
    },
    tenantDb: string,
  ): Promise<{ id: string }> {
    const [row] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO dental_treatment_plans (patient_id, chart_id, tooth_number, procedure_code, procedure_description, planned_date, cost_usd, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        data.patientId, data.chartId ?? null, data.toothNumber ?? null,
        data.procedureCode, data.procedureDescription, data.plannedDate ?? null,
        data.costUsd ?? null, data.notes ?? null,
      ],
    );
    return row;
  }

  async completeTreatment(treatmentPlanId: string, completedDate: string, tenantDb: string): Promise<void> {
    await this.db.query(
      tenantDb,
      `UPDATE dental_treatment_plans SET status = 'completed', completed_date = $2 WHERE id = $1`,
      [treatmentPlanId, completedDate],
    );
  }

  async getPatientDentalHistory(patientId: string, tenantDb: string) {
    return this.db.query(
      tenantDb,
      `SELECT dc.*, 
              json_agg(DISTINCT dtc.*) FILTER (WHERE dtc.id IS NOT NULL) as tooth_conditions,
              json_agg(DISTINCT dtp.*) FILTER (WHERE dtp.id IS NOT NULL) as treatment_plans
       FROM dental_charts dc
       LEFT JOIN dental_tooth_conditions dtc ON dtc.chart_id = dc.id
       LEFT JOIN dental_treatment_plans dtp ON dtp.chart_id = dc.id
       WHERE dc.patient_id = $1
       GROUP BY dc.id
       ORDER BY dc.visit_date DESC`,
      [patientId],
    );
  }
}
```

### 4.5 Unified Controller
**File:** `services/ehr-service/src/controllers/clinical-specialties.controller.ts`

```typescript
import { Controller, Get, Post, Put, Param, Body, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DentalService } from '../services/dental.service';
import { PmtctService } from '../services/pmtct.service';
import { GrowthChartService } from '../services/growth-chart.service';
import { PaediatricDosingService } from '../services/paediatric-dosing.service';
import { Request } from 'express';

@Controller('clinical')
@UseGuards(JwtAuthGuard)
export class ClinicalSpecialtiesController {
  constructor(
    private readonly dental: DentalService,
    private readonly pmtct: PmtctService,
    private readonly growth: GrowthChartService,
    private readonly dosing: PaediatricDosingService,
  ) {}

  // ── Dental ──
  @Post('dental/charts')
  createDentalChart(@Body() body: any, @Req() req: Request) {
    const { user, tenantDb } = req as any;
    return this.dental.createDentalChart({ ...body, dentistId: user.sub }, tenantDb);
  }

  @Post('dental/charts/:chartId/teeth')
  recordToothCondition(@Param('chartId') chartId: string, @Body() body: any, @Req() req: Request) {
    return this.dental.recordToothCondition(chartId, body.toothNumber, body.surface, body.condition, body.notes, (req as any).tenantDb);
  }

  @Post('dental/charts/:chartId/perio')
  recordPerioChart(@Param('chartId') chartId: string, @Body() body: { entries: any[] }, @Req() req: Request) {
    return this.dental.recordPerioChart(chartId, body.entries, (req as any).tenantDb);
  }

  @Post('dental/treatment-plans')
  addTreatmentPlan(@Body() body: any, @Req() req: Request) {
    return this.dental.addTreatmentPlan(body, (req as any).tenantDb);
  }

  @Put('dental/treatment-plans/:id/complete')
  completeTreatment(@Param('id') id: string, @Body() body: { completedDate: string }, @Req() req: Request) {
    return this.dental.completeTreatment(id, body.completedDate, (req as any).tenantDb);
  }

  @Get('dental/patients/:patientId/history')
  getDentalHistory(@Param('patientId') patientId: string, @Req() req: Request) {
    return this.dental.getPatientDentalHistory(patientId, (req as any).tenantDb);
  }

  // ── PMTCT / ANC ──
  @Post('anc/register')
  registerAnc(@Body() body: any, @Req() req: Request) {
    return this.pmtct.registerAnc(body, (req as any).tenantDb);
  }

  @Post('anc/pmtct-visits')
  recordPmtctVisit(@Body() body: any, @Req() req: Request) {
    const { user, tenantDb } = req as any;
    return this.pmtct.recordPmtctVisit(body, user.sub, tenantDb);
  }

  @Post('anc/eid-schedules')
  createEidSchedule(@Body() body: any, @Req() req: Request) {
    return this.pmtct.createEidSchedule(body, (req as any).tenantDb);
  }

  @Put('anc/eid-schedules/:id/result')
  recordEidResult(
    @Param('id') id: string,
    @Body() body: { timepoint: '6w' | '4m' | '12m' | '18m'; result: 'positive' | 'negative' | 'indeterminate'; doneDate: string },
    @Req() req: Request,
  ) {
    return this.pmtct.recordEidResult(id, body.timepoint, body.result, body.doneDate, (req as any).tenantDb);
  }

  @Get('anc/eid-schedules/overdue')
  getOverdueEid(@Req() req: Request) {
    return this.pmtct.getOverdueEid((req as any).tenantDb);
  }

  // ── Growth Charts ──
  @Post('growth/measurements')
  recordGrowthMeasurement(@Body() body: any, @Req() req: Request) {
    const { user, tenantDb } = req as any;
    return this.growth.recordGrowthMeasurement(
      body.patientId, body.measurementDate, body.weightKg, body.heightCm,
      body.headCircumferenceCm, body.muacCm, body.sex, body.dateOfBirth, user.sub, tenantDb,
    );
  }

  @Get('growth/patients/:patientId/history')
  getGrowthHistory(@Param('patientId') patientId: string, @Req() req: Request) {
    return this.growth.getGrowthHistory(patientId, (req as any).tenantDb);
  }

  // ── Paediatric Dosing ──
  @Get('paediatric/dosing')
  getDose(@Query('weightKg') weightKg: string) {
    const weight = parseFloat(weightKg);
    if (isNaN(weight)) throw new Error('Invalid weightKg');
    return this.dosing.getDoseForWeight(weight);
  }

  @Get('paediatric/dosing/table')
  getFullDoseTable() {
    return this.dosing.getFullDoseTable();
  }
}
```

### 4.6 Register in `ehr.module.ts`
```typescript
// Add to controllers:
ClinicalSpecialtiesController,

// Add to providers:
DentalService,
PmtctService,
GrowthChartService,
PaediatricDosingService,
```

---

## 5. Frontend Implementation

### 5.1 Dental Tab Component
**File:** `ehr-frontend/src/components/DentalChartTab.tsx`

- Interactive 32-tooth diagram (two rows: upper 11–28, lower 31–48 in FDI notation)
- Click a tooth → condition picker (dropdown: healthy/caries/filled/missing/crown/RCT/extraction needed)
- Colour coding: green=healthy, red=caries, grey=missing, blue=filled, yellow=watch
- Perio chart table: each tooth × 6 sites, input probing depth (mm), checkbox for BOP
- Treatment plan list at bottom: add new procedure button, mark complete

### 5.2 ANC Dashboard Page
**File:** `ehr-frontend/src/pages/AncDashboardPage.tsx`

Tabs:
1. **Registration** — ANC registration form (LMP, gravida, para, ART details)
2. **PMTCT Visits** — timeline of antenatal visits; VL at 36w flagged red if >1000
3. **EID Tracker** — infant EID schedule with colour-coded timepoints (due/overdue/done/positive)
4. **Overdue EID** — list of all infants with overdue tests clinic-wide

### 5.3 Growth Chart Visualisation
**File:** `ehr-frontend/src/components/GrowthChartPlot.tsx`

- SVG chart with WHO z-score reference lines (-3, -2, 0, +2 SD lines)
- Plot patient measurements as circles on WAZ, HAZ curves
- Colour zones: green (normal), yellow (moderate), red (severe)
- Uses `recharts` library (already in package.json or add: `npm install recharts`)

### 5.4 Paediatric Dosing Panel
**File:** `ehr-frontend/src/components/PaediatricDosingPanel.tsx`

- Enter patient weight (kg) → shows recommended doses for ABC/3TC, EFV, LPV/r
- Highlight in amber if current weight is near the top of a weight band (within 1 kg of next band)
- Full weight band table as expandable reference

---

## 6. Tests Required

**File:** `services/ehr-service/src/services/__tests__/growth-chart.service.spec.ts`

```typescript
describe('GrowthChartService', () => {
  const service = new GrowthChartService(null as any);

  it('computes WAZ z-score using LMS formula', () => {
    const z = service.computeZScore(7.0, 0.3520, 7.2986, 0.11737); // female 6-month params
    expect(z).toBeCloseTo(-0.41, 1); // approx -0.41 SD
  });

  it('categorises severe underweight correctly', () => {
    const result = service.computeAllZScores(4.5, null, 12, 'F');
    expect(result.wazCategory).toBe('severe_underweight');
    expect(result.nutritionReferralNeeded).toBe(true);
  });

  it('categorises normal weight correctly', () => {
    const result = service.computeAllZScores(9.5, null, 12, 'M');
    expect(result.wazCategory).toBe('normal');
    expect(result.nutritionReferralNeeded).toBe(false);
  });
});
```

**File:** `services/ehr-service/src/services/__tests__/paediatric-dosing.service.spec.ts`

```typescript
describe('PaediatricDosingService', () => {
  const service = new PaediatricDosingService();

  it('returns correct dose for 8 kg', () => {
    const dose = service.getDoseForWeight(8);
    expect(dose?.abcLtcFdc).toBe('60/30 mg BID');
  });

  it('returns adult dosing for 30 kg', () => {
    const dose = service.getDoseForWeight(30);
    expect(dose?.abcLtcFdc).toContain('Adult dosing');
  });

  it('detects weight band change from 13 kg to 14 kg', () => {
    const result = service.detectWeightBandChange(13, 14);
    expect(result.changed).toBe(true);
    expect(result.previousBand).toBe('10–13.9 kg');
    expect(result.newBand).toBe('14–19.9 kg');
  });
});
```

**File:** `services/ehr-service/src/services/__tests__/pmtct.service.spec.ts`

```typescript
describe('PmtctService', () => {
  it('computes EDD as LMP + 280 days', async () => {
    mockDb.query.mockResolvedValue([{ id: 'anc1' }]);
    const result = await service.registerAnc({ patientId: 'p1', lmpDate: '2026-01-01', gravida: 1, para: 0 }, 'db');
    expect(result.edd).toBe('2026-10-08'); // 280 days after Jan 1
  });

  it('sets maternal_transmission_risk=high when VL>1000 at ≥36 weeks', async () => {
    mockDb.query.mockResolvedValue([{ id: 'v1' }]);
    const result = await service.recordPmtctVisit(
      { ancRegistrationId: 'a1', visitDate: '2026-09-01', gestationalAgeWeeks: 37, viralLoad: 1500 },
      'nurse1', 'db',
    );
    expect(result.maternalTransmissionRisk).toBe('high');
    expect(mockDb.query).toHaveBeenCalledWith('db', expect.stringContaining('maternal_transmission_risk'), expect.any(Array));
  });

  it('creates EID schedule with 12-week NVP for high-risk', async () => {
    mockDb.query.mockResolvedValue([{ id: 'eid1' }]);
    await service.createEidSchedule({ motherPatientId: 'm1', infantName: 'Baby', birthDate: '2026-06-01', isHighRisk: true }, 'db');
    expect(mockDb.query).toHaveBeenCalledWith('db', expect.any(String), expect.arrayContaining([12]));
  });
});
```

**File:** `services/ehr-service/src/services/__tests__/dental.service.spec.ts`

```typescript
describe('DentalService', () => {
  it('rejects invalid FDI tooth number', async () => {
    await expect(service.recordToothCondition('c1', 99, null, 'caries', null, 'db'))
      .rejects.toThrow('Invalid FDI tooth number');
  });

  it('upserts tooth condition on duplicate', async () => {
    mockDb.query.mockResolvedValue([]);
    await service.recordToothCondition('c1', 21, 'B', 'caries', null, 'db');
    expect(mockDb.query).toHaveBeenCalledWith('db', expect.stringContaining('ON CONFLICT'), expect.any(Array));
  });
});
```

---

## 7. Sign-off Criteria

- [ ] `npm run lint` passes zero errors in all modified packages
- [ ] `npm test` passes all new dental, PMTCT, growth chart, and dosing specs
- [ ] CI `build-and-test` job passes green
- [ ] `POST /api/admin/tenants/repair-all` backfills all dental, ANC/PMTCT, EID, and growth measurement tables
- [ ] Dental chart creation with tooth condition recording works end-to-end via API
- [ ] FDI tooth number 99 returns 400 Bad Request
- [ ] Growth measurement for 7 kg female at 6 months computes WAZ ≈ -0.4 (within ±0.1)
- [ ] Growth measurement with WAZ < -2 sets `nutrition_referral_needed = true`
- [ ] Paediatric dosing: `GET /clinical/paediatric/dosing?weightKg=8` returns `{ abcLtcFdc: '60/30 mg BID' }`
- [ ] ANC registration computes EDD as LMP + 280 days correctly
- [ ] PMTCT visit with VL 1500 at 37 weeks sets `maternal_transmission_risk = 'high'`
- [ ] EID schedule created with correct due dates: 6w, 4m, 12m, 18m from birth date
- [ ] EID positive result at any timepoint returns `{ requiresImmediateArt: true }`
- [ ] `GET /clinical/anc/eid-schedules/overdue` returns infants with past-due tests
- [ ] Dental chart UI renders 32-tooth diagram with click-to-condition interaction
- [ ] Growth chart SVG plots patient measurements against WHO z-score reference lines
