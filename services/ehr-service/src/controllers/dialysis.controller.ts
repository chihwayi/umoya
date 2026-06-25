import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DialysisService } from '../services/dialysis.service';

@UseGuards(JwtAuthGuard)
@Controller('dialysis')
export class DialysisController {
  constructor(private readonly svc: DialysisService) {}

  @Post('patients')
  registerDialysisPatient(@Req() req: any, @Body() body: any) {
    return this.svc.registerDialysisPatient(req.tenantDb, body);
  }

  @Post('access')
  registerAccess(@Req() req: any, @Body() body: any) {
    return this.svc.registerAccess(req.tenantDb, body);
  }

  @Patch('access/:id/status')
  updateAccessStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string; flowMlMin?: number }) {
    return this.svc.updateAccessStatus(req.tenantDb, id, body);
  }

  @Post('hd-sessions')
  startHdSession(
    @Req() req: any,
    @Body() body: {
      patientId: string; accessId?: string;
      preWeightKg: number; bloodFlowMlMin?: number; dialysateFlowMlMin?: number;
      preBpSystolic?: number; preBpDiastolic?: number;
    },
  ) {
    return this.svc.startHdSession(req.tenantDb, req.user.id, body);
  }

  @Patch('hd-sessions/:id/complete')
  completeHdSession(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { postWeightKg: number; ktV?: number; endTime: string; complications?: any[] },
  ) {
    return this.svc.completeHdSession(req.tenantDb, id, body);
  }

  @Get('hd-sessions/:patientId')
  getHdHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getHdHistory(req.tenantDb, patientId);
  }

  @Post('crrt')
  startCrrt(@Req() req: any, @Body() body: any) {
    return this.svc.startCrrt(req.tenantDb, req.user.id, body);
  }

  @Post('pd-exchanges')
  recordPdExchange(@Req() req: any, @Body() body: any) {
    return this.svc.recordPdExchange(req.tenantDb, req.user.id, body);
  }

  @Get('adequacy/:patientId')
  getAdequacy(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getAdequacy(req.tenantDb, patientId);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.svc.getDashboard(req.tenantDb);
  }
}
