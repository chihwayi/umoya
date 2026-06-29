import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Database,
  GitMerge,
  RefreshCw,
  Route,
  Send,
  Activity,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Bell,
  BellRing,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

type TabKey = 'tracker' | 'datim' | 'mappings' | 'aggregate' | 'benchmarks' | 'subscriptions' | 'extended_mer' | 'validation';

interface Dhis2DatimDashboardProps {
  tenantSlug?: string;
  token?: string;
}

interface PreviewRow {
  indicator: string;
  disaggregate: string;
  value: number;
}

interface SubmissionRow {
  id: string;
  period: string;
  orgUnitUid: string;
  indicatorCount: number | null;
  status: string;
  submittedAt: string | null;
  errorMessage: string | null;
  datimImportSummary: any | null;
}

interface MappingRow {
  id: string;
  merIndicator: string;
  disaggregate: string;
  datimDeUid: string;
  datimCocUid: string;
  periodType: string;
  notes: string | null;
}

interface ProgrammeSubscription {
  id: string;
  indicatorCode: string;
  indicatorName: string;
  thresholdOperator: string;
  thresholdValue: number;
  alertEnabled: boolean;
  lastValue: number | null;
  lastCheckedAt: string | null;
  lastAlertedAt: string | null;
}

interface AnomalyNarrative {
  narrative: string;
  anomalies: Array<{ indicator: string; current: number; previous: number; pctChange: number }>;
  model: string | null;
}

interface AggregateReportResult {
  status: string;
  message?: string;
  profile?: string;
  period?: string;
  dataValues?: number;
  imported?: number;
  updated?: number;
  ignored?: number;
  validation?: {
    rulesChecked: number;
    violations: Array<{
      ruleName: string;
      description?: string;
      leftValue?: string | number;
      operator?: string;
      rightValue?: string | number;
    }>;
  };
}

const authHeaders = (token: string, tenantSlug: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Tenant-ID': tenantSlug,
});

const getStoredToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonthPeriod = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const apiError = (error: any, fallback: string) =>
  error?.response?.data?.detail ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; tone: string }> = ({
  label,
  value,
  icon,
  tone,
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${tone}`}>{icon}</div>
    </div>
  </div>
);

const TabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
      active
        ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

const Dhis2DatimDashboard: React.FC<Dhis2DatimDashboardProps> = ({ tenantSlug: tenantSlugProp, token: tokenProp }) => {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = tenantSlugProp || params.tenantSlug || '';
  const token = tokenProp || getStoredToken();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const cdssBaseUrl = process.env.REACT_APP_CDSS_URL || 'http://localhost:8000';
  const cdssAxios = useMemo(
    () =>
      axios.create({
        baseURL: cdssBaseUrl,
      }),
    [cdssBaseUrl],
  );

  const [tab, setTab] = useState<TabKey>('tracker');
  const [loading, setLoading] = useState(false);

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [teiLookupResult, setTeiLookupResult] = useState<any | null>(null);

  // ── Aggregate reporting state ────────────────────────────────────────────
  const [aggregateProfiles, setAggregateProfiles] = useState<Array<{ key: string; label: string; period: string }>>([]);
  const [selectedProfile, setSelectedProfile] = useState('service_delivery');
  const [aggregatePeriod, setAggregatePeriod] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [aggregateResult, setAggregateResult] = useState<any | null>(null);
  const [aggregateLoading, setAggregateLoading] = useState(false);

  // ── Benchmark / pull-back state ──────────────────────────────────────────
  const [benchmarkPeriod, setBenchmarkPeriod] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [benchmarkData, setBenchmarkData] = useState<{
    period: string; mock: boolean;
    facilityOrgUnit: string | null; districtOrgUnit: string | null; nationalOrgUnit: string | null;
    indicators: Array<{
      label: string; dataElement: string; unit: string;
      facilityValue: number | null; districtAvg: number | null; nationalAvg: number | null;
      trend: 'above_district' | 'below_district' | 'at_par' | 'no_benchmark';
    }>;
  } | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  // ── Anomaly narrative state ──────────────────────────────────────────────
  const [narrativeData, setNarrativeData] = useState<AnomalyNarrative | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  // ── Programme subscriptions state ────────────────────────────────────────
  const [subscriptions, setSubscriptions] = useState<ProgrammeSubscription[]>([]);
  const [subscriptionForm, setSubscriptionForm] = useState({
    indicatorCode: '',
    indicatorName: '',
    thresholdOperator: 'above',
    thresholdValue: '0',
    alertEnabled: true,
  });
  const [checkResults, setCheckResults] = useState<Array<{ indicatorCode: string; value: number; breached: boolean }>>([]);
  const [checkLoading, setCheckLoading] = useState(false);

  // S241 — Validation Feedback state
  const [validationPeriod, setValidationPeriod] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [validationReport, setValidationReport] = useState<any | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);

  const loadValidation = useCallback(async () => {
    setValidationLoading(true);
    try {
      const { data } = await ehrAxios.get(
        `/tenants/${tenantSlug}/dhis2-validation/outliers?period=${validationPeriod}`,
        { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } },
      );
      setValidationReport(data);
    } catch { /* handled silently */ }
    setValidationLoading(false);
  }, [tenantSlug, token, validationPeriod]);

  const runValidation = async () => {
    setValidationLoading(true);
    try {
      await ehrAxios.post(
        `/tenants/${tenantSlug}/dhis2-validation/run?period=${validationPeriod}`,
        {},
        { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } },
      );
      await loadValidation();
    } catch { /* handled silently */ }
    setValidationLoading(false);
  };

  // Extended MER state
  const [extendedMerPeriod, setExtendedMerPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [extendedMerData, setExtendedMerData] = useState<any | null>(null);
  const [extendedMerLoading, setExtendedMerLoading] = useState(false);

  const loadExtendedMer = useCallback(async (period?: string) => {
    const p = period ?? extendedMerPeriod;
    setExtendedMerLoading(true);
    try {
      const { data } = await ehrAxios.get(`/datim/extended/${p}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setExtendedMerData(data);
    } catch {
      // silently fail
    } finally {
      setExtendedMerLoading(false);
    }
  }, [extendedMerPeriod, tenantSlug, token]);

  const [hivEnrollmentForm, setHivEnrollmentForm] = useState({
    patientId: '',
    trackedEntityUid: '',
    orgUnitUid: '',
    enrollmentDate: todayIso(),
    nationalId: '',
    dob: '',
    sex: 'F',
    artStartDate: '',
  });
  const [tbEnrollmentForm, setTbEnrollmentForm] = useState({
    patientId: '',
    trackedEntityUid: '',
    orgUnitUid: '',
    enrollmentDate: todayIso(),
    nationalId: '',
    dob: '',
    sex: 'F',
    tbCategory: '',
  });
  const [teiLookupId, setTeiLookupId] = useState('');
  const [artVisitForm, setArtVisitForm] = useState({
    teiUid: '',
    orgUnitUid: '',
    visitDate: todayIso(),
    programStageUid: '',
    cd4: '',
    viralLoad: '',
    regimen: '',
    weight: '',
  });
  const [tbVisitForm, setTbVisitForm] = useState({
    teiUid: '',
    orgUnitUid: '',
    visitDate: todayIso(),
    programStageUid: '',
    weight: '',
    smearResult: '',
    outcome: '',
  });
  const [datimForm, setDatimForm] = useState({
    period: currentMonthPeriod(),
    orgUnitUid: '',
  });
  const [mappingForm, setMappingForm] = useState({
    merIndicator: 'TX_NEW',
    disaggregate: 'F_25-29',
    datimDeUid: '',
    datimCocUid: '',
    periodType: 'monthly',
    notes: '',
  });

  const ehrHeaders = useMemo(() => authHeaders(token, tenantSlug), [token, tenantSlug]);
  const cdssHeaders = useMemo(() => authHeaders(token, tenantSlug), [token, tenantSlug]);

  const loadDatimSubmissions = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/datim/submissions', { headers: ehrHeaders });
    setSubmissions(Array.isArray(data) ? data : []);
  }, [ehrHeaders, tenantSlug, token]);

  const loadMappings = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/datim/indicator-mappings', { headers: ehrHeaders });
    setMappings(Array.isArray(data) ? data : []);
  }, [ehrHeaders, tenantSlug, token]);

  const loadSubscriptions = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/dhis2/programme-subscriptions', { headers: ehrHeaders });
    setSubscriptions(Array.isArray(data) ? data : []);
  }, [ehrHeaders, tenantSlug, token]);

  const fetchAnomalyNarrative = useCallback(async (period: string) => {
    if (!tenantSlug || !token || !period) return;
    setNarrativeLoading(true);
    setNarrativeData(null);
    try {
      const { data } = await ehrAxios.get(`/datim/anomaly-narrative/${encodeURIComponent(period)}`, { headers: ehrHeaders });
      setNarrativeData(data);
    } catch {
      // narrative is non-critical — fail silently
    } finally {
      setNarrativeLoading(false);
    }
  }, [ehrHeaders, tenantSlug, token]);

  const refreshAll = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      await Promise.all([loadDatimSubmissions(), loadMappings(), loadSubscriptions()]);
    } catch (error: any) {
      showError('Refresh failed', apiError(error, 'Unable to load DHIS2 / DATIM data.'));
    } finally {
      setLoading(false);
    }
  }, [loadDatimSubmissions, loadMappings, loadSubscriptions, showError, tenantSlug, token]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Load aggregate profiles list on mount
  useEffect(() => {
    if (!tenantSlug || !token) return;
    ehrAxios.get('/dhis2/profiles', { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } })
      .then(r => setAggregateProfiles(r.data?.profiles || []))
      .catch(() => {});
  }, [tenantSlug, token]);

  const sendAggregateReport = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setAggregateLoading(true);
    setAggregateResult(null);
    try {
      const res = await ehrAxios.post('/dhis2/reports/aggregate',
        { profile: selectedProfile, period: aggregatePeriod },
        { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } },
      );
      setAggregateResult(res.data);
      showSuccess('Report sent', `${selectedProfile} → DHIS2: ${res.data?.status}`);
    } catch (err: any) {
      setAggregateResult({ status: 'ERROR', message: err?.response?.data?.message || err?.message });
      showError('Send failed', apiError(err, 'Could not send aggregate report.'));
    } finally {
      setAggregateLoading(false);
    }
  }, [tenantSlug, token, selectedProfile, aggregatePeriod, showSuccess, showError]);

  const loadBenchmarks = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setBenchmarkLoading(true);
    try {
      const res = await ehrAxios.get('/dhis2/benchmarks/doctor-dashboard', {
        params: { period: benchmarkPeriod },
        headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug },
      });
      setBenchmarkData(res.data);
    } catch (err: any) {
      showError('Benchmark fetch failed', apiError(err, 'Could not pull benchmarks from DHIS2.'));
    } finally {
      setBenchmarkLoading(false);
    }
  }, [tenantSlug, token, benchmarkPeriod, showError]);

  const submissionChartData = useMemo(
    () =>
      submissions
        .slice(0, 12)
        .map((row) => ({
          period: row.period,
          indicators: Number(row.indicatorCount || 0),
        }))
        .reverse(),
    [submissions],
  );

  const handleHivEnroll = async () => {
    try {
      const body = {
        patientId: hivEnrollmentForm.patientId,
        trackedEntityUid: hivEnrollmentForm.trackedEntityUid || undefined,
        orgUnitUid: hivEnrollmentForm.orgUnitUid,
        enrollmentDate: hivEnrollmentForm.enrollmentDate,
        attributes: {
          nationalId: hivEnrollmentForm.nationalId,
          dob: hivEnrollmentForm.dob,
          sex: hivEnrollmentForm.sex,
          artStartDate: hivEnrollmentForm.artStartDate || undefined,
        },
      };
      const { data } = await cdssAxios.post('/dhis2/tracker/enroll/hiv', body, { headers: cdssHeaders });
      showSuccess('HIV enrollment sent', `DHIS2 TEI created with reference ${data?.teiUid || 'pending'}.`);
    } catch (error: any) {
      showError('HIV enrollment failed', apiError(error, 'Unable to enroll HIV patient in DHIS2 Tracker.'));
    }
  };

  const handleTbEnroll = async () => {
    try {
      const body = {
        patientId: tbEnrollmentForm.patientId,
        trackedEntityUid: tbEnrollmentForm.trackedEntityUid || undefined,
        orgUnitUid: tbEnrollmentForm.orgUnitUid,
        enrollmentDate: tbEnrollmentForm.enrollmentDate,
        attributes: {
          nationalId: tbEnrollmentForm.nationalId,
          dob: tbEnrollmentForm.dob,
          sex: tbEnrollmentForm.sex,
          tbCategory: tbEnrollmentForm.tbCategory || undefined,
        },
      };
      const { data } = await cdssAxios.post('/dhis2/tracker/enroll/tb', body, { headers: cdssHeaders });
      showSuccess('TB enrollment sent', `DHIS2 TEI created with reference ${data?.teiUid || 'pending'}.`);
    } catch (error: any) {
      showError('TB enrollment failed', apiError(error, 'Unable to enroll TB patient in DHIS2 Tracker.'));
    }
  };

  const handleLookupTei = async () => {
    if (!teiLookupId.trim()) {
      showError('Patient ID required', 'Enter the patient national ID used in DHIS2 before lookup.');
      return;
    }
    try {
      const { data } = await cdssAxios.get(`/dhis2/tracker/tei/${encodeURIComponent(teiLookupId.trim())}`, {
        headers: cdssHeaders,
      });
      setTeiLookupResult(data);
      showSuccess('TEI lookup complete', 'DHIS2 tracker search completed successfully.');
    } catch (error: any) {
      showError('TEI lookup failed', apiError(error, 'Unable to look up the tracked entity instance.'));
    }
  };

  const handleArtVisit = async () => {
    try {
      await cdssAxios.post(
        '/dhis2/tracker/event/art-visit',
        {
          teiUid: artVisitForm.teiUid,
          orgUnitUid: artVisitForm.orgUnitUid,
          visitDate: artVisitForm.visitDate,
          programStageUid: artVisitForm.programStageUid,
          cd4: artVisitForm.cd4 ? Number(artVisitForm.cd4) : undefined,
          viralLoad: artVisitForm.viralLoad ? Number(artVisitForm.viralLoad) : undefined,
          regimen: artVisitForm.regimen || undefined,
          weight: artVisitForm.weight ? Number(artVisitForm.weight) : undefined,
        },
        { headers: cdssHeaders },
      );
      showSuccess('ART visit pushed', 'The ART visit event was sent to DHIS2 Tracker.');
    } catch (error: any) {
      showError('ART visit failed', apiError(error, 'Unable to push the ART visit event.'));
    }
  };

  const handleTbVisit = async () => {
    try {
      await cdssAxios.post(
        '/dhis2/tracker/event/tb-visit',
        {
          teiUid: tbVisitForm.teiUid,
          orgUnitUid: tbVisitForm.orgUnitUid,
          visitDate: tbVisitForm.visitDate,
          programStageUid: tbVisitForm.programStageUid,
          weight: tbVisitForm.weight ? Number(tbVisitForm.weight) : undefined,
          smearResult: tbVisitForm.smearResult || undefined,
          outcome: tbVisitForm.outcome || undefined,
        },
        { headers: cdssHeaders },
      );
      showSuccess('TB visit pushed', 'The TB visit event was sent to DHIS2 Tracker.');
    } catch (error: any) {
      showError('TB visit failed', apiError(error, 'Unable to push the TB visit event.'));
    }
  };

  const handlePreview = async () => {
    if (!datimForm.period.trim()) {
      showError('Period required', 'Enter a DATIM period such as 202403 or 2024Q1.');
      return;
    }
    try {
      const { data } = await ehrAxios.get(`/datim/preview/${encodeURIComponent(datimForm.period.trim())}`, {
        headers: ehrHeaders,
      });
      setPreviewRows(Array.isArray(data?.rows) ? data.rows : []);
      showSuccess('Preview generated', `Computed ${Array.isArray(data?.rows) ? data.rows.length : 0} indicator rows.`);
    } catch (error: any) {
      showError('Preview failed', apiError(error, 'Unable to compute DATIM indicators.'));
    }
  };

  const handleSubmitDatim = async () => {
    if (!datimForm.period.trim() || !datimForm.orgUnitUid.trim()) {
      showError('Fields required', 'Provide both reporting period and DATIM org unit UID before submitting.');
      return;
    }
    try {
      const { data } = await ehrAxios.post(
        `/datim/submit/${encodeURIComponent(datimForm.period.trim())}`,
        { orgUnitUid: datimForm.orgUnitUid.trim() },
        { headers: ehrHeaders },
      );
      await loadDatimSubmissions();
      showSuccess('DATIM submission complete', `Submission status: ${data?.status || 'submitted'}.`);
    } catch (error: any) {
      showError('DATIM submission failed', apiError(error, 'Unable to submit DATIM indicator data.'));
    }
  };

  const handleUpsertMapping = async () => {
    try {
      await ehrAxios.post('/datim/indicator-mappings', mappingForm, { headers: ehrHeaders });
      await loadMappings();
      showSuccess('Mapping saved', 'DATIM indicator mapping has been added or updated.');
    } catch (error: any) {
      showError('Mapping save failed', apiError(error, 'Unable to save the DATIM indicator mapping.'));
    }
  };

  const handleUpsertSubscription = async () => {
    try {
      await ehrAxios.post('/dhis2/programme-subscriptions', {
        indicatorCode: subscriptionForm.indicatorCode,
        indicatorName: subscriptionForm.indicatorName,
        thresholdOperator: subscriptionForm.thresholdOperator,
        thresholdValue: Number(subscriptionForm.thresholdValue),
        alertEnabled: subscriptionForm.alertEnabled,
      }, { headers: ehrHeaders });
      await loadSubscriptions();
      setSubscriptionForm({ indicatorCode: '', indicatorName: '', thresholdOperator: 'above', thresholdValue: '0', alertEnabled: true });
      showSuccess('Subscription saved', 'Programme indicator subscription has been created or updated.');
    } catch (error: any) {
      showError('Save failed', apiError(error, 'Unable to save subscription.'));
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    try {
      await ehrAxios.delete(`/dhis2/programme-subscriptions/${id}`, { headers: ehrHeaders });
      await loadSubscriptions();
      showSuccess('Deleted', 'Subscription removed.');
    } catch (error: any) {
      showError('Delete failed', apiError(error, 'Unable to delete subscription.'));
    }
  };

  const handleCheckSubscriptions = async () => {
    setCheckLoading(true);
    setCheckResults([]);
    try {
      const { data } = await ehrAxios.post('/dhis2/programme-subscriptions/check', {}, { headers: ehrHeaders });
      setCheckResults(Array.isArray(data) ? data : []);
      await loadSubscriptions();
      showSuccess('Check complete', `Checked ${Array.isArray(data) ? data.length : 0} indicator(s) against DHIS2.`);
    } catch (error: any) {
      showError('Check failed', apiError(error, 'Unable to check indicators.'));
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/ehr/${tenantSlug}`)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 hover:border-slate-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-white">DHIS2 Tracker + DATIM</h1>
              <p className="text-sm text-slate-400">Individual TEI enrollment, stage events, and DATIM MER 3.0 submission workflow.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 hover:border-slate-700 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Preview Rows" value={previewRows.length} icon={<BarChart3 className="h-5 w-5 text-cyan-200" />} tone="bg-cyan-500/10" />
          <StatCard label="DATIM Submissions" value={submissions.length} icon={<Send className="h-5 w-5 text-emerald-200" />} tone="bg-emerald-500/10" />
          <StatCard label="Indicator Mappings" value={mappings.length} icon={<GitMerge className="h-5 w-5 text-violet-200" />} tone="bg-violet-500/10" />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <TabButton active={tab === 'tracker'} icon={<Route className="h-4 w-4" />} label="DHIS2 Tracker" onClick={() => setTab('tracker')} />
            <TabButton active={tab === 'datim'} icon={<Database className="h-4 w-4" />} label="DATIM MER" onClick={() => setTab('datim')} />
            <TabButton active={tab === 'mappings'} icon={<GitMerge className="h-4 w-4" />} label="Indicator Mappings" onClick={() => setTab('mappings')} />
            <TabButton active={tab === 'aggregate'} icon={<Activity className="h-4 w-4" />} label="Aggregate Reports" onClick={() => setTab('aggregate')} />
            <TabButton active={tab === 'benchmarks'} icon={<TrendingUp className="h-4 w-4" />} label="Facility Benchmarks" onClick={() => { setTab('benchmarks'); loadBenchmarks(); }} />
            <TabButton active={tab === 'subscriptions'} icon={<Bell className="h-4 w-4" />} label="Subscriptions" onClick={() => setTab('subscriptions')} />
            <TabButton active={tab === 'extended_mer'} icon={<Activity className="h-4 w-4" />} label="Extended MER" onClick={() => { setTab('extended_mer'); loadExtendedMer(); }} />
            <TabButton active={tab === 'validation'} icon={<Activity className="h-4 w-4" />} label="Validation Feedback" onClick={() => { setTab('validation'); loadValidation(); }} />
          </div>

          {tab === 'tracker' && (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <h2 className="text-sm font-semibold text-white">Enroll HIV Patient</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      ['Patient ID', hivEnrollmentForm.patientId, 'patientId'],
                      ['Tracked Entity UID', hivEnrollmentForm.trackedEntityUid, 'trackedEntityUid'],
                      ['Org Unit UID', hivEnrollmentForm.orgUnitUid, 'orgUnitUid'],
                      ['Enrollment Date', hivEnrollmentForm.enrollmentDate, 'enrollmentDate'],
                      ['National ID', hivEnrollmentForm.nationalId, 'nationalId'],
                      ['DOB', hivEnrollmentForm.dob, 'dob'],
                      ['Sex', hivEnrollmentForm.sex, 'sex'],
                      ['ART Start Date', hivEnrollmentForm.artStartDate, 'artStartDate'],
                    ].map(([label, value, key]) => (
                      <label key={key} className="space-y-1 text-xs text-slate-400">
                        <span>{label}</span>
                        <input
                          type={key.toLowerCase().includes('date') || key === 'dob' ? 'date' : 'text'}
                          value={String(value)}
                          onChange={(event) =>
                            setHivEnrollmentForm((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleHivEnroll()}
                    className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                  >
                    Enroll HIV Patient
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <h2 className="text-sm font-semibold text-white">Enroll TB Patient</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      ['Patient ID', tbEnrollmentForm.patientId, 'patientId'],
                      ['Tracked Entity UID', tbEnrollmentForm.trackedEntityUid, 'trackedEntityUid'],
                      ['Org Unit UID', tbEnrollmentForm.orgUnitUid, 'orgUnitUid'],
                      ['Enrollment Date', tbEnrollmentForm.enrollmentDate, 'enrollmentDate'],
                      ['National ID', tbEnrollmentForm.nationalId, 'nationalId'],
                      ['DOB', tbEnrollmentForm.dob, 'dob'],
                      ['Sex', tbEnrollmentForm.sex, 'sex'],
                      ['TB Category', tbEnrollmentForm.tbCategory, 'tbCategory'],
                    ].map(([label, value, key]) => (
                      <label key={key} className="space-y-1 text-xs text-slate-400">
                        <span>{label}</span>
                        <input
                          type={key.toLowerCase().includes('date') || key === 'dob' ? 'date' : 'text'}
                          value={String(value)}
                          onChange={(event) =>
                            setTbEnrollmentForm((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleTbEnroll()}
                    className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                  >
                    Enroll TB Patient
                  </button>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 xl:col-span-1">
                  <h2 className="text-sm font-semibold text-white">Look Up TEI</h2>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={teiLookupId}
                      onChange={(event) => setTeiLookupId(event.target.value)}
                      placeholder="National ID"
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                    />
                    <button
                      type="button"
                      onClick={() => void handleLookupTei()}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:text-white"
                    >
                      Search
                    </button>
                  </div>
                  {teiLookupResult && (
                    <pre className="mt-4 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
                      {JSON.stringify(teiLookupResult, null, 2)}
                    </pre>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <h2 className="text-sm font-semibold text-white">Push ART Visit Event</h2>
                  <div className="mt-4 grid gap-3">
                    {[
                      ['TEI UID', artVisitForm.teiUid, 'teiUid'],
                      ['Org Unit UID', artVisitForm.orgUnitUid, 'orgUnitUid'],
                      ['Visit Date', artVisitForm.visitDate, 'visitDate'],
                      ['Program Stage UID', artVisitForm.programStageUid, 'programStageUid'],
                      ['CD4', artVisitForm.cd4, 'cd4'],
                      ['Viral Load', artVisitForm.viralLoad, 'viralLoad'],
                      ['Regimen', artVisitForm.regimen, 'regimen'],
                      ['Weight', artVisitForm.weight, 'weight'],
                    ].map(([label, value, key]) => (
                      <label key={key} className="space-y-1 text-xs text-slate-400">
                        <span>{label}</span>
                        <input
                          type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                          value={String(value)}
                          onChange={(event) => setArtVisitForm((current) => ({ ...current, [key]: event.target.value }))}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleArtVisit()}
                    className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Push ART Visit
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <h2 className="text-sm font-semibold text-white">Push TB Visit Event</h2>
                  <div className="mt-4 grid gap-3">
                    {[
                      ['TEI UID', tbVisitForm.teiUid, 'teiUid'],
                      ['Org Unit UID', tbVisitForm.orgUnitUid, 'orgUnitUid'],
                      ['Visit Date', tbVisitForm.visitDate, 'visitDate'],
                      ['Program Stage UID', tbVisitForm.programStageUid, 'programStageUid'],
                      ['Weight', tbVisitForm.weight, 'weight'],
                      ['Smear Result', tbVisitForm.smearResult, 'smearResult'],
                      ['Outcome', tbVisitForm.outcome, 'outcome'],
                    ].map(([label, value, key]) => (
                      <label key={key} className="space-y-1 text-xs text-slate-400">
                        <span>{label}</span>
                        <input
                          type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                          value={String(value)}
                          onChange={(event) => setTbVisitForm((current) => ({ ...current, [key]: event.target.value }))}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleTbVisit()}
                    className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Push TB Visit
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'datim' && (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <h2 className="text-sm font-semibold text-white">Preview and Submit DATIM MER 3.0</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs text-slate-400">
                      <span>Period</span>
                      <input
                        value={datimForm.period}
                        onChange={(event) => setDatimForm((current) => ({ ...current, period: event.target.value }))}
                        placeholder="202403 or 2024Q1"
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-400">
                      <span>Org Unit UID</span>
                      <input
                        value={datimForm.orgUnitUid}
                        onChange={(event) => setDatimForm((current) => ({ ...current, orgUnitUid: event.target.value }))}
                        placeholder="DHIS2 org unit UID"
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePreview()}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:text-white"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void fetchAnomalyNarrative(datimForm.period)}
                      disabled={narrativeLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-violet-700 bg-violet-500/10 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                    >
                      {narrativeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      AI Narrative
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitDatim()}
                      className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                    >
                      Submit to DATIM
                    </button>
                  </div>

                  {narrativeData && (
                    <div className="mt-4 rounded-2xl border border-violet-800 bg-violet-950/40 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-violet-400" />
                        <span className="text-xs font-semibold text-violet-300">Anomaly Narrative</span>
                        {narrativeData.model && (
                          <span className="rounded-full bg-violet-800/50 px-2 py-0.5 text-xs text-violet-400">{narrativeData.model}</span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-200">{narrativeData.narrative}</p>
                      {narrativeData.anomalies.length > 0 && (
                        <div className="mt-3 grid gap-1">
                          {narrativeData.anomalies.map((a) => (
                            <div key={a.indicator} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-1.5 text-xs">
                              <span className="font-medium text-slate-300">{a.indicator}</span>
                              <span className="text-slate-400">{a.current} <span className={a.pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>{a.pctChange >= 0 ? `+${a.pctChange}%` : `${a.pctChange}%`}</span> vs {a.previous}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
                    <table className="min-w-full divide-y divide-slate-800 text-sm">
                      <thead className="bg-slate-900 text-slate-300">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Indicator</th>
                          <th className="px-3 py-2 text-left font-medium">Disaggregate</th>
                          <th className="px-3 py-2 text-right font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-950 text-slate-200">
                        {previewRows.map((row) => (
                          <tr key={`${row.indicator}-${row.disaggregate}`}>
                            <td className="px-3 py-2">{row.indicator}</td>
                            <td className="px-3 py-2">{row.disaggregate}</td>
                            <td className="px-3 py-2 text-right">{row.value}</td>
                          </tr>
                        ))}
                        {!previewRows.length && (
                          <tr>
                            <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                              No preview rows yet. Generate a preview to see computed MER values.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <h2 className="text-sm font-semibold text-white">Submission Trend</h2>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={submissionChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="period" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip />
                        <Bar dataKey="indicators" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Period</th>
                      <th className="px-3 py-2 text-left font-medium">Org Unit</th>
                      <th className="px-3 py-2 text-right font-medium">Indicators</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950 text-slate-200">
                    {submissions.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2">{row.period}</td>
                        <td className="px-3 py-2">{row.orgUnitUid}</td>
                        <td className="px-3 py-2 text-right">{row.indicatorCount ?? 0}</td>
                        <td className="px-3 py-2">{row.status}</td>
                        <td className="px-3 py-2">{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                    {!submissions.length && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                          No DATIM submissions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'mappings' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <h2 className="text-sm font-semibold text-white">Add or Update Indicator Mapping</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    ['MER Indicator', mappingForm.merIndicator, 'merIndicator'],
                    ['Disaggregate', mappingForm.disaggregate, 'disaggregate'],
                    ['Data Element UID', mappingForm.datimDeUid, 'datimDeUid'],
                    ['Category Option Combo UID', mappingForm.datimCocUid, 'datimCocUid'],
                    ['Period Type', mappingForm.periodType, 'periodType'],
                    ['Notes', mappingForm.notes, 'notes'],
                  ].map(([label, value, key]) => (
                    <label key={key} className="space-y-1 text-xs text-slate-400">
                      <span>{label}</span>
                      <input
                        value={String(value)}
                        onChange={(event) => setMappingForm((current) => ({ ...current, [key]: event.target.value }))}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void handleUpsertMapping()}
                  className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                >
                  Save Mapping
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Indicator</th>
                      <th className="px-3 py-2 text-left font-medium">Disaggregate</th>
                      <th className="px-3 py-2 text-left font-medium">DE UID</th>
                      <th className="px-3 py-2 text-left font-medium">COC UID</th>
                      <th className="px-3 py-2 text-left font-medium">Period Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950 text-slate-200">
                    {mappings.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2">{row.merIndicator}</td>
                        <td className="px-3 py-2">{row.disaggregate}</td>
                        <td className="px-3 py-2">{row.datimDeUid}</td>
                        <td className="px-3 py-2">{row.datimCocUid}</td>
                        <td className="px-3 py-2">{row.periodType}</td>
                      </tr>
                    ))}
                    {!mappings.length && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                          No indicator mappings saved yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'aggregate' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-400">
                Select a clinical domain and reporting period, then push aggregate data to DHIS2.
                All 18 profiles are sourced directly from live EHR clinical data.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Profile</label>
                  <select
                    value={selectedProfile}
                    onChange={e => setSelectedProfile(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                  >
                    {aggregateProfiles.map(p => (
                      <option key={p.key} value={p.key}>{p.label} ({p.period})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Period (YYYYMM)</label>
                  <input
                    type="text"
                    value={aggregatePeriod}
                    onChange={e => setAggregatePeriod(e.target.value)}
                    placeholder="202605"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={sendAggregateReport}
                    disabled={aggregateLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {aggregateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send to DHIS2
                  </button>
                </div>
              </div>

              {aggregateResult && (
                <div className={`rounded-2xl border p-4 ${aggregateResult.status === 'ERROR' ? 'border-red-700/40 bg-red-900/20' : 'border-emerald-700/40 bg-emerald-900/20'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    {aggregateResult.status === 'ERROR'
                      ? <AlertTriangle className="h-4 w-4 text-red-400" />
                      : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    <span className={`text-sm font-bold ${aggregateResult.status === 'ERROR' ? 'text-red-300' : 'text-emerald-300'}`}>
                      {aggregateResult.status}
                    </span>
                    {aggregateResult.profile && <span className="text-xs text-slate-400">— {aggregateResult.profile}</span>}
                    {aggregateResult.period && <span className="text-xs text-slate-400">period {aggregateResult.period}</span>}
                  </div>
                  <p className="text-xs text-slate-300">{aggregateResult.message}</p>
                  {aggregateResult.dataValues != null && (
                    <p className="mt-1 text-xs text-slate-400">{aggregateResult.dataValues} data values submitted</p>
                  )}
                  {aggregateResult.imported != null && (
                    <p className="mt-1 text-xs text-slate-400">
                      Imported: {aggregateResult.imported} · Updated: {aggregateResult.updated ?? 0} · Ignored: {aggregateResult.ignored ?? 0}
                    </p>
                  )}
                  {aggregateResult.validation && (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Validation — {aggregateResult.validation.rulesChecked} rule{aggregateResult.validation.rulesChecked !== 1 ? 's' : ''} checked
                      </p>
                      {aggregateResult.validation.violations.length === 0 ? (
                        <p className="text-xs text-emerald-400">✓ All validation rules passed</p>
                      ) : (
                        <div className="space-y-1">
                          {aggregateResult.validation.violations.map((v: any, i: number) => (
                            <div key={i} className="rounded-lg border border-yellow-700/30 bg-yellow-900/20 px-3 py-2 text-xs">
                              <span className="font-semibold text-yellow-300">{v.ruleName}</span>
                              <span className="ml-2 text-yellow-200/70">{v.description}</span>
                              <span className="ml-2 text-slate-400">({v.leftValue} {v.operator.replace(/_/g,' ')} {v.rightValue})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">All Available Profiles</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {aggregateProfiles.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setSelectedProfile(p.key)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                        selectedProfile === p.key
                          ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
                          : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                      }`}
                    >
                      <span className="block font-semibold">{p.label}</span>
                      <span className="text-slate-500">{p.period} · {p.key}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'benchmarks' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Period (YYYYMM)</label>
                  <input
                    type="text"
                    value={benchmarkPeriod}
                    onChange={e => setBenchmarkPeriod(e.target.value)}
                    placeholder="202605"
                    className="w-48 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                  />
                </div>
                <button
                  onClick={loadBenchmarks}
                  disabled={benchmarkLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                >
                  {benchmarkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Pull from DHIS2
                </button>
                {benchmarkData?.mock && (
                  <span className="rounded-full border border-yellow-700/40 bg-yellow-900/20 px-3 py-1 text-xs text-yellow-300">
                    Mock mode — configure DHIS2 credentials for live data
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-400">
                This pulls your facility's key performance indicators directly from DHIS2 analytics.
                Values reflect data already submitted to DHIS2 — configure credentials to see live benchmarks.
              </p>

              {benchmarkLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                </div>
              )}

              {benchmarkData && !benchmarkLoading && (
                <>
                  {/* Org unit context */}
                  {(benchmarkData.districtOrgUnit || benchmarkData.nationalOrgUnit) && (
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {benchmarkData.facilityOrgUnit && <span>Facility: <span className="font-mono text-slate-400">{benchmarkData.facilityOrgUnit}</span></span>}
                      {benchmarkData.districtOrgUnit && <span>District: <span className="font-mono text-slate-400">{benchmarkData.districtOrgUnit}</span></span>}
                      {benchmarkData.nationalOrgUnit && <span>National: <span className="font-mono text-slate-400">{benchmarkData.nationalOrgUnit}</span></span>}
                    </div>
                  )}

                  {/* Column headers */}
                  <div className="hidden sm:grid grid-cols-4 gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    <span className="col-span-1">Indicator</span>
                    <span className="text-center">Facility</span>
                    <span className="text-center">District avg</span>
                    <span className="text-center">National avg</span>
                  </div>

                  <div className="space-y-2">
                    {benchmarkData.indicators.map(ind => {
                      const trendColor = ind.trend === 'above_district' ? 'text-emerald-400'
                        : ind.trend === 'below_district' ? 'text-red-400'
                        : ind.trend === 'at_par' ? 'text-yellow-400'
                        : 'text-slate-600';
                      const trendIcon = ind.trend === 'above_district' ? '▲'
                        : ind.trend === 'below_district' ? '▼'
                        : ind.trend === 'at_par' ? '≈'
                        : '—';
                      const trendLabel = ind.trend === 'above_district' ? 'Above district'
                        : ind.trend === 'below_district' ? 'Below district'
                        : ind.trend === 'at_par' ? 'At par'
                        : 'No benchmark';

                      return (
                        <div key={ind.dataElement} className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 items-center">
                          <div className="col-span-1">
                            <p className="text-xs font-semibold text-white">{ind.label}</p>
                            <p className="text-[10px] text-slate-600">{ind.unit}</p>
                          </div>
                          <div className="text-center">
                            {ind.facilityValue !== null ? (
                              <div>
                                <span className="text-xl font-black text-white">{ind.facilityValue.toLocaleString()}</span>
                                <span className={`ml-1.5 text-xs font-bold ${trendColor}`} title={trendLabel}>{trendIcon}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </div>
                          <div className="text-center">
                            {ind.districtAvg !== null ? (
                              <span className="text-sm font-semibold text-slate-300">{ind.districtAvg.toLocaleString()}</span>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </div>
                          <div className="text-center">
                            {ind.nationalAvg !== null ? (
                              <span className="text-sm font-semibold text-slate-400">{ind.nationalAvg.toLocaleString()}</span>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                    <span><span className="text-emerald-400 font-bold">▲</span> Above district average</span>
                    <span><span className="text-red-400 font-bold">▼</span> Below district average</span>
                    <span><span className="text-yellow-400 font-bold">≈</span> Within 5% of district average</span>
                    <span><span className="text-slate-600 font-bold">—</span> No benchmark data available</span>
                  </div>
                </>
              )}

              {!benchmarkData && !benchmarkLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                  <TrendingUp className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Click "Pull from DHIS2" to load your facility's performance indicators.</p>
                </div>
              )}
            </div>
          )}

          {tab === 'subscriptions' && (
            <div className="space-y-6">
              {/* Add / Edit form */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <h2 className="text-sm font-semibold text-white">Subscribe to Programme Indicator</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Enter a DHIS2 programme indicator code. The system will poll DHIS2 periodically and surface an alert when the value crosses your threshold.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    ['Indicator Code', subscriptionForm.indicatorCode, 'indicatorCode', 'e.g. TX_CURR_HIV'],
                    ['Indicator Name', subscriptionForm.indicatorName, 'indicatorName', 'Display name'],
                    ['Threshold Value', subscriptionForm.thresholdValue, 'thresholdValue', '0'],
                  ].map(([label, value, key, placeholder]) => (
                    <label key={key} className="space-y-1 text-xs text-slate-400">
                      <span>{label}</span>
                      <input
                        value={String(value)}
                        placeholder={placeholder}
                        onChange={(e) => setSubscriptionForm((s) => ({ ...s, [key]: e.target.value }))}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                      />
                    </label>
                  ))}
                  <label className="space-y-1 text-xs text-slate-400">
                    <span>Threshold Operator</span>
                    <select
                      value={subscriptionForm.thresholdOperator}
                      onChange={(e) => setSubscriptionForm((s) => ({ ...s, thresholdOperator: e.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                    >
                      <option value="above">Above</option>
                      <option value="below">Below</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="alertEnabled"
                    checked={subscriptionForm.alertEnabled}
                    onChange={(e) => setSubscriptionForm((s) => ({ ...s, alertEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="alertEnabled" className="text-xs text-slate-400">Alert enabled</label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleUpsertSubscription()}
                    className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                  >
                    Save Subscription
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCheckSubscriptions()}
                    disabled={checkLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:text-white disabled:opacity-50"
                  >
                    {checkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                    Check Now
                  </button>
                </div>
              </div>

              {/* Check results */}
              {checkResults.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">Latest Check Results</h3>
                  <div className="space-y-2">
                    {checkResults.map((r) => (
                      <div key={r.indicatorCode} className={`flex items-center justify-between rounded-xl border px-4 py-2 text-sm ${r.breached ? 'border-red-800 bg-red-950/30' : 'border-slate-800 bg-slate-900'}`}>
                        <span className="font-medium text-slate-200">{r.indicatorCode}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{r.value.toLocaleString()}</span>
                          {r.breached
                            ? <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="h-4 w-4" /> Threshold breached</span>
                            : <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Within threshold</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subscriptions list */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Indicator</th>
                      <th className="px-3 py-2 text-left font-medium">Threshold</th>
                      <th className="px-3 py-2 text-left font-medium">Last Value</th>
                      <th className="px-3 py-2 text-left font-medium">Last Checked</th>
                      <th className="px-3 py-2 text-left font-medium">Alerts</th>
                      <th className="px-3 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950 text-slate-200">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{sub.indicatorCode}</div>
                          <div className="text-xs text-slate-500">{sub.indicatorName}</div>
                        </td>
                        <td className="px-3 py-2">{sub.thresholdOperator} {sub.thresholdValue.toLocaleString()}</td>
                        <td className="px-3 py-2">{sub.lastValue !== null ? sub.lastValue.toLocaleString() : '—'}</td>
                        <td className="px-3 py-2">{sub.lastCheckedAt ? new Date(sub.lastCheckedAt).toLocaleString() : '—'}</td>
                        <td className="px-3 py-2">
                          {sub.alertEnabled
                            ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3 w-3" /> On</span>
                            : <span className="text-xs text-slate-500">Off</span>
                          }
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void handleDeleteSubscription(sub.id)}
                            className="rounded-lg p-1 text-slate-600 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!subscriptions.length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                          No subscriptions yet. Add one above to start monitoring DHIS2 programme indicators.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'extended_mer' && (
            <div className="space-y-6">
              {/* Period selector */}
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">Period:</span>
                <input
                  type="text"
                  value={extendedMerPeriod}
                  onChange={(e) => setExtendedMerPeriod(e.target.value)}
                  placeholder="e.g. 202606 or 2026Q2"
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-3 py-1.5 text-sm w-36"
                />
                <button
                  onClick={() => loadExtendedMer(extendedMerPeriod)}
                  disabled={extendedMerLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
                >
                  {extendedMerLoading ? 'Loading…' : 'Load'}
                </button>
              </div>

              {!extendedMerData && !extendedMerLoading && (
                <div className="text-slate-500 text-sm text-center py-12">
                  Select a period and click Load to view extended MER indicators.
                </div>
              )}

              {extendedMerData && (() => {
                const d = extendedMerData;
                const coverageBadge = (pct: number) => {
                  const color = pct >= 90 ? '#0AA98A' : pct >= 75 ? '#F0954A' : '#E8614D';
                  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '1px 7px', fontSize: 12, fontWeight: 600 }}>{pct.toFixed(1)}%</span>;
                };
                const tb = d.tbHiv;
                const pmtct = d.pmtct;
                const hts = d.htsSelf;
                const foTotal = pmtct.fo.hivFree + pmtct.fo.hivInfected + pmtct.fo.deceased + pmtct.fo.ltfu;
                return (
                  <div className="space-y-6">
                    {/* TB-HIV indicators */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-700">
                        <h3 className="text-slate-200 font-semibold text-sm uppercase tracking-wider">TB-HIV Indicators</h3>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left px-4 py-2 text-slate-400 font-medium">Indicator</th>
                            <th className="text-right px-4 py-2 text-slate-400 font-medium">Value</th>
                            <th className="text-right px-4 py-2 text-slate-400 font-medium">Denom</th>
                            <th className="text-right px-4 py-2 text-slate-400 font-medium">Coverage</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-700/50">
                            <td className="px-4 py-2.5 text-slate-200 font-medium">TX_TB</td>
                            <td className="px-4 py-2.5 text-right text-slate-300">{tb.txTb.total.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-slate-400">{tb.txTbD.total.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right">{coverageBadge(tb.coverage)}</td>
                          </tr>
                          <tr className="border-b border-slate-700/50">
                            <td className="px-4 py-2.5 text-slate-200 font-medium">TB_STAT</td>
                            <td className="px-4 py-2.5 text-right text-slate-300">{tb.tbStat.numerator.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-slate-400">{tb.tbStat.denominator.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right">{coverageBadge(tb.tbStat.coverage)}</td>
                          </tr>
                          <tr className="border-b border-slate-700/50">
                            <td className="px-4 py-2.5 text-slate-200 font-medium">TB_ART</td>
                            <td className="px-4 py-2.5 text-right text-slate-300">{tb.tbArt.total.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-slate-400">{tb.tbStat.numerator.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right">{coverageBadge(tb.tbArt.coverage)}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 text-slate-200 font-medium">TB_PREV</td>
                            <td className="px-4 py-2.5 text-right text-slate-300">{tb.tbPrev.total.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-slate-400">—</td>
                            <td className="px-4 py-2.5 text-right text-slate-500">—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* PMTCT indicators */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-700">
                        <h3 className="text-slate-200 font-semibold text-sm uppercase tracking-wider">PMTCT Indicators</h3>
                      </div>
                      <div className="px-4 py-4 grid grid-cols-2 gap-6">
                        <div>
                          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">PMTCT_EID</div>
                          <div className="text-slate-200 text-sm">Early (≤2 months): <span className="text-teal-400 font-semibold">{pmtct.eid.early}</span></div>
                          <div className="text-slate-200 text-sm mt-1">Late (2–12 months): <span className="text-teal-400 font-semibold">{pmtct.eid.late}</span></div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">PMTCT_FO</div>
                          <div className="text-slate-200 text-sm">HIV-free: <span className="text-teal-400 font-semibold">{pmtct.fo.hivFree}</span>{foTotal > 0 && <span className="text-slate-500 ml-1">({((pmtct.fo.hivFree / foTotal) * 100).toFixed(1)}%)</span>}</div>
                          <div className="text-slate-200 text-sm mt-0.5">HIV-infected: <span className="text-red-400 font-semibold">{pmtct.fo.hivInfected}</span></div>
                          <div className="text-slate-200 text-sm mt-0.5">Deceased: <span className="text-red-400 font-semibold">{pmtct.fo.deceased}</span> · LTFU: <span className="text-amber-400 font-semibold">{pmtct.fo.ltfu}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* HTS_SELF */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-4">
                      <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">HTS_SELF — Self-Tests Distributed</div>
                      <div className="flex items-center gap-6 flex-wrap">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-slate-100">{hts.total.toLocaleString()}</div>
                          <div className="text-slate-400 text-xs mt-0.5">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-semibold text-pink-400">{hts.female.toLocaleString()}</div>
                          <div className="text-slate-400 text-xs mt-0.5">Female {hts.total > 0 && `(${((hts.female / hts.total) * 100).toFixed(1)}%)`}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-semibold text-blue-400">{hts.male.toLocaleString()}</div>
                          <div className="text-slate-400 text-xs mt-0.5">Male {hts.total > 0 && `(${((hts.male / hts.total) * 100).toFixed(1)}%)`}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* S241 — Validation Feedback Loop */}
          {tab === 'validation' && (
            <div className="space-y-6 p-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Period (YYYYMM)</label>
                  <input
                    value={validationPeriod}
                    onChange={e => setValidationPeriod(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-sm w-28 text-white"
                    maxLength={6}
                  />
                </div>
                <button
                  onClick={loadValidation}
                  className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded text-sm"
                >
                  <Activity className="h-4 w-4" /> Load Report
                </button>
                <button
                  onClick={runValidation}
                  disabled={validationLoading}
                  className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
                >
                  <Activity className="h-4 w-4" /> {validationLoading ? 'Running…' : 'Run Validation Pull'}
                </button>
              </div>

              {validationReport && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Elements Checked', val: validationReport.total_checked, color: 'text-white' },
                      { label: 'OK', val: validationReport.ok, color: 'text-teal-400' },
                      { label: 'Warnings (>20%)', val: validationReport.warnings, color: 'text-yellow-400' },
                      { label: 'Critical (>50%)', val: validationReport.critical, color: 'text-red-400' },
                    ].map(c => (
                      <div key={c.label} className="bg-slate-800 rounded-lg p-4">
                        <div className="text-xs text-slate-400">{c.label}</div>
                        <div className={`text-2xl font-bold ${c.color}`}>{c.val ?? 0}</div>
                      </div>
                    ))}
                  </div>

                  {validationReport.outliers?.length > 0 ? (
                    <div className="bg-slate-800 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-slate-300 mb-3">Outlier Data Elements</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-slate-400 text-xs border-b border-slate-700">
                              <th className="text-left py-2 pr-4">Data Element</th>
                              <th className="text-right py-2 pr-4">DHIS2</th>
                              <th className="text-right py-2 pr-4">Local EHR</th>
                              <th className="text-right py-2 pr-4">Deviation</th>
                              <th className="text-left py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validationReport.outliers.map((o: any, i: number) => (
                              <tr key={i} className={`border-b border-slate-700/50 ${o.severity === 'critical' ? 'bg-red-900/20' : ''}`}>
                                <td className="py-2 pr-4 text-slate-200">{o.name}</td>
                                <td className="py-2 pr-4 text-right text-slate-300">{o.dhis2?.toLocaleString() ?? '—'}</td>
                                <td className="py-2 pr-4 text-right text-slate-300">{o.local?.toLocaleString() ?? '—'}</td>
                                <td className={`py-2 pr-4 text-right font-bold ${Math.abs(o.deviation_pct) > 50 ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {o.deviation_pct > 0 ? '+' : ''}{o.deviation_pct?.toFixed(1)}%
                                </td>
                                <td className="py-2">
                                  {o.severity === 'critical'
                                    ? <span className="text-red-400 text-xs font-semibold">CRITICAL</span>
                                    : <span className="text-yellow-400 text-xs">WARNING</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-800 rounded-lg p-8 text-center text-slate-400">
                      {validationReport.total_checked > 0
                        ? '✓ All data elements within acceptable deviation thresholds.'
                        : 'No validation data. Run a validation pull to compare DHIS2 vs local EHR values.'}
                    </div>
                  )}
                </>
              )}

              {!validationReport && !validationLoading && (
                <div className="bg-slate-800 rounded-lg p-8 text-center text-slate-400">
                  Click "Load Report" to view cached validation results, or "Run Validation Pull" to fetch fresh data from DHIS2.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dhis2DatimDashboard;
