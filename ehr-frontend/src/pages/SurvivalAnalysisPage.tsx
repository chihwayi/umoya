import React, { useState } from 'react';
import { ehrApi as api } from '../services/api';

interface KmPoint {
  time: number;
  survivalProbability: number;
  atRisk: number;
  events: number;
  censored: number;
  lowerCI: number;
  upperCI: number;
}

const CHART_WIDTH = 700;
const CHART_HEIGHT = 300;
const PAD = { top: 20, right: 20, bottom: 40, left: 55 };

function kmPath(points: KmPoint[], maxTime: number): string {
  if (!points.length) return '';
  const w = CHART_WIDTH - PAD.left - PAD.right;
  const h = CHART_HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => (t / maxTime) * w;
  const y = (s: number) => h - s * h;

  let d = `M ${x(0)} ${y(1)}`;
  for (const p of points) {
    d += ` H ${x(p.time)} V ${y(p.survivalProbability)}`;
  }
  const last = points[points.length - 1];
  d += ` H ${x(maxTime)} V ${y(last.survivalProbability)}`;
  return d;
}

function ciPath(points: KmPoint[], maxTime: number): string {
  if (!points.length) return '';
  const w = CHART_WIDTH - PAD.left - PAD.right;
  const h = CHART_HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => (t / maxTime) * w;
  const y = (s: number) => h - s * h;

  let upper = `M ${x(0)} ${y(1)}`;
  let lower = `M ${x(0)} ${y(1)}`;
  for (const p of points) {
    upper += ` H ${x(p.time)} V ${y(p.upperCI)}`;
    lower += ` H ${x(p.time)} V ${y(p.lowerCI)}`;
  }
  const last = points[points.length - 1];
  upper += ` H ${x(maxTime)} V ${y(last.upperCI)}`;
  lower += ` H ${x(maxTime)} V ${y(last.lowerCI)}`;
  const lowerReversed = lower.replace('M', 'L');
  return `${upper} ${lowerReversed} Z`;
}

interface Props { token: string; tenantSlug: string; }

export default function SurvivalAnalysisPage({ token, tenantSlug }: Props) {
  const [eventType, setEventType] = useState<'ltfu' | 'treatment_failure'>('ltfu');
  const [cohortStart, setCohortStart] = useState('2024-01-01');
  const [result, setResult] = useState<{ points: KmPoint[]; medianTime: number | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getKaplanMeier(eventType, cohortStart, token, tenantSlug);
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  }

  const maxTime = result?.points.length ? Math.max(...result.points.map(p => p.time)) : 36;
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const xTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxTime / 4) * i));
  const w = CHART_WIDTH - PAD.left - PAD.right;
  const h = CHART_HEIGHT - PAD.top - PAD.bottom;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 20px' }}>Kaplan-Meier Survival Analysis</h2>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#666' }}>Event Type</label>
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value as any)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          >
            <option value="ltfu">Loss to Follow-Up (LTFU)</option>
            <option value="treatment_failure">Treatment Failure (VL ≥ 1000)</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#666' }}>Cohort Start (ART initiation year)</label>
          <input
            type="date"
            value={cohortStart}
            onChange={e => setCohortStart(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          />
        </div>
        <button
          onClick={run}
          disabled={loading}
          style={{ padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
        >
          {loading ? 'Computing…' : 'Run Analysis'}
        </button>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: 16 }}>{error}</div>}

      {result && (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 20px' }}>
              <div style={{ fontSize: 12, color: '#166534' }}>Median Survival (months)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d' }}>
                {result.medianTime !== null ? result.medianTime : 'Not reached'}
              </div>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 20px' }}>
              <div style={{ fontSize: 12, color: '#1e40af' }}>Total patients in cohort</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1d4ed8' }}>
                {result.points[0]?.atRisk ?? 0}
              </div>
            </div>
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '12px 20px' }}>
              <div style={{ fontSize: 12, color: '#6b21a8' }}>S(t) at final time point</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>
                {result.points.length ? (result.points[result.points.length - 1].survivalProbability * 100).toFixed(1) + '%' : '—'}
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#374151' }}>
              Survival Curve — {eventType === 'ltfu' ? 'Loss to Follow-Up' : 'Treatment Failure'}
              <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>95% CI shaded</span>
            </h3>
            <svg width={CHART_WIDTH} height={CHART_HEIGHT}>
              <g transform={`translate(${PAD.left},${PAD.top})`}>
                {/* Y-axis grid + labels */}
                {yTicks.map(v => (
                  <g key={v}>
                    <line x1={0} y1={h - v * h} x2={w} y2={h - v * h} stroke="#f3f4f6" />
                    <text x={-8} y={h - v * h + 4} textAnchor="end" fontSize={10} fill="#6b7280">{(v * 100).toFixed(0)}%</text>
                  </g>
                ))}
                {/* X-axis labels */}
                {xTicks.map(t => (
                  <text key={t} x={(t / maxTime) * w} y={h + 18} textAnchor="middle" fontSize={10} fill="#6b7280">{t}mo</text>
                ))}
                {/* CI band */}
                {result.points.length > 0 && (
                  <path d={ciPath(result.points, maxTime)} fill="rgba(37,99,235,0.12)" />
                )}
                {/* KM step curve */}
                {result.points.length > 0 && (
                  <path d={kmPath(result.points, maxTime)} fill="none" stroke="#2563eb" strokeWidth={2} />
                )}
                {/* Median line */}
                {result.medianTime !== null && (
                  <line
                    x1={(result.medianTime / maxTime) * w} y1={0}
                    x2={(result.medianTime / maxTime) * w} y2={h}
                    stroke="#dc2626" strokeWidth={1} strokeDasharray="4 3"
                  />
                )}
                {/* Axis borders */}
                <line x1={0} y1={0} x2={0} y2={h} stroke="#d1d5db" />
                <line x1={0} y1={h} x2={w} y2={h} stroke="#d1d5db" />
              </g>
            </svg>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Time (mo)', 'At Risk', 'Events', 'Censored', 'S(t)', '95% CI Lower', '95% CI Upper'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.points.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 12px' }}>{p.time}</td>
                    <td style={{ padding: '6px 12px' }}>{p.atRisk}</td>
                    <td style={{ padding: '6px 12px', color: p.events > 0 ? '#dc2626' : undefined }}>{p.events}</td>
                    <td style={{ padding: '6px 12px', color: '#9ca3af' }}>{p.censored}</td>
                    <td style={{ padding: '6px 12px', fontWeight: 600 }}>{(p.survivalProbability * 100).toFixed(1)}%</td>
                    <td style={{ padding: '6px 12px', color: '#6b7280' }}>{(p.lowerCI * 100).toFixed(1)}%</td>
                    <td style={{ padding: '6px 12px', color: '#6b7280' }}>{(p.upperCI * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
