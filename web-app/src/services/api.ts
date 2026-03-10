import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  Tenant,
  CreateTenantRequest,
  UpdateTenantRequest,
  TenantUser,
  CreateTenantUserRequest,
  SystemStats,
  TenantReport,
  TenantDhis2ConfigView,
  TenantDhis2ConfigPayload,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  try {
    const existing = (config.headers as any)?.['X-Request-ID'] || (config.headers as any)?.['x-request-id'];
    if (!existing) {
      if (!config.headers) config.headers = {};
      (config.headers as any)['X-Request-ID'] = uuidv4();
    }
  } catch {}
  return config;
});

// Add response interceptor to handle 401 Unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const rid = error?.response?.headers?.['x-request-id'] || error?.response?.headers?.['X-Request-ID'];
      if (rid) {
        error.requestId = rid;
        const baseMsg = error?.response?.data?.message || error.message || 'Request failed';
        if (typeof baseMsg === 'string' && !String(baseMsg).includes('requestId:')) {
          error.message = `${baseMsg} (requestId: ${rid})`;
        }
      }
    } catch {}
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

// Helper: owner header for CDSS admin endpoints
const getOwnerHeaders = (): Record<string, string> => {
  try {
    const user = authAPI.getCurrentUser();
    if (user && typeof user.email === 'string' && user.email.length > 0) {
      return { 'X-Owner-Email': String(user.email) };
    }
  } catch {}
  return {};
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

  getTenantDhis2Config: async (tenantId: string): Promise<TenantDhis2ConfigView | { configured: false }> => {
    const response = await api.get(`/tenants/${tenantId}/dhis2-config`);
    return response.data;
  },

  upsertTenantDhis2Config: async (
    tenantId: string,
    payload: TenantDhis2ConfigPayload,
  ): Promise<TenantDhis2ConfigView> => {
    const response = await api.put(`/tenants/${tenantId}/dhis2-config`, payload);
    return response.data;
  },

  clearTenantDhis2Config: async (tenantId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/tenants/${tenantId}/dhis2-config`);
    return response.data;
  },

  repairAllTenants: async (): Promise<{ message: string; count: number }> => {
    const response = await api.post('/admin/tenants/repair-all');
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

export const healthAPI = {
  getSystemHealth: async () => {
    const response = await api.get('/admin/system-health');
    return response.data;
  },
  refreshSystemHealth: async () => {
    const response = await api.post('/admin/system-health/refresh');
    return response.data;
  },
};

// Terminology API
export const terminologyAPI = {
  importFile: async (file: File, type: 'snomed' | 'icd10'): Promise<{ jobId: string; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const response = await api.post('/terminology/import/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAllJobs: async (): Promise<any[]> => {
    const response = await api.get('/terminology/import/jobs');
    return response.data;
  },

  getJobStatus: async (jobId: string): Promise<any> => {
    const response = await api.get(`/terminology/import/status/${jobId}`);
    return response.data;
  },

  getStats: async (): Promise<{ snomedConcepts: number; icd10Codes: number }> => {
    const response = await api.get('/terminology/import/stats');
    return response.data;
  }
};

// CDSS Admin API (owner-only)
export const cdssAdminAPI = {
  getStatus: async (): Promise<any> => {
    const response = await api.get('/cdss-admin/admin/status', { headers: { ...getOwnerHeaders() } });
    return response.data;
  },
  getSettings: async (): Promise<any> => {
    const response = await api.get('/cdss-admin/admin/settings', { headers: { ...getOwnerHeaders() } });
    return response.data;
  },
  updateSettings: async (settings: Partial<{ llm_enabled: boolean; llm_api_url: string; llm_model_name: string; rag_enabled: boolean; cache_ttl_seconds: number; cache_namespace: string; allow_pdf_uploads: boolean }>): Promise<any> => {
    const response = await api.put('/cdss-admin/admin/settings', settings, { headers: { ...getOwnerHeaders() } });
    const limit = Number(response.headers['x-ratelimit-limit'] || 0);
    const remaining = Number(response.headers['x-ratelimit-remaining'] || 0);
    const reset = Number(response.headers['x-ratelimit-reset'] || 0);
    return { data: response.data, rateLimit: { limit, remaining, reset } };
  },
  ingest: async (file?: File): Promise<any> => {
    if (file) {
      const form = new FormData();
      form.append('file', file);
      const response = await api.post('/cdss-admin/admin/ingest', form, {
        headers: { ...getOwnerHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      const limit = Number(response.headers['x-ratelimit-limit'] || 0);
      const remaining = Number(response.headers['x-ratelimit-remaining'] || 0);
      const reset = Number(response.headers['x-ratelimit-reset'] || 0);
      return { data: response.data, rateLimit: { limit, remaining, reset } };
    } else {
      const response = await api.post('/cdss-admin/admin/ingest', null, { headers: { ...getOwnerHeaders() } });
      const limit = Number(response.headers['x-ratelimit-limit'] || 0);
      const remaining = Number(response.headers['x-ratelimit-remaining'] || 0);
      const reset = Number(response.headers['x-ratelimit-reset'] || 0);
      return { data: response.data, rateLimit: { limit, remaining, reset } };
    }
  },
  reindex: async (): Promise<any> => {
    const response = await api.post('/cdss-admin/admin/reindex', null, { headers: { ...getOwnerHeaders() } });
    const limit = Number(response.headers['x-ratelimit-limit'] || 0);
    const remaining = Number(response.headers['x-ratelimit-remaining'] || 0);
    const reset = Number(response.headers['x-ratelimit-reset'] || 0);
    return { data: response.data, rateLimit: { limit, remaining, reset } };
  },
  flushCache: async (): Promise<any> => {
    const response = await api.post('/cdss-admin/admin/cache/flush', null, { headers: { ...getOwnerHeaders() } });
    const limit = Number(response.headers['x-ratelimit-limit'] || 0);
    const remaining = Number(response.headers['x-ratelimit-remaining'] || 0);
    const reset = Number(response.headers['x-ratelimit-reset'] || 0);
    return { data: response.data, rateLimit: { limit, remaining, reset } };
  },
  getMetrics: async (): Promise<any> => {
    const response = await api.get('/cdss-admin/admin/metrics', { headers: { ...getOwnerHeaders() } });
    const limit = Number(response.headers['x-ratelimit-limit'] || 0);
    const remaining = Number(response.headers['x-ratelimit-remaining'] || 0);
    const reset = Number(response.headers['x-ratelimit-reset'] || 0);
    return { metrics: response.data, rateLimit: { limit, remaining, reset } };
  },
  getAuditLogs: async (
    limit = 50,
    offset = 0,
    opts?: { actor?: string; action?: string; startDate?: string; endDate?: string; sortKey?: string; sortDir?: 'asc' | 'desc' }
  ): Promise<any> => {
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (opts?.actor && opts.actor.trim()) params.actor = opts.actor.trim();
    if (opts?.action && opts.action.trim()) params.action = opts.action.trim();
    if (opts?.startDate && opts.startDate.trim()) params.startDate = opts.startDate.trim();
    if (opts?.endDate && opts.endDate.trim()) params.endDate = opts.endDate.trim();
    if (opts?.sortKey) params.sortKey = opts.sortKey;
    if (opts?.sortDir) params.sortDir = opts.sortDir;
    const qs = new URLSearchParams(params).toString();
    const response = await api.get(`/cdss-admin/admin/audit?${qs}`, { headers: { ...getOwnerHeaders() } });
    return response.data;
  },
  getIngestJobs: async (limit = 20): Promise<any> => {
    const response = await api.get(`/cdss-admin/admin/ingest/jobs?limit=${limit}`, { headers: { ...getOwnerHeaders() } });
    return response.data;
  },
  getAdminJobs: async (limit = 50, type?: string, status?: string): Promise<any> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    const response = await api.get(`/cdss-admin/admin/jobs?${params.toString()}`, { headers: { ...getOwnerHeaders() } });
    return response.data;
  },
  getAdminJobStatus: async (jobId: string): Promise<any> => {
    const response = await api.get(`/cdss-admin/admin/jobs/${encodeURIComponent(jobId)}`, { headers: { ...getOwnerHeaders() } });
    return response.data;
  },
  retryAdminJob: async (jobId: string): Promise<any> => {
    const response = await api.post(`/cdss-admin/admin/jobs/retry/${encodeURIComponent(jobId)}`, null, { headers: { ...getOwnerHeaders() } });
    const limit = Number(response.headers['x-ratelimit-limit'] || 0);
    const remaining = Number(response.headers['x-ratelimit-remaining'] || 0);
    const reset = Number(response.headers['x-ratelimit-reset'] || 0);
    return { data: response.data, rateLimit: { limit, remaining, reset } };
  },
  retryIngestJob: async (jobId: string): Promise<any> => {
    const response = await api.post(`/cdss-admin/admin/ingest/retry/${encodeURIComponent(jobId)}`, null, { headers: { ...getOwnerHeaders() } });
    const limit = Number(response.headers['x-ratelimit-limit'] || 0);
    const remaining = Number(response.headers['x-ratelimit-remaining'] || 0);
    const reset = Number(response.headers['x-ratelimit-reset'] || 0);
    return { data: response.data, rateLimit: { limit, remaining, reset } };
  },
  resetMetrics: async (): Promise<any> => {
    const response = await api.post(`/cdss-admin/admin/metrics/reset`, null, { headers: { ...getOwnerHeaders() } });
    return response.data;
  },
  getIngestJobStatus: async (jobId: string): Promise<any> => {
    const response = await api.get(`/cdss-admin/admin/ingest/status/${encodeURIComponent(jobId)}`, { headers: { ...getOwnerHeaders() } });
    return response.data;
  }
};
