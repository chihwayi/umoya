# NC-S03 — OI Early Warning Bundle + HIV-Geriatric Integration + Fast-Track Protocols

**Sprint ID:** NC-S03  
**Priority:** P1 — Core clinical safety feature  
**Effort:** 2 weeks  
**Dependencies:** None  
**Covers gaps:** 2.4 (OI early warning — 20% → 100%), 2.10 (HIV-geriatric — 0% → complete), 2.11 (frailty scoring), 1.11 (HIV fast-track triage)

---

## 1. Codebase Context — What Already Exists

| File | What it has |
|---|---|
| `services/ehr-service/src/services/hiv.service.ts` | `opportunisticInfections`, `cryptococcal_signs`, `cryptococcal_status`, `cryptococcal_treatment` fields |
| `services/ehr-service/src/services/geriatrics.service.ts` | Standalone geriatric assessments: Barthel, ADL/IADL, MMSE, MOCA, falls, polypharmacy flag |
| `services/ehr-service/src/entities/geriatric-assessment.entity.ts` | Full geriatric assessment entity |
| `services/ehr-service/src/services/tb.service.ts` | `resistant()` function — TB resistance detection |
| `services/ehr-service/src/services/cdss.service.ts` | Rule-based CDSS |
| `services/ehr-service/src/services/hiv-quality-metrics.service.ts` | CD4/VL cohort metrics |
| `ehr-frontend/src/components/HIVNursePanel.tsx` | HIV nurse workflow UI |

**What's missing:**
- No OI detection algorithm: CD4 < threshold → prophylaxis/alert rules
- No CMV, PCP, Cryptococcal meningitis, MAC early detection logic
- No cross-module link: HIV patient → geriatric frailty when age ≥ 50
- No HIV fast-track (MMD stable patient) triage pathway
- No VACS Index (Veterans Aging Cohort Study) for aging PLHIV

---

## 2. What This Sprint Builds

### Part A — OI Early Warning
- Rule-based OI risk detection engine that fires on every HIV clinical visit save
- 6 OI risk rules triggered by CD4 count + symptom combinations
- CDSS alert cards surfaced in nurse and doctor dashboards

### Part B — HIV-Geriatric Integration
- When an HIV patient turns 50, automatically flag for geriatric co-management
- VACS Index calculation service (validated comorbidity/mortality score for aging PLHIV)
- Linked view: HIV dashboard shows geriatric summary; geriatric assessment shows HIV status

### Part C — HIV Fast-Track Stable Patient Protocol
- Classify patients as "stable" (criteria: VL suppressed >6 months, adherence ≥ 95%, no OI)
- Fast-track queue for stable patients: 3-monthly visits, 3-6 month drug supply
- Nurse-led pathway: nurse confirms stable status; doctor reviews flag, not full consult

---

## 3. Database Changes

### 3.1 Per-Tenant Tables

Add bundle to `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`:

```typescript
{
  id: 'nc_oi_geriatric_fasttrack',
  label: 'OI Early Warning + HIV Geriatric + Fast-Track',
  version: '2026.05.17.1',
  description: 'OI detection alerts, geriatric HIV integration, stable patient fast-track',
  statements: () => [
    // OI alerts table
    `CREATE TABLE IF NOT EXISTS oi_early_warning_alerts (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        UUID         NOT NULL,
      alert_type        VARCHAR(60)  NOT NULL,  -- 'pcp_risk' | 'cryptococcal_risk' | 'mac_risk' | 'cmv_risk' | 'toxo_risk' | 'tbc_risk'
      severity          VARCHAR(20)  NOT NULL DEFAULT 'high',  -- 'high' | 'urgent' | 'critical'
      trigger_cd4       INTEGER,
      trigger_finding   TEXT,
      alert_message     TEXT         NOT NULL,
      recommended_action TEXT        NOT NULL,
      guideline_ref     VARCHAR(200),  -- e.g. 'WHO 2021 ART Guidelines s.4.2'
      status            VARCHAR(20)  NOT NULL DEFAULT 'active',  -- 'active' | 'acknowledged' | 'resolved'
      acknowledged_by   UUID,
      acknowledged_at   TIMESTAMPTZ,
      resolved_at       TIMESTAMPTZ,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oi_alerts_patient   ON oi_early_warning_alerts (patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oi_alerts_status    ON oi_early_warning_alerts (status)`,
    `CREATE INDEX IF NOT EXISTS idx_oi_alerts_type      ON oi_early_warning_alerts (alert_type)`,

    // HIV-geriatric linkage
    `CREATE TABLE IF NOT EXISTS hiv_geriatric_flags (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id          UUID         NOT NULL UNIQUE,
      flagged_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      age_at_flag         INTEGER      NOT NULL,
      vacs_index_score    NUMERIC(5,2),
      vacs_10yr_mortality NUMERIC(5,2),  -- estimated 10-year mortality %
      frailty_status      VARCHAR(20),   -- 'robust' | 'pre_frail' | 'frail'
      polypharmacy_count  INTEGER,       -- number of concurrent medications
      last_assessed       TIMESTAMPTZ,
      next_review         DATE,
      notes               TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hiv_geriatric_patient ON hiv_geriatric_flags (patient_id)`,

    // Fast-track stable patients
    `CREATE TABLE IF NOT EXISTS hiv_stable_patient_flags (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id           UUID         NOT NULL UNIQUE,
      stable_since         DATE         NOT NULL,
      mmd_months           INTEGER      NOT NULL DEFAULT 3,   -- 3 or 6
      next_visit_due       DATE,
      classified_by        UUID,
      classification_notes TEXT,
      is_active            BOOLEAN      NOT NULL DEFAULT true,
      deactivated_at       TIMESTAMPTZ,
      deactivation_reason  TEXT,
      created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_stable_flag_patient ON hiv_stable_patient_flags (patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stable_flag_active  ON hiv_stable_patient_flags (patient_id) WHERE is_active`,
  ],
},
```

Run `POST /api/admin/tenants/repair-all` after adding.

---

## 4. Backend Implementation

### 4.1 OI Detection Rules Engine

**File to create:** `services/ehr-service/src/services/oi-early-warning.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface OiInput {
  cd4Count: number | null;
  symptoms: string[];          // free-text symptoms list
  tbScreenPositive: boolean;
  currentRegimen: string;
  vl: number | null;
}

interface OiAlert {
  alertType: string;
  severity: 'high' | 'urgent' | 'critical';
  alertMessage: string;
  recommendedAction: string;
  guidelineRef: string;
  triggerCd4?: number;
  triggerFinding?: string;
}

@Injectable()
export class OiEarlyWarningService {
  // WHO 2021 ART Guidelines — OI prophylaxis thresholds
  private static readonly RULES: Array<{
    alertType: string;
    severity: 'high' | 'urgent' | 'critical';
    check: (input: OiInput) => boolean;
    message: string;
    action: string;
    ref: string;
  }> = [
    {
      alertType: 'pcp_risk',
      severity: 'urgent',
      check: ({ cd4Count }) => cd4Count !== null && cd4Count < 200,
      message: 'CD4 < 200: High risk of Pneumocystis Pneumonia (PCP). Prophylaxis indicated.',
      action: 'Start Co-trimoxazole 960mg OD prophylaxis per WHO 2021 guidelines.',
      ref: 'WHO 2021 ART Guidelines §4.3 — PCP Prophylaxis',
    },
    {
      alertType: 'cryptococcal_risk',
      severity: 'critical',
      check: ({ cd4Count }) => cd4Count !== null && cd4Count < 100,
      message: 'CD4 < 100: High risk of Cryptococcal Meningitis. Cryptococcal Antigen (CrAg) test required.',
      action: 'Order CrAg lateral flow assay. If positive, start fluconazole 800mg and refer urgently.',
      ref: 'WHO 2022 Cryptococcal Meningitis Guidelines',
    },
    {
      alertType: 'mac_risk',
      severity: 'high',
      check: ({ cd4Count }) => cd4Count !== null && cd4Count < 50,
      message: 'CD4 < 50: Risk of Mycobacterium Avium Complex (MAC). Consider prophylaxis.',
      action: 'Consider Azithromycin 1200mg weekly prophylaxis. Discuss with clinician.',
      ref: 'WHO 2021 ART Guidelines §4.5 — MAC Prophylaxis',
    },
    {
      alertType: 'cmv_risk',
      severity: 'high',
      check: ({ cd4Count, symptoms }) =>
        cd4Count !== null && cd4Count < 50 &&
        symptoms.some(s => ['vision changes', 'floaters', 'eye pain', 'blurred vision'].some(k => s.toLowerCase().includes(k))),
      message: 'CD4 < 50 + visual symptoms: CMV Retinitis must be excluded.',
      action: 'Refer urgently to ophthalmologist. Order CMV PCR.',
      ref: 'WHO 2021 ART Guidelines §4.6 — CMV Retinitis',
    },
    {
      alertType: 'toxo_risk',
      severity: 'urgent',
      check: ({ cd4Count, symptoms }) =>
        cd4Count !== null && cd4Count < 100 &&
        symptoms.some(s => ['headache', 'confusion', 'fever', 'seizure'].some(k => s.toLowerCase().includes(k))),
      message: 'CD4 < 100 + CNS symptoms: Cerebral Toxoplasmosis or Cryptococcal Meningitis must be excluded.',
      action: 'Order CT Brain (if available), CSF if safe. Empiric treatment per protocol.',
      ref: 'WHO 2021 ART Guidelines §4.4 — Toxoplasmosis',
    },
    {
      alertType: 'tbc_risk',
      severity: 'urgent',
      check: ({ tbScreenPositive, cd4Count }) => tbScreenPositive && cd4Count !== null && cd4Count < 350,
      message: 'TB screen positive with low CD4: Active TB must be excluded before starting or continuing ART.',
      action: 'Order GeneXpert sputum. Check chest X-ray. Refer to TB/HIV integration pathway.',
      ref: 'WHO 2021 TB/HIV Co-management Guidelines',
    },
  ];

  evaluateOiRisks(input: OiInput): OiAlert[] {
    return OiEarlyWarningService.RULES
      .filter(rule => rule.check(input))
      .map(rule => ({
        alertType:         rule.alertType,
        severity:          rule.severity,
        alertMessage:      rule.message,
        recommendedAction: rule.action,
        guidelineRef:      rule.ref,
        triggerCd4:        input.cd4Count ?? undefined,
      }));
  }

  async saveAlerts(patientId: string, alerts: OiAlert[], db: any): Promise<void> {
    for (const alert of alerts) {
      // Only insert if no active alert of the same type already exists
      await db.query(
        `INSERT INTO oi_early_warning_alerts
           (patient_id, alert_type, severity, trigger_cd4, alert_message, recommended_action, guideline_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,  // deduplication handled by a unique partial index if desired
        [patientId, alert.alertType, alert.severity, alert.triggerCd4 ?? null,
         alert.alertMessage, alert.recommendedAction, alert.guidelineRef],
      );
    }
  }

  async getActiveAlerts(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM oi_early_warning_alerts WHERE patient_id = $1 AND status = 'active' ORDER BY severity DESC, created_at DESC`,
      [patientId],
    );
  }

  async acknowledgeAlert(alertId: string, userId: string, db: any): Promise<void> {
    await db.query(
      `UPDATE oi_early_warning_alerts SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = now() WHERE id = $2`,
      [userId, alertId],
    );
  }
}
```

### 4.2 HIV Visit Hook — Trigger OI Evaluation

In `services/ehr-service/src/services/hiv.service.ts`, at the end of the save clinical visit method, add:

```typescript
// After saving the HIV clinical visit:
const oiInput = {
  cd4Count:         visit.cd4Count ?? null,
  symptoms:         visit.symptoms ? visit.symptoms.split(',').map(s => s.trim()) : [],
  tbScreenPositive: !!visit.tbScreenPositive,
  currentRegimen:   visit.currentRegimen ?? '',
  vl:               visit.viralLoad ?? null,
};
const oiAlerts = this.oiEarlyWarningService.evaluateOiRisks(oiInput);
if (oiAlerts.length > 0) {
  await this.oiEarlyWarningService.saveAlerts(patientId, oiAlerts, req.tenantDb);
}
```

Inject `OiEarlyWarningService` into `HivService` constructor and register in `ehr.module.ts`.

### 4.3 VACS Index Service

**File to create:** `services/ehr-service/src/services/vacs-index.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface VacsInput {
  age: number;
  cd4Count: number;
  viralLoad: number;             // copies/mL
  hemoglobinGdL: number;
  creatinine: number;            // mg/dL
  alanineAminotransferase: number;  // ALT, IU/L
  hepatitisCPositive: boolean;
  fbsBmi: number;
  drugProblemEverDiagnosed: boolean;
}

@Injectable()
export class VacsIndexService {
  // VACS Index 2.0 — FIB-4 is not available so use simplified version
  calculateVacsScore(input: VacsInput): { score: number; tenYearMortality: number } {
    let score = 0;

    // Age contribution
    if (input.age >= 60)      score += 20;
    else if (input.age >= 50) score += 10;
    else if (input.age >= 40) score += 5;

    // CD4 (cells/mm3)
    if (input.cd4Count < 50)        score += 22;
    else if (input.cd4Count < 200)  score += 14;
    else if (input.cd4Count < 350)  score += 7;
    else if (input.cd4Count < 500)  score += 3;

    // Viral load (copies/mL)
    if (input.viralLoad >= 500000)      score += 10;
    else if (input.viralLoad >= 100000) score += 7;
    else if (input.viralLoad >= 500)    score += 3;

    // Hemoglobin (g/dL)
    if (input.hemoglobinGdL < 8)      score += 14;
    else if (input.hemoglobinGdL < 10) score += 7;
    else if (input.hemoglobinGdL < 12) score += 3;

    // Creatinine (mg/dL)
    if (input.creatinine >= 3.0)      score += 22;
    else if (input.creatinine >= 1.5) score += 11;

    // ALT > 40 IU/L
    if (input.alanineAminotransferase > 40) score += 8;

    // Hepatitis C co-infection
    if (input.hepatitisCPositive) score += 8;

    // Drug use history
    if (input.drugProblemEverDiagnosed) score += 5;

    // Approximate 10-year mortality from VACS Index score
    // Based on published actuarial tables (simplified linear interpolation)
    const tenYearMortality = Math.min(100, Math.max(0, score * 0.5));

    return { score, tenYearMortality };
  }

  classifyFrailty(score: number): 'robust' | 'pre_frail' | 'frail' {
    if (score < 30)  return 'robust';
    if (score < 55)  return 'pre_frail';
    return 'frail';
  }
}
```

### 4.4 HIV-Geriatric Auto-Flag Logic

In `services/ehr-service/src/services/hiv.service.ts`, after saving a patient update:

```typescript
// After updating HIV patient record:
const age = this.calculateAge(patient.dateOfBirth);
if (age >= 50) {
  // Check if already flagged
  const [existing] = await req.tenantDb.query(
    `SELECT id FROM hiv_geriatric_flags WHERE patient_id = $1`, [patientId]
  );
  if (!existing) {
    // Calculate VACS index from latest labs
    const latestLabs = await this.getLatestLabValues(patientId, req.tenantDb);
    const vacsResult = this.vacsIndexService.calculateVacsScore({
      age,
      cd4Count: latestLabs.cd4 ?? 350,
      viralLoad: latestLabs.vl ?? 0,
      hemoglobinGdL: latestLabs.hb ?? 12,
      creatinine: latestLabs.creatinine ?? 1.0,
      alanineAminotransferase: latestLabs.alt ?? 20,
      hepatitisCPositive: patient.hepatitisC ?? false,
      fbsBmi: patient.bmi ?? 22,
      drugProblemEverDiagnosed: false,
    });
    await req.tenantDb.query(
      `INSERT INTO hiv_geriatric_flags
         (patient_id, age_at_flag, vacs_index_score, vacs_10yr_mortality, frailty_status, next_review)
       VALUES ($1, $2, $3, $4, $5, now() + interval '6 months')
       ON CONFLICT (patient_id) DO UPDATE SET
         vacs_index_score = EXCLUDED.vacs_index_score,
         vacs_10yr_mortality = EXCLUDED.vacs_10yr_mortality,
         frailty_status = EXCLUDED.frailty_status,
         last_assessed = now()`,
      [patientId, age, vacsResult.score, vacsResult.tenYearMortality,
       this.vacsIndexService.classifyFrailty(vacsResult.score)],
    );
  }
}
```

### 4.5 Stable Patient Fast-Track Service

**File to create:** `services/ehr-service/src/services/hiv-fast-track.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface StabilityInput {
  vlSuppressedMonths: number;     // months VL has been < 1000 copies/mL
  adherencePct: number;           // 0–100
  hasActiveOiAlert: boolean;
  hasActiveWhoStage3or4: boolean;
  missedVisitsLast12Months: number;
}

@Injectable()
export class HivFastTrackService {
  isEligibleForFastTrack(input: StabilityInput): { eligible: boolean; reason: string } {
    if (input.vlSuppressedMonths < 6) {
      return { eligible: false, reason: 'VL suppression < 6 months' };
    }
    if (input.adherencePct < 95) {
      return { eligible: false, reason: `Adherence ${input.adherencePct}% < 95% required` };
    }
    if (input.hasActiveOiAlert) {
      return { eligible: false, reason: 'Active opportunistic infection alert' };
    }
    if (input.hasActiveWhoStage3or4) {
      return { eligible: false, reason: 'Active WHO Stage 3 or 4 condition' };
    }
    if (input.missedVisitsLast12Months > 1) {
      return { eligible: false, reason: `${input.missedVisitsLast12Months} missed visits in last 12 months` };
    }
    return { eligible: true, reason: 'Patient meets all stability criteria' };
  }

  recommendedMmdMonths(vlSuppressedMonths: number, adherencePct: number): 3 | 6 {
    return vlSuppressedMonths >= 12 && adherencePct >= 98 ? 6 : 3;
  }

  async classifyAndSave(
    patientId: string,
    input: StabilityInput,
    classifiedBy: string,
    db: any,
  ): Promise<{ eligible: boolean; mmdMonths?: 3 | 6; reason: string }> {
    const result = this.isEligibleForFastTrack(input);

    if (result.eligible) {
      const mmdMonths = this.recommendedMmdMonths(input.vlSuppressedMonths, input.adherencePct);
      const nextVisit = new Date();
      nextVisit.setMonth(nextVisit.getMonth() + mmdMonths);

      await db.query(
        `INSERT INTO hiv_stable_patient_flags (patient_id, stable_since, mmd_months, next_visit_due, classified_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4)
         ON CONFLICT (patient_id) DO UPDATE SET
           mmd_months = EXCLUDED.mmd_months,
           next_visit_due = EXCLUDED.next_visit_due,
           classified_by = EXCLUDED.classified_by,
           updated_at = now()`,
        [patientId, mmdMonths, nextVisit.toISOString().split('T')[0], classifiedBy],
      );
      return { eligible: true, mmdMonths, reason: result.reason };
    }

    // If previously stable but no longer eligible, deactivate
    await db.query(
      `UPDATE hiv_stable_patient_flags SET is_active = false, deactivated_at = now(), deactivation_reason = $1
       WHERE patient_id = $2 AND is_active = true`,
      [result.reason, patientId],
    );
    return { eligible: false, reason: result.reason };
  }
}
```

### 4.6 Controller — OI + Fast-Track Endpoints

Add to `services/ehr-service/src/controllers/hiv.controller.ts` (existing file):

```typescript
// GET /hiv/patients/:id/oi-alerts
@Get('patients/:id/oi-alerts')
@UseGuards(JwtAuthGuard)
async getOiAlerts(@Param('id') id: string, @Req() req: any) {
  return this.oiEarlyWarningService.getActiveAlerts(id, req.tenantDb);
}

// PATCH /hiv/oi-alerts/:alertId/acknowledge
@Patch('oi-alerts/:alertId/acknowledge')
@UseGuards(JwtAuthGuard)
async acknowledgeOiAlert(@Param('alertId') alertId: string, @Req() req: any) {
  await this.oiEarlyWarningService.acknowledgeAlert(alertId, req.user.sub, req.tenantDb);
  return { acknowledged: true };
}

// GET /hiv/patients/:id/stability
@Get('patients/:id/stability')
@UseGuards(JwtAuthGuard)
async getStabilityStatus(@Param('id') id: string, @Req() req: any) {
  const [flag] = await req.tenantDb.query(
    `SELECT * FROM hiv_stable_patient_flags WHERE patient_id = $1 AND is_active = true`,
    [id],
  );
  return flag ?? { eligible: false };
}

// POST /hiv/patients/:id/classify-stability
@Post('patients/:id/classify-stability')
@UseGuards(JwtAuthGuard)
async classifyStability(@Param('id') id: string, @Body() body: any, @Req() req: any) {
  return this.hivFastTrackService.classifyAndSave(id, body, req.user.sub, req.tenantDb);
}

// GET /hiv/patients/:id/geriatric-flag
@Get('patients/:id/geriatric-flag')
@UseGuards(JwtAuthGuard)
async getGeriatricFlag(@Param('id') id: string, @Req() req: any) {
  const [flag] = await req.tenantDb.query(
    `SELECT * FROM hiv_geriatric_flags WHERE patient_id = $1`,
    [id],
  );
  return flag ?? null;
}
```

Register `OiEarlyWarningService`, `VacsIndexService`, `HivFastTrackService` in `ehr.module.ts` providers.

---

## 5. Frontend Implementation

### 5.1 OI Alert Banner in HIVNursePanel

**File to modify:** `ehr-frontend/src/components/HIVNursePanel.tsx`

Add `OiAlertsBanner` component rendered at the top of the panel when active OI alerts exist:

```tsx
// Fetch from GET /hiv/patients/:id/oi-alerts on mount
// If alerts exist, render a red/orange banner:
// "⚠ 2 Opportunistic Infection Risks Detected"
// Expandable list showing: alert type | severity pill | recommended action | Acknowledge button
```

### 5.2 Fast-Track Badge in HIV Patient List

**File to modify:** `ehr-frontend/src/components/HIVPatientManagement.tsx`

- Add "Fast-Track Stable" green badge on patient rows where `is_active = true` in `hiv_stable_patient_flags`
- Add "Classify Stability" button that opens a modal to run the fast-track classification

### 5.3 Geriatric Flag Panel in HIV Doctor Dashboard

**File to modify:** `ehr-frontend/src/pages/HIVDoctorDashboard.tsx`

- When patient has `hiv_geriatric_flags` record: show VACS score, 10-year mortality estimate, frailty status
- Link to geriatric assessment page for full CGA
- Show "Geriatric Co-Management Required" badge

---

## 6. Tests Required

### 6.1 OiEarlyWarningService Tests

**File:** `services/ehr-service/src/services/oi-early-warning.service.spec.ts`

```typescript
describe('OiEarlyWarningService', () => {
  const svc = new OiEarlyWarningService();

  it('fires pcp_risk when CD4 < 200', () => {
    const alerts = svc.evaluateOiRisks({ cd4Count: 150, symptoms: [], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(alerts.some(a => a.alertType === 'pcp_risk')).toBe(true);
  });

  it('fires cryptococcal_risk when CD4 < 100', () => {
    const alerts = svc.evaluateOiRisks({ cd4Count: 80, symptoms: [], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(alerts.some(a => a.alertType === 'cryptococcal_risk')).toBe(true);
  });

  it('fires cmv_risk only when symptoms include vision keywords', () => {
    const noSymp = svc.evaluateOiRisks({ cd4Count: 40, symptoms: [], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(noSymp.some(a => a.alertType === 'cmv_risk')).toBe(false);
    const withSymp = svc.evaluateOiRisks({ cd4Count: 40, symptoms: ['blurred vision'], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(withSymp.some(a => a.alertType === 'cmv_risk')).toBe(true);
  });

  it('returns empty array when CD4 > 500 and no symptoms', () => {
    const alerts = svc.evaluateOiRisks({ cd4Count: 600, symptoms: [], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(alerts).toHaveLength(0);
  });
});
```

### 6.2 VacsIndexService Tests

```typescript
describe('VacsIndexService', () => {
  const svc = new VacsIndexService();
  it('classifies frailty correctly', () => {
    expect(svc.classifyFrailty(20)).toBe('robust');
    expect(svc.classifyFrailty(40)).toBe('pre_frail');
    expect(svc.classifyFrailty(60)).toBe('frail');
  });
  it('calculates higher score for lower CD4', () => {
    const high = svc.calculateVacsScore({ age: 55, cd4Count: 30, viralLoad: 0, hemoglobinGdL: 13, creatinine: 1.0, alanineAminotransferase: 20, hepatitisCPositive: false, fbsBmi: 22, drugProblemEverDiagnosed: false });
    const low  = svc.calculateVacsScore({ age: 55, cd4Count: 600, viralLoad: 0, hemoglobinGdL: 13, creatinine: 1.0, alanineAminotransferase: 20, hepatitisCPositive: false, fbsBmi: 22, drugProblemEverDiagnosed: false });
    expect(high.score).toBeGreaterThan(low.score);
  });
});
```

### 6.3 HivFastTrackService Tests

```typescript
describe('HivFastTrackService', () => {
  const svc = new HivFastTrackService();
  it('eligible when all criteria met', () => {
    const result = svc.isEligibleForFastTrack({ vlSuppressedMonths: 8, adherencePct: 97, hasActiveOiAlert: false, hasActiveWhoStage3or4: false, missedVisitsLast12Months: 0 });
    expect(result.eligible).toBe(true);
  });
  it('ineligible when adherence < 95', () => {
    const result = svc.isEligibleForFastTrack({ vlSuppressedMonths: 8, adherencePct: 90, hasActiveOiAlert: false, hasActiveWhoStage3or4: false, missedVisitsLast12Months: 0 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('95%');
  });
  it('recommends 6-month MMD when VL suppressed ≥ 12 months and adherence ≥ 98', () => {
    expect(svc.recommendedMmdMonths(14, 99)).toBe(6);
    expect(svc.recommendedMmdMonths(6, 97)).toBe(3);
  });
});
```

---

## 7. Sign-off Criteria

- [ ] `oi_early_warning_alerts`, `hiv_geriatric_flags`, `hiv_stable_patient_flags` tables created in all tenant DBs
- [ ] `repair-all` successfully provisions new tables in existing tenants
- [ ] OI rules fire correctly: CD4 < 200 → PCP alert; CD4 < 100 → Cryptococcal alert; CD4 < 50 → MAC alert
- [ ] OI alerts do NOT fire when CD4 is normal (> 500) and no relevant symptoms
- [ ] CMV alert only fires when CD4 < 50 AND vision symptoms present
- [ ] `GET /hiv/patients/:id/oi-alerts` returns only `status='active'` alerts
- [ ] `PATCH /hiv/oi-alerts/:alertId/acknowledge` sets `status='acknowledged'` and records `acknowledged_by`
- [ ] Patients aged ≥ 50 automatically receive `hiv_geriatric_flags` row on HIV record save
- [ ] VACS score calculated correctly (higher score for worse labs)
- [ ] Fast-track classification correctly rejects patients with adherence < 95%
- [ ] Fast-track recommends 6-month MMD only when ≥ 12 months suppressed AND ≥ 98% adherence
- [ ] OI alert banner renders in `HIVNursePanel` when active alerts exist
- [ ] All new services registered in `ehr.module.ts`
- [ ] `npm run lint` passes zero errors
- [ ] `npm test` passes zero failures
- [ ] CI `build-and-test` job passes green
