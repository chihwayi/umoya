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

interface PatientPortalMessage {
  id: string;
  senderId?: string;
  sender_id?: string;
  senderType?: string;
  sender_type?: string;
  recipientId?: string;
  recipient_id?: string;
  subject?: string;
  message?: string;
  messageType?: string;
  message_type?: string;
  priority?: 'normal' | 'urgent';
  read?: boolean;
  readAt?: string;
  read_at?: string;
  attachments?: { name: string; url: string; type: string }[];
  createdAt?: string;
  created_at?: string;
  parentMessageId?: string;
  parent_message_id?: string;
}

function mapPatientMessage(message: PatientPortalMessage): ApiMessage {
  const senderType = message.senderType ?? message.sender_type;
  return {
    id: message.id,
    senderId: message.senderId ?? message.sender_id ?? '',
    senderRole: senderType,
    recipientId: message.recipientId ?? message.recipient_id,
    subject: message.subject,
    body: message.message ?? '',
    messageType: (message.messageType ?? message.message_type ?? 'direct') as ApiMessage['messageType'],
    priority: message.priority ?? 'normal',
    isRead: message.read,
    attachments: message.attachments,
    sentAt: message.createdAt ?? message.created_at ?? new Date().toISOString(),
    readAt: message.readAt ?? message.read_at,
    threadId: message.parentMessageId ?? message.parent_message_id,
  };
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

  patientInbox: (filters: Record<string, string> = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return api.get<{ messages: PatientPortalMessage[]; total: number }>(`/patient-portal/messages${qs ? '?' + qs : ''}`)
      .then(r => ({
        messages: (r.data.messages ?? []).map(mapPatientMessage),
        total: r.data.total ?? 0,
      }));
  },

  patientUnreadCount: () =>
    MessagesService.patientInbox({ read: 'false', limit: '1' }).then(r => r.total),

  patientSend: (dto: { recipientId: string; recipientType: string; subject?: string; body: string; messageType?: string; priority?: string }) =>
    api.post<ApiMessage>('/patient-portal/messages', {
      recipientId: dto.recipientId,
      recipientType: dto.recipientType,
      subject: dto.subject,
      message: dto.body,
      messageType: dto.messageType,
      priority: dto.priority,
    }).then(r => mapPatientMessage(r.data as any)),

  patientMarkRead: (id: string) =>
    api.put<void>(`/patient-portal/messages/${id}/read`, {}).then(r => r.data),
};
