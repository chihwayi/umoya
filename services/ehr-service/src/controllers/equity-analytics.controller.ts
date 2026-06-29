import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EquityAnalyticsService } from '../services/equity-analytics.service';

@Controller('tenants/:tenantId/equity')
@UseGuards(JwtAuthGuard)
export class EquityAnalyticsController {
  constructor(private readonly equity: EquityAnalyticsService) {}

  @Get('disaggregate')
  disaggregate(
    @Param('tenantId') tenantId: string,
    @Query('kpi') kpi: string,
    @Query('dimension') dimension: string,
    @Query('period') period: string,
  ) {
    const p = period || new Date().toISOString().slice(0, 7).replace('-', '');
    return this.equity.disaggregate(tenantId, kpi || 'hiv_on_art', dimension as any || 'sex', p);
  }

  @Get('heat-matrix')
  heatMatrix(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string,
    @Query('kpis') kpis: string,
  ) {
    const p = period || new Date().toISOString().slice(0, 7).replace('-', '');
    const kpiList = kpis ? kpis.split(',') : ['hiv_on_art', 'tb_treatment_success', 'hypertension_controlled'];
    return this.equity.getHeatMatrix(tenantId, p, kpiList);
  }

  @Get('summary')
  summary(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string,
  ) {
    const p = period || new Date().toISOString().slice(0, 7).replace('-', '');
    return this.equity.getEquitySummary(tenantId, p);
  }
}
