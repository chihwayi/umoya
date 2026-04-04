import { api } from './api';

export interface ApiNotification {
  id: string;
  type: 'appointment' | 'lab_result' | 'prescription' | 'message' | 'alert' | 'general';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface ApiAiHealthInsight {
  summary?: string;
  keyFindings?: string[];
  recommendations?: string[];
  lastAssessedAt?: string;
  overallScore?: number;
}

export interface ApiAdmission {
  id: string;
  ward?: string;
  bedNumber?: string;
  room?: string;
  attendingDoctor?: string;
  admissionDate?: string;
  admissionReason?: string;
  status?: string;
}

export interface ApiImmunization {
  id: string;
  vaccineName: string;
  vaccineCode?: string;
  dateAdministered?: string;
  doseNumber?: number;
  administeredBy?: string;
  nextDoseDate?: string;
}

export interface ApiImmunizationForecast {
  vaccineName: string;
  dueDate: string;
  status: 'due' | 'overdue' | 'upcoming';
}

export const PatientPortalService = {
  getNotifications: () =>
    api.get<ApiNotification[]>('/patient-portal/notifications').then(r => r.data ?? []),

  markNotificationRead: (id: string) =>
    api.patch<void>(`/patient-portal/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    api.patch<void>('/patient-portal/notifications/read-all').then(r => r.data),

  getAiInsights: () =>
    api.get<ApiAiHealthInsight>('/patient-portal/ai-insights').then(r => r.data),

  getCurrentAdmission: () =>
    api.get<ApiAdmission | null>('/patient-portal/current-admission').then(r => r.data),

  getImmunizations: () =>
    api.get<ApiImmunization[]>('/patient-portal/immunizations').then(r => r.data ?? []),

  getImmunizationForecast: () =>
    api.get<ApiImmunizationForecast[]>('/patient-portal/immunization-forecast').then(r => r.data ?? []),
};
