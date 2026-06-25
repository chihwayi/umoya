import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface CoverageRow {
  month: string;
  newborns_registered: number;
  nbs_completed: number;
  hearing_completed: number;
  cchd_completed: number;
  nbs_coverage_pct: number;
}

interface AbnormalNbs {
  id: string;
  card_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  batch_ref: string;
  tsh_result: number | null;
  pku_result: number | null;
  g6pd_result: string | null;
  scd_result: string | null;
  scd_abnormal?: boolean;
  result_status: string;
  notified: boolean;
}

interface AbrPending {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  screened_at: string;
  overall_result: string;
  left_ear_result: string;
  right_ear_result: string;
}

const RESULT_BADGE: Record<string, string> = {
  bilateral_pass: 'bg-emerald-500/20 text-emerald-300',
  unilateral_refer: 'bg-amber-500/20 text-amber-300',
  bilateral_refer: 'bg-red-500/20 text-red-300',
  incomplete: 'bg-slate-500/20 text-slate-400',
};

export default function NeonatalScreeningDashboard() {
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [abnormal, setAbnormal] = useState<AbnormalNbs[]>([]);
  const [abrPending, setAbrPending] = useState<AbrPending[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/neonatal-screening/coverage'),
      api.get('/neonatal-screening/nbs/abnormal'),
      api.get('/neonatal-screening/hearing/pending-abr'),
    ]).then(([cov, abn, abr]: any[]) => {
      setCoverage(cov.data ?? cov ?? []);
      setAbnormal(abn.data ?? abn ?? []);
      setAbrPending(abr.data ?? abr ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const latest = coverage[0];
  const nbsCovPct = latest?.nbs_coverage_pct ?? 0;
  const hearingDone = coverage.reduce((a, r) => a + Number(r.hearing_completed), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Neonatal Screening Programme</h1>
          <p className="text-slate-400 text-sm mt-1">NBS heel prick · Hearing OAE · CCHD pulse-ox · Coverage tracking</p>
        </div>

        {loading && <div className="text-slate-400 text-sm">Loading…</div>}

        {/* Stat cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="NBS Coverage" value={`${nbsCovPct}%`} color="text-teal-300" />
            <StatCard label="Abnormal NBS" value={String(abnormal.length)} color={abnormal.length > 0 ? 'text-red-300' : 'text-emerald-300'} />
            <StatCard label="Hearing Screened (YTD)" value={String(hearingDone)} color="text-blue-300" />
            <StatCard label="ABR Pending" value={String(abrPending.length)} color={abrPending.length > 0 ? 'text-amber-300' : 'text-emerald-300'} />
          </div>
        )}

        {/* Abnormal NBS Alert Queue */}
        {!loading && abnormal.length > 0 && (
          <section className="rounded-xl border border-red-800/60 bg-red-900/20 p-5">
            <h2 className="font-semibold text-red-300 mb-3">⚠ Abnormal NBS — Unnotified ({abnormal.length})</h2>
            <div className="space-y-2">
              {abnormal.map(r => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-800/60 px-4 py-3">
                  <div>
                    <span className="font-medium text-white">{r.first_name} {r.last_name}</span>
                    <span className="ml-2 text-xs text-slate-400">Card: {r.card_number} · Batch: {r.batch_ref}</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {r.tsh_result != null && (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-300">TSH: {r.tsh_result} mIU/L</span>
                    )}
                    {r.pku_result != null && (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-300">PKU: {r.pku_result}</span>
                    )}
                    {r.g6pd_result === 'deficient' && (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">G6PD deficient</span>
                    )}
                    {r.scd_abnormal && (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-300">SCD: {r.scd_result}</span>
                    )}
                  </div>
                  <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer hover:bg-red-500">
                    Notify Team
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ABR Pending */}
        {!loading && abrPending.length > 0 && (
          <section className="rounded-xl border border-amber-800/60 bg-amber-900/20 p-5">
            <h2 className="font-semibold text-amber-300 mb-3">Hearing — ABR Referrals Pending ({abrPending.length})</h2>
            <div className="space-y-2">
              {abrPending.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/60 px-4 py-3">
                  <span className="font-medium text-white">{r.first_name} {r.last_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESULT_BADGE[r.overall_result] ?? 'bg-slate-700 text-slate-300'}`}>
                    {r.overall_result?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-slate-400">Screened: {new Date(r.screened_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Coverage Table */}
        {!loading && coverage.length > 0 && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="font-semibold text-slate-200 mb-4">Monthly Coverage</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="pb-2 pr-4">Month</th>
                    <th className="pb-2 pr-4">Registered</th>
                    <th className="pb-2 pr-4">NBS</th>
                    <th className="pb-2 pr-4">Hearing</th>
                    <th className="pb-2 pr-4">CCHD</th>
                    <th className="pb-2">NBS %</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((row, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-2 pr-4 text-slate-300">{String(row.month ?? '').slice(0, 7)}</td>
                      <td className="py-2 pr-4 text-slate-300">{row.newborns_registered}</td>
                      <td className="py-2 pr-4 text-teal-300">{row.nbs_completed}</td>
                      <td className="py-2 pr-4 text-blue-300">{row.hearing_completed}</td>
                      <td className="py-2 pr-4 text-purple-300">{row.cchd_completed}</td>
                      <td className={`py-2 font-semibold ${Number(row.nbs_coverage_pct) >= 90 ? 'text-emerald-300' : Number(row.nbs_coverage_pct) >= 70 ? 'text-amber-300' : 'text-red-300'}`}>
                        {row.nbs_coverage_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && coverage.length === 0 && abnormal.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-500">
            No screening records yet. Start by recording NBS, hearing, or CCHD screens.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
