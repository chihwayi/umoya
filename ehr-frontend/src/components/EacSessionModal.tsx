import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Activity, User, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ModalPortal from './ModalPortal';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface EacSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  enrollmentId: string;
  enrollmentNumber: string;
  patientName: string;
  patientId: string;
  existingSessionsCount: number;
  latestSessionDate?: string | null;
  tenantSlug: string;
}

const EacSessionModal: React.FC<EacSessionModalProps> = ({
  open,
  onClose,
  onSuccess,
  enrollmentId,
  enrollmentNumber,
  patientName,
  patientId,
  existingSessionsCount,
  latestSessionDate,
  tenantSlug
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viralLoadSource, setViralLoadSource] = useState<'lab_system' | 'manual' | null>(null);
  const [viralLoadAutoPopulated, setViralLoadAutoPopulated] = useState(false);

  const [form, setForm] = useState({
    sessionNumber: existingSessionsCount + 1,
    sessionDate: new Date().toISOString().split('T')[0],
    counselorId: '',
    counselorName: '',
    
    // Adherence Barriers (checkboxes)
    adherenceBarriers: [] as string[],
    barriersOtherDetails: '',
    
    // Adherence Assessment
    adherencePercentageSelfReported: '',
    adherenceAssessmentMethod: '',
    
    // Interventions
    interventionsProvided: [] as string[],
    interventionsOtherDetails: '',
    medicationSimplification: false,
    adherenceToolsProvided: [] as string[],
    supportSystemsIdentified: [] as string[],
    
    // Patient Feedback
    patientFeedback: '',
    patientConcerns: '',
    patientCommitmentLevel: '',
    
    // Follow-up
    nextSessionDate: '',
    followUpActions: [] as string[],
    followUpResponsiblePerson: '',
    
    // Outcomes
    sessionOutcome: 'Completed',
    outcomeNotes: '',
    adherenceImprovementObserved: false,
    
      // Program Status
      eacProgramStatus: 'Active',
      eacCompletionDate: '',
      returnToConventionalCareDate: '',
      
      // Viral Load Monitoring (WHO Guidelines - VL testing during EAC)
      viralLoad: '',
      viralLoadUnit: 'copies/mL',
      viralLoadTestDate: '',
      viralLoadSuppressed: false,
      viralLoadImproved: false,
      
      // Notes
      sessionNotes: ''
  });
  const snomedToken = useMemo(() => localStorage.getItem('ehr_token') || '', []);
  const snomedReady = Boolean(snomedToken && tenantSlug);
  const [barrierConcepts, setBarrierConcepts] = useState<SnomedConcept[]>([]);
  const [pendingBarrierConcept, setPendingBarrierConcept] = useState<SnomedConcept | null>(null);
  const [interventionConcepts, setInterventionConcepts] = useState<SnomedConcept[]>([]);
  const [pendingInterventionConcept, setPendingInterventionConcept] = useState<SnomedConcept | null>(null);
  const [adherenceToolConcepts, setAdherenceToolConcepts] = useState<SnomedConcept[]>([]);
  const [pendingToolConcept, setPendingToolConcept] = useState<SnomedConcept | null>(null);
  const [supportConcepts, setSupportConcepts] = useState<SnomedConcept[]>([]);
  const [pendingSupportConcept, setPendingSupportConcept] = useState<SnomedConcept | null>(null);
  const [followUpConcepts, setFollowUpConcepts] = useState<SnomedConcept[]>([]);
  const [pendingFollowConcept, setPendingFollowConcept] = useState<SnomedConcept | null>(null);
  const [sessionOutcomeConcept, setSessionOutcomeConcept] = useState<SnomedConcept | null>(null);

  const addConceptToCollection = (
    concept: SnomedConcept | null,
    collection: SnomedConcept[],
    setter: (value: SnomedConcept[]) => void,
    reset: (value: SnomedConcept | null) => void,
  ) => {
    if (concept && !collection.some((item) => item.conceptId === concept.conceptId)) {
      setter([...collection, concept]);
    }
    reset(null);
  };

  const removeConceptFromCollection = (
    conceptId: string,
    collection: SnomedConcept[],
    setter: (value: SnomedConcept[]) => void,
  ) => {
    setter(collection.filter((item) => item.conceptId !== conceptId));
  };

  useEffect(() => {
    if (open) {
      loadCurrentUser();
      const todayIso = new Date().toISOString().split('T')[0];
      const minDateIso = latestSessionDate || '';
      const nextSessionDateDefault =
        minDateIso && todayIso < minDateIso ? minDateIso : todayIso;

      // Reset guarded fields based on current context
      setForm(prev => ({
        ...prev,
        sessionNumber: existingSessionsCount + 1,
        sessionDate: nextSessionDateDefault,
      }));
    }
  }, [open, existingSessionsCount, latestSessionDate]);

  // Auto-populate lab results when session date changes
  useEffect(() => {
    const loadMatchingLabResults = async () => {
      if (!form.sessionDate || !patientId) return;
      
      // Only auto-populate if VL is not already manually entered
      if (form.viralLoad && !viralLoadAutoPopulated) return;
      
      try {
        const token = localStorage.getItem('ehr_token');
        if (!token) return;

        const response = await ehrApi.getMatchingLabResults(
          patientId,
          form.sessionDate,
          token,
          tenantSlug
        );

        if (response.data?.matched && response.data.viralLoad) {
          const testDate = response.data.viralLoadTestDate 
            ? new Date(response.data.viralLoadTestDate).toISOString().split('T')[0]
            : form.sessionDate;
          
          setForm(prev => ({
            ...prev,
            viralLoad: response.data.viralLoad.toString(),
            viralLoadUnit: response.data.viralLoadUnit || 'copies/mL',
            viralLoadTestDate: testDate,
            viralLoadSuppressed: response.data.viralLoadSuppressed || false
          }));
          
          setViralLoadSource('lab_system');
          setViralLoadAutoPopulated(true);
        }
      } catch (error) {
        console.error('Failed to load matching lab results:', error);
      }
    };

    // Small delay to avoid too many calls
    const timer = setTimeout(() => {
      loadMatchingLabResults();
    }, 500);

    return () => clearTimeout(timer);
  }, [form.sessionDate, patientId]);

  const loadCurrentUser = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const profile = await ehrApi.getProfile(token, tenantSlug);
      const user = profile.data?.user || profile.data;
      setCurrentUser(user);
      
      if (user) {
        const firstName = user.firstName || user.first_name || '';
        const lastName = user.lastName || user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        setForm(prev => ({
          ...prev,
          counselorId: user.id,
          counselorName: fullName || user.name || user.email
        }));
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const validateEacSessionForm = (): string | null => {
    const expectedSessionNumber = existingSessionsCount + 1;
    if (form.sessionNumber !== expectedSessionNumber) {
      return `Session number must be ${expectedSessionNumber}.`;
    }

    if (!form.sessionDate) {
      return 'Session date is required.';
    }

    const sessionDate = new Date(form.sessionDate);
    if (Number.isNaN(sessionDate.getTime())) {
      return 'Session date is invalid.';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    sessionDate.setHours(0, 0, 0, 0);
    if (sessionDate > today) {
      return 'Session date cannot be in the future.';
    }

    if (latestSessionDate && form.sessionDate < latestSessionDate) {
      return `Session date cannot be earlier than last recorded EAC session (${latestSessionDate}).`;
    }

    if (form.nextSessionDate) {
      const nextDate = new Date(form.nextSessionDate);
      if (Number.isNaN(nextDate.getTime())) {
        return 'Next session date is invalid.';
      }
      nextDate.setHours(0, 0, 0, 0);
      if (nextDate <= sessionDate) {
        return 'Next session date must be after this session date.';
      }
    }

    if (form.eacProgramStatus === 'Completed' && !form.eacCompletionDate) {
      return 'EAC completion date is required when program status is Completed.';
    }

    if (form.eacCompletionDate) {
      const completionDate = new Date(form.eacCompletionDate);
      if (Number.isNaN(completionDate.getTime())) {
        return 'EAC completion date is invalid.';
      }
      completionDate.setHours(0, 0, 0, 0);
      if (completionDate < sessionDate) {
        return 'EAC completion date cannot be before session date.';
      }

      if (form.returnToConventionalCareDate) {
        const returnDate = new Date(form.returnToConventionalCareDate);
        if (Number.isNaN(returnDate.getTime())) {
          return 'Return to conventional care date is invalid.';
        }
        returnDate.setHours(0, 0, 0, 0);
        if (returnDate < completionDate) {
          return 'Return to conventional care date cannot be before EAC completion date.';
        }
      }
    } else if (form.returnToConventionalCareDate) {
      return 'Return to conventional care date requires EAC completion date.';
    }

    if (form.viralLoad) {
      const viralLoad = Number(form.viralLoad);
      if (!Number.isFinite(viralLoad) || viralLoad < 0) {
        return 'Viral load must be a valid non-negative number.';
      }
      if (form.viralLoadSuppressed !== (viralLoad < 1000)) {
        return 'Viral load suppression flag does not match VL threshold (<1000 copies/mL).';
      }
    }

    if (!form.counselorId || !form.counselorName.trim()) {
      return 'Counselor identity is required.';
    }

    return null;
  };

  const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
    setForm(prev => {
      const currentArray = prev[field as keyof typeof prev] as string[];
      if (checked) {
        return { ...prev, [field]: [...currentArray, value] };
      } else {
        return { ...prev, [field]: currentArray.filter(item => item !== value) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateEacSessionForm();
    if (validationError) {
      showError('Validation Error', validationError);
      return;
    }
    
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) {
        showError('Error', 'Authentication required');
        return;
      }

      setLoading(true);

      const payload = {
        enrollmentId,
        sessionNumber: form.sessionNumber,
        sessionDate: form.sessionDate,
        counselorId: form.counselorId,
        counselorName: form.counselorName,
        adherenceBarriers: form.adherenceBarriers,
        barriersOtherDetails: form.barriersOtherDetails || null,
        adherencePercentageSelfReported: form.adherencePercentageSelfReported ? parseFloat(form.adherencePercentageSelfReported) : null,
        adherenceAssessmentMethod: form.adherenceAssessmentMethod || null,
        interventionsProvided: form.interventionsProvided,
        interventionsOtherDetails: form.interventionsOtherDetails || null,
        medicationSimplification: form.medicationSimplification,
        adherenceToolsProvided: form.adherenceToolsProvided,
        supportSystemsIdentified: form.supportSystemsIdentified,
        adherenceBarrierConcepts: barrierConcepts,
        interventionConcepts,
        adherenceToolConcepts,
        supportSystemConcepts: supportConcepts,
        patientFeedback: form.patientFeedback || null,
        patientConcerns: form.patientConcerns || null,
        patientCommitmentLevel: form.patientCommitmentLevel || null,
        nextSessionDate: form.nextSessionDate || null,
        followUpActions: form.followUpActions,
        followUpActionConcepts: followUpConcepts,
        followUpResponsiblePerson: form.followUpResponsiblePerson || null,
        sessionOutcome: form.sessionOutcome,
        sessionOutcomeConcept,
        outcomeNotes: form.outcomeNotes || null,
        adherenceImprovementObserved: form.adherenceImprovementObserved,
        eacProgramStatus: form.eacProgramStatus,
        eacCompletionDate: form.eacCompletionDate || null,
        returnToConventionalCareDate: form.returnToConventionalCareDate || null,
        viralLoad: form.viralLoad ? parseFloat(form.viralLoad) : null,
        viralLoadUnit: form.viralLoadUnit || 'copies/mL',
        viralLoadTestDate: form.viralLoadTestDate || null,
        viralLoadSuppressed: form.viralLoadSuppressed,
        viralLoadImproved: form.viralLoadImproved,
        sessionNotes: form.sessionNotes || null
      };

      await ehrApi.createEacSession(payload, token, tenantSlug);
      
      showSuccess('Success', 'EAC session recorded successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save EAC session:', error);
      showError('Error', error.response?.data?.message || 'Failed to record EAC session');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const adherenceBarriersOptions = [
    'Forgetfulness',
    'Pill burden',
    'Side effects',
    'Stigma',
    'Food requirements',
    'Travel/Work schedule',
    'Cost of transport',
    'Depression',
    'Substance use',
    'Lack of family support',
    'Other'
  ];

  const interventionsOptions = [
    'Pill reminder tools',
    'Medication schedule adjustment',
    'Side effect management',
    'Family/caregiver involvement',
    'Support group referral',
    'Mental health counseling',
    'Transportation support',
    'Other'
  ];

  const adherenceToolsOptions = [
    'Pill box',
    'Mobile app',
    'Calendar',
    'SMS reminders',
    'Other'
  ];

  const supportSystemsOptions = [
    'Family member',
    'Friend',
    'Community health worker',
    'Peer support group',
    'Other'
  ];

  const followUpActionsOptions = [
    'Schedule next session',
    'Refer to doctor',
    'Refer to mental health',
    'Link to support group',
    'Home visit',
    'Phone follow-up',
    'Other'
  ];

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100001] p-4 animate-in fade-in duration-300">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-700 border-b border-emerald-200/50 px-6 py-5 rounded-t-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Record EAC Session</h3>
                  <div className="flex items-center gap-4 text-sm text-emerald-100 mt-1">
                    <div className="flex items-center gap-2"><User className="w-4 h-4" /><span>{patientName}</span></div>
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>Session {form.sessionNumber}</span></div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {snomedReady && (
            <div className="bg-white rounded-xl p-6 border border-emerald-200 space-y-6">
              <h4 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                SNOMED Structured Coding
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <SnomedConceptPicker
                    value={pendingBarrierConcept}
                    onChange={setPendingBarrierConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Adherence barrier concept"
                    placeholder="Search SNOMED CT (e.g., Transportation barrier)"
                  context="situation"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                      onClick={() =>
                        addConceptToCollection(
                          pendingBarrierConcept,
                          barrierConcepts,
                          setBarrierConcepts,
                          setPendingBarrierConcept,
                        )
                      }
                      disabled={!pendingBarrierConcept}
                    >
                      Add barrier
                    </button>
                    {barrierConcepts.length > 0 && (
                      <button
                        type="button"
                        className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                        onClick={() => setBarrierConcepts([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {barrierConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {barrierConcepts.map((concept) => (
                        <span
                          key={concept.conceptId}
                          className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800"
                        >
                          {concept.preferredTerm || concept.term}
                          <button
                            type="button"
                            className="text-emerald-500 hover:text-emerald-700"
                            onClick={() =>
                              removeConceptFromCollection(concept.conceptId, barrierConcepts, setBarrierConcepts)
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <SnomedConceptPicker
                    value={pendingInterventionConcept}
                    onChange={setPendingInterventionConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Intervention concept"
                    placeholder="Search SNOMED CT (e.g., Observed therapy for adherence)"
                  context="procedure"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                      onClick={() =>
                        addConceptToCollection(
                          pendingInterventionConcept,
                          interventionConcepts,
                          setInterventionConcepts,
                          setPendingInterventionConcept,
                        )
                      }
                      disabled={!pendingInterventionConcept}
                    >
                      Add intervention
                    </button>
                    {interventionConcepts.length > 0 && (
                      <button
                        type="button"
                        className="rounded-full border border-sky-200 px-3 py-1 text-xs font-semibold text-sky-700"
                        onClick={() => setInterventionConcepts([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {interventionConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {interventionConcepts.map((concept) => (
                        <span
                          key={concept.conceptId}
                          className="flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-800"
                        >
                          {concept.preferredTerm || concept.term}
                          <button
                            type="button"
                            className="text-sky-500 hover:text-sky-700"
                            onClick={() =>
                              removeConceptFromCollection(
                                concept.conceptId,
                                interventionConcepts,
                                setInterventionConcepts,
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <SnomedConceptPicker
                    value={pendingToolConcept}
                    onChange={setPendingToolConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Adherence tool concept"
                    placeholder="Search SNOMED CT (e.g., Medication reminder application)"
                  context="procedure"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                      onClick={() =>
                        addConceptToCollection(
                          pendingToolConcept,
                          adherenceToolConcepts,
                          setAdherenceToolConcepts,
                          setPendingToolConcept,
                        )
                      }
                      disabled={!pendingToolConcept}
                    >
                      Add tool
                    </button>
                    {adherenceToolConcepts.length > 0 && (
                      <button
                        type="button"
                        className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700"
                        onClick={() => setAdherenceToolConcepts([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {adherenceToolConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {adherenceToolConcepts.map((concept) => (
                        <span
                          key={concept.conceptId}
                          className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-800"
                        >
                          {concept.preferredTerm || concept.term}
                          <button
                            type="button"
                            className="text-indigo-500 hover:text-indigo-700"
                            onClick={() =>
                              removeConceptFromCollection(
                                concept.conceptId,
                                adherenceToolConcepts,
                                setAdherenceToolConcepts,
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <SnomedConceptPicker
                    value={pendingSupportConcept}
                    onChange={setPendingSupportConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Support system concept"
                    placeholder="Search SNOMED CT (e.g., Community health worker)"
                  context="situation"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                      onClick={() =>
                        addConceptToCollection(
                          pendingSupportConcept,
                          supportConcepts,
                          setSupportConcepts,
                          setPendingSupportConcept,
                        )
                      }
                      disabled={!pendingSupportConcept}
                    >
                      Add support
                    </button>
                    {supportConcepts.length > 0 && (
                      <button
                        type="button"
                        className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700"
                        onClick={() => setSupportConcepts([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {supportConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {supportConcepts.map((concept) => (
                        <span
                          key={concept.conceptId}
                          className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800"
                        >
                          {concept.preferredTerm || concept.term}
                          <button
                            type="button"
                            className="text-amber-500 hover:text-amber-700"
                            onClick={() =>
                              removeConceptFromCollection(
                                concept.conceptId,
                                supportConcepts,
                                setSupportConcepts,
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <SnomedConceptPicker
                    value={pendingFollowConcept}
                    onChange={setPendingFollowConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Follow-up action concept"
                    placeholder="Search SNOMED CT (e.g., Home visit)"
                  context="procedure"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                      onClick={() =>
                        addConceptToCollection(
                          pendingFollowConcept,
                          followUpConcepts,
                          setFollowUpConcepts,
                          setPendingFollowConcept,
                        )
                      }
                      disabled={!pendingFollowConcept}
                    >
                      Add follow-up
                    </button>
                    {followUpConcepts.length > 0 && (
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => setFollowUpConcepts([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {followUpConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {followUpConcepts.map((concept) => (
                        <span
                          key={concept.conceptId}
                          className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                        >
                          {concept.preferredTerm || concept.term}
                          <button
                            type="button"
                            className="text-slate-500 hover:text-slate-700"
                            onClick={() =>
                              removeConceptFromCollection(
                                concept.conceptId,
                                followUpConcepts,
                                setFollowUpConcepts,
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <SnomedConceptPicker
                  value={sessionOutcomeConcept}
                  onChange={setSessionOutcomeConcept}
                  token={snomedToken}
                  tenantSlug={tenantSlug}
                  label="Session outcome concept"
                  placeholder="Search SNOMED CT (e.g., Improved adherence)"
                context="situation"
                />
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Session Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Session Number</label>
                  <input
                    type="number"
                    value={form.sessionNumber}
                    readOnly
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-slate-50 text-slate-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Session Date *</label>
                  <input
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => setForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    min={latestSessionDate || undefined}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Counselor Name *</label>
                  <input
                    type="text"
                    value={form.counselorName}
                    readOnly
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-slate-50 text-slate-600"
                    required
                    placeholder="Auto-filled from logged-in user"
                  />
                </div>
              </div>
            </div>

            {/* Adherence Barriers */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Adherence Barriers
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {adherenceBarriersOptions.map(option => (
                  <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.adherenceBarriers.includes(option)}
                      onChange={(e) => handleCheckboxChange('adherenceBarriers', option, e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{option}</span>
                  </label>
                ))}
              </div>
              {form.adherenceBarriers.includes('Other') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Other Barriers Details</label>
                  <textarea
                    value={form.barriersOtherDetails}
                    onChange={(e) => setForm(prev => ({ ...prev, barriersOtherDetails: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={2}
                    placeholder="Specify other adherence barriers"
                  />
                </div>
              )}
            </div>

            {/* Adherence Assessment */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Adherence Assessment
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Self-Reported Adherence (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.adherencePercentageSelfReported}
                    onChange={(e) => setForm(prev => ({ ...prev, adherencePercentageSelfReported: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    placeholder="0-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Assessment Method</label>
                  <select
                    value={form.adherenceAssessmentMethod}
                    onChange={(e) => setForm(prev => ({ ...prev, adherenceAssessmentMethod: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select method</option>
                    <option value="Self-report">Self-report</option>
                    <option value="Pill count">Pill count</option>
                    <option value="Pharmacy refill">Pharmacy refill</option>
                    <option value="Viral load">Viral load</option>
                    <option value="Combined">Combined methods</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Interventions */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Interventions Provided
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {interventionsOptions.map(option => (
                  <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.interventionsProvided.includes(option)}
                      onChange={(e) => handleCheckboxChange('interventionsProvided', option, e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{option}</span>
                  </label>
                ))}
              </div>
              {form.interventionsProvided.includes('Other') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Other Interventions Details</label>
                  <textarea
                    value={form.interventionsOtherDetails}
                    onChange={(e) => setForm(prev => ({ ...prev, interventionsOtherDetails: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={2}
                    placeholder="Specify other interventions"
                  />
                </div>
              )}
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.medicationSimplification}
                    onChange={(e) => setForm(prev => ({ ...prev, medicationSimplification: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">Medication Simplification Provided</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Adherence Tools Provided</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {adherenceToolsOptions.map(option => (
                      <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.adherenceToolsProvided.includes(option)}
                          onChange={(e) => handleCheckboxChange('adherenceToolsProvided', option, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Support Systems Identified</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {supportSystemsOptions.map(option => (
                      <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.supportSystemsIdentified.includes(option)}
                          onChange={(e) => handleCheckboxChange('supportSystemsIdentified', option, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Feedback */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Patient Feedback
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Feedback</label>
                  <textarea
                    value={form.patientFeedback}
                    onChange={(e) => setForm(prev => ({ ...prev, patientFeedback: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Patient's feedback and response to counseling"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Concerns</label>
                  <textarea
                    value={form.patientConcerns}
                    onChange={(e) => setForm(prev => ({ ...prev, patientConcerns: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Any concerns raised by the patient"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Commitment Level</label>
                  <select
                    value={form.patientCommitmentLevel}
                    onChange={(e) => setForm(prev => ({ ...prev, patientCommitmentLevel: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select level</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Follow-up */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                Follow-up Actions
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Next Session Date</label>
                  <input
                    type="date"
                    value={form.nextSessionDate}
                    onChange={(e) => setForm(prev => ({ ...prev, nextSessionDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Follow-up Actions</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {followUpActionsOptions.map(option => (
                      <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.followUpActions.includes(option)}
                          onChange={(e) => handleCheckboxChange('followUpActions', option, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Responsible Person</label>
                  <input
                    type="text"
                    value={form.followUpResponsiblePerson}
                    onChange={(e) => setForm(prev => ({ ...prev, followUpResponsiblePerson: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    placeholder="Person responsible for follow-up"
                  />
                </div>
              </div>
            </div>

            {/* Viral Load Monitoring (WHO Guidelines) */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Viral Load Monitoring (During EAC)
              </h4>
              <p className="text-sm text-slate-600 mb-4">
                Per WHO guidelines, viral load should be monitored during EAC sessions to track adherence improvement.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Viral Load (copies/mL)
                    {viralLoadAutoPopulated && (
                      <span className="ml-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Auto-filled from Lab System
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.viralLoad}
                      onChange={(e) => {
                        const vl = e.target.value;
                        setForm(prev => ({
                          ...prev,
                          viralLoad: vl,
                          viralLoadSuppressed: vl ? parseFloat(vl) < 1000 : false,
                          viralLoadImproved: prev.viralLoad ? parseFloat(vl) < parseFloat(prev.viralLoad) : false
                        }));
                        // When user manually edits, mark as manual
                        if (vl !== form.viralLoad) {
                          setViralLoadSource('manual');
                          setViralLoadAutoPopulated(false);
                        }
                      }}
                      className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 ${
                        viralLoadAutoPopulated 
                          ? 'border-emerald-300 bg-emerald-50' 
                          : 'border-slate-300'
                      }`}
                      placeholder="Enter viral load result"
                    />
                    {viralLoadAutoPopulated && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, viralLoad: '' }));
                          setViralLoadSource(null);
                          setViralLoadAutoPopulated(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 hover:text-slate-900"
                        title="Clear auto-filled value"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {viralLoadAutoPopulated && (
                    <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Result matched from lab system. You can override manually if needed.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">VL Test Date</label>
                  <input
                    type="date"
                    value={form.viralLoadTestDate}
                    onChange={(e) => setForm(prev => ({ ...prev, viralLoadTestDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.viralLoadSuppressed}
                      onChange={(e) => setForm(prev => ({ ...prev, viralLoadSuppressed: e.target.checked }))}
                      disabled={form.viralLoad ? parseFloat(form.viralLoad) < 1000 : false}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">
                      Viral Load Suppressed (&lt;1000 copies/mL)
                      {form.viralLoad && parseFloat(form.viralLoad) < 1000 && (
                        <span className="ml-2 text-green-600 font-semibold">✓ Auto-checked</span>
                      )}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.viralLoadImproved}
                      onChange={(e) => setForm(prev => ({ ...prev, viralLoadImproved: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Viral Load Improved (compared to previous session)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Session Outcomes */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Session Outcomes
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Session Outcome *</label>
                  <select
                    value={form.sessionOutcome}
                    onChange={(e) => setForm(prev => ({ ...prev, sessionOutcome: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="Completed">Completed</option>
                    <option value="Partial">Partial</option>
                    <option value="Missed">Missed</option>
                    <option value="Rescheduled">Rescheduled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Outcome Notes</label>
                  <textarea
                    value={form.outcomeNotes}
                    onChange={(e) => setForm(prev => ({ ...prev, outcomeNotes: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Additional notes about the session outcome"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.adherenceImprovementObserved}
                    onChange={(e) => setForm(prev => ({ ...prev, adherenceImprovementObserved: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">Adherence Improvement Observed</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">EAC Program Status</label>
                  <select
                    value={form.eacProgramStatus}
                    onChange={(e) => setForm(prev => ({ ...prev, eacProgramStatus: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Discontinued">Discontinued</option>
                  </select>
                </div>
                {form.eacProgramStatus === 'Completed' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">EAC Completion Date</label>
                    <input
                      type="date"
                      value={form.eacCompletionDate}
                      onChange={(e) => setForm(prev => ({ ...prev, eacCompletionDate: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
                {form.eacProgramStatus === 'Completed' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Return to Conventional Care Date</label>
                    <input
                      type="date"
                      value={form.returnToConventionalCareDate}
                      onChange={(e) => setForm(prev => ({ ...prev, returnToConventionalCareDate: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Session Notes */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                Additional Notes
              </h4>
              <textarea
                value={form.sessionNotes}
                onChange={(e) => setForm(prev => ({ ...prev, sessionNotes: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                rows={4}
                placeholder="Any additional notes about this EAC session"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Session
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default EacSessionModal;
