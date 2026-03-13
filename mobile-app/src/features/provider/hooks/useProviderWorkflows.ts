import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgeNurseAlert,
  completeNurseTask,
  getDoctorSyncFeed,
  getNurseCrossModuleFeed,
  getNurseWorklistState,
  updateNurseCrossModuleWorkflow,
  type NurseCrossModuleFeedResponse,
  type UpdateWorkflowPayload
} from '../../../services/api/provider';

const QUERY_KEYS = {
  nurseState: ['provider', 'nurse', 'state'] as const,
  nurseFeed: ['provider', 'nurse', 'cross-module-feed'] as const,
  doctorFeed: (focus?: string, includeAcknowledged?: boolean) =>
    ['provider', 'doctor', 'sync-feed', focus || 'all', includeAcknowledged ? 'with-ack' : 'open-only'] as const
};

export function useNurseWorklistState() {
  return useQuery({
    queryKey: QUERY_KEYS.nurseState,
    queryFn: getNurseWorklistState,
    refetchInterval: 30_000
  });
}

export function useNurseCrossModuleFeed() {
  return useQuery<NurseCrossModuleFeedResponse>({
    queryKey: QUERY_KEYS.nurseFeed,
    queryFn: getNurseCrossModuleFeed,
    refetchInterval: 25_000
  });
}

export function useDoctorSyncFeed(params?: { focus?: string; includeAcknowledged?: boolean }) {
  return useQuery<NurseCrossModuleFeedResponse>({
    queryKey: QUERY_KEYS.doctorFeed(params?.focus, params?.includeAcknowledged),
    queryFn: () => getDoctorSyncFeed(params),
    refetchInterval: 20_000
  });
}

export function useWorkflowMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nurseState }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nurseFeed }),
      queryClient.invalidateQueries({ queryKey: ['provider', 'doctor', 'sync-feed'] })
    ]);
  };

  const updateWorkflow = useMutation({
    mutationFn: (payload: UpdateWorkflowPayload) => updateNurseCrossModuleWorkflow(payload),
    onSuccess: invalidateAll
  });

  const completeTask = useMutation({
    mutationFn: (args: {
      taskId: string;
      payload?: { action?: 'accept' | 'override'; reason?: string; patientId?: string; context?: Record<string, unknown> };
    }) => completeNurseTask(args.taskId, args.payload),
    onSuccess: invalidateAll
  });

  const acknowledgeAlert = useMutation({
    mutationFn: (args: {
      alertId: string;
      payload?: { action?: 'accept' | 'override'; reason?: string; patientId?: string; context?: Record<string, unknown> };
    }) => acknowledgeNurseAlert(args.alertId, args.payload),
    onSuccess: invalidateAll
  });

  return {
    updateWorkflow,
    completeTask,
    acknowledgeAlert
  };
}
