import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Props { appointmentId: string; }

export const AppointmentBriefPanel: React.FC<Props> = ({ appointmentId }) => {
  const [brief, setBrief]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/appointments/${appointmentId}/brief`)
      .then((r) => setBrief(r.data))
      .catch(() => setBrief(null))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  if (loading) return <div style={{ color: '#6b7280', fontSize: 13 }}>Preparing AI brief...</div>;
  if (!brief)  return <div style={{ color: '#9ca3af', fontSize: 13 }}>Brief unavailable</div>;

  return (
    <div style={{
      backgroundColor: '#f0fdf4', border: '1px solid #86efac',
      borderRadius: 8, padding: 16, fontSize: 13,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#166534' }}>AI Pre-Appointment Brief</div>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, margin: 0 }}>
        {brief.brief_text}
      </pre>
    </div>
  );
};
