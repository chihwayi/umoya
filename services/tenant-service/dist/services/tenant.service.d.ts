import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { CreateTenantDto } from '../dto/create-tenant.dto';
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
export declare class TenantService implements OnModuleInit {
    private tenantRepository;
    private databaseProvisioningService;
    private readonly logger;
    constructor(tenantRepository: Repository<Tenant>, databaseProvisioningService: DatabaseProvisioningService);
    onModuleInit(): Promise<void>;
    createTenant(createTenantDto: CreateTenantDto): Promise<Tenant>;
    updateTenant(id: string, updateData: Partial<Tenant>): Promise<Tenant>;
    findBySubdomain(subdomain: string): Promise<Tenant>;
    findById(id: string): Promise<Tenant>;
    findAll(): Promise<Tenant[]>;
    getAllTenants(): Promise<Tenant[]>;
    updateTenantStatus(id: string, status: TenantStatus): Promise<Tenant>;
    deleteTenant(id: string): Promise<void>;
    getTenantDhis2Config(tenantId: string): Promise<TenantDhis2ConfigView | null>;
    upsertTenantDhis2Config(tenantId: string, payload: TenantDhis2ConfigPayload): Promise<TenantDhis2ConfigView>;
    clearTenantDhis2Config(tenantId: string): Promise<void>;
    private provisionTenantDatabase;
    private getDefaultFeatureFlags;
}
