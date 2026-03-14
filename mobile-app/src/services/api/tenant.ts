import { tenantClient } from './http';
import type { ActiveTenant } from '../../lib/tenant/types';

export async function listActiveTenants(): Promise<ActiveTenant[]> {
  try {
    const { data } = await tenantClient.get<ActiveTenant[]>('/tenants/active');
    return Array.isArray(data) ? data : [];
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return [];
    throw err;
  }
}

export async function lookupTenantBySubdomain(subdomain: string): Promise<ActiveTenant> {
  const { data } = await tenantClient.get<ActiveTenant>(`/tenants/subdomain/${encodeURIComponent(subdomain)}`);
  return data;
}
