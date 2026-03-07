import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  LogOut,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { LabTrendChart, LabTrendItem } from '../components/LabTrendChart';

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

type ClinicianContext = {
  role?: string;
} | null;

const PostVisitCompanionPortal: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
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
  const [labTrends, setLabTrends] = useState<LabTrendItem[]>([]);

  const messageListRef = useRef<HTMLDivElement | null>(null);

  const clinicianContext = useMemo<ClinicianContext>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem('ehr_user');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const hasAccess = Boolean(tenantSlug && token);
  const checklistItems = Array.isArray(summaryPayload?.checklist) ? summaryPayload!.checklist! : [];
  const checklistCompleted = checklistItems.filter((item) => Boolean(item.completed)).length;
  const pendingChecklistCount = Math.max(checklistItems.length - checklistCompleted, 0);

  const getUrgencyBadgeClass = useCallback((urgency?: string) => {
    const normalized = String(urgency || 'routine').toLowerCase();
    if (normalized === 'stat') {
      return 'border-rose-300 bg-rose-100 text-rose-700';
    }
    if (normalized === 'urgent') {
      return 'border-amber-300 bg-amber-100 text-amber-700';
    }
    return 'border-slate-300 bg-slate-100 text-slate-700';
  }, []);

  const handleBackToWorkspace = useCallback(() => {
    if (!tenantSlug) {
      return;
    }
    const role = String(clinicianContext?.role || '').toLowerCase();
    if (role === 'doctor') {
      navigate(`/ehr/${tenantSlug}/doctor`);
      return;
    }
    if (role === 'nurse' || role === 'nurse_accounts') {
      navigate(`/ehr/${tenantSlug}/nurse`);
      return;
    }
    navigate(`/ehr/${tenantSlug}/dashboard`);
  }, [clinicianContext?.role, navigate, tenantSlug]);

  const handlePortalSignOut = useCallback(() => {
    localStorage.removeItem('patient_portal_token');
    setToken('');
    setSessions([]);
    setSelectedSessionId(null);
    setSummaryPayload(null);
    setMessages([]);
    setLastEscalation(null);
    setDraftMessage('');
    showSuccess('Signed out', 'Patient companion session closed.');
  }, [showSuccess]);

  const loadSessions = useCallback(async () => {
    if (!tenantSlug || !token) {
      return;
    }
    try {
      setSessionsLoading(true);
      const response = await patientPortalApi.getPostVisitSessions(token, tenantSlug, { limit: 20, offset: 0 });
      const sessionRows: PostVisitSessionItem[] = Array.isArray(response.data?.sessions)
        ? (response.data.sessions as PostVisitSessionItem[])
        : [];
      setSessions(sessionRows);
      if (sessionRows.length === 0) {
        setSelectedSessionId(null);
        return;
      }
      const hasSelected = selectedSessionId && sessionRows.some((session) => session.id === selectedSessionId);
      if (!hasSelected) {
        setSelectedSessionId(sessionRows[0].id);
      }
    } catch {
      showError('Post-visit companion', 'Unable to load published post-visit sessions.');
      setSessions([]);
      setSelectedSessionId(null);
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
      const [summaryResponse, messagesResponse, labTrendsResponse] = await Promise.all([
        patientPortalApi.getPostVisitSummary(selectedSessionId, token, tenantSlug),
        patientPortalApi.getPostVisitMessages(selectedSessionId, token, tenantSlug, { limit: 150, offset: 0 }),
        patientPortalApi.getPostVisitLabTrends(selectedSessionId, token, tenantSlug).catch(() => ({ trends: [] })),
      ]);

      setSummaryPayload(summaryResponse.data || null);
      setMessages(Array.isArray(messagesResponse.data?.messages) ? messagesResponse.data.messages : []);
      setLastEscalation(null);
      setLabTrends(Array.isArray(labTrendsResponse?.trends) ? labTrendsResponse.trends : []);
    } catch {
      showError('Post-visit companion', 'Unable to load summary or companion messages.');
      setSummaryPayload(null);
      setMessages([]);
      setLabTrends([]);
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

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }
    messageListRef.current.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length]);

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
    const trimmed = draftMessage.trim();
    if (!tenantSlug || !token || !selectedSessionId || !trimmed) {
      return;
    }
    try {
      setSending(true);
      const response = await patientPortalApi.sendPostVisitMessage(
        selectedSessionId,
        {
          message: trimmed,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
        <section className="rounded-2xl border border-cyan-200 bg-white/90 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Post-Visit AI Companion</h1>
              <p className="text-sm text-slate-600 mt-1">
                Clinically grounded patient follow-up with safety escalation detection and closed-loop acknowledgement.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {clinicianContext && (
                <button
                  type="button"
                  onClick={handleBackToWorkspace}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Workspace
                </button>
              )}
              {hasAccess && (
                <button
                  type="button"
                  onClick={handlePortalSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </section>

        {!hasAccess && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 max-w-lg shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Patient Portal Login</h2>
            <div>
              <label htmlFor="postvisit-email" className="block text-xs font-semibold text-slate-600 mb-1">
                Email
              </label>
              <input
                id="postvisit-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Patient email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="postvisit-password" className="block text-xs font-semibold text-slate-600 mb-1">
                Password
              </label>
              <input
                id="postvisit-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={authLoading || !tenantSlug}
              onClick={handlePatientLogin}
              className="px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-60"
            >
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </section>
        )}

        {hasAccess && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">Published Sessions</p>
                <p className="text-xl font-bold text-slate-900">{sessions.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">Checklist Pending</p>
                <p className="text-xl font-bold text-slate-900">{pendingChecklistCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">Checklist Completed</p>
                <p className="text-xl font-bold text-slate-900">{checklistCompleted}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">Conversation Messages</p>
                <p className="text-xl font-bold text-slate-900">{messages.length}</p>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <aside className="xl:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
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
                      className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                        selectedSessionId === session.id
                          ? 'border-cyan-300 bg-cyan-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
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

              <section className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 shadow-sm">
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
                  <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2" aria-live="assertive">
                    <p className="text-sm font-semibold text-rose-800 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Escalation routed to {lastEscalation.routeTarget}
                    </p>
                    <p className="text-xs text-rose-700 mt-1">
                      Severity: {lastEscalation.severity} • Event: {lastEscalation.id}
                    </p>
                    {lastEscalation.signalText && (
                      <p className="text-xs text-rose-700 mt-1">Signal: {lastEscalation.signalText}</p>
                    )}
                  </div>
                )}

                {labTrends.length > 0 && (
                  <LabTrendChart trends={labTrends} title="Lab trend (from your visit documents)" />
                )}

                {summaryPayload?.summary && (
                  <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-3">
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

                {checklistItems.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-cyan-700" />
                      Follow-up checklist
                    </p>
                    <div className="mt-2 space-y-2">
                      {checklistItems.map((item, index) => (
                        <div key={item.id || `checklist-${index}`} className="rounded-lg border border-slate-200 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <p className="text-sm font-medium text-slate-800">{item.title || 'Checklist item'}</p>
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${getUrgencyBadgeClass(item.urgency)}`}>
                              {(item.urgency || 'routine').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{item.description || 'No description'}</p>
                          <p className="text-[11px] text-slate-500 mt-1">Status: {item.completed ? 'completed' : 'pending'}</p>
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
                  <div ref={messageListRef} className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1" aria-live="polite">
                    {messages.length === 0 && <p className="text-xs text-slate-500">No messages yet.</p>}
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-lg px-3 py-2 ${
                          message.senderType === 'patient'
                            ? 'bg-cyan-50 border border-cyan-200'
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <p className="text-xs font-semibold text-slate-700">
                          {message.senderType === 'patient' ? 'You' : 'Companion'} • {new Date(message.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-800 mt-1">{message.message}</p>
                        {message.escalationDetected && (
                          <p className="text-[11px] text-rose-700 mt-1">
                            Escalation detected: {message.escalationEventId || 'pending id'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (!sending) {
                            void handleSendMessage();
                          }
                        }
                      }}
                      placeholder="Ask a follow-up question..."
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={sending || !draftMessage.trim() || !selectedSessionId}
                      onClick={() => {
                        void handleSendMessage();
                      }}
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
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default PostVisitCompanionPortal;
