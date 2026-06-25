# Sprint 243 — Hyperbaric Medicine (HBOT)

**Module key:** `hyperbaric`
**Bundle ID:** `sprint243_hyperbaric`
**Version:** `2026.06.23.0`
**Depends on:** none (standalone; references `patients` and `users`)
**Followed by:** S244 (Prosthetics & Rehabilitation)

---

## Sprint Goal

Build a Hyperbaric Oxygen Therapy (HBOT) module covering:
1. **Chamber scheduling** — multi-chamber slot management with patient assignment
2. **Session records** — pressure (ATA), O₂ %, dive duration, air breaks, pre/post vitals
3. **Contraindication screening** — HBOT contraindication checklist run before each session
4. **Indication register** — approved indications per UHMS/ECHM (wound healing, CO poisoning, DCI, radiation necrosis, etc.)
5. **Wound progress tracking** — linked wound measurements per HBOT course (area, depth, granulation %, epithelialisation %)
6. **Course completion and outcome** — treatment completion, outcome classification, referral close

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint243_hyperbaric',
  label: 'Sprint 243 — Hyperbaric HBOT: chambers, session records, contraindication screening, wound progress, outcomes',
  version: '2026.06.23.0',
  description: 'hbot_chambers, hbot_courses, hbot_sessions, hbot_wound_progress, hbot_contraindication_screens',
  statements: () => [
    // ── Chambers ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS hbot_chambers (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT NOT NULL UNIQUE,
      chamber_type    TEXT NOT NULL CHECK (chamber_type IN ('monoplace','multiplace')),
      capacity        SMALLINT NOT NULL DEFAULT 1,
      max_ata         NUMERIC(4,2) NOT NULL DEFAULT 3.0,
      is_operational  BOOLEAN NOT NULL DEFAULT TRUE,
      notes           TEXT
    )`,
    `INSERT INTO hbot_chambers (name, chamber_type, capacity, max_ata)
     VALUES ('Chamber 1', 'monoplace', 1, 3.0)
     ON CONFLICT DO NOTHING`,

    // ── HBOT Courses ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS hbot_courses (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      indication      TEXT NOT NULL,
      indication_category TEXT NOT NULL CHECK (indication_category IN (
                          'wound_healing','co_poisoning','dci','air_embolism','radiation_necrosis',
                          'refractory_osteomyelitis','skin_graft','idiopathic_sensorineural_hearing_loss',
                          'sudden_vision_loss','crush_injury','wellness'
                        )),
      prescribed_sessions SMALLINT NOT NULL DEFAULT 20,
      completed_sessions  SMALLINT NOT NULL DEFAULT 0,
      target_ata      NUMERIC(4,2) NOT NULL DEFAULT 2.4,
      o2_pct          NUMERIC(5,2) NOT NULL DEFAULT 100.0,
      session_minutes SMALLINT NOT NULL DEFAULT 90,
      start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      end_date        DATE,
      status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','discontinued','suspended')),
      outcome         TEXT CHECK (outcome IN ('healed','improved','unchanged','deteriorated','not_assessed')),
      prescribing_physician UUID REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hbot_course_patient ON hbot_courses(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hbot_course_status ON hbot_courses(status)`,

    // ── HBOT Sessions ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS hbot_sessions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id       UUID NOT NULL REFERENCES hbot_courses(id) ON DELETE CASCADE,
      chamber_id      UUID NOT NULL REFERENCES hbot_chambers(id),
      session_number  SMALLINT NOT NULL,
      session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      start_time      TIME NOT NULL,
      end_time        TIME,
      duration_mins   SMALLINT GENERATED ALWAYS AS (
                          CASE WHEN end_time IS NOT NULL
                               THEN EXTRACT(EPOCH FROM (end_time - start_time)) / 60 ELSE NULL END
                        ) STORED,
      actual_ata      NUMERIC(4,2),
      o2_pct          NUMERIC(5,2),
      air_breaks      SMALLINT NOT NULL DEFAULT 0,
      pre_spo2        NUMERIC(4,1),
      post_spo2       NUMERIC(4,1),
      pre_bp_systolic SMALLINT,
      pre_bp_diastolic SMALLINT,
      ear_clearance   TEXT CHECK (ear_clearance IN ('easy','difficult','failed',NULL)),
      o2_toxicity_seizure BOOLEAN NOT NULL DEFAULT FALSE,
      o2_toxicity_visual  BOOLEAN NOT NULL DEFAULT FALSE,
      completed       BOOLEAN NOT NULL DEFAULT FALSE,
      nurse_id        UUID REFERENCES users(id),
      notes           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hbot_sessions_course ON hbot_sessions(course_id)`,

    // ── Contraindication Screens ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS hbot_contraindication_screens (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id       UUID NOT NULL REFERENCES hbot_courses(id) ON DELETE CASCADE,
      screened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      untreated_pneumothorax BOOLEAN NOT NULL DEFAULT FALSE,
      bleomycin_use   BOOLEAN NOT NULL DEFAULT FALSE,
      cisplatin_use   BOOLEAN NOT NULL DEFAULT FALSE,
      doxorubicin_concurrent BOOLEAN NOT NULL DEFAULT FALSE,
      disulfiram_use  BOOLEAN NOT NULL DEFAULT FALSE,
      severe_copd     BOOLEAN NOT NULL DEFAULT FALSE,
      claustrophobia_severe BOOLEAN NOT NULL DEFAULT FALSE,
      pregnancy       BOOLEAN NOT NULL DEFAULT FALSE,
      viral_urti_active BOOLEAN NOT NULL DEFAULT FALSE,
      has_absolute_contraindication BOOLEAN GENERATED ALWAYS AS (
                          untreated_pneumothorax OR bleomycin_use OR disulfiram_use
                        ) STORED,
      has_relative_contraindication BOOLEAN GENERATED ALWAYS AS (
                          cisplatin_use OR doxorubicin_concurrent OR severe_copd
                          OR claustrophobia_severe OR pregnancy
                        ) STORED,
      cleared_to_proceed BOOLEAN NOT NULL DEFAULT FALSE,
      screened_by     UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hbot_screen_course ON hbot_contraindication_screens(course_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hbot_screen_abs ON hbot_contraindication_screens(has_absolute_contraindication) WHERE has_absolute_contraindication = TRUE`,

    // ── Wound Progress Records ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS hbot_wound_progress (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id       UUID NOT NULL REFERENCES hbot_courses(id) ON DELETE CASCADE,
      session_number  SMALLINT NOT NULL,
      measured_at     DATE NOT NULL DEFAULT CURRENT_DATE,
      wound_length_cm NUMERIC(5,2),
      wound_width_cm  NUMERIC(5,2),
      wound_depth_cm  NUMERIC(5,2),
      wound_area_cm2  NUMERIC(8,4) GENERATED ALWAYS AS (
                          CASE WHEN wound_length_cm IS NOT NULL AND wound_width_cm IS NOT NULL
                               THEN ROUND(wound_length_cm * wound_width_cm, 4) ELSE NULL END
                        ) STORED,
      granulation_pct SMALLINT CHECK (granulation_pct BETWEEN 0 AND 100),
      epithelialisation_pct SMALLINT CHECK (epithelialisation_pct BETWEEN 0 AND 100),
      slough_pct      SMALLINT CHECK (slough_pct BETWEEN 0 AND 100),
      exudate_level   TEXT CHECK (exudate_level IN ('none','minimal','moderate','heavy',NULL)),
      photo_ref       TEXT,
      recorded_by     UUID REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wound_progress_course ON hbot_wound_progress(course_id)`,
  ],
},
```

**Add `hyperbaric` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/hyperbaric.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HyperbaricService } from '../services/hyperbaric.service';

@UseGuards(JwtAuthGuard)
@Controller('hbot')
export class HyperbaricController {
  constructor(private readonly svc: HyperbaricService) {}

  @Post('courses')
  createCourse(@Req() req: any, @Body() body: any) {
    return this.svc.createCourse(req.tenantDb, req.user.id, body);
  }

  @Get('courses/active')
  getActiveCourses(@Req() req: any) {
    return this.svc.getActiveCourses(req.tenantDb);
  }

  @Post('contraindication-screen')
  screenContraindications(
    @Req() req: any,
    @Body() body: {
      courseId: string;
      untreatedPneumothorax?: boolean; bleomycinUse?: boolean; cisplatinUse?: boolean;
      doxorubicinConcurrent?: boolean; disulfiramUse?: boolean; severeCopd?: boolean;
      claustrophobiaSevere?: boolean; pregnancy?: boolean; viralUrtiActive?: boolean;
    },
  ) {
    return this.svc.screenContraindications(req.tenantDb, req.user.id, body);
  }

  @Post('sessions')
  startSession(
    @Req() req: any,
    @Body() body: {
      courseId: string; chamberId: string; sessionNumber: number;
      preSpo2?: number; preBpSystolic?: number; preBpDiastolic?: number;
    },
  ) {
    return this.svc.startSession(req.tenantDb, req.user.id, body);
  }

  @Patch('sessions/:id/complete')
  completeSession(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { actualAta?: number; o2Pct?: number; airBreaks?: number; postSpo2?: number; earClearance?: string; notes?: string },
  ) {
    return this.svc.completeSession(req.tenantDb, id, body);
  }

  @Post('wound-progress')
  recordWoundProgress(@Req() req: any, @Body() body: any) {
    return this.svc.recordWoundProgress(req.tenantDb, req.user.id, body);
  }

  @Get('wound-progress/:courseId')
  getWoundTrend(@Req() req: any, @Param('courseId') courseId: string) {
    return this.svc.getWoundTrend(req.tenantDb, courseId);
  }

  @Patch('courses/:id/outcome')
  recordOutcome(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { outcome: string; status?: string },
  ) {
    return this.svc.recordOutcome(req.tenantDb, id, body);
  }
}
```

**Create file:** `services/ehr-service/src/services/hyperbaric.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class HyperbaricService {

  async createCourse(db: any, prescribingPhysician: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hbot_courses (patient_id, indication, indication_category, prescribed_sessions, target_ata, o2_pct, session_minutes, prescribing_physician)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.patientId, body.indication, body.indicationCategory, body.prescribedSessions ?? 20, body.targetAta ?? 2.4, body.o2Pct ?? 100, body.sessionMinutes ?? 90, prescribingPhysician],
    );
    return rows[0] ?? null;
  }

  async getActiveCourses(db: any): Promise<any[]> {
    return db.query(
      `SELECT hc.*, p.first_name, p.last_name,
              hc.prescribed_sessions - hc.completed_sessions AS remaining_sessions
       FROM hbot_courses hc
       JOIN patients p ON p.id = hc.patient_id
       WHERE hc.status = 'active'
       ORDER BY hc.start_date ASC`,
    );
  }

  async screenContraindications(db: any, screenedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hbot_contraindication_screens (course_id, untreated_pneumothorax, bleomycin_use, cisplatin_use, doxorubicin_concurrent, disulfiram_use, severe_copd, claustrophobia_severe, pregnancy, viral_urti_active, screened_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *, has_absolute_contraindication, has_relative_contraindication`,
      [body.courseId, body.untreatedPneumothorax ?? false, body.bleomycinUse ?? false, body.cisplatinUse ?? false, body.doxorubicinConcurrent ?? false, body.disulfiramUse ?? false, body.severeCopd ?? false, body.claustrophobiaSevere ?? false, body.pregnancy ?? false, body.viralUrtiActive ?? false, screenedBy],
    );
    const result = rows[0];
    const alerts: string[] = [];
    if (result?.has_absolute_contraindication) {
      alerts.push('⛔ ABSOLUTE CONTRAINDICATION identified. HBOT session CANNOT proceed. Notify prescribing physician immediately.');
    }
    if (result?.has_relative_contraindication) {
      alerts.push('⚠ RELATIVE CONTRAINDICATION: Requires senior physician review before proceeding. Document risk-benefit discussion.');
    }
    if (body.viralUrtiActive) {
      alerts.push('Active URTI noted. Ear/sinus barotrauma risk increased. Consider postponing session until resolved.');
    }
    return { ...result, cdss_alerts: alerts, cleared_to_proceed: result?.has_absolute_contraindication === false };
  }

  async startSession(db: any, nurseId: string, body: any): Promise<any> {
    const now = new Date();
    const startTime = now.toTimeString().slice(0, 5);
    const rows = await db.query(
      `INSERT INTO hbot_sessions (course_id, chamber_id, session_number, start_time, pre_spo2, pre_bp_systolic, pre_bp_diastolic, nurse_id)
       VALUES ($1,$2,$3,$4::time,$5,$6,$7,$8) RETURNING *`,
      [body.courseId, body.chamberId, body.sessionNumber, startTime, body.preSpo2 ?? null, body.preBpSystolic ?? null, body.preBpDiastolic ?? null, nurseId],
    );
    return rows[0] ?? null;
  }

  async completeSession(db: any, id: string, body: any): Promise<any> {
    const now = new Date();
    const endTime = now.toTimeString().slice(0, 5);
    const rows = await db.query(
      `UPDATE hbot_sessions SET end_time=$1::time, actual_ata=$2, o2_pct=$3, air_breaks=$4, post_spo2=$5, ear_clearance=$6, completed=TRUE, notes=$7
       WHERE id=$8 RETURNING *, duration_mins`,
      [endTime, body.actualAta ?? null, body.o2Pct ?? null, body.airBreaks ?? 0, body.postSpo2 ?? null, body.earClearance ?? null, body.notes ?? null, id],
    );
    const result = rows[0];
    // Increment completed sessions on course
    if (result) {
      await db.query(`UPDATE hbot_courses SET completed_sessions = completed_sessions + 1 WHERE id = (SELECT course_id FROM hbot_sessions WHERE id=$1)`, [id]);
    }
    return result ?? null;
  }

  async recordWoundProgress(db: any, recordedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hbot_wound_progress (course_id, session_number, measured_at, wound_length_cm, wound_width_cm, wound_depth_cm, granulation_pct, epithelialisation_pct, slough_pct, exudate_level, photo_ref, recorded_by)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *, wound_area_cm2`,
      [body.courseId, body.sessionNumber, body.measuredAt ?? new Date().toISOString().slice(0, 10), body.woundLengthCm ?? null, body.woundWidthCm ?? null, body.woundDepthCm ?? null, body.granulationPct ?? null, body.epithelisationPct ?? null, body.sloughPct ?? null, body.exudateLevel ?? null, body.photoRef ?? null, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getWoundTrend(db: any, courseId: string): Promise<any[]> {
    return db.query(
      `SELECT *, wound_area_cm2 FROM hbot_wound_progress WHERE course_id=$1 ORDER BY session_number ASC`,
      [courseId],
    );
  }

  async recordOutcome(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE hbot_courses SET outcome=$1, status=COALESCE($2, status), end_date=COALESCE(end_date, CURRENT_DATE)
       WHERE id=$3 RETURNING *`,
      [body.outcome, body.status ?? null, id],
    );
    return rows[0] ?? null;
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/HbotDashboard.tsx`:
- **Active Courses Panel** — card per patient showing indication, sessions completed/prescribed as progress bar (teal fill `#0AA98A`), remaining sessions
- **Wound Progress Chart** — area chart of `wound_area_cm2` across sessions; granulation% as secondary series in green
- **Contraindication Alert Banner** — coral full-width banner if last screen shows `has_absolute_contraindication = TRUE`

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/HbotSessionScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Wind, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function HbotSessionScreen({ route }: { route: any }) {
  const { courseId, patientName, prescribedSessions } = route.params;
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // Fetch sessions for this course (endpoint returns sessions by courseId filter)
    api.get(`/hbot/wound-progress/${courseId}`)
      .then(() => {}) // wound progress separate
      .catch(() => {});
    api.get(`/hbot/courses/active`)
      .then((r: any) => {
        // Just show completed session count from course data
        const course = (r.data ?? r).find((c: any) => c.id === courseId);
        if (course) setSessions(Array.from({ length: course.completed_sessions }, (_, i) => ({ session_number: i + 1 })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const completed = sessions.length;
  const progressPct = prescribedSessions > 0 ? Math.min((completed / prescribedSessions) * 100, 100) : 0;

  return (
    <View style={s.container}>
      <Text style={s.heading}>HBOT Course</Text>
      <Text style={s.sub}>{patientName}</Text>

      <View style={s.card}>
        <View style={s.row}>
          <Wind size={16} color={C.teal} />
          <Text style={s.metric}> Sessions: {completed} / {prescribedSessions}</Text>
        </View>
        <View style={s.bar}>
          <View style={[s.fill, { width: `${progressPct}%` as any }]} />
        </View>
        <Text style={s.pct}>{Math.round(progressPct)}% complete</Text>
      </View>

      {completed >= prescribedSessions && (
        <View style={s.completeCard}>
          <CheckCircle size={20} color={C.green} />
          <Text style={s.completeText}> Course complete. Record outcome.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:      { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:          { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:         { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:          { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  metric:       { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  bar:          { height: 10, backgroundColor: C.bg, borderRadius: RADIUS.pill, overflow: 'hidden', marginBottom: 6 },
  fill:         { height: 10, backgroundColor: C.teal, borderRadius: RADIUS.pill },
  pct:          { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  completeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.green + '22', borderRadius: RADIUS.md, padding: 14 },
  completeText: { fontFamily: FONT.uiSb, fontSize: 14, color: C.green },
});
```

**Register:** `<Stack.Screen name="HbotSession" component={HbotSessionScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
HBOT_CONTRAINDICATIONS = {
    "absolute": {
        "untreated_pneumothorax": "Untreated pneumothorax is an ABSOLUTE contraindication. Risk of tension pneumothorax on ascent.",
        "bleomycin_use": "Bleomycin history — ABSOLUTE contraindication. Pulmonary O₂ toxicity risk is fatal.",
        "disulfiram_use": "Disulfiram inhibits SOD. ABSOLUTE contraindication — severe O₂ toxicity risk.",
    },
    "relative": {
        "cisplatin_use": "Cisplatin concurrent use — RELATIVE CI. Pulmonary/renal toxicity potentiated.",
        "doxorubicin_concurrent": "Concurrent doxorubicin — RELATIVE CI. Cardiopulmonary toxicity risk.",
        "severe_copd": "Severe COPD — hypoxic drive risk at 1 ATA ascent. Careful monitoring.",
        "claustrophobia_severe": "Severe claustrophobia — pre-treat with anxiolytic. Slow chamber compress.",
        "pregnancy": "Relative CI (especially 1st trimester). Risk-benefit discussion required.",
    }
}

@app.post("/hbot/cdss/contraindication-check")
async def hbot_contraindication_check(body: dict):
    """
    Evaluate HBOT contraindications.
    body: { untreated_pneumothorax: bool, bleomycin_use: bool, disulfiram_use: bool,
             cisplatin_use: bool, doxorubicin_concurrent: bool, severe_copd: bool,
             claustrophobia_severe: bool, pregnancy: bool }
    """
    flags = []
    for field, guidance in HBOT_CONTRAINDICATIONS["absolute"].items():
        if body.get(field):
            flags.append({"type": "absolute", "condition": field, "guidance": guidance})
    for field, guidance in HBOT_CONTRAINDICATIONS["relative"].items():
        if body.get(field):
            flags.append({"type": "relative", "condition": field, "guidance": guidance})

    absolute_present = any(f["type"] == "absolute" for f in flags)
    return {
        "cleared": not absolute_present,
        "absolute_count": sum(1 for f in flags if f["type"] == "absolute"),
        "relative_count": sum(1 for f in flags if f["type"] == "relative"),
        "flags": flags,
        "recommendation": "DO NOT PROCEED — absolute contraindication present." if absolute_present
                         else ("Senior physician review required before proceeding." if flags else "No contraindications identified. Clear to proceed.")
    }
```

---

## Acceptance Criteria

- [ ] `hbot_sessions.duration_mins` is a generated column from `end_time - start_time`
- [ ] `hbot_wound_progress.wound_area_cm2` is a generated column from `length * width`
- [ ] `hbot_contraindication_screens.has_absolute_contraindication` and `has_relative_contraindication` are generated columns
- [ ] `POST /hbot/contraindication-screen` returns `cleared_to_proceed = false` when absolute CI present
- [ ] `PATCH /hbot/sessions/:id/complete` increments `hbot_courses.completed_sessions`
- [ ] `POST /hbot/cdss/contraindication-check` blocks on bleomycin, pneumothorax, disulfiram
- [ ] `HbotSessionScreen.tsx` renders teal progress bar with session count
- [ ] `'hyperbaric'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
