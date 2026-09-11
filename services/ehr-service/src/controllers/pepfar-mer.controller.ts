import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req, Query } from '@nestjs/common';
import { PmtctService } from '../services/pmtct.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('hiv/mer')
@UseGuards(JwtAuthGuard)
export class PepfarMerController {
  constructor(private readonly svc: PmtctService) {}

  // ── PEPFAR MER Indicators ─────────────────────────────────────────────────

  @Post('indicator')
  saveMerIndicator(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.saveMerIndicator(req.tenantDb!, dto);
  }

  @Get('indicator')
  getMerIndicators(@Req() req: RequestWithTenant, @Query('period') period?: string) {
    return this.svc.getMerIndicators(req.tenantDb!, period);
  }

  @Post('calculate')
  calculateMer(@Req() req: RequestWithTenant, @Body() dto: { reportingPeriod: string }) {
    return this.svc.calculateMer(req.tenantDb!, dto.reportingPeriod);
  }

  @Post('cdss/calculate')
  merCalculate(@Body() dto: any) {
    return this.svc.merCalculate(dto);
  }

  // ── ART Cohorts ───────────────────────────────────────────────────────────

  @Post('cohort')
  saveCohort(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.saveCohort(req.tenantDb!, dto);
  }

  @Get('cohort')
  getCohorts(@Req() req: RequestWithTenant) {
    return this.svc.getCohorts(req.tenantDb!);
  }

  @Patch('cohort/:id')
  updateCohort(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCohort(req.tenantDb!, id, dto);
  }
}
