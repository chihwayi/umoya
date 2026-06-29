import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ehrAxios } from '../services/api';
import {
  Award, RefreshCw, TrendingUp, TrendingDown, Target,
  Activity, CheckCircle, AlertTriangle, Zap,
} from 'lucide-react';

interface MetricRow {
  name: string;
  label: string;
  value: number;
  peer_p25: number | null;
  peer_p50: number | null;
  peer_p75: number | null;
  national_p75: number | null;
  percentile_rank: number;
  status: string;
  higher_is_better: boolean;
}

interface Scorecard {
  facility_id: string;
  period: string;
  metrics: MetricRow[];
  overall_score: number;
}

interface TrendPoint {
  period: string;
  raw_value: number;
  percentile_rank: number;
  status: string;
}

const authHeaders = (token: string | null, tenantId: string) => ({
  Authorization: `Bearer ${token}`,
  'x-tenant-id': tenantId,
});

function statusBadge(status: string) {
  switch (status) {
    case 'above_target': return <span className="text-xs text-teal-400 font-semibold">▲ Above</span>;
    case 'near_target': return <span className="text-xs text-yellow-400 font-semibold">~ Near</span>;
    case 'below_target': return <span className="text-xs text-red-400 font-semibold">▼ Below</span>;
    default: return <span className="text-xs text-gray-500">—</span>;
  }
}

function rankColor(rank: number) {
  if (rank >= 75) return 'text-teal-400';
  if (rank >= 50) return 'text-blue-400';
  if (rank >= 25) return 'text-yellow-400';
  return 'text-red-400';
}

function fmtVal(val: number, metric: MetricRow): string {
  if (metric.name === 'average_lab_tat_hours') return val.toFixed(1) + 'h';
  return (val * 100).toFixed(1) + '%';
}

export default function BenchmarkingDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token');
  const tenantId = tenantSlug ?? '';

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7).replace('-', ''));
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);

  const hdrs = useCallback(() => authHeaders(token, tenantId), [token, tenantId]);

  const loadScorecard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ehrAxios.get(
        `/tenants/${tenantId}/benchmarking/scorecard?facilityId=${tenantId}&period=${period}`,
        { headers: hdrs() },
      );
      setScorecard(res.data);
    } catch { /* handled silently */ }
    setLoading(false);
  }, [tenantId, period, hdrs]);

  const computeSnapshot = async () => {
    setComputing(true);
    try {
      await ehrAxios.post(
        `/tenants/${tenantId}/benchmarking/compute?facilityId=${tenantId}&period=${period}`,
        {},
        { headers: hdrs() },
      );
      await loadScorecard();
    } catch { /* handled silently */ }
    setComputing(false);
  };

  const loadTrend = useCallback(async (metric: string) => {
    try {
      const res = await ehrAxios.get(
        `/tenants/${tenantId}/benchmarking/trend?facilityId=${tenantId}&metric=${metric}&periods=12`,
        { headers: hdrs() },
      );
      setTrend(res.data ?? []);
    } catch { /* handled silently */ }
  }, [tenantId, hdrs]);

  useEffect(() => { loadScorecard(); }, [period, loadScorecard]);
  useEffect(() => {
    if (selectedMetric) loadTrend(selectedMetric);
  }, [selectedMetric, loadTrend]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Award size={24} className="text-teal-400" />
          <h1 className="text-2xl font-bold text-white">Multi-Facility Benchmarking</h1>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Period (YYYYMM)</label>
            <input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm w-28"
              maxLength={6}
            />
          </div>
          <button
            onClick={loadScorecard}
            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Load
          </button>
          <button
            onClick={computeSnapshot}
            disabled={computing}
            className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
          >
            <Zap size={14} /> {computing ? 'Computing…' : 'Compute Snapshot'}
          </button>
        </div>

        {/* Overall score */}
        {scorecard && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3 md:col-span-1">
              <Activity size={24} className={rankColor(scorecard.overall_score)} />
              <div>
                <div className="text-xs text-gray-400">Overall Percentile Score</div>
                <div className={`text-3xl font-bold ${rankColor(scorecard.overall_score)}`}>
                  {scorecard.overall_score.toFixed(0)}
                </div>
              </div>
            </div>
            {[
              {
                label: 'Above Target',
                count: scorecard.metrics.filter(m => m.status === 'above_target').length,
                icon: <CheckCircle size={18} className="text-teal-400" />,
              },
              {
                label: 'Near Target',
                count: scorecard.metrics.filter(m => m.status === 'near_target').length,
                icon: <Target size={18} className="text-yellow-400" />,
              },
              {
                label: 'Below Target',
                count: scorecard.metrics.filter(m => m.status === 'below_target').length,
                icon: <AlertTriangle size={18} className="text-red-400" />,
              },
            ].map(c => (
              <div key={c.label} className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
                {c.icon}
                <div>
                  <div className="text-xs text-gray-400">{c.label}</div>
                  <div className="text-2xl font-bold text-white">{c.count}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Metric scorecard */}
        {scorecard && scorecard.metrics.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Metric Scorecard — click a row for trend</h3>
            <div className="space-y-3">
              {scorecard.metrics.map(m => {
                const isSelected = selectedMetric === m.name;
                const displayVal = m.name === 'average_lab_tat_hours' ? m.value : m.value;
                const natTarget = m.national_p75;
                const maxBar = natTarget
                  ? Math.max(displayVal, natTarget) * 1.1
                  : displayVal * 1.1 || 1;

                return (
                  <div
                    key={m.name}
                    onClick={() => setSelectedMetric(isSelected ? null : m.name)}
                    className={`rounded-lg p-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-900/40 border border-teal-700' : 'bg-gray-700/40 hover:bg-gray-700/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-200">{m.label}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${rankColor(m.percentile_rank)}`}>
                          P{m.percentile_rank.toFixed(0)}
                        </span>
                        {statusBadge(m.status)}
                      </div>
                    </div>
                    <div className="relative h-4 bg-gray-600 rounded-full overflow-hidden">
                      {/* Facility bar */}
                      <div
                        className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                          m.status === 'above_target' ? 'bg-teal-500' :
                          m.status === 'near_target' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((displayVal / maxBar) * 100, 100)}%` }}
                      />
                      {/* National P75 marker */}
                      {natTarget && (
                        <div
                          className="absolute top-0 h-full w-0.5 bg-white opacity-60"
                          style={{ left: `${Math.min((natTarget / maxBar) * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Facility: <span className="text-gray-200 font-medium">{fmtVal(displayVal, m)}</span></span>
                      {m.peer_p50 != null && (
                        <span>Peer P50: {fmtVal(m.peer_p50, m)}</span>
                      )}
                      {natTarget != null && (
                        <span>National P75: <span className="text-white">{fmtVal(natTarget, m)}</span></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Trend panel */}
        {selectedMetric && trend.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-teal-400" /> 12-Month Trend: {selectedMetric}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Period</th>
                    <th className="text-right py-2 pr-4">Value</th>
                    <th className="text-right py-2 pr-4">Percentile</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((pt, i) => {
                    const prev = i > 0 ? trend[i - 1] : null;
                    const delta = prev ? pt.raw_value - prev.raw_value : 0;
                    const metricDef = scorecard?.metrics.find(m => m.name === selectedMetric);
                    const up = delta >= 0;
                    const good = metricDef ? (metricDef.higher_is_better ? up : !up) : up;
                    return (
                      <tr key={pt.period} className="border-b border-gray-700/50">
                        <td className="py-2 pr-4 text-gray-300">{pt.period}</td>
                        <td className="py-2 pr-4 text-right text-gray-200">
                          {metricDef?.name === 'average_lab_tat_hours'
                            ? pt.raw_value.toFixed(1) + 'h'
                            : (pt.raw_value * 100).toFixed(1) + '%'}
                          {prev && (
                            <span className={`ml-1 text-xs ${good ? 'text-teal-400' : 'text-red-400'}`}>
                              {good ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                            </span>
                          )}
                        </td>
                        <td className={`py-2 pr-4 text-right font-bold ${rankColor(pt.percentile_rank)}`}>
                          P{pt.percentile_rank.toFixed(0)}
                        </td>
                        <td className="py-2">{statusBadge(pt.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {scorecard && scorecard.metrics.length === 0 && !loading && (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            No snapshot data for {period}. Click "Compute Snapshot" to generate benchmarks.
          </div>
        )}
      </div>
    </div>
  );
}
