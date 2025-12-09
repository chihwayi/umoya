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
      
      // Filter for active prescriptions - handle different status formats
      return prescriptions.filter((p: Prescription) => {
        const status = (p.status || '').toLowerCase();
        const isActive = status === 'active' || status === PrescriptionStatus?.ACTIVE?.toLowerCase();
        const hasEndDate = p.endDate && new Date(p.endDate) > new Date();
        const noEndDate = !p.endDate;
        return isActive || hasEndDate || noEndDate;
      });
    } catch (error: any) {
      console.error('Error getting active prescriptions:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      // Return empty array on error to prevent breaking the UI
      // The UI already handles empty arrays gracefully
      return [];
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

  /**
   * Create a new prescription
   * @param prescriptionData - Prescription data
   * @returns Created prescription
   */
  createPrescription: async (prescriptionData: {
    patientId: string;
    medicationName: string;
    medicationId?: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
    quantity?: number;
    medicationNameSnomed?: {
      conceptId: string;
      term: string;
    };
  }): Promise<Prescription> => {
    try {
      // Calculate end date from duration
      const startDate = new Date();
      const durationMatch = prescriptionData.duration.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
      let endDate: Date | null = null;
      
      if (durationMatch) {
        const amount = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        endDate = new Date(startDate);
        
        if (unit.includes('day')) {
          endDate.setDate(endDate.getDate() + amount);
        } else if (unit.includes('week')) {
          endDate.setDate(endDate.getDate() + (amount * 7));
        } else if (unit.includes('month')) {
          endDate.setMonth(endDate.getMonth() + amount);
        }
      }

      const payload: any = {
        patientId: prescriptionData.patientId,
        medicationName: prescriptionData.medicationName,
        dosage: prescriptionData.dosage,
        frequency: prescriptionData.frequency,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        instructions: prescriptionData.instructions,
        quantity: prescriptionData.quantity,
        status: 'active',
      };

      // Add SNOMED code if available
      if (prescriptionData.medicationNameSnomed) {
        payload.medicationNameSnomed = prescriptionData.medicationNameSnomed;
      }

      const response = await ehrApi.post(API_ENDPOINTS.PRESCRIPTION.CREATE, payload);
      return response.data || response;
    } catch (error: any) {
      console.error('Error creating prescription:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      throw error;
    }
  },
};

export default prescriptionService;


