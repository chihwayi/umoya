import { ehrApi } from '../config/api';

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  subject: string;
  messageText: string;
  isRead: boolean;
  createdAt: string;
  threadId?: string;
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
   * Get patient messages
   */
  async getPatientMessages(patientId: string, filters?: { unreadOnly?: boolean }): Promise<Message[]> {
    try {
      const params = filters || {};
      const response = await ehrApi.get(`/messages/patient/${patientId}`, { params });
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch messages');
    }
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<Message> {
    try {
      const response = await ehrApi.get(`/messages/${messageId}`);
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch message');
    }
  }

  /**
   * Get message thread
   */
  async getMessageThread(threadId: string): Promise<MessageThread> {
    try {
      const response = await ehrApi.get(`/messages/threads/${threadId}`);
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch thread');
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
  }): Promise<Message> {
    try {
      const response = await ehrApi.post('/messages', messageData);
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to send message');
    }
  }

  /**
   * Reply to message
   */
  async replyToMessage(messageId: string, replyText: string): Promise<Message> {
    try {
      const response = await ehrApi.post(`/messages/${messageId}/reply`, { messageText: replyText });
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to reply to message');
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await ehrApi.put(`/messages/${messageId}/read`, {});
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to mark message as read');
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(patientId: string): Promise<number> {
    try {
      const response = await ehrApi.get(`/messages/unread-count`, { params: { patientId } });
      return response.data?.count || response.data || 0;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get unread count');
    }
  }
}

export default new MessagingService();
