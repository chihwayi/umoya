import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  TrendingUp,
  MessageSquare,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Brain,
  ClipboardList,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { cdssApi, ehrAxios } from '../services/api';
import ModuleGeneralReportCard from '../components/ModuleGeneralReportCard';
import { GuidelineSearchPanel } from '../components/GuidelineSearchPanel';

interface CdiDashboardProps {
  embedded?: boolean;
}

const CdiDashboard: React.FC<CdiDashboardProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const [metrics, setMetrics] = useState<any>(null);
  const [openQueries, setOpenQueries] = useState<any[]>([]);
  const [worklistSummary, setWorklistSummary] = useState<any>(null);
  const [operationalBrief, setOperationalBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [includeAnswered, setIncludeAnswered] = useState(false);
  const [workflowFilter, setWorkflowFilter] = useState<'all' | 'open' | 'overdue' | 'warning' | 'high' | 'documentation' | 'answered'>('open');
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, any>>({});

  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [includeAnswered, workflowFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      const metricsResponse = await ehrAxios.get('/cdi/metrics', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setMetrics(metricsResponse.data);

      if (currentUser.role === 'doctor') {
        const [worklistResponse, briefResponse] = await Promise.all([
          ehrAxios
            .get(`/cdi/queries/worklist/${currentUser.id}`, {
              params: {
                includeAnswered,
                focus: workflowFilter,
                limit: 50,
              },
              headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
            })
            .catch(async () => {
              const fallback = await ehrAxios.get(`/cdi/queries/physician/${currentUser.id}`, {
                headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
              });
              return {
                data: {
                  summary: {
                    total: (fallback.data || []).length,
                    open: (fallback.data || []).length,
                    answered: 0,
                    overdue: 0,
                    dueSoon: 0,
                    highRisk: 0,
                    avgAgeHours: 0,
                    responseRatePercent: 0,
                    byPriority: { stat: 0, urgent: 0, routine: (fallback.data || []).length },
                  },
                  items: fallback.data || [],
                },
              };
            }),
          ehrAxios
            .get(`/cdi/queries/brief/${currentUser.id}`, {
              params: {
                includeAnswered,
                limit: 80,
              },
              headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
            })
            .catch(() => ({ data: null })),
        ]);

        const payload = worklistResponse.data || { summary: null, items: [] };
        setWorklistSummary(payload.summary || null);
        setOpenQueries(payload.items || []);
        setOperationalBrief(briefResponse?.data || null);
      } else {
        setWorklistSummary(null);
        setOpenQueries([]);
        setOperationalBrief(null);
      }
    } catch (error) {
      showError('Error', 'Failed to load CDI data');
    } finally {
      setLoading(false);
    }
  };

  const visibleQueries = useMemo(() => {
    const list = openQueries || [];
    if (workflowFilter === 'all') return list;
    if (workflowFilter === 'open') return list.filter((item) => String(item.query_status) !== 'answered');
    if (workflowFilter === 'overdue') return list.filter((item) => String(item.sla_status) === 'overdue');
    if (workflowFilter === 'warning') return list.filter((item) => String(item.sla_status) === 'warning');
    if (workflowFilter === 'high') return list.filter((item) => String(item.risk_level) === 'high');
    if (workflowFilter === 'documentation') return list.filter((item) => Number(item.documentation_gap_count || 0) > 0);
    if (workflowFilter === 'answered') return list.filter((item) => String(item.query_status) === 'answered');
    return list;
  }, [openQueries, workflowFilter]);

  const updateDraft = (queryId: string, updates: Record<string, any>) => {
    setResponseDrafts((prev) => ({
      ...prev,
      [queryId]: {
        responseText: '',
        responseAction: 'clarified',
        documentationImproved: true,
        drgChanged: false,
        ...(prev[queryId] || {}),
        ...updates,
      },
    }));
  };

  const handleAnswerQuery = async (query: any) => {
    const queryId = query.id;
    const draft = responseDrafts[queryId] || {};
    if (!draft.responseText || !String(draft.responseText).trim()) {
      showError('Response required', 'Please document the physician response before submitting.');
      return;
    }

    try {
      setSavingAnswerId(queryId);
      await ehrAxios.put(
        `/cdi/queries/${queryId}/answer`,
        {
          responseText: String(draft.responseText).trim(),
          responseAction: draft.responseAction || 'clarified',
          documentationImproved: Boolean(draft.documentationImproved),
          drgChanged: Boolean(draft.drgChanged),
        },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Query answered', 'CDI response saved successfully.');
      setActiveQueryId(null);
      setResponseDrafts((prev) => {
        const next = { ...prev };
        delete next[queryId];
        return next;
      });
      loadData();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save CDI response');
    } finally {
      setSavingAnswerId(null);
    }
  };


  const getPriorityBadge = (priority: string) => {
    const value = String(priority || '').toLowerCase();
    if (value === 'stat') return 'bg-red-100 text-red-800';
    if (value === 'urgent') return 'bg-orange-100 text-orange-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getSlaBadge = (slaStatus: string) => {
    const value = String(slaStatus || '').toLowerCase();
    if (value === 'overdue') return 'bg-red-100 text-red-800';
    if (value === 'warning') return 'bg-amber-100 text-amber-800';
    if (value === 'resolved') return 'bg-green-100 text-green-800';
    return 'bg-slate-100 text-slate-700';
  };

  const getRiskBadge = (riskLevel: string) => {
    const value = String(riskLevel || '').toLowerCase();
    if (value === 'high') return 'bg-red-100 text-red-800';
    if (value === 'moderate') return 'bg-amber-100 text-amber-800';
    return 'bg-green-100 text-green-800';
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-12' : 'min-h-screen'}`}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading CDI dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {!embedded && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/${currentUser?.role === 'doctor' ? 'doctor' : currentUser?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    <FileText className="w-8 h-8" />
                    Clinical Documentation Improvement
                  </h1>
                  <p className="text-blue-100 mt-1">Physician queries & DRG optimization</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${embedded ? 'pb-4' : 'pt-8 pb-8'}`}>
        <div className="mb-6">
          <ModuleGeneralReportCard
            moduleKey="cdi"
            title="CDI"
            tenantSlug={tenantSlug || ''}
            token={token}
            accentClass="from-indigo-50 via-white to-blue-50"
          />
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Queries</p>
                <p className="text-4xl font-bold text-blue-600">{metrics.total_queries || 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Answered</p>
                <p className="text-4xl font-bold text-green-600">{metrics.answered_queries || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">DRG Changes</p>
                <p className="text-4xl font-bold text-purple-600">{metrics.drg_changes || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Revenue Impact</p>
                <p className="text-3xl font-bold text-green-600">
                  ${((metrics.total_impact || 0) / 1000).toFixed(1)}K
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      )}

      {currentUser.role === 'doctor' && (
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Overdue</p>
              <p className="text-2xl font-bold text-red-700">{worklistSummary?.overdue ?? 0}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Due Soon</p>
              <p className="text-2xl font-bold text-amber-700">{worklistSummary?.dueSoon ?? 0}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">High Risk</p>
              <p className="text-2xl font-bold text-orange-700">{worklistSummary?.highRisk ?? 0}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Avg Age</p>
              <p className="text-2xl font-bold text-blue-700">{worklistSummary?.avgAgeHours ?? 0}h</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Response Rate</p>
              <p className="text-2xl font-bold text-green-700">{worklistSummary?.responseRatePercent ?? 0}%</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Doc Gaps</p>
              <p className="text-2xl font-bold text-violet-700">{worklistSummary?.documentationGaps ?? 0}</p>
            </div>
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">CDSS Coverage</p>
              <p className="text-2xl font-bold text-cyan-700">{worklistSummary?.cdssCoveragePercent ?? 100}%</p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-700" />
                CDI Operational Brief
              </h3>
              <button
                type="button"
                onClick={loadData}
                className="px-3 py-1.5 rounded-lg bg-indigo-700 text-white text-xs font-semibold hover:bg-indigo-800"
              >
                Refresh Brief
              </button>
            </div>

            {!operationalBrief ? (
              <p className="text-sm text-slate-600">Operational brief not available.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-red-700">Overdue</p>
                    <p className="text-2xl font-bold text-red-900">{operationalBrief.summary?.overdue ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-orange-700">High Risk</p>
                    <p className="text-2xl font-bold text-orange-900">{operationalBrief.summary?.highRisk ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-blue-700">Stat + Urgent</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {(operationalBrief.summary?.stat ?? 0) + (operationalBrief.summary?.urgent ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-emerald-700">Financial At Risk</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      ${Number(operationalBrief.summary?.financialAtRisk || 0).toFixed(0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-violet-700">Doc Gaps</p>
                    <p className="text-2xl font-bold text-violet-900">{operationalBrief.summary?.documentationGaps ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-cyan-700">CDSS Coverage</p>
                    <p className="text-2xl font-bold text-cyan-900">{operationalBrief.summary?.cdssCoveragePercent ?? 100}%</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-red-100 text-red-700 px-2 py-1 border border-red-200">
                    Missing indicators: {operationalBrief.summary?.missingClinicalIndicators ?? 0}
                  </span>
                  <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-1 border border-orange-200">
                    Missing DRG context: {operationalBrief.summary?.missingPotentialDrgContext ?? 0}
                  </span>
                  <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-1 border border-indigo-200">
                    Missing impact estimate: {operationalBrief.summary?.missingFinancialImpact ?? 0}
                  </span>
                  <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-1 border border-slate-200">
                    Answered missing narrative: {operationalBrief.summary?.answeredMissingResponseNarrative ?? 0}
                  </span>
                </div>

                {Array.isArray(operationalBrief.highPriorityQueue) && operationalBrief.highPriorityQueue.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-slate-700 mb-2">High Priority Query Queue</p>
                    <div className="space-y-2">
                      {operationalBrief.highPriorityQueue.slice(0, 5).map((item: any) => (
                        <article key={`cdi-priority-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.patientName} {item.patientNumber ? `(${item.patientNumber})` : ''}
                            </p>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                              {String(item.riskLevel || 'low').toUpperCase()} · {item.ageHours}h
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Priority {String(item.priority || 'routine').toUpperCase()} · SLA {String(item.slaStatus || 'on_track').replace('_', ' ')}
                          </p>
                          {Array.isArray(item.cdssFlags) && item.cdssFlags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.cdssFlags.slice(0, 3).map((flag: string, idx: number) => (
                                <span
                                  key={`cdi-brief-flag-${item.id}-${idx}`}
                                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200"
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

                {Array.isArray(operationalBrief.recommendations) && operationalBrief.recommendations.length > 0 && (
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-cyan-800 mb-1">Recommended Actions</p>
                    <div className="space-y-1">
                      {operationalBrief.recommendations.slice(0, 5).map((recommendation: string, idx: number) => (
                        <p key={`cdi-rec-${idx}`} className="text-sm text-cyan-900">{recommendation}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWorkflowFilter('open')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${workflowFilter === 'open' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setWorkflowFilter('overdue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${workflowFilter === 'overdue' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Overdue
            </button>
            <button
              type="button"
              onClick={() => setWorkflowFilter('warning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${workflowFilter === 'warning' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Due Soon
            </button>
            <button
              type="button"
              onClick={() => setWorkflowFilter('high')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${workflowFilter === 'high' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              High Risk
            </button>
            <button
              type="button"
              onClick={() => setWorkflowFilter('documentation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${workflowFilter === 'documentation' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Documentation Gaps
            </button>
            <button
              type="button"
              onClick={() => setWorkflowFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${workflowFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              All
            </button>
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={includeAnswered}
                onChange={(e) => setIncludeAnswered(e.target.checked)}
              />
              Include answered
            </label>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            CDI Physician Worklist ({visibleQueries.length})
          </h2>

          {visibleQueries.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-8 text-center shadow-sm">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900">No CDI queries for this filter</p>
              <p className="text-xs text-slate-600 mt-1">You are caught up on current documentation queries.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleQueries.map((query) => {
                const isAnswered = String(query.query_status || '').toLowerCase() === 'answered';
                const draft = responseDrafts[query.id] || {
                  responseText: '',
                  responseAction: 'clarified',
                  documentationImproved: true,
                  drgChanged: false,
                };

                return (
                  <div key={query.id} className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-bold text-slate-900">
                            {query.patient_first_name} {query.patient_last_name}
                          </h3>
                          {query.patient_number && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                              {query.patient_number}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getPriorityBadge(query.priority)}`}>
                            {(query.priority || 'routine').toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getSlaBadge(query.sla_status)}`}>
                            {String(query.sla_status || 'on_track').replace('_', ' ').toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getRiskBadge(query.risk_level)}`}>
                            {String(query.risk_level || 'low').toUpperCase()} RISK
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          Query #{query.query_number} · Age: {query.age_hours ?? 0}h · Target SLA: {query.sla_threshold_hours ?? 24}h
                        </p>
                        <div className="bg-blue-50 rounded-lg p-3 mb-2">
                          <p className="text-sm text-slate-700">
                            <strong>Query:</strong> {query.query_text}
                          </p>
                        </div>
                        {query.clinical_indicators && (
                          <div className="bg-slate-50 rounded-lg p-3 mb-2">
                            <p className="text-xs text-slate-600"><strong>Clinical Indicators:</strong></p>
                            <p className="text-sm text-slate-700">{query.clinical_indicators}</p>
                          </div>
                        )}
                        {Array.isArray(query.recommended_actions) && query.recommended_actions.length > 0 && (
                          <div className="mb-2">
                            {query.recommended_actions.slice(0, 2).map((action: string, idx: number) => (
                              <p key={`${query.id}-rec-${idx}`} className="text-xs text-slate-600">• {action}</p>
                            ))}
                          </div>
                        )}
                        {Array.isArray(query.cdss_flags) && query.cdss_flags.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {query.cdss_flags.slice(0, 4).map((flag: string, idx: number) => (
                              <span
                                key={`${query.id}-flag-${idx}`}
                                className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700 border border-violet-200"
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                        {query.financial_impact_value > 0 && (
                          <p className="text-sm text-green-700 font-semibold">
                            Potential Impact: ${Number(query.financial_impact_value).toFixed(2)}
                          </p>
                        )}
                        {query.potential_drg_change && (
                          <p className="text-xs text-purple-700 mt-1">
                            Potential DRG Change: {query.potential_drg_change}
                          </p>
                        )}
                      </div>

                      {!isAnswered && (
                        <div className="flex flex-col gap-2 lg:items-end">
                          <button
                            type="button"
                            onClick={() => {
                              const next = activeQueryId === query.id ? null : query.id;
                              setActiveQueryId(next);
                              if (next === query.id && !responseDrafts[query.id]) {
                                updateDraft(query.id, {});
                              }
                            }}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                          >
                            {activeQueryId === query.id ? 'Close Response' : 'Answer Query'}
                          </button>
                        </div>
                      )}
                    </div>

                    {!isAnswered && activeQueryId === query.id && (
                      <div className="mt-3 border-t border-slate-200 pt-3 space-y-2">
                        <textarea
                          value={draft.responseText}
                          onChange={(e) => updateDraft(query.id, { responseText: e.target.value })}
                          rows={3}
                          placeholder="Document physician clarification response..."
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <select
                            value={draft.responseAction}
                            onChange={(e) => updateDraft(query.id, { responseAction: e.target.value })}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="clarified">Clarified</option>
                            <option value="agreed_with_query">Agreed with query</option>
                            <option value="unable_to_determine">Unable to determine</option>
                            <option value="additional_workup_needed">Additional workup needed</option>
                            <option value="disagreed_with_query">Disagreed with query</option>
                          </select>
                          <label className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(draft.documentationImproved)}
                              onChange={(e) => updateDraft(query.id, { documentationImproved: e.target.checked })}
                            />
                            Documentation improved
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(draft.drgChanged)}
                              onChange={(e) => updateDraft(query.id, { drgChanged: e.target.checked })}
                            />
                            DRG changed
                          </label>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleAnswerQuery(query)}
                            disabled={savingAnswerId === query.id}
                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-60"
                          >
                            {savingAnswerId === query.id ? 'Saving...' : 'Submit Response'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">CDI Documentation Guidance (AI)</h3>
              <p className="text-sm text-slate-500">Search coding/documentation guidance to improve physician query quality</p>
            </div>
          </div>
          <button
            onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
            className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
          >
            {showGuidelineSearch ? 'Hide Search' : 'Search Guidance'}
          </button>
        </div>

        {showGuidelineSearch && (
          <GuidelineSearchPanel
            searchFn={(q) => cdssApi.searchGuidelines(`CDI: ${q}`, token, tenantSlug!)}
            contextLabel="CDI"
          />
        )}
      </div>

      {currentUser.role !== 'doctor' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">CDI Dashboard</h3>
          <p className="text-slate-600">View CDI metrics, physician query workflow status, and documentation quality trends.</p>
        </div>
      )}
      </div>
    </div>
  );
};

export default CdiDashboard;
