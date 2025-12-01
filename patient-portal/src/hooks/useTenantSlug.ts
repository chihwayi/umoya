import { useParams } from 'react-router-dom';

export const useTenantSlug = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Return tenant slug from URL, fallback to localStorage, then default
  // No redirects - just return the value
  return tenantSlug || localStorage.getItem('patient_tenant') || 'bulawayo-general';
};

