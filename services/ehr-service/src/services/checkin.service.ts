import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);
  private readonly TOKEN_TTL_MINUTES = 10;

  async generateCheckinToken(
    tenantDb: DataSource,
    patientId: string,
    appointmentId?: string,
  ): Promise<{ token: string; expiresAt: string }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_TTL_MINUTES * 60 * 1000);

    await tenantDb.query(
      `INSERT INTO patient_checkin_tokens (patient_id, appointment_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [patientId, appointmentId ?? null, tokenHash, expiresAt],
    );

    return { token: rawToken, expiresAt: expiresAt.toISOString() };
  }

  async redeemCheckinToken(
    tenantDb: DataSource,
    rawToken: string,
    scannedByUserId: string,
  ): Promise<{
    patientId: string;
    appointmentId: string | null;
    patient: any;
    appointment: any | null;
  }> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const [tokenRow] = await tenantDb.query(
      `SELECT * FROM patient_checkin_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );

    if (!tokenRow) {
      throw new BadRequestException('Invalid or expired check-in token');
    }

    await tenantDb.query(
      `UPDATE patient_checkin_tokens SET used_at = now(), used_by = $1 WHERE id = $2`,
      [scannedByUserId, tokenRow.id],
    );

    if (tokenRow.appointment_id) {
      await tenantDb.query(
        `UPDATE appointments
         SET actual_checkin_at = now(), checkin_method = 'qr_scan', status = 'checked_in', updated_at = now()
         WHERE id = $1`,
        [tokenRow.appointment_id],
      );
    }

    const [patient] = await tenantDb.query(
      `SELECT id, first_name, last_name, mrn, date_of_birth, gender FROM patients WHERE id = $1`,
      [tokenRow.patient_id],
    );

    const appointment = tokenRow.appointment_id
      ? (
          await tenantDb.query(
            `SELECT id, appointment_date, appointment_time, provider_id, visit_type
             FROM appointments WHERE id = $1`,
            [tokenRow.appointment_id],
          )
        )[0]
      : null;

    this.logger.log(
      `QR check-in: patient=${tokenRow.patient_id} appointment=${tokenRow.appointment_id} by user=${scannedByUserId}`,
    );

    return {
      patientId: tokenRow.patient_id,
      appointmentId: tokenRow.appointment_id,
      patient,
      appointment,
    };
  }

  async getTodaysQueue(tenantDb: DataSource, providerId?: string): Promise<any[]> {
    return tenantDb.query(
      `SELECT
         a.id, a.appointment_time, a.visit_type, a.actual_checkin_at, a.status,
         p.first_name, p.last_name, p.mrn,
         EXTRACT(EPOCH FROM (now() - a.actual_checkin_at)) / 60 AS wait_minutes
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE DATE(a.appointment_date) = CURRENT_DATE
         AND a.status IN ('checked_in', 'scheduled')
         AND ($1::uuid IS NULL OR a.provider_id = $1)
       ORDER BY
         CASE a.status WHEN 'checked_in' THEN 0 ELSE 1 END,
         a.actual_checkin_at ASC NULLS LAST,
         a.appointment_time ASC`,
      [providerId ?? null],
    );
  }
}
