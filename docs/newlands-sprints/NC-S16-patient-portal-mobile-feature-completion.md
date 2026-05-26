# NC-S16 — Patient Portal + Mobile Feature Completion

**Sprint ID:** NC-S16  
**Priority:** Critical  
**Effort:** 10 days  
**Dependencies:** NC-S04, NC-S06, NC-S10, NC-S11, NC-S14, NC-S15  
**Gaps Covered:**
- NC-S04 gap — MMD schedule and multi-month pickup date not visible in patient portal or mobile
- NC-S06 gap — Support group membership and upcoming sessions not visible to patients
- NC-S10 gap — No patient portal UI for SMS nudge preferences or opt-out management
- NC-S14 gap — ANC/EID schedule tracker missing from patient portal for HIV+ mothers
- NC-S14 gap — Paediatric growth chart history not accessible to patients or caregivers in portal
- NC-S14 gap — Dental treatment plan summary not visible to patients in portal
- NC-S14 mobile gap — Growth measurement recording not in clinician mobile app
- NC-S04 mobile gap — MMD schedule not accessible from mobile point-of-care

---

## 1. Codebase Context

### Patient Portal Authentication Pattern
- Patient portal uses its own JWT issued by `POST /patient-portal/auth/login`
- The JWT `sub` claim contains `patientId`; the payload also carries `tenantId`
- All patient portal API calls include `Authorization: Bearer <token>` and `X-Tenant-ID: <tenantId>` headers
- Patient portal API client: `patient-portal/src/services/api.ts` — uses `axios` with an interceptor that attaches both headers from `localStorage`
- Guard in ehr-service for patient portal routes: `@UseGuards(PatientJwtAuthGuard)` — extracts `patientId` from JWT sub; patient can only access their own records
- Existing patient portal backend controllers: `services/ehr-service/src/controllers/patient-portal.controller.ts`

### Existing Patient Portal Pages
- `patient-portal/src/pages/DashboardPage.tsx` — summary tiles
- `patient-portal/src/pages/AppointmentsPage.tsx` — upcoming/past appointments
- `patient-portal/src/pages/LabResultsPage.tsx` — lab result history
- `patient-portal/src/pages/MedicationsPage.tsx` — current regimen, refill requests
- `patient-portal/src/pages/ProfilePage.tsx` — personal details, language selector
- `patient-portal/src/pages/ConsentManagementPage.tsx` — consent records (NC-S15)
- `patient-portal/src/components/Navbar.tsx` — side/top navigation

### Existing Mobile Screens (Expo — clinician/nurse facing)
- `mobile/src/screens/PatientHomeScreen.tsx` — patient list / home
- `mobile/src/screens/PatientHealthScreen.tsx` — patient health overview tabs
- `mobile/src/screens/MedDetailSheet.tsx` — medication detail with adherence + refill
- `mobile/src/services/api.ts` — shared Axios client; all mobile API calls go here
- `mobile/src/services/offlineQueue.ts` — offline mutation queue
- `mobile/src/services/offlineCache.ts` — offline read cache
- `mobile/src/i18n/index.ts` — i18n with 8 locales (NC-S11 added sn/nd)

### Routing
- Patient portal router: `patient-portal/src/App.tsx` — React Router `<Routes>`; every new page needs a `<Route>` entry
- Mobile navigator: `mobile/src/navigation/PatientStackNavigator.tsx` — every new screen needs a registration

### What Already Exists from Prior Sprints (backend)
| Table / Endpoint | Built in |
|---|---|
| `hiv_mmd_schedules` | NC-S04 |
| `GET /hiv/mmd/overdue` (staff only) | NC-S04 |
| `support_groups`, `support_group_members`, `support_group_sessions`, `support_group_attendance` | NC-S06 |
| `adherence_nudge_schedules`, `sms_opt_outs` | NC-S10 |
| `anc_registrations`, `pmtct_visits`, `eid_schedules` | NC-S14 |
| `growth_measurements` | NC-S14 |
| `dental_charts`, `dental_treatment_plans`, `dental_tooth_conditions` | NC-S14 |

All these tables exist but **have no patient-portal-scoped API endpoints** — every endpoint written in NC-S04 through NC-S14 is guarded by `JwtAuthGuard` (staff JWT). A patient JWT cannot call them.

---

## 2. What This Sprint Builds

### Part A — Patient Portal: MMD Schedule on Medications Page
Update `MedicationsPage.tsx` to show multi-month dispensing status, next pickup date, schedule type, and a refill request button wired to a real endpoint.

### Part B — Patient Portal: Support Group Membership Page
New page showing the patient's enrolled support groups, the clinic contact for each group, upcoming session dates, and past attendance.

### Part C — Patient Portal: Communication Preferences Page
New page where patients can toggle nudge types on/off, set preferred contact time, and opt out of all SMS communication — without needing to dial USSD.

### Part D — Patient Portal: ANC / EID Tracker
New page for HIV+ mothers showing their ANC registration details, PMTCT visit history, and the infant Early Infant Diagnosis schedule with colour-coded due dates and results.

### Part E — Patient Portal: Growth Chart History
New page for paediatric patients (or their caregivers via the caregiver login from PP-S24) showing growth measurement history, z-score trends, nutritional status, and whether a nutrition referral was generated.

### Part F — Patient Portal: Dental Treatment Summary
New page showing the patient's active dental treatment plan — procedures planned, completed, outstanding costs, and the next scheduled appointment.

### Part G — Mobile: Growth Measurement Recording Screen
New screen in the clinician/nurse mobile app for recording a patient's weight, height, MUAC, and head circumference at point of care; z-scores computed on the backend and displayed immediately.

### Part H — Mobile: MMD Schedule Screen
New screen in the clinician mobile app showing a patient's full MMD history, current schedule type, next pickup date, and a button to schedule the next pickup.

### Part I — Navigation and Dashboard Wiring
- Add all new pages to patient portal router (`App.tsx`)
- Add tiles/links for new pages to `DashboardPage.tsx`
- Add all new screens to mobile navigator
- Update `Navbar.tsx` to include new navigation items
- Update translation files (all 3 languages) for new strings

---

## 3. Database Changes

No new tables are required — all backing tables were created in NC-S04, NC-S06, NC-S10, NC-S14. This sprint adds patient-scoped API endpoints on top of existing tables.

### One column addition — patient portal read tokens for EID (optional access control)
```typescript
// In nc_dental_anc_paediatric bundle (NC-S14), add via ensureSubscriptionSchema():
await db.query(`ALTER TABLE anc_registrations ADD COLUMN IF NOT EXISTS patient_portal_visible BOOLEAN NOT NULL DEFAULT true`);
await db.query(`ALTER TABLE eid_schedules ADD COLUMN IF NOT EXISTS patient_portal_visible BOOLEAN NOT NULL DEFAULT true`);
```

### After schema change: `POST /api/admin/tenants/repair-all`

---

## 4. Backend — Patient Portal API Endpoints

All new endpoints go into a dedicated controller that uses `PatientJwtAuthGuard`. The `patientId` is extracted from `req.user.sub` (the patient JWT sub claim). Every query filters by `patient_id = $patientId` — patients can only see their own data.

### 4.1 Patient Portal Controller Extension
**File:** `services/ehr-service/src/controllers/patient-portal-hiv.controller.ts`

```typescript
import {
  Controller, Get, Put, Post, Body, Param, Req, UseGuards, Query,
} from '@nestjs/common';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { DatabaseService } from '../services/database.service';
import { Request } from 'express';

@Controller('patient-portal')
@UseGuards(PatientJwtAuthGuard)
export class PatientPortalHivController {
  constructor(private readonly db: DatabaseService) {}

  // ── A: MMD Schedule ──────────────────────────────────────────────

  @Get('mmd/schedule')
  async getMmdSchedule(@Req() req: Request) {
    const { patientId, tenantDb } = req as any;

    const schedule = await this.db.queryOne(
      tenantDb,
      `SELECT m.id, m.schedule_type, m.next_pickup_date,
              m.is_active, m.created_at,
              h.current_regimen,
              CASE
                WHEN m.schedule_type = '6-month' THEN 'Multi-Month (6-month supply)'
                WHEN m.schedule_type = '3-month' THEN 'Multi-Month (3-month supply)'
                ELSE 'Standard monthly'
              END as schedule_label,
              (m.next_pickup_date - CURRENT_DATE) as days_until_pickup
       FROM hiv_mmd_schedules m
       JOIN hiv_enrollments h ON h.patient_id = m.patient_id
       WHERE m.patient_id = $1 AND m.is_active = true
       ORDER BY m.next_pickup_date ASC LIMIT 1`,
      [patientId],
    );

    const history = await this.db.query(
      tenantDb,
      `SELECT schedule_type, next_pickup_date, created_at
       FROM hiv_mmd_schedules
       WHERE patient_id = $1
       ORDER BY created_at DESC LIMIT 12`,
      [patientId],
    );

    return { current: schedule, history };
  }

  @Post('mmd/request-refill')
  async requestRefill(@Req() req: Request) {
    const { patientId, tenantDb } = req as any;

    await this.db.query(
      tenantDb,
      `UPDATE hiv_mmd_schedules
       SET requested_via_portal = true, updated_at = NOW()
       WHERE patient_id = $1 AND is_active = true`,
      [patientId],
    );

    // Add portal_requested column if needed — safe ALTER
    await this.db.query(
      tenantDb,
      `ALTER TABLE hiv_mmd_schedules ADD COLUMN IF NOT EXISTS requested_via_portal BOOLEAN DEFAULT false`,
      [],
    );

    return { requested: true, message: 'Refill request received. Your medication will be prepared within 3 working days.' };
  }

  // ── B: Support Groups ─────────────────────────────────────────────

  @Get('support-groups')
  async getSupportGroups(@Req() req: Request) {
    const { patientId, tenantDb } = req as any;

    const groups = await this.db.query(
      tenantDb,
      `SELECT sg.id, sg.name, sg.group_type, sg.meeting_schedule,
              sg.facilitator_name, sg.location,
              sm.joined_at, sm.status as membership_status,
              (
                SELECT json_build_object(
                  'id', s.id,
                  'session_date', s.session_date,
                  'start_time', s.start_time,
                  'topic', s.topic,
                  'location', s.location
                )
                FROM support_group_sessions s
                WHERE s.group_id = sg.id AND s.session_date >= CURRENT_DATE
                ORDER BY s.session_date ASC LIMIT 1
              ) as next_session,
              (
                SELECT COUNT(*)::int
                FROM support_group_attendance a
                JOIN support_group_sessions ses ON ses.id = a.session_id
                WHERE a.member_id = sm.id AND a.attended = true
              ) as sessions_attended
       FROM support_group_members sm
       JOIN support_groups sg ON sg.id = sm.group_id
       WHERE sm.patient_id = $1 AND sm.status = 'active'
       ORDER BY sg.name ASC`,
      [patientId],
    );

    return { groups };
  }

  @Get('support-groups/:groupId/sessions')
  async getGroupSessions(
    @Param('groupId') groupId: string,
    @Req() req: Request,
  ) {
    const { patientId, tenantDb } = req as any;

    // Verify patient is a member of this group
    const member = await this.db.queryOne<{ id: string }>(
      tenantDb,
      `SELECT id FROM support_group_members WHERE group_id = $1 AND patient_id = $2 AND status = 'active'`,
      [groupId, patientId],
    );
    if (!member) return { sessions: [] };

    return this.db.query(
      tenantDb,
      `SELECT s.id, s.session_date, s.start_time, s.end_time, s.topic, s.location,
              a.attended, a.notes as attendance_note
       FROM support_group_sessions s
       LEFT JOIN support_group_attendance a ON a.session_id = s.id AND a.member_id = $2
       WHERE s.group_id = $1
       ORDER BY s.session_date DESC LIMIT 24`,
      [groupId, member.id],
    );
  }

  // ── C: Communication Preferences ─────────────────────────────────

  @Get('communication-preferences')
  async getCommunicationPreferences(@Req() req: Request) {
    const { patientId, tenantDb } = req as any;

    const [nudges, optOut, patient] = await Promise.all([
      this.db.query(
        tenantDb,
        `SELECT id, nudge_type, frequency, preferred_time, language, is_active, next_send_at
         FROM adherence_nudge_schedules
         WHERE patient_id = $1`,
        [patientId],
      ),
      this.db.queryOne(
        tenantDb,
        `SELECT opted_out_at, reason FROM sms_opt_outs
         WHERE patient_id = $1`,
        [patientId],
      ),
      this.db.queryOne<{ preferred_language: string; phone_number: string }>(
        tenantDb,
        `SELECT preferred_language, phone_number FROM patients WHERE id = $1`,
        [patientId],
      ),
    ]);

    return {
      smsOptedOut: !!optOut,
      optedOutAt: optOut?.opted_out_at ?? null,
      nudges,
      preferredLanguage: patient?.preferred_language ?? 'en',
      phoneNumber: patient?.phone_number ? '***' + patient.phone_number.slice(-4) : null,
    };
  }

  @Put('communication-preferences')
  async updateCommunicationPreferences(
    @Body() body: {
      smsOptOut?: boolean;
      optOutReason?: string;
      nudgeUpdates?: Array<{ id: string; isActive: boolean; preferredTime?: string; language?: string }>;
    },
    @Req() req: Request,
  ) {
    const { patientId, tenantDb } = req as any;

    // Handle global SMS opt-out / opt-in
    if (body.smsOptOut === true) {
      await this.db.query(
        tenantDb,
        `INSERT INTO sms_opt_outs (patient_id, opted_out_at, reason)
         SELECT id, NOW(), $2 FROM patients WHERE id = $1
           ON CONFLICT DO NOTHING`,
        [patientId, body.optOutReason ?? 'Patient request via portal'],
      );
      await this.db.query(
        tenantDb,
        `UPDATE adherence_nudge_schedules SET is_active = false WHERE patient_id = $1`,
        [patientId],
      );
    } else if (body.smsOptOut === false) {
      // Re-opt-in
      await this.db.query(
        tenantDb,
        `DELETE FROM sms_opt_outs WHERE patient_id = $1`,
        [patientId],
      );
    }

    // Handle per-nudge updates
    if (body.nudgeUpdates?.length) {
      for (const update of body.nudgeUpdates) {
        await this.db.query(
          tenantDb,
          `UPDATE adherence_nudge_schedules
           SET is_active = $2,
               preferred_time = COALESCE($3, preferred_time),
               language = COALESCE($4, language)
           WHERE id = $1 AND patient_id = $5`,
          [update.id, update.isActive, update.preferredTime ?? null, update.language ?? null, patientId],
        );
      }
    }

    return { updated: true };
  }

  // ── D: ANC / EID Tracker ─────────────────────────────────────────

  @Get('anc/registration')
  async getAncRegistration(@Req() req: Request) {
    const { patientId, tenantDb } = req as any;

    const anc = await this.db.queryOne(
      tenantDb,
      `SELECT id, lmp_date, edd, gravida, para, hiv_status,
              art_start_date, current_regimen,
              vl_at_36_weeks, maternal_transmission_risk,
              delivery_date, mode_of_delivery, birth_outcome
       FROM anc_registrations
       WHERE patient_id = $1 AND patient_portal_visible = true
       ORDER BY created_at DESC LIMIT 1`,
      [patientId],
    );
    if (!anc) return { registered: false };

    const visits = await this.db.query(
      tenantDb,
      `SELECT visit_date, gestational_age_weeks, weight_kg, blood_pressure,
              viral_load, adherence_score
       FROM pmtct_visits
       WHERE anc_registration_id = $1
       ORDER BY visit_date DESC`,
      [(anc as any).id],
    );

    return { registered: true, anc, visits };
  }

  @Get('anc/eid-schedule')
  async getEidSchedule(@Req() req: Request) {
    const { patientId, tenantDb } = req as any;

    const schedules = await this.db.query(
      tenantDb,
      `SELECT id, infant_name, birth_date, nvp_duration_weeks,
              test_6w_due, test_6w_result, test_6w_done_at,
              test_4m_due, test_4m_result, test_4m_done_at,
              test_12m_due, test_12m_result, test_12m_done_at,
              test_18m_due, test_18m_result, test_18m_done_at,
              final_hiv_status, transmission_occurred
       FROM eid_schedules
       WHERE mother_patient_id = $1 AND patient_portal_visible = true
       ORDER BY birth_date DESC`,
      [patientId],
    );

    // Annotate each timepoint with status: upcoming / due_soon / overdue / done
    return schedules.map((s: any) => ({
      ...s,
      timepoints: [
        { label: '6 Weeks', due: s.test_6w_due, result: s.test_6w_result, doneAt: s.test_6w_done_at, status: this.timepointStatus(s.test_6w_due, s.test_6w_result) },
        { label: '4 Months', due: s.test_4m_due, result: s.test_4m_result, doneAt: s.test_4m_done_at, status: this.timepointStatus(s.test_4m_due, s.test_4m_result) },
        { label: '12 Months', due: s.test_12m_due, result: s.test_12m_result, doneAt: s.test_12m_done_at, status: this.timepointStatus(s.test_12m_due, s.test_12m_result) },
        { label: '18 Months', due: s.test_18m_due, result: s.test_18m_result, doneAt: s.test_18m_done_at, status: this.timepointStatus(s.test_18m_due, s.test_18m_result) },
      ],
    }));
  }

  private timepointStatus(due: string | null, result: string | null): string {
    if (result) return 'done';
    if (!due) return 'not_scheduled';
    const dueDate = new Date(due);
    const today = new Date();
    const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 14) return 'due_soon';
    return 'upcoming';
  }

  // ── E: Growth Chart History ───────────────────────────────────────

  @Get('growth/history')
  async getGrowthHistory(@Req() req: Request) {
    const { patientId, tenantDb } = req as any;

    const measurements = await this.db.query(
      tenantDb,
      `SELECT id, measurement_date, age_months, weight_kg, height_cm,
              head_circumference_cm, muac_cm,
              waz, haz, whz, baz,
              waz_category, haz_category, whz_category,
              nutrition_referral_needed
       FROM growth_measurements
       WHERE patient_id = $1
       ORDER BY measurement_date ASC`,
      [patientId],
    );

    const latest = measurements[measurements.length - 1] as any;

    return {
      measurements,
      latestStatus: latest ? {
        wazCategory: latest.waz_category,
        hazCategory: latest.haz_category,
        nutritionReferralNeeded: latest.nutrition_referral_needed,
        measuredOn: latest.measurement_date,
      } : null,
    };
  }

  // ── F: Dental Treatment Summary ───────────────────────────────────

  @Get('dental/treatment-plan')
  async getDentalTreatmentPlan(@Req() req: Request) {
    const { patientId, tenantDb } = req as any;

    const plans = await this.db.query(
      tenantDb,
      `SELECT dtp.id, dtp.tooth_number, dtp.procedure_code,
              dtp.procedure_description, dtp.planned_date,
              dtp.completed_date, dtp.cost_usd, dtp.status, dtp.notes,
              dc.visit_date as chart_date
       FROM dental_treatment_plans dtp
       LEFT JOIN dental_charts dc ON dc.id = dtp.chart_id
       WHERE dtp.patient_id = $1
       ORDER BY
         CASE dtp.status WHEN 'planned' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         dtp.planned_date ASC`,
      [patientId],
    );

    const totalOutstanding = plans
      .filter((p: any) => p.status !== 'completed' && p.cost_usd)
      .reduce((sum: number, p: any) => sum + parseFloat(p.cost_usd), 0);

    const totalCost = plans
      .filter((p: any) => p.cost_usd)
      .reduce((sum: number, p: any) => sum + parseFloat(p.cost_usd), 0);

    return {
      plans,
      summary: {
        totalProcedures: plans.length,
        completedProcedures: plans.filter((p: any) => p.status === 'completed').length,
        pendingProcedures: plans.filter((p: any) => p.status !== 'completed').length,
        totalCostUsd: totalCost.toFixed(2),
        outstandingCostUsd: totalOutstanding.toFixed(2),
      },
    };
  }
}
```

### 4.2 Register in `ehr.module.ts`
```typescript
// Add to controllers array:
PatientPortalHivController,
```

### 4.3 Update patient portal `api.ts` — add new API call functions
**File:** `patient-portal/src/services/api.ts` — add to the existing exports:

```typescript
// ── MMD ──
export const getMmdSchedule = () =>
  api.get('/patient-portal/mmd/schedule').then(r => r.data);

export const requestMmdRefill = () =>
  api.post('/patient-portal/mmd/request-refill').then(r => r.data);

// ── Support Groups ──
export const getPatientSupportGroups = () =>
  api.get('/patient-portal/support-groups').then(r => r.data);

export const getSupportGroupSessions = (groupId: string) =>
  api.get(`/patient-portal/support-groups/${groupId}/sessions`).then(r => r.data);

// ── Communication Preferences ──
export const getCommunicationPreferences = () =>
  api.get('/patient-portal/communication-preferences').then(r => r.data);

export const updateCommunicationPreferences = (payload: {
  smsOptOut?: boolean;
  optOutReason?: string;
  nudgeUpdates?: Array<{ id: string; isActive: boolean; preferredTime?: string; language?: string }>;
}) => api.put('/patient-portal/communication-preferences', payload).then(r => r.data);

// ── ANC / EID ──
export const getAncRegistration = () =>
  api.get('/patient-portal/anc/registration').then(r => r.data);

export const getEidSchedule = () =>
  api.get('/patient-portal/anc/eid-schedule').then(r => r.data);

// ── Growth Chart ──
export const getGrowthHistory = () =>
  api.get('/patient-portal/growth/history').then(r => r.data);

// ── Dental ──
export const getDentalTreatmentPlan = () =>
  api.get('/patient-portal/dental/treatment-plan').then(r => r.data);
```

---

## 5. Patient Portal Frontend

### 5.1 Update `MedicationsPage.tsx` — add MMD section

**File:** `patient-portal/src/pages/MedicationsPage.tsx`

Add below the existing regimen display, before the refill request button:

```typescript
import { getMmdSchedule, requestMmdRefill } from '../services/api';
import { useTranslation } from 'react-i18next';

// Inside component:
const { t } = useTranslation();
const [mmd, setMmd] = useState<any>(null);
const [refillRequested, setRefillRequested] = useState(false);

useEffect(() => {
  getMmdSchedule().then(setMmd).catch(() => {});
}, []);

const handleRefill = async () => {
  await requestMmdRefill();
  setRefillRequested(true);
};

// JSX to add after regimen card:
{mmd?.current && (
  <div style={{ background: '#ebf8ff', borderRadius: 8, padding: 16, marginTop: 16 }}>
    <h3 style={{ margin: '0 0 8px', color: '#2b6cb0' }}>{t('medications.mmdTitle')}</h3>
    <p style={{ margin: '4px 0' }}>
      <strong>{t('medications.scheduleType')}:</strong> {mmd.current.schedule_label}
    </p>
    <p style={{ margin: '4px 0' }}>
      <strong>{t('medications.nextPickup')}:</strong> {mmd.current.next_pickup_date}
      {mmd.current.days_until_pickup <= 7 && mmd.current.days_until_pickup >= 0 && (
        <span style={{ background: '#f6ad55', color: '#fff', borderRadius: 10, padding: '1px 8px', marginLeft: 8, fontSize: 12 }}>
          {t('medications.pickupDueSoon', { days: mmd.current.days_until_pickup })}
        </span>
      )}
      {mmd.current.days_until_pickup < 0 && (
        <span style={{ background: '#fc8181', color: '#fff', borderRadius: 10, padding: '1px 8px', marginLeft: 8, fontSize: 12 }}>
          {t('medications.pickupOverdue')}
        </span>
      )}
    </p>
    <button
      onClick={handleRefill}
      disabled={refillRequested}
      style={{
        marginTop: 12, padding: '8px 16px',
        background: refillRequested ? '#a0aec0' : '#3182ce',
        color: '#fff', border: 'none', borderRadius: 6, cursor: refillRequested ? 'default' : 'pointer',
      }}
    >
      {refillRequested ? t('medications.refillRequested') : t('medications.requestRefill')}
    </button>
  </div>
)}
```

### 5.2 New Page — Support Groups
**File:** `patient-portal/src/pages/SupportGroupsPage.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPatientSupportGroups, getSupportGroupSessions } from '../services/api';

interface Group {
  id: string;
  name: string;
  group_type: string;
  meeting_schedule: string;
  facilitator_name: string;
  location: string;
  next_session: { session_date: string; start_time: string; topic: string; location: string } | null;
  sessions_attended: number;
}

export const SupportGroupsPage: React.FC = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPatientSupportGroups()
      .then(d => { setGroups(d.groups); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadSessions = async (groupId: string) => {
    setSelectedGroup(groupId);
    const data = await getSupportGroupSessions(groupId);
    setSessions(Array.isArray(data) ? data : []);
  };

  if (loading) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  if (!groups.length) return (
    <div style={{ padding: 24 }}>
      <h1>{t('supportGroups.title')}</h1>
      <p style={{ color: '#718096' }}>{t('supportGroups.notEnrolled')}</p>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('supportGroups.title')}</h1>

      {groups.map(group => (
        <div key={group.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{group.name}</h2>
              <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>{group.group_type} · {group.meeting_schedule}</p>
              <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                <strong>{t('supportGroups.facilitator')}:</strong> {group.facilitator_name}
              </p>
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                <strong>{t('supportGroups.location')}:</strong> {group.location}
              </p>
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                <strong>{t('supportGroups.sessionsAttended')}:</strong> {group.sessions_attended}
              </p>
            </div>
            {group.next_session && (
              <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: 12, minWidth: 180, textAlign: 'right' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#276749', fontWeight: 600 }}>
                  {t('supportGroups.nextSession')}
                </p>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600 }}>{group.next_session.session_date}</p>
                <p style={{ margin: '0 0 2px', fontSize: 13 }}>{group.next_session.start_time}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#4a5568' }}>{group.next_session.topic}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => selectedGroup === group.id ? setSelectedGroup(null) : loadSessions(group.id)}
            style={{ marginTop: 12, padding: '6px 14px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            {selectedGroup === group.id ? t('supportGroups.hideSessions') : t('supportGroups.viewSessions')}
          </button>

          {selectedGroup === group.id && (
            <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f7fafc' }}>
                  {[t('supportGroups.date'), t('supportGroups.topic'), t('supportGroups.attended')].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>{s.session_date}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>{s.topic}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ color: s.attended ? '#276749' : '#c53030' }}>
                        {s.attended ? '✓' : '–'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 5.3 New Page — Communication Preferences
**File:** `patient-portal/src/pages/CommunicationPreferencesPage.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCommunicationPreferences, updateCommunicationPreferences } from '../services/api';

const NUDGE_TYPE_LABELS: Record<string, string> = {
  daily_reminder: 'Daily medication reminder',
  appointment_reminder: 'Appointment reminders',
  refill_reminder: 'Medication refill reminders',
};

export const CommunicationPreferencesPage: React.FC = () => {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [optingOut, setOptingOut] = useState(false);
  const [nudgeChanges, setNudgeChanges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getCommunicationPreferences().then(setPrefs);
  }, []);

  const toggleNudge = (id: string, current: boolean) => {
    setNudgeChanges(prev => ({ ...prev, [id]: !current }));
  };

  const save = async () => {
    setSaving(true);
    const nudgeUpdates = Object.entries(nudgeChanges).map(([id, isActive]) => ({ id, isActive }));
    await updateCommunicationPreferences({ nudgeUpdates });
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
    setNudgeChanges({});
    getCommunicationPreferences().then(setPrefs);
  };

  const handleOptOut = async () => {
    if (!window.confirm(t('comms.optOutConfirm'))) return;
    setOptingOut(true);
    await updateCommunicationPreferences({ smsOptOut: true, optOutReason: 'Patient request via portal' });
    getCommunicationPreferences().then(setPrefs);
    setOptingOut(false);
  };

  const handleOptIn = async () => {
    await updateCommunicationPreferences({ smsOptOut: false });
    getCommunicationPreferences().then(setPrefs);
  };

  if (!prefs) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>{t('comms.title')}</h1>

      {/* Global opt-out banner */}
      {prefs.smsOptedOut ? (
        <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ margin: '0 0 8px', color: '#c53030', fontWeight: 600 }}>{t('comms.optedOutBanner')}</p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#718096' }}>
            {t('comms.optedOutOn', { date: prefs.optedOutAt?.slice(0, 10) })}
          </p>
          <button onClick={handleOptIn} style={{ padding: '8px 16px', background: '#276749', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {t('comms.optBackIn')}
          </button>
        </div>
      ) : (
        <>
          {/* Phone number display (masked) */}
          {prefs.phoneNumber && (
            <p style={{ color: '#4a5568', marginBottom: 20 }}>
              {t('comms.sendingTo')}: <strong>{prefs.phoneNumber}</strong>
            </p>
          )}

          {/* Per-nudge toggles */}
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t('comms.nudgeSettings')}</h2>
          {prefs.nudges.map((nudge: any) => {
            const isActive = nudge.id in nudgeChanges ? nudgeChanges[nudge.id] : nudge.is_active;
            return (
              <div key={nudge.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 500 }}>{NUDGE_TYPE_LABELS[nudge.nudge_type] ?? nudge.nudge_type}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#718096' }}>
                    {nudge.frequency} · {nudge.preferred_time}
                  </p>
                </div>
                <button
                  onClick={() => toggleNudge(nudge.id, nudge.is_active)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: isActive ? '#48bb78' : '#cbd5e0',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                  aria-label={isActive ? 'Disable' : 'Enable'}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: isActive ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            );
          })}

          {Object.keys(nudgeChanges).length > 0 && (
            <button onClick={save} disabled={saving} style={{ marginTop: 16, padding: '10px 20px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              {saving ? t('common.loading') : saved ? t('profile.saved') : t('common.confirm')}
            </button>
          )}

          {/* Global opt-out */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: 16, color: '#c53030', marginBottom: 8 }}>{t('comms.stopAllSms')}</h2>
            <p style={{ fontSize: 13, color: '#718096', marginBottom: 12 }}>{t('comms.optOutDescription')}</p>
            <button onClick={handleOptOut} disabled={optingOut} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #fc8181', color: '#c53030', borderRadius: 6, cursor: 'pointer' }}>
              {t('comms.optOutButton')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
```

### 5.4 New Page — ANC / EID Tracker
**File:** `patient-portal/src/pages/AncEidTrackerPage.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAncRegistration, getEidSchedule } from '../services/api';

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  done:          { bg: '#f0fff4', color: '#276749', label: 'Done' },
  due_soon:      { bg: '#fffbeb', color: '#b7791f', label: 'Due Soon' },
  overdue:       { bg: '#fff5f5', color: '#c53030', label: 'Overdue' },
  upcoming:      { bg: '#ebf8ff', color: '#2b6cb0', label: 'Upcoming' },
  not_scheduled: { bg: '#f7fafc', color: '#a0aec0', label: 'Not scheduled' },
};

export const AncEidTrackerPage: React.FC = () => {
  const { t } = useTranslation();
  const [anc, setAnc] = useState<any>(null);
  const [eid, setEid] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAncRegistration(), getEidSchedule()])
      .then(([ancData, eidData]) => {
        setAnc(ancData);
        setEid(Array.isArray(eidData) ? eidData : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  if (!anc?.registered) return (
    <div style={{ padding: 24 }}>
      <h1>{t('anc.title')}</h1>
      <p style={{ color: '#718096' }}>{t('anc.notRegistered')}</p>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('anc.title')}</h1>

      {/* ANC Summary */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t('anc.pregnancyDetails')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 14 }}>
          <p style={{ margin: 0 }}><strong>{t('anc.lmp')}:</strong> {anc.anc.lmp_date}</p>
          <p style={{ margin: 0 }}><strong>{t('anc.edd')}:</strong> {anc.anc.edd}</p>
          <p style={{ margin: 0 }}><strong>{t('anc.currentRegimen')}:</strong> {anc.anc.current_regimen ?? t('anc.notRecorded')}</p>
          {anc.anc.maternal_transmission_risk === 'high' && (
            <p style={{ margin: 0, color: '#c53030', fontWeight: 600 }}>⚠ {t('anc.highMtr')}</p>
          )}
        </div>
      </div>

      {/* EID Schedules */}
      {eid.map((infant: any) => (
        <div key={infant.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{infant.infant_name}</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#718096' }}>
            {t('anc.bornOn')} {infant.birth_date} · NVP {infant.nvp_duration_weeks} {t('anc.weeks')}
          </p>

          {/* Timepoint cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {infant.timepoints.map((tp: any) => {
              const style = STATUS_STYLES[tp.status] ?? STATUS_STYLES.upcoming;
              return (
                <div key={tp.label} style={{ background: style.bg, border: `1px solid ${style.color}30`, borderRadius: 8, padding: 12 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13 }}>{tp.label}</p>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: '#4a5568' }}>{t('anc.due')}: {tp.due ?? '—'}</p>
                  <span style={{ background: style.color, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>
                    {style.label}
                  </span>
                  {tp.result && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: tp.result === 'positive' ? '#c53030' : '#276749' }}>
                      {tp.result.toUpperCase()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {infant.final_hiv_status && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: infant.transmission_occurred ? '#fff5f5' : '#f0fff4', borderRadius: 6, fontSize: 14 }}>
              <strong>{t('anc.finalStatus')}:</strong>{' '}
              <span style={{ color: infant.transmission_occurred ? '#c53030' : '#276749', fontWeight: 600 }}>
                {infant.final_hiv_status.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 5.5 New Page — Growth Chart History
**File:** `patient-portal/src/pages/GrowthChartPage.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import { getGrowthHistory } from '../services/api';

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  severe_underweight: { label: 'Severe Underweight', color: '#c53030' },
  underweight:        { label: 'Underweight',        color: '#dd6b20' },
  normal:             { label: 'Normal',             color: '#276749' },
  overweight:         { label: 'Overweight',         color: '#b7791f' },
  severely_stunted:   { label: 'Severely Stunted',   color: '#c53030' },
  stunted:            { label: 'Stunted',            color: '#dd6b20' },
  unknown:            { label: 'Not assessed',       color: '#a0aec0' },
};

export const GrowthChartPage: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getGrowthHistory().then(setData);
  }, []);

  if (!data) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  const { measurements, latestStatus } = data;

  const chartData = measurements.map((m: any) => ({
    date: m.measurement_date,
    weight: m.weight_kg,
    height: m.height_cm,
    waz: m.waz,
    haz: m.haz,
  }));

  const latestWaz = latestStatus?.wazCategory;
  const wazBadge = CATEGORY_BADGE[latestWaz ?? 'unknown'];

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('growth.title')}</h1>

      {/* Current status */}
      {latestStatus && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ border: `2px solid ${wazBadge.color}`, borderRadius: 8, padding: '10px 16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#718096' }}>{t('growth.weightStatus')}</p>
            <span style={{ color: wazBadge.color, fontWeight: 600 }}>{wazBadge.label}</span>
          </div>
          {latestStatus.nutritionReferralNeeded && (
            <div style={{ background: '#fff5f5', border: '1px solid #fc8181', borderRadius: 8, padding: '10px 16px' }}>
              <p style={{ margin: 0, color: '#c53030', fontWeight: 600 }}>⚠ {t('growth.nutritionReferral')}</p>
            </div>
          )}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#718096' }}>{t('growth.lastMeasured')}</p>
            <p style={{ margin: 0, fontWeight: 500 }}>{latestStatus.measuredOn}</p>
          </div>
        </div>
      )}

      {/* Weight-for-Age Z-score chart */}
      {chartData.length > 1 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>{t('growth.wazChart')}</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[-4, 4]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={0}  stroke="#48bb78" strokeDasharray="4 4" label={{ value: 'Median', fontSize: 10 }} />
              <ReferenceLine y={-2} stroke="#f6ad55" strokeDasharray="4 4" label={{ value: '-2 SD', fontSize: 10 }} />
              <ReferenceLine y={-3} stroke="#fc8181" strokeDasharray="4 4" label={{ value: '-3 SD', fontSize: 10 }} />
              <Line type="monotone" dataKey="waz" stroke="#3182ce" strokeWidth={2} dot={{ r: 4 }} name="Weight-for-Age Z" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Measurements table */}
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{t('growth.history')}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              {[t('growth.date'), t('growth.age'), t('growth.weight'), t('growth.height'), 'WAZ', 'HAZ', t('growth.status')].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...measurements].reverse().map((m: any) => {
              const badge = CATEGORY_BADGE[m.waz_category ?? 'unknown'];
              return (
                <tr key={m.id}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.measurement_date}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.age_months} mo</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.weight_kg ?? '—'} kg</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.height_cm ?? '—'} cm</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.waz ?? '—'}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.haz ?? '—'}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: badge.color, fontSize: 12, fontWeight: 500 }}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

Install `recharts` if not already present:
```bash
cd patient-portal && npm install recharts
```

### 5.6 New Page — Dental Treatment Summary
**File:** `patient-portal/src/pages/DentalSummaryPage.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDentalTreatmentPlan } from '../services/api';

const STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  planned:     { label: 'Planned',     bg: '#ebf8ff', color: '#2b6cb0' },
  in_progress: { label: 'In Progress', bg: '#fffbeb', color: '#b7791f' },
  completed:   { label: 'Completed',   bg: '#f0fff4', color: '#276749' },
};

export const DentalSummaryPage: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getDentalTreatmentPlan().then(setData);
  }, []);

  if (!data) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  const { plans, summary } = data;

  if (!plans.length) return (
    <div style={{ padding: 24 }}>
      <h1>{t('dental.title')}</h1>
      <p style={{ color: '#718096' }}>{t('dental.noTreatmentPlan')}</p>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('dental.title')}</h1>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: t('dental.totalProcedures'), value: summary.totalProcedures },
          { label: t('dental.completed'), value: summary.completedProcedures },
          { label: t('dental.pending'), value: summary.pendingProcedures },
          { label: t('dental.outstandingCost'), value: `$${summary.outstandingCostUsd}` },
        ].map(card => (
          <div key={card.label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#718096' }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Treatment plan table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              {[t('dental.procedure'), t('dental.tooth'), t('dental.plannedDate'), t('dental.cost'), t('dental.status')].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((p: any) => {
              const pill = STATUS_PILL[p.status] ?? STATUS_PILL.planned;
              return (
                <tr key={p.id} style={{ opacity: p.status === 'completed' ? 0.65 : 1 }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>{p.procedure_description}</p>
                    {p.notes && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#718096' }}>{p.notes}</p>}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>{p.tooth_number ?? '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>{p.planned_date ?? '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>{p.cost_usd ? `$${p.cost_usd}` : '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ background: pill.bg, color: pill.color, borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 500 }}>
                      {pill.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## 6. Patient Portal — Router and Navigation Wiring

### 6.1 Add routes to `patient-portal/src/App.tsx`

```typescript
// Add these imports:
import { SupportGroupsPage } from './pages/SupportGroupsPage';
import { CommunicationPreferencesPage } from './pages/CommunicationPreferencesPage';
import { AncEidTrackerPage } from './pages/AncEidTrackerPage';
import { GrowthChartPage } from './pages/GrowthChartPage';
import { DentalSummaryPage } from './pages/DentalSummaryPage';

// Add inside <Routes>:
<Route path="/support-groups" element={<SupportGroupsPage />} />
<Route path="/communication-preferences" element={<CommunicationPreferencesPage />} />
<Route path="/anc-eid" element={<AncEidTrackerPage />} />
<Route path="/growth" element={<GrowthChartPage />} />
<Route path="/dental" element={<DentalSummaryPage />} />
```

### 6.2 Add navigation items to `Navbar.tsx`

```typescript
// Add to the nav links array (after existing items):
{ path: '/support-groups',            label: t('nav.supportGroups') },
{ path: '/communication-preferences', label: t('nav.commPreferences') },
// Conditionally shown based on patient flags (fetched at login):
// { path: '/anc-eid',   label: t('nav.ancEid') }     — only if patient has ANC registration
// { path: '/growth',    label: t('nav.growth') }      — only if patient has growth measurements
// { path: '/dental',    label: t('nav.dental') }      — only if patient has dental records
```

For the conditionally shown links, fetch flags on login and store in patient auth context:

```typescript
// In PatientAuthContext — after successful login, fetch patient profile flags:
const flags = await api.get('/patient-portal/my-flags').then(r => r.data);
// flags: { hasAncRecord: boolean, hasGrowthRecord: boolean, hasDentalRecord: boolean }
setPatientFlags(flags);
```

Add the `/patient-portal/my-flags` endpoint to `PatientPortalHivController`:

```typescript
@Get('my-flags')
async getMyFlags(@Req() req: Request) {
  const { patientId, tenantDb } = req as any;
  const [anc, growth, dental] = await Promise.all([
    this.db.queryOne(tenantDb, `SELECT id FROM anc_registrations WHERE patient_id = $1 LIMIT 1`, [patientId]),
    this.db.queryOne(tenantDb, `SELECT id FROM growth_measurements WHERE patient_id = $1 LIMIT 1`, [patientId]),
    this.db.queryOne(tenantDb, `SELECT id FROM dental_treatment_plans WHERE patient_id = $1 LIMIT 1`, [patientId]),
  ]);
  return {
    hasAncRecord: !!anc,
    hasGrowthRecord: !!growth,
    hasDentalRecord: !!dental,
  };
}
```

### 6.3 Add dashboard tiles to `DashboardPage.tsx`

Add the following tiles to the existing dashboard grid — only render when the relevant flag is true:

```typescript
// Always show:
{ label: t('nav.supportGroups'),     icon: '👥', path: '/support-groups' },
{ label: t('nav.commPreferences'),   icon: '📱', path: '/communication-preferences' },
// Conditional:
patientFlags.hasAncRecord  && { label: t('nav.ancEid'),  icon: '👶', path: '/anc-eid' },
patientFlags.hasGrowthRecord && { label: t('nav.growth'), icon: '📈', path: '/growth' },
patientFlags.hasDentalRecord && { label: t('nav.dental'), icon: '🦷', path: '/dental' },
```

---

## 7. Translation File Updates

### 7.1 Add new keys to all three locale files

**`patient-portal/public/locales/en/translation.json`** — add:
```json
{
  "nav": {
    "supportGroups": "My Support Groups",
    "commPreferences": "SMS Preferences",
    "ancEid": "Infant HIV Testing",
    "growth": "Growth Chart",
    "dental": "Dental Care"
  },
  "medications": {
    "mmdTitle": "Multi-Month Dispensing",
    "scheduleType": "Schedule",
    "pickupDueSoon": "Due in {{days}} days",
    "pickupOverdue": "Overdue"
  },
  "supportGroups": {
    "title": "My Support Groups",
    "notEnrolled": "You are not currently enrolled in any support groups. Ask your clinic to enrol you.",
    "facilitator": "Facilitator",
    "location": "Location",
    "sessionsAttended": "Sessions attended",
    "nextSession": "Next Session",
    "viewSessions": "View session history",
    "hideSessions": "Hide sessions",
    "date": "Date",
    "topic": "Topic",
    "attended": "Attended"
  },
  "comms": {
    "title": "SMS Preferences",
    "sendingTo": "Sending messages to",
    "nudgeSettings": "Reminder settings",
    "stopAllSms": "Stop all SMS messages",
    "optOutDescription": "You can stop all SMS reminders at any time. You can re-enable them here or by visiting the clinic.",
    "optOutButton": "Stop all SMS messages",
    "optOutConfirm": "Are you sure you want to stop all SMS messages?",
    "optedOutBanner": "You have opted out of all SMS messages",
    "optedOutOn": "Opted out on {{date}}",
    "optBackIn": "Re-enable SMS messages"
  },
  "anc": {
    "title": "Infant HIV Testing",
    "notRegistered": "No antenatal record found. Please visit the clinic.",
    "pregnancyDetails": "Pregnancy Details",
    "lmp": "Last menstrual period",
    "edd": "Expected delivery date",
    "currentRegimen": "ART regimen",
    "notRecorded": "Not recorded",
    "highMtr": "High maternal transmission risk — enhanced counselling required",
    "bornOn": "Born",
    "weeks": "weeks NVP",
    "due": "Due",
    "finalStatus": "Final infant HIV status"
  },
  "growth": {
    "title": "Growth Chart",
    "weightStatus": "Weight-for-age status",
    "lastMeasured": "Last measured",
    "nutritionReferral": "Nutrition referral required — please attend the nutrition clinic",
    "wazChart": "Weight-for-Age Z-score (WAZ)",
    "history": "Measurement history",
    "date": "Date",
    "age": "Age",
    "weight": "Weight",
    "height": "Height",
    "status": "Status"
  },
  "dental": {
    "title": "Dental Care",
    "noTreatmentPlan": "No dental treatment plan on file. Ask your dentist at your next visit.",
    "totalProcedures": "Total procedures",
    "completed": "Completed",
    "pending": "Pending",
    "outstandingCost": "Outstanding cost",
    "procedure": "Procedure",
    "tooth": "Tooth",
    "plannedDate": "Planned date",
    "cost": "Cost (USD)",
    "status": "Status"
  }
}
```

Apply equivalent Shona (`sn`) and Ndebele (`nd`) translations using the same key structure — follow the patterns established in NC-S11 for tone and phrasing. Shona and Ndebele translations for these new keys must be added to `patient-portal/public/locales/sn/translation.json` and `patient-portal/public/locales/nd/translation.json` before this sprint is signed off.

---

## 8. Mobile App — New Screens

### 8.1 Growth Measurement Recording Screen (clinician/nurse)
**File:** `mobile/src/screens/GrowthMeasurementScreen.tsx`

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { api } from '../services/api';
import { useTranslation } from 'react-i18next';

interface Props {
  route: { params: { patientId: string; patientName: string; dateOfBirth: string; sex: 'M' | 'F' } };
  navigation: any;
}

export const GrowthMeasurementScreen: React.FC<Props> = ({ route, navigation }) => {
  const { patientId, patientName, dateOfBirth, sex } = route.params;
  const { t } = useTranslation();
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [muacCm, setMuacCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async () => {
    if (!weightKg && !heightCm) {
      Alert.alert('Validation', 'Weight or height is required.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post('/clinical/growth/measurements', {
        patientId,
        measurementDate: new Date().toISOString().split('T')[0],
        weightKg: weightKg ? parseFloat(weightKg) : null,
        heightCm: heightCm ? parseFloat(heightCm) : null,
        muacCm: muacCm ? parseFloat(muacCm) : null,
        headCircumferenceCm: headCm ? parseFloat(headCm) : null,
        sex,
        dateOfBirth,
      }).then(r => r.data);
      setResult(data);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save measurement.');
    } finally {
      setSubmitting(false);
    }
  };

  const WAZ_COLOUR: Record<string, string> = {
    severe_underweight: '#c53030',
    underweight: '#dd6b20',
    normal: '#276749',
    overweight: '#b7791f',
    unknown: '#a0aec0',
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Growth Measurement</Text>
      <Text style={styles.subtitle}>{patientName}</Text>

      {[
        { label: 'Weight (kg)', value: weightKg, setter: setWeightKg, placeholder: 'e.g. 12.5' },
        { label: 'Height (cm)', value: heightCm, setter: setHeightCm, placeholder: 'e.g. 85.0' },
        { label: 'MUAC (cm)', value: muacCm, setter: setMuacCm, placeholder: 'e.g. 13.5' },
        { label: 'Head Circumference (cm)', value: headCm, setter: setHeadCm, placeholder: 'e.g. 46.0' },
      ].map(field => (
        <View key={field.label} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            style={styles.input}
            value={field.value}
            onChangeText={field.setter}
            keyboardType="decimal-pad"
            placeholder={field.placeholder}
          />
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={submit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Saving...' : 'Save Measurement'}</Text>
      </TouchableOpacity>

      {result && (
        <View style={[styles.resultCard, { borderColor: WAZ_COLOUR[result.wazCategory] ?? '#a0aec0' }]}>
          <Text style={styles.resultTitle}>Z-Score Results</Text>
          <Text style={styles.resultRow}>WAZ: <Text style={{ fontWeight: '700' }}>{result.waz ?? '—'}</Text></Text>
          <Text style={styles.resultRow}>HAZ: <Text style={{ fontWeight: '700' }}>{result.haz ?? '—'}</Text></Text>
          <Text style={[styles.resultStatus, { color: WAZ_COLOUR[result.wazCategory] ?? '#4a5568' }]}>
            {result.wazCategory?.replace(/_/g, ' ').toUpperCase()}
          </Text>
          {result.nutritionReferralNeeded && (
            <View style={styles.referralAlert}>
              <Text style={styles.referralText}>⚠ NUTRITION REFERRAL REQUIRED</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#718096', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, color: '#4a5568', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e0', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#f7fafc' },
  button: { backgroundColor: '#3182ce', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultCard: { marginTop: 20, padding: 16, borderWidth: 2, borderRadius: 8 },
  resultTitle: { fontWeight: '700', fontSize: 15, marginBottom: 8 },
  resultRow: { fontSize: 14, marginBottom: 4 },
  resultStatus: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  referralAlert: { backgroundColor: '#fff5f5', borderRadius: 6, padding: 10, marginTop: 12 },
  referralText: { color: '#c53030', fontWeight: '700', fontSize: 13 },
});
```

### 8.2 MMD Schedule Screen (clinician/nurse)
**File:** `mobile/src/screens/MmdScheduleScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { api } from '../services/api';

interface Props {
  route: { params: { patientId: string; patientName: string } };
}

export const MmdScheduleScreen: React.FC<Props> = ({ route }) => {
  const { patientId, patientName } = route.params;
  const [schedule, setSchedule] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/hiv/patients/${patientId}/mmd/schedule`).then(r => {
      setSchedule(r.data.current);
      setHistory(r.data.history ?? []);
    }).finally(() => setLoading(false));
  }, [patientId]);

  const scheduleNextPickup = () => {
    Alert.prompt('Next Pickup Date', 'Enter date (YYYY-MM-DD)', async (date) => {
      if (!date) return;
      await api.post(`/hiv/patients/${patientId}/mmd/schedule`, {
        scheduleType: schedule?.schedule_type ?? 'standard',
        nextPickupDate: date,
      });
      Alert.alert('Saved', 'Next pickup scheduled.');
      api.get(`/hiv/patients/${patientId}/mmd/schedule`).then(r => {
        setSchedule(r.data.current);
        setHistory(r.data.history ?? []);
      });
    });
  };

  const daysUntil = schedule?.next_pickup_date
    ? Math.round((new Date(schedule.next_pickup_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MMD Schedule</Text>
      <Text style={styles.subtitle}>{patientName}</Text>

      {schedule ? (
        <View style={[styles.card, { borderColor: daysUntil !== null && daysUntil < 0 ? '#fc8181' : '#9ae6b4' }]}>
          <Text style={styles.cardLabel}>Current Schedule</Text>
          <Text style={styles.cardValue}>{schedule.schedule_label}</Text>
          <Text style={styles.cardLabel}>Next Pickup</Text>
          <Text style={[styles.cardValue, { color: daysUntil !== null && daysUntil < 0 ? '#c53030' : '#276749' }]}>
            {schedule.next_pickup_date}
            {daysUntil !== null && (
              <Text style={{ fontSize: 13, fontWeight: '400' }}>
                {daysUntil < 0 ? `  (${Math.abs(daysUntil)} days overdue)` : `  (in ${daysUntil} days)`}
              </Text>
            )}
          </Text>
          <Text style={styles.cardLabel}>Regimen</Text>
          <Text style={styles.cardValue}>{schedule.current_regimen ?? '—'}</Text>
        </View>
      ) : (
        <Text style={{ color: '#718096', marginBottom: 16 }}>No active MMD schedule.</Text>
      )}

      <TouchableOpacity style={styles.button} onPress={scheduleNextPickup}>
        <Text style={styles.buttonText}>Schedule Next Pickup</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Pickup History</Text>
      <FlatList
        data={history}
        keyExtractor={item => item.created_at}
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <Text style={styles.historyDate}>{item.next_pickup_date}</Text>
            <Text style={styles.historyType}>{item.schedule_type}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: '#a0aec0', fontSize: 13 }}>No history.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#718096', marginBottom: 16 },
  card: { borderWidth: 2, borderRadius: 8, padding: 16, marginBottom: 16 },
  cardLabel: { fontSize: 11, color: '#718096', marginTop: 8 },
  cardValue: { fontSize: 16, fontWeight: '600' },
  button: { backgroundColor: '#3182ce', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 24 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  historyDate: { fontSize: 14 },
  historyType: { fontSize: 13, color: '#718096' },
});
```

### 8.3 Register new screens in `PatientStackNavigator.tsx`

```typescript
// Add imports:
import { GrowthMeasurementScreen } from '../screens/GrowthMeasurementScreen';
import { MmdScheduleScreen } from '../screens/MmdScheduleScreen';

// Add inside <Stack.Navigator>:
<Stack.Screen name="GrowthMeasurement" component={GrowthMeasurementScreen} options={{ title: 'Growth Measurement' }} />
<Stack.Screen name="MmdSchedule" component={MmdScheduleScreen} options={{ title: 'MMD Schedule' }} />
```

### 8.4 Add entry points in `PatientHealthScreen.tsx`

In the patient health overview tab (where existing clinical tabs are), add two new action buttons:

```typescript
// Inside the patient detail tab strip or action list:
<TouchableOpacity onPress={() => navigation.navigate('GrowthMeasurement', {
  patientId: patient.id,
  patientName: `${patient.first_name} ${patient.last_name}`,
  dateOfBirth: patient.date_of_birth,
  sex: patient.sex,
})}>
  <Text>Record Growth Measurement</Text>
</TouchableOpacity>

<TouchableOpacity onPress={() => navigation.navigate('MmdSchedule', {
  patientId: patient.id,
  patientName: `${patient.first_name} ${patient.last_name}`,
})}>
  <Text>MMD Schedule</Text>
</TouchableOpacity>
```

---

## 9. Tests Required

**File:** `services/ehr-service/src/controllers/__tests__/patient-portal-hiv.controller.spec.ts`

```typescript
describe('PatientPortalHivController', () => {
  describe('GET /patient-portal/mmd/schedule', () => {
    it('returns current schedule and history for authenticated patient', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ schedule_type: '3-month', next_pickup_date: '2026-07-01', days_until_pickup: 45 });
      mockDb.query.mockResolvedValueOnce([]);
      const result = await controller.getMmdSchedule(mockReq('p1'));
      expect(result.current.schedule_type).toBe('3-month');
    });

    it('returns null current when no active schedule', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([]);
      const result = await controller.getMmdSchedule(mockReq('p1'));
      expect(result.current).toBeNull();
    });
  });

  describe('GET /patient-portal/support-groups', () => {
    it('returns only groups where patient is active member', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 'g1', name: 'Teen Club', membership_status: 'active' }]);
      const result = await controller.getSupportGroups(mockReq('p1'));
      expect(result.groups).toHaveLength(1);
    });
  });

  describe('PUT /patient-portal/communication-preferences', () => {
    it('inserts into sms_opt_outs when smsOptOut=true', async () => {
      mockDb.query.mockResolvedValue([]);
      await controller.updateCommunicationPreferences({ smsOptOut: true }, mockReq('p1'));
      expect(mockDb.query).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('sms_opt_outs'), expect.any(Array));
    });

    it('deletes from sms_opt_outs when smsOptOut=false', async () => {
      mockDb.query.mockResolvedValue([]);
      await controller.updateCommunicationPreferences({ smsOptOut: false }, mockReq('p1'));
      expect(mockDb.query).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('DELETE FROM sms_opt_outs'), expect.any(Array));
    });
  });

  describe('GET /patient-portal/anc/eid-schedule', () => {
    it('annotates overdue timepoints correctly', async () => {
      const pastDate = '2026-01-01'; // in the past
      mockDb.query.mockResolvedValueOnce([{
        id: 'e1', infant_name: 'Baby', birth_date: '2025-11-01',
        test_6w_due: pastDate, test_6w_result: null, test_6w_done_at: null,
        test_4m_due: null, test_4m_result: null, test_4m_done_at: null,
        test_12m_due: null, test_12m_result: null, test_12m_done_at: null,
        test_18m_due: null, test_18m_result: null, test_18m_done_at: null,
        nvp_duration_weeks: 6, final_hiv_status: null, transmission_occurred: null,
      }]);
      const result = await controller.getEidSchedule(mockReq('p1'));
      expect(result[0].timepoints[0].status).toBe('overdue');
    });

    it('annotates done timepoints correctly', async () => {
      mockDb.query.mockResolvedValueOnce([{
        id: 'e1', infant_name: 'Baby', birth_date: '2025-06-01',
        test_6w_due: '2025-07-15', test_6w_result: 'negative', test_6w_done_at: '2025-07-14',
        test_4m_due: null, test_4m_result: null, test_4m_done_at: null,
        test_12m_due: null, test_12m_result: null, test_12m_done_at: null,
        test_18m_due: null, test_18m_result: null, test_18m_done_at: null,
        nvp_duration_weeks: 6, final_hiv_status: null, transmission_occurred: null,
      }]);
      const result = await controller.getEidSchedule(mockReq('p1'));
      expect(result[0].timepoints[0].status).toBe('done');
    });
  });

  describe('GET /patient-portal/growth/history', () => {
    it('returns measurements and latestStatus', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 'm1', measurement_date: '2026-04-01', waz: -1.2, waz_category: 'normal', nutrition_referral_needed: false },
      ]);
      const result = await controller.getGrowthHistory(mockReq('p1'));
      expect(result.measurements).toHaveLength(1);
      expect(result.latestStatus.wazCategory).toBe('normal');
    });
  });

  describe('GET /patient-portal/my-flags', () => {
    it('returns false for all flags when no records exist', async () => {
      mockDb.queryOne.mockResolvedValue(null);
      const result = await controller.getMyFlags(mockReq('p1'));
      expect(result).toEqual({ hasAncRecord: false, hasGrowthRecord: false, hasDentalRecord: false });
    });

    it('returns true for hasAncRecord when ANC registration exists', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce({ id: 'anc1' }) // ANC
        .mockResolvedValueOnce(null)            // growth
        .mockResolvedValueOnce(null);           // dental
      const result = await controller.getMyFlags(mockReq('p1'));
      expect(result.hasAncRecord).toBe(true);
    });
  });
});
```

**File:** `patient-portal/src/pages/__tests__/SupportGroupsPage.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { SupportGroupsPage } from '../SupportGroupsPage';
import * as api from '../../services/api';

jest.mock('../../services/api');

describe('SupportGroupsPage', () => {
  it('renders enrolled groups', async () => {
    (api.getPatientSupportGroups as jest.Mock).mockResolvedValue({
      groups: [{ id: 'g1', name: 'Teen Club', group_type: 'ALHIV', meeting_schedule: 'Monthly', facilitator_name: 'Sr Moyo', location: 'Room 3', next_session: null, sessions_attended: 4 }],
    });
    render(<SupportGroupsPage />);
    await waitFor(() => expect(screen.getByText('Teen Club')).toBeInTheDocument());
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows not-enrolled message when no groups', async () => {
    (api.getPatientSupportGroups as jest.Mock).mockResolvedValue({ groups: [] });
    render(<SupportGroupsPage />);
    await waitFor(() => expect(screen.getByText(/not currently enrolled/i)).toBeInTheDocument());
  });
});
```

**File:** `mobile/src/screens/__tests__/GrowthMeasurementScreen.test.tsx`

```typescript
describe('GrowthMeasurementScreen', () => {
  it('shows z-score results after submission', async () => {
    api.post.mockResolvedValue({ data: { waz: -1.1, haz: -0.8, wazCategory: 'normal', nutritionReferralNeeded: false } });
    // render screen, fill weight, press save, assert result card visible
  });

  it('shows nutrition referral alert when waz < -2', async () => {
    api.post.mockResolvedValue({ data: { waz: -2.5, wazCategory: 'underweight', nutritionReferralNeeded: true } });
    // assert "NUTRITION REFERRAL REQUIRED" visible
  });
});
```

---

## 10. Sign-off Criteria

- [ ] `npm run lint` passes zero errors in `services/ehr-service`, `patient-portal`, `mobile`
- [ ] `npm test` passes all tests including `PatientPortalHivController`, `SupportGroupsPage`, `GrowthMeasurementScreen` specs
- [ ] CI `build-and-test` job passes green
- [ ] `POST /api/admin/tenants/repair-all` backfills `patient_portal_visible` column on `anc_registrations` and `eid_schedules`
- [ ] Patient portal `MedicationsPage` shows MMD schedule type, next pickup date, and overdue badge when past due
- [ ] Patient portal `MedicationsPage` "Request Refill" button calls `POST /patient-portal/mmd/request-refill` and disables after click
- [ ] Patient portal `SupportGroupsPage` shows enrolled groups; "View session history" expands session table with attended checkmarks
- [ ] Patient portal `SupportGroupsPage` shows "not enrolled" message when patient has no active group memberships
- [ ] Patient portal `CommunicationPreferencesPage` shows per-nudge toggles; toggling and saving calls `PUT /patient-portal/communication-preferences` with `nudgeUpdates`
- [ ] Patient portal `CommunicationPreferencesPage` global opt-out sets `sms_opt_outs` record; re-enable deletes it
- [ ] Patient portal `AncEidTrackerPage` shows EID timepoints with correct status badges (overdue=red, due_soon=amber, done=green, upcoming=blue)
- [ ] Patient portal `AncEidTrackerPage` hidden from nav when `hasAncRecord = false`
- [ ] Patient portal `GrowthChartPage` renders WAZ line chart against WHO reference lines (−2 SD, −3 SD)
- [ ] Patient portal `GrowthChartPage` shows nutrition referral warning card when `nutrition_referral_needed = true`
- [ ] Patient portal `GrowthChartPage` hidden from nav when `hasGrowthRecord = false`
- [ ] Patient portal `DentalSummaryPage` shows treatment plan table with status pills and cost summary
- [ ] Patient portal `DentalSummaryPage` hidden from nav when `hasDentalRecord = false`
- [ ] All new patient portal pages render correctly in ChiShona and IsiNdebele (no `[key]` placeholders)
- [ ] Mobile `GrowthMeasurementScreen` posts to `/clinical/growth/measurements`, receives z-scores, displays nutritional status and referral alert
- [ ] Mobile `MmdScheduleScreen` shows current schedule, days until pickup (red if overdue), and pickup history
- [ ] Mobile navigator registers both new screens and they are reachable from `PatientHealthScreen`
- [ ] `GET /patient-portal/my-flags` returns correct boolean flags based on presence of records in each table
- [ ] Patient JWT cannot access another patient's data — verify `patient_id = $patientId` filter in every query
