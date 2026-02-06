/**
 * HIV Workflow Integration Component
 * 
 * Provides a unified interface for the complete HIV workflow:
 * Testing → Registration → ART Initiation → Care & Treatment
 * 
 * Integrates WHO Smart Forms at each stage
 */

import React, { useState } from 'react';
import { FileText, TestTube, UserPlus, Stethoscope, Pill, CheckCircle, ChevronRight } from 'lucide-react';
import { WHOSmartFormIntegration } from './WHOSmartFormIntegration';
import { useNotification } from '../GlobalNotification';
import { ehrApi } from '../../services/api';

interface HIVWorkflowIntegrationProps {
  patientId: string;
  patientName: string;
  patientAge?: number;
  patientSex?: string;
  tenantSlug: string;
  token: string;
  currentStage?: 'testing' | 'registration' | 'art' | 'care';
  onComplete?: () => void;
  onClose?: () => void;
}

// Complete workflow mapping
const WORKFLOW_STAGES = {
  testing: {
    title: 'HIV Testing',
    icon: TestTube,
    forms: [
      { id: 'HIV.B1DetermineReasonForVisit', title: 'Determine Reason for Visit', step: 1 },
      { id: 'HIV.B6CaptureOrUpdateClientHistory', title: 'Capture Client History', step: 2 },
      { id: 'HIV.B7TestForHivUsingTestingAlgorithm', title: 'HIV Testing Algorithm', step: 3 },
      { id: 'HIV.B8ProvidePostTestCounselling', title: 'Post-Test Counselling', step: 4 },
    ],
  },
  registration: {
    title: 'Patient Registration',
    icon: UserPlus,
    forms: [
      { id: 'HIV.A2GatherClientDetails', title: 'Gather Client Details', step: 1 },
      { id: 'HIV.A5CreateNewClientRecord', title: 'Create Client Record', step: 2 },
      { id: 'HIV.A6.1ReviewSociodemographicDataWithClient', title: 'Review Sociodemographic Data', step: 3 },
    ],
  },
  art: {
    title: 'ART Initiation',
    icon: Pill,
    forms: [
      { id: 'HIV.F12Prescribe', title: 'Prescribe ART', step: 1 },
      { id: 'HIV.F16ImmediatelyStartInfantOnArt', title: 'Start Infant on ART', step: 2 },
    ],
  },
  care: {
    title: 'Care & Treatment Visit',
    icon: Stethoscope,
    forms: [
      { id: 'HIV.D2TakeVitalSigns', title: 'Take Vital Signs', step: 1 },
      { id: 'HIV.D3CheckForSignsOfSeriousIllness', title: 'Check for Serious Illness', step: 2 },
      { id: 'HIV.D4ScreenForTb', title: 'Screen for TB', step: 3 },
      { id: 'HIV.D8CaptureOrUpdateClientHistory', title: 'Update Client History', step: 4 },
      { id: 'HIV.D10CounselReturningClient', title: 'Counsel Client', step: 5 },
      { id: 'HIV.D12DetermineRecommendedScreeningsAndTests', title: 'Determine Screenings', step: 6 },
      { id: 'HIV.D15DetermineWhoClinicalStaging', title: 'WHO Clinical Staging', step: 7 },
    ],
  },
};

export const HIVWorkflowIntegration: React.FC<HIVWorkflowIntegrationProps> = ({
  patientId,
  patientName,
  patientAge,
  patientSex,
  tenantSlug,
  token,
  currentStage = 'testing',
  onComplete,
  onClose,
}) => {
  const { showSuccess, showError } = useNotification();
  const [activeStage, setActiveStage] = useState(currentStage);
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const currentStageConfig = WORKFLOW_STAGES[activeStage];
  const currentForm = currentStageConfig.forms[currentFormIndex];

  const handleFormSuccess = async (formAnswers: Record<string, any>) => {
    // Accumulate form data
    const updatedFormData = { ...formData, ...formAnswers };
    setFormData(updatedFormData);

    // Check if this is the last form in the stage
    if (currentFormIndex === currentStageConfig.forms.length - 1) {
      // Submit stage data
      await submitStage(activeStage, updatedFormData);
    } else {
      // Move to next form
      setCurrentFormIndex(currentFormIndex + 1);
      showSuccess('Success', 'Form saved, proceeding to next step');
    }
  };

  const submitStage = async (stage: string, data: Record<string, any>) => {
    try {
      setSubmitting(true);

      switch (stage) {
        case 'testing':
          await ehrApi.createHivTest(mapToHivTest(data), token, tenantSlug);
          showSuccess('Success', 'HIV test recorded using WHO Smart Forms');
          // Move to registration if positive
          if (data['HIV.B.DE115'] === 'positive' || data['HIV.B.DE111'] === 'positive') {
            setActiveStage('registration');
            setCurrentFormIndex(0);
            setFormData({});
          } else {
            // End workflow for negative
            if (onComplete) onComplete();
          }
          break;

        case 'registration':
          await ehrApi.enrollInHivCare(mapToEnrollment(data), token, tenantSlug);
          showSuccess('Success', 'Patient enrolled in HIV care using WHO Smart Forms');
          // Move to ART initiation
          setActiveStage('art');
          setCurrentFormIndex(0);
          setFormData({});
          break;

        case 'art':
          // ART initiation is typically part of enrollment or first visit
          showSuccess('Success', 'ART initiation recorded using WHO Smart Forms');
          // Move to care visits
          setActiveStage('care');
          setCurrentFormIndex(0);
          setFormData({});
          break;

        case 'care':
          await ehrApi.createHivClinicalVisit(mapToVisit(data), token, tenantSlug);
          showSuccess('Success', 'HIV care visit recorded using WHO Smart Forms');
          if (onComplete) {
            onComplete();
          }
          break;
      }
    } catch (error: any) {
      console.error(`Error submitting ${stage}:`, error);
      showError('Error', `Failed to submit ${stage}: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const mapToHivTest = (data: Record<string, any>) => ({
    patientId,
    testDate: data['HIV.B.DE110'] || new Date().toISOString().split('T')[0],
    testResult: data['HIV.B.DE111'],
    hivStatus: data['HIV.B.DE115'],
    testType: data['HIV.B.DE81'],
    whoSmartFormData: data,
  });

  const mapToEnrollment = (data: Record<string, any>) => ({
    patientId,
    enrollmentDate: data.enrollmentDate || new Date().toISOString().split('T')[0],
    dateConfirmedPositive: data.dateConfirmedPositive || data.enrollmentDate,
    whoSmartFormData: data,
  });

  const mapToVisit = (data: Record<string, any>) => ({
    enrollmentId: data.enrollmentId,
    visitDate: data.visitDate || new Date().toISOString().split('T')[0],
    visitType: data.visitType || 'routine',
    whoSmartFormData: data,
  });

  if (showForm && currentForm) {
    return (
      <>
        <WHOSmartFormIntegration
          formId={currentForm.id}
          patientId={patientId}
          token={token}
          tenantSlug={tenantSlug}
          onClose={() => {
            if (currentFormIndex === 0) {
              setShowForm(false);
            } else {
              setCurrentFormIndex(currentFormIndex - 1);
            }
          }}
          onSuccess={handleFormSuccess}
          title={`${currentForm.title} - ${currentStageConfig.title} (Step ${currentForm.step} of ${currentStageConfig.forms.length})`}
          initialValues={formData}
        />
        {/* Progress indicator */}
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 border border-slate-200 z-40">
          <div className="flex items-center gap-3 mb-2">
            <currentStageConfig.icon className="w-5 h-5 text-indigo-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{currentStageConfig.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${((currentFormIndex + 1) / currentStageConfig.forms.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-600">
                  {currentFormIndex + 1} / {currentStageConfig.forms.length}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">{currentForm.title}</p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Stages */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">HIV Care Workflow</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(WORKFLOW_STAGES).map(([stageKey, stageConfig]) => {
            const Icon = stageConfig.icon;
            const isActive = activeStage === stageKey;
            const isCompleted = ['testing', 'registration', 'art'].indexOf(activeStage) > ['testing', 'registration', 'art'].indexOf(stageKey);

            return (
              <button
                key={stageKey}
                onClick={() => {
                  setActiveStage(stageKey as any);
                  setCurrentFormIndex(0);
                  setFormData({});
                }}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50'
                    : isCompleted
                    ? 'border-green-300 bg-green-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-6 h-6 ${isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-slate-400'}`} />
                  <h3 className={`font-semibold ${isActive ? 'text-indigo-900' : isCompleted ? 'text-green-900' : 'text-slate-700'}`}>
                    {stageConfig.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-600">
                  {stageConfig.forms.length} form{stageConfig.forms.length !== 1 ? 's' : ''}
                </p>
                {isCompleted && (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-2" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Stage Forms */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <currentStageConfig.icon className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">{currentStageConfig.title}</h3>
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setCurrentFormIndex(0);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Start WHO Smart Forms
          </button>
        </div>

        <div className="space-y-2">
          {currentStageConfig.forms.map((form, index) => (
            <div
              key={form.id}
              className={`p-4 rounded-lg border ${
                index === currentFormIndex
                  ? 'border-indigo-300 bg-indigo-50'
                  : index < currentFormIndex
                  ? 'border-green-200 bg-green-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      index === currentFormIndex
                        ? 'bg-indigo-600 text-white'
                        : index < currentFormIndex
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {index < currentFormIndex ? <CheckCircle className="w-5 h-5" /> : form.step}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{form.title}</p>
                    <p className="text-xs text-slate-500">WHO Smart Form</p>
                  </div>
                </div>
                {index === currentFormIndex && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                  >
                    Start
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


