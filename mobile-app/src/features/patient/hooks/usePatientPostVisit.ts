import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgePatientPostVisit,
  askPatientPostVisitSection,
  getPatientPostVisitAnnotatedSummary,
  getPatientPostVisitLabTrends,
  getPatientPostVisitMessages,
  getPatientPostVisitRecordingUrl,
  getPatientPostVisitSummary,
  listPatientPostVisitSessions,
  sendPatientPostVisitMessage
} from '../../../services/api/patient';

const QUERY_KEYS = {
  sessions: ['patient', 'postvisit', 'sessions'] as const,
  summary: (sessionId?: string) => ['patient', 'postvisit', 'summary', sessionId || 'none'] as const,
  annotated: (sessionId?: string) => ['patient', 'postvisit', 'annotated', sessionId || 'none'] as const,
  labTrends: (sessionId?: string) => ['patient', 'postvisit', 'lab-trends', sessionId || 'none'] as const,
  recording: (sessionId?: string) => ['patient', 'postvisit', 'recording', sessionId || 'none'] as const,
  messages: (sessionId?: string) => ['patient', 'postvisit', 'messages', sessionId || 'none'] as const
};

export function usePatientPostVisitSessions() {
  return useQuery({
    queryKey: QUERY_KEYS.sessions,
    queryFn: () => listPatientPostVisitSessions({ limit: 20 }),
    refetchInterval: 30_000
  });
}

export function usePatientPostVisitSummary(sessionId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.summary(sessionId),
    queryFn: () => getPatientPostVisitSummary(sessionId || ''),
    enabled: Boolean(sessionId)
  });
}

export function usePatientPostVisitAnnotatedSummary(sessionId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.annotated(sessionId),
    queryFn: () => getPatientPostVisitAnnotatedSummary(sessionId || ''),
    enabled: Boolean(sessionId)
  });
}

export function usePatientPostVisitLabTrends(sessionId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.labTrends(sessionId),
    queryFn: () => getPatientPostVisitLabTrends(sessionId || ''),
    enabled: Boolean(sessionId)
  });
}

export function usePatientPostVisitRecording(sessionId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.recording(sessionId),
    queryFn: () => getPatientPostVisitRecordingUrl(sessionId || ''),
    enabled: Boolean(sessionId)
  });
}

export function usePatientPostVisitMessages(sessionId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.messages(sessionId),
    queryFn: () => getPatientPostVisitMessages(sessionId || '', { limit: 40 }),
    enabled: Boolean(sessionId),
    refetchInterval: 20_000
  });
}

export function usePatientPostVisitMutations(sessionId?: string) {
  const queryClient = useQueryClient();

  const invalidateSession = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sessions }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.summary(sessionId) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(sessionId) })
    ]);
  };

  const askSection = useMutation({
    mutationFn: (payload: { question: string; sectionType: string }) =>
      askPatientPostVisitSection(sessionId || '', payload),
    onSuccess: invalidateSession
  });

  const sendMessage = useMutation({
    mutationFn: (payload: { message: string; language?: string; messageType?: 'question' | 'answer' | 'summary' | 'checklist' | 'alert' | 'system' }) =>
      sendPatientPostVisitMessage(sessionId || '', payload),
    onSuccess: invalidateSession
  });

  const acknowledge = useMutation({
    mutationFn: (payload: {
      acknowledgementType:
        | 'teach_back'
        | 'medication_adherence'
        | 'follow_up_commitment'
        | 'warning_sign_understanding';
      acknowledged?: boolean;
      details?: Record<string, unknown>;
    }) => acknowledgePatientPostVisit(sessionId || '', payload),
    onSuccess: invalidateSession
  });

  return {
    askSection,
    sendMessage,
    acknowledge
  };
}
