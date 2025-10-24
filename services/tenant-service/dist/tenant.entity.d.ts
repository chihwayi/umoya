export declare enum TenantStatus {
    ACTIVE = "active",
    SUSPENDED = "suspended",
    PENDING = "pending",
    CANCELLED = "cancelled"
}
export declare enum SubscriptionTier {
    BASIC = "basic",
    PROFESSIONAL = "professional",
    ENTERPRISE = "enterprise"
}
export declare class Tenant {
    id: string;
    clinicName: string;
    subdomain: string;
    databaseName: string;
    connectionString: string;
    subscriptionTier: SubscriptionTier;
    status: TenantStatus;
    contactEmail: string;
    contactPhone: string;
    address: string;
    city: string;
    country: string;
    featureFlags: Record<string, boolean>;
    integrationSettings: Record<string, any>;
    billingConfig: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
