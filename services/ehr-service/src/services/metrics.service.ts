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
