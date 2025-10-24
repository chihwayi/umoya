import { TenantService } from '../services/tenant.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
export declare class TenantController {
    private readonly tenantService;
    constructor(tenantService: TenantService);
    createTenant(createTenantDto: CreateTenantDto): Promise<{
        tenant: Tenant;
        message: string;
    }>;
    getAllTenants(): Promise<Tenant[]>;
    getTenantById(id: string): Promise<Tenant>;
    getTenantBySubdomain(subdomain: string): Promise<Tenant>;
    updateTenantStatus(id: string, status: TenantStatus): Promise<Tenant>;
    deleteTenant(id: string): Promise<{
        message: string;
    }>;
    checkTenantHealth(id: string): Promise<{
        status: string;
        database: string;
    }>;
}
