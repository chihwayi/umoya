import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface RegisterEntry {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  corrected_age_months: number | null;
  risk_tier: string;
  discharge_date: string;
}

interface BayleyRow {
  assessed_at: string;
  corrected_age_months: number;
  cognitive_composite: number | null;
  language_composite: number | null;
  motor_composite: number | null;
  any_significant_delay: boolean;
}

interface RopRow {
  patient_id: string;
  first_name: string;
  last_name: string;
  next_screen_due: string;
  treatment_required: boolean;
}

interface HieRow {
  id: string;
  patient_id: string;
  sarnat_grade: number;
  cooling_initiated: boolean;
  mri_classification: string | null;
  neurodevelopmental_outcome: string | null;
}

const TIER_COLOR: Record<string, string> = {
  very_high: '#dc2626',
  high: '#f59e0b',
  standard: '#10b981',
};

const SCORE_COLOR = (score: number | null) =>
  score == null ? '#6b7280' : score < 70 ? '#dc2626' : score < 85 ? '#f97316' : '#10b981';

export default function NicuFollowupDashboard() {
  const [register, setRegister] = useState<RegisterEntry[]>([]);
  const [ropPending, setRopPending] = useState<RopRow[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<RegisterEntry | null>(null);
  const [bayley, setBayley] = useState<BayleyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/nicu-followup/register').then((r: any) => setRegister(r.data ?? r)),
      api.get('/nicu-followup/rop/pending-screening').then((r: any) => setRopPending(r.data ?? r)),
    ]).finally(() => setLoading(false));
  }, []);

  const selectPatient = async (entry: RegisterEntry) => {
    setSelectedPatient(entry);
    const rows = await api.get(`/nicu-followup/bayley/${entry.patient_id}`).then((r: any) => r.data ?? r);
    setBayley(rows);
  };

  if (loading) return <div style={styles.center}>Loading NICU Follow-up...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>NICU Follow-up Programme</h2>

      <div style={styles.grid}>
        {/* Register */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Post-NICU Discharge Register</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Patient', 'Corrected Age (m)', 'Risk Tier', 'Discharge'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {register.map(r => (
                <tr
                  key={r.id}
                  style={{ ...styles.tr, cursor: 'pointer', background: selectedPatient?.id === r.id ? '#1e3a5f' : undefined }}
                  onClick={() => selectPatient(r)}
                >
                  <td style={styles.td}>{r.first_name} {r.last_name}</td>
                  <td style={styles.td}>{r.corrected_age_months ?? '—'}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: TIER_COLOR[r.risk_tier] ?? '#6b7280' }}>
                      {r.risk_tier.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={styles.td}>{r.discharge_date}</td>
                </tr>
              ))}
              {register.length === 0 && (
                <tr><td colSpan={4} style={{ ...styles.td, color: '#6b7280', textAlign: 'center' }}>No patients enrolled</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bayley scores for selected patient */}
        {selectedPatient && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>
              Bayley-III — {selectedPatient.first_name} {selectedPatient.last_name}
              <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>(corrected age)</span>
            </h3>
            {bayley.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 13 }}>No Bayley-III assessments recorded</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Date', 'CA (m)', 'Cognitive', 'Language', 'Motor', 'Delay?'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bayley.map((b, i) => (
                    <tr key={i} style={styles.tr}>
                      <td style={styles.td}>{b.assessed_at}</td>
                      <td style={styles.td}>{b.corrected_age_months}</td>
                      <td style={{ ...styles.td, color: SCORE_COLOR(b.cognitive_composite), fontWeight: 600 }}>
                        {b.cognitive_composite ?? '—'}
                      </td>
                      <td style={{ ...styles.td, color: SCORE_COLOR(b.language_composite), fontWeight: 600 }}>
                        {b.language_composite ?? '—'}
                      </td>
                      <td style={{ ...styles.td, color: SCORE_COLOR(b.motor_composite), fontWeight: 600 }}>
                        {b.motor_composite ?? '—'}
                      </td>
                      <td style={styles.td}>
                        {b.any_significant_delay
                          ? <span style={{ color: '#f97316', fontWeight: 600 }}>⚠ Yes</span>
                          : <span style={{ color: '#10b981' }}>No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
              Red line: score &lt;85 = significant delay · Orange: &lt;70 = severe
            </p>
          </div>
        )}

        {/* ROP Pending */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>ROP Screening Due (&le;3 days)</h3>
          {ropPending.length === 0 ? (
            <p style={{ color: '#10b981', fontSize: 13 }}>No pending ROP screens</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Patient', 'Due Date', 'Treatment Req.'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ropPending.map((r, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>{r.first_name} {r.last_name}</td>
                    <td style={{ ...styles.td, color: '#f59e0b', fontWeight: 600 }}>{r.next_screen_due}</td>
                    <td style={styles.td}>
                      {r.treatment_required
                        ? <span style={{ color: '#dc2626', fontWeight: 700 }}>URGENT</span>
                        : <span style={{ color: '#6b7280' }}>No</span>}
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

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' },
  center:    { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af' },
  heading:   { fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#f1f5f9' },
  grid:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  card:      { background: '#1e293b', borderRadius: 12, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 16, marginTop: 0 },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { textAlign: 'left', padding: '6px 10px', color: '#64748b', borderBottom: '1px solid #334155', fontWeight: 500 },
  tr:        { borderBottom: '1px solid #1e293b' },
  td:        { padding: '8px 10px', color: '#cbd5e1' },
  badge:     { padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: '#fff', textTransform: 'capitalize' },
};
