import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BenchmarkingService } from '../services/benchmarking.service';

@Controller('tenants/:tenantId/benchmarking')
@UseGuards(JwtAuthGuard)
export class BenchmarkingController {
  constructor(private readonly benchmarking: BenchmarkingService) {}

  @Get('metrics')
  getMetrics() {
    return this.benchmarking.getMetricDefinitions();
  }

  @Get('scorecard')
  getScorecard(
    @Param('tenantId') tenantId: string,
    @Query('facilityId') facilityId: string,
    @Query('period') period: string,
  ) {
    const p = period || new Date().toISOString().slice(0, 7).replace('-', '');
    return this.benchmarking.getFacilityScorecard(tenantId, facilityId || tenantId, p);
  }

  @Post('compute')
  compute(
    @Param('tenantId') tenantId: string,
    @Query('facilityId') facilityId: string,
    @Query('period') period: string,
  ) {
    const p = period || new Date().toISOString().slice(0, 7).replace('-', '');
    return this.benchmarking.computeFacilitySnapshot(tenantId, facilityId || tenantId, p);
  }

  @Get('trend')
  getTrend(
    @Param('tenantId') tenantId: string,
    @Query('facilityId') facilityId: string,
    @Query('metric') metric: string,
    @Query('periods') periods: string,
  ) {
    return this.benchmarking.getTrend(tenantId, facilityId || tenantId, metric, Number(periods) || 12);
  }
}
