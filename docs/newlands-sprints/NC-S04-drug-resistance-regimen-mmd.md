# NC-S04 — Drug Resistance Prediction + Regimen Intelligence + MMD Tracking

**Sprint ID:** NC-S04  
**Priority:** P1 — Core HIV clinical safety  
**Effort:** 2 weeks  
**Dependencies:** NC-S03 (OI alerts, stable patient flags)  
**Covers gaps:** 2.7 (drug resistance — 15% → 90%), 2.8 (regimen switch — partial → complete), 3.8 (MMD — 30% → 100%), 3.2/3.3 (CD4/VL auto-import hardening)

---

## 1. Codebase Context — What Already Exists

| File | What it has |
|---|---|
| `services/ehr-service/src/services/tb.service.ts` | `resistant()` for TB DST results only |
| `services/ehr-service/src/services/cdss.service.ts` | Rule-based CDSS |
| `services/ehr-service/src/services/hiv.service.ts` | ART regimen fields, VL tracking, EAC logic |
| `services/ehr-service/src/services/pharmacy.service.ts` | `max_days_supply` in formulary; dispensing controller |
| `services/ehr-service/src/entities/pharmacy-formulary.entity.ts` | `max_days_supply` field |
| `services/ehr-service/src/services/nhls-hl7.service.ts` | NHLS HL7 parsing for lab results |

**What's missing:**
- HIV (not TB) drug resistance prediction
- Locally available drug formulary constraint on regimen switching
- MMD business logic (3-month, 6-month rules, eligibility, scheduling)
- NHLS/analyser production import validation path

---

## 2. What This Sprint Builds

### Part A — HIV Drug Resistance Prediction
- Rule-based HIV resistance predictor using WHO 2021 Drug Resistance Report logic
- Resistance risk by drug class (NNRTI, NRTI, PI, INSTI) based on regimen history + VL trajectory

### Part B — Local Formulary Regimen Switch Engine
- Regimen switch recommendation constrained to drugs available in Zimbabwe National ART formulary
- Considers documented resistance, OI status, pregnancy, renal function

### Part C — MMD Tracking (Complete Implementation)
- MMD eligibility check (built on NC-S03 stable patient flags)
- Dispensing record extended with MMD-specific fields
- Patient MMD schedule tracking with overdue alerts

### Part D — CD4/VL Import Hardening
- Structured import validation for NHLS HL7 v2.5 results
- Fallback manual entry with structured validation
- Import audit log

---

## 3. Database Changes

Add bundle to `getProvisioningBundles()`:

```typescript
{
  id: 'nc_resistance_mmd',
  label: 'HIV Resistance + MMD Tracking',
  version: '2026.05.17.1',
  description: 'HIV drug resistance assessments, regimen switch history, MMD dispensing records',
  statements: () => [
    // Resistance assessments
    `CREATE TABLE IF NOT EXISTS hiv_resistance_assessments (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id            UUID         NOT NULL,
      assessed_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
      assessed_by           UUID,
      current_regimen       VARCHAR(300),
      regimen_duration_months INTEGER,
      recent_vl             INTEGER,        -- copies/mL
      previous_vl           INTEGER,        -- copies/mL at 6 months prior
      vl_trend              VARCHAR(20),    -- 'suppressed' | 'rising' | 'failing' | 'rebounding'
      nnrti_risk            VARCHAR(20)  NOT NULL DEFAULT 'low',   -- 'low' | 'moderate' | 'high'
      nrti_risk             VARCHAR(20)  NOT NULL DEFAULT 'low',
      pi_risk               VARCHAR(20)  NOT NULL DEFAULT 'low',
      insti_risk            VARCHAR(20)  NOT NULL DEFAULT 'low',
      overall_resistance_risk VARCHAR(20) NOT NULL DEFAULT 'low',
      resistance_test_recommended BOOLEAN NOT NULL DEFAULT false,
      notes                 TEXT,
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_resistance_patient ON hiv_resistance_assessments (patient_id)`,

    // Regimen switch history
    `CREATE TABLE IF NOT EXISTS hiv_regimen_switches (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id          UUID         NOT NULL,
      switch_date         DATE         NOT NULL,
      previous_regimen    VARCHAR(300) NOT NULL,
      new_regimen         VARCHAR(300) NOT NULL,
      reason              VARCHAR(60)  NOT NULL,  -- 'failure' | 'toxicity' | 'simplification' | 'pregnancy' | 'drug_shortage' | 'cost'
      failure_type        VARCHAR(30),             -- 'clinical' | 'immunological' | 'virological'
      switched_by         UUID,
      cdss_recommended    BOOLEAN      NOT NULL DEFAULT false,  -- was CDSS recommendation followed?
      cdss_recommendation TEXT,
      approved_by         UUID,          -- second doctor sign-off for third-line
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_regimen_switch_patient ON hiv_regimen_switches (patient_id)`,

    // MMD dispensing schedule
    `CREATE TABLE IF NOT EXISTS hiv_mmd_schedules (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        UUID         NOT NULL,
      mmd_months        INTEGER      NOT NULL,  -- 3 or 6
      last_dispensed    DATE,
      next_due          DATE         NOT NULL,
      drugs_dispensed   TEXT,                   -- comma-separated drug names
      days_dispensed    INTEGER,
      dispensed_by      UUID,
      dispense_location VARCHAR(200),
      status            VARCHAR(20)  NOT NULL DEFAULT 'scheduled',  -- 'scheduled' | 'dispensed' | 'overdue' | 'cancelled'
      overdue_alerted   BOOLEAN      NOT NULL DEFAULT false,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mmd_schedule_patient ON hiv_mmd_schedules (patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mmd_schedule_due     ON hiv_mmd_schedules (next_due) WHERE status = 'scheduled'`,

    // Lab import audit
    `CREATE TABLE IF NOT EXISTS lab_import_audit (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_source   VARCHAR(60)  NOT NULL,  -- 'nhls_hl7' | 'manual' | 'fhir' | 'csv'
      patient_id      UUID,
      lab_test_type   VARCHAR(60),             -- 'cd4' | 'viral_load' | 'hb' | 'creatinine' | 'alt'
      raw_value       VARCHAR(100),
      parsed_value    NUMERIC(12, 4),
      unit            VARCHAR(30),
      imported_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
      imported_by     UUID,
      import_status   VARCHAR(20)  NOT NULL DEFAULT 'success',  -- 'success' | 'failed' | 'duplicate' | 'out_of_range'
      error_message   TEXT,
      linked_lab_order_id UUID
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lab_import_patient ON lab_import_audit (patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_lab_import_status  ON lab_import_audit (import_status)`,
  ],
},
```

Run `POST /api/admin/tenants/repair-all` after adding.

---

## 4. Backend Implementation

### 4.1 HIV Resistance Predictor

**File to create:** `services/ehr-service/src/services/hiv-resistance.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// Zimbabwe National ART Formulary — available drugs by class (2025)
const ZIMBABWE_FORMULARY = {
  NRTI: ['TDF', 'AZT', 'ABC', '3TC', 'FTC', 'd4T'],             // d4T deprecated but may still be in stock
  NNRTI: ['EFV', 'NVP', 'RPV', 'DOR'],
  PI:   ['LPV/r', 'ATV/r', 'DRV/r'],
  INSTI: ['DTG', 'RAL', 'BIC'],
  ENTRY: ['MVC'],
};

// WHO 2021 HIV Drug Resistance Report — simplified risk rules
const RESISTANCE_RULES = [
  // NNRTI resistance
  {
    drugClass: 'NNRTI',
    check: (data: ResistanceInput) =>
      data.regimenContains('EFV') || data.regimenContains('NVP'),
    vlTrend: 'failing',
    risk: 'high' as const,
    note: 'Prior NNRTI exposure + virological failure → high K103N/Y181C/E138A resistance probability',
  },
  // NRTI (M184V from 3TC/FTC)
  {
    drugClass: 'NRTI',
    check: (data: ResistanceInput) =>
      (data.regimenContains('3TC') || data.regimenContains('FTC')) && data.regimenDurationMonths >= 3,
    vlTrend: 'failing',
    risk: 'high' as const,
    note: 'M184V emerges rapidly on 3TC/FTC with virological failure',
  },
  // PI resistance (uncommon with boosted PIs)
  {
    drugClass: 'PI',
    check: (data: ResistanceInput) =>
      (data.regimenContains('LPV/r') || data.regimenContains('ATV/r')) && data.regimenDurationMonths >= 24,
    vlTrend: 'rebounding',
    risk: 'moderate' as const,
    note: 'Long-term PI use with rebound VL — PI mutations possible but uncommon with boosted regimen',
  },
  // DTG resistance (rare but documented with prior INSTI use or high-level viremia)
  {
    drugClass: 'INSTI',
    check: (data: ResistanceInput) =>
      data.regimenContains('RAL') && data.regimenDurationMonths >= 12,
    vlTrend: 'failing',
    risk: 'moderate' as const,
    note: 'Prior RAL exposure + failure — INSTI resistance (Q148H/R263K) possible',
  },
];

interface ResistanceInput {
  currentRegimen: string;
  regimenDurationMonths: number;
  recentVl: number;
  previousVl: number | null;
  regimenContains: (drug: string) => boolean;
  vlTrend: 'suppressed' | 'rising' | 'failing' | 'rebounding';
}

type ResistanceRisk = 'low' | 'moderate' | 'high';

@Injectable()
export class HivResistanceService {
  assessResistance(params: {
    currentRegimen: string;
    regimenDurationMonths: number;
    recentVl: number;
    previousVl: number | null;
  }): {
    nnrtiRisk: ResistanceRisk;
    nrtiRisk: ResistanceRisk;
    piRisk: ResistanceRisk;
    instiRisk: ResistanceRisk;
    overallRisk: ResistanceRisk;
    resistanceTestRecommended: boolean;
    notes: string[];
  } {
    const regimenContains = (drug: string) =>
      params.currentRegimen.toUpperCase().includes(drug.toUpperCase());

    const vlTrend = this.classifyVlTrend(params.recentVl, params.previousVl);

    const input: ResistanceInput = {
      ...params,
      regimenContains,
      vlTrend,
    };

    const risks: Record<string, ResistanceRisk> = {
      NNRTI: 'low', NRTI: 'low', PI: 'low', INSTI: 'low',
    };
    const notes: string[] = [];

    for (const rule of RESISTANCE_RULES) {
      if (rule.check(input) && (rule.vlTrend === vlTrend || vlTrend === 'failing')) {
        const current = risks[rule.drugClass];
        if (current === 'low' || (current === 'moderate' && rule.risk === 'high')) {
          risks[rule.drugClass] = rule.risk;
          notes.push(rule.note);
        }
      }
    }

    const riskValues = Object.values(risks);
    const overallRisk: ResistanceRisk =
      riskValues.includes('high')     ? 'high'     :
      riskValues.includes('moderate') ? 'moderate' : 'low';

    return {
      nnrtiRisk: risks.NNRTI as ResistanceRisk,
      nrtiRisk:  risks.NRTI as ResistanceRisk,
      piRisk:    risks.PI as ResistanceRisk,
      instiRisk: risks.INSTI as ResistanceRisk,
      overallRisk,
      resistanceTestRecommended: overallRisk === 'high' || params.recentVl > 1000,
      notes,
    };
  }

  private classifyVlTrend(recent: number, previous: number | null): 'suppressed' | 'rising' | 'failing' | 'rebounding' {
    if (recent < 1000) return 'suppressed';
    if (previous === null) return 'failing';
    if (recent > previous * 1.5) return 'failing';
    if (previous < 1000 && recent >= 1000) return 'rebounding';
    return 'rising';
  }

  recommendRegimenSwitch(params: {
    currentRegimen: string;
    resistanceAssessment: ReturnType<HivResistanceService['assessResistance']>;
    isPregnant: boolean;
    creatinine: number;  // mg/dL — for TDF contraindication check
    isThirdLine: boolean;
  }): { recommendation: string; rationale: string; requiresSpecialistApproval: boolean } {
    const { resistanceAssessment, isPregnant, creatinine, isThirdLine } = params;

    if (isThirdLine) {
      return {
        recommendation: 'Third-line regimen — refer to National ART Technical Committee',
        rationale: 'Third-line switching requires NATC approval and resistance test results',
        requiresSpecialistApproval: true,
      };
    }

    // Virological failure on first-line NNRTI-based regimen → switch to second-line PI
    if (resistanceAssessment.nnrtiRisk === 'high' && params.currentRegimen.match(/EFV|NVP/i)) {
      const piBase = isPregnant ? 'LPV/r 400/100mg BD' : 'ATV/r 300/100mg OD';
      const backboneA = creatinine > 1.5 ? 'AZT 300mg BD' : 'TDF 300mg OD';
      return {
        recommendation: `${backboneA} + 3TC 300mg OD + ${piBase}`,
        rationale: `NNRTI failure on first-line. Switching to PI-based second-line. ${creatinine > 1.5 ? 'TDF avoided (creatinine > 1.5).' : ''} ${isPregnant ? 'LPV/r preferred in pregnancy.' : ''}`,
        requiresSpecialistApproval: false,
      };
    }

    // Virological failure on second-line PI → DTG-based
    if (resistanceAssessment.piRisk !== 'low' && params.currentRegimen.match(/LPV|ATV|DRV/i)) {
      return {
        recommendation: 'DRV/r 800/100mg OD + DTG 50mg OD + optimised NRTI backbone (after resistance test)',
        rationale: 'Second-line PI failure. DTG-based third-line after resistance testing. Requires NATC approval.',
        requiresSpecialistApproval: true,
      };
    }

    return {
      recommendation: 'Continue current regimen. Intensify adherence counselling (EAC).',
      rationale: 'Resistance risk is low. No regimen switch indicated at this time.',
      requiresSpecialistApproval: false,
    };
  }
}
```

### 4.2 MMD Service

**File to create:** `services/ehr-service/src/services/hiv-mmd.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class HivMmdService {
  async scheduleMmd(params: {
    patientId: string;
    mmdMonths: 3 | 6;
    drugs: string[];
    daysDispensed: number;
    dispensedBy: string;
    db: any;
  }): Promise<void> {
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + params.mmdMonths);

    await params.db.query(
      `INSERT INTO hiv_mmd_schedules
         (patient_id, mmd_months, last_dispensed, next_due, drugs_dispensed, days_dispensed, dispensed_by, status)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, 'dispensed')`,
      [params.patientId, params.mmdMonths, nextDue.toISOString().split('T')[0],
       params.drugs.join(', '), params.daysDispensed, params.dispensedBy],
    );
  }

  async getOverdueMmdPatients(db: any): Promise<any[]> {
    return db.query(`
      SELECT s.*, p.full_name, p.phone_number
      FROM hiv_mmd_schedules s
      JOIN patients p ON p.id = s.patient_id
      WHERE s.status = 'scheduled' AND s.next_due < CURRENT_DATE
      ORDER BY s.next_due ASC
    `);
  }

  async markOverdueAlerts(db: any): Promise<number> {
    const result = await db.query(`
      UPDATE hiv_mmd_schedules
      SET status = 'overdue', overdue_alerted = true, updated_at = now()
      WHERE status = 'scheduled' AND next_due < CURRENT_DATE AND NOT overdue_alerted
    `);
    return result.rowCount ?? 0;
  }

  async getPatientMmdHistory(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM hiv_mmd_schedules WHERE patient_id = $1 ORDER BY created_at DESC`,
      [patientId],
    );
  }
}
```

### 4.3 CD4/VL Import Hardening

**File to modify:** `services/ehr-service/src/services/nhls-hl7.service.ts`

Add validation and audit logging after successful parse:

```typescript
// After parsing an HL7 result, save to lab_import_audit:
await tenantDb.query(
  `INSERT INTO lab_import_audit
     (import_source, patient_id, lab_test_type, raw_value, parsed_value, unit, imported_by, import_status)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  ['nhls_hl7', patientId, labTestType, rawValue, parsedValue, unit, userId, 'success'],
);

// Range validation — reject obviously wrong values:
const VALID_RANGES: Record<string, [number, number]> = {
  cd4:          [0,    3000],
  viral_load:   [0,    10_000_000],
  hb:           [1,    25],
  creatinine:   [0.1,  30],
  alt:          [0,    5000],
};
const [min, max] = VALID_RANGES[labTestType] ?? [0, Infinity];
if (parsedValue < min || parsedValue > max) {
  await tenantDb.query(
    `INSERT INTO lab_import_audit (import_source, patient_id, lab_test_type, raw_value, import_status, error_message)
     VALUES ($1, $2, $3, $4, 'out_of_range', $5)`,
    ['nhls_hl7', patientId, labTestType, rawValue, `Value ${parsedValue} outside expected range [${min}, ${max}]`],
  );
  throw new BadRequestException(`Lab value out of range: ${labTestType}=${parsedValue}`);
}
```

### 4.4 Controller Endpoints

Add to `services/ehr-service/src/controllers/hiv.controller.ts`:

```typescript
// POST /hiv/patients/:id/assess-resistance
@Post('patients/:id/assess-resistance')
@UseGuards(JwtAuthGuard)
async assessResistance(@Param('id') id: string, @Body() body: {
  currentRegimen: string;
  regimenDurationMonths: number;
  recentVl: number;
  previousVl?: number;
}, @Req() req: any) {
  const assessment = this.hivResistanceService.assessResistance({
    currentRegimen:        body.currentRegimen,
    regimenDurationMonths: body.regimenDurationMonths,
    recentVl:              body.recentVl,
    previousVl:            body.previousVl ?? null,
  });
  await req.tenantDb.query(
    `INSERT INTO hiv_resistance_assessments
       (patient_id, current_regimen, regimen_duration_months, recent_vl, previous_vl,
        vl_trend, nnrti_risk, nrti_risk, pi_risk, insti_risk, overall_resistance_risk,
        resistance_test_recommended, notes, assessed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, body.currentRegimen, body.regimenDurationMonths, body.recentVl, body.previousVl ?? null,
     assessment.overallRisk === 'low' ? 'suppressed' : 'failing',
     assessment.nnrtiRisk, assessment.nrtiRisk, assessment.piRisk, assessment.instiRisk,
     assessment.overallRisk, assessment.resistanceTestRecommended,
     assessment.notes.join('; '), req.user.sub],
  );
  return assessment;
}

// POST /hiv/patients/:id/recommend-regimen
@Post('patients/:id/recommend-regimen')
@UseGuards(JwtAuthGuard)
async recommendRegimen(@Param('id') id: string, @Body() body: {
  currentRegimen: string;
  isPregnant?: boolean;
  creatinine?: number;
  isThirdLine?: boolean;
  resistanceAssessment: any;
}, @Req() req: any) {
  return this.hivResistanceService.recommendRegimenSwitch({
    currentRegimen:       body.currentRegimen,
    resistanceAssessment: body.resistanceAssessment,
    isPregnant:           body.isPregnant ?? false,
    creatinine:           body.creatinine ?? 1.0,
    isThirdLine:          body.isThirdLine ?? false,
  });
}

// GET /hiv/mmd/overdue
@Get('mmd/overdue')
@UseGuards(JwtAuthGuard)
async getOverdueMmd(@Req() req: any) {
  return this.hivMmdService.getOverdueMmdPatients(req.tenantDb);
}

// POST /hiv/patients/:id/mmd/schedule
@Post('patients/:id/mmd/schedule')
@UseGuards(JwtAuthGuard)
async scheduleMmd(@Param('id') id: string, @Body() body: {
  mmdMonths: 3 | 6;
  drugs: string[];
  daysDispensed: number;
}, @Req() req: any) {
  await this.hivMmdService.scheduleMmd({
    patientId:    id,
    mmdMonths:    body.mmdMonths,
    drugs:        body.drugs,
    daysDispensed: body.daysDispensed,
    dispensedBy:  req.user.sub,
    db:           req.tenantDb,
  });
  return { scheduled: true };
}

// GET /hiv/patients/:id/mmd/history
@Get('patients/:id/mmd/history')
@UseGuards(JwtAuthGuard)
async getMmdHistory(@Param('id') id: string, @Req() req: any) {
  return this.hivMmdService.getPatientMmdHistory(id, req.tenantDb);
}
```

Register `HivResistanceService`, `HivMmdService` in `ehr.module.ts`.

---

## 5. Frontend Implementation

### 5.1 Resistance Assessment Panel

**File to modify:** `ehr-frontend/src/pages/HIVDoctorDashboard.tsx`

Add "Drug Resistance Risk" panel:
- "Assess Resistance" button → calls `POST /hiv/patients/:id/assess-resistance`
- Shows risk pills per drug class: NNRTI | NRTI | PI | INSTI
- Colour: green=low, orange=moderate, red=high
- "Resistance test recommended" badge when flag is true
- "Recommend Regimen Switch" button → calls `POST /hiv/patients/:id/recommend-regimen` and shows recommendation in a modal with rationale and "Requires specialist approval" warning when applicable

### 5.2 MMD Dashboard Tab

**File to modify:** `ehr-frontend/src/components/HIVPatientManagement.tsx`

Add "MMD" tab showing:
- Patient's current MMD schedule (months, next due date, status)
- "Overdue MMD" alert badge when past due date
- "Record MMD Dispensing" modal: drug list checkboxes, days dispensed, MMD months selector

---

## 6. Tests Required

### 6.1 HivResistanceService Tests

**File:** `services/ehr-service/src/services/hiv-resistance.service.spec.ts`

```typescript
describe('HivResistanceService', () => {
  const svc = new HivResistanceService();

  it('classifies NNRTI risk as high on EFV failure', () => {
    const result = svc.assessResistance({
      currentRegimen: 'TDF+3TC+EFV',
      regimenDurationMonths: 18,
      recentVl: 50000,
      previousVl: 200,
    });
    expect(result.nnrtiRisk).toBe('high');
    expect(result.resistanceTestRecommended).toBe(true);
  });

  it('recommends PI-based second-line for NNRTI failure', () => {
    const assessment = svc.assessResistance({ currentRegimen: 'TDF+3TC+EFV', regimenDurationMonths: 18, recentVl: 50000, previousVl: 200 });
    const rec = svc.recommendRegimenSwitch({ currentRegimen: 'TDF+3TC+EFV', resistanceAssessment: assessment, isPregnant: false, creatinine: 1.0, isThirdLine: false });
    expect(rec.recommendation).toContain('ATV/r');
    expect(rec.requiresSpecialistApproval).toBe(false);
  });

  it('recommends LPV/r for pregnant patient with NNRTI failure', () => {
    const assessment = svc.assessResistance({ currentRegimen: 'TDF+3TC+EFV', regimenDurationMonths: 18, recentVl: 50000, previousVl: 200 });
    const rec = svc.recommendRegimenSwitch({ currentRegimen: 'TDF+3TC+EFV', resistanceAssessment: assessment, isPregnant: true, creatinine: 1.0, isThirdLine: false });
    expect(rec.recommendation).toContain('LPV/r');
  });

  it('avoids TDF when creatinine > 1.5', () => {
    const assessment = svc.assessResistance({ currentRegimen: 'TDF+3TC+EFV', regimenDurationMonths: 18, recentVl: 50000, previousVl: 200 });
    const rec = svc.recommendRegimenSwitch({ currentRegimen: 'TDF+3TC+EFV', resistanceAssessment: assessment, isPregnant: false, creatinine: 2.0, isThirdLine: false });
    expect(rec.recommendation).toContain('AZT');
  });

  it('requires specialist approval for third-line', () => {
    const assessment = svc.assessResistance({ currentRegimen: 'AZT+3TC+LPV/r', regimenDurationMonths: 36, recentVl: 80000, previousVl: 400 });
    const rec = svc.recommendRegimenSwitch({ currentRegimen: 'AZT+3TC+LPV/r', resistanceAssessment: assessment, isPregnant: false, creatinine: 1.0, isThirdLine: true });
    expect(rec.requiresSpecialistApproval).toBe(true);
  });
});
```

### 6.2 HivMmdService Tests

```typescript
describe('HivMmdService', () => {
  it('scheduleMmd inserts a record with next_due = today + mmdMonths', async () => {
    const mockDb = { query: jest.fn().mockResolvedValue({}) };
    const svc = new HivMmdService();
    await svc.scheduleMmd({ patientId: 'p1', mmdMonths: 3, drugs: ['TDF', '3TC', 'DTG'], daysDispensed: 90, dispensedBy: 'u1', db: mockDb });
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('hiv_mmd_schedules'), expect.arrayContaining(['p1', 3, 90, 'u1']));
  });
});
```

---

## 7. Sign-off Criteria

- [ ] `hiv_resistance_assessments`, `hiv_regimen_switches`, `hiv_mmd_schedules`, `lab_import_audit` tables provisioned
- [ ] `repair-all` backfills tables in existing tenants
- [ ] `POST /hiv/patients/:id/assess-resistance` returns correct risk classifications
- [ ] NNRTI risk = 'high' when EFV regimen + VL > 1000
- [ ] Regimen recommendation avoids TDF when creatinine > 1.5
- [ ] Regimen recommendation uses LPV/r for pregnant patients
- [ ] Third-line switch requires `requiresSpecialistApproval: true`
- [ ] `POST /hiv/patients/:id/mmd/schedule` inserts MMD schedule record
- [ ] `GET /hiv/mmd/overdue` returns patients with `next_due < today`
- [ ] Lab import audit log records successful and out-of-range results
- [ ] CD4 = -1 or VL = 99999999 rejected as out-of-range
- [ ] Resistance panel renders in HIVDoctorDashboard with colour-coded pills
- [ ] MMD tab renders with correct schedule and overdue badges
- [ ] `npm run lint` passes zero errors
- [ ] `npm test` passes zero failures
- [ ] CI `build-and-test` job passes green
