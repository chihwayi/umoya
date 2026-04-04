import { api } from './api';

export interface ApiPostVisitSession {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
  specialty?: string;
  appointmentDate?: string;
  visitType?: string;
  status?: string;
  quickSummary?: string;
  diagnoses?: { name: string; icd?: string }[];
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  medications?: { name: string; dose: string; instruction: string }[];
  followUpDate?: string;
  followUpInstructions?: string;
  createdAt: string;
}

export interface PatientPostVisitSessionListItem {
  id: string;
  status?: string;
  sourceType?: string;
  language?: string;
  startedAt?: string;
  completedAt?: string;
  publishedAt?: string;
  updatedAt?: string;
  summarySnippet?: string | null;
  checklistCount?: number;
}

export interface PatientPostVisitSummary {
  session: {
    id: string;
    patientId?: string;
    doctorId?: string | null;
    appointmentId?: string | null;
    consultationId?: string | null;
    status?: string;
    sourceType?: string;
    language?: string;
    startedAt?: string;
    completedAt?: string;
    publishedAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  summary: {
    plainLanguageSummary?: string;
    keyPoints?: string[];
    language?: string;
    teachBackQuestions?: string[];
    companionTopicChecklist?: string[];
    generatedAt?: string | null;
  };
  checklist: Array<{
    id?: string | null;
    title?: string | null;
    description?: string | null;
    urgency?: string;
    actionType?: string | null;
    completed?: boolean;
  }>;
}

export interface PatientPostVisitMessage {
  id: string;
  senderType: 'patient' | 'system';
  senderId?: string | null;
  messageType?: string;
  message: string;
  escalationDetected?: boolean;
  escalationEventId?: string | null;
  groundedContext?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
}

export const PostVisitService = {
  sessions: (patientId?: string) => {
    const qs = patientId ? `?patientId=${patientId}` : '';
    return api.get<ApiPostVisitSession[]>(`/post-visit/sessions${qs}`).then(r => r.data);
  },

  session: (id: string) =>
    api.get<ApiPostVisitSession>(`/post-visit/sessions/${id}`).then(r => r.data),

  publish: (id: string, body?: { note?: string; publishMetadata?: Record<string, any> }) =>
    api.post<{ status: string }>(`/post-visit/sessions/${id}/publish`, body ?? {}).then(r => r.data),

  patientSessions: () =>
    api.get<{ patientId: string; sessions: PatientPostVisitSessionListItem[]; paging?: { limit: number; offset: number } }>(
      '/patient-portal/post-visit/sessions',
    ).then(r => r.data),

  patientSessionSummary: (id: string) =>
    api.get<PatientPostVisitSummary>(`/patient-portal/post-visit/sessions/${id}/summary`).then(r => r.data),

  patientMessages: (id: string) =>
    api.get<{ messages: PatientPostVisitMessage[] }>(`/patient-portal/post-visit/sessions/${id}/messages`).then(r => r.data),

  patientSendMessage: (id: string, body: { message: string; language?: string; messageType?: string }) =>
    api.post<{
      assistantMessage?: { id: string; message: string; messageType?: string; createdAt: string };
      patientMessage?: { id: string; message: string; messageType?: string; createdAt: string; escalationDetected?: boolean };
    }>(`/patient-portal/post-visit/sessions/${id}/messages`, body).then(r => r.data),
};
