import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ClinicalAlertDelivery } from '../entities/clinical-alert-delivery.entity';
import axios from 'axios';

export interface AlertPayload {
  alertType: string;
  sourceEntityId: string;
  patientId: string;
  severity: string;
  message: string;
  payload?: Record<string, any>;
}

@Injectable()
export class AlertDeliveryService {
  private readonly logger = new Logger(AlertDeliveryService.name);
  private fcmUrl = 'https://fcm.googleapis.com/fcm/send';
  private fcmKey = process.env.FCM_SERVER_KEY || '';
  private smsUrl = process.env.SMS_GATEWAY_URL || '';

  // WebSocket server reference — injected by CriticalAlertGateway post-init
  private wsGateway: any;

  setGateway(gateway: any) { this.wsGateway = gateway; }

  constructor(private readonly tenantService: TenantService) {}

  // ── Main broadcast ─────────────────────────────────────────────────────────

  async broadcastCriticalAlert(subdomain: string, alert: AlertPayload): Promise<{ delivered: boolean; recipientCount: number }> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);

    // Find on-call staff for this patient
    const staff = await this.getOnCallStaff(ds, alert.patientId);
    if (!staff.length) {
      this.logger.warn(`No on-call staff found for patient ${alert.patientId}`);
      return { delivered: false, recipientCount: 0 };
    }

    for (const member of staff) {
      const record = await ds.getRepository(ClinicalAlertDelivery).save(
        ds.getRepository(ClinicalAlertDelivery).create({
          alertType: alert.alertType,
          sourceEntityId: alert.sourceEntityId,
          patientId: alert.patientId,
          recipientUserId: member.id,
          recipientRole: member.role,
          severity: alert.severity,
          message: alert.message,
          payload: alert.payload || {},
        })
      );

      // 1. WebSocket (immediate)
      const wsSent = this.sendWebSocket(subdomain, member.id, alert, record.id);

      // 2. FCM push (if device token available)
      const fcmSent = member.fcmToken
        ? await this.sendFcm(member.fcmToken, alert, record.id)
        : false;

      // 3. SMS fallback for critical
      const smsSent = (alert.severity === 'critical' && member.phone)
        ? await this.sendSms(member.phone, alert)
        : false;

      await ds.getRepository(ClinicalAlertDelivery).update(record.id, {
        websocketSent: wsSent,
        fcmSent,
        smsSent,
      });
    }

    return { delivered: true, recipientCount: staff.length };
  }

  async acknowledge(subdomain: string, alertId: string, userId: string): Promise<ClinicalAlertDelivery | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ClinicalAlertDelivery);
    await repo.update(alertId, {
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    });
    return repo.findOneBy({ id: alertId });
  }

  async getUnacknowledged(subdomain: string, userId: string): Promise<ClinicalAlertDelivery[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ClinicalAlertDelivery).find({
      where: { recipientUserId: userId, acknowledged: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getAlertHistory(subdomain: string, patientId: string): Promise<ClinicalAlertDelivery[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ClinicalAlertDelivery).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // ── Delivery helpers ───────────────────────────────────────────────────────

  private sendWebSocket(subdomain: string, userId: string, alert: AlertPayload, alertId: string): boolean {
    try {
      if (this.wsGateway) {
        this.wsGateway.sendToUser(userId, {
          event: 'clinical_alert',
          alertId,
          alertType: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          patientId: alert.patientId,
          payload: alert.payload,
        });
        return true;
      }
    } catch (e: any) {
      this.logger.warn(`WebSocket alert failed for user ${userId}: ${e?.message}`);
    }
    return false;
  }

  private async sendFcm(token: string, alert: AlertPayload, alertId: string): Promise<boolean> {
    if (!this.fcmKey) return false;
    try {
      await axios.post(this.fcmUrl, {
        to: token,
        notification: {
          title: `🚨 ${alert.severity.toUpperCase()}: ${alert.alertType.replace(/_/g, ' ')}`,
          body: alert.message,
          sound: 'default',
          priority: 'high',
        },
        data: { alertId, patientId: alert.patientId, alertType: alert.alertType },
      }, {
        headers: { Authorization: `key=${this.fcmKey}` },
        timeout: 5000,
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`FCM alert failed: ${e?.message}`);
      return false;
    }
  }

  private async sendSms(phone: string, alert: AlertPayload): Promise<boolean> {
    if (!this.smsUrl) return false;
    try {
      await axios.post(this.smsUrl, {
        to: phone,
        message: `UMOYA ALERT: ${alert.message} | Patient: ${alert.patientId}`,
      }, { timeout: 5000 });
      return true;
    } catch (e: any) {
      this.logger.warn(`SMS alert failed: ${e?.message}`);
      return false;
    }
  }

  private async getOnCallStaff(ds: any, patientId: string): Promise<Array<{
    id: string; role: string; fcmToken?: string; phone?: string;
  }>> {
    // Get attending doctor + on-call nurse for this patient
    const staff = await ds.query(`
      SELECT u.id, u.role, u.fcm_token, u.phone
      FROM users u
      INNER JOIN admissions a ON a.attending_doctor_id = u.id
      WHERE a.patient_id = $1 AND a.discharge_date IS NULL
      UNION
      SELECT u.id, u.role, u.fcm_token, u.phone
      FROM users u
      WHERE u.role = 'nurse' AND u.on_call = TRUE
      LIMIT 5
    `, [patientId]).catch((e: any) => { this.logger.warn(`On-call staff query for alert delivery failed: ${e?.message}`); return []; });
    return staff;
  }
}
