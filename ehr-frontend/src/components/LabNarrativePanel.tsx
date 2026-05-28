import React, { useState } from 'react';
import { api } from '../services/api';
import { AiStatusBadge } from './AiStatusBadge';

interface Props { resultId: string; }

export const LabNarrativePanel: React.FC<Props> = ({ resultId }) => {
  const [narrative, setNarrative] = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);

  const load = async () => {
    if (narrative) { setOpen(!open); return; }
    setLoading(true);
    try {
      const res = await api.get(`/labs/results/${resultId}/narrative`);
      setNarrative(res.data);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={load}
        style={{
          fontSize: 12, color: '#2563eb', background: 'none',
          border: 'none', cursor: 'pointer', padding: '2px 0',
        }}
      >
        {loading
          ? 'Loading AI interpretation…'
          : open
            ? '▲ Hide AI Interpretation'
            : '▼ View AI Interpretation'}
      </button>

      {open && narrative && (
        <div style={{
          marginTop: 8, padding: 12, backgroundColor: '#f0f9ff',
          borderRadius: 8, borderLeft: '3px solid #2563eb', fontSize: 13,
        }}>
          {narrative.has_critical_value && (
            <div style={{
              marginBottom: 8, padding: '4px 10px',
              backgroundColor: '#fee2e2', color: '#dc2626',
              borderRadius: 6, fontWeight: 700, fontSize: 12,
            }}>
              CRITICAL VALUE — Immediate clinical attention required
            </div>
          )}
          <p style={{ margin: 0 }}>{narrative.clinician_narrative}</p>
        </div>
      )}

      {open && !narrative && (
        <AiStatusBadge status="unavailable" reason="Narrative not available" compact />
      )}
    </div>
  );
};
