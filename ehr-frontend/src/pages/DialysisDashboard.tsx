import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface DashboardStats {
  active_patients: number;
  sessions_today: number;
  inadequate_sessions_30d: number;
}

interface HdSession {
  id: string;
  patient_id: string;
  session_date: string;
  kt_v_measured: number | null;
  kt_v_adequate: boolean | null;
  uf_volume_ml: number | null;
  duration_hours: number | null;
  session_completed: boolean;
  complications: any[];
}

interface AccessRow {
  id: string;
  patient_id: string;
  access_type: string;
  site: string;
  status: string;
  flow_ml_min: number | null;
  creation_date: string;
}

const ACCESS_CHIP: Record<string, string> = {
  avf: 'bg-teal-500/20 text-teal-300',
  avg: 'bg-cyan-500/20 text-cyan-300',
  cvc_tunnelled: 'bg-amber-500/20 text-amber-300',
  cvc_non_tunnelled: 'bg-orange-500/20 text-orange-300',
  pd_catheter: 'bg-blue-500/20 text-blue-300',
};

const STATUS_DOT: Record<string, string> = {
  in_use: 'bg-emerald-400',
  maturing: 'bg-amber-400',
  thrombosed: 'bg-red-500',
  infected: 'bg-red-600',
  abandoned: 'bg-slate-500',
  removed: 'bg-slate-600',
};

export default function DialysisDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sessions, setSessions] = useState<HdSession[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dialysis/dashboard'),
      api.get('/dialysis/hd-sessions/recent'),
      api.get('/dialysis/access/active'),
    ]).then(([d, s, a]: any[]) => {
      setStats(d.data ?? d ?? null);
      setSessions(s.data ?? s ?? []);
      setAccess(a.data ?? a ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-white">Dialysis Unit</h1>
          <p className="text-slate-400 text-sm mt-1">HD · CRRT · Peritoneal Dialysis · Kt/V Adequacy</p>
        </div>

        {loading && <div className="text-slate-400 text-sm">Loading…</div>}

        {/* Stat Cards */}
        {!loading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Active Patients" value={String(stats.active_patients)} color="text-teal-300" />
            <StatCard label="Sessions Today" value={String(stats.sessions_today)} color="text-blue-300" />
            <StatCard
              label="Inadequate Kt/V (30d)"
              value={String(stats.inadequate_sessions_30d)}
              color={stats.inadequate_sessions_30d > 0 ? 'text-red-300' : 'text-emerald-300'}
            />
          </div>
        )}

        {/* HD Session Log */}
        {!loading && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="font-semibold text-slate-200 mb-4">Recent HD Sessions</h2>
            {sessions.length === 0 ? (
              <p className="text-slate-500 text-sm">No sessions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Kt/V</th>
                      <th className="pb-2 pr-4">UF Volume</th>
                      <th className="pb-2 pr-4">Duration</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => (
                      <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-2 pr-4 text-slate-300">{s.session_date}</td>
                        <td className="py-2 pr-4">
                          {s.kt_v_measured != null ? (
                            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${s.kt_v_adequate ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                              {Number(s.kt_v_measured).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-slate-300">
                          {s.uf_volume_ml != null ? `${s.uf_volume_ml} ml` : '—'}
                        </td>
                        <td className="py-2 pr-4 text-slate-300">
                          {s.duration_hours != null ? `${Number(s.duration_hours).toFixed(1)}h` : '—'}
                        </td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${s.session_completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                            {s.session_completed ? 'Complete' : 'In Progress'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Vascular Access Panel */}
        {!loading && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="font-semibold text-slate-200 mb-4">Active Vascular Access</h2>
            {access.length === 0 ? (
              <p className="text-slate-500 text-sm">No access records found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {access.map(a => (
                  <div key={a.id} className="flex items-start gap-3 rounded-lg bg-slate-800/60 px-4 py-3">
                    <span className={`mt-0.5 inline-flex rounded px-2 py-0.5 text-xs font-medium ${ACCESS_CHIP[a.access_type] ?? 'bg-slate-700 text-slate-300'}`}>
                      {a.access_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{a.site}</p>
                      <p className="text-xs text-slate-400">
                        {a.flow_ml_min ? `${a.flow_ml_min} ml/min · ` : ''}
                        Created: {a.creation_date}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[a.status] ?? 'bg-slate-500'}`} />
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!loading && !stats && sessions.length === 0 && access.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-500">
            No dialysis records yet. Register patients and begin HD session logging.
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
