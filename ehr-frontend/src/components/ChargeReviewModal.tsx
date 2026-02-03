import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Eye, DollarSign, Calendar, User, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrAxios } from '../services/api';

interface ChargeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId?: string;
  admissionId?: string;
  tenantSlug: string;
}

const ChargeReviewModal: React.FC<ChargeReviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  admissionId,
  tenantSlug,
}) => {
  const { showSuccess, showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const [loading, setLoading] = useState(false);
  const [charges, setCharges] = useState<any[]>([]);
  const [selectedCharge, setSelectedCharge] = useState<any>(null);
  const [actionType, setActionType] = useState<'review' | 'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCharges();
    }
  }, [isOpen, patientId, admissionId]);

  const loadCharges = async () => {
    try {
      setLoading(true);
      let response;
      if (admissionId) {
        response = await ehrAxios.get(`/revenue-cycle/charges/review/admission/${admissionId}`, {
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        });
      } else if (patientId) {
        response = await ehrAxios.get(`/revenue-cycle/charges/patient/${patientId}`, {
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        });
      } else {
        // Get pending charges for current doctor
        response = await ehrAxios.get('/revenue-cycle/charges/pending-review', {
          params: { doctorId: currentUser.id },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        });
        if (response.data.charges) {
          setCharges(response.data.charges);
        } else {
          setCharges(response.data || []);
        }
        setLoading(false);
        return;
      }
      setCharges(response.data || []);
    } catch (error) {
      showError('Error', 'Failed to load charges');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (charge: any, action: 'review' | 'approve' | 'reject') => {
    setSelectedCharge(charge);
    setActionType(action);
    setNotes('');
    setRejectionReason('');
  };

  const confirmAction = async () => {
    if (!selectedCharge || !actionType) return;

    if (actionType === 'reject' && !rejectionReason.trim()) {
      showError('Validation Error', 'Please provide a reason for rejection');
      return;
    }

    try {
      setLoading(true);
      let endpoint = '';
      let payload: any = {};

      switch (actionType) {
        case 'review':
          endpoint = `/revenue-cycle/charges/${selectedCharge.id}/mark-reviewed`;
          payload = { notes: notes || null };
          break;
        case 'approve':
          endpoint = `/revenue-cycle/charges/${selectedCharge.id}/approve`;
          payload = { notes: notes || null };
          break;
        case 'reject':
          endpoint = `/revenue-cycle/charges/${selectedCharge.id}/reject`;
          payload = { reason: rejectionReason };
          break;
      }

      await ehrAxios.put(endpoint, payload, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', `Charge ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'reviewed'} successfully`);
      setSelectedCharge(null);
      setActionType(null);
      setNotes('');
      setRejectionReason('');
      loadCharges();
      onSuccess();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || `Failed to ${actionType} charge`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (!admissionId) {
      showError('Error', 'Bulk approval is only available for admissions');
      return;
    }

    if (!window.confirm('Are you sure you want to approve all pending charges for this admission?')) {
      return;
    }

    try {
      setLoading(true);
      await ehrAxios.put(`/revenue-cycle/charges/admission/${admissionId}/approve-all`, {
        notes: notes || null,
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'All charges approved successfully');
      loadCharges();
      onSuccess();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to approve charges');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'billed':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const pendingCharges = charges.filter((c) => c.chargeStatus === 'pending' || c.chargeStatus === 'reviewed');
  const totalPending = pendingCharges.reduce((sum, c) => sum + parseFloat(c.totalCharge || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-green-600" />
                Review & Approve Charges
              </h2>
              <p className="text-slate-600 mt-1">
                {admissionId ? 'Admission Charges' : patientId ? 'Patient Charges' : 'Pending Charges for Review'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Summary */}
          {pendingCharges.length > 0 && (
            <div className="mt-4 flex items-center gap-4">
              <div className="bg-white rounded-lg px-4 py-2 border border-slate-200">
                <p className="text-sm text-slate-600">Pending Charges</p>
                <p className="text-xl font-bold text-yellow-600">{pendingCharges.length}</p>
              </div>
              <div className="bg-white rounded-lg px-4 py-2 border border-slate-200">
                <p className="text-sm text-slate-600">Total Amount</p>
                <p className="text-xl font-bold text-green-600">${totalPending.toFixed(2)}</p>
              </div>
              {admissionId && pendingCharges.length > 0 && (
                <button
                  onClick={handleBulkApprove}
                  disabled={loading}
                  className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve All
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && charges.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : charges.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Charges Found</h3>
              <p className="text-slate-600">There are no charges to review at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {charges.map((charge) => (
                <div
                  key={charge.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{charge.chargeDescription}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(charge.chargeStatus)}`}>
                          {charge.chargeStatus.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-600 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Code:</span>
                          <span>{charge.chargeCode}</span>
                        </div>
                        {charge.cptCode && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">CPT:</span>
                            <span>{charge.cptCode}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(charge.serviceDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Qty:</span>
                          <span>{charge.quantity}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-slate-700">Unit Price:</span>
                          <span className="text-slate-900">${parseFloat(charge.unitPrice).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">Total:</span>
                          <span className="text-xl font-bold text-green-600">
                            ${parseFloat(charge.totalCharge || charge.unitPrice * charge.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {charge.notes && (
                        <div className="mt-2 p-2 bg-slate-50 rounded text-sm text-slate-600">
                          <span className="font-medium">Notes:</span> {charge.notes}
                        </div>
                      )}

                      {charge.approvalNotes && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                          <span className="font-medium">Approval Notes:</span> {charge.approvalNotes}
                        </div>
                      )}

                      {charge.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          <span className="font-medium">Rejection Reason:</span> {charge.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {(charge.chargeStatus === 'pending' || charge.chargeStatus === 'reviewed') && (
                        <>
                          <button
                            onClick={() => handleAction(charge, 'review')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Mark as Reviewed"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleAction(charge, 'approve')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleAction(charge, 'reject')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Modal */}
        {selectedCharge && actionType && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                {actionType === 'approve' && 'Approve Charge'}
                {actionType === 'reject' && 'Reject Charge'}
                {actionType === 'review' && 'Mark as Reviewed'}
              </h3>

              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <p className="font-semibold text-slate-900">{selectedCharge.chargeDescription}</p>
                <p className="text-sm text-slate-600">Amount: ${parseFloat(selectedCharge.totalCharge || selectedCharge.unitPrice * selectedCharge.quantity).toFixed(2)}</p>
              </div>

              {actionType === 'reject' ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    required
                    placeholder="Please provide a reason for rejecting this charge..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Add any notes about this action..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedCharge(null);
                    setActionType(null);
                    setNotes('');
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  disabled={loading || (actionType === 'reject' && !rejectionReason.trim())}
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {actionType === 'approve' && <CheckCircle className="w-4 h-4" />}
                      {actionType === 'reject' && <XCircle className="w-4 h-4" />}
                      {actionType === 'review' && <Eye className="w-4 h-4" />}
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChargeReviewModal;


