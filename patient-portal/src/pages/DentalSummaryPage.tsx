import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';

const STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  planned:     { label: 'Planned',     bg: '#ebf8ff', color: '#2b6cb0' },
  in_progress: { label: 'In Progress', bg: '#fffbeb', color: '#b7791f' },
  completed:   { label: 'Completed',   bg: '#f0fff4', color: '#276749' },
};

const DentalSummaryPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    patientPortalApi.getDentalTreatmentPlan(token!, tenantSlug).then(setData);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  const { plans, summary } = data;

  if (!plans.length) return (
    <div style={{ padding: 24 }}>
      <h1>{t('dental.title')}</h1>
      <p style={{ color: '#718096' }}>{t('dental.noTreatmentPlan')}</p>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('dental.title')}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: t('dental.totalProcedures'), value: summary.totalProcedures },
          { label: t('dental.completed'),       value: summary.completedProcedures },
          { label: t('dental.pending'),         value: summary.pendingProcedures },
          { label: t('dental.outstandingCost'), value: `$${summary.outstandingCostUsd}` },
        ].map(card => (
          <div key={card.label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#718096' }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              {[t('dental.procedure'), t('dental.tooth'), t('dental.plannedDate'), t('dental.cost'), t('dental.status')].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((p: any) => {
              const pill = STATUS_PILL[p.status] ?? STATUS_PILL.planned;
              return (
                <tr key={p.id} style={{ opacity: p.status === 'completed' ? 0.65 : 1 }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>{p.procedure_description}</p>
                    {p.notes && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#718096' }}>{p.notes}</p>}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>{p.tooth_number ?? '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>{p.planned_date ?? '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>{p.cost_usd ? `$${p.cost_usd}` : '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ background: pill.bg, color: pill.color, borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 500 }}>
                      {pill.label}
                    </span>
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

export default DentalSummaryPage;
