import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { ensurePublicApiBaseUrl, EHR_BASE_OVERRIDE } from '../config/env';
import { OfflineCache } from './offlineCache';
import { useNetworkStore } from '../stores/useNetworkStore';

let _apiInstance: AxiosInstance | null = null;

// Build or rebuild the axios instance when the tenant changes
export function buildApiClient(baseUrl: string): AxiosInstance {
  const instance = axios.create({
    baseURL: ensurePublicApiBaseUrl(baseUrl),
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Attach JWT + Tenant on every request
  instance.interceptors.request.use(async (config) => {
    const [jwt, tenantRaw] = await Promise.all([
      SecureStore.getItemAsync('medicore_jwt'),
      SecureStore.getItemAsync('medicore_tenant'),
    ]);
    if (jwt) config.headers['Authorization'] = `Bearer ${jwt}`;
    if (tenantRaw) {
      try {
        const tenant = JSON.parse(tenantRaw);
        if (tenant?.slug) config.headers['X-Tenant-ID'] = tenant.slug;
      } catch { /* malformed tenant data — skip header */ }
    }
    return config;
  });

  // 401 → clear JWT and let the navigator handle redirect
  instance.interceptors.response.use(
    res => res,
    async (err) => {
      if (err?.response?.status === 401) {
        await SecureStore.deleteItemAsync('medicore_jwt');
        await SecureStore.deleteItemAsync('medicore_role');
        await SecureStore.deleteItemAsync('medicore_user');
      }
      return Promise.reject(err);
    }
  );

  // ── Offline cache interceptor ─────────────────────────────────────────────
  // This must be registered AFTER the 401 interceptor above.
  instance.interceptors.response.use(
    (res) => {
      useNetworkStore.getState().setOnline(true);
      if (res.config.method?.toLowerCase() === 'get' && res.config.url) {
        OfflineCache.save(res.config.url, res.data);
      }
      return res;
    },
    async (err) => {
      const isNetworkError =
        !err.response &&
        (err.code === 'ERR_NETWORK' ||
          err.code === 'ECONNABORTED' ||
          err.message === 'Network Error');

      if (isNetworkError) {
        useNetworkStore.getState().setOnline(false);

        if (err.config?.method?.toLowerCase() === 'get' && err.config?.url) {
          const cached = await OfflineCache.load(err.config.url);
          if (cached) {
            return {
              data: cached.data,
              status: 200,
              statusText: 'OK (cached)',
              headers: {
                'x-from-cache': 'true',
                'x-cached-at': String(cached.savedAt),
              },
              config: err.config,
              request: err.request,
            };
          }
        }
      }

      return Promise.reject(err);
    },
  );

  _apiInstance = instance;
  return instance;
}

// In dev mode, pre-seed the API client with the EHR override so that
// screens work without tenant discovery when EXPO_PUBLIC_EHR_BASE is set.
if (EHR_BASE_OVERRIDE) {
  buildApiClient(EHR_BASE_OVERRIDE);
}

export function getApiClient(): AxiosInstance {
  if (!_apiInstance) throw new Error('API client not initialised — call buildApiClient first');
  return _apiInstance;
}

export const educationApi = {
  getMyCourses: (lang: string) =>
    getApiClient().get(`/patient-portal/education/courses?lang=${lang}`),
  getCourse: (courseId: string, lang: string) =>
    getApiClient().get(`/patient-portal/education/courses/${courseId}?lang=${lang}`),
  enroll: (courseId: string) =>
    getApiClient().post(`/patient-portal/education/courses/${courseId}/enroll`),
  markLessonComplete: (lessonId: string) =>
    getApiClient().post(`/patient-portal/education/lessons/${lessonId}/complete`),
  submitQuizAttempt: (quizId: string, answers: { questionId: string; selectedOptionId: string }[]) =>
    getApiClient().post(`/patient-portal/education/quizzes/${quizId}/attempt`, { answers }),
};

// Convenience typed caller
export const api = {
  get:    <T>(path: string, config?: object) => getApiClient().get<T>(path, config),
  post:   <T>(path: string, data?: unknown, config?: object) => getApiClient().post<T>(path, data, config),
  patch:  <T>(path: string, data?: unknown, config?: object) => getApiClient().patch<T>(path, data, config),
  put:    <T>(path: string, data?: unknown, config?: object) => getApiClient().put<T>(path, data, config),
  delete: <T>(path: string, config?: object) => getApiClient().delete<T>(path, config),
};
