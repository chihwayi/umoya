import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { AiPerformanceService } from '../services/ai-performance.service';

@Controller('tenants/:tenantId/ai')
@UseGuards(JwtAuthGuard)
export class AiPerformanceController {
  constructor(private readonly aiPerformance: AiPerformanceService) {}

  @Post('predictions')
  recordPrediction(@Param('tenantId') tenantId: string, @Body() dto: any) {
    return this.aiPerformance.recordPrediction(tenantId, dto);
  }

  @Put('predictions/:id/outcome')
  verifyOutcome(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.aiPerformance.verifyOutcome(tenantId, id, dto.actual_outcome, dto.source ?? 'manual');
  }

  @Get('performance')
  getPerformanceSummary(@Param('tenantId') tenantId: string) {
    return this.aiPerformance.getModelPerformanceSummary(tenantId);
  }

  @Get('performance/:model/trend')
  getModelTrend(
    @Param('tenantId') tenantId: string,
    @Param('model') model: string,
    @Query('periods') periods: string,
  ) {
    return this.aiPerformance.getModelTrend(tenantId, model, Number(periods) || 6);
  }

  @Post('performance/compute')
  computeSnapshot(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string,
    @Query('model') model: string,
  ) {
    const p = period || new Date().toISOString().slice(0, 7);
    return this.aiPerformance.computeMonthlySnapshot(tenantId, model, p);
  }

  @Post('performance/auto-verify')
  autoVerify(@Param('tenantId') tenantId: string) {
    return this.aiPerformance.autoVerifyPredictions(tenantId);
  }
}
