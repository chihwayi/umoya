import { api } from './api';

export interface ApiAppointment {
  id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  appointmentDate?: string;
  scheduledAt?: string;
  startTime?: string;
  endTime?: string;
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  appointmentType?: string;
  type?: string;
  notes?: string;
  location?: string;
  clinicName?: string;
  isTelemedicine?: boolean;
  telemedicineConsultationId?: string;
}

export const AppointmentsService = {
  /** Patient's upcoming appointments (via patient portal) */
  upcoming: (patientId?: string) =>
    api.get<ApiAppointment[]>(
      `/patient-portal/appointments?status=scheduled,confirmed&limit=5`,
    ).then(r => r.data).catch(() =>
      api.get<{ data: ApiAppointment[]; total: number }>(
        `/appointments?patientId=${patientId ?? ''}&status=scheduled&limit=5`,
      ).then(r => r.data?.data ?? [])
    ),

  /** All appointments for a patient */
  forPatient: (patientId: string, status?: string) => {
    const qs = status ? `&status=${status}` : '';
    return api.get<ApiAppointment[]>(
      `/patient-portal/appointments?patientId=${patientId}${qs}`,
    ).then(r => r.data);
  },

  /** Book a new appointment */
  book: (dto: Partial<ApiAppointment>) =>
    api.post<ApiAppointment>('/patient-portal/appointments/request', dto).then(r => r.data),

  /** Cancel an appointment */
  cancel: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/patient-portal/appointments/${id}`).then(r => r.data as any),
};
