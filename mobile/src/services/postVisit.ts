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

export const PostVisitService = {
  sessions: (patientId?: string) => {
    const qs = patientId ? `?patientId=${patientId}` : '';
    return api.get<ApiPostVisitSession[]>(`/post-visit/sessions${qs}`).then(r => r.data);
  },

  session: (id: string) =>
    api.get<ApiPostVisitSession>(`/post-visit/sessions/${id}`).then(r => r.data),
};
