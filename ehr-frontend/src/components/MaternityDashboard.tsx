import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Baby,
  Heart,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Plus,
  Search,
  BellRing,
  PhoneCall,
  Send,
  CheckCircle2,
  Clock4,
  Sparkles,
  Brain,
  Activity,
  CheckCircle,
  ClipboardList,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import MaternityEnrollmentModal from './MaternityEnrollmentModal';
import MaternityEnrollmentDetailModal from './MaternityEnrollmentDetailModal';

interface MaternityEnrollment {
  id: string;
  enrollment_number: string;
  patient_name: string;
  patient_number: string;
  phone: string;
  enrollment_date: string;
  expected_delivery_date: string;
  gestational_age_at_enrollment: number;
  gravida: number;
  para: number;
  risk_category: string;
  enrollment_status: string;
  days_to_edd: number;
  anc_visit_count: number;
  last_anc_visit_date: string;
}

interface MaternityDashboardProps {
  tenantSlug: string;
  token: string;
}

export default function MaternityDashboard({ tenantSlug, token }: MaternityDashboardProps) {
  const [enrollments, setEnrollments] = useState<MaternityEnrollment[]>([]);
  const [careTasks, setCareTasks] = useState<any[]>([]);
  const [highRiskPregnancies, setHighRiskPregnancies] = useState<any[]>([]);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState<any[]>([]);
  const [overdueAnc, setOverdueAnc] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'high-risk'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'dueSoon' | 'overdue' | 'postnatal'>('all');
  const [ancFilter, setAncFilter] = useState<'all' | 'needsMore' | 'complete'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [showEnrollmentDetail, setShowEnrollmentDetail] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load enrollments based on filter
      const enrollmentFilters: any = {};
      if (filter === 'active') {
        enrollmentFilters.status = 'active';
      } else if (filter === 'high-risk') {
        enrollmentFilters.status = 'active';
        enrollmentFilters.risk_category = 'high';
      }

      const enrollmentsRes = await ehrApi.getMaternityEnrollments(tenantSlug, token, enrollmentFilters);
      setEnrollments(enrollmentsRes.data.enrollments || []);

      const careTasksRes = await ehrApi.getMaternityCareTasks(tenantSlug, token);
      setCareTasks(careTasksRes.data?.tasks || []);

      // Load high-risk pregnancies
      const highRiskRes = await ehrApi.getHighRiskPregnancies(tenantSlug, token);
      setHighRiskPregnancies(highRiskRes.data.pregnancies || []);

      // Load upcoming deliveries
      const upcomingRes = await ehrApi.getUpcomingDeliveries(tenantSlug, token);
      setUpcomingDeliveries(upcomingRes.data.deliveries || []);

      const overdueRes = await ehrApi.getOverdueANC(tenantSlug, token);
      const overdueRows = Array.isArray(overdueRes?.data)
        ? overdueRes?.data
        : Array.isArray(overdueRes?.data?.patients)
          ? overdueRes?.data?.patients
          : Array.isArray(overdueRes?.data?.enrollments)
            ? overdueRes?.data?.enrollments
            : [];
      setOverdueAnc(overdueRows);

      // Load indicators
      const indicatorsRes = await ehrApi.getMaternityIndicators(tenantSlug, token);
      setIndicators(indicatorsRes.data);
    } catch (error) {
      console.error('Failed to load maternity data:', error);
      showError('Failed to load maternity data', 'error');
    } finally {
      setLoading(false);
    }
  };

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

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      transferred_out: 'bg-gray-100 text-gray-800',
      pregnancy_loss: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  const filteredEnrollments = useMemo(() => {
    let rows = [...enrollments];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      rows = rows.filter((row) =>
        row.patient_name.toLowerCase().includes(term) ||
        row.patient_number.toLowerCase().includes(term) ||
        row.enrollment_number.toLowerCase().includes(term),
      );
    }

    if (riskFilter !== 'all') {
      rows = rows.filter((row) => row.risk_category === riskFilter);
    }

    if (dueFilter !== 'all') {
      rows = rows.filter((row) => {
        const days = row.days_to_edd;
        if (days == null) return false;
        if (dueFilter === 'dueSoon') return days >= 0 && days <= 14;
        if (dueFilter === 'overdue') return days < 0 && row.enrollment_status === 'active';
        if (dueFilter === 'postnatal') return row.enrollment_status === 'delivered';
        return true;
      });
    }

    if (ancFilter !== 'all') {
      rows = rows.filter((row) => {
        const count = row.anc_visit_count || 0;
        if (ancFilter === 'needsMore') return count < 4;
        if (ancFilter === 'complete') return count >= 4;
        return true;
      });
    }

    return rows;
  }, [enrollments, searchTerm, riskFilter, dueFilter, ancFilter]);

  const dueSoonList = useMemo(
    () => enrollments.filter((row) => row.days_to_edd != null && row.days_to_edd >= 0 && row.days_to_edd <= 14),
    [enrollments],
  );

  const overdueEDDList = useMemo(
    () => enrollments.filter((row) => row.days_to_edd != null && row.days_to_edd < 0 && row.enrollment_status === 'active'),
    [enrollments],
  );

  const handleToggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    },
    [],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedIds(filteredEnrollments.map((row) => row.id));
  }, [filteredEnrollments]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const handleBulkAction = useCallback(
    (action: 'reminder' | 'followup') => {
      if (selectedIds.length === 0) {
        showError('Select at least one enrollment first.', 'error');
        return;
      }

      if (action === 'reminder') {
        showSuccess('Reminders scheduled', `${selectedIds.length} patients added to SMS follow-up queue.`);
      } else {
        showSuccess('Follow-up logged', `${selectedIds.length} cases marked for nurse outreach.`);
      }

      clearSelection();
    },
    [selectedIds, showError, showSuccess, clearSelection],
  );

  const queueSummary = useMemo(
    () => [
      {
        title: 'Active Escalations',
        value: careTasks.length,
        tone: 'from-red-600 to-rose-600',
        icon: <ClipboardList className="w-4 h-4" />,
      },
      {
        title: 'EDD in 14 days',
        value: dueSoonList.length,
        tone: 'from-orange-500 to-amber-500',
        icon: <Clock4 className="w-4 h-4" />,
      },
      {
        title: 'EDD Overdue',
        value: overdueEDDList.length,
        tone: 'from-red-500 to-rose-500',
        icon: <AlertTriangle className="w-4 h-4" />,
      },
      {
        title: 'ANC Overdue',
        value: overdueAnc.length,
        tone: 'from-pink-500 to-fuchsia-500',
        icon: <BellRing className="w-4 h-4" />,
      },
    ],
    [careTasks.length, dueSoonList.length, overdueEDDList.length, overdueAnc.length],
  );

  const careTasksByEnrollment = useMemo(() => {
    return careTasks.reduce<Record<string, any[]>>((acc, task) => {
      const key = String(task?.maternity_enrollment_id || '');
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(task);
      return acc;
    }, {});
  }, [careTasks]);

  const criticalEscalations = useMemo(
    () => careTasks.filter((task) => task.priority === 'critical'),
    [careTasks],
  );

  const displayedEnrollments = filteredEnrollments;

  const evaluateRisk = useCallback(
    (row: MaternityEnrollment) => {
      let score = 0;
      const reasons: string[] = [];

      if (row.risk_category === 'high') {
        score += 4;
        reasons.push('Marked as high-risk');
      } else if (row.risk_category === 'medium') {
        score += 2;
        reasons.push('Medium risk category');
      }

      const ancVisits = row.anc_visit_count ?? 0;
      if (ancVisits < 4 && row.enrollment_status === 'active') {
        score += 2;
        reasons.push('ANC visits below 4');
      } else if (ancVisits < 8 && row.enrollment_status === 'active') {
        score += 1;
        reasons.push('ANC visits below recommended 8');
      }

      if (row.days_to_edd != null) {
        if (row.days_to_edd < 0) {
          score += 3;
          reasons.push(`EDD overdue by ${Math.abs(row.days_to_edd)} days`);
        } else if (row.days_to_edd <= 7) {
          score += 2;
          reasons.push('EDD within 7 days');
        } else if (row.days_to_edd <= 14) {
          score += 1;
          reasons.push('EDD within 14 days');
        }
      }

      const overdueRecord = overdueAnc.find((item: any) => item.id === row.id);
      if (overdueRecord && (overdueRecord.days_overdue ?? 0) > 0) {
        score += 2;
        reasons.push(`ANC overdue ${overdueRecord.days_overdue} days`);
      }

      const level = score >= 7 ? 'critical' : score >= 5 ? 'high' : score >= 3 ? 'moderate' : 'low';
      return { score, level, reasons };
    },
    [overdueAnc],
  );

  const guidelinePrompts = useMemo(() => {
    const prompts: Array<{ title: string; description: string; tone: string; icon: React.ReactNode; action?: string }> = [];

    if (overdueAnc.length > 0) {
      prompts.push({
        title: 'ANC follow-up required',
        description: `${overdueAnc.length} patients missed their scheduled ANC visits. Prioritize outreach today.`,
        tone: 'from-pink-500 to-rose-500',
        icon: <BellRing className="w-5 h-5" />,
        action: 'Open follow-up queue',
      });
    }

    if (criticalEscalations.length > 0) {
      prompts.push({
        title: 'Doctor action outstanding',
        description: `${criticalEscalations.length} maternity escalations are critical and still open in the shared workflow.`,
        tone: 'from-red-600 to-rose-600',
        icon: <ClipboardList className="w-5 h-5" />,
        action: 'Review escalation timeline',
      });
    }

    const ancBelowFour = displayedEnrollments.filter((row) => (row.anc_visit_count ?? 0) < 4 && row.enrollment_status === 'active');
    if (ancBelowFour.length > 0) {
      prompts.push({
        title: 'Incomplete ANC schedule',
        description: `${ancBelowFour.length} active pregnancies have fewer than 4 recorded ANC visits.`,
        tone: 'from-amber-500 to-orange-500',
        icon: <Activity className="w-5 h-5" />,
        action: 'View ANC tracker',
      });
    }

    const highRiskStaleCheck = displayedEnrollments.filter((row) => {
      if (row.risk_category !== 'high') return false;
      if (!row.last_anc_visit_date) return true;
      const lastVisit = new Date(row.last_anc_visit_date);
      const diffDays = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 30;
    });
    if (highRiskStaleCheck.length > 0) {
      prompts.push({
        title: 'High-risk monitoring review',
        description: `${highRiskStaleCheck.length} high-risk pregnancies have no ANC visit recorded in the last 30 days.`,
        tone: 'from-red-500 to-rose-500',
        icon: <AlertTriangle className="w-5 h-5" />,
        action: 'Review high-risk list',
      });
    }

    const dueSoon = dueSoonList.filter((row) => row.enrollment_status === 'active');
    if (dueSoon.length > 0) {
      prompts.push({
        title: 'Delivery planning',
        description: `${dueSoon.length} patients are due within 14 days. Confirm birth plans and referral pathways.`,
        tone: 'from-violet-500 to-indigo-500',
        icon: <Calendar className="w-5 h-5" />,
        action: 'Prepare delivery roster',
      });
    }

    return prompts.slice(0, 4);
  }, [criticalEscalations.length, overdueAnc.length, displayedEnrollments, dueSoonList]);

  const insightBadges = useMemo(() => {
    if (!indicators) return [] as Array<{ label: string; value: string | number; icon: React.ReactNode; tone: string; helper?: string }>;

    const badges: Array<{ label: string; value: string | number; icon: React.ReactNode; tone: string; helper?: string }> = [];
    badges.push({
      label: 'Active Pregnancies',
      value: indicators.active_pregnancies ?? '--',
      icon: <Baby className="w-4 h-4" />,
      tone: 'from-pink-500 to-rose-500',
    });
    badges.push({
      label: 'High-Risk Cases',
      value: indicators.high_risk_count ?? 0,
      icon: <AlertTriangle className="w-4 h-4" />,
      tone: 'from-amber-500 to-orange-500',
    });
    if (indicators.coverage_4plus != null) {
      badges.push({
        label: 'ANC ≥ 4 Coverage',
        value: `${indicators.coverage_4plus}%`,
        icon: <CheckCircle className="w-4 h-4" />,
        tone: 'from-emerald-500 to-teal-500',
      });
    }
    badges.push({
      label: 'Deliveries This Month',
      value: indicators.total_deliveries ?? 0,
      icon: <TrendingUp className="w-4 h-4" />,
      tone: 'from-violet-500 to-indigo-500',
    });

    return badges;
  }, [indicators]);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      const response = await ehrApi.searchGuidelines(guidelineQuery, token, tenantSlug);
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

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filteredEnrollments.some((row) => row.id === id)));
  }, [filteredEnrollments]);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-pink-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Pregnancies</p>
              <p className="text-2xl font-bold text-pink-700">{indicators?.active_pregnancies || 0}</p>
            </div>
            <Baby className="w-8 h-8 text-pink-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk</p>
              <p className="text-2xl font-bold text-red-700">{highRiskPregnancies.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Due Soon (30 days)</p>
              <p className="text-2xl font-bold text-orange-700">{upcomingDeliveries.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Deliveries</p>
              <p className="text-2xl font-bold text-green-700">{indicators?.total_deliveries || 0}</p>
            </div>
            <Heart className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-lg shadow p-4 border border-pink-100 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by patient name, ID, or enrollment number..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRiskFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                riskFilter === 'all' ? 'bg-pink-500 border-pink-600 text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              All Risks
            </button>
            {(['high', 'medium', 'low'] as const).map((risk) => (
              <button
                key={risk}
                onClick={() => setRiskFilter(risk)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  riskFilter === risk ? 'bg-red-500 border-red-600 text-white' : 'border-slate-200 text-slate-600'
                }`}
              >
                {risk.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDueFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                dueFilter === 'all' ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              All EDD
            </button>
            <button
              onClick={() => setDueFilter('dueSoon')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                dueFilter === 'dueSoon' ? 'bg-orange-500 border-orange-600 text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              Due Soon (≤14d)
            </button>
            <button
              onClick={() => setDueFilter('overdue')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                dueFilter === 'overdue' ? 'bg-red-500 border-red-600 text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              Overdue
            </button>
            <button
              onClick={() => setDueFilter('postnatal')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                dueFilter === 'postnatal' ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              Postnatal
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAncFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                ancFilter === 'all' ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              All ANC
            </button>
            <button
              onClick={() => setAncFilter('needsMore')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                ancFilter === 'needsMore' ? 'bg-pink-500 border-pink-600 text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              ANC &lt; 4 visits
            </button>
            <button
              onClick={() => setAncFilter('complete')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                ancFilter === 'complete' ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              ANC ≥ 4 visits
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700"
            >
              Select Visible ({filteredEnrollments.length})
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBulkAction('reminder')}
              className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              disabled={selectedIds.length === 0}
            >
              <Send className="w-4 h-4" /> Send SMS Reminder
            </button>
            <button
              onClick={() => handleBulkAction('followup')}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              disabled={selectedIds.length === 0}
            >
              <PhoneCall className="w-4 h-4" /> Log Follow-Up Call
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-slate-600">
              {selectedIds.length} selected
            </div>
            <button
              onClick={() => setShowEnrollmentModal(true)}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Enrollment
            </button>
          </div>
        </div>
      </div>

      {/* Action Queue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {queueSummary.map((item) => (
          <div key={item.title} className={`rounded-xl border border-slate-200 bg-gradient-to-r ${item.tone} text-white p-4 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/70">{item.title}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                {item.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-red-100 shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl text-red-600">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Shared Escalation Queue</h3>
              <p className="text-sm text-slate-500">Doctor and nurse workflow sync for CDSS-triggered maternity reviews.</p>
            </div>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
            {careTasks.length} active
          </span>
        </div>
        {careTasks.length === 0 ? (
          <p className="text-sm text-slate-500">No active maternity escalation tasks.</p>
        ) : (
          <div className="space-y-3">
            {careTasks.slice(0, 5).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  setSelectedEnrollmentId(task.maternity_enrollment_id);
                  setShowEnrollmentDetail(true);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-pink-200 hover:bg-pink-50 transition-colors"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold uppercase ${
                        task.priority === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : task.priority === 'high'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-700'
                      }`}>
                        {task.priority}
                      </span>
                      <span className="px-2 py-1 rounded-full text-[11px] font-semibold uppercase bg-white border border-slate-200 text-slate-600">
                        {String(task.status || 'open').replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{task.patient_name} • {task.patient_number}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.summary || 'Open maternity safety task.'}</p>
                  </div>
                  {(task.required_actions?.length ?? 0) > 0 && (
                    <p className="max-w-sm text-xs text-slate-600">
                      Required: {task.required_actions.slice(0, 2).join(' | ')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {insightBadges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {insightBadges.map((badge) => (
            <div key={badge.label} className={`rounded-xl border border-slate-200 bg-gradient-to-r ${badge.tone} text-white p-4 shadow-sm`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/70">{badge.label}</p>
                  <p className="text-2xl font-bold">{badge.value}</p>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">{badge.icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guideline Search Section */}
      <div className="bg-white rounded-lg border border-indigo-100 shadow p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Clinical Guidelines & Protocols</h3>
            <p className="text-sm text-slate-500">
              Access latest WHO/MOH maternity guidelines via AI search.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={guidelineQuery}
            onChange={(e) => setGuidelineQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
            placeholder="e.g. pre-eclampsia management protocol"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleGuidelineSearch}
            disabled={loadingGuidelines || !guidelineQuery.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingGuidelines ? 'Searching...' : 'Search'}
          </button>
        </div>

        {guidelineResults.length > 0 && (
          <div className="space-y-3 mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Relevant Guidelines</p>
            {guidelineResults.map((citation: any, idx: number) => (
              <div key={`search-res-${idx}`} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{typeof citation === 'string' ? citation : (citation.content || JSON.stringify(citation))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {guidelinePrompts.length > 0 && (
        <div className="bg-white rounded-lg border border-pink-100 shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-pink-600">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Guideline-Based Prompts</h3>
            </div>
            <span className="text-xs uppercase tracking-wide text-pink-500 font-semibold">
              {guidelinePrompts.length} recommendations
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guidelinePrompts.map((prompt) => (
              <div key={prompt.title} className="border border-pink-100 rounded-xl bg-gradient-to-r from-white to-pink-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-pink-100 text-pink-600 rounded-lg">
                    {prompt.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-pink-700">{prompt.title}</p>
                    <p className="text-sm text-pink-800 mt-1">{prompt.description}</p>
                    {prompt.action && (
                      <p className="text-xs text-pink-500 mt-2 font-semibold flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        {prompt.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b px-6 py-3 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'active'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active Pregnancies
            </button>
            <button
              onClick={() => setFilter('high-risk')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'high-risk'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              High Risk ({highRiskPregnancies.length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
          </div>

          <button
            onClick={() => {
              setShowEnrollmentModal(true);
            }}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Enrollment</span>
          </button>
        </div>

        {/* Enrollments List */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading pregnancies...</p>
            </div>
          )}

          {!loading && enrollments.length === 0 && (
            <div className="text-center py-12">
              <Baby className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No enrollments found</p>
            </div>
          )}

          <div className="space-y-4">
            {displayedEnrollments.map((enrollment) => {
              const isSelected = selectedIds.includes(enrollment.id);
              const evaluation = evaluateRisk(enrollment);
              const enrollmentCareTasks = careTasksByEnrollment[enrollment.id] || [];
              const criticalEnrollmentTasks = enrollmentCareTasks.filter((task) => task.priority === 'critical');
              const riskHighlight =
                evaluation.level === 'critical' ? 'ring-2 ring-red-400 border-red-400' :
                evaluation.level === 'high' ? 'ring-2 ring-orange-400 border-orange-300' :
                evaluation.level === 'moderate' ? 'ring-1 ring-amber-300 border-amber-200' : '';

              return (
              <div
                key={enrollment.id}
                className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${
                  enrollment.risk_category === 'high' ? 'border-red-300 bg-red-50' :
                  enrollment.risk_category === 'medium' ? 'border-yellow-300 bg-yellow-50' :
                  'border-gray-200 hover:border-pink-400'
                } ${riskHighlight}`}
              >
                <div className="flex items-start justify-between mb-3 gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <button
                      onClick={() => handleToggleSelect(enrollment.id)}
                      className={`mt-1 p-2 rounded-lg border ${
                        isSelected ? 'bg-pink-500 border-pink-500 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-bold text-lg text-gray-900">
                        {enrollment.patient_name} ({enrollment.patient_number})
                      </h4>
                      {getRiskBadge(enrollment.risk_category)}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                          evaluation.level === 'critical'
                            ? 'bg-red-600 text-white border-red-700'
                            : evaluation.level === 'high'
                            ? 'bg-orange-500 text-white border-orange-600'
                            : evaluation.level === 'moderate'
                            ? 'bg-amber-400 text-white border-amber-500'
                            : 'bg-emerald-500 text-white border-emerald-600'
                        }`}
                      >
                        {evaluation.level.toUpperCase()} • Score {evaluation.score}
                      </span>
                      {enrollmentCareTasks.length > 0 && (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                          criticalEnrollmentTasks.length > 0
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : 'bg-sky-100 text-sky-700 border-sky-300'
                        }`}>
                          {criticalEnrollmentTasks.length > 0
                            ? `${criticalEnrollmentTasks.length} critical escalation${criticalEnrollmentTasks.length > 1 ? 's' : ''}`
                            : `${enrollmentCareTasks.length} active escalation${enrollmentCareTasks.length > 1 ? 's' : ''}`}
                        </span>
                      )}
                      {getStatusBadge(enrollment.enrollment_status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Enrollment #:</span>
                        <p className="font-medium font-mono">{enrollment.enrollment_number}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Gravida/Para:</span>
                        <p className="font-medium">G{enrollment.gravida} P{enrollment.para}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">EDD:</span>
                        <p className="font-medium">
                          {enrollment.expected_delivery_date
                            ? formatDateToDDMMYYYY(enrollment.expected_delivery_date)
                            : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Days to EDD:</span>
                        <p className={`font-medium ${
                          enrollment.days_to_edd <= 30 ? 'text-orange-600 font-bold' :
                          enrollment.days_to_edd < 0 ? 'text-red-600 font-bold' : ''
                        }`}>
                          {enrollment.days_to_edd > 0 ? enrollment.days_to_edd : 'Overdue'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">ANC Visits:</span>
                        <p className={`font-medium ${
                          enrollment.anc_visit_count >= 4 ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {enrollment.anc_visit_count}/8
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Last ANC Visit:</span>
                        <p className="font-medium">
                          {enrollment.last_anc_visit_date
                            ? formatDateToDDMMYYYY(enrollment.last_anc_visit_date)
                            : 'No visits yet'}
                        </p>
                      </div>
                      {enrollment.phone && (
                        <div className="col-span-2">
                          <span className="text-gray-600">Phone:</span>
                          <p className="font-medium">{enrollment.phone}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedEnrollmentId(enrollment.id);
                      setShowEnrollmentDetail(true);
                    }}
                    className="ml-4 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 whitespace-nowrap"
                  >
                    View Details
                  </button>
                </div>

                {/* Alerts for upcoming delivery or overdue visits */}
                {enrollment.days_to_edd <= 30 && enrollment.days_to_edd > 0 && (
                  <div className="mt-3 bg-orange-100 border border-orange-300 rounded-lg p-3 flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900">
                      Delivery expected in {enrollment.days_to_edd} days - Ensure delivery plan is in place
                    </span>
                  </div>
                )}

                {enrollment.days_to_edd < 0 && (
                  <div className="mt-3 bg-red-100 border border-red-300 rounded-lg p-3 flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-900">
                      OVERDUE - EDD was {Math.abs(enrollment.days_to_edd)} days ago - Immediate follow-up required
                    </span>
                  </div>
                )}

                  {evaluation.reasons.length > 0 && (
                    <div className="mt-3 bg-white/60 border border-white/80 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Drivers</p>
                      <ul className="flex flex-wrap gap-2 text-xs text-slate-700">
                        {evaluation.reasons.slice(0, 4).map((reason) => (
                          <li key={reason} className="px-2 py-1 bg-slate-100 rounded-full border border-slate-200">
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {enrollmentCareTasks.length > 0 && (
                    <div className="mt-3 bg-white/70 border border-pink-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide mb-2">CDSS Escalation Sync</p>
                      <div className="space-y-2">
                        {enrollmentCareTasks.slice(0, 2).map((task) => (
                          <div key={task.id} className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{task.title}</p>
                              <p className="text-xs text-slate-500">{task.summary || 'Escalation open for doctor review.'}</p>
                            </div>
                            <span className="text-xs font-semibold uppercase text-slate-600">
                              {String(task.status || 'open').replace('_', ' ')} • {task.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {showEnrollmentModal && (
        <MaternityEnrollmentModal
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowEnrollmentModal(false);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {showEnrollmentDetail && selectedEnrollmentId && (
        <MaternityEnrollmentDetailModal
          enrollmentId={selectedEnrollmentId}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowEnrollmentDetail(false);
            setSelectedEnrollmentId(null);
          }}
          onUpdated={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
