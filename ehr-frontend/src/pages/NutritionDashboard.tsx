import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Package,
  RefreshCw,
  Scale,
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

type TabKey = 'assess' | 'registers' | 'dispensing' | 'reporting';
type RegisterTab = 'OTP' | 'SC' | 'TSFP';

interface AssessmentRow {
  id: string;
  patientId: string;
  assessmentDate: string;
  muacMm: number | null;
  weightKg: number | null;
  heightCm: number | null;
  whzScore: number | null;
  bilateralPittingOedema: boolean;
  oedemaGrade: string | null;
  classification: string;
  programType: string | null;
  admissionType: string | null;
  dischargeReason: string | null;
  dischargeDate: string | null;
  outcome: string | null;
  notes: string | null;
}

interface RutfRow {
  id: string;
  patientId: string;
  dispensedDate: string;
  productName: string;
  sachetsDispensed: number | null;
  weightKg: number | null;
  doseSachetsPerDay: number | null;
  lotNumber: string | null;
  expiryDate: string | null;
  nextVisitDate: string | null;
}

interface ReportData {
  period: string;
  totalAdmissions: number;
  samCount: number;
  mamCount: number;
  normalCount: number;
  recovered: number;
  defaulted: number;
  died: number;
  activeCases: number;
  coverage: number;
  outcomes: Record<string, number>;
}

interface ProtocolRecommendation {
  admission_criteria: string[];
  program: string;
  rutf_product: string;
  rutf_sachets_per_day: number | null;
  rutf_sachets_total: number | null;
  therapeutic_formula: string | null;
  therapeutic_volume_ml_per_feed: number | null;
  therapeutic_feeds_per_day: number | null;
  next_visit_days: number;
  danger_signs: string[];
  notes: string;
}

const authHeaders = (token: string, tenantSlug: string) => ({
  'X-Tenant-ID': tenantSlug,
  Authorization: `Bearer ${token}`,
});

const getToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonthIso = () => new Date().toISOString().slice(0, 7);
const firstDayOfMonth = () => `${currentMonthIso()}-01`;

const apiError = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const muacClassification = (muacMm?: string | number | null) => {
  const value = Number(muacMm);
  if (!Number.isFinite(value)) return null;
  if (value < 115) return 'SAM';
  if (value < 125) return 'MAM';
  return 'normal';
};

const classificationBadgeClass = (classification?: string | null) => {
  const value = String(classification || '').toUpperCase();
  if (value === 'SAM') return 'border-red-600/40 bg-red-500/10 text-red-200';
  if (value === 'MAM') return 'border-amber-600/40 bg-amber-500/10 text-amber-200';
  return 'border-emerald-600/40 bg-emerald-500/10 text-emerald-200';
};

const statusBadgeClass = (value?: string | null) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'recovered') return 'border-emerald-600/40 bg-emerald-500/10 text-emerald-200';
  if (normalized === 'defaulted') return 'border-amber-600/40 bg-amber-500/10 text-amber-200';
  if (normalized === 'died') return 'border-red-600/40 bg-red-500/10 text-red-200';
  return 'border-slate-700 bg-slate-800 text-slate-200';
};

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

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
    <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-300 hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const NutritionDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('assess');
  const [registerTab, setRegisterTab] = useState<RegisterTab>('OTP');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [muacPreviewVisible, setMuacPreviewVisible] = useState(false);

  const [assessForm, setAssessForm] = useState({
    patientId: '',
    assessmentDate: todayIso(),
    assessedBy: '',
    muacMm: '',
    weightKg: '',
    heightCm: '',
    bilateralPittingOedema: false,
    oedemaGrade: 'none',
    programType: 'OTP',
    admissionType: 'new',
    notes: '',
  });
  const [assessmentResult, setAssessmentResult] = useState<AssessmentRow | null>(null);
  const [protocolRecommendation, setProtocolRecommendation] = useState<ProtocolRecommendation | null>(null);
  const [pendingProtocolPayload, setPendingProtocolPayload] = useState<Record<string, any> | null>(null);
  const [ageModalOpen, setAgeModalOpen] = useState(false);
  const [ageMonthsInput, setAgeMonthsInput] = useState('');

  const [registerFilters, setRegisterFilters] = useState({
    from: firstDayOfMonth(),
    to: todayIso(),
    page: 1,
    limit: 20,
  });
  const [registerRows, setRegisterRows] = useState<AssessmentRow[]>([]);
  const [registerTotal, setRegisterTotal] = useState(0);
  const [dischargeModalOpen, setDischargeModalOpen] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [dischargeForm, setDischargeForm] = useState({
    dischargeReason: 'recovered',
    outcome: 'recovered',
  });

  const [dispensingForm, setDispensingForm] = useState({
    patientId: '',
    nutritionAssessmentId: '',
    dispensedDate: todayIso(),
    productName: 'Plumpy\'Nut',
    sachetsDispensed: '',
    weightKg: '',
    doseSachetsPerDay: '',
    lotNumber: '',
    expiryDate: '',
    nextVisitDate: '',
  });
  const [historyPatientId, setHistoryPatientId] = useState('');
  const [rutfHistory, setRutfHistory] = useState<RutfRow[]>([]);

  const [reportPeriod, setReportPeriod] = useState(currentMonthIso());
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const currentUser = useMemo(() => {
    const raw = localStorage.getItem('ehr_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (currentUser?.id || currentUser?.sub) {
      setAssessForm((prev) => ({
        ...prev,
        assessedBy: prev.assessedBy || currentUser.id || currentUser.sub,
      }));
    }
  }, [currentUser]);

  const requestConfig = useMemo(() => {
    if (!tenantSlug) return null;
    return { headers: authHeaders(getToken(), tenantSlug) };
  }, [tenantSlug]);

  const loadRegister = useCallback(async () => {
    if (!requestConfig) return;
    const endpoint =
      registerTab === 'OTP'
        ? '/nutrition/cmam/otp-register'
        : registerTab === 'SC'
          ? '/nutrition/cmam/sc-register'
          : '/nutrition/cmam/tsfp-register';

    const res = await ehrAxios.get(endpoint, {
      ...requestConfig,
      params: registerFilters,
    });

    setRegisterRows(res.data.data ?? []);
    setRegisterTotal(res.data.total ?? 0);
  }, [registerFilters, registerTab, requestConfig]);

  const loadReport = useCallback(async () => {
    if (!requestConfig) return;
    const res = await ehrAxios.get('/nutrition/cmam/reporting', {
      ...requestConfig,
      params: { period: reportPeriod },
    });
    setReportData(res.data);
  }, [reportPeriod, requestConfig]);

  const loadRutfHistory = useCallback(async (patientId: string) => {
    if (!requestConfig || !patientId) return;
    const res = await ehrAxios.get(`/nutrition/rutf/${patientId}`, requestConfig);
    setRutfHistory(res.data ?? []);
    setHistoryPatientId(patientId);
  }, [requestConfig]);

  useEffect(() => {
    if (tab !== 'registers') return;
    loadRegister().catch((error: any) => {
      showError('CMAM registers', apiError(error, 'Failed to load CMAM register'));
    });
  }, [loadRegister, showError, tab]);

  useEffect(() => {
    if (tab !== 'reporting') return;
    loadReport().catch((error: any) => {
      showError('CMAM reporting', apiError(error, 'Failed to load CMAM report'));
    });
  }, [loadReport, showError, tab]);

  const refreshActiveTab = async () => {
    if (!requestConfig) return;
    setRefreshing(true);
    try {
      if (tab === 'registers') {
        await loadRegister();
      } else if (tab === 'reporting') {
        await loadReport();
      } else if (tab === 'dispensing' && historyPatientId) {
        await loadRutfHistory(historyPatientId);
      }
      showSuccess('Refreshed', 'Nutrition dashboard data has been refreshed.');
    } catch (error: any) {
      showError('Refresh', apiError(error, 'Failed to refresh nutrition data'));
    } finally {
      setRefreshing(false);
    }
  };

  const runProtocolRecommendation = async (payload: Record<string, any>) => {
    if (!requestConfig) return;
    const res = await ehrAxios.post('/cdss/nutrition/cmam-protocol', payload, requestConfig);
    setProtocolRecommendation(res.data);
  };

  const submitAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestConfig) return;
    if (!assessForm.patientId) {
      showError('Validation', 'Patient ID is required.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        patientId: assessForm.patientId,
        assessmentDate: assessForm.assessmentDate,
        assessedBy: assessForm.assessedBy || undefined,
        muacMm: assessForm.muacMm ? Number(assessForm.muacMm) : undefined,
        weightKg: assessForm.weightKg ? Number(assessForm.weightKg) : undefined,
        heightCm: assessForm.heightCm ? Number(assessForm.heightCm) : undefined,
        bilateralPittingOedema: assessForm.bilateralPittingOedema,
        oedemaGrade: assessForm.oedemaGrade,
        programType: assessForm.programType || undefined,
        admissionType: assessForm.admissionType || undefined,
        notes: assessForm.notes || undefined,
      };

      const res = await ehrAxios.post('/nutrition/assess', payload, requestConfig);
      const assessment = res.data as AssessmentRow;
      setAssessmentResult(assessment);
      setProtocolRecommendation(null);

      const protocolPayload = {
        classification: assessment.classification,
        oedema_grade: assessment.oedemaGrade,
        weight_kg: assessment.weightKg,
      };
      setPendingProtocolPayload(protocolPayload);
      setAgeMonthsInput('');
      setAgeModalOpen(true);

      showSuccess('Assessment saved', 'Nutrition assessment saved successfully.');
    } catch (error: any) {
      showError('Assessment', apiError(error, 'Failed to save nutrition assessment'));
    } finally {
      setLoading(false);
    }
  };

  const submitAgePrompt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingProtocolPayload) return;

    setLoading(true);
    try {
      const ageMonths = ageMonthsInput ? Number(ageMonthsInput) : null;
      await runProtocolRecommendation({
        ...pendingProtocolPayload,
        age_months: ageMonths,
      });
      setAgeModalOpen(false);
      setPendingProtocolPayload(null);
      showSuccess('CDSS recommendation', 'CMAM protocol recommendation generated successfully.');
    } catch (error: any) {
      showError('CMAM protocol', apiError(error, 'Failed to load CMAM protocol recommendation'));
    } finally {
      setLoading(false);
    }
  };

  const submitDischarge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestConfig || !selectedAssessmentId) return;

    setLoading(true);
    try {
      await ehrAxios.patch(
        `/nutrition/assess/${selectedAssessmentId}`,
        dischargeForm,
        requestConfig,
      );
      setDischargeModalOpen(false);
      setSelectedAssessmentId(null);
      await loadRegister();
      showSuccess('Discharge saved', 'Register outcome updated successfully.');
    } catch (error: any) {
      showError('Discharge', apiError(error, 'Failed to update discharge outcome'));
    } finally {
      setLoading(false);
    }
  };

  const submitDispensing = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestConfig) return;
    if (!dispensingForm.patientId) {
      showError('Validation', 'Patient ID is required for dispensing.');
      return;
    }

    setLoading(true);
    try {
      await ehrAxios.post(
        '/nutrition/rutf/dispense',
        {
          patientId: dispensingForm.patientId,
          nutritionAssessmentId: dispensingForm.nutritionAssessmentId || undefined,
          dispensedDate: dispensingForm.dispensedDate,
          productName: dispensingForm.productName,
          sachetsDispensed: dispensingForm.sachetsDispensed ? Number(dispensingForm.sachetsDispensed) : undefined,
          weightKg: dispensingForm.weightKg ? Number(dispensingForm.weightKg) : undefined,
          doseSachetsPerDay: dispensingForm.doseSachetsPerDay ? Number(dispensingForm.doseSachetsPerDay) : undefined,
          lotNumber: dispensingForm.lotNumber || undefined,
          expiryDate: dispensingForm.expiryDate || undefined,
          nextVisitDate: dispensingForm.nextVisitDate || undefined,
        },
        requestConfig,
      );

      await loadRutfHistory(dispensingForm.patientId);
      showSuccess('Dispensing saved', 'RUTF dispensing record saved successfully.');
    } catch (error: any) {
      showError('Dispensing', apiError(error, 'Failed to save dispensing record'));
    } finally {
      setLoading(false);
    }
  };

  const reportChartData = useMemo(() => {
    if (!reportData) return [];
    return [
      { name: 'Recovered', total: reportData.recovered },
      { name: 'Defaulted', total: reportData.defaulted },
      { name: 'Died', total: reportData.died },
      { name: 'Active', total: reportData.activeCases },
    ];
  }, [reportData]);

  const muacPreview = muacClassification(assessForm.muacMm);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/60 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </button>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-300">S133 Nutrition</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">SAM / CMAM Nutrition Programs</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Assess acute malnutrition, manage OTP/SC/TSFP registers, document RUTF dispensing,
                  and generate rule-based CMAM protocol recommendations in one workflow.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshActiveTab}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-700 hover:text-white disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === 'assess'} icon={<Scale className="h-4 w-4" />} label="Assess" onClick={() => setTab('assess')} />
          <TabButton active={tab === 'registers'} icon={<ClipboardList className="h-4 w-4" />} label="Registers" onClick={() => setTab('registers')} />
          <TabButton active={tab === 'dispensing'} icon={<Package className="h-4 w-4" />} label="Dispensing" onClick={() => setTab('dispensing')} />
          <TabButton active={tab === 'reporting'} icon={<BarChart3 className="h-4 w-4" />} label="Reporting" onClick={() => setTab('reporting')} />
        </div>

        {tab === 'assess' && (
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-200">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Assessment</h2>
                  <p className="text-sm text-slate-400">Capture MUAC, WHZ inputs, oedema, and program admission details.</p>
                </div>
              </div>

              <form className="space-y-4" onSubmit={submitAssessment}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Patient ID</span>
                    <input
                      value={assessForm.patientId}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, patientId: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Assessment Date</span>
                    <input
                      type="date"
                      value={assessForm.assessmentDate}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, assessmentDate: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Assessed By</span>
                    <input
                      value={assessForm.assessedBy}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, assessedBy: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>MUAC (mm)</span>
                    <input
                      type="number"
                      value={assessForm.muacMm}
                      onBlur={() => setMuacPreviewVisible(true)}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, muacMm: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    />
                    {muacPreviewVisible && muacPreview && (
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classificationBadgeClass(muacPreview)}`}>
                        MUAC preview: {muacPreview}
                      </span>
                    )}
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Weight (kg)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={assessForm.weightKg}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, weightKg: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Height (cm)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={assessForm.heightCm}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, heightCm: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Oedema Grade</span>
                    <select
                      value={assessForm.oedemaGrade}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, oedemaGrade: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    >
                      <option value="none">none</option>
                      <option value="+">+</option>
                      <option value="++">++</option>
                      <option value="+++">+++</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Program Type</span>
                    <select
                      value={assessForm.programType}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, programType: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    >
                      <option value="OTP">OTP</option>
                      <option value="SC">SC</option>
                      <option value="TSFP">TSFP</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Admission Type</span>
                    <select
                      value={assessForm.admissionType}
                      onChange={(event) => setAssessForm((prev) => ({ ...prev, admissionType: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                    >
                      <option value="new">new</option>
                      <option value="readmission">readmission</option>
                      <option value="relapsed">relapsed</option>
                      <option value="transfer_in">transfer_in</option>
                    </select>
                  </label>
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={assessForm.bilateralPittingOedema}
                    onChange={(event) =>
                      setAssessForm((prev) => ({ ...prev, bilateralPittingOedema: event.target.checked }))
                    }
                  />
                  Bilateral pitting oedema present
                </label>

                <label className="space-y-2 text-sm text-slate-300">
                  <span>Notes</span>
                  <textarea
                    rows={4}
                    value={assessForm.notes}
                    onChange={(event) => setAssessForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-600"
                  />
                </label>

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                    Save Assessment
                  </button>
                </div>
              </form>
            </section>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-200">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Assessment Result</h2>
                    <p className="text-sm text-slate-400">Classification and program outcome from the saved assessment.</p>
                  </div>
                </div>

                {assessmentResult ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <StatCard
                        label="Classification"
                        value={assessmentResult.classification}
                        icon={<AlertTriangle className="h-5 w-5 text-white" />}
                        tone="bg-red-500/20 text-red-200"
                      />
                      <StatCard
                        label="Program"
                        value={assessmentResult.programType || 'community'}
                        icon={<Activity className="h-5 w-5 text-white" />}
                        tone="bg-cyan-500/20 text-cyan-200"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                      <div className="grid gap-2 md:grid-cols-2">
                        <p>Patient: <span className="text-white">{assessmentResult.patientId}</span></p>
                        <p>Date: <span className="text-white">{assessmentResult.assessmentDate}</span></p>
                        <p>MUAC: <span className="text-white">{assessmentResult.muacMm ?? 'n/a'}</span></p>
                        <p>WHZ: <span className="text-white">{assessmentResult.whzScore ?? 'n/a'}</span></p>
                        <p>Oedema: <span className="text-white">{assessmentResult.oedemaGrade || 'none'}</span></p>
                        <p>Outcome: <span className="text-white">{assessmentResult.outcome || 'active'}</span></p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No assessment saved yet in this session.</p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-amber-500/10 p-3 text-amber-200">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">CMAM CDSS Recommendation</h2>
                    <p className="text-sm text-slate-400">Rule-based IMAM pathway guidance from the CDSS service.</p>
                  </div>
                </div>

                {protocolRecommendation ? (
                  <div className="space-y-4 text-sm text-slate-300">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-600/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
                        Program: {protocolRecommendation.program}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200">
                        Next visit: {protocolRecommendation.next_visit_days} day(s)
                      </span>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <p>RUTF product: <span className="text-white">{protocolRecommendation.rutf_product}</span></p>
                      <p>Sachets/day: <span className="text-white">{protocolRecommendation.rutf_sachets_per_day ?? 'n/a'}</span></p>
                      <p>8-week total: <span className="text-white">{protocolRecommendation.rutf_sachets_total ?? 'n/a'}</span></p>
                      <p>Therapeutic formula: <span className="text-white">{protocolRecommendation.therapeutic_formula ?? 'n/a'}</span></p>
                    </div>
                    <div>
                      <h3 className="mb-2 font-medium text-white">Admission criteria</h3>
                      <ul className="space-y-2">
                        {protocolRecommendation.admission_criteria.map((item) => (
                          <li key={item} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="mb-2 font-medium text-white">Danger signs</h3>
                      <ul className="space-y-2">
                        {protocolRecommendation.danger_signs.map((item) => (
                          <li key={item} className="rounded-xl border border-red-700/40 bg-red-500/5 px-3 py-2 text-red-100">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-300">
                      {protocolRecommendation.notes}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Save an assessment, then complete the age prompt to load the CMAM protocol recommendation.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}

        {tab === 'registers' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex flex-wrap gap-2">
                {(['OTP', 'SC', 'TSFP'] as RegisterTab[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRegisterTab(item)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                      registerTab === item
                        ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <input
                  type="date"
                  value={registerFilters.from}
                  onChange={(event) => setRegisterFilters((prev) => ({ ...prev, from: event.target.value, page: 1 }))}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  type="date"
                  value={registerFilters.to}
                  onChange={(event) => setRegisterFilters((prev) => ({ ...prev, to: event.target.value, page: 1 }))}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  type="number"
                  min="1"
                  value={registerFilters.page}
                  onChange={(event) => setRegisterFilters((prev) => ({ ...prev, page: Number(event.target.value) || 1 }))}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={registerFilters.limit}
                  onChange={(event) => setRegisterFilters((prev) => ({ ...prev, limit: Number(event.target.value) || 20, page: 1 }))}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{registerTab} Register</h2>
                  <p className="text-sm text-slate-400">Active cases only. Total loaded: {registerRows.length} / {registerTotal}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="px-3 py-2 font-medium">Patient</th>
                      <th className="px-3 py-2 font-medium">Assessment Date</th>
                      <th className="px-3 py-2 font-medium">Classification</th>
                      <th className="px-3 py-2 font-medium">Admission Type</th>
                      <th className="px-3 py-2 font-medium">MUAC</th>
                      <th className="px-3 py-2 font-medium">Weight</th>
                      <th className="px-3 py-2 font-medium">Oedema</th>
                      <th className="px-3 py-2 font-medium">Outcome</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {registerRows.map((row) => (
                      <tr key={row.id} className="text-slate-200">
                        <td className="px-3 py-3">{row.patientId}</td>
                        <td className="px-3 py-3">{row.assessmentDate}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classificationBadgeClass(row.classification)}`}>
                            {row.classification}
                          </span>
                        </td>
                        <td className="px-3 py-3">{row.admissionType || 'n/a'}</td>
                        <td className="px-3 py-3">{row.muacMm ?? 'n/a'}</td>
                        <td className="px-3 py-3">{row.weightKg ?? 'n/a'}</td>
                        <td className="px-3 py-3">{row.oedemaGrade || 'none'}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(row.outcome)}`}>
                            {row.outcome || 'active'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssessmentId(row.id);
                              setDischargeForm({ dischargeReason: 'recovered', outcome: 'recovered' });
                              setDischargeModalOpen(true);
                            }}
                            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white"
                          >
                            Discharge
                          </button>
                        </td>
                      </tr>
                    ))}
                    {registerRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                          No active cases found for this register and date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'dispensing' && (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-200">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">RUTF Dispensing</h2>
                  <p className="text-sm text-slate-400">Capture sachets dispensed, lot tracking, and next visit scheduling.</p>
                </div>
              </div>

              <form className="space-y-4" onSubmit={submitDispensing}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Patient ID</span>
                    <input
                      value={dispensingForm.patientId}
                      onChange={(event) => setDispensingForm((prev) => ({ ...prev, patientId: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Nutrition Assessment ID</span>
                    <input
                      value={dispensingForm.nutritionAssessmentId}
                      onChange={(event) =>
                        setDispensingForm((prev) => ({ ...prev, nutritionAssessmentId: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Dispensed Date</span>
                    <input
                      type="date"
                      value={dispensingForm.dispensedDate}
                      onChange={(event) => setDispensingForm((prev) => ({ ...prev, dispensedDate: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Product Name</span>
                    <select
                      value={dispensingForm.productName}
                      onChange={(event) => setDispensingForm((prev) => ({ ...prev, productName: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    >
                      <option value="Plumpy'Nut">Plumpy'Nut</option>
                      <option value="BP-100">BP-100</option>
                      <option value="F75">F75</option>
                      <option value="F100">F100</option>
                      <option value="RUSF">RUSF</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Sachets Dispensed</span>
                    <input
                      type="number"
                      value={dispensingForm.sachetsDispensed}
                      onChange={(event) => setDispensingForm((prev) => ({ ...prev, sachetsDispensed: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Weight (kg)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={dispensingForm.weightKg}
                      onChange={(event) => setDispensingForm((prev) => ({ ...prev, weightKg: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Dose Sachets / Day</span>
                    <input
                      type="number"
                      value={dispensingForm.doseSachetsPerDay}
                      onChange={(event) =>
                        setDispensingForm((prev) => ({ ...prev, doseSachetsPerDay: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Lot Number</span>
                    <input
                      value={dispensingForm.lotNumber}
                      onChange={(event) => setDispensingForm((prev) => ({ ...prev, lotNumber: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Expiry Date</span>
                    <input
                      type="date"
                      value={dispensingForm.expiryDate}
                      onChange={(event) => setDispensingForm((prev) => ({ ...prev, expiryDate: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Next Visit Date</span>
                    <input
                      type="date"
                      value={dispensingForm.nextVisitDate}
                      onChange={(event) => setDispensingForm((prev) => ({ ...prev, nextVisitDate: event.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                    Save Dispensing
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Dispensing History</h2>
                  <p className="text-sm text-slate-400">Load a patient’s prior dispensing records below.</p>
                </div>
              </div>

              <div className="mb-4 flex gap-3">
                <input
                  value={historyPatientId}
                  onChange={(event) => setHistoryPatientId(event.target.value)}
                  placeholder="Patient ID"
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!historyPatientId) {
                      showError('Validation', 'Enter a patient ID to load dispensing history.');
                      return;
                    }
                    loadRutfHistory(historyPatientId).catch((error: any) => {
                      showError('History', apiError(error, 'Failed to load dispensing history'));
                    });
                  }}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:text-white"
                >
                  Load History
                </button>
              </div>

              <div className="space-y-3">
                {rutfHistory.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    <div className="grid gap-2 md:grid-cols-2">
                      <p>Patient: <span className="text-white">{row.patientId}</span></p>
                      <p>Date: <span className="text-white">{row.dispensedDate}</span></p>
                      <p>Product: <span className="text-white">{row.productName}</span></p>
                      <p>Sachets: <span className="text-white">{row.sachetsDispensed ?? 'n/a'}</span></p>
                      <p>Lot: <span className="text-white">{row.lotNumber || 'n/a'}</span></p>
                      <p>Expiry: <span className="text-white">{row.expiryDate || 'n/a'}</span></p>
                      <p>Next visit: <span className="text-white">{row.nextVisitDate || 'n/a'}</span></p>
                      <p>Dose/day: <span className="text-white">{row.doseSachetsPerDay ?? 'n/a'}</span></p>
                    </div>
                  </div>
                ))}
                {rutfHistory.length === 0 && (
                  <p className="text-sm text-slate-400">No dispensing history loaded yet.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {tab === 'reporting' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div>
                <h2 className="text-lg font-semibold text-white">CMAM Reporting</h2>
                <p className="text-sm text-slate-400">Monthly admissions, outcomes, and active case summary.</p>
              </div>
              <input
                type="month"
                value={reportPeriod}
                onChange={(event) => setReportPeriod(event.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Admissions" value={reportData?.totalAdmissions ?? 0} icon={<ClipboardList className="h-5 w-5 text-white" />} tone="bg-cyan-500/20 text-cyan-200" />
              <StatCard label="SAM" value={reportData?.samCount ?? 0} icon={<AlertTriangle className="h-5 w-5 text-white" />} tone="bg-red-500/20 text-red-200" />
              <StatCard label="MAM" value={reportData?.mamCount ?? 0} icon={<Scale className="h-5 w-5 text-white" />} tone="bg-amber-500/20 text-amber-200" />
              <StatCard label="Active Cases" value={reportData?.activeCases ?? 0} icon={<Activity className="h-5 w-5 text-white" />} tone="bg-emerald-500/20 text-emerald-200" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-200">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Outcomes Breakdown</h3>
                    <p className="text-sm text-slate-400">Recovered, defaulted, died, and active cases for the selected month.</p>
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#22d3ee" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-amber-500/10 p-3 text-amber-200">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Summary</h3>
                    <p className="text-sm text-slate-400">High-level monthly CMAM indicators.</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p>Recovered: <span className="text-white">{reportData?.recovered ?? 0}</span></p>
                    <p>Defaulted: <span className="text-white">{reportData?.defaulted ?? 0}</span></p>
                    <p>Died: <span className="text-white">{reportData?.died ?? 0}</span></p>
                    <p>Coverage: <span className="text-white">{reportData?.coverage ?? 0}</span></p>
                  </div>

                  {reportData?.outcomes && Object.keys(reportData.outcomes).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(reportData.outcomes).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                          <span className="capitalize text-slate-300">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">No reporting data loaded for this period yet.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      {ageModalOpen && (
        <ModalShell title="Age In Months" onClose={() => setAgeModalOpen(false)}>
          <form className="space-y-4" onSubmit={submitAgePrompt}>
            <p className="text-sm text-slate-300">
              Enter age in months to complete the CMAM protocol recommendation. Leave blank if the age is not currently known.
            </p>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Age (months)</span>
              <input
                type="number"
                min="0"
                value={ageMonthsInput}
                onChange={(event) => setAgeMonthsInput(event.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAgeModalOpen(false)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:text-white"
              >
                Skip
              </button>
              <button
                type="submit"
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
              >
                Generate Recommendation
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {dischargeModalOpen && (
        <ModalShell title="Discharge Register Case" onClose={() => setDischargeModalOpen(false)}>
          <form className="space-y-4" onSubmit={submitDischarge}>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Discharge Reason</span>
              <select
                value={dischargeForm.dischargeReason}
                onChange={(event) => setDischargeForm((prev) => ({ ...prev, dischargeReason: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="recovered">recovered</option>
                <option value="defaulted">defaulted</option>
                <option value="non_responder">non_responder</option>
                <option value="transfer_out">transfer_out</option>
                <option value="died">died</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Outcome</span>
              <select
                value={dischargeForm.outcome}
                onChange={(event) => setDischargeForm((prev) => ({ ...prev, outcome: event.target.value }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="recovered">recovered</option>
                <option value="defaulted">defaulted</option>
                <option value="died">died</option>
                <option value="transferred_out">transferred_out</option>
              </select>
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
              >
                Save Discharge
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};

export default NutritionDashboard;
