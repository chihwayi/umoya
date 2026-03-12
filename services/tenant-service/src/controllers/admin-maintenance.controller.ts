import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  ServiceUnavailableException,
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
    const user = encodeURIComponent(process.env.DB_USERNAME || process.env.POSTGRES_USER || 'medicore');
    const pass = encodeURIComponent(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'medicore_password');
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
}
