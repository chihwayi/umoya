# Sprint 232 — CathLab Core (Cardiac Catheterisation Laboratory)

**Module key:** `cathlab`  
**Bundle ID:** `sprint232_cathlab_core`  
**Version:** `2026.06.23.0`  
**Depends on:** `cardiology` module (already exists), `operating_room` module (theatre tables exist from sprint226)  
**Followed by:** S233 (CathLab AI — STEMI ECG, Mehran score, DAPT recommendation)

---

## Sprint Goal

Build the complete Cath Lab workflow: procedure scheduling, full coronary anatomy & lesion record, hemodynamic monitoring, STEMI activation pathway with door-to-balloon (D2B) timer, and post-procedure monitoring. Trauma Centre Borrowdale has Zimbabwe's first CathLab — this sprint makes Umoya the only EHR in Zimbabwe that fully supports interventional cardiology.

---

## Scope

**IN:**
- `cathlab_cases`, `cathlab_lesions`, `cathlab_hemodynamics`, `cathlab_post_procedure` tables
- `CathLabController` + `CathLabService`
- STEMI activation workflow with D2B timer
- `CathLabDashboard.tsx` (web)
- `CathLabScreen.tsx` (mobile) — for the mobile cardiology team
- `cathlab` added to `ALL_MODULE_KEYS`
- Provisioning bundle

**OUT:** AI STEMI ECG interpretation, Mehran score, DAPT recommendation (→ S233)

---

## Cornerstone 1: Database Provisioning

### Step 1 — Add `cathlab` to `ALL_MODULE_KEYS`

**File:** `services/tenant-service/src/services/tenant.service.ts`

```typescript
const ALL_MODULE_KEYS = [
  // ... existing keys ...
  'occupational_medicine',  // added S230
  'cathlab',                // ← ADD THIS
] as const;
```

### Step 2 — Provisioning bundle

**File:** `services/tenant-service/src/services/database-provisioning.service.ts`

Add after the S231 bundle:

```typescript
{
  id: 'sprint232_cathlab_core',
  label: 'Sprint 232 — CathLab: procedure records, coronary anatomy, hemodynamics, STEMI D2B',
  version: '2026.06.23.0',
  description: 'Cardiac catheterisation lab tables: cases, lesions per vessel, hemodynamic data, post-procedure monitoring, STEMI activation log',
  statements: () => [
    // ── CathLab Cases ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cathlab_cases (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      encounter_id     UUID REFERENCES encounters(id),
      procedure_type   TEXT NOT NULL CHECK (procedure_type IN (
                         'diagnostic_angiography','pci_stenting','ptca_balloon',
                         'pacemaker_implant','ep_study','iabp_insertion','other')),
      indication       TEXT,
      priority         TEXT NOT NULL DEFAULT 'elective' CHECK (priority IN ('elective','urgent','stemi_primary_pci','emergency')),
      stemi_activation_at TIMESTAMPTZ,
      door_to_balloon_mins INTEGER,
      scheduled_at     TIMESTAMPTZ,
      started_at       TIMESTAMPTZ,
      ended_at         TIMESTAMPTZ,
      access_site      TEXT CHECK (access_site IN ('radial_right','radial_left','femoral_right','femoral_left')),
      contrast_volume_ml SMALLINT,
      fluoroscopy_time_mins NUMERIC(5,1),
      referring_cardiologist_id UUID REFERENCES users(id),
      operator_id      UUID REFERENCES users(id),
      timi_flow_pre    SMALLINT CHECK (timi_flow_pre BETWEEN 0 AND 3),
      timi_flow_post   SMALLINT CHECK (timi_flow_post BETWEEN 0 AND 3),
      complications    JSONB NOT NULL DEFAULT '[]'::jsonb,
      outcome          TEXT CHECK (outcome IN ('success','partial_success','aborted','patient_death')),
      notes            TEXT,
      status           TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cathlab_cases_patient ON cathlab_cases(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cathlab_cases_priority ON cathlab_cases(priority)`,
    `CREATE INDEX IF NOT EXISTS idx_cathlab_cases_status ON cathlab_cases(status)`,
    `CREATE INDEX IF NOT EXISTS idx_cathlab_cases_scheduled ON cathlab_cases(scheduled_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_cathlab_cases_stemi ON cathlab_cases(stemi_activation_at) WHERE stemi_activation_at IS NOT NULL`,

    // ── Coronary Lesions (per vessel) ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cathlab_lesions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id          UUID NOT NULL REFERENCES cathlab_cases(id) ON DELETE CASCADE,
      vessel           TEXT NOT NULL CHECK (vessel IN (
                         'lad','lcx','rca','diagonal_1','diagonal_2',
                         'om1','om2','pda','plv','lmca','graft_svg','graft_lima','other')),
      stenosis_percent SMALLINT CHECK (stenosis_percent BETWEEN 0 AND 100),
      lesion_length_mm SMALLINT,
      is_calcified     BOOLEAN DEFAULT FALSE,
      is_bifurcation   BOOLEAN DEFAULT FALSE,
      is_ostial        BOOLEAN DEFAULT FALSE,
      is_chronic_total_occlusion BOOLEAN DEFAULT FALSE,
      intervention_done BOOLEAN DEFAULT FALSE,
      stent_type       TEXT CHECK (stent_type IN ('des','bms','drug_coated_balloon','none')),
      stent_brand      TEXT,
      stent_diameter_mm NUMERIC(4,2),
      stent_length_mm  SMALLINT,
      ivus_done        BOOLEAN DEFAULT FALSE,
      oct_done         BOOLEAN DEFAULT FALSE,
      ffr_value        NUMERIC(4,3),
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cathlab_lesions_case ON cathlab_lesions(case_id)`,

    // ── Intra-procedure hemodynamic measurements ──────────────────────────
    `CREATE TABLE IF NOT EXISTS cathlab_hemodynamics (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id          UUID NOT NULL REFERENCES cathlab_cases(id) ON DELETE CASCADE,
      measured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      aortic_pressure_systolic SMALLINT,
      aortic_pressure_diastolic SMALLINT,
      lvedp            SMALLINT,
      map              SMALLINT,
      heart_rate       SMALLINT,
      spo2             SMALLINT,
      ffr_pullback     NUMERIC(4,3),
      notes            TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cathlab_hemo_case ON cathlab_hemodynamics(case_id)`,

    // ── Post-Procedure Monitoring ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cathlab_post_procedure (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id          UUID NOT NULL REFERENCES cathlab_cases(id) ON DELETE CASCADE,
      sheath_removal_at TIMESTAMPTZ,
      vascular_complication TEXT,
      post_troponin_result NUMERIC(8,4),
      post_ecg_result  TEXT,
      discharge_medications JSONB NOT NULL DEFAULT '[]'::jsonb,
      dapt_duration_months SMALLINT,
      discharge_at     TIMESTAMPTZ,
      follow_up_date   DATE,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cathlab_post_case ON cathlab_post_procedure(case_id)`,

    // ── STEMI Activation Log ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS stemi_activations (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      cathlab_case_id  UUID REFERENCES cathlab_cases(id),
      activated_by     UUID REFERENCES users(id),
      activation_source TEXT CHECK (activation_source IN ('emergency_ecg','ambulance','clinic_ecg','self_referral')),
      ecg_at           TIMESTAMPTZ,
      door_in_at       TIMESTAMPTZ,
      cath_lab_ready_at TIMESTAMPTZ,
      balloon_at       TIMESTAMPTZ,
      d2b_mins         INTEGER GENERATED ALWAYS AS (
                         EXTRACT(EPOCH FROM (balloon_at - door_in_at)) / 60
                       ) STORED,
      outcome_target_met BOOLEAN GENERATED ALWAYS AS (
                         EXTRACT(EPOCH FROM (balloon_at - door_in_at)) / 60 <= 90
                       ) STORED,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_stemi_patient ON stemi_activations(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stemi_activation_at ON stemi_activations(activation_source)`,

    // ── D2B Quality Metrics view ──────────────────────────────────────────
    `CREATE OR REPLACE VIEW cathlab_d2b_metrics AS
      SELECT
        DATE_TRUNC('month', door_in_at) AS month,
        COUNT(*) AS total_stemis,
        COUNT(*) FILTER (WHERE outcome_target_met) AS met_target,
        ROUND(AVG(d2b_mins)) AS avg_d2b_mins,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d2b_mins)) AS median_d2b_mins
      FROM stemi_activations
      WHERE balloon_at IS NOT NULL
      GROUP BY DATE_TRUNC('month', door_in_at)
      ORDER BY month DESC`,

    `CREATE OR REPLACE TRIGGER trg_cathlab_cases_updated_at
      BEFORE UPDATE ON cathlab_cases
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  ],
},
```

---

## Cornerstone 2: Backend — NestJS EHR Service

### Controller

**Create file:** `services/ehr-service/src/controllers/cathlab.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CathLabService } from '../services/cathlab.service';

@UseGuards(JwtAuthGuard)
@Controller('cathlab')
export class CathLabController {
  constructor(private readonly cath: CathLabService) {}

  // ── Case scheduling & management ──────────────────────────────────────

  @Post('cases')
  scheduleCase(
    @Req() req: any,
    @Body() body: {
      patientId: string;
      encounterId?: string;
      procedureType: string;
      indication?: string;
      priority?: string;
      scheduledAt?: string;
      referringCardiologistId?: string;
    },
  ) {
    return this.cath.scheduleCase(req.tenantDb, req.user.id, body);
  }

  @Get('cases')
  listCases(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('date') date?: string,
  ) {
    return this.cath.listCases(req.tenantDb, { status, priority, date });
  }

  @Get('cases/:id')
  getCase(@Req() req: any, @Param('id') id: string) {
    return this.cath.getCase(req.tenantDb, id);
  }

  @Patch('cases/:id/start')
  startCase(@Req() req: any, @Param('id') id: string, @Body() body: { accessSite?: string }) {
    return this.cath.startCase(req.tenantDb, id, body.accessSite);
  }

  @Patch('cases/:id/complete')
  completeCase(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: {
      contrastVolumeMl?: number;
      fluoroscopyTimeMins?: number;
      timiFlowPre?: number;
      timiFlowPost?: number;
      complications?: string[];
      outcome: string;
      notes?: string;
    },
  ) {
    return this.cath.completeCase(req.tenantDb, id, body);
  }

  // ── Lesions ───────────────────────────────────────────────────────────

  @Post('cases/:id/lesions')
  addLesion(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: {
      vessel: string;
      stenosisPercent?: number;
      lesionLengthMm?: number;
      isCalcified?: boolean;
      isBifurcation?: boolean;
      isCto?: boolean;
      interventionDone?: boolean;
      stentType?: string;
      stentBrand?: string;
      stentDiameterMm?: number;
      stentLengthMm?: number;
      ivusDone?: boolean;
      octDone?: boolean;
      ffrValue?: number;
      notes?: string;
    },
  ) {
    return this.cath.addLesion(req.tenantDb, caseId, body);
  }

  @Get('cases/:id/lesions')
  getLesions(@Req() req: any, @Param('id') caseId: string) {
    return this.cath.getLesions(req.tenantDb, caseId);
  }

  // ── Hemodynamics ──────────────────────────────────────────────────────

  @Post('cases/:id/hemodynamics')
  recordHemodynamics(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: { aorticSystolic?: number; aorticDiastolic?: number; lvedp?: number; heartRate?: number; spo2?: number; notes?: string },
  ) {
    return this.cath.recordHemodynamics(req.tenantDb, caseId, body);
  }

  // ── STEMI Activation ──────────────────────────────────────────────────

  @Post('stemi/activate')
  activateStemi(
    @Req() req: any,
    @Body() body: { patientId: string; activationSource: string; ecgAt?: string; doorInAt?: string; notes?: string },
  ) {
    return this.cath.activateStemi(req.tenantDb, req.user.id, body);
  }

  @Patch('stemi/:id/balloon')
  recordBalloon(@Req() req: any, @Param('id') id: string, @Body() body: { balloonAt: string; cathlabCaseId?: string }) {
    return this.cath.recordBalloonTime(req.tenantDb, id, body);
  }

  @Get('stemi/d2b-metrics')
  getD2bMetrics(@Req() req: any) {
    return this.cath.getD2bMetrics(req.tenantDb);
  }

  // ── Post-procedure ────────────────────────────────────────────────────

  @Post('cases/:id/post-procedure')
  recordPostProcedure(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: { sheathRemovalAt?: string; vascularComplication?: string; postTroponin?: number; daptDurationMonths?: number; followUpDate?: string; dischargeMedications?: any[]; notes?: string },
  ) {
    return this.cath.recordPostProcedure(req.tenantDb, caseId, body);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.cath.getDashboard(req.tenantDb);
  }

  @Get('patients/:patientId/cases')
  getPatientCases(@Req() req: any, @Param('patientId') patientId: string) {
    return this.cath.getPatientCases(req.tenantDb, patientId);
  }
}
```

### Service (key methods)

**Create file:** `services/ehr-service/src/services/cathlab.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class CathLabService {

  async scheduleCase(db: any, operatorId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_cases (patient_id, encounter_id, procedure_type, indication, priority, scheduled_at, operator_id, referring_cardiologist_id)
       VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7,$8)
       RETURNING *`,
      [body.patientId, body.encounterId ?? null, body.procedureType, body.indication, body.priority ?? 'elective',
       body.scheduledAt ?? null, operatorId, body.referringCardiologistId ?? null],
    );
    return rows[0] ?? null;
  }

  async listCases(db: any, filters: { status?: string; priority?: string; date?: string }): Promise<any[]> {
    return db.query(
      `SELECT cc.id, cc.procedure_type, cc.priority, cc.status, cc.scheduled_at, cc.door_to_balloon_mins,
              p.first_name, p.last_name, p.date_of_birth
       FROM cathlab_cases cc
       JOIN patients p ON p.id = cc.patient_id
       WHERE ($1::text IS NULL OR cc.status = $1)
         AND ($2::text IS NULL OR cc.priority = $2)
         AND ($3::date IS NULL OR cc.scheduled_at::date = $3::date)
       ORDER BY cc.scheduled_at DESC NULLS LAST`,
      [filters.status ?? null, filters.priority ?? null, filters.date ?? null],
    );
  }

  async getCase(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `SELECT cc.*, p.first_name, p.last_name, p.date_of_birth, p.gender
       FROM cathlab_cases cc
       JOIN patients p ON p.id = cc.patient_id
       WHERE cc.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async startCase(db: any, id: string, accessSite?: string): Promise<any> {
    const rows = await db.query(
      `UPDATE cathlab_cases SET status='in_progress', started_at=NOW(), access_site=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [accessSite ?? null, id],
    );
    return rows[0] ?? null;
  }

  async completeCase(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE cathlab_cases SET
         status='completed', ended_at=NOW(),
         contrast_volume_ml=$1, fluoroscopy_time_mins=$2,
         timi_flow_pre=$3, timi_flow_post=$4,
         complications=$5::jsonb, outcome=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [body.contrastVolumeMl, body.fluoroscopyTimeMins, body.timiFlowPre, body.timiFlowPost,
       JSON.stringify(body.complications ?? []), body.outcome, body.notes, id],
    );
    return rows[0] ?? null;
  }

  async addLesion(db: any, caseId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_lesions (case_id, vessel, stenosis_percent, lesion_length_mm, is_calcified, is_bifurcation,
         is_chronic_total_occlusion, intervention_done, stent_type, stent_brand, stent_diameter_mm, stent_length_mm,
         ivus_done, oct_done, ffr_value, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [caseId, body.vessel, body.stenosisPercent, body.lesionLengthMm, body.isCalcified ?? false,
       body.isBifurcation ?? false, body.isCto ?? false, body.interventionDone ?? false,
       body.stentType ?? 'none', body.stentBrand, body.stentDiameterMm, body.stentLengthMm,
       body.ivusDone ?? false, body.octDone ?? false, body.ffrValue, body.notes],
    );
    return rows[0] ?? null;
  }

  async getLesions(db: any, caseId: string): Promise<any[]> {
    return db.query(`SELECT * FROM cathlab_lesions WHERE case_id=$1 ORDER BY vessel`, [caseId]);
  }

  async recordHemodynamics(db: any, caseId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_hemodynamics (case_id, aortic_pressure_systolic, aortic_pressure_diastolic, lvedp, heart_rate, spo2, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [caseId, body.aorticSystolic, body.aorticDiastolic, body.lvedp, body.heartRate, body.spo2, body.notes],
    );
    return rows[0] ?? null;
  }

  async activateStemi(db: any, activatedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO stemi_activations (patient_id, activated_by, activation_source, ecg_at, door_in_at, notes)
       VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6) RETURNING *`,
      [body.patientId, activatedBy, body.activationSource, body.ecgAt ?? null, body.doorInAt ?? 'NOW()', body.notes],
    );
    return rows[0] ?? null;
  }

  async recordBalloonTime(db: any, activationId: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE stemi_activations SET balloon_at=$1::timestamptz, cathlab_case_id=$2 WHERE id=$3 RETURNING *, d2b_mins, outcome_target_met`,
      [body.balloonAt, body.cathlabCaseId ?? null, activationId],
    );
    return rows[0] ?? null;
  }

  async getD2bMetrics(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM cathlab_d2b_metrics LIMIT 12`);
  }

  async recordPostProcedure(db: any, caseId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_post_procedure (case_id, sheath_removal_at, vascular_complication, post_troponin_result,
         dapt_duration_months, follow_up_date, discharge_medications, notes)
       VALUES ($1,$2::timestamptz,$3,$4,$5,$6::date,$7::jsonb,$8) RETURNING *`,
      [caseId, body.sheathRemovalAt, body.vascularComplication, body.postTroponin, body.daptDurationMonths,
       body.followUpDate, JSON.stringify(body.dischargeMedications ?? []), body.notes],
    );
    return rows[0] ?? null;
  }

  async getDashboard(db: any): Promise<any> {
    const [today, stemi30d, d2b] = await Promise.all([
      db.query(`SELECT status, COUNT(*) AS cnt FROM cathlab_cases WHERE scheduled_at::date = CURRENT_DATE GROUP BY status`),
      db.query(`SELECT COUNT(*) AS cnt, ROUND(AVG(d2b_mins)) AS avg_d2b FROM stemi_activations WHERE door_in_at >= CURRENT_DATE - 30`),
      db.query(`SELECT COUNT(*) FILTER (WHERE outcome_target_met) AS met, COUNT(*) AS total FROM stemi_activations WHERE door_in_at >= CURRENT_DATE - 90`),
    ]);
    return { todayCases: today, stemi30d: stemi30d[0], d2bQuality: d2b[0] };
  }

  async getPatientCases(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT cc.id, cc.procedure_type, cc.priority, cc.status, cc.scheduled_at, cc.outcome, cc.timi_flow_post
       FROM cathlab_cases cc
       WHERE cc.patient_id = $1
       ORDER BY cc.scheduled_at DESC NULLS LAST`,
      [patientId],
    );
  }
}
```

### Module registration

**File:** `services/ehr-service/src/ehr.module.ts`

```typescript
import { CathLabController } from './controllers/cathlab.controller';
import { CathLabService } from './services/cathlab.service';
// Add to controllers: [] and providers: []
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/CathLabDashboard.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Heart, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api';

const PRIORITY_COLORS: Record<string, string> = {
  elective: '#3B9EFF',
  urgent: '#F0954A',
  stemi_primary_pci: '#E8614D',
  emergency: '#C62828',
};

const VESSEL_LABELS: Record<string, string> = {
  lad: 'LAD', lcx: 'LCx', rca: 'RCA', lmca: 'LMCA',
  diagonal_1: 'D1', diagonal_2: 'D2', om1: 'OM1', om2: 'OM2',
};

export default function CathLabDashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/cathlab/cases?status=scheduled'),
      api.get('/cathlab/dashboard'),
    ]).then(([c, d]) => {
      setCases(c.data ?? c);
      setDash(d.data ?? d);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#7A9CBC]">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: '#E8614D22' }}>
          <Heart size={24} color="#E8614D" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}>
            Cardiac Catheterisation Lab
          </h1>
          <p className="text-[#7A9CBC] text-sm">Zimbabwe's only CathLab — powered by Umoya</p>
        </div>
      </div>

      {/* D2B Quality Banner */}
      {dash?.d2bQuality && (
        <div className="mb-6 p-4 rounded-[14px] border"
          style={{ background: '#E8614D11', borderColor: '#E8614D44' }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} color="#E8614D" />
            <span className="text-sm font-semibold text-[#E8614D]">STEMI D2B Quality (90-day)</span>
          </div>
          <div className="flex gap-6 text-sm">
            <span>Target met: <strong style={{ color: '#22C55E' }}>{dash.d2bQuality.met}</strong> / {dash.d2bQuality.total}</span>
            <span>Avg D2B: <strong style={{ color: Number(dash?.stemi30d?.avg_d2b) <= 90 ? '#22C55E' : '#E8614D' }}>
              {dash?.stemi30d?.avg_d2b ?? '—'} min
            </strong></span>
          </div>
        </div>
      )}

      {/* Today's List */}
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
        <h2 className="text-base font-semibold mb-4">Scheduled Cases</h2>
        {cases.length === 0
          ? <p className="text-[#7A9CBC] text-sm">No cases scheduled today.</p>
          : cases.map(c => (
            <div key={c.id} className="flex items-center gap-4 py-3 border-b border-[#162440] last:border-0">
              <span className="text-xs font-bold px-2 py-1 rounded-full"
                style={{ background: `${PRIORITY_COLORS[c.priority]}22`, color: PRIORITY_COLORS[c.priority] }}>
                {c.priority.replace(/_/g, ' ').toUpperCase()}
              </span>
              <div className="flex-1">
                <div className="font-medium">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-[#7A9CBC]">{c.procedure_type.replace(/_/g, ' ')}</div>
              </div>
              <div className="text-xs text-[#7A9CBC]">
                {c.scheduled_at ? new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
```

**Add to App router:**
```tsx
<Route path="/cathlab" element={<CathLabDashboard />} />
```

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/CathLabScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Heart, Clock } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const PRIORITY_COLOR: Record<string, string> = {
  elective: C.blue,
  urgent: C.amber,
  stemi_primary_pci: C.coral,
  emergency: C.red,
};

export default function CathLabScreen() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cathlab/cases')
      .then((r: any) => setCases(r.data ?? r))
      .catch(() => Alert.alert('Error', 'Could not load cath lab cases.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.coral} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Heart size={22} color={C.coral} />
        <Text style={styles.heading}>Cath Lab</Text>
      </View>

      <FlatList
        data={cases}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View style={styles.row}>
              <Text style={[styles.priority, { color: PRIORITY_COLOR[item.priority] ?? C.blue }]}>
                {item.priority.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <View style={[styles.statusDot, { backgroundColor: item.status === 'in_progress' ? C.amber : C.green }]} />
            </View>
            <Text style={styles.patientName}>{item.first_name} {item.last_name}</Text>
            <Text style={styles.procType}>{(item.procedure_type ?? '').replace(/_/g, ' ')}</Text>
            {item.scheduled_at && (
              <View style={styles.timeRow}>
                <Clock size={12} color={C.textSecondary} />
                <Text style={styles.timeText}>
                  {new Date(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No cases today.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.sm },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  priority:    { fontFamily: FONT.uiSb, fontSize: 11, letterSpacing: 0.5 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  patientName: { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, marginBottom: 2 },
  procType:    { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText:    { fontFamily: FONT.mono, fontSize: 12, color: C.textSecondary },
  empty:       { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
```

**Register in `mobile/src/navigation/RootNavigator.tsx`:**
```tsx
import CathLabScreen from '../screens/CathLabScreen';
<Stack.Screen name="CathLab" component={CathLabScreen} options={{ title: 'Cath Lab' }} />
```

---

## CDSS / AI (S233 preview — wire these in S233)

Key Python functions to implement in S233:
- `compute_mehran_contrast_risk(age, scr, dm, chf, hypotension, iabp, contrast_volume, egfr)` → risk score + recommendation
- `interpret_stemi_ecg(ecg_leads: dict)` → ST-elevation flag per territory
- `recommend_dapt_duration(stent_type, indication, has_bled_score, precise_dapt_score)` → months

---

## Acceptance Criteria

- [ ] `cathlab_cases`, `cathlab_lesions`, `cathlab_hemodynamics`, `cathlab_post_procedure`, `stemi_activations` provision on new tenant
- [ ] `cathlab_d2b_metrics` view created
- [ ] `POST /cathlab/stemi/activate` creates STEMI record with D2B timer
- [ ] `PATCH /cathlab/stemi/:id/balloon` records balloon time; `d2b_mins` computed automatically
- [ ] `GET /cathlab/stemi/d2b-metrics` returns monthly D2B metrics
- [ ] Lesion record accepts all vessel types including LMCA, grafts
- [ ] `CathLabDashboard.tsx` shows D2B quality banner in coral (#E8614D) when average > 90 min
- [ ] `CathLabScreen.tsx` renders on mobile with correct UMOYA design tokens
- [ ] `'cathlab'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
