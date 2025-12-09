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
      console.log('🔍 [PatientService] Searching patients with query:', query);
      const endpoint = `${API_ENDPOINTS.PATIENT.SEARCH}?q=${encodeURIComponent(query)}`;
      console.log('🔍 [PatientService] Using endpoint:', endpoint);
      console.log('🔍 [PatientService] Full URL would be:', `BASE_URL${endpoint}`);
      
      // Axios interceptor automatically adds auth token and tenant header
      const response = await ehrApi.get(endpoint);

      console.log('🔍 [PatientService] Raw response:', response);
      console.log('🔍 [PatientService] Response type:', typeof response);
      console.log('🔍 [PatientService] Is array?', Array.isArray(response));
      console.log('🔍 [PatientService] Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'N/A');

      // Backend returns array directly (Promise<Patient[]>)
      // But ehrApi.get returns response.data, so we need to check the structure
      let patients: Patient[] = [];
      
      // The backend controller returns Patient[] directly
      // ehrApi.get() returns response.data, so if backend returns array, response should be array
      if (Array.isArray(response)) {
        patients = response;
        console.log('🔍 [PatientService] Response is array, using directly');
      } else if (response?.data && Array.isArray(response.data)) {
        patients = response.data;
        console.log('🔍 [PatientService] Response has data array');
      } else if (response?.patients && Array.isArray(response.patients)) {
        patients = response.patients;
        console.log('🔍 [PatientService] Response has patients array');
      } else if (response && typeof response === 'object') {
        // Try to extract array from response object
        const keys = Object.keys(response);
        console.log('🔍 [PatientService] Checking response keys for array:', keys);
        for (const key of keys) {
          if (Array.isArray(response[key])) {
            patients = response[key];
            console.log(`🔍 [PatientService] Found array in key: ${key}`);
            break;
          }
        }
      }

      console.log('🔍 [PatientService] Final extracted patients count:', patients.length);
      if (patients.length > 0) {
        console.log('🔍 [PatientService] First patient sample:', JSON.stringify(patients[0], null, 2));
      } else {
        console.warn('⚠️ [PatientService] No patients found. Full response:', JSON.stringify(response, null, 2));
      }
      
      return patients;
    } catch (error: any) {
      console.error('❌ [PatientService] Error searching patients:', error);
      console.error('❌ [PatientService] Error response:', error.response?.data);
      console.error('❌ [PatientService] Error status:', error.response?.status);
      console.error('❌ [PatientService] Error config:', error.config);
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

