import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, RadioTower, RefreshCw, Waves, Zap } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DiabetesCgmInsightsProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  patientId?: string;
  initialSummaries?: any[];
  onUpdated?: (summaries: any[]) => void;
};

const clampPercent = (value: number | null | undefined) => {
  if (typeof value !== 'number') return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const DiabetesCgmInsights: React.FC<DiabetesCgmInsightsProps> = ({
  tenantSlug,
  token,
  registryId,
  patientId,
  initialSummaries,
  onUpdated,
}) => {
  const { showError, showSuccess } = useNotification();
  const [summaries, setSummaries] = useState<any[]>(initialSummaries ?? []);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const latest = summaries[0] ?? null;

  const fetchSummaries = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const response = await diabetesApi.getCgmSummary(registryId, token, tenantSlug);
      const list = Array.isArray(response.data) ? response.data : [];
      setSummaries(list);
      onUpdated?.(list);
    } catch (error) {
      console.error('Failed to load CGM summaries', error);
      showError('Unable to load CGM insights', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, showError, onUpdated]);

  useEffect(() => {
    if (Array.isArray(initialSummaries) && initialSummaries.length) {
      setSummaries(initialSummaries);
    }
  }, [initialSummaries]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const handleSync = async () => {
    if (!registryId || !patientId || !tenantSlug || !token) {
      showError('Missing registry', 'Select a registry before syncing CGM data.');
      return;
    }
    setSyncing(true);
    try {
      const now = Date.now();
      const entries = Array.from({ length: 5 }).map((_, index) => ({
        value: 90 + Math.round(Math.random() * 70),
        timestamp: new Date(now - index * 5 * 60 * 1000).toISOString(),
        trend: index === 0 ? 'flat' : index % 2 ? 'rise' : 'fall',
      }));
      await diabetesApi.syncCgmData(registryId, token, tenantSlug, {
        patientId,
        deviceType: latest?.device_type ?? 'cgm',
        deviceId: latest?.device_id ?? undefined,
        entries,
      });
      showSuccess('CGM data synced', 'Fresh sensor data has been ingested.');
      await fetchSummaries();
    } catch (error) {
      console.error('Failed to sync CGM data', error);
      showError('Unable to sync CGM data', 'Please retry shortly.');
    } finally {
      setSyncing(false);
    }
  };

  const tir = clampPercent(latest?.time_in_range_70_180);
  const above = clampPercent(latest?.time_above_range_180);
  const below = clampPercent(latest?.time_below_range_70);
  const severe = clampPercent(latest?.time_below_range_54);

  const trendCards = useMemo(
    () => [
      {
        label: 'Time above range',
        value: `${above}%`,
        tone: 'text-rose-600',
        bg: 'bg-rose-50 border-rose-100',
      },
      {
        label: 'Time below range',
        value: `${below}%`,
        tone: 'text-amber-600',
        bg: 'bg-amber-50 border-amber-100',
      },
      {
        label: 'Severe hypo',
        value: `${severe}%`,
        tone: 'text-slate-700',
        bg: 'bg-slate-50 border-slate-100',
      },
      {
        label: 'Average glucose',
        value: latest?.average_glucose ? `${latest.average_glucose} mmol/L` : '—',
        tone: 'text-indigo-600',
        bg: 'bg-indigo-50 border-indigo-100',
      },
      {
        label: 'Variability (CV)',
        value: latest?.glucose_variability ? `${latest.glucose_variability}%` : '—',
        tone: 'text-cyan-600',
        bg: 'bg-cyan-50 border-cyan-100',
      },
      {
        label: 'Daily readings',
        value: latest?.total_readings ?? '—',
        tone: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-100',
      },
    ],
    [above, below, severe, latest],
  );

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to view CGM insights.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CGM intelligence</p>
          <h3 className="text-xl font-semibold text-slate-900">Time-in-range insights</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSummaries}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
          >
            <RadioTower className="h-3.5 w-3.5" />
            Sync CGM
          </button>
        </div>
      </div>

      {loading && !summaries.length && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading CGM data...
        </div>
      )}

      {!loading && !summaries.length && (
        <div className="p-6 text-sm text-slate-500">
          No CGM summaries found. Connect a device or record a summary to unlock this view.
        </div>
      )}

      {summaries.length > 0 && (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 flex flex-col items-center justify-center">
              <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Time in range</div>
              <div
                className="relative mt-4 h-32 w-32 rounded-full flex items-center justify-center border-8 border-slate-100"
                style={{
                  background: `conic-gradient(#34d399 ${tir}%, #e2e8f0 ${tir}%)`,
                }}
              >
                <div className="absolute h-20 w-20 rounded-full bg-white flex items-center justify-center shadow-inner">
                  <span className="text-2xl font-semibold text-slate-900">{tir}%</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Sensor date {latest?.summary_date ? new Date(latest.summary_date).toLocaleDateString() : '—'}
              </p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trendCards.map((card) => (
                <div key={card.label} className={`rounded-2xl border ${card.bg} px-4 py-3`}>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{card.label}</p>
                  <p className={`text-xl font-semibold ${card.tone}`}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                Device
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">
                {latest?.device_type?.replace('_', ' ') ?? 'CGM'}
              </p>
              <p className="text-xs text-slate-500">
                {latest?.device_id ? `ID ${latest.device_id}` : 'No device metadata'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
                <Waves className="h-3.5 w-3.5 text-indigo-500" />
                Variability
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {latest?.glucose_variability ? `${latest.glucose_variability}% CV` : '—'}
              </p>
              <p className="text-xs text-slate-500">Goal &lt;36%</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                Last sync
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {latest?.updated_at ? new Date(latest.updated_at).toLocaleString() : '—'}
              </p>
              <p className="text-xs text-slate-500">Based on latest summary</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Trend history</p>
                <h4 className="text-lg font-semibold text-slate-900">Recent summaries</h4>
              </div>
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <div className="space-y-3">
              {summaries.slice(0, 4).map((summary) => (
                <div
                  key={summary.id ?? summary.summary_date}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {summary.summary_date ? new Date(summary.summary_date).toLocaleDateString() : 'Summary'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Avg {summary.average_glucose ?? '—'} mmol/L • {summary.total_readings ?? 0} readings
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{summary.time_in_range_70_180 ?? 0}% TIR</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiabetesCgmInsights;

