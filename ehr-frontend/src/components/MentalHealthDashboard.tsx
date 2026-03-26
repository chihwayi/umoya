import React, { useState, useEffect, useCallback } from 'react';
import { cdssApi } from '../services/api';
import {
  Brain,
  AlertTriangle,
  ShieldCheck,
  Pill,
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
}

const RISK_COLOURS: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  imminent: 'bg-red-100 text-red-800 font-bold',
};

const SEV_COLOURS: Record<string, string> = {
  minimal: 'text-green-600',
  mild: 'text-yellow-600',
  moderate: 'text-orange-600',
  moderately_severe: 'text-orange-700 font-semibold',
  severe: 'text-red-700 font-bold',
};

const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself',
  'Trouble concentrating on things',
  'Moving or speaking slowly (or being fidgety/restless)',
  'Thoughts that you would be better off dead',
];

const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen',
];

const OPTIONS = ['Not at all (0)', 'Several days (1)', 'More than half (2)', 'Nearly every day (3)'];

export default function MentalHealthDashboard({ patientId, providerId, tenantSubdomain }: Props) {
  const [tab, setTab] = useState<'overview' | 'screening' | 'crisis' | 'safeplan' | 'meds'>('overview');
  const [screenings, setScreenings] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [crisisEvents, setCrisisEvents] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [medAlerts, setMedAlerts] = useState<Record<string, any>>({});

  const [screenTool, setScreenTool] = useState<'PHQ-9' | 'GAD-7'>('PHQ-9');
  const [screenResponses, setScreenResponses] = useState<Record<string, number>>({});
  const [screenResult, setScreenResult] = useState<any | null>(null);
  const [screenLoading, setScreenLoading] = useState(false);

  const [showCrisisForm, setShowCrisisForm] = useState(false);
  const [crisisDto, setCrisisDto] = useState<any>({ crisisType: 'suicidal_ideation', lethality: 'low', meansAccess: false, priorAttempts: 0 });

  const [showMedForm, setShowMedForm] = useState(false);
  const [medDto, setMedDto] = useState<any>({ drugName: '', drugClass: 'antidepressant', doseMg: '', frequency: '', startDate: new Date().toISOString().slice(0, 10), indication: '' });

  const load = useCallback(async () => {
    try {
      const [sc, enc, cr, sp, meds] = await Promise.all([
        cdssApi.getMhScreenings(patientId, tenantSubdomain),
        cdssApi.getMhEncounters(patientId, tenantSubdomain),
        cdssApi.getMhCrisisEvents(patientId, tenantSubdomain),
        cdssApi.getActiveSafePlan(patientId, tenantSubdomain),
        cdssApi.getMhMedications(patientId, tenantSubdomain, true),
      ]);
      setScreenings(sc);
      setEncounters(enc);
      setCrisisEvents(cr);
      setActivePlan(sp);
      setMedications(meds);

      // Run monitoring alerts for each active med
      const alerts: Record<string, any> = {};
      await Promise.all(
        meds.map(async (m: any) => {
          try {
            const res = await cdssApi.monitorMhMedication({
              drug_name: m.drugName,
              drug_class: m.drugClass,
              dose_mg: m.doseMg,
              last_level_value: m.lastLevelValue,
              last_level_unit: m.lastLevelUnit,
              last_level_date: m.lastLevelDate,
            });
            alerts[m.id] = res;
          } catch { /* non-blocking */ }
        }),
      );
      setMedAlerts(alerts);
    } catch (e) { /* ignore */ }
  }, [patientId, tenantSubdomain]);

  useEffect(() => { load(); }, [load]);

  const latestPhq = screenings.find(s => s.tool === 'PHQ-9');
  const latestGad = screenings.find(s => s.tool === 'GAD-7');
  const hasHighRisk = crisisEvents.some((c: any) => c.lethality === 'high' && c.outcome !== 'stabilised');
  const hasCriticalMedAlert = Object.values(medAlerts).some((a: any) => a?.has_critical_alert);

  async function runScreening() {
    setScreenLoading(true);
    try {
      const result = await cdssApi.scoreMhScreening({ tool: screenTool, responses: screenResponses });
      setScreenResult(result);
      // Save the screening
      await cdssApi.addMhScreening(patientId, tenantSubdomain, {
        screenedBy: providerId,
        tool: screenTool,
        responses: screenResponses,
        totalScore: result.total_score,
        severity: result.severity,
        riskLevel: result.risk_level,
        actionTaken: result.recommended_action,
      });
      await load();
    } finally {
      setScreenLoading(false);
    }
  }

  async function submitCrisis() {
    await cdssApi.addMhCrisisEvent(patientId, tenantSubdomain, { ...crisisDto, reportedBy: providerId });
    setShowCrisisForm(false);
    setCrisisDto({ crisisType: 'suicidal_ideation', lethality: 'low', meansAccess: false, priorAttempts: 0 });
    load();
  }

  async function submitMed() {
    await cdssApi.addMhMedication(patientId, tenantSubdomain, { ...medDto, prescribedBy: providerId });
    setShowMedForm(false);
    setMedDto({ drugName: '', drugClass: 'antidepressant', doseMg: '', frequency: '', startDate: new Date().toISOString().slice(0, 10), indication: '' });
    load();
  }

  const questions = screenTool === 'PHQ-9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS;

  return (
    <div className="space-y-4">
      {/* Banner alerts */}
      {hasHighRisk && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800 font-semibold text-sm">High-lethality crisis event on record — review immediately</span>
        </div>
      )}
      {hasCriticalMedAlert && (
        <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 flex items-center gap-2">
          <Pill className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <span className="text-orange-800 font-semibold text-sm">Critical medication monitoring alert — check Medications tab</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['overview',  'Overview',   Brain],
          ['screening', 'Screening',  ClipboardList],
          ['crisis',    'Crisis',     AlertTriangle],
          ['safeplan',  'Safe Plan',  ShieldCheck],
          ['meds',      'Medications',Pill],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
            <p className="text-xs text-gray-500">Latest PHQ-9</p>
            {latestPhq ? (
              <>
                <p className="text-2xl font-bold">{latestPhq.totalScore}</p>
                <p className={`text-xs ${SEV_COLOURS[latestPhq.severity] || ''}`}>{latestPhq.severity}</p>
              </>
            ) : <p className="text-sm text-gray-400 mt-1">Not done</p>}
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Latest GAD-7</p>
            {latestGad ? (
              <>
                <p className="text-2xl font-bold">{latestGad.totalScore}</p>
                <p className={`text-xs ${SEV_COLOURS[latestGad.severity] || ''}`}>{latestGad.severity}</p>
              </>
            ) : <p className="text-sm text-gray-400 mt-1">Not done</p>}
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Crisis Events</p>
            <p className="text-2xl font-bold">{crisisEvents.length}</p>
            <p className="text-xs text-gray-400">total recorded</p>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Active Meds</p>
            <p className="text-2xl font-bold">{medications.length}</p>
            <p className="text-xs text-gray-400">psychotropic</p>
          </div>

          {/* Latest risk level */}
          {latestPhq?.riskLevel && (
            <div className="col-span-2 md:col-span-4 bg-white border rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Most Recent Screening Risk Level</p>
              <span className={`px-2 py-1 rounded-full text-xs ${RISK_COLOURS[latestPhq.riskLevel] || ''}`}>
                {latestPhq.riskLevel?.toUpperCase()}
              </span>
              <span className="ml-2 text-xs text-gray-600">{latestPhq.actionTaken}</span>
            </div>
          )}

          {/* Safe plan summary */}
          {activePlan && (
            <div className="col-span-2 md:col-span-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-800">Active Safety Plan on file</span>
              </div>
              <p className="text-xs text-green-700">Reason to live: {activePlan.reasonToLive || '—'}</p>
              <p className="text-xs text-green-700">Warning signs: {(activePlan.warningSigns || []).join(', ') || '—'}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Screening ────────────────────────────────────────────────────── */}
      {tab === 'screening' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-medium">Tool:</label>
              <select
                value={screenTool}
                onChange={e => { setScreenTool(e.target.value as any); setScreenResponses({}); setScreenResult(null); }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="PHQ-9">PHQ-9 (Depression)</option>
                <option value="GAD-7">GAD-7 (Anxiety)</option>
              </select>
            </div>

            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="bg-gray-50 rounded p-3">
                  <p className="text-sm font-medium mb-2">{i + 1}. {q}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {OPTIONS.map((opt, val) => (
                      <label key={val} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`q${i + 1}`}
                          value={val}
                          checked={screenResponses[String(i + 1)] === val}
                          onChange={() => setScreenResponses(prev => ({ ...prev, [String(i + 1)]: val }))}
                          className="accent-purple-600"
                        />
                        <span className="text-xs">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={runScreening}
              disabled={screenLoading || Object.keys(screenResponses).length < questions.length}
              className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {screenLoading ? 'Scoring…' : 'Score & Save'}
            </button>

            {screenResult && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-1">
                <p className="font-semibold text-purple-900">Score: {screenResult.total_score}</p>
                <p className="text-sm text-purple-800">Severity: <span className={SEV_COLOURS[screenResult.severity]}>{screenResult.severity}</span></p>
                <p className="text-sm text-purple-800">Risk: <span className={`px-1.5 py-0.5 rounded text-xs ${RISK_COLOURS[screenResult.risk_level]}`}>{screenResult.risk_level}</span></p>
                <p className="text-xs text-purple-700 mt-1">{screenResult.recommended_action}</p>
              </div>
            )}
          </div>

          {/* History */}
          {screenings.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm font-semibold mb-3">Screening History</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left py-1 pr-3">Date</th>
                      <th className="text-left py-1 pr-3">Tool</th>
                      <th className="text-left py-1 pr-3">Score</th>
                      <th className="text-left py-1 pr-3">Severity</th>
                      <th className="text-left py-1">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screenings.map(s => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="py-1 pr-3">{new Date(s.screenedAt).toLocaleDateString()}</td>
                        <td className="py-1 pr-3">{s.tool}</td>
                        <td className="py-1 pr-3 font-bold">{s.totalScore}</td>
                        <td className={`py-1 pr-3 ${SEV_COLOURS[s.severity] || ''}`}>{s.severity}</td>
                        <td className="py-1">
                          <span className={`px-1.5 py-0.5 rounded ${RISK_COLOURS[s.riskLevel] || ''}`}>{s.riskLevel}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Crisis ───────────────────────────────────────────────────────── */}
      {tab === 'crisis' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Crisis Events ({crisisEvents.length})</p>
            <button
              onClick={() => setShowCrisisForm(v => !v)}
              className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700"
            >
              <Plus className="h-4 w-4" /> Record Event
            </button>
          </div>

          {showCrisisForm && (
            <div className="bg-white border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">New Crisis Event</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Crisis Type</label>
                  <select value={crisisDto.crisisType} onChange={e => setCrisisDto((p: any) => ({ ...p, crisisType: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    {['suicidal_ideation','suicide_attempt','self_harm','psychosis','aggression','substance_intoxication','panic_attack','other'].map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Ideation Type</label>
                  <select value={crisisDto.ideationType || ''} onChange={e => setCrisisDto((p: any) => ({ ...p, ideationType: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">N/A</option>
                    {['passive','active_no_plan','active_with_plan','active_with_intent'].map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Lethality</label>
                  <select value={crisisDto.lethality} onChange={e => setCrisisDto((p: any) => ({ ...p, lethality: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    {['low','medium','high'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Prior Attempts</label>
                  <input type="number" min={0} value={crisisDto.priorAttempts} onChange={e => setCrisisDto((p: any) => ({ ...p, priorAttempts: +e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <input type="checkbox" id="means" checked={crisisDto.meansAccess} onChange={e => setCrisisDto((p: any) => ({ ...p, meansAccess: e.target.checked }))} />
                  <label htmlFor="means" className="text-sm">Access to means</label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Intervention</label>
                  <textarea rows={2} value={crisisDto.intervention || ''} onChange={e => setCrisisDto((p: any) => ({ ...p, intervention: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Outcome</label>
                  <select value={crisisDto.outcome || ''} onChange={e => setCrisisDto((p: any) => ({ ...p, outcome: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    <option value="">Select…</option>
                    {['stabilised','admitted','referred','absconded','deceased','ongoing'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={submitCrisis} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700">Save</button>
                <button onClick={() => setShowCrisisForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {crisisEvents.length === 0 && <p className="text-sm text-gray-400">No crisis events recorded.</p>}

          {crisisEvents.map(ev => (
            <div key={ev.id} className={`bg-white border rounded-lg p-4 ${ev.lethality === 'high' ? 'border-red-300' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold capitalize">{ev.crisisType?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">{new Date(ev.eventDate).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  {ev.lethality && <span className={`text-xs px-2 py-0.5 rounded-full ${ev.lethality === 'high' ? 'bg-red-100 text-red-800' : ev.lethality === 'medium' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{ev.lethality} lethality</span>}
                  {ev.outcome && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{ev.outcome}</span>}
                </div>
              </div>
              {ev.intervention && <p className="text-xs text-gray-600 mt-2">Intervention: {ev.intervention}</p>}
              {ev.meansAccess && <p className="text-xs text-red-700 font-semibold mt-1">⚠ Access to means</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Safe Plan ────────────────────────────────────────────────────── */}
      {tab === 'safeplan' && (
        <SafePlanTab
          patientId={patientId}
          providerId={providerId}
          tenantSubdomain={tenantSubdomain}
          activePlan={activePlan}
          onSaved={load}
        />
      )}

      {/* ── Medications ──────────────────────────────────────────────────── */}
      {tab === 'meds' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold">Psychotropic Medications ({medications.length} active)</p>
            <button onClick={() => setShowMedForm(v => !v)} className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-purple-700">
              <Plus className="h-4 w-4" /> Add Medication
            </button>
          </div>

          {showMedForm && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold">New Psychotropic Medication</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Drug Name</label>
                  <input value={medDto.drugName} onChange={e => setMedDto((p: any) => ({ ...p, drugName: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="e.g. Lithium carbonate" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Class</label>
                  <select value={medDto.drugClass} onChange={e => setMedDto((p: any) => ({ ...p, drugClass: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1">
                    {['antidepressant','antipsychotic','mood_stabilizer','anxiolytic','stimulant','hypnotic','other'].map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Dose (mg)</label>
                  <input type="number" value={medDto.doseMg} onChange={e => setMedDto((p: any) => ({ ...p, doseMg: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Frequency</label>
                  <input value={medDto.frequency} onChange={e => setMedDto((p: any) => ({ ...p, frequency: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="e.g. twice daily" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Start Date</label>
                  <input type="date" value={medDto.startDate} onChange={e => setMedDto((p: any) => ({ ...p, startDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Indication</label>
                  <input value={medDto.indication} onChange={e => setMedDto((p: any) => ({ ...p, indication: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="e.g. Bipolar I disorder" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={submitMed} className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-purple-700">Save</button>
                <button onClick={() => setShowMedForm(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {medications.length === 0 && <p className="text-sm text-gray-400">No active psychotropic medications.</p>}

          {medications.map(m => {
            const alert = medAlerts[m.id];
            return (
              <div key={m.id} className={`bg-white border rounded-lg p-4 ${alert?.has_critical_alert ? 'border-red-300' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold">{m.drugName}</p>
                    <p className="text-xs text-gray-500">{m.drugClass?.replace(/_/g,' ')} · {m.doseMg}mg {m.frequency}</p>
                    <p className="text-xs text-gray-400">Started {m.startDate}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{m.status}</span>
                </div>

                {alert && (
                  <div className="mt-3 space-y-1">
                    {alert.alerts?.map((a: any, i: number) => (
                      <div key={i} className={`text-xs px-2 py-1 rounded ${a.severity === 'danger' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
                        {a.message}
                      </div>
                    ))}
                    {alert.monitoring_due?.length > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Monitoring due: </span>
                        {alert.monitoring_due.slice(0, 2).join(' · ')}
                        {alert.monitoring_due.length > 2 && ` +${alert.monitoring_due.length - 2} more`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Safe Plan sub-component ───────────────────────────────────────────────────

function SafePlanTab({ patientId, providerId, tenantSubdomain, activePlan, onSaved }: any) {
  const [editing, setEditing] = useState(!activePlan);
  const [dto, setDto] = useState({
    warningSigns: activePlan?.warningSigns?.join('\n') || '',
    internalCoping: activePlan?.internalCoping?.join('\n') || '',
    socialDistractions: activePlan?.socialDistractions?.join('\n') || '',
    supportContacts: activePlan?.supportContacts?.join('\n') || '',
    professionalContacts: activePlan?.professionalContacts?.join('\n') || '',
    meansRestriction: activePlan?.meansRestriction || '',
    reasonToLive: activePlan?.reasonToLive || '',
  });

  async function save() {
    await cdssApi.upsertSafePlan(patientId, tenantSubdomain, {
      createdBy: providerId,
      warningSigns: dto.warningSigns.split('\n').filter(Boolean),
      internalCoping: dto.internalCoping.split('\n').filter(Boolean),
      socialDistractions: dto.socialDistractions.split('\n').filter(Boolean),
      supportContacts: dto.supportContacts.split('\n').filter(Boolean),
      professionalContacts: dto.professionalContacts.split('\n').filter(Boolean),
      meansRestriction: dto.meansRestriction,
      reasonToLive: dto.reasonToLive,
    });
    setEditing(false);
    onSaved();
  }

  const sections = [
    ['Warning Signs', 'warningSigns', 'What thoughts, images, moods, or behaviours indicate a crisis may be developing?'],
    ['Internal Coping', 'internalCoping', 'Things I can do on my own to distract myself'],
    ['Social Distractions', 'socialDistractions', 'People and settings that provide distraction'],
    ['Support Contacts', 'supportContacts', 'People I can ask for help (name and phone)'],
    ['Professional Contacts', 'professionalContacts', 'Clinicians and crisis lines (name, number)'],
  ] as const;

  return (
    <div className="space-y-4">
      {!editing && activePlan && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-800">Active Safety Plan</span>
            </div>
            <button onClick={() => setEditing(true)} className="text-xs text-green-700 underline">Edit</button>
          </div>
          {sections.map(([label, key]) => activePlan[key]?.length > 0 && (
            <div key={key}>
              <p className="text-xs font-medium text-green-700">{label}</p>
              <ul className="list-disc list-inside">
                {activePlan[key].map((item: string, i: number) => (
                  <li key={i} className="text-xs text-green-900">{item}</li>
                ))}
              </ul>
            </div>
          ))}
          {activePlan.meansRestriction && (
            <div>
              <p className="text-xs font-medium text-green-700">Means Restriction</p>
              <p className="text-xs text-green-900">{activePlan.meansRestriction}</p>
            </div>
          )}
          {activePlan.reasonToLive && (
            <div>
              <p className="text-xs font-medium text-green-700">Reason to Live</p>
              <p className="text-xs text-green-900 italic">"{activePlan.reasonToLive}"</p>
            </div>
          )}
        </div>
      )}

      {(editing || !activePlan) && (
        <div className="bg-white border rounded-lg p-4 space-y-4">
          <p className="text-sm font-semibold">{activePlan ? 'Update' : 'Create'} Safety Plan (Stanley-Brown)</p>
          {sections.map(([label, key, hint]) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-700">{label}</label>
              <p className="text-xs text-gray-400 mb-1">{hint}</p>
              <textarea
                rows={3}
                value={dto[key]}
                onChange={e => setDto(p => ({ ...p, [key]: e.target.value }))}
                placeholder="One per line…"
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-700">Means Restriction</label>
            <input value={dto.meansRestriction} onChange={e => setDto(p => ({ ...p, meansRestriction: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="Describe steps taken to restrict access to means" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Reason to Live</label>
            <input value={dto.reasonToLive} onChange={e => setDto(p => ({ ...p, reasonToLive: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm mt-1" placeholder="Patient's stated reason to live" />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700">Save Plan</button>
            {activePlan && <button onClick={() => setEditing(false)} className="border px-4 py-1.5 rounded-lg text-sm">Cancel</button>}
          </div>
        </div>
      )}

      {!activePlan && !editing && (
        <div className="text-center py-8">
          <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No active safety plan on file</p>
          <button onClick={() => setEditing(true)} className="mt-2 text-sm text-purple-600 underline">Create one now</button>
        </div>
      )}
    </div>
  );
}
