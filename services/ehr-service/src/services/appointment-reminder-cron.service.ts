import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { NotificationCenterService } from './notification-center.service';

/**
 * S221 — 24-hour appointment reminders.
 *
 * Hourly sweep: for every active tenant, finds scheduled/confirmed appointments
 * falling 23–24 hours from now and dispatches the config-gated
 * `appointment_reminder` trigger (SMS/Email per tenant settings). The hourly
 * window means each appointment is picked up exactly once; a notification_log
 * lookback guards against double sends across restarts.
 */
@Injectable()
export class AppointmentReminderCronService {
  private readonly logger = new Logger(AppointmentReminderCronService.name);

  constructor(
    @Optional() @Inject(TenantService) private readonly tenantService?: TenantService,
    @Optional() @Inject(NotificationCenterService) private readonly notificationCenterService?: NotificationCenterService,
  ) {}

  @Cron(process.env.APPOINTMENT_REMINDER_CRON || '0 * * * *')
  async runHourlyReminderSweep(): Promise<void> {
    if (!this.tenantService || !this.notificationCenterService) {
      this.logger.warn('AppointmentReminderCronService: dependencies not injected, skipping');
      return;
    }

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const tenants = await this.tenantService.getAllActiveTenants();

      for (const tenant of tenants) {
        try {
          const tenantDb = await this.tenantService.getTenantDatabase(tenant.subdomain);
          if (!tenantDb) continue;

          const upcoming: Array<{
            id: string;
            appointment_date: string;
            patient_id: string;
            first_name: string;
            last_name: string;
            phone: string | null;
            email: string | null;
          }> = await tenantDb.query(`
            SELECT a.id, a.appointment_date, a.patient_id,
                   p.first_name, p.last_name, p.phone, p.email
            FROM appointments a
            JOIN patients p ON p.id = a.patient_id
            WHERE a.status IN ('scheduled', 'confirmed')
              AND a.appointment_date >= NOW() + INTERVAL '23 hours'
              AND a.appointment_date <  NOW() + INTERVAL '24 hours'
          `);

          for (const appointment of upcoming) {
            if (!appointment.phone && !appointment.email) {
              skipped += 1;
              continue;
            }

            // Restart guard: skip if this patient already got a reminder in the
            // last 25h (also collapses multiple same-day appointments into one).
            const [alreadySent] = await tenantDb.query(
              `SELECT 1 FROM notification_log
               WHERE trigger_key = 'appointment_reminder'
                 AND patient_id = $1
                 AND created_at > NOW() - INTERVAL '25 hours'
               LIMIT 1`,
              [appointment.patient_id],
            );
            if (alreadySent) {
              skipped += 1;
              continue;
            }

            const when = new Date(appointment.appointment_date);
            const message =
              `Umoya: Reminder — ${appointment.first_name} ${appointment.last_name}, you have an appointment ` +
              `tomorrow ${when.toDateString()} at ${when.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}. ` +
              `Reply STOP to opt out.`;

            const result = await this.notificationCenterService.notifyTrigger(tenantDb, 'appointment_reminder', {
              recipientSms: appointment.phone || undefined,
              recipientEmail: appointment.email || undefined,
              patientId: appointment.patient_id,
              subject: 'Appointment Reminder',
              message,
            });
            if (result.dispatched > 0) sent += 1;
            else skipped += 1;
          }
        } catch (tenantError: any) {
          errors += 1;
          this.logger.warn(`Reminder sweep failed for tenant ${tenant.subdomain}: ${tenantError?.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Appointment reminder sweep failed: ${error?.message}`);
      return;
    }

    if (sent > 0 || errors > 0) {
      this.logger.log(`Appointment reminder sweep complete. sent=${sent}, skipped=${skipped}, errors=${errors}`);
    }
  }
}
