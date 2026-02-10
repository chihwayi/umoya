import axios from 'axios';
import { Tenant, CreateTenantRequest, UpdateTenantRequest, TenantUser, CreateTenantUserRequest, SystemStats, TenantReport } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor to handle 401 Unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear local storage and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user } = response.data;
    
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    
    // Set default authorization header
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
    return { token: access_token, user };
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
  },

  isAuthenticated: () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return true;
    }
    return false;
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', {
      oldPassword,
      newPassword
    });
    return response.data;
  },
};

// Initialize auth header on app start
if (authAPI.isAuthenticated()) {
  const token = localStorage.getItem('auth_token');
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

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

  updateTenant: async (id: string, data: UpdateTenantRequest): Promise<Tenant> => {
    const response = await api.put(`/tenants/${id}`, data);
    return response.data;
  },

  uploadTenantLogo: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/tenants/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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

// Backup API
export const backupAPI = {
  listBackups: async (): Promise<any[]> => {
    const response = await api.get('/admin/backups');
    return response.data;
  },

  createBackup: async (type: 'auto' | 'manual'): Promise<any> => {
    const response = await api.post(`/admin/backups?type=${type}`);
    return response.data;
  },

  getDownloadUrl: async (key: string): Promise<{ url: string }> => {
    const response = await api.get(`/admin/backups/${encodeURIComponent(key)}/download`);
    return response.data;
  },

  restoreBackup: async (key: string): Promise<{ message: string }> => {
    const response = await api.post(`/admin/backups/${encodeURIComponent(key)}/restore`);
    return response.data;
  }
};
