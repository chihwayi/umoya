import { Injectable } from '@nestjs/common';

@Injectable()
export class EmpowermentService {
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
         (programme_type, programme_name, cohort_number, start_date, end_date,
          facilitator_name, venue, max_participants)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        dto.programmeType, dto.programmeName, dto.cohortNumber ?? null,
        dto.startDate, dto.endDate ?? null, dto.facilitatorName ?? null,
        dto.venue ?? null, dto.maxParticipants ?? null,
      ],
    );
    return row;
  }

  async listProgrammes(type: 'WEEP' | 'MEEP' | null, db: any): Promise<any[]> {
    if (type) {
      return db.query(
        `SELECT * FROM empowerment_programmes WHERE programme_type = $1 ORDER BY start_date DESC`,
        [type],
      );
    }
    return db.query(`SELECT * FROM empowerment_programmes ORDER BY programme_type, start_date DESC`);
  }

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
         (patient_id, programme_id, enrolment_date, referred_by, referral_reason,
          baseline_income, baseline_employment)
       VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6) RETURNING *`,
      [
        dto.patientId, dto.programmeId, dto.referredBy ?? null,
        dto.referralReason ?? null, dto.baselineIncome ?? null, dto.baselineEmployment ?? null,
      ],
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
      [
        dto.status, dto.outcomeIncome, dto.outcomeEmployment, dto.hasBusiness,
        dto.businessType, dto.loanReceived, dto.loanAmountUsd, dto.loanStatus,
        dto.graduationDate, dto.dropoutReason, enrolmentId,
      ],
    );
    return row;
  }

  async addMilestone(enrolmentId: string, dto: {
    milestoneType: string;
    milestoneNotes?: string;
    recordedBy: string;
  }, db: any): Promise<any> {
    const [row] = await db.query(
      `INSERT INTO empowerment_milestones
         (enrolment_id, milestone_date, milestone_type, milestone_notes, recorded_by)
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
         COUNT(*)                                               AS total_enrolled,
         COUNT(*) FILTER (WHERE status = 'graduated')          AS graduated,
         COUNT(*) FILTER (WHERE status = 'dropped_out')        AS dropped_out,
         COUNT(*) FILTER (WHERE has_business = true)           AS businesses_started,
         COUNT(*) FILTER (WHERE loan_received = true)          AS loans_received,
         AVG(loan_amount_usd) FILTER (WHERE loan_received = true) AS avg_loan_usd
       FROM empowerment_enrolments WHERE programme_id = $1`,
      [programmeId],
    );
    return stats;
  }
}
