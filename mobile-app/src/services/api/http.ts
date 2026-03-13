import axios from 'axios';
import { getRuntimeConfig } from '../../lib/config/runtime';
import { getStoredTenant } from '../../lib/tenant/tenant-storage';
import { getStoredSession } from '../../lib/auth/session-storage';

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
