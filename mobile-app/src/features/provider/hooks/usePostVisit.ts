import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPostVisitMobileContract,
  getPostVisitMobileEvents,
  listPostVisitSessions,
  publishPostVisitSession,
  reviewPostVisitArtifact
} from '../../../services/api/provider';

const QUERY_KEYS = {
  sessions: ['provider', 'postvisit', 'sessions'] as const,
  contract: (sessionId?: string) => ['provider', 'postvisit', 'contract', sessionId || 'none'] as const,
  events: (sessionId?: string) => ['provider', 'postvisit', 'events', sessionId || 'none'] as const
};

export function usePostVisitSessions() {
  return useQuery({
    queryKey: QUERY_KEYS.sessions,
    queryFn: () => listPostVisitSessions({ limit: 20 }),
    refetchInterval: 30_000
  });
}

export function usePostVisitMobileContract(sessionId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.contract(sessionId),
    queryFn: () => getPostVisitMobileContract(sessionId || ''),
    enabled: Boolean(sessionId)
  });
}

export function usePostVisitMobileEvents(sessionId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.events(sessionId),
    queryFn: () => getPostVisitMobileEvents(sessionId || '', { version: 'v1', limit: 30 }),
    enabled: Boolean(sessionId),
    refetchInterval: 15_000
  });
}

export function usePostVisitMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['provider', 'postvisit'] });
  };

  const reviewArtifact = useMutation({
    mutationFn: (args: {
      sessionId: string;
      artifactType: 'soap_note' | 'visit_summary' | 'recommendation_bundle';
      action: 'accept' | 'edit' | 'reject';
      reason?: string;
    }) =>
      reviewPostVisitArtifact(args.sessionId, {
        artifactType: args.artifactType,
        action: args.action,
        reason: args.reason
      }),
    onSuccess: invalidate
  });

  const publishSession = useMutation({
    mutationFn: (args: { sessionId: string; note?: string }) =>
      publishPostVisitSession(args.sessionId, {
        note: args.note,
        acknowledgedMedicationHighRisk: true
      }),
    onSuccess: invalidate
  });

  return {
    reviewArtifact,
    publishSession
  };
}
