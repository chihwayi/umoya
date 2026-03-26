import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, MessageSquareText, Send, Sparkles, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';

type SessionListItem = {
  id: string;
  status: string;
  sourceType?: string | null;
  language?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  summarySnippet?: string | null;
  checklistCount?: number;
};

const PostVisitCompanionPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showError, showSuccess } = useNotification();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [error, setError] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      setError('');
      const data = await patientPortalApi.listPostVisitSessions(token!, tenantSlug, { limit: 20 });
      const nextSessions = Array.isArray(data?.sessions) ? data.sessions : [];
      setSessions(nextSessions);
      setSelectedSessionId((current) => current || nextSessions[0]?.id || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load post-visit sessions');
    } finally {
      setLoadingSessions(false);
    }
  }, [tenantSlug, token]);

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    try {
      setLoadingDetail(true);
      const [summaryResponse, messagesResponse] = await Promise.all([
        patientPortalApi.getPostVisitSummary(sessionId, token!, tenantSlug),
        patientPortalApi.getPostVisitMessages(sessionId, token!, tenantSlug, { limit: 100 }),
      ]);
      setSummary(summaryResponse);
      setMessages(Array.isArray(messagesResponse?.messages) ? messagesResponse.messages : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load post-visit details');
    } finally {
      setLoadingDetail(false);
    }
  }, [tenantSlug, token]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (selectedSessionId) {
      void loadSessionDetail(selectedSessionId);
    } else {
      setSummary(null);
      setMessages([]);
    }
  }, [loadSessionDetail, selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const sendMessage = async () => {
    if (!selectedSessionId || !draftMessage.trim()) {
      return;
    }

    try {
      setSending(true);
      const response = await patientPortalApi.sendPostVisitMessage(
        selectedSessionId,
        { message: draftMessage.trim(), messageType: 'question' },
        token!,
        tenantSlug,
      );

      setMessages((current) => [
        ...current,
        response.patientMessage
          ? {
              id: response.patientMessage.id,
              senderType: 'patient',
              message: response.patientMessage.message,
              messageType: response.patientMessage.messageType,
              createdAt: response.patientMessage.createdAt,
            }
          : null,
        response.assistantMessage
          ? {
              id: response.assistantMessage.id,
              senderType: 'system',
              message: response.assistantMessage.message,
              messageType: response.assistantMessage.messageType,
              createdAt: response.assistantMessage.createdAt,
            }
          : null,
      ].filter(Boolean) as any[]);
      setDraftMessage('');
      showSuccess('Message sent', 'The post-visit companion has responded.');
      await loadSessions();
    } catch (err: any) {
      showError('Send failed', err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const acknowledgePlan = async () => {
    if (!selectedSessionId) {
      return;
    }

    try {
      setAcknowledging(true);
      await patientPortalApi.acknowledgePostVisit(
        selectedSessionId,
        {
          acknowledgementType: 'follow_up_commitment',
          acknowledged: true,
          details: {
            note: 'Patient acknowledged the follow-up plan from the portal companion view.',
          },
        },
        token!,
        tenantSlug,
      );
      showSuccess('Follow-up acknowledged', 'Your follow-up commitment has been recorded.');
      await loadSessionDetail(selectedSessionId);
      await loadSessions();
    } catch (err: any) {
      showError('Acknowledge failed', err.message || 'Failed to record the follow-up acknowledgement');
    } finally {
      setAcknowledging(false);
    }
  };

  if (loadingSessions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading post-visit companion sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Post-Visit Companion</h1>
              <p className="text-sm text-gray-600">Review your doctor-approved summary, checklist, and grounded follow-up answers.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-12 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg mb-6">
              <Sparkles className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No post-visit sessions available</h2>
            <p className="text-gray-600">Once your clinician publishes a post-visit summary, it will appear here with your checklist and grounded answers.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
            <aside className="space-y-4">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full text-left rounded-2xl border p-4 shadow-sm transition-all ${
                    session.id === selectedSessionId
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                      : 'bg-white/85 backdrop-blur-sm border-white/20 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">Published {session.publishedAt ? format(new Date(session.publishedAt), 'MMM d, yyyy') : 'session'}</p>
                      <p className={`text-sm mt-1 ${session.id === selectedSessionId ? 'text-indigo-100' : 'text-gray-600'}`}>
                        {session.summarySnippet || 'Doctor-approved summary available.'}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${session.id === selectedSessionId ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                      {session.checklistCount || 0} tasks
                    </span>
                  </div>
                </button>
              ))}
            </aside>

            <section className="space-y-6">
              {loadingDetail ? (
                <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-12 text-center">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading session detail...</p>
                </div>
              ) : selectedSession ? (
                <>
                  <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          <Stethoscope className="w-5 h-5 text-indigo-600" />
                          Visit summary
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                          Published {selectedSession.publishedAt ? format(new Date(selectedSession.publishedAt), 'MMM d, yyyy h:mm a') : 'recently'}
                        </p>
                      </div>
                      <button
                        onClick={acknowledgePlan}
                        disabled={acknowledging}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                      >
                        {acknowledging ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'I understand the plan'}
                      </button>
                    </div>

                    <p className="mt-4 text-gray-700 leading-7">
                      {summary?.summary?.plainLanguageSummary || selectedSession.summarySnippet || 'Summary not available.'}
                    </p>

                    {Array.isArray(summary?.summary?.keyPoints) && summary.summary.keyPoints.length > 0 && (
                      <div className="mt-5">
                        <h3 className="font-semibold text-gray-900 mb-3">Key points</h3>
                        <ul className="space-y-2">
                          {summary.summary.keyPoints.map((point: string, index: number) => (
                            <li key={`${point}-${index}`} className="flex items-start gap-3 text-sm text-gray-700">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(summary?.summary?.teachBackQuestions) && summary.summary.teachBackQuestions.length > 0 && (
                      <div className="mt-5">
                        <h3 className="font-semibold text-gray-900 mb-3">Teach-back questions</h3>
                        <ul className="space-y-2 text-sm text-gray-700">
                          {summary.summary.teachBackQuestions.map((question: string, index: number) => (
                            <li key={`${question}-${index}`} className="flex items-start gap-3">
                              <MessageSquareText className="w-4 h-4 mt-0.5 text-indigo-600" />
                              <span>{question}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
                      <ClipboardList className="w-5 h-5 text-indigo-600" />
                      Checklist
                    </h2>
                    <div className="space-y-3">
                      {(summary?.checklist || []).map((item: any) => (
                        <div key={item.id || item.title} className="rounded-xl border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">{item.title || 'Checklist item'}</p>
                              {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
                              <p className="text-xs text-gray-500 mt-2">
                                {item.urgency || 'routine'}{item.actionType ? ` • ${item.actionType}` : ''}
                              </p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {item.completed ? 'completed' : 'pending'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
                      <MessageSquareText className="w-5 h-5 text-indigo-600" />
                      Companion chat
                    </h2>
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`rounded-2xl p-4 ${
                            message.senderType === 'patient'
                              ? 'bg-indigo-600 text-white ml-8'
                              : 'bg-slate-100 text-slate-900 mr-8'
                          }`}
                        >
                          <p className="text-xs uppercase tracking-wide opacity-70 mb-1">
                            {message.senderType === 'patient' ? 'You' : 'Companion'}
                          </p>
                          <p className="text-sm leading-6">{message.message}</p>
                          {message.createdAt && (
                            <p className="text-xs mt-2 opacity-70">
                              {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <textarea
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        placeholder="Ask a grounded question about your summary, medication plan, warning signs, or follow-up steps."
                        className="flex-1 min-h-[96px] rounded-2xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={sending || !draftMessage.trim()}
                        className="sm:w-44 px-4 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default PostVisitCompanionPage;
