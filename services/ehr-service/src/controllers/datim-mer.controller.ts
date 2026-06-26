import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { DatimMerService } from '../services/datim-mer.service';

@Controller('datim')
@UseGuards(JwtAuthGuard)
export class DatimMerController {
  constructor(private readonly datimMerService: DatimMerService) {}

  @Get('preview/:period')
  previewIndicators(@Param('period') period: string, @Request() req: RequestWithTenant) {
    return this.datimMerService.previewIndicators(req.tenantId, period);
  }

  @Get('anomaly-narrative/:period')
  generateAnomalyNarrative(@Param('period') period: string, @Request() req: RequestWithTenant) {
    return this.datimMerService.generateAnomalyNarrative(req.tenantId, period);
  }

  @Post('submit/:period')
  submitToDatim(
    @Param('period') period: string,
    @Body() body: { orgUnitUid: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.datimMerService.submitToDatim(req.tenantId, period, body.orgUnitUid);
  }

  @Get('submissions')
  getSubmissions(@Request() req: RequestWithTenant) {
    return this.datimMerService.getSubmissions(req.tenantId);
  }

  @Get('indicator-mappings')
  getIndicatorMappings(@Request() req: RequestWithTenant) {
    return this.datimMerService.getIndicatorMappings(req.tenantId);
  }

  @Post('indicator-mappings')
  upsertIndicatorMapping(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.datimMerService.upsertIndicatorMapping(req.tenantId, body);
  }
}
