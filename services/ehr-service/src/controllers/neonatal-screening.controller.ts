import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NeonatalScreeningService } from '../services/neonatal-screening.service';

@UseGuards(JwtAuthGuard)
@Controller('neonatal-screening')
export class NeonatalScreeningController {
  constructor(private readonly svc: NeonatalScreeningService) {}

  @Post('nbs/batch')
  createNbsBatch(@Req() req: any, @Body() body: { labName?: string }) {
    return this.svc.createNbsBatch(req.tenantDb, req.user.id, body);
  }

  @Post('nbs/sample')
  addNbsSample(
    @Req() req: any,
    @Body() body: {
      batchId: string; patientId: string; admissionId?: string;
      cardNumber: string; ageAtCollectionHours?: number;
    },
  ) {
    return this.svc.addNbsSample(req.tenantDb, req.user.id, body);
  }

  @Patch('nbs/sample/:id/results')
  recordNbsResults(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { tshResult?: number; pkuResult?: number; g6pdResult?: string; scdResult?: string; scdAbnormal?: boolean; resultStatus: string },
  ) {
    return this.svc.recordNbsResults(req.tenantDb, id, body);
  }

  @Get('nbs/abnormal')
  getAbnormalNbsResults(@Req() req: any) {
    return this.svc.getAbnormalNbsResults(req.tenantDb);
  }

  @Post('hearing')
  recordHearingScreen(
    @Req() req: any,
    @Body() body: { patientId: string; method?: string; leftEarResult: string; rightEarResult: string; notes?: string },
  ) {
    return this.svc.recordHearingScreen(req.tenantDb, req.user.id, body);
  }

  @Get('hearing/pending-abr')
  getPendingAbr(@Req() req: any) {
    return this.svc.getPendingAbrReferrals(req.tenantDb);
  }

  @Post('cchd')
  recordCchdScreen(
    @Req() req: any,
    @Body() body: { patientId: string; ageAtScreenHours: number; rightHandSpo2: number; footSpo2: number; attemptNumber?: number },
  ) {
    return this.svc.recordCchdScreen(req.tenantDb, req.user.id, body);
  }

  @Get('coverage')
  getCoverage(@Req() req: any) {
    return this.svc.getCoverage(req.tenantDb);
  }

  @Get('patient/:patientId/summary')
  getPatientScreeningSummary(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientScreeningSummary(req.tenantDb, patientId);
  }
}
