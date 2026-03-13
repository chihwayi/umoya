import { getRuntimeConfig, normalizeBaseUrl } from '../lib/config/runtime';

describe('runtime config', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizeBaseUrl('https://medicore.test///')).toBe('https://medicore.test');
  });

  it('derives tenant and ehr service urls from one base env', () => {
    process.env.EXPO_PUBLIC_SERVICE_BASE_URL = 'https://example.health';
    process.env.EXPO_PUBLIC_SESSION_TIMEOUT_MINUTES = '20';
    const runtime = getRuntimeConfig();

    expect(runtime.serviceBaseUrl).toBe('https://example.health');
    expect(runtime.tenantServiceBaseUrl).toBe('https://example.health/tenant-service/api');
    expect(runtime.ehrServiceBaseUrl).toBe('https://example.health/ehr-service/api');
    expect(runtime.sessionInactivityTimeoutMs).toBe(1_200_000);
  });
});
