import React, { useState, useEffect } from 'react';
import { AlertTriangle, Heart, Users, BookOpen, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface PsychosocialTabProps {
  patientId: string;
  patientAge: number;
  staffRole: string;
  tenantSlug: string;
}

const DISCLOSURE_STATUSES = [
  { value: 'not_disclosed', label: 'Not Disclosed' },
  { value: 'partially_disclosed', label: 'Partially Disclosed' },
  { value: 'fully_disclosed', label: 'Fully Disclosed' },
  { value: 'disclosure_not_applicable', label: 'Not Applicable' },
];

const SESSION_TYPES = ['eac', 'disclosure_counselling', 'adherence', 'gbv', 'grief', 'mental_health', 'family', 'other'];

const GBV_ROLES = ['counsellor', 'senior_nurse', 'doctor'];

const PsychosocialTab: React.FC<PsychosocialTabProps> = ({ patientId, patientAge, staffRole, tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'disclosure' | 'transition' | 'gbv' | 'sessions'>('disclosure');

  const [disclosureHistory, setDisclosureHistory] = useState<any[]>([]);
  const [transitionHistory, setTransitionHistory] = useState<any[]>([]);
  const [gbvHistory, setGbvHistory] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [showDisclosureModal, setShowDisclosureModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [showGbvModal, setShowGbvModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const [disclosureForm, setDisclosureForm] = useState({
    disclosureStatus: 'not_disclosed',
    disclosedTo: [] as string[],
    readinessScore: 5,
    barriers: '',
    counsellingProvided: false,
    counsellingNotes: '',
    nextReviewDate: '',
  });

  const [traqScores, setTraqScores] = useState({
    knowsDiagnosis: 1, knowsMedications: 1, managesOwnMedications: 1,
    attendsAppointmentsAlone: 1, communicatesWithProvider: 1, understandsConfidentiality: 1,
  });

  const [hitsScores, setHitsScores] = useState({ hurt: 1, insult: 1, threaten: 1, scream: 1 });
  const [safetyPlan, setSafetyPlan] = useState('');
  const [weaponInHome, setWeaponInHome] = useState(false);
  const [escalatingViolence, setEscalatingViolence] = useState(false);

  const [sessionForm, setSessionForm] = useState({
    sessionType: 'eac', attendance: 'attended', presentingIssues: '', sessionNotes: '',
    nextSessionDate: '', durationMinutes: 60,
  });

  const token = localStorage.getItem('ehr_token') || '';

  const hitsTotal = hitsScores.hurt + hitsScores.insult + hitsScores.threaten + hitsScores.scream;
  const hitsPositive = hitsTotal >= 11;
  const dangerLevel = (() => {
    if (weaponInHome || (hitsTotal >= 16 && escalatingViolence)) return 'imminent_danger';
    if (hitsTotal >= 16 || escalatingViolence) return 'high_risk';
    if (hitsTotal >= 11) return 'moderate_risk';
    return 'safe';
  })();

  useEffect(() => {
    loadData();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'disclosure') {
        const res = await ehrApi.getDisclosureHistory(patientId, token, tenantSlug);
        setDisclosureHistory(Array.isArray(res.data) ? res.data : []);
      } else if (activeTab === 'transition') {
        const res = await ehrApi.getTransitionHistory(patientId, token, tenantSlug);
        setTransitionHistory(Array.isArray(res.data) ? res.data : []);
      } else if (activeTab === 'gbv' && GBV_ROLES.includes(staffRole)) {
        const res = await ehrApi.getGbvHistory(patientId, token, tenantSlug);
        setGbvHistory(Array.isArray(res.data) ? res.data : []);
      } else if (activeTab === 'sessions') {
        const res = await ehrApi.getCounsellorSessions(patientId, token, tenantSlug);
        setSessions(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      // non-critical load error
    } finally {
      setLoading(false);
    }
  };

  const traqTotal = Object.values(traqScores).reduce((a, b) => a + b, 0);
  const traqLevel = traqTotal < 12 ? 'low' : traqTotal < 21 ? 'moderate' : 'high';

  const tabs = [
    { key: 'disclosure' as const, label: 'Disclosure', icon: Heart },
    ...(patientAge >= 10 && patientAge <= 24 ? [{ key: 'transition' as const, label: 'ALHIV Transition', icon: Users }] : []),
    ...(GBV_ROLES.includes(staffRole) ? [{ key: 'gbv' as const, label: 'GBV', icon: AlertTriangle }] : []),
    { key: 'sessions' as const, label: 'Counsellor Sessions', icon: BookOpen },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-slate-500 py-6">Loading...</p>}

      {/* Disclosure Tab */}
      {activeTab === 'disclosure' && !loading && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">HIV Disclosure Timeline</h3>
            <button
              onClick={() => setShowDisclosureModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Record Assessment
            </button>
          </div>
          {disclosureHistory.length === 0 ? (
            <p className="text-slate-500 text-sm">No disclosure records yet.</p>
          ) : (
            disclosureHistory.map((r: any) => (
              <div key={r.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-800">{formatDateToDDMMYYYY(r.assessment_date)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    r.disclosure_status === 'fully_disclosed' ? 'bg-green-100 text-green-800' :
                    r.disclosure_status === 'partially_disclosed' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {r.disclosure_status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-slate-600">Readiness: {r.readiness_score}/10</div>
                {r.barriers && <div className="text-slate-500 text-xs mt-1">Barriers: {r.barriers}</div>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Transition Tab */}
      {activeTab === 'transition' && !loading && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">ALHIV Transition Readiness</h3>
            <button
              onClick={() => setShowTransitionModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> New Assessment
            </button>
          </div>
          {transitionHistory.map((a: any) => (
            <div key={a.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{formatDateToDDMMYYYY(a.assessment_date)}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  a.transition_stage === 'transferred' ? 'bg-green-100 text-green-800' :
                  a.transition_stage === 'transition_preparation' ? 'bg-blue-100 text-blue-800' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {a.transition_stage?.replace(/_/g, ' ')}
                </span>
              </div>
              {a.adult_facility_name && <div className="text-slate-600">Adult facility: {a.adult_facility_name}</div>}
            </div>
          ))}
        </div>
      )}

      {/* GBV Tab */}
      {activeTab === 'gbv' && !loading && GBV_ROLES.includes(staffRole) && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">GBV (HITS) Screening</h3>
            <button
              onClick={() => setShowGbvModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700"
            >
              <Plus className="w-4 h-4" /> Screen Patient
            </button>
          </div>
          {gbvHistory.map((g: any) => (
            <div key={g.id} className={`border-2 rounded-lg p-3 text-sm ${g.screen_positive ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex justify-between">
                <span className="font-semibold">{formatDateToDDMMYYYY(g.screen_date)}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${g.screen_positive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  HITS {g.hits_total} — {g.screen_positive ? 'POSITIVE' : 'negative'}
                </span>
              </div>
              <div className="text-slate-600 mt-1">Danger: {g.danger_assessment?.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && !loading && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Counsellor Sessions</h3>
            <button
              onClick={() => setShowSessionModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> New Session
            </button>
          </div>
          {sessions.map((s: any) => (
            <div key={s.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">{formatDateToDDMMYYYY(s.session_date)}</span>
                <span className="text-slate-600 capitalize">{s.session_type?.replace(/_/g, ' ')}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Attendance: {s.attendance}</div>
            </div>
          ))}
        </div>
      )}

      {/* Disclosure Modal */}
      {showDisclosureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">Record Disclosure Assessment</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Disclosure Status</label>
                <select
                  value={disclosureForm.disclosureStatus}
                  onChange={(e) => setDisclosureForm(f => ({ ...f, disclosureStatus: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {DISCLOSURE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Readiness Score (0–10)</label>
                <input type="range" min={0} max={10} value={disclosureForm.readinessScore}
                  onChange={(e) => setDisclosureForm(f => ({ ...f, readinessScore: Number(e.target.value) }))}
                  className="w-full" />
                <div className="text-center text-sm font-semibold text-emerald-700">{disclosureForm.readinessScore}/10</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Barriers to Disclosure</label>
                <textarea
                  value={disclosureForm.barriers}
                  onChange={(e) => setDisclosureForm(f => ({ ...f, barriers: e.target.value }))}
                  rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="counsellingProvided" checked={disclosureForm.counsellingProvided}
                  onChange={(e) => setDisclosureForm(f => ({ ...f, counsellingProvided: e.target.checked }))} />
                <label htmlFor="counsellingProvided" className="text-sm text-slate-700">Counselling provided today</label>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowDisclosureModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    await ehrApi.createDisclosureRecord(patientId, {
                      ...disclosureForm, patientAge,
                    }, token, tenantSlug);
                    showSuccess('Saved', 'Disclosure record saved');
                    setShowDisclosureModal(false);
                    loadData();
                  } catch { showError('Error', 'Failed to save disclosure record'); }
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Transition Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg overflow-y-auto max-h-screen">
            <h3 className="text-lg font-bold mb-4">ALHIV Transition Readiness (TRAQ)</h3>
            <div className="space-y-3 text-sm">
              {Object.entries(traqScores).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}: {val}</label>
                  <input type="range" min={1} max={5} value={val}
                    onChange={(e) => setTraqScores(s => ({ ...s, [key]: Number(e.target.value) }))}
                    className="w-full" />
                </div>
              ))}
              <div className={`p-3 rounded-lg font-semibold text-sm ${
                traqLevel === 'high' ? 'bg-green-100 text-green-800' :
                traqLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                Total: {traqTotal}/30 — Readiness: {traqLevel}
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowTransitionModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    await ehrApi.createTransitionAssessment(patientId, {
                      patientAge, scores: traqScores,
                    }, token, tenantSlug);
                    showSuccess('Saved', 'Transition assessment saved');
                    setShowTransitionModal(false);
                    loadData();
                  } catch { showError('Error', 'Failed to save assessment'); }
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* GBV Modal */}
      {showGbvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg overflow-y-auto max-h-screen">
            <h3 className="text-lg font-bold mb-2">HITS GBV Screening</h3>
            <p className="text-xs text-slate-500 mb-4">Score 1 (Never) → 5 (Frequently)</p>
            <div className="space-y-3 text-sm">
              {[
                { key: 'hurt', label: 'Partner physically hurts you' },
                { key: 'insult', label: 'Partner insults or talks down to you' },
                { key: 'threaten', label: 'Partner threatens you with harm' },
                { key: 'scream', label: 'Partner screams or curses at you' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}: {(hitsScores as any)[key]}</label>
                  <input type="range" min={1} max={5} value={(hitsScores as any)[key]}
                    onChange={(e) => setHitsScores(s => ({ ...s, [key]: Number(e.target.value) }))}
                    className="w-full" />
                </div>
              ))}
              <div className={`p-3 rounded-lg font-semibold ${hitsPositive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                HITS Total: {hitsTotal} — {hitsPositive ? '⚠ SCREEN POSITIVE' : 'Negative'} | Danger: {dangerLevel.replace(/_/g, ' ')}
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={weaponInHome} onChange={(e) => setWeaponInHome(e.target.checked)} />
                  Weapon in home
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={escalatingViolence} onChange={(e) => setEscalatingViolence(e.target.checked)} />
                  Escalating violence
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Safety Plan Notes</label>
                <textarea rows={2} value={safetyPlan} onChange={(e) => setSafetyPlan(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowGbvModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    await ehrApi.createGbvAssessment(patientId, {
                      hits: hitsScores, dangerAssessment: dangerLevel,
                      safetyPlanCreated: safetyPlan.length > 0, safetyPlanNotes: safetyPlan,
                    }, token, tenantSlug);
                    showSuccess('Saved', 'GBV assessment recorded');
                    setShowGbvModal(false);
                    loadData();
                  } catch { showError('Error', 'Failed to save GBV assessment'); }
                }}
                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700"
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">Record Counsellor Session</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Session Type</label>
                <select value={sessionForm.sessionType}
                  onChange={(e) => setSessionForm(f => ({ ...f, sessionType: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm capitalize">
                  {SESSION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Attendance</label>
                <select value={sessionForm.attendance}
                  onChange={(e) => setSessionForm(f => ({ ...f, attendance: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="attended">Attended</option>
                  <option value="dna">Did not attend</option>
                  <option value="late_cancel">Late cancel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Presenting Issues</label>
                <textarea rows={2} value={sessionForm.presentingIssues}
                  onChange={(e) => setSessionForm(f => ({ ...f, presentingIssues: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Session Notes (confidential)</label>
                <textarea rows={3} value={sessionForm.sessionNotes}
                  onChange={(e) => setSessionForm(f => ({ ...f, sessionNotes: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowSessionModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    await ehrApi.createCounsellorSession(patientId, sessionForm, token, tenantSlug);
                    showSuccess('Saved', 'Session recorded');
                    setShowSessionModal(false);
                    loadData();
                  } catch { showError('Error', 'Failed to save session'); }
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
              >Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PsychosocialTab;
