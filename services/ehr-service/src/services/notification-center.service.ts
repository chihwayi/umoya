import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';

export const DEFAULT_NOTIFICATION_TRIGGERS: Array<{ key: string; label: string; description: string }> = [
  { key: 'appointment_booked', label: 'Appointment Booked', description: 'Confirmation with date, time, practitioner, and location when an appointment is created.' },
  { key: 'appointment_reminder', label: 'Appointment Reminder', description: 'Reminder with appointment details 24 hours before the appointment.' },
  { key: 'payment_received', label: 'Payment Received', description: 'Receipt confirmation with invoice number and amount when a payment is recorded.' },
  { key: 'claim_status_updated', label: 'Claim Status Updated', description: 'Status update with claim number and new status when a medical-aid claim status changes.' },
  { key: 'staff_invitation', label: 'Staff Invitation', description: 'Invitation email with an accept link when a staff member is invited to the practice.' },
];

/**
 * Single hub for tenant-configurable automated notification triggers, manual
 * one-off reminders, and the notification audit log. SMS via SmsService,
 * email via EmailService.
 */
@Injectable()
export class NotificationCenterService {
  private readonly logger = new Logger(NotificationCenterService.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
  ) {}

  /** Trigger configs, seeding any missing defaults on read so the list is stable. */
  async getTriggerConfigs(tenantDb: DataSource) {
    for (const trigger of DEFAULT_NOTIFICATION_TRIGGERS) {
      await tenantDb.query(
        `INSERT INTO notification_trigger_configs (trigger_key, label, description, sms_enabled, email_enabled)
         VALUES ($1, $2, $3, true, true)
         ON CONFLICT (trigger_key) DO NOTHING`,
        [trigger.key, trigger.label, trigger.description],
      );
    }
    const rows = await tenantDb.query(
      `SELECT trigger_key, label, description, sms_enabled, email_enabled, updated_at
       FROM notification_trigger_configs
       ORDER BY label ASC`,
    );
    return rows.map((row: any) => ({
      triggerKey: row.trigger_key,
      label: row.label,
      description: row.description,
      smsEnabled: row.sms_enabled,
      emailEnabled: row.email_enabled,
      updatedAt: row.updated_at,
    }));
  }

  async updateTriggerConfig(
    tenantDb: DataSource,
    triggerKey: string,
    body: { smsEnabled?: boolean; emailEnabled?: boolean },
  ) {
    const known = DEFAULT_NOTIFICATION_TRIGGERS.find((t) => t.key === triggerKey);
    if (!known) throw new BadRequestException(`Unknown notification trigger: ${triggerKey}`);

    await tenantDb.query(
      `INSERT INTO notification_trigger_configs (trigger_key, label, description, sms_enabled, email_enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (trigger_key) DO UPDATE SET
         sms_enabled = COALESCE($4, notification_trigger_configs.sms_enabled),
         email_enabled = COALESCE($5, notification_trigger_configs.email_enabled),
         updated_at = NOW()`,
      [triggerKey, known.label, known.description,
        body?.smsEnabled ?? null, body?.emailEnabled ?? null],
    );
    const configs = await this.getTriggerConfigs(tenantDb);
    return configs.find((c) => c.triggerKey === triggerKey);
  }

  private async writeLog(tenantDb: DataSource, entry: any) {
    await tenantDb.query(
      `INSERT INTO notification_log (trigger_key, channel, recipient, patient_id, subject, body, status, error, sent_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [entry.triggerKey ?? null, entry.channel, entry.recipient, entry.patientId ?? null,
        entry.subject ?? null, entry.body, entry.status, entry.error ?? null, entry.sentBy ?? null],
    );
  }

  /** Send a one-off manual reminder over SMS or Email and record it. */
  async sendManualReminder(
    tenantDb: DataSource,
    sentBy: string | null,
    body: { patientId?: string; recipient: string; channel: 'sms' | 'email'; subject?: string; message: string },
  ) {
    const recipient = String(body?.recipient ?? '').trim();
    const message = String(body?.message ?? '').trim();
    const channel = body?.channel;
    if (!recipient) throw new BadRequestException('recipient is required');
    if (!message) throw new BadRequestException('message is required');
    if (channel !== 'sms' && channel !== 'email') throw new BadRequestException('channel must be sms or email');

    let status = 'sent';
    let error: string | null = null;
    try {
      if (channel === 'sms') {
        await this.smsService.sendSms(recipient, message);
      } else {
        await this.emailService.sendEmail({
          to: recipient,
          subject: body.subject || 'Reminder',
          text: message,
        });
      }
    } catch (err: any) {
      status = 'failed';
      error = err?.message || 'dispatch failed';
      this.logger.warn(`Manual reminder ${channel} to ${recipient} failed: ${error}`);
    }

    await this.writeLog(tenantDb, {
      triggerKey: 'manual_reminder',
      channel,
      recipient,
      patientId: body.patientId,
      subject: body.subject,
      body: message,
      status,
      error,
      sentBy,
    });

    return { status, channel, recipient };
  }

  /**
   * Dispatch an automated trigger, gated by its per-tenant config. Reusable from
   * appointment/payment/claim event sources. Best-effort; always logged.
   */
  async notifyTrigger(
    tenantDb: DataSource,
    triggerKey: string,
    payload: { recipientSms?: string; recipientEmail?: string; patientId?: string; subject?: string; message: string },
  ) {
    const [config] = await tenantDb.query(
      `SELECT sms_enabled, email_enabled FROM notification_trigger_configs WHERE trigger_key = $1`,
      [triggerKey],
    );
    // Default to enabled when unconfigured (config seeds lazily).
    const smsEnabled = config ? config.sms_enabled : true;
    const emailEnabled = config ? config.email_enabled : true;

    const sends: Array<{ channel: 'sms' | 'email'; recipient: string }> = [];
    if (smsEnabled && payload.recipientSms) sends.push({ channel: 'sms', recipient: payload.recipientSms });
    if (emailEnabled && payload.recipientEmail) sends.push({ channel: 'email', recipient: payload.recipientEmail });

    for (const send of sends) {
      let status = 'sent';
      let error: string | null = null;
      try {
        if (send.channel === 'sms') {
          await this.smsService.sendSms(send.recipient, payload.message);
        } else {
          await this.emailService.sendEmail({ to: send.recipient, subject: payload.subject || 'Notification', text: payload.message });
        }
      } catch (err: any) {
        status = 'failed';
        error = err?.message || 'dispatch failed';
      }
      await this.writeLog(tenantDb, {
        triggerKey, channel: send.channel, recipient: send.recipient,
        patientId: payload.patientId, subject: payload.subject, body: payload.message, status, error, sentBy: null,
      });
    }

    return { dispatched: sends.length };
  }

  async listLog(tenantDb: DataSource, query: { limit?: number } = {}) {
    const limit = Math.min(Math.max(Number(query?.limit) || 100, 1), 500);
    const rows = await tenantDb.query(
      `SELECT id, trigger_key, channel, recipient, patient_id, subject, body, status, error, sent_by, created_at
       FROM notification_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((row: any) => ({
      id: row.id,
      triggerKey: row.trigger_key,
      channel: row.channel,
      recipient: row.recipient,
      patientId: row.patient_id,
      subject: row.subject,
      body: row.body,
      status: row.status,
      error: row.error,
      sentBy: row.sent_by,
      createdAt: row.created_at,
    }));
  }
}
