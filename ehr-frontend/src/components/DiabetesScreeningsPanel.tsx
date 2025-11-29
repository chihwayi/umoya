import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Loader2, Plus, RefreshCw } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DiabetesScreeningsPanelProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  patientId?: string;
  initialDue?: any[];
  onSummaryChange?: (due: any[] | null) => void;
};

const SCREENING_TYPES = [
  { value: 'retinopathy', label: 'Retinopathy exam' },
  { value: 'neuropathy', label: 'Neuropathy exam' },
  { value: 'nephropathy', label: 'Nephropathy labs' },
  { value: 'cardiovascular', label: 'Cardiovascular risk' },
  { value: 'foot_ulcer', label: 'Foot exam' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_OPTIONS = [
  { value: 'grade0', label: 'Grade 0' },
  { value: 'grade1', label: 'Grade 1' },
  { value: 'grade2', label: 'Grade 2' },
  { value: 'grade3', label: 'Grade 3' },
  { value: 'grade4', label: 'Grade 4' },
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

const DiabetesScreeningsPanel: React.FC<DiabetesScreeningsPanelProps> = ({
  tenantSlug,
  token,
  registryId,
  patientId,
  initialDue,
  onSummaryChange,
}) => {
  const { showError, showSuccess } = useNotification();
  const [dueStatuses, setDueStatuses] = useState<any[]>(initialDue ?? []);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    screeningType: 'retinopathy',
    screeningDate: new Date().toISOString().slice(0, 10),
    screeningResult: '',
    severityGrade: '',
    nextScreeningDueDate: '',
    notes: '',
  });

  const fetchScreenings = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const [dueResp, historyResp] = await Promise.all([
        diabetesApi.getScreeningDueStatus(registryId, token, tenantSlug),
        diabetesApi.getScreeningHistory(registryId, token, tenantSlug, { limit: 8 }),
      ]);
      const dueList = Array.isArray(dueResp.data) ? dueResp.data : [];
      setDueStatuses(dueList);
      onSummaryChange?.(dueList);
      setHistory(Array.isArray(historyResp.data) ? historyResp.data : []);
    } catch (error) {
      console.error('Failed to load screenings', error);
      showError('Unable to load screenings', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, onSummaryChange, showError]);

  useEffect(() => {
    if (Array.isArray(initialDue)) {
      setDueStatuses(initialDue);
    }
  }, [initialDue]);

  useEffect(() => {
    fetchScreenings();
  }, [fetchScreenings]);

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registryId || !patientId) {
      showError('Missing registry', 'Select a registry before recording screening data.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        patientId,
        screeningType: formState.screeningType,
        screeningDate: formState.screeningDate,
        screeningResult: formState.screeningResult || undefined,
        severityGrade: formState.severityGrade || undefined,
        nextScreeningDueDate: formState.nextScreeningDueDate || undefined,
        notes: formState.notes || undefined,
      };
      await diabetesApi.recordScreening(registryId, token, tenantSlug, payload);
      showSuccess('Screening recorded', 'Tracking updated with the latest findings.');
      setShowForm(false);
      setFormState((prev) => ({
        ...prev,
        screeningResult: '',
        severityGrade: '',
        notes: '',
      }));
      await fetchScreenings();
    } catch (error) {
      console.error('Failed to record screening', error);
      showError('Unable to record screening', 'Please verify values and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const overdueCount = useMemo(() => dueStatuses.filter((item) => item.overdue).length, [dueStatuses]);
  const upcoming = useMemo(
    () =>
      dueStatuses
        .filter((item) => item.nextScreeningDueDate)
        .sort(
          (a, b) =>
            new Date(a.nextScreeningDueDate).getTime() - new Date(b.nextScreeningDueDate).getTime(),
        ),
    [dueStatuses],
  );

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to view screening history.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Complication radar</p>
          <h3 className="text-xl font-semibold text-slate-900">Screenings & surveillance</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchScreenings}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Record screening
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Upcoming</p>
          <p className="text-3xl font-semibold text-slate-900">{upcoming.length}</p>
          <p className="text-xs text-slate-500">Scheduled within 6 months</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-rose-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-rose-500">Overdue</p>
          <p className="text-3xl font-semibold text-slate-900">{overdueCount}</p>
          <p className="text-xs text-slate-500">Needs action</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Last recorded</p>
          <p className="text-3xl font-semibold text-slate-900">
            {history[0]?.screening_type ? history[0].screening_type.replace('_', ' ') : '—'}
          </p>
          <p className="text-xs text-slate-500">{formatDate(history[0]?.screening_date)}</p>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mx-6 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
        >
          <select
            name="screeningType"
            value={formState.screeningType}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-200 focus:ring focus:ring-emerald-100"
          >
            {SCREENING_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="screeningDate"
            value={formState.screeningDate}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-200 focus:ring focus:ring-emerald-100"
          />
          <input
            type="text"
            name="screeningResult"
            value={formState.screeningResult}
            onChange={handleFormChange}
            placeholder="Result"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-200 focus:ring focus:ring-emerald-100"
          />
          <select
            name="severityGrade"
            value={formState.severityGrade}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-200 focus:ring focus:ring-emerald-100"
          >
            <option value="">Severity</option>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="nextScreeningDueDate"
            value={formState.nextScreeningDueDate}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-200 focus:ring focus:ring-emerald-100"
          />
          <label className="md:col-span-5 text-xs text-slate-500 flex flex-col gap-1">
            Notes
            <textarea
              name="notes"
              rows={2}
              value={formState.notes}
              onChange={handleFormChange}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-200 focus:ring focus:ring-emerald-100"
            />
          </label>
          <div className="md:col-span-5 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save screening
            </button>
          </div>
        </form>
      )}

      <div className="px-6 pb-6">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Due radar</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {dueStatuses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No screening cadence data yet.
            </div>
          )}
          {dueStatuses.map((item) => (
            <div
              key={item.screeningType}
              className={`rounded-2xl border px-4 py-3 shadow-sm ${
                item.overdue ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {item.screeningType?.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    Last {formatDate(item.lastScreeningDate)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                    item.overdue
                      ? 'border-rose-200 bg-white text-rose-600'
                      : 'border-emerald-200 bg-white text-emerald-600'
                  }`}
                >
                  {item.overdue ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Overdue
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      On track
                    </>
                  )}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Next due {formatDate(item.nextScreeningDueDate)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">History log</p>
            <h4 className="text-lg font-semibold text-slate-900">Recent screenings</h4>
          </div>
          <ClipboardCheck className="h-5 w-5 text-slate-400" />
        </div>
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white py-4 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading history...
          </div>
        )}
        {!loading && history.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            No screenings documented yet.
          </div>
        )}
        {!loading &&
          history.map((item) => (
            <div
              key={item.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {item.screening_type?.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(item.screening_date)} • {item.screening_result ?? 'Pending'}
                  </p>
                  {item.next_screening_due_date && (
                    <p className="text-[11px] text-slate-400">
                      Next due {formatDate(item.next_screening_due_date)}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                  item.severity_grade ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                {item.severity_grade || 'No grade'}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DiabetesScreeningsPanel;

