import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Ban, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface ConsentViewerProps {
  consentId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onRevoked?: () => void;
}

const ConsentViewer: React.FC<ConsentViewerProps> = ({
  consentId,
  tenantSlug,
  token,
  onClose,
  onRevoked,
}) => {
  const { showSuccess, showError } = useNotification();
  const [consent, setConsent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  useEffect(() => {
    loadConsent();
  }, [consentId]);

  const loadConsent = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getConsentById(consentId, token, tenantSlug);
      setConsent(response.data);
    } catch (error) {
      showError('Error', 'Failed to load consent');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeReason.trim()) {
      showError('Error', 'Please provide a reason for revocation');
      return;
    }

    try {
      await ehrApi.revokeConsent(consentId, revokeReason, token, tenantSlug);
      showSuccess('Success', 'Consent has been revoked');
      if (onRevoked) onRevoked();
      onClose();
    } catch (error) {
      showError('Error', 'Failed to revoke consent');
    }
  };

  const handleExport = async () => {
    try {
      await ehrApi.exportConsent(consentId, 'pdf', token, tenantSlug);
      showSuccess('Success', 'Consent exported');
    } catch (error) {
      showError('Error', 'Failed to export consent');
    }
  };

  if (loading || !consent) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">{consent.title}</h2>
              <p className="text-sm text-indigo-100">
                {consent.consentNumber} • {consent.consentType}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-indigo-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Status Banner */}
          <div className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-3 ${
            consent.status === 'signed' ? 'bg-green-50 border-green-300' :
            consent.status === 'pending' ? 'bg-yellow-50 border-yellow-300' :
            consent.status === 'declined' ? 'bg-red-50 border-red-300' :
            consent.status === 'expired' ? 'bg-orange-50 border-orange-300' :
            consent.status === 'revoked' ? 'bg-red-50 border-red-300' :
            'bg-slate-50 border-slate-300'
          }`}>
            {consent.status === 'signed' && <CheckCircle className="w-6 h-6 text-green-600" />}
            {consent.status === 'pending' && <Clock className="w-6 h-6 text-yellow-600" />}
            {consent.status === 'declined' && <XCircle className="w-6 h-6 text-red-600" />}
            {consent.status === 'expired' && <AlertTriangle className="w-6 h-6 text-orange-600" />}
            {consent.status === 'revoked' && <Ban className="w-6 h-6 text-red-600" />}
            
            <div className="flex-1">
              <div className="font-semibold text-slate-900">
                Status: {consent.status.charAt(0).toUpperCase() + consent.status.slice(1)}
              </div>
              {consent.signedAt && (
                <div className="text-sm text-slate-600">
                  Signed on {formatDateTimeToDDMMYYYYHHMM(consent.signedAt)}
                </div>
              )}
              {consent.validUntil && (
                <div className="text-sm text-slate-600">
                  Valid until {new Date(consent.validUntil).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Consent Content */}
          <div className="prose max-w-none mb-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
            <div dangerouslySetInnerHTML={{ __html: consent.content }} />
          </div>

          {/* Signatures */}
          {consent.signatures && consent.signatures.length > 0 && (
            <div className="bg-white border-2 border-indigo-200 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Signatures ({consent.signatures.length})
              </h3>
              
              <div className="space-y-3">
                {consent.signatures.map((sig: any, index: number) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="w-24 h-16 bg-white border border-slate-300 rounded flex items-center justify-center">
                      <img 
                        src={sig.signatureData} 
                        alt={`${sig.signerRole} signature`}
                        className="max-w-full max-h-full"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{sig.signerName}</div>
                      <div className="text-sm text-slate-600 capitalize">{sig.signerRole}</div>
                      <div className="text-xs text-slate-500">
                        {formatDateTimeToDDMMYYYYHHMM(sig.signedAt)}
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              {consent.status === 'signed' && !showRevokeConfirm && (
                <button
                  onClick={() => setShowRevokeConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  <Ban className="w-4 h-4" />
                  Revoke Consent
                </button>
              )}
              
              {showRevokeConfirm && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Reason for revocation..."
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleRevoke}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Confirm Revoke
                  </button>
                  <button
                    onClick={() => {
                      setShowRevokeConfirm(false);
                      setRevokeReason('');
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentViewer;

