import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const tenantAPI = {
  getAllTenants: async () => {
    const response = await axios.get(`${API_BASE_URL}/tenants`);
    return response.data;
  }
};

export const ehrAPI = {
  login: async (tenantId: string, credentials: { email: string; password: string }) => {
    const response = await axios.post(`http://localhost:3013/api/auth/login`, credentials, {
      headers: { 'X-Tenant-ID': tenantId }
    });
    return response.data;
  },

  changePassword: async (tenantId: string, passwordData: { currentPassword: string; newPassword: string }, token: string) => {
    const response = await axios.put(`http://localhost:3013/api/auth/change-password`, {
      oldPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    }, {
      headers: { 
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  },

  getProfile: async (tenantId: string, token: string) => {
    const response = await axios.get(`http://localhost:3013/api/auth/profile`, {
      headers: { 
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  }
};