import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

type TabKey = 'send' | 'templates' | 'ussd';

interface MessagingDashboardProps {
  tenantSlug?: string;
  token?: string;
}

interface MessageLog {
  id: string;
  channel: string;
  direction: string;
  phoneNumber: string;
  messageText: string;
  messageType: string | null;
  status: string;
  atMessageId: string | null;
  failureReason: string | null;
  sentAt: string;
  deliveredAt: string | null;
}

interface NotificationTemplate {
  id: string;
  templateKey: string;
  channel: string;
  language: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
}

interface UssdSession {
  id: string;
  phoneNumber: string;
  sessionId: string;
  serviceCode: string | null;
  currentMenu: string | null;
  ended: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function MessagingDashboard({ tenantSlug, token }: MessagingDashboardProps) {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [activeTab, setActiveTab] = useState<TabKey>('send');

  // Send SMS form
  const [smsTo, setSmsTo] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Logs
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsChannel, setLogsChannel] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<NotificationTemplate> | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // USSD sessions
  const [sessions, setSessions] = useState<UssdSession[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchLogs = useCallback(async () => {
    if (!tenantSlug) return;
    setLogsLoading(true);
    try {
      const params: any = { page: logsPage, limit: 20 };
      if (logsChannel) params.channel = logsChannel;
      const { data } = await ehrAxios.get(`/at/logs`, {
        headers,
        params,
      });
      setLogs(data.data ?? []);
      setLogsTotal(data.total ?? 0);
    } catch {
      showError('Logs Error', 'Failed to load message logs');
    } finally {
      setLogsLoading(false);
    }
  }, [tenantSlug, logsPage, logsChannel, token]);

  const fetchTemplates = useCallback(async () => {
    if (!tenantSlug) return;
    setTemplatesLoading(true);
    try {
      const { data } = await ehrAxios.get(`/at/templates`, { headers });
      setTemplates(data ?? []);
    } catch {
      showError('Templates Error', 'Failed to load notification templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, [tenantSlug, token]);

  const fetchSessions = useCallback(async () => {
    if (!tenantSlug) return;
    setSessionsLoading(true);
    try {
      const { data } = await ehrAxios.get(`/at/ussd/sessions`, {
        headers,
        params: { page: sessionsPage, limit: 20 },
      });
      setSessions(data.data ?? []);
      setSessionsTotal(data.total ?? 0);
    } catch {
      showError('USSD Error', 'Failed to load USSD sessions');
    } finally {
      setSessionsLoading(false);
    }
  }, [tenantSlug, sessionsPage, token]);

  useEffect(() => {
    if (activeTab === 'send') fetchLogs();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'ussd') fetchSessions();
  }, [activeTab, logsPage, sessionsPage]);

  const handleSendSms = async () => {
    if (!smsTo.trim() || !smsMessage.trim()) {
      showError('Validation', 'Phone number and message are required');
      return;
    }
    setSendingMsg(true);
    try {
      const { data } = await ehrAxios.post(
        `/at/sms/send`,
        { to: smsTo.trim(), message: smsMessage.trim() },
        { headers },
      );
      if (data.success) {
        showSuccess('SMS Sent', `Delivered to ${data.messageIds.length} recipient(s)`);
      } else {
        showError('SMS Failed', `Failed for: ${data.failures.join(', ')}`);
      }
      setSmsTo('');
      setSmsMessage('');
      fetchLogs();
    } catch {
      showError('Send Error', 'Failed to send SMS');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate?.templateKey || !editingTemplate?.bodyTemplate) {
      showError('Validation', 'Template key and body are required');
      return;
    }
    setSavingTemplate(true);
    try {
      await ehrAxios.put(`/at/templates`, editingTemplate, { headers });
      showSuccess('Saved', 'Template saved successfully');
      setEditingTemplate(null);
      fetchTemplates();
    } catch {
      showError('Save Error', 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      sent: 'bg-blue-500/20 text-blue-300',
      delivered: 'bg-emerald-500/20 text-emerald-300',
      failed: 'bg-red-500/20 text-red-300',
      received: 'bg-purple-500/20 text-purple-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-slate-700 text-slate-300'}`}>
        {status}
      </span>
    );
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'send', label: 'Send & Logs', icon: <MessageSquare size={16} /> },
    { key: 'templates', label: 'Templates', icon: <FileText size={16} /> },
    { key: 'ussd', label: 'USSD Sessions', icon: <Phone size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold">Africa's Talking — SMS & USSD</h1>
            <p className="text-sm text-slate-400">{tenantSlug}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ── Send & Logs ───────────────────────────────────────────────── */}
        {activeTab === 'send' && (
          <div className="space-y-6">
            {/* Send SMS panel */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Send size={16} className="text-blue-400" />
                Send SMS
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Recipient phone number</label>
                  <input
                    type="text"
                    value={smsTo}
                    onChange={(e) => setSmsTo(e.target.value)}
                    placeholder="+254712345678"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-1" />
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Message</label>
                  <textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    rows={3}
                    maxLength={160}
                    placeholder="Message text (160 chars)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  <div className="text-right text-xs text-slate-500 mt-1">{smsMessage.length}/160</div>
                </div>
              </div>
              <button
                onClick={handleSendSms}
                disabled={sendingMsg}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                <Send size={14} />
                {sendingMsg ? 'Sending…' : 'Send SMS'}
              </button>
            </div>

            {/* Message Logs */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Message Logs</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={logsChannel}
                    onChange={(e) => { setLogsChannel(e.target.value); setLogsPage(1); }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100"
                  >
                    <option value="">All channels</option>
                    <option value="sms">SMS</option>
                    <option value="ussd">USSD</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                  <button
                    onClick={fetchLogs}
                    disabled={logsLoading}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <RefreshCw size={14} className={logsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-slate-800">
                      <th className="text-left py-2 pr-3">Channel</th>
                      <th className="text-left py-2 pr-3">Dir</th>
                      <th className="text-left py-2 pr-3">Phone</th>
                      <th className="text-left py-2 pr-3">Message</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2">Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-2 pr-3 capitalize">{log.channel}</td>
                        <td className="py-2 pr-3">
                          <span className={`text-xs ${log.direction === 'outbound' ? 'text-blue-400' : 'text-purple-400'}`}>
                            {log.direction}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{log.phoneNumber}</td>
                        <td className="py-2 pr-3 text-slate-400 max-w-xs truncate" title={log.messageText}>
                          {log.messageText}
                        </td>
                        <td className="py-2 pr-3">{statusBadge(log.status)}</td>
                        <td className="py-2 text-xs text-slate-400">
                          {new Date(log.sentAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && !logsLoading && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                          No messages yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {logsTotal > 20 && (
                <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
                  <span>{logsTotal} total</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                      disabled={logsPage === 1}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1">Page {logsPage}</span>
                    <button
                      onClick={() => setLogsPage((p) => p + 1)}
                      disabled={logsPage * 20 >= logsTotal}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Templates ─────────────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Notification Templates</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setEditingTemplate({
                      templateKey: '',
                      channel: 'sms',
                      language: 'en',
                      bodyTemplate: '',
                      isActive: true,
                    })
                  }
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  + New Template
                </button>
                <button
                  onClick={fetchTemplates}
                  disabled={templatesLoading}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw size={14} className={templatesLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Edit form */}
            {editingTemplate && (
              <div className="bg-slate-900/60 border border-blue-500/30 rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4">
                  {editingTemplate.id ? 'Edit Template' : 'New Template'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Template Key</label>
                    <input
                      type="text"
                      value={editingTemplate.templateKey ?? ''}
                      onChange={(e) => setEditingTemplate((t) => ({ ...t!, templateKey: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                      placeholder="appointment_reminder"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Channel</label>
                    <select
                      value={editingTemplate.channel ?? 'sms'}
                      onChange={(e) => setEditingTemplate((t) => ({ ...t!, channel: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="sms">SMS</option>
                      <option value="ussd">USSD</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Language</label>
                    <input
                      type="text"
                      value={editingTemplate.language ?? 'en'}
                      onChange={(e) => setEditingTemplate((t) => ({ ...t!, language: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-slate-400 mb-1">
                      Body Template (use {'{{variableName}}'} for placeholders)
                    </label>
                    <textarea
                      value={editingTemplate.bodyTemplate ?? ''}
                      onChange={(e) => setEditingTemplate((t) => ({ ...t!, bodyTemplate: e.target.value }))}
                      rows={4}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none font-mono"
                      placeholder="Hello {{patientName}}, your appointment is on {{appointmentDate}}."
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    {savingTemplate ? 'Saving…' : 'Save Template'}
                  </button>
                  <button
                    onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Templates list */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-800 bg-slate-900/50">
                    <th className="text-left px-4 py-3">Key</th>
                    <th className="text-left px-4 py-3">Channel</th>
                    <th className="text-left px-4 py-3">Lang</th>
                    <th className="text-left px-4 py-3">Body Preview</th>
                    <th className="text-left px-4 py-3">Active</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tmpl) => (
                    <tr key={tmpl.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-2 font-mono text-xs text-blue-300">{tmpl.templateKey}</td>
                      <td className="px-4 py-2 capitalize">{tmpl.channel}</td>
                      <td className="px-4 py-2 uppercase text-xs">{tmpl.language}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs max-w-xs truncate" title={tmpl.bodyTemplate}>
                        {tmpl.bodyTemplate}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${tmpl.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {tmpl.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setEditingTemplate(tmpl)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && !templatesLoading && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                        No templates configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USSD Sessions ─────────────────────────────────────────────── */}
        {activeTab === 'ussd' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">USSD Sessions</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sessions initiated via Africa's Talking USSD gateway
                </p>
              </div>
              <button
                onClick={fetchSessions}
                disabled={sessionsLoading}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <RefreshCw size={14} className={sessionsLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-800 bg-slate-900/50">
                    <th className="text-left px-4 py-3">Phone</th>
                    <th className="text-left px-4 py-3">Session ID</th>
                    <th className="text-left px-4 py-3">Service Code</th>
                    <th className="text-left px-4 py-3">Current Menu</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-2 font-mono text-xs">{s.phoneNumber}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-400 max-w-[160px] truncate" title={s.sessionId}>
                        {s.sessionId}
                      </td>
                      <td className="px-4 py-2 text-xs">{s.serviceCode ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-slate-300">{s.currentMenu ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            s.ended
                              ? 'bg-slate-700 text-slate-400'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {s.ended ? 'Ended' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && !sessionsLoading && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                        No USSD sessions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {sessionsTotal > 20 && (
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>{sessionsTotal} total</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSessionsPage((p) => Math.max(1, p - 1))}
                    disabled={sessionsPage === 1}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1">Page {sessionsPage}</span>
                  <button
                    onClick={() => setSessionsPage((p) => p + 1)}
                    disabled={sessionsPage * 20 >= sessionsTotal}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Webhook info */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">
              <p className="font-medium text-slate-300 mb-1">USSD Callback URL</p>
              <code className="bg-slate-800 px-2 py-1 rounded font-mono">
                POST {'{EHR_BASE_URL}'}/at/ussd/callback?tenantId={'{tenantId}'}
              </code>
              <p className="mt-2">Configure this URL in your Africa's Talking dashboard under USSD → Callback URL.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
