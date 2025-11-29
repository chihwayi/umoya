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
} from 'lucide-react';
import { claimsApi, billingApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';

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
  const [bills, setBills] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'claims' | 'create' | 'analytics'>('overview');
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

  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

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
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      showError(error.response?.data?.message || 'Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, activeTab, filters, searchTerm]);

  const handleSubmitClaim = async (claimId: string) => {
    try {
      await claimsApi.submitClaim(tenantSlug!, token, claimId);
      showSuccess('Claim submitted successfully', 'success');
      loadDashboardData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to submit claim', 'error');
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
        <div className="flex gap-2 mb-6 border-b border-white/10">
          {(['overview', 'claims', 'create', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'text-white border-b-2 border-purple-500'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
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
              <div className="space-y-2">
                {claims.map((claim: any) => (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
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
                      </div>
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
                        {claim.status === 'draft' && (
                          <button
                            onClick={() => handleSubmitClaim(claim.id)}
                            className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm"
                          >
                            Submit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
          />
        </ModalPortal>
      )}
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
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [formData, setFormData] = useState({
    medicalAidProvider: '',
    memberNumber: '',
    memberName: '',
  });
  const [loading, setLoading] = useState(false);

  const handleCreateClaim = async () => {
    if (!selectedBill) {
      showError('Please select a bill', 'error');
      return;
    }

    if (!formData.medicalAidProvider || !formData.memberNumber) {
      showError('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      await claimsApi.generateClaimFromBill(tenantSlug, token, selectedBill.id, formData);
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
        <h3 className="text-xl font-bold text-white mb-4">Create Claim from Bill</h3>
        
        {/* Bill Selection */}
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

        {/* Claim Details */}
        {selectedBill && (
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
  onSubmit: (id: string) => void;
  onResubmit: (id: string, data: any) => void;
  tenantSlug: string;
  token: string;
}> = ({ claim, onClose, onSubmit, onResubmit }) => {
  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [resubmitData, setResubmitData] = useState({
    memberNumber: claim.memberNumber || '',
    memberName: claim.memberName || '',
    claimAmount: claim.claimAmount || '',
  });

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
            <button
              onClick={() => onSubmit(claim.id)}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Claim
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

