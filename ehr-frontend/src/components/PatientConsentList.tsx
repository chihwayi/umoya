import React, { useState, useEffect } from 'react';
import { FileText, Check, XCircle, Clock, AlertTriangle, Eye, Download, Ban } from 'lucide-react';
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
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadConsents();
  }, [patientId]);

  const loadConsents = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.get(`/consents/patient/${patientId}`, token, tenantSlug);
      setConsents(response.data.consents || []);
    } catch (error) {
      console.error('Failed to load consents:', error);
      showError('Error', 'Failed to load patient consents');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed': return <Check className="w-5 h-5 text-green-600" />;
      case 'declined': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending': return <Clock className="w-5 h-5 text-amber-600" />;
      case 'expired': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'revoked': return <Ban className="w-5 h-5 text-red-600" />;
      default: return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-green-100 text-green-800 border-green-300';
      case 'declined': return 'bg-red-100 text-red-800 border-red-300';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'expired': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'revoked': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const filteredConsents = consents.filter(consent => {
    if (filterStatus !== 'all' && consent.status !== filterStatus) return false;
    if (filterType !== 'all' && consent.consentType !== filterType) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading consents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="signed">Signed</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Types</option>
          <option value="treatment">Treatment</option>
          <option value="surgery">Surgery</option>
          <option value="procedure">Procedure</option>
          <option value="hipaa">HIPAA</option>
          <option value="telehealth">Telehealth</option>
          <option value="research">Research</option>
        </select>
      </div>

      {/* Consent List */}
      {filteredConsents.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-600">No consents found</p>
          <p className="text-sm text-slate-500">No consent forms match the selected filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredConsents.map(consent => (
            <div
              key={consent.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {getStatusIcon(consent.status)}
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-900 mb-1">{consent.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mb-3">
                      <span>Number: <strong>{consent.consentNumber}</strong></span>
                      <span>Type: <strong>{consent.consentType}</strong></span>
                      {consent.signedAt && (
                        <span>Signed: <strong>{formatDateTimeToDDMMYYYYHHMM(consent.signedAt)}</strong></span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getStatusColor(consent.status)}`}>
                        {consent.status.toUpperCase()}
                      </span>
                      {consent.validUntil && new Date(consent.validUntil) < new Date() && consent.status === 'signed' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold border-2 bg-orange-100 text-orange-800 border-orange-300">
                          EXPIRED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onViewConsent && (
                    <button
                      onClick={() => onViewConsent(consent.id)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="View Consent"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => {/* Download */}}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientConsentList;
