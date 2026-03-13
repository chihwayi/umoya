import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Plus,
  FileText,
  Clock,
  Brain,
  Search,
  BookOpen,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { cdssApi, ehrAxios } from '../services/api';
import AddChargeModal from '../components/AddChargeModal';
import ChargeReviewModal from '../components/ChargeReviewModal';
import ModuleGeneralReportCard from '../components/ModuleGeneralReportCard';

interface RevenueCycleDashboardProps {
  embedded?: boolean;
}

const RevenueCycleDashboard: React.FC<RevenueCycleDashboardProps> = ({ embedded = false }) => {
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

  const [chargeMaster, setChargeMaster] = useState<any[]>([]);
  const [pendingCharges, setPendingCharges] = useState<any[]>([]);
  const [worklistSummary, setWorklistSummary] = useState<any>(null);
  const [operationalBrief, setOperationalBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'master' | 'pending'>('pending');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [actionChargeId, setActionChargeId] = useState<string | null>(null);
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const loadPendingCharges = useCallback(async () => {
    try {
      const [response, briefResponse] = await Promise.all([
        ehrAxios
          .get('/revenue-cycle/charges/worklist', {
            params: { doctorId: user?.id, includeResolved, limit: 80 },
            headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
          })
          .catch(async () => {
            const fallback = await ehrAxios.get('/revenue-cycle/charges/pending-review', {
              params: { doctorId: user?.id },
              headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
            });
            const charges = fallback.data?.charges || fallback.data || [];
            return {
              data: {
                summary: {
                  total: charges.length,
                  open: charges.length,
                  overdue: 0,
                  dueSoon: 0,
                  highRisk: 0,
                  moderateRisk: 0,
                  potentialLeakageAmount: charges.reduce(
                    (sum: number, charge: any) =>
                      sum + Number(charge.totalCharge || Number(charge.unitPrice || 0) * Number(charge.quantity || 0)),
                    0,
                  ),
                },
                items: charges,
              },
            };
          }),
        ehrAxios
          .get('/revenue-cycle/operational-brief', {
            params: { doctorId: user?.id, includeResolved, limit: 100 },
            headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
          })
          .catch(() => ({ data: null })),
      ]);

      const payload = response?.data || {};
      setPendingCharges(payload.items || payload.charges || []);
      setWorklistSummary(payload.summary || null);
      setOperationalBrief(briefResponse?.data || null);
    } catch (error) {
      // Silent fail
      setOperationalBrief(null);
    }
  }, [includeResolved, tenantSlug, token, user?.id]);

  const loadChargeMaster = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedDepartment !== 'all') {
        params.department = selectedDepartment;
      }

      const response = await ehrAxios.get('/revenue-cycle/charge-master', {
        params,
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setChargeMaster(response.data || []);
    } catch (error) {
      showError('Error', 'Failed to load charge master');
    } finally {
      setLoading(false);
    }
  }, [selectedDepartment, showError, tenantSlug, token]);

  useEffect(() => {
    loadChargeMaster();
    if (user?.role === 'doctor') {
      loadPendingCharges();
    }
  }, [loadChargeMaster, loadPendingCharges, user?.role]);

  const getSlaTone = (slaStatus: string) => {
    const value = String(slaStatus || '').toLowerCase();
    if (value === 'overdue') return 'bg-red-100 text-red-800';
    if (value === 'warning') return 'bg-amber-100 text-amber-800';
    if (value === 'resolved') return 'bg-green-100 text-green-800';
    return 'bg-slate-100 text-slate-700';
  };

  const getRiskTone = (riskLevel: string) => {
    const value = String(riskLevel || '').toLowerCase();
    if (value === 'high') return 'bg-red-100 text-red-800';
    if (value === 'moderate') return 'bg-amber-100 text-amber-800';
    return 'bg-green-100 text-green-800';
  };

  const handleQuickAction = async (charge: any, action: 'review' | 'approve' | 'reject') => {
    try {
      setActionChargeId(charge.id);
      if (action === 'reject') {
        const reason = window.prompt('Provide rejection reason:', '');
        if (reason === null) return;
        if (!reason.trim()) {
          showError('Reason required', 'Rejection requires a reason.');
          return;
        }
        await ehrAxios.put(
          `/revenue-cycle/charges/${charge.id}/reject`,
          { reason: reason.trim() },
          { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
        );
      } else if (action === 'approve') {
        const notes = window.prompt('Approval notes (optional):', '') ?? '';
        await ehrAxios.put(
          `/revenue-cycle/charges/${charge.id}/approve`,
          { notes: notes || null },
          { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
        );
      } else {
        const notes = window.prompt('Review notes (optional):', '') ?? '';
        await ehrAxios.put(
          `/revenue-cycle/charges/${charge.id}/mark-reviewed`,
          { notes: notes || null },
          { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
        );
      }

      showSuccess(
        'Charge updated',
        action === 'approve'
          ? 'Charge approved successfully.'
          : action === 'reject'
          ? 'Charge rejected successfully.'
          : 'Charge marked as reviewed.',
      );
      loadPendingCharges();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || `Failed to ${action} charge`);
    } finally {
      setActionChargeId(null);
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
    } catch {
      showError('Error', 'Failed to search revenue cycle guidance');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const departments = [
    { value: 'all', label: 'All Departments' },
    { value: 'Surgery', label: 'Surgery' },
    { value: 'Lab', label: 'Laboratory' },
    { value: 'Radiology', label: 'Radiology' },
    { value: 'Pharmacy', label: 'Pharmacy' },
    { value: 'Emergency', label: 'Emergency' },
  ];

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-12' : 'min-h-screen'}`}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading revenue cycle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {!embedded && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg">
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
                    <DollarSign className="w-8 h-8" />
                    Revenue Cycle Management
                  </h1>
                  <p className="text-emerald-100 mt-1">Charge capture & revenue optimization</p>
                </div>
              </div>
              {user?.role === 'doctor' && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-semibold"
                  >
                    <FileText className="w-5 h-5" />
                    Review Charges
                    {pendingCharges.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white rounded-full text-xs font-bold">
                        {pendingCharges.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAddChargeModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all shadow-lg hover:shadow-xl font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    Add Charge
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${embedded ? 'pb-4' : 'pt-8 pb-8'}`}>
        <div className="mb-6">
          <ModuleGeneralReportCard
            moduleKey="revenue_cycle"
            title="Revenue Cycle"
            tenantSlug={tenantSlug || ''}
            token={token}
            accentClass="from-emerald-50 via-white to-teal-50"
          />
        </div>

        {/* Tabs */}
        {user?.role === 'doctor' && (
          <div className="flex items-center gap-2 mb-6 bg-white/80 backdrop-blur-sm rounded-xl p-2 border border-slate-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'pending'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Review
                {pendingCharges.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                    {pendingCharges.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('master')}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'master'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Charge Master
              </div>
            </button>
          </div>
        )}

        {/* Pending Charges Tab */}
        {user?.role === 'doctor' && activeTab === 'pending' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Open</p>
                <p className="text-2xl font-bold text-blue-700">{worklistSummary?.open ?? pendingCharges.length}</p>
              </div>
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
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Leakage Risk</p>
                <p className="text-xl font-bold text-emerald-700">${Number(worklistSummary?.potentialLeakageAmount || 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-emerald-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Operational Brief</h3>
                <button
                  onClick={loadPendingCharges}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Refresh Brief
                </button>
              </div>
              {!operationalBrief ? (
                <p className="text-sm text-slate-600">Operational brief unavailable.</p>
              ) : (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-6">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Overdue</p>
                      <p className="text-xl font-bold text-red-800">{operationalBrief.summary?.overdue ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">High Risk</p>
                      <p className="text-xl font-bold text-orange-800">{operationalBrief.summary?.highRisk ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Coding Gaps</p>
                      <p className="text-xl font-bold text-amber-800">{operationalBrief.summary?.missingCodingCount ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Capture Lag</p>
                      <p className="text-xl font-bold text-cyan-800">{operationalBrief.summary?.captureLagOver24h ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">At Risk</p>
                      <p className="text-lg font-bold text-emerald-800">
                        ${Number(operationalBrief.summary?.potentialLeakageAmount || 0).toFixed(0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">CDSS Coverage</p>
                      <p className="text-xl font-bold text-indigo-800">{operationalBrief.summary?.cdssCoveragePercent ?? 0}%</p>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-cyan-100 px-2.5 py-1 font-semibold text-cyan-800">
                      Accounts sync pending: {operationalBrief.summary?.accountsSyncPending ?? 0}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                      Source context gaps: {operationalBrief.summary?.sourceContextGaps ?? 0}
                    </span>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-800">
                      Reviewed not finalized: {operationalBrief.summary?.reviewedPendingFinalization ?? 0}
                    </span>
                  </div>

                  {Array.isArray(operationalBrief.highPriorityQueue) && operationalBrief.highPriorityQueue.length > 0 && (
                    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">High-Priority Queue</p>
                      <div className="space-y-2">
                        {operationalBrief.highPriorityQueue.slice(0, 5).map((item: any) => (
                          <div key={item.id} className="rounded-md border border-slate-200 bg-white p-2.5">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.patientName} {item.patientNumber ? `(${item.patientNumber})` : ''}
                            </p>
                            <p className="text-xs text-slate-600">
                              {item.chargeDescription} • {String(item.riskLevel || 'low').toUpperCase()} risk • {item.ageDays ?? 0}d old
                            </p>
                            {Array.isArray(item.cdssFlags) && item.cdssFlags.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {item.cdssFlags.slice(0, 2).map((flag: string, idx: number) => (
                                  <span
                                    key={`${item.id}-cdss-${idx}`}
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
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Recommended Actions</p>
                      <ul className="space-y-1 text-sm text-emerald-900">
                        {operationalBrief.recommendations.slice(0, 4).map((rec: string, idx: number) => (
                          <li key={`revenue-brief-${idx}`}>- {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Charges Pending Review
              </h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeResolved}
                    onChange={(e) => setIncludeResolved(e.target.checked)}
                  />
                  Include resolved
                </label>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Review All
                </button>
              </div>
            </div>

            {pendingCharges.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">All Caught Up!</h3>
                <p className="text-slate-600">No charges pending review at this time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCharges.slice(0, 10).map((charge) => (
                  <div
                    key={charge.id}
                    className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">{charge.chargeDescription}</h3>
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                            {charge.chargeStatus.toUpperCase()}
                          </span>
                          {charge.sla_status && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getSlaTone(charge.sla_status)}`}>
                              {String(charge.sla_status).replace('_', ' ').toUpperCase()}
                            </span>
                          )}
                          {charge.risk_level && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskTone(charge.risk_level)}`}>
                              {String(charge.risk_level).toUpperCase()} RISK
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span><strong>Code:</strong> {charge.chargeCode}</span>
                          <span><strong>Date:</strong> {new Date(charge.serviceDate).toLocaleDateString()}</span>
                          <span><strong>Qty:</strong> {charge.quantity}</span>
                          {charge.age_days !== undefined && <span><strong>Age:</strong> {charge.age_days}d</span>}
                        </div>
                        {Array.isArray(charge.recommended_actions) && charge.recommended_actions.length > 0 && (
                          <div className="mt-2">
                            {charge.recommended_actions.slice(0, 2).map((action: string, idx: number) => (
                              <p key={`${charge.id}-rec-${idx}`} className="text-xs text-slate-600">• {action}</p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          ${parseFloat(charge.total_charge_value || charge.totalCharge || charge.unitPrice * charge.quantity).toFixed(2)}
                        </p>
                        {charge.patient && (
                          <p className="text-xs text-slate-500 mt-1">
                            {charge.patient.firstName} {charge.patient.lastName}
                          </p>
                        )}
                        {(charge.chargeStatus === 'pending' || charge.chargeStatus === 'reviewed') && (
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuickAction(charge, 'review')}
                              disabled={actionChargeId === charge.id}
                              className="px-2.5 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-60"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAction(charge, 'approve')}
                              disabled={actionChargeId === charge.id}
                              className="px-2.5 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAction(charge, 'reject')}
                              disabled={actionChargeId === charge.id}
                              className="px-2.5 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {pendingCharges.length > 10 && (
                  <div className="text-center pt-4">
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="text-green-600 hover:text-green-700 font-semibold"
                    >
                      View all {pendingCharges.length} pending charges →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Charge Master Tab */}
        {(user?.role !== 'doctor' || activeTab === 'master') && (
          <div>
            {/* Department Filter */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {departments.map((dept) => (
                <button
                  key={dept.value}
                  onClick={() => setSelectedDepartment(dept.value)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                    selectedDepartment === dept.value
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
                  }`}
                >
                  {dept.label}
                </button>
              ))}
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Charge Master
            </h2>
            {chargeMaster.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Charges Found</h3>
                <p className="text-slate-600">No charge master items for selected department</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chargeMaster.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-slate-900">{item.chargeDescription}</h3>
                          {item.billable ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-bold">
                              BILLABLE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-bold">
                              NON-BILLABLE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span><strong>Code:</strong> {item.chargeCode}</span>
                          {item.cptCode && <span><strong>CPT:</strong> {item.cptCode}</span>}
                          {item.department && <span><strong>Dept:</strong> {item.department}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          ${parseFloat(item.standardCharge).toFixed(2)}
                        </p>
                        {item.medicareRate && (
                          <p className="text-xs text-slate-500">
                            Medicare: ${parseFloat(item.medicareRate).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Revenue Guidance AI */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Brain className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Revenue Cycle Coding Guidance (AI)</h3>
                <p className="text-sm text-slate-500">Search denial-prevention and documentation coding guidance</p>
              </div>
            </div>
            <button
              onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
              className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
            >
              {showGuidelineSearch ? 'Hide Search' : 'Search Guidance'}
            </button>
          </div>

          {showGuidelineSearch && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={guidelineQuery}
                    onChange={(e) => setGuidelineQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                    placeholder="Search e.g. 'medical necessity documentation', 'CPT-ICD pairing denials', 'charge capture compliance'..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleGuidelineSearch}
                  disabled={loadingGuidelines || !guidelineQuery.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {loadingGuidelines ? 'Searching...' : 'Search'}
                </button>
              </div>
              {guidelineResults.length > 0 && (
                <div className="grid gap-3">
                  {guidelineResults.slice(0, 2).map((result, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start gap-3">
                        <BookOpen className="w-5 h-5 text-emerald-600 mt-1 shrink-0" />
                        <div>
                          <h4 className="font-medium text-slate-900">{result.source}</h4>
                          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{result.text}</p>
                          {result.url && (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 text-xs text-emerald-600 hover:underline"
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
      </div>

      {/* Modals */}
      <AddChargeModal
        isOpen={showAddChargeModal}
        onClose={() => setShowAddChargeModal(false)}
        onSuccess={() => {
          loadPendingCharges();
          setShowAddChargeModal(false);
        }}
        tenantSlug={tenantSlug || ''}
      />

      <ChargeReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => {
          loadPendingCharges();
          setShowReviewModal(false);
        }}
        tenantSlug={tenantSlug || ''}
      />
    </div>
  );
};

export default RevenueCycleDashboard;
