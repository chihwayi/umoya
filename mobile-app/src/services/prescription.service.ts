import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface Prescription {
  id: string;
  patientId: string;
  medication: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  startDate: string;
  endDate?: string;
  status: string;
  prescribedBy?: string;
  createdAt?: string;
}

const prescriptionService = {
  /**
   * Get active prescriptions for a patient
   * @param patientId - Patient ID
   * @returns Array of active prescriptions
   */
  getActivePrescriptions: async (patientId: string): Promise<Prescription[]> => {
    try {
      // Axios interceptor automatically adds auth token and tenant header
      const response = await ehrApi.get(API_ENDPOINTS.PRESCRIPTION.PATIENT(patientId));
      
      // Filter for active prescriptions if needed, or return all
      const prescriptions = Array.isArray(response) ? response : (response.data || response.prescriptions || []);
      return prescriptions.filter((p: Prescription) => p.status === 'active' || !p.endDate || new Date(p.endDate) > new Date());
    } catch (error: any) {
      console.error('Error getting active prescriptions:', error);
      return []; // Return empty array on error to prevent breaking the UI
    }
  },

  /**
   * Get prescription by ID
   * @param prescriptionId - Prescription ID
   * @returns Prescription details
   */
  getPrescriptionById: async (prescriptionId: string): Promise<Prescription> => {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.PRESCRIPTION.BY_ID(prescriptionId));
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting prescription:', error);
      throw error;
    }
  },

  /**
   * Update prescription
   * @param prescriptionId - Prescription ID
   * @param updateData - Update data
   * @returns Updated prescription
   */
  updatePrescription: async (prescriptionId: string, updateData: Partial<Prescription>): Promise<Prescription> => {
    try {
      const response = await ehrApi.patch(API_ENDPOINTS.PRESCRIPTION.BY_ID(prescriptionId), updateData);
      return response.data || response;
    } catch (error: any) {
      console.error('Error updating prescription:', error);
      throw error;
    }
  },

  /**
   * Get all prescriptions (including inactive)
   * @param patientId - Patient ID
   * @returns Array of all prescriptions
   */
  getAllPrescriptions: async (patientId: string): Promise<Prescription[]> => {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.PRESCRIPTION.PATIENT(patientId));
      const prescriptions = Array.isArray(response) ? response : (response.data || response.prescriptions || []);
      return prescriptions;
    } catch (error: any) {
      console.error('Error getting all prescriptions:', error);
      return [];
    }
  },
};

export default prescriptionService;


