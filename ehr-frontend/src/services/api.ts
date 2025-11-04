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

  authorizeOrder: async (orderId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/orders/${orderId}/authorize`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // CDSS API
  checkDrugInteractions: async (drugIds: string[], patientId: string | undefined, token: string, tenantSlug: string) => {
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

  createHivClinicalVisit: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/visits', body, {
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
};