import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DatabaseProvisioningService } from '../services/database-provisioning.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('admin-maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminMaintenanceController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly provisioning: DatabaseProvisioningService,
  ) {}

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
}

