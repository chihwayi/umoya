import React, { useState } from 'react';

interface Props {
  score: number;
  band: 'low' | 'moderate' | 'high' | 'critical';
  factors?: Record<string, unknown>;
}

const BAND_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  low:      { bg: '#dcfce7', color: '#16a34a', label: 'LOW' },
  moderate: { bg: '#fef9c3', color: '#a16207', label: 'MOD' },
  high:     { bg: '#ffedd5', color: '#f97316', label: 'HIGH' },
  critical: { bg: '#fee2e2', color: '#dc2626', label: 'CRIT' },
};

export const MortalityRiskBadge: React.FC<Props> = ({ score, band, factors }) => {
  const [showDetails, setShowDetails] = useState(false);
  const style = BAND_STYLE[band] ?? BAND_STYLE.low;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        title="30-day mortality risk"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '3px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
          backgroundColor: style.bg, color: style.color,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800 }}>{score}</span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{style.label}</span>
      </button>

      {showDetails && factors && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 100,
          backgroundColor: 'white', border: '1px solid #e5e7eb',
          borderRadius: 8, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: 200, fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Mortality Risk Breakdown</div>
          {Object.entries(factors).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>
                {k.replace(/([A-Z])/g, ' $1').trim()}:
              </span>
              <span style={{ fontWeight: 600 }}>{String(v)}</span>
            </div>
          ))}
          <button
            onClick={() => setShowDetails(false)}
            style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
