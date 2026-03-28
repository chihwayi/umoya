import { Controller, Get, Post, Patch, Body, Param, Headers, Query } from '@nestjs/common';
import { PmtctService } from '../services/pmtct.service';

@Controller('hiv/mer')
export class PepfarMerController {
  constructor(private readonly svc: PmtctService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  // ── PEPFAR MER Indicators ─────────────────────────────────────────────────

  @Post('indicator')
  saveMerIndicator(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.svc.saveMerIndicator(this.tenant(h), dto);
  }

  @Get('indicator')
  getMerIndicators(@Headers() h: Record<string, string>, @Query('period') period?: string) {
    return this.svc.getMerIndicators(this.tenant(h), period);
  }

  @Post('calculate')
  calculateMer(@Headers() h: Record<string, string>, @Body() dto: { reportingPeriod: string }) {
    return this.svc.calculateMer(this.tenant(h), dto.reportingPeriod);
  }

  @Post('cdss/calculate')
  merCalculate(@Body() dto: any) {
    return this.svc.merCalculate(dto);
  }

  // ── ART Cohorts ───────────────────────────────────────────────────────────

  @Post('cohort')
  saveCohort(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.svc.saveCohort(this.tenant(h), dto);
  }

  @Get('cohort')
  getCohorts(@Headers() h: Record<string, string>) {
    return this.svc.getCohorts(this.tenant(h));
  }

  @Patch('cohort/:id')
  updateCohort(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCohort(this.tenant(h), id, dto);
  }
}
