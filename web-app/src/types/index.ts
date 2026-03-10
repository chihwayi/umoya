export interface TenantBillingSummary {
  mode: 'demo' | 'paid';
  packagePreset: 'full_ehr' | 'claims_only';
  state: 'demo' | 'active' | 'grace' | 'suspended' | 'expired';
  packageName: string | null;
  accessEndsAt: string | null;
  suspensionAt: string | null;
  autoDeleteAt: string | null;
  daysRemaining: number | null;
  daysUntilSuspension: number | null;
  overdueDays: number;
  warningDays: number;
  tone: 'good' | 'warning' | 'critical' | 'expired';
  label: string;
  message: string;
  enabledModules: string[];
  coreModules: string[];
}

export interface Tenant {
  id: string;
  clinicName: string;
  subdomain: string;
  databaseName: string;
  connectionString: string | null;
  subscriptionTier: 'basic' | 'professional' | 'enterprise';
  subscriptionMode: 'demo' | 'paid';
  packagePreset: 'full_ehr' | 'claims_only';
  subscriptionState: 'demo' | 'active' | 'grace' | 'suspended' | 'expired';
  packageName: string | null;
  enabledModules: string[];
  billingEndsAt: string | null;
  demoExpiresAt: string | null;
  graceEndsAt: string | null;
  autoDeleteAt: string | null;
  suspensionWarningDays: number;
  billingSummary: TenantBillingSummary;
  status: 'pending' | 'active' | 'suspended' | 'cancelled';
  contactEmail: string;
  contactPhone: string;
  address: string | null;
  city: string | null;
  country: string;
  logoUrl?: string;
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
  logoUrl?: string;
  subscriptionTier: 'basic' | 'professional' | 'enterprise';
  subscriptionMode?: 'demo' | 'paid';
  packagePreset?: 'full_ehr' | 'claims_only';
  packageName?: string;
  enabledModules?: string[];
  demoDurationDays?: number;
  demoExpiresAt?: string;
  billingEndsAt?: string;
  gracePeriodDays?: number;
  suspensionWarningDays?: number;
}

export interface UpdateTenantRequest {
  clinicName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  logoUrl?: string;
  subscriptionTier?: 'basic' | 'professional' | 'enterprise';
  subscriptionMode?: 'demo' | 'paid';
  packagePreset?: 'full_ehr' | 'claims_only';
  packageName?: string;
  enabledModules?: string[];
  demoDurationDays?: number;
  demoExpiresAt?: string;
  billingEndsAt?: string;
  gracePeriodDays?: number;
  suspensionWarningDays?: number;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'admin' | 'doctor' | 'nurse' | 'nurse_accounts' | 'receptionist' | 'pharmacist' | 'lab_technician' | 'accounts' | 'radiologist';
  status: 'active' | 'inactive' | 'suspended';
  isActive: boolean;
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
  role: 'admin' | 'doctor' | 'nurse' | 'nurse_accounts' | 'receptionist' | 'pharmacist' | 'lab_technician' | 'accounts' | 'radiologist';
  licenseNumber?: string;
  specialization?: string;
  temporaryPassword?: string;
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

export interface TenantDhis2ConfigView {
  tenantId: string;
  baseUrl: string;
  apiVersion: string;
  authType: 'pat' | 'basic';
  hasPat: boolean;
  patMasked: string | null;
  username: string | null;
  orgUnitId: string;
  trackedEntityTypeId: string | null;
  datasetId: string | null;
  enabled: boolean;
  scheduledSyncEnabled: boolean;
  scheduledRetryLimit: number;
  alertLookbackHours: number;
  alertErrorThreshold: number;
  alertWebhookUrl: string | null;
  updatedAt: string | null;
}

export interface TenantDhis2ConfigPayload {
  baseUrl: string;
  apiVersion?: string;
  authType?: 'pat' | 'basic';
  pat?: string | null;
  username?: string | null;
  password?: string | null;
  orgUnitId: string;
  trackedEntityTypeId?: string | null;
  datasetId?: string | null;
  enabled?: boolean;
  scheduledSyncEnabled?: boolean;
  scheduledRetryLimit?: number;
  alertLookbackHours?: number;
  alertErrorThreshold?: number;
  alertWebhookUrl?: string | null;
}

export interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'admin';
}

export type DemoAccessRequestStatus =
  | 'new'
  | 'reviewing'
  | 'approved'
  | 'provisioned'
  | 'rejected';

export interface DemoAccessRequest {
  id: string;
  fullName: string;
  clinicName: string;
  workEmail: string;
  phone: string;
  roleTitle?: string | null;
  specialization?: string | null;
  currentSystem?: string | null;
  interestSummary: string;
  interestAreas: string[];
  preferredContactMethod: 'email' | 'phone' | 'whatsapp';
  status: DemoAccessRequestStatus;
  adminNotes?: string | null;
  assignedTenantId?: string | null;
  assignedSubdomain?: string | null;
  createdAt: string;
  updatedAt: string;
}
