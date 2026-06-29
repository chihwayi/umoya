import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, CheckCircle, TrendingDown, TrendingUp,
  ShieldCheck, BarChart2, Users, Clock,
} from 'lucide-react';
import { ehrAxios } from '../services/api';

type TabKey = 'overview' | 'detail' | 'calibration' | 'fairness' | 'audit';

const authHeaders = (token: string | null, tenantId: string) => ({
  Authorization: `Bearer ${token}`,
  'x-tenant-id': tenantId,
});

const fmtPct = (v: number | null | undefined) =>
  v != null ? `${(v * 100).toFixed(1)}%` : '—';
const fmtNum = (v: number | null | undefined) =>
  v != null ? v.toFixed(3) : '—';

const StatusBadge: React.FC<{ drift: boolean }> = ({ drift }) =>
  drift ? (
    <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
      <AlertTriangle className="h-3 w-3" /> DRIFT
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-teal-400 font-semibold">
      <CheckCircle className="h-3 w-3" /> OK
    </span>
  );

const AiGovernanceDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token');
  const tenantId = tenantSlug ?? '';

  const [tab, setTab] = useState<TabKey>('overview');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  const [overview, setOverview] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [calibration, setCalibration] = useState<any[]>([]);
  const [fairness, setFairness] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Review modal state
  const [reviewReason, setReviewReason] = useState('drift_detected');
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionType, setActionType] = useState('approved');
  const [actionNotes, setActionNotes] = useState('');
  const [submitMsg, setSubmitMsg] = useState('');

  const hdrs = authHeaders(token, tenantId);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ehrAxios.get(`/tenants/${tenantId}/ai/performance`, { headers: hdrs });
      setOverview(data);
      if (!selectedModel && data.models?.length) setSelectedModel(data.models[0].name);
    } catch { /* silent */ }
    setLoading(false);
  }, [tenantId, token]);

  const loadDetail = useCallback(async () => {
    if (!selectedModel) return;
    try {
      const { data } = await ehrAxios.get(
        `/tenants/${tenantId}/ai/performance/${selectedModel}/trend?periods=12`,
        { headers: hdrs },
      );
      setTrend(data);
    } catch { /* silent */ }
  }, [tenantId, token, selectedModel]);

  const loadCalibration = useCallback(async () => {
    if (!selectedModel) return;
    try {
      const { data } = await ehrAxios.get(
        `/tenants/${tenantId}/ai/${selectedModel}/calibration?period=${period}`,
        { headers: hdrs },
      );
      setCalibration(data);
    } catch { /* silent */ }
  }, [tenantId, token, selectedModel, period]);

  const loadFairness = useCallback(async () => {
    if (!selectedModel) return;
    try {
      const { data } = await ehrAxios.get(
        `/tenants/${tenantId}/ai/${selectedModel}/fairness?period=${period}`,
        { headers: hdrs },
      );
      setFairness(data);
    } catch { /* silent */ }
  }, [tenantId, token, selectedModel, period]);

  const loadAudit = useCallback(async () => {
    if (!selectedModel) return;
    try {
      const { data } = await ehrAxios.get(
        `/tenants/${tenantId}/ai/governance/${selectedModel}/history`,
        { headers: hdrs },
      );
      setAuditLog(data);
    } catch { /* silent */ }
  }, [tenantId, token, selectedModel]);

  useEffect(() => { loadOverview(); }, []);

  useEffect(() => {
    if (tab === 'detail') loadDetail();
    else if (tab === 'calibration') loadCalibration();
    else if (tab === 'fairness') loadFairness();
    else if (tab === 'audit') loadAudit();
  }, [tab, selectedModel]);

  const submitReview = async () => {
    try {
      await ehrAxios.post(
        `/tenants/${tenantId}/ai/governance/${selectedModel}/review-request`,
        { reason: reviewReason, raised_by: token ? 'current_user' : 'system', notes: reviewNotes },
        { headers: hdrs },
      );
      setSubmitMsg('Review request submitted.');
      setReviewNotes('');
      loadAudit();
    } catch { setSubmitMsg('Error submitting review.'); }
  };

  const submitAction = async () => {
    try {
      await ehrAxios.put(
        `/tenants/${tenantId}/ai/governance/${selectedModel}/status`,
        { action: actionType, reviewed_by: 'current_user', notes: actionNotes },
        { headers: hdrs },
      );
      setSubmitMsg(`Action "${actionType}" recorded.`);
      setActionNotes('');
      loadAudit();
    } catch { setSubmitMsg('Error recording action.'); }
  };

  const models = overview?.models ?? [];
  const driftCount = models.filter((m: any) => m.driftFlag).length;
  const selectedModelData = models.find((m: any) => m.name === selectedModel);

  const TabButton: React.FC<{ id: TabKey; label: string }> = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-t ${
        tab === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  // Calibration SVG
  const CalibrationSvg: React.FC = () => {
    const w = 320; const h = 200; const pad = 30;
    const chartW = w - pad * 2; const chartH = h - pad * 2;
    return (
      <svg width={w} height={h} className="overflow-visible">
        {/* Perfect calibration line */}
        <line x1={pad} y1={pad + chartH} x2={pad + chartW} y2={pad} stroke="#64748b" strokeDasharray="4 3" />
        {/* Axes */}
        <line x1={pad} y1={pad} x2={pad} y2={pad + chartH} stroke="#475569" />
        <line x1={pad} y1={pad + chartH} x2={pad + chartW} y2={pad + chartH} stroke="#475569" />
        {/* Data points */}
        {calibration.map((pt, i) => {
          const x = pad + ((i + 0.5) / 10) * chartW;
          const y = pt.actual_rate != null ? pad + (1 - pt.actual_rate) * chartH : null;
          if (y == null) return null;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={5} fill="#14b8a6" opacity={0.9} />
              <text x={x} y={pad + chartH + 12} textAnchor="middle" fontSize={8} fill="#94a3b8">
                {pt.predicted_bin?.split('–')[0]}
              </text>
            </g>
          );
        })}
        <text x={pad + chartW / 2} y={h - 2} textAnchor="middle" fontSize={9} fill="#64748b">Predicted %</text>
        <text x={8} y={pad + chartH / 2} textAnchor="middle" fontSize={9} fill="#64748b" transform={`rotate(-90,8,${pad + chartH / 2})`}>Actual %</text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-teal-400" /> AI Model Governance Registry
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {models.length} models active · {driftCount > 0
                ? <span className="text-red-400">{driftCount} drift alert{driftCount > 1 ? 's' : ''}</span>
                : <span className="text-teal-400">No drift alerts</span>}
            </p>
          </div>

          {/* Model selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">Model</label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-sm text-white"
            >
              {models.map((m: any) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
            <label className="text-xs text-slate-400">Period</label>
            <input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-sm w-28 text-white"
              placeholder="YYYY-MM"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700 flex gap-1 overflow-x-auto">
          <TabButton id="overview" label="Model Overview" />
          <TabButton id="detail" label="Performance Detail" />
          <TabButton id="calibration" label="Calibration" />
          <TabButton id="fairness" label="Fairness" />
          <TabButton id="audit" label="Audit Trail" />
        </div>

        {/* ── Model Overview ── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {loading && <div className="text-slate-400 text-sm">Loading…</div>}

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Active Models', val: models.length, icon: <Activity className="h-5 w-5 text-teal-400" /> },
                { label: 'Drift Alerts', val: driftCount, icon: <AlertTriangle className="h-5 w-5 text-red-400" />, red: driftCount > 0 },
                { label: 'Predictions (30d)', val: overview?.last30d_total ?? 0, icon: <BarChart2 className="h-5 w-5 text-blue-400" /> },
                { label: 'Verified (30d)', val: overview?.last30d_verified ?? 0, icon: <CheckCircle className="h-5 w-5 text-green-400" /> },
              ].map(c => (
                <div key={c.label} className="bg-slate-800 rounded-lg p-4 flex items-start gap-3">
                  {c.icon}
                  <div>
                    <div className="text-xs text-slate-400">{c.label}</div>
                    <div className={`text-2xl font-bold ${c.red ? 'text-red-400' : 'text-white'}`}>{c.val}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Models table */}
            <div className="bg-slate-800 rounded-lg p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2 pr-4">Model</th>
                    <th className="text-right py-2 pr-4">AUC</th>
                    <th className="text-right py-2 pr-4">F1</th>
                    <th className="text-right py-2 pr-4">Precision</th>
                    <th className="text-right py-2 pr-4">Recall</th>
                    <th className="text-right py-2 pr-4">Verif. Rate</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m: any) => (
                    <tr key={m.name} className={`border-b border-slate-700/50 ${m.driftFlag ? 'bg-red-900/10' : ''}`}>
                      <td className="py-2 pr-4 font-medium text-slate-200">{m.name}</td>
                      <td className={`py-2 pr-4 text-right font-bold ${m.auc >= 0.8 ? 'text-teal-400' : m.auc >= 0.7 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {fmtNum(m.auc)}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(m.f1)}</td>
                      <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(m.precision)}</td>
                      <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(m.recall)}</td>
                      <td className="py-2 pr-4 text-right text-slate-300">{m.verificationRate ?? 0}%</td>
                      <td className="py-2 pr-4"><StatusBadge drift={m.driftFlag} /></td>
                      <td className="py-2">
                        <button
                          onClick={() => { setSelectedModel(m.name); setTab('detail'); }}
                          className="text-xs text-teal-400 hover:underline"
                        >
                          Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                  {models.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-slate-400">No model snapshots yet. Run performance compute to populate.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Drift alerts */}
            {driftCount > 0 && models.filter((m: any) => m.driftFlag).map((m: any) => (
              <div key={m.name} className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-red-300">{m.name}: AUC drift detected</div>
                  <div className="text-sm text-slate-300 mt-1">Current AUC {fmtNum(m.auc)} — review recommended.</div>
                </div>
                <button
                  onClick={() => { setSelectedModel(m.name); setTab('audit'); }}
                  className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded"
                >
                  Raise Review
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Performance Detail ── */}
        {tab === 'detail' && (
          <div className="space-y-4">
            {selectedModelData && (
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold text-slate-100">{selectedModelData.name}</h2>
                  <span className="text-xs text-slate-400">v{selectedModelData.version}</span>
                  <StatusBadge drift={selectedModelData.driftFlag} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'AUC-ROC', val: fmtNum(selectedModelData.auc), good: (selectedModelData.auc ?? 0) >= 0.75 },
                    { label: 'Precision', val: fmtNum(selectedModelData.precision), good: (selectedModelData.precision ?? 0) >= 0.65 },
                    { label: 'Recall', val: fmtNum(selectedModelData.recall), good: (selectedModelData.recall ?? 0) >= 0.65 },
                    { label: 'F1 Score', val: fmtNum(selectedModelData.f1), good: (selectedModelData.f1 ?? 0) >= 0.65 },
                  ].map(c => (
                    <div key={c.label} className="bg-slate-700 rounded p-3">
                      <div className="text-xs text-slate-400">{c.label}</div>
                      <div className={`text-xl font-bold ${c.good ? 'text-teal-400' : 'text-red-400'}`}>{c.val}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-slate-300">
                  <div>Total Predictions: <span className="font-bold text-white">{selectedModelData.totalPredictions}</span></div>
                  <div>Verification Rate: <span className="font-bold text-white">{selectedModelData.verificationRate}%</span></div>
                  <div>Last Period: <span className="font-bold text-white">{selectedModelData.lastPeriod}</span></div>
                </div>
              </div>
            )}

            {/* AUC Trend table */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-400" /> AUC Trend — Last 12 Periods
              </h3>
              {trend.length === 0 ? (
                <div className="text-slate-400 text-sm">No trend data yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 pr-4">Period</th>
                        <th className="text-right py-2 pr-4">AUC</th>
                        <th className="text-right py-2 pr-4">Precision</th>
                        <th className="text-right py-2 pr-4">Recall</th>
                        <th className="text-right py-2 pr-4">F1</th>
                        <th className="text-left py-2">Drift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trend.map((r: any, i: number) => {
                        const prev = trend[i - 1];
                        const delta = prev?.auc != null && r.auc != null ? (Number(r.auc) - Number(prev.auc)) : null;
                        return (
                          <tr key={r.period} className="border-b border-slate-700/50">
                            <td className="py-2 pr-4 text-slate-300">{r.period}</td>
                            <td className="py-2 pr-4 text-right font-bold text-slate-100">
                              {fmtNum(r.auc)}
                              {delta != null && (
                                <span className={`ml-1 text-xs ${delta >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                  {delta >= 0 ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                                  {delta >= 0 ? '+' : ''}{(delta * 100).toFixed(1)}pp
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(r.precision)}</td>
                            <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(r.recall)}</td>
                            <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(r.f1)}</td>
                            <td className="py-2">{r.drift_flag ? <AlertTriangle className="h-4 w-4 text-red-400" /> : null}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Calibration ── */}
        {tab === 'calibration' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Calibration Plot — {selectedModel} ({period})</h3>
              <p className="text-xs text-slate-400 mb-4">
                A perfectly calibrated model: patients predicted at X% should have X% actual positive rate. Grey dashed = perfect; teal points = actual.
              </p>
              {calibration.length === 0 ? (
                <div className="text-slate-400 text-sm">
                  No calibration data for this model/period. Requires verified predictions with probability scores.
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-6">
                  <CalibrationSvg />
                  <div className="flex-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 border-b border-slate-700">
                          <th className="text-left py-2 pr-4">Predicted Bin</th>
                          <th className="text-right py-2 pr-4">Actual Rate</th>
                          <th className="text-right py-2">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calibration.map((pt: any, i: number) => {
                          const diff = pt.actual_rate != null ? pt.actual_rate - ((i + 0.5) / 10) : null;
                          return (
                            <tr key={i} className="border-b border-slate-700/50">
                              <td className="py-2 pr-4 text-slate-300">{pt.predicted_bin}</td>
                              <td className={`py-2 pr-4 text-right font-bold ${diff != null && Math.abs(diff) < 0.05 ? 'text-teal-400' : 'text-yellow-400'}`}>
                                {pt.actual_rate != null ? fmtPct(pt.actual_rate) : '—'}
                              </td>
                              <td className="py-2 text-right text-slate-400">{pt.count}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Fairness ── */}
        {tab === 'fairness' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" /> Model Fairness — {selectedModel} ({period})
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                AUC gap &gt;0.05 across groups indicates potential demographic bias. Threshold: flag if max AUC gap &gt; 0.05.
              </p>

              {!fairness ? (
                <div className="text-slate-400 text-sm">Loading fairness data…</div>
              ) : (
                <>
                  {/* By Sex */}
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">By Sex</h4>
                    {fairness.by_sex?.length === 0 ? (
                      <div className="text-slate-500 text-sm">Insufficient data.</div>
                    ) : (
                      <>
                        <table className="w-full text-sm mb-1">
                          <thead>
                            <tr className="text-xs text-slate-400 border-b border-slate-700">
                              <th className="text-left py-2 pr-4">Group</th>
                              <th className="text-right py-2 pr-4">AUC</th>
                              <th className="text-right py-2 pr-4">Precision</th>
                              <th className="text-right py-2 pr-4">Recall</th>
                              <th className="text-right py-2">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fairness.by_sex.map((r: any) => (
                              <tr key={r.group} className="border-b border-slate-700/50">
                                <td className="py-2 pr-4 text-slate-200">{r.group}</td>
                                <td className="py-2 pr-4 text-right font-bold text-slate-100">{fmtNum(r.auc)}</td>
                                <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(r.precision)}</td>
                                <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(r.recall)}</td>
                                <td className="py-2 text-right text-slate-400">{r.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {fairness.by_sex.length >= 2 && (() => {
                          const aucs = fairness.by_sex.map((r: any) => r.auc);
                          const gap = Math.max(...aucs) - Math.min(...aucs);
                          return (
                            <div className={`text-xs ${gap > 0.05 ? 'text-yellow-400' : 'text-teal-400'}`}>
                              Max AUC gap: {gap.toFixed(3)} — {gap > 0.05 ? 'Monitor — exceeds 0.05 threshold' : 'Acceptable'}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {/* By Age Band */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">By Age Band</h4>
                    {fairness.by_age_band?.length === 0 ? (
                      <div className="text-slate-500 text-sm">Insufficient data.</div>
                    ) : (
                      <>
                        <table className="w-full text-sm mb-1">
                          <thead>
                            <tr className="text-xs text-slate-400 border-b border-slate-700">
                              <th className="text-left py-2 pr-4">Age Band</th>
                              <th className="text-right py-2 pr-4">AUC</th>
                              <th className="text-right py-2 pr-4">Precision</th>
                              <th className="text-right py-2 pr-4">Recall</th>
                              <th className="text-right py-2">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fairness.by_age_band.map((r: any) => (
                              <tr key={r.group} className="border-b border-slate-700/50">
                                <td className="py-2 pr-4 text-slate-200">{r.group}</td>
                                <td className="py-2 pr-4 text-right font-bold text-slate-100">{fmtNum(r.auc)}</td>
                                <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(r.precision)}</td>
                                <td className="py-2 pr-4 text-right text-slate-300">{fmtNum(r.recall)}</td>
                                <td className="py-2 text-right text-slate-400">{r.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {fairness.by_age_band.length >= 2 && (() => {
                          const aucs = fairness.by_age_band.map((r: any) => r.auc);
                          const gap = Math.max(...aucs) - Math.min(...aucs);
                          return (
                            <div className={`text-xs ${gap > 0.05 ? 'text-yellow-400' : 'text-teal-400'}`}>
                              Max AUC gap: {gap.toFixed(3)} — {gap > 0.05 ? 'Monitor — exceeds 0.05 threshold' : 'Acceptable'}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Audit Trail ── */}
        {tab === 'audit' && (
          <div className="space-y-4">
            {/* Governance log */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-400" /> Governance Audit Log — {selectedModel}
              </h3>
              {auditLog.length === 0 ? (
                <div className="text-slate-400 text-sm">No governance events yet for this model.</div>
              ) : (
                <div className="space-y-3">
                  {auditLog.map((evt: any, i: number) => (
                    <div key={i} className="border-l-2 border-teal-700 pl-3 py-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase ${
                          evt.event_type === 'review_requested' ? 'text-yellow-400' :
                          evt.event_type === 'approved' ? 'text-teal-400' :
                          evt.event_type === 'retired' ? 'text-red-400' :
                          'text-slate-300'
                        }`}>{evt.event_type.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(evt.created_at).toLocaleDateString()} — {evt.performed_by}
                        </span>
                      </div>
                      {evt.reason && <div className="text-xs text-slate-400 mt-0.5">Reason: {evt.reason}</div>}
                      {evt.notes && <div className="text-sm text-slate-300 mt-0.5">{evt.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit review request */}
            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">Raise Formal Review Request</h3>
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Reason</label>
                  <select
                    value={reviewReason}
                    onChange={e => setReviewReason(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white"
                  >
                    <option value="drift_detected">Drift Detected</option>
                    <option value="user_reported">User Reported</option>
                    <option value="periodic_review">Periodic Review</option>
                    <option value="adverse_event">Adverse Event</option>
                  </select>
                </div>
                <div className="flex-1 min-w-48">
                  <label className="text-xs text-slate-400 block mb-1">Notes</label>
                  <input
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white"
                    placeholder="Optional notes…"
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={submitReview} className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-1.5 rounded text-sm">
                    Submit Request
                  </button>
                </div>
              </div>
            </div>

            {/* Medical director decision */}
            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">Record Director Decision</h3>
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Action</label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white"
                  >
                    <option value="approved">Approve Continued Use</option>
                    <option value="retraining_requested">Request Retraining</option>
                    <option value="monitoring_intensified">Intensify Monitoring</option>
                    <option value="retired">Retire Model</option>
                  </select>
                </div>
                <div className="flex-1 min-w-48">
                  <label className="text-xs text-slate-400 block mb-1">Decision Notes</label>
                  <input
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white"
                    placeholder="Required…"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={submitAction}
                    disabled={!actionNotes.trim()}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
                  >
                    Record Decision
                  </button>
                </div>
              </div>
              {submitMsg && (
                <div className="text-xs text-teal-400">{submitMsg}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiGovernanceDashboard;
