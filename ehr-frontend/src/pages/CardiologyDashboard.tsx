import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  CreditCard,
  Filter,
  HeartPulse,
  LogOut,
  Microscope,
  Plus,
  RefreshCw,
  Shield,
  Stethoscope,
  TrendingUp,
  User,
  XCircle,
  Brain,
  BookOpen,
  ArrowRight,
  X,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import CardiologyEncounterModal from '../components/CardiologyEncounterModal';
import { SmartFormsFloatingButton } from '../components/WHOSmartForms';
import { GuidelineSearchPanel } from '../components/GuidelineSearchPanel';

interface CardiologyEncounter {
  id: string;
  patient_id: string;
  patient_name?: string;
  patient_number?: string;
  cardiologist_name?: string;
  encounter_date: string;
  encounter_type: string;
  visit_reason?: string | null;
  reason_snomed_code?: string | null;
  reason_snomed_term?: string | null;
  presenting_symptoms?: string | null;
  symptom_snomed_codes?: Array<{
    conceptId: string;
    term?: string;
    moduleId?: string;
    definitionStatus?: string;
  }> | null;
  risk_score?: string | null;
  care_status?: string;
  payment_status?: string;
  fee_amount?: number | null;
  finance_transaction_id?: string | null;
  diagnostic_snomed_codes?: Array<{
    conceptId: string;
    term?: string;
    moduleId?: string;
    definitionStatus?: string;
  }> | null;
}

interface CardiologyDashboardSummary {
  totals?: {
    totalEncounters: number;
    awaitingPayment: number;
    inProgress: number;
    completed: number;
  };
  financial?: {
    totalFees: number;
    outstandingFees: number;
  };
  riskMix?: Array<{ risk_score: string; count: number }>;
  upcomingFollowUps?: Array<{
    id: string;
    patient_id: string;
    patient_name?: string;
    patient_number?: string;
    encounter_date: string;
    follow_up_plan?: string;
  }>;
  recentEncounters?: Array<{
    id: string;
    encounter_date: string;
    care_status: string;
    payment_status: string;
    risk_score?: string;
    patient_name?: string;
    patient_number?: string;
  }>;
  chiefComplaintMix?: Array<{ term: string; concept_id?: string | null; count: number }>;
  symptomMix?: Array<{ term: string; concept_id?: string | null; count: number }>;
  diagnosticBacklog?: Array<{ term: string; concept_id?: string | null; count: number }>;
}

type FiltersState = {
  search: string;
  paymentStatus: 'all' | 'awaiting_payment' | 'payment_confirmed';
  riskScore: 'all' | 'low' | 'moderate' | 'high' | 'critical';
  careStatus: 'all' | 'awaiting_payment' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
};

const encounterTypeLabels: Record<string, string> = {
  clinic_visit: 'Clinic visit',
  diagnostic_test: 'Diagnostic workup',
  heart_failure_review: 'Heart failure review',
  telecardiology: 'Telecardiology',
  rehabilitation: 'Cardiac rehab',
  other: 'Other',
};

const riskColors: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  moderate: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
};

const careStatusColors: Record<string, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-700 border-amber-200',
  scheduled: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const paymentStatusColors: Record<string, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-700 border-amber-200',
  payment_confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

interface CardiologyDashboardProps {
  embedded?: boolean;
}

const CardiologyDashboard: React.FC<CardiologyDashboardProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<CardiologyDashboardSummary | null>(null);
  const [encounters, setEncounters] = useState<CardiologyEncounter[]>([]);
  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    paymentStatus: 'all',
    riskScore: 'all',
    careStatus: 'all',
  });
  const [showEncounterModal, setShowEncounterModal] = useState(false);

  // CDSS / Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);


  const token = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem('ehr_token');
  }, []);

  const ensureAuth = useCallback(() => {
    if (!tenantSlug || !token) {
      showError('Session expired', 'Please sign in again.');
      navigate(`/ehr/${tenantSlug ?? ''}`);
      return false;
    }
    return true;
  }, [navigate, showError, tenantSlug, token]);

  const loadSummary = useCallback(async () => {
    if (!ensureAuth()) return;
    try {
      const response = await ehrApi.getCardiologyDashboardSummary(tenantSlug!, token!);
      const data = response.data || {};
      const totals = data.totals || {};
      const financial = data.financial || {};
      const riskMix = Array.isArray(data.riskMix)
        ? data.riskMix.map((item: any) => ({
            risk_score: item?.risk_score ?? 'unknown',
            count: Number(item?.count ?? 0),
          }))
        : [];
      const normalizeConceptList = (array: any[]): Array<{ term: string; concept_id?: string | null; count: number }> =>
        Array.isArray(array)
          ? array
              .map((item: any) => ({
                term: item?.term ?? 'Unlabeled concept',
                concept_id: item?.concept_id ?? null,
                count: Number(item?.count ?? 0),
              }))
              .filter((item) => item.count > 0)
          : [];

      setSummary({
        totals: {
          totalEncounters: Number(totals.totalEncounters ?? 0),
          awaitingPayment: Number(totals.awaitingPayment ?? 0),
          inProgress: Number(totals.inProgress ?? 0),
          completed: Number(totals.completed ?? 0),
        },
        financial: {
          totalFees: Number(financial.totalFees ?? 0),
          outstandingFees: Number(financial.outstandingFees ?? 0),
        },
        riskMix,
        upcomingFollowUps: Array.isArray(data.upcomingFollowUps) ? data.upcomingFollowUps : [],
        recentEncounters: Array.isArray(data.recentEncounters) ? data.recentEncounters : [],
        chiefComplaintMix: normalizeConceptList(data.chiefComplaintMix),
        symptomMix: normalizeConceptList(data.symptomMix),
        diagnosticBacklog: normalizeConceptList(data.diagnosticBacklog),
      });
    } catch (error) {
      console.error('Failed to load cardiology summary', error);
      showError('Unable to load cardiology insights', 'Please retry shortly.');
    }
  }, [ensureAuth, showError, tenantSlug, token]);

  const loadEncounters = useCallback(async (overrides?: Partial<FiltersState>) => {
    if (!ensureAuth()) return;
    try {
      const effectiveFilters = { ...filters, ...(overrides || {}) };
      const params: Record<string, string> = {};
      if (effectiveFilters.search) params.search = effectiveFilters.search;
      if (effectiveFilters.paymentStatus !== 'all') params.payment_status = effectiveFilters.paymentStatus;
      if (effectiveFilters.riskScore !== 'all') params.risk_score = effectiveFilters.riskScore;
      if (effectiveFilters.careStatus !== 'all') params.care_status = effectiveFilters.careStatus;

      const response = await ehrApi.getCardiologyEncounters(tenantSlug!, token!, params);
      setEncounters(Array.isArray(response.data?.encounters) ? response.data.encounters : []);
    } catch (error) {
      console.error('Failed to load cardiology encounters', error);
      showError('Unable to load cardiology encounters', 'Please try again.');
    }
  }, [ensureAuth, filters, showError, tenantSlug, token]);

  useEffect(() => {
    const user = localStorage.getItem('ehr_user');
    if (user) {
      setCurrentUser(JSON.parse(user));
    } else {
      navigate(`/ehr/${tenantSlug ?? ''}`);
    }
  }, [navigate, tenantSlug]);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await Promise.all([loadSummary(), loadEncounters()]);
      setLoading(false);
    };
    initialize();
  }, [loadEncounters, loadSummary]);

  const handleRefresh = async () => {
    if (!ensureAuth()) return;
    setRefreshing(true);
    await Promise.all([loadSummary(), loadEncounters()]);
    setRefreshing(false);
  };

  const handleFilterChange = async (field: keyof FiltersState, value: string) => {
    const updatedFilters = { ...filters, [field]: value } as FiltersState;
    setFilters(updatedFilters);
    await loadEncounters({ [field]: value } as Partial<FiltersState>);
  };

  const handleSearchChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFilters((prev) => ({ ...prev, search: value }));
    await loadEncounters({ search: value });
  };

  const handleStatusChange = async (encounter: CardiologyEncounter, nextStatus: string) => {
    if (!ensureAuth()) return;
    if (encounter.payment_status === 'awaiting_payment' && nextStatus !== 'awaiting_payment' && nextStatus !== 'cancelled') {
      showError('Payment pending', 'Accounts must clear payment before updating the encounter status.');
      return;
    }

    try {
      await ehrApi.updateCardiologyEncounter(tenantSlug!, token!, encounter.id, {
        care_status: nextStatus,
      });
      showSuccess('Cardiology encounter updated', `Status changed to ${nextStatus.replace('_', ' ')}`);
      await loadSummary();
      await loadEncounters();
    } catch (error: any) {
      console.error('Failed to update cardiology encounter status', error);
      const message = error?.response?.data?.message || 'Unable to update encounter status';
      showError('Update failed', message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    showInfo('Signed out', 'See you soon.');
    navigate(`/ehr/${tenantSlug ?? ''}`);
  };

  const totalEncounters = summary?.totals?.totalEncounters ?? 0;
  const awaitingPayment = summary?.totals?.awaitingPayment ?? 0;
  const inProgress = summary?.totals?.inProgress ?? 0;
  const completed = summary?.totals?.completed ?? 0;
  const totalFees = summary?.financial?.totalFees ?? 0;
  const outstandingFees = summary?.financial?.outstandingFees ?? 0;

  if (!currentUser) return null;

  return (
    <div className={`${embedded ? '' : 'min-h-screen '}bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100`}>
      {!embedded && (
      <header className="sticky top-0 z-30 border-b border-slate-700/60 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 p-2 shadow-lg">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Cardiology Command Center</h1>
              <p className="text-xs text-slate-400">
                Finance-gated cardiac workflows, diagnostic oversight, and follow-up orchestration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw className={`mr-2 inline h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={() => setShowEncounterModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:from-red-600 hover:to-rose-700"
            >
              <Plus className="h-4 w-4" /> New Encounter
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Summary cards */}
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 shadow-lg border border-slate-700/60">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Total Encounters</h3>
              <HeartPulse className="h-5 w-5 text-rose-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-white">{totalEncounters}</p>
            <p className="text-xs text-slate-400">Across all cardiology pathways</p>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-amber-900/40 to-amber-800/40 p-5 shadow-lg border border-amber-500/40">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-200">Awaiting Payment</h3>
              <CreditCard className="h-5 w-5 text-amber-300" />
            </div>
            <p className="mt-4 text-3xl font-bold text-amber-100">{awaitingPayment}</p>
            <p className="text-xs text-amber-200/70">Encounters locked until Accounts clears payment</p>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 p-5 shadow-lg border border-indigo-500/40">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-indigo-200">In Progress</h3>
              <Activity className="h-5 w-5 text-indigo-300" />
            </div>
            <p className="mt-4 text-3xl font-bold text-indigo-100">{inProgress}</p>
            <p className="text-xs text-indigo-200/70">Active cardiac interventions underway</p>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-emerald-900/40 to-emerald-800/40 p-5 shadow-lg border border-emerald-500/40">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-200">Completed</h3>
              <CheckCircle className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-4 text-3xl font-bold text-emerald-100">{completed}</p>
            <p className="text-xs text-emerald-200/70">Care pathways wrapped with outcomes documented</p>
          </div>
        </section>

        {/* SNOMED-driven insights */}
        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-rose-300" />
                Top SNOMED complaints
              </h3>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(summary?.chiefComplaintMix ?? []).map((item, index) => (
                <div key={`${item.concept_id ?? item.term}-${index}`} className="flex items-center justify-between text-sm text-slate-200">
                  <div>
                    <p className="font-medium text-white">{item.term}</p>
                    <p className="text-xs text-slate-400">{item.concept_id ?? 'Uncoded'}</p>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 border border-rose-500/40">
                    {item.count}
                  </span>
                </div>
              ))}
              {!summary?.chiefComplaintMix?.length && (
                <p className="text-sm text-slate-400">SNOMED-coded chief complaints will appear here.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-sky-300" />
                Symptom clusters
              </h3>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(summary?.symptomMix ?? []).map((item, index) => (
                <div key={`${item.concept_id ?? item.term}-${index}`} className="flex items-center justify-between text-sm text-slate-200">
                  <div>
                    <p className="font-medium text-white">{item.term}</p>
                    <p className="text-xs text-slate-400">{item.concept_id ?? 'Uncoded'}</p>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 border border-sky-500/40">
                    {item.count}
                  </span>
                </div>
              ))}
              {!summary?.symptomMix?.length && <p className="text-sm text-slate-400">Capture SNOMED-coded symptoms to populate this view.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Microscope className="h-5 w-5 text-indigo-300" />
                Pending diagnostics
              </h3>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(summary?.diagnosticBacklog ?? []).map((item, index) => (
                <div key={`${item.concept_id ?? item.term}-${index}`} className="flex items-center justify-between text-sm text-slate-200">
                  <div>
                    <p className="font-medium text-white">{item.term}</p>
                    <p className="text-xs text-slate-400">{item.concept_id ?? 'Uncoded'}</p>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200 border border-indigo-500/40">
                    {item.count}
                  </span>
                </div>
              ))}
              {!summary?.diagnosticBacklog?.length && (
                <p className="text-sm text-slate-400">Outstanding SNOMED-coded diagnostics will surface here.</p>
              )}
            </div>
          </div>
        </section>

        {/* Finance snapshot */}
        <section className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Revenue captured</h3>
              <CreditCard className="h-5 w-5 text-rose-300" />
            </div>
            <p className="mt-4 text-3xl font-bold text-white">${totalFees.toFixed(2)}</p>
            <p className="text-xs text-slate-400">Total fees assessed for cardiology services</p>
          </div>
          <div className="rounded-3xl border border-amber-500/40 bg-amber-900/40 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-100">Outstanding</h3>
              <AlertTriangle className="h-5 w-5 text-amber-200" />
            </div>
            <p className="mt-4 text-3xl font-bold text-amber-50">${outstandingFees.toFixed(2)}</p>
            <p className="text-xs text-amber-100/70">Requires Accounts clearance before proceeding</p>
          </div>
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Risk mix</h3>
              <Shield className="h-5 w-5 text-sky-300" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {(summary?.riskMix ?? []).length === 0 && (
                <span className="rounded-lg bg-slate-800 px-3 py-1 text-slate-400">No risk data yet</span>
              )}
              {(summary?.riskMix ?? []).map((risk) => (
                <span key={risk.risk_score} className="rounded-lg bg-slate-800 px-3 py-1 text-slate-200">
                  {risk.risk_score === 'unknown' ? 'Unspecified' : risk.risk_score.replace('_', ' ')} · {risk.count}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mt-10 rounded-3xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-lg">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Filter className="h-5 w-5 text-rose-300" /> Encounter filters
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={handleSearchChange}
                placeholder="Search patients or finance reference"
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200/20"
              />
            </div>
            <select
              value={filters.paymentStatus}
              onChange={(event) => handleFilterChange('paymentStatus', event.target.value)}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200/20"
            >
              <option value="all">All payment states</option>
              <option value="awaiting_payment">Awaiting payment</option>
              <option value="payment_confirmed">Payment confirmed</option>
            </select>
            <select
              value={filters.careStatus}
              onChange={(event) => handleFilterChange('careStatus', event.target.value)}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200/20"
            >
              <option value="all">All care statuses</option>
              <option value="awaiting_payment">Awaiting payment</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filters.riskScore}
              onChange={(event) => handleFilterChange('riskScore', event.target.value)}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200/20"
            >
              <option value="all">All risk levels</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </section>

        {/* Encounter table */}
        <section className="mt-8 rounded-3xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Encounter queue</h2>
              <p className="text-xs text-slate-400">
                Finance gating locks any encounter with outstanding payments. Use the actions to progress once cleared.
              </p>
            </div>
            <button
              onClick={() => setShowEncounterModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:from-red-600 hover:to-rose-700"
            >
              <Plus className="h-4 w-4" /> Add encounter
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700/60 text-sm">
              <thead className="bg-slate-900/60 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold">Encounter</th>
                  <th className="px-4 py-3 text-left font-semibold">Risk</th>
                  <th className="px-4 py-3 text-left font-semibold">Care status</th>
                  <th className="px-4 py-3 text-left font-semibold">Payment</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {encounters.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No cardiology encounters match the current filters.
                    </td>
                  </tr>
                )}
                {encounters.map((encounter) => {
                  const encounterDate = format(new Date(encounter.encounter_date), 'dd MMM yyyy • HH:mm');
                  const paymentBadge = encounter.payment_status ?? 'payment_confirmed';
                  const careBadge = encounter.care_status ?? 'scheduled';
                  const riskBadge = encounter.risk_score ?? 'moderate';

                  return (
                    <tr key={encounter.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{encounter.patient_name || 'Unknown patient'}</div>
                        <div className="text-xs text-slate-400">{encounter.patient_number || '—'}</div>
                        {encounter.visit_reason && (
                          <div className="mt-1 text-xs text-slate-400">Reason: {encounter.visit_reason}</div>
                        )}
                        {encounter.reason_snomed_term && (
                          <div className="mt-1 text-xs text-rose-600">
                            SNOMED: {encounter.reason_snomed_term}
                            {encounter.reason_snomed_code ? ` (${encounter.reason_snomed_code})` : ''}
                          </div>
                        )}
                        {Array.isArray(encounter.symptom_snomed_codes) &&
                          encounter.symptom_snomed_codes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {encounter.symptom_snomed_codes.map((concept) => (
                                <span
                                  key={concept.conceptId}
                                  className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700"
                                >
                                  {concept.term || concept.conceptId}
                                </span>
                              ))}
                            </div>
                          )}
                        {Array.isArray(encounter.diagnostic_snomed_codes) &&
                          encounter.diagnostic_snomed_codes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {encounter.diagnostic_snomed_codes.map((concept) => (
                                <span
                                  key={`diag-${concept.conceptId}`}
                                  className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700"
                                >
                                  {concept.term || concept.conceptId}
                                </span>
                              ))}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-200">{encounterTypeLabels[encounter.encounter_type] || encounter.encounter_type}</div>
                        <div className="text-xs text-slate-400">{encounterDate}</div>
                        {encounter.cardiologist_name && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                            <Stethoscope className="h-3 w-3" /> {encounter.cardiologist_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                            riskColors[riskBadge] || 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          <Shield className="h-3 w-3" />
                          {riskBadge.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                            careStatusColors[careBadge] || 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          {careBadge.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                              paymentStatusColors[paymentBadge] || 'bg-slate-800 text-slate-200 border-slate-600'
                            }`}
                          >
                            <CreditCard className="h-3 w-3" />
                            {paymentBadge.replace('_', ' ')}
                          </span>
                          {encounter.fee_amount && (
                            <span className="text-xs text-slate-400">Fee: ${Number(encounter.fee_amount).toFixed(2)}</span>
                          )}
                          {encounter.finance_transaction_id && (
                            <span className="text-[10px] text-slate-500">Txn: {encounter.finance_transaction_id.slice(0, 8)}…</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleStatusChange(encounter, 'in_progress')}
                            disabled={encounter.care_status === 'in_progress' || encounter.care_status === 'completed'}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Activity className="h-3 w-3" /> Begin
                          </button>
                          <button
                            onClick={() => handleStatusChange(encounter, 'completed')}
                            disabled={encounter.care_status === 'completed'}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-800/40 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3 w-3" /> Complete
                          </button>
                          <button
                            onClick={() => handleStatusChange(encounter, 'cancelled')}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-800/40"
                          >
                            <XCircle className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Upcoming follow-ups */}
        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <TrendingUp className="h-4 w-4 text-rose-300" /> Upcoming follow-ups
            </h3>
            <div className="mt-4 space-y-3">
              {(summary?.upcomingFollowUps ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No follow-up plans documented yet.</p>
              )}
              {(summary?.upcomingFollowUps ?? []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <span>{item.patient_name || 'Patient'}</span>
                    <span className="text-xs text-slate-400">{format(new Date(item.encounter_date), 'dd MMM yyyy')}</span>
                  </div>
                  {item.follow_up_plan && (
                    <p className="mt-2 text-xs text-slate-400">{item.follow_up_plan}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <User className="h-4 w-4 text-slate-300" /> Recent encounters
            </h3>
            <div className="mt-4 space-y-3">
              {(summary?.recentEncounters ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No recent encounters logged.</p>
              )}
              {(summary?.recentEncounters ?? []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>{item.patient_name || 'Patient'}</span>
                    <span className="text-xs text-slate-400">{format(new Date(item.encounter_date), 'dd MMM yyyy HH:mm')}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{item.care_status.replace('_', ' ')}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{item.payment_status.replace('_', ' ')}</span>
                    {item.risk_score && (
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">Risk: {item.risk_score}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <CardiologyEncounterModal
        isOpen={showEncounterModal}
        onClose={() => setShowEncounterModal(false)}
        onSuccess={async () => {
          await loadSummary();
          await loadEncounters();
        }}
        tenantSlug={tenantSlug!}
        currentUserId={currentUser?.id}
      />

      {/* WHO Smart Forms Floating Button */}
      <SmartFormsFloatingButton
        token={token || ''}
        tenantSlug={tenantSlug!}
        moduleFilter="clinical"
        position="bottom-right"
      />

      {/* AI Guideline Search Modal */}
      {showGuidelineSearch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100001] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 text-slate-900">
            <div className="p-4 border-b border-rose-100 flex items-center justify-between bg-rose-50">
              <div className="flex items-center space-x-2 text-rose-700">
                <BookOpen className="w-5 h-5" />
                <h3 className="font-bold">Cardiology Clinical Guidelines (AI-Powered)</h3>
              </div>
              <button
                onClick={() => setShowGuidelineSearch(false)}
                className="p-1 hover:bg-rose-100 rounded-full text-rose-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              <GuidelineSearchPanel
                searchFn={(q) => cdssApi.searchGuidelines(q, token!, tenantSlug!)}
                contextLabel="Cardiology"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardiologyDashboard;
