import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { PatientNotificationsService } from './patient-notifications.service';

@Injectable()
export class MedicationReminderService {
  private readonly logger = new Logger(MedicationReminderService.name);

  constructor(
    private tenantService: TenantService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private patientNotificationsService: PatientNotificationsService,
  ) {}

  /**
   * Cron job that runs every minute to check for medication reminders that need to be sent
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processMedicationReminders() {
    this.logger.log('Processing medication reminders...');

    try {
      // Get all active tenants
      const tenants = await this.tenantService.getAllTenants();
      const activeTenants = tenants.filter((t) => t.status === 'active');

      for (const tenant of activeTenants) {
        try {
          await this.processTenantReminders(tenant.id);
        } catch (error) {
          this.logger.error(`Error processing reminders for tenant ${tenant.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error in medication reminder cron job: ${error.message}`);
    }
  }

  /**
   * Process reminders for a specific tenant
   */
  private async processTenantReminders(tenantId: string) {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      this.logger.warn(`Failed to connect to tenant database: ${tenantId}`);
      return;
    }

    const now = new Date();

    // Find reminders that need to be sent (next_send_at <= now and is_active = true)
    const reminders = await connection.query(
      `SELECT 
        m.id,
        m.prescription_id,
        m.patient_id,
        m.medication_name,
        m.reminder_time,
        m.reminder_days,
        m.reminder_type,
        m.timezone,
        p.first_name,
        p.last_name,
        p.phone,
        p.email,
        pr.dosage,
        pr.frequency
      FROM medication_reminders m
      JOIN patients p ON m.patient_id = p.id
      JOIN prescriptions pr ON m.prescription_id = pr.id
      WHERE m.is_active = true 
        AND m.next_send_at <= $1
        AND pr.status = 'active'
      ORDER BY m.next_send_at ASC
      LIMIT 50`,
      [now],
    );

    if (reminders.length === 0) {
      return;
    }

    this.logger.log(`Found ${reminders.length} reminders to send for tenant ${tenantId}`);

    for (const reminder of reminders) {
      try {
        await this.sendReminder(connection, reminder, tenantId);
      } catch (error) {
        this.logger.error(`Error sending reminder ${reminder.id}: ${error.message}`);
      }
    }
  }

  /**
   * Send a medication reminder
   */
  private async sendReminder(connection: any, reminder: any, tenantId: string) {
    const { reminder_type, medication_name, dosage, frequency, patient_id, prescription_id } = reminder;
    const patientName = `${reminder.first_name} ${reminder.last_name}`;
    const message = `Medication Reminder: Time to take ${medication_name} (${dosage}, ${frequency}). MediCore`;

    // Send based on reminder type
    const sendPromises: Promise<any>[] = [];

    if (reminder_type === 'sms' || reminder_type === 'all') {
      if (reminder.phone) {
        sendPromises.push(
          this.notificationsService.sendSms({
            phone: reminder.phone,
            message,
          }),
        );
      }
    }

    if (reminder_type === 'email' || reminder_type === 'all') {
      if (reminder.email) {
        sendPromises.push(
          this.emailService.sendEmail({
            to: reminder.email,
            subject: `Medication Reminder: ${medication_name}`,
            html: `
              <h2>Medication Reminder</h2>
              <p>Dear ${patientName},</p>
              <p>This is a reminder to take your medication:</p>
              <ul>
                <li><strong>Medication:</strong> ${medication_name}</li>
                <li><strong>Dosage:</strong> ${dosage}</li>
                <li><strong>Frequency:</strong> ${frequency}</li>
              </ul>
              <p>Thank you for using MediCore.</p>
            `,
          }),
        );
      }
    }

    if (reminder_type === 'notification' || reminder_type === 'push' || reminder_type === 'all') {
      // Create in-app notification
      sendPromises.push(
        this.patientNotificationsService.createNotification(
          patient_id,
          tenantId,
          {
            type: 'medication_reminder',
            title: 'Medication Reminder',
            message: `Time to take ${medication_name}`,
            data: {
              prescriptionId: prescription_id,
              medicationName: medication_name,
              dosage,
              frequency,
            },
          },
        ),
      );
    }

    // Wait for all notifications to be sent
    await Promise.allSettled(sendPromises);

    // Update reminder record
    const nextSendAt = this.calculateNextReminderTime(
      reminder.reminder_time,
      reminder.reminder_days,
      reminder.timezone || 'Africa/Harare',
    );

    await connection.query(
      `UPDATE medication_reminders 
       SET 
         last_sent_at = NOW(),
         next_send_at = $1,
         sent_count = sent_count + 1,
         updated_at = NOW()
       WHERE id = $2`,
      [nextSendAt, reminder.id],
    );

    this.logger.log(`Sent reminder for ${medication_name} to patient ${patient_id}`);
  }

  /**
   * Calculate next reminder time based on reminder schedule
   */
  private calculateNextReminderTime(reminderTime: string, reminderDays: number[], timezone: string = 'Africa/Harare'): Date {
    const now = new Date();
    const [hours, minutes] = reminderTime.split(':').map(Number);
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Find next day in reminderDays array
    let daysUntilNext = 0;
    for (let i = 0; i < 7; i++) {
      const checkDay = (currentDay + i) % 7;
      if (reminderDays.includes(checkDay)) {
        if (i === 0) {
          // Today is in the list, check if time has passed
          const reminderToday = new Date(now);
          reminderToday.setHours(hours, minutes, 0, 0);
          if (reminderToday > now) {
            return reminderToday; // Reminder is later today
          }
        } else {
          daysUntilNext = i;
          break;
        }
      }
    }

    // If no day found in next 7 days, use first day in list
    if (daysUntilNext === 0 && reminderDays.length > 0) {
      daysUntilNext = (reminderDays[0] - currentDay + 7) % 7 || 7;
    }

    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntilNext);
    nextDate.setHours(hours, minutes, 0, 0);

    return nextDate;
  }
}

