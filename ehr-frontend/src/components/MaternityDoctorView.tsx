import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Baby,
  Heart,
  AlertTriangle,
  Calendar,
  CalendarRange,
  Stethoscope,
  FileText,
  TrendingUp,
  Sparkles,
  Activity,
  Brain,
  Clock4,
  ClipboardList,
  CheckCircle,
  Search,
  BookOpen,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import MaternityEnrollmentDetailModal from './MaternityEnrollmentDetailModal';
import { GuidelineSearchPanel } from './GuidelineSearchPanel';
import MaternalMortalityDashboard from './MaternalMortalityDashboard';

interface MaternityDoctorViewProps {
  tenantSlug: string;
  token: string;
}

export default function MaternityDoctorView({ tenantSlug, token }: MaternityDoctorViewProps) {
  const [careTasks, setCareTasks] = useState<any[]>([]);
  const [careTaskMetrics, setCareTaskMetrics] = useState<any>(null);
  const [highRiskPregnancies, setHighRiskPregnancies] = useState<any[]>([]);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState<any[]>([]);
  const [overdueANC, setOverdueANC] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any>(null);
  const [neonatalOutcomes, setNeonatalOutcomes] = useState<any[]>([]);
  const [postnatalVisits, setPostnatalVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [applyingTaskId, setApplyingTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'high-risk' | 'deliveries' | 'overdue' | 'mortality'>('high-risk');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  
  const { showError, showSuccess, showInfo } = useNotification();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const careTasksRes = await ehrApi.getMaternityCareTasks(tenantSlug, token);
      const taskRows = Array.isArray(careTasksRes?.data)
        ? careTasksRes?.data
        : careTasksRes?.data?.tasks || [];
      setCareTasks(taskRows);

      const careTaskMetricsRes = await ehrApi.getMaternityCareTaskMetrics(tenantSlug, token);
      setCareTaskMetrics(careTaskMetricsRes?.data || null);

      const highRiskRes = await ehrApi.getHighRiskPregnancies(tenantSlug, token);
      const highRiskRows = Array.isArray(highRiskRes?.data)
        ? highRiskRes?.data
        : highRiskRes?.data?.pregnancies || highRiskRes?.data?.enrollments || [];
      setHighRiskPregnancies(highRiskRows);

      const upcomingRes = await ehrApi.getUpcomingDeliveries(tenantSlug, token);
      const upcomingRows = Array.isArray(upcomingRes?.data)
        ? upcomingRes?.data
        : upcomingRes?.data?.deliveries || upcomingRes?.data?.enrollments || [];
      setUpcomingDeliveries(upcomingRows);

      const overdueRes = await ehrApi.getOverdueANC(tenantSlug, token);
      const overdueRows = Array.isArray(overdueRes?.data)
        ? overdueRes?.data
        : overdueRes?.data?.patients || overdueRes?.data?.enrollments || [];
      setOverdueANC(overdueRows);

      const indicatorsRes = await ehrApi.getMaternityIndicators(tenantSlug, token);
      setIndicators(indicatorsRes.data || null);

      const neonatalRes = await ehrApi.getRecentNeonatalOutcomes(tenantSlug, token);
      const neonatalRows = Array.isArray(neonatalRes?.data)
        ? neonatalRes?.data
        : neonatalRes?.data?.outcomes || [];
      setNeonatalOutcomes(neonatalRows);

      const postnatalRes = await ehrApi.getRecentPostnatalVisits(tenantSlug, token);
      const postnatalRows = Array.isArray(postnatalRes?.data)
        ? postnatalRes?.data
        : postnatalRes?.data?.visits || [];
      setPostnatalVisits(postnatalRows);
    } catch (error) {
      console.error('Failed to load maternity data:', error);
      showError('Failed to load maternity data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showError, tenantSlug, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getRiskBadge = (riskCategory: string) => {
    const styles = {
      low: 'bg-green-100 text-green-800 border-green-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      high: 'bg-red-100 text-red-800 border-red-300',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[riskCategory as keyof typeof styles] || styles.low}`}>
        {riskCategory.toUpperCase()} RISK
      </span>
    );
  };

  const evaluateRisk = useCallback(
    (row: any) => {
      let score = 0;
      const reasons: string[] = [];

      if (row.risk_category === 'high') {
        score += 4;
        reasons.push('High-risk pregnancy');
      } else if (row.risk_category === 'medium') {
        score += 2;
        reasons.push('Medium risk');
      }

      const ancVisits = row.anc_visit_count ?? 0;
      if (ancVisits < 4 && row.enrollment_status === 'active') {
        score += 2;
        reasons.push('ANC visits below 4');
      }

      if (row.days_to_edd != null) {
        if (row.days_to_edd < 0) {
          score += 3;
          reasons.push('EDD overdue');
        } else if (row.days_to_edd <= 7) {
          score += 2;
          reasons.push('EDD within 7 days');
        }
      }

      const overdueRecord = overdueANC.find((item: any) => item.id === row.id);
      if (overdueRecord && (overdueRecord.days_overdue ?? 0) > 0) {
        score += 2;
        reasons.push(`ANC overdue ${overdueRecord.days_overdue} days`);
      }

      const level = score >= 7 ? 'critical' : score >= 5 ? 'high' : score >= 3 ? 'moderate' : 'low';
      return { score, level, reasons };
    },
    [overdueANC],
  );

  const timelineEvents = useMemo(() => {
    const events: Array<{
      date: Date;
      label: string;
      type: 'high-risk' | 'delivery' | 'anc';
      enrollmentId?: string;
      meta?: any;
    }> = [];

    highRiskPregnancies.forEach((row) => {
      if (!row.expected_delivery_date) return;
      const date = new Date(row.expected_delivery_date);
      events.push({
        date,
        label: `${row.patient_name} • High-risk follow-up`,
        type: 'high-risk',
        enrollmentId: row.id,
        meta: row,
      });
    });

    upcomingDeliveries.forEach((row) => {
      if (!row.expected_delivery_date) return;
      const date = new Date(row.expected_delivery_date);
      events.push({
        date,
        label: `${row.patient_name} • Anticipated delivery`,
        type: 'delivery',
        enrollmentId: row.id,
        meta: row,
      });
    });

    overdueANC.forEach((row) => {
      if (!row.next_visit_date) return;
      const date = new Date(row.next_visit_date);
      events.push({
        date,
        label: `${row.patient_name} • Missed ANC visit`,
        type: 'anc',
        enrollmentId: row.id,
        meta: row,
      });
    });

    return events
      .filter((event) => !Number.isNaN(event.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 12);
  }, [highRiskPregnancies, upcomingDeliveries, overdueANC]);

  const laborQueue = useMemo(
    () => upcomingDeliveries.filter((row) => row.days_to_edd != null && row.days_to_edd >= 0 && row.days_to_edd <= 3),
    [upcomingDeliveries],
  );

  const summaryCards = useMemo(() => {
    const deliveriesThisMonth = indicators?.total_deliveries ?? upcomingDeliveries.length;
    const highRiskTotal = indicators?.high_risk_count ?? highRiskPregnancies.length;

    return [
      {
        label: 'Active Escalations',
        value: careTasks.length,
        tone: 'from-red-600 to-rose-600',
        icon: <ClipboardList className="w-5 h-5" />,
      },
      {
        label: 'SLA Breaches',
        value: careTaskMetrics?.overdue_tasks ?? 0,
        tone: 'from-amber-600 to-orange-600',
        icon: <Clock4 className="w-5 h-5" />,
      },
      {
        label: 'High-Risk Cases',
        value: highRiskTotal,
        tone: 'from-red-500 to-rose-500',
        icon: <AlertTriangle className="w-5 h-5" />,
      },
      {
        label: 'Deliveries in 30 days',
        value: upcomingDeliveries.length,
        tone: 'from-pink-500 to-fuchsia-500',
        icon: <Calendar className="w-5 h-5" />,
      },
      {
        label: 'ANC Overdue',
        value: overdueANC.length,
        tone: 'from-amber-500 to-orange-500',
        icon: <Clock4 className="w-5 h-5" />,
      },
      {
        label: 'Deliveries this month',
        value: deliveriesThisMonth,
        tone: 'from-violet-500 to-indigo-500',
        icon: <TrendingUp className="w-5 h-5" />,
      },
    ];
  }, [careTaskMetrics?.overdue_tasks, careTasks.length, highRiskPregnancies.length, upcomingDeliveries.length, overdueANC.length, indicators]);

  const clinicalPrompts = useMemo(() => {
    const prompts: Array<{ title: string; description: string; icon: React.ReactNode; tone: string }> = [];

    const criticalEscalations = careTasks.filter((task) => task.priority === 'critical');
    if (criticalEscalations.length > 0) {
      prompts.push({
        title: 'Critical escalations',
        description: `${criticalEscalations.length} maternity escalations are marked critical and need senior doctor action.`,
        icon: <AlertTriangle className="w-5 h-5" />,
        tone: 'from-red-600 to-rose-600',
      });
    }

    if (laborQueue.length > 0) {
      prompts.push({
        title: 'Labor readiness',
        description: `${laborQueue.length} patients are within 3 days of EDD. Confirm theater availability and on-call specialists.`,
        icon: <CalendarRange className="w-5 h-5" />,
        tone: 'from-pink-500 to-rose-500',
      });
    }

    const overdueCritical = overdueANC.filter((row) => (row.days_overdue ?? 0) > 7);
    if (overdueCritical.length > 0) {
      prompts.push({
        title: 'ANC escalation',
        description: `${overdueCritical.length} patients missed ANC follow-up by >7 days. Consider direct outreach or referral.`,
        icon: <AlertTriangle className="w-5 h-5" />,
        tone: 'from-amber-500 to-orange-500',
      });
    }

    return prompts;
  }, [careTasks, laborQueue, overdueANC]);

  const openEnrollmentDetail = useCallback((id: string) => {
    setSelectedEnrollmentId(id);
    setShowDetailModal(true);
  }, []);

  const handleTaskTransition = useCallback(
    async (taskId: string, status: 'acknowledged' | 'actioned' | 'closed') => {
      try {
        setUpdatingTaskId(taskId);
        await ehrApi.updateMaternityCareTaskStatus(tenantSlug, token, taskId, { status });
        showSuccess('Care task updated', `Task moved to ${status}.`);
        await loadData();
      } catch (error) {
        console.error('Failed to update maternity care task', error);
        showError('Unable to update maternity care task', 'Please retry.');
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [loadData, showError, showSuccess, tenantSlug, token],
  );

  const handleApplyRecommendations = useCallback(
    async (task: any) => {
      const pendingItems = (task?.task_context?.recommendation_bundle?.items || []).filter(
        (item: any) =>
          ['order', 'lab_order', 'referral'].includes(item?.type) && item?.status !== 'applied',
      );

      if (pendingItems.length === 0) {
        showInfo('Recommendations already applied', 'No pending actionable bundle items remain for this task.');
        return;
      }

      try {
        setApplyingTaskId(task.id);
        const response = await ehrApi.applyMaternityCareTaskRecommendations(tenantSlug, token, task.id);
        const appliedCount = response?.data?.applied_count ?? pendingItems.length;
        showSuccess(
          'Recommendation bundle applied',
          `${appliedCount} doctor action${appliedCount === 1 ? '' : 's'} created from the maternity CDSS bundle.`,
        );
        await loadData();
      } catch (error) {
        console.error('Failed to apply maternity recommendation bundle', error);
        showError('Unable to apply maternity recommendation bundle', 'Please retry.');
      } finally {
        setApplyingTaskId(null);
      }
    },
    [loadData, showError, showInfo, showSuccess, tenantSlug, token],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Maternity Referrals & High-Risk Cases</h2>
          <p className="text-sm text-gray-600 mt-1">Clinical oversight for high-risk pregnancies, urgent deliveries, and ANC escalations</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-xl border border-slate-200 bg-gradient-to-r ${card.tone} text-white p-4 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/70">{card.label}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {clinicalPrompts.length > 0 && (
        <div className="bg-white rounded-lg border border-pink-100 shadow p-4">
          <div className="flex items-center gap-2 text-pink-600 mb-3">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">Clinical Prompts</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clinicalPrompts.map((prompt) => (
              <div key={prompt.title} className={`rounded-xl border border-pink-100 bg-gradient-to-r ${prompt.tone} text-white p-4 shadow-sm`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">{prompt.icon}</div>
                  <div>
                    <p className="text-sm font-semibold">{prompt.title}</p>
                    <p className="text-xs text-white/90 mt-1">{prompt.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-700">
            <ClipboardList className="w-5 h-5" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">Active Escalations</h3>
          </div>
          <span className="text-xs text-slate-500">{careTasks.length} active</span>
        </div>
        {careTaskMetrics && (
          <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Overdue</p>
              <p className="text-lg font-bold text-slate-900">{careTaskMetrics.overdue_tasks ?? 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Critical open</p>
              <p className="text-lg font-bold text-slate-900">{careTaskMetrics.critical_open_tasks ?? 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Oldest open</p>
              <p className="text-lg font-bold text-slate-900">{careTaskMetrics.oldest_open_hours ?? 0}h</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Average age</p>
              <p className="text-lg font-bold text-slate-900">{careTaskMetrics.average_open_hours ?? 0}h</p>
            </div>
          </div>
        )}
        {careTasks.length === 0 ? (
          <p className="text-sm text-slate-500">No open maternity escalation tasks.</p>
        ) : (
          <div className="space-y-3">
            {careTasks.map((task: any) => (
              <div
                key={task.id}
                className={`rounded-xl border p-4 ${
                  task.priority === 'critical'
                    ? 'border-red-200 bg-red-50/70'
                    : task.priority === 'high'
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-slate-200 bg-slate-50'
                }`}
              >
                {(() => {
                  const recommendationBundle = task.task_context?.recommendation_bundle;
                  const recommendationItems = recommendationBundle?.items || [];
                  const actionableItems = recommendationItems.filter((item: any) =>
                    ['order', 'lab_order', 'referral'].includes(item?.type),
                  );
                  const pendingItems = actionableItems.filter((item: any) => item?.status !== 'applied');
                  return (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                          task.priority === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : task.priority === 'high'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {task.priority}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase text-slate-600">
                        {String(task.status || 'open').replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{task.summary || 'Escalation pending review.'}</p>
                    <p className="text-xs text-slate-500">
                      {task.patient_name} • {task.patient_number} • {task.enrollment_number}
                    </p>
                    <p className="text-xs text-slate-500">
                      Age {task.age_hours ?? 0}h • SLA {task.sla_status?.replace('_', ' ') || 'within sla'}
                    </p>
                    {(task.required_actions?.length ?? 0) > 0 && (
                      <p className="text-xs text-slate-600">
                        Required: {task.required_actions.slice(0, 2).join(' | ')}
                      </p>
                    )}
                    {((task.task_context?.guideline_citations?.length ?? 0) > 0) && (
                      <p className="text-xs text-slate-600">
                        Citation: {task.task_context.guideline_citations[0]?.source}: {task.task_context.guideline_citations[0]?.citation}
                      </p>
                    )}
                    {recommendationBundle && (
                      <div className="rounded-lg border border-sky-100 bg-white/80 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                            {recommendationBundle.bundle_label || 'Recommendation bundle'}
                          </p>
                          <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                            {recommendationBundle.pending_count ?? pendingItems.length} pending
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                            {recommendationBundle.applied_count ?? 0} applied
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {recommendationBundle.summary || 'Structured doctor action bundle generated from maternity rules.'}
                        </p>
                        {recommendationItems.slice(0, 3).map((item: any) => (
                          <div key={`${task.id}-rec-${item.id}`} className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700">
                                {String(item.type || 'action').replace('_', ' ')}
                              </span>
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">
                                {item.urgency || 'routine'}
                              </span>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                                  item.status === 'applied'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {item.status || 'pending'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-slate-700">{item.title}</p>
                            <p className="text-xs text-slate-500">{item.rationale}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pendingItems.length > 0 && (
                      <button
                        onClick={() => handleApplyRecommendations(task)}
                        disabled={applyingTaskId === task.id}
                        className="rounded-lg bg-fuchsia-600 px-3 py-2 text-xs font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-60"
                      >
                        {applyingTaskId === task.id ? 'Applying bundle...' : `Apply Bundle (${pendingItems.length})`}
                      </button>
                    )}
                    {task.status === 'open' && (
                      <button
                        onClick={() => handleTaskTransition(task.id, 'acknowledged')}
                        disabled={updatingTaskId === task.id}
                        className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                      >
                        Acknowledge
                      </button>
                    )}
                    {(task.status === 'open' || task.status === 'acknowledged') && (
                      <button
                        onClick={() => handleTaskTransition(task.id, 'actioned')}
                        disabled={updatingTaskId === task.id}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        Mark Actioned
                      </button>
                    )}
                    {task.status !== 'closed' && (
                      <button
                        onClick={() => handleTaskTransition(task.id, 'closed')}
                        disabled={updatingTaskId === task.id}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Close
                      </button>
                    )}
                    <button
                      onClick={() => openEnrollmentDetail(task.maternity_enrollment_id)}
                      className="rounded-lg border border-pink-200 bg-white px-3 py-2 text-xs font-semibold text-pink-600 hover:bg-pink-50"
                    >
                      Open Chart
                    </button>
                  </div>
                </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Guideline Search Panel */}
      <div className="bg-white rounded-lg border border-indigo-100 shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Clinical Guidelines Database</h3>
              <p className="text-sm text-slate-500">
                AI-powered search for WHO/MOH maternity protocols and complication management
              </p>
            </div>
          </div>
        </div>

        <GuidelineSearchPanel
          searchFn={(q) => ehrApi.searchGuidelines(q, token, tenantSlug)}
          contextLabel="Maternity"
        />
      </div>

      {/* Timeline */}
      {timelineEvents.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-700">
              <ClipboardList className="w-5 h-5" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">Upcoming Events</h3>
            </div>
            <span className="text-xs text-slate-500">Next {timelineEvents.length} events</span>
          </div>
          <div className="space-y-3">
            {timelineEvents.map((event) => (
              <div key={`${event.type}-${event.enrollmentId}-${event.date.toISOString()}`} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-pink-200 transition-colors">
                <div className="flex flex-col items-center w-14">
                  <span className="text-xs font-semibold text-slate-500 uppercase">{event.date.toLocaleString('default', { month: 'short' })}</span>
                  <span className="text-lg font-bold text-slate-900">{event.date.getDate()}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{event.label}</p>
                  {event.meta?.patient_number && (
                    <p className="text-xs text-slate-500">{event.meta.patient_number}</p>
                  )}
                </div>
                <button
                  onClick={() => event.enrollmentId && openEnrollmentDetail(event.enrollmentId)}
                  className="px-3 py-1.5 text-xs bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100"
                >
                  Review chart
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collaboration Panel */}
      {(neonatalOutcomes.length > 0 || postnatalVisits.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Baby className="w-5 h-5" />
                <h3 className="text-sm font-semibold uppercase tracking-wide">Neonatal Outcomes</h3>
              </div>
              <span className="text-xs text-slate-500">Last 14 days</span>
            </div>
            {neonatalOutcomes.length === 0 ? (
              <p className="text-sm text-slate-500">No recent neonatal outcomes recorded.</p>
            ) : (
              <div className="space-y-3">
                {neonatalOutcomes.map((outcome: any) => (
                  <div key={outcome.id} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{outcome.patient_name} • Baby #{outcome.birth_order}</p>
                        <p className="text-xs text-slate-500">
                          Delivery: {outcome.delivery_date ? formatDateToDDMMYYYY(outcome.delivery_date) : 'N/A'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          outcome.newborn_outcome === 'alive_well'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {outcome.newborn_outcome?.replace(/_/g, ' ') || outcome.birth_outcome}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-600">
                      <div>Birth weight: {outcome.birth_weight ? `${outcome.birth_weight} kg` : 'N/A'}</div>
                      <div>Resuscitation: {outcome.resuscitation_required ? 'Required' : 'No'}</div>
                    </div>
                    {outcome.neonatal_complications && (
                      <p className="text-xs text-red-600 mt-2">Complications: {outcome.neonatal_complications}</p>
                    )}
                    <button
                      onClick={() => openEnrollmentDetail(outcome.enrollment_id)}
                      className="mt-3 text-xs font-semibold text-pink-600 hover:text-pink-700"
                    >
                      Open delivery summary →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Heart className="w-5 h-5" />
                <h3 className="text-sm font-semibold uppercase tracking-wide">Recent Postnatal Visits</h3>
              </div>
              <span className="text-xs text-slate-500">Last 14 days</span>
            </div>
            {postnatalVisits.length === 0 ? (
              <p className="text-sm text-slate-500">No postnatal visits recorded recently.</p>
            ) : (
              <div className="space-y-3">
                {postnatalVisits.map((visit: any) => (
                  <div key={visit.id} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{visit.patient_name}</p>
                        <p className="text-xs text-slate-500">Visit date: {formatDateToDDMMYYYY(visit.visit_date)}</p>
                      </div>
                      {visit.family_planning_discussed && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-700">
                          FP counselled
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-600">
                      <div>Condition: {visit.general_condition || 'Normal'}</div>
                      <div>Breastfeeding: {visit.breastfeeding_status || 'N/A'}</div>
                    </div>
                    {visit.danger_signs && (
                      <p className="text-xs text-red-600 mt-2">Danger signs: {visit.danger_signs}</p>
                    )}
                    <button
                      onClick={() => openEnrollmentDetail(visit.enrollment_id)}
                      className="mt-3 text-xs font-semibold text-pink-600 hover:text-pink-700"
                    >
                      Open postnatal chart →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('high-risk')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
              activeTab === 'high-risk'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              High-Risk Pregnancies ({highRiskPregnancies.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
              activeTab === 'deliveries'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming Deliveries ({upcomingDeliveries.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
              activeTab === 'overdue'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Overdue ANC Visits ({overdueANC.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('mortality')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
              activeTab === 'mortality'
                ? 'border-rose-500 text-rose-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Mortality Audit
            </div>
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : (
        <>
          {activeTab === 'mortality' && <MaternalMortalityDashboard tenantSlug={tenantSlug} token={token} />}

          {/* High-Risk Pregnancies */}
          {activeTab === 'high-risk' && (
            <div className="space-y-4">
              {highRiskPregnancies.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Heart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No high-risk pregnancies requiring attention</p>
                </div>
              ) : (
                highRiskPregnancies.map((pregnancy) => {
                  const evaluation = evaluateRisk(pregnancy);

                  return (
                    <div
                      key={pregnancy.id}
                      className="bg-white border-2 border-red-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">
                              {pregnancy.patient_name}
                            </h3>
                            {getRiskBadge(pregnancy.risk_category)}
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            {pregnancy.patient_number} • Enrollment: {pregnancy.enrollment_number}
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Gravida/Para:</span>
                              <p className="font-semibold">G{pregnancy.gravida} P{pregnancy.para}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">EDD:</span>
                              <p className="font-semibold">
                                {pregnancy.expected_delivery_date
                                  ? formatDateToDDMMYYYY(pregnancy.expected_delivery_date)
                                  : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Days to EDD:</span>
                              <p className="font-semibold">{pregnancy.days_to_edd ?? 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Risk Score:</span>
                              <p className="font-semibold text-red-600">{evaluation.score} ({evaluation.level.toUpperCase()})</p>
                            </div>
                            <div>
                              <span className="text-gray-500">ANC Visits:</span>
                              <p className="font-semibold">{pregnancy.anc_visit_count || 0}/8</p>
                            </div>
                          </div>
                          {pregnancy.risk_factors && pregnancy.risk_factors.length > 0 && (
                            <div className="mt-4 p-3 bg-red-50 rounded-lg">
                              <p className="text-sm font-semibold text-red-900 mb-2">Risk Factors:</p>
                              <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                                {pregnancy.risk_factors.map((factor: any, idx: number) => (
                                  <li key={idx}>{factor.factor_name || factor}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex flex-col gap-2">
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                            <FileText className="w-4 h-4 inline mr-1" />
                            View Chart
                          </button>
                          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                            <Stethoscope className="w-4 h-4 inline mr-1" />
                            Manage Case
                          </button>
                          <button
                            onClick={() => openEnrollmentDetail(pregnancy.id)}
                            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
                          >
                            <Activity className="w-4 h-4 inline mr-1" />
                            Open Summary
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Upcoming Deliveries */}
          {activeTab === 'deliveries' && (
            <div className="space-y-4">
              {upcomingDeliveries.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No upcoming deliveries in next 30 days</p>
                </div>
              ) : (
                upcomingDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="bg-white border border-blue-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {delivery.patient_name}
                          </h3>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            Due in {delivery.days_to_edd} days
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {delivery.patient_number} • EDD: {formatDateToDDMMYYYY(delivery.expected_delivery_date)}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Gravida/Para:</span>
                            <p className="font-semibold">G{delivery.gravida} P{delivery.para}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Risk Category:</span>
                            <p className="font-semibold">{getRiskBadge(delivery.risk_category)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Last ANC:</span>
                            <p className="font-semibold">
                              {delivery.last_anc_visit_date
                                ? formatDateToDDMMYYYY(delivery.last_anc_visit_date)
                                : 'Never'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => openEnrollmentDetail(delivery.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          <Stethoscope className="w-4 h-4 inline mr-1" />
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Overdue ANC Visits */}
          {activeTab === 'overdue' && (
            <div className="space-y-4">
              {overdueANC.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">All patients are up-to-date with ANC visits</p>
                </div>
              ) : (
                overdueANC.map((pregnancy) => (
                  <div
                    key={pregnancy.id}
                    className="bg-white border-2 border-orange-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {pregnancy.patient_name}
                          </h3>
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                            {pregnancy.days_overdue} days overdue
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {pregnancy.patient_number} • Last visit: {formatDateToDDMMYYYY(pregnancy.last_visit_date)}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Next Visit Due:</span>
                            <p className="font-semibold">
                              {pregnancy.next_visit_date
                                ? formatDateToDDMMYYYY(pregnancy.next_visit_date)
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">EDD:</span>
                            <p className="font-semibold">
                              {pregnancy.expected_delivery_date
                                ? formatDateToDDMMYYYY(pregnancy.expected_delivery_date)
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">ANC Visits:</span>
                            <p className="font-semibold">{pregnancy.anc_visit_count || 0}/8</p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => openEnrollmentDetail(pregnancy.id)}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                        >
                          <Stethoscope className="w-4 h-4 inline mr-1" />
                          Follow Up
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {showDetailModal && selectedEnrollmentId && (
        <MaternityEnrollmentDetailModal
          enrollmentId={selectedEnrollmentId}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedEnrollmentId(null);
          }}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}
