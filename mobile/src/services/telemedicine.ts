import { api } from './api';

export interface ApiConsultation {
  id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  scheduledAt?: string;
  status: 'scheduled' | 'waiting' | 'active' | 'completed' | 'cancelled' | 'no_show';
  consultationType?: string;
  notes?: string;
  roomUrl?: string;
  roomName?: string;
  patientJoinedAt?: string;
  doctorJoinedAt?: string;
  endedAt?: string;
  durationMinutes?: number;
  patientConnectionQuality?: string;
}

export interface MeetingAccess {
  roomUrl: string;
  token: string;
  consultationId: string;
}

export const TelemedicineService = {
  /** List consultations for the logged-in patient */
  list: (patientId?: string) => {
    const qs = patientId ? `?patientId=${patientId}` : '';
    return api.get<ApiConsultation[]>(`/telemedicine/consultations${qs}`).then(r => r.data);
  },

  /** Get single consultation */
  get: (id: string) =>
    api.get<ApiConsultation>(`/telemedicine/consultations/${id}`).then(r => r.data),

  /** Get the meeting URL for a consultation */
  getMeetingUrl: (id: string) =>
    api.get<{ roomUrl: string; roomName: string }>(`/telemedicine/consultations/${id}/meeting-url`)
      .then(r => r.data),

  /** Get a signed Daily.co meeting token */
  getToken: (id: string, role: 'patient' | 'doctor' = 'patient') =>
    api.get<{ token: string; roomUrl: string; expiresAt?: string }>(
      `/telemedicine/consultations/${id}/token?role=${role}`,
    ).then(r => r.data),

  /**
   * One-shot helper: get room URL + token together
   * Returns everything needed to open the Daily.co WebView.
   */
  getMeetingAccess: async (id: string, role: 'patient' | 'doctor' = 'patient'): Promise<MeetingAccess> => {
    const [urlRes, tokenRes] = await Promise.all([
      TelemedicineService.getMeetingUrl(id),
      TelemedicineService.getToken(id, role),
    ]);
    const roomUrl = tokenRes.roomUrl ?? urlRes.roomUrl;
    return { roomUrl, token: tokenRes.token, consultationId: id };
  },

  /** Join consultation (registers participant) */
  join: (id: string, role: 'patient' | 'doctor' = 'patient') =>
    api.post<ApiConsultation>(`/telemedicine/consultations/${id}/join`, { role }).then(r => r.data),

  /** End consultation */
  end: (id: string) =>
    api.post<ApiConsultation>(`/telemedicine/consultations/${id}/end`, {}).then(r => r.data),

  /** Report connection quality */
  reportQuality: (id: string, quality: 'excellent' | 'good' | 'fair' | 'poor', role: 'patient' | 'doctor' = 'patient') =>
    api.post<void>(`/telemedicine/consultations/${id}/connection-quality?role=${role}&quality=${quality}`, {})
      .then(r => r.data).catch(() => {}),

  /** Record patient satisfaction after call */
  rateSatisfaction: (id: string, rating: number, comment?: string) =>
    api.post<void>(`/telemedicine/consultations/${id}/satisfaction`, { rating, comment })
      .then(r => r.data).catch(() => {}),

  /** Get live room status (participant count) */
  roomStatus: (id: string) =>
    api.get<{ participants: number; isLive: boolean }>(`/telemedicine/consultations/${id}/status`)
      .then(r => r.data),
};
