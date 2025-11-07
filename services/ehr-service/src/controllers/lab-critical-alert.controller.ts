import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LabCriticalAlertService } from '../services/lab-critical-alert.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Lab Critical Alerts')
@Controller('lab/critical-alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LabCriticalAlertController {
  constructor(private readonly labCriticalAlertService: LabCriticalAlertService) {}

  @Get()
  @ApiOperation({ summary: 'Get all critical alerts' })
  @ApiResponse({ status: 200, description: 'List of critical alerts' })
  async getAllAlerts(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.labCriticalAlertService.getAllAlerts(req.tenantDb, { status, severity });
  }

  @Get('my-alerts')
  @ApiOperation({ summary: 'Get alerts for current user' })
  @ApiResponse({ status: 200, description: 'Alerts assigned to current user' })
  async getMyAlerts(@Request() req: RequestWithTenant) {
    const userId = req.user?.userId;
    return this.labCriticalAlertService.getAlertsForUser(req.tenantDb, userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get all pending critical alerts' })
  @ApiResponse({ status: 200, description: 'Pending critical alerts' })
  async getPendingAlerts(@Request() req: RequestWithTenant) {
    return this.labCriticalAlertService.getPendingAlerts(req.tenantDb);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get alerts for a patient' })
  @ApiResponse({ status: 200, description: 'Patient critical alerts' })
  async getPatientAlerts(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.labCriticalAlertService.getPatientAlerts(req.tenantDb, patientId);
  }

  @Get(':alertId')
  @ApiOperation({ summary: 'Get alert details' })
  @ApiResponse({ status: 200, description: 'Alert details' })
  async getAlertById(
    @Request() req: RequestWithTenant,
    @Param('alertId') alertId: string,
  ) {
    return this.labCriticalAlertService.getAlertById(req.tenantDb, alertId);
  }

  @Post()
  @ApiOperation({ summary: 'Create critical alert' })
  @ApiResponse({ status: 201, description: 'Alert created successfully' })
  async createAlert(
    @Request() req: RequestWithTenant,
    @Body() alertData: any,
  ) {
    const userId = req.user?.userId;
    return this.labCriticalAlertService.createAlert(req.tenantDb, alertData, userId);
  }

  @Post('check-and-generate')
  @ApiOperation({ summary: 'Check lab results and generate alerts if needed' })
  @ApiResponse({ status: 200, description: 'Alerts checked and generated' })
  async checkAndGenerateAlerts(
    @Request() req: RequestWithTenant,
    @Body() body: { lab_order_id: string; results: any[] },
  ) {
    const userId = req.user?.userId;
    return this.labCriticalAlertService.checkAndGenerateAlerts(
      req.tenantDb,
      body.lab_order_id,
      body.results,
      userId,
    );
  }

  @Patch(':alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge critical alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully' })
  async acknowledgeAlert(
    @Request() req: RequestWithTenant,
    @Param('alertId') alertId: string,
    @Body() body: { acknowledgment_notes?: string },
  ) {
    const userId = req.user?.userId;
    return this.labCriticalAlertService.acknowledgeAlert(
      req.tenantDb,
      alertId,
      userId,
      body.acknowledgment_notes,
    );
  }

  @Patch(':alertId/escalate')
  @ApiOperation({ summary: 'Escalate unacknowledged alert' })
  @ApiResponse({ status: 200, description: 'Alert escalated successfully' })
  async escalateAlert(
    @Request() req: RequestWithTenant,
    @Param('alertId') alertId: string,
    @Body() body: { escalate_to: string },
  ) {
    const userId = req.user?.userId;
    return this.labCriticalAlertService.escalateAlert(
      req.tenantDb,
      alertId,
      body.escalate_to,
      userId,
    );
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get alert statistics summary' })
  @ApiResponse({ status: 200, description: 'Alert statistics' })
  async getAlertStats(@Request() req: RequestWithTenant) {
    return this.labCriticalAlertService.getAlertStats(req.tenantDb);
  }
}

