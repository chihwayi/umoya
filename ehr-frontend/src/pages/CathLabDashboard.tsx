import React, { useEffect, useState } from 'react';
import { Heart, Clock, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import { api } from '../services/api';

const PRIORITY_COLORS: Record<string, string> = {
  elective:        '#3B9EFF',
  urgent:          '#F0954A',
  stemi_primary_pci: '#E8614D',
  emergency:       '#C62828',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled:   '#3B9EFF',
  in_progress: '#F0954A',
  completed:   '#1B9E5A',
  cancelled:   '#3D607F',
};

export default function CathLabDashboard() {
  const [cases, setCases]   = useState<any[]>([]);
  const [dash, setDash]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/cathlab/cases'),
      api.get('/cathlab/dashboard'),
    ]).then(([c, d]) => {
      setCases(c.data ?? c);
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

  const avgD2b = Number(dash?.stemi30d?.avg_d2b ?? 0);
  const d2bOk  = avgD2b > 0 && avgD2b <= 90;

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: '#E8614D22' }}>
          <Heart size={24} color="#E8614D" />
        </div>
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}
          >
            Cardiac Catheterisation Lab
          </h1>
          <p className="text-[#7A9CBC] text-sm">Zimbabwe's only CathLab — powered by Umoya</p>
        </div>
      </div>

      {/* D2B Quality Banner */}
      {dash?.d2bQuality && (
        <div
          className="mb-6 p-4 rounded-[14px] border"
          style={{ background: '#E8614D11', borderColor: '#E8614D44' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} color="#E8614D" />
            <span className="text-sm font-semibold text-[#E8614D]">STEMI D2B Quality (90-day)</span>
          </div>
          <div className="flex gap-6 text-sm">
            <span>
              Target met:{' '}
              <strong style={{ color: '#22C55E' }}>{dash.d2bQuality.met}</strong>
              {' '}/ {dash.d2bQuality.total}
            </span>
            <span>
              Avg D2B:{' '}
              <strong style={{ color: d2bOk ? '#22C55E' : '#E8614D' }}>
                {avgD2b > 0 ? `${avgD2b} min` : '—'}
              </strong>
            </span>
            {!d2bOk && avgD2b > 0 && (
              <span className="flex items-center gap-1 text-[#E8614D]">
                <AlertTriangle size={13} />
                Exceeds 90-min target
              </span>
            )}
            {d2bOk && (
              <span className="flex items-center gap-1 text-[#22C55E]">
                <CheckCircle size={13} />
                Within target
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Scheduled', key: 'scheduled', icon: <Clock size={18} color="#3B9EFF" />, color: '#3B9EFF' },
          { label: 'In Progress', key: 'in_progress', icon: <Activity size={18} color="#F0954A" />, color: '#F0954A' },
          { label: 'Completed', key: 'completed', icon: <CheckCircle size={18} color="#1B9E5A" />, color: '#1B9E5A' },
        ].map(({ label, key, icon, color }) => {
          const count = (dash?.todayCases ?? []).find((r: any) => r.status === key)?.cnt ?? 0;
          return (
            <div
              key={key}
              className="p-4 rounded-[14px] border"
              style={{ background: `${color}11`, borderColor: `${color}33` }}
            >
              <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-[#7A9CBC]">{label} today</span></div>
              <div className="text-2xl font-bold" style={{ color }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Case list */}
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
        <h2 className="text-base font-semibold mb-4">All Cases</h2>
        {cases.length === 0 ? (
          <p className="text-[#7A9CBC] text-sm">No cases found.</p>
        ) : (
          cases.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-4 py-3 border-b border-[#162440] last:border-0"
            >
              <span
                className="text-xs font-bold px-2 py-1 rounded-full"
                style={{
                  background: `${PRIORITY_COLORS[c.priority] ?? '#3B9EFF'}22`,
                  color: PRIORITY_COLORS[c.priority] ?? '#3B9EFF',
                }}
              >
                {(c.priority ?? '').replace(/_/g, ' ').toUpperCase()}
              </span>
              <div className="flex-1">
                <div className="font-medium">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-[#7A9CBC]">
                  {(c.procedure_type ?? '').replace(/_/g, ' ')}
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: `${STATUS_COLORS[c.status] ?? '#3B9EFF'}22`,
                  color: STATUS_COLORS[c.status] ?? '#3B9EFF',
                }}
              >
                {c.status}
              </span>
              <div className="text-xs text-[#7A9CBC] w-16 text-right">
                {c.scheduled_at
                  ? new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'TBD'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
