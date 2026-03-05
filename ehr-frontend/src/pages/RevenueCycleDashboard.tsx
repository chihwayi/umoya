import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle, Loader2, ArrowLeft, Plus, FileText, Clock } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';
import AddChargeModal from '../components/AddChargeModal';
import ChargeReviewModal from '../components/ChargeReviewModal';

const RevenueCycleDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
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
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'master' | 'pending'>('pending');

  const loadPendingCharges = useCallback(async () => {
    try {
      const response = await ehrAxios.get('/revenue-cycle/charges/pending-review', {
        params: { doctorId: user?.id },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      const charges = response.data.charges || response.data || [];
      setPendingCharges(charges);
    } catch (error) {
      // Silent fail
    }
  }, [tenantSlug, token, user?.id]);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading revenue cycle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Charges Pending Review
              </h2>
              <button
                onClick={() => setShowReviewModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Review All
              </button>
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
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span><strong>Code:</strong> {charge.chargeCode}</span>
                          <span><strong>Date:</strong> {new Date(charge.serviceDate).toLocaleDateString()}</span>
                          <span><strong>Qty:</strong> {charge.quantity}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          ${parseFloat(charge.totalCharge || charge.unitPrice * charge.quantity).toFixed(2)}
                        </p>
                        {charge.patient && (
                          <p className="text-xs text-slate-500 mt-1">
                            {charge.patient.firstName} {charge.patient.lastName}
                          </p>
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
