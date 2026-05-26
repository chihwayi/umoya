import React, { useEffect, useState } from 'react';

interface AncReg {
  id: string;
  lmp_date: string;
  edd: string;
  gravida: number;
  para: number;
  hiv_status: string;
  current_regimen: string;
  vl_at_36_weeks?: number;
  maternal_transmission_risk?: string;
  visits: PmtctVisit[];
}

interface PmtctVisit {
  id: string;
  visit_date: string;
  gestational_age_weeks: number;
  viral_load?: number;
  cd4_count?: number;
  adherence_score?: number;
}

interface EidSchedule {
  id: string;
  infant_name: string;
  birth_date: string;
  test_6w_due: string;
  test_6w_result?: string;
  test_4m_due: string;
  test_4m_result?: string;
  test_12m_due: string;
  test_12m_result?: string;
  test_18m_due: string;
  test_18m_result?: string;
  transmission_occurred?: boolean;
}

interface AncDashboardPageProps {
  patientId: string;
  token: string;
  tenantSlug: string;
}

const API = (slug: string) => `${process.env.REACT_APP_EHR_API_URL ?? 'http://localhost:3001'}`;

const resultBadge = (result?: string, due?: string): React.ReactNode => {
  if (result === 'positive') return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>POSITIVE</span>;
  if (result === 'negative') return <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>NEG</span>;
  if (result === 'indeterminate') return <span style={{ background: '#fef9c3', color: '#713f12', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>INDET</span>;
  if (due && new Date(due) < new Date()) return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>OVERDUE</span>;
  return <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>Pending</span>;
};

export const AncDashboardPage: React.FC<AncDashboardPageProps> = ({ patientId, token, tenantSlug }) => {
  const [activeTab, setActiveTab] = useState<'registration' | 'visits' | 'eid' | 'overdue'>('registration');
  const [ancData, setAncData] = useState<AncReg | null>(null);
  const [overdueEid, setOverdueEid] = useState<EidSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  // Registration form state
  const [form, setForm] = useState({ lmpDate: '', gravida: 1, para: 0, artStartDate: '', currentRegimen: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-tenant-slug': tenantSlug };
  const base = API(tenantSlug);

  useEffect(() => {
    fetchAnc();
    if (activeTab === 'overdue') fetchOverdueEid();
  }, [activeTab]);

  const fetchAnc = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}/clinical/anc/patients/${patientId}`, { headers });
      if (res.ok) setAncData(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const fetchOverdueEid = async () => {
    try {
      const res = await fetch(`${base}/clinical/anc/eid-schedules/overdue`, { headers });
      if (res.ok) setOverdueEid(await res.json());
    } catch { /* ignore */ }
  };

  const handleRegister = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${base}/clinical/anc/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ patientId, lmpDate: form.lmpDate, gravida: form.gravida, para: form.para, artStartDate: form.artStartDate || undefined, currentRegimen: form.currentRegimen || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaveMsg(`Registered. EDD: ${data.edd}`);
        await fetchAnc();
      } else {
        setSaveMsg('Save failed');
      }
    } catch { setSaveMsg('Error saving'); } finally { setSaving(false); }
  };

  const tabs = [
    { key: 'registration', label: 'Registration' },
    { key: 'visits', label: 'PMTCT Visits' },
    { key: 'eid', label: 'EID Tracker' },
    { key: 'overdue', label: 'Overdue EID' },
  ] as const;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>ANC / PMTCT Dashboard</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #1d4ed8' : '2px solid transparent',
              color: activeTab === tab.key ? '#1d4ed8' : '#6b7280',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'registration' && (
        <div style={{ maxWidth: 480 }}>
          {ancData && (
            <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <strong>Current registration:</strong> LMP {ancData.lmp_date} | EDD {ancData.edd} | G{ancData.gravida}P{ancData.para}
              {ancData.vl_at_36_weeks && (
                <span style={{ color: ancData.maternal_transmission_risk === 'high' ? '#ef4444' : '#374151', fontWeight: 600, marginLeft: 8 }}>
                  VL@36w: {ancData.vl_at_36_weeks} {ancData.maternal_transmission_risk === 'high' ? '⚠ HIGH MTR' : ''}
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              LMP Date
              <input type="date" value={form.lmpDate} onChange={(e) => setForm((f) => ({ ...f, lmpDate: e.target.value }))} style={{ display: 'block', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%' }} />
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
                Gravida
                <input type="number" min={1} value={form.gravida} onChange={(e) => setForm((f) => ({ ...f, gravida: parseInt(e.target.value) || 1 }))} style={{ display: 'block', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%' }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
                Para
                <input type="number" min={0} value={form.para} onChange={(e) => setForm((f) => ({ ...f, para: parseInt(e.target.value) || 0 }))} style={{ display: 'block', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%' }} />
              </label>
            </div>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              ART Start Date
              <input type="date" value={form.artStartDate} onChange={(e) => setForm((f) => ({ ...f, artStartDate: e.target.value }))} style={{ display: 'block', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%' }} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Current Regimen
              <input value={form.currentRegimen} onChange={(e) => setForm((f) => ({ ...f, currentRegimen: e.target.value }))} placeholder="e.g. TDF/3TC/DTG" style={{ display: 'block', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%' }} />
            </label>
            <button onClick={handleRegister} disabled={!form.lmpDate || saving} style={{ padding: '8px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', width: 'fit-content' }}>
              {saving ? 'Saving...' : ancData ? 'Update Registration' : 'Register ANC'}
            </button>
            {saveMsg && <p style={{ fontSize: 13, color: saveMsg.includes('EDD') ? '#166534' : '#dc2626' }}>{saveMsg}</p>}
          </div>
        </div>
      )}

      {activeTab === 'visits' && (
        <div>
          {loading ? <p>Loading...</p> : !ancData?.visits?.length ? (
            <p style={{ color: '#9ca3af' }}>No PMTCT visits recorded.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>GA (weeks)</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>VL</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>CD4</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Adherence</th>
                </tr>
              </thead>
              <tbody>
                {(ancData?.visits ?? []).map((v) => (
                  <tr key={v.id}>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{v.visit_date}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{v.gestational_age_weeks}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center', color: v.viral_load && v.viral_load > 1000 && v.gestational_age_weeks >= 36 ? '#ef4444' : undefined, fontWeight: v.viral_load && v.viral_load > 1000 && v.gestational_age_weeks >= 36 ? 700 : undefined }}>
                      {v.viral_load ?? '—'}
                      {v.viral_load && v.viral_load > 1000 && v.gestational_age_weeks >= 36 && ' ⚠'}
                    </td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{v.cd4_count ?? '—'}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{v.adherence_score != null ? `${v.adherence_score}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'eid' && (
        <div>
          <p style={{ color: '#6b7280', fontSize: 13 }}>EID schedule for infant(s) of this mother.</p>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Use the EID registration form to add an infant.</p>
        </div>
      )}

      {activeTab === 'overdue' && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Clinic-wide Overdue EID Tests</h3>
          {overdueEid.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>No overdue EID tests.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'left' }}>Infant</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Birth Date</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>6w</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>4m</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>12m</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>18m</th>
                </tr>
              </thead>
              <tbody>
                {overdueEid.map((e) => (
                  <tr key={e.id}>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{e.infant_name}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{e.birth_date}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{resultBadge(e.test_6w_result, e.test_6w_due)}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{resultBadge(e.test_4m_result, e.test_4m_due)}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{resultBadge(e.test_12m_result, e.test_12m_due)}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{resultBadge(e.test_18m_result, e.test_18m_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
