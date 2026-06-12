import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Bone, CheckCircle, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { orthopaedicsApi } from '../services/api';
import { useNotification } from './GlobalNotification';

const auth = () => ({
  token: localStorage.getItem('ehr_token') || '',
  tenantSlug: localStorage.getItem('ehr_tenant_slug') || '',
});

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

const urgencyBadge: Record<string, string> = {
  emergent: 'bg-red-100 text-red-800 border-red-200',
  urgent: 'bg-orange-100 text-orange-800 border-orange-200',
  semi_urgent: 'bg-amber-100 text-amber-800 border-amber-200',
  elective: 'bg-green-100 text-green-800 border-green-200',
};

type Tab = 'register' | 'fractures' | 'joint-replacement' | 'cdss';

const OrthopaedicsDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [tab, setTab] = useState<Tab>('register');
  const [register, setRegister] = useState<any[]>([]);
  const [fractures, setFractures] = useState<any[]>([]);
  const [joints, setJoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // CDSS form state
  const [dvtForm, setDvtForm] = useState({ clinicalDvt: false, alternativeDiagnosis: false, recentImmobilisation: false, activeCancer: false, paralysis: false, bedridden: false, tenderness: false, swelling: false, calfSwelling: false, pittingOedema: false, collateralVeins: false, previousDvt: false });
  const [dvtResult, setDvtResult] = useState<any>(null);
  const [rehabForm, setRehabForm] = useState({ procedureType: 'THA', barthelScore: 0, lvef: 0 });
  const [rehabResult, setRehabResult] = useState<any>(null);
  const [newFracture, setNewFracture] = useState({ patientId: '', fractureType: '', fractureLocation: '', gustiloGrade: '', side: 'left', mechanism: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { token, tenantSlug } = auth();
    if (!token || !tenantSlug) return;
    setLoading(true);
    try {
      const [reg, frac, jr] = await Promise.allSettled([
        orthopaedicsApi.getRegister(token, tenantSlug, { limit: 50 }),
        orthopaedicsApi.getFractures(token, tenantSlug, { limit: 50 }),
        orthopaedicsApi.getJointReplacements(token, tenantSlug, { limit: 50 }),
      ]);
      if (reg.status === 'fulfilled') setRegister(reg.value.data?.data || reg.value.data || []);
      if (frac.status === 'fulfilled') setFractures(frac.value.data?.data || frac.value.data || []);
      if (jr.status === 'fulfilled') setJoints(jr.value.data?.data || jr.value.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDvtRisk = async () => {
    const { token, tenantSlug } = auth();
    try {
      const res = await orthopaedicsApi.dvtRisk(dvtForm, token, tenantSlug);
      setDvtResult(res.data);
      showSuccess('DVT Risk', 'Score calculated');
    } catch { showError('Error', 'DVT risk calculation failed'); }
  };

  const handleRehabPlan = async () => {
    const { token, tenantSlug } = auth();
    try {
      const res = await orthopaedicsApi.rehabPlan(rehabForm, token, tenantSlug);
      setRehabResult(res.data);
      showSuccess('Rehab Plan', 'Generated');
    } catch { showError('Error', 'Rehab plan failed'); }
  };

  const handleRecordFracture = async (e: React.FormEvent) => {
    e.preventDefault();
    const { token, tenantSlug } = auth();
    setSaving(true);
    try {
      await orthopaedicsApi.recordFracture(newFracture, token, tenantSlug);
      showSuccess('Saved', 'Fracture record created');
      setNewFracture({ patientId: '', fractureType: '', fractureLocation: '', gustiloGrade: '', side: 'left', mechanism: '' });
      load();
    } catch { showError('Error', 'Failed to save fracture'); } finally { setSaving(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'register', label: 'Patient Register' },
    { key: 'fractures', label: 'Fractures' },
    { key: 'joint-replacement', label: 'Joint Replacement' },
    { key: 'cdss', label: 'CDSS Tools' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl">
            <Bone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Orthopaedics</h2>
            <p className="text-sm text-slate-500">Fracture management · Joint replacement · Rehab planning</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Patients in Register', value: register.length, icon: Activity, color: 'text-slate-700' },
          { label: 'Fracture Records', value: fractures.length, icon: AlertTriangle, color: 'text-orange-600' },
          { label: 'Joint Replacements', value: joints.length, icon: CheckCircle, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${tab === t.key ? 'border-slate-700 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'register' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Diagnosis</th>
                <th className="px-4 py-3 text-left">Enrolled</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {register.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No patients in register</td></tr>
              )}
              {register.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.patientNumber || r.patient_number || r.patientId}</td>
                  <td className="px-4 py-3 text-slate-600">{r.primaryDiagnosis || r.primary_diagnosis || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(r.enrollmentDate || r.enrollment_date)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      {r.careStatus || r.care_status || 'active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'fractures' && (
        <div className="space-y-6">
          {/* Record form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Record Fracture</h4>
            <form onSubmit={handleRecordFracture} className="grid grid-cols-2 gap-4">
              {[
                { label: 'Patient ID', key: 'patientId', required: true },
                { label: 'Fracture Type', key: 'fractureType', required: true },
                { label: 'Location', key: 'fractureLocation', required: true },
                { label: 'Gustilo Grade', key: 'gustiloGrade' },
                { label: 'Mechanism', key: 'mechanism' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                    value={(newFracture as any)[f.key]} required={f.required}
                    onChange={e => setNewFracture(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Side</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                  value={newFracture.side} onChange={e => setNewFracture(p => ({ ...p, side: e.target.value }))}>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="bilateral">Bilateral</option>
                </select>
              </div>
              <div className="col-span-2 flex justify-end">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Fracture'}
                </button>
              </div>
            </form>
          </div>

          {/* Fractures list */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Gustilo</th>
                  <th className="px-4 py-3 text-left">Urgency</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fractures.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No fracture records</td></tr>}
                {fractures.map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{f.patientId || f.patient_id}</td>
                    <td className="px-4 py-3 text-slate-600">{f.fractureType || f.fracture_type}</td>
                    <td className="px-4 py-3 text-slate-600">{f.fractureLocation || f.fracture_location}</td>
                    <td className="px-4 py-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100">{f.gustiloGrade || f.gustilo_grade || '—'}</span></td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${urgencyBadge[f.urgency] || 'bg-slate-100 text-slate-600'}`}>
                        {f.urgency || 'elective'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmt(f.fractureDate || f.fracture_date || f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'joint-replacement' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Procedure</th>
                <th className="px-4 py-3 text-left">Side</th>
                <th className="px-4 py-3 text-left">Surgery Date</th>
                <th className="px-4 py-3 text-left">Outcome Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {joints.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No joint replacement records</td></tr>}
              {joints.map((j: any) => (
                <tr key={j.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{j.patientId || j.patient_id}</td>
                  <td className="px-4 py-3">{j.procedureType || j.procedure_type}</td>
                  <td className="px-4 py-3">{j.side}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(j.surgeryDate || j.surgery_date)}</td>
                  <td className="px-4 py-3">{j.oxfordScore || j.oxford_score || j.harisHipScore || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cdss' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* DVT Risk (Wells Score) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-slate-800">Wells DVT Score</h4>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {[
                ['Active cancer', 'activeCancer'],
                ['Paralysis / plaster cast', 'paralysis'],
                ['Bedridden ≥3 days / surgery in past 4wk', 'bedridden'],
                ['Localised tenderness along veins', 'tenderness'],
                ['Entire leg swollen', 'swelling'],
                ['Calf swelling >3 cm', 'calfSwelling'],
                ['Pitting oedema', 'pittingOedema'],
                ['Collateral veins', 'collateralVeins'],
                ['Previous DVT', 'previousDvt'],
                ['Alternative diagnosis as likely', 'alternativeDiagnosis'],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={(dvtForm as any)[key]}
                    onChange={e => setDvtForm(p => ({ ...p, [key]: e.target.checked }))} />
                  <span className="text-slate-700">{label}</span>
                </label>
              ))}
            </div>
            <button onClick={handleDvtRisk} className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
              Calculate DVT Risk
            </button>
            {dvtResult && (
              <div className={`p-4 rounded-lg border text-sm ${dvtResult.risk === 'high' ? 'bg-red-50 border-red-200 text-red-900' : dvtResult.risk === 'moderate' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
                <p className="font-bold mb-1">Score: {dvtResult.score} — {String(dvtResult.risk || '').toUpperCase()} RISK</p>
                <p>{dvtResult.recommendation}</p>
              </div>
            )}
          </div>

          {/* Rehab Plan */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-slate-800">Rehab Plan Generator</h4>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Procedure</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={rehabForm.procedureType} onChange={e => setRehabForm(p => ({ ...p, procedureType: e.target.value }))}>
                  <option value="THA">THA (Hip Arthroplasty)</option>
                  <option value="TKA">TKA (Knee Arthroplasty)</option>
                  <option value="FRACTURE">Fracture</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Barthel Index Score</label>
                <input type="number" min={0} max={100} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={rehabForm.barthelScore} onChange={e => setRehabForm(p => ({ ...p, barthelScore: Number(e.target.value) }))} />
              </div>
            </div>
            <button onClick={handleRehabPlan} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
              Generate Rehab Plan
            </button>
            {rehabResult && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 space-y-2">
                <p className="font-bold">Phase: {rehabResult.currentPhase || rehabResult.phase}</p>
                {rehabResult.goals && <ul className="list-disc list-inside space-y-1">{rehabResult.goals.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>}
                {rehabResult.interventions && <ul className="list-disc list-inside space-y-1">{rehabResult.interventions.slice(0, 4).map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrthopaedicsDashboard;
