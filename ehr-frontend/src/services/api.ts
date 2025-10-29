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
};