import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  done:          { bg: '#f0fff4', color: '#276749', label: 'Done' },
  due_soon:      { bg: '#fffbeb', color: '#b7791f', label: 'Due Soon' },
  overdue:       { bg: '#fff5f5', color: '#c53030', label: 'Overdue' },
  upcoming:      { bg: '#ebf8ff', color: '#2b6cb0', label: 'Upcoming' },
  not_scheduled: { bg: '#f7fafc', color: '#a0aec0', label: 'Not scheduled' },
};

const AncEidTrackerPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [anc, setAnc] = useState<any>(null);
  const [eid, setEid] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      patientPortalApi.getAncRegistration(token!, tenantSlug),
      patientPortalApi.getEidSchedule(token!, tenantSlug),
    ])
      .then(([ancData, eidData]) => {
        setAnc(ancData);
        setEid(Array.isArray(eidData) ? eidData : []);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  if (!anc?.registered) return (
    <div style={{ padding: 24 }}>
      <h1>{t('anc.title')}</h1>
      <p style={{ color: '#718096' }}>{t('anc.notRegistered')}</p>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('anc.title')}</h1>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t('anc.pregnancyDetails')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 14 }}>
          <p style={{ margin: 0 }}><strong>{t('anc.lmp')}:</strong> {anc.anc.lmp_date}</p>
          <p style={{ margin: 0 }}><strong>{t('anc.edd')}:</strong> {anc.anc.edd}</p>
          <p style={{ margin: 0 }}><strong>{t('anc.currentRegimen')}:</strong> {anc.anc.current_regimen ?? t('anc.notRecorded')}</p>
          {anc.anc.maternal_transmission_risk === 'high' && (
            <p style={{ margin: 0, color: '#c53030', fontWeight: 600 }}>⚠ {t('anc.highMtr')}</p>
          )}
        </div>
      </div>

      {eid.map((infant: any) => (
        <div key={infant.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{infant.infant_name}</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#718096' }}>
            {t('anc.bornOn')} {infant.birth_date} · NVP {infant.nvp_duration_weeks} {t('anc.weeks')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {infant.timepoints.map((tp: any) => {
              const style = STATUS_STYLES[tp.status] ?? STATUS_STYLES.upcoming;
              return (
                <div key={tp.label} style={{ background: style.bg, border: `1px solid ${style.color}30`, borderRadius: 8, padding: 12 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13 }}>{tp.label}</p>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: '#4a5568' }}>{t('anc.due')}: {tp.due ?? '—'}</p>
                  <span style={{ background: style.color, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>
                    {style.label}
                  </span>
                  {tp.result && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: tp.result === 'positive' ? '#c53030' : '#276749' }}>
                      {tp.result.toUpperCase()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {infant.final_hiv_status && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: infant.transmission_occurred ? '#fff5f5' : '#f0fff4', borderRadius: 6, fontSize: 14 }}>
              <strong>{t('anc.finalStatus')}:</strong>{' '}
              <span style={{ color: infant.transmission_occurred ? '#c53030' : '#276749', fontWeight: 600 }}>
                {infant.final_hiv_status.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AncEidTrackerPage;
