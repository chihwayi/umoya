import React, { useState, useEffect } from 'react';
import { 
  FileText, Check, XCircle, Clock, Download, Printer, Mail, Ban,
  User, Calendar, MapPin, Monitor, Shield
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface ConsentViewerProps {
  consentId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
}

const ConsentViewer: React.FC<ConsentViewerProps> = ({
  consentId,
  tenantSlug,
  token,
  onClose,
}) => {
  const { showSuccess, showError } = useNotification();
  const [consent, setConsent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  useEffect(() => {
    loadConsent();
  }, [consentId]);

  const loadConsent = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.get(`/consents/${consentId}`, token, tenantSlug);
      setConsent(response.data);
    } catch (error) {
      console.error('Failed to load consent:', error);
      showError('Error', 'Failed to load consent');
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
      await ehrApi.post(`/consents/${consentId}/revoke`, { reason: revokeReason }, token, tenantSlug);
      showSuccess('Revoked', 'Consent has been revoked');
      setShowRevokeDialog(false);
      loadConsent();
    } catch (error) {
      console.error('Failed to revoke consent:', error);
      showError('Error', 'Failed to revoke consent');
    }
  };

  const handleExport = async (format: 'pdf' | 'json') => {
    try {
      const response = await ehrApi.get(`/consents/${consentId}/export?format=${format}`, token, tenantSlug);
      showSuccess('Success', `Consent exported as ${format.toUpperCase()}`);
      // Handle download
    } catch (error) {
      console.error('Failed to export consent:', error);
      showError('Error', 'Failed to export consent');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'from-green-500 to-emerald-600';
      case 'declined': return 'from-red-500 to-rose-600';
      case 'pending': return 'from-amber-500 to-orange-600';
      case 'expired': return 'from-orange-500 to-red-500';
      case 'revoked': return 'from-red-600 to-red-700';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading consent...</p>
        </div>
      </div>
    );
  }

  if (!consent) return null;

  return (
    <div className="space-y-4 sm:space-y-6 max-h-[85vh] overflow-y-auto">
      {/* Header with Status */}
      <div className={`relative overflow-hidden rounded-xl shadow-lg`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${getStatusColor(consent.status)} opacity-90`}></div>
        <div className="relative p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-2xl font-bold text-white drop-shadow-sm truncate">
                    {consent.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/90">
                    {consent.consentNumber}
                  </p>
                </div>
              </div>
              
              {/* Meta Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                <div className="text-xs sm:text-sm text-white/90">
                  <span className="block text-white/70">Type</span>
                  <span className="font-semibold">{consent.consentType}</span>
                </div>
                <div className="text-xs sm:text-sm text-white/90">
                  <span className="block text-white/70">Version</span>
                  <span className="font-semibold">{consent.templateVersion}</span>
                </div>
                <div className="text-xs sm:text-sm text-white/90">
                  <span className="block text-white/70">Language</span>
                  <span className="font-semibold">{consent.languageCode?.toUpperCase()}</span>
                </div>
                <div className="text-xs sm:text-sm text-white/90">
                  <span className="block text-white/70">Status</span>
                  <span className="font-semibold">{consent.status.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patient & Timing Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Patient Information</h3>
          </div>
          <div className="space-y-2 text-xs sm:text-sm text-slate-600">
            {consent.patient && (
              <div>
                <span className="text-slate-500">Name:</span>{' '}
                <span className="font-medium text-slate-900">
                  {consent.patient.firstName} {consent.patient.lastName}
                </span>
              </div>
            )}
            {consent.location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{consent.location}</span>
              </div>
            )}
            {consent.ipAddress && (
              <div className="flex items-start gap-2">
                <Monitor className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs font-mono">{consent.ipAddress}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Timeline</h3>
          </div>
          <div className="space-y-2 text-xs sm:text-sm text-slate-600">
            {consent.presentedAt && (
              <div>
                <span className="text-slate-500">Presented:</span>{' '}
                <span className="font-medium">{formatDateTimeToDDMMYYYYHHMM(consent.presentedAt)}</span>
              </div>
            )}
            {consent.signedAt && (
              <div>
                <span className="text-slate-500">Signed:</span>{' '}
                <span className="font-medium">{formatDateTimeToDDMMYYYYHHMM(consent.signedAt)}</span>
              </div>
            )}
            {consent.validFrom && consent.validUntil && (
              <div>
                <span className="text-slate-500">Valid:</span>{' '}
                <span className="font-medium">
                  {new Date(consent.validFrom).toLocaleDateString()} - {new Date(consent.validUntil).toLocaleDateString()}
                </span>
              </div>
            )}
            {consent.revokedAt && (
              <div>
                <span className="text-slate-500">Revoked:</span>{' '}
                <span className="font-medium">{formatDateTimeToDDMMYYYYHHMM(consent.revokedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Consent Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8">
        <div 
          className="prose prose-slate prose-sm sm:prose-base max-w-none"
          dangerouslySetInnerHTML={{ __html: consent.content }}
        />
      </div>

      {/* Signatures */}
      {consent.signatures && consent.signatures.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">Signatures</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {consent.signatures.map((signature: any, index: number) => (
              <div key={index} className="border-2 border-green-200 bg-green-50 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span className="font-semibold text-slate-900 text-sm sm:text-base capitalize">
                    {signature.signerRole}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 space-y-1">
                  <div>Name: <strong>{signature.signerName}</strong></div>
                  <div>Signed: <strong>{formatDateTimeToDDMMYYYYHHMM(signature.signedAt)}</strong></div>
                  <div>Method: <strong>{signature.signatureType}</strong></div>
                  {signature.signatureData && (
                    <div className="mt-2 border-t border-green-200 pt-2">
                      <img 
                        src={signature.signatureData} 
                        alt="Signature" 
                        className="h-12 sm:h-16 bg-white rounded border border-green-200"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sticky bottom-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors text-xs sm:text-sm font-medium"
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors text-xs sm:text-sm font-medium"
            >
              <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={() => {/* Email */}}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors text-xs sm:text-sm font-medium"
            >
              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Email</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {consent.status === 'signed' && (
              <button
                onClick={() => setShowRevokeDialog(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs sm:text-sm font-medium"
              >
                <Ban className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Revoke</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 sm:px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs sm:text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Revoke Dialog */}
      {showRevokeDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 sm:px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Ban className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                <h3 className="text-lg sm:text-xl font-bold text-white">Revoke Consent</h3>
              </div>
              <button onClick={() => setShowRevokeDialog(false)} className="text-white hover:text-red-100">
                <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6">
              <p className="text-sm sm:text-base text-slate-700 mb-4">
                Please provide a reason for revoking this consent. This action will be logged and cannot be undone.
              </p>
              
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason for revocation..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm sm:text-base"
                rows={4}
              />
              
              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowRevokeDialog(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={!revokeReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Revoke Consent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsentViewer;
