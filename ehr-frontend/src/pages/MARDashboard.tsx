import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Scan, Loader2, ArrowLeft, Brain, Search, BookOpen, ShieldAlert, ClipboardList } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { cdssApi, ehrAxios } from '../services/api';
import MedicationScannerModal from '../components/MedicationScannerModal';
import ModuleGeneralReportCard from '../components/ModuleGeneralReportCard';

interface MARDashboardProps {
  embedded?: boolean;
}

const MARDashboard: React.FC<MARDashboardProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [marRecords, setMarRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedMarForScan, setSelectedMarForScan] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [statusActionMarId, setStatusActionMarId] = useState<string | null>(null);
  const [escalatingMarId, setEscalatingMarId] = useState<string | null>(null);
  const [worklistSummary, setWorklistSummary] = useState<any>(null);
  const [medicationWorklist, setMedicationWorklist] = useState<any[]>([]);
  const [worklistLoading, setWorklistLoading] = useState(false);
  const [handoffBrief, setHandoffBrief] = useState<any>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [worklistFocus, setWorklistFocus] = useState<'all' | 'overdue' | 'high-risk' | 'alerts' | 'exceptions' | 'documentation'>('all');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const isDoctor = user?.role === 'doctor';

  useEffect(() => {
    loadAdmittedPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadMARs();
      loadActiveAlerts();
    } else {
      setActiveAlerts([]);
    }
  }, [selectedPatient, selectedDate]);

  useEffect(() => {
    if (!token || !tenantSlug) return;
    loadMedicationSafetyWorklist();
  }, [selectedDate, worklistFocus, includeCompleted, token, tenantSlug, user?.role]);

  useEffect(() => {
    if (!token || !tenantSlug || !isDoctor) {
      setHandoffBrief(null);
      return;
    }
    loadMedicationSafetyHandoffBrief();
  }, [selectedDate, token, tenantSlug, isDoctor]);

  const resolveSelectedPatientId = () => {
    return selectedPatient?.patientId || selectedPatient?.patient_id || null;
  };

  const loadAdmittedPatients = async () => {
    try {
      const response = await ehrAxios.get('/beds/admissions', {
        params: { active: true },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setPatients(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedPatient(response.data[0]);
      }
    } catch (error) {
      showError('Error', 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const loadMARs = async () => {
    if (!selectedPatient) return;

    // Handle both camelCase and snake_case patient ID
    const patientId = resolveSelectedPatientId();
    if (!patientId) {
      console.warn('No patient ID found in selectedPatient:', selectedPatient);
      return;
    }

    try {
      const response = await ehrAxios.get(`/bcma/mar/patient/${patientId}`, {
        params: { date: selectedDate },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      const normalized = (response.data || []).map((row: any) => ({
        ...row,
        administrationStatus: row.administrationStatus || row.administration_status || 'pending',
        scheduledTime: row.scheduledTime || row.scheduled_time || null,
        actualAdministrationTime: row.actualAdministrationTime || row.actual_administration_time || null,
        medicationName: row.medicationName || row.medication_name || 'Medication',
        refusalReason: row.refusalReason || row.refusal_reason || null,
        omissionReason: row.omissionReason || row.omission_reason || null,
        route: row.route || 'oral',
        dose: row.dose || '',
        unit: row.unit || '',
        administeredBy:
          row.administeredBy ||
          (row.administered_by_first_name || row.administered_by_last_name
            ? {
                firstName: row.administered_by_first_name || '',
                lastName: row.administered_by_last_name || '',
              }
            : null),
      }));
      setMarRecords(normalized);
    } catch (error) {
      // Silent fail - might be no MARs
      console.error('Error loading MARs:', error);
    }
  };

  const loadActiveAlerts = async () => {
    const patientId = resolveSelectedPatientId();
    if (!patientId) return;

    try {
      const response = await ehrAxios.get(`/bcma/alerts/patient/${patientId}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setActiveAlerts(response.data || []);
    } catch {
      setActiveAlerts([]);
    }
  };

  const loadMedicationSafetyWorklist = async () => {
    if (!token || !tenantSlug) return;
    try {
      setWorklistLoading(true);
      const response = await ehrAxios.get('/bcma/mar/worklist', {
        params: {
          date: selectedDate,
          focus: worklistFocus,
          includeCompleted,
          limit: 120,
        },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setWorklistSummary(response.data?.summary || null);
      setMedicationWorklist(response.data?.items || []);
    } catch {
      setWorklistSummary(null);
      setMedicationWorklist([]);
    } finally {
      setWorklistLoading(false);
    }
  };

  const loadMedicationSafetyHandoffBrief = async () => {
    if (!token || !tenantSlug || !isDoctor) return;
    try {
      setHandoffLoading(true);
      const response = await ehrAxios.get('/bcma/mar/handoff-brief', {
        params: {
          date: selectedDate,
        },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setHandoffBrief(response.data || null);
    } catch {
      setHandoffBrief(null);
    } finally {
      setHandoffLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alert: any) => {
    const reason = window.prompt('Provide override reason to acknowledge this alert:');
    if (reason === null) return;
    if (!reason.trim()) {
      showError('Override reason required', 'Please provide a reason to acknowledge this alert.');
      return;
    }

    try {
      setAcknowledgingAlertId(alert.id);
      await ehrAxios.post(
        `/bcma/alerts/${alert.id}/acknowledge`,
        { overrideReason: reason.trim() },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Alert acknowledged', 'The medication alert has been acknowledged.');
      loadActiveAlerts();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to acknowledge alert');
    } finally {
      setAcknowledgingAlertId(null);
    }
  };

  const handleStatusAction = async (mar: any, action: 'hold' | 'refuse') => {
    const reason = window.prompt(
      action === 'hold'
        ? 'Provide hold reason for this medication:'
        : 'Provide refusal reason documented by patient:',
    );

    if (reason === null) return;
    if (!reason.trim()) {
      showError('Reason required', 'Please provide a reason before continuing.');
      return;
    }

    try {
      setStatusActionMarId(mar.id);
      await ehrAxios.post(
        `/bcma/mar/${mar.id}/${action}`,
        { reason: reason.trim() },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess(
        action === 'hold' ? 'Medication held' : 'Refusal documented',
        action === 'hold' ? 'Medication was marked as held.' : 'Patient refusal has been recorded.',
      );
      loadMARs();
      loadActiveAlerts();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to update medication status');
    } finally {
      setStatusActionMarId(null);
    }
  };

  const handleEscalateRisk = async (worklistItem: any) => {
    const message = window.prompt('Escalation note (why this requires immediate attention):', '');
    if (message === null) return;
    try {
      setEscalatingMarId(worklistItem.id);
      await ehrAxios.post(
        `/bcma/mar/${worklistItem.id}/escalate`,
        {
          severity: worklistItem.priority === 'critical' ? 'critical' : 'high',
          alertType: 'doctor_mar_risk_escalation',
          message: message.trim() || `Doctor escalated MAR risk for ${worklistItem.medicationName}`,
          details: {
            riskScore: worklistItem.riskScore,
            overdueMinutes: worklistItem.overdueMinutes,
            openAlertCount: worklistItem.openAlertCount,
          },
        },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Escalated', 'Medication safety alert escalation created.');
      loadMedicationSafetyWorklist();
      if (resolveSelectedPatientId() === worklistItem.patientId) {
        loadActiveAlerts();
      }
    } catch (error: any) {
      showError('Error', error?.response?.data?.message || 'Failed to escalate MAR risk');
    } finally {
      setEscalatingMarId(null);
    }
  };

  const focusPatientFromWorklist = (worklistItem: any) => {
    const match = patients.find(
      (patient) =>
        patient.id === worklistItem.patientId ||
        patient.patient_id === worklistItem.patientId,
    );
    if (match) {
      setSelectedPatient(match);
      return;
    }
    setSelectedPatient({
      id: worklistItem.patientId,
      patient_id: worklistItem.patientId,
      patient_first_name: worklistItem.patientName?.split(' ')?.[0] || '',
      patient_last_name: worklistItem.patientName?.split(' ')?.slice(1).join(' ') || '',
    });
  };

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim() || !tenantSlug || !token) return;
    try {
      setLoadingGuidelines(true);
      const response = await cdssApi.searchGuidelines(
        guidelineQuery,
        token,
        tenantSlug,
        6,
        { module: 'mar', role: user?.role || 'doctor' },
      );
      setGuidelineResults(response.data?.citations || []);
    } catch (error: any) {
      showError('Error', error?.response?.data?.message || 'Failed to search medication safety guidance');
      setGuidelineResults([]);
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'administered': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'held': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'refused': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'administered': return 'bg-green-100 text-green-800 border-green-300';
      case 'held': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'refused': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-12' : 'min-h-screen'}`}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading MAR...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {!embedded && (
        <div className="bg-gradient-to-r from-blue-600 to-cyan-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/${user?.role === 'doctor' ? 'doctor' : user?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Scan className="w-8 h-8" />
                    Medication Administration Record (MAR)
                  </h1>
                  <p className="text-blue-100 mt-1">Barcode medication safety system</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${embedded ? 'pb-4' : 'pt-8 pb-8'}`}>
        <div className="mb-6">
          <ModuleGeneralReportCard
            moduleKey="mar"
            title="Medication Administration"
            tenantSlug={tenantSlug || ''}
            token={token}
            accentClass="from-cyan-50 via-white to-blue-50"
          />
        </div>

        {isDoctor && (
          <div className="mb-6 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-blue-50 to-cyan-100/80 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'overdue', label: 'Overdue' },
                { key: 'high-risk', label: 'High Risk' },
                { key: 'alerts', label: 'With Alerts' },
                { key: 'exceptions', label: 'Held/Refused' },
                { key: 'documentation', label: 'Documentation Gaps' },
              ].map((filterOption) => (
                <button
                  key={filterOption.key}
                  onClick={() => setWorklistFocus(filterOption.key as typeof worklistFocus)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    worklistFocus === filterOption.key
                      ? 'bg-blue-700 text-white'
                      : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-xs font-medium text-blue-800">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                />
                Include administered
              </label>
              <button
                onClick={() => setShowGuidelineSearch((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold"
              >
                <Brain className="w-3.5 h-3.5" />
                MAR AI Guidance
              </button>
            </div>
          </div>
        )}

        {isDoctor && (
          <div className="grid grid-cols-2 md:grid-cols-8 gap-3 mb-6">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase text-red-700">Overdue</p>
              <p className="text-2xl font-bold text-red-700">{worklistSummary?.overdue ?? 0}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase text-amber-700">Due Soon</p>
              <p className="text-2xl font-bold text-amber-700">{worklistSummary?.dueSoon ?? 0}</p>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-semibold uppercase text-orange-700">High Risk</p>
              <p className="text-2xl font-bold text-orange-700">{worklistSummary?.highRisk ?? 0}</p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
              <p className="text-xs font-semibold uppercase text-cyan-700">Open Alerts</p>
              <p className="text-2xl font-bold text-cyan-700">{worklistSummary?.withOpenAlerts ?? 0}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase text-indigo-700">High Alert Meds</p>
              <p className="text-2xl font-bold text-indigo-700">{worklistSummary?.highAlertMeds ?? 0}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase text-emerald-700">Admin Rate</p>
              <p className="text-2xl font-bold text-emerald-700">{worklistSummary?.administrationRatePercent ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
              <p className="text-xs font-semibold uppercase text-violet-700">Doc Gaps</p>
              <p className="text-2xl font-bold text-violet-700">{worklistSummary?.documentationGaps ?? 0}</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-semibold uppercase text-sky-700">CDSS Coverage</p>
              <p className="text-2xl font-bold text-sky-700">{worklistSummary?.cdssCoveragePercent ?? 0}%</p>
            </div>
          </div>
        )}

        {isDoctor && (
          <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
              5-rights incomplete: {worklistSummary?.incompleteFiveRights ?? 0}
            </span>
            <span className="rounded-full bg-cyan-100 px-2.5 py-1 font-semibold text-cyan-800">
              Scan gaps: {worklistSummary?.scanComplianceGaps ?? 0}
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-800">
              Missing witness: {worklistSummary?.missingWitnessDocumentation ?? 0}
            </span>
            <span className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-800">
              Exception no reason: {worklistSummary?.exceptionWithoutReason ?? 0}
            </span>
          </div>
        )}

        {isDoctor && (
          <section className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-700" />
                Shift Handoff Brief
              </h2>
              <button
                type="button"
                onClick={loadMedicationSafetyHandoffBrief}
                className="px-3 py-1.5 rounded-lg bg-indigo-700 text-white text-xs font-semibold hover:bg-indigo-800 disabled:opacity-60"
                disabled={handoffLoading}
              >
                {handoffLoading ? 'Refreshing...' : 'Refresh Brief'}
              </button>
            </div>

            {handoffLoading ? (
              <div className="py-4 text-sm text-slate-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                Generating handoff brief...
              </div>
            ) : !handoffBrief ? (
              <p className="text-sm text-slate-600">Handoff brief not available.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-indigo-700">Total Items</p>
                    <p className="text-xl font-bold text-indigo-900">{handoffBrief.summary?.totalItems ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-red-700">Overdue</p>
                    <p className="text-xl font-bold text-red-900">{handoffBrief.summary?.overdue ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-orange-700">High Risk</p>
                    <p className="text-xl font-bold text-orange-900">{handoffBrief.summary?.highRisk ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-cyan-700">Avg Risk</p>
                    <p className="text-xl font-bold text-cyan-900">{handoffBrief.summary?.avgRiskScore ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-violet-700">Doc Gaps</p>
                    <p className="text-xl font-bold text-violet-900">{handoffBrief.summary?.documentationGaps ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-sky-700">CDSS Coverage</p>
                    <p className="text-xl font-bold text-sky-900">{handoffBrief.summary?.cdssCoveragePercent ?? 0}%</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                    5-rights incomplete: {handoffBrief.summary?.incompleteFiveRights ?? 0}
                  </span>
                  <span className="rounded-full bg-cyan-100 px-2.5 py-1 font-semibold text-cyan-800">
                    Scan gaps: {handoffBrief.summary?.scanComplianceGaps ?? 0}
                  </span>
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-800">
                    Missing witness: {handoffBrief.summary?.missingWitnessDocumentation ?? 0}
                  </span>
                </div>

                {Array.isArray(handoffBrief.careGaps) && handoffBrief.careGaps.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-amber-800 mb-1">Care Gaps</p>
                    <div className="space-y-1">
                      {handoffBrief.careGaps.map((gap: string, idx: number) => (
                        <p key={`mar-gap-${idx}`} className="text-sm text-amber-900">{gap}</p>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(handoffBrief.topRisks) && handoffBrief.topRisks.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-slate-700 mb-2">Top Risk Queue</p>
                    <div className="space-y-2">
                      {handoffBrief.topRisks.slice(0, 5).map((risk: any) => (
                        <article key={`handoff-risk-${risk.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {risk.patientName} · {risk.medicationName}
                            </p>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                              score {risk.riskScore}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {risk.dose} {risk.unit} via {risk.route} · status {risk.administrationStatus}
                            {risk.overdueMinutes > 0 ? ` · overdue ${risk.overdueMinutes} min` : ''}
                          </p>
                          {Array.isArray(risk.cdssFlags) && risk.cdssFlags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {risk.cdssFlags.slice(0, 2).map((flag: string, idx: number) => (
                                <span
                                  key={`risk-flag-${risk.id}-${idx}`}
                                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                                >
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(handoffBrief.recommendations) && handoffBrief.recommendations.length > 0 && (
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-cyan-800 mb-1">Recommended Actions</p>
                    <div className="space-y-1">
                      {handoffBrief.recommendations.slice(0, 5).map((rec: string, idx: number) => (
                        <p key={`mar-rec-${idx}`} className="text-sm text-cyan-900">{rec}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {isDoctor && showGuidelineSearch && (
          <div className="mb-6 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-blue-50 to-cyan-100/70 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="text"
                value={guidelineQuery}
                onChange={(e) => setGuidelineQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGuidelineSearch();
                }}
                placeholder="Search guidance: insulin administration safety checks"
                className="flex-1 min-w-[240px] rounded-lg border border-cyan-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 text-sm font-semibold disabled:opacity-60"
              >
                {loadingGuidelines ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
            <div className="space-y-2">
              {guidelineResults.length === 0 ? (
                <p className="text-sm text-blue-800/80">No guidance loaded yet.</p>
              ) : (
                guidelineResults.map((citation: any, idx: number) => (
                  <article key={`mar-guideline-${idx}`} className="rounded-lg border border-cyan-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-700" />
                      {citation.title || citation.source || `Guideline ${idx + 1}`}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{citation.snippet || citation.content || 'No excerpt provided.'}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {isDoctor && (
          <div className="mb-6 rounded-2xl border border-cyan-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-white flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-900">Medication Safety Worklist</h2>
              <span className="text-xs font-semibold text-cyan-700 bg-cyan-100 px-2.5 py-1 rounded-full">
                {worklistSummary?.total ?? medicationWorklist.length} items
              </span>
            </div>
            <div className="p-4 space-y-3">
              {worklistLoading ? (
                <div className="py-6 text-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-700" />
                  Loading medication safety queue...
                </div>
              ) : medicationWorklist.length === 0 ? (
                <div className="py-6 text-center text-slate-500">No medication safety items for this filter.</div>
              ) : (
                medicationWorklist.slice(0, 24).map((item: any) => {
                  const priorityTone =
                    item.priority === 'critical'
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : item.priority === 'high'
                      ? 'bg-orange-100 text-orange-700 border border-orange-200'
                      : item.priority === 'moderate'
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-green-100 text-green-700 border border-green-200';
                  return (
                    <article key={`worklist-${item.id}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.patientName} <span className="text-xs font-normal text-slate-500">({item.patientNumber || 'N/A'})</span>
                          </p>
                          <p className="text-sm text-slate-700">
                            {item.medicationName} · {item.dose} {item.unit} · {item.route}
                          </p>
                          <p className="text-xs text-slate-500">
                            Scheduled {item.scheduledTime ? new Date(item.scheduledTime).toLocaleTimeString() : 'N/A'}
                            {item.overdueMinutes > 0 ? ` · overdue ${item.overdueMinutes} min` : ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            5-rights {item.verificationScore ?? 0}/5 · scans{' '}
                            {item.patientBarcodeScanned && item.medicationBarcodeScanned ? 'complete' : 'incomplete'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityTone}`}>
                            {item.priority} risk
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                            score {item.riskScore}
                          </span>
                          {item.isHighAlert && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                              high-alert
                            </span>
                          )}
                        </div>
                      </div>
                      {Array.isArray(item.recommendedActions) && item.recommendedActions.length > 0 && (
                        <p className="mt-2 text-xs text-slate-600">
                          <strong>Actions:</strong> {item.recommendedActions.join(' • ')}
                        </p>
                      )}
                      {Array.isArray(item.cdssFlags) && item.cdssFlags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.cdssFlags.slice(0, 3).map((flag: string, idx: number) => (
                            <span
                              key={`${item.id}-flag-${idx}`}
                              className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => focusPatientFromWorklist(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                        >
                          Focus patient
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEscalateRisk(item)}
                          disabled={escalatingMarId === item.id}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-1.5"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {escalatingMarId === item.id ? 'Escalating...' : 'Escalate'}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Patient</label>
            <select
              value={selectedPatient?.id || selectedPatient?.patient_id || ''}
              onChange={(e) => {
                const patient = patients.find(p => (p.id === e.target.value) || (p.patient_id === e.target.value));
                setSelectedPatient(patient || null);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select patient...</option>
              {patients.map((patient) => {
                const patientId = patient.id || patient.patient_id;
                const firstName = patient.patient_first_name || patient.patientFirstName || patient.firstName || '';
                const lastName = patient.patient_last_name || patient.patientLastName || patient.lastName || '';
                const bedNumber = patient.bed_number || patient.bedNumber || 'N/A';
                return (
                  <option key={patientId} value={patientId}>
                    {firstName} {lastName} - Bed {bedNumber}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {selectedPatient && activeAlerts.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-red-900">
              Active Medication Safety Alerts ({activeAlerts.length})
            </h3>
            <div className="space-y-2">
              {activeAlerts.slice(0, 5).map((alert) => {
                const severity = (alert.severity || '').toLowerCase();
                const severityTone =
                  severity === 'critical'
                    ? 'border-red-300 bg-red-100 text-red-900'
                    : severity === 'high'
                    ? 'border-orange-300 bg-orange-100 text-orange-900'
                    : 'border-amber-300 bg-amber-100 text-amber-900';
                const alertMessage = alert.alertMessage || alert.alert_message || 'Medication alert';
                const alertType = alert.alertType || alert.alert_type || 'safety';

                return (
                  <div key={alert.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${severityTone}`}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide">{alertType}</p>
                      <p className="text-sm">{alertMessage}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAcknowledgeAlert(alert)}
                      disabled={acknowledgingAlertId === alert.id}
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {acknowledgingAlertId === alert.id ? 'Saving...' : 'Acknowledge'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scheduled MAR Timeline (K5) */}
        {selectedPatient && marRecords.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Today's Administration Timeline
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-3 pl-10">
                {[...marRecords]
                  .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
                  .map((mar) => {
                    const isOverdue = mar.administrationStatus === 'pending' && new Date(mar.scheduledTime) < new Date();
                    const isGiven = mar.administrationStatus === 'administered';
                    const isRefused = mar.administrationStatus === 'refused';
                    const isHeld = mar.administrationStatus === 'held' || mar.administrationStatus === 'omitted';
                    return (
                      <div key={`tl-${mar.id}`} className="relative flex items-center gap-3">
                        <div className={`absolute -left-10 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isGiven ? 'bg-green-500 border-green-600' :
                          isRefused ? 'bg-red-400 border-red-500' :
                          isHeld ? 'bg-amber-400 border-amber-500' :
                          isOverdue ? 'bg-red-100 border-red-400 animate-pulse' :
                          'bg-white border-slate-300'
                        }`}>
                          {isGiven && <CheckCircle className="w-3 h-3 text-white" />}
                          {isOverdue && !isGiven && <AlertCircle className="w-3 h-3 text-red-500" />}
                        </div>
                        <div className={`flex-1 flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                          isGiven ? 'bg-green-50 border border-green-200' :
                          isOverdue ? 'bg-red-50 border border-red-200' :
                          isRefused ? 'bg-red-50 border border-red-200' :
                          isHeld ? 'bg-amber-50 border border-amber-200' :
                          'bg-slate-50 border border-slate-200'
                        }`}>
                          <span className="font-semibold text-slate-800">
                            {new Date(mar.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-700">{mar.medicationName}</span>
                          <span className="text-slate-500">{mar.dose} {mar.unit} ({mar.route})</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            isGiven ? 'bg-green-200 text-green-800' :
                            isOverdue ? 'bg-red-200 text-red-800' :
                            isRefused ? 'bg-red-200 text-red-800' :
                            isHeld ? 'bg-amber-200 text-amber-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {isOverdue && !isGiven ? 'OVERDUE' : mar.administrationStatus.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* MAR Grid */}
      {!selectedPatient ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Patient Selected</h3>
          <p className="text-slate-600">Please select a patient to view their MAR</p>
        </div>
      ) : marRecords.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Medications Scheduled</h3>
          <p className="text-slate-600">No medication administrations for selected date</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {marRecords.map((mar) => (
            <div
              key={mar.id}
              className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {getStatusIcon(mar.administrationStatus)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{mar.medicationName}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(mar.administrationStatus)}`}>
                        {mar.administrationStatus.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mb-1">
                      <strong>Dose:</strong> {mar.dose} {mar.unit} | <strong>Route:</strong> {mar.route}
                    </p>
                    <p className="text-sm text-slate-600">
                      <strong>Scheduled:</strong> {new Date(mar.scheduledTime).toLocaleTimeString()}
                      {mar.actualAdministrationTime && mar.administrationStatus === 'administered' && (
                        <> | <strong>Given:</strong> {new Date(mar.actualAdministrationTime).toLocaleTimeString()}</>
                      )}
                    </p>
                    {mar.administeredBy && (
                      <p className="text-xs text-slate-500 mt-1">
                        By: {mar.administeredBy.firstName} {mar.administeredBy.lastName}
                      </p>
                    )}
                    {mar.refusalReason && (
                      <p className="text-sm text-red-600 mt-2">
                        <strong>Refusal Reason:</strong> {mar.refusalReason}
                      </p>
                    )}
                    {mar.omissionReason && (
                      <p className="text-sm text-yellow-600 mt-2">
                        <strong>Hold Reason:</strong> {mar.omissionReason}
                      </p>
                    )}
                  </div>
                </div>
                {mar.administrationStatus === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
                      onClick={() => {
                        setSelectedMarForScan(mar);
                        setScannerOpen(true);
                      }}
                    >
                      <Scan className="w-4 h-4" />
                      Scan & Give
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusAction(mar, 'hold')}
                      disabled={statusActionMarId === mar.id}
                      className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 disabled:opacity-60"
                    >
                      Hold
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusAction(mar, 'refuse')}
                      disabled={statusActionMarId === mar.id}
                      className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100 disabled:opacity-60"
                    >
                      Refused
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
    {scannerOpen && selectedMarForScan && selectedPatient && tenantSlug && (
      <MedicationScannerModal
        prescription={selectedMarForScan}
        patient={selectedPatient}
        tenantSlug={tenantSlug}
        token={token}
        onSuccess={() => {
          setScannerOpen(false);
          setSelectedMarForScan(null);
          loadMARs();
        }}
        onClose={() => {
          setScannerOpen(false);
          setSelectedMarForScan(null);
        }}
      />
    )}
  </>
  );
};

export default MARDashboard;
