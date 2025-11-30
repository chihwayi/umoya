import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { PatientNotification, NotificationType, Priority } from '../entities/patient-notification.entity';

@Injectable()
export class PatientNotificationsService {
  private readonly logger = new Logger(PatientNotificationsService.name);

  constructor(private tenantService: TenantService) {}

  async createNotification(
    patientId: string,
    notificationType: NotificationType,
    title: string,
    message: string,
    tenantId: string,
    options?: {
      actionUrl?: string;
      actionLabel?: string;
      priority?: Priority;
      metadata?: any;
      expiresAt?: Date;
    },
  ): Promise<PatientNotification> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const query = `
      INSERT INTO patient_notifications (
        tenant_id, patient_id, notification_type, title, message,
        action_url, action_label, priority, metadata, expires_at, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING 
        id,
        tenant_id as "tenantId",
        patient_id as "patientId",
        notification_type as "notificationType",
        title,
        message,
        action_url as "actionUrl",
        action_label as "actionLabel",
        priority,
        read,
        read_at as "readAt",
        sent_at as "sentAt",
        expires_at as "expiresAt",
        metadata,
        created_at as "createdAt"
    `;

    const [notification] = await connection.query(query, [
      tenantId,
      patientId,
      notificationType,
      title,
      message,
      options?.actionUrl || null,
      options?.actionLabel || null,
      options?.priority || 'normal',
      options?.metadata ? JSON.stringify(options.metadata) : null,
      options?.expiresAt || null,
    ]);

    return notification;
  }

  async getPatientNotifications(
    patientId: string,
    tenantId: string,
    filters?: { read?: boolean; notificationType?: NotificationType; limit?: number },
  ): Promise<{ notifications: PatientNotification[]; unreadCount: number }> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    let query = `
      SELECT 
        id,
        tenant_id as "tenantId",
        patient_id as "patientId",
        notification_type as "notificationType",
        title,
        message,
        action_url as "actionUrl",
        action_label as "actionLabel",
        priority,
        read,
        read_at as "readAt",
        sent_at as "sentAt",
        expires_at as "expiresAt",
        metadata,
        created_at as "createdAt"
      FROM patient_notifications
      WHERE patient_id = $1
    `;

    const params: any[] = [patientId];
    let paramIndex = 2;

    // Filter out expired notifications
    query += ` AND (expires_at IS NULL OR expires_at > NOW())`;

    if (filters?.read !== undefined) {
      query += ` AND read = $${paramIndex}`;
      params.push(filters.read);
      paramIndex++;
    }

    if (filters?.notificationType) {
      query += ` AND notification_type = $${paramIndex}`;
      params.push(filters.notificationType);
      paramIndex++;
    }

    query += ` ORDER BY sent_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    } else {
      query += ` LIMIT 50`;
    }

    const notifications = await connection.query(query, params);

    // Get unread count
    const unreadQuery = `
      SELECT COUNT(*) as count
      FROM patient_notifications
      WHERE patient_id = $1 AND read = FALSE AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const unreadResult = await connection.query(unreadQuery, [patientId]);
    const unreadCount = parseInt(unreadResult[0]?.count || '0', 10);

    return { notifications, unreadCount };
  }

  async markAsRead(notificationId: string, patientId: string, tenantId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    await connection.query(
      `UPDATE patient_notifications 
       SET read = TRUE, read_at = NOW() 
       WHERE id = $1 AND patient_id = $2`,
      [notificationId, patientId],
    );
  }

  async markAllAsRead(patientId: string, tenantId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    await connection.query(
      `UPDATE patient_notifications 
       SET read = TRUE, read_at = NOW() 
       WHERE patient_id = $1 AND read = FALSE`,
      [patientId],
    );
  }

  async deleteNotification(notificationId: string, patientId: string, tenantId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    await connection.query(
      `DELETE FROM patient_notifications 
       WHERE id = $1 AND patient_id = $2`,
      [notificationId, patientId],
    );
  }

  // Helper methods to create specific notification types
  async createAppointmentReminder(
    patientId: string,
    appointmentId: string,
    appointmentDate: Date,
    doctorName: string,
    tenantId: string,
  ): Promise<PatientNotification> {
    return this.createNotification(
      patientId,
      'appointment_reminder',
      'Appointment Reminder',
      `You have an appointment with ${doctorName} on ${appointmentDate.toLocaleDateString()} at ${appointmentDate.toLocaleTimeString()}`,
      tenantId,
      {
        actionUrl: `/appointments/${appointmentId}`,
        actionLabel: 'View Appointment',
        priority: 'high',
        metadata: { appointmentId },
      },
    );
  }

  async createLabResultsReady(
    patientId: string,
    labOrderId: string,
    tenantId: string,
  ): Promise<PatientNotification> {
    return this.createNotification(
      patientId,
      'lab_results_ready',
      'Lab Results Available',
      'Your lab test results are now available for viewing.',
      tenantId,
      {
        actionUrl: `/lab-results`,
        actionLabel: 'View Results',
        priority: 'normal',
        metadata: { labOrderId },
      },
    );
  }

  async createPrescriptionReady(
    patientId: string,
    prescriptionId: string,
    medicationName: string,
    tenantId: string,
  ): Promise<PatientNotification> {
    return this.createNotification(
      patientId,
      'prescription_ready',
      'New Prescription',
      `A new prescription for ${medicationName} has been added to your account.`,
      tenantId,
      {
        actionUrl: `/prescriptions`,
        actionLabel: 'View Prescription',
        priority: 'normal',
        metadata: { prescriptionId },
      },
    );
  }

  async createBillGenerated(
    patientId: string,
    billId: string,
    amount: number,
    tenantId: string,
  ): Promise<PatientNotification> {
    return this.createNotification(
      patientId,
      'bill_generated',
      'New Bill Generated',
      `A new bill of $${amount.toFixed(2)} has been generated.`,
      tenantId,
      {
        actionUrl: `/bills`,
        actionLabel: 'View Bill',
        priority: 'normal',
        metadata: { billId, amount },
      },
    );
  }

  async createMessageReceived(
    patientId: string,
    messageId: string,
    senderName: string,
    tenantId: string,
  ): Promise<PatientNotification> {
    return this.createNotification(
      patientId,
      'message_received',
      'New Message',
      `You have received a new message from ${senderName}.`,
      tenantId,
      {
        actionUrl: `/messages`,
        actionLabel: 'View Message',
        priority: 'normal',
        metadata: { messageId },
      },
    );
  }
}

