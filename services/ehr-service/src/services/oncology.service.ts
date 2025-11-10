import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface CaseFilter {
  status?: string;
  patientId?: string;
  oncologistId?: string;
}

@Injectable()
export class OncologyService {
  private readonly logger = new Logger(OncologyService.name);

  async listCases(tenantDb: DataSource, filters: CaseFilter = {}) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      conditions.push(`oc.status = $${params.length + 1}`);
      params.push(filters.status);
    }

    if (filters.patientId) {
      conditions.push(`oc.patient_id = $${params.length + 1}`);
      params.push(filters.patientId);
    }

    if (filters.oncologistId) {
      conditions.push(`oc.oncologist_id = $${params.length + 1}`);
      params.push(filters.oncologistId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        oc.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        p.phone,
        u.first_name || ' ' || u.last_name AS oncologist_name,
        COALESCE(r.active_regimens, 0) AS active_regimens,
        COALESCE(a.active_adverse_events, 0) AS active_adverse_events
      FROM oncology_cases oc
      INNER JOIN patients p ON p.id = oc.patient_id
      LEFT JOIN users u ON u.id = oc.oncologist_id
      LEFT JOIN (
        SELECT oncology_case_id, COUNT(*) AS active_regimens
        FROM oncology_regimens
        WHERE status IN ('planned', 'active')
        GROUP BY oncology_case_id
      ) r ON r.oncology_case_id = oc.id
      LEFT JOIN (
        SELECT oncology_case_id, COUNT(*) AS active_adverse_events
        FROM oncology_adverse_events
        WHERE resolved_date IS NULL
        GROUP BY oncology_case_id
      ) a ON a.oncology_case_id = oc.id
      ${whereClause}
      ORDER BY oc.updated_at DESC, oc.created_at DESC
    `;

    const cases = await tenantDb.query(query, params);
    return { cases, total: cases.length };
  }

  async getCaseDetail(tenantDb: DataSource, caseId: string) {
    const [caseRow] = await tenantDb.query(
      `
      SELECT
        oc.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        p.phone,
        u.first_name || ' ' || u.last_name AS oncologist_name
      FROM oncology_cases oc
      INNER JOIN patients p ON p.id = oc.patient_id
      LEFT JOIN users u ON u.id = oc.oncologist_id
      WHERE oc.id = $1
      `,
      [caseId],
    );

    if (!caseRow) {
      throw new NotFoundException(`Oncology case ${caseId} not found`);
    }

    const stagingEntries = await tenantDb.query(
      `
      SELECT ose.*, rec.first_name || ' ' || rec.last_name AS recorded_by_name
      FROM oncology_staging_entries ose
      LEFT JOIN users rec ON rec.id = ose.recorded_by
      WHERE ose.oncology_case_id = $1
      ORDER BY ose.stage_date DESC, ose.created_at DESC
      `,
      [caseId],
    );

    const regimens = await tenantDb.query(
      `
      SELECT
        orr.*,
        COUNT(DISTINCT ois.id) FILTER (WHERE ois.status IN ('scheduled','in_progress')) AS upcoming_sessions,
        COUNT(DISTINCT ois.id) FILTER (WHERE ois.status = 'completed') AS completed_sessions
      FROM oncology_regimens orr
      LEFT JOIN oncology_infusion_sessions ois ON ois.regimen_id = orr.id
      WHERE orr.oncology_case_id = $1
      GROUP BY orr.id
      ORDER BY orr.start_date DESC NULLS LAST, orr.created_at DESC
      `,
      [caseId],
    );

    const infusionSessions = await tenantDb.query(
      `
      SELECT
        ois.*,
        admin.first_name || ' ' || admin.last_name AS administered_by_name,
        orr.regimen_name
      FROM oncology_infusion_sessions ois
      LEFT JOIN oncology_regimens orr ON orr.id = ois.regimen_id
      LEFT JOIN users admin ON admin.id = ois.administered_by
      WHERE orr.oncology_case_id = $1
      ORDER BY ois.session_date DESC
      `,
      [caseId],
    );

    const adverseEvents = await tenantDb.query(
      `
      SELECT
        oae.*,
        rep.first_name || ' ' || rep.last_name AS reported_by_name,
        orr.regimen_name
      FROM oncology_adverse_events oae
      LEFT JOIN oncology_regimens orr ON orr.id = oae.regimen_id
      LEFT JOIN users rep ON rep.id = oae.reported_by
      WHERE oae.oncology_case_id = $1
      ORDER BY oae.event_date DESC
      `,
      [caseId],
    );

    const tumorBoardRecommendations = await tenantDb.query(
      `
      SELECT
        tbr.*,
        tbm.meeting_date,
        tbm.location,
        fac.first_name || ' ' || fac.last_name AS facilitator_name
      FROM tumor_board_recommendations tbr
      INNER JOIN tumor_board_meetings tbm ON tbm.id = tbr.meeting_id
      LEFT JOIN users fac ON fac.id = tbm.facilitator
      WHERE tbr.oncology_case_id = $1
      ORDER BY tbm.meeting_date DESC
      `,
      [caseId],
    );

    return {
      case: caseRow,
      stagingEntries,
      regimens,
      infusionSessions,
      adverseEvents,
      tumorBoardRecommendations,
    };
  }

  async createCase(tenantDb: DataSource, payload: any, userId?: string) {
    const {
      patient_id,
      primary_diagnosis,
      staging_system,
      overall_stage,
      stage_at_diagnosis,
      diagnosis_date,
      primary_site,
      histology,
      oncologist_id,
      status,
      care_plan,
    } = payload;

    if (!patient_id || !primary_diagnosis) {
      throw new BadRequestException('patient_id and primary_diagnosis are required');
    }

    const [createdCase] = await tenantDb.query(
      `
      INSERT INTO oncology_cases (
        patient_id,
        primary_diagnosis,
        staging_system,
        overall_stage,
        stage_at_diagnosis,
        diagnosis_date,
        primary_site,
        histology,
        oncologist_id,
        status,
        care_plan,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'active'),$11,NOW(),NOW())
      RETURNING *
      `,
      [
        patient_id,
        primary_diagnosis,
        staging_system,
        overall_stage,
        stage_at_diagnosis,
        diagnosis_date,
        primary_site,
        histology,
        oncologist_id,
        status,
        care_plan,
      ],
    );

    this.logger.log(`Created oncology case ${createdCase.id} for patient ${patient_id} by ${userId}`);
    return createdCase;
  }

  async updateCase(tenantDb: DataSource, caseId: string, payload: any) {
    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    if (!fields.length) {
      throw new BadRequestException('No fields provided for update');
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ') + ', updated_at = NOW()';
    const values = fields.map((field) => payload[field]);
    values.push(caseId);

    const result = await tenantDb.query(
      `UPDATE oncology_cases SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.length) {
      throw new NotFoundException(`Oncology case ${caseId} not found`);
    }

    this.logger.log(`Updated oncology case ${caseId}`);
    return result[0];
  }

  async addStagingEntry(tenantDb: DataSource, caseId: string, payload: any, userId?: string) {
    const { staging_system, t_stage, n_stage, m_stage, overall_stage, stage_date, performance_status, notes } = payload;

    if (!staging_system || !stage_date) {
      throw new BadRequestException('staging_system and stage_date are required');
    }

    const [entry] = await tenantDb.query(
      `
      INSERT INTO oncology_staging_entries (
        oncology_case_id,
        staging_system,
        t_stage,
        n_stage,
        m_stage,
        overall_stage,
        stage_date,
        performance_status,
        notes,
        recorded_by,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING *
      `,
      [caseId, staging_system, t_stage, n_stage, m_stage, overall_stage, stage_date, performance_status, notes, userId],
    );

    this.logger.log(`Recorded staging entry ${entry.id} for case ${caseId}`);
    return entry;
  }

  async listStagingEntries(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
      SELECT ose.*, u.first_name || ' ' || u.last_name AS recorded_by_name
      FROM oncology_staging_entries ose
      LEFT JOIN users u ON u.id = ose.recorded_by
      WHERE oncology_case_id = $1
      ORDER BY stage_date DESC, created_at DESC
      `,
      [caseId],
    );

    return { entries: rows, total: rows.length };
  }

  async createRegimen(tenantDb: DataSource, caseId: string, payload: any) {
    const { regimen_name, line_of_therapy, intent, cycles_planned, start_date, end_date, status, regimen_details } = payload;

    if (!regimen_name) {
      throw new BadRequestException('regimen_name is required');
    }

    const [regimen] = await tenantDb.query(
      `
      INSERT INTO oncology_regimens (
        oncology_case_id,
        regimen_name,
        line_of_therapy,
        intent,
        cycles_planned,
        start_date,
        end_date,
        status,
        regimen_details,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'planned'),COALESCE($9,'{}'::jsonb),NOW(),NOW())
      RETURNING *
      `,
      [caseId, regimen_name, line_of_therapy, intent, cycles_planned, start_date, end_date, status, regimen_details],
    );

    this.logger.log(`Created regimen ${regimen.id} for oncology case ${caseId}`);
    return regimen;
  }

  async updateRegimen(tenantDb: DataSource, regimenId: string, payload: any) {
    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    if (!fields.length) {
      throw new BadRequestException('No fields provided for update');
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ') + ', updated_at = NOW()';
    const values = fields.map((field) => payload[field]);
    values.push(regimenId);

    const result = await tenantDb.query(
      `UPDATE oncology_regimens SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.length) {
      throw new NotFoundException(`Oncology regimen ${regimenId} not found`);
    }

    this.logger.log(`Updated oncology regimen ${regimenId}`);
    return result[0];
  }

  async listRegimens(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        orr.*,
        COUNT(DISTINCT ois.id) FILTER (WHERE ois.status IN ('scheduled','in_progress')) AS upcoming_sessions,
        COUNT(DISTINCT ois.id) FILTER (WHERE ois.status = 'completed') AS completed_sessions
      FROM oncology_regimens orr
      LEFT JOIN oncology_infusion_sessions ois ON ois.regimen_id = orr.id
      WHERE orr.oncology_case_id = $1
      GROUP BY orr.id
      ORDER BY orr.start_date DESC NULLS LAST, orr.created_at DESC
      `,
      [caseId],
    );

    return { regimens: rows, total: rows.length };
  }

  async createInfusionSession(tenantDb: DataSource, regimenId: string, payload: any, userId?: string) {
    const { cycle_number, session_date, location, vitals, drugs_administered, premedications, toxicities, status, notes } = payload;

    if (!session_date) {
      throw new BadRequestException('session_date is required');
    }

    const [session] = await tenantDb.query(
      `
      INSERT INTO oncology_infusion_sessions (
        regimen_id,
        cycle_number,
        session_date,
        location,
        administered_by,
        vitals,
        drugs_administered,
        premedications,
        toxicities,
        status,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,COALESCE($6,'{}'::jsonb),COALESCE($7,'[]'::jsonb),COALESCE($8,'[]'::jsonb),COALESCE($9,'[]'::jsonb),COALESCE($10,'scheduled'),$11,NOW(),NOW())
      RETURNING *
      `,
      [
        regimenId,
        cycle_number,
        session_date,
        location,
        userId,
        vitals,
        drugs_administered,
        premedications,
        toxicities,
        status,
        notes,
      ],
    );

    this.logger.log(`Created infusion session ${session.id} for regimen ${regimenId}`);
    return session;
  }

  async updateInfusionSession(tenantDb: DataSource, sessionId: string, payload: any) {
    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    if (!fields.length) {
      throw new BadRequestException('No fields provided for update');
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ') + ', updated_at = NOW()';
    const values = fields.map((field) => payload[field]);
    values.push(sessionId);

    const result = await tenantDb.query(
      `UPDATE oncology_infusion_sessions SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.length) {
      throw new NotFoundException(`Infusion session ${sessionId} not found`);
    }

    this.logger.log(`Updated infusion session ${sessionId}`);
    return result[0];
  }

  async listInfusionSessions(tenantDb: DataSource, regimenId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        ois.*,
        admin.first_name || ' ' || admin.last_name AS administered_by_name
      FROM oncology_infusion_sessions ois
      LEFT JOIN users admin ON admin.id = ois.administered_by
      WHERE regimen_id = $1
      ORDER BY session_date DESC
      `,
      [regimenId],
    );

    return { sessions: rows, total: rows.length };
  }

  async recordAdverseEvent(tenantDb: DataSource, caseId: string, payload: any, userId?: string) {
    const { regimen_id, event_date, event_type, grade, related_to, action_taken, outcome, resolved_date, notes } = payload;

    if (!event_date || !event_type) {
      throw new BadRequestException('event_date and event_type are required');
    }

    const [event] = await tenantDb.query(
      `
      INSERT INTO oncology_adverse_events (
        oncology_case_id,
        regimen_id,
        event_date,
        event_type,
        grade,
        related_to,
        action_taken,
        outcome,
        resolved_date,
        notes,
        reported_by,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *
      `,
      [caseId, regimen_id, event_date, event_type, grade, related_to, action_taken, outcome, resolved_date, notes, userId],
    );

    this.logger.log(`Recorded adverse event ${event.id} for oncology case ${caseId}`);
    return event;
  }

  async listAdverseEvents(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        oae.*,
        orr.regimen_name,
        rep.first_name || ' ' || rep.last_name AS reported_by_name
      FROM oncology_adverse_events oae
      LEFT JOIN oncology_regimens orr ON orr.id = oae.regimen_id
      LEFT JOIN users rep ON rep.id = oae.reported_by
      WHERE oae.oncology_case_id = $1
      ORDER BY oae.event_date DESC
      `,
      [caseId],
    );

    return { adverseEvents: rows, total: rows.length };
  }

  async createTumorBoardMeeting(tenantDb: DataSource, payload: any) {
    const { meeting_date, facilitator, location, agenda } = payload;

    if (!meeting_date) {
      throw new BadRequestException('meeting_date is required');
    }

    const [meeting] = await tenantDb.query(
      `
      INSERT INTO tumor_board_meetings (
        meeting_date,
        facilitator,
        location,
        agenda,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,NOW(),NOW())
      RETURNING *
      `,
      [meeting_date, facilitator, location, agenda],
    );

    this.logger.log(`Created tumor board meeting ${meeting.id}`);
    return meeting;
  }

  async listTumorBoardMeetings(tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `
      SELECT
        tbm.*,
        fac.first_name || ' ' || fac.last_name AS facilitator_name,
        COUNT(DISTINCT tbr.id) AS recommendation_count
      FROM tumor_board_meetings tbm
      LEFT JOIN users fac ON fac.id = tbm.facilitator
      LEFT JOIN tumor_board_recommendations tbr ON tbr.meeting_id = tbm.id
      GROUP BY tbm.id, fac.first_name, fac.last_name
      ORDER BY tbm.meeting_date DESC
      `,
    );

    return { meetings: rows, total: rows.length };
  }

  async addTumorBoardRecommendation(tenantDb: DataSource, meetingId: string, payload: any) {
    const { oncology_case_id, recommendation, follow_up_actions, responsible_team, due_date, status } = payload;

    if (!oncology_case_id || !recommendation) {
      throw new BadRequestException('oncology_case_id and recommendation are required');
    }

    const [rec] = await tenantDb.query(
      `
      INSERT INTO tumor_board_recommendations (
        meeting_id,
        oncology_case_id,
        recommendation,
        follow_up_actions,
        responsible_team,
        due_date,
        status,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'pending'),NOW(),NOW())
      RETURNING *
      `,
      [meetingId, oncology_case_id, recommendation, follow_up_actions, responsible_team, due_date, status],
    );

    this.logger.log(`Added tumor board recommendation ${rec.id} for case ${oncology_case_id}`);
    return rec;
  }

  async updateTumorBoardRecommendation(tenantDb: DataSource, recommendationId: string, payload: any) {
    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    if (!fields.length) {
      throw new BadRequestException('No fields provided for update');
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ') + ', updated_at = NOW()';
    const values = fields.map((field) => payload[field]);
    values.push(recommendationId);

    const result = await tenantDb.query(
      `UPDATE tumor_board_recommendations SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.length) {
      throw new NotFoundException(`Tumor board recommendation ${recommendationId} not found`);
    }

    this.logger.log(`Updated tumor board recommendation ${recommendationId}`);
    return result[0];
  }

  async getDashboardSummary(tenantDb: DataSource) {
    const [caseTotals] = await tenantDb.query(
      `
      SELECT
        COUNT(*) AS total_cases,
        COUNT(*) FILTER (WHERE status = 'active') AS active_cases,
        COUNT(*) FILTER (WHERE status = 'in_remission') AS in_remission,
        COUNT(*) FILTER (WHERE status = 'follow_up') AS follow_up_cases,
        COUNT(*) FILTER (WHERE status = 'deceased') AS deceased_cases
      FROM oncology_cases
      `,
    );

    const statusBreakdown = await tenantDb.query(
      `
      SELECT status, COUNT(*) AS count
      FROM oncology_cases
      GROUP BY status
      `,
    );

    const upcomingInfusions = await tenantDb.query(
      `
      SELECT
        ois.id,
        ois.session_date,
        ois.cycle_number,
        ois.status,
        orr.regimen_name,
        oc.primary_diagnosis,
        p.first_name || ' ' || p.last_name AS patient_name
      FROM oncology_infusion_sessions ois
      INNER JOIN oncology_regimens orr ON orr.id = ois.regimen_id
      INNER JOIN oncology_cases oc ON oc.id = orr.oncology_case_id
      INNER JOIN patients p ON p.id = oc.patient_id
      WHERE ois.session_date >= NOW() AND ois.session_date <= NOW() + INTERVAL '14 days'
      ORDER BY ois.session_date ASC
      LIMIT 20
      `,
    );

    const adverseEventSummary = await tenantDb.query(
      `
      SELECT
        event_type,
        grade,
        COUNT(*) AS count
      FROM oncology_adverse_events
      WHERE event_date >= NOW() - INTERVAL '90 days'
      GROUP BY event_type, grade
      ORDER BY count DESC
      LIMIT 20
      `,
    );

    return {
      caseTotals,
      statusBreakdown,
      upcomingInfusions,
      adverseEventSummary,
    };
  }
}

