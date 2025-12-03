import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, Clock, AlertTriangle, Eye, Download, Ban } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface PatientConsentListProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onViewConsent?: (consentId: string) => void;
}

const PatientConsentList: React.FC<PatientConsentListProps> = ({
  patientId,
  tenantSlug,
  token,
  onViewConsent,
}) => {
  const { showSuccess, showError } = useNotification();
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadConsents();
  }, [patientId, filter]);

  const loadConsents = async () => {
    try {
      setLoading(true);
      const filters = filter !== 'all' ? { status: filter } : {};
      const response = await ehrApi.getPatientConsents(patientId, filters, token, tenantSlug);
      setConsents(response.data.consents || []);
    } catch (error) {
      showError('Error', 'Failed to load consents');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'declined':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'expired':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'revoked':
        return <Ban className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'expired':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'revoked':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const handleExport = async (consentId: string) => {
    try {
      const response = await ehrApi.exportConsent(consentId, 'pdf', token, tenantSlug);
      showSuccess('Success', 'Consent exported');
      // Handle PDF download
    } catch (error) {
      showError('Error', 'Failed to export consent');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {['all', 'signed', 'pending', 'declined'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Consents List */}
      {consents.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No consents found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consents.map((consent) => (
            <div
              key={consent.id}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(consent.status)}
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{consent.title}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                      <span>{consent.consentType}</span>
                      <span>•</span>
                      <span>{consent.consentNumber}</span>
                      {consent.signedAt && (
                        <>
                          <span>•</span>
                          <span>Signed: {formatDateTimeToDDMMYYYYHHMM(consent.signedAt)}</span>
                        </>
                      )}
                    </div>
                    {consent.validUntil && (
                      <div className="mt-1 text-xs text-slate-500">
                        Valid until: {new Date(consent.validUntil).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(consent.status)}`}>
                    {consent.status}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                {onViewConsent && (
                  <button
                    onClick={() => onViewConsent(consent.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                )}
                <button
                  onClick={() => handleExport(consent.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientConsentList;

