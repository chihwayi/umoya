import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Bot, CheckCircle2, Clock3, Loader2, MessageSquareText, ShieldAlert, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';

type Followup = {
  id: string;
  triggerType: string;
  riskLevel: string;
  status: 'open' | 'in_progress' | 'completed' | 'dismissed';
  reminderState: 'pending' | 'sent' | 'acknowledged';
  nextAction?: string | null;
  unresolvedQuestion?: string | null;
  nonadherenceFlag?: boolean;
  missedFollowupFlag?: boolean;
  routeBackTarget?: string | null;
  dueAt?: string | null;
  checklistItems?: Array<{ id: string; text: string; completed?: boolean }> | null;
  lastTouchedAt?: string | null;
  completedAt?: string | null;
  session?: {
    type?: string | null;
    guidanceSummary?: string | null;
    urgency?: string | null;
    latestMessage?: string | null;
    latestReply?: string | null;
    requiresClinicianFollowUp?: boolean;
  };
};

const PatientAiFollowupsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showError, showSuccess } = useNotification();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadFollowups = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await patientPortalApi.getAiFollowups(token!, tenantSlug);
      setFollowups(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load AI follow-ups');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token]);

  useEffect(() => {
    void loadFollowups();
  }, [loadFollowups]);

  const activeFollowups = useMemo(
    () => followups.filter((followup) => followup.status === 'open' || followup.status === 'in_progress'),
    [followups],
  );
  const completedFollowups = useMemo(
    () => followups.filter((followup) => followup.status === 'completed' || followup.status === 'dismissed'),
    [followups],
  );

  const handleUpdate = async (
    followupId: string,
    updates: { status?: 'open' | 'in_progress' | 'completed' | 'dismissed'; reminderState?: 'pending' | 'sent' | 'acknowledged' },
    successMessage: string,
  ) => {
    try {
      setActioningId(followupId);
      const updated = await patientPortalApi.updateAiFollowup(followupId, updates, token!, tenantSlug);
      setFollowups((current) => current.map((item) => (item.id === followupId ? { ...item, ...updated } : item)));
      showSuccess('AI follow-up updated', successMessage);
    } catch (err: any) {
      showError('Update failed', err.message || 'Failed to update AI follow-up');
    } finally {
      setActioningId(null);
    }
  };

  const handleFollowupOutcome = async (followupId: string, outcome: 'completed' | 'unable') => {
    try {
      setActioningId(followupId);
      const statusUpdate = outcome === 'completed' ? 'completed' : 'in_progress';
      const updated = await patientPortalApi.updateAiFollowup(
        followupId,
        { status: statusUpdate as any },
        token!,
        tenantSlug
      );
      setFollowups((current) => current.map((item) => (item.id === followupId ? { ...item, ...updated } : item)));
      showSuccess('Updated', outcome === 'completed' ? 'Follow-up marked complete!' : 'Follow-up noted — a clinician will reach out.');
    } catch (err: any) {
      showError('Update failed', err.message || 'Failed to update');
    } finally {
      setActioningId(null);
    }
  };

  const getRiskBadge = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'emergency':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'dismissed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'in_progress':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const renderCard = (followup: Followup) => {
    const isBusy = actioningId === followup.id;
    return (
      <div key={followup.id} className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskBadge(followup.riskLevel)}`}>
                {String(followup.riskLevel || 'routine').replace('_', ' ')}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(followup.status)}`}>
                {followup.status.replace('_', ' ')}
              </span>
              {followup.session?.requiresClinicianFollowUp && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-rose-100 text-rose-800 border-rose-200">
                  clinician follow-up
                </span>
              )}
            </div>

            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {followup.nextAction || 'AI follow-up task'}
                </h1>
                <p className="text-sm text-gray-600">
                  Trigger: {String(followup.triggerType || 'patient_ai').replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            {followup.session?.guidanceSummary && (
              <p className="text-sm text-gray-700 leading-6 mb-3">
                {followup.session.guidanceSummary}
              </p>
            )}

            {followup.unresolvedQuestion && (
              <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Unresolved question</p>
                <p className="text-sm text-amber-900">{followup.unresolvedQuestion}</p>
              </div>
            )}

            <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-gray-400" />
                <span>
                  Due: {followup.dueAt ? format(new Date(followup.dueAt), 'MMM d, yyyy h:mm a') : 'No due date'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-gray-400" />
                <span>Route back: {followup.routeBackTarget || 'patient_support'}</span>
              </div>
              {followup.nonadherenceFlag && (
                <div className="flex items-center gap-2 text-amber-700">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Medication adherence needs review</span>
                </div>
              )}
              {followup.missedFollowupFlag && (
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>Missed follow-up detected</span>
                </div>
              )}
              {followup.session?.latestReply && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <MessageSquareText className="w-4 h-4 text-gray-400" />
                  <span className="line-clamp-2">Latest reply: {followup.session.latestReply}</span>
                </div>
              )}
            {/* Checklist Items (Sprint 113) */}
            {followup.checklistItems && followup.checklistItems.length > 0 && (
              <div className="mt-2 mb-2">
                <p className="text-xs font-semibold text-gray-600 mb-1">Your Action Items:</p>
                {followup.checklistItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={item.completed || false}
                      readOnly
                      className="mt-0.5"
                    />
                    <span className={`text-xs ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Outcome Capture Buttons (Sprint 113) */}
            {followup.status === 'in_progress' && (
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={() => handleFollowupOutcome(followup.id, 'completed')}
                  disabled={actioningId === followup.id}
                  className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  ✓ I completed this
                </button>
                <button
                  onClick={() => handleFollowupOutcome(followup.id, 'unable')}
                  disabled={actioningId === followup.id}
                  className="text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded hover:bg-slate-300 disabled:opacity-50"
                >
                  I wasn't able to
                </button>
              </div>
            )}
            </div>
          </div>

          {(followup.status === 'open' || followup.status === 'in_progress') && (
            <div className="flex flex-col gap-3 lg:w-52">
              <button
                onClick={() => handleUpdate(followup.id, { status: 'in_progress', reminderState: 'acknowledged' }, 'The follow-up is now marked in progress.')}
                disabled={isBusy || followup.status === 'in_progress'}
                className="px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Mark In Progress'}
              </button>
              <button
                onClick={() => handleUpdate(followup.id, { status: 'completed', reminderState: 'acknowledged' }, 'The follow-up is now marked complete.')}
                disabled={isBusy}
                className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Mark Done'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your AI follow-ups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Follow-Ups</h1>
              <p className="text-sm text-gray-600">Track the guidance your clinic AI and post-visit companion generated for you.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 p-5 text-white shadow-xl">
            <p className="text-sm text-indigo-100">Active follow-ups</p>
            <p className="text-3xl font-bold mt-2">{activeFollowups.length}</p>
          </div>
          <div className="rounded-2xl bg-white/85 backdrop-blur-sm border border-white/20 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Urgent follow-ups</p>
            <p className="text-3xl font-bold mt-2 text-orange-600">
              {activeFollowups.filter((item) => item.riskLevel === 'urgent' || item.riskLevel === 'emergency').length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/85 backdrop-blur-sm border border-white/20 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-3xl font-bold mt-2 text-emerald-600">{completedFollowups.length}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {followups.length === 0 ? (
          <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-12 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg mb-6">
              <Bot className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No AI follow-ups right now</h2>
            <p className="text-gray-600">When the symptom checker, adherence assistant, or post-visit companion needs action from you, it will appear here.</p>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock3 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">Active tasks</h2>
              </div>
              {activeFollowups.length === 0 ? (
                <div className="rounded-2xl bg-white/85 backdrop-blur-sm border border-white/20 p-6 text-gray-600">
                  No active AI follow-ups.
                </div>
              ) : (
                activeFollowups.map(renderCard)
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-900">Completed and archived</h2>
              </div>
              {completedFollowups.length === 0 ? (
                <div className="rounded-2xl bg-white/85 backdrop-blur-sm border border-white/20 p-6 text-gray-600">
                  Nothing completed yet.
                </div>
              ) : (
                completedFollowups.map(renderCard)
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default PatientAiFollowupsPage;
