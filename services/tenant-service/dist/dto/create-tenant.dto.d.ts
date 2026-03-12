import { SubscriptionTier } from '../entities/tenant.entity';
export declare class CreateTenantDto {
    clinicName: string;
    subdomain: string;
    contactEmail: string;
    contactPhone: string;
    address?: string;
    city?: string;
    logoUrl?: string;
    subscriptionTier: SubscriptionTier;
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
