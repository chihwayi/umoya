import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantService } from '../services/tenant.service';
import { RolloutReadiness, ReadinessCheck, ReadinessStatus } from '../dto/rollout-readiness.dto';

@ApiTags('rollout')
@ApiBearerAuth()
@Controller('rollout')
export class RolloutController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('tenants')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List rollout readiness for all tenants' })
  async listRolloutReadiness(): Promise<RolloutReadiness[]> {
    const tenants = await this.tenantService.findAll();
    return tenants.map((tenant) => this.buildReadiness(tenant));
  }

  @Get('tenants/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get rollout readiness for one tenant' })
  async getTenantRolloutReadiness(@Param('id') id: string): Promise<RolloutReadiness> {
    const tenant = await this.tenantService.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.buildReadiness(tenant);
  }

  private buildReadiness(tenant: any): RolloutReadiness {
    const checks: ReadinessCheck[] = [];

    checks.push({
      label: 'Tenant active',
      status: tenant.status === 'active' ? 'ready' : 'blocked',
      detail: tenant.status,
    });

    checks.push({
      label: 'Country pack configured',
      status: tenant.countryCode ? 'ready' : 'not_configured',
      detail: tenant.countryCode ?? 'No country code set',
    });

    checks.push({
      label: 'Deployment mode set',
      status: tenant.deploymentMode ? 'ready' : 'needs_attention',
      detail: tenant.deploymentMode ?? 'Defaults to clinic',
    });

    checks.push({
      label: 'Modules configured',
      status:
        Array.isArray(tenant.enabledModules) && tenant.enabledModules.length > 0
          ? 'ready'
          : 'needs_attention',
      detail: `${Array.isArray(tenant.enabledModules) ? tenant.enabledModules.length : 0} modules enabled`,
    });

    checks.push({
      label: 'Backup configured',
      status: 'not_configured',
      detail: 'Backup status check not yet wired',
    });

    const blockedCount = checks.filter((check) => check.status === 'blocked').length;
    const attentionCount = checks.filter((check) => check.status === 'needs_attention').length;

    const overallStatus: ReadinessStatus =
      blockedCount > 0 ? 'blocked' : attentionCount > 0 ? 'needs_attention' : 'ready';

    return {
      tenantId: tenant.id,
      clinicName: tenant.clinicName,
      deploymentMode: tenant.deploymentMode ?? 'clinic',
      countryCode: tenant.countryCode ?? null,
      overallStatus,
      checks,
      lastUpdated: new Date().toISOString(),
    };
  }
}
