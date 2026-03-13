import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFamilyAccessGrant,
  createPatientGoal,
  declinePatientConsent,
  exportPatientRecordsCsv,
  exportPatientRecordsFhir,
  exportPatientRecordsJson,
  exportPatientRecordsPdf,
  getAdmissionHistory,
  getCardiologyBloodPressureTrends,
  getCardiologyEncounters,
  getCurrentAdmission,
  getDiabetesCarePlan,
  getDiabetesGlucoseHistory,
  getDiabetesMedications,
  getDiabetesRegistry,
  getFamilyAccessGrants,
  listPatientCarePlans,
  getPatientConsents,
  getPatientEdVisits,
  getPatientImmunizationForecast,
  getPatientImmunizations,
  getPatientLabResults,
  getPatientPathways,
  getPatientVitals,
  getPendingQuestionnaires,
  listPatientGoals,
  revokeFamilyAccessGrant,
  signPatientConsent,
  submitPatientVitals
} from '../../../services/api/patient';

const QUERY_KEYS = {
  labs: ['patient', 'health', 'labs'] as const,
  vitals: ['patient', 'health', 'vitals'] as const,
  diabetesRegistry: ['patient', 'health', 'diabetes-registry'] as const,
  glucoseHistory: ['patient', 'health', 'glucose-history'] as const,
  diabetesCarePlan: ['patient', 'health', 'diabetes-care-plan'] as const,
  diabetesMeds: ['patient', 'health', 'diabetes-meds'] as const,
  cardioEncounters: ['patient', 'health', 'cardio-encounters'] as const,
  cardioBpTrends: ['patient', 'health', 'cardio-bp-trends'] as const,
  goals: ['patient', 'health', 'goals'] as const,
  carePlans: ['patient', 'health', 'care-plans'] as const,
  questionnaires: ['patient', 'health', 'questionnaires-pending'] as const,
  consents: ['patient', 'health', 'consents'] as const,
  pathways: ['patient', 'health', 'pathways'] as const,
  immunizations: ['patient', 'health', 'immunizations'] as const,
  immunizationForecast: ['patient', 'health', 'immunization-forecast'] as const,
  currentAdmission: ['patient', 'health', 'admission-current'] as const,
  admissionHistory: ['patient', 'health', 'admission-history'] as const,
  edVisits: ['patient', 'health', 'ed-visits'] as const,
  familyAccess: ['patient', 'health', 'family-access'] as const
};

export function usePatientLabResults() {
  return useQuery({
    queryKey: QUERY_KEYS.labs,
    queryFn: getPatientLabResults,
    refetchInterval: 60_000
  });
}

export function usePatientVitals() {
  return useQuery({
    queryKey: QUERY_KEYS.vitals,
    queryFn: getPatientVitals,
    refetchInterval: 60_000
  });
}

export function usePatientDiabetesRegistry() {
  return useQuery({
    queryKey: QUERY_KEYS.diabetesRegistry,
    queryFn: getDiabetesRegistry,
    refetchInterval: 90_000
  });
}

export function usePatientGlucoseHistory() {
  return useQuery({
    queryKey: QUERY_KEYS.glucoseHistory,
    queryFn: () => getDiabetesGlucoseHistory({ limit: 30 }),
    refetchInterval: 90_000
  });
}

export function usePatientDiabetesCarePlan() {
  return useQuery({
    queryKey: QUERY_KEYS.diabetesCarePlan,
    queryFn: getDiabetesCarePlan,
    refetchInterval: 120_000
  });
}

export function usePatientDiabetesMedications() {
  return useQuery({
    queryKey: QUERY_KEYS.diabetesMeds,
    queryFn: getDiabetesMedications,
    refetchInterval: 90_000
  });
}

export function usePatientCardiologyEncounters() {
  return useQuery({
    queryKey: QUERY_KEYS.cardioEncounters,
    queryFn: () => getCardiologyEncounters({ limit: 20 }),
    refetchInterval: 120_000
  });
}

export function usePatientCardioBloodPressureTrends() {
  return useQuery({
    queryKey: QUERY_KEYS.cardioBpTrends,
    queryFn: () => getCardiologyBloodPressureTrends({ limit: 20 }),
    refetchInterval: 120_000
  });
}

export function usePatientGoals() {
  return useQuery({
    queryKey: QUERY_KEYS.goals,
    queryFn: listPatientGoals,
    refetchInterval: 90_000
  });
}

export function usePatientCarePlans() {
  return useQuery({
    queryKey: QUERY_KEYS.carePlans,
    queryFn: listPatientCarePlans,
    refetchInterval: 90_000
  });
}

export function usePatientContinuity() {
  const questionnaires = useQuery({
    queryKey: QUERY_KEYS.questionnaires,
    queryFn: getPendingQuestionnaires,
    refetchInterval: 120_000
  });

  const consents = useQuery({
    queryKey: QUERY_KEYS.consents,
    queryFn: getPatientConsents,
    refetchInterval: 120_000
  });

  const pathways = useQuery({
    queryKey: QUERY_KEYS.pathways,
    queryFn: getPatientPathways,
    refetchInterval: 120_000
  });

  const immunizations = useQuery({
    queryKey: QUERY_KEYS.immunizations,
    queryFn: getPatientImmunizations,
    refetchInterval: 120_000
  });

  const immunizationForecast = useQuery({
    queryKey: QUERY_KEYS.immunizationForecast,
    queryFn: getPatientImmunizationForecast,
    refetchInterval: 120_000
  });

  const currentAdmission = useQuery({
    queryKey: QUERY_KEYS.currentAdmission,
    queryFn: getCurrentAdmission,
    refetchInterval: 120_000
  });

  const admissionHistory = useQuery({
    queryKey: QUERY_KEYS.admissionHistory,
    queryFn: getAdmissionHistory,
    refetchInterval: 120_000
  });

  const edVisits = useQuery({
    queryKey: QUERY_KEYS.edVisits,
    queryFn: getPatientEdVisits,
    refetchInterval: 120_000
  });

  const familyAccess = useQuery({
    queryKey: QUERY_KEYS.familyAccess,
    queryFn: getFamilyAccessGrants,
    refetchInterval: 90_000
  });

  return {
    questionnaires,
    consents,
    pathways,
    immunizations,
    immunizationForecast,
    currentAdmission,
    admissionHistory,
    edVisits,
    familyAccess
  };
}

export function usePatientHealthMutations() {
  const queryClient = useQueryClient();

  const invalidateHealth = async () => {
    await queryClient.invalidateQueries({ queryKey: ['patient', 'health'] });
  };

  const submitVitals = useMutation({
    mutationFn: submitPatientVitals,
    onSuccess: invalidateHealth
  });

  const createGoal = useMutation({
    mutationFn: createPatientGoal,
    onSuccess: invalidateHealth
  });

  const signConsent = useMutation({
    mutationFn: (args: {
      consentId: string;
      payload?: {
        signerRole?: 'patient' | 'guardian' | 'proxy';
        signatureType?: 'electronic' | 'drawn' | 'typed';
        signedName?: string;
        signatureData?: string;
      };
    }) => signPatientConsent(args.consentId, args.payload),
    onSuccess: invalidateHealth
  });

  const declineConsent = useMutation({
    mutationFn: (args: { consentId: string; payload?: { reason?: string; declinedBy?: string } }) =>
      declinePatientConsent(args.consentId, args.payload),
    onSuccess: invalidateHealth
  });

  const createFamilyAccess = useMutation({
    mutationFn: createFamilyAccessGrant,
    onSuccess: invalidateHealth
  });

  const revokeFamilyAccess = useMutation({
    mutationFn: (grantId: string) => revokeFamilyAccessGrant(grantId),
    onSuccess: invalidateHealth
  });

  const exportPdf = useMutation({
    mutationFn: exportPatientRecordsPdf
  });

  const exportFhir = useMutation({
    mutationFn: exportPatientRecordsFhir
  });

  const exportJson = useMutation({
    mutationFn: exportPatientRecordsJson
  });

  const exportCsv = useMutation({
    mutationFn: exportPatientRecordsCsv
  });

  return {
    submitVitals,
    createGoal,
    signConsent,
    declineConsent,
    createFamilyAccess,
    revokeFamilyAccess,
    exportPdf,
    exportFhir,
    exportJson,
    exportCsv
  };
}
