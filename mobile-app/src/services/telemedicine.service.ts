import { ehrApi } from '../config/api';

export interface TelemedicineConsultation {
  id: string;
  patientId: string;
  providerId: string;
  providerName?: string;
  scheduledAt: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  type: 'video' | 'audio' | 'chat';
  meetingUrl?: string;
  notes?: string;
  duration?: number;
}

class TelemedicineService {
  /**
   * Get consultations for patient
   */
  async getConsultations(filters?: { patientId?: string; status?: string }): Promise<TelemedicineConsultation[]> {
    try {
      const params = filters || {};
      const response = await ehrApi.get('/telemedicine/consultations', { params });
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch consultations');
    }
  }

  /**
   * Get consultation by ID
   */
  async getConsultation(consultationId: string): Promise<TelemedicineConsultation> {
    try {
      const response = await ehrApi.get(`/telemedicine/consultations/${consultationId}`);
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch consultation');
    }
  }

  /**
   * Get meeting URL for consultation
   */
  async getMeetingUrl(consultationId: string): Promise<string> {
    try {
      const response = await ehrApi.get(`/telemedicine/consultations/${consultationId}/meeting-url`);
      return response.data?.meetingUrl || response.data?.url || response.data || '';
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get meeting URL');
    }
  }

  /**
   * Join consultation
   */
  async joinConsultation(consultationId: string, joinData?: any): Promise<any> {
    try {
      const response = await ehrApi.post(`/telemedicine/consultations/${consultationId}/join`, joinData || {});
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to join consultation');
    }
  }

  /**
   * Schedule new consultation
   */
  async scheduleConsultation(consultationData: {
    providerId: string;
    scheduledAt: string;
    type: 'video' | 'audio' | 'chat';
    notes?: string;
  }): Promise<TelemedicineConsultation> {
    try {
      const response = await ehrApi.post('/telemedicine/consultations', consultationData);
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to schedule consultation');
    }
  }
}

export default new TelemedicineService();
