import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Shield, AlertTriangle, Activity, Users,
  Loader2, Calendar, BarChart3, ArrowLeft, ClipboardCheck,
  Brain, Search, BookOpen
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { cdssApi, ehrAxios } from '../services/api';

interface InfectionControlDashboardProps {
  embedded?: boolean;
}

const InfectionControlDashboard: React.FC<InfectionControlDashboardProps> = ({ embedded = false }) => {
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

  const [infections, setInfections] = useState<any[]>([]);
  const [isolations, setIsolations] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hhCompliance, setHhCompliance] = useState<any>(null);
  const [deviceRates, setDeviceRates] = useState<any>(null);
  const [antimicrobialReport, setAntimicrobialReport] = useState<any>(null);
  const [stewardshipWorklist, setStewardshipWorklist] = useState<any>({ summary: null, items: [] });
  const [infectionWorklist, setInfectionWorklist] = useState<any>({ summary: null, items: [] });
  const [outbreakSignals, setOutbreakSignals] = useState<any>({ summary: null, items: [] });
  const [operationalBrief, setOperationalBrief] = useState<any>(null);
  const [reviewingStewardshipId, setReviewingStewardshipId] = useState<string | null>(null);
  const [reviewingInfectionId, setReviewingInfectionId] = useState<string | null>(null);
  const [isolationActionId, setIsolationActionId] = useState<string | null>(null);
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [hhDepartment, setHhDepartment] = useState('');
  const [hhOpportunity, setHhOpportunity] = useState('before_patient_contact');
  const [hhPerformed, setHhPerformed] = useState(true);
  const [hhMethod, setHhMethod] = useState('alcohol_rub');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        infectionsResponse,
        metricsResponse,
        isolationsResponse,
        hhRes,
        deviceRes,
        antimicrobialRes,
        stewardshipRes,
        worklistRes,
        outbreaksRes,
        operationalBriefRes,
      ] = await Promise.all([
        ehrAxios.get('/infection-control/infections', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }),
        ehrAxios.get('/infection-control/metrics/hai', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }),
        ehrAxios.get('/infection-control/isolation/active', {
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }),
        ehrAxios.get('/infection-control/hand-hygiene/compliance', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: null })),
        ehrAxios.get('/infection-control/device-days/rates', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: null })),
        ehrAxios.get('/infection-control/antimicrobial/report', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: null })),
        ehrAxios.get('/infection-control/stewardship/worklist', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate, limit: 20 },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: { summary: null, items: [] } })),
        ehrAxios.get('/infection-control/worklist', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate, limit: 20 },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: { summary: null, items: [] } })),
        ehrAxios.get('/infection-control/outbreak-signals', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate, limit: 8 },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: { summary: null, items: [] } })),
        ehrAxios.get('/infection-control/operational-brief', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate, limit: 100 },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: null })),
      ]);
      setInfections(infectionsResponse.data || []);
      setMetrics(metricsResponse.data);
      setIsolations(isolationsResponse.data || []);
      setHhCompliance(hhRes.data);
      setDeviceRates(deviceRes.data);
      setAntimicrobialReport(antimicrobialRes.data || null);
      setStewardshipWorklist(stewardshipRes.data || { summary: null, items: [] });
      setInfectionWorklist(worklistRes.data || { summary: null, items: [] });
      setOutbreakSignals(outbreaksRes.data || { summary: null, items: [] });
      setOperationalBrief(operationalBriefRes.data || null);
    } catch (error) {
      showError('Error', 'Failed to load infection control data');
    } finally {
      setLoading(false);
    }
  };

  const getInfectionColor = (type: string) => {
    switch (type) {
      case 'CAUTI': return 'from-yellow-500 to-amber-600';
      case 'CLABSI': return 'from-red-500 to-rose-600';
      case 'SSI': return 'from-orange-500 to-amber-600';
      case 'VAP': return 'from-purple-500 to-violet-600';
      case 'CDI': return 'from-pink-500 to-rose-600';
      case 'MRSA': return 'from-red-600 to-rose-700';
      case 'VRE': return 'from-orange-600 to-red-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getIsolationColor = (type: string) => {
    switch (type) {
      case 'contact': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'droplet': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'airborne': return 'bg-red-100 text-red-800 border-red-300';
      case 'protective': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStewardshipRiskColor = (riskLevel: string) => {
    const risk = String(riskLevel || '').toLowerCase();
    if (risk === 'high') return 'bg-red-100 text-red-800 border-red-300';
    if (risk === 'moderate') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getWorklistRiskColor = (riskLevel: string) => {
    const risk = String(riskLevel || '').toLowerCase();
    if (risk === 'high') return 'bg-red-100 text-red-800 border-red-300';
    if (risk === 'moderate') return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const formatStewardshipField = (value: string | null | undefined) =>
    String(value || 'not documented')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const handleReviewStewardship = async (item: any) => {
    const recommendation = window.prompt('Stewardship recommendation (de-escalate, continue, stop, etc):', item?.stewardship_recommendation || '');
    if (recommendation === null) return;
    const appropriateIndication = window.confirm('Indication appropriate? OK = Yes, Cancel = No');
    const appropriateDose = window.confirm('Dose appropriate? OK = Yes, Cancel = No');
    const appropriateDuration = window.confirm('Duration appropriate? OK = Yes, Cancel = No');
    const deEscalationOpportunity = window.confirm('Is there a de-escalation opportunity? OK = Yes, Cancel = No');
    const deEscalationNotes = deEscalationOpportunity
      ? window.prompt('Document de-escalation notes:', item?.de_escalation_notes || '')
      : '';
    if (deEscalationOpportunity && deEscalationNotes === null) return;

    try {
      setReviewingStewardshipId(item.id);
      await ehrAxios.put(
        `/infection-control/antimicrobial/${item.id}/review`,
        {
          recommendation: recommendation.trim() || 'Reviewed - continue current therapy with daily reassessment.',
          appropriateIndication,
          appropriateDose,
          appropriateDuration,
          deEscalationOpportunity,
          deEscalationNotes: deEscalationNotes || null,
        },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Stewardship review saved', 'Antimicrobial review has been documented.');
      loadData();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save antimicrobial review');
    } finally {
      setReviewingStewardshipId(null);
    }
  };

  const handleReviewInfection = async (item: any) => {
    const investigationNotes = window.prompt(
      'Clinical investigation notes (IPC findings, containment actions, follow-up plan):',
      item?.investigation_notes || '',
    );
    if (investigationNotes === null) return;
    const rootCause = window.prompt('Root cause (optional):', item?.root_cause || '') || '';
    const reportedToCdc = window.confirm('Report this case to public health/CDC? OK = Yes, Cancel = No');
    const markResolved = window.confirm('Mark this infection case as resolved? OK = Yes, Cancel = No');
    const outcome = markResolved ? window.prompt('Resolved outcome summary (optional):', item?.outcome || '') : '';
    if (markResolved && outcome === null) return;

    try {
      setReviewingInfectionId(item.id);
      await ehrAxios.put(
        `/infection-control/infections/${item.id}/review`,
        {
          investigationNotes: investigationNotes.trim(),
          rootCause: rootCause.trim() || null,
          reportedToCdc,
          markResolved,
          outcome: outcome ? outcome.trim() : null,
        },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Infection review saved', 'Clinical IPC review has been documented.');
      loadData();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save infection review');
    } finally {
      setReviewingInfectionId(null);
    }
  };

  const handleOrderIsolation = async (item: any) => {
    const isolationType = window.prompt(
      'Isolation type (contact/droplet/airborne/protective):',
      item?.active_isolation_type || 'contact',
    );
    if (!isolationType) return;
    const reason = window.prompt(
      'Isolation reason:',
      item?.mdro_signal
        ? `${item.infection_type || 'Infection'} with MDRO risk - initiate transmission-based precautions.`
        : `${item.infection_type || 'Infection'} transmission risk precautions.`,
    );
    if (!reason || !reason.trim()) return;

    try {
      setIsolationActionId(item.id);
      await ehrAxios.post(
        '/infection-control/isolation',
        {
          patientId: item.patient_id,
          admissionId: item.admission_id || null,
          isolationType: isolationType.trim().toLowerCase(),
          reason: reason.trim(),
          organism: item.organism || null,
        },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Isolation ordered', 'Isolation precautions are now active for this patient.');
      loadData();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to order isolation');
    } finally {
      setIsolationActionId(null);
    }
  };

  const handleDiscontinueIsolation = async (isolation: any) => {
    const reason = window.prompt(
      'Reason for discontinuing isolation precautions:',
      'Clinical criteria met, discontinue isolation precautions.',
    );
    if (!reason || !reason.trim()) return;

    try {
      setIsolationActionId(isolation.id);
      await ehrAxios.post(
        `/infection-control/isolation/${isolation.id}/discontinue`,
        { reason: reason.trim() },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Isolation discontinued', 'Isolation precaution status has been updated.');
      loadData();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to discontinue isolation');
    } finally {
      setIsolationActionId(null);
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
      const response = await cdssApi.searchGuidelines(guidelineQuery.trim(), token, tenantSlug);
      setGuidelineResults(response.data?.citations || []);
    } catch {
      showError('Error', 'Failed to search infection-control guidance');
      setGuidelineResults([]);
    } finally {
      setLoadingGuidelines(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-12' : 'min-h-screen'}`}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading infection control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {!embedded && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-lg">
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
                    <Shield className="w-8 h-8" />
                    Infection Control & Epidemiology
                  </h1>
                  <p className="text-green-100 mt-1">HAI surveillance & antimicrobial stewardship</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${embedded ? 'pb-4' : 'pt-8 pb-8'}`}>
        {/* Date Range */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-200 shadow-sm">
            <Calendar className="w-5 h-5 text-green-600" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="border-0 bg-transparent focus:outline-none focus:ring-0 font-medium text-slate-900 text-sm"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="border-0 bg-transparent focus:outline-none focus:ring-0 font-medium text-slate-900 text-sm"
            />
          </div>
        </div>

        {/* HAI Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total HAI Cases</p>
                <p className="text-4xl font-bold text-red-600">{metrics.totalHAI || 0}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Device-Associated</p>
                <p className="text-4xl font-bold text-orange-600">{metrics.deviceAssociated || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Isolations</p>
                <p className="text-4xl font-bold text-yellow-600">{isolations.length}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operational Brief */}
      <div className="mb-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Operational Brief</h2>
          <button
            onClick={loadData}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Refresh Brief
          </button>
        </div>

        {!operationalBrief ? (
          <p className="text-sm text-slate-600">Operational brief unavailable for this window.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">High Risk</p>
                <p className="mt-1 text-2xl font-bold text-red-800">
                  {(operationalBrief.summary?.highRiskInfections || 0) + (operationalBrief.summary?.stewardshipHighRisk || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Isolation Gaps</p>
                <p className="mt-1 text-2xl font-bold text-orange-800">{operationalBrief.summary?.isolationGaps ?? 0}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Diagnostic Gaps</p>
                <p className="mt-1 text-2xl font-bold text-amber-800">{operationalBrief.summary?.diagnosticWorkupGaps ?? 0}</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Coding Gaps</p>
                <p className="mt-1 text-2xl font-bold text-violet-800">
                  {(operationalBrief.summary?.infectionCodingGaps || 0) + (operationalBrief.summary?.stewardshipCodingGaps || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Prolonged Empiric</p>
                <p className="mt-1 text-2xl font-bold text-rose-800">
                  {operationalBrief.summary?.prolongedEmpiricWithoutCulture ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">CDSS Coverage</p>
                <p className="mt-1 text-2xl font-bold text-cyan-800">{operationalBrief.summary?.cdssCoveragePercent ?? 0}%</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-cyan-100 px-2.5 py-1 font-semibold text-cyan-800">
                Outbreak clusters: {operationalBrief.summary?.outbreakHighRiskClusters ?? 0}
              </span>
              <span className="rounded-full bg-teal-100 px-2.5 py-1 font-semibold text-teal-800">
                HH compliance: {operationalBrief.summary?.handHygieneOverallRate ?? '--'}
                {operationalBrief.summary?.handHygieneOverallRate !== null && operationalBrief.summary?.handHygieneOverallRate !== undefined ? '%' : ''}
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                Stewardship overdue: {operationalBrief.summary?.stewardshipOverdue ?? 0}
              </span>
            </div>

            {Array.isArray(operationalBrief.highPriorityQueue) && operationalBrief.highPriorityQueue.length > 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">High-Priority Queue</p>
                <div className="space-y-2">
                  {operationalBrief.highPriorityQueue.slice(0, 5).map((item: any) => (
                    <div key={`${item.source}-${item.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.patientName} {item.patientNumber ? `(${item.patientNumber})` : ''}
                      </p>
                      <p className="text-xs text-slate-600">
                        {String(item.source || '').toUpperCase()} • {item.focusLabel || 'Clinical item'} • {String(item.riskLevel || 'low').toUpperCase()} risk
                      </p>
                      {Array.isArray(item.cdssFlags) && item.cdssFlags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.cdssFlags.slice(0, 2).map((flag: string, idx: number) => (
                            <span
                              key={`${item.source}-${item.id}-flag-${idx}`}
                              className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(operationalBrief.recommendations) && operationalBrief.recommendations.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Recommended Actions</p>
                <ul className="space-y-1 text-sm text-emerald-900">
                  {operationalBrief.recommendations.slice(0, 5).map((rec: string, idx: number) => (
                    <li key={`infection-brief-rec-${idx}`}>- {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clinical Worklist + Outbreak Signals */}
      <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Shield className="h-5 w-5 text-emerald-700" />
            Infection Control Clinical Worklist
          </h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Doctor prioritization
          </span>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-red-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">High Risk</p>
            <p className="mt-1 text-2xl font-bold text-red-700">{infectionWorklist?.summary?.highRisk ?? 0}</p>
          </div>
          <div className="rounded-xl border border-orange-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Moderate Risk</p>
            <p className="mt-1 text-2xl font-bold text-orange-700">{infectionWorklist?.summary?.moderateRisk ?? 0}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Unresolved</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{infectionWorklist?.summary?.unresolved ?? 0}</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">No Isolation</p>
            <p className="mt-1 text-2xl font-bold text-violet-700">{infectionWorklist?.summary?.withoutIsolation ?? 0}</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">MDRO Signals</p>
            <p className="mt-1 text-2xl font-bold text-cyan-700">{infectionWorklist?.summary?.mdroSignals ?? 0}</p>
          </div>
        </div>

        {Array.isArray(infectionWorklist?.items) && infectionWorklist.items.length > 0 ? (
          <div className="space-y-3">
            {infectionWorklist.items.slice(0, 6).map((item: any) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {item.first_name} {item.last_name}
                      </h3>
                      {item.patient_number && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {item.patient_number}
                        </span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getWorklistRiskColor(item.risk_level)}`}>
                        {String(item.risk_level || 'low').toUpperCase()} RISK
                      </span>
                      {item.active_isolation_id ? (
                        <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                          Isolation active
                        </span>
                      ) : (
                        <span className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                          Isolation missing
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {item.infection_type}
                      {item.infection_site ? ` • ${item.infection_site}` : ''}
                    </p>
                    <p className="text-xs text-slate-600">
                      Onset: {String(item.onset_type || 'unknown').replace(/_/g, ' ')} ·
                      Organism: {item.organism || 'Not documented'} ·
                      Days open: {item.days_since_infection ?? 0}
                    </p>
                    {Array.isArray(item.recommended_actions) && item.recommended_actions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.recommended_actions.slice(0, 2).map((action: string, idx: number) => (
                          <p key={`${item.id}-worklist-action-${idx}`} className="text-xs text-slate-700">
                            • {action}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:max-w-[40%] lg:justify-end">
                    {!item.active_isolation_id && (
                      <button
                        type="button"
                        onClick={() => handleOrderIsolation(item)}
                        disabled={isolationActionId === item.id}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                      >
                        {isolationActionId === item.id ? 'Saving...' : 'Order Isolation'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleReviewInfection(item)}
                      disabled={reviewingInfectionId === item.id}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {reviewingInfectionId === item.id ? 'Saving...' : 'Document Review'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No infection-control worklist items in the selected period.
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Outbreak Watch</p>
          {Array.isArray(outbreakSignals?.items) && outbreakSignals.items.length > 0 ? (
            <div className="space-y-2">
              {outbreakSignals.items.slice(0, 4).map((signal: any, idx: number) => (
                <div key={`${signal.infection_type}-${signal.organism}-${idx}`} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {signal.infection_type} • {signal.organism}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getWorklistRiskColor(signal.risk_level)}`}>
                      {String(signal.risk_level || 'low').toUpperCase()} CLUSTER
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Cases: {signal.case_count} · Active: {signal.active_count} · Patients: {signal.distinct_patients}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No active outbreak clusters detected for this date range.</p>
          )}
        </div>
      </div>

      {/* Active Isolations */}
      {isolations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-600" />
            Active Isolation Precautions ({isolations.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isolations.map((isolation) => (
              <div key={isolation.id} className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-yellow-300 shadow-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {isolation.patient?.firstName} {isolation.patient?.lastName}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {isolation.roomNumber} - {isolation.bedNumber}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getIsolationColor(isolation.isolationType)}`}>
                    {isolation.isolationType.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>Reason:</strong> {isolation.reason}
                </p>
                {isolation.organism && (
                  <p className="text-sm text-slate-700">
                    <strong>Organism:</strong> {isolation.organism}
                  </p>
                )}
                {isolation.ppeRequired && isolation.ppeRequired.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {isolation.ppeRequired.map((ppe: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-medium">
                        {ppe}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => handleDiscontinueIsolation(isolation)}
                    disabled={isolationActionId === isolation.id}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {isolationActionId === isolation.id ? 'Saving...' : 'Discontinue Isolation'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Infections */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-green-600" />
          Infection Surveillance
        </h2>
        {infections.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <Shield className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Infections Reported</h3>
            <p className="text-slate-600">No infections in selected date range</p>
          </div>
        ) : (
          <div className="space-y-3">
            {infections.map((infection) => (
              <div
                key={infection.id}
                className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${getInfectionColor(infection.infectionType)} rounded-xl flex items-center justify-center shadow-lg`}>
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">{infection.infectionType}</h3>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-bold">
                          {infection.onsetType?.replace('_', ' ').toUpperCase()}
                        </span>
                        {infection.deviceAssociated && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-bold">
                            DEVICE-ASSOCIATED
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 mb-1">
                        <strong>Patient:</strong> {infection.patient?.firstName} {infection.patient?.lastName}
                      </p>
                      <p className="text-sm text-slate-600 mb-1">
                        <strong>Date:</strong> {new Date(infection.infectionDate).toLocaleDateString()} 
                        {infection.daysSinceAdmission && ` (Day ${infection.daysSinceAdmission} of admission)`}
                      </p>
                      {infection.organism && (
                        <p className="text-sm text-slate-600">
                          <strong>Organism:</strong> {infection.organism}
                          {infection.cultureSource && ` (${infection.cultureSource})`}
                        </p>
                      )}
                      {infection.severity && (
                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                          infection.severity === 'septic_shock' || infection.severity === 'severe' 
                            ? 'bg-red-100 text-red-800'
                            : infection.severity === 'sepsis' || infection.severity === 'moderate'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {infection.severity.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {infection.resolved ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                      RESOLVED
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold animate-pulse">
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Antimicrobial Stewardship CDSS Panel */}
        <div className="mb-6 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-teal-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ClipboardCheck className="h-5 w-5 text-cyan-700" />
              Antimicrobial Stewardship CDSS
            </h2>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
              48-72h timeout focus
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-red-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Review Pending</p>
              <p className="mt-1 text-2xl font-bold text-red-700">{stewardshipWorklist?.summary?.reviewPending ?? 0}</p>
            </div>
            <div className="rounded-xl border border-orange-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Overdue Review</p>
              <p className="mt-1 text-2xl font-bold text-orange-700">{stewardshipWorklist?.summary?.overdueReview ?? 0}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">De-escalation</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">
                {stewardshipWorklist?.summary?.deEscalationOpportunities ?? antimicrobialReport?.deEscalationOpportunities ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Guideline Variance</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{antimicrobialReport?.guidelineVarianceCount ?? 0}</p>
            </div>
          </div>

          {Array.isArray(stewardshipWorklist?.items) && stewardshipWorklist.items.length > 0 ? (
            <div className="space-y-3">
              {stewardshipWorklist.items.slice(0, 6).map((item: any) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {item.first_name} {item.last_name}
                        </h3>
                        {item.patient_number && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {item.patient_number}
                          </span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getStewardshipRiskColor(item.risk_level)}`}>
                          {String(item.risk_level || 'low').toUpperCase()} RISK
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{item.antibiotic_name}</p>
                      <p className="text-xs text-slate-600">
                        Class: {formatStewardshipField(item.antibiotic_class)} · Route: {formatStewardshipField(item.route)} ·
                        Therapy day: {item.therapy_day || 0}
                        {item.planned_duration_days ? `/${item.planned_duration_days}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Strategy: {formatStewardshipField(item.empiric_or_targeted)} · Culture sent: {item.culture_sent ? 'Yes' : 'No'}
                      </p>
                      {Array.isArray(item.recommended_actions) && item.recommended_actions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.recommended_actions.slice(0, 2).map((action: string, idx: number) => (
                            <p key={`${item.id}-action-${idx}`} className="text-xs text-slate-700">
                              • {action}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReviewStewardship(item)}
                      disabled={reviewingStewardshipId === item.id}
                      className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                    >
                      {reviewingStewardshipId === item.id ? 'Saving...' : 'Document Review'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              No stewardship review items in the selected period.
            </div>
          )}
        </div>

        {/* Infection Prevention Guidance AI */}
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-100 p-2">
                <Brain className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Infection Prevention Guidance (AI/CDSS)</h3>
                <p className="text-sm text-slate-500">Search WHO/CDC-aligned practices for outbreaks, isolation and stewardship.</p>
              </div>
            </div>
            <button
              onClick={() => setShowGuidelineSearch((prev) => !prev)}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              {showGuidelineSearch ? 'Hide Search' : 'Search Guidance'}
            </button>
          </div>

          {showGuidelineSearch && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={guidelineQuery}
                    onChange={(e) => setGuidelineQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGuidelineSearch();
                    }}
                    placeholder="Search e.g. 'contact precautions for MRSA', 'CLABSI prevention bundle', 'antibiotic timeout checklist'"
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 focus:border-transparent focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={handleGuidelineSearch}
                  disabled={loadingGuidelines || !guidelineQuery.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {loadingGuidelines ? 'Searching...' : 'Search'}
                </button>
              </div>

              {guidelineResults.length > 0 && (
                <div className="grid gap-3">
                  {guidelineResults.slice(0, 3).map((result, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <BookOpen className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />
                        <div>
                          <h4 className="font-medium text-slate-900">{result.source || `Guideline ${idx + 1}`}</h4>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">{result.text}</p>
                          {result.url && (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-xs text-emerald-700 hover:underline"
                            >
                              View Source
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hand Hygiene Compliance Panel (K4) */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-teal-600" />
            Hand Hygiene Compliance (WHO 5 Moments)
          </h2>
          {hhCompliance && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-center">
                <p className="text-2xl font-bold text-teal-700">{hhCompliance.overallRate ?? '—'}%</p>
                <p className="text-xs text-teal-600">Overall compliance</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-2xl font-bold text-slate-700">{hhCompliance.totalObservations ?? 0}</p>
                <p className="text-xs text-slate-600">Observations</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
                <p className="text-2xl font-bold text-green-700">{hhCompliance.performedCount ?? 0}</p>
                <p className="text-xs text-green-600">Performed</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                <p className="text-2xl font-bold text-red-700">{hhCompliance.missedCount ?? 0}</p>
                <p className="text-xs text-red-600">Missed</p>
              </div>
            </div>
          )}
          {Array.isArray(hhCompliance?.byDepartment) && hhCompliance.byDepartment.length > 0 && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Department Compliance</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {hhCompliance.byDepartment.slice(0, 6).map((entry: any) => (
                  <div key={entry.department} className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-700">{entry.department}</p>
                    <p className="text-sm font-bold text-slate-900">{entry.complianceRate}%</p>
                    <p className="text-[11px] text-slate-500">{entry.performed}/{entry.total} opportunities</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">Record Observation</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input value={hhDepartment} onChange={(e) => setHhDepartment(e.target.value)} placeholder="Department" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
              <select value={hhOpportunity} onChange={(e) => setHhOpportunity(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <option value="before_patient_contact">Before patient contact</option>
                <option value="before_aseptic_task">Before aseptic task</option>
                <option value="after_body_fluid_exposure">After body fluid exposure</option>
                <option value="after_patient_contact">After patient contact</option>
                <option value="after_surroundings_contact">After surroundings contact</option>
              </select>
              <select value={hhMethod} onChange={(e) => setHhMethod(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <option value="alcohol_rub">Alcohol rub</option>
                <option value="soap_and_water">Soap and water</option>
                <option value="none">None</option>
              </select>
              <select
                value={hhPerformed ? 'yes' : 'no'}
                onChange={(e) => setHhPerformed(e.target.value === 'yes')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="yes">Performed</option>
                <option value="no">Missed</option>
              </select>
              <button
                onClick={async () => {
                  try {
                    await ehrAxios.post('/infection-control/hand-hygiene', {
                      department: hhDepartment,
                      opportunityType: hhOpportunity,
                      handHygienePerformed: hhPerformed,
                      method: hhMethod,
                    }, { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } });
                    showSuccess('Observation recorded', 'Hand hygiene observation captured.');
                    loadData();
                  } catch {
                    showError('Error', 'Failed to record hand hygiene observation');
                  }
                }}
                className="bg-teal-600 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-teal-700"
              >
                Record
              </button>
            </div>
          </div>
        </div>

        {/* Device Day Tracking Panel (K4) */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-purple-600" />
            Device-Day HAI Rates
          </h2>
          {deviceRates ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">CAUTI Rate</p>
                <p className="text-3xl font-bold text-purple-800 mt-1">{deviceRates.cautiRate ?? '—'}</p>
                <p className="text-xs text-purple-600 mt-1">per 1,000 catheter-days</p>
                <p className="text-xs text-slate-500">{deviceRates.urinaryCatheterDays ?? 0} device-days</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">CLABSI Rate</p>
                <p className="text-3xl font-bold text-red-800 mt-1">{deviceRates.clabsiRate ?? '—'}</p>
                <p className="text-xs text-red-600 mt-1">per 1,000 line-days</p>
                <p className="text-xs text-slate-500">{deviceRates.centralLineDays ?? 0} device-days</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">VAP Rate</p>
                <p className="text-3xl font-bold text-indigo-800 mt-1">{deviceRates.vapRate ?? '—'}</p>
                <p className="text-xs text-indigo-600 mt-1">per 1,000 ventilator-days</p>
                <p className="text-xs text-slate-500">{deviceRates.ventilatorDays ?? 0} device-days</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No device-day rate data available for this period.</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default InfectionControlDashboard;
