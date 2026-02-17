/**
 * HIV Testing Component with WHO Smart Forms Integration
 * 
 * Integrates WHO Smart Forms into the HIV testing workflow
 */

import React, { useState } from 'react';
import { FileText, TestTube, ChevronRight } from 'lucide-react';
import { WHOSmartFormIntegration } from './WHOSmartFormIntegration';
import HIVTestingComponent from '../HIVTestingComponent';
import { useNotification } from '../GlobalNotification';
import { ehrApi } from '../../services/api';

interface HIVTestingWithSmartFormsProps {
  patientId?: string;
  tenantSlug: string;
  token: string;
  onTestComplete?: (testData: any) => void;
}

// WHO Smart Forms for HIV Testing workflow
const TESTING_FORMS = [
  {
    id: 'HIV.B1DetermineReasonForVisit',
    title: 'Determine Reason for Visit',
    stage: 'pre-test',
    description: 'Capture the reason for HIV testing visit',
  },
  {
    id: 'HIV.B6CaptureOrUpdateClientHistory',
    title: 'Capture or Update Client History',
    stage: 'pre-test',
    description: 'Record client history before testing',
  },
  {
    id: 'HIV.B7TestForHivUsingTestingAlgorithm',
    title: 'Test for HIV using Testing Algorithm',
    stage: 'testing',
    description: 'WHO-recommended HIV testing algorithm',
  },
  {
    id: 'HIV.B8ProvidePostTestCounselling',
    title: 'Provide Post-Test Counselling',
    stage: 'post-test',
    description: 'Post-test counselling and support',
  },
  {
    id: 'HIV.B20ScheduleRetest',
    title: 'Schedule Retest',
    stage: 'post-test',
    description: 'Schedule follow-up retest if needed',
  },
];

export const HIVTestingWithSmartForms: React.FC<HIVTestingWithSmartFormsProps> = ({
  patientId,
  tenantSlug,
  token,
  onTestComplete,
}) => {
  const { showSuccess, showError } = useNotification();
  const [showSmartForm, setShowSmartForm] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [useSmartForm, setUseSmartForm] = useState(false);

  const handleSmartFormSuccess = async (formData: Record<string, any>) => {
    try {
      const mappedData = mapSmartFormToHivTest(formData);

      if (patientId) {
        const storedUser = localStorage.getItem('ehr_user');
        const currentUser = storedUser ? JSON.parse(storedUser) : {};

        const payload = {
          patientId,
          testedBy: currentUser.id,
          testStage: mappedData.testStage || 'screening',
          testType: mappedData.testType || 'rapid_antibody',
          testingReason: mappedData.testingReason || 'diagnostic_symptomatic',
          testingApproach: mappedData.testingApproach || 'facility',
          testingLocation: mappedData.testingLocation || 'outpatient',
          testingCadre: mappedData.testingCadre || 'nurse',
          specimenType: mappedData.specimenType || 'whole blood',
          kitType: mappedData.kitType || 'rapid_diagnostic_test',
          testKitName: mappedData.testKitName || 'Determine HIV-1/2',
          testKitLot: mappedData.testKitLot || '',
          testKitExpiry: mappedData.testKitExpiry || null,
          dualKitUsed: mappedData.dualKitUsed ?? false,
          testResult: mappedData.testResult,
          resultValue: mappedData.resultValue || null,
          resultUnit: mappedData.resultUnit || null,
          selfTestReported: mappedData.selfTestReported ?? false,
          selfTestConfirmed: mappedData.selfTestConfirmed ?? false,
          recencyTestPerformed: mappedData.recencyTestPerformed ?? false,
          recencyResult: mappedData.recencyResult || null,
          recencyKitLot: mappedData.recencyKitLot || null,
          recencyKitExpiry: mappedData.recencyKitExpiry || null,
          partnerNotificationStatus: mappedData.partnerNotificationStatus || null,
          linkageAction: mappedData.linkageAction || null,
          linkageCompleted: mappedData.linkageCompleted ?? false,
          nextTestDueDate: mappedData.nextTestDueDate || null,
          notes: mappedData.notes || null,
          followUpActions: mappedData.followUpActions || [],
          testingContext: mappedData.testingContext || {},
          testConcept: mappedData.testConcept,
          specimenConcept: mappedData.specimenConcept,
          stis: mappedData.stis || [],
          whoSmartFormData: mappedData.whoSmartFormData || formData,
        };

        await ehrApi.createHivTest(payload, token, tenantSlug);
        showSuccess('Success', 'HIV test recorded using WHO Smart Form');
      }
      
      if (onTestComplete) {
        onTestComplete(mappedData);
      }
      
      setShowSmartForm(false);
      setSelectedFormId(null);
    } catch (error: any) {
      console.error('Error submitting HIV test:', error);
      showError('Error', `Failed to submit test: ${error.message || 'Unknown error'}`);
    }
  };

  const mapSmartFormToHivTest = (formData: Record<string, any>): any => {
    return {
      testDate: formData['HIV.B.DE110'] || new Date().toISOString().split('T')[0],
      testResult: formData['HIV.B.DE111'],
      hivStatus: formData['HIV.B.DE115'],
      testType: formData['HIV.B.DE81'],
      assayNumber: formData['HIV.B.DE88'],
      testResult1: formData['HIV.B.DE94'],
      testResult2: formData['HIV.B.DE98'],
      testResult3: formData['HIV.B.DE102'],
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
          title={TESTING_FORMS.find(f => f.id === selectedFormId)?.title}
        />
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
              <h3 className="text-xl font-bold text-slate-900">WHO HIV Testing Workflow (optional)</h3>
              <p className="text-sm text-slate-600 mt-1">
                Optional WHO-aligned testing steps. The standard Medicore HIV test remains the main form.
              </p>
            </div>
          </div>
          <button
            onClick={() => setUseSmartForm(true)}
            className="glass-button px-6 py-3 text-white rounded-xl flex items-center gap-2 font-semibold shadow-lg"
          >
            <TestTube className="w-5 h-5" />
            Open WHO Workflow
          </button>
        </div>

        {/* Quick Form Selection */}
        {useSmartForm && (
          <div className="mt-6 pt-6 border-t border-white/30">
            <p className="text-base font-bold text-slate-800 mb-4">Select Form:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TESTING_FORMS.map((form) => (
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
                      <p className="text-sm text-slate-600 mb-3">{form.description}</p>
                      <span className="inline-block text-xs px-3 py-1.5 glass-gradient text-slate-700 rounded-lg font-medium">
                        {form.stage}
                      </span>
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
              ← Back to standard HIV testing
            </button>
          </div>
        )}
      </div>

      {!useSmartForm && <HIVTestingComponent tenantSlug={tenantSlug} />}
    </div>
  );
};
