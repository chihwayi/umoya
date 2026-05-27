import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';

interface Group {
  id: string;
  name: string;
  group_type: string;
  meeting_schedule: string;
  facilitator_name: string;
  location: string;
  next_session: { session_date: string; start_time: string; topic: string; location: string } | null;
  sessions_attended: number;
}

const SupportGroupsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    patientPortalApi.getPatientSupportGroups(token!, tenantSlug)
      .then(d => { setGroups(d.groups ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = async (groupId: string) => {
    if (selectedGroup === groupId) { setSelectedGroup(null); return; }
    setSelectedGroup(groupId);
    const data = await patientPortalApi.getSupportGroupSessions(groupId, token!, tenantSlug);
    setSessions(Array.isArray(data.sessions) ? data.sessions : []);
  };

  if (loading) return <p style={{ padding: 24 }}>{t('common.loading')}</p>;

  if (!groups.length) return (
    <div style={{ padding: 24 }}>
      <h1>{t('supportGroups.title')}</h1>
      <p style={{ color: '#718096' }}>{t('supportGroups.notEnrolled')}</p>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('supportGroups.title')}</h1>

      {groups.map(group => (
        <div key={group.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{group.name}</h2>
              <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>{group.group_type} · {group.meeting_schedule}</p>
              <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                <strong>{t('supportGroups.facilitator')}:</strong> {group.facilitator_name}
              </p>
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                <strong>{t('supportGroups.location')}:</strong> {group.location}
              </p>
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                <strong>{t('supportGroups.sessionsAttended')}:</strong> {group.sessions_attended}
              </p>
            </div>
            {group.next_session && (
              <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: 12, minWidth: 180, textAlign: 'right' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#276749', fontWeight: 600 }}>
                  {t('supportGroups.nextSession')}
                </p>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600 }}>{group.next_session.session_date}</p>
                <p style={{ margin: '0 0 2px', fontSize: 13 }}>{group.next_session.start_time}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#4a5568' }}>{group.next_session.topic}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => loadSessions(group.id)}
            style={{ marginTop: 12, padding: '6px 14px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            {selectedGroup === group.id ? t('supportGroups.hideSessions') : t('supportGroups.viewSessions')}
          </button>

          {selectedGroup === group.id && (
            <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f7fafc' }}>
                  {[t('supportGroups.date'), t('supportGroups.topic'), t('supportGroups.attended')].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>{s.session_date}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>{s.topic}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ color: s.attended ? '#276749' : '#c53030' }}>{s.attended ? '✓' : '–'}</span>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: '8px 10px', color: '#a0aec0' }}>No sessions recorded.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
};

export default SupportGroupsPage;
