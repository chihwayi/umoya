import React, { useState, useEffect } from 'react';
import { X, FileText, Check, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import SignaturePad from './SignaturePad';
import { usePrompt } from '../hooks/usePrompt';

interface ConsentFormProps {
  patientId: string;
  patientName: string;
  templateId: string;
  appointmentId?: string;
  procedureId?: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ConsentForm: React.FC<ConsentFormProps> = ({
  patientId,
  patientName,
  templateId,
  appointmentId,
  procedureId,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useNotification();
  const { prompt, Dialog } = usePrompt();
  const [template, setTemplate] = useState<any>(null);
  const [consent, setConsent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filledFields, setFilledFields] = useState<Record<string, string>>({});
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [currentSignerRole, setCurrentSignerRole] = useState<string>('');
  const [signatures, setSignatures] = useState<any[]>([]);
  const [renderedContent, setRenderedContent] = useState('');

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.get(`/consents/templates/${templateId}`, token, tenantSlug);
      setTemplate(response.data);
      
      // Initialize filled fields
      const fields: Record<string, string> = {};
      response.data.requiredFields?.forEach((field: any) => {
        fields[field.name] = '';
      });
      
      // Auto-fill known fields
      fields['patient_name'] = patientName;
      fields['consent_date'] = new Date().toLocaleDateString();
      fields['facility_name'] = 'MediCore Health System';
      
      setFilledFields(fields);
      renderContent(response.data.content, fields);
    } catch (error) {
      console.error('Failed to load template:', error);
      showError('Error', 'Failed to load consent template');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (content: string, fields: Record<string, string>) => {
    let rendered = content;
    Object.keys(fields).forEach(key => {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), fields[key] || `[${key}]`);
    });
    setRenderedContent(rendered);
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    const updated = { ...filledFields, [fieldName]: value };
    setFilledFields(updated);
    renderContent(template.content, updated);
  };

  const createConsent = async () => {
    try {
      const response = await ehrApi.post(
        '/consents',
        {
          patientId,
          templateId,
          appointmentId,
          procedureId,
          filledFields,
        },
        token,
        tenantSlug,
      );
      setConsent(response.data);
      showSuccess('Success', 'Consent form created. Please collect signatures.');
    } catch (error) {
      console.error('Failed to create consent:', error);
      showError('Error', 'Failed to create consent');
    }
  };

  const handleSignature = (role: string) => {
    setCurrentSignerRole(role);
    setShowSignaturePad(true);
  };

  const saveSignature = async (signatureData: string) => {
    try {
      await ehrApi.post(
        `/consents/${consent.id}/sign`,
        {
          signerRole: currentSignerRole,
          signerName: currentSignerRole === 'patient' ? patientName : 'Provider',
          signatureType: 'electronic',
          signatureData,
        },
        token,
        tenantSlug,
      );
      
      // Reload consent to get updated signatures
      const response = await ehrApi.get(`/consents/${consent.id}`, token, tenantSlug);
      setConsent(response.data);
      setSignatures(response.data.signatures || []);
      
      setShowSignaturePad(false);
      showSuccess('Success', `${currentSignerRole} signature captured`);
      
      // Check if all required signatures collected
      if (response.data.status === 'signed') {
        showSuccess('Complete', 'All required signatures collected!');
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (error) {
      console.error('Failed to save signature:', error);
      showError('Error', 'Failed to save signature');
    }
  };

  const declineConsent = async () => {
    if (!consent) return;

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
      await ehrApi.post(`/consents/${consent.id}/decline`, { reason }, token, tenantSlug);
      showSuccess('Declined', 'Consent declined');
      onClose();
    } catch (error) {
      console.error('Failed to decline consent:', error);
      showError('Error', 'Failed to decline consent');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading consent form...</p>
        </div>
      </div>
    );
  }

  if (!template) return null;

  const requiresSignature = (role: string) => {
    return template.signatureRequirements?.[role] === true;
  };

  const hasSignature = (role: string) => {
    return signatures.some(sig => sig.signerRole === role);
  };

  return (
    <>
      {Dialog}
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-slate-900">{template.title}</h2>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-600">
          <span>Patient: <strong>{patientName}</strong></span>
          <span>Type: <strong>{template.consentType}</strong></span>
          <span>Version: <strong>{template.version}</strong></span>
        </div>
      </div>

      {/* Dynamic Fields */}
      {template.requiredFields && template.requiredFields.length > 0 && !consent && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Required Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {template.requiredFields.map((field: any) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type={field.type || 'text'}
                  value={filledFields[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder={field.placeholder}
                  disabled={field.name === 'patient_name' || field.name === 'consent_date'}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consent Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div 
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </div>

      {/* Actions */}
      {!consent ? (
        <div className="flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={createConsent}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-lg hover:from-indigo-700 hover:to-purple-800 transition-colors font-medium flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Proceed to Signatures
          </button>
        </div>
      ) : (
        <div>
          {/* Signature Collection */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Required Signatures</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requiresSignature('patient') && (
                <div className={`p-4 rounded-lg border-2 ${hasSignature('patient') ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900">Patient Signature</span>
                    {hasSignature('patient') ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  {!hasSignature('patient') && (
                    <button
                      onClick={() => handleSignature('patient')}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      Sign as Patient
                    </button>
                  )}
                </div>
              )}

              {requiresSignature('provider') && (
                <div className={`p-4 rounded-lg border-2 ${hasSignature('provider') ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900">Provider Signature</span>
                    {hasSignature('provider') ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  {!hasSignature('provider') && (
                    <button
                      onClick={() => handleSignature('provider')}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      Sign as Provider
                    </button>
                  )}
                </div>
              )}

              {requiresSignature('witness') && (
                <div className={`p-4 rounded-lg border-2 ${hasSignature('witness') ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900">Witness Signature</span>
                    {hasSignature('witness') ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  {!hasSignature('witness') && (
                    <button
                      onClick={() => handleSignature('witness')}
                      className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                    >
                      Sign as Witness
                    </button>
                  )}
                </div>
              )}

              {requiresSignature('guardian') && (
                <div className={`p-4 rounded-lg border-2 ${hasSignature('guardian') ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900">Guardian Signature</span>
                    {hasSignature('guardian') ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  {!hasSignature('guardian') && (
                    <button
                      onClick={() => handleSignature('guardian')}
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                    >
                      Sign as Guardian
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          {consent.status === 'signed' && (
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <Check className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-green-900">Consent Completed</h3>
                  <p className="text-sm text-green-700">All required signatures have been collected.</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={declineConsent}
              className="px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium flex items-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Decline Consent
            </button>
            
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePad
          signerName={currentSignerRole === 'patient' ? patientName : currentSignerRole}
          signerRole={currentSignerRole}
          onSave={saveSignature}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}
      </div>
    </>
  );
};

export default ConsentForm;
