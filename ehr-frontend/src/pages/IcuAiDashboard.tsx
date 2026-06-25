import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, Wind, Droplets, ClipboardList,
  ChevronDown, ChevronUp, Copy, RefreshCw, X,
} from 'lucide-react';
import { api } from '../services/api';

// ── Colour tokens ──────────────────────────────────────────────────────────
const COLOR = {
  coral:        '#E8614D',
  coralLight:   '#E8614D22',
  teal:         '#1B8A7A',
  tealLight:    '#1B8A7A22',
  amber:        '#F0954A',
  amberLight:   '#F0954A22',
  green:        '#1B6B3A',
  greenLight:   '#1B6B3A22',
  surface:      '#FFFFFF',
  bg:           '#F4F7FB',
  border:       '#E2E8F0',
  text:         '#1A2533',
  textMuted:    '#7A9CBC',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: COLOR.coral,
  high:     COLOR.amber,
  stable:   COLOR.teal,
};

// ── Arc Gauge ──────────────────────────────────────────────────────────────
function ArcGauge({ pct, label }: { pct: number; label: string }) {
  const radius = 36;
  const circ   = Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const fill   = pct >= 80 ? COLOR.teal : pct >= 50 ? COLOR.amber : COLOR.coral;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={90} height={50} viewBox="0 0 90 50">
        <path
          d={`M 9 45 A ${radius} ${radius} 0 0 1 81 45`}
          fill="none" stroke={COLOR.border} strokeWidth={8} strokeLinecap="round"
        />
        <path
          d={`M 9 45 A ${radius} ${radius} 0 0 1 81 45`}
          fill="none" stroke={fill} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
        <text x="45" y="42" textAnchor="middle" fontSize="13" fontWeight="700" fill={fill}>
          {pct}%
        </text>
      </svg>
      <span style={{ fontSize: 11, color: COLOR.textMuted, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ── SOFA Alert Card ────────────────────────────────────────────────────────
function SofaAlertCard({ alert, onAck }: { alert: any; onAck: (id: string) => void }) {
  const color = SEVERITY_COLOR[alert.alert_severity] ?? COLOR.amber;
  return (
    <div style={{
      background: COLOR.surface, borderRadius: 10, padding: 14, marginBottom: 10,
      borderLeft: `4px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <AlertTriangle size={14} color={color} />
        <span style={{ fontWeight: 700, fontSize: 13, color: COLOR.text }}>
          Bed {alert.bed_number ?? alert.bed_code} — {alert.first_name} {alert.last_name}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 2 }}>
        {alert.alert_severity?.toUpperCase()} — SOFA {alert.score_now} (Δ +{alert.delta})
      </div>
      <div style={{ fontSize: 11, color: COLOR.textMuted, marginBottom: 8 }}>
        {new Date(alert.created_at).toLocaleTimeString()}
      </div>
      <button
        onClick={() => onAck(alert.id)}
        style={{
          background: COLOR.tealLight, border: `1px solid ${COLOR.teal}`,
          borderRadius: 20, padding: '4px 14px', fontSize: 12,
          color: COLOR.teal, cursor: 'pointer', fontWeight: 600,
        }}
      >
        Acknowledge
      </button>
    </div>
  );
}

// ── Vent Safety Row ────────────────────────────────────────────────────────
function VentSafetyRow({ check }: { check: any }) {
  const safe = check.overall_safe !== false;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderBottom: `1px solid ${COLOR.border}`,
    }}>
      <div style={{ fontSize: 13, color: COLOR.text }}>
        Bed {check.bed_code ?? check.bed_number}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {safe
          ? <CheckCircle size={16} color={COLOR.green} />
          : <AlertTriangle size={16} color={COLOR.coral} />
        }
        <span style={{ fontSize: 12, color: safe ? COLOR.green : COLOR.coral, fontWeight: 600 }}>
          {safe ? 'SAFE' : `${check.violations?.length ?? 1} VIOLATION${(check.violations?.length ?? 1) > 1 ? 'S' : ''}`}
        </span>
      </div>
    </div>
  );
}

// ── Handover Modal ─────────────────────────────────────────────────────────
function HandoverModal({ onClose }: { onClose: () => void }) {
  const [note, setNote]       = useState<any>(null);
  const [generating, setGen]  = useState(false);
  const [copied, setCopied]   = useState(false);
  const [shift, setShift]     = useState('morning');

  useEffect(() => {
    api.get('/icu/ai/handover/latest')
      .then((r: any) => setNote(r.data ?? r))
      .catch(() => {});
  }, []);

  const generate = async () => {
    setGen(true);
    try {
      const r: any = await api.post('/icu/ai/handover/generate', { shift });
      setNote(r.data ?? r);
    } finally {
      setGen(false);
    }
  };

  const copy = () => {
    if (note?.summary_text) {
      navigator.clipboard.writeText(note.summary_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: COLOR.surface, borderRadius: 14, padding: 24,
        width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: COLOR.text }}>ICU Handover Note</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} color={COLOR.textMuted} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['morning','afternoon','night'] as const).map(s => (
            <button
              key={s}
              onClick={() => setShift(s)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: shift === s ? COLOR.teal : COLOR.border,
                color: shift === s ? '#fff' : COLOR.text,
                border: 'none', cursor: 'pointer',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button
            onClick={generate}
            disabled={generating}
            style={{
              marginLeft: 'auto', padding: '5px 16px', borderRadius: 20,
              background: COLOR.teal, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center',
            }}
          >
            <RefreshCw size={12} /> {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>

        <pre style={{
          flex: 1, overflowY: 'auto', background: COLOR.bg, borderRadius: 8, padding: 14,
          fontSize: 12, lineHeight: 1.7, color: COLOR.text, whiteSpace: 'pre-wrap',
          fontFamily: 'monospace', border: `1px solid ${COLOR.border}`,
        }}>
          {note?.summary_text ?? 'No handover note yet. Click Generate.'}
        </pre>

        <button
          onClick={copy}
          disabled={!note}
          style={{
            marginTop: 12, padding: '8px 0', borderRadius: 8,
            background: copied ? COLOR.greenLight : COLOR.tealLight,
            border: `1px solid ${copied ? COLOR.green : COLOR.teal}`,
            color: copied ? COLOR.green : COLOR.teal,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Copy size={13} /> {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function IcuAiDashboard() {
  const [alerts, setAlerts]     = useState<any[]>([]);
  const [ventChecks, setVent]   = useState<any[]>([]);
  const [bundles, setBundles]   = useState<any[]>([]);
  const [fluidWarn, setFluid]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [handoverOpen, setHO]   = useState(false);
  const [ventOpen, setVentOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, f] = await Promise.all([
        api.get('/icu/ai/sofa-alerts/active').then((r: any) => r.data ?? r),
        api.get('/icu/ai/fluid-overload-warnings').then((r: any) => r.data ?? r),
      ]);
      setAlerts(a);
      setFluid(f);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAck = async (id: string) => {
    try {
      await api.patch(`/icu/ai/sofa-alerts/${id}/acknowledge`, {});
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const vapPct  = bundles.find(b => b.bundle_type === 'vap')?.compliance_pct  ?? null;
  const cautiPct = bundles.find(b => b.bundle_type === 'cauti')?.compliance_pct ?? null;

  return (
    <div style={{ minHeight: '100vh', background: COLOR.bg, padding: '24px 28px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: COLOR.text }}>ICU — AI Safety & Quality</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: COLOR.textMuted }}>
            SOFA alerts · ventilator safety · care bundle compliance · handover
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, border: `1px solid ${COLOR.border}`, background: COLOR.surface,
              fontSize: 13, color: COLOR.text, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={() => setHO(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
              borderRadius: 8, border: 'none', background: COLOR.teal,
              fontSize: 13, color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ClipboardList size={13} /> Handover
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: COLOR.textMuted }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left: Alert Rail ── */}
          <div>
            <div style={{
              background: COLOR.surface, borderRadius: 12, padding: 16, marginBottom: 16,
              border: `1px solid ${COLOR.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <AlertTriangle size={16} color={COLOR.coral} />
                <span style={{ fontWeight: 700, fontSize: 14, color: COLOR.text }}>SOFA Deterioration</span>
                {alerts.length > 0 && (
                  <span style={{
                    marginLeft: 'auto', background: COLOR.coral, color: '#fff',
                    borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                  }}>{alerts.length}</span>
                )}
              </div>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <CheckCircle size={24} color={COLOR.green} style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13, color: COLOR.textMuted }}>No active alerts</div>
                </div>
              ) : (
                alerts.map(a => <SofaAlertCard key={a.id} alert={a} onAck={handleAck} />)
              )}
            </div>

            {/* Fluid Overload */}
            <div style={{
              background: COLOR.surface, borderRadius: 12, padding: 16,
              border: `1px solid ${COLOR.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Droplets size={16} color={COLOR.amber} />
                <span style={{ fontWeight: 700, fontSize: 14, color: COLOR.text }}>Fluid Overload (48h)</span>
              </div>
              {fluidWarn.length === 0 ? (
                <div style={{ fontSize: 12, color: COLOR.textMuted, textAlign: 'center', padding: '12px 0' }}>No warnings</div>
              ) : (
                fluidWarn.map((f, i) => (
                  <div key={i} style={{
                    padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                    background: COLOR.amberLight, border: `1px solid ${COLOR.amber}33`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLOR.text }}>
                      Bed {f.bed_number ?? f.bed_code} — {f.first_name} {f.last_name}
                    </div>
                    <div style={{ fontSize: 11, color: COLOR.amber, fontWeight: 600 }}>
                      +{Number(f.cumulative_48h_ml).toLocaleString()} ml cumulative
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right: Main panels ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Vent Safety Panel */}
            <div style={{
              background: COLOR.surface, borderRadius: 12, border: `1px solid ${COLOR.border}`, overflow: 'hidden',
            }}>
              <button
                onClick={() => setVentOpen(v => !v)}
                style={{
                  width: '100%', padding: '14px 18px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                }}
              >
                <Wind size={16} color={COLOR.teal} />
                <span style={{ fontWeight: 700, fontSize: 15, color: COLOR.text }}>Ventilator Safety</span>
                <span style={{ marginLeft: 'auto', color: COLOR.textMuted }}>
                  {ventOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              {ventOpen && (
                ventChecks.length === 0 ? (
                  <div style={{ padding: '12px 18px', fontSize: 13, color: COLOR.textMuted }}>
                    No recent safety checks. Use POST /icu/ai/vent-safety-check to run checks.
                  </div>
                ) : (
                  ventChecks.map((c, i) => <VentSafetyRow key={i} check={c} />)
                )
              )}
            </div>

            {/* Bundle Compliance */}
            <div style={{
              background: COLOR.surface, borderRadius: 12, padding: 20, border: `1px solid ${COLOR.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <CheckCircle size={16} color={COLOR.teal} />
                <span style={{ fontWeight: 700, fontSize: 15, color: COLOR.text }}>Care Bundle Compliance</span>
              </div>
              <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
                <ArcGauge pct={vapPct ?? 0} label="VAP Bundle" />
                <ArcGauge pct={cautiPct ?? 0} label="CAUTI Bundle" />
              </div>
              {(vapPct !== null || cautiPct !== null) && (
                <div style={{ marginTop: 14, fontSize: 12, color: COLOR.textMuted, textAlign: 'center' }}>
                  Threshold: ≥80% = compliant &nbsp;|&nbsp; Updated today
                </div>
              )}
              {vapPct === null && cautiPct === null && (
                <div style={{ textAlign: 'center', fontSize: 13, color: COLOR.textMuted, marginTop: 8 }}>
                  No bundle data for today yet. Document via POST /icu/ai/care-bundle.
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{
              background: COLOR.surface, borderRadius: 12, padding: 18, border: `1px solid ${COLOR.border}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: COLOR.text, marginBottom: 14 }}>Quick Actions</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Run Vent Safety Check', color: COLOR.teal },
                  { label: 'Document VAP Bundle',   color: COLOR.amber },
                  { label: 'Document CAUTI Bundle', color: COLOR.amber },
                  { label: 'Log SOFA Score',        color: COLOR.coral },
                ].map(({ label, color }) => (
                  <button
                    key={label}
                    style={{
                      padding: '7px 16px', borderRadius: 20, border: `1px solid ${color}33`,
                      background: color + '18', color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {handoverOpen && <HandoverModal onClose={() => setHO(false)} />}
    </div>
  );
}
