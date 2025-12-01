import { useState, useEffect, useCallback } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from './useTenantSlug';
import { patientPortalApi } from '../services/api';

interface Notification {
  id: string;
  notificationType: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: string;
  read: boolean;
  readAt?: string;
  sentAt: string;
  expiresAt?: string;
  metadata?: any;
}

export const useNotifications = (pollInterval: number = 30000) => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!token) return;

    try {
      const data = await patientPortalApi.getNotifications(token, tenantSlug, { limit: 50 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, tenantSlug]);

  useEffect(() => {
    loadNotifications();

    // Poll for new notifications
    const interval = setInterval(() => {
      loadNotifications();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [loadNotifications, pollInterval]);

  const markAsRead = useCallback(async (id: string) => {
    if (!token) return;

    try {
      await patientPortalApi.markNotificationAsRead(id, token, tenantSlug);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [token, tenantSlug]);

  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    try {
      await patientPortalApi.markAllNotificationsAsRead(token, tenantSlug);
      setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [token, tenantSlug]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!token) return;

    try {
      await patientPortalApi.deleteNotification(id, token, tenantSlug);
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      console.error('Failed to delete notification:', err);
    }
  }, [token, tenantSlug, notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
};

