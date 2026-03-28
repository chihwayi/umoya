import { api } from './api';

export interface ApiStaffNotification {
  id: string;
  type?: string;
  category?: 'critical' | 'message' | 'system';
  title?: string;
  body?: string;
  message?: string;
  isRead?: boolean;
  read?: boolean;
  createdAt?: string;
  sentAt?: string;
}

export interface StaffNotificationsResponse {
  notifications?: ApiStaffNotification[];
  items?: ApiStaffNotification[];
  unreadCount?: number;
}

export const StaffNotificationsService = {
  list: (opts: { read?: boolean; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.read !== undefined) params.set('read', String(opts.read));
    if (opts.limit)              params.set('limit', String(opts.limit));
    const qs = params.toString();
    return api
      .get<StaffNotificationsResponse | ApiStaffNotification[]>(`/staff-notifications${qs ? '?' + qs : ''}`)
      .then(r => {
        const data = r.data;
        if (Array.isArray(data)) return data;
        return data.notifications ?? data.items ?? [];
      });
  },

  markRead: (id: string) =>
    api.patch<void>(`/staff-notifications/${id}/read`, {}).then(r => r.data),

  markAllRead: () =>
    api.patch<void>('/staff-notifications/read-all', {}).then(r => r.data),
};
