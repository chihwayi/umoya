import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';

// Tenant service runs on port 3001
const getTenantBaseURL = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  }
  return 'http://localhost:3001/api';
};

const tenantAxios: AxiosInstance = axios.create({
  baseURL: getTenantBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Tenant {
  id: string;
  clinicName: string;
  subdomain: string;
  databaseName: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  city?: string;
  country: string;
}

export const tenantService = {
  getAllTenants: async (): Promise<Tenant[]> => {
    try {
      const response = await tenantAxios.get('/tenants');
      // Filter only active tenants
      return response.data.filter((tenant: Tenant) => tenant.status === 'active');
    } catch (error: any) {
      console.error('Error fetching tenants:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch tenants');
    }
  },

  getTenantById: async (id: string): Promise<Tenant> => {
    try {
      const response = await tenantAxios.get(`/tenants/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching tenant:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch tenant');
    }
  },
};

