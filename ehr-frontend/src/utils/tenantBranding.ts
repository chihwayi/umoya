export interface TenantBranding {
  clinicName?: string;
  logoUrl?: string;
}

const TENANT_NAME_KEY = 'ehr_tenant_name';
const tenantBrandKey = (tenantSlug: string) => `ehr_tenant_brand:${tenantSlug}`;

const isBrowser = () => typeof window !== 'undefined';

export const formatTenantDisplayName = (tenantSlug?: string | null, clinicName?: string | null): string => {
  const cleanClinicName = clinicName?.trim();
  if (cleanClinicName) return cleanClinicName;

  const cleanSlug = tenantSlug?.trim();
  if (!cleanSlug) return 'Clinic Workspace';

  return cleanSlug
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

export const getBrandInitials = (displayName?: string | null): string => {
  const cleanName = displayName?.trim();
  if (!cleanName) return 'MC';

  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const readCachedTenantBranding = (tenantSlug?: string | null): TenantBranding | null => {
  if (!isBrowser()) return null;
  if (!tenantSlug) {
    const fallbackName = localStorage.getItem(TENANT_NAME_KEY);
    return fallbackName ? { clinicName: fallbackName } : null;
  }

  try {
    const raw = localStorage.getItem(tenantBrandKey(tenantSlug));
    if (raw) {
      const parsed = JSON.parse(raw) as TenantBranding;
      return {
        clinicName: parsed?.clinicName || undefined,
        logoUrl: parsed?.logoUrl || undefined,
      };
    }
  } catch {}

  return null;
};

export const cacheTenantBranding = (tenantSlug: string, branding: TenantBranding): void => {
  if (!isBrowser() || !tenantSlug) return;

  const payload: TenantBranding = {
    clinicName: branding.clinicName?.trim() || undefined,
    logoUrl: branding.logoUrl?.trim() || undefined,
  };

  try {
    localStorage.setItem(tenantBrandKey(tenantSlug), JSON.stringify(payload));
    if (payload.clinicName) {
      localStorage.setItem(TENANT_NAME_KEY, payload.clinicName);
    }
  } catch {}
};
