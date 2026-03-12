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
const schedule_1 = require("@nestjs/schedule");
const tenant_entity_1 = require("../entities/tenant.entity");
const database_provisioning_service_1 = require("./database-provisioning.service");
const FULL_EHR_CORE_MODULES = ['finance', 'nurse_general'];
const CLAIMS_ONLY_CORE_MODULES = ['claims'];
const ALL_MODULE_KEYS = [
    ...FULL_EHR_CORE_MODULES,
    ...CLAIMS_ONLY_CORE_MODULES,
    'hiv',
    'maternity',
    'radiology',
    'oncology',
    'cardiology',
    'diabetes',
    'pharmacy',
    'laboratory',
    'telemedicine',
    'patient_portal',
    'claims',
    'operating_room',
    'emergency',
    'ophthalmology',
    'blood_bank',
    'infection_control',
    'revenue_cycle',
    'population_health',
];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
let TenantService = TenantService_1 = class TenantService {
    constructor(tenantRepository, databaseProvisioningService) {
        this.tenantRepository = tenantRepository;
        this.databaseProvisioningService = databaseProvisioningService;
        this.logger = new common_1.Logger(TenantService_1.name);
    }
    async onModuleInit() {
        await this.ensureSubscriptionSchema();
        const tenants = await this.tenantRepository.find();
        for (const tenant of tenants) {
            const normalized = this.applyLifecycleState(tenant);
            if (normalized) {
                await this.tenantRepository.save(tenant);
            }
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
    async reconcileTenantLifecycle() {
        await this.ensureSubscriptionSchema();
        const tenants = await this.tenantRepository.find();
        const now = new Date();
        for (const tenant of tenants) {
            if (tenant.subscriptionMode === 'demo' && tenant.autoDeleteAt && tenant.autoDeleteAt.getTime() <= now.getTime()) {
                this.logger.warn(`Auto-deleting expired demo tenant ${tenant.id} (${tenant.subdomain})`);
                await this.deleteTenant(tenant.id);
                continue;
            }
            if (this.applyLifecycleState(tenant, now)) {
                await this.tenantRepository.save(tenant);
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
        const packagePreset = this.resolvePackagePreset(createTenantDto);
        const enabledModules = this.normalizeEnabledModules(createTenantDto.enabledModules, packagePreset);
        const subscription = this.resolveSubscriptionFields(createTenantDto);
        const tenant = this.tenantRepository.create({
            ...createTenantDto,
            databaseName,
            status: tenant_entity_1.TenantStatus.PENDING,
            subscriptionMode: subscription.subscriptionMode,
            packagePreset,
            subscriptionState: subscription.subscriptionState,
            packageName: subscription.packageName,
            enabledModules,
            billingEndsAt: subscription.billingEndsAt,
            demoExpiresAt: subscription.demoExpiresAt,
            graceEndsAt: subscription.graceEndsAt,
            autoDeleteAt: subscription.autoDeleteAt,
            suspensionWarningDays: subscription.suspensionWarningDays,
            featureFlags: this.getDefaultFeatureFlags(createTenantDto.subscriptionTier, enabledModules, packagePreset),
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
            const message = error instanceof Error ? error.message : String(error);
            throw new common_1.InternalServerErrorException(`Tenant provisioning failed for ${savedTenant.subdomain}. Tenant has been suspended pending repair. ${message}`);
        }
        return savedTenant;
    }
    async updateTenant(id, updateData) {
        const tenant = await this.findById(id);
        const nextTier = updateData.subscriptionTier || tenant.subscriptionTier;
        const packagePreset = this.resolvePackagePreset(updateData, tenant);
        const enabledModules = this.normalizeEnabledModules(updateData.enabledModules ?? tenant.enabledModules, packagePreset);
        const subscription = this.resolveSubscriptionFields(updateData, tenant);
        Object.assign(tenant, {
            ...updateData,
            enabledModules,
            subscriptionMode: subscription.subscriptionMode,
            packagePreset,
            subscriptionState: subscription.subscriptionState,
            packageName: subscription.packageName,
            billingEndsAt: subscription.billingEndsAt,
            demoExpiresAt: subscription.demoExpiresAt,
            graceEndsAt: subscription.graceEndsAt,
            autoDeleteAt: subscription.autoDeleteAt,
            suspensionWarningDays: subscription.suspensionWarningDays,
        });
        tenant.featureFlags = {
            ...tenant.featureFlags,
            ...this.getDefaultFeatureFlags(nextTier, enabledModules, packagePreset),
        };
        this.applyLifecycleState(tenant);
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
        if (status === tenant_entity_1.TenantStatus.SUSPENDED) {
            tenant.subscriptionState = 'suspended';
        }
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
    getBillingSummary(tenant) {
        const now = new Date();
        const warningDays = Number(tenant.suspensionWarningDays || 5);
        const packagePreset = tenant.packagePreset || 'full_ehr';
        const enabledModules = this.normalizeEnabledModules(tenant.enabledModules, packagePreset);
        const mode = tenant.subscriptionMode === 'demo' ? 'demo' : 'paid';
        const accessEndsAt = mode === 'demo' ? tenant.demoExpiresAt : tenant.billingEndsAt;
        const suspensionAt = mode === 'demo' ? tenant.demoExpiresAt : tenant.graceEndsAt || tenant.billingEndsAt;
        const daysRemaining = accessEndsAt ? this.diffInDays(accessEndsAt, now) : null;
        const daysUntilSuspension = suspensionAt ? this.diffInDays(suspensionAt, now) : null;
        const overdueDays = daysRemaining !== null && daysRemaining < 0 ? Math.abs(daysRemaining) : 0;
        let tone = 'good';
        if (tenant.subscriptionState === 'suspended' || tenant.subscriptionState === 'expired') {
            tone = 'expired';
        }
        else if ((daysUntilSuspension ?? 999) <= 0 || tenant.subscriptionState === 'grace') {
            tone = 'critical';
        }
        else if ((daysUntilSuspension ?? 999) <= warningDays) {
            tone = 'warning';
        }
        const label = mode === 'demo'
            ? tenant.subscriptionState === 'expired'
                ? 'Demo expired'
                : 'Demo access'
            : tenant.subscriptionState === 'grace'
                ? 'Grace period'
                : tenant.subscriptionState === 'suspended'
                    ? 'Suspended'
                    : 'Subscription';
        const message = mode === 'demo'
            ? daysUntilSuspension !== null && daysUntilSuspension >= 0
                ? `Demo tenant auto-deletes in ${daysUntilSuspension} day${daysUntilSuspension === 1 ? '' : 's'}.`
                : `Demo expired${overdueDays ? ` ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago` : ''}. Tenant pending deletion.`
            : tenant.subscriptionState === 'grace'
                ? `Payment overdue. ${Math.max(daysUntilSuspension ?? 0, 0)} day${Math.max(daysUntilSuspension ?? 0, 0) === 1 ? '' : 's'} left before suspension.`
                : tenant.subscriptionState === 'suspended'
                    ? `Account suspended for non-payment${overdueDays ? ` (${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue)` : ''}.`
                    : daysUntilSuspension !== null
                        ? `${daysUntilSuspension} day${daysUntilSuspension === 1 ? '' : 's'} of credit remaining before suspension window.`
                        : 'Subscription status available.';
        return {
            mode,
            packagePreset,
            state: tenant.subscriptionState,
            packageName: tenant.packageName || null,
            accessEndsAt: accessEndsAt ? accessEndsAt.toISOString() : null,
            suspensionAt: suspensionAt ? suspensionAt.toISOString() : null,
            autoDeleteAt: tenant.autoDeleteAt ? tenant.autoDeleteAt.toISOString() : null,
            daysRemaining,
            daysUntilSuspension,
            overdueDays,
            warningDays,
            tone,
            label,
            message,
            enabledModules,
            coreModules: [...this.getCoreModulesForPreset(packagePreset)],
        };
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
    getCoreModulesForPreset(packagePreset) {
        return packagePreset === 'claims_only'
            ? [...CLAIMS_ONLY_CORE_MODULES]
            : [...FULL_EHR_CORE_MODULES];
    }
    getDefaultFeatureFlags(tier, enabledModules, packagePreset) {
        const baseFeatures = packagePreset === 'claims_only'
            ? {
                patientManagement: false,
                appointments: false,
                medicalRecords: false,
                basicBilling: false,
                medicalAidClaims: true,
            }
            : {
                patientManagement: true,
                appointments: true,
                medicalRecords: true,
                basicBilling: true,
            };
        let tierFeatures = {};
        if (packagePreset !== 'claims_only') {
            switch (tier) {
                case tenant_entity_1.SubscriptionTier.PROFESSIONAL:
                    tierFeatures = {
                        medicalAidClaims: true,
                        basicCDSS: true,
                        fhirIntegration: true,
                        patientPortal: true,
                    };
                    break;
                case tenant_entity_1.SubscriptionTier.ENTERPRISE:
                    tierFeatures = {
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
                    break;
                default:
                    break;
            }
        }
        const moduleFlags = enabledModules.reduce((acc, moduleKey) => {
            acc[`module:${moduleKey}`] = true;
            if (moduleKey === 'telemedicine')
                acc.telemedicine = true;
            if (moduleKey === 'patient_portal')
                acc.patientPortal = true;
            if (moduleKey === 'claims')
                acc.medicalAidClaims = true;
            return acc;
        }, {});
        return {
            ...baseFeatures,
            ...tierFeatures,
            ...moduleFlags,
        };
    }
    resolvePackagePreset(input, existing) {
        const requestedPreset = input.packagePreset || existing?.packagePreset;
        if (requestedPreset === 'claims_only' && (input.subscriptionMode || existing?.subscriptionMode || 'paid') === 'paid') {
            return 'claims_only';
        }
        if ((input.subscriptionMode || existing?.subscriptionMode || 'paid') === 'paid') {
            const moduleKeys = new Set((input.enabledModules || existing?.enabledModules || []).map((item) => String(item || '').trim().toLowerCase()));
            if (moduleKeys.size > 0 && Array.from(moduleKeys).every((key) => key === 'claims')) {
                return 'claims_only';
            }
        }
        return 'full_ehr';
    }
    normalizeEnabledModules(input, packagePreset = 'full_ehr') {
        const allowed = new Set(ALL_MODULE_KEYS);
        const normalized = new Set(this.getCoreModulesForPreset(packagePreset));
        for (const raw of input || []) {
            const key = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
            if (allowed.has(key)) {
                if (packagePreset === 'claims_only' && key !== 'claims') {
                    continue;
                }
                normalized.add(key);
            }
        }
        return Array.from(normalized.values()).sort();
    }
    resolveSubscriptionFields(input, existing) {
        const now = new Date();
        const subscriptionMode = input.subscriptionMode || existing?.subscriptionMode || 'paid';
        const packagePreset = this.resolvePackagePreset(input, existing);
        const packageName = input.packageName?.trim() ||
            existing?.packageName ||
            (subscriptionMode === 'demo'
                ? 'Guided Demo'
                : packagePreset === 'claims_only'
                    ? 'Claims Only'
                    : 'Module Subscription');
        const suspensionWarningDays = Number(input.suspensionWarningDays ?? existing?.suspensionWarningDays ?? 5);
        const gracePeriodDays = Number(input.gracePeriodDays ?? this.inferGracePeriodDays(existing) ?? 5);
        if (subscriptionMode === 'demo') {
            const demoDurationDays = Number(input.demoDurationDays || 14);
            const demoExpiresAt = input.demoExpiresAt !== undefined
                ? new Date(input.demoExpiresAt)
                : input.demoDurationDays !== undefined
                    ? new Date(now.getTime() + demoDurationDays * ONE_DAY_MS)
                    : existing?.demoExpiresAt || new Date(now.getTime() + demoDurationDays * ONE_DAY_MS);
            const autoDeleteAt = new Date(demoExpiresAt.getTime());
            const temp = {
                subscriptionMode,
                subscriptionState: 'demo',
                packageName,
                billingEndsAt: null,
                demoExpiresAt,
                graceEndsAt: null,
                autoDeleteAt,
                suspensionWarningDays,
            };
            temp.subscriptionState = this.computeLifecycleState(temp, now);
            return temp;
        }
        const billingEndsAt = input.billingEndsAt !== undefined
            ? new Date(input.billingEndsAt)
            : existing?.billingEndsAt || new Date(now.getTime() + 30 * ONE_DAY_MS);
        const graceEndsAt = new Date(billingEndsAt.getTime() + Math.max(gracePeriodDays, 0) * ONE_DAY_MS);
        const temp = {
            subscriptionMode,
            subscriptionState: 'active',
            packageName,
            billingEndsAt,
            demoExpiresAt: null,
            graceEndsAt,
            autoDeleteAt: null,
            suspensionWarningDays,
        };
        temp.subscriptionState = this.computeLifecycleState(temp, now);
        return temp;
    }
    inferGracePeriodDays(existing) {
        if (!existing?.billingEndsAt || !existing?.graceEndsAt) {
            return null;
        }
        return Math.max(0, Math.round((existing.graceEndsAt.getTime() - existing.billingEndsAt.getTime()) / ONE_DAY_MS));
    }
    applyLifecycleState(tenant, now = new Date()) {
        const nextState = this.computeLifecycleState(tenant, now);
        let changed = false;
        if (tenant.subscriptionState !== nextState) {
            tenant.subscriptionState = nextState;
            changed = true;
        }
        if (tenant.status !== tenant_entity_1.TenantStatus.CANCELLED) {
            const shouldBeSuspended = nextState === 'suspended' || nextState === 'expired';
            const nextStatus = shouldBeSuspended ? tenant_entity_1.TenantStatus.SUSPENDED : tenant.connectionString ? tenant_entity_1.TenantStatus.ACTIVE : tenant.status;
            if (tenant.status !== nextStatus) {
                tenant.status = nextStatus;
                changed = true;
            }
        }
        return changed;
    }
    computeLifecycleState(tenant, now = new Date()) {
        if (tenant.subscriptionMode === 'demo') {
            if (!tenant.demoExpiresAt) {
                return 'demo';
            }
            return tenant.demoExpiresAt.getTime() >= now.getTime() ? 'demo' : 'expired';
        }
        if (tenant.billingEndsAt && tenant.billingEndsAt.getTime() >= now.getTime()) {
            return 'active';
        }
        if (tenant.graceEndsAt && tenant.graceEndsAt.getTime() >= now.getTime()) {
            return 'grace';
        }
        return 'suspended';
    }
    diffInDays(target, now = new Date()) {
        return Math.ceil((target.getTime() - now.getTime()) / ONE_DAY_MS);
    }
    async ensureSubscriptionSchema() {
        await this.tenantRepository.query(`
      ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS "subscriptionMode" VARCHAR(20) NOT NULL DEFAULT 'paid',
      ADD COLUMN IF NOT EXISTS "packagePreset" VARCHAR(20) NOT NULL DEFAULT 'full_ehr',
      ADD COLUMN IF NOT EXISTS "subscriptionState" VARCHAR(20) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS "packageName" VARCHAR(120),
      ADD COLUMN IF NOT EXISTS "enabledModules" JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "billingEndsAt" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "autoDeleteAt" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "suspensionWarningDays" INTEGER NOT NULL DEFAULT 5
    `);
        await this.tenantRepository.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'subscription_mode'
        ) THEN
          EXECUTE 'UPDATE tenants SET "subscriptionMode" = COALESCE("subscriptionMode", subscription_mode)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'packagePreset'
        ) THEN
          EXECUTE 'UPDATE tenants SET "packagePreset" = COALESCE("packagePreset", ''full_ehr'')';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'package_preset'
        ) THEN
          EXECUTE 'UPDATE tenants SET "packagePreset" = COALESCE("packagePreset", package_preset)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'subscription_state'
        ) THEN
          EXECUTE 'UPDATE tenants SET "subscriptionState" = COALESCE("subscriptionState", subscription_state)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'package_name'
        ) THEN
          EXECUTE 'UPDATE tenants SET "packageName" = COALESCE("packageName", package_name)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'enabled_modules'
        ) THEN
          EXECUTE 'UPDATE tenants SET "enabledModules" = COALESCE("enabledModules", enabled_modules)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'billing_ends_at'
        ) THEN
          EXECUTE 'UPDATE tenants SET "billingEndsAt" = COALESCE("billingEndsAt", billing_ends_at)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'demo_expires_at'
        ) THEN
          EXECUTE 'UPDATE tenants SET "demoExpiresAt" = COALESCE("demoExpiresAt", demo_expires_at)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'grace_ends_at'
        ) THEN
          EXECUTE 'UPDATE tenants SET "graceEndsAt" = COALESCE("graceEndsAt", grace_ends_at)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'auto_delete_at'
        ) THEN
          EXECUTE 'UPDATE tenants SET "autoDeleteAt" = COALESCE("autoDeleteAt", auto_delete_at)';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'suspension_warning_days'
        ) THEN
          EXECUTE 'UPDATE tenants SET "suspensionWarningDays" = COALESCE("suspensionWarningDays", suspension_warning_days)';
        END IF;
      END $$;
    `);
        await this.tenantRepository.query(`
      UPDATE tenants
      SET "enabledModules" = '["finance","nurse_general"]'::jsonb
      WHERE "enabledModules" IS NULL OR "enabledModules" = 'null'::jsonb
    `);
        await this.tenantRepository.query(`
      UPDATE tenants
      SET "packagePreset" = 'full_ehr'
      WHERE "packagePreset" IS NULL
    `);
        await this.tenantRepository.query(`
      UPDATE tenants
      SET "packagePreset" = 'claims_only',
          "enabledModules" = '["claims"]'::jsonb
      WHERE "packagePreset" = 'claims_only'
    `);
    }
};
exports.TenantService = TenantService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TenantService.prototype, "reconcileTenantLifecycle", null);
exports.TenantService = TenantService = TenantService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tenant_entity_1.Tenant)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        database_provisioning_service_1.DatabaseProvisioningService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map