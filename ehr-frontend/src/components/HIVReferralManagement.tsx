import React, { useState, useEffect } from 'react';
import { X, Plus, CheckCircle, Clock, XCircle, AlertCircle, Calendar, FileText, User, Building } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface HIVReferralManagementProps {
  enrollmentId: string;
  patientName: string;
  tenantSlug: string;
  onClose?: () => void;
}

const HIVReferralManagement: React.FC<HIVReferralManagementProps> = ({
  enrollmentId,
  patientName,
  tenantSlug,
  onClose
}) => {
  const { showSuccess, showError } = useNotification();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  const [form, setForm] = useState({
    referralType: '',
    referralTypeDetails: '',
    referredToFacility: '',
    referredToProvider: '',
    referralReason: '',
    referralPriority: 'normal'
  });
  const [updateForm, setUpdateForm] = useState({
    referralStatus: '',
    outcome: '',
    outcomeNotes: '',
    completedDate: '',
    declinedReason: '',
    cancelledReason: ''
  });

  useEffect(() => {
    loadReferrals();
  }, [enrollmentId]);

  const loadReferrals = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoading(true);
      const response = await ehrApi.getEnrollmentReferrals(enrollmentId, token, tenantSlug);
      setReferrals(response.data.referrals || []);
    } catch (error) {
      console.error('Failed to load referrals:', error);
      showError('Error', 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReferral = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      if (!form.referralType || !form.referralReason) {
        showError('Validation Error', 'Please fill in all required fields');
        return;
      }

      await ehrApi.createReferral({
        enrollmentId,
        referralDate: new Date().toISOString().split('T')[0],
        ...form
      }, token, tenantSlug);

      showSuccess('Success', 'Referral created successfully');
      setShowCreateModal(false);
      setForm({
        referralType: '',
        referralTypeDetails: '',
        referredToFacility: '',
        referredToProvider: '',
        referralReason: '',
        referralPriority: 'normal'
      });
      loadReferrals();
    } catch (error: any) {
      showError('Error', error?.response?.data?.message || 'Failed to create referral');
    }
  };

  const handleUpdateStatus = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !selectedReferral) return;

      await ehrApi.updateReferralStatus(selectedReferral.id, updateForm, token, tenantSlug);

      showSuccess('Success', 'Referral status updated successfully');
      setShowUpdateModal(false);
      setSelectedReferral(null);
      loadReferrals();
    } catch (error: any) {
      showError('Error', error?.response?.data?.message || 'Failed to update referral status');
    }
  };

  const getReferralTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'P': 'PMTCT',
      'T': 'TB',
      'F': 'Family Planning',
      'D': 'Dental',
      'H': 'Hospital',
      'O': 'Other'
    };
    return types[type] || type;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'declined': 'bg-red-100 text-red-800',
      'cancelled': 'bg-slate-100 text-slate-800'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'declined':
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (onClose) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Referral Management - {patientName}</h2>
            <button onClick={onClose} className="text-white hover:text-emerald-100">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {/* Referral Management Content */}
            <ReferralManagementContent
              referrals={referrals}
              loading={loading}
              showCreateModal={showCreateModal}
              setShowCreateModal={setShowCreateModal}
              showUpdateModal={showUpdateModal}
              setShowUpdateModal={setShowUpdateModal}
              selectedReferral={selectedReferral}
              setSelectedReferral={setSelectedReferral}
              form={form}
              setForm={setForm}
              updateForm={updateForm}
              setUpdateForm={setUpdateForm}
              handleCreateReferral={handleCreateReferral}
              handleUpdateStatus={handleUpdateStatus}
              getReferralTypeLabel={getReferralTypeLabel}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              formatDateToDDMMYYYY={formatDateToDDMMYYYY}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReferralManagementContent
        referrals={referrals}
        loading={loading}
        showCreateModal={showCreateModal}
        setShowCreateModal={setShowCreateModal}
        showUpdateModal={showUpdateModal}
        setShowUpdateModal={setShowUpdateModal}
        selectedReferral={selectedReferral}
        setSelectedReferral={setSelectedReferral}
        form={form}
        setForm={setForm}
        updateForm={updateForm}
        setUpdateForm={setUpdateForm}
        handleCreateReferral={handleCreateReferral}
        handleUpdateStatus={handleUpdateStatus}
        getReferralTypeLabel={getReferralTypeLabel}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        formatDateToDDMMYYYY={formatDateToDDMMYYYY}
      />
    </div>
  );
};

interface ReferralManagementContentProps {
  referrals: any[];
  loading: boolean;
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
  showUpdateModal: boolean;
  setShowUpdateModal: (show: boolean) => void;
  selectedReferral: any;
  setSelectedReferral: (ref: any) => void;
  form: any;
  setForm: (form: any) => void;
  updateForm: any;
  setUpdateForm: (form: any) => void;
  handleCreateReferral: () => void;
  handleUpdateStatus: () => void;
  getReferralTypeLabel: (type: string) => string;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  formatDateToDDMMYYYY: (date: string) => string;
}

const ReferralManagementContent: React.FC<ReferralManagementContentProps> = ({
  referrals,
  loading,
  showCreateModal,
  setShowCreateModal,
  showUpdateModal,
  setShowUpdateModal,
  selectedReferral,
  setSelectedReferral,
  form,
  setForm,
  updateForm,
  setUpdateForm,
  handleCreateReferral,
  handleUpdateStatus,
  getReferralTypeLabel,
  getStatusColor,
  getStatusIcon,
  formatDateToDDMMYYYY
}) => {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Referrals</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Referral
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="text-slate-600 mt-2">Loading referrals...</p>
        </div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">No referrals recorded yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {referrals.map((referral) => (
            <div key={referral.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(referral.referral_status)}`}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(referral.referral_status)}
                        {referral.referral_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                      {getReferralTypeLabel(referral.referral_type)}
                    </span>
                    {referral.referral_priority === 'urgent' && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                        URGENT
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-1">
                    {formatDateToDDMMYYYY(referral.referral_date)}
                  </p>
                  <p className="font-semibold text-slate-900 mb-2">{referral.referral_reason}</p>
                  {referral.referred_to_facility && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                      <Building className="w-4 h-4" />
                      {referral.referred_to_facility}
                    </div>
                  )}
                  {referral.referred_to_provider && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User className="w-4 h-4" />
                      {referral.referred_to_provider}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedReferral(referral);
                    setUpdateForm({
                      referralStatus: referral.referral_status,
                      outcome: referral.outcome || '',
                      outcomeNotes: referral.outcome_notes || '',
                      completedDate: referral.completed_date ? formatDateToDDMMYYYY(referral.completed_date) : '',
                      declinedReason: referral.declined_reason || '',
                      cancelledReason: referral.cancelled_reason || ''
                    });
                    setShowUpdateModal(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Update Status
                </button>
              </div>
              {referral.outcome && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-sm text-slate-600">Outcome: <span className="font-semibold">{referral.outcome}</span></p>
                  {referral.outcome_notes && (
                    <p className="text-sm text-slate-600 mt-1">{referral.outcome_notes}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Referral Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 flex items-center justify-between rounded-t-xl">
              <h3 className="text-xl font-bold">Create New Referral</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:text-emerald-100">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Referral Type *
                </label>
                <select
                  value={form.referralType}
                  onChange={(e) => setForm({ ...form, referralType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select type</option>
                  <option value="P">PMTCT</option>
                  <option value="T">TB</option>
                  <option value="F">Family Planning</option>
                  <option value="D">Dental</option>
                  <option value="H">Hospital</option>
                  <option value="O">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Referral Reason *
                </label>
                <textarea
                  value={form.referralReason}
                  onChange={(e) => setForm({ ...form, referralReason: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Describe the reason for referral..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Referred To Facility
                </label>
                <input
                  type="text"
                  value={form.referredToFacility}
                  onChange={(e) => setForm({ ...form, referredToFacility: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Facility name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Referred To Provider
                </label>
                <input
                  type="text"
                  value={form.referredToProvider}
                  onChange={(e) => setForm({ ...form, referredToProvider: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Provider name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Priority
                </label>
                <select
                  value={form.referralPriority}
                  onChange={(e) => setForm({ ...form, referralPriority: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateReferral}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
                >
                  Create Referral
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && selectedReferral && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex items-center justify-between rounded-t-xl">
              <h3 className="text-xl font-bold">Update Referral Status</h3>
              <button onClick={() => setShowUpdateModal(false)} className="text-white hover:text-blue-100">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Status *
                </label>
                <select
                  value={updateForm.referralStatus}
                  onChange={(e) => setUpdateForm({ ...updateForm, referralStatus: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="declined">Declined</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              {updateForm.referralStatus === 'completed' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Completion Date
                    </label>
                    <input
                      type="date"
                      value={updateForm.completedDate}
                      onChange={(e) => setUpdateForm({ ...updateForm, completedDate: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Outcome
                    </label>
                    <input
                      type="text"
                      value={updateForm.outcome}
                      onChange={(e) => setUpdateForm({ ...updateForm, outcome: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Brief outcome summary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Outcome Notes
                    </label>
                    <textarea
                      value={updateForm.outcomeNotes}
                      onChange={(e) => setUpdateForm({ ...updateForm, outcomeNotes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Detailed outcome notes..."
                    />
                  </div>
                </>
              )}
              {updateForm.referralStatus === 'declined' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Decline Reason *
                  </label>
                  <textarea
                    value={updateForm.declinedReason}
                    onChange={(e) => setUpdateForm({ ...updateForm, declinedReason: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Reason for decline..."
                  />
                </div>
              )}
              {updateForm.referralStatus === 'cancelled' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Cancellation Reason *
                  </label>
                  <textarea
                    value={updateForm.cancelledReason}
                    onChange={(e) => setUpdateForm({ ...updateForm, cancelledReason: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Reason for cancellation..."
                  />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateStatus}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  Update Status
                </button>
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HIVReferralManagement;

