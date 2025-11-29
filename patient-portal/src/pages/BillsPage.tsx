import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { CreditCard, Calendar, ArrowLeft, AlertCircle, CheckCircle, Clock, DollarSign, FileText, Filter, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const BillsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadBills();
  }, [statusFilter]);

  const loadBills = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getBills(token!, tenantSlug, { status: statusFilter !== 'all' ? statusFilter : undefined });
      setBills(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your bills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Bills & Payments</h1>
          <p className="text-gray-600">View and manage your medical bills</p>
        </div>

        {/* Summary Card */}
        {totalPending > 0 && (
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl shadow-xl p-6 mb-6 text-white">
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
              className="flex-1 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm appearance-none cursor-pointer px-4"
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
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3">
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
          <div className="space-y-4">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all ${
                  isOverdue(bill.dueDate, bill.status) ? 'ring-2 ring-red-400' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <CreditCard className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
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
                              <span className="text-gray-700">{item.description || item.code}</span>
                              <span className="font-semibold text-gray-900">
                                ${(item.totalPrice || item.unitPrice || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ${parseFloat(bill.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-2 border border-gray-200">
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                        {(bill.status === 'pending' || bill.status === 'sent') && (
                          <button className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BillsPage;

