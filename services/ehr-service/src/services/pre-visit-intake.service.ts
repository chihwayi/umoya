import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { SmsService } from './sms.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class PreVisitIntakeService {
  private readonly logger = new Logger(PreVisitIntakeService.name);
  private readonly TOKEN_TTL_HOURS = 48;

  constructor(
    private readonly sms: SmsService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendPendingForms(tenantDb: DataSource, subdomain: string): Promise<void> {
    const appointments = await tenantDb.query(
      `SELECT a.id, a.patient_id, a.appointment_date, a.appointment_time,
              p.first_name, p.phone, p.preferred_language
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN pre_visit_intake_forms pv ON pv.appointment_id = a.id
       WHERE a.appointment_date BETWEEN CURRENT_DATE + interval '1 day'
                                    AND CURRENT_DATE + interval '2 days'
         AND a.status = 'scheduled'
         AND pv.id IS NULL`,
    );

    for (const apt of appointments) {
      await this.createAndSendForm(tenantDb, apt, subdomain);
    }
    this.logger.log(`Pre-visit forms sent: ${appointments.length} for tenant ${subdomain}`);
  }

  private async createAndSendForm(tenantDb: DataSource, apt: any, subdomain: string): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_TTL_HOURS * 3600 * 1000);

    await tenantDb.query(
      `INSERT INTO pre_visit_intake_forms
         (appointment_id, patient_id, form_token_hash, form_token_expires, sent_at)
       VALUES ($1, $2, $3, $4, now())`,
      [apt.id, apt.patient_id, tokenHash, expiresAt],
    );

    const link = `https://${subdomain}.umoya.app/intake/${rawToken}`;
    const msg = `Hello ${apt.first_name}, please complete your pre-visit form before your appointment: ${link}`;

    if (apt.phone) {
      await this.sms.send(apt.phone, msg);
    }
    await this.notifications.sendAppointmentReminder(apt.id, tenantDb);
  }

  async getFormByToken(tenantDb: DataSource, rawToken: string): Promise<any> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const [form] = await tenantDb.query(
      `SELECT pvif.*, a.appointment_date, a.appointment_time,
              p.first_name, p.last_name, p.date_of_birth, p.address as current_address,
              p.phone, p.email
       FROM pre_visit_intake_forms pvif
       JOIN appointments a ON a.id = pvif.appointment_id
       JOIN patients p ON p.id = pvif.patient_id
       WHERE pvif.form_token_hash = $1 AND pvif.form_token_expires > now()`,
      [hash],
    );
    return form ?? null;
  }

  async submitForm(
    tenantDb: DataSource,
    rawToken: string,
    payload: {
      address?: string;
      emergencyContact?: object;
      chiefComplaint: string;
      currentSymptoms: object[];
      currentMedications: object[];
      knownAllergies: object[];
      insuranceProvider?: string;
      insuranceNumber?: string;
      insuranceCardUrl?: string;
      treatmentConsent: boolean;
      dataSharingConsent: boolean;
      smsConsent: boolean;
    },
  ): Promise<{ ok: boolean }> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await tenantDb.query(
      `UPDATE pre_visit_intake_forms SET
         address = $1, emergency_contact = $2,
         chief_complaint = $3, current_symptoms = $4,
         current_medications = $5, known_allergies = $6,
         insurance_provider = $7, insurance_number = $8, insurance_card_url = $9,
         treatment_consent = $10, data_sharing_consent = $11, sms_consent = $12,
         consent_signed_at = now(), completed_at = now(), updated_at = now()
       WHERE form_token_hash = $13 AND form_token_expires > now()`,
      [
        payload.address ?? null, JSON.stringify(payload.emergencyContact ?? {}),
        payload.chiefComplaint, JSON.stringify(payload.currentSymptoms),
        JSON.stringify(payload.currentMedications), JSON.stringify(payload.knownAllergies),
        payload.insuranceProvider ?? null, payload.insuranceNumber ?? null, payload.insuranceCardUrl ?? null,
        payload.treatmentConsent, payload.dataSharingConsent, payload.smsConsent,
        hash,
      ],
    );
    return { ok: true };
  }

  async getIntakeStatus(
    tenantDb: DataSource,
    appointmentId: string,
  ): Promise<{ status: 'complete' | 'pending' | 'not_sent' }> {
    const [row] = await tenantDb.query(
      `SELECT completed_at, sent_at FROM pre_visit_intake_forms WHERE appointment_id = $1`,
      [appointmentId],
    );
    if (!row) return { status: 'not_sent' };
    return { status: row.completed_at ? 'complete' : 'pending' };
  }

  async syncToEncounter(
    tenantDb: DataSource,
    appointmentId: string,
    encounterId: string,
  ): Promise<void> {
    const [form] = await tenantDb.query(
      `SELECT * FROM pre_visit_intake_forms WHERE appointment_id = $1 AND completed_at IS NOT NULL`,
      [appointmentId],
    );
    if (!form) return;

    await tenantDb.query(
      `UPDATE encounters SET chief_complaint = $1, updated_at = now() WHERE id = $2`,
      [form.chief_complaint, encounterId],
    );

    if (form.address) {
      await tenantDb.query(
        `UPDATE patients SET address = $1, updated_at = now() WHERE id = $2`,
        [form.address, form.patient_id],
      );
    }

    await tenantDb.query(
      `UPDATE pre_visit_intake_forms
       SET synced_to_encounter = TRUE, synced_at = now(), encounter_id = $1
       WHERE appointment_id = $2`,
      [encounterId, appointmentId],
    );

    this.logger.log(`Pre-visit intake synced to encounter ${encounterId}`);
  }

  async sendReminders(tenantDb: DataSource, subdomain: string): Promise<void> {
    const pending = await tenantDb.query(
      `SELECT pvif.id, pvif.patient_id, p.first_name, p.phone, a.appointment_time
       FROM pre_visit_intake_forms pvif
       JOIN patients p ON p.id = pvif.patient_id
       JOIN appointments a ON a.id = pvif.appointment_id
       WHERE pvif.completed_at IS NULL
         AND pvif.reminder_sent_at IS NULL
         AND a.appointment_date = CURRENT_DATE
         AND a.appointment_time::time < (now() + interval '2 hours')::time`,
    );

    for (const form of pending) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await tenantDb.query(
        `UPDATE pre_visit_intake_forms
         SET form_token_hash = $1, form_token_expires = now() + interval '3 hours',
             reminder_sent_at = now(), updated_at = now()
         WHERE id = $2`,
        [tokenHash, form.id],
      );
      const link = `https://${subdomain}.umoya.app/intake/${rawToken}`;
      await this.sms.send(
        form.phone,
        `Reminder ${form.first_name}: your appointment is today at ${form.appointment_time}. Quick intake form: ${link}`,
      );
    }
    this.logger.log(`Pre-visit reminders sent: ${pending.length}`);
  }
}
