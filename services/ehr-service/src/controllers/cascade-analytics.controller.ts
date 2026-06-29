import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CascadeAnalyticsService } from '../services/cascade-analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('tenants/:tenantId/cascades')
export class CascadeAnalyticsController {
  constructor(private readonly svc: CascadeAnalyticsService) {}

  private period(startDate?: string, endDate?: string) {
    const end = endDate ?? new Date().toISOString().slice(0, 10);
    const start = startDate ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    return { start, end };
  }

  @Get('hiv')
  getHiv(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.getHivCascade(tenantId, this.period(startDate, endDate));
  }

  @Get('pmtct')
  getPmtct(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.getPmtctCascade(tenantId, this.period(startDate, endDate));
  }

  @Get('tb-hiv')
  getTbHiv(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.getTbHivCascade(tenantId, this.period(startDate, endDate));
  }

  @Get('ncd')
  getNcd(
    @Param('tenantId') tenantId: string,
    @Query('condition') condition: 'hypertension' | 'diabetes' | 'ckd' = 'diabetes',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.getNcdCascade(tenantId, condition, this.period(startDate, endDate));
  }

  @Get('hiv/gaps/:gap')
  getHivGap(
    @Param('tenantId') tenantId: string,
    @Param('gap') gap: 'not-on-art' | 'not-suppressed',
  ) {
    return this.svc.getHivGap(tenantId, gap);
  }

  @Get('pmtct/gaps/eid-not-tested')
  getPmtctGap(@Param('tenantId') tenantId: string) {
    return this.svc.getPmtctGap(tenantId);
  }

  @Get('tb-hiv/gaps/hiv-status-unknown')
  getTbHivGap(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.getTbHivGap(tenantId, this.period(startDate, endDate));
  }

  @Get('ncd/gaps/not-in-care')
  getNcdGap(
    @Param('tenantId') tenantId: string,
    @Query('condition') condition: string = 'diabetes',
  ) {
    return this.svc.getNcdGap(tenantId, condition);
  }
}
