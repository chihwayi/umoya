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
const platform_express_1 = require("@nestjs/platform-express");
const tenant_service_1 = require("../services/tenant.service");
const storage_service_1 = require("../services/storage.service");
const create_tenant_dto_1 = require("../dto/create-tenant.dto");
const update_tenant_dto_1 = require("../dto/update-tenant.dto");
const tenant_entity_1 = require("../entities/tenant.entity");
const jwt_auth_guard_1 = require("../guards/jwt-auth.guard");
let TenantController = class TenantController {
    constructor(tenantService, storageService) {
        this.tenantService = tenantService;
        this.storageService = storageService;
    }
    toSafeTenant(tenant) {
        const { connectionString, ...safeTenant } = tenant;
        return {
            ...safeTenant,
            billingSummary: this.tenantService.getBillingSummary(tenant),
        };
    }
    toPublicTenant(tenant) {
        return {
            id: tenant.id,
            subdomain: tenant.subdomain,
            clinicName: tenant.clinicName,
            status: tenant.status,
            logoUrl: tenant.logoUrl,
            enabledModules: tenant.enabledModules,
            subscriptionMode: tenant.subscriptionMode,
            packagePreset: tenant.packagePreset,
            subscriptionState: tenant.subscriptionState,
            packageName: tenant.packageName,
            billingSummary: this.tenantService.getBillingSummary(tenant),
        };
    }
    async uploadLogo(file) {
        const url = await this.storageService.uploadLogo(file);
        return { url };
    }
    async createTenant(createTenantDto) {
        const tenant = await this.tenantService.createTenant(createTenantDto);
        return {
            tenant: this.toSafeTenant(tenant),
            message: 'Tenant created successfully. Database provisioning in progress.'
        };
    }
    async getAllTenants() {
        const tenants = await this.tenantService.getAllTenants();
        return tenants.map((tenant) => this.toSafeTenant(tenant));
    }
    async getActiveTenants() {
        const tenants = await this.tenantService.getAllTenants();
        return tenants
            .filter((tenant) => tenant.status === tenant_entity_1.TenantStatus.ACTIVE)
            .map((tenant) => this.toPublicTenant(tenant));
    }
    async searchTenants(q) {
        if (!q || q.trim().length < 2)
            return [];
        return this.tenantService.searchTenants(q.trim());
    }
    async getTenantBySubdomain(subdomain) {
        const tenant = await this.tenantService.findBySubdomain(subdomain);
        return this.toPublicTenant(tenant);
    }
    async getTenantLogo(id, res) {
        const tenant = await this.tenantService.findById(id);
        if (!tenant.logoUrl) {
            throw new common_1.NotFoundException('Tenant logo not configured');
        }
        const file = await this.storageService.getObjectByPublicUrl(tenant.logoUrl);
        res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).send(file.body);
    }
    async getTenantById(id) {
        const tenant = await this.tenantService.findById(id);
        return this.toSafeTenant(tenant);
    }
    async updateTenant(id, updateTenantDto) {
        const tenant = await this.tenantService.updateTenant(id, updateTenantDto);
        return this.toSafeTenant(tenant);
    }
    async updateTenantStatus(id, status) {
        const tenant = await this.tenantService.updateTenantStatus(id, status);
        return this.toSafeTenant(tenant);
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
    async getTenantDhis2Config(id) {
        const config = await this.tenantService.getTenantDhis2Config(id);
        if (!config) {
            return { configured: false };
        }
        return config;
    }
    async upsertTenantDhis2Config(id, body) {
        return this.tenantService.upsertTenantDhis2Config(id, body);
    }
    async clearTenantDhis2Config(id) {
        await this.tenantService.clearTenantDhis2Config(id);
        return { message: 'Tenant DHIS2 config deleted' };
    }
    async getSubscriptionPaymentProviders(id) {
        await this.tenantService.findById(id);
        return this.tenantService.getSubscriptionPaymentProviders();
    }
    async getSubscriptionPayments(id, limit) {
        const parsedLimit = Number(limit);
        return this.tenantService.listSubscriptionPayments(id, Number.isFinite(parsedLimit) ? parsedLimit : undefined);
    }
    async createSubscriptionPaymentSession(id, body) {
        if (!body || !String(body.provider || '').trim()) {
            throw new common_1.BadRequestException('provider is required');
        }
        return this.tenantService.createSubscriptionPaymentSession(id, body);
    }
    async confirmSubscriptionPayment(id, paymentId, body) {
        return this.tenantService.confirmSubscriptionPayment(id, paymentId, body || { status: 'failed' });
    }
};
exports.TenantController = TenantController;
__decorate([
    (0, common_1.Post)('logo'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    }),
    (0, swagger_1.ApiOperation)({ summary: 'Upload tenant logo' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Logo uploaded successfully' }),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "uploadLogo", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Create new tenant' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Tenant created successfully' }),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tenant_dto_1.CreateTenantDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createTenant", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get all tenants' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of all tenants' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getAllTenants", null);
__decorate([
    (0, common_1.Get)('active'),
    (0, swagger_1.ApiOperation)({ summary: 'Get active tenants (public-safe payload)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of active tenants' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getActiveTenants", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({ summary: 'Search active tenants by name or subdomain (public — mobile discovery)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Matching tenants' }),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "searchTenants", null);
__decorate([
    (0, common_1.Get)('subdomain/:subdomain'),
    __param(0, (0, common_1.Param)('subdomain')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getTenantBySubdomain", null);
__decorate([
    (0, common_1.Get)(':id/logo'),
    (0, swagger_1.ApiOperation)({ summary: 'Stream tenant logo for mobile/web consumers' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getTenantLogo", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getTenantById", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Update tenant details' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tenant updated successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_tenant_dto_1.UpdateTenantDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateTenant", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateTenantStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "deleteTenant", null);
__decorate([
    (0, common_1.Get)(':id/health'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "checkTenantHealth", null);
__decorate([
    (0, common_1.Get)(':id/dhis2-config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get tenant DHIS2 integration config (secret-safe view)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getTenantDhis2Config", null);
__decorate([
    (0, common_1.Put)(':id/dhis2-config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Create/update tenant DHIS2 integration config' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "upsertTenantDhis2Config", null);
__decorate([
    (0, common_1.Delete)(':id/dhis2-config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Delete tenant DHIS2 integration config' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "clearTenantDhis2Config", null);
__decorate([
    (0, common_1.Get)(':id/subscription-payments/providers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get supported tenant subscription payment providers' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getSubscriptionPaymentProviders", null);
__decorate([
    (0, common_1.Get)(':id/subscription-payments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get tenant subscription payment history' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getSubscriptionPayments", null);
__decorate([
    (0, common_1.Post)(':id/subscription-payments/session'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Create online subscription payment session for tenant' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createSubscriptionPaymentSession", null);
__decorate([
    (0, common_1.Post)(':id/subscription-payments/:paymentId/confirm'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm/update tenant subscription payment status' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('paymentId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "confirmSubscriptionPayment", null);
exports.TenantController = TenantController = __decorate([
    (0, swagger_1.ApiTags)('tenants'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('tenants'),
    __metadata("design:paramtypes", [tenant_service_1.TenantService,
        storage_service_1.StorageService])
], TenantController);
//# sourceMappingURL=tenant.controller.js.map