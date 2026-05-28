import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Props {
  patientId: string;
}

export const PatientAiSummaryBar: React.FC<Props> = ({ patientId }) => {
  const [timeline, setTimeline] = useState<any>(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    api.get(`/patients/${patientId}/ai-timeline`)
      .then((r) => setTimeline(r.data))
      .catch(() => null);
  }, [patientId]);

  if (!timeline) return null;

  const patterns: any[] = Array.isArray(timeline.detected_patterns) ? timeline.detected_patterns : [];

  return (
    <div style={{
      backgroundColor: '#f0fdf4',
      border: '1px solid #86efac',
      borderRadius: 8,
      padding: '10px 16px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#166534' }}>
          🤖 {timeline.one_line_summary}
        </span>
        <button
          onClick={() => setShowFull(!showFull)}
          style={{ fontSize: 12, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {showFull ? 'Hide Timeline' : 'View Full Timeline'}
        </button>
      </div>

      {showFull && (
        <div style={{ marginTop: 12 }}>
          {patterns.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                Detected Patterns
              </div>
              {patterns.map((p: any, i: number) => (
                <div key={i} style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  marginBottom: 4,
                  backgroundColor: p.severity === 'high' ? '#fee2e2' : p.severity === 'medium' ? '#fff7ed' : '#f9fafb',
                  borderLeft: `3px solid ${p.severity === 'high' ? '#dc2626' : p.severity === 'medium' ? '#f97316' : '#9ca3af'}`,
                  fontSize: 12,
                }}>
                  {p.description}
                </div>
              ))}
            </div>
          )}
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontSize: 12,
            fontFamily: 'monospace',
            backgroundColor: 'white',
            padding: 12,
            borderRadius: 6,
            border: '1px solid #e5e7eb',
          }}>
            {timeline.full_narrative}
          </pre>
        </div>
      )}
    </div>
  );
};
