import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface HbotCourse {
  id: string;
  first_name: string;
  last_name: string;
  indication: string;
  indication_category: string;
  prescribed_sessions: number;
  completed_sessions: number;
  remaining_sessions: number;
  target_ata: number;
  status: string;
  start_date: string;
  has_absolute_contraindication?: boolean;
}

interface WoundPoint {
  session_number: number;
  wound_area_cm2: number | null;
  granulation_pct: number | null;
  measured_at: string;
}

const TEAL = '#0AA98A';
const CORAL = '#E53E3E';
const GREEN = '#38A169';

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ background: '#e2e8f0', borderRadius: 8, height: 10, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: 10, background: TEAL, borderRadius: 8, transition: 'width 0.4s' }} />
    </div>
  );
}

function WoundChart({ data }: { data: WoundPoint[] }) {
  if (!data.length) return <p style={{ color: '#718096', fontSize: 13 }}>No wound progress data recorded yet.</p>;
  const maxArea = Math.max(...data.map(d => d.wound_area_cm2 ?? 0), 1);
  const W = 480, H = 140, pad = 40;
  const xStep = data.length > 1 ? (W - pad * 2) / (data.length - 1) : 0;
  const yScale = (v: number) => H - pad - ((v / maxArea) * (H - pad * 2));

  const areaPath = data.map((d, i) => {
    const x = pad + i * xStep;
    const y = yScale(d.wound_area_cm2 ?? 0);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ') + ` L${pad + (data.length - 1) * xStep},${H - pad} L${pad},${H - pad} Z`;

  const granPath = data.map((d, i) => {
    const x = pad + i * xStep;
    const y = H - pad - (((d.granulation_pct ?? 0) / 100) * (H - pad * 2));
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      <path d={areaPath} fill={TEAL + '33'} stroke={TEAL} strokeWidth={2} />
      <path d={granPath} fill="none" stroke={GREEN} strokeWidth={2} strokeDasharray="4 3" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={pad + i * xStep} cy={yScale(d.wound_area_cm2 ?? 0)} r={3} fill={TEAL} />
          <text x={pad + i * xStep} y={H - 6} textAnchor="middle" fontSize={10} fill="#718096">{d.session_number}</text>
        </g>
      ))}
      <text x={6} y={pad} fontSize={10} fill={TEAL}>Area (cm²)</text>
      <text x={W - 6} y={pad} fontSize={10} fill={GREEN} textAnchor="end">Granulation%</text>
    </svg>
  );
}

export default function HbotDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [courses, setCourses] = useState<HbotCourse[]>([]);
  const [woundData, setWoundData] = useState<Record<string, WoundPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const base = `/api/tenants/${tenantSlug}/ehr`;
    axios.get(`${base}/hbot/courses/active`)
      .then(r => {
        const list: HbotCourse[] = r.data ?? [];
        setCourses(list);
        return Promise.all(
          list.map(c =>
            axios.get(`${base}/hbot/wound-progress/${c.id}`)
              .then(wr => ({ id: c.id, data: wr.data ?? [] }))
              .catch(() => ({ id: c.id, data: [] })),
          ),
        );
      })
      .then(results => {
        const map: Record<string, WoundPoint[]> = {};
        results.forEach(r => { map[r.id] = r.data; });
        setWoundData(map);
      })
      .catch(() => setError('Failed to load HBOT data'))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  const absoluteAlert = courses.some(c => c.has_absolute_contraindication);

  if (loading) return <div style={{ padding: 32, color: '#718096' }}>Loading HBOT data…</div>;
  if (error) return <div style={{ padding: 32, color: CORAL }}>{error}</div>;

  return (
    <div style={{ padding: '24px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a202c', margin: '0 0 4px' }}>Hyperbaric Oxygen Therapy</h1>
      <p style={{ color: '#718096', margin: '0 0 24px', fontSize: 14 }}>Active HBOT courses — chamber scheduling, session tracking, wound progress</p>

      {absoluteAlert && (
        <div style={{ background: CORAL + '18', border: `1px solid ${CORAL}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: CORAL, fontWeight: 600, fontSize: 14 }}>
          ABSOLUTE CONTRAINDICATION identified on one or more active courses. Review before proceeding with sessions.
        </div>
      )}

      {courses.length === 0 ? (
        <div style={{ background: '#f7fafc', borderRadius: 12, padding: 32, textAlign: 'center', color: '#a0aec0', fontSize: 15 }}>
          No active HBOT courses. Prescribe a new course to get started.
        </div>
      ) : (
        courses.map(c => {
          const pct = c.prescribed_sessions > 0 ? Math.min((c.completed_sessions / c.prescribed_sessions) * 100, 100) : 0;
          const wounds = woundData[c.id] ?? [];
          return (
            <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: '#2d3748' }}>
                    {c.first_name} {c.last_name}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#718096' }}>
                    {c.indication} — <span style={{ textTransform: 'capitalize' }}>{c.indication_category.replace(/_/g, ' ')}</span>
                  </p>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: c.status === 'active' ? TEAL + '22' : '#e2e8f0',
                  color: c.status === 'active' ? TEAL : '#718096',
                }}>
                  {c.status}
                </span>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#4a5568', marginBottom: 4 }}>
                  <span>Sessions: <strong>{c.completed_sessions}</strong> / {c.prescribed_sessions}</span>
                  <span style={{ color: TEAL, fontWeight: 600 }}>{Math.round(pct)}%</span>
                </div>
                <ProgressBar value={c.completed_sessions} max={c.prescribed_sessions} />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#a0aec0' }}>
                  {c.remaining_sessions} sessions remaining · Target {c.target_ata} ATA · Started {c.start_date}
                </p>
              </div>

              {wounds.length > 0 && (
                <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#4a5568' }}>Wound Progress</p>
                  <WoundChart data={wounds} />
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: TEAL }}>— Wound area (cm²)</span>
                    <span style={{ fontSize: 11, color: GREEN }}>-- Granulation %</span>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
