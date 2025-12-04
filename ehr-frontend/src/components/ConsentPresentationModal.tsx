import React, { useState } from 'react';
import { FileText, User, Calendar, CheckCircle, XCircle, X, Shield } from 'lucide-react';
import axios from 'axios';
import { useNotification } from './GlobalNotification';
import SignaturePad from './SignaturePad';
import ICD10Picker from './ICD10Picker';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

interface ConsentPresentationModalProps {
  template: any;
  patientId: string;
  appointmentId: string;
  tenantSlug: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const ConsentPresentationModal: React.FC<ConsentPresentationModalProps> = ({
  template,
  patientId,
  appointmentId,
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [step, setStep] = useState<'review' | 'sign'>('review');
  const [patientSignature, setPatientSignature] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [witnessSignature, setWitnessSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Medical coding fields
  const [procedureSNOMED, setProcedureSNOMED] = useState('');
  const [procedureCPT, setProcedureCPT] = useState('');
  const [diagnosisICD10, setDiagnosisICD10] = useState('');
  const [diagnosisSNOMED, setDiagnosisSNOMED] = useState('');

  const handlePresentConsent = async () => {
    try {
      setSubmitting(true);
      // Create patient consent from template
      const consentData = {
        patientId,
        templateId: template.id,
        appointmentId,
        status: 'pending',
      };
      
      await ehrAxios.post('/consents', consentData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      showSuccess('Success', 'Consent presented to patient');
      setStep('sign');
    } catch (error) {
      showError('Error', 'Failed to present consent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSign = async () => {
    if (!patientSignature) {
      showError('Error', 'Patient signature is required');
      return;
    }

    try {
      setSubmitting(true);
      // In a real implementation, you'd get the consent ID from the previous step
      // For now, we'll create and sign in one go
      const consentData = {
        patientId,
        templateId: template.id,
        appointmentId,
        status: 'signed',
        patientSignature,
        witnessName: witnessName || undefined,
        witnessSignature: witnessSignature || undefined,
        signedAt: new Date().toISOString(),
        procedureSnomedCode: procedureSNOMED || undefined,
        procedureCptCode: procedureCPT || undefined,
        diagnosisIcd10: diagnosisICD10 || undefined,
        diagnosisSnomed: diagnosisSNOMED || undefined,
      };
      
      await ehrAxios.post('/consents', consentData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      showSuccess('Success', 'Consent signed successfully');
      onSuccess();
      onClose();
    } catch (error) {
      showError('Error', 'Failed to sign consent');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6" />
                {template.template_name || template.title}
              </h3>
              <p className="text-amber-100 mt-1">
                {step === 'review' ? 'Review Consent Form' : 'Obtain Signature'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'review' && (
            <div className="space-y-6">
              {/* Template Info */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-slate-600 mb-1">Type</div>
                    <div className="font-medium capitalize">{template.consent_type}</div>
                  </div>
                  <div>
                    <div className="text-slate-600 mb-1">Version</div>
                    <div className="font-medium">{template.version}</div>
                  </div>
                  <div>
                    <div className="text-slate-600 mb-1">Language</div>
                    <div className="font-medium uppercase">{template.language_code || 'EN'}</div>
                  </div>
                </div>
              </div>

              {/* Consent Content */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h4 className="text-lg font-bold text-slate-900 mb-4">{template.title}</h4>
                <div 
                  className="prose prose-sm max-w-none text-slate-700"
                  dangerouslySetInnerHTML={{ __html: template.content }}
                />
              </div>

              {/* Signature Requirements */}
              {template.signature_requirements && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-900 mb-2">Signature Requirements:</h5>
                  <ul className="text-sm text-blue-800 space-y-1">
                    {template.signature_requirements.patient && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Patient signature required
                      </li>
                    )}
                    {template.signature_requirements.witness && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Witness signature required
                      </li>
                    )}
                    {template.signature_requirements.provider && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Provider signature required
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 'sign' && (
            <div className="space-y-6">
              {/* Medical Coding Section */}
              {(template.consent_type === 'surgery' || template.consent_type === 'procedure') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-900 mb-3">Medical Coding (for billing & reporting)</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">
                        CPT Code (Procedure)
                      </label>
                      <input
                        type="text"
                        value={procedureCPT}
                        onChange={(e) => setProcedureCPT(e.target.value)}
                        placeholder="e.g., 44950 (Appendectomy)"
                        className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">
                        SNOMED CT (Procedure)
                      </label>
                      <input
                        type="text"
                        value={procedureSNOMED}
                        onChange={(e) => setProcedureSNOMED(e.target.value)}
                        placeholder="e.g., 80146002 (Appendectomy)"
                        className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <ICD10Picker
                        value={diagnosisICD10}
                        onChange={(code, description) => {
                          setDiagnosisICD10(code);
                        }}
                        token={token}
                        tenantSlug={tenantSlug}
                        label="ICD-10 (Diagnosis)"
                        placeholder="Search: appendicitis, cholecystitis, hernia..."
                        required={false}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">
                        SNOMED CT (Diagnosis)
                      </label>
                      <input
                        type="text"
                        value={diagnosisSNOMED}
                        onChange={(e) => setDiagnosisSNOMED(e.target.value)}
                        placeholder="e.g., 74400008 (Appendicitis)"
                        className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    💡 <strong>Why this matters:</strong> CPT codes are required for insurance billing. 
                    SNOMED CT enables clinical decision support and quality reporting. ICD-10 is mandatory for claims.
                  </p>
                </div>
              )}

              {/* Patient Signature */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Patient Signature *
                </label>
                <SignaturePad
                  onSave={(signature) => setPatientSignature(signature)}
                  onClear={() => setPatientSignature('')}
                />
              </div>

              {/* Witness (if required) */}
              {template.signature_requirements?.witness && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Witness Name
                    </label>
                    <input
                      type="text"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      placeholder="Full name of witness"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Witness Signature
                    </label>
                    <SignaturePad
                      onSave={(signature) => setWitnessSignature(signature)}
                      onClear={() => setWitnessSignature('')}
                    />
                  </div>
                </div>
              )}

              {/* Legal Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">
                  <strong>Legal Notice:</strong> By signing this consent form, you acknowledge that you have read, 
                  understood, and agree to the terms outlined above. Your signature indicates informed consent.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end p-6 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          
          {step === 'review' ? (
            <button
              onClick={handlePresentConsent}
              disabled={submitting}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Presenting...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Present to Patient
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSign}
              disabled={submitting || !patientSignature}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Signing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Sign Consent
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsentPresentationModal;

