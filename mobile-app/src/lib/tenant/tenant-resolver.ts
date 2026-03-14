import { getRuntimeConfig } from '../config/runtime';
import { listActiveTenants, lookupTenantBySubdomain } from '../../services/api/tenant';
import { getStoredTenant, setStoredTenant } from './tenant-storage';
import type { ActiveTenant, TenantBootstrap } from './types';

function toBootstrap(tenant: ActiveTenant): TenantBootstrap {
  const runtime = getRuntimeConfig();
  const logoUrl = tenant.logoUrl
    ? `${runtime.tenantServiceBaseUrl}/tenants/${encodeURIComponent(tenant.id)}/logo`
    : null;

  return {
    tenantId: tenant.id,
    subdomain: tenant.subdomain,
    name: tenant.clinicName,
    logoUrl,
    ehrApiBaseUrl: runtime.ehrServiceBaseUrl,
    tenantApiBaseUrl: runtime.tenantServiceBaseUrl,
    selectedAt: new Date().toISOString()
  };
}

export async function fetchActiveTenants(): Promise<ActiveTenant[]> {
  return listActiveTenants();
}

export async function resolveTenantBySubdomain(subdomain: string): Promise<TenantBootstrap> {
  const tenant = await lookupTenantBySubdomain(subdomain);
  const bootstrap = toBootstrap(tenant);
  setStoredTenant(bootstrap);
  return bootstrap;
}

export function getTenantBootstrap(): TenantBootstrap | null {
  const tenant = getStoredTenant();
  if (!tenant) return null;

  const runtime = getRuntimeConfig();
  const canonicalLogoUrl = `${runtime.tenantServiceBaseUrl}/tenants/${encodeURIComponent(tenant.tenantId)}/logo`;
  if (tenant.logoUrl !== canonicalLogoUrl) {
    const migrated = { ...tenant, logoUrl: canonicalLogoUrl };
    setStoredTenant(migrated);
    return migrated;
  }

  return tenant;
}
