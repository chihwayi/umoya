import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { SmsService } from './sms.service';

export interface CsatSubmissionDto {
  overallCsat: number;
  npsScore: number;
  ratingWait?: number;
  ratingClinician?: number;
  ratingFacility?: number;
  ratingAdmin?: number;
  freeText?: string;
}

@Injectable()
export class CsatService {
  private readonly logger = new Logger(CsatService.name);

  constructor(private readonly sms: SmsService) {}

  async createAndSendSurvey(
    db: DataSource,
    encounterId: string,
    patientId: string,
    clinicianId?: string,
    subdomain?: string,
  ): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await db.query(
      `INSERT INTO csat_surveys (encounter_id, patient_id, token_hash, expires_at, clinician_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT DO NOTHING`,
      [encounterId, patientId, tokenHash, expiresAt, clinicianId ?? null],
    );

    const [patient] = await db.query(
      `SELECT first_name, phone FROM patients WHERE id = $1`,
      [patientId],
    );
    if (patient?.phone && subdomain) {
      const link = `https://${subdomain}.umoya.app/survey/${rawToken}`;
      await this.sms.send(
        patient.phone,
        `Hi ${patient.first_name}, how was your visit today? Share your feedback (takes 1 min): ${link}`,
      );
    }
    this.logger.log(`CSAT survey sent: encounter=${encounterId} patient=${patientId}`);
  }

  async getSurveyByToken(db: DataSource, rawToken: string): Promise<any> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const [row] = await db.query(
      `SELECT cs.*, e.encounter_date, p.first_name
       FROM csat_surveys cs
       JOIN encounters e ON e.id = cs.encounter_id
       JOIN patients p ON p.id = cs.patient_id
       WHERE cs.token_hash = $1`,
      [hash],
    );
    if (!row) throw new NotFoundException('Survey not found');
    if (row.submitted_at) throw new BadRequestException('Survey already submitted');
    if (new Date(row.expires_at) < new Date()) throw new BadRequestException('Survey has expired');
    return row;
  }

  async submitSurvey(
    db: DataSource,
    rawToken: string,
    payload: CsatSubmissionDto,
  ): Promise<void> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const [row] = await db.query(
      `SELECT id, submitted_at, expires_at FROM csat_surveys WHERE token_hash = $1`,
      [hash],
    );
    if (!row) throw new NotFoundException('Survey not found');
    if (row.submitted_at) throw new BadRequestException('Already submitted');
    if (new Date(row.expires_at) < new Date()) throw new BadRequestException('Expired');

    await db.query(
      `UPDATE csat_surveys
       SET submitted_at = now(),
           overall_csat = $1, nps_score = $2,
           rating_wait = $3, rating_clinician = $4,
           rating_facility = $5, rating_admin = $6,
           free_text = $7
       WHERE token_hash = $8`,
      [
        payload.overallCsat, payload.npsScore,
        payload.ratingWait ?? null, payload.ratingClinician ?? null,
        payload.ratingFacility ?? null, payload.ratingAdmin ?? null,
        payload.freeText ?? null, hash,
      ],
    );
  }

  async getAggregateStats(db: DataSource, days = 30): Promise<any> {
    const [stats] = await db.query(
      `SELECT
         COUNT(*) AS total_surveys,
         AVG(overall_csat) AS avg_csat,
         AVG(nps_score) AS avg_nps,
         AVG(rating_wait) AS avg_wait,
         AVG(rating_clinician) AS avg_clinician,
         AVG(rating_facility) AS avg_facility,
         AVG(rating_admin) AS avg_admin,
         COUNT(*) FILTER (WHERE nps_score >= 9) AS promoters,
         COUNT(*) FILTER (WHERE nps_score <= 6) AS detractors
       FROM csat_surveys
       WHERE submitted_at IS NOT NULL
         AND submitted_at > now() - ($1 || ' days')::interval`,
      [days],
    );
    const total = Number(stats.total_surveys);
    const npsScore = total > 0
      ? Math.round(((Number(stats.promoters) - Number(stats.detractors)) / total) * 100)
      : 0;
    return { ...stats, nps_score: npsScore };
  }

  async getClinicianStats(db: DataSource, clinicianId: string, days = 30): Promise<any> {
    const [stats] = await db.query(
      `SELECT AVG(overall_csat) AS avg_csat, AVG(rating_clinician) AS avg_clinician, COUNT(*) AS total
       FROM csat_surveys
       WHERE clinician_id = $1 AND submitted_at IS NOT NULL
         AND submitted_at > now() - ($2 || ' days')::interval`,
      [clinicianId, days],
    );
    return stats;
  }
}
