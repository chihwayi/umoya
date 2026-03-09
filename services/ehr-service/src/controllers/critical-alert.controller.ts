import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { CriticalAlertService } from '../services/critical-alert.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Critical Result Alerts')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('critical-alerts')
export class CriticalAlertController {
  constructor(private criticalAlertService: CriticalAlertService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Get pending critical alerts for ordering provider' })
  async getPendingAlerts(@Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.criticalAlertService.getPendingAlerts(userId, req.tenantDb);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get critical alerts for a patient' })
  async getPatientAlerts(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.criticalAlertService.getPatientAlerts(patientId, req.tenantDb);
  }

  @Put(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a critical alert' })
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Request() req: RequestWithTenant
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.criticalAlertService.acknowledgeAlert(id, userId, body.notes, req.tenantDb);
  }

  @Put(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss a critical alert' })
  async dismissAlert(@Param('id') id: string, @Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.criticalAlertService.dismissAlert(id, userId, req.tenantDb);
  }
}

