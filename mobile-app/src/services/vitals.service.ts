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
  bloodGlucose?: number;
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
      if (vitals.length > 0) {
        const latest = vitals[0];
        console.log('🩺 [VitalsService] Latest vitals raw:', JSON.stringify(latest, null, 2));
        
        // Parse blood pressure if it's stored as a string (e.g., "120/80")
        // Backend should now return bloodPressureSystolic/diastolic, but handle both formats
        if ((latest.bloodPressureSystolic === undefined || latest.bloodPressureDiastolic === undefined)) {
          const bpString = (latest as any).bloodPressure || (latest as any).blood_pressure;
          if (bpString && typeof bpString === 'string') {
            const bpMatch = bpString.match(/(\d+)\s*\/\s*(\d+)/);
            if (bpMatch) {
              latest.bloodPressureSystolic = parseInt(bpMatch[1], 10);
              latest.bloodPressureDiastolic = parseInt(bpMatch[2], 10);
              console.log('🩺 [VitalsService] Parsed BP from string:', latest.bloodPressureSystolic, '/', latest.bloodPressureDiastolic);
            }
          }
        } else {
          console.log('🩺 [VitalsService] BP already parsed:', latest.bloodPressureSystolic, '/', latest.bloodPressureDiastolic);
        }
        
        console.log('🩺 [VitalsService] Final latest vitals:', JSON.stringify(latest, null, 2));
        return latest;
      }
      return null;
    } catch (error) {
      console.error('🩺 [VitalsService] Error getting latest vitals:', error);
      return null;
    }
  }
}

export default new VitalsService();

