import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  severe_underweight: { label: 'Severe Underweight', color: '#c53030' },
  underweight:        { label: 'Underweight',        color: '#dd6b20' },
  normal:             { label: 'Normal',             color: '#276749' },
  overweight:         { label: 'Overweight',         color: '#b7791f' },
  severely_stunted:   { label: 'Severely Stunted',   color: '#c53030' },
  stunted:            { label: 'Stunted',            color: '#dd6b20' },
  unknown:            { label: 'Not assessed',       color: '#a0aec0' },
};

const GrowthChartPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    patientPortalApi.getGrowthHistory(token!, tenantSlug).then(setData);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  const { measurements, latestStatus } = data;

  const chartData = measurements.map((m: any) => ({
    date: m.measurement_date,
    weight: m.weight_kg,
    height: m.height_cm,
    waz: m.waz,
    haz: m.haz,
  }));

  const latestWaz = latestStatus?.wazCategory;
  const wazBadge = CATEGORY_BADGE[latestWaz ?? 'unknown'];

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('growth.title')}</h1>

      {latestStatus && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ border: `2px solid ${wazBadge.color}`, borderRadius: 8, padding: '10px 16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#718096' }}>{t('growth.weightStatus')}</p>
            <span style={{ color: wazBadge.color, fontWeight: 600 }}>{wazBadge.label}</span>
          </div>
          {latestStatus.nutritionReferralNeeded && (
            <div style={{ background: '#fff5f5', border: '1px solid #fc8181', borderRadius: 8, padding: '10px 16px' }}>
              <p style={{ margin: 0, color: '#c53030', fontWeight: 600 }}>⚠ {t('growth.nutritionReferral')}</p>
            </div>
          )}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#718096' }}>{t('growth.lastMeasured')}</p>
            <p style={{ margin: 0, fontWeight: 500 }}>{latestStatus.measuredOn}</p>
          </div>
        </div>
      )}

      {chartData.length > 1 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>{t('growth.wazChart')}</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[-4, 4]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={0}  stroke="#48bb78" strokeDasharray="4 4" label={{ value: 'Median', fontSize: 10 }} />
              <ReferenceLine y={-2} stroke="#f6ad55" strokeDasharray="4 4" label={{ value: '-2 SD', fontSize: 10 }} />
              <ReferenceLine y={-3} stroke="#fc8181" strokeDasharray="4 4" label={{ value: '-3 SD', fontSize: 10 }} />
              <Line type="monotone" dataKey="waz" stroke="#3182ce" strokeWidth={2} dot={{ r: 4 }} name="Weight-for-Age Z" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{t('growth.history')}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              {[t('growth.date'), t('growth.age'), t('growth.weight'), t('growth.height'), 'WAZ', 'HAZ', t('growth.status')].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...measurements].reverse().map((m: any) => {
              const badge = CATEGORY_BADGE[m.waz_category ?? 'unknown'];
              return (
                <tr key={m.id}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.measurement_date}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.age_months} mo</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.weight_kg ?? '—'} kg</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.height_cm ?? '—'} cm</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.waz ?? '—'}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{m.haz ?? '—'}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: badge.color, fontSize: 12, fontWeight: 500 }}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GrowthChartPage;
