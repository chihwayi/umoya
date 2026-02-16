import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
}
