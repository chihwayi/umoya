/**
 * Clinical Notes Component with WHO Smart Forms Integration
 * 
 * Integrates WHO Smart Forms into the clinical notes workflow
 */

import React, { useState } from 'react';
import { FileText, Stethoscope, ChevronRight, User, History } from 'lucide-react';
import { GenericSmartFormWrapper } from '../WHOSmartForms/GenericSmartFormWrapper';
import { useNotification } from '../GlobalNotification';
import { ehrApi } from '../../services/api';

interface ClinicalNotesWithSmartFormsProps {
  patientId: string;
  patientName: string;
  appointmentId?: string;
  tenantSlug: string;
  token: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

// WHO Smart Forms for Clinical Notes/History workflow
const CLINICAL_NOTES_FORMS = [
  {
    id: 'HIV.D1DetermineReasonForVisit',
    title: 'Determine Reason for Visit',
    description: 'Capture the reason for the clinical visit',
    category: 'history',
  },
  {
    id: 'HIV.D8CaptureOrUpdateClientHistory',
    title: 'Capture or Update Client History',
    description: 'Record or update patient medical history',
    category: 'history',
  },
  {
    id: 'HIV.C1DetermineReasonForVisit',
    title: 'Determine Reason for Visit (Care)',
    description: 'Capture reason for care visit',
    category: 'history',
  },
  {
    id: 'HIV.C3CaptureOrUpdateClientHistory',
    title: 'Capture or Update Client History (Care)',
    description: 'Record or update history during care visit',
    category: 'history',
  },
  {
    id: 'HIV.B1DetermineReasonForVisit',
    title: 'Determine Reason for Visit (Testing)',
    description: 'Capture reason for testing visit',
    category: 'history',
  },
  {
    id: 'HIV.B6CaptureOrUpdateClientHistory',
    title: 'Capture or Update Client History (Testing)',
    description: 'Record history before testing',
    category: 'history',
  },
];

export const ClinicalNotesWithSmartForms: React.FC<ClinicalNotesWithSmartFormsProps> = ({
  patientId,
  patientName,
  appointmentId,
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showSuccess, showError } = useNotification();
  const [showSmartForm, setShowSmartForm] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const handleSmartFormSuccess = async (formAnswers: Record<string, any>) => {
    try {
      console.log('WHO Smart Form submitted:', formAnswers);
      
      // Map WHO Smart Form data to clinical notes structure
      const mappedData = mapSmartFormToClinicalNotes(formAnswers);
      
      // Save to appointment notes if appointmentId is provided
      if (appointmentId) {
        const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
        const notesPayload = {
          clinicalDocumentation: {
            chiefComplaint: mappedData.chiefComplaint || '',
            historyOfPresentIllness: mappedData.historyOfPresentIllness || '',
            physicalExamination: mappedData.physicalExamination || '',
            clinicalAssessment: mappedData.clinicalAssessment || '',
            additionalNotes: mappedData.additionalNotes || '',
          },
          whoSmartFormData: formAnswers,
        };
        
        await ehrApi.updateAppointment(
          appointmentId,
          { 
            notes: JSON.stringify(notesPayload),
            whoSmartFormData: formAnswers
          },
          token,
          tenantSlug
        );
        showSuccess('Success', 'Clinical notes saved using WHO Smart Form');
      }
      
      if (onSuccess) {
        onSuccess();
      }
      
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Error submitting clinical notes:', error);
      showError('Error', `Failed to save notes: ${error.message || 'Unknown error'}`);
    }
  };

  const mapSmartFormToClinicalNotes = (formData: Record<string, any>) => {
    // Map WHO Smart Form answers to clinical notes structure
    // This is a simplified mapping - adjust based on actual form fields
    return {
      chiefComplaint: formData.reasonForVisit || formData.chiefComplaint || '',
      historyOfPresentIllness: formData.history || formData.historyOfPresentIllness || '',
      physicalExamination: formData.physicalExam || formData.physicalExamination || '',
      clinicalAssessment: formData.assessment || formData.clinicalAssessment || '',
      additionalNotes: formData.notes || formData.additionalNotes || '',
      whoSmartFormData: formData,
    };
  };

  const openSmartForm = (formId: string) => {
    setSelectedFormId(formId);
    setShowSmartForm(true);
  };

  if (showSmartForm && selectedFormId) {
    const selectedForm = CLINICAL_NOTES_FORMS.find(f => f.id === selectedFormId);
    
    return (
      <GenericSmartFormWrapper
        formId={selectedFormId}
        patientId={patientId}
        token={token}
        tenantSlug={tenantSlug}
        onClose={() => {
          setShowSmartForm(false);
          setSelectedFormId(null);
        }}
        onSuccess={handleSmartFormSuccess}
        title={selectedForm?.title}
        description={selectedForm?.description}
        initialValues={formData}
        showAsModal={true}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-slate-900">WHO Clinical Notes Workflow (optional)</h3>
              <p className="text-sm text-slate-600">
                Optional WHO-aligned documentation steps. The regular Umoya clinical notes remain the main form.
              </p>
            </div>
          </div>
        </div>

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CLINICAL_NOTES_FORMS.map((form) => (
            <button
              key={form.id}
              onClick={() => openSmartForm(form.id)}
              className="text-left p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {form.category === 'history' && <History className="w-4 h-4 text-blue-600" />}
                    <p className="font-medium text-slate-900 group-hover:text-blue-700">
                      {form.title}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{form.description}</p>
                  <span className="inline-block text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {form.category}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 flex-shrink-0 ml-2" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

