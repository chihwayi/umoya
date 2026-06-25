import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const WHO_BAND_COLORS: Record<string, string> = {
  sam:          '#C62828',
  mam:          '#F0954A',
  mild_wasting: '#FDD835',
  normal:       '#1B6B3A',
  overweight:   '#F0954A',
  obese:        '#C62828',
};

const MILESTONE_COLORS: Record<string, string> = {
  on_track:     '#1B6B3A',
  monitor:      '#F0954A',
  refer:        '#E64A19',
  urgent_refer: '#C62828',
};

interface Visit {
  id: string;
  visit_type: string;
  visit_date: string;
  weight_kg?: number;
  wfa_zscore?: number;
  nutrition_status?: string;
  next_visit_due?: string;
  cdss_growth_alert?: string;
}

interface Dashboard {
  visitSummary: { total: string; today: string };
  malnutrition30d: { classification: string; cnt: string }[];
  milestoneResults90d: { overall_result: string; cnt: string }[];
}

export default function WellBabyDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitSearch, setVisitSearch] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/well-baby/dashboard'),
      api.get('/well-baby/overdue?days=14'),
    ]).then(([d, o]: any[]) => {
      setDashboard(d.data ?? d);
      setOverdue(o.data ?? o);
    }).finally(() => setLoading(false));
  }, []);

  const loadVisits = async () => {
    if (!patientId.trim()) return;
    setVisitSearch(true);
    try {
      const res: any = await api.get(`/well-baby/patients/${patientId.trim()}/visits`);
      setVisits(res.data ?? res);
    } finally {
      setVisitSearch(false);
    }
  };

  if (loading) return <div style={styles.loading}>Loading Well-Baby Dashboard…</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Well-Baby Clinic</h1>

      {/* Summary Cards */}
      {dashboard && (
        <div style={styles.cards}>
          <div style={styles.card}>
            <div style={styles.cardLabel}>Total WBC Visits</div>
            <div style={styles.cardValue}>{dashboard.visitSummary?.total ?? '—'}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>Visits Today</div>
            <div style={styles.cardValue}>{dashboard.visitSummary?.today ?? '—'}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>Malnutrition (30d)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dashboard.malnutrition30d?.map((m) => (
                <span key={m.classification} style={{ ...styles.badge, background: `${WHO_BAND_COLORS[m.classification] ?? '#888'}22`, color: WHO_BAND_COLORS[m.classification] ?? '#888' }}>
                  {m.classification.toUpperCase().replace(/_/g, ' ')}: {m.cnt}
                </span>
              ))}
            </div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>Milestones (90d)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dashboard.milestoneResults90d?.map((m) => (
                <span key={m.overall_result} style={{ ...styles.badge, background: `${MILESTONE_COLORS[m.overall_result] ?? '#888'}22`, color: MILESTONE_COLORS[m.overall_result] ?? '#888' }}>
                  {m.overall_result.replace(/_/g, ' ')}: {m.cnt}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overdue Visits */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Overdue WBC Visits (&gt;14 days)</h2>
        {overdue.length === 0 ? (
          <p style={styles.empty}>No overdue visits.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Patient', 'Phone', 'Visit Due', 'Type'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overdue.map((o, i) => {
                const daysOver = Math.floor((Date.now() - new Date(o.next_visit_due).getTime()) / 86400000);
                return (
                  <tr key={i} style={{ background: daysOver > 30 ? '#C6282811' : undefined }}>
                    <td style={styles.td}>{o.first_name} {o.last_name}</td>
                    <td style={styles.td}>{o.phone ?? '—'}</td>
                    <td style={{ ...styles.td, color: daysOver > 14 ? '#C62828' : '#333', fontWeight: daysOver > 14 ? 700 : 400 }}>
                      {o.next_visit_due} <span style={{ fontSize: 11, color: '#C62828' }}>({daysOver}d overdue)</span>
                    </td>
                    <td style={styles.td}>{o.visit_type?.replace(/_/g, ' ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Patient Visit History */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Patient Visit History</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            style={styles.input}
            placeholder="Patient UUID"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <button style={styles.btn} onClick={loadVisits} disabled={visitSearch}>
            {visitSearch ? 'Loading…' : 'Load Visits'}
          </button>
        </div>
        {visits.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Date', 'Type', 'Weight (kg)', 'WFA z', 'Nutrition', 'Next Due', 'Alert'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td style={styles.td}>{v.visit_date}</td>
                  <td style={styles.td}>{v.visit_type?.replace(/_/g, ' ')}</td>
                  <td style={styles.td}>{v.weight_kg ?? '—'}</td>
                  <td style={{
                    ...styles.td,
                    color: v.wfa_zscore != null
                      ? v.wfa_zscore < -3 ? '#C62828' : v.wfa_zscore < -2 ? '#F0954A' : v.wfa_zscore < -1 ? '#FDD835' : '#1B6B3A'
                      : '#888',
                    fontWeight: v.wfa_zscore != null && v.wfa_zscore < -2 ? 700 : 400,
                  }}>
                    {v.wfa_zscore != null ? v.wfa_zscore : '—'}
                  </td>
                  <td style={{ ...styles.td }}>
                    {v.nutrition_status ? (
                      <span style={{ ...styles.badge, background: `${WHO_BAND_COLORS[v.nutrition_status] ?? '#888'}22`, color: WHO_BAND_COLORS[v.nutrition_status] ?? '#888' }}>
                        {v.nutrition_status.toUpperCase().replace(/_/g, ' ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={styles.td}>{v.next_visit_due ?? '—'}</td>
                  <td style={{ ...styles.td, color: '#C62828', fontSize: 12 }}>{v.cdss_growth_alert ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px 32px', fontFamily: 'Inter, sans-serif', background: '#F7F9FB', minHeight: '100vh' },
  loading:   { padding: 40, textAlign: 'center', color: '#888' },
  heading:   { fontSize: 26, fontWeight: 700, color: '#0AA98A', marginBottom: 24 },
  cards:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 },
  card:      { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,.08)' },
  cardLabel: { fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' },
  cardValue: { fontSize: 28, fontWeight: 700, color: '#1A2B3C' },
  badge:     { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '.4px' },
  section:   { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: '0 1px 6px rgba(0,0,0,.08)' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1A2B3C', marginBottom: 12 },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', padding: '8px 12px', borderBottom: '2px solid #F0F2F5', textTransform: 'uppercase', letterSpacing: '.5px' },
  td:        { padding: '10px 12px', fontSize: 13, color: '#1A2B3C', borderBottom: '1px solid #F0F2F5' },
  empty:     { color: '#888', fontSize: 13 },
  input:     { flex: 1, padding: '8px 12px', border: '1px solid #D0D5DD', borderRadius: 8, fontSize: 13 },
  btn:       { padding: '8px 16px', background: '#0AA98A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};
