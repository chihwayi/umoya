import { UseGuards, Controller, Post, Get, Body, Param, Query, Request, Headers, Req } from '@nestjs/common';
import { ModelMonitoringService } from '../services/model-monitoring.service';
import { RiskStratificationService } from '../services/risk-stratification.service';
import { OutcomeCollectionService } from '../services/outcome-collection.service';
import { CdssService } from '../services/cdss.service';
import { AiSurfaceContractService } from '../services/ai-surface-contract.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('model-monitoring')
@UseGuards(JwtAuthGuard)
export class ModelMonitoringController {
  constructor(
    private readonly svc: ModelMonitoringService,
    private readonly riskStratService: RiskStratificationService,
    private readonly outcomeService: OutcomeCollectionService,
    private readonly cdssService: CdssService,
    private readonly aiSurfaceContractService: AiSurfaceContractService,
  ) {}

  @Get('surfaces')
  listAiSurfaces() {
    return { surfaces: this.aiSurfaceContractService.listContracts() };
  }

  @Get('surfaces/:aiSurface/contract')
  async getAiSurfaceContract(
    @Req() req: RequestWithTenant,
    @Param('aiSurface') aiSurface: string,
  ) {
    const contract = this.aiSurfaceContractService.getContract(aiSurface);
    const latestRun = req.tenantDb && contract.monitoring.offlineEvalSupported
      ? (await this.svc.getOfflineEvalRuns(req.tenantDb, aiSurface))[0] || null
      : null;
    const releaseReadiness = req.tenantDb && contract.monitoring.releaseGateSupported
      ? await this.svc.getReleaseReadiness(req.tenantDb, aiSurface)
      : null;

    return {
      ...contract,
      latestRun,
      releaseReadiness,
    };
  }

  @Post('evaluate')
  evaluate(
    @Req() req: RequestWithTenant,
    @Body('modelName') modelName: string,
    @Body('period') period?: string,
  ) {
    return this.svc.evaluateModel(req.tenantDb!, modelName, period);
  }

  @Get('metrics/:modelName')
  getMetrics(
    @Req() req: RequestWithTenant,
    @Param('modelName') modelName: string,
  ) {
    return this.svc.getMetrics(req.tenantDb!, modelName);
  }

  @Get('fairness/:modelName')
  getFairness(
    @Req() req: RequestWithTenant,
    @Param('modelName') modelName: string,
  ) {
    return this.svc.getFairnessReports(req.tenantDb!, modelName);
  }

  @Post('offline-eval')
  recordOfflineEval(
    @Req() req: RequestWithTenant,
    @Body() body: Record<string, any>,
  ) {
    return this.svc.recordOfflineEvalRun(req.tenantDb!, {
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
    @Req() req: RequestWithTenant,
    @Param('aiSurface') aiSurface: string,
  ) {
    return this.svc.getOfflineEvalRuns(req.tenantDb!, aiSurface);
  }

  @Get('release-gates/:aiSurface')
  getReleaseGates(
    @Req() req: RequestWithTenant,
    @Param('aiSurface') aiSurface: string,
  ) {
    return this.svc.getReleaseGateResults(req.tenantDb!, aiSurface);
  }

  @Get('release-readiness/:aiSurface')
  getReleaseReadiness(
    @Req() req: RequestWithTenant,
    @Param('aiSurface') aiSurface: string,
  ) {
    return this.svc.getReleaseReadiness(req.tenantDb!, aiSurface);
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
  async getAiOpsMetrics(@Req() req: RequestWithTenant) {
    if (!req.tenantDb) return { metrics: [] };
    const rows = await req.tenantDb.query(`
      SELECT surface, metric_date, total_calls, abstention_count,
             circuit_breaker_trips, avg_latency_ms, accuracy,
             fairness_age_parity, fairness_gender_parity, fairness_sdoh_parity
      FROM ai_ops_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY surface, metric_date DESC
    `);
    return { metrics: rows };
  }

  @Get('ai-ops/control-tower')
  async getAiOpsControlTower(@Req() req: RequestWithTenant) {
    if (!req.tenantDb) return { surfaces: [] };

    const contracts = this.aiSurfaceContractService.listContracts();
    const metricsRows = await req.tenantDb.query(`
      SELECT surface, metric_date, total_calls, abstention_count,
             circuit_breaker_trips, avg_latency_ms, accuracy,
             fairness_age_parity, fairness_gender_parity, fairness_sdoh_parity
      FROM ai_ops_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY surface, metric_date DESC
    `);

    const latestMetricsBySurface = metricsRows.reduce((acc: Record<string, any>, row: any) => {
      if (!acc[row.surface]) acc[row.surface] = row;
      return acc;
    }, {});

    const releaseReadinessEntries = await Promise.all(
      contracts.map(async (contract) => {
        if (!contract.monitoring.releaseGateSupported) {
          return [contract.aiSurface, null] as const;
        }
        return [contract.aiSurface, await this.svc.getReleaseReadiness(req.tenantDb!, contract.aiSurface)] as const;
      }),
    );

    let versions: Record<string, any> = {};
    try {
      versions = await this.cdssService.getModelVersions(tenantId);
    } catch {
      versions = {};
    }

    const releaseReadinessBySurface = Object.fromEntries(releaseReadinessEntries);

    const surfaces = contracts.map((contract) => {
      const metricsSurface = contract.monitoring.metricsSurface;
      const latestMetrics = latestMetricsBySurface[metricsSurface] || latestMetricsBySurface[contract.aiSurface] || null;
      const releaseReadiness = releaseReadinessBySurface[contract.aiSurface] || null;
      const modelVersion = versions[metricsSurface] || versions[contract.aiSurface] || null;
      const abstentionRate = latestMetrics?.total_calls
        ? Number((latestMetrics.abstention_count / Math.max(latestMetrics.total_calls, 1)).toFixed(4))
        : 0;
      const fairnessValues = [
        latestMetrics?.fairness_age_parity,
        latestMetrics?.fairness_gender_parity,
        latestMetrics?.fairness_sdoh_parity,
      ].filter((value) => value !== null && value !== undefined) as number[];
      const fairnessGap = fairnessValues.length > 0 ? Math.max(...fairnessValues) : null;

      const alerts: string[] = [];
      if (releaseReadiness?.releaseStatus === 'blocked') alerts.push('Release gates blocked');
      if ((latestMetrics?.circuit_breaker_trips || 0) > 0) alerts.push('Recent circuit breaker activity');
      if (abstentionRate >= 0.2) alerts.push('High abstention rate');
      if ((latestMetrics?.avg_latency_ms || 0) >= 3000) alerts.push('High latency');
      if (fairnessGap !== null && fairnessGap > 0.1) alerts.push('Fairness parity gap requires review');
      if (!latestMetrics) alerts.push('No AI ops metrics recorded yet');
      const degradationAlerts = alerts.filter((alert) => alert !== 'No AI ops metrics recorded yet');

      const status =
        releaseReadiness?.releaseStatus === 'blocked'
          ? 'blocked'
          : degradationAlerts.length > 0
            ? 'watch'
          : latestMetrics
              ? 'healthy'
              : 'unknown';

      return {
        aiSurface: contract.aiSurface,
        displayName: contract.displayName,
        description: contract.description,
        useCases: contract.useCases,
        metricsSurface,
        monitoring: contract.monitoring,
        audit: contract.audit,
        controls: contract.controls,
        latestMetrics: latestMetrics
          ? {
              metricDate: latestMetrics.metric_date,
              totalCalls: Number(latestMetrics.total_calls || 0),
              abstentionCount: Number(latestMetrics.abstention_count || 0),
              abstentionRate,
              circuitBreakerTrips: Number(latestMetrics.circuit_breaker_trips || 0),
              avgLatencyMs: latestMetrics.avg_latency_ms !== null ? Number(latestMetrics.avg_latency_ms) : null,
              accuracy: latestMetrics.accuracy !== null ? Number(latestMetrics.accuracy) : null,
              fairnessAgeParity: latestMetrics.fairness_age_parity !== null ? Number(latestMetrics.fairness_age_parity) : null,
              fairnessGenderParity: latestMetrics.fairness_gender_parity !== null ? Number(latestMetrics.fairness_gender_parity) : null,
              fairnessSdohParity: latestMetrics.fairness_sdoh_parity !== null ? Number(latestMetrics.fairness_sdoh_parity) : null,
            }
          : null,
        releaseReadiness,
        modelVersion,
        status,
        alerts,
      };
    });

    return { surfaces };
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
