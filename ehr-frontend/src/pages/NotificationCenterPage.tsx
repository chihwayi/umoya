import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, MessageSquare, Mail, Smartphone, Send, RefreshCw, History, CheckCircle, XCircle } from 'lucide-react';
import { notificationCenterApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const SMS_LIMIT = 160;

/**
 * Notification Center — per-tenant automated trigger toggles (SMS/Email per
 * trigger), a manual one-off reminder composer, and the dispatch audit log.
 */
const NotificationCenterPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = React.useMemo(
    () => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''),
    [],
  );
  const { showError, showSuccess } = useNotification();

  const [triggers, setTriggers] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [reminder, setReminder] = useState({
    recipient: '',
    channel: 'sms' as 'sms' | 'email',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);

  const loadAll = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [triggersResponse, logResponse] = await Promise.all([
        notificationCenterApi.getTriggers(tenantSlug, token),
        notificationCenterApi.getLog(tenantSlug, token, { limit: 50 }),
      ]);
      setTriggers(Array.isArray(triggersResponse.data) ? triggersResponse.data : []);
      setLog(Array.isArray(logResponse.data) ? logResponse.data : []);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to load notification settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, showError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleChannel = async (triggerKey: string, channel: 'sms' | 'email', enabled: boolean) => {
    if (!tenantSlug) return;
    setSavingKey(triggerKey);
    try {
      const body = channel === 'sms' ? { smsEnabled: enabled } : { emailEnabled: enabled };
      const response = await notificationCenterApi.updateTrigger(tenantSlug, token, triggerKey, body);
      setTriggers((prev) => prev.map((t) => (t.triggerKey === triggerKey ? response.data : t)));
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update trigger', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSendReminder = async () => {
    if (!tenantSlug) return;
    if (!reminder.recipient.trim() || !reminder.message.trim()) {
      showError('Recipient and message are required', 'error');
      return;
    }
    setSending(true);
    try {
      const response = await notificationCenterApi.sendManualReminder(tenantSlug, token, {
        recipient: reminder.recipient.trim(),
        channel: reminder.channel,
        subject: reminder.channel === 'email' ? reminder.subject || undefined : undefined,
        message: reminder.message.trim(),
      });
      if (response.data?.status === 'sent') {
        showSuccess('Reminder sent', 'success');
      } else {
        showError('Reminder could not be delivered — see the audit log', 'error');
      }
      setReminder((prev) => ({ ...prev, message: '' }));
      loadAll();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to send reminder', 'error');
    } finally {
      setSending(false);
    }
  };

  const ChannelToggle: React.FC<{ trigger: any; channel: 'sms' | 'email' }> = ({ trigger, channel }) => {
    const enabled = channel === 'sms' ? trigger.smsEnabled : trigger.emailEnabled;
    const Icon = channel === 'sms' ? Smartphone : Mail;
    return (
      <button
        onClick={() => toggleChannel(trigger.triggerKey, channel, !enabled)}
        disabled={savingKey === trigger.triggerKey}
        className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border transition-colors disabled:opacity-50 ${
          enabled
            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
            : 'bg-white/5 text-white/40 border-white/10 line-through'
        }`}
        title={`${enabled ? 'Disable' : 'Enable'} ${channel.toUpperCase()} for this trigger`}
      >
        <Icon className="w-3 h-3" />
        {channel === 'sms' ? 'SMS' : 'Email'}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          <button
            onClick={loadAll}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <p className="text-white/60 mb-8">
          Manage automated notifications sent to patients for appointments, payments, and reminders.
        </p>

        {/* Automated triggers */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Automated Notification Triggers</h2>
          </div>
          <p className="text-white/50 text-sm mb-6">
            These notifications are sent automatically when the corresponding events occur in the system.
          </p>

          {loading ? (
            <p className="text-white/50 py-6 text-center">Loading…</p>
          ) : (
            <div className="divide-y divide-white/5">
              {triggers.map((trigger) => (
                <div key={trigger.triggerKey} className="py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold">{trigger.label}</p>
                    <p className="text-white/50 text-sm">{trigger.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ChannelToggle trigger={trigger} channel="sms" />
                    <ChannelToggle trigger={trigger} channel="email" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual reminder */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Send Manual Reminder</h2>
          </div>
          <p className="text-white/50 text-sm mb-6">Send a one-off SMS or email reminder to a specific recipient.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className={reminder.channel === 'email' ? '' : 'md:col-span-2'}>
              <label className="block text-white/60 text-sm mb-2">
                {reminder.channel === 'sms' ? 'Phone Number' : 'Email Address'}
              </label>
              <input
                type="text"
                value={reminder.recipient}
                onChange={(e) => setReminder({ ...reminder, recipient: e.target.value })}
                placeholder={reminder.channel === 'sms' ? '+263 77…' : 'patient@example.com'}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-2">Channel</label>
              <select
                value={reminder.channel}
                onChange={(e) => setReminder({ ...reminder, channel: e.target.value as 'sms' | 'email' })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              >
                <option value="sms">SMS Only</option>
                <option value="email">Email Only</option>
              </select>
            </div>
            {reminder.channel === 'email' && (
              <div>
                <label className="block text-white/60 text-sm mb-2">Subject</label>
                <input
                  type="text"
                  value={reminder.subject}
                  onChange={(e) => setReminder({ ...reminder, subject: e.target.value })}
                  placeholder="Reminder"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30"
                />
              </div>
            )}
          </div>

          <label className="block text-white/60 text-sm mb-2">Message</label>
          <textarea
            value={reminder.message}
            onChange={(e) => setReminder({ ...reminder, message: e.target.value })}
            rows={4}
            maxLength={reminder.channel === 'sms' ? SMS_LIMIT : undefined}
            placeholder="Type your reminder message here…"
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-white/40 text-xs">
              {reminder.channel === 'sms' ? `${reminder.message.length}/${SMS_LIMIT} characters (SMS limit)` : ''}
            </p>
            <button
              onClick={handleSendReminder}
              disabled={sending || !reminder.recipient.trim() || !reminder.message.trim()}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending…' : 'Send Reminder'}
            </button>
          </div>
        </div>

        {/* Audit log */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Recent Notifications</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/50 text-left border-b border-white/10">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Trigger</th>
                  <th className="py-2 pr-4">Channel</th>
                  <th className="py-2 pr-4">Recipient</th>
                  <th className="py-2 pr-4">Message</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-white/40">No notifications sent yet.</td></tr>
                ) : (
                  log.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-white/60 whitespace-nowrap">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
                      </td>
                      <td className="py-2 pr-4 text-white/80">{String(entry.triggerKey || '').replace(/_/g, ' ')}</td>
                      <td className="py-2 pr-4 text-white/80 uppercase">{entry.channel}</td>
                      <td className="py-2 pr-4 text-white/80">{entry.recipient}</td>
                      <td className="py-2 pr-4 text-white/60 max-w-xs truncate" title={entry.body}>{entry.body}</td>
                      <td className="py-2">
                        {entry.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 text-green-400"><CheckCircle className="w-3.5 h-3.5" /> Sent</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400" title={entry.error || ''}><XCircle className="w-3.5 h-3.5" /> {entry.status}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenterPage;
