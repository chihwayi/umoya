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
      `INSERT INTO support_groups
         (group_name, group_type, facilitator_name, meeting_day, meeting_time,
          meeting_frequency, venue, max_members)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        dto.groupName, dto.groupType, dto.facilitatorName ?? null,
        dto.meetingDay ?? null, dto.meetingTime ?? null,
        dto.meetingFrequency ?? null, dto.venue ?? null, dto.maxMembers ?? null,
      ],
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
      `UPDATE support_group_members
       SET status = 'left', left_date = CURRENT_DATE, left_reason = $1
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
      `INSERT INTO support_group_sessions
         (group_id, session_date, topic, facilitator_id, venue, planned_count, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        dto.groupId, dto.sessionDate, dto.topic ?? null, dto.facilitatorId ?? null,
        dto.venue ?? null, dto.plannedCount ?? null, dto.notes ?? null,
      ],
    );
    return row;
  }

  async recordAttendance(
    sessionId: string,
    attendees: Array<{ patientId: string; attended: boolean; absenceReason?: string }>,
    db: any,
  ): Promise<void> {
    for (const a of attendees) {
      await db.query(
        `INSERT INTO support_group_attendance (session_id, patient_id, attended, absence_reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, patient_id) DO UPDATE SET attended = $3, absence_reason = $4`,
        [sessionId, a.patientId, a.attended, a.absenceReason ?? null],
      );
    }
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
