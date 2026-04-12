import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ScdService } from '../services/scd.service';
import { CdssService } from '../services/cdss.service';

@Controller('scd')
@UseGuards(JwtAuthGuard)
export class ScdController {
  constructor(
    private readonly scdService: ScdService,
    private readonly cdssService: CdssService,
  ) {}

  @Post('patient/:patientId/register')
  enroll(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.scdService.enroll(req.tenantId!, patientId, req.user?.sub || req.user?.id, body);
  }

  @Get('patient/:patientId/register')
  getRegister(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.scdService.getRegister(req.tenantId!, patientId);
  }

  @Patch('register/:id')
  updateRegister(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.scdService.updateRegister(req.tenantId!, id, body);
  }

  @Post('patient/:patientId/crisis')
  recordCrisis(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.scdService.recordCrisis(req.tenantId!, patientId, req.user?.sub || req.user?.id, body);
  }

  @Get('patient/:patientId/crisis')
  getCrisisHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.scdService.getCrisisHistory(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/treatment')
  recordTreatment(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.scdService.recordTreatment(req.tenantId!, patientId, req.user?.sub || req.user?.id, body);
  }

  @Get('patient/:patientId/treatment')
  getTreatmentHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.scdService.getTreatmentHistory(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/screening')
  recordScreening(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.scdService.recordScreening(req.tenantId!, patientId, req.user?.sub || req.user?.id, body);
  }

  @Get('patient/:patientId/screening')
  getScreeningHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.scdService.getScreeningHistory(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/risk')
  getComplicationRisk(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.scdService.getComplicationRisk(req.tenantId!, patientId, body ?? {});
  }

  @Post('cdss/hydroxyurea-dose')
  hydroxyureaDose(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.scdHydroxyureaDose(body, req.tenantId!);
  }

  @Post('cdss/crisis-triage')
  crisisTriage(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.scdCrisisTriage(body, req.tenantId!);
  }

  @Post('cdss/complication-risk')
  complicationRisk(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.scdComplicationRisk(body, req.tenantId!);
  }
}
