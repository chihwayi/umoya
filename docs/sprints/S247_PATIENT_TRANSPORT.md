# Sprint 247 — Patient Transport & Ambulance Management

**Module key:** `patient_transport`
**Bundle ID:** `sprint247_patient_transport`
**Version:** `2026.06.23.0`
**Depends on:** none (standalone; references `patients` and `users`)
**Followed by:** S248 (Aesthetics & Wellness)

---

## Sprint Goal

Build a Patient Transport module covering:
1. **Ambulance fleet register** — vehicle details, crew assignments, equipment list, maintenance status
2. **Dispatch management** — call intake, resource allocation, response time tracking
3. **MIST handover documentation** — structured pre-hospital to ED handover (Mechanism, Injuries, Signs, Treatment)
4. **Inter-facility transfer records** — referring facility, receiving facility, transfer indication, patient condition at departure/arrival
5. **Response time quality metrics** — P1/P2/P3 category response time compliance dashboard

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint247_patient_transport',
  label: 'Sprint 247 — Patient Transport: fleet register, dispatch, MIST handover, inter-facility transfer, response metrics',
  version: '2026.06.23.0',
  description: 'transport_vehicles, transport_jobs, transport_mist_handovers, inter_facility_transfers',
  statements: () => [
    // ── Vehicle Fleet ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS transport_vehicles (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      call_sign       TEXT NOT NULL UNIQUE,
      registration    TEXT NOT NULL,
      vehicle_type    TEXT NOT NULL CHECK (vehicle_type IN ('als_ambulance','bls_ambulance','patient_transport_vehicle','rapid_response','helicopter')),
      status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','on_call','dispatched','maintenance','offline')),
      base_station    TEXT NOT NULL,
      crew_min        SMALLINT NOT NULL DEFAULT 2,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      notes           TEXT
    )`,

    // ── Transport Jobs (Dispatches) ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS transport_jobs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_ref         TEXT NOT NULL UNIQUE,
      patient_id      UUID REFERENCES patients(id),
      vehicle_id      UUID REFERENCES transport_vehicles(id),
      call_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      dispatched_at   TIMESTAMPTZ,
      arrived_scene_at TIMESTAMPTZ,
      departed_scene_at TIMESTAMPTZ,
      arrived_hospital_at TIMESTAMPTZ,
      cleared_at      TIMESTAMPTZ,
      priority        TEXT NOT NULL DEFAULT 'p2' CHECK (priority IN ('p1','p2','p3')),
      incident_type   TEXT NOT NULL,
      scene_address   TEXT,
      destination     TEXT,
      receiving_clinician TEXT,
      crew_lead       UUID REFERENCES users(id),
      response_time_mins NUMERIC(6,2) GENERATED ALWAYS AS (
                            CASE WHEN dispatched_at IS NOT NULL AND arrived_scene_at IS NOT NULL
                                 THEN EXTRACT(EPOCH FROM (arrived_scene_at - dispatched_at)) / 60
                                 ELSE NULL END
                          ) STORED,
      p1_target_met   BOOLEAN GENERATED ALWAYS AS (
                          priority = 'p1' AND dispatched_at IS NOT NULL AND arrived_scene_at IS NOT NULL
                          AND EXTRACT(EPOCH FROM (arrived_scene_at - dispatched_at)) / 60 <= 8
                        ) STORED,
      outcome         TEXT CHECK (outcome IN ('transported','treated_on_scene','refused_transport','deceased_on_scene','cancelled',NULL)),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_transport_jobs_vehicle ON transport_jobs(vehicle_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transport_jobs_patient ON transport_jobs(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transport_jobs_priority ON transport_jobs(priority, call_received_at DESC)`,

    // ── MIST Handovers ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS transport_mist_handovers (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id          UUID NOT NULL REFERENCES transport_jobs(id) ON DELETE CASCADE,
      patient_id      UUID REFERENCES patients(id),
      handover_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      mechanism       TEXT NOT NULL,
      injuries_found  TEXT NOT NULL,
      signs           JSONB NOT NULL DEFAULT '{}'::jsonb,
      treatment_given JSONB NOT NULL DEFAULT '[]'::jsonb,
      gcs_at_scene    SMALLINT CHECK (gcs_at_scene BETWEEN 3 AND 15),
      spo2_at_scene   NUMERIC(4,1),
      rr_at_scene     SMALLINT,
      bp_systolic_scene SMALLINT,
      bp_diastolic_scene SMALLINT,
      iv_access       BOOLEAN NOT NULL DEFAULT FALSE,
      iv_fluids_ml    SMALLINT,
      airway_adjunct  TEXT,
      handover_to     UUID REFERENCES users(id),
      received_by     UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mist_job ON transport_mist_handovers(job_id)`,

    -- ── Inter-facility Transfers ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS inter_facility_transfers (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      job_id          UUID REFERENCES transport_jobs(id),
      transfer_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      referring_facility TEXT NOT NULL,
      referring_clinician TEXT,
      receiving_facility TEXT NOT NULL,
      receiving_clinician TEXT,
      transfer_indication TEXT NOT NULL,
      transfer_level  TEXT NOT NULL CHECK (transfer_level IN ('basic','advanced','critical_care')),
      gcs_at_departure SMALLINT,
      spo2_at_departure NUMERIC(4,1),
      bp_systolic_departure SMALLINT,
      iv_access_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      monitoring_during TEXT,
      condition_at_arrival TEXT,
      gcs_at_arrival  SMALLINT,
      accepted_by     UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ift_patient ON inter_facility_transfers(patient_id)`,

    // ── Response Time Quality View ─────────────────────────────────────────
    `CREATE OR REPLACE VIEW transport_response_quality AS
      SELECT
        DATE_TRUNC('month', call_received_at)::date AS month,
        priority,
        COUNT(*) AS total_jobs,
        AVG(response_time_mins) AS avg_response_mins,
        COUNT(CASE WHEN priority = 'p1' AND p1_target_met THEN 1 END) AS p1_on_target,
        COUNT(CASE WHEN priority = 'p1' THEN 1 END) AS p1_total,
        ROUND(COUNT(CASE WHEN priority = 'p1' AND p1_target_met THEN 1 END)::numeric
              / NULLIF(COUNT(CASE WHEN priority = 'p1' THEN 1 END), 0) * 100, 1) AS p1_compliance_pct
      FROM transport_jobs
      GROUP BY DATE_TRUNC('month', call_received_at), priority
      ORDER BY month DESC, priority`,
  ],
},
```

**Add `patient_transport` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/patient-transport.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientTransportService } from '../services/patient-transport.service';

@UseGuards(JwtAuthGuard)
@Controller('transport')
export class PatientTransportController {
  constructor(private readonly svc: PatientTransportService) {}

  @Get('vehicles')
  getFleet(@Req() req: any) {
    return this.svc.getFleet(req.tenantDb);
  }

  @Patch('vehicles/:id/status')
  updateVehicleStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateVehicleStatus(req.tenantDb, id, body.status);
  }

  @Post('jobs')
  createJob(
    @Req() req: any,
    @Body() body: {
      vehicleId?: string; priority: string; incidentType: string;
      sceneAddress?: string; destination?: string; patientId?: string;
    },
  ) {
    return this.svc.createJob(req.tenantDb, req.user.id, body);
  }

  @Patch('jobs/:id/timeline')
  updateTimeline(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { event: 'dispatched' | 'arrived_scene' | 'departed_scene' | 'arrived_hospital' | 'cleared'; outcome?: string },
  ) {
    return this.svc.updateJobTimeline(req.tenantDb, id, body);
  }

  @Get('jobs/active')
  getActiveJobs(@Req() req: any) {
    return this.svc.getActiveJobs(req.tenantDb);
  }

  @Post('mist-handover')
  recordMistHandover(@Req() req: any, @Body() body: any) {
    return this.svc.recordMistHandover(req.tenantDb, req.user.id, body);
  }

  @Post('inter-facility')
  recordInterFacilityTransfer(@Req() req: any, @Body() body: any) {
    return this.svc.recordInterFacilityTransfer(req.tenantDb, req.user.id, body);
  }

  @Get('quality-metrics')
  getQualityMetrics(@Req() req: any) {
    return this.svc.getQualityMetrics(req.tenantDb);
  }
}
```

**Create file:** `services/ehr-service/src/services/patient-transport.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

const EVENT_COLUMN: Record<string, string> = {
  dispatched:       'dispatched_at',
  arrived_scene:    'arrived_scene_at',
  departed_scene:   'departed_scene_at',
  arrived_hospital: 'arrived_hospital_at',
  cleared:          'cleared_at',
};

@Injectable()
export class PatientTransportService {

  async getFleet(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM transport_vehicles WHERE is_active ORDER BY call_sign`);
  }

  async updateVehicleStatus(db: any, id: string, status: string): Promise<any> {
    const rows = await db.query(
      `UPDATE transport_vehicles SET status=$1 WHERE id=$2 RETURNING *`,
      [status, id],
    );
    return rows[0] ?? null;
  }

  async createJob(db: any, crewLead: string, body: any): Promise<any> {
    const ref = `JOB-${Date.now().toString(36).toUpperCase()}`;
    const rows = await db.query(
      `INSERT INTO transport_jobs (job_ref, patient_id, vehicle_id, priority, incident_type, scene_address, destination, crew_lead)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [ref, body.patientId ?? null, body.vehicleId ?? null, body.priority ?? 'p2', body.incidentType, body.sceneAddress ?? null, body.destination ?? null, crewLead],
    );
    // Mark vehicle as dispatched
    if (body.vehicleId) {
      await db.query(`UPDATE transport_vehicles SET status='dispatched' WHERE id=$1`, [body.vehicleId]);
    }
    return rows[0] ?? null;
  }

  async updateJobTimeline(db: any, id: string, body: any): Promise<any> {
    const col = EVENT_COLUMN[body.event];
    if (!col) throw new Error(`Unknown event: ${body.event}`);
    const extra = body.outcome ? `, outcome=$2` : '';
    const params: any[] = [id];
    if (body.outcome) params.push(body.outcome);
    const rows = await db.query(
      `UPDATE transport_jobs SET ${col}=NOW()${extra} WHERE id=$1 RETURNING *, response_time_mins, p1_target_met`,
      params,
    );
    const result = rows[0];
    // Free up vehicle if cleared
    if (body.event === 'cleared' && result?.vehicle_id) {
      await db.query(`UPDATE transport_vehicles SET status='available' WHERE id=$1`, [result.vehicle_id]);
    }
    return result ?? null;
  }

  async getActiveJobs(db: any): Promise<any[]> {
    return db.query(
      `SELECT tj.*, tv.call_sign, p.first_name, p.last_name
       FROM transport_jobs tj
       LEFT JOIN transport_vehicles tv ON tv.id = tj.vehicle_id
       LEFT JOIN patients p ON p.id = tj.patient_id
       WHERE tj.cleared_at IS NULL
       ORDER BY tj.priority ASC, tj.call_received_at ASC`,
    );
  }

  async recordMistHandover(db: any, handoverTo: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO transport_mist_handovers (job_id, patient_id, mechanism, injuries_found, signs, treatment_given, gcs_at_scene, spo2_at_scene, rr_at_scene, bp_systolic_scene, bp_diastolic_scene, iv_access, iv_fluids_ml, airway_adjunct, handover_to)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [body.jobId, body.patientId ?? null, body.mechanism, body.injuriesFound, JSON.stringify(body.signs ?? {}), JSON.stringify(body.treatmentGiven ?? []), body.gcsAtScene ?? null, body.spo2AtScene ?? null, body.rrAtScene ?? null, body.bpSystolicScene ?? null, body.bpDiastolicScene ?? null, body.ivAccess ?? false, body.ivFluidsMl ?? null, body.airwayAdjunct ?? null, handoverTo],
    );
    return rows[0] ?? null;
  }

  async recordInterFacilityTransfer(db: any, acceptedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO inter_facility_transfers (patient_id, job_id, referring_facility, referring_clinician, receiving_facility, receiving_clinician, transfer_indication, transfer_level, gcs_at_departure, spo2_at_departure, bp_systolic_departure, iv_access_confirmed, monitoring_during, accepted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [body.patientId, body.jobId ?? null, body.referringFacility, body.referringClinician ?? null, body.receivingFacility, body.receivingClinician ?? null, body.transferIndication, body.transferLevel, body.gcsAtDeparture ?? null, body.spo2AtDeparture ?? null, body.bpSystolicDeparture ?? null, body.ivAccessConfirmed ?? false, body.monitoringDuring ?? null, acceptedBy],
    );
    return rows[0] ?? null;
  }

  async getQualityMetrics(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM transport_response_quality LIMIT 24`);
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/TransportDashboard.tsx`:
- **Live Dispatch Board** — grid of active jobs: call sign, job ref, priority chip (P1=red, P2=amber, P3=teal), elapsed time counter, incident type
- **Fleet Status Strip** — vehicle cards at top: green=available, amber=on_call, coral=dispatched, grey=maintenance
- **Response Time Gauge** — P1 compliance % as large number with target line at 75% (industry standard)

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/TransportDispatchScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Truck, AlertTriangle, Clock } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const PRIORITY_COLOR: Record<string, string> = { p1: C.red, p2: C.amber, p3: C.teal };
const VEHICLE_STATUS_COLOR: Record<string, string> = {
  available: C.green, on_call: C.amber, dispatched: C.coral, maintenance: C.textMuted, offline: C.textMuted,
};

export default function TransportDispatchScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/transport/jobs/active').then((r: any) => setJobs(r.data ?? r)),
      api.get('/transport/vehicles').then((r: any) => setVehicles(r.data ?? r)),
    ]).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Transport Dispatch</Text>

      {/* Fleet strip */}
      <FlatList
        data={vehicles}
        horizontal
        keyExtractor={v => v.id}
        style={{ marginBottom: 16, maxHeight: 60 }}
        renderItem={({ item }) => (
          <View style={[s.vehicleChip, { borderColor: VEHICLE_STATUS_COLOR[item.status] }]}>
            <Truck size={12} color={VEHICLE_STATUS_COLOR[item.status]} />
            <Text style={[s.vehicleText, { color: VEHICLE_STATUS_COLOR[item.status] }]}> {item.call_sign}</Text>
          </View>
        )}
      />

      <Text style={s.section}>Active Jobs ({jobs.length})</Text>
      <FlatList
        data={jobs}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[s.card, { borderLeftColor: PRIORITY_COLOR[item.priority], borderLeftWidth: 4 }]}>
            <View style={s.row}>
              <Text style={[s.priority, { color: PRIORITY_COLOR[item.priority] }]}>{item.priority?.toUpperCase()}</Text>
              <Text style={s.ref}>{item.job_ref}</Text>
              {item.call_sign && <Text style={s.callSign}>• {item.call_sign}</Text>}
            </View>
            <Text style={s.incident}>{item.incident_type}</Text>
            {item.scene_address && <Text style={s.address}>{item.scene_address}</Text>}
            <View style={s.row}>
              <Clock size={12} color={C.textMuted} />
              <Text style={s.time}> {new Date(item.call_received_at).toLocaleTimeString()}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 12 },
  vehicleChip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  vehicleText: { fontFamily: FONT.uiMd, fontSize: 11 },
  section:     { fontFamily: FONT.uiSb, fontSize: 14, color: C.textSecondary, marginBottom: 10 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  priority:    { fontFamily: FONT.uiBd, fontSize: 13 },
  ref:         { fontFamily: FONT.mono, fontSize: 11, color: C.textSecondary },
  callSign:    { fontFamily: FONT.uiMd, fontSize: 11, color: C.teal },
  incident:    { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, marginBottom: 2 },
  address:     { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginBottom: 4 },
  time:        { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
});
```

**Register:** `<Stack.Screen name="TransportDispatch" component={TransportDispatchScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
@app.post("/transport/cdss/priority-triage")
async def transport_priority_triage(body: dict):
    """
    Determine dispatch priority from pre-hospital chief complaint.
    body: { complaint: str, gcs: int, spo2: float, rr: int, bp_systolic: int, is_paediatric: bool }
    """
    gcs      = body.get("gcs", 15)
    spo2     = body.get("spo2", 99)
    rr       = body.get("rr", 16)
    systolic = body.get("bp_systolic", 120)
    complaint = body.get("complaint", "").lower()

    p1_complaints = ["cardiac arrest","chest pain","stroke","unconscious","respiratory arrest","major trauma","penetrating trauma","obstetric emergency"]
    p2_complaints = ["fracture","abdominal pain","seizure","fall","head injury","diabetic","allergic reaction"]

    priority = "p3"  # default
    rationale = "Stable vitals, non-urgent complaint."

    if any(c in complaint for c in p1_complaints): priority = "p1"; rationale = f"High-risk complaint: '{complaint}'."
    if gcs < 14: priority = "p1"; rationale = f"GCS {gcs} — reduced consciousness."
    if spo2 < 94: priority = "p1"; rationale = f"SpO₂ {spo2}% — hypoxia."
    if rr < 8 or rr > 30: priority = "p1"; rationale = f"Abnormal RR {rr} — respiratory compromise."
    if systolic < 90: priority = "p1"; rationale = f"BP {systolic} mmHg — haemodynamic compromise."
    elif priority == "p3" and any(c in complaint for c in p2_complaints): priority = "p2"; rationale = f"Moderate-urgency complaint: '{complaint}'."

    return {"priority": priority, "rationale": rationale, "p1_response_target_mins": 8 if priority == "p1" else None}
```

---

## Acceptance Criteria

- [ ] `transport_jobs.response_time_mins` is a generated column from `(arrived_scene_at - dispatched_at) / 60`
- [ ] `transport_jobs.p1_target_met` is a generated column: TRUE when P1 and response ≤8 min
- [ ] `POST /transport/jobs` auto-updates vehicle status to `'dispatched'`
- [ ] `PATCH /transport/jobs/:id/timeline` with `event='cleared'` resets vehicle to `'available'`
- [ ] `GET /transport/quality-metrics` returns P1 compliance % from view
- [ ] `POST /transport/cdss/priority-triage` correctly returns P1 for GCS <14 and SpO₂ <94%
- [ ] `TransportDispatchScreen.tsx` shows P1=red, P2=amber, P3=teal left borders
- [ ] `'patient_transport'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
