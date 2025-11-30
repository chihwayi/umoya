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

  // Messages
  getMessages: async (token: string, tenantSlug: string, filters?: { read?: boolean; messageType?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters?.read !== undefined) params.append('read', filters.read.toString());
    if (filters?.messageType) params.append('messageType', filters.messageType);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/messages?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch messages');
    return response.json();
  },

  getMessage: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch message');
    return response.json();
  },

  sendMessage: async (data: { recipientId: string; recipientType: string; message: string; subject?: string; messageType?: string; priority?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },

  markMessageAsRead: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages/${id}/read`, {
      method: 'PUT',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to mark message as read');
    return response.json();
  },

  markAllMessagesAsRead: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages/read-all`, {
      method: 'PUT',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to mark all messages as read');
    return response.json();
  },

  deleteMessage: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages/${id}`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to delete message');
    return response.json();
  },

  // Notifications
  getNotifications: async (token: string, tenantSlug: string, filters?: { read?: boolean; notificationType?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.read !== undefined) params.append('read', filters.read.toString());
    if (filters?.notificationType) params.append('notificationType', filters.notificationType);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/notifications?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  markNotificationAsRead: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/notifications/${id}/read`, {
      method: 'PUT',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to mark notification as read');
    return response.json();
  },

  markAllNotificationsAsRead: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/notifications/read-all`, {
      method: 'PUT',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to mark all notifications as read');
    return response.json();
  },

  deleteNotification: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/notifications/${id}`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to delete notification');
    return response.json();
  },
};

