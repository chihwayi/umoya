import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

let _apiInstance: AxiosInstance | null = null;

// Build or rebuild the axios instance when the tenant changes
export function buildApiClient(baseUrl: string): AxiosInstance {
  const instance = axios.create({
    baseURL: baseUrl,
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
      const tenant = JSON.parse(tenantRaw);
      config.headers['X-Tenant-ID'] = tenant.slug;
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

  _apiInstance = instance;
  return instance;
}

export function getApiClient(): AxiosInstance {
  if (!_apiInstance) throw new Error('API client not initialised — call buildApiClient first');
  return _apiInstance;
}

// Convenience typed caller
export const api = {
  get:    <T>(path: string, config?: object) => getApiClient().get<T>(path, config),
  post:   <T>(path: string, data?: unknown, config?: object) => getApiClient().post<T>(path, data, config),
  patch:  <T>(path: string, data?: unknown, config?: object) => getApiClient().patch<T>(path, data, config),
  put:    <T>(path: string, data?: unknown, config?: object) => getApiClient().put<T>(path, data, config),
  delete: <T>(path: string, config?: object) => getApiClient().delete<T>(path, config),
};
