import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface LabResult {
  id: string;
  patientId: string;
  testName: string;
  value?: string;
  unit?: string;
  status: string;
  orderedDate?: string;
  resultDate?: string;
  referenceRange?: string;
  notes?: string;
}

const labService = {
  /**
   * Get lab results for a patient
   * @param patientId - Patient ID
   * @returns Array of lab results
   */
  getPatientLabResults: async (patientId: string): Promise<LabResult[]> => {
    try {
      // Correct endpoint: /lab-orders/patient/:patientId/results
      const response = await ehrApi.get(API_ENDPOINTS.LAB_ORDERS.PATIENT_RESULTS(patientId));
      
      return Array.isArray(response) ? response : (response.data || response.results || []);
    } catch (error: any) {
      console.error('Error getting lab results:', error);
      return []; // Return empty array on error to prevent breaking the UI
    }
  },

  /**
   * Get lab result by ID
   * @param labResultId - Lab result ID
   * @returns Lab result details
   */
  getLabResultById: async (labResultId: string): Promise<LabResult> => {
    try {
      const response = await ehrApi.get(`/lab-orders/${labResultId}`);
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting lab result:', error);
      throw error;
    }
  },
};

export default labService;

