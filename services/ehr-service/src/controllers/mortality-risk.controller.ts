import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MortalityRiskService } from '../services/mortality-risk.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class MortalityRiskController {
  constructor(private readonly mortality: MortalityRiskService) {}

  @Get('mortality-risk/critical')
  async getCritical(@Req() req: any): Promise<unknown[]> {
    return this.mortality.getCriticalPatients(req.tenantDb);
  }

  @Get(':patientId/mortality-risk')
  async getScore(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    let score = await this.mortality.getLatestScore(patientId, req.tenantDb);
    if (!score) {
      score = await this.mortality.scorePatient(
        patientId, req.tenantDb, req.tenantSubdomain ?? '', req.user?.sub ?? 'api',
      );
    }
    return score;
  }

  @Post(':patientId/mortality-risk/rescore')
  async rescore(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.mortality.scorePatient(
      patientId, req.tenantDb, req.tenantSubdomain ?? '', req.user?.sub ?? 'api',
    );
  }
}
