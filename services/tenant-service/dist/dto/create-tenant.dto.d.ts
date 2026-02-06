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
}
