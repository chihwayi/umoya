import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Determine the base URL based on platform
const getBaseURL = () => {
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access localhost
    return 'http://10.0.2.2:3013/api';
  }
  // iOS simulator uses localhost
  return 'http://localhost:3013/api';
};

const BASE_URL = getBaseURL();

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and tenant
// This ensures tenant is ALWAYS included in API calls from cached storage
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      // Always get tenant from storage (cached tenant is always stored here)
      let tenantSlug = await AsyncStorage.getItem('tenantSlug');
      
      // If not in tenantSlug, try getting from cached tenant object
      if (!tenantSlug) {
        const cachedTenantStr = await AsyncStorage.getItem('cached_tenant');
        if (cachedTenantStr) {
          try {
            const cachedTenant = JSON.parse(cachedTenantStr);
            tenantSlug = cachedTenant.subdomain || cachedTenant.slug;
            // Store it in tenantSlug for future use
            if (tenantSlug) {
              await AsyncStorage.setItem('tenantSlug', tenantSlug);
            }
          } catch (e) {
            console.error('Error parsing cached tenant:', e);
          }
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Always include tenant in headers if available
      // IMPORTANT: Only add to headers, NEVER to body
      if (tenantSlug) {
        config.headers['X-Tenant-ID'] = tenantSlug;
        // Ensure tenantSlug is NOT in the body data
        if (config.data && typeof config.data === 'object') {
          delete config.data.tenantSlug;
        }
      }
    } catch (error) {
      console.error('Error getting auth data from storage:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear storage and redirect to login
      try {
        await AsyncStorage.multiRemove(['authToken', 'tenantSlug', 'user']);
      } catch (e) {
        console.error('Error clearing storage:', e);
      }
    }
    return Promise.reject(error);
  }
);

// API client object
export const ehrApi = {
  get: async (endpoint: string, config?: AxiosRequestConfig) => {
    const response = await axiosInstance.get(endpoint, config);
    return response.data;
  },

  post: async (endpoint: string, data?: any, config?: AxiosRequestConfig) => {
    const response = await axiosInstance.post(endpoint, data, config);
    return response.data;
  },

  put: async (endpoint: string, data?: any, config?: AxiosRequestConfig) => {
    const response = await axiosInstance.put(endpoint, data, config);
    return response.data;
  },

  patch: async (endpoint: string, data?: any, config?: AxiosRequestConfig) => {
    const response = await axiosInstance.patch(endpoint, data, config);
    return response.data;
  },

  delete: async (endpoint: string, config?: AxiosRequestConfig) => {
    const response = await axiosInstance.delete(endpoint, config);
    return response.data;
  },
};

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/profile',
  },
  PATIENT: {
    LIST: '/patients',
    BY_ID: (id: string) => `/patients/${id}`,
    SEARCH: '/patients/search',
  },
  MEDICAL_RECORD: {
    PATIENT: (patientId: string) => `/medical-records/patient/${patientId}`,
    BY_ID: (id: string) => `/medical-records/${id}`,
  },
  APPOINTMENT: {
    LIST: '/appointments',
    BY_ID: (id: string) => `/appointments/${id}`,
    CREATE: '/appointments',
    UPDATE: (id: string) => `/appointments/${id}`,
    CHECK_IN: (id: string) => `/appointments/${id}/check-in`,
    START: (id: string) => `/appointments/${id}/start`,
    COMPLETE: (id: string) => `/appointments/${id}/complete`,
  },
  FINANCE: {
    DASHBOARD_SUMMARY: '/finance/dashboard/summary',
    TRANSACTIONS: '/finance/transactions',
    TRANSACTION: (id: string) => `/finance/transactions/${id}`,
    CREATE_TRANSACTION: '/finance/transactions',
    RECORD_PAYMENT: (id: string) => `/finance/transactions/${id}/payments`,
    REPORTS: '/finance/reports',
  },
  PRESCRIPTION: {
    PATIENT: (patientId: string) => `/prescriptions/patient/${patientId}`,
    BY_ID: (id: string) => `/prescriptions/${id}`,
    CREATE: '/prescriptions',
  },
  DRUG: {
    SEARCH: '/drugs',
    BY_ID: (id: string) => `/drugs/${id}`,
    CHECK_INTERACTIONS: '/drugs/check-interactions',
  },
  TERMINOLOGY: {
    SNOMED_SEARCH: '/terminology/snomed/search',
    ICD10_SEARCH: '/terminology/icd10/search',
    ICD10_CODE: (code: string) => `/terminology/icd10/code/${code}`,
    ICD10_MAP_FROM_SNOMED: (snomedCode: string) => `/terminology/icd10/map-from-snomed/${snomedCode}`,
  },
  DOCUMENTS: {
    PATIENT: (patientId: string) => `/documents?patientId=${patientId}`,
    BY_ID: (id: string) => `/documents/${id}`,
    UPLOAD: '/documents/upload',
  },
  VITALS: {
    PATIENT: (patientId: string) => `/vitals/patient/${patientId}`,
  },
  MAR: {
    PATIENT: (patientId: string) => `/mar/patient/${patientId}`,
    ADMINISTER: (entryId: string) => `/mar/${entryId}/administer`,
    MISSED: (entryId: string) => `/mar/${entryId}/missed`,
  },
  LAB_ORDERS: {
    PATIENT_RESULTS: (patientId: string) => `/lab-orders/patient/${patientId}/results`,
    BY_ID: (id: string) => `/lab-orders/${id}`,
    CREATE: '/lab-orders',
  },
  LAB_TESTS: {
    LIST: '/lab-tests',
    BY_ID: (id: string) => `/lab-tests/${id}`,
  },
  MESSAGING: {
    INBOX: '/messages/inbox',
    SENT: '/messages/sent',
    UNREAD_COUNT: '/messages/unread-count',
    SEARCH: '/messages/search',
    BY_ID: (id: string) => `/messages/${id}`,
    THREADS: '/messages/threads',
    THREAD: (id: string) => `/messages/threads/${id}`,
    SEND: '/messages',
    REPLY: (id: string) => `/messages/${id}/reply`,
    MARK_READ: (id: string) => `/messages/${id}/read`,
    ARCHIVE: (id: string) => `/messages/${id}/archive`,
    TEMPLATES: '/messages/templates/list',
    TEMPLATE: (id: string) => `/messages/templates/${id}`,
    APPLY_TEMPLATE: (id: string) => `/messages/templates/${id}/apply`,
  },
  USERS: {
    LIST: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    BY_ROLE: (role: string) => `/users?role=${role}`,
  },
  PROBLEMS: {
    PATIENT: (patientId: string) => `/problems/patient/${patientId}`,
    REPLACE: (patientId: string) => `/problems/patient/${patientId}`,
  },
  ALLERGIES: {
    PATIENT: (patientId: string) => `/allergies/patient/${patientId}`,
    REPLACE: (patientId: string) => `/allergies/patient/${patientId}`,
  },
  CDSS: {
    DRUG_INTERACTIONS: '/cdss/drug-interactions',
    DIAGNOSIS_ASSIST: '/cdss/diagnosis-assist',
    RISK_ASSESSMENT: '/cdss/risk-assessment',
    DOSING_RECOMMENDATION: '/cdss/dosing-recommendation',
    GUIDELINES: '/cdss/guidelines',
  },
};
