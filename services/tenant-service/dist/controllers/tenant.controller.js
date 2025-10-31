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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tenant_service_1 = require("../services/tenant.service");
const create_tenant_dto_1 = require("../dto/create-tenant.dto");
const tenant_entity_1 = require("../entities/tenant.entity");
let TenantController = class TenantController {
    constructor(tenantService) {
        this.tenantService = tenantService;
    }
    async createTenant(createTenantDto) {
        const tenant = await this.tenantService.createTenant(createTenantDto);
        return {
            tenant,
            message: 'Tenant created successfully. Database provisioning in progress.'
        };
    }
    async getAllTenants() {
        return this.tenantService.getAllTenants();
    }
    async getTenantById(id) {
        return this.tenantService.findById(id);
    }
    async getTenantBySubdomain(subdomain) {
        return this.tenantService.findBySubdomain(subdomain);
    }
    async updateTenantStatus(id, status) {
        return this.tenantService.updateTenantStatus(id, status);
    }
    async deleteTenant(id) {
        await this.tenantService.deleteTenant(id);
        return { message: 'Tenant deleted successfully' };
    }
    async checkTenantHealth(id) {
        const tenant = await this.tenantService.findById(id);
        return {
            status: tenant.status,
            database: tenant.connectionString ? 'connected' : 'not_connected'
        };
    }
};
exports.TenantController = TenantController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create new tenant' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Tenant created successfully' }),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tenant_dto_1.CreateTenantDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createTenant", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all tenants' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of all tenants' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getAllTenants", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getTenantById", null);
__decorate([
    (0, common_1.Get)('subdomain/:subdomain'),
    __param(0, (0, common_1.Param)('subdomain')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getTenantBySubdomain", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateTenantStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "deleteTenant", null);
__decorate([
    (0, common_1.Get)(':id/health'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "checkTenantHealth", null);
exports.TenantController = TenantController = __decorate([
    (0, swagger_1.ApiTags)('tenants'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('tenants'),
    __metadata("design:paramtypes", [tenant_service_1.TenantService])
], TenantController);
//# sourceMappingURL=tenant.controller.js.map