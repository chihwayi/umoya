export interface Tenant {
  id: string;
  clinicName: string;
  subdomain: string;
  databaseName: string;
  connectionString: string | null;
  subscriptionTier: 'basic' | 'professional' | 'enterprise';
  status: 'pending' | 'active' | 'suspended' | 'cancelled';
  contactEmail: string;
  contactPhone: string;
  address: string | null;
  city: string | null;
  country: string;
  featureFlags: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantRequest {
  clinicName: string;
  subdomain: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  city?: string;
  subscriptionTier: 'basic' | 'professional' | 'enterprise';
}

export interface TenantUser {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'tenant_admin' | 'doctor' | 'nurse' | 'receptionist' | 'pharmacist' | 'lab_technician' | 'accounts' | 'radiologist';
  status: 'active' | 'inactive' | 'suspended';
  licenseNumber?: string;
  specialization?: string;
  lastLogin?: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  fullName: string;
}

export interface CreateTenantUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'tenant_admin' | 'doctor' | 'nurse' | 'receptionist' | 'pharmacist' | 'lab_technician' | 'accounts' | 'radiologist';
  licenseNumber?: string;
  specialization?: string;
  temporaryPassword: string;
}

export interface SystemStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  tenantsByTier: Array<{ tier: string; count: number }>;
  recentSignups: Tenant[];
  activationRate: string;
}

export interface TenantReport {
  tenant: Tenant;
  users: {
    total: number;
    active: number;
    byRole: Record<string, number>;
  };
  metrics: any;
  generatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'tenant_admin';
}