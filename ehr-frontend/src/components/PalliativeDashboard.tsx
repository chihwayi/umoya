import React, { useEffect, useState } from 'react';
import {
  getPalliativeAssessments, addPalliativeAssessment,
  getPalliativeEsas, addPalliativeEsas,
  getPalliativeGoals, addPalliativeGoals,
  getPalliativeDirectives, addPalliativeDirective,
  getPalliativeMedReviews, addPalliativeMedReview,
  palliativePrognosis, palliativeOpioidConvert, palliativeSymptomManage,
} from '../services/api';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

type Tab = 'overview' | 'assessment' | 'esas' | 'goals' | 'directives' | 'medications';

const ESAS_ITEMS = [
  { key: 'painScore', label: 'Pain' },
  { key: 'tirednessScore', label: 'Tiredness' },
  { key: 'nauseaScore', label: 'Nausea' },
  { key: 'depressionScore', label: 'Depression' },
  { key: 'anxietyScore', label: 'Anxiety' },
  { key: 'drowsinessScore', label: 'Drowsiness' },
  { key: 'appetiteScore', label: 'Appetite' },
  { key: 'wellbeingScore', label: 'Wellbeing' },
  { key: 'dyspnoeaScore', label: 'Dyspnoea' },
];

const ECOG_LABELS = ['0 – Fully active', '1 – Restricted strenuous activity', '2 – Ambulatory, self-care', '3 – Limited self-care', '4 – Completely disabled'];

export default function PalliativeDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  // Data
  const [assessments, setAssessments] = useState<any[]>([]);
  const [esasScores, setEsasScores] = useState<any[]>([]);
  const [goals, setGoals] = useState<any | null>(null);
  const [directives, setDirectives] = useState<any[]>([]);
  const [medReviews, setMedReviews] = useState<any[]>([]);

  // CDSS results
  const [prognosisResult, setPrognosisResult] = useState<any>(null);
  const [opioidResult, setOpioidResult] = useState<any>(null);
  const [symptomResult, setSymptomResult] = useState<any>(null);

  // Forms
  const [assessForm, setAssessForm] = useState({ ecogPs: 1, kps: 70, palliativePhase: 'palliative', clinicianNotes: '' });
  const [esasForm, setEsasForm] = useState<any>({ painScore: 0, tirednessScore: 0, nauseaScore: 0, depressionScore: 0, anxietyScore: 0, drowsinessScore: 0, appetiteScore: 0, wellbeingScore: 0, dyspnoeaScore: 0 });
  const [goalsForm, setGoalsForm] = useState({ cprWish: 'no', ventilationWish: 'no', artificialNutritionWish: 'no', hospitalAdmissionWish: 'comfort', documentDate: new Date().toISOString().split('T')[0], notes: '' });
  const [directiveForm, setDirectiveForm] = useState({ documentType: 'DNACPR', documentDate: new Date().toISOString().split('T')[0], summary: '', physicianName: '' });
  const [medForm, setMedForm] = useState({ reviewDate: new Date().toISOString().split('T')[0], opioidEquivalenceMgOral: '', routeOfAdministration: 'oral', notes: '' });

  // CDSS forms
  const [progForm, setProgForm] = useState({ ecog_ps: 1, kps: 70, ppi_anorexia: 0, ppi_dyspnoea: 0, ppi_oedema: 0, ppi_delirium: 0, ppi_oral_intake: 0 });
  const [opioidForm, setOpioidForm] = useState({ drug: 'morphine', dose_mg: 30, route: 'oral', target_drug: 'oxycodone', target_route: 'oral', renal_impairment: false });
  const [symptomForm, setSymptomForm] = useState({ symptom: 'pain', severity: 5, oral_route_available: true, renal_impairment: false, is_last_days_of_life: false });

  const load = () => {
    getPalliativeAssessments(patientId, tenantSubdomain).then(r => setAssessments(r.data || []));
    getPalliativeEsas(patientId, tenantSubdomain).then(r => setEsasScores(r.data || []));
    getPalliativeGoals(patientId, tenantSubdomain).then(r => setGoals(r.data));
    getPalliativeDirectives(patientId, tenantSubdomain).then(r => setDirectives(r.data || []));
    getPalliativeMedReviews(patientId, tenantSubdomain).then(r => setMedReviews(r.data || []));
  };

  useEffect(() => { load(); }, [patientId]);

  const latestEsas = esasScores[0];
  const esasTotal = latestEsas ? ESAS_ITEMS.reduce((s, i) => s + (latestEsas[i.key] ?? 0), 0) : null;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'assessment', label: 'Assessment & Prognosis' },
    { id: 'esas', label: 'ESAS Symptoms' },
    { id: 'goals', label: 'Goals of Care' },
    { id: 'directives', label: 'Directives' },
    { id: 'medications', label: 'Medications' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Latest assessment */}
            {assessments[0] && (
              <>
                <div className="bg-violet-50 border border-violet-200 rounded p-3">
                  <div className="text-xs text-violet-600 font-medium">ECOG PS</div>
                  <div className="text-2xl font-bold text-violet-800">{assessments[0].ecogPs}</div>
                  <div className="text-xs text-violet-500">{ECOG_LABELS[assessments[0].ecogPs] || ''}</div>
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded p-3">
                  <div className="text-xs text-violet-600 font-medium">KPS</div>
                  <div className="text-2xl font-bold text-violet-800">{assessments[0].kps}%</div>
                  <div className="text-xs text-violet-500">Karnofsky</div>
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded p-3">
                  <div className="text-xs text-violet-600 font-medium">Phase</div>
                  <div className="text-lg font-bold text-violet-800 capitalize">{(assessments[0].palliativePhase || '').replace('_', ' ')}</div>
                </div>
              </>
            )}
            {esasTotal !== null && (
              <div className={`border rounded p-3 ${esasTotal >= 40 ? 'bg-red-50 border-red-300' : esasTotal >= 20 ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-300'}`}>
                <div className="text-xs font-medium text-gray-600">ESAS Total</div>
                <div className={`text-2xl font-bold ${esasTotal >= 40 ? 'text-red-700' : esasTotal >= 20 ? 'text-yellow-700' : 'text-green-700'}`}>{esasTotal}/90</div>
                <div className="text-xs text-gray-500">{esasTotal >= 40 ? 'High burden' : esasTotal >= 20 ? 'Moderate' : 'Low burden'}</div>
              </div>
            )}
          </div>

          {/* Goals of Care summary */}
          {goals && (
            <div className="bg-white border border-gray-200 rounded p-4">
              <div className="font-semibold text-sm text-gray-700 mb-2">Active Goals of Care</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><span className="text-gray-500">CPR:</span> <span className="font-medium capitalize">{goals.cprWish}</span></div>
                <div><span className="text-gray-500">Ventilation:</span> <span className="font-medium capitalize">{goals.ventilationWish}</span></div>
                <div><span className="text-gray-500">Nutrition:</span> <span className="font-medium capitalize">{goals.artificialNutritionWish}</span></div>
                <div><span className="text-gray-500">Hospital:</span> <span className="font-medium capitalize">{(goals.hospitalAdmissionWish || '').replace('_', ' ')}</span></div>
              </div>
            </div>
          )}

          {/* Active directives */}
          {directives.filter(d => d.isActive).map(d => (
            <div key={d.id} className="bg-amber-50 border border-amber-300 rounded p-3 text-sm">
              <span className="font-semibold text-amber-800">{d.documentType}</span>
              <span className="text-amber-600 ml-2">— {d.documentDate}</span>
              {d.summary && <p className="text-amber-700 mt-1">{d.summary}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ASSESSMENT & PROGNOSIS */}
      {tab === 'assessment' && (
        <div className="space-y-4">
          {/* Prognosis CDSS */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Prognostic Estimation (PPI / PaP)</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              {[
                { label: 'ECOG PS', key: 'ecog_ps', max: 4, type: 'number' },
                { label: 'KPS (%)', key: 'kps', max: 100, type: 'number' },
                { label: 'Anorexia (0–2)', key: 'ppi_anorexia', max: 2, type: 'number' },
                { label: 'Dyspnoea (0–2)', key: 'ppi_dyspnoea', max: 2, type: 'number' },
                { label: 'Oedema (0–1)', key: 'ppi_oedema', max: 1, type: 'number' },
                { label: 'Delirium (0–2)', key: 'ppi_delirium', max: 2, type: 'number' },
                { label: 'Oral Intake (0–2)', key: 'ppi_oral_intake', max: 2, type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type="number" min={0} max={f.max}
                    value={(progForm as any)[f.key]}
                    onChange={e => setProgForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
            </div>
            <button onClick={() => palliativePrognosis(progForm).then(r => setPrognosisResult(r.data))}
              className="bg-violet-600 text-white px-4 py-1.5 rounded text-sm hover:bg-violet-700">
              Calculate Prognosis
            </button>
            {prognosisResult && (
              <div className="mt-3 bg-violet-50 border border-violet-200 rounded p-3 text-sm space-y-1">
                <div className="font-semibold text-violet-800">PPI: {prognosisResult.ppi_score} — Group {prognosisResult.ppi_prognosis_group} — {prognosisResult.survival_estimate}</div>
                <div className="text-violet-700">PaP Score: {prognosisResult.pap_score} — {prognosisResult.pap_prognosis_group}</div>
                <div className="text-violet-700 capitalize">Phase: <strong>{(prognosisResult.phase_of_illness || '').replace('_', ' ')}</strong></div>
                <ul className="list-disc list-inside text-violet-700 space-y-0.5">
                  {(prognosisResult.recommendations || []).map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
                {(prognosisResult.alerts || []).map((a: string, i: number) => (
                  <div key={i} className="text-red-600 text-xs">⚠ {a}</div>
                ))}
              </div>
            )}
          </div>

          {/* Assessment form */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Record Assessment</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ECOG PS (0–4)</label>
                <input type="number" min={0} max={4} value={assessForm.ecogPs}
                  onChange={e => setAssessForm(p => ({ ...p, ecogPs: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">KPS (%)</label>
                <input type="number" min={0} max={100} step={10} value={assessForm.kps}
                  onChange={e => setAssessForm(p => ({ ...p, kps: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phase</label>
                <select value={assessForm.palliativePhase}
                  onChange={e => setAssessForm(p => ({ ...p, palliativePhase: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="palliative">Palliative</option>
                  <option value="end_of_life">End of Life</option>
                  <option value="terminal">Terminal</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={assessForm.clinicianNotes}
                  onChange={e => setAssessForm(p => ({ ...p, clinicianNotes: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addPalliativeAssessment(patientId, { ...assessForm, assessmentDate: new Date().toISOString(), clinicianId: providerId }, tenantSubdomain)
                .then(() => load())}
              className="bg-violet-600 text-white px-4 py-1.5 rounded text-sm hover:bg-violet-700">
              Save Assessment
            </button>
          </div>

          {/* History */}
          {assessments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Date', 'ECOG', 'KPS', 'Phase', 'Notes'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {assessments.slice(0, 10).map(a => (
                    <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{new Date(a.assessmentDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{a.ecogPs}</td>
                      <td className="px-3 py-2">{a.kps}%</td>
                      <td className="px-3 py-2 capitalize">{(a.palliativePhase || '').replace('_', ' ')}</td>
                      <td className="px-3 py-2 max-w-xs truncate">{a.clinicianNotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ESAS SYMPTOMS */}
      {tab === 'esas' && (
        <div className="space-y-4">
          {/* Symptom management CDSS */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Symptom Management Guidance</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Symptom</label>
                <select value={symptomForm.symptom} onChange={e => setSymptomForm(p => ({ ...p, symptom: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['pain', 'nausea', 'dyspnoea', 'agitation', 'constipation', 'secretions'].map(s => (
                    <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Severity (NRS 0–10)</label>
                <input type="number" min={0} max={10} value={symptomForm.severity}
                  onChange={e => setSymptomForm(p => ({ ...p, severity: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="space-y-1">
                {[
                  { key: 'oral_route_available', label: 'Oral route available' },
                  { key: 'renal_impairment', label: 'Renal impairment' },
                  { key: 'is_last_days_of_life', label: 'Last days of life' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={(symptomForm as any)[f.key]}
                      onChange={e => setSymptomForm(p => ({ ...p, [f.key]: e.target.checked }))} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => palliativeSymptomManage(symptomForm).then(r => setSymptomResult(r.data))}
              className="bg-violet-600 text-white px-4 py-1.5 rounded text-sm hover:bg-violet-700">
              Get Guidance
            </button>
            {symptomResult && (
              <div className="mt-3 space-y-2 text-sm">
                {(symptomResult.alerts || []).map((a: string, i: number) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded px-3 py-2 text-red-700 text-xs">⚠ {a}</div>
                ))}
                {symptomResult.pharmacological_suggestions?.length > 0 && (
                  <div className="bg-violet-50 border border-violet-200 rounded p-3">
                    <div className="font-semibold text-violet-800 mb-1">Pharmacological</div>
                    <ul className="list-disc list-inside text-violet-700 space-y-0.5">
                      {symptomResult.pharmacological_suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {symptomResult.non_pharmacological?.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <div className="font-semibold text-green-800 mb-1">Non-Pharmacological</div>
                    <ul className="list-disc list-inside text-green-700 space-y-0.5">
                      {symptomResult.non_pharmacological.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <div className="text-xs text-gray-400 italic">{symptomResult.guideline}</div>
              </div>
            )}
          </div>

          {/* ESAS record form */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Record ESAS Scores (0 = none, 10 = worst possible)</div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-3">
              {ESAS_ITEMS.map(item => (
                <div key={item.key}>
                  <label className="block text-xs text-gray-500 mb-1">{item.label}</label>
                  <input type="number" min={0} max={10} value={esasForm[item.key] ?? 0}
                    onChange={e => setEsasForm((p: any) => ({ ...p, [item.key]: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-600 mb-2">
              Total: <strong>{ESAS_ITEMS.reduce((s, i) => s + (esasForm[i.key] ?? 0), 0)}/90</strong>
            </div>
            <button onClick={() =>
              addPalliativeEsas(patientId, { ...esasForm, patientId, recordedAt: new Date().toISOString() }, tenantSubdomain)
                .then(() => load())}
              className="bg-violet-600 text-white px-4 py-1.5 rounded text-sm hover:bg-violet-700">
              Save ESAS
            </button>
          </div>

          {/* ESAS history */}
          {esasScores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-500">Date</th>
                    {ESAS_ITEMS.map(i => <th key={i.key} className="px-2 py-1.5 text-left font-semibold text-gray-500">{i.label}</th>)}
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {esasScores.slice(0, 10).map(e => {
                    const tot = ESAS_ITEMS.reduce((s, i) => s + (e[i.key] ?? 0), 0);
                    return (
                      <tr key={e.id} className="border-t border-gray-100">
                        <td className="px-2 py-1.5">{new Date(e.recordedAt).toLocaleDateString()}</td>
                        {ESAS_ITEMS.map(i => (
                          <td key={i.key} className={`px-2 py-1.5 ${e[i.key] >= 7 ? 'text-red-600 font-semibold' : e[i.key] >= 4 ? 'text-yellow-600' : ''}`}>
                            {e[i.key] ?? 0}
                          </td>
                        ))}
                        <td className={`px-2 py-1.5 font-semibold ${tot >= 40 ? 'text-red-600' : tot >= 20 ? 'text-yellow-600' : 'text-green-600'}`}>{tot}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GOALS OF CARE */}
      {tab === 'goals' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Update Goals of Care</div>
            <p className="text-xs text-gray-500 mb-3">Saving a new record deactivates the previous one and creates an audit trail.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              {[
                { key: 'cprWish', label: 'CPR Wish', options: ['yes', 'no', 'discuss'] },
                { key: 'ventilationWish', label: 'Ventilation Wish', options: ['yes', 'no', 'discuss'] },
                { key: 'artificialNutritionWish', label: 'Artificial Nutrition', options: ['yes', 'no', 'discuss'] },
                { key: 'hospitalAdmissionWish', label: 'Hospital Admission', options: ['yes', 'no', 'comfort', 'discuss'] },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <select value={(goalsForm as any)[f.key]}
                    onChange={e => setGoalsForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm capitalize">
                    {f.options.map(o => <option key={o} value={o} className="capitalize">{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Document Date</label>
                <input type="date" value={goalsForm.documentDate}
                  onChange={e => setGoalsForm(p => ({ ...p, documentDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={goalsForm.notes}
                  onChange={e => setGoalsForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addPalliativeGoals(patientId, { ...goalsForm, documentedBy: providerId }, tenantSubdomain)
                .then(() => load())}
              className="bg-violet-600 text-white px-4 py-1.5 rounded text-sm hover:bg-violet-700">
              Save Goals of Care
            </button>
          </div>

          {/* History */}
          {goals && (
            <div className="bg-white border border-gray-200 rounded p-4 text-sm">
              <div className="font-semibold text-gray-700 mb-2">Current Active Record</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><span className="text-gray-500">CPR:</span> <span className="font-medium capitalize">{goals.cprWish}</span></div>
                <div><span className="text-gray-500">Ventilation:</span> <span className="font-medium capitalize">{goals.ventilationWish}</span></div>
                <div><span className="text-gray-500">Nutrition:</span> <span className="font-medium capitalize">{goals.artificialNutritionWish}</span></div>
                <div><span className="text-gray-500">Hospital:</span> <span className="font-medium capitalize">{(goals.hospitalAdmissionWish || '').replace('_', ' ')}</span></div>
              </div>
              {goals.notes && <p className="mt-2 text-gray-600">{goals.notes}</p>}
            </div>
          )}
        </div>
      )}

      {/* DIRECTIVES */}
      {tab === 'directives' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Add Advance Directive</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Document Type</label>
                <select value={directiveForm.documentType}
                  onChange={e => setDirectiveForm(p => ({ ...p, documentType: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['DNACPR', 'Living Will', 'LPA Health & Welfare', 'POLST', 'ADRT', 'Other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Document Date</label>
                <input type="date" value={directiveForm.documentDate}
                  onChange={e => setDirectiveForm(p => ({ ...p, documentDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Physician Name</label>
                <input type="text" value={directiveForm.physicianName}
                  onChange={e => setDirectiveForm(p => ({ ...p, physicianName: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Summary</label>
                <textarea rows={2} value={directiveForm.summary}
                  onChange={e => setDirectiveForm(p => ({ ...p, summary: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addPalliativeDirective(patientId, directiveForm, tenantSubdomain).then(() => load())}
              className="bg-violet-600 text-white px-4 py-1.5 rounded text-sm hover:bg-violet-700">
              Add Directive
            </button>
          </div>

          {directives.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Type', 'Date', 'Physician', 'Summary', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {directives.map(d => (
                    <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{d.documentType}</td>
                      <td className="px-3 py-2">{d.documentDate}</td>
                      <td className="px-3 py-2">{d.physicianName}</td>
                      <td className="px-3 py-2 max-w-xs truncate">{d.summary}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {d.isActive ? 'Active' : 'Superseded'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MEDICATIONS */}
      {tab === 'medications' && (
        <div className="space-y-4">
          {/* Opioid converter */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Opioid Equianalgesic Converter</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Source Drug</label>
                <select value={opioidForm.drug} onChange={e => setOpioidForm(p => ({ ...p, drug: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['morphine', 'oxycodone', 'hydromorphone', 'codeine', 'tramadol', 'diamorphine', 'fentanyl_patch', 'tapentadol'].map(d => (
                    <option key={d} value={d}>{d.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dose (mg or mcg/h for patches)</label>
                <input type="number" min={0} value={opioidForm.dose_mg}
                  onChange={e => setOpioidForm(p => ({ ...p, dose_mg: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Route</label>
                <select value={opioidForm.route} onChange={e => setOpioidForm(p => ({ ...p, route: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['oral', 'sc', 'iv', 'transdermal'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target Drug</label>
                <select value={opioidForm.target_drug} onChange={e => setOpioidForm(p => ({ ...p, target_drug: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['morphine', 'oxycodone', 'hydromorphone', 'diamorphine'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target Route</label>
                <select value={opioidForm.target_route} onChange={e => setOpioidForm(p => ({ ...p, target_route: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['oral', 'sc', 'iv'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
                  <input type="checkbox" checked={opioidForm.renal_impairment}
                    onChange={e => setOpioidForm(p => ({ ...p, renal_impairment: e.target.checked }))} />
                  Renal impairment
                </label>
              </div>
            </div>
            <button onClick={() => palliativeOpioidConvert(opioidForm).then(r => setOpioidResult(r.data))}
              className="bg-violet-600 text-white px-4 py-1.5 rounded text-sm hover:bg-violet-700">
              Convert
            </button>
            {opioidResult && !opioidResult.error && (
              <div className="mt-3 bg-violet-50 border border-violet-200 rounded p-3 text-sm space-y-1">
                <div className="font-semibold text-violet-800">MEDD: {opioidResult.medd_mg_24h} mg/24h oral morphine equivalent</div>
                <div className="text-violet-700">Adjusted {opioidResult.target_drug} {opioidResult.target_route}: <strong>{opioidResult.adjusted_dose_mg_24h} mg/24h</strong></div>
                <div className="text-violet-700">PRN dose: <strong>{opioidResult.prn_dose_mg} mg</strong> (1/6 of 24h total)</div>
                {opioidResult.csci_equivalent && <div className="text-violet-700">{opioidResult.csci_equivalent}</div>}
                {(opioidResult.alerts || []).map((a: string, i: number) => <div key={i} className="text-red-600 text-xs">⚠ {a}</div>)}
                {(opioidResult.warnings || []).map((w: string, i: number) => <div key={i} className="text-amber-600 text-xs">⚠ {w}</div>)}
              </div>
            )}
            {opioidResult?.error && <div className="mt-2 text-red-600 text-sm">⚠ {opioidResult.error}</div>}
          </div>

          {/* Med review form */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Record Medication Review</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Review Date</label>
                <input type="date" value={medForm.reviewDate}
                  onChange={e => setMedForm(p => ({ ...p, reviewDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Opioid Equivalence (mg oral)</label>
                <input type="number" min={0} value={medForm.opioidEquivalenceMgOral}
                  onChange={e => setMedForm(p => ({ ...p, opioidEquivalenceMgOral: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Route</label>
                <select value={medForm.routeOfAdministration}
                  onChange={e => setMedForm(p => ({ ...p, routeOfAdministration: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['oral', 'sc', 'iv', 'csci', 'transdermal', 'sublingual'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={medForm.notes}
                  onChange={e => setMedForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addPalliativeMedReview(patientId, { ...medForm, reviewedBy: providerId }, tenantSubdomain)
                .then(() => load())}
              className="bg-violet-600 text-white px-4 py-1.5 rounded text-sm hover:bg-violet-700">
              Save Review
            </button>
          </div>

          {/* Med review history */}
          {medReviews.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Date', 'MEDD (mg oral)', 'Route', 'Notes'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {medReviews.slice(0, 10).map(m => (
                    <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{new Date(m.reviewDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{m.opioidEquivalenceMgOral ?? '—'}</td>
                      <td className="px-3 py-2 capitalize">{m.routeOfAdministration}</td>
                      <td className="px-3 py-2 max-w-xs truncate">{m.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
