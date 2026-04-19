import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Activity, ArrowLeft, BarChart2, LineChart as LineIcon, Target, RefreshCw, CloudUpload } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { uhcApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

type Tab = 'scorecard' | 'trends' | 'targets';

const INDICATOR_LABELS: Record<string, { name: string; unit: string }> = {
  anc4_coverage: { name: 'ANC ≥4 visits', unit: '%' },
  skilled_birth_attendance: { name: 'Skilled birth attendance', unit: '%' },
  dtp3_coverage: { name: 'DTP3 coverage', unit: '%' },
  measles_coverage: { name: 'Measles / MCV coverage', unit: '%' },
  hiv_art_coverage: { name: 'ART coverage (PMTCT proxy)', unit: '%' },
  tb_treatment_success_rate: { name: 'TB treatment success', unit: '%' },
  htn_treatment_coverage: { name: 'HTN treatment coverage', unit: '%' },
  cbhi_coverage: { name: 'CBHI household coverage', unit: '%' },
  uhc_sci_composite: { name: 'UHC SCI composite', unit: '%' },
};

function dialColor(score: number | null | undefined): string {
  if (score == null || Number.isNaN(Number(score))) return 'bg-slate-600';
  const s = Number(score);
  if (s < 50) return 'bg-rose-600';
  if (s < 70) return 'bg-amber-500';
  return 'bg-emerald-600';
}

const UhcSdgDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const token = useMemo(
    () => (typeof window !== 'undefined' ? localStorage.getItem('ehr_token') || localStorage.getItem('token') || '' : ''),
    [],
  );

  const [tab, setTab] = useState<Tab>('scorecard');
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [latest, setLatest] = useState<any | null>(null);
  const [targets, setTargets] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [sn, lat, tg] = await Promise.all([
        uhcApi.getSnapshots(tenantSlug, token, year),
        uhcApi.getLatestSnapshot(tenantSlug, token),
        uhcApi.getTargets(tenantSlug, token),
      ]);
      setSnapshots(Array.isArray(sn.data) ? sn.data : []);
      setLatest(lat.data ?? null);
      setTargets(Array.isArray(tg.data) ? tg.data : []);
    } catch (e: any) {
      showError('Load failed', e?.message || 'Failed to load UHC data');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, year, showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const computeNow = async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      await uhcApi.computeIndicators(tenantSlug, token, { year });
      showSuccess('Computation complete', 'Indicators recomputed with CDSS gap analysis');
      await load();
    } catch (e: any) {
      showError('Compute failed', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const pushDhis2 = async () => {
    if (!tenantSlug || !token || !latest?.id) return;
    setLoading(true);
    try {
      const r = await uhcApi.pushToDhis2(tenantSlug, token, latest.id);
      showSuccess(
        'DHIS2',
        typeof r.data?.note === 'string' ? r.data.note : 'Aggregate push delegated to DHIS2 service.',
      );
    } catch (e: any) {
      showError('DHIS2 push failed', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const targetMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const t of targets) {
      m[t.indicatorCode] = t;
    }
    return m;
  }, [targets]);

  const trendData = useMemo(() => {
    const ordered = [...snapshots].reverse();
    return ordered.map((s) => ({
      label: `${s.periodYear}${s.periodQuarter != null ? ` Q${s.periodQuarter}` : ''}`,
      sci: s.uhcSciComposite != null ? Number(s.uhcSciComposite) : null,
      anc4: s.anc4Coverage != null ? Number(s.anc4Coverage) : null,
      dtp3: s.dtp3Coverage != null ? Number(s.dtp3Coverage) : null,
    }));
  }, [snapshots]);

  const score = latest?.uhcSciComposite != null ? Number(latest.uhcSciComposite) : null;

  const cards = useMemo(() => {
    const keys = [
      'anc4_coverage',
      'dtp3_coverage',
      'hiv_art_coverage',
      'tb_treatment_success_rate',
      'htn_treatment_coverage',
      'cbhi_coverage',
    ] as const;
    return keys.map((code) => {
      let current: number | null = null;
      if (latest) {
        const camel =
          code === 'tb_treatment_success_rate'
            ? 'tbTreatmentSuccessRate'
            : code === 'htn_treatment_coverage'
              ? 'htnTreatmentCoverage'
              : code === 'hiv_art_coverage'
                ? 'hivArtCoverage'
                : code === 'cbhi_coverage'
                  ? 'cbhiCoverage'
                  : code === 'dtp3_coverage'
                    ? 'dtp3Coverage'
                    : 'anc4Coverage';
        const v = latest[camel];
        current = v != null ? Number(v) : null;
      }
      const tgtRow = targetMap[code];
      const tgt =
        tgtRow?.nationalTarget != null ? Number(tgtRow.nationalTarget) : tgtRow ? Number(tgtRow.targetValue) : null;
      const gap =
        current != null && tgt != null ? Math.round((tgt - current) * 10) / 10 : null;
      const severe = gap != null && gap > Math.max(10, 0.1 * (tgt || 0));
      return { code, label: INDICATOR_LABELS[code]?.name || code, current, tgt, gap, severe };
    });
  }, [latest, targetMap]);

  const gapFlags: string[] = Array.isArray(latest?.cdssGapFlags) ? latest.cdssGapFlags : [];
  const priorityActions: string[] = Array.isArray(latest?.cdssPriorityActions) ? latest.cdssPriorityActions : [];

  const userRole = useMemo(() => {
    try {
      const raw = localStorage.getItem('ehr_user');
      return raw ? (JSON.parse(raw) as { role?: string })?.role ?? '' : '';
    } catch {
      return '';
    }
  }, []);

  const canEditTargets = userRole === 'admin' || userRole === 'public_health';

  const [editCode, setEditCode] = useState<string | null>(null);
  const [editNational, setEditNational] = useState('');
  const [editGlobal, setEditGlobal] = useState('');

  const saveTargetRow = async (code: string) => {
    if (!tenantSlug || !token) return;
    try {
      const nv = parseFloat(editNational);
      const gv = parseFloat(editGlobal);
      if (Number.isNaN(nv) || Number.isNaN(gv)) {
        showError('Validation', 'Enter valid numbers');
        return;
      }
      await uhcApi.updateTarget(tenantSlug, token, code, { targetValue: gv, nationalTarget: nv });
      showSuccess('Saved', 'Target updated');
      setEditCode(null);
      await load();
    } catch (e: any) {
      showError('Update failed', e?.message || String(e));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/ehr/${tenantSlug}/dashboard`}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="h-6 w-px bg-slate-700" />
            <Activity className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">UHC &amp; SDG health indicators</h1>
              <p className="text-xs text-slate-400">Sprint 160 — facility tracer coverage and gap analysis</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              {[0, 1, 2, 3].map((i) => {
                const y = new Date().getFullYear() - i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={() => void computeNow()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Compute now
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-2 border-b border-slate-800">
          {(
            [
              ['scorecard', 'Scorecard', LineIcon],
              ['trends', 'Trends', BarChart2],
              ['targets', 'Targets', Target],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px ${
                tab === id ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'scorecard' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col items-center justify-center">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">UHC SCI (CDSS)</p>
                <div
                  className={`w-36 h-36 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg ${dialColor(score)}`}
                >
                  {score != null ? score : '—'}
                </div>
                <p className="text-xs text-slate-500 mt-4 text-center">
                  Composite from tracer indicators vs national targets; refreshed on compute.
                </p>
              </div>
              <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h3 className="text-sm font-medium text-slate-300 mb-3">CDSS gap analysis</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Gap flags</p>
                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                      {gapFlags.length ? gapFlags.map((g) => <li key={g}>{g}</li>) : <li className="text-slate-500">None recorded</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Priority actions</p>
                    <ul className="list-decimal list-inside text-slate-300 space-y-1">
                      {priorityActions.length ? (
                        priorityActions.map((p, i) => <li key={i}>{p}</li>)
                      ) : (
                        <li className="text-slate-500">Run compute to generate CDSS actions</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((c) => (
                <div
                  key={c.code}
                  className={`rounded-xl border p-4 ${
                    c.severe ? 'border-rose-900/80 bg-rose-950/30' : 'border-slate-800 bg-slate-900/50'
                  }`}
                >
                  <p className="text-xs text-slate-500 uppercase">{c.label}</p>
                  <p className="text-2xl font-semibold mt-1">
                    {c.current != null ? `${c.current.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Target (national){' '}
                    {c.tgt != null ? `${c.tgt.toFixed(1)}%` : '—'}
                  </p>
                  {c.gap != null && (
                    <p className={`text-xs mt-1 ${c.severe ? 'text-rose-400' : 'text-slate-500'}`}>
                      Gap: {c.gap.toFixed(1)} pts
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'trends' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
            <div className="flex flex-wrap justify-between gap-4 items-center">
              <h3 className="text-lg font-medium">SCI &amp; tracers over snapshots</h3>
              <button
                type="button"
                onClick={() => void pushDhis2()}
                disabled={loading || !latest?.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
              >
                <CloudUpload className="w-4 h-4" />
                Push latest to DHIS2
              </button>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="sci" name="UHC SCI" stroke="#34d399" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="anc4" name="ANC4 %" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="dtp3" name="DTP3 %" stroke="#fbbf24" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {trendData.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No snapshots for {year} yet — run compute.</p>
            )}
          </div>
        )}

        {tab === 'targets' && (
          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Indicator</th>
                  <th className="px-4 py-3">SDG</th>
                  <th className="px-4 py-3">Global target</th>
                  <th className="px-4 py-3">National target</th>
                  <th className="px-4 py-3">Unit</th>
                  {canEditTargets && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {targets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-medium text-slate-200">{t.indicatorName}</td>
                    <td className="px-4 py-3 text-slate-400">{t.sdgGoal}</td>
                    <td className="px-4 py-3">{t.targetValue}</td>
                    <td className="px-4 py-3">{t.nationalTarget ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{t.unit}</td>
                    {canEditTargets && (
                      <td className="px-4 py-3">
                        {editCode === t.indicatorCode ? (
                          <div className="flex flex-wrap gap-2 items-center">
                            <input
                              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 w-24"
                              placeholder="National"
                              value={editNational}
                              onChange={(e) => setEditNational(e.target.value)}
                            />
                            <input
                              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 w-24"
                              placeholder="Global"
                              value={editGlobal}
                              onChange={(e) => setEditGlobal(e.target.value)}
                            />
                            <button
                              type="button"
                              className="text-emerald-400 text-xs"
                              onClick={() => void saveTargetRow(t.indicatorCode)}
                            >
                              Save
                            </button>
                            <button type="button" className="text-slate-400 text-xs" onClick={() => setEditCode(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-emerald-400 hover:underline text-xs"
                            onClick={() => {
                              setEditCode(t.indicatorCode);
                              setEditNational(t.nationalTarget != null ? String(t.nationalTarget) : '');
                              setEditGlobal(String(t.targetValue));
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UhcSdgDashboard;
