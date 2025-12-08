import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  patientNumber?: string;
  medicalAidNumber?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const patientService = {
  /**
   * Search patients by query string
   * @param query - Search term (name, ID, phone, etc.)
   * @returns Array of matching patients
   */
  searchPatients: async (query: string): Promise<Patient[]> => {
    try {
      console.log('🔍 Searching patients with query:', query);
      console.log('🔍 Using endpoint:', `${API_ENDPOINTS.PATIENT.SEARCH}?q=${encodeURIComponent(query)}`);
      
      // Axios interceptor automatically adds auth token and tenant header
      const response = await ehrApi.get(
        `${API_ENDPOINTS.PATIENT.SEARCH}?q=${encodeURIComponent(query)}`
      );

      console.log('🔍 Search response:', response);
      console.log('🔍 Response type:', typeof response);
      console.log('🔍 Is array?', Array.isArray(response));

      // Backend returns array directly or wrapped in data
      let patients: Patient[] = [];
      
      if (Array.isArray(response)) {
        patients = response;
      } else if (response?.data) {
        patients = Array.isArray(response.data) ? response.data : [];
      } else if (response?.patients) {
        patients = Array.isArray(response.patients) ? response.patients : [];
      } else if (response && typeof response === 'object') {
        // Try to extract array from response object
        const keys = Object.keys(response);
        for (const key of keys) {
          if (Array.isArray(response[key])) {
            patients = response[key];
            break;
          }
        }
      }

      console.log('🔍 Extracted patients:', patients.length);
      return patients;
    } catch (error: any) {
      console.error('❌ Error searching patients:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      throw error;
    }
  },

  /**
   * Get patient by ID
   * @param patientId - Patient ID
   * @returns Patient details
   */
  getPatientById: async (patientId: string): Promise<Patient> => {
    try {
      // Axios interceptor automatically adds auth token and tenant header
      const response = await ehrApi.get(API_ENDPOINTS.PATIENT.BY_ID(patientId));
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting patient:', error);
      throw error;
    }
  },

  /**
   * Get patient profile (alias for getPatientById)
   * @param patientId - Patient ID
   * @returns Patient details
   */
  getPatientProfile: async (patientId: string): Promise<Patient> => {
    return patientService.getPatientById(patientId);
  },

  /**
   * Get all patients with pagination
   * @param page - Page number (default: 1)
   * @param limit - Results per page (default: 20)
   * @returns Paginated patient list
   */
  getAllPatients: async (page: number = 1, limit: number = 20): Promise<{ patients: Patient[]; total: number; pages: number }> => {
    try {
      // Axios interceptor automatically adds auth token and tenant header
      const response = await ehrApi.get(
        `${API_ENDPOINTS.PATIENT.LIST}?page=${page}&limit=${limit}`
      );
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting patients:', error);
      throw error;
    }
  },
};

export default patientService;

