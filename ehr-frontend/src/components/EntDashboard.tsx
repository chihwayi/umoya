import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Brain, CheckCircle, Ear, Plus, RefreshCw } from 'lucide-react';
import { entApi } from '../services/api';
import { useNotification } from './GlobalNotification';

const auth = () => ({
  token: localStorage.getItem('ehr_token') || '',
  tenantSlug: localStorage.getItem('ehr_tenant_slug') || '',
});

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

type Tab = 'visits' | 'audiograms' | 'cdss';

const EntDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [tab, setTab] = useState<Tab>('visits');
  const [visits, setVisits] = useState<any[]>([]);
  const [audiograms, setAudiograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Centor score form
  const [centorForm, setCentorForm] = useState({ temperature: 38.0, tonsillExudate: false, anteriorCervicalLymphadenopathy: false, absenceCough: false, age: 25 });
  const [centorResult, setCentorResult] = useState<any>(null);

  // Rhinosinusitis form
  const [rhinoForm, setRhinoForm] = useState({ symptoms: [] as string[], duration: 7, fever: false, purulentDischarge: false });
  const [rhinoResult, setRhinoResult] = useState<any>(null);

  // New visit form
  const [newVisit, setNewVisit] = useState({ patientId: '', visitType: 'new_patient', chiefComplaint: '', tympanicMembraneFinding: '', nasalFinding: '', tonsilGrading: '' });

  // New audiogram form
  const [newAudiogram, setNewAudiogram] = useState({ patientId: '', ear: 'right', rightPta: '', leftPta: '', indication: '' });

  const load = useCallback(async () => {
    const { token, tenantSlug } = auth();
    if (!token || !tenantSlug) return;
    setLoading(true);
    try {
      const [v, a] = await Promise.allSettled([
        entApi.getVisits(token, tenantSlug, { limit: 50 }),
        entApi.getAudiograms(token, tenantSlug, { limit: 50 }),
      ]);
      if (v.status === 'fulfilled') setVisits(v.value.data?.data || v.value.data || []);
      if (a.status === 'fulfilled') setAudiograms(a.value.data?.data || a.value.data || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCentorScore = async () => {
    const { token, tenantSlug } = auth();
    try {
      const res = await entApi.tonsillitisTriage(centorForm, token, tenantSlug);
      setCentorResult(res.data);
      showSuccess('Centor Score', 'Calculated');
    } catch { showError('Error', 'Centor score failed'); }
  };

  const handleRhinoTriage = async () => {
    const { token, tenantSlug } = auth();
    try {
      const res = await entApi.rhinosinusitisTriage(rhinoForm, token, tenantSlug);
      setRhinoResult(res.data);
      showSuccess('Rhinosinusitis', 'Assessment complete');
    } catch { showError('Error', 'Rhinosinusitis triage failed'); }
  };

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { token, tenantSlug } = auth();
    setSaving(true);
    try {
      await entApi.createVisit(newVisit, token, tenantSlug);
      showSuccess('Saved', 'ENT visit recorded');
      setNewVisit({ patientId: '', visitType: 'new_patient', chiefComplaint: '', tympanicMembraneFinding: '', nasalFinding: '', tonsilGrading: '' });
      load();
    } catch { showError('Error', 'Failed to save visit'); } finally { setSaving(false); }
  };

  const handleSaveAudiogram = async (e: React.FormEvent) => {
    e.preventDefault();
    const { token, tenantSlug } = auth();
    setSaving(true);
    try {
      await entApi.recordAudiogram({ ...newAudiogram, rightPta: newAudiogram.rightPta ? Number(newAudiogram.rightPta) : undefined, leftPta: newAudiogram.leftPta ? Number(newAudiogram.leftPta) : undefined }, token, tenantSlug);
      showSuccess('Saved', 'Audiogram recorded');
      setNewAudiogram({ patientId: '', ear: 'right', rightPta: '', leftPta: '', indication: '' });
      load();
    } catch { showError('Error', 'Failed to save audiogram'); } finally { setSaving(false); }
  };

  const hearingClass = (pta?: number) => {
    if (!pta) return '—';
    if (pta <= 25) return 'Normal';
    if (pta <= 40) return 'Mild';
    if (pta <= 55) return 'Moderate';
    if (pta <= 70) return 'Moderately Severe';
    if (pta <= 90) return 'Severe';
    return 'Profound';
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'visits', label: 'ENT Visits' },
    { key: 'audiograms', label: 'Audiograms' },
    { key: 'cdss', label: 'CDSS Tools' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-teal-600 to-cyan-700 rounded-xl">
            <Ear className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">ENT (Ear, Nose & Throat)</h2>
            <p className="text-sm text-slate-500">Visits · Audiometry · Tonsillitis & Rhinosinusitis CDSS</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Visits</p>
          <p className="text-2xl font-bold text-slate-900">{visits.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Audiograms</p>
          <p className="text-2xl font-bold text-teal-700">{audiograms.length}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${tab === t.key ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'visits' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> New ENT Visit</h4>
            <form onSubmit={handleSaveVisit} className="grid grid-cols-2 gap-4">
              {[
                { label: 'Patient ID', key: 'patientId', required: true },
                { label: 'Chief Complaint', key: 'chiefComplaint', required: true },
                { label: 'Tympanic Membrane Finding', key: 'tympanicMembraneFinding' },
                { label: 'Nasal Finding', key: 'nasalFinding' },
                { label: 'Tonsil Grading (0-4)', key: 'tonsilGrading' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                    value={(newVisit as any)[f.key]} required={f.required}
                    onChange={e => setNewVisit(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="col-span-2 flex justify-end">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Visit'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Chief Complaint</th>
                  <th className="px-4 py-3 text-left">TM Finding</th>
                  <th className="px-4 py-3 text-left">Tonsil Grade</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No visits recorded</td></tr>}
                {visits.map((v: any) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{v.patientId || v.patient_id}</td>
                    <td className="px-4 py-3 text-slate-600">{v.chiefComplaint || v.chief_complaint || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{v.tympanicMembraneFinding || v.tympanic_membrane_finding || '—'}</td>
                    <td className="px-4 py-3">{v.tonsilGrading || v.tonsil_grading || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{fmt(v.visitDate || v.visit_date || v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audiograms' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Record Audiogram</h4>
            <form onSubmit={handleSaveAudiogram} className="grid grid-cols-2 gap-4">
              {[
                { label: 'Patient ID', key: 'patientId', required: true },
                { label: 'Right PTA (dB HL)', key: 'rightPta', type: 'number' },
                { label: 'Left PTA (dB HL)', key: 'leftPta', type: 'number' },
                { label: 'Indication', key: 'indication' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                  <input type={f.type || 'text'} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                    value={(newAudiogram as any)[f.key]} required={f.required}
                    onChange={e => setNewAudiogram(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="col-span-2 flex justify-end">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Audiogram'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Right PTA</th>
                  <th className="px-4 py-3 text-left">Left PTA</th>
                  <th className="px-4 py-3 text-left">Classification</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {audiograms.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audiograms recorded</td></tr>}
                {audiograms.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{a.patientId || a.patient_id}</td>
                    <td className="px-4 py-3">{a.rightPta || a.right_pta || '—'} dB</td>
                    <td className="px-4 py-3">{a.leftPta || a.left_pta || '—'} dB</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200">
                        {a.classification || hearingClass(a.rightPta || a.right_pta)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmt(a.testDate || a.test_date || a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cdss' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Centor Score */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-teal-700" />
              <h4 className="font-semibold text-slate-800">Centor Score — Tonsillitis Triage</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Temperature (°C)</label>
                <input type="number" step="0.1" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={centorForm.temperature} onChange={e => setCentorForm(p => ({ ...p, temperature: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Age (years)</label>
                <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={centorForm.age} onChange={e => setCentorForm(p => ({ ...p, age: Number(e.target.value) }))} />
              </div>
              {[
                ['Tonsillar exudate', 'tonsillExudate'],
                ['Anterior cervical lymphadenopathy', 'anteriorCervicalLymphadenopathy'],
                ['Absence of cough', 'absenceCough'],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={(centorForm as any)[key]}
                    onChange={e => setCentorForm(p => ({ ...p, [key]: e.target.checked }))} />
                  <span className="text-slate-700">{label}</span>
                </label>
              ))}
            </div>
            <button onClick={handleCentorScore} className="w-full py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800">
              Calculate Score
            </button>
            {centorResult && (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-900 space-y-1">
                <p className="font-bold">Score: {centorResult.score}</p>
                <p>{centorResult.recommendation}</p>
                {centorResult.antibioticRequired !== undefined && (
                  <p className={centorResult.antibioticRequired ? 'text-red-700 font-semibold' : 'text-green-700'}>
                    {centorResult.antibioticRequired ? 'Antibiotic indicated' : 'No antibiotic needed'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Rhinosinusitis */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-slate-800">Rhinosinusitis Triage</h4>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Duration (days)</label>
                <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={rhinoForm.duration} onChange={e => setRhinoForm(p => ({ ...p, duration: Number(e.target.value) }))} />
              </div>
              {[
                ['Fever', 'fever'],
                ['Purulent nasal discharge', 'purulentDischarge'],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={(rhinoForm as any)[key]}
                    onChange={e => setRhinoForm(p => ({ ...p, [key]: e.target.checked }))} />
                  <span className="text-slate-700">{label}</span>
                </label>
              ))}
            </div>
            <button onClick={handleRhinoTriage} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
              Assess
            </button>
            {rhinoResult && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 space-y-1">
                <p className="font-bold">{rhinoResult.classification}</p>
                <p>{rhinoResult.recommendation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntDashboard;
