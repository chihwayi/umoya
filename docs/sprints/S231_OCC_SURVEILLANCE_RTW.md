# Sprint 231 — Occupational Medicine: Exposure Surveillance & Return-to-Work

**Module key:** `occupational_medicine` (extends S230)
**Bundle ID:** `sprint231_occ_surveillance_rtw`
**Version:** `2026.06.23.0`
**Depends on:** `sprint230_occupational_medicine_core`
**Followed by:** S233 (CathLab AI)

---

## Sprint Goal

Extend the Occupational Medicine module with:
1. **Exposure surveillance register** — chemical, dust, noise, radiation and biological hazard exposure records per worker per visit
2. **Biological monitoring schedule** — audiometry, spirometry, blood lead, cholinesterase, urine metals, at configurable intervals per job type
3. **OSHA-equivalent periodic health surveillance workflow** — auto-schedule next periodic examination, overdue alerts
4. **Return-to-Work (RTW) coordination** — RTW assessment form, graded RTW plans with restriction codes, employer sign-off, CDSS job-demand matching

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint231_occ_surveillance_rtw',
  label: 'Sprint 231 — OEM Exposure Surveillance & Return-to-Work coordination',
  version: '2026.06.23.0',
  description: 'oem_hazard_profiles, oem_exposure_records, oem_biological_monitoring, oem_surveillance_schedule, oem_rtw_plans',
  statements: () => [
    // ── Hazard Profiles (per employer job type) ──────────────────────────
    `CREATE TABLE IF NOT EXISTS oem_hazard_profiles (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employer_id    UUID NOT NULL REFERENCES oem_employers(id) ON DELETE CASCADE,
      job_title      TEXT NOT NULL,
      hazard_type    TEXT NOT NULL CHECK (hazard_type IN ('chemical','dust','noise','radiation','biological','ergonomic','psychosocial')),
      agent_name     TEXT NOT NULL,
      exposure_limit TEXT,
      monitoring_interval_months SMALLINT NOT NULL DEFAULT 12,
      surveillance_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oem_hazard_employer ON oem_hazard_profiles(employer_id)`,

    // ── Exposure Records ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS oem_exposure_records (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      encounter_id    UUID NOT NULL REFERENCES oem_encounters(id) ON DELETE CASCADE,
      employee_id     UUID NOT NULL,
      employer_id     UUID NOT NULL REFERENCES oem_employers(id),
      hazard_type     TEXT NOT NULL,
      agent_name      TEXT NOT NULL,
      exposure_route  TEXT CHECK (exposure_route IN ('inhalation','skin','ingestion','injection','other')),
      duration_years  NUMERIC(5,2),
      twa_value       NUMERIC(8,3),
      twa_unit        TEXT,
      oel_value       NUMERIC(8,3),
      oel_unit        TEXT,
      exceeds_oel     BOOLEAN GENERATED ALWAYS AS (twa_value IS NOT NULL AND oel_value IS NOT NULL AND twa_value > oel_value) STORED,
      ppe_used        BOOLEAN NOT NULL DEFAULT FALSE,
      ppe_details     TEXT,
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oem_exposure_encounter ON oem_exposure_records(encounter_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_exposure_employer ON oem_exposure_records(employer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_exposure_exceeds ON oem_exposure_records(exceeds_oel) WHERE exceeds_oel = TRUE`,

    // ── Biological Monitoring Results ────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS oem_biological_monitoring (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      encounter_id    UUID REFERENCES oem_encounters(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      test_type       TEXT NOT NULL,
      result_value    NUMERIC(10,4),
      result_unit     TEXT,
      biological_exposure_index_value NUMERIC(10,4),
      bei_unit        TEXT,
      exceeds_bei     BOOLEAN GENERATED ALWAYS AS (
                        result_value IS NOT NULL AND biological_exposure_index_value IS NOT NULL
                        AND result_value > biological_exposure_index_value
                      ) STORED,
      collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lab_ref         TEXT,
      notes           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oem_bio_mon_patient ON oem_biological_monitoring(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_bio_mon_exceeds ON oem_biological_monitoring(exceeds_bei) WHERE exceeds_bei = TRUE`,

    // ── Surveillance Schedule ────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS oem_surveillance_schedule (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      employer_id     UUID NOT NULL REFERENCES oem_employers(id),
      hazard_profile_id UUID REFERENCES oem_hazard_profiles(id),
      surveillance_type TEXT NOT NULL,
      due_date        DATE NOT NULL,
      completed_date  DATE,
      is_overdue      BOOLEAN GENERATED ALWAYS AS (completed_date IS NULL AND due_date < CURRENT_DATE) STORED,
      days_overdue    INTEGER GENERATED ALWAYS AS (
                        CASE WHEN completed_date IS NULL AND due_date < CURRENT_DATE
                             THEN (CURRENT_DATE - due_date) ELSE 0 END
                      ) STORED,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oem_surv_patient ON oem_surveillance_schedule(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_surv_overdue ON oem_surveillance_schedule(is_overdue, due_date) WHERE is_overdue = TRUE`,

    // ── Return-to-Work Plans ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS oem_rtw_plans (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      employer_id     UUID NOT NULL REFERENCES oem_employers(id),
      encounter_id    UUID REFERENCES oem_encounters(id),
      plan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      injury_illness  TEXT NOT NULL,
      restrictions    JSONB NOT NULL DEFAULT '[]'::jsonb,
      graded_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_rtw_date DATE,
      actual_rtw_date DATE,
      status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','modified','completed','withdrawn')),
      employer_signed BOOLEAN NOT NULL DEFAULT FALSE,
      employer_signed_at TIMESTAMPTZ,
      clinician_id    UUID REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oem_rtw_patient ON oem_rtw_plans(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_rtw_status ON oem_rtw_plans(status)`,
  ],
},
```

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/oem-surveillance.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OemSurveillanceService } from '../services/oem-surveillance.service';

@UseGuards(JwtAuthGuard)
@Controller('oem/surveillance')
export class OemSurveillanceController {
  constructor(private readonly svc: OemSurveillanceService) {}

  // ── Hazard Profiles ──────────────────────────────────────────────────────
  @Post('hazard-profiles')
  createHazardProfile(@Req() req: any, @Body() body: any) {
    return this.svc.createHazardProfile(req.tenantDb, body);
  }

  @Get('hazard-profiles/:employerId')
  getHazardProfiles(@Req() req: any, @Param('employerId') employerId: string) {
    return this.svc.getHazardProfiles(req.tenantDb, employerId);
  }

  // ── Exposure Records ─────────────────────────────────────────────────────
  @Post('exposure-records')
  recordExposure(@Req() req: any, @Body() body: any) {
    return this.svc.recordExposure(req.tenantDb, body);
  }

  @Get('exposure-records/:encounterId')
  getExposureRecords(@Req() req: any, @Param('encounterId') encounterId: string) {
    return this.svc.getExposureRecords(req.tenantDb, encounterId);
  }

  // ── Biological Monitoring ────────────────────────────────────────────────
  @Post('bio-monitoring')
  recordBioMonitoring(@Req() req: any, @Body() body: any) {
    return this.svc.recordBioMonitoring(req.tenantDb, body);
  }

  @Get('bio-monitoring/:patientId')
  getBioMonitoring(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getBioMonitoring(req.tenantDb, patientId);
  }

  // ── Surveillance Schedule ────────────────────────────────────────────────
  @Post('schedule')
  scheduleItem(@Req() req: any, @Body() body: any) {
    return this.svc.scheduleSurveillance(req.tenantDb, body);
  }

  @Get('overdue')
  getOverdue(@Req() req: any) {
    return this.svc.getOverdueSurveillance(req.tenantDb);
  }

  @Patch('schedule/:id/complete')
  markComplete(@Req() req: any, @Param('id') id: string) {
    return this.svc.markSurveillanceComplete(req.tenantDb, id);
  }

  // ── Return-to-Work ───────────────────────────────────────────────────────
  @Post('rtw')
  createRtwPlan(
    @Req() req: any,
    @Body() body: {
      patientId: string; employerId: string; encounterId?: string;
      injuryIllness: string; restrictions: any[]; gradedSchedule: any[];
      targetRtwDate?: string; notes?: string;
    },
  ) {
    return this.svc.createRtwPlan(req.tenantDb, req.user.id, body);
  }

  @Get('rtw/:patientId')
  getPatientRtwPlans(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientRtwPlans(req.tenantDb, patientId);
  }

  @Patch('rtw/:id/sign')
  employerSign(@Req() req: any, @Param('id') id: string) {
    return this.svc.employerSignRtw(req.tenantDb, id);
  }

  @Patch('rtw/:id/status')
  updateRtwStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateRtwStatus(req.tenantDb, id, body.status);
  }
}
```

**Create file:** `services/ehr-service/src/services/oem-surveillance.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class OemSurveillanceService {

  async createHazardProfile(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_hazard_profiles (employer_id, job_title, hazard_type, agent_name, exposure_limit, monitoring_interval_months, surveillance_tests)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
      [body.employerId, body.jobTitle, body.hazardType, body.agentName, body.exposureLimit ?? null, body.monitoringIntervalMonths ?? 12, JSON.stringify(body.surveillanceTests ?? [])],
    );
    return rows[0] ?? null;
  }

  async getHazardProfiles(db: any, employerId: string): Promise<any[]> {
    return db.query(`SELECT * FROM oem_hazard_profiles WHERE employer_id=$1 ORDER BY job_title`, [employerId]);
  }

  async recordExposure(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_exposure_records (encounter_id, employee_id, employer_id, hazard_type, agent_name, exposure_route, duration_years, twa_value, twa_unit, oel_value, oel_unit, ppe_used, ppe_details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *, exceeds_oel`,
      [body.encounterId, body.employeeId, body.employerId, body.hazardType, body.agentName, body.exposureRoute ?? null, body.durationYears ?? null, body.twaValue ?? null, body.twaUnit ?? null, body.oelValue ?? null, body.oelUnit ?? null, body.ppeUsed ?? false, body.ppeDetails ?? null],
    );
    const result = rows[0];
    const alert = result?.exceeds_oel
      ? `⚠ OVEREXPOSURE: ${result.agent_name} TWA (${result.twa_value} ${result.twa_unit}) exceeds OEL (${result.oel_value} ${result.oel_unit}). Immediate engineering control review required.`
      : null;
    return { ...result, cdss_alert: alert };
  }

  async getExposureRecords(db: any, encounterId: string): Promise<any[]> {
    return db.query(`SELECT * FROM oem_exposure_records WHERE encounter_id=$1 ORDER BY recorded_at`, [encounterId]);
  }

  async recordBioMonitoring(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_biological_monitoring (encounter_id, patient_id, test_type, result_value, result_unit, biological_exposure_index_value, bei_unit, lab_ref, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *, exceeds_bei`,
      [body.encounterId ?? null, body.patientId, body.testType, body.resultValue ?? null, body.resultUnit ?? null, body.beiValue ?? null, body.beiUnit ?? null, body.labRef ?? null, body.notes ?? null],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.exceeds_bei
        ? `⚠ BEI EXCEEDED: ${result.test_type} result (${result.result_value} ${result.result_unit}) exceeds biological exposure index (${result.biological_exposure_index_value} ${result.bei_unit}). Reduce exposure, review job controls.`
        : null,
    };
  }

  async getBioMonitoring(db: any, patientId: string): Promise<any[]> {
    return db.query(`SELECT * FROM oem_biological_monitoring WHERE patient_id=$1 ORDER BY collected_at DESC`, [patientId]);
  }

  async scheduleSurveillance(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_surveillance_schedule (patient_id, employer_id, hazard_profile_id, surveillance_type, due_date)
       VALUES ($1,$2,$3,$4,$5::date) RETURNING *`,
      [body.patientId, body.employerId, body.hazardProfileId ?? null, body.surveillanceType, body.dueDate],
    );
    return rows[0] ?? null;
  }

  async getOverdueSurveillance(db: any): Promise<any[]> {
    return db.query(
      `SELECT oss.*, p.first_name, p.last_name, e.company_name
       FROM oem_surveillance_schedule oss
       JOIN patients p ON p.id = oss.patient_id
       JOIN oem_employers e ON e.id = oss.employer_id
       WHERE oss.is_overdue = TRUE
       ORDER BY oss.days_overdue DESC`,
    );
  }

  async markSurveillanceComplete(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `UPDATE oem_surveillance_schedule SET completed_date=CURRENT_DATE WHERE id=$1 RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createRtwPlan(db: any, clinicianId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_rtw_plans (patient_id, employer_id, encounter_id, injury_illness, restrictions, graded_schedule, target_rtw_date, notes, clinician_id)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::date,$8,$9) RETURNING *`,
      [body.patientId, body.employerId, body.encounterId ?? null, body.injuryIllness, JSON.stringify(body.restrictions ?? []), JSON.stringify(body.gradedSchedule ?? []), body.targetRtwDate ?? null, body.notes ?? null, clinicianId],
    );
    return rows[0] ?? null;
  }

  async getPatientRtwPlans(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT rp.*, e.company_name
       FROM oem_rtw_plans rp
       JOIN oem_employers e ON e.id = rp.employer_id
       WHERE rp.patient_id=$1 ORDER BY rp.plan_date DESC`,
      [patientId],
    );
  }

  async employerSignRtw(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `UPDATE oem_rtw_plans SET employer_signed=TRUE, employer_signed_at=NOW() WHERE id=$1 RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updateRtwStatus(db: any, id: string, status: string): Promise<any> {
    const rows = await db.query(
      `UPDATE oem_rtw_plans SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id],
    );
    return rows[0] ?? null;
  }
}
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/OemSurveillanceDashboard.tsx`

Key UI elements:
- **Overdue Surveillance Table** — patient name, employer, type, days overdue (coral badge `#E8614D` if overdue > 30 days, amber `#F0954A` if 1–30 days)
- **Exposure Register** — per-encounter exposure list; `exceeds_oel = true` rows highlighted coral
- **RTW Board** — Kanban-style columns: Pending → Active → Modified → Completed, drag not required, filter buttons

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/OemRtwScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ArrowRight, CheckCircle, Clock } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const STATUS_COLOR: Record<string, string> = {
  pending:   C.amber,
  active:    C.teal,
  modified:  C.blue,
  completed: C.green,
  withdrawn: C.textMuted,
};

export default function OemRtwScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/oem/surveillance/rtw/${patientId}`)
      .then((r: any) => setPlans(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Return-to-Work Plans</Text>
      <Text style={s.sub}>{patientName}</Text>

      {plans.length === 0 && (
        <Text style={s.empty}>No RTW plans on file.</Text>
      )}

      <FlatList
        data={plans}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.injury}>{item.injury_illness}</Text>
              <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={s.employer}>{item.company_name}</Text>
            {item.target_rtw_date && (
              <Text style={s.date}>Target RTW: {item.target_rtw_date}</Text>
            )}
            <View style={s.signRow}>
              {item.employer_signed
                ? <CheckCircle size={14} color={C.green} />
                : <Clock size={14} color={C.textMuted} />
              }
              <Text style={[s.signText, { color: item.employer_signed ? C.green : C.textMuted }]}>
                {item.employer_signed ? 'Employer signed' : 'Awaiting employer sign-off'}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:    { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:        { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  empty:      { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  injury:     { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, flex: 1 },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText:  { fontFamily: FONT.uiSb, fontSize: 11 },
  employer:   { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 4 },
  date:       { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 2 },
  signRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  signText:   { fontFamily: FONT.ui, fontSize: 12 },
});
```

**Register:** `<Stack.Screen name="OemRtw" component={OemRtwScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
# ── OEM Surveillance & RTW CDSS endpoints ──────────────────────────────────
RESTRICTION_CODES = {
    "no_lifting":          "No lifting > {kg} kg",
    "no_heights":          "No work at heights",
    "no_driving":          "Not fit to drive commercial vehicle",
    "light_duties":        "Light duties only — no manual labour",
    "limited_hours":       "Limited work hours: max {hours} h/day",
    "no_repetitive":       "No repetitive upper limb movements",
    "no_chemical_exposure":"No exposure to chemical agents until cleared",
    "no_noise_exposure":   "No high-noise environment exposure",
    "hearing_protection":  "Mandatory hearing protection at all times",
    "desk_only":           "Office/sedentary work only",
}

@app.post("/oem/cdss/rtw-job-match")
async def rtw_job_match(body: dict):
    """
    Match RTW restrictions against job physical demands to assess suitability.
    body: {
      restrictions: list[str],   # restriction_codes from oem_rtw_plans
      job_demands: {             # job physical demand classification
        lifting_kg: int,
        works_at_heights: bool,
        drives_commercial: bool,
        chemical_exposure: bool,
        noise_db: int,
        hours_per_day: int
      }
    }
    """
    restrictions = set(body.get("restrictions", []))
    demands = body.get("job_demands", {})
    conflicts = []

    if "no_lifting" in restrictions and demands.get("lifting_kg", 0) > 0:
        conflicts.append(f"Job requires lifting {demands['lifting_kg']} kg — worker has no-lifting restriction.")
    if "no_heights" in restrictions and demands.get("works_at_heights"):
        conflicts.append("Job involves heights — worker has restriction against working at heights.")
    if "no_driving" in restrictions and demands.get("drives_commercial"):
        conflicts.append("Job requires commercial driving — worker is not fit to drive.")
    if "no_chemical_exposure" in restrictions and demands.get("chemical_exposure"):
        conflicts.append("Job has chemical exposure — worker must not be exposed until cleared.")
    if "no_noise_exposure" in restrictions and demands.get("noise_db", 0) > 80:
        conflicts.append(f"Job noise level {demands['noise_db']} dB — worker has noise exposure restriction.")
    if "limited_hours" in restrictions and demands.get("hours_per_day", 0) > 6:
        conflicts.append(f"Job requires {demands['hours_per_day']} h/day — worker on limited hours.")

    return {
        "suitable_for_rtw": len(conflicts) == 0,
        "conflicts": conflicts,
        "recommendation": "CLEARED FOR RTW as per restrictions." if not conflicts else "NOT CLEARED — resolve conflicts before RTW."
    }

@app.post("/oem/cdss/exposure-risk")
async def exposure_risk_assessment(body: dict):
    """
    body: { hazard_type: str, agent_name: str, duration_years: float, twa: float, oel: float, ppe_used: bool }
    Returns risk level and recommendations.
    """
    twa = body.get("twa", 0.0)
    oel = body.get("oel", 1.0)
    ratio = twa / oel if oel > 0 else 0
    ppe = body.get("ppe_used", False)

    if ratio >= 2.0:
        level = "critical"
        action = "Immediate removal from exposure. Engineering controls mandatory. Medical surveillance escalation."
    elif ratio >= 1.0:
        level = "high"
        action = "Overexposure — reduce exposure urgently. Review engineering controls. Increase monitoring frequency."
    elif ratio >= 0.5:
        level = "moderate"
        action = "Approaching OEL. Monitor closely. Ensure PPE compliance. Quarterly biological monitoring."
    else:
        level = "low"
        action = "Within acceptable range. Maintain annual monitoring. PPE continues." if ppe else "Low ratio but PPE not used — enforce PPE policy."

    return {
        "risk_level": level,
        "twa_oel_ratio": round(ratio, 3),
        "recommendation": action,
        "ppe_compliant": ppe,
    }
```

---

## Acceptance Criteria

- [ ] `oem_exposure_records.exceeds_oel` is a generated column — computed without application logic
- [ ] `oem_biological_monitoring.exceeds_bei` is a generated column
- [ ] `oem_surveillance_schedule.is_overdue` and `days_overdue` are generated columns
- [ ] `POST /oem/surveillance/exposure-records` returns `cdss_alert` when `exceeds_oel=TRUE`
- [ ] `GET /oem/surveillance/overdue` returns all overdue items ordered by `days_overdue DESC`
- [ ] `PATCH /oem/surveillance/rtw/:id/sign` sets `employer_signed=TRUE` + timestamp
- [ ] `POST /oem/cdss/rtw-job-match` correctly identifies all conflicting restriction/demand pairs
- [ ] `OemRtwScreen.tsx` shows status badge with UMOYA palette colors
- [ ] Smoke test passes
