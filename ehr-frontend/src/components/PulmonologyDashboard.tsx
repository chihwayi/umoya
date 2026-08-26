import React, { useState, useEffect, useCallback } from 'react';
import { cdssApi } from '../services/api';
import { Wind, Activity, TrendingUp, Droplets, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

type Tab = 'overview' | 'spirometry' | 'copd' | 'asthma' | 'peakflow' | 'oxygen';

const GOLD_COLOURS: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-orange-100 text-orange-800',
  4: 'bg-red-100 text-red-800',
};

const CONTROL_COLOURS: Record<string, string> = {
  controlled: 'bg-green-100 text-green-800',
  partly_controlled: 'bg-yellow-100 text-yellow-800',
  uncontrolled: 'bg-red-100 text-red-800',
};

const ZONE_COLOURS: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
};

export default function PulmonologyDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [spirometry, setSpirometry] = useState<any[]>([]);
  const [copd, setCopd] = useState<any[]>([]);
  const [asthma, setAsthma] = useState<any[]>([]);
  const [peakFlow, setPeakFlow] = useState<any[]>([]);
  const [oxygen, setOxygen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // CDSS
  const [spiroResult, setSpiroResult] = useState<any>(null);
  const [stepResult, setStepResult] = useState<any>(null);
  const [o2Result, setO2Result] = useState<any>(null);

  // Forms
  const [spiroForm, setSpiroForm] = useState({ fev1: '', fvc: '', fev1_fvc_ratio: '', fev1_percent_predicted: '', fvc_percent_predicted: '', pre_post_bronchodilator: false, reversibility_percent: '', gold_stage: '', interpretation: 'obstructive', notes: '' });
  const [copdForm, setCopdForm] = useState({ cat_score: '', mmrc_dyspnea: '', abcd_group: 'A', exacerbations_last_year: '0', hospitalizations_last_year: '0', smoking_pack_years: '', smoking_status: 'current', oxygen_at_home: false, notes: '' });
  const [asthmaForm, setAsthmaForm] = useState({ act_score: '', severity: 'mild_persistent', control: 'partly_controlled', gina_step: '2', nocturnal_symptoms: false, reliever_puffs_per_week: '', oral_steroid_courses_last_year: '0', eosinophil_count: '', ige_total: '', notes: '' });
  const [pefForm, setPefForm] = useState({ pef_value: '', percent_predicted: '', medication_taken: '', notes: '' });
  const [o2Form, setO2Form] = useState({ delivery_device: 'nasal_cannula', flow_rate_lpm: '', target_spo2_min: '88', target_spo2_max: '92', indication: '', status: 'active', notes: '' });
  const [o2CdssForm, setO2CdssForm] = useState({ indication: 'hypoxaemia', spo2_resting: '', copd_diagnosis: false, type2_respiratory_failure: false });
  const [stepCdssForm, setStepCdssForm] = useState({ current_gina_step: 2, control: 'uncontrolled', act_score: '', eosinophil_count: '', pregnancy: false, smoking: false });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const labels = ['spirometry', 'COPD', 'asthma', 'peak flow', 'oxygen therapy'];
    const results = await Promise.allSettled([
      cdssApi.getPulmonologySpirometry(patientId, tenantSubdomain),
      cdssApi.getPulmonologyCopd(patientId, tenantSubdomain),
      cdssApi.getPulmonologyAsthma(patientId, tenantSubdomain),
      cdssApi.getPulmonologyPeakFlow(patientId, tenantSubdomain),
      cdssApi.getPulmonologyOxygen(patientId, tenantSubdomain),
    ]);

    const setters = [setSpirometry, setCopd, setAsthma, setPeakFlow, setOxygen];
    const failedLabels: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        setters[i](result.value);
      } else {
        failedLabels.push(labels[i]);
      }
    });

    if (failedLabels.length > 0) {
      setLoadError(`Failed to load: ${failedLabels.join(', ')}. Data shown may be incomplete.`);
    }
    setLoading(false);
  }, [patientId, tenantSubdomain]);

  useEffect(() => { load(); }, [load]);

  // ── Overview ───────────────────────────────────────────────────────────────

  const latestSpiro = spirometry[0];
  const latestCopd = copd[0];
  const latestAsthma = asthma[0];
  const activeO2 = oxygen.find(o => o.status === 'active');
  const recentPef = peakFlow.slice(0, 7);

  if (loading) return <div className="text-center py-10 text-slate-500">Loading…</div>;

  return (
    <div>
      {loadError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {loadError}
          </div>
          <button onClick={load} className="text-xs font-semibold text-red-700 hover:underline flex-shrink-0">
            Retry
          </button>
        </div>
      )}
      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-6 border-b border-slate-200">
        {(['overview', 'spirometry', 'copd', 'asthma', 'peakflow', 'oxygen'] as Tab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t capitalize transition ${activeTab === t ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {t === 'peakflow' ? 'Peak Flow' : t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreCard label="Spirometry Tests" value={spirometry.length} icon={<Wind className="w-5 h-5" />} color="sky" />
            <ScoreCard label="COPD Assessments" value={copd.length} icon={<Activity className="w-5 h-5" />} color="orange" />
            <ScoreCard label="Asthma Records" value={asthma.length} icon={<TrendingUp className="w-5 h-5" />} color="purple" />
            <ScoreCard label="Peak Flow Entries" value={peakFlow.length} icon={<Droplets className="w-5 h-5" />} color="green" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {latestSpiro && (
              <div className="bg-sky-50 rounded-xl p-4 border border-sky-200">
                <h3 className="font-semibold text-sky-900 mb-2">Latest Spirometry</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Pattern</span><span className="font-medium capitalize">{latestSpiro.interpretation}</span></div>
                  {latestSpiro.goldStage && <div className="flex justify-between"><span>GOLD Stage</span><span className={`px-2 py-0.5 rounded text-xs font-bold ${GOLD_COLOURS[latestSpiro.goldStage]}`}>{latestSpiro.goldStage}</span></div>}
                  {latestSpiro.fev1PercentPredicted && <div className="flex justify-between"><span>FEV1 % pred</span><span>{latestSpiro.fev1PercentPredicted}%</span></div>}
                  {latestSpiro.fev1FvcRatio && <div className="flex justify-between"><span>FEV1/FVC</span><span>{latestSpiro.fev1FvcRatio}</span></div>}
                </div>
              </div>
            )}
            {latestAsthma && (
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <h3 className="font-semibold text-purple-900 mb-2">Asthma Control</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Control</span><span className={`px-2 py-0.5 rounded text-xs font-bold ${CONTROL_COLOURS[latestAsthma.control]}`}>{latestAsthma.control.replace('_', ' ')}</span></div>
                  {latestAsthma.actScore && <div className="flex justify-between"><span>ACT Score</span><span className="font-medium">{latestAsthma.actScore}/25</span></div>}
                  {latestAsthma.ginaStep && <div className="flex justify-between"><span>GINA Step</span><span>{latestAsthma.ginaStep}</span></div>}
                </div>
              </div>
            )}
          </div>

          {activeO2 && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <span className="font-semibold text-blue-900">Active O₂ Therapy</span>
                <span className="ml-2 text-sm text-blue-700">{activeO2.deliveryDevice?.replace(/_/g, ' ')} @ {activeO2.flowRateLpm} L/min — Target SpO₂ {activeO2.targetSpo2Min}–{activeO2.targetSpo2Max}%</span>
              </div>
            </div>
          )}

          {recentPef.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-2">Peak Flow (last 7 entries)</h3>
              <div className="flex gap-2 items-end h-24">
                {recentPef.map((p, i) => {
                  const zone = p.zone || (p.percentPredicted >= 80 ? 'green' : p.percentPredicted >= 50 ? 'yellow' : 'red');
                  const h = Math.max(8, Math.round((p.pefValue / 700) * 80));
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`w-8 rounded-t ${ZONE_COLOURS[zone] || 'bg-slate-300'}`} style={{ height: h }} title={`${p.pefValue} L/min`} />
                      <span className="text-xs text-slate-500">{String(p.pefValue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SPIROMETRY ───────────────────────────────────────────────────── */}
      {activeTab === 'spirometry' && (
        <div className="space-y-6">
          {/* CDSS Interpreter */}
          <div className="bg-sky-50 rounded-xl p-4 border border-sky-200">
            <h3 className="font-semibold text-sky-900 mb-3">CDSS — Spirometry Interpreter</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[['fev1', 'FEV1 (L)'], ['fvc', 'FVC (L)'], ['fev1_fvc_ratio', 'FEV1/FVC'], ['fev1_percent_predicted', 'FEV1 % pred'], ['fvc_percent_predicted', 'FVC % pred'], ['reversibility_percent', 'Reversibility %']].map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-sky-700">{label}</label>
                  <input type="number" step="0.01" value={(spiroForm as any)[k]} onChange={e => setSpiroForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-sky-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="bd" checked={spiroForm.pre_post_bronchodilator} onChange={e => setSpiroForm(f => ({ ...f, pre_post_bronchodilator: e.target.checked }))} />
                <label htmlFor="bd" className="text-sm text-sky-800">Post-BD</label>
              </div>
            </div>
            <button onClick={async () => {
              const r = await cdssApi.interpretPulmonologySpirometry({
                fev1: spiroForm.fev1 ? +spiroForm.fev1 : undefined,
                fvc: spiroForm.fvc ? +spiroForm.fvc : undefined,
                fev1_fvc_ratio: spiroForm.fev1_fvc_ratio ? +spiroForm.fev1_fvc_ratio : undefined,
                fev1_percent_predicted: spiroForm.fev1_percent_predicted ? +spiroForm.fev1_percent_predicted : undefined,
                fvc_percent_predicted: spiroForm.fvc_percent_predicted ? +spiroForm.fvc_percent_predicted : undefined,
                pre_post_bronchodilator: spiroForm.pre_post_bronchodilator,
                reversibility_percent: spiroForm.reversibility_percent ? +spiroForm.reversibility_percent : undefined,
              });
              setSpiroResult(r);
            }} className="bg-sky-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Interpret</button>
            {spiroResult && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-sky-200 font-semibold capitalize">{spiroResult.pattern}</span>
                  {spiroResult.gold_label && <span className={`px-2 py-0.5 rounded text-xs font-bold ${GOLD_COLOURS[spiroResult.gold_stage]}`}>{spiroResult.gold_label}</span>}
                  {spiroResult.reversible && <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">Reversible</span>}
                </div>
                <p className="text-slate-700">{spiroResult.pattern_detail}</p>
                {spiroResult.dlco_note && <p className="text-slate-600 italic">{spiroResult.dlco_note}</p>}
                {spiroResult.recommendations?.length > 0 && (
                  <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                    {spiroResult.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Record Form */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Record Spirometry</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[['fev1', 'FEV1 (L)'], ['fvc', 'FVC (L)'], ['fev1_fvc_ratio', 'FEV1/FVC'], ['fev1_percent_predicted', 'FEV1 % pred'], ['fvc_percent_predicted', 'FVC % pred'], ['gold_stage', 'GOLD Stage (1-4)']].map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-slate-500">{label}</label>
                  <input type="number" step="0.01" value={(spiroForm as any)[k]} onChange={e => setSpiroForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-500">Pattern</label>
                <select value={spiroForm.interpretation} onChange={e => setSpiroForm(f => ({ ...f, interpretation: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['normal', 'obstructive', 'restrictive', 'mixed'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <textarea value={spiroForm.notes} onChange={e => setSpiroForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" rows={2}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm mb-3" />
            <button onClick={async () => {
              await cdssApi.addPulmonologySpirometry(patientId, tenantSubdomain, {
                performedBy: providerId,
                testDate: new Date().toISOString(),
                fev1: spiroForm.fev1 ? +spiroForm.fev1 : null,
                fvc: spiroForm.fvc ? +spiroForm.fvc : null,
                fev1FvcRatio: spiroForm.fev1_fvc_ratio ? +spiroForm.fev1_fvc_ratio : null,
                fev1PercentPredicted: spiroForm.fev1_percent_predicted ? +spiroForm.fev1_percent_predicted : null,
                fvcPercentPredicted: spiroForm.fvc_percent_predicted ? +spiroForm.fvc_percent_predicted : null,
                goldStage: spiroForm.gold_stage ? +spiroForm.gold_stage : null,
                interpretation: spiroForm.interpretation,
                prePostBronchodilator: spiroForm.pre_post_bronchodilator,
                notes: spiroForm.notes || null,
              });
              load();
            }} className="bg-sky-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          {/* History */}
          <div className="space-y-2">
            {spirometry.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div>
                  <span className="font-medium capitalize">{s.interpretation}</span>
                  {s.goldStage && <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${GOLD_COLOURS[s.goldStage]}`}>GOLD {s.goldStage}</span>}
                  <span className="ml-2 text-slate-500">{s.fev1 && `FEV1 ${s.fev1}L`} {s.fev1PercentPredicted && `(${s.fev1PercentPredicted}%)`}</span>
                </div>
                <span className="text-slate-400">{new Date(s.testDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── COPD ─────────────────────────────────────────────────────────── */}
      {activeTab === 'copd' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">COPD Assessment (CAT / MMRC / ABCD)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-500">CAT Score (0–40)</label>
                <input type="number" min={0} max={40} value={copdForm.cat_score} onChange={e => setCopdForm(f => ({ ...f, cat_score: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">mMRC Dyspnoea (0–4)</label>
                <input type="number" min={0} max={4} value={copdForm.mmrc_dyspnea} onChange={e => setCopdForm(f => ({ ...f, mmrc_dyspnea: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">ABCD Group</label>
                <select value={copdForm.abcd_group} onChange={e => setCopdForm(f => ({ ...f, abcd_group: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['A', 'B', 'C', 'D'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Exacerbations last yr</label>
                <input type="number" min={0} value={copdForm.exacerbations_last_year} onChange={e => setCopdForm(f => ({ ...f, exacerbations_last_year: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Hospitalisations last yr</label>
                <input type="number" min={0} value={copdForm.hospitalizations_last_year} onChange={e => setCopdForm(f => ({ ...f, hospitalizations_last_year: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Pack-years</label>
                <input type="number" step="0.5" value={copdForm.smoking_pack_years} onChange={e => setCopdForm(f => ({ ...f, smoking_pack_years: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Smoking Status</label>
                <select value={copdForm.smoking_status} onChange={e => setCopdForm(f => ({ ...f, smoking_status: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['current', 'ex', 'never'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="o2home" checked={copdForm.oxygen_at_home} onChange={e => setCopdForm(f => ({ ...f, oxygen_at_home: e.target.checked }))} />
                <label htmlFor="o2home" className="text-sm">O₂ at home</label>
              </div>
            </div>
            <textarea value={copdForm.notes} onChange={e => setCopdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" rows={2}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm mb-3" />
            <button onClick={async () => {
              await cdssApi.addPulmonologyCopd(patientId, tenantSubdomain, {
                assessedBy: providerId,
                assessmentDate: new Date().toISOString(),
                catScore: copdForm.cat_score ? +copdForm.cat_score : null,
                mmrcDyspnea: copdForm.mmrc_dyspnea ? +copdForm.mmrc_dyspnea : null,
                abcdGroup: copdForm.abcd_group,
                exacerbationsLastYear: +copdForm.exacerbations_last_year,
                hospitalizationsLastYear: +copdForm.hospitalizations_last_year,
                smokingPackYears: copdForm.smoking_pack_years ? +copdForm.smoking_pack_years : null,
                smokingStatus: copdForm.smoking_status,
                oxygenAtHome: copdForm.oxygen_at_home,
                notes: copdForm.notes || null,
              });
              load();
            }} className="bg-orange-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {copd.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div>
                  <span className="font-medium">Group {c.abcdGroup}</span>
                  <span className="ml-2 text-slate-500">CAT {c.catScore} | mMRC {c.mmrcDyspnea}</span>
                  <span className="ml-2 text-slate-400">{c.exacerbationsLastYear} exacerbations</span>
                </div>
                <span className="text-slate-400">{new Date(c.assessmentDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ASTHMA ───────────────────────────────────────────────────────── */}
      {activeTab === 'asthma' && (
        <div className="space-y-6">
          {/* GINA Step-Up CDSS */}
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <h3 className="font-semibold text-purple-900 mb-3">CDSS — GINA Step-Up / Step-Down</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs text-purple-700">Current GINA Step</label>
                <input type="number" min={1} max={5} value={stepCdssForm.current_gina_step} onChange={e => setStepCdssForm(f => ({ ...f, current_gina_step: +e.target.value }))}
                  className="w-full border border-purple-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-purple-700">Control</label>
                <select value={stepCdssForm.control} onChange={e => setStepCdssForm(f => ({ ...f, control: e.target.value }))}
                  className="w-full border border-purple-300 rounded px-2 py-1 text-sm">
                  {['controlled', 'partly_controlled', 'uncontrolled'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-purple-700">ACT Score</label>
                <input type="number" min={5} max={25} value={stepCdssForm.act_score} onChange={e => setStepCdssForm(f => ({ ...f, act_score: e.target.value }))}
                  className="w-full border border-purple-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-purple-700">Eosinophils (×10⁹/L)</label>
                <input type="number" step="0.01" value={stepCdssForm.eosinophil_count} onChange={e => setStepCdssForm(f => ({ ...f, eosinophil_count: e.target.value }))}
                  className="w-full border border-purple-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="flex gap-4 col-span-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stepCdssForm.pregnancy} onChange={e => setStepCdssForm(f => ({ ...f, pregnancy: e.target.checked }))} /> Pregnant</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stepCdssForm.smoking} onChange={e => setStepCdssForm(f => ({ ...f, smoking: e.target.checked }))} /> Smoking</label>
              </div>
            </div>
            <button onClick={async () => {
              const r = await cdssApi.pulmonologyAsthmaStepUp({
                current_gina_step: stepCdssForm.current_gina_step,
                control: stepCdssForm.control,
                act_score: stepCdssForm.act_score ? +stepCdssForm.act_score : undefined,
                eosinophil_count: stepCdssForm.eosinophil_count ? +stepCdssForm.eosinophil_count : undefined,
                pregnancy: stepCdssForm.pregnancy,
                smoking: stepCdssForm.smoking,
              });
              setStepResult(r);
            }} className="bg-purple-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Recommend</button>
            {stepResult && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex gap-2 items-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${stepResult.action === 'step_up' ? 'bg-red-100 text-red-800' : stepResult.action === 'step_down' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>
                    {stepResult.action?.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-slate-600">Step {stepResult.current_step} → Step {stepResult.recommended_step}</span>
                </div>
                <p className="font-medium text-purple-900">{stepResult.recommended_regimen}</p>
                <p className="text-slate-600">{stepResult.rationale}</p>
                {stepResult.biologics?.length > 0 && (
                  <div className="bg-purple-100 rounded p-2">
                    <p className="font-semibold text-purple-900 text-xs mb-1">Biologic Options</p>
                    <ul className="list-disc list-inside text-purple-800 text-xs space-y-0.5">
                      {stepResult.biologics.map((b: string, i: number) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )}
                {stepResult.notes?.map((n: string, i: number) => (
                  <div key={i} className="flex gap-2 text-amber-700 text-xs"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{n}</div>
                ))}
              </div>
            )}
          </div>

          {/* Asthma Record Form */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Record Asthma Assessment</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-slate-500">ACT Score (5–25)</label><input type="number" min={5} max={25} value={asthmaForm.act_score} onChange={e => setAsthmaForm(f => ({ ...f, act_score: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Control</label>
                <select value={asthmaForm.control} onChange={e => setAsthmaForm(f => ({ ...f, control: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['controlled', 'partly_controlled', 'uncontrolled'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Severity</label>
                <select value={asthmaForm.severity} onChange={e => setAsthmaForm(f => ({ ...f, severity: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['intermittent', 'mild_persistent', 'moderate_persistent', 'severe_persistent'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">GINA Step</label><input type="number" min={1} max={5} value={asthmaForm.gina_step} onChange={e => setAsthmaForm(f => ({ ...f, gina_step: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Reliever puffs/week</label><input type="number" min={0} value={asthmaForm.reliever_puffs_per_week} onChange={e => setAsthmaForm(f => ({ ...f, reliever_puffs_per_week: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">OCS courses last yr</label><input type="number" min={0} value={asthmaForm.oral_steroid_courses_last_year} onChange={e => setAsthmaForm(f => ({ ...f, oral_steroid_courses_last_year: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">IgE (IU/mL)</label><input type="number" step="0.1" value={asthmaForm.ige_total} onChange={e => setAsthmaForm(f => ({ ...f, ige_total: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Eos (×10⁹/L)</label><input type="number" step="0.01" value={asthmaForm.eosinophil_count} onChange={e => setAsthmaForm(f => ({ ...f, eosinophil_count: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
            </div>
            <button onClick={async () => {
              await cdssApi.addPulmonologyAsthma(patientId, tenantSubdomain, {
                assessedBy: providerId,
                assessmentDate: new Date().toISOString(),
                actScore: asthmaForm.act_score ? +asthmaForm.act_score : null,
                control: asthmaForm.control,
                severity: asthmaForm.severity,
                ginaStep: asthmaForm.gina_step ? +asthmaForm.gina_step : null,
                relieverPuffsPerWeek: asthmaForm.reliever_puffs_per_week ? +asthmaForm.reliever_puffs_per_week : null,
                oralSteroidCoursesLastYear: +asthmaForm.oral_steroid_courses_last_year,
                igeTotal: asthmaForm.ige_total ? +asthmaForm.ige_total : null,
                eosinophilCount: asthmaForm.eosinophil_count ? +asthmaForm.eosinophil_count : null,
                nocturnalSymptoms: asthmaForm.nocturnal_symptoms,
              });
              load();
            }} className="bg-purple-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {asthma.map((a, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold mr-2 ${CONTROL_COLOURS[a.control]}`}>{a.control?.replace('_', ' ')}</span>
                  <span className="text-slate-600">Step {a.ginaStep} | ACT {a.actScore}</span>
                </div>
                <span className="text-slate-400">{new Date(a.assessmentDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PEAK FLOW ────────────────────────────────────────────────────── */}
      {activeTab === 'peakflow' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Log Peak Flow</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-slate-500">PEF (L/min)</label><input type="number" step="1" value={pefForm.pef_value} onChange={e => setPefForm(f => ({ ...f, pef_value: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">% Predicted</label><input type="number" step="0.1" value={pefForm.percent_predicted} onChange={e => setPefForm(f => ({ ...f, percent_predicted: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Medication Taken</label><input type="text" value={pefForm.medication_taken} onChange={e => setPefForm(f => ({ ...f, medication_taken: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
            </div>
            <button onClick={async () => {
              await cdssApi.addPulmonologyPeakFlow(patientId, tenantSubdomain, {
                recordedBy: providerId,
                recordedAt: new Date().toISOString(),
                pefValue: +pefForm.pef_value,
                percentPredicted: pefForm.percent_predicted ? +pefForm.percent_predicted : null,
                medicationTaken: pefForm.medication_taken || null,
                notes: pefForm.notes || null,
              });
              load();
            }} className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Log</button>
          </div>

          {/* Traffic light chart */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-3">Peak Flow Diary (latest 30)</h3>
            <div className="space-y-1">
              {peakFlow.slice(0, 30).map((p, i) => {
                const pct = p.percentPredicted || 0;
                const zone = p.zone || (pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red');
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className={`w-3 h-3 rounded-full ${ZONE_COLOURS[zone] || 'bg-slate-300'}`} />
                    <span className="w-24 text-slate-500">{new Date(p.recordedAt).toLocaleDateString()}</span>
                    <span className="font-medium w-20">{p.pefValue} L/min</span>
                    {pct > 0 && <span className="text-slate-500">{pct}%</span>}
                    {p.medicationTaken && <span className="text-slate-400 text-xs">{p.medicationTaken}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── OXYGEN THERAPY ───────────────────────────────────────────────── */}
      {activeTab === 'oxygen' && (
        <div className="space-y-6">
          {/* O2 Prescriber CDSS */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">CDSS — Oxygen Prescriber</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs text-blue-700">Indication</label>
                <select value={o2CdssForm.indication} onChange={e => setO2CdssForm(f => ({ ...f, indication: e.target.value }))}
                  className="w-full border border-blue-300 rounded px-2 py-1 text-sm">
                  {['hypoxaemia', 'copd_ltot', 'cluster_headache', 'palliative', 'procedural'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-blue-700">SpO₂ resting (%)</label><input type="number" step="0.1" value={o2CdssForm.spo2_resting} onChange={e => setO2CdssForm(f => ({ ...f, spo2_resting: e.target.value }))} className="w-full border border-blue-300 rounded px-2 py-1 text-sm" /></div>
              <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={o2CdssForm.copd_diagnosis} onChange={e => setO2CdssForm(f => ({ ...f, copd_diagnosis: e.target.checked }))} /><label className="text-sm">COPD</label></div>
              <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={o2CdssForm.type2_respiratory_failure} onChange={e => setO2CdssForm(f => ({ ...f, type2_respiratory_failure: e.target.checked }))} /><label className="text-sm">Type II RF</label></div>
            </div>
            <button onClick={async () => {
              const r = await cdssApi.prescribePulmonologyOxygen({
                indication: o2CdssForm.indication,
                spo2_resting: o2CdssForm.spo2_resting ? +o2CdssForm.spo2_resting : undefined,
                copd_diagnosis: o2CdssForm.copd_diagnosis,
                type2_respiratory_failure: o2CdssForm.type2_respiratory_failure,
              });
              setO2Result(r);
            }} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Prescribe</button>
            {o2Result && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="font-semibold text-blue-900">{o2Result.recommended_device}</div>
                <div className="text-slate-700">Flow: {o2Result.flow_rate_lpm} L/min {o2Result.fio2_approximate && `| FiO₂ ≈ ${(o2Result.fio2_approximate * 100).toFixed(0)}%`}</div>
                <div className="text-slate-700">Target SpO₂: {o2Result.target_spo2_min}–{o2Result.target_spo2_max}%</div>
                {o2Result.alerts?.map((a: string, i: number) => (
                  <div key={i} className="flex gap-2 text-amber-700 text-xs"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{a}</div>
                ))}
              </div>
            )}
          </div>

          {/* O2 Record Form */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Record Oxygen Therapy</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-500">Device</label>
                <select value={o2Form.delivery_device} onChange={e => setO2Form(f => ({ ...f, delivery_device: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['nasal_cannula', 'simple_mask', 'venturi_mask', 'non_rebreather', 'high_flow_nasal', 'cpap', 'bipap', 'mechanical_ventilator'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Flow (L/min)</label><input type="number" step="0.5" value={o2Form.flow_rate_lpm} onChange={e => setO2Form(f => ({ ...f, flow_rate_lpm: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Target SpO₂ min</label><input type="number" value={o2Form.target_spo2_min} onChange={e => setO2Form(f => ({ ...f, target_spo2_min: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Target SpO₂ max</label><input type="number" value={o2Form.target_spo2_max} onChange={e => setO2Form(f => ({ ...f, target_spo2_max: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div className="col-span-2"><label className="text-xs text-slate-500">Indication</label><input type="text" value={o2Form.indication} onChange={e => setO2Form(f => ({ ...f, indication: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div>
                <label className="text-xs text-slate-500">Status</label>
                <select value={o2Form.status} onChange={e => setO2Form(f => ({ ...f, status: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['active', 'weaned', 'discontinued'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={async () => {
              await cdssApi.addPulmonologyOxygen(patientId, tenantSubdomain, {
                prescribedBy: providerId,
                startDate: new Date().toISOString().split('T')[0],
                deliveryDevice: o2Form.delivery_device,
                flowRateLpm: +o2Form.flow_rate_lpm,
                targetSpo2Min: +o2Form.target_spo2_min,
                targetSpo2Max: +o2Form.target_spo2_max,
                indication: o2Form.indication,
                status: o2Form.status,
                notes: o2Form.notes || null,
              });
              load();
            }} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {oxygen.map((o, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold mr-2 ${o.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
                  <span className="font-medium">{o.deliveryDevice?.replace(/_/g, ' ')}</span>
                  <span className="ml-2 text-slate-500">@ {o.flowRateLpm} L/min | SpO₂ {o.targetSpo2Min}–{o.targetSpo2Max}%</span>
                </div>
                <span className="text-slate-400">{o.startDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const bg: Record<string, string> = { sky: 'bg-sky-50 border-sky-200', orange: 'bg-orange-50 border-orange-200', purple: 'bg-purple-50 border-purple-200', green: 'bg-green-50 border-green-200' };
  const text: Record<string, string> = { sky: 'text-sky-900', orange: 'text-orange-900', purple: 'text-purple-900', green: 'text-green-900' };
  return (
    <div className={`rounded-xl p-4 border ${bg[color] || 'bg-slate-50 border-slate-200'}`}>
      <div className={`flex items-center gap-2 mb-1 ${text[color] || 'text-slate-800'}`}>{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className={`text-2xl font-bold ${text[color] || 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
