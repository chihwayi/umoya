import React, { useEffect, useState } from 'react';
import {
  getNutritionScreenings, addNutritionScreening,
  getNutritionAssessments, addNutritionAssessment,
  getNutritionPrescriptions, addNutritionPrescription,
  getNutritionMonitoring, addNutritionMonitoring,
  cdssNutritionScreen, cdssNutritionPrescribe, cdssRefeedingRisk,
} from '../services/api';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

type Tab = 'overview' | 'screening' | 'assessment' | 'prescription' | 'monitoring';

const RISK_COLOUR: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
  very_high: 'bg-red-200 text-red-800 font-semibold',
};

export default function NutritionDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  const [screenings, setScreenings] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [monitoring, setMonitoring] = useState<any[]>([]);

  const [screenResult, setScreenResult] = useState<any>(null);
  const [prescribeResult, setPrescribeResult] = useState<any>(null);
  const [refeedResult, setRefeedResult] = useState<any>(null);

  // Forms
  const [screenForm, setScreenForm] = useState({ tool: 'NRS2002', nrs_nutritional_impairment: 0, nrs_disease_severity: 0, age_over_70: false, must_bmi_score: 0, must_weight_loss_score: 0, must_acute_disease_score: 0, mna_sf_score: 12 });
  const [prescribeForm, setPrescribeForm] = useState({ weight_kg: 70, height_cm: 170, age_years: 50, sex: 'male', activity_level: 'sedentary', stress_factor: 'none', route: 'oral', renal_impairment: false, hepatic_impairment: false, is_critically_ill: false });
  const [refeedForm, setRefeedForm] = useState({ duration_starvation_days: 7, weight_kg: 70, serum_phosphate_mmol_l: '', serum_potassium_mmol_l: '', serum_magnesium_mmol_l: '', has_alcohol_dependence: false, has_insulin_dependent_dm: false, has_malabsorption: false });

  const [assessForm, setAssessForm] = useState({ assessmentDate: new Date().toISOString().split('T')[0], sgaScore: 'A', currentWeightKg: '', heightCm: '', bmi: '', dietaryHistory: '', notes: '' });
  const [rxForm, setRxForm] = useState({ prescriptionDate: new Date().toISOString().split('T')[0], calorieTarget: '', proteinTargetG: '', fluidTargetMl: '', route: 'oral', specialDiet: 'standard', notes: '' });
  const [monForm, setMonForm] = useState({ monitoringDate: new Date().toISOString().split('T')[0], actualCaloriesIntake: '', actualProteinIntakeG: '', oralIntakePercent: '', weightKg: '', albuminGDl: '', notes: '' });

  const load = () => {
    getNutritionScreenings(patientId, tenantSubdomain).then(r => setScreenings(r.data || []));
    getNutritionAssessments(patientId, tenantSubdomain).then(r => setAssessments(r.data || []));
    getNutritionPrescriptions(patientId, tenantSubdomain).then(r => setPrescriptions(r.data || []));
    getNutritionMonitoring(patientId, tenantSubdomain).then(r => setMonitoring(r.data || []));
  };

  useEffect(() => { load(); }, [patientId]);

  const latestScreen = screenings[0];
  const activePx = prescriptions.find(p => p.isActive);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'screening', label: 'Screening & CDSS' },
    { id: 'assessment', label: 'Assessment' },
    { id: 'prescription', label: 'Prescription' },
    { id: 'monitoring', label: 'Monitoring' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t.id ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {latestScreen && (
              <>
                <div className="bg-lime-50 border border-lime-200 rounded p-3">
                  <div className="text-xs text-lime-600 font-medium">Latest Screening</div>
                  <div className="text-lg font-bold text-lime-800">{latestScreen.screeningTool}</div>
                  <div className="text-sm text-lime-700">Score: {latestScreen.totalScore}</div>
                </div>
                <div className={`border rounded p-3 ${RISK_COLOUR[latestScreen.riskCategory]?.replace('text-', 'border-').split(' ')[0] || ''}`}>
                  <div className="text-xs font-medium text-gray-600">Risk</div>
                  <div className={`text-lg font-bold capitalize ${RISK_COLOUR[latestScreen.riskCategory]?.split(' ')[1] || ''}`}>{latestScreen.riskCategory}</div>
                </div>
              </>
            )}
            {assessments[0] && (
              <div className="bg-lime-50 border border-lime-200 rounded p-3">
                <div className="text-xs text-lime-600 font-medium">SGA Score</div>
                <div className="text-2xl font-bold text-lime-800">{assessments[0].sgaScore || '—'}</div>
                <div className="text-xs text-lime-500">Subjective Global Assessment</div>
              </div>
            )}
            {monitoring[0] && (
              <div className={`border rounded p-3 ${(monitoring[0].oralIntakePercent ?? 100) < 50 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'}`}>
                <div className="text-xs font-medium text-gray-600">Oral Intake</div>
                <div className={`text-2xl font-bold ${(monitoring[0].oralIntakePercent ?? 100) < 50 ? 'text-red-700' : 'text-green-700'}`}>{monitoring[0].oralIntakePercent ?? '—'}%</div>
              </div>
            )}
          </div>

          {activePx && (
            <div className="bg-white border border-gray-200 rounded p-4 text-sm">
              <div className="font-semibold text-gray-700 mb-2">Active Dietary Prescription</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><span className="text-gray-500">Calories:</span> <strong>{activePx.calorieTarget ?? '—'} kcal</strong></div>
                <div><span className="text-gray-500">Protein:</span> <strong>{activePx.proteinTargetG ?? '—'} g</strong></div>
                <div><span className="text-gray-500">Fluid:</span> <strong>{activePx.fluidTargetMl ?? '—'} ml</strong></div>
                <div><span className="text-gray-500">Route:</span> <strong className="uppercase">{activePx.route}</strong></div>
              </div>
              {activePx.specialDiet && <div className="mt-1 text-gray-600 capitalize">Diet: {activePx.specialDiet.replace('_', ' ')}</div>}
            </div>
          )}
        </div>
      )}

      {/* SCREENING & CDSS */}
      {tab === 'screening' && (
        <div className="space-y-4">
          {/* NRS CDSS */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Nutritional Risk Screening</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Screening Tool</label>
                <select value={screenForm.tool} onChange={e => setScreenForm(p => ({ ...p, tool: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['NRS2002', 'MUST', 'MNA', 'SNAQ'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {screenForm.tool === 'NRS2002' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nutritional Impairment (0–3)</label>
                    <input type="number" min={0} max={3} value={screenForm.nrs_nutritional_impairment}
                      onChange={e => setScreenForm(p => ({ ...p, nrs_nutritional_impairment: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Disease Severity (0–3)</label>
                    <input type="number" min={0} max={3} value={screenForm.nrs_disease_severity}
                      onChange={e => setScreenForm(p => ({ ...p, nrs_disease_severity: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
                      <input type="checkbox" checked={screenForm.age_over_70}
                        onChange={e => setScreenForm(p => ({ ...p, age_over_70: e.target.checked }))} />
                      Age ≥70 years
                    </label>
                  </div>
                </>
              )}
              {screenForm.tool === 'MUST' && (
                <>
                  {[
                    { key: 'must_bmi_score', label: 'BMI Score (0–2)' },
                    { key: 'must_weight_loss_score', label: 'Weight Loss Score (0–2)' },
                    { key: 'must_acute_disease_score', label: 'Acute Disease Score (0–2)' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                      <input type="number" min={0} max={2} value={(screenForm as any)[f.key]}
                        onChange={e => setScreenForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                    </div>
                  ))}
                </>
              )}
              {screenForm.tool === 'MNA' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">MNA Short-Form Score (0–14)</label>
                  <input type="number" min={0} max={14} value={screenForm.mna_sf_score}
                    onChange={e => setScreenForm(p => ({ ...p, mna_sf_score: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              )}
            </div>
            <button onClick={() => cdssNutritionScreen(screenForm).then(r => setScreenResult(r.data))}
              className="bg-lime-600 text-white px-4 py-1.5 rounded text-sm hover:bg-lime-700">
              Screen
            </button>
            {screenResult && (
              <div className={`mt-3 border rounded p-3 text-sm space-y-1 ${RISK_COLOUR[screenResult.risk_category] || 'bg-gray-50'}`}>
                <div className="font-semibold">{screenResult.tool} Score: {screenResult.total_score} — <span className="capitalize">{screenResult.risk_category} risk</span></div>
                {screenResult.bmi && <div>BMI: {screenResult.bmi}</div>}
                <ul className="list-disc list-inside space-y-0.5">
                  {[...(screenResult.recommendations || []), ...(screenResult.next_steps || [])].map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
                <button className="mt-2 text-xs underline opacity-70"
                  onClick={() => addNutritionScreening(patientId, {
                    screeningTool: screenResult.tool, totalScore: screenResult.total_score,
                    riskCategory: screenResult.risk_category, screenedBy: providerId,
                    screenedAt: new Date().toISOString(),
                  }, tenantSubdomain).then(() => load())}>
                  Save Screening Result
                </button>
              </div>
            )}
          </div>

          {/* Refeeding Risk */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Refeeding Syndrome Risk (NICE CG32)</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Days without adequate intake</label>
                <input type="number" min={0} value={refeedForm.duration_starvation_days}
                  onChange={e => setRefeedForm(p => ({ ...p, duration_starvation_days: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Weight (kg)</label>
                <input type="number" min={0} value={refeedForm.weight_kg}
                  onChange={e => setRefeedForm(p => ({ ...p, weight_kg: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phosphate (mmol/L)</label>
                <input type="number" step={0.1} value={refeedForm.serum_phosphate_mmol_l}
                  onChange={e => setRefeedForm(p => ({ ...p, serum_phosphate_mmol_l: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Potassium (mmol/L)</label>
                <input type="number" step={0.1} value={refeedForm.serum_potassium_mmol_l}
                  onChange={e => setRefeedForm(p => ({ ...p, serum_potassium_mmol_l: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Magnesium (mmol/L)</label>
                <input type="number" step={0.1} value={refeedForm.serum_magnesium_mmol_l}
                  onChange={e => setRefeedForm(p => ({ ...p, serum_magnesium_mmol_l: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="space-y-1">
                {[
                  { key: 'has_alcohol_dependence', label: 'Alcohol dependence' },
                  { key: 'has_insulin_dependent_dm', label: 'Insulin-dependent DM' },
                  { key: 'has_malabsorption', label: 'Malabsorption' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={(refeedForm as any)[f.key]}
                      onChange={e => setRefeedForm(p => ({ ...p, [f.key]: e.target.checked }))} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => {
              const payload = {
                ...refeedForm,
                serum_phosphate_mmol_l: refeedForm.serum_phosphate_mmol_l ? Number(refeedForm.serum_phosphate_mmol_l) : undefined,
                serum_potassium_mmol_l: refeedForm.serum_potassium_mmol_l ? Number(refeedForm.serum_potassium_mmol_l) : undefined,
                serum_magnesium_mmol_l: refeedForm.serum_magnesium_mmol_l ? Number(refeedForm.serum_magnesium_mmol_l) : undefined,
              };
              cdssRefeedingRisk(payload).then(r => setRefeedResult(r.data));
            }}
              className="bg-lime-600 text-white px-4 py-1.5 rounded text-sm hover:bg-lime-700">
              Assess Risk
            </button>
            {refeedResult && (
              <div className={`mt-3 border rounded p-3 text-sm space-y-1 ${RISK_COLOUR[refeedResult.risk_level] || 'bg-gray-50'}`}>
                <div className="font-semibold capitalize">Refeeding Risk: {refeedResult.risk_level.replace('_', ' ')}</div>
                {(refeedResult.electrolyte_alerts || []).map((a: string, i: number) => (
                  <div key={i} className="text-red-700 font-medium text-xs">⚠ {a}</div>
                ))}
                <ul className="list-disc list-inside space-y-0.5">
                  {(refeedResult.recommendations || []).map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
                {(refeedResult.alerts || []).map((a: string, i: number) => (
                  <div key={i} className="text-red-700 font-medium text-xs mt-1">⚠ {a}</div>
                ))}
                <div className="text-xs text-gray-400 italic">{refeedResult.guideline}</div>
              </div>
            )}
          </div>

          {/* Screening history */}
          {screenings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Date', 'Tool', 'Score', 'Risk', 'Follow-up'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {screenings.map(s => (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{new Date(s.screenedAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{s.screeningTool}</td>
                      <td className="px-3 py-2">{s.totalScore}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${RISK_COLOUR[s.riskCategory] || ''}`}>{s.riskCategory}</span></td>
                      <td className="px-3 py-2">{s.followUpRequired ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ASSESSMENT */}
      {tab === 'assessment' && (
        <div className="space-y-4">
          {/* Prescribe CDSS */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Requirements Calculator (Mifflin-St Jeor / ESPEN)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              {[
                { key: 'weight_kg', label: 'Weight (kg)', type: 'number' },
                { key: 'height_cm', label: 'Height (cm)', type: 'number' },
                { key: 'age_years', label: 'Age (years)', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type="number" value={(prescribeForm as any)[f.key]}
                    onChange={e => setPrescribeForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sex</label>
                <select value={prescribeForm.sex} onChange={e => setPrescribeForm(p => ({ ...p, sex: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Activity Level</label>
                <select value={prescribeForm.activity_level} onChange={e => setPrescribeForm(p => ({ ...p, activity_level: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['sedentary', 'light', 'moderate', 'active', 'very_active'].map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stress Factor</label>
                <select value={prescribeForm.stress_factor} onChange={e => setPrescribeForm(p => ({ ...p, stress_factor: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['none', 'mild', 'moderate', 'severe', 'burns'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Route</label>
                <select value={prescribeForm.route} onChange={e => setPrescribeForm(p => ({ ...p, route: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['oral', 'NGT', 'PEG', 'TPN', 'PN'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                {[
                  { key: 'renal_impairment', label: 'Renal impairment' },
                  { key: 'hepatic_impairment', label: 'Hepatic impairment' },
                  { key: 'is_critically_ill', label: 'Critically ill' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={(prescribeForm as any)[f.key]}
                      onChange={e => setPrescribeForm(p => ({ ...p, [f.key]: e.target.checked }))} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => cdssNutritionPrescribe(prescribeForm).then(r => setPrescribeResult(r.data))}
              className="bg-lime-600 text-white px-4 py-1.5 rounded text-sm hover:bg-lime-700">
              Calculate Requirements
            </button>
            {prescribeResult && (
              <div className="mt-3 bg-lime-50 border border-lime-200 rounded p-3 text-sm space-y-1">
                <div className="font-semibold text-lime-800">BMR: {prescribeResult.bmr_kcal} kcal &nbsp;|&nbsp; TEE: <strong>{prescribeResult.tee_kcal} kcal/day</strong></div>
                <div className="text-lime-700">Protein: <strong>{prescribeResult.protein_target_g} g/day</strong> &nbsp;|&nbsp; Fluid: <strong>{prescribeResult.fluid_target_ml} ml/day</strong></div>
                <div className="text-lime-700">BMI: {prescribeResult.bmi}</div>
                {prescribeResult.formula_suggestion && <div className="text-lime-700">Formula: {prescribeResult.formula_suggestion}</div>}
                {(prescribeResult.route_notes || []).map((n: string, i: number) => <div key={i} className="text-lime-700 text-xs">• {n}</div>)}
                {(prescribeResult.micronutrient_notes || []).map((n: string, i: number) => <div key={i} className="text-amber-600 text-xs">⚠ {n}</div>)}
                <div className="text-xs text-gray-400 italic">{prescribeResult.guideline}</div>
              </div>
            )}
          </div>

          {/* Assessment form */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Record Nutritional Assessment</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assessment Date</label>
                <input type="date" value={assessForm.assessmentDate}
                  onChange={e => setAssessForm(p => ({ ...p, assessmentDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">SGA Score</label>
                <select value={assessForm.sgaScore} onChange={e => setAssessForm(p => ({ ...p, sgaScore: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="A">A — Well nourished</option>
                  <option value="B">B — Moderately malnourished</option>
                  <option value="C">C — Severely malnourished</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Weight (kg)</label>
                <input type="number" value={assessForm.currentWeightKg}
                  onChange={e => setAssessForm(p => ({ ...p, currentWeightKg: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Height (cm)</label>
                <input type="number" value={assessForm.heightCm}
                  onChange={e => setAssessForm(p => ({ ...p, heightCm: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">BMI</label>
                <input type="number" step={0.1} value={assessForm.bmi}
                  onChange={e => setAssessForm(p => ({ ...p, bmi: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Dietary History / Notes</label>
                <textarea rows={2} value={assessForm.notes}
                  onChange={e => setAssessForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addNutritionAssessment(patientId, {
                ...assessForm,
                currentWeightKg: assessForm.currentWeightKg ? Number(assessForm.currentWeightKg) : undefined,
                heightCm: assessForm.heightCm ? Number(assessForm.heightCm) : undefined,
                bmi: assessForm.bmi ? Number(assessForm.bmi) : undefined,
                dietitianId: providerId,
              }, tenantSubdomain).then(() => load())}
              className="bg-lime-600 text-white px-4 py-1.5 rounded text-sm hover:bg-lime-700">
              Save Assessment
            </button>
          </div>

          {assessments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Date', 'SGA', 'Weight (kg)', 'BMI', 'Notes'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {assessments.slice(0, 10).map(a => (
                    <tr key={a.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{a.assessmentDate}</td>
                      <td className="px-3 py-2 font-semibold">{a.sgaScore}</td>
                      <td className="px-3 py-2">{a.currentWeightKg ?? '—'}</td>
                      <td className="px-3 py-2">{a.bmi ?? '—'}</td>
                      <td className="px-3 py-2 max-w-xs truncate">{a.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PRESCRIPTION */}
      {tab === 'prescription' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Issue Dietary Prescription</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" value={rxForm.prescriptionDate}
                  onChange={e => setRxForm(p => ({ ...p, prescriptionDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Calorie Target (kcal)</label>
                <input type="number" value={rxForm.calorieTarget}
                  onChange={e => setRxForm(p => ({ ...p, calorieTarget: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Protein Target (g)</label>
                <input type="number" value={rxForm.proteinTargetG}
                  onChange={e => setRxForm(p => ({ ...p, proteinTargetG: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fluid Target (ml)</label>
                <input type="number" value={rxForm.fluidTargetMl}
                  onChange={e => setRxForm(p => ({ ...p, fluidTargetMl: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Route</label>
                <select value={rxForm.route} onChange={e => setRxForm(p => ({ ...p, route: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['oral', 'NGT', 'NJ', 'PEG', 'TPN', 'PN'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Special Diet</label>
                <select value={rxForm.specialDiet} onChange={e => setRxForm(p => ({ ...p, specialDiet: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['standard', 'diabetic', 'renal', 'cardiac', 'low_sodium', 'low_fat', 'ketogenic', 'high_protein', 'vegan', 'gluten_free'].map(d => (
                    <option key={d} value={d}>{d.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={rxForm.notes}
                  onChange={e => setRxForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addNutritionPrescription(patientId, {
                ...rxForm,
                calorieTarget: rxForm.calorieTarget ? Number(rxForm.calorieTarget) : undefined,
                proteinTargetG: rxForm.proteinTargetG ? Number(rxForm.proteinTargetG) : undefined,
                fluidTargetMl: rxForm.fluidTargetMl ? Number(rxForm.fluidTargetMl) : undefined,
                prescribedBy: providerId,
              }, tenantSubdomain).then(() => load())}
              className="bg-lime-600 text-white px-4 py-1.5 rounded text-sm hover:bg-lime-700">
              Issue Prescription
            </button>
          </div>

          {prescriptions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Date', 'Calories', 'Protein', 'Fluid', 'Route', 'Diet', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {prescriptions.map(p => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{p.prescriptionDate}</td>
                      <td className="px-3 py-2">{p.calorieTarget ?? '—'}</td>
                      <td className="px-3 py-2">{p.proteinTargetG ?? '—'} g</td>
                      <td className="px-3 py-2">{p.fluidTargetMl ?? '—'} ml</td>
                      <td className="px-3 py-2 uppercase">{p.route}</td>
                      <td className="px-3 py-2 capitalize">{(p.specialDiet || '').replace('_', ' ')}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.isActive ? 'Active' : 'Inactive'}
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

      {/* MONITORING */}
      {tab === 'monitoring' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Record Daily Monitoring</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" value={monForm.monitoringDate}
                  onChange={e => setMonForm(p => ({ ...p, monitoringDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Actual Calories (kcal)</label>
                <input type="number" value={monForm.actualCaloriesIntake}
                  onChange={e => setMonForm(p => ({ ...p, actualCaloriesIntake: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Actual Protein (g)</label>
                <input type="number" value={monForm.actualProteinIntakeG}
                  onChange={e => setMonForm(p => ({ ...p, actualProteinIntakeG: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Oral Intake (%)</label>
                <input type="number" min={0} max={100} value={monForm.oralIntakePercent}
                  onChange={e => setMonForm(p => ({ ...p, oralIntakePercent: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Weight (kg)</label>
                <input type="number" step={0.1} value={monForm.weightKg}
                  onChange={e => setMonForm(p => ({ ...p, weightKg: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Albumin (g/dL)</label>
                <input type="number" step={0.1} value={monForm.albuminGDl}
                  onChange={e => setMonForm(p => ({ ...p, albuminGDl: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Plan Adjustment / Notes</label>
                <textarea rows={2} value={monForm.notes}
                  onChange={e => setMonForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addNutritionMonitoring(patientId, {
                ...monForm,
                actualCaloriesIntake: monForm.actualCaloriesIntake ? Number(monForm.actualCaloriesIntake) : undefined,
                actualProteinIntakeG: monForm.actualProteinIntakeG ? Number(monForm.actualProteinIntakeG) : undefined,
                oralIntakePercent: monForm.oralIntakePercent ? Number(monForm.oralIntakePercent) : undefined,
                weightKg: monForm.weightKg ? Number(monForm.weightKg) : undefined,
                albuminGDl: monForm.albuminGDl ? Number(monForm.albuminGDl) : undefined,
                recordedBy: providerId,
              }, tenantSubdomain).then(() => load())}
              className="bg-lime-600 text-white px-4 py-1.5 rounded text-sm hover:bg-lime-700">
              Save Monitoring
            </button>
          </div>

          {monitoring.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Date', 'Calories', 'Protein', 'Oral %', 'Weight', 'Albumin', 'Notes'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {monitoring.slice(0, 15).map(m => (
                    <tr key={m.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{m.monitoringDate}</td>
                      <td className="px-3 py-2">{m.actualCaloriesIntake ?? '—'}</td>
                      <td className="px-3 py-2">{m.actualProteinIntakeG ?? '—'}</td>
                      <td className={`px-3 py-2 font-medium ${(m.oralIntakePercent ?? 100) < 50 ? 'text-red-600' : ''}`}>{m.oralIntakePercent ?? '—'}</td>
                      <td className="px-3 py-2">{m.weightKg ?? '—'}</td>
                      <td className={`px-3 py-2 ${m.albuminGDl && m.albuminGDl < 3.5 ? 'text-red-600' : ''}`}>{m.albuminGDl ?? '—'}</td>
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
