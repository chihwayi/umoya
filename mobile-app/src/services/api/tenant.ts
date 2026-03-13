import { tenantClient } from './http';
import type { ActiveTenant } from '../../lib/tenant/types';

export async function listActiveTenants(): Promise<ActiveTenant[]> {
  const { data } = await tenantClient.get<ActiveTenant[]>('/tenants/active');
  return data;
}

export async function lookupTenantBySubdomain(subdomain: string): Promise<ActiveTenant> {
  const { data } = await tenantClient.get<ActiveTenant>(`/tenants/subdomain/${encodeURIComponent(subdomain)}`);
  return data;
}
