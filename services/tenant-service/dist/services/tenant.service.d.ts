import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { DatabaseProvisioningService } from './database-provisioning.service';
export declare class TenantService implements OnModuleInit {
    private tenantRepository;
    private databaseProvisioningService;
    private readonly logger;
    constructor(tenantRepository: Repository<Tenant>, databaseProvisioningService: DatabaseProvisioningService);
    onModuleInit(): Promise<void>;
    createTenant(createTenantDto: CreateTenantDto): Promise<Tenant>;
    findBySubdomain(subdomain: string): Promise<Tenant>;
    findById(id: string): Promise<Tenant>;
    findAll(): Promise<Tenant[]>;
    getAllTenants(): Promise<Tenant[]>;
    updateTenantStatus(id: string, status: TenantStatus): Promise<Tenant>;
    deleteTenant(id: string): Promise<void>;
    private provisionTenantDatabase;
    private getDefaultFeatureFlags;
}
