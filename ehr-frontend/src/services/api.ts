import axios from 'axios';

const TENANT_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const EHR_API_URL = process.env.REACT_APP_EHR_API_URL || 'http://localhost:3013/api';

export const tenantApi = {
  getActiveTenants: async () => {
    const response = await axios.get(`${TENANT_API_URL}/tenants`);
    return { data: response.data.filter((tenant: any) => tenant.status === 'active') };
  }
};

export const ehrApi = {
  login: async (email: string, password: string, tenantSlug: string) => {
    const response = await axios.post(`${EHR_API_URL}/auth/login`, { email, password }, {
      headers: { 'X-Tenant-ID': tenantSlug }
    });
    return { data: response.data };
  },

  changePassword: async (currentPassword: string, newPassword: string, token: string, tenantSlug: string) => {
    const response = await axios.put(`${EHR_API_URL}/auth/change-password`, {
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
    const response = await axios.get(`${EHR_API_URL}/auth/profile`, {
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
    const response = await axios.get(`${EHR_API_URL}/users`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  createUser: async (userData: any, token: string, tenantSlug: string) => {
    const response = await axios.post(`${EHR_API_URL}/users`, userData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  resetUserPassword: async (userId: string, token: string, tenantSlug: string) => {
    const response = await axios.put(`${EHR_API_URL}/users/${userId}/reset-password`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deactivateUser: async (userId: string, token: string, tenantSlug: string) => {
    const response = await axios.delete(`${EHR_API_URL}/users/${userId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  activateUser: async (userId: string, token: string, tenantSlug: string) => {
    const response = await axios.put(`${EHR_API_URL}/users/${userId}/activate`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  }
};