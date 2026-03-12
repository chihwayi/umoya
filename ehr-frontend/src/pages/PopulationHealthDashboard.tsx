import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  Loader2,
  ListPlus,
  RefreshCw,
  Phone,
  Brain,
  Search,
  BookOpen,
  ShieldCheck,
  ClipboardCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { cdssApi, populationHealthApi } from '../services/api';

interface PopulationHealthDashboardProps {
  embedded?: boolean;
}

type WorklistFocus = 'all' | 'high-risk' | 'uncontrolled' | 'overdue-review' | 'care-gaps';

const PopulationHealthDashboard: React.FC<PopulationHealthDashboardProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('ehr_user') || '{}'), []);
  const isDoctor = currentUser?.role === 'doctor';

  const [dashboard, setDashboard] = useState<{
    totalByCondition?: Record<string, number>;
    totalByRisk?: Record<string, number>;
    overdueReviews?: number;
    uncontrolledCount?: number;
    total?: number;
  } | null>(null);
  const [recallLists, setRecallLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [worklistLoading, setWorklistLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListConditionType, setNewListConditionType] = useState('all');
  const [newListHighRiskOnly, setNewListHighRiskOnly] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [worklistSummary, setWorklistSummary] = useState<any>(null);
  const [worklistItems, setWorklistItems] = useState<any[]>([]);
  const [operationalBrief, setOperationalBrief] = useState<any>(null);
  const [worklistFocus, setWorklistFocus] = useState<WorklistFocus>('all');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [updatingReminderId, setUpdatingReminderId] = useState<string | null>(null);
  const [reviewingRegistryId, setReviewingRegistryId] = useState<string | null>(null);

  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const conditionTypes = [
    'all',
    'hypertension',
    'diabetes',
    'asthma',
    'copd',
    'ckd',
    'heart_failure',
    'obesity',
    'depression',
    'other',
  ];

  const loadWorklist = async (silent: boolean = false) => {
    if (!isDoctor || !token || !tenantSlug) {
      setWorklistSummary(null);
      setWorklistItems([]);
      setOperationalBrief(null);
      return;
    }
    try {
      setWorklistLoading(true);
      const [worklistRes, briefRes] = await Promise.all([
        populationHealthApi.getDoctorWorklist(token, tenantSlug, {
          focus: worklistFocus,
          includeResolved,
          limit: 80,
        }),
        populationHealthApi
          .getOperationalBrief(token, tenantSlug, {
            focus: worklistFocus,
            includeResolved,
            limit: 100,
          })
          .catch(() => ({ data: null })),
      ]);
      setWorklistSummary(worklistRes.data?.summary || null);
      setWorklistItems(worklistRes.data?.items || []);
      setOperationalBrief(briefRes.data || null);
    } catch (e: any) {
      if (!silent) {
        showError('Worklist Error', e?.response?.data?.message || 'Failed to load doctor worklist');
      }
      setWorklistSummary(null);
      setWorklistItems([]);
      setOperationalBrief(null);
    } finally {
      setWorklistLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashRes, listsRes] = await Promise.all([
        populationHealthApi.getRegistryDashboard(token, tenantSlug || ''),
        populationHealthApi.getRecallLists(token, tenantSlug || ''),
      ]).catch((e) => {
        showError('Error', e?.response?.data?.message || 'Failed to load population health data');
        return [{ data: null }, { data: [] }];
      });
      setDashboard(dashRes.data || null);
      setRecallLists(listsRes.data || []);
      await loadWorklist(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantSlug, worklistFocus, includeResolved]);

  const handleGeneratePreventive = async (patientId?: string) => {
    try {
      setGenerating(true);
      const res = await populationHealthApi.generatePreventiveCare(
        token,
        tenantSlug || '',
        patientId ? { patientId } : undefined,
      );
      showSuccess(
        'Done',
        patientId
          ? `Generated ${res.data?.generated ?? 0} reminders for this patient.`
          : `Generated ${res.data?.generated ?? 0} preventive care reminders.`,
      );
      loadData();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to generate reminders');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateRecallList = async () => {
    if (!newListName.trim()) return;
    try {
      const criteria: Record<string, any> = { overdueScreenings: true };
      if (newListConditionType !== 'all') {
        criteria.conditionType = newListConditionType;
      }
      if (newListHighRiskOnly) {
        criteria.riskLevel = 'high';
      }
      await populationHealthApi.createRecallList(
        { name: newListName.trim(), criteria },
        token,
        tenantSlug || '',
      );
      showSuccess('Created', `Recall list "${newListName}" created.`);
      setNewListName('');
      setNewListConditionType('all');
      setNewListHighRiskOnly(false);
      setShowNewList(false);
      loadData();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to create list');
    }
  };

  const handleGenerateList = async (listId: string) => {
    try {
      const res = await populationHealthApi.generateRecallList(listId, token, tenantSlug || '');
      showSuccess('Updated', `List now has ${res.data?.patientIds?.length ?? 0} patients.`);
      loadData();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to generate list');
    }
  };

  const handleNotifyList = async (listId: string) => {
    try {
      const res = await populationHealthApi.notifyRecallList(listId, token, tenantSlug || '', {
        channel: 'sms',
      });
      showSuccess('Notified', `Recall list: ${res.data?.patientIds?.length ?? 0} patients (placeholder; no SMS sent).`);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to notify');
    }
  };

  const handleUpdateReminderStatus = async (
    reminderId: string,
    status: 'completed' | 'deferred',
  ) => {
    try {
      setUpdatingReminderId(reminderId);
      await populationHealthApi.updatePreventiveReminderStatus(
        reminderId,
        {
          status,
          notes: status === 'deferred' ? 'Deferred by clinician from doctor population worklist' : undefined,
        },
        token,
        tenantSlug || '',
      );
      showSuccess('Updated', `Reminder marked as ${status}.`);
      await loadWorklist(true);
      const dashRes = await populationHealthApi.getRegistryDashboard(token, tenantSlug || '');
      setDashboard(dashRes.data || null);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to update reminder');
    } finally {
      setUpdatingReminderId(null);
    }
  };

  const handleReviewRegistryEntry = async (item: any) => {
    const suggestedDays =
      Number.isFinite(Number(item?.reviewDeltaDays)) && Number(item.reviewDeltaDays) > 0
        ? Number(item.reviewDeltaDays)
        : 90;
    const nextReviewInput = window.prompt('Next review interval in days', String(suggestedDays));
    if (nextReviewInput === null) return;
    const reviewIntervalDays = Number(nextReviewInput);
    if (!Number.isFinite(reviewIntervalDays) || reviewIntervalDays <= 0) {
      showError('Invalid Value', 'Please enter a valid number of days for the next review.');
      return;
    }
    const reviewNote = window.prompt('Optional review note', '') || undefined;

    try {
      setReviewingRegistryId(item.id);
      await populationHealthApi.reviewRegistryEntry(
        item.id,
        {
          reviewIntervalDays: Math.round(reviewIntervalDays),
          reviewNote,
          status: item.conditionStatus === 'uncontrolled' ? 'active' : undefined,
        },
        token,
        tenantSlug || '',
      );
      showSuccess('Saved', 'Review recorded and next review date updated.');
      await loadWorklist(true);
      const dashRes = await populationHealthApi.getRegistryDashboard(token, tenantSlug || '');
      setDashboard(dashRes.data || null);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to record registry review');
    } finally {
      setReviewingRegistryId(null);
    }
  };

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim() || !token || !tenantSlug) return;
    try {
      setLoadingGuidelines(true);
      const response = await cdssApi.searchGuidelines(
        guidelineQuery,
        token,
        tenantSlug,
        6,
        { module: 'population_health', role: currentUser?.role || 'doctor' },
      );
      setGuidelineResults(response.data?.citations || []);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to search population-health guidance');
      setGuidelineResults([]);
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const getPriorityPill = (priority: string) => {
    const value = String(priority || '').toLowerCase();
    if (value === 'critical') return 'bg-red-100 text-red-700 border border-red-200';
    if (value === 'high') return 'bg-orange-100 text-orange-700 border border-orange-200';
    if (value === 'moderate') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-green-100 text-green-700 border border-green-200';
  };

  const getSlaPill = (sla: string) => {
    const value = String(sla || '').toLowerCase();
    if (value === 'overdue') return 'bg-red-100 text-red-700 border border-red-200';
    if (value === 'warning') return 'bg-amber-100 text-amber-700 border border-amber-200';
    if (value === 'resolved') return 'bg-green-100 text-green-700 border border-green-200';
    return 'bg-cyan-100 text-cyan-700 border border-cyan-200';
  };

  const getRiskPill = (risk: string) => {
    const value = String(risk || '').toLowerCase();
    if (value === 'critical' || value === 'high') return 'bg-rose-100 text-rose-700 border border-rose-200';
    if (value === 'moderate') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  };

  const formatScreening = (name: string) => name.replace(/_/g, ' ');

  if (loading && !dashboard) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-12' : 'min-h-screen'}`}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading population health...</p>
        </div>
      </div>
    );
  }

  const totalByCondition = dashboard?.totalByCondition || {};
  const totalByRisk = dashboard?.totalByRisk || {};
  const overdueReviews = dashboard?.overdueReviews ?? 0;
  const uncontrolledCount = dashboard?.uncontrolledCount ?? 0;
  const total = dashboard?.total ?? 0;

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {!embedded && (
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() =>
                    navigate(
                      `/ehr/${tenantSlug}/${currentUser?.role === 'doctor' ? 'doctor' : currentUser?.role === 'nurse' ? 'nurse' : 'dashboard'}`,
                    )
                  }
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Users className="w-8 h-8" />
                    Population Health
                  </h1>
                  <p className="text-teal-100 mt-1">Registry, preventive care & recall lists</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${embedded ? 'pb-4' : 'pt-8 pb-8'}`}>
        {isDoctor && (
          <div className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-teal-50 to-cyan-100/80 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'high-risk', label: 'High Risk' },
                { key: 'uncontrolled', label: 'Uncontrolled' },
                { key: 'overdue-review', label: 'Overdue Review' },
                { key: 'care-gaps', label: 'Care Gaps' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setWorklistFocus(item.key as WorklistFocus)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    worklistFocus === item.key
                      ? 'bg-cyan-700 text-white shadow'
                      : 'bg-white text-cyan-700 border border-cyan-200 hover:bg-cyan-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-xs font-medium text-cyan-800">
                <input
                  type="checkbox"
                  checked={includeResolved}
                  onChange={(e) => setIncludeResolved(e.target.checked)}
                />
                Include resolved
              </label>
              <button
                onClick={() => loadWorklist()}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-cyan-700 border border-cyan-200 hover:bg-cyan-100 text-xs font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${worklistLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowGuidelineSearch((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-700 text-white hover:bg-cyan-800 text-xs font-semibold"
              >
                <Brain className="w-3.5 h-3.5" />
                Population AI Guidance
              </button>
            </div>
          </div>
        )}

        {isDoctor && (
          <div className="mb-6 rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Operational Brief</h2>
              <button
                onClick={() => loadWorklist()}
                className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
              >
                Refresh Brief
              </button>
            </div>
            {!operationalBrief ? (
              <p className="text-sm text-slate-600">Operational brief unavailable for current filters.</p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700">High Priority</p>
                    <p className="mt-1 text-2xl font-bold text-red-800">{operationalBrief.summary?.highPriorityCount ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Overdue Reviews</p>
                    <p className="mt-1 text-2xl font-bold text-orange-800">{operationalBrief.summary?.overdueReviews ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Overdue Gaps</p>
                    <p className="mt-1 text-2xl font-bold text-rose-800">{operationalBrief.summary?.patientsWithOverdueCareGaps ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Missing Review Date</p>
                    <p className="mt-1 text-2xl font-bold text-cyan-800">{operationalBrief.summary?.missingNextReviewCount ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Missing Plan</p>
                    <p className="mt-1 text-2xl font-bold text-violet-800">{operationalBrief.summary?.missingManagementPlanCount ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">CDSS Coverage</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-800">{operationalBrief.summary?.cdssCoveragePercent ?? 0}%</p>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-cyan-100 px-2.5 py-1 font-semibold text-cyan-800">
                    Uncontrolled no recent review: {operationalBrief.summary?.uncontrolledNoRecentReviewCount ?? 0}
                  </span>
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-800">
                    Overdue outreach not sent: {operationalBrief.summary?.overdueOutreachNotSentCount ?? 0}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                    Avg risk: {operationalBrief.summary?.avgRiskScore ?? 0}
                  </span>
                </div>

                {Array.isArray(operationalBrief.highPriorityQueue) && operationalBrief.highPriorityQueue.length > 0 && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">High-Priority Queue</p>
                    <div className="space-y-2">
                      {operationalBrief.highPriorityQueue.slice(0, 5).map((item: any) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.patientName} {item.patientNumber ? `(${item.patientNumber})` : ''}
                          </p>
                          <p className="text-xs text-slate-600">
                            {item.conditionName} • {String(item.priority || 'low').toUpperCase()} priority • {item.careGapCount ?? 0} care gaps
                          </p>
                          {Array.isArray(item.cdssFlags) && item.cdssFlags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.cdssFlags.slice(0, 2).map((flag: string, idx: number) => (
                                <span
                                  key={`${item.id}-flag-${idx}`}
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
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-700">Recommended Actions</p>
                    <ul className="space-y-1 text-sm text-cyan-900">
                      {operationalBrief.recommendations.slice(0, 5).map((recommendation: string, idx: number) => (
                        <li key={`population-brief-rec-${idx}`}>- {recommendation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className={`grid grid-cols-1 ${isDoctor ? 'md:grid-cols-6' : 'md:grid-cols-4'} gap-4 mb-8`}>
          <div className="bg-white/90 rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Registry total</p>
                <p className="text-4xl font-bold text-teal-600">{total}</p>
              </div>
              <Users className="w-8 h-8 text-teal-600" />
            </div>
          </div>
          <div className="bg-white/90 rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Overdue reviews</p>
                <p className="text-4xl font-bold text-amber-600">{overdueReviews}</p>
              </div>
              <Calendar className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <div className="bg-white/90 rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Uncontrolled</p>
                <p className="text-4xl font-bold text-red-600">{uncontrolledCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          {isDoctor && (
            <>
              <div className="bg-white/90 rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">High priority</p>
                    <p className="text-4xl font-bold text-orange-600">
                      {(worklistSummary?.critical || 0) + (worklistSummary?.high || 0)}
                    </p>
                  </div>
                  <ShieldCheck className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              <div className="bg-white/90 rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Patients with care gaps</p>
                    <p className="text-4xl font-bold text-rose-600">{worklistSummary?.patientsWithCareGaps ?? 0}</p>
                  </div>
                  <ClipboardCheck className="w-8 h-8 text-rose-600" />
                </div>
              </div>
              <div className="bg-white/90 rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Average risk score</p>
                    <p className="text-4xl font-bold text-cyan-700">{worklistSummary?.avgRiskScore ?? 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-cyan-700" />
                </div>
              </div>
            </>
          )}
          <div className="bg-white/90 rounded-xl p-5 border border-slate-200 shadow-sm">
            <button
              onClick={() => handleGeneratePreventive()}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              <span>Generate preventive care</span>
            </button>
          </div>
        </div>

        {isDoctor && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl border border-cyan-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-cyan-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Doctor population worklist</h2>
                <span className="text-xs font-semibold text-cyan-700 bg-cyan-100 px-2.5 py-1 rounded-full">
                  {worklistSummary?.total ?? worklistItems.length} active patients
                </span>
              </div>
              <div className="p-5 space-y-4">
                {worklistLoading ? (
                  <div className="py-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-700" />
                    Loading prioritized worklist...
                  </div>
                ) : worklistItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    No patients found for this population-health filter.
                  </div>
                ) : (
                  worklistItems.map((item: any) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-cyan-100 bg-gradient-to-r from-cyan-50/70 via-white to-teal-50/70 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {item.patientName}{' '}
                            <span className="text-sm font-normal text-slate-500">({item.patientNumber || 'N/A'})</span>
                          </p>
                          <p className="text-sm text-slate-600">
                            {item.conditionName} ({String(item.conditionType || '').replace(/_/g, ' ')}) ·{' '}
                            {item.patientAge ?? 'N/A'}y {item.patientGender ? `· ${item.patientGender}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getPriorityPill(item.priority)}`}>
                            {item.priority}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRiskPill(item.riskLevel)}`}>
                            risk {item.riskLevel}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getSlaPill(item.slaStatus)}`}>
                            review {item.slaStatus}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Risk score</p>
                          <p className="text-xl font-bold text-cyan-700">{item.riskScore ?? 0}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Care gaps</p>
                          <p className="text-xl font-bold text-rose-700">{item.careGapCount ?? 0}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Overdue gaps</p>
                          <p className="text-xl font-bold text-red-700">{item.overdueCareGapCount ?? 0}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Next review</p>
                          <p className="text-sm font-semibold text-slate-800">
                            {item.nextReviewDate ? new Date(item.nextReviewDate).toLocaleDateString() : 'Not set'}
                          </p>
                        </div>
                      </div>

                      {Array.isArray(item.recommendedActions) && item.recommendedActions.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            Recommended actions
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.recommendedActions.map((action: string, idx: number) => (
                              <span
                                key={`${item.id}-action-${idx}`}
                                className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 text-xs font-medium"
                              >
                                {action}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Array.isArray(item.pendingReminders) && item.pendingReminders.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            Preventive care gaps
                          </p>
                          <div className="space-y-2">
                            {item.pendingReminders.slice(0, 3).map((reminder: any) => (
                              <div
                                key={reminder.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-800 capitalize">
                                    {formatScreening(reminder.screeningType || 'screening')}
                                  </p>
                                  <p className="text-xs text-slate-600">
                                    {reminder.status}
                                    {reminder.dueDate ? ` · due ${new Date(reminder.dueDate).toLocaleDateString()}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleUpdateReminderStatus(reminder.id, 'completed')}
                                    disabled={updatingReminderId === reminder.id}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {updatingReminderId === reminder.id ? 'Saving...' : 'Mark complete'}
                                  </button>
                                  <button
                                    onClick={() => handleUpdateReminderStatus(reminder.id, 'deferred')}
                                    disabled={updatingReminderId === reminder.id}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                                  >
                                    Defer
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleReviewRegistryEntry(item)}
                          disabled={reviewingRegistryId === item.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-700 text-white hover:bg-cyan-800 text-xs font-semibold disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {reviewingRegistryId === item.id ? 'Saving review...' : 'Record review'}
                        </button>
                        <button
                          onClick={() => handleGeneratePreventive(item.patientId)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-cyan-200 text-cyan-700 hover:bg-cyan-50 text-xs font-semibold"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Regenerate care gaps
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showGuidelineSearch && (
          <div className="mb-8 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-teal-50 to-cyan-100/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-cyan-900 flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Population Health AI Guidance
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="text"
                value={guidelineQuery}
                onChange={(e) => setGuidelineQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGuidelineSearch();
                }}
                placeholder="Search guidance: uncontrolled diabetes outreach"
                className="flex-1 min-w-[240px] rounded-lg border border-cyan-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-700 text-white hover:bg-cyan-800 text-sm font-semibold disabled:opacity-60"
              >
                {loadingGuidelines ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
            <div className="space-y-2">
              {guidelineResults.length === 0 ? (
                <p className="text-sm text-cyan-800/80">No guidance loaded yet.</p>
              ) : (
                guidelineResults.map((citation: any, idx: number) => (
                  <article key={`citation-${idx}`} className="rounded-lg border border-cyan-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-cyan-700" />
                      {citation.title || citation.source || `Guideline ${idx + 1}`}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{citation.snippet || citation.content || 'No excerpt provided.'}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {/* By condition / By risk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-cyan-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-white">
              <h2 className="text-lg font-semibold text-slate-800">By condition type</h2>
            </div>
            <div className="p-5">
              {Object.keys(totalByCondition).length === 0 ? (
                <p className="text-slate-500 text-sm">No registry entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(totalByCondition).map(([k, v]) => (
                    <li key={k} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-700">{k.replace(/_/g, ' ')}</span>
                      <span className="font-medium text-slate-900">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-cyan-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-white">
              <h2 className="text-lg font-semibold text-slate-800">By risk level</h2>
            </div>
            <div className="p-5">
              {Object.keys(totalByRisk).length === 0 ? (
                <p className="text-slate-500 text-sm">No registry entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(totalByRisk).map(([k, v]) => (
                    <li key={k} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-700">{k}</span>
                      <span className="font-medium text-slate-900">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Recall lists */}
        <div className="bg-white rounded-xl border border-cyan-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-white flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recall lists</h2>
            {!showNewList ? (
              <button
                onClick={() => setShowNewList(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm"
              >
                <ListPlus className="w-4 h-4" />
                New list
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-48"
                />
                <select
                  value={newListConditionType}
                  onChange={(e) => setNewListConditionType(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {conditionTypes.map((conditionType) => (
                    <option key={conditionType} value={conditionType}>
                      {conditionType === 'all' ? 'All conditions' : conditionType.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 px-2">
                  <input
                    type="checkbox"
                    checked={newListHighRiskOnly}
                    onChange={(e) => setNewListHighRiskOnly(e.target.checked)}
                  />
                  High risk only
                </label>
                <button
                  onClick={handleCreateRecallList}
                  className="px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewList(false);
                    setNewListName('');
                    setNewListConditionType('all');
                    setNewListHighRiskOnly(false);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="p-5">
            {recallLists.length === 0 ? (
              <p className="text-slate-500 text-sm">No recall lists. Create one to generate patient lists and send reminders.</p>
            ) : (
              <ul className="space-y-3">
                {recallLists.map((list: any) => (
                  <li
                    key={list.id}
                    className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{list.name}</p>
                      <p className="text-sm text-slate-500">
                        {list.patientCount ?? 0} patients
                        {list.lastGeneratedAt
                          ? ` · Generated ${new Date(list.lastGeneratedAt).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateList(list.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Generate
                      </button>
                      <button
                        onClick={() => handleNotifyList(list.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-100 text-cyan-800 hover:bg-cyan-200 text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        Notify (SMS)
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PopulationHealthDashboard;
