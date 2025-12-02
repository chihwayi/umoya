import React, { useState, useEffect } from 'react';
import { X, Building2, User, Calendar, FileText, CheckCircle, Send, Ban, Clock } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ConfirmDialog from './ConfirmDialog';

interface ReferralViewerProps {
  referralId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onUpdate: () => void;
}

const ReferralViewer: React.FC<ReferralViewerProps> = ({
  referralId,
  tenantSlug,
  token,
  onClose,
  onUpdate,
}) => {
  const [referral, setReferral] = useState<any>(null);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadReferral();
    loadStatusHistory();
  }, [referralId]);

  const loadReferral = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getReferralById(referralId, token, tenantSlug);
      setReferral(response.data);
    } catch (error: any) {
      showError('Error', 'Failed to load referral details');
    } finally {
      setLoading(false);
    }
  };

  const loadStatusHistory = async () => {
    try {
      const response = await ehrApi.getReferralStatusHistory(referralId, token, tenantSlug);
      setStatusHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load status history:', error);
    }
  };

  const handleSend = async () => {
    try {
      setActionLoading(true);
      await ehrApi.sendReferral(referralId, 'email', token, tenantSlug);
      showSuccess('Success', 'Referral sent successfully');
      loadReferral();
      loadStatusHistory();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to send referral');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setActionLoading(true);
      await ehrApi.completeReferral(referralId, { outcomeSummary: outcomeNotes }, token, tenantSlug);
      showSuccess('Success', 'Referral marked as completed');
      setShowCompleteDialog(false);
      setOutcomeNotes('');
      loadReferral();
      loadStatusHistory();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to complete referral');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason) {
      showError('Validation Error', 'Please provide a cancellation reason');
      return;
    }

    try {
      setActionLoading(true);
      await ehrApi.cancelReferral(referralId, cancelReason, token, tenantSlug);
      showSuccess('Success', 'Referral cancelled');
      setShowCancelDialog(false);
      setCancelReason('');
      loadReferral();
      loadStatusHistory();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to cancel referral');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      acknowledged: 'bg-cyan-100 text-cyan-800',
      scheduled: 'bg-purple-100 text-purple-800',
      in_progress: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rejected: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading || !referral) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Referral Details</h2>
              <p className="text-blue-100 text-sm mt-1">
                {referral.patient_first_name} {referral.patient_last_name}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Status & Actions */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(referral.status)}`}>
                {referral.status}
              </span>
              <span className="text-sm text-slate-600">Priority: {referral.priority}</span>
            </div>
            <div className="flex gap-2">
              {referral.status === 'draft' || referral.status === 'pending' ? (
                <button
                  onClick={handleSend}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Send Referral
                </button>
              ) : null}
              {referral.status !== 'completed' && referral.status !== 'cancelled' ? (
                <>
                  <button
                    onClick={() => setShowCompleteDialog(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete
                  </button>
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* Referral Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Referred To */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800">Referred To</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800">{referral.referred_to_facility_name}</p>
                {referral.referred_to_facility_address && <p className="text-slate-600">{referral.referred_to_facility_address}</p>}
                {referral.referred_to_facility_phone && <p className="text-slate-600">Phone: {referral.referred_to_facility_phone}</p>}
                {referral.referred_to_facility_email && <p className="text-slate-600">Email: {referral.referred_to_facility_email}</p>}
              </div>
            </div>

            {/* Referring Provider */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Referring Provider</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800">
                  Dr. {referral.referring_provider_first_name} {referral.referring_provider_last_name}
                </p>
                {referral.referring_facility_name && <p className="text-slate-600">{referral.referring_facility_name}</p>}
              </div>
            </div>
          </div>

          {/* Referral Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Type:</span>
                <p className="font-medium text-slate-800">{referral.referral_type}</p>
              </div>
              {referral.specialty && (
                <div>
                  <span className="text-slate-500">Specialty:</span>
                  <p className="font-medium text-slate-800">{referral.specialty}</p>
                </div>
              )}
              <div>
                <span className="text-slate-500">Referral Date:</span>
                <p className="font-medium text-slate-800">{formatDate(referral.referral_date)}</p>
              </div>
              {referral.requested_appointment_date && (
                <div>
                  <span className="text-slate-500">Requested Date:</span>
                  <p className="font-medium text-slate-800">{formatDate(referral.requested_appointment_date)}</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Reason for Referral</h4>
              <p className="text-slate-700 bg-slate-50 rounded-lg p-3">{referral.reason}</p>
            </div>

            {referral.clinical_summary && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Clinical Summary</h4>
                <p className="text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{referral.clinical_summary}</p>
              </div>
            )}

            {referral.requested_services && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Requested Services</h4>
                <p className="text-slate-700 bg-slate-50 rounded-lg p-3">{referral.requested_services}</p>
              </div>
            )}

            {(referral.relevant_history || referral.current_medications || referral.allergies) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {referral.relevant_history && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2 text-sm">Relevant History</h4>
                    <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{referral.relevant_history}</p>
                  </div>
                )}
                {referral.current_medications && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2 text-sm">Current Medications</h4>
                    <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{referral.current_medications}</p>
                  </div>
                )}
                {referral.allergies && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2 text-sm">Allergies</h4>
                    <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{referral.allergies}</p>
                  </div>
                )}
              </div>
            )}

            {referral.outcome_summary && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Outcome Summary</h4>
                <p className="text-slate-700 bg-green-50 border border-green-200 rounded-lg p-3">{referral.outcome_summary}</p>
              </div>
            )}
          </div>

          {/* Status History */}
          {statusHistory.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Status History
              </h4>
              <div className="space-y-2">
                {statusHistory.map((history, index) => (
                  <div key={index} className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(history.new_status)}`}>
                          {history.new_status}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(history.change_date).toLocaleString()}
                        </span>
                      </div>
                      {history.notes && <p className="text-sm text-slate-600">{history.notes}</p>}
                      {history.first_name && (
                        <p className="text-xs text-slate-500 mt-1">
                          By: {history.first_name} {history.last_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cancel Dialog */}
        {showCancelDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Cancel Referral</h3>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason for cancellation..."
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading || !cancelReason}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Cancel Referral
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Dialog */}
        {showCompleteDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Complete Referral</h3>
              <textarea
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder="Provide outcome summary (optional)..."
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteDialog(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralViewer;


import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ConfirmDialog from './ConfirmDialog';

interface ReferralViewerProps {
  referralId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onUpdate: () => void;
}

const ReferralViewer: React.FC<ReferralViewerProps> = ({
  referralId,
  tenantSlug,
  token,
  onClose,
  onUpdate,
}) => {
  const [referral, setReferral] = useState<any>(null);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadReferral();
    loadStatusHistory();
  }, [referralId]);

  const loadReferral = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getReferralById(referralId, token, tenantSlug);
      setReferral(response.data);
    } catch (error: any) {
      showError('Error', 'Failed to load referral details');
    } finally {
      setLoading(false);
    }
  };

  const loadStatusHistory = async () => {
    try {
      const response = await ehrApi.getReferralStatusHistory(referralId, token, tenantSlug);
      setStatusHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load status history:', error);
    }
  };

  const handleSend = async () => {
    try {
      setActionLoading(true);
      await ehrApi.sendReferral(referralId, 'email', token, tenantSlug);
      showSuccess('Success', 'Referral sent successfully');
      loadReferral();
      loadStatusHistory();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to send referral');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setActionLoading(true);
      await ehrApi.completeReferral(referralId, { outcomeSummary: outcomeNotes }, token, tenantSlug);
      showSuccess('Success', 'Referral marked as completed');
      setShowCompleteDialog(false);
      setOutcomeNotes('');
      loadReferral();
      loadStatusHistory();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to complete referral');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason) {
      showError('Validation Error', 'Please provide a cancellation reason');
      return;
    }

    try {
      setActionLoading(true);
      await ehrApi.cancelReferral(referralId, cancelReason, token, tenantSlug);
      showSuccess('Success', 'Referral cancelled');
      setShowCancelDialog(false);
      setCancelReason('');
      loadReferral();
      loadStatusHistory();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to cancel referral');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      acknowledged: 'bg-cyan-100 text-cyan-800',
      scheduled: 'bg-purple-100 text-purple-800',
      in_progress: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rejected: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading || !referral) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Referral Details</h2>
              <p className="text-blue-100 text-sm mt-1">
                {referral.patient_first_name} {referral.patient_last_name}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Status & Actions */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(referral.status)}`}>
                {referral.status}
              </span>
              <span className="text-sm text-slate-600">Priority: {referral.priority}</span>
            </div>
            <div className="flex gap-2">
              {referral.status === 'draft' || referral.status === 'pending' ? (
                <button
                  onClick={handleSend}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Send Referral
                </button>
              ) : null}
              {referral.status !== 'completed' && referral.status !== 'cancelled' ? (
                <>
                  <button
                    onClick={() => setShowCompleteDialog(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete
                  </button>
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* Referral Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Referred To */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800">Referred To</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800">{referral.referred_to_facility_name}</p>
                {referral.referred_to_facility_address && <p className="text-slate-600">{referral.referred_to_facility_address}</p>}
                {referral.referred_to_facility_phone && <p className="text-slate-600">Phone: {referral.referred_to_facility_phone}</p>}
                {referral.referred_to_facility_email && <p className="text-slate-600">Email: {referral.referred_to_facility_email}</p>}
              </div>
            </div>

            {/* Referring Provider */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Referring Provider</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800">
                  Dr. {referral.referring_provider_first_name} {referral.referring_provider_last_name}
                </p>
                {referral.referring_facility_name && <p className="text-slate-600">{referral.referring_facility_name}</p>}
              </div>
            </div>
          </div>

          {/* Referral Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Type:</span>
                <p className="font-medium text-slate-800">{referral.referral_type}</p>
              </div>
              {referral.specialty && (
                <div>
                  <span className="text-slate-500">Specialty:</span>
                  <p className="font-medium text-slate-800">{referral.specialty}</p>
                </div>
              )}
              <div>
                <span className="text-slate-500">Referral Date:</span>
                <p className="font-medium text-slate-800">{formatDate(referral.referral_date)}</p>
              </div>
              {referral.requested_appointment_date && (
                <div>
                  <span className="text-slate-500">Requested Date:</span>
                  <p className="font-medium text-slate-800">{formatDate(referral.requested_appointment_date)}</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Reason for Referral</h4>
              <p className="text-slate-700 bg-slate-50 rounded-lg p-3">{referral.reason}</p>
            </div>

            {referral.clinical_summary && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Clinical Summary</h4>
                <p className="text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{referral.clinical_summary}</p>
              </div>
            )}

            {referral.requested_services && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Requested Services</h4>
                <p className="text-slate-700 bg-slate-50 rounded-lg p-3">{referral.requested_services}</p>
              </div>
            )}

            {(referral.relevant_history || referral.current_medications || referral.allergies) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {referral.relevant_history && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2 text-sm">Relevant History</h4>
                    <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{referral.relevant_history}</p>
                  </div>
                )}
                {referral.current_medications && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2 text-sm">Current Medications</h4>
                    <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{referral.current_medications}</p>
                  </div>
                )}
                {referral.allergies && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2 text-sm">Allergies</h4>
                    <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{referral.allergies}</p>
                  </div>
                )}
              </div>
            )}

            {referral.outcome_summary && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Outcome Summary</h4>
                <p className="text-slate-700 bg-green-50 border border-green-200 rounded-lg p-3">{referral.outcome_summary}</p>
              </div>
            )}
          </div>

          {/* Status History */}
          {statusHistory.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Status History
              </h4>
              <div className="space-y-2">
                {statusHistory.map((history, index) => (
                  <div key={index} className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(history.new_status)}`}>
                          {history.new_status}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(history.change_date).toLocaleString()}
                        </span>
                      </div>
                      {history.notes && <p className="text-sm text-slate-600">{history.notes}</p>}
                      {history.first_name && (
                        <p className="text-xs text-slate-500 mt-1">
                          By: {history.first_name} {history.last_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cancel Dialog */}
        {showCancelDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Cancel Referral</h3>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason for cancellation..."
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading || !cancelReason}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Cancel Referral
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Dialog */}
        {showCompleteDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Complete Referral</h3>
              <textarea
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder="Provide outcome summary (optional)..."
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteDialog(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralViewer;

