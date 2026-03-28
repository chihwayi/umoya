import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { Dhis2Service } from '../services/dhis2.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { Dhis2SchedulerService } from '../services/dhis2-scheduler.service';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('DHIS2 Integration')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dhis2')
export class Dhis2Controller {
  constructor(
    private dhis2Service: Dhis2Service,
    private readonly dhis2SchedulerService: Dhis2SchedulerService,
  ) {}

  @Post('sync/patients')
  @ApiOperation({ summary: 'Sync patients to DHIS2' })
  @ApiResponse({ status: 200, description: 'Patients synced successfully' })
  async syncPatients(@Request() req: RequestWithTenant) {
    return this.dhis2Service.syncPatients(req.tenantDb, req.tenantId);
  }

  @Post('events')
  @ApiOperation({ summary: 'Send event to DHIS2' })
  @ApiResponse({ status: 201, description: 'Event sent successfully' })
  async sendEvent(@Body() eventData: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendEvent(eventData, req.tenantDb, req.tenantId);
  }

  @Post('data-values')
  @ApiOperation({ summary: 'Send data values to DHIS2' })
  @ApiResponse({ status: 201, description: 'Data values sent successfully' })
  async sendDataValues(@Body() dataValues: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendDataValues(dataValues, req.tenantDb, req.tenantId);
  }

  @Get('programs')
  @ApiOperation({ summary: 'Get DHIS2 programs' })
  @ApiResponse({ status: 200, description: 'Programs retrieved successfully' })
  async getPrograms(@Request() req: RequestWithTenant) {
    return this.dhis2Service.getPrograms(req.tenantId);
  }

  @Get('data-elements')
  @ApiOperation({ summary: 'Get DHIS2 data elements' })
  @ApiResponse({ status: 200, description: 'Data elements retrieved successfully' })
  async getDataElements(@Query('program') program: string, @Request() req: RequestWithTenant) {
    return this.dhis2Service.getDataElements(program, req.tenantId);
  }

  @Post('reports/aggregate')
  @ApiOperation({ summary: 'Send aggregate report to DHIS2' })
  @ApiResponse({ status: 201, description: 'Report sent successfully' })
  async sendAggregateReport(@Body() reportData: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendAggregateReport(reportData, req.tenantDb, req.tenantId);
  }

  @Get('sync-status')
  @ApiOperation({ summary: 'Get DHIS2 sync status' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved' })
  async getSyncStatus(@Request() req: RequestWithTenant) {
    return this.dhis2Service.getSyncStatus(req.tenantDb, req.tenantId);
  }

  @Get('sync-log')
  @ApiOperation({ summary: 'Get tenant DHIS2 sync log with filters' })
  @ApiResponse({ status: 200, description: 'Sync log retrieved' })
  async getSyncLog(
    @Request() req: RequestWithTenant,
    @Query('entityType') entityType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dhis2Service.getSyncLog(req.tenantDb, {
      entityType: entityType || undefined,
      status: status || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('retry-failed')
  @ApiOperation({ summary: 'Retry failed DHIS2 sync log entries for the tenant' })
  @ApiResponse({ status: 200, description: 'Retry attempt completed' })
  async retryFailed(
    @Request() req: RequestWithTenant,
    @Body()
    body: {
      entityType?: string;
      limit?: number;
      dryRun?: boolean;
    },
  ) {
    return this.dhis2Service.retryFailedSync(req.tenantDb, req.tenantId, body || {});
  }

  @Post('sync/run-now')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Run immediate DHIS2 sync cycle for current tenant' })
  @ApiResponse({ status: 200, description: 'Immediate tenant sync completed' })
  async runSyncNow(
    @Request() req: RequestWithTenant,
    @Body()
    body: {
      retryLimit?: number;
      includeAlerts?: boolean;
    },
  ) {
    const requestId = (req.headers?.['x-request-id'] as string) || null;
    return this.dhis2SchedulerService.runTenantSyncNow(req.tenantId!, req.tenantDb, body || {}, {
      userId: req.user?.id ? String(req.user.id) : null,
      role: req.user?.role ? String(req.user.role) : null,
      email: req.user?.email ? String(req.user.email) : null,
      requestId,
    });
  }
}
