import React, { useState, useEffect, useCallback } from 'react';
import { ehrAxios } from '../services/api';

interface FollowUpItem {
  id: string;
  patient_id: string;
  patient_name: string;
  encounter_type: string;
  window_days: number;
  due_date: string;
  days_overdue?: number;
}

interface RecordOutcomeFormState {
  scheduleId: string;
  encounterId: string;
  encounterType: string;
  patientId: string;
  windowDays: number;
  patientName: string;
  outcomeType: string;
  clinicalNotes: string;
  dataSource: string;
}

const OUTCOME_OPTIONS_BY_TYPE: Record<string, string[]> = {
  delivery:              ['alive_stable', 'alive_uncontrolled', 'deceased', 'not_evaluated'],
  hiv_visit:             ['alive_in_care', 'ltfu', 'deceased', 'transferred_out', 'not_evaluated'],
  tb_case:               ['cured', 'defaulted', 'treatment_failure', 'deceased', 'transferred_out', 'not_evaluated'],
  nutrition_admission:   ['alive_stable', 'alive_uncontrolled', 'deceased', 'not_evaluated'],
  icu_admission:         ['alive_stable', 'readmitted', 'deceased', 'not_evaluated'],
  ncd_visit:             ['alive_controlled', 'alive_uncontrolled', 'deceased', 'not_evaluated'],
  postop:                ['alive_stable', 'readmitted', 'deceased', 'not_evaluated'],
  oncology_cycle:        ['alive_stable', 'alive_uncontrolled', 'deceased', 'not_evaluated'],
  nicu_admission:        ['alive_stable', 'deceased', 'transferred_out', 'not_evaluated'],
  mental_health_session: ['alive_stable', 'alive_uncontrolled', 'not_evaluated'],
  oem_assessment:        ['alive_stable', 'alive_uncontrolled', 'not_evaluated'],
};

function urgencyColor(item: FollowUpItem): string {
  if (item.days_overdue && item.days_overdue > 0) return '#E8614D';
  const dueDate = new Date(item.due_date);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
  if (daysUntilDue <= 3) return '#F0954A';
  return '#3B9EFF';
}

function urgencyLabel(item: FollowUpItem): string {
  if (item.days_overdue && item.days_overdue > 0) {
    return `${item.days_overdue} day${item.days_overdue === 1 ? '' : 's'} late`;
  }
  const dueDate = new Date(item.due_date);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
  if (daysUntilDue === 0) return 'due today';
  if (daysUntilDue === 1) return 'due tomorrow';
  return `due in ${daysUntilDue} days`;
}

function encounterLabel(encounterType: string, windowDays: number): string {
  const typeLabels: Record<string, string> = {
    delivery: 'Delivery',
    hiv_visit: 'HIV Visit',
    tb_case: 'TB Case',
    nutrition_admission: 'SAM Admission',
    icu_admission: 'ICU Admission',
    ncd_visit: 'NCD Visit',
    postop: 'Post-op',
    oncology_cycle: 'Oncology Cycle',
    nicu_admission: 'NICU Admission',
    mental_health_session: 'Mental Health',
    oem_assessment: 'OEM Assessment',
  };
  return `${typeLabels[encounterType] ?? encounterType} ${windowDays}-day`;
}

const EMPTY_FORM: RecordOutcomeFormState = {
  scheduleId: '',
  encounterId: '',
  encounterType: '',
  patientId: '',
  windowDays: 0,
  patientName: '',
  outcomeType: '',
  clinicalNotes: '',
  dataSource: 'manual',
};

interface Props {
  tenantSlug: string;
  token: string;
}

export const OutcomeFollowUpWorkqueue: React.FC<Props> = ({ tenantSlug, token }) => {
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<RecordOutcomeFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dueIn7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      const [overdueRes, pendingRes] = await Promise.all([
        ehrAxios.get(`/tenants/${tenantSlug}/outcomes/overdue`, { headers }),
        ehrAxios.get(`/tenants/${tenantSlug}/outcomes/pending`, {
          headers,
          params: { dueBefore: dueIn7 },
        }),
      ]);
      const overdue: FollowUpItem[] = overdueRes.data ?? [];
      const pending: FollowUpItem[] = pendingRes.data ?? [];
      // Merge, deduplicate by id, overdue first
      const seen = new Set<string>();
      const merged: FollowUpItem[] = [];
      for (const item of [...overdue, ...pending]) {
        if (!seen.has(item.id)) { seen.add(item.id); merged.push(item); }
      }
      setItems(merged);
      setOverdueCount(overdue.length);
    } catch {
      // silently fail — workqueue is non-critical
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token]);

  useEffect(() => { load(); }, [load]);

  function openPanel(item: FollowUpItem) {
    setForm({
      scheduleId: item.id,
      encounterId: '', // resolved server-side via scheduleId
      encounterType: item.encounter_type,
      patientId: item.patient_id,
      windowDays: item.window_days,
      patientName: item.patient_name,
      outcomeType: '',
      clinicalNotes: '',
      dataSource: 'manual',
    });
    setError(null);
    setPanelOpen(true);
  }

  async function submitOutcome() {
    if (!form.outcomeType) { setError('Please select an outcome.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await ehrAxios.post(
        `/tenants/${tenantSlug}/outcomes`,
        {
          encounterId: form.encounterId || form.scheduleId, // fallback
          encounterType: form.encounterType,
          patientId: form.patientId,
          outcomeType: form.outcomeType,
          outcomeDate: new Date().toISOString().slice(0, 10),
          followUpWindowDays: form.windowDays,
          clinicalNotes: form.clinicalNotes || undefined,
          dataSource: form.dataSource,
        },
        { headers },
      );
      setPanelOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to record outcome. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div style={{
        background: '#1a1f2e',
        border: '1px solid #2a3146',
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #2a3146',
          background: '#151929',
        }}>
          <span style={{ color: '#c8d0e0', fontWeight: 600, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Outcome Follow-Ups
          </span>
          {overdueCount > 0 && (
            <span style={{
              background: '#E8614D22',
              color: '#E8614D',
              border: '1px solid #E8614D44',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#E8614D',
                animation: 'pulse 1.4s infinite',
                display: 'inline-block',
              }} />
              {overdueCount} overdue
            </span>
          )}
        </div>

        {/* List */}
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '20px 16px', color: '#6b7a99', fontSize: 13, textAlign: 'center' }}>
              Loading follow-ups…
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '20px 16px', color: '#6b7a99', fontSize: 13, textAlign: 'center' }}>
              No follow-ups due this week.
            </div>
          ) : (
            items.map((item) => {
              const color = urgencyColor(item);
              return (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: '1px solid #1e2436',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: color,
                      marginTop: 4, flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ color: '#e0e6f0', fontSize: 13, fontWeight: 500 }}>
                        {item.patient_name || 'Unknown Patient'}
                      </div>
                      <div style={{ color: '#6b7a99', fontSize: 12, marginTop: 2 }}>
                        {encounterLabel(item.encounter_type, item.window_days)}
                        {' · '}
                        <span style={{ color }}>{urgencyLabel(item)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openPanel(item)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${color}44`,
                      color,
                      borderRadius: 4,
                      padding: '4px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    Record ↗
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Slide-over panel */}
      {panelOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setPanelOpen(false)}
          />
          <div style={{
            position: 'relative',
            width: 420,
            height: '100vh',
            background: '#151929',
            borderLeft: '1px solid #2a3146',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '-4px 0 32px rgba(0,0,0,0.4)',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #2a3146',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ color: '#e0e6f0', fontWeight: 600, fontSize: 15 }}>Record Outcome</div>
                <div style={{ color: '#6b7a99', fontSize: 12, marginTop: 3 }}>
                  {form.patientName} · {encounterLabel(form.encounterType, form.windowDays)}
                </div>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                style={{ background: 'none', border: 'none', color: '#6b7a99', cursor: 'pointer', fontSize: 20 }}
              >
                ×
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Outcome selector */}
              <div>
                <label style={{ color: '#c8d0e0', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Outcome
                </label>
                <select
                  value={form.outcomeType}
                  onChange={(e) => setForm((f) => ({ ...f, outcomeType: e.target.value }))}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: '#1a1f2e', border: '1px solid #2a3146',
                    borderRadius: 6, color: '#e0e6f0', fontSize: 13,
                  }}
                >
                  <option value="">Select outcome…</option>
                  {(OUTCOME_OPTIONS_BY_TYPE[form.encounterType] ?? ['alive_stable', 'deceased', 'not_evaluated'])
                    .map((o) => (
                      <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
                    ))}
                </select>
              </div>

              {/* Data source */}
              <div>
                <label style={{ color: '#c8d0e0', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Data Source
                </label>
                <select
                  value={form.dataSource}
                  onChange={(e) => setForm((f) => ({ ...f, dataSource: e.target.value }))}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: '#1a1f2e', border: '1px solid #2a3146',
                    borderRadius: 6, color: '#e0e6f0', fontSize: 13,
                  }}
                >
                  <option value="manual">Manual</option>
                  <option value="phone_verified">Phone Verified</option>
                  <option value="community_follow_up">Community Follow-Up</option>
                  <option value="system_detected">System Detected</option>
                </select>
              </div>

              {/* Clinical notes */}
              <div>
                <label style={{ color: '#c8d0e0', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Clinical Notes <span style={{ color: '#6b7a99', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={form.clinicalNotes}
                  onChange={(e) => setForm((f) => ({ ...f, clinicalNotes: e.target.value }))}
                  placeholder="Any relevant clinical observations…"
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: '#1a1f2e', border: '1px solid #2a3146',
                    borderRadius: 6, color: '#e0e6f0', fontSize: 13,
                    resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div style={{ color: '#E8614D', fontSize: 13, background: '#E8614D11', borderRadius: 6, padding: '10px 14px' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #2a3146' }}>
              <button
                onClick={submitOutcome}
                disabled={submitting}
                style={{
                  width: '100%', padding: '10px 0',
                  background: submitting ? '#2a3146' : '#3B9EFF',
                  color: submitting ? '#6b7a99' : '#fff',
                  border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {submitting ? 'Recording…' : 'Record Outcome'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
};

export default OutcomeFollowUpWorkqueue;
