import React, { useEffect, useState } from 'react';
import { Baby, AlertTriangle, Heart } from 'lucide-react';
import { api } from '../services/api';

const nicuBadgeColor = (adm: any): string =>
  adm.is_elbw ? '#C62828' : adm.is_vlbw ? '#E8614D' : adm.is_premature ? '#F0954A' : '#1B6B3A';

const nicuBadgeLabel = (adm: any): string =>
  adm.is_elbw ? 'ELBW' : adm.is_vlbw ? 'VLBW' : adm.is_premature ? 'Premature' : 'Term';

const KMC_TARGET_HOURS = 8;

export default function NicuDashboard() {
  const [census, setCensus]   = useState<any[]>([]);
  const [dash, setDash]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/nicu/census'),
      api.get('/nicu/dashboard'),
    ]).then(([c, d]) => {
      setCensus(c.data ?? c);
      setDash(d.data ?? d);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#7A9CBC]">
        Loading…
      </div>
    );
  }

  const needsPhoto    = Number(dash?.jaundice?.needs_photo ?? 0);
  const totalActive   = Number(dash?.census?.total ?? 0);
  const prematureCount = Number(dash?.census?.premature ?? 0);
  const vlbwCount     = Number(dash?.census?.vlbw ?? 0);
  const avgKmcHrs     = dash?.kmcToday?.avg_kmc_hrs ?? '—';

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: '#0AA98A22' }}>
          <Baby size={24} color="#0AA98A" />
        </div>
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}
          >
            Neonatal Intensive Care
          </h1>
          <p className="text-[#7A9CBC] text-sm">NICU census · phototherapy · KMC</p>
        </div>
      </div>

      {/* Jaundice Banner */}
      {needsPhoto > 0 && (
        <div
          className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: '#F0954A18', border: '1px solid #F0954A44' }}
        >
          <AlertTriangle size={18} color="#F0954A" />
          <span className="text-[#F0954A] font-semibold text-sm">
            {needsPhoto} baby{needsPhoto > 1 ? 'ies' : ''} above phototherapy threshold in the last 24 h
          </span>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active admissions" value={String(totalActive)} accent="#0AA98A" />
        <StatCard label="Premature" value={String(prematureCount)} accent="#F0954A" />
        <StatCard label="VLBW" value={String(vlbwCount)} accent="#E8614D" />
        <StatCard label="Avg KMC today (h)" value={String(avgKmcHrs)} accent="#3B9EFF" />
      </div>

      {/* Census Grid */}
      {census.length === 0 ? (
        <div className="text-center text-[#7A9CBC] py-16 text-sm">No active NICU admissions.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {census.map((adm: any) => (
            <NicuCard key={adm.id} adm={adm} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: '#0D1829', border: '1px solid #1C2E45' }}
    >
      <p className="text-[#7A9CBC] text-xs mb-1">{label}</p>
      <span className="text-2xl font-bold" style={{ color: accent, fontFamily: 'Plus Jakarta Sans' }}>
        {value}
      </span>
    </div>
  );
}

function NicuCard({ adm }: { adm: any }) {
  const color        = nicuBadgeColor(adm);
  const label        = nicuBadgeLabel(adm);
  const kmcHrs       = Number(adm.kmc_hours_today ?? 0);
  const kmcPct       = Math.min(100, Math.round((kmcHrs / KMC_TARGET_HOURS) * 100));
  const losDays      = Math.floor(Number(adm.los_days ?? 0));
  const needsPhoto   = adm.above_phototherapy_threshold;

  return (
    <div
      className="rounded-xl p-4 transition-shadow hover:shadow-lg"
      style={{ background: '#0D1829', border: `1px solid ${color}44` }}
    >
      {/* Top row — badge + incubator code */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ background: `${color}22`, color }}
          >
            {label}
          </span>
          <span className="text-[10px] text-[#7A9CBC] font-mono">
            {adm.incubator_code ?? 'Open Cot'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {needsPhoto && <AlertTriangle size={14} color="#F0954A" />}
          {adm.kmc_hours_today != null && <Heart size={13} color="#0AA98A" />}
        </div>
      </div>

      {/* Name */}
      <p className="font-semibold text-[#E2EDF8] text-[15px] mb-2">
        {adm.first_name} {adm.last_name}
      </p>

      {/* Birth stats */}
      <div className="flex gap-3 text-xs text-[#7A9CBC] mb-3">
        <span>GA {adm.gestational_age_weeks}w</span>
        <span>BW {adm.birth_weight_grams}g</span>
        {adm.current_weight && <span>CW {adm.current_weight}g</span>}
        <span>Day {losDays}</span>
      </div>

      {/* Bilirubin chip */}
      {adm.total_bilirubin != null && (
        <div
          className="mb-3 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
          style={{
            background: needsPhoto ? '#F0954A22' : '#1B6B3A22',
            color:      needsPhoto ? '#F0954A'   : '#1B9E5A',
          }}
        >
          TSB {adm.total_bilirubin} μmol/L
          {adm.hours_of_life != null && <span className="text-[#7A9CBC]"> @ {Math.round(adm.hours_of_life)}h</span>}
        </div>
      )}

      {/* KMC progress */}
      {adm.kmc_hours_today != null && (
        <div>
          <div className="flex justify-between text-[10px] text-[#7A9CBC] mb-1">
            <span>KMC today</span>
            <span>{kmcHrs}h / {KMC_TARGET_HOURS}h WHO target</span>
          </div>
          <div className="rounded-full h-1.5 w-full" style={{ background: '#1C2E45' }}>
            <div
              className="rounded-full h-1.5 transition-all"
              style={{ width: `${kmcPct}%`, background: '#0AA98A' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
