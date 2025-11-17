import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { TenantService } from './tenant.service';

/**
 * Specialty Dashboard Automation Service
 * Handles scheduled jobs for:
 * - Regimen cycle reminders
 * - Adverse event escalation
 * - Cardiology follow-up SLA alerts
 */
@Injectable()
export class SpecialtyAutomationService {
  private readonly logger = new Logger(SpecialtyAutomationService.name);

  constructor(
    private notificationsService: NotificationsService,
    private tenantService: TenantService,
  ) {}

  /**
   * Check for upcoming regimen cycles and send reminders
   * Runs daily at 8 AM
   */
  @Cron('0 8 * * *') // Daily at 8 AM
  async checkRegimenCycleReminders() {
    this.logger.log('Checking for upcoming regimen cycles...');
    try {
      const tenants = await this.tenantService.getAllActiveTenants();
      for (const tenant of tenants) {
        const tenantDb = await this.tenantService.getTenantDatabase(tenant.id);
        if (tenantDb) {
          await this.processRegimenReminders(tenantDb);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check regimen reminders: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Escalate adverse events with Grade 3+ severity
   * Runs every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async escalateAdverseEvents() {
    this.logger.log('Checking for adverse events requiring escalation...');
    try {
      const tenants = await this.tenantService.getAllActiveTenants();
      for (const tenant of tenants) {
        const tenantDb = await this.tenantService.getTenantDatabase(tenant.id);
        if (tenantDb) {
          await this.processAdverseEventEscalations(tenantDb);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to escalate adverse events: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Check cardiology follow-up SLA violations
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkCardiologyFollowUpSLA() {
    this.logger.log('Checking cardiology follow-up SLA compliance...');
    try {
      const tenants = await this.tenantService.getAllActiveTenants();
      for (const tenant of tenants) {
        const tenantDb = await this.tenantService.getTenantDatabase(tenant.id);
        if (tenantDb) {
          await this.processCardiologyFollowUpSLA(tenantDb);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check cardiology SLA: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Process regimen cycle reminders for a specific tenant
   */
  async processRegimenReminders(tenantDb: DataSource): Promise<void> {
    try {
      // Find regimens with upcoming cycles
      const upcomingCycles = await tenantDb.query(`
        SELECT 
          r.id,
          r.case_id,
          r.regimen_name,
          r.cycle_length_days,
          r.current_cycle,
          r.last_cycle_date,
          r.next_cycle_date,
          oc.patient_id,
          oc.primary_diagnosis
        FROM oncology_regimens r
        JOIN oncology_cases oc ON oc.id = r.case_id
        WHERE r.status = 'active'
          AND r.next_cycle_date IS NOT NULL
          AND r.next_cycle_date <= CURRENT_DATE + INTERVAL '3 days'
          AND r.next_cycle_date >= CURRENT_DATE
        ORDER BY r.next_cycle_date ASC
      `);

      for (const cycle of upcomingCycles) {
        this.logger.log(
          `Regimen ${cycle.regimen_name} (Case ${cycle.case_id}) has cycle due on ${cycle.next_cycle_date}`,
        );

        // Create reminder task or notification
        // This would integrate with your notification system
        await this.createRegimenReminder(tenantDb, cycle);
      }
    } catch (error) {
      this.logger.error(`Failed to process regimen reminders: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Process adverse event escalations for a specific tenant
   */
  async processAdverseEventEscalations(tenantDb: DataSource): Promise<void> {
    try {
      // Find adverse events with Grade 3+ severity that haven't been escalated
      const severeEvents = await tenantDb.query(`
        SELECT 
          ae.id,
          ae.regimen_id,
          ae.event_type,
          ae.severity_grade,
          ae.snomed_concept_id,
          ae.snomed_term,
          ae.event_date,
          ae.status,
          r.case_id,
          oc.patient_id
        FROM oncology_adverse_events ae
        JOIN oncology_regimens r ON r.id = ae.regimen_id
        JOIN oncology_cases oc ON oc.id = r.case_id
        WHERE ae.severity_grade >= 3
          AND ae.status != 'resolved'
          AND (ae.escalated_at IS NULL OR ae.escalated_at < NOW() - INTERVAL '24 hours')
        ORDER BY ae.severity_grade DESC, ae.event_date DESC
      `);

      for (const event of severeEvents) {
        this.logger.warn(
          `Escalating Grade ${event.severity_grade} adverse event: ${event.event_type} (${event.snomed_term})`,
        );

        // Mark as escalated and create alert
        await tenantDb.query(
          `
          UPDATE oncology_adverse_events
          SET escalated_at = NOW(),
              status = CASE 
                WHEN status = 'pending' THEN 'escalated'
                ELSE status
              END
          WHERE id = $1
        `,
          [event.id],
        );

        // Create escalation notification
        await this.createAdverseEventEscalation(tenantDb, event);
      }
    } catch (error) {
      this.logger.error(`Failed to process adverse event escalations: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Process cardiology follow-up SLA checks for a specific tenant
   */
  async processCardiologyFollowUpSLA(tenantDb: DataSource): Promise<void> {
    try {
      // Find cardiology encounters with follow-up requirements that are past SLA
      const slaViolations = await tenantDb.query(`
        SELECT 
          ce.id,
          ce.patient_id,
          ce.encounter_date,
          ce.care_status,
          ce.follow_up_required,
          ce.follow_up_date,
          ce.symptom_snomed_codes,
          CASE 
            WHEN ce.follow_up_date IS NOT NULL THEN ce.follow_up_date
            WHEN ce.encounter_date IS NOT NULL THEN ce.encounter_date + INTERVAL '30 days'
            ELSE NULL
          END as calculated_follow_up_date,
          CASE 
            WHEN ce.follow_up_date IS NOT NULL AND ce.follow_up_date < CURRENT_DATE THEN CURRENT_DATE - ce.follow_up_date
            WHEN ce.encounter_date IS NOT NULL AND (ce.encounter_date + INTERVAL '30 days') < CURRENT_DATE THEN CURRENT_DATE - (ce.encounter_date + INTERVAL '30 days')
            ELSE 0
          END as days_overdue
        FROM cardiology_encounters ce
        WHERE ce.care_status NOT IN ('completed', 'cancelled')
          AND ce.follow_up_required = true
          AND (
            (ce.follow_up_date IS NOT NULL AND ce.follow_up_date < CURRENT_DATE)
            OR (ce.follow_up_date IS NULL AND ce.encounter_date IS NOT NULL AND (ce.encounter_date + INTERVAL '30 days') < CURRENT_DATE)
          )
        ORDER BY days_overdue DESC
      `);

      for (const violation of slaViolations) {
        this.logger.warn(
          `Cardiology follow-up SLA violation: Encounter ${violation.id} is ${violation.days_overdue} days overdue`,
        );

        // Create SLA alert
        await this.createCardiologySLAAlert(tenantDb, violation);
      }
    } catch (error) {
      this.logger.error(`Failed to process cardiology SLA checks: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async createRegimenReminder(tenantDb: DataSource, cycle: any): Promise<void> {
    try {
      // Get patient info
      const patientResult = await tenantDb.query(
        `SELECT id, first_name, last_name, phone FROM patients WHERE id = $1`,
        [cycle.patient_id],
      );
      const patient = patientResult[0];

      if (patient && patient.phone) {
        const message = `Reminder: Patient ${patient.first_name} ${patient.last_name} has regimen ${cycle.regimen_name} cycle ${cycle.current_cycle + 1} due on ${cycle.next_cycle_date}. Please schedule infusion session.`;
        
        // Create notification record (if table exists)
        try {
          await tenantDb.query(
            `INSERT INTO notifications (patient_id, type, title, message, priority, created_at)
             VALUES ($1, 'regimen_reminder', 'Regimen Cycle Reminder', $2, 'high', NOW())
             ON CONFLICT DO NOTHING`,
            [cycle.patient_id, message],
          );
        } catch (tableError: any) {
          // Table might not exist, that's OK - we'll just log
          this.logger.debug('Notifications table not available, skipping database notification');
        }

        // Send SMS if phone available
        try {
          await this.notificationsService.sendSms({
            phone: patient.phone,
            message: `Dear ${patient.first_name}, this is a reminder that your next ${cycle.regimen_name} cycle is scheduled for ${cycle.next_cycle_date}. Please contact the clinic to confirm.`,
          });
        } catch (smsError) {
          this.logger.warn(`Failed to send SMS reminder: ${smsError instanceof Error ? smsError.message : smsError}`);
        }
      }

      this.logger.log(`Created reminder for regimen ${cycle.regimen_name}, cycle ${cycle.current_cycle + 1}`);
    } catch (error) {
      this.logger.error(`Failed to create regimen reminder: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async createAdverseEventEscalation(tenantDb: DataSource, event: any): Promise<void> {
    try {
      // Get patient and case info
      const caseResult = await tenantDb.query(
        `SELECT oc.patient_id, oc.primary_diagnosis, p.first_name, p.last_name
         FROM oncology_cases oc
         JOIN patients p ON p.id = oc.patient_id
         WHERE oc.id = $1`,
        [event.case_id],
      );
      const caseInfo = caseResult[0];

      if (caseInfo) {
        const title = `Grade ${event.severity_grade} Adverse Event - ${event.event_type}`;
        const message = `Patient ${caseInfo.first_name} ${caseInfo.last_name} (Case: ${event.case_id}) experienced a Grade ${event.severity_grade} adverse event: ${event.snomed_term || event.event_type}. Immediate review required.`;

        // Create critical alert
        try {
          await tenantDb.query(
            `INSERT INTO critical_result_alerts (patient_id, alert_type, title, message, severity, status, created_at)
             VALUES ($1, 'adverse_event', $2, $3, $4, 'pending', NOW())
             ON CONFLICT DO NOTHING`,
            [caseInfo.patient_id, title, message, event.severity_grade >= 4 ? 'critical' : 'high'],
          );
        } catch (tableError: any) {
          this.logger.debug('Critical alerts table not available, skipping database alert');
        }

        // Notify oncology team
        const oncologyTeam = await tenantDb.query(
          `SELECT id, email, phone FROM users WHERE role IN ('doctor', 'nurse') AND specialization LIKE '%oncology%' LIMIT 5`,
        );

        for (const member of oncologyTeam) {
          if (member.phone) {
            try {
              await this.notificationsService.sendSms({
                phone: member.phone,
                message: `URGENT: ${message}`,
              });
            } catch (smsError) {
              this.logger.warn(`Failed to send escalation SMS: ${smsError instanceof Error ? smsError.message : smsError}`);
            }
          }
        }
      }

      this.logger.warn(
        `Created escalation alert for adverse event ${event.id} (Grade ${event.severity_grade})`,
      );
    } catch (error) {
      this.logger.error(`Failed to create adverse event escalation: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async createCardiologySLAAlert(tenantDb: DataSource, violation: any): Promise<void> {
    try {
      // Get patient info
      const patientResult = await tenantDb.query(
        `SELECT id, first_name, last_name, phone FROM patients WHERE id = $1`,
        [violation.patient_id],
      );
      const patient = patientResult[0];

      if (patient) {
        const title = `Cardiology Follow-up SLA Violation`;
        const message = `Patient ${patient.first_name} ${patient.last_name} has a cardiology follow-up that is ${violation.days_overdue} days overdue. Encounter ID: ${violation.id}`;

        // Create alert
        try {
          await tenantDb.query(
            `INSERT INTO critical_result_alerts (patient_id, alert_type, title, message, severity, status, created_at)
             VALUES ($1, 'sla_violation', $2, $3, 'high', 'pending', NOW())
             ON CONFLICT DO NOTHING`,
            [violation.patient_id, title, message],
          );
        } catch (tableError: any) {
          this.logger.debug('Critical alerts table not available, skipping database alert');
        }

        // Notify cardiology team
        const cardiologyTeam = await tenantDb.query(
          `SELECT id, email, phone FROM users WHERE role IN ('doctor', 'nurse') AND specialization LIKE '%cardiology%' LIMIT 5`,
        );

        for (const member of cardiologyTeam) {
          if (member.phone) {
            try {
              await this.notificationsService.sendSms({
                phone: member.phone,
                message: `SLA Alert: ${message}`,
              });
            } catch (smsError) {
              this.logger.warn(`Failed to send SLA alert SMS: ${smsError instanceof Error ? smsError.message : smsError}`);
            }
          }
        }
      }

      this.logger.warn(`Created SLA alert for cardiology encounter ${violation.id} (${violation.days_overdue} days overdue)`);
    } catch (error) {
      this.logger.error(`Failed to create cardiology SLA alert: ${error instanceof Error ? error.message : error}`);
    }
  }
}

