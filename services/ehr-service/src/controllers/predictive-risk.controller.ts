import { UseGuards, Controller, Post, Get, Body, Param, Query, Req } from '@nestjs/common';
import { PredictiveRiskService } from '../services/predictive-risk.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class PredictiveRiskController {
  constructor(private readonly svc: PredictiveRiskService) {}

  @Post('deterioration')
  predictDeterioration(
    @Body('subdomain') subdomain: string,
    @Body('patientId') patientId: string,
    @Body('admissionId') admissionId?: string,
    @Body('vitals') vitals?: any,
  ) {
    return this.svc.predictDeterioration(subdomain, patientId, admissionId, vitals);
  }

  @Get('deterioration/:patientId')
  getDeteriorationHistory(
    @Param('patientId') patientId: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getDeteriorationHistory(subdomain, patientId);
  }

  @Get('deterioration-watch/list')
  getActiveWorseningTrends(@Req() req: any, @Query('subdomain') subdomain?: string) {
    return this.svc.getActiveWorseningTrends(subdomain || req.tenantId);
  }

  @Post('readmission')
  predictReadmission(
    @Body('subdomain') subdomain: string,
    @Body('patientId') patientId: string,
    @Body('dischargeId') dischargeId?: string,
    @Body('clinicalData') clinicalData?: any,
  ) {
    return this.svc.predictReadmission(subdomain, patientId, dischargeId, clinicalData);
  }

  @Get('readmission/:patientId')
  getReadmissionRisk(
    @Param('patientId') patientId: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getReadmissionRisk(subdomain, patientId);
  }
}
