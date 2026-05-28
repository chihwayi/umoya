import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Finding {
  description?: string;
  label?: string;
  confidence: number;
  region?: string;
}

interface AiFindingRecord {
  id: string;
  urgency: string;
  findings: Finding[];
  overall_confidence: number;
  radiologist_review_status: string;
  modality?: string;
}

interface Props {
  studyId: string;
  patientId: string;
}

const URGENCY_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f97316',
  MEDIUM: '#d97706',
  LOW: '#2563eb',
  ROUTINE: '#16a34a',
};

export const RadiologyAiFindingsPanel: React.FC<Props> = ({ studyId, patientId }) => {
  const [data, setData] = useState<AiFindingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState('pending');

  useEffect(() => {
    loadFindings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  const loadFindings = async () => {
    setLoading(true);
    try {
      let res = await api.get(`/radiology/studies/${studyId}/ai-findings`);
      if (!res.data) {
        res = await api.post(`/radiology/studies/${studyId}/analyse`, { patientId });
      }
      setData(res.data);
      setReviewStatus(res.data?.radiologist_review_status ?? 'pending');
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (status: 'confirmed' | 'rejected' | 'needs_review') => {
    if (!data) return;
    await api.patch(`/radiology/ai-findings/${data.id}/review`, { status });
    setReviewStatus(status);
  };

  if (loading) {
    return (
      <div style={{ padding: 16, color: '#6b7280', fontSize: 13 }}>
        Analysing imaging study...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8,
        color: '#6b7280', fontSize: 13, textAlign: 'center',
      }}>
        AI Unavailable
      </div>
    );
  }

  const findings: Finding[] = Array.isArray(data.findings) ? data.findings : [];
  const urgencyColor = URGENCY_COLOR[data.urgency] ?? '#9ca3af';

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>AI Radiology Findings</span>
        <span style={{
          fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 12,
          backgroundColor: urgencyColor + '20',
          color: urgencyColor,
        }}>
          {data.urgency}
        </span>
      </div>

      {data.overall_confidence > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Overall Confidence: {Math.round(data.overall_confidence * 100)}%
          </span>
          <div style={{ marginTop: 4, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3 }}>
            <div style={{
              height: 6, borderRadius: 3,
              width: `${Math.round(data.overall_confidence * 100)}%`,
              backgroundColor: data.overall_confidence > 0.8 ? '#16a34a' : '#f97316',
            }} />
          </div>
        </div>
      )}

      {findings.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No significant findings detected.</p>
      ) : (
        <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
          {findings.map((f, i) => (
            <li key={i} style={{ marginBottom: 8, fontSize: 13 }}>
              <span>{f.description ?? f.label}</span>
              {f.region && (
                <span style={{ color: '#9ca3af', marginLeft: 6 }}>({f.region})</span>
              )}
              {f.confidence > 0 && (
                <span style={{ marginLeft: 8, color: '#2563eb', fontWeight: 600 }}>
                  {Math.round(f.confidence * 100)}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
        <span style={{ fontSize: 12, color: '#6b7280', marginRight: 8 }}>
          Radiologist Review:
        </span>
        {reviewStatus !== 'pending' ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
            {reviewStatus.toUpperCase()}
          </span>
        ) : (
          <span>
            {(['confirmed', 'rejected', 'needs_review'] as const).map((s) => (
              <button
                key={s}
                onClick={() => submitReview(s)}
                style={{
                  marginRight: 6, padding: '3px 10px', fontSize: 12,
                  borderRadius: 6, border: '1px solid #d1d5db',
                  cursor: 'pointer', backgroundColor: 'white',
                }}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
};
