import { Controller, Get, Put, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';

export function timepointStatus(due: string | null, result: string | null): string {
  if (result) return 'done';
  if (!due) return 'not_scheduled';
  const dueDate = new Date(due);
  const today = new Date();
  const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 14) return 'due_soon';
  return 'upcoming';
}

@Controller('patient-portal')
@UseGuards(PatientJwtAuthGuard)
export class PatientPortalHivController {

  // ── A: MMD Schedule ──────────────────────────────────────────────

  @Get('mmd/schedule')
  async getMmdSchedule(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const scheduleRows = await db.query(
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

    const history = await db.query(
      `SELECT schedule_type, next_pickup_date, created_at
       FROM hiv_mmd_schedules
       WHERE patient_id = $1
       ORDER BY created_at DESC LIMIT 12`,
      [patientId],
    );

    return { current: scheduleRows[0] ?? null, history };
  }

  @Post('mmd/request-refill')
  async requestRefill(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    await db.query(
      `UPDATE hiv_mmd_schedules
       SET requested_via_portal = true, updated_at = NOW()
       WHERE patient_id = $1 AND is_active = true`,
      [patientId],
    );

    return { requested: true, message: 'Refill request received. Your medication will be prepared within 3 working days.' };
  }

  // ── B: Support Groups ─────────────────────────────────────────────

  @Get('support-groups')
  async getSupportGroups(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const groups = await db.query(
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
  async getGroupSessions(@Param('groupId') groupId: string, @Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const memberRows = await db.query(
      `SELECT id FROM support_group_members WHERE group_id = $1 AND patient_id = $2 AND status = 'active'`,
      [groupId, patientId],
    );
    const member = memberRows[0] ?? null;
    if (!member) return { sessions: [] };

    const sessions = await db.query(
      `SELECT s.id, s.session_date, s.start_time, s.end_time, s.topic, s.location,
              a.attended, a.notes as attendance_note
       FROM support_group_sessions s
       LEFT JOIN support_group_attendance a ON a.session_id = s.id AND a.member_id = $2
       WHERE s.group_id = $1
       ORDER BY s.session_date DESC LIMIT 24`,
      [groupId, member.id],
    );

    return { sessions };
  }

  // ── C: Communication Preferences ─────────────────────────────────

  @Get('communication-preferences')
  async getCommunicationPreferences(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const [nudges, optOutRows, patientRows] = await Promise.all([
      db.query(
        `SELECT id, nudge_type, frequency, preferred_time, language, is_active, next_send_at
         FROM adherence_nudge_schedules
         WHERE patient_id = $1`,
        [patientId],
      ),
      db.query(
        `SELECT opted_out_at, reason FROM sms_opt_outs WHERE patient_id = $1`,
        [patientId],
      ),
      db.query(
        `SELECT preferred_language, phone_number FROM patients WHERE id = $1`,
        [patientId],
      ),
    ]);

    const optOut = optOutRows[0] ?? null;
    const patient = patientRows[0] ?? null;

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
    @Req() req: any,
  ) {
    const { patientId, tenantDb: db } = req;

    if (body.smsOptOut === true) {
      await db.query(
        `INSERT INTO sms_opt_outs (patient_id, opted_out_at, reason)
         VALUES ($1, NOW(), $2)
         ON CONFLICT DO NOTHING`,
        [patientId, body.optOutReason ?? 'Patient request via portal'],
      );
      await db.query(
        `UPDATE adherence_nudge_schedules SET is_active = false WHERE patient_id = $1`,
        [patientId],
      );
    } else if (body.smsOptOut === false) {
      await db.query(`DELETE FROM sms_opt_outs WHERE patient_id = $1`, [patientId]);
    }

    if (body.nudgeUpdates?.length) {
      for (const update of body.nudgeUpdates) {
        await db.query(
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
  async getAncRegistration(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const ancRows = await db.query(
      `SELECT id, lmp_date, edd, gravida, para, hiv_status,
              art_start_date, current_regimen,
              vl_at_36_weeks, maternal_transmission_risk,
              delivery_date, mode_of_delivery, birth_outcome
       FROM anc_registrations
       WHERE patient_id = $1 AND patient_portal_visible = true
       ORDER BY created_at DESC LIMIT 1`,
      [patientId],
    );
    const anc = ancRows[0] ?? null;
    if (!anc) return { registered: false };

    const visits = await db.query(
      `SELECT visit_date, gestational_age_weeks, weight_kg, blood_pressure,
              viral_load, adherence_score
       FROM pmtct_visits
       WHERE anc_registration_id = $1
       ORDER BY visit_date DESC`,
      [anc.id],
    );

    return { registered: true, anc, visits };
  }

  @Get('anc/eid-schedule')
  async getEidSchedule(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const schedules = await db.query(
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

    return schedules.map((s: any) => ({
      ...s,
      timepoints: [
        { label: '6 Weeks',   due: s.test_6w_due,  result: s.test_6w_result,  doneAt: s.test_6w_done_at,  status: timepointStatus(s.test_6w_due,  s.test_6w_result)  },
        { label: '4 Months',  due: s.test_4m_due,  result: s.test_4m_result,  doneAt: s.test_4m_done_at,  status: timepointStatus(s.test_4m_due,  s.test_4m_result)  },
        { label: '12 Months', due: s.test_12m_due, result: s.test_12m_result, doneAt: s.test_12m_done_at, status: timepointStatus(s.test_12m_due, s.test_12m_result) },
        { label: '18 Months', due: s.test_18m_due, result: s.test_18m_result, doneAt: s.test_18m_done_at, status: timepointStatus(s.test_18m_due, s.test_18m_result) },
      ],
    }));
  }

  // ── E: Growth Chart History ───────────────────────────────────────

  @Get('growth/history')
  async getGrowthHistory(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const measurements = await db.query(
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
  async getDentalTreatmentPlan(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const plans = await db.query(
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

  // ── G: Patient flags (for conditional nav) ────────────────────────

  @Get('my-flags')
  async getMyFlags(@Req() req: any) {
    const { patientId, tenantDb: db } = req;

    const [ancRows, growthRows, dentalRows] = await Promise.all([
      db.query(`SELECT id FROM anc_registrations WHERE patient_id = $1 LIMIT 1`, [patientId]),
      db.query(`SELECT id FROM growth_measurements WHERE patient_id = $1 LIMIT 1`, [patientId]),
      db.query(`SELECT id FROM dental_treatment_plans WHERE patient_id = $1 LIMIT 1`, [patientId]),
    ]);

    return {
      hasAncRecord: ancRows.length > 0,
      hasGrowthRecord: growthRows.length > 0,
      hasDentalRecord: dentalRows.length > 0,
    };
  }
}
