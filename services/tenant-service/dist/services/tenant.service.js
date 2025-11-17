"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TenantService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tenant_entity_1 = require("../entities/tenant.entity");
const database_provisioning_service_1 = require("./database-provisioning.service");
let TenantService = TenantService_1 = class TenantService {
    constructor(tenantRepository, databaseProvisioningService) {
        this.tenantRepository = tenantRepository;
        this.databaseProvisioningService = databaseProvisioningService;
        this.logger = new common_1.Logger(TenantService_1.name);
    }
    async onModuleInit() {
        const tenants = await this.tenantRepository.find();
        for (const tenant of tenants) {
            if (!tenant.databaseName) {
                continue;
            }
            try {
                await this.databaseProvisioningService.applySnomedUpgradesToTenant(tenant.databaseName);
            }
            catch (error) {
                this.logger.warn(`Failed to auto-apply SNOMED schema for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    async createTenant(createTenantDto) {
        const existingTenant = await this.tenantRepository.findOne({
            where: { subdomain: createTenantDto.subdomain }
        });
        if (existingTenant) {
            throw new common_1.ConflictException('Subdomain already exists');
        }
        const databaseName = `clinic_${createTenantDto.subdomain}_db`;
        const tenant = this.tenantRepository.create({
            ...createTenantDto,
            databaseName,
            status: tenant_entity_1.TenantStatus.PENDING,
            featureFlags: this.getDefaultFeatureFlags(createTenantDto.subscriptionTier),
        });
        const savedTenant = await this.tenantRepository.save(tenant);
        this.logger.log(`Tenant created: ${savedTenant.id}`);
        try {
            await this.provisionTenantDatabase(savedTenant);
        }
        catch (error) {
            this.logger.error(`Database provisioning failed for tenant ${savedTenant.id}:`, error);
            savedTenant.status = tenant_entity_1.TenantStatus.SUSPENDED;
            await this.tenantRepository.save(savedTenant);
        }
        return savedTenant;
    }
    async findBySubdomain(subdomain) {
        const tenant = await this.tenantRepository.findOne({
            where: { subdomain, status: tenant_entity_1.TenantStatus.ACTIVE }
        });
        if (!tenant) {
            throw new common_1.NotFoundException('Tenant not found');
        }
        return tenant;
    }
    async findById(id) {
        const tenant = await this.tenantRepository.findOne({
            where: { id }
        });
        if (!tenant) {
            throw new common_1.NotFoundException('Tenant not found');
        }
        return tenant;
    }
    async findAll() {
        return this.tenantRepository.find();
    }
    async getAllTenants() {
        return this.tenantRepository.find({
            order: { createdAt: 'DESC' }
        });
    }
    async updateTenantStatus(id, status) {
        const tenant = await this.findById(id);
        tenant.status = status;
        return this.tenantRepository.save(tenant);
    }
    async deleteTenant(id) {
        const tenant = await this.findById(id);
        if (tenant.databaseName) {
            await this.databaseProvisioningService.deleteDatabase(tenant.databaseName);
        }
        await this.tenantRepository.remove(tenant);
        this.logger.log(`Tenant deleted: ${id}`);
    }
    async provisionTenantDatabase(tenant) {
        try {
            this.logger.log(`Starting database provisioning for tenant: ${tenant.id}`);
            const connectionString = await this.databaseProvisioningService.createDatabase(tenant.databaseName);
            tenant.connectionString = connectionString;
            tenant.status = tenant_entity_1.TenantStatus.ACTIVE;
            await this.tenantRepository.save(tenant);
            this.logger.log(`Database provisioning completed for tenant: ${tenant.id}`);
        }
        catch (error) {
            tenant.status = tenant_entity_1.TenantStatus.SUSPENDED;
            await this.tenantRepository.save(tenant);
            this.logger.error(`Database provisioning failed for tenant: ${tenant.id}`, error);
            throw error;
        }
    }
    getDefaultFeatureFlags(tier) {
        const baseFeatures = {
            patientManagement: true,
            appointments: true,
            medicalRecords: true,
            basicBilling: true,
        };
        switch (tier) {
            case tenant_entity_1.SubscriptionTier.PROFESSIONAL:
                return {
                    ...baseFeatures,
                    medicalAidClaims: true,
                    basicCDSS: true,
                    fhirIntegration: true,
                    patientPortal: true,
                };
            case tenant_entity_1.SubscriptionTier.ENTERPRISE:
                return {
                    ...baseFeatures,
                    medicalAidClaims: true,
                    advancedCDSS: true,
                    fhirIntegration: true,
                    hl7Integration: true,
                    customReports: true,
                    apiAccess: true,
                    patientPortal: true,
                    telemedicine: true,
                    pharmacyManagement: true,
                };
            default:
                return baseFeatures;
        }
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = TenantService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tenant_entity_1.Tenant)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        database_provisioning_service_1.DatabaseProvisioningService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map