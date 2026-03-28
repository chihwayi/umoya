import { Controller, Post, Get, Body, Param, Query, Request, Headers } from '@nestjs/common';
import { ModelMonitoringService } from '../services/model-monitoring.service';
import { RiskStratificationService } from '../services/risk-stratification.service';
import { OutcomeCollectionService } from '../services/outcome-collection.service';
import { CdssService } from '../services/cdss.service';

@Controller('model-monitoring')
export class ModelMonitoringController {
  constructor(
    private readonly svc: ModelMonitoringService,
    private readonly riskStratService: RiskStratificationService,
    private readonly outcomeService: OutcomeCollectionService,
    private readonly cdssService: CdssService,
  ) {}

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

  @Get('patients/:patientId/risk-tier')
  async getPatientRiskTier(
    @Param('patientId') patientId: string,
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    return this.riskStratService.getPatientRiskTier(patientId, tenantId);
  }

  @Post('risk-stratification/batch')
  async runRiskStratBatch(@Request() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    return this.riskStratService.runBatch(tenantId);
  }

  @Post('outcomes/collect-now')
  async collectOutcomesNow() {
    await this.outcomeService.collectOutcomes();
    return { triggered: true };
  }

  @Post('model-evaluation/run-now')
  async runModelEvaluationNow() {
    await this.outcomeService.runModelEvaluation();
    return { triggered: true };
  }

  @Get('ai-ops/metrics')
  async getAiOpsMetrics(@Query('subdomain') subdomain: string, @Request() req: any) {
    const tenantId = subdomain ?? req.headers['x-tenant-id'];
    const tenantDb = await (this.riskStratService as any).tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) return { metrics: [] };
    const rows = await tenantDb.query(`
      SELECT surface, metric_date, total_calls, abstention_count,
             circuit_breaker_trips, avg_latency_ms, accuracy,
             fairness_age_parity, fairness_gender_parity, fairness_sdoh_parity
      FROM ai_ops_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY surface, metric_date DESC
    `);
    return { metrics: rows };
  }

  @Get('model-versions')
  async getModelVersions(@Headers('x-tenant-slug') tenantSlug: string) {
    try {
      const versions = await this.cdssService.getModelVersions(tenantSlug);
      return { versions };
    } catch {
      return { versions: {}, error: 'Could not fetch model versions from CDSS' };
    }
  }
}
