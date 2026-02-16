import { Injectable, Logger } from '@nestjs/common';
import * as promClient from 'prom-client';

/**
 * Prometheus Metrics Service
 * Exposes metrics for monitoring and observability
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly register: promClient.Registry;

  // CDSS Hook Metrics
  private readonly cdssHookCounter: promClient.Counter;
  private readonly cdssHookDuration: promClient.Histogram;
  private readonly cdssHookErrors: promClient.Counter;
  private readonly cdssDependencyRetryCounter: promClient.Counter;
  private readonly cdssDependencyTimeoutCounter: promClient.Counter;
  private readonly nurseCopilotRecommendationCounter: promClient.Counter;
  private readonly nurseCopilotDecisionCounter: promClient.Counter;
  private readonly nurseCopilotTimeToTriage: promClient.Histogram;
  private readonly nurseCopilotDocumentationDuration: promClient.Histogram;
  private readonly nurseCopilotAlertResponseDuration: promClient.Histogram;

  private readonly nurseCopilotKpiState = {
    recommendationsTotal: 0,
    decisionsTotal: 0,
    decisionsByType: {} as Record<string, number>,
    recommendationsByType: {} as Record<string, number>,
    timeToTriageSamples: 0,
    timeToTriageTotalSeconds: 0,
    documentationSamples: 0,
    documentationTotalSeconds: 0,
    alertResponseSamples: 0,
    alertResponseTotalSeconds: 0,
  };

  // Provisioning Metrics
  private readonly provisioningCounter: promClient.Counter;
  private readonly provisioningDuration: promClient.Histogram;
  private readonly provisioningErrors: promClient.Counter;

  // Automation Metrics
  private readonly automationCounter: promClient.Counter;
  private readonly automationErrors: promClient.Counter;

  // SNOMED/ICD-10 Metrics
  private readonly snomedSearchCounter: promClient.Counter;
  private readonly icd10MappingCounter: promClient.Counter;

  constructor() {
    this.register = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.register });

    // CDSS Hook Metrics
    this.cdssHookCounter = new promClient.Counter({
      name: 'cdss_hooks_total',
      help: 'Total number of CDSS hooks triggered',
      labelNames: ['event_type', 'status'],
      registers: [this.register],
    });

    this.cdssHookDuration = new promClient.Histogram({
      name: 'cdss_hook_duration_seconds',
      help: 'CDSS hook processing duration in seconds',
      labelNames: ['event_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.cdssHookErrors = new promClient.Counter({
      name: 'cdss_hook_errors_total',
      help: 'Total number of CDSS hook errors',
      labelNames: ['event_type', 'error_type'],
      registers: [this.register],
    });

    this.cdssDependencyRetryCounter = new promClient.Counter({
      name: 'cdss_dependency_retries_total',
      help: 'Total number of EHR to CDSS retry attempts',
      labelNames: ['event_type', 'reason'],
      registers: [this.register],
    });

    this.cdssDependencyTimeoutCounter = new promClient.Counter({
      name: 'cdss_dependency_timeouts_total',
      help: 'Total number of EHR to CDSS timeout failures',
      labelNames: ['event_type'],
      registers: [this.register],
    });

    this.nurseCopilotRecommendationCounter = new promClient.Counter({
      name: 'nurse_copilot_recommendations_total',
      help: 'Total nurse copilot recommendations emitted by type and risk level',
      labelNames: ['copilot_type', 'risk_level'],
      registers: [this.register],
    });

    this.nurseCopilotDecisionCounter = new promClient.Counter({
      name: 'nurse_copilot_decisions_total',
      help: 'Total nurse copilot decisions by copilot type and decision',
      labelNames: ['copilot_type', 'decision'],
      registers: [this.register],
    });

    this.nurseCopilotTimeToTriage = new promClient.Histogram({
      name: 'nurse_copilot_time_to_triage_seconds',
      help: 'Elapsed time from queue entry to copilot triage recommendation',
      buckets: [30, 60, 120, 300, 600, 900, 1800],
      registers: [this.register],
    });

    this.nurseCopilotDocumentationDuration = new promClient.Histogram({
      name: 'nurse_copilot_documentation_duration_seconds',
      help: 'Elapsed time from documentation start to copilot note/handoff output',
      labelNames: ['documentation_type'],
      buckets: [15, 30, 60, 120, 300, 600, 900],
      registers: [this.register],
    });

    this.nurseCopilotAlertResponseDuration = new promClient.Histogram({
      name: 'nurse_copilot_alert_response_seconds',
      help: 'Elapsed time from alert creation to nurse acknowledgement',
      buckets: [10, 30, 60, 120, 300, 600, 900, 1800],
      registers: [this.register],
    });

    // Provisioning Metrics
    this.provisioningCounter = new promClient.Counter({
      name: 'provisioning_operations_total',
      help: 'Total number of provisioning operations',
      labelNames: ['bundle_id', 'status'],
      registers: [this.register],
    });

    this.provisioningDuration = new promClient.Histogram({
      name: 'provisioning_duration_seconds',
      help: 'Provisioning operation duration in seconds',
      labelNames: ['bundle_id'],
      buckets: [1, 5, 10, 30, 60, 300],
      registers: [this.register],
    });

    this.provisioningErrors = new promClient.Counter({
      name: 'provisioning_errors_total',
      help: 'Total number of provisioning errors',
      labelNames: ['bundle_id', 'error_type'],
      registers: [this.register],
    });

    // Automation Metrics
    this.automationCounter = new promClient.Counter({
      name: 'automation_jobs_total',
      help: 'Total number of automation jobs executed',
      labelNames: ['job_type', 'status'],
      registers: [this.register],
    });

    this.automationErrors = new promClient.Counter({
      name: 'automation_errors_total',
      help: 'Total number of automation job errors',
      labelNames: ['job_type'],
      registers: [this.register],
    });

    // SNOMED/ICD-10 Metrics
    this.snomedSearchCounter = new promClient.Counter({
      name: 'snomed_searches_total',
      help: 'Total number of SNOMED searches',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.icd10MappingCounter = new promClient.Counter({
      name: 'icd10_mappings_total',
      help: 'Total number of ICD-10 mapping lookups',
      labelNames: ['status'],
      registers: [this.register],
    });
  }

  // CDSS Hook Metrics
  recordCdssHook(eventType: string, status: 'success' | 'error', durationSeconds?: number) {
    this.cdssHookCounter.inc({ event_type: eventType, status });
    if (durationSeconds !== undefined) {
      this.cdssHookDuration.observe({ event_type: eventType }, durationSeconds);
    }
    if (status === 'error') {
      this.cdssHookErrors.inc({ event_type: eventType, error_type: 'unknown' });
    }
  }

  recordCdssHookError(eventType: string, errorType: string) {
    this.cdssHookErrors.inc({ event_type: eventType, error_type: errorType });
  }

  recordCdssRetry(eventType: string, reason: string) {
    this.cdssDependencyRetryCounter.inc({ event_type: eventType, reason });
  }

  recordCdssTimeout(eventType: string) {
    this.cdssDependencyTimeoutCounter.inc({ event_type: eventType });
  }

  recordNurseCopilotRecommendation(copilotType: string, riskLevel?: string) {
    const type = (copilotType || 'unknown').toLowerCase();
    const risk = (riskLevel || 'unknown').toLowerCase();
    this.nurseCopilotRecommendationCounter.inc({ copilot_type: type, risk_level: risk });
    this.nurseCopilotKpiState.recommendationsTotal += 1;
    this.nurseCopilotKpiState.recommendationsByType[type] =
      (this.nurseCopilotKpiState.recommendationsByType[type] || 0) + 1;
  }

  recordNurseCopilotDecision(copilotType: string, decision: string) {
    const type = (copilotType || 'unknown').toLowerCase();
    const normalizedDecision = (decision || 'unknown').toLowerCase();
    this.nurseCopilotDecisionCounter.inc({ copilot_type: type, decision: normalizedDecision });
    this.nurseCopilotKpiState.decisionsTotal += 1;
    const stateKey = `${type}:${normalizedDecision}`;
    this.nurseCopilotKpiState.decisionsByType[stateKey] =
      (this.nurseCopilotKpiState.decisionsByType[stateKey] || 0) + 1;
  }

  recordNurseCopilotTimeToTriage(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }
    this.nurseCopilotTimeToTriage.observe(seconds);
    this.nurseCopilotKpiState.timeToTriageSamples += 1;
    this.nurseCopilotKpiState.timeToTriageTotalSeconds += seconds;
  }

  recordNurseCopilotDocumentationDuration(seconds: number, documentationType: 'note' | 'handoff' = 'note') {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }
    this.nurseCopilotDocumentationDuration.observe({ documentation_type: documentationType }, seconds);
    this.nurseCopilotKpiState.documentationSamples += 1;
    this.nurseCopilotKpiState.documentationTotalSeconds += seconds;
  }

  recordNurseCopilotAlertResponseTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }
    this.nurseCopilotAlertResponseDuration.observe(seconds);
    this.nurseCopilotKpiState.alertResponseSamples += 1;
    this.nurseCopilotKpiState.alertResponseTotalSeconds += seconds;
  }

  getNurseCopilotKpis() {
    const triageAvg =
      this.nurseCopilotKpiState.timeToTriageSamples > 0
        ? this.nurseCopilotKpiState.timeToTriageTotalSeconds / this.nurseCopilotKpiState.timeToTriageSamples
        : null;
    const documentationAvg =
      this.nurseCopilotKpiState.documentationSamples > 0
        ? this.nurseCopilotKpiState.documentationTotalSeconds / this.nurseCopilotKpiState.documentationSamples
        : null;
    const alertAvg =
      this.nurseCopilotKpiState.alertResponseSamples > 0
        ? this.nurseCopilotKpiState.alertResponseTotalSeconds / this.nurseCopilotKpiState.alertResponseSamples
        : null;

    return {
      recommendationsTotal: this.nurseCopilotKpiState.recommendationsTotal,
      decisionsTotal: this.nurseCopilotKpiState.decisionsTotal,
      recommendationsByType: this.nurseCopilotKpiState.recommendationsByType,
      decisionsByType: this.nurseCopilotKpiState.decisionsByType,
      timeToTriage: {
        samples: this.nurseCopilotKpiState.timeToTriageSamples,
        averageSeconds: triageAvg,
      },
      documentation: {
        samples: this.nurseCopilotKpiState.documentationSamples,
        averageSeconds: documentationAvg,
      },
      alertResponse: {
        samples: this.nurseCopilotKpiState.alertResponseSamples,
        averageSeconds: alertAvg,
      },
    };
  }

  // Provisioning Metrics
  recordProvisioning(bundleId: string, status: 'success' | 'error', durationSeconds?: number) {
    this.provisioningCounter.inc({ bundle_id: bundleId, status });
    if (durationSeconds !== undefined) {
      this.provisioningDuration.observe({ bundle_id: bundleId }, durationSeconds);
    }
    if (status === 'error') {
      this.provisioningErrors.inc({ bundle_id: bundleId, error_type: 'unknown' });
    }
  }

  recordProvisioningError(bundleId: string, errorType: string) {
    this.provisioningErrors.inc({ bundle_id: bundleId, error_type: errorType });
  }

  // Automation Metrics
  recordAutomationJob(jobType: string, status: 'success' | 'error') {
    this.automationCounter.inc({ job_type: jobType, status });
    if (status === 'error') {
      this.automationErrors.inc({ job_type: jobType });
    }
  }

  recordAutomationError(jobType: string) {
    this.automationErrors.inc({ job_type: jobType });
  }

  // SNOMED/ICD-10 Metrics
  recordSnomedSearch(status: 'success' | 'error') {
    this.snomedSearchCounter.inc({ status });
  }

  recordIcd10Mapping(status: 'success' | 'error') {
    this.icd10MappingCounter.inc({ status });
  }

  // Get metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  // Get metrics registry
  getRegister(): promClient.Registry {
    return this.register;
  }
}
