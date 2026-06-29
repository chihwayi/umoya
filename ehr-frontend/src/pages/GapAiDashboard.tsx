import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ehrAxios } from '../services/api';
import {
  Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  RefreshCw, Brain, Zap, Target, Clock, ChevronRight, BarChart2,
} from 'lucide-react';

type TabKey = 'gaps' | 'ai';

interface GapSummary {
  total_open: number;
  closed_this_period: number;
  closure_rate_pct: number;
  avg_days_to_close: number;
  by_gap_type: { gap_type: string; open: number; closed: number }[];
}

interface PriorityGap {
  id: string;
  patient_id: string;
  gap_type: string;
  days_overdue: number;
  opened_at: string;
  last_intervention_at: string | null;
}

interface ModelSummary {
  name: string;
  version: string;
  lastPeriod: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  auc: number | null;
  driftFlag: boolean;
  totalPredictions: number;
  verificationRate: number;
}

interface AiSummary {
  models: ModelSummary[];
  last30d_total: number;
  last30d_verified: number;
}

interface TrendPoint {
  period: string;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
  drift_flag: boolean;
}

function pct(n: number | null): string {
  if (n === null) return '—';
  return (n * 100).toFixed(1) + '%';
}

function aucBadge(auc: number | null, drift: boolean) {
  if (auc === null) return <span className="text-gray-400 text-xs">—</span>;
  const color = drift ? 'text-red-400' : auc >= 0.8 ? 'text-teal-400' : auc >= 0.7 ? 'text-yellow-400' : 'text-red-400';
  return (
    <span className={`font-bold text-sm ${color}`}>
      {auc.toFixed(3)}{drift && <AlertTriangle size={12} className="inline ml-1 text-red-400" />}
    </span>
  );
}

const authHeaders = (token: string | null, tenantId: string) => ({
  Authorization: `Bearer ${token}`,
  'x-tenant-id': tenantId,
});

export default function GapAiDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token');
  const tenantId = tenantSlug ?? '';

  const [tab, setTab] = useState<TabKey>('gaps');

  // Care Gap state
  const [gapPeriod, setGapPeriod] = useState(() => new Date().toISOString().slice(0, 7).replace('-', ''));
  const [gapSummary, setGapSummary] = useState<GapSummary | null>(null);
  const [priorityGaps, setPriorityGaps] = useState<PriorityGap[]>([]);
  const [gapLoading, setGapLoading] = useState(false);

  // AI state
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [computing, setComputing] = useState(false);

  const hdrs = useCallback(() => authHeaders(token, tenantId), [token, tenantId]);

  const loadGaps = useCallback(async () => {
    setGapLoading(true);
    try {
      const [sumRes, priRes] = await Promise.all([
        ehrAxios.get(`/population-health/gaps/summary?period=${gapPeriod}`, { headers: hdrs() }),
        ehrAxios.get(`/population-health/gaps/priority?limit=20`, { headers: hdrs() }),
      ]);
      setGapSummary(sumRes.data);
      setPriorityGaps(priRes.data ?? []);
    } catch { /* handled silently */ }
    setGapLoading(false);
  }, [gapPeriod, hdrs]);

  const loadAi = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await ehrAxios.get(`/tenants/${tenantId}/ai/performance`, { headers: hdrs() });
      setAiSummary(res.data);
    } catch { /* handled silently */ }
    setAiLoading(false);
  }, [tenantId, hdrs]);

  const loadTrend = useCallback(async (model: string) => {
    try {
      const res = await ehrAxios.get(`/tenants/${tenantId}/ai/performance/${encodeURIComponent(model)}/trend?periods=6`, { headers: hdrs() });
      setTrendData(res.data ?? []);
    } catch { /* handled silently */ }
  }, [tenantId, hdrs]);

  const computeSnapshot = async () => {
    if (!selectedModel) return;
    setComputing(true);
    try {
      const period = new Date().toISOString().slice(0, 7);
      await ehrAxios.post(`/tenants/${tenantId}/ai/performance/compute?model=${encodeURIComponent(selectedModel)}&period=${period}`, {}, { headers: hdrs() });
      await loadAi();
      await loadTrend(selectedModel);
    } catch { /* handled silently */ }
    setComputing(false);
  };

  const autoVerify = async () => {
    try {
      await ehrAxios.post(`/tenants/${tenantId}/ai/performance/auto-verify`, {}, { headers: hdrs() });
      await loadAi();
    } catch { /* handled silently */ }
  };

  useEffect(() => {
    if (tab === 'gaps') loadGaps();
  }, [tab, loadGaps]);

  useEffect(() => {
    if (tab === 'ai') loadAi();
  }, [tab, loadAi]);

  useEffect(() => {
    if (selectedModel) loadTrend(selectedModel);
  }, [selectedModel, loadTrend]);

  const TabButton = ({ k, label }: { k: TabKey; label: string }) => (
    <button
      onClick={() => setTab(k)}
      className={`px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
        tab === k
          ? 'border-teal-400 text-teal-300 bg-gray-800'
          : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Brain size={24} className="text-teal-400" />
          <h1 className="text-2xl font-bold text-white">Care Gap & AI Performance</h1>
        </div>

        <div className="flex gap-1 border-b border-gray-700 mb-6">
          <TabButton k="gaps" label="Care Gap Closure" />
          <TabButton k="ai" label="AI Model Performance" />
        </div>

        {/* ── CARE GAP TAB ─────────────────────────────────────────── */}
        {tab === 'gaps' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">Period (YYYYMM)</label>
              <input
                value={gapPeriod}
                onChange={e => setGapPeriod(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm w-32"
                maxLength={6}
              />
              <button
                onClick={loadGaps}
                className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white px-3 py-1 rounded text-sm"
              >
                <RefreshCw size={14} /> Load
              </button>
            </div>

            {gapLoading && <div className="text-gray-400 text-sm">Loading...</div>}

            {gapSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Open Gaps', value: gapSummary.total_open, icon: <AlertTriangle size={18} className="text-yellow-400" /> },
                  { label: 'Closed This Period', value: gapSummary.closed_this_period, icon: <CheckCircle size={18} className="text-teal-400" /> },
                  { label: 'Closure Rate', value: `${gapSummary.closure_rate_pct?.toFixed(1) ?? 0}%`, icon: <Target size={18} className="text-blue-400" /> },
                  { label: 'Avg Days to Close', value: `${Math.round(gapSummary.avg_days_to_close ?? 0)}d`, icon: <Clock size={18} className="text-purple-400" /> },
                ].map(c => (
                  <div key={c.label} className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
                    {c.icon}
                    <div>
                      <div className="text-xs text-gray-400">{c.label}</div>
                      <div className="text-xl font-bold text-white">{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {gapSummary?.by_gap_type && gapSummary.by_gap_type.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <BarChart2 size={16} className="text-teal-400" /> Gap Types
                </h3>
                <div className="space-y-2">
                  {gapSummary.by_gap_type.map(g => {
                    const total = g.open + g.closed;
                    const closedPct = total > 0 ? (g.closed / total) * 100 : 0;
                    return (
                      <div key={g.gap_type} className="flex items-center gap-3">
                        <div className="w-40 text-xs text-gray-300 truncate">{g.gap_type}</div>
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-teal-500 h-2 rounded-full"
                            style={{ width: `${closedPct}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-400 w-24 text-right">
                          {g.closed}/{total} ({closedPct.toFixed(0)}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {priorityGaps.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-400" /> High-Priority Open Gaps (&gt;90 days)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs border-b border-gray-700">
                        <th className="text-left py-2 pr-4">Patient ID</th>
                        <th className="text-left py-2 pr-4">Gap Type</th>
                        <th className="text-right py-2 pr-4">Days Overdue</th>
                        <th className="text-left py-2">Last Intervention</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priorityGaps.map(g => (
                        <tr key={g.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-2 pr-4 font-mono text-xs text-gray-300">{g.patient_id.slice(0, 8)}…</td>
                          <td className="py-2 pr-4 text-gray-200">{g.gap_type}</td>
                          <td className="py-2 pr-4 text-right">
                            <span className={`font-bold ${g.days_overdue > 180 ? 'text-red-400' : 'text-yellow-400'}`}>
                              {g.days_overdue}d
                            </span>
                          </td>
                          <td className="py-2 text-gray-400 text-xs">
                            {g.last_intervention_at
                              ? new Date(g.last_intervention_at).toLocaleDateString()
                              : <span className="text-red-400">None</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI PERFORMANCE TAB ───────────────────────────────────── */}
        {tab === 'ai' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={loadAi}
                className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                onClick={autoVerify}
                className="flex items-center gap-1 bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
              >
                <Zap size={14} /> Auto-Verify Pending
              </button>
              {selectedModel && (
                <button
                  onClick={computeSnapshot}
                  disabled={computing}
                  className="flex items-center gap-1 bg-teal-700 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                >
                  <Activity size={14} /> {computing ? 'Computing…' : `Compute Snapshot (${selectedModel})`}
                </button>
              )}
            </div>

            {aiLoading && <div className="text-gray-400 text-sm">Loading...</div>}

            {aiSummary && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
                    <Brain size={18} className="text-teal-400" />
                    <div>
                      <div className="text-xs text-gray-400">Predictions (30d)</div>
                      <div className="text-xl font-bold text-white">{aiSummary.last30d_total.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle size={18} className="text-green-400" />
                    <div>
                      <div className="text-xs text-gray-400">Verification Rate (30d)</div>
                      <div className="text-xl font-bold text-white">
                        {aiSummary.last30d_total > 0
                          ? ((aiSummary.last30d_verified / aiSummary.last30d_total) * 100).toFixed(1) + '%'
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Model Registry</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-xs border-b border-gray-700">
                          <th className="text-left py-2 pr-4">Model</th>
                          <th className="text-left py-2 pr-4">Version</th>
                          <th className="text-left py-2 pr-4">Period</th>
                          <th className="text-right py-2 pr-4">Precision</th>
                          <th className="text-right py-2 pr-4">Recall</th>
                          <th className="text-right py-2 pr-4">F1</th>
                          <th className="text-right py-2 pr-4">AUC</th>
                          <th className="text-right py-2 pr-4">Verified</th>
                          <th className="text-left py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiSummary.models.map(m => (
                          <tr
                            key={m.name}
                            onClick={() => setSelectedModel(m.name === selectedModel ? null : m.name)}
                            className={`border-b border-gray-700/50 cursor-pointer transition-colors ${
                              selectedModel === m.name ? 'bg-teal-900/30' : 'hover:bg-gray-700/30'
                            }`}
                          >
                            <td className="py-2 pr-4 font-medium text-gray-200">{m.name}</td>
                            <td className="py-2 pr-4 text-gray-400 text-xs">{m.version}</td>
                            <td className="py-2 pr-4 text-gray-400 text-xs">{m.lastPeriod}</td>
                            <td className="py-2 pr-4 text-right text-gray-200">{pct(m.precision)}</td>
                            <td className="py-2 pr-4 text-right text-gray-200">{pct(m.recall)}</td>
                            <td className="py-2 pr-4 text-right text-gray-200">{pct(m.f1)}</td>
                            <td className="py-2 pr-4 text-right">{aucBadge(m.auc, m.driftFlag)}</td>
                            <td className="py-2 pr-4 text-right text-gray-400 text-xs">{m.verificationRate}%</td>
                            <td className="py-2 text-teal-400">
                              <ChevronRight size={14} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedModel && trendData.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <TrendingUp size={16} className="text-teal-400" /> {selectedModel} — 6-Period Trend
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 text-xs border-b border-gray-700">
                            <th className="text-left py-2 pr-4">Period</th>
                            <th className="text-right py-2 pr-4">Precision</th>
                            <th className="text-right py-2 pr-4">Recall</th>
                            <th className="text-right py-2 pr-4">F1</th>
                            <th className="text-right py-2 pr-4">AUC</th>
                            <th className="text-left py-2">Drift</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trendData.map((pt, i) => {
                            const prev = i > 0 ? trendData[i - 1] : null;
                            const aucDelta = prev ? (pt.auc ?? 0) - (prev.auc ?? 0) : 0;
                            return (
                              <tr key={pt.period} className="border-b border-gray-700/50">
                                <td className="py-2 pr-4 text-gray-300">{pt.period}</td>
                                <td className="py-2 pr-4 text-right">{pct(pt.precision)}</td>
                                <td className="py-2 pr-4 text-right">{pct(pt.recall)}</td>
                                <td className="py-2 pr-4 text-right">{pct(pt.f1)}</td>
                                <td className="py-2 pr-4 text-right">
                                  <span className={`font-bold ${pt.drift_flag ? 'text-red-400' : 'text-teal-400'}`}>
                                    {pt.auc?.toFixed(3) ?? '—'}
                                  </span>
                                  {prev && (
                                    <span className={`ml-1 text-xs ${aucDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {aucDelta >= 0 ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                                      {Math.abs(aucDelta * 100).toFixed(1)}pp
                                    </span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {pt.drift_flag
                                    ? <span className="text-red-400 text-xs font-semibold">DRIFT</span>
                                    : <span className="text-green-400 text-xs">OK</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedModel && trendData.length === 0 && (
                  <div className="bg-gray-800 rounded-lg p-4 text-gray-400 text-sm">
                    No snapshot history for <span className="text-teal-300">{selectedModel}</span>.
                    Use "Compute Snapshot" to generate the first entry.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
