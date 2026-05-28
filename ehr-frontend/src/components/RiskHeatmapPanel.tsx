import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AiStatusBadge } from './AiStatusBadge';

interface RiskPatient {
  patient_id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  score: number;
  risk_level: string;
  ward?: string;
  bed_number?: string;
}

export const RiskHeatmapPanel: React.FC = () => {
  const [patients, setPatients] = useState<RiskPatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/risk/high-risk-patients?limit=20')
      .then((r) => setPatients((r.data as RiskPatient[]) ?? []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const levelColors: Record<string, string> = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#d97706',
    low: '#16a34a',
  };

  if (loading) return <div style={{ padding: 16, color: '#6b7280' }}>Loading risk data...</div>;

  if (patients.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <AiStatusBadge status="active" reason="No high-risk patients in the last 24 hours" />
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontWeight: 700, margin: 0 }}>High Risk Patients</h3>
        <AiStatusBadge status="active" compact />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Patient</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>MRN</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Ward/Bed</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Score</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Level</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.patient_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 12px' }}>{p.first_name} {p.last_name}</td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{p.mrn}</td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>
                {p.ward ?? '—'}{p.bed_number ? ` / ${p.bed_number}` : ''}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{p.score}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  backgroundColor: (levelColors[p.risk_level] ?? '#9ca3af') + '20',
                  color: levelColors[p.risk_level] ?? '#9ca3af',
                }}>
                  {p.risk_level.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
