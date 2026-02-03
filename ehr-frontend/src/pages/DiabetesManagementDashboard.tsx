import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  HeartPulse,
  Activity,
  Droplets,
  AlertTriangle,
  Syringe,
  TrendingUp,
  LineChart,
  CalendarDays,
  LogOut,
  Stethoscope,
  Loader2,
  Users,
  Brain,
  BookOpen,
  Search,
} from 'lucide-react';
import { diabetesApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { SmartFormsFloatingButton } from '../components/WHOSmartForms';
import { GuidelineResult } from '../types/guidelines';

const formatDate = (value?: string | Date | null, includeTime = false) => {
  if (!value) return '—';
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  } catch {
    return value?.toString() ?? '—';
  }
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  subtitle?: string;
  accent: string;
}> = ({ title, value, icon: Icon, subtitle, accent }) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
    <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
    <div className="relative flex items-center gap-4 p-4">
      <div className="p-3 rounded-2xl bg-black/10 text-white">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">{title}</p>
        <p className="text-2xl font-semibold text-white">{value}</p>
        {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const Chip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
    <span className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</span>
    <span className="mt-1 text-slate-900 font-semibold">{value}</span>
  </div>
);

const RegistryCard: React.FC<{ registry: any; active: boolean; onSelect: () => void }> = ({
  registry,
  active,
  onSelect,
}) => (
  <button
    onClick={onSelect}
    className={`w-full text-left rounded-2xl border px-4 py-4 transition ${
      active
        ? 'border-indigo-500 bg-indigo-50/70 shadow-lg shadow-indigo-100'
        : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'
    }`}
  >
    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Patient</p>
    <p className="text-lg font-semibold text-slate-900 mt-1">{registry.patient_name ?? 'Unknown'}</p>
    <p className="text-sm text-slate-500 mt-1 capitalize">{registry.diabetes_type?.replace('_', ' ')}</p>
    <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1">
        <Droplets className="w-3 h-3" />
        {registry.status?.replace('_', ' ') ?? 'active'}
      </span>
      <span className="inline-flex items-center gap-1">
        <CalendarDays className="w-3 h-3" />
        {formatDate(registry.diagnosis_date)}
      </span>
    </div>
  </button>
);

const DiabetesManagementDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showInfo } = useNotification();

  const [currentUser, setCurrentUser] = React.useState<any | null>(null);
  const [summary, setSummary] = React.useState<any | null>(null);
  const [registries, setRegistries] = React.useState<any[]>([]);
  const [selectedRegistry, setSelectedRegistry] = React.useState<any | null>(null);
  const [careBundles, setCareBundles] = React.useState<any[]>([]);
  const [glucoseHistory, setGlucoseHistory] = React.useState<any[]>([]);
  const [cgmSummaries, setCgmSummaries] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // AI/RAG State
  const [showGuidelineSearch, setShowGuidelineSearch] = React.useState(false);
  const [guidelineQuery, setGuidelineQuery] = React.useState('');
  const [loadingGuidelines, setLoadingGuidelines] = React.useState(false);
  const [guidelineResults, setGuidelineResults] = React.useState<GuidelineResult[]>([]);

  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  React.useEffect(() => {
    const stored = localStorage.getItem('ehr_user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!tenantSlug || !token) {
      return;
    }
    const initialize = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchSummary(), fetchRegistries()]);
      } finally {
        setLoading(false);
      }
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, token]);

  const fetchSummary = async () => {
    if (!tenantSlug || !token) return;
    try {
      const response = await diabetesApi.getDashboardSummary(token, tenantSlug);
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load diabetes summary', error);
      showError('Unable to load diabetes insights', 'Please try again later.');
    }
  };

  const fetchRegistries = async () => {
    if (!tenantSlug || !token) return;
    try {
      const response = await diabetesApi.listRegistries(token, tenantSlug, { limit: 6 });
      const list = response.data?.registries ?? response.data ?? [];
      setRegistries(list);
      if (list.length) {
        await loadRegistryDetails(list[0]);
      } else {
        setSelectedRegistry(null);
        setCareBundles([]);
        setGlucoseHistory([]);
        setCgmSummaries([]);
      }
    } catch (error) {
      console.error('Failed to load diabetes registries', error);
      showError('Unable to load registries', 'Please try again later.');
    }
  };

  const loadRegistryDetails = async (registry: any) => {
    if (!tenantSlug || !token) return;
    const registryId = registry.id;
    const patientId = registry.patient_id || registry.patientId;

    if (!registryId || !patientId) {
      showError('Missing data', 'Unable to determine selected registry.');
      return;
    }

    try {
      setDetailLoading(true);
      const [registryResponse, careResponse, glucoseResponse, cgmResponse] = await Promise.all([
        diabetesApi.getRegistryByPatient(patientId, token, tenantSlug),
        diabetesApi.getCareBundleHistory(registryId, token, tenantSlug),
        diabetesApi.getGlucoseHistory(registryId, token, tenantSlug, { limit: 8 }),
        diabetesApi.getCgmSummary(registryId, token, tenantSlug),
      ]);
      setSelectedRegistry(registryResponse.data);
      const careData = Array.isArray(careResponse.data) ? careResponse.data : [];
      const glucoseData = Array.isArray(glucoseResponse.data) ? glucoseResponse.data : [];
      const cgmData = Array.isArray(cgmResponse.data) ? cgmResponse.data : [];
      setCareBundles(careData);
      setGlucoseHistory(glucoseData);
      setCgmSummaries(cgmData);
    } catch (error) {
      console.error('Failed to load registry details', error);
      showError('Unable to load registry details', 'Please try again later.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      const response = await cdssApi.searchGuidelines(guidelineQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    showInfo('Session ended', 'You have been logged out.');
    navigate(`/ehr/${tenantSlug}`);
  };

  if (!tenantSlug) {
    return null;
  }

  const summaryCards = [
    {
      title: 'Active Registries',
      value: summary?.totals?.active_cases ?? '0',
      subtitle: 'Currently managed patients',
      icon: HeartPulse,
      accent: 'from-rose-500/40 via-fuchsia-400/30 to-purple-500/30',
    },
    {
      title: 'In Remission',
      value: summary?.totals?.in_remission ?? '0',
      subtitle: 'Maintaining remission',
      icon: Activity,
      accent: 'from-emerald-400/40 via-teal-400/30 to-sky-400/30',
    },
    {
      title: 'Upcoming Screens',
      value: summary?.upcomingScreenings?.length ?? 0,
      subtitle: 'Next 30 days',
      icon: CalendarDays,
      accent: 'from-amber-400/40 via-orange-400/30 to-rose-400/30',
    },
    {
      title: 'Active Alerts',
      value:
        summary?.alerts?.reduce((sum: number, alert: any) => sum + (alert?.count ?? 0), 0) ?? 0,
      subtitle: 'Needs review',
      icon: AlertTriangle,
      accent: 'from-red-500/35 via-orange-400/30 to-yellow-400/25',
    },
  ];

  const upcomingScreenings = summary?.upcomingScreenings ?? [];
  const currentCgm = cgmSummaries?.[0];

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-900 to-rose-900" />
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur">
                <Stethoscope className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">Metabolic Command</p>
                <h1 className="text-3xl font-semibold tracking-tight mt-2">Diabetes Care Studio</h1>
                <p className="text-sm text-white/80 max-w-2xl mt-2">
                  Monitor population-level insights, dive into individual registries, and coordinate proactive outreach
                  with a workspace built for chronic care management.
                </p>
              </div>
            </div>
            {currentUser && (
              <div className="flex items-center gap-4 bg-white/10 rounded-2xl px-4 py-3 backdrop-blur">
                <div className="text-sm">
                  <p className="text-white/70">Signed in as</p>
                  <p className="font-semibold">
                    {currentUser.firstName} {currentUser.lastName}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-white/60">{currentUser.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                  aria-label="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* AI Guideline Search Section */}
          <div className="bg-white/10 backdrop-blur border border-white/20 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Brain className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Diabetes Protocols & Guidelines</h3>
                  <p className="text-sm text-indigo-200">AI-powered search for ADA Standards & Glycemic Targets</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                className="text-sm text-indigo-200 font-medium hover:text-white transition"
              >
                {showGuidelineSearch ? 'Hide Search' : 'Search Protocols'}
              </button>
            </div>

            {showGuidelineSearch && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={guidelineQuery}
                      onChange={(e) => setGuidelineQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                      placeholder="Search e.g. 'Metformin titration', 'Insulin sensitivity', 'Hypoglycemia protocol'..."
                      className="w-full pl-9 pr-4 py-2 bg-white/90 border border-transparent rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 placeholder:text-slate-500"
                    />
                  </div>
                  <button
                    onClick={handleGuidelineSearch}
                    disabled={loadingGuidelines}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {loadingGuidelines ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </button>
                </div>

                {guidelineResults.length > 0 && (
                  <div className="grid gap-3 max-h-96 overflow-y-auto custom-scrollbar">
                    {guidelineResults.slice(0, 2).map((citation, idx) => (
                      <div key={idx} className="bg-white/90 p-3 rounded-lg border border-white/20">
                        <div className="flex items-start gap-2 mb-1">
                          <BookOpen className="w-4 h-4 text-indigo-600 mt-0.5" />
                          <p className="text-sm font-medium text-slate-900">{citation.source || 'Clinical Guideline'}</p>
                        </div>
                        <p className="text-sm text-slate-700 pl-6">{citation.text}</p>
                        {citation.url && (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline pl-6 mt-1 block"
                          >
                            View Source
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </div>

      <div className="relative -mt-12 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white shadow-xl border border-slate-100 p-6 sm:p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                <p>Preparing diabetes workspace...</p>
              </div>
            ) : (
              <div className="flex flex-col xl:flex-row gap-8">
                <div className="xl:w-1/3 space-y-8">
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Registry focus</p>
                        <h2 className="text-xl font-semibold text-slate-900 mt-2">Patient cohorts</h2>
                      </div>
                      <span className="text-sm text-slate-400">{registries.length} tracked</span>
                    </div>
                    <div className="space-y-3">
                      {registries.length ? (
                        registries.map((registry) => (
                          <RegistryCard
                            key={registry.id}
                            registry={registry}
                            active={selectedRegistry?.id === registry.id}
                            onSelect={() => loadRegistryDetails(registry)}
                          />
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
                          No diabetes registries yet. Enroll a patient from the clinical record to activate this view.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Proactive radar</p>
                        <h3 className="text-lg font-semibold text-slate-900">Upcoming screenings</h3>
                      </div>
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="space-y-3">
                      {upcomingScreenings.length ? (
                        upcomingScreenings.slice(0, 5).map((screen: any) => (
                          <div
                            key={`${screen.patient_id}-${screen.screening_date}`}
                            className="rounded-xl bg-white px-4 py-3 shadow-sm border border-white/70"
                          >
                            <p className="text-sm font-semibold text-slate-900">
                              {screen.patient_name ?? 'Patient'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 capitalize">
                              {screen.screening_type?.replace('_', ' ')}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {formatDate(screen.next_screening_due_date)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Droplets className="w-3 h-3" />
                                {screen.screening_result ?? 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No screenings due in the next 30 days.</p>
                      )}
                    </div>
                  </section>
                </div>

                <div className="flex-1 relative">
                  {detailLoading && (
                    <div className="absolute inset-0 rounded-3xl bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-500" />
                      <p>Refreshing registry insights...</p>
                    </div>
                  )}
                  {selectedRegistry ? (
                    <div className={`space-y-6 ${detailLoading ? 'opacity-40 pointer-events-none' : ''}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <Chip
                          label="Diagnosis date"
                          value={formatDate(selectedRegistry.diagnosis_date)}
                        />
                        <Chip
                          label="Diabetes type"
                          value={selectedRegistry.diabetes_type?.replace('_', ' ') ?? 'Type 2'}
                        />
                        <Chip label="Status" value={(selectedRegistry.status ?? 'active').replace('_', ' ')} />
                        <Chip
                          label="Care team"
                          value={
                            selectedRegistry.primary_care_provider_id
                              ? 'Assigned'
                              : 'Needs assignment'
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-100 p-5 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Care bundle</p>
                              <h3 className="text-lg font-semibold text-slate-900">WHO bundle momentum</h3>
                            </div>
                            <Syringe className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="space-y-4">
                            {careBundles.length ? (
                              careBundles.slice(0, 4).map((bundle) => (
                                <div key={bundle.id} className="flex items-center gap-4">
                                  <div className="w-16">
                                    <p className="text-xs text-slate-400 uppercase tracking-[0.3em]">Date</p>
                                    <p className="text-sm font-semibold text-slate-800">
                                      {formatDate(bundle.bundle_date)}
                                    </p>
                                  </div>
                                  <div className="flex-1">
                                    <div className="relative h-2 rounded-full bg-slate-100">
                                      <div
                                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                                        style={{ width: `${bundle.bundle_completion_percentage ?? 0}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                      Completion {bundle.bundle_completion_percentage ?? 0}%
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">No care bundle activity captured yet.</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-100 p-5 shadow-sm bg-slate-50/60">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CGM pulse</p>
                              <h3 className="text-lg font-semibold text-slate-900">Glycemic stability</h3>
                            </div>
                            <TrendingUp className="w-5 h-5 text-slate-400" />
                          </div>
                          {currentCgm ? (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="rounded-xl bg-white p-4 border border-slate-100">
                                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Time in range</p>
                                <p className="text-2xl font-semibold text-slate-900 mt-2">
                                  {currentCgm.time_in_range_70_180 ?? '--'}%
                                </p>
                                <p className="text-xs text-slate-500 mt-1">70-180 mg/dL</p>
                              </div>
                              <div className="rounded-xl bg-white p-4 border border-slate-100">
                                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Avg glucose</p>
                                <p className="text-2xl font-semibold text-slate-900 mt-2">
                                  {currentCgm.average_glucose ?? '--'} mg/dL
                                </p>
                                <p className="text-xs text-slate-500 mt-1">Var {currentCgm.glucose_variability ?? '--'}</p>
                              </div>
                              <div className="rounded-xl bg-white p-4 border border-slate-100 col-span-2">
                                <div className="flex items-center justify-between text-sm text-slate-500">
                                  <span>Above range</span>
                                  <span>{currentCgm.time_above_range_180 ?? '--'}%</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-slate-500 mt-2">
                                  <span>Below range</span>
                                  <span>{currentCgm.time_below_range_70 ?? '--'}%</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                  Device {currentCgm.device_type ?? '—'} on {formatDate(currentCgm.summary_date)}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">No CGM data has been synced for this registry.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Recent log</p>
                            <h3 className="text-lg font-semibold text-slate-900">Glucose readings</h3>
                          </div>
                          <LineChart className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead>
                              <tr className="text-xs uppercase tracking-[0.3em] text-slate-400">
                                <th className="py-2">Recorded</th>
                                <th>Value</th>
                                <th>Context</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {glucoseHistory.length ? (
                                glucoseHistory.map((reading) => (
                                  <tr key={reading.id} className="border-t border-slate-100">
                                    <td className="py-3 text-slate-700">{formatDate(reading.recorded_at, true)}</td>
                                    <td className="font-semibold text-slate-900">
                                      {reading.glucose_value}
                                      <span className="text-xs text-slate-400 ml-1">{reading.glucose_unit}</span>
                                    </td>
                                    <td className="capitalize text-slate-500">
                                      {reading.reading_type?.replace('_', ' ') ?? '—'}
                                    </td>
                                    <td className="text-slate-500">{reading.notes ?? '—'}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="py-6 text-center text-slate-500">
                                    No glucose readings yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-500">
                      Select a registry on the left to see detailed analytics, care bundle momentum, and device data.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WHO Smart Forms Floating Button */}
      <SmartFormsFloatingButton
        token={localStorage.getItem('ehr_token') || ''}
        tenantSlug={tenantSlug!}
        moduleFilter="clinical"
        position="bottom-right"
      />
    </div>
  );
};

export default DiabetesManagementDashboard;

