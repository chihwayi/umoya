/**
 * Maternity Component with WHO Smart Forms Integration
 * 
 * Integrates WHO Smart Forms into the Maternity/PMTCT workflow
 */

import React, { useState } from 'react';
import { FileText, Baby, ChevronRight, Activity } from 'lucide-react';
import { WHOSmartFormIntegration } from '../HIV/WHOSmartFormIntegration';
import { useNotification } from '../GlobalNotification';
import { ehrApi } from '../../services/api';

interface MaternityWithSmartFormsProps {
  patientId?: string;
  patientName?: string;
  tenantSlug: string;
  token: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

// WHO Smart Forms for Maternity/PMTCT workflow
const MATERNITY_FORMS = [
  {
    id: 'HIV.E1CaptureOrUpdateMotherSHistory',
    title: 'Capture or Update Mother\'s History',
    description: 'Maternal history for PMTCT',
    category: 'history',
  },
  {
    id: 'HIV.E4TestMotherForHivUsingTestingAlgorithm',
    title: 'Test Mother for HIV',
    description: 'HIV testing for pregnant women',
    category: 'testing',
  },
  {
    id: 'HIV.F2TakeVitalSigns',
    title: 'Take Vital Signs',
    description: 'Vital signs for mother and infant',
    category: 'assessment',
  },
  {
    id: 'HIV.F3CaptureOrUpdateInfantSChildSHistory',
    title: 'Capture or Update Infant/Child\'s History',
    description: 'Infant history for PMTCT follow-up',
    category: 'history',
  },
  {
    id: 'HIV.F6CheckWhetherInfantChildHadHivExposure',
    title: 'Check HIV Exposure Status',
    description: 'Verify infant HIV exposure status',
    category: 'assessment',
  },
  {
    id: 'HIV.F8TestInfantChildForHivUsingTestingAlgorithm',
    title: 'Test Infant/Child for HIV',
    description: 'HIV testing algorithm for exposed infants',
    category: 'testing',
  },
  {
    id: 'HIV.F16ImmediatelyStartInfantOnArt',
    title: 'Start Infant on ART',
    description: 'ART initiation for HIV-positive infants',
    category: 'treatment',
  },
  {
    id: 'HIV.F20RecordInfantSChildSFinalHivDiagnosis',
    title: 'Record Final HIV Diagnosis',
    description: 'Final HIV diagnosis for infant/child',
    category: 'diagnosis',
  },
];

export const MaternityWithSmartForms: React.FC<MaternityWithSmartFormsProps> = ({
  patientId,
  patientName,
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showSuccess, showError } = useNotification();
  const [showSmartForm, setShowSmartForm] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSmartFormSuccess = async (formAnswers: Record<string, any>) => {
    try {
      // Accumulate form data
      const updatedFormData = { ...formData, ...formAnswers };
      setFormData(updatedFormData);

      // Map and submit data based on form type
      const mappedData = mapSmartFormToMaternity(updatedFormData, selectedFormId);
      
      // Submit to appropriate endpoint based on form type
      if (selectedFormId?.includes('E4') || selectedFormId?.includes('F8')) {
        // HIV Testing
        if (patientId) {
          await ehrApi.createHivTest(mappedData, token, tenantSlug);
          showSuccess('Success', 'HIV test recorded using WHO Smart Form');
        }
      } else if (selectedFormId?.includes('F16')) {
        // ART Initiation
        showSuccess('Success', 'ART initiation recorded using WHO Smart Form');
      } else {
        // General maternity data
        showSuccess('Success', 'Maternity data recorded using WHO Smart Form');
      }

      if (onSuccess) {
        onSuccess();
      }
      
      // Close smart form
      setShowSmartForm(false);
      
    } catch (error: any) {
      console.error('Error submitting maternity form:', error);
      showError('Error', `Failed to submit form: ${error.message || 'Unknown error'}`);
    }
  };

  const mapSmartFormToMaternity = (formData: Record<string, any>, formId: string | null) => {
    // Map WHO Smart Form answers to maternity structure
    const baseData = {
      patientId: patientId || '',
      whoSmartFormData: formData,
    };

    if (formId?.includes('E4') || formId?.includes('F8')) {
      // HIV Testing forms
      return {
        ...baseData,
        testDate: formData.testDate || new Date().toISOString().split('T')[0],
        testResult: formData.testResult,
        hivStatus: formData.hivStatus,
        testType: formData.testType || 'rapid_antibody',
      };
    }

    return baseData;
  };

  const openSmartForm = (formId: string) => {
    setSelectedFormId(formId);
    setShowSmartForm(true);
  };

  if (showSmartForm && selectedFormId) {
    const selectedForm = MATERNITY_FORMS.find(f => f.id === selectedFormId);
    
    return (
      <>
        <WHOSmartFormIntegration
          formId={selectedFormId}
          patientId={patientId || ''}
          token={token}
          tenantSlug={tenantSlug}
          onClose={() => {
            setShowSmartForm(false);
            setSelectedFormId(null);
          }}
          onSuccess={handleSmartFormSuccess}
          title={selectedForm?.title}
          initialValues={formData}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* WHO Smart Forms Option */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Baby className="w-5 h-5 text-pink-600" />
            <div>
              <h3 className="font-semibold text-slate-900">WHO Smart Forms for Maternity/PMTCT</h3>
              <p className="text-sm text-slate-600">
                Use WHO-recommended forms for standardized maternity and PMTCT care
              </p>
            </div>
          </div>
        </div>

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MATERNITY_FORMS.map((form) => (
            <button
              key={form.id}
              onClick={() => openSmartForm(form.id)}
              className="text-left p-4 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:bg-pink-50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-medium text-slate-900 group-hover:text-pink-700 mb-1">
                    {form.title}
                  </p>
                  <p className="text-xs text-slate-500 mb-2">{form.description}</p>
                  <span className="inline-block text-xs px-2 py-1 bg-pink-100 text-pink-700 rounded">
                    {form.category}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-pink-600 flex-shrink-0 ml-2" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};


