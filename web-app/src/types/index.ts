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
  deploymentMode: string;
  suspensionWarningDays: number;
  billingSummary: TenantBillingSummary;
  status: 'pending' | 'active' | 'suspended' | 'cancelled';
  // GDPR/CDPA soft-delete state
  deletionRequestedAt?: string | null;
  deletionRequestedBy?: string | null;
  deletionReason?: string | null;
  purgeScheduledAt?: string | null;
  contactEmail: string;
  contactPhone: string;
  address: string | null;
  city: string | null;
  country: string;
  countryCode: string | null;
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
  countryCode?: string;
  deploymentMode?: 'clinic' | 'hospital' | 'ministry';
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
  countryCode?: string;
  deploymentMode?: 'clinic' | 'hospital' | 'ministry';
}

export type ReadinessStatus = 'ready' | 'needs_attention' | 'blocked' | 'not_configured';

export interface ReadinessCheck {
  label: string;
  status: ReadinessStatus;
  detail?: string;
}

export interface RolloutReadiness {
  tenantId: string;
  clinicName: string;
  deploymentMode: string;
  countryCode: string | null;
  overallStatus: ReadinessStatus;
  checks: ReadinessCheck[];
  lastUpdated: string;
}

export type MigrationJobStatus = 'uploaded' | 'dry_run_complete' | 'imported' | 'failed';
export type MigrationSeverity = 'error' | 'warning';

export interface PatientMigrationRow {
  rowNumber: number;
  patientNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
}

export interface MigrationIssue {
  rowNumber: number;
  severity: MigrationSeverity;
  field?: string;
  message: string;
}

export interface MigrationDryRunResult {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  issues: MigrationIssue[];
}

export interface MigrationImportResult {
  insertedRows: number;
  skippedRows: number;
  failedRows: number;
  issues: MigrationIssue[];
}

export interface MigrationJob {
  id: string;
  fileName: string;
  status: MigrationJobStatus;
  uploadedAt: string;
  importedAt?: string;
  totalRows: number;
  records: PatientMigrationRow[];
  dryRun?: MigrationDryRunResult;
  importResult?: MigrationImportResult;
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

export interface TenantSubscriptionPaymentProvider {
  key: string;
  label: string;
  enabled: boolean;
  mode: 'gateway' | 'manual';
}

export interface TenantSubscriptionPayment {
  id: string;
  tenantId: string;
  provider: string;
  reference: string;
  sessionId: string;
  externalPaymentId?: string | null;
  amount: number;
  currency: string;
  monthsToExtend: number;
  status: 'pending' | 'successful' | 'failed' | 'cancelled' | string;
  checkoutUrl?: string | null;
  successUrl?: string | null;
  cancelUrl?: string | null;
  metadata?: Record<string, any>;
  paidAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
