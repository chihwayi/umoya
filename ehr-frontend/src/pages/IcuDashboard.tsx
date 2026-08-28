import React, { useEffect, useState } from 'react';
import { Activity, Wind, Droplets, AlertTriangle, CheckCircle, Heart, TrendingDown } from 'lucide-react';
import { api } from '../services/api';

const SOFA_COLOR = (score: number): string =>
  score <= 4 ? '#1B6B3A' : score <= 8 ? '#F0954A' : score <= 11 ? '#E8614D' : '#C62828';

const SOFA_BG = (score: number): string =>
  score <= 4 ? '#1B6B3A22' : score <= 8 ? '#F0954A22' : score <= 11 ? '#E8614D22' : '#C6282822';

const ICU_TYPE_LABEL: Record<string, string> = {
  general:  'Gen ICU',
  surgical: 'SICU',
  medical:  'MICU',
  neonatal: 'NICU',
  hdu:      'HDU',
};

export default function IcuDashboard() {
  const [census, setCensus]   = useState<any[]>([]);
  const [dash, setDash]       = useState<any>(null);
  const [watchList, setWatchList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>('');

  useEffect(() => {
    Promise.all([
      api.get('/icu/census'),
      api.get('/icu/dashboard'),
      api.get('/risk/deterioration-watch/list').catch(() => ({ data: [] })),
    ]).then(([c, d, w]) => {
      setCensus(c.data ?? c);
      setDash(d.data ?? d);
      setWatchList(w.data ?? w ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#7A9CBC]">
        Loading…
      </div>
    );
  }

  const ventAlarms   = Number(dash?.recentVentAlarms ?? 0);
  const avgSofa      = dash?.avgSofa24h ?? '—';
  const totalActive  = (dash?.census ?? []).reduce((s: number, r: any) => s + Number(r.cnt ?? 0), 0);

  const filtered = filter
    ? census.filter((p: any) => p.icu_type === filter)
    : census;

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: '#3B9EFF22' }}>
          <Activity size={24} color="#3B9EFF" />
        </div>
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}
          >
            Intensive Care Unit
          </h1>
          <p className="text-[#7A9CBC] text-sm">ICU / SICU / MICU / NICU / HDU census</p>
        </div>
      </div>

      {/* Vent Alarm Banner */}
      {ventAlarms > 0 && (
        <div
          className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: '#E8614D18', border: '1px solid #E8614D44' }}
        >
          <Wind size={18} color="#E8614D" />
          <span className="text-[#E8614D] font-semibold text-sm">
            {ventAlarms} ventilator alarm{ventAlarms > 1 ? 's' : ''} in the last hour — driving pressure or plateau exceeded
          </span>
        </div>
      )}

      {/* Deterioration Trend Watch (S278) — patient-specific rate-of-change lookahead,
          computed from windowed vitals; distinct from the current-vitals NEWS2/MEWS
          alerts above. Trend extrapolation, not a trained ML prediction — labeled
          honestly as such. */}
      {watchList.length > 0 && (
        <div
          className="mb-5 rounded-xl px-4 py-3"
          style={{ background: '#F0954A12', border: '1px solid #F0954A44' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} color="#F0954A" />
            <span className="text-[#F0954A] font-semibold text-sm">
              Deterioration Trend Watch — {watchList.length} patient{watchList.length > 1 ? 's' : ''} trending worse
            </span>
          </div>
          <div className="space-y-1.5">
            {watchList.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between text-xs">
                <span className="text-[#E2EDF8]">{w.first_name} {w.last_name}</span>
                <span className="text-[#7A9CBC]">
                  Score {Number(w.deterioration_score).toFixed(0)} ({w.model_used})
                  {w.trend_direction === 'worsening' && w.projected_hours_to_critical != null && (
                    <> · trending toward critical in ~{w.projected_hours_to_critical}h</>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={<Heart size={16} color="#3B9EFF" />} label="Active admissions" value={String(totalActive)} accent="#3B9EFF" />
        <StatCard icon={<Activity size={16} color="#F0954A" />} label="Avg SOFA (24 h)" value={String(avgSofa)} accent="#F0954A" />
        <StatCard icon={<Wind size={16} color={ventAlarms > 0 ? '#E8614D' : '#1B9E5A'} />} label="Vent alarms (1 h)" value={String(ventAlarms)} accent={ventAlarms > 0 ? '#E8614D' : '#1B9E5A'} />
      </div>

      {/* Census Breakdown */}
      <div className="mb-5 flex items-center gap-2">
        {(['', 'general', 'surgical', 'medical', 'neonatal', 'hdu'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className="text-xs px-3 py-1 rounded-full transition-colors"
            style={{
              background: filter === t ? '#3B9EFF22' : '#111B2E',
              color:       filter === t ? '#3B9EFF'   : '#7A9CBC',
              border:      filter === t ? '1px solid #3B9EFF55' : '1px solid #1C2E45',
            }}
          >
            {t === '' ? 'All' : ICU_TYPE_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      {/* Bed Grid */}
      {filtered.length === 0 ? (
        <div className="text-center text-[#7A9CBC] py-16 text-sm">No active admissions.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((pt: any) => (
            <BedCard key={pt.id} pt={pt} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: '#0D1829', border: '1px solid #1C2E45' }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[#7A9CBC] text-xs">{label}</span>
      </div>
      <span className="text-2xl font-bold" style={{ color: accent, fontFamily: 'Plus Jakarta Sans' }}>
        {value}
      </span>
    </div>
  );
}

function BedCard({ pt }: { pt: any }) {
  const sofa   = Number(pt.latest_sofa ?? 0);
  const color  = SOFA_COLOR(sofa);
  const bgTint = SOFA_BG(sofa);
  const hasAlarm = pt.is_alarm_driving_pressure || pt.is_alarm_plateau;
  const losDays = Math.floor(Number(pt.los_days ?? 0));

  return (
    <div
      className="rounded-xl p-4 transition-shadow hover:shadow-lg"
      style={{ background: '#0D1829', border: `1px solid ${color}44` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ background: bgTint, color }}
          >
            {pt.bed_code}
          </span>
          <span className="text-[10px] text-[#7A9CBC] uppercase tracking-wider">
            {ICU_TYPE_LABEL[pt.icu_type] ?? pt.icu_type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasAlarm && (
            <Wind size={14} color="#E8614D" />
          )}
          {pt.isolation_required && (
            <AlertTriangle size={13} color="#F0954A" />
          )}
        </div>
      </div>

      <p className="font-semibold text-[#E2EDF8] text-[15px] mb-1">
        {pt.first_name} {pt.last_name}
      </p>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <Activity size={12} color={color} />
          <span className="text-xs" style={{ color }}>
            SOFA {sofa}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {pt.ventilator_required && (
            <span className="text-[10px] text-[#3B9EFF] flex items-center gap-1">
              <Wind size={10} color="#3B9EFF" /> Vent
            </span>
          )}
          <span className="text-[#7A9CBC] text-xs">
            Day {losDays}
          </span>
        </div>
      </div>

      {hasAlarm && (
        <div className="mt-2 rounded-lg px-3 py-1.5" style={{ background: '#E8614D12' }}>
          <p className="text-[#E8614D] text-[11px]">
            {pt.is_alarm_driving_pressure && pt.is_alarm_plateau
              ? 'Driving pressure & plateau alarm'
              : pt.is_alarm_driving_pressure
              ? 'Driving pressure >15 cmH₂O'
              : 'Plateau pressure >30 cmH₂O'}
          </p>
        </div>
      )}
    </div>
  );
}
