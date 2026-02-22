/**
 * HIV Care & Treatment Visit Component with WHO Smart Forms Integration
 * 
 * Integrates WHO Smart Forms into the HIV clinical visit workflow
 */

import React, { useState } from 'react';
import { FileText, Stethoscope, ChevronRight, Activity } from 'lucide-react';
import { WHOSmartFormIntegration } from './WHOSmartFormIntegration';
import HIVClinicalVisitModal from '../HIVClinicalVisitModal';
import { useNotification } from '../GlobalNotification';
import { ehrApi } from '../../services/api';
import { getHivCdssConfig } from './hivCdssConfig';
import { validateHivVisitAgainstGuidelines } from './hivVisitGuidelineValidation';

interface HIVCareVisitWithSmartFormsProps {
  enrollment: any;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

// WHO Smart Forms for HIV Care & Treatment workflow
const CARE_VISIT_FORMS = [
  {
    id: 'HIV.D2TakeVitalSigns',
    title: 'Take Vital Signs',
    step: 1,
    description: 'Record patient vital signs',
    category: 'assessment',
  },
  {
    id: 'HIV.D3CheckForSignsOfSeriousIllness',
    title: 'Check for Signs of Serious Illness',
    step: 2,
    description: 'Screen for signs of serious illness',
    category: 'assessment',
  },
  {
    id: 'HIV.D4ScreenForTb',
    title: 'Screen for TB',
    step: 3,
    description: 'TB screening questionnaire',
    category: 'screening',
  },
  {
    id: 'HIV.D8CaptureOrUpdateClientHistory',
    title: 'Capture or Update Client History',
    step: 4,
    description: 'Update client medical history',
    category: 'history',
  },
  {
    id: 'HIV.D10CounselReturningClient',
    title: 'Counsel Returning Client',
    step: 5,
    description: 'Counselling for returning clients',
    category: 'counselling',
  },
  {
    id: 'HIV.D12DetermineRecommendedScreeningsAndTests',
    title: 'Determine Recommended Screenings and Tests',
    step: 6,
    description: 'Recommend appropriate screenings and tests',
    category: 'planning',
  },
  {
    id: 'HIV.D15DetermineWhoClinicalStaging',
    title: 'Determine WHO Clinical Staging',
    step: 7,
    description: 'Assess WHO clinical staging',
    category: 'assessment',
  },
  {
    id: 'HIV.D25OfferVoluntaryPartnerAndFamilyServices',
    title: 'Offer Voluntary Partner and Family Services',
    step: 8,
    description: 'Partner and family services',
    category: 'services',
  },
];

export const HIVCareVisitWithSmartForms: React.FC<HIVCareVisitWithSmartFormsProps> = ({
  enrollment,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useNotification();
  const cdssConfig = getHivCdssConfig(tenantSlug);
  const [useSmartForm, setUseSmartForm] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [latestGuidelineWarnings, setLatestGuidelineWarnings] = useState<string[]>([]);

  const handleSmartFormSuccess = async (formAnswers: Record<string, any>) => {
    // Accumulate form data
    const updatedFormData = { ...formData, ...formAnswers };
    setFormData(updatedFormData);

    // For now, just accumulate data
    // In a full implementation, you might want to submit after each form or all at once
    showSuccess('Success', 'Form data captured. Continue with next form or submit visit.');
    setSelectedFormId(null);
  };

  const submitVisit = async () => {
    try {
      setSubmitting(true);

      const visitData: any = mapSmartFormToVisit(formData);
      const guidelineValidation = validateHivVisitAgainstGuidelines(visitData, {
        mode: 'smart_form',
        isFemale: enrollment?.gender?.toLowerCase() === 'female',
        enrollmentConfirmedPositiveDate: enrollment?.date_confirmed_positive || null,
        thresholds: cdssConfig.thresholds,
      });

      if (guidelineValidation.blockingIssues.length > 0) {
        showError(
          'WHO/Zim guideline validation failed',
          guidelineValidation.blockingIssues.map((issue) => `• ${issue.message}`).join('\n'),
        );
        return;
      }

      visitData.viralLoad = guidelineValidation.normalizedViralLoad;
      setLatestGuidelineWarnings(guidelineValidation.warningIssues.map((issue) => issue.message));

      const storedUser = localStorage.getItem('ehr_user');
      const currentUser = storedUser ? JSON.parse(storedUser) : {};
      visitData.providerId = currentUser.id;

      // Submit clinical visit
      await ehrApi.createHivClinicalVisit(visitData, token, tenantSlug);

      if (guidelineValidation.warningIssues.length > 0) {
        showSuccess(
          'Visit saved with guideline flags',
          `HIV clinical visit recorded using WHO Smart Forms (${guidelineValidation.warningIssues.length} warning${guidelineValidation.warningIssues.length === 1 ? '' : 's'}).`,
        );
      } else {
        showSuccess('Success', 'HIV clinical visit recorded using WHO Smart Forms');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting visit:', error);
      showError('Error', `Failed to record visit: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const mapSmartFormToVisit = (formData: Record<string, any>): any => {
    return {
      enrollmentId: enrollment.id,
      visitDate: formData.visitDate || new Date().toISOString().split('T')[0],
      visitType: formData.visitType || 'A',
      weightKg: formData.weightKg,
      heightCm: formData.heightCm,
      bmi: formData.bmi,
      bloodPressure: formData.bloodPressure,
      pregnancyLactatingStatus: formData.pregnancyLactatingStatus,
      firstAncBookingDate: formData.firstAncBookingDate,
      deliveryDate: formData.deliveryDate,
      familyPlanningStatus: formData.familyPlanningStatus,
      functionalStatus: formData.functionalStatus,
      whoClinicalStage: formData.whoClinicalStage,
      opportunisticInfections: formData.opportunisticInfections,
      tbScreening: formData.tbScreening,
      tbInvestigationResult: formData.tbInvestigationResult,
      tbDiagnosed: formData.tbDiagnosed,
      tbDiagnosisDate: formData.tbDiagnosisDate,
      tbTreatmentStarted: formData.tbTreatmentStarted,
      cd4Count: formData.cd4Count,
      cd4Percentage: formData.cd4Percentage,
      cd4TestDate: formData.cd4TestDate,
      viralLoad: formData.viralLoad,
      viralLoadUnit: formData.viralLoadUnit,
      viralLoadTestDate: formData.viralLoadTestDate,
      viralLoadSuppressed: formData.viralLoadSuppressed,
      arvStatus: formData.arvStatus,
      arvReason: formData.arvReason,
      arvRegimenCode: formData.arvRegimenCode,
      arvRegimenName: formData.arvRegimenName,
      arvQuantityPrescribed: formData.arvQuantityPrescribed,
      arvQuantityDispensed: formData.arvQuantityDispensed,
      arvAdherencePercentage: formData.arvAdherencePercentage,
      nextReviewDate: formData.nextReviewDate,
      visitStatus: formData.visitStatus,
      visitNotes: formData.visitNotes,
      whoSmartFormData: formData,
    };
  };

  const openSmartForm = (formId: string) => {
    setSelectedFormId(formId);
  };

  if (useSmartForm && selectedFormId) {
    const selectedForm = CARE_VISIT_FORMS.find(f => f.id === selectedFormId);
    
    return (
      <>
        <WHOSmartFormIntegration
          formId={selectedFormId}
          patientId={enrollment.patient_id}
          token={token}
          tenantSlug={tenantSlug}
          onClose={() => {
            setSelectedFormId(null);
          }}
          onSuccess={handleSmartFormSuccess}
          title={selectedForm?.title}
          initialValues={formData}
        />
        {/* Form selector overlay */}
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-8 scrollbar-hide">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6">Select Form to Complete</h3>
            <div className="space-y-3">
              {CARE_VISIT_FORMS.map((form) => (
                <button
                  key={form.id}
                  onClick={() => openSmartForm(form.id)}
                  className="glass-card w-full text-left p-5 rounded-xl group transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                        {form.step}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors text-lg mb-1">
                          {form.title}
                        </p>
                        <p className="text-sm text-slate-600 mb-2">{form.description}</p>
                        <span className="inline-block text-xs px-3 py-1 glass-gradient text-slate-700 rounded-lg font-medium">
                          {form.category}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-4 pt-6 border-t border-white/20">
              <button
                onClick={() => {
                  setUseSmartForm(false);
                  setSelectedFormId(null);
                }}
                className="glass-button-secondary flex-1 px-6 py-3 text-slate-700 rounded-xl font-semibold"
              >
                Back to regular visit form
              </button>
              {Object.keys(formData).length > 0 && (
                <button
                  onClick={submitVisit}
                  disabled={submitting}
                  className="glass-button flex-1 px-6 py-3 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Visit'}
                </button>
              )}
            </div>
          </div>
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
              <h3 className="text-xl font-bold text-slate-900">WHO HIV Care Visit Workflow (optional)</h3>
              <p className="text-sm text-slate-600 mt-1">
                Optional WHO-aligned care visit steps. The regular Medicore visit form remains the main form.
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

        {/* Forms Preview */}
        {!useSmartForm && (
          <div className="mt-6 pt-6 border-t border-white/30">
            <p className="text-base font-bold text-slate-800 mb-4">Available Forms:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CARE_VISIT_FORMS.slice(0, 4).map((form) => (
                <div
                  key={form.id}
                  className="glass-card p-4 rounded-xl"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    <p className="text-base font-bold text-slate-900">{form.title}</p>
                  </div>
                  <p className="text-sm text-slate-600">{form.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {latestGuidelineWarnings.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900 mb-2">
              Last smart-form submission flagged guideline warnings
            </p>
            <ul className="list-disc pl-5 text-xs text-amber-800 space-y-1">
              {latestGuidelineWarnings.map((warning, idx) => (
                <li key={`${idx}-${warning.slice(0, 24)}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Standard Clinical Visit Modal */}
      {!useSmartForm && (
        <HIVClinicalVisitModal
          enrollment={enrollment}
          tenantSlug={tenantSlug}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
};
