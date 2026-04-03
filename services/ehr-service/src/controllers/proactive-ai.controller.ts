import { Controller, Get, Post, Patch, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProactiveAiService } from '../services/proactive-ai.service';

@Controller('proactive')
@UseGuards(JwtAuthGuard)
export class ProactiveAiController {
  constructor(private readonly proactiveAiService: ProactiveAiService) {}

  /** GET /proactive/patient/:patientId/snapshot — latest AI snapshot */
  @Get('patient/:patientId/snapshot')
  async getSnapshot(@Param('patientId') patientId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    return this.proactiveAiService.getSnapshot(patientId, tenantId);
  }

  /** POST /proactive/patient/:patientId/analyze — manual trigger */
  @Post('patient/:patientId/analyze')
  async triggerAnalysis(@Param('patientId') patientId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    const snapshot = await this.proactiveAiService.runAnalysisSync({
      patientId,
      tenantId,
      triggeredByUserId: req.user?.id,
      triggerType: 'manual',
    });
    return snapshot || { message: 'Analysis queued' };
  }

  /** GET /proactive/patient/:patientId/alerts — all active alerts for patient */
  @Get('patient/:patientId/alerts')
  async getPatientAlerts(@Param('patientId') patientId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    return this.proactiveAiService.getActiveAlerts(patientId, tenantId);
  }

  /** PATCH /proactive/alerts/:alertId/acknowledge */
  @Patch('alerts/:alertId/acknowledge')
  async acknowledgeAlert(@Param('alertId') alertId: string, @Request() req: any) {
    return this.proactiveAiService.acknowledgeAlert(alertId, req.user.id, req.user.tenantId);
  }

  /** PATCH /proactive/alerts/:alertId/dismiss */
  @Patch('alerts/:alertId/dismiss')
  async dismissAlert(@Param('alertId') alertId: string, @Request() req: any) {
    return this.proactiveAiService.dismissAlert(alertId, req.user.id, req.user.tenantId);
  }

  /** GET /proactive/patient/:patientId/risk-history/:scoreType */
  @Get('patient/:patientId/risk-history/:scoreType')
  async getRiskHistory(
    @Param('patientId') patientId: string,
    @Param('scoreType') scoreType: string,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.proactiveAiService.getRiskScoreHistory(patientId, tenantId, scoreType);
  }

  /** GET /proactive/alerts/ward — all active alerts for current tenant (nurse station view) */
  @Get('alerts/ward')
  async getWardAlerts(@Request() req: any, @Query('severity') severity?: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.proactiveAiService.getWardActiveAlerts(tenantId, severity);
  }
}
