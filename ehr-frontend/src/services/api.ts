import axios from 'axios';
import { handleAutoLogout } from '../utils/autoLogout';

const TENANT_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const EHR_API_URL = process.env.REACT_APP_EHR_API_URL || 'http://localhost:3013/api';

// Create axios instance with response interceptor
const createAxiosInstance = (baseURL: string) => {
  const instance = axios.create({ baseURL });
  
  // Response interceptor to handle 401 errors
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.log('🚨 401 Unauthorized detected - triggering auto-logout');
        handleAutoLogout();
      }
      return Promise.reject(error);
    }
  );
  
  return instance;
};

// Create instances
const tenantAxios = createAxiosInstance(TENANT_API_URL);
const ehrAxios = createAxiosInstance(EHR_API_URL);

export const tenantApi = {
  getActiveTenants: async () => {
    const response = await tenantAxios.get('/tenants');
    return { data: response.data.filter((tenant: any) => tenant.status === 'active') };
  }
};

export const chartApi = {
  getProblems: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/problems/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },
  replaceProblems: async (patientId: string, problems: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/problems/patient/${patientId}`, { problems }, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },
  getAllergies: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/allergies/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },
  replaceAllergies: async (patientId: string, allergies: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/allergies/patient/${patientId}`, { allergies }, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  }
};

export const ehrApi = {
  login: async (email: string, password: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/auth/login', { email, password }, {
      headers: { 'X-Tenant-ID': tenantSlug }
    });
    return { data: response.data };
  },

  changePassword: async (currentPassword: string, newPassword: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put('/auth/change-password', {
      oldPassword: currentPassword,
      newPassword: newPassword
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getProfile: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/auth/profile', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // User Management
  getUsers: async (token: string, tenantSlug: string, role?: string) => {
    const params = role ? { role } : {};
    const response = await ehrAxios.get('/users', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  createUser: async (userData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/users', userData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  resetUserPassword: async (userId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/users/${userId}/reset-password`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deactivateUser: async (userId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/users/${userId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  activateUser: async (userId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/users/${userId}/activate`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Patient Management
  getPatients: async (token: string, tenantSlug: string, page?: number, limit?: number) => {
    const params = { page, limit };
    const response = await ehrAxios.get('/patients', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  getPatientStats: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/patients/stats', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  searchPatients: async (query: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/patients/search', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { q: query }
    });
    return { data: response.data };
  },

  createPatient: async (patientData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/patients', patientData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientById: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

      // Appointment Management
      getAppointments: async (token: string, tenantSlug: string, params?: any) => {
        const response = await ehrAxios.get('/appointments', {
          headers: { 
            'X-Tenant-ID': tenantSlug,
            'Authorization': `Bearer ${token}`
          },
          params
        });
        return { data: response.data };
      },

      getAvailableSlots: async (doctorId: string, date: string, token: string, tenantSlug: string) => {
        const response = await ehrAxios.get(`/appointments/doctor/${doctorId}/available-slots`, {
          headers: { 
            'X-Tenant-ID': tenantSlug,
            'Authorization': `Bearer ${token}`
          },
          params: { date }
        });
        // The API returns an array directly, not wrapped in a data object
        return { data: response.data };
      },

  createAppointment: async (appointmentData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/appointments', appointmentData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateAppointmentStatus: async (appointmentId: string, status: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/appointments/${appointmentId}/status`, { status }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  startAppointment: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/appointments/${appointmentId}/start`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  completeAppointment: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/appointments/${appointmentId}/complete`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateAppointment: async (appointmentId: string, appointmentData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/appointments/${appointmentId}`, appointmentData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Vitals API
  recordVitals: async (vitalsData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/vitals', vitalsData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getVitals: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/vitals/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Triage API
  recordTriageAssessment: async (triageData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/triage', triageData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getTriageAssessments: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/triage/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Nursing Notes API
  recordNursingNote: async (noteData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/nursing-notes', noteData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getNursingNotes: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/nursing-notes/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Orders API
  getAuthorizedOrders: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/orders/authorized', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeOrder: async (orderId: string, executionNotes: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/orders/${orderId}/execute`, {
      executionNotes
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createOrder: async (orderData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/orders', orderData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  }
  ,

  // CDSS API
  checkCdssDrugInteractions: async (drugIds: string[], patientId: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/drug-interactions', {
      drugIds,
      patientId
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getClinicalGuidelines: async (condition: string, patientData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/guidelines', {
      condition,
      patientData
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getRiskAssessment: async (patientData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/risk-assessment', patientData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getDiagnosisSuggestions: async (symptoms: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/diagnosis-assist', symptoms, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getDosingRecommendation: async (dosingRequest: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/dosing-recommendation', dosingRequest, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  interpretLabResults: async (labResults: any, historicalLabs: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/labs/interpret', {
      labResults,
      historicalLabs
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  detectDuplicateTherapy: async (medications: any[], prescriptions: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/medications/duplicates', {
      medications,
      prescriptions
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkHighRiskMedications: async (medications: any[], patientAge: number, patientGender: string, diagnoses: string[], renalFunction: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/medications/high-risk', {
      medications,
      patientAge,
      patientGender,
      diagnoses,
      renalFunction
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  detectCareGaps: async (patientAge: number, patientGender: string, visitHistory: any[], diagnoses: string[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/care-gaps/detect', {
      patientAge,
      patientGender,
      visitHistory,
      diagnoses
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  authorizeOrder: async (orderId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/orders/${orderId}/authorize`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Prescriptions API
  createPrescription: async (createDto: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/prescriptions', createDto, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientPrescriptions: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/prescriptions/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Orders API
  createLabOrder: async (orderData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/lab-orders', orderData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getLabOrders: async (query: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/lab-orders', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: query
    });
    return { data: response.data };
  },

  getPatientLabResults: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/lab-orders/patient/${patientId}/results`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Technician API
  getPendingLabOrders: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/lab-orders/pending', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getInProgressLabOrders: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/lab-orders/in-progress', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getLabQualityControls: async (
    token: string,
    tenantSlug: string,
    params: { analyzer?: string; status?: string; limit?: number } = {},
  ) => {
    const response = await ehrAxios.get('/lab-orders/quality-controls', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  createLabQualityControl: async (
    payload: {
      analyzer_name: string;
      test_code?: string;
      level?: string;
      lot_number?: string;
      run_datetime?: string;
      result_value?: string;
      status?: 'pending' | 'pass' | 'fail' | 'review';
      comments?: string;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/lab-orders/quality-controls', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getLabReagentInventory: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/lab-orders/inventory/reagents', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  upsertLabReagentInventory: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/lab-orders/inventory/reagents', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateLabReagentQuantity: async (
    id: string,
    payload: { quantity_available: number; status?: 'ok' | 'warning' | 'critical' | 'expired' },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.patch(`/lab-orders/inventory/reagents/${id}/quantity`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  collectLabSample: async (orderId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/collect`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  startProcessingLabOrder: async (orderId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/start-processing`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateLabProcessingContext: async (orderId: string, payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/processing-context`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  submitLabResults: async (orderId: string, resultsDto: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/submit-results`, resultsDto, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateLabOrderStatus: async (orderId: string, status: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/status`, { status }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Test Catalog API
  getLabTests: async (category?: string, search?: string, token?: string, tenantSlug?: string) => {
    const response = await ehrAxios.get('/lab-tests', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { category, search }
    });
    return { data: response.data };
  },

  getLabTestById: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/lab-tests/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  seedLabTests: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/lab-tests/seed', {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Order Sets API
  getLabOrderSets: async (category?: string, token?: string, tenantSlug?: string) => {
    const response = await ehrAxios.get('/lab-order-sets', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { category }
    });
    return { data: response.data };
  },

  getLabOrderSetById: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/lab-order-sets/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  seedLabOrderSets: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/lab-order-sets/seed', {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Enhanced Lab Test Catalog API
  getLabTestCatalog: async (tenantSlug: string, token: string, category?: string, active?: boolean) => {
    const response = await ehrAxios.get('/lab/test-catalog', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { category, active }
    });
    return { data: response.data };
  },

  searchLabTests: async (tenantSlug: string, token: string, query: string) => {
    const response = await ehrAxios.get('/lab/test-catalog/search', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { q: query }
    });
    return { data: response.data };
  },

  getLabTestCatalogById: async (tenantSlug: string, token: string, testId: string) => {
    const response = await ehrAxios.get(`/lab/test-catalog/${testId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getLabTestCategories: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/test-catalog/categories', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Enhanced Order Sets API
  getEnhancedOrderSets: async (tenantSlug: string, token: string, category?: string, active?: boolean) => {
    const response = await ehrAxios.get('/lab/order-sets-enhanced', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { category, active }
    });
    return { data: response.data };
  },

  getEnhancedOrderSetById: async (tenantSlug: string, token: string, orderSetId: string) => {
    const response = await ehrAxios.get(`/lab/order-sets-enhanced/${orderSetId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createOrdersFromSet: async (tenantSlug: string, token: string, data: any) => {
    const response = await ehrAxios.post('/lab/order-sets-enhanced/create-from-order-set', data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Critical Alerts API
  getLabCriticalAlerts: async (tenantSlug: string, token: string, filters?: any) => {
    const response = await ehrAxios.get('/lab/critical-alerts', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: filters
    });
    return { data: response.data };
  },

  getMyLabCriticalAlerts: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/critical-alerts/my-alerts', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPendingLabCriticalAlerts: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/critical-alerts/pending', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientLabCriticalAlerts: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/lab/critical-alerts/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  acknowledgeLabCriticalAlert: async (tenantSlug: string, token: string, alertId: string, data: any) => {
    const response = await ehrAxios.patch(`/lab/critical-alerts/${alertId}/acknowledge`, data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  escalateLabCriticalAlert: async (tenantSlug: string, token: string, alertId: string, data: any) => {
    const response = await ehrAxios.patch(`/lab/critical-alerts/${alertId}/escalate`, data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getLabCriticalAlertStats: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/critical-alerts/stats/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkAndGenerateAlerts: async (tenantSlug: string, token: string, data: any) => {
    const response = await ehrAxios.post('/lab/critical-alerts/check-and-generate', data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Critical Alerts API
  getPendingCriticalAlerts: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/critical-alerts/pending', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientCriticalAlerts: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/critical-alerts/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  acknowledgeCriticalAlert: async (alertId: string, notes: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/critical-alerts/${alertId}/acknowledge`, { notes }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  dismissCriticalAlert: async (alertId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/critical-alerts/${alertId}/dismiss`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Drugs API
  searchDrugs: async (token: string, tenantSlug: string, search?: string, drugClass?: string) => {
    const params: any = {};
    if (search) params.search = search;
    if (drugClass) params.drugClass = drugClass;
    
    const response = await ehrAxios.get('/drugs', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  getDrugById: async (drugId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/drugs/${drugId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  searchDrugByName: async (name: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/drugs/search', { name }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkDrugInteractions: async (drugIds: string[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/drugs/check-interactions', { drugIds }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkFoodInteractions: async (medications: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/medications/food-interactions', {
      medications
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  seedDrugs: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/drugs/seed', {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // HIV/AIDS/TB APIs
  createHivTest: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/tests', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getPatientHivTests: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/tests/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  processHivAlgorithm: async (testId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/hiv/tests/${testId}/process-algorithm`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  enrollInHivCare: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/enrollments', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivEnrollments: async (status: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/enrollments', {
      params: { status },
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getPatientHivEnrollment: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/enrollments/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivEnrollmentById: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/enrollments/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: { enrollment: response.data } };
  },
  createTbScreening: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/tb-screenings', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  createCervicalCancerScreening: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/cervical-cancer-screenings', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  createHivClinicalVisit: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/visits', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivClinicalVisits: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/visits/enrollment/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivVisitCount: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/visits/count/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  saveArtInitiationDetails: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/art-initiation-details', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getHivLookupData: async (tableName: string, query: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/lookup/${tableName}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: query
    });
    return { data: response.data };
  },
  
  // EAC APIs
  createEacSession: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/eac/sessions', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getEacSessions: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/eac/enrollment/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  checkEacEligibility: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/eac/check/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  
  getMatchingLabResults: async (patientId: string, visitDate: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/lab-results/match`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { patientId, visitDate }
    });
    return { data: response.data };
  },
  
  // ARV Change Request APIs
  createArvChangeRequest: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/arv-change-requests', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getArvChangeRequests: async (status: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/arv-change-requests', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { status }
    });
    return { data: response.data };
  },
  approveArvChangeRequest: async (requestId: string, body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/hiv/arv-change-requests/${requestId}/approve`, body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  rejectArvChangeRequest: async (requestId: string, body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/hiv/arv-change-requests/${requestId}/reject`, body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getApprovedArvChange: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/arv-change-requests/enrollment/${enrollmentId}/approved`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // HIV Monitoring & Quality Metrics APIs
  getMonitoringSchedules: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/monitoring-schedules/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getQualityMetrics: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/quality-metrics', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getClinicalAlerts: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/alerts/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getAdherenceTracking: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/adherence/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getRegimenHistory: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/regimen-history/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  checkTptEligibility: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/tpt-eligibility/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getTptCompletionStatus: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/tpt-completion/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getVisitTemplates: async (visitType: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/visit-templates', {
      params: visitType ? { visitType } : {},
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  calculatePediatricDose: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/calculate-pediatric-dose', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getLTFUPatients: async (days: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/ltfu-patients', {
      params: { days },
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Referral Management
  createReferral: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/referrals', data, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getReferrals: async (query: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/referrals', {
      params: query,
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getEnrollmentReferrals: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/referrals/enrollment/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  updateReferralStatus: async (referralId: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/hiv/referrals/${referralId}/update-status`, data, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Audit Trail
  getAuditLog: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/audit-log/enrollment/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Medication Stock Management
  getMedicationStock: async (query: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/medication-stock', {
      params: query,
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  createMedicationStock: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/medication-stock', data, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  updateMedicationStock: async (stockId: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/hiv/medication-stock/${stockId}`, data, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Cohort Analysis
  getCohortAnalysis: async (cohortType: string, timeRange: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/cohort-analysis', {
      params: { type: cohortType, range: timeRange },
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Comparison Reports
  getComparisonReport: async (params: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/comparison-report', {
      params,
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Monthly Return Form
  getMonthlyReturn: async (year: number, month: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/monthly-return', {
      params: { year, month },
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ===== FINANCE & ACCOUNTS =====
  getFinanceSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/finance/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getFinancialTransactions: async (
    tenantSlug: string,
    token: string,
    params: {
      status?: string;
      module?: string;
      payerType?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) => {
    const response = await ehrAxios.get('/finance/transactions', {
      params,
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getFinancialTransactionDetail: async (tenantSlug: string, token: string, transactionId: string) => {
    const response = await ehrAxios.get(`/finance/transactions/${transactionId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordFinancialPayment: async (
    tenantSlug: string,
    token: string,
    transactionId: string,
    payload: { amount: number; paymentMethod: string; paymentReference?: string; gatewayReference?: string; note?: string },
  ) => {
    const response = await ehrAxios.post(`/finance/transactions/${transactionId}/payments`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // ===== ENHANCED LIS - CRITICAL ALERTS =====
  getCriticalAlertStats: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/critical-alerts/stats/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ===== RADIOLOGY & MEDICAL IMAGING API =====

  // Modalities & Study Types
  getImagingModalities: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/imaging/modalities', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingStudyTypes: async (tenantSlug: string, token: string, modalityCode?: string) => {
    const response = await ehrAxios.get('/imaging/study-types', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { modality: modalityCode }
    });
    return { data: response.data };
  },

  // Imaging Orders
  createImagingOrder: async (tenantSlug: string, token: string, orderData: any) => {
    const response = await ehrAxios.post('/imaging/orders', orderData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingOrders: async (tenantSlug: string, token: string, filters?: any) => {
    const response = await ehrAxios.get('/imaging/orders', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: filters
    });
    return { data: response.data };
  },

  getPatientImagingOrders: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/imaging/orders/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Imaging Studies
  getImagingStudy: async (tenantSlug: string, token: string, studyId: string) => {
    const response = await ehrAxios.get(`/imaging/studies/${studyId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingReportTemplates: async (tenantSlug: string, token: string, params: { modality?: string; study_type?: string } = {}) => {
    const response = await ehrAxios.get('/imaging/reports/templates', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  getImageAnnotations: async (tenantSlug: string, token: string, imageId: string) => {
    const response = await ehrAxios.get(`/imaging/images/${imageId}/annotations`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  addImageAnnotation: async (tenantSlug: string, token: string, imageId: string, annotation: { annotation_type: string; annotation_text?: string; annotation_data?: any }) => {
    const response = await ehrAxios.post(`/imaging/images/${imageId}/annotations`, annotation, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
 
  uploadImagingStudyImage: async (tenantSlug: string, token: string, studyId: string, payload: any) => {
    const response = await ehrAxios.post(`/imaging/studies/${studyId}/images`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deleteImagingStudyImage: async (tenantSlug: string, token: string, studyId: string, imageId: string) => {
    const response = await ehrAxios.delete(`/imaging/studies/${studyId}/images/${imageId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
 
  assignRadiologist: async (tenantSlug: string, token: string, studyId: string, radiologistId: string) => {
    const response = await ehrAxios.patch(`/imaging/studies/${studyId}/assign`, 
      { radiologist_id: radiologistId },
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return { data: response.data };
  },

  getRadiologistWorklist: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/imaging/worklist', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getMyImagingStudies: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/imaging/worklist/my-studies', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getDoctorImagingResults: async (
    tenantSlug: string,
    token: string,
    params: { status?: string; patient_id?: string } = {},
  ) => {
    const response = await ehrAxios.get('/imaging/doctor/results', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  acknowledgeImagingReport: async (
    tenantSlug: string,
    token: string,
    reportId: string,
    payload: { acknowledgment_notes?: string } = {},
  ) => {
    const response = await ehrAxios.post(`/imaging/reports/${reportId}/acknowledge`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // Imaging Reports
  createImagingReport: async (tenantSlug: string, token: string, reportData: any) => {
    const response = await ehrAxios.post('/imaging/reports', reportData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingReport: async (tenantSlug: string, token: string, reportId: string) => {
    const response = await ehrAxios.get(`/imaging/reports/${reportId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateImagingReport: async (tenantSlug: string, token: string, reportId: string, reportData: any) => {
    const response = await ehrAxios.patch(`/imaging/reports/${reportId}`, reportData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  signImagingReport: async (tenantSlug: string, token: string, reportId: string) => {
    const response = await ehrAxios.post(`/imaging/reports/${reportId}/sign`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ===== ONCOLOGY API =====

  getOncologyCases: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/oncology/cases', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getOncologyCaseDetail: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOncologyCase: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/oncology/cases', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOncologyCase: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/cases/${caseId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOncologyStagingEntry: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/staging`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOncologyRegimen: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/regimens`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOncologyRegimen: async (tenantSlug: string, token: string, regimenId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/regimens/${regimenId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyRegimenSessions: async (tenantSlug: string, token: string, regimenId: string) => {
    const response = await ehrAxios.get(`/oncology/regimens/${regimenId}/sessions`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOncologyInfusionSession: async (tenantSlug: string, token: string, regimenId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/regimens/${regimenId}/sessions`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOncologyInfusionSession: async (tenantSlug: string, token: string, sessionId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/sessions/${sessionId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyAdverseEvents: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/adverse-events`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordOncologyAdverseEvent: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/adverse-events`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getTumorBoardMeetings: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/oncology/tumor-board/meetings', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createTumorBoardMeeting: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/oncology/tumor-board/meetings', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addTumorBoardRecommendation: async (tenantSlug: string, token: string, meetingId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/tumor-board/meetings/${meetingId}/recommendations`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateTumorBoardRecommendation: async (tenantSlug: string, token: string, recommendationId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/tumor-board/recommendations/${recommendationId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyDashboardSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/oncology/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // ===== OPHTHALMOLOGY API =====

  getOphthalmologyEncounters: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/ophthalmology/encounters', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getOphthalmologyEncounterDetail: async (tenantSlug: string, token: string, encounterId: string) => {
    const response = await ehrAxios.get(`/ophthalmology/encounters/${encounterId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOphthalmologyEncounter: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/ophthalmology/encounters', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOphthalmologyEncounter: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.patch(`/ophthalmology/encounters/${encounterId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOphthalmologyVisualAcuity: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.post(`/ophthalmology/encounters/${encounterId}/visual-acuity`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOphthalmologyRefraction: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.post(`/ophthalmology/encounters/${encounterId}/refraction`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOphthalmologySlitLampFinding: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.post(`/ophthalmology/encounters/${encounterId}/slit-lamp`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOphthalmologyOctStudy: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.post(`/ophthalmology/encounters/${encounterId}/oct`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  scheduleOphthalmologyFollowUp: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/ophthalmology/follow-ups', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOphthalmologyFollowUp: async (tenantSlug: string, token: string, followUpId: string, payload: any) => {
    const response = await ehrAxios.patch(`/ophthalmology/follow-ups/${followUpId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOphthalmologyFollowUps: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/ophthalmology/patients/${patientId}/follow-ups`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordOphthalmologyProcedure: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/ophthalmology/procedures', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOphthalmologyProcedures: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/ophthalmology/patients/${patientId}/procedures`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOphthalmologyDashboardSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/ophthalmology/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // ===== MATERNITY & OBSTETRICS API =====

  // Enrollments
  createMaternityEnrollment: async (tenantSlug: string, token: string, enrollmentData: any) => {
    const response = await ehrAxios.post('/maternity/enrollments', enrollmentData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getMaternityEnrollments: async (tenantSlug: string, token: string, filters?: any) => {
    const response = await ehrAxios.get('/maternity/enrollments', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: filters
    });
    return { data: response.data };
  },

  getMaternityEnrollment: async (tenantSlug: string, token: string, enrollmentId: string) => {
    const response = await ehrAxios.get(`/maternity/enrollments/${enrollmentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ANC Visits
  createANCVisit: async (tenantSlug: string, token: string, visitData: any) => {
    const response = await ehrAxios.post('/maternity/anc-visits', visitData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getEnrollmentANCVisits: async (tenantSlug: string, token: string, enrollmentId: string) => {
    const response = await ehrAxios.get(`/maternity/anc-visits/enrollment/${enrollmentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Deliveries
  createDelivery: async (tenantSlug: string, token: string, deliveryData: any) => {
    const response = await ehrAxios.post('/maternity/deliveries', deliveryData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createBirthOutcome: async (tenantSlug: string, token: string, deliveryId: string, birthData: any) => {
    const response = await ehrAxios.post(`/maternity/deliveries/${deliveryId}/birth-outcomes`, birthData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Postnatal Visits
  createPostnatalVisit: async (tenantSlug: string, token: string, visitData: any) => {
    const response = await ehrAxios.post('/maternity/postnatal-visits', visitData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Maternity Indicators
  getMaternityIndicators: async (tenantSlug: string, token: string, startDate?: string, endDate?: string) => {
    const response = await ehrAxios.get('/maternity/indicators', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { start_date: startDate, end_date: endDate }
    });
    return { data: response.data };
  },

  getHighRiskPregnancies: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/high-risk-pregnancies', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getUpcomingDeliveries: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/upcoming-deliveries', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getOverdueANC: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/overdue-anc', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getRecentNeonatalOutcomes: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/neonatal/recent-outcomes', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getRecentPostnatalVisits: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/postnatal/recent-visits', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
 
  addMaternityRiskFactor: async (tenantSlug: string, token: string, enrollmentId: string, riskData: any) => {
    const response = await ehrAxios.post(`/maternity/enrollments/${enrollmentId}/risk-factors`, riskData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getMaternityRiskFactors: async (tenantSlug: string, token: string, enrollmentId: string) => {
    const response = await ehrAxios.get(`/maternity/enrollments/${enrollmentId}/risk-factors`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ===== CARDIOLOGY API =====

  getCardiologyEncounters: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/cardiology/encounters', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  createCardiologyEncounter: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/cardiology/encounters', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateCardiologyEncounter: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.patch(`/cardiology/encounters/${encounterId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getCardiologyDashboardSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/cardiology/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
};