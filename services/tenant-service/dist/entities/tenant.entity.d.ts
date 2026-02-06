export declare enum TenantStatus {
    PENDING = "pending",
    ACTIVE = "active",
    SUSPENDED = "suspended",
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
    logoUrl: string;
    featureFlags: Record<string, boolean>;
    createdAt: Date;
    updatedAt: Date;
}
