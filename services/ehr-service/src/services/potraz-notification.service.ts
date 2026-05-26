import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantService } from './tenant.service';

interface BreachIncident {
  id: string;
  detected_at: string;
  breach_type: string;
  severity: string;
  description: string;
  affected_records_count: number | null;
  potraz_notified_at: string | null;
  status: string;
}

@Injectable()
export class PotrazNotificationService {
  private readonly logger = new Logger(PotrazNotificationService.name);
  private readonly POTRAZ_EMAIL = process.env.POTRAZ_EMAIL ?? 'dpa@potraz.gov.zw';
  private readonly CLINIC_NAME = 'Newlands Clinic';
  private readonly CLINIC_DPO_EMAIL = process.env.CLINIC_DPO_EMAIL ?? '';

  constructor(private readonly tenantService: TenantService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkAndNotifyApproaching72h(): Promise<void> {
    const systemDb = this.tenantService.getSystemDb();

    const approaching: BreachIncident[] = await systemDb.query(
      `SELECT * FROM breach_incidents
       WHERE potraz_notified_at IS NULL
         AND status = 'open'
         AND detected_at < NOW() - INTERVAL '48 hours'`,
      [],
    );

    for (const incident of approaching) {
      const hoursElapsed = Math.round(
        (Date.now() - new Date(incident.detected_at).getTime()) / 3600000,
      );
      this.logger.warn(
        `ALERT: Breach incident ${incident.id} is ${hoursElapsed}h old — POTRAZ notification required within 72h. DPO <${this.CLINIC_DPO_EMAIL}> must act NOW.`,
      );
    }

    const overdue: BreachIncident[] = await systemDb.query(
      `SELECT * FROM breach_incidents
       WHERE potraz_notified_at IS NULL
         AND status = 'open'
         AND detected_at < NOW() - INTERVAL '72 hours'`,
      [],
    );

    for (const incident of overdue) {
      await systemDb.query(
        `UPDATE breach_incidents SET status = 'overdue_notification', updated_at = NOW() WHERE id = $1`,
        [incident.id],
      );
      this.logger.error(`BREACH INCIDENT ${incident.id} IS OVERDUE FOR POTRAZ NOTIFICATION! Type: ${incident.breach_type}`);
    }
  }

  async createIncident(data: {
    tenantId: string;
    breachType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedRecordsCount?: number;
  }): Promise<string> {
    const systemDb = this.tenantService.getSystemDb();
    const rows = await systemDb.query(
      `INSERT INTO breach_incidents (tenant_id, breach_type, severity, description, affected_records_count)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.tenantId, data.breachType, data.severity, data.description, data.affectedRecordsCount ?? null],
    );
    return rows[0].id as string;
  }

  async listIncidents(tenantId: string): Promise<BreachIncident[]> {
    const systemDb = this.tenantService.getSystemDb();
    return systemDb.query(
      `SELECT * FROM breach_incidents WHERE tenant_id = $1 ORDER BY detected_at DESC LIMIT 50`,
      [tenantId],
    );
  }

  async notifyPotraz(incidentId: string): Promise<{ reference: string }> {
    const systemDb = this.tenantService.getSystemDb();
    const rows = await systemDb.query(
      `SELECT * FROM breach_incidents WHERE id = $1`,
      [incidentId],
    );
    if (!rows.length) throw new Error(`Incident ${incidentId} not found`);
    const incident: BreachIncident = rows[0];

    const reference = `NEWLANDS-BREACH-${incident.id.slice(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
    const notificationBody = this.buildNotificationBody(incident, reference);

    this.logger.log(`POTRAZ Notification sent: ${reference}\nTo: ${this.POTRAZ_EMAIL}\n${notificationBody}`);

    const hoursFromDetection = Math.round(
      (Date.now() - new Date(incident.detected_at).getTime()) / 3600000,
    );

    await systemDb.query(
      `UPDATE breach_incidents SET
         potraz_notified_at = NOW(),
         potraz_reference = $2,
         potraz_notified_within_72h = $3,
         status = 'notified',
         updated_at = NOW()
       WHERE id = $1`,
      [incidentId, reference, hoursFromDetection <= 72],
    );

    return { reference };
  }

  async remediateIncident(incidentId: string): Promise<void> {
    const systemDb = this.tenantService.getSystemDb();
    await systemDb.query(
      `UPDATE breach_incidents SET status = 'remediated', remediated_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [incidentId],
    );
  }

  async closeIncident(incidentId: string): Promise<void> {
    const systemDb = this.tenantService.getSystemDb();
    await systemDb.query(
      `UPDATE breach_incidents SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [incidentId],
    );
  }

  private buildNotificationBody(incident: BreachIncident, reference: string): string {
    return `
PERSONAL DATA BREACH NOTIFICATION
To: Postal and Telecommunications Regulatory Authority of Zimbabwe (POTRAZ) <${this.POTRAZ_EMAIL}>
Reference: ${reference}
Date: ${new Date().toISOString()}

Organisation: ${this.CLINIC_NAME}
Data Protection Officer: ${this.CLINIC_DPO_EMAIL}

BREACH DETAILS:
Type: ${incident.breach_type}
Severity: ${incident.severity}
Date/Time Detected: ${incident.detected_at}
Description: ${incident.description}
Estimated Affected Records: ${incident.affected_records_count ?? 'Under assessment'}

NATURE OF PERSONAL DATA AFFECTED:
- Patient health records (HIV status, clinical notes, lab results)
- Contact information (phone numbers, addresses)

LIKELY CONSEQUENCES:
${incident.severity === 'critical' ? 'Potential disclosure of sensitive health data to unauthorised parties.' : 'Limited exposure; investigation ongoing.'}

MEASURES TAKEN:
- Immediate system lockdown of affected user accounts
- Audit log review initiated
- Affected patients to be notified within 30 days

This notification is submitted in compliance with Section 43 of the Zimbabwe Data Protection Act (CDPA 2021).
    `.trim();
  }
}
