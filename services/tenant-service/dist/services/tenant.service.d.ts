import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus, SubscriptionMode, SubscriptionState, PackagePreset } from '../entities/tenant.entity';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { DatabaseProvisioningService } from './database-provisioning.service';
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
export interface TenantBillingSummary {
    mode: SubscriptionMode;
    packagePreset: PackagePreset;
    state: SubscriptionState;
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
export declare class TenantService implements OnModuleInit {
    private tenantRepository;
    private databaseProvisioningService;
    private readonly logger;
    constructor(tenantRepository: Repository<Tenant>, databaseProvisioningService: DatabaseProvisioningService);
    onModuleInit(): Promise<void>;
    reconcileTenantLifecycle(): Promise<void>;
    createTenant(createTenantDto: CreateTenantDto): Promise<Tenant>;
    updateTenant(id: string, updateData: UpdateTenantDto): Promise<Tenant>;
    findBySubdomain(subdomain: string): Promise<Tenant>;
    findById(id: string): Promise<Tenant>;
    findAll(): Promise<Tenant[]>;
    getAllTenants(): Promise<Tenant[]>;
    searchTenants(q: string): Promise<Array<{
        slug: string;
        name: string;
        baseUrl: string;
        logoUrl?: string;
    }>>;
    updateTenantStatus(id: string, status: TenantStatus): Promise<Tenant>;
    deleteTenant(id: string): Promise<void>;
    getTenantDhis2Config(tenantId: string): Promise<TenantDhis2ConfigView | null>;
    upsertTenantDhis2Config(tenantId: string, payload: TenantDhis2ConfigPayload): Promise<TenantDhis2ConfigView>;
    clearTenantDhis2Config(tenantId: string): Promise<void>;
    getBillingSummary(tenant: Tenant): TenantBillingSummary;
    getSubscriptionPaymentProviders(): Array<{
        key: string;
        label: string;
        enabled: boolean;
        mode: 'gateway' | 'manual';
    }>;
    listSubscriptionPayments(tenantId: string, limit?: number): Promise<any[]>;
    createSubscriptionPaymentSession(tenantId: string, payload: {
        provider: string;
        amount?: number;
        currency?: string;
        monthsToExtend?: number;
        successUrl?: string;
        cancelUrl?: string;
        metadata?: Record<string, any>;
    }): Promise<any>;
    confirmSubscriptionPayment(tenantId: string, paymentId: string, body: {
        status: 'successful' | 'failed' | 'cancelled';
        externalPaymentId?: string;
        note?: string;
    }): Promise<any>;
    private estimateSubscriptionAmount;
    private resolveCheckoutUrl;
    private toSubscriptionPaymentView;
    private provisionTenantDatabase;
    private getCoreModulesForPreset;
    private getDefaultFeatureFlags;
    private resolvePackagePreset;
    private normalizeEnabledModules;
    private resolveSubscriptionFields;
    private inferGracePeriodDays;
    private applyLifecycleState;
    private computeLifecycleState;
    private diffInDays;
    private ensureSubscriptionSchema;
}
