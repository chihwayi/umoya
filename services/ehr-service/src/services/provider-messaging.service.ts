import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ProviderMessagingService {
  private readonly logger = new Logger(ProviderMessagingService.name);

  async sendMessage(messageData: any, tenantDb: DataSource): Promise<any> {
    try {
      const {
        sender_id,
        recipient_id,
        recipient_role,
        recipient_team,
        subject,
        message_text,
        message_type = 'message',
        priority = 'normal',
        patient_id,
        appointment_id,
        related_entity_type,
        related_entity_id,
        requires_response = false,
        response_required_by,
        is_urgent = false,
        thread_id,
      } = messageData;

      // Create or get thread
      let finalThreadId = thread_id;
      if (!finalThreadId) {
        const threadResult = await tenantDb.query(
          `INSERT INTO message_threads (subject, patient_id, related_entity_type, related_entity_id, participants, last_message_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           RETURNING id`,
          [
            subject,
            patient_id || null,
            related_entity_type || null,
            related_entity_id || null,
            JSON.stringify([sender_id, recipient_id].filter(Boolean)),
          ]
        );
        finalThreadId = threadResult[0].id;
      }

      // Insert message
      const result = await tenantDb.query(
        `INSERT INTO provider_messages (
          thread_id, sender_id, recipient_id, recipient_role, recipient_team,
          subject, message_text, message_type, priority, status,
          patient_id, appointment_id, related_entity_type, related_entity_id,
          requires_response, response_required_by, is_urgent, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        RETURNING *`,
        [
          finalThreadId,
          sender_id,
          recipient_id || null,
          recipient_role || null,
          recipient_team || null,
          subject,
          message_text,
          message_type,
          priority,
          'sent',
          patient_id || null,
          appointment_id || null,
          related_entity_type || null,
          related_entity_id || null,
          requires_response,
          response_required_by || null,
          is_urgent,
        ]
      );

      // Update thread last_message_at
      await tenantDb.query(
        `UPDATE message_threads SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [finalThreadId]
      );

      this.logger.log(`Message sent: ${result[0].id} from ${sender_id} to ${recipient_id || recipient_role || recipient_team}`);
      return result[0];
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getInbox(userId: string, filters: any, tenantDb: DataSource): Promise<any> {
    try {
      const { status = 'sent', priority, message_type, limit = 50, offset = 0 } = filters;

      let query = `
        SELECT m.*, 
               u.first_name || ' ' || u.last_name as sender_name,
               u.email as sender_email,
               p.first_name || ' ' || p.last_name as patient_name,
               (SELECT COUNT(*) FROM message_attachments WHERE message_id = m.id) as attachment_count
        FROM provider_messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN patients p ON m.patient_id = p.id
        WHERE (m.recipient_id = $1 OR m.recipient_role IN (SELECT role FROM users WHERE id = $1))
          AND m.status != 'deleted'
      `;

      const params: any[] = [userId];
      let paramIndex = 2;

      if (status && status !== 'all') {
        query += ` AND m.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (priority) {
        query += ` AND m.priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      if (message_type) {
        query += ` AND m.message_type = $${paramIndex}`;
        params.push(message_type);
        paramIndex++;
      }

      query += ` ORDER BY m.sent_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const messages = await tenantDb.query(query, params);

      // Get total count
      const countResult = await tenantDb.query(
        `SELECT COUNT(*) as total FROM provider_messages 
         WHERE (recipient_id = $1 OR recipient_role IN (SELECT role FROM users WHERE id = $1))
           AND status != 'deleted'`,
        [userId]
      );

      return {
        messages,
        total: parseInt(countResult[0].total),
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error(`Error getting inbox: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSentMessages(userId: string, filters: any, tenantDb: DataSource): Promise<any> {
    try {
      const { limit = 50, offset = 0 } = filters;

      const messages = await tenantDb.query(
        `SELECT m.*, 
                CASE 
                  WHEN m.recipient_id IS NOT NULL THEN (SELECT first_name || ' ' || last_name FROM users WHERE id = m.recipient_id)
                  WHEN m.recipient_role IS NOT NULL THEN m.recipient_role
                  ELSE m.recipient_team
                END as recipient_name,
                p.first_name || ' ' || p.last_name as patient_name,
                (SELECT COUNT(*) FROM message_attachments WHERE message_id = m.id) as attachment_count
         FROM provider_messages m
         LEFT JOIN patients p ON m.patient_id = p.id
         WHERE m.sender_id = $1 AND m.status != 'deleted'
         ORDER BY m.sent_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const countResult = await tenantDb.query(
        `SELECT COUNT(*) as total FROM provider_messages WHERE sender_id = $1 AND status != 'deleted'`,
        [userId]
      );

      return {
        messages,
        total: parseInt(countResult[0].total),
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error(`Error getting sent messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMessageById(messageId: string, tenantDb: DataSource): Promise<any> {
    try {
      const result = await tenantDb.query(
        `SELECT m.*, 
                u_sender.first_name || ' ' || u_sender.last_name as sender_name,
                u_sender.email as sender_email,
                CASE 
                  WHEN m.recipient_id IS NOT NULL THEN (SELECT first_name || ' ' || last_name FROM users WHERE id = m.recipient_id)
                  WHEN m.recipient_role IS NOT NULL THEN m.recipient_role
                  ELSE m.recipient_team
                END as recipient_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM provider_messages m
         LEFT JOIN users u_sender ON m.sender_id = u_sender.id
         LEFT JOIN patients p ON m.patient_id = p.id
         WHERE m.id = $1`,
        [messageId]
      );

      if (result.length === 0) {
        throw new NotFoundException('Message not found');
      }

      // Get attachments
      const attachments = await tenantDb.query(
        `SELECT * FROM message_attachments WHERE message_id = $1`,
        [messageId]
      );

      // Get read receipts
      const readReceipts = await tenantDb.query(
        `SELECT rr.*, u.first_name || ' ' || u.last_name as reader_name
         FROM message_read_receipts rr
         LEFT JOIN users u ON rr.read_by = u.id
         WHERE rr.message_id = $1
         ORDER BY rr.read_at DESC`,
        [messageId]
      );

      return {
        ...result[0],
        attachments,
        read_receipts: readReceipts,
      };
    } catch (error) {
      this.logger.error(`Error getting message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async replyToMessage(messageId: string, replyData: any, tenantDb: DataSource): Promise<any> {
    try {
      // Get original message
      const originalMessage = await this.getMessageById(messageId, tenantDb);

      // Create reply
      const replyMessage = await this.sendMessage(
        {
          thread_id: originalMessage.thread_id,
          sender_id: replyData.sender_id,
          recipient_id: originalMessage.sender_id,
          subject: `Re: ${originalMessage.subject}`,
          message_text: replyData.message_text,
          message_type: 'message',
          priority: originalMessage.priority,
          patient_id: originalMessage.patient_id,
          appointment_id: originalMessage.appointment_id,
        },
        tenantDb
      );

      return replyMessage;
    } catch (error) {
      this.logger.error(`Error replying to message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async forwardMessage(messageId: string, forwardData: any, tenantDb: DataSource): Promise<any> {
    try {
      const originalMessage = await this.getMessageById(messageId, tenantDb);

      const forwardedMessage = await this.sendMessage(
        {
          sender_id: forwardData.sender_id,
          recipient_id: forwardData.recipient_id,
          recipient_role: forwardData.recipient_role,
          recipient_team: forwardData.recipient_team,
          subject: `Fwd: ${originalMessage.subject}`,
          message_text: `---------- Forwarded message ----------\nFrom: ${originalMessage.sender_name}\nDate: ${originalMessage.sent_at}\nSubject: ${originalMessage.subject}\n\n${originalMessage.message_text}`,
          message_type: originalMessage.message_type,
          priority: originalMessage.priority,
          patient_id: originalMessage.patient_id,
        },
        tenantDb
      );

      return forwardedMessage;
    } catch (error) {
      this.logger.error(`Error forwarding message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markAsRead(messageId: string, userId: string, tenantDb: DataSource): Promise<void> {
    try {
      // Update message status
      await tenantDb.query(
        `UPDATE provider_messages SET status = 'read', read_at = NOW() WHERE id = $1 AND recipient_id = $2`,
        [messageId, userId]
      );

      // Create read receipt
      await tenantDb.query(
        `INSERT INTO message_read_receipts (message_id, read_by) VALUES ($1, $2) ON CONFLICT (message_id, read_by) DO NOTHING`,
        [messageId, userId]
      );

      this.logger.log(`Message ${messageId} marked as read by ${userId}`);
    } catch (error) {
      this.logger.error(`Error marking message as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markAsUnread(messageId: string, userId: string, tenantDb: DataSource): Promise<void> {
    try {
      await tenantDb.query(
        `UPDATE provider_messages SET status = 'delivered', read_at = NULL WHERE id = $1 AND recipient_id = $2`,
        [messageId, userId]
      );

      this.logger.log(`Message ${messageId} marked as unread by ${userId}`);
    } catch (error) {
      this.logger.error(`Error marking message as unread: ${error.message}`, error.stack);
      throw error;
    }
  }

  async archiveMessage(messageId: string, userId: string, tenantDb: DataSource): Promise<void> {
    try {
      await tenantDb.query(
        `UPDATE provider_messages SET status = 'archived', archived_at = NOW() 
         WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)`,
        [messageId, userId]
      );

      this.logger.log(`Message ${messageId} archived by ${userId}`);
    } catch (error) {
      this.logger.error(`Error archiving message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteMessage(messageId: string, userId: string, tenantDb: DataSource): Promise<void> {
    try {
      await tenantDb.query(
        `UPDATE provider_messages SET status = 'deleted' 
         WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)`,
        [messageId, userId]
      );

      this.logger.log(`Message ${messageId} deleted by ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMessageThread(threadId: string, tenantDb: DataSource): Promise<any> {
    try {
      // Get thread info
      const threadResult = await tenantDb.query(
        `SELECT * FROM message_threads WHERE id = $1`,
        [threadId]
      );

      if (threadResult.length === 0) {
        throw new NotFoundException('Thread not found');
      }

      // Get messages in thread
      const messages = await tenantDb.query(
        `SELECT m.*, 
                u.first_name || ' ' || u.last_name as sender_name,
                u.email as sender_email
         FROM provider_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.thread_id = $1 AND m.status != 'deleted'
         ORDER BY m.sent_at ASC`,
        [threadId]
      );

      return {
        thread: threadResult[0],
        messages,
      };
    } catch (error) {
      this.logger.error(`Error getting message thread: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createThread(threadData: any, tenantDb: DataSource): Promise<any> {
    try {
      const { subject, patient_id, related_entity_type, related_entity_id, participants } = threadData;

      const result = await tenantDb.query(
        `INSERT INTO message_threads (subject, patient_id, related_entity_type, related_entity_id, participants)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [subject, patient_id || null, related_entity_type || null, related_entity_id || null, JSON.stringify(participants || [])]
      );

      return result[0];
    } catch (error) {
      this.logger.error(`Error creating thread: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addAttachment(messageId: string, file: any, tenantDb: DataSource): Promise<any> {
    try {
      const { file_name, file_path, file_url, file_size, mime_type } = file;

      const result = await tenantDb.query(
        `INSERT INTO message_attachments (message_id, file_name, file_path, file_url, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [messageId, file_name, file_path || null, file_url || null, file_size || null, mime_type || null]
      );

      return result[0];
    } catch (error) {
      this.logger.error(`Error adding attachment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUnreadCount(userId: string, tenantDb: DataSource): Promise<number> {
    try {
      const result = await tenantDb.query(
        `SELECT COUNT(*) as count FROM provider_messages 
         WHERE (recipient_id = $1 OR recipient_role IN (SELECT role FROM users WHERE id = $1))
           AND status IN ('sent', 'delivered')
           AND read_at IS NULL`,
        [userId]
      );

      return parseInt(result[0].count);
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`, error.stack);
      throw error;
    }
  }

  async searchMessages(userId: string, query: string, tenantDb: DataSource): Promise<any> {
    try {
      const messages = await tenantDb.query(
        `SELECT m.*, 
                u.first_name || ' ' || u.last_name as sender_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM provider_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         LEFT JOIN patients p ON m.patient_id = p.id
         WHERE (m.sender_id = $1 OR m.recipient_id = $1 OR m.recipient_role IN (SELECT role FROM users WHERE id = $1))
           AND m.status != 'deleted'
           AND (m.subject ILIKE $2 OR m.message_text ILIKE $2)
         ORDER BY m.sent_at DESC
         LIMIT 50`,
        [userId, `%${query}%`]
      );

      return messages;
    } catch (error) {
      this.logger.error(`Error searching messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createTaskFromMessage(messageId: string, taskData: any, tenantDb: DataSource): Promise<any> {
    try {
      const { task_title, task_description, assigned_to, assigned_by, due_date, priority = 'normal' } = taskData;

      const result = await tenantDb.query(
        `INSERT INTO message_tasks (message_id, task_title, task_description, assigned_to, assigned_by, due_date, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [messageId, task_title, task_description || null, assigned_to, assigned_by, due_date || null, priority]
      );

      return result[0];
    } catch (error) {
      this.logger.error(`Error creating task from message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMessageTasks(messageId: string, tenantDb: DataSource): Promise<any> {
    try {
      const tasks = await tenantDb.query(
        `SELECT t.*, 
                u_assigned.first_name || ' ' || u_assigned.last_name as assigned_to_name,
                u_by.first_name || ' ' || u_by.last_name as assigned_by_name
         FROM message_tasks t
         LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
         LEFT JOIN users u_by ON t.assigned_by = u_by.id
         WHERE t.message_id = $1
         ORDER BY t.created_at DESC`,
        [messageId]
      );

      return tasks;
    } catch (error) {
      this.logger.error(`Error getting message tasks: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: any, tenantDb: DataSource): Promise<any> {
    try {
      const { status, completion_notes } = updates;

      const result = await tenantDb.query(
        `UPDATE message_tasks 
         SET status = COALESCE($2, status),
             completion_notes = COALESCE($3, completion_notes),
             completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [taskId, status || null, completion_notes || null]
      );

      return result[0];
    } catch (error) {
      this.logger.error(`Error updating task: ${error.message}`, error.stack);
      throw error;
    }
  }
}


import { DataSource } from 'typeorm';

@Injectable()
export class ProviderMessagingService {
  private readonly logger = new Logger(ProviderMessagingService.name);

  async sendMessage(messageData: any, tenantDb: DataSource): Promise<any> {
    try {
      const {
        sender_id,
        recipient_id,
        recipient_role,
        recipient_team,
        subject,
        message_text,
        message_type = 'message',
        priority = 'normal',
        patient_id,
        appointment_id,
        related_entity_type,
        related_entity_id,
        requires_response = false,
        response_required_by,
        is_urgent = false,
        thread_id,
      } = messageData;

      // Create or get thread
      let finalThreadId = thread_id;
      if (!finalThreadId) {
        const threadResult = await tenantDb.query(
          `INSERT INTO message_threads (subject, patient_id, related_entity_type, related_entity_id, participants, last_message_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           RETURNING id`,
          [
            subject,
            patient_id || null,
            related_entity_type || null,
            related_entity_id || null,
            JSON.stringify([sender_id, recipient_id].filter(Boolean)),
          ]
        );
        finalThreadId = threadResult[0].id;
      }

      // Insert message
      const result = await tenantDb.query(
        `INSERT INTO provider_messages (
          thread_id, sender_id, recipient_id, recipient_role, recipient_team,
          subject, message_text, message_type, priority, status,
          patient_id, appointment_id, related_entity_type, related_entity_id,
          requires_response, response_required_by, is_urgent, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        RETURNING *`,
        [
          finalThreadId,
          sender_id,
          recipient_id || null,
          recipient_role || null,
          recipient_team || null,
          subject,
          message_text,
          message_type,
          priority,
          'sent',
          patient_id || null,
          appointment_id || null,
          related_entity_type || null,
          related_entity_id || null,
          requires_response,
          response_required_by || null,
          is_urgent,
        ]
      );

      // Update thread last_message_at
      await tenantDb.query(
        `UPDATE message_threads SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [finalThreadId]
      );

      this.logger.log(`Message sent: ${result[0].id} from ${sender_id} to ${recipient_id || recipient_role || recipient_team}`);
      return result[0];
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getInbox(userId: string, filters: any, tenantDb: DataSource): Promise<any> {
    try {
      const { status = 'sent', priority, message_type, limit = 50, offset = 0 } = filters;

      let query = `
        SELECT m.*, 
               u.first_name || ' ' || u.last_name as sender_name,
               u.email as sender_email,
               p.first_name || ' ' || p.last_name as patient_name,
               (SELECT COUNT(*) FROM message_attachments WHERE message_id = m.id) as attachment_count
        FROM provider_messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN patients p ON m.patient_id = p.id
        WHERE (m.recipient_id = $1 OR m.recipient_role IN (SELECT role FROM users WHERE id = $1))
          AND m.status != 'deleted'
      `;

      const params: any[] = [userId];
      let paramIndex = 2;

      if (status && status !== 'all') {
        query += ` AND m.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (priority) {
        query += ` AND m.priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      if (message_type) {
        query += ` AND m.message_type = $${paramIndex}`;
        params.push(message_type);
        paramIndex++;
      }

      query += ` ORDER BY m.sent_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const messages = await tenantDb.query(query, params);

      // Get total count
      const countResult = await tenantDb.query(
        `SELECT COUNT(*) as total FROM provider_messages 
         WHERE (recipient_id = $1 OR recipient_role IN (SELECT role FROM users WHERE id = $1))
           AND status != 'deleted'`,
        [userId]
      );

      return {
        messages,
        total: parseInt(countResult[0].total),
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error(`Error getting inbox: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSentMessages(userId: string, filters: any, tenantDb: DataSource): Promise<any> {
    try {
      const { limit = 50, offset = 0 } = filters;

      const messages = await tenantDb.query(
        `SELECT m.*, 
                CASE 
                  WHEN m.recipient_id IS NOT NULL THEN (SELECT first_name || ' ' || last_name FROM users WHERE id = m.recipient_id)
                  WHEN m.recipient_role IS NOT NULL THEN m.recipient_role
                  ELSE m.recipient_team
                END as recipient_name,
                p.first_name || ' ' || p.last_name as patient_name,
                (SELECT COUNT(*) FROM message_attachments WHERE message_id = m.id) as attachment_count
         FROM provider_messages m
         LEFT JOIN patients p ON m.patient_id = p.id
         WHERE m.sender_id = $1 AND m.status != 'deleted'
         ORDER BY m.sent_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const countResult = await tenantDb.query(
        `SELECT COUNT(*) as total FROM provider_messages WHERE sender_id = $1 AND status != 'deleted'`,
        [userId]
      );

      return {
        messages,
        total: parseInt(countResult[0].total),
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error(`Error getting sent messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMessageById(messageId: string, tenantDb: DataSource): Promise<any> {
    try {
      const result = await tenantDb.query(
        `SELECT m.*, 
                u_sender.first_name || ' ' || u_sender.last_name as sender_name,
                u_sender.email as sender_email,
                CASE 
                  WHEN m.recipient_id IS NOT NULL THEN (SELECT first_name || ' ' || last_name FROM users WHERE id = m.recipient_id)
                  WHEN m.recipient_role IS NOT NULL THEN m.recipient_role
                  ELSE m.recipient_team
                END as recipient_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM provider_messages m
         LEFT JOIN users u_sender ON m.sender_id = u_sender.id
         LEFT JOIN patients p ON m.patient_id = p.id
         WHERE m.id = $1`,
        [messageId]
      );

      if (result.length === 0) {
        throw new NotFoundException('Message not found');
      }

      // Get attachments
      const attachments = await tenantDb.query(
        `SELECT * FROM message_attachments WHERE message_id = $1`,
        [messageId]
      );

      // Get read receipts
      const readReceipts = await tenantDb.query(
        `SELECT rr.*, u.first_name || ' ' || u.last_name as reader_name
         FROM message_read_receipts rr
         LEFT JOIN users u ON rr.read_by = u.id
         WHERE rr.message_id = $1
         ORDER BY rr.read_at DESC`,
        [messageId]
      );

      return {
        ...result[0],
        attachments,
        read_receipts: readReceipts,
      };
    } catch (error) {
      this.logger.error(`Error getting message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async replyToMessage(messageId: string, replyData: any, tenantDb: DataSource): Promise<any> {
    try {
      // Get original message
      const originalMessage = await this.getMessageById(messageId, tenantDb);

      // Create reply
      const replyMessage = await this.sendMessage(
        {
          thread_id: originalMessage.thread_id,
          sender_id: replyData.sender_id,
          recipient_id: originalMessage.sender_id,
          subject: `Re: ${originalMessage.subject}`,
          message_text: replyData.message_text,
          message_type: 'message',
          priority: originalMessage.priority,
          patient_id: originalMessage.patient_id,
          appointment_id: originalMessage.appointment_id,
        },
        tenantDb
      );

      return replyMessage;
    } catch (error) {
      this.logger.error(`Error replying to message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async forwardMessage(messageId: string, forwardData: any, tenantDb: DataSource): Promise<any> {
    try {
      const originalMessage = await this.getMessageById(messageId, tenantDb);

      const forwardedMessage = await this.sendMessage(
        {
          sender_id: forwardData.sender_id,
          recipient_id: forwardData.recipient_id,
          recipient_role: forwardData.recipient_role,
          recipient_team: forwardData.recipient_team,
          subject: `Fwd: ${originalMessage.subject}`,
          message_text: `---------- Forwarded message ----------\nFrom: ${originalMessage.sender_name}\nDate: ${originalMessage.sent_at}\nSubject: ${originalMessage.subject}\n\n${originalMessage.message_text}`,
          message_type: originalMessage.message_type,
          priority: originalMessage.priority,
          patient_id: originalMessage.patient_id,
        },
        tenantDb
      );

      return forwardedMessage;
    } catch (error) {
      this.logger.error(`Error forwarding message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markAsRead(messageId: string, userId: string, tenantDb: DataSource): Promise<void> {
    try {
      // Update message status
      await tenantDb.query(
        `UPDATE provider_messages SET status = 'read', read_at = NOW() WHERE id = $1 AND recipient_id = $2`,
        [messageId, userId]
      );

      // Create read receipt
      await tenantDb.query(
        `INSERT INTO message_read_receipts (message_id, read_by) VALUES ($1, $2) ON CONFLICT (message_id, read_by) DO NOTHING`,
        [messageId, userId]
      );

      this.logger.log(`Message ${messageId} marked as read by ${userId}`);
    } catch (error) {
      this.logger.error(`Error marking message as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markAsUnread(messageId: string, userId: string, tenantDb: DataSource): Promise<void> {
    try {
      await tenantDb.query(
        `UPDATE provider_messages SET status = 'delivered', read_at = NULL WHERE id = $1 AND recipient_id = $2`,
        [messageId, userId]
      );

      this.logger.log(`Message ${messageId} marked as unread by ${userId}`);
    } catch (error) {
      this.logger.error(`Error marking message as unread: ${error.message}`, error.stack);
      throw error;
    }
  }

  async archiveMessage(messageId: string, userId: string, tenantDb: DataSource): Promise<void> {
    try {
      await tenantDb.query(
        `UPDATE provider_messages SET status = 'archived', archived_at = NOW() 
         WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)`,
        [messageId, userId]
      );

      this.logger.log(`Message ${messageId} archived by ${userId}`);
    } catch (error) {
      this.logger.error(`Error archiving message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteMessage(messageId: string, userId: string, tenantDb: DataSource): Promise<void> {
    try {
      await tenantDb.query(
        `UPDATE provider_messages SET status = 'deleted' 
         WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)`,
        [messageId, userId]
      );

      this.logger.log(`Message ${messageId} deleted by ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMessageThread(threadId: string, tenantDb: DataSource): Promise<any> {
    try {
      // Get thread info
      const threadResult = await tenantDb.query(
        `SELECT * FROM message_threads WHERE id = $1`,
        [threadId]
      );

      if (threadResult.length === 0) {
        throw new NotFoundException('Thread not found');
      }

      // Get messages in thread
      const messages = await tenantDb.query(
        `SELECT m.*, 
                u.first_name || ' ' || u.last_name as sender_name,
                u.email as sender_email
         FROM provider_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.thread_id = $1 AND m.status != 'deleted'
         ORDER BY m.sent_at ASC`,
        [threadId]
      );

      return {
        thread: threadResult[0],
        messages,
      };
    } catch (error) {
      this.logger.error(`Error getting message thread: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createThread(threadData: any, tenantDb: DataSource): Promise<any> {
    try {
      const { subject, patient_id, related_entity_type, related_entity_id, participants } = threadData;

      const result = await tenantDb.query(
        `INSERT INTO message_threads (subject, patient_id, related_entity_type, related_entity_id, participants)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [subject, patient_id || null, related_entity_type || null, related_entity_id || null, JSON.stringify(participants || [])]
      );

      return result[0];
    } catch (error) {
      this.logger.error(`Error creating thread: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addAttachment(messageId: string, file: any, tenantDb: DataSource): Promise<any> {
    try {
      const { file_name, file_path, file_url, file_size, mime_type } = file;

      const result = await tenantDb.query(
        `INSERT INTO message_attachments (message_id, file_name, file_path, file_url, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [messageId, file_name, file_path || null, file_url || null, file_size || null, mime_type || null]
      );

      return result[0];
    } catch (error) {
      this.logger.error(`Error adding attachment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUnreadCount(userId: string, tenantDb: DataSource): Promise<number> {
    try {
      const result = await tenantDb.query(
        `SELECT COUNT(*) as count FROM provider_messages 
         WHERE (recipient_id = $1 OR recipient_role IN (SELECT role FROM users WHERE id = $1))
           AND status IN ('sent', 'delivered')
           AND read_at IS NULL`,
        [userId]
      );

      return parseInt(result[0].count);
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`, error.stack);
      throw error;
    }
  }

  async searchMessages(userId: string, query: string, tenantDb: DataSource): Promise<any> {
    try {
      const messages = await tenantDb.query(
        `SELECT m.*, 
                u.first_name || ' ' || u.last_name as sender_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM provider_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         LEFT JOIN patients p ON m.patient_id = p.id
         WHERE (m.sender_id = $1 OR m.recipient_id = $1 OR m.recipient_role IN (SELECT role FROM users WHERE id = $1))
           AND m.status != 'deleted'
           AND (m.subject ILIKE $2 OR m.message_text ILIKE $2)
         ORDER BY m.sent_at DESC
         LIMIT 50`,
        [userId, `%${query}%`]
      );

      return messages;
    } catch (error) {
      this.logger.error(`Error searching messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createTaskFromMessage(messageId: string, taskData: any, tenantDb: DataSource): Promise<any> {
    try {
      const { task_title, task_description, assigned_to, assigned_by, due_date, priority = 'normal' } = taskData;

      const result = await tenantDb.query(
        `INSERT INTO message_tasks (message_id, task_title, task_description, assigned_to, assigned_by, due_date, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [messageId, task_title, task_description || null, assigned_to, assigned_by, due_date || null, priority]
      );

      return result[0];
    } catch (error) {
      this.logger.error(`Error creating task from message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMessageTasks(messageId: string, tenantDb: DataSource): Promise<any> {
    try {
      const tasks = await tenantDb.query(
        `SELECT t.*, 
                u_assigned.first_name || ' ' || u_assigned.last_name as assigned_to_name,
                u_by.first_name || ' ' || u_by.last_name as assigned_by_name
         FROM message_tasks t
         LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
         LEFT JOIN users u_by ON t.assigned_by = u_by.id
         WHERE t.message_id = $1
         ORDER BY t.created_at DESC`,
        [messageId]
      );

      return tasks;
    } catch (error) {
      this.logger.error(`Error getting message tasks: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: any, tenantDb: DataSource): Promise<any> {
    try {
      const { status, completion_notes } = updates;

      const result = await tenantDb.query(
        `UPDATE message_tasks 
         SET status = COALESCE($2, status),
             completion_notes = COALESCE($3, completion_notes),
             completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [taskId, status || null, completion_notes || null]
      );

      return result[0];
    } catch (error) {
      this.logger.error(`Error updating task: ${error.message}`, error.stack);
      throw error;
    }
  }
}

