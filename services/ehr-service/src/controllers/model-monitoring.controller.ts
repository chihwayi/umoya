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

  @Post('offline-eval')
  recordOfflineEval(
    @Body('subdomain') subdomain: string,
    @Body() body: Record<string, any>,
  ) {
    return this.svc.recordOfflineEvalRun(subdomain, {
      aiSurface: body.aiSurface,
      modelName: body.modelName,
      caseSetName: body.caseSetName,
      datasetVersion: body.datasetVersion,
      totalCases: body.totalCases,
      reportPath: body.reportPath,
      executedBy: body.executedBy,
      summary: body.summary,
      metrics: body.metrics || {},
      gateInputs: body.gateInputs || {},
    });
  }

  @Get('offline-eval/:aiSurface')
  getOfflineEvalRuns(
    @Param('aiSurface') aiSurface: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getOfflineEvalRuns(subdomain, aiSurface);
  }

  @Get('release-gates/:aiSurface')
  getReleaseGates(
    @Param('aiSurface') aiSurface: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getReleaseGateResults(subdomain, aiSurface);
  }

  @Get('release-readiness/:aiSurface')
  getReleaseReadiness(
    @Param('aiSurface') aiSurface: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getReleaseReadiness(subdomain, aiSurface);
  }
}
