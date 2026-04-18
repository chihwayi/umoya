# Sprint 160 — UHC Service Coverage Index & WHO SDG Health Indicators Dashboard

**Sprint**: S160  
**Module**: UHC Coverage Tracking, SDG 3 Health Indicator Computation, DHIS2 Indicator Push, Facility Scorecard  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint160_uhc_sdg_indicators`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

Every MediCore facility generates rich clinical data across 150+ sprints of functionality, but no single dashboard answers: "Are we achieving UHC? Are we on track for SDG 3 targets?" This sprint builds the analytics layer that converts the clinical data into WHO UHC Service Coverage Index components and SDG 3 health indicator metrics.

| Indicator | SDG Target | Computed From |
|---|---|---|
| ANC ≥4 visits coverage | SDG 3.1 | Maternity module attendance records |
| Skilled birth attendance | SDG 3.1 | Delivery records + TBA module |
| ART coverage among PLHIV | SDG 3.3 | HIV ART register |
| TB treatment success rate | SDG 3.3 | TB cohort outcomes |
| DTP3 immunisation coverage | SDG 3.2 | EPI immunisation records |
| Hypertension treatment coverage | SDG 3.4 | HTN module treated/registered ratio |
| Hospital bed density | SDG 3.8 | Facility infrastructure |
| UHC Service Coverage Index | SDG 3.8 | Composite of 16 tracer indicators |
| Maternal mortality ratio | SDG 3.1 | MDSR data from S147 |
| U5 mortality rate | SDG 3.2 | Birth/death records |

### What already exists (do NOT recreate)

- DHIS2 integration from S136 (`dhis2.controller.ts`, `dhis2.service.ts`, `dhis2-scheduler.service.ts`) — **extend this** to push UHC/SDG indicator values
- All clinical modules (maternity, HIV/ART, TB, EPI, HTN, TBA, maternal mortality) — **query these** for numerators/denominators
- `CdssService`, `ehr.module.ts`, `tenant.service.ts`

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-uhc-sdg-indicators.statements.ts`**

```typescript
export const TENANT_UHC_SDG_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_UHC_SDG_STATEMENTS: string[] = [

  // ── UHC Indicator Snapshots ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS uhc_indicator_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Period
    period_year INTEGER NOT NULL,
    period_quarter INTEGER,              -- NULL for annual snapshot
    period_month INTEGER,                -- NULL for quarterly/annual
    -- Facility
    facility_code TEXT,
    facility_name TEXT,
    district TEXT,
    -- Maternal / Newborn (SDG 3.1, 3.2)
    anc1_coverage DECIMAL(5,2),          -- % pregnant women with ≥1 ANC visit
    anc4_coverage DECIMAL(5,2),          -- % with ≥4 ANC visits
    skilled_birth_attendance DECIMAL(5,2),
    c_section_rate DECIMAL(5,2),
    maternal_mortality_ratio DECIMAL(8,2),  -- per 100,000 live births
    neonatal_mortality_rate DECIMAL(5,2),  -- per 1,000 live births
    u5_mortality_rate DECIMAL(5,2),
    -- Immunisation (SDG 3.2)
    dtp3_coverage DECIMAL(5,2),
    measles_coverage DECIMAL(5,2),
    fully_immunised_coverage DECIMAL(5,2),
    -- HIV / TB (SDG 3.3)
    hiv_art_coverage DECIMAL(5,2),       -- % PLHIV on ART
    hiv_viral_suppression DECIMAL(5,2),  -- % on ART with VL <1000
    tb_treatment_success_rate DECIMAL(5,2),
    tb_case_detection_rate DECIMAL(5,2),
    -- NCD (SDG 3.4)
    htn_treatment_coverage DECIMAL(5,2),
    htn_controlled DECIMAL(5,2),         -- % on treatment with BP <140/90
    dm_treatment_coverage DECIMAL(5,2),
    -- Reproductive Health (SDG 3.7)
    modern_contraceptive_prevalence DECIMAL(5,2),
    unmet_need_fp DECIMAL(5,2),
    -- Health Service Access (SDG 3.8)
    uhc_sci_composite DECIMAL(5,2),      -- 0-100 composite UHC Service Coverage Index
    out_of_pocket_catastrophic_pct DECIMAL(5,2),  -- % households with catastrophic health expenditure
    cbhi_coverage DECIMAL(5,2),
    -- Computed
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    computation_method TEXT NOT NULL DEFAULT 'facility_query',  -- 'facility_query' | 'dhis2_pull' | 'manual_entry'
    cdss_gap_flags JSONB DEFAULT '[]',   -- indicators below national target
    cdss_priority_actions JSONB DEFAULT '[]',
    cdss_confidence DECIMAL(4,3),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_uhc_snapshots_period ON uhc_indicator_snapshots(period_year, period_quarter)`,
  `CREATE INDEX IF NOT EXISTS idx_uhc_snapshots_facility ON uhc_indicator_snapshots(facility_code)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uidx_uhc_snapshots_period_facility ON uhc_indicator_snapshots(period_year, period_quarter, period_month, facility_code)`,

  // ── SDG Target Definitions ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sdg_indicator_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_code TEXT NOT NULL UNIQUE, -- e.g. 'anc4_coverage', 'hiv_art_coverage'
    indicator_name TEXT NOT NULL,
    sdg_goal TEXT NOT NULL,              -- 'SDG 3.1' | 'SDG 3.2' etc.
    target_value DECIMAL(8,2) NOT NULL,
    target_year INTEGER NOT NULL DEFAULT 2030,
    national_target DECIMAL(8,2),        -- country-specific target (may differ from global)
    unit TEXT NOT NULL DEFAULT 'percentage',
    data_source TEXT,                    -- which table/column to query
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_sdg_targets_code ON sdg_indicator_targets(indicator_code)`,

  -- Seed SDG targets
  `INSERT INTO sdg_indicator_targets (indicator_code, indicator_name, sdg_goal, target_value, national_target, unit, data_source) VALUES
    ('anc4_coverage', 'ANC ≥4 visits coverage', 'SDG 3.1', 90, 80, 'percentage', 'maternity_records'),
    ('skilled_birth_attendance', 'Skilled birth attendance rate', 'SDG 3.1', 95, 90, 'percentage', 'delivery_records'),
    ('maternal_mortality_ratio', 'Maternal Mortality Ratio', 'SDG 3.1', 70, 100, 'per_100k_live_births', 'maternal_deaths'),
    ('u5_mortality_rate', 'Under-5 Mortality Rate', 'SDG 3.2', 25, 35, 'per_1000_live_births', 'birth_death_records'),
    ('dtp3_coverage', 'DTP3 immunisation coverage', 'SDG 3.2', 90, 85, 'percentage', 'immunisation_records'),
    ('hiv_art_coverage', 'ART coverage among PLHIV', 'SDG 3.3', 95, 90, 'percentage', 'art_register'),
    ('hiv_viral_suppression', 'HIV viral suppression rate', 'SDG 3.3', 95, 90, 'percentage', 'lab_vl_results'),
    ('tb_treatment_success_rate', 'TB treatment success rate', 'SDG 3.3', 90, 85, 'percentage', 'tb_treatment_outcomes'),
    ('htn_treatment_coverage', 'Hypertension treatment coverage', 'SDG 3.4', 80, 70, 'percentage', 'htn_register'),
    ('uhc_sci_composite', 'UHC Service Coverage Index', 'SDG 3.8', 80, 75, 'index_0_100', 'computed'),
    ('cbhi_coverage', 'CBHI enrolment coverage', 'SDG 3.8', 80, 60, 'percentage', 'cbhi_households')
  ON CONFLICT (indicator_code) DO NOTHING`,

];
```

### 2b. Register Bundle

```typescript
import {
  TENANT_UHC_SDG_BUNDLE_VERSION,
  TENANT_UHC_SDG_STATEMENTS,
} from './generated/tenant-uhc-sdg-indicators.statements';

{
  id: 'sprint160_uhc_sdg_indicators',
  label: 'Sprint 160 — UHC Service Coverage Index + WHO SDG Health Indicators',
  version: TENANT_UHC_SDG_BUNDLE_VERSION,
  description: 'Creates uhc_indicator_snapshots, sdg_indicator_targets tables; seeds 11 SDG targets',
  statements: TENANT_UHC_SDG_STATEMENTS,
},
```

---

## 3. TypeORM Entities

**File: `services/ehr-service/src/analytics/entities/uhc-indicator-snapshot.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'uhc_indicator_snapshots' })
export class UhcIndicatorSnapshot {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'period_year' }) periodYear: number;
  @Column({ name: 'period_quarter', nullable: true }) periodQuarter: number;
  @Column({ name: 'period_month', nullable: true }) periodMonth: number;
  @Column({ name: 'facility_code', nullable: true }) facilityCode: string;
  @Column({ name: 'facility_name', nullable: true }) facilityName: string;
  @Column({ name: 'district', nullable: true }) district: string;
  // All indicator columns — add each with nullable: true, type: 'decimal', precision: 5, scale: 2
  @Column({ name: 'anc4_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true }) anc4Coverage: number;
  @Column({ name: 'skilled_birth_attendance', type: 'decimal', precision: 5, scale: 2, nullable: true }) skilledBirthAttendance: number;
  @Column({ name: 'c_section_rate', type: 'decimal', precision: 5, scale: 2, nullable: true }) cSectionRate: number;
  @Column({ name: 'maternal_mortality_ratio', type: 'decimal', precision: 8, scale: 2, nullable: true }) maternalMortalityRatio: number;
  @Column({ name: 'neonatal_mortality_rate', type: 'decimal', precision: 5, scale: 2, nullable: true }) neonatalMortalityRate: number;
  @Column({ name: 'u5_mortality_rate', type: 'decimal', precision: 5, scale: 2, nullable: true }) u5MortalityRate: number;
  @Column({ name: 'dtp3_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true }) dtp3Coverage: number;
  @Column({ name: 'measles_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true }) measlesCoverage: number;
  @Column({ name: 'hiv_art_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true }) hivArtCoverage: number;
  @Column({ name: 'hiv_viral_suppression', type: 'decimal', precision: 5, scale: 2, nullable: true }) hivViralSuppression: number;
  @Column({ name: 'tb_treatment_success_rate', type: 'decimal', precision: 5, scale: 2, nullable: true }) tbTreatmentSuccessRate: number;
  @Column({ name: 'htn_treatment_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true }) htnTreatmentCoverage: number;
  @Column({ name: 'htn_controlled', type: 'decimal', precision: 5, scale: 2, nullable: true }) htnControlled: number;
  @Column({ name: 'uhc_sci_composite', type: 'decimal', precision: 5, scale: 2, nullable: true }) uhcSciComposite: number;
  @Column({ name: 'cbhi_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true }) cbhiCoverage: number;
  @Column({ name: 'computed_at', type: 'timestamp' }) computedAt: Date;
  @Column({ name: 'computation_method', default: 'facility_query' }) computationMethod: string;
  @Column({ name: 'cdss_gap_flags', type: 'jsonb', default: [] }) cdssGapFlags: string[];
  @Column({ name: 'cdss_priority_actions', type: 'jsonb', default: [] }) cdssPriorityActions: string[];
  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true }) cdssConfidence: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

**File: `services/ehr-service/src/analytics/entities/sdg-indicator-target.entity.ts`** — mirror `sdg_indicator_targets` columns.

Register both in `tenant.service.ts`.

---

## 4. CDSS Python Endpoint

```python
class UhcGapAnalysisRequest(BaseModel):
    indicators: Dict[str, float]         # {indicator_code: current_value}
    targets: Dict[str, float]            # {indicator_code: target_value}
    facility_type: str                   # 'primary' | 'district' | 'provincial' | 'tertiary'
    country: str
    year: int

class UhcGapAnalysisResponse(BaseModel):
    uhc_sci_score: float                 # 0-100 composite
    gap_flags: List[str]                 # indicators more than 10% below target
    priority_actions: List[str]          # ranked actions to close largest gaps
    sdg3_on_track: bool
    high_impact_interventions: List[str] # interventions with highest potential impact
    confidence: float
    citations: List[str]

@app.post("/cdss/analytics/uhc-gap-analysis", response_model=UhcGapAnalysisResponse)
async def uhc_gap_analysis(req: UhcGapAnalysisRequest):
    """
    WHO UHC Service Coverage Index computation and gap analysis.
    Computes SCI 0-100 from 16 tracer indicators; identifies priority actions.
    Based on WHO 2023 UHC Service Coverage Index methodology and SDG 3 targets.
    """
    gap_summary = {k: round(req.targets.get(k, 0) - v, 1) for k, v in req.indicators.items() if req.targets.get(k, 0) > v}

    prompt = f"""
    You are a WHO health systems analyst using the 2023 WHO UHC Service Coverage Index methodology
    and WHO/UNICEF Joint Monitoring Programme targets.

    Facility: {req.facility_type} in {req.country}, year {req.year}
    Current indicators vs targets:
    {chr(10).join([f"  {k}: {req.indicators.get(k, 'N/A')}% (target: {req.targets.get(k, 'N/A')}%)" for k in req.targets])}

    Gaps (target - actual):
    {gap_summary}

    Compute:
    1. UHC SCI composite 0-100 using geometric mean of 4 domains:
       - Reproductive/maternal/newborn/child (RMNCH): ANC4, skilled birth, DTP3, measles
       - Infectious diseases: HIV ART, TB success, malaria (if available)
       - NCDs: HTN treatment, DM treatment
       - Service capacity: CBHI coverage, facility density
    2. Identify top 3 gap indicators (largest % below target)
    3. Priority actions for the facility type in the African context
    4. Whether SDG3 trajectory is on-track (requires ≥2% annual improvement for off-track indicators)

    Return JSON: uhc_sci_score, gap_flags (list), priority_actions (list), sdg3_on_track,
    high_impact_interventions (list), confidence (0-1), citations (list).
    """
    result = await call_governed_json(prompt, surface="uhc_gap_analysis", phi_present=False)
    return result
```

---

## 5. NestJS Service

**File: `services/ehr-service/src/analytics/uhc-analytics.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UhcIndicatorSnapshot } from './entities/uhc-indicator-snapshot.entity';
import { SdgIndicatorTarget } from './entities/sdg-indicator-target.entity';
import { CdssService } from '../cdss/cdss.service';

@Injectable()
export class UhcAnalyticsService {
  private readonly logger = new Logger(UhcAnalyticsService.name);

  constructor(
    @InjectRepository(UhcIndicatorSnapshot) private snapshotRepo: Repository<UhcIndicatorSnapshot>,
    @InjectRepository(SdgIndicatorTarget) private targetRepo: Repository<SdgIndicatorTarget>,
    private cdssService: CdssService,
    private dataSource: DataSource,
  ) {}

  async computeIndicators(year: number, quarter?: number): Promise<UhcIndicatorSnapshot> {
    // Query each clinical module to compute numerators/denominators
    // These queries are illustrative — adjust table names to match actual MediCore entities
    const [
      anc4,
      dtp3,
      artCoverage,
      tbSuccess,
      htnCoverage,
      cbhiCoverage,
    ] = await Promise.all([
      this.computeAnc4Coverage(year),
      this.computeDtp3Coverage(year),
      this.computeArtCoverage(),
      this.computeTbSuccessRate(year),
      this.computeHtnCoverage(),
      this.computeCbhiCoverage(),
    ]);

    const snapshot = await this.snapshotRepo.save(this.snapshotRepo.create({
      periodYear: year,
      periodQuarter: quarter ?? null,
      anc4Coverage: anc4,
      dtp3Coverage: dtp3,
      hivArtCoverage: artCoverage,
      tbTreatmentSuccessRate: tbSuccess,
      htnTreatmentCoverage: htnCoverage,
      cbhiCoverage: cbhiCoverage,
      computedAt: new Date(),
      computationMethod: 'facility_query',
    }));

    // CDSS gap analysis
    try {
      const targets = await this.getTargetsMap();
      const indicators: Record<string, number> = {};
      if (anc4 !== null) indicators.anc4_coverage = anc4;
      if (dtp3 !== null) indicators.dtp3_coverage = dtp3;
      if (artCoverage !== null) indicators.hiv_art_coverage = artCoverage;
      if (tbSuccess !== null) indicators.tb_treatment_success_rate = tbSuccess;
      if (htnCoverage !== null) indicators.htn_treatment_coverage = htnCoverage;
      if (cbhiCoverage !== null) indicators.cbhi_coverage = cbhiCoverage;

      const cdssResult = await this.cdssService.callGovernedJson('/cdss/analytics/uhc-gap-analysis', {
        indicators, targets, facility_type: 'district', country: 'Zimbabwe', year,
      });
      if (cdssResult && !cdssResult.abstained) {
        await this.snapshotRepo.update(snapshot.id, {
          uhcSciComposite: cdssResult.result?.uhc_sci_score,
          cdssGapFlags: cdssResult.result?.gap_flags ?? [],
          cdssPriorityActions: cdssResult.result?.priority_actions ?? [],
          cdssConfidence: cdssResult.confidence,
        });
      }
    } catch {
      this.logger.warn('CDSS UHC gap analysis failed');
    }

    return this.snapshotRepo.findOneOrFail({ where: { id: snapshot.id } });
  }

  private async computeAnc4Coverage(year: number): Promise<number | null> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(CASE WHEN anc_visit_count >= 4 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS coverage
        FROM maternity_records
        WHERE EXTRACT(YEAR FROM created_at) = $1
      `, [year]);
      return parseFloat(result[0]?.coverage) || null;
    } catch { return null; }
  }

  private async computeDtp3Coverage(year: number): Promise<number | null> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(DISTINCT patient_id)::float /
          NULLIF((SELECT COUNT(*) FROM patients WHERE age_months BETWEEN 0 AND 11), 0) * 100 AS coverage
        FROM immunisation_records
        WHERE vaccine_name ILIKE '%DTP%' AND dose_number = 3
          AND EXTRACT(YEAR FROM given_date) = $1
      `, [year]);
      return parseFloat(result[0]?.coverage) || null;
    } catch { return null; }
  }

  private async computeArtCoverage(): Promise<number | null> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(CASE WHEN art_status = 'active' THEN 1 END)::float /
          NULLIF(COUNT(*), 0) * 100 AS coverage
        FROM hiv_art_register
        WHERE hiv_status = 'positive'
      `);
      return parseFloat(result[0]?.coverage) || null;
    } catch { return null; }
  }

  private async computeTbSuccessRate(year: number): Promise<number | null> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(CASE WHEN outcome IN ('treatment_completed', 'cured') THEN 1 END)::float /
          NULLIF(COUNT(*), 0) * 100 AS success_rate
        FROM tb_treatment_records
        WHERE treatment_start_year = $1
      `, [year]);
      return parseFloat(result[0]?.success_rate) || null;
    } catch { return null; }
  }

  private async computeHtnCoverage(): Promise<number | null> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(CASE WHEN treatment_status = 'on_treatment' THEN 1 END)::float /
          NULLIF(COUNT(*), 0) * 100 AS coverage
        FROM hypertension_register
      `);
      return parseFloat(result[0]?.coverage) || null;
    } catch { return null; }
  }

  private async computeCbhiCoverage(): Promise<number | null> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(CASE WHEN membership_status = 'active' THEN 1 END)::float /
          NULLIF(COUNT(*), 0) * 100 AS coverage
        FROM cbhi_households
      `);
      return parseFloat(result[0]?.coverage) || null;
    } catch { return null; }
  }

  async getTargetsMap(): Promise<Record<string, number>> {
    const targets = await this.targetRepo.find({ where: { isActive: true } });
    return Object.fromEntries(targets.map(t => [t.indicatorCode, parseFloat(String(t.targetValue))]));
  }

  async getSnapshots(year?: number): Promise<UhcIndicatorSnapshot[]> {
    const where = year ? { periodYear: year } : {};
    return this.snapshotRepo.find({ where, order: { computedAt: 'DESC' } });
  }

  async getLatestSnapshot(): Promise<UhcIndicatorSnapshot | null> {
    return this.snapshotRepo.findOne({ where: {}, order: { computedAt: 'DESC' } });
  }

  async getTargets(): Promise<SdgIndicatorTarget[]> {
    return this.targetRepo.find({ where: { isActive: true }, order: { sdgGoal: 'ASC' } });
  }

  async updateTarget(code: string, targetValue: number, nationalTarget?: number): Promise<SdgIndicatorTarget> {
    const target = await this.targetRepo.findOneOrFail({ where: { indicatorCode: code } });
    await this.targetRepo.update(target.id, { targetValue, ...(nationalTarget !== undefined ? { nationalTarget } : {}) });
    return this.targetRepo.findOneOrFail({ where: { id: target.id } });
  }

  async pushToDhis2(snapshotId: string): Promise<object> {
    // Delegate to existing Dhis2Service — inject via module
    const snapshot = await this.snapshotRepo.findOneOrFail({ where: { id: snapshotId } });
    // Map snapshot indicators to DHIS2 data element codes
    // Call existing dhis2Service.pushIndicators(mappedValues)
    return { pushed: true, snapshotId, message: 'Delegate to Dhis2Service.pushIndicators()' };
  }
}
```

---

## 6. NestJS Controller

**File: `services/ehr-service/src/analytics/uhc-analytics.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UhcAnalyticsService } from './uhc-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('analytics/uhc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UhcAnalyticsController {
  constructor(private readonly uhcService: UhcAnalyticsService) {}

  @Post('compute') @Roles('admin', 'public_health')
  computeIndicators(@Body() dto: { year: number; quarter?: number }) {
    return this.uhcService.computeIndicators(dto.year, dto.quarter);
  }

  @Get('snapshots') @Roles('admin', 'public_health', 'doctor')
  getSnapshots(@Query('year') year?: string) {
    return this.uhcService.getSnapshots(year ? parseInt(year) : undefined);
  }

  @Get('snapshots/latest') @Roles('admin', 'public_health', 'doctor')
  getLatest() { return this.uhcService.getLatestSnapshot(); }

  @Get('targets') @Roles('admin', 'public_health', 'doctor')
  getTargets() { return this.uhcService.getTargets(); }

  @Patch('targets/:code') @Roles('admin', 'public_health')
  updateTarget(@Param('code') code: string, @Body() dto: { targetValue: number; nationalTarget?: number }) {
    return this.uhcService.updateTarget(code, dto.targetValue, dto.nationalTarget);
  }

  @Post('snapshots/:id/push-dhis2') @Roles('admin', 'public_health')
  pushToDhis2(@Param('id') id: string) { return this.uhcService.pushToDhis2(id); }
}
```

**Module** (`uhc-analytics.module.ts`) — import `CdssModule`; export `UhcAnalyticsService`; inject `DataSource`. Register in `ehr.module.ts`.

---

## 7. Frontend

### API in `api.ts`

```typescript
export const uhcApi = {
  computeIndicators: (data: { year: number; quarter?: number }) => api.post('/analytics/uhc/compute', data),
  getSnapshots: (year?: number) => api.get('/analytics/uhc/snapshots', { params: { year } }),
  getLatestSnapshot: () => api.get('/analytics/uhc/snapshots/latest'),
  getTargets: () => api.get('/analytics/uhc/targets'),
  updateTarget: (code: string, data: any) => api.patch(`/analytics/uhc/targets/${code}`, data),
  pushToDhis2: (id: string) => api.post(`/analytics/uhc/snapshots/${id}/push-dhis2`, {}),
};
```

### Component Spec — `UhcSdgDashboard.tsx`

Three tabs:

1. **UHC Scorecard** — Large UHC SCI score dial (0-100) with colour: <50=red, 50-70=amber, >70=green. Below: indicator cards in a 4-column grid:
   - Each card shows: indicator name, current value, target, % gap (red if >10% below target)
   - SDG goal badge on each card
   - "Compute Now" button triggers fresh computation and CDSS gap analysis
   - CDSS panel: gap flags list, priority actions list, "SDG3 On Track" badge

2. **Trend Analysis** — Line chart of UHC SCI composite over time (sparkline per indicator). Period selector (year/quarter). "Push to DHIS2" button sends current snapshot.

3. **Targets** — Editable table of SDG indicator targets. Admin can update national targets vs global WHO targets. Shows last updated date.

Wire into admin / public health analytics section. This is the "executive dashboard" view.

---

## 8. Scheduled Computation

Add a quarterly cron job in `services/ehr-service/src/analytics/uhc-analytics.scheduler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UhcAnalyticsService } from './uhc-analytics.service';

@Injectable()
export class UhcAnalyticsScheduler {
  constructor(private readonly uhcService: UhcAnalyticsService) {}

  @Cron('0 0 1 1,4,7,10 *')  // First day of each quarter
  async computeQuarterlyIndicators() {
    const now = new Date();
    await this.uhcService.computeIndicators(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3));
  }
}
```

Register `UhcAnalyticsScheduler` in the module providers array. Ensure `ScheduleModule.forRoot()` is in `ehr.module.ts` (check if already present from prior sprints).

---

## 9. Post-Implementation Steps

```bash
docker compose build tenant-service
./scripts/provision-repair-all.sh
# Fallback: curl -X POST http://localhost:3001/admin/tenants/repair-all -H "Authorization: Bearer <token>"

psql $DATABASE_URL -c "\d uhc_indicator_snapshots"
psql $DATABASE_URL -c "\d sdg_indicator_targets"
# Verify seeded targets:
psql $DATABASE_URL -c "SELECT indicator_code, target_value FROM sdg_indicator_targets LIMIT 11"

npx tsc --noEmit

# Test compute endpoint:
curl -X POST http://localhost:3013/analytics/uhc/compute \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"year": 2026}'

# Test CDSS:
curl -X POST http://localhost:8000/cdss/analytics/uhc-gap-analysis \
  -H "Content-Type: application/json" \
  -d '{"indicators":{"anc4_coverage":65,"dtp3_coverage":72,"hiv_art_coverage":80,"tb_treatment_success_rate":78,"htn_treatment_coverage":45,"cbhi_coverage":30},"targets":{"anc4_coverage":80,"dtp3_coverage":85,"hiv_art_coverage":90,"tb_treatment_success_rate":85,"htn_treatment_coverage":70,"cbhi_coverage":60},"facility_type":"district","country":"Zimbabwe","year":2026}'

npm run lint

git add services/tenant-service/src/generated/tenant-uhc-sdg-indicators.statements.ts \
        services/ehr-service/src/analytics/ \
        ehr-frontend/src/services/api.ts \
        ehr-frontend/src/components/UhcSdgDashboard.tsx
git commit -m "feat: implement Sprint 160 — UHC Service Coverage Index and WHO SDG health indicators dashboard"
```

---

## 10. Done-When Checklist

- [ ] `tenant-uhc-sdg-indicators.statements.ts` — 2 tables + 11 seeded SDG targets
- [ ] Bundle registered in `database-provisioning.service.ts`
- [ ] `UhcIndicatorSnapshot` + `SdgIndicatorTarget` entities in `tenant.service.ts`
- [ ] `UhcAnalyticsModule` in `ehr.module.ts`
- [ ] `UhcAnalyticsService` with compute logic querying 6+ clinical modules
- [ ] `UhcAnalyticsScheduler` — quarterly cron job
- [ ] `UhcAnalyticsController` with 6 routes
- [ ] CDSS `POST /cdss/analytics/uhc-gap-analysis` — SCI composite + gap flags + priority actions
- [ ] CDSS result stored on snapshot; abstention handled
- [ ] DHIS2 push delegates to existing `Dhis2Service`
- [ ] `uhcApi` in `api.ts`
- [ ] `UhcSdgDashboard.tsx` — 3 tabs: Scorecard (SCI dial + indicator cards), Trends, Targets
- [ ] SDG indicator cards colour-coded by gap severity
- [ ] `provision-repair-all.sh` clean; seeded targets visible in DB
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 160 — UHC Service Coverage Index and WHO SDG health indicators dashboard`
