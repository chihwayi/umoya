import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, ShieldCheck, CheckCircle, Plus, X } from 'lucide-react';
import { api } from '../services/api';

interface Credential {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  license_number: string;
  license_expiry_date: string;
  malpractice_expiry_date: string | null;
  cpd_points_current_cycle: number;
  cpd_points_required: number;
  status: string;
}

interface ExpiryAlert {
  credentialId: string;
  name: string;
  role: string;
  license: { expiryDate: string | null; daysRemaining: number | null; alertBucket: string | null };
  malpractice: { expiryDate: string | null; daysRemaining: number | null; alertBucket: string | null };
  cpd: { cycleEndDate: string | null; daysRemaining: number | null; alertBucket: string | null; pointsCurrent: number; pointsRequired: number; shortfall: boolean };
}

const BUCKET_LABELS: Record<string, string> = {
  lapsed: 'Lapsed',
  within_30_days: 'Within 30 days',
  within_60_days: 'Within 60 days',
  within_90_days: 'Within 90 days',
};
const BUCKET_COLORS: Record<string, string> = {
  lapsed: '#E8614D',
  within_30_days: '#E8614D',
  within_60_days: '#F0954A',
  within_90_days: '#3B9EFF',
};

function NewCredentialModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    userId: '', licenseNumber: '', licenseBody: '', licenseExpiryDate: '',
    malpracticeProvider: '', malpracticePolicyNumber: '', malpracticeExpiryDate: '',
    cpdPointsCurrentCycle: 0, cpdPointsRequired: 0, cpdCycleEndDate: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/staff-credentialing/credentials', form);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#E2EDF8]">Register Staff Credential</h2>
          <button onClick={onClose} className="text-[#7A9CBC] hover:text-[#E2EDF8]"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Staff user ID" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} />
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="License number" value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} />
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="License body (e.g. MDPCZ)" value={form.licenseBody} onChange={e => setForm({ ...form, licenseBody: e.target.value })} />
          <div>
            <label className="text-xs text-[#7A9CBC]">License expiry date</label>
            <input type="date" className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8] mt-1"
              value={form.licenseExpiryDate} onChange={e => setForm({ ...form, licenseExpiryDate: e.target.value })} />
          </div>
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Malpractice provider (optional)" value={form.malpracticeProvider} onChange={e => setForm({ ...form, malpracticeProvider: e.target.value })} />
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Malpractice policy number (optional)" value={form.malpracticePolicyNumber} onChange={e => setForm({ ...form, malpracticePolicyNumber: e.target.value })} />
          <div>
            <label className="text-xs text-[#7A9CBC]">Malpractice cover expiry (optional)</label>
            <input type="date" className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8] mt-1"
              value={form.malpracticeExpiryDate} onChange={e => setForm({ ...form, malpracticeExpiryDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" className="bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
              placeholder="CPD points earned" value={form.cpdPointsCurrentCycle}
              onChange={e => setForm({ ...form, cpdPointsCurrentCycle: Number(e.target.value) })} />
            <input type="number" className="bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
              placeholder="CPD points required" value={form.cpdPointsRequired}
              onChange={e => setForm({ ...form, cpdPointsRequired: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-[#7A9CBC]">CPD cycle end date (optional)</label>
            <input type="date" className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8] mt-1"
              value={form.cpdCycleEndDate} onChange={e => setForm({ ...form, cpdCycleEndDate: e.target.value })} />
          </div>
        </div>
        <button
          disabled={saving || !form.userId || !form.licenseNumber || !form.licenseExpiryDate}
          onClick={submit}
          className="mt-4 w-full py-2 rounded-[8px] text-sm font-semibold bg-[#3B9EFF] text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Register Credential'}
        </button>
      </div>
    </div>
  );
}

export default function StaffCredentialingDashboard() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/staff-credentialing/credentials'),
      api.get('/staff-credentialing/credentials/expiry-alerts'),
    ]).then(([creds, alertList]) => {
      setCredentials(creds.data ?? creds);
      setAlerts(alertList.data ?? alertList);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && credentials.length === 0) {
    return <div className="flex items-center justify-center h-64 text-[#7A9CBC]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}>
            Staff Credentialing & Privileging
          </h1>
          <p className="text-[#7A9CBC] text-sm mt-1">License, malpractice cover, CPD compliance & procedure privileges</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold bg-[#3B9EFF] text-white"
        >
          <Plus size={16} /> Register Credential
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="bg-[#111E35] rounded-[14px] border border-[#E8614D44] p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-[#E8614D]" />
            <h2 className="text-base font-semibold">Expiry Alerts</h2>
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E8614D22] text-[#E8614D]">
              {alerts.length}
            </span>
          </div>
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.credentialId} className="border-b border-[#162440] pb-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{a.name} <span className="text-[#7A9CBC] capitalize">({a.role})</span></span>
                </div>
                <div className="flex gap-3 mt-1 flex-wrap">
                  {a.license.alertBucket && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${BUCKET_COLORS[a.license.alertBucket]}22`, color: BUCKET_COLORS[a.license.alertBucket] }}>
                      License: {BUCKET_LABELS[a.license.alertBucket]}
                    </span>
                  )}
                  {a.malpractice.alertBucket && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${BUCKET_COLORS[a.malpractice.alertBucket]}22`, color: BUCKET_COLORS[a.malpractice.alertBucket] }}>
                      Malpractice cover: {BUCKET_LABELS[a.malpractice.alertBucket]}
                    </span>
                  )}
                  {a.cpd.alertBucket && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${BUCKET_COLORS[a.cpd.alertBucket]}22`, color: BUCKET_COLORS[a.cpd.alertBucket] }}>
                      CPD cycle: {BUCKET_LABELS[a.cpd.alertBucket]}
                    </span>
                  )}
                  {a.cpd.shortfall && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F0954A22] text-[#F0954A]">
                      CPD shortfall: {a.cpd.pointsCurrent}/{a.cpd.pointsRequired} pts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-[#3B9EFF]" />
          <h2 className="text-base font-semibold">Staff Register</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7A9CBC] text-xs border-b border-[#162440]">
              <th className="text-left py-2">Name</th>
              <th className="text-left py-2">Role</th>
              <th className="text-left py-2">License #</th>
              <th className="text-left py-2">License Expiry</th>
              <th className="text-left py-2">CPD</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {credentials.map(c => (
              <tr key={c.id} className="border-b border-[#162440] hover:bg-[#0C1528]">
                <td className="py-3 font-medium">{c.first_name} {c.last_name}</td>
                <td className="py-3 text-[#7A9CBC] capitalize">{c.role}</td>
                <td className="py-3 text-[#7A9CBC]">{c.license_number}</td>
                <td className="py-3 text-[#7A9CBC]">{c.license_expiry_date}</td>
                <td className="py-3 text-[#7A9CBC]">{c.cpd_points_current_cycle}/{c.cpd_points_required} pts</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: c.status === 'active' ? '#0AA98A22' : '#E8614D22',
                      color: c.status === 'active' ? '#0AA98A' : '#E8614D',
                    }}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
            {credentials.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#7A9CBC]">
                  <CheckCircle size={20} className="inline mr-2 text-[#0AA98A]" />
                  No staff credential records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <NewCredentialModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
