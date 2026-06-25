import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer
} from 'recharts';
import { api } from '../services/api';

interface UpcomingSession {
  id: string;
  first_name: string;
  last_name: string;
  procedure_type: string;
  next_session_due: string;
}

interface SkinAnalysis {
  hydration_score: number;
  sebum_score: number;
  pigmentation_score: number;
  pore_score: number;
  wrinkle_score: number;
  assessed_at: string;
  skin_age_estimate: number;
}

const PROCEDURE_COLOURS: Record<string, string> = {
  botulinum_toxin:   '#3b82f6',
  dermal_filler:     '#0aa98a',
  prp:               '#f59e0b',
  laser_rejuvenation:'#ef4444',
  chemical_peel:     '#f59e0b',
  hbot_wellness:     '#0aa98a',
  laser_hair_removal:'#8b5cf6',
  microneedling:     '#10b981',
  body_contouring:   '#ec4899',
  carboxy_therapy:   '#6366f1',
  iv_vitamin_therapy:'#14b8a6',
  other:             '#6b7280',
};

const daysUntil = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
};

const fmt = (str: string) => str?.replace(/_/g, ' ');

export default function AestheticsDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [upcoming, setUpcoming]   = useState<UpcomingSession[]>([]);
  const [skinDemo, setSkinDemo]   = useState<SkinAnalysis | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/aesthetics/upcoming-sessions`).catch(() => ({ data: [] })),
    ]).then(([upRes]) => {
      setUpcoming(upRes.data ?? []);
    }).finally(() => setLoading(false));
    // Demo skin data until a real patient is selected
    setSkinDemo({
      hydration_score: 62, sebum_score: 45, pigmentation_score: 38,
      pore_score: 55, wrinkle_score: 40, assessed_at: new Date().toISOString().slice(0,10),
      skin_age_estimate: 34,
    });
  }, [tenantSlug]);

  const radarData = skinDemo ? [
    { axis: 'Hydration', value: skinDemo.hydration_score },
    { axis: 'Sebum',     value: skinDemo.sebum_score },
    { axis: 'Pigment',   value: skinDemo.pigmentation_score },
    { axis: 'Pores',     value: skinDemo.pore_score },
    { axis: 'Wrinkles',  value: skinDemo.wrinkle_score },
  ] : [];

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', background: '#0f1117', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#f8fafc' }}>Aesthetics & Wellness</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Treatment register · PRP · Skin analysis · HBOT wellness linkage</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Skin Analysis Radar */}
        <div style={card}>
          <h3 style={cardTitle}>Skin Analysis — Radar</h3>
          {skinDemo && (
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
              Skin age estimate: <strong style={{ color: '#0aa98a' }}>{skinDemo.skin_age_estimate} yrs</strong> · assessed {skinDemo.assessed_at}
            </p>
          )}
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} outerRadius={90}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Radar
                name="Skin"
                dataKey="value"
                stroke="#0aa98a"
                fill="rgba(10,169,138,0.3)"
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Sessions */}
        <div style={card}>
          <h3 style={cardTitle}>Upcoming Sessions — Next 14 Days</h3>
          {loading && <p style={{ color: '#64748b', fontSize: '13px' }}>Loading…</p>}
          {!loading && upcoming.length === 0 && (
            <p style={{ color: '#64748b', fontSize: '13px' }}>No sessions due in the next 14 days.</p>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <tbody>
              {upcoming.map(s => {
                const days = daysUntil(s.next_session_due);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '8px 0', color: '#f8fafc' }}>
                      {s.first_name} {s.last_name}
                    </td>
                    <td style={{ padding: '8px 0', color: PROCEDURE_COLOURS[s.procedure_type] ?? '#94a3b8', textTransform: 'capitalize' }}>
                      {fmt(s.procedure_type)}
                    </td>
                    <td style={{ padding: '8px 0', color: days <= 2 ? '#ef4444' : days <= 5 ? '#f59e0b' : '#94a3b8', textAlign: 'right' }}>
                      {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Procedure Type Legend */}
      <div style={card}>
        <h3 style={cardTitle}>Procedure Palette</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {Object.entries(PROCEDURE_COLOURS).map(([type, colour]) => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', background: '#1e293b', borderRadius: '6px', padding: '4px 10px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colour, display: 'inline-block' }} />
              {fmt(type)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#1a1f2e',
  borderRadius: '12px',
  padding: '20px',
  border: '1px solid #1e293b',
};

const cardTitle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: '15px',
  fontWeight: 600,
  color: '#f8fafc',
};
