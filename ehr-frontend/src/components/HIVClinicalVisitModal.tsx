import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Save, Calendar, Activity, AlertCircle, AlertTriangle, CheckCircle, Book, Brain } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import HIVQuickReferenceGuide from './HIVQuickReferenceGuide';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';
import { getHivCdssConfig } from './HIV/hivCdssConfig';
import { validateHivVisitAgainstGuidelines } from './HIV/hivVisitGuidelineValidation';

interface HIVClinicalVisitModalProps {
  enrollment: any;
  onClose: () => void;
  onSuccess: () => void;
  tenantSlug: string;
}

const HIVClinicalVisitModal: React.FC<HIVClinicalVisitModalProps> = ({
  enrollment,
  onClose,
  onSuccess,
  tenantSlug
}) => {
  const { showSuccess, showError } = useNotification();
  const cdssConfig = getHivCdssConfig(tenantSlug);
  const [loading, setLoading] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookups, setLookups] = useState<any>({});
  const [visitDecisionContext, setVisitDecisionContext] = useState<any | null>(null);
  const [loadingVisitDecisionContext, setLoadingVisitDecisionContext] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [lastVisitNextReviewDate, setLastVisitNextReviewDate] = useState<string | null>(null);
  const [hasStartedArv, setHasStartedArv] = useState(false);
  const [lastInitiatedRegimenCode, setLastInitiatedRegimenCode] = useState<string | null>(null);
  const [lastInitiatedRegimenName, setLastInitiatedRegimenName] = useState<string | null>(null);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [approvedArvChange, setApprovedArvChange] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [eacEligibility, setEacEligibility] = useState<any>(null);
  const [showEacModal, setShowEacModal] = useState(false);
  const [showQuickReference, setShowQuickReference] = useState(false);
  const [viralLoadSource, setViralLoadSource] = useState<'lab_system' | 'manual' | null>(null);
  const [viralLoadAutoPopulated, setViralLoadAutoPopulated] = useState(false);
  const [visitVitalsAutoPopulatedDate, setVisitVitalsAutoPopulatedDate] = useState<string | null>(null);
  const [visitVitalsManualOverrideDate, setVisitVitalsManualOverrideDate] = useState<string | null>(null);
  const [sameDayVitalsRefreshing, setSameDayVitalsRefreshing] = useState(false);
  const [sameDayVitalsLastSyncedAt, setSameDayVitalsLastSyncedAt] = useState<string | null>(null);
  const [labOrderCreated, setLabOrderCreated] = useState(false);
  const [creatingLabOrder, setCreatingLabOrder] = useState(false);
  const [visitPreparationChecklist, setVisitPreparationChecklist] = useState<any>(null);
  const [monitoringSchedules, setMonitoringSchedules] = useState<any[]>([]);
  const [tptEligibilityStatus, setTptEligibilityStatus] = useState<any>(null);
  const [tptCompletionStatus, setTptCompletionStatus] = useState<any>(null);
  const [copilotDecisionNote, setCopilotDecisionNote] = useState('');
  const [copilotDecisionSaving, setCopilotDecisionSaving] = useState(false);
  const snomedToken = useMemo(() => localStorage.getItem('ehr_token') || '', []);
  const snomedReady = Boolean(snomedToken && tenantSlug);
  const [visitReasonConceptSelection, setVisitReasonConceptSelection] = useState<SnomedConcept | null>(null);
  const [opportunisticConcepts, setOpportunisticConcepts] = useState<SnomedConcept[]>([]);
  const [pendingOpportunisticConcept, setPendingOpportunisticConcept] = useState<SnomedConcept | null>(null);
  const [tbScreeningConceptSelection, setTbScreeningConceptSelection] = useState<SnomedConcept | null>(null);
  const [pendingTbInvestigationConcept, setPendingTbInvestigationConcept] = useState<SnomedConcept | null>(null);
  const [tbInvestigationConcepts, setTbInvestigationConcepts] = useState<SnomedConcept[]>([]);
  const [arvReasonConceptSelection, setArvReasonConceptSelection] = useState<SnomedConcept | null>(null);
  const [arvRegimenConceptSelection, setArvRegimenConceptSelection] = useState<SnomedConcept | null>(null);
  const [pendingAdverseEventConcept, setPendingAdverseEventConcept] = useState<SnomedConcept | null>(null);
  const [adverseEventConcepts, setAdverseEventConcepts] = useState<SnomedConcept[]>([]);
  const [pendingFollowUpConcept, setPendingFollowUpConcept] = useState<SnomedConcept | null>(null);
  const [followUpConcepts, setFollowUpConcepts] = useState<SnomedConcept[]>([]);
  const [mentalHealthResultConcept, setMentalHealthResultConcept] = useState<SnomedConcept | null>(null);
  const [mentalHealthManagementConcept, setMentalHealthManagementConcept] = useState<SnomedConcept | null>(null);
  const [referralReasonConceptSelection, setReferralReasonConceptSelection] = useState<SnomedConcept | null>(null);
  
  // Determine if patient is female (for reproductive health step)
  const isFemale = enrollment?.gender?.toLowerCase() === 'female';
  
  // Calculate patient age from date of birth
  const calculateAge = (dateOfBirth: string | null | undefined): number | null => {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  
  const dsdModelLabels: { [key: string]: string } = {
    conventional: 'Conventional clinic visit',
    fast_track: 'Fast track (drug collection)',
    group_dsd: 'Group DSD (CARG/club)',
  };

  const vlPathwayStatusLabel = (status: string | undefined) => {
    if (!status) return 'Unknown viral load status';
    const map: { [key: string]: string } = {
      no_vl: 'No viral load on record',
      not_on_art: 'Not yet on ART – VL monitoring not applicable',
      vl_missing_on_art: 'On ART but VL not done – collect VL sample',
      suppressed: 'Virally suppressed (VL < 1000 copies/mL)',
      post_eac_suppressed: 'Suppressed after EAC – continue DSD as per protocol',
      high_vl: 'Unsuppressed (VL ≥ 1000) – assess adherence and consider EAC',
      high_vl_needs_eac: 'Two high VLs – start or intensify EAC',
      high_vl_on_eac: 'High VL while in EAC – repeat VL and review regimen',
      failure_after_eac: 'Possible treatment failure after EAC – consider switch',
    };
    return map[status] || 'Unknown viral load status';
  };

  const patientAge = calculateAge(enrollment?.date_of_birth);
  const isChild = patientAge !== null && patientAge <= 15;

  const getCurrentUserDisplayName = (user: any): string => {
    const firstName = (user?.first_name || user?.firstName || '').toString().trim();
    const lastName = (user?.last_name || user?.lastName || '').toString().trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;

    return (
      user?.full_name ||
      user?.fullName ||
      user?.display_name ||
      user?.displayName ||
      user?.name ||
      user?.username ||
      user?.email ||
      ''
    )
      .toString()
      .trim();
  };
  
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

  // Filter regimens based on age
  const filteredRegimens = lookups.artRegimens?.filter((regimen: any) => {
    if (isChild) {
      return regimen.category === 'Paediatric';
    } else {
      return regimen.category === 'Adult';
    }
  }) || [];

  // Form state - comprehensive visit data
  const [form, setForm] = useState({
    // Step 1: Visit Basics
    visitNumber: 1,
    visitDate: new Date().toISOString().split('T')[0],
    visitType: '',
    
    // Step 2: Vitals & Measurements
    weightKg: '',
    heightCm: '',
    bmi: '',
    bmiClassification: '',
    bloodPressure: '',
    
    // Step 3: Reproductive Health
    pregnancyLactatingStatus: '',
    firstAncBookingDate: '',
    deliveryDate: '',
    familyPlanningStatus: [] as string[],
    
    // Step 4: Clinical Status
    functionalStatus: '',
    whoClinicalStage: '',
    opportunisticInfections: [] as string[],
    oiSubCategories: {} as { [key: string]: string },
    mentalHealthResult: '',
    mentalHealthManagement: '',
    
    // Step 5: TB & TPT
    tbScreening: '',
    tbInvestigationResult: '',
    tbInvestigationXpertMtbRif: '',
    tbInvestigationUltraLfLam: '',
    tbInvestigationTstChildren: '',
    tptEligibility: '',
    tptStatus: '',
    tptQuantityDispensed: '',
    tptAdherencePercentage: '',
    cotrimoxazoleQuantityDispensed: '',
    cotrimoxazoleAdherencePercentage: '',
    fluconazoleQuantityPrescribed: '',
    fluconazoleQuantityDispensed: '',
    
    // Step 6: ARV & Lab Results
    arvStatus: '',
    arvInitiationCategory: '',
    arvReasonNotOn: '',
    arvReasonStart: '',
    arvChangeStopReason: '',
    arvRegimenCode: '',
    arvRegimenName: '',
    arvDurationPrescribed: '',
    arvQuantityPrescribed: '',
    arvQuantityDispensed: '',
    arvAdherencePercentage: '',
    adverseEventsStatus: [] as string[],
    
    // Lab Results
    cd4Count: '',
    cd4Percentage: '',
    cd4TestDate: '',
    viralLoad: '',
    viralLoadUnit: 'copies/mL',
    viralLoadSampleCollectedDate: '',
    viralLoadResultReceivedDate: '',
    viralLoadTestDate: '',
    
    // Cryptococcal
    cryptococcalSigns: '',
    cryptococcalStatus: '',
    cryptococcalCsfInvestigationDone: false,
    cryptococcalPreemptiveTreatmentResult: false,
    cryptococcalTreatment: '',
    
    // Cervical Cancer
    cervicalCancerHpvTestResult: '',
    cervicalCancerViacResult: '',
    cervicalCancerTreatment: '',
    
    // Follow-up
    nextReviewDate: '',
    visitStatus: '',
    finalOutcome: '',
    visitNotes: '',
    clinicianInitials: '',
    pharmacyDispenserInitials: ''
  });

  // Helper functions to determine field visibility based on WHO/DSD standards
  const isDrugCollectionOnly = (visitType: string) => {
    // Visit types that are drug collection only (no clinical assessment)
    // B: Sent Care Giver, D: Cross Border Transport, G: Fast Track, J: OFCAD, K: Private Pharmacy
    return ['B', 'D', 'G', 'J', 'K'].includes(visitType);
  };

  const isDSDModel = (visitType: string) => {
    // Differentiated Service Delivery models (limited clinical, periodic full assessment)
    // E: CARG, F: Clubs
    return ['E', 'F'].includes(visitType);
  };

  const isMinimalClinical = (visitType: string) => {
    // Visit types with minimal clinical assessment (mainly documentation)
    // C: Visit at another clinic, L: Other
    return ['C', 'L'].includes(visitType);
  };

  const requiresFullClinical = (visitType: string) => {
    // Visit types requiring full clinical assessment
    // A: Present Self (conventional), H: Outreach, I: Drop in Centre
    return ['A', 'H', 'I'].includes(visitType);
  };

  const shouldShowClinicalFields = () => {
    if (!form.visitType) return true; // Show all by default until visit type selected
    return !isDrugCollectionOnly(form.visitType) && !isMinimalClinical(form.visitType);
  };

  const shouldShowLimitedClinical = () => {
    if (!form.visitType) return false;
    return isDSDModel(form.visitType);
  };

  const shouldShowFullClinical = () => {
    if (!form.visitType) return true;
    return requiresFullClinical(form.visitType);
  };

  const visitGuidelineValidation = useMemo(
    () =>
      validateHivVisitAgainstGuidelines(form, {
        mode: 'clinical_form',
        isFemale,
        isFirstVisit,
        hasStartedArv,
        approvedArvChange: Boolean(approvedArvChange),
        eacNeedsIntervention: Boolean(eacEligibility?.needsEac),
        eacIsActive: Boolean(eacEligibility?.activeEac),
        vlPathwayStatus: visitDecisionContext?.vlPathway?.status || null,
        vlPathwayOverdue: Boolean(visitDecisionContext?.vlPathway?.overdue),
        dsdEligible:
          typeof visitDecisionContext?.dsdStatus?.eligibleForDsd === 'boolean'
            ? visitDecisionContext?.dsdStatus?.eligibleForDsd
            : undefined,
        dsdRecommendedModel: visitDecisionContext?.dsdStatus?.recommendedModel || null,
        enrollmentConfirmedPositiveDate: enrollment?.date_confirmed_positive || null,
        thresholds: cdssConfig.thresholds,
      }),
    [
      form,
      isFemale,
      isFirstVisit,
      hasStartedArv,
      approvedArvChange,
      eacEligibility,
      visitDecisionContext,
      enrollment?.date_confirmed_positive,
      cdssConfig.thresholds,
    ],
  );

  useEffect(() => {
    loadLookupData();
    loadVisitCount();
    loadCurrentUser();
    checkEacEligibility();
    loadVisitPreparationChecklist();
    loadVisitDecisionContext();
  }, []);

  const loadVisitPreparationChecklist = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      // Load monitoring schedules
      const schedulesRes = await ehrApi.getMonitoringSchedules(enrollment.id, token, tenantSlug);
      const schedules = schedulesRes.data.schedules || [];
      setMonitoringSchedules(schedules);

      // Build checklist
      const checklist: any = {
        overdueTests: schedules.filter((s: any) => {
          const nextDate = new Date(s.next_scheduled_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return nextDate < today;
        }),
        dueSoonTests: schedules.filter((s: any) => {
          const nextDate = new Date(s.next_scheduled_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntil >= 0 && daysUntil <= 7;
        }),
        pendingLabResults: [],
        lastVisitNotes: null,
        adherenceConcerns: null as any
      };

      // Load last visit for notes
      try {
        const visitsRes = await ehrApi.getHivClinicalVisits(enrollment.id, token, tenantSlug);
        const visits = visitsRes.data.visits || [];
        if (visits.length > 0) {
          checklist.lastVisitNotes = visits[0].visit_notes;
        }
      } catch (error) {
        console.error('Failed to load visits for checklist:', error);
      }

      // Load adherence data
      try {
        const adherenceRes = await ehrApi.getAdherenceTracking(enrollment.id, token, tenantSlug);
        const adherence = adherenceRes.data.tracking || [];
        if (adherence.length > 0 && adherence[0].adherence_percentage < 95) {
          checklist.adherenceConcerns = {
            percentage: adherence[0].adherence_percentage,
            date: adherence[0].tracking_date
          };
        }
      } catch (error) {
        console.error('Failed to load adherence for checklist:', error);
      }

      setVisitPreparationChecklist(checklist);

      // Load TPT eligibility and completion status
      try {
        const tptEligibilityRes = await ehrApi.checkTptEligibility(enrollment.id, token, tenantSlug);
        setTptEligibilityStatus(tptEligibilityRes.data);

        const tptCompletionRes = await ehrApi.getTptCompletionStatus(enrollment.id, token, tenantSlug);
        setTptCompletionStatus(tptCompletionRes.data);
      } catch (error) {
        console.error('Failed to load TPT status:', error);
      }
    } catch (error) {
      console.error('Failed to load visit preparation checklist:', error);
    }
  };

  const loadVisitDecisionContext = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoadingVisitDecisionContext(true);

      const [vlPathwayRes, dsdStatusRes] = await Promise.all([
        ehrApi.getVlPathway(enrollment.id, token, tenantSlug),
        ehrApi.getDsdStatus(enrollment.id, token, tenantSlug)
      ]);

      setVisitDecisionContext({
        vlPathway: vlPathwayRes.data,
        dsdStatus: dsdStatusRes.data
      });
    } catch (error) {
      console.error('Failed to load visit decision context:', error);
    } finally {
      setLoadingVisitDecisionContext(false);
    }
  };

  const handleVisitCopilotDecision = async (decision: 'accept' | 'modify' | 'reject') => {
    if (!visitDecisionContext) {
      return;
    }
    try {
      setCopilotDecisionSaving(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) {
        showError('Error', 'Authentication required');
        return;
      }

      const vl = visitDecisionContext.vlPathway || {};
      const dsd = visitDecisionContext.dsdStatus || {};

      const summaryParts: string[] = [];

      if (vl.lastVlValue !== null && vl.lastVlValue !== undefined) {
        const vlDate = vl.lastVlDate || 'unknown date';
        const vlUnit = vl.lastVlUnit || 'copies/mL';
        summaryParts.push(`Last VL ${vl.lastVlValue} ${vlUnit} on ${vlDate}`);
      }

      if (dsd.currentModel) {
        summaryParts.push(`Current model ${dsd.currentModel}`);
      }

      if (dsd.recommendedModel) {
        summaryParts.push(`Recommended model ${dsd.recommendedModel}`);
      }

      if (Array.isArray(dsd.reasons) && dsd.reasons.length > 0) {
        summaryParts.push(`Reasons: ${dsd.reasons.join('; ')}`);
      }

      const recommendationSummary =
        summaryParts.join(' | ') || 'HIV visit copilot decision';

      await ehrApi.recordCopilotAction(
        {
          copilotType: 'hiv_visit',
          decision,
          reason: copilotDecisionNote || undefined,
          patientId: enrollment.patient_id,
          recommendationSummary,
          context: {
            vlPathway: vl,
            dsdStatus: dsd,
          },
        },
        token,
        tenantSlug,
      );

      showSuccess('Decision Captured', `Visit copilot suggestion marked as ${decision}.`);
      if (decision === 'accept') {
        setCopilotDecisionNote('');
      }
    } catch (error) {
      console.error('Failed to record visit copilot decision', error);
      showError('Error', 'Failed to capture visit copilot decision');
    } finally {
      setCopilotDecisionSaving(false);
    }
  };

  const loadCurrentUser = () => {
    try {
      const userStr = localStorage.getItem('ehr_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUserRole(user.role || '');
        const displayName = getCurrentUserDisplayName(user);
        if (displayName) {
          setForm((prev) =>
            prev.clinicianInitials
              ? prev
              : {
                  ...prev,
                  clinicianInitials: displayName,
                },
          );
        }
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const checkEacEligibility = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.checkEacEligibility(enrollment.id, token, tenantSlug);
      setEacEligibility(response.data);
      if (response.data?.needsEac) {
        // Will show alert/notification in UI
      }
    } catch (error) {
      console.error('Failed to check EAC eligibility:', error);
    }
  };

  const loadVisitCount = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.getHivVisitCount(enrollment.id, token, tenantSlug);
      if (response.data?.nextVisitNumber) {
        const visitNumber = response.data.nextVisitNumber;
        setForm(prev => ({ ...prev, visitNumber }));
        setIsFirstVisit(visitNumber === 1);
      }
      if (response.data?.lastVisitNextReviewDate) {
        setLastVisitNextReviewDate(response.data.lastVisitNextReviewDate);
      }
      if (response.data?.hasStartedArv !== undefined) {
        setHasStartedArv(response.data.hasStartedArv);
      }
      if (response.data?.lastInitiatedRegimenCode) {
        setLastInitiatedRegimenCode(response.data.lastInitiatedRegimenCode);
        setLastInitiatedRegimenName(response.data.lastInitiatedRegimenName);
      }
      
      // Check for approved ARV change request
      await loadApprovedArvChange();
    } catch (error) {
      console.error('Failed to load visit count:', error);
      // Default to 1 if error
      setForm(prev => ({ ...prev, visitNumber: 1 }));
      setIsFirstVisit(true);
    }
  };

  const loadApprovedArvChange = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.getApprovedArvChange(enrollment.id, token, tenantSlug);
      if (response.data) {
        setApprovedArvChange(response.data);
        // Auto-populate ARV status to '4' (Change) and lock the approved regimen
        setForm(prev => ({
          ...prev,
          arvStatus: '4', // Auto-set to Change status
          arvRegimenCode: response.data.requested_regimen_code,
          arvRegimenName: response.data.requested_regimen_name
        }));
      }
    } catch (error) {
      console.error('Failed to load approved ARV change:', error);
    }
  };

  const loadLookupData = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoadingLookups(true);
      
      // Load all lookup tables in parallel
      const [
        visitTypes, bmiClassifications, pregnancyStatus, familyPlanning,
        functionalStatus, tbScreeningStatus, tbInvestigationResults,
        opportunisticInfections, mentalHealthResults, mentalHealthManagement,
        tptEligibility, tptStatus, cryptococcalSigns, cryptococcalStatus,
        cryptococcalTreatment, arvStatus, artInitiationCategory,
        adverseEvents, arvReasonsNotOn, arvReasonsStart, arvChangeStopReasons,
        visitStatus, finalOutcome, artRegimens, precancerousTreatment
      ] = await Promise.all([
        ehrApi.getHivLookupData('visit_types', {}, token, tenantSlug),
        ehrApi.getHivLookupData('bmi_classifications', {}, token, tenantSlug),
        ehrApi.getHivLookupData('pregnancy_lactating_status', {}, token, tenantSlug),
        ehrApi.getHivLookupData('family_planning_methods', {}, token, tenantSlug),
        ehrApi.getHivLookupData('functional_status', {}, token, tenantSlug),
        ehrApi.getHivLookupData('tb_screening_status', {}, token, tenantSlug),
        ehrApi.getHivLookupData('tb_investigation_results', {}, token, tenantSlug),
        ehrApi.getHivLookupData('opportunistic_infections', {}, token, tenantSlug),
        ehrApi.getHivLookupData('mental_health_results', {}, token, tenantSlug),
        ehrApi.getHivLookupData('mental_health_management', {}, token, tenantSlug),
        ehrApi.getHivLookupData('tpt_eligibility', {}, token, tenantSlug),
        ehrApi.getHivLookupData('tpt_status', {}, token, tenantSlug),
        ehrApi.getHivLookupData('cryptococcal_signs', {}, token, tenantSlug),
        ehrApi.getHivLookupData('cryptococcal_status', {}, token, tenantSlug),
        ehrApi.getHivLookupData('cryptococcal_treatment', {}, token, tenantSlug),
        ehrApi.getHivLookupData('arv_status', {}, token, tenantSlug),
        ehrApi.getHivLookupData('art_initiation_category', {}, token, tenantSlug),
        ehrApi.getHivLookupData('adverse_events_status', {}, token, tenantSlug),
        ehrApi.getHivLookupData('arv_reasons_not_on', {}, token, tenantSlug),
        ehrApi.getHivLookupData('arv_reasons_start', {}, token, tenantSlug),
        ehrApi.getHivLookupData('arv_change_stop_reasons', {}, token, tenantSlug),
        ehrApi.getHivLookupData('visit_status', {}, token, tenantSlug),
        ehrApi.getHivLookupData('final_outcome', {}, token, tenantSlug),
        ehrApi.getHivLookupData('art_regimens', {}, token, tenantSlug),
        ehrApi.getHivLookupData('precancerous_lesion_treatment', {}, token, tenantSlug)
      ]);

      setLookups({
        visitTypes: visitTypes.data.data || [],
        bmiClassifications: bmiClassifications.data.data || [],
        pregnancyStatus: pregnancyStatus.data.data || [],
        familyPlanning: familyPlanning.data.data || [],
        functionalStatus: functionalStatus.data.data || [],
        tbScreeningStatus: tbScreeningStatus.data.data || [],
        tbInvestigationResults: tbInvestigationResults.data.data || [],
        opportunisticInfections: opportunisticInfections.data.data || [],
        mentalHealthResults: mentalHealthResults.data.data || [],
        mentalHealthManagement: mentalHealthManagement.data.data || [],
        tptEligibility: tptEligibility.data.data || [],
        tptStatus: tptStatus.data.data || [],
        cryptococcalSigns: cryptococcalSigns.data.data || [],
        cryptococcalStatus: cryptococcalStatus.data.data || [],
        cryptococcalTreatment: cryptococcalTreatment.data.data || [],
        arvStatus: arvStatus.data.data || [],
        artInitiationCategory: artInitiationCategory.data.data || [],
        adverseEvents: adverseEvents.data.data || [],
        arvReasonsNotOn: arvReasonsNotOn.data.data || [],
        arvReasonsStart: arvReasonsStart.data.data || [],
        arvChangeStopReasons: arvChangeStopReasons.data.data || [],
        visitStatus: visitStatus.data.data || [],
        finalOutcome: finalOutcome.data.data || [],
        artRegimens: artRegimens.data.data || [],
        precancerousTreatment: precancerousTreatment.data.data || []
      });
    } catch (error) {
      console.error('Failed to load lookup data:', error);
      showError('Error', 'Failed to load form options');
    } finally {
      setLoadingLookups(false);
    }
  };

  const handleSubmit = async () => {
    if (visitGuidelineValidation.blockingIssues.length > 0) {
      showError(
        'Guideline validation failed',
        visitGuidelineValidation.blockingIssues.map((issue) => `• ${issue.message}`).join('\n'),
      );
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) {
        showError('Error', 'Authentication required');
        return;
      }

      const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
      const normalizedViralLoad = visitGuidelineValidation.normalizedViralLoad;

      const visitData = {
        enrollmentId: enrollment.id,
        visitNumber: form.visitNumber,
        visitDate: form.visitDate,
        visitType: form.visitType,
        providerId: currentUser.id,
        visitReasonConcept: visitReasonConceptSelection,
        
        // Vitals
        weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
        heightCm: form.heightCm ? parseFloat(form.heightCm) : null,
        bmi: form.bmi ? parseFloat(form.bmi) : null,
        bloodPressure: form.bloodPressure || null,
        
        // Reproductive Health
        pregnancyLactatingStatus: form.pregnancyLactatingStatus || null,
        firstAncBookingDate: form.firstAncBookingDate || null,
        deliveryDate: form.deliveryDate || null,
        familyPlanningStatus: form.familyPlanningStatus,
        
        // Clinical Status
        functionalStatus: form.functionalStatus || null,
        whoClinicalStage: form.whoClinicalStage ? parseInt(form.whoClinicalStage) : null,
        opportunisticInfections: form.opportunisticInfections,
        opportunisticInfectionConcepts: opportunisticConcepts,
        
        // TB
        tbScreening: form.tbScreening || null,
        tbInvestigationResult: form.tbInvestigationResult || null,
        tbInvestigationXpertMtbRif: form.tbInvestigationXpertMtbRif || null,
        tbInvestigationUltraLfLam: form.tbInvestigationUltraLfLam || null,
        tbInvestigationTstChildren: form.tbInvestigationTstChildren || null,
        tbScreeningConcept: tbScreeningConceptSelection,
        tbInvestigationConcepts,
        
        // TPT
        tptEligibility: form.tptEligibility || null,
        tptStatus: form.tptStatus || null,
        tptQuantityDispensed: form.tptQuantityDispensed ? parseInt(form.tptQuantityDispensed) : null,
        tptAdherencePercentage: form.tptAdherencePercentage ? parseInt(form.tptAdherencePercentage) : null,
        
        // Prophylaxis
        cotrimoxazoleQuantityDispensed: form.cotrimoxazoleQuantityDispensed ? parseInt(form.cotrimoxazoleQuantityDispensed) : null,
        cotrimoxazoleAdherencePercentage: form.cotrimoxazoleAdherencePercentage ? parseInt(form.cotrimoxazoleAdherencePercentage) : null,
        fluconazoleQuantityPrescribed: form.fluconazoleQuantityPrescribed ? parseInt(form.fluconazoleQuantityPrescribed) : null,
        fluconazoleQuantityDispensed: form.fluconazoleQuantityDispensed ? parseInt(form.fluconazoleQuantityDispensed) : null,
        
        // ARV
        arvStatus: form.arvStatus || null,
        arvInitiationCategoryCode: form.arvInitiationCategory || null,
        arvReasonNotOnCode: form.arvReasonNotOn || null,
        arvReasonStartCode: form.arvReasonStart || null,
        arvChangeStopReasonCode: form.arvChangeStopReason || null,
        arvRegimenCode: form.arvRegimenCode || null,
        arvRegimenName: form.arvRegimenName || null,
        arvReasonConcept: arvReasonConceptSelection,
        arvRegimenConcept: arvRegimenConceptSelection,
        arvDurationPrescribed: form.arvDurationPrescribed || null,
        arvQuantityPrescribed: form.arvQuantityPrescribed ? parseInt(form.arvQuantityPrescribed) : null,
        arvQuantityDispensed: form.arvQuantityDispensed ? parseInt(form.arvQuantityDispensed) : null,
        arvAdherencePercentage: form.arvAdherencePercentage ? parseInt(form.arvAdherencePercentage) : null,
        adverseEventsStatus: form.adverseEventsStatus,
        adverseEventConcepts,
        
        // Lab Results
        cd4Count: form.cd4Count ? parseInt(form.cd4Count) : null,
        cd4Percentage: form.cd4Percentage ? parseFloat(form.cd4Percentage) : null,
        cd4TestDate: form.cd4TestDate || null,
        viralLoad: normalizedViralLoad,
        viralLoadUnit: form.viralLoadUnit,
        viralLoadSampleCollectedDate: form.viralLoadSampleCollectedDate || null,
        viralLoadResultReceivedDate: form.viralLoadResultReceivedDate || null,
        viralLoadTestDate: form.viralLoadTestDate || null,
        
        // Cryptococcal
        cryptococcalSignsCode: form.cryptococcalSigns || null,
        cryptococcalStatusCode: form.cryptococcalStatus || null,
        cryptococcalCsfInvestigationDone: form.cryptococcalCsfInvestigationDone,
        cryptococcalPreemptiveTreatmentResult: form.cryptococcalPreemptiveTreatmentResult,
        cryptococcalTreatmentCode: form.cryptococcalTreatment || null,
        
        // Cervical Cancer
        cervicalCancerHpvTestResult: form.cervicalCancerHpvTestResult || null,
        cervicalCancerViacResult: form.cervicalCancerViacResult || null,
        cervicalCancerTreatmentCode: form.cervicalCancerTreatment || null,
        
        // Mental Health
        mentalHealthResultCode: form.mentalHealthResult || null,
        mentalHealthManagementCode: form.mentalHealthManagement || null,
        mentalHealthResultConcept,
        mentalHealthManagementConcept,
        
        // Follow-up
        nextReviewDate: form.nextReviewDate || null,
        visitStatus: form.visitStatus || null,
        finalOutcome: form.finalOutcome || null,
        visitNotes: form.visitNotes || null,
        clinicianInitials: form.clinicianInitials || null,
        pharmacyDispenserInitials: form.pharmacyDispenserInitials || null,
        followUpActionConcepts: followUpConcepts,
        referralReasonConcept: referralReasonConceptSelection
      };

      await ehrApi.createHivClinicalVisit(visitData, token, tenantSlug);
      
      // Check EAC eligibility after saving visit with viral load
      if (
        normalizedViralLoad !== null &&
        normalizedViralLoad >= cdssConfig.thresholds.highViralLoad
      ) {
        await checkEacEligibility();
        const updatedEligibility = await ehrApi.checkEacEligibility(enrollment.id, token, tenantSlug);
        if (updatedEligibility.data?.needsEac) {
          showSuccess('Success', 'Clinical visit recorded. Patient requires EAC (Enhanced Adherence Counseling) due to high viral load.');
        } else {
          showSuccess('Success', 'Clinical visit recorded successfully');
        }
      } else {
        showSuccess('Success', 'Clinical visit recorded successfully');
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save visit:', error);
      showError('Error', error.response?.data?.message || 'Failed to record clinical visit');
    } finally {
      setLoading(false);
    }
  };

  // Calculate BMI when weight or height changes
  useEffect(() => {
    if (form.weightKg && form.heightCm) {
      const weight = parseFloat(form.weightKg);
      const height = parseFloat(form.heightCm) / 100; // Convert cm to meters
      if (weight > 0 && height > 0) {
        const bmi = (weight / (height * height)).toFixed(1);
        setForm(prev => ({ ...prev, bmi }));
        
        // Auto-select BMI classification
        const classification = lookups.bmiClassifications?.find((cat: any) => {
          const min = cat.min_bmi || 0;
          const max = cat.max_bmi || 999;
          return parseFloat(bmi) >= min && parseFloat(bmi) <= max;
        });
        if (classification) {
          setForm(prev => ({ ...prev, bmiClassification: classification.code }));
        }
      }
    }
  }, [form.weightKg, form.heightCm, lookups.bmiClassifications]);

  // Auto-calculate Next Review Date based on ARV Quantity Dispensed (1 ARV = 1 day)
  useEffect(() => {
    if (form.visitDate && form.arvQuantityDispensed) {
      const quantity = parseFloat(form.arvQuantityDispensed);
      if (quantity > 0) {
        const visitDate = new Date(form.visitDate);
        const nextReviewDate = new Date(visitDate);
        nextReviewDate.setDate(nextReviewDate.getDate() + quantity);
        
        // Format as YYYY-MM-DD for date input
        const formattedDate = nextReviewDate.toISOString().split('T')[0];
        setForm(prev => ({ ...prev, nextReviewDate: formattedDate }));
      }
    }
  }, [form.visitDate, form.arvQuantityDispensed]);

  // Auto-determine Visit Status based on comparison with last visit's next review date
  useEffect(() => {
    if (form.visitDate && lastVisitNextReviewDate) {
      const currentVisitDate = new Date(form.visitDate);
      const expectedReviewDate = new Date(lastVisitNextReviewDate);
      
      // Calculate difference in days
      const diffTime = currentVisitDate.getTime() - expectedReviewDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let status = '';
      
      if (diffDays < -3) {
        // More than 3 days early
        status = 'E'; // Earlier than review date
      } else if (diffDays >= -3 && diffDays <= 3) {
        // Within 3 days (on time or slightly early/late)
        status = 'OT'; // On time
      } else if (diffDays > 3 && diffDays < 28) {
        // Late but less than 28 days
        status = 'L'; // Late but not defaulter
      } else if (diffDays >= 28) {
        // 28 days or more late
        status = 'D'; // Default<28days (Defaulter)
      }
      
      if (status) {
        setForm(prev => ({ ...prev, visitStatus: status }));
      }
    }
  }, [form.visitDate, lastVisitNextReviewDate]);

  // Auto-populate viral load from lab results when visit date changes
  useEffect(() => {
    const loadMatchingLabResults = async () => {
      // Only try to match if visit date is set and we haven't manually overridden
      if (!form.visitDate) {
        return;
      }

      // Skip if user has explicitly marked as manual override
      if (viralLoadSource === 'manual') {
        return;
      }

      try {
        const token = localStorage.getItem('ehr_token');
        if (!token) return;

        console.log('🔍 Fetching matching lab results for patient:', enrollment.patient_id, 'visit date:', form.visitDate);

        const response = await ehrApi.getMatchingLabResults(
          enrollment.patient_id,
          form.visitDate,
          token,
          tenantSlug
        );

        console.log('📊 Lab results matching response:', response.data);

        if (response.data?.matched && response.data.viralLoad !== null) {
          console.log('✅ Auto-populating viral load:', response.data.viralLoad);
          setForm(prev => ({
            ...prev,
            viralLoad: response.data.viralLoad?.toString() || '',
            viralLoadUnit: response.data.viralLoadUnit || 'copies/mL',
            viralLoadTestDate: response.data.viralLoadTestDate ? new Date(response.data.viralLoadTestDate).toISOString().split('T')[0] : ''
          }));
          setViralLoadSource('lab_system');
          setViralLoadAutoPopulated(true);
        } else {
          console.log('❌ No matching lab results found');
          // No match found, reset if it was previously auto-populated
          if (viralLoadAutoPopulated && viralLoadSource === 'lab_system') {
            setForm(prev => ({
              ...prev,
              viralLoad: '',
              viralLoadUnit: 'copies/mL',
              viralLoadTestDate: ''
            }));
            setViralLoadAutoPopulated(false);
            setViralLoadSource(null);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load matching lab results:', error);
        // Don't show error to user, just log it
      }
    };

    loadMatchingLabResults();
  }, [form.visitDate, enrollment.patient_id]);

  const loadSameDayVitals = useCallback(
    async (options?: { force?: boolean; showLoading?: boolean }) => {
      const force = options?.force === true;
      const showLoading = options?.showLoading === true;

      if (!form.visitDate) {
        return;
      }

      // Respect manual edits for the current visit date.
      if (visitVitalsManualOverrideDate === form.visitDate) {
        return;
      }

      // Avoid repeat fetch once current date has been hydrated unless forced (manual refresh/polling).
      if (!force && visitVitalsAutoPopulatedDate === form.visitDate) {
        return;
      }

      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      if (showLoading) {
        setSameDayVitalsRefreshing(true);
      }

      try {
        const response = await ehrApi.getVitals(enrollment.patient_id, token, tenantSlug, {
          limit: 50,
        });

        const vitals = Array.isArray(response.data?.vitals)
          ? response.data.vitals
          : Array.isArray(response.data)
            ? response.data
            : [];

        const toIsoDate = (raw: any): string | null => {
          if (!raw) return null;
          const parsed = new Date(raw);
          if (Number.isNaN(parsed.getTime())) return null;
          return parsed.toISOString().split('T')[0];
        };

        const toTimestamp = (vital: any) => {
          const raw =
            vital.recordedAt ||
            vital.recorded_at ||
            vital.createdAt ||
            vital.created_at ||
            vital.updatedAt ||
            vital.updated_at;
          const parsed = raw ? new Date(raw).getTime() : 0;
          return Number.isNaN(parsed) ? 0 : parsed;
        };

        const sameDayVitals = vitals
          .filter((vital: any) => {
            const vitalDate = toIsoDate(
              vital.recordedAt ||
                vital.recorded_at ||
                vital.createdAt ||
                vital.created_at ||
                vital.measurementDate ||
                vital.measurement_date ||
                vital.date
            );
            return vitalDate === form.visitDate;
          })
          .sort((a: any, b: any) => toTimestamp(b) - toTimestamp(a));

        const latestSameDayVitals = sameDayVitals[0];

        if (latestSameDayVitals) {
          const resolvedWeight = latestSameDayVitals.weight ?? latestSameDayVitals.weightKg;
          const resolvedHeight = latestSameDayVitals.height ?? latestSameDayVitals.heightCm;
          const resolvedBloodPressure =
            latestSameDayVitals.bloodPressure ||
            latestSameDayVitals.blood_pressure ||
            ((latestSameDayVitals.bloodPressureSystolic !== undefined ||
              latestSameDayVitals.bloodPressureDiastolic !== undefined) &&
            (latestSameDayVitals.bloodPressureSystolic !== null ||
              latestSameDayVitals.bloodPressureDiastolic !== null)
              ? `${latestSameDayVitals.bloodPressureSystolic ?? '--'}/${latestSameDayVitals.bloodPressureDiastolic ?? '--'}`
              : '');

          setForm((prev) => ({
            ...prev,
            weightKg:
              resolvedWeight !== null && resolvedWeight !== undefined
                ? String(resolvedWeight)
                : prev.weightKg,
            heightCm:
              resolvedHeight !== null && resolvedHeight !== undefined
                ? String(resolvedHeight)
                : prev.heightCm,
            bloodPressure: resolvedBloodPressure ? String(resolvedBloodPressure) : prev.bloodPressure,
          }));
          setVisitVitalsAutoPopulatedDate(form.visitDate);
        } else if (visitVitalsAutoPopulatedDate) {
          // Clear stale auto-populated vitals when no same-day nurse vitals are available.
          setForm((prev) => ({
            ...prev,
            weightKg: '',
            heightCm: '',
            bloodPressure: '',
          }));
          setVisitVitalsAutoPopulatedDate(null);
        }

        setSameDayVitalsLastSyncedAt(new Date().toISOString());
      } catch (error) {
        console.error('Failed to load same-day vitals for visit form:', error);
      } finally {
        if (showLoading) {
          setSameDayVitalsRefreshing(false);
        }
      }
    },
    [
      form.visitDate,
      enrollment.patient_id,
      tenantSlug,
      visitVitalsManualOverrideDate,
      visitVitalsAutoPopulatedDate,
    ],
  );

  // Initial/date-change hydration for same-day nurse vitals
  useEffect(() => {
    loadSameDayVitals();
  }, [loadSameDayVitals]);

  // Live refresh while vitals step is active
  useEffect(() => {
    if (activeStep !== 2 || !form.visitDate) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadSameDayVitals({ force: true });
    }, 45000);

    return () => window.clearInterval(intervalId);
  }, [activeStep, form.visitDate, loadSameDayVitals]);

  // Handle manual override of viral load
  const handleViralLoadChange = (value: string) => {
    setForm(prev => ({ ...prev, viralLoad: value }));
    // If user manually edits, mark as manual override
    if (viralLoadAutoPopulated) {
      setViralLoadSource('manual');
      setViralLoadAutoPopulated(false);
    }
  };

  const handleVisitVitalFieldChange = (
    field: 'weightKg' | 'heightCm' | 'bloodPressure',
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (form.visitDate) {
      setVisitVitalsManualOverrideDate(form.visitDate);
      if (visitVitalsAutoPopulatedDate === form.visitDate) {
        setVisitVitalsAutoPopulatedDate(null);
      }
    }
  };

  if (loadingLookups) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-4">
            <Activity className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-slate-700">Loading form data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-white">Record Clinical Visit</h2>
            <p className="text-sm text-emerald-100">
              {enrollment.first_name} {enrollment.last_name} - Visit #{form.visitNumber}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQuickReference(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-semibold transition-colors text-sm"
              title="Quick Reference Guide"
            >
              <Book className="w-4 h-4" />
              Reference
            </button>
            <button onClick={onClose} className="text-white hover:text-emerald-100">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {eacEligibility?.needsEac && (
          <div className="mx-6 mt-4 mb-6 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl p-6 shadow-2xl border-4 border-red-400 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-12 h-12 text-white animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                  ⚠️ URGENT: Patient Requires Enhanced Adherence Counseling (EAC)
                </h3>
                <p className="text-lg mb-3 text-red-50">
                  This patient has 2 consecutive high viral loads (&gt;1000 copies/mL) and requires EAC intervention per WHO guidelines.
                </p>
                {eacEligibility.recentVisits && eacEligibility.recentVisits.length >= 2 && (
                  <div className="bg-white/20 rounded-lg p-4 mb-3">
                    <p className="font-semibold mb-2 text-white">Recent High Viral Loads:</p>
                    <div className="space-y-1">
                      {eacEligibility.recentVisits.map((visit: any, idx: number) => (
                        <p key={idx} className="text-white">
                          Visit {idx + 1}: VL = <span className="font-bold">{visit.viral_load} copies/mL</span> on{' '}
                          {new Date(visit.visit_date).toLocaleDateString()}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <p className="text-sm text-red-100 self-center flex-1">
                    💡 <strong>Action Required:</strong> After recording this visit, ensure EAC sessions are scheduled and documented. 
                    Check the EAC tab in patient details to record EAC sessions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {eacEligibility?.activeEac && !eacEligibility?.needsEac && (
          <div className="mx-6 mt-4 mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6 shadow-xl border-2 border-blue-400">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Activity className="w-12 h-12 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-3">
                  📋 Patient is in Active EAC Program
                </h3>
                <p className="text-base mb-3 text-blue-50">
                  This patient is currently undergoing Enhanced Adherence Counseling. Continue monitoring adherence and viral load during EAC sessions.
                </p>
                {eacEligibility.eacProgram && (
                  <div className="bg-white/20 rounded-lg p-4 mb-3">
                    <p className="font-semibold mb-2 text-white">EAC Program Details:</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-white">
                        <span className="font-semibold">Status:</span> {eacEligibility.eacProgram.eac_program_status || 'Active'}
                      </p>
                      {eacEligibility.eacProgram.eac_start_date && (
                        <p className="text-white">
                          <span className="font-semibold">Started:</span> {new Date(eacEligibility.eacProgram.eac_start_date).toLocaleDateString()}
                        </p>
                      )}
                      {eacEligibility.eacProgram.sessions_completed !== undefined && (
                        <p className="text-white">
                          <span className="font-semibold">Sessions Completed:</span> {eacEligibility.eacProgram.sessions_completed} 
                          {eacEligibility.eacProgram.sessions_completed < 3 && (
                            <span className="ml-2 text-yellow-200">(Target: 3-6 sessions per WHO guidelines)</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <p className="text-sm text-blue-100 self-center flex-1">
                    💡 <strong>Continue EAC:</strong> Ensure EAC sessions are being conducted regularly. 
                    Monitor viral load during sessions to track adherence improvement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {visitDecisionContext && (
          <div className="mx-6 mt-4 mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-2 rounded-xl bg-emerald-600 text-white">
                <Brain className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-emerald-900 mb-1">
                  Visit Copilot: Stability and DSD context
                </h3>
                <p className="text-xs text-emerald-800 mb-3">
                  Generated from viral load history, adherence, and visit patterns. Use as decision support only.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-800">
                  <div>
                    <p className="font-semibold text-slate-900">Viral load pathway</p>
                    <p>
                      Status:{' '}
                      <span className="font-medium">
                        {vlPathwayStatusLabel(visitDecisionContext.vlPathway?.status)}
                      </span>
                    </p>
                    {visitDecisionContext.vlPathway?.lastVlValue !== null &&
                      visitDecisionContext.vlPathway?.lastVlValue !== undefined && (
                        <p>
                          Last VL {visitDecisionContext.vlPathway.lastVlValue}{' '}
                          {visitDecisionContext.vlPathway.lastVlUnit || 'copies/mL'} on{' '}
                          {visitDecisionContext.vlPathway.lastVlDate || 'unknown date'}
                        </p>
                      )}
                    {visitDecisionContext.vlPathway?.nextVlDate && (
                      <p>
                        Next VL due {visitDecisionContext.vlPathway.nextVlDate}{' '}
                        {visitDecisionContext.vlPathway.overdue ? '(overdue)' : ''}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">DSD model</p>
                    <p>
                      Current:{' '}
                      <span className="font-medium">
                        {dsdModelLabels[visitDecisionContext.dsdStatus?.currentModel] ||
                          visitDecisionContext.dsdStatus?.currentModel ||
                          'unknown'}
                      </span>
                    </p>
                    {visitDecisionContext.dsdStatus?.eligibleForDsd && (
                      <p>
                        Eligible for DSD. Recommended model:{' '}
                        <span className="font-medium">
                          {dsdModelLabels[visitDecisionContext.dsdStatus.recommendedModel] ||
                            visitDecisionContext.dsdStatus.recommendedModel ||
                            'conventional'}
                        </span>
                      </p>
                    )}
                    {Array.isArray(visitDecisionContext.dsdStatus?.reasons) &&
                      visitDecisionContext.dsdStatus.reasons.length > 0 && (
                        <p>
                          Key factors:{' '}
                          {visitDecisionContext.dsdStatus.reasons.join('; ')}
                        </p>
                      )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Copilot decision</p>
                    <input
                      type="text"
                      value={copilotDecisionNote}
                      onChange={(e) => setCopilotDecisionNote(e.target.value)}
                      placeholder="Optional reason for modify/reject"
                      className="w-full mb-2 px-3 py-2 rounded-md border border-emerald-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={copilotDecisionSaving}
                        onClick={() => handleVisitCopilotDecision('accept')}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={copilotDecisionSaving}
                        onClick={() => handleVisitCopilotDecision('modify')}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        Modify
                      </button>
                      <button
                        type="button"
                        disabled={copilotDecisionSaving}
                        onClick={() => handleVisitCopilotDecision('reject')}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {loadingVisitDecisionContext && !visitDecisionContext && (
          <div className="mx-6 mt-4 mb-6 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-600 animate-spin" />
            <p className="text-xs text-emerald-900">Preparing visit context for decision support...</p>
          </div>
        )}

        <div className="px-6 py-4 border-b border-slate-200">
          {(() => {
            // For drug collection visits, only show steps 1 and 6
            if (isDrugCollectionOnly(form.visitType)) {
              return (
                <>
                  <div className="flex items-center justify-between">
                    {[1, 6].map((step) => {
                      const isActive = activeStep === step;
                      const isCompleted = activeStep > step;
                      return (
                        <div key={step} className="flex items-center flex-1">
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                            isActive || isCompleted
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {step === 6 ? (isFemale ? 6 : 5) : step}
                          </div>
                          {step < 6 && (
                            <div className={`flex-1 h-1 mx-2 ${
                              isCompleted ? 'bg-emerald-600' : 'bg-slate-200'
                            }`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-600">
                    {[1, 6].map((step) => (
                      <div key={step} className="flex items-center flex-1">
                        <span className="w-10 text-center">
                          {step === 1 ? '1. Basics' : `${isFemale ? '6' : '5'}. ARV & Labs`}
                        </span>
                        {step < 6 && <span className="flex-1 mx-2"></span>}
                      </div>
                    ))}
                  </div>
                </>
              );
            }
            
            // For regular visits, show all steps (excluding step 3 for non-females)
            const steps = [1, 2, 3, 4, 5, 6].filter(step => isFemale || step !== 3);
            const labels: { [key: number]: string } = isFemale 
              ? {
                  1: '1. Basics',
                  2: '2. Vitals',
                  3: '3. Reproductive',
                  4: '4. Clinical',
                  5: '5. TB & TPT',
                  6: '6. ARV & Labs'
                }
              : {
                  1: '1. Basics',
                  2: '2. Vitals',
                  4: '3. Clinical',
                  5: '4. TB & TPT',
                  6: '5. ARV & Labs'
                };
            
            return (
              <>
                <div className="flex items-center justify-between">
                  {steps.map((step, index) => {
                    const displayStep = isFemale ? step : (step > 3 ? step - 1 : step);
                    const isActive = activeStep === step;
                    const isCompleted = activeStep > step;
                    const isLastStep = index === steps.length - 1;
                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                          isActive || isCompleted
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {displayStep}
                        </div>
                        {!isLastStep && (
                          <div className={`flex-1 h-1 mx-2 ${
                            isCompleted ? 'bg-emerald-600' : 'bg-slate-200'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-600">
                  {steps.map((step, index) => {
                    const isLastStep = index === steps.length - 1;
                    return (
                      <div key={step} className="flex items-center flex-1">
                        <span className="w-10 text-center">{labels[step]}</span>
                        {!isLastStep && <span className="flex-1 mx-2"></span>}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>

        {/* Form Content */}
        <div className="p-6">
          {/* Step 1: Visit Basics */}
          {activeStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Step 1: Visit Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Visit Number
                  </label>
                  <input
                    type="number"
                    value={form.visitNumber}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Auto-calculated based on existing visits</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Visit Date *
                  </label>
                  <input
                    type="date"
                    value={form.visitDate}
                    onChange={(e) => setForm(prev => ({ ...prev, visitDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Visit Type *
                  </label>
                  <select
                    value={form.visitType}
                    onChange={(e) => {
                      const newVisitType = e.target.value;
                      setForm(prev => ({ ...prev, visitType: newVisitType }));
                      // If drug collection visit, skip to ARV step
                      if (isDrugCollectionOnly(newVisitType) && activeStep < (isFemale ? 6 : 6)) {
                        // Skip to ARV step (last step)
                        setTimeout(() => setActiveStep(isFemale ? 6 : 6), 100);
                      }
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select visit type</option>
                    {lookups.visitTypes?.map((type: any) => (
                      <option key={type.code} value={type.code}>
                        {type.code} - {type.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {snomedReady && (
                <div className="rounded-2xl border border-emerald-100 bg-white/70 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-emerald-900 mb-3">
                    SNOMED Context
                  </p>
                  <SnomedConceptPicker
                    value={visitReasonConceptSelection}
                    onChange={setVisitReasonConceptSelection}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Structured visit reason"
                    placeholder="Search SNOMED CT (e.g., Routine HIV follow-up)"
                    helperText="Optional coded reason improves interoperability and CDSS triggers."
                  context="encounter"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Vitals & Measurements */}
          {activeStep === 2 && shouldShowClinicalFields() && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Step 2: Vital Signs & Measurements</h3>

              {form.visitDate && (
                <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-600">
                    {sameDayVitalsLastSyncedAt
                      ? `Same-day vitals sync: ${new Date(sameDayVitalsLastSyncedAt).toLocaleTimeString()}`
                      : 'Same-day vitals sync pending'}
                  </p>
                  <button
                    type="button"
                    onClick={() => loadSameDayVitals({ force: true, showLoading: true })}
                    disabled={sameDayVitalsRefreshing}
                    className="inline-flex items-center justify-center rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {sameDayVitalsRefreshing ? 'Refreshing...' : 'Refresh nurse vitals'}
                  </button>
                </div>
              )}

              {visitVitalsAutoPopulatedDate === form.visitDate && (
                <div
                  data-testid="same-day-vitals-autofill-note"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                  Same-day nurse vitals were auto-filled for this visit. You can still edit values if needed.
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.weightKg}
                    onChange={(e) => handleVisitVitalFieldChange('weightKg', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Height (cm) - for &lt;15 years
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.heightCm}
                    onChange={(e) => handleVisitVitalFieldChange('heightCm', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    BMI (calculated)
                  </label>
                  <input
                    type="text"
                    value={form.bmi || 'Auto-calculated'}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    BMI Classification
                  </label>
                  <select
                    value={form.bmiClassification}
                    onChange={(e) => setForm(prev => ({ ...prev, bmiClassification: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select classification</option>
                    {lookups.bmiClassifications?.map((cat: any) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.code} - {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Blood Pressure (mmHg)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 120/80"
                    value={form.bloodPressure}
                    onChange={(e) => handleVisitVitalFieldChange('bloodPressure', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
              {snomedReady && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-4">
                  <p className="text-sm font-semibold text-emerald-900">SNOMED Clinical Coding</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <SnomedConceptPicker
                        value={pendingOpportunisticConcept}
                        onChange={setPendingOpportunisticConcept}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="Opportunistic infection concept"
                        placeholder="Search SNOMED CT (e.g., Oral candidiasis)"
                        helperText="Add precise codes for each recorded opportunistic infection."
                      context="condition"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                          onClick={() =>
                            addConceptToCollection(
                              pendingOpportunisticConcept,
                              opportunisticConcepts,
                              setOpportunisticConcepts,
                              setPendingOpportunisticConcept,
                            )
                          }
                          disabled={!pendingOpportunisticConcept}
                        >
                          Add concept
                        </button>
                        {opportunisticConcepts.length > 0 && (
                          <button
                            type="button"
                            className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                            onClick={() => setOpportunisticConcepts([])}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      {opportunisticConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {opportunisticConcepts.map((concept) => (
                            <span
                              key={concept.conceptId}
                              className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-emerald-800 shadow-sm"
                            >
                              {concept.preferredTerm || concept.term}
                              <button
                                type="button"
                                className="text-emerald-500 hover:text-emerald-700"
                                onClick={() =>
                                  removeConceptFromCollection(
                                    concept.conceptId,
                                    opportunisticConcepts,
                                    setOpportunisticConcepts,
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
                    <div className="space-y-4">
                      <SnomedConceptPicker
                        value={mentalHealthResultConcept}
                        onChange={setMentalHealthResultConcept}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="Mental health result concept"
                        placeholder="Search SNOMED CT (e.g., Anxiety disorder)"
                      context="condition"
                      />
                      <SnomedConceptPicker
                        value={mentalHealthManagementConcept}
                        onChange={setMentalHealthManagementConcept}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="Mental health management concept"
                        placeholder="Search SNOMED CT (e.g., Cognitive behavioral therapy)"
                      context="procedure"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Reproductive Health - Only for females */}
          {activeStep === 3 && isFemale && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Step 3: Reproductive Health</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pregnancy & Breast-feeding Status
                  </label>
                  <select
                    value={form.pregnancyLactatingStatus}
                    onChange={(e) => setForm(prev => ({ ...prev, pregnancyLactatingStatus: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select status</option>
                    {lookups.pregnancyStatus?.map((status: any) => (
                      <option key={status.code} value={status.code}>
                        {status.code} - {status.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date of 1st ANC Booking
                  </label>
                  <input
                    type="date"
                    value={form.firstAncBookingDate}
                    onChange={(e) => setForm(prev => ({ ...prev, firstAncBookingDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={form.deliveryDate}
                    onChange={(e) => setForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Family Planning Status (multiple response)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {lookups.familyPlanning?.map((method: any) => (
                    <label key={method.code} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.familyPlanningStatus.includes(method.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm(prev => ({
                              ...prev,
                              familyPlanningStatus: [...prev.familyPlanningStatus, method.code]
                            }));
                          } else {
                            setForm(prev => ({
                              ...prev,
                              familyPlanningStatus: prev.familyPlanningStatus.filter((c: string) => c !== method.code)
                            }));
                          }
                        }}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-700">
                        {method.code} - {method.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Clinical Status */}
          {activeStep === (isFemale ? 4 : 4) && shouldShowClinicalFields() && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Step {isFemale ? 4 : 3}: Clinical Status</h3>
              {!shouldShowFullClinical() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>DSD Model Visit:</strong> Limited clinical assessment. Full clinical assessment recommended at next conventional visit.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Functional Status
                  </label>
                  <select
                    value={form.functionalStatus}
                    onChange={(e) => setForm(prev => ({ ...prev, functionalStatus: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select status</option>
                    {lookups.functionalStatus?.map((status: any) => (
                      <option key={status.code} value={status.code}>
                        {status.code} - {status.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    WHO Clinical Stage (1-4)
                  </label>
                  <select
                    value={form.whoClinicalStage}
                    onChange={(e) => setForm(prev => ({ ...prev, whoClinicalStage: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select stage</option>
                    <option value="1">Stage 1</option>
                    <option value="2">Stage 2</option>
                    <option value="3">Stage 3</option>
                    <option value="4">Stage 4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Opportunistic Infections & Other Problems (multiple response)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-4">
                  {lookups.opportunisticInfections?.map((oi: any) => (
                    <label key={oi.code} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.opportunisticInfections.includes(oi.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm(prev => ({
                              ...prev,
                              opportunisticInfections: [...prev.opportunisticInfections, oi.code]
                            }));
                          } else {
                            setForm(prev => ({
                              ...prev,
                              opportunisticInfections: prev.opportunisticInfections.filter((c: string) => c !== oi.code)
                            }));
                          }
                        }}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-700">
                        {oi.code} - {oi.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Mental Health Screening Result
                  </label>
                  <select
                    value={form.mentalHealthResult}
                    onChange={(e) => setForm(prev => ({ ...prev, mentalHealthResult: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select result</option>
                    {lookups.mentalHealthResults?.map((result: any) => (
                      <option key={result.code} value={result.code}>
                        {result.code} - {result.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Mental Health Management
                  </label>
                  <select
                    value={form.mentalHealthManagement}
                    onChange={(e) => setForm(prev => ({ ...prev, mentalHealthManagement: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select management</option>
                    {lookups.mentalHealthManagement?.map((mgmt: any) => (
                      <option key={mgmt.code} value={mgmt.code}>
                        {mgmt.code} - {mgmt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: TB & TPT */}
          {activeStep === (isFemale ? 5 : 5) && shouldShowClinicalFields() && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Step {isFemale ? 5 : 4}: TB Status & Tuberculosis Preventive Therapy</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">TB Screening</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      TB Screening Status
                    </label>
                    <select
                      value={form.tbScreening}
                      onChange={(e) => setForm(prev => ({ ...prev, tbScreening: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select status</option>
                      {lookups.tbScreeningStatus?.map((status: any) => (
                        <option key={status.code} value={status.code}>
                          {status.code} - {status.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      TB Investigation Result
                    </label>
                    <select
                      value={form.tbInvestigationResult}
                      onChange={(e) => setForm(prev => ({ ...prev, tbInvestigationResult: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select result</option>
                      {lookups.tbInvestigationResults?.map((result: any) => (
                        <option key={result.code} value={result.code}>
                          {result.code} - {result.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Xpert MTB/Rif
                    </label>
                    <input
                      type="text"
                      value={form.tbInvestigationXpertMtbRif}
                      onChange={(e) => setForm(prev => ({ ...prev, tbInvestigationXpertMtbRif: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      (Ultra)LF-LAM
                    </label>
                    <input
                      type="text"
                      value={form.tbInvestigationUltraLfLam}
                      onChange={(e) => setForm(prev => ({ ...prev, tbInvestigationUltraLfLam: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      TST (Children)
                    </label>
                    <input
                      type="text"
                      value={form.tbInvestigationTstChildren}
                      onChange={(e) => setForm(prev => ({ ...prev, tbInvestigationTstChildren: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              {snomedReady && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4 space-y-4">
                  <p className="text-sm font-semibold text-blue-900">SNOMED TB Coding</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SnomedConceptPicker
                      value={tbScreeningConceptSelection}
                      onChange={setTbScreeningConceptSelection}
                      token={snomedToken}
                      tenantSlug={tenantSlug}
                      label="TB screening concept"
                      placeholder="Search SNOMED CT (e.g., Tuberculosis symptom screening)"
                      context="procedure"
                    />
                    <div className="space-y-2">
                      <SnomedConceptPicker
                        value={pendingTbInvestigationConcept}
                        onChange={setPendingTbInvestigationConcept}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="TB investigation concept"
                        placeholder="Search SNOMED CT (e.g., GeneXpert MTB/RIF assay)"
                      context="procedure"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                          onClick={() =>
                            addConceptToCollection(
                              pendingTbInvestigationConcept,
                              tbInvestigationConcepts,
                              setTbInvestigationConcepts,
                              setPendingTbInvestigationConcept,
                            )
                          }
                          disabled={!pendingTbInvestigationConcept}
                        >
                          Add investigation
                        </button>
                        {tbInvestigationConcepts.length > 0 && (
                          <button
                            type="button"
                            className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700"
                            onClick={() => setTbInvestigationConcepts([])}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      {tbInvestigationConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {tbInvestigationConcepts.map((concept) => (
                            <span
                              key={concept.conceptId}
                              className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-blue-800 shadow-sm"
                            >
                              {concept.preferredTerm || concept.term}
                              <button
                                type="button"
                                className="text-blue-500 hover:text-blue-700"
                                onClick={() =>
                                  removeConceptFromCollection(
                                    concept.conceptId,
                                    tbInvestigationConcepts,
                                    setTbInvestigationConcepts,
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
                  </div>
                </div>
              )}

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">Tuberculosis Preventive Therapy (TPT)</h4>
                  {tptEligibilityStatus && (
                    <span className={`px-3 py-1 rounded text-xs font-semibold ${
                      tptEligibilityStatus.isEligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tptEligibilityStatus.isEligible ? '✅ Eligible' : '❌ Not Eligible'}
                    </span>
                  )}
                </div>
                {/* TPT Eligibility Alert */}
                {tptEligibilityStatus && !tptEligibilityStatus.isEligible && tptEligibilityStatus.reason && (
                  <div className="bg-red-100 border-l-4 border-red-500 p-3 rounded mb-4">
                    <p className="text-sm text-red-800 font-semibold">{tptEligibilityStatus.reason}</p>
                    {tptEligibilityStatus.currentStatus && (
                      <p className="text-xs text-red-700 mt-1">Current Status: {tptEligibilityStatus.currentStatus}</p>
                    )}
                  </div>
                )}

                {/* TPT Completion Status */}
                {tptCompletionStatus && tptCompletionStatus.startDate && (
                  <div className="bg-blue-100 border-l-4 border-blue-500 p-3 rounded mb-4">
                    <p className="text-sm text-blue-800 font-semibold mb-2">
                      TPT Progress: {tptCompletionStatus.monthsCompleted} of 6 months completed
                    </p>
                    <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                      <div 
                        className={`h-2 rounded-full ${tptCompletionStatus.isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${(tptCompletionStatus.monthsCompleted / 6) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-700">
                      Started: {formatDateToDDMMYYYY(tptCompletionStatus.startDate)}
                      {tptCompletionStatus.expectedCompletionDate && (
                        <span className="ml-3">
                          Expected Completion: {formatDateToDDMMYYYY(tptCompletionStatus.expectedCompletionDate)}
                        </span>
                      )}
                      {tptCompletionStatus.monthsRemaining > 0 && (
                        <span className="ml-3 font-semibold">
                          {tptCompletionStatus.monthsRemaining} month{tptCompletionStatus.monthsRemaining !== 1 ? 's' : ''} remaining
                        </span>
                      )}
                    </p>
                    {tptCompletionStatus.isComplete && (
                      <p className="text-xs text-green-700 font-semibold mt-1">✅ TPT Course Completed</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      TPT Eligibility
                    </label>
                    <select
                      value={form.tptEligibility}
                      onChange={(e) => setForm(prev => ({ ...prev, tptEligibility: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select eligibility</option>
                      {lookups.tptEligibility?.map((elig: any) => (
                        <option key={elig.code} value={elig.code}>
                          {elig.code} - {elig.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      TPT Status
                    </label>
                    <select
                      value={form.tptStatus}
                      onChange={(e) => setForm(prev => ({ ...prev, tptStatus: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select status</option>
                      {lookups.tptStatus?.map((status: any) => (
                        <option key={status.code} value={status.code}>
                          {status.code} - {status.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      TPT Quantity Dispensed (tablets/ml)
                    </label>
                    <input
                      type="number"
                      value={form.tptQuantityDispensed}
                      onChange={(e) => setForm(prev => ({ ...prev, tptQuantityDispensed: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      TPT % Adherence
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.tptAdherencePercentage}
                      onChange={(e) => setForm(prev => ({ ...prev, tptAdherencePercentage: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">Prophylaxis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cotrimoxazole Quantity Dispensed
                    </label>
                    <input
                      type="number"
                      value={form.cotrimoxazoleQuantityDispensed}
                      onChange={(e) => setForm(prev => ({ ...prev, cotrimoxazoleQuantityDispensed: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cotrimoxazole % Adherence
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.cotrimoxazoleAdherencePercentage}
                      onChange={(e) => setForm(prev => ({ ...prev, cotrimoxazoleAdherencePercentage: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fluconazole Quantity Prescribed
                    </label>
                    <input
                      type="number"
                      value={form.fluconazoleQuantityPrescribed}
                      onChange={(e) => setForm(prev => ({ ...prev, fluconazoleQuantityPrescribed: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fluconazole Quantity Dispensed
                    </label>
                    <input
                      type="number"
                      value={form.fluconazoleQuantityDispensed}
                      onChange={(e) => setForm(prev => ({ ...prev, fluconazoleQuantityDispensed: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: ARV & Lab Results */}
          {activeStep === (isFemale ? 6 : 6) && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Step {isFemale ? 6 : 5}: ARV Medicine & Lab Results</h3>
              
              {/* Show message for drug collection visits */}
              {isDrugCollectionOnly(form.visitType) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Drug Collection Visit:</strong> This visit type is for medication pickup only. Clinical assessment fields are hidden per WHO DSD guidelines.
                  </p>
                </div>
              )}
              
              {/* ARV Section */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">ARV Status & Regimen</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ARV Status *
                    </label>
                    <select
                      value={form.arvStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        // If there's an approved change, prevent changing away from '4' (Change)
                        if (approvedArvChange && newStatus !== '4') {
                          showError('Cannot change ARV status', 'Doctor has approved a regimen change that must be recorded in this visit.');
                          return;
                        }
                        setForm(prev => ({ ...prev, arvStatus: newStatus }));
                        
                        // If continuing on ARV, auto-select last initiated regimen
                        if (newStatus === '3' && lastInitiatedRegimenCode) {
                          setForm(prev => ({
                            ...prev,
                            arvRegimenCode: lastInitiatedRegimenCode,
                            arvRegimenName: lastInitiatedRegimenName || ''
                          }));
                        }
                        
                        // If changing ARV, use doctor-approved regimen
                        if (newStatus === '4' && approvedArvChange) {
                          setForm(prev => ({
                            ...prev,
                            arvRegimenCode: approvedArvChange.requested_regimen_code,
                            arvRegimenName: approvedArvChange.requested_regimen_name
                          }));
                        }
                        
                        // Clear dependent fields when changing ARV status
                        if (newStatus !== '1') {
                          setForm(prev => ({ ...prev, arvReasonNotOn: '' }));
                        }
                        if (newStatus !== '2a' && newStatus !== '2b') {
                          setForm(prev => ({ ...prev, arvReasonStart: '', arvInitiationCategory: '' }));
                        }
                        if (newStatus !== '4') {
                          setForm(prev => ({ ...prev, arvChangeStopReason: '' }));
                        }
                      }}
                      disabled={approvedArvChange !== null}
                      className={`w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                        approvedArvChange !== null ? 'bg-slate-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">Select ARV status</option>
                      {lookups.arvStatus?.filter((status: any) => {
                        // First visit: Can be "No ARV" (1) or "Start ARV" (2a, 2b)
                        if (isFirstVisit) {
                          return status.code === '1' || status.code === '2a' || status.code === '2b';
                        }
                        // Subsequent visits
                        if (hasStartedArv) {
                          // If already started ARV, can only continue (3) or other statuses, but NOT start again (2a, 2b)
                          // Change (4) is only available if there's an approved change request
                          if (status.code === '4') {
                            return approvedArvChange !== null;
                          }
                          return status.code !== '2a' && status.code !== '2b';
                        } else {
                          // If never started ARV, can only be "No ARV" (1)
                          return status.code === '1';
                        }
                      }).map((status: any) => (
                        <option key={status.code} value={status.code}>
                          {status.code} - {status.name}
                        </option>
                      ))}
                    </select>
                    {isFirstVisit && (
                      <p className="text-xs text-slate-500 mt-1">
                        First visit: Can select "No ARV" or "Start ARV"
                      </p>
                    )}
                    {!isFirstVisit && hasStartedArv && (
                      <p className="text-xs text-blue-600 mt-1">
                        Patient has started ARV. Must continue on treatment. Regimen will match last initiated regimen.
                      </p>
                    )}
                    {!isFirstVisit && !hasStartedArv && (
                      <p className="text-xs text-yellow-600 mt-1">
                        Patient has not started ARV yet. Only "No ARV" status available.
                      </p>
                    )}
                    {form.arvStatus === '4' && !approvedArvChange && (
                      <p className="text-xs text-red-600 mt-1">
                        ⚠️ Change status requires doctor approval. Please ensure a doctor has approved the regimen change request before recording this visit.
                      </p>
                    )}
                    {approvedArvChange && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-semibold mb-1">
                          ✓ Doctor-Approved Regimen Change
                        </p>
                        <p className="text-xs text-green-700">
                          Approved by Dr. {approvedArvChange.approved_by_name} on {new Date(approvedArvChange.approval_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          ARV Status and Regimen are pre-filled and locked. This change must be recorded in this visit. After this visit, you can use "Continue" status for subsequent visits.
                        </p>
                      </div>
                    )}
                  </div>

                  {form.arvStatus === '2a' || form.arvStatus === '2b' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          ART Initiation Category
                        </label>
                        <select
                          value={form.arvInitiationCategory}
                          onChange={(e) => setForm(prev => ({ ...prev, arvInitiationCategory: e.target.value }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="">Select category</option>
                          {lookups.artInitiationCategory?.map((cat: any) => (
                            <option key={cat.code} value={cat.code}>
                              {cat.code} - {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Reason for Starting ARV
                        </label>
                        <select
                          value={form.arvReasonStart}
                          onChange={(e) => setForm(prev => ({ ...prev, arvReasonStart: e.target.value }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="">Select reason</option>
                          {lookups.arvReasonsStart?.map((reason: any) => (
                            <option key={reason.code} value={reason.code}>
                              {reason.code} - {reason.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : form.arvStatus === '1' ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Reason Not on ARV
                      </label>
                      <select
                        value={form.arvReasonNotOn}
                        onChange={(e) => setForm(prev => ({ ...prev, arvReasonNotOn: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Select reason</option>
                        {lookups.arvReasonsNotOn?.map((reason: any) => (
                          <option key={reason.code} value={reason.code}>
                            {reason.code} - {reason.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (form.arvStatus === '4' || form.arvStatus === '5') ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Reason for Change/Stop ARV
                      </label>
                      <select
                        value={form.arvChangeStopReason}
                        onChange={(e) => setForm(prev => ({ ...prev, arvChangeStopReason: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Select reason</option>
                        {lookups.arvChangeStopReasons?.map((reason: any) => (
                          <option key={reason.code} value={reason.code}>
                            {reason.code} - {reason.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {(form.arvStatus === '2a' || form.arvStatus === '2b' || form.arvStatus === '3' || form.arvStatus === '4' || form.arvStatus === '6') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          ARV Regimen
                        </label>
                        <select
                          value={form.arvRegimenCode}
                          onChange={(e) => {
                            const selected = filteredRegimens.find((r: any) => r.code === e.target.value);
                            setForm(prev => ({
                              ...prev,
                              arvRegimenCode: e.target.value,
                              arvRegimenName: selected?.name || ''
                            }));
                          }}
                          disabled={
                            (form.arvStatus === '3' && lastInitiatedRegimenCode !== null) ||
                            (form.arvStatus === '4' && approvedArvChange !== null)
                          }
                          className={`w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                            ((form.arvStatus === '3' && lastInitiatedRegimenCode !== null) ||
                             (form.arvStatus === '4' && approvedArvChange !== null))
                              ? 'bg-slate-50 cursor-not-allowed' 
                              : ''
                          }`}
                        >
                          <option value="">Select regimen</option>
                          {filteredRegimens.map((regimen: any) => (
                            <option key={regimen.code} value={regimen.code}>
                              {regimen.code} - {regimen.name} ({regimen.line})
                            </option>
                          ))}
                        </select>
                        {patientAge !== null && (
                          <p className="text-xs text-slate-500 mt-1">
                            Showing {isChild ? 'Paediatric' : 'Adult'} regimens (Age: {patientAge} years)
                          </p>
                        )}
                        {isChild && form.arvRegimenCode && form.weightKg && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('ehr_token');
                                if (!token) return;

                                const ageMonths = Math.floor((patientAge || 0) * 12);
                                const bsa = form.heightCm && form.weightKg 
                                  ? Math.sqrt((parseFloat(form.heightCm) * parseFloat(form.weightKg)) / 3600)
                                  : undefined;

                                const doseRes = await ehrApi.calculatePediatricDose({
                                  regimenCode: form.arvRegimenCode,
                                  weightKg: parseFloat(form.weightKg),
                                  ageMonths,
                                  bsa
                                }, token, tenantSlug);

                                if (doseRes.data) {
                                  showSuccess('Pediatric Dose Calculated', 
                                    `Recommended: ${doseRes.data.dose}\nFrequency: ${doseRes.data.frequency}\nFormulation: ${doseRes.data.formulation}\n\n${doseRes.data.notes}`
                                  );
                                }
                              } catch (error) {
                                showError('Error', 'Failed to calculate pediatric dose');
                              }
                            }}
                            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                          >
                            📊 Calculate Pediatric Dose
                          </button>
                        )}
                        {form.arvStatus === '3' && lastInitiatedRegimenCode && (
                          <p className="text-xs text-blue-600 mt-1">
                            Regimen locked to continue on last initiated regimen per WHO guidelines
                          </p>
                        )}
                        {form.arvStatus === '4' && approvedArvChange && (
                          <p className="text-xs text-green-600 mt-1">
                            Regimen locked to doctor-approved change: {approvedArvChange.requested_regimen_name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Duration Prescribed (tablets/ml)
                        </label>
                        <input
                          type="text"
                          value={form.arvDurationPrescribed}
                          onChange={(e) => setForm(prev => ({ ...prev, arvDurationPrescribed: e.target.value }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          ARV Quantity Prescribed
                        </label>
                        <input
                          type="number"
                          value={form.arvQuantityPrescribed}
                          onChange={(e) => setForm(prev => ({ ...prev, arvQuantityPrescribed: e.target.value }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          ARV Quantity Dispensed
                        </label>
                        <input
                          type="number"
                          value={form.arvQuantityDispensed}
                          onChange={(e) => setForm(prev => ({ ...prev, arvQuantityDispensed: e.target.value }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          ARV % Adherence
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={form.arvAdherencePercentage}
                          onChange={(e) => setForm(prev => ({ ...prev, arvAdherencePercentage: e.target.value }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                    </>
                  )}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Adverse Events Status (multiple response)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-4">
                    {lookups.adverseEvents?.map((event: any) => (
                      <label key={event.code} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.adverseEventsStatus.includes(event.code)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm(prev => ({
                                ...prev,
                                adverseEventsStatus: [...prev.adverseEventsStatus, event.code]
                              }));
                            } else {
                              setForm(prev => ({
                                ...prev,
                                adverseEventsStatus: prev.adverseEventsStatus.filter((c: string) => c !== event.code)
                              }));
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">
                          {event.code} - {event.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {snomedReady && (
                  <div className="rounded-2xl border border-emerald-200 bg-white/70 p-4 space-y-4 mt-4">
                    <p className="text-sm font-semibold text-emerald-900">SNOMED ARV & Follow-up Coding</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <SnomedConceptPicker
                        value={arvReasonConceptSelection}
                        onChange={setArvReasonConceptSelection}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="Structured ARV reason"
                        placeholder="Search SNOMED CT (e.g., Antiretroviral therapy started)"
                      context="situation"
                      />
                      <SnomedConceptPicker
                        value={arvRegimenConceptSelection}
                        onChange={(concept) => {
                          setArvRegimenConceptSelection(concept);
                          if (concept && !form.arvRegimenName) {
                            setForm((prev) => ({
                              ...prev,
                              arvRegimenName: concept.preferredTerm || concept.term || prev.arvRegimenName,
                            }));
                          }
                        }}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="Structured ARV regimen concept"
                        placeholder="Search SNOMED CT (e.g., Tenofovir/lamivudine/dolutegravir)"
                      context="medication"
                      />
                      <div className="space-y-2">
                        <SnomedConceptPicker
                          value={pendingAdverseEventConcept}
                          onChange={setPendingAdverseEventConcept}
                          token={snomedToken}
                          tenantSlug={tenantSlug}
                          label="Adverse event concept"
                          placeholder="Search SNOMED CT (e.g., Drug-induced anemia)"
                        context="condition"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                            onClick={() =>
                              addConceptToCollection(
                                pendingAdverseEventConcept,
                                adverseEventConcepts,
                                setAdverseEventConcepts,
                                setPendingAdverseEventConcept,
                              )
                            }
                            disabled={!pendingAdverseEventConcept}
                          >
                            Add adverse event
                          </button>
                          {adverseEventConcepts.length > 0 && (
                            <button
                              type="button"
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700"
                              onClick={() => setAdverseEventConcepts([])}
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        {adverseEventConcepts.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {adverseEventConcepts.map((concept) => (
                              <span
                                key={concept.conceptId}
                                className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700"
                              >
                                {concept.preferredTerm || concept.term}
                                <button
                                  type="button"
                                  className="text-rose-500 hover:text-rose-700"
                                  onClick={() =>
                                    removeConceptFromCollection(
                                      concept.conceptId,
                                      adverseEventConcepts,
                                      setAdverseEventConcepts,
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
                          value={pendingFollowUpConcept}
                          onChange={setPendingFollowUpConcept}
                          token={snomedToken}
                          tenantSlug={tenantSlug}
                          label="Follow-up action concept"
                          placeholder="Search SNOMED CT (e.g., Referral to adherence counselling)"
                      context="procedure"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                            onClick={() =>
                              addConceptToCollection(
                                pendingFollowUpConcept,
                                followUpConcepts,
                                setFollowUpConcepts,
                                setPendingFollowUpConcept,
                              )
                            }
                            disabled={!pendingFollowUpConcept}
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
                        value={referralReasonConceptSelection}
                        onChange={setReferralReasonConceptSelection}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="Referral reason concept"
                        placeholder="Search SNOMED CT (e.g., Suspected treatment failure)"
                      context="condition"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Lab Results Section - Hidden for drug collection visits */}
              {!isDrugCollectionOnly(form.visitType) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-3">Lab Results</h4>
                  
                  {visitGuidelineValidation.hasHighViralLoad && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-900 mb-1">
                            ⚠️ High Viral Load Detected:{' '}
                            {visitGuidelineValidation.normalizedViralLoad?.toLocaleString() || form.viralLoad}{' '}
                            copies/mL
                          </p>
                          <p className="text-xs text-red-800">
                            {cdssConfig.messages.highViralLoadVisit}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CD4 Count
                    </label>
                    <input
                      type="number"
                      value={form.cd4Count}
                      onChange={(e) => setForm(prev => ({ ...prev, cd4Count: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CD4 Percentage
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.cd4Percentage}
                      onChange={(e) => setForm(prev => ({ ...prev, cd4Percentage: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CD4 Test Date
                    </label>
                    <input
                      type="date"
                      value={form.cd4TestDate}
                      onChange={(e) => setForm(prev => ({ ...prev, cd4TestDate: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Viral Load Sample Collected Date
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={form.viralLoadSampleCollectedDate}
                        onChange={(e) => {
                          setForm(prev => ({ ...prev, viralLoadSampleCollectedDate: e.target.value }));
                          if (labOrderCreated) setLabOrderCreated(false);
                        }}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      {form.viralLoadSampleCollectedDate && !labOrderCreated && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setCreatingLabOrder(true);
                              const token = localStorage.getItem('ehr_token');
                              if (!token) {
                                showError('Error', 'Authentication required');
                                return;
                              }
                              const userStr = localStorage.getItem('ehr_user');
                              const currentUser = userStr ? JSON.parse(userStr) : null;
                              if (!currentUser) {
                                showError('Error', 'User information not found');
                                return;
                              }
                              await ehrApi.createLabOrder({
                                patientId: enrollment.patient_id,
                                medicalRecordId: null,
                                tests: [{
                                  testCode: 'VL',
                                  testName: 'HIV Viral Load',
                                  category: 'immunology',
                                  specimenType: 'plasma',
                                  instructions: 'HIV care - Viral Load monitoring',
                                  loincCode: '25836-8'
                                }],
                                priority: 'routine',
                                clinicalInfo: `HIV Clinical Visit - Visit #${form.visitNumber}`,
                                specialInstructions: `Sample collected on ${form.viralLoadSampleCollectedDate}. Patient: ${enrollment.first_name} ${enrollment.last_name} (${enrollment.enrollment_number})`,
                                scheduledDateTime: form.viralLoadSampleCollectedDate ? new Date(form.viralLoadSampleCollectedDate).toISOString() : new Date().toISOString(),
                                snomedConceptId: '315124006',
                                snomedTerm: 'Measurement of viral load (procedure)',
                              }, token, tenantSlug);
                              setLabOrderCreated(true);
                              showSuccess(
                                'Success',
                                'Lab order created. Lab technician can now find this order by patient ID/name and enter results. Please send the patient to Accounts so payment can be confirmed before processing.',
                              );
                            } catch (error: any) {
                              console.error('Failed to create lab order:', error);
                              showError('Error', error?.response?.data?.message || 'Failed to create lab order');
                            } finally {
                              setCreatingLabOrder(false);
                            }
                          }}
                          disabled={creatingLabOrder}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                        >
                          {creatingLabOrder ? (
                            <>
                              <Activity className="w-4 h-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Activity className="w-4 h-4" />
                              Send to Lab
                            </>
                          )}
                        </button>
                      )}
                      {labOrderCreated && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-300">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-semibold">Order Created</span>
                        </div>
                      )}
                    </div>
                    {labOrderCreated && (
                      <p className="text-xs text-emerald-700 mt-1">
                        ✓ Lab order created. Lab technician can search by patient ID/name in lab system to enter results.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Viral Load Result Received Date
                    </label>
                    <input
                      type="date"
                      value={form.viralLoadResultReceivedDate}
                      onChange={(e) => setForm(prev => ({ ...prev, viralLoadResultReceivedDate: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      VL Result (copies/ml or undetected)
                      {viralLoadAutoPopulated && (
                        <span className="ml-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Auto-filled from Lab System
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., 50 or 'undetected'"
                        value={form.viralLoad}
                        onChange={(e) => handleViralLoadChange(e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                          viralLoadAutoPopulated 
                            ? 'border-emerald-300 bg-emerald-50' 
                            : 'border-slate-300'
                        }`}
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

                </div>
              </div>
              )}

              {/* Cryptococcal Section - Hidden for drug collection visits */}
              {!isDrugCollectionOnly(form.visitType) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">Cryptococcal Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cryptococcal Screening (Serum CrAg Test)
                    </label>
                    <select
                      value={form.cryptococcalSigns}
                      onChange={(e) => setForm(prev => ({ ...prev, cryptococcalSigns: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select</option>
                      {lookups.cryptococcalSigns?.map((sign: any) => (
                        <option key={sign.code} value={sign.code}>
                          {sign.code} - {sign.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cryptococcal Status
                    </label>
                    <select
                      value={form.cryptococcalStatus}
                      onChange={(e) => setForm(prev => ({ ...prev, cryptococcalStatus: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select</option>
                      {lookups.cryptococcalStatus?.map((status: any) => (
                        <option key={status.code} value={status.code}>
                          {status.code} - {status.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.cryptococcalCsfInvestigationDone}
                      onChange={(e) => setForm(prev => ({ ...prev, cryptococcalCsfInvestigationDone: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <label className="text-sm font-medium text-slate-700">
                      CSF Investigation Done
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.cryptococcalPreemptiveTreatmentResult}
                      onChange={(e) => setForm(prev => ({ ...prev, cryptococcalPreemptiveTreatmentResult: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <label className="text-sm font-medium text-slate-700">
                      Pre-emptive Treatment Results (Yes)
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cryptococcal Meningitis Treatment
                    </label>
                    <select
                      value={form.cryptococcalTreatment}
                      onChange={(e) => setForm(prev => ({ ...prev, cryptococcalTreatment: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select treatment</option>
                      {lookups.cryptococcalTreatment?.map((treatment: any) => (
                        <option key={treatment.code} value={treatment.code}>
                          {treatment.code} - {treatment.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              )}

              {/* Cervical Cancer Section - Only for females and not drug collection */}
              {isFemale && !isDrugCollectionOnly(form.visitType) && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-3">Cervical Cancer Screening</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      HPV Test Result (Pos/Neg)
                    </label>
                    <select
                      value={form.cervicalCancerHpvTestResult}
                      onChange={(e) => setForm(prev => ({ ...prev, cervicalCancerHpvTestResult: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select</option>
                      <option value="Pos">Positive</option>
                      <option value="Neg">Negative</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      VIAC Result (Pos/Neg)
                    </label>
                    <select
                      value={form.cervicalCancerViacResult}
                      onChange={(e) => setForm(prev => ({ ...prev, cervicalCancerViacResult: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select</option>
                      <option value="Pos">Positive</option>
                      <option value="Neg">Negative</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Treatment (use codes below)
                    </label>
                    <select
                      value={form.cervicalCancerTreatment}
                      onChange={(e) => setForm(prev => ({ ...prev, cervicalCancerTreatment: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select treatment</option>
                      {lookups.precancerousTreatment?.map((treatment: any) => (
                        <option key={treatment.code} value={treatment.code}>
                          {treatment.code} - {treatment.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              )}

              {/* Follow-up Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">Follow-up & Outcome</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Next Review Date
                    </label>
                    <input
                      type="date"
                      value={form.nextReviewDate}
                      onChange={(e) => setForm(prev => ({ ...prev, nextReviewDate: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Auto-calculated: Visit Date + ARV Quantity Dispensed (1 ARV = 1 day). Editable for clinical visits.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Visit Status
                    </label>
                    <select
                      value={form.visitStatus}
                      onChange={(e) => setForm(prev => ({ ...prev, visitStatus: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select status</option>
                      {lookups.visitStatus?.map((status: any) => (
                        <option key={status.code} value={status.code}>
                          {status.code} - {status.name}
                        </option>
                      ))}
                    </select>
                    {lastVisitNextReviewDate && form.visitDate && (
                      <p className="text-xs text-slate-500 mt-1">
                        Auto-determined by comparing visit date with last visit's review date ({new Date(lastVisitNextReviewDate).toLocaleDateString()}). Editable.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Final Outcome
                    </label>
                    <select
                      value={form.finalOutcome}
                      onChange={(e) => setForm(prev => ({ ...prev, finalOutcome: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select outcome</option>
                      {lookups.finalOutcome?.map((outcome: any) => (
                        <option key={outcome.code} value={outcome.code}>
                          {outcome.code} - {outcome.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">
                        Visit Notes
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const template = visitPreparationChecklist?.lastVisitNotes 
                              ? `Previous visit notes: ${visitPreparationChecklist.lastVisitNotes}\n\nCurrent visit: `
                              : 'Patient presents for routine follow-up. ';
                            setForm(prev => ({ ...prev, visitNotes: template + (prev.visitNotes || '') }));
                          }}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          title="Insert template"
                        >
                          Template
                        </button>
                        {eacEligibility?.needsEac && (
                          <button
                            type="button"
                            onClick={() => {
                              const eacTemplate = `⚠️ EAC REQUIRED: Patient has high viral load (VL > 1000 copies/mL). EAC intervention initiated per WHO guidelines. `;
                              setForm(prev => ({ ...prev, visitNotes: eacTemplate + (prev.visitNotes || '') }));
                            }}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            title="Insert EAC template"
                          >
                            EAC Template
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={form.visitNotes}
                      onChange={(e) => setForm(prev => ({ ...prev, visitNotes: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Enter visit notes..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nurse/Clinician Name
                    </label>
                    <input
                      type="text"
                      value={form.clinicianInitials}
                      onChange={(e) => setForm(prev => ({ ...prev, clinicianInitials: e.target.value }))}
                      placeholder="Auto-filled from logged-in user"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Auto-filled from your account. Edit only if needed.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Pharmacy Dispenser Initials
                    </label>
                    <input
                      type="text"
                      value={form.pharmacyDispenserInitials}
                      onChange={(e) => setForm(prev => ({ ...prev, pharmacyDispenserInitials: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {(visitGuidelineValidation.blockingIssues.length > 0 ||
          visitGuidelineValidation.warningIssues.length > 0) && (
          <div className="mx-6 mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5" />
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Guideline validation flags</p>
                  <p className="text-xs text-amber-800">
                    WHO/Zim ART guardrails run before save. Fix blocking issues; warnings should be
                    reviewed and documented.
                  </p>
                </div>
                {visitGuidelineValidation.blockingIssues.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-rose-700 mb-1">
                      Blocking issues ({visitGuidelineValidation.blockingIssues.length})
                    </p>
                    <ul className="list-disc pl-5 text-xs text-rose-800 space-y-1">
                      {visitGuidelineValidation.blockingIssues.map((issue) => (
                        <li key={issue.code}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {visitGuidelineValidation.warningIssues.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">
                      Warnings ({visitGuidelineValidation.warningIssues.length})
                    </p>
                    <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1">
                      {visitGuidelineValidation.warningIssues.map((issue) => (
                        <li key={issue.code}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between sticky bottom-0 bg-white">
          <button
            onClick={() => {
              if (activeStep > 1) {
                // Skip step 3 for non-females when going backwards
                if (!isFemale && activeStep === 4) {
                  setActiveStep(2); // Go from step 4 (Clinical) back to step 2 (Vitals)
                } else if (!isFemale && activeStep === 5) {
                  setActiveStep(4); // Go from step 5 (TB) back to step 4 (Clinical)
                } else if (!isFemale && activeStep === 6) {
                  setActiveStep(5); // Go from step 6 (ARV) back to step 5 (TB)
                } 
                // For drug collection visits, go back to step 1
                else if (isDrugCollectionOnly(form.visitType) && activeStep === (isFemale ? 6 : 6)) {
                  setActiveStep(1); // Go from ARV step back to visit basics
                }
                else {
                  setActiveStep(prev => prev - 1);
                }
              }
            }}
            disabled={activeStep === 1}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="flex gap-2">
            {(() => {
              // Determine if we should show "Next" or "Save"
              const isLastStep = isDrugCollectionOnly(form.visitType) 
                ? activeStep >= 6 
                : activeStep >= (isFemale ? 6 : 6);
              
              return !isLastStep ? (
                <button
                  onClick={() => {
                    // Skip step 3 for non-females when going forward
                    if (!isFemale && activeStep === 2) {
                      setActiveStep(4); // Skip step 3, go from step 2 (Vitals) to step 4 (Clinical)
                    } 
                    // Skip clinical steps for drug collection visits
                    else if (isDrugCollectionOnly(form.visitType) && activeStep === 1) {
                      setActiveStep(6); // Skip directly to ARV step
                    } 
                    // Skip clinical steps when going forward from visit basics for drug collection
                    else if (isDrugCollectionOnly(form.visitType) && activeStep < 6) {
                      setActiveStep(6); // Skip to ARV step
                    }
                    else {
                      setActiveStep(prev => prev + 1);
                    }
                  }}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Next
                  </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || visitGuidelineValidation.blockingIssues.length > 0}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Visit
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Quick Reference Guide */}
      {showQuickReference && (
        <HIVQuickReferenceGuide onClose={() => setShowQuickReference(false)} />
      )}
    </div>
  );
};

export default HIVClinicalVisitModal;
