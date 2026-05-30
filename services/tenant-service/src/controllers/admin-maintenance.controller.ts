import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DatabaseProvisioningService } from '../services/database-provisioning.service';
import { TenantService } from '../services/tenant.service';
import { HealthMonitorService } from '../services/health-monitor.service';
import { AdminRole } from '../entities/admin-user.entity';
import { PlatformServiceMonitorService } from '../services/platform-service-monitor.service';
import { RuntimeEndpointConfigService } from '../services/runtime-endpoint-config.service';
import { TenantDriftService } from '../services/tenant-drift.service';

@ApiTags('admin-maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminMaintenanceController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly provisioning: DatabaseProvisioningService,
    private readonly healthMonitor: HealthMonitorService,
    private readonly platformMonitor: PlatformServiceMonitorService,
    private readonly runtimeEndpointConfig: RuntimeEndpointConfigService,
    private readonly driftService: TenantDriftService,
  ) {}

  private assertRole(req: any, allowed: AdminRole[]) {
    const roleRaw = String(req?.user?.role || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const role =
      roleRaw === 'superadmin'
        ? AdminRole.SUPER_ADMIN
        : roleRaw === 'admin'
          ? AdminRole.ADMIN
          : roleRaw === 'support'
            ? AdminRole.SUPPORT
            : (roleRaw as AdminRole);
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException('Insufficient privileges for this operation');
    }
  }

  private buildTenantConnection(databaseName: string, existing?: string | null): string {
    if (existing && existing.trim().length > 0) {
      return existing;
    }
    const host = process.env.DB_HOST || 'postgres-master';
    const port = process.env.DB_PORT || '5432';
    const user = encodeURIComponent(process.env.DB_USERNAME || process.env.POSTGRES_USER || 'umoya');
    const pass = encodeURIComponent(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'umoya_password');
    return `postgresql://${user}:${pass}@${host}:${port}/${databaseName}`;
  }

  @Post('tenants/:id/repair')
  async repairTenant(@Param('id') id: string) {
    const tenant = await this.tenantService.findById(id);
    const connection = this.buildTenantConnection(tenant.databaseName, tenant.connectionString);
    await this.provisioning.applyClinicSchema(connection);
    return { message: 'Schema applied', tenantId: id, tenantName: tenant.clinicName };
  }

  // @UseGuards(JwtAuthGuard)
  @Post('tenants/repair-all')
  async repairAllTenants() {
    await this.provisioning.ensureSystemSecuritySchema();
    const tenants = await this.tenantService.findAll();
    for (const tenant of tenants) {
      const connection = this.buildTenantConnection(tenant.databaseName, tenant.connectionString);
      await this.provisioning.applyClinicSchema(connection);
    }
    return { message: 'Schema applied to all tenants', count: tenants.length };
  }

  @Post('tenants/:id/apply-sprint5')
  async applySprint5ToTenant(@Param('id') id: string) {
    const tenant = await this.tenantService.findById(id);
    const connection = this.buildTenantConnection(tenant.databaseName, tenant.connectionString);
    await this.provisioning.applyClinicSchema(connection, { bundles: ['sprint5_features'] });
    return { message: 'Sprint 5 features applied', tenantId: id, tenantName: tenant.clinicName };
  }

  @Post('tenants/apply-sprint5-all')
  async applySprint5ToAllTenants() {
    const tenants = await this.tenantService.findAll();
    const results: Array<{ tenantId: string; tenantName: string; status: 'success' | 'error'; error?: string }> = [];

    for (const tenant of tenants) {
      const connection = this.buildTenantConnection(tenant.databaseName, tenant.connectionString);
      try {
        await this.provisioning.applyClinicSchema(connection, { bundles: ['sprint5_features'] });
        results.push({ tenantId: tenant.id, tenantName: tenant.clinicName, status: 'success' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ tenantId: tenant.id, tenantName: tenant.clinicName, status: 'error', error: message });
      }
    }

    return {
      message: 'Sprint 5 features applied to all tenants',
      count: tenants.length,
      results,
    };
  }

  @Get('system-health')
  async getSystemHealth() {
    const system = await this.healthMonitor.getSystemHealth();
    const tenants = this.healthMonitor.getAllHealthStatuses();
    return { system, tenants };
  }

  @Post('system-health/refresh')
  async refreshSystemHealth() {
    await this.healthMonitor.performHealthChecks();
    const system = await this.healthMonitor.getSystemHealth();
    const tenants = this.healthMonitor.getAllHealthStatuses();
    return { message: 'Health checks completed', system, tenants };
  }

  @Get('platform-services')
  async getPlatformServices(@Req() req: any): Promise<any> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.SUPPORT]);
    return this.platformMonitor.getPlatformServicesOverview();
  }

  @Post('platform-services/:serviceId/restart')
  async restartPlatformService(@Req() req: any, @Param('serviceId') serviceId: string): Promise<any> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    try {
      return await this.platformMonitor.restartService(serviceId);
    } catch (error: any) {
      const message = error?.message || 'Failed to restart service';
      if (String(message).toLowerCase().includes('docker control unavailable')) {
        throw new ServiceUnavailableException(message);
      }
      if (String(message).toLowerCase().includes('not restartable')) {
        throw new UnprocessableEntityException(
          `${message}. If Ollama runs natively, restart it manually: ollama serve`
        );
      }
      throw new BadRequestException(message);
    }
  }

  @Post('platform-services/tests/:testId')
  async runPlatformRuntimeTest(@Req() req: any, @Param('testId') testId: string): Promise<any> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.SUPPORT]);
    const normalized = String(testId || '').trim().toLowerCase();
    if (!['whisper', 'ocr', 'ollama'].includes(normalized)) {
      throw new BadRequestException(`Unsupported runtime test: ${testId}`);
    }
    return this.platformMonitor.runRuntimeTest(normalized as 'whisper' | 'ocr' | 'ollama');
  }

  @Get('runtime-config')
  async getRuntimeConfig(@Req() req: any): Promise<any> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.SUPPORT]);
    return this.runtimeEndpointConfig.getConfig();
  }

  @Put('runtime-config')
  async updateRuntimeConfig(@Req() req: any, @Body() body: any): Promise<any> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    return this.runtimeEndpointConfig.updateConfig(
      {
        tenantServiceUrl: body?.tenantServiceUrl,
        ehrServiceUrl: body?.ehrServiceUrl,
        cdssServiceUrl: body?.cdssServiceUrl,
        medicalAidDemoUrl: body?.medicalAidDemoUrl,
        superAdminWebUrl: body?.superAdminWebUrl,
        ehrFrontendUrl: body?.ehrFrontendUrl,
        ollamaBaseUrl: body?.ollamaBaseUrl,
        whisperPath: body?.whisperPath,
        ocrPath: body?.ocrPath,
        ollamaTagsPath: body?.ollamaTagsPath,
      },
      req?.user?.id,
    );
  }

  // ── DB Schema Drift Endpoints ──────────────────────────────────────────

  /** Check drift for all tenants (compares actual DB vs TypeORM entity schema) */
  @Get('drift')
  async getDriftAll(@Req() req: any) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    const tenants = await this.tenantService.findAll();
    const results = await Promise.all(
      tenants.map(async (tenant) => {
        const connection = this.buildTenantConnection(tenant.databaseName, tenant.connectionString);
        try {
          const drift = await this.driftService.checkDrift(connection);
          return { tenantId: tenant.id, tenantName: tenant.clinicName, databaseName: tenant.databaseName, drift };
        } catch (err) {
          return {
            tenantId: tenant.id,
            tenantName: tenant.clinicName,
            databaseName: tenant.databaseName,
            drift: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    const clean = results.filter((r) => r.drift?.ok).length;
    const drifted = results.filter((r) => r.drift && !r.drift.ok).length;
    const failed = results.filter((r) => !r.drift).length;
    return { summary: { total: tenants.length, clean, drifted, failed }, tenants: results };
  }

  /** Check drift for a single tenant */
  @Get('tenants/:id/drift')
  async getTenantDrift(@Req() req: any, @Param('id') id: string) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    const tenant = await this.tenantService.findById(id);
    const connection = this.buildTenantConnection(tenant.databaseName, tenant.connectionString);
    const drift = await this.driftService.checkDrift(connection);
    return { tenantId: tenant.id, tenantName: tenant.clinicName, databaseName: tenant.databaseName, drift };
  }

  /** Auto-repair a single tenant (up to 2 attempts) then re-check drift */
  @Post('tenants/:id/auto-repair')
  async autoRepairTenant(@Req() req: any, @Param('id') id: string) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    const tenant = await this.tenantService.findById(id);
    const connection = this.buildTenantConnection(tenant.databaseName, tenant.connectionString);
    const outcome = await this.driftService.autoRepairWithCheck(
      connection,
      (conn) => this.provisioning.applyClinicSchema(conn).then(() => undefined),
    );
    return {
      tenantId: tenant.id,
      tenantName: tenant.clinicName,
      databaseName: tenant.databaseName,
      ...outcome,
    };
  }

  /** Auto-repair all drifted tenants */
  @Post('drift/repair-all')
  async autoRepairAll(@Req() req: any) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    const tenants = await this.tenantService.findAll();
    const results = await Promise.all(
      tenants.map(async (tenant) => {
        const connection = this.buildTenantConnection(tenant.databaseName, tenant.connectionString);
        try {
          const outcome = await this.driftService.autoRepairWithCheck(
            connection,
            (conn) => this.provisioning.applyClinicSchema(conn).then(() => undefined),
          );
          return { tenantId: tenant.id, tenantName: tenant.clinicName, ...outcome };
        } catch (err) {
          return {
            tenantId: tenant.id,
            tenantName: tenant.clinicName,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    const resolved = results.filter((r: any) => r.resolved === true).length;
    const persists = results.filter((r: any) => r.resolved === false).length;
    const skipped = results.filter((r: any) => r.attempts === 0).length;
    return { summary: { total: tenants.length, resolved, persists, skipped }, tenants: results };
  }
}
