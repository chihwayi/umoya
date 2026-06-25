import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AestheticsService } from '../services/aesthetics.service';

@UseGuards(JwtAuthGuard)
@Controller('aesthetics')
export class AestheticsController {
  constructor(private readonly svc: AestheticsService) {}

  @Post('patients')
  enrollPatient(@Req() req: any, @Body() body: any) {
    return this.svc.enrollPatient(req.tenantDb, body);
  }

  @Get('patients/:patientId/profile')
  getProfile(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getProfile(req.tenantDb, patientId);
  }

  @Post('consent')
  recordConsent(@Req() req: any, @Body() body: any) {
    return this.svc.recordConsent(req.tenantDb, req.user.id, body);
  }

  @Post('procedures')
  recordProcedure(
    @Req() req: any,
    @Body() body: {
      patientId: string; procedureType: string; treatmentAreas: string[];
      productUsed?: string; productLot?: string; productExpiry?: string;
      unitsOrMl?: number; prePhotoRef?: string; postPhotoRef?: string;
      nextSessionDue?: string; costUsd?: number; notes?: string;
    },
  ) {
    return this.svc.recordProcedure(req.tenantDb, req.user.id, body);
  }

  @Get('procedures/:patientId')
  getPatientProcedures(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientProcedures(req.tenantDb, patientId);
  }

  @Post('prp')
  recordPrpSession(@Req() req: any, @Body() body: any) {
    return this.svc.recordPrpSession(req.tenantDb, req.user.id, body);
  }

  @Post('skin-analysis')
  recordSkinAnalysis(@Req() req: any, @Body() body: any) {
    return this.svc.recordSkinAnalysis(req.tenantDb, req.user.id, body);
  }

  @Get('skin-analysis/:patientId')
  getSkinHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getSkinHistory(req.tenantDb, patientId);
  }

  @Get('upcoming-sessions')
  getUpcomingSessions(@Req() req: any) {
    return this.svc.getUpcomingSessions(req.tenantDb);
  }
}
