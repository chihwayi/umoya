import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OemSurveillanceService } from '../services/oem-surveillance.service';

@UseGuards(JwtAuthGuard)
@Controller('oem/surveillance')
export class OemSurveillanceController {
  constructor(private readonly svc: OemSurveillanceService) {}

  @Post('hazard-profiles')
  createHazardProfile(@Req() req: any, @Body() body: any) {
    return this.svc.createHazardProfile(req.tenantDb, body);
  }

  @Get('hazard-profiles/:employerId')
  getHazardProfiles(@Req() req: any, @Param('employerId') employerId: string) {
    return this.svc.getHazardProfiles(req.tenantDb, employerId);
  }

  @Post('exposure-records')
  recordExposure(@Req() req: any, @Body() body: any) {
    return this.svc.recordExposure(req.tenantDb, body);
  }

  @Get('exposure-records/:encounterId')
  getExposureRecords(@Req() req: any, @Param('encounterId') encounterId: string) {
    return this.svc.getExposureRecords(req.tenantDb, encounterId);
  }

  @Post('bio-monitoring')
  recordBioMonitoring(@Req() req: any, @Body() body: any) {
    return this.svc.recordBioMonitoring(req.tenantDb, body);
  }

  @Get('bio-monitoring/:patientId')
  getBioMonitoring(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getBioMonitoring(req.tenantDb, patientId);
  }

  @Post('schedule')
  scheduleItem(@Req() req: any, @Body() body: any) {
    return this.svc.scheduleSurveillance(req.tenantDb, body);
  }

  @Get('overdue')
  getOverdue(@Req() req: any) {
    return this.svc.getOverdueSurveillance(req.tenantDb);
  }

  @Patch('schedule/:id/complete')
  markComplete(@Req() req: any, @Param('id') id: string) {
    return this.svc.markSurveillanceComplete(req.tenantDb, id);
  }

  @Post('rtw')
  createRtwPlan(
    @Req() req: any,
    @Body() body: {
      patientId: string; employerId: string; encounterId?: string;
      injuryIllness: string; restrictions: any[]; gradedSchedule: any[];
      targetRtwDate?: string; notes?: string;
    },
  ) {
    return this.svc.createRtwPlan(req.tenantDb, req.user.id, body);
  }

  @Get('rtw/:patientId')
  getPatientRtwPlans(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientRtwPlans(req.tenantDb, patientId);
  }

  @Patch('rtw/:id/sign')
  employerSign(@Req() req: any, @Param('id') id: string) {
    return this.svc.employerSignRtw(req.tenantDb, id);
  }

  @Patch('rtw/:id/status')
  updateRtwStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateRtwStatus(req.tenantDb, id, body.status);
  }
}
