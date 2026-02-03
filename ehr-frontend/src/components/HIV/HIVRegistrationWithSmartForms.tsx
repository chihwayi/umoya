/**
 * HIV Registration Component with WHO Smart Forms Integration
 * 
 * Integrates WHO Smart Forms into the HIV registration/enrollment workflow
 */

import React, { useState } from 'react';
import { FileText, UserPlus, ChevronRight, X } from 'lucide-react';
import { WHOSmartFormIntegration } from './WHOSmartFormIntegration';
import HIVEnrollmentModal from '../HIVEnrollmentModal';
import { useNotification } from '../GlobalNotification';
import { ehrApi } from '../../services/api';

interface HIVRegistrationWithSmartFormsProps {
  patientId: string;
  patientName: string;
  patientAge?: number;
  patientSex?: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

// WHO Smart Forms for HIV Registration workflow
const REGISTRATION_FORMS = [
  {
    id: 'HIV.A2GatherClientDetails',
    title: 'Gather Client Details',
    step: 1,
    description: 'Collect basic client information for registration',
  },
  {
    id: 'HIV.A5CreateNewClientRecord',
    title: 'Create New Client Record',
    step: 2,
    description: 'Create new HIV client record in the system',
  },
  {
    id: 'HIV.A6.1ReviewSociodemographicDataWithClient',
    title: 'Review Sociodemographic Data',
    step: 3,
    description: 'Review and update sociodemographic information',
  },
];

export const HIVRegistrationWithSmartForms: React.FC<HIVRegistrationWithSmartFormsProps> = ({
  patientId,
  patientName,
  patientAge,
  patientSex,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useNotification();
  const [useSmartForm, setUseSmartForm] = useState(false);
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSmartFormSuccess = async (formAnswers: Record<string, any>) => {
    // Accumulate form data
    const updatedFormData = { ...formData, ...formAnswers };
    setFormData(updatedFormData);

    // If this is the last form, submit all data
    if (currentFormIndex === REGISTRATION_FORMS.length - 1) {
      await submitRegistration(updatedFormData);
    } else {
      // Move to next form
      setCurrentFormIndex(currentFormIndex + 1);
    }
  };

  const submitRegistration = async (allFormData: Record<string, any>) => {
    try {
      setSubmitting(true);

      // Map WHO Smart Form data to enrollment structure
      const enrollmentData = mapSmartFormToEnrollment(allFormData);

      // Submit enrollment
      await ehrApi.enrollInHivCare(enrollmentData, token, tenantSlug);

      showSuccess('Patient enrolled in HIV care using WHO Smart Forms');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting enrollment:', error);
      showError(`Failed to enroll patient: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const mapSmartFormToEnrollment = (formData: Record<string, any>) => {
    // Map WHO Smart Form answers to enrollment structure
    // This is a simplified mapping - adjust based on actual form fields
    return {
      patientId,
      enrollmentDate: formData.enrollmentDate || new Date().toISOString().split('T')[0],
      dateConfirmedPositive: formData.dateConfirmedPositive || formData.enrollmentDate,
      baselineCd4: formData.baselineCd4,
      baselineViralLoad: formData.baselineViralLoad,
      baselineClinicalStage: formData.baselineClinicalStage,
      // Include all WHO Smart Form data
      whoSmartFormData: formData,
    };
  };

  const handleBack = () => {
    if (currentFormIndex > 0) {
      setCurrentFormIndex(currentFormIndex - 1);
    } else {
      setUseSmartForm(false);
    }
  };

  if (useSmartForm && currentFormIndex < REGISTRATION_FORMS.length) {
    const currentForm = REGISTRATION_FORMS[currentFormIndex];
    
    return (
      <>
        <WHOSmartFormIntegration
          formId={currentForm.id}
          patientId={patientId}
          token={token}
          tenantSlug={tenantSlug}
          onClose={() => {
            if (currentFormIndex === 0) {
              setUseSmartForm(false);
            } else {
              handleBack();
            }
          }}
          onSuccess={handleSmartFormSuccess}
          title={`${currentForm.title} (Step ${currentForm.step} of ${REGISTRATION_FORMS.length})`}
          initialValues={formData}
        />
        {/* Progress indicator */}
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 border border-slate-200 z-40">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${((currentFormIndex + 1) / REGISTRATION_FORMS.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-slate-600">
              {currentFormIndex + 1} / {REGISTRATION_FORMS.length}
            </span>
          </div>
          <p className="text-xs text-slate-500">{currentForm.title}</p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* WHO Smart Forms Option */}
      <div className="glass-gradient rounded-2xl p-6 border border-indigo-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Use WHO Smart Forms for Registration</h3>
              <p className="text-sm text-slate-600 mt-1">
                Use WHO-recommended forms for standardized HIV patient registration
              </p>
            </div>
          </div>
          <button
            onClick={() => setUseSmartForm(true)}
            className="glass-button px-6 py-3 text-white rounded-xl flex items-center gap-2 font-semibold shadow-lg disabled:opacity-50"
            disabled={submitting}
          >
            <UserPlus className="w-5 h-5" />
            Use WHO Forms
          </button>
        </div>

        {/* Form Preview */}
        {!useSmartForm && (
          <div className="mt-6 pt-6 border-t border-white/30">
            <p className="text-base font-bold text-slate-800 mb-4">Registration Forms:</p>
            <div className="space-y-3">
              {REGISTRATION_FORMS.map((form, index) => (
                <div
                  key={form.id}
                  className="glass-card flex items-center gap-4 p-4 rounded-xl"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                    {form.step}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-slate-900">{form.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{form.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Standard Enrollment Modal */}
      {!useSmartForm && (
        <HIVEnrollmentModal
          patientId={patientId}
          patientName={patientName}
          patientAge={patientAge}
          patientSex={patientSex}
          tenantSlug={tenantSlug}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
};


