import React, { useEffect, useState } from 'react';
import { Brain, Activity, TrendingUp, AlertTriangle, RefreshCw, Cpu } from 'lucide-react';
import { ehrAxios } from '../services/api';

interface AiOpsMetric {
  surface: string;
  metric_date: string;
  total_calls: number;
  abstention_count: number;
  circuit_breaker_trips: number;
  avg_latency_ms: number;
  accuracy: number;
  fairness_sdoh_parity: number;
}

interface ModelVersion {
  version: string;
  updated_at: string | null;
  entry_count: number;
}

interface AiOpsDashboardProps {
  tenantSlug: string;
  token: string;
}

export const AiOpsDashboard: React.FC<AiOpsDashboardProps> = ({ tenantSlug, token }) => {
  const [metrics, setMetrics] = useState<AiOpsMetric[]>([]);
  const [modelVersions, setModelVersions] = useState<Record<string, ModelVersion>>({});
  const [loading, setLoading] = useState(true);

  const headers = { 'x-tenant-slug': tenantSlug, Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [metricsRes, versionsRes] = await Promise.allSettled([
        ehrAxios.get('/model-monitoring/ai-ops/metrics', { headers }),
        ehrAxios.get('/model-monitoring/model-versions', { headers }),
      ]);

      if (metricsRes.status === 'fulfilled') {
        setMetrics((metricsRes.value.data as any)?.metrics ?? []);
      }
      if (versionsRes.status === 'fulfilled') {
        setModelVersions((versionsRes.value.data as any)?.versions ?? {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantSlug]);

  const surfaceGroups = metrics.reduce((acc, m) => {
    if (!acc[m.surface]) acc[m.surface] = [];
    acc[m.surface].push(m);
    return acc;
  }, {} as Record<string, AiOpsMetric[]>);

  const latestBySurface = Object.entries(surfaceGroups).map(([surface, rows]) => ({
    surface,
    latest: rows.sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" />
          <h2 className="text-base font-semibold text-gray-100">AI Operations Dashboard</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Model Versions */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-700">
          <Cpu className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">Active Model Versions</span>
          <span className="ml-auto text-[10px] text-gray-500">AI-generated · clinician review required</span>
        </div>
        {Object.keys(modelVersions).length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500">
            No model versions recorded yet. Versions appear after first retraining cycle.
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {Object.entries(modelVersions).map(([surface, info]) => (
              <div key={surface} className="flex items-center px-4 py-2.5 text-xs gap-3">
                <span className="text-gray-300 capitalize w-36 shrink-0">{surface.replace(/_/g, ' ')}</span>
                <span className="text-purple-400 font-mono">{info.version}</span>
                <span className="text-gray-500 ml-auto">{info.entry_count} samples</span>
                <span className="text-gray-500">
                  {info.updated_at ? new Date(info.updated_at).toLocaleDateString() : 'baseline'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-surface AI metrics */}
      {loading ? (
        <div className="text-center text-gray-500 text-sm py-8">Loading metrics...</div>
      ) : latestBySurface.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-8">No metrics in last 30 days.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {latestBySurface.map(({ surface, latest }) => {
            const abstentionRate = latest.total_calls > 0
              ? ((latest.abstention_count / latest.total_calls) * 100).toFixed(1)
              : '0';
            const accuracyPct = latest.accuracy != null
              ? (latest.accuracy * 100).toFixed(1)
              : '—';
            const hasAccuracyConcern = latest.accuracy != null && latest.accuracy < 0.70;
            const hasFairnessConcern = latest.fairness_sdoh_parity != null && latest.fairness_sdoh_parity > 0.10;

            return (
              <div
                key={surface}
                className={`rounded-lg border p-3 ${
                  hasAccuracyConcern || hasFairnessConcern
                    ? 'border-yellow-700 bg-yellow-900/10'
                    : 'border-gray-700 bg-gray-800/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-xs font-semibold text-gray-200 capitalize">
                    {surface.replace(/_/g, ' ')}
                  </span>
                  {(hasAccuracyConcern || hasFairnessConcern) && (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 ml-auto" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="text-gray-400">Calls (30d)</div>
                  <div className="text-gray-200 text-right">{latest.total_calls.toLocaleString()}</div>

                  <div className="text-gray-400">Abstention rate</div>
                  <div className="text-gray-200 text-right">{abstentionRate}%</div>

                  <div className="text-gray-400">Avg latency</div>
                  <div className="text-gray-200 text-right">{latest.avg_latency_ms?.toFixed(0) ?? '—'}ms</div>

                  <div className="text-gray-400">Accuracy</div>
                  <div className={`text-right font-medium ${hasAccuracyConcern ? 'text-yellow-400' : 'text-green-400'}`}>
                    {accuracyPct}%
                  </div>

                  {latest.fairness_sdoh_parity != null && (
                    <>
                      <div className="text-gray-400">SDOH parity gap</div>
                      <div className={`text-right ${hasFairnessConcern ? 'text-yellow-400' : 'text-gray-200'}`}>
                        {(latest.fairness_sdoh_parity * 100).toFixed(1)}%
                      </div>
                    </>
                  )}

                  {modelVersions[surface] && (
                    <>
                      <div className="text-gray-400">Model version</div>
                      <div className="text-purple-400 text-right font-mono text-[10px] truncate">
                        {modelVersions[surface].version}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
