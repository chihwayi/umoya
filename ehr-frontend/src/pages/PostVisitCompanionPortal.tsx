import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, MessageSquare, RefreshCw, ShieldCheck } from 'lucide-react';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

type PostVisitSessionItem = {
  id: string;
  status: string;
  publishedAt?: string | null;
  summarySnippet?: string | null;
  checklistCount?: number;
};

type PostVisitSummaryPayload = {
  summary?: {
    plainLanguageSummary?: string;
    keyPoints?: string[];
  };
  checklist?: Array<{
    id?: string | null;
    title?: string | null;
    description?: string | null;
    urgency?: string;
    completed?: boolean;
  }>;
};

type CompanionMessage = {
  id: string;
  senderType: 'patient' | 'system' | string;
  messageType: string;
  message: string;
  createdAt: string;
  escalationDetected?: boolean;
  escalationEventId?: string | null;
};

const PostVisitCompanionPortal: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();

  const [token, setToken] = useState<string>(() => localStorage.getItem('patient_portal_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [sessions, setSessions] = useState<PostVisitSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [summaryPayload, setSummaryPayload] = useState<PostVisitSummaryPayload | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [lastEscalation, setLastEscalation] = useState<{
    id: string;
    severity: string;
    routeTarget: string;
    signalText?: string | null;
  } | null>(null);

  const hasAccess = Boolean(tenantSlug && token);

  const loadSessions = useCallback(async () => {
    if (!tenantSlug || !token) {
      return;
    }
    try {
      setSessionsLoading(true);
      const response = await patientPortalApi.getPostVisitSessions(token, tenantSlug, { limit: 20, offset: 0 });
      const sessionRows = Array.isArray(response.data?.sessions) ? response.data.sessions : [];
      setSessions(sessionRows);
      if (!selectedSessionId && sessionRows.length > 0) {
        setSelectedSessionId(sessionRows[0].id);
      }
    } catch {
      showError('Post-visit companion', 'Unable to load published post-visit sessions.');
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [selectedSessionId, showError, tenantSlug, token]);

  const loadSessionDetail = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) {
      return;
    }
    try {
      setChatLoading(true);
      const [summaryResponse, messagesResponse] = await Promise.all([
        patientPortalApi.getPostVisitSummary(selectedSessionId, token, tenantSlug),
        patientPortalApi.getPostVisitMessages(selectedSessionId, token, tenantSlug, { limit: 150, offset: 0 }),
      ]);

      setSummaryPayload(summaryResponse.data || null);
      setMessages(Array.isArray(messagesResponse.data?.messages) ? messagesResponse.data.messages : []);
      setLastEscalation(null);
    } catch {
      showError('Post-visit companion', 'Unable to load summary or companion messages.');
      setSummaryPayload(null);
      setMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, [selectedSessionId, showError, tenantSlug, token]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }
    loadSessions();
  }, [hasAccess, loadSessions]);

  useEffect(() => {
    if (!hasAccess || !selectedSessionId) {
      return;
    }
    loadSessionDetail();
  }, [hasAccess, loadSessionDetail, selectedSessionId]);

  const handlePatientLogin = useCallback(async () => {
    if (!tenantSlug || !email || !password) {
      showError('Patient login', 'Tenant, email, and password are required.');
      return;
    }
    try {
      setAuthLoading(true);
      const response = await patientPortalApi.patientLogin(email, password, tenantSlug);
      const nextToken =
        response.data?.token ||
        response.data?.accessToken ||
        response.data?.jwt ||
        response.data?.data?.token ||
        '';
      if (!nextToken) {
        throw new Error('No access token returned by patient portal login');
      }
      localStorage.setItem('patient_portal_token', nextToken);
      setToken(nextToken);
      showSuccess('Patient login', 'Patient companion access granted.');
    } catch {
      showError('Patient login failed', 'Invalid credentials or missing patient portal setup.');
    } finally {
      setAuthLoading(false);
    }
  }, [email, password, showError, showSuccess, tenantSlug]);

  const handleSendMessage = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId || !draftMessage.trim()) {
      return;
    }
    try {
      setSending(true);
      const response = await patientPortalApi.sendPostVisitMessage(
        selectedSessionId,
        {
          message: draftMessage.trim(),
          messageType: 'question',
        },
        token,
        tenantSlug,
      );

      const patientMessage = response.data?.patientMessage;
      const assistantMessage = response.data?.assistantMessage;
      const appended: CompanionMessage[] = [];
      if (patientMessage?.id) {
        appended.push({
          id: patientMessage.id,
          senderType: 'patient',
          messageType: patientMessage.messageType || 'question',
          message: patientMessage.message || '',
          createdAt: patientMessage.createdAt || new Date().toISOString(),
          escalationDetected: Boolean(patientMessage.escalationDetected),
          escalationEventId: patientMessage.escalationEventId || null,
        });
      }
      if (assistantMessage?.id) {
        appended.push({
          id: assistantMessage.id,
          senderType: 'system',
          messageType: assistantMessage.messageType || 'answer',
          message: assistantMessage.message || '',
          createdAt: assistantMessage.createdAt || new Date().toISOString(),
        });
      }
      if (appended.length > 0) {
        setMessages((previous) => [...previous, ...appended]);
      } else {
        await loadSessionDetail();
      }

      const escalation = response.data?.escalation;
      if (escalation?.id) {
        setLastEscalation({
          id: escalation.id,
          severity: String(escalation.severity || 'high'),
          routeTarget: String(escalation.routeTarget || 'doctor'),
          signalText: escalation.signalText || null,
        });
      } else {
        setLastEscalation(null);
      }

      setDraftMessage('');
    } catch {
      showError('Companion message failed', 'Unable to send message. Please retry.');
    } finally {
      setSending(false);
    }
  }, [draftMessage, loadSessionDetail, selectedSessionId, showError, tenantSlug, token]);

  const handleAcknowledge = useCallback(
    async (
      acknowledgementType:
        | 'teach_back'
        | 'medication_adherence'
        | 'follow_up_commitment'
        | 'warning_sign_understanding',
    ) => {
      if (!tenantSlug || !token || !selectedSessionId) {
        return;
      }
      try {
        await patientPortalApi.acknowledgePostVisit(
          selectedSessionId,
          {
            acknowledgementType,
            acknowledged: true,
            details: { source: 'post_visit_companion_portal' },
          },
          token,
          tenantSlug,
        );
        showSuccess('Acknowledgement saved', `Recorded ${acknowledgementType.replace(/_/g, ' ')} acknowledgement.`);
      } catch {
        showError('Acknowledgement failed', 'Could not save acknowledgement.');
      }
    },
    [selectedSessionId, showError, showSuccess, tenantSlug, token],
  );

  const selectedSessionLabel = useMemo(() => {
    const selected = sessions.find((session) => session.id === selectedSessionId);
    if (!selected) {
      return 'No session selected';
    }
    return selected.publishedAt ? `Published ${new Date(selected.publishedAt).toLocaleString()}` : selected.status;
  }, [selectedSessionId, sessions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="rounded-2xl border border-cyan-200 bg-white p-4 sm:p-5">
          <h1 className="text-xl font-bold text-slate-900">Post-Visit AI Companion</h1>
          <p className="text-sm text-slate-600">
            Patient-safe summary, checklist, and grounded follow-up messaging with safety escalation detection.
          </p>
        </div>

        {!hasAccess && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 max-w-lg">
            <h2 className="text-sm font-semibold text-slate-900">Patient Portal Login</h2>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Patient email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={authLoading || !tenantSlug}
              onClick={handlePatientLogin}
              className="px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-60"
            >
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        )}

        {hasAccess && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <aside className="xl:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Published Sessions</h2>
                <button
                  type="button"
                  onClick={loadSessions}
                  className="text-xs font-semibold text-cyan-700 inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <div className="space-y-2">
                {sessionsLoading && <p className="text-xs text-slate-500">Loading sessions...</p>}
                {!sessionsLoading && sessions.length === 0 && (
                  <p className="text-xs text-slate-500">No published post-visit sessions found.</p>
                )}
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2 ${
                      selectedSessionId === session.id ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900 truncate">{session.summarySnippet || 'Post-visit summary'}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {session.publishedAt ? new Date(session.publishedAt).toLocaleDateString() : session.status}
                      {' • '}
                      {session.checklistCount ?? 0} checklist items
                    </p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Companion Session</h2>
                  <p className="text-xs text-slate-500">{selectedSessionLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={loadSessionDetail}
                  disabled={!selectedSessionId || chatLoading}
                  className="text-xs font-semibold text-cyan-700 inline-flex items-center gap-1 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${chatLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {lastEscalation && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2">
                  <p className="text-sm font-semibold text-rose-800 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Escalation routed to {lastEscalation.routeTarget}
                  </p>
                  <p className="text-xs text-rose-700 mt-1">
                    Severity: {lastEscalation.severity} • Event: {lastEscalation.id}
                  </p>
                </div>
              )}

              {summaryPayload?.summary && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Doctor-approved summary
                  </p>
                  <p className="text-sm text-slate-700 mt-2">{summaryPayload.summary.plainLanguageSummary || 'No summary available.'}</p>
                  {(summaryPayload.summary.keyPoints || []).length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {(summaryPayload.summary.keyPoints || []).map((point, index) => (
                        <li key={`summary-point-${index}`} className="text-xs text-slate-600">
                          • {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {(summaryPayload?.checklist || []).length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">Follow-up checklist</p>
                  <div className="mt-2 space-y-2">
                    {(summaryPayload?.checklist || []).map((item, index) => (
                      <div key={item.id || `checklist-${index}`} className="rounded-lg border border-slate-200 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{item.title || 'Checklist item'}</p>
                        <p className="text-xs text-slate-600 mt-1">{item.description || 'No description'}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Urgency: {item.urgency || 'routine'} • Status: {item.completed ? 'completed' : 'pending'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-700" />
                  Companion chat
                </p>
                <div className="mt-3 max-h-72 overflow-y-auto space-y-2">
                  {messages.length === 0 && <p className="text-xs text-slate-500">No messages yet.</p>}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg px-3 py-2 ${
                        message.senderType === 'patient' ? 'bg-cyan-50 border border-cyan-200' : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-700">
                        {message.senderType === 'patient' ? 'You' : 'Companion'} • {new Date(message.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-800 mt-1">{message.message}</p>
                      {message.escalationDetected && (
                        <p className="text-[11px] text-rose-700 mt-1">Escalation detected: {message.escalationEventId || 'pending id'}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={sending || !draftMessage.trim() || !selectedSessionId}
                    onClick={handleSendMessage}
                    className="px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-60"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm font-semibold text-slate-900">Patient acknowledgement</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAcknowledge('teach_back')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                    Teach-back
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcknowledge('medication_adherence')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Medication adherence
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcknowledge('follow_up_commitment')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Follow-up commitment
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcknowledge('warning_sign_understanding')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Warning-sign understanding
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostVisitCompanionPortal;
