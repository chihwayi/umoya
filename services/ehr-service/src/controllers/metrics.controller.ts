import { Controller, Get, Header, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { MetricsService } from '../services/metrics.service';

@ApiTags('Metrics (Prometheus)')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Metrics returned in Prometheus format' })
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  @Get('nurse-copilot/kpis')
  @ApiOperation({ summary: 'Get nurse copilot KPI snapshot (in-memory aggregates)' })
  @ApiResponse({ status: 200, description: 'Nurse copilot KPI snapshot returned' })
  getNurseCopilotKpis() {
    return this.metricsService.getNurseCopilotKpis();
  }

  @Get('workflow-health')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get workflow health snapshot for HIV, coordination, and revenue cycle baselines' })
  @ApiResponse({ status: 200, description: 'Workflow health snapshot returned' })
  getWorkflowHealthSnapshot(@Request() req: RequestWithTenant) {
    return this.metricsService.getWorkflowHealthSnapshot(req.tenantDb);
  }

  @Get('health-report')
  @ApiOperation({ summary: 'Minimal platform health/SLA report for ops or tenant reporting' })
  @ApiResponse({ status: 200, description: 'Health report with status and metrics hint' })
  getHealthReport() {
    return {
      service: 'ehr-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
      metrics: 'Prometheus scrape at GET /metrics for uptime and error rates',
      workflowHealth: 'Authenticated GET /metrics/workflow-health for tenant workflow baselines',
    };
  }
}
