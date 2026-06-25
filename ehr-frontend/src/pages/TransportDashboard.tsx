import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Vehicle {
  id: string;
  call_sign: string;
  vehicle_type: string;
  status: string;
  base_station: string;
}

interface Job {
  id: string;
  job_ref: string;
  priority: string;
  incident_type: string;
  scene_address: string | null;
  call_received_at: string;
  call_sign: string | null;
  first_name: string | null;
  last_name: string | null;
  response_time_mins: number | null;
  p1_target_met: boolean | null;
}

interface QualityRow {
  month: string;
  priority: string;
  total_jobs: number;
  avg_response_mins: number | null;
  p1_compliance_pct: number | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  p1: '#dc2626',
  p2: '#f59e0b',
  p3: '#0d9488',
};

const VEHICLE_STATUS_COLOR: Record<string, string> = {
  available:   '#10b981',
  on_call:     '#f59e0b',
  dispatched:  '#E8614D',
  maintenance: '#6b7280',
  offline:     '#374151',
};

const elapsed = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function TransportDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quality, setQuality] = useState<QualityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/transport/vehicles').then((r: any) => setVehicles(r.data ?? r)),
      api.get('/transport/jobs/active').then((r: any) => setJobs(r.data ?? r)),
      api.get('/transport/quality-metrics').then((r: any) => setQuality(r.data ?? r)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.center}>Loading Transport...</div>;

  const p1Row = quality.find(q => q.priority === 'p1');
  const p1Pct = p1Row?.p1_compliance_pct ?? null;

  return (
    <div style={s.container}>
      <h2 style={s.heading}>Patient Transport & Ambulance</h2>

      {/* Fleet Status Strip */}
      <div style={s.fleetStrip}>
        {vehicles.map(v => (
          <div key={v.id} style={{ ...s.vehicleCard, borderColor: VEHICLE_STATUS_COLOR[v.status] }}>
            <span style={{ ...s.vehicleDot, background: VEHICLE_STATUS_COLOR[v.status] }} />
            <span style={s.vehicleSign}>{v.call_sign}</span>
            <span style={s.vehicleStatus}>{v.status.replace('_', ' ')}</span>
          </div>
        ))}
        {vehicles.length === 0 && <span style={{ color: '#6b7280', fontSize: 13 }}>No vehicles registered</span>}
      </div>

      <div style={s.grid}>
        {/* Live Dispatch Board */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>Active Jobs ({jobs.length})</h3>
          {jobs.length === 0 ? (
            <p style={{ color: '#10b981', fontSize: 13 }}>No active jobs</p>
          ) : (
            <div style={s.jobList}>
              {jobs.map(j => (
                <div key={j.id} style={{ ...s.jobCard, borderLeftColor: PRIORITY_COLOR[j.priority] }}>
                  <div style={s.jobHeader}>
                    <span style={{ ...s.priorityBadge, background: PRIORITY_COLOR[j.priority] }}>
                      {j.priority.toUpperCase()}
                    </span>
                    <span style={s.jobRef}>{j.job_ref}</span>
                    {j.call_sign && <span style={s.callSign}>• {j.call_sign}</span>}
                    <span style={s.elapsed}>{elapsed(j.call_received_at)}</span>
                  </div>
                  <div style={s.incidentType}>{j.incident_type}</div>
                  {j.scene_address && <div style={s.address}>{j.scene_address}</div>}
                  {(j.first_name || j.last_name) && (
                    <div style={s.patientName}>{j.first_name} {j.last_name}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* P1 Compliance Gauge */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>P1 Response Compliance (≤8 min)</h3>
          <div style={s.gaugeWrap}>
            <div style={{
              ...s.gaugePct,
              color: p1Pct == null ? '#6b7280' : p1Pct >= 75 ? '#10b981' : '#dc2626',
            }}>
              {p1Pct != null ? `${p1Pct}%` : '—'}
            </div>
            <div style={s.gaugeLabel}>Target: 75%</div>
          </div>

          <h3 style={{ ...s.cardTitle, marginTop: 24 }}>Monthly Quality Metrics</h3>
          {quality.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 13 }}>No data yet</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Month', 'Priority', 'Jobs', 'Avg Resp (min)', 'P1 Comply %'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quality.slice(0, 12).map((q, i) => (
                  <tr key={i} style={s.tr}>
                    <td style={s.td}>{q.month?.slice(0, 7)}</td>
                    <td style={{ ...s.td, color: PRIORITY_COLOR[q.priority], fontWeight: 600 }}>
                      {q.priority.toUpperCase()}
                    </td>
                    <td style={s.td}>{q.total_jobs}</td>
                    <td style={s.td}>{q.avg_response_mins != null ? Number(q.avg_response_mins).toFixed(1) : '—'}</td>
                    <td style={{ ...s.td, color: (q.p1_compliance_pct ?? 0) >= 75 ? '#10b981' : '#f59e0b' }}>
                      {q.p1_compliance_pct != null ? `${q.p1_compliance_pct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container:    { padding: '24px', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' },
  center:       { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af' },
  heading:      { fontSize: 24, fontWeight: 700, marginBottom: 20, color: '#f1f5f9' },
  fleetStrip:   { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 },
  vehicleCard:  { borderWidth: 1, borderStyle: 'solid', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, background: '#1e293b' },
  vehicleDot:   { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  vehicleSign:  { fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#e2e8f0' },
  vehicleStatus:{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' as const },
  grid:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  card:         { background: '#1e293b', borderRadius: 12, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
  cardTitle:    { fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 16, marginTop: 0 },
  jobList:      { display: 'flex', flexDirection: 'column', gap: 10 },
  jobCard:      { borderLeft: '4px solid', paddingLeft: 12, paddingTop: 8, paddingBottom: 8, background: '#0f172a', borderRadius: 6 },
  jobHeader:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  priorityBadge:{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: '#fff' },
  jobRef:       { fontFamily: 'monospace', fontSize: 11, color: '#64748b' },
  callSign:     { fontSize: 11, color: '#0d9488', fontWeight: 600 },
  elapsed:      { marginLeft: 'auto', fontSize: 11, color: '#f59e0b', fontFamily: 'monospace' },
  incidentType: { fontSize: 14, fontWeight: 600, color: '#cbd5e1' },
  address:      { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  patientName:  { fontSize: 12, color: '#64748b', marginTop: 2 },
  gaugeWrap:    { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' },
  gaugePct:     { fontSize: 64, fontWeight: 800, lineHeight: 1 },
  gaugeLabel:   { fontSize: 13, color: '#64748b', marginTop: 8 },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:           { textAlign: 'left', padding: '6px 10px', color: '#64748b', borderBottom: '1px solid #334155', fontWeight: 500 },
  tr:           { borderBottom: '1px solid #1e293b' },
  td:           { padding: '8px 10px', color: '#cbd5e1' },
};
