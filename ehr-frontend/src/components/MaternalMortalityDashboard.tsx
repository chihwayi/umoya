import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Plus, RefreshCw, ShieldAlert, Stethoscope } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { maternalMortalityApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DashboardTab = 'audit' | 'emonc' | 'summary';

type RecommendationRow = {
  action: string;
  responsible: string;
  dueDate: string;
};

type DeathFormState = {
  patientId: string;
  deathDate: string;
  ageAtDeath: string;
  gestationalAgeWeeks: string;
  deathCategory: string;
  primaryCause: string;
  icd10Primary: string;
  modeOfAdmission: string;
  delay1Recognition: boolean;
  delay2Reaching: boolean;
  delay3Care: boolean;
  delayNotes: string;
  avoidable: string;
  isNearMiss: boolean;
  notes: string;
};

type EmoncFormState = {
  assessmentDate: string;
  assessmentPeriodMonths: string;
  sf1ParenteralAntibiotics: string;
  sf2ParenteralOxytocics: string;
  sf3ParenteralAnticonvulsants: string;
  sf4ManualRemovalPlacenta: string;
  sf5RemovalRetainedProducts: string;
  sf6NeonatalResuscitation: string;
  sf7AssistedVaginalDelivery: string;
  sf8CaesareanSection: string;
  sf9BloodTransfusion: string;
  notes: string;
  barriers: Record<string, string>;
};

type ReviewFormState = {
  timelineSummary: string;
  standardOfCare: string;
  reviewComplete: boolean;
  actionPlanAgreed: boolean;
  recommendations: RecommendationRow[];
};

const signalOptions = [
  { value: 'performed', label: 'Performed' },
  { value: 'not_performed', label: 'Not performed' },
  { value: 'not_available', label: 'Not available' },
  { value: 'unknown', label: 'Unknown' },
];

const signalLabels = [
  ['sf1ParenteralAntibiotics', 'Parenteral antibiotics (sepsis)'],
  ['sf2ParenteralOxytocics', 'Parenteral uterotonics (PPH)'],
  ['sf3ParenteralAnticonvulsants', 'Parenteral anticonvulsants (MgSO4)'],
  ['sf4ManualRemovalPlacenta', 'Manual removal of retained placenta'],
  ['sf5RemovalRetainedProducts', 'Removal of retained products (MVA/D&C)'],
  ['sf6NeonatalResuscitation', 'Neonatal resuscitation'],
  ['sf7AssistedVaginalDelivery', 'Assisted vaginal delivery'],
  ['sf8CaesareanSection', 'Caesarean section'],
  ['sf9BloodTransfusion', 'Blood transfusion'],
] as const;

const defaultDeathForm = (): DeathFormState => ({
  patientId: '',
  deathDate: new Date().toISOString().slice(0, 10),
  ageAtDeath: '',
  gestationalAgeWeeks: '',
  deathCategory: 'undetermined',
  primaryCause: '',
  icd10Primary: '',
  modeOfAdmission: 'referred',
  delay1Recognition: false,
  delay2Reaching: false,
  delay3Care: false,
  delayNotes: '',
  avoidable: 'unknown',
  isNearMiss: false,
  notes: '',
});

const defaultEmoncForm = (): EmoncFormState => ({
  assessmentDate: new Date().toISOString().slice(0, 10),
  assessmentPeriodMonths: '3',
  sf1ParenteralAntibiotics: 'unknown',
  sf2ParenteralOxytocics: 'unknown',
  sf3ParenteralAnticonvulsants: 'unknown',
  sf4ManualRemovalPlacenta: 'unknown',
  sf5RemovalRetainedProducts: 'unknown',
  sf6NeonatalResuscitation: 'unknown',
  sf7AssistedVaginalDelivery: 'unknown',
  sf8CaesareanSection: 'unknown',
  sf9BloodTransfusion: 'unknown',
  notes: '',
  barriers: {},
});

const defaultReviewForm = (): ReviewFormState => ({
  timelineSummary: '',
  standardOfCare: 'substandard',
  reviewComplete: false,
  actionPlanAgreed: false,
  recommendations: [{ action: '', responsible: '', dueDate: '' }],
});

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-2xl border border-white/40 bg-gradient-to-br ${tone} p-4 text-white shadow-sm`}>
      <p className="text-xs uppercase tracking-[0.18em] text-white/75">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function ReviewStatusBadge({ value }: { value: string }) {
  const tones: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    under_review: 'bg-sky-100 text-sky-700',
    completed: 'bg-emerald-100 text-emerald-700',
    submitted_to_district: 'bg-violet-100 text-violet-700',
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[value] || 'bg-slate-100 text-slate-700'}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export default function MaternalMortalityDashboard({
  tenantSlug,
  token,
}: {
  tenantSlug: string;
  token: string;
}) {
  const { showError, showSuccess } = useNotification();
  const [activeTab, setActiveTab] = useState<DashboardTab>('audit');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [deaths, setDeaths] = useState<any[]>([]);
  const [emoncHistory, setEmoncHistory] = useState<any[]>([]);
  const [latestEmonc, setLatestEmonc] = useState<any | null>(null);
  const [deathForm, setDeathForm] = useState<DeathFormState>(defaultDeathForm);
  const [emoncForm, setEmoncForm] = useState<EmoncFormState>(defaultEmoncForm);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(defaultReviewForm);
  const [auditGuidance, setAuditGuidance] = useState<any>(null);
  const [classificationResult, setClassificationResult] = useState<any>(null);
  const [showDeathForm, setShowDeathForm] = useState(false);
  const [showEmoncForm, setShowEmoncForm] = useState(false);
  const [selectedDeathId, setSelectedDeathId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [liveBirths, setLiveBirths] = useState<string>('');

  const loadDashboard = useCallback(
    async (selectedYear: number, reviewStatus?: string) => {
      try {
        setLoading(true);
        const [deathRows, latestEmoncRes, emoncHistoryRes, summaryRes] = await Promise.all([
          maternalMortalityApi.listDeaths(
            { reviewStatus: reviewStatus && reviewStatus !== 'all' ? reviewStatus : undefined },
            token,
            tenantSlug,
          ),
          maternalMortalityApi.getLatestEmonc(undefined, token, tenantSlug),
          maternalMortalityApi.getEmoncHistory(undefined, token, tenantSlug),
          maternalMortalityApi.getSummary(selectedYear, token, tenantSlug),
        ]);

        setDeaths(Array.isArray(deathRows) ? deathRows : []);
        setLatestEmonc(latestEmoncRes || null);
        setEmoncHistory(Array.isArray(emoncHistoryRes) ? emoncHistoryRes : []);
        setSummary(summaryRes || null);
      } catch (error) {
        console.error('Failed to load maternal mortality dashboard', error);
        showError('Unable to load maternal mortality dashboard', 'Please retry.');
      } finally {
        setLoading(false);
      }
    },
    [showError, tenantSlug, token],
  );

  useEffect(() => {
    void loadDashboard(year, filterStatus);
  }, [filterStatus, loadDashboard, year]);

  const reviewCompletionRate = useMemo(() => {
    const total = summary?.reviewCompletion?.total ?? 0;
    const completed = summary?.reviewCompletion?.completed ?? 0;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [summary]);

  const calculatedMmr = useMemo(() => {
    const births = Number(liveBirths);
    if (!births || births <= 0 || !summary?.totalDeaths) {
      return null;
    }
    return Math.round((summary.totalDeaths / births) * 100000);
  }, [liveBirths, summary?.totalDeaths]);

  const categoryChartData = useMemo(
    () =>
      Object.entries(summary?.byCategory || {}).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value,
      })),
    [summary?.byCategory],
  );

  const delayChartData = useMemo(
    () => [
      { name: 'Delay 1', value: summary?.byDelay?.delay1 ?? 0 },
      { name: 'Delay 2', value: summary?.byDelay?.delay2 ?? 0 },
      { name: 'Delay 3', value: summary?.byDelay?.delay3 ?? 0 },
    ],
    [summary?.byDelay],
  );

  const classificationTone = (value: string | undefined) => {
    switch (value) {
      case 'CEmONC':
        return 'bg-emerald-100 text-emerald-700';
      case 'BEmONC':
        return 'bg-teal-100 text-teal-700';
      case 'partial_BEmONC':
        return 'bg-amber-100 text-amber-700';
      case 'not_EmONC':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const submitDeath = async () => {
    try {
      const response = await maternalMortalityApi.reportDeath(
        {
          patientId: deathForm.patientId.trim(),
          deathDate: deathForm.deathDate,
          ageAtDeath: deathForm.ageAtDeath ? Number(deathForm.ageAtDeath) : null,
          gestationalAgeWeeks: deathForm.gestationalAgeWeeks ? Number(deathForm.gestationalAgeWeeks) : null,
          deathCategory: deathForm.deathCategory,
          primaryCause: deathForm.primaryCause || null,
          icd10Primary: deathForm.icd10Primary || null,
          modeOfAdmission: deathForm.modeOfAdmission || null,
          delay1Recognition: deathForm.delay1Recognition,
          delay2Reaching: deathForm.delay2Reaching,
          delay3Care: deathForm.delay3Care,
          delayNotes: deathForm.delayNotes || null,
          avoidable: deathForm.avoidable === 'unknown' ? null : deathForm.avoidable === 'yes',
          isNearMiss: deathForm.isNearMiss,
          notes: deathForm.notes || null,
        },
        token,
        tenantSlug,
      );

      setAuditGuidance(response?.auditGuidance || null);
      setDeathForm(defaultDeathForm());
      setShowDeathForm(false);
      showSuccess('Maternal event recorded', 'Death or near-miss record saved with audit guidance.');
      await loadDashboard(year, filterStatus);
    } catch (error) {
      console.error('Failed to report maternal death', error);
      showError('Unable to record maternal event', 'Please review the form and retry.');
    }
  };

  const submitReview = async () => {
    if (!selectedDeathId) {
      return;
    }

    try {
      await maternalMortalityApi.createReview(
        selectedDeathId,
        {
          timelineSummary: reviewForm.timelineSummary || null,
          standardOfCare: reviewForm.standardOfCare,
          reviewComplete: reviewForm.reviewComplete,
          actionPlanAgreed: reviewForm.actionPlanAgreed,
          recommendations: reviewForm.recommendations.filter((row) => row.action.trim().length > 0),
        },
        token,
        tenantSlug,
      );

      setSelectedDeathId(null);
      setReviewForm(defaultReviewForm());
      showSuccess('Review saved', 'Case review recorded successfully.');
      await loadDashboard(year, filterStatus);
    } catch (error) {
      console.error('Failed to save maternal death review', error);
      showError('Unable to save review', 'Please retry.');
    }
  };

  const submitEmonc = async () => {
    try {
      const response = await maternalMortalityApi.recordEmoncAssessment(
        {
          assessmentDate: emoncForm.assessmentDate,
          assessmentPeriodMonths: Number(emoncForm.assessmentPeriodMonths),
          notes: emoncForm.notes || null,
          barriers: Object.fromEntries(
            Object.entries(emoncForm.barriers).filter(([, value]) => value.trim().length > 0),
          ),
          sf1ParenteralAntibiotics: emoncForm.sf1ParenteralAntibiotics,
          sf2ParenteralOxytocics: emoncForm.sf2ParenteralOxytocics,
          sf3ParenteralAnticonvulsants: emoncForm.sf3ParenteralAnticonvulsants,
          sf4ManualRemovalPlacenta: emoncForm.sf4ManualRemovalPlacenta,
          sf5RemovalRetainedProducts: emoncForm.sf5RemovalRetainedProducts,
          sf6NeonatalResuscitation: emoncForm.sf6NeonatalResuscitation,
          sf7AssistedVaginalDelivery: emoncForm.sf7AssistedVaginalDelivery,
          sf8CaesareanSection: emoncForm.sf8CaesareanSection,
          sf9BloodTransfusion: emoncForm.sf9BloodTransfusion,
        },
        token,
        tenantSlug,
      );

      setClassificationResult(response?.classification || null);
      setEmoncForm(defaultEmoncForm());
      setShowEmoncForm(false);
      showSuccess('EmONC assessment recorded', 'Facility classification updated.');
      await loadDashboard(year, filterStatus);
    } catch (error) {
      console.error('Failed to record EmONC assessment', error);
      showError('Unable to record EmONC assessment', 'Please retry.');
    }
  };

  return (
    <div className="space-y-6 rounded-[28px] border border-rose-100 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">Sprint 147</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Maternal Mortality Audit & EmONC</h2>
          <p className="mt-1 text-sm text-slate-500">
            MDSR workflows, near-miss reviews, and facility EmONC signal tracking.
          </p>
        </div>
        <button
          onClick={() => void loadDashboard(year, filterStatus)}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total deaths" value={summary?.totalDeaths ?? 0} tone="from-rose-600 to-red-600" />
        <StatCard label="Near misses" value={summary?.nearMisses ?? 0} tone="from-fuchsia-600 to-pink-600" />
        <StatCard label="Reviews complete" value={`${reviewCompletionRate}%`} tone="from-sky-600 to-cyan-600" />
        <StatCard label="Latest EmONC" value={latestEmonc?.emoncClassification || 'Unknown'} tone="from-violet-600 to-indigo-600" />
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
        {[
          { id: 'audit', label: 'Maternal Death Audit', icon: ClipboardList },
          { id: 'emonc', label: 'EmONC Assessment', icon: Stethoscope },
          { id: 'summary', label: 'Annual Summary', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                selected ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'audit' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'under_review', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                    filterStatus === status ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDeathForm((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <Plus className="h-4 w-4" />
              Report New Maternal Event
            </button>
          </div>

          {showDeathForm && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Maternal Death / Near-Miss Notification</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Patient ID" value={deathForm.patientId} onChange={(e) => setDeathForm((prev) => ({ ...prev, patientId: e.target.value }))} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={deathForm.deathDate} onChange={(e) => setDeathForm((prev) => ({ ...prev, deathDate: e.target.value }))} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Age at death" value={deathForm.ageAtDeath} onChange={(e) => setDeathForm((prev) => ({ ...prev, ageAtDeath: e.target.value }))} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Gestational age weeks" value={deathForm.gestationalAgeWeeks} onChange={(e) => setDeathForm((prev) => ({ ...prev, gestationalAgeWeeks: e.target.value }))} />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={deathForm.deathCategory} onChange={(e) => setDeathForm((prev) => ({ ...prev, deathCategory: e.target.value }))}>
                  <option value="direct_obstetric">Direct obstetric</option>
                  <option value="indirect_obstetric">Indirect obstetric</option>
                  <option value="coincidental">Coincidental</option>
                  <option value="undetermined">Undetermined</option>
                </select>
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={deathForm.modeOfAdmission} onChange={(e) => setDeathForm((prev) => ({ ...prev, modeOfAdmission: e.target.value }))}>
                  <option value="referred">Referred</option>
                  <option value="self_referred">Self referred</option>
                  <option value="brought_in_dead">Brought in dead</option>
                </select>
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Primary cause" value={deathForm.primaryCause} onChange={(e) => setDeathForm((prev) => ({ ...prev, primaryCause: e.target.value }))} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="ICD-10 code" value={deathForm.icd10Primary} onChange={(e) => setDeathForm((prev) => ({ ...prev, icd10Primary: e.target.value }))} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={deathForm.delay1Recognition} onChange={(e) => setDeathForm((prev) => ({ ...prev, delay1Recognition: e.target.checked }))} />
                  Delay 1: recognition / decision
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={deathForm.delay2Reaching} onChange={(e) => setDeathForm((prev) => ({ ...prev, delay2Reaching: e.target.checked }))} />
                  Delay 2: reaching facility
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={deathForm.delay3Care} onChange={(e) => setDeathForm((prev) => ({ ...prev, delay3Care: e.target.checked }))} />
                  Delay 3: care at facility
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={deathForm.avoidable} onChange={(e) => setDeathForm((prev) => ({ ...prev, avoidable: e.target.value }))}>
                  <option value="unknown">Avoidability unknown</option>
                  <option value="yes">Avoidable</option>
                  <option value="no">Not avoidable</option>
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={deathForm.isNearMiss} onChange={(e) => setDeathForm((prev) => ({ ...prev, isNearMiss: e.target.checked }))} />
                  Record as near miss
                </label>
              </div>

              <textarea className="mt-4 min-h-[88px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="Delay notes / case notes" value={deathForm.delayNotes} onChange={(e) => setDeathForm((prev) => ({ ...prev, delayNotes: e.target.value }))} />
              <textarea className="mt-3 min-h-[88px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="Additional notes" value={deathForm.notes} onChange={(e) => setDeathForm((prev) => ({ ...prev, notes: e.target.value }))} />

              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => void submitDeath()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                  Save maternal event
                </button>
                <button onClick={() => { setShowDeathForm(false); setDeathForm(defaultDeathForm()); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {auditGuidance && (
            <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/80 p-5">
              <div className="flex items-center gap-2 text-fuchsia-700">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-lg font-semibold">CDSS Audit Guidance</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{auditGuidance?.icd_mm_guidance || 'Guidance returned for this case.'}</p>
              {(auditGuidance?.avoidability_flags || []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(auditGuidance.avoidability_flags || []).map((flag: string, index: number) => (
                    <div key={`${flag}-${index}`} className="rounded-xl border border-white/70 bg-white px-3 py-2 text-sm text-slate-700">
                      {flag}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {deaths.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No maternal death or near-miss records in this view yet.
              </div>
            ) : (
              deaths.map((death) => (
                <div key={death.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{death.primaryCause || 'Cause pending documentation'}</p>
                        <ReviewStatusBadge value={death.reviewStatus || 'pending'} />
                        {death.isNearMiss && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Near miss
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Patient {death.patientId} • {death.deathDate} • {String(death.deathCategory || 'undetermined').replace(/_/g, ' ')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {death.delay1Recognition && <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">Delay 1</span>}
                        {death.delay2Reaching && <span className="rounded-full bg-orange-100 px-2 py-1 font-semibold text-orange-700">Delay 2</span>}
                        {death.delay3Care && <span className="rounded-full bg-rose-100 px-2 py-1 font-semibold text-rose-700">Delay 3</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedDeathId(death.id);
                          setReviewForm(defaultReviewForm());
                        }}
                        className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        Start Review
                      </button>
                      {death.reviewStatus !== 'completed' && (
                        <button
                          onClick={async () => {
                            try {
                              await maternalMortalityApi.updateReviewStatus(death.id, 'completed', token, tenantSlug);
                              showSuccess('Review status updated', 'Marked as completed.');
                              await loadDashboard(year, filterStatus);
                            } catch (error) {
                              showError('Unable to update review status', 'Please retry.');
                            }
                          }}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedDeathId && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Maternal Death Review</h3>
              <textarea className="mt-4 min-h-[110px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="Timeline summary" value={reviewForm.timelineSummary} onChange={(e) => setReviewForm((prev) => ({ ...prev, timelineSummary: e.target.value }))} />
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={reviewForm.standardOfCare} onChange={(e) => setReviewForm((prev) => ({ ...prev, standardOfCare: e.target.value }))}>
                  <option value="substandard">Substandard care</option>
                  <option value="standard_met">Standard met</option>
                  <option value="unavoidable">Unavoidable</option>
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={reviewForm.actionPlanAgreed} onChange={(e) => setReviewForm((prev) => ({ ...prev, actionPlanAgreed: e.target.checked }))} />
                  Action plan agreed
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={reviewForm.reviewComplete} onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewComplete: e.target.checked }))} />
                  Review complete
                </label>
              </div>

              <div className="mt-4 space-y-3">
                {reviewForm.recommendations.map((row, index) => (
                  <div key={`review-row-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Action" value={row.action} onChange={(e) => setReviewForm((prev) => ({ ...prev, recommendations: prev.recommendations.map((item, itemIndex) => (itemIndex === index ? { ...item, action: e.target.value } : item)) }))} />
                    <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Responsible party" value={row.responsible} onChange={(e) => setReviewForm((prev) => ({ ...prev, recommendations: prev.recommendations.map((item, itemIndex) => (itemIndex === index ? { ...item, responsible: e.target.value } : item)) }))} />
                    <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={row.dueDate} onChange={(e) => setReviewForm((prev) => ({ ...prev, recommendations: prev.recommendations.map((item, itemIndex) => (itemIndex === index ? { ...item, dueDate: e.target.value } : item)) }))} />
                  </div>
                ))}
                <button onClick={() => setReviewForm((prev) => ({ ...prev, recommendations: [...prev.recommendations, { action: '', responsible: '', dueDate: '' }] }))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Plus className="h-4 w-4" />
                  Add recommendation
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => void submitReview()} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                  Save review
                </button>
                <button onClick={() => { setSelectedDeathId(null); setReviewForm(defaultReviewForm()); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'emonc' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              onClick={() => setShowEmoncForm((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Record Assessment
            </button>
          </div>

          {showEmoncForm && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
              <h3 className="text-lg font-semibold text-slate-900">EmONC Signal Function Assessment</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={emoncForm.assessmentDate} onChange={(e) => setEmoncForm((prev) => ({ ...prev, assessmentDate: e.target.value }))} />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={emoncForm.assessmentPeriodMonths} onChange={(e) => setEmoncForm((prev) => ({ ...prev, assessmentPeriodMonths: e.target.value }))}>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                {signalLabels.map(([field, label], index) => (
                  <div key={field} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_1fr_1.2fr] md:items-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">SF{index + 1}</p>
                        <p className="text-xs text-slate-500">{label}</p>
                      </div>
                      <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={(emoncForm as any)[field]} onChange={(e) => setEmoncForm((prev) => ({ ...prev, [field]: e.target.value }))}>
                        {signalOptions.map((option) => (
                          <option key={`${field}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {(emoncForm as any)[field] === 'not_available' ? (
                        <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Barrier / capability gap" value={emoncForm.barriers[field] || ''} onChange={(e) => setEmoncForm((prev) => ({ ...prev, barriers: { ...prev.barriers, [field]: e.target.value } }))} />
                      ) : (
                        <div className="text-xs text-slate-400">No barrier note required</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <textarea className="mt-4 min-h-[88px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="Assessment notes" value={emoncForm.notes} onChange={(e) => setEmoncForm((prev) => ({ ...prev, notes: e.target.value }))} />

              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => void submitEmonc()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
                  Save assessment
                </button>
                <button onClick={() => { setShowEmoncForm(false); setEmoncForm(defaultEmoncForm()); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(classificationResult || latestEmonc) && (
            <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">Current Classification</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${classificationTone((classificationResult || latestEmonc)?.classification || latestEmonc?.emoncClassification)}`}>
                      {(classificationResult || latestEmonc)?.classification || latestEmonc?.emoncClassification || 'Unknown'}
                    </span>
                    <p className="text-sm text-slate-500">{(classificationResult || latestEmonc)?.message || 'Latest facility capability snapshot'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Basic</p>
                    <p className="text-xl font-bold text-slate-900">{(classificationResult || latestEmonc)?.basic_performed ?? '-'} / 7</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Comprehensive</p>
                    <p className="text-xl font-bold text-slate-900">{(classificationResult || latestEmonc)?.comprehensive_performed ?? '-'} / 2</p>
                  </div>
                </div>
              </div>

              {((classificationResult || latestEmonc)?.gaps || []).length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {((classificationResult || latestEmonc)?.gaps || []).map((gap: any) => (
                    <div key={`${gap.signal_function}-${gap.label}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                      <p className="text-sm font-semibold text-amber-800">{gap.label}</p>
                      <p className="mt-1 text-xs text-amber-700">Status: {gap.status}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {emoncHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No EmONC assessments recorded yet.
              </div>
            ) : (
              emoncHistory.map((record) => (
                <div key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{record.assessmentDate}</p>
                      <p className="text-xs text-slate-500">Assessment period: {record.assessmentPeriodMonths} months</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${classificationTone(record.emoncClassification)}`}>
                      {record.emoncClassification || 'Unknown'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-600">Year</label>
              <input type="number" className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-600">Live births</label>
              <input type="number" className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm" value={liveBirths} onChange={(e) => setLiveBirths(e.target.value)} placeholder="Enter denominator" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-sm font-semibold uppercase tracking-wide">Deaths By Category</h3>
              </div>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#e11d48" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-sm font-semibold uppercase tracking-wide">Three Delays</h3>
              </div>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={delayChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Maternal Mortality Ratio</p>
                <p className="mt-1 text-sm text-emerald-700">
                  {calculatedMmr == null ? 'Enter live births for this period to compute MMR per 100,000 live births.' : `${calculatedMmr} maternal deaths per 100,000 live births.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
