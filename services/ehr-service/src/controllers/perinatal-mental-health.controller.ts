import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PerinatalMentalHealthService } from '../services/perinatal-mental-health.service';

@UseGuards(JwtAuthGuard)
@Controller('pmh')
export class PerinatalMentalHealthController {
  constructor(private readonly svc: PerinatalMentalHealthService) {}

  @Post('assessments')
  createAssessment(@Req() req: any, @Body() body: any) {
    return this.svc.createAssessment(req.tenantDb, req.user.id, body);
  }

  @Post('epds')
  submitEpds(
    @Req() req: any,
    @Body() body: {
      assessmentId: string; patientId: string;
      q1: number; q2: number; q3: number; q4: number; q5: number;
      q6: number; q7: number; q8: number; q9: number; q10: number;
    },
  ) {
    return this.svc.submitEpds(req.tenantDb, req.user.id, body);
  }

  @Get('epds/:patientId/history')
  getEpdsHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getEpdsHistory(req.tenantDb, patientId);
  }

  @Get('epds/critical-queue')
  getCriticalQueue(@Req() req: any) {
    return this.svc.getCriticalQueue(req.tenantDb);
  }

  @Patch('epds/:id/reviewed')
  markReviewed(@Req() req: any, @Param('id') id: string) {
    return this.svc.markEpdsReviewed(req.tenantDb, id, req.user.id);
  }

  @Post('safeguarding')
  raiseSafeguardingFlag(@Req() req: any, @Body() body: any) {
    return this.svc.raiseSafeguardingFlag(req.tenantDb, req.user.id, body);
  }

  @Get('safeguarding/:patientId')
  getSafeguardingFlags(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getSafeguardingFlags(req.tenantDb, patientId);
  }

  @Get('followup/overdue')
  getOverdueFollowups(@Req() req: any) {
    return this.svc.getOverdueFollowups(req.tenantDb);
  }
}
