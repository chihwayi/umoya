import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { AtMessageLog } from '../entities/at-message-log.entity';
import { UssdSession } from '../entities/ussd-session.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';

// Africa's Talking SDK — no @types package available
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AfricasTalking = require('africastalking');

@Injectable()
export class AtMessagingService {
  private readonly logger = new Logger(AtMessagingService.name);
  private readonly at: any;

  constructor(private readonly tenantService: TenantService) {
    const apiKey = process.env.AT_API_KEY || '';
    const username = process.env.AT_USERNAME || 'sandbox';
    if (apiKey) {
      this.at = AfricasTalking({ apiKey, username });
    } else {
      this.logger.warn('AT_API_KEY not set — Africa\'s Talking calls will fail gracefully');
      this.at = null;
    }
  }

  // ── SMS ───────────────────────────────────────────────────────────────────

  async sendSms(
    tenantId: string,
    to: string[],
    message: string,
    opts?: { patientId?: string; messageType?: string },
  ): Promise<{ success: boolean; messageIds: string[]; failures: string[] }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const logRepo = db.getRepository(AtMessageLog);

    if (!this.at) {
      await Promise.all(
        to.map((phone) =>
          logRepo.save(
            logRepo.create({
              patientId: opts?.patientId ?? null,
              channel: 'sms',
              direction: 'outbound',
              phoneNumber: phone,
              messageText: message,
              messageType: opts?.messageType ?? null,
              status: 'failed',
              failureReason: 'AT_API_KEY not configured',
            }),
          ),
        ),
      );
      return { success: false, messageIds: [], failures: to };
    }

    const shortCode = process.env.AT_SMS_SHORTCODE;
    const sendOpts: any = { to, message };
    if (shortCode) sendOpts.from = shortCode;

    try {
      const result = await this.at.SMS.send(sendOpts);
      const recipients: any[] = result?.SMSMessageData?.Recipients ?? [];

      const messageIds: string[] = [];
      const failures: string[] = [];

      await Promise.all(
        recipients.map(async (r: any) => {
          const status = r.statusCode === 101 ? 'sent' : 'failed';
          if (status === 'sent') messageIds.push(r.messageId);
          else failures.push(r.number);

          await logRepo.save(
            logRepo.create({
              patientId: opts?.patientId ?? null,
              channel: 'sms',
              direction: 'outbound',
              phoneNumber: r.number,
              messageText: message,
              messageType: opts?.messageType ?? null,
              status,
              atMessageId: r.messageId ?? null,
              failureReason: status === 'failed' ? r.status : null,
            }),
          );
        }),
      );

      return { success: failures.length === 0, messageIds, failures };
    } catch (err: any) {
      this.logger.error('AT SMS send failed', err?.message);
      await Promise.all(
        to.map((phone) =>
          logRepo.save(
            logRepo.create({
              patientId: opts?.patientId ?? null,
              channel: 'sms',
              direction: 'outbound',
              phoneNumber: phone,
              messageText: message,
              messageType: opts?.messageType ?? null,
              status: 'failed',
              failureReason: err?.message ?? 'Unknown error',
            }),
          ),
        ),
      );
      return { success: false, messageIds: [], failures: to };
    }
  }

  // ── Template-based notifications ─────────────────────────────────────────

  async sendFromTemplate(
    tenantId: string,
    templateKey: string,
    to: string[],
    vars: Record<string, string>,
    opts?: { patientId?: string },
  ): Promise<{ success: boolean; messageIds: string[]; failures: string[] }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const tmplRepo = db.getRepository(NotificationTemplate);
    const tmpl = await tmplRepo.findOne({ where: { templateKey, isActive: true } });

    if (!tmpl) {
      return { success: false, messageIds: [], failures: to };
    }

    const body = this.interpolate(tmpl.bodyTemplate, vars);
    return this.sendSms(tenantId, to, body, { patientId: opts?.patientId, messageType: templateKey });
  }

  async sendAppointmentReminder(
    tenantId: string,
    to: string,
    patientName: string,
    appointmentDate: string,
    facilityName: string,
    patientId?: string,
  ): Promise<{ success: boolean; messageIds: string[]; failures: string[] }> {
    return this.sendFromTemplate(
      tenantId,
      'appointment_reminder',
      [to],
      { patientName, appointmentDate, facilityName },
      { patientId },
    ).then((r) => r).catch(() =>
      // Fallback to default message if template missing
      this.sendSms(
        tenantId,
        [to],
        `Hello ${patientName}, reminder: you have an appointment on ${appointmentDate} at ${facilityName}.`,
        { patientId, messageType: 'appointment_reminder' },
      ),
    );
  }

  async sendMedicationAlert(
    tenantId: string,
    to: string,
    patientName: string,
    medicationName: string,
    doseTime: string,
    patientId?: string,
  ): Promise<{ success: boolean; messageIds: string[]; failures: string[] }> {
    return this.sendFromTemplate(
      tenantId,
      'medication_alert',
      [to],
      { patientName, medicationName, doseTime },
      { patientId },
    ).catch(() =>
      this.sendSms(
        tenantId,
        [to],
        `Hi ${patientName}, time to take ${medicationName} at ${doseTime}.`,
        { patientId, messageType: 'medication_alert' },
      ),
    );
  }

  async sendLabResultNotification(
    tenantId: string,
    to: string,
    patientName: string,
    testName: string,
    facilityName: string,
    patientId?: string,
  ): Promise<{ success: boolean; messageIds: string[]; failures: string[] }> {
    return this.sendFromTemplate(
      tenantId,
      'lab_result_ready',
      [to],
      { patientName, testName, facilityName },
      { patientId },
    ).catch(() =>
      this.sendSms(
        tenantId,
        [to],
        `Hello ${patientName}, your ${testName} results are ready. Please visit ${facilityName} to collect them.`,
        { patientId, messageType: 'lab_result_ready' },
      ),
    );
  }

  // ── USSD ─────────────────────────────────────────────────────────────────

  /**
   * Handles Africa's Talking USSD callback.
   * Returns `CON {menu}` to continue session or `END {msg}` to terminate.
   */
  async handleUssdCallback(
    tenantId: string,
    sessionId: string,
    phoneNumber: string,
    serviceCode: string,
    text: string,
  ): Promise<string> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const sessionRepo = db.getRepository(UssdSession);
    const logRepo = db.getRepository(AtMessageLog);

    // Log inbound USSD
    await logRepo.save(
      logRepo.create({
        patientId: null,
        channel: 'ussd',
        direction: 'inbound',
        phoneNumber,
        messageText: text || '(session start)',
        messageType: 'ussd_input',
        status: 'received',
      }),
    );

    // Get or create session
    let session = await sessionRepo.findOne({ where: { sessionId } });
    if (!session) {
      session = sessionRepo.create({
        sessionId,
        phoneNumber,
        serviceCode,
        currentMenu: 'main',
        sessionState: {},
        ended: false,
      });
      await sessionRepo.save(session);
    }

    if (session.ended) {
      return 'END This session has already ended.';
    }

    const steps = text.split('*').filter(Boolean);
    const response = this.resolveMenu(steps);

    // Update session state
    const isEnd = response.startsWith('END');
    await sessionRepo.update(session.id, {
      currentMenu: isEnd ? null : this.menuFromSteps(steps),
      sessionState: { steps },
      ended: isEnd,
    });

    return response;
  }

  // ── Logs & Templates (read) ───────────────────────────────────────────────

  async getMessageLogs(
    tenantId: string,
    filters: { channel?: string; patientId?: string; page: number; limit: number },
  ): Promise<{ data: AtMessageLog[]; total: number; page: number; limit: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(AtMessageLog);

    const qb = repo.createQueryBuilder('l').orderBy('l.sentAt', 'DESC');
    if (filters.channel) qb.andWhere('l.channel = :ch', { ch: filters.channel });
    if (filters.patientId) qb.andWhere('l.patientId = :pid', { pid: filters.patientId });

    const total = await qb.getCount();
    const data = await qb
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getMany();

    return { data, total, page: filters.page, limit: filters.limit };
  }

  async getUssdSessions(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ data: UssdSession[]; total: number; page: number; limit: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(UssdSession);

    const [data, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getTemplates(tenantId: string): Promise<NotificationTemplate[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(NotificationTemplate).find({ order: { templateKey: 'ASC' } });
  }

  async upsertTemplate(tenantId: string, body: any): Promise<NotificationTemplate> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NotificationTemplate);
    if (body.id) {
      await repo.update(body.id, body);
      return repo.findOne({ where: { id: body.id } }) as Promise<NotificationTemplate>;
    }
    const entity = repo.create(body);
    return repo.save(entity) as unknown as Promise<NotificationTemplate>;
  }

  async handleDeliveryReport(
    tenantId: string,
    atMessageId: string,
    status: string,
  ): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(AtMessageLog);
    const log = await repo.findOne({ where: { atMessageId } });
    if (!log) return;

    const update: Partial<AtMessageLog> = { status };
    if (status === 'Success') update.deliveredAt = new Date();
    await repo.update(log.id, update);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
  }

  private resolveMenu(steps: string[]): string {
    if (steps.length === 0) {
      return (
        'CON Welcome to MediCore Health\n' +
        '1. My Appointments\n' +
        '2. My Medications\n' +
        '3. Lab Results\n' +
        '4. Emergency Contacts\n' +
        '0. Exit'
      );
    }

    const [first, second] = steps;

    switch (first) {
      case '1':
        if (!second) {
          return (
            'CON Appointments\n' +
            '1. View next appointment\n' +
            '2. Book appointment\n' +
            '0. Back'
          );
        }
        if (second === '1') return 'END Your next appointment details will be sent via SMS.';
        if (second === '2') return 'END To book an appointment, please call your facility or visit the clinic.';
        if (second === '0') return this.resolveMenu([]);
        break;

      case '2':
        if (!second) {
          return (
            'CON Medications\n' +
            '1. View active medications\n' +
            '2. Request refill\n' +
            '0. Back'
          );
        }
        if (second === '1') return 'END Your active medications list will be sent via SMS shortly.';
        if (second === '2') return 'END Your refill request has been submitted. The pharmacy will contact you.';
        if (second === '0') return this.resolveMenu([]);
        break;

      case '3':
        if (!second) {
          return (
            'CON Lab Results\n' +
            '1. Check if results are ready\n' +
            '0. Back'
          );
        }
        if (second === '1') return 'END You will receive an SMS when your lab results are ready for collection.';
        if (second === '0') return this.resolveMenu([]);
        break;

      case '4':
        return 'END Emergency: 999 | Ambulance: 0800 723 253 | Facility: +254 20 000 0000';

      case '0':
        return 'END Thank you for using MediCore Health. Goodbye!';
    }

    return 'END Invalid option. Please try again.';
  }

  private menuFromSteps(steps: string[]): string {
    if (steps.length === 0) return 'main';
    if (steps.length === 1) return `main_${steps[0]}`;
    return `main_${steps[0]}_${steps[1]}`;
  }
}
