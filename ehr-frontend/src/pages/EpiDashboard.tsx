import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const STATUS_COLOR = { complete: '#1B6B3A', partial: '#F0954A', pending: '#9CA3AF' };
const EXCURSION_COLOR = { heat_excursion: '#C62828', freeze_risk: '#1565C0' };

interface ScheduleRow {
  antigen_code: string;
  antigen_name: string;
  doses_required: number;
  doses_given: number;
  doses_remaining: number;
  min_age_weeks: number;
  is_live_vaccine?: boolean;
}

interface Excursion {
  id: string;
  fridge_id: string;
  recorded_at: string;
  temp_celsius: number;
  excursion_type: string;
}

interface CoverageRow {
  antigen_code: string;
  vaccinated_count: number;
  month: string;
}

export default function EpiDashboard() {
  const [catalog, setCatalog] = useState<ScheduleRow[]>([]);
  const [excursions, setExcursions] = useState<Excursion[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState('');
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [coldForm, setColdForm] = useState({ fridgeId: '', tempCelsius: '', notes: '' });
  const [coldResult, setColdResult] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      api.get('/immunisation/catalog'),
      api.get('/immunisation/cold-chain/excursions'),
      api.get('/immunisation/coverage'),
    ]).then(([c, e, cov]: any[]) => {
      setCatalog(c.data ?? c);
      setExcursions(e.data ?? e);
      setCoverage(cov.data ?? cov);
    }).finally(() => setLoading(false));
  }, []);

  const loadSchedule = async () => {
    if (!patientId.trim()) return;
    setSchedLoading(true);
    try {
      const res: any = await api.get(`/immunisation/patients/${patientId.trim()}/schedule`);
      setSchedule(res.data ?? res);
    } finally { setSchedLoading(false); }
  };

  const submitColdChain = async () => {
    try {
      const res: any = await api.post('/immunisation/cold-chain', {
        fridgeId: coldForm.fridgeId,
        tempCelsius: Number(coldForm.tempCelsius),
        notes: coldForm.notes || undefined,
      });
      setColdResult(res.data ?? res);
      setColdForm({ fridgeId: '', tempCelsius: '', notes: '' });
      if ((res.data ?? res).is_excursion) {
        setExcursions(prev => [res.data ?? res, ...prev.slice(0, 49)]);
      }
    } catch { setColdResult({ error: 'Failed to log temperature.' }); }
  };

  if (loading) return <div style={s.loading}>Loading EPI Dashboard…</div>;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisCoverage = coverage.filter(c => c.month?.startsWith(thisMonth));

  return (
    <div style={s.container}>
      <h1 style={s.heading}>EPI — Immunisation Management</h1>

      {/* Cold Chain Alert Banner */}
      {excursions.length > 0 && (
        <div style={{ ...s.alertBanner, borderColor: EXCURSION_COLOR[excursions[0].excursion_type as keyof typeof EXCURSION_COLOR] ?? '#C62828' }}>
          <strong>COLD CHAIN ALERT</strong> — {excursions.length} excursion{excursions.length > 1 ? 's' : ''} on record.
          Latest: Fridge <code>{excursions[0].fridge_id}</code> at {excursions[0].temp_celsius}°C ({excursions[0].excursion_type?.replace(/_/g, ' ')})
          on {new Date(excursions[0].recorded_at).toLocaleString()}.
        </div>
      )}

      <div style={s.grid}>
        {/* Vaccine Catalog */}
        <section style={s.card}>
          <h2 style={s.sectionTitle}>Zimbabwe EPI Antigens ({catalog.length})</h2>
          <table style={s.table}>
            <thead>
              <tr>{['Code', 'Antigen', 'Route', 'Age (wks)', 'Live'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {catalog.map(v => (
                <tr key={v.antigen_code}>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 700, color: '#0AA98A' }}>{v.antigen_code}</td>
                  <td style={s.td}>{v.antigen_name}</td>
                  <td style={s.td}>{(v as any).route?.toUpperCase() ?? '—'}</td>
                  <td style={s.td}>{v.min_age_weeks ?? 0}</td>
                  <td style={s.td}>{(v as any).is_live_vaccine ? <span style={{ color: '#F0954A', fontWeight: 700 }}>LIVE</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Coverage This Month */}
        <section style={s.card}>
          <h2 style={s.sectionTitle}>Coverage — {thisMonth}</h2>
          {thisCoverage.length === 0 ? (
            <p style={s.empty}>No vaccinations recorded this month.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {thisCoverage.map(c => (
                <div key={c.antigen_code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 60, fontFamily: 'monospace', fontSize: 12, color: '#0AA98A', fontWeight: 700 }}>{c.antigen_code}</span>
                  <div style={{ flex: 1, background: '#E8F5E9', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Number(c.vaccinated_count) * 5)}%`, height: '100%', background: '#0AA98A', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2B3C', width: 32 }}>{c.vaccinated_count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Patient Vaccination Card */}
      <section style={s.card}>
        <h2 style={s.sectionTitle}>Patient Vaccination Card</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input style={s.input} placeholder="Patient UUID" value={patientId} onChange={e => setPatientId(e.target.value)} />
          <button style={s.btn} onClick={loadSchedule} disabled={schedLoading}>{schedLoading ? 'Loading…' : 'Load Card'}</button>
        </div>
        {schedule.length > 0 && (
          <table style={s.table}>
            <thead>
              <tr>{['Code', 'Antigen', 'Given', 'Required', 'Remaining', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {schedule.map(row => {
                const complete = Number(row.doses_remaining) === 0;
                const partial  = Number(row.doses_given) > 0 && !complete;
                const statusColor = complete ? STATUS_COLOR.complete : partial ? STATUS_COLOR.partial : STATUS_COLOR.pending;
                return (
                  <tr key={row.antigen_code}>
                    <td style={{ ...s.td, fontFamily: 'monospace', color: '#0AA98A', fontWeight: 700 }}>{row.antigen_code}</td>
                    <td style={s.td}>{row.antigen_name}</td>
                    <td style={s.td}>{row.doses_given}</td>
                    <td style={s.td}>{row.doses_required}</td>
                    <td style={{ ...s.td, color: Number(row.doses_remaining) > 0 ? '#C62828' : '#1B6B3A', fontWeight: 700 }}>{row.doses_remaining}</td>
                    <td style={s.td}>
                      <span style={{ background: `${statusColor}22`, color: statusColor, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                        {complete ? '✓ Complete' : partial ? 'Partial' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Cold Chain Logger */}
      <section style={s.card}>
        <h2 style={s.sectionTitle}>Log Cold Chain Temperature</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={s.label}>Fridge ID</label>
            <input style={s.input} placeholder="FRIDGE-01" value={coldForm.fridgeId} onChange={e => setColdForm(f => ({ ...f, fridgeId: e.target.value }))} />
          </div>
          <div>
            <label style={s.label}>Temp (°C)</label>
            <input style={s.input} type="number" step="0.1" placeholder="4.2" value={coldForm.tempCelsius} onChange={e => setColdForm(f => ({ ...f, tempCelsius: e.target.value }))} />
          </div>
          <div>
            <label style={s.label}>Notes</label>
            <input style={s.input} placeholder="Optional" value={coldForm.notes} onChange={e => setColdForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <button style={s.btn} onClick={submitColdChain}>Log</button>
        </div>
        {coldResult && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: coldResult.is_excursion ? '#FFEBEE' : '#E8F5E9', color: coldResult.is_excursion ? '#C62828' : '#1B6B3A', fontSize: 13 }}>
            {coldResult.error
              ? coldResult.error
              : coldResult.alert
                ? `⚠ ${coldResult.alert}`
                : `✓ Logged ${coldResult.temp_celsius}°C for ${coldResult.fridge_id} — within safe range.`}
          </div>
        )}
      </section>

      {/* Recent Excursions */}
      {excursions.length > 0 && (
        <section style={s.card}>
          <h2 style={s.sectionTitle}>Cold Chain Excursions</h2>
          <table style={s.table}>
            <thead>
              <tr>{['Fridge', 'Temp (°C)', 'Type', 'Time'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {excursions.slice(0, 10).map(ex => (
                <tr key={ex.id}>
                  <td style={s.td}>{ex.fridge_id}</td>
                  <td style={{ ...s.td, fontWeight: 700, color: EXCURSION_COLOR[ex.excursion_type as keyof typeof EXCURSION_COLOR] ?? '#C62828' }}>{ex.temp_celsius}</td>
                  <td style={s.td}>{ex.excursion_type?.replace(/_/g, ' ')}</td>
                  <td style={s.td}>{new Date(ex.recorded_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container:    { padding: '24px 32px', fontFamily: 'Inter, sans-serif', background: '#F7F9FB', minHeight: '100vh' },
  loading:      { padding: 40, textAlign: 'center', color: '#888' },
  heading:      { fontSize: 26, fontWeight: 700, color: '#0AA98A', marginBottom: 16 },
  alertBanner:  { background: '#FFF3E0', border: '2px solid', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#7B3F00' },
  grid:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card:         { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,.08)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1A2B3C', marginBottom: 12 },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', padding: '8px 10px', borderBottom: '2px solid #F0F2F5', textTransform: 'uppercase', letterSpacing: '.5px' },
  td:           { padding: '8px 10px', fontSize: 13, color: '#1A2B3C', borderBottom: '1px solid #F0F2F5' },
  empty:        { color: '#888', fontSize: 13 },
  input:        { padding: '8px 12px', border: '1px solid #D0D5DD', borderRadius: 8, fontSize: 13, minWidth: 140 },
  btn:          { padding: '8px 16px', background: '#0AA98A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' },
  label:        { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.4px' },
};
