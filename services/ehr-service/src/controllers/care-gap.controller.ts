import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CareGapEngineService } from '../services/care-gap-engine.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class CareGapController {
  constructor(private readonly gapEngine: CareGapEngineService) {}

  @Get(':patientId/care-gaps')
  async getGaps(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    let gaps = await this.gapEngine.getOpenGaps(patientId, req.tenantDb);
    if (gaps.length === 0) {
      await this.gapEngine.refreshPatient(patientId, req.tenantDb);
      gaps = await this.gapEngine.getOpenGaps(patientId, req.tenantDb);
    }
    return gaps;
  }

  @Post(':patientId/care-gaps/refresh')
  async refresh(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.gapEngine.refreshPatient(patientId, req.tenantDb);
    return { ok: true };
  }

  @Post('care-gaps/:gapId/dismiss')
  async dismiss(
    @Param('gapId') gapId: string,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.gapEngine.dismissGap(gapId, req.user?.sub ?? 'api', req.tenantDb);
    return { ok: true };
  }

  @Post('care-gaps/:gapId/resolve')
  async resolve(
    @Param('gapId') gapId: string,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.gapEngine.resolveGap(gapId, req.tenantDb);
    return { ok: true };
  }
}
