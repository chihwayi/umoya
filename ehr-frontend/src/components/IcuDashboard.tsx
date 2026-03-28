import React, { useEffect, useState } from 'react';
import {
  getIcuAdmissions, addIcuAdmission, updateIcuAdmission,
  getIcuSofa, addIcuSofa,
  getIcuVent, addIcuVent,
  getIcuSedation, addIcuSedation,
  getIcuLines, addIcuLine,
  getIcuVasopressors, addIcuVasopressor,
  cdssIcuSofa, cdssIcuVent, cdssIcuSedation,
} from '../services/api';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

type Tab = 'overview' | 'sofa' | 'vent' | 'sedation' | 'lines' | 'vasopressors';

const RASS_LABELS: Record<number, string> = {
  4: '+4 Combative',
  3: '+3 Very agitated',
  2: '+2 Agitated',
  1: '+1 Restless',
  0: '0 Alert & calm',
  [-1]: '-1 Drowsy',
  [-2]: '-2 Light sedation',
  [-3]: '-3 Moderate sedation',
  [-4]: '-4 Deep sedation',
  [-5]: '-5 Unarousable',
};

export default function IcuDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  const [admissions, setAdmissions] = useState<any[]>([]);
  const [sofaScores, setSofaScores] = useState<any[]>([]);
  const [ventSettings, setVentSettings] = useState<any[]>([]);
  const [sedation, setSedation] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [vasopressors, setVasopressors] = useState<any[]>([]);

  const [sofaResult, setSofaResult] = useState<any>(null);
  const [ventResult, setVentResult] = useState<any>(null);
  const [sedResult, setSedResult] = useState<any>(null);

  const [admForm, setAdmForm] = useState({ icuAdmissionDate: new Date().toISOString().slice(0, 16), admissionSource: 'ED', primaryDiagnosis: '', apacheIiScore: '', notes: '' });
  const [sofaForm, setSofaForm] = useState({ pao2Fio2: '', platelets: '', bilirubinUmol: '', mapMmhg: '', gcs: 15, creatinineUmol: '', urineOutputMl: '' });
  const [sofaCdssForm, setSofaCdssForm] = useState({ pao2_fio2: '', platelets_x10_9: '', bilirubin_umol_l: '', map_mmhg: '', gcs: 15, creatinine_umol_l: '', urine_output_ml_24h: '', on_ventilator: false, previous_sofa: '' });
  const [ventForm, setVentForm] = useState({ mode: 'AC_VC', tidalVolumeMl: '', rate: 14, fio2Pct: 40, peepCmh2o: 5, spo2Pct: '', notes: '' });
  const [ventCdssForm, setVentCdssForm] = useState({ weight_kg: 70, height_cm: 170, sex: 'male', pao2_mmhg: '', fio2_pct: 60, ph: '', paco2_mmhg: '', peep_current: 5, diagnosis: 'ARDS', compliance_ml_cmh2o: '' });
  const [sedForm, setSedForm] = useState({ rassTarget: -2, rassActual: 0, camIcuResult: 'negative', analgesic: '', sedative: '', notes: '' });
  const [sedCdssForm, setSedCdssForm] = useState({ rass_actual: 0, rass_target: -2, cam_icu_positive: false, has_pain: false, cpot_score: '', icu_day: 1 });
  const [lineForm, setLineForm] = useState({ lineType: 'CVL', site: 'right_IJV', insertionDate: new Date().toISOString().split('T')[0], indication: '', notes: '' });
  const [vasoForm, setVasoForm] = useState({ drug: 'noradrenaline', dose: '', unit: 'mcg/kg/min', startTime: new Date().toISOString().slice(0, 16), notes: '' });

  const load = () => {
    getIcuAdmissions(patientId, tenantSubdomain).then(r => setAdmissions(r.data || []));
    getIcuSofa(patientId, tenantSubdomain).then(r => setSofaScores(r.data || []));
    getIcuVent(patientId, tenantSubdomain).then(r => setVentSettings(r.data || []));
    getIcuSedation(patientId, tenantSubdomain).then(r => setSedation(r.data || []));
    getIcuLines(patientId, tenantSubdomain).then(r => setLines(r.data || []));
    getIcuVasopressors(patientId, tenantSubdomain).then(r => setVasopressors(r.data || []));
  };

  useEffect(() => { load(); }, [patientId]);

  const latestSofa = sofaScores[0];
  const latestVent = ventSettings[0];
  const latestSed = sedation[0];
  const activeVaso = vasopressors.filter(v => !v.stopTime);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'sofa', label: 'SOFA Score' },
    { id: 'vent', label: 'Ventilator' },
    { id: 'sedation', label: 'Sedation' },
    { id: 'lines', label: 'Lines' },
    { id: 'vasopressors', label: 'Vasopressors' },
  ];

  const sofaColour = (score: number) =>
    score >= 12 ? 'text-red-700 font-bold' : score >= 8 ? 'text-orange-600 font-semibold' : score >= 4 ? 'text-yellow-600' : 'text-green-700';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t.id ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Admission banner */}
          {admissions[0] && !admissions[0].icuDischargeDate && (
            <div className="bg-red-50 border border-red-300 rounded p-3 text-sm">
              <span className="font-semibold text-red-800">ICU Admission Active</span>
              <span className="text-red-700 ml-2">since {new Date(admissions[0].icuAdmissionDate).toLocaleString()}</span>
              {admissions[0].primaryDiagnosis && <span className="text-red-700"> — {admissions[0].primaryDiagnosis}</span>}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {latestSofa && (
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <div className="text-xs text-slate-500 font-medium">Latest SOFA</div>
                <div className={`text-3xl font-bold ${sofaColour(latestSofa.totalSofa)}`}>{latestSofa.totalSofa}</div>
                <div className="text-xs text-slate-400">{new Date(latestSofa.scoredAt).toLocaleTimeString()}</div>
              </div>
            )}
            {latestVent && (
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <div className="text-xs text-slate-500 font-medium">Ventilator Mode</div>
                <div className="text-lg font-bold text-slate-700">{latestVent.mode}</div>
                <div className="text-xs text-slate-400">FiO₂ {latestVent.fio2Pct}% · PEEP {latestVent.peepCmh2o}</div>
              </div>
            )}
            {latestSed && (
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <div className="text-xs text-slate-500 font-medium">RASS</div>
                <div className={`text-lg font-bold ${latestSed.rassActual !== latestSed.rassTarget ? 'text-orange-600' : 'text-green-700'}`}>
                  {latestSed.rassActual !== undefined ? latestSed.rassActual : '—'}
                </div>
                <div className="text-xs text-slate-400">Target: {latestSed.rassTarget}</div>
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded p-3">
              <div className="text-xs text-slate-500 font-medium">Active Vasopressors</div>
              <div className="text-2xl font-bold text-slate-700">{activeVaso.length}</div>
              <div className="text-xs text-slate-400 truncate">{activeVaso.map(v => v.drug).join(', ')}</div>
            </div>
          </div>

          {/* ICU Admission Form */}
          {admissions.length === 0 || admissions[0]?.icuDischargeDate ? (
            <div className="bg-white border border-gray-200 rounded p-4">
              <div className="font-semibold text-sm text-gray-700 mb-3">Admit to ICU</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Admission Date/Time</label>
                  <input type="datetime-local" value={admForm.icuAdmissionDate}
                    onChange={e => setAdmForm(p => ({ ...p, icuAdmissionDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Admission Source</label>
                  <select value={admForm.admissionSource} onChange={e => setAdmForm(p => ({ ...p, admissionSource: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                    {['ED', 'Ward', 'Theatre', 'HDU', 'External transfer', 'Direct'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Primary Diagnosis</label>
                  <input type="text" value={admForm.primaryDiagnosis}
                    onChange={e => setAdmForm(p => ({ ...p, primaryDiagnosis: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">APACHE II Score</label>
                  <input type="number" min={0} max={71} value={admForm.apacheIiScore}
                    onChange={e => setAdmForm(p => ({ ...p, apacheIiScore: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <button onClick={() =>
                addIcuAdmission(patientId, {
                  ...admForm,
                  apacheIiScore: admForm.apacheIiScore ? Number(admForm.apacheIiScore) : undefined,
                }, tenantSubdomain).then(() => load())}
                className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-800">
                Admit Patient
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* SOFA */}
      {tab === 'sofa' && (
        <div className="space-y-4">
          {/* SOFA CDSS */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">SOFA Calculator (SEPSIS-3)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              {[
                { key: 'pao2_fio2', label: 'PaO₂/FiO₂ ratio' },
                { key: 'platelets_x10_9', label: 'Platelets (×10⁹/L)' },
                { key: 'bilirubin_umol_l', label: 'Bilirubin (μmol/L)' },
                { key: 'map_mmhg', label: 'MAP (mmHg)' },
                { key: 'creatinine_umol_l', label: 'Creatinine (μmol/L)' },
                { key: 'urine_output_ml_24h', label: 'Urine Output (ml/24h)' },
                { key: 'previous_sofa', label: 'Previous SOFA' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type="number" value={(sofaCdssForm as any)[f.key]}
                    onChange={e => setSofaCdssForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">GCS</label>
                <input type="number" min={3} max={15} value={sofaCdssForm.gcs}
                  onChange={e => setSofaCdssForm(p => ({ ...p, gcs: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="flex items-center mt-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={sofaCdssForm.on_ventilator}
                    onChange={e => setSofaCdssForm(p => ({ ...p, on_ventilator: e.target.checked }))} />
                  On ventilator
                </label>
              </div>
            </div>
            <button onClick={() => {
              const payload = {
                ...sofaCdssForm,
                pao2_fio2: sofaCdssForm.pao2_fio2 ? Number(sofaCdssForm.pao2_fio2) : undefined,
                platelets_x10_9: sofaCdssForm.platelets_x10_9 ? Number(sofaCdssForm.platelets_x10_9) : undefined,
                bilirubin_umol_l: sofaCdssForm.bilirubin_umol_l ? Number(sofaCdssForm.bilirubin_umol_l) : undefined,
                map_mmhg: sofaCdssForm.map_mmhg ? Number(sofaCdssForm.map_mmhg) : undefined,
                creatinine_umol_l: sofaCdssForm.creatinine_umol_l ? Number(sofaCdssForm.creatinine_umol_l) : undefined,
                urine_output_ml_24h: sofaCdssForm.urine_output_ml_24h ? Number(sofaCdssForm.urine_output_ml_24h) : undefined,
                previous_sofa: sofaCdssForm.previous_sofa ? Number(sofaCdssForm.previous_sofa) : undefined,
              };
              cdssIcuSofa(payload).then(r => setSofaResult(r.data));
            }}
              className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-800">
              Calculate SOFA
            </button>
            {sofaResult && (
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3 text-sm space-y-1">
                <div className={`font-semibold text-lg ${sofaColour(sofaResult.total_sofa)}`}>
                  Total SOFA: {sofaResult.total_sofa} &nbsp;|&nbsp; Mortality: {sofaResult.estimated_mortality}
                  {sofaResult.delta_sofa !== null && sofaResult.delta_sofa !== undefined && (
                    <span className="text-sm ml-2">(Δ{sofaResult.delta_sofa >= 0 ? '+' : ''}{sofaResult.delta_sofa})</span>
                  )}
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {Object.entries(sofaResult.domain_scores || {}).map(([k, v]: any) => (
                    <div key={k} className="text-center">
                      <div className="text-xs text-gray-500 capitalize">{k}</div>
                      <div className={`text-lg font-semibold ${v >= 3 ? 'text-red-600' : v >= 2 ? 'text-orange-500' : 'text-green-600'}`}>{v ?? '—'}</div>
                    </div>
                  ))}
                </div>
                {(sofaResult.alerts || []).map((a: string, i: number) => (
                  <div key={i} className="text-red-700 text-xs">⚠ {a}</div>
                ))}
                <button className="text-xs underline opacity-70"
                  onClick={() => addIcuSofa(patientId, {
                    totalSofa: sofaResult.total_sofa, deltaSofa: sofaResult.delta_sofa,
                    ...Object.fromEntries(Object.entries(sofaResult.domain_scores).map(([k, v]) => [k, v])),
                    scoredAt: new Date().toISOString(),
                  }, tenantSubdomain).then(() => load())}>
                  Save SOFA Score
                </button>
              </div>
            )}
          </div>

          {/* SOFA history */}
          {sofaScores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Time', 'Resp', 'Coag', 'Liver', 'CV', 'CNS', 'Renal', 'Total', 'Δ'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sofaScores.slice(0, 12).map(s => (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">{new Date(s.scoredAt).toLocaleString()}</td>
                      <td className="px-2 py-1.5">{s.respiration ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.coagulation ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.liver ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.cardiovascular ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.cns ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.renal ?? '—'}</td>
                      <td className={`px-2 py-1.5 font-bold ${sofaColour(s.totalSofa)}`}>{s.totalSofa}</td>
                      <td className="px-2 py-1.5">{s.deltaSofa !== null ? (s.deltaSofa >= 0 ? '+' : '') + s.deltaSofa : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VENTILATOR */}
      {tab === 'vent' && (
        <div className="space-y-4">
          {/* ARDSNet CDSS */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">ARDSNet Lung-Protective Ventilation Protocol</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              {[
                { key: 'weight_kg', label: 'Weight (kg)' },
                { key: 'height_cm', label: 'Height (cm)' },
                { key: 'pao2_mmhg', label: 'PaO₂ (mmHg)' },
                { key: 'fio2_pct', label: 'FiO₂ (%)' },
                { key: 'ph', label: 'pH' },
                { key: 'paco2_mmhg', label: 'PaCO₂ (mmHg)' },
                { key: 'peep_current', label: 'Current PEEP' },
                { key: 'compliance_ml_cmh2o', label: 'Compliance (ml/cmH₂O)' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type="number" step="0.01" value={(ventCdssForm as any)[f.key]}
                    onChange={e => setVentCdssForm(p => ({ ...p, [f.key]: e.target.value ? Number(e.target.value) : '' }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sex</label>
                <select value={ventCdssForm.sex} onChange={e => setVentCdssForm(p => ({ ...p, sex: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Diagnosis</label>
                <select value={ventCdssForm.diagnosis} onChange={e => setVentCdssForm(p => ({ ...p, diagnosis: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['ARDS', 'COPD', 'asthma', 'neuromuscular', 'post_op'].map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => cdssIcuVent(ventCdssForm).then(r => setVentResult(r.data))}
              className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-800">
              Calculate Protocol
            </button>
            {ventResult && (
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3 text-sm space-y-1">
                <div className="font-semibold text-slate-800">PBW: {ventResult.pbw_kg} kg</div>
                <div className="text-slate-700">TV Target: <strong>{ventResult.tv_target_6mlkg_ml} ml</strong> (6 ml/kg PBW) &nbsp;|&nbsp; Max: {ventResult.tv_max_8mlkg_ml} ml</div>
                <div className="text-slate-700">Recommended PEEP: <strong>{ventResult.recommended_peep_cmh2o} cmH₂O</strong> &nbsp;|&nbsp; Rate: {ventResult.recommended_rate}</div>
                {ventResult.pao2_fio2_ratio && <div className="text-slate-700">P/F Ratio: {ventResult.pao2_fio2_ratio} — ARDS: <span className="font-medium capitalize">{(ventResult.ards_severity || '').replace('_', ' ')}</span></div>}
                {ventResult.plateau_pressure_alert && <div className="text-orange-600 text-xs">⚠ {ventResult.plateau_pressure_alert}</div>}
                {ventResult.ph_note && <div className="text-orange-600 text-xs">⚠ {ventResult.ph_note}</div>}
                {ventResult.prone_positioning && <div className="text-blue-600 text-xs">• {ventResult.prone_positioning}</div>}
                {(ventResult.diagnosis_specific_notes || []).map((n: string, i: number) => <div key={i} className="text-slate-600 text-xs">• {n}</div>)}
              </div>
            )}
          </div>

          {/* Record vent settings */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Record Ventilator Settings</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mode</label>
                <select value={ventForm.mode} onChange={e => setVentForm(p => ({ ...p, mode: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['AC_VC','AC_PC','SIMV','CPAP','PRVC','BiPAP','HFNC','NIV_CPAP','NIV_BiPAP'].map(m => <option key={m} value={m}>{m.replace('_', '-')}</option>)}
                </select>
              </div>
              {[
                { key: 'tidalVolumeMl', label: 'TV (ml)' },
                { key: 'rate', label: 'Rate' },
                { key: 'fio2Pct', label: 'FiO₂ (%)' },
                { key: 'peepCmh2o', label: 'PEEP (cmH₂O)' },
                { key: 'spo2Pct', label: 'SpO₂ (%)' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type="number" value={(ventForm as any)[f.key]}
                    onChange={e => setVentForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
            </div>
            <button onClick={() =>
              addIcuVent(patientId, {
                ...ventForm,
                tidalVolumeMl: ventForm.tidalVolumeMl ? Number(ventForm.tidalVolumeMl) : undefined,
                fio2Pct: Number(ventForm.fio2Pct),
                peepCmh2o: Number(ventForm.peepCmh2o),
                spo2Pct: ventForm.spo2Pct ? Number(ventForm.spo2Pct) : undefined,
                recordedAt: new Date().toISOString(),
              }, tenantSubdomain).then(() => load())}
              className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-800">
              Save Settings
            </button>
          </div>

          {ventSettings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Time', 'Mode', 'TV (ml)', 'Rate', 'FiO₂%', 'PEEP', 'SpO₂'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {ventSettings.slice(0, 12).map(v => (
                    <tr key={v.id} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">{new Date(v.recordedAt).toLocaleString()}</td>
                      <td className="px-2 py-1.5 font-medium">{(v.mode || '').replace('_', '-')}</td>
                      <td className="px-2 py-1.5">{v.tidalVolumeMl ?? '—'}</td>
                      <td className="px-2 py-1.5">{v.rate ?? '—'}</td>
                      <td className="px-2 py-1.5">{v.fio2Pct ?? '—'}</td>
                      <td className="px-2 py-1.5">{v.peepCmh2o ?? '—'}</td>
                      <td className={`px-2 py-1.5 ${v.spo2Pct && v.spo2Pct < 90 ? 'text-red-600 font-bold' : ''}`}>{v.spo2Pct ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SEDATION */}
      {tab === 'sedation' && (
        <div className="space-y-4">
          {/* PADIS CDSS */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Analgesia-Sedation Assessment (PADIS 2018)</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">RASS Actual ({sedCdssForm.rass_actual})</label>
                <input type="range" min={-5} max={4} value={sedCdssForm.rass_actual}
                  onChange={e => setSedCdssForm(p => ({ ...p, rass_actual: Number(e.target.value) }))}
                  className="w-full" />
                <div className="text-xs text-center text-gray-600">{RASS_LABELS[sedCdssForm.rass_actual]}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">RASS Target ({sedCdssForm.rass_target})</label>
                <input type="range" min={-5} max={4} value={sedCdssForm.rass_target}
                  onChange={e => setSedCdssForm(p => ({ ...p, rass_target: Number(e.target.value) }))}
                  className="w-full" />
                <div className="text-xs text-center text-gray-600">{RASS_LABELS[sedCdssForm.rass_target]}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ICU Day</label>
                <input type="number" min={1} value={sedCdssForm.icu_day}
                  onChange={e => setSedCdssForm(p => ({ ...p, icu_day: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="space-y-1">
                {[
                  { key: 'cam_icu_positive', label: 'CAM-ICU positive (delirium)' },
                  { key: 'has_pain', label: 'Patient has pain (CPOT ≥3)' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={(sedCdssForm as any)[f.key]}
                      onChange={e => setSedCdssForm(p => ({ ...p, [f.key]: e.target.checked }))} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => cdssIcuSedation(sedCdssForm).then(r => setSedResult(r.data))}
              className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-800">
              Assess Sedation
            </button>
            {sedResult && (
              <div className="mt-3 space-y-2 text-sm">
                {(sedResult.alerts || []).map((a: string, i: number) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded px-3 py-2 text-red-700 text-xs">⚠ {a}</div>
                ))}
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="font-semibold text-slate-700 mb-1">RASS: {sedResult.rass_interpretation} &nbsp;|&nbsp; CAM-ICU: {sedResult.cam_icu} &nbsp;{sedResult.sbt_candidate ? '| ✓ SBT Candidate' : ''}</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                    {(sedResult.recommendations || []).map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                  <div className="text-xs text-gray-400 italic mt-1">{sedResult.guideline}</div>
                </div>
              </div>
            )}
          </div>

          {/* Record sedation */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Record Sedation Assessment</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">RASS Target</label>
                <input type="number" min={-5} max={4} value={sedForm.rassTarget}
                  onChange={e => setSedForm(p => ({ ...p, rassTarget: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">RASS Actual</label>
                <input type="number" min={-5} max={4} value={sedForm.rassActual}
                  onChange={e => setSedForm(p => ({ ...p, rassActual: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CAM-ICU</label>
                <select value={sedForm.camIcuResult} onChange={e => setSedForm(p => ({ ...p, camIcuResult: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['negative', 'positive', 'unable_to_assess'].map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Analgesic</label>
                <input type="text" placeholder="e.g. fentanyl 25mcg/h" value={sedForm.analgesic}
                  onChange={e => setSedForm(p => ({ ...p, analgesic: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sedative</label>
                <input type="text" placeholder="e.g. propofol 10mcg/kg/min" value={sedForm.sedative}
                  onChange={e => setSedForm(p => ({ ...p, sedative: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addIcuSedation(patientId, {
                ...sedForm,
                analgesic: sedForm.analgesic ? { drug: sedForm.analgesic } : {},
                sedative: sedForm.sedative ? { drug: sedForm.sedative } : {},
                recordedAt: new Date().toISOString(),
              }, tenantSubdomain).then(() => load())}
              className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-800">
              Save Assessment
            </button>
          </div>
        </div>
      )}

      {/* LINES */}
      {tab === 'lines' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Central Line / Vascular Access</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Line Type</label>
                <select value={lineForm.lineType} onChange={e => setLineForm(p => ({ ...p, lineType: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['CVL', 'arterial', 'PICC', 'Midline', 'PA_catheter', 'dialysis'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Site</label>
                <input type="text" placeholder="e.g. right IJV" value={lineForm.site}
                  onChange={e => setLineForm(p => ({ ...p, site: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Insertion Date</label>
                <input type="date" value={lineForm.insertionDate}
                  onChange={e => setLineForm(p => ({ ...p, insertionDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Indication</label>
                <input type="text" value={lineForm.indication}
                  onChange={e => setLineForm(p => ({ ...p, indication: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addIcuLine(patientId, { ...lineForm, insertedBy: providerId }, tenantSubdomain).then(() => load())}
              className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-800">
              Add Line
            </button>
          </div>

          {lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Type', 'Site', 'Inserted', 'Removed', 'Indication', 'Days In'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {lines.map(l => {
                    const daysIn = l.removalDate
                      ? Math.round((new Date(l.removalDate).getTime() - new Date(l.insertionDate).getTime()) / 86400000)
                      : Math.round((Date.now() - new Date(l.insertionDate).getTime()) / 86400000);
                    return (
                      <tr key={l.id} className={`border-t border-gray-100 ${!l.removalDate && daysIn > 7 ? 'bg-yellow-50' : ''}`}>
                        <td className="px-3 py-2 font-medium">{l.lineType}</td>
                        <td className="px-3 py-2">{l.site}</td>
                        <td className="px-3 py-2">{l.insertionDate}</td>
                        <td className="px-3 py-2">{l.removalDate || <span className="text-green-600">In situ</span>}</td>
                        <td className="px-3 py-2 max-w-xs truncate">{l.indication}</td>
                        <td className={`px-3 py-2 font-semibold ${daysIn > 7 ? 'text-orange-600' : ''}`}>{daysIn}d</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VASOPRESSORS */}
      {tab === 'vasopressors' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="font-semibold text-sm text-gray-700 mb-3">Add Vasopressor / Inotrope</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Drug</label>
                <select value={vasoForm.drug} onChange={e => setVasoForm(p => ({ ...p, drug: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['noradrenaline', 'adrenaline', 'vasopressin', 'dopamine', 'dobutamine', 'phenylephrine', 'milrinone', 'levosimendan'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Starting Dose</label>
                <input type="number" step={0.01} value={vasoForm.dose}
                  onChange={e => setVasoForm(p => ({ ...p, dose: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Unit</label>
                <select value={vasoForm.unit} onChange={e => setVasoForm(p => ({ ...p, unit: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                  {['mcg/kg/min', 'mcg/min', 'units/min', 'mcg/h'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                <input type="datetime-local" value={vasoForm.startTime}
                  onChange={e => setVasoForm(p => ({ ...p, startTime: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <button onClick={() =>
              addIcuVasopressor(patientId, { ...vasoForm, dose: vasoForm.dose ? Number(vasoForm.dose) : undefined }, tenantSubdomain).then(() => load())}
              className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-800">
              Add Vasopressor
            </button>
          </div>

          {vasopressors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>{['Drug', 'Dose', 'Unit', 'Start', 'Stop', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {vasopressors.map(v => (
                    <tr key={v.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium capitalize">{v.drug}</td>
                      <td className="px-3 py-2">{v.dose ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{v.unit}</td>
                      <td className="px-3 py-2 text-xs">{new Date(v.startTime).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs">{v.stopTime ? new Date(v.stopTime).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${!v.stopTime ? 'bg-red-100 text-red-700 font-medium' : 'bg-gray-100 text-gray-500'}`}>
                          {!v.stopTime ? 'Active' : 'Stopped'}
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
    </div>
  );
}
