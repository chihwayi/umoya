import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, ChevronDown, ClipboardList, FileText, Plus, RefreshCw, Shield, X } from 'lucide-react';
import { ehrAxios } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

type TabKey = 'summary' | 'deaths' | 'reviews' | 'actions' | 'mohcc';

const CAUSE_LABELS: Record<string, string> = {
  O72: 'PPH (Haemorrhage)', O15: 'Eclampsia', O85: 'Sepsis',
  'O98.7': 'HIV complication', O44: 'Placenta praevia', O36: 'Other obstetric',
};

const FACTOR_LABELS: Record<string, string> = {
  substandard_clinical_care: 'Substandard care',
  late_referral: 'Late referral',
  no_blood_available: 'No blood available',
  medication_unavailable: 'Medication unavailable',
  patient_delayed_seeking_care: 'Patient delayed',
  staff_shortage: 'Staff shortage',
  other: 'Other',
};

const authHeaders = (token: string | null, tenantSlug: string) => ({
  Authorization: `Bearer ${token}`,
  'x-tenant-id': tenantSlug,
});

const MdsrDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token');
  const tenantId = tenantSlug ?? '';

  const [tab, setTab] = useState<TabKey>('summary');
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [deaths, setDeaths] = useState<any[]>([]);
  const [overdueActions, setOverdueActions] = useState<any[]>([]);
  const [mohccReport, setMohccReport] = useState<any>(null);
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));

  // Review slide-over
  const [selectedDeath, setSelectedDeath] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState<any>({
    review_date: new Date().toISOString().slice(0, 10),
    delay_1_recognition: false, delay_1_notes: '',
    delay_2_reaching: false, delay_2_notes: '',
    delay_3_receiving: false, delay_3_notes: '',
    preventable: null, preventability_level: '',
    primary_factor: '', primary_factor_notes: '',
    status: 'draft',
  });
  const [actionForm, setActionForm] = useState({ action: '', responsible_for: '', due_date: '' });
  const [reviewActions, setReviewActions] = useState<any[]>([]);
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);

  // Record death form
  const [showDeathForm, setShowDeathForm] = useState(false);
  const [deathForm, setDeathForm] = useState({
    delivery_id: '', maternal_outcome: 'deceased_postpartum', death_date: '',
    death_cause_primary: '', death_cause_secondary: '', death_setting: 'facility_postnatal_ward',
    notified_to_mohcc: false,
  });

  const headers = authHeaders(token, tenantId);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, dRes, overdueRes] = await Promise.all([
        ehrAxios.get(`/tenants/${tenantId}/mdsr/summary?year=${year}`, { headers }),
        ehrAxios.get(`/tenants/${tenantId}/mdsr/deaths?year=${year}`, { headers }),
        ehrAxios.get(`/tenants/${tenantId}/mdsr/actions/overdue`, { headers }),
      ]);
      setSummary(sumRes.data);
      setDeaths(dRes.data ?? []);
      setOverdueActions(overdueRes.data ?? []);
    } catch (e: any) {
      showError('MDSR', e?.message ?? 'Failed to load MDSR data');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, year]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const loadMohccReport = useCallback(async () => {
    try {
      const res = await ehrAxios.get(`/tenants/${tenantId}/mdsr/mohcc-report?year=${year}&quarter=${quarter}`, { headers });
      setMohccReport(res.data);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, year, quarter]);

  useEffect(() => {
    if (tab === 'mohcc') loadMohccReport();
  }, [tab, loadMohccReport]);

  const openReview = async (death: any) => {
    setSelectedDeath(death);
    if (death.review_id) {
      try {
        const res = await ehrAxios.get(`/tenants/${tenantId}/mdsr/reviews/${death.review_id}`, { headers });
        const r = res.data;
        setExistingReviewId(r.id);
        setReviewForm({
          review_date: r.review_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          delay_1_recognition: r.delay_1_recognition, delay_1_notes: r.delay_1_notes ?? '',
          delay_2_reaching: r.delay_2_reaching, delay_2_notes: r.delay_2_notes ?? '',
          delay_3_receiving: r.delay_3_receiving, delay_3_notes: r.delay_3_notes ?? '',
          preventable: r.preventable, preventability_level: r.preventability_level ?? '',
          primary_factor: r.primary_factor ?? '', primary_factor_notes: r.primary_factor_notes ?? '',
          status: r.status,
        });
        setReviewActions(r.action_items ?? []);
      } catch { /* new review */ }
    } else {
      setExistingReviewId(null);
      setReviewForm({
        review_date: new Date().toISOString().slice(0, 10),
        delay_1_recognition: false, delay_1_notes: '',
        delay_2_reaching: false, delay_2_notes: '',
        delay_3_receiving: false, delay_3_notes: '',
        preventable: null, preventability_level: '',
        primary_factor: '', primary_factor_notes: '',
        status: 'draft',
      });
      setReviewActions([]);
    }
  };

  const saveReview = async (status: string) => {
    if (!selectedDeath) return;
    const userId = JSON.parse(localStorage.getItem('ehr_user') || '{}')?.id ?? '';
    try {
      const payload = {
        ...reviewForm, status,
        delivery_id: selectedDeath.id,
        patient_id: selectedDeath.patient_id,
        reviewed_by: userId,
        ...(existingReviewId ? { id: existingReviewId } : {}),
      };
      const res = await ehrAxios.post(`/tenants/${tenantId}/mdsr/reviews`, payload, { headers });
      setExistingReviewId(res.data.id);
      showSuccess('MDSR', 'Review saved');
      loadSummary();
    } catch (e: any) {
      showError('MDSR', e?.message ?? 'Failed to save review');
    }
  };

  const addAction = async () => {
    if (!existingReviewId || !actionForm.action || !actionForm.responsible_for || !actionForm.due_date) return;
    try {
      const res = await ehrAxios.post(`/tenants/${tenantId}/mdsr/reviews/${existingReviewId}/actions`, actionForm, { headers });
      setReviewActions((prev) => [...prev, res.data]);
      setActionForm({ action: '', responsible_for: '', due_date: '' });
    } catch (e: any) {
      showError('MDSR', e?.message ?? 'Failed to add action');
    }
  };

  const markActionComplete = async (actionId: string) => {
    try {
      await ehrAxios.put(`/tenants/${tenantId}/mdsr/actions/${actionId}`, { status: 'completed' }, { headers });
      setReviewActions((prev) => prev.map((a) => a.id === actionId ? { ...a, status: 'completed' } : a));
      loadSummary();
    } catch { /* ignore */ }
  };

  const submitDeath = async () => {
    try {
      await ehrAxios.post(`/tenants/${tenantId}/mdsr/deaths`, deathForm, { headers });
      setShowDeathForm(false);
      showSuccess('MDSR', 'Maternal death recorded');
      loadSummary();
    } catch (e: any) {
      showError('MDSR', e?.message ?? 'Failed to record death');
    }
  };

  const TabBtn: React.FC<{ id: TabKey; label: string; icon: React.ReactNode }> = ({ id, label, icon }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        tab === id ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {icon}{label}
    </button>
  );

  const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—');

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Maternal Death Surveillance & Response</h1>
          <p className="text-sm text-slate-400 mt-0.5">Zimbabwe MOHCC MDSR — Audit workflow and action tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white">
            {[2026, 2025, 2024].map((y) => <option key={y}>{y}</option>)}
          </select>
          <button onClick={loadSummary} disabled={loading}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-slate-700 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overdue alert banner */}
      {overdueActions.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300">
            {overdueActions.length} MDSR action item{overdueActions.length > 1 ? 's' : ''} overdue — immediate attention required
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabBtn id="summary" label="Summary" icon={<Shield className="h-4 w-4" />} />
        <TabBtn id="deaths" label="Deaths Register" icon={<ClipboardList className="h-4 w-4" />} />
        <TabBtn id="reviews" label="Reviews" icon={<FileText className="h-4 w-4" />} />
        <TabBtn id="actions" label="Action Items" icon={<CheckCircle className="h-4 w-4" />} />
        <TabBtn id="mohcc" label="MOHCC Report" icon={<FileText className="h-4 w-4" />} />
      </div>

      {/* SUMMARY TAB */}
      {tab === 'summary' && summary && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Deaths', value: summary.total_maternal_deaths, colour: '#E8614D' },
              { label: 'MMR /100k LB', value: summary.mmr ?? '—', colour: '#F0954A' },
              { label: 'Preventable', value: `${summary.preventable} (${pct(summary.preventable, summary.total_maternal_deaths)})`, colour: '#E8614D' },
              { label: 'Reviews Done', value: `${summary.reviews_completed} / ${summary.total_maternal_deaths}`, colour: summary.reviews_completed >= summary.total_maternal_deaths ? '#0AA98A' : '#F0954A' },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="text-xs text-slate-400 mb-1">{c.label}</div>
                <div className="text-2xl font-bold" style={{ color: c.colour }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Cause + Month charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* By cause */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Deaths by Cause</h3>
              <div className="space-y-2">
                {Object.entries(summary.by_cause as Record<string, number>)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([cause, cnt]) => (
                    <div key={cause} className="flex items-center gap-3">
                      <span className="w-36 text-xs text-slate-400 text-right">{CAUSE_LABELS[cause] ?? cause}</span>
                      <div className="flex-1 h-5 bg-slate-950 rounded overflow-hidden">
                        <div className="h-full bg-red-500/70 rounded" style={{ width: `${Math.min(((cnt as number) / summary.total_maternal_deaths) * 100, 100)}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-red-400 w-4">{cnt as number}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Three-delay */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Three-Delay Analysis</h3>
              {(['delay1', 'delay2', 'delay3'] as const).map((d, i) => {
                const count = summary.by_delay[d];
                const pctVal = summary.total_maternal_deaths > 0 ? (count / summary.total_maternal_deaths) * 100 : 0;
                const colour = pctVal >= 50 ? '#E8614D' : pctVal >= 30 ? '#F0954A' : '#0AA98A';
                return (
                  <div key={d} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Delay {i + 1} — {['Recognition', 'Reaching facility', 'Receiving care'][i]}</span>
                      <span style={{ color: colour }}>{count} ({pctVal.toFixed(1)}%)</span>
                    </div>
                    <div className="h-3 bg-slate-950 rounded overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ width: `${pctVal}%`, background: colour }} />
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">Primary Contributing Factors</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.by_primary_factor as Record<string, number>).map(([f, cnt]) => (
                    <span key={f} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                      {FACTOR_LABELS[f] ?? f} <span className="text-rose-400 ml-1">{cnt as number}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action items summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Open Actions', value: summary.action_items_open, colour: '#F0954A' },
              { label: 'Overdue Actions', value: summary.action_items_overdue, colour: '#E8614D' },
              { label: 'Reviews Pending', value: summary.reviews_pending, colour: '#F0954A' },
              { label: 'Trend vs Prior Year', value: summary.trend_vs_prior_year != null ? `${summary.trend_vs_prior_year > 0 ? '+' : ''}${summary.trend_vs_prior_year}%` : '—', colour: (summary.trend_vs_prior_year ?? 0) > 0 ? '#E8614D' : '#0AA98A' },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="text-xs text-slate-400 mb-1">{c.label}</div>
                <div className="text-2xl font-bold" style={{ color: c.colour }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEATHS REGISTER TAB */}
      {tab === 'deaths' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={() => setShowDeathForm(true)}
              className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600">
              <Plus className="h-4 w-4" /> Record Death
            </button>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-800">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 text-left">Patient ID</th>
                  <th className="px-4 py-3 text-left">Date of Death</th>
                  <th className="px-4 py-3 text-left">Cause (ICD-10)</th>
                  <th className="px-4 py-3 text-left">Preventability</th>
                  <th className="px-4 py-3 text-left">Review</th>
                  <th className="px-4 py-3 text-left">MOHCC Notified</th>
                </tr>
              </thead>
              <tbody>
                {deaths.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No maternal deaths recorded for {year}</td></tr>
                ) : deaths.map((d) => (
                  <tr key={d.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{d.patient_id?.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-slate-200">{d.death_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-200">{d.death_cause_primary ? `${d.death_cause_primary} (${CAUSE_LABELS[d.death_cause_primary] ?? ''})` : '—'}</td>
                    <td className="px-4 py-3">
                      {d.preventability_level ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.preventable ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-300'}`}>
                          {d.preventability_level.replace(/_/g, ' ')}
                        </span>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {d.review_status ? (
                        <button onClick={() => openReview(d)} className="text-teal-400 hover:underline text-xs">
                          {d.review_status} →
                        </button>
                      ) : (
                        <button onClick={() => openReview(d)} className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300 hover:bg-amber-500/30">
                          Start Review
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {d.notified_to_mohcc ? <CheckCircle className="h-4 w-4 text-teal-400" /> : <X className="h-4 w-4 text-slate-500" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTIONS TAB */}
      {tab === 'actions' && (
        <div className="space-y-4">
          {overdueActions.length > 0 && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Overdue — Immediate Attention
              </h3>
              {overdueActions.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-red-500/20 bg-slate-900 px-4 py-2">
                  <span className="text-sm text-slate-200">{a.action}</span>
                  <span className="text-xs text-red-400 ml-4">Due: {a.due_date?.slice(0, 10)}</span>
                  <button onClick={() => markActionComplete(a.id)} className="ml-4 rounded-lg bg-teal-500/20 px-3 py-1 text-xs text-teal-300 hover:bg-teal-500/30">
                    Mark Done
                  </button>
                </div>
              ))}
            </div>
          )}
          {overdueActions.length === 0 && (
            <p className="text-slate-400 text-sm">No overdue action items. {summary?.action_items_open ?? 0} open items on track.</p>
          )}
        </div>
      )}

      {/* MOHCC REPORT TAB */}
      {tab === 'mohcc' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white">
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
            </select>
            <button onClick={loadMohccReport} className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">
              Generate Report
            </button>
          </div>
          {mohccReport && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">MOHCC MDSR Report — {mohccReport.quarter_label}</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs text-slate-400">Deaths this quarter</div>
                  <div className="text-2xl font-bold text-red-400">{mohccReport.total_deaths_quarter}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs text-slate-400">Deaths this year</div>
                  <div className="text-2xl font-bold text-red-400">{mohccReport.total_deaths_year}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs text-slate-400">MMR /100k</div>
                  <div className="text-2xl font-bold text-amber-400">{mohccReport.mmr}</div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">Three-Delay Summary</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  {(['delay1', 'delay2', 'delay3'] as const).map((d, i) => (
                    <div key={d} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-xs text-slate-400 mb-1">Delay {i + 1}</div>
                      <div className="text-xl font-bold text-amber-400">{mohccReport.three_delay_analysis?.[d] ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">Preventability</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  {[
                    { label: 'Preventable', value: mohccReport.preventability?.preventable, colour: 'text-red-400' },
                    { label: 'Not preventable', value: mohccReport.preventability?.not_preventable, colour: 'text-teal-400' },
                    { label: 'Unknown', value: mohccReport.preventability?.unknown, colour: 'text-slate-400' },
                  ].map((p) => (
                    <div key={p.label} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-xs text-slate-400 mb-1">{p.label}</div>
                      <div className={`text-xl font-bold ${p.colour}`}>{p.value ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500">Generated: {new Date(mohccReport.generated_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* REVIEW SLIDE-OVER */}
      {selectedDeath && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setSelectedDeath(null)} />
          <div className="w-full max-w-xl bg-slate-900 overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">MDSR Audit Review</h2>
              <button onClick={() => setSelectedDeath(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div>Patient: <span className="text-slate-300 font-mono">{selectedDeath.patient_id?.slice(0, 12)}…</span></div>
              <div>Death: <span className="text-slate-300">{selectedDeath.death_date?.slice(0, 10)}</span></div>
              <div>Cause: <span className="text-slate-300">{selectedDeath.death_cause_primary}</span></div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">Three-Delay Assessment</h3>
              {([
                { key: 'delay_1_recognition', notesKey: 'delay_1_notes', label: 'Delay 1 — Failure to recognise danger signs' },
                { key: 'delay_2_reaching', notesKey: 'delay_2_notes', label: 'Delay 2 — Transport / reaching facility' },
                { key: 'delay_3_receiving', notesKey: 'delay_3_notes', label: 'Delay 3 — Delay in receiving care' },
              ] as const).map((d) => (
                <div key={d.key} className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!reviewForm[d.key]}
                      onChange={(e) => setReviewForm((p: any) => ({ ...p, [d.key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-rose-500" />
                    <span className="text-sm text-slate-200">{d.label}</span>
                  </label>
                  {reviewForm[d.key] && (
                    <textarea value={reviewForm[d.notesKey]}
                      onChange={(e) => setReviewForm((p: any) => ({ ...p, [d.notesKey]: e.target.value }))}
                      placeholder="Notes…" rows={2}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500" />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Preventability</h3>
              {['definitely_preventable', 'probably_preventable', 'possibly_preventable', 'not_preventable', 'unknown'].map((lvl) => (
                <label key={lvl} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="prev" value={lvl}
                    checked={reviewForm.preventability_level === lvl}
                    onChange={() => setReviewForm((p: any) => ({ ...p, preventability_level: lvl, preventable: lvl !== 'not_preventable' && lvl !== 'unknown' }))}
                    className="text-rose-500" />
                  <span className="text-sm text-slate-200 capitalize">{lvl.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Primary Factor</label>
              <select value={reviewForm.primary_factor}
                onChange={(e) => setReviewForm((p: any) => ({ ...p, primary_factor: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                <option value="">— Select —</option>
                {Object.entries(FACTOR_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">Action Items</h3>
              {reviewActions.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs">
                  <span className="text-slate-200">{a.action}</span>
                  <span className={`ml-3 rounded-full px-2 py-0.5 font-medium ${a.status === 'completed' ? 'bg-teal-500/20 text-teal-300' : 'bg-amber-500/20 text-amber-300'}`}>{a.status}</span>
                  {a.status !== 'completed' && (
                    <button onClick={() => markActionComplete(a.id)} className="ml-2 text-teal-400 hover:underline">Done</button>
                  )}
                </div>
              ))}
              {existingReviewId && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <input placeholder="Action" value={actionForm.action} onChange={(e) => setActionForm((p) => ({ ...p, action: e.target.value }))}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input placeholder="Responsible (UUID)" value={actionForm.responsible_for} onChange={(e) => setActionForm((p) => ({ ...p, responsible_for: e.target.value }))}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input type="date" value={actionForm.due_date} onChange={(e) => setActionForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                </div>
              )}
              {existingReviewId && (
                <button onClick={addAction} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-teal-500 hover:text-teal-300">
                  <Plus className="h-3.5 w-3.5 inline mr-1" /> Add Action Item
                </button>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => saveReview('draft')} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
                Save Draft
              </button>
              <button onClick={() => saveReview('submitted_to_committee')} className="rounded-xl bg-rose-500 px-5 py-2 text-sm font-medium text-white hover:bg-rose-600">
                Submit to Committee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD DEATH FORM */}
      {showDeathForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Record Maternal Death</h2>
              <button onClick={() => setShowDeathForm(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-300">
                <span>Delivery ID (UUID)</span>
                <input value={deathForm.delivery_id} onChange={(e) => setDeathForm((p) => ({ ...p, delivery_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <label className="space-y-1 text-sm text-slate-300">
                <span>Outcome</span>
                <select value={deathForm.maternal_outcome} onChange={(e) => setDeathForm((p) => ({ ...p, maternal_outcome: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                  <option value="deceased_during_delivery">During delivery</option>
                  <option value="deceased_postpartum">Postpartum</option>
                  <option value="deceased_42day">42-day</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-slate-300">
                <span>Death Date</span>
                <input type="date" value={deathForm.death_date} onChange={(e) => setDeathForm((p) => ({ ...p, death_date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <label className="space-y-1 text-sm text-slate-300">
                <span>Primary Cause (ICD-10)</span>
                <input value={deathForm.death_cause_primary} onChange={(e) => setDeathForm((p) => ({ ...p, death_cause_primary: e.target.value }))}
                  placeholder="e.g. O72" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <label className="space-y-1 text-sm text-slate-300">
                <span>Setting</span>
                <select value={deathForm.death_setting} onChange={(e) => setDeathForm((p) => ({ ...p, death_setting: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                  <option value="facility_delivery_theatre">Delivery theatre</option>
                  <option value="facility_postnatal_ward">Postnatal ward</option>
                  <option value="home">Home</option>
                  <option value="transit">Transit</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 pt-6">
                <input type="checkbox" checked={deathForm.notified_to_mohcc}
                  onChange={(e) => setDeathForm((p) => ({ ...p, notified_to_mohcc: e.target.checked }))} />
                MOHCC Notified
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeathForm(false)} className="px-4 py-2 text-slate-400">Cancel</button>
              <button onClick={submitDeath} className="rounded-xl bg-rose-500 px-5 py-2 text-sm font-medium text-white hover:bg-rose-600">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MdsrDashboard;
