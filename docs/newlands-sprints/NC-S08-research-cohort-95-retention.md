# NC-S08 — Research Platform: 95-95-95 Dashboard + Retention + Cohort Builder

**Sprint ID:** NC-S08  
**Priority:** P2 — PEPFAR/UNAIDS reporting obligation  
**Effort:** 2 weeks  
**Dependencies:** NC-S04  
**Covers gaps:** 8.7 (95-95-95 — partial → complete), 8.6 (retention — partial → complete), 8.1 (cohort builder — 30% → 90%)

---

## 1. Codebase Context — What Already Exists

| File | What it has |
|---|---|
| `services/ehr-service/src/entities/art-cohort.entity.ts` | `art_cohort` table: `cohortStartDate`, `retentionRate`, `aliveOnArt12m`, `lostToFollowup12m` — 12-month only |
| `services/ehr-service/src/services/hiv-quality-metrics.service.ts` | Calculates retention for given timeframe; `retentionRate = (total_retained / total_enrolled) * 100` |
| `services/ehr-service/src/controllers/pepfar-mer.controller.ts` | `POST/GET/PATCH /hiv/mer/cohort` — PEPFAR MER cohort API |
| `ehr-frontend/src/components/HIVCohortAnalysis.tsx` | Line chart showing retention by cohort; hardcoded 6/12/24-month types |

**What's missing:**
- No unified 95-95-95 composite dashboard with cascade visualization
- No disaggregation by age, sex, regimen
- No dynamic LTFU definition (>3 months without visit)
- No re-engagement tracking
- No no-code cohort builder UI — backend API only
- 95-95-95 targets are not explicitly tracked

---

## 2. What This Sprint Builds

### Part A — 95-95-95 Dashboard
- Cascade visualization: Diagnosed → On ART → Virally Suppressed
- With targets: 95% diagnosed, 95% of those on ART, 95% of those suppressed
- Disaggregated by sex (M/F), age band (<15, 15–24, 25–49, 50+), regimen line

### Part B — Retention in Care (6/12/24-month)
- Standard WHO/PEPFAR retention calculations
- LTFU definition: patient has not attended in >90 days past expected visit date
- Re-engagement tracking (LTFU patient returns to care)

### Part C — No-Code Cohort Builder
- Frontend UI to define custom patient cohorts by any combination of criteria
- Save/name cohort definitions for reuse
- Export cohort patient list to CSV

---

## 3. Database Changes

Add bundle to `getProvisioningBundles()`:

```typescript
{
  id: 'nc_research_platform',
  label: '95-95-95 Dashboard + Retention + Cohort Builder',
  version: '2026.05.17.1',
  description: 'UNAIDS 95-95-95 snapshots, retention metrics, cohort definition storage',
  statements: () => [
    // 95-95-95 periodic snapshots (run quarterly/monthly by cron)
    `CREATE TABLE IF NOT EXISTS cascade_snapshots (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      snapshot_date         DATE         NOT NULL,
      period_label          VARCHAR(40),       -- e.g. 'Q1 2026'
      -- Aggregate counts
      total_plhiv_estimated INTEGER,           -- from DHIS2 / national estimates
      diagnosed_count       INTEGER  NOT NULL, -- known HIV+, registered in system
      on_art_count          INTEGER  NOT NULL, -- currently on ART (active regimen)
      suppressed_count      INTEGER  NOT NULL, -- VL < 1000 copies/mL, last 12 months
      -- Calculated percentages
      first_95              NUMERIC(5,2),      -- diagnosed / total_plhiv_estimated
      second_95             NUMERIC(5,2),      -- on_art / diagnosed
      third_95              NUMERIC(5,2),      -- suppressed / on_art
      -- Disaggregated breakdowns stored as JSONB
      by_sex                JSONB,             -- { M: {diagnosed, on_art, suppressed}, F: {...} }
      by_age_band           JSONB,             -- { '<15': {...}, '15-24': {...}, '25-49': {...}, '50+': {...} }
      by_regimen_line       JSONB,             -- { 'first_line': {...}, 'second_line': {...}, 'third_line': {...} }
      notes                 TEXT,
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cascade_snapshot_date ON cascade_snapshots (snapshot_date DESC)`,

    -- Retention snapshots (6, 12, 24 month per cohort)
    `CREATE TABLE IF NOT EXISTS retention_snapshots (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cohort_start      DATE         NOT NULL,
      followup_months   INTEGER      NOT NULL,  -- 6 | 12 | 24
      total_enrolled    INTEGER      NOT NULL,
      alive_on_art      INTEGER      NOT NULL,
      ltfu_count        INTEGER      NOT NULL,
      transferred_out   INTEGER      NOT NULL,
      died_count        INTEGER      NOT NULL,
      stopped_art       INTEGER      NOT NULL,
      retention_rate    NUMERIC(5,2) NOT NULL,
      ltfu_rate         NUMERIC(5,2) NOT NULL,
      snapshot_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE (cohort_start, followup_months)
    )`,

    -- Re-engagement tracking
    `CREATE TABLE IF NOT EXISTS ltfu_reengagement_log (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID         NOT NULL,
      ltfu_date       DATE         NOT NULL,    -- date classified as LTFU
      ltfu_duration_days INTEGER,               -- days between last visit and return
      returned_date   DATE         NOT NULL,
      returned_by     VARCHAR(60),  -- 'self' | 'chw_tracing' | 'sms_reminder' | 'phone_call' | 'other'
      return_notes    TEXT,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_reengagement_patient ON ltfu_reengagement_log (patient_id)`,

    -- Cohort definitions (saved cohort builder queries)
    `CREATE TABLE IF NOT EXISTS cohort_definitions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cohort_name     VARCHAR(200) NOT NULL,
      description     TEXT,
      created_by      UUID,
      criteria        JSONB        NOT NULL,   -- structured criteria object (see section 4.3)
      last_run_at     TIMESTAMPTZ,
      last_run_count  INTEGER,
      is_shared       BOOLEAN      NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cohort_def_creator ON cohort_definitions (created_by)`,
  ],
},
```

Run `POST /api/admin/tenants/repair-all` after adding.

---

## 4. Backend Implementation

### 4.1 Cascade Metrics Service

**File to create:** `services/ehr-service/src/services/cascade-metrics.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class CascadeMetricsService {
  async computeCascade(db: any): Promise<{
    diagnosedCount: number;
    onArtCount: number;
    suppressedCount: number;
    second95: number;
    third95: number;
    byAgeBand: Record<string, any>;
    bySex: Record<string, any>;
  }> {
    // Count all patients with HIV enrollment (diagnosed)
    const [diagnosed] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments WHERE enrollment_status NOT IN ('closed', 'transferred_out')`
    );

    // Count all patients currently on ART (active regimen, not stopped)
    const [onArt] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments
       WHERE art_status = 'on_art' AND enrollment_status NOT IN ('closed', 'transferred_out')`
    );

    // Count virally suppressed (last VL in past 12 months < 1000 copies/mL)
    const [suppressed] = await db.query(
      `SELECT COUNT(DISTINCT cv.patient_id) AS cnt
       FROM hiv_clinical_visits cv
       WHERE cv.viral_load < 1000
         AND cv.viral_load IS NOT NULL
         AND cv.visit_date >= CURRENT_DATE - INTERVAL '12 months'
         AND EXISTS (
           SELECT 1 FROM hiv_enrollments e WHERE e.patient_id = cv.patient_id
           AND e.art_status = 'on_art' AND e.enrollment_status NOT IN ('closed', 'transferred_out')
         )`
    );

    const dCount = parseInt(diagnosed.cnt);
    const aCount = parseInt(onArt.cnt);
    const sCount = parseInt(suppressed.cnt);

    // Disaggregate by sex
    const bySexRows = await db.query(`
      SELECT p.sex,
        COUNT(DISTINCT e.patient_id)                                                             AS diagnosed,
        COUNT(DISTINCT e.patient_id) FILTER (WHERE e.art_status = 'on_art')                     AS on_art,
        COUNT(DISTINCT cv.patient_id) FILTER (WHERE cv.viral_load < 1000 AND cv.viral_load IS NOT NULL AND cv.visit_date >= CURRENT_DATE - INTERVAL '12 months') AS suppressed
      FROM hiv_enrollments e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN hiv_clinical_visits cv ON cv.patient_id = e.patient_id
      WHERE e.enrollment_status NOT IN ('closed', 'transferred_out')
      GROUP BY p.sex
    `);

    // Disaggregate by age band
    const byAgeBandRows = await db.query(`
      SELECT
        CASE
          WHEN DATE_PART('year', AGE(p.date_of_birth)) < 15 THEN '<15'
          WHEN DATE_PART('year', AGE(p.date_of_birth)) < 25 THEN '15-24'
          WHEN DATE_PART('year', AGE(p.date_of_birth)) < 50 THEN '25-49'
          ELSE '50+'
        END AS age_band,
        COUNT(DISTINCT e.patient_id) AS diagnosed,
        COUNT(DISTINCT e.patient_id) FILTER (WHERE e.art_status = 'on_art') AS on_art,
        COUNT(DISTINCT cv.patient_id) FILTER (WHERE cv.viral_load < 1000 AND cv.viral_load IS NOT NULL AND cv.visit_date >= CURRENT_DATE - INTERVAL '12 months') AS suppressed
      FROM hiv_enrollments e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN hiv_clinical_visits cv ON cv.patient_id = e.patient_id
      WHERE e.enrollment_status NOT IN ('closed', 'transferred_out')
      GROUP BY age_band ORDER BY age_band
    `);

    const bySex = Object.fromEntries(bySexRows.map((r: any) => [r.sex, r]));
    const byAgeBand = Object.fromEntries(byAgeBandRows.map((r: any) => [r.age_band, r]));

    const second95 = aCount > 0 && dCount > 0 ? (aCount / dCount) * 100 : 0;
    const third95  = sCount > 0 && aCount > 0 ? (sCount / aCount) * 100 : 0;

    return { diagnosedCount: dCount, onArtCount: aCount, suppressedCount: sCount, second95, third95, bySex, byAgeBand };
  }

  async saveSnapshot(cascade: any, periodLabel: string, db: any): Promise<void> {
    await db.query(
      `INSERT INTO cascade_snapshots
         (snapshot_date, period_label, diagnosed_count, on_art_count, suppressed_count,
          second_95, third_95, by_sex, by_age_band)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7, $8)`,
      [periodLabel, cascade.diagnosedCount, cascade.onArtCount, cascade.suppressedCount,
       cascade.second95, cascade.third95, JSON.stringify(cascade.bySex), JSON.stringify(cascade.byAgeBand)],
    );
  }
}
```

### 4.2 Retention Service (hardened)

**File to create:** `services/ehr-service/src/services/retention.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class RetentionService {
  async computeRetention(cohortStartDate: string, followupMonths: 6 | 12 | 24, db: any): Promise<any> {
    const cohortEnd = new Date(cohortStartDate);
    cohortEnd.setMonth(cohortEnd.getMonth() + followupMonths);

    // Total enrolled in this cohort (started ART in the cohort month)
    const [total] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'`,
      [cohortStartDate],
    );

    // Alive on ART at followup date
    const [aliveOnArt] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments e
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'
         AND art_status = 'on_art'
         AND EXISTS (
           SELECT 1 FROM hiv_clinical_visits v
           WHERE v.patient_id = e.patient_id AND v.visit_date >= $2::DATE - INTERVAL '90 days'
         )`,
      [cohortStartDate, cohortEnd.toISOString()],
    );

    // LTFU: no visit in 90+ days past expected visit date
    const [ltfu] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments e
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'
         AND art_status = 'on_art'
         AND NOT EXISTS (
           SELECT 1 FROM hiv_clinical_visits v
           WHERE v.patient_id = e.patient_id AND v.visit_date >= $2::DATE - INTERVAL '90 days'
         )`,
      [cohortStartDate, cohortEnd.toISOString()],
    );

    const [died] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'
         AND art_status = 'died'`,
      [cohortStartDate],
    );

    const [transferred] = await db.query(
      `SELECT COUNT(*) AS cnt FROM hiv_enrollments
       WHERE art_start_date >= $1::DATE AND art_start_date < $1::DATE + INTERVAL '1 month'
         AND art_status = 'transferred_out'`,
      [cohortStartDate],
    );

    const totalN     = parseInt(total.cnt);
    const aliveN     = parseInt(aliveOnArt.cnt);
    const ltfuN      = parseInt(ltfu.cnt);
    const diedN      = parseInt(died.cnt);
    const transferN  = parseInt(transferred.cnt);

    const retentionRate = totalN > 0 ? (aliveN / totalN) * 100 : 0;
    const ltfuRate      = totalN > 0 ? (ltfuN / totalN) * 100 : 0;

    return {
      cohortStartDate, followupMonths,
      totalEnrolled: totalN, aliveOnArt: aliveN,
      ltfuCount: ltfuN, diedCount: diedN, transferredOut: transferN,
      stoppedArt: totalN - aliveN - ltfuN - diedN - transferN,
      retentionRate: Math.round(retentionRate * 10) / 10,
      ltfuRate: Math.round(ltfuRate * 10) / 10,
    };
  }

  async recordReengagement(params: {
    patientId: string; ltfuDate: string; returnedDate: string;
    returnedBy: string; returnNotes?: string;
  }, db: any): Promise<void> {
    const ltfu = new Date(params.ltfuDate);
    const returned = new Date(params.returnedDate);
    const days = Math.floor((returned.getTime() - ltfu.getTime()) / (1000 * 60 * 60 * 24));
    await db.query(
      `INSERT INTO ltfu_reengagement_log (patient_id, ltfu_date, ltfu_duration_days, returned_date, returned_by, return_notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [params.patientId, params.ltfuDate, days, params.returnedDate, params.returnedBy, params.returnNotes ?? null],
    );
    // Reactivate HIV enrollment
    await db.query(
      `UPDATE hiv_enrollments SET art_status = 'on_art', enrollment_status = 'active' WHERE patient_id = $1`,
      [params.patientId],
    );
  }
}
```

### 4.3 Cohort Builder Service

**File to create:** `services/ehr-service/src/services/cohort-builder.service.ts`

The cohort definition criteria structure (stored as JSONB):
```typescript
interface CohortCriteria {
  conditions: Array<{
    field: string;      // e.g. 'age_min', 'age_max', 'sex', 'regimen_line', 'art_status', 'vl_max', 'cd4_min', 'district'
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
    value: string | number | string[];
  }>;
  logic: 'AND' | 'OR';
}
```

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class CohortBuilderService {
  private readonly ALLOWED_FIELDS: Record<string, string> = {
    'age_min':        `DATE_PART('year', AGE(p.date_of_birth)) >= :value`,
    'age_max':        `DATE_PART('year', AGE(p.date_of_birth)) <= :value`,
    'sex':            `p.sex = :value`,
    'district':       `p.district ILIKE :value`,
    'province':       `p.province ILIKE :value`,
    'art_status':     `e.art_status = :value`,
    'regimen_line':   `e.current_regimen_line = :value`,
    'vl_max':         `EXISTS (SELECT 1 FROM hiv_clinical_visits v WHERE v.patient_id = p.id AND v.viral_load <= :value AND v.visit_date >= CURRENT_DATE - INTERVAL '12 months')`,
    'cd4_min':        `EXISTS (SELECT 1 FROM hiv_clinical_visits v WHERE v.patient_id = p.id AND v.cd4_count >= :value AND v.visit_date >= CURRENT_DATE - INTERVAL '12 months')`,
    'on_art_months_min': `DATE_PART('month', AGE(CURRENT_DATE, e.art_start_date)) >= :value`,
    'has_oi_alert':   `EXISTS (SELECT 1 FROM oi_early_warning_alerts a WHERE a.patient_id = p.id AND a.status = 'active')`,
    'is_stable':      `EXISTS (SELECT 1 FROM hiv_stable_patient_flags f WHERE f.patient_id = p.id AND f.is_active = true)`,
  };

  buildQuery(criteria: { conditions: any[]; logic: 'AND' | 'OR' }): { sql: string; params: any[] } {
    const params: any[] = [];
    const clauses = criteria.conditions.map(c => {
      const template = this.ALLOWED_FIELDS[c.field];
      if (!template) throw new BadRequestException(`Unknown cohort field: ${c.field}`);
      params.push(c.value);
      return template.replace(':value', `$${params.length}`);
    });

    const where = clauses.join(` ${criteria.logic} `);
    const sql = `
      SELECT p.id, p.full_name, p.date_of_birth, p.sex, p.district, p.province,
             e.art_status, e.art_start_date, e.current_regimen
      FROM patients p
      JOIN hiv_enrollments e ON e.patient_id = p.id
      WHERE ${where}
      ORDER BY p.full_name
    `;
    return { sql, params };
  }

  async runCohort(criteria: any, db: any): Promise<{ count: number; patients: any[] }> {
    const { sql, params } = this.buildQuery(criteria);
    const patients = await db.query(sql, params);
    return { count: patients.length, patients };
  }

  async saveCohort(dto: { cohortName: string; description?: string; criteria: any; isShared?: boolean; createdBy: string }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO cohort_definitions (cohort_name, description, criteria, is_shared, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [dto.cohortName, dto.description ?? null, JSON.stringify(dto.criteria), dto.isShared ?? false, dto.createdBy],
    );
    return row;
  }

  async runSavedCohort(cohortId: string, db: any): Promise<any> {
    const [def] = await db.query(`SELECT * FROM cohort_definitions WHERE id = $1`, [cohortId]);
    if (!def) throw new BadRequestException('Cohort not found');

    const result = await this.runCohort(def.criteria, db);
    await db.query(
      `UPDATE cohort_definitions SET last_run_at = now(), last_run_count = $1 WHERE id = $2`,
      [result.count, cohortId],
    );
    return result;
  }

  async listSavedCohorts(userId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT id, cohort_name, description, is_shared, last_run_at, last_run_count, created_at
       FROM cohort_definitions WHERE created_by = $1 OR is_shared = true ORDER BY updated_at DESC`,
      [userId],
    );
  }
}
```

### 4.4 Controller

Add to `services/ehr-service/src/controllers/hiv.controller.ts` (or create `research.controller.ts`):

```typescript
@Controller('research')
@UseGuards(JwtAuthGuard)
export class ResearchController {
  constructor(
    private readonly cascadeSvc: CascadeMetricsService,
    private readonly retentionSvc: RetentionService,
    private readonly cohortSvc: CohortBuilderService,
  ) {}

  @Get('cascade/current')
  async getCascade(@Req() req: any) {
    return this.cascadeSvc.computeCascade(req.tenantDb);
  }

  @Post('cascade/snapshot')
  async saveSnapshot(@Body() body: { periodLabel: string }, @Req() req: any) {
    const cascade = await this.cascadeSvc.computeCascade(req.tenantDb);
    await this.cascadeSvc.saveSnapshot(cascade, body.periodLabel, req.tenantDb);
    return cascade;
  }

  @Get('cascade/snapshots')
  async getSnapshots(@Req() req: any) {
    return req.tenantDb.query(`SELECT * FROM cascade_snapshots ORDER BY snapshot_date DESC LIMIT 12`);
  }

  @Get('retention')
  async getRetention(@Query('cohortStart') cohortStart: string, @Query('months') months: string, @Req() req: any) {
    const m = parseInt(months) as 6 | 12 | 24;
    if (![6, 12, 24].includes(m)) throw new BadRequestException('months must be 6, 12, or 24');
    return this.retentionSvc.computeRetention(cohortStart, m, req.tenantDb);
  }

  @Post('patients/:id/reengagement')
  async recordReengagement(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.retentionSvc.recordReengagement({ ...body, patientId: id }, req.tenantDb);
  }

  @Post('cohorts/run')
  async runCohort(@Body() body: { conditions: any[]; logic: 'AND' | 'OR' }, @Req() req: any) {
    return this.cohortSvc.runCohort(body, req.tenantDb);
  }

  @Post('cohorts')
  async saveCohort(@Body() body: any, @Req() req: any) {
    return this.cohortSvc.saveCohort({ ...body, createdBy: req.user.sub }, req.tenantDb);
  }

  @Get('cohorts')
  async listCohorts(@Req() req: any) {
    return this.cohortSvc.listSavedCohorts(req.user.sub, req.tenantDb);
  }

  @Post('cohorts/:id/run')
  async runSavedCohort(@Param('id') id: string, @Req() req: any) {
    return this.cohortSvc.runSavedCohort(id, req.tenantDb);
  }
}
```

Register `ResearchController`, `CascadeMetricsService`, `RetentionService`, `CohortBuilderService` in `ehr.module.ts`.

---

## 5. Frontend Implementation

### 5.1 95-95-95 Dashboard

**File to create:** `ehr-frontend/src/pages/CascadeDashboard.tsx`

- Cascade funnel chart: 3 bars — Diagnosed | On ART | Virally Suppressed
- Each bar shows: count + %, target = 95% of previous bar
- Green when ≥ 95%, amber 85–94%, red < 85%
- Disaggregation toggles: by Sex | by Age Band | by Regimen Line
- Historical trend: line chart of second_95 and third_95 over time (from snapshots)
- "Save Snapshot" button

### 5.2 Retention Dashboard

**File to create:** `ehr-frontend/src/pages/RetentionDashboard.tsx`

- Cohort selector: calendar month picker for cohort start
- 3 tabs: 6-month | 12-month | 24-month
- Stacked bar: Alive on ART | LTFU | Died | Transferred | Stopped
- Retention rate number prominently displayed
- "Record Re-engagement" button for LTFU patients

### 5.3 Cohort Builder

**File to create:** `ehr-frontend/src/pages/CohortBuilder.tsx`

- Criteria builder UI: dropdown (field selector) + operator + value input
- "Add Criterion" button; AND/OR logic toggle
- "Run Cohort" → shows patient count + table
- "Save Cohort" form (name + description + shared toggle)
- "Saved Cohorts" sidebar — click to re-run
- "Export CSV" button on results

---

## 6. Tests Required

```typescript
describe('CascadeMetricsService', () => {
  it('second95 = onArt / diagnosed * 100', async () => {
    const mockDb = { query: jest.fn()
      .mockResolvedValueOnce([{ cnt: '100' }])  // diagnosed
      .mockResolvedValueOnce([{ cnt: '93' }])   // on_art
      .mockResolvedValueOnce([{ cnt: '85' }])   // suppressed
      .mockResolvedValue([]),                    // sex, age band
    };
    const svc = new CascadeMetricsService();
    const r = await svc.computeCascade(mockDb as any);
    expect(r.second95).toBeCloseTo(93, 0);
    expect(r.third95).toBeCloseTo(91.4, 0);
  });
});

describe('CohortBuilderService', () => {
  it('rejects unknown cohort fields', () => {
    const svc = new CohortBuilderService();
    expect(() => svc.buildQuery({ conditions: [{ field: 'DROP TABLE', operator: 'eq', value: '1' }], logic: 'AND' }))
      .toThrow('Unknown cohort field');
  });

  it('builds correct SQL for sex = M', () => {
    const svc = new CohortBuilderService();
    const { sql, params } = svc.buildQuery({ conditions: [{ field: 'sex', operator: 'eq', value: 'M' }], logic: 'AND' });
    expect(sql).toContain('p.sex = $1');
    expect(params).toEqual(['M']);
  });
});

describe('RetentionService', () => {
  it('retentionRate = aliveOnArt / totalEnrolled * 100', async () => {
    const mockDb = { query: jest.fn()
      .mockResolvedValueOnce([{ cnt: '200' }])  // total
      .mockResolvedValueOnce([{ cnt: '170' }])  // alive
      .mockResolvedValueOnce([{ cnt: '20' }])   // ltfu
      .mockResolvedValueOnce([{ cnt: '5' }])    // died
      .mockResolvedValueOnce([{ cnt: '5' }])    // transferred
    };
    const svc = new RetentionService();
    const r = await svc.computeRetention('2025-01-01', 12, mockDb as any);
    expect(r.retentionRate).toBe(85);
    expect(r.ltfuRate).toBe(10);
  });
});
```

---

## 7. Sign-off Criteria

- [ ] `cascade_snapshots`, `retention_snapshots`, `ltfu_reengagement_log`, `cohort_definitions` provisioned in all tenant DBs
- [ ] `repair-all` backfills all 4 tables
- [ ] `GET /research/cascade/current` returns diagnosedCount, onArtCount, suppressedCount, second95, third95, bySex, byAgeBand
- [ ] second95 = onArtCount / diagnosedCount × 100 (verified by unit test)
- [ ] `POST /research/cascade/snapshot` saves snapshot to `cascade_snapshots`
- [ ] `GET /research/retention?cohortStart=2025-01-01&months=12` returns correct retention rate
- [ ] Retention LTFU definition: patient has no visit in 90+ days past cohort followup date
- [ ] `POST /research/patients/:id/reengagement` sets `art_status = 'on_art'` and logs `ltfu_reengagement_log`
- [ ] `POST /research/cohorts/run` with `{ conditions: [{ field: 'sex', operator: 'eq', value: 'M' }], logic: 'AND' }` executes without SQL injection
- [ ] Cohort builder rejects unknown field names with 400 error
- [ ] `POST /research/cohorts` saves cohort definition; `GET /research/cohorts` returns it
- [ ] Cascade Dashboard renders funnel chart with green/amber/red colouring
- [ ] Cohort Builder UI allows adding/removing criteria and exporting results to CSV
- [ ] `ResearchController` registered in `ehr.module.ts`
- [ ] `npm run lint` passes zero errors
- [ ] `npm test` passes zero failures
- [ ] CI `build-and-test` job passes green
