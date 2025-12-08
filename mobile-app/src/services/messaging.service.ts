import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  subject: string;
  messageText: string;
  messageType?: string;
  priority?: string;
  status: string;
  isRead?: boolean;
  sentAt: string;
  createdAt: string;
  threadId?: string;
  patientId?: string;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
  }>;
}

export interface MessageThread {
  id: string;
  participants: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  messages: Message[];
  lastMessageAt: string;
}

class MessagingService {
  /**
   * Get inbox messages
   */
  async getInbox(filters?: { status?: string; priority?: string; limit?: number; offset?: number }): Promise<Message[]> {
    try {
      const params = filters || {};
      const response = await ehrApi.get(API_ENDPOINTS.MESSAGING.INBOX, { params });
      return response.messages || response.data || response || [];
    } catch (error: any) {
      console.error('Error getting inbox:', error);
      return [];
    }
  }

  /**
   * Get sent messages
   */
  async getSentMessages(filters?: { limit?: number; offset?: number }): Promise<Message[]> {
    try {
      const params = filters || {};
      const response = await ehrApi.get(API_ENDPOINTS.MESSAGING.SENT, { params });
      return response.messages || response.data || response || [];
    } catch (error: any) {
      console.error('Error getting sent messages:', error);
      return [];
    }
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.MESSAGING.UNREAD_COUNT);
      return response.count || response.data?.count || 0;
    } catch (error: any) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Search messages
   */
  async searchMessages(query: string): Promise<Message[]> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.MESSAGING.SEARCH, { params: { q: query } });
      return response.messages || response.data || response || [];
    } catch (error: any) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  /**
   * Get patient messages
   */
  async getPatientMessages(patientId: string, filters?: { unreadOnly?: boolean }): Promise<Message[]> {
    try {
      const params = filters || {};
      const response = await ehrApi.get(`/messages/patient/${patientId}`, { params });
      return response.messages || response.data || response || [];
    } catch (error: any) {
      console.error('Error getting patient messages:', error);
      return [];
    }
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<Message> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.MESSAGING.BY_ID(messageId));
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting message:', error);
      throw error;
    }
  }

  /**
   * Get message thread
   */
  async getMessageThread(threadId: string): Promise<MessageThread> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.MESSAGING.THREAD(threadId));
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting thread:', error);
      throw error;
    }
  }

  /**
   * Send message
   */
  async sendMessage(messageData: {
    recipientId: string;
    subject: string;
    messageText: string;
    threadId?: string;
    priority?: string;
    patientId?: string;
  }): Promise<Message> {
    try {
      const response = await ehrApi.post(API_ENDPOINTS.MESSAGING.SEND, messageData);
      return response.data || response;
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Reply to message
   */
  async replyToMessage(messageId: string, replyText: string): Promise<Message> {
    try {
      const response = await ehrApi.post(API_ENDPOINTS.MESSAGING.REPLY(messageId), { messageText: replyText });
      return response.data || response;
    } catch (error: any) {
      console.error('Error replying to message:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await ehrApi.put(API_ENDPOINTS.MESSAGING.MARK_READ(messageId), {});
    } catch (error: any) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * Archive message
   */
  async archiveMessage(messageId: string): Promise<void> {
    try {
      await ehrApi.post(API_ENDPOINTS.MESSAGING.ARCHIVE(messageId), {});
    } catch (error: any) {
      console.error('Error archiving message:', error);
      throw error;
    }
  }

  /**
   * Get message templates
   */
  async getTemplates(category?: string): Promise<any[]> {
    try {
      const params = category ? { category } : {};
      const response = await ehrApi.get(API_ENDPOINTS.MESSAGING.TEMPLATES, { params });
      return response.templates || response.data || response || [];
    } catch (error: any) {
      console.error('Error getting templates:', error);
      return [];
    }
  }

  /**
   * Apply message template
   */
  async applyTemplate(templateId: string, variables: any): Promise<string> {
    try {
      const response = await ehrApi.post(API_ENDPOINTS.MESSAGING.APPLY_TEMPLATE(templateId), { variables });
      return response.content || response.data?.content || response;
    } catch (error: any) {
      console.error('Error applying template:', error);
      throw error;
    }
  }
}

export default new MessagingService();
