import React, { useEffect, useState } from 'react';
import { ehrApi as api } from '../services/api';

interface Programme {
  id: string;
  name: string;
  programme_type: 'WEEP' | 'MEEP';
  description?: string;
  start_date?: string;
  end_date?: string;
  target_participants?: number;
  status: string;
}

interface Enrolment {
  id: string;
  patient_id: string;
  programme_id: string;
  programme_name?: string;
  programme_type?: string;
  enrolment_date: string;
  status: string;
  baseline_income?: number;
  graduation_date?: string;
  business_started?: boolean;
  loan_received?: boolean;
  loan_amount_usd?: number;
}

interface ProgrammeStats {
  total_enrolled: number;
  graduated: number;
  dropped_out: number;
  businesses_started: number;
  loans_received: number;
  avg_loan_usd: number;
}

interface Props {
  token: string;
  tenantSlug: string;
}

export default function EmpowermentDashboard({ token, tenantSlug }: Props) {
  const [tab, setTab] = useState<'WEEP' | 'MEEP'>('WEEP');
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null);
  const [stats, setStats] = useState<ProgrammeStats | null>(null);
  const [, setEnrolments] = useState<Enrolment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewProgramme, setShowNewProgramme] = useState(false);
  const [showEnrol, setShowEnrol] = useState(false);

  const [programmeForm, setProgrammeForm] = useState({
    name: '', description: '', startDate: '', targetParticipants: '',
  });
  const [enrolForm, setEnrolForm] = useState({
    patientId: '', referredBy: '', referralReason: '', baselineIncome: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProgrammes();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProgrammes() {
    setLoading(true);
    const { data } = await api.listProgrammes(tab, token, tenantSlug);
    setProgrammes(data || []);
    setSelectedProgramme(null);
    setStats(null);
    setEnrolments([]);
    setLoading(false);
  }

  async function selectProgramme(p: Programme) {
    setSelectedProgramme(p);
    const [{ data: s }] = await Promise.all([
      api.getProgrammeStats(p.id, token, tenantSlug),
    ]);
    setStats(s);
  }

  async function handleCreateProgramme(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api.createProgramme({
      name: programmeForm.name,
      programmeType: tab,
      description: programmeForm.description,
      startDate: programmeForm.startDate || undefined,
      targetParticipants: programmeForm.targetParticipants ? Number(programmeForm.targetParticipants) : undefined,
    }, token, tenantSlug);
    setSaving(false);
    setShowNewProgramme(false);
    setProgrammeForm({ name: '', description: '', startDate: '', targetParticipants: '' });
    loadProgrammes();
  }

  async function handleEnrol(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProgramme || !enrolForm.patientId) return;
    setSaving(true);
    await api.enrolPatient(enrolForm.patientId, {
      programmeId: selectedProgramme.id,
      referredBy: enrolForm.referredBy || undefined,
      referralReason: enrolForm.referralReason || undefined,
      baselineIncome: enrolForm.baselineIncome ? Number(enrolForm.baselineIncome) : undefined,
    }, token, tenantSlug);
    setSaving(false);
    setShowEnrol(false);
    setEnrolForm({ patientId: '', referredBy: '', referralReason: '', baselineIncome: '' });
    if (selectedProgramme) {
      const { data: s } = await api.getProgrammeStats(selectedProgramme.id, token, tenantSlug);
      setStats(s);
    }
  }

  const tabStyle = (t: 'WEEP' | 'MEEP') => ({
    padding: '8px 24px',
    cursor: 'pointer',
    borderBottom: tab === t ? '3px solid #6366f1' : '3px solid transparent',
    fontWeight: tab === t ? 700 : 400,
    color: tab === t ? '#6366f1' : '#374151',
    background: 'none',
    border: 'none',
    fontSize: 15,
  } as React.CSSProperties);

  const badge = (type: string) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: type === 'WEEP' ? '#ede9fe' : '#dbeafe',
    color: type === 'WEEP' ? '#6d28d9' : '#1d4ed8',
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Economic Empowerment Programmes</h2>
        <button
          onClick={() => setShowNewProgramme(true)}
          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontWeight: 600 }}
        >
          + New Programme
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        <button style={tabStyle('WEEP')} onClick={() => setTab('WEEP')}>
          WEEP (Women)
        </button>
        <button style={tabStyle('MEEP')} onClick={() => setTab('MEEP')}>
          MEEP (Men)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Programme list */}
        <div>
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading...</p>
          ) : programmes.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No {tab} programmes yet.</p>
          ) : (
            programmes.map(p => (
              <div
                key={p.id}
                onClick={() => selectProgramme(p)}
                style={{
                  padding: 16, borderRadius: 8, marginBottom: 12, cursor: 'pointer',
                  border: selectedProgramme?.id === p.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
                  background: selectedProgramme?.id === p.id ? '#f5f3ff' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={badge(p.programme_type)}>{p.programme_type}</span>
                </div>
                {p.description && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>{p.description}</p>}
                {p.start_date && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Started {p.start_date?.slice(0, 10)}</p>}
              </div>
            ))
          )}
        </div>

        {/* Stats panel */}
        {selectedProgramme && (
          <div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{selectedProgramme.name}</h3>
                <button
                  onClick={() => setShowEnrol(true)}
                  style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  Enrol Patient
                </button>
              </div>
              {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Enrolled', value: stats.total_enrolled },
                    { label: 'Graduated', value: stats.graduated },
                    { label: 'Dropped Out', value: stats.dropped_out },
                    { label: 'Businesses Started', value: stats.businesses_started },
                    { label: 'Loans Received', value: stats.loans_received },
                    { label: 'Avg Loan (USD)', value: stats.avg_loan_usd ? `$${Number(stats.avg_loan_usd).toFixed(0)}` : '—' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#fff', borderRadius: 6, padding: 12, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#6366f1' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Programme Modal */}
      {showNewProgramme && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleCreateProgramme} style={{ background: '#fff', borderRadius: 10, padding: 28, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px' }}>New {tab} Programme</h3>
            {[
              { label: 'Programme Name *', key: 'name', required: true },
              { label: 'Description', key: 'description', required: false },
              { label: 'Start Date', key: 'startDate', required: false, type: 'date' },
              { label: 'Target Participants', key: 'targetParticipants', required: false, type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  required={f.required}
                  value={(programmeForm as any)[f.key]}
                  onChange={e => setProgrammeForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setShowNewProgramme(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Enrol Patient Modal */}
      {showEnrol && selectedProgramme && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleEnrol} style={{ background: '#fff', borderRadius: 10, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px' }}>Enrol in {selectedProgramme.name}</h3>
            {[
              { label: 'Patient ID *', key: 'patientId', required: true },
              { label: 'Referred By', key: 'referredBy', required: false },
              { label: 'Referral Reason', key: 'referralReason', required: false },
              { label: 'Baseline Monthly Income (USD)', key: 'baselineIncome', required: false, type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  required={f.required}
                  value={(enrolForm as any)[f.key]}
                  onChange={e => setEnrolForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setShowEnrol(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Enrolling...' : 'Enrol'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
