import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Activity, ShieldCheck, AlertTriangle, Cpu, Gauge } from 'lucide-react';
import { ehrAxios } from '../services/api';

interface ControlTowerMetrics {
  metricDate: string;
  totalCalls: number;
  abstentionCount: number;
  abstentionRate: number;
  circuitBreakerTrips: number;
  avgLatencyMs: number | null;
  accuracy: number | null;
  fairnessAgeParity: number | null;
  fairnessGenderParity: number | null;
  fairnessSdohParity: number | null;
}

interface ReleaseReadiness {
  aiSurface: string;
  releaseStatus: 'ready' | 'blocked' | 'unknown';
}

interface ModelVersionInfo {
  version?: string;
  updated_at?: string | null;
  entry_count?: number;
}

interface ControlTowerSurface {
  aiSurface: string;
  displayName: string;
  description: string;
  useCases: string[];
  metricsSurface: string;
  monitoring: {
    metricsSurface: string;
    offlineEvalSupported: boolean;
    releaseGateSupported: boolean;
  };
  audit: {
    modelRegistry: string;
    promptAuditLog: string;
    sourceOfTruth: string;
  };
  controls: {
    disablePaths: string[];
    rollbackPaths: string[];
  };
  latestMetrics: ControlTowerMetrics | null;
  releaseReadiness: ReleaseReadiness | null;
  modelVersion: ModelVersionInfo | null;
  status: 'healthy' | 'watch' | 'blocked' | 'unknown';
  alerts: string[];
}

const STATUS_META: Record<ControlTowerSurface['status'], { label: string; pill: string; text: string }> = {
  healthy: { label: 'Healthy', pill: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-700' },
  watch: { label: 'Watch', pill: 'bg-amber-100 border-amber-200', text: 'text-amber-700' },
  blocked: { label: 'Blocked', pill: 'bg-rose-100 border-rose-200', text: 'text-rose-700' },
  unknown: { label: 'Unknown', pill: 'bg-slate-100 border-slate-200', text: 'text-slate-600' },
};

function formatPercent(value?: number | null, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDate(value?: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const AiOpsDashboard: React.FC = () => {
  const [surfaces, setSurfaces] = useState<ControlTowerSurface[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ehrAxios.get('/model-monitoring/ai-ops/control-tower')
      .then((res: any) => setSurfaces(res.data?.surfaces ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const healthy = surfaces.filter(surface => surface.status === 'healthy').length;
    const watch = surfaces.filter(surface => surface.status === 'watch').length;
    const blocked = surfaces.filter(surface => surface.status === 'blocked').length;
    const knownMetrics = surfaces.filter(surface => surface.latestMetrics);
    const avgLatencyMs = knownMetrics.length > 0
      ? Math.round(
          knownMetrics.reduce((sum, surface) => sum + (surface.latestMetrics?.avgLatencyMs || 0), 0) / knownMetrics.length,
        )
      : null;
    const avgAbstentionRate = knownMetrics.length > 0
      ? knownMetrics.reduce((sum, surface) => sum + (surface.latestMetrics?.abstentionRate || 0), 0) / knownMetrics.length
      : null;

    return {
      healthy,
      watch,
      blocked,
      avgLatencyMs,
      avgAbstentionRate,
    };
  }, [surfaces]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <Brain className="h-6 w-6 animate-pulse mr-2" />
        Loading AI Ops control tower...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Ops Dashboard</h1>
          <p className="text-sm text-gray-500">Per-surface release, latency, abstention, and degradation status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Healthy Surfaces
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{summary.healthy}</p>
          <p className="mt-1 text-xs text-gray-500">Surfaces with no active release or degradation alerts.</p>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Watch List
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-600">{summary.watch}</p>
          <p className="mt-1 text-xs text-gray-500">Surfaces with high abstention, latency, breaker, or fairness alerts.</p>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Cpu className="h-4 w-4 text-rose-600" />
            Release Blocks
          </div>
          <p className="mt-3 text-3xl font-bold text-rose-600">{summary.blocked}</p>
          <p className="mt-1 text-xs text-gray-500">Surfaces currently blocked by release gate readiness.</p>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Gauge className="h-4 w-4 text-blue-600" />
            Fleet Baseline
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900">
            {summary.avgLatencyMs !== null ? `${summary.avgLatencyMs}ms` : 'N/A'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Avg latency · Avg abstention {summary.avgAbstentionRate !== null ? formatPercent(summary.avgAbstentionRate, 1) : 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {surfaces.map((surface) => {
          const statusMeta = STATUS_META[surface.status];
          const latest = surface.latestMetrics;
          const fairnessSignals = [
            latest?.fairnessAgeParity,
            latest?.fairnessGenderParity,
            latest?.fairnessSdohParity,
          ].filter((value) => value !== null && value !== undefined) as number[];
          const maxFairnessGap = fairnessSignals.length > 0 ? Math.max(...fairnessSignals) : null;

          return (
            <div key={surface.aiSurface} className="bg-white border rounded-lg p-4 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-slate-100 p-2">
                  <Activity className="h-4 w-4 text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-900">{surface.displayName}</h3>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.pill} ${statusMeta.text}`}>
                      {statusMeta.label}
                    </span>
                    {surface.releaseReadiness?.releaseStatus && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        Release {surface.releaseReadiness.releaseStatus}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{surface.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {surface.useCases.map((useCase) => (
                      <span
                        key={useCase}
                        className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-medium text-purple-700"
                      >
                        {useCase}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Calls</p>
                  <p className="mt-1 font-semibold text-gray-900">{latest?.totalCalls?.toLocaleString() ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Abstention</p>
                  <p className={`mt-1 font-semibold ${latest && latest.abstentionRate >= 0.2 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {latest ? formatPercent(latest.abstentionRate, 1) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Latency</p>
                  <p className={`mt-1 font-semibold ${latest && (latest.avgLatencyMs || 0) >= 3000 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {latest?.avgLatencyMs != null ? `${Math.round(latest.avgLatencyMs)}ms` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Accuracy</p>
                  <p className={`mt-1 font-semibold ${latest && latest.accuracy !== null && latest.accuracy < 0.7 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {latest?.accuracy != null ? formatPercent(latest.accuracy, 1) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Model Version</p>
                  <p className="mt-1 font-mono text-sm text-gray-900">{surface.modelVersion?.version || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Last Metric</p>
                  <p className="mt-1 font-semibold text-gray-900">{latest?.metricDate ? formatDate(latest.metricDate) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Offline Eval</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {surface.monitoring.offlineEvalSupported ? 'Supported' : 'Not enabled'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Fairness Gap</p>
                  <p className={`mt-1 font-semibold ${maxFairnessGap !== null && maxFairnessGap > 0.1 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {maxFairnessGap !== null ? formatPercent(maxFairnessGap, 1) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alerts</p>
                {surface.alerts.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No active control-tower alerts for this surface.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {surface.alerts.map((alert) => (
                      <li key={alert} className="text-sm text-slate-700">
                        {alert}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Governance</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-medium text-slate-800">Source of truth:</span>{' '}
                    {surface.audit?.sourceOfTruth || 'Not catalogued'}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">Audit:</span>{' '}
                    {surface.audit?.modelRegistry || 'N/A'} / {surface.audit?.promptAuditLog || 'N/A'}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">Disable paths:</span>{' '}
                    {surface.controls?.disablePaths?.length ? surface.controls.disablePaths.join(' • ') : 'Not specified'}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">Rollback paths:</span>{' '}
                    {surface.controls?.rollbackPaths?.length ? surface.controls.rollbackPaths.join(' • ') : 'Not specified'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
