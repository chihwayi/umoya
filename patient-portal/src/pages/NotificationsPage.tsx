import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Calendar,
  ChevronLeft,
  CreditCard,
  FlaskConical,
  Pill,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

interface PatientNotification {
  id: string;
  notificationType: string;
  title: string;
  message?: string;
  body?: string;
  read: boolean;
  readAt?: string;
  sentAt?: string;
  createdAt?: string;
}

type FilterKey = 'all' | 'unread' | 'appointment' | 'medication' | 'lab_result' | 'billing' | 'clinical' | 'system';

const PAGE_SIZE = 20;

const FILTER_TABS: Array<{ key: FilterKey; label: string; notificationType?: string; read?: boolean }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread', read: false },
  { key: 'appointment', label: 'Appointments', notificationType: 'appointment' },
  { key: 'medication', label: 'Medications', notificationType: 'medication' },
  { key: 'lab_result', label: 'Lab Results', notificationType: 'lab_result' },
  { key: 'billing', label: 'Billing', notificationType: 'billing' },
  { key: 'clinical', label: 'Clinical', notificationType: 'clinical' },
  { key: 'system', label: 'System', notificationType: 'system' },
];

const typeStyles = (type?: string) => {
  switch (type) {
    case 'appointment':
      return { gradient: 'from-blue-500 to-blue-600', Icon: Calendar };
    case 'medication':
    case 'prescription':
      return { gradient: 'from-purple-500 to-purple-600', Icon: Pill };
    case 'lab_result':
      return { gradient: 'from-emerald-500 to-emerald-600', Icon: FlaskConical };
    case 'billing':
    case 'payment':
      return { gradient: 'from-yellow-500 to-yellow-600', Icon: CreditCard };
    case 'clinical':
    case 'alert':
      return { gradient: 'from-red-500 to-red-600', Icon: AlertCircle };
    default:
      return { gradient: 'from-indigo-500 to-indigo-600', Icon: Bell };
  }
};

const normalizeResponse = (data: any): { notifications: PatientNotification[]; unreadCount: number } => {
  const notifications = Array.isArray(data) ? data : data?.notifications ?? [];
  const unreadCount = typeof data?.unreadCount === 'number'
    ? data.unreadCount
    : notifications.filter((notification: PatientNotification) => !notification.read).length;
  return { notifications, unreadCount };
};

const notificationTime = (notification: PatientNotification) => {
  const value = notification.sentAt ?? notification.createdAt;
  if (!value) return 'Just now';
  try {
    return `${formatDistanceToNow(new Date(value), { addSuffix: true })}`;
  } catch {
    return 'Just now';
  }
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();
  const { token } = usePatientAuth();
  const { showError } = useNotification();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const activeTab = useMemo(
    () => FILTER_TABS.find(tab => tab.key === activeFilter) ?? FILTER_TABS[0],
    [activeFilter],
  );

  const loadNotifications = useCallback(async (nextLimit = limit, isLoadMore = false) => {
    if (!token) return;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await patientPortalApi.getNotifications(token, tenantSlug, {
        limit: nextLimit,
        ...(activeTab.read !== undefined ? { read: activeTab.read } : {}),
        ...(activeTab.notificationType ? { notificationType: activeTab.notificationType } : {}),
      });
      const normalized = normalizeResponse(data);
      setNotifications(normalized.notifications);
      setUnreadCount(normalized.unreadCount);
    } catch {
      showError('Could not load notifications', 'Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab, limit, showError, tenantSlug, token]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
    loadNotifications(PAGE_SIZE);
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadNotifications(PAGE_SIZE);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    const previous = notifications;
    setNotifications(prev => prev.map(notification =>
      notification.id === id ? { ...notification, read: true, readAt: new Date().toISOString() } : notification
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await patientPortalApi.markNotificationAsRead(id, token, tenantSlug);
    } catch {
      setNotifications(previous);
      setUnreadCount(previous.filter(notification => !notification.read).length);
      showError('Could not mark notification read', 'Please try again.');
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    const previous = notifications;
    setNotifications(prev => prev.map(notification => ({ ...notification, read: true, readAt: new Date().toISOString() })));
    setUnreadCount(0);

    try {
      await patientPortalApi.markAllNotificationsAsRead(token, tenantSlug);
    } catch {
      setNotifications(previous);
      setUnreadCount(previous.filter(notification => !notification.read).length);
      showError('Could not mark all notifications read', 'Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!window.confirm('Delete this notification?')) return;

    const previous = notifications;
    const deleted = previous.find(notification => notification.id === id);
    setNotifications(prev => prev.filter(notification => notification.id !== id));
    if (deleted && !deleted.read) setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await patientPortalApi.deleteNotification(id, token, tenantSlug);
    } catch {
      setNotifications(previous);
      setUnreadCount(previous.filter(notification => !notification.read).length);
      showError('Could not delete notification', 'Please try again.');
    }
  };

  const handleLoadMore = () => {
    const nextLimit = limit + PAGE_SIZE;
    setLimit(nextLimit);
    loadNotifications(nextLimit, true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur shadow-sm border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/${tenantSlug}/dashboard`)}
                className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                aria-label="Back to dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 pb-4 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={activeFilter === tab.key
                  ? 'bg-indigo-600 text-white rounded-full px-4 py-1.5 text-sm font-semibold'
                  : 'bg-white border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-sm hover:bg-gray-50'}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="animate-pulse bg-gray-200 rounded-xl h-20 w-full" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-indigo-400" />
            </div>
            <p className="text-gray-900 font-semibold text-lg">All caught up</p>
            <p className="text-gray-500 text-sm mt-1">No notifications here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notification => {
              const { gradient, Icon } = typeStyles(notification.notificationType);
              const unread = !notification.read;
              return (
                <article
                  key={notification.id}
                  className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-start gap-3 ${
                    unread ? 'border-l-4 border-l-indigo-500 bg-indigo-50/30' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900">{notification.title}</h2>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                      {notification.message ?? notification.body ?? ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{notificationTime(notification)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {unread && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(notification.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(notification.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}

            {notifications.length >= limit && (
              <div className="flex justify-center pt-3">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="bg-white border border-gray-200 text-gray-700 rounded-xl px-6 py-2 hover:bg-gray-50 disabled:opacity-60"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <div className="max-w-2xl mx-auto px-4 pb-8">
        <Link to={`/${tenantSlug}/dashboard`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotificationsPage;
