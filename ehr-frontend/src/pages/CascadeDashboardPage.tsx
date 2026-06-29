import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CascadeFunnel, FunnelStep } from '../components/analytics/CascadeFunnel';
import { ehrAxios } from '../services/api';

type CascadeTab = 'hiv' | 'pmtct' | 'tb-hiv' | 'ncd-htn' | 'ncd-dm' | 'ncd-ckd';

const TAB_LABELS: Record<CascadeTab, string> = {
  'hiv':     'HIV 95-95-95',
  'pmtct':   'PMTCT',
  'tb-hiv':  'TB-HIV',
  'ncd-htn': 'NCD: HTN',
  'ncd-dm':  'NCD: Diabetes',
  'ncd-ckd': 'NCD: CKD',
};

interface GapPatient {
  patient_id: string;
  name: string;
  phone_number?: string;
  last_seen?: string;
  days_overdue?: number;
}

const UMOYA_DARK = {
  bg: '#0d1117',
  surface: '#151929',
  border: '#2a3146',
  text: '#e0e6f0',
  muted: '#6b7a99',
  teal: '#0AA98A',
  amber: '#F0954A',
  coral: '#E8614D',
};

function StatCard({ label, value, colour }: { label: string; value: string | number; colour?: string }) {
  return (
    <div style={{
      background: UMOYA_DARK.surface,
      border: `1px solid ${UMOYA_DARK.border}`,
      borderRadius: 8,
      padding: '16px 20px',
      textAlign: 'center',
      minWidth: 140,
    }}>
      <div style={{ color: colour ?? UMOYA_DARK.teal, fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ color: UMOYA_DARK.muted, fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function NinetyBadge({ label, value }: { label: string; value: number }) {
  const colour = value >= 90 ? UMOYA_DARK.teal : value >= 75 ? UMOYA_DARK.amber : UMOYA_DARK.coral;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 28,
        fontWeight: 800,
        color: colour,
        fontVariantNumeric: 'tabular-nums',
      }}>{value.toFixed(1)}%</div>
      <div style={{ color: UMOYA_DARK.muted, fontSize: 12, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export const CascadeDashboardPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('token') ?? '';
  const slug = tenantSlug ?? '';

  const [activeTab, setActiveTab] = useState<CascadeTab>('hiv');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [data, setData] = useState<Record<CascadeTab, any>>({} as any);
  const [loading, setLoading] = useState(false);
  const [gapPatients, setGapPatients] = useState<GapPatient[]>([]);
  const [gapModal, setGapModal] = useState<string | null>(null);
  const [gapLoading, setGapLoading] = useState(false);

  const headers = { 'X-Tenant-ID': slug, Authorization: `Bearer ${token}` };

  const load = useCallback(async (tab: CascadeTab) => {
    setLoading(true);
    try {
      const params = { startDate, endDate };
      let url = '';
      if (tab === 'hiv') url = `/tenants/${slug}/cascades/hiv`;
      else if (tab === 'pmtct') url = `/tenants/${slug}/cascades/pmtct`;
      else if (tab === 'tb-hiv') url = `/tenants/${slug}/cascades/tb-hiv`;
      else if (tab === 'ncd-htn') url = `/tenants/${slug}/cascades/ncd`;
      else if (tab === 'ncd-dm') url = `/tenants/${slug}/cascades/ncd`;
      else if (tab === 'ncd-ckd') url = `/tenants/${slug}/cascades/ncd`;

      const ncdCondition = tab === 'ncd-htn' ? 'hypertension' : tab === 'ncd-dm' ? 'diabetes' : 'ckd';
      const { data: result } = await ehrAxios.get(url, {
        headers,
        params: tab.startsWith('ncd') ? { ...params, condition: ncdCondition } : params,
      });
      setData((prev) => ({ ...prev, [tab]: result }));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug, token, startDate, endDate]);

  useEffect(() => {
    load(activeTab);
  }, [activeTab]);

  async function loadGap(url: string, label: string) {
    setGapModal(label);
    setGapLoading(true);
    setGapPatients([]);
    try {
      const { data } = await ehrAxios.get(url, { headers });
      setGapPatients(data ?? []);
    } catch {
      setGapPatients([]);
    } finally {
      setGapLoading(false);
    }
  }

  function downloadCsv(patients: GapPatient[], filename: string) {
    const header = 'Name,Phone,Last Seen,Days Overdue\n';
    const rows = patients.map((p) =>
      `"${p.name ?? ''}","${p.phone_number ?? ''}","${p.last_seen ?? ''}","${p.days_overdue ?? ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  const d = data[activeTab];

  return (
    <div style={{
      minHeight: '100vh',
      background: UMOYA_DARK.bg,
      color: UMOYA_DARK.text,
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px 32px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: UMOYA_DARK.text, margin: 0 }}>
          Programme Cascade Analytics
        </h1>
        <p style={{ color: UMOYA_DARK.muted, fontSize: 13, margin: '4px 0 0' }}>
          End-to-end clinical programme funnels — identify where patients are lost and take action
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ color: UMOYA_DARK.muted, fontSize: 12 }}>From:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            style={{ background: UMOYA_DARK.surface, border: `1px solid ${UMOYA_DARK.border}`, color: UMOYA_DARK.text, borderRadius: 6, padding: '5px 10px', fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ color: UMOYA_DARK.muted, fontSize: 12 }}>To:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            style={{ background: UMOYA_DARK.surface, border: `1px solid ${UMOYA_DARK.border}`, color: UMOYA_DARK.text, borderRadius: 6, padding: '5px 10px', fontSize: 13 }} />
        </div>
        <button
          onClick={() => load(activeTab)}
          style={{ background: '#3B9EFF', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        {(Object.keys(TAB_LABELS) as CascadeTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? '#3B9EFF' : UMOYA_DARK.surface,
              color: activeTab === tab ? '#fff' : UMOYA_DARK.muted,
              border: `1px solid ${activeTab === tab ? '#3B9EFF' : UMOYA_DARK.border}`,
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: UMOYA_DARK.surface, border: `1px solid ${UMOYA_DARK.border}`, borderRadius: 12, padding: '28px 32px' }}>
        {loading && <div style={{ color: UMOYA_DARK.muted, textAlign: 'center', padding: '40px 0' }}>Loading cascade data…</div>}

        {!loading && !d && <div style={{ color: UMOYA_DARK.muted, textAlign: 'center', padding: '40px 0' }}>No data available for this period.</div>}

        {!loading && d && activeTab === 'hiv' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              <StatCard label="Estimated PLHIV" value={d.population} />
              <StatCard label="Diagnosed" value={d.diagnosedPlhiv} />
              <StatCard label="On ART" value={d.onArt} />
              <StatCard label="Virally Suppressed" value={d.virallySuppressed} />
            </div>

            <div style={{ display: 'flex', gap: 32, marginBottom: 32, flexWrap: 'wrap' }}>
              <NinetyBadge label="1st 90 — Diagnosed" value={d.firstNinety} />
              <NinetyBadge label="2nd 90 — On ART" value={d.secondNinety} />
              <NinetyBadge label="3rd 90 — Suppressed" value={d.thirdNinety} />
              <NinetyBadge label="Overall Coverage" value={d.overallCoverage} />
            </div>

            <CascadeFunnel steps={d.funnelSteps as FunnelStep[]} title="HIV 95-95-95 Cascade" />

            <div style={{ marginTop: 28, borderTop: `1px solid ${UMOYA_DARK.border}`, paddingTop: 20 }}>
              <div style={{ color: UMOYA_DARK.text, fontWeight: 600, marginBottom: 12 }}>Where Patients Are Lost</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.gaps.notDiagnosed > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: UMOYA_DARK.coral, fontWeight: 600, minWidth: 80 }}>{d.gaps.notDiagnosed.toLocaleString()}</span>
                    <span style={{ color: UMOYA_DARK.muted, fontSize: 13 }}>PLHIV not yet diagnosed → Action: community testing</span>
                  </div>
                )}
                {d.gaps.diagnosedNotOnArt > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: UMOYA_DARK.amber, fontWeight: 600, minWidth: 80 }}>{d.gaps.diagnosedNotOnArt.toLocaleString()}</span>
                    <span style={{ color: UMOYA_DARK.muted, fontSize: 13 }}>Diagnosed, not on ART → Action: linkage to care</span>
                    <button onClick={() => loadGap(`/tenants/${slug}/cascades/hiv/gaps/not-on-art`, 'Diagnosed — Not on ART')}
                      style={{ background: 'none', border: `1px solid ${UMOYA_DARK.border}`, color: UMOYA_DARK.muted, borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>
                      View List
                    </button>
                  </div>
                )}
                {d.gaps.onArtNotSuppressed > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: UMOYA_DARK.amber, fontWeight: 600, minWidth: 80 }}>{d.gaps.onArtNotSuppressed.toLocaleString()}</span>
                    <span style={{ color: UMOYA_DARK.muted, fontSize: 13 }}>On ART, not suppressed → Action: adherence, DSD</span>
                    <button onClick={() => loadGap(`/tenants/${slug}/cascades/hiv/gaps/not-suppressed`, 'On ART — Not Suppressed')}
                      style={{ background: 'none', border: `1px solid ${UMOYA_DARK.border}`, color: UMOYA_DARK.muted, borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>
                      View List
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && d && activeTab === 'pmtct' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              <StatCard label="MTCT Rate" value={`${d.mtctRate.toFixed(1)}%`} colour={d.mtctRate <= 2 ? UMOYA_DARK.teal : UMOYA_DARK.coral} />
              <StatCard label="EID Coverage (≤2m)" value={`${d.eidCoverage.toFixed(1)}%`} colour={d.eidCoverage >= 95 ? UMOYA_DARK.teal : UMOYA_DARK.amber} />
            </div>
            <CascadeFunnel steps={d.funnelSteps as FunnelStep[]} title="PMTCT Cascade" />
            <div style={{ marginTop: 20 }}>
              <button onClick={() => loadGap(`/tenants/${slug}/cascades/pmtct/gaps/eid-not-tested`, 'EID Not Tested')}
                style={{ background: 'none', border: `1px solid ${UMOYA_DARK.border}`, color: UMOYA_DARK.muted, borderRadius: 4, padding: '5px 14px', fontSize: 13, cursor: 'pointer' }}>
                ⚠ View infants not yet tested by 2 months
              </button>
            </div>
          </div>
        )}

        {!loading && d && activeTab === 'tb-hiv' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              <StatCard label="Co-infection Rate" value={`${d.tbHivCoinfectionRate.toFixed(1)}%`} />
              <StatCard label="ART Coverage (HIV+ TB)" value={`${d.artCoverageAmongHivPosTb.toFixed(1)}%`} colour={d.artCoverageAmongHivPosTb >= 90 ? UMOYA_DARK.teal : UMOYA_DARK.amber} />
              <StatCard label="TB Treatment Success" value={`${d.tbTreatmentSuccessRate.toFixed(1)}%`} colour={d.tbTreatmentSuccessRate >= 90 ? UMOYA_DARK.teal : UMOYA_DARK.amber} />
            </div>
            <CascadeFunnel steps={d.funnelSteps as FunnelStep[]} title="TB-HIV Cascade" />
            {d.gaps?.hivStatusUnknown > 0 && (
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: UMOYA_DARK.coral }}>⚠ {d.gaps.hivStatusUnknown} TB cases with UNKNOWN HIV status</span>
                <button onClick={() => loadGap(`/tenants/${slug}/cascades/tb-hiv/gaps/hiv-status-unknown`, 'TB — HIV Status Unknown')}
                  style={{ background: 'none', border: `1px solid ${UMOYA_DARK.border}`, color: UMOYA_DARK.muted, borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>
                  View List
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && d && activeTab.startsWith('ncd') && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              <StatCard label="Control Rate" value={`${d.controlRate.toFixed(1)}%`} colour={d.controlRate >= 60 ? UMOYA_DARK.teal : UMOYA_DARK.coral} />
              <StatCard label="In-Care Rate" value={`${d.inCareRate.toFixed(1)}%`} colour={d.inCareRate >= 75 ? UMOYA_DARK.teal : UMOYA_DARK.amber} />
              <StatCard label="Measurement Coverage" value={`${d.measurementCoverageRate.toFixed(1)}%`} colour={d.measurementCoverageRate >= 80 ? UMOYA_DARK.teal : UMOYA_DARK.amber} />
            </div>
            <CascadeFunnel
              steps={d.funnelSteps as FunnelStep[]}
              title={`NCD Cascade — ${TAB_LABELS[activeTab]}`}
            />
            {d.gaps?.notInCare > 0 && (
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: UMOYA_DARK.coral }}>⚠ {d.gaps.notInCare} patients not in active care</span>
                <button
                  onClick={() => loadGap(
                    `/tenants/${slug}/cascades/ncd/gaps/not-in-care?condition=${activeTab === 'ncd-htn' ? 'hypertension' : activeTab === 'ncd-dm' ? 'diabetes' : 'ckd'}`,
                    'NCD — Not in Active Care',
                  )}
                  style={{ background: 'none', border: `1px solid ${UMOYA_DARK.border}`, color: UMOYA_DARK.muted, borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>
                  Generate Recall List
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gap Patient Modal */}
      {gapModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setGapModal(null)} />
          <div style={{
            position: 'relative',
            background: UMOYA_DARK.surface,
            border: `1px solid ${UMOYA_DARK.border}`,
            borderRadius: 12,
            padding: '24px 28px',
            width: 680,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ color: UMOYA_DARK.text, fontWeight: 600, fontSize: 15 }}>{gapModal}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {gapPatients.length > 0 && (
                  <button
                    onClick={() => downloadCsv(gapPatients, `${gapModal.replace(/\s/g, '_')}.csv`)}
                    style={{ background: 'none', border: `1px solid ${UMOYA_DARK.border}`, color: UMOYA_DARK.muted, borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
                  >
                    Download CSV
                  </button>
                )}
                <button onClick={() => setGapModal(null)}
                  style={{ background: 'none', border: 'none', color: UMOYA_DARK.muted, cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {gapLoading && <div style={{ color: UMOYA_DARK.muted, textAlign: 'center', padding: 32 }}>Loading patients…</div>}
              {!gapLoading && gapPatients.length === 0 && <div style={{ color: UMOYA_DARK.muted, textAlign: 'center', padding: 32 }}>No patients found.</div>}
              {!gapLoading && gapPatients.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${UMOYA_DARK.border}` }}>
                      <th style={{ textAlign: 'left', padding: '6px 12px', color: UMOYA_DARK.muted, fontWeight: 600 }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '6px 12px', color: UMOYA_DARK.muted, fontWeight: 600 }}>Phone</th>
                      <th style={{ textAlign: 'left', padding: '6px 12px', color: UMOYA_DARK.muted, fontWeight: 600 }}>Last Seen</th>
                      <th style={{ textAlign: 'right', padding: '6px 12px', color: UMOYA_DARK.muted, fontWeight: 600 }}>Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gapPatients.map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${UMOYA_DARK.border}33` }}>
                        <td style={{ padding: '8px 12px', color: UMOYA_DARK.text }}>{p.name ?? '—'}</td>
                        <td style={{ padding: '8px 12px', color: UMOYA_DARK.muted }}>{p.phone_number ?? '—'}</td>
                        <td style={{ padding: '8px 12px', color: UMOYA_DARK.muted }}>{p.last_seen ? new Date(p.last_seen).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: (p.days_overdue ?? 0) > 90 ? UMOYA_DARK.coral : UMOYA_DARK.amber }}>
                          {p.days_overdue ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CascadeDashboardPage;
