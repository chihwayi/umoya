export type TenantBootstrap = {
  tenantId: string;
  subdomain: string;
  name: string;
  logoUrl?: string | null;
  ehrApiBaseUrl: string;
  tenantApiBaseUrl: string;
  selectedAt: string;
};

export type ActiveTenant = {
  id: string;
  subdomain: string;
  clinicName: string;
  logoUrl?: string | null;
};
