import { Injectable, ConflictException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus, SubscriptionTier } from '../entities/tenant.entity';
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

@Injectable()
export class TenantService implements OnModuleInit {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private databaseProvisioningService: DatabaseProvisioningService,
  ) {}

  async onModuleInit(): Promise<void> {
    const tenants = await this.tenantRepository.find();
    for (const tenant of tenants) {
      if (!tenant.databaseName) {
        continue;
      }

      try {
        await this.databaseProvisioningService.applySnomedUpgradesToTenant(tenant.databaseName);
      } catch (error) {
        this.logger.warn(
          `Failed to auto-apply SNOMED schema for tenant ${tenant.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Check if subdomain already exists
    const existingTenant = await this.tenantRepository.findOne({
      where: { subdomain: createTenantDto.subdomain }
    });

    if (existingTenant) {
      throw new ConflictException('Subdomain already exists');
    }

    // Generate database name
    const databaseName = `clinic_${createTenantDto.subdomain}_db`;

    // Create tenant record
    const tenant = this.tenantRepository.create({
      ...createTenantDto,
      databaseName,
      status: TenantStatus.PENDING,
      featureFlags: this.getDefaultFeatureFlags(createTenantDto.subscriptionTier),
    });

    const savedTenant = await this.tenantRepository.save(tenant);
    this.logger.log(`Tenant created: ${savedTenant.id}`);

    // Provision database synchronously to ensure it completes
    try {
      await this.provisionTenantDatabase(savedTenant);
    } catch (error) {
      this.logger.error(`Database provisioning failed for tenant ${savedTenant.id}:`, error);
      // Update tenant status to suspended on failure
      savedTenant.status = TenantStatus.SUSPENDED;
      await this.tenantRepository.save(savedTenant);
    }

    return savedTenant;
  }

  async updateTenant(id: string, updateData: Partial<Tenant>): Promise<Tenant> {
    const tenant = await this.findById(id);
    
    // Update fields
    Object.assign(tenant, updateData);
    
    // If subscription tier changed, we might need to update feature flags
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

  async findBySubdomain(subdomain: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { subdomain, status: TenantStatus.ACTIVE }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async updateTenantStatus(id: string, status: TenantStatus): Promise<Tenant> {
    const tenant = await this.findById(id);
    tenant.status = status;
    return this.tenantRepository.save(tenant);
  }

  async deleteTenant(id: string): Promise<void> {
    const tenant = await this.findById(id);
    
    // Delete tenant database
    if (tenant.databaseName) {
      await this.databaseProvisioningService.deleteDatabase(tenant.databaseName);
    }
    
    // Delete tenant record
    await this.tenantRepository.remove(tenant);
    this.logger.log(`Tenant deleted: ${id}`);
  }

  async getTenantDhis2Config(tenantId: string): Promise<TenantDhis2ConfigView | null> {
    await this.findById(tenantId);

    const rows = await this.tenantRepository.query(
      `
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
      `,
      [tenantId],
    );

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

  async upsertTenantDhis2Config(
    tenantId: string,
    payload: TenantDhis2ConfigPayload,
  ): Promise<TenantDhis2ConfigView> {
    await this.findById(tenantId);
    const existingConfig = await this.getTenantDhis2Config(tenantId);
    const existingSecretRows: Array<{
      auth_type: string;
      pat: string | null;
      username: string | null;
      password: string | null;
    }> = await this.tenantRepository.query(
      `
      SELECT auth_type, pat, username, password
      FROM tenant_dhis2_config
      WHERE tenant_id = $1
      LIMIT 1
      `,
      [tenantId],
    );
    const existingSecret = existingSecretRows[0];

    const baseUrl = String(payload.baseUrl || '').trim();
    const orgUnitId = String(payload.orgUnitId || '').trim();
    const authType =
      payload.authType === 'basic'
        ? 'basic'
        : payload.authType === 'pat'
          ? 'pat'
          : existingSecret?.auth_type === 'basic'
            ? 'basic'
            : 'pat';
    const apiVersion = String(payload.apiVersion || '40').trim();
    const enabled =
      payload.enabled === undefined ? Boolean(existingConfig?.enabled ?? true) : payload.enabled !== false;
    const scheduledSyncEnabled =
      payload.scheduledSyncEnabled === undefined
        ? Boolean(existingConfig?.scheduledSyncEnabled ?? false)
        : payload.scheduledSyncEnabled === true;
    const scheduledRetryLimit = Math.min(
      Math.max(Number(payload.scheduledRetryLimit ?? existingConfig?.scheduledRetryLimit ?? 20), 1),
      200,
    );
    const alertLookbackHours = Math.min(
      Math.max(Number(payload.alertLookbackHours ?? existingConfig?.alertLookbackHours ?? 24), 1),
      720,
    );
    const alertErrorThreshold = Math.min(
      Math.max(Number(payload.alertErrorThreshold ?? existingConfig?.alertErrorThreshold ?? 10), 1),
      10000,
    );
    const alertWebhookUrl =
      payload.alertWebhookUrl === undefined
        ? existingConfig?.alertWebhookUrl ?? null
        : payload.alertWebhookUrl
          ? String(payload.alertWebhookUrl).trim()
          : null;
    const resolvedPat =
      payload.pat !== undefined
        ? String(payload.pat || '').trim() || null
        : existingSecret?.pat
          ? String(existingSecret.pat)
          : null;
    const resolvedUsername =
      payload.username !== undefined
        ? String(payload.username || '').trim() || null
        : existingSecret?.username
          ? String(existingSecret.username)
          : null;
    const resolvedPassword =
      payload.password !== undefined
        ? String(payload.password || '').trim() || null
        : existingSecret?.password
          ? String(existingSecret.password)
          : null;
    const patValue = authType === 'pat' ? resolvedPat : null;
    const usernameValue = authType === 'basic' ? resolvedUsername : null;
    const passwordValue = authType === 'basic' ? resolvedPassword : null;

    if (!baseUrl) {
      throw new ConflictException('baseUrl is required');
    }
    if (!orgUnitId) {
      throw new ConflictException('orgUnitId is required');
    }

    if (authType === 'pat' && (!patValue || String(patValue).trim().length === 0)) {
      throw new ConflictException('PAT is required when authType is pat');
    }
    if (
      authType === 'basic' &&
      (!usernameValue || !passwordValue || !String(usernameValue).trim() || !String(passwordValue).trim())
    ) {
      throw new ConflictException('username and password are required when authType is basic');
    }

    await this.tenantRepository.query(
      `
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
      `,
      [
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
      ],
    );

    const view = await this.getTenantDhis2Config(tenantId);
    if (!view) {
      throw new ConflictException('Failed to load saved DHIS2 config');
    }
    return view;
  }

  async clearTenantDhis2Config(tenantId: string): Promise<void> {
    await this.findById(tenantId);
    await this.tenantRepository.query(`DELETE FROM tenant_dhis2_config WHERE tenant_id = $1`, [tenantId]);
  }

  private async provisionTenantDatabase(tenant: Tenant): Promise<void> {
    try {
      this.logger.log(`Starting database provisioning for tenant: ${tenant.id}`);
      
      // Create database and run migrations
      const connectionString = await this.databaseProvisioningService.createDatabase(
        tenant.databaseName
      );

      // Update tenant with connection string and activate
      tenant.connectionString = connectionString;
      tenant.status = TenantStatus.ACTIVE;
      await this.tenantRepository.save(tenant);

      this.logger.log(`Database provisioning completed for tenant: ${tenant.id}`);

    } catch (error) {
      // Mark tenant as suspended on failure
      tenant.status = TenantStatus.SUSPENDED;
      await this.tenantRepository.save(tenant);
      
      this.logger.error(`Database provisioning failed for tenant: ${tenant.id}`, error);
      throw error;
    }
  }

  private getDefaultFeatureFlags(tier: SubscriptionTier): Record<string, boolean> {
    const baseFeatures = {
      patientManagement: true,
      appointments: true,
      medicalRecords: true,
      basicBilling: true,
    };

    switch (tier) {
      case SubscriptionTier.PROFESSIONAL:
        return {
          ...baseFeatures,
          medicalAidClaims: true,
          basicCDSS: true,
          fhirIntegration: true,
          patientPortal: true,
        };
      case SubscriptionTier.ENTERPRISE:
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
}
