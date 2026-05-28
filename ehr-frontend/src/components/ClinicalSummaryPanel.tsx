import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AiStatusBadge } from './AiStatusBadge';

interface Props { patientId: string; }

export const ClinicalSummaryPanel: React.FC<Props> = ({ patientId }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    api.get(`/patients/${patientId}/clinical-summary`)
      .then((r) => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  const sendFeedback = async (positive: boolean) => {
    await api.post(`/patients/${patientId}/clinical-summary/feedback`, { positive });
    setFeedback(positive ? 'up' : 'down');
  };

  const doRegenerate = () => {
    setLoading(true);
    api.post(`/patients/${patientId}/clinical-summary/regenerate`)
      .then((r) => setSummary(r.data))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 12 }}>
        <AiStatusBadge status="loading" compact />
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 12 }}>
        <AiStatusBadge status="unavailable" reason="Summary generation failed" />
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#f0fdf4', border: '1px solid #86efac',
      borderRadius: 8, padding: 14, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AiStatusBadge status="active" compact />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>AI Clinical Summary</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => sendFeedback(true)}
            title="This summary is helpful"
            style={{
              padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 6,
              backgroundColor: feedback === 'up' ? '#dcfce7' : 'white',
              cursor: 'pointer', fontSize: 14,
            }}
          >👍</button>
          <button
            onClick={() => sendFeedback(false)}
            title="This summary needs improvement"
            style={{
              padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 6,
              backgroundColor: feedback === 'down' ? '#fee2e2' : 'white',
              cursor: 'pointer', fontSize: 14,
            }}
          >👎</button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#166534', margin: 0, lineHeight: 1.6 }}>
        {summary.summary_text}
      </p>
      <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
        Generated {new Date(summary.generated_at).toLocaleString()}
        <button
          onClick={doRegenerate}
          style={{ marginLeft: 8, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
};
