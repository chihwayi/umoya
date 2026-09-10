import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';

/**
 * B-012/MOAS-16: liveness and readiness probes.
 *
 * `/health` (liveness) only proves the Node process is up and handling HTTP
 * — it does not touch any dependency, so an orchestrator restarting on
 * liveness failure won't cycle the pod just because the database is briefly
 * unreachable.
 *
 * `/health/ready` (readiness) proves this instance can actually serve
 * traffic — it checks the one hard dependency every request needs (the
 * master tenant registry DB) and returns 503 if that check fails, so a load
 * balancer/orchestrator can correctly stop routing to this instance instead
 * of returning tenant-resolution errors to real requests.
 *
 * Both routes are excluded from TenantMiddleware (see ehr.module.ts) since
 * a health probe has no tenant context by definition.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness probe — process is running' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — instance can serve traffic' })
  @ApiResponse({ status: 200, description: 'Dependencies are reachable' })
  @ApiResponse({ status: 503, description: 'A required dependency is unreachable' })
  async readiness(@Res() res: Response) {
    const masterDbOk = await this.tenantService.pingMasterDb();
    const body = {
      status: masterDbOk ? 'ok' : 'unavailable',
      timestamp: new Date().toISOString(),
      dependencies: {
        masterDb: masterDbOk ? 'ok' : 'unavailable',
      },
    };
    res.status(masterDbOk ? 200 : 503).json(body);
  }
}
