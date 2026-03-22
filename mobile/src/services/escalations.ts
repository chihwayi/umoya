import { api } from './api';

export interface ApiEscalation {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  patientId: string;
  patientName?: string;
  room?: string;
  ward?: string;
  alertType?: string;
  title?: string;
  message?: string;
  nurseNotes?: string;
  nurseName?: string;
  vitalsAtAlert?: { label: string; value: string; flag: string }[];
  history?: { time: string; actor: string; action: string }[];
  slaDeadlineMs?: number;   // epoch ms — provided by backend or computed
  escalatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  aiContext?: string;
}

export const EscalationsService = {
  /** All pending (active + acknowledged) alerts for the logged-in doctor */
  pending: () =>
    api.get<ApiEscalation[]>('/critical-alerts/pending').then(r => r.data),

  forPatient: (patientId: string) =>
    api.get<ApiEscalation[]>(`/critical-alerts/patient/${patientId}`).then(r => r.data),

  acknowledge: (id: string, notes?: string) =>
    api.put<ApiEscalation>(`/critical-alerts/${id}/acknowledge`, { notes }).then(r => r.data),

  dismiss: (id: string) =>
    api.put<ApiEscalation>(`/critical-alerts/${id}/dismiss`, {}).then(r => r.data),
};
