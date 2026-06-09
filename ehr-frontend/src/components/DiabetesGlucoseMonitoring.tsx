import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Download, Droplets, Loader2, RefreshCw } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DiabetesGlucoseMonitoringProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  patientId?: string;
};

const PERIOD_OPTIONS = [
  { label: '7 days', value: '7d' },
  { label: '14 days', value: '14d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

const DiabetesGlucoseMonitoring: React.FC<DiabetesGlucoseMonitoringProps> = ({
  tenantSlug,
  token,
  registryId,
  patientId,
}) => {
  const { showError, showSuccess } = useNotification();
  const [history, setHistory] = useState<any[]>([]);
  const [trends, setTrends] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]['value']>('14d');
  const [formState, setFormState] = useState({
    glucoseValue: '',
    readingType: 'fasting',
    recordedAt: new Date().toISOString().slice(0, 16),
    mealContext: '',
    insulinDose: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) {
      return;
    }
    setLoading(true);
    try {
      const [historyResp, trendsResp] = await Promise.all([
        diabetesApi.getGlucoseHistory(registryId, token, tenantSlug, { limit: 8 }),
        diabetesApi.getGlucoseTrends(registryId, token, tenantSlug, { period }),
      ]);
      setHistory(Array.isArray(historyResp.data) ? historyResp.data : []);
      setTrends(trendsResp.data);
    } catch (error) {
      console.error('Failed to load glucose data', error);
      showError('Unable to load glucose readings', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, period, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriod(event.target.value as (typeof PERIOD_OPTIONS)[number]['value']);
  };

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registryId || !patientId) {
      showError('Missing registry', 'Select a registry before recording glucose values.');
      return;
    }
    setFormSubmitting(true);
    try {
      const payload = {
        patientId,
        glucoseValue: Number(formState.glucoseValue),
        monitoringType: 'self_monitoring',
        readingType: formState.readingType,
        recordedAt: formState.recordedAt ? new Date(formState.recordedAt).toISOString() : undefined,
        mealContext: formState.mealContext || undefined,
        insulinDose: formState.insulinDose ? Number(formState.insulinDose) : undefined,
        notes: formState.notes || undefined,
      };
      await diabetesApi.recordGlucose(registryId, token, tenantSlug, payload);
      showSuccess('Glucose recorded', 'Reading has been added to the log.');
      setFormState((prev) => ({
        ...prev,
        glucoseValue: '',
        insulinDose: '',
        notes: '',
      }));
      await fetchData();
    } catch (error) {
      console.error('Failed to record glucose', error);
      showError('Unable to save reading', 'Please verify the values and retry.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!history.length) {
      showError('Nothing to export', 'Capture at least one manual reading first.');
      return;
    }
    setExporting(true);
    try {
      const headers = ['Recorded At', 'Glucose (mmol/L)', 'Reading Type', 'Meal Context', 'Notes'];
      const rows = history.map((reading) => [
        new Date(reading.recorded_at).toISOString(),
        reading.glucose_value,
        reading.reading_type ?? '',
        reading.meal_context ?? '',
        (reading.notes ?? '').replace(/"/g, '""'),
      ]);
      const csv = [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => {
              if (cell === null || cell === undefined) {
                return '';
              }
              const value = String(cell);
              return value.includes(',') ? `"${value}"` : value;
            })
            .join(','),
        )
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `glucose-readings-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const chartPoints = useMemo(() => {
    return Array.isArray(trends?.points)
      ? trends.points.map((point: any) => ({
          date: new Date(point.day).toLocaleDateString(),
          value: Number(point.avg_value ?? 0),
          min: Number(point.min_value ?? 0),
          max: Number(point.max_value ?? 0),
        }))
      : [];
  }, [trends]);

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to view glucose history.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Glycemic radar</p>
          <h3 className="text-xl font-semibold text-slate-900">Glucose monitoring</h3>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={handlePeriodChange}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Manual entry</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-500 flex flex-col gap-1 col-span-2">
              Glucose (mmol/L)
              <input
                type="number"
                min={1}
                max={40}
                step={0.1}
                required
                name="glucoseValue"
                value={formState.glucoseValue}
                onChange={handleFormChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
              />
            </label>
            <label className="text-xs text-slate-500 flex flex-col gap-1">
              Reading type
              <select
                name="readingType"
                value={formState.readingType}
                onChange={handleFormChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
              >
                <option value="fasting">Fasting</option>
                <option value="pre_meal">Pre-meal</option>
                <option value="post_meal">Post-meal</option>
                <option value="random">Random</option>
                <option value="bedtime">Bedtime</option>
              </select>
            </label>
            <label className="text-xs text-slate-500 flex flex-col gap-1">
              Recorded at
              <input
                type="datetime-local"
                name="recordedAt"
                value={formState.recordedAt}
                onChange={handleFormChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
              />
            </label>
            <label className="text-xs text-slate-500 flex flex-col gap-1">
              Meal context
              <input
                type="text"
                name="mealContext"
                value={formState.mealContext}
                onChange={handleFormChange}
                placeholder="Breakfast, snacks, etc."
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
              />
            </label>
            <label className="text-xs text-slate-500 flex flex-col gap-1">
              Insulin dose (U)
              <input
                type="number"
                name="insulinDose"
                value={formState.insulinDose}
                onChange={handleFormChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
              />
            </label>
            <label className="text-xs text-slate-500 flex flex-col gap-1 col-span-2">
              Notes
              <textarea
                name="notes"
                rows={2}
                value={formState.notes}
                onChange={handleFormChange}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={formSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
          >
            {formSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Record reading
          </button>
        </form>

        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Trend</p>
              <h4 className="text-lg font-semibold text-slate-900">Average glucose</h4>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Droplets className="h-4 w-4 text-emerald-500" />
              <span>Target: 3.9-10 mmol/L</span>
            </div>
          </div>
          <div className="relative h-48">
            <div className="absolute inset-0 flex flex-col justify-between">
              {[180, 140, 100, 70].map((threshold) => (
                <div key={threshold} className="flex items-center text-[10px] text-slate-300">
                  <div className="flex-1 border-t border-dashed border-slate-100" />
                  <span className="ml-2 text-slate-300">{threshold}</span>
                </div>
              ))}
            </div>
            <div className="relative flex h-full items-end gap-2">
              {chartPoints.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                  No trend data yet.
                </div>
              )}
              {chartPoints.map((point: { date: string; value: number; max: number }) => (
                <div key={point.date} className="flex flex-col items-center gap-1 w-12">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-3 rounded-full ${
                        point.value < 70
                          ? 'bg-amber-400'
                          : point.value > 180
                          ? 'bg-rose-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ height: `${Math.min((point.max / 200) * 100, 100)}%` }}
                    />
                    <div className="text-[10px] text-slate-500">{point.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-6 py-4">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Recent readings</p>
        <div className="mt-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white py-4 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading readings...
            </div>
          )}
          {!loading && history.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
              No manual readings have been captured yet.
            </div>
          )}
          {!loading &&
            history.map((reading) => (
              <div
                key={reading.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{reading.glucose_value} mmol/L</p>
                    <p className="text-xs text-slate-500 capitalize">
                      {reading.reading_type?.replace('_', ' ') || 'manual'} •{' '}
                      {new Date(reading.recorded_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    reading.glucose_value < 3.9
                      ? 'bg-amber-100 text-amber-700'
                      : reading.glucose_value > 10
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {reading.glucose_value < 3.9
                    ? 'Hypo'
                    : reading.glucose_value > 10
                    ? 'Hyper'
                    : 'In range'}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default DiabetesGlucoseMonitoring;


