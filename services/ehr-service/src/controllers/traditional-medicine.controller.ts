import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TraditionalMedicineService } from '../services/traditional-medicine.service';
import { CdssService } from '../services/cdss.service';

@Controller('traditional-medicine')
@UseGuards(JwtAuthGuard)
export class TraditionalMedicineController {
  constructor(
    private readonly traditionalMedicineService: TraditionalMedicineService,
    private readonly cdssService: CdssService,
  ) {}

  @Post('patient/:patientId/remedies')
  recordRemedy(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.traditionalMedicineService.recordRemedy(
      req.tenantId!,
      patientId,
      req.user?.sub || req.user?.id || null,
      body,
    );
  }

  @Get('patient/:patientId/remedies')
  getRemedies(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.traditionalMedicineService.getRemedies(req.tenantId!, patientId);
  }

  @Patch('remedies/:id')
  updateRemedy(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.traditionalMedicineService.updateRemedy(req.tenantId!, id, body);
  }

  @Post('patient/:patientId/interactions')
  checkInteractions(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.traditionalMedicineService.checkInteractions(
      req.tenantId!,
      patientId,
      Array.isArray(body?.herbs) ? body.herbs : [],
      body?.tmRemedyId ?? null,
      Array.isArray(body?.activeDrugs) ? body.activeDrugs : undefined,
    );
  }

  @Get('patient/:patientId/alerts')
  getAlerts(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.traditionalMedicineService.getAlerts(req.tenantId!, patientId);
  }

  @Patch('alerts/:alertId/acknowledge')
  acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.traditionalMedicineService.acknowledgeAlert(
      req.tenantId!,
      alertId,
      req.user?.sub || req.user?.id || null,
      body?.overrideReason ?? null,
    );
  }

  @Post('patient/:patientId/toxicity')
  recordToxicityEvent(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.traditionalMedicineService.recordToxicityEvent(
      req.tenantId!,
      patientId,
      req.user?.sub || req.user?.id || null,
      body,
    );
  }

  @Get('patient/:patientId/toxicity')
  getToxicityEvents(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.traditionalMedicineService.getToxicityEvents(req.tenantId!, patientId);
  }

  @Post('cdss/hdi-check')
  proxyHdiCheck(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.tmHdiCheck(body, req.tenantId!);
  }

  @Post('cdss/toxicity-risk')
  proxyToxicityRisk(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.tmToxicityRisk(body, req.tenantId!);
  }
}
