import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMedicationReminder,
  deleteMedicationReminder,
  getMedicationAdherenceLogs,
  getMedicationAdherenceSummary,
  getMedicationReminders,
  getPatientPrescriptions,
  getPrescriptionRefillRequests,
  logMedicationAdherence,
  requestPrescriptionRefill,
  updateMedicationReminder
} from '../../../services/api/patient';

const QUERY_KEYS = {
  prescriptions: ['patient', 'medications', 'prescriptions'] as const,
  reminders: ['patient', 'medications', 'reminders'] as const,
  refills: ['patient', 'medications', 'refills'] as const,
  adherenceSummary: ['patient', 'medications', 'adherence-summary'] as const,
  adherenceLogs: ['patient', 'medications', 'adherence-logs'] as const
};

export function usePatientPrescriptions() {
  return useQuery({
    queryKey: QUERY_KEYS.prescriptions,
    queryFn: getPatientPrescriptions,
    refetchInterval: 45_000
  });
}

export function usePatientMedicationReminders() {
  return useQuery({
    queryKey: QUERY_KEYS.reminders,
    queryFn: () => getMedicationReminders(),
    refetchInterval: 30_000
  });
}

export function usePatientRefillRequests() {
  return useQuery({
    queryKey: QUERY_KEYS.refills,
    queryFn: () => getPrescriptionRefillRequests(),
    refetchInterval: 45_000
  });
}

export function usePatientAdherenceSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.adherenceSummary,
    queryFn: () => getMedicationAdherenceSummary(),
    refetchInterval: 45_000
  });
}

export function usePatientAdherenceLogs() {
  return useQuery({
    queryKey: QUERY_KEYS.adherenceLogs,
    queryFn: () => getMedicationAdherenceLogs({ limit: 40 }),
    refetchInterval: 45_000
  });
}

export function usePatientMedicationMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.prescriptions }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reminders }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.refills }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adherenceSummary }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adherenceLogs })
    ]);
  };

  const requestRefill = useMutation({
    mutationFn: (args: {
      prescriptionId: string;
      payload?: { requestedQuantity?: number; reason?: string; urgency?: string };
    }) => requestPrescriptionRefill(args.prescriptionId, args.payload),
    onSuccess: invalidate
  });

  const createReminder = useMutation({
    mutationFn: (args: {
      prescriptionId: string;
      payload: { reminderTime: string; reminderDays: number[]; reminderType?: string; timezone?: string };
    }) => createMedicationReminder(args.prescriptionId, args.payload),
    onSuccess: invalidate
  });

  const updateReminder = useMutation({
    mutationFn: (args: {
      reminderId: string;
      payload: { reminderTime?: string; reminderDays?: number[]; reminderType?: string; isActive?: boolean };
    }) => updateMedicationReminder(args.reminderId, args.payload),
    onSuccess: invalidate
  });

  const removeReminder = useMutation({
    mutationFn: (reminderId: string) => deleteMedicationReminder(reminderId),
    onSuccess: invalidate
  });

  const logAdherence = useMutation({
    mutationFn: (args: {
      prescriptionId: string;
      payload: {
        scheduledTime: string;
        taken: boolean;
        takenTime?: string;
        missedReason?: string;
        notes?: string;
      };
    }) => logMedicationAdherence(args.prescriptionId, args.payload),
    onSuccess: invalidate
  });

  return {
    requestRefill,
    createReminder,
    updateReminder,
    removeReminder,
    logAdherence
  };
}
