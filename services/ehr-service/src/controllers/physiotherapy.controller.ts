import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { PhysiotherapyService } from '../services/physiotherapy.service';

@Controller('physiotherapy')
@UseGuards(JwtAuthGuard)
export class PhysiotherapyController {
  constructor(private readonly physioSvc: PhysiotherapyService) {}

  @Post('referrals')
  createReferral(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.physioSvc.createReferral(req.tenantId!, { ...body, referredBy: req.user?.sub || req.user?.id });
  }

  @Get('referrals')
  listReferrals(@Query('status') status?: string, @Query('rehabType') rehabType?: string, @Query('limit') limit?: string, @Request() req?: RequestWithTenant) {
    return this.physioSvc.listReferrals((req as any).tenantId!, { status, rehabType, limit: limit ? Number(limit) : undefined });
  }

  @Get('referrals/:id')
  getReferral(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.physioSvc.getReferral(req.tenantId!, id);
  }

  @Patch('referrals/:id')
  updateReferral(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.physioSvc.updateReferral(req.tenantId!, id, body);
  }

  @Patch('referrals/:id/accept')
  acceptReferral(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.physioSvc.acceptReferral(req.tenantId!, id);
  }

  @Patch('referrals/:id/discharge')
  dischargeReferral(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.physioSvc.dischargeReferral(req.tenantId!, id, body.notes);
  }

  @Get('patient/:patientId/referrals')
  getPatientReferrals(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.physioSvc.getPatientReferrals(req.tenantId!, patientId);
  }

  @Post('referrals/:referralId/sessions')
  recordSession(@Param('referralId') referralId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const tenantId = req.tenantId!;
    const patientId = body.patientId;
    return this.physioSvc.recordSession(tenantId, referralId, { ...body, patientId, therapistId: body.therapistId ?? req.user?.sub });
  }

  @Get('referrals/:referralId/sessions')
  getSessionsByReferral(@Param('referralId') referralId: string, @Request() req: RequestWithTenant) {
    return this.physioSvc.getSessionsByReferral(req.tenantId!, referralId);
  }

  @Get('patient/:patientId/sessions')
  getPatientSessions(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.physioSvc.getSessions(req.tenantId!, patientId);
  }

  @Post('cdss/stroke-rehab')
  strokeRehab(@Body() body: any) {
    return this.physioSvc.strokeRehab(body);
  }

  @Post('cdss/cardiac-rehab')
  cardiacRehab(@Body() body: any) {
    return this.physioSvc.cardiacRehab(body);
  }
}
