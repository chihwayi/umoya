import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TenantService } from '../services/tenant.service';
import { EarlyWarningService, News2Input } from '../services/early-warning.service';

@ApiTags('Early Warning Scores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('early-warning')
export class EarlyWarningController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly earlyWarningService: EarlyWarningService,
  ) {}

  @Post('scores')
  @ApiOperation({ summary: 'Calculate and store NEWS2 score from vitals payload' })
  async createScore(@Body() body: News2Input, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.earlyWarningService.recordNews2Score(tenantDb, body, req.tenantId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'List NEWS2 scores for patient' })
  async listForPatient(
    @Param('patientId') patientId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.earlyWarningService.listScoresForPatient(
      tenantDb,
      patientId,
      limit ? Number(limit) : 50,
    );
  }

  @Get('alerts')
  @ApiOperation({ summary: 'List active NEWS2 alerts (unacknowledged scores)' })
  async listAlerts(@Query('limit') limit: string | undefined, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.earlyWarningService.listActiveAlerts(
      tenantDb,
      limit ? Number(limit) : 50,
    );
  }

  @Post('alerts/:id/ack')
  @ApiOperation({ summary: 'Acknowledge a NEWS2 alert' })
  async acknowledgeAlert(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return await this.earlyWarningService.acknowledgeAlert(tenantDb, id, userId);
  }
}

