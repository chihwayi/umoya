import { Repository, DataSource } from 'typeorm';
import { Tenant, TenantStatus } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { DatabaseProvisioningService } from './database-provisioning.service';
export declare class TenantService {
    private tenantRepository;
    private databaseProvisioningService;
    private dataSource;
    constructor(tenantRepository: Repository<Tenant>, databaseProvisioningService: DatabaseProvisioningService, dataSource: DataSource);
    createTenant(createTenantDto: CreateTenantDto): Promise<Tenant>;
    findBySubdomain(subdomain: string): Promise<Tenant>;
    findById(id: string): Promise<Tenant>;
    updateTenantStatus(id: string, status: TenantStatus): Promise<Tenant>;
    private provisionTenantDatabase;
    private getDefaultFeatureFlags;
}
