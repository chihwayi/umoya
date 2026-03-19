import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ModelMonitoringService } from '../services/model-monitoring.service';

@Controller('model-monitoring')
export class ModelMonitoringController {
  constructor(private readonly svc: ModelMonitoringService) {}

  @Post('evaluate')
  evaluate(
    @Body('subdomain') subdomain: string,
    @Body('modelName') modelName: string,
    @Body('period') period?: string,
  ) {
    return this.svc.evaluateModel(subdomain, modelName, period);
  }

  @Get('metrics/:modelName')
  getMetrics(
    @Param('modelName') modelName: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getMetrics(subdomain, modelName);
  }

  @Get('fairness/:modelName')
  getFairness(
    @Param('modelName') modelName: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getFairnessReports(subdomain, modelName);
  }
}
