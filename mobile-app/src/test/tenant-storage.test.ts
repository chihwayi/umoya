import { clearStoredTenant, getStoredTenant, setStoredTenant } from '../lib/tenant/tenant-storage';

describe('tenant bootstrap storage', () => {
  it('stores and retrieves tenant bootstrap', () => {
    clearStoredTenant();

    setStoredTenant({
      tenantId: 'tenant-1',
      subdomain: 'kids-clinic',
      name: 'Kids Clinic',
      logoUrl: null,
      ehrApiBaseUrl: 'https://example/ehr-service/api',
      tenantApiBaseUrl: 'https://example/tenant-service/api',
      selectedAt: '2026-03-13T08:00:00.000Z'
    });

    const stored = getStoredTenant();
    expect(stored?.tenantId).toBe('tenant-1');
    expect(stored?.subdomain).toBe('kids-clinic');
  });
});
