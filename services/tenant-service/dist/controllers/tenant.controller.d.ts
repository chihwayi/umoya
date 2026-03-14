import type { Response } from 'express';
import { TenantBillingSummary, TenantService } from '../services/tenant.service';
import { StorageService } from '../services/storage.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { TenantDhis2ConfigPayload, TenantDhis2ConfigView } from '../services/tenant.service';
type SafeTenant = Omit<Tenant, 'connectionString'> & {
    billingSummary: TenantBillingSummary;
};
type PublicTenant = Pick<Tenant, 'id' | 'subdomain' | 'clinicName' | 'status' | 'logoUrl' | 'enabledModules' | 'subscriptionMode' | 'packagePreset' | 'subscriptionState' | 'packageName'> & {
    billingSummary: TenantBillingSummary;
};
export declare class TenantController {
    private readonly tenantService;
    private readonly storageService;
    constructor(tenantService: TenantService, storageService: StorageService);
    private toSafeTenant;
    private toPublicTenant;
    uploadLogo(file: any): Promise<{
        url: string;
    }>;
    createTenant(createTenantDto: CreateTenantDto): Promise<{
        tenant: SafeTenant;
        message: string;
    }>;
    getAllTenants(): Promise<SafeTenant[]>;
    getActiveTenants(): Promise<PublicTenant[]>;
    getTenantBySubdomain(subdomain: string): Promise<PublicTenant>;
    getTenantLogo(id: string, res: Response): Promise<void>;
    getTenantById(id: string): Promise<SafeTenant>;
    updateTenant(id: string, updateTenantDto: UpdateTenantDto): Promise<SafeTenant>;
    updateTenantStatus(id: string, status: TenantStatus): Promise<SafeTenant>;
    deleteTenant(id: string): Promise<{
        message: string;
    }>;
    checkTenantHealth(id: string): Promise<{
        status: string;
        database: string;
    }>;
    getTenantDhis2Config(id: string): Promise<TenantDhis2ConfigView | {
        configured: false;
    }>;
    upsertTenantDhis2Config(id: string, body: TenantDhis2ConfigPayload): Promise<TenantDhis2ConfigView>;
    clearTenantDhis2Config(id: string): Promise<{
        message: string;
    }>;
    getSubscriptionPaymentProviders(id: string): Promise<{
        key: string;
        label: string;
        enabled: boolean;
        mode: "gateway" | "manual";
    }[]>;
    getSubscriptionPayments(id: string, limit?: string): Promise<any[]>;
    createSubscriptionPaymentSession(id: string, body: {
        provider: string;
        amount?: number;
        currency?: string;
        monthsToExtend?: number;
        successUrl?: string;
        cancelUrl?: string;
        metadata?: Record<string, any>;
    }): Promise<any>;
    confirmSubscriptionPayment(id: string, paymentId: string, body: {
        status: 'successful' | 'failed' | 'cancelled';
        externalPaymentId?: string;
        note?: string;
    }): Promise<any>;
}
export {};
