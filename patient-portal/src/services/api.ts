const API_BASE_URL = process.env.REACT_APP_EHR_API_URL || 'http://localhost:3013/api';

export const patientPortalApi = {
  // Appointments
  getAppointments: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch appointments');
    return response.json();
  },

  getAppointment: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch appointment');
    return response.json();
  },

  requestAppointment: async (data: any, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to request appointment');
    return response.json();
  },

  cancelAppointment: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/${id}`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to cancel appointment');
    return response.json();
  },

  // Medical Records
  getRecords: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.type) params.append('type', filters.type);

    const response = await fetch(`${API_BASE_URL}/patient-portal/records?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch records');
    return response.json();
  },

  // Lab Results
  getLabResults: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await fetch(`${API_BASE_URL}/patient-portal/lab-results?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch lab results');
    return response.json();
  },

  // Prescriptions
  getPrescriptions: async (token: string, tenantSlug: string, activeOnly?: boolean) => {
    const params = new URLSearchParams();
    if (activeOnly) params.append('activeOnly', 'true');

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch prescriptions');
    return response.json();
  },

  // Bills
  getBills: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/bills?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch bills');
    return response.json();
  },

  getBill: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/bills/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch bill');
    return response.json();
  },

  // Vitals
  getVitals: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/vitals?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch vitals');
    return response.json();
  },

  // Dashboard Summary
  getDashboardSummary: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/dashboard/summary`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch dashboard summary');
    return response.json();
  },
};

