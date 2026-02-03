const API_BASE_URL = process.env.REACT_APP_EHR_API_URL || '';

if (!process.env.REACT_APP_EHR_API_URL) {
  console.warn('REACT_APP_EHR_API_URL is missing in environment variables. Patient Portal may not function correctly.');
}

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

  requestAppointmentWithPayment: async (data: {
    appointment: {
      doctorId: string;
      appointmentDate: string;
      reason: string;
      durationMinutes?: number;
      appointmentType?: string;
      notes?: string;
      isTelehealth?: boolean;
    };
    payment: {
      method: 'ecocash' | 'onemoney' | 'cash' | 'card';
      phoneNumber?: string;
      amount: number;
      currency?: string;
    };
  }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/request-with-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to request appointment');
    }
    return response.json();
  },

  getAvailableDoctors: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/available-doctors`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch available doctors');
    return response.json();
  },

  getAvailableTimeSlots: async (doctorId: string, date: string, token: string, tenantSlug: string) => {
    const params = new URLSearchParams();
    params.append('doctorId', doctorId);
    params.append('date', date);

    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/available-slots?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch available time slots');
    return response.json();
  },

  // Medical Records
  getRecords: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.type) params.append('type', filters.type);

    const url = `${API_BASE_URL}/patient-portal/records?${params.toString()}`;
    console.log('Fetching medical records from:', url);
    
    const response = await fetch(url, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    
    console.log('Medical records API response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Medical records API error:', errorText);
      throw new Error(`Failed to fetch records: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Medical records API raw response:', data);
    return data;
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
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch prescriptions');
    }
    const data = await response.json();
    // Handle both array and object responses
    return Array.isArray(data) ? data : (data.prescriptions || data.data || []);
  },

  downloadPrescription: async (prescriptionId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/${prescriptionId}/download`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to download prescription');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prescription-${prescriptionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Refill Requests
  createRefillRequest: async (prescriptionId: string, data: { requestedQuantity?: number; reason?: string; urgency?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/${prescriptionId}/refill-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create refill request');
    }
    return response.json();
  },

  getRefillRequests: async (token: string, tenantSlug: string, filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/refill-requests?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch refill requests');
    return response.json();
  },

  cancelRefillRequest: async (requestId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/refill-requests/${requestId}`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel refill request');
    }
    return response.json();
  },

  // Medication Reminders
  createMedicationReminder: async (prescriptionId: string, data: { reminderTime: string; reminderDays: number[]; reminderType?: string; timezone?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/${prescriptionId}/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create medication reminder');
    }
    return response.json();
  },

  getMedicationReminders: async (token: string, tenantSlug: string, filters?: { activeOnly?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.activeOnly) params.append('activeOnly', 'true');

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/reminders?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch medication reminders');
    return response.json();
  },

  updateMedicationReminder: async (reminderId: string, data: { reminderTime?: string; reminderDays?: number[]; reminderType?: string; isActive?: boolean }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/reminders/${reminderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update medication reminder');
    }
    return response.json();
  },

  deleteMedicationReminder: async (reminderId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/reminders/${reminderId}`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete medication reminder');
    }
    return response.json();
  },

  // Medication Adherence
  logMedicationAdherence: async (prescriptionId: string, data: { scheduledTime: string; taken: boolean; takenTime?: string; missedReason?: string; notes?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/${prescriptionId}/adherence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to log medication adherence');
    }
    return response.json();
  },

  getMedicationAdherenceSummary: async (token: string, tenantSlug: string, filters?: { prescriptionId?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.prescriptionId) params.append('prescriptionId', filters.prescriptionId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/adherence/summary?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch adherence summary');
    return response.json();
  },

  getMedicationAdherenceLogs: async (token: string, tenantSlug: string, filters?: { prescriptionId?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.prescriptionId) params.append('prescriptionId', filters.prescriptionId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/adherence/logs?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch adherence logs');
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
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch bills');
    }
    const data = await response.json();
    // Handle both array and object responses
    return Array.isArray(data) ? data : (data.bills || data.data || []);
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

  submitVitals: async (vitalsData: any, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/vitals/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(vitalsData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit vitals');
    }
    return response.json();
  },

  // Patient-Reported Outcomes (PROs)
  getAvailableQuestionnaires: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/available`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch available questionnaires');
    return response.json();
  },

  getPendingQuestionnaires: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/pending`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch pending questionnaires');
    return response.json();
  },

  getQuestionnaire: async (questionnaireId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/${questionnaireId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch questionnaire');
    return response.json();
  },

  submitQuestionnaire: async (questionnaireId: string, responses: any[], token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/${questionnaireId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ responses }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit questionnaire');
    }
    return response.json();
  },

  getQuestionnaireHistory: async (token: string, tenantSlug: string, filters?: { limit?: number; category?: string }) => {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.category) params.append('category', filters.category);

    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/history?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch questionnaire history');
    return response.json();
  },

  getPreVisitQuestionnaires: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/${appointmentId}/questionnaires`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch pre-visit questionnaires');
    return response.json();
  },

  getProTrends: async (token: string, tenantSlug: string, filters?: { questionnaireCode?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.questionnaireCode) params.append('questionnaireCode', filters.questionnaireCode);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/trends?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch PRO trends');
    return response.json();
  },

  getQuestionnaireSchedules: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/schedules`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch questionnaire schedules');
    return response.json();
  },

  // Telemedicine
  getConsultationByAppointment: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/telemedicine/consultation/${appointmentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch consultation' }));
      throw new Error(error.message || 'Failed to fetch consultation');
    }
    return response.json();
  },

  getConsultation: async (consultationId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/telemedicine/consultation/${consultationId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch consultation');
    return response.json();
  },

  joinConsultation: async (consultationId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/telemedicine/consultation/${consultationId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to join consultation');
    }
    return response.json();
  },

  getMeetingUrl: async (consultationId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/telemedicine/consultation/${consultationId}/meeting-url`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get meeting URL');
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

  // Chronic Disease Management - Diabetes
  getDiabetesRegistry: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/diabetes/registry`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch diabetes registry');
    return response.json();
  },

  getGlucoseHistory: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/diabetes/glucose-history?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch glucose history');
    return response.json();
  },

  getDiabetesCarePlan: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/diabetes/care-plan`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch diabetes care plan');
    return response.json();
  },

  getDiabetesMedications: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/diabetes/medications`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch diabetes medications');
    return response.json();
  },

  // Chronic Disease Management - Cardiology/Hypertension
  getCardiologyEncounters: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/cardiology/encounters?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch cardiology encounters');
    return response.json();
  },

  getBloodPressureTrends: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/cardiology/blood-pressure-trends?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch blood pressure trends');
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

  // Health Records Export
  exportMedicalRecordPdf: async (token: string, tenantSlug: string, options?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const response = await fetch(`${API_BASE_URL}/patient-portal/export/pdf?${params.toString()}`, {
      method: 'POST',
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to export PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-record-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  exportFhirBundle: async (token: string, tenantSlug: string, options?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const response = await fetch(`${API_BASE_URL}/patient-portal/export/fhir?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to export FHIR');
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-records-fhir-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  exportJson: async (token: string, tenantSlug: string, options?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const response = await fetch(`${API_BASE_URL}/patient-portal/export/json?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to export JSON');
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-records-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  exportCsv: async (token: string, tenantSlug: string, options?: { startDate?: string; endDate?: string; dataType?: string }) => {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.dataType) params.append('dataType', options.dataType);

    const response = await fetch(`${API_BASE_URL}/patient-portal/export/csv?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to export CSV');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-records-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Health Goals
  createGoal: async (token: string, tenantSlug: string, goalData: any) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
      body: JSON.stringify(goalData),
    });
    if (!response.ok) throw new Error('Failed to create goal');
    return response.json();
  },

  getGoals: async (token: string, tenantSlug: string, status?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/goals?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch goals');
    return response.json();
  },

  getGoal: async (token: string, tenantSlug: string, goalId: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch goal');
    return response.json();
  },

  updateGoal: async (token: string, tenantSlug: string, goalId: string, updates: any) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update goal');
    return response.json();
  },

  deleteGoal: async (token: string, tenantSlug: string, goalId: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
    });
    if (!response.ok) throw new Error('Failed to delete goal');
    return response.json();
  },

  logProgress: async (token: string, tenantSlug: string, goalId: string, progressData: any) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
      body: JSON.stringify(progressData),
    });
    if (!response.ok) throw new Error('Failed to log progress');
    return response.json();
  },

  getProgressLogs: async (token: string, tenantSlug: string, goalId: string, limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}/progress?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch progress logs');
    return response.json();
  },

  getAchievements: async (token: string, tenantSlug: string, limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/achievements?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch achievements');
    return response.json();
  },

  getStreaks: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/streaks`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch streaks');
    return response.json();
  },

  // Symptom Checker
  analyzeSymptoms: async (data: { symptoms: string[]; age?: number; gender?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/symptom-checker/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to analyze symptoms');
    return response.json();
  },

  // ==================== TIER 1: E-CONSENT MANAGEMENT ====================
  
  getPatientConsents: async (token: string, tenantSlug: string, filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/consents?${params.toString()}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch consents');
    return response.json();
  },

  getConsentById: async (consentId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/consents/${consentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch consent');
    return response.json();
  },

  signConsent: async (consentId: string, signatureData: any, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/consents/${consentId}/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(signatureData),
    });
    if (!response.ok) throw new Error('Failed to sign consent');
    return response.json();
  },

  declineConsent: async (consentId: string, reason: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/consents/${consentId}/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) throw new Error('Failed to decline consent');
    return response.json();
  },

  downloadConsent: async (consentId: string, format: 'pdf' | 'json', token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/consents/${consentId}/export?format=${format}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to download consent');
    return response.blob();
  },

  // ==================== TIER 1: CLINICAL PATHWAYS ====================
  
  getPatientPathways: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/pathways`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch pathways');
    return response.json();
  },

  getPathwayProgress: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/pathways/${enrollmentId}/progress`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch pathway progress');
    return response.json();
  },

  // ==================== TIER 1: IMMUNIZATIONS ====================
  
  getPatientImmunizations: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/immunizations`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch immunizations');
    return response.json();
  },

  getImmunizationForecast: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/immunizations/forecast`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch immunization forecast');
    return response.json();
  },

  downloadImmunizationRecord: async (format: 'pdf' | 'json', token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/immunizations/export?format=${format}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to download immunization record');
    return response.blob();
  },

  // ==================== TIER 1: ADMISSION STATUS ====================
  
  getCurrentAdmission: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/admission/current`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 404) return null; // Not admitted
      throw new Error('Failed to fetch admission status');
    }
    return response.json();
  },

  getAdmissionHistory: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/admission/history`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch admission history');
    return response.json();
  },

  // ==================== TIER 1: ED VISITS ====================
  
  getPatientEDVisits: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/ed-visits`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch ED visits');
    return response.json();
  },

  getEDVisitDetails: async (visitId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/ed-visits/${visitId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch ED visit details');
    return response.json();
  },
};

