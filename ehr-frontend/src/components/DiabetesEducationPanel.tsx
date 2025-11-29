import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, NotebookPen, Plus, RefreshCw } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DiabetesEducationPanelProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  patientId?: string;
  onSummaryChange?: (status: any | null) => void;
};

const SESSION_TYPES = [
  { value: 'self-management', label: 'Self management' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'medication', label: 'Medication' },
  { value: 'device-training', label: 'Device training' },
  { value: 'psychosocial', label: 'Psychosocial' },
  { value: 'other', label: 'Other' },
];

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return value?.toString() ?? '—';
  }
};

const DiabetesEducationPanel: React.FC<DiabetesEducationPanelProps> = ({
  tenantSlug,
  token,
  registryId,
  patientId,
  onSummaryChange,
}) => {
  const { showError, showSuccess } = useNotification();
  const [sessions, setSessions] = useState<any[]>([]);
  const [dueStatus, setDueStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    sessionType: 'self-management',
    sessionDate: new Date().toISOString().slice(0, 10),
    topics: '',
    notes: '',
    completionStatus: 'completed',
    patientAttendance: 'true',
    assessmentScore: '',
  });

  const fetchEducation = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const [statusResp, historyResp] = await Promise.all([
        diabetesApi.getEducationDueStatus(registryId, token, tenantSlug),
        diabetesApi.getEducationHistory(registryId, token, tenantSlug, { limit: 6 }),
      ]);
      const statusData = statusResp.data ?? null;
      setDueStatus(statusData);
      onSummaryChange?.(statusData);
      setSessions(Array.isArray(historyResp.data) ? historyResp.data : []);
    } catch (error) {
      console.error('Failed to load education sessions', error);
      showError('Unable to load education sessions', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, onSummaryChange, showError]);

  useEffect(() => {
    fetchEducation();
  }, [fetchEducation]);

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registryId || !patientId) {
      showError('Missing registry', 'Select a registry before documenting education.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        patientId,
        sessionType: formState.sessionType,
        sessionDate: formState.sessionDate,
        topicsCovered: formState.topics
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        notes: formState.notes || undefined,
        completionStatus: formState.completionStatus,
        patientAttendance: formState.patientAttendance === 'true',
        assessmentScore: formState.assessmentScore ? Number(formState.assessmentScore) : undefined,
      };
      await diabetesApi.recordEducationSession(registryId, token, tenantSlug, payload);
      showSuccess('Education session logged', 'The survivorship record has been updated.');
      setShowForm(false);
      setFormState((prev) => ({
        ...prev,
        topics: '',
        notes: '',
        assessmentScore: '',
      }));
      await fetchEducation();
    } catch (error) {
      console.error('Failed to log education session', error);
      showError('Unable to log session', 'Please verify values and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const nextTouchpointLabel = useMemo(() => {
    if (!dueStatus) return 'Awaiting plan';
    if (dueStatus.overdue) {
      return `Overdue since ${formatDate(dueStatus.nextDueDate)}`;
    }
    return `Next due ${formatDate(dueStatus.nextDueDate)}`;
  }, [dueStatus]);

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to view education sessions.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Education cadence</p>
          <h3 className="text-xl font-semibold text-slate-900">Support & coaching</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEducation}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full bg-fuchsia-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-fuchsia-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Log session
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-fuchsia-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-500">Next touchpoint</p>
          <p className="text-3xl font-semibold text-slate-900">
            {dueStatus?.nextDueDate ? formatDate(dueStatus.nextDueDate) : 'Schedule'}
          </p>
          <p className="text-xs text-slate-500">{nextTouchpointLabel}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-indigo-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-indigo-500">Last session</p>
          <p className="text-3xl font-semibold text-slate-900">
            {dueStatus?.lastSessionDate ? formatDate(dueStatus.lastSessionDate) : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {sessions[0]?.session_type?.replace('_', ' ') ?? 'Not documented'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Cadence</p>
          <p className="text-3xl font-semibold text-slate-900">{sessions.length}</p>
          <p className="text-xs text-slate-500">Sessions on record</p>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mx-6 mb-6 grid grid-cols-1 md:grid-cols-6 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
        >
          <select
            name="sessionType"
            value={formState.sessionType}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-fuchsia-200 focus:ring focus:ring-fuchsia-100 md:col-span-2"
          >
            {SESSION_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="sessionDate"
            value={formState.sessionDate}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-fuchsia-200 focus:ring focus:ring-fuchsia-100"
          />
          <input
            type="number"
            name="assessmentScore"
            value={formState.assessmentScore}
            onChange={handleFormChange}
            placeholder="Assessment score"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-fuchsia-200 focus:ring focus:ring-fuchsia-100"
          />
          <select
            name="completionStatus"
            value={formState.completionStatus}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-fuchsia-200 focus:ring focus:ring-fuchsia-100"
          >
            <option value="completed">Completed</option>
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            name="patientAttendance"
            value={formState.patientAttendance}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-fuchsia-200 focus:ring focus:ring-fuchsia-100"
          >
            <option value="true">Attended</option>
            <option value="false">No show</option>
          </select>
          <label className="text-xs text-slate-500 flex flex-col gap-1 md:col-span-3">
            Topics (comma separated)
            <input
              type="text"
              name="topics"
              value={formState.topics}
              onChange={handleFormChange}
              placeholder="Lifestyle, CGM training, nutrition"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-fuchsia-200 focus:ring focus:ring-fuchsia-100"
            />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1 md:col-span-3">
            Notes
            <textarea
              name="notes"
              rows={2}
              value={formState.notes}
              onChange={handleFormChange}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-fuchsia-200 focus:ring focus:ring-fuchsia-100"
            />
          </label>
          <div className="md:col-span-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-fuchsia-500 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save session
            </button>
          </div>
        </form>
      )}

      <div className="px-6 pb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Session log</p>
            <h4 className="text-lg font-semibold text-slate-900">Recent education</h4>
          </div>
          <NotebookPen className="h-5 w-5 text-slate-400" />
        </div>
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white py-4 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading sessions...
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            No education sessions recorded yet.
          </div>
        )}
        {!loading &&
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {session.session_type?.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(session.session_date)}</p>
                  {Array.isArray(session.topics_covered) && session.topics_covered.length > 0 && (
                    <p className="text-[11px] text-slate-400">
                      {session.topics_covered.join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                  session.completion_status === 'completed'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : session.completion_status === 'scheduled'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {session.completion_status}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DiabetesEducationPanel;

