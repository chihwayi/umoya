/**
 * TB Screening Component with WHO Smart Forms Integration
 * 
 * Integrates WHO Smart Forms into the TB screening workflow
 */

import React, { useState } from 'react';
import { FileText, Stethoscope, ChevronRight } from 'lucide-react';
import { WHOSmartFormIntegration } from '../HIV/WHOSmartFormIntegration';
import TBScreeningComponent from '../TBScreeningComponent';
import { useNotification } from '../GlobalNotification';
import { ehrApi } from '../../services/api';

interface TBScreeningWithSmartFormsProps {
  patientId?: string;
  tenantSlug: string;
  token: string;
  onScreeningComplete?: (screeningData: any) => void;
}

// WHO Smart Forms for TB Screening workflow
const TB_SCREENING_FORMS = [
  {
    id: 'HIV.D4ScreenForTb',
    title: 'Screen for TB',
    description: 'WHO-recommended TB screening questionnaire',
  },
];

export const TBScreeningWithSmartForms: React.FC<TBScreeningWithSmartFormsProps> = ({
  patientId,
  tenantSlug,
  token,
  onScreeningComplete,
}) => {
  const { showSuccess, showError } = useNotification();
  const [showSmartForm, setShowSmartForm] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [useSmartForm, setUseSmartForm] = useState(false);

  const handleSmartFormSuccess = async (formData: Record<string, any>) => {
    try {
      console.log('WHO Smart Form submitted:', formData);
      
      // Map WHO Smart Form data to TB screening structure
      const mappedData = mapSmartFormToTbScreening(formData);
      
      // Submit to backend if patientId is available
      if (patientId) {
        await ehrApi.createTbScreening(mappedData, token, tenantSlug);
        showSuccess('Success', 'TB screening recorded using WHO Smart Form');
      }
      
      if (onScreeningComplete) {
        onScreeningComplete(mappedData);
      }
      
      setShowSmartForm(false);
      setSelectedFormId(null);
    } catch (error: any) {
      console.error('Error submitting TB screening:', error);
      showError('Error', `Failed to submit screening: ${error.message || 'Unknown error'}`);
    }
  };

  const mapSmartFormToTbScreening = (formData: Record<string, any>) => {
    // Map WHO Smart Form answers to TB screening structure
    // This mapping will depend on the specific form fields
    const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
    
    return {
      patientId: patientId || '',
      screeningDate: formData.screeningDate || new Date().toISOString().split('T')[0],
      screeningType: 'symptom_screen',
      screeningResult: formData.screeningResult || null,
      symptoms: {
        cough: formData.hasCough || false,
        fever: formData.hasFever || false,
        nightSweats: formData.hasNightSweats || false,
        weightLoss: formData.hasWeightLoss || false,
      },
      symptomDurationWeeks: formData.symptomDurationWeeks ? parseInt(formData.symptomDurationWeeks) : null,
      screenedBy: currentUser.id,
      notes: formData.notes || '',
      // Include all WHO Smart Form data
      whoSmartFormData: formData,
    };
  };

  const openSmartForm = (formId: string) => {
    setSelectedFormId(formId);
    setShowSmartForm(true);
  };

  if (useSmartForm && selectedFormId) {
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
          title={TB_SCREENING_FORMS.find(f => f.id === selectedFormId)?.title}
        />
        {/* Show regular form in background */}
        <div className="opacity-50 pointer-events-none">
          <TBScreeningComponent tenantSlug={tenantSlug} />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-gradient rounded-2xl p-6 border border-indigo-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">WHO TB Screening Workflow (optional)</h3>
              <p className="text-sm text-slate-600 mt-1">
                Optional WHO-aligned TB screening steps. The regular Medicore TB form remains the main form.
              </p>
            </div>
          </div>
          <button
            onClick={() => setUseSmartForm(true)}
            className="glass-button px-6 py-3 text-white rounded-xl flex items-center gap-2 font-semibold shadow-lg"
          >
            <Stethoscope className="w-5 h-5" />
            Open WHO Workflow
          </button>
        </div>

        {/* Quick Form Selection */}
        {useSmartForm && (
          <div className="mt-6 pt-6 border-t border-white/30">
            <p className="text-base font-bold text-slate-800 mb-4">Select Form:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TB_SCREENING_FORMS.map((form) => (
                <button
                  key={form.id}
                  onClick={() => openSmartForm(form.id)}
                  className="glass-card text-left p-5 rounded-xl group transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors text-lg mb-2">
                        {form.title}
                      </p>
                      <p className="text-sm text-slate-600">{form.description}</p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setUseSmartForm(false)}
              className="mt-6 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              ← Back to regular TB screening
            </button>
          </div>
        )}
      </div>

      {/* Standard TB Screening Component */}
      {!useSmartForm && <TBScreeningComponent tenantSlug={tenantSlug} />}
    </div>
  );
};
