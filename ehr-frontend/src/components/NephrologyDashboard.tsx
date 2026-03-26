import React, { useState, useEffect, useCallback } from 'react';
import { cdssApi } from '../services/api';
import { Droplets, Activity, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

type Tab = 'overview' | 'ckd' | 'dialysis' | 'fluid' | 'biopsy' | 'transplant';

const CKD_COLOURS: Record<string, string> = {
  G1: 'bg-green-100 text-green-800',
  G2: 'bg-lime-100 text-lime-800',
  G3a: 'bg-yellow-100 text-yellow-800',
  G3b: 'bg-orange-100 text-orange-800',
  G4: 'bg-red-100 text-red-800',
  G5: 'bg-red-200 text-red-900',
  G5D: 'bg-purple-100 text-purple-900',
};

const RISK_COLOURS: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  very_high: 'bg-red-100 text-red-800',
};

export default function NephrologyDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [ckd, setCkd] = useState<any[]>([]);
  const [dialysis, setDialysis] = useState<any[]>([]);
  const [fluid, setFluid] = useState<any[]>([]);
  const [biopsies, setBiopsies] = useState<any[]>([]);
  const [transplants, setTransplants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // CDSS results
  const [ckdResult, setCkdResult] = useState<any>(null);
  const [adequacyResult, setAdequacyResult] = useState<any>(null);
  const [drugResult, setDrugResult] = useState<any>(null);

  // Forms
  const [ckdForm, setCkdForm] = useState({ egfr: '', acr: '', serum_creatinine: '', serum_potassium: '', serum_phosphate: '', serum_bicarbonate: '', haemoglobin: '', primary_cause: '', bp_systolic: '', bp_diastolic: '', on_ras_blockade: false, notes: '' });
  const [dialysisForm, setDialysisForm] = useState({ dialysis_type: 'haemodialysis', session_duration_min: '', pre_weight_kg: '', post_weight_kg: '', ultrafiltration_vol_ml: '', blood_flow_rate: '', ktv: '', access_type: 'AVF', access_site: '', pre_bp_systolic: '', post_bp_systolic: '', notes: '' });
  const [fluidForm, setFluidForm] = useState({ intake_oral_ml: '0', intake_iv_ml: '0', intake_ngt_ml: '0', output_urine_ml: '0', output_drain_ml: '0', output_stoma_ml: '0', insensible_loss_ml: '400', notes: '' });
  const [biopsyForm, setBiopsyForm] = useState({ indication: '', egfr_at_biopsy: '', histopathology: '', diagnosis: '', recommendation: '', complications: '' });
  const [transplantForm, setTransplantForm] = useState({ transplant_date: '', donor_type: 'living_related', cold_ischaemia_hours: '', hla_matching: '', induction_agent: '', current_egfr: '', transplant_centre: '' });
  const [drugForm, setDrugForm] = useState({ drug_name: '', egfr: '', on_dialysis: false });
  const [adeqForm, setAdeqForm] = useState({ dialysis_type: 'haemodialysis', ktv: '', pre_bun: '', post_bun: '', session_duration_min: '', blood_flow_rate: '', ultrafiltration_vol_ml: '', pre_weight_kg: '', post_weight_kg: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, d, f, b, t] = await Promise.all([
        cdssApi.getNephrologyCkd(patientId, tenantSubdomain),
        cdssApi.getNephrologyDialysis(patientId, tenantSubdomain),
        cdssApi.getNephrologyFluid(patientId, tenantSubdomain),
        cdssApi.getNephrologyBiopsies(patientId, tenantSubdomain),
        cdssApi.getNephrologyTransplants(patientId, tenantSubdomain),
      ]);
      setCkd(c); setDialysis(d); setFluid(f); setBiopsies(b); setTransplants(t);
    } catch { /* ignore */ }
    setLoading(false);
  }, [patientId, tenantSubdomain]);

  useEffect(() => { load(); }, [load]);

  const latestCkd = ckd[0];
  const netFluidToday = fluid.slice(0, 24).reduce((sum, r) => sum + (r.netBalanceMl || 0), 0);
  const lastDialysis = dialysis[0];

  if (loading) return <div className="text-center py-10 text-slate-500">Loading…</div>;

  // 24h fluid balance bar
  const fluidEntries = fluid.slice(0, 24).reverse();

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-6 border-b border-slate-200">
        {(['overview', 'ckd', 'dialysis', 'fluid', 'biopsy', 'transplant'] as Tab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t capitalize transition ${activeTab === t ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {t === 'ckd' ? 'CKD' : t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreCard label="CKD Assessments" value={ckd.length} icon={<Activity className="w-5 h-5" />} color="teal" />
            <ScoreCard label="Dialysis Sessions" value={dialysis.length} icon={<Droplets className="w-5 h-5" />} color="blue" />
            <ScoreCard label="Biopsies" value={biopsies.length} icon={<TrendingDown className="w-5 h-5" />} color="purple" />
            <ScoreCard label="Transplant Records" value={transplants.length} icon={<CheckCircle className="w-5 h-5" />} color="green" />
          </div>

          {latestCkd && (
            <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
              <h3 className="font-semibold text-teal-900 mb-2">Latest CKD Assessment</h3>
              <div className="flex flex-wrap gap-3 text-sm">
                {latestCkd.ckdStage && <span className={`px-2 py-0.5 rounded text-xs font-bold ${CKD_COLOURS[latestCkd.ckdStage] || 'bg-slate-100'}`}>Stage {latestCkd.ckdStage}</span>}
                {latestCkd.ckdProgressionRisk && <span className={`px-2 py-0.5 rounded text-xs font-bold ${RISK_COLOURS[latestCkd.ckdProgressionRisk]}`}>{latestCkd.ckdProgressionRisk.replace('_', ' ')} risk</span>}
                {latestCkd.egfr && <span className="text-slate-700">eGFR <strong>{latestCkd.egfr}</strong> ml/min</span>}
                {latestCkd.albuminCreatinineRatio && <span className="text-slate-700">ACR <strong>{latestCkd.albuminCreatinineRatio}</strong> mg/mmol ({latestCkd.acrCategory})</span>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lastDialysis && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Last Dialysis Session</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Type</span><span className="font-medium capitalize">{lastDialysis.dialysisType}</span></div>
                  {lastDialysis.ktv && <div className="flex justify-between"><span>Kt/V</span><span className={`font-bold ${lastDialysis.ktv >= 1.4 ? 'text-green-700' : 'text-red-700'}`}>{lastDialysis.ktv}</span></div>}
                  {lastDialysis.sessionDurationMin && <div className="flex justify-between"><span>Duration</span><span>{lastDialysis.sessionDurationMin} min</span></div>}
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-semibold text-slate-700 mb-2">24h Fluid Balance</h3>
              <div className={`text-2xl font-bold ${netFluidToday > 0 ? 'text-blue-600' : netFluidToday < -500 ? 'text-orange-600' : 'text-green-600'}`}>
                {netFluidToday > 0 ? '+' : ''}{netFluidToday} mL
              </div>
              <div className="text-xs text-slate-500 mt-1">{fluid.slice(0, 24).length} entries</div>
            </div>
          </div>
        </div>
      )}

      {/* ── CKD ──────────────────────────────────────────────────────────── */}
      {activeTab === 'ckd' && (
        <div className="space-y-6">
          {/* CDSS KDIGO Staging */}
          <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
            <h3 className="font-semibold text-teal-900 mb-3">CDSS — KDIGO CKD Staging</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[['egfr', 'eGFR (ml/min)'], ['acr', 'ACR (mg/mmol)'], ['serum_potassium', 'K⁺ (mmol/L)'], ['serum_phosphate', 'PO₄ (mmol/L)'], ['serum_bicarbonate', 'HCO₃ (mmol/L)'], ['haemoglobin', 'Hb (g/dL)'], ['bp_systolic', 'BP Systolic']].map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-teal-700">{label}</label>
                  <input type="number" step="0.01" value={(ckdForm as any)[k]} onChange={e => setCkdForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-teal-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-4">
                <input type="checkbox" checked={ckdForm.on_ras_blockade} onChange={e => setCkdForm(f => ({ ...f, on_ras_blockade: e.target.checked }))} />
                <label className="text-sm">On RAS blockade</label>
              </div>
            </div>
            <button onClick={async () => {
              const r = await cdssApi.stageCkd({
                egfr: ckdForm.egfr ? +ckdForm.egfr : undefined,
                acr: ckdForm.acr ? +ckdForm.acr : undefined,
                serum_potassium: ckdForm.serum_potassium ? +ckdForm.serum_potassium : undefined,
                serum_phosphate: ckdForm.serum_phosphate ? +ckdForm.serum_phosphate : undefined,
                serum_bicarbonate: ckdForm.serum_bicarbonate ? +ckdForm.serum_bicarbonate : undefined,
                haemoglobin: ckdForm.haemoglobin ? +ckdForm.haemoglobin : undefined,
                bp_systolic: ckdForm.bp_systolic ? +ckdForm.bp_systolic : undefined,
                on_ras_blockade: ckdForm.on_ras_blockade,
              });
              setCkdResult(r);
            }} className="bg-teal-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Stage</button>
            {ckdResult && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  {ckdResult.g_stage && <span className={`px-2 py-0.5 rounded font-bold text-xs ${CKD_COLOURS[ckdResult.g_stage] || 'bg-slate-100'}`}>Stage {ckdResult.g_stage}</span>}
                  {ckdResult.a_category && <span className="px-2 py-0.5 rounded font-bold text-xs bg-blue-100 text-blue-800">Category {ckdResult.a_category}</span>}
                  {ckdResult.kdigo_risk && <span className={`px-2 py-0.5 rounded font-bold text-xs ${RISK_COLOURS[ckdResult.kdigo_risk]}`}>{ckdResult.kdigo_risk.replace('_', ' ')} risk</span>}
                  {ckdResult.rapid_progresser && <span className="px-2 py-0.5 rounded font-bold text-xs bg-red-200 text-red-900">Rapid Progresser</span>}
                </div>
                {ckdResult.alerts?.map((a: string, i: number) => (
                  <div key={i} className="flex gap-2 text-amber-700 text-xs"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{a}</div>
                ))}
                {ckdResult.recommendations?.length > 0 && (
                  <ul className="list-disc list-inside text-slate-700 text-xs space-y-0.5">
                    {ckdResult.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Drug Dosing CDSS */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">CDSS — Renal Drug Dose Adjustment</h3>
            <div className="flex flex-wrap gap-3 mb-3">
              <div><label className="text-xs text-slate-500">Drug Name</label><input type="text" value={drugForm.drug_name} onChange={e => setDrugForm(f => ({ ...f, drug_name: e.target.value }))} placeholder="e.g. metformin" className="block border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">eGFR</label><input type="number" value={drugForm.egfr} onChange={e => setDrugForm(f => ({ ...f, egfr: e.target.value }))} className="block border border-slate-300 rounded px-2 py-1 text-sm w-24" /></div>
              <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={drugForm.on_dialysis} onChange={e => setDrugForm(f => ({ ...f, on_dialysis: e.target.checked }))} /><label className="text-sm">On Dialysis</label></div>
            </div>
            <button onClick={async () => {
              const r = await cdssApi.renalDrugDosing({ drug_name: drugForm.drug_name, egfr: drugForm.egfr ? +drugForm.egfr : undefined, on_dialysis: drugForm.on_dialysis });
              setDrugResult(r);
            }} className="bg-slate-700 text-white px-4 py-1.5 rounded text-sm font-semibold">Check Dose</button>
            {drugResult && (
              <div className="mt-3 text-sm space-y-1">
                {drugResult.found ? (
                  <>
                    <div><span className="font-medium text-slate-700">Recommended: </span><span className={drugResult.recommended_dose?.includes('AVOID') || drugResult.recommended_dose?.includes('CONTRA') ? 'text-red-700 font-bold' : 'text-green-700 font-semibold'}>{drugResult.recommended_dose}</span></div>
                    <div className="text-slate-500 text-xs">Normal dose: {drugResult.normal_dose}</div>
                    {drugResult.alerts?.map((a: string, i: number) => <div key={i} className="flex gap-2 text-red-700 text-xs"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{a}</div>)}
                  </>
                ) : (
                  <p className="text-amber-700">{drugResult.message}</p>
                )}
              </div>
            )}
          </div>

          {/* CKD Record Form */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Record CKD Assessment</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[['egfr', 'eGFR'], ['acr', 'ACR (mg/mmol)'], ['serum_creatinine', 'Creatinine (μmol/L)'], ['serum_potassium', 'K⁺'], ['serum_phosphate', 'PO₄'], ['serum_bicarbonate', 'HCO₃'], ['haemoglobin', 'Hb (g/dL)'], ['bp_systolic', 'SBP'], ['bp_diastolic', 'DBP']].map(([k, label]) => (
                <div key={k}><label className="text-xs text-slate-500">{label}</label>
                  <input type="number" step="0.01" value={(ckdForm as any)[k]} onChange={e => setCkdForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              ))}
              <div><label className="text-xs text-slate-500">Primary Cause</label><input type="text" value={ckdForm.primary_cause} onChange={e => setCkdForm(f => ({ ...f, primary_cause: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
            </div>
            <textarea value={ckdForm.notes} onChange={e => setCkdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" rows={2} className="w-full border border-slate-300 rounded px-2 py-1 text-sm mb-3" />
            <button onClick={async () => {
              await cdssApi.addNephrologyCkd(patientId, tenantSubdomain, {
                assessedBy: providerId,
                assessmentDate: new Date().toISOString(),
                egfr: ckdForm.egfr ? +ckdForm.egfr : null,
                albuminCreatinineRatio: ckdForm.acr ? +ckdForm.acr : null,
                acrCategory: ckdForm.acr ? _acr(+ckdForm.acr) : null,
                ckdStage: ckdForm.egfr ? _gStage(+ckdForm.egfr) : null,
                serumCreatinine: ckdForm.serum_creatinine ? +ckdForm.serum_creatinine : null,
                serumPotassium: ckdForm.serum_potassium ? +ckdForm.serum_potassium : null,
                serumPhosphate: ckdForm.serum_phosphate ? +ckdForm.serum_phosphate : null,
                serumBicarbonate: ckdForm.serum_bicarbonate ? +ckdForm.serum_bicarbonate : null,
                haemoglobin: ckdForm.haemoglobin ? +ckdForm.haemoglobin : null,
                primaryCause: ckdForm.primary_cause || null,
                bpSystolic: ckdForm.bp_systolic ? +ckdForm.bp_systolic : null,
                bpDiastolic: ckdForm.bp_diastolic ? +ckdForm.bp_diastolic : null,
                onRasBlockade: ckdForm.on_ras_blockade,
                notes: ckdForm.notes || null,
              });
              load();
            }} className="bg-teal-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {ckd.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div className="flex flex-wrap gap-2 items-center">
                  {c.ckdStage && <span className={`px-2 py-0.5 rounded text-xs font-bold ${CKD_COLOURS[c.ckdStage] || 'bg-slate-100'}`}>{c.ckdStage}</span>}
                  <span className="text-slate-600">eGFR {c.egfr}</span>
                  {c.albuminCreatinineRatio && <span className="text-slate-500">ACR {c.albuminCreatinineRatio} ({c.acrCategory})</span>}
                </div>
                <span className="text-slate-400">{new Date(c.assessmentDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DIALYSIS ─────────────────────────────────────────────────────── */}
      {activeTab === 'dialysis' && (
        <div className="space-y-6">
          {/* Adequacy CDSS */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">CDSS — Dialysis Adequacy (KDOQI Kt/V)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-blue-700">Type</label>
                <select value={adeqForm.dialysis_type} onChange={e => setAdeqForm(f => ({ ...f, dialysis_type: e.target.value }))} className="w-full border border-blue-300 rounded px-2 py-1 text-sm">
                  {['haemodialysis', 'peritoneal'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {[['ktv', 'Kt/V'], ['pre_bun', 'Pre-BUN (mg/dL)'], ['post_bun', 'Post-BUN'], ['session_duration_min', 'Duration (min)'], ['blood_flow_rate', 'Blood Flow (ml/min)'], ['ultrafiltration_vol_ml', 'UF Volume (ml)'], ['pre_weight_kg', 'Pre-weight (kg)'], ['post_weight_kg', 'Post-weight (kg)']].map(([k, label]) => (
                <div key={k}><label className="text-xs text-blue-700">{label}</label>
                  <input type="number" step="0.01" value={(adeqForm as any)[k]} onChange={e => setAdeqForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-blue-300 rounded px-2 py-1 text-sm" /></div>
              ))}
            </div>
            <button onClick={async () => {
              const r = await cdssApi.assessDialysisAdequacy({
                dialysis_type: adeqForm.dialysis_type,
                ktv: adeqForm.ktv ? +adeqForm.ktv : undefined,
                pre_bun: adeqForm.pre_bun ? +adeqForm.pre_bun : undefined,
                post_bun: adeqForm.post_bun ? +adeqForm.post_bun : undefined,
                session_duration_min: adeqForm.session_duration_min ? +adeqForm.session_duration_min : undefined,
                blood_flow_rate: adeqForm.blood_flow_rate ? +adeqForm.blood_flow_rate : undefined,
                ultrafiltration_vol_ml: adeqForm.ultrafiltration_vol_ml ? +adeqForm.ultrafiltration_vol_ml : undefined,
                pre_weight_kg: adeqForm.pre_weight_kg ? +adeqForm.pre_weight_kg : undefined,
                post_weight_kg: adeqForm.post_weight_kg ? +adeqForm.post_weight_kg : undefined,
              });
              setAdequacyResult(r);
            }} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Assess</button>
            {adequacyResult && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex gap-2 items-center">
                  <span className={`px-2 py-0.5 rounded font-bold text-xs ${adequacyResult.adequate ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{adequacyResult.adequate ? 'ADEQUATE' : 'INADEQUATE'}</span>
                  {adequacyResult.ktv && <span>Kt/V {adequacyResult.ktv}</span>}
                  {adequacyResult.urr_percent && <span>URR {adequacyResult.urr_percent}%</span>}
                  {adequacyResult.uf_rate_ml_kg_h && <span>UF rate {adequacyResult.uf_rate_ml_kg_h} ml/kg/h</span>}
                </div>
                {adequacyResult.alerts?.map((a: string, i: number) => <div key={i} className="flex gap-2 text-amber-700 text-xs"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{a}</div>)}
                {adequacyResult.recommendations?.map((r: string, i: number) => <div key={i} className="text-slate-700 text-xs">• {r}</div>)}
              </div>
            )}
          </div>

          {/* Record Form */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Record Dialysis Session</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-slate-500">Type</label>
                <select value={dialysisForm.dialysis_type} onChange={e => setDialysisForm(f => ({ ...f, dialysis_type: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['haemodialysis', 'peritoneal', 'CRRT', 'SLED'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {[['session_duration_min', 'Duration (min)'], ['pre_weight_kg', 'Pre-weight (kg)'], ['post_weight_kg', 'Post-weight (kg)'], ['ultrafiltration_vol_ml', 'UF Volume (ml)'], ['blood_flow_rate', 'Blood flow (ml/min)'], ['ktv', 'Kt/V'], ['pre_bp_systolic', 'Pre SBP'], ['post_bp_systolic', 'Post SBP']].map(([k, label]) => (
                <div key={k}><label className="text-xs text-slate-500">{label}</label>
                  <input type="number" step="0.01" value={(dialysisForm as any)[k]} onChange={e => setDialysisForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              ))}
              <div><label className="text-xs text-slate-500">Access Type</label>
                <select value={dialysisForm.access_type} onChange={e => setDialysisForm(f => ({ ...f, access_type: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['AVF', 'AVG', 'tunnelled_CVC', 'non_tunnelled_CVC', 'Tenckhoff', 'PD_catheter'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <textarea value={dialysisForm.notes} onChange={e => setDialysisForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes / complications…" rows={2} className="w-full border border-slate-300 rounded px-2 py-1 text-sm mb-3" />
            <button onClick={async () => {
              await cdssApi.addNephrologyDialysis(patientId, tenantSubdomain, {
                recordedBy: providerId,
                sessionDate: new Date().toISOString(),
                dialysisType: dialysisForm.dialysis_type,
                sessionDurationMin: dialysisForm.session_duration_min ? +dialysisForm.session_duration_min : null,
                preWeightKg: dialysisForm.pre_weight_kg ? +dialysisForm.pre_weight_kg : null,
                postWeightKg: dialysisForm.post_weight_kg ? +dialysisForm.post_weight_kg : null,
                ultrafiltrationVolMl: dialysisForm.ultrafiltration_vol_ml ? +dialysisForm.ultrafiltration_vol_ml : null,
                bloodFlowRate: dialysisForm.blood_flow_rate ? +dialysisForm.blood_flow_rate : null,
                ktv: dialysisForm.ktv ? +dialysisForm.ktv : null,
                accessType: dialysisForm.access_type,
                accessSite: dialysisForm.access_site || null,
                preBpSystolic: dialysisForm.pre_bp_systolic ? +dialysisForm.pre_bp_systolic : null,
                postBpSystolic: dialysisForm.post_bp_systolic ? +dialysisForm.post_bp_systolic : null,
                notes: dialysisForm.notes || null,
              });
              load();
            }} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {dialysis.map((d, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div>
                  <span className="font-medium capitalize">{d.dialysisType}</span>
                  {d.ktv && <span className={`ml-2 font-bold ${d.ktv >= 1.4 ? 'text-green-700' : 'text-red-700'}`}>Kt/V {d.ktv}</span>}
                  {d.sessionDurationMin && <span className="ml-2 text-slate-500">{d.sessionDurationMin} min</span>}
                  {d.accessType && <span className="ml-2 text-slate-400">{d.accessType}</span>}
                </div>
                <span className="text-slate-400">{new Date(d.sessionDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FLUID BALANCE ─────────────────────────────────────────────────── */}
      {activeTab === 'fluid' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Log Fluid Balance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[['intake_oral_ml', 'Oral (mL)'], ['intake_iv_ml', 'IV (mL)'], ['intake_ngt_ml', 'NGT (mL)'], ['output_urine_ml', 'Urine (mL)'], ['output_drain_ml', 'Drain (mL)'], ['output_stoma_ml', 'Stoma (mL)'], ['insensible_loss_ml', 'Insensible (mL)']].map(([k, label]) => (
                <div key={k}><label className="text-xs text-slate-500">{label}</label>
                  <input type="number" value={(fluidForm as any)[k]} onChange={e => setFluidForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              ))}
            </div>
            <button onClick={async () => {
              await cdssApi.addNephrologyFluid(patientId, tenantSubdomain, {
                recordedBy: providerId,
                recordedAt: new Date().toISOString(),
                intakeOralMl: +fluidForm.intake_oral_ml,
                intakeIvMl: +fluidForm.intake_iv_ml,
                intakeNgtMl: +fluidForm.intake_ngt_ml,
                outputUrineMl: +fluidForm.output_urine_ml,
                outputDrainMl: +fluidForm.output_drain_ml,
                outputStomaMl: +fluidForm.output_stoma_ml,
                insensibleLossMl: +fluidForm.insensible_loss_ml,
                notes: fluidForm.notes || null,
              });
              load();
            }} className="bg-teal-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Log</button>
          </div>

          <div>
            <h3 className="font-semibold text-slate-700 mb-2">Fluid Balance Chart (last 96 entries)</h3>
            <div className="space-y-1">
              {fluid.slice(0, 48).map((f, i) => {
                const net = f.netBalanceMl ?? ((f.intakeOralMl + f.intakeIvMl + f.intakeNgtMl + f.intakeOtherMl) - (f.outputUrineMl + f.outputDrainMl + f.outputStomaMl + f.outputOtherMl + f.insensibleLossMl));
                return (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-32 text-slate-500">{new Date(f.recordedAt).toLocaleString()}</span>
                    <div className="flex gap-2">
                      <span className="text-blue-600">+{(f.intakeOralMl || 0) + (f.intakeIvMl || 0) + (f.intakeNgtMl || 0)}mL</span>
                      <span className="text-orange-600">-{(f.outputUrineMl || 0) + (f.outputDrainMl || 0) + (f.outputStomaMl || 0) + (f.insensibleLossMl || 0)}mL</span>
                    </div>
                    <span className={`font-semibold ${net > 0 ? 'text-blue-700' : 'text-orange-700'}`}>{net > 0 ? '+' : ''}{net}mL</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── BIOPSY ───────────────────────────────────────────────────────── */}
      {activeTab === 'biopsy' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Record Renal Biopsy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-500">Indication</label><input type="text" value={biopsyForm.indication} onChange={e => setBiopsyForm(f => ({ ...f, indication: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">eGFR at Biopsy</label><input type="number" value={biopsyForm.egfr_at_biopsy} onChange={e => setBiopsyForm(f => ({ ...f, egfr_at_biopsy: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div className="col-span-2"><label className="text-xs text-slate-500">Histopathology</label><textarea value={biopsyForm.histopathology} onChange={e => setBiopsyForm(f => ({ ...f, histopathology: e.target.value }))} rows={2} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Diagnosis</label><input type="text" value={biopsyForm.diagnosis} onChange={e => setBiopsyForm(f => ({ ...f, diagnosis: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Recommendation</label><input type="text" value={biopsyForm.recommendation} onChange={e => setBiopsyForm(f => ({ ...f, recommendation: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
            </div>
            <button onClick={async () => {
              await cdssApi.addNephrologyBiopsy(patientId, tenantSubdomain, {
                performedBy: providerId,
                biopsyDate: new Date().toISOString().split('T')[0],
                indication: biopsyForm.indication,
                egfrAtBiopsy: biopsyForm.egfr_at_biopsy ? +biopsyForm.egfr_at_biopsy : null,
                histopathology: biopsyForm.histopathology || null,
                diagnosis: biopsyForm.diagnosis || null,
                recommendation: biopsyForm.recommendation || null,
                complications: biopsyForm.complications || null,
              });
              load();
            }} className="bg-purple-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {biopsies.map((b, i) => (
              <div key={i} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{b.diagnosis || b.indication}</span>
                  <span className="text-slate-400">{b.biopsyDate}</span>
                </div>
                {b.histopathology && <p className="text-slate-600 text-xs">{b.histopathology}</p>}
                {b.recommendation && <p className="text-slate-500 text-xs italic">Rec: {b.recommendation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TRANSPLANT ───────────────────────────────────────────────────── */}
      {activeTab === 'transplant' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Record Transplant</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div><label className="text-xs text-slate-500">Transplant Date</label><input type="date" value={transplantForm.transplant_date} onChange={e => setTransplantForm(f => ({ ...f, transplant_date: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Donor Type</label>
                <select value={transplantForm.donor_type} onChange={e => setTransplantForm(f => ({ ...f, donor_type: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['living_related', 'living_unrelated', 'deceased_brain_dead', 'deceased_cardiac_death'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Cold Ischaemia (h)</label><input type="number" step="0.5" value={transplantForm.cold_ischaemia_hours} onChange={e => setTransplantForm(f => ({ ...f, cold_ischaemia_hours: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">HLA Matching</label><input type="text" value={transplantForm.hla_matching} onChange={e => setTransplantForm(f => ({ ...f, hla_matching: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Induction Agent</label><input type="text" value={transplantForm.induction_agent} onChange={e => setTransplantForm(f => ({ ...f, induction_agent: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Current eGFR</label><input type="number" value={transplantForm.current_egfr} onChange={e => setTransplantForm(f => ({ ...f, current_egfr: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Transplant Centre</label><input type="text" value={transplantForm.transplant_centre} onChange={e => setTransplantForm(f => ({ ...f, transplant_centre: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
            </div>
            <button onClick={async () => {
              await cdssApi.addNephrologyTransplant(patientId, tenantSubdomain, {
                transplantDate: transplantForm.transplant_date,
                donorType: transplantForm.donor_type,
                coldIschaemiaHours: transplantForm.cold_ischaemia_hours ? +transplantForm.cold_ischaemia_hours : null,
                hlaMatching: transplantForm.hla_matching || null,
                inductionAgent: transplantForm.induction_agent || null,
                currentEgfr: transplantForm.current_egfr ? +transplantForm.current_egfr : null,
                transplantCentre: transplantForm.transplant_centre || null,
              });
              load();
            }} className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {transplants.map((t, i) => (
              <div key={i} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium capitalize">{t.donorType?.replace(/_/g, ' ')}</span>
                  <span className="text-slate-400">{t.transplantDate}</span>
                </div>
                <div className="text-slate-600 text-xs flex gap-4">
                  {t.currentEgfr && <span>eGFR {t.currentEgfr}</span>}
                  {t.hlaMatching && <span>HLA: {t.hlaMatching}</span>}
                  {t.transplantCentre && <span>{t.transplantCentre}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function _gStage(egfr: number): string {
  if (egfr >= 90) return 'G1';
  if (egfr >= 60) return 'G2';
  if (egfr >= 45) return 'G3a';
  if (egfr >= 30) return 'G3b';
  if (egfr >= 15) return 'G4';
  return 'G5';
}

function _acr(acr: number): string {
  if (acr < 3) return 'A1';
  if (acr < 30) return 'A2';
  return 'A3';
}

function ScoreCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const bg: Record<string, string> = { teal: 'bg-teal-50 border-teal-200', blue: 'bg-blue-50 border-blue-200', purple: 'bg-purple-50 border-purple-200', green: 'bg-green-50 border-green-200' };
  const text: Record<string, string> = { teal: 'text-teal-900', blue: 'text-blue-900', purple: 'text-purple-900', green: 'text-green-900' };
  return (
    <div className={`rounded-xl p-4 border ${bg[color] || 'bg-slate-50 border-slate-200'}`}>
      <div className={`flex items-center gap-2 mb-1 ${text[color] || 'text-slate-800'}`}>{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className={`text-2xl font-bold ${text[color] || 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
