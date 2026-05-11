import { runtimeUrls } from '../config/runtime';

const API_BASE_URL = runtimeUrls.ehrApi;

if (!API_BASE_URL) {
  console.warn('Patient Portal API URL is missing. Configure REACT_APP_API_BASE_URL or REACT_APP_EHR_API_URL.');
}

const _genRid = (): string => {
  try {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      // @ts-ignore
      return (crypto as any).randomUUID();
    }
  } catch {}
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};
const _withRid = (headers: Record<string, string>) => ({ 'X-Request-ID': _genRid(), ...headers });
const _ridFrom = (r: Response) => r.headers.get('X-Request-ID') || r.headers.get('x-request-id');
const _errMsg = (r: Response, base: string) => {
  const rid = _ridFrom(r);
  return rid ? `${base} (requestId: ${rid})` : base;
};
const _ensureOk = (r: Response, base: string) => {
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event('patient-auth-expired'));
    throw new Error(_errMsg(r, base));
  }
};

export const patientPortalApi = {
  // Appointments
  getAppointments: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch appointments');
    return response.json();
  },

  getAppointment: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/${id}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch appointment');
    return response.json();
  },

  requestAppointment: async (data: any, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/request`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(data),
    });
    _ensureOk(response, 'Failed to request appointment');
    return response.json();
  },

  cancelAppointment: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/${id}`, { method: 'DELETE', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to cancel appointment');
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
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let msg = 'Failed to request appointment';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      const rid = response.headers.get('X-Request-ID') || response.headers.get('x-request-id');
      if (rid) msg = `${msg} (requestId: ${rid})`;
      throw new Error(msg);
    }
    return response.json();
  },

  getAvailableDoctors: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/available-doctors`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch available doctors');
    return response.json();
  },

  getAvailableTimeSlots: async (doctorId: string, date: string, token: string, tenantSlug: string) => {
    const params = new URLSearchParams();
    params.append('doctorId', doctorId);
    params.append('date', date);
    params.append('includeStates', 'true');

    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/available-slots?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch available time slots');
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
    
    const response = await fetch(url, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    
    console.log('Medical records API response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let base = `Failed to fetch records: ${response.status} ${response.statusText}`;
      const rid = response.headers.get('X-Request-ID') || response.headers.get('x-request-id');
      if (rid) base = `${base} (requestId: ${rid})`;
      throw new Error(base);
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

    const response = await fetch(`${API_BASE_URL}/patient-portal/lab-results?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch lab results');
    return response.json();
  },

  // Prescriptions
  getPrescriptions: async (token: string, tenantSlug: string, activeOnly?: boolean) => {
    const params = new URLSearchParams();
    if (activeOnly) params.append('activeOnly', 'true');

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    if (!response.ok) {
      let msg = 'Failed to fetch prescriptions';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      const rid = response.headers.get('X-Request-ID') || response.headers.get('x-request-id');
      if (rid) msg = `${msg} (requestId: ${rid})`;
      throw new Error(msg);
    }
    const data = await response.json();
    // Handle both array and object responses
    return Array.isArray(data) ? data : (data.prescriptions || data.data || []);
  },

  downloadPrescription: async (prescriptionId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/${prescriptionId}/download`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to download prescription');
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
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let msg = 'Failed to create refill request';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  getRefillRequests: async (token: string, tenantSlug: string, filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/refill-requests?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch refill requests');
    return response.json();
  },

  cancelRefillRequest: async (requestId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/refill-requests/${requestId}`, { method: 'DELETE', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    if (!response.ok) {
      let msg = 'Failed to cancel refill request';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  // Medication Reminders
  createMedicationReminder: async (prescriptionId: string, data: { reminderTime: string; reminderDays: number[]; reminderType?: string; timezone?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/${prescriptionId}/reminders`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let msg = 'Failed to create medication reminder';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  getMedicationReminders: async (token: string, tenantSlug: string, filters?: { activeOnly?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.activeOnly) params.append('activeOnly', 'true');

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/reminders?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch medication reminders');
    return response.json();
  },

  updateMedicationReminder: async (reminderId: string, data: { reminderTime?: string; reminderDays?: number[]; reminderType?: string; isActive?: boolean }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/reminders/${reminderId}`, { method: 'PUT', headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }), body: JSON.stringify(data) });
    if (!response.ok) {
      let msg = 'Failed to update medication reminder';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  deleteMedicationReminder: async (reminderId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/reminders/${reminderId}`, { method: 'DELETE', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    if (!response.ok) {
      let msg = 'Failed to delete medication reminder';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  // Medication Adherence
  logMedicationAdherence: async (prescriptionId: string, data: { scheduledTime: string; taken: boolean; takenTime?: string; missedReason?: string; notes?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/${prescriptionId}/adherence`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let msg = 'Failed to log medication adherence';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  getMedicationAdherenceSummary: async (token: string, tenantSlug: string, filters?: { prescriptionId?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.prescriptionId) params.append('prescriptionId', filters.prescriptionId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/adherence/summary?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch adherence summary');
    return response.json();
  },

  getMedicationAdherenceLogs: async (token: string, tenantSlug: string, filters?: { prescriptionId?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.prescriptionId) params.append('prescriptionId', filters.prescriptionId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/adherence/logs?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch adherence logs');
    return response.json();
  },

  // Bills
  getBills: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/bills?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    if (!response.ok) {
      let msg = 'Failed to fetch bills';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    const data = await response.json();
    // Handle both array and object responses
    return Array.isArray(data) ? data : (data.bills || data.data || []);
  },

  getBill: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/bills/${id}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch bill');
    return response.json();
  },

  getBillQuote: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/bills/${id}/quote`, {
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    if (!response.ok) {
      let msg = 'Failed to fetch bill quote';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  // Vitals
  getVitals: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/vitals?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch vitals');
    return response.json();
  },

  submitVitals: async (vitalsData: any, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/vitals/submit`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }), body: JSON.stringify(vitalsData) });
    if (!response.ok) {
      let msg = 'Failed to submit vitals';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  // Patient-Reported Outcomes (PROs)
  getAvailableQuestionnaires: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/available`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch available questionnaires');
    return response.json();
  },

  getPendingQuestionnaires: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/pending`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch pending questionnaires');
    return response.json();
  },

  getQuestionnaire: async (questionnaireId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/${questionnaireId}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch questionnaire');
    return response.json();
  },

  submitQuestionnaire: async (questionnaireId: string, responses: any[], token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/${questionnaireId}/submit`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }), body: JSON.stringify({ responses }) });
    if (!response.ok) {
      let msg = 'Failed to submit questionnaire';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  getQuestionnaireHistory: async (token: string, tenantSlug: string, filters?: { limit?: number; category?: string }) => {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.category) params.append('category', filters.category);

    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/history?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch questionnaire history');
    return response.json();
  },

  getPreVisitQuestionnaires: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/appointments/${appointmentId}/questionnaires`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch pre-visit questionnaires');
    return response.json();
  },

  getProTrends: async (token: string, tenantSlug: string, filters?: { questionnaireCode?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.questionnaireCode) params.append('questionnaireCode', filters.questionnaireCode);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/trends?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch PRO trends');
    return response.json();
  },

  getQuestionnaireSchedules: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/questionnaires/schedules`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch questionnaire schedules');
    return response.json();
  },

  // Telemedicine
  getConsultationByAppointment: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/telemedicine/consultation/${appointmentId}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    if (!response.ok) {
      let msg = 'Failed to fetch consultation';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  getConsultation: async (consultationId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/telemedicine/consultation/${consultationId}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch consultation');
    return response.json();
  },

  joinConsultation: async (consultationId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/telemedicine/consultation/${consultationId}/join`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    if (!response.ok) {
      let msg = 'Failed to join consultation';
      try {
        const error = await response.json();
        msg = error?.message || msg;
      } catch {}
      throw new Error(_errMsg(response, msg));
    }
    return response.json();
  },

  getMeetingUrl: async (consultationId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/telemedicine/consultation/${consultationId}/meeting-url`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to get meeting URL');
    return response.json();
  },

  // Dashboard Summary
  getDashboardSummary: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/dashboard/summary`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch dashboard summary');
    return response.json();
  },

  getAiFollowups: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/patient-ai/followups`, {
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to fetch AI follow-ups');
    return response.json();
  },

  updateAiFollowup: async (
    followupId: string,
    data: { status?: 'open' | 'in_progress' | 'completed' | 'dismissed'; reminderState?: 'pending' | 'sent' | 'acknowledged' },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/patient-ai/followups/${followupId}`, {
      method: 'PUT',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(data),
    });
    _ensureOk(response, 'Failed to update AI follow-up');
    return response.json();
  },

  listPostVisitSessions: async (token: string, tenantSlug: string, filters?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));
    const response = await fetch(`${API_BASE_URL}/patient-portal/post-visit/sessions?${params.toString()}`, {
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to fetch post-visit sessions');
    return response.json();
  },

  getPostVisitSummary: async (sessionId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/post-visit/sessions/${sessionId}/summary`, {
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to fetch post-visit summary');
    return response.json();
  },

  getPostVisitMessages: async (sessionId: string, token: string, tenantSlug: string, filters?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));
    const response = await fetch(`${API_BASE_URL}/patient-portal/post-visit/sessions/${sessionId}/messages?${params.toString()}`, {
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to fetch post-visit companion messages');
    return response.json();
  },

  sendPostVisitMessage: async (sessionId: string, data: { message: string; language?: string; messageType?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/post-visit/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(data),
    });
    _ensureOk(response, 'Failed to send post-visit companion message');
    return response.json();
  },

  acknowledgePostVisit: async (
    sessionId: string,
    data: { acknowledgementType: 'teach_back' | 'medication_adherence' | 'follow_up_commitment' | 'warning_sign_understanding'; acknowledged?: boolean; details?: Record<string, any> },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/post-visit/sessions/${sessionId}/acknowledgements`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(data),
    });
    _ensureOk(response, 'Failed to record post-visit acknowledgement');
    return response.json();
  },

  // Chronic Disease Management - Diabetes
  getDiabetesRegistry: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/diabetes/registry`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch diabetes registry');
    return response.json();
  },

  getGlucoseHistory: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/diabetes/glucose-history?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch glucose history');
    return response.json();
  },

  getDiabetesCarePlan: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/diabetes/care-plan`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch diabetes care plan');
    return response.json();
  },

  getDiabetesMedications: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/diabetes/medications`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch diabetes medications');
    return response.json();
  },

  // Chronic Disease Management - Cardiology/Hypertension
  getCardiologyEncounters: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/cardiology/encounters?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch cardiology encounters');
    return response.json();
  },

  getBloodPressureTrends: async (token: string, tenantSlug: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/cardiology/blood-pressure-trends?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch blood pressure trends');
    return response.json();
  },

  // Messages
  getMessages: async (token: string, tenantSlug: string, filters?: { read?: boolean; messageType?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters?.read !== undefined) params.append('read', filters.read.toString());
    if (filters?.messageType) params.append('messageType', filters.messageType);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/messages?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch messages');
    return response.json();
  },

  getMessage: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages/${id}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch message');
    return response.json();
  },

  sendMessage: async (data: { recipientId: string; recipientType: string; message: string; subject?: string; messageType?: string; priority?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }), body: JSON.stringify(data) });
    _ensureOk(response, 'Failed to send message');
    return response.json();
  },

  markMessageAsRead: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages/${id}/read`, { method: 'PUT', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to mark message as read');
    return response.json();
  },

  markAllMessagesAsRead: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages/read-all`, { method: 'PUT', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to mark all messages as read');
    return response.json();
  },

  deleteMessage: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/messages/${id}`, { method: 'DELETE', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to delete message');
    return response.json();
  },

  // Notifications
  getNotifications: async (token: string, tenantSlug: string, filters?: { read?: boolean; notificationType?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.read !== undefined) params.append('read', filters.read.toString());
    if (filters?.notificationType) params.append('notificationType', filters.notificationType);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/notifications?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch notifications');
    return response.json();
  },

  markNotificationAsRead: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/notifications/${id}/read`, { method: 'PUT', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to mark notification as read');
    return response.json();
  },

  markAllNotificationsAsRead: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/notifications/read-all`, { method: 'PUT', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to mark all notifications as read');
    return response.json();
  },

  deleteNotification: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/notifications/${id}`, { method: 'DELETE', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to delete notification');
    return response.json();
  },

  // Health Records Export
  exportMedicalRecordPdf: async (token: string, tenantSlug: string, options?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const response = await fetch(`${API_BASE_URL}/patient-portal/export/pdf?${params.toString()}`, { method: 'POST', headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to export PDF');
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

    const response = await fetch(`${API_BASE_URL}/patient-portal/export/fhir?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to export FHIR');
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

    const response = await fetch(`${API_BASE_URL}/patient-portal/export/json?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to export JSON');
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

    const response = await fetch(`${API_BASE_URL}/patient-portal/export/csv?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to export CSV');
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
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }), body: JSON.stringify(goalData) });
    _ensureOk(response, 'Failed to create goal');
    return response.json();
  },

  getGoals: async (token: string, tenantSlug: string, status?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/goals?${params.toString()}`, { headers: _withRid({ 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }) });
    _ensureOk(response, 'Failed to fetch goals');
    return response.json();
  },

  getGoal: async (token: string, tenantSlug: string, goalId: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}`, { headers: _withRid({ 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }) });
    _ensureOk(response, 'Failed to fetch goal');
    return response.json();
  },

  updateGoal: async (token: string, tenantSlug: string, goalId: string, updates: any) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}`, { method: 'PUT', headers: _withRid({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }), body: JSON.stringify(updates) });
    _ensureOk(response, 'Failed to update goal');
    return response.json();
  },

  deleteGoal: async (token: string, tenantSlug: string, goalId: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}`, { method: 'DELETE', headers: _withRid({ 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }) });
    _ensureOk(response, 'Failed to delete goal');
    return response.json();
  },

  logProgress: async (token: string, tenantSlug: string, goalId: string, progressData: any) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}/progress`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }), body: JSON.stringify(progressData) });
    _ensureOk(response, 'Failed to log progress');
    return response.json();
  },

  getProgressLogs: async (token: string, tenantSlug: string, goalId: string, limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/goals/${goalId}/progress?${params.toString()}`, { headers: _withRid({ 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }) });
    _ensureOk(response, 'Failed to fetch progress logs');
    return response.json();
  },

  getAchievements: async (token: string, tenantSlug: string, limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/patient-portal/achievements?${params.toString()}`, { headers: _withRid({ 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }) });
    _ensureOk(response, 'Failed to fetch achievements');
    return response.json();
  },

  getStreaks: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/streaks`, { headers: _withRid({ 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantSlug }) });
    _ensureOk(response, 'Failed to fetch streaks');
    return response.json();
  },

  // Symptom Checker
  analyzeSymptoms: async (data: { symptoms: string[]; age?: number; gender?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/symptom-checker/analyze`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }), body: JSON.stringify(data) });
    _ensureOk(response, 'Failed to analyze symptoms');
    return response.json();
  },

  // ==================== TIER 1: E-CONSENT MANAGEMENT ====================
  
  getPatientConsents: async (token: string, tenantSlug: string, filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/patient-portal/consents?${params.toString()}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch consents');
    return response.json();
  },

  getConsentById: async (consentId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/consents/${consentId}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch consent');
    return response.json();
  },

  signConsent: async (consentId: string, signatureData: any, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/consents/${consentId}/sign`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }), body: JSON.stringify(signatureData) });
    _ensureOk(response, 'Failed to sign consent');
    return response.json();
  },

  declineConsent: async (consentId: string, reason: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/consents/${consentId}/decline`, { method: 'POST', headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }), body: JSON.stringify({ reason }) });
    _ensureOk(response, 'Failed to decline consent');
    return response.json();
  },

  downloadConsent: async (consentId: string, format: 'pdf' | 'json', token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/consents/${consentId}/export?format=${format}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to download consent');
    return response.blob();
  },

  // ==================== TIER 1: CLINICAL PATHWAYS ====================
  
  getPatientPathways: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/pathways`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch pathways');
    return response.json();
  },

  getPathwayProgress: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/pathways/${enrollmentId}/progress`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch pathway progress');
    return response.json();
  },

  // ==================== TIER 1: IMMUNIZATIONS ====================
  
  getPatientImmunizations: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/immunizations`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch immunizations');
    return response.json();
  },

  getImmunizationForecast: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/immunizations/forecast`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch immunization forecast');
    return response.json();
  },

  downloadImmunizationRecord: async (format: 'pdf' | 'json', token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/immunizations/export?format=${format}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to download immunization record');
    return response.blob();
  },

  // ==================== TIER 1: ADMISSION STATUS ====================
  
  getCurrentAdmission: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/admission/current`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(_errMsg(response, 'Failed to fetch admission status'));
    }
    return response.json();
  },

  getAdmissionHistory: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/admission/history`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch admission history');
    return response.json();
  },

  // ==================== TIER 1: ED VISITS ====================
  
  getPatientEDVisits: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/ed-visits`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch ED visits');
    return response.json();
  },

  getEDVisitDetails: async (visitId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/ed-visits/${visitId}`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch ED visit details');
    return response.json();
  },

  getHealthSummary: async (token: string, tenantSlug: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/health-summary`, {
      headers: _withRid({
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      }),
    });
    if (!response.ok) return null;
    return response.json();
  },

  // ==================== FAMILY ACCESS ====================

  listFamilyAccess: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/family-access`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch family access');
    return response.json();
  },

  createFamilyAccess: async (body: { proxyName: string; proxyEmail: string; proxyPhone?: string; relationship?: string; accessLevel?: string }, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/family-access`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify(body),
    });
    _ensureOk(response, 'Failed to create family access');
    return response.json();
  },

  revokeFamilyAccess: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/family-access/${id}`, {
      method: 'DELETE',
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to revoke family access');
    return response.json();
  },

  // ==================== FITNESS INTEGRATIONS ====================

  listFitnessIntegrations: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/fitness-integrations`, { headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }) });
    _ensureOk(response, 'Failed to fetch fitness integrations');
    return response.json();
  },

  connectFitnessIntegration: async (appId: string, appName: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/fitness-integrations`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ appId, appName }),
    });
    _ensureOk(response, 'Failed to connect fitness integration');
    return response.json();
  },

  disconnectFitnessIntegration: async (appId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/fitness-integrations/${appId}`, {
      method: 'DELETE',
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to disconnect fitness integration');
    return response.json();
  },

  syncFitnessIntegration: async (appId: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/fitness-integrations/${appId}/sync`, {
      method: 'POST',
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to sync fitness integration');
    return response.json();
  },

  // ==================== PRESCRIPTION SHARE ====================

  sharePrescription: async (prescriptionId: string, recipientEmail: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/prescriptions/${prescriptionId}/share`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ recipientEmail }),
    });
    _ensureOk(response, 'Failed to share prescription');
    return response.json();
  },

  // Health Education
  getEducationContent: async (
    token: string,
    tenantSlug: string,
    filters?: { category?: string; language?: string; limit?: number; offset?: number; search?: string }
  ) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.language) params.append('language', filters.language);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    if (filters?.search) params.append('search', filters.search);
    const response = await fetch(`${API_BASE_URL}/patient-portal/education?${params.toString()}`, {
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to fetch education content');
    return response.json();
  },

  getEducationArticle: async (id: string, token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/education/${id}`, {
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to fetch education article');
    return response.json();
  },

  voiceTranscribe: async (
    audioBlob: Blob,
    token: string,
    tenantSlug: string,
    context?: string,
    language?: string,
  ): Promise<{ text: string; confidence?: number }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-input.webm');
    if (context) formData.append('context', context);
    const url = `${API_BASE_URL}/patient-portal/voice-transcribe${language ? `?language=${language}` : ''}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
      body: formData,
    });
    _ensureOk(response, 'Voice transcription failed');
    return response.json();
  },

  caregiverLogin: async (email: string, password: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/caregiver/login`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug }),
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(err.message || 'Caregiver login failed');
    }
    return response.json();
  },

  setCaregiverPassword: async (
    invitationToken: string,
    proxyEmail: string,
    newPassword: string,
    tenantSlug: string,
  ) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/caregiver/set-password`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug }),
      body: JSON.stringify({ invitationToken, proxyEmail, newPassword }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Failed to set password' }));
      throw new Error(err.message || 'Failed to set password');
    }
    return response.json();
  },

  getCaregiverPatientSummary: async (token: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/caregiver/patient-summary`, {
      headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    });
    _ensureOk(response, 'Failed to fetch caregiver patient summary');
    return response.json();
  },

  forgotPassword: async (email: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/forgot-password`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug }),
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to send reset email');
    }
    return response.json();
  },

  resetPassword: async (token: string, newPassword: string, tenantSlug: string) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/reset-password`, {
      method: 'POST',
      headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug }),
      body: JSON.stringify({ token, newPassword }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to reset password');
    }
    return response.json();
  },
};
