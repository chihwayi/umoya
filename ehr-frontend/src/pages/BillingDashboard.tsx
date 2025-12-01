import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DollarSign,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  FileText,
  Calendar,
  Users,
  BarChart3,
  Settings,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ehrApi, billingApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';
import { formatDateForAPI } from '../utils/dateUtils';

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
  trend?: { value: number; label: string };
}> = ({ title, value, icon: Icon, subtitle, accent, trend }) => (
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
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value > 0 ? (
              <TrendingUp className="w-3 h-3 text-white/80" />
            ) : (
              <TrendingDown className="w-3 h-3 text-white/80" />
            )}
            <span className="text-xs text-white/80">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const BillingDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'bills' | 'reports'>('overview');
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    payerType: '',
  });
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [selectedBill, setSelectedBill] = useState<any>(null);

  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  useEffect(() => {
    const stored = localStorage.getItem('ehr_user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

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
      if (activeTab === 'overview') {
        const summaryResponse = await ehrApi.getFinanceSummary(tenantSlug, token);
        setSummary(summaryResponse.data);
      }

      if (activeTab === 'transactions' || activeTab === 'overview') {
        const transactionsResponse = await ehrApi.getFinancialTransactions(tenantSlug, token, {
          status: filters.status || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          payerType: filters.payerType || undefined,
          search: searchTerm || undefined,
          limit: 50,
        });
        setTransactions(transactionsResponse.data.transactions || transactionsResponse.data || []);
      }

      if (activeTab === 'bills') {
        const billsResponse = await billingApi.getBills(tenantSlug, token, {
          status: filters.status || undefined,
          page: 1,
          limit: 50,
        });
        setBills(billsResponse.data.bills || billsResponse.data || []);
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      showError('Failed to load dashboard data', error.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, activeTab, filters, searchTerm]);

  const handleDownloadInvoice = async (transactionId: string) => {
    try {
      const response = await ehrApi.downloadInvoicePdf(tenantSlug!, token, transactionId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${transactionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('Invoice downloaded successfully', 'The invoice has been downloaded successfully.');
    } catch (error: any) {
      showError('Failed to download invoice', error.response?.data?.message || 'Failed to download invoice');
    }
  };

  const handleRecordPayment = async (paymentData: any) => {
    if (!selectedTransaction) return;

    try {
      await ehrApi.recordFinancialPayment(tenantSlug!, token, selectedTransaction.id, paymentData);
      showSuccess('Payment recorded successfully', 'The payment has been recorded successfully.');
      setShowPaymentModal(false);
      setSelectedTransaction(null);
      loadDashboardData();
    } catch (error: any) {
      showError('Failed to record payment', error.response?.data?.message || 'Failed to record payment');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      paid: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Paid' },
      pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Pending' },
      overdue: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Overdue' },
      draft: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Draft' },
      cancelled: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Cancelled' },
    };

    const config = statusConfig[status.toLowerCase()] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${config.color}`}>
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
                <h1 className="text-3xl font-bold text-white">Billing & Finance</h1>
                <p className="text-white/60 mt-1">Manage bills, payments, and financial reports</p>
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
                onClick={() => navigate(`/ehr/${tenantSlug}/claims`)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Claims
              </button>
              <button
                onClick={() => setShowCreateBillModal(true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Bill
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          {(['overview', 'transactions', 'bills', 'reports'] as const).map((tab) => (
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
                title="Total Revenue"
                value={formatCurrency(summary.totals?.totalAmount || 0)}
                icon={DollarSign}
                accent="from-green-500/20 to-emerald-500/20"
              />
              <StatCard
                title="Outstanding"
                value={formatCurrency(summary.totals?.outstandingBalance || 0)}
                icon={AlertCircle}
                accent="from-yellow-500/20 to-orange-500/20"
              />
              <StatCard
                title="Today's Receipts"
                value={formatCurrency(summary.totals?.todayReceipts || 0)}
                icon={TrendingUp}
                accent="from-blue-500/20 to-cyan-500/20"
              />
              <StatCard
                title="Pending Claims"
                value={summary.pendingClaims?.count || 0}
                icon={FileText}
                subtitle={formatCurrency(summary.pendingClaims?.totalSubmitted || 0)}
                accent="from-purple-500/20 to-pink-500/20"
              />
            </div>

            {/* Aging Analysis */}
            {summary.aging && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
                <h3 className="text-xl font-bold text-white mb-4">Accounts Receivable Aging</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Current', value: summary.aging.current || 0 },
                    { label: '0-30 Days', value: summary.aging.bucket_0_30 || 0 },
                    { label: '31-60 Days', value: summary.aging.bucket_31_60 || 0 },
                    { label: '61-90 Days', value: summary.aging.bucket_61_90 || 0 },
                    { label: 'Over 90 Days', value: summary.aging.bucket_over_90 || 0 },
                  ].map((bucket) => (
                    <div key={bucket.label} className="text-center">
                      <p className="text-white/60 text-sm mb-1">{bucket.label}</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(bucket.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Recent Transactions</h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {transactions.slice(0, 10).map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Receipt className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {transaction.first_name} {transaction.last_name}
                        </p>
                        <p className="text-white/60 text-sm">
                          {transaction.source_module} • {transaction.payer_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-white font-bold">{formatCurrency(transaction.amount)}</p>
                        <p className="text-white/60 text-sm">
                          Balance: {formatCurrency(transaction.balance)}
                        </p>
                      </div>
                      {getStatusBadge(transaction.payment_status)}
                      <button
                        onClick={() => handleDownloadInvoice(transaction.id)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <Download className="w-4 h-4 text-white/60" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
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
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
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
                <div>
                  <label className="block text-white/60 text-sm mb-2">Payer Type</label>
                  <select
                    value={filters.payerType}
                    onChange={(e) => setFilters({ ...filters, payerType: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  >
                    <option value="">All Types</option>
                    <option value="self">Self Pay</option>
                    <option value="insurance">Insurance</option>
                    <option value="medical_aid">Medical Aid</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Transactions List */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <div className="space-y-2">
                {transactions.map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Receipt className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {transaction.first_name} {transaction.last_name}
                        </p>
                        <p className="text-white/60 text-sm">
                          {transaction.source_module} • {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-white font-bold">{formatCurrency(transaction.amount)}</p>
                        <p className="text-white/60 text-sm">
                          Balance: {formatCurrency(transaction.balance)}
                        </p>
                      </div>
                      {getStatusBadge(transaction.payment_status)}
                      <div className="flex gap-2">
                        {transaction.balance > 0 && (
                          <button
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setShowPaymentModal(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm"
                          >
                            Pay
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadInvoice(transaction.id)}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <Download className="w-4 h-4 text-white/60" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bills Tab */}
        {activeTab === 'bills' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <div className="space-y-2">
                {bills.map((bill: any) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <FileText className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{bill.billNumber}</p>
                        <p className="text-white/60 text-sm">
                          {bill.patient?.firstName} {bill.patient?.lastName} • {new Date(bill.billDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-white font-bold">{formatCurrency(bill.totalAmount)}</p>
                        <p className="text-white/60 text-sm">
                          Balance: {formatCurrency(bill.balanceAmount)}
                        </p>
                      </div>
                      {getStatusBadge(bill.status)}
                      <button
                        onClick={() => {
                          setSelectedBill(bill);
                          setShowPaymentModal(true);
                        }}
                        className="px-3 py-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm"
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <ReportsTab tenantSlug={tenantSlug!} token={token} />
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <ModalPortal>
          <PaymentModal
            transaction={selectedTransaction}
            bill={selectedBill}
            onPayment={handleRecordPayment}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedTransaction(null);
              setSelectedBill(null);
            }}
          />
        </ModalPortal>
      )}
    </div>
  );
};

const PaymentModal: React.FC<{
  transaction?: any;
  bill?: any;
  onPayment: (data: any) => void;
  onClose: () => void;
}> = ({ transaction, bill, onPayment, onClose }) => {
  const [formData, setFormData] = useState({
    amount: (transaction?.balance || bill?.balanceAmount || 0).toString(),
    paymentMethod: 'cash',
    paymentReference: '',
    gatewayReference: '',
    note: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPayment(formData);
  };

  const amount = transaction?.balance || bill?.balanceAmount || 0;

  return (
    <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
      <h2 className="text-2xl font-bold text-white mb-4">Record Payment</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white/60 text-sm mb-2">Amount</label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            max={amount}
            step="0.01"
            required
          />
        </div>
        <div>
          <label className="block text-white/60 text-sm mb-2">Payment Method</label>
          <select
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            required
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="mobile_money">Mobile Money</option>
          </select>
        </div>
        <div>
          <label className="block text-white/60 text-sm mb-2">Reference Number</label>
          <input
            type="text"
            value={formData.paymentReference}
            onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-white/60 text-sm mb-2">Notes</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            rows={3}
            placeholder="Optional notes"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all"
          >
            Record Payment
          </button>
        </div>
      </form>
    </div>
  );
};

const ReportsTab: React.FC<{ tenantSlug: string; token: string }> = ({ tenantSlug, token }) => {
  const { showError, showSuccess } = useNotification();
  const [reportType, setReportType] = useState<'revenue' | 'profit_loss' | 'cash_flow' | 'aging'>('revenue');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [reportData, setReportData] = useState<any>(null);
  const [taxSummary, setTaxSummary] = useState<any>(null);
  const [reconciliationReport, setReconciliationReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'tax' | 'reconciliation'>('reports');
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedTransactionForReconcile, setSelectedTransactionForReconcile] = useState<any>(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await ehrApi.getFinancialReports(tenantSlug, token, {
        reportType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        groupBy,
      });
      setReportData(response.data);
    } catch (error: any) {
      showError('Failed to load report', error.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const loadTaxSummary = async () => {
    setLoading(true);
    try {
      const response = await ehrApi.getTaxSummary(tenantSlug, token, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setTaxSummary(response.data);
    } catch (error: any) {
      showError('Failed to load tax summary', error.response?.data?.message || 'Failed to load tax summary');
    } finally {
      setLoading(false);
    }
  };

  const loadReconciliationReport = async () => {
    setLoading(true);
    try {
      const response = await ehrApi.getReconciliationReport(tenantSlug, token, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setReconciliationReport(response.data);
    } catch (error: any) {
      showError('Failed to load reconciliation report', error.response?.data?.message || 'Failed to load reconciliation report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'reports') {
      loadReport();
    } else if (activeSubTab === 'tax') {
      loadTaxSummary();
    } else if (activeSubTab === 'reconciliation') {
      loadReconciliationReport();
    }
  }, [activeSubTab, reportType, dateFrom, dateTo, groupBy]);

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['reports', 'tax', 'reconciliation'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-6 py-3 font-medium transition-colors capitalize ${
              activeSubTab === tab
                ? 'text-white border-b-2 border-purple-500'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {tab === 'reconciliation' ? 'Payment Reconciliation' : tab === 'tax' ? 'Tax Management' : 'Financial Reports'}
          </button>
        ))}
      </div>

      {/* Reports Sub-tab */}
      {activeSubTab === 'reports' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-white/60 text-sm mb-2">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="revenue">Revenue Report</option>
                  <option value="profit_loss">Profit & Loss</option>
                  <option value="cash_flow">Cash Flow</option>
                  <option value="aging">Aging Report</option>
                </select>
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-2">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-2">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-2">Group By</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadReport}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Generate Report
              </button>
              {reportData && (
                <>
                  <button
                    onClick={() => {
                      // Export as PDF
                      window.print();
                    }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export PDF
                  </button>
                  <button
                    onClick={() => {
                      // Export as CSV
                      if (reportData) {
                        let csv = '';
                        if (reportType === 'revenue' && reportData.byPeriod) {
                          csv = 'Period,Revenue,Transactions\n';
                          reportData.byPeriod.forEach((item: any) => {
                            csv += `${new Date(item.period).toLocaleDateString()},${item.total_revenue || 0},${item.transaction_count || 0}\n`;
                          });
                        }
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Report Results */}
          {loading && <div className="text-white text-center py-8">Loading...</div>}
          {reportData && !loading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                {reportType === 'revenue' && 'Revenue Report'}
                {reportType === 'profit_loss' && 'Profit & Loss Report'}
                {reportType === 'cash_flow' && 'Cash Flow Report'}
                {reportType === 'aging' && 'Accounts Receivable Aging Report'}
              </h3>

              {reportType === 'revenue' && reportData.summary && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-white/5">
                      <p className="text-white/60 text-sm">Total Revenue</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(reportData.summary.totalRevenue)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/5">
                      <p className="text-white/60 text-sm">Transactions</p>
                      <p className="text-2xl font-bold text-white">{reportData.summary.totalTransactions}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/5">
                      <p className="text-white/60 text-sm">Patients</p>
                      <p className="text-2xl font-bold text-white">{reportData.summary.totalPatients}</p>
                    </div>
                  </div>
                  
                  {/* Revenue Chart */}
                  {reportData.byPeriod && reportData.byPeriod.length > 0 && (
                    <div className="mb-6 p-4 rounded-lg bg-white/5">
                      <h4 className="text-white font-bold mb-4">Revenue Trend</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={reportData.byPeriod.map((item: any) => ({
                          period: new Date(item.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          revenue: Number(item.total_revenue || 0),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="period" stroke="rgba(255,255,255,0.6)" />
                          <YAxis stroke="rgba(255,255,255,0.6)" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: any) => formatCurrency(value)}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Revenue by Module */}
                  {reportData.byModule && reportData.byModule.length > 0 && (
                    <div className="mb-6 p-4 rounded-lg bg-white/5">
                      <h4 className="text-white font-bold mb-4">Revenue by Service Module</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={reportData.byModule.map((item: any) => ({
                          module: item.source_module || 'Other',
                          revenue: Number(item.total_revenue || 0),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="module" stroke="rgba(255,255,255,0.6)" />
                          <YAxis stroke="rgba(255,255,255,0.6)" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: any) => formatCurrency(value)}
                          />
                          <Bar dataKey="revenue" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}

              {reportType === 'profit_loss' && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/30">
                      <p className="text-white/60 text-sm">Total Revenue</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(reportData.revenue?.total || 0)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30">
                      <p className="text-white/60 text-sm">Total Expenses</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(reportData.expenses?.total || 0)}</p>
                      {reportData.expenses?.note && (
                        <p className="text-white/60 text-xs mt-1">{reportData.expenses.note}</p>
                      )}
                    </div>
                    <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/30">
                      <p className="text-white/60 text-sm">Net Profit</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(reportData.profit?.total || 0)}</p>
                      {reportData.profit?.margin && (
                        <p className="text-white/60 text-xs mt-1">Margin: {reportData.profit.margin}%</p>
                      )}
                    </div>
                  </div>

                  {/* P&L Breakdown Chart */}
                  {reportData.revenue?.breakdown && reportData.revenue.breakdown.length > 0 && (
                    <div className="mb-6 p-4 rounded-lg bg-white/5">
                      <h4 className="text-white font-bold mb-4">Revenue Breakdown by Module</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={reportData.revenue.breakdown.map((item: any) => ({
                          module: item.source_module || 'Other',
                          amount: Number(item.amount || 0),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="module" stroke="rgba(255,255,255,0.6)" />
                          <YAxis stroke="rgba(255,255,255,0.6)" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: any) => formatCurrency(value)}
                          />
                          <Bar dataKey="amount" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Profit Visualization */}
                  <div className="p-4 rounded-lg bg-white/5">
                    <h4 className="text-white font-bold mb-4">Profit Visualization</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'Revenue', value: Number(reportData.revenue?.total || 0), fill: '#10b981' },
                        { name: 'Expenses', value: Number(reportData.expenses?.total || 0), fill: '#ef4444' },
                        { name: 'Net Profit', value: Number(reportData.profit?.total || 0), fill: '#3b82f6' },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" />
                        <YAxis stroke="rgba(255,255,255,0.6)" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(value: any) => formatCurrency(value)}
                        />
                        <Bar dataKey="value" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {reportType === 'cash_flow' && reportData.cashFlow && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-white/5">
                      <p className="text-white/60 text-sm">Total Cash Inflow</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(reportData.summary?.totalInflow || 0)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/5">
                      <p className="text-white/60 text-sm">Average Daily Inflow</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(reportData.summary?.averageDailyInflow || 0)}</p>
                    </div>
                  </div>

                  {/* Cash Flow Chart */}
                  {reportData.cashFlow && reportData.cashFlow.length > 0 && (
                    <div className="mb-6 p-4 rounded-lg bg-white/5">
                      <h4 className="text-white font-bold mb-4">Cash Flow Trend</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={reportData.cashFlow.map((item: any) => ({
                          period: new Date(item.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          inflow: Number(item.cash_inflow || 0),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="period" stroke="rgba(255,255,255,0.6)" />
                          <YAxis stroke="rgba(255,255,255,0.6)" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: any) => formatCurrency(value)}
                          />
                          <Line type="monotone" dataKey="inflow" stroke="#3b82f6" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}

              {reportType === 'aging' && reportData.summary && (
                <>
                  <div className="grid grid-cols-5 gap-4 mb-6">
                    {[
                      { label: 'Current', value: reportData.summary.current, color: '#10b981' },
                      { label: '0-30 Days', value: reportData.summary.bucket_0_30, color: '#3b82f6' },
                      { label: '31-60 Days', value: reportData.summary.bucket_31_60, color: '#f59e0b' },
                      { label: '61-90 Days', value: reportData.summary.bucket_61_90, color: '#ef4444' },
                      { label: 'Over 90 Days', value: reportData.summary.bucket_over_90, color: '#dc2626' },
                    ].map((bucket) => (
                      <div key={bucket.label} className="p-4 rounded-lg bg-white/5 border" style={{ borderColor: `${bucket.color}40` }}>
                        <p className="text-white/60 text-sm">{bucket.label}</p>
                        <p className="text-xl font-bold text-white">{formatCurrency(bucket.value)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Aging Chart */}
                  <div className="mb-6 p-4 rounded-lg bg-white/5">
                    <h4 className="text-white font-bold mb-4">Aging Breakdown</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        { bucket: 'Current', amount: Number(reportData.summary.current || 0) },
                        { bucket: '0-30 Days', amount: Number(reportData.summary.bucket_0_30 || 0) },
                        { bucket: '31-60 Days', amount: Number(reportData.summary.bucket_31_60 || 0) },
                        { bucket: '61-90 Days', amount: Number(reportData.summary.bucket_61_90 || 0) },
                        { bucket: 'Over 90 Days', amount: Number(reportData.summary.bucket_over_90 || 0) },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.6)" />
                        <YAxis stroke="rgba(255,255,255,0.6)" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(value: any) => formatCurrency(value)}
                        />
                        <Bar dataKey="amount" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {reportData.byPatient && reportData.byPatient.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-white font-bold mb-2">Top Outstanding Patients</h4>
                      <div className="space-y-2">
                        {reportData.byPatient.slice(0, 10).map((patient: any) => (
                          <div key={patient.patient_id} className="flex justify-between p-3 rounded-lg bg-white/5">
                            <div>
                              <p className="text-white font-medium">
                                {patient.first_name} {patient.last_name}
                              </p>
                              <p className="text-white/60 text-sm">{patient.patient_number}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold">{formatCurrency(patient.total_balance)}</p>
                              <p className="text-white/60 text-sm">{patient.transaction_count} transactions</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tax Management Sub-tab */}
      {activeSubTab === 'tax' && (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-white/60 text-sm mb-2">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-2">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
            </div>
            <button
              onClick={loadTaxSummary}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              Load Tax Summary
            </button>
          </div>

          {loading && <div className="text-white text-center py-8">Loading...</div>}
          {taxSummary && !loading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <h3 className="text-xl font-bold text-white mb-4">Tax Summary</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-white/5">
                  <p className="text-white/60 text-sm">Total Revenue</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(taxSummary.totalRevenue)}</p>
                </div>
                <div className="p-4 rounded-lg bg-white/5">
                  <p className="text-white/60 text-sm">Total Tax (VAT)</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(taxSummary.totalTax)}</p>
                </div>
              </div>
              {taxSummary.taxBreakdown && taxSummary.taxBreakdown.length > 0 && (
                <div>
                  <h4 className="text-white font-bold mb-2">Monthly Tax Breakdown</h4>
                  <div className="space-y-2">
                    {taxSummary.taxBreakdown.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between p-3 rounded-lg bg-white/5">
                        <p className="text-white">
                          {new Date(item.period).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </p>
                        <div className="text-right">
                          <p className="text-white font-bold">{formatCurrency(item.tax_amount)}</p>
                          <p className="text-white/60 text-sm">Revenue: {formatCurrency(item.revenue_amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Sub-tab */}
      {activeSubTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 flex-1 mr-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  />
                </div>
              </div>
              <button
                onClick={loadReconciliationReport}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              >
                Load Reconciliation Report
              </button>
            </div>
            <button
              onClick={() => setShowReconcileModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-fit"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Reconcile Payment
            </button>
          </div>

          {loading && <div className="text-white text-center py-8">Loading...</div>}
          {reconciliationReport && !loading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <h3 className="text-xl font-bold text-white mb-4">Reconciliation Report</h3>
              {reconciliationReport.summary && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-white/5">
                    <p className="text-white/60 text-sm">Total Reconciled</p>
                    <p className="text-2xl font-bold text-white">{reconciliationReport.summary.total_reconciled}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5">
                    <p className="text-white/60 text-sm">Total Amount</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(reconciliationReport.summary.total_amount)}</p>
                  </div>
                </div>
              )}
              {reconciliationReport.reconciled && reconciliationReport.reconciled.length > 0 && (
                <div className="space-y-2">
                  {reconciliationReport.reconciled.map((item: any) => (
                    <div key={item.id} className="flex justify-between p-4 rounded-lg bg-white/5">
                      <div>
                        <p className="text-white font-medium">
                          {item.first_name} {item.last_name}
                        </p>
                        <p className="text-white/60 text-sm">
                          {item.transaction_number} • {new Date(item.reconciliation_date).toLocaleDateString()}
                        </p>
                        {item.bank_reference && (
                          <p className="text-white/60 text-xs">Bank Ref: {item.bank_reference}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{formatCurrency(item.reconciled_amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reconcile Payment Modal */}
      {showReconcileModal && (
        <ModalPortal>
          <ReconcilePaymentModal
            tenantSlug={tenantSlug}
            token={token}
            onSuccess={() => {
              setShowReconcileModal(false);
              loadReconciliationReport();
            }}
            onClose={() => {
              setShowReconcileModal(false);
              setSelectedTransactionForReconcile(null);
            }}
          />
        </ModalPortal>
      )}
    </div>
  );
};

const ReconcilePaymentModal: React.FC<{
  tenantSlug: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}> = ({ tenantSlug, token, onSuccess, onClose }) => {
  const { showError, showSuccess } = useNotification();
  const [formData, setFormData] = useState({
    transactionId: '',
    reconciliationDate: new Date().toISOString().split('T')[0],
    reconciledAmount: '',
    bankReference: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ehrApi.reconcilePayment(tenantSlug, token, {
        transactionId: formData.transactionId,
        reconciliationDate: formData.reconciliationDate,
        reconciledAmount: parseFloat(formData.reconciledAmount),
        bankReference: formData.bankReference || undefined,
        notes: formData.notes || undefined,
      });
      showSuccess('Payment reconciled successfully', 'The payment has been reconciled successfully.');
      onSuccess();
    } catch (error: any) {
      showError('Failed to reconcile payment', error.response?.data?.message || 'Failed to reconcile payment');
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
      <h2 className="text-2xl font-bold text-white mb-4">Reconcile Payment</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white/60 text-sm mb-2">Transaction ID</label>
          <input
            type="text"
            value={formData.transactionId}
            onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-white/60 text-sm mb-2">Reconciliation Date</label>
          <input
            type="date"
            value={formData.reconciliationDate}
            onChange={(e) => setFormData({ ...formData, reconciliationDate: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-white/60 text-sm mb-2">Reconciled Amount</label>
          <input
            type="number"
            step="0.01"
            value={formData.reconciledAmount}
            onChange={(e) => setFormData({ ...formData, reconciledAmount: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-white/60 text-sm mb-2">Bank Reference</label>
          <input
            type="text"
            value={formData.bankReference}
            onChange={(e) => setFormData({ ...formData, bankReference: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-white/60 text-sm mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
            rows={3}
            placeholder="Optional notes"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white transition-all"
          >
            Reconcile
          </button>
        </div>
      </form>
    </div>
  );
};

export default BillingDashboard;

