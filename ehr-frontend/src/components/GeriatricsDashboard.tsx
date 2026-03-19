import React, { useState, useEffect, useCallback } from 'react';
import { ehrApi } from '../services/api';
import { UserCheck, AlertTriangle, Pill, ShieldCheck, FileText, Plus, Activity } from 'lucide-react';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

const FRAILTY_COLOURS: Record<string, string> = {
  non_frail: 'bg-green-100 text-green-800',
  mildly_frail: 'bg-yellow-100 text-yellow-800',
  moderately_to_severely_frail: 'bg-orange-100 text-orange-800',
  very_severely_frail_or_terminal: 'bg-red-100 text-red-800',
};

const RISK_COLOURS: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800 font-semibold',
};

const BRADEN_RISK = (score: number) =>
  score <= 9 ? 'Very high risk' : score <= 12 ? 'High risk' : score <= 14 ? 'Moderate risk' : score <= 18 ? 'Mild risk' : 'No risk';

export default function GeriatricsDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [tab, setTab] = useState<'overview' | 'assessment' | 'falls' | 'pressure' | 'polypharmacy' | 'acp'>('overview');
  const [assessments, setAssessments] = useState<any[]>([]);
  const [fallsAssessments, setFalls] = useState<any[]>([]);
  const [pressureAssessments, setPressure] = useState<any[]>([]);
  const [polypharmacyReviews, setPolypharmacy] = useState<any[]>([]);
  const [acpDocs, setAcp] = useState<any[]>([]);

  const [frailtyResult, setFrailtyResult] = useState<any | null>(null);
  const [fallRiskResult, setFallRiskResult] = useState<any | null>(null);
  const [polypharmacyResult, setPolypharmacyResult] = useState<any | null>(null);

  // Assessment form
  const [showAssessForm, setShowAssessForm] = useState(false);
  const [assessDto, setAssessDto] = useState<any>({});
  // Falls form
  const [showFallsForm, setShowFallsForm] = useState(false);
  const [fallsDto, setFallsDto] = useState<any>({ fallHistoryCount: 0, ambulation: 'normal', gait: 'normal', mentalStatus: 'oriented', ivLinePresent: false, secondaryDiagnosis: false });
  // Pressure form
  const [showPressureForm, setShowPressureForm] = useState(false);
  const [pressureDto, setPressureDto] = useState<any>({ bradenScore: 23, existingInjuries: [], specialSurfaceRequired: false });
  // Polypharmacy
  const [medList, setMedList] = useState<string>('');
  const [patientAge, setPatientAge] = useState<number>(75);
  // ACP form
  const [showAcpForm, setShowAcpForm] = useState(false);
  const [acpDto, setAcpDto] = useState<any>({ documentType: 'DNACPR', documentDate: new Date().toISOString().slice(0, 10), witnessSigned: false, physicianSigned: false, patientSigned: false, capacityConfirmed: false });

  const load = useCallback(async () => {
    try {
      const [a, f, p, pr, acp] = await Promise.all([
        ehrApi.getGeriatricAssessments(patientId, tenantSubdomain),
        ehrApi.getFallsAssessments(patientId, tenantSubdomain),
        ehrApi.getPressureAssessments(patientId, tenantSubdomain),
        ehrApi.getPolypharmacyReviews(patientId, tenantSubdomain),
        ehrApi.getAcpDocuments(patientId, tenantSubdomain),
      ]);
      setAssessments(a);
      setFalls(f);
      setPressure(p);
      setPolypharmacy(pr);
      setAcp(acp);
    } catch { /* ignore */ }
  }, [patientId, tenantSubdomain]);

  useEffect(() => { load(); }, [load]);

  const latest = assessments[0];
  const latestFalls = fallsAssessments[0];
  const latestPressure = pressureAssessments[0];

  async function submitAssessment() {
    const saved = await ehrApi.addGeriatricAssessment(patientId, tenantSubdomain, { ...assessDto, assessedBy: providerId });
    setShowAssessForm(false);
    setAssessDto({});
    load();
    // Run frailty CDSS
    if (saved.clinicalFrailtyScale) {
      const r = await ehrApi.assessGeriatricFrailty({ clinical_frailty_scale: saved.clinicalFrailtyScale, barthel_index: saved.barthelIndex, mmse_score: saved.mmseScore, moca_score: saved.mocaScore });
      setFrailtyResult(r);
    }
  }

  async function submitFalls() {
    const saved = await ehrApi.addFallsAssessment(patientId, tenantSubdomain, { ...fallsDto, assessedBy: providerId });
    setShowFallsForm(false);
    load();
    // Run fall risk CDSS
    const r = await ehrApi.assessGeriatricFallRisk({
      fall_history_count: fallsDto.fallHistoryCount,
      secondary_diagnosis: fallsDto.secondaryDiagnosis,
      ambulatory_aid: fallsDto.ambulation === 'uses_aid' ? 'cane' : 'none',
      iv_therapy: fallsDto.ivLinePresent,
      gait: fallsDto.gait,
      mental_status: fallsDto.mentalStatus,
      tinnetti_gait: fallsDto.tinnettiGait,
      tinnetti_balance: fallsDto.tinnettiBalance,
    });
    setFallRiskResult(r);
    // Save result back
    if (saved?.id) {
      await ehrApi.addFallsAssessment(patientId, tenantSubdomain, { ...fallsDto, assessedBy: providerId, morseScore: r.morse_score, riskCategory: r.overall_risk, preventionPlan: r.prevention_plan?.join('\n') });
    }
  }

  async function submitPressure() {
    await ehrApi.addPressureAssessment(patientId, tenantSubdomain, { ...pressureDto, assessedBy: providerId });
    setShowPressureForm(false);
    load();
  }

  async function runPolypharmacyCheck() {
    const medications = medList.split('\n').filter(Boolean).map(line => {
      const parts = line.split(',');
      return { name: parts[0]?.trim(), drug_class: parts[1]?.trim() || 'unknown', dose_mg: parseFloat(parts[2]) || null };
    });
    const r = await ehrApi.checkGeriatricPolypharmacy({ medications, age_years: patientAge });
    setPolypharmacyResult(r);
    // Save review
    await ehrApi.addPolypharmacyReview(patientId, tenantSubdomain, {
      reviewedBy: providerId,
      totalMedications: medications.length,
      beersCriteriaFlags: r.beers_flags,
      deprescribingRecommendations: r.deprescribing_recommendations,
      medicationsReviewed: medications,
    });
    load();
  }

  async function submitAcp() {
    await ehrApi.addAcpDocument(patientId, tenantSubdomain, { ...acpDto, createdBy: providerId });
    setShowAcpForm(false);
    setAcpDto({ documentType: 'DNACPR', documentDate: new Date().toISOString().slice(0, 10), witnessSigned: false, physicianSigned: false, patientSigned: false, capacityConfirmed: false });
    load();
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['overview',     'Overview',      UserCheck],
          ['assessment',   'CGA',           Activity],
          ['falls',        'Falls',         AlertTriangle],
          ['pressure',     'Pressure',      ShieldCheck],
          ['polypharmacy', 'Polypharmacy',  Pill],
          ['acp',          'ACP',           FileText],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
            <p className="text-xs text-gray-500">Frailty (CFS)</p>
            {latest?.clinicalFrailtyScale ? (
              <>
                <p className="text-2xl font-bold">{latest.clinicalFrailtyScale}<span className="text-sm font-normal text-gray-400">/9</span></p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(latest.assessmentDate).toLocaleDateString()}</p>
              </>
            ) : <p className="text-sm text-gray-400 mt-1">Not assessed</p>}
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Barthel Index</p>
            {latest?.barthelIndex != null ? (
              <>
                <p className="text-2xl font-bold">{latest.barthelIndex}<span className="text-sm font-normal text-gray-400">/100</span></p>
                <p className="text-xs text-gray-500">ADL independence</p>
              </>
            ) : <p className="text-sm text-gray-400 mt-1">Not assessed</p>}
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Falls Risk</p>
            {latestFalls?.riskCategory ? (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${RISK_COLOURS[latestFalls.riskCategory]}`}>
                {latestFalls.riskCategory.toUpperCase()}
              </span>
            ) : <p className="text-sm text-gray-400 mt-1">Not assessed</p>}
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Braden Score</p>
            {latestPressure?.bradenScore != null ? (
              <>
                <p className="text-2xl font-bold">{latestPressure.bradenScore}<span className="text-sm font-normal text-gray-400">/23</span></p>
                <p className="text-xs text-orange-600">{BRADEN_RISK(latestPressure.bradenScore)}</p>
              </>
            ) : <p className="text-sm text-gray-400 mt-1">Not assessed</p>}
          </div>

          {latest?.mmseScore != null && (
            <div className="bg-white border rounded-lg p-3">
              <p className="text-xs text-gray-500">MMSE</p>
              <p className="text-2xl font-bold">{latest.mmseScore}<span className="text-sm font-normal text-gray-400">/30</span></p>
              <p className="text-xs text-gray-500">{latest.mmseScore >= 24 ? 'Normal' : latest.mmseScore >= 18 ? 'Mild impairment' : latest.mmseScore >= 10 ? 'Moderate' : 'Severe'}</p>
            </div>
          )}
          {latest?.mocaScore != null && (
            <div className="bg-white border rounded-lg p-3">
              <p className="text-xs text-gray-500">MoCA</p>
              <p className="text-2xl font-bold">{latest.mocaScore}<span className="text-sm font-normal text-gray-400">/30</span></p>
              <p className={`text-xs ${latest.mocaScore < 26 ? 'text-orange-600' : 'text-gray-500'}`}>{latest.mocaScore < 26 ? 'Below threshold' : 'Normal'}</p>
            </div>
          )}
          {acpDocs.some(d => d.isActive) && (
            <div className="col-span-2 md:col-span-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Active ACP Documents</span>
              </div>
              {acpDocs.filter(d => d.isActive).map(d => (
                <p key={d.id} className="text-xs text-amber-700 mt-1">• {d.documentType} — {d.documentDate}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Comprehensive Geriatric Assessment ───────────────────────────── */}
      {tab === 'assessment' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Comprehensive Geriatric Assessment ({assessments.length})</p>
            <button onClick={() => setShowAssessForm(v => !v)} className="flex items-center gap-1 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-teal-700">
              <Plus className="h-4 w-4" /> New Assessment
            </button>
          </div>

          {showAssessForm && (
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <p className="text-sm font-semibold">New CGA</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  ['clinicalFrailtyScale','Clinical Frailty Scale (1–9)', 1, 9],
                  ['barthelIndex','Barthel Index (0–100)', 0, 100],
                  ['mmseScore','MMSE (0–30)', 0, 30],
                  ['mocaScore','MoCA (0–30)', 0, 30],
                  ['gdsScore','GDS Depression (0–30)', 0, 30],
                  ['tinnettiScore','Tinetti Total', 0, 28],
                  ['adlScore','ADL Score', 0, null],
                  ['iadlScore','IADL Score', 0, null],
                ].map(([key, label, min, max]) => (
                  <div key={key as string}>
                    <label className="text-xs text-gray-500">{label as string}</label>
                    <input
                      type="number"
                      min={min as number}
                      max={max as number || undefined}
                      value={assessDto[key as string] ?? ''}
                      onChange={e => setAssessDto((p: any) => ({ ...p, [key as string]: e.target.value ? +e.target.value : undefined }))}
                      className="w-full border rounded px-2 py-1 text-sm mt-1"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500">Nutritional Screen</label>
                  <select value={assessDto.nutritionalScreen || ''} onChange={e => setAssessDto((p: any) => ({ ...p, nutritionalScreen: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">Select…</option>
                    <option value="normal">Normal</option>
                    <option value="at_risk">At risk</option>
                    <option value="malnourished">Malnourished</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Social Support</label>
                  <select value={assessDto.socialSupport || ''} onChange={e => setAssessDto((p: any) => ({ ...p, socialSupport: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">Select…</option>
                    <option value="good">Good</option>
                    <option value="limited">Limited</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Caregiver Burden</label>
                  <select value={assessDto.caregiverBurden || ''} onChange={e => setAssessDto((p: any) => ({ ...p, caregiverBurden: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">Select…</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
                {[['hearingImpaired','Hearing impaired'], ['visionImpaired','Vision impaired'], ['continenceIssues','Continence issues']].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!assessDto[key]} onChange={e => setAssessDto((p: any) => ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <textarea rows={2} value={assessDto.notes || ''} onChange={e => setAssessDto((p: any) => ({ ...p, notes: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
              </div>
              <div className="flex gap-2">
                <button onClick={submitAssessment} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-700">Save & Assess Frailty</button>
                <button onClick={() => setShowAssessForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {frailtyResult && (
            <div className={`rounded-lg p-4 border ${FRAILTY_COLOURS[frailtyResult.frailty_category]?.includes('red') ? 'border-red-300' : 'border-teal-200'} bg-white`}>
              <p className="font-semibold text-sm">CFS Result: {frailtyResult.label}</p>
              <p className="text-xs text-gray-600 mt-1 italic">{frailtyResult.description}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs ${FRAILTY_COLOURS[frailtyResult.frailty_category] || ''}`}>{frailtyResult.frailty_category?.replace(/_/g,' ')}</span>
              {frailtyResult.cognitive_flag && <p className="text-xs text-orange-700 mt-2">🧠 {frailtyResult.cognitive_flag}</p>}
              {frailtyResult.functional_flag && <p className="text-xs text-blue-700 mt-1">🏥 {frailtyResult.functional_flag}</p>}
              {frailtyResult.resuscitation_note && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs text-red-800 font-semibold">{frailtyResult.resuscitation_note}</p>
                </div>
              )}
              <div className="mt-2 space-y-0.5">
                {frailtyResult.care_implications?.map((c: string, i: number) => (
                  <p key={i} className="text-xs text-gray-700">• {c}</p>
                ))}
              </div>
            </div>
          )}

          {assessments.length === 0 && !showAssessForm && <p className="text-sm text-gray-400">No assessments recorded.</p>}
          {assessments.map(a => (
            <div key={a.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold">{new Date(a.assessmentDate).toLocaleDateString()}</p>
                  {a.clinicalFrailtyScale && <p className="text-xs text-gray-600">CFS: {a.clinicalFrailtyScale}/9</p>}
                </div>
                <div className="flex gap-2 text-xs flex-wrap">
                  {a.barthelIndex != null && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Barthel {a.barthelIndex}</span>}
                  {a.mmseScore != null && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">MMSE {a.mmseScore}</span>}
                  {a.mocaScore != null && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">MoCA {a.mocaScore}</span>}
                  {a.gdsScore != null && <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">GDS {a.gdsScore}</span>}
                </div>
              </div>
              {a.notes && <p className="text-xs text-gray-500 mt-2">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Falls ─────────────────────────────────────────────────────────── */}
      {tab === 'falls' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Falls Assessments ({fallsAssessments.length})</p>
            <button onClick={() => setShowFallsForm(v => !v)} className="flex items-center gap-1 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-teal-700">
              <Plus className="h-4 w-4" /> Assess Falls Risk
            </button>
          </div>
          {showFallsForm && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Falls in last 6 months</label>
                  <input type="number" min={0} value={fallsDto.fallHistoryCount} onChange={e => setFallsDto((p: any) => ({ ...p, fallHistoryCount: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Ambulation</label>
                  <select value={fallsDto.ambulation} onChange={e => setFallsDto((p: any) => ({ ...p, ambulation: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    {['normal','uses_aid','impaired','bed_rest'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Gait</label>
                  <select value={fallsDto.gait} onChange={e => setFallsDto((p: any) => ({ ...p, gait: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    {['normal','weak','impaired'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Mental Status</label>
                  <select value={fallsDto.mentalStatus} onChange={e => setFallsDto((p: any) => ({ ...p, mentalStatus: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="oriented">Oriented</option>
                    <option value="confused">Confused</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tinetti Gait (0–12)</label>
                  <input type="number" min={0} max={12} value={fallsDto.tinnettiGait ?? ''} onChange={e => setFallsDto((p: any) => ({ ...p, tinnettiGait: e.target.value ? +e.target.value : undefined }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tinetti Balance (0–16)</label>
                  <input type="number" min={0} max={16} value={fallsDto.tinnettiBalance ?? ''} onChange={e => setFallsDto((p: any) => ({ ...p, tinnettiBalance: e.target.value ? +e.target.value : undefined }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={fallsDto.ivLinePresent} onChange={e => setFallsDto((p: any) => ({ ...p, ivLinePresent: e.target.checked }))} /><label className="text-sm">IV line present</label></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={fallsDto.secondaryDiagnosis} onChange={e => setFallsDto((p: any) => ({ ...p, secondaryDiagnosis: e.target.checked }))} /><label className="text-sm">Secondary diagnosis</label></div>
              </div>
              <div className="flex gap-2">
                <button onClick={submitFalls} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-700">Save & Score</button>
                <button onClick={() => setShowFallsForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}
          {fallRiskResult && (
            <div className={`rounded-lg p-4 border ${fallRiskResult.overall_risk === 'high' ? 'bg-red-50 border-red-300' : fallRiskResult.overall_risk === 'medium' ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-300'}`}>
              <p className="font-semibold text-sm">Fall Risk: <span className={`px-2 py-0.5 rounded-full text-xs ${RISK_COLOURS[fallRiskResult.overall_risk]}`}>{fallRiskResult.overall_risk?.toUpperCase()}</span></p>
              <p className="text-xs text-gray-600 mt-1">Morse: {fallRiskResult.morse_score} ({fallRiskResult.morse_risk}){fallRiskResult.tinnetti_total != null ? ` · Tinetti: ${fallRiskResult.tinnetti_total} (${fallRiskResult.tinnetti_risk})` : ''}</p>
              <div className="mt-2 space-y-0.5">
                {fallRiskResult.prevention_plan?.map((p: string, i: number) => <p key={i} className="text-xs text-gray-700">• {p}</p>)}
              </div>
              {fallRiskResult.physiotherapy_referral && <p className="text-xs text-blue-700 mt-1 font-medium">→ Physiotherapy referral recommended</p>}
              {fallRiskResult.occupational_therapy_referral && <p className="text-xs text-blue-700 font-medium">→ Occupational therapy referral recommended</p>}
            </div>
          )}
          {fallsAssessments.length === 0 && !showFallsForm && <p className="text-sm text-gray-400">No falls assessments recorded.</p>}
          {fallsAssessments.map(f => (
            <div key={f.id} className="bg-white border rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold">{new Date(f.assessmentDate).toLocaleDateString()}</p>
                <p className="text-xs text-gray-500">Morse: {f.morseScore ?? '—'} · Falls: {f.fallHistoryCount}</p>
              </div>
              {f.riskCategory && <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLOURS[f.riskCategory]}`}>{f.riskCategory}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Pressure Injury ───────────────────────────────────────────────── */}
      {tab === 'pressure' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Pressure Injury Assessments ({pressureAssessments.length})</p>
            <button onClick={() => setShowPressureForm(v => !v)} className="flex items-center gap-1 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-teal-700">
              <Plus className="h-4 w-4" /> New Assessment
            </button>
          </div>
          {showPressureForm && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Braden Score (6–23, lower = higher risk)</label>
                  <input type="number" min={6} max={23} value={pressureDto.bradenScore} onChange={e => setPressureDto((p: any) => ({ ...p, bradenScore: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                  <p className="text-xs text-orange-600 mt-0.5">{BRADEN_RISK(pressureDto.bradenScore)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Repositioning Schedule</label>
                  <input value={pressureDto.repositioningSchedule || ''} onChange={e => setPressureDto((p: any) => ({ ...p, repositioningSchedule: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="e.g. Every 2 hours" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Prevention Protocol</label>
                  <textarea rows={2} value={pressureDto.preventionProtocol || ''} onChange={e => setPressureDto((p: any) => ({ ...p, preventionProtocol: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Skin Condition</label>
                  <input value={pressureDto.skinCondition || ''} onChange={e => setPressureDto((p: any) => ({ ...p, skinCondition: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="e.g. Intact, dry, erythema over sacrum" />
                </div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={pressureDto.specialSurfaceRequired} onChange={e => setPressureDto((p: any) => ({ ...p, specialSurfaceRequired: e.target.checked }))} /><label className="text-sm">Special pressure-relieving surface required</label></div>
              </div>
              <div className="flex gap-2">
                <button onClick={submitPressure} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-700">Save</button>
                <button onClick={() => setShowPressureForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}
          {pressureAssessments.length === 0 && !showPressureForm && <p className="text-sm text-gray-400">No pressure injury assessments recorded.</p>}
          {pressureAssessments.map(p => (
            <div key={p.id} className={`bg-white border rounded-lg p-4 ${p.bradenScore <= 12 ? 'border-red-300' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold">{new Date(p.assessmentDate).toLocaleDateString()}</p>
                  <p className={`text-xs mt-0.5 ${p.bradenScore <= 12 ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>Braden {p.bradenScore}/23 — {BRADEN_RISK(p.bradenScore)}</p>
                </div>
                {p.specialSurfaceRequired && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Special surface</span>}
              </div>
              {p.repositioningSchedule && <p className="text-xs text-gray-500 mt-1">Repositioning: {p.repositioningSchedule}</p>}
              {p.skinCondition && <p className="text-xs text-gray-500">Skin: {p.skinCondition}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Polypharmacy ──────────────────────────────────────────────────── */}
      {tab === 'polypharmacy' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Pill className="h-4 w-4 text-teal-600" /> Beers Criteria 2023 Review</p>
            <div>
              <label className="text-xs text-gray-500">Patient Age</label>
              <input type="number" value={patientAge} onChange={e => setPatientAge(+e.target.value)} className="w-24 border rounded px-2 py-1 text-sm mt-1 ml-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Medication List (one per line: Drug Name, Class, Dose mg)</label>
              <textarea
                rows={6}
                value={medList}
                onChange={e => setMedList(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm mt-1 font-mono"
                placeholder={"Amitriptyline, antidepressant, 25\nDiazepam, benzodiazepine, 5\nIbuprofen, NSAID, 400"}
              />
            </div>
            <button onClick={runPolypharmacyCheck} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-700">Run Beers Check</button>
          </div>

          {polypharmacyResult && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="bg-gray-50 rounded px-3 py-2 text-center">
                  <p className="text-xs text-gray-500">Total Meds</p>
                  <p className="text-xl font-bold">{polypharmacyResult.total_medications}</p>
                </div>
                <div className={`rounded px-3 py-2 text-center ${polypharmacyResult.beers_flags?.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className="text-xs text-gray-500">Beers Flags</p>
                  <p className={`text-xl font-bold ${polypharmacyResult.beers_flags?.length > 0 ? 'text-red-700' : 'text-green-700'}`}>{polypharmacyResult.beers_flags?.length || 0}</p>
                </div>
                {polypharmacyResult.excessive_polypharmacy && (
                  <div className="bg-orange-50 rounded px-3 py-2 text-center">
                    <p className="text-xs text-orange-700 font-semibold">Excessive polypharmacy (≥10)</p>
                  </div>
                )}
              </div>
              {polypharmacyResult.beers_flags?.map((f: any, i: number) => (
                <div key={i} className={`rounded-lg p-3 border text-xs ${f.severity === 'high' ? 'bg-red-50 border-red-200' : f.severity === 'moderate' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <p className="font-semibold">{f.drug} — {f.category}</p>
                  <p className="text-gray-700 mt-0.5">{f.concern}</p>
                  <p className="text-gray-400 mt-0.5">{f.source}</p>
                </div>
              ))}
              {polypharmacyResult.deprescribing_recommendations?.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Deprescribing Recommendations</p>
                  {polypharmacyResult.deprescribing_recommendations.map((r: string, i: number) => (
                    <p key={i} className="text-xs text-blue-700">• {r}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {polypharmacyReviews.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm font-semibold mb-2">Review History</p>
              {polypharmacyReviews.map(r => (
                <div key={r.id} className="border-b last:border-0 py-2 flex justify-between text-xs text-gray-600">
                  <span>{new Date(r.reviewDate).toLocaleDateString()}</span>
                  <span>{r.totalMedications} meds · {r.beersCriteriaFlags?.length || 0} flags</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Advance Care Planning ─────────────────────────────────────────── */}
      {tab === 'acp' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">ACP Documents ({acpDocs.length})</p>
            <button onClick={() => setShowAcpForm(v => !v)} className="flex items-center gap-1 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-teal-700">
              <Plus className="h-4 w-4" /> Add Document
            </button>
          </div>
          {showAcpForm && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Document Type</label>
                  <select value={acpDto.documentType} onChange={e => setAcpDto((p: any) => ({ ...p, documentType: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    {['DNACPR','living_will','health_proxy','advance_directive','goals_of_care'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Document Date</label>
                  <input type="date" value={acpDto.documentDate} onChange={e => setAcpDto((p: any) => ({ ...p, documentDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Review Date</label>
                  <input type="date" value={acpDto.reviewDate || ''} onChange={e => setAcpDto((p: any) => ({ ...p, reviewDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Summary / Key Decisions</label>
                  <textarea rows={3} value={acpDto.summary || ''} onChange={e => setAcpDto((p: any) => ({ ...p, summary: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
                {[['capacityConfirmed','Capacity confirmed'], ['physicianSigned','Physician signed'], ['witnessSigned','Witness signed'], ['patientSigned','Patient signed']].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!acpDto[key]} onChange={e => setAcpDto((p: any) => ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={submitAcp} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-700">Save</button>
                <button onClick={() => setShowAcpForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}
          {acpDocs.length === 0 && !showAcpForm && <p className="text-sm text-gray-400">No ACP documents on file.</p>}
          {acpDocs.map(d => (
            <div key={d.id} className={`bg-white border rounded-lg p-4 ${d.isActive ? 'border-amber-300' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold">{d.documentType?.replace(/_/g,' ')}</p>
                  <p className="text-xs text-gray-500">{d.documentDate}{d.reviewDate ? ` · Review: ${d.reviewDate}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  {d.isActive && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Active</span>}
                </div>
              </div>
              {d.summary && <p className="text-xs text-gray-600 mt-2">{d.summary}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {d.capacityConfirmed && <span className="text-xs text-green-700">✓ Capacity</span>}
                {d.physicianSigned && <span className="text-xs text-green-700">✓ Physician</span>}
                {d.witnessSigned && <span className="text-xs text-green-700">✓ Witness</span>}
                {d.patientSigned && <span className="text-xs text-green-700">✓ Patient</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
