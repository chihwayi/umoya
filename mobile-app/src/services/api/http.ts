import axios from 'axios';
import { getRuntimeConfig } from '../../lib/config/runtime';
import { getStoredTenant } from '../../lib/tenant/tenant-storage';
import { getStoredSession } from '../../lib/auth/session-storage';
import { triggerAuthInvalidation } from '../../lib/auth/invalidation';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';
import { captureApiFailure } from '../../lib/observability/crash-reporting';
import { ensureOnlineForPolicy, isOnlinePolicyError } from '../../lib/network/online-policy';

const runtime = getRuntimeConfig();

export const tenantClient = axios.create({
  baseURL: runtime.tenantServiceBaseUrl,
  timeout: 15_000
});

export const ehrClient = axios.create({
  baseURL: runtime.ehrServiceBaseUrl,
  timeout: 20_000
});

ehrClient.interceptors.request.use(async (config) => {
  const method = String(config.method || 'get').toUpperCase();
  const url = String(config.url || '');

  try {
    await ensureOnlineForPolicy(method, url);
  } catch (error) {
    if (isOnlinePolicyError(error)) {
      trackMobileEvent('api.offline_policy_blocked', { method, url, reason: error.reason });
    }
    throw error;
  }

  const session = await getStoredSession();
  const tenant = getStoredTenant();

  config.headers = config.headers || {};
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  if (tenant?.subdomain) {
    config.headers['X-Tenant-ID'] = tenant.subdomain;
  }

  return config;
});

ehrClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = Number(error?.response?.status || 0);
    const method = String(error?.config?.method || 'get').toUpperCase();
    const url = String(error?.config?.url || '');

    if (status >= 400) {
      trackMobileEvent('api.error', {
        status,
        method,
        url
      });
    }

    if (status >= 500 || error?.code === 'ERR_NETWORK') {
      captureApiFailure({
        status,
        method,
        url,
        code: String(error?.code || 'unknown')
      });
    }

    const authRoutes = [
      '/auth/login',
      '/patient-portal/login',
      '/auth/2fa/complete-login',
      '/auth/force-password-change'
    ];

    if (status === 401 && !authRoutes.some((entry) => url.includes(entry))) {
      trackMobileEvent('session.invalidated', { source: 'http_401', url });
      await triggerAuthInvalidation('http_401');
    }

    return Promise.reject(error);
  }
);
