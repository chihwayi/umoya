import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { LabQualityService } from '../services/lab-quality.service';

@Controller('lab/quality')
@UseGuards(JwtAuthGuard)
export class LabQualityController {
  constructor(private readonly labQuality: LabQualityService) {}

  @Post('eqa-scores')
  recordEqaScore(@Body() dto: any, @Request() req: RequestWithTenant) {
    return this.labQuality.recordEqaScore(req.tenantId, dto);
  }

  @Post('qc-failures')
  recordQcFailure(@Body() dto: any, @Request() req: RequestWithTenant) {
    return this.labQuality.recordQcFailure(req.tenantId, dto);
  }

  @Get('summary')
  getQualitySummary(@Query('period') period: string, @Request() req: RequestWithTenant) {
    const p = period || new Date().toISOString().slice(0, 7).replace('-', '');
    return this.labQuality.getLabQualitySummary(req.tenantId, p);
  }

  @Get('eqa-trend')
  getEqaTrend(@Query('analyte') analyte: string, @Request() req: RequestWithTenant) {
    return this.labQuality.getEqaZScoreTrend(req.tenantId, analyte || 'CD4');
  }

  @Get('repeat-flags')
  getRepeatFlags(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: RequestWithTenant,
  ) {
    const now = new Date();
    const end = endDate || now.toISOString().slice(0, 10);
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    return this.labQuality.getRepeatFlags(req.tenantId, start, end);
  }
}
