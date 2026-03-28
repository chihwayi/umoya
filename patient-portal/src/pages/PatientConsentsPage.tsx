import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import {
  CheckCircle, XCircle, Clock, Download, AlertTriangle,
  Eye, Edit3, Calendar, Shield, ArrowLeft
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { format } from 'date-fns';
import { usePrompt } from '../hooks/usePrompt';
import { PromptDialog } from '../components/PromptDialog';

interface Consent {
  id: string;
  consent_number: string;
  template_name: string;
  consent_type: string;
  title: string;
  content: string;
  status: 'pending' | 'signed' | 'declined' | 'expired' | 'revoked';
  consent_date?: string;
  valid_until?: string;
  appointment_id?: string;
  declined_reason?: string;
  created_at: string;
}

const PatientConsentsPage: React.FC = () => {
  const { patient, token } = usePatientAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const { promptState, setPromptState, prompt, cancel, confirm } = usePrompt();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'signed' | 'declined'>('all');
  const [selectedConsent, setSelectedConsent] = useState<Consent | null>(null);
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [signature, setSignature] = useState('');
  const [_isDrawing, _setIsDrawing] = useState(false);
  const [_canvasRef, _setCanvasRef] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    loadConsents();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConsents = async () => {
    try {
      setLoading(true);
      const filters = filter !== 'all' ? { status: filter } : {};
      const data = await patientPortalApi.getPatientConsents(token!, tenantSlug!, filters);
      setConsents(data);
    } catch (error) {
      console.error('Failed to load consents:', error);
      showError('Error', 'Failed to load consents');
    } finally {
      setLoading(false);
    }
  };

  const handleSignConsent = async () => {
    if (!selectedConsent || !signature) {
      showError('Error', 'Please provide your signature');
      return;
    }

    try {
      await patientPortalApi.signConsent(
        selectedConsent.id,
        { signatureData: signature, signedBy: patient?.id },
        token!,
        tenantSlug!
      );
      showSuccess('Success', 'Consent signed successfully');
      setShowSigningModal(false);
      setSelectedConsent(null);
      setSignature('');
      loadConsents();
    } catch (error) {
      showError('Error', 'Failed to sign consent');
    }
  };

  const handleDeclineConsent = async (consentId: string) => {
    const reason = await prompt({
      title: 'Decline Consent',
      message: 'Please provide a reason for declining this consent.',
      placeholder: 'Reason for declining',
      confirmText: 'Decline Consent',
      cancelText: 'Cancel',
      type: 'danger',
      multiline: true,
      required: true,
    });
    if (!reason) return;

    try {
      await patientPortalApi.declineConsent(consentId, reason, token!, tenantSlug!);
      showSuccess('Success', 'Consent declined');
      loadConsents();
    } catch (error) {
      showError('Error', 'Failed to decline consent');
    }
  };

  const handleDownloadConsent = async (consentId: string) => {
    try {
      const blob = await patientPortalApi.downloadConsent(consentId, 'pdf', token!, tenantSlug!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consent-${consentId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Success', 'Consent downloaded');
    } catch (error) {
      showError('Error', 'Failed to download consent');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pending Signature
        </span>;
      case 'signed':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Signed
        </span>;
      case 'declined':
        return <span className="px-3 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-semibold flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Declined
        </span>;
      case 'expired':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs font-semibold">
          Expired
        </span>;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'treatment': return 'from-blue-500 to-cyan-600';
      case 'surgery': return 'from-red-500 to-pink-600';
      case 'procedure': return 'from-purple-500 to-indigo-600';
      case 'hipaa': return 'from-slate-600 to-slate-700';
      case 'telehealth': return 'from-green-500 to-emerald-600';
      default: return 'from-indigo-500 to-purple-600';
    }
  };

  const filteredConsents = consents;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <PromptDialog
        isOpen={promptState.isOpen}
        title={promptState.title}
        message={promptState.message}
        value={promptState.value}
        onChange={(value) => setPromptState((prev) => ({ ...prev, value }))}
        onCancel={cancel}
        onConfirm={confirm}
        confirmText={promptState.confirmText}
        cancelText={promptState.cancelText}
        placeholder={promptState.placeholder}
        type={promptState.type}
        multiline={promptState.multiline}
      />
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/${tenantSlug}/dashboard`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-indigo-600" />
                  My Consents
                </h1>
                <p className="text-sm text-gray-600">Review and sign consent forms</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1 mb-6 inline-flex">
          {(['all', 'pending', 'signed', 'declined'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                filter === f
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              {f === 'all' ? 'All Consents' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Consents List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading consents...</p>
            </div>
          </div>
        ) : filteredConsents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Consents Found</h3>
            <p className="text-gray-600">You don't have any {filter !== 'all' ? filter : ''} consents at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredConsents.map((consent) => (
              <div key={consent.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className={`inline-block px-3 py-1 bg-gradient-to-r ${getTypeColor(consent.consent_type)} text-white rounded-lg text-xs font-semibold mb-2`}>
                      {consent.consent_type}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{consent.title}</h3>
                    <p className="text-sm text-gray-600">Consent #{consent.consent_number}</p>
                  </div>
                  <div>
                    {getStatusBadge(consent.status)}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Created: {format(new Date(consent.created_at), 'MMM dd, yyyy')}</span>
                  </div>
                  {consent.consent_date && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Signed: {format(new Date(consent.consent_date), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                  {consent.valid_until && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Valid until: {format(new Date(consent.valid_until), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedConsent(consent);
                      setShowSigningModal(true);
                    }}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                  
                  {consent.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedConsent(consent);
                          setShowSigningModal(true);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-colors flex items-center gap-2 shadow-md"
                      >
                        <Edit3 className="w-4 h-4" />
                        Sign Now
                      </button>
                      <button
                        onClick={() => handleDeclineConsent(consent.id)}
                        className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Decline
                      </button>
                    </>
                  )}
                  
                  {consent.status === 'signed' && (
                    <button
                      onClick={() => handleDownloadConsent(consent.id)}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  )}
                </div>

                {consent.status === 'declined' && consent.declined_reason && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700"><strong>Declined Reason:</strong> {consent.declined_reason}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Signing Modal */}
      {showSigningModal && selectedConsent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className={`sticky top-0 bg-gradient-to-r ${getTypeColor(selectedConsent.consent_type)} text-white p-6 z-10`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedConsent.title}</h2>
                  <p className="text-white/80 mt-1">Consent #{selectedConsent.consent_number}</p>
                </div>
                <button
                  onClick={() => {
                    setShowSigningModal(false);
                    setSelectedConsent(null);
                    setSignature('');
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Consent Content */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selectedConsent.content }} />
              </div>

              {/* Signature Section (only for pending) */}
              {selectedConsent.status === 'pending' && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-indigo-600" />
                    Electronic Signature Required
                  </h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type your full name to sign:
                    </label>
                    <input
                      type="text"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <p className="text-sm text-amber-700">
                      By signing this consent, you acknowledge that you have read, understood, and agree to the terms outlined above.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSignConsent}
                      disabled={!signature}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Sign Consent
                    </button>
                    <button
                      onClick={() => handleDeclineConsent(selectedConsent.id)}
                      className="px-6 py-3 bg-red-50 text-red-600 border-2 border-red-200 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Download Button (for signed consents) */}
              {selectedConsent.status === 'signed' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handleDownloadConsent(selectedConsent.id)}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientConsentsPage;
