import { UseGuards, Controller, Post, Get, Body, Param, Query, Req } from '@nestjs/common';
import { PredictiveRiskService } from '../services/predictive-risk.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class PredictiveRiskController {
  constructor(private readonly svc: PredictiveRiskService) {}

  @Post('deterioration')
  predictDeterioration(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
    @Body('admissionId') admissionId?: string,
    @Body('vitals') vitals?: any,
  ) {
    return this.svc.predictDeterioration(req.tenantDb!, patientId, admissionId, vitals);
  }

  @Get('deterioration/:patientId')
  getDeteriorationHistory(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getDeteriorationHistory(req.tenantDb!, patientId);
  }

  @Get('deterioration-watch/list')
  getActiveWorseningTrends(@Req() req: RequestWithTenant) {
    return this.svc.getActiveWorseningTrends(req.tenantDb!);
  }

  @Post('readmission')
  predictReadmission(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
    @Body('dischargeId') dischargeId?: string,
    @Body('clinicalData') clinicalData?: any,
  ) {
    return this.svc.predictReadmission(req.tenantDb!, patientId, dischargeId, clinicalData);
  }

  @Get('readmission/:patientId')
  getReadmissionRisk(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getReadmissionRisk(req.tenantDb!, patientId);
  }
}
