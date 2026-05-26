import { Injectable } from '@nestjs/common';

@Injectable()
export class HivDisclosureService {
  async createDisclosureRecord(params: {
    patientId: string;
    assessedBy: string;
    patientAge: number;
    disclosureStatus: 'not_disclosed' | 'partially_disclosed' | 'fully_disclosed' | 'disclosure_not_applicable';
    disclosedTo: string[];
    readinessScore: number;
    barriers?: string;
    supportNeeded?: string;
    counsellingProvided: boolean;
    counsellingNotes?: string;
    nextReviewDate?: string;
    db: any;
  }): Promise<any> {
    const [row] = await params.db.query(
      `INSERT INTO hiv_disclosure_records
         (patient_id, assessment_date, assessed_by, patient_age, disclosure_status,
          disclosed_to, readiness_score, barriers, support_needed, counselling_provided,
          counselling_notes, next_review_date)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        params.patientId, params.assessedBy, params.patientAge, params.disclosureStatus,
        JSON.stringify(params.disclosedTo), params.readinessScore,
        params.barriers ?? null, params.supportNeeded ?? null,
        params.counsellingProvided, params.counsellingNotes ?? null,
        params.nextReviewDate ?? null,
      ],
    );
    return row;
  }

  async getDisclosureHistory(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM hiv_disclosure_records WHERE patient_id = $1 ORDER BY assessment_date DESC`,
      [patientId],
    );
  }

  async getLatestDisclosureStatus(patientId: string, db: any): Promise<string | null> {
    const [row] = await db.query(
      `SELECT disclosure_status FROM hiv_disclosure_records
       WHERE patient_id = $1 ORDER BY assessment_date DESC LIMIT 1`,
      [patientId],
    );
    return row?.disclosure_status ?? null;
  }
}
