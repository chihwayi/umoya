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
    async updateTenant(id, updateData) {
        const tenant = await this.findById(id);
        Object.assign(tenant, updateData);
        if (updateData.subscriptionTier) {
            tenant.featureFlags = {
                ...tenant.featureFlags,
                ...this.getDefaultFeatureFlags(updateData.subscriptionTier)
            };
        }
        const savedTenant = await this.tenantRepository.save(tenant);
        this.logger.log(`Tenant updated: ${savedTenant.id}`);
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
    async getTenantDhis2Config(tenantId) {
        await this.findById(tenantId);
        const rows = await this.tenantRepository.query(`
      SELECT
        tenant_id,
        base_url,
        COALESCE(api_version, '40') AS api_version,
        COALESCE(auth_type, 'pat') AS auth_type,
        pat,
        username,
        org_unit_id,
        tracked_entity_type_id,
        dataset_id,
        COALESCE(enabled, true) AS enabled,
        COALESCE(scheduled_sync_enabled, false) AS scheduled_sync_enabled,
        COALESCE(scheduled_retry_limit, 20) AS scheduled_retry_limit,
        COALESCE(alert_lookback_hours, 24) AS alert_lookback_hours,
        COALESCE(alert_error_threshold, 10) AS alert_error_threshold,
        alert_webhook_url,
        updated_at
      FROM tenant_dhis2_config
      WHERE tenant_id = $1
      LIMIT 1
      `, [tenantId]);
        if (!rows || rows.length === 0) {
            return null;
        }
        const row = rows[0];
        const pat = row.pat ? String(row.pat) : '';
        const patMasked = pat.length >= 8 ? `${pat.slice(0, 6)}...${pat.slice(-4)}` : pat || null;
        return {
            tenantId: row.tenant_id,
            baseUrl: row.base_url,
            apiVersion: String(row.api_version || '40'),
            authType: row.auth_type === 'basic' ? 'basic' : 'pat',
            hasPat: Boolean(pat),
            patMasked,
            username: row.username ?? null,
            orgUnitId: row.org_unit_id,
            trackedEntityTypeId: row.tracked_entity_type_id ?? null,
            datasetId: row.dataset_id ?? null,
            enabled: Boolean(row.enabled),
            scheduledSyncEnabled: Boolean(row.scheduled_sync_enabled),
            scheduledRetryLimit: Number(row.scheduled_retry_limit || 20),
            alertLookbackHours: Number(row.alert_lookback_hours || 24),
            alertErrorThreshold: Number(row.alert_error_threshold || 10),
            alertWebhookUrl: row.alert_webhook_url ?? null,
            updatedAt: row.updated_at ? String(row.updated_at) : null,
        };
    }
    async upsertTenantDhis2Config(tenantId, payload) {
        await this.findById(tenantId);
        const existingConfig = await this.getTenantDhis2Config(tenantId);
        const existingSecretRows = await this.tenantRepository.query(`
      SELECT auth_type, pat, username, password
      FROM tenant_dhis2_config
      WHERE tenant_id = $1
      LIMIT 1
      `, [tenantId]);
        const existingSecret = existingSecretRows[0];
        const baseUrl = String(payload.baseUrl || '').trim();
        const orgUnitId = String(payload.orgUnitId || '').trim();
        const authType = payload.authType === 'basic'
            ? 'basic'
            : payload.authType === 'pat'
                ? 'pat'
                : existingSecret?.auth_type === 'basic'
                    ? 'basic'
                    : 'pat';
        const apiVersion = String(payload.apiVersion || '40').trim();
        const enabled = payload.enabled === undefined ? Boolean(existingConfig?.enabled ?? true) : payload.enabled !== false;
        const scheduledSyncEnabled = payload.scheduledSyncEnabled === undefined
            ? Boolean(existingConfig?.scheduledSyncEnabled ?? false)
            : payload.scheduledSyncEnabled === true;
        const scheduledRetryLimit = Math.min(Math.max(Number(payload.scheduledRetryLimit ?? existingConfig?.scheduledRetryLimit ?? 20), 1), 200);
        const alertLookbackHours = Math.min(Math.max(Number(payload.alertLookbackHours ?? existingConfig?.alertLookbackHours ?? 24), 1), 720);
        const alertErrorThreshold = Math.min(Math.max(Number(payload.alertErrorThreshold ?? existingConfig?.alertErrorThreshold ?? 10), 1), 10000);
        const alertWebhookUrl = payload.alertWebhookUrl === undefined
            ? existingConfig?.alertWebhookUrl ?? null
            : payload.alertWebhookUrl
                ? String(payload.alertWebhookUrl).trim()
                : null;
        const resolvedPat = payload.pat !== undefined
            ? String(payload.pat || '').trim() || null
            : existingSecret?.pat
                ? String(existingSecret.pat)
                : null;
        const resolvedUsername = payload.username !== undefined
            ? String(payload.username || '').trim() || null
            : existingSecret?.username
                ? String(existingSecret.username)
                : null;
        const resolvedPassword = payload.password !== undefined
            ? String(payload.password || '').trim() || null
            : existingSecret?.password
                ? String(existingSecret.password)
                : null;
        const patValue = authType === 'pat' ? resolvedPat : null;
        const usernameValue = authType === 'basic' ? resolvedUsername : null;
        const passwordValue = authType === 'basic' ? resolvedPassword : null;
        if (!baseUrl) {
            throw new common_1.ConflictException('baseUrl is required');
        }
        if (!orgUnitId) {
            throw new common_1.ConflictException('orgUnitId is required');
        }
        if (authType === 'pat' && (!patValue || String(patValue).trim().length === 0)) {
            throw new common_1.ConflictException('PAT is required when authType is pat');
        }
        if (authType === 'basic' &&
            (!usernameValue || !passwordValue || !String(usernameValue).trim() || !String(passwordValue).trim())) {
            throw new common_1.ConflictException('username and password are required when authType is basic');
        }
        await this.tenantRepository.query(`
      INSERT INTO tenant_dhis2_config (
        tenant_id,
        base_url,
        api_version,
        auth_type,
        pat,
        username,
        password,
        org_unit_id,
        tracked_entity_type_id,
        dataset_id,
        enabled,
        scheduled_sync_enabled,
        scheduled_retry_limit,
        alert_lookback_hours,
        alert_error_threshold,
        alert_webhook_url,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        base_url = EXCLUDED.base_url,
        api_version = EXCLUDED.api_version,
        auth_type = EXCLUDED.auth_type,
        pat = EXCLUDED.pat,
        username = EXCLUDED.username,
        password = EXCLUDED.password,
        org_unit_id = EXCLUDED.org_unit_id,
        tracked_entity_type_id = EXCLUDED.tracked_entity_type_id,
        dataset_id = EXCLUDED.dataset_id,
        enabled = EXCLUDED.enabled,
        scheduled_sync_enabled = EXCLUDED.scheduled_sync_enabled,
        scheduled_retry_limit = EXCLUDED.scheduled_retry_limit,
        alert_lookback_hours = EXCLUDED.alert_lookback_hours,
        alert_error_threshold = EXCLUDED.alert_error_threshold,
        alert_webhook_url = EXCLUDED.alert_webhook_url,
        updated_at = NOW()
      `, [
            tenantId,
            baseUrl,
            apiVersion,
            authType,
            patValue,
            usernameValue,
            passwordValue,
            orgUnitId,
            payload.trackedEntityTypeId ?? null,
            payload.datasetId ?? null,
            enabled,
            scheduledSyncEnabled,
            scheduledRetryLimit,
            alertLookbackHours,
            alertErrorThreshold,
            alertWebhookUrl,
        ]);
        const view = await this.getTenantDhis2Config(tenantId);
        if (!view) {
            throw new common_1.ConflictException('Failed to load saved DHIS2 config');
        }
        return view;
    }
    async clearTenantDhis2Config(tenantId) {
        await this.findById(tenantId);
        await this.tenantRepository.query(`DELETE FROM tenant_dhis2_config WHERE tenant_id = $1`, [tenantId]);
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