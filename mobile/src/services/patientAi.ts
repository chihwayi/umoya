import { api } from './api';

export interface AdherenceChatDto {
  patientId: string;
  message: string;
  sessionId?: string;
  context?: {
    medications?: { name: string; dose: string }[];
    recentVitals?: Record<string, number>;
    visitContext?: {
      visitId?: string;
      visitDate?: string;
      doctorName?: string;
      diagnoses?: string[];
      soap?: { subjective?: string; objective?: string; assessment?: string; plan?: string };
      quickSummary?: string;
    };
  };
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  sessionId?: string;
  timestamp?: string;
}

export interface SymptomCheckDto {
  patientId: string;
  symptoms: string[];
  duration?: string;
  severity?: string;
  additionalNotes?: string;
}

export const PatientAiService = {
  chat: (dto: AdherenceChatDto) =>
    api.post<AiChatMessage>('/patient-ai/adherence/chat', dto).then(r => r.data),

  chatHistory: (patientId: string, sessionId?: string) => {
    const qs = sessionId ? `?sessionId=${sessionId}` : '';
    return api.get<AiChatMessage[]>(
      `/patient-ai/adherence/patient/${patientId}${qs}`,
    ).then(r => r.data);
  },

  checkSymptoms: (dto: SymptomCheckDto) =>
    api.post<any>('/patient-ai/symptoms/check', dto).then(r => r.data),
};
