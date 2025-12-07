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
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const tenantSlug = await AsyncStorage.getItem('tenantSlug');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (tenantSlug) {
        config.headers['X-Tenant-ID'] = tenantSlug;
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
  },
  PRESCRIPTION: {
    PATIENT: (patientId: string) => `/prescriptions/patient/${patientId}`,
    BY_ID: (id: string) => `/prescriptions/${id}`,
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
};
