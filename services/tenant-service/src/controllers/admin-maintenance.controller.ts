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

  @Post('tenants/:id/repair')
  async repairTenant(@Param('id') id: string) {
    const tenant = await this.tenantService.findById(id);
    const connection = tenant.connectionString || `postgresql://medicore:medicore_password@${process.env.DB_HOST || 'postgres-master'}:${process.env.DB_PORT || 5432}/${tenant.databaseName}`;
    await this.provisioning.applyClinicSchema(connection);
    return { message: 'Schema applied', tenantId: id };
  }

  @Post('tenants/repair-all')
  async repairAllTenants() {
    const all = await this.tenantService.findAll();
    for (const t of all) {
      const conn = t.connectionString || `postgresql://medicore:medicore_password@${process.env.DB_HOST || 'postgres-master'}:${process.env.DB_PORT || 5432}/${t.databaseName}`;
      await this.provisioning.applyClinicSchema(conn);
    }
    return { message: 'Schema applied to all tenants', count: all.length };
  }
}


