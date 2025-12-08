import { ehrApi } from '../config/api';

export interface MAREntry {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  scheduledTime: string;
  administeredTime?: string;
  status: 'scheduled' | 'administered' | 'missed' | 'refused';
  administeredBy?: string;
  notes?: string;
  dosage: string;
  route?: string;
}

class MARService {
  /**
   * Get MAR for patient
   */
  async getPatientMAR(patientId: string, date?: string): Promise<MAREntry[]> {
    try {
      const url = date ? `/mar/patient/${patientId}?date=${date}` : `/mar/patient/${patientId}`;
      const response = await ehrApi.get(url);
      return response.data || response.entries || response || [];
    } catch (error: any) {
      console.error('Error getting MAR:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Get today's MAR for patient
   */
  async getTodayMAR(patientId: string): Promise<MAREntry[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getPatientMAR(patientId, today);
  }

  /**
   * Record medication administration
   */
  async recordAdministration(
    entryId: string,
    data: {
      administeredTime: string;
      notes?: string;
    }
  ): Promise<MAREntry> {
    try {
      const response = await ehrApi.post(`/mar/${entryId}/administer`, data);
      return response.data || response.entry || response;
    } catch (error: any) {
      console.error('Error recording administration:', error);
      throw new Error(error.response?.data?.message || 'Failed to record administration');
    }
  }

  /**
   * Mark medication as missed
   */
  async markMissed(entryId: string, reason?: string): Promise<MAREntry> {
    try {
      const response = await ehrApi.post(`/mar/${entryId}/missed`, { reason });
      return response.data || response.entry || response;
    } catch (error: any) {
      console.error('Error marking as missed:', error);
      throw new Error(error.response?.data?.message || 'Failed to mark as missed');
    }
  }
}

export default new MARService();

