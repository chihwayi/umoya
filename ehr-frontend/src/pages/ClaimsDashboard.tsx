import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Search,
  RefreshCw,
  Download,
  Eye,
  Send,
  RotateCcw,
  ArrowLeft,
  BarChart3,
  DollarSign,
  Users,
  Shield,
  History,
  Layers,
  Settings,
  CheckSquare,
  Square,
  Calendar,
  Activity,
  ExternalLink,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Upload,
} from 'lucide-react';
import { claimsApi, billingApi, ehrApi, tenantApi, cdssApi } from '../services/api';
import { AppealLetterPanel } from '../components/AppealLetterPanel';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';
import { GuidelineResult } from '../types/guidelines';

const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-ZW', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num || 0);
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  subtitle?: string;
  accent: string;
}> = ({ title, value, icon: Icon, subtitle, accent }) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
    <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
    <div className="relative flex items-center gap-4 p-6">
      <div className="p-3 rounded-2xl bg-black/10 text-white">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">{title}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const ClaimsDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [claimReadinessWorklist, setClaimReadinessWorklist] = useState<any[]>([]);
  const [claimReadinessSummary, setClaimReadinessSummary] = useState<any>(null);
  const [claimReadinessById, setClaimReadinessById] = useState<Record<string, any>>({});
  const [bills, setBills] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'claims' | 'readiness' | 'create' | 'analytics' | 'preauth' | 'bulk' | 'api-config'>('overview');
  const [filters, setFilters] = useState({
    status: '',
    provider: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClaimDetailModal, setShowClaimDetailModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [preAuthorizations, setPreAuthorizations] = useState<any[]>([]);
  const [apiConfigurations, setApiConfigurations] = useState<any[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set());
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [appealClaimId, setAppealClaimId] = useState<string | null>(null);
  const [appealData, setAppealData] = useState<Record<string, { letter: string; sources: any[] }>>({});
  // const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  // const [showPreAuthModal, setShowPreAuthModal] = useState(false);

  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantApi.getTenantBySlug(tenantSlug!);
        if (response.data) {
          setTenantInfo(response.data);
        }
      } catch (error) {
        console.error('Error fetching tenant info:', error);
      }
    };

    if (tenantSlug) {
      fetchTenantInfo();
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || !token) {
      return;
    }
    loadDashboardData();
  }, [tenantSlug, token, activeTab, filters]);

  const loadDashboardData = useCallback(async () => {
    if (!tenantSlug || !token) return;

    setLoading(true);
    try {
      if (activeTab === 'overview' || activeTab === 'claims') {
        const summaryResponse = await claimsApi.getDashboardSummary(tenantSlug, token);
        setSummary(summaryResponse.data);

        const claimsResponse = await claimsApi.getClaims(tenantSlug, token, {
          status: filters.status || undefined,
          provider: filters.provider || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          search: searchTerm || undefined,
          limit: 50,
        });
        setClaims(claimsResponse.data.claims || claimsResponse.data || []);
      }

      if (activeTab === 'overview' || activeTab === 'claims' || activeTab === 'readiness') {
        const readinessResponse = await claimsApi.getClaimReadinessWorklist(tenantSlug, token, {
          statuses: 'draft,rejected,submitted,processing',
          limit: 100,
        });
        const readinessItems = readinessResponse.data?.items || [];
        setClaimReadinessWorklist(readinessItems);
        setClaimReadinessSummary(readinessResponse.data?.summary || null);
        setClaimReadinessById(
          readinessItems.reduce((acc: Record<string, any>, item: any) => {
            if (item.claimId) {
              acc[item.claimId] = item;
            }
            return acc;
          }, {}),
        );
      }

      if (activeTab === 'create') {
        const billsResponse = await billingApi.getBills(tenantSlug, token, {
          status: 'pending',
          limit: 100,
        });
        setBills(billsResponse.data.bills || billsResponse.data || []);
      }

      if (activeTab === 'analytics') {
        const analyticsResponse = await claimsApi.getClaimAnalytics(tenantSlug, token, {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          provider: filters.provider || undefined,
        });
        setAnalytics(analyticsResponse.data);
      }

      if (activeTab === 'preauth') {
        const preAuthResponse = await claimsApi.getPreAuthorizations(tenantSlug, token);
        setPreAuthorizations(Array.isArray(preAuthResponse.data) ? preAuthResponse.data : []);
      }

      if (activeTab === 'api-config') {
        const configResponse = await claimsApi.getApiConfigurations(tenantSlug, token);
        setApiConfigurations(Array.isArray(configResponse.data) ? configResponse.data : []);
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      showError(error.response?.data?.message || 'Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, activeTab, filters, searchTerm]);

  const handleSubmitClaim = async (claimId: string, method: 'api' | 'edi' | 'manual' = 'api') => {
    try {
      await claimsApi.submitClaimEnhanced(tenantSlug!, token, claimId, method);
      showSuccess('Claim submitted successfully', 'success');
      loadDashboardData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to submit claim', 'error');
    }
  };

  const handleBulkSubmit = async (method: 'api' | 'edi' = 'api') => {
    if (selectedClaims.size === 0) {
      showError('Please select at least one claim', 'error');
      return;
    }

    try {
      const result = await claimsApi.bulkSubmitClaims(tenantSlug!, token, Array.from(selectedClaims), method);
      showSuccess(`Submitted ${result.data.successful} of ${result.data.total} claims`, 'success');
      setSelectedClaims(new Set());
      loadDashboardData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to submit claims', 'error');
    }
  };

  const handleBulkCheckStatus = async () => {
    if (selectedClaims.size === 0) {
      showError('Please select at least one claim', 'error');
      return;
    }

    try {
      const result = await claimsApi.bulkCheckClaimStatuses(tenantSlug!, token, Array.from(selectedClaims));
      showSuccess(`Checked ${result.data.successful} of ${result.data.total} claims`, 'success');
      loadDashboardData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to check claim statuses', 'error');
    }
  };

  const toggleClaimSelection = (claimId: string) => {
    const newSelection = new Set(selectedClaims);
    if (newSelection.has(claimId)) {
      newSelection.delete(claimId);
    } else {
      newSelection.add(claimId);
    }
    setSelectedClaims(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedClaims.size === claims.length) {
      setSelectedClaims(new Set());
    } else {
      setSelectedClaims(new Set(claims.map((c: any) => c.id)));
    }
  };

  const handleResubmitClaim = async (claimId: string, updatedData: any) => {
    try {
      await claimsApi.resubmitClaim(tenantSlug!, token, claimId, updatedData);
      showSuccess('Claim prepared for resubmission', 'success');
      setShowClaimDetailModal(false);
      loadDashboardData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to resubmit claim', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string; icon: React.ComponentType<any> }> = {
      draft: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Draft', icon: FileText },
      submitted: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Submitted', icon: Send },
      processing: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Processing', icon: Clock },
      approved: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Approved', icon: CheckCircle },
      rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Rejected', icon: XCircle },
      paid: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Paid', icon: DollarSign },
    };

    const config = statusConfig[status.toLowerCase()] || statusConfig.draft;
    const Icon = config.icon;
    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getReadinessBadge = (readiness?: any) => {
    const status = String(readiness?.status || '').toLowerCase();
    if (status === 'ready') {
      return (
        <span className="px-3 py-1 rounded-lg text-xs font-medium border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
          Ready
        </span>
      );
    }
    if (status === 'at_risk') {
      return (
        <span className="px-3 py-1 rounded-lg text-xs font-medium border bg-amber-500/20 text-amber-300 border-amber-500/30">
          At Risk
        </span>
      );
    }
    if (status === 'blocked') {
      return (
        <span className="px-3 py-1 rounded-lg text-xs font-medium border bg-red-500/20 text-red-300 border-red-500/30">
          Blocked
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-lg text-xs font-medium border bg-slate-500/20 text-slate-300 border-slate-500/30">
        Pending review
      </span>
    );
  };

  if (loading && !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              {tenantInfo?.logoUrl && (
                <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden border border-white/20 bg-white/5">
                  <img 
                    src={tenantInfo.logoUrl} 
                    alt={`${tenantInfo.clinicName} Logo`} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-white">Medical Aid Claims</h1>
                <p className="text-white/60 mt-1">Manage claims, track status, and analyze performance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Claim
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto">
          {([
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'claims', label: 'Claims', icon: FileText },
            { id: 'readiness', label: 'Readiness', icon: Shield },
            { id: 'create', label: 'Create', icon: Plus },
            { id: 'preauth', label: 'Pre-Auth', icon: Shield },
            { id: 'bulk', label: 'Bulk Ops', icon: Layers },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'api-config', label: 'API Config', icon: Settings },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && summary && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Claims"
                value={summary.summary?.totalClaims || 0}
                icon={FileText}
                accent="from-blue-500/20 to-cyan-500/20"
              />
              <StatCard
                title="Total Amount"
                value={formatCurrency(summary.summary?.totalAmount || 0)}
                icon={DollarSign}
                accent="from-green-500/20 to-emerald-500/20"
              />
              <StatCard
                title="Pending Amount"
                value={formatCurrency(summary.summary?.pendingAmount || 0)}
                icon={Clock}
                accent="from-yellow-500/20 to-orange-500/20"
              />
              <StatCard
                title="Approved Amount"
                value={formatCurrency(summary.summary?.approvedAmount || 0)}
                icon={CheckCircle}
                subtitle={`Avg: ${summary.summary?.avgTurnaroundDays || 0} days`}
                accent="from-purple-500/20 to-pink-500/20"
              />
            </div>

            {/* Status Breakdown */}
            {summary.statusBreakdown && summary.statusBreakdown.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
                <h3 className="text-xl font-bold text-white mb-4">Status Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {summary.statusBreakdown.map((item: any) => (
                    <div key={item.status} className="text-center p-4 rounded-lg bg-white/5">
                      <p className="text-white/60 text-sm mb-1 capitalize">{item.status}</p>
                      <p className="text-2xl font-bold text-white">{item.count}</p>
                      <p className="text-white/60 text-xs mt-1">{formatCurrency(item.total_amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provider Breakdown */}
            {summary.providerBreakdown && summary.providerBreakdown.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
                <h3 className="text-xl font-bold text-white mb-4">By Medical Aid Provider</h3>
                <div className="space-y-2">
                  {summary.providerBreakdown.map((item: any) => (
                    <div key={item.medical_aid_provider} className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                      <div>
                        <p className="text-white font-medium capitalize">{item.medical_aid_provider.replace('_', ' ')}</p>
                        <p className="text-white/60 text-sm">
                          {item.count} claims • {item.approved_count} approved • {item.rejected_count} rejected
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{formatCurrency(item.total_amount)}</p>
                        <p className="text-white/60 text-xs">Approved: {formatCurrency(item.approved_amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {claimReadinessSummary && (
              <div className="rounded-2xl border border-red-500/20 bg-white/5 backdrop-blur p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Claim Readiness Snapshot</h3>
                    <p className="text-white/60 text-sm mt-1">Denial-prevention status for draft, rejected, submitted, and processing claims.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('readiness')}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    Open readiness worklist
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                    <p className="text-sm text-white/60">Blocked</p>
                    <p className="text-2xl font-bold text-white">{claimReadinessSummary.blocked || 0}</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                    <p className="text-sm text-white/60">At Risk</p>
                    <p className="text-2xl font-bold text-white">{claimReadinessSummary.atRisk || 0}</p>
                  </div>
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                    <p className="text-sm text-white/60">Missing Diagnosis</p>
                    <p className="text-2xl font-bold text-white">{claimReadinessSummary.missingDiagnosis || 0}</p>
                  </div>
                  <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
                    <p className="text-sm text-white/60">Missing Documents</p>
                    <p className="text-2xl font-bold text-white">{claimReadinessSummary.missingSupportingDocuments || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Claims */}
            {summary.recentClaims && summary.recentClaims.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Recent Claims</h3>
                  <button
                    onClick={() => setActiveTab('claims')}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-2">
                  {summary.recentClaims.slice(0, 10).map((claim: any) => (
                    <div
                      key={claim.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedClaim(claim);
                        setShowClaimDetailModal(true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          <FileText className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{claim.claimNumber}</p>
                          <p className="text-white/60 text-sm">
                            {claim.patient?.firstName} {claim.patient?.lastName} • {claim.medicalAidProvider}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-white font-bold">{formatCurrency(claim.claimAmount)}</p>
                          {claim.approvedAmount && (
                            <p className="text-white/60 text-sm">Approved: {formatCurrency(claim.approvedAmount)}</p>
                          )}
                        </div>
                        {getReadinessBadge(claimReadinessById[claim.id])}
                        {getStatusBadge(claim.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <div className="space-y-6">
            {/* Bulk Actions */}
            {selectedClaims.size > 0 && (
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 backdrop-blur p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-white font-medium">
                      {selectedClaims.size} claim{selectedClaims.size > 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => setSelectedClaims(new Set())}
                      className="text-white/60 hover:text-white text-sm"
                    >
                      Clear selection
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkSubmit('api')}
                      className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Submit Selected
                    </button>
                    <button
                      onClick={handleBulkCheckStatus}
                      className="px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Check Status
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  >
                    <option value="">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="processing">Processing</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">Provider</label>
                  <select
                    value={filters.provider}
                    onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  >
                    <option value="">All Providers</option>
                    <option value="cimas">CIMAS</option>
                    <option value="premier">Premier</option>
                    <option value="econet_health">Econet Health</option>
                    <option value="first_mutual">First Mutual</option>
                    <option value="psmas">PSMAS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">From Date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">To Date</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  />
                </div>
              </div>
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by claim number, patient name, or member number..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40"
                  />
                </div>
              </div>
            </div>

            {/* Claims List */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              {claims.length > 0 && (
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-white/60 hover:text-white text-sm"
                  >
                    {selectedClaims.size === claims.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    Select All
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {claims.map((claim: any) => {
                  const readiness = claimReadinessById[claim.id];

                  return (
                    <div
                      key={claim.id}
                      className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                        selectedClaims.has(claim.id)
                          ? 'bg-purple-500/20 border-2 border-purple-500/50'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleClaimSelection(claim.id)}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                          {selectedClaims.has(claim.id) ? (
                            <CheckSquare className="w-5 h-5 text-purple-400" />
                          ) : (
                            <Square className="w-5 h-5 text-white/40" />
                          )}
                        </button>
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          <FileText className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{claim.claimNumber}</p>
                          <p className="text-white/60 text-sm">
                            {claim.patient?.firstName} {claim.patient?.lastName} • {claim.medicalAidProvider} • {new Date(claim.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-white font-bold">{formatCurrency(claim.claimAmount)}</p>
                          {claim.approvedAmount && (
                            <p className="text-white/60 text-sm">Approved: {formatCurrency(claim.approvedAmount)}</p>
                          )}
                          {readiness && (
                            <p className="text-white/50 text-xs mt-1">
                              Score {readiness.readinessScore || 0} • {readiness.blockers?.length || 0} blockers • {readiness.warnings?.length || 0} warnings
                            </p>
                          )}
                        </div>
                        {getReadinessBadge(readiness)}
                        {getStatusBadge(claim.status)}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedClaim(claim);
                              setShowClaimDetailModal(true);
                            }}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                          >
                            <Eye className="w-4 h-4 text-white/60" />
                          </button>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedClaims.has(claim.id)}
                              onChange={(e) => {
                                const newSelection = new Set(selectedClaims);
                                if (e.target.checked) {
                                  newSelection.add(claim.id);
                                } else {
                                  newSelection.delete(claim.id);
                                }
                                setSelectedClaims(newSelection);
                              }}
                              className="w-4 h-4 rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500"
                            />
                            {claim.status === 'draft' && (
                              <button
                                onClick={() => handleSubmitClaim(claim.id, 'api')}
                                className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm"
                                title="Submit via API"
                              >
                                Submit
                              </button>
                            )}
                            {claim.status === 'denied' && (
                              <button
                                onClick={async () => {
                                  if (appealClaimId === claim.id) {
                                    setAppealClaimId(null);
                                    return;
                                  }
                                  setAppealClaimId(claim.id);
                                  if (!appealData[claim.id]) {
                                    try {
                                      const res = await cdssApi.generateAppealLetter(
                                        { claim_id: claim.id, denial_reason: claim.denialReason || claim.status_reason || 'Claim denied', clinical_notes: claim.notes || '' },
                                        localStorage.getItem('ehr_token') || '',
                                        tenantSlug!,
                                      );
                                      setAppealData(prev => ({ ...prev, [claim.id]: { letter: (res as any).data?.draft_letter || `Dear Insurance Provider,\n\nWe respectfully appeal the denial of Claim ${claim.claimNumber || claim.id}.\n\nReason for appeal: The services provided were medically necessary.\n\nSincerely,\nClinical Team`, sources: (res as any).data?.sources || [] } }));
                                    } catch {
                                      setAppealData(prev => ({ ...prev, [claim.id]: { letter: `Dear Insurance Provider,\n\nWe respectfully appeal the denial of Claim ${claim.claimNumber || claim.id}.\n\nThe services rendered were medically necessary and clinically indicated.\n\nSincerely,\nClinical Team`, sources: [] } }));
                                    }
                                  }
                                }}
                                className="px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm"
                                title="Generate AI Appeal Letter"
                              >
                                Appeal
                              </button>
                            )}
                            {claim.status === 'submitted' || claim.status === 'processing' ? (
                              <button
                                onClick={async () => {
                                  try {
                                    await claimsApi.checkClaimStatusEnhanced(tenantSlug!, token, claim.id);
                                    showSuccess('Status checked successfully', 'success');
                                    loadDashboardData();
                                  } catch (error: any) {
                                    showError(error.response?.data?.message || 'Failed to check status', 'error');
                                  }
                                }}
                                className="px-3 py-1 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm flex items-center gap-1"
                                title="Check status with medical aid"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Check
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {appealClaimId === claim.id && appealData[claim.id] && (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <AppealLetterPanel
                            claimId={claim.id}
                            denialReasonCode={claim.denialReason || claim.status_reason || 'DENIED'}
                            draftLetter={appealData[claim.id].letter}
                            ragSources={appealData[claim.id].sources}
                            onSubmit={() => { setAppealClaimId(null); showSuccess('Appeal submitted', 'success'); }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'readiness' && (
          <div className="space-y-6">
            {claimReadinessSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard
                  title="Blocked Claims"
                  value={claimReadinessSummary.blocked || 0}
                  icon={XCircle}
                  subtitle={`${claimReadinessSummary.missingDiagnosis || 0} missing diagnosis`}
                  accent="from-red-500/20 to-rose-500/20"
                />
                <StatCard
                  title="At Risk"
                  value={claimReadinessSummary.atRisk || 0}
                  icon={AlertCircle}
                  subtitle={`${claimReadinessSummary.preAuthorizationIssues || 0} preauth issues`}
                  accent="from-amber-500/20 to-orange-500/20"
                />
                <StatCard
                  title="Missing Docs"
                  value={claimReadinessSummary.missingSupportingDocuments || 0}
                  icon={Upload}
                  subtitle={`${claimReadinessSummary.missingClinicalDocumentation || 0} missing notes`}
                  accent="from-purple-500/20 to-pink-500/20"
                />
                <StatCard
                  title="Ready"
                  value={claimReadinessSummary.ready || 0}
                  icon={CheckCircle}
                  subtitle={`${claimReadinessSummary.total || 0} monitored claims`}
                  accent="from-emerald-500/20 to-teal-500/20"
                />
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Denial-Prevention Worklist</h3>
                  <p className="text-white/60 text-sm mt-1">Prioritize blocked and at-risk claims before submission or resubmission.</p>
                </div>
                <button
                  onClick={loadDashboardData}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              <div className="space-y-3">
                {claimReadinessWorklist.map((item: any) => (
                  <div
                    key={item.claimId}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-white font-semibold">{item.claimNumber}</p>
                          {getReadinessBadge(item)}
                          {getStatusBadge(item.claimStatus || item.status || 'draft')}
                        </div>
                        <p className="text-white/70 text-sm">
                          {item.evidence?.patient?.patientName || 'Unknown patient'}
                          {item.evidence?.patient?.patientNumber ? ` • ${item.evidence.patient.patientNumber}` : ''}
                          {item.financial?.payer ? ` • ${item.financial.payer}` : ''}
                        </p>
                        <p className="text-white/50 text-xs">
                          Readiness score {item.readinessScore || 0}
                          {item.financial?.claimAmount ? ` • ${formatCurrency(item.financial.claimAmount)}` : ''}
                        </p>
                        {item.blockers?.length > 0 && (
                          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Blockers</p>
                            <div className="mt-2 space-y-1 text-sm text-white/80">
                              {item.blockers.slice(0, 3).map((issue: any) => (
                                <p key={`${item.claimId}-${issue.code}`}>{issue.message}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {item.warnings?.length > 0 && (
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Warnings</p>
                            <div className="mt-2 space-y-1 text-sm text-white/80">
                              {item.warnings.slice(0, 2).map((issue: any) => (
                                <p key={`${item.claimId}-${issue.code}`}>{issue.message}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 lg:min-w-[180px]">
                        <button
                          onClick={() => {
                            const matchedClaim =
                              claims.find((claim) => claim.id === item.claimId) || {
                                id: item.claimId,
                                claimNumber: item.claimNumber,
                                status: item.claimStatus,
                                claimAmount: item.financial?.claimAmount || 0,
                                medicalAidProvider: item.financial?.payer || '',
                                patient: {
                                  firstName: item.evidence?.patient?.patientName || '',
                                  lastName: '',
                                },
                              };
                            setSelectedClaim(matchedClaim);
                            setShowClaimDetailModal(true);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                        >
                          <Eye className="w-4 h-4" />
                          Review claim
                        </button>
                        {item.claimStatus === 'draft' && (
                          <button
                            onClick={() => handleSubmitClaim(item.claimId, 'api')}
                            disabled={item.status === 'blocked'}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                            Submit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {claimReadinessWorklist.length === 0 && (
                  <div className="py-12 text-center text-white/60">
                    No claim readiness issues found in the current worklist.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Tab */}
        {activeTab === 'create' && (
          <CreateClaimTab
            tenantSlug={tenantSlug!}
            token={token}
            bills={bills}
            onSuccess={() => {
              setActiveTab('claims');
              loadDashboardData();
            }}
          />
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            tenantSlug={tenantSlug!}
            token={token}
            analytics={analytics}
            filters={filters}
            onFiltersChange={setFilters}
            onLoad={loadDashboardData}
          />
        )}

        {activeTab === 'preauth' && (
          <PreAuthorizationTab
            tenantSlug={tenantSlug!}
            token={token}
            preAuthorizations={preAuthorizations}
            onRefresh={loadDashboardData}
          />
        )}

        {activeTab === 'bulk' && (
          <BulkOperationsTab
            claims={claims}
            selectedClaims={selectedClaims}
            toggleClaimSelection={toggleClaimSelection}
            toggleSelectAll={toggleSelectAll}
            onBulkSubmit={handleBulkSubmit}
            onBulkCheckStatus={handleBulkCheckStatus}
            claimReadinessById={claimReadinessById}
          />
        )}

        {activeTab === 'api-config' && (
          <ApiConfigurationTab
            tenantSlug={tenantSlug!}
            token={token}
            configurations={apiConfigurations}
            onRefresh={loadDashboardData}
          />
        )}
      </div>

      {/* Claim Detail Modal */}
      {showClaimDetailModal && selectedClaim && (
        <ModalPortal>
          <ClaimDetailModal
            claim={selectedClaim}
            onClose={() => {
              setShowClaimDetailModal(false);
              setSelectedClaim(null);
            }}
            onSubmit={handleSubmitClaim}
            onResubmit={handleResubmitClaim}
            tenantSlug={tenantSlug!}
            token={token}
            onRefresh={loadDashboardData}
          />
        </ModalPortal>
      )}

      {/* Pre-Authorization Modal - Placeholder */}
      {/* 
      {showPreAuthModal && (
        <ModalPortal>
          <PreAuthorizationModal
            tenantSlug={tenantSlug!}
            token={token}
            onClose={() => setShowPreAuthModal(false)}
            onSuccess={() => {
              setShowPreAuthModal(false);
              loadDashboardData();
            }}
          />
        </ModalPortal>
      )}
      */}

      {/* API Configuration Modal - Placeholder */}
      {/* 
      {showApiConfigModal && (
        <ModalPortal>
          <ApiConfigurationModal
            tenantSlug={tenantSlug!}
            token={token}
            onClose={() => setShowApiConfigModal(false)}
            onSuccess={() => {
              setShowApiConfigModal(false);
              loadDashboardData();
            }}
          />
        </ModalPortal>
      )}
      */}
    </div>
  );
};

// Create Claim Tab Component
const CreateClaimTab: React.FC<{
  tenantSlug: string;
  token: string;
  bills: any[];
  onSuccess: () => void;
}> = ({ tenantSlug, token, bills, onSuccess }) => {
  const { showError, showSuccess } = useNotification();
  const [claimSource, setClaimSource] = useState<'bill' | 'appointment' | 'procedure'>('bill');
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedProcedure, setSelectedProcedure] = useState<any>(null);
  const [procedureType, setProcedureType] = useState<'lab' | 'imaging'>('lab');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    medicalAidProvider: '',
    memberNumber: '',
    memberName: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Load appointments and procedures when source changes
  useEffect(() => {
    if (claimSource === 'appointment') {
      loadAppointments();
    } else if (claimSource === 'procedure') {
      loadProcedures();
    }
  }, [claimSource]);

  const loadAppointments = async () => {
    setLoadingData(true);
    try {
      const response = await ehrApi.getAppointments(tenantSlug, token, { status: 'completed' });
      setAppointments(response.data?.appointments || []);
    } catch (error: any) {
      showError('Failed to load appointments', error.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoadingData(false);
    }
  };

  const loadProcedures = async () => {
    setLoadingData(true);
    try {
      // Load lab orders and imaging orders
      const [labResponse, imagingResponse] = await Promise.all([
        ehrApi.getLabOrders(tenantSlug, token, 'completed').catch(() => ({ data: [] })),
        ehrApi.getImagingOrders(tenantSlug, token, 'completed').catch(() => ({ data: [] })),
      ]);
      setProcedures([
        ...(labResponse.data || []).map((item: any) => ({ ...item, procedureType: 'lab' })),
        ...(imagingResponse.data || []).map((item: any) => ({ ...item, procedureType: 'imaging' })),
      ]);
    } catch (error: any) {
      showError('Failed to load procedures', error.response?.data?.message || 'Failed to load procedures');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateClaim = async () => {
    if (!formData.medicalAidProvider || !formData.memberNumber) {
      showError('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      if (claimSource === 'bill' && selectedBill) {
        await claimsApi.generateClaimFromBill(tenantSlug, token, selectedBill.id, formData);
      } else if (claimSource === 'appointment' && selectedAppointment) {
        await claimsApi.generateClaimFromAppointment(tenantSlug, token, selectedAppointment.id, formData);
      } else if (claimSource === 'procedure' && selectedProcedure) {
        await claimsApi.generateClaimFromProcedure(
          tenantSlug,
          token,
          selectedProcedure.id,
          selectedProcedure.procedureType || procedureType,
          formData,
        );
      } else {
        showError('Please select a source item', 'error');
        return;
      }
      showSuccess('Claim created successfully', 'success');
      onSuccess();
    } catch (error: any) {
      showError('Failed to create claim', error.response?.data?.message || 'Please check your input');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <h3 className="text-xl font-bold text-white mb-4">Create Medical Aid Claim</h3>
        
        {/* Source Selection */}
        <div className="mb-6">
          <label className="block text-white/60 text-sm mb-2">Claim Source</label>
          <div className="grid grid-cols-3 gap-3">
            {(['bill', 'appointment', 'procedure'] as const).map((source) => (
              <button
                key={source}
                onClick={() => setClaimSource(source)}
                className={`px-4 py-3 rounded-lg transition-colors capitalize ${
                  claimSource === source
                    ? 'bg-purple-500/20 border-2 border-purple-500 text-white'
                    : 'bg-white/5 hover:bg-white/10 border-2 border-transparent text-white/60'
                }`}
              >
                {source === 'appointment' ? 'From Appointment' : source === 'procedure' ? 'From Procedure' : 'From Bill'}
              </button>
            ))}
          </div>
        </div>

        {/* Bill Selection */}
        {claimSource === 'bill' && (
          <div className="mb-6">
            <label className="block text-white/60 text-sm mb-2">Select Bill</label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bills.map((bill) => (
                <div
                  key={bill.id}
                  onClick={() => setSelectedBill(bill)}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedBill?.id === bill.id
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{bill.billNumber}</p>
                      <p className="text-white/60 text-sm">
                        {bill.patient?.firstName} {bill.patient?.lastName} • {new Date(bill.billDate).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-white font-bold">{formatCurrency(bill.totalAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Appointment Selection */}
        {claimSource === 'appointment' && (
          <div className="mb-6">
            <label className="block text-white/60 text-sm mb-2">Select Completed Appointment</label>
            {loadingData ? (
              <div className="text-white/60 text-center py-8">Loading appointments...</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    onClick={() => setSelectedAppointment(appointment)}
                    className={`p-4 rounded-lg cursor-pointer transition-colors ${
                      selectedAppointment?.id === appointment.id
                        ? 'bg-purple-500/20 border-2 border-purple-500'
                        : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">
                          {appointment.patient?.firstName} {appointment.patient?.lastName}
                        </p>
                        <p className="text-white/60 text-sm">
                          {appointment.appointmentType} • {new Date(appointment.appointmentDate).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-white font-bold">{formatCurrency(appointment.feeAmount || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Procedure Selection */}
        {claimSource === 'procedure' && (
          <div className="mb-6">
            <div className="mb-4">
              <label className="block text-white/60 text-sm mb-2">Procedure Type</label>
              <select
                value={procedureType}
                onChange={(e) => {
                  setProcedureType(e.target.value as 'lab' | 'imaging');
                  setSelectedProcedure(null);
                }}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              >
                <option value="lab">Lab Test</option>
                <option value="imaging">Imaging Study</option>
              </select>
            </div>
            <label className="block text-white/60 text-sm mb-2">Select Completed Procedure</label>
            {loadingData ? (
              <div className="text-white/60 text-center py-8">Loading procedures...</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {procedures
                  .filter((p) => p.procedureType === procedureType)
                  .map((procedure) => (
                    <div
                      key={procedure.id}
                      onClick={() => setSelectedProcedure(procedure)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        selectedProcedure?.id === procedure.id
                          ? 'bg-purple-500/20 border-2 border-purple-500'
                          : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">
                            {procedure.patient?.firstName} {procedure.patient?.lastName}
                          </p>
                          <p className="text-white/60 text-sm">
                            {procedure.testName || procedure.studyType} • {new Date(procedure.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-white font-bold">{formatCurrency(procedure.feeAmount || procedure.price || 0)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Claim Details */}
        {(selectedBill || selectedAppointment || selectedProcedure) && (
          <div className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-2">Medical Aid Provider *</label>
              <select
                value={formData.medicalAidProvider}
                onChange={(e) => setFormData({ ...formData, medicalAidProvider: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                required
              >
                <option value="">Select Provider</option>
                <option value="cimas">CIMAS</option>
                <option value="premier">Premier</option>
                <option value="econet_health">Econet Health</option>
                <option value="first_mutual">First Mutual</option>
                <option value="psmas">PSMAS</option>
              </select>
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-2">Member Number *</label>
              <input
                type="text"
                value={formData.memberNumber}
                onChange={(e) => setFormData({ ...formData, memberNumber: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-2">Member Name</label>
              <input
                type="text"
                value={formData.memberName}
                onChange={(e) => setFormData({ ...formData, memberName: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                placeholder="Auto-filled from patient if empty"
              />
            </div>
            <button
              onClick={handleCreateClaim}
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Claim'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const PreAuthorizationTab: React.FC<{
  tenantSlug: string;
  token: string;
  preAuthorizations: any[];
  onRefresh: () => void;
}> = ({ tenantSlug, token, preAuthorizations, onRefresh }) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    billingId: '',
    appointmentId: '',
    medicalAidName: 'cimas',
    memberNumber: '',
    requestType: 'consultation',
    requestedAmount: '',
    primaryDiagnosisCode: '',
    clinicalNotes: '',
  });

  const submitPreAuth = async () => {
    if (!formData.medicalAidName || !formData.memberNumber || !formData.requestedAmount) {
      showError('Medical aid, member number, and requested amount are required.', 'error');
      return;
    }

    setLoading(true);
    try {
      await claimsApi.createPreAuthorization(tenantSlug, token, {
        ...formData,
        requestedAmount: Number(formData.requestedAmount),
      });
      showSuccess('Pre-authorization created.', 'success');
      onRefresh();
      setFormData((prev) => ({
        ...prev,
        patientId: '',
        billingId: '',
        appointmentId: '',
        memberNumber: '',
        requestedAmount: '',
        primaryDiagnosisCode: '',
        clinicalNotes: '',
      }));
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to create pre-authorization', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToPayer = async (id: string) => {
    try {
      await claimsApi.submitPreAuthorization(tenantSlug, token, id);
      showSuccess('Pre-authorization submitted to payer.', 'success');
      onRefresh();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to submit pre-authorization', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <h3 className="text-xl font-bold text-white mb-4">Create Pre-Authorization</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">Medical Aid</label>
            <select
              value={formData.medicalAidName}
              onChange={(e) => setFormData({ ...formData, medicalAidName: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            >
              <option value="cimas">CIMAS</option>
              <option value="premier">Premier</option>
              <option value="econet_health">Econet Health</option>
              <option value="psmas">PSMAS</option>
              <option value="first_mutual">First Mutual</option>
              <option value="demo_aid">Demo Aid</option>
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Member Number</label>
            <input
              value={formData.memberNumber}
              onChange={(e) => setFormData({ ...formData, memberNumber: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Patient ID (optional)</label>
            <input
              value={formData.patientId}
              onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Requested Amount</label>
            <input
              type="number"
              value={formData.requestedAmount}
              onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Request Type</label>
            <input
              value={formData.requestType}
              onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Primary Diagnosis</label>
            <input
              value={formData.primaryDiagnosisCode}
              onChange={(e) => setFormData({ ...formData, primaryDiagnosisCode: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-white/60 text-sm mb-2">Clinical Notes</label>
          <textarea
            value={formData.clinicalNotes}
            onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white min-h-[96px]"
          />
        </div>
        <button
          onClick={submitPreAuth}
          disabled={loading}
          className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Pre-Authorization'}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <h3 className="text-xl font-bold text-white mb-4">Pre-Authorization Worklist</h3>
        <div className="space-y-3">
          {preAuthorizations.map((item: any) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-white font-semibold">{item.medical_aid_name || item.medicalAidName}</p>
                  <p className="text-white/60 text-sm">
                    Member: {item.member_number || item.memberNumber} • Requested: {formatCurrency(item.requested_amount || item.requestedAmount || 0)}
                  </p>
                  <p className="text-white/60 text-xs mt-1">
                    Status: {item.status} {item.external_preauth_id ? `• External: ${item.external_preauth_id}` : ''}
                  </p>
                </div>
                {item.status === 'pending' && (
                  <button
                    onClick={() => handleSubmitToPayer(item.id)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Submit to Payer
                  </button>
                )}
              </div>
            </div>
          ))}
          {preAuthorizations.length === 0 && (
            <p className="text-white/60 text-center py-8">No pre-authorizations available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const BulkOperationsTab: React.FC<{
  claims: any[];
  selectedClaims: Set<string>;
  toggleClaimSelection: (claimId: string) => void;
  toggleSelectAll: () => void;
  onBulkSubmit: (method?: 'api' | 'edi') => void;
  onBulkCheckStatus: () => void;
  claimReadinessById: Record<string, any>;
}> = ({ claims, selectedClaims, toggleClaimSelection, toggleSelectAll, onBulkSubmit, onBulkCheckStatus, claimReadinessById }) => {
  const selectedCount = selectedClaims.size;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 backdrop-blur p-6">
        <h3 className="text-xl font-bold text-white mb-2">Bulk Claim Operations</h3>
        <p className="text-white/70 text-sm mb-4">
          Select multiple claims and submit/check status in one action.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            {selectedCount === claims.length && claims.length > 0 ? 'Clear All' : 'Select All'}
          </button>
          <button
            onClick={() => onBulkSubmit('api')}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Submit Selected (API)
          </button>
          <button
            onClick={() => onBulkSubmit('edi')}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
          >
            Submit Selected (EDI)
          </button>
          <button
            onClick={onBulkCheckStatus}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
          >
            Check Status
          </button>
          <span className="text-white/70 text-sm">{selectedCount} selected</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <div className="space-y-2">
          {claims.map((claim: any) => {
            const readiness = claimReadinessById[claim.id];
            return (
              <label
                key={claim.id}
                className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer ${
                  selectedClaims.has(claim.id)
                    ? 'border-purple-500 bg-purple-500/15'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedClaims.has(claim.id)}
                    onChange={() => toggleClaimSelection(claim.id)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="text-white font-medium">{claim.claimNumber}</p>
                    <p className="text-white/60 text-xs">
                      {claim.medicalAidProvider} • {formatCurrency(claim.claimAmount)} • {claim.status}
                    </p>
                  </div>
                </div>
                {readiness && (
                  <p className="text-white/60 text-xs">
                    Readiness: {readiness.status} ({readiness.readinessScore || 0})
                  </p>
                )}
              </label>
            );
          })}
          {claims.length === 0 && (
            <p className="text-white/60 text-center py-8">No claims available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const ApiConfigurationTab: React.FC<{
  tenantSlug: string;
  token: string;
  configurations: any[];
  onRefresh: () => void;
}> = ({ tenantSlug, token, configurations, onRefresh }) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyData, setVerifyData] = useState({
    medicalAidName: 'cimas',
    memberNumber: 'MED-1001',
  });

  const demoPortalUrl = process.env.REACT_APP_MEDICAL_AID_DEMO_URL ||
    (window?.location?.hostname
      ? `${window.location.protocol}//${window.location.hostname}:3004`
      : '');

  const [formData, setFormData] = useState({
    medicalAidName: 'cimas',
    providerType: 'cimas',
    apiBaseUrl: process.env.REACT_APP_MEDICAL_AID_DEMO_URL || 'http://medical-aid-demo-service:3004',
    apiKey: process.env.REACT_APP_MEDICAL_AID_DEMO_API_KEY || 'demo-medical-aid-key',
    authenticationType: 'api_key',
    claimSubmissionEndpoint: '/api/claims',
    statusCheckEndpoint: '/api/claims',
    preauthEndpoint: '/api/preauth',
    memberVerificationEndpoint: '/api/members/verify',
    requestTimeout: 20000,
    retryCount: 2,
    retryDelay: 500,
    isActive: true,
    testMode: false,
  });

  const resolveProviderType = (provider: string) => (
    provider === 'econet_health'
      ? 'econet_health'
      : provider === 'premier'
        ? 'premier'
        : provider === 'psmas'
          ? 'psmas'
          : provider === 'cimas'
            ? 'cimas'
            : 'other'
  );

  const buildDemoConfig = (provider: string) => ({
    ...formData,
    medicalAidName: provider,
    providerType: resolveProviderType(provider),
    apiBaseUrl: process.env.REACT_APP_MEDICAL_AID_DEMO_URL || 'http://medical-aid-demo-service:3004',
    authenticationType: 'api_key',
    claimSubmissionEndpoint: '/api/claims',
    statusCheckEndpoint: '/api/claims',
    preauthEndpoint: '/api/preauth',
    memberVerificationEndpoint: '/api/members/verify',
    requestTimeout: 20000,
    retryCount: 2,
    retryDelay: 500,
    isActive: true,
    testMode: false,
  });

  const saveConfiguration = async () => {
    setLoading(true);
    try {
      await claimsApi.saveApiConfiguration(tenantSlug, token, formData);
      showSuccess('API configuration saved.', 'success');
      onRefresh();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to save API configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const verifyMember = async () => {
    setLoading(true);
    setVerifyResult(null);
    try {
      const response = await claimsApi.verifyMember(
        tenantSlug,
        token,
        verifyData.medicalAidName,
        verifyData.memberNumber,
      );
      setVerifyResult(response.data);
      showSuccess('Member verification completed.', 'success');
    } catch (error: any) {
      showError(error.response?.data?.message || 'Member verification failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const runDemoSetup = async () => {
    const provider = (formData.medicalAidName || verifyData.medicalAidName || 'cimas').trim().toLowerCase();
    const memberNumber = (verifyData.memberNumber || 'MED-1001').trim().toUpperCase();
    const demoConfig = buildDemoConfig(provider);

    setLoading(true);
    setVerifyResult(null);
    try {
      await claimsApi.saveApiConfiguration(tenantSlug, token, demoConfig);
      const response = await claimsApi.verifyMember(tenantSlug, token, provider, memberNumber);
      setFormData(demoConfig);
      setVerifyData({ medicalAidName: provider, memberNumber });
      setVerifyResult(response.data);
      onRefresh();

      if (response.data?.valid) {
        showSuccess(`Demo setup complete. ${memberNumber} verified for ${provider}.`, 'success');
      } else {
        showSuccess(
          `Demo config saved for ${provider}. Verification returned: ${response.data?.error || 'not eligible'}.`,
          'success',
        );
      }
    } catch (error: any) {
      showError(error.response?.data?.message || 'Demo setup failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyDemoTemplate = (provider: string) => {
    setFormData(buildDemoConfig(provider));
    setVerifyData((prev) => ({ ...prev, medicalAidName: provider }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 backdrop-blur p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">Demo Medical Aid Provider</h3>
            <p className="text-white/70 text-sm mt-1">
              Use this panel to point claims submissions to the new demo provider service.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={runDemoSetup}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Demo Setup
            </button>
            <a
              href={demoPortalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ExternalLink className="w-4 h-4" />
              Open Demo Provider Portal
            </a>
          </div>
        </div>
        <p className="text-white/60 text-xs mt-3">
          Demo Setup saves payer API config for the selected provider and runs member verification for <code>MED-1001</code>.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {['cimas', 'premier', 'econet_health', 'psmas', 'first_mutual', 'demo_aid'].map((provider) => (
            <button
              key={provider}
              onClick={() => applyDemoTemplate(provider)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
            >
              Use {provider}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">Medical Aid Name</label>
            <input
              value={formData.medicalAidName}
              onChange={(e) => setFormData({ ...formData, medicalAidName: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Provider Type</label>
            <select
              value={formData.providerType}
              onChange={(e) => setFormData({ ...formData, providerType: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            >
              <option value="cimas">cimas</option>
              <option value="premier">premier</option>
              <option value="econet_health">econet_health</option>
              <option value="psmas">psmas</option>
              <option value="other">other</option>
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">API Base URL</label>
            <input
              value={formData.apiBaseUrl}
              onChange={(e) => setFormData({ ...formData, apiBaseUrl: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">API Key</label>
            <input
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Claim Endpoint</label>
            <input
              value={formData.claimSubmissionEndpoint}
              onChange={(e) => setFormData({ ...formData, claimSubmissionEndpoint: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Status Endpoint</label>
            <input
              value={formData.statusCheckEndpoint}
              onChange={(e) => setFormData({ ...formData, statusCheckEndpoint: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Preauth Endpoint</label>
            <input
              value={formData.preauthEndpoint}
              onChange={(e) => setFormData({ ...formData, preauthEndpoint: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Member Verify Endpoint</label>
            <input
              value={formData.memberVerificationEndpoint}
              onChange={(e) => setFormData({ ...formData, memberVerificationEndpoint: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
        </div>
        <button
          onClick={saveConfiguration}
          disabled={loading}
          className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50"
        >
          Save API Configuration
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <h3 className="text-lg font-bold text-white mb-4">Member Verification Test</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            value={verifyData.medicalAidName}
            onChange={(e) => setVerifyData({ ...verifyData, medicalAidName: e.target.value })}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            placeholder="medical aid name"
          />
          <input
            value={verifyData.memberNumber}
            onChange={(e) => setVerifyData({ ...verifyData, memberNumber: e.target.value })}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            placeholder="member number"
          />
          <button
            onClick={verifyMember}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Verify Member
          </button>
        </div>
        {verifyResult && (
          <pre className="mt-4 p-4 rounded-lg bg-black/30 border border-white/10 text-xs text-white/80 overflow-auto">
            {JSON.stringify(verifyResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <h3 className="text-lg font-bold text-white mb-4">Saved Configurations</h3>
        <div className="space-y-3">
          {configurations.map((config: any) => (
            <div key={config.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-white font-medium">{config.medicalAidName}</p>
              <p className="text-white/60 text-sm">
                {config.providerType} • {config.apiBaseUrl} • {config.authenticationType}
              </p>
            </div>
          ))}
          {configurations.length === 0 && (
            <p className="text-white/60">No saved configurations yet. You can still use environment fallback demo integration.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Analytics Tab Component
const AnalyticsTab: React.FC<{
  tenantSlug: string;
  token: string;
  analytics: any;
  filters: any;
  onFiltersChange: (filters: any) => void;
  onLoad: () => void;
}> = ({ analytics, filters, onFiltersChange, onLoad }) => {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            />
          </div>
        </div>
        <button
          onClick={onLoad}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
        >
          Load Analytics
        </button>
      </div>

      {analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-6 rounded-lg bg-white/5">
              <p className="text-white/60 text-sm">Success Rate</p>
              <p className="text-3xl font-bold text-white">{analytics.successRate}%</p>
            </div>
            <div className="p-6 rounded-lg bg-white/5">
              <p className="text-white/60 text-sm">Avg Turnaround</p>
              <p className="text-3xl font-bold text-white">{analytics.turnaroundTime?.avg} days</p>
            </div>
            <div className="p-6 rounded-lg bg-white/5">
              <p className="text-white/60 text-sm">Rejection Reasons</p>
              <p className="text-3xl font-bold text-white">{analytics.rejectionReasons?.length || 0}</p>
            </div>
          </div>

          {analytics.monthlyTrend && analytics.monthlyTrend.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <h3 className="text-xl font-bold text-white mb-4">Monthly Trend</h3>
              <div className="space-y-2">
                {analytics.monthlyTrend.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between p-4 rounded-lg bg-white/5">
                    <p className="text-white">
                      {new Date(item.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                    <div className="text-right">
                      <p className="text-white font-bold">{item.claim_count} claims</p>
                      <p className="text-white/60 text-sm">
                        {formatCurrency(item.total_amount)} • {item.approved_count} approved
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Claim Detail Modal Component
const ClaimDetailModal: React.FC<{
  claim: any;
  onClose: () => void;
  onSubmit: (id: string, method?: 'api' | 'edi' | 'manual') => void;
  onResubmit: (id: string, data: any) => void;
  tenantSlug: string;
  token: string;
  onRefresh: () => void;
}> = ({ claim, onClose, onSubmit, onResubmit, tenantSlug, token, onRefresh }) => {
  const { showError, showSuccess } = useNotification();
  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [claimReadiness, setClaimReadiness] = useState<any>(null);
  const [financialClearance, setFinancialClearance] = useState<any>(null);
  const [priorAuthorizationDraft, setPriorAuthorizationDraft] = useState<any>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [loadingFinancialClearance, setLoadingFinancialClearance] = useState(false);
  const [generatingPriorAuthDraft, setGeneratingPriorAuthDraft] = useState(false);
  const [resubmitData, setResubmitData] = useState({
    memberNumber: claim.memberNumber || '',
    memberName: claim.memberName || '',
    claimAmount: claim.claimAmount || '',
  });

  const loadStatusHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await claimsApi.getClaimStatusHistory(tenantSlug, token, claim.id);
      setStatusHistory(response.data || []);
    } catch (error: any) {
      showError('Failed to load status history', error.response?.data?.message || '');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showStatusHistory && statusHistory.length === 0) {
      loadStatusHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStatusHistory]);

  useEffect(() => {
    const loadClaimReadiness = async () => {
      setLoadingReadiness(true);
      setLoadingFinancialClearance(true);
      try {
        const [readinessResult, clearanceResult] = await Promise.allSettled([
          claimsApi.getClaimReadiness(tenantSlug, token, claim.id),
          claimsApi.getClaimFinancialClearance(tenantSlug, token, claim.id),
        ]);
        if (readinessResult.status === 'rejected') {
          throw readinessResult.reason;
        }

        setClaimReadiness(readinessResult.value.data || null);
        setFinancialClearance(
          clearanceResult.status === 'fulfilled' ? clearanceResult.value.data || null : null,
        );
      } catch (error: any) {
        showError('Failed to load claim readiness', error.response?.data?.message || '');
        setClaimReadiness(null);
        setFinancialClearance(null);
      } finally {
        setLoadingReadiness(false);
        setLoadingFinancialClearance(false);
      }
    };

    if (claim?.id) {
      void loadClaimReadiness();
    }
  }, [claim?.id, showError, tenantSlug, token]);

  const handleGeneratePriorAuthorizationDraft = async () => {
    setGeneratingPriorAuthDraft(true);
    try {
      const response = await claimsApi.generatePriorAuthorizationDraft(tenantSlug, token, claim.id);
      setPriorAuthorizationDraft(response.data || null);
      showSuccess('Prior-authorization draft generated', 'success');
    } catch (error: any) {
      showError('Failed to generate prior-authorization draft', error.response?.data?.message || '');
    } finally {
      setGeneratingPriorAuthDraft(false);
    }
  };

  const readinessStatus = String(claimReadiness?.status || '').toLowerCase();
  const submitBlocked = readinessStatus === 'blocked';

  return (
    <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Claim Details</h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <XCircle className="w-5 h-5 text-white/60" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/60 text-sm">Claim Number</p>
            <p className="text-white font-medium">{claim.claimNumber}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Status</p>
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${claim.status === 'approved' ? 'bg-green-500/20 text-green-400' : claim.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {claim.status}
            </span>
          </div>
        </div>

        <div>
          <p className="text-white/60 text-sm">Patient</p>
          <p className="text-white font-medium">
            {claim.patient?.firstName} {claim.patient?.lastName}
          </p>
        </div>

        <div>
          <p className="text-white/60 text-sm">Medical Aid Provider</p>
          <p className="text-white font-medium capitalize">{claim.medicalAidProvider?.replace('_', ' ')}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/60 text-sm">Claim Amount</p>
            <p className="text-white font-bold text-xl">{formatCurrency(claim.claimAmount)}</p>
          </div>
          {claim.approvedAmount && (
            <div>
              <p className="text-white/60 text-sm">Approved Amount</p>
              <p className="text-white font-bold text-xl">{formatCurrency(claim.approvedAmount)}</p>
            </div>
          )}
        </div>

        {claim.rejectionReason && (
          <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30">
            <p className="text-red-400 font-medium mb-1">Rejection Reason</p>
            <p className="text-white/80 text-sm">{claim.rejectionReason}</p>
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm">Claim readiness</p>
              <p className="text-white font-medium">
                {loadingReadiness ? 'Loading readiness...' : `Score ${claimReadiness?.readinessScore || 0}`}
              </p>
            </div>
            {loadingReadiness ? (
              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-500/20 text-slate-300">
                Checking
              </span>
            ) : !claimReadiness ? (
              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-500/20 text-slate-300">
                Unavailable
              </span>
            ) : readinessStatus === 'ready' ? (
              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300">
                Ready
              </span>
            ) : readinessStatus === 'at_risk' ? (
              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300">
                At Risk
              </span>
            ) : (
              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-300">
                Blocked
              </span>
            )}
          </div>

          {!loadingReadiness && claimReadiness && (
            <div className="mt-4 space-y-3">
              {claimReadiness.blockers?.length > 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Blockers</p>
                  <div className="mt-2 space-y-1 text-sm text-white/80">
                    {claimReadiness.blockers.map((issue: any) => (
                      <p key={issue.code}>{issue.message}</p>
                    ))}
                  </div>
                </div>
              )}
              {claimReadiness.warnings?.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Warnings</p>
                  <div className="mt-2 space-y-1 text-sm text-white/80">
                    {claimReadiness.warnings.map((issue: any) => (
                      <p key={issue.code}>{issue.message}</p>
                    ))}
                  </div>
                </div>
              )}
              {claimReadiness.missingDocuments?.length > 0 && (
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">Missing documents</p>
                  <div className="mt-2 space-y-1 text-sm text-white/80">
                    {claimReadiness.missingDocuments.map((issue: any) => (
                      <p key={issue.code}>{issue.message}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-cyan-100 text-sm">Financial clearance</p>
              <p className="text-white font-medium">
                {loadingFinancialClearance
                  ? 'Loading financial clearance...'
                  : financialClearance?.financialClearance?.assessmentStatus || 'Unavailable'}
              </p>
            </div>
            {financialClearance?.denialPrediction?.riskLevel ? (
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                String(financialClearance.denialPrediction.riskLevel).toLowerCase() === 'high'
                  ? 'bg-red-500/20 text-red-300'
                  : String(financialClearance.denialPrediction.riskLevel).toLowerCase() === 'medium'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                Denial risk: {financialClearance.denialPrediction.riskLevel}
              </span>
            ) : null}
          </div>

          {!loadingFinancialClearance && financialClearance && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/60">Recommended action</p>
                  <p className="text-white">{financialClearance.financialClearance?.recommendedAction || '—'}</p>
                </div>
                <div>
                  <p className="text-white/60">Coverage status</p>
                  <p className="text-white">{financialClearance.financial?.coverageStatus || '—'}</p>
                </div>
                <div>
                  <p className="text-white/60">Expected patient portion</p>
                  <p className="text-white">
                    {formatCurrency(financialClearance.financial?.patientResponsibilityEstimate || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-white/60">Expected payer amount</p>
                  <p className="text-white">
                    {formatCurrency(financialClearance.financial?.expectedPayerAmount || 0)}
                  </p>
                </div>
              </div>

              {financialClearance.financialClearance?.blockers?.length > 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Financial blockers</p>
                  <div className="mt-2 space-y-1 text-sm text-white/80">
                    {financialClearance.financialClearance.blockers.map((issue: any) => (
                      <p key={issue.code || issue.message}>{issue.message || issue.code}</p>
                    ))}
                  </div>
                </div>
              )}

              {financialClearance.denialPrediction?.topDrivers?.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Denial drivers</p>
                  <div className="mt-2 space-y-1 text-sm text-white/80">
                    {financialClearance.denialPrediction.topDrivers.map((driver: any) => (
                      <p key={driver.code || driver.label || driver}>{driver.label || driver.message || driver.code || String(driver)}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-white text-sm font-medium">Prior-authorization draft</p>
                  <p className="text-white/60 text-xs">
                    Generate a payer-ready draft from the current claim readiness evidence.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGeneratePriorAuthorizationDraft()}
                  disabled={generatingPriorAuthDraft}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  {generatingPriorAuthDraft ? 'Generating…' : 'Generate draft'}
                </button>
              </div>

              {priorAuthorizationDraft && (
                <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 p-3 text-sm text-white/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Draft summary</p>
                  <div className="mt-2 space-y-1">
                    <p><span className="text-white/60">Request type:</span> {priorAuthorizationDraft.requestType || '—'}</p>
                    <p><span className="text-white/60">Clinical summary:</span> {priorAuthorizationDraft.clinicalSummary || '—'}</p>
                    <p><span className="text-white/60">Medical necessity:</span> {priorAuthorizationDraft.medicalNecessityStatement || '—'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status History Section */}
        <div className="border-t border-white/10 pt-4">
          <button
            onClick={() => {
              setShowStatusHistory(!showStatusHistory);
              if (!showStatusHistory && statusHistory.length === 0) {
                loadStatusHistory();
              }
            }}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-2"
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">Status History</span>
            {showStatusHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showStatusHistory && (
            <div className="mt-4 space-y-3">
              {loadingHistory ? (
                <div className="text-white/60 text-center py-4">Loading history...</div>
              ) : statusHistory.length === 0 ? (
                <div className="text-white/60 text-center py-4">No status history available</div>
              ) : (
                <div className="space-y-2">
                  {statusHistory.map((history: any, index: number) => (
                    <div
                      key={history.id || index}
                      className="p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              history.status === 'approved' || history.status === 'paid'
                                ? 'bg-green-500/20 text-green-400'
                                : history.status === 'rejected'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {history.status}
                            </span>
                            {history.previousStatus && (
                              <>
                                <span className="text-white/40">←</span>
                                <span className="text-white/60 text-xs">{history.previousStatus}</span>
                              </>
                            )}
                          </div>
                          {history.changeReason && (
                            <p className="text-white/80 text-sm mt-1">{history.changeReason}</p>
                          )}
                          {history.changedByName && (
                            <p className="text-white/60 text-xs mt-1">By: {history.changedByName}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-white/60 text-xs">
                            {new Date(history.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-white/40 text-xs">
                            {new Date(history.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {showResubmitForm && claim.status === 'rejected' && (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
            <h4 className="text-white font-medium">Update Claim Information</h4>
            <div>
              <label className="block text-white/60 text-sm mb-1">Member Number</label>
              <input
                type="text"
                value={resubmitData.memberNumber}
                onChange={(e) => setResubmitData({ ...resubmitData, memberNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1">Member Name</label>
              <input
                type="text"
                value={resubmitData.memberName}
                onChange={(e) => setResubmitData({ ...resubmitData, memberName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
            </div>
            <button
              onClick={() => onResubmit(claim.id, resubmitData)}
              className="w-full px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
            >
              Prepare for Resubmission
            </button>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          {claim.status === 'draft' && (
            <div className="flex-1 flex gap-2">
              <button
                onClick={() => onSubmit(claim.id, 'api')}
                disabled={submitBlocked}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 disabled:opacity-50"
                title="Submit via API"
              >
                <Send className="w-4 h-4" />
                {submitBlocked ? 'Blocked' : 'Submit (API)'}
              </button>
              <button
                onClick={() => onSubmit(claim.id, 'edi')}
                disabled={submitBlocked}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 disabled:opacity-50"
                title="Submit via EDI"
              >
                <Upload className="w-4 h-4" />
                EDI
              </button>
            </div>
          )}
          {(claim.status === 'submitted' || claim.status === 'processing') && (
            <button
              onClick={async () => {
                try {
                  const response = await claimsApi.checkClaimStatusEnhanced(tenantSlug, token, claim.id);
                  showSuccess('Status checked successfully', 'success');
                  if (response.data.claim) {
                    // Update local claim data
                    Object.assign(claim, response.data.claim);
                  }
                  loadStatusHistory();
                  onRefresh();
                } catch (error: any) {
                  showError(error.response?.data?.message || 'Failed to check status', 'error');
                }
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Check Status
            </button>
          )}
          {claim.status === 'rejected' && !showResubmitForm && (
            <button
              onClick={() => setShowResubmitForm(true)}
              className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Resubmit
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimsDashboard;
