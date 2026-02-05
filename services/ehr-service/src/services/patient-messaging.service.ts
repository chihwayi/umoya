import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { PatientMessage, SenderType, RecipientType, MessageType, Priority } from '../entities/patient-message.entity';

@Injectable()
export class PatientMessagingService {
  private readonly logger = new Logger(PatientMessagingService.name);

  constructor(private tenantService: TenantService) {}

  private async getMessageRepository(tenantId: string): Promise<Repository<PatientMessage>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(PatientMessage);
  }

  async sendMessage(
    patientId: string,
    recipientId: string,
    recipientType: RecipientType,
    message: string,
    tenantId: string,
    subject?: string,
    messageType: MessageType = 'general',
    priority: Priority = 'normal',
  ): Promise<PatientMessage> {
    const messageRepository = await this.getMessageRepository(tenantId);

    const newMessage = messageRepository.create({
      tenantId,
      patientId,
      senderType: 'patient',
      senderId: patientId,
      recipientType,
      recipientId,
      subject,
      message,
      messageType,
      priority,
      read: false,
    });

    return await messageRepository.save(newMessage);
  }

  async getPatientMessages(
    patientId: string,
    tenantId: string,
    filters?: { read?: boolean; messageType?: MessageType; limit?: number; offset?: number },
  ): Promise<{ messages: PatientMessage[]; total: number }> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    let query = `
      SELECT 
        id,
        tenant_id as "tenantId",
        patient_id as "patientId",
        sender_type as "senderType",
        sender_id as "senderId",
        recipient_type as "recipientType",
        recipient_id as "recipientId",
        subject,
        message,
        message_type as "messageType",
        priority,
        read,
        read_at as "readAt",
        attachments,
        parent_message_id as "parentMessageId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM patient_messages
      WHERE patient_id = $1 AND deleted_at IS NULL
    `;

    const params: any[] = [patientId];
    let paramIndex = 2;

    if (filters?.read !== undefined) {
      query += ` AND read = $${paramIndex}`;
      params.push(filters.read);
      paramIndex++;
    }

    if (filters?.messageType) {
      query += ` AND message_type = $${paramIndex}`;
      params.push(filters.messageType);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    } else {
      query += ` LIMIT 50`;
    }

    if (filters?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
    }

    const messages = await connection.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM patient_messages
      WHERE patient_id = $1 AND deleted_at IS NULL
      ${filters?.read !== undefined ? ` AND read = $2` : ''}
      ${filters?.messageType ? ` AND message_type = $${filters.read !== undefined ? '3' : '2'}` : ''}
    `;
    const countParams: any[] = [patientId];
    if (filters?.read !== undefined) countParams.push(filters.read);
    if (filters?.messageType) countParams.push(filters.messageType);
    const countResult = await connection.query(countQuery, countParams);
    const total = parseInt(countResult[0]?.total || '0', 10);

    return { messages, total };
  }

  async getMessage(messageId: string, patientId: string, tenantId: string): Promise<PatientMessage> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const query = `
      SELECT 
        id,
        tenant_id as "tenantId",
        patient_id as "patientId",
        sender_type as "senderType",
        sender_id as "senderId",
        recipient_type as "recipientType",
        recipient_id as "recipientId",
        subject,
        message,
        message_type as "messageType",
        priority,
        read,
        read_at as "readAt",
        attachments,
        parent_message_id as "parentMessageId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM patient_messages
      WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL
    `;

    const [message] = await connection.query(query, [messageId, patientId]);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async markAsRead(messageId: string, patientId: string, tenantId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    await connection.query(
      `UPDATE patient_messages 
       SET read = TRUE, read_at = NOW() 
       WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL`,
      [messageId, patientId],
    );
  }

  async markAllAsRead(patientId: string, tenantId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    await connection.query(
      `UPDATE patient_messages 
       SET read = TRUE, read_at = NOW() 
       WHERE patient_id = $1 AND read = FALSE AND deleted_at IS NULL`,
      [patientId],
    );
  }

  async deleteMessage(messageId: string, patientId: string, tenantId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    await connection.query(
      `UPDATE patient_messages 
       SET deleted_at = NOW() 
       WHERE id = $1 AND patient_id = $2`,
      [messageId, patientId],
    );
  }
}

