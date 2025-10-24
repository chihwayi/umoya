import axios from 'axios';
import { Tenant, CreateTenantRequest, TenantUser, CreateTenantUserRequest, SystemStats, TenantReport } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    // For now, hardcoded super admin login
    if (email === 'admin@medicore.co.zw' && password === 'medicore123') {
      const token = 'super_admin_token';
      localStorage.setItem('auth_token', token);
      return { token, user: { id: '1', email, role: 'super_admin' } };
    }
    throw new Error('Invalid credentials');
  },

  logout: () => {
    localStorage.removeItem('auth_token');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('auth_token');
  },
};

// Tenant API
export const tenantAPI = {
  getAllTenants: async (): Promise<Tenant[]> => {
    const response = await api.get('/tenants');
    return response.data;
  },

  getTenantById: async (id: string): Promise<Tenant> => {
    const response = await api.get(`/tenants/${id}`);
    return response.data;
  },

  createTenant: async (data: CreateTenantRequest): Promise<{ tenant: Tenant; message: string }> => {
    const response = await api.post('/tenants', data);
    return response.data;
  },

  updateTenantStatus: async (id: string, status: string): Promise<Tenant> => {
    const response = await api.put(`/tenants/${id}/status`, { status });
    return response.data;
  },

  deleteTenant: async (id: string): Promise<void> => {
    await api.delete(`/tenants/${id}`);
  },

  // Tenant Users
  getTenantUsers: async (tenantId: string): Promise<TenantUser[]> => {
    const response = await api.get(`/tenants/${tenantId}/users`);
    return response.data;
  },

  createTenantUser: async (tenantId: string, data: CreateTenantUserRequest): Promise<{ user: TenantUser; message: string }> => {
    const response = await api.post(`/tenants/${tenantId}/users`, data);
    return response.data;
  },

  updateUserStatus: async (tenantId: string, userId: string, status: string): Promise<TenantUser> => {
    const response = await api.put(`/tenants/${tenantId}/users/${userId}/status`, { status });
    return response.data;
  },

  resetUserPassword: async (tenantId: string, userId: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.put(`/tenants/${tenantId}/users/${userId}/reset-password`, { newPassword });
    return response.data;
  },

  deleteUser: async (tenantId: string, userId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/tenants/${tenantId}/users/${userId}`);
    return response.data;
  },
};

// Analytics API
export const analyticsAPI = {
  getSystemOverview: async (): Promise<SystemStats> => {
    const response = await api.get('/analytics/overview');
    return response.data;
  },

  getAllTenantsOverview: async (): Promise<any> => {
    const response = await api.get('/analytics/tenants');
    return response.data;
  },

  getTenantMetrics: async (tenantId: string, days?: number): Promise<any> => {
    const response = await api.get(`/analytics/tenants/${tenantId}?days=${days || 30}`);
    return response.data;
  },

  generateTenantReport: async (tenantId: string): Promise<TenantReport> => {
    const response = await api.get(`/analytics/tenants/${tenantId}/report`);
    return response.data;
  },
};