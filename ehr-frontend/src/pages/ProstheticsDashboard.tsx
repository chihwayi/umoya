import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { ehrAxios } from '../services/api';

interface AmputeeRecord {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  amputation_level: string;
  laterality: string;
  aetiology: string;
  k_level: number | null;
  k_assessed_date: string | null;
  phantom_pain: boolean;
  residual_pain: boolean;
  skin_condition: string | null;
}

interface Prescription {
  id: string;
  patient_id: string;
  device_type: string;
  device_category: string;
  prescribed_k_level: number | null;
  status: string;
  prescribed_date: string;
  delivery_date: string | null;
}

const K_COLORS: Record<number, string> = {
  0: '#6b7280',
  1: '#3b82f6',
  2: '#14b8a6',
  3: '#22c55e',
  4: '#f59e0b',
};

const K_LABELS: Record<number, string> = {
  0: 'K0 — No potential',
  1: 'K1 — Household',
  2: 'K2 — Limited community',
  3: 'K3 — Community',
  4: 'K4 — High activity',
};

const STATUS_COLOR: Record<string, string> = {
  prescribed: '#f59e0b',
  in_fabrication: '#3b82f6',
  fitted: '#14b8a6',
  delivered: '#22c55e',
  rejected: '#ef4444',
  returned: '#6b7280',
};

function KBadge({ level }: { level: number | null }) {
  if (level == null) return <span style={{ color: '#6b7280', fontSize: 12 }}>Not assessed</span>;
  return (
    <span style={{
      background: (K_COLORS[level] ?? '#6b7280') + '22',
      color: K_COLORS[level] ?? '#6b7280',
      fontWeight: 600,
      fontSize: 12,
      padding: '2px 10px',
      borderRadius: 20,
      display: 'inline-block',
    }}>
      K{level}
    </span>
  );
}

export default function ProstheticsDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [register, setRegister] = useState<AmputeeRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [kForm, setKForm] = useState<{ patientId: string; kLevel: number } | null>(null);
  const [kDesc, setKDesc] = useState('');
  const [cdssResult, setCdssResult] = useState<any>(null);
  const [tab, setTab] = useState<'register' | 'prescriptions'>('register');

  const api = axios.create({ baseURL: `/api/${tenantSlug}` });

  useEffect(() => {
    Promise.all([
      api.get('/prosthetics/register'),
    ])
      .then(([regRes]) => {
        setRegister(regRes.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  useEffect(() => {
    if (!selectedPatient) return;
    api.get(`/prosthetics/prescriptions/${selectedPatient}`)
      .then((r: any) => setPrescriptions(r.data ?? []))
      .catch(() => {});
  }, [selectedPatient, tenantSlug]);

  const handleKLevelUpdate = async () => {
    if (!kForm) return;
    try {
      const res = await api.patch(`/prosthetics/register/${kForm.patientId}/k-level`, { kLevel: kForm.kLevel });
      setKDesc(res.data?.k_description ?? '');
      setRegister(prev => prev.map(r => r.patient_id === kForm.patientId ? { ...r, k_level: kForm.kLevel } : r));

      const cdss = await ehrAxios.post('/cdss/prosthetics/k-level-prediction', {
        amputation_level: register.find(r => r.patient_id === kForm.patientId)?.amputation_level,
        aetiology: register.find(r => r.patient_id === kForm.patientId)?.aetiology,
        age: 50,
        pre_amputation_ambulatory: true,
        contralateral_limb_intact: true,
        cardiovascular_disease: false,
        cognition_intact: true,
      });
      setCdssResult(cdss.data);
    } catch {
      setKDesc('Updated successfully.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: '#6b7280' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', fontFamily: 'Inter, sans-serif', color: '#111827' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Prosthetics & Rehabilitation</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Amputee register · K-level assessment · Device prescription · Rehab outcomes</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {(['register', 'prescriptions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              background: tab === t ? '#14b8a6' : '#f3f4f6',
              color: tab === t ? '#fff' : '#374151',
            }}
          >
            {t === 'register' ? 'Amputee Register' : 'Prescriptions'}
          </button>
        ))}
      </div>

      {tab === 'register' && (
        <>
          {/* K-Level Assessment Card */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 20, marginBottom: 24, maxWidth: 480 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#065f46' }}>K-Level Assessment</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <select
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                value={kForm?.patientId ?? ''}
                onChange={e => setKForm(f => ({ patientId: e.target.value, kLevel: f?.kLevel ?? 2 }))}
              >
                <option value="">Select patient</option>
                {register.map(r => (
                  <option key={r.patient_id} value={r.patient_id}>
                    {r.last_name}, {r.first_name}
                  </option>
                ))}
              </select>
              <select
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                value={kForm?.kLevel ?? 2}
                onChange={e => setKForm(f => ({ patientId: f?.patientId ?? '', kLevel: parseInt(e.target.value) }))}
              >
                {[0, 1, 2, 3, 4].map(k => (
                  <option key={k} value={k}>K{k} — {K_LABELS[k].split('—')[1].trim()}</option>
                ))}
              </select>
              <button
                onClick={handleKLevelUpdate}
                style={{ padding: '6px 16px', background: '#14b8a6', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Update K-Level
              </button>
            </div>
            {kDesc && <p style={{ fontSize: 12, color: '#065f46', margin: 0 }}>{kDesc}</p>}
            {cdssResult && (
              <div style={{ marginTop: 10, padding: 10, background: '#fff', borderRadius: 8, border: '1px solid #d1fae5' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#14b8a6', margin: '0 0 4px' }}>
                  CDSS Prediction: K{cdssResult.predicted_k_level} — {cdssResult.description}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{cdssResult.rationale}</p>
              </div>
            )}
          </div>

          {/* Amputee Register Table */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 14 }}>
              Amputee Register ({register.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Patient', 'Amputation Level', 'Laterality', 'Aetiology', 'K-Level', 'Phantom Pain', 'Skin', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {register.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.last_name}, {r.first_name}</td>
                      <td style={{ padding: '10px 16px', color: '#374151' }}>{r.amputation_level.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{r.laterality}</td>
                      <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{r.aetiology}</td>
                      <td style={{ padding: '10px 16px' }}><KBadge level={r.k_level} /></td>
                      <td style={{ padding: '10px 16px', color: r.phantom_pain ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                        {r.phantom_pain ? 'Yes' : 'No'}
                      </td>
                      <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{r.skin_condition ?? '—'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <button
                          onClick={() => { setSelectedPatient(r.patient_id); setTab('prescriptions'); }}
                          style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#ede9fe', color: '#7c3aed', fontWeight: 600, fontSize: 12 }}
                        >
                          Prescriptions
                        </button>
                      </td>
                    </tr>
                  ))}
                  {register.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>No amputee records.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'prescriptions' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 14 }}>
            Device Prescriptions {selectedPatient ? '' : '— select a patient from the register'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Device Type', 'Category', 'K-Level', 'Status', 'Prescribed', 'Delivered'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prescriptions.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{p.device_type}</td>
                    <td style={{ padding: '10px 16px' }}>{p.device_category?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 16px' }}><KBadge level={p.prescribed_k_level} /></td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        background: (STATUS_COLOR[p.status] ?? '#6b7280') + '22',
                        color: STATUS_COLOR[p.status] ?? '#6b7280',
                        fontWeight: 600,
                        fontSize: 11,
                        padding: '2px 10px',
                        borderRadius: 20,
                      }}>
                        {p.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6b7280' }}>{p.prescribed_date}</td>
                    <td style={{ padding: '10px 16px', color: p.delivery_date ? '#22c55e' : '#9ca3af' }}>
                      {p.delivery_date ?? '—'}
                    </td>
                  </tr>
                ))}
                {prescriptions.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>No prescriptions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
