# NC-S06 — WEEP + MEEP Economic Empowerment + Support Group Management

**Sprint ID:** NC-S06  
**Priority:** P2 — Newlands-specific clinical differentiation  
**Effort:** 1.5 weeks  
**Dependencies:** NC-S05  
**Covers gaps:** 7.4 (WEEP — missing → complete), 7.5 (MEEP — missing → complete), 7.6 (support groups — missing → complete)

---

## 1. Codebase Context — What Already Exists

| File | What it has |
|---|---|
| `services/ehr-service/src/cultural/entities/social-determinant.entity.ts` | SDOH entity with food security, housing, employment fields |
| `services/ehr-service/src/entities/community-resource.entity.ts` | Community resources with categories |
| `services/ehr-service/src/services/post-visit.service.ts` | Patient AI follow-up with SDOH-aware context |

**No WEEP, MEEP, or support group modules exist anywhere in the codebase.**

---

## 2. What This Sprint Builds

### Part A — WEEP / MEEP Economic Empowerment Tracking
Newlands Clinic runs two key programmes:
- **WEEP**: Women's Economic Empowerment Programme — business skills training, microloan access, income-generating activity support
- **MEEP**: Men's Economic Empowerment Programme — male engagement, livelihood skills

Both programmes track enrolment, training milestones, loan status, income outcomes, and graduation.

### Part B — Support Group Management
- Support group directory (group name, type, meeting schedule, facilitator)
- Patient-group enrolment tracking
- Attendance records
- Group facilitation notes

---

## 3. Database Changes

Add bundle to `getProvisioningBundles()`:

```typescript
{
  id: 'nc_empowerment_support_groups',
  label: 'WEEP + MEEP Empowerment + Support Groups',
  version: '2026.05.17.1',
  description: 'Women and Men Economic Empowerment Programme tracking; peer support group management',
  statements: () => [
    // Economic empowerment programmes (WEEP/MEEP)
    `CREATE TABLE IF NOT EXISTS empowerment_programmes (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      programme_type    VARCHAR(10)  NOT NULL,    -- 'WEEP' | 'MEEP'
      programme_name    VARCHAR(200) NOT NULL,
      cohort_number     INTEGER,
      start_date        DATE         NOT NULL,
      end_date          DATE,
      facilitator_name  VARCHAR(200),
      venue             VARCHAR(300),
      max_participants  INTEGER,
      status            VARCHAR(20)  NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'cancelled'
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_empowerment_prog_type ON empowerment_programmes (programme_type)`,

    `CREATE TABLE IF NOT EXISTS empowerment_enrolments (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id          UUID         NOT NULL,
      programme_id        UUID         NOT NULL REFERENCES empowerment_programmes(id),
      enrolment_date      DATE         NOT NULL,
      referred_by         UUID,
      referral_reason     TEXT,
      -- Status tracking
      status              VARCHAR(30)  NOT NULL DEFAULT 'enrolled',
      -- Values: 'enrolled' | 'active' | 'graduated' | 'dropped_out' | 'transferred'
      dropout_reason      TEXT,
      graduation_date     DATE,
      -- Baseline economic indicators
      baseline_income     VARCHAR(100),  -- descriptive: 'none' | 'irregular' | 'USD 50-100/month'
      baseline_employment VARCHAR(100),  -- 'unemployed' | 'informal' | 'formal_part_time' | 'formal_full_time'
      -- Outcome indicators (at graduation or latest review)
      outcome_income      VARCHAR(100),
      outcome_employment  VARCHAR(100),
      has_business        BOOLEAN      NOT NULL DEFAULT false,
      business_type       VARCHAR(200),
      loan_received       BOOLEAN      NOT NULL DEFAULT false,
      loan_amount_usd     NUMERIC(10,2),
      loan_status         VARCHAR(20),  -- 'active' | 'repaid' | 'defaulted'
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_empowerment_enrol_patient ON empowerment_enrolments (patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_empowerment_enrol_prog    ON empowerment_enrolments (programme_id)`,

    `CREATE TABLE IF NOT EXISTS empowerment_milestones (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrolment_id    UUID         NOT NULL REFERENCES empowerment_enrolments(id),
      milestone_date  DATE         NOT NULL,
      milestone_type  VARCHAR(60)  NOT NULL,
      -- Values: 'module_completed' | 'business_plan_submitted' | 'loan_application' | 'loan_disbursed' | 'first_sale' | 'six_month_review' | 'graduation'
      milestone_notes TEXT,
      recorded_by     UUID,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_empowerment_milestone_enrol ON empowerment_milestones (enrolment_id)`,

    // Support groups
    `CREATE TABLE IF NOT EXISTS support_groups (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_name        VARCHAR(200) NOT NULL,
      group_type        VARCHAR(60)  NOT NULL,
      -- Values: 'plhiv_general' | 'women_plhiv' | 'adolescent_hiv' | 'peer_support' | 'family_support' | 'bereavement' | 'other'
      facilitator_name  VARCHAR(200),
      co_facilitator    VARCHAR(200),
      meeting_day       VARCHAR(15),   -- 'Monday' | 'Tuesday' etc.
      meeting_time      TIME,
      meeting_frequency VARCHAR(20),   -- 'weekly' | 'biweekly' | 'monthly'
      venue             VARCHAR(300),
      max_members       INTEGER,
      status            VARCHAR(20)  NOT NULL DEFAULT 'active',  -- 'active' | 'closed'
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS support_group_members (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id        UUID         NOT NULL REFERENCES support_groups(id),
      patient_id      UUID         NOT NULL,
      joined_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
      status          VARCHAR(20)  NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'transferred' | 'left'
      left_date       DATE,
      left_reason     TEXT,
      UNIQUE (group_id, patient_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sg_members_group   ON support_group_members (group_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sg_members_patient ON support_group_members (patient_id)`,

    `CREATE TABLE IF NOT EXISTS support_group_sessions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id        UUID         NOT NULL REFERENCES support_groups(id),
      session_date    DATE         NOT NULL,
      topic           VARCHAR(300),
      facilitator_id  UUID,
      venue           VARCHAR(300),
      planned_count   INTEGER,
      actual_count    INTEGER,
      notes           TEXT,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sg_sessions_group ON support_group_sessions (group_id)`,

    `CREATE TABLE IF NOT EXISTS support_group_attendance (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id      UUID         NOT NULL REFERENCES support_group_sessions(id),
      patient_id      UUID         NOT NULL,
      attended        BOOLEAN      NOT NULL DEFAULT true,
      absence_reason  TEXT,
      UNIQUE (session_id, patient_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sg_attendance_session ON support_group_attendance (session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sg_attendance_patient ON support_group_attendance (patient_id)`,
  ],
},
```

Run `POST /api/admin/tenants/repair-all` after adding.

---

## 4. Backend Implementation

### 4.1 Economic Empowerment Service

**File to create:** `services/ehr-service/src/services/empowerment.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmpowermentService {
  // --- Programmes ---
  async createProgramme(dto: {
    programmeType: 'WEEP' | 'MEEP';
    programmeName: string;
    cohortNumber?: number;
    startDate: string;
    endDate?: string;
    facilitatorName?: string;
    venue?: string;
    maxParticipants?: number;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO empowerment_programmes
         (programme_type, programme_name, cohort_number, start_date, end_date, facilitator_name, venue, max_participants)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [dto.programmeType, dto.programmeName, dto.cohortNumber ?? null, dto.startDate,
       dto.endDate ?? null, dto.facilitatorName ?? null, dto.venue ?? null, dto.maxParticipants ?? null],
    );
    return row;
  }

  async listProgrammes(type: 'WEEP' | 'MEEP' | null, db: any): Promise<any[]> {
    if (type) {
      return db.query(`SELECT * FROM empowerment_programmes WHERE programme_type = $1 ORDER BY start_date DESC`, [type]);
    }
    return db.query(`SELECT * FROM empowerment_programmes ORDER BY programme_type, start_date DESC`);
  }

  // --- Enrolments ---
  async enrolPatient(dto: {
    patientId: string;
    programmeId: string;
    referredBy?: string;
    referralReason?: string;
    baselineIncome?: string;
    baselineEmployment?: string;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO empowerment_enrolments
         (patient_id, programme_id, enrolment_date, referred_by, referral_reason, baseline_income, baseline_employment)
       VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6) RETURNING *`,
      [dto.patientId, dto.programmeId, dto.referredBy ?? null, dto.referralReason ?? null,
       dto.baselineIncome ?? null, dto.baselineEmployment ?? null],
    );
    return row;
  }

  async updateEnrolmentOutcomes(enrolmentId: string, dto: {
    status?: string;
    outcomeIncome?: string;
    outcomeEmployment?: string;
    hasBusiness?: boolean;
    businessType?: string;
    loanReceived?: boolean;
    loanAmountUsd?: number;
    loanStatus?: string;
    graduationDate?: string;
    dropoutReason?: string;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `UPDATE empowerment_enrolments SET
         status             = COALESCE($1, status),
         outcome_income     = COALESCE($2, outcome_income),
         outcome_employment = COALESCE($3, outcome_employment),
         has_business       = COALESCE($4, has_business),
         business_type      = COALESCE($5, business_type),
         loan_received      = COALESCE($6, loan_received),
         loan_amount_usd    = COALESCE($7, loan_amount_usd),
         loan_status        = COALESCE($8, loan_status),
         graduation_date    = COALESCE($9::DATE, graduation_date),
         dropout_reason     = COALESCE($10, dropout_reason),
         updated_at         = now()
       WHERE id = $11 RETURNING *`,
      [dto.status, dto.outcomeIncome, dto.outcomeEmployment, dto.hasBusiness, dto.businessType,
       dto.loanReceived, dto.loanAmountUsd, dto.loanStatus, dto.graduationDate, dto.dropoutReason, enrolmentId],
    );
    return row;
  }

  async addMilestone(enrolmentId: string, dto: { milestoneType: string; milestoneNotes?: string; recordedBy: string }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO empowerment_milestones (enrolment_id, milestone_date, milestone_type, milestone_notes, recorded_by)
       VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
      [enrolmentId, dto.milestoneType, dto.milestoneNotes ?? null, dto.recordedBy],
    );
    return row;
  }

  async getPatientEnrolments(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT e.*, p.programme_name, p.programme_type
       FROM empowerment_enrolments e
       JOIN empowerment_programmes p ON p.id = e.programme_id
       WHERE e.patient_id = $1 ORDER BY e.enrolment_date DESC`,
      [patientId],
    );
  }

  async getProgrammeStats(programmeId: string, db: any): Promise<any> {
    const [stats] = await db.query(
      `SELECT
         COUNT(*) AS total_enrolled,
         COUNT(*) FILTER (WHERE status = 'graduated')  AS graduated,
         COUNT(*) FILTER (WHERE status = 'dropped_out') AS dropped_out,
         COUNT(*) FILTER (WHERE has_business = true)    AS businesses_started,
         COUNT(*) FILTER (WHERE loan_received = true)   AS loans_received,
         AVG(loan_amount_usd) FILTER (WHERE loan_received = true) AS avg_loan_usd
       FROM empowerment_enrolments WHERE programme_id = $1`,
      [programmeId],
    );
    return stats;
  }
}
```

### 4.2 Support Group Service

**File to create:** `services/ehr-service/src/services/support-groups.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class SupportGroupsService {
  async createGroup(dto: {
    groupName: string;
    groupType: string;
    facilitatorName?: string;
    meetingDay?: string;
    meetingTime?: string;
    meetingFrequency?: string;
    venue?: string;
    maxMembers?: number;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO support_groups (group_name, group_type, facilitator_name, meeting_day, meeting_time, meeting_frequency, venue, max_members)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [dto.groupName, dto.groupType, dto.facilitatorName ?? null, dto.meetingDay ?? null,
       dto.meetingTime ?? null, dto.meetingFrequency ?? null, dto.venue ?? null, dto.maxMembers ?? null],
    );
    return row;
  }

  async listGroups(db: any): Promise<any[]> {
    return db.query(`
      SELECT g.*, COUNT(m.id) AS member_count
      FROM support_groups g
      LEFT JOIN support_group_members m ON m.group_id = g.id AND m.status = 'active'
      WHERE g.status = 'active'
      GROUP BY g.id ORDER BY g.group_name
    `);
  }

  async addMember(groupId: string, patientId: string, db: any): Promise<void> {
    await db.query(
      `INSERT INTO support_group_members (group_id, patient_id, joined_date)
       VALUES ($1, $2, CURRENT_DATE)
       ON CONFLICT (group_id, patient_id) DO UPDATE SET status = 'active', left_date = NULL`,
      [groupId, patientId],
    );
  }

  async removeMember(groupId: string, patientId: string, reason: string, db: any): Promise<void> {
    await db.query(
      `UPDATE support_group_members SET status = 'left', left_date = CURRENT_DATE, left_reason = $1
       WHERE group_id = $2 AND patient_id = $3`,
      [reason, groupId, patientId],
    );
  }

  async createSession(dto: {
    groupId: string;
    sessionDate: string;
    topic?: string;
    facilitatorId?: string;
    venue?: string;
    plannedCount?: number;
    notes?: string;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO support_group_sessions (group_id, session_date, topic, facilitator_id, venue, planned_count, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [dto.groupId, dto.sessionDate, dto.topic ?? null, dto.facilitatorId ?? null,
       dto.venue ?? null, dto.plannedCount ?? null, dto.notes ?? null],
    );
    return row;
  }

  async recordAttendance(sessionId: string, attendees: Array<{ patientId: string; attended: boolean; absenceReason?: string }>, db: any): Promise<void> {
    for (const a of attendees) {
      await db.query(
        `INSERT INTO support_group_attendance (session_id, patient_id, attended, absence_reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, patient_id) DO UPDATE SET attended = $3, absence_reason = $4`,
        [sessionId, a.patientId, a.attended, a.absenceReason ?? null],
      );
    }
    // Update actual_count on session
    await db.query(
      `UPDATE support_group_sessions SET actual_count = (
         SELECT COUNT(*) FROM support_group_attendance WHERE session_id = $1 AND attended = true
       ) WHERE id = $1`,
      [sessionId],
    );
  }

  async getPatientGroupMemberships(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT m.*, g.group_name, g.group_type, g.meeting_day, g.meeting_time
       FROM support_group_members m
       JOIN support_groups g ON g.id = m.group_id
       WHERE m.patient_id = $1 AND m.status = 'active'`,
      [patientId],
    );
  }

  async getGroupAttendanceStats(groupId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT s.session_date, s.topic, s.planned_count, s.actual_count,
              ROUND(s.actual_count::NUMERIC / NULLIF(s.planned_count, 0) * 100, 1) AS attendance_pct
       FROM support_group_sessions s
       WHERE s.group_id = $1 ORDER BY s.session_date DESC LIMIT 12`,
      [groupId],
    );
  }
}
```

### 4.3 Controller

**File to create:** `services/ehr-service/src/controllers/empowerment.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmpowermentService } from '../services/empowerment.service';
import { SupportGroupsService } from '../services/support-groups.service';

@Controller('empowerment')
@UseGuards(JwtAuthGuard)
export class EmpowermentController {
  constructor(
    private readonly empowermentSvc: EmpowermentService,
    private readonly sgSvc: SupportGroupsService,
  ) {}

  // WEEP/MEEP Programmes
  @Get('programmes')
  listProgrammes(@Query('type') type: string, @Req() req: any) {
    const t = (type === 'WEEP' || type === 'MEEP') ? type : null;
    return this.empowermentSvc.listProgrammes(t, req.tenantDb);
  }

  @Post('programmes')
  createProgramme(@Body() body: any, @Req() req: any) {
    return this.empowermentSvc.createProgramme(body, req.tenantDb);
  }

  @Get('programmes/:id/stats')
  getProgrammeStats(@Param('id') id: string, @Req() req: any) {
    return this.empowermentSvc.getProgrammeStats(id, req.tenantDb);
  }

  @Post('patients/:id/enrol')
  enrolPatient(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.empowermentSvc.enrolPatient({ ...body, patientId: id }, req.tenantDb);
  }

  @Patch('enrolments/:id')
  updateEnrolment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.empowermentSvc.updateEnrolmentOutcomes(id, body, req.tenantDb);
  }

  @Post('enrolments/:id/milestones')
  addMilestone(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.empowermentSvc.addMilestone(id, { ...body, recordedBy: req.user.sub }, req.tenantDb);
  }

  @Get('patients/:id/enrolments')
  getPatientEnrolments(@Param('id') id: string, @Req() req: any) {
    return this.empowermentSvc.getPatientEnrolments(id, req.tenantDb);
  }

  // Support Groups
  @Get('support-groups')
  listGroups(@Req() req: any) { return this.sgSvc.listGroups(req.tenantDb); }

  @Post('support-groups')
  createGroup(@Body() body: any, @Req() req: any) { return this.sgSvc.createGroup(body, req.tenantDb); }

  @Post('support-groups/:groupId/members/:patientId')
  addMember(@Param('groupId') groupId: string, @Param('patientId') patientId: string, @Req() req: any) {
    return this.sgSvc.addMember(groupId, patientId, req.tenantDb);
  }

  @Patch('support-groups/:groupId/members/:patientId/remove')
  removeMember(@Param('groupId') gid: string, @Param('patientId') pid: string, @Body() body: { reason: string }, @Req() req: any) {
    return this.sgSvc.removeMember(gid, pid, body.reason, req.tenantDb);
  }

  @Post('support-groups/:groupId/sessions')
  createSession(@Param('groupId') groupId: string, @Body() body: any, @Req() req: any) {
    return this.sgSvc.createSession({ ...body, groupId, facilitatorId: req.user.sub }, req.tenantDb);
  }

  @Post('support-groups/sessions/:sessionId/attendance')
  recordAttendance(@Param('sessionId') sid: string, @Body() body: { attendees: any[] }, @Req() req: any) {
    return this.sgSvc.recordAttendance(sid, body.attendees, req.tenantDb);
  }

  @Get('patients/:id/groups')
  getPatientGroups(@Param('id') id: string, @Req() req: any) {
    return this.sgSvc.getPatientGroupMemberships(id, req.tenantDb);
  }

  @Get('support-groups/:groupId/attendance-stats')
  getAttendanceStats(@Param('groupId') gid: string, @Req() req: any) {
    return this.sgSvc.getGroupAttendanceStats(gid, req.tenantDb);
  }
}
```

**Register** `EmpowermentController`, `EmpowermentService`, `SupportGroupsService` in `services/ehr-service/src/ehr.module.ts`.

---

## 5. Frontend Implementation

### 5.1 WEEP/MEEP Dashboard Page

**File to create:** `ehr-frontend/src/pages/EmpowermentDashboard.tsx`

- Tabs: WEEP | MEEP | Support Groups
- Programme list with cohort cards showing: enrolled count, graduated count, businesses started, loans given
- Enrolment table per programme with status badges
- "Add Programme" button
- "Enrol Patient" modal (patient search + baseline indicators)
- Milestone timeline for each enrolment

### 5.2 Support Groups Management Page

**File to create:** `ehr-frontend/src/pages/SupportGroupsPage.tsx`

- Group cards: name, type, meeting schedule, member count
- "New Group" form
- Group detail view: member list, session history, attendance chart (bar chart)
- "Record Session" modal with attendance roster
- Attendance heatmap per session (green = attended, red = absent)

### 5.3 Patient Profile Integration

In patient detail page, add "Programmes" tab showing:
- Current WEEP/MEEP enrolment status
- Milestone timeline
- Support group memberships

---

## 6. Tests Required

```typescript
// empowerment.service.spec.ts
describe('EmpowermentService', () => {
  it('enrolPatient inserts with correct fields', async () => {
    const mockDb = { query: jest.fn().mockResolvedValue([{ id: 'enrol-1', patient_id: 'p1' }]) };
    const svc = new EmpowermentService();
    const result = await svc.enrolPatient({ patientId: 'p1', programmeId: 'prog-1' }, mockDb);
    expect(result.patient_id).toBe('p1');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('empowerment_enrolments'), expect.any(Array));
  });
});

// support-groups.service.spec.ts
describe('SupportGroupsService', () => {
  it('addMember uses ON CONFLICT DO UPDATE to re-activate inactive member', async () => {
    const mockDb = { query: jest.fn().mockResolvedValue({}) };
    const svc = new SupportGroupsService();
    await svc.addMember('g1', 'p1', mockDb);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (group_id, patient_id) DO UPDATE SET status = 'active'"),
      ['g1', 'p1'],
    );
  });

  it('recordAttendance updates actual_count on session', async () => {
    const mockDb = { query: jest.fn().mockResolvedValue({}) };
    const svc = new SupportGroupsService();
    await svc.recordAttendance('s1', [{ patientId: 'p1', attended: true }], mockDb);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('actual_count'),
      ['s1'],
    );
  });
});
```

---

## 7. Sign-off Criteria

- [ ] `empowerment_programmes`, `empowerment_enrolments`, `empowerment_milestones` tables provisioned in all tenant DBs
- [ ] `support_groups`, `support_group_members`, `support_group_sessions`, `support_group_attendance` tables provisioned
- [ ] `repair-all` backfills all 7 new tables in existing tenants
- [ ] `POST /empowerment/programmes` creates WEEP/MEEP programme correctly
- [ ] `POST /empowerment/patients/:id/enrol` creates enrolment linked to patient and programme
- [ ] `PATCH /empowerment/enrolments/:id` updates outcome fields without overwriting unchanged fields
- [ ] `POST /empowerment/enrolments/:id/milestones` adds milestone to correct enrolment
- [ ] `GET /empowerment/programmes/:id/stats` returns numeric counts (not strings)
- [ ] `POST /empowerment/support-groups/:groupId/members/:patientId` handles re-enrolment of previously left member
- [ ] `POST /empowerment/support-groups/sessions/:sessionId/attendance` updates `actual_count` on session
- [ ] `GET /empowerment/support-groups/:groupId/attendance-stats` returns last 12 sessions with attendance_pct
- [ ] EmpowermentDashboard renders with WEEP and MEEP tabs
- [ ] SupportGroupsPage renders group list with member counts
- [ ] `EmpowermentController` registered in `ehr.module.ts`
- [ ] `npm run lint` passes zero errors
- [ ] `npm test` passes zero failures
- [ ] CI `build-and-test` job passes green
