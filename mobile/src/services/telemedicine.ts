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

interface PortalConsultationListResponse {
  consultations: any[];
  total: number;
  page: number;
  limit: number;
}

interface MeetingUrlResponse {
  meetingUrl?: string;
  roomUrl?: string;
  meetingRoomId?: string;
  roomName?: string;
}

interface MeetingTokenResponse {
  token: string;
  meetingUrl?: string;
  roomUrl?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
}

function mapConsultationStatus(status: string | undefined): ApiConsultation['status'] {
  if (status === 'in_progress' || status === 'technical_issue') return 'active';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'no_show') return 'no_show';
  return 'scheduled';
}

function mapConsultation(raw: any): ApiConsultation {
  return {
    id: raw.id,
    patientId: raw.patientId ?? raw.patient_id,
    doctorId: raw.doctorId ?? raw.doctor_id,
    doctorName: raw.doctorName ?? raw.doctor_name,
    doctorSpecialty: raw.doctorSpecialty ?? raw.doctor_specialty,
    scheduledAt: raw.scheduledAt ?? raw.scheduled_start_time ?? raw.appointmentDate,
    status: mapConsultationStatus(raw.status),
    consultationType: raw.consultationType ?? raw.consultation_type,
    notes: raw.notes,
    roomUrl: raw.roomUrl ?? raw.meetingUrl ?? raw.meeting_url,
    roomName: raw.roomName ?? raw.meetingRoomId ?? raw.meeting_room_id,
    patientJoinedAt: raw.patientJoinedAt ?? raw.patient_join_time,
    doctorJoinedAt: raw.doctorJoinedAt ?? raw.doctor_join_time,
    endedAt: raw.endedAt ?? raw.actual_end_time,
    durationMinutes: raw.durationMinutes ?? raw.duration_minutes,
    patientConnectionQuality: raw.patientConnectionQuality ?? raw.patient_connection_quality,
  };
}

export const TelemedicineService = {
  /** List consultations for the logged-in patient */
  list: (_patientId?: string) =>
    api.get<PortalConsultationListResponse>(`/patient-portal/telemedicine/consultations`)
      .then(r => (r.data.consultations ?? []).map(mapConsultation)),

  /** Get single consultation */
  get: (id: string) =>
    api.get<any>(`/patient-portal/telemedicine/consultation/${id}`).then(r => mapConsultation(r.data)),

  /** Get the meeting URL for a consultation */
  getMeetingUrl: (id: string) =>
    api.get<MeetingUrlResponse>(`/patient-portal/telemedicine/consultation/${id}/meeting-url`)
      .then(r => ({
        roomUrl: r.data.roomUrl ?? r.data.meetingUrl ?? '',
        roomName: r.data.roomName ?? r.data.meetingRoomId ?? '',
      })),

  /** Get a signed Daily.co meeting token */
  getToken: (id: string, _role: 'patient' | 'doctor' = 'patient') =>
    api.get<MeetingTokenResponse>(`/patient-portal/telemedicine/consultation/${id}/token`)
      .then(r => ({
        token: r.data.token,
        roomUrl: r.data.roomUrl ?? r.data.meetingUrl ?? '',
        expiresAt: r.data.expiresAt,
      })),

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
  join: (id: string, _role: 'patient' | 'doctor' = 'patient') =>
    api.post<any>(`/patient-portal/telemedicine/consultation/${id}/join`, {}).then(r => mapConsultation(r.data)),

  /** Record patient satisfaction after call */
  rateSatisfaction: (id: string, rating: number, comment?: string) =>
    api.post<void>(`/patient-portal/telemedicine/consultation/${id}/satisfaction`, { rating, comment })
      .then(r => r.data).catch(() => {}),

  /** Get live room status (participant count) */
  roomStatus: (id: string) =>
    api.get<{ participants: number; isActive?: boolean; isLive?: boolean }>(`/patient-portal/telemedicine/consultation/${id}/status`)
      .then(r => ({ participants: r.data.participants, isLive: r.data.isLive ?? r.data.isActive ?? false })),
};
