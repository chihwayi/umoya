import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import SignaturePad from './SignaturePad';

interface ConsentFormProps {
  patientId: string;
  templateId: string;
  appointmentId?: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ConsentForm: React.FC<ConsentFormProps> = ({
  patientId,
  templateId,
  appointmentId,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useNotification();
  const [template, setTemplate] = useState<any>(null);
  const [consent, setConsent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [currentSignerRole, setCurrentSignerRole] = useState<string>('');
  const [signatures, setSignatures] = useState<any[]>([]);
  const [filledFields, setFilledFields] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getConsentTemplate(templateId, token, tenantSlug);
      setTemplate(response.data);
    } catch (error) {
      showError('Error', 'Failed to load consent template');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const createConsent = async () => {
    try {
      setSubmitting(true);
      const response = await ehrApi.createPatientConsent(
        {
          patientId,
          templateId,
          appointmentId,
          filledFields,
        },
        token,
        tenantSlug,
      );
      setConsent(response.data);
      showSuccess('Success', 'Consent form created');
    } catch (error) {
      showError('Error', 'Failed to create consent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignature = (role: string) => {
    setCurrentSignerRole(role);
    setShowSignaturePad(true);
  };

  const saveSignature = async (signatureData: string) => {
    try {
      if (!consent) {
        await createConsent();
      }

      const consentId = consent?.id;
      if (!consentId) {
        showError('Error', 'Consent not created yet');
        return;
      }

      await ehrApi.signConsent(
        consentId,
        {
          signerRole: currentSignerRole,
          signerName: getCurrentUserName(),
          signatureType: 'electronic',
          signatureData,
          signatureMethod: 'canvas',
        },
        token,
        tenantSlug,
      );

      setSignatures([...signatures, { role: currentSignerRole, signed: true }]);
      setShowSignaturePad(false);
      showSuccess('Success', 'Signature captured');

      // Check if all required signatures collected
      const requirements = template.signatureRequirements;
      const allSigned = checkAllSignaturesComplete(requirements, [...signatures, { role: currentSignerRole }]);
      
      if (allSigned) {
        showSuccess('Complete', 'All required signatures collected');
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (error) {
      showError('Error', 'Failed to save signature');
    }
  };

  const getCurrentUserName = () => {
    // Get from localStorage or context
    const user = JSON.parse(localStorage.getItem('ehr_user') || '{}');
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
  };

  const checkAllSignaturesComplete = (requirements: any, currentSignatures: any[]) => {
    if (requirements.patient && !currentSignatures.some(s => s.role === 'patient')) return false;
    if (requirements.guardian && !currentSignatures.some(s => s.role === 'guardian')) return false;
    if (requirements.witness && !currentSignatures.some(s => s.role === 'witness')) return false;
    if (requirements.provider && !currentSignatures.some(s => s.role === 'provider')) return false;
    return true;
  };

  const handleDecline = async () => {
    if (!consent) return;

    const reason = prompt('Please provide a reason for declining:');
    if (!reason) return;

    try {
      await ehrApi.declineConsent(consent.id, reason, token, tenantSlug);
      showSuccess('Declined', 'Consent has been declined');
      onClose();
    } catch (error) {
      showError('Error', 'Failed to decline consent');
    }
  };

  const renderContent = () => {
    if (!template) return null;

    let content = template.content;
    
    // Replace placeholders with filled values
    Object.keys(filledFields).forEach(key => {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), filledFields[key] || '');
    });

    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">{template.title}</h2>
              <p className="text-sm text-indigo-100">{template.consentType} - v{template.version}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-indigo-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Consent Content */}
          <div className="prose max-w-none mb-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
            {renderContent()}
          </div>

          {/* Signature Requirements */}
          <div className="bg-white border-2 border-indigo-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Required Signatures</h3>
            
            <div className="space-y-3">
              {template.signatureRequirements.patient && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      signatures.some(s => s.role === 'patient') 
                        ? 'bg-green-100' 
                        : 'bg-slate-200'
                    }`}>
                      {signatures.some(s => s.role === 'patient') ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Patient Signature</div>
                      <div className="text-sm text-slate-600">Required</div>
                    </div>
                  </div>
                  {!signatures.some(s => s.role === 'patient') && (
                    <button
                      onClick={() => handleSignature('patient')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Sign
                    </button>
                  )}
                </div>
              )}

              {template.signatureRequirements.provider && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      signatures.some(s => s.role === 'provider') 
                        ? 'bg-green-100' 
                        : 'bg-slate-200'
                    }`}>
                      {signatures.some(s => s.role === 'provider') ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Provider Signature</div>
                      <div className="text-sm text-slate-600">Required</div>
                    </div>
                  </div>
                  {!signatures.some(s => s.role === 'provider') && (
                    <button
                      onClick={() => handleSignature('provider')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Sign
                    </button>
                  )}
                </div>
              )}

              {template.signatureRequirements.witness && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      signatures.some(s => s.role === 'witness') 
                        ? 'bg-green-100' 
                        : 'bg-slate-200'
                    }`}>
                      {signatures.some(s => s.role === 'witness') ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Witness Signature</div>
                      <div className="text-sm text-slate-600">Required</div>
                    </div>
                  </div>
                  {!signatures.some(s => s.role === 'witness') && (
                    <button
                      onClick={() => handleSignature('witness')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Sign
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={handleDecline}
              className="flex items-center gap-2 px-6 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Decline Consent
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePad
          signerName={getCurrentUserName()}
          signerRole={currentSignerRole}
          onSave={saveSignature}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}
    </div>
  );
};

export default ConsentForm;

