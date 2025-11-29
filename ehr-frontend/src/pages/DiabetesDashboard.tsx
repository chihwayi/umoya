import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Droplet,
  HeartPulse,
  Loader2,
  LogOut,
  Stethoscope,
} from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import DiabetesCareBundle from '../components/DiabetesCareBundle';
import DiabetesGlucoseMonitoring from '../components/DiabetesGlucoseMonitoring';
import DiabetesMedications from '../components/DiabetesMedications';
import DiabetesInsulinRegimen from '../components/DiabetesInsulinRegimen';
import DiabetesDeviceIntegration from '../components/DiabetesDeviceIntegration';
import DiabetesAlertsPanel from '../components/DiabetesAlertsPanel';
import DiabetesScreeningsPanel from '../components/DiabetesScreeningsPanel';
import DiabetesEducationPanel from '../components/DiabetesEducationPanel';
import DiabetesCgmInsights from '../components/DiabetesCgmInsights';

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

const DiabetesDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showInfo } = useNotification();

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [registries, setRegistries] = useState<any[]>([]);
  const [selectedRegistry, setSelectedRegistry] = useState<any | null>(null);
  const [careBundleSnapshot, setCareBundleSnapshot] = useState<any | null>(null);
  const [latestCgmSummary, setLatestCgmSummary] = useState<any | null>(null);
  const [cgmSummaries, setCgmSummaries] = useState<any[]>([]);
  const [screeningDueStatus, setScreeningDueStatus] = useState<any[]>([]);
  const [educationDueStatus, setEducationDueStatus] = useState<any | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const token = useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  useEffect(() => {
    const stored = localStorage.getItem('ehr_user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      const response = await diabetesApi.getDashboardSummary(token, tenantSlug);
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load diabetes summary', error);
      showError('Unable to load diabetes insights', 'Please try again later.');
    }
  }, [tenantSlug, token, showError]);

  const loadRegistryDetails = useCallback(
    async (registry: any) => {
      if (!tenantSlug || !token) return;
      setDetailLoading(true);
      try {
        const registryId = registry.id;
        const patientId = registry.patient_id || registry.patientId;
        const [careBundleResp, cgmResp, alertsResp, screeningResp, educationResp] = await Promise.all([
          diabetesApi.getCareBundleCompletion(registryId, token, tenantSlug),
          diabetesApi.getCgmSummary(registryId, token, tenantSlug),
          diabetesApi.getAlerts(registryId, token, tenantSlug),
          diabetesApi.getScreeningDueStatus(registryId, token, tenantSlug),
          diabetesApi.getEducationDueStatus(registryId, token, tenantSlug),
        ]);
        setCareBundleSnapshot(careBundleResp.data ?? null);
        const cgmList = Array.isArray(cgmResp.data) ? cgmResp.data : [];
        setCgmSummaries(cgmList);
        setLatestCgmSummary(cgmList[0] ?? null);
        setAlerts(Array.isArray(alertsResp.data) ? alertsResp.data : []);
        setScreeningDueStatus(Array.isArray(screeningResp.data) ? screeningResp.data : []);
        setEducationDueStatus(educationResp.data ?? null);

        const registryResponse = await diabetesApi.getRegistryByPatient(patientId, token, tenantSlug);
        setSelectedRegistry(registryResponse.data);
      } catch (error) {
        console.error('Failed to load registry details', error);
        showError('Unable to load registry details', 'Please try again later.');
      } finally {
        setDetailLoading(false);
      }
    },
    [showError, tenantSlug, token],
  );

  const fetchRegistries = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      const response = await diabetesApi.listRegistries(token, tenantSlug, { limit: 6 });
      const list = response.data?.registries ?? response.data ?? [];
      setRegistries(list);
      if (list.length) {
        await loadRegistryDetails(list[0]);
      } else {
        setSelectedRegistry(null);
      }
    } catch (error) {
      console.error('Failed to load diabetes registries', error);
      showError('Unable to load registries', 'Please try again later.');
    }
  }, [tenantSlug, token, loadRegistryDetails, showError]);

  useEffect(() => {
    const initialize = async () => {
      if (!tenantSlug || !token) return;
      setLoading(true);
      await Promise.all([fetchSummary(), fetchRegistries()]);
      setLoading(false);
    };
    initialize();
  }, [tenantSlug, token, fetchSummary, fetchRegistries]);

  const nextScreening = useMemo(() => {
    return screeningDueStatus
      .filter((item) => item.nextScreeningDueDate)
      .sort(
        (a, b) =>
          new Date(a.nextScreeningDueDate).getTime() - new Date(b.nextScreeningDueDate).getTime(),
      )[0];
  }, [screeningDueStatus]);

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    showInfo('Session ended', 'You have been logged out.');
    navigate(`/ehr/${tenantSlug}`);
  };

  const overviewCards = useMemo(() => {
    const hbA1c = careBundleSnapshot?.bundle?.hba1c_value ?? null;
    const timeInRange = latestCgmSummary?.time_in_range_70_180 ?? null;
    const completion = careBundleSnapshot?.completionPercentage ?? null;

    return [
      {
        title: 'Active registries',
        value: summary?.totals?.active_cases ?? '0',
        subtitle: 'Currently managed',
        accent: 'from-rose-500/30 via-fuchsia-400/20 to-purple-500/20',
        icon: HeartPulse,
      },
      {
        title: 'Latest HbA1c',
        value: hbA1c ? `${hbA1c}%` : '—',
        subtitle: careBundleSnapshot?.bundle?.hba1c_date
          ? `Updated ${formatDate(careBundleSnapshot.bundle.hba1c_date)}`
          : 'No lab on file',
        accent: 'from-emerald-500/30 via-teal-400/20 to-sky-400/20',
        icon: Droplet,
      },
      {
        title: 'Time in range',
        value: timeInRange !== null ? `${timeInRange}%` : '—',
        subtitle: latestCgmSummary?.summary_date
          ? `CGM ${formatDate(latestCgmSummary.summary_date)}`
          : 'No CGM data',
        accent: 'from-indigo-500/30 via-blue-400/20 to-cyan-400/20',
        icon: Activity,
      },
      {
        title: 'Care bundle',
        value: completion !== null ? `${completion}%` : '—',
        subtitle: 'Completion rate',
        accent: 'from-amber-500/30 via-orange-400/20 to-rose-400/20',
        icon: Stethoscope,
      },
      {
        title: 'Education cadence',
        value: educationDueStatus?.nextDueDate ? formatDate(educationDueStatus.nextDueDate) : 'Schedule',
        subtitle: educationDueStatus
          ? educationDueStatus.overdue && educationDueStatus.nextDueDate
            ? `Overdue since ${formatDate(educationDueStatus.nextDueDate)}`
            : educationDueStatus.lastSessionDate
            ? `Last ${formatDate(educationDueStatus.lastSessionDate)}`
            : 'No sessions logged'
          : 'No sessions logged',
        accent: 'from-fuchsia-500/30 via-pink-400/20 to-rose-400/20',
        icon: BookOpen,
      },
      {
        title: 'Next screening',
        value: nextScreening?.nextScreeningDueDate
          ? formatDate(nextScreening.nextScreeningDueDate)
          : 'Not scheduled',
        subtitle: nextScreening?.screeningType?.replace('_', ' ') ?? 'Pending',
        accent: 'from-slate-500/30 via-slate-400/20 to-slate-300/20',
        icon: CalendarDays,
      },
    ];
  }, [careBundleSnapshot, educationDueStatus, latestCgmSummary, nextScreening, summary]);

  if (!tenantSlug) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-900 to-rose-900" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-white space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur">
                <Stethoscope className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">Metabolic studio</p>
                <h1 className="text-3xl font-semibold tracking-tight mt-2">Diabetes Command Center</h1>
                <p className="text-sm text-white/80 max-w-2xl mt-2">
                  Monitor WHO-aligned care bundles, CGM trends, and CDS alerts with a single, high-fidelity workspace.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {overviewCards.map((card) => (
              <div
                key={card.title}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.accent}`} />
                <div className="relative flex items-center gap-4 p-4">
                  <div className="p-3 rounded-2xl bg-black/10 text-white">
                    <card.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">{card.title}</p>
                    <p className="text-2xl font-semibold text-white">{card.value}</p>
                    <p className="text-xs text-white/70 mt-1">{card.subtitle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative -mt-10 pb-16">
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
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                      {registries.length ? (
                        registries.map((registry) => (
                          <button
                            key={registry.id}
                            onClick={() => loadRegistryDetails(registry)}
                            className={`w-full text-left rounded-2xl border px-4 py-4 transition ${
                              selectedRegistry?.id === registry.id
                                ? 'border-indigo-500 bg-indigo-50/70 shadow-lg shadow-indigo-100'
                                : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'
                            }`}
                          >
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Patient</p>
                            <p className="text-lg font-semibold text-slate-900 mt-1">
                              {registry.patient_name ?? 'Unknown'}
                            </p>
                            <p className="text-sm text-slate-500 mt-1 capitalize">
                              {registry.diabetes_type?.replace('_', ' ')}
                            </p>
                            <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                {registry.status?.replace('_', ' ') ?? 'active'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {formatDate(registry.diagnosis_date)}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
                          No diabetes registries yet. Enroll a patient to activate this view.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Care radar</p>
                        <h3 className="text-lg font-semibold text-slate-900">Priority signals</h3>
                      </div>
                      <AlertTriangle className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-white/70">
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Next screening</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">
                          {nextScreening?.screeningType
                            ? nextScreening.screeningType.replace('_', ' ')
                            : 'Not scheduled'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {nextScreening?.nextScreeningDueDate
                            ? formatDate(nextScreening.nextScreeningDueDate)
                            : 'Schedule follow-up'}
                        </p>
                        {nextScreening?.overdue && <p className="text-xs text-rose-500 mt-1">Overdue</p>}
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-white/70">
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Education cycle</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">
                          {educationDueStatus?.nextDueDate
                            ? formatDate(educationDueStatus.nextDueDate)
                            : 'Needs scheduling'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {educationDueStatus?.overdue
                            ? 'Overdue touchpoint'
                            : educationDueStatus?.lastSessionDate
                            ? `Last ${formatDate(educationDueStatus.lastSessionDate)}`
                            : 'No sessions recorded'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-white/70">
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Active alerts</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">{alerts.length}</p>
                        <p className="text-xs text-slate-500">Awaiting review</p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="flex-1 relative space-y-6">
                  {detailLoading && (
                    <div className="absolute inset-0 rounded-3xl bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-500" />
                      <p>Refreshing registry insights...</p>
                    </div>
                  )}

                  {selectedRegistry ? (
                    <>
                      <DiabetesCareBundle
                        tenantSlug={tenantSlug}
                        token={token}
                        registryId={selectedRegistry.id}
                        patientId={selectedRegistry.patient_id}
                        initialData={careBundleSnapshot}
                        onUpdated={(data) => setCareBundleSnapshot(data)}
                      />

                      <DiabetesGlucoseMonitoring
                        tenantSlug={tenantSlug}
                        token={token}
                        registryId={selectedRegistry.id}
                        patientId={selectedRegistry.patient_id}
                      />

                      <DiabetesCgmInsights
                        tenantSlug={tenantSlug}
                        token={token}
                        registryId={selectedRegistry.id}
                        patientId={selectedRegistry.patient_id}
                        initialSummaries={cgmSummaries}
                        onUpdated={(list) => {
                          setCgmSummaries(list);
                          setLatestCgmSummary(list[0] ?? null);
                        }}
                      />

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DiabetesMedications
                          tenantSlug={tenantSlug}
                          token={token}
                          registryId={selectedRegistry.id}
                          patientId={selectedRegistry.patient_id}
                        />
                        <DiabetesInsulinRegimen
                          tenantSlug={tenantSlug}
                          token={token}
                          registryId={selectedRegistry.id}
                          patientId={selectedRegistry.patient_id}
                        />
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <DiabetesScreeningsPanel
                          tenantSlug={tenantSlug}
                          token={token}
                          registryId={selectedRegistry.id}
                          patientId={selectedRegistry.patient_id}
                          initialDue={screeningDueStatus}
                          onSummaryChange={(due) => setScreeningDueStatus(Array.isArray(due) ? due : [])}
                        />
                        <DiabetesEducationPanel
                          tenantSlug={tenantSlug}
                          token={token}
                          registryId={selectedRegistry.id}
                          patientId={selectedRegistry.patient_id}
                          onSummaryChange={(status) => setEducationDueStatus(status)}
                        />
                      </div>

                      <DiabetesDeviceIntegration
                        tenantSlug={tenantSlug}
                        token={token}
                        registryId={selectedRegistry.id}
                        patientId={selectedRegistry.patient_id}
                      />

                      <DiabetesAlertsPanel
                        tenantSlug={tenantSlug}
                        token={token}
                        registryId={selectedRegistry.id}
                        onChange={(list) => setAlerts(list)}
                      />
                    </>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                      Select a registry to view detailed diabetes insights.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiabetesDashboard;


