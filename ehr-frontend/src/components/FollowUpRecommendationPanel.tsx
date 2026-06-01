import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Recommendation {
  id: number;
  recommendedDays: number;
  recommendedModality: string;
  urgency: string;
  reasoning: string;
  aiSource: string;
  acceptedAt?: string;
  dismissedAt?: string;
  appointmentBooked: boolean;
  appointmentDueBy?: string;
}

interface Props {
  patientId: number;
  encounterId?: number;
  encounterType: 'consultation' | 'telemedicine' | 'discharge';
  riskBand: 'low' | 'moderate' | 'high' | 'critical';
  diagnoses: string[];
  openCareGapsCount: number;
  medicationsChanged: boolean;
}

const URGENCY_COLOR: Record<string, string> = {
  urgent: '#dc2626',
  soon: '#d97706',
  routine: '#2563eb',
};

const MODALITY_LABEL: Record<string, string> = {
  in_person: 'In-Person',
  telemedicine: 'Telemedicine',
  phone: 'Phone',
};

export default function FollowUpRecommendationPanel({
  patientId, encounterId, encounterType, riskBand, diagnoses,
  openCareGapsCount, medicationsChanged,
}: Props) {
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrideDays, setOverrideDays] = useState('');
  const [overrideModality, setOverrideModality] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/followup/recommend', {
        patientId, encounterId, encounterType, riskBand,
        diagnoses, openCareGapsCount, medicationsChanged,
      });
      setRec(response.data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate recommendation');
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!rec) return;
    const override = (overrideDays || overrideModality)
      ? {
          overrideDays: overrideDays ? parseInt(overrideDays) : undefined,
          overrideModality: overrideModality || undefined,
        }
      : {};
    try {
      await api.patch(`/followup/${rec.id}/accept`, override);
      setRec(r => r ? { ...r, acceptedAt: new Date().toISOString() } : r);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to accept');
    }
  }

  async function dismiss() {
    if (!rec) return;
    try {
      await api.patch(`/followup/${rec.id}/dismiss`, {});
      setRec(r => r ? { ...r, dismissedAt: new Date().toISOString() } : r);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to dismiss');
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8, color: '#6b7280', fontSize: 14 }}>
        Generating follow-up recommendation…
      </div>
    );
  }

  if (!rec) return null;

  const urgencyColor = URGENCY_COLOR[rec.urgency] ?? '#2563eb';
  const accepted = !!rec.acceptedAt;
  const dismissed = !!rec.dismissedAt;

  return (
    <div style={{
      border: `2px solid ${urgencyColor}`, borderRadius: 10, padding: 16,
      background: dismissed ? '#f9fafb' : '#fff', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>AI Follow-up Recommendation</h4>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#fff',
          background: urgencyColor, padding: '2px 10px', borderRadius: 10,
          textTransform: 'uppercase' as const,
        }}>
          {rec.urgency}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Recommended in</span>
          <div style={{ fontSize: 22, fontWeight: 800, color: urgencyColor }}>{rec.recommendedDays}d</div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Modality</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
            {MODALITY_LABEL[rec.recommendedModality] ?? rec.recommendedModality}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>AI Source</span>
          <div style={{ fontSize: 13, color: '#374151' }}>
            {rec.aiSource === 'llm' ? 'AI-enriched' : 'Protocol rules'}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 12px', lineHeight: 1.5 }}>{rec.reasoning}</p>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      {!accepted && !dismissed && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="number"
              placeholder="Override days"
              value={overrideDays}
              onChange={e => setOverrideDays(e.target.value)}
              style={{
                width: 120, padding: '6px 10px', border: '1px solid #d1d5db',
                borderRadius: 6, fontSize: 13,
              }}
            />
            <select
              value={overrideModality}
              onChange={e => setOverrideModality(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            >
              <option value="">Original modality</option>
              <option value="in_person">In-Person</option>
              <option value="telemedicine">Telemedicine</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={accept}
              style={{
                flex: 1, padding: '9px 0', background: '#16a34a', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Accept & Schedule
            </button>
            <button
              onClick={dismiss}
              style={{
                padding: '9px 16px', background: '#f3f4f6',
                border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}

      {accepted && (
        <div style={{
          padding: '8px 12px', background: '#f0fdf4', borderRadius: 8,
          border: '1px solid #bbf7d0', fontSize: 13, color: '#16a34a', fontWeight: 600,
        }}>
          ✓ Accepted — follow-up scheduled
          {rec.appointmentDueBy && (
            <span style={{ fontWeight: 400, color: '#374151' }}>
              {' '}(due by {new Date(rec.appointmentDueBy).toLocaleDateString()})
            </span>
          )}
        </div>
      )}

      {dismissed && (
        <div style={{
          padding: '8px 12px', background: '#fef9c3', borderRadius: 8,
          border: '1px solid #fde68a', fontSize: 13, color: '#92400e',
        }}>
          Recommendation dismissed
        </div>
      )}
    </div>
  );
}
