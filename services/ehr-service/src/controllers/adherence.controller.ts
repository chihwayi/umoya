import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdherenceEngineService } from '../services/adherence-engine.service';

@UseGuards(JwtAuthGuard)
@Controller('adherence')
export class AdherenceController {
  constructor(private readonly adherence: AdherenceEngineService) {}

  @Get('at-risk')
  async getAtRisk(@Query('limit') limit: string, @Req() req: any): Promise<unknown[]> {
    return this.adherence.getAtRiskPatients(req.tenantDb, limit ? parseInt(limit) : 20);
  }

  @Get('patients/:patientId/history')
  async getHistory(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.adherence.getPatientAdherenceHistory(patientId, req.tenantDb);
  }

  @Post('patients/:patientId/score')
  async scorePatient(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.adherence.scorePatient(patientId, req.tenantDb);
  }
}
