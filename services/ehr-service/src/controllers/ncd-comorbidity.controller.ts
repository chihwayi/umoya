import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NcdComorbidityService } from '../services/ncd-comorbidity.service';

@Controller('ncd-comorbidity')
@UseGuards(JwtAuthGuard)
export class NcdComorbidityController {
  constructor(private readonly ncdSvc: NcdComorbidityService) {}

  @Get('patient/:patientId')
  getProfile(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.ncdSvc.getOrCreateProfile(req.tenantId!, patientId);
  }

  @Patch('patient/:patientId')
  updateProfile(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.ncdSvc.updateProfile(req.tenantId!, patientId, { ...body, lastUpdatedBy: req.user?.sub || req.user?.id });
  }

  // Cross-module sync — pulls from DM, HTN, CKD, ophthalmology into unified profile
  @Post('patient/:patientId/sync')
  syncProfile(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.ncdSvc.syncProfile(req.tenantId!, patientId);
  }

  // Framingham 10-year CVD risk + CDSS
  @Post('cdss/cvd-risk')
  cvdRisk(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.ncdSvc.cvdRisk(req.tenantId!, body);
  }
}
