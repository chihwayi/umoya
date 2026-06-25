import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '../services/api';

interface ChdEntry {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  primary_diagnosis: string;
  chd_category: 'cyanotic' | 'acyanotic' | 'complex' | 'acquired';
  current_status: string;
  shunt_direction: string | null;
  enrolled_at: string;
}

interface OverdueFollowup {
  id: string;
  first_name: string;
  last_name: string;
  primary_diagnosis: string;
  followup_type: string;
  due_date: string;
}

interface EchoPoint {
  echo_date: string;
  lv_sf_pct: number | null;
  lv_ef_pct: number | null;
}

const CATEGORY_COLOUR: Record<string, string> = {
  cyanotic:  '#E8614D',
  acyanotic: '#0AA98A',
  complex:   '#F0954A',
  acquired:  '#3B9EFF',
};

const STATUS_LABEL: Record<string, string> = {
  active:             'Active',
  palliated:          'Palliated',
  corrected:          'Corrected',
  lost_to_followup:   'Lost',
  deceased:           'Deceased',
};

function age(dob: string): string {
  const diff = Date.now() - new Date(dob).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) return `${years}y`;
  const months = Math.floor(diff / (30.44 * 24 * 3600 * 1000));
  return `${months}m`;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function PaedCardiologyDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [register, setRegister] = useState<ChdEntry[]>([]);
  const [overdue, setOverdue] = useState<OverdueFollowup[]>([]);
  const [echoTrend, setEchoTrend] = useState<EchoPoint[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/paed-cardiology/chd-register'),
      api.get('/paed-cardiology/followup/overdue'),
    ]).then(([reg, ov]) => {
      const regData: ChdEntry[] = reg.data ?? reg;
      setRegister(regData);
      setOverdue(ov.data ?? ov);
      if (regData.length > 0 && !selectedPatient) {
        const first = regData[0];
        setSelectedPatient(first.id);
        loadEchoTrend((first as any).patient_id ?? first.id);
      }
    }).finally(() => setLoading(false));
  }, [tenantSlug]);

  function loadEchoTrend(patientId: string) {
    api.get(`/paed-cardiology/echo/${patientId}`)
      .then((r: any) => {
        const pts: EchoPoint[] = (r.data ?? r).slice(0, 10).reverse();
        setEchoTrend(pts);
      });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b7280' }}>
        Loading Paediatric Cardiology…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16, padding: 24, fontFamily: 'Inter, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Main Column */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Paediatric Cardiology</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>CHD Register • Echo Trends • Interventions</p>
        </div>

        {/* Summary tiles */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {(['cyanotic', 'acyanotic', 'complex', 'acquired'] as const).map(cat => {
            const count = register.filter(r => r.chd_category === cat).length;
            return (
              <div key={cat} style={{ flex: '1 1 120px', background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: `4px solid ${CATEGORY_COLOUR[cat]}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CATEGORY_COLOUR[cat], textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginTop: 4 }}>{count}</div>
              </div>
            );
          })}
        </div>

        {/* CHD Register Table */}
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 14, color: '#374151' }}>CHD Register</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#6b7280' }}>
                  {['Patient', 'Age', 'Diagnosis', 'Category', 'Shunt', 'Status', 'Enrolled'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {register.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => { setSelectedPatient(r.id); loadEchoTrend((r as any).patient_id ?? r.id); }}
                    style={{ cursor: 'pointer', background: selectedPatient === r.id ? '#f0fdf4' : i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{r.first_name} {r.last_name}</td>
                    <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.date_of_birth ? age(r.date_of_birth) : '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{r.primary_diagnosis}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: CATEGORY_COLOUR[r.chd_category] + '22', color: CATEGORY_COLOUR[r.chd_category], borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                        {r.chd_category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 11 }}>{r.shunt_direction?.replace(/_/g, '→') ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: r.current_status === 'corrected' ? '#dcfce7' : r.current_status === 'active' ? '#dbeafe' : '#fef3c7', color: r.current_status === 'corrected' ? '#15803d' : r.current_status === 'active' ? '#1d4ed8' : '#92400e', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                        {STATUS_LABEL[r.current_status] ?? r.current_status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 11 }}>{new Date(r.enrolled_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {register.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No patients in CHD register</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Echo Trend Panel */}
        {echoTrend.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.08)', padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 16 }}>Echo Trend — LV Function</div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={echoTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="echo_date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => new Date(v).toLocaleDateString()} />
                <YAxis yAxisId="sf" domain={[0, 70]} tick={{ fontSize: 11, fill: '#9ca3af' }} label={{ value: 'SF %', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#9ca3af' } }} />
                <YAxis yAxisId="ef" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} label={{ value: 'EF %', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#9ca3af' } }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {/* Normal SF range shading */}
                <ReferenceLine yAxisId="sf" y={28} stroke="#0AA98A" strokeDasharray="4 4" strokeWidth={1} />
                <ReferenceLine yAxisId="sf" y={44} stroke="#0AA98A" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Normal', position: 'right', fontSize: 10, fill: '#0AA98A' }} />
                <Area yAxisId="sf" type="monotone" dataKey="lv_sf_pct" fill="#0AA98A22" stroke="#0AA98A" strokeWidth={2} name="LV SF%" dot={{ r: 4, fill: '#0AA98A' }} />
                <Line yAxisId="ef" type="monotone" dataKey="lv_ef_pct" stroke="#3B9EFF" strokeWidth={2} name="LV EF%" dot={{ r: 4, fill: '#3B9EFF' }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Dashed green lines = normal SF range (28–44%). Click a patient row to load their trend.</div>
          </div>
        )}
      </div>

      {/* Right Sidebar — Overdue Follow-ups */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#991b1b' }}>Overdue Follow-ups</span>
            {overdue.length > 0 && (
              <span style={{ marginLeft: 'auto', background: '#E8614D', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{overdue.length}</span>
            )}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {overdue.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No overdue follow-ups</div>
            )}
            {overdue.map(f => (
              <div key={f.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{f.first_name} {f.last_name}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{f.primary_diagnosis ?? 'CHD'}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{f.followup_type?.replace('_', ' ')}</span>
                  <span style={{ background: '#fef2f2', color: '#E8614D', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                    {daysSince(f.due_date)}d overdue
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
