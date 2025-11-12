import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Shield,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2,
  Download,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';

type FinanceSummary = {
  totals: {
    totalAmount: number;
    totalBalance: number;
    outstandingBalance: number;
    todayReceipts: number;
  };
  moduleBreakdown: any[];
  payerBreakdown: any[];
  statusBreakdown: any[];
  pendingClaims: {
    count: number;
    totalSubmitted: number;
    totalApproved: number;
  };
  aging: {
    current: number;
    bucket_0_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_over_90: number;
  };
  recentPayments: any[];
};

type FinanceTransaction = {
  id: string;
  patient_id: string | null;
  first_name?: string;
  last_name?: string;
  patient_number?: string;
  phone?: string;
  payer_type: string;
  source_module: string | null;
  source_reference_id: string | null;
  amount: string;
  balance: string;
  currency: string;
  payment_status: string;
  due_date: string | null;
  created_at: string;
  claims_summary?: {
    count: number;
    pending: number;
  };
};

type TransactionDetail = {
  transaction: FinanceTransaction;
  lineItems: any[];
  payments: any[];
  claims: any[];
  reconciliationLogs: any[];
};

type PaymentFormState = {
  amount: string;
  paymentMethod: string;
  paymentReference: string;
  gatewayReference: string;
  note: string;
};

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card (POS/EFTPOS)' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'medical_aid', label: 'Medical Aid Remittance' },
  { value: 'write_off', label: 'Write Off / Adjustment' },
];

const moduleColors: Record<string, string> = {
  consultation: 'from-blue-500 to-cyan-500',
  lab: 'from-purple-500 to-indigo-500',
  imaging: 'from-rose-500 to-pink-500',
  oncology: 'from-fuchsia-500 to-purple-500',
  ophthalmology: 'from-sky-500 to-blue-500',
  pharmacy: 'from-teal-500 to-emerald-500',
  default: 'from-slate-500 to-gray-600',
};

const AccountsDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [transactionDetail, setTransactionDetail] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    amount: '',
    paymentMethod: 'cash',
    paymentReference: '',
    gatewayReference: '',
    note: '',
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userChecked, setUserChecked] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);

  const [filters, setFilters] = useState({
    status: '',
    module: '',
    payerType: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const loadSummary = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      setLoadingSummary(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      const { data } = await ehrApi.getFinanceSummary(tenantSlug, token);
      setSummary(data);
    } catch (error: any) {
      console.error('Failed to load finance summary', error);
      showError('Error', error.response?.data?.message || 'Failed to load finance summary');
    } finally {
      setLoadingSummary(false);
    }
  }, [tenantSlug, showError]);

  const loadTransactions = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      setLoadingTransactions(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      const { data } = await ehrApi.getFinancialTransactions(tenantSlug, token, filters);
      setTransactions(data.transactions || []);
      setTransactionTotal(data.total || 0);
    } catch (error: any) {
      console.error('Failed to load financial transactions', error);
      showError('Error', error.response?.data?.message || 'Failed to load financial transactions');
    } finally {
      setLoadingTransactions(false);
    }
  }, [tenantSlug, showError, filters]);

  const loadTransactionDetail = useCallback(
    async (transactionId: string) => {
      if (!tenantSlug) return;
      try {
        setDetailLoading(true);
        const token = localStorage.getItem('ehr_token');
        if (!token) return;
        const { data } = await ehrApi.getFinancialTransactionDetail(tenantSlug, token, transactionId);
        setTransactionDetail(data);
      } catch (error: any) {
        console.error('Failed to load transaction detail', error);
        showError('Error', error.response?.data?.message || 'Failed to load transaction detail');
      } finally {
        setDetailLoading(false);
      }
    },
    [tenantSlug, showError],
  );

  useEffect(() => {
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('ehr_user') : null;
    if (rawUser) {
      try {
        setCurrentUser(JSON.parse(rawUser));
      } catch {
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
    setUserChecked(true);
  }, []);

  useEffect(() => {
    if (!userChecked || !tenantSlug) return;

    if (!currentUser) {
      showError('Session expired', 'Please sign in again to continue.');
      navigate(`/ehr/${tenantSlug}`);
      return;
    }

    if (currentUser.role !== 'accounts') {
      showError('Access denied', 'Your role is not permitted to view the Accounts workspace.');
      navigate(`/ehr/${tenantSlug}/dashboard`);
      return;
    }

    setAccessGranted(true);
  }, [userChecked, currentUser, tenantSlug, navigate, showError]);

  useEffect(() => {
    if (!accessGranted) return;
    loadSummary();
  }, [accessGranted, loadSummary]);

  useEffect(() => {
    if (!accessGranted) return;
    loadTransactions();
  }, [accessGranted, loadTransactions]);

  useEffect(() => {
    if (!accessGranted) {
      setTransactionDetail(null);
      return;
    }

    if (selectedTransactionId) {
      loadTransactionDetail(selectedTransactionId);
    } else {
      setTransactionDetail(null);
    }
  }, [accessGranted, selectedTransactionId, loadTransactionDetail]);

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        title: 'Total Billed',
        value: summary.totals.totalAmount,
        icon: DollarSign,
        gradient: 'from-amber-500 to-orange-500',
      },
      {
        title: 'Outstanding Balance',
        value: summary.totals.outstandingBalance,
        icon: AlertTriangle,
        gradient: 'from-rose-500 to-pink-500',
      },
      {
        title: 'Today\'s Receipts',
        value: summary.totals.todayReceipts,
        icon: CreditCard,
        gradient: 'from-emerald-500 to-teal-500',
      },
      {
        title: 'Pending Medical Aid',
        value: summary.pendingClaims.totalSubmitted,
        icon: Shield,
        gradient: 'from-indigo-500 to-blue-500',
        subLabel: `${summary.pendingClaims.count} claims`,
      },
    ];
  }, [summary]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      module: '',
      payerType: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    });
  };

  const openPaymentModal = () => {
    if (!transactionDetail) return;
    setPaymentForm({
      amount: transactionDetail.transaction.balance?.toString() || '',
      paymentMethod: 'cash',
      paymentReference: '',
      gatewayReference: '',
      note: '',
    });
    setShowPaymentModal(true);
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !selectedTransactionId) return;

    try {
      setPaymentSubmitting(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      await ehrApi.recordFinancialPayment(tenantSlug, token, selectedTransactionId, {
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentReference: paymentForm.paymentReference || undefined,
        gatewayReference: paymentForm.gatewayReference || undefined,
        note: paymentForm.note || undefined,
      });

      showSuccess('Payment Recorded', 'The payment has been captured successfully.');
      setShowPaymentModal(false);
      await Promise.all([loadSummary(), loadTransactions()]);
      await loadTransactionDetail(selectedTransactionId);
    } catch (error: any) {
      console.error('Failed to record payment', error);
      showError('Error', error.response?.data?.message || 'Failed to record payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const renderModuleTag = (module?: string | null) => {
    if (!module) return null;
    const gradient = moduleColors[module] || moduleColors.default;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${gradient}`}>
        <TrendingUp className="w-3 h-3" />
        {module.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>
    );
  };

  const renderPayerTag = (payer: string) => {
    const map: Record<string, string> = {
      self: 'bg-blue-100 text-blue-700',
      medical_aid: 'bg-purple-100 text-purple-700',
      corporate: 'bg-emerald-100 text-emerald-700',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${map[payer] || 'bg-slate-100 text-slate-600'}`}>
        {payer.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-slate-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSummary}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {loadingSummary
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-amber-100 bg-white shadow-sm p-5 flex items-center justify-between">
                    <div className="animate-pulse w-full h-16 bg-slate-100 rounded-xl" />
                  </div>
                ))
              : summaryCards.map((card) => (
                  <div
                    key={card.title}
                    className={`rounded-2xl border border-white/40 bg-gradient-to-br ${card.gradient} shadow-lg p-5 text-white`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white/80">{card.title}</p>
                        <p className="text-3xl font-semibold mt-2">
                          ${card.value.toLocaleString()}
                        </p>
                        {card.subLabel && <p className="text-xs text-white/80 mt-1">{card.subLabel}</p>}
                      </div>
                      <div className="p-3 bg-white/20 rounded-xl">
                        <card.icon className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </section>

        {/* Filters */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search patient or transaction..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
              <div className="relative">
                <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="pl-9 pr-7 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="written_off">Written Off</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Module</label>
              <select
                value={filters.module}
                onChange={(e) => handleFilterChange('module', e.target.value)}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">All Modules</option>
                <option value="consultation">Consultation</option>
                <option value="lab">Laboratory</option>
                <option value="imaging">Radiology</option>
                <option value="oncology">Oncology</option>
                <option value="ophthalmology">Ophthalmology</option>
                <option value="pharmacy">Pharmacy</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Payer Type</label>
              <select
                value={filters.payerType}
                onChange={(e) => handleFilterChange('payerType', e.target.value)}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">All Payers</option>
                <option value="self">Self Pay</option>
                <option value="medical_aid">Medical Aid</option>
                <option value="corporate">Corporate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date From</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date To</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadTransactions}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all"
              >
                <Search className="w-4 h-4" />
                Apply
              </button>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Finance Worklist</h2>
                <p className="text-xs text-slate-500">{transactionTotal} transactions</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-slate-700 transition">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button className="inline-flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-slate-700 transition">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient / Module</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Claims</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loadingTransactions ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                        Loading transactions...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        No transactions matched your filters.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => {
                      const isSelected = transaction.id === selectedTransactionId;
                      const balance = Number(transaction.balance || 0);
                      const amount = Number(transaction.amount || 0);
                      return (
                        <tr
                          key={transaction.id}
                          onClick={() => setSelectedTransactionId(transaction.id)}
                          className={`cursor-pointer transition ${isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-3 text-sm text-slate-700">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold">
                                {transaction.first_name ? `${transaction.first_name} ${transaction.last_name}` : 'Walk-in / External'}
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {transaction.patient_number && (
                                  <span className="text-xs text-slate-500">#{transaction.patient_number}</span>
                                )}
                                {renderModuleTag(transaction.source_module)}
                                {renderPayerTag(transaction.payer_type)}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            ${amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            <span className={`font-semibold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              ${balance.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 capitalize">
                            {transaction.payment_status.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {transaction.due_date ? new Date(transaction.due_date).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {transaction.claims_summary?.pending ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                {transaction.claims_summary.pending} pending
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Transaction Detail</h2>
                <p className="text-xs text-slate-500">
                  {selectedTransactionId ? 'Review financial breakdown' : 'Select a transaction to inspect'}
                </p>
              </div>
              {selectedTransactionId && (
                <button
                  onClick={() => loadTransactionDetail(selectedTransactionId)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-slate-700 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              )}
            </div>
            <div className="p-5 h-[600px] overflow-y-auto">
              {detailLoading && (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading details...
                </div>
              )}

              {!detailLoading && !transactionDetail && (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center px-6">
                  Select a transaction from the worklist to view its financial breakdown, payments, and claims history.
                </div>
              )}

              {!detailLoading && transactionDetail && (
                <div className="space-y-4">
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-slate-700">Transaction Summary</h3>
                      {Number(transactionDetail.transaction.balance || 0) > 0 && (
                        <button
                          onClick={openPaymentModal}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition text-xs font-semibold"
                        >
                          <CreditCard className="w-4 h-4" />
                          Record Payment
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div>
                        <span className="font-medium text-slate-700">Patient:</span>{' '}
                        {transactionDetail.transaction.first_name
                          ? `${transactionDetail.transaction.first_name} ${transactionDetail.transaction.last_name}`
                          : 'Walk-in / External'}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Module:</span>{' '}
                        {transactionDetail.transaction.source_module || '—'}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Total Amount:</span>{' '}
                        ${Number(transactionDetail.transaction.amount || 0).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Outstanding:</span>{' '}
                        ${Number(transactionDetail.transaction.balance || 0).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Status:</span>{' '}
                        {transactionDetail.transaction.payment_status?.replace('_', ' ')}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Due Date:</span>{' '}
                        {transactionDetail.transaction.due_date
                          ? new Date(transactionDetail.transaction.due_date).toLocaleDateString()
                          : '—'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Line Items</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {transactionDetail.lineItems.length === 0 ? (
                        <div className="text-sm text-slate-400 px-4 py-6 text-center">No line items recorded.</div>
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold">Description</th>
                              <th className="px-4 py-2 text-right font-semibold">Qty</th>
                              <th className="px-4 py-2 text-right font-semibold">Unit Price</th>
                              <th className="px-4 py-2 text-right font-semibold">Discount</th>
                              <th className="px-4 py-2 text-right font-semibold">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {transactionDetail.lineItems.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-2 text-slate-700">
                                  {item.description}
                                  {item.billing_code && (
                                    <span className="block text-xs text-slate-400">Code: {item.billing_code}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right text-slate-600">{Number(item.quantity || 0)}</td>
                                <td className="px-4 py-2 text-right text-slate-600">${Number(item.unit_price || 0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-right text-slate-600">${Number(item.discount || 0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-right text-slate-700 font-medium">${Number(item.total || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Payments</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {transactionDetail.payments.length === 0 ? (
                        <div className="text-sm text-slate-400 px-4 py-6 text-center">No payments recorded yet.</div>
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold">Date</th>
                              <th className="px-4 py-2 text-left font-semibold">Method</th>
                              <th className="px-4 py-2 text-left font-semibold">Reference</th>
                              <th className="px-4 py-2 text-right font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {transactionDetail.payments.map((payment) => (
                              <tr key={payment.id}>
                                <td className="px-4 py-2 text-slate-600">
                                  {new Date(payment.received_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-slate-600 capitalize">{payment.payment_method.replace('_', ' ')}</td>
                                <td className="px-4 py-2 text-slate-600">{payment.payment_reference || '—'}</td>
                                <td className="px-4 py-2 text-right text-slate-700 font-medium">
                                  ${Number(payment.amount || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Medical Aid Claims</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {transactionDetail.claims.length === 0 ? (
                        <div className="text-sm text-slate-400 px-4 py-6 text-center">No claims submitted.</div>
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold">Claim #</th>
                              <th className="px-4 py-2 text-left font-semibold">Payer</th>
                              <th className="px-4 py-2 text-left font-semibold">Status</th>
                              <th className="px-4 py-2 text-right font-semibold">Submitted</th>
                              <th className="px-4 py-2 text-right font-semibold">Approved</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {transactionDetail.claims.map((claim) => (
                              <tr key={claim.id}>
                                <td className="px-4 py-2 text-slate-600">{claim.claim_number || '—'}</td>
                                <td className="px-4 py-2 text-slate-600">{claim.payer_name || '—'}</td>
                                <td className="px-4 py-2 text-slate-600 capitalize">{claim.status}</td>
                                <td className="px-4 py-2 text-right text-slate-600">${Number(claim.amount_submitted || 0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-right text-slate-600">${Number(claim.amount_approved || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Reconciliation Logs</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {transactionDetail.reconciliationLogs.length === 0 ? (
                        <div className="text-sm text-slate-400 px-4 py-6 text-center">No reconciliation entries.</div>
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold">Date</th>
                              <th className="px-4 py-2 text-left font-semibold">Reference</th>
                              <th className="px-4 py-2 text-left font-semibold">Status</th>
                              <th className="px-4 py-2 text-right font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {transactionDetail.reconciliationLogs.map((log) => (
                              <tr key={log.id}>
                                <td className="px-4 py-2 text-slate-600">
                                  {new Date(log.reconciliation_date).toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-slate-600">{log.payment_reference || '—'}</td>
                                <td className="px-4 py-2 text-slate-600 capitalize">{log.status}</td>
                                <td className="px-4 py-2 text-right text-slate-600">${Number(log.amount || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && transactionDetail && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800">Record Payment</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={submitPayment} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Reference</label>
                  <input
                    type="text"
                    value={paymentForm.paymentReference}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentReference: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="POS receipt, mobile money code, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gateway Reference</label>
                  <input
                    type="text"
                    value={paymentForm.gatewayReference}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, gatewayReference: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="Stripe/Telco reference (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                  <textarea
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="Optional note for audit trail..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paymentSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-60"
                  >
                    {paymentSubmitting ? (
                      <span className="flex items-center gap-2 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" /> Recording...
                      </span>
                    ) : (
                      'Record Payment'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default AccountsDashboard;

