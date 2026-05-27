import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';

const NUDGE_TYPE_LABELS: Record<string, string> = {
  daily_reminder: 'Daily medication reminder',
  appointment_reminder: 'Appointment reminders',
  refill_reminder: 'Medication refill reminders',
};

const CommunicationPreferencesPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [prefs, setPrefs] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [optingOut, setOptingOut] = useState(false);
  const [nudgeChanges, setNudgeChanges] = useState<Record<string, boolean>>({});

  const loadPrefs = () =>
    patientPortalApi.getCommunicationPreferences(token!, tenantSlug).then(setPrefs);

  useEffect(() => { loadPrefs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleNudge = (id: string, current: boolean) => {
    setNudgeChanges(prev => ({ ...prev, [id]: !current }));
  };

  const save = async () => {
    setSaving(true);
    const nudgeUpdates = Object.entries(nudgeChanges).map(([id, isActive]) => ({ id, isActive }));
    await patientPortalApi.updateCommunicationPreferences({ nudgeUpdates }, token!, tenantSlug);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
    setNudgeChanges({});
    loadPrefs();
  };

  const handleOptOut = async () => {
    if (!window.confirm(t('comms.optOutConfirm'))) return;
    setOptingOut(true);
    await patientPortalApi.updateCommunicationPreferences({ smsOptOut: true, optOutReason: 'Patient request via portal' }, token!, tenantSlug);
    loadPrefs();
    setOptingOut(false);
  };

  const handleOptIn = async () => {
    await patientPortalApi.updateCommunicationPreferences({ smsOptOut: false }, token!, tenantSlug);
    loadPrefs();
  };

  if (!prefs) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>{t('comms.title')}</h1>

      {prefs.smsOptedOut ? (
        <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ margin: '0 0 8px', color: '#c53030', fontWeight: 600 }}>{t('comms.optedOutBanner')}</p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#718096' }}>
            {t('comms.optedOutOn', { date: prefs.optedOutAt?.slice(0, 10) })}
          </p>
          <button onClick={handleOptIn} style={{ padding: '8px 16px', background: '#276749', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {t('comms.optBackIn')}
          </button>
        </div>
      ) : (
        <>
          {prefs.phoneNumber && (
            <p style={{ color: '#4a5568', marginBottom: 20 }}>
              {t('comms.sendingTo')}: <strong>{prefs.phoneNumber}</strong>
            </p>
          )}

          <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t('comms.nudgeSettings')}</h2>
          {(prefs.nudges ?? []).map((nudge: any) => {
            const isActive = nudge.id in nudgeChanges ? nudgeChanges[nudge.id] : nudge.is_active;
            return (
              <div key={nudge.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 500 }}>{NUDGE_TYPE_LABELS[nudge.nudge_type] ?? nudge.nudge_type}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#718096' }}>
                    {nudge.frequency} · {nudge.preferred_time}
                  </p>
                </div>
                <button
                  onClick={() => toggleNudge(nudge.id, nudge.is_active)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: isActive ? '#48bb78' : '#cbd5e0', position: 'relative', transition: 'background 0.2s',
                  }}
                  aria-label={isActive ? 'Disable' : 'Enable'}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: isActive ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            );
          })}

          {Object.keys(nudgeChanges).length > 0 && (
            <button onClick={save} disabled={saving} style={{ marginTop: 16, padding: '10px 20px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              {saving ? t('common.loading') : saved ? t('profile.saved') : t('common.confirm')}
            </button>
          )}

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: 16, color: '#c53030', marginBottom: 8 }}>{t('comms.stopAllSms')}</h2>
            <p style={{ fontSize: 13, color: '#718096', marginBottom: 12 }}>{t('comms.optOutDescription')}</p>
            <button onClick={handleOptOut} disabled={optingOut} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #fc8181', color: '#c53030', borderRadius: 6, cursor: 'pointer' }}>
              {t('comms.optOutButton')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CommunicationPreferencesPage;
