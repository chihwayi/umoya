import { Injectable } from '@nestjs/common';

@Injectable()
export class CounsellorSessionsService {
  async createSession(params: {
    patientId: string;
    counsellorId: string;
    sessionType: string;
    sessionNumber?: number;
    durationMinutes?: number;
    attendance: string;
    presentingIssues?: string;
    sessionNotes?: string;
    goalsSet?: string;
    progressNoted?: string;
    nextSessionDate?: string;
    referralMade?: boolean;
    referralDetails?: string;
    db: any;
  }): Promise<any> {
    const [row] = await params.db.query(
      `INSERT INTO counsellor_sessions
         (patient_id, session_date, counsellor_id, session_type, session_number, duration_minutes,
          attendance, presenting_issues, session_notes, goals_set, progress_noted,
          next_session_date, referral_made, referral_details)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, session_date, session_type, attendance, next_session_date`,
      [
        params.patientId, params.counsellorId, params.sessionType,
        params.sessionNumber ?? null, params.durationMinutes ?? null,
        params.attendance, params.presentingIssues ?? null,
        params.sessionNotes ?? null, params.goalsSet ?? null,
        params.progressNoted ?? null, params.nextSessionDate ?? null,
        params.referralMade ?? false, params.referralDetails ?? null,
      ],
    );
    return row;
  }

  async getPatientSessions(patientId: string, counsellorId: string | null, db: any): Promise<any[]> {
    if (counsellorId) {
      return db.query(
        `SELECT * FROM counsellor_sessions WHERE patient_id = $1 AND counsellor_id = $2 ORDER BY session_date DESC`,
        [patientId, counsellorId],
      );
    }
    // Senior staff see session metadata but not sensitive notes
    return db.query(
      `SELECT id, session_date, counsellor_id, session_type, attendance, next_session_date, referral_made
       FROM counsellor_sessions WHERE patient_id = $1 ORDER BY session_date DESC`,
      [patientId],
    );
  }
}
