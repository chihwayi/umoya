import React, { useState, useEffect, useCallback } from 'react';
import { ehrApi } from '../services/api';
import { Zap, AlertTriangle, BookOpen, Brain, ClipboardList, Plus } from 'lucide-react';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

const SEIZURE_TYPES = ['focal_aware','focal_impaired','focal_to_bilateral','generalised_tonic_clonic','absence','myoclonic','atonic','unknown'];
const HEADACHE_TYPES = ['migraine_without_aura','migraine_with_aura','tension_type','cluster','medication_overuse','other'];

const VAS_COLOUR = (v: number) => v >= 8 ? 'text-red-600 font-bold' : v >= 5 ? 'text-orange-600 font-semibold' : 'text-green-700';
const NIHSS_SEVERITY = (n: number) => n >= 21 ? 'Severe' : n >= 15 ? 'Moderately-severe' : n >= 5 ? 'Moderate' : n >= 1 ? 'Mild' : 'No deficit';

export default function NeurologyDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [tab, setTab] = useState<'overview' | 'seizure' | 'stroke' | 'headache' | 'cognitive'>('overview');

  const [seizures, setSeizures] = useState<any[]>([]);
  const [strokes, setStrokes] = useState<any[]>([]);
  const [headaches, setHeadaches] = useState<any[]>([]);
  const [cognitiveAssessments, setCognitive] = useState<any[]>([]);

  const [seizureCdss, setSeizureCdss] = useState<any | null>(null);
  const [strokeCdss, setStrokeCdss] = useState<any | null>(null);
  const [headacheCdss, setHeadacheCdss] = useState<any | null>(null);

  // Seizure form
  const [showSeizureForm, setShowSeizureForm] = useState(false);
  const [seizureDto, setSeizureDto] = useState<any>({ seizureType: 'generalised_tonic_clonic', injuryOccurred: false, witnessPresent: false, statusEpilepticus: false, clusterEvent: false });

  // Stroke form
  const [showStrokeForm, setShowStrokeForm] = useState(false);
  const [strokeDto, setStrokeDto] = useState<any>({ strokeType: 'ischemic', ivtpaAdministered: false, thrombectomyPerformed: false });
  const [strokeTriagePayload, setStrokeTriagePayload] = useState<any>({ stroke_type: 'ischemic' });

  // Headache form
  const [showHeadacheForm, setShowHeadacheForm] = useState(false);
  const [headacheDto, setHeadacheDto] = useState<any>({ auraPresent: false, severityVas: 5 });
  const [headacheDiagnosePayload, setHeadacheDiagnosePayload] = useState<any>({});

  // Cognitive form
  const [showCogForm, setShowCogForm] = useState(false);
  const [cogDto, setCogDto] = useState<any>({});

  const load = useCallback(async () => {
    try {
      const [s, st, h, c] = await Promise.all([
        ehrApi.getNeurologySeizures(patientId, tenantSubdomain),
        ehrApi.getNeurologyStrokes(patientId, tenantSubdomain),
        ehrApi.getNeurologyHeadaches(patientId, tenantSubdomain),
        ehrApi.getNeurologyCognitive(patientId, tenantSubdomain),
      ]);
      setSeizures(s);
      setStrokes(st);
      setHeadaches(h);
      setCognitive(c);
    } catch { /* ignore */ }
  }, [patientId, tenantSubdomain]);

  useEffect(() => { load(); }, [load]);

  async function submitSeizure() {
    await ehrApi.addNeurologySeizure(patientId, tenantSubdomain, { ...seizureDto, recordedBy: providerId, seizureDate: new Date().toISOString() });
    const result = await ehrApi.classifyNeurologySeizure({
      seizure_type: seizureDto.seizureType,
      status_epilepticus: seizureDto.statusEpilepticus,
      cluster_event: seizureDto.clusterEvent,
      first_seizure: seizures.length === 0,
    });
    setSeizureCdss(result);
    setShowSeizureForm(false);
    load();
  }

  async function submitStroke() {
    await ehrApi.addNeurologyStroke(patientId, tenantSubdomain, { ...strokeDto, assessedBy: providerId });
    const result = await ehrApi.triageNeurologyStroke({ ...strokeTriagePayload });
    setStrokeCdss(result);
    setShowStrokeForm(false);
    load();
  }

  async function submitHeadache() {
    await ehrApi.addNeurologyHeadache(patientId, tenantSubdomain, headacheDto);
    const result = await ehrApi.diagnoseNeurologyHeadache(headacheDiagnosePayload);
    setHeadacheCdss(result);
    setShowHeadacheForm(false);
    load();
  }

  async function submitCognitive() {
    await ehrApi.addNeurologyCognitive(patientId, tenantSubdomain, { ...cogDto, assessedBy: providerId });
    setShowCogForm(false);
    load();
  }

  const latestSeizure = seizures[0];
  const latestStroke = strokes[0];
  const statusEpilepticusFlag = seizures.some(s => s.statusEpilepticus);
  const severeHeadacheFlag = headaches.some(h => h.severityVas >= 8);

  return (
    <div className="space-y-4">
      {/* Emergency banners */}
      {statusEpilepticusFlag && (
        <div className="bg-red-50 border border-red-400 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-700 flex-shrink-0" />
          <span className="text-red-800 font-bold text-sm">Status epilepticus recorded — ensure emergency protocol documented</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['overview',   'Overview',   Brain],
          ['seizure',    'Seizures',   Zap],
          ['stroke',     'Stroke',     AlertTriangle],
          ['headache',   'Headache',   BookOpen],
          ['cognitive',  'Cognitive',  ClipboardList],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Seizures</p>
            <p className="text-2xl font-bold">{seizures.length}</p>
            <p className="text-xs text-gray-400">recorded events</p>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Stroke Events</p>
            <p className="text-2xl font-bold">{strokes.length}</p>
            {latestStroke && <p className="text-xs text-gray-400">{latestStroke.strokeType} · NIHSS {latestStroke.nihssScore ?? '—'}</p>}
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Headache Entries</p>
            <p className="text-2xl font-bold">{headaches.length}</p>
            {severeHeadacheFlag && <p className="text-xs text-red-600">Severe episodes recorded</p>}
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Cognitive Assessments</p>
            <p className="text-2xl font-bold">{cognitiveAssessments.length}</p>
            {cognitiveAssessments[0]?.mocaScore != null && <p className="text-xs text-gray-400">Latest MoCA: {cognitiveAssessments[0].mocaScore}/30</p>}
          </div>
          {latestSeizure && (
            <div className="col-span-2 md:col-span-4 bg-white border rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Last Seizure</p>
              <p className="text-sm font-semibold capitalize">{latestSeizure.seizureType?.replace(/_/g,' ')}</p>
              <p className="text-xs text-gray-500">{new Date(latestSeizure.seizureDate).toLocaleString()}{latestSeizure.durationSeconds ? ` · ${latestSeizure.durationSeconds}s` : ''}</p>
              {latestSeizure.statusEpilepticus && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Status Epilepticus</span>}
            </div>
          )}
          {latestStroke && (
            <div className="col-span-2 md:col-span-4 bg-white border rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Last Stroke Assessment</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${latestStroke.strokeType === 'hemorrhagic' ? 'bg-red-100 text-red-800' : latestStroke.strokeType === 'TIA' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{latestStroke.strokeType}</span>
                {latestStroke.nihssScore != null && <span className="text-xs text-gray-700">NIHSS {latestStroke.nihssScore} — {NIHSS_SEVERITY(latestStroke.nihssScore)}</span>}
                {latestStroke.ivtpaAdministered && <span className="text-xs text-green-700">✓ tPA given</span>}
                {latestStroke.thrombectomyPerformed && <span className="text-xs text-green-700">✓ Thrombectomy</span>}
                {latestStroke.mrsScore90day != null && <span className="text-xs text-gray-700">mRS 90d: {latestStroke.mrsScore90day}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Seizures ─────────────────────────────────────────────────────── */}
      {tab === 'seizure' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Seizure Log ({seizures.length})</p>
            <button onClick={() => setShowSeizureForm(v => !v)} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Record Seizure
            </button>
          </div>

          {showSeizureForm && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Seizure Type</label>
                  <select value={seizureDto.seizureType} onChange={e => setSeizureDto((p: any) => ({ ...p, seizureType: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    {SEIZURE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Duration (seconds)</label>
                  <input type="number" value={seizureDto.durationSeconds || ''} onChange={e => setSeizureDto((p: any) => ({ ...p, durationSeconds: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Post-ictal State</label>
                  <select value={seizureDto.postictalState || ''} onChange={e => setSeizureDto((p: any) => ({ ...p, postictalState: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">Select…</option>
                    {['none','confusion','headache','fatigue','weakness','sleep','other'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Notes</label>
                  <input value={seizureDto.notes || ''} onChange={e => setSeizureDto((p: any) => ({ ...p, notes: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
                {[['injuryOccurred','Injury occurred'],['witnessPresent','Witness present'],['videoCapture','Video captured'],['clusterEvent','Cluster event'],['statusEpilepticus','Status epilepticus']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!seizureDto[k]} onChange={e => setSeizureDto((p: any) => ({ ...p, [k]: e.target.checked }))} className="accent-indigo-600" />
                    {l}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={submitSeizure} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700">Save & Classify</button>
                <button onClick={() => setShowSeizureForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {seizureCdss && (
            <div className={`rounded-lg p-4 border ${seizureCdss.emergency ? 'bg-red-50 border-red-400' : 'bg-indigo-50 border-indigo-200'}`}>
              <p className="font-bold text-sm">{seizureCdss.classification}</p>
              {seizureCdss.emergency && seizureCdss.immediate_actions?.map((a: string, i: number) => (
                <p key={i} className="text-xs text-red-800 mt-0.5">• {a}</p>
              ))}
              {!seizureCdss.emergency && (
                <>
                  {seizureCdss.aed_first_line?.length > 0 && (
                    <div className="mt-2"><p className="text-xs font-semibold text-indigo-800">First-line AEDs:</p>
                      {seizureCdss.aed_first_line.map((a: string, i: number) => <p key={i} className="text-xs text-indigo-700">• {a}</p>)}
                    </div>
                  )}
                  {seizureCdss.notes?.map((n: string, i: number) => <p key={i} className="text-xs text-gray-700 mt-0.5 italic">{n}</p>)}
                  {seizureCdss.driving_advice && <p className="text-xs text-orange-700 mt-2 font-medium">{seizureCdss.driving_advice}</p>}
                </>
              )}
            </div>
          )}

          {seizures.length === 0 && !showSeizureForm && <p className="text-sm text-gray-400">No seizures recorded.</p>}
          {seizures.map(s => (
            <div key={s.id} className={`bg-white border rounded-lg p-3 ${s.statusEpilepticus ? 'border-red-400' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold capitalize">{s.seizureType?.replace(/_/g,' ')}</p>
                  <p className="text-xs text-gray-500">{new Date(s.seizureDate).toLocaleString()}{s.durationSeconds ? ` · ${s.durationSeconds}s` : ''}</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {s.statusEpilepticus && <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">SE</span>}
                  {s.clusterEvent && <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full">Cluster</span>}
                  {s.injuryOccurred && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">Injury</span>}
                </div>
              </div>
              {s.postictalState && s.postictalState !== 'none' && <p className="text-xs text-gray-500 mt-1">Post-ictal: {s.postictalState}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Stroke ───────────────────────────────────────────────────────── */}
      {tab === 'stroke' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Stroke Pathway ({strokes.length})</p>
            <button onClick={() => setShowStrokeForm(v => !v)} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> New Assessment
            </button>
          </div>

          {showStrokeForm && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">Stroke Pathway & tPA Eligibility</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Stroke Type</label>
                  <select value={strokeDto.strokeType} onChange={e => { setStrokeDto((p: any) => ({ ...p, strokeType: e.target.value })); setStrokeTriagePayload((p: any) => ({ ...p, stroke_type: e.target.value })); }} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    {['ischemic','hemorrhagic','TIA','unknown'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Onset Time</label>
                  <input type="datetime-local" value={strokeDto.onsetTime || ''} onChange={e => { setStrokeDto((p: any) => ({ ...p, onsetTime: e.target.value })); setStrokeTriagePayload((p: any) => ({ ...p, onset_time: e.target.value })); }} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">NIHSS Score (0–42)</label>
                  <input type="number" min={0} max={42} value={strokeDto.nihssScore || ''} onChange={e => { setStrokeDto((p: any) => ({ ...p, nihssScore: +e.target.value })); setStrokeTriagePayload((p: any) => ({ ...p, nihss_score: +e.target.value })); }} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Systolic BP</label>
                  <input type="number" value={strokeTriagePayload.bp_systolic || ''} onChange={e => setStrokeTriagePayload((p: any) => ({ ...p, bp_systolic: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">CT Findings</label>
                  <select value={strokeTriagePayload.ct_findings || ''} onChange={e => setStrokeTriagePayload((p: any) => ({ ...p, ct_findings: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">Select…</option>
                    {['normal','hemorrhage','early_ischemia','unknown'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">INR</label>
                  <input type="number" step="0.1" value={strokeTriagePayload.inr || ''} onChange={e => setStrokeTriagePayload((p: any) => ({ ...p, inr: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
                {[['anticoagulant_use','On anticoagulant'],['prior_stroke','Prior stroke'],['prior_tia','Prior TIA'],['recent_bleed','Recent bleed']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!strokeTriagePayload[k]} onChange={e => setStrokeTriagePayload((p: any) => ({ ...p, [k]: e.target.checked }))} />
                    {l}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={submitStroke} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700">Save & Triage</button>
                <button onClick={() => setShowStrokeForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {strokeCdss && (
            <div className={`rounded-lg p-4 border ${strokeCdss.tpa_eligible ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-200'}`}>
              <p className="font-bold text-sm">{strokeCdss.stroke_type?.toUpperCase()} Stroke{strokeCdss.minutes_from_onset != null ? ` — ${strokeCdss.minutes_from_onset} min from onset` : ''}</p>
              {strokeCdss.tpa_eligible && <p className="text-xs font-bold text-green-800 mt-1">✓ tPA ELIGIBLE — Door-to-needle target: {strokeCdss.door_to_needle_target_minutes} min</p>}
              {strokeCdss.tpa_contraindications?.map((c: string, i: number) => <p key={i} className="text-xs text-red-800 mt-0.5">⊘ {c}</p>)}
              {strokeCdss.alerts?.map((a: string, i: number) => <p key={i} className="text-xs text-orange-800 mt-0.5">⚠ {a}</p>)}
              <div className="mt-2 space-y-0.5">
                {strokeCdss.actions?.map((a: string, i: number) => <p key={i} className="text-xs text-gray-700">→ {a}</p>)}
              </div>
            </div>
          )}

          {strokes.length === 0 && !showStrokeForm && <p className="text-sm text-gray-400">No stroke assessments recorded.</p>}
          {strokes.map(s => (
            <div key={s.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold">{s.strokeType} Stroke</p>
                  <p className="text-xs text-gray-500">{new Date(s.assessmentDate).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {s.nihssScore != null && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">NIHSS {s.nihssScore} ({NIHSS_SEVERITY(s.nihssScore)})</span>}
                  {s.ivtpaAdministered && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">tPA</span>}
                  {s.thrombectomyPerformed && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Thrombectomy</span>}
                </div>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                {s.mrsScoreAdmission != null && <span>mRS admit: {s.mrsScoreAdmission}</span>}
                {s.mrsScoreDischarge != null && <span>mRS d/c: {s.mrsScoreDischarge}</span>}
                {s.mrsScore90day != null && <span>mRS 90d: {s.mrsScore90day}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Headache ─────────────────────────────────────────────────────── */}
      {tab === 'headache' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Headache Diary ({headaches.length} entries)</p>
            <button onClick={() => setShowHeadacheForm(v => !v)} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Log Entry
            </button>
          </div>

          {showHeadacheForm && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Severity (VAS 0–10)</label>
                  <input type="number" min={0} max={10} value={headacheDto.severityVas} onChange={e => { setHeadacheDto((p: any) => ({ ...p, severityVas: +e.target.value })); setHeadacheDiagnosePayload((p: any) => ({ ...p, severity_vas: +e.target.value })); }} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Duration (hours)</label>
                  <input type="number" step="0.5" value={headacheDto.durationHours || ''} onChange={e => { setHeadacheDto((p: any) => ({ ...p, durationHours: +e.target.value })); setHeadacheDiagnosePayload((p: any) => ({ ...p, duration_hours: +e.target.value })); }} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Location</label>
                  <select value={headacheDiagnosePayload.location || ''} onChange={e => setHeadacheDiagnosePayload((p: any) => ({ ...p, location: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">Select…</option>
                    {['unilateral','bilateral','occipital','frontal'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Quality</label>
                  <select value={headacheDiagnosePayload.quality || ''} onChange={e => setHeadacheDiagnosePayload((p: any) => ({ ...p, quality: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">Select…</option>
                    {['throbbing','pressing','stabbing','burning'].map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Days/month</label>
                  <input type="number" value={headacheDiagnosePayload.frequency_per_month || ''} onChange={e => setHeadacheDiagnosePayload((p: any) => ({ ...p, frequency_per_month: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Medication taken</label>
                  <input value={headacheDto.medicationUsed || ''} onChange={e => setHeadacheDto((p: any) => ({ ...p, medicationUsed: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                {[['aura_present','Aura'],['nausea_vomiting','Nausea/vomiting'],['photo_phonophobia','Photo/phonophobia'],['worse_with_activity','Worse with activity'],['autonomic_features','Autonomic features'],['thunderclap','Thunderclap onset'],['fever_present','Fever'],['neck_stiffness','Neck stiffness']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!headacheDiagnosePayload[k]} onChange={e => { setHeadacheDiagnosePayload((p: any) => ({ ...p, [k]: e.target.checked })); if (k === 'aura_present') setHeadacheDto((p: any) => ({ ...p, auraPresent: e.target.checked })); }} className="accent-indigo-600" />
                    {l}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={submitHeadache} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700">Save & Diagnose</button>
                <button onClick={() => setShowHeadacheForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {headacheCdss && (
            <div className={`rounded-lg p-4 border ${headacheCdss.red_flags?.length > 0 ? 'bg-red-50 border-red-400' : 'bg-indigo-50 border-indigo-200'}`}>
              <p className="font-bold text-sm">{headacheCdss.diagnosis}{headacheCdss.ichd3_code ? ` (ICHD-3: ${headacheCdss.ichd3_code})` : ''}</p>
              {headacheCdss.red_flags?.map((r: string, i: number) => <p key={i} className="text-xs text-red-800 font-semibold mt-0.5">🚩 {r}</p>)}
              {headacheCdss.treatment?.length > 0 && (
                <div className="mt-2"><p className="text-xs font-semibold">Acute treatment:</p>
                  {headacheCdss.treatment.map((t: string, i: number) => <p key={i} className="text-xs text-gray-700">• {t}</p>)}
                </div>
              )}
              {headacheCdss.preventive?.length > 0 && (
                <div className="mt-2"><p className="text-xs font-semibold">Preventive:</p>
                  {headacheCdss.preventive.map((t: string, i: number) => <p key={i} className="text-xs text-gray-700">• {t}</p>)}
                </div>
              )}
              {headacheCdss.notes?.map((n: string, i: number) => <p key={i} className="text-xs text-orange-700 mt-1 italic">{n}</p>)}
            </div>
          )}

          {headaches.length === 0 && !showHeadacheForm && <p className="text-sm text-gray-400">No headache diary entries.</p>}
          <div className="overflow-x-auto">
            {headaches.length > 0 && (
              <table className="min-w-full text-xs bg-white border rounded-lg">
                <thead><tr className="border-b text-gray-500 bg-gray-50">
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">VAS</th>
                  <th className="text-left px-3 py-2">Duration</th>
                  <th className="text-left px-3 py-2">Aura</th>
                  <th className="text-left px-3 py-2">Med</th>
                </tr></thead>
                <tbody>
                  {headaches.map(h => (
                    <tr key={h.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{new Date(h.entryDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2 capitalize">{h.headacheType?.replace(/_/g,' ') || '—'}</td>
                      <td className={`px-3 py-2 ${h.severityVas != null ? VAS_COLOUR(h.severityVas) : ''}`}>{h.severityVas ?? '—'}/10</td>
                      <td className="px-3 py-2">{h.durationHours ? `${h.durationHours}h` : '—'}</td>
                      <td className="px-3 py-2">{h.auraPresent ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{h.medicationUsed || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Cognitive ────────────────────────────────────────────────────── */}
      {tab === 'cognitive' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Cognitive Assessments ({cognitiveAssessments.length})</p>
            <button onClick={() => setShowCogForm(v => !v)} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> New Assessment
            </button>
          </div>
          {showCogForm && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[['mmseScore','MMSE (0–30)',0,30],['mocaScore','MoCA (0–30)',0,30],['cdtScore','CDT Score',0,null]].map(([k,l,min,max]) => (
                  <div key={k as string}>
                    <label className="text-xs text-gray-500">{l as string}</label>
                    <input type="number" min={min as number} max={max as number || undefined} value={cogDto[k as string] ?? ''} onChange={e => setCogDto((p: any) => ({ ...p, [k as string]: e.target.value ? +e.target.value : undefined }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Interpretation</label>
                  <input value={cogDto.interpretation || ''} onChange={e => setCogDto((p: any) => ({ ...p, interpretation: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="e.g. Mild cognitive impairment" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Follow-up Date</label>
                  <input type="date" value={cogDto.followUpDate || ''} onChange={e => setCogDto((p: any) => ({ ...p, followUpDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={submitCognitive} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700">Save</button>
                <button onClick={() => setShowCogForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}
          {cognitiveAssessments.length === 0 && !showCogForm && <p className="text-sm text-gray-400">No cognitive assessments recorded.</p>}
          {cognitiveAssessments.map(c => (
            <div key={c.id} className="bg-white border rounded-lg p-4">
              <p className="text-sm font-semibold">{new Date(c.assessmentDate).toLocaleDateString()}</p>
              <div className="flex gap-3 flex-wrap mt-1">
                {c.mmseScore != null && <span className={`text-xs px-2 py-0.5 rounded ${c.mmseScore < 24 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>MMSE {c.mmseScore}/30</span>}
                {c.mocaScore != null && <span className={`text-xs px-2 py-0.5 rounded ${c.mocaScore < 26 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>MoCA {c.mocaScore}/30</span>}
                {c.cdtScore != null && <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">CDT {c.cdtScore}</span>}
              </div>
              {c.interpretation && <p className="text-xs text-gray-600 mt-1">{c.interpretation}</p>}
              {c.followUpDate && <p className="text-xs text-gray-400">Follow-up: {c.followUpDate}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
