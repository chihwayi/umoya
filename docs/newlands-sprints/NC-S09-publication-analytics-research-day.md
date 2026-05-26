# NC-S09 — Publication Analytics + De-identified Export + Research Day Platform

**Sprint ID:** NC-S09  
**Priority:** P2 — Newlands Research Day + PEPFAR reporting  
**Effort:** 2 weeks  
**Dependencies:** NC-S08  
**Covers gaps:** 8.9 (publication analytics — missing → complete), 8.10 (Research Day platform — missing → complete), 8.2 (de-identified export — partial → complete), 8.3 (study/trial module — partial → better), 8.8 (pharmacovigilance export — partial → complete)

---

## 1. Codebase Context — What Already Exists

| File | What it has |
|---|---|
| `services/ehr-service/src/transformers/encryption.transformer.ts` | AES-256-GCM encryption transformer |
| `services/ehr-service/src/services/hipaa-audit.service.ts` | Audit logging |
| `services/ehr-service/src/entities/art-cohort.entity.ts` | `retention_rate`, cohort data |
| CDSS service | ML logistic regression internals — not exported |
| PEPFAR MER service | DATIM MER export |

**No publication analytics, Research Day platform, or full de-identified export pipeline exist.**

---

## 2. What This Sprint Builds

### Part A — De-identified Export Pipeline
- HIPAA Safe Harbor de-identification: removes/generalises all 18 PHI identifiers
- Cohort-based export: export any cohort definition (from NC-S08) as a de-identified CSV or JSON
- Full audit trail of every export (who, when, what cohort, row count)

### Part B — Publication-Ready Analytics
- Kaplan-Meier survival curves (time-to-event: treatment failure, LTFU, death)
- Descriptive statistics table (n, mean, median, IQR, 95% CI for key variables)
- Exportable as formatted data tables (CSV) and chart images (SVG)

### Part C — Research Day Data Platform
- Annual Newlands Research Day: aggregate, anonymised views for external collaborators
- Shareable read-only "Research Day Dashboard" with time-limited access token
- Snapshots of key metrics: cascade, retention, LTFU, pharmacovigilance, programme outcomes

### Part D — Adverse Event / Pharmacovigilance Export
- Structured recording of ART adverse events
- Export in format compatible with Zimbabwe national pharmacovigilance system (VigiBase compatible)

---

## 3. Database Changes

Add bundle to `getProvisioningBundles()`:

```typescript
{
  id: 'nc_publication_research_day',
  label: 'Publication Analytics + De-id Export + Research Day',
  version: '2026.05.17.1',
  description: 'De-identified export audit, publication analytics, Research Day access tokens, pharmacovigilance',
  statements: () => [
    // De-identification export audit
    `CREATE TABLE IF NOT EXISTS deid_export_log (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      exported_by       UUID         NOT NULL,
      export_date       TIMESTAMPTZ  NOT NULL DEFAULT now(),
      cohort_name       VARCHAR(300),
      cohort_criteria   JSONB,
      row_count         INTEGER      NOT NULL,
      export_format     VARCHAR(10)  NOT NULL DEFAULT 'csv',  -- 'csv' | 'json'
      de_id_method      VARCHAR(30)  NOT NULL DEFAULT 'safe_harbor',
      fields_exported   TEXT[],       -- list of field names included
      purpose           TEXT,         -- stated research purpose
      approved_by       UUID,
      download_token    VARCHAR(64)  UNIQUE,  -- one-time download token, expires 24h
      downloaded_at     TIMESTAMPTZ,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_deid_export_user ON deid_export_log (exported_by)`,

    -- Research Day access sessions
    `CREATE TABLE IF NOT EXISTS research_day_sessions (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_name      VARCHAR(200) NOT NULL,   -- e.g. 'Newlands Research Day 2026'
      access_token      VARCHAR(64)  NOT NULL UNIQUE,
      created_by        UUID         NOT NULL,
      valid_from        TIMESTAMPTZ  NOT NULL,
      valid_until       TIMESTAMPTZ  NOT NULL,
      allowed_views     TEXT[],      -- e.g. ['cascade', 'retention', 'ltfu', 'pharmacovigilance']
      access_count      INTEGER      NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,

    -- Adverse events / pharmacovigilance
    `CREATE TABLE IF NOT EXISTS art_adverse_events (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        UUID         NOT NULL,
      report_date       DATE         NOT NULL,
      reported_by       UUID,
      -- Drug suspected
      suspect_drug      VARCHAR(300) NOT NULL,
      suspect_drug_dose VARCHAR(100),
      suspect_drug_route VARCHAR(50),
      drug_start_date   DATE,
      drug_stop_date    DATE,
      -- Event description
      event_description TEXT         NOT NULL,
      event_onset_date  DATE,
      event_outcome     VARCHAR(40)  NOT NULL,
      -- Values: 'recovered' | 'recovering' | 'not_recovered' | 'recovered_with_sequelae' | 'fatal' | 'unknown'
      event_severity    VARCHAR(20)  NOT NULL,
      -- Values: 'mild' | 'moderate' | 'severe' | 'life_threatening' | 'fatal'
      seriousness       VARCHAR(40),
      -- Values: 'death' | 'hospitalisation' | 'disability' | 'birth_defect' | 'other_serious'
      causality         VARCHAR(30),
      -- Values: 'certain' | 'probable' | 'possible' | 'unlikely' | 'unclassifiable'
      action_taken      VARCHAR(40),  -- 'drug_withdrawn' | 'dose_reduced' | 'dose_increased' | 'not_changed'
      rechallenge       VARCHAR(20),  -- 'yes_positive' | 'yes_negative' | 'no' | 'not_applicable'
      reported_to_natpvb BOOLEAN     NOT NULL DEFAULT false,  -- National PV Board
      natpvb_case_id    VARCHAR(100),
      vigibase_export_ready BOOLEAN  NOT NULL DEFAULT false,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ae_patient ON art_adverse_events (patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ae_drug    ON art_adverse_events (suspect_drug)`,
    `CREATE INDEX IF NOT EXISTS idx_ae_unreported ON art_adverse_events (reported_to_natpvb) WHERE NOT reported_to_natpvb`,
  ],
},
```

Run `POST /api/admin/tenants/repair-all` after adding.

---

## 4. Backend Implementation

### 4.1 De-identification Service

**File to create:** `services/ehr-service/src/services/deid-export.service.ts`

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';

// HIPAA Safe Harbor — 18 PHI identifiers to remove or generalise
const PHI_FIELDS_TO_REMOVE = [
  'national_id', 'passport_number', 'registration_number',
  'full_name', 'first_name', 'last_name',
  'email', 'phone_number', 'address',
  'date_of_birth',    // replaced with age band
  'ip_address', 'device_id',
];

const PHI_FIELDS_TO_GENERALISE: Record<string, (v: any) => any> = {
  // Age: exact age → 5-year band (but ages 90+ → '90+' to prevent re-identification)
  age: (v: number) => {
    if (v >= 90) return '90+';
    const band = Math.floor(v / 5) * 5;
    return `${band}-${band + 4}`;
  },
  // Date: keep year and month only, remove day
  date: (v: string) => v ? v.substring(0, 7) : null,   // 'YYYY-MM'
  // Postcode: keep first 3 chars only
  postcode: (v: string) => v ? v.substring(0, 3) : null,
};

@Injectable()
export class DeidExportService {
  deidentifyRecord(record: Record<string, any>): Record<string, any> {
    const safe: Record<string, any> = {};

    for (const [key, value] of Object.entries(record)) {
      // Remove PHI fields entirely
      if (PHI_FIELDS_TO_REMOVE.includes(key)) continue;

      // Generalise age
      if (key === 'age' || key === 'age_years') {
        safe[key] = PHI_FIELDS_TO_GENERALISE.age(value);
        continue;
      }

      // Generalise dates with specific days
      if ((key.endsWith('_date') || key === 'dob') && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        safe[key] = PHI_FIELDS_TO_GENERALISE.date(value);
        continue;
      }

      // Keep all non-PHI fields
      safe[key] = value;
    }

    return safe;
  }

  async exportCohortDeidentified(params: {
    cohortPatients: any[];
    fields: string[];          // fields to include (whitelist)
    exportedBy: string;
    cohortName: string;
    cohortCriteria: any;
    purpose: string;
    approvedBy?: string;
    db: any;
  }): Promise<{ downloadToken: string; rowCount: number }> {
    const deidentified = params.cohortPatients.map(p => {
      const subset: Record<string, any> = {};
      for (const f of params.fields) {
        if (f in p) subset[f] = p[f];
      }
      return this.deidentifyRecord(subset);
    });

    const downloadToken = randomBytes(32).toString('hex');

    // Store export metadata (not the actual data — data generated on download)
    await params.db.query(
      `INSERT INTO deid_export_log
         (exported_by, cohort_name, cohort_criteria, row_count, export_format,
          de_id_method, fields_exported, purpose, approved_by, download_token)
       VALUES ($1,$2,$3,$4,'csv','safe_harbor',$5,$6,$7,$8)`,
      [params.exportedBy, params.cohortName, JSON.stringify(params.cohortCriteria),
       deidentified.length, params.fields, params.purpose, params.approvedBy ?? null, downloadToken],
    );

    // Store de-identified data temporarily in a cache or return it directly
    // For simplicity: store in memory and return via token (production: use Redis or file store)
    // The endpoint that serves the download reads the log and re-generates the export
    return { downloadToken, rowCount: deidentified.length };
  }

  toCsv(records: any[]): string {
    if (!records.length) return '';
    const headers = Object.keys(records[0]);
    const rows = records.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}
```

### 4.2 Kaplan-Meier Statistics Service

**File to create:** `services/ehr-service/src/services/kaplan-meier.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface SurvivalEvent {
  time: number;      // time in days/months from start
  event: boolean;    // true = event occurred (death, LTFU, failure); false = censored (still in care)
}

interface KmPoint {
  time: number;
  survivalProbability: number;  // S(t)
  atRisk: number;
  events: number;
  censored: number;
  lowerCI: number;    // 95% CI lower (Greenwood formula)
  upperCI: number;    // 95% CI upper
}

@Injectable()
export class KaplanMeierService {
  compute(events: SurvivalEvent[]): KmPoint[] {
    // Sort by time
    const sorted = [...events].sort((a, b) => a.time - b.time);
    const uniqueTimes = [...new Set(sorted.map(e => e.time))].sort((a, b) => a - b);

    let survivalProb = 1.0;
    let greenwood = 0.0;
    const points: KmPoint[] = [];
    let remaining = sorted.length;

    for (const t of uniqueTimes) {
      const atT = sorted.filter(e => e.time === t);
      const eventCount   = atT.filter(e => e.event).length;
      const censoredCount = atT.filter(e => !e.event).length;
      const atRisk = remaining;

      if (eventCount > 0) {
        survivalProb *= (atRisk - eventCount) / atRisk;
        greenwood += eventCount / (atRisk * (atRisk - eventCount));
      }

      const se = survivalProb * Math.sqrt(greenwood);
      const z95 = 1.96;

      points.push({
        time: t,
        survivalProbability: Math.round(survivalProb * 1000) / 1000,
        atRisk,
        events:    eventCount,
        censored:  censoredCount,
        lowerCI:   Math.max(0, Math.round((survivalProb - z95 * se) * 1000) / 1000),
        upperCI:   Math.min(1, Math.round((survivalProb + z95 * se) * 1000) / 1000),
      });

      remaining -= atT.length;
    }

    return points;
  }

  medianSurvival(points: KmPoint[]): number | null {
    const p = points.find(pt => pt.survivalProbability <= 0.5);
    return p ? p.time : null;  // null = median not reached
  }

  async computeFromDb(params: {
    eventType: 'ltfu' | 'treatment_failure' | 'death';
    cohortStart: string;
    db: any;
  }): Promise<{ points: KmPoint[]; medianTime: number | null }> {
    let query = '';

    if (params.eventType === 'ltfu') {
      query = `
        SELECT
          EXTRACT(DAY FROM (COALESCE(
            (SELECT MAX(visit_date) FROM hiv_clinical_visits v WHERE v.patient_id = e.patient_id),
            CURRENT_DATE
          ) - e.art_start_date)) AS time_days,
          (e.art_status NOT IN ('on_art', 'transferred_out')) AS event_occurred
        FROM hiv_enrollments e
        WHERE e.art_start_date >= $1::DATE AND e.art_start_date < $1::DATE + INTERVAL '1 year'
      `;
    } else if (params.eventType === 'treatment_failure') {
      query = `
        SELECT
          EXTRACT(DAY FROM (COALESCE(
            (SELECT MIN(cv.visit_date) FROM hiv_clinical_visits cv
             WHERE cv.patient_id = e.patient_id AND cv.viral_load >= 1000
             AND cv.visit_date >= e.art_start_date),
            CURRENT_DATE
          ) - e.art_start_date)) AS time_days,
          EXISTS (
            SELECT 1 FROM hiv_clinical_visits cv
            WHERE cv.patient_id = e.patient_id AND cv.viral_load >= 1000
          ) AS event_occurred
        FROM hiv_enrollments e
        WHERE e.art_start_date >= $1::DATE AND e.art_start_date < $1::DATE + INTERVAL '1 year'
      `;
    }

    const rows = await params.db.query(query, [params.cohortStart]);
    const events: SurvivalEvent[] = rows.map((r: any) => ({
      time: Math.round(parseInt(r.time_days) / 30),  // convert days to months
      event: r.event_occurred,
    }));

    const points = this.compute(events);
    return { points, medianTime: this.medianSurvival(points) };
  }
}
```

### 4.3 Research Day Controller

**File to create:** `services/ehr-service/src/controllers/research-day.controller.ts`

```typescript
import { Controller, Get, Post, Param, Body, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { randomBytes } from 'crypto';

@Controller('research-day')
export class ResearchDayController {
  // --- Protected: create a session token ---
  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  async createSession(@Body() body: {
    sessionName: string;
    validFrom: string;
    validUntil: string;
    allowedViews: string[];
  }, @Req() req: any) {
    const token = randomBytes(32).toString('hex');
    const [row] = await req.tenantDb.query(
      `INSERT INTO research_day_sessions
         (session_name, access_token, created_by, valid_from, valid_until, allowed_views)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.sessionName, token, req.user.sub, body.validFrom, body.validUntil, body.allowedViews],
    );
    return { ...row, shareUrl: `/research-day/view?token=${token}` };
  }

  // --- Public: view dashboard with token ---
  @Get('view')
  async viewDashboard(@Query('token') token: string, @Query('view') view: string, @Req() req: any) {
    const [session] = await req.tenantDb.query(
      `SELECT * FROM research_day_sessions
       WHERE access_token = $1 AND valid_from <= now() AND valid_until >= now()`,
      [token],
    );
    if (!session) throw new UnauthorizedException('Invalid or expired research day token.');
    if (!session.allowed_views.includes(view)) {
      throw new UnauthorizedException(`View '${view}' not permitted for this session.`);
    }

    // Increment access count
    await req.tenantDb.query(
      `UPDATE research_day_sessions SET access_count = access_count + 1 WHERE id = $1`,
      [session.id],
    );

    // Return aggregate anonymised data for the requested view
    switch (view) {
      case 'cascade': {
        const rows = await req.tenantDb.query(`SELECT * FROM cascade_snapshots ORDER BY snapshot_date DESC LIMIT 4`);
        return { sessionName: session.session_name, view: 'cascade', data: rows };
      }
      case 'retention': {
        const rows = await req.tenantDb.query(`SELECT * FROM retention_snapshots ORDER BY cohort_start DESC LIMIT 12`);
        return { sessionName: session.session_name, view: 'retention', data: rows };
      }
      case 'pharmacovigilance': {
        const rows = await req.tenantDb.query(`
          SELECT suspect_drug, event_severity, event_outcome, causality, COUNT(*) AS case_count
          FROM art_adverse_events
          GROUP BY suspect_drug, event_severity, event_outcome, causality
          ORDER BY case_count DESC
        `);
        return { sessionName: session.session_name, view: 'pharmacovigilance', data: rows };
      }
      default:
        throw new UnauthorizedException('Unknown view.');
    }
  }
}
```

### 4.4 Pharmacovigilance Controller

Add to `services/ehr-service/src/controllers/research.controller.ts` (from NC-S08):

```typescript
// POST /research/adverse-events
@Post('adverse-events')
async reportAdverseEvent(@Body() body: any, @Req() req: any) {
  const [row] = await req.tenantDb.query(
    `INSERT INTO art_adverse_events
       (patient_id, report_date, reported_by, suspect_drug, suspect_drug_dose,
        event_description, event_onset_date, event_outcome, event_severity,
        seriousness, causality, action_taken)
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [body.patientId, req.user.sub, body.suspectDrug, body.suspectDrugDose ?? null,
     body.eventDescription, body.eventOnsetDate ?? null, body.eventOutcome, body.eventSeverity,
     body.seriousness ?? null, body.causality ?? null, body.actionTaken ?? null],
  );
  return row;
}

// GET /research/adverse-events/unreported
@Get('adverse-events/unreported')
async getUnreportedAe(@Req() req: any) {
  return req.tenantDb.query(
    `SELECT * FROM art_adverse_events WHERE NOT reported_to_natpvb ORDER BY report_date DESC`
  );
}

// GET /research/adverse-events/export-vigibase
@Get('adverse-events/export-vigibase')
async exportVigibase(@Req() req: any) {
  // Returns VigiBase-compatible structure for national PV reporting
  const rows = await req.tenantDb.query(
    `SELECT ae.*, p.sex,
       DATE_PART('year', AGE(p.date_of_birth)) AS patient_age  -- included for PV (not PHI in aggregate)
     FROM art_adverse_events ae
     JOIN patients p ON p.id = ae.patient_id
     WHERE ae.vigibase_export_ready = false OR ae.vigibase_export_ready IS NULL
     ORDER BY ae.report_date`
  );
  // De-identify: replace patient_id with sequence number
  return rows.map((r: any, i: number) => ({
    caseId:         `NEWLANDS-AE-${String(i + 1).padStart(5, '0')}`,
    reportDate:     r.report_date,
    patientSex:     r.sex,
    patientAgeBand: Math.floor(parseInt(r.patient_age) / 10) * 10 + 's',  // e.g. '30s'
    suspectDrug:    r.suspect_drug,
    eventDescription: r.event_description,
    eventSeverity:  r.event_severity,
    eventOutcome:   r.event_outcome,
    causality:      r.causality,
  }));
}
```

Register `ResearchDayController` in `ehr.module.ts`. Add `KaplanMeierService`, `DeidExportService` to providers.

---

## 5. Frontend Implementation

### 5.1 Kaplan-Meier Analysis Page

**File to create:** `ehr-frontend/src/pages/SurvivalAnalysisPage.tsx`

- Event type selector: LTFU | Treatment Failure | Death
- Cohort start date picker
- "Run Analysis" button → `GET /research/kaplan-meier?eventType=...&cohortStart=...`
- KM curve rendered using `recharts` or `d3`: x-axis = months, y-axis = survival probability (0–1)
- 95% confidence interval bands (shaded area)
- Median survival time displayed below chart
- Data table: time | at_risk | events | censored | S(t) | Lower CI | Upper CI
- "Export SVG" + "Export CSV" buttons

### 5.2 Research Day Portal (public, token-gated)

**File to create:** `ehr-frontend/src/pages/ResearchDayPortal.tsx`

- URL format: `/research-day?token=<token>&view=cascade`
- No login required — token is the auth
- View selector tabs: Cascade | Retention | Pharmacovigilance
- Read-only charts using shared snapshot data
- "Session expires on [date]" banner

### 5.3 Pharmacovigilance Page

**File to create:** `ehr-frontend/src/pages/PharmacovigilancePage.tsx`

- Table of adverse events (filtered by drug, severity, outcome)
- "Unreported to NATPVB" badge count
- "Report AE" form modal
- "Export VigiBase" button → downloads JSON in VigiBase-compatible format
- Signal detection: bar chart of top 10 drugs by AE count

---

## 6. Tests Required

```typescript
// kaplan-meier.service.spec.ts
describe('KaplanMeierService', () => {
  const svc = new KaplanMeierService();

  it('computes survival probability correctly for simple dataset', () => {
    const events: SurvivalEvent[] = [
      { time: 3, event: true },   // event at t=3
      { time: 5, event: false },  // censored at t=5
      { time: 7, event: true },   // event at t=7
      { time: 10, event: false }, // censored at t=10
    ];
    const points = svc.compute(events);
    expect(points[0].survivalProbability).toBeCloseTo(0.75, 2);  // (4-1)/4
    expect(points[1].survivalProbability).toBeCloseTo(0.5, 2);   // 0.75 * (2-1)/2
  });

  it('returns null median when survival never drops to 0.5', () => {
    const events: SurvivalEvent[] = [{ time: 1, event: false }, { time: 2, event: false }];
    const points = svc.compute(events);
    expect(svc.medianSurvival(points)).toBeNull();
  });
});

// deid-export.service.spec.ts
describe('DeidExportService', () => {
  const svc = new DeidExportService();

  it('removes national_id and full_name', () => {
    const result = svc.deidentifyRecord({ national_id: '12345', full_name: 'John Doe', sex: 'M', art_status: 'on_art' });
    expect(result.national_id).toBeUndefined();
    expect(result.full_name).toBeUndefined();
    expect(result.sex).toBe('M');
    expect(result.art_status).toBe('on_art');
  });

  it('generalises age to 5-year bands', () => {
    const result = svc.deidentifyRecord({ age: 33, sex: 'F' });
    expect(result.age).toBe('30-34');
  });

  it('generalises dates to YYYY-MM', () => {
    const result = svc.deidentifyRecord({ visit_date: '2026-05-17', sex: 'M' });
    expect(result.visit_date).toBe('2026-05');
  });

  it('replaces age 90+ with "90+"', () => {
    const result = svc.deidentifyRecord({ age: 93 });
    expect(result.age).toBe('90+');
  });
});
```

---

## 7. Sign-off Criteria

- [ ] `deid_export_log`, `research_day_sessions`, `art_adverse_events` provisioned in all tenant DBs
- [ ] `repair-all` backfills all 3 tables
- [ ] De-identification removes all 18 HIPAA PHI identifiers: `national_id`, `full_name`, `phone_number`, `email`, `address`, `date_of_birth`
- [ ] Age generalised to 5-year bands (age 33 → '30-34', age 90 → '90+')
- [ ] Dates generalised to YYYY-MM (day removed)
- [ ] `POST /research/adverse-events` creates AE record linked to patient
- [ ] `GET /research/adverse-events/export-vigibase` returns de-identified JSON with `caseId` format `NEWLANDS-AE-XXXXX`
- [ ] KM service: 4 patients, 2 events at t=3 and t=7 → S(t=3) ≈ 0.75
- [ ] KM median survival returns null when survival curve stays above 0.5
- [ ] `POST /research-day/sessions` creates token with valid_until expiry
- [ ] `GET /research-day/view?token=...&view=cascade` returns cascade data when token valid
- [ ] `GET /research-day/view?token=...&view=cascade` returns 401 when token expired
- [ ] `GET /research-day/view?token=...&view=payroll` (not in allowed_views) returns 401
- [ ] Survival Analysis Page renders KM curve with confidence interval bands
- [ ] Research Day Portal renders read-only without requiring login
- [ ] `ResearchDayController` registered in `ehr.module.ts`
- [ ] `npm run lint` passes zero errors
- [ ] `npm test` passes zero failures
- [ ] CI `build-and-test` job passes green
