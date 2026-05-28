import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientRiskScoringService } from '../services/patient-risk-scoring.service';

@UseGuards(JwtAuthGuard)
@Controller('risk')
export class ProactiveRiskController {
  constructor(private readonly riskService: PatientRiskScoringService) {}

  @Get('high-risk-patients')
  async getHighRisk(
    @Query('limit') limit: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.riskService.getHighRiskPatients(req.tenantDb, limit ? parseInt(limit) : 50);
  }

  @Get('patients/:patientId/risk-history')
  async getRiskHistory(
    @Param('patientId') patientId: string,
    @Query('days') days: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.riskService.getRiskScoreHistory(patientId, req.tenantDb, days ? parseInt(days) : 30);
  }

  @Post('patients/:patientId/rescore')
  async rescore(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.riskService.scoreAndPersist(
      patientId,
      req.tenantDb,
      req.tenantSubdomain ?? '',
      req.user.sub,
    );
  }

  @Post('sweep')
  async triggerSweep(@Req() req: any): Promise<{ scored: number; alerts: number }> {
    return this.riskService.runNightlySweep(req.tenantDb, req.tenantSubdomain ?? '');
  }
}
