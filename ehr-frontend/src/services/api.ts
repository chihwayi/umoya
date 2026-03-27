import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { handleAutoLogout, isOnProtectedRoute } from '../utils/autoLogout';
import { runtimeUrls } from '../config/runtime';
// Re-export CDSS types so consumers can import from one place
export type { CdssBaseResponse, CdssCitation, CdssConfidenceBand, CdssAbstentionReason } from '../types/cdss';

type RetriableAxiosConfig = {
  __retryCount?: number;
};

const TENANT_API_URL = runtimeUrls.tenantApi;
const EHR_API_URL = runtimeUrls.ehrApi;

if (!TENANT_API_URL || !EHR_API_URL) {
  console.warn('One or more API URLs are missing in environment variables. Configure REACT_APP_API_BASE_URL or explicit API URLs.');
}

// Create axios instance with response interceptor
const createAxiosInstance = (baseURL: string) => {
  const instance = axios.create({ baseURL });
  const RETRYABLE_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK']);
  const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
  const MAX_RETRIES = 2;
  const RETRY_BASE_DELAY_MS = 300;
  
  // Request interceptor to add session ID and X-Request-ID
  instance.interceptors.request.use(
    (config) => {
      let sessionId = localStorage.getItem('ehr_session_id');
      if (!sessionId) {
        sessionId = uuidv4();
        localStorage.setItem('ehr_session_id', sessionId);
      }
      config.headers['x-session-id'] = sessionId;
      try {
        const existing = (config.headers as any)?.['X-Request-ID'] || (config.headers as any)?.['x-request-id'];
        if (!existing) {
          (config.headers as any)['X-Request-ID'] = uuidv4();
        }
      } catch {}
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor to handle 401 errors
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = (error?.config || {}) as RetriableAxiosConfig & {
        method?: string;
      };
      const method = String(config.method || 'get').toLowerCase();
      const retryCount = config.__retryCount || 0;
      const statusCode = Number(error?.response?.status || 0);
      const shouldRetry =
        method === 'get' &&
        (RETRYABLE_CODES.has(String(error?.code || '')) || RETRYABLE_STATUS_CODES.has(statusCode)) &&
        retryCount < MAX_RETRIES;

      if (shouldRetry) {
        config.__retryCount = retryCount + 1;
        const delayMs = RETRY_BASE_DELAY_MS * config.__retryCount;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return instance.request(config);
      }

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
      const isLoginRequest = error.config?.url?.endsWith('/auth/login');
      if (error.response?.status === 401 && !isLoginRequest && isOnProtectedRoute()) {
        console.log('🚨 401 Unauthorized detected - triggering auto-logout');
        handleAutoLogout();
      }
      return Promise.reject(error);
    }
  );
  
  return instance;
};

// Create instances
export const tenantAxios = createAxiosInstance(TENANT_API_URL);
export const ehrAxios = createAxiosInstance(EHR_API_URL);

export const tenantApi = {
  getActiveTenants: async () => {
    const response = await tenantAxios.get('/tenants/active');
    return { data: response.data };
  },
  getTenantBySlug: async (slug: string) => {
    const response = await tenantAxios.get(`/tenants/subdomain/${slug}`);
    return { data: response.data };
  },
  submitDemoAccessRequest: async (payload: {
    fullName: string;
    clinicName: string;
    workEmail: string;
    phone: string;
    roleTitle?: string;
    specialization?: string;
    currentSystem?: string;
    interestSummary: string;
    interestAreas: string[];
    preferredContactMethod?: 'email' | 'phone' | 'whatsapp';
  }) => {
    const response = await tenantAxios.post('/demo-access-requests', payload);
    return { data: response.data };
  }
};

export const chartApi = {
  getProblems: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/problems/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },
  replaceProblems: async (patientId: string, problems: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/problems/patient/${patientId}`, { problems }, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },
  getAllergies: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/allergies/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },
  replaceAllergies: async (patientId: string, allergies: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/allergies/patient/${patientId}`, { allergies }, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  }
};

export const terminologyApi = {
  searchSnomed: async (
    term: string,
    token: string,
    tenantSlug: string,
    options?: { limit?: number; offset?: number; activeOnly?: boolean; semanticTags?: string[]; ecl?: string }
  ) => {
    if (!term || term.trim().length < 2) {
      return { data: { concepts: [], total: 0, limit: options?.limit ?? 20, offset: options?.offset ?? 0 } };
    }

    const params: Record<string, any> = {
      term,
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0,
    };
    if (typeof options?.activeOnly !== 'undefined') {
      params.activeOnly = options.activeOnly;
    }
    if (options?.semanticTags?.length) {
      params.semanticTags = options.semanticTags.join(',');
    }
    if (options?.ecl) {
      params.ecl = options.ecl;
    }

    const response = await ehrAxios.get('/terminology/snomed/search', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  searchIcd10: async (
    term: string,
    token: string,
    tenantSlug: string,
    options?: { limit?: number; offset?: number; billableOnly?: boolean }
  ) => {
    if (!term || term.trim().length < 2) {
      return { data: { codes: [], total: 0, limit: options?.limit ?? 20, offset: options?.offset ?? 0 } };
    }

    const params: Record<string, any> = {
      term,
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0,
    };
    if (typeof options?.billableOnly !== 'undefined') {
      params.billableOnly = options.billableOnly;
    }

    const response = await ehrAxios.get('/terminology/icd10/search', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  validateConcept: async (conceptId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/terminology/snomed/validate/${conceptId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getIcd10Mappings: async (
    conceptId: string,
    token: string,
    tenantSlug: string,
    options?: { primaryOnly?: boolean; includeInactive?: boolean; limit?: number }
  ) => {
    const params: Record<string, any> = {};
    if (typeof options?.primaryOnly !== 'undefined') {
      params.primaryOnly = options.primaryOnly;
    }
    if (typeof options?.includeInactive !== 'undefined') {
      params.includeInactive = options.includeInactive;
    }
    if (options?.limit) {
      params.limit = options.limit;
    }

    const response = await ehrAxios.get(`/terminology/snomed/map/${conceptId}/ICD10`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getIcd10MappingMetadata: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/terminology/snomed/icd10/metadata', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // RxNorm methods
  searchRxNorm: async (
    term: string,
    token: string,
    tenantSlug: string,
    options?: { limit?: number; offset?: number }
  ) => {
    if (!term || term.trim().length < 2) {
      return { data: { concepts: [], total: 0, limit: options?.limit ?? 50, offset: options?.offset ?? 0 } };
    }

    const params: Record<string, any> = {
      term: term.trim(),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    };

    const response = await ehrAxios.get('/terminology/rxnorm/search', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getRxNormConcept: async (rxcui: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/terminology/rxnorm/concepts/${rxcui}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  validateRxNorm: async (rxcui: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/terminology/rxnorm/validate/${rxcui}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getRxNormRelated: async (rxcui: string, token: string, tenantSlug: string, rela?: string) => {
    const params: Record<string, any> = {};
    if (rela) {
      params.rela = rela;
    }

    const response = await ehrAxios.get(`/terminology/rxnorm/concepts/${rxcui}/related`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  findRxNormByName: async (name: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/terminology/rxnorm/find-by-name', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: { name: name.trim() },
    });
    return { data: response.data };
  },
};

export const ehrApi = {
  getAuditSummary: async (token: string, tenantSlug: string, startDate: string, endDate: string) => {
    const response = await ehrAxios.get('/hipaa-audit/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: { startDate, endDate },
    });
    return { data: response.data };
  },

  getNurseCopilotKpis: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/metrics/nurse-copilot/kpis', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getAuditLogs: async (token: string, tenantSlug: string, params: any) => {
    const response = await ehrAxios.get('/hipaa-audit/logs', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getDisclosureReport: async (
    token: string,
    tenantSlug: string,
    patientId: string,
    from?: string,
    to?: string,
  ) => {
    const response = await ehrAxios.get('/admin/audit/disclosure-report', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: { patientId, from, to },
    });
    return { data: response.data };
  },

  getDisclosureReportExport: async (
    token: string,
    tenantSlug: string,
    patientId: string,
    from?: string,
    to?: string,
    format: 'csv' = 'csv',
  ) => {
    const response = await ehrAxios.get('/admin/audit/disclosure-report', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: { patientId, from, to, format },
      responseType: 'blob',
    });
    return response;
  },

  getStepExecutions: async (executionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/workflows/executions/${executionId}/steps`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPatientAdmissions: async (patientId: string, token: string, tenantSlug: string, activeOnly: boolean = false) => {
    const response = await ehrAxios.get(`/beds/admissions`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { 
        patientId,
        status: activeOnly ? 'active' : undefined
      }
    });
    return { data: response.data };
  },

  // Generic HTTP methods
  get: async (endpoint: string, token: string, tenantSlug: string, params?: any) => {
    const response = await ehrAxios.get(endpoint, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params
    });
    return { data: response.data };
  },

  post: async (endpoint: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(endpoint, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },

  put: async (endpoint: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(endpoint, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },

  delete: async (endpoint: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(endpoint, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
    });
    return { data: response.data };
  },

  login: async (email: string, password: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/auth/login', { email, password }, {
      headers: { 'X-Tenant-ID': tenantSlug }
    });
    return { data: response.data };
  },

  changePassword: async (currentPassword: string, newPassword: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put('/auth/change-password', {
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
    const response = await ehrAxios.get('/auth/profile', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getUnreadCount: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/messages/unread-count', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getDocuments: async (patientId: string, filters: any, token: string, tenantSlug: string) => {
    const params = { patientId, ...filters };
    const response = await ehrAxios.get('/documents', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  uploadDocument: async (formData: FormData, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/documents/upload', formData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return { data: response.data };
  },

  deleteDocument: async (documentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/documents/${documentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getDocumentById: async (documentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/documents/${documentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  addDocumentTag: async (documentId: string, tagName: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/documents/${documentId}/tags`, { tagName }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  removeDocumentTag: async (documentId: string, tagName: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/documents/${documentId}/tags/${encodeURIComponent(tagName)}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  viewDocument: async (documentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/documents/${documentId}/view`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  shareDocument: async (documentId: string, shareData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/documents/${documentId}/share`, shareData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getSharedDocuments: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/documents/shared/with-me', {
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
    const response = await ehrAxios.get('/users', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  updateUser: async (userId: string, userData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/users/${userId}`, userData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  detectBreaches: async (token: string, tenantSlug: string, lookbackDays: number = 30) => {
    const response = await ehrAxios.get('/hipaa-audit/detect-breaches', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { lookbackDays }
    });
    return { data: response.data };
  },

  createUser: async (userData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/users', userData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  resetUserPassword: async (userId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/users/${userId}/reset-password`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deactivateUser: async (userId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/users/${userId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  activateUser: async (userId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/users/${userId}/activate`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Clinical Pathways
  getClinicalPathways: async (params: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/clinical-pathways', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  getPatientPathwayEnrollments: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/pathway-enrollments`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Care Plans & Goals
  getPatientCarePlans: async (token: string, tenantSlug: string, params?: any) => {
    const response = await ehrAxios.get('/care-plans', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  getPatientCarePlan: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/care-plans/${carePlanId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  reportGoalProgress: async (carePlanId: string, goalId: string, progressData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/${carePlanId}/goals/${goalId}/progress`, progressData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Patient Management
  getPatients: async (token: string, tenantSlug: string, page?: number, limit?: number) => {
    const params = { page, limit };
    const response = await ehrAxios.get('/patients', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  getPatientStats: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/patients/stats', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  searchPatients: async (query: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/patients/search', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { q: query }
    });
    return { data: response.data };
  },

  createPatient: async (patientData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/patients', patientData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  assessRegistrationIntake: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/registration-intelligence/assess', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  verifyRegistrationEligibility: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/registration-intelligence/eligibility/verify', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getDuplicateReviewQueue: async (
    params: { sourceReference?: string; status?: string; limit?: number },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get('/registration-intelligence/duplicates/review', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  reviewDuplicateCandidate: async (
    matchId: string,
    payload: { matchStatus: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.patch(`/registration-intelligence/duplicates/review/${matchId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPatientById: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientContext: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/context`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

      // Appointment Management
    getAppointments: async (token: string, tenantSlug: string, params?: any) => {
      const response = await ehrAxios.get('/appointments', {
        headers: { 
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`
        },
        params
      });
      return { data: response.data };
    },

    getAppointmentProResponses: async (appointmentId: string, token: string, tenantSlug: string) => {
      const response = await ehrAxios.get(`/appointments/${appointmentId}/pro-responses`, {
        headers: { 
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`
        }
      });
      return { data: response.data };
    },

      getAvailableSlots: async (doctorId: string, date: string, token: string, tenantSlug: string) => {
        const response = await ehrAxios.get(`/appointments/doctor/${doctorId}/available-slots`, {
          headers: { 
            'X-Tenant-ID': tenantSlug,
            'Authorization': `Bearer ${token}`
          },
          params: { date }
        });
        // The API returns an array directly, not wrapped in a data object
        return { data: response.data };
      },

  createAppointment: async (appointmentData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/appointments', appointmentData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createRecurringAppointments: async (appointmentData: any, pattern: string, endDate: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/appointments/recurring', {
      appointment: appointmentData,
      pattern,
      endDate
    }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getAppointmentResources: async (token: string, tenantSlug: string, type?: 'room' | 'equipment') => {
    const response = await ehrAxios.get('/appointments/resources', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: type ? { type } : {}
    });
    return { data: response.data };
  },

  checkResourceAvailability: async (
    resourceId: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId: string | undefined,
    token: string,
    tenantSlug: string
  ) => {
    const params: any = {
      startTime,
      endTime
    };
    if (excludeAppointmentId) {
      params.excludeAppointmentId = excludeAppointmentId;
    }
    const response = await ehrAxios.get(`/appointments/resources/${resourceId}/availability`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  bookAppointmentResource: async (bookingData: { appointmentId: string; resourceId: string; bookingStart: string; bookingEnd: string }, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/appointments/resources/bookings', bookingData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkAppointmentAvailability: async (doctorId: string, appointmentDate: string, durationMinutes: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/appointments/check-availability', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: {
        doctorId,
        appointmentDate,
        durationMinutes
      }
    });
    return { data: response.data };
  },

  sendAppointmentReminder: async (appointmentId: string, options: { sendSms?: boolean; sendEmail?: boolean }, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/appointments/${appointmentId}/reminder`, options, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getAppointmentTemplates: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/appointments/templates', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createAppointmentTemplate: async (template: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/appointments/templates', template, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deleteAppointmentTemplate: async (templateId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/appointments/templates/${templateId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Waitlist API
  getWaitlist: async (token: string, tenantSlug: string, params?: any) => {
    const response = await ehrAxios.get('/waitlist', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  createWaitlistEntry: async (waitlistData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/waitlist', waitlistData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateWaitlistEntry: async (id: string, waitlistData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/waitlist/${id}`, waitlistData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deleteWaitlistEntry: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/waitlist/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  scheduleFromWaitlist: async (id: string, appointmentDate: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/waitlist/${id}/schedule`, { appointmentDate }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  notifyWaitlistEntry: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/waitlist/${id}/notify`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateAppointmentStatus: async (appointmentId: string, status: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/appointments/${appointmentId}/status`, { status }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  startAppointment: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/appointments/${appointmentId}/start`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  completeAppointment: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/appointments/${appointmentId}/complete`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateAppointment: async (appointmentId: string, appointmentData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/appointments/${appointmentId}`, appointmentData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Calendar Views
  getCalendarView: async (date: string, view: 'day' | 'week' | 'month', token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/appointments/calendar/${date}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { view }
    });
    return { data: response.data };
  },

  getMonthView: async (year: number, month: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/appointments/calendar/month/${year}/${month}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getWeekView: async (startDate: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/appointments/calendar/week/${startDate}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkConflicts: async (doctorId: string, date: string, time: string, duration: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/appointments/conflicts/${doctorId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { date, time, duration: duration.toString() }
    });
    return { data: response.data };
  },

  // Vitals API
  recordVitals: async (vitalsData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/vitals', vitalsData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getVitals: async (
    patientId: string,
    token: string,
    tenantSlug: string,
    options?: { trend?: boolean; limit?: number; recordedDate?: string; latestOnDate?: boolean },
  ) => {
    const params: Record<string, any> = {};
    if (options?.trend) params.trend = 'true';
    if (options?.limit) params.limit = options.limit;
    if (options?.recordedDate) params.recorded_date = options.recordedDate;
    if (options?.latestOnDate) params.latest_on_date = 'true';
    const response = await ehrAxios.get(`/vitals/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  // Triage API
  recordTriageAssessment: async (triageData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/triage', triageData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getTriageAssessments: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/triage/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Nursing Notes API
  recordNursingNote: async (noteData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/nursing-notes', noteData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getNursingNotes: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/nursing-notes/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Orders API
  getAuthorizedOrders: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/orders/authorized', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeOrder: async (orderId: string, executionNotes: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/orders/${orderId}/execute`, {
      executionNotes
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createOrder: async (orderData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/orders', orderData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  }
  ,

  // CDSS API
  checkCdssDrugInteractions: async (drugIds: string[], patientId: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/drug-interactions', {
      drugIds,
      patientId
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getClinicalGuidelines: async (condition: string, patientData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/guidelines', {
      condition,
      patientData
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  searchGuidelines: async (
    query: string,
    token: string,
    tenantSlug: string,
    limit: number = 5,
    patientContext?: any
  ) => {
    const response = await ehrAxios.post('/cdss/guidelines/search', {
      query,
      limit,
      patient_context: patientContext
    }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  analyzeTriageCopilot: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/triage/analyze', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  interpretVitalsCopilot: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/vitals/interpret', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  generateNurseNoteDraft: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/notes/draft', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  generateNurseHandoffSummary: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/handoff/summary', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  recordCopilotAction: async (
    payload: {
      copilotType: 'triage' | 'vitals' | 'notes' | 'handoff' | 'hiv_visit';
      decision: 'accept' | 'modify' | 'reject';
      reason?: string;
      patientId?: string;
      recommendationSummary?: string;
      context?: any;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/cdss/copilot/action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getNurseWorklistState: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/nurse-worklist/state', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getNurseCrossModuleFeed: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/nurse-worklist/cross-module-feed', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getClinicalEscalationFeed: async (
    token: string,
    tenantSlug: string,
    params?: { status?: string; severity?: string; includeCompleted?: boolean; limit?: number },
  ) => {
    const response = await ehrAxios.get('/nurse-worklist/clinical-escalations', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params,
    });
    return { data: response.data };
  },

  getDoctorSyncFeed: async (
    token: string,
    tenantSlug: string,
    params?: { focus?: string; includeAcknowledged?: boolean },
  ) => {
    const response = await ehrAxios.get('/nurse-worklist/doctor-sync-feed', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params,
    });
    return { data: response.data };
  },

  getNurseOutcomeAnalytics: async (days: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/nurse-worklist/analytics/outcomes', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: {
        days,
      },
    });
    return { data: response.data };
  },

  getDoctorOutcomeAnalytics: async (
    days: number,
    token: string,
    tenantSlug: string,
    filters?: {
      module?: string;
      status?: string;
      caseId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) => {
    const response = await ehrAxios.get('/nurse-worklist/analytics/doctor-outcomes', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: {
        days,
        module: filters?.module,
        status: filters?.status,
        caseId: filters?.caseId,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
      },
    });
    return { data: response.data };
  },

  listPostVisitSessions: async (
    token: string,
    tenantSlug: string,
    filters?: {
      status?: 'captured' | 'processing' | 'draft_ready' | 'doctor_reviewed' | 'published' | 'closed';
      patientId?: string;
      doctorId?: string;
      sourceType?: 'in_person' | 'telemedicine' | 'hybrid';
      publishedOnly?: boolean;
      limit?: number;
      offset?: number;
    },
  ) => {
    const response = await ehrAxios.get('/post-visit/sessions', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  createPostVisitSession: async (
    payload: {
      patientId: string;
      doctorId?: string;
      appointmentId?: string;
      consultationId?: string;
      sourceType?: 'in_person' | 'telemedicine' | 'hybrid';
      language?: string;
      startedAt?: string;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/post-visit/sessions', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPostVisitSessionDraft: async (sessionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/draft`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPostVisitRecordingUrl: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
  ): Promise<{ url: string; mimeType: string; durationMs: number | null } | { url: null }> => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/recording-url`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getPostVisitAnnotatedDraft: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
  ): Promise<{ sessionId: string; entities: unknown[]; artifacts: Array<{ artifactType: string; content: Record<string, { raw: string; spans: unknown[] } | unknown> }> }> => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/draft/annotated`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  },

  askPostVisitSection: async (
    sessionId: string,
    body: { question: string; sectionType: string; artifactType?: string },
    token: string,
    tenantSlug: string,
  ): Promise<{ answer: string; abstained?: boolean }> => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/ask-section`, body, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },

  transcribePostVisitSession: async (
    sessionId: string,
    payload: {
      audioFile: File;
      language?: 'en' | 'sn' | 'nd' | 'auto';
      temperature?: number;
      prompt?: string;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const formData = new FormData();
    formData.append('audio', payload.audioFile);
    if (payload.language) {
      formData.append('language', payload.language);
    }
    if (typeof payload.temperature === 'number') {
      formData.append('temperature', String(payload.temperature));
    }
    if (payload.prompt) {
      formData.append('prompt', payload.prompt);
    }

    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/transcribe`, formData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return { data: response.data };
  },

  getPostVisitSessionDiarization: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
    filters?: { limit?: number; unresolvedOnly?: boolean },
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/diarization`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  ingestPostVisitDocumentIntelligence: async (
    sessionId: string,
    payload: {
      file: File;
      documentType?: 'lab_report' | 'prescription' | 'imaging_report' | 'discharge_summary' | 'other';
      language?: string;
      note?: string;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.documentType) formData.append('documentType', payload.documentType);
    if (payload.language) formData.append('language', payload.language);
    if (payload.note) formData.append('note', payload.note);
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/documents/intelligence`, formData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  listPostVisitDocumentIntelligence: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
    filters?: { limit?: number },
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/documents/intelligence`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  analyzePostVisitIntraVisitAlerts: async (
    sessionId: string,
    payload: { text: string; source?: string; transcriptOffsetSeconds?: number },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/intravisit/analyze`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  analyzePostVisitIntraVisitAudioChunk: async (
    sessionId: string,
    payload: {
      audioFile: File;
      language?: 'en' | 'sn' | 'nd' | 'auto';
      temperature?: number;
      prompt?: string;
      source?: string;
      transcriptOffsetSeconds?: number;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const formData = new FormData();
    formData.append('audio', payload.audioFile);
    if (payload.language) formData.append('language', payload.language);
    if (typeof payload.temperature === 'number') formData.append('temperature', String(payload.temperature));
    if (payload.prompt) formData.append('prompt', payload.prompt);
    if (payload.source) formData.append('source', payload.source);
    if (typeof payload.transcriptOffsetSeconds === 'number') {
      formData.append('transcriptOffsetSeconds', String(payload.transcriptOffsetSeconds));
    }

    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/intravisit/analyze-audio`, formData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  listPostVisitIntraVisitAlerts: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
    filters?: { status?: 'open' | 'confirmed' | 'dismissed'; limit?: number; offset?: number },
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/intravisit/alerts`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  resolvePostVisitIntraVisitAlert: async (
    sessionId: string,
    alertId: string,
    payload: { status: 'confirmed' | 'dismissed'; note?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(
      `/post-visit/sessions/${sessionId}/intravisit/alerts/${alertId}/resolve`,
      payload,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  acknowledgePostVisitIntraVisitAlert: async (
    sessionId: string,
    alertId: string,
    payload: { note?: string } = {},
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(
      `/post-visit/sessions/${sessionId}/intravisit/alerts/${alertId}/acknowledge`,
      payload,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  reassignPostVisitDiarizationSegment: async (
    sessionId: string,
    segmentId: string,
    payload: { speakerRole: 'doctor' | 'patient' | 'unknown'; speakerLabel?: string; note?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(
      `/post-visit/sessions/${sessionId}/diarization/${segmentId}/reassign`,
      payload,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  regeneratePostVisitDraft: async (
    sessionId: string,
    payload: { reason?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/draft/regenerate`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  reviewPostVisitArtifact: async (
    sessionId: string,
    payload: {
      artifactType: 'soap_note' | 'visit_summary' | 'recommendation_bundle' | 'letter';
      action: 'accept' | 'edit' | 'reject';
      reason?: string;
      editedContent?: Record<string, any>;
      reviewMetadata?: Record<string, any>;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/review`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  generatePostVisitAdminDocuments: async (
    sessionId: string,
    payload: {
      documentTypes?: Array<'referral_letter' | 'sick_note' | 'return_to_work'>;
      note?: string;
      signImmediately?: boolean;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/admin-docs/generate`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  generatePostVisitReferralLetterDraft: async (
    sessionId: string,
    payload: { recipientLabel?: string; referralReason?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/draft/referral-letter`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  generatePostVisitClinicalNoteDraft: async (
    sessionId: string,
    payload: { includeTranscript?: boolean } | undefined,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/draft/clinical-note`, payload || {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  suggestEncounterCodes: async (sessionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/suggest-codes`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getEncounterCodeSuggestions: async (sessionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/encounter-codes`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  reviewEncounterCodes: async (
    suggestionId: string,
    payload: { acceptedCodes: string[]; rejectedCodes: string[] },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.put(`/encounter-codes/${suggestionId}/review`, payload, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPostVisitAdminDocuments: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/admin-docs`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPostVisitTrialMatches: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
    options?: { refresh?: boolean },
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/trial-matches`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: {
        refresh: options?.refresh ? 'true' : undefined,
      },
    });
    return { data: response.data };
  },

  reviewPostVisitTrialMatch: async (
    sessionId: string,
    matchId: string,
    payload: { action: 'consider' | 'defer' | 'exclude' | 'enroll'; note?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/trial-matches/${matchId}/review`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPostVisitTrialMatchAudit: async (
    sessionId: string,
    matchId: string,
    token: string,
    tenantSlug: string,
    options?: { limit?: number },
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/trial-matches/${matchId}/audit`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: {
        limit: options?.limit,
      },
    });
    return { data: response.data };
  },

  getPostVisitCompanionMemory: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
    options?: { limit?: number; includeInactive?: boolean },
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/companion-memory`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: {
        limit: options?.limit,
        includeInactive: options?.includeInactive ? 'true' : undefined,
      },
    });
    return { data: response.data };
  },

  curatePostVisitCompanionMemory: async (
    sessionId: string,
    memoryId: string,
    payload: { action: 'promote' | 'retire' | 'reactivate'; note?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/companion-memory/${memoryId}/curate`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  executePostVisitVoiceCommand: async (
    sessionId: string,
    payload: {
      command: 'APPROVE_SUMMARY' | 'APPROVE_BUNDLE' | 'GENERATE_ADMIN_DOCS' | 'REGENERATE_DRAFT' | 'SIGN_AND_PUBLISH';
      note?: string;
      confirmSignAndPublish?: boolean;
      publishMetadata?: Record<string, any>;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/voice-command`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  listEarlyWarningScoresForPatient: async (patientId: string, token: string, tenantSlug: string, limit: number = 50) => {
    const response = await ehrAxios.get(`/early-warning/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: { limit },
    });
    return { data: response.data };
  },

  listEarlyWarningAlerts: async (token: string, tenantSlug: string, limit: number = 50) => {
    const response = await ehrAxios.get('/early-warning/alerts', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: { limit },
    });
    return { data: response.data };
  },

  acknowledgeEarlyWarningAlert: async (scoreId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/early-warning/alerts/${scoreId}/ack`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  executePostVisitRecommendation: async (
    sessionId: string,
    actionId: string,
    payload: { note?: string; actionPayload?: Record<string, any> },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/recommendations/${actionId}/execute`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPostVisitBillingIntelligence: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/billing-intelligence`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  reviewPostVisitBillingSuggestion: async (
    sessionId: string,
    suggestionId: string,
    payload: { action: 'approve' | 'reject'; note?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(
      `/post-visit/sessions/${sessionId}/billing-suggestions/${suggestionId}/review`,
      payload,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  getPostVisitAppointmentPreVisitBrief: async (
    appointmentId: string,
    token: string,
    tenantSlug: string,
    options?: { refresh?: boolean },
  ) => {
    const response = await ehrAxios.get(`/post-visit/appointments/${appointmentId}/previsit-brief`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: {
        refresh: options?.refresh ? 'true' : undefined,
      },
    });
    return { data: response.data };
  },

  publishPostVisitSession: async (
    sessionId: string,
    payload: {
      note?: string;
      publishMetadata?: Record<string, any>;
      acknowledgedSupersededCitationIds?: string[];
      acknowledgedMedicationHighRisk?: boolean;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/sessions/${sessionId}/publish`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPostVisitSessionFhir: async (sessionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/fhir`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getPatientStoryLatest: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/post-visit/patients/${patientId}/story`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientStoryVersions: async (
    patientId: string,
    token: string,
    tenantSlug: string,
    params?: { limit?: number },
  ) => {
    const response = await ehrAxios.get(`/post-visit/patients/${patientId}/story/versions`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: params || {},
    });
    return { data: response.data };
  },

  getPatientStoryVersion: async (
    patientId: string,
    version: number,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get(
      `/post-visit/patients/${patientId}/story/versions/${version}`,
      { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
    );
    return { data: response.data };
  },

  getPatientStoryDiff: async (
    patientId: string,
    fromVersion: number,
    toVersion: number,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get(`/post-visit/patients/${patientId}/story/diff`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: { from: fromVersion, to: toVersion },
    });
    return { data: response.data };
  },

  getPostVisitMobileContract: async (sessionId: string, token: string, tenantSlug: string, version = 'v1') => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/mobile-contract`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: { version },
    });
    return { data: response.data };
  },

  getPostVisitMobileEvents: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
    filters?: { version?: string; limit?: number; offset?: number },
  ) => {
    const response = await ehrAxios.get(`/post-visit/sessions/${sessionId}/mobile-events`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || { version: 'v1' },
    });
    return { data: response.data };
  },

  getPostVisitEscalations: async (
    token: string,
    tenantSlug: string,
    filters?: {
      status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
      severity?: 'low' | 'moderate' | 'high' | 'critical';
      routeTarget?: 'emergency' | 'doctor' | 'nurse';
      triggerType?: string;
      temporality?: 'current' | 'historical' | 'unclear';
      minConfidence?: number;
      sessionId?: string;
      patientId?: string;
      limit?: number;
      offset?: number;
    },
  ) => {
    const response = await ehrAxios.get('/post-visit/escalations', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  getPostVisitTrialMemoryAnalytics: async (
    token: string,
    tenantSlug: string,
    filters?: {
      days?: number;
      routeTarget?: 'doctor' | 'nurse' | 'emergency';
    },
  ) => {
    const response = await ehrAxios.get('/post-visit/analytics/trial-memory', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  getPostVisitTrialSlaAccountability: async (
    token: string,
    tenantSlug: string,
    filters?: {
      days?: number;
      routeTarget?: 'doctor' | 'nurse' | 'emergency';
      clinicianId?: string;
      limit?: number;
    },
  ) => {
    const response = await ehrAxios.get('/post-visit/analytics/trial-sla-accountability', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  exportPostVisitTrialMemoryAudit: async (
    token: string,
    tenantSlug: string,
    filters?: {
      days?: number;
      format?: 'json' | 'csv';
      routeTarget?: 'doctor' | 'nurse' | 'emergency';
      clinicianId?: string;
      sessionId?: string;
      limit?: number;
    },
  ) => {
    const response = await ehrAxios.get('/post-visit/reports/trial-memory-audit', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  getPostVisitTrialDecisionCoordinationQueue: async (
    token: string,
    tenantSlug: string,
    filters?: {
      status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
      routeTarget?: 'doctor' | 'nurse' | 'emergency';
      limit?: number;
      offset?: number;
    },
  ) => {
    const response = await ehrAxios.get('/post-visit/coordination/trial-decisions', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params: filters || {},
    });
    return { data: response.data };
  },

  classifyPostVisitEscalation: async (
    payload: { message: string; sessionId?: string; language?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/post-visit/escalation/classify', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  resolvePostVisitEscalation: async (
    escalationId: string,
    payload: { status?: 'resolved' | 'dismissed'; resolutionNote?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/post-visit/escalations/${escalationId}/resolve`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateNurseCrossModuleWorkflow: async (
    payload: {
      itemId: string;
      module: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      enrollmentId?: string | null;
      status: 'acknowledged' | 'completed';
      note?: string;
      context?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/workflow', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeHivNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      enrollmentId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/hiv-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeOncologyNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      caseId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/oncology-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeCardiologyNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      encounterId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/cardiology-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeEdNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      visitId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/ed-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeSepsisNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      bundleId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/sepsis-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeBloodBankNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      transfusionId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/blood-bank-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeOphthalmologyNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      encounterId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/ophthalmology-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeTelemedicineNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      consultationId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/telemedicine-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeLabNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      alertId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/lab-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executeImagingNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      reportId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/imaging-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  executePharmacyNurseRecommendationAction: async (
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      prescriptionId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post('/nurse-worklist/cross-module/pharmacy-recommendation-action', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  completeNurseTask: async (
    taskId: string,
    payload: { reason?: string; patientId?: string; context?: any },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post(`/nurse-worklist/tasks/${taskId}/complete`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  acknowledgeNurseAlert: async (
    alertId: string,
    payload: { reason?: string; patientId?: string; context?: any },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post(`/nurse-worklist/alerts/${alertId}/acknowledge`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  acknowledgeClinicalEscalation: async (
    escalationTaskId: string,
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post(`/nurse-worklist/clinical-escalations/${escalationTaskId}/ack`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  completeClinicalEscalation: async (
    escalationTaskId: string,
    payload: { note?: string },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post(`/nurse-worklist/clinical-escalations/${escalationTaskId}/complete`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getNurseHandoffState: async (
    patientId: string,
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.get(`/nurse-worklist/handoff/${patientId}/state`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  finalizeNurseHandoff: async (
    patientId: string,
    payload: { summary?: string; context?: any; reason?: string },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post(`/nurse-worklist/handoff/${patientId}/finalize`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  confirmNurseHandoffReview: async (
    patientId: string,
    payload: { reviewerName?: string; reviewerRole?: string; context?: any; reason?: string },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post(`/nurse-worklist/handoff/${patientId}/review`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  shareNurseHandoff: async (
    patientId: string,
    payload: { channel?: string; recipient?: string; context?: any; reason?: string },
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post(`/nurse-worklist/handoff/${patientId}/share`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getRiskAssessment: async (patientData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/risk-assessment', patientData, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getDiagnosisSuggestions: async (symptoms: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/diagnosis-assist', symptoms, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getDosingRecommendation: async (dosingRequest: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/dosing-recommendation', dosingRequest, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  interpretLabResults: async (labResults: any, historicalLabs: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/labs/interpret', {
      labResults,
      historicalLabs
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  detectDuplicateTherapy: async (medications: any[], prescriptions: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/medications/duplicates', {
      medications,
      prescriptions
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkHighRiskMedications: async (medications: any[], patientAge: number, patientGender: string, diagnoses: string[], renalFunction: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/medications/high-risk', {
      medications,
      patientAge,
      patientGender,
      diagnoses,
      renalFunction
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  detectCareGaps: async (patientAge: number, patientGender: string, visitHistory: any[], diagnoses: string[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/care-gaps/detect', {
      patientAge,
      patientGender,
      visitHistory,
      diagnoses
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  authorizeOrder: async (orderId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/orders/${orderId}/authorize`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Prescriptions API
  createPrescription: async (createDto: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/prescriptions', createDto, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  downloadPrescriptionPdf: async (prescriptionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/prescriptions/${prescriptionId}/download`, {
      responseType: 'blob',
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prescription-${prescriptionId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  assessMedicationSafety: async (
    payload: {
      patientId: string;
      medications: Array<{ name?: string; genericName?: string; medication_name_snomed?: string }>;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/medication-safety/assess', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getNoShowPrediction: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/appointments/${appointmentId}/no-show-prediction`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getHighRiskNoShowToday: async (token: string, tenantSlug: string, threshold?: number) => {
    const qs = threshold ? `?threshold=${threshold}` : '';
    const response = await ehrAxios.get(`/appointments/no-show-risk/today${qs}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getSmartSlotSuggestions: async (
    payload: { patientId: string; visitType?: string; preferredDoctorId?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/appointments/smart-suggestions', payload, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getModelPerformance: async (
    modelName: string,
    startDate: string,
    endDate: string,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get(`/admin/ml/performance/${modelName}`, {
      params: { startDate, endDate },
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  allergyCheckStructured: async (
    payload: { patientId: string; medications: string[] },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/cdss/allergy-check-structured', payload, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientPrescriptions: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/prescriptions/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Orders API
  createLabOrder: async (orderData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/lab-orders', orderData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getLabOrders: async (query: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/lab-orders', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: query
    });
    return { data: response.data };
  },

  getConsentTemplates: async (params: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/consent-templates', {
      params,
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientLabResults: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/lab-orders/patient/${patientId}/results`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Technician API
  getPendingLabOrders: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/lab-orders/pending', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getInProgressLabOrders: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/lab-orders/in-progress', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getLabQualityControls: async (
    token: string,
    tenantSlug: string,
    params: { analyzer?: string; status?: string; limit?: number } = {},
  ) => {
    const response = await ehrAxios.get('/lab-orders/quality-controls', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  createLabQualityControl: async (
    payload: {
      analyzer_name: string;
      test_code?: string;
      level?: string;
      lot_number?: string;
      run_datetime?: string;
      result_value?: string;
      status?: 'pending' | 'pass' | 'fail' | 'review';
      comments?: string;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/lab-orders/quality-controls', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getLabReagentInventory: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/lab-orders/inventory/reagents', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  upsertLabReagentInventory: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/lab-orders/inventory/reagents', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateLabReagentQuantity: async (
    id: string,
    payload: { quantity_available: number; status?: 'ok' | 'warning' | 'critical' | 'expired' },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.patch(`/lab-orders/inventory/reagents/${id}/quantity`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  collectLabSample: async (orderId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/collect`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  startProcessingLabOrder: async (orderId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/start-processing`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateLabProcessingContext: async (orderId: string, payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/processing-context`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  submitLabResults: async (orderId: string, resultsDto: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/submit-results`, resultsDto, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateLabOrderStatus: async (orderId: string, status: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/lab-orders/${orderId}/status`, { status }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Test Catalog API
  getLabTests: async (category?: string, search?: string, token?: string, tenantSlug?: string) => {
    const response = await ehrAxios.get('/lab-tests', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { category, search }
    });
    return { data: response.data };
  },

  getLabTestById: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/lab-tests/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  seedLabTests: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/lab-tests/seed', {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Order Sets API
  getLabOrderSets: async (category?: string, token?: string, tenantSlug?: string) => {
    const response = await ehrAxios.get('/lab-order-sets', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { category }
    });
    return { data: response.data };
  },

  getLabOrderSetById: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/lab-order-sets/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  seedLabOrderSets: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/lab-order-sets/seed', {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Enhanced Lab Test Catalog API
  getLabTestCatalog: async (tenantSlug: string, token: string, category?: string, active?: boolean) => {
    const response = await ehrAxios.get('/lab/test-catalog', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { category, active }
    });
    return { data: response.data };
  },

  searchLabTests: async (tenantSlug: string, token: string, query: string) => {
    const response = await ehrAxios.get('/lab/test-catalog/search', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { q: query }
    });
    return { data: response.data };
  },

  getLabTestCatalogById: async (tenantSlug: string, token: string, testId: string) => {
    const response = await ehrAxios.get(`/lab/test-catalog/${testId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getLabTestCategories: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/test-catalog/categories', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Enhanced Order Sets API
  getEnhancedOrderSets: async (tenantSlug: string, token: string, category?: string, active?: boolean) => {
    const response = await ehrAxios.get('/lab/order-sets-enhanced', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { category, active }
    });
    return { data: response.data };
  },

  getEnhancedOrderSetById: async (tenantSlug: string, token: string, orderSetId: string) => {
    const response = await ehrAxios.get(`/lab/order-sets-enhanced/${orderSetId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createOrdersFromSet: async (tenantSlug: string, token: string, data: any) => {
    const response = await ehrAxios.post('/lab/order-sets-enhanced/create-from-order-set', data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Lab Critical Alerts API
  getLabCriticalAlerts: async (tenantSlug: string, token: string, filters?: any) => {
    const response = await ehrAxios.get('/lab/critical-alerts', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: filters
    });
    return { data: response.data };
  },

  getMyLabCriticalAlerts: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/critical-alerts/my-alerts', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPendingLabCriticalAlerts: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/critical-alerts/pending', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientLabCriticalAlerts: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/lab/critical-alerts/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  acknowledgeLabCriticalAlert: async (tenantSlug: string, token: string, alertId: string, data: any) => {
    const response = await ehrAxios.patch(`/lab/critical-alerts/${alertId}/acknowledge`, data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  escalateLabCriticalAlert: async (tenantSlug: string, token: string, alertId: string, data: any) => {
    const response = await ehrAxios.patch(`/lab/critical-alerts/${alertId}/escalate`, data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getLabCriticalAlertStats: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/critical-alerts/stats/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkAndGenerateAlerts: async (tenantSlug: string, token: string, data: any) => {
    const response = await ehrAxios.post('/lab/critical-alerts/check-and-generate', data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Critical Alerts API
  getPendingCriticalAlerts: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/critical-alerts/pending', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientCriticalAlerts: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/critical-alerts/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  acknowledgeCriticalAlert: async (alertId: string, notes: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/critical-alerts/${alertId}/acknowledge`, { notes }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  dismissCriticalAlert: async (alertId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/critical-alerts/${alertId}/dismiss`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Drugs API
  searchDrugs: async (token: string, tenantSlug: string, search?: string, drugClass?: string) => {
    const params: any = {};
    if (search) params.search = search;
    if (drugClass) params.drugClass = drugClass;
    
    const response = await ehrAxios.get('/drugs', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  getDrugById: async (drugId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/drugs/${drugId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  searchDrugByName: async (name: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/drugs/search', { name }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkDrugInteractions: async (drugIds: string[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/drugs/check-interactions', { drugIds }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  checkFoodInteractions: async (medications: any[], token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/medications/food-interactions', {
      medications
    }, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  seedDrugs: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/drugs/seed', {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // HIV/AIDS/TB APIs
  createHivTest: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/tests', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getPatientHivTests: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/tests/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  processHivAlgorithm: async (testId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/hiv/tests/${testId}/process-algorithm`, {}, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  enrollInHivCare: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/enrollments', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivEnrollments: async (status: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/enrollments', {
      params: { status },
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getPatientHivEnrollment: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/enrollments/patient/${patientId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivEnrollmentById: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/enrollments/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: { enrollment: response.data } };
  },
  createTbScreening: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/tb-screenings', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  createCervicalCancerScreening: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/cervical-cancer-screenings', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  createHivClinicalVisit: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/visits', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivClinicalVisits: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/visits/enrollment/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivVisitCount: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/visits/count/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  saveArtInitiationDetails: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/art-initiation-details', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getHivLookupData: async (tableName: string, query: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/lookup/${tableName}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: query
    });
    return { data: response.data };
  },
  
  // EAC APIs
  createEacSession: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/eac/sessions', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getEacSessions: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/eac/enrollment/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  checkEacEligibility: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/eac/check/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  
  getMatchingLabResults: async (patientId: string, visitDate: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/lab-results/match`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { patientId, visitDate }
    });
    return { data: response.data };
  },
  
  // ARV Change Request APIs
  precheckHivRegimenChange: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/regimen-change/precheck', body, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  createArvChangeRequest: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/arv-change-requests', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getArvChangeRequests: async (status: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/arv-change-requests', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { status }
    });
    return { data: response.data };
  },
  approveArvChangeRequest: async (requestId: string, body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/hiv/arv-change-requests/${requestId}/approve`, body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  rejectArvChangeRequest: async (requestId: string, body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/hiv/arv-change-requests/${requestId}/reject`, body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getApprovedArvChange: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/arv-change-requests/enrollment/${enrollmentId}/approved`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // HIV Monitoring & Quality Metrics APIs
  getVlPathway: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/vl-pathway/${enrollmentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getDsdStatus: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/dsd-status/${enrollmentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getMonitoringSchedules: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/monitoring-schedules/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getQualityMetrics: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/quality-metrics', {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivCohortWorklist: async (
    params: { focus?: string; limit?: number } | undefined,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get('/hiv/cohort-worklist', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params,
    });
    return { data: response.data };
  },
  getClinicalAlerts: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/alerts/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getAdherenceTracking: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/adherence/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getRegimenHistory: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/regimen-history/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  checkTptEligibility: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/tpt-eligibility/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getTptCompletionStatus: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/tpt-completion/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getVisitTemplates: async (visitType: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/visit-templates', {
      params: visitType ? { visitType } : {},
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  calculatePediatricDose: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/calculate-pediatric-dose', body, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getLTFUPatients: async (days: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/ltfu-patients', {
      params: { days },
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // HIV Referral Management
  createHivReferral: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/referrals', data, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getHivReferrals: async (query: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/referrals', {
      params: query,
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  getEnrollmentReferrals: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/referrals/enrollment/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  updateReferralStatus: async (referralId: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/hiv/referrals/${referralId}/update-status`, data, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Audit Trail
  getAuditLog: async (enrollmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/audit-log/enrollment/${enrollmentId}`, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Medication Stock Management
  getMedicationStock: async (query: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/medication-stock', {
      params: query,
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  createMedicationStock: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/medication-stock', data, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  updateMedicationStock: async (stockId: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/hiv/medication-stock/${stockId}`, data, {
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Cohort Analysis
  getCohortAnalysis: async (cohortType: string, timeRange: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/cohort-analysis', {
      params: { type: cohortType, range: timeRange },
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
  // Comparison Reports
  getComparisonReport: async (params: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/comparison-report', {
      params,
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Monthly Return Form
  getMonthlyReturn: async (year: number, month: number, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/hiv/monthly-return', {
      params: { year, month },
      headers: { 
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  sendDhis2AggregateReport: async (
    payload: {
      profile: string;
      period?: string;
      periodStart?: string;
      periodEnd?: string;
      orgUnit?: string;
      dataSet?: string;
      dataElements?: Record<string, string>;
      dataValues?: Array<{ dataElement: string; value: string | number; orgUnit?: string; period?: string }>;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/dhis2/reports/aggregate', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getModuleGeneralReport: async (
    moduleKey: string,
    token: string,
    tenantSlug: string,
    days = 30,
  ) => {
    const response = await ehrAxios.get(`/reports/modules/${encodeURIComponent(moduleKey)}/general`, {
      params: { days },
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // ===== FINANCE & ACCOUNTS =====
  getFinanceSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/finance/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getFinancialTransactions: async (
    tenantSlug: string,
    token: string,
    params: {
      status?: string;
      module?: string;
      payerType?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) => {
    const response = await ehrAxios.get('/finance/transactions', {
      params,
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getFinancialTransactionDetail: async (tenantSlug: string, token: string, transactionId: string) => {
    const response = await ehrAxios.get(`/finance/transactions/${transactionId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getFinancialTransactionQuote: async (tenantSlug: string, token: string, transactionId: string) => {
    const response = await ehrAxios.get(`/finance/transactions/${transactionId}/quote`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordFinancialPayment: async (
    tenantSlug: string,
    token: string,
    transactionId: string,
    payload: { amount: number; paymentMethod: string; paymentReference?: string; gatewayReference?: string; note?: string },
  ) => {
    const response = await ehrAxios.post(`/finance/transactions/${transactionId}/payments`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  downloadInvoicePdf: async (tenantSlug: string, token: string, transactionId: string, templateId?: string) => {
    const response = await ehrAxios.get(`/finance/transactions/${transactionId}/invoice.pdf`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params: templateId ? { templateId } : undefined,
      responseType: 'blob',
    });
    return response;
  },

  getInvoiceTemplates: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/finance/invoice-templates', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createInvoiceTemplate: async (tenantSlug: string, token: string, templateData: any) => {
    const response = await ehrAxios.post('/finance/invoice-templates', templateData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateInvoiceTemplate: async (tenantSlug: string, token: string, templateId: string, templateData: any) => {
    const response = await ehrAxios.put(`/finance/invoice-templates/${templateId}`, templateData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  setDefaultInvoiceTemplate: async (tenantSlug: string, token: string, templateId: string) => {
    const response = await ehrAxios.post(`/finance/invoice-templates/${templateId}/default`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getFinancialReports: async (
    tenantSlug: string,
    token: string,
    params: {
      reportType: 'revenue' | 'profit_loss' | 'cash_flow' | 'aging';
      dateFrom?: string;
      dateTo?: string;
      groupBy?: 'day' | 'week' | 'month' | 'year';
    },
  ) => {
    // Map frontend reportType to backend endpoints
    let endpoint = '';
    const queryParams: any = {};
    
    switch (params.reportType) {
      case 'revenue':
        endpoint = '/financial-reports/revenue';
        if (params.dateFrom) queryParams.startDate = params.dateFrom;
        if (params.dateTo) queryParams.endDate = params.dateTo;
        if (params.groupBy) {
          // Map groupBy to backend period
          const periodMap: Record<string, string> = {
            day: 'daily',
            week: 'weekly',
            month: 'monthly',
            year: 'yearly',
          };
          queryParams.period = periodMap[params.groupBy] || 'monthly';
          queryParams.groupBy = params.groupBy;
        }
        break;
      case 'profit_loss':
        endpoint = '/financial-reports/profit-loss';
        if (params.dateFrom) queryParams.startDate = params.dateFrom;
        if (params.dateTo) queryParams.endDate = params.dateTo;
        break;
      case 'cash_flow':
        endpoint = '/financial-reports/cash-flow';
        if (params.dateFrom) queryParams.startDate = params.dateFrom;
        if (params.dateTo) queryParams.endDate = params.dateTo;
        break;
      case 'aging':
        endpoint = '/financial-reports/aging';
        if (params.dateTo) queryParams.asOfDate = params.dateTo;
        break;
    }

    const response = await ehrAxios.get(endpoint, {
      params: queryParams,
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getTaxSummary: async (tenantSlug: string, token: string, params?: { dateFrom?: string; dateTo?: string }) => {
    // Use VAT report endpoint for tax summary
    if (!params?.dateFrom || !params?.dateTo) {
      throw new Error('dateFrom and dateTo are required for tax summary');
    }
    const response = await ehrAxios.get('/tax/vat/report', {
      params: {
        startDate: params.dateFrom,
        endDate: params.dateTo,
      },
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  calculateTax: async (tenantSlug: string, token: string, amount: number, taxRate?: number) => {
    const response = await ehrAxios.post(
      '/tax/vat/calculate',
      { amount, taxRate },
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  reconcilePayment: async (
    tenantSlug: string,
    token: string,
    reconciliationData: {
      transactionId: string;
      reconciliationDate: string;
      reconciledAmount: number;
      bankReference?: string;
      notes?: string;
    },
  ) => {
    // Map to payment reconciliation match endpoint
    const response = await ehrAxios.post(
      '/payment-reconciliation/match',
      {
        paymentId: reconciliationData.transactionId,
        bankEntryId: reconciliationData.bankReference || '',
      },
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  getReconciliationReport: async (tenantSlug: string, token: string, params?: { dateFrom?: string; dateTo?: string }) => {
    if (!params?.dateFrom || !params?.dateTo) {
      throw new Error('dateFrom and dateTo are required for reconciliation report');
    }
    const response = await ehrAxios.get('/payment-reconciliation/report', {
      params: {
        startDate: params.dateFrom,
        endDate: params.dateTo,
        status: 'all',
      },
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // ===== REPORTS (viewable / exportable) =====
  getLabResultsReport: async (
    tenantSlug: string,
    token: string,
    params?: { startDate?: string; endDate?: string; limit?: number },
  ) => {
    const response = await ehrAxios.get('/reports/lab-results', {
      params: params || {},
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getReferralReport: async (
    tenantSlug: string,
    token: string,
    params?: { dateFrom?: string; dateTo?: string },
  ) => {
    const response = await ehrAxios.get('/referrals/report', {
      params: { dateFrom: params?.dateFrom, dateTo: params?.dateTo },
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getImmunizationCoverageReport: async (
    tenantSlug: string,
    token: string,
    params?: { periodStart?: string; periodEnd?: string; antigen?: string; ageGroup?: string },
  ) => {
    const response = await ehrAxios.get('/immunizations/report/coverage', {
      params: params || {},
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getMortalityReport: async (
    tenantSlug: string,
    token: string,
    params?: { startDate?: string; endDate?: string },
  ) => {
    const response = await ehrAxios.get('/reports/quality/mortality', {
      params: params || {},
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getTaxReport: async (
    tenantSlug: string,
    token: string,
    params: { startDate: string; endDate: string; payeTaxPeriod?: string },
  ) => {
    const response = await ehrAxios.get('/tax/report', {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ===== ENHANCED LIS - CRITICAL ALERTS =====
  getCriticalAlertStats: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/lab/critical-alerts/stats/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ===== RADIOLOGY & MEDICAL IMAGING API =====

  // Modalities & Study Types
  getImagingModalities: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/imaging/modalities', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingStudyTypes: async (tenantSlug: string, token: string, modalityCode?: string) => {
    const response = await ehrAxios.get('/imaging/study-types', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { modality: modalityCode }
    });
    return { data: response.data };
  },

  // Imaging Orders
  createImagingOrder: async (tenantSlug: string, token: string, orderData: any) => {
    const response = await ehrAxios.post('/imaging/orders', orderData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingOrders: async (tenantSlug: string, token: string, filters?: any) => {
    const response = await ehrAxios.get('/imaging/orders', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: filters
    });
    return { data: response.data };
  },

  prepareImagingOrderAiReview: async (tenantSlug: string, token: string, orderId: string) => {
    const response = await ehrAxios.post(`/imaging/orders/${orderId}/ai-review`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingOrderAiReview: async (tenantSlug: string, token: string, orderId: string) => {
    const response = await ehrAxios.get(`/imaging/orders/${orderId}/ai-review`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getPatientImagingOrders: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/imaging/orders/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Imaging Studies
  getImagingStudies: async (
    tenantSlug: string,
    token: string,
    filters?: { status?: string; modality?: string; radiologist?: string },
  ) => {
    const response = await ehrAxios.get('/imaging/studies', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params: filters,
    });
    return { data: response.data };
  },

  getImagingStudy: async (tenantSlug: string, token: string, studyId: string) => {
    const response = await ehrAxios.get(`/imaging/studies/${studyId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  generateImagingReportDraft: async (tenantSlug: string, token: string, studyId: string) => {
    const response = await ehrAxios.post(`/imaging/studies/${studyId}/report-draft`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getImagingReportDraft: async (tenantSlug: string, token: string, studyId: string) => {
    const response = await ehrAxios.get(`/imaging/studies/${studyId}/report-draft`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getImagingReportTemplates: async (tenantSlug: string, token: string, params: { modality?: string; study_type?: string } = {}) => {
    const response = await ehrAxios.get('/imaging/reports/templates', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  getImageAnnotations: async (tenantSlug: string, token: string, imageId: string) => {
    const response = await ehrAxios.get(`/imaging/images/${imageId}/annotations`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  addImageAnnotation: async (tenantSlug: string, token: string, imageId: string, annotation: { annotation_type: string; annotation_text?: string; annotation_data?: any }) => {
    const response = await ehrAxios.post(`/imaging/images/${imageId}/annotations`, annotation, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
 
  uploadImagingStudyImage: async (tenantSlug: string, token: string, studyId: string, payload: any) => {
    const response = await ehrAxios.post(`/imaging/studies/${studyId}/images`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deleteImagingStudyImage: async (tenantSlug: string, token: string, studyId: string, imageId: string) => {
    const response = await ehrAxios.delete(`/imaging/studies/${studyId}/images/${imageId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  scheduleImagingOrder: async (
    tenantSlug: string,
    token: string,
    orderId: string,
    scheduledDate: string,
  ) => {
    const response = await ehrAxios.patch(
      `/imaging/orders/${orderId}/schedule`,
      { scheduled_date: scheduledDate },
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  createImagingStudy: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/imaging/studies', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  completeImagingStudy: async (
    tenantSlug: string,
    token: string,
    studyId: string,
    payload: { completion_notes?: string } = {},
  ) => {
    const response = await ehrAxios.patch(`/imaging/studies/${studyId}/complete`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
 
  assignRadiologist: async (tenantSlug: string, token: string, studyId: string, radiologistId: string) => {
    const response = await ehrAxios.patch(`/imaging/studies/${studyId}/assign`, 
      { radiologist_id: radiologistId },
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return { data: response.data };
  },

  getRadiologistWorklist: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/imaging/worklist', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getMyImagingStudies: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/imaging/worklist/my-studies', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getDoctorImagingResults: async (
    tenantSlug: string,
    token: string,
    params: { status?: string; patient_id?: string } = {},
  ) => {
    const response = await ehrAxios.get('/imaging/doctor/results', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  acknowledgeImagingReport: async (
    tenantSlug: string,
    token: string,
    reportId: string,
    payload: { acknowledgment_notes?: string } = {},
  ) => {
    const response = await ehrAxios.post(`/imaging/reports/${reportId}/acknowledge`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // Imaging Reports
  createImagingReport: async (tenantSlug: string, token: string, reportData: any) => {
    const response = await ehrAxios.post('/imaging/reports', reportData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingReport: async (tenantSlug: string, token: string, reportId: string) => {
    const response = await ehrAxios.get(`/imaging/reports/${reportId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getImagingReportDiscrepancyReviews: async (tenantSlug: string, token: string, reportId: string) => {
    const response = await ehrAxios.get(`/imaging/reports/${reportId}/discrepancy-reviews`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getImagingReportIncidentalFollowups: async (tenantSlug: string, token: string, reportId: string) => {
    const response = await ehrAxios.get(`/imaging/reports/${reportId}/incidental-followups`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  resolveImagingDiscrepancyReview: async (
    tenantSlug: string,
    token: string,
    reviewId: string,
    payload: { review_status?: string; resolution_notes?: string } = {},
  ) => {
    const response = await ehrAxios.patch(`/imaging/discrepancy-reviews/${reviewId}/resolve`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  acknowledgeImagingIncidentalFollowup: async (
    tenantSlug: string,
    token: string,
    followupId: string,
    payload: { resolution_notes?: string } = {},
  ) => {
    const response = await ehrAxios.patch(`/imaging/incidental-followups/${followupId}/acknowledge`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  completeImagingIncidentalFollowup: async (
    tenantSlug: string,
    token: string,
    followupId: string,
    payload: { resolution_notes?: string } = {},
  ) => {
    const response = await ehrAxios.patch(`/imaging/incidental-followups/${followupId}/complete`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateImagingReport: async (tenantSlug: string, token: string, reportId: string, reportData: any) => {
    const response = await ehrAxios.patch(`/imaging/reports/${reportId}`, reportData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  signImagingReport: async (tenantSlug: string, token: string, reportId: string) => {
    const response = await ehrAxios.post(`/imaging/reports/${reportId}/sign`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ===== ONCOLOGY API =====

  getOncologyCases: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/oncology/cases', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getOncologyCaseDetail: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOncologyCase: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/oncology/cases', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOncologyCase: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/cases/${caseId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOncologyStagingEntry: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/staging`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOncologyRegimen: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/regimens`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOncologyRegimen: async (tenantSlug: string, token: string, regimenId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/regimens/${regimenId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyRegimenSessions: async (tenantSlug: string, token: string, regimenId: string) => {
    const response = await ehrAxios.get(`/oncology/regimens/${regimenId}/sessions`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOncologyInfusionSession: async (tenantSlug: string, token: string, regimenId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/regimens/${regimenId}/sessions`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOncologyInfusionSession: async (tenantSlug: string, token: string, sessionId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/sessions/${sessionId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyAdverseEvents: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/adverse-events`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordOncologyAdverseEvent: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/adverse-events`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOncologyResponseAssessment: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/response-assessments`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyResponseAssessments: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/response-assessments`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  calculateOncologyAssessmentRecist: async (
    tenantSlug: string,
    token: string,
    caseId: string,
    assessmentId: string,
    payload: any,
  ) => {
    const response = await ehrAxios.post(
      `/oncology/cases/${caseId}/response-assessments/${assessmentId}/calculate-recist`,
      payload,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  getOncologyBestResponse: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/best-response`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologySurvivalMetrics: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/survival-metrics`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologySurvivorshipPlan: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/survivorship-plan`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOncologySurvivorshipPlan: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/survivorship-plan`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOncologySurvivorshipPlan: async (tenantSlug: string, token: string, planId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/survivorship-plans/${planId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyUpcomingFollowUps: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/follow-ups/upcoming`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologySurvivorshipReport: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/survivorship-report`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  enrollOncologyClinicalTrial: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/clinical-trials`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyClinicalTrials: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/clinical-trials`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOncologyClinicalTrialStatus: async (tenantSlug: string, token: string, trialId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/clinical-trials/${trialId}/status`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  trackOncologyTrialCompliance: async (tenantSlug: string, token: string, trialId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/clinical-trials/${trialId}/compliance`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyTrialEndpoints: async (tenantSlug: string, token: string, trialId: string) => {
    const response = await ehrAxios.get(`/oncology/clinical-trials/${trialId}/endpoints`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordOncologyPRO: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/pros`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyPROHistory: async (tenantSlug: string, token: string, caseId: string, params?: any) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/pros`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getOncologyPROTrends: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/pros/trends`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  calculateOncologyProScore: async (tenantSlug: string, token: string, proId: string) => {
    const response = await ehrAxios.post(`/oncology/pros/${proId}/calculate-scores`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordOncologyGenomicData: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/genomic-data`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyGenomicSummary: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/genomic-summary`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyTargetedTherapies: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/targeted-therapies`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyResponseAnalytics: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/oncology/analytics/response-rates', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getOncologySurvivalAnalytics: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/oncology/analytics/survival', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getOncologyBiomarkerAnalytics: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/oncology/analytics/biomarkers', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getOncologyTrialAnalytics: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/oncology/analytics/trials', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  recordOncologyFinancialToxicity: async (tenantSlug: string, token: string, caseId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/financial-toxicity`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyFinancialSummary: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/financial-summary`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyFinancialAssistance: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/financial-assistance`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyTreatmentRecommendations: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/treatment-recommendations`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyProtocolBundle: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/protocol-bundle`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  executeOncologyProtocolBundleAction: async (
    tenantSlug: string,
    token: string,
    caseId: string,
    actionId: string,
    payload: { note?: string; actionPayload?: any } = {},
  ) => {
    const response = await ehrAxios.post(
      `/oncology/cases/${caseId}/protocol-bundle/actions/${actionId}/execute`,
      payload,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  getOncologySurveillanceReminders: async (tenantSlug: string, token: string, caseId: string) => {
    const response = await ehrAxios.get(`/oncology/cases/${caseId}/surveillance-reminders`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  checkOncologyCaseAlerts: async (tenantSlug: string, token: string, caseId: string, payload: any = {}) => {
    const response = await ehrAxios.post(`/oncology/cases/${caseId}/check-alerts`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getTumorBoardMeetings: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/oncology/tumor-board/meetings', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createTumorBoardMeeting: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/oncology/tumor-board/meetings', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addTumorBoardRecommendation: async (tenantSlug: string, token: string, meetingId: string, payload: any) => {
    const response = await ehrAxios.post(`/oncology/tumor-board/meetings/${meetingId}/recommendations`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateTumorBoardRecommendation: async (tenantSlug: string, token: string, recommendationId: string, payload: any) => {
    const response = await ehrAxios.patch(`/oncology/tumor-board/recommendations/${recommendationId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOncologyDashboardSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/oncology/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // ===== OPHTHALMOLOGY API =====

  getOphthalmologyEncounters: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/ophthalmology/encounters', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getOphthalmologyEncounterDetail: async (tenantSlug: string, token: string, encounterId: string) => {
    const response = await ehrAxios.get(`/ophthalmology/encounters/${encounterId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createOphthalmologyEncounter: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/ophthalmology/encounters', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOphthalmologyEncounter: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.patch(`/ophthalmology/encounters/${encounterId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOphthalmologyVisualAcuity: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.post(`/ophthalmology/encounters/${encounterId}/visual-acuity`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOphthalmologyRefraction: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.post(`/ophthalmology/encounters/${encounterId}/refraction`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOphthalmologySlitLampFinding: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.post(`/ophthalmology/encounters/${encounterId}/slit-lamp`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addOphthalmologyOctStudy: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.post(`/ophthalmology/encounters/${encounterId}/oct`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  scheduleOphthalmologyFollowUp: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/ophthalmology/follow-ups', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateOphthalmologyFollowUp: async (tenantSlug: string, token: string, followUpId: string, payload: any) => {
    const response = await ehrAxios.patch(`/ophthalmology/follow-ups/${followUpId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOphthalmologyFollowUps: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/ophthalmology/patients/${patientId}/follow-ups`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordOphthalmologyProcedure: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/ophthalmology/procedures', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOphthalmologyProcedures: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/ophthalmology/patients/${patientId}/procedures`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getOphthalmologyDashboardSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/ophthalmology/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // ===== MATERNITY & OBSTETRICS API =====

  // Enrollments
  createMaternityEnrollment: async (tenantSlug: string, token: string, enrollmentData: any) => {
    const response = await ehrAxios.post('/maternity/enrollments', enrollmentData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getMaternityEnrollments: async (tenantSlug: string, token: string, filters?: any) => {
    const response = await ehrAxios.get('/maternity/enrollments', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: filters
    });
    return { data: response.data };
  },

  getMaternityEnrollment: async (tenantSlug: string, token: string, enrollmentId: string) => {
    const response = await ehrAxios.get(`/maternity/enrollments/${enrollmentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ANC Visits
  precheckANCVisit: async (tenantSlug: string, token: string, visitData: any) => {
    const response = await ehrAxios.post('/maternity/anc-visits/precheck', visitData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createANCVisit: async (tenantSlug: string, token: string, visitData: any) => {
    const response = await ehrAxios.post('/maternity/anc-visits', visitData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getEnrollmentANCVisits: async (tenantSlug: string, token: string, enrollmentId: string) => {
    const response = await ehrAxios.get(`/maternity/anc-visits/enrollment/${enrollmentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Deliveries
  precheckDelivery: async (tenantSlug: string, token: string, deliveryData: any) => {
    const response = await ehrAxios.post('/maternity/deliveries/precheck', deliveryData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createDelivery: async (tenantSlug: string, token: string, deliveryData: any) => {
    const response = await ehrAxios.post('/maternity/deliveries', deliveryData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createBirthOutcome: async (tenantSlug: string, token: string, deliveryId: string, birthData: any) => {
    const response = await ehrAxios.post(`/maternity/deliveries/${deliveryId}/birth-outcomes`, birthData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  precheckBirthOutcome: async (tenantSlug: string, token: string, birthData: any) => {
    const response = await ehrAxios.post('/maternity/birth-outcomes/precheck', birthData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Postnatal Visits
  precheckPostnatalVisit: async (tenantSlug: string, token: string, visitData: any) => {
    const response = await ehrAxios.post('/maternity/postnatal-visits/precheck', visitData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createPostnatalVisit: async (tenantSlug: string, token: string, visitData: any) => {
    const response = await ehrAxios.post('/maternity/postnatal-visits', visitData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getMaternityCareTasks: async (
    tenantSlug: string,
    token: string,
    filters?: {
      status?: 'open' | 'acknowledged' | 'actioned' | 'closed';
      priority?: 'low' | 'medium' | 'high' | 'critical';
    },
  ) => {
    const response = await ehrAxios.get('/maternity/care-tasks', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: filters,
    });
    return { data: response.data };
  },

  getMaternityCareTaskMetrics: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/care-tasks/metrics', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateMaternityCareTaskStatus: async (
    tenantSlug: string,
    token: string,
    taskId: string,
    payload: {
      status: 'open' | 'acknowledged' | 'actioned' | 'closed';
      note?: string;
      assigned_to?: string;
    },
  ) => {
    const response = await ehrAxios.patch(`/maternity/care-tasks/${taskId}/status`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  applyMaternityCareTaskRecommendations: async (
    tenantSlug: string,
    token: string,
    taskId: string,
    payload: {
      recommendation_ids?: string[];
    } = {},
  ) => {
    const response = await ehrAxios.post(`/maternity/care-tasks/${taskId}/apply-recommendations`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getMaternitySuggestNextVisit: async (
    tenantSlug: string,
    token: string,
    enrollmentId: string,
    type: 'anc' | 'postnatal',
    visitDate: string,
  ) => {
    const response = await ehrAxios.get(
      `/maternity/enrollments/${enrollmentId}/suggest-next-visit`,
      {
        params: { type, visit_date: visitDate },
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  // Maternity Indicators
  getMaternityIndicators: async (tenantSlug: string, token: string, startDate?: string, endDate?: string) => {
    const response = await ehrAxios.get('/maternity/indicators', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params: { start_date: startDate, end_date: endDate }
    });
    return { data: response.data };
  },

  getHighRiskPregnancies: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/high-risk-pregnancies', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getUpcomingDeliveries: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/upcoming-deliveries', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getOverdueANC: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/overdue-anc', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getRecentNeonatalOutcomes: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/neonatal/recent-outcomes', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getRecentPostnatalVisits: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/maternity/postnatal/recent-visits', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
 
  addMaternityRiskFactor: async (tenantSlug: string, token: string, enrollmentId: string, riskData: any) => {
    const response = await ehrAxios.post(`/maternity/enrollments/${enrollmentId}/risk-factors`, riskData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getMaternityRiskFactors: async (tenantSlug: string, token: string, enrollmentId: string) => {
    const response = await ehrAxios.get(`/maternity/enrollments/${enrollmentId}/risk-factors`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Patient History API
  getMedicalHistory: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/history/medical`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createMedicalHistory: async (patientId: string, historyData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/patients/${patientId}/history/medical`, historyData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateMedicalHistory: async (patientId: string, historyId: string, historyData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/patients/${patientId}/history/medical/${historyId}`, historyData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deleteMedicalHistory: async (patientId: string, historyId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/patients/${patientId}/history/medical/${historyId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getFamilyHistory: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/history/family`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createFamilyHistory: async (patientId: string, historyData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/patients/${patientId}/history/family`, historyData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateFamilyHistory: async (patientId: string, historyId: string, historyData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/patients/${patientId}/history/family/${historyId}`, historyData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deleteFamilyHistory: async (patientId: string, historyId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/patients/${patientId}/history/family/${historyId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getSocialHistory: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/history/social`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  createSocialHistory: async (patientId: string, historyData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/patients/${patientId}/history/social`, historyData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  updateSocialHistory: async (patientId: string, historyId: string, historyData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/patients/${patientId}/history/social/${historyId}`, historyData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  deleteSocialHistory: async (patientId: string, historyId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/patients/${patientId}/history/social/${historyId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getHistoryTimeline: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/history/timeline`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // ===== CARDIOLOGY API =====
  getCardiologyEncounters: async (tenantSlug: string, token: string, params: any = {}) => {
    const response = await ehrAxios.get('/cardiology/encounters', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  createCardiologyEncounter: async (tenantSlug: string, token: string, payload: any) => {
    const response = await ehrAxios.post('/cardiology/encounters', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateCardiologyEncounter: async (tenantSlug: string, token: string, encounterId: string, payload: any) => {
    const response = await ehrAxios.patch(`/cardiology/encounters/${encounterId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getCardiologyDashboardSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/cardiology/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  saveHivNurseIntake: async (body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/hiv/nurse-intakes', body, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getHivNurseIntakesByPatient: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/nurse-intakes/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  getHivNurseIntakeForAppointment: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/hiv/nurse-intakes/appointment/${appointmentId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  // Telemedicine
  getTelemedicineConsultations: async (token: string, tenantSlug: string, query?: any) => {
    const response = await ehrAxios.get('/telemedicine/consultations', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: query,
    });
    return { data: response.data };
  },

  getTelemedicineConsultation: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/telemedicine/consultations/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createTelemedicineConsultation: async (consultationData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/telemedicine/consultations', consultationData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateTelemedicineConsultation: async (id: string, updateData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/telemedicine/consultations/${id}`, updateData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  joinTelemedicineConsultation: async (id: string, joinData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/telemedicine/consultations/${id}/join`, joinData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  endTelemedicineConsultation: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/telemedicine/consultations/${id}/end`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTelemedicineMeetingUrl: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/telemedicine/consultations/${id}/meeting-url`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTelemedicineMonitoringAlerts: async (token: string, tenantSlug: string, patientId?: string) => {
    const response = await ehrAxios.get('/telemedicine/monitoring/alerts', {
      params: patientId ? { patientId } : {},
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Patient-Reported Outcomes (PROs) - Questionnaire Management
  getProTrends: async (patientId: string, token: string, tenantSlug: string, filters?: { questionnaireCode?: string; limit?: number }) => {
    const params: any = {};
    if (filters?.questionnaireCode) params.questionnaireCode = filters.questionnaireCode;
    if (filters?.limit) params.limit = filters.limit;

    const response = await ehrAxios.get(`/pro/patients/${patientId}/trends`, {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientProSchedules: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pro/patients/${patientId}/schedules`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createProSchedule: async (patientId: string, scheduleData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/pro/patients/${patientId}/schedules`, scheduleData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateProSchedule: async (scheduleId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pro/schedules/${scheduleId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteProSchedule: async (scheduleId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/pro/schedules/${scheduleId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPopulationProAnalytics: async (token: string, tenantSlug: string, filters?: { dateFrom?: string; dateTo?: string; questionnaireCode?: string; category?: string }) => {
    const response = await ehrAxios.get('/pro/analytics/population', {
      params: filters,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  triggerProEvent: async (patientId: string, eventType: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/pro/patients/${patientId}/trigger-event`, { eventType }, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientProAlerts: async (patientId: string, token: string, tenantSlug: string, status?: 'active' | 'acknowledged' | 'resolved' | 'dismissed') => {
    const params: any = {};
    if (status) params.status = status;
    const response = await ehrAxios.get(`/pro/patients/${patientId}/alerts`, {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientQuestionnaireHistory: async (patientId: string, token: string, tenantSlug: string, filters?: { limit?: number; category?: string }) => {
    const params: any = {};
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.category) params.category = filters.category;
    const response = await ehrAxios.get(`/pro/patients/${patientId}/questionnaires/history`, {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Questionnaire Library (Doctor-facing)
  browseQuestionnaireLibrary: async (token: string, tenantSlug: string, filters?: { category?: string; search?: string }) => {
    const params: any = {};
    if (filters?.category) params.category = filters.category;
    if (filters?.search) params.search = filters.search;
    const response = await ehrAxios.get('/pro/library', {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getQuestionnaireFromLibrary: async (code: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pro/library/${code}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  importQuestionnaireFromLibrary: async (code: string, token: string, tenantSlug: string, overwrite?: boolean) => {
    const params: any = {};
    if (overwrite) params.overwrite = 'true';
    const response = await ehrAxios.post(`/pro/library/${code}/import`, null, {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  assignQuestionnaireByCode: async (patientId: string, code: string, token: string, tenantSlug: string, options?: { autoImport?: boolean; dueDate?: string; notes?: string; appointmentId?: string }) => {
    const params: any = {};
    if (options?.autoImport) params.autoImport = 'true';
    if (options?.dueDate) params.dueDate = options.dueDate;
    const response = await ehrAxios.post(`/pro/patients/${patientId}/assign/${code}`, {
      notes: options?.notes,
      appointmentId: options?.appointmentId,
    }, {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createQuestionnaireTemplate: async (template: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pro/templates', template, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateQuestionnaireTemplate: async (templateId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pro/templates/${templateId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteQuestionnaireTemplate: async (templateId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/pro/templates/${templateId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getQuestionnaireTemplates: async (token: string, tenantSlug: string, includeInactive?: boolean) => {
    const params: any = {};
    if (includeInactive) params.includeInactive = 'true';
    const response = await ehrAxios.get('/pro/templates', {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Clinical Workflows
  createWorkflow: async (workflowData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/workflows', workflowData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getWorkflows: async (token: string, tenantSlug: string, filters?: { triggerEvent?: string; isActive?: boolean; search?: string }) => {
    const params: any = {};
    if (filters?.triggerEvent) params.triggerEvent = filters.triggerEvent;
    if (filters?.isActive !== undefined) params.isActive = filters.isActive;
    if (filters?.search) params.search = filters.search;
    const response = await ehrAxios.get('/workflows', {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getWorkflowById: async (workflowId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/workflows/${workflowId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateWorkflow: async (workflowId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/workflows/${workflowId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteWorkflow: async (workflowId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/workflows/${workflowId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  activateWorkflow: async (workflowId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/workflows/${workflowId}/activate`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deactivateWorkflow: async (workflowId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/workflows/${workflowId}/deactivate`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  duplicateWorkflow: async (workflowId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/workflows/${workflowId}/duplicate`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  addWorkflowStep: async (workflowId: string, stepData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/workflows/${workflowId}/steps`, stepData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateWorkflowStep: async (stepId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/workflows/steps/${stepId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteWorkflowStep: async (stepId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/workflows/steps/${stepId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  executeWorkflow: async (executionData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/workflows/execute', executionData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getWorkflowExecutions: async (token: string, tenantSlug: string, filters?: { workflowId?: string; patientId?: string; status?: string; limit?: number }) => {
    const params: any = {};
    if (filters?.workflowId) params.workflowId = filters.workflowId;
    if (filters?.patientId) params.patientId = filters.patientId;
    if (filters?.status) params.status = filters.status;
    if (filters?.limit) params.limit = filters.limit;
    const response = await ehrAxios.get('/workflows/executions', {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getWorkflowExecutionById: async (executionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/workflows/executions/${executionId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  cancelWorkflowExecution: async (executionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/workflows/executions/${executionId}/cancel`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getWorkflowExecutionSteps: async (executionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/workflows/executions/${executionId}/steps`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getWorkflowTemplates: async (token: string, tenantSlug: string, category?: string) => {
    const params: any = {};
    if (category) params.category = category;
    const response = await ehrAxios.get('/workflows/templates', {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createWorkflowFromTemplate: async (templateId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/workflows/templates/${templateId}/apply`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Analytics
  getWorkflowAnalytics: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/workflows/analytics/overview', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getWorkflowAnalyticsById: async (workflowId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/workflows/analytics/${workflowId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Execution Management
  cancelExecution: async (executionId: string, reason: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/workflows/executions/${executionId}/cancel`, 
      { reason },
      {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      }
    );
    return { data: response.data };
  },

  retryFailedStep: async (stepExecutionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/workflows/step-executions/${stepExecutionId}/retry`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ==================== CARE PLANS ====================

  // Care Plan Management
  createCarePlan: async (carePlanData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/care-plans', carePlanData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getCarePlans: async (patientId: string, filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/care-plans', {
      params: { patientId, ...filters },
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getCarePlanById: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/care-plans/${carePlanId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateCarePlan: async (carePlanId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/care-plans/${carePlanId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteCarePlan: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/care-plans/${carePlanId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  completeCarePlan: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/${carePlanId}/complete`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  activateCarePlan: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/${carePlanId}/activate`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  holdCarePlan: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/${carePlanId}/hold`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Goals
  addGoal: async (carePlanId: string, goalData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/${carePlanId}/goals`, goalData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateGoal: async (goalId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/care-plans/goals/${goalId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteGoal: async (goalId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/care-plans/goals/${goalId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  achieveGoal: async (goalId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/goals/${goalId}/achieve`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Interventions
  addIntervention: async (carePlanId: string, interventionData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/${carePlanId}/interventions`, interventionData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateIntervention: async (interventionId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/care-plans/interventions/${interventionId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteIntervention: async (interventionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/care-plans/interventions/${interventionId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  completeIntervention: async (interventionId: string, outcomeNotes: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/interventions/${interventionId}/complete`, 
      { outcomeNotes },
      {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      }
    );
    return { data: response.data };
  },

  // Progress
  recordProgress: async (carePlanId: string, progressData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/${carePlanId}/progress`, progressData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getCarePlanProgress: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/care-plans/${carePlanId}/progress`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Outcomes
  assessOutcome: async (carePlanId: string, outcomeData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/${carePlanId}/outcomes`, outcomeData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getOutcomes: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/care-plans/${carePlanId}/outcomes`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Templates
  getCarePlanTemplates: async (category: string | null, token: string, tenantSlug: string) => {
    const params: any = {};
    if (category) params.category = category;
    const response = await ehrAxios.get('/care-plans/templates', {
      params,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getCarePlanTemplateById: async (templateId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/care-plans/templates/${templateId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createCarePlanTemplate: async (templateData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/care-plans/templates', templateData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateCarePlanTemplate: async (templateId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/care-plans/templates/${templateId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  applyCarePlanTemplate: async (templateId: string, patientId: string, customizations: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/care-plans/templates/${templateId}/apply`, 
      { patientId, customizations },
      {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      }
    );
    return { data: response.data };
  },


  // Emergency Department
  getEDTrackingBoard: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/ed/tracking-board', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getEDMetrics: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/ed/metrics', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Bed Management

  // Document Version Management
  getDocumentVersions: async (documentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/documents/${documentId}/versions`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  restoreDocumentVersion: async (documentId: string, versionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/documents/${documentId}/versions/${versionId}/restore`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Provider Messaging API
  sendMessage: async (messageData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/messages', messageData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getInbox: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/messages/inbox', {
      params: filters,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getSentMessages: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/messages/sent', {
      params: filters,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getMessageById: async (messageId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/messages/${messageId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  replyToMessage: async (messageId: string, replyData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/messages/${messageId}/reply`, replyData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  forwardMessage: async (messageId: string, forwardData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/messages/${messageId}/forward`, forwardData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  markMessageAsRead: async (messageId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/messages/${messageId}/read`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  markMessageAsUnread: async (messageId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/messages/${messageId}/unread`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  archiveMessage: async (messageId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/messages/${messageId}/archive`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteMessage: async (messageId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/messages/${messageId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  searchMessages: async (query: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/messages/search', {
      params: { q: query },
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getMessageThreads: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/messages/threads', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getThreadMessages: async (threadId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/messages/threads/${threadId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createMessageThread: async (threadData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/messages/threads', threadData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  archiveThread: async (threadId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/messages/threads/${threadId}/archive`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  addMessageAttachment: async (messageId: string, file: File, token: string, tenantSlug: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await ehrAxios.post(`/messages/${messageId}/attachments`, formData, {
      headers: { 
        'X-Tenant-ID': tenantSlug, 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return { data: response.data };
  },

  getMessageAttachments: async (messageId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/messages/${messageId}/attachments`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createMessageTask: async (messageId: string, taskData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/messages/${messageId}/tasks`, taskData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getMessageTasks: async (messageId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/messages/${messageId}/tasks`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateMessageTask: async (taskId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/messages/tasks/${taskId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  completeMessageTask: async (taskId: string, completionData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/messages/tasks/${taskId}/complete`, completionData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getMessageTemplates: async (category: string | null, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/messages/templates/list', {
      params: category ? { category } : {},
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getMessageTemplate: async (templateId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/messages/templates/${templateId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createMessageTemplate: async (templateData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/messages/templates', templateData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  applyMessageTemplate: async (templateId: string, variables: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/messages/templates/${templateId}/apply`, variables, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ==================== REFERRAL MANAGEMENT ====================
  
  // Referrals
  createReferral: async (patientId: string, referralData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/referrals', { patientId, referralData }, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getReferrals: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/referrals', {
      params: filters,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getReferralById: async (referralId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/referrals/${referralId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateReferral: async (referralId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/referrals/${referralId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  sendReferral: async (referralId: string, method: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/referrals/${referralId}/send`, { method }, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  completeReferral: async (referralId: string, outcomeData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/referrals/${referralId}/complete`, outcomeData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  cancelReferral: async (referralId: string, reason: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/referrals/${referralId}/cancel`, { reason }, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getReferralStatusHistory: async (referralId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/referrals/${referralId}/status-history`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Referral Templates
  getReferralTemplates: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/referrals/templates/list', {
      params: filters,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  applyReferralTemplate: async (templateId: string, patientId: string, customizations: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/referrals/templates/${templateId}/apply`, 
      { patientId, customizations },
      { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }
    );
    return { data: response.data };
  },

  // Referral Facilities
  getReferralFacilities: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/referrals/facilities/list', {
      params: filters,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  searchReferralFacilities: async (query: string, specialty: string | null, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/referrals/facilities/search', {
      params: { query, specialty },
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

// Doctor Availability API (standalone)
export const doctorAvailabilityApi = {
  create: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/doctor-availability', data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  list: async (params: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/doctor-availability', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
      params
    });
    return { data: response.data };
  },

  get: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/doctor-availability/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  update: async (id: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/doctor-availability/${id}`, data, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },

  delete: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/doctor-availability/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    return { data: response.data };
  },
};

export const medicationHistoryApi = {
  getMedications: async (
    patientId: string,
    token: string,
    tenantSlug: string,
    params: { status?: string; type?: string } = {},
  ) => {
    const response = await ehrAxios.get(`/patients/${patientId}/medications`, {
      params,
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getCurrentMedications: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/medications/current`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createMedication: async (
    patientId: string,
    payload: any,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/patients/${patientId}/medications`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateMedication: async (
    patientId: string,
    medicationId: string,
    payload: any,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.put(
      `/patients/${patientId}/medications/${medicationId}`,
      payload,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  discontinueMedication: async (
    patientId: string,
    medicationId: string,
    reason: string,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.put(
      `/patients/${patientId}/medications/${medicationId}/discontinue`,
      { reason },
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  deleteMedication: async (patientId: string, medicationId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/patients/${patientId}/medications/${medicationId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getMedicationTimeline: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/medications/timeline`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getReconciliationHistory: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/medications/reconciliation/history`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  performReconciliation: async (
    patientId: string,
    payload: any,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/patients/${patientId}/medications/reconciliation`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordAdherence: async (
    patientId: string,
    medicationId: string,
    payload: Record<string, any>,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(
      `/patients/${patientId}/medications/${medicationId}/adherence`,
      payload,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

  getAdherenceRecords: async (
    patientId: string,
    medicationId: string,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get(
      `/patients/${patientId}/medications/${medicationId}/adherence`,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  },

};

export const clinicalTemplateApi = {
  getTemplates: async (
    token: string,
    tenantSlug: string,
    filters?: { category?: string; specialty?: string; isActive?: boolean; isDefault?: boolean },
  ) => {
    const params: Record<string, any> = {};
    if (filters?.category) params.category = filters.category;
    if (filters?.specialty) params.specialty = filters.specialty;
    if (typeof filters?.isActive !== 'undefined') params.isActive = filters.isActive;
    if (typeof filters?.isDefault !== 'undefined') params.isDefault = filters.isDefault;

    const response = await ehrAxios.get('/clinical-templates', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getTemplate: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/clinical-templates/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getDefaultTemplates: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/clinical-templates/defaults', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getTemplatesByCategory: async (category: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/clinical-templates/category/${category}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createTemplate: async (templateData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/clinical-templates', templateData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateTemplate: async (id: string, templateData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/clinical-templates/${id}`, templateData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  deleteTemplate: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/clinical-templates/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  applyTemplate: async (
    templateId: string,
    variables: Record<string, string>,
    token: string,
    tenantSlug: string,
    context?: Record<string, any>,
  ) => {
    const payload: Record<string, any> = { templateId, variables };
    if (context) {
      payload.context = context;
    }

    const response = await ehrAxios.post('/clinical-templates/apply', payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    // The API returns the content directly as a string
    return response.data.content || response.data;
  },
};

export const diabetesApi = {
  getDashboardSummary: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/diabetes/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  listRegistries: async (
    token: string,
    tenantSlug: string,
    params?: { status?: string; diabetesType?: string; limit?: number; offset?: number; search?: string },
  ) => {
    const response = await ehrAxios.get('/diabetes/registry', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getRegistryByPatient: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getLatestCareBundle: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/care-bundle/latest`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getCareBundleCompletion: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/care-bundle/completion`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getCareBundleHistory: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/care-bundle`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordCareBundle: async (registryId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/care-bundle`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getGlucoseTrends: async (registryId: string, token: string, tenantSlug: string, params?: any) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/glucose/trends`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getGlucoseHistory: async (
    registryId: string,
    token: string,
    tenantSlug: string,
    params?: { limit?: number; offset?: number },
  ) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/glucose`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  recordGlucose: async (registryId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/glucose`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getCgmSummary: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/cgm-summary`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  syncCgmData: async (registryId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/glucose/sync-cgm`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  listMedications: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/medications`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  createMedication: async (registryId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/medications`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateMedication: async (medicationId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.patch(`/diabetes/medications/${medicationId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  trackMedicationAdherence: async (medicationId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/medications/${medicationId}/adherence`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getActiveInsulinRegimen: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/insulin-regimens/active`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addInsulinRegimen: async (registryId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/insulin-regimens`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateInsulinRegimen: async (regimenId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.patch(`/diabetes/insulin-regimens/${regimenId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  calculateInsulinDose: async (regimenId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/insulin-regimens/${regimenId}/calculate-dose`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getScreeningHistory: async (registryId: string, token: string, tenantSlug: string, params?: any) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/screenings`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getUpcomingScreenings: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/screenings/upcoming`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getScreeningDueStatus: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/screenings/due`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordScreening: async (registryId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/screenings`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getEducationHistory: async (registryId: string, token: string, tenantSlug: string, params?: any) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/education`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getEducationDueStatus: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/education/due`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  recordEducationSession: async (registryId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/education`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getAlerts: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/alerts`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  acknowledgeAlert: async (alertId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/alerts/${alertId}/acknowledge`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  resolveAlert: async (alertId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/alerts/${alertId}/resolve`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  generateAlerts: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/alerts/generate`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  listDevices: async (registryId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/diabetes/registry/${registryId}/devices`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  updateDevice: async (deviceId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.patch(`/diabetes/devices/${deviceId}`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  registerDevice: async (registryId: string, token: string, tenantSlug: string, payload: any) => {
    const response = await ehrAxios.post(`/diabetes/registry/${registryId}/devices`, payload, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
};

export const prescriptionTemplateApi = {
  getTemplates: async (
    token: string,
    tenantSlug: string,
    filters?: {
      category?: string;
      specialty?: string;
      isActive?: boolean;
      isDefault?: boolean;
      search?: string;
    }
  ) => {
    const params: Record<string, any> = {};
    if (filters?.category) params.category = filters.category;
    if (filters?.specialty) params.specialty = filters.specialty;
    if (typeof filters?.isActive !== 'undefined') params.isActive = filters.isActive;
    if (typeof filters?.isDefault !== 'undefined') params.isDefault = filters.isDefault;
    if (filters?.search) params.search = filters.search;

    const response = await ehrAxios.get('/prescription-templates', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getTemplate: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/prescription-templates/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getDefaultTemplates: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/prescription-templates/defaults', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getTemplatesByCategory: async (
    category: string,
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.get(
      `/prescription-templates/category/${category}`,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return { data: response.data };
  },

  createTemplate: async (
    templateData: any,
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.post(
      '/prescription-templates',
      templateData,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return { data: response.data };
  },

  updateTemplate: async (
    id: string,
    templateData: any,
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.put(
      `/prescription-templates/${id}`,
      templateData,
      {
        headers: {
          'X-Tenant-ID': tenantSlug,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return { data: response.data };
  },

  deleteTemplate: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/prescription-templates/${id}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  // CCDA Document Generation
  generateCCD: async (patientId: string, token: string, tenantSlug: string, options?: { effectiveTime?: string; authorId?: string }) => {
    const params: Record<string, any> = {};
    if (options?.effectiveTime) params.effectiveTime = options.effectiveTime;
    if (options?.authorId) params.authorId = options.authorId;

    const response = await ehrAxios.get(`/ccda/ccd/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
      responseType: 'text',
    });
    return { data: response.data };
  },

  generateDischargeSummary: async (
    patientId: string,
    encounterId: string,
    token: string,
    tenantSlug: string,
    options?: { effectiveTime?: string; authorId?: string }
  ) => {
    const params: Record<string, any> = { encounterId };
    if (options?.effectiveTime) params.effectiveTime = options.effectiveTime;
    if (options?.authorId) params.authorId = options.authorId;

    const response = await ehrAxios.get(`/ccda/discharge-summary/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
      responseType: 'text',
    });
    return { data: response.data };
  },

  generateReferralSummary: async (
    patientId: string,
    token: string,
    tenantSlug: string,
    options?: { effectiveTime?: string; authorId?: string }
  ) => {
    const params: Record<string, any> = {};
    if (options?.effectiveTime) params.effectiveTime = options.effectiveTime;
    if (options?.authorId) params.authorId = options.authorId;

    const response = await ehrAxios.get(`/ccda/referral-summary/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
      responseType: 'text',
    });
    return { data: response.data };
  },

  generateProgressNote: async (
    patientId: string,
    encounterId: string,
    token: string,
    tenantSlug: string,
    options?: { effectiveTime?: string; authorId?: string }
  ) => {
    const params: Record<string, any> = { encounterId };
    if (options?.effectiveTime) params.effectiveTime = options.effectiveTime;
    if (options?.authorId) params.authorId = options.authorId;

    const response = await ehrAxios.get(`/ccda/progress-note/${patientId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
      responseType: 'text',
    });
    return { data: response.data };
  },

  // HIPAA Audit Logs
  getAuditLogs: async (
    token: string,
    tenantSlug: string,
    filters?: {
      userId?: string;
      patientId?: string;
      action?: string;
      resourceType?: string;
      outcome?: 'success' | 'failure' | 'denied';
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    const params: Record<string, any> = {};
    if (filters?.userId) params.userId = filters.userId;
    if (filters?.patientId) params.patientId = filters.patientId;
    if (filters?.action) params.action = filters.action;
    if (filters?.resourceType) params.resourceType = filters.resourceType;
    if (filters?.outcome) params.outcome = filters.outcome;
    if (filters?.riskLevel) params.riskLevel = filters.riskLevel;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;

    const response = await ehrAxios.get('/hipaa-audit/logs', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getAuditSummary: async (
    token: string,
    tenantSlug: string,
    startDate: string,
    endDate: string
  ) => {
    const response = await ehrAxios.get('/hipaa-audit/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params: { startDate, endDate },
    });
    return { data: response.data };
  },



  getPatientAccessReport: async (
    patientId: string,
    token: string,
    tenantSlug: string,
    startDate?: string,
    endDate?: string
  ) => {
    const params: Record<string, any> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await ehrAxios.get(`/hipaa-audit/patient/${patientId}/access-report`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  // Quality Measures
  getQualityMeasures: async (
    token: string,
    tenantSlug: string,
    filters?: { type?: string; category?: string }
  ) => {
    const params: Record<string, any> = {};
    if (filters?.type) params.type = filters.type;
    if (filters?.category) params.category = filters.category;

    const response = await ehrAxios.get('/quality-measures/measures', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getQualityMeasure: async (measureId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/quality-measures/measures/${measureId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  calculateQualityMeasure: async (
    measureId: string,
    startDate: string,
    endDate: string,
    token: string,
    tenantSlug: string,
    save?: boolean
  ) => {
    const params: Record<string, any> = { startDate, endDate };
    if (save) params.save = 'true';

    const response = await ehrAxios.post(`/quality-measures/calculate/${measureId}`, null, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  calculateQualityMeasures: async (
    measureIds: string[],
    startDate: string,
    endDate: string,
    token: string,
    tenantSlug: string,
    save?: boolean
  ) => {
    const params: Record<string, any> = { startDate, endDate };
    if (save) params.save = 'true';

    const response = await ehrAxios.post('/quality-measures/calculate', { measureIds }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getQualityMeasureResults: async (
    token: string,
    tenantSlug: string,
    filters?: {
      measureId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    const params: Record<string, any> = {};
    if (filters?.measureId) params.measureId = filters.measureId;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;

    const response = await ehrAxios.get('/quality-measures/results', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return { data: response.data };
  },

  getQualityDashboard: async (
    startDate: string,
    endDate: string,
    token: string,
    tenantSlug: string
  ) => {
    const response = await ehrAxios.get('/quality-measures/dashboard', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params: { startDate, endDate },
    });
    return { data: response.data };
  },
};

export const populationHealthApi = {
  getRegistryDashboard: async (
    token: string,
    tenantSlug: string,
    params?: { conditionType?: string; riskLevel?: string; status?: string },
  ) => {
    const response = await ehrAxios.get('/population-health/registry', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params,
    });
    return { data: response.data };
  },
  getRegistryByPatient: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/population-health/registry/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  enrollInRegistry: async (
    body: {
      patientId: string;
      conditionCode: string;
      conditionName: string;
      conditionType: string;
      onsetDate?: string;
      status?: string;
      riskLevel?: string;
      nextReviewDate?: string;
      managementPlan?: string;
      notes?: string;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/population-health/registry', body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getPreventiveCareReminders: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/population-health/preventive-care/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  generatePreventiveCare: async (token: string, tenantSlug: string, body?: { patientId?: string }) => {
    const response = await ehrAxios.post('/population-health/preventive-care/generate', body ?? {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getDoctorWorklist: async (
    token: string,
    tenantSlug: string,
    params?: {
      includeResolved?: boolean;
      limit?: number;
      focus?: 'all' | 'high-risk' | 'uncontrolled' | 'overdue-review' | 'care-gaps';
      conditionType?: string;
      riskLevel?: string;
    },
  ) => {
    const response = await ehrAxios.get('/population-health/worklist', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params,
    });
    return { data: response.data };
  },
  getOperationalBrief: async (
    token: string,
    tenantSlug: string,
    params?: {
      includeResolved?: boolean;
      limit?: number;
      focus?: 'all' | 'high-risk' | 'uncontrolled' | 'overdue-review' | 'care-gaps';
      conditionType?: string;
      riskLevel?: string;
    },
  ) => {
    const response = await ehrAxios.get('/population-health/operational-brief', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params,
    });
    return { data: response.data };
  },
  updatePreventiveReminderStatus: async (
    reminderId: string,
    body: { status: 'due' | 'overdue' | 'completed' | 'deferred' | 'not_applicable'; notes?: string; completionDate?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.put(`/population-health/preventive-care/${reminderId}/status`, body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  reviewRegistryEntry: async (
    registryId: string,
    body: {
      status?: string;
      riskLevel?: string;
      nextReviewDate?: string;
      reviewIntervalDays?: number;
      managementPlan?: string;
      reviewNote?: string;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.put(`/population-health/registry/${registryId}/review`, body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getRecallLists: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/population-health/recall-lists', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  createRecallList: async (
    body: { name: string; criteria: Record<string, any> },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/population-health/recall-lists', body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  generateRecallList: async (listId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(
      `/population-health/recall-lists/${listId}/generate`,
      {},
      { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
    );
    return { data: response.data };
  },
  notifyRecallList: async (
    listId: string,
    token: string,
    tenantSlug: string,
    body?: { channel?: 'sms' | 'email' },
  ) => {
    const response = await ehrAxios.post(
      `/population-health/recall-lists/${listId}/notify`,
      body ?? {},
      { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
    );
    return { data: response.data };
  },
};

export const campaignApi = {
  listCampaigns: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/campaigns', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  createCampaign: async (
    body: {
      name: string;
      channel?: 'sms' | 'email';
      messageTemplate: string;
      targetType?: 'manual' | 'recall_list' | 'query';
      targetRefId?: string;
      criteria?: Record<string, any>;
      scheduledAt?: string;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/campaigns', body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateCampaign: async (id: string, body: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/campaigns/${id}`, body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  cancelCampaign: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/campaigns/${id}/cancel`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  listRecipients: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/campaigns/${id}/recipients`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  prepareRecipients: async (id: string, body: { patientIds?: string[] }, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/campaigns/${id}/recipients/prepare`, body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  sendNow: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/campaigns/${id}/send`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const pharmacyApi = {
  // Suppliers
  listSuppliers: async (token: string, tenantSlug: string, filters?: { search?: string; status?: string; limit?: number; offset?: number }) => {
    const response = await ehrAxios.get('/pharmacy/suppliers', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  createSupplier: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/suppliers', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getSupplier: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/suppliers/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateSupplier: async (id: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pharmacy/suppliers/${id}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  deleteSupplier: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/pharmacy/suppliers/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getSupplierStatistics: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/suppliers/${id}/statistics`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Inventory
  listInventory: async (token: string, tenantSlug: string, filters?: { search?: string; status?: string; lowStock?: boolean; limit?: number; offset?: number }) => {
    const response = await ehrAxios.get('/pharmacy/inventory', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  createInventory: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/inventory', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getInventory: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/inventory/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateInventory: async (id: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pharmacy/inventory/${id}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getLowStockItems: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/pharmacy/inventory/low-stock/items', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Purchase Orders
  listPurchaseOrders: async (token: string, tenantSlug: string, filters?: { status?: string; supplierId?: string; limit?: number; offset?: number }) => {
    const response = await ehrAxios.get('/pharmacy/purchase-orders', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  createPurchaseOrder: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/purchase-orders', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getPurchaseOrder: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/purchase-orders/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updatePurchaseOrder: async (id: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pharmacy/purchase-orders/${id}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Receipts
  createReceipt: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/receipts', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getReceipt: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/receipts/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  listReceipts: async (token: string, tenantSlug: string, filters?: { purchaseOrderId?: string; status?: string; limit?: number; offset?: number }) => {
    const response = await ehrAxios.get('/pharmacy/receipts', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  // Dispensings
  createDispensing: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/dispensings', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getDispensing: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/dispensings/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateDispensing: async (id: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pharmacy/dispensings/${id}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Returns
  createReturn: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/returns', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getReturn: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/returns/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Stock Adjustments
  createStockAdjustment: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/stock-adjustments', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getStockAdjustment: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/stock-adjustments/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Pricing Rules
  listPricingRules: async (token: string, tenantSlug: string, filters?: { active?: boolean; limit?: number; offset?: number }) => {
    const response = await ehrAxios.get('/pharmacy/pricing-rules', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  createPricingRule: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/pricing-rules', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updatePricingRule: async (id: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pharmacy/pricing-rules/${id}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Formulary
  listFormulary: async (token: string, tenantSlug: string, filters?: { search?: string; category?: string; limit?: number; offset?: number }) => {
    const response = await ehrAxios.get('/pharmacy/formulary', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  createFormulary: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/formulary', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateFormulary: async (id: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pharmacy/formulary/${id}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Alerts
  listAlerts: async (token: string, tenantSlug: string, filters?: { type?: string; severity?: string; resolved?: boolean; limit?: number; offset?: number }) => {
    const response = await ehrAxios.get('/pharmacy/alerts', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  createAlert: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/alerts', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateAlert: async (id: string, data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/pharmacy/alerts/${id}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Prescription Integration
  getPendingPrescriptions: async (token: string, tenantSlug: string, filters?: { patientId?: string; limit?: number; offset?: number }) => {
    const response = await ehrAxios.get('/pharmacy/prescriptions/pending', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  checkPrescriptionStock: async (prescriptionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/prescriptions/${prescriptionId}/stock-check`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  dispensePrescription: async (prescriptionId: string, data: {
    items: Array<{ inventoryId: string; quantityDispensed: number }>;
    paymentMethod?: string;
    notes?: string;
    medicationReviewId?: string;
    selectedSubstitutionRecommendationIds?: string[];
    stewardshipReviewIds?: string[];
    aiReviewAcknowledged?: boolean;
    aiReviewSummary?: Record<string, any>;
  }, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/pharmacy/prescriptions/${prescriptionId}/dispense`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Intelligence
  generateMedicationReview: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/intelligence/reconciliation-review', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getMedicationReview: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pharmacy/intelligence/reconciliation-review/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  prepareDispensePlan: async (data: { prescriptionId: string }, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/intelligence/dispense-plan', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  generateInventoryForecasts: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/intelligence/inventory-forecast', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  listInventoryForecasts: async (token: string, tenantSlug: string, filters?: { shortageRisk?: string; limit?: number }) => {
    const response = await ehrAxios.get('/pharmacy/intelligence/inventory-forecast', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  detectDispensingAnomalies: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/intelligence/dispensing-anomalies', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  listDispensingAnomalies: async (token: string, tenantSlug: string, filters?: { status?: string; severity?: string; limit?: number }) => {
    const response = await ehrAxios.get('/pharmacy/intelligence/dispensing-anomalies', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
  generateHighRiskMedicationReview: async (data: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pharmacy/intelligence/high-risk-review', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },
  listStewardshipReviews: async (token: string, tenantSlug: string, filters?: { patientId?: string; reviewRequired?: boolean; limit?: number }) => {
    const response = await ehrAxios.get('/pharmacy/intelligence/stewardship', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },
};

// Medical Aid Claims API
export const claimsApi = {
  createClaim: async (tenantSlug: string, token: string, claimData: any) => {
    const response = await ehrAxios.post('/claims', claimData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getClaims: async (
    tenantSlug: string,
    token: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      provider?: string;
      patientId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    } = {},
  ) => {
    const response = await ehrAxios.get('/claims', {
      params,
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getClaimById: async (tenantSlug: string, token: string, claimId: string) => {
    const response = await ehrAxios.get(`/claims/${claimId}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getClaimReadiness: async (tenantSlug: string, token: string, claimId: string) => {
    const response = await ehrAxios.get(`/claims/${claimId}/readiness`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getClaimFinancialClearance: async (tenantSlug: string, token: string, claimId: string) => {
    const response = await ehrAxios.get(`/claims/${claimId}/financial-clearance`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  generatePriorAuthorizationDraft: async (tenantSlug: string, token: string, claimId: string) => {
    const response = await ehrAxios.post(`/claims/${claimId}/prior-authorization-draft`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getClaimReadinessWorklist: async (
    tenantSlug: string,
    token: string,
    params?: { statuses?: string; limit?: number },
  ) => {
    const response = await ehrAxios.get('/claims/readiness/worklist', {
      params,
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  submitClaim: async (tenantSlug: string, token: string, claimId: string) => {
    const response = await ehrAxios.put(`/claims/${claimId}/submit`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  checkClaimStatus: async (tenantSlug: string, token: string, claimId: string) => {
    const response = await ehrAxios.get(`/claims/${claimId}/status`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  generateClaimFromBill: async (tenantSlug: string, token: string, billId: string, claimData: any) => {
    const response = await ehrAxios.post(`/claims/from-bill/${billId}`, claimData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  generateClaimFromAppointment: async (tenantSlug: string, token: string, appointmentId: string, claimData: any) => {
    const response = await ehrAxios.post(`/claims/from-appointment/${appointmentId}`, claimData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  generateClaimFromProcedure: async (
    tenantSlug: string,
    token: string,
    procedureId: string,
    procedureType: 'lab' | 'imaging' | 'other',
    claimData: any,
  ) => {
    const response = await ehrAxios.post(`/claims/from-procedure/${procedureId}?type=${procedureType}`, claimData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  resubmitClaim: async (tenantSlug: string, token: string, claimId: string, updatedData: any) => {
    const response = await ehrAxios.put(`/claims/${claimId}/resubmit`, updatedData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getDashboardSummary: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/claims/dashboard/summary', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getClaimAnalytics: async (
    tenantSlug: string,
    token: string,
    params?: { dateFrom?: string; dateTo?: string; provider?: string },
  ) => {
    const response = await ehrAxios.get('/claims/analytics', {
      params,
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  // Sprint 14.2 Enhanced Methods
  submitClaimEnhanced: async (tenantSlug: string, token: string, claimId: string, method: 'api' | 'edi' | 'manual' = 'api') => {
    const response = await ehrAxios.put(`/claims/${claimId}/submit-enhanced?method=${method}`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  checkClaimStatusEnhanced: async (tenantSlug: string, token: string, claimId: string) => {
    const response = await ehrAxios.get(`/claims/${claimId}/status-enhanced`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  getClaimStatusHistory: async (tenantSlug: string, token: string, claimId: string) => {
    const response = await ehrAxios.get(`/claims/${claimId}/status-history`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  processClaimResponse: async (tenantSlug: string, token: string, claimId: string, responseData: any) => {
    const response = await ehrAxios.post(`/claims/${claimId}/response-enhanced`, responseData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  bulkSubmitClaims: async (tenantSlug: string, token: string, claimIds: string[], method: 'api' | 'edi' = 'api') => {
    const response = await ehrAxios.post('/claims/bulk/submit', { claimIds, method }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  bulkCheckClaimStatuses: async (tenantSlug: string, token: string, claimIds: string[]) => {
    const response = await ehrAxios.post('/claims/bulk/check-status', { claimIds }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  // Pre-Authorization Methods
  createPreAuthorization: async (tenantSlug: string, token: string, preAuthData: any) => {
    const response = await ehrAxios.post('/claims/pre-authorizations', preAuthData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  getPreAuthorizations: async (tenantSlug: string, token: string, filters?: { patientId?: string; status?: string; medicalAidName?: string }) => {
    const response = await ehrAxios.get('/claims/pre-authorizations', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
      params: filters,
    });
    return { data: response.data };
  },
  submitPreAuthorization: async (tenantSlug: string, token: string, preAuthId: string) => {
    const response = await ehrAxios.post(`/claims/pre-authorizations/${preAuthId}/submit`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  linkClaimToPreAuth: async (tenantSlug: string, token: string, claimId: string, preAuthId: string) => {
    const response = await ehrAxios.post(`/claims/${claimId}/link-preauth/${preAuthId}`, {}, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  // Medical Aid API Configuration Methods
  getApiConfigurations: async (tenantSlug: string, token: string) => {
    const response = await ehrAxios.get('/medical-aid-api/configurations', {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  getApiConfiguration: async (tenantSlug: string, token: string, medicalAidName: string) => {
    const response = await ehrAxios.get(`/medical-aid-api/configurations/${encodeURIComponent(medicalAidName)}`, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  saveApiConfiguration: async (tenantSlug: string, token: string, config: any) => {
    const response = await ehrAxios.post('/medical-aid-api/configurations', config, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  verifyMember: async (tenantSlug: string, token: string, medicalAidName: string, memberNumber: string) => {
    const response = await ehrAxios.post('/medical-aid-api/verify-member', { medicalAidName, memberNumber }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
};

// Billing API (Bills table)
export const billingApi = {
  createBill: async (tenantSlug: string, token: string, billData: any) => {
    const response = await ehrAxios.post('/billing/bills', billData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getBills: async (
    tenantSlug: string,
    token: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      patientId?: string;
    } = {},
  ) => {
    const response = await ehrAxios.get('/billing/bills', {
      params,
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  addPayment: async (tenantSlug: string, token: string, billId: string, paymentData: any) => {
    const response = await ehrAxios.post(`/billing/bills/${billId}/payments`, paymentData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        Authorization: `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
};

export const analyticsApi = {
  // Report Templates
  createTemplate: async (tenantSlug: string, token: string, createDto: any) => {
    const response = await ehrAxios.post('/analytics/templates', createDto, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getTemplates: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/templates', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getTemplate: async (tenantSlug: string, token: string, id: string) => {
    const response = await ehrAxios.get(`/analytics/templates/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateTemplate: async (tenantSlug: string, token: string, id: string, updateDto: any) => {
    const response = await ehrAxios.put(`/analytics/templates/${id}`, updateDto, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  deleteTemplate: async (tenantSlug: string, token: string, id: string) => {
    const response = await ehrAxios.delete(`/analytics/templates/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  executeTemplate: async (tenantSlug: string, token: string, id: string, executeDto: any) => {
    const format = executeDto.format || 'json';
    
    // For file downloads, use blob response
    if (format !== 'json') {
      const response = await ehrAxios.post(`/analytics/templates/${id}/execute`, executeDto, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      return { data: { fileBuffer: response.data, format } };
    }
    
    // For JSON, return normal response
    const response = await ehrAxios.post(`/analytics/templates/${id}/execute`, executeDto, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  cloneTemplate: async (tenantSlug: string, token: string, id: string, newName: string) => {
    const response = await ehrAxios.post(`/analytics/templates/${id}/clone`, {}, {
      params: { newName },
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getTemplateExecutions: async (tenantSlug: string, token: string, id: string, query: any) => {
    const response = await ehrAxios.get(`/analytics/templates/${id}/executions`, {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Scheduled Reports
  createSchedule: async (tenantSlug: string, token: string, createDto: any) => {
    const response = await ehrAxios.post('/analytics/schedules', createDto, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getSchedules: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/schedules', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getSchedule: async (tenantSlug: string, token: string, id: string) => {
    const response = await ehrAxios.get(`/analytics/schedules/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateSchedule: async (tenantSlug: string, token: string, id: string, updateDto: any) => {
    const response = await ehrAxios.put(`/analytics/schedules/${id}`, updateDto, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  deleteSchedule: async (tenantSlug: string, token: string, id: string) => {
    const response = await ehrAxios.delete(`/analytics/schedules/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  executeSchedule: async (tenantSlug: string, token: string, id: string) => {
    const response = await ehrAxios.post(`/analytics/schedules/${id}/execute`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  pauseSchedule: async (tenantSlug: string, token: string, id: string) => {
    const response = await ehrAxios.post(`/analytics/schedules/${id}/pause`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  resumeSchedule: async (tenantSlug: string, token: string, id: string) => {
    const response = await ehrAxios.post(`/analytics/schedules/${id}/resume`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getScheduleHistory: async (tenantSlug: string, token: string, id: string, query: any) => {
    const response = await ehrAxios.get(`/analytics/schedules/${id}/history`, {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Clinical Outcomes
  recordOutcome: async (tenantSlug: string, token: string, createDto: any) => {
    const response = await ehrAxios.post('/analytics/outcomes', createDto, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getOutcomes: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/outcomes', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getPatientOutcomes: async (tenantSlug: string, token: string, patientId: string) => {
    const response = await ehrAxios.get(`/analytics/outcomes/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getOutcomeTrends: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/outcomes/trends', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getOutcomeMetrics: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/outcomes/metrics', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getOutcomeComparisons: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/outcomes/comparisons', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  updateOutcome: async (tenantSlug: string, token: string, id: string, updateDto: any) => {
    const response = await ehrAxios.put(`/analytics/outcomes/${id}`, updateDto, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  deleteOutcome: async (tenantSlug: string, token: string, id: string) => {
    const response = await ehrAxios.delete(`/analytics/outcomes/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Consent Templates

  // Analytics Metrics
  createMetric: async (tenantSlug: string, token: string, createDto: any) => {
    const response = await ehrAxios.post('/analytics/metrics', createDto, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getMetrics: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/metrics', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  calculateMetrics: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/metrics/calculate', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getMetricTrends: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/metrics/trends', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  compareMetrics: async (tenantSlug: string, token: string, query: any) => {
    const response = await ehrAxios.get('/analytics/metrics/compare', {
      params: query,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
  getBenchmarks: async (tenantSlug: string, token: string, metricName: string) => {
    const response = await ehrAxios.get('/analytics/metrics/benchmarks', {
      params: { metricName },
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const knowledgeBaseApi = {
  uploadDocument: (formData: FormData, token: string, tenantSlug: string) =>
    ehrAxios.post('/knowledge/documents', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
        'Content-Type': 'multipart/form-data',
      },
    }).then(r => r.data),

  listDocuments: (token: string, tenantSlug: string) =>
    ehrAxios.get('/knowledge/documents', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantSlug },
    }).then(r => r.data),

  deleteDocument: (id: string, token: string, tenantSlug: string) =>
    ehrAxios.delete(`/knowledge/documents/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantSlug },
    }).then(r => r.data),
};

export const patientPortalApi = {
  // ==================== PATIENT PORTAL ====================
  
  // Patient Care Plans
  getPatientCarePlans: async (token: string, tenantSlug: string, filters?: { status?: string }) => {
    const response = await ehrAxios.get('/patient-portal/care-plans', {
      params: filters,
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientCarePlan: async (carePlanId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patient-portal/care-plans/${carePlanId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  reportCarePlanProgress: async (carePlanId: string, progressData: { notes: string; metrics?: any }, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/patient-portal/care-plans/${carePlanId}/progress`, progressData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  reportGoalProgress: async (carePlanId: string, goalId: string, progressData: { currentValue: number; notes?: string; metrics?: any }, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/patient-portal/care-plans/${carePlanId}/goals/${goalId}/progress`, progressData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Patient Portal Login
  patientLogin: async (email: string, password: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/patient-portal/login', { email, password }, {
      headers: { 'X-Tenant-ID': tenantSlug },
    });
    return { data: response.data };
  },

  // H3: Bills / payments / education / family access
  getBills: async (token: string, tenantSlug: string, params?: { startDate?: string; endDate?: string; status?: string }) => {
    const response = await ehrAxios.get('/patient-portal/bills', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: params || {},
    });
    return { data: response.data };
  },

  createPortalPayment: async (
    body: { billId?: string; amount: number; paymentMethod: 'ecocash' | 'onemoney' | 'card' | 'bank_transfer'; paymentReference?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/patient-portal/payments', body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  listEducation: async (token: string, tenantSlug: string, params?: { category?: string; language?: string }) => {
    const response = await ehrAxios.get('/patient-portal/education', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: params || {},
    });
    return { data: response.data };
  },

  getEducation: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patient-portal/education/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  listFamilyAccess: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/patient-portal/family-access', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createFamilyAccess: async (
    body: { proxyName: string; proxyEmail: string; proxyPhone?: string; relationship?: string; accessLevel?: 'view_only' | 'full' | 'emergency_only'; expiresAt?: string },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post('/patient-portal/family-access', body, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  revokeFamilyAccess: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/patient-portal/family-access/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPostVisitSessions: async (
    token: string,
    tenantSlug: string,
    filters?: { limit?: number; offset?: number },
  ) => {
    const response = await ehrAxios.get('/patient-portal/post-visit/sessions', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters || {},
    });
    return { data: response.data };
  },

  getPostVisitSummary: async (sessionId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patient-portal/post-visit/sessions/${sessionId}/summary`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPostVisitLabTrends: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
  ): Promise<{ sessionId: string; trends: Array<{ key: string; name: string; unit: string; points: Array<{ value: number; unit: string; createdAt: string }>; latest: number | null; previous: number | null; min: number; max: number }> }> => {
    const response = await ehrAxios.get(`/patient-portal/post-visit/sessions/${sessionId}/lab-trends`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  getPostVisitRecordingUrl: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
  ): Promise<{ url: string; mimeType: string; durationMs: number | null } | { url: null }> => {
    const response = await ehrAxios.get(`/patient-portal/post-visit/sessions/${sessionId}/recording-url`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  getPostVisitAnnotatedSummary: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
  ): Promise<{ sessionId: string; entities: unknown[]; artifacts: Array<{ artifactType: string; content: Record<string, { raw: string; spans: unknown[] } | unknown> }> }> => {
    const response = await ehrAxios.get(`/patient-portal/post-visit/sessions/${sessionId}/summary/annotated`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  askPostVisitSection: async (
    sessionId: string,
    question: string,
    sectionType: string,
    token: string,
    tenantSlug: string,
  ): Promise<{ answer: string; abstained?: boolean }> => {
    const response = await ehrAxios.post(
      `/patient-portal/post-visit/sessions/${sessionId}/ask-section`,
      { question, sectionType },
      { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );
    return response.data;
  },

  getPostVisitMessages: async (
    sessionId: string,
    token: string,
    tenantSlug: string,
    filters?: { limit?: number; offset?: number },
  ) => {
    const response = await ehrAxios.get(`/patient-portal/post-visit/sessions/${sessionId}/messages`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters || {},
    });
    return { data: response.data };
  },

  sendPostVisitMessage: async (
    sessionId: string,
    payload: { message: string; language?: string; messageType?: 'question' | 'answer' | 'summary' | 'checklist' | 'alert' | 'system' },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/patient-portal/post-visit/sessions/${sessionId}/messages`, payload, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  acknowledgePostVisit: async (
    sessionId: string,
    payload: {
      acknowledgementType: 'teach_back' | 'medication_adherence' | 'follow_up_commitment' | 'warning_sign_understanding';
      acknowledged?: boolean;
      details?: Record<string, any>;
    },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(`/patient-portal/post-visit/sessions/${sessionId}/acknowledgements`, payload, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const documentManagementApi = {
  // ==================== DOCUMENT MANAGEMENT ====================
  
  uploadDocument: async (formData: FormData, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/documents/upload', formData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    });
    return { data: response.data };
  },

  getDocuments: async (patientId: string, filters: any, token: string, tenantSlug: string) => {
    console.log('🔍 getDocuments called - NEW VERSION LOADED!', { patientId, filters });
    const response = await ehrAxios.get('/documents', {
      params: { patientId, ...filters },
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getDocumentById: async (documentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/documents/${documentId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  deleteDocument: async (documentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/documents/${documentId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  shareDocument: async (documentId: string, shareData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/documents/${documentId}/share`, shareData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getSharedDocuments: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/documents/shared/with-me', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateDocumentSharing: async (sharingId: string, updates: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.put(`/documents/sharing/${sharingId}`, updates, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  revokeDocumentSharing: async (sharingId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/documents/sharing/${sharingId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getDocumentAccessLog: async (documentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/documents/${documentId}/access-log`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  addDocumentTag: async (documentId: string, tagName: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/documents/${documentId}/tags`, { tagName }, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  removeDocumentTag: async (documentId: string, tagName: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.delete(`/documents/${documentId}/tags/${tagName}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const consentApi = {
  // ==================== CONSENT MANAGEMENT ====================
  
  // Consent Templates
  getConsentTemplates: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/consents/templates', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  getConsentTemplate: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/consents/templates/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createConsentTemplate: async (templateData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/consents/templates', templateData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Patient Consents
  createPatientConsent: async (consentData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/consents', consentData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientConsents: async (patientId: string, filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/consents/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  getConsentById: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/consents/${id}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  signConsent: async (id: string, signatureData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/consents/${id}/sign`, signatureData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  declineConsent: async (id: string, reason: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/consents/${id}/decline`, { reason }, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  revokeConsent: async (id: string, reason: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/consents/${id}/revoke`, { reason }, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  exportConsent: async (id: string, format: 'pdf' | 'json', token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/consents/${id}/export`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: { format },
    });
    return { data: response.data };
  },

  getConsentHistory: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/consents/patient/${patientId}/history`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getActiveConsents: async (patientId: string, consentType: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/consents/patient/${patientId}/active/${consentType}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const emergencyApi = {
  // ==================== EMERGENCY DEPARTMENT ====================
  
  getEDTrackingBoard: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/ed/tracking-board', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getEDMetrics: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/ed/metrics', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createEDVisit: async (visitData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/ed/visits', visitData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  triageEDVisit: async (visitId: string, triageData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/ed/visits/${visitId}/triage`, triageData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateEDVisitStatus: async (visitId: string, statusData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/ed/visits/${visitId}/status`, statusData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const bedManagementApi = {
  // ==================== BED MANAGEMENT & ADT ====================
  
  getBeds: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/beds', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  getAvailableBeds: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/beds/available', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  getBedOccupancy: async (wardName: string | null, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/beds/occupancy', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: wardName ? { wardName } : {},
    });
    return { data: response.data };
  },

  getWardsList: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/beds/wards', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  assignBed: async (bedId: string, assignmentData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/beds/${bedId}/assign`, assignmentData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  releaseBed: async (bedId: string, releaseData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/beds/${bedId}/release`, releaseData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  markBedCleaned: async (bedId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/beds/${bedId}/cleaned`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  admitPatient: async (admissionData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/beds/admissions', admissionData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  dischargePatient: async (admissionId: string, dischargeData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/beds/admissions/${admissionId}/discharge`, dischargeData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  transferPatient: async (admissionId: string, transferData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/beds/admissions/${admissionId}/transfer`, transferData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getActiveAdmissions: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/beds/admissions', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  getPatientAdmissions: async (patientId: string, token: string, tenantSlug: string, includeDischarged: boolean = false) => {
    const response = await ehrAxios.get(`/beds/admissions/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: { includeDischarged: includeDischarged.toString() },
    });
    return { data: response.data };
  },

  getCensusSnapshot: async (wardName: string | null, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/beds/census', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: wardName ? { wardName } : {},
    });
    return { data: response.data };
  },
};

export const immunizationApi = {
  // ==================== IMMUNIZATION REGISTRY ====================
  
  getImmunizationSchedules: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/immunizations/schedules', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  getPatientImmunizations: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/immunizations/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  recordImmunization: async (immunizationData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/immunizations', immunizationData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getVaccineInventory: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/immunizations/inventory', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const travelVaccineApi = {
  listDestinations: async (search: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/travel-vaccines/destinations', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: search ? { search } : {},
    });
    return { data: response.data };
  },

  getDestination: async (isoCode: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/travel-vaccines/destinations/${isoCode}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  assessTravelReadiness: async (
    patientId: string,
    destinations: string[],
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(
      '/travel-vaccines/assess',
      { patientId, destinations },
      { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
    );
    return { data: response.data };
  },

  generateYellowCard: async (
    patientId: string,
    payload: { issuingCenter?: string; immunizationIds?: string[] } | undefined,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.post(
      '/travel-vaccines/yellow-card',
      { patientId, ...(payload ?? {}) },
      { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
    );
    return { data: response.data };
  },
};

export const currencyApi = {
  listCurrencies: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/currency/currencies', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  upsertCurrency: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/currency/currencies', payload, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  listExchangeRates: async (
    filters: { baseCurrency?: string; quoteCurrency?: string; limit?: number },
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.get('/currency/exchange-rates', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  createExchangeRate: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/currency/exchange-rates', payload, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const medicalAidApi = {
  listProviders: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/medical-aid/providers', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  upsertProvider: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/medical-aid/providers', payload, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  listEligibility: async (patientId: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/medical-aid/eligibility', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: patientId ? { patientId } : {},
    });
    return { data: response.data };
  },

  createEligibility: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/medical-aid/eligibility', payload, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  listClaims: async (providerId: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/medical-aid/claims', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: providerId ? { providerId } : {},
    });
    return { data: response.data };
  },

  createClaim: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/medical-aid/claims', payload, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  submitClaim: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/medical-aid/claims/${id}/submit`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  listRemittances: async (providerId: string | undefined, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/medical-aid/remittances', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: providerId ? { providerId } : {},
    });
    return { data: response.data };
  },

  createRemittance: async (payload: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/medical-aid/remittances', payload, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  processRemittance: async (id: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/medical-aid/remittances/${id}/process`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const clinicalPathwaysApi = {
  // ==================== CLINICAL PATHWAYS ====================
  
  getClinicalPathways: async (filters: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/clinical-pathways', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      params: filters,
    });
    return { data: response.data };
  },

  getClinicalPathway: async (pathwayId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/clinical-pathways/${pathwayId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  enrollInPathway: async (enrollmentData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/clinical-pathways/enroll', enrollmentData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientPathwayEnrollments: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/clinical-pathways/patient/${patientId}/enrollments`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updatePathwayAdherence: async (enrollmentId: string, adherenceData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/clinical-pathways/enrollments/${enrollmentId}/adherence`, adherenceData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Vaccine Administration
  administerVaccine: async (patientId: string, vaccineData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/immunizations/patient/${patientId}/administer`, vaccineData, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Patient Vitals
  getPatientVitals: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/vitals/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // Nursing Notes
  getNursingNotesByPatient: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/nursing-notes/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },
};

export const cdssApi = {
  getRiskAssessment: async (patientData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/risk-assessment', patientData, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  getDiagnosisSuggestions: async (symptoms: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/diagnosis-assist', symptoms, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  searchGuidelines: async (query: string, token: string, tenantSlug: string, limit: number = 5, patientContext?: any) => {
    const response = await ehrAxios.post('/cdss/guidelines/search', { query, limit, patient_context: patientContext }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },
  
  getGuidelines: async (condition: string, patientData: any, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/guidelines', {
      condition,
      patientData,
    }, {
      headers: {
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`,
      },
    });
    return { data: response.data };
  },

  analyzeMedicalImage: async (formData: FormData, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss/analyze-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Tenant-ID': tenantSlug,
        'Authorization': `Bearer ${token}`
      },
    });
    return { data: response.data };
  },

  // ── CDSS Decision Log endpoints (Sprint 61) ───────────────────────────────

  logCdssDecision: async (data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/cdss-log', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  recordCdssAction: async (
    logId: string,
    action: 'accepted' | 'modified' | 'overridden' | 'ignored',
    overrideReason: string | undefined,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.patch(
      `/cdss-log/${logId}/action`,
      { clinicianAction: action, overrideReason },
      { headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` } },
    );
    return { data: response.data };
  },

  getCdssDecisionHistory: async (patientId: string, token: string, tenantSlug: string, limit = 20) => {
    const response = await ehrAxios.get(`/cdss-log/patient/${patientId}?limit=${limit}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getCdssActionStats: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/cdss-log/stats', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ── Nurse Tasks & Care Gaps (Sprint 62) ───────────────────────────────────

  getNursePendingTasks: async (token: string, tenantSlug: string, limit = 50) => {
    const response = await ehrAxios.get(`/nurse-tasks/pending?limit=${limit}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getNurseTasksForPatient: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/nurse-tasks/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateNurseTask: async (
    taskId: string,
    data: Record<string, any>,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.patch(`/nurse-tasks/${taskId}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createNurseTask: async (data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/nurse-tasks', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPatientCareGaps: async (patientId: string, token: string, tenantSlug: string, status?: string) => {
    const params = status ? `?status=${status}` : '';
    const response = await ehrAxios.get(`/nurse-tasks/care-gaps/patient/${patientId}${params}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateCareGapStatus: async (
    gapId: string,
    status: string,
    token: string,
    tenantSlug: string,
  ) => {
    const response = await ehrAxios.patch(
      `/nurse-tasks/care-gaps/${gapId}/status`,
      { status },
      { headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` } },
    );
    return { data: response.data };
  },

  /** Mark a nurse task as viewed — prevents it reappearing as "new" after login */
  markNurseTaskViewed: async (taskId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/nurse-tasks/${taskId}/viewed`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ── Staff Notifications (Sprint 109) ──────────────────────────────────────

  getStaffNotifications: async (
    token: string,
    tenantSlug: string,
    opts?: { read?: boolean; limit?: number },
  ) => {
    const params = new URLSearchParams();
    if (opts?.read !== undefined) params.set('read', String(opts.read));
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await ehrAxios.get(`/staff-notifications${qs}`, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getStaffNotificationsUnreadCount: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/staff-notifications/unread-count', {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
    return { data: response.data as { count: number } };
  },

  markStaffNotificationRead: async (notificationId: string, token: string, tenantSlug: string) => {
    await ehrAxios.patch(`/staff-notifications/${notificationId}/read`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
  },

  markAllStaffNotificationsRead: async (token: string, tenantSlug: string) => {
    await ehrAxios.patch('/staff-notifications/read-all', {}, {
      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
    });
  },

  // ── SDOH endpoints (Sprint 60) ─────────────────────────────────────────────

  getPatientSdoh: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/patients/${patientId}/sdoh`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  createPatientSdoh: async (patientId: string, sdohData: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/patients/${patientId}/sdoh`, sdohData, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ── Pre-Charting AI (Sprint 64) ───────────────────────────────────────────

  getPrechart: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/precharts/appointment/${appointmentId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  generatePrechart: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/precharts/appointment/${appointmentId}/generate`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  markPrechartReviewed: async (appointmentId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/precharts/appointment/${appointmentId}/reviewed`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ── Smart Inbox AI Triage (Sprint 65) ─────────────────────────────────────

  getInbox: async (
    token: string,
    tenantSlug: string,
    opts: { unreadOnly?: boolean; priority?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.unreadOnly) params.set('unreadOnly', 'true');
    if (opts.priority)   params.set('priority', opts.priority);
    if (opts.limit)      params.set('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await ehrAxios.get(`/inbox${qs}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getInboxCounts: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.get('/inbox/counts', {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  markInboxRead: async (itemId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/inbox/${itemId}/read`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  markInboxActioned: async (itemId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/inbox/${itemId}/actioned`, {}, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  markAllInboxRead: async (token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch('/inbox/read-all', {}, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ── Tuberculosis Module (Sprint 66) ───────────────────────────────────────

  registerTbPatient: async (data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/tb', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  listTbPatients: async (token: string, tenantSlug: string, params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    const response = await ehrAxios.get(`/tb${qs ? `?${qs}` : ''}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTbPatientByPatient: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/tb/patient/${patientId}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updateTbPatient: async (id: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/tb/${id}`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTbDiagnoses: async (tbPatientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/tb/${tbPatientId}/diagnoses`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  addTbDiagnosis: async (tbPatientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/tb/${tbPatientId}/diagnoses`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTbEpisodes: async (tbPatientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/tb/${tbPatientId}/episodes`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  startTbEpisode: async (tbPatientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/tb/${tbPatientId}/episodes`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTbDotRecords: async (tbPatientId: string, token: string, tenantSlug: string, params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    const response = await ehrAxios.get(`/tb/${tbPatientId}/dot${qs ? `?${qs}` : ''}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  recordTbDot: async (tbPatientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/tb/${tbPatientId}/dot`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTbContacts: async (tbPatientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/tb/${tbPatientId}/contacts`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  addTbContact: async (tbPatientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/tb/${tbPatientId}/contacts`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTbDstResults: async (tbPatientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/tb/${tbPatientId}/dst`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  addTbDst: async (tbPatientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/tb/${tbPatientId}/dst`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  recordTbOutcome: async (tbPatientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/tb/${tbPatientId}/outcomes`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getTbRegimenRecommendation: async (data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/tb/cdss/regimen', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  analyseTbAdherence: async (data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/tb/cdss/adherence', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ── Pediatrics Module (Sprint 67) ─────────────────────────────────────────

  getPediatricProfile: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pediatrics/patient/${patientId}/profile`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  updatePediatricProfile: async (patientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.patch(`/pediatrics/patient/${patientId}/profile`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPediatricGrowth: async (patientId: string, token: string, tenantSlug: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    const response = await ehrAxios.get(`/pediatrics/patient/${patientId}/growth${qs}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  addPediatricGrowth: async (patientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/pediatrics/patient/${patientId}/growth`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPediatricMilestones: async (patientId: string, token: string, tenantSlug: string, domain?: string) => {
    const qs = domain ? `?domain=${domain}` : '';
    const response = await ehrAxios.get(`/pediatrics/patient/${patientId}/milestones${qs}`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  upsertPediatricMilestone: async (patientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/pediatrics/patient/${patientId}/milestones`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  getPediatricNeonatal: async (patientId: string, token: string, tenantSlug: string) => {
    const response = await ehrAxios.get(`/pediatrics/patient/${patientId}/neonatal`, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  savePediatricNeonatal: async (patientId: string, data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post(`/pediatrics/patient/${patientId}/neonatal`, data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  assessPediatricGrowth: async (data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pediatrics/cdss/growth', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  pediatricDosing: async (data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pediatrics/cdss/dosing', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  assessPediatricMilestones: async (data: Record<string, any>, token: string, tenantSlug: string) => {
    const response = await ehrAxios.post('/pediatrics/cdss/milestones', data, {
      headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
    });
    return { data: response.data };
  },

  // ── Sprint 68: Mental Health ────────────────────────────────────────────────

  getMhScreenings: async (patientId: string, tenantSubdomain: string, tool?: string) => {
    const token = localStorage.getItem('token') || '';
    const params: any = {};
    if (tool) params.tool = tool;
    const res = await ehrAxios.get(`/mental-health/patient/${patientId}/screenings`, {
      params,
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addMhScreening: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/mental-health/patient/${patientId}/screenings`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  scoreMhScreening: async (data: { tool: string; responses: Record<string, number> }) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/mental-health/cdss/screen', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getMhEncounters: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/mental-health/patient/${patientId}/encounters`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addMhEncounter: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/mental-health/patient/${patientId}/encounters`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getMhCrisisEvents: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/mental-health/patient/${patientId}/crisis`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addMhCrisisEvent: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/mental-health/patient/${patientId}/crisis`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getActiveSafePlan: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    try {
      const res = await ehrAxios.get(`/mental-health/patient/${patientId}/safe-plan`, {
        headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch { return null; }
  },

  upsertSafePlan: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/mental-health/patient/${patientId}/safe-plan`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getMhMedications: async (patientId: string, tenantSubdomain: string, activeOnly = false) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/mental-health/patient/${patientId}/medications`, {
      params: activeOnly ? { active: 'true' } : {},
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addMhMedication: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/mental-health/patient/${patientId}/medications`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  monitorMhMedication: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/mental-health/cdss/medication/monitor', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  assessMhSuicideRisk: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/mental-health/cdss/risk', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  // ── Sprint 69: Malaria ──────────────────────────────────────────────────────

  registerMalariaCase: async (tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/malaria', dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  listMalariaCases: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get('/malaria', {
      params: { patientId },
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  updateMalariaCase: async (id: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.patch(`/malaria/${id}`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addMalariaTest: async (caseId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/malaria/${caseId}/tests`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getMalariaTests: async (caseId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/malaria/${caseId}/tests`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  startMalariaTreatment: async (caseId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/malaria/${caseId}/treatments`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getMalariaTreatments: async (caseId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/malaria/${caseId}/treatments`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addMalariaContact: async (caseId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/malaria/${caseId}/contacts`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getMalariaContacts: async (caseId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/malaria/${caseId}/contacts`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  recommendMalariaTreatment: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/malaria/cdss/treatment', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  scoreMalariaSeverity: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/malaria/cdss/severity', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  // ── Sprint 70: Geriatrics ───────────────────────────────────────────────────

  addGeriatricAssessment: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/geriatrics/patient/${patientId}/assessments`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getGeriatricAssessments: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/geriatrics/patient/${patientId}/assessments`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addFallsAssessment: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/geriatrics/patient/${patientId}/falls`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getFallsAssessments: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/geriatrics/patient/${patientId}/falls`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addPressureAssessment: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/geriatrics/patient/${patientId}/pressure`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getPressureAssessments: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/geriatrics/patient/${patientId}/pressure`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addPolypharmacyReview: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/geriatrics/patient/${patientId}/polypharmacy`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getPolypharmacyReviews: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/geriatrics/patient/${patientId}/polypharmacy`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  addAcpDocument: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/geriatrics/patient/${patientId}/acp`, dto, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getAcpDocuments: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/geriatrics/patient/${patientId}/acp`, {
      headers: { 'x-tenant-subdomain': tenantSubdomain, Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  assessGeriatricFrailty: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/geriatrics/cdss/frailty', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  checkGeriatricPolypharmacy: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/geriatrics/cdss/polypharmacy', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  assessGeriatricFallRisk: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/geriatrics/cdss/fall-risk', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  // ── Dermatology ────────────────────────────────────────────────────────────

  getDermatologyLesions: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/dermatology/patient/${patientId}/lesion`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addDermatologyLesion: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/dermatology/patient/${patientId}/lesion`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getDermatologyWounds: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/dermatology/patient/${patientId}/wound`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addDermatologyWound: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/dermatology/patient/${patientId}/wound`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getDermatologyBurns: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/dermatology/patient/${patientId}/burn`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addDermatologyBurn: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/dermatology/patient/${patientId}/burn`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getDermatologyNotes: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/dermatology/patient/${patientId}/note`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addDermatologyNote: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/dermatology/patient/${patientId}/note`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  classifyDermatologyLesion: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/dermatology/cdss/lesion/classify', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  calculateBurnFluid: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/dermatology/cdss/burn/fluid', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  // ── Nephrology ─────────────────────────────────────────────────────────────

  getNephrologyCkd: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/nephrology/patient/${patientId}/ckd`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNephrologyCkd: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/nephrology/patient/${patientId}/ckd`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getNephrologyDialysis: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/nephrology/patient/${patientId}/dialysis`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNephrologyDialysis: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/nephrology/patient/${patientId}/dialysis`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getNephrologyFluid: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/nephrology/patient/${patientId}/fluid`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNephrologyFluid: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/nephrology/patient/${patientId}/fluid`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getNephrologyBiopsies: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/nephrology/patient/${patientId}/biopsy`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNephrologyBiopsy: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/nephrology/patient/${patientId}/biopsy`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getNephrologyTransplants: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/nephrology/patient/${patientId}/transplant`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNephrologyTransplant: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/nephrology/patient/${patientId}/transplant`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  stageCkd: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/nephrology/cdss/ckd/stage', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  assessDialysisAdequacy: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/nephrology/cdss/dialysis/adequacy', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  renalDrugDosing: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/nephrology/cdss/drug-dosing/renal-adjust', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  // ── Pulmonology ────────────────────────────────────────────────────────────

  getPulmonologySpirometry: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/pulmonology/patient/${patientId}/spirometry`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addPulmonologySpirometry: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/pulmonology/patient/${patientId}/spirometry`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getPulmonologyCopd: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/pulmonology/patient/${patientId}/copd`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addPulmonologyCopd: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/pulmonology/patient/${patientId}/copd`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getPulmonologyAsthma: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/pulmonology/patient/${patientId}/asthma`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addPulmonologyAsthma: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/pulmonology/patient/${patientId}/asthma`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getPulmonologyPeakFlow: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/pulmonology/patient/${patientId}/peak-flow`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addPulmonologyPeakFlow: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/pulmonology/patient/${patientId}/peak-flow`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  getPulmonologyOxygen: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/pulmonology/patient/${patientId}/oxygen`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addPulmonologyOxygen: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/pulmonology/patient/${patientId}/oxygen`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  interpretPulmonologySpirometry: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/pulmonology/cdss/spirometry/interpret', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  pulmonologyAsthmaStepUp: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/pulmonology/cdss/asthma/stepup', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  prescribePulmonologyOxygen: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/pulmonology/cdss/oxygen/prescribe', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  // ── Neurology ──────────────────────────────────────────────────────────────

  getNeurologySeizures: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/neurology/patient/${patientId}/seizures`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNeurologySeizure: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/neurology/patient/${patientId}/seizures`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  classifyNeurologySeizure: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/neurology/cdss/seizure/classify', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getNeurologyStrokes: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/neurology/patient/${patientId}/stroke`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNeurologyStroke: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/neurology/patient/${patientId}/stroke`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  triageNeurologyStroke: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/neurology/cdss/stroke/triage', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getNeurologyHeadaches: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/neurology/patient/${patientId}/headache`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNeurologyHeadache: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/neurology/patient/${patientId}/headache`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  diagnoseNeurologyHeadache: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post('/neurology/cdss/headache/diagnose', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getNeurologyCognitive: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.get(`/neurology/patient/${patientId}/cognitive`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  addNeurologyCognitive: async (patientId: string, tenantSubdomain: string, dto: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    const res = await ehrAxios.post(`/neurology/patient/${patientId}/cognitive`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
    return res.data;
  },

  // ── Palliative Care ───────────────────────────────────────────────────────
  getPalliativeAssessments: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/palliative/patient/${patientId}/assessment`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addPalliativeAssessment: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/palliative/patient/${patientId}/assessment`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  getPalliativeEsas: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/palliative/patient/${patientId}/esas`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addPalliativeEsas: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/palliative/patient/${patientId}/esas`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  getPalliativeGoals: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/palliative/patient/${patientId}/goals`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addPalliativeGoals: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/palliative/patient/${patientId}/goals`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  getPalliativeDirectives: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/palliative/patient/${patientId}/directive`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addPalliativeDirective: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/palliative/patient/${patientId}/directive`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  getPalliativeMedReviews: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/palliative/patient/${patientId}/med-review`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addPalliativeMedReview: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/palliative/patient/${patientId}/med-review`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  palliativePrognosis: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/palliative/cdss/prognosis', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  palliativeOpioidConvert: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/palliative/cdss/opioid/convert', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  palliativeSymptomManage: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/palliative/cdss/symptom/manage', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ── Nutrition & Dietetics ─────────────────────────────────────────────────
  getNutritionScreenings: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/nutrition/patient/${patientId}/screening`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addNutritionScreening: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/nutrition/patient/${patientId}/screening`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  getNutritionAssessments: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/nutrition/patient/${patientId}/assessment`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addNutritionAssessment: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/nutrition/patient/${patientId}/assessment`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  getNutritionPrescriptions: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/nutrition/patient/${patientId}/prescription`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addNutritionPrescription: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/nutrition/patient/${patientId}/prescription`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  getNutritionMonitoring: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/nutrition/patient/${patientId}/monitoring`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  addNutritionMonitoring: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/nutrition/patient/${patientId}/monitoring`, dto, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain },
    });
  },

  cdssNutritionScreen: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/nutrition/cdss/screen', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  cdssNutritionPrescribe: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/nutrition/cdss/prescribe', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  cdssRefeedingRisk: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/nutrition/cdss/refeeding-risk', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ── ICU / Critical Care ───────────────────────────────────────────────────
  getIcuAdmissions: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/icu/patient/${patientId}/admission`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  addIcuAdmission: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/icu/patient/${patientId}/admission`, dto, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  updateIcuAdmission: async (id: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.patch(`/icu/admission/${id}`, dto, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  getIcuSofa: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/icu/patient/${patientId}/sofa`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  addIcuSofa: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/icu/patient/${patientId}/sofa`, dto, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  getIcuVent: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/icu/patient/${patientId}/vent`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  addIcuVent: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/icu/patient/${patientId}/vent`, dto, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  getIcuSedation: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/icu/patient/${patientId}/sedation`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  addIcuSedation: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/icu/patient/${patientId}/sedation`, dto, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  getIcuLines: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/icu/patient/${patientId}/line`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  addIcuLine: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/icu/patient/${patientId}/line`, dto, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  getIcuVasopressors: async (patientId: string, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.get(`/icu/patient/${patientId}/vasopressor`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  addIcuVasopressor: async (patientId: string, dto: Record<string, any>, tenantSubdomain: string) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post(`/icu/patient/${patientId}/vasopressor`, dto, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-subdomain': tenantSubdomain } });
  },
  cdssIcuSofa: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/icu/cdss/sofa/calculate', data, { headers: { Authorization: `Bearer ${token}` } });
  },
  cdssIcuVent: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/icu/cdss/vent/protocol', data, { headers: { Authorization: `Bearer ${token}` } });
  },
  cdssIcuSedation: async (data: Record<string, any>) => {
    const token = localStorage.getItem('token') || '';
    return ehrAxios.post('/icu/cdss/sedation/assess', data, { headers: { Authorization: `Bearer ${token}` } });
  },
  // ── Sprint 119: Clinical Order Intelligence ─────────────────────────
  suggestOrderSets: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/order/suggest-sets', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  checkImagingAppropriateness: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/order/imaging-appropriateness', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  predictPriorAuth: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/order/prior-auth-predict', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  checkLabReorder: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/lab/reorder-check', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  // ── Sprint 120: Nursing Intelligence Suite ────────────────────────────
  generateNursingCarePlan: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/nursing/care-plan', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  generateSBAR: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/nursing/sbar', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  assessFallRisk: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/nursing/fall-risk', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  stageWound: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/nursing/wound-staging', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  // ── Sprint 121: Medication Reconciliation AI ──────────────────────────
  reconcileMedications: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/medication/reconciliation', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  checkPDMP: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/medication/pdmp-check', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  // ── Sprint 122: Discharge Intelligence ───────────────────────────────
  getDischargeIntelligence: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/discharge/intelligence', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  getFollowUpTiming: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/discharge/follow-up-timing', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  // ── Sprint 123: AI Self-Learning Hardening ────────────────────────────
  runShadowEval: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/self-learning/shadow-eval', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  runBiasAudit: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/self-learning/bias-audit', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
  detectAuditAnomalies: (payload: any, token: string, tenantSlug: string) =>
    ehrAxios.post('/cdss/self-learning/audit-anomaly', payload, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': tenantSlug } }),
};

export const {
  getPalliativeAssessments,
  addPalliativeAssessment,
  getPalliativeEsas,
  addPalliativeEsas,
  getPalliativeGoals,
  addPalliativeGoals,
  getPalliativeDirectives,
  addPalliativeDirective,
  getPalliativeMedReviews,
  addPalliativeMedReview,
  palliativePrognosis,
  palliativeOpioidConvert,
  palliativeSymptomManage,
  getNutritionScreenings,
  addNutritionScreening,
  getNutritionAssessments,
  addNutritionAssessment,
  getNutritionPrescriptions,
  addNutritionPrescription,
  getNutritionMonitoring,
  addNutritionMonitoring,
  cdssNutritionScreen,
  cdssNutritionPrescribe,
  cdssRefeedingRisk,
  getIcuAdmissions,
  addIcuAdmission,
  updateIcuAdmission,
  getIcuSofa,
  addIcuSofa,
  getIcuVent,
  addIcuVent,
  getIcuSedation,
  addIcuSedation,
  getIcuLines,
  addIcuLine,
  getIcuVasopressors,
  addIcuVasopressor,
  cdssIcuSofa,
  cdssIcuVent,
  cdssIcuSedation,
} = cdssApi;
