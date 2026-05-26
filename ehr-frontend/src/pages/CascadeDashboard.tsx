import React, { useEffect, useState } from 'react';
import { ehrApi } from '../services/api';

interface CascadeData {
  diagnosedCount: number;
  onArtCount: number;
  suppressedCount: number;
  second95: number;
  third95: number;
  bySex: Record<string, any>;
  byAgeBand: Record<string, any>;
}

interface Snapshot {
  snapshot_date: string;
  period_label: string;
  diagnosed_count: number;
  on_art_count: number;
  suppressed_count: number;
  second_95: number;
  third_95: number;
}

interface Props { token: string; tenantSlug: string; }

const TARGET = 95;

function pctColor(pct: number): string {
  if (pct >= TARGET) return '#10b981';
  if (pct >= 85) return '#f59e0b';
  return '#ef4444';
}

function CascadeBar({ label, count, pct, target }: { label: string; count: number; pct: number; target: string }) {
  const color = pctColor(pct);
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{count.toLocaleString()}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{pct.toFixed(1)}%</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>target {target}</div>
      <div style={{ background: '#e5e7eb', borderRadius: 4, height: 8, marginTop: 8 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

export default function CascadeDashboard({ token, tenantSlug }: Props) {
  const [cascade, setCascade] = useState<CascadeData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [disagg, setDisagg] = useState<'none' | 'sex' | 'age'>('none');
  const [loading, setLoading] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCascade();
    loadSnapshots();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCascade() {
    setLoading(true);
    const { data } = await ehrApi.getCurrentCascade(token, tenantSlug);
    setCascade(data);
    setLoading(false);
  }

  async function loadSnapshots() {
    const { data } = await ehrApi.getCascadeSnapshots(token, tenantSlug);
    setSnapshots(data || []);
  }

  async function handleSaveSnapshot() {
    if (!snapshotLabel) return;
    setSaving(true);
    await ehrApi.saveCascadeSnapshot({ periodLabel: snapshotLabel }, token, tenantSlug);
    setSaving(false);
    setSnapshotLabel('');
    loadSnapshots();
  }

  if (loading || !cascade) {
    return <div style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>Loading cascade data…</p></div>;
  }

  const totalEstimate = cascade.diagnosedCount;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>UNAIDS 95-95-95 Cascade</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={snapshotLabel} onChange={e => setSnapshotLabel(e.target.value)}
            placeholder="Period label (e.g. Q2 2026)"
            style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #d1d5db', width: 200 }} />
          <button onClick={handleSaveSnapshot} disabled={saving || !snapshotLabel}
            style={{ padding: '7px 14px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Save Snapshot'}
          </button>
        </div>
      </div>

      {/* Cascade bars */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 28, border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <CascadeBar label="Diagnosed / Registered" count={cascade.diagnosedCount}
            pct={(cascade.diagnosedCount / Math.max(totalEstimate, 1)) * 100} target="95% of PLHIV" />
          <div style={{ width: 2, background: '#e5e7eb', alignSelf: 'stretch' }} />
          <CascadeBar label="On ART" count={cascade.onArtCount} pct={cascade.second95} target="95% of diagnosed" />
          <div style={{ width: 2, background: '#e5e7eb', alignSelf: 'stretch' }} />
          <CascadeBar label="Virally Suppressed" count={cascade.suppressedCount} pct={cascade.third95} target="95% of on ART" />
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
          Viral suppression = VL &lt;1000 copies/mL in last 12 months
        </div>
      </div>

      {/* Disaggregation */}
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#374151', marginRight: 12, fontWeight: 600 }}>Disaggregate by:</span>
        {(['none', 'sex', 'age'] as const).map(d => (
          <button key={d} onClick={() => setDisagg(d)}
            style={{ marginRight: 8, padding: '5px 14px', borderRadius: 20, border: '1px solid #d1d5db', cursor: 'pointer',
              background: disagg === d ? '#6366f1' : '#fff', color: disagg === d ? '#fff' : '#374151', fontSize: 13 }}>
            {d === 'none' ? 'Overall' : d === 'sex' ? 'Sex' : 'Age Band'}
          </button>
        ))}
      </div>

      {disagg === 'sex' && Object.keys(cascade.bySex).length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px' }}>By Sex</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f9fafb' }}>
              {['Sex', 'Diagnosed', 'On ART', 'Suppressed', '2nd 95', '3rd 95'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {Object.entries(cascade.bySex).map(([sex, d]: [string, any]) => {
                const s95 = d.diagnosed > 0 ? (d.on_art / d.diagnosed * 100).toFixed(1) : '—';
                const t95 = d.on_art > 0 ? (d.suppressed / d.on_art * 100).toFixed(1) : '—';
                return (
                  <tr key={sex} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{sex}</td>
                    <td style={{ padding: '8px 12px' }}>{d.diagnosed}</td>
                    <td style={{ padding: '8px 12px' }}>{d.on_art}</td>
                    <td style={{ padding: '8px 12px' }}>{d.suppressed}</td>
                    <td style={{ padding: '8px 12px', color: pctColor(parseFloat(s95)) }}>{s95}%</td>
                    <td style={{ padding: '8px 12px', color: pctColor(parseFloat(t95)) }}>{t95}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {disagg === 'age' && Object.keys(cascade.byAgeBand).length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px' }}>By Age Band</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f9fafb' }}>
              {['Age Band', 'Diagnosed', 'On ART', 'Suppressed', '2nd 95', '3rd 95'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {Object.entries(cascade.byAgeBand).map(([band, d]: [string, any]) => {
                const s95 = d.diagnosed > 0 ? (d.on_art / d.diagnosed * 100).toFixed(1) : '—';
                const t95 = d.on_art > 0 ? (d.suppressed / d.on_art * 100).toFixed(1) : '—';
                return (
                  <tr key={band} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{band}</td>
                    <td style={{ padding: '8px 12px' }}>{d.diagnosed}</td>
                    <td style={{ padding: '8px 12px' }}>{d.on_art}</td>
                    <td style={{ padding: '8px 12px' }}>{d.suppressed}</td>
                    <td style={{ padding: '8px 12px', color: pctColor(parseFloat(s95)) }}>{s95}%</td>
                    <td style={{ padding: '8px 12px', color: pctColor(parseFloat(t95)) }}>{t95}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Snapshot trend */}
      {snapshots.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb' }}>
          <h4 style={{ margin: '0 0 12px' }}>Historical Snapshots</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f9fafb' }}>
              {['Period', 'Diagnosed', 'On ART', 'Suppressed', '2nd 95', '3rd 95'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {snapshots.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.period_label || s.snapshot_date?.slice(0, 10)}</td>
                  <td style={{ padding: '8px 12px' }}>{s.diagnosed_count}</td>
                  <td style={{ padding: '8px 12px' }}>{s.on_art_count}</td>
                  <td style={{ padding: '8px 12px' }}>{s.suppressed_count}</td>
                  <td style={{ padding: '8px 12px', color: pctColor(Number(s.second_95)) }}>{Number(s.second_95).toFixed(1)}%</td>
                  <td style={{ padding: '8px 12px', color: pctColor(Number(s.third_95)) }}>{Number(s.third_95).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
