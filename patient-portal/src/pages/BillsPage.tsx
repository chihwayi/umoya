import React, { useState, useEffect, useCallback } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { CreditCard, Calendar, ArrowLeft, AlertCircle, CheckCircle, DollarSign, Filter, Download, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const BillsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [bills, setBills] = useState<any[]>([]);
  const [billQuotes, setBillQuotes] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadBillQuotes = useCallback(async (billRows: any[]) => {
    const quoteEligibleStatuses = new Set(['pending', 'sent', 'overdue', 'paid']);
    const eligibleBills = billRows.filter((bill) => quoteEligibleStatuses.has(String(bill?.status || '').toLowerCase()));

    if (!eligibleBills.length) {
      setBillQuotes({});
      return;
    }

    const quoteResults = await Promise.allSettled(
      eligibleBills.map(async (bill) => [
        bill.id,
        await patientPortalApi.getBillQuote(String(bill.id), token!, tenantSlug),
      ] as const),
    );

    const nextQuotes: Record<string, any> = {};
    quoteResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const [billId, quote] = result.value;
        nextQuotes[billId] = quote;
      }
    });
    setBillQuotes(nextQuotes);
  }, [tenantSlug, token]);

  const loadBills = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Loading bills...', { tenantSlug, statusFilter });
      const data = await patientPortalApi.getBills(token!, tenantSlug, { status: statusFilter !== 'all' ? statusFilter : undefined });
      console.log('Bills response:', data, 'Type:', Array.isArray(data) ? 'array' : typeof data, 'Length:', Array.isArray(data) ? data.length : 'N/A');
      const nextBills = Array.isArray(data) ? data : [];
      setBills(nextBills);
      await loadBillQuotes(nextBills);
    } catch (err: any) {
      console.error('Error loading bills:', err);
      setError(err.message || 'Failed to load bills');
      setBillQuotes({});
    } finally {
      setLoading(false);
    }
  }, [loadBillQuotes, statusFilter, tenantSlug, token]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
      case 'sent':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'paid' || !dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const totalPending = bills.filter(b => b.status === 'pending' || b.status === 'sent').reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

  const formatMoney = (value: any) => `$${parseFloat(value || 0).toFixed(2)}`;

  const getQuoteTone = (quoteStatus: string) => {
    switch (String(quoteStatus || '').toLowerCase()) {
      case 'verified_quote':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case 'blocked_quote':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'self_pay':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'settled':
        return 'bg-green-50 border-green-200 text-green-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your bills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bills & Payments</h1>
              <p className="text-sm text-gray-600">View and manage your medical bills</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Card */}
        {totalPending > 0 && (
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl shadow-xl p-6 mb-6 text-white transform hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm mb-1">Total Pending</p>
                <p className="text-3xl font-bold">${totalPending.toFixed(2)}</p>
              </div>
              <DollarSign className="w-12 h-12 opacity-75" />
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-6 border border-white/20">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all bg-white/50 backdrop-blur-sm appearance-none cursor-pointer px-4"
            >
              <option value="all">All Bills</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {bills.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full mb-6 shadow-lg">
              <CreditCard className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Bills</h3>
            <p className="text-gray-600">You don't have any bills at this time.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all transform hover:scale-[1.01] ${
                  isOverdue(bill.dueDate, bill.status) ? 'ring-2 ring-red-400' : ''
                }`}
              >
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Receipt className="w-8 h-8 text-white" />
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-xl font-bold text-gray-900">
                            Bill #{bill.billNumber}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(bill.status)}`}>
                            {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                          </span>
                          {isOverdue(bill.dueDate, bill.status) && (
                            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold border border-red-200 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Overdue
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(new Date(bill.billDate), 'MMM d, yyyy')}
                              {bill.dueDate && ` • Due: ${format(new Date(bill.dueDate), 'MMM d, yyyy')}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {bill.items && bill.items.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Items:</h4>
                        <div className="space-y-2">
                          {bill.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{item.description || item.code || `Item ${idx + 1}`}</span>
                              <span className="font-semibold text-gray-900">
                                ${(item.totalPrice || item.unitPrice || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                        <p className="text-3xl font-bold text-gray-900">
                          ${parseFloat(bill.totalAmount || 0).toFixed(2)}
                        </p>
                        {bill.subtotal && (
                          <div className="mt-2 text-xs text-gray-500">
                            <span>Subtotal: ${parseFloat(bill.subtotal || 0).toFixed(2)}</span>
                            {bill.taxAmount && <span> • Tax: ${parseFloat(bill.taxAmount || 0).toFixed(2)}</span>}
                            {bill.discountAmount && <span> • Discount: ${parseFloat(bill.discountAmount || 0).toFixed(2)}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-2 border border-gray-200">
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                        {(bill.status === 'pending' || bill.status === 'sent') && (
                          <button className="px-6 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-xl font-semibold hover:from-yellow-700 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg">
                            Pay Now
                          </button>
                        )}
                        {bill.status === 'paid' && (
                          <div className="px-4 py-2 bg-green-100 text-green-800 rounded-xl flex items-center gap-2 border border-green-200">
                            <CheckCircle className="w-4 h-4" />
                            <span>Paid</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {billQuotes[bill.id] && (
                      <div className={`mt-4 rounded-xl border p-4 ${getQuoteTone(billQuotes[bill.id].quoteStatus)}`}>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Payment Guidance</p>
                              <p className="text-sm font-semibold">
                                {billQuotes[bill.id].recommendedNextStep || 'Review your quote before paying this bill.'}
                              </p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border border-current/20">
                              {String(billQuotes[bill.id].quoteStatus || 'estimate_only').replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="opacity-70">Estimated patient responsibility</p>
                              <p className="font-bold">{formatMoney(billQuotes[bill.id].estimatedPatientResponsibility)}</p>
                            </div>
                            <div>
                              <p className="opacity-70">Estimated payer amount</p>
                              <p className="font-bold">{formatMoney(billQuotes[bill.id].estimatedPayerAmount)}</p>
                            </div>
                            <div>
                              <p className="opacity-70">Confidence</p>
                              <p className="font-bold capitalize">{String(billQuotes[bill.id].quoteConfidence || 'medium').replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                          {Array.isArray(billQuotes[bill.id].blockers) && billQuotes[bill.id].blockers.length > 0 && (
                            <div className="rounded-lg bg-white/70 p-3 text-sm">
                              <p className="font-semibold mb-2">Action blockers</p>
                              <ul className="space-y-1">
                                {billQuotes[bill.id].blockers.map((blocker: any, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{blocker?.message || blocker?.code || 'Coverage confirmation is still pending.'}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {bill.notes && (
                      <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Notes:</p>
                        <p className="text-xs text-blue-800">{bill.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default BillsPage;
