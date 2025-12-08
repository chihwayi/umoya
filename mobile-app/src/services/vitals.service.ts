import { ehrApi } from '../config/api';

export interface Vitals {
  id?: string;
  patientId: string;
  recordedAt: string;
  recordedBy?: string;
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  notes?: string;
}

class VitalsService {
  /**
   * Record vitals for patient
   */
  async recordVitals(data: Vitals): Promise<Vitals> {
    try {
      const response = await ehrApi.post('/vitals', data);
      return response.vitals || response.data || response;
    } catch (error: any) {
      console.error('Error recording vitals:', error);
      throw new Error(error.response?.data?.message || 'Failed to record vitals');
    }
  }

  /**
   * Get patient vitals history
   */
  async getPatientVitals(patientId: string): Promise<Vitals[]> {
    try {
      const response = await ehrApi.get(`/vitals/patient/${patientId}`);
      return response.vitals || response.data || response || [];
    } catch (error: any) {
      console.error('Error getting vitals:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Get latest vitals for patient
   */
  async getLatestVitals(patientId: string): Promise<Vitals | null> {
    try {
      const vitals = await this.getPatientVitals(patientId);
      return vitals.length > 0 ? vitals[0] : null;
    } catch (error) {
      return null;
    }
  }
}

export default new VitalsService();

