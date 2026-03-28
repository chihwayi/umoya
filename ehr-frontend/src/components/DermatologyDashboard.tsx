import React, { useState, useEffect, useCallback } from 'react';
import { cdssApi } from '../services/api';
import { Eye, AlertTriangle, CheckCircle, Scissors, Flame } from 'lucide-react';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

type Tab = 'overview' | 'lesions' | 'wounds' | 'burns' | 'notes';

const URGENCY_COLOURS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  semi_urgent: 'bg-orange-100 text-orange-800',
  routine: 'bg-green-100 text-green-800',
};

const WOUND_TYPE_COLOURS: Record<string, string> = {
  pressure: 'bg-red-100 text-red-800',
  diabetic_foot: 'bg-orange-100 text-orange-800',
  surgical: 'bg-blue-100 text-blue-800',
  venous: 'bg-purple-100 text-purple-800',
  arterial: 'bg-pink-100 text-pink-800',
  burn: 'bg-amber-100 text-amber-800',
  trauma: 'bg-slate-100 text-slate-700',
  other: 'bg-slate-100 text-slate-700',
};

export default function DermatologyDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [lesions, setLesions] = useState<any[]>([]);
  const [wounds, setWounds] = useState<any[]>([]);
  const [burns, setBurns] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // CDSS
  const [classifyResult, setClassifyResult] = useState<any>(null);
  const [burnFluidResult, setBurnFluidResult] = useState<any>(null);

  // Forms
  const [lesionForm, setLesionForm] = useState({ lesion_type: '', morphology: 'papule', colour: '', borders: 'well_defined', location: '', diameter_mm: '', evolution: 'static', itching: false, bleeding: false, notes: '' });
  const [woundForm, setWoundForm] = useState({ wound_type: 'surgical', location: '', length_cm: '', width_cm: '', depth_cm: '', exudate_amount: 'minimal', exudate_type: 'serous', odour: 'none', infection_signs: false, dressing_used: '', treatment_plan: '', notes: '' });
  const [burnForm, setBurnForm] = useState({ mechanism: 'thermal', estimated_tbsa: '', weight_kg: '', inhalation_injury: false, escharotomy_required: false, referral_burns_unit: false, notes: '' });
  const [noteForm, setNoteForm] = useState({ presenting_complaint: '', morphology_description: '', treatment: '', follow_up_plan: '', biopsy_requested: false, biopsy_site: '' });
  const [classifyForm, setClassifyForm] = useState({ morphology: 'papule', colour: '', borders: 'well_defined', diameter_mm: '', evolution: 'static', location: 'sun_exposed', patient_age: '', duration_months: '', itching: false, bleeding: false, personal_hx_melanoma: false, family_hx_melanoma: false, immunosuppressed: false });
  const [burnCdssForm, setBurnCdssForm] = useState({ weight_kg: '', tbsa_percent: '', inhalation_injury: false, burn_depth: 'partial', time_since_burn_hours: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, w, b, n] = await Promise.all([
        cdssApi.getDermatologyLesions(patientId, tenantSubdomain),
        cdssApi.getDermatologyWounds(patientId, tenantSubdomain),
        cdssApi.getDermatologyBurns(patientId, tenantSubdomain),
        cdssApi.getDermatologyNotes(patientId, tenantSubdomain),
      ]);
      setLesions(l); setWounds(w); setBurns(b); setNotes(n);
    } catch { /* ignore */ }
    setLoading(false);
  }, [patientId, tenantSubdomain]);

  useEffect(() => { load(); }, [load]);

  const activeWounds = wounds.filter(w => !w.reviewDate || new Date(w.reviewDate) >= new Date());

  if (loading) return <div className="text-center py-10 text-slate-500">Loading…</div>;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-6 border-b border-slate-200">
        {(['overview', 'lesions', 'wounds', 'burns', 'notes'] as Tab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t capitalize transition ${activeTab === t ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreCard label="Skin Lesions" value={lesions.length} icon={<Eye className="w-5 h-5" />} color="rose" />
            <ScoreCard label="Active Wounds" value={activeWounds.length} icon={<Scissors className="w-5 h-5" />} color="orange" />
            <ScoreCard label="Burn Assessments" value={burns.length} icon={<Flame className="w-5 h-5" />} color="amber" />
            <ScoreCard label="Derm Notes" value={notes.length} icon={<CheckCircle className="w-5 h-5" />} color="purple" />
          </div>

          {burns.length > 0 && burns[0].estimatedTbsa >= 15 && (
            <div className="flex gap-3 items-start bg-red-50 border border-red-200 rounded-xl p-4">
              <Flame className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Significant Burn — TBSA {burns[0].estimatedTbsa}%</p>
                <p className="text-sm text-red-700">Burns unit referral criteria may be met. Review Parkland fluid calculation.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lesions.slice(0, 3).map((l, i) => (
              <div key={i} className="bg-rose-50 rounded-lg p-3 border border-rose-200 text-sm">
                <span className="font-medium capitalize">{l.lesionType || l.morphology || 'Lesion'}</span>
                <span className="ml-2 text-slate-500">{l.bodyLocation?.site || l.bodyLocation?.anatomical || ''}</span>
                {l.aiClassification?.urgency && <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${URGENCY_COLOURS[l.aiClassification.urgency]}`}>{l.aiClassification.urgency}</span>}
              </div>
            ))}
            {activeWounds.slice(0, 3).map((w, i) => (
              <div key={i} className="bg-orange-50 rounded-lg p-3 border border-orange-200 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-bold mr-2 ${WOUND_TYPE_COLOURS[w.woundType]}`}>{w.woundType?.replace('_', ' ')}</span>
                <span className="text-slate-700">{w.location}</span>
                {(w.lengthCm || w.widthCm) && <span className="ml-2 text-slate-500 text-xs">{w.lengthCm}×{w.widthCm} cm</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LESIONS ──────────────────────────────────────────────────────── */}
      {activeTab === 'lesions' && (
        <div className="space-y-6">
          {/* CDSS Classifier */}
          <div className="bg-rose-50 rounded-xl p-4 border border-rose-200">
            <h3 className="font-semibold text-rose-900 mb-3">CDSS — Lesion Risk Stratification (ABCDE)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-rose-700">Morphology</label>
                <select value={classifyForm.morphology} onChange={e => setClassifyForm(f => ({ ...f, morphology: e.target.value }))} className="w-full border border-rose-300 rounded px-2 py-1 text-sm">
                  {['macule','patch','papule','plaque','nodule','vesicle','pustule','bulla','ulcer','crust','scale','other'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-rose-700">Borders</label>
                <select value={classifyForm.borders} onChange={e => setClassifyForm(f => ({ ...f, borders: e.target.value }))} className="w-full border border-rose-300 rounded px-2 py-1 text-sm">
                  {['well_defined','ill_defined','irregular','scalloped'].map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-rose-700">Colour description</label><input type="text" value={classifyForm.colour} onChange={e => setClassifyForm(f => ({ ...f, colour: e.target.value }))} placeholder="e.g. multiple shades" className="w-full border border-rose-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-rose-700">Diameter (mm)</label><input type="number" value={classifyForm.diameter_mm} onChange={e => setClassifyForm(f => ({ ...f, diameter_mm: e.target.value }))} className="w-full border border-rose-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-rose-700">Evolution</label>
                <select value={classifyForm.evolution} onChange={e => setClassifyForm(f => ({ ...f, evolution: e.target.value }))} className="w-full border border-rose-300 rounded px-2 py-1 text-sm">
                  {['static','growing','changing_colour','ulcerating'].map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-rose-700">Location</label>
                <select value={classifyForm.location} onChange={e => setClassifyForm(f => ({ ...f, location: e.target.value }))} className="w-full border border-rose-300 rounded px-2 py-1 text-sm">
                  {['sun_exposed','covered','acral','mucosal'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-rose-700">Patient Age</label><input type="number" value={classifyForm.patient_age} onChange={e => setClassifyForm(f => ({ ...f, patient_age: e.target.value }))} className="w-full border border-rose-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-rose-700">Duration (months)</label><input type="number" value={classifyForm.duration_months} onChange={e => setClassifyForm(f => ({ ...f, duration_months: e.target.value }))} className="w-full border border-rose-300 rounded px-2 py-1 text-sm" /></div>
            </div>
            <div className="flex flex-wrap gap-4 mb-3 text-sm">
              {[['itching', 'Itching'], ['bleeding', 'Bleeding'], ['personal_hx_melanoma', 'Personal Hx Melanoma'], ['family_hx_melanoma', 'Family Hx Melanoma'], ['immunosuppressed', 'Immunosuppressed']].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={(classifyForm as any)[k]} onChange={e => setClassifyForm(f => ({ ...f, [k]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <button onClick={async () => {
              const r = await cdssApi.classifyDermatologyLesion({
                morphology: classifyForm.morphology,
                colour: classifyForm.colour || undefined,
                borders: classifyForm.borders,
                diameter_mm: classifyForm.diameter_mm ? +classifyForm.diameter_mm : undefined,
                evolution: classifyForm.evolution,
                location: classifyForm.location,
                patient_age: classifyForm.patient_age ? +classifyForm.patient_age : undefined,
                duration_months: classifyForm.duration_months ? +classifyForm.duration_months : undefined,
                itching: classifyForm.itching,
                bleeding: classifyForm.bleeding,
                personal_hx_melanoma: classifyForm.personal_hx_melanoma,
                family_hx_melanoma: classifyForm.family_hx_melanoma,
                immunosuppressed: classifyForm.immunosuppressed,
              });
              setClassifyResult(r);
            }} className="bg-rose-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Classify</button>
            {classifyResult && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded font-bold text-xs ${URGENCY_COLOURS[classifyResult.urgency]}`}>{classifyResult.urgency?.replace('_', ' ').toUpperCase()}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">ABCDE {classifyResult.abcde_score}/4</span>
                  {classifyResult.biopsy_recommended && <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-bold">BIOPSY RECOMMENDED</span>}
                </div>
                {classifyResult.red_flags?.map((f: string, i: number) => <div key={i} className="flex gap-2 text-red-700 text-xs"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{f}</div>)}
                {classifyResult.differentials?.length > 0 && (
                  <div><p className="font-medium text-slate-700 text-xs mb-1">Differentials:</p>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">{classifyResult.differentials.map((d: string, i: number) => <li key={i}>{d}</li>)}</ul>
                  </div>
                )}
                {classifyResult.management?.map((m: string, i: number) => <div key={i} className="text-slate-700 text-xs">• {m}</div>)}
              </div>
            )}
          </div>

          {/* Record Lesion */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Document Lesion</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-slate-500">Type / Name</label><input type="text" value={lesionForm.lesion_type} onChange={e => setLesionForm(f => ({ ...f, lesion_type: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Morphology</label>
                <select value={lesionForm.morphology} onChange={e => setLesionForm(f => ({ ...f, morphology: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['macule','patch','papule','plaque','nodule','vesicle','pustule','ulcer','crust','scale','other'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Colour</label><input type="text" value={lesionForm.colour} onChange={e => setLesionForm(f => ({ ...f, colour: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Borders</label>
                <select value={lesionForm.borders} onChange={e => setLesionForm(f => ({ ...f, borders: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['well_defined','ill_defined','irregular','scalloped'].map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Location</label><input type="text" value={lesionForm.location} onChange={e => setLesionForm(f => ({ ...f, location: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Diameter (mm)</label><input type="number" value={lesionForm.diameter_mm} onChange={e => setLesionForm(f => ({ ...f, diameter_mm: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Evolution</label>
                <select value={lesionForm.evolution} onChange={e => setLesionForm(f => ({ ...f, evolution: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['static','growing','changing_colour','ulcerating'].map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <textarea value={lesionForm.notes} onChange={e => setLesionForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" rows={2} className="w-full border border-slate-300 rounded px-2 py-1 text-sm mb-3" />
            <button onClick={async () => {
              await cdssApi.addDermatologyLesion(patientId, tenantSubdomain, {
                recordedBy: providerId,
                recordedAt: new Date().toISOString(),
                lesionType: lesionForm.lesion_type || null,
                morphology: lesionForm.morphology,
                colour: lesionForm.colour || null,
                borders: lesionForm.borders,
                bodyLocation: { site: lesionForm.location },
                dimensions: lesionForm.diameter_mm ? { diameter_mm: +lesionForm.diameter_mm } : {},
                evolution: { description: lesionForm.evolution },
                aiClassification: classifyResult || null,
                notes: lesionForm.notes || null,
              });
              load();
            }} className="bg-rose-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {lesions.map((l, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div>
                  <span className="font-medium capitalize">{l.lesionType || l.morphology}</span>
                  {l.bodyLocation?.site && <span className="ml-2 text-slate-500">{l.bodyLocation.site}</span>}
                  {l.aiClassification?.urgency && <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${URGENCY_COLOURS[l.aiClassification.urgency]}`}>{l.aiClassification.urgency}</span>}
                </div>
                <span className="text-slate-400">{new Date(l.recordedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── WOUNDS ───────────────────────────────────────────────────────── */}
      {activeTab === 'wounds' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Wound Assessment</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-slate-500">Wound Type</label>
                <select value={woundForm.wound_type} onChange={e => setWoundForm(f => ({ ...f, wound_type: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['surgical','pressure','diabetic_foot','venous','arterial','burn','trauma','other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Location</label><input type="text" value={woundForm.location} onChange={e => setWoundForm(f => ({ ...f, location: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Length (cm)</label><input type="number" step="0.1" value={woundForm.length_cm} onChange={e => setWoundForm(f => ({ ...f, length_cm: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Width (cm)</label><input type="number" step="0.1" value={woundForm.width_cm} onChange={e => setWoundForm(f => ({ ...f, width_cm: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Depth (cm)</label><input type="number" step="0.1" value={woundForm.depth_cm} onChange={e => setWoundForm(f => ({ ...f, depth_cm: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Exudate</label>
                <select value={woundForm.exudate_amount} onChange={e => setWoundForm(f => ({ ...f, exudate_amount: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['none','minimal','moderate','heavy'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Odour</label>
                <select value={woundForm.odour} onChange={e => setWoundForm(f => ({ ...f, odour: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['none','mild','moderate','strong'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Dressing</label><input type="text" value={woundForm.dressing_used} onChange={e => setWoundForm(f => ({ ...f, dressing_used: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={woundForm.infection_signs} onChange={e => setWoundForm(f => ({ ...f, infection_signs: e.target.checked }))} /><label className="text-sm">Infection signs</label></div>
            </div>
            <textarea value={woundForm.treatment_plan} onChange={e => setWoundForm(f => ({ ...f, treatment_plan: e.target.value }))} placeholder="Treatment plan…" rows={2} className="w-full border border-slate-300 rounded px-2 py-1 text-sm mb-3" />
            <button onClick={async () => {
              await cdssApi.addDermatologyWound(patientId, tenantSubdomain, {
                assessedBy: providerId,
                assessmentDate: new Date().toISOString(),
                woundType: woundForm.wound_type,
                location: woundForm.location,
                lengthCm: woundForm.length_cm ? +woundForm.length_cm : null,
                widthCm: woundForm.width_cm ? +woundForm.width_cm : null,
                depthCm: woundForm.depth_cm ? +woundForm.depth_cm : null,
                exudateAmount: woundForm.exudate_amount,
                exudateType: woundForm.exudate_type,
                odour: woundForm.odour,
                infectionSigns: woundForm.infection_signs,
                dressingUsed: woundForm.dressing_used || null,
                treatmentPlan: woundForm.treatment_plan || null,
                notes: woundForm.notes || null,
              });
              load();
            }} className="bg-orange-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {wounds.map((w, i) => (
              <div key={i} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div className="flex justify-between mb-1">
                  <div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold mr-2 ${WOUND_TYPE_COLOURS[w.woundType]}`}>{w.woundType?.replace('_', ' ')}</span>
                    <span className="font-medium">{w.location}</span>
                    {(w.lengthCm || w.widthCm) && <span className="ml-2 text-slate-500">{w.lengthCm}×{w.widthCm}cm</span>}
                    {w.infectionSigns && <span className="ml-2 text-red-600 text-xs font-bold">INFECTED</span>}
                  </div>
                  <span className="text-slate-400">{new Date(w.assessmentDate).toLocaleDateString()}</span>
                </div>
                {w.treatmentPlan && <p className="text-xs text-slate-600">{w.treatmentPlan}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BURNS ────────────────────────────────────────────────────────── */}
      {activeTab === 'burns' && (
        <div className="space-y-6">
          {/* Parkland CDSS */}
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-3">CDSS — Parkland Formula & Referral Criteria</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-amber-700">Weight (kg)</label><input type="number" value={burnCdssForm.weight_kg} onChange={e => setBurnCdssForm(f => ({ ...f, weight_kg: e.target.value }))} className="w-full border border-amber-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-amber-700">TBSA (%)</label><input type="number" value={burnCdssForm.tbsa_percent} onChange={e => setBurnCdssForm(f => ({ ...f, tbsa_percent: e.target.value }))} className="w-full border border-amber-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-amber-700">Burn Depth</label>
                <select value={burnCdssForm.burn_depth} onChange={e => setBurnCdssForm(f => ({ ...f, burn_depth: e.target.value }))} className="w-full border border-amber-300 rounded px-2 py-1 text-sm">
                  {['superficial','partial','full'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-amber-700">Hours since burn</label><input type="number" step="0.5" value={burnCdssForm.time_since_burn_hours} onChange={e => setBurnCdssForm(f => ({ ...f, time_since_burn_hours: e.target.value }))} className="w-full border border-amber-300 rounded px-2 py-1 text-sm" /></div>
              <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={burnCdssForm.inhalation_injury} onChange={e => setBurnCdssForm(f => ({ ...f, inhalation_injury: e.target.checked }))} /><label className="text-sm text-amber-800">Inhalation injury</label></div>
            </div>
            <button onClick={async () => {
              const r = await cdssApi.calculateBurnFluid({
                weight_kg: +burnCdssForm.weight_kg,
                tbsa_percent: +burnCdssForm.tbsa_percent,
                burn_depth: burnCdssForm.burn_depth,
                inhalation_injury: burnCdssForm.inhalation_injury,
                time_since_burn_hours: burnCdssForm.time_since_burn_hours ? +burnCdssForm.time_since_burn_hours : undefined,
              });
              setBurnFluidResult(r);
            }} className="bg-amber-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Calculate</button>
            {burnFluidResult && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-amber-200 text-center">
                    <div className="text-2xl font-bold text-amber-900">{burnFluidResult.parkland_total_ml?.toLocaleString()}</div>
                    <div className="text-xs text-amber-700">Total Parkland (mL)</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-amber-200 text-center">
                    <div className="text-2xl font-bold text-amber-900">{burnFluidResult.rate_first_8h_ml_per_h}</div>
                    <div className="text-xs text-amber-700">Rate 0–8h (mL/h)</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-amber-200 text-center">
                    <div className="text-2xl font-bold text-amber-900">{burnFluidResult.rate_next_16h_ml_per_h}</div>
                    <div className="text-xs text-amber-700">Rate 8–24h (mL/h)</div>
                  </div>
                </div>
                {burnFluidResult.adjusted_rate_ml_per_h && (
                  <div className="bg-red-50 rounded p-2 text-xs text-red-800 font-medium">Adjusted current rate (time elapsed): {burnFluidResult.adjusted_rate_ml_per_h} mL/h for remaining {burnFluidResult.time_remaining_first_8h}h</div>
                )}
                {burnFluidResult.alerts?.map((a: string, i: number) => <div key={i} className="flex gap-2 text-red-700 text-xs"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{a}</div>)}
                {burnFluidResult.referral_criteria?.map((r: string, i: number) => <div key={i} className="flex gap-2 text-orange-700 text-xs font-semibold">⚠ {r}</div>)}
                <p className="text-xs text-slate-500">{burnFluidResult.fluid_type}</p>
              </div>
            )}
          </div>

          {/* Burn Record Form */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Record Burn Assessment</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div><label className="text-xs text-slate-500">Mechanism</label>
                <select value={burnForm.mechanism} onChange={e => setBurnForm(f => ({ ...f, mechanism: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                  {['thermal','chemical','electrical','radiation','friction'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">TBSA (%)</label><input type="number" step="0.5" value={burnForm.estimated_tbsa} onChange={e => setBurnForm(f => ({ ...f, estimated_tbsa: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Weight (kg)</label><input type="number" value={burnForm.weight_kg} onChange={e => setBurnForm(f => ({ ...f, weight_kg: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div className="flex flex-col gap-1 pt-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={burnForm.inhalation_injury} onChange={e => setBurnForm(f => ({ ...f, inhalation_injury: e.target.checked }))} /> Inhalation injury</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={burnForm.escharotomy_required} onChange={e => setBurnForm(f => ({ ...f, escharotomy_required: e.target.checked }))} /> Escharotomy</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={burnForm.referral_burns_unit} onChange={e => setBurnForm(f => ({ ...f, referral_burns_unit: e.target.checked }))} /> Burns unit referral</label>
              </div>
            </div>
            <button onClick={async () => {
              const tbsa = burnForm.estimated_tbsa ? +burnForm.estimated_tbsa : null;
              const wt = burnForm.weight_kg ? +burnForm.weight_kg : null;
              const parkland = tbsa && wt ? 4 * wt * tbsa : null;
              await cdssApi.addDermatologyBurn(patientId, tenantSubdomain, {
                assessedBy: providerId,
                assessmentDate: new Date().toISOString(),
                mechanism: burnForm.mechanism,
                estimatedTbsa: tbsa,
                weightKg: wt,
                inhalationInjury: burnForm.inhalation_injury,
                escharotomyRequired: burnForm.escharotomy_required,
                referralBurnsUnit: burnForm.referral_burns_unit,
                parklandTotalMl: parkland,
                first8hMl: parkland ? parkland / 2 : null,
                next16hMl: parkland ? parkland / 2 : null,
                notes: burnForm.notes || null,
              });
              load();
            }} className="bg-amber-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save</button>
          </div>

          <div className="space-y-2">
            {burns.map((b, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div>
                  <span className="font-medium capitalize">{b.mechanism}</span>
                  {b.estimatedTbsa && <span className="ml-2 text-slate-600">TBSA {b.estimatedTbsa}%</span>}
                  {b.inhalationInjury && <span className="ml-2 text-red-600 text-xs font-bold">INHALATION</span>}
                  {b.referralBurnsUnit && <span className="ml-2 text-amber-700 text-xs font-bold">BURNS UNIT</span>}
                </div>
                <span className="text-slate-400">{new Date(b.assessmentDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NOTES ────────────────────────────────────────────────────────── */}
      {activeTab === 'notes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Dermatology Consultation Note</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-500">Presenting Complaint</label><textarea value={noteForm.presenting_complaint} onChange={e => setNoteForm(f => ({ ...f, presenting_complaint: e.target.value }))} rows={2} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Morphology Description</label><textarea value={noteForm.morphology_description} onChange={e => setNoteForm(f => ({ ...f, morphology_description: e.target.value }))} rows={2} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Treatment</label><textarea value={noteForm.treatment} onChange={e => setNoteForm(f => ({ ...f, treatment: e.target.value }))} rows={2} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs text-slate-500">Follow-up Plan</label><input type="text" value={noteForm.follow_up_plan} onChange={e => setNoteForm(f => ({ ...f, follow_up_plan: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noteForm.biopsy_requested} onChange={e => setNoteForm(f => ({ ...f, biopsy_requested: e.target.checked }))} /> Biopsy Requested</label>
                {noteForm.biopsy_requested && <input type="text" value={noteForm.biopsy_site} onChange={e => setNoteForm(f => ({ ...f, biopsy_site: e.target.value }))} placeholder="Biopsy site" className="border border-slate-300 rounded px-2 py-1 text-sm flex-1" />}
              </div>
            </div>
            <button onClick={async () => {
              await cdssApi.addDermatologyNote(patientId, tenantSubdomain, {
                providerId,
                noteDate: new Date().toISOString(),
                presentingComplaint: noteForm.presenting_complaint,
                morphologyDescription: noteForm.morphology_description || null,
                treatment: noteForm.treatment || null,
                followUpPlan: noteForm.follow_up_plan || null,
                biopsyRequested: noteForm.biopsy_requested,
                biopsySite: noteForm.biopsy_site || null,
                aiLesionClassification: classifyResult || null,
              });
              load();
            }} className="mt-3 bg-purple-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Save Note</button>
          </div>

          <div className="space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{n.presentingComplaint}</span>
                  <span className="text-slate-400">{new Date(n.noteDate).toLocaleDateString()}</span>
                </div>
                {n.treatment && <p className="text-xs text-slate-600">Tx: {n.treatment}</p>}
                {n.biopsyRequested && <span className="text-xs text-amber-700 font-bold">Biopsy: {n.biopsySite || 'pending site'}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const bg: Record<string, string> = { rose: 'bg-rose-50 border-rose-200', orange: 'bg-orange-50 border-orange-200', amber: 'bg-amber-50 border-amber-200', purple: 'bg-purple-50 border-purple-200' };
  const text: Record<string, string> = { rose: 'text-rose-900', orange: 'text-orange-900', amber: 'text-amber-900', purple: 'text-purple-900' };
  return (
    <div className={`rounded-xl p-4 border ${bg[color] || 'bg-slate-50 border-slate-200'}`}>
      <div className={`flex items-center gap-2 mb-1 ${text[color] || 'text-slate-800'}`}>{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className={`text-2xl font-bold ${text[color] || 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
