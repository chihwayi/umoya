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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tenant_entity_1 = require("./tenant.entity");
const database_provisioning_service_1 = require("./database-provisioning.service");
let TenantService = class TenantService {
    constructor(tenantRepository, databaseProvisioningService, dataSource) {
        this.tenantRepository = tenantRepository;
        this.databaseProvisioningService = databaseProvisioningService;
        this.dataSource = dataSource;
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
        this.provisionTenantDatabase(savedTenant);
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
    async updateTenantStatus(id, status) {
        const tenant = await this.findById(id);
        tenant.status = status;
        return this.tenantRepository.save(tenant);
    }
    async provisionTenantDatabase(tenant) {
        try {
            const connectionString = await this.databaseProvisioningService.createDatabase(tenant.databaseName);
            await this.databaseProvisioningService.runMigrations(connectionString);
            tenant.connectionString = connectionString;
            tenant.status = tenant_entity_1.TenantStatus.ACTIVE;
            await this.tenantRepository.save(tenant);
        }
        catch (error) {
            tenant.status = tenant_entity_1.TenantStatus.SUSPENDED;
            await this.tenantRepository.save(tenant);
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
                };
            default:
                return baseFeatures;
        }
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tenant_entity_1.Tenant)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeof (_a = typeof database_provisioning_service_1.DatabaseProvisioningService !== "undefined" && database_provisioning_service_1.DatabaseProvisioningService) === "function" ? _a : Object, typeorm_2.DataSource])
], TenantService);
//# sourceMappingURL=tenant.service.js.map