import React, { useState, useEffect, useCallback } from 'react';
import { cdssApi } from '../services/api';
import { AlertTriangle, Plus, FlaskConical, Pill, Users, BarChart3, Activity } from 'lucide-react';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

const SPECIES_COLOURS: Record<string, string> = {
  falciparum: 'bg-red-100 text-red-800',
  vivax: 'bg-orange-100 text-orange-800',
  malariae: 'bg-yellow-100 text-yellow-800',
  ovale: 'bg-blue-100 text-blue-800',
  knowlesi: 'bg-purple-100 text-purple-800',
  mixed: 'bg-rose-100 text-rose-800',
  unknown: 'bg-gray-100 text-gray-700',
};

const RESULT_COLOURS: Record<string, string> = {
  positive: 'bg-red-100 text-red-800',
  negative: 'bg-green-100 text-green-800',
  indeterminate: 'bg-yellow-100 text-yellow-800',
};

export default function MalariaDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [tab, setTab] = useState<'overview' | 'tests' | 'treatment' | 'contacts'>('overview');
  const [cases, setCases] = useState<any[]>([]);
  const [activeCase, setActiveCase] = useState<any | null>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [severityResult, setSeverityResult] = useState<any | null>(null);
  const [treatmentRec, setTreatmentRec] = useState<any | null>(null);

  // Forms
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseDto, setCaseDto] = useState<any>({ caseType: 'uncomplicated', species: 'falciparum' });
  const [showTestForm, setShowTestForm] = useState(false);
  const [testDto, setTestDto] = useState<any>({ testType: 'RDT', result: 'positive', gametocytes: false });
  const [showTxForm, setShowTxForm] = useState(false);
  const [txDto, setTxDto] = useState<any>({ regimen: 'AL', startDate: new Date().toISOString().slice(0, 10), dayOneObserved: false });
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactDto, setContactDto] = useState<any>({ contactName: '', rdtResult: 'pending', treated: false, itnProvided: false });
  const [sevDto, setSevDto] = useState<any>({});
  const [recDto, setRecDto] = useState<any>({ species: 'falciparum', case_type: 'uncomplicated', pregnant: false });

  const loadCases = useCallback(async () => {
    const data = await cdssApi.listMalariaCases(patientId, tenantSubdomain);
    setCases(data);
    if (data.length > 0 && !activeCase) setActiveCase(data[0]);
  }, [patientId, tenantSubdomain, activeCase]);

  const loadCaseDetails = useCallback(async (caseId: string) => {
    const [t, tx, c] = await Promise.all([
      cdssApi.getMalariaTests(caseId, tenantSubdomain),
      cdssApi.getMalariaTreatments(caseId, tenantSubdomain),
      cdssApi.getMalariaContacts(caseId, tenantSubdomain),
    ]);
    setTests(t);
    setTreatments(tx);
    setContacts(c);
  }, [tenantSubdomain]);

  useEffect(() => { loadCases(); }, [loadCases]);
  useEffect(() => { if (activeCase) loadCaseDetails(activeCase.id); }, [activeCase, loadCaseDetails]);

  async function submitCase() {
    const c = await cdssApi.registerMalariaCase(tenantSubdomain, { ...caseDto, patientId, registeredBy: providerId });
    setActiveCase(c);
    setShowCaseForm(false);
    setCaseDto({ caseType: 'uncomplicated', species: 'falciparum' });
    loadCases();
  }

  async function submitTest() {
    await cdssApi.addMalariaTest(activeCase.id, tenantSubdomain, { ...testDto, patientId, performedBy: providerId });
    setShowTestForm(false);
    setTestDto({ testType: 'RDT', result: 'positive', gametocytes: false });
    loadCaseDetails(activeCase.id);
  }

  async function submitTreatment() {
    await cdssApi.startMalariaTreatment(activeCase.id, tenantSubdomain, { ...txDto, patientId, prescribedBy: providerId });
    setShowTxForm(false);
    setTxDto({ regimen: 'AL', startDate: new Date().toISOString().slice(0, 10), dayOneObserved: false });
    loadCaseDetails(activeCase.id);
  }

  async function submitContact() {
    await cdssApi.addMalariaContact(activeCase.id, tenantSubdomain, contactDto);
    setShowContactForm(false);
    setContactDto({ contactName: '', rdtResult: 'pending', treated: false, itnProvided: false });
    loadCaseDetails(activeCase.id);
  }

  async function runSeverityScore() {
    const result = await cdssApi.scoreMalariaSeverity(sevDto);
    setSeverityResult(result);
  }

  async function runTreatmentRec() {
    const result = await cdssApi.recommendMalariaTreatment(recDto);
    setTreatmentRec(result);
  }

  return (
    <div className="space-y-4">
      {/* Case selector + register */}
      <div className="flex items-center gap-3 flex-wrap">
        {cases.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCase(c)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              activeCase?.id === c.id ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
            }`}
          >
            {new Date(c.registeredAt).toLocaleDateString()} · {c.species || 'unknown'} · {c.caseType}
          </button>
        ))}
        <button
          onClick={() => setShowCaseForm(v => !v)}
          className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700"
        >
          <Plus className="h-4 w-4" /> New Case
        </button>
      </div>

      {/* New case form */}
      {showCaseForm && (
        <div className="bg-white border border-red-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Register Malaria Case</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Case Type</label>
              <select value={caseDto.caseType} onChange={e => setCaseDto((p: any) => ({ ...p, caseType: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                <option value="uncomplicated">Uncomplicated</option>
                <option value="severe">Severe</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Species</label>
              <select value={caseDto.species} onChange={e => setCaseDto((p: any) => ({ ...p, species: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                {['falciparum','vivax','malariae','ovale','knowlesi','mixed','unknown'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Haemoglobin (g/dL)</label>
              <input type="number" step="0.1" value={caseDto.haemoglobin || ''} onChange={e => setCaseDto((p: any) => ({ ...p, haemoglobin: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Parasitaemia (%)</label>
              <input type="number" step="0.01" value={caseDto.parasitaemia || ''} onChange={e => setCaseDto((p: any) => ({ ...p, parasitaemia: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">GCS (if impaired)</label>
              <input type="number" min={3} max={15} value={caseDto.gcs || ''} onChange={e => setCaseDto((p: any) => ({ ...p, gcs: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submitCase} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700">Register</button>
            <button onClick={() => setShowCaseForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* No cases yet */}
      {cases.length === 0 && !showCaseForm && (
        <div className="text-center py-10 text-gray-400">
          <Activity className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No malaria cases registered for this patient.</p>
        </div>
      )}

      {activeCase && (
        <>
          {/* Active case summary */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-semibold">{activeCase.caseType === 'severe' ? '⚠ SEVERE' : 'Uncomplicated'} Malaria</p>
                <p className="text-xs text-gray-500">{new Date(activeCase.registeredAt).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {activeCase.species && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SPECIES_COLOURS[activeCase.species] || 'bg-gray-100 text-gray-700'}`}>
                    P. {activeCase.species}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeCase.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {activeCase.status}
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              {activeCase.haemoglobin && (
                <div>
                  <p className="text-xs text-gray-500">Hb</p>
                  <p className={`font-semibold ${activeCase.haemoglobin < 7 ? 'text-red-600' : ''}`}>{activeCase.haemoglobin} g/dL</p>
                </div>
              )}
              {activeCase.parasitaemia && (
                <div>
                  <p className="text-xs text-gray-500">Parasitaemia</p>
                  <p className={`font-semibold ${activeCase.parasitaemia > 5 ? 'text-red-600' : ''}`}>{activeCase.parasitaemia}%</p>
                </div>
              )}
              {activeCase.gcs && (
                <div>
                  <p className="text-xs text-gray-500">GCS</p>
                  <p className={`font-semibold ${activeCase.gcs < 11 ? 'text-red-600' : ''}`}>{activeCase.gcs}/15</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              ['overview',   'CDSS Tools',  Activity],
              ['tests',      'Tests',        FlaskConical],
              ['treatment',  'Treatment',    Pill],
              ['contacts',   'Contacts',     Users],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === key ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── CDSS Tools ────────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Severity Scorer */}
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" /> WHO Severity Scorer
                </p>
                <div className="space-y-2">
                  {[
                    ['impaired_consciousness','Impaired consciousness (GCS < 11)'],
                    ['prostration','Prostration / extreme weakness'],
                    ['multiple_convulsions','Multiple convulsions (>2/24h)'],
                    ['respiratory_distress','Respiratory distress'],
                    ['abnormal_bleeding','Abnormal bleeding'],
                    ['jaundice','Jaundice'],
                    ['haemoglobinuria','Haemoglobinuria'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={!!sevDto[key]} onChange={e => setSevDto((p: any) => ({ ...p, [key]: e.target.checked }))} className="accent-red-600" />
                      {label}
                    </label>
                  ))}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      ['haemoglobin','Hb (g/dL)'],
                      ['blood_glucose','BG (mmol/L)'],
                      ['creatinine','Creatinine (µmol/L)'],
                      ['parasitaemia_percent','Parasitaemia (%)'],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="text-xs text-gray-500">{label}</label>
                        <input type="number" step="0.1" value={sevDto[key] || ''} onChange={e => setSevDto((p: any) => ({ ...p, [key]: +e.target.value || undefined }))} className="w-full border rounded px-2 py-0.5 text-sm mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={runSeverityScore} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700">Score Severity</button>
                {severityResult && (
                  <div className={`rounded-lg p-3 ${severityResult.severity_class === 'severe' ? 'bg-red-50 border border-red-300' : 'bg-green-50 border border-green-300'}`}>
                    <p className={`font-bold text-sm ${severityResult.severity_class === 'severe' ? 'text-red-800' : 'text-green-800'}`}>
                      {severityResult.severity_class?.toUpperCase()} — Score {severityResult.severity_score}
                    </p>
                    {severityResult.criteria_met?.map((c: string, i: number) => (
                      <p key={i} className="text-xs text-red-700 mt-0.5">• {c}</p>
                    ))}
                    {severityResult.recommendations?.map((r: string, i: number) => (
                      <p key={i} className="text-xs text-gray-700 mt-0.5">→ {r}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Treatment Recommender */}
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Pill className="h-4 w-4 text-orange-600" /> Treatment Recommender
                </p>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Species</label>
                      <select value={recDto.species} onChange={e => setRecDto((p: any) => ({ ...p, species: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                        {['falciparum','vivax','malariae','ovale','mixed','unknown'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Case Type</label>
                      <select value={recDto.case_type} onChange={e => setRecDto((p: any) => ({ ...p, case_type: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                        <option value="uncomplicated">Uncomplicated</option>
                        <option value="severe">Severe</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Age (years)</label>
                      <input type="number" value={recDto.age_years || ''} onChange={e => setRecDto((p: any) => ({ ...p, age_years: +e.target.value || undefined }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Weight (kg)</label>
                      <input type="number" value={recDto.weight_kg || ''} onChange={e => setRecDto((p: any) => ({ ...p, weight_kg: +e.target.value || undefined }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {[
                      ['pregnant','Pregnant'],
                      ['g6pd_deficient','G6PD deficient'],
                      ['prior_treatment_failure','Prior treatment failure'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1 text-sm cursor-pointer">
                        <input type="checkbox" checked={!!recDto[key]} onChange={e => setRecDto((p: any) => ({ ...p, [key]: e.target.checked }))} className="accent-orange-600" />
                        {label}
                      </label>
                    ))}
                  </div>
                  {recDto.pregnant && (
                    <div>
                      <label className="text-xs text-gray-500">Trimester</label>
                      <select value={recDto.trimester || ''} onChange={e => setRecDto((p: any) => ({ ...p, trimester: +e.target.value || undefined }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                        <option value="">Select…</option>
                        <option value={1}>1st</option>
                        <option value={2}>2nd</option>
                        <option value={3}>3rd</option>
                      </select>
                    </div>
                  )}
                </div>
                <button onClick={runTreatmentRec} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-orange-700">Recommend</button>
                {treatmentRec && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
                    <p className="font-bold text-sm text-orange-900">{treatmentRec.regimen_label}</p>
                    <p className="text-xs text-orange-700">Duration: {treatmentRec.duration_days} days · Follow-up: days {treatmentRec.follow_up_days?.join(', ')}</p>
                    {treatmentRec.warnings?.map((w: string, i: number) => (
                      <p key={i} className="text-xs text-red-700 bg-red-50 rounded px-2 py-0.5">⚠ {w}</p>
                    ))}
                    {treatmentRec.notes?.map((n: string, i: number) => (
                      <p key={i} className="text-xs text-orange-800">• {n}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tests ─────────────────────────────────────────────────────── */}
          {tab === 'tests' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Diagnostic Tests ({tests.length})</p>
                <button onClick={() => setShowTestForm(v => !v)} className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700">
                  <Plus className="h-4 w-4" /> Add Test
                </button>
              </div>
              {showTestForm && (
                <div className="bg-white border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Test Type</label>
                      <select value={testDto.testType} onChange={e => setTestDto((p: any) => ({ ...p, testType: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                        {['RDT','microscopy','PCR','LAMP'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Result</label>
                      <select value={testDto.result} onChange={e => setTestDto((p: any) => ({ ...p, result: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                        {['positive','negative','indeterminate'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Species (if identified)</label>
                      <select value={testDto.species || ''} onChange={e => setTestDto((p: any) => ({ ...p, species: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                        <option value="">Unknown</option>
                        {['falciparum','vivax','malariae','ovale','knowlesi','mixed'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Parasite Density (p/µL)</label>
                      <input type="number" value={testDto.parasiteDensity || ''} onChange={e => setTestDto((p: any) => ({ ...p, parasiteDensity: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="gam" checked={testDto.gametocytes} onChange={e => setTestDto((p: any) => ({ ...p, gametocytes: e.target.checked }))} />
                      <label htmlFor="gam" className="text-sm">Gametocytes present</label>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Lab Reference</label>
                      <input value={testDto.labReference || ''} onChange={e => setTestDto((p: any) => ({ ...p, labReference: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitTest} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700">Save</button>
                    <button onClick={() => setShowTestForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
              {tests.length === 0 && <p className="text-sm text-gray-400">No tests recorded.</p>}
              {tests.map(t => (
                <div key={t.id} className="bg-white border rounded-lg p-3 flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold">{t.testType}</p>
                    <p className="text-xs text-gray-500">{new Date(t.testDate).toLocaleDateString()}</p>
                    {t.species && <p className="text-xs text-gray-600">P. {t.species}</p>}
                    {t.parasiteDensity && <p className="text-xs text-gray-600">{t.parasiteDensity} p/µL</p>}
                    {t.gametocytes && <p className="text-xs text-orange-700">Gametocytes present</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${RESULT_COLOURS[t.result] || 'bg-gray-100 text-gray-700'}`}>{t.result}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Treatment ─────────────────────────────────────────────────── */}
          {tab === 'treatment' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Treatments ({treatments.length})</p>
                <button onClick={() => setShowTxForm(v => !v)} className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700">
                  <Plus className="h-4 w-4" /> Add Treatment
                </button>
              </div>
              {showTxForm && (
                <div className="bg-white border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Regimen</label>
                      <select value={txDto.regimen} onChange={e => setTxDto((p: any) => ({ ...p, regimen: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                        {['AL','ASAQ','IV_artesunate','IM_artesunate','quinine_IV','quinine_oral','primaquine','chloroquine','SP_IPTp','other'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Start Date</label>
                      <input type="date" value={txDto.startDate} onChange={e => setTxDto((p: any) => ({ ...p, startDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Duration (days)</label>
                      <input type="number" value={txDto.durationDays || ''} onChange={e => setTxDto((p: any) => ({ ...p, durationDays: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">ACT Lot Number</label>
                      <input value={txDto.actLotNumber || ''} onChange={e => setTxDto((p: any) => ({ ...p, actLotNumber: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="d1obs" checked={txDto.dayOneObserved} onChange={e => setTxDto((p: any) => ({ ...p, dayOneObserved: e.target.checked }))} />
                      <label htmlFor="d1obs" className="text-sm">Day-1 dose observed</label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitTreatment} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700">Save</button>
                    <button onClick={() => setShowTxForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
              {treatments.length === 0 && <p className="text-sm text-gray-400">No treatments recorded.</p>}
              {treatments.map(tx => (
                <div key={tx.id} className="bg-white border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold">{tx.regimen}{tx.regimenLabel ? ` — ${tx.regimenLabel}` : ''}</p>
                      <p className="text-xs text-gray-500">Started {tx.startDate} · {tx.durationDays || '?'}d</p>
                    </div>
                    {tx.treatmentOutcome && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{tx.treatmentOutcome?.replace(/_/g,' ')}</span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-gray-500">
                    {tx.dayOneObserved && <span className="text-green-700">✓ Day-1 observed</span>}
                    {tx.actLotNumber && <span>Lot: {tx.actLotNumber}</span>}
                  </div>
                  {/* Follow-up grid */}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[3,7,14,28].map(d => {
                      const fu = tx[`followUpDay${d}`];
                      return (
                        <div key={d} className={`rounded p-1.5 text-center text-xs ${fu ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-dashed border-gray-200'}`}>
                          <p className="font-medium">Day {d}</p>
                          {fu ? (
                            <p className="text-green-700">{fu.parasitaemia !== undefined ? `${fu.parasitaemia}%` : '✓'}</p>
                          ) : (
                            <p className="text-gray-400">pending</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Contacts ──────────────────────────────────────────────────── */}
          {tab === 'contacts' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Household Contacts ({contacts.length})</p>
                <button onClick={() => setShowContactForm(v => !v)} className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700">
                  <Plus className="h-4 w-4" /> Add Contact
                </button>
              </div>
              {showContactForm && (
                <div className="bg-white border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <input value={contactDto.contactName} onChange={e => setContactDto((p: any) => ({ ...p, contactName: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Relationship</label>
                      <input value={contactDto.relationship || ''} onChange={e => setContactDto((p: any) => ({ ...p, relationship: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Age (years)</label>
                      <input type="number" value={contactDto.ageYears || ''} onChange={e => setContactDto((p: any) => ({ ...p, ageYears: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">RDT Result</label>
                      <select value={contactDto.rdtResult} onChange={e => setContactDto((p: any) => ({ ...p, rdtResult: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                        {['positive','negative','pending','not_done'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2"><input type="checkbox" checked={contactDto.treated} onChange={e => setContactDto((p: any) => ({ ...p, treated: e.target.checked }))} /><label className="text-sm">Treated</label></div>
                    <div className="flex items-center gap-2"><input type="checkbox" checked={contactDto.itnProvided} onChange={e => setContactDto((p: any) => ({ ...p, itnProvided: e.target.checked }))} /><label className="text-sm">ITN provided</label></div>
                    <div className="flex items-center gap-2"><input type="checkbox" checked={contactDto.irsApplied || false} onChange={e => setContactDto((p: any) => ({ ...p, irsApplied: e.target.checked }))} /><label className="text-sm">IRS applied</label></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitContact} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700">Save</button>
                    <button onClick={() => setShowContactForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
              {contacts.length === 0 && <p className="text-sm text-gray-400">No contacts recorded.</p>}
              {contacts.map(c => (
                <div key={c.id} className="bg-white border rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold">{c.contactName}</p>
                    <p className="text-xs text-gray-500">{c.relationship}{c.ageYears ? ` · ${c.ageYears}y` : ''}</p>
                    <div className="flex gap-2 mt-1">
                      {c.treated && <span className="text-xs text-green-700">✓ Treated</span>}
                      {c.itnProvided && <span className="text-xs text-blue-700">✓ ITN</span>}
                      {c.irsApplied && <span className="text-xs text-purple-700">✓ IRS</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${RESULT_COLOURS[c.rdtResult] || 'bg-gray-100 text-gray-600'}`}>
                    RDT: {c.rdtResult}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
