import { api } from './api';

export interface ApiMessage {
  id: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  recipientId?: string;
  recipientName?: string;
  subject?: string;
  body: string;
  messageType?: 'direct' | 'group' | 'broadcast';
  priority?: 'normal' | 'urgent';
  isRead?: boolean;
  attachments?: { name: string; url: string; type: string }[];
  sentAt: string;
  readAt?: string;
  threadId?: string;
}

export interface SendMessageDto {
  recipient_id?: string;
  subject?: string;
  body: string;
  message_type?: 'direct' | 'group';
  priority?: 'normal' | 'urgent';
  thread_id?: string;
}

export const MessagesService = {
  inbox: (filters: Record<string, string> = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return api.get<ApiMessage[]>(`/messages/inbox${qs ? '?' + qs : ''}`).then(r => r.data);
  },

  sent: () =>
    api.get<ApiMessage[]>('/messages/sent').then(r => r.data),

  unreadCount: () =>
    api.get<{ count: number }>('/messages/unread-count').then(r => r.data.count),

  send: (dto: SendMessageDto) =>
    api.post<ApiMessage>('/messages', dto).then(r => r.data),

  markRead: (id: string) =>
    api.put<void>(`/messages/${id}/read`, {}).then(r => r.data),

  thread: (threadId: string) =>
    api.get<ApiMessage[]>(`/messages/thread/${threadId}`).then(r => r.data),
};
